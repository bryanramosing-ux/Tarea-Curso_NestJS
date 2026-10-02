# Eventos de dominio

## Principios

- Nombre en **pasado**: describen algo que ya ocurrió.
- **Clases planas** en `<contexto>/domain/events/` que implementan `DomainEvent`
  (`eventName`, `occurredOn`). Sin decoradores ni dependencias de framework.
- Los **registra el agregado** (`AggregateRoot.record`) dentro de sus métodos de negocio.
- El handler los extrae (`pullDomainEvents()`) y los **publica después de `save()`**
  mediante el puerto `DomainEventPublisher`. Si la persistencia falla, no se publica nada.
- `fromPrimitives()` no registra eventos (reconstruir no es un hecho de negocio).
- Ningún evento transporta credenciales (verificado en `user.spec.ts`).

## Catálogo

| Evento | `eventName` | Contexto | Lo emite | Datos | Oyentes |
|---|---|---|---|---|---|
| `UserRegistered` | `users.user_registered` | Users | `User.register` | `userId, email, name, occurredOn` | — (disponible para auditoría/notificaciones) |
| `UserDeactivated` | `users.user_deactivated` | Users | `User.deactivate` | `userId, occurredOn` | `tasks/infrastructure/event-handlers/release-tasks-on-user-deactivated.listener.ts` |
| `TaskCreated` | `tasks.task_created` | Tasks | `Task.create` | `taskId, title, priority, occurredOn` | — |
| `TaskAssigned` | `tasks.task_assigned` | Tasks | `Task.assignTo` | `taskId, assigneeId, previousAssigneeId, occurredOn` | — |
| `TaskStatusChanged` | `tasks.task_status_changed` | Tasks | `Task.changeStatus` | `taskId, from, to, occurredOn` | — |
| `TaskUnassigned` | `tasks.task_unassigned` | Tasks | `Task.releaseAssignee` | `taskId, previousAssigneeId, previousStatus, occurredOn` | — |

## Publicación

```
handler: agregado.metodoDeNegocio()  →  repo.save(agregado)  →  publisher.publishAll(agregado.pullDomainEvents())
```

- Puerto: `src/shared/domain/ports/domain-event-publisher.port.ts`.
- Adaptador real: `NestDomainEventPublisher` (sobre `EventBus` de `@nestjs/cqrs`).
- Adaptador de pruebas: `InMemoryDomainEventPublisher`.
- Evidencia del orden: pruebas `publishes ... only after the user is persisted` y
  `publishes TaskCreated after persisting`, y la regla automática
  `command handlers publish domain events only after persisting` en `test/architecture`.

## Consistencia

El `EventBus` es en memoria y los oyentes se ejecutan de forma asíncrona: la
liberación de tareas tras `UserDeactivated` es **eventualmente consistente**
(milisegundos). El e2e lo comprueba con un sondeo acotado (`eventually`). Un fallo
del oyente se registra en el log (solo ids y mensaje) y no revierte la desactivación.
Mejora prevista: *transactional outbox* (ver `technical-debt.md`).
