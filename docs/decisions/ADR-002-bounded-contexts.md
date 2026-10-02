# ADR-002 — Dos contextos acotados: Users y Tasks

## Contexto
El sistema gestiona miembros del equipo y el trabajo del tablero. Ambos conceptos se
relacionan (una tarea tiene responsable), pero su lenguaje, sus reglas y su ritmo de
cambio son distintos.

## Decisión
- **Users**: identidad y disponibilidad de los miembros (registro, desactivación,
  credenciales). Agregado `User`.
- **Tasks**: tablero Kanban (tarjetas, transiciones, responsables). Agregado `Task`.

Tasks tiene su propio modelo del miembro (`AssigneeId`, `TeamMember`) y no comparte
value objects con Users.

## Por qué
- Para Tasks un miembro solo es "alguien que puede o no recibir trabajo"; no necesita
  email ni contraseña. Reutilizar `User` en Tasks filtraría datos sensibles y acoplaría
  el tablero a la gestión de identidad.
- Las invariantes son independientes: la unicidad de email no afecta al flujo
  Kanban y viceversa; cada agregado se puede modificar sin cargar el otro.
- Es la división mínima que respeta la rúbrica (≥ 2 contextos con lectura y escritura)
  sin inventar contextos artificiales.

## Consecuencias
- Hace falta una traducción explícita entre contextos (ver ADR-007).
- Se aceptan dos clases de identificador (`UserId`, `AssigneeId`) para el mismo valor.

## Alternativas descartadas
- *Un único contexto*: incumple la rúbrica y mezcla modelos.
- *Tercer contexto "Boards/Projects"*: añadiría endpoints sin reglas nuevas
  relevantes para una startup pequeña con un solo tablero.
