# Reglas de negocio

Cada regla tiene un **ID estable** (no se renumera; si una regla se elimina, su ID
queda retirado). Las clases de error y los comentarios del código citan el ID
(`/** RN-00X */`), de modo que `grep -rn "RN-009" src` lleva a su implementación.

Rutas relativas a `src/`.

## Contexto Users

### RN-001 — Email válido y normalizado
Un email se guarda sin espacios exteriores y en minúsculas, con formato
`local@dominio.tld` y como máximo 254 caracteres.
- **Implementación**: `users/domain/value-objects/email.ts` (`Email.create`).
- **Error**: `USER_INVALID_EMAIL` (VALIDATION → 400).
- **Pruebas**: `users/domain/value-objects/email.spec.ts`; e2e `400: domain rules reject an invalid email (RN-001)`.

### RN-002 — Email único
No puede haber dos usuarios con el mismo email (comparado tras normalizar).
- **Implementación**: `users/application/commands/create-user/create-user.handler.ts`
  (consulta `findByEmail` antes de registrar) + restricción `uq_users_email`
  (`database/migrations/1759363200000-CreateUsersTable.ts`) + traducción de la
  violación `23505` en `users/infrastructure/persistence/typeorm/typeorm-user.repository.ts`.
- **Error**: `USER_EMAIL_ALREADY_IN_USE` (CONFLICT → 409).
- **Pruebas**: `create-user.handler.spec.ts`; e2e `409: the email is unique regardless of casing` y
  `409: concurrent registrations with the same email are resolved by the UNIQUE constraint`.

### RN-003 — Nombre de usuario
Entre 2 y 80 caracteres tras recortar y colapsar espacios internos.
- **Implementación**: `users/domain/value-objects/user-name.ts`.
- **Error**: `USER_INVALID_NAME` (VALIDATION → 400).
- **Pruebas**: `user-name.spec.ts`.

### RN-004 — Política y protección de contraseñas
La contraseña tiene entre 8 y 72 caracteres e incluye al menos una letra y un
dígito. Solo se almacena su hash (scrypt con sal); nunca aparece en respuestas,
eventos, errores ni logs.
- **Implementación**: `users/domain/value-objects/plain-password.ts`,
  `users/domain/value-objects/password-hash.ts`, puerto
  `users/domain/ports/password-hasher.port.ts`, adaptador
  `users/infrastructure/security/scrypt-password-hasher.ts`, vista
  `users/application/views/user.view.ts`.
- **Error**: `USER_WEAK_PASSWORD` (VALIDATION → 400).
- **Pruebas**: `plain-password.spec.ts`, `scrypt-password-hasher.spec.ts`,
  `get-user.handler.spec.ts`; e2e `never returns or stores the password in clear text`.

### RN-005 — Desactivación
Solo un usuario activo puede desactivarse. Al desactivarse se emite `UserDeactivated`.
- **Implementación**: `users/domain/entities/user.ts` (`User.deactivate`).
- **Error**: `USER_ALREADY_INACTIVE` (CONFLICT → 409).
- **Pruebas**: `user.spec.ts`, `deactivate-user.handler.spec.ts`; e2e `204 then 409 when deactivating twice`.

## Contexto Tasks

### RN-006 — Título de tarea
Entre 3 y 120 caracteres tras recortar y colapsar espacios.
- **Implementación**: `tasks/domain/value-objects/task-title.ts`.
- **Error**: `TASK_INVALID_TITLE` (VALIDATION → 400).
- **Pruebas**: `task-values.spec.ts`; e2e `400: a too short title is rejected by the domain`.

### RN-007 — Descripción
Opcional (vacía por defecto), recortada, máximo 2000 caracteres.
- **Implementación**: `tasks/domain/value-objects/task-description.ts`.
- **Error**: `TASK_INVALID_DESCRIPTION` (VALIDATION → 400).
- **Pruebas**: `task-values.spec.ts`.

### RN-008 — Estado inicial
Toda tarea nace en `TODO`, sin responsable y con prioridad `MEDIUM` si no se indica.
- **Implementación**: `tasks/domain/entities/task.ts` (`Task.create`).
- **Pruebas**: `task.spec.ts` (`create (RN-008)`), `create-task.handler.spec.ts`; e2e `201/200: creates a TODO task with defaults`.

### RN-009 — Flujo Kanban
Transiciones permitidas:

