# Ticketing API — Venta de entradas para eventos

**NestJS + Arquitectura Hexagonal + DDD táctico + CQRS**

> 🚀 ¿Primera vez? Empieza por [`docs/EMPIEZA-AQUI.md`](docs/EMPIEZA-AQUI.md): de cero a la entrega, en orden.
> 🐧 ¿Usas Linux? Sigue [`docs/EMPIEZA-AQUI-LINUX.md`](docs/EMPIEZA-AQUI-LINUX.md): instalación por terminal y pruebas con `curl`.
>
> 📚 ¿Quieres aprender a construirlo tú mismo? Sigue la guía [`docs/guia-paso-a-paso.md`](docs/guia-paso-a-paso.md).

API REST para una pequeña productora de eventos: programa conciertos, obras o
conferencias, **vende entradas sin sobrevender nunca el aforo** (ni con cientos de
compradores a la vez), valida cada entrada en la puerta **una sola vez, solo para su
evento y en horario de puertas** y, si un evento se cancela, **cierra la venta y
reembolsa** automáticamente las entradas no usadas. Las operaciones del personal
(organizador y puerta) exigen una **clave de API**, y las rutas tienen **límite de
peticiones** por IP.

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

> ⚠️ **¿Ya tenías el proyecto clonado?** Hay variables nuevas en `.env.example`
> (`ORGANIZER_API_KEY`, `GATE_API_KEY`, `THROTTLE_*`, `TRUST_PROXY`) y una migración
> nueva. Vuelve a copiar el `.env` (`cp .env.example .env`) y ejecuta `pnpm migration:run`.
> Si venías de la versión Kanban, borra también la base: `docker compose down -v`.

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
| `ORGANIZER_API_KEY` | sí (≥ 32 caracteres) | Clave del rol **organizador**: programar/cancelar eventos, consultar entradas, conciliar ventas | *genera una* |
| `GATE_API_KEY` | sí (≥ 32, distinta de la anterior) | Clave del rol **puerta**: check-in y consulta de entradas | *genera una* |
| `THROTTLE_TTL_SECONDS` | sí (1–3600) | Ventana del límite de peticiones, en segundos | `60` |
| `THROTTLE_LIMIT` | sí | Peticiones por IP, ruta y ventana en cualquier ruta | `120` |
| `THROTTLE_SENSITIVE_LIMIT` | sí (≤ `THROTTLE_LIMIT`) | Peticiones por IP y ventana en compra y check-in | `20` |
| `TRUST_PROXY` | sí (`true`/`false`) | `true` solo detrás de un proxy inverso de confianza (la IP sale de `X-Forwarded-For`) | `false` |

Para generar secretos y claves propios (uno distinto para cada variable):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> 🔒 Los valores de `.env.example` que contienen `change-me` son **públicos** (están en
> el repositorio). Sirven para desarrollo local, pero con `NODE_ENV=production` la
> aplicación **se niega a arrancar** si `DB_PASSWORD`, `TICKET_CODE_SECRET`,
> `ORGANIZER_API_KEY` o `GATE_API_KEY` siguen con ese valor.

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
| `1759536120000-AddHolderAndOpenSalesIndexes` | índice `(event_id, holder_email)` para el tope por titular (RN-008) e índice **parcial** de cupos abiertos para la conciliación (RN-014) |

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

Al arrancar, la aplicación **concilia las ventas** con el catálogo: si un evento quedó
cancelado con la venta abierta (porque el proceso cayó antes de cerrarla), la cierra y
reembolsa sus entradas (RN-014). No impide arrancar si falla; queda en el log.

## 7. Pruebas

```bash
pnpm test        # unitarias + reglas de arquitectura (sin Nest, sin BD) — 252 pruebas
pnpm test:e2e    # e2e con PostgreSQL real y migraciones reales — 68 pruebas
pnpm test:cov    # cobertura de las unitarias
pnpm typecheck   # verificación de tipos (incluye tests)
```

