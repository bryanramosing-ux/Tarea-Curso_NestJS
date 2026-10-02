# Checklist de auditoría: vulnerabilidades, bugs y errores

Fecha de la auditoría: 2026-10-02 · Entorno: Linux, Node 22.22, pnpm 10.28, PostgreSQL 16 (Docker).

Leyenda: ✅ verificado con evidencia · 🔧 fallo encontrado **y corregido** en esta auditoría ·
⚠️ limitación conocida, documentada y no corregida · ❌ falla (ninguno al cierre).

## Resumen

| Área | Resultado |
|---|---|
| Vulnerabilidades en dependencias (`pnpm audit`, 624 paquetes) | ✅ 0 (crítica/alta/media/baja) |
| Compilación (`pnpm typecheck`, `pnpm build`) | ✅ sin errores |
| Pruebas unitarias + arquitectura (`pnpm test`) | ✅ 194/194 |
| Pruebas e2e con PostgreSQL real (`pnpm test:e2e`) | ✅ 45/45 |
| Bugs encontrados | 🔧 1 grave (actualización perdida por concurrencia), corregido y con prueba de regresión |
| Debilidades de seguridad encontradas | 🔧 3 corregidas (cabeceras/`X-Powered-By`, BD expuesta a la red, errores sin formato uniforme) |
| Limitaciones que siguen abiertas | ⚠️ 4 nuevas (TD-012…TD-014 y rate limiting); detalle en [`technical-debt.md`](technical-debt.md) |

## Hallazgos

| # | Severidad | Hallazgo | Cómo se encontró | Estado |
|---|---|---|---|---|
| H-1 | **Alta** (bug de integridad) | **Actualización perdida**: dos operaciones sobre la misma tarea se sobrescribían. Se reprodujo con el repositorio real: tras desactivar a un miembro y liberar su tarea, una petición concurrente con una copia antigua la dejaba `IN_REVIEW` **asignada al miembro inactivo** (rompe RN-010/RN-013). Mismo problema en `User` (doble `UserDeactivated`). | Reproducción determinista contra PostgreSQL | 🔧 Bloqueo optimista con columna `version` (ADR-011), migración `AddOptimisticLockingVersion`, error 409 `*_CONCURRENT_MODIFICATION`, reintento en la liberación de tareas. Regresión: `test/e2e/concurrency.e2e-spec.ts`. **Control negativo**: al restaurar el código anterior, la prueba falla. |
| H-2 | Media | La base de datos se publicaba en `0.0.0.0:5432`: cualquier equipo de la red local podía intentar conectarse con la contraseña de ejemplo. | Revisión de `docker-compose.yml` | 🔧 Publicada solo en `127.0.0.1` (verificado con `docker port`). |
| H-3 | Baja | Cabecera `X-Powered-By: Express` (revela la tecnología) y sin cabeceras de seguridad (`nosniff`, CSP, frameguard). | Inspección de respuestas con `curl -i` | 🔧 `helmet` 8.3.0. Prueba: `http-security.e2e-spec.ts`. |
| H-4 | Baja (consistencia) | Los errores del framework (JSON mal formado, ruta inexistente, id no UUID) no tenían `code` ni la forma `{ statusCode, code, message, path, timestamp }`. | Pruebas de entradas hostiles | 🔧 `HttpExceptionFilter` y `parseIdPipe()`. Los errores de dominio siguen traduciéndose solo en `DomainExceptionFilter`. |
| H-5 | Baja | Carrera residual entre asignar una tarea y desactivar a su responsable (dos agregados distintos; ventana de milisegundos). | Análisis del flujo | ⚠️ TD-012 |
| H-6 | Baja | Una fila corrupta (editada a mano en la BD) responde 400 en vez de 500. | Revisión de `fromPrimitives` | ⚠️ TD-013 |
| H-7 | Informativa | El 413 (cuerpo > 100 kB) se responde bien pero Nest lo registra como `ERROR`. | Log de la app | ⚠️ TD-014 |
| H-8 | Media si se expone a Internet | Sin rate limiting: `POST /users` es costoso a propósito (scrypt). | Revisión | ⚠️ TD-007 (no se añadió para no exigir nuevas variables en tu `.env`) |

## Checklist detallado

### 1. Dependencias y cadena de suministro
- [x] ✅ `pnpm audit`: 0 vulnerabilidades en 624 dependencias (incluido `helmet` añadido).
- [x] ✅ Versiones exactas en `package.json` y `pnpm-lock.yaml` versionado (`pnpm install --frozen-lockfile` reproducible).
- [x] ✅ Sin dependencias nativas ni scripts de instalación (scrypt nativo de Node en lugar de `bcrypt`).
- [x] ✅ Se usan versiones mayores estables (Nest 11, TypeORM 0.3, TS 5.9, Jest 29) en lugar de las recién publicadas.

### 2. Secretos y configuración
- [x] ✅ `.env` **nunca** se ha versionado (revisado en todo el historial: `git log --all`).
- [x] ✅ `.env.example` solo con valores de ejemplo; búsqueda de contraseñas/tokens literales en el código: ninguno.
- [x] ✅ Sin `.env` la app y el CLI fallan al arrancar con un mensaje que nombra la variable, **no su valor** (probado).
- [x] ✅ `process.env` solo en `src/config/` (regla automática).
- [x] ✅ Las e2e se niegan a correr si `DB_NAME_TEST` coincide con `DB_NAME`.
- [x] 🔧 PostgreSQL solo escucha en `127.0.0.1` (H-2).