| Desde \ Hacia | TODO | IN_PROGRESS | IN_REVIEW | DONE |
|---|---|---|---|---|
| **TODO** | — | ✅ | ❌ | ❌ |
| **IN_PROGRESS** | ✅ | — | ✅ | ❌ |
| **IN_REVIEW** | ❌ | ✅ | — | ✅ |
| **DONE** | ❌ | ❌ | ❌ | — |

Moverse al mismo estado también se rechaza.
- **Implementación**: `tasks/domain/value-objects/task-status.ts` (`ALLOWED_TRANSITIONS`,
  `canTransitionTo`) y `tasks/domain/entities/task.ts` (`Task.changeStatus`);
  `ck_tasks_status` en la migración.
- **Errores**: `TASK_INVALID_STATUS` (VALIDATION → 400) para valores desconocidos;
  `TASK_INVALID_STATUS_TRANSITION` (CONFLICT → 409).
- **Pruebas**: `task-status.spec.ts` (matriz completa), `task.spec.ts`,
  `change-task-status.handler.spec.ts`; e2e `409: cannot skip columns`.

### RN-010 — Responsable obligatorio fuera de TODO
Una tarea en `IN_PROGRESS`, `IN_REVIEW` o `DONE` siempre tiene responsable.
- **Implementación**: `TaskStatus.requiresAssignee`, `Task.changeStatus`,
  `Task.assertInvariants` (también al reconstruir con `fromPrimitives`), y
  `ck_tasks_assignee_required` en la migración.
- **Errores**: `TASK_REQUIRES_ASSIGNEE` (CONFLICT → 409); `TASK_INVARIANT_VIOLATION` si se
  intenta reconstruir un estado corrupto.
- **Pruebas**: `task.spec.ts`, `task.mapper.spec.ts`; e2e `409: cannot start a task without an assignee`
  y `CHECK ck_tasks_assignee_required rejects a started task without assignee`.

### RN-011 — Asignación solo a miembros existentes y activos
- **Implementación**: `tasks/application/commands/assign-task/assign-task.handler.ts`
  (consulta el puerto `TeamMemberDirectory`), `Task.assignTo` (rechaza inactivos),
  adaptador `tasks/infrastructure/adapters/users-team-member-directory.adapter.ts`,
  FK `fk_tasks_assignee`.
- **Errores**: `TASK_ASSIGNEE_NOT_FOUND` (NOT_FOUND → 404); `TASK_ASSIGNEE_INACTIVE` (CONFLICT → 409).
- **Pruebas**: `assign-task.handler.spec.ts`, `task.spec.ts`,
  `users-team-member-directory.adapter.spec.ts`; e2e `PATCH /tasks/:id/assignee (RN-011)`.

### RN-012 — DONE es inmutable
Una tarea terminada no cambia de estado, no se reasigna y no se libera.
- **Implementación**: `Task.assertNotDone` (usado por `assignTo`, `changeStatus`, `releaseAssignee`).
- **Error**: `TASK_ALREADY_DONE` (CONFLICT → 409).
- **Pruebas**: `task.spec.ts`; e2e `204: walks the whole Kanban flow, then DONE is final`.

### RN-013 — Liberación de tareas al desactivar un miembro
Cuando un miembro se desactiva, sus tareas **no terminadas** quedan sin responsable y
vuelven a `TODO` (para respetar RN-010). Las tareas `DONE` conservan su responsable
como registro histórico.
- **Implementación**: evento `users/domain/events/user-deactivated.event.ts` → oyente
  `tasks/infrastructure/event-handlers/release-tasks-on-user-deactivated.listener.ts` →
  `tasks/application/commands/release-member-tasks/release-member-tasks.handler.ts` →
  `Task.releaseAssignee`.
- **Evento resultante**: `TaskUnassigned`.
- **Pruebas**: `task.spec.ts` (`releaseAssignee (RN-013)`), `release-member-tasks.handler.spec.ts`;
  e2e `cross-context event: UserDeactivated -> release tasks (RN-013)`.

### RN-014 — Prioridad
La prioridad es `LOW`, `MEDIUM` o `HIGH` (sin distinguir mayúsculas al recibirla).
- **Implementación**: `tasks/domain/value-objects/task-priority.ts`; `ck_tasks_priority`.
- **Error**: `TASK_INVALID_PRIORITY` (VALIDATION → 400).
- **Pruebas**: `task-values.spec.ts`; e2e `400: an unknown priority is rejected by the domain`.
