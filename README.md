# Ticketing API — Venta de entradas para eventos

**NestJS + Arquitectura Hexagonal + DDD táctico + CQRS**

> 🚀 ¿Primera vez? Empieza por [`docs/EMPIEZA-AQUI.md`](docs/EMPIEZA-AQUI.md): de cero a la entrega, en orden.
>
> 📚 ¿Quieres aprender a construirlo tú mismo? Sigue la guía [`docs/guia-paso-a-paso.md`](docs/guia-paso-a-paso.md).

API REST para una pequeña productora de eventos: programa conciertos, obras o
conferencias, **vende entradas sin sobrevender nunca el aforo** (ni con cientos de
compradores a la vez), valida cada entrada en la puerta **una sola vez** y, si un
evento se cancela, **cierra la venta y reembolsa** automáticamente las entradas no usadas.

Construida con **arquitectura hexagonal (puertos y adaptadores)**, **DDD táctico**
(agregados, value objects, eventos de dominio), **CQRS** (`CommandBus` / `QueryBus` de
`@nestjs/cqrs`) y **PostgreSQL + TypeORM** gestionado exclusivamente por **migraciones**.

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

Los puertos **5432** (PostgreSQL) y **3000** (API) deben estar libres, o cambia
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

> ⚠️ **¿Venías de la versión Kanban?** El esquema cambió por completo. Borra la base
> anterior y vuelve a copiar el `.env` (hay una variable nueva, `TICKET_CODE_SECRET`):
> `docker compose down -v` → `cp .env.example .env` → `docker compose up -d --wait` → `pnpm migration:run`.

## 3. Configuración (`.env`)

Toda la configuración sale de variables de entorno. `.env` **no se versiona**
(está en `.gitignore`); el repositorio solo incluye `.env.example`.

| Variable | Obligatoria | Descripción | Ejemplo |
|---|---|---|---|
| `NODE_ENV` | sí | `development`, `production` o `test` | `development` |
| `PORT` | sí | Puerto HTTP de la API | `3000` |
| `DB_HOST` | sí | Host de PostgreSQL | `localhost` |
| `DB_PORT` | sí | Puerto de PostgreSQL (también lo publica Docker) | `5432` |
| `DB_USER` | sí | Usuario de PostgreSQL (Docker lo crea) | `ticketing` |
| `DB_PASSWORD` | sí | Contraseña de PostgreSQL (Docker la asigna) | *elige una* |
| `DB_NAME` | sí | Base de datos de desarrollo | `ticketing` |
| `DB_NAME_TEST` | solo para `pnpm test:e2e` | Base aislada para e2e (se crea sola) | `ticketing_test` |
| `TICKET_CODE_SECRET` | sí (≥ 32 caracteres) | Secreto del servidor para el HMAC de los códigos de entrada | *genera uno, ver abajo* |

Para generar un `TICKET_CODE_SECRET` propio:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- La configuración se **valida al arrancar** (`src/config/env.validation.ts`). Si falta
  una variable o tiene un valor inválido, la aplicación y el CLI de migraciones
  **fallan inmediatamente** con un mensaje que nombra la variable (nunca su valor).
  No hay valores por defecto ocultos.
- `docker-compose.yml` lee **el mismo `.env`**.
- Solo `src/config/` lee `process.env`; el resto usa `ConfigService`.

## 4. Base de datos con Docker

```bash
docker compose up -d --wait   # levanta postgres:16-alpine y espera el healthcheck
docker compose ps             # debe mostrar ticketing-postgres (healthy)
```

Los datos persisten en el volumen `ticketing-postgres-data`. La base solo escucha en
`127.0.0.1` (no es accesible desde otros equipos de tu red).

## 5. Migraciones

El esquema **solo** se crea con migraciones versionadas (`synchronize: false` siempre).
App y CLI comparten la misma configuración (`src/config/database.config.ts`).

```bash
pnpm migration:run      # aplica las migraciones pendientes
pnpm migration:show     # lista migraciones ([X] = aplicada)
pnpm migration:revert   # deshace la última migración (down)
```

| Migración | Crea |
|---|---|
| `1759536000000-CreateEventsTable` | tabla `events`: PK, índice **único** `(lower(venue), starts_at)`, `CHECK`s de aforo/precio/moneda/estado, columna `version` |
| `1759536060000-CreateTicketingTables` | `ticket_allocations` (cupo por evento, `CHECK sold <= capacity`) y `tickets` (`UNIQUE code_hash`, `CHECK` de estado/fecha de uso, FKs al evento) |

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

Salida esperada: `Ticketing API listening on port 3000`.

## 7. Pruebas

