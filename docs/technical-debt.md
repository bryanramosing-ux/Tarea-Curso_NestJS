# Deuda técnica y limitaciones conocidas

Registro honesto de lo que **no** está resuelto, por qué y cómo se abordaría. Los IDs son
estables: lo que se resolvió se mantiene al final, marcado como resuelto, para que las
referencias antiguas sigan teniendo sentido.

## Pendiente

| ID | Tema | Situación actual | Riesgo | Propuesta |
|---|---|---|---|---|
| TD-001 | Publicación de eventos | `EventBus` en memoria; los eventos se publican tras `save()` pero fuera de una transacción común. Si el proceso cae entre ambos pasos, el evento se pierde. | **Mitigado** (ADR-016): la compra y el check-in consultan el catálogo, el oyente reintenta y la conciliación (al arrancar y bajo demanda) completa el cierre. Lo único que se retrasa es marcar las entradas como reembolsadas. | *Transactional outbox* si aparecen más consumidores de eventos (pagos, emails) |
| TD-004 | Identidad del personal | Autenticación por **clave de API compartida por rol** (organizador, puerta). No hay usuarios individuales ni registro de quién hizo cada operación. Rotar una clave exige reiniciar con el valor nuevo. | Si una clave se filtra, sirve hasta que se rote; no hay auditoría por persona | Contexto de identidad (usuarios, JWT o sesiones) y registro de auditoría |
| TD-005 | Pagos | No hay pasarela: la compra se da por pagada y el reembolso solo cambia el estado. | Sin dinero real. Con el límite por IP y por titular es más difícil acaparar entradas, pero quien use muchas IPs y emails todavía puede | Contexto `Payments` que reaccione a `TicketsSold`/`TicketRefunded`; reservas con caducidad hasta el pago |
| TD-006 | Envío de la entrada | El código solo se muestra en la respuesta; si el comprador lo pierde no se puede recuperar | Mala experiencia | Enviar el código por email al reaccionar a `TicketIssued` (sin guardarlo) o reemisión de entrada |
| TD-007 | Límite de peticiones distribuido y CORS | El contador del límite vive en la memoria de cada proceso: con varias réplicas, cada una cuenta por separado. No hay CORS configurado (la API no sirve a navegadores de otros orígenes). | Con varias instancias, el límite efectivo se multiplica | Almacenamiento compartido para `@nestjs/throttler` (Redis); `CORS_ORIGINS` configurable si hay un frontend |
| TD-009 | Rotación del secreto | Cambiar `TICKET_CODE_SECRET` invalida los códigos emitidos | Entradas inválidas tras rotar | Verificar con secreto actual y anterior durante la transición |
| TD-010 | Evento muy demandado | Todas las compras de un evento escriben la misma fila (el cupo), que queda bloqueada durante cada compra | Muchos reintentos en preventas masivas | Repartir el aforo en varios cupos o cola de compra |
| TD-011 | Contenerización de la API | Docker Compose solo levanta PostgreSQL | Diferencias de entorno | `Dockerfile` multi-stage + servicio `api` |
| TD-014 | Avisos en dependencias de desarrollo | `pnpm audit` (2026-10-10): `braces` *high* (GHSA-vfj7-8cjw-p6xm, sin parche), `sprintf-js` *moderate* (GHSA-hp3w-g68c-fv3c, sin parche) y `handlebars` ≤ 4.7.9 vía `ts-jest` (GHSA-8r5x-fm3f-whwj y GHSA-p8wg-vrv2-v86f *critical*, GHSA-xw65-4hp5-5hc7 *moderate*). | Ninguno en producción (`pnpm audit --prod` = 0): son herramientas de prueba que solo procesan la configuración y las plantillas del propio proyecto | Revisar `handlebars` 4.7.10 (publicado el 2026-10-05) cuando tenga unas semanas y forzarlo con `pnpm.overrides`; actualizar Jest cuando publique versiones sin `braces`/`sprintf-js` vulnerables |
| TD-015 | Funcionalidades | No se puede editar un evento (fecha, aforo, precio), ni transferir o anular una entrada concreta | Alcance reducido a propósito | Nuevos casos de uso; editar el aforo requerirá ajustar el cupo |
| TD-016 | Solapamiento de eventos (RN-006) | La unicidad es por recinto + **instante de inicio**: dos eventos en el mismo recinto a las 20:00 y a las 20:30 se permiten aunque se solapen, porque el modelo no tiene duración. Por la misma razón, el horario de puertas (RN-016) es una ventana fija alrededor del inicio. | Reservas solapadas de un recinto | Añadir duración/hora de fin al evento y una restricción de exclusión (`btree_gist` sobre el rango) |

## Resuelto

| ID | Tema | Cómo se resolvió |
|---|---|---|
| TD-002 | Consistencia de RN-014 (fallo del oyente solo en log) | Reintentos del oyente + conciliación al arrancar y `POST /tickets/sales/reconcile` + la venta consulta el catálogo (ADR-016) |
| TD-003 | Compra sin transacción común | Puerto `UnitOfWork` y compra transaccional (ADR-013) |
| TD-008 | `GET /events` sin paginación | Paginación `limit`/`offset` (máximo 100) |
| TD-012 | Datos corruptos respondían 400 | `PersistedDataCorruptedError` → 500 genérico |
| TD-013 | El 413 se registraba como `ERROR` | `UnhandledExceptionFilter`: 413 con código `PAYLOAD_TOO_LARGE`, registrado como aviso |
| — | Sin autenticación ni límite de peticiones (antes en TD-004 y TD-007) | Claves de API por rol y `@nestjs/throttler` (ADR-014); queda pendiente la parte descrita arriba |
