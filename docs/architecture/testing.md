# Estrategia de pruebas

| Nivel | Comando | Dónde | Infraestructura | Qué demuestra |
|---|---|---|---|---|
| Unitarias de dominio | `pnpm test` | `src/*/domain/**/*.spec.ts` | Ninguna | Value objects (validación, normalización, `equals`), agregados (invariantes, eventos, `toPrimitives/fromPrimitives` con revalidación) |
| Unitarias de aplicación | `pnpm test` | `src/*/application/**/*.spec.ts` | Ninguna: handlers con `new` y adaptadores **en memoria** | Orquestación, errores, eventos **después** de persistir, reintentos ante concurrencia, carrera compra ↔ cancelación |
| Unitarias de infraestructura | `pnpm test` | `src/*/infrastructure/**/*.spec.ts`, `src/shared`, `src/config` | Ninguna | Mappers, HMAC, ACL Venta→Catálogo, contrato de los repositorios en memoria, filtro de errores, validación de entorno |
| Arquitectura | `pnpm test` | `test/architecture/architecture.spec.ts` | Ninguna (lee el código fuente) | Regla de dependencias, faltas graves de la rúbrica, ausencia de `skip`/`only` |
| End-to-end | `pnpm test:e2e` | `test/e2e/*.e2e-spec.ts` | PostgreSQL real (Docker) + **migraciones reales** | 200/201/204, 400, 404, 409, 413; **30 compras simultáneas para 5 plazas**; unicidad recinto+hora simultánea; CHECK/FK/UNIQUE; evento entre contextos; cabeceras y entradas hostiles; `down()` reversible |

## Decisiones

- Los handlers se construyen a mano (`new PurchaseTicketsHandler(repo, repo, catalog, hasher, publisher)`):
  la capa de aplicación solo depende de puertos.
- Los adaptadores en memoria emulan también las garantías de la base (índice único,
  clave primaria, bloqueo optimista) para que ambos adaptadores cumplan el mismo contrato.
- La app de las e2e escucha en un puerto efímero real (`app.listen(0)`), imprescindible
  para lanzar decenas de peticiones simultáneas con supertest.
- Las pruebas de concurrencia comprueban **resultados en la base** (filas y contador), no solo códigos HTTP.

## Controles negativos (las pruebas detectan lo que dicen detectar)

| Mutación introducida a propósito | Resultado |
|---|---|
| Quitar el `WHERE version = ?` del cupo | La e2e de 30 compradores falla: **16 entradas para 5 plazas** |
| Quitar la compensación compra ↔ cancelación | Falla `racing an event cancellation` |
| Un `save()` después de `publishAll()` en un handler | Falla la regla de arquitectura |
| Importar `EventId` del catálogo en el dominio de la venta | Falla la regla de arquitectura |

## Resultados de la última ejecución local

```
pnpm test      → Test Suites: 23 passed · Tests: 189 passed
pnpm test:e2e  → Test Suites: 5 passed  · Tests: 44 passed   (3 ejecuciones seguidas, estable)
```