```bash
pnpm test        # unitarias + reglas de arquitectura (sin Nest, sin BD) — 189 pruebas
pnpm test:e2e    # e2e con PostgreSQL real y migraciones reales — 44 pruebas
pnpm test:cov    # cobertura de las unitarias
pnpm typecheck   # verificación de tipos (incluye tests)
```

- **Unitarias** (`src/**/*.spec.ts`): value objects, agregados, handlers instanciados
  **a mano** con adaptadores en memoria (incluidos los reintentos ante compras
  simultáneas), mappers, hasher HMAC, ACL entre contextos, filtro de errores y
  validación de entorno.
- **Arquitectura** (`test/architecture/architecture.spec.ts`): automatiza las
  comprobaciones de la rúbrica (el dominio no importa NestJS/TypeORM/class-validator,
  ningún dominio importa a otro contexto, controladores solo usan los buses,
  `process.env` solo en `src/config`, `synchronize` nunca `true`, eventos publicados
  después de `save`, ningún test con `skip`/`only`...).
- **E2E** (`test/e2e/`): requieren la base levantada. `global-setup.ts` fuerza
  `NODE_ENV=test`, crea `DB_NAME_TEST` si no existe, **la vacía y aplica las migraciones
  reales**. Cubren 200/201/204, 400, 404, 409 y 413, **30 compradores simultáneos para
  5 plazas** (se venden exactamente 5), el evento entre contextos, restricciones de la
  base, cabeceras de seguridad y la reversibilidad de las migraciones.

## 8. Endpoints

Todos los errores tienen la forma `{ statusCode, code, message, path, timestamp }`.
Catálogo completo de códigos en [`docs/business-rules/error-catalog.md`](docs/business-rules/error-catalog.md).

### Contexto Catálogo (eventos)

| Método | Ruta | Tipo | Cuerpo / query | Respuesta |
|---|---|---|---|---|
| `POST` | `/events` | Comando `ScheduleEvent` | `{ name, venue, startsAt, capacity, priceCents, currency }` | `201 { id }` · 400 · 409 |
| `GET` | `/events` | Consulta `ListEvents` | `?status=SCHEDULED\|CANCELLED` | `200 EventView[]` · 400 |
| `GET` | `/events/:id` | Consulta `GetEvent` | — | `200 EventView` · 400 · 404 |
| `POST` | `/events/:id/cancel` | Comando `CancelEvent` | — | `204` · 400 · 404 · 409 |

- `startsAt`: ISO 8601 **con zona horaria**, p. ej. `2027-03-20T21:00:00Z` o `2027-03-20T16:00:00-05:00`.
- `priceCents`: precio en céntimos (entero). `4500` = 45,00. `0` = gratis. `currency`: `PEN`, `USD` o `EUR`.

### Contexto Venta de entradas

| Método | Ruta | Tipo | Cuerpo | Respuesta |
|---|---|---|---|---|
| `POST` | `/tickets` | Comando `PurchaseTickets` | `{ eventId, quantity, holderName, holderEmail }` | `201 { eventId, tickets: [{ id, code }], total }` · 400 · 404 · 409 |
| `POST` | `/tickets/check-in` | Comando `CheckInTicket` | `{ code }` | `200 { id }` · 400 · 404 · 409 |
| `GET` | `/tickets/:id` | Consulta `GetTicket` | — | `200 TicketView` (sin código) · 400 · 404 |
| `GET` | `/tickets/availability/:eventId` | Consulta `GetEventAvailability` | — | `200 { capacity, sold, available, salesOpen, price }` · 400 · 404 |

> 🔐 El **código** de cada entrada (`XXXX-XXXX-XXXX`) se muestra **una sola vez**, en
> la respuesta de la compra. La base solo guarda su HMAC; ninguna otra respuesta lo devuelve.

### Ejemplo de flujo completo
```bash
API=localhost:3000; H='Content-Type: application/json'
EVENT=$(curl -s -X POST $API/events -H "$H" -d '{"name":"Rock en el Parque","venue":"Estadio Nacional","startsAt":"2027-03-20T21:00:00Z","capacity":3,"priceCents":4500,"currency":"PEN"}' | sed 's/.*"id":"\([^"]*\)".*/\1/')
curl -s -X POST $API/tickets -H "$H" -d "{\"eventId\":\"$EVENT\",\"quantity\":2,\"holderName\":\"Ana Pérez\",\"holderEmail\":\"ana@mail.com\"}"
#   → 201 {"tickets":[{"id":"…","code":"HJM7-EQNX-GXHY"},…],"total":{"amountCents":9000,"currency":"PEN"}}
curl -s -X POST $API/tickets -H "$H" -d "{\"eventId\":\"$EVENT\",\"quantity\":2,\"holderName\":\"Luis\",\"holderEmail\":\"luis@mail.com\"}"
#   → 409 TICKET_NOT_ENOUGH_AVAILABLE (solo queda 1)
curl -s -X POST $API/tickets/check-in -H "$H" -d '{"code":"HJM7-EQNX-GXHY"}'   # 200, y la segunda vez 409 TICKET_ALREADY_USED
curl -s -X POST $API/events/$EVENT/cancel                                      # 204 → la otra entrada pasa a REFUNDED
curl -s $API/tickets/availability/$EVENT                                       # salesOpen: false
```

