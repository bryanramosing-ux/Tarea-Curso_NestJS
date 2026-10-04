# Registro de decisiones de arquitectura (ADR)

Formato: contexto → decisión → **por qué** → consecuencias → alternativas descartadas.
Estado de todas: **Aceptada**.

| ADR | Decisión |
|---|---|
| [ADR-001](ADR-001-hexagonal-architecture.md) | Arquitectura hexagonal organizada por contexto acotado |
| [ADR-002](ADR-002-bounded-contexts.md) | Dos contextos: Catálogo y Venta de entradas |
| [ADR-003](ADR-003-cqrs.md) | CQRS con `@nestjs/cqrs` y un solo almacén |
| [ADR-004](ADR-004-domain-errors.md) | `DomainException` con `code` + `kind` y un único filtro HTTP |
| [ADR-005](ADR-005-orm-separate-from-domain.md) | Entidades ORM separadas del dominio + mappers + adaptadores en memoria |
| [ADR-006](ADR-006-migrations.md) | Migraciones versionadas, `synchronize: false`, configuración compartida app/CLI |
| [ADR-007](ADR-007-cross-context-communication.md) | Comunicación entre contextos: ACL vía QueryBus + eventos de dominio |
| [ADR-008](ADR-008-ticket-code-hmac.md) | Códigos de entrada aleatorios guardados como HMAC-SHA256 |
| [ADR-009](ADR-009-configuration.md) | Configuración validada fail-fast y centralizada en `src/config` |
| [ADR-010](ADR-010-testing-strategy.md) | Estrategia de pruebas: unitarias sin infraestructura, arquitectura automatizada, e2e reales |
| [ADR-011](ADR-011-optimistic-locking.md) | Bloqueo optimista con columna `version` para evitar actualizaciones perdidas |
| [ADR-012](ADR-012-ticket-allocation-aggregate.md) | El cupo de cada evento es un agregado propio: la pieza que impide sobrevender |
