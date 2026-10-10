# Seguridad y configuración

## Configuración

| Medida | Dónde |
|---|---|
| Todas las variables vienen del entorno / `.env` | `.env.example` documenta cada una |
| `.env` y `.env.*` ignorados por Git (excepto `.env.example`) | `.gitignore`; verificado en `test/architecture` |
| Validación **fail-fast** al arrancar (app y CLI de migraciones) | `src/config/env.validation.ts` |
| Sin valores por defecto peligrosos (ni host, ni puerto, ni credenciales, ni secretos) | `EnvironmentVariables` exige todas |
| `TICKET_CODE_SECRET`, `ORGANIZER_API_KEY`, `GATE_API_KEY` obligatorios y de al menos 32 caracteres; las dos claves, distintas | validación + `HmacTicketCodeHasher` |
| En `production`, los valores públicos de `.env.example` (marcador `change-me`) **impiden arrancar** | `crossFieldErrors` en `env.validation.ts`; prueba `rejects the public example value…` |
| `TRUST_PROXY` estricto (`true`/`false`): sin la conversión implícita que haría `Boolean("false") === true` | `env.validation.ts` |
| Errores que nombran la variable pero **nunca su valor** | prueba `never prints secret values in the error message` |
| Solo `src/config/` lee `process.env`; el resto usa `ConfigService` | verificado en `test/architecture` |
| Docker Compose usa el mismo `.env` y falla si falta algo (`${VAR:?}`) | `docker-compose.yml` |
| Base de pruebas separada (`DB_NAME_TEST`); las e2e se niegan a correr si coincide con `DB_NAME` | `test/e2e/support/global-setup.ts` |

## Códigos de entrada (el "secreto" de este dominio)

Quien tiene el código de una entrada, entra. Se trata como una credencial:

| Medida | Dónde |
|---|---|
| Código aleatorio con CSPRNG (`crypto.randomInt`), 31¹² ≈ 2⁵⁹ combinaciones, sin caracteres ambiguos | puerto `TicketCodeGenerator`, adaptador `CryptoTicketCodeGenerator` |
| Se entrega **una sola vez**, en la respuesta de la compra | `PurchaseTicketsResult` |
| Solo se guarda su **HMAC-SHA256** con un secreto del servidor | `HmacTicketCodeHasher`; columna `code_hash` |
| Con una copia de la base no se pueden validar códigos candidatos sin el secreto | ADR-008 |
| `TicketCode` devuelve `[REDACTED]` en `toString()`/`toJSON()` | evita fugas en logs |
| Las vistas (`TicketView`) no incluyen código ni hash | `toTicketView`; pruebas unitarias y e2e |
| Los eventos de dominio no llevan el código ni el email | `ticket.spec.ts` |
| Mensajes de error sin el código recibido | `InvalidTicketCodeError` |
| Fuerza bruta inviable: 31¹² ≈ 7,9·10¹⁷ combinaciones; además el check-in exige la clave de puerta y tiene un límite estricto de peticiones por IP | `ApiKeyGuard`, `THROTTLE_SENSITIVE_LIMIT` |
| Una entrada solo sirve en la puerta de **su** evento, si no fue cancelado y en horario de puertas | RN-016 |

## Integridad de las compras

| Medida | Dónde |
|---|---|
| El cliente no puede fijar el precio: `forbidNonWhitelisted` rechaza `priceCents` en la compra | e2e / sondeo manual |
| Importes en céntimos enteros (sin errores de coma flotante) | `Money`, `TicketPrice` |
| Imposible sobrevender: dominio + bloqueo optimista + `CHECK` | RN-009, ADR-011, ADR-012 |
| Compra atómica: cupo y entradas en una transacción | ADR-013 |
| Máximo 10 entradas por compra y 10 entradas activas por titular y evento | RN-008 |
| Límite estricto de compras por IP (`THROTTLE_SENSITIVE_LIMIT`) | ADR-014 |
| Un evento cancelado no vende aunque su cupo siga abierto (el catálogo manda) | RN-010, ADR-016 |

