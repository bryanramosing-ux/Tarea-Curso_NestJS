# Autoevaluación contra la rúbrica

Auditoría criterio por criterio. **No** es una nota: indica si existe evidencia verificable
de cada requisito. Estados: `CUMPLE`, `PARCIAL`, `NO CUMPLE`.

Dominio: **venta de entradas para eventos** (contextos Catálogo y Venta de entradas).

## Evidencia de ejecución (instalación desde cero)

Clon limpio del repositorio, volumen de Docker borrado, siguiendo solo el README (2026-10-04):

| Paso | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm migration:run` **sin** `.env` | Falla al arrancar: `Invalid environment configuration (check your .env)` (esperado) |
| `cp .env.example .env` + `docker compose up -d --wait` | `ticketing-postgres Healthy` |
| `pnpm migration:run` | 2 migraciones ejecutadas |
| `pnpm typecheck` | 0 errores |
| `pnpm test` | 23 suites, **189 pruebas en verde** |
| `pnpm test:e2e` | 5 suites, **44 pruebas en verde** |
| `pnpm build` + `node dist/main` + `POST /events` | `Ticketing API listening on port 3000` → `201 {"id": …}` |
| `pnpm audit --prod` | 0 vulnerabilidades |

## Comprobaciones específicas (autoevaluación de la rúbrica)

| # | Comprobación | Resultado | Cómo se verifica |
|---|---|---|---|
| 1 | `grep -rn "@nestjs\|typeorm\|class-validator" src/*/domain/` vacío | ✅ | grep + `test/architecture` |
| 2 | Ningún value object con constructor público | ✅ | `test/architecture` (18 VOs) |
| 3 | Entidad de dominio ≠ entidad ORM | ✅ `Event`/`EventOrmEntity`, `TicketAllocation`/`TicketAllocationOrmEntity`, `Ticket`/`TicketOrmEntity` | `*.mapper.spec.ts` |
| 4 | Existe mapper | ✅ 3 mappers | `test/architecture` |
| 5 | Existe repositorio en memoria | ✅ 3 (uno por puerto de repositorio) | `test/architecture` |
| 6 | Ningún controlador importa repositorios | ✅ | `test/architecture` |
| 7 | El dominio no lanza excepciones de Nest | ✅ | `test/architecture` |
| 8 | `synchronize = false` | ✅ | `test/architecture`, e2e |
| 9 | Ningún `domain/` importa otro `domain/` | ✅ (y comprobado con mutación) | `test/architecture` |
| 10 | Eventos publicados después de persistir | ✅ | espías en handlers + regla que analiza `execute()` |
| 11 | `process.env` solo en configuración | ✅ | `test/architecture` |
| 12 | `pnpm test` | ✅ 189/189 | ejecución |
| 13 | `pnpm test:e2e` | ✅ 44/44 | ejecución |
| 14 | Instalación desde cero siguiendo el README | ✅ | tabla anterior |

## Faltas graves

| Falta grave | Estado |
|---|---|
| `@Entity`/`@Column` en entidades o VOs de dominio | No existe (solo en `*.orm-entity.ts`) |
| Archivo de `domain/` que importa `@nestjs/*` | No existe |
| Controlador que accede al repositorio sin caso de uso | No existe |
| Contraseñas o hashes en respuestas HTTP o logs | No hay contraseñas en este dominio; el equivalente (código de entrada) se muestra una vez y solo se guarda su HMAC, que nunca se devuelve ni se registra (unitarias + e2e) |
| Secretos committeados | No existe (`.env` ignorado; `.env.example` con valores de ejemplo) |
| Tests desactivados con `skip` | No existe (regla automática) |
| Tests manipulados para pasar | No: controles negativos (sin bloqueo optimista la e2e vende 16 entradas para 5 y falla; sin la compensación falla la prueba de carrera; mutaciones de arquitectura detectadas). La única regla de prueba modificada (publicar tras guardar) se hizo **más estricta** (analiza `execute()`), no más laxa |

---

## 1. Arquitectura hexagonal y regla de dependencias (15)
- **Requisitos**: `domain/`, `application/`, `infrastructure/` por contexto; dominio sin frameworks; dependencias hacia dentro.
- **Implementación**: `src/catalog/*`, `src/ticketing/*`; puertos con token `Symbol`; módulos Nest como composition root.
- **Archivos**: `src/catalog/catalog.module.ts`, `src/ticketing/ticketing.module.ts`, `src/*/domain/ports/*.ts`.
- **Evidencia**: `test/architecture/architecture.spec.ts`.
- **Estado**: **CUMPLE**.

## 2. Modelo de dominio: entidades y value objects (15)
- **Requisitos**: entidades con identidad y comportamiento; VOs que se validan y normalizan; `equals()`; `fromPrimitives()` revalida.
- **Implementación**: `Event` (`schedule`, `cancel`), `TicketAllocation` (`open`, `sell`, `close`), `Ticket` (`issue`, `checkIn`, `refund`); 18 VOs (p. ej. `Venue` con comparación sin mayúsculas, `Money` con aritmética en céntimos, `TicketCode` redactado).
- **Archivos**: `src/*/domain/entities/*.ts`, `src/*/domain/value-objects/*.ts`.
- **Evidencia**: `event.spec.ts`, `ticket-allocation.spec.ts`, `ticket.spec.ts`, specs de VOs (incluida reconstrucción de filas corruptas).
- **Estado**: **CUMPLE**.

## 3. Puertos y adaptadores (15)
- **Requisitos**: puertos en `domain/ports`; ≥ 2 adaptadores del repositorio; entidad ORM distinta; mapper; adaptador sin reglas, `null` si no encuentra.
- **Implementación**: puertos `EventRepository`, `TicketAllocationRepository`, `TicketRepository`, `EventCatalog`, `TicketCodeHasher`, `DomainEventPublisher`; adaptadores TypeORM, en memoria, HMAC, ACL y EventBus.
- **Evidencia**: specs de mappers, repositorios en memoria y ACL; e2e.
- **Estado**: **CUMPLE**.

## 4. Casos de uso y CQRS (10)
- **Requisitos**: comandos y consultas separados; controladores delgados con buses; handlers que orquestan.
- **Implementación**: 5 comandos (`ScheduleEvent`, `CancelEvent`, `PurchaseTickets`, `CheckInTicket`, `CloseEventSales`) y 4 consultas (`GetEvent`, `ListEvents`, `GetTicket`, `GetEventAvailability`), cada uno en su carpeta.
- **Evidencia**: handlers probados con `new` y adaptadores en memoria; regla de controladores.
- **Estado**: **CUMPLE**.

## 5. Manejo de errores y validación (10)
- **Requisitos**: excepción de dominio con código estable y tipo; dominio sin HTTP; filtro único; validación en dos niveles.
- **Implementación**: `DomainException { code, kind }`; `DomainExceptionFilter` (switch exhaustivo); `ValidationPipe` con `whitelist` y `forbidNonWhitelisted` (el cliente no puede enviar el precio).
- **Archivos**: `src/shared/**`, `docs/business-rules/error-catalog.md`.
- **Evidencia**: `domain-exception.filter.spec.ts`; e2e de 400 (DTO y dominio), 404, 409 y 413.
- **Estado**: **CUMPLE**.

## 6. Pruebas (10)
- **Requisitos**: unitarias sin Nest ni BD; e2e con base real y migraciones reales; en verde.
- **Implementación**: 189 unitarias/arquitectura; 44 e2e con `global-setup` que aplica las migraciones reales; prueba de concurrencia con 30 compras simultáneas.
- **Evidencia**: instalación desde cero (tabla inicial); controles negativos.
- **Estado**: **CUMPLE**.

## 7. Persistencia y migraciones (8)
- **Requisitos**: migraciones, `synchronize: false`, configuración compartida app/CLI, restricciones de BD, Docker Compose funcional.
- **Implementación**: 2 migraciones con `up/down`; índice único funcional recinto+hora, PK del cupo, `CHECK sold <= capacity`, `UNIQUE code_hash`, FKs, `CHECK`s; Compose con healthcheck.
- **Evidencia**: `migrations.e2e-spec.ts` (restricciones presentes, `down()` reversible), e2e de concurrencia y de restricciones.
- **Estado**: **CUMPLE**.

## 8. Contextos acotados y eventos de dominio (7)
- **Requisitos**: ≥ 2 contextos con lectura y escritura; sin importar el dominio ajeno; eventos en pasado publicados tras persistir; oyentes externos en infraestructura.
- **Implementación**: Catálogo y Venta; ACL `CatalogEventCatalog`; 8 eventos de dominio; oyente `CloseSalesOnEventCancelledListener` en `ticketing/infrastructure/event-handlers`.
- **Evidencia**: `test/architecture`, `close-event-sales.handler.spec.ts`, e2e *cross-context event*.
- **Estado**: **CUMPLE**. Limitación documentada: consistencia eventual sin outbox (TD-001).

## 9. Configuración y seguridad (5)
- **Requisitos**: variables validadas al arrancar; `.env.example`; `.env` ignorado; sin secretos; `process.env` solo en config; datos sensibles protegidos.
- **Implementación**: `validateEnv` sin defaults (incluye `TICKET_CODE_SECRET` ≥ 32); códigos de entrada como HMAC; `helmet`; BD solo en `127.0.0.1`; `logging: false`.
- **Evidencia**: `env.validation.spec.ts`, `hmac-ticket-code-hasher.spec.ts`, e2e de códigos y de cabeceras; `docs/audit-checklist.md`.
- **Estado**: **CUMPLE**. Fuera de alcance documentado: autenticación y rate limiting (TD-004, TD-007). `pnpm audit` (solo desarrollo) reporta `braces` sin parche publicado (TD-014).

## 10. Documentación (5)
- **Requisitos**: README que permita levantar el proyecto desde cero; reglas con IDs estables enlazadas al código; decisiones con el porqué.
- **Implementación**: README completo; `docs/EMPIEZA-AQUI.md`; `docs/guia-paso-a-paso.md`; RN-001…RN-015 con archivo y pruebas; 12 ADRs; deuda técnica; auditoría.
- **Evidencia**: instalación desde cero siguiendo solo el README.
- **Estado**: **CUMPLE**.

## Pendiente de validación
- Ejecución en **Windows/macOS**: solo se probó en Linux.
- Revisión del historial de Git por parte del evaluador.
