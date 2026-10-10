# ADR-014 — Autenticación del personal por clave de API y límite de peticiones

## Contexto
La auditoría comprobó que cualquiera podía programar o **cancelar** eventos (lo que reembolsa
todas sus entradas), hacer check-in y leer `GET /tickets/:id`, que devuelve **datos
personales** (nombre y email del titular). Tampoco había límite de peticiones: como no hay
pagos (TD-005), un script podía agotar el aforo de cualquier evento.

## Decisión
1. **Roles del personal con clave de API** (`shared/infrastructure/http/auth`):
   - `ORGANIZER` (`ORGANIZER_API_KEY`): `POST /events`, `POST /events/:id/cancel`,
     `GET /tickets/:id`, `POST /tickets/check-in`, `POST /tickets/sales/reconcile`.
   - `GATE` (`GATE_API_KEY`): `POST /tickets/check-in`, `GET /tickets/:id`.
   - Público: cartelera, detalle de evento, disponibilidad y compra.
   - Cabecera `Authorization: Bearer <clave>`. Sin clave o desconocida → 401 (con
     `WWW-Authenticate: Bearer`); clave de otro rol → 403.
   - `ApiKeyGuard` (global, `APP_GUARD`) solo actúa en rutas con `@RequireRoles(...)`.
     Compara la huella SHA-256 de la clave con `timingSafeEqual`, recorriendo todas las
     claves, para no filtrar información por tiempos. La clave nunca se registra.
2. **Límite de peticiones por IP** con `@nestjs/throttler` (`APP_GUARD`, antes que la
   autenticación para frenar también la fuerza bruta de claves):
   - `default`: `THROTTLE_LIMIT` peticiones por IP, ruta y ventana `THROTTLE_TTL_SECONDS`;
   - `sensitive`: `THROTTLE_SENSITIVE_LIMIT` en compra y check-in (`@SensitiveRoute()`).
   - Respuesta 429 `TOO_MANY_REQUESTS` con la forma de error habitual.
   - `TRUST_PROXY=true` solo detrás de un proxy inverso de confianza (IP de `X-Forwarded-For`).
3. RN-008 se amplía: máximo 10 entradas activas por titular y evento.

## Por qué
- El proyecto no tiene usuarios ni cuentas (no forman parte del dominio elegido). Una clave
  por rol, configurada por entorno, protege las operaciones peligrosas con muy poco código y
  sin introducir un contexto de identidad.
- La autorización es una preocupación del **borde HTTP**: el guard vive en
  `infrastructure`, el dominio y los casos de uso no cambian.
- Los límites son configurables por entorno (las pruebas e2e los suben; producción los ajusta).

## Consecuencias
- Las claves son compartidas por rol: no se sabe *qué persona* hizo cada operación (no hay
  auditoría por usuario). Rotar una clave exige reiniciar la app con el nuevo valor (TD-004).
- El contador del límite vive en la memoria del proceso: con varias réplicas, cada una lleva
  su cuenta (TD-007). Para varias instancias habría que usar un almacenamiento compartido (Redis).
- Comprar sigue siendo público y sin pago: el límite por IP y por titular lo dificulta, pero
  quien use muchas IPs y emails puede acaparar entradas. La solución es un contexto de pagos (TD-005).

## Alternativas descartadas
- JWT con usuarios y contraseñas: exige un contexto de identidad (alta, login, hash de
  contraseñas) fuera del alcance del dominio de venta.
- Proteger también la compra con clave: rompería el caso de uso público principal.
- Límite solo en un proxy (nginx): el proyecto no incluye proxy y el límite debe probarse con la app.
