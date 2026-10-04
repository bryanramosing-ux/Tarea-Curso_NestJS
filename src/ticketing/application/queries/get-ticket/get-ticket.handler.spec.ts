import { Ticket } from '../../../domain/entities/ticket';
import { TicketNotFoundError } from '../../../domain/errors/ticketing.errors';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { HolderEmail } from '../../../domain/value-objects/holder-email';
import { HolderName } from '../../../domain/value-objects/holder-name';
import { Money } from '../../../domain/value-objects/money';
import { TicketCodeHash } from '../../../domain/value-objects/ticket-code-hash';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { InMemoryTicketRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket.repository';
import { GetTicketHandler } from './get-ticket.handler';
import { GetTicketQuery } from './get-ticket.query';

describe('GetTicketHandler', () => {
  it('returns the ticket view WITHOUT the code or its hash', async () => {
    const tickets = new InMemoryTicketRepository();
    const ticket = Ticket.issue(
      {
        id: TicketId.generate(),
        eventId: EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7'),
        holderName: HolderName.create('Ana Pérez'),
        holderEmail: HolderEmail.create('ana@mail.com'),
        codeHash: TicketCodeHash.create('b'.repeat(64)),
        price: Money.create(4500, 'PEN'),
      },
      new Date('2027-01-10T10:00:00.000Z'),
    );
    await tickets.save(ticket);

    const view = await new GetTicketHandler(tickets).execute(new GetTicketQuery(ticket.id.value));

    expect(view).toEqual({
      id: ticket.id.value,
      eventId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      holderName: 'Ana Pérez',
      holderEmail: 'ana@mail.com',
      status: 'ISSUED',
      price: { amountCents: 4500, currency: 'PEN' },
      purchasedAt: '2027-01-10T10:00:00.000Z',
      usedAt: null,
    });
    expect(JSON.stringify(view)).not.toMatch(/code|hash|bbbb/i);
  });

  it('throws NOT_FOUND for an unknown ticket', async () => {
    await expect(
      new GetTicketHandler(new InMemoryTicketRepository()).execute(new GetTicketQuery(TicketId.generate().value)),
    ).rejects.toBeInstanceOf(TicketNotFoundError);
  });
});
