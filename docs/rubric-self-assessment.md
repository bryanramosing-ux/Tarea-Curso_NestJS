# Autoevaluación contra la rúbrica

Auditoría criterio por criterio. **No** es una nota: indica si existe evidencia
verificable de cada requisito. Estados: `CUMPLE`, `PARCIAL`, `NO CUMPLE`.

## Evidencia de ejecución (instalación desde cero)

Realizada sobre un **clon limpio** del repositorio, con el volumen de Docker borrado,
siguiendo solo el README:

| Paso | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `pnpm migration:run` **sin** `.env` | Falla al arrancar: `Invalid environment configuration (check your .env)` (esperado) |
| `cp .env.example .env` + `docker compose up -d --wait` | `kanban-postgres Healthy` |
| `pnpm migration:run` | 2 migraciones ejecutadas |
| `pnpm test` | 25 suites, **180 pruebas en verde** |
| `pnpm test:e2e` | 3 suites, **35 pruebas en verde** |
| `pnpm build` + `node dist/main` + `POST /users` | `Kanban API listening on port 3000` → `201 {"id": …}` |

## Comprobaciones específicas (sección de autoevaluación de la rúbrica)

| # | Comprobación | Resultado | Cómo se verifica |
|---|---|---|---|
| 1 | `grep -rn "@nestjs\|typeorm\|class-validator" src/*/domain/` vacío | ✅ vacío | grep + `test/architecture` |
| 2 | Ningún value object con constructor público | ✅ | grep + `test/architecture` |
| 3 | Entidad de dominio ≠ entidad ORM | ✅ `User`/`UserOrmEntity`, `Task`/`TaskOrmEntity` | `*.mapper.spec.ts` |
| 4 | Existe mapper | ✅ `user.mapper.ts`, `task.mapper.ts` | `test/architecture` |
| 5 | Existe repositorio en memoria | ✅ `in-memory-user.repository.ts`, `in-memory-task.repository.ts` | `test/architecture` |
| 6 | Ningún controlador importa repositorios | ✅ | `test/architecture` |
| 7 | El dominio no lanza excepciones de Nest | ✅ | `test/architecture` |
| 8 | `synchronize = false` | ✅ | `test/architecture`, e2e `runs against the isolated test database` |
| 9 | Ningún `domain/` importa otro `domain/` | ✅ | `test/architecture` |
| 10 | Eventos publicados después de persistir | ✅ | Espías en tests de handlers + regla estática |
| 11 | `process.env` solo en configuración | ✅ | `test/architecture` |
| 12 | `pnpm test` | ✅ 180/180 | ejecución |
| 13 | `pnpm test:e2e` | ✅ 35/35 | ejecución |
| 14 | Instalación desde cero siguiendo el README | ✅ | ver tabla anterior |

## Faltas graves

| Falta grave | Estado |
|---|---|
| `@Entity`/`@Column` en entidades o VOs de dominio | No existe (solo en `*.orm-entity.ts`) |
| Archivo de `domain/` que importa `@nestjs/*` | No existe |
| Controlador que accede al repositorio sin caso de uso | No existe (solo `CommandBus`/`QueryBus`) |
| Contraseñas o hashes en respuestas HTTP o logs | No existe (vistas campo a campo, `[REDACTED]`, `logging: false`; probado en unitarias y e2e) |
| Secretos committeados | No existe (`.env` ignorado; `.env.example` con valores de ejemplo) |
| Tests desactivados con `skip` | No existe (regla automática) |
| Tests manipulados para pasar | No: las aserciones se validaron con controles negativos (un matcher que debía fallar falló; mutaciones de arquitectura detectadas) |

---

## 1. Arquitectura hexagonal y regla de dependencias (15)

- **Requisitos**: `domain/`, `application/`, `infrastructure/` por contexto; dominio sin NestJS/TypeORM/class-validator; dependencias hacia dentro.
- **Implementación**: `src/users/*`, `src/tasks/*`; puertos en `domain/ports` con token `Symbol`; módulos Nest como composition root.
- **Archivos**: `src/users/users.module.ts`, `src/tasks/tasks.module.ts`, `src/*/domain/ports/*.ts`.
- **Evidencia**: `test/architecture/architecture.spec.ts` (bloques *bounded contexts* y *dependency rule*).
- **Estado**: **CUMPLE**.

## 2. Modelo de dominio: entidades y value objects (15)

- **Requisitos**: entidades con identidad y comportamiento; VOs que se validan y normalizan; `equals()`; `fromPrimitives()` revalida.
- **Implementación**: `User` (`register`, `deactivate`), `Task` (`create`, `assignTo`, `changeStatus`, `releaseAssignee`); 13 VOs con constructor privado + factory.
- **Archivos**: `src/*/domain/entities/*.ts`, `src/*/domain/value-objects/*.ts`.
- **Evidencia**: `user.spec.ts`, `task.spec.ts`, `*.spec.ts` de VOs (casos de reconstrucción corrupta incluidos).
- **Estado**: **CUMPLE**.

## 3. Puertos y adaptadores (15)

