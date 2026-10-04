# ADR-001 — Arquitectura hexagonal organizada por contexto acotado

## Contexto
La estructura típica de NestJS (`Controller → Service → Repository de TypeORM`)
mezcla reglas de negocio con detalles de framework y base de datos: las reglas
quedan repartidas en servicios, las entidades son anémicas y probar una regla exige
levantar Nest o una base de datos.

## Decisión
Cada contexto (`src/catalog`, `src/ticketing`) se divide en `domain/`, `application/` e
`infrastructure/`. Las dependencias apuntan siempre hacia el dominio. El dominio es
TypeScript puro; los puertos (interfaces + token `Symbol`) viven en `domain/ports/` y
los adaptadores en `infrastructure/`. Los módulos Nest son la *composition root*:
deciden qué adaptador satisface cada puerto.

## Por qué
- Las reglas de la venta (no sobrevender, uso único, reembolsos) son lo que más cambia
  y lo que más valor tiene: deben poder leerse y probarse sin ruido técnico.
- Poder sustituir adaptadores (en memoria ↔ PostgreSQL) hace que las pruebas
  unitarias de casos de uso sean rápidas y deterministas.
- Organizar primero por contexto y luego por capa mantiene juntos los cambios de una
  misma funcionalidad y hace visibles las fronteras entre contextos.
- Se usa un **token `Symbol`** porque las interfaces de TypeScript no existen en
  tiempo de ejecución y Nest necesita un valor para inyectar.

## Consecuencias
- Más archivos que en un CRUD clásico (VO, mapper, ORM entity, puerto, dos adaptadores).
- La regla de dependencias se protege con `test/architecture/architecture.spec.ts`
  para que no se degrade con el tiempo.
- Los handlers usan decoradores de `@nestjs/cqrs`/`@nestjs/common` (`@CommandHandler`,
  `@Inject`): es una dependencia aceptada **en aplicación**, nunca en dominio; los
  decoradores no impiden instanciarlos con `new` en las pruebas.

## Alternativas descartadas
- *Capas globales* (`src/domain`, `src/application`...): diluye los contextos.
- *Servicios de Nest con lógica de negocio*: es justo lo que se quiere evitar.
