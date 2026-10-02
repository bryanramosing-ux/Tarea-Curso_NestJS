# Seguridad y configuración

## Configuración

| Medida | Dónde |
|---|---|
| Todas las variables vienen del entorno / `.env` | `.env.example` documenta cada una |
| `.env` y `.env.*` ignorados por Git (excepto `.env.example`) | `.gitignore`; verificado en `test/architecture` |
| Validación **fail-fast** al arrancar (app y CLI de migraciones) | `src/config/env.validation.ts` (`class-validator`) |
| Sin valores por defecto peligrosos (ni `localhost`, ni puerto, ni credenciales) | `EnvironmentVariables` exige todas |
| Mensajes de error que nombran la variable pero **nunca su valor** | prueba `never prints secret values in the error message` |
| Solo `src/config/` lee `process.env`; el resto usa `ConfigService` | verificado en `test/architecture` |
| Docker Compose usa el mismo `.env` y falla si falta una variable (`${VAR:?}`) | `docker-compose.yml` |
| Base de pruebas separada (`DB_NAME_TEST`); el e2e se niega a correr si coincide con `DB_NAME` | `test/e2e/support/global-setup.ts` |

## Contraseñas

| Medida | Dónde |
|---|---|
| Política en el dominio: 8–72 caracteres, letra y dígito (RN-004) | `PlainPassword` |
| Hash con **scrypt** (N=16384, r=8, p=1, sal aleatoria de 16 bytes, clave de 64 bytes); comparación en tiempo constante | `ScryptPasswordHasher` (puerto `PasswordHasher`) |
| Solo se persiste el hash (`password_hash`) | `UserOrmEntity`, prueba e2e que lee la fila |
| `PlainPassword` y `PasswordHash` devuelven `[REDACTED]` en `toString()`/`toJSON()` | evita fugas accidentales en logs o serializaciones |
| Las vistas (`UserView`) se construyen campo a campo y **no** incluyen hash | `toUserView`; pruebas unitarias y e2e buscan `password|hash` en las respuestas |
| Los eventos (`UserRegistered`) no transportan credenciales | `user.spec.ts` |
| Los errores de validación no devuelven los valores recibidos | `validationError: { target: false, value: false }` y mensajes de dominio sin el valor |

## Borde HTTP

| Medida | Dónde |
|---|---|
| Cabeceras de seguridad con `helmet` (`X-Content-Type-Options: nosniff`, CSP, `X-Frame-Options`, HSTS…) y sin `X-Powered-By` | `src/app.setup.ts`; e2e `http-security.e2e-spec.ts` |
| Límite de cuerpo de 100 kB (por defecto de Express) → 413 | e2e `rejects bodies larger than the limit` |
| Claves `__proto__`/`constructor` descartadas por class-transformer: sin contaminación de prototipos | e2e `ignores __proto__ / constructor payloads` |
| Consultas parametrizadas (TypeORM): la entrada con aspecto de SQL se guarda como texto | e2e `treats SQL-looking input as plain data` |
| Todas las respuestas de error con la misma forma, sin trazas internas | `HttpExceptionFilter` + `DomainExceptionFilter` |
| PostgreSQL publicado solo en `127.0.0.1` (no accesible desde la red local) | `docker-compose.yml` |
| Dependencias sin vulnerabilidades conocidas (`pnpm audit`), versiones fijadas en `package.json` + `pnpm-lock.yaml` | ver `docs/audit-checklist.md` |

## Logs

- TypeORM con `logging: false`: no se registran consultas ni sus parámetros.
- El oyente de eventos solo registra ids y el mensaje de error.
- No se registra ningún cuerpo de petición.

## Fuera de alcance (documentado)

Autenticación/autorización y rate limiting no forman parte de esta entrega; ver [`../technical-debt.md`](../technical-debt.md).
