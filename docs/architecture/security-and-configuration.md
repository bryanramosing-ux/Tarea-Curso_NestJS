# Seguridad y configuración

## Configuración

| Medida | Dónde |
|---|---|
| Todas las variables vienen del entorno / `.env` | `.env.example` documenta cada una |
| `.env` y `.env.*` ignorados por Git (excepto `.env.example`) | `.gitignore`; verificado en `test/architecture` |
| Validación **fail-fast** al arrancar (app y CLI de migraciones) | `src/config/env.validation.ts` |
| Sin valores por defecto peligrosos (ni host, ni puerto, ni credenciales, ni secretos) | `EnvironmentVariables` exige todas |
| `TICKET_CODE_SECRET` obligatorio y de al menos 32 caracteres | validación + `HmacTicketCodeHasher` |
| Errores que nombran la variable pero **nunca su valor** | prueba `never prints secret values in the error message` |
| Solo `src/config/` lee `process.env`; el resto usa `ConfigService` | verificado en `test/architecture` |
| Docker Compose usa el mismo `.env` y falla si falta algo (`${VAR:?}`) | `docker-compose.yml` |
| Base de pruebas separada (`DB_NAME_TEST`); las e2e se niegan a correr si coincide con `DB_NAME` | `test/e2e/support/global-setup.ts` |

## Códigos de entrada (el "secreto" de este dominio)

Quien tiene el código de una entrada, entra. Se trata como una credencial:

| Medida | Dónde |
|---|---|
| Código aleatorio con CSPRNG (`crypto.randomInt`), ~59 bits, sin caracteres ambiguos | `TicketCode.generate`, `shared/domain/uuid.ts` |
| Se entrega **una sola vez**, en la respuesta de la compra | `PurchaseTicketsResult` |
| Solo se guarda su **HMAC-SHA256** con un secreto del servidor | `HmacTicketCodeHasher`; columna `code_hash` |
| Con una copia de la base no se pueden validar códigos candidatos sin el secreto | ADR-008 |
| `TicketCode` devuelve `[REDACTED]` en `toString()`/`toJSON()` | evita fugas en logs |
| Las vistas (`TicketView`) no incluyen código ni hash | `toTicketView`; pruebas unitarias y e2e |
| Los eventos de dominio no llevan el código ni el email | `ticket.spec.ts` |
| Mensajes de error sin el código recibido | `InvalidTicketCodeError` |
| Fuerza bruta inviable: 31¹² ≈ 7,9·10¹⁷ combinaciones | (sin rate limiting todavía: TD-007) |

## Integridad de las compras

| Medida | Dónde |
|---|---|
| El cliente no puede fijar el precio: `forbidNonWhitelisted` rechaza `priceCents` en la compra | e2e / sondeo manual |
| Importes en céntimos enteros (sin errores de coma flotante) | `Money`, `TicketPrice` |
| Imposible sobrevender: dominio + bloqueo optimista + `CHECK` | RN-009, ADR-011, ADR-012 |
| Máximo 10 entradas por compra | RN-008 |

## Borde HTTP

| Medida | Dónde |
|---|---|
| `helmet`: `nosniff`, CSP, `X-Frame-Options`, HSTS…, sin `X-Powered-By` | `src/app.setup.ts`; e2e `http-security.e2e-spec.ts` |
| Límite de cuerpo de 100 kB → 413 | e2e |
| `__proto__`/`constructor` descartados (sin contaminación de prototipos) | e2e + sondeo manual |
| Consultas parametrizadas: entrada con aspecto de SQL se guarda como texto | e2e |
| Todas las respuestas de error con la misma forma, sin trazas internas | filtros |
| PostgreSQL publicado solo en `127.0.0.1` | `docker-compose.yml` |

## Logs

- TypeORM con `logging: false`: no se registran consultas ni parámetros (hashes, emails).
- El oyente de eventos solo registra ids y el mensaje de error.
- No se registra ningún cuerpo de petición.

## Fuera de alcance (documentado)

Autenticación/autorización (cualquiera puede programar o cancelar eventos), pasarela de
pago, rate limiting y envío de la entrada por email: ver [`../technical-debt.md`](../technical-debt.md).
