import { randomUUID } from 'node:crypto';
import { FixedClock } from '../../../../shared/infrastructure/time/fixed-clock';
import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { Event } from '../../../domain/entities/event';
import { EventAlreadyCancelledError, EventAlreadyStartedError, EventNotFoundError, InvalidEventIdError } from '../../../domain/errors/event.errors';
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
  let clock: FixedClock;

  beforeEach(async () => {
    events = new InMemoryEventRepository();
    publisher = new InMemoryDomainEventPublisher();
    clock = new FixedClock('2030-01-01T10:00:00Z');
    handler = new CancelEventHandler(events, publisher, clock);
    event = Event.schedule(
      {
        id: EventId.create(randomUUID()),
        name: EventName.create('Rock en el Parque'),
        venue: Venue.create('Estadio Nacional'),
        startsAt: EventStart.create('2030-01-02T21:00:00Z'),
        capacity: Capacity.create(10),
        price: TicketPrice.create(0, 'USD'),
      },
      clock.now(),
    );
    event.pullDomainEvents();
    await events.save(event);
  });

  it('cancels the event, persists it and publishes EventCancelled', async () => {
    await handler.execute(new CancelEventCommand(event.id.value));

    expect((await events.findById(event.id))?.isCancelled()).toBe(true);
    expect(publisher.published).toEqual([expect.any(EventCancelled)]);
    expect(publisher.published[0]).toMatchObject({ eventId: event.id.value, occurredOn: clock.now() });
  });

  it('uses the clock port: an event that already started cannot be cancelled (RN-007)', async () => {
    clock.set('2030-01-02T21:00:00Z');
    await expect(handler.execute(new CancelEventCommand(event.id.value))).rejects.toBeInstanceOf(EventAlreadyStartedError);
    expect(publisher.published).toHaveLength(0);
  });

  it('fails with NOT_FOUND / VALIDATION for unknown or malformed ids', async () => {
    await expect(handler.execute(new CancelEventCommand(EventId.create(randomUUID()).value))).rejects.toBeInstanceOf(
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
