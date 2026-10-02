# ADR-004 — `DomainException` con `code` + `kind` y un único filtro HTTP

## Contexto
Los errores de negocio deben llegar al cliente con un estado HTTP correcto y un
identificador estable, pero el dominio no puede conocer HTTP ni NestJS.

## Decisión
- `DomainException` abstracta en `shared/domain` con `code` (string estable, p. ej.
  `TASK_REQUIRES_ASSIGNEE`) y `kind` (`VALIDATION | NOT_FOUND | CONFLICT`).
- Una subclase por error en `<contexto>/domain/errors/`.
- Un único `DomainExceptionFilter` traduce `kind → 400/404/409` con un `switch`
  exhaustivo (chequeo `never`).
- Los adaptadores **no** lanzan "no encontrado": devuelven `null` y el handler decide.

## Por qué
- `kind` captura la semántica que le importa al dominio (dato inválido, no existe,
  choca con el estado actual); el mapeo a HTTP es un detalle de un adaptador.
- `code` permite a los clientes reaccionar sin parsear mensajes y documentar el
  contrato (`docs/business-rules/error-catalog.md`).
- Un solo punto de traducción evita inconsistencias y garantiza que un error de
  negocio nunca acabe en 500.

## Consecuencias
- Añadir un `kind` obliga a actualizar el filtro (el compilador lo exige).
- Los errores de forma del DTO usan su propio código (`REQUEST_VALIDATION_FAILED`)
  porque no son errores de dominio.

## Alternativas descartadas
- `NotFoundException`/`ConflictException` de Nest en el dominio: prohibido por la rúbrica.
- Varios filtros por contexto: duplicaría el mapeo.
