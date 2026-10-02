# ADR-009 — Configuración validada fail-fast y centralizada en `src/config`

## Contexto
Una variable ausente con un valor por defecto "razonable" (p. ej. `localhost`) puede
hacer que la aplicación arranque contra un destino equivocado sin que nadie lo note.

## Decisión
- `src/config/env.validation.ts` define el contrato (`EnvironmentVariables`) y lo
  valida con `class-validator` al arrancar (`ConfigModule.forRoot({ validate })`) y en
  el CLI de migraciones. **Todas** las variables son obligatorias, sin valores por defecto.
- Solo `src/config/` lee `process.env`; el resto usa `ConfigService` tipado.
- `.env` está ignorado por Git; `.env.example` documenta cada variable.
- Con `NODE_ENV=test` se usa `DB_NAME_TEST`; el e2e se niega a ejecutarse si coincide
  con `DB_NAME`.
- `docker-compose.yml` lee el mismo `.env` y usa `${VAR:?}` para fallar si falta algo.

## Por qué
- Fallar al arrancar es más barato que diagnosticar un comportamiento incorrecto en ejecución.
- Centralizar el acceso al entorno hace auditable qué configuración existe.
- Separar la base de pruebas evita que `pnpm test:e2e` borre datos de desarrollo.
- Los mensajes de error nombran la variable pero no su valor, para no filtrar secretos.

## Consecuencias
- Hay que copiar `.env.example` a `.env` antes del primer arranque (documentado en el README).

## Alternativas descartadas
- Defaults en código: ocultan errores de configuración.
- `joi`: añadiría una dependencia más; `class-validator` ya forma parte del stack.
