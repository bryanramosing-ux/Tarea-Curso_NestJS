# Estrategia de pruebas

| Nivel | Comando | Dónde | Infraestructura | Qué demuestra |
|---|---|---|---|---|
| Unitarias de dominio | `pnpm test` | `src/*/domain/**/*.spec.ts` | Ninguna | Value objects (validación, normalización, `equals`), agregados (invariantes, eventos, `toPrimitives/fromPrimitives` con revalidación) |
| Unitarias de aplicación | `pnpm test` | `src/*/application/**/*.spec.ts` | Ninguna: handlers con `new`, adaptadores **en memoria** y reloj fijo (`FixedClock`) | Orquestación, errores, eventos **después** de persistir, compra dentro de la unidad de trabajo, reintentos ante concurrencia, carrera "primera compra ↔ cancelación", tope por titular, check-in (evento, cancelación, horario), cierre por lotes, conciliación |
| Unitarias de infraestructura | `pnpm test` | `src/*/infrastructure/**/*.spec.ts`, `src/shared`, `src/config` | Ninguna | Mappers (fila corrupta → 500), HMAC, generador de códigos, ACL Venta→Catálogo, contrato de los repositorios en memoria, oyente con reintentos, `ApiKeyGuard`, filtros de errores, validación de entorno |
| Arquitectura | `pnpm test` | `test/architecture/architecture.spec.ts` | Ninguna (lee el código fuente) | Regla de dependencias, faltas graves de la rúbrica, sin reloj/azar/módulos de Node en el dominio, ausencia de `skip`/`only` |
| End-to-end | `pnpm test:e2e` | `test/e2e/*.e2e-spec.ts` | PostgreSQL real (Docker) + **migraciones reales** | 200/201/204, 400, 401, 403, 404, 409, 413, 429, 500; **30 compras simultáneas para 5 plazas**; mismo titular en paralelo; **compras compitiendo con cancelaciones**; ROLLBACK real; unicidad recinto+hora simultánea; CHECK/FK/UNIQUE; evento entre contextos y conciliación; cabeceras y entradas hostiles; `down()` reversible |

## Decisiones

- Los handlers se construyen a mano (`new PurchaseTicketsHandler(allocations, tickets, catalog, hasher,
  codeGenerator, ids, unitOfWork, clock, publisher)`): la capa de aplicación solo depende de puertos.
- El tiempo es explícito: `FixedClock` permite probar los bordes exactos de RN-016 o que un
  evento ya empezó, sin `Date.now()` en las pruebas de reglas.
- Las e2e cargan `test/e2e/support/setup-env.ts`, que sube los límites de peticiones;
  `rate-limit.e2e-spec.ts` arranca su propia app con límites bajos para probar el 429.
- Los adaptadores en memoria emulan también las garantías de la base (índice único,
  clave primaria, bloqueo optimista) para que ambos adaptadores cumplan el mismo contrato.
- La app de las e2e escucha en un puerto efímero real (`app.listen(0)`), imprescindible
  para lanzar decenas de peticiones simultáneas con supertest.
- Las pruebas de concurrencia comprueban **resultados en la base** (filas y contador), no solo códigos HTTP.

## Controles negativos (las pruebas detectan lo que dicen detectar)

| Mutación introducida a propósito | Resultado |
|---|---|
| Quitar el `WHERE version = ?` del cupo | La e2e de 30 compradores falla: **16 entradas para 5 plazas** (control de la versión anterior) |
| Que el cierre de ventas no cree el cupo cerrado cuando no hay ventas (el bug original de la carrera) | Fallan 2 unitarias (`a FIRST purchase that read the catalog before the cancellation…`, `creates an already CLOSED allocation…`) y 2 e2e (`purchases racing a cancellation…` con concurrencia real y `a cancelled event that never sold gets a CLOSED allocation`) |
| Ejecutar la compra fuera de la unidad de trabajo | Fallan 2 unitarias (`…inside ONE unit of work`, `retries when another purchase…`). Las e2e siguieron en verde en esa ejecución: la ventana de fallo es pequeña y no siempre se da; el ROLLBACK en sí lo prueba `the purchase is atomic…` |
| Un `save()` después de `publishAll()` en un handler | Falla la regla de arquitectura |
| Importar `EventId` del catálogo en el dominio de la venta | Falla la regla de arquitectura |

## Resultados de la última ejecución local

```
pnpm test      → Test Suites: 28 passed · Tests: 252 passed
pnpm test:e2e  → Test Suites: 6 passed  · Tests: 68 passed   (4 ejecuciones seguidas, estable)
```
