# Reglas de negocio

Cada regla tiene un **ID estable** (no se renumera; si una regla se elimina, su ID queda
retirado) y un **estado**. Las clases de error y los comentarios del código citan el ID
(`/** RN-00X */`), de modo que `grep -rn "RN-009" src` lleva a su implementación. Rutas
relativas a `src/`.

Estados: ✅ **implementada y probada** (unitarias + e2e). Todas las reglas de este
documento están en ese estado; las limitaciones conocidas se indican en cada regla y en
[`../technical-debt.md`](../technical-debt.md).

La hora "actual" de todas las reglas que dependen del tiempo (RN-003, RN-007, RN-010,
RN-016) la da el puerto `Clock` (`shared/domain/ports/clock.port.ts`): el dominio nunca
llama a `new Date()` por su cuenta y las pruebas usan un reloj fijo (`FixedClock`).

## Contexto Catálogo

### RN-001 — Nombre del evento ✅
Entre 3 y 120 caracteres tras normalizar a Unicode **NFC**, recortar y colapsar espacios.
- **Implementación**: `catalog/domain/value-objects/event-name.ts`.
- **Error**: `EVENT_INVALID_NAME` (VALIDATION → 400).
- **Pruebas**: `catalog-values.spec.ts`; e2e `400: the domain rejects a too short name (RN-001)`.

### RN-002 — Recinto ✅
Entre 2 y 120 caracteres normalizados (NFC, espacios colapsados). Se muestra como se
escribió, pero dos recintos que solo difieren en mayúsculas, o en cómo está codificada una
tilde ("é" como un carácter o como "e" + tilde combinada), son el mismo.
- **Implementación**: `catalog/domain/value-objects/venue.ts`; la búsqueda en base de datos
  usa `LOWER()` en SQL, la misma función que el índice único de RN-006.
- **Error**: `EVENT_INVALID_VENUE` (VALIDATION → 400).
- **Pruebas**: `catalog-values.spec.ts` (*Unicode normalization*), `in-memory-event.repository.spec.ts`;
  e2e `409: the same venue written with a decomposed accent…`.

### RN-003 — Solo a futuro, con zona horaria ✅
Un evento solo se programa si empieza después de "ahora". La fecha debe ser ISO 8601 con
zona explícita (`Z` o `±HH:MM`), para que no dependa de la hora local del servidor.
- **Implementación**: `Event.schedule` (`catalog/domain/entities/event.ts`) y `EventStart`.
- **Errores**: `EVENT_START_IN_PAST`, `EVENT_INVALID_START` (VALIDATION → 400).
- **Pruebas**: `event.spec.ts`, `catalog-values.spec.ts`, `schedule-event.handler.spec.ts`; e2e.

### RN-004 — Aforo ✅
Entero entre 1 y 100.000.
- **Implementación**: `catalog/domain/value-objects/capacity.ts`; `ck_events_capacity`.
- **Error**: `EVENT_INVALID_CAPACITY` (VALIDATION → 400).
- **Pruebas**: `catalog-values.spec.ts`; e2e `400: the domain rejects capacity 0 (RN-004)`.

### RN-005 — Precio ✅
Entero de **céntimos** entre 0 (gratis) y 10.000.000, en PEN, USD o EUR. Se usan enteros
porque en coma flotante 0,1 + 0,2 ≠ 0,3.
- **Implementación**: `catalog/domain/value-objects/ticket-price.ts`; `ck_events_price`, `ck_events_currency`.
- **Error**: `EVENT_INVALID_PRICE` (VALIDATION → 400).
- **Pruebas**: `catalog-values.spec.ts`; e2e `400: the domain rejects an unsupported currency (RN-005)`.

### RN-006 — Un recinto, una hora ✅
No pueden programarse dos eventos en el mismo recinto **a la misma hora de inicio** (sin
distinguir mayúsculas).
- **Implementación**: `ScheduleEventHandler` (consulta `findByVenueAndStart`) + índice único
  `uq_events_venue_starts_at` sobre `(lower(venue), starts_at)` + traducción de la violación
  `23505` en `TypeOrmEventRepository`.
- **Error**: `EVENT_SLOT_TAKEN` (CONFLICT → 409).
- **Pruebas**: `schedule-event.handler.spec.ts`, `in-memory-event.repository.spec.ts`; e2e
  `409: the same venue cannot host two events…` y `409: simultaneous bookings of the same slot…`.
- **Alcance**: compara el **instante de inicio**, no franjas. Dos eventos en el mismo recinto
  con inicios distintos (aunque se solapen) están permitidos, porque el modelo no tiene
  duración ni hora de fin. Ver TD-016.

### RN-007 — Cancelación ✅
Solo se cancela un evento `SCHEDULED` que aún no ha empezado. Emite `EventCancelled`.
Solo el **organizador** puede cancelar (clave de API, ver ADR-014).
- **Implementación**: `Event.cancel`.
- **Errores**: `EVENT_ALREADY_CANCELLED`, `EVENT_ALREADY_STARTED` (CONFLICT → 409).
- **Pruebas**: `event.spec.ts`, `cancel-event.handler.spec.ts` (incluye el caso "ya empezó" con
  reloj fijo); e2e `204 then 409 when cancelling twice`, `401: cancelling requires the organizer key`.

