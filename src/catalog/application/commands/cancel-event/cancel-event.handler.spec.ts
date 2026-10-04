import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { Event } from '../../../domain/entities/event';
import { EventAlreadyCancelledError, EventNotFoundError, InvalidEventIdError } from '../../../domain/errors/event.errors';
import { EventCancelled } from '../../../domain/events/event-cancelled.event';
import { Capacity } from '../../../domain/value-objects/capacity';
import { EventId } from '../../../domain/value-objects/event-id';
import { EventName } from '../../../domain/value-objects/event-name';
import { EventStart } from '../../../domain/value-objects/event-start';
import { TicketPrice } from '../../../domain/value-objects/ticket-price';
import { Venue } from '../../../domain/value-objects/venue';
import { InMemoryEventRepository } from '../../../infrastructure/persistence/in-memory/in-memory-event.repository';
import { CancelEventCommand } from './cancel-event.command';
import { CancelEventHandler } from './cancel-event.handler';

describe('CancelEventHandler', () => {
  let events: InMemoryEventRepository;
  let publisher: InMemoryDomainEventPublisher;
  let handler: CancelEventHandler;
  let event: Event;

  beforeEach(async () => {
    events = new InMemoryEventRepository();
    publisher = new InMemoryDomainEventPublisher();
    handler = new CancelEventHandler(events, publisher);
    event = Event.schedule({
      id: EventId.generate(),
      name: EventName.create('Rock en el Parque'),
      venue: Venue.create('Estadio Nacional'),
      startsAt: EventStart.create(new Date(Date.now() + 864e5)),
      capacity: Capacity.create(10),
      price: TicketPrice.create(0, 'USD'),
    });
    event.pullDomainEvents();
    await events.save(event);
  });

  it('cancels the event, persists it and publishes EventCancelled', async () => {
    await handler.execute(new CancelEventCommand(event.id.value));

    expect((await events.findById(event.id))?.isCancelled()).toBe(true);
    expect(publisher.published).toEqual([expect.any(EventCancelled)]);
    expect(publisher.published[0]).toMatchObject({ eventId: event.id.value });
  });

  it('fails with NOT_FOUND / VALIDATION for unknown or malformed ids', async () => {
    await expect(handler.execute(new CancelEventCommand(EventId.generate().value))).rejects.toBeInstanceOf(
      EventNotFoundError,
    );
    await expect(handler.execute(new CancelEventCommand('nope'))).rejects.toBeInstanceOf(InvalidEventIdError);
  });

  it('fails with CONFLICT the second time and publishes nothing new (RN-007)', async () => {
    await handler.execute(new CancelEventCommand(event.id.value));
    await expect(handler.execute(new CancelEventCommand(event.id.value))).rejects.toBeInstanceOf(
      EventAlreadyCancelledError,
    );
    expect(publisher.published).toHaveLength(1);
  });
});
