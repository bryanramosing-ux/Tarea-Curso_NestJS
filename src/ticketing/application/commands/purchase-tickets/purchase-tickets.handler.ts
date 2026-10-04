import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import { EventNotAvailableForSaleError, SalesConcurrentModificationError } from '../../../domain/errors/ticketing.errors';
import { EVENT_CATALOG, EventCatalog } from '../../../domain/ports/event-catalog.port';
import { TICKET_ALLOCATION_REPOSITORY, TicketAllocationRepository } from '../../../domain/ports/ticket-allocation.repository';
import { TICKET_CODE_HASHER, TicketCodeHasher } from '../../../domain/ports/ticket-code-hasher.port';
import { TICKET_REPOSITORY, TicketRepository } from '../../../domain/ports/ticket.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { HolderEmail } from '../../../domain/value-objects/holder-email';
import { HolderName } from '../../../domain/value-objects/holder-name';
import { Money } from '../../../domain/value-objects/money';
import { Quantity } from '../../../domain/value-objects/quantity';
import { TicketCode } from '../../../domain/value-objects/ticket-code';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { PurchaseTicketsCommand, PurchaseTicketsResult } from './purchase-tickets.command';

/** Reintentos si otra compra modifica el cupo al mismo tiempo. */
export const PURCHASE_MAX_ATTEMPTS = 10;
/** Espera aleatoria máxima por intento (ms): evita que los compradores vuelvan a chocar a la vez. */
const RETRY_JITTER_MS = 20;

function backoff(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * RETRY_JITTER_MS * attempt)));
}

/**
 * Orquesta la compra:
 *  1. valida la entrada con value objects;
 *  2. carga el cupo del evento (o lo abre consultando el catálogo por el ACL);
 *  3. delega en el agregado la decisión (RN-009, RN-010, RN-015) y lo guarda con
 *     bloqueo optimista; si otra compra lo cambió en paralelo, relee y reintenta,
 *     así dos compradores nunca obtienen la misma plaza;
 *  4. emite las entradas guardando solo el hash de cada código (RN-012);
 *  5. DESPUÉS de persistir, publica los eventos.
 */
@CommandHandler(PurchaseTicketsCommand)
export class PurchaseTicketsHandler implements ICommandHandler<PurchaseTicketsCommand> {
  constructor(
    @Inject(TICKET_ALLOCATION_REPOSITORY) private readonly allocations: TicketAllocationRepository,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(EVENT_CATALOG) private readonly catalog: EventCatalog,
    @Inject(TICKET_CODE_HASHER) private readonly codeHasher: TicketCodeHasher,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: PurchaseTicketsCommand): Promise<PurchaseTicketsResult> {
    const eventId = EventReference.create(command.eventId);
    const quantity = Quantity.create(command.quantity);
    const holderName = HolderName.create(command.holderName);
    const holderEmail = HolderEmail.create(command.holderEmail);

    const { allocation, total } = await this.reserve(eventId, quantity);

    const issued: { ticket: Ticket; code: TicketCode }[] = [];
    for (let i = 0; i < quantity.value; i++) {
      const code = TicketCode.generate();
      const ticket = Ticket.issue({
        id: TicketId.generate(),
        eventId,
        holderName,
        holderEmail,
        codeHash: await this.codeHasher.hash(code),
        price: allocation.unitPrice,
      });
      await this.tickets.save(ticket);
      issued.push({ ticket, code });
    }

    await this.eventPublisher.publishAll([
      ...allocation.pullDomainEvents(),
      ...issued.flatMap(({ ticket }) => ticket.pullDomainEvents()),
    ]);

    return {
      eventId: eventId.value,
      tickets: issued.map(({ ticket, code }) => ({ id: ticket.id.value, code: code.reveal() })),
      total: { amountCents: total.amountCents, currency: total.currency },
    };
  }

  /** Reserva las plazas en el cupo del evento, reintentando ante compras simultáneas. */
  private async reserve(
    eventId: EventReference,
    quantity: Quantity,
  ): Promise<{ allocation: TicketAllocation; total: Money }> {
    for (let attempt = 1; ; attempt++) {
      const allocation = (await this.allocations.findByEvent(eventId)) ?? (await this.openSales(eventId));
      const total = allocation.sell(quantity);
      try {
        await this.allocations.save(allocation);
        return { allocation, total };
      } catch (error) {
        if (!(error instanceof SalesConcurrentModificationError) || attempt >= PURCHASE_MAX_ATTEMPTS) {
          throw error;
        }
        await backoff(attempt);
      }
    }
  }

  private async openSales(eventId: EventReference): Promise<TicketAllocation> {
    const event = await this.catalog.findEvent(eventId);
    if (!event) {
      throw new EventNotAvailableForSaleError(eventId.value);
    }
    return TicketAllocation.open(event);
  }
}
