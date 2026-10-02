# Kanban API — NestJS + Arquitectura Hexagonal + DDD táctico + CQRS

API REST interna de una pequeña startup para gestionar el trabajo del equipo en un
**tablero Kanban**: alta y baja de miembros, creación de tareas, asignación de
responsables y movimiento de tarjetas entre columnas (`TODO → IN_PROGRESS → IN_REVIEW → DONE`).

El proyecto está construido con **arquitectura hexagonal (puertos y adaptadores)**,
**DDD táctico** (agregados, value objects, eventos de dominio) y **CQRS**
(`CommandBus` / `QueryBus` de `@nestjs/cqrs`), con **PostgreSQL + TypeORM**
gestionado exclusivamente por **migraciones**.

---

## Índice

1. [Requisitos](#1-requisitos)
2. [Instalación desde cero](#2-instalación-desde-cero)
3. [Configuración (`.env`)](#3-configuración-env)
4. [Base de datos con Docker](#4-base-de-datos-con-docker)
5. [Migraciones](#5-migraciones)
6. [Levantar la aplicación](#6-levantar-la-aplicación)
7. [Pruebas](#7-pruebas)
8. [Endpoints](#8-endpoints)
9. [Arquitectura](#9-arquitectura)
10. [Bounded contexts](#10-bounded-contexts)
11. [Reglas de negocio](#11-reglas-de-negocio)
12. [Decisiones importantes](#12-decisiones-importantes)
13. [Estructura del proyecto](#13-estructura-del-proyecto)
14. [Problemas conocidos y solución de problemas](#14-problemas-conocidos-y-solución-de-problemas)
15. [Detener / reiniciar la base de datos](#15-detener--reiniciar-la-base-de-datos)
16. [Historial de Git](#16-historial-de-git)

---

## 1. Requisitos

| Herramienta | Versión probada | Comprobar con |
|---|---|---|
| Node.js | 20 o superior (probado con 22.22) | `node -v` |
| pnpm | 10.x (probado con 10.28) | `pnpm -v` |
| Docker + Docker Compose v2 | Docker 29, Compose v2 | `docker compose version` |
| Git | cualquiera reciente | `git --version` |

> Si no tienes pnpm: `corepack enable` (incluido con Node) o `npm install -g pnpm`.

El puerto **5432** (PostgreSQL) y el **3000** (API) deben estar libres, o cambia
`DB_PORT` / `PORT` en el `.env`.

## 2. Instalación desde cero

```bash
git clone https://github.com/bryanramosing-ux/Tarea-Curso_NestJS.git
cd Tarea-Curso_NestJS

pnpm install                # 1. dependencias
cp .env.example .env        # 2. configuración (ver sección 3)
docker compose up -d --wait # 3. PostgreSQL (espera a que esté "healthy")
pnpm migration:run          # 4. crea las tablas con las migraciones
pnpm start:dev              # 5. API en http://localhost:3000

pnpm test                   # pruebas unitarias + arquitectura (sin BD)
pnpm test:e2e               # pruebas e2e contra PostgreSQL real
```

En Windows (PowerShell) usa `Copy-Item .env.example .env` en lugar de `cp`.

## 3. Configuración (`.env`)

Toda la configuración sale de variables de entorno. `.env` **no se versiona**
(está en `.gitignore`); el repositorio solo incluye `.env.example`.

| Variable | Obligatoria | Descripción | Ejemplo |
|---|---|---|---|
| `NODE_ENV` | sí | `development`, `production` o `test` | `development` |
| `PORT` | sí | Puerto HTTP de la API | `3000` |
| `DB_HOST` | sí | Host de PostgreSQL | `localhost` |
| `DB_PORT` | sí | Puerto de PostgreSQL (también lo publica Docker) | `5432` |
| `DB_USER` | sí | Usuario de PostgreSQL (Docker lo crea) | `kanban` |
| `DB_PASSWORD` | sí | Contraseña de PostgreSQL (Docker la asigna) | *elige una* |
| `DB_NAME` | sí | Base de datos de desarrollo | `kanban` |
| `DB_NAME_TEST` | solo para `pnpm test:e2e` | Base aislada para e2e (se crea sola) | `kanban_test` |

- La configuración se **valida al arrancar** (`src/config/env.validation.ts`).
  Si falta una variable o tiene un valor inválido, la aplicación y el CLI de
  migraciones **fallan inmediatamente** con un mensaje que nombra la variable
  (nunca muestra su valor). No hay valores por defecto ocultos.
- `docker-compose.yml` lee **el mismo `.env`**, así que la base se crea con
  exactamente las credenciales que usará la API.
- Solo `src/config/` lee `process.env`; el resto usa `ConfigService`.

## 4. Base de datos con Docker

```bash
docker compose up -d --wait   # levanta postgres:16-alpine y espera el healthcheck
docker compose ps             # debe mostrar kanban-postgres (healthy)
```

Los datos persisten en el volumen `kanban-postgres-data`.

## 5. Migraciones

El esquema **solo** se crea con migraciones versionadas (`synchronize: false` siempre).
App y CLI comparten la misma configuración (`src/config/database.config.ts`).

```bash
pnpm migration:run      # aplica las migraciones pendientes
pnpm migration:show     # lista migraciones ([X] = aplicada)
pnpm migration:revert   # deshace la última migración (down)
```

Migraciones incluidas (`src/database/migrations/`):

| Migración | Crea |
|---|---|
| `1759363200000-CreateUsersTable` | tabla `users`, PK, `UNIQUE (email)` (`uq_users_email`), `CHECK` de estado |
| `1759363260000-CreateTasksTable` | tabla `tasks`, PK, FK `assignee_id → users(id)`, `CHECK`s de estado/prioridad/responsable, índices |
| `1759413600000-AddOptimisticLockingVersion` | columna `version` (bloqueo optimista) en `users` y `tasks` |

> Si ya tenías la base creada antes de esta migración, ejecuta `pnpm migration:run` de nuevo.

Para crear una nueva: `pnpm typeorm migration:create src/database/migrations/NombreMigracion`
y regístrala en `src/database/migrations/index.ts` (lista explícita).

## 6. Levantar la aplicación

```bash
pnpm start:dev          # desarrollo con recarga
# o bien, compilado:
pnpm build
pnpm start:prod         # node dist/main
pnpm migration:run:prod # migraciones usando el build compilado (dist/)
```

Salida esperada: `Kanban API listening on port 3000`.

Prueba rápida:

```bash
curl -s -X POST localhost:3000/users -H 'Content-Type: application/json' \
  -d '{"name":"Ana Pérez","email":"ana@startup.io","password":"secret123"}'
# {"id":"<uuid>"}
```

## 7. Pruebas

```bash
pnpm test        # unitarias + reglas de arquitectura (sin Nest, sin BD) — 194 pruebas
pnpm test:e2e    # e2e con PostgreSQL real y migraciones reales — 45 pruebas
pnpm test:cov    # cobertura de las unitarias
pnpm typecheck   # verificación de tipos (incluye tests)
```

- **Unitarias** (`src/**/*.spec.ts`): value objects, entidades, handlers
  instanciados **a mano** con los adaptadores en memoria, mappers, hasher,
  filtro de errores y validación de entorno.
- **Arquitectura** (`test/architecture/architecture.spec.ts`): automatiza las
  comprobaciones de la rúbrica (el dominio no importa NestJS/TypeORM/
  class-validator, ningún dominio importa a otro contexto, controladores solo
  usan los buses, `process.env` solo en `src/config`, `synchronize` nunca `true`,
  eventos publicados después de `save`, ningún test con `skip`/`only`...).
- **E2E** (`test/e2e/`): requieren la base levantada (`docker compose up -d --wait`).
  Antes de ejecutarse, `test/e2e/support/global-setup.ts` fuerza `NODE_ENV=test`,
  crea `DB_NAME_TEST` si no existe, **la vacía y aplica las migraciones reales
  desde cero**. Nunca tocan la base de desarrollo. Cubren 200/201/204, 400, 404
  y 409, la concurrencia sobre el email único, el bloqueo optimista, el evento entre
  contextos, el endurecimiento HTTP y la reversibilidad (`down()`) de las migraciones.

## 8. Endpoints

Todas las respuestas son JSON. Todos los errores tienen la forma
`{ statusCode, code, message, path, timestamp }`: errores de dominio (p. ej. `TASK_NOT_FOUND`),
de validación del DTO o del id (`REQUEST_VALIDATION_FAILED`) y del framework
(`BAD_REQUEST` para JSON mal formado, `ROUTE_NOT_FOUND`). Si otra petición modificó el mismo
recurso a la vez, se responde `409 *_CONCURRENT_MODIFICATION` (reintenta). Catálogo completo en [`docs/business-rules/error-catalog.md`](docs/business-rules/error-catalog.md).

### Contexto Users

| Método | Ruta | Tipo | Cuerpo | Respuesta |
|---|---|---|---|---|
| `POST` | `/users` | Comando `CreateUser` | `{ name, email, password }` | `201 { id }` · 400 · 409 |
| `GET` | `/users/:id` | Consulta `GetUser` | — | `200 UserView` · 400 · 404 |
| `POST` | `/users/:id/deactivate` | Comando `DeactivateUser` | — | `204` · 400 · 404 · 409 |

`UserView = { id, name, email, status, createdAt, updatedAt }` — **nunca** incluye contraseña ni hash.

### Contexto Tasks

| Método | Ruta | Tipo | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| `POST` | `/tasks` | Comando `CreateTask` | `{ title, description?, priority? }` | `201 { id }` · 400 |
| `GET` | `/tasks` | Consulta `ListTasks` | `?status=&assigneeId=` | `200 TaskView[]` · 400 |
| `GET` | `/tasks/:id` | Consulta `GetTask` | — | `200 TaskView` · 400 · 404 |
| `PATCH` | `/tasks/:id/assignee` | Comando `AssignTask` | `{ assigneeId }` | `204` · 400 · 404 · 409 |
| `PATCH` | `/tasks/:id/status` | Comando `ChangeTaskStatus` | `{ status }` | `204` · 400 · 404 · 409 |

`TaskView = { id, title, description, status, priority, assigneeId, createdAt, updatedAt }`.

Ejemplo de flujo completo:

```bash
API=localhost:3000; H='Content-Type: application/json'
ANA=$(curl -s -X POST $API/users -H "$H" -d '{"name":"Ana","email":"ana@startup.io","password":"secret123"}' | sed 's/.*"id":"\([^"]*\)".*/\1/')
TASK=$(curl -s -X POST $API/tasks -H "$H" -d '{"title":"Preparar demo","priority":"HIGH"}' | sed 's/.*"id":"\([^"]*\)".*/\1/')
curl -s -X PATCH $API/tasks/$TASK/assignee -H "$H" -d "{\"assigneeId\":\"$ANA\"}"   # 204
curl -s -X PATCH $API/tasks/$TASK/status   -H "$H" -d '{"status":"IN_PROGRESS"}'      # 204
curl -s -X PATCH $API/tasks/$TASK/status   -H "$H" -d '{"status":"DONE"}'             # 409 TASK_INVALID_STATUS_TRANSITION
curl -s "$API/tasks?status=IN_PROGRESS"
curl -s -X POST $API/users/$ANA/deactivate                                            # 204 → la tarea vuelve a TODO sin responsable
```

## 9. Arquitectura

```
          HTTP (controllers, DTOs, ValidationPipe, DomainExceptionFilter)
                 │  CommandBus / QueryBus
                 ▼
   ┌──────────────────────────────┐
   │ application/                 │  commands/, queries/ (handlers que ORQUESTAN)
   │   depende solo de PUERTOS    │  views/ (modelos de lectura)
   └──────────────┬───────────────┘
                  ▼
   ┌──────────────────────────────┐
   │ domain/                      │  entities/, value-objects/, events/, errors/, ports/
   │   TypeScript puro            │  (sin NestJS, TypeORM ni class-validator)
   └──────────────────────────────┘
                  ▲ implementan los puertos
   infrastructure/ persistence/typeorm (adaptador real + mapper + *.orm-entity.ts)
                   persistence/in-memory (adaptador para pruebas)
                   security/ (scrypt), adapters/ (ACL entre contextos), event-handlers/
```

- **Regla de dependencias**: `infrastructure → application → domain`. El dominio no
  conoce frameworks ni HTTP. Verificado automáticamente por la prueba de arquitectura.
- **Puertos** en `domain/ports/` (interfaz + token `Symbol`), **adaptadores** en
  `infrastructure/`. El módulo Nest de cada contexto decide qué adaptador concreto
  satisface cada puerto.
- **CQRS**: los controladores solo despachan comandos/consultas por los buses. Los
  handlers cargan → delegan al dominio → persisten → **publican eventos después de persistir**.
- **Errores**: `DomainException { code, kind }` con `kind ∈ VALIDATION | NOT_FOUND | CONFLICT`;
  un único filtro (`DomainExceptionFilter`) los traduce a 400/404/409.
- **Validación en dos niveles**: DTO + `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`)
  en el borde; value objects e invariantes de las entidades en el dominio.

Detalle: [`docs/architecture/overview.md`](docs/architecture/overview.md).

## 10. Bounded contexts

| Contexto | Responsabilidad | Agregado | Escritura | Lectura |
|---|---|---|---|---|
| **Users** | Identidad y disponibilidad de los miembros del equipo | `User` | `CreateUser`, `DeactivateUser` | `GetUser` |
| **Tasks** | Tablero Kanban: tarjetas, flujo de estados, responsables | `Task` | `CreateTask`, `AssignTask`, `ChangeTaskStatus`, `ReleaseMemberTasks` (interno) | `GetTask`, `ListTasks` |

- `tasks/domain` **no importa** nada de `users/`. Tasks define su propio puerto
  `TeamMemberDirectory` y su propio modelo (`AssigneeId`, `TeamMember`); el adaptador
  `UsersTeamMemberDirectory` (ACL) consulta Users vía `QueryBus` + `GetUserQuery`.
- Evento entre contextos: `UserDeactivated` (Users) → oyente
  `ReleaseTasksOnUserDeactivatedListener` en `tasks/infrastructure` → comando
  `ReleaseMemberTasks` (las tareas no terminadas vuelven a `TODO` sin responsable).

Detalle: [`docs/architecture/bounded-contexts.md`](docs/architecture/bounded-contexts.md).

## 11. Reglas de negocio

Resumen (catálogo completo con enlaces al código y a las pruebas en
[`docs/business-rules/business-rules.md`](docs/business-rules/business-rules.md)):

| ID | Regla |
|---|---|
| RN-001 | El email debe ser válido; se normaliza (trim + minúsculas). |
| RN-002 | El email es único entre usuarios (también ante concurrencia: `UNIQUE` en BD). |
| RN-003 | El nombre tiene 2–80 caracteres; se normalizan espacios. |
| RN-004 | Contraseña de 8–72 caracteres con letra y dígito; se guarda solo su hash (scrypt) y nunca se expone. |
| RN-005 | Solo un usuario activo puede desactivarse. |
| RN-006 | El título de una tarea tiene 3–120 caracteres. |
| RN-007 | La descripción es opcional, máximo 2000 caracteres. |
| RN-008 | Una tarea nace en `TODO`, sin responsable y con prioridad `MEDIUM` por defecto. |
| RN-009 | Flujo Kanban: `TODO→IN_PROGRESS`, `IN_PROGRESS→TODO/IN_REVIEW`, `IN_REVIEW→IN_PROGRESS/DONE`. |
| RN-010 | Fuera de `TODO` una tarea siempre tiene responsable. |
| RN-011 | Solo se asigna a un miembro existente (404) y activo (409). |
| RN-012 | Una tarea `DONE` es inmutable. |
| RN-013 | Al desactivar un miembro, sus tareas no terminadas quedan sin responsable y vuelven a `TODO`. |
| RN-014 | Prioridad ∈ `LOW`, `MEDIUM`, `HIGH`. |

## 12. Decisiones importantes

Registradas como ADR (con el *por qué*) en [`docs/decisions/`](docs/decisions/README.md):
hexagonal + DDD + CQRS, separación Users/Tasks, excepciones de dominio con filtro
único, entidades ORM separadas + mappers, migraciones con `synchronize: false`,
comunicación entre contextos (ACL + eventos), scrypt para contraseñas, configuración
fail-fast y estrategia de pruebas.

## 13. Estructura del proyecto

```
.
├── docker-compose.yml            # PostgreSQL 16 (lee el mismo .env)
├── .env.example                  # plantilla de configuración (sin secretos reales)
├── docs/                         # arquitectura, reglas de negocio, ADRs, deuda técnica, autoevaluación
├── src/
│   ├── main.ts / app.module.ts / app.setup.ts
│   ├── config/                   # ÚNICO lugar que lee process.env
│   │   ├── env.validation.ts     # validación fail-fast
│   │   ├── database.config.ts    # opciones TypeORM compartidas app + CLI
│   │   └── typeorm.data-source.ts# DataSource del CLI de migraciones
│   ├── database/
│   │   ├── migrations/           # migraciones versionadas (up/down)
│   │   └── orm-entities.ts
│   ├── shared/                   # shared kernel
│   │   ├── domain/               # DomainException, AggregateRoot, DomainEvent, puerto DomainEventPublisher
│   │   └── infrastructure/       # filtro HTTP, ValidationPipe, publicador de eventos (Nest / en memoria)
│   ├── users/
│   │   ├── domain/{entities,value-objects,events,errors,ports}
│   │   ├── application/{commands,queries,views}
│   │   ├── infrastructure/{http,persistence/{typeorm,in-memory},security}
│   │   └── users.module.ts
│   └── tasks/
│       ├── domain/{entities,value-objects,events,errors,ports}
│       ├── application/{commands,queries,views}
│       ├── infrastructure/{http,persistence/{typeorm,in-memory},adapters,event-handlers}
│       └── tasks.module.ts
└── test/
    ├── architecture/             # reglas de arquitectura (corren con pnpm test)
    ├── e2e/                      # pruebas e2e + global-setup (migraciones reales)
    └── jest-e2e.json
```

## 14. Problemas conocidos y solución de problemas

| Síntoma | Causa / solución |
|---|---|
| `Invalid environment configuration (check your .env)` | Falta `.env` o alguna variable. `cp .env.example .env` y revisa los valores. |
| `ECONNREFUSED 127.0.0.1:5432` | La base no está levantada: `docker compose up -d --wait`. |
| `port is already allocated` al levantar Docker | Otro PostgreSQL usa el 5432: cambia `DB_PORT` en `.env` (Compose y la app lo leen). |
| `password authentication failed` tras cambiar `DB_PASSWORD` | Postgres solo aplica las credenciales al crear el volumen: `docker compose down -v` y vuelve a levantar (borra los datos). |
| `relation "users" does not exist` | Faltan las migraciones: `pnpm migration:run`. |
| Los e2e fallan con `DB_NAME_TEST` | Debe estar definida en `.env` y ser distinta de `DB_NAME` (los e2e vacían esa base). |

Auditoría de seguridad, bugs y checklist completo: [`docs/audit-checklist.md`](docs/audit-checklist.md).

Limitaciones conocidas (detalle en [`docs/technical-debt.md`](docs/technical-debt.md)):
no hay autenticación (el hash se guarda para un futuro login); la liberación de tareas
al desactivar un usuario es **eventualmente consistente** (EventBus en memoria, sin outbox);
los listados no están paginados.

## 15. Detener / reiniciar la base de datos

```bash
docker compose stop           # detener (conserva datos)
docker compose start          # volver a arrancar
docker compose restart        # reiniciar
docker compose down           # eliminar el contenedor (conserva el volumen/datos)
docker compose down -v        # eliminar contenedor Y datos (reinicio total)
docker compose up -d --wait && pnpm migration:run   # recrear desde cero
docker compose logs -f postgres                     # ver logs
```

## 16. Historial de Git

El proyecto se construyó con commits progresivos por capa (`git log --oneline`):
scaffold → dominio Users → dominio Tasks → CQRS → adaptadores → configuración,
migraciones y Docker → pruebas unitarias y de arquitectura → e2e → documentación.
Convención usada: [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
