# ADR-015 — El reloj y el azar detrás de puertos

## Contexto
Varias reglas dependen de la hora actual (RN-003, RN-007, RN-010, RN-016) y otras del azar
(identificadores, código secreto de la entrada, RN-012). Antes, los métodos del dominio
tenían `now: Date = new Date()` por defecto, un caso de uso llamaba a `new Date()` y el
dominio importaba `node:crypto` (en `shared/domain/uuid.ts`) para generar UUID y códigos.
La rúbrica pide que las dependencias externas (hash, tokens, **reloj**...) queden detrás de un puerto.

## Decisión
- Puertos en `domain/ports`:
  - `Clock` (`shared`): `now()`. Adaptadores `SystemClock` y `FixedClock` (pruebas).
  - `IdGenerator` (`shared`): `generate()`. Adaptador `CryptoIdGenerator` (`randomUUID`).
  - `TicketCodeGenerator` (`ticketing`): `generate()`. Adaptador `CryptoTicketCodeGenerator` (`randomInt`).
- Los métodos del dominio reciben `now` **obligatorio** (sin valor por defecto); los casos
  de uso lo piden al `Clock`. Los value objects de identidad ya no tienen `generate()`:
  validan lo que reciben (`EventId.create(ids.generate())`).
- `shared/domain/uuid.ts` solo valida el formato.
- Dos pruebas de arquitectura lo vigilan: `domain/` no importa módulos de Node y ni
  `domain/` ni `application/` usan `new Date()`, `Date.now()` o `Math.random()`.

## Por qué
- Las reglas temporales se prueban en sus bordes exactos con un reloj fijo, sin esperas ni
  fechas relativas a "hoy" que fallan con el tiempo.
- El dominio queda en TypeScript puro y determinista: misma entrada, misma salida.
- Cambiar la fuente de azar (o hacerla determinista en una prueba) es tocar una línea del módulo.

## Consecuencias
- Los constructores de los handlers tienen más dependencias (reloj, ids, generador).
- La espera aleatoria entre reintentos (`shared/application/retry.ts`) usa `Math.random`:
  no es una regla de negocio sino una técnica para que los reintentos no vuelvan a chocar,
  y no afecta a ningún resultado observable.

## Alternativas descartadas
- Mantener `now = new Date()` por defecto: es cómodo pero permite olvidarse de inyectarlo.
- Mockear `Date` globalmente en las pruebas (`jest.useFakeTimers`): oculta la dependencia en
  lugar de hacerla explícita.
