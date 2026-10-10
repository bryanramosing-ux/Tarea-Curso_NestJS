# Checklist de auditoría: vulnerabilidades, bugs y errores

Dominio: **venta de entradas para eventos** · Entorno: Linux, Node 22.22, pnpm 10.28,
PostgreSQL 16.

- **Auditoría 1** (2026-10-04): migración del dominio Kanban → venta de entradas (H-1 a H-7).
- **Auditoría 2** (2026-10-10): revisión completa de bugs, lógica de negocio y seguridad
  (H-8 a H-21), todo corregido salvo lo marcado como ⚠️.

Leyenda: ✅ verificado con evidencia · 🔧 fallo encontrado **y corregido** · ⚠️ limitación
conocida, documentada y no corregida · ❌ falla (ninguno al cierre).

## Resumen (al cierre de la auditoría 2)

| Área | Resultado |
|---|---|
| Vulnerabilidades en dependencias de producción (`pnpm audit --prod`) | ✅ 0 |
| Vulnerabilidades en dependencias de desarrollo (`pnpm audit`) | ⚠️ 5 avisos, todos en herramientas de prueba (Jest / ts-jest): `braces` (high), `sprintf-js` (moderate), `handlebars` (2 critical + 1 moderate). Ver H-21 y TD-014 |
| Compilación (`pnpm typecheck`, `pnpm build`) | ✅ sin errores |
| Pruebas unitarias + arquitectura (`pnpm test`) | ✅ 252/252 |
| Pruebas e2e con PostgreSQL real (`pnpm test:e2e`) | ✅ 68/68 (4 ejecuciones seguidas) |
| Sobreventa con compras simultáneas | ✅ 30 compradores / 5 plazas → exactamente 5 entradas |
| Compras compitiendo con cancelaciones | ✅ 8 eventos × (4 compras + 1 cancelación) simultáneas → 0 entradas válidas de eventos cancelados, todos los cupos `CLOSED` |
| Hallazgos de la auditoría 2 | 🔧 13 corregidos con prueba de regresión · ⚠️ 1 (dependencias de desarrollo) |

## Hallazgos

### Auditoría 1 (2026-10-04)

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| H-1 | **Crítica** (si faltara el bloqueo) | **Sobreventa** con compras simultáneas: sin bloqueo optimista, 30 compradores para 5 plazas obtienen 16 entradas. | ✅ Prevenido por diseño: cupo como agregado (ADR-012) + bloqueo optimista (ADR-011) + `CHECK sold <= capacity`. Regresión: `concurrency.e2e-spec.ts`. |
| H-2 | Media (experiencia) | Con 30 compras simultáneas, 25 recibían "conflicto técnico" en vez de "agotado": 3 reintentos no bastaban. | 🔧 Hasta 10 reintentos con espera aleatoria (*jitter*). |
| H-3 | Media (integridad) | Carrera compra ↔ cancelación cuando el cupo ya existía. | 🔧 Primero con una compensación en la compra; en la auditoría 2 se sustituyó por la compra transaccional (ADR-013), que cubre también la primera compra (H-8). |
| H-4 | Media (correctitud) | Una fecha sin zona horaria se interpretaba con la hora local del servidor. | 🔧 Se exige `Z` o `±HH:MM` → 400 `EVENT_INVALID_START`. |
| H-5 | Baja (herramienta de prueba) | Con 30 peticiones simultáneas, supertest abría un servidor por petición → `ECONNRESET`. | 🔧 La app de pruebas escucha en un puerto efímero real. |
| H-6 | Informativa | `braces` (GHSA-vfj7-8cjw-p6xm) en dependencias de Jest. | ⚠️ Ver H-21. |
| H-7 | Media si se expone a Internet | Sin autenticación ni rate limiting. | 🔧 Resuelto en la auditoría 2 (H-10, H-12). |

### Auditoría 2 (2026-10-10)

