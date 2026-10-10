import { randomUUID } from 'node:crypto';
import { Event } from '../../../domain/entities/event';
import { InvalidEventStatusError } from '../../../domain/errors/event.errors';
import { Capacity } from '../../../domain/value-objects/capacity';
import { EventId } from '../../../domain/value-objects/event-id';
import { EventName } from '../../../domain/value-objects/event-name';
import { EventStart } from '../../../domain/value-objects/event-start';
import { TicketPrice } from '../../../domain/value-objects/ticket-price';
import { Venue } from '../../../domain/value-objects/venue';
import { InMemoryEventRepository } from '../../../infrastructure/persistence/in-memory/in-memory-event.repository';
import { ListEventsHandler } from './list-events.handler';
import { ListEventsQuery } from './list-events.query';

const NOW = new Date('2027-01-01T00:00:00Z');
const newEvent = (name: string, startsAt: string) =>
  Event.schedule(
    {
      id: EventId.create(randomUUID()),
      name: EventName.create(name),
      venue: Venue.create(`Sala ${name}`),
      startsAt: EventStart.create(startsAt),
      capacity: Capacity.create(10),
      price: TicketPrice.create(0, 'USD'),
    },
    NOW,
  );

describe('ListEventsHandler', () => {
  let handler: ListEventsHandler;

  beforeEach(async () => {
    const events = new InMemoryEventRepository();
    handler = new ListEventsHandler(events);
    const late = newEvent('Tarde', '2027-05-01T20:00:00Z');
    const early = newEvent('Temprano', '2027-02-01T20:00:00Z');
    const cancelled = newEvent('Cancelado', '2027-03-01T20:00:00Z');
    cancelled.cancel(NOW);
    for (const event of [late, early, cancelled]) {
      await events.save(event);
    }
  });

  it('lists the program ordered by start date, as a page', async () => {
    const page = await handler.execute(new ListEventsQuery());
    expect(page.items.map((event) => event.name)).toEqual(['Temprano', 'Cancelado', 'Tarde']);
    expect(page).toMatchObject({ limit: 20, offset: 0, nextOffset: null });
  });

  it('paginates with limit / offset and reports the next offset', async () => {
    const first = await handler.execute(new ListEventsQuery(undefined, 2, 0));
    expect(first.items.map((event) => event.name)).toEqual(['Temprano', 'Cancelado']);
    expect(first.nextOffset).toBe(2);

    const second = await handler.execute(new ListEventsQuery(undefined, 2, 2));
    expect(second.items.map((event) => event.name)).toEqual(['Tarde']);
    expect(second.nextOffset).toBeNull();
  });

  it('never returns more than the maximum page size', async () => {
    expect((await handler.execute(new ListEventsQuery(undefined, 10_000, 0))).limit).toBe(100);
  });

  it('filters by status', async () => {
    expect((await handler.execute(new ListEventsQuery('cancelled'))).items.map((event) => event.name)).toEqual(['Cancelado']);
  });

  it('rejects an unknown status', async () => {
    await expect(handler.execute(new ListEventsQuery('POSTPONED'))).rejects.toBeInstanceOf(InvalidEventStatusError);
  });
});
