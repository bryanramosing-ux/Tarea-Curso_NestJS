# Deuda técnica y limitaciones conocidas

Registro honesto de lo que **no** está resuelto, por qué y cómo se abordaría.

| ID | Tema | Situación actual | Riesgo | Propuesta |
|---|---|---|---|---|
| TD-001 | Publicación de eventos | `EventBus` en memoria; los eventos se publican tras `save()` pero fuera de una transacción común. Si el proceso cae entre ambos pasos, el evento se pierde. | Una tarea podría quedar asignada a un miembro desactivado (RN-013) | *Transactional outbox*: guardar eventos en una tabla en la misma transacción y publicarlos con reintentos |
| TD-002 | Consistencia de RN-013 | La liberación de tareas es eventualmente consistente y un fallo del oyente solo se registra en log | Igual que TD-001 | Reintentos + comando idempotente (ya lo es: tareas sin responsable no generan cambios) |
| TD-003 | Liberación de varias tareas | `ReleaseMemberTasksHandler` guarda cada tarea por separado (sin transacción) | Liberación parcial si falla a mitad; reejecutarlo es seguro | Puerto de *unit of work* o `saveMany` transaccional |
| TD-004 | Concurrencia sobre una misma tarea | Sin bloqueo optimista: dos movimientos simultáneos se resuelven con "el último gana" (las invariantes se mantienen por las `CHECK`) | Una transición podría basarse en un estado ya obsoleto | Columna `version` + `@VersionColumn` en el modelo ORM y error CONFLICT al detectar colisión |
| TD-005 | Autenticación / autorización | No existe; cualquier cliente puede usar la API. El hash se guarda y `PasswordHasher.verify` está listo para un login futuro | Uso solo en red interna | Contexto/ módulo `auth` con JWT y guardas por rol |
| TD-006 | Paginación | `GET /tasks` devuelve todo el tablero | Rendimiento con miles de tareas | Paginación por cursor (`created_at, id`), índice ya existe |
| TD-007 | Endurecimiento HTTP | Sin `helmet`, CORS explícito ni rate limiting | Exposición si se publica en Internet | Añadir `helmet`, `@nestjs/throttler` y CORS configurable |
| TD-008 | Lectura CQRS | Las consultas leen del mismo almacén mediante el repositorio del agregado | Ninguno a esta escala | Proyecciones de lectura dedicadas si el tablero crece (ADR-003) |
| TD-009 | Contenerización de la API | Docker Compose solo levanta PostgreSQL; la API corre con Node local | Diferencias de entorno | `Dockerfile` multi-stage + servicio `api` en Compose |
| TD-010 | Observabilidad | Logs de texto de Nest | Diagnóstico limitado | Logs estructurados (JSON) con *correlation id*, sin datos sensibles |
| TD-011 | Funcionalidades de dominio | No hay renombrado/edición de tareas, reactivación de usuarios ni borrado | Alcance reducido a propósito | Añadir como nuevos casos de uso cuando el negocio los pida |
