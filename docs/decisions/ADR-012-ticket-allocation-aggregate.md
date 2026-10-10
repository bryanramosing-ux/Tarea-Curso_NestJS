# ADR-012 — El cupo de cada evento es un agregado propio (`TicketAllocation`)

## Contexto
La regla más importante del negocio es **no vender más entradas que el aforo** (RN-009).
Es una regla sobre un *conjunto* de entradas (las de un evento), no sobre una entrada
concreta. ¿Qué agregado la protege?

## Decisión
Un agregado `TicketAllocation` por evento, en el contexto de venta, que lleva el contador
`sold`, el aforo, el precio y el inicio (copiados del catálogo al abrir la venta). Comprar
es, dentro de una transacción (ADR-013): `allocation.sell(quantity, heldByHolder, now)` →
guardar el cupo (con bloqueo optimista) → emitir las `Ticket`. Cada `Ticket` es un agregado
aparte (su ciclo de vida es independiente: check-in, reembolso).

El cupo se crea **la primera vez que alguien compra** para ese evento (consultando el
catálogo por el ACL), o **ya cerrado** si el evento se cancela sin haber vendido nada
(`TicketAllocation.closedFor`). Si dos operaciones lo crean a la vez, la clave primaria
`pk_ticket_allocations` rechaza una y esa reintenta.

## Por qué
- **Un agregado es la frontera de consistencia**: la invariante "vendidas ≤ aforo" debe
  vivir dentro de uno solo. Con `Ticket` como único agregado habría que contar filas
  (`COUNT(*)`) antes de vender, y dos compras simultáneas contarían lo mismo.
- **Meter las entradas dentro del cupo** (un agregado gigante) obligaría a cargar miles de
  entradas para validar una sola en la puerta.
- **Ponerlo en el `Event` del catálogo** mezclaría la carga de ventas con la cartelera y
  rompería la separación de contextos (ADR-002).
- El contador versionado convierte la concurrencia en algo comprobable: dos compras que
  leyeron el mismo cupo no pueden guardar ambas.
- Reintentar con **espera aleatoria** (*jitter*) evita que los compradores que chocaron
  vuelvan a chocar exactamente al mismo tiempo: con 30 compras para 5 plazas, las 25
  rechazadas reciben el mensaje correcto ("no quedan entradas") en lugar de un conflicto técnico.

## Consecuencias
- La compra guarda dos agregados (cupo y entradas) **en la misma transacción** (ADR-013):
  si algo falla a mitad, no queda nada guardado (antes se perdían plazas, TD-003 resuelta).
- El cupo también limita las entradas activas por titular (RN-008): el conteo se hace
  después de leer el cupo, y el bloqueo optimista obliga a recontar si otra compra cambió el cupo.
- El cupo es el punto donde se encuentran la compra y la cancelación del evento: el cierre
  lo actualiza o lo crea cerrado, así que una compra simultánea choca con él (RN-014, ADR-013).
- Un evento muy demandado concentra las escrituras en una fila (el cupo): suficiente para
  esta escala; a gran escala se podría repartir el aforo en varios cupos (*sharding*).

## Alternativas descartadas
- Contar entradas en cada compra: incorrecto ante concurrencia.
- Bloqueo pesimista de la fila del evento: serializa y mantiene transacciones largas.
- Reservar plazas en una cola externa: excesivo para el alcance del proyecto.
