# ADR-007 — Comunicación entre contextos: ACL vía QueryBus y eventos de dominio

## Contexto
La venta necesita saber el aforo, la fecha, el precio y el estado de un evento (RN-009,
RN-010) y reaccionar cuando se cancela (RN-014). La rúbrica prohíbe que un dominio importe
el `domain/` de otro contexto.

## Decisión
1. **Consulta**: la venta define su propio puerto `EventCatalog` en `ticketing/domain/ports`.
   El adaptador `CatalogEventCatalog` (`ticketing/infrastructure/adapters`) ejecuta
   `GetEventQuery` por el `QueryBus` (API pública de lectura del catálogo) y traduce la
   `EventView` a `SaleableEvent`. Un `EVENT_NOT_FOUND` se traduce a `null`.
2. **Reacción**: el oyente `CloseSalesOnEventCancelledListener`
   (`ticketing/infrastructure/event-handlers`) escucha `EventCancelled` y despacha el
   comando propio `CloseEventSalesCommand`. Las reglas viven en `TicketAllocation.close` y `Ticket.refund`.

## Por qué
- El dominio de la venta solo conoce su modelo: si el catálogo cambia su entidad o su
  tabla, solo cambia el adaptador (Anti-Corruption Layer).
- Usar el `QueryBus` respeta la encapsulación del catálogo (validaciones, vista pública).
- El evento invierte la dependencia: el catálogo no sabe que la venta existe.
- Los oyentes de eventos externos viven en `infrastructure/` porque dependen del contrato
  publicado por otro contexto.

## Consecuencias
- El cierre de ventas tras una cancelación es eventualmente consistente (EventBus en
  memoria). Para que ninguna compra simultánea deje entradas válidas de un evento
  cancelado, la compra relee el cupo tras emitir sus entradas y se compensa (RN-014).
- `ticketing/infrastructure` importa `catalog/application/queries/get-event` y
  `catalog/domain/events/event-cancelled.event` (contratos públicos). Ningún archivo de
  `ticketing/domain` ni `ticketing/application` importa nada del catálogo (verificado por test).

## Alternativas descartadas
- Importar `Event`/`EventId` en el dominio de la venta: viola la rúbrica y acopla modelos.
- Relaciones ORM `ManyToOne` hacia `EventOrmEntity`: acoplarían los modelos de
  persistencia; la integridad se garantiza con FKs en la migración.
- Llamada HTTP entre contextos: innecesaria en un monolito modular.
