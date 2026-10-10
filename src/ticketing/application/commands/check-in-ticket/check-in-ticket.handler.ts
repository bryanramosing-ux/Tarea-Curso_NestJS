import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, Clock } from '../../../../shared/domain/ports/clock.port';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { Ticket } from '../../../domain/entities/ticket';
import {
  EventNotAvailableForSaleError,
  TicketConcurrentModificationError,
  TicketNotFoundError,
} from '../../../domain/errors/ticketing.errors';
import { EVENT_CATALOG, EventCatalog } from '../../../domain/ports/event-catalog.port';
import { TICKET_CODE_HASHER, TicketCodeHasher } from '../../../domain/ports/ticket-code-hasher.port';
import { TICKET_REPOSITORY, TicketRepository } from '../../../domain/ports/ticket.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { TicketCode } from '../../../domain/value-objects/ticket-code';
import { CheckInTicketCommand, CheckInTicketResult } from './check-in-ticket.command';

const CHECK_IN_MAX_ATTEMPTS = 2;

/**
 * RN-013 + RN-016. Consulta el evento de esta puerta en el catálogo (ACL),
 * busca la entrada por el hash de su código (el código en claro no se
 * guarda), delega en el agregado y persiste. Si dos lectores escanean la
 * misma entrada a la vez, el segundo relee y recibe TICKET_ALREADY_USED.
 */
@CommandHandler(CheckInTicketCommand)
export class CheckInTicketHandler implements ICommandHandler<CheckInTicketCommand> {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(EVENT_CATALOG) private readonly catalog: EventCatalog,
    @Inject(TICKET_CODE_HASHER) private readonly codeHasher: TicketCodeHasher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CheckInTicketCommand): Promise<CheckInTicketResult> {
    const eventId = EventReference.create(command.eventId);
    const codeHash = await this.codeHasher.hash(TicketCode.create(command.code));

    const event = await this.catalog.findEvent(eventId);
    if (!event) {
      throw new EventNotAvailableForSaleError(eventId.value);
    }

    let ticket: Ticket | null = null;
    for (let attempt = 1; ; attempt++) {
      ticket = await this.tickets.findByCodeHash(codeHash);
      if (!ticket) {
        throw new TicketNotFoundError('with that code');
      }
      ticket.checkIn(event, this.clock.now());
      try {
        await this.tickets.save(ticket);
        break;
      } catch (error) {
        if (!(error instanceof TicketConcurrentModificationError) || attempt >= CHECK_IN_MAX_ATTEMPTS) {
          throw error;
        }
      }
    }

    await this.eventPublisher.publishAll(ticket.pullDomainEvents());
    return { id: ticket.id.value };
  }
}
