# ADR-010 — Estrategia de pruebas

## Contexto
Hay que demostrar que las reglas funcionan (unitarias rápidas), que el sistema
completo funciona con la base real (e2e) y que la arquitectura no se degrada.

## Decisión
1. **Unitarias** (`pnpm test`): dominio y handlers sin Nest ni base de datos; los
   handlers se construyen con `new` y adaptadores en memoria: repositorios,
   `InMemoryUnitOfWork`, `FixedClock` (reloj fijo que se adelanta a mano) y el
   publicador de eventos en memoria.
2. **Arquitectura** (`pnpm test`): `test/architecture/architecture.spec.ts` analiza
   los imports y el código fuente para verificar la regla de dependencias y las faltas
   graves de la rúbrica.
3. **E2E** (`pnpm test:e2e`): `AppModule` completo con la misma configuración HTTP que
   producción (`configureApp`: pipe, filtros, helmet, guards), contra PostgreSQL real;
   `global-setup.ts` aplica las migraciones reales desde cero sobre una base dedicada.
   `--runInBand` porque comparten base. `setup-env.ts` sube los límites de peticiones (las
   pruebas de concurrencia lanzan decenas de compras desde la misma IP);
   `rate-limit.e2e-spec.ts` arranca su propia app con límites bajos para probar el 429.

## Por qué
- La mayoría de las reglas son puras: probarlas sin infraestructura es rápido y preciso.
- Instanciar handlers a mano demuestra que la aplicación depende solo de puertos.
- Las pruebas de arquitectura convierten la checklist de la rúbrica en algo ejecutable
  y se validaron con mutaciones (introducir un import de `@nestjs` en el dominio, un
  `process.env` fuera de config o un `it.skip` las hace fallar).
- Solo una prueba con la base real puede demostrar la ausencia de sobreventa con compras
  simultáneas, la unicidad concurrente, los CHECK/FK y las migraciones reversibles.
- Las pruebas de concurrencia se validaron con controles negativos: sin bloqueo optimista
  la e2e de 30 compradores vende 16 entradas para 5 plazas y falla.
- El reloj fijo permite probar reglas temporales en sus bordes exactos (p. ej. el check-in
  justo 12 h antes del inicio) sin esperas ni fechas calculadas con `Date.now()`.
- La carrera "primera compra contra cancelación" se reproduce de forma determinista en una
  unitaria (un catálogo que, al ser consultado, deja terminar la cancelación) y se prueba
  además con concurrencia real en e2e.

## Consecuencias
- Las e2e requieren Docker levantado.
- El evento entre contextos es asíncrono: el e2e espera con un sondeo acotado (3–5 s).

## Alternativas descartadas
- Mocks de TypeORM en los handlers: probarían la implementación, no el contrato.
- SQLite en memoria para e2e: no reproduce PostgreSQL (tipos `uuid`, `timestamptz`, códigos de error).
