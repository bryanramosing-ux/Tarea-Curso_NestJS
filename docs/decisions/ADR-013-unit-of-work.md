# ADR-013 — Compra transaccional con un puerto `UnitOfWork`

## Contexto
Comprar escribe dos agregados: el cupo (`sold += n`) y `n` entradas. Antes se guardaban por
separado, sin transacción común: si el proceso fallaba después de guardar el cupo, el cupo
contaba plazas sin entrada (plazas perdidas, antigua TD-003).

Además, la auditoría encontró una carrera real: si la **primera** compra de un evento leía el
catálogo justo antes de que el evento se cancelara, el cierre de ventas no encontraba cupo
(no hacía nada) y la compra creaba después un cupo **abierto** para un evento cancelado. Las
entradas quedaban válidas y se podía seguir vendiendo indefinidamente.

## Decisión
1. Puerto `UnitOfWork` en `shared/domain/ports`: `run(work)` ejecuta `work` de forma atómica.
   - Adaptador real `TypeOrmUnitOfWork`: una transacción de PostgreSQL (READ COMMITTED).
     `TypeOrmTransactionContext` guarda el `EntityManager` transaccional en un
     `AsyncLocalStorage`; los repositorios TypeORM lo usan si existe, sin que el caso de uso
     ni el dominio sepan nada.
   - Adaptador `InMemoryUnitOfWork` para las unitarias (ejecuta el trabajo tal cual).
2. `PurchaseTicketsHandler` hace, **dentro** de `run`: leer/abrir el cupo, contar las entradas
   del titular (RN-008), `sell`, guardar el cupo y emitir y guardar las entradas. Si otra
   operación cambió el cupo (bloqueo optimista), la transacción se deshace y se reintenta
   entera. Los eventos se publican después del `COMMIT`.
3. `CloseEventSalesHandler` crea un cupo **ya cerrado** (`TicketAllocation.closedFor`) cuando
   el evento cancelado nunca vendió nada.

## Por qué
- El caso de uso decide **qué** es atómico; el adaptador decide **cómo**. Cambiar de base no
  toca `application/`.
- `AsyncLocalStorage` evita pasar el `EntityManager` por todas las firmas (lo que filtraría
  TypeORM hacia los puertos).
- **El cupo serializa la compra y la cancelación.** La compra mantiene bloqueada la fila del
  cupo desde su `UPDATE`/`INSERT` hasta el `COMMIT`, y sus entradas se confirman a la vez.
  El cierre también escribe esa fila (o la inserta). Casos:
  - el cierre escribe primero → la compra choca (versión distinta o clave primaria
    duplicada), relee, ve la venta cerrada y responde 409 `TICKET_SALES_CLOSED`;
  - la compra confirma primero → el cierre choca, relee el cupo y, como las entradas ya
    están confirmadas, las encuentra y las reembolsa.
  En ningún orden queda una entrada `ISSUED` de un evento cancelado.
- Con la transacción, la antigua "compensación" (releer el cupo tras emitir y reembolsar las
  propias entradas) deja de ser necesaria y se eliminó.

## Consecuencias
- La fila del cupo queda bloqueada mientras dura la compra (hasta 10 entradas y sus HMAC):
  milisegundos. Las compras simultáneas del mismo evento esperan o chocan y reintentan (TD-010).
- Las pruebas unitarias no pueden demostrar el `ROLLBACK`: lo prueba la e2e
  *the purchase is atomic: if issuing a ticket fails, the seats are not kept*.
- Pruebas de la carrera: unitaria *a FIRST purchase that read the catalog before the
  cancellation cannot open sales afterwards* y e2e *purchases racing a cancellation*.

## Alternativas descartadas
- `dataSource.transaction()` dentro del handler: metería TypeORM en `application/`.
- Pasar un `EntityManager` a cada método del repositorio: contamina los puertos.
- Mantener la compensación sin transacción: no cubría la primera compra y dejaba plazas
  perdidas si el proceso caía a mitad.