## Autenticación y autorización (ADR-014)

| Ruta | Acceso |
|---|---|
| `GET /events`, `GET /events/:id`, `GET /tickets/availability/:eventId`, `POST /tickets` | Público |
| `POST /events`, `POST /events/:id/cancel`, `POST /tickets/sales/reconcile` | Organizador (`ORGANIZER_API_KEY`) |
| `POST /tickets/check-in`, `GET /tickets/:id` (contiene nombre y email del titular) | Puerta (`GATE_API_KEY`) u organizador |

| Medida | Dónde |
|---|---|
| Cabecera `Authorization: Bearer <clave>`; 401 sin clave o desconocida (con `WWW-Authenticate: Bearer`), 403 con la de otro rol | `ApiKeyGuard`; e2e `401 without a key, 403 with the key of another role…` |
| Comparación en tiempo constante (`timingSafeEqual` sobre SHA-256), sin cortocircuito entre claves | `api-key.guard.ts` |
| La clave recibida nunca aparece en respuestas ni logs | prueba `never includes the received key in the error` |
| Guard global (`APP_GUARD`): una ruta nueva es pública salvo que se marque con `@RequireRoles` | `app.module.ts` |

## Límite de peticiones (ADR-014)

| Medida | Dónde |
|---|---|
| `THROTTLE_LIMIT` peticiones por IP, ruta y ventana (`THROTTLE_TTL_SECONDS`) | `throttler.config.ts` |
| `THROTTLE_SENSITIVE_LIMIT` adicional en compra y check-in (`@SensitiveRoute`) | `tickets.controller.ts` |
| Se evalúa antes que la autenticación (también frena la fuerza bruta de claves) | orden de `APP_GUARD` en `app.module.ts` |
| 429 `TOO_MANY_REQUESTS` con la forma de error habitual | e2e `rate-limit.e2e-spec.ts` |
| IP real detrás de un proxy solo con `TRUST_PROXY=true` | `app.setup.ts` |

## Borde HTTP

| Medida | Dónde |
|---|---|
| `helmet`: `nosniff`, CSP, `X-Frame-Options`, HSTS…, sin `X-Powered-By` | `src/app.setup.ts`; e2e `http-security.e2e-spec.ts` |
| Límite de cuerpo de 100 kB → 413 `PAYLOAD_TOO_LARGE` (aviso en el log, no error) | `UnhandledExceptionFilter`; e2e |
| Los mensajes de validación no repiten el valor recibido (sin entrada reflejada) | errores de dominio; e2e `validation errors never echo the received value` |
| `GET /events` paginado (máximo 100 por página): no se puede pedir la cartelera entera de una vez | `ListEventsQueryDto` |
| `__proto__`/`constructor` descartados (sin contaminación de prototipos) | e2e + sondeo manual |
| Consultas parametrizadas: entrada con aspecto de SQL se guarda como texto | e2e |
| Todas las respuestas de error con la misma forma, sin trazas internas; un fallo del servidor responde 500 genérico | filtros; e2e `a corrupted row answers a generic 500…` |
| PostgreSQL publicado solo en `127.0.0.1` | `docker-compose.yml` |

## Logs

- TypeORM con `logging: false`: no se registran consultas ni parámetros (hashes, emails).
- El oyente de eventos y la conciliación solo registran ids y el mensaje de error.
- `UnhandledExceptionFilter` registra método, ruta y error con su traza (nunca el cuerpo).
- No se registra ningún cuerpo de petición ni cabecera `Authorization`.
- El CLI de migraciones (`pnpm migration:run`) sí imprime las sentencias SQL de las
  migraciones (comportamiento del CLI de TypeORM); no contienen datos de usuarios.

## Fuera de alcance (documentado)

Usuarios individuales (las claves son por rol), pasarela de pago, límite de peticiones
compartido entre varias instancias, CORS para navegadores y envío de la entrada por email:
ver [`../technical-debt.md`](../technical-debt.md).
