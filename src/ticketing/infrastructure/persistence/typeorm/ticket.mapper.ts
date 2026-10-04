import { Ticket } from '../../../domain/entities/ticket';
import { TicketOrmEntity } from './ticket.orm-entity';

/** Traduce entre el agregado Ticket y su modelo de persistencia. */
export class TicketMapper {
  static toDomain(row: TicketOrmEntity): Ticket {
    return Ticket.fromPrimitives({
      id: row.id,
      eventId: row.eventId,
      holderName: row.holderName,
      holderEmail: row.holderEmail,
      codeHash: row.codeHash,
      priceCents: row.priceCents,
      currency: row.currency,
      status: row.status,
      purchasedAt: row.purchasedAt,
      usedAt: row.usedAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }

  static toPersistence(ticket: Ticket): TicketOrmEntity {
    const primitives = ticket.toPrimitives();
    const row = new TicketOrmEntity();
    row.id = primitives.id;
    row.eventId = primitives.eventId;
    row.holderName = primitives.holderName;
    row.holderEmail = primitives.holderEmail;
    row.codeHash = primitives.codeHash;
    row.priceCents = primitives.priceCents;
    row.currency = primitives.currency;
    row.status = primitives.status;
    row.purchasedAt = primitives.purchasedAt;
    row.usedAt = primitives.usedAt;
    row.updatedAt = primitives.updatedAt;
    row.version = primitives.version;
    return row;
  }
}
