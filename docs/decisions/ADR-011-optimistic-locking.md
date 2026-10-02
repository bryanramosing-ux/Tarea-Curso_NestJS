# ADR-011 — Bloqueo optimista con columna `version`

## Contexto
La auditoría reprodujo una **actualización perdida** con el adaptador real: dos
operaciones leen la misma tarea; una la libera porque su responsable fue desactivado
(RN-013) y la otra, con su copia antigua, cambia el estado y guarda después. El
resultado era una tarea `IN_REVIEW` asignada a un miembro inactivo: la segunda
escritura deshacía la primera sin que nadie lo notara. Lo mismo podía duplicar
`UserDeactivated` con dos desactivaciones simultáneas.

## Decisión
- `AggregateRoot` lleva una `version` (0 = nuevo; ≥ 1 = almacenado, validado en `fromPrimitives`).
- Migración `AddOptimisticLockingVersion` añade `version integer NOT NULL DEFAULT 1` con `CHECK >= 1`.
- Los adaptadores insertan los agregados nuevos y actualizan los existentes con
  `WHERE id = ? AND version = ?`. Si no se actualiza ninguna fila, lanzan
  `USER_CONCURRENT_MODIFICATION` / `TASK_CONCURRENT_MODIFICATION` (CONFLICT → 409).
- `ReleaseMemberTasksHandler`, que lo dispara un evento y no puede devolver un 409 a
  nadie, relee y reintenta hasta `RELEASE_MAX_ATTEMPTS` veces (omite la tarea si ya
  no pertenece al miembro o ya está DONE).

## Por qué
- Las invariantes se comprueban sobre el estado leído; sin control de versión, una
  decisión tomada sobre un estado obsoleto se puede guardar igualmente.
- El bloqueo optimista no mantiene bloqueos abiertos (adecuado para una API HTTP con
  pocas colisiones) y el conflicto llega al cliente como un 409 con código estable.
- `@VersionColumn` de TypeORM solo incrementa el número: no comprueba la versión
  esperada al guardar, por eso la condición se escribe explícitamente en el `UPDATE`.

## Consecuencias
- Un cliente puede recibir 409 `*_CONCURRENT_MODIFICATION` y debe reintentar tras releer.
- La versión no se expone en las vistas (no hay `If-Match`/`ETag` todavía).
- Queda un caso residual distinto (asignación ↔ desactivación en dos agregados): TD-012.

## Alternativas descartadas
- Bloqueo pesimista (`SELECT … FOR UPDATE`): exige transacciones que abarquen el caso
  de uso entero y un puerto de *unit of work*; excesivo para esta escala.
- "El último gana": es justamente el bug.
