# ADR-003 — CQRS con `@nestjs/cqrs` y un solo almacén

## Contexto
La rúbrica exige separar escritura y lectura y que los controladores sean delgados.

## Decisión
- Cada caso de uso es un `Command` o `Query` (clases `Command<R>`/`Query<R>` de
  `@nestjs/cqrs`, que tipan el resultado) con su handler, en su propia carpeta.
- Los controladores solo construyen el mensaje y llaman a `CommandBus`/`QueryBus`.
- Los comandos devuelven lo mínimo: `{ id }`, salvo la compra, que devuelve los códigos
  de entrada porque es el **único** momento en que pueden entregarse (RN-012).
- Lectura y escritura usan el mismo almacén; las consultas mapean a *views* explícitas.

## Por qué
- Los buses desacoplan HTTP de los casos de uso: el controlador no conoce handlers ni repositorios.
- El mismo bus sirve de API pública entre contextos (`GetEventQuery`, ADR-007).
- Un modelo de lectura separado (proyecciones) sería sobre-ingeniería a esta escala; las
  vistas explícitas ya impiden exponer datos internos (el hash del código).
- `GetEventAvailability` es un buen ejemplo de consulta que combina fuentes (cupo o catálogo)
  sin afectar a ningún comando.

## Consecuencias
- Si la venta crece, la disponibilidad puede pasar a una proyección (p. ej. caché) sin
  tocar controladores ni comandos.
- `CloseEventSalesCommand` es un comando interno sin endpoint, disparado por un evento.

## Alternativas descartadas
- *Llamar handlers desde el controlador*: acopla y viola la rúbrica.
- *Servicios de aplicación con varios métodos*: mezclan casos de uso.