## Contexto Venta de entradas

### RN-008 — Entradas por compra y por titular ✅
- Entre 1 y 10 entradas **por operación**.
- Un mismo titular (email, sin distinguir mayúsculas) no puede tener más de **10 entradas
  activas** (emitidas o usadas; las reembolsadas no cuentan) **por evento**, sumando todas
  sus compras. Así una sola persona no acapara el aforo repitiendo compras.
- **Implementación**: `ticketing/domain/value-objects/quantity.ts`;
  `TicketAllocation.sell(quantity, heldByHolder, now)` con `MAX_TICKETS_PER_HOLDER`;
  `PurchaseTicketsHandler` cuenta las entradas del titular (`countActiveByEventAndHolder`)
  **dentro de la transacción y después de leer el cupo**. Como toda compra modifica el cupo,
  el bloqueo optimista detecta dos compras simultáneas del mismo titular y obliga a recontar.
  Índice `ix_tickets_event_holder`.
- **Errores**: `TICKET_INVALID_QUANTITY` (VALIDATION → 400), `TICKET_HOLDER_LIMIT_EXCEEDED` (CONFLICT → 409).
- **Pruebas**: `ticket-allocation.spec.ts`, `purchase-tickets.handler.spec.ts`; e2e
  `409: one holder cannot accumulate more than 10 tickets…` y concurrencia
  `the same holder buying in parallel never ends up with more than 10 tickets`.
- **Alcance**: el email no está verificado (no hay cuentas de usuario); quien use emails
  distintos puede comprar más. Lo frena el límite de peticiones por IP (ADR-014); la
  solución completa requiere identidad y pago (TD-005).

### RN-009 — Nunca se sobrevende ⭐ ✅
El número de entradas vendidas nunca supera el aforo, **ni siquiera con muchas compras simultáneas**.
- **Implementación** (tres capas):
  1. `TicketAllocation.sell` rechaza vender más de lo disponible (dominio).
  2. Bloqueo optimista del cupo (`version`): dos compras que leyeron el mismo cupo no pueden
     guardar ambas; la segunda deshace su transacción, relee y reintenta con espera aleatoria
     (`PurchaseTicketsHandler`).
  3. `CHECK sold <= capacity` (`ck_ticket_allocations_sold`) en la base, como última barrera.
- **Error**: `TICKET_NOT_ENOUGH_AVAILABLE` (CONFLICT → 409).
- **Pruebas**: `ticket-allocation.spec.ts`, `purchase-tickets.handler.spec.ts`,
  `in-memory-ticketing.repositories.spec.ts`; e2e `30 simultaneous buyers for 5 seats…`.

### RN-010 — Cuándo no se vende ✅
No se vende si el **catálogo** tiene el evento cancelado (aunque su cupo siga abierto porque
el cierre automático aún no ocurrió o falló), si la venta está cerrada o si el evento ya empezó.
- **Implementación**: `PurchaseTicketsHandler` consulta el catálogo en **cada** compra (ACL
  `EventCatalog`); `TicketAllocation.open` / `sell`. `GetEventAvailability` informa
  `salesOpen: false` en los mismos casos.
- **Errores**: `TICKET_SALES_CLOSED`, `TICKET_EVENT_ALREADY_STARTED` (CONFLICT → 409).
- **Pruebas**: `ticket-allocation.spec.ts`, `purchase-tickets.handler.spec.ts`
  (*asks the catalog every time…*), `get-event-availability.handler.spec.ts`; e2e
  `409: a cancelled event does not sell even if its allocation was left OPEN…`.

### RN-011 — Titular ✅
Nombre de 2–80 caracteres (NFC, espacios colapsados) y email válido, normalizado en minúsculas.
- **Implementación**: `holder-name.ts`, `holder-email.ts`.
- **Errores**: `TICKET_INVALID_HOLDER_NAME`, `TICKET_INVALID_HOLDER_EMAIL` (VALIDATION → 400).
- **Pruebas**: `ticketing-values.spec.ts`; e2e `400: the domain rejects an invalid email (RN-011)`.

### RN-012 — Código secreto de la entrada ✅
Cada entrada tiene un código aleatorio `XXXX-XXXX-XXXX` (alfabeto de 31 símbolos sin
caracteres ambiguos: 31¹² ≈ 2⁵⁹ combinaciones), generado con el CSPRNG del sistema y
entregado **una sola vez** al comprador. Solo se guarda su **HMAC-SHA256** con un secreto
del servidor (`TICKET_CODE_SECRET`); ninguna respuesta, log ni evento lo contiene.
- **Implementación**: `ticket-code.ts` (`[REDACTED]` al serializar), `ticket-code-hash.ts`,
  puertos `ticket-code-generator.port.ts` y `ticket-code-hasher.port.ts`, adaptadores
  `security/crypto-ticket-code-generator.ts` y `security/hmac-ticket-code-hasher.ts`,
  vista `ticket.view.ts`, `uq_tickets_code_hash`.