- **Unitarias** (`src/**/*.spec.ts`): value objects, agregados, handlers instanciados
  **a mano** con adaptadores en memoria y un **reloj fijo** (`FixedClock`), incluidos
  los reintentos ante compras simultáneas y la carrera "primera compra contra
  cancelación"; mappers, hasher HMAC, generador de códigos, ACL entre contextos,
  autenticación por clave, filtros de errores, oyente con reintentos y validación de entorno.
- **Arquitectura** (`test/architecture/architecture.spec.ts`): automatiza las
  comprobaciones de la rúbrica (el dominio no importa NestJS/TypeORM/class-validator,
  ningún dominio importa a otro contexto, controladores solo usan los buses,
  `process.env` solo en `src/config`, `synchronize` nunca `true`, eventos publicados
  después de `save`, dominio y aplicación sin `new Date()`/`Math.random()` ni módulos de
  Node, ningún test con `skip`/`only`...).
- **E2E** (`test/e2e/`): requieren la base levantada. `global-setup.ts` fuerza
  `NODE_ENV=test`, crea `DB_NAME_TEST` si no existe, **la vacía y aplica las migraciones
  reales**. `setup-env.ts` sube los límites de peticiones para que las pruebas de
  concurrencia no choquen con ellos. Cubren 200/201/204, 400, 401, 403, 404, 409, 413, 429 y
  500, **30 compradores simultáneos para 5 plazas** (se venden exactamente 5), compras
  en paralelo de un mismo titular, **compras compitiendo con la cancelación** (ninguna
  entrada de un evento cancelado queda válida), el **ROLLBACK** real de la compra, el
  evento entre contextos, la conciliación, restricciones de la base, cabeceras de
  seguridad y la reversibilidad de las migraciones.

## 8. Endpoints

Todos los errores tienen la forma `{ statusCode, code, message, path, timestamp }`.
Catálogo completo de códigos en [`docs/business-rules/error-catalog.md`](docs/business-rules/error-catalog.md).

**Autenticación.** Las rutas marcadas con 🔑 exigen la cabecera
`Authorization: Bearer <clave>` con la clave del rol indicado (`ORGANIZER_API_KEY` o
`GATE_API_KEY`). Sin clave o con una clave desconocida → `401 UNAUTHORIZED`; con la
clave de otro rol → `403 FORBIDDEN`. El resto de rutas son públicas.

**Límite de peticiones.** Cada IP tiene `THROTTLE_LIMIT` peticiones por ruta y ventana
(`THROTTLE_TTL_SECONDS`); la compra y el check-in, además, `THROTTLE_SENSITIVE_LIMIT`.
Al superarlo → `429 TOO_MANY_REQUESTS`.

### Contexto Catálogo (eventos)

| Método | Ruta | Acceso | Tipo | Cuerpo / query | Respuesta |
|---|---|---|---|---|---|
| `POST` | `/events` | 🔑 organizador | Comando `ScheduleEvent` | `{ name, venue, startsAt, capacity, priceCents, currency }` | `201 { id }` · 400 · 401 · 403 · 409 |
| `GET` | `/events` | público | Consulta `ListEvents` | `?status=SCHEDULED\|CANCELLED&limit=1..100&offset=0..` | `200 { items: EventView[], limit, offset, nextOffset }` · 400 |
| `GET` | `/events/:id` | público | Consulta `GetEvent` | — | `200 EventView` · 400 · 404 |
| `POST` | `/events/:id/cancel` | 🔑 organizador | Comando `CancelEvent` | — | `204` · 400 · 401 · 403 · 404 · 409 |

- `startsAt`: ISO 8601 **con zona horaria**, p. ej. `2027-03-20T21:00:00Z` o `2027-03-20T16:00:00-05:00`.
- `priceCents`: precio en céntimos (entero). `4500` = 45,00. `0` = gratis. `currency`: `PEN`, `USD` o `EUR`.
- `GET /events` devuelve páginas de `limit` eventos (por defecto 20, máximo 100) ordenados
  por fecha de inicio; `nextOffset` es el `offset` de la siguiente página o `null` si no hay más.

### Contexto Venta de entradas

