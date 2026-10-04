# Checklist de auditoría: vulnerabilidades, bugs y errores

Fecha: 2026-10-04 · Dominio: **venta de entradas para eventos** · Entorno: Linux, Node 22.22,
pnpm 10.28, PostgreSQL 16 (Docker).

Leyenda: ✅ verificado con evidencia · 🔧 fallo encontrado **y corregido** · ⚠️ limitación
conocida, documentada y no corregida · ❌ falla (ninguno al cierre).

## Resumen

| Área | Resultado |
|---|---|
| Vulnerabilidades en dependencias de producción (`pnpm audit --prod`) | ✅ 0 |
| Vulnerabilidades en dependencias de desarrollo (`pnpm audit`) | ⚠️ 1 *high* en `braces` (solo Jest, sin versión corregida publicada): TD-014 |
| Compilación (`pnpm typecheck`, `pnpm build`) | ✅ sin errores |
| Pruebas unitarias + arquitectura (`pnpm test`) | ✅ 189/189 |
| Pruebas e2e con PostgreSQL real (`pnpm test:e2e`) | ✅ 44/44 (3 ejecuciones seguidas) |
| Sobreventa con compras simultáneas | ✅ 30 compradores / 5 plazas → exactamente 5 entradas |
| Bugs encontrados durante la migración de dominio | 🔧 3 corregidos con prueba de regresión |

## Hallazgos

| # | Severidad | Hallazgo | Cómo se encontró | Estado |
|---|---|---|---|---|
| H-1 | **Crítica** (si faltara el bloqueo) | **Sobreventa** con compras simultáneas. Sin bloqueo optimista, 30 compradores para 5 plazas obtienen 16 entradas. | Control negativo contra PostgreSQL real | ✅ Prevenido por diseño: cupo como agregado (ADR-012) + bloqueo optimista (ADR-011) + `CHECK sold <= capacity`. Regresión: `concurrency.e2e-spec.ts`. |
| H-2 | Media (experiencia) | Con 30 compras simultáneas, 25 recibían "conflicto técnico, reintenta" en vez de "agotado": 3 reintentos no bastaban. | Sondeo con 30 compras reales | 🔧 Hasta 10 reintentos con espera aleatoria (*jitter*): ahora las 25 reciben `TICKET_NOT_ENOUGH_AVAILABLE` (3 ejecuciones). |
| H-3 | Media (integridad) | **Carrera compra ↔ cancelación**: si el reembolso buscaba entradas antes de que una compra en curso guardara las suyas, quedaban entradas válidas de un evento cancelado. | Revisión del flujo | 🔧 La compra relee el cupo tras emitir y, si la venta se cerró, reembolsa sus entradas y responde `TICKET_SALES_CLOSED`. Prueba `racing an event cancellation` (falla si se quita la compensación). |
| H-4 | Media (correctitud) | Una fecha sin zona horaria (`2027-03-20T21:00:00`) se interpretaba con la hora local del servidor: el mismo dato daba instantes distintos según dónde corriera la API. | Revisión de `EventStart` | 🔧 Se exige `Z` o `±HH:MM` → 400 `EVENT_INVALID_START`. |
| H-5 | Baja (herramienta de prueba) | Con 30 peticiones simultáneas, supertest abría un servidor temporal por petición → `ECONNRESET`. | Primera ejecución de la e2e de concurrencia | 🔧 La app de pruebas escucha en un puerto efímero real (`app.listen(0)`). |
| H-6 | Informativa | `braces` (GHSA-vfj7-8cjw-p6xm) en dependencias de Jest; sin parche publicado. | `pnpm audit` | ⚠️ TD-014: no llega a producción (`pnpm audit --prod` = 0). |
| H-7 | Media si se expone a Internet | Sin autenticación ni rate limiting. | Revisión | ⚠️ TD-004, TD-007 |

## Checklist detallado

### 1. Dependencias y cadena de suministro
- [x] ✅ `pnpm audit --prod`: 0 vulnerabilidades.
- [x] ⚠️ `pnpm audit`: 1 *high* en `braces`, solo en desarrollo, sin versión corregida (TD-014).
- [x] ✅ Versiones exactas en `package.json`; `pnpm-lock.yaml` versionado (`--frozen-lockfile` reproducible).
- [x] ✅ Sin dependencias nativas (HMAC y azar con `node:crypto`).

