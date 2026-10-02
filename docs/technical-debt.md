# Deuda técnica y limitaciones conocidas

Registro honesto de lo que **no** está resuelto, por qué y cómo se abordaría.

| ID | Tema | Situación actual | Riesgo | Propuesta |
|---|---|---|---|---|
| TD-001 | Publicación de eventos | `EventBus` en memoria; los eventos se publican tras `save()` pero fuera de una transacción común. Si el proceso cae entre ambos pasos, el evento se pierde. | Una tarea podría quedar asignada a un miembro desactivado (RN-013) | *Transactional outbox*: guardar eventos en una tabla en la misma transacción y publicarlos con reintentos |
| TD-002 | Consistencia de RN-013 | La liberación de tareas es eventualmente consistente y un fallo del oyente solo se registra en log | Igual que TD-001 | Reintentos + comando idempotente (ya lo es: tareas sin responsable no generan cambios) |
| TD-003 | Liberación de varias tareas | `ReleaseMemberTasksHandler` guarda cada tarea por separado (sin transacción) | Liberación parcial si falla a mitad; reejecutarlo es seguro | Puerto de *unit of work* o `saveMany` transaccional |
| ~~TD-004~~ | Concurrencia sobre un mismo agregado | **RESUELTO** en la auditoría: bloqueo optimista con columna `version` (ADR-011). Antes, una petición concurrente podía devolver a un miembro desactivado una tarea ya liberada | — | — |
| TD-005 | Autenticación / autorización | No existe; cualquier cliente puede usar la API. El hash se guarda y `PasswordHasher.verify` está listo para un login futuro | Uso solo en red interna | Contexto/ módulo `auth` con JWT y guardas por rol |
| TD-006 | Paginación | `GET /tasks` devuelve todo el tablero | Rendimiento con miles de tareas | Paginación por cursor (`created_at, id`), índice ya existe |
| TD-007 | Endurecimiento HTTP | **Parcial**: `helmet` añadido en la auditoría. Falta rate limiting y CORS explícito | Abuso de `POST /users` (el hash scrypt es costoso a propósito) si se expone a Internet | `@nestjs/throttler` con límites por variable de entorno; CORS configurable |
| TD-008 | Lectura CQRS | Las consultas leen del mismo almacén mediante el repositorio del agregado | Ninguno a esta escala | Proyecciones de lectura dedicadas si el tablero crece (ADR-003) |
| TD-009 | Contenerización de la API | Docker Compose solo levanta PostgreSQL; la API corre con Node local | Diferencias de entorno | `Dockerfile` multi-stage + servicio `api` en Compose |
| TD-010 | Observabilidad | Logs de texto de Nest | Diagnóstico limitado | Logs estructurados (JSON) con *correlation id*, sin datos sensibles |
| TD-011 | Funcionalidades de dominio | No hay renombrado/edición de tareas, reactivación de usuarios ni borrado | Alcance reducido a propósito | Añadir como nuevos casos de uso cuando el negocio los pida |
| TD-012 | Carrera asignación ↔ desactivación | `AssignTask` comprueba que el miembro está activo y después guarda. Si el miembro se desactiva justo entre ambos pasos y su liberación ya terminó, la tarea queda asignada a un inactivo (ventana de milisegundos) | Bajo | Que la liberación vuelva a ejecutarse al recibir `TaskAssigned` de un miembro inactivo, o validar en la misma transacción con `SELECT … FOR SHARE` |
| TD-013 | Datos corruptos en la base | Si una fila viola las reglas del dominio (editada a mano), la lectura responde 400 con el código de validación en vez de 500 | Mensaje engañoso para el cliente | Traducir los errores de `fromPrimitives` en el adaptador a un error técnico (500) y registrar la fila |
| TD-014 | Log de 413 | Un cuerpo demasiado grande responde 413 correctamente, pero Nest lo registra como `ERROR` | Ruido en logs | Filtro para errores `http-errors` de body-parser |
