import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EVENT_REPOSITORY, EventRepository } from '../../src/catalog/domain/ports/event.repository';
import { EventConcurrentModificationError } from '../../src/catalog/domain/errors/event.errors';
import { EventId } from '../../src/catalog/domain/value-objects/event-id';
import { UNIT_OF_WORK, UnitOfWork } from '../../src/shared/domain/ports/unit-of-work.port';
import { TICKET_ALLOCATION_REPOSITORY, TicketAllocationRepository } from '../../src/ticketing/domain/ports/ticket-allocation.repository';
import { SalesConcurrentModificationError } from '../../src/ticketing/domain/errors/ticketing.errors';
import { EventReference } from '../../src/ticketing/domain/value-objects/event-reference';
import { Quantity } from '../../src/ticketing/domain/value-objects/quantity';
import { cancelEvent, purchase, scheduleEvent } from './support/fixtures';
import { createTestApp, eventually, resetDatabase } from './support/test-app';

/**
 * Concurrencia con el adaptador REAL (TypeORM + PostgreSQL): el escenario
 * clave de una venta de entradas es que muchas personas compren a la vez.
 */
describe('Concurrency (e2e, PostgreSQL real)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const NOW = () => new Date();

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

  it('the same holder buying in parallel never ends up with more than 10 tickets (RN-008)', async () => {
    const eventId = await scheduleEvent(app, { capacity: 100 });

    const responses = await Promise.all(Array.from({ length: 6 }, () => purchase(app, eventId, 3, 'fan@mail.com')));

    const created = responses.filter((response) => response.status === 201);
    for (const response of responses.filter((r) => r.status !== 201)) {
      expect(['TICKET_HOLDER_LIMIT_EXCEEDED', 'TICKET_SALES_CONCURRENT_MODIFICATION']).toContain(response.body.code);
    }
    const [{ held }] = await dataSource.query(
      `SELECT COUNT(*)::int AS held FROM tickets WHERE event_id = $1 AND holder_email = 'fan@mail.com'`,
      [eventId],
    );
    expect(held).toBe(created.length * 3);
    expect(held).toBeLessThanOrEqual(10);
    expect(created.length).toBeGreaterThanOrEqual(1);
  });

  it('purchases racing a cancellation: no ticket of a cancelled event stays valid, sales end CLOSED (RN-014)', async () => {
    const eventIds = await Promise.all(Array.from({ length: 8 }, () => scheduleEvent(app, { capacity: 50 })));

    // Para cada evento: primeras compras y la cancelación, todo a la vez.
    await Promise.all(
      eventIds.flatMap((eventId) => [
        ...Array.from({ length: 4 }, (_, i) => purchase(app, eventId, 2, `fan${i}@mail.com`)),
        cancelEvent(app, eventId),
      ]),
    );

    for (const eventId of eventIds) {
      const issued = await eventually(
        () =>
          dataSource.query(`SELECT COUNT(*)::int AS count FROM tickets WHERE event_id = $1 AND status = 'ISSUED'`, [eventId]),
        ([row]: { count: number }[]) => row.count === 0,
        5000,
      );
      expect(issued).toEqual([{ count: 0 }]);
      const [allocation] = await dataSource.query('SELECT status FROM ticket_allocations WHERE event_id = $1', [eventId]);
      expect(allocation).toEqual({ status: 'CLOSED' });
    }
  });

  it('the purchase is atomic: if issuing a ticket fails, the seats are not kept (real ROLLBACK)', async () => {
    const eventId = await scheduleEvent(app, { capacity: 5 });
    await purchase(app, eventId, 1).expect(201);
    const allocations = app.get<TicketAllocationRepository>(TICKET_ALLOCATION_REPOSITORY);
    const unitOfWork = app.get<UnitOfWork>(UNIT_OF_WORK);
    const reference = EventReference.create(eventId);

    await expect(
      unitOfWork.run(async () => {
        const allocation = (await allocations.findByEvent(reference))!;
        allocation.sell(Quantity.create(3), 0, NOW());
        await allocations.save(allocation);
        throw new Error('issuing the tickets failed');
      }),
    ).rejects.toThrow('issuing the tickets failed');

    const [{ sold, version }] = await dataSource.query('SELECT sold, version FROM ticket_allocations WHERE event_id = $1', [
      eventId,
    ]);
    expect({ sold, version }).toEqual({ sold: 1, version: 1 });
  });

  it('two stale copies of the allocation cannot both take the last seat', async () => {
    const eventId = await scheduleEvent(app, { capacity: 3 });
    await purchase(app, eventId, 2).expect(201);
    const allocations = app.get<TicketAllocationRepository>(TICKET_ALLOCATION_REPOSITORY);
    const reference = EventReference.create(eventId);

    const buyerA = (await allocations.findByEvent(reference))!;
    const buyerB = (await allocations.findByEvent(reference))!;
    buyerA.sell(Quantity.create(1), 0, NOW());
    buyerB.sell(Quantity.create(1), 0, NOW());
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
    first.cancel(NOW());
    await events.save(first);
    second.cancel(NOW());

    await expect(events.save(second)).rejects.toBeInstanceOf(EventConcurrentModificationError);
  });
});
