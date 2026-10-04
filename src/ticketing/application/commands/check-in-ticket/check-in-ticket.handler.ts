import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketConcurrentModificationError, TicketNotFoundError } from '../../../domain/errors/ticketing.errors';
import { TICKET_CODE_HASHER, TicketCodeHasher } from '../../../domain/ports/ticket-code-hasher.port';
import { TICKET_REPOSITORY, TicketRepository } from '../../../domain/ports/ticket.repository';
import { TicketCode } from '../../../domain/value-objects/ticket-code';
import { CheckInTicketCommand, CheckInTicketResult } from './check-in-ticket.command';

const CHECK_IN_MAX_ATTEMPTS = 2;

/**
 * RN-013. Busca la entrada por el hash de su código (el código en claro no se
 * guarda), delega en el agregado y persiste. Si dos lectores escanean la misma
 * entrada a la vez, el segundo relee y recibe TICKET_ALREADY_USED.
 */
@CommandHandler(CheckInTicketCommand)
export class CheckInTicketHandler implements ICommandHandler<CheckInTicketCommand> {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(TICKET_CODE_HASHER) private readonly codeHasher: TicketCodeHasher,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CheckInTicketCommand): Promise<CheckInTicketResult> {
    const codeHash = await this.codeHasher.hash(TicketCode.create(command.code));

    let ticket: Ticket | null = null;
    for (let attempt = 1; ; attempt++) {
      ticket = await this.tickets.findByCodeHash(codeHash);
      if (!ticket) {
        throw new TicketNotFoundError('with that code');
      }
      ticket.checkIn();
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
