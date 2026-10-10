import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { backoff } from '../../../../shared/application/retry';
import { CLOCK, Clock } from '../../../../shared/domain/ports/clock.port';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { ID_GENERATOR, IdGenerator } from '../../../../shared/domain/ports/id-generator.port';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/domain/ports/unit-of-work.port';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import {
  EventNotAvailableForSaleError,
  SalesClosedError,
  SalesConcurrentModificationError,
} from '../../../domain/errors/ticketing.errors';
import { EVENT_CATALOG, EventCatalog } from '../../../domain/ports/event-catalog.port';
import { TICKET_ALLOCATION_REPOSITORY, TicketAllocationRepository } from '../../../domain/ports/ticket-allocation.repository';
import { TICKET_CODE_GENERATOR, TicketCodeGenerator } from '../../../domain/ports/ticket-code-generator.port';
import { TICKET_CODE_HASHER, TicketCodeHasher } from '../../../domain/ports/ticket-code-hasher.port';
import { TICKET_REPOSITORY, TicketRepository } from '../../../domain/ports/ticket.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { HolderEmail } from '../../../domain/value-objects/holder-email';
import { HolderName } from '../../../domain/value-objects/holder-name';
import { Quantity } from '../../../domain/value-objects/quantity';
import { TicketCode } from '../../../domain/value-objects/ticket-code';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { PurchaseTicketsCommand, PurchaseTicketsResult } from './purchase-tickets.command';

/** Reintentos si otra operación modifica el cupo al mismo tiempo. */
export const PURCHASE_MAX_ATTEMPTS = 10;
/** Espera aleatoria máxima por intento (ms): evita que los compradores vuelvan a chocar a la vez. */
const RETRY_JITTER_MS = 20;

/**
 * Orquesta la compra:
 *  1. valida la entrada con value objects;
 *  2. consulta el catálogo por el ACL: si el evento no existe -> 404; si fue
 *     cancelado -> 409 aunque su cupo siga abierto (p. ej. si el cierre
 *     automático falló), así nunca se vende para un evento cancelado;
 *  3. en UNA transacción (puerto UnitOfWork): carga o abre el cupo, cuenta las
 *     entradas del titular (RN-008), delega en el agregado la decisión
 *     (RN-008, RN-009, RN-010, RN-015), lo guarda con bloqueo optimista y
 *     emite las entradas guardando solo el hash de cada código (RN-012). O se
 *     guarda todo o nada: el cupo nunca cuenta plazas sin entrada;
 *  4. si otra operación cambió el cupo en paralelo, la transacción se deshace
 *     y se reintenta entera (relee y recuenta);
 *  5. DESPUÉS de confirmar, publica los eventos.
 * El cupo es el punto de serialización frente a una cancelación: el cierre de
 * la venta también lo modifica (o lo crea cerrado), así que o la compra ve la
 * venta cerrada, o el cierre ve (y reembolsa) las entradas ya confirmadas.
 */
@CommandHandler(PurchaseTicketsCommand)
export class PurchaseTicketsHandler implements ICommandHandler<PurchaseTicketsCommand> {
  constructor(
    @Inject(TICKET_ALLOCATION_REPOSITORY) private readonly allocations: TicketAllocationRepository,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(EVENT_CATALOG) private readonly catalog: EventCatalog,
    @Inject(TICKET_CODE_HASHER) private readonly codeHasher: TicketCodeHasher,
    @Inject(TICKET_CODE_GENERATOR) private readonly codeGenerator: TicketCodeGenerator,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: PurchaseTicketsCommand): Promise<PurchaseTicketsResult> {
    const eventId = EventReference.create(command.eventId);
    const quantity = Quantity.create(command.quantity);
    const holderName = HolderName.create(command.holderName);
    const holderEmail = HolderEmail.create(command.holderEmail);

    const event = await this.catalog.findEvent(eventId);
    if (!event) {
      throw new EventNotAvailableForSaleError(eventId.value);
    }
    if (event.isCancelled()) {
      throw new SalesClosedError(eventId.value);
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const purchase = await this.unitOfWork.run(async () => {
          const now = this.clock.now();
          const allocation: TicketAllocation =
            (await this.allocations.findByEvent(eventId)) ?? TicketAllocation.open(event, now);
          const heldByHolder = await this.tickets.countActiveByEventAndHolder(eventId, holderEmail);
          const total = allocation.sell(quantity, heldByHolder, now);
          await this.allocations.save(allocation);

          const issued: { ticket: Ticket; code: TicketCode }[] = [];
          for (let i = 0; i < quantity.value; i++) {
            const code = this.codeGenerator.generate();
            const ticket = Ticket.issue(
              {
                id: TicketId.create(this.ids.generate()),
                eventId,
                holderName,
                holderEmail,
                codeHash: await this.codeHasher.hash(code),
                price: allocation.unitPrice,
              },
              now,
            );
            await this.tickets.save(ticket);
            issued.push({ ticket, code });
          }
          return { allocation, issued, total };
        });

        await this.eventPublisher.publishAll([
          ...purchase.allocation.pullDomainEvents(),
          ...purchase.issued.flatMap(({ ticket }) => ticket.pullDomainEvents()),
        ]);

        return {
          eventId: eventId.value,
          tickets: purchase.issued.map(({ ticket, code }) => ({ id: ticket.id.value, code: code.reveal() })),
          total: { amountCents: purchase.total.amountCents, currency: purchase.total.currency },
        };
      } catch (error) {
        if (!(error instanceof SalesConcurrentModificationError) || attempt >= PURCHASE_MAX_ATTEMPTS) {
          throw error;
        }
        await backoff(attempt, RETRY_JITTER_MS);
      }
    }
  }
}