## 9. Arquitectura

```
          HTTP (controllers, DTOs, ValidationPipe, filtros de errores, helmet)
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
                   security/ (HMAC), adapters/ (ACL entre contextos), event-handlers/
```

- **Regla de dependencias**: `infrastructure → application → domain`, verificada por una prueba automática.
- **Puertos** en `domain/ports/` (interfaz + token `Symbol`); **adaptadores** en `infrastructure/`.
  El módulo Nest de cada contexto decide qué adaptador satisface cada puerto.
- **CQRS**: los controladores solo despachan comandos/consultas. Los handlers cargan →
  delegan al dominio → persisten → **publican eventos después de persistir**.
- **Errores**: `DomainException { code, kind }` (`VALIDATION | NOT_FOUND | CONFLICT`); un
  único filtro (`DomainExceptionFilter`) los traduce a 400/404/409.
- **Validación en dos niveles**: DTO + `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`)
  en el borde; value objects e invariantes de los agregados en el dominio.
- **Concurrencia**: bloqueo optimista (columna `version`) en todos los agregados; la
  compra reintenta con espera aleatoria si otra compra cambió el cupo a la vez.

Detalle: [`docs/architecture/overview.md`](docs/architecture/overview.md).

## 10. Bounded contexts

| Contexto | Responsabilidad | Agregados | Escritura | Lectura |
|---|---|---|---|---|
| **Catálogo** (`src/catalog`) | Qué eventos hay: fecha, recinto, aforo, precio, estado | `Event` | `ScheduleEvent`, `CancelEvent` | `GetEvent`, `ListEvents` |
| **Venta de entradas** (`src/ticketing`) | Vender sin sobrevender, validar en la puerta, reembolsar | `TicketAllocation` (cupo por evento), `Ticket` | `PurchaseTickets`, `CheckInTicket`, `CloseEventSales` (interno) | `GetTicket`, `GetEventAvailability` |

- `ticketing/domain` **no importa** nada del catálogo. Tiene su propio puerto
  `EventCatalog` y su propio modelo (`EventReference`, `SaleableEvent`, `Money`); el
  adaptador `CatalogEventCatalog` (ACL) consulta el catálogo por `QueryBus` + `GetEventQuery`.
- Evento entre contextos: `EventCancelled` (Catálogo) → oyente
  `CloseSalesOnEventCancelledListener` en `ticketing/infrastructure` → comando
  `CloseEventSales` (cierra la venta y reembolsa las entradas no usadas).

Detalle: [`docs/architecture/bounded-contexts.md`](docs/architecture/bounded-contexts.md).

## 11. Reglas de negocio

Catálogo completo, con el código que las implementa y sus pruebas, en
[`docs/business-rules/business-rules.md`](docs/business-rules/business-rules.md).

| ID | Regla |
|---|---|
| RN-001 | El nombre del evento tiene 3–120 caracteres (espacios normalizados). |
| RN-002 | El recinto tiene 2–120 caracteres; "Estadio" y "estadio" son el mismo recinto. |
| RN-003 | Un evento solo se programa a futuro, con fecha ISO que incluya zona horaria. |
| RN-004 | El aforo es un entero entre 1 y 100.000. |
| RN-005 | El precio es un entero de céntimos entre 0 y 10.000.000, en PEN, USD o EUR. |
| RN-006 | Un recinto no puede tener dos eventos a la misma hora (garantizado por la BD). |
| RN-007 | Solo se cancela un evento programado que aún no ha empezado. |
| RN-008 | Se compran entre 1 y 10 entradas por operación. |
| RN-009 | **Nunca se venden más entradas que el aforo**, ni con compras simultáneas. |
| RN-010 | No se vende si la venta está cerrada (evento cancelado) o el evento ya empezó. |
| RN-011 | El titular tiene un nombre de 2–80 caracteres y un email válido. |
| RN-012 | Cada entrada tiene un código secreto único, mostrado una vez; solo se guarda su HMAC. |
| RN-013 | Una entrada se usa una sola vez; una reembolsada no es válida. |
| RN-014 | Al cancelar un evento se cierra la venta y se reembolsan las entradas no usadas. |
| RN-015 | Total = precio unitario × cantidad; cada entrada guarda el precio que se pagó. |

