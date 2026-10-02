# ADR-006 — Migraciones versionadas, `synchronize: false` y configuración compartida

## Contexto
`synchronize: true` modifica el esquema al arrancar según los decoradores: es
irreproducible, puede perder datos y oculta los cambios de esquema a la revisión.

## Decisión
- `synchronize: false` y `migrationsRun: false` siempre; el esquema se crea con
  migraciones SQL explícitas con `up()` y `down()`.
- `buildDataSourceOptions()` (`src/config/database.config.ts`) es la única definición
  de conexión, usada por la app y por el CLI (`src/config/typeorm.data-source.ts`).
- Migraciones y entidades se registran en listas explícitas.
- Las reglas que solo puede garantizar la base (unicidad del email, existencia del
  responsable) tienen restricción en la migración; además se añaden `CHECK` como
  defensa en profundidad de las invariantes del dominio.
- Docker Compose levanta PostgreSQL con el mismo `.env`.

## Por qué
- Reproducibilidad: cualquier persona obtiene el mismo esquema con `pnpm migration:run`.
- Revisión: el SQL de cada cambio queda versionado en Git.
- Una sola configuración evita que la app y el CLI apunten a bases distintas.
- Las listas explícitas funcionan igual con ts-node, Jest y `dist/` (los globs de
  TypeORM fallan según la extensión y el directorio de trabajo).
- La concurrencia no se puede resolver solo en la aplicación: dos `CreateUser`
  simultáneos pasan ambos el `findByEmail`; el `UNIQUE` decide.

## Consecuencias
- Cada cambio de esquema exige escribir una migración y registrarla.
- Las e2e ejecutan las migraciones reales desde cero y prueban `down()`.

## Alternativas descartadas
- `synchronize: true` en desarrollo: diverge de producción y está prohibido por la rúbrica.
- `migration:generate` automático como fuente de verdad: produce nombres de
  restricciones no controlados; se prefieren nombres estables (`uq_users_email`) que el
  código puede reconocer al traducir errores.
