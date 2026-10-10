import { DomainErrorKind } from '../../../../shared/domain/domain-exception';
import { FixedClock } from '../../../../shared/infrastructure/time/fixed-clock';
import { CryptoIdGenerator } from '../../../../shared/infrastructure/ids/crypto-id-generator';
import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { EventSlotTakenError, EventStartInPastError, InvalidCapacityError } from '../../../domain/errors/event.errors';
import { EventScheduled } from '../../../domain/events/event-scheduled.event';
import { EventId } from '../../../domain/value-objects/event-id';
import { InMemoryEventRepository } from '../../../infrastructure/persistence/in-memory/in-memory-event.repository';
import { ScheduleEventCommand } from './schedule-event.command';
import { ScheduleEventHandler } from './schedule-event.handler';

const NOW = '2030-01-01T10:00:00.000Z';
const FUTURE = '2030-01-31T21:00:00.000Z';
const command = (overrides: Partial<ScheduleEventCommand> = {}) =>
  Object.assign(new ScheduleEventCommand('Rock en el Parque', 'Estadio Nacional', FUTURE, 500, 4500, 'PEN'), overrides);

describe('ScheduleEventHandler (sin Nest, sin base de datos)', () => {
  let events: InMemoryEventRepository;
  let publisher: InMemoryDomainEventPublisher;
  let handler: ScheduleEventHandler;

  beforeEach(() => {
    events = new InMemoryEventRepository();
    publisher = new InMemoryDomainEventPublisher();
    handler = new ScheduleEventHandler(events, publisher, new FixedClock(NOW), new CryptoIdGenerator());
  });

  it('schedules the event and returns its id', async () => {
    const { id } = await handler.execute(command());

    const stored = await events.findById(EventId.create(id));
    expect(stored?.toPrimitives()).toMatchObject({
      name: 'Rock en el Parque',
      capacity: 500,
      status: 'SCHEDULED',
      createdAt: new Date(NOW),
    });
  });

  it('takes the id from the IdGenerator port', async () => {
    const fixedId = '0b7c4b7e-5a8f-4f0e-9f7a-2d6c1e3b4a5f';
    handler = new ScheduleEventHandler(events, publisher, new FixedClock(NOW), { generate: () => fixedId });
    await expect(handler.execute(command())).resolves.toEqual({ id: fixedId });
  });

  it('publishes EventScheduled only after the event is persisted', async () => {
    const order: string[] = [];
    const save = events.save.bind(events);
    jest.spyOn(events, 'save').mockImplementation(async (event) => {
      order.push('save');
      await save(event);
    });
    jest.spyOn(publisher, 'publishAll').mockImplementation(async (published) => {
      order.push(`publish:${published.map((event) => event.eventName).join(',')}`);
    });

    await handler.execute(command());

    expect(order).toEqual(['save', 'publish:catalog.event_scheduled']);
  });

  it('emits EventScheduled with the new id', async () => {
    const { id } = await handler.execute(command());
    expect(publisher.published).toEqual([expect.any(EventScheduled)]);
    expect(publisher.published[0]).toMatchObject({ eventId: id, capacity: 500 });
  });

  it('rejects a second event in the same venue at the same time, ignoring casing (RN-006)', async () => {
    await handler.execute(command());

    const attempt = handler.execute(command({ name: 'Otro', venue: 'ESTADIO NACIONAL' }));

    await expect(attempt).rejects.toBeInstanceOf(EventSlotTakenError);
    await expect(attempt).rejects.toMatchObject({ kind: DomainErrorKind.CONFLICT });
    expect(await events.search({ limit: 10, offset: 0 })).toHaveLength(1);
  });

  it('rejects invalid data and past dates without persisting or publishing', async () => {
    await expect(handler.execute(command({ capacity: 0 }))).rejects.toBeInstanceOf(InvalidCapacityError);
    await expect(handler.execute(command({ startsAt: '2030-01-01T09:59:59Z' }))).rejects.toBeInstanceOf(
      EventStartInPastError,
    );
    expect(await events.search({ limit: 10, offset: 0 })).toHaveLength(0);
    expect(publisher.published).toHaveLength(0);
  });
});
