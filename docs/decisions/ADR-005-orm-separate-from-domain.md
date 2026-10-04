# ADR-005 — Entidades ORM separadas del dominio, mappers y adaptadores en memoria

## Contexto
TypeORM invita a decorar las entidades de dominio con `@Entity`/`@Column`, lo que acopla el
modelo de negocio a la base (constructores públicos, propiedades mutables) y está prohibido
por la rúbrica.

## Decisión
- `Event`, `TicketAllocation`, `Ticket` (dominio) y `EventOrmEntity`,
  `TicketAllocationOrmEntity`, `TicketOrmEntity` (`*.orm-entity.ts`, solo en
  `infrastructure/persistence/typeorm/`) son clases distintas.
- Los mappers traducen con `toPrimitives()` / `fromPrimitives()`; `fromPrimitives()`
  **revalida** value objects, invariantes y versión.
- Cada puerto de repositorio tiene dos adaptadores: TypeORM y en memoria.

## Por qué
- El dominio conserva constructores privados, value objects e invariantes.
- El esquema puede evolucionar sin tocar el dominio.
- El adaptador en memoria permite probar los handlers sin base de datos y demuestra que el
  puerto es intercambiable. Emula también las garantías de la base (índice único
  recinto+hora, clave primaria del cupo, bloqueo optimista) para cumplir el mismo contrato.

## Consecuencias
- Código de mapeo repetitivo, cubierto por pruebas (`*.mapper.spec.ts`).
- Revalidar al leer detecta datos corruptos pronto.

## Alternativas descartadas
- `EntitySchema` sobre la clase de dominio: acopla igualmente su forma a la tabla.
- Repositorios genéricos de TypeORM en los handlers: infraestructura en aplicación.