### 3. Contraseñas y datos sensibles
- [x] ✅ Hash scrypt con sal aleatoria; en la BD solo hay `scrypt$…` (verificado leyendo la fila).
- [x] ✅ Ninguna respuesta contiene `password`/`hash` (unitarias y e2e).
- [x] ✅ Errores de validación sin eco de valores (la contraseña rechazada no aparece en la respuesta).
- [x] ✅ `PlainPassword`/`PasswordHash` se serializan como `[REDACTED]`; TypeORM con `logging: false`.
- [x] ✅ Los eventos no transportan credenciales.

### 4. Entradas hostiles (probadas contra la API en ejecución)
| Prueba | Resultado |
|---|---|
| JSON mal formado | ✅ 400 `BAD_REQUEST` |
| Tipos incorrectos (`"name": 123`, arrays) | ✅ 400 `REQUEST_VALIDATION_FAILED` |
| Propiedades no permitidas (`"rol":"admin"`) | ✅ 400 `property rol should not exist` |
| `__proto__` / `constructor` en el cuerpo | ✅ descartadas; **sin contaminación de prototipos** (verificado en proceso) |
| Inyección SQL en email, título y filtros | ✅ rechazada por el dominio o guardada como texto literal (consultas parametrizadas) |
| Query anidada `?status[foo]=bar` y arrays `?status=A&status=B` | ✅ 400 |
| Cuerpo de 2 MB | ✅ 413 |
| `Content-Type: text/plain` | ✅ 400 |
| `<script>` en el título | ✅ se guarda como texto; respuesta `application/json` con `nosniff` (sin XSS en la API) |
| UUID nulo / en mayúsculas | ✅ 400 / normalizado y 404 |
| Ruta o método inexistente | ✅ 404 `ROUTE_NOT_FOUND` |
| ReDoS en la expresión del email | ✅ la longitud (≤ 254) se comprueba antes de la expresión regular |

### 5. Bugs y lógica de negocio
- [x] 🔧 Actualizaciones concurrentes (H-1): bloqueo optimista + reintento en RN-013.
- [x] ✅ Unicidad del email ante 3 registros simultáneos: 1×201 y 2×409 (restricción `UNIQUE`).
- [x] ✅ Matriz de transiciones Kanban probada: las 12 combinaciones entre estados distintos + moverse al mismo estado.
- [x] ✅ Las `CHECK`/FK de la BD rechazan estados inválidos escritos fuera de la app.
- [x] ✅ Evento entre contextos: la tarea vuelve a `TODO` y la tarea `DONE` conserva su responsable.
- [x] ⚠️ Carrera asignación ↔ desactivación (H-5, TD-012).

### 6. Errores y respuestas HTTP
- [x] ✅ Ningún error de negocio produce 500 (switch exhaustivo en el filtro).
- [x] 🔧 Todas las respuestas de error comparten la forma `{ statusCode, code, message, path, timestamp }` (H-4).
- [x] ✅ Catálogo actualizado en [`business-rules/error-catalog.md`](business-rules/error-catalog.md).

### 7. Arquitectura (faltas graves de la rúbrica)
- [x] ✅ Sin imports de NestJS/TypeORM/class-validator en `domain/` (incluido el nuevo `AggregateRoot`).
- [x] ✅ Ningún dominio importa otro contexto; controladores solo usan los buses.
- [x] ✅ Eventos publicados después de persistir (la regla automática detectó un refactor que la ocultaba; se reestructuró el handler en lugar de relajar la regla).
- [x] ✅ Sin `@Entity` fuera de `*.orm-entity.ts`; `synchronize: false`.
- [x] ✅ Ningún test con `skip`/`only`.

### 8. Pruebas: que sean reales
- [x] ✅ Control negativo del matcher de errores (un caso que debía fallar, falló).
- [x] ✅ Mutaciones de arquitectura (4 violaciones inyectadas → 4 detectadas).
- [x] ✅ Control negativo del bloqueo optimista (se restauró el código anterior → la prueba e2e falla).
- [x] ✅ Las 8 pruebas que cambiaron con la auditoría se ajustaron por un cambio **intencionado** del contrato (una fila almacenada siempre tiene `version ≥ 1`) y se añadieron pruebas que verifican ese contrato.

### 9. Migraciones y base de datos
- [x] ✅ 3 migraciones con `up()`/`down()`; la e2e revierte las tres y las reaplica.
- [x] ✅ Aplicadas sobre una base existente con datos (desarrollo) sin pérdida (`DEFAULT 1`).
- [x] ✅ Instalación desde cero en un clon limpio tras la auditoría: 3 migraciones, 194/194 unitarias, 45/45 e2e, API compilada responde 201.

## Qué tienes que hacer tú si ya tenías el proyecto
```bash
git pull
pnpm install                    # instala helmet
docker compose up -d --wait     # recrea el contenedor ligado a 127.0.0.1 (conserva los datos)
pnpm migration:run              # aplica AddOptimisticLockingVersion
pnpm test && pnpm test:e2e
```
