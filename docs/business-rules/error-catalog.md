# Catálogo de errores

Los `code` son **estables**: forman parte del contrato con los clientes y no cambian
aunque cambie el mensaje. El dominio solo declara el `kind`; la traducción a HTTP
ocurre únicamente en `src/shared/infrastructure/http/domain-exception.filter.ts`.

| `kind` | HTTP |
|---|---|
| `VALIDATION` | 400 Bad Request |
| `NOT_FOUND` | 404 Not Found |
| `CONFLICT` | 409 Conflict |

Formato de respuesta de un error de dominio:

```json
{ "statusCode": 409, "code": "TASK_INVALID_STATUS_TRANSITION", "message": "A task cannot move from IN_PROGRESS to DONE", "path": "/tasks/…/status", "timestamp": "…" }
```

## Borde HTTP (no son errores de dominio)

| Código | HTTP | Cuándo |
|---|---|---|
| `REQUEST_VALIDATION_FAILED` | 400 | El DTO no cumple tipos/tamaños o trae propiedades no permitidas (`message` es la lista de problemas) |
| *(Nest `ParseUUIDPipe`)* | 400 | `:id` en la ruta no es un UUID |

## Contexto Users

| Código | Kind | HTTP | Regla |
|---|---|---|---|
| `USER_INVALID_ID` | VALIDATION | 400 | — |
| `USER_INVALID_EMAIL` | VALIDATION | 400 | RN-001 |
| `USER_INVALID_NAME` | VALIDATION | 400 | RN-003 |
| `USER_WEAK_PASSWORD` | VALIDATION | 400 | RN-004 |
| `USER_INVALID_PASSWORD_HASH` | VALIDATION | 400 | RN-004 (dato persistido corrupto) |
| `USER_INVALID_STATUS` | VALIDATION | 400 | — |
| `USER_INVALID_TIMESTAMPS` | VALIDATION | 400 | — (dato persistido corrupto) |
| `USER_NOT_FOUND` | NOT_FOUND | 404 | — |
| `USER_EMAIL_ALREADY_IN_USE` | CONFLICT | 409 | RN-002 |
| `USER_ALREADY_INACTIVE` | CONFLICT | 409 | RN-005 |

## Contexto Tasks

| Código | Kind | HTTP | Regla |
|---|---|---|---|
| `TASK_INVALID_ID` | VALIDATION | 400 | — |
| `TASK_INVALID_TITLE` | VALIDATION | 400 | RN-006 |
| `TASK_INVALID_DESCRIPTION` | VALIDATION | 400 | RN-007 |
| `TASK_INVALID_STATUS` | VALIDATION | 400 | RN-009 |
| `TASK_INVALID_PRIORITY` | VALIDATION | 400 | RN-014 |
| `TASK_INVALID_ASSIGNEE_ID` | VALIDATION | 400 | — |
| `TASK_INVARIANT_VIOLATION` | VALIDATION | 400 | RN-010 (dato persistido corrupto) |
| `TASK_NOT_FOUND` | NOT_FOUND | 404 | — |
| `TASK_ASSIGNEE_NOT_FOUND` | NOT_FOUND | 404 | RN-011 |
| `TASK_ASSIGNEE_INACTIVE` | CONFLICT | 409 | RN-011 |
| `TASK_INVALID_STATUS_TRANSITION` | CONFLICT | 409 | RN-009 |
| `TASK_REQUIRES_ASSIGNEE` | CONFLICT | 409 | RN-010 |
| `TASK_ALREADY_DONE` | CONFLICT | 409 | RN-012 |