- **Error**: `TICKET_INVALID_CODE` (VALIDATION → 400).
- **Pruebas**: `ticketing-values.spec.ts`, `crypto-ticket-code-generator.spec.ts`,
  `hmac-ticket-code-hasher.spec.ts`, `get-ticket.handler.spec.ts`; e2e `never stores or returns the code again…`.

### RN-013 — Uso único ✅
Una entrada `ISSUED` pasa a `USED` en la puerta; no puede usarse dos veces y una entrada
`REFUNDED` no es válida. Si dos lectores escanean a la vez, el segundo recibe `TICKET_ALREADY_USED`.
- **Implementación**: `Ticket.checkIn`, `CheckInTicketHandler`; `ck_tickets_used_at`.
- **Errores**: `TICKET_ALREADY_USED`, `TICKET_REFUNDED` (CONFLICT → 409).
- **Pruebas**: `ticket.spec.ts`, `check-in-ticket.handler.spec.ts`; e2e `200 once, then 409 TICKET_ALREADY_USED`.

### RN-014 — Cancelación de un evento ✅
Al cancelarse un evento, se cierra su venta y se reembolsan las entradas no usadas (las usadas
se conservan). Debe cumplirse también si el evento **nunca vendió nada** y si una compra
**coincide** con la cancelación.
- **Implementación**:
  - Evento `catalog/domain/events/event-cancelled.event.ts` → oyente
    `ticketing/infrastructure/event-handlers/close-sales-on-event-cancelled.listener.ts`
    (reintenta 3 veces con espera creciente) → `CloseEventSalesHandler`.
  - `CloseEventSalesHandler` comprueba en el catálogo que el evento está cancelado, cierra el
    cupo con `TicketAllocation.close` o, si no existe, **crea uno ya cerrado**
    (`TicketAllocation.closedFor`), y reembolsa las entradas emitidas **por lotes** de 200.
  - El cupo es el punto de serialización: la compra lo guarda junto con sus entradas en una
    transacción; el cierre también lo escribe (o lo crea). Por la clave primaria y el
    bloqueo optimista, o la compra ve la venta cerrada, o el cierre ve (y reembolsa) las
    entradas ya confirmadas. Ver ADR-013.
  - Recuperación: si el cierre automático se pierde (el proceso cae entre cancelar y
    cerrar), `ReconcileSalesHandler` lo completa al arrancar la aplicación y bajo demanda
    (`POST /tickets/sales/reconcile`, organizador). Ver ADR-016.
- **Errores**: `TICKET_EVENT_NOT_CANCELLED` (CONFLICT → 409; protección interna: nunca se
  cierra la venta de un evento programado).
- **Eventos resultantes**: `SalesClosed`, `TicketRefunded`.
- **Pruebas**: `close-event-sales.handler.spec.ts`, `reconcile-sales.handler.spec.ts`,
  `close-sales-on-event-cancelled.listener.spec.ts`, `purchase-tickets.handler.spec.ts`
  (*a FIRST purchase that read the catalog before the cancellation…*); e2e *cross-context event*,
  `POST /tickets/sales/reconcile…` y concurrencia `purchases racing a cancellation…`.

### RN-015 — Importe ✅
Total = precio unitario × cantidad, en céntimos enteros. Cada entrada guarda el precio que
se pagó (si el catálogo cambiara, las entradas vendidas no cambian).
- **Implementación**: `Money.times`, `TicketAllocation.sell`, `Ticket.price`.
- **Pruebas**: `ticketing-values.spec.ts`, `purchase-tickets.handler.spec.ts`; e2e `201: issues the tickets…`.

### RN-016 — Acceso en la puerta ✅
Una entrada solo da acceso:
1. a **su** evento: el check-in indica el evento de la puerta (`eventId`) y una entrada de
   otro evento se rechaza;
2. si el evento **no fue cancelado** (aunque la entrada aún no se haya reembolsado);
3. dentro del **horario de puertas**: desde **12 h antes** del inicio hasta **24 h después**.
   El modelo no tiene hora de fin, así que estas ventanas son una política fija del dominio
   (`CHECK_IN_OPENS_HOURS_BEFORE_START`, `CHECK_IN_CLOSES_HOURS_AFTER_START` en `ticket.ts`).
- **Implementación**: `Ticket.checkIn(event, now)`; `CheckInTicketHandler` obtiene el evento
  por el ACL `EventCatalog`. Solo el personal (rol puerta u organizador) puede hacer check-in.
- **Errores**: `TICKET_WRONG_EVENT`, `TICKET_EVENT_CANCELLED`, `TICKET_CHECK_IN_NOT_OPEN`,
  `TICKET_CHECK_IN_CLOSED` (CONFLICT → 409); `TICKET_EVENT_NOT_FOUND` (404).
- **Pruebas**: `ticket.spec.ts` (bordes exactos de la ventana), `check-in-ticket.handler.spec.ts`;
  e2e `409: a valid ticket is not accepted at the door of another event`,
  `409: doors are not open yet…`, `409: the ticket of a cancelled event is rejected…`.
