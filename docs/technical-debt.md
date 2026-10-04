# Deuda técnica y limitaciones conocidas

Registro honesto de lo que **no** está resuelto, por qué y cómo se abordaría.

| ID | Tema | Situación actual | Riesgo | Propuesta |
|---|---|---|---|---|
| TD-001 | Publicación de eventos | `EventBus` en memoria; los eventos se publican tras `save()` pero fuera de una transacción común. Si el proceso cae entre ambos pasos, el evento se pierde. | Un evento cancelado podría no cerrar su venta (RN-014) | *Transactional outbox* con reintentos |
| TD-002 | Consistencia de RN-014 | El cierre de ventas y los reembolsos son eventualmente consistentes; un fallo del oyente solo se registra en log | Igual que TD-001 | Reintentos automáticos; el comando ya es idempotente |
| TD-003 | Compra sin transacción común | La compra guarda el cupo y después cada entrada por separado. Si falla a mitad, el cupo cuenta plazas sin entrada | Plazas perdidas (nunca sobreventa) | Puerto de *unit of work* transaccional o tarea de conciliación `sold` ↔ entradas |
| TD-004 | Autenticación / autorización | No existe: cualquiera puede programar o cancelar eventos y consultar una entrada (con su id) | Uso solo en red interna | Módulo `auth` con roles (organizador, taquilla) |
| TD-005 | Pagos | No hay pasarela: la compra se da por pagada y el reembolso solo cambia el estado | Sin dinero real | Contexto `Payments` que reaccione a `TicketsSold`/`TicketRefunded` |
| TD-006 | Envío de la entrada | El código solo se muestra en la respuesta; si el comprador lo pierde no se puede recuperar | Mala experiencia | Enviar el código por email al reaccionar a `TicketIssued` (sin guardarlo) o reemisión de entrada |
| TD-007 | Rate limiting y CORS | `helmet` está, pero no hay límite de peticiones ni CORS explícito | Abuso de compras o de check-in si se publica en Internet | `@nestjs/throttler` configurable por entorno; CORS configurable |
| TD-008 | Paginación | `GET /events` devuelve toda la cartelera | Rendimiento con muchos eventos | Paginación por cursor (`starts_at, id`) |
| TD-009 | Rotación del secreto | Cambiar `TICKET_CODE_SECRET` invalida los códigos emitidos | Entradas inválidas tras rotar | Verificar con secreto actual y anterior durante la transición |
| TD-010 | Evento muy demandado | Todas las compras de un evento escriben la misma fila (el cupo) | Muchos reintentos en preventas masivas | Repartir el aforo en varios cupos o cola de compra |
| TD-011 | Contenerización de la API | Docker Compose solo levanta PostgreSQL | Diferencias de entorno | `Dockerfile` multi-stage + servicio `api` |
| TD-012 | Datos corruptos en la base | Una fila que viola las reglas del dominio responde 400 en vez de 500 | Mensaje engañoso | Traducir los errores de `fromPrimitives` en el adaptador a un error técnico |
| TD-013 | Log de 413 | Un cuerpo demasiado grande responde 413 pero Nest lo registra como `ERROR` | Ruido en logs | Filtro para errores `http-errors` de body-parser |
| TD-014 | `braces` en herramientas de prueba | `pnpm audit` reporta GHSA-vfj7-8cjw-p6xm (DoS con patrones de glob anidados) vía Jest; no hay versión corregida | Ninguno en producción (`pnpm audit --prod` = 0); Jest solo procesa patrones de nuestra configuración | Actualizar cuando se publique una versión corregida |
| TD-015 | Funcionalidades | No se puede editar un evento (fecha, aforo, precio), ni transferir o anular una entrada concreta | Alcance reducido a propósito | Nuevos casos de uso; editar el aforo requerirá ajustar el cupo |
