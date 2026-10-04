# ADR-011 — Bloqueo optimista con columna `version`

## Contexto
Dos operaciones pueden leer el mismo agregado y guardarlo después. Sin control, la
segunda **sobrescribe en silencio** a la primera ("actualización perdida"). En una venta de
entradas es grave: dos compradores leen "queda 1 plaza", ambos compran y ambos guardan
`sold = capacity` → se emiten dos entradas para una plaza. Se comprobó con PostgreSQL real:
sin control, 30 compradores simultáneos para 5 plazas obtienen **16** entradas.

## Decisión
- `AggregateRoot` lleva una `version` (0 = nuevo; ≥ 1 = almacenado, validado en `fromPrimitives`).
- Todas las tablas tienen `version integer NOT NULL` con `CHECK >= 1`.
- Los adaptadores insertan los agregados nuevos y actualizan los existentes con
  `WHERE id = ? AND version = ?`. Si no se actualiza ninguna fila, lanzan
  `*_CONCURRENT_MODIFICATION` (CONFLICT → 409). Tras guardar, llaman a `markAsPersisted()`.
- Quien no puede devolver un 409 a un humano reintenta releyendo:
  - `PurchaseTicketsHandler` (hasta 10 intentos con espera aleatoria, ADR-012);
  - `CheckInTicketHandler` (un reintento: el segundo lector recibe `TICKET_ALREADY_USED`);
  - `CloseEventSalesHandler` (disparado por un evento: relee y omite lo ya usado/reembolsado).

## Por qué
- Las invariantes se comprueban sobre el estado leído; sin versión, una decisión tomada
  sobre un estado obsoleto se guardaría igualmente.
- No mantiene bloqueos abiertos (adecuado para HTTP con colisiones puntuales) y el
  conflicto llega como un 409 con código estable.
- `@VersionColumn` de TypeORM solo incrementa el número: no comprueba la versión esperada
  al guardar, por eso la condición se escribe explícitamente en el `UPDATE`.

## Consecuencias
- Con muchísima contención, una compra puede agotar los reintentos y recibir
  `TICKET_SALES_CONCURRENT_MODIFICATION`; el cliente puede reintentar.
- La versión no se expone en las vistas (no hay `If-Match`/`ETag` todavía).

## Alternativas descartadas
- Bloqueo pesimista (`SELECT … FOR UPDATE`): exige transacciones que abarquen el caso de
  uso entero y un puerto de *unit of work*; serializa todas las compras de un evento.
- `UPDATE … SET sold = sold + n WHERE sold + n <= capacity` directamente en SQL: es
  correcto y rápido, pero saca la regla RN-009 del dominio y la esconde en el adaptador.
- "El último gana": es justamente el bug.
