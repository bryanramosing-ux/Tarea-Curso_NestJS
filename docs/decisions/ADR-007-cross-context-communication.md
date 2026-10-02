# ADR-007 — Comunicación entre contextos: ACL vía QueryBus y eventos de dominio

## Contexto
Tasks necesita saber si un miembro existe y está activo (RN-011) y reaccionar cuando
un miembro se desactiva (RN-013). La rúbrica prohíbe que un dominio importe el
`domain/` de otro contexto.

## Decisión
1. **Consulta**: Tasks define su propio puerto `TeamMemberDirectory` en
   `tasks/domain/ports`. El adaptador `UsersTeamMemberDirectory`
   (`tasks/infrastructure/adapters`) ejecuta `GetUserQuery` por el `QueryBus` (API
   pública de lectura de Users) y traduce la `UserView` a `TeamMember`. Un
   `USER_NOT_FOUND` se traduce a `null`.
2. **Reacción**: el oyente `ReleaseTasksOnUserDeactivatedListener`
   (`tasks/infrastructure/event-handlers`) escucha `UserDeactivated` y despacha el
   comando propio `ReleaseMemberTasksCommand`. La regla vive en `Task.releaseAssignee`.

## Por qué
- El dominio de Tasks solo conoce su propio modelo: si Users cambia su entidad o su
  base, solo cambia el adaptador (Anti-Corruption Layer).
- Usar el `QueryBus` en lugar del repositorio de Users respeta la encapsulación de
  Users (validaciones, vista sin datos sensibles).
- El evento invierte la dependencia: Users no sabe que Tasks existe.
- Los oyentes de eventos externos viven en `infrastructure/` porque dependen del
  contrato publicado por otro contexto.

## Consecuencias
- La liberación de tareas es eventualmente consistente (EventBus en memoria,
  asíncrono). Un fallo del oyente se registra y no revierte la desactivación.
  Mejora futura: *transactional outbox* + reintentos (ver `technical-debt.md`).
- `tasks/infrastructure` importa `users/application/queries/get-user` y
  `users/domain/events/user-deactivated.event` (contratos públicos). Ningún archivo de
  `tasks/domain` ni `tasks/application` importa nada de Users (verificado por test).

## Alternativas descartadas
- Importar `User`/`UserId` en el dominio de Tasks: viola la rúbrica y acopla modelos.
- Relación ORM `ManyToOne` entre `TaskOrmEntity` y `UserOrmEntity`: acoplaría los
  modelos de persistencia; la integridad se garantiza con la FK en la migración.
- Llamada HTTP entre contextos: innecesaria en un monolito modular.