| # | Severidad | Hallazgo | Cómo se encontró | Estado |
|---|---|---|---|---|
| H-8 | **Alta** | **Venta abierta para siempre de un evento cancelado.** Si la **primera** compra leía el catálogo justo antes de la cancelación, el cierre no encontraba cupo (no hacía nada) y la compra creaba después un cupo `OPEN`: se vendieron 5 entradas válidas para un evento cancelado y se podía seguir vendiendo. | Reproducción determinista con adaptadores en memoria | 🔧 El cierre crea un cupo **ya cerrado** (`TicketAllocation.closedFor`) y la compra es transaccional: el cupo serializa ambas operaciones (ADR-013). Regresión: unitaria `a FIRST purchase that read the catalog before the cancellation…` y e2e `purchases racing a cancellation…` (ambas fallan si se quita el arreglo). |
| H-9 | **Alta** | Si el cierre automático fallaba (o se perdía el evento al caer el proceso), la venta seguía abierta y la puerta admitía entradas del evento cancelado; el fallo solo quedaba en el log. | Revisión del flujo | 🔧 La compra, la disponibilidad y el check-in consultan el catálogo; el oyente reintenta; conciliación al arrancar y `POST /tickets/sales/reconcile` (ADR-016). Regresión: e2e `…allocation was left OPEN…`, `…rejected even before it is refunded`, `POST /tickets/sales/reconcile…`. |
| H-10 | **Alta** si se expone a Internet | **Sin autenticación**: cualquiera podía programar o cancelar eventos (cancelar reembolsa todo), hacer check-in y leer `GET /tickets/:id`, que devuelve nombre y email del titular. | Prueba contra la API en ejecución | 🔧 Claves de API por rol (`ORGANIZER`, `GATE`), 401/403 (ADR-014). Regresión: `api-key.guard.spec.ts`, e2e `401 without a key, 403 with the key of another role…`. |
| H-11 | Media | **El check-in no comprobaba el evento ni la hora**: una entrada de un evento entraba en la puerta de otro, días después o antes del evento. | Prueba contra la API en ejecución | 🔧 RN-016: el check-in recibe el `eventId` de la puerta; se rechaza otro evento, evento cancelado y fuera de 12 h antes / 24 h después del inicio. Regresión: `ticket.spec.ts`, `check-in-ticket.handler.spec.ts`, 3 e2e. |
| H-12 | Media | **Acaparamiento del aforo sin coste**: sin pagos ni límite de peticiones, y RN-008 solo limitaba por operación; un script agotaba 100.000 plazas en 10.000 peticiones. | Revisión | 🔧 Límite de peticiones por IP con uno estricto en compra y check-in; máximo 10 entradas activas por titular y evento (RN-008). ⚠️ Sin pagos ni identidad verificada, quien use muchas IPs y emails aún puede acaparar (TD-005). |
| H-13 | Media | **Compra sin transacción**: si fallaba a mitad, el cupo contaba plazas sin entrada. | Revisión (TD-003) | 🔧 Puerto `UnitOfWork` y adaptador transaccional (ADR-013). Regresión: e2e `the purchase is atomic…` (ROLLBACK real) y unitaria `…inside ONE unit of work`. |
| H-14 | Media | **El secreto de ejemplo era válido en producción**: `TICKET_CODE_SECRET` de `.env.example` (36 caracteres, público) pasaba la validación. | Revisión | 🔧 Con `NODE_ENV=production`, los valores con el marcador `change-me` (secreto, claves, contraseña de la base) impiden arrancar. Comprobado arrancando `dist/main.js`. |
| H-15 | Baja | **Recintos duplicados por Unicode**: "Café" con tilde compuesta o combinada eran dos recintos distintos (RN-006); la búsqueda comparaba con `toLowerCase()` de JS frente a `lower()` de PostgreSQL. | Revisión | 🔧 Normalización NFC en nombre, recinto y titular; la búsqueda usa `LOWER()` en SQL. Regresión: unitarias y e2e `…decomposed accent is the same venue`. |
| H-16 | Baja | **Errores con eco de la entrada**: `?status=<script>` devolvía `"\"<script>\" is not a valid event status"`. | Prueba contra la API | 🔧 Los mensajes ya no repiten el valor. Regresión: e2e `validation errors never echo the received value`. |
| H-17 | Baja | `GET /events` devolvía toda la cartelera; el cierre de ventas cargaba en memoria todas las entradas de un evento (hasta 100.000). | Revisión (TD-008) | 🔧 Paginación `limit`/`offset` (máx. 100) y reembolsos por lotes de 200. Regresión: unitarias y e2e de paginación, `refunds in batches…`. |
| H-18 | Baja (diseño) | El reloj y el azar no estaban detrás de puertos (`now = new Date()` por defecto en el dominio, `node:crypto` en `shared/domain`). | Revisión con la rúbrica | 🔧 Puertos `Clock`, `IdGenerator`, `TicketCodeGenerator` (ADR-015) y dos reglas de arquitectura nuevas. |
| H-19 | Baja | Una fila corrupta en la base respondía **400** (culpa del cliente) en vez de 500 (TD-012). | Revisión | 🔧 `PersistedDataCorruptedError` → 500 genérico con el detalle en el log. Regresión: mappers y e2e `a corrupted row answers a generic 500…`. |
| H-20 | Baja | Un cuerpo de más de 100 kB respondía 413 sin `code` y Nest lo registraba como `ERROR` (TD-013). | Ejecución de e2e | 🔧 `UnhandledExceptionFilter`: 413 `PAYLOAD_TOO_LARGE` con la forma habitual, registrado como aviso. |
| H-21 | Informativa (solo desarrollo) | `pnpm audit` pasó de 1 a 5 avisos: `braces` (high, sin parche), `sprintf-js` (moderate, sin parche) y `handlebars` ≤ 4.7.9 vía `ts-jest` (GHSA-8r5x-fm3f-whwj y GHSA-p8wg-vrv2-v86f *critical*, GHSA-xw65-4hp5-5hc7 *moderate*). | `pnpm audit` | ⚠️ Ninguno llega a producción (`pnpm audit --prod` = 0). El parche de `handlebars` (4.7.10) se publicó el 2026-10-05, 5 días antes de esta auditoría: no se adoptó todavía una versión tan reciente sin revisión (riesgo de cadena de suministro). Plan en TD-014. |

