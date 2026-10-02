# Estrategia de pruebas

| Nivel | Comando | Dónde | Infraestructura | Qué demuestra |
|---|---|---|---|---|
| Unitarias de dominio | `pnpm test` | `src/*/domain/**/*.spec.ts` | Ninguna | Value objects (validación, normalización, `equals`), entidades (invariantes, eventos, `toPrimitives/fromPrimitives` con revalidación) |
| Unitarias de aplicación | `pnpm test` | `src/*/application/**/*.spec.ts` | Ninguna: handlers instanciados con `new` y adaptadores **en memoria** | Orquestación, errores NOT_FOUND/CONFLICT/VALIDATION, eventos publicados **después** de persistir |
| Unitarias de infraestructura | `pnpm test` | `src/*/infrastructure/**/*.spec.ts`, `src/shared`, `src/config` | Ninguna | Mappers, hasher scrypt, ACL Users→Tasks, filtro de errores, validación de entorno |
| Arquitectura | `pnpm test` | `test/architecture/architecture.spec.ts` | Ninguna (lee el código fuente) | Regla de dependencias, faltas graves de la rúbrica, ausencia de `skip`/`only` |
| End-to-end | `pnpm test:e2e` | `test/e2e/*.e2e-spec.ts` | PostgreSQL real (Docker) + **migraciones reales** | 200/201/204, 400, 404, 409; unicidad concurrente; CHECK/FK; evento entre contextos; `down()` reversible |

## Decisiones

- Los handlers no se prueban con `Test.createTestingModule`: se construyen a mano
  (`new CreateUserHandler(repo, hasher, publisher)`), lo que prueba que la capa de
  aplicación solo depende de puertos.
- Los adaptadores en memoria guardan copias de primitivas y reconstruyen con
  `fromPrimitives()`, igual que el real; así las pruebas no comparten referencias.
- El e2e usa `AppModule` completo y `configureApp()` (el mismo pipe y filtro que
  `main.ts`). `global-setup.ts` borra la base de pruebas y ejecuta las migraciones
  desde cero; cada prueba trunca las tablas.
- El orden "persistir → publicar" se prueba de dos formas: espías en los tests de
  handlers y una regla estática en la prueba de arquitectura.
- Ninguna prueba está desactivada; la regla `no test is disabled or focused` lo vigila.

## Resultados de la última ejecución local

```
pnpm test      → Test Suites: 25 passed · Tests: 180 passed
pnpm test:e2e  → Test Suites: 3 passed  · Tests: 35 passed
```
