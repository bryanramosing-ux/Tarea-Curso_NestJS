# Autoevaluación contra la rúbrica

Auditoría criterio por criterio. **No** es una nota: indica si existe evidencia verificable
de cada requisito. Estados: `CUMPLE`, `PARCIAL`, `NO CUMPLE`.

Dominio: **venta de entradas para eventos** (contextos Catálogo y Venta de entradas).

## Evidencia de ejecución (instalación desde cero)

Clon limpio del repositorio siguiendo solo el README (2026-10-10, Linux, Node 22.22,
pnpm 10.28). En esta verificación PostgreSQL 16 corría instalado localmente en lugar de en
Docker (el entorno no tenía el *daemon* de Docker); se usó una base nueva y vacía. La
verificación anterior con `docker compose up -d --wait` (2026-10-04) dio `ticketing-postgres Healthy`.

| Paso | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm migration:run` **sin** `.env` | Falla al arrancar: `Invalid environment configuration (check your .env)` (esperado) |
| `cp .env.example .env` + base vacía | OK |
| `pnpm migration:run` | **3 migraciones** ejecutadas |
| `pnpm typecheck` | 0 errores |
| `pnpm test` | 28 suites, **252 pruebas en verde** |
| `pnpm test:e2e` | 6 suites, **68 pruebas en verde** (4 ejecuciones seguidas en el repositorio de trabajo, estable) |
| `pnpm build` + `node dist/main` + `POST /events` con la clave del organizador | `Ticketing API listening on port …` → `201` |
| `NODE_ENV=production node dist/main` con los valores de `.env.example` | No arranca: `… still has the public example value from .env.example` (esperado) |
| `pnpm audit --prod` | 0 vulnerabilidades |

## Comprobaciones específicas (autoevaluación de la rúbrica)

| # | Comprobación | Resultado | Cómo se verifica |
|---|---|---|---|
| 1 | `grep -rn "@nestjs\|typeorm\|class-validator" src/*/domain/` vacío | ✅ | grep + `test/architecture` |
| 2 | Ningún value object con constructor público | ✅ | `test/architecture` (18 VOs) |
| 3 | Entidad de dominio ≠ entidad ORM | ✅ `Event`/`EventOrmEntity`, `TicketAllocation`/`TicketAllocationOrmEntity`, `Ticket`/`TicketOrmEntity` | `*.mapper.spec.ts` |
| 4 | Existe mapper | ✅ 3 mappers | `test/architecture` |
| 5 | Existe repositorio en memoria y lo usan las unitarias de los handlers | ✅ 3 (uno por puerto de repositorio) + `InMemoryUnitOfWork`, `FixedClock` | `test/architecture`, specs de handlers |
| 6 | Ningún controlador importa repositorios | ✅ | `test/architecture` |
| 7 | El dominio no lanza excepciones de Nest; un solo filtro traduce los errores de negocio | ✅ | `test/architecture` |
| 8 | `synchronize = false` y el esquema sale de las migraciones | ✅ | `test/architecture`, e2e |
| 9 | Ningún `domain/` importa otro `domain/` | ✅ | `test/architecture` |
| 10 | Eventos publicados después de persistir | ✅ | espías en handlers + regla que analiza `execute()` |
| 11 | `process.env` solo en configuración | ✅ | `test/architecture` |
| 12 | `pnpm test` | ✅ 252/252 | ejecución |
| 13 | `pnpm test:e2e` | ✅ 68/68 | ejecución |
| 14 | Instalación desde cero siguiendo el README | ✅ | tabla anterior |

## Faltas graves

| Falta grave | Estado |
|---|---|
| `@Entity`/`@Column` en entidades o VOs de dominio | No existe (solo en `*.orm-entity.ts`) |
| Archivo de `domain/` que importa `@nestjs/*` | No existe |
| Controlador que accede al repositorio sin caso de uso | No existe |
| Contraseñas o hashes en respuestas HTTP o logs | No hay contraseñas de usuarios en este dominio. El código de entrada se muestra una vez y solo se guarda su HMAC, que nunca se devuelve ni se registra. Las claves de API del personal nunca se registran ni aparecen en errores (prueba en `api-key.guard.spec.ts`) |
| Secretos committeados | No existe: `.env` ignorado; `.env.example` solo trae valores públicos marcados `change-me`, que la app **rechaza en producción** |
| Tests desactivados con `skip` | No existe (regla automática) |
| Tests manipulados para pasar | No. Los cambios en pruebas existentes se explican en el commit y en el código: (1) las firmas cambiaron (reloj e ids inyectados, `now` obligatorio, check-in con `eventId`, claves de API, `GET /events` paginado); (2) la prueba de la compensación compra ↔ cancelación se sustituyó por la de la transacción y la de la primera compra (ADR-013), porque la compensación se eliminó; (3) la regla "publicar después de guardar" admite **solo** un handler que no guarda ni publica y delega por el `CommandBus` (`ReconcileSales`), y la prueba exige ese `commandBus.execute`. Se añadieron dos reglas nuevas, más estrictas. Controles negativos documentados en `architecture/testing.md` |

---

## 1. Arquitectura hexagonal y regla de dependencias (15)
- **Requisitos**: `domain/`, `application/`, `infrastructure/` por contexto; dominio sin frameworks; dependencias hacia dentro; aplicación depende de interfaces inyectadas por token.
- **Implementación**: `src/catalog/*`, `src/ticketing/*`; puertos con token `Symbol`; módulos Nest como *composition root*. El dominio tampoco importa módulos de Node (el azar está en infraestructura).
- **Archivos**: `src/catalog/catalog.module.ts`, `src/ticketing/ticketing.module.ts`, `src/shared/shared.module.ts`, `src/*/domain/ports/*.ts`.
- **Evidencia**: `test/architecture/architecture.spec.ts`.
- **Estado**: **CUMPLE**.

## 2. Modelo de dominio: entidades y value objects (15)
- **Requisitos**: entidades con identidad y comportamiento; VOs que se validan y normalizan; `equals()`; invariantes en la entidad; `fromPrimitives()` revalida.
- **Implementación**: `Event` (`schedule`, `cancel`), `TicketAllocation` (`open`, `closedFor`, `sell` con tope por titular, `close`), `Ticket` (`issue`, `checkIn` con evento y horario, `refund`); 18 VOs (p. ej. `Venue` con comparación sin mayúsculas y NFC, `Money` en céntimos, `TicketCode` redactado). Las reglas nuevas (RN-008 por titular, RN-016) viven en los agregados, no en los handlers.
- **Archivos**: `src/*/domain/entities/*.ts`, `src/*/domain/value-objects/*.ts`.
- **Evidencia**: `event.spec.ts`, `ticket-allocation.spec.ts`, `ticket.spec.ts`, specs de VOs.
- **Estado**: **CUMPLE**.

## 3. Puertos y adaptadores (15)
- **Requisitos**: puertos en `domain/ports`; ≥ 2 adaptadores del repositorio; entidad ORM distinta; mapper; adaptador sin reglas y `null` si no encuentra; dependencias externas (hash, reloj...) detrás de un puerto.
- **Implementación**: repositorios (`EventRepository`, `TicketAllocationRepository`, `TicketRepository`) con adaptador TypeORM y en memoria; `EventCatalog` (ACL), `TicketCodeHasher` (HMAC), `TicketCodeGenerator` (CSPRNG), `Clock`, `IdGenerator`, `UnitOfWork` (transacción), `DomainEventPublisher` (EventBus).
- **Evidencia**: specs de mappers, repositorios en memoria, ACL, generador; e2e.
- **Estado**: **CUMPLE**.

## 4. Casos de uso y CQRS (10)
- **Requisitos**: comandos y consultas separados en su carpeta; controladores delgados con buses; handlers que orquestan.
- **Implementación**: 6 comandos (`ScheduleEvent`, `CancelEvent`, `PurchaseTickets`, `CheckInTicket`, `CloseEventSales`, `ReconcileSales`) y 4 consultas (`GetEvent`, `ListEvents`, `GetTicket`, `GetEventAvailability`).
- **Evidencia**: handlers probados con `new` y adaptadores en memoria; regla de controladores.
- **Estado**: **CUMPLE**. Matiz: `PurchaseTicketsHandler` es el handler más largo (orquesta catálogo, transacción, reintentos y emisión), pero las decisiones de negocio están en `TicketAllocation` y `Ticket`.

## 5. Manejo de errores y validación (10)
- **Requisitos**: excepción de dominio con código estable y tipo; dominio sin HTTP; filtro único que cubre todos los tipos; validación en dos niveles; un error de negocio nunca responde 500.
- **Implementación**: `DomainException { code, kind }`; `DomainExceptionFilter` (switch exhaustivo); `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`; errores del framework y fallos del servidor con la misma forma (`HttpExceptionFilter`, `UnhandledExceptionFilter`); datos corruptos → 500, no 400; mensajes sin eco de la entrada.
- **Archivos**: `src/shared/**`, `docs/business-rules/error-catalog.md` (coincide con el código).
- **Evidencia**: `domain-exception.filter.spec.ts`, `unhandled-exception.filter.spec.ts`; e2e de 400, 401, 403, 404, 409, 413, 429 y 500.
- **Estado**: **CUMPLE**.

## 6. Pruebas (10)
- **Requisitos**: unitarias sin Nest ni BD; e2e con base real arrancando la app con la misma configuración que `main.ts`; casos felices y de error; todo en verde.
- **Implementación**: 252 unitarias/arquitectura; 68 e2e con `global-setup` que aplica las migraciones reales y `configureApp` compartido; concurrencia (30 compras simultáneas, mismo titular en paralelo, compras contra cancelaciones), ROLLBACK real, límite de peticiones.
- **Evidencia**: instalación desde cero (tabla inicial); controles negativos.
- **Estado**: **CUMPLE**.

## 7. Persistencia y migraciones (8)
- **Requisitos**: migraciones, `synchronize: false`, configuración compartida app/CLI, restricciones de BD, Docker Compose funcional.
- **Implementación**: 3 migraciones con `up/down`; índice único funcional recinto+hora, PK del cupo, `CHECK sold <= capacity`, `UNIQUE code_hash`, FKs, `CHECK`s, índices de titular y de cupos abiertos; Compose con healthcheck.
- **Evidencia**: `migrations.e2e-spec.ts` (restricciones presentes, `down()` reversible de las tres), e2e de concurrencia y de restricciones.
- **Estado**: **CUMPLE**.

## 8. Contextos acotados y eventos de dominio (7)
- **Requisitos**: ≥ 2 contextos con lectura y escritura; sin importar el dominio ajeno; VOs no compartidos; eventos en pasado publicados tras persistir; oyentes externos en infraestructura.
- **Implementación**: Catálogo y Venta; ACL `CatalogEventCatalog`; 8 eventos de dominio; oyente `CloseSalesOnEventCancelledListener` (con reintentos) y conciliación en `ticketing/infrastructure/event-handlers`.
- **Evidencia**: `test/architecture`, `close-event-sales.handler.spec.ts`, `reconcile-sales.handler.spec.ts`, e2e *cross-context event* y *purchases racing a cancellation*.
- **Estado**: **CUMPLE**. Limitación documentada: sin *transactional outbox*, mitigado por la conciliación (TD-001, ADR-016).

## 9. Configuración y seguridad (5)
- **Requisitos**: variables validadas al arrancar sin defaults peligrosos; `process.env` solo en config; `.env.example` actualizado; `.env` y secretos no versionados; datos sensibles protegidos.
- **Implementación**: `validateEnv` sin defaults (secretos y claves ≥ 32 caracteres, claves distintas, valores de ejemplo rechazados en producción); claves de API por rol; límite de peticiones; códigos de entrada como HMAC; datos personales solo para el personal; `helmet`; BD solo en `127.0.0.1`; `logging: false`.
- **Evidencia**: `env.validation.spec.ts`, `api-key.guard.spec.ts`, `hmac-ticket-code-hasher.spec.ts`, e2e de autenticación, límite y cabeceras; `docs/audit-checklist.md`.
- **Estado**: **CUMPLE**. Documentado: claves por rol en lugar de usuarios (TD-004) y avisos de `pnpm audit` solo en dependencias de desarrollo (TD-014).

## 10. Documentación (5)
- **Requisitos**: README que permita levantar el proyecto desde cero; reglas con IDs estables y estado, enlazadas al código; decisiones con el porqué; deuda técnica honesta.
- **Implementación**: README; `docs/EMPIEZA-AQUI.md` y versión Linux; `docs/guia-paso-a-paso.md`; RN-001…RN-016 con estado, archivo y pruebas; 16 ADRs; deuda técnica (pendiente y resuelta); auditoría con hallazgos y controles negativos.
- **Evidencia**: instalación desde cero siguiendo solo el README.
- **Estado**: **CUMPLE**.

## Pendiente de validación
- Ejecución en **Windows/macOS**: solo se probó en Linux.
- La última instalación limpia usó PostgreSQL local, no Docker (ver arriba).
- Revisión del historial de Git por parte del evaluador.
