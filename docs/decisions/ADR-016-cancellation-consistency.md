# ADR-016 — Consistencia de RN-014 sin outbox: catálogo como fuente de verdad, reintentos y conciliación

## Contexto
Cancelar un evento (Catálogo) y cerrar su venta y reembolsar (Venta) son dos pasos unidos por
el `EventBus` **en memoria** de `@nestjs/cqrs` (ADR-007). Riesgos:
1. El oyente falla (p. ej. la base no responde un momento): antes solo se registraba en el log
   y la venta quedaba abierta para siempre.
2. El proceso cae entre guardar la cancelación y publicar el evento: el evento se pierde.
3. Mientras tanto, la venta seguía aceptando compras y la puerta admitiendo entradas de un
   evento cancelado, porque solo se miraba el cupo.

## Decisión
1. **El catálogo es la fuente de verdad** de si un evento está cancelado. La compra, la
   disponibilidad y el check-in lo consultan por el ACL en cada operación: aunque el cupo
   siga abierto, un evento cancelado no vende (`TICKET_SALES_CLOSED`) ni admite público
   (`TICKET_EVENT_CANCELLED`).
2. **Reintentos**: el oyente `CloseSalesOnEventCancelledListener` reintenta 3 veces con espera
   creciente (200 ms, 400 ms) antes de rendirse y registrarlo.
3. **Conciliación** (`ReconcileSalesCommand`): recorre por lotes los cupos abiertos y, para cada
   evento que el catálogo ya canceló, delega en `CloseEventSales` (idempotente). Se ejecuta:
   - al **arrancar** la aplicación (`ReconcileSalesOnStartup`), que cubre la caída del proceso;
   - **bajo demanda**: `POST /tickets/sales/reconcile` (organizador).

## Por qué
- Con (1), la ventana de inconsistencia deja de ser peligrosa: lo único que se retrasa es
  marcar las entradas como `REFUNDED`, no la seguridad del aforo ni de la puerta.
- (2) y (3) cubren los fallos transitorios y la pérdida del evento sin infraestructura nueva.
- `CloseEventSales` es idempotente, así que ejecutar la conciliación de más no hace daño.

## Consecuencias
- Cada compra y cada check-in hacen una consulta más (el evento del catálogo). Es una lectura
  por clave primaria; aceptable a esta escala.
- Si el proceso cae justo después de cancelar, los reembolsos esperan al siguiente arranque
  (o a que el organizador lance la conciliación). Mientras tanto, las entradas no sirven.
- Un evento cancelado sin ventas no tiene cupo abierto, así que la conciliación no lo ve; no
  hace falta: no hay nada que reembolsar y la compra ya consulta el catálogo.
- Sigue sin existir un *transactional outbox* (TD-001): sería la solución general si hubiera
  más consumidores de eventos (pagos, emails).

## Alternativas descartadas
- *Transactional outbox* con un proceso que publique la tabla de eventos: correcto y general,
  pero añade tabla, *poller*, serialización de eventos y semántica "al menos una vez" en todos
  los oyentes; desproporcionado para un único consumidor cuyo efecto ya es idempotente y
  conciliable.
- Llamar a `CloseEventSales` dentro de la transacción de `CancelEvent`: acoplaría los dos
  contextos en un caso de uso.