## 12. Decisiones importantes

Registradas como ADR (con el *por qué*) en [`docs/decisions/`](docs/decisions/README.md):
hexagonal + DDD + CQRS, separación Catálogo/Venta, errores de dominio con filtro único,
entidades ORM separadas + mappers, migraciones con `synchronize: false`, ACL + eventos
entre contextos, HMAC para los códigos de entrada, configuración fail-fast, estrategia de
pruebas, bloqueo optimista y el **cupo como agregado propio** (la pieza que impide sobrevender).

## 13. Estructura del proyecto

```
.
├── docker-compose.yml            # PostgreSQL 16 (lee el mismo .env, solo en 127.0.0.1)
├── .env.example                  # plantilla de configuración (sin secretos reales)
├── docs/                         # guías, arquitectura, reglas, ADRs, auditoría, deuda técnica
├── src/
│   ├── main.ts / app.module.ts / app.setup.ts
│   ├── config/                   # ÚNICO lugar que lee process.env
│   ├── database/                 # migraciones versionadas y registro de entidades ORM
│   ├── shared/                   # shared kernel: DomainException, AggregateRoot (con versión),
│   │                             #   DomainEvent, publicador de eventos, filtros HTTP
│   ├── catalog/
│   │   ├── domain/{entities,value-objects,events,errors,ports}
│   │   ├── application/{commands,queries,views}
│   │   ├── infrastructure/{http,persistence/{typeorm,in-memory}}
│   │   └── catalog.module.ts
│   └── ticketing/
│       ├── domain/{entities,value-objects,events,errors,ports}
│       ├── application/{commands,queries,views}
│       ├── infrastructure/{http,persistence/{typeorm,in-memory},security,adapters,event-handlers}
│       └── ticketing.module.ts
└── test/
    ├── architecture/             # reglas de arquitectura (corren con pnpm test)
    ├── e2e/                      # pruebas e2e + global-setup (migraciones reales)
    └── jest-e2e.json
```

## 14. Problemas conocidos y solución de problemas

| Síntoma | Causa / solución |
|---|---|
| `Invalid environment configuration (check your .env)` | Falta `.env` o alguna variable (p. ej. `TICKET_CODE_SECRET`). `cp .env.example .env`. |
| `ECONNREFUSED 127.0.0.1:5432` | La base no está levantada: `docker compose up -d --wait`. |
| `port is already allocated` | Otro PostgreSQL usa el 5432: cambia `DB_PORT` en `.env`. |
| `password authentication failed` tras cambiar `DB_PASSWORD` | Postgres aplica las credenciales al crear el volumen: `docker compose down -v` y vuelve a levantar. |
| `relation "events" does not exist` | Faltan las migraciones: `pnpm migration:run`. |
| `400 EVENT_INVALID_START` | La fecha debe incluir zona horaria: `…T21:00:00Z` o `…T16:00:00-05:00`. |
| `409 TICKET_SALES_CONCURRENT_MODIFICATION` | Muchísimas compras simultáneas agotaron los reintentos: vuelve a intentarlo. |
| `pnpm audit` reporta 1 vulnerabilidad *high* en `braces` | Solo en herramientas de desarrollo (Jest), sin versión corregida publicada; `pnpm audit --prod` = 0. Ver [`docs/audit-checklist.md`](docs/audit-checklist.md). |

Auditoría de seguridad y bugs: [`docs/audit-checklist.md`](docs/audit-checklist.md).
Limitaciones conocidas: [`docs/technical-debt.md`](docs/technical-debt.md) (sin autenticación,
sin pasarela de pago real, eventos en memoria sin outbox, listados sin paginar).

## 15. Detener / reiniciar la base de datos

```bash
docker compose stop           # detener (conserva datos)
docker compose start          # volver a arrancar
docker compose down           # eliminar el contenedor (conserva el volumen/datos)
docker compose down -v        # eliminar contenedor Y datos (reinicio total)
docker compose up -d --wait && pnpm migration:run   # recrear desde cero
docker compose logs -f postgres                     # ver logs
```

## 16. Historial de Git

Commits progresivos por capa (`git log --oneline`), con [Conventional Commits](https://www.conventionalcommits.org/).
El proyecto empezó como un tablero Kanban y se migró a venta de entradas; la versión
Kanban sigue disponible en el historial (commit `8ee58fd`).
