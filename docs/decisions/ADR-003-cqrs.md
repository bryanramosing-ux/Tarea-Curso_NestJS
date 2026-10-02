# ADR-003 — CQRS con `@nestjs/cqrs` y un solo almacén

## Contexto
La rúbrica exige separar escritura y lectura y que los controladores sean delgados.

## Decisión
- Cada caso de uso es un `Command` o `Query` (clases `Command<R>`/`Query<R>` de
  `@nestjs/cqrs`, que tipan el resultado) con su handler, en su propia carpeta.
- Los controladores solo construyen el mensaje y llaman a `CommandBus`/`QueryBus`.
- Los comandos devuelven como mucho `{ id }`; las consultas devuelven *views*.
- Lectura y escritura usan **el mismo almacén** (PostgreSQL) y el mismo puerto de
  repositorio; las consultas mapean el agregado a una vista explícita.

## Por qué
- Los buses desacoplan el adaptador HTTP de los casos de uso: el controlador no
  conoce handlers ni repositorios.
- El mismo bus sirve de API pública entre contextos (`GetUserQuery`, ADR-007).
- Un modelo de lectura separado (proyecciones, otra base) sería sobre-ingeniería para
  el volumen de una startup pequeña; las vistas explícitas ya garantizan que la
  lectura no expone datos internos (p. ej. el hash).

## Consecuencias
- Si el tablero crece, `ListTasks` puede migrar a una proyección propia sin tocar
  controladores ni comandos (solo su handler y un puerto de lectura).
- `ReleaseMemberTasksCommand` es un comando interno sin endpoint, disparado por un evento.

## Alternativas descartadas
- *Llamar handlers directamente desde el controlador*: acopla y viola la rúbrica.
- *Servicios de aplicación con varios métodos*: mezcla casos de uso y responsabilidades.
