import { CommandBus } from '@nestjs/cqrs';
import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { FixedClock } from '../../../../shared/infrastructure/time/fixed-clock';
import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { Money } from '../../../domain/value-objects/money';
import { SaleableEvent } from '../../../domain/value-objects/saleable-event';
import { InMemoryEventCatalog } from '../../../infrastructure/adapters/in-memory-event-catalog';
import { InMemoryTicketAllocationRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket-allocation.repository';
import { InMemoryTicketRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket.repository';
import { CloseEventSalesCommand } from '../close-event-sales/close-event-sales.command';
import { CloseEventSalesHandler } from '../close-event-sales/close-event-sales.handler';
import { ReconcileSalesCommand } from './reconcile-sales.command';
import { RECONCILE_BATCH_SIZE, ReconcileSalesHandler } from './reconcile-sales.handler';

const NOW = new Date('2030-01-01T10:00:00.000Z');
const saleable = (id: EventReference, onSale: boolean) =>
  SaleableEvent.create({ id, capacity: 10, startsAt: new Date('2030-01-02T21:00:00Z'), unitPrice: Money.create(0, 'USD'), onSale });

describe('ReconcileSalesHandler (RN-014, recuperación)', () => {
  let allocations: InMemoryTicketAllocationRepository;
  let catalog: InMemoryEventCatalog;
  let handler: ReconcileSalesHandler;
  let dispatched: CloseEventSalesCommand[];

  beforeEach(() => {
    allocations = new InMemoryTicketAllocationRepository();
    catalog = new InMemoryEventCatalog();
    const closeSales = new CloseEventSalesHandler(
      allocations,
      new InMemoryTicketRepository(),
      catalog,
      new FixedClock(NOW),
      new InMemoryDomainEventPublisher(),
    );
    dispatched = [];
    // CommandBus mínimo: delega en el caso de uso real CloseEventSales.
    const commandBus = {
      execute: async (command: CloseEventSalesCommand) => {
        dispatched.push(command);
        return closeSales.execute(command);
      },
    } as unknown as CommandBus;
    handler = new ReconcileSalesHandler(allocations, catalog, commandBus);
  });

  const openSales = async (id: string, cancelledInCatalog: boolean) => {
    const reference = EventReference.create(id);
    await allocations.save(TicketAllocation.open(saleable(reference, true), NOW));
    catalog.add(saleable(reference, !cancelledInCatalog));
    return reference;
  };

  it('closes the open sales of events the catalog already cancelled, and only those', async () => {
    const cancelled = await openSales('11111111-1111-4111-8111-111111111111', true);
    const scheduled = await openSales('22222222-2222-4222-8222-222222222222', false);

    const result = await handler.execute(new ReconcileSalesCommand());

    expect(result).toEqual({ closedEventIds: [cancelled.value] });
    expect((await allocations.findByEvent(cancelled))?.status.value).toBe('CLOSED');
    expect((await allocations.findByEvent(scheduled))?.status.value).toBe('OPEN');
  });

  it('is idempotent: a second run finds nothing to do', async () => {
    await openSales('11111111-1111-4111-8111-111111111111', true);
    await handler.execute(new ReconcileSalesCommand());
    await expect(handler.execute(new ReconcileSalesCommand())).resolves.toEqual({ closedEventIds: [] });
  });

  it(`walks every open allocation in batches of ${RECONCILE_BATCH_SIZE}`, async () => {
    for (let i = 0; i < RECONCILE_BATCH_SIZE + 5; i++) {
      await openSales(`${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`, i % 2 === 0);
    }
    const result = await handler.execute(new ReconcileSalesCommand());
    expect(result.closedEventIds).toHaveLength(Math.ceil((RECONCILE_BATCH_SIZE + 5) / 2));
    expect(dispatched).toHaveLength(result.closedEventIds.length);
  });
});
