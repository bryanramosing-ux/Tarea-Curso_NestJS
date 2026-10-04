import { QueryBus } from '@nestjs/cqrs';
import { GetEventQuery } from '../../../catalog/application/queries/get-event/get-event.query';
import { EventNotFoundError } from '../../../catalog/domain/errors/event.errors';
import { EventReference } from '../../domain/value-objects/event-reference';
import { CatalogEventCatalog } from './catalog-event-catalog.adapter';

const ID = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const VIEW = {
  id: ID.value,
  name: 'Rock en el Parque',
  venue: 'Estadio Nacional',
  startsAt: '2027-03-20T21:00:00.000Z',
  capacity: 500,
  price: { amountCents: 4500, currency: 'PEN' },
  status: 'SCHEDULED',
};

function catalogAnswering(answer: () => Promise<unknown>): { catalog: CatalogEventCatalog; execute: jest.Mock } {
  const execute = jest.fn(answer);
  return { catalog: new CatalogEventCatalog({ execute } as unknown as QueryBus), execute };
}

describe('CatalogEventCatalog (ACL Venta -> Catálogo)', () => {
  it('asks the catalog through GetEventQuery and translates the view', async () => {
    const { catalog, execute } = catalogAnswering(async () => VIEW);

    const event = await catalog.findEvent(ID);

    expect(execute).toHaveBeenCalledWith(new GetEventQuery(ID.value));
    expect(event?.capacity).toBe(500);
    expect(event?.startsAt.toISOString()).toBe(VIEW.startsAt);
    expect(event?.unitPrice).toMatchObject({ amountCents: 4500, currency: 'PEN' });
    expect(event?.isOnSale()).toBe(true);
  });

  it('a cancelled event is not on sale', async () => {
    const { catalog } = catalogAnswering(async () => ({ ...VIEW, status: 'CANCELLED' }));
    expect((await catalog.findEvent(ID))?.isOnSale()).toBe(false);
  });

  it('returns null when the event does not exist', async () => {
    const { catalog } = catalogAnswering(async () => {
      throw new EventNotFoundError(ID.value);
    });
    await expect(catalog.findEvent(ID)).resolves.toBeNull();
  });

  it('propagates unexpected failures', async () => {
    const { catalog } = catalogAnswering(async () => {
      throw new Error('connection lost');
    });
    await expect(catalog.findEvent(ID)).rejects.toThrow('connection lost');
  });
});
