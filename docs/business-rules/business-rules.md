# Reglas de negocio

Cada regla tiene un **ID estable** (no se renumera; si una regla se elimina, su ID queda
retirado). Las clases de error y los comentarios del código citan el ID (`/** RN-00X */`),
de modo que `grep -rn "RN-009" src` lleva a su implementación. Rutas relativas a `src/`.

## Contexto Catálogo

### RN-001 — Nombre del evento
Entre 3 y 120 caracteres tras recortar y colapsar espacios.
- **Implementación**: `catalog/domain/value-objects/event-name.ts`.
- **Error**: `EVENT_INVALID_NAME` (VALIDATION → 400).
- **Pruebas**: `catalog-values.spec.ts`; e2e `400: the domain rejects a too short name (RN-001)`.

### RN-002 — Recinto
Entre 2 y 120 caracteres normalizados. Se muestra como se escribió, pero dos recintos que
solo difieren en mayúsculas son el mismo (`Venue.key` = minúsculas).
- **Implementación**: `catalog/domain/value-objects/venue.ts`.
- **Error**: `EVENT_INVALID_VENUE` (VALIDATION → 400).
- **Pruebas**: `catalog-values.spec.ts`.

### RN-003 — Solo a futuro, con zona horaria
Un evento solo se programa si empieza después de "ahora". La fecha debe ser ISO 8601 con
zona explícita (`Z` o `±HH:MM`), para que no dependa de la hora local del servidor.
- **Implementación**: `Event.schedule` (`catalog/domain/entities/event.ts`) y `EventStart`.
- **Errores**: `EVENT_START_IN_PAST`, `EVENT_INVALID_START` (VALIDATION → 400).
- **Pruebas**: `event.spec.ts`, `catalog-values.spec.ts`, `schedule-event.handler.spec.ts`; e2e.

### RN-004 — Aforo
Entero entre 1 y 100.000.
- **Implementación**: `catalog/domain/value-objects/capacity.ts`; `ck_events_capacity`.
- **Error**: `EVENT_INVALID_CAPACITY` (VALIDATION → 400).

### RN-005 — Precio
Entero de **céntimos** entre 0 (gratis) y 10.000.000, en PEN, USD o EUR. Se usan enteros
porque en coma flotante 0,1 + 0,2 ≠ 0,3.
- **Implementación**: `catalog/domain/value-objects/ticket-price.ts`; `ck_events_price`, `ck_events_currency`.
- **Error**: `EVENT_INVALID_PRICE` (VALIDATION → 400).

### RN-006 — Un recinto, una hora
No pueden programarse dos eventos en el mismo recinto a la misma hora (sin distinguir mayúsculas).
- **Implementación**: `ScheduleEventHandler` (consulta `findByVenueAndStart`) + índice único
  `uq_events_venue_starts_at` sobre `(lower(venue), starts_at)` + traducción de la violación
  `23505` en `TypeOrmEventRepository`.
- **Error**: `EVENT_SLOT_TAKEN` (CONFLICT → 409).
- **Pruebas**: `schedule-event.handler.spec.ts`, `in-memory-event.repository.spec.ts`; e2e
  `409: the same venue cannot host two events…` y `409: simultaneous bookings of the same slot…`.

### RN-007 — Cancelación
Solo se cancela un evento `SCHEDULED` que aún no ha empezado. Emite `EventCancelled`.
- **Implementación**: `Event.cancel`.
- **Errores**: `EVENT_ALREADY_CANCELLED`, `EVENT_ALREADY_STARTED` (CONFLICT → 409).
- **Pruebas**: `event.spec.ts`, `cancel-event.handler.spec.ts`; e2e `204 then 409 when cancelling twice`.

## Contexto Venta de entradas

### RN-008 — Entradas por compra
Entre 1 y 10 entradas por operación (evita el acaparamiento).
- **Implementación**: `ticketing/domain/value-objects/quantity.ts`.
- **Error**: `TICKET_INVALID_QUANTITY` (VALIDATION → 400).

