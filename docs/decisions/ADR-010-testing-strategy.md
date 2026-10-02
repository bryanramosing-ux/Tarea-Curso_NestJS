# ADR-010 — Estrategia de pruebas

## Contexto
Hay que demostrar que las reglas funcionan (unitarias rápidas), que el sistema
completo funciona con la base real (e2e) y que la arquitectura no se degrada.

## Decisión
1. **Unitarias** (`pnpm test`): dominio y handlers sin Nest ni base de datos; los
   handlers se construyen con `new` y adaptadores en memoria.
2. **Arquitectura** (`pnpm test`): `test/architecture/architecture.spec.ts` analiza
   los imports y el código fuente para verificar la regla de dependencias y las faltas
   graves de la rúbrica.
3. **E2E** (`pnpm test:e2e`): `AppModule` completo con el mismo pipe y filtro de
   producción, contra PostgreSQL real; `global-setup.ts` aplica las migraciones reales
   desde cero sobre una base dedicada. `--runInBand` porque comparten base.

## Por qué
- La mayoría de las reglas son puras: probarlas sin infraestructura es rápido y preciso.
- Instanciar handlers a mano demuestra que la aplicación depende solo de puertos.
- Las pruebas de arquitectura convierten la checklist de la rúbrica en algo ejecutable
  y se validaron con mutaciones (introducir un import de `@nestjs` en el dominio, un
  `process.env` fuera de config o un `it.skip` las hace fallar).
- Solo una prueba con la base real puede demostrar unicidad concurrente, CHECK/FK y
  migraciones reversibles.

## Consecuencias
- Las e2e requieren Docker levantado.
- El evento entre contextos es asíncrono: el e2e espera con un sondeo acotado (3 s).

## Alternativas descartadas
- Mocks de TypeORM en los handlers: probarían la implementación, no el contrato.
- SQLite en memoria para e2e: no reproduce PostgreSQL (tipos `uuid`, `timestamptz`, códigos de error).
