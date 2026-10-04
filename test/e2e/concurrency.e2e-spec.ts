import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EVENT_REPOSITORY, EventRepository } from '../../src/catalog/domain/ports/event.repository';
import { EventConcurrentModificationError } from '../../src/catalog/domain/errors/event.errors';
import { EventId } from '../../src/catalog/domain/value-objects/event-id';
import { TICKET_ALLOCATION_REPOSITORY, TicketAllocationRepository } from '../../src/ticketing/domain/ports/ticket-allocation.repository';
import { SalesConcurrentModificationError } from '../../src/ticketing/domain/errors/ticketing.errors';
import { EventReference } from '../../src/ticketing/domain/value-objects/event-reference';
import { Quantity } from '../../src/ticketing/domain/value-objects/quantity';
import { purchase, scheduleEvent } from './support/fixtures';
import { createTestApp, resetDatabase } from './support/test-app';

/**
 * Concurrencia con el adaptador REAL (TypeORM + PostgreSQL): el escenario
 * clave de una venta de entradas es que muchas personas compren a la vez.
 */
describe('Concurrency (e2e, PostgreSQL real)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('30 simultaneous buyers for 5 seats: exactly 5 tickets are sold, never more (RN-009)', async () => {
    const eventId = await scheduleEvent(app, { capacity: 5 });

    const responses = await Promise.all(
      Array.from({ length: 30 }, (_, i) => purchase(app, eventId, 1, `fan${i}@mail.com`)),
    );

    const created = responses.filter((response) => response.status === 201);
    const rejected = responses.filter((response) => response.status === 409);
    expect(created).toHaveLength(5);
    expect(rejected).toHaveLength(25);
    for (const response of rejected) {
      expect(['TICKET_NOT_ENOUGH_AVAILABLE', 'TICKET_SALES_CONCURRENT_MODIFICATION']).toContain(response.body.code);
    }
    const [{ tickets }] = await dataSource.query('SELECT COUNT(*)::int AS tickets FROM tickets WHERE event_id = $1', [eventId]);
    const [{ sold }] = await dataSource.query('SELECT sold FROM ticket_allocations WHERE event_id = $1', [eventId]);
    expect({ tickets, sold }).toEqual({ tickets: 5, sold: 5 });
  });

  it('two stale copies of the allocation cannot both take the last seat', async () => {
    const eventId = await scheduleEvent(app, { capacity: 3 });
    await purchase(app, eventId, 2).expect(201);
    const allocations = app.get<TicketAllocationRepository>(TICKET_ALLOCATION_REPOSITORY);
    const reference = EventReference.create(eventId);

    const buyerA = (await allocations.findByEvent(reference))!;
    const buyerB = (await allocations.findByEvent(reference))!;
    buyerA.sell(Quantity.create(1));
    buyerB.sell(Quantity.create(1));
    await allocations.save(buyerA);

    await expect(allocations.save(buyerB)).rejects.toBeInstanceOf(SalesConcurrentModificationError);
    const [{ sold, version }] = await dataSource.query(
      'SELECT sold, version FROM ticket_allocations WHERE event_id = $1',
      [eventId],
    );
    expect({ sold, version }).toEqual({ sold: 3, version: 2 });
  });

  it('an event cannot be cancelled twice through stale copies', async () => {
    const id = EventId.create(await scheduleEvent(app));
    const events = app.get<EventRepository>(EVENT_REPOSITORY);
    const first = (await events.findById(id))!;
    const second = (await events.findById(id))!;
    first.cancel();
    await events.save(first);
    second.cancel();

    await expect(events.save(second)).rejects.toBeInstanceOf(EventConcurrentModificationError);
  });
});