## Checklist detallado

### 1. Dependencias y cadena de suministro
- [x] ✅ `pnpm audit --prod`: 0 vulnerabilidades (incluida la nueva dependencia `@nestjs/throttler` 6.5.0).
- [x] ⚠️ `pnpm audit`: 5 avisos solo en desarrollo (H-21, TD-014).
- [x] ✅ Versiones exactas en `package.json`; `pnpm-lock.yaml` versionado (`--frozen-lockfile` reproducible).
- [x] ✅ Sin dependencias nativas (HMAC y azar con `node:crypto`, en infraestructura).

### 2. Secretos y configuración
- [x] ✅ `.env` nunca versionado (`git log --all`); `.env.example` solo con valores públicos de ejemplo.
- [x] ✅ `TICKET_CODE_SECRET`, `ORGANIZER_API_KEY`, `GATE_API_KEY` obligatorios (≥ 32 caracteres, claves distintas).
- [x] 🔧 En producción, los valores de ejemplo impiden arrancar (H-14).
- [x] ✅ Mensajes de configuración nombran la variable, **no su valor** (prueba).
- [x] ✅ `process.env` solo en `src/config/` (regla automática).
- [x] ✅ PostgreSQL solo en `127.0.0.1`.

### 3. Autenticación, autorización y abuso
- [x] 🔧 Operaciones del personal protegidas por clave de API y rol (H-10); comparación en tiempo constante.
- [x] 🔧 Datos personales (`GET /tickets/:id`) solo para el personal.
- [x] 🔧 Límite de peticiones por IP; estricto en compra y check-in; 429 probado en e2e (H-12).
- [x] 🔧 Máximo 10 entradas activas por titular y evento, también con compras en paralelo (H-12).

### 4. Códigos de entrada (credencial)
- [x] ✅ Generados con CSPRNG, 31¹² ≈ 2⁵⁹ combinaciones, alfabeto sin ambigüedades (500 códigos únicos en prueba).
- [x] ✅ En la base solo hay HMAC-SHA256; búsqueda del código en todas las columnas de `tickets` = 0 (e2e).
- [x] ✅ Ninguna vista, evento ni error contiene el código; `TicketCode` → `[REDACTED]`.
- [x] ✅ Un código no puede usarse dos veces, ni siquiera con dos lectores a la vez.
- [x] 🔧 Solo sirve en la puerta de su evento, si no fue cancelado y en horario (H-11).