- **Requisitos**: puertos en `domain/ports`; ≥2 adaptadores del repositorio (memoria y real); entidad ORM distinta; mapper; adaptador sin reglas, `null` si no encuentra.
- **Implementación**: `UserRepository`, `TaskRepository`, `PasswordHasher`, `TeamMemberDirectory`, `DomainEventPublisher`; adaptadores TypeORM, en memoria, scrypt, ACL, EventBus.
- **Archivos**: `src/*/infrastructure/persistence/**`, `src/tasks/infrastructure/adapters/**`, `src/users/infrastructure/security/**`.
- **Evidencia**: `in-memory-user.repository.spec.ts`, `*.mapper.spec.ts`, `users-team-member-directory.adapter.spec.ts`, e2e.
- **Estado**: **CUMPLE**.

## 4. Casos de uso y CQRS (10)

- **Requisitos**: comandos y consultas separados; controladores delgados con buses; handlers que orquestan.
- **Implementación**: 6 comandos (`CreateUser`, `DeactivateUser`, `CreateTask`, `AssignTask`, `ChangeTaskStatus`, `ReleaseMemberTasks`) y 3 consultas (`GetUser`, `GetTask`, `ListTasks`), cada uno en su carpeta.
- **Archivos**: `src/*/application/{commands,queries}/**`, `src/*/infrastructure/http/*.controller.ts`.
- **Evidencia**: tests de handlers sin Nest; regla de controladores en `test/architecture`.
- **Estado**: **CUMPLE**.

## 5. Manejo de errores y validación (10)

- **Requisitos**: excepción de dominio con código estable y tipo; dominio sin HTTP; filtro único; validación en dos niveles (`whitelist`, `forbidNonWhitelisted`).
- **Implementación**: `DomainException { code, kind }`, `DomainExceptionFilter` con switch exhaustivo, `createValidationPipe()`.
- **Archivos**: `src/shared/domain/domain-exception.ts`, `src/shared/infrastructure/http/*`, `docs/business-rules/error-catalog.md`.
- **Evidencia**: `domain-exception.filter.spec.ts`; e2e de 400 (DTO y dominio), 404 y 409.
- **Estado**: **CUMPLE**.

## 6. Pruebas (10)

- **Requisitos**: unitarias sin Nest ni BD; e2e con base real y migraciones reales; en verde.
- **Implementación**: 180 unitarias/arquitectura; 35 e2e con `global-setup` que aplica migraciones reales.
- **Archivos**: `src/**/*.spec.ts`, `test/architecture/`, `test/e2e/`.
- **Evidencia**: ejecución desde cero (tabla inicial).
- **Estado**: **CUMPLE**.

## 7. Persistencia y migraciones (8)

- **Requisitos**: migraciones, `synchronize: false`, config compartida app/CLI, restricciones de BD, Docker Compose funcional.
- **Implementación**: 2 migraciones con `up/down`; `buildDataSourceOptions` compartido; UNIQUE, FK, CHECK, índices; `docker-compose.yml` con healthcheck.
- **Archivos**: `src/database/migrations/*`, `src/config/database.config.ts`, `src/config/typeorm.data-source.ts`, `docker-compose.yml`.
- **Evidencia**: `migrations.e2e-spec.ts` (restricciones presentes, `down()` reversible), e2e de concurrencia sobre email, CHECK y FK.
- **Estado**: **CUMPLE**.

## 8. Contextos acotados y eventos de dominio (7)

- **Requisitos**: ≥2 contextos con lectura y escritura; sin importar el dominio ajeno; eventos en pasado publicados tras persistir; oyentes externos en infraestructura.
- **Implementación**: Users y Tasks; ACL `UsersTeamMemberDirectory`; 6 eventos; oyente `ReleaseTasksOnUserDeactivatedListener` en `tasks/infrastructure/event-handlers`.
- **Archivos**: `docs/architecture/bounded-contexts.md`, `docs/architecture/domain-events.md`.
- **Evidencia**: `test/architecture`, `release-member-tasks.handler.spec.ts`, e2e `cross-context event`.
- **Estado**: **CUMPLE**. Limitación documentada: consistencia eventual sin outbox (TD-001).

## 9. Configuración y seguridad (5)

- **Requisitos**: variables de entorno validadas al arrancar; `.env.example`; `.env` ignorado; sin secretos; `process.env` solo en config; contraseñas hasheadas y nunca expuestas.
- **Implementación**: `validateEnv` sin defaults; scrypt; vistas sin hash; `[REDACTED]`; `logging: false`.
- **Archivos**: `src/config/*`, `.env.example`, `.gitignore`, `src/users/infrastructure/security/scrypt-password-hasher.ts`.
- **Evidencia**: `env.validation.spec.ts`, `scrypt-password-hasher.spec.ts`, e2e `never returns or stores the password in clear text`, arranque sin `.env` falla.
- **Estado**: **CUMPLE**. Fuera de alcance documentado: autenticación (TD-005).

## 10. Documentación (5)

- **Requisitos**: README que permita levantar el proyecto desde cero; reglas con IDs estables enlazadas al código; decisiones con el porqué.
- **Implementación**: README (requisitos → instalación → Docker → migraciones → tests → endpoints → arquitectura → problemas conocidos); `docs/business-rules` (RN-001…RN-014 con archivo y pruebas); 10 ADRs; deuda técnica.
- **Evidencia**: instalación desde cero siguiendo solo el README.
- **Estado**: **CUMPLE**.

## Pendiente de validación

- Ejecución en **Windows/macOS**: solo se probó en Linux (los comandos del README
  indican la alternativa de PowerShell para copiar el `.env`).
- Revisión del historial de Git por parte del evaluador.
