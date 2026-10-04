import { Event } from '../../../domain/entities/event';
import { EventNotFoundError } from '../../../domain/errors/event.errors';
import { Capacity } from '../../../domain/value-objects/capacity';
import { EventId } from '../../../domain/value-objects/event-id';
import { EventName } from '../../../domain/value-objects/event-name';
import { EventStart } from '../../../domain/value-objects/event-start';
import { TicketPrice } from '../../../domain/value-objects/ticket-price';
import { Venue } from '../../../domain/value-objects/venue';
import { InMemoryEventRepository } from '../../../infrastructure/persistence/in-memory/in-memory-event.repository';
import { GetEventHandler } from './get-event.handler';
import { GetEventQuery } from './get-event.query';

describe('GetEventHandler', () => {
  it('returns the public view of the event', async () => {
    const events = new InMemoryEventRepository();
    const event = Event.schedule(
      {
        id: EventId.generate(),
        name: EventName.create('Rock en el Parque'),
        venue: Venue.create('Estadio Nacional'),
        startsAt: EventStart.create('2027-03-20T21:00:00Z'),
        capacity: Capacity.create(500),
        price: TicketPrice.create(4500, 'PEN'),
      },
      new Date('2027-01-10T10:00:00.000Z'),
    );
    await events.save(event);

    await expect(new GetEventHandler(events).execute(new GetEventQuery(event.id.value))).resolves.toEqual({
      id: event.id.value,
      name: 'Rock en el Parque',
      venue: 'Estadio Nacional',
      startsAt: '2027-03-20T21:00:00.000Z',
      capacity: 500,
      price: { amountCents: 4500, currency: 'PEN' },
      status: 'SCHEDULED',
      createdAt: '2027-01-10T10:00:00.000Z',
      updatedAt: '2027-01-10T10:00:00.000Z',
    });
  });

  it('throws NOT_FOUND for an unknown event', async () => {
    await expect(
      new GetEventHandler(new InMemoryEventRepository()).execute(new GetEventQuery(EventId.generate().value)),
    ).rejects.toBeInstanceOf(EventNotFoundError);
  });
});
