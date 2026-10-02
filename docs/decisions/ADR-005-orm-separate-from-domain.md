# ADR-005 — Entidades ORM separadas del dominio, mappers y adaptadores en memoria

## Contexto
TypeORM invita a decorar las entidades de dominio con `@Entity`/`@Column`, lo que
acopla el modelo de negocio a la base de datos (constructores públicos, propiedades
mutables, tipos primitivos) y está prohibido por la rúbrica.

## Decisión
- `User`/`Task` (dominio) y `UserOrmEntity`/`TaskOrmEntity` (`*.orm-entity.ts`, solo en
  `infrastructure/persistence/typeorm/`) son clases distintas.
- `UserMapper`/`TaskMapper` traducen usando `toPrimitives()` y `fromPrimitives()`.
- `fromPrimitives()` **revalida** cada valor con los value objects y las invariantes
  del agregado: un registro corrupto produce un error, no un agregado inválido.
- Cada puerto de repositorio tiene dos adaptadores: TypeORM y en memoria.

## Por qué
- El dominio conserva constructores privados, value objects e invariantes.
- El esquema puede evolucionar (renombrar columnas, desnormalizar) sin tocar el dominio.
- El adaptador en memoria permite probar los handlers sin base de datos y demuestra
  que el puerto es realmente intercambiable. Emula también la restricción UNIQUE de
  email para que ambos adaptadores cumplan el mismo contrato.

## Consecuencias
- Algo de código de mapeo repetitivo, cubierto por pruebas (`*.mapper.spec.ts`).
- Revalidar al leer tiene un coste mínimo y detecta datos corruptos pronto.

## Alternativas descartadas
- `EntitySchema` sobre la clase de dominio: acopla igualmente la forma del dominio a la tabla.
- Repositorios genéricos de TypeORM inyectados en handlers: dependencia de infraestructura en aplicación.
