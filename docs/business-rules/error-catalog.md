# Catálogo de errores

Los `code` son **estables**: forman parte del contrato con los clientes. El dominio solo
declara el `kind`; la traducción a HTTP ocurre únicamente en
`src/shared/infrastructure/http/domain-exception.filter.ts`.

| `kind` | HTTP |
|---|---|
| `VALIDATION` | 400 Bad Request |
| `NOT_FOUND` | 404 Not Found |
| `CONFLICT` | 409 Conflict |

Formato de toda respuesta de error:

```json
{ "statusCode": 409, "code": "TICKET_NOT_ENOUGH_AVAILABLE", "message": "Requested 2 ticket(s) but only 1 available", "path": "/tickets", "timestamp": "…" }
```

## Borde HTTP (no son errores de dominio)

Los traduce `HttpExceptionFilter` con la misma forma.

| Código | HTTP | Cuándo |
|---|---|---|
| `REQUEST_VALIDATION_FAILED` | 400 | El DTO no cumple tipos/tamaños, trae propiedades no permitidas, o un `:id` no es UUID (`message` es la lista de problemas) |
| `BAD_REQUEST` | 400 | El cuerpo no es JSON válido |
| `ROUTE_NOT_FOUND` | 404 | La ruta o el método no existen |
| *(sin código)* | 413 | El cuerpo supera 100 kB |

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
| `EVENT_INVALID_STATUS` | VALIDATION | 400 | — |
| `EVENT_INVARIANT_VIOLATION` | VALIDATION | 400 | Dato persistido corrupto |
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
| `TICKET_INVALID_QUANTITY` | VALIDATION | 400 | RN-008 |
| `TICKET_INVALID_HOLDER_NAME` | VALIDATION | 400 | RN-011 |
| `TICKET_INVALID_HOLDER_EMAIL` | VALIDATION | 400 | RN-011 |
| `TICKET_INVALID_CODE` | VALIDATION | 400 | RN-012 |
| `TICKET_INVALID_MONEY` | VALIDATION | 400 | RN-015 |
| `TICKET_INVALID_CODE_HASH`, `TICKET_INVALID_STATUS`, `TICKET_INVALID_SALES_STATUS`, `TICKET_INVALID_EVENT_DATA`, `TICKET_INVARIANT_VIOLATION` | VALIDATION | 400 | Datos persistidos o recibidos del catálogo corruptos |
| `TICKET_EVENT_NOT_FOUND` | NOT_FOUND | 404 | — |
| `TICKET_NOT_FOUND` | NOT_FOUND | 404 | — |
| `TICKET_SALES_CLOSED` | CONFLICT | 409 | RN-010, RN-014 |
| `TICKET_EVENT_ALREADY_STARTED` | CONFLICT | 409 | RN-010 |
| `TICKET_NOT_ENOUGH_AVAILABLE` | CONFLICT | 409 | RN-009 |
| `TICKET_ALREADY_USED` | CONFLICT | 409 | RN-013 |
| `TICKET_REFUNDED` | CONFLICT | 409 | RN-013 |
| `TICKET_SALES_CONCURRENT_MODIFICATION` | CONFLICT | 409 | Muchas compras simultáneas agotaron los reintentos (ADR-011) |
| `TICKET_CONCURRENT_MODIFICATION` | CONFLICT | 409 | Bloqueo optimista (ADR-011) |

## Comunes

| Código | Kind | HTTP | Cuándo |
|---|---|---|---|
| `INVALID_AGGREGATE_VERSION` | VALIDATION | 400 | Una fila almacenada tiene una versión inválida (dato corrupto) |