### 5. Entradas hostiles (probadas contra la API en ejecución)
| Prueba | Resultado |
|---|---|
| JSON mal formado | ✅ 400 `BAD_REQUEST` |
| Tipos incorrectos (`capacity: "5"`, `priceCents: 10.5`, `quantity: "2"`, `code: [...]`) | ✅ 400 `REQUEST_VALIDATION_FAILED` |
| Propiedades no permitidas (`organizer`, `priceCents` en la compra) | ✅ 400 — el cliente **no puede fijar el precio** |
| `__proto__` / `constructor` en el cuerpo | ✅ ignorados, sin contaminación de prototipos |
| Inyección SQL en nombre, filtros y código | ✅ texto literal o 400 (consultas parametrizadas) |
| HTML/JS en filtros (`?status=<b>x</b>`) | 🔧 400 sin eco del valor (H-16) |
| Fechas imposibles (`2027-02-30`) o sin zona | ✅ 400 |
| Cantidades negativas, 0 u 11; paginación `limit=0`, `limit=101`, `offset=-1` | ✅ 400 |
| Aforo `1e12`, precio negativo, moneda `BTC` | ✅ 400 |
| Cuerpo > 100 kB | 🔧 413 `PAYLOAD_TOO_LARGE` (H-20) |
| Ruta o método inexistente | ✅ 404 `ROUTE_NOT_FOUND` |
| Sin clave / clave de otro rol / clave inventada | 🔧 401 / 403 / 401 |
| Ráfaga de compras desde una IP | 🔧 429 `TOO_MANY_REQUESTS` |
| Cabeceras | ✅ sin `X-Powered-By`; `nosniff`, CSP (helmet) |

### 6. Bugs y lógica de negocio
- [x] ✅ Nunca se sobrevende (dominio + versión + `CHECK`), con 30 compras simultáneas.
- [x] ✅ Recinto + hora único con 3 programaciones simultáneas: 1×201 y 2×409.
- [x] 🔧 Primera compra ↔ cancelación (H-8) y compra atómica (H-13).
- [x] 🔧 Evento cancelado con cierre fallido: no vende ni admite público; conciliación (H-9).
- [x] 🔧 Zona horaria obligatoria (H-4).
- [x] ✅ Cancelar reembolsa las no usadas y conserva las usadas; una entrada reembolsada no entra.
- [x] ✅ Los `CHECK`/FK/UNIQUE rechazan escrituras inválidas hechas fuera de la app.
- [x] ⚠️ RN-006 compara el instante de inicio, no franjas (no hay duración): TD-016.

### 7. Arquitectura (faltas graves de la rúbrica)
- [x] ✅ Sin imports de NestJS/TypeORM/class-validator ni módulos de Node en `domain/`.
- [x] ✅ Ni `domain/` ni `application/` leen el reloj o el azar directamente (regla nueva).
- [x] ✅ Ningún dominio importa otro contexto.
- [x] ✅ Controladores solo con buses; eventos publicados después de persistir (regla que analiza
  el cuerpo de `execute()`; `ReconcileSales`, que no guarda ni publica y solo delega por el
  `CommandBus`, es la única excepción explícita y comprobada).
- [x] ✅ Sin `@Entity` fuera de `*.orm-entity.ts`; `synchronize: false`; ningún test con `skip`/`only`.

### 8. Pruebas: que sean reales
- [x] ✅ Control negativo del bloqueo optimista: sin él, 16 entradas para 5 plazas → la e2e falla.
- [x] ✅ Control negativo de H-8: sin el cupo cerrado fallan 2 unitarias y 2 e2e (una de ellas con concurrencia real).
- [x] ✅ Control negativo de H-13: sin la unidad de trabajo fallan 2 unitarias (las e2e no lo detectaron en esa ejecución; ver `architecture/testing.md`).
- [x] ✅ Mutaciones de arquitectura (`save` después de publicar; import entre contextos) → detectadas.
- [x] ✅ Las pruebas de concurrencia comprueban filas y contadores en la base, no solo códigos HTTP.

### 9. Migraciones y base de datos
- [x] ✅ 3 migraciones con `up()`/`down()`; revertidas y reaplicadas (e2e) y aplicadas con el CLI (`migration:run` y `migration:run:prod`).
- [x] ✅ Índice único funcional `lower(venue)`, PK del cupo, `CHECK sold <= capacity`, `UNIQUE code_hash`, FKs, índices de titular y de cupos abiertos.

## Qué tienes que hacer si ya tenías el proyecto
```bash
git pull
pnpm install                    # nueva dependencia: @nestjs/throttler
cp .env.example .env            # variables nuevas: ORGANIZER_API_KEY, GATE_API_KEY, THROTTLE_*, TRUST_PROXY
docker compose up -d --wait
pnpm migration:run              # aplica la migración nueva de índices
pnpm test && pnpm test:e2e
```
Si venías de la versión Kanban, borra antes la base antigua: `docker compose down -v`.