### RN-009 — Nunca se sobrevende ⭐
El número de entradas vendidas nunca supera el aforo, **ni siquiera con muchas compras simultáneas**.
- **Implementación** (tres capas):
  1. `TicketAllocation.sell` rechaza vender más de lo disponible (dominio).
  2. Bloqueo optimista del cupo (`version`): dos compras que leyeron el mismo cupo no pueden
     guardar ambas; la segunda relee y reintenta con espera aleatoria (`PurchaseTicketsHandler`).
  3. `CHECK sold <= capacity` (`ck_ticket_allocations_sold`) en la base, como última barrera.
- **Error**: `TICKET_NOT_ENOUGH_AVAILABLE` (CONFLICT → 409).
- **Pruebas**: `ticket-allocation.spec.ts`, `purchase-tickets.handler.spec.ts`,
  `in-memory-ticketing.repositories.spec.ts`; e2e `30 simultaneous buyers for 5 seats…`
  (sin el bloqueo optimista esa prueba vende 16 entradas: comprobado).

### RN-010 — Cuándo no se vende
No se vende si la venta está cerrada (evento cancelado) o si el evento ya empezó.
- **Implementación**: `TicketAllocation.open` / `sell`.
- **Errores**: `TICKET_SALES_CLOSED`, `TICKET_EVENT_ALREADY_STARTED` (CONFLICT → 409).

### RN-011 — Titular
Nombre de 2–80 caracteres y email válido, normalizado en minúsculas.
- **Implementación**: `holder-name.ts`, `holder-email.ts`.
- **Errores**: `TICKET_INVALID_HOLDER_NAME`, `TICKET_INVALID_HOLDER_EMAIL` (VALIDATION → 400).

### RN-012 — Código secreto de la entrada
Cada entrada tiene un código aleatorio `XXXX-XXXX-XXXX` (sin caracteres ambiguos, ~59 bits),
que se entrega **una sola vez** al comprador. Solo se guarda su **HMAC-SHA256** con un secreto
del servidor (`TICKET_CODE_SECRET`); ninguna respuesta, log ni evento lo contiene.
- **Implementación**: `ticket-code.ts` (`[REDACTED]` al serializar), `ticket-code-hash.ts`,
  puerto `ticket-code-hasher.port.ts`, adaptador `security/hmac-ticket-code-hasher.ts`,
  vista `ticket.view.ts`, `uq_tickets_code_hash`.
- **Error**: `TICKET_INVALID_CODE` (VALIDATION → 400).
- **Pruebas**: `ticketing-values.spec.ts`, `hmac-ticket-code-hasher.spec.ts`,
  `get-ticket.handler.spec.ts`; e2e `never stores or returns the code again…`.

### RN-013 — Uso único
Una entrada `ISSUED` pasa a `USED` en la puerta; no puede usarse dos veces y una entrada
`REFUNDED` no es válida. Si dos lectores escanean a la vez, el segundo recibe `TICKET_ALREADY_USED`.
- **Implementación**: `Ticket.checkIn`, `CheckInTicketHandler`; `ck_tickets_used_at`.
- **Errores**: `TICKET_ALREADY_USED`, `TICKET_REFUNDED` (CONFLICT → 409).

### RN-014 — Cancelación de un evento
Al cancelarse un evento, se cierra su venta y se reembolsan las entradas no usadas (las usadas se conservan).
- **Implementación**: evento `catalog/domain/events/event-cancelled.event.ts` → oyente
  `ticketing/infrastructure/event-handlers/close-sales-on-event-cancelled.listener.ts` →
  `CloseEventSalesHandler` → `TicketAllocation.close` + `Ticket.refund`. Una compra que
  coincide con la cancelación relee el cupo y reembolsa sus propias entradas
  (`PurchaseTicketsHandler.compensateIfSalesClosedMeanwhile`).
- **Eventos resultantes**: `SalesClosed`, `TicketRefunded`.
- **Pruebas**: `close-event-sales.handler.spec.ts`, `purchase-tickets.handler.spec.ts`
  (*racing an event cancellation*); e2e *cross-context event*.

### RN-015 — Importe
Total = precio unitario × cantidad, en céntimos enteros. Cada entrada guarda el precio que
se pagó (si el catálogo cambiara, las entradas vendidas no cambian).
- **Implementación**: `Money.times`, `TicketAllocation.sell`, `Ticket.price`.
- **Pruebas**: `ticketing-values.spec.ts`, `purchase-tickets.handler.spec.ts`; e2e `201: issues the tickets…`.