| Método | Ruta | Acceso | Tipo | Cuerpo | Respuesta |
|---|---|---|---|---|---|
| `POST` | `/tickets` | público (límite estricto) | Comando `PurchaseTickets` | `{ eventId, quantity, holderName, holderEmail }` | `201 { eventId, tickets: [{ id, code }], total }` · 400 · 404 · 409 · 429 |
| `POST` | `/tickets/check-in` | 🔑 puerta u organizador (límite estricto) | Comando `CheckInTicket` | `{ eventId, code }` | `200 { id }` · 400 · 401 · 403 · 404 · 409 · 429 |
| `GET` | `/tickets/:id` | 🔑 puerta u organizador | Consulta `GetTicket` | — | `200 TicketView` (sin código; con datos personales) · 400 · 401 · 403 · 404 |
| `GET` | `/tickets/availability/:eventId` | público | Consulta `GetEventAvailability` | — | `200 { eventId, capacity, sold, available, salesOpen, price }` · 400 · 404 |
| `POST` | `/tickets/sales/reconcile` | 🔑 organizador | Comando `ReconcileSales` | — | `200 { closedEventIds }` · 401 · 403 |

- En el check-in, `eventId` es el evento **de la puerta** donde se escanea: una entrada de
  otro evento se rechaza (`409 TICKET_WRONG_EVENT`). Las puertas abren **12 h antes** del
  inicio y cierran **24 h después** (RN-016).
- `POST /tickets/sales/reconcile` es la herramienta de recuperación de RN-014: cierra y
  reembolsa los eventos cancelados cuya venta siguiera abierta. Es idempotente.

> 🔐 El **código** de cada entrada (`XXXX-XXXX-XXXX`) se muestra **una sola vez**, en
> la respuesta de la compra. La base solo guarda su HMAC; ninguna otra respuesta lo devuelve.

### Ejemplo de flujo completo
Con las claves de ejemplo de `.env.example` (en Linux/macOS; el evento empieza dentro de
2 horas para que las puertas ya estén abiertas):
```bash
API=localhost:3000; H='Content-Type: application/json'
ORG='Authorization: Bearer change-me-organizer-key-0123456789abcdef'
GATE='Authorization: Bearer change-me-gate-key-0123456789abcdef0123'
STARTS=$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%SZ)   # macOS: date -u -v+2H +%Y-%m-%dT%H:%M:%SZ

EVENT=$(curl -s -X POST $API/events -H "$H" -H "$ORG" -d "{\"name\":\"Rock en el Parque\",\"venue\":\"Estadio Nacional\",\"startsAt\":\"$STARTS\",\"capacity\":3,\"priceCents\":4500,\"currency\":\"PEN\"}" | sed 's/.*"id":"\([^"]*\)".*/\1/')
curl -s -X POST $API/tickets -H "$H" -d "{\"eventId\":\"$EVENT\",\"quantity\":2,\"holderName\":\"Ana Pérez\",\"holderEmail\":\"ana@mail.com\"}"
#   → 201 {"tickets":[{"id":"…","code":"HJM7-EQNX-GXHY"},…],"total":{"amountCents":9000,"currency":"PEN"}}
curl -s -X POST $API/tickets -H "$H" -d "{\"eventId\":\"$EVENT\",\"quantity\":2,\"holderName\":\"Luis\",\"holderEmail\":\"luis@mail.com\"}"
#   → 409 TICKET_NOT_ENOUGH_AVAILABLE (solo queda 1)
curl -s -X POST $API/tickets/check-in -H "$H" -H "$GATE" -d "{\"eventId\":\"$EVENT\",\"code\":\"HJM7-EQNX-GXHY\"}"
#   → 200, y la segunda vez 409 TICKET_ALREADY_USED (usa el código que te devolvió la compra)
curl -s -X POST $API/events/$EVENT/cancel -H "$ORG"     # 204 → la otra entrada pasa a REFUNDED
curl -s $API/tickets/availability/$EVENT                # salesOpen: false
curl -s -X POST $API/events/$EVENT/cancel               # 401 UNAUTHORIZED (sin clave)
```

## 9. Arquitectura

```
   HTTP (controllers, DTOs, ValidationPipe, filtros de errores, helmet,
         límite de peticiones, autenticación por clave de API)
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
                   security/ (HMAC, generador de códigos), adapters/ (ACL entre contextos),
                   event-handlers/ (oyente entre contextos, conciliación al arrancar)
   shared/infrastructure/ reloj, ids, unidad de trabajo (transacciones), auth, rate limit
```

