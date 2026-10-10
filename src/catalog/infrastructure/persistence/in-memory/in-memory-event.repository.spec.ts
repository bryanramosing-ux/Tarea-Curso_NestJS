import { randomUUID } from 'node:crypto';
import { Event } from '../../../domain/entities/event';
import { EventConcurrentModificationError, EventSlotTakenError } from '../../../domain/errors/event.errors';
import { Capacity } from '../../../domain/value-objects/capacity';
import { EventId } from '../../../domain/value-objects/event-id';
import { EventName } from '../../../domain/value-objects/event-name';
import { EventStart } from '../../../domain/value-objects/event-start';
import { TicketPrice } from '../../../domain/value-objects/ticket-price';
import { Venue } from '../../../domain/value-objects/venue';
import { InMemoryEventRepository } from './in-memory-event.repository';

const NOW = new Date('2030-01-01T10:00:00Z');
const START = new Date('2030-01-02T21:00:00Z');
const newEvent = (venue = 'Estadio Nacional', startsAt = START) =>
  Event.schedule(
    {
      id: EventId.create(randomUUID()),
      name: EventName.create('Rock en el Parque'),
      venue: Venue.create(venue),
      startsAt: EventStart.create(startsAt),
      capacity: Capacity.create(10),
      price: TicketPrice.create(0, 'USD'),
    },
    NOW,
  );

describe('InMemoryEventRepository (contrato del puerto EventRepository)', () => {
  it('returns null instead of throwing when nothing is found', async () => {
    const repository = new InMemoryEventRepository();
    await expect(repository.findById(EventId.create(randomUUID()))).resolves.toBeNull();
    await expect(
      repository.findByVenueAndStart(Venue.create('Nada'), EventStart.create(START)),
    ).resolves.toBeNull();
  });

  it('emulates the unique index on venue + start (case-insensitive)', async () => {
    const repository = new InMemoryEventRepository();
    await repository.save(newEvent('Estadio Nacional'));
    await expect(repository.save(newEvent('estadio nacional'))).rejects.toBeInstanceOf(EventSlotTakenError);
  });

  it('treats composed and decomposed accents as the same venue (Unicode NFC)', async () => {
    const repository = new InMemoryEventRepository();
    await repository.save(newEvent('Caf\u00e9 Teatro'));
    await expect(repository.save(newEvent('Cafe\u0301 Teatro'))).rejects.toBeInstanceOf(EventSlotTakenError);
  });

  it('paginates search results with limit and offset, ordered by start', async () => {
    const repository = new InMemoryEventRepository();
    const later = newEvent('Sala B', new Date('2030-02-01T21:00:00Z'));
    const sooner = newEvent('Sala A', new Date('2030-01-15T21:00:00Z'));
    await repository.save(later);
    await repository.save(sooner);

    expect((await repository.search({ limit: 1, offset: 0 })).map((event) => event.id.value)).toEqual([sooner.id.value]);
    expect((await repository.search({ limit: 1, offset: 1 })).map((event) => event.id.value)).toEqual([later.id.value]);
    expect(await repository.search({ limit: 1, offset: 2 })).toEqual([]);
  });

  it('rejects a stale copy instead of overwriting a concurrent change (bloqueo optimista)', async () => {
    const repository = new InMemoryEventRepository();
    const event = newEvent();
    await repository.save(event);

    const first = (await repository.findById(event.id))!;
    const second = (await repository.findById(event.id))!;
    first.cancel(NOW);
    await repository.save(first);
    second.cancel(NOW);

    await expect(repository.save(second)).rejects.toBeInstanceOf(EventConcurrentModificationError);
  });
});
