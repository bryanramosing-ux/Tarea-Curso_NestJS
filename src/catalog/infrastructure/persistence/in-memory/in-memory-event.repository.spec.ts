import { Event } from '../../../domain/entities/event';
import { EventConcurrentModificationError, EventSlotTakenError } from '../../../domain/errors/event.errors';
import { Capacity } from '../../../domain/value-objects/capacity';
import { EventId } from '../../../domain/value-objects/event-id';
import { EventName } from '../../../domain/value-objects/event-name';
import { EventStart } from '../../../domain/value-objects/event-start';
import { TicketPrice } from '../../../domain/value-objects/ticket-price';
import { Venue } from '../../../domain/value-objects/venue';
import { InMemoryEventRepository } from './in-memory-event.repository';

const START = new Date(Date.now() + 864e5);
const newEvent = (venue = 'Estadio Nacional') =>
  Event.schedule({
    id: EventId.generate(),
    name: EventName.create('Rock en el Parque'),
    venue: Venue.create(venue),
    startsAt: EventStart.create(START),
    capacity: Capacity.create(10),
    price: TicketPrice.create(0, 'USD'),
  });

describe('InMemoryEventRepository (contrato del puerto EventRepository)', () => {
  it('returns null instead of throwing when nothing is found', async () => {
    const repository = new InMemoryEventRepository();
    await expect(repository.findById(EventId.generate())).resolves.toBeNull();
    await expect(
      repository.findByVenueAndStart(Venue.create('Nada'), EventStart.create(START)),
    ).resolves.toBeNull();
  });

  it('emulates the unique index on venue + start (case-insensitive)', async () => {
    const repository = new InMemoryEventRepository();
    await repository.save(newEvent('Estadio Nacional'));
    await expect(repository.save(newEvent('estadio nacional'))).rejects.toBeInstanceOf(EventSlotTakenError);
  });

  it('rejects a stale copy instead of overwriting a concurrent change (bloqueo optimista)', async () => {
    const repository = new InMemoryEventRepository();
    const event = newEvent();
    await repository.save(event);

    const first = (await repository.findById(event.id))!;
    const second = (await repository.findById(event.id))!;
    first.cancel();
    await repository.save(first);
    second.cancel();

    await expect(repository.save(second)).rejects.toBeInstanceOf(EventConcurrentModificationError);
  });
});