- **Regla de dependencias**: `infrastructure → application → domain`, verificada por una prueba automática.
- **Puertos** en `domain/ports/` (interfaz + token `Symbol`); **adaptadores** en `infrastructure/`.
  El módulo Nest de cada contexto decide qué adaptador satisface cada puerto. También
  las dependencias externas van detrás de un puerto: reloj (`Clock`), identificadores
  (`IdGenerator`), azar de los códigos (`TicketCodeGenerator`), hash (`TicketCodeHasher`)
  y transacciones (`UnitOfWork`).
- **CQRS**: los controladores solo despachan comandos/consultas. Los handlers cargan →
  delegan al dominio → persisten → **publican eventos después de persistir**.
- **Errores**: `DomainException { code, kind }` (`VALIDATION | NOT_FOUND | CONFLICT`); un
  único filtro (`DomainExceptionFilter`) los traduce a 400/404/409. Los errores del
  framework (401, 403, 404 de ruta, 429...) y cualquier fallo inesperado (500 genérico,
  p. ej. una fila corrupta) mantienen la misma forma de respuesta.
- **Validación en dos niveles**: DTO + `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`)
  en el borde; value objects e invariantes de los agregados en el dominio.
- **Concurrencia y atomicidad**: bloqueo optimista (columna `version`) en todos los
  agregados; la compra guarda el cupo y sus entradas en **una transacción** y la
  reintenta entera, con espera aleatoria, si otra operación cambió el cupo a la vez.

Detalle: [`docs/architecture/overview.md`](docs/architecture/overview.md).

## 10. Bounded contexts

| Contexto | Responsabilidad | Agregados | Escritura | Lectura |
|---|---|---|---|---|
| **Catálogo** (`src/catalog`) | Qué eventos hay: fecha, recinto, aforo, precio, estado | `Event` | `ScheduleEvent`, `CancelEvent` | `GetEvent`, `ListEvents` |
| **Venta de entradas** (`src/ticketing`) | Vender sin sobrevender, validar en la puerta, reembolsar | `TicketAllocation` (cupo por evento), `Ticket` | `PurchaseTickets`, `CheckInTicket`, `CloseEventSales` (interno), `ReconcileSales` | `GetTicket`, `GetEventAvailability` |

- `ticketing/domain` **no importa** nada del catálogo. Tiene su propio puerto
  `EventCatalog` y su propio modelo (`EventReference`, `SaleableEvent`, `Money`); el
  adaptador `CatalogEventCatalog` (ACL) consulta el catálogo por `QueryBus` + `GetEventQuery`.
- Evento entre contextos: `EventCancelled` (Catálogo) → oyente
  `CloseSalesOnEventCancelledListener` en `ticketing/infrastructure` → comando
  `CloseEventSales` (cierra la venta y reembolsa las entradas no usadas). Si falla,
  reintenta; lo que quede lo recoge `ReconcileSales` (al arrancar o bajo demanda).

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
| RN-008 | Se compran entre 1 y 10 entradas por operación, y un titular (email) no acumula más de 10 entradas activas por evento. |
| RN-009 | **Nunca se venden más entradas que el aforo**, ni con compras simultáneas. |
| RN-010 | No se vende si el evento fue cancelado (aunque su cupo siga abierto), la venta está cerrada o el evento ya empezó. |
| RN-011 | El titular tiene un nombre de 2–80 caracteres y un email válido. |
| RN-012 | Cada entrada tiene un código secreto único, mostrado una vez; solo se guarda su HMAC. |
| RN-013 | Una entrada se usa una sola vez; una reembolsada no es válida. |
| RN-014 | Al cancelar un evento se cierra la venta y se reembolsan las entradas no usadas (también si el evento nunca vendió nada o la compra coincide con la cancelación). |
| RN-015 | Total = precio unitario × cantidad; cada entrada guarda el precio que se pagó. |
| RN-016 | Una entrada solo da acceso a **su** evento, si no fue cancelado, desde 12 h antes hasta 24 h después del inicio. |

