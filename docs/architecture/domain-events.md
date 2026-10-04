# Eventos de dominio

> Ojo con el nombre: aquí "evento de dominio" es un **hecho del negocio** (p. ej. "se
> vendieron entradas"), no un concierto. El concierto es el agregado `Event` del catálogo.

## Principios

- Nombre en **pasado**: describen algo que ya ocurrió.
- **Clases planas** en `<contexto>/domain/events/` que implementan `DomainEvent`
  (`eventName`, `occurredOn`). Sin decoradores ni dependencias de framework.
- Los **registra el agregado** (`AggregateRoot.record`) dentro de sus métodos de negocio.
- El handler los extrae (`pullDomainEvents()`) y los **publica después de `save()`**
  mediante el puerto `DomainEventPublisher`. Si la persistencia falla, no se publica nada.
- `fromPrimitives()` no registra eventos.
- Ningún evento transporta el código de una entrada ni el email del titular.

## Catálogo

| Evento | `eventName` | Contexto | Lo emite | Datos | Oyentes |
|---|---|---|---|---|---|
| `EventScheduled` | `catalog.event_scheduled` | Catálogo | `Event.schedule` | `eventId, name, startsAt, capacity` | — |
| `EventCancelled` | `catalog.event_cancelled` | Catálogo | `Event.cancel` | `eventId` | `ticketing/infrastructure/event-handlers/close-sales-on-event-cancelled.listener.ts` |
| `TicketsSold` | `ticketing.tickets_sold` | Venta | `TicketAllocation.sell` | `eventId, quantity, remaining` | — |
| `EventSoldOut` | `ticketing.event_sold_out` | Venta | `TicketAllocation.sell` (última plaza) | `eventId` | — (p. ej. avisar a marketing) |
| `SalesClosed` | `ticketing.sales_closed` | Venta | `TicketAllocation.close` | `eventId` | — |
| `TicketIssued` | `ticketing.ticket_issued` | Venta | `Ticket.issue` | `ticketId, eventId` | — (p. ej. enviar el email con la entrada) |
| `TicketCheckedIn` | `ticketing.ticket_checked_in` | Venta | `Ticket.checkIn` | `ticketId, eventId` | — |
| `TicketRefunded` | `ticketing.ticket_refunded` | Venta | `Ticket.refund` | `ticketId, eventId, amountCents, currency` | — (p. ej. devolver el dinero) |

Todos se registran en `occurredOn`.

## Publicación

```
handler: agregado.metodoDeNegocio()  →  repo.save(agregado)  →  publisher.publishAll(agregado.pullDomainEvents())
```

- Puerto: `src/shared/domain/ports/domain-event-publisher.port.ts`.
- Adaptador real: `NestDomainEventPublisher` (sobre el `EventBus` de `@nestjs/cqrs`).
- Adaptador de pruebas: `InMemoryDomainEventPublisher`.
- Evidencia del orden: espías en `schedule-event.handler.spec.ts` y
  `purchase-tickets.handler.spec.ts`, y la regla `command handlers publish domain events
  only after persisting` de `test/architecture` (analiza el cuerpo de cada `execute()`).

## Consistencia

El `EventBus` es en memoria y los oyentes se ejecutan de forma asíncrona: el cierre de
ventas y los reembolsos tras `EventCancelled` son **eventualmente consistentes**
(milisegundos). El e2e lo comprueba con un sondeo acotado (`eventually`). Un fallo del
oyente se registra en el log (solo ids y mensaje) y no revierte la cancelación; el comando
es idempotente y puede volver a ejecutarse. Mejora prevista: *transactional outbox* (TD-001).
