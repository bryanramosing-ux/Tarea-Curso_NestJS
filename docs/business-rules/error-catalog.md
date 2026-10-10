# Catálogo de errores

Los `code` son **estables**: forman parte del contrato con los clientes. El dominio solo
declara el `kind`; la traducción a HTTP ocurre únicamente en
`src/shared/infrastructure/http/domain-exception.filter.ts`.

| `kind` | HTTP |
|---|---|
| `VALIDATION` | 400 Bad Request |
| `NOT_FOUND` | 404 Not Found |
| `CONFLICT` | 409 Conflict |

Formato de toda respuesta de error (también de los errores del framework y de los 500):

```json
{ "statusCode": 409, "code": "TICKET_NOT_ENOUGH_AVAILABLE", "message": "Requested 2 ticket(s) but only 1 available", "path": "/tickets", "timestamp": "…" }
```

Los mensajes de validación **no repiten el valor recibido** (p. ej. `"Event status must be
SCHEDULED or CANCELLED"`, no `"\"<script>\" is not a valid…"`), para no reflejar la entrada
del cliente. Tampoco revelan secretos ni el código de una entrada.

## Borde HTTP (no son errores de dominio)

Los traducen `HttpExceptionFilter` y, como último recurso, `UnhandledExceptionFilter`, con
la misma forma.

| Código | HTTP | Cuándo |
|---|---|---|
| `REQUEST_VALIDATION_FAILED` | 400 | El DTO no cumple tipos/tamaños, trae propiedades no permitidas, un `:id` no es UUID o la paginación es inválida (`message` es la lista de problemas) |
| `BAD_REQUEST` | 400 | El cuerpo no es JSON válido |
| `UNAUTHORIZED` | 401 | Ruta del personal sin cabecera `Authorization: Bearer <clave>` o con una clave desconocida (incluye `WWW-Authenticate: Bearer`) |
| `FORBIDDEN` | 403 | La clave es válida pero de otro rol (p. ej. la de puerta para cancelar un evento) |
| `ROUTE_NOT_FOUND` | 404 | La ruta o el método no existen |
| `PAYLOAD_TOO_LARGE` | 413 | El cuerpo supera 100 kB (se registra como aviso, no como error del servidor) |
| `TOO_MANY_REQUESTS` | 429 | Se superó el límite de peticiones por IP (`THROTTLE_*`) |
| `INTERNAL_ERROR` | 500 | Fallo del servidor: base caída, **fila corrupta** que viola las reglas del dominio (`PersistedDataCorruptedError`)... El detalle va al log; el cliente solo recibe un mensaje genérico |

## Contexto Catálogo

| Código | Kind | HTTP | Regla |
|---|---|---|---|
| `EVENT_INVALID_ID` | VALIDATION | 400 | — |
| `EVENT_INVALID_NAME` | VALIDATION | 400 | RN-001 |
| `EVENT_INVALID_VENUE` | VALIDATION | 400 | RN-002 |
| `EVENT_INVALID_START` | VALIDATION | 400 | RN-003 (fecha inválida o sin zona horaria) |
| `EVENT_START_IN_PAST` | VALIDATION | 400 | RN-003 |
| `EVENT_INVALID_CAPACITY` | VALIDATION | 400 | RN-004 |
| `EVENT_INVALID_PRICE` | VALIDATION | 400 | RN-005 |
| `EVENT_INVALID_STATUS` | VALIDATION | 400 | Filtro `status` desconocido |
| `EVENT_NOT_FOUND` | NOT_FOUND | 404 | — |
| `EVENT_SLOT_TAKEN` | CONFLICT | 409 | RN-006 |
| `EVENT_ALREADY_CANCELLED` | CONFLICT | 409 | RN-007 |
| `EVENT_ALREADY_STARTED` | CONFLICT | 409 | RN-007 |
| `EVENT_CONCURRENT_MODIFICATION` | CONFLICT | 409 | Bloqueo optimista (ADR-011) |

## Contexto Venta de entradas

| Código | Kind | HTTP | Regla |
|---|---|---|---|
| `TICKET_INVALID_ID` | VALIDATION | 400 | — |
| `TICKET_INVALID_EVENT_ID` | VALIDATION | 400 | — |
| `TICKET_INVALID_QUANTITY` | VALIDATION | 400 | RN-008 (1–10 por compra) |
| `TICKET_INVALID_HOLDER_NAME` | VALIDATION | 400 | RN-011 |
| `TICKET_INVALID_HOLDER_EMAIL` | VALIDATION | 400 | RN-011 |
| `TICKET_INVALID_CODE` | VALIDATION | 400 | RN-012 |
| `TICKET_INVALID_EVENT_DATA` | VALIDATION | 400 | El catálogo devolvió datos no utilizables para vender (en la práctica no ocurre: el catálogo ya los valida) |
| `TICKET_EVENT_NOT_FOUND` | NOT_FOUND | 404 | El evento no existe (compra, disponibilidad, check-in) |
| `TICKET_NOT_FOUND` | NOT_FOUND | 404 | — |
| `TICKET_SALES_CLOSED` | CONFLICT | 409 | RN-010, RN-014 |
| `TICKET_EVENT_ALREADY_STARTED` | CONFLICT | 409 | RN-010 |
| `TICKET_HOLDER_LIMIT_EXCEEDED` | CONFLICT | 409 | RN-008 (más de 10 entradas activas por titular y evento) |
| `TICKET_NOT_ENOUGH_AVAILABLE` | CONFLICT | 409 | RN-009 |
| `TICKET_ALREADY_USED` | CONFLICT | 409 | RN-013 |
| `TICKET_REFUNDED` | CONFLICT | 409 | RN-013 |
| `TICKET_WRONG_EVENT` | CONFLICT | 409 | RN-016 (entrada de otro evento) |
| `TICKET_EVENT_CANCELLED` | CONFLICT | 409 | RN-016 (evento cancelado) |
| `TICKET_CHECK_IN_NOT_OPEN` | CONFLICT | 409 | RN-016 (más de 12 h antes del inicio) |
| `TICKET_CHECK_IN_CLOSED` | CONFLICT | 409 | RN-016 (más de 24 h después del inicio) |
| `TICKET_EVENT_NOT_CANCELLED` | CONFLICT | 409 | RN-014 (protección interna del cierre de ventas; ningún endpoint la expone) |
| `TICKET_SALES_CONCURRENT_MODIFICATION` | CONFLICT | 409 | Muchas compras simultáneas agotaron los reintentos (ADR-011) |
| `TICKET_CONCURRENT_MODIFICATION` | CONFLICT | 409 | Bloqueo optimista (ADR-011) |

## Datos persistidos corruptos (500, no 400)

Estos códigos los lanzan los value objects y agregados al **reconstruirse** desde la base.
Si una fila viola las reglas del dominio, el mapper los envuelve en
`PersistedDataCorruptedError` (`src/shared/infrastructure/persistence/persisted-data-corrupted.error.ts`)
y la respuesta es **500 `INTERNAL_ERROR`**: es un fallo del servidor, no del cliente.

`EVENT_INVARIANT_VIOLATION`, `TICKET_INVARIANT_VIOLATION`, `TICKET_INVALID_MONEY`,
`TICKET_INVALID_CODE_HASH`, `TICKET_INVALID_STATUS`, `TICKET_INVALID_SALES_STATUS`,
`INVALID_AGGREGATE_VERSION`.