## 12. Decisiones importantes

Registradas como ADR (con el *por qué*) en [`docs/decisions/`](docs/decisions/README.md):
hexagonal + DDD + CQRS, separación Catálogo/Venta, errores de dominio con filtro único,
entidades ORM separadas + mappers, migraciones con `synchronize: false`, ACL + eventos
entre contextos, HMAC para los códigos de entrada, configuración fail-fast, estrategia de
pruebas, bloqueo optimista, el **cupo como agregado propio** (la pieza que impide
sobrevender), la **compra transaccional** con la unidad de trabajo, la **autenticación
por clave de API con límite de peticiones**, el **reloj y el azar detrás de puertos** y
la **consistencia de RN-014** (reintentos + conciliación).

## 13. Estructura del proyecto

```
.
├── docker-compose.yml            # PostgreSQL 16 (lee el mismo .env, solo en 127.0.0.1)
├── .env.example                  # plantilla de configuración (valores públicos solo para desarrollo)
├── docs/                         # guías, arquitectura, reglas, ADRs, auditoría, deuda técnica
├── src/
│   ├── main.ts / app.module.ts / app.setup.ts
│   ├── config/                   # ÚNICO lugar que lee process.env
│   ├── database/                 # migraciones versionadas y registro de entidades ORM
│   ├── shared/                   # shared kernel: DomainException, AggregateRoot (con versión),
│   │                             #   DomainEvent, puertos Clock/IdGenerator/UnitOfWork y sus
│   │                             #   adaptadores, filtros HTTP, autenticación, rate limit
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
    ├── e2e/                      # pruebas e2e + global-setup (migraciones reales) + setup-env
    └── jest-e2e.json
```

## 14. Problemas conocidos y solución de problemas

| Síntoma | Causa / solución |
|---|---|
| `Invalid environment configuration (check your .env)` | Falta `.env` o alguna variable (p. ej. `ORGANIZER_API_KEY`). `cp .env.example .env`. |
| `... still has the public example value from .env.example` | Arrancaste con `NODE_ENV=production` y los secretos de ejemplo: genera valores reales. |
| `401 UNAUTHORIZED` | Falta la cabecera `Authorization: Bearer <clave>` o la clave no coincide con `.env`. |
| `403 FORBIDDEN` | Usaste la clave de puerta en una ruta del organizador. |
| `429 TOO_MANY_REQUESTS` | Superaste el límite de peticiones: espera `THROTTLE_TTL_SECONDS` o súbelo en `.env`. |
| `409 TICKET_CHECK_IN_NOT_OPEN` | Las puertas abren 12 h antes del inicio del evento. |
| `ECONNREFUSED 127.0.0.1:5432` | La base no está levantada: `docker compose up -d --wait`. |
| `port is already allocated` | Otro PostgreSQL usa el 5432: cambia `DB_PORT` en `.env`. |
| `password authentication failed` tras cambiar `DB_PASSWORD` | Postgres aplica las credenciales al crear el volumen: `docker compose down -v` y vuelve a levantar. |
| `relation "events" does not exist` | Faltan las migraciones: `pnpm migration:run`. |
| `400 EVENT_INVALID_START` | La fecha debe incluir zona horaria: `…T21:00:00Z` o `…T16:00:00-05:00`. |
| `409 TICKET_SALES_CONCURRENT_MODIFICATION` | Muchísimas compras simultáneas agotaron los reintentos: vuelve a intentarlo. |
| `pnpm audit` reporta avisos en `braces`, `sprintf-js` y `handlebars` | Solo en herramientas de desarrollo (Jest / ts-jest), nunca en producción: `pnpm audit --prod` = 0. Detalle y plan en [`docs/technical-debt.md`](docs/technical-debt.md) (TD-014). |

Auditoría de seguridad y bugs: [`docs/audit-checklist.md`](docs/audit-checklist.md).
Limitaciones conocidas: [`docs/technical-debt.md`](docs/technical-debt.md) (sin pasarela de
pago real, claves de API compartidas en lugar de usuarios, eventos en memoria sin outbox
—compensado con reintentos y conciliación—, límite de peticiones en memoria de un solo proceso).

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