### 2. Secretos y configuración
- [x] ✅ `.env` nunca versionado (`git log --all`); `.env.example` con valores de ejemplo.
- [x] ✅ `TICKET_CODE_SECRET` obligatorio (≥ 32 caracteres); sin él la app no arranca.
- [x] ✅ Mensajes de configuración nombran la variable, **no su valor** (prueba).
- [x] ✅ `process.env` solo en `src/config/` (regla automática).
- [x] ✅ PostgreSQL solo en `127.0.0.1`.

### 3. Códigos de entrada (credencial)
- [x] ✅ Generados con CSPRNG, ~59 bits, alfabeto sin ambigüedades (200 códigos únicos en prueba).
- [x] ✅ En la base solo hay HMAC-SHA256; búsqueda del código en todas las columnas de `tickets` = 0 (e2e).
- [x] ✅ Ninguna vista, evento ni error contiene el código; `TicketCode` → `[REDACTED]`.
- [x] ✅ Un código no puede usarse dos veces, ni siquiera con dos lectores a la vez (prueba unitaria de la carrera).

### 4. Entradas hostiles (probadas contra la API en ejecución)
| Prueba | Resultado |
|---|---|
| JSON mal formado | ✅ 400 `BAD_REQUEST` |
| Tipos incorrectos (`capacity: "5"`, `priceCents: 10.5`, `quantity: "2"`, `code: [...]`) | ✅ 400 `REQUEST_VALIDATION_FAILED` |
| Propiedades no permitidas (`organizer`, `priceCents` en la compra) | ✅ 400 — el cliente **no puede fijar el precio** |
| `__proto__` con `quantity: 9` en la compra | ✅ ignorado: se vende 1 entrada, sin contaminación de prototipos |
| Inyección SQL en nombre, filtros y código | ✅ texto literal o 400 (consultas parametrizadas) |
| Fechas imposibles (`2027-02-30`) o sin zona | ✅ 400 |
| Cantidades negativas, 0 u 11 | ✅ 400 `TICKET_INVALID_QUANTITY` |
| Aforo `1e12`, precio negativo, moneda `BTC` | ✅ 400 |
| Cuerpo > 100 kB | ✅ 413 |
| Ruta o método inexistente | ✅ 404 `ROUTE_NOT_FOUND` |
| Cabeceras | ✅ sin `X-Powered-By`; `nosniff`, CSP (helmet) |

### 5. Bugs y lógica de negocio
- [x] ✅ Nunca se sobrevende (dominio + versión + `CHECK`), con 30 compras simultáneas.
- [x] ✅ Recinto + hora único con 3 programaciones simultáneas: 1×201 y 2×409.
- [x] 🔧 Carrera compra ↔ cancelación compensada (H-3).
- [x] 🔧 Zona horaria obligatoria (H-4).
- [x] ✅ Cancelar reembolsa las no usadas y conserva las usadas; una entrada reembolsada no entra.
- [x] ✅ Los `CHECK`/FK/UNIQUE rechazan escrituras inválidas hechas fuera de la app.

### 6. Arquitectura (faltas graves de la rúbrica)
- [x] ✅ Sin imports de NestJS/TypeORM/class-validator en `domain/`.
- [x] ✅ Ningún dominio importa otro contexto (comprobado también con mutación).
- [x] ✅ Controladores solo con buses; eventos publicados después de persistir (regla que analiza el cuerpo de `execute()`, comprobada con mutación).
- [x] ✅ Sin `@Entity` fuera de `*.orm-entity.ts`; `synchronize: false`; ningún test con `skip`/`only`.

### 7. Pruebas: que sean reales
- [x] ✅ Control negativo del bloqueo optimista: sin él, 16 entradas para 5 plazas → la e2e falla.
- [x] ✅ Control negativo de la compensación compra ↔ cancelación → la prueba falla.
- [x] ✅ Mutaciones de arquitectura (`save` después de publicar; import entre contextos) → detectadas.
- [x] ✅ Las pruebas de concurrencia comprueban filas y contadores en la base, no solo códigos HTTP.

### 8. Migraciones y base de datos
- [x] ✅ 2 migraciones con `up()`/`down()`; revertidas y reaplicadas (CLI y e2e).
- [x] ✅ Índice único funcional `lower(venue)`, PK del cupo, `CHECK sold <= capacity`, `UNIQUE code_hash`, FKs.

## Qué tienes que hacer si venías de la versión Kanban
```bash
git pull
pnpm install
docker compose down -v          # borra la base antigua (otro esquema)
cp .env.example .env            # hay variables nuevas (TICKET_CODE_SECRET) y otros nombres
docker compose up -d --wait
pnpm migration:run
pnpm test && pnpm test:e2e
```
