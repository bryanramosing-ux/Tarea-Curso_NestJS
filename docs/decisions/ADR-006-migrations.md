# ADR-006 — Migraciones versionadas, `synchronize: false` y configuración compartida

## Contexto
`synchronize: true` modifica el esquema al arrancar según los decoradores: es
irreproducible, puede perder datos y oculta los cambios de esquema a la revisión.

## Decisión
- `synchronize: false` y `migrationsRun: false` siempre; el esquema se crea con migraciones
  SQL explícitas con `up()` y `down()`.
- `buildDataSourceOptions()` es la única definición de conexión (app + CLI).
- Migraciones y entidades en listas explícitas.
- Las reglas que solo puede garantizar la base tienen restricción en la migración:
  recinto+hora único (RN-006), un cupo por evento y `sold <= capacity` (RN-009), código
  único (RN-012); además `CHECK`s de defensa en profundidad.

## Por qué
- Reproducibilidad: cualquiera obtiene el mismo esquema con `pnpm migration:run`.
- Revisión: el SQL de cada cambio queda versionado.
- La concurrencia no se resuelve solo en la aplicación: dos programaciones simultáneas del
  mismo recinto pasan ambas el `findByVenueAndStart`; el índice único decide.
- Nombres de restricción estables (`uq_events_venue_starts_at`, `pk_ticket_allocations`)
  que el adaptador reconoce para traducir errores de la base a errores de dominio.
- El índice único es **funcional** (`lower(venue)`), algo que `synchronize` no permite expresar.

## Consecuencias
- Cada cambio de esquema exige escribir y registrar una migración.
- Las e2e ejecutan las migraciones reales desde cero y prueban `down()`.

## Alternativas descartadas
- `synchronize: true` en desarrollo: diverge de producción y está prohibido por la rúbrica.
- `migration:generate` como fuente de verdad: nombres de restricciones no controlados.
