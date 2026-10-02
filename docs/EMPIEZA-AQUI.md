# 🚀 Empieza aquí: de cero a la entrega

Esta es la guía **maestra**. Dice qué hacer **primero**, qué después y en qué orden, desde
una computadora sin nada instalado hasta entregar y defender el proyecto.

Marca cada casilla `[ ]` a medida que avances.

```
ETAPA 1  Entender qué tienes ........................ 10 min
ETAPA 2  Preparar tu computadora .................... 30–45 min (solo una vez)
ETAPA 3  Descargar y levantar el proyecto ........... 10 min
ETAPA 4  Comprobar que funciona ..................... 20 min
ETAPA 5  Estudiarlo para poder explicarlo ........... 5–7 días
ETAPA 6  Preparar la entrega ........................ 30 min
ETAPA 7  Preparar la defensa ........................ 1–2 horas
```

> Las instrucciones están pensadas para **Windows** (PowerShell). Donde Mac es distinto, verás 🍎.

---

## ETAPA 1 — Entender qué tienes (10 min)

- [ ] Lee esto:
  - **Qué es**: una API REST de un tablero Kanban para una startup. Hay **usuarios**
    (miembros del equipo) y **tareas** que se asignan y se mueven por columnas
    `TODO → IN_PROGRESS → IN_REVIEW → DONE`.
  - **Cómo está hecho**: NestJS + TypeScript con arquitectura hexagonal, DDD y CQRS,
    PostgreSQL en Docker, migraciones, pruebas unitarias y e2e.
  - **Dónde está**: `https://github.com/bryanramosing-ux/Tarea-Curso_NestJS`, rama
    `claude/determined-pascal-319bv9` (hoy es la rama por defecto y la única).
- [ ] Ten a mano los documentos clave (los abrirás más adelante):

| Documento | Para qué |
|---|---|
| `README.md` | Instalación, comandos, endpoints |
| `docs/EMPIEZA-AQUI.md` | **Esta guía** (el orden de todo) |
| `docs/guia-paso-a-paso.md` | Aprender a construirlo tú mismo, fase por fase |
| `docs/rubric-self-assessment.md` | Cómo cumple cada criterio de la rúbrica |
| `docs/audit-checklist.md` | Auditoría de seguridad y bugs |
| `docs/business-rules/business-rules.md` | Las 14 reglas de negocio (RN-001…RN-014) |
| `docs/decisions/` | Por qué se tomó cada decisión (ADRs) |

---

## ETAPA 2 — Preparar tu computadora (solo una vez)

### 2.1 Instalar los programas (en este orden)
- [ ] **Git** → https://git-scm.com/downloads (todo por defecto).
  🍎 En Terminal escribe `git --version`; si no está, macOS ofrece instalarlo.
- [ ] **Node.js LTS** (22.x) → https://nodejs.org (todo por defecto).
- [ ] **Docker Desktop** → https://www.docker.com/products/docker-desktop/
  - Si pide activar **WSL 2**, acepta; si pide reiniciar, reinicia.
  - Ábrelo y espera a que diga **Engine running** (verde).
- [ ] **VS Code** → https://code.visualstudio.com
  - Extensiones (`Ctrl+Shift+X`): instala **Thunder Client** (para probar la API).

### 2.2 Comprobar las instalaciones
Abre **PowerShell** (🍎 Terminal) y ejecuta uno por uno:
```powershell
git --version
node -v
docker --version
docker compose version
```
- [ ] Todos muestran una versión. (Si uno dice "no se reconoce", cierra y abre la terminal; si persiste, reinstálalo.)

### 2.3 Instalar pnpm
```powershell
npm install -g pnpm
pnpm -v
```
- [ ] Muestra una versión.

> ⚠️ Si PowerShell dice *"la ejecución de scripts está deshabilitada"*:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` → responde `S` → vuelve a probar.

### 2.4 Configurar tu identidad en Git (para tus commits)
```powershell
git config --global user.name "Tu Nombre"
git config --global user.email "tu-correo@ejemplo.com"
```
- [ ] Hecho.

---

## ETAPA 3 — Descargar y levantar el proyecto

### 3.1 Descargar
```powershell
cd $HOME\Documents
git clone https://github.com/bryanramosing-ux/Tarea-Curso_NestJS.git
cd Tarea-Curso_NestJS
code .
```
🍎 `cd ~/Documents`. El último comando abre la carpeta en VS Code (si no funciona, ábrela con *Archivo → Abrir carpeta*).

- [ ] La carpeta tiene `src/`, `test/`, `docs/`, `README.md`.

> Si GitHub pide iniciar sesión, hazlo en la ventana que se abre (el repositorio es tuyo).

### 3.2 Instalar dependencias
```powershell
pnpm install
```
- [ ] Termina con `Done in ...`.

### 3.3 Crear tu `.env`
```powershell
Copy-Item .env.example .env
```
🍎 `cp .env.example .env`
- [ ] Existe el archivo `.env` (no lo subas nunca a GitHub; ya está en `.gitignore`).

### 3.4 Levantar la base de datos
Con **Docker Desktop abierto**:
```powershell
docker compose up -d --wait
```
- [ ] Dice `Container kanban-postgres Healthy`.

### 3.5 Crear las tablas
```powershell
pnpm migration:run
```
- [ ] Aparecen **3** mensajes `... has been executed successfully`.

### 3.6 Arrancar la API
```powershell
pnpm start:dev
```
- [ ] Ves `Kanban API listening on port 3000`. **Deja esta terminal abierta.**

---

## ETAPA 4 — Comprobar que funciona

### 4.1 Pruebas automáticas
Abre **otra** terminal en la carpeta del proyecto (en VS Code: *Terminal → Nueva terminal*):
```powershell
pnpm test
pnpm test:e2e
```
- [ ] `pnpm test` → `Tests: 194 passed`
- [ ] `pnpm test:e2e` → `Tests: 45 passed`

### 4.2 Probar a mano (Thunder Client)
En VS Code → icono del rayo → **New Request**. Para los que tienen cuerpo: pestaña **Body → JSON**.

| # | Método y URL | Cuerpo | Debe responder |
|---|---|---|---|
| 1 | `POST http://localhost:3000/users` | `{"name":"Ana","email":"ana@startup.io","password":"secret123"}` | **201** `{id}` → copia el id (`ID_ANA`) |
| 2 | `GET http://localhost:3000/users/ID_ANA` | — | **200**, sin contraseña |
| 3 | Repite el 1 | igual | **409** email repetido |
| 4 | `POST http://localhost:3000/users` | `{"name":"Ana","email":"b@startup.io","password":"abcdefgh"}` | **400** contraseña débil |
| 5 | `POST http://localhost:3000/tasks` | `{"title":"Preparar demo","priority":"HIGH"}` | **201** → copia el id (`ID_TAREA`) |
| 6 | `PATCH http://localhost:3000/tasks/ID_TAREA/status` | `{"status":"IN_PROGRESS"}` | **409** no tiene responsable |
| 7 | `PATCH http://localhost:3000/tasks/ID_TAREA/assignee` | `{"assigneeId":"ID_ANA"}` | **204** |
| 8 | Repite el 6 | igual | **204** |
| 9 | `PATCH http://localhost:3000/tasks/ID_TAREA/status` | `{"status":"DONE"}` | **409** no se puede saltar columnas |
| 10 | `POST http://localhost:3000/users/ID_ANA/deactivate` | — | **204** |
| 11 | `GET http://localhost:3000/tasks/ID_TAREA` | — | **200**, volvió a `TODO` sin responsable |

- [ ] Las 11 respuestas coinciden.

> Si algo no coincide, mira la tabla **"Si algo sale mal"** al final.

---

## ETAPA 5 — Estudiarlo para poder explicarlo

Tienes dos caminos. **Recomendado: el B**, porque construir es la mejor forma de aprender.

### Camino A — Leer el código en orden (2–3 días)
Abre los archivos en este orden (de adentro hacia afuera del hexágono):

1. `src/shared/domain/` → la base: errores, eventos, agregado.
2. `src/users/domain/value-objects/email.ts` → qué es un value object.
3. `src/users/domain/entities/user.ts` → entidad rica.
4. `src/users/domain/ports/` → puertos.
5. `src/users/application/commands/create-user/` → un caso de uso CQRS.
6. `src/users/infrastructure/persistence/` → adaptadores (memoria y PostgreSQL) + mapper.
7. `src/users/infrastructure/http/users.controller.ts` → controlador delgado.
8. `src/users/users.module.ts` → dónde se conectan puertos y adaptadores.
9. Repite 2–8 con `src/tasks/` (fíjate en `task-status.ts` y `task.ts`).
10. `src/tasks/infrastructure/adapters/` y `event-handlers/` → comunicación entre contextos.
11. `src/database/migrations/` y `src/config/`.
12. `test/` → e2e y la prueba de arquitectura.

En cada archivo pregúntate: *¿en qué capa está? ¿de qué depende? ¿qué regla protege?*

### Camino B — Construirlo tú desde cero (5–7 días)
- [ ] Sigue `docs/guia-paso-a-paso.md` (18 fases, con puntos de control y preguntas de repaso).

### En ambos casos
- [ ] Lee `docs/business-rules/business-rules.md` y localiza en el código 3 reglas (busca `RN-009`, por ejemplo: `Ctrl+Shift+F` en VS Code).
- [ ] Lee 3 ADRs de `docs/decisions/` (empieza por ADR-001, ADR-004 y ADR-007).
- [ ] Haz el experimento: añade `import { Injectable } from '@nestjs/common';` al inicio de
  `src/users/domain/value-objects/email.ts`, ejecuta `pnpm test`, mira cómo **falla** la
  prueba de arquitectura y luego **quita** la línea.

---

## ETAPA 6 — Preparar la entrega

### 6.1 Pasar el código a la rama `main` (recomendado)
Hoy el código está en una rama con nombre automático. Es más claro entregar en `main`:
```powershell
git checkout -b main
git push -u origin main
```
Luego en GitHub: **Settings → General → Default branch** → cambia a `main` → **Update**.
- [ ] La página principal del repositorio en GitHub muestra el README en la rama `main`.

> (Opcional) Después puedes borrar la rama antigua en GitHub → *Branches*. No es obligatorio.

### 6.2 Verificación final (lo que hará el evaluador)
Haz una instalación **limpia** en otra carpeta, exactamente como lo haría otra persona:
```powershell
docker compose down -v        # en tu carpeta actual: apaga y borra la base
cd $HOME\Documents
git clone https://github.com/bryanramosing-ux/Tarea-Curso_NestJS.git prueba-entrega
cd prueba-entrega
pnpm install
Copy-Item .env.example .env
docker compose up -d --wait
pnpm migration:run
pnpm test
pnpm test:e2e
pnpm start:dev
```
- [ ] Todo funciona en la carpeta nueva **solo siguiendo el README**.

Al terminar, apaga esa copia y vuelve a tu carpeta de trabajo:
```powershell
docker compose down -v
cd $HOME\Documents\Tarea-Curso_NestJS
docker compose up -d --wait
pnpm migration:run
```

### 6.3 Comprobaciones de la rúbrica
En la carpeta del proyecto:
```powershell
git ls-files | Select-String "\.env"                          # solo debe aparecer .env.example
Get-ChildItem src -Recurse -Filter *.ts | Where-Object { $_.FullName -match "\\domain\\" } | Select-String -Pattern "@nestjs|typeorm|class-validator"   # vacío
```
🍎 / Git Bash:
```bash
git ls-files | grep "\.env"
grep -rn "@nestjs\|typeorm\|class-validator" src/*/domain/
```
- [ ] `.env` no está en Git.
- [ ] El dominio no importa frameworks.
- [ ] Repasaste `docs/rubric-self-assessment.md` (los 10 criterios).

### 6.4 Entregar
- [ ] Entrega el enlace: `https://github.com/bryanramosing-ux/Tarea-Curso_NestJS`
- [ ] Si te piden un resumen, usa la sección inicial del README.

---

## ETAPA 7 — Preparar la defensa

### 7.1 Ensaya las preguntas
- [ ] Responde **en voz alta** las 13 preguntas de la Fase 18 de `docs/guia-paso-a-paso.md`.

### 7.2 Guion de demostración (5 minutos)
1. **(30 s)** "Es un tablero Kanban con dos contextos: Users y Tasks."
2. **(1 min)** Muestra las carpetas `src/users/domain`, `application`, `infrastructure` y explica la regla de dependencias.
3. **(1 min)** Abre `task-status.ts` (tabla de transiciones) y `task.ts` (`changeStatus`): "las reglas viven en el dominio".
4. **(1 min)** Demo en vivo con Thunder Client: pasos 5→6→7→8→9 de la Etapa 4 (409 sin responsable, 204, 409 al saltar columnas).
5. **(1 min)** Demo del evento entre contextos: pasos 10 y 11 (desactivar usuario → la tarea vuelve a TODO).
6. **(30 s)** Ejecuta `pnpm test` y muestra la prueba de arquitectura en verde.

- [ ] Ensayaste la demo al menos una vez de principio a fin.

### 7.3 Antes de la presentación
- [ ] Docker Desktop abierto, `docker compose up -d --wait`, `pnpm start:dev` funcionando.
- [ ] Las peticiones de Thunder Client guardadas en una colección (para no escribirlas en vivo).

---

## Si algo sale mal

| Mensaje | Qué hacer |
|---|---|
| `Invalid environment configuration (check your .env)` | Falta el `.env`: Etapa 3.3 |
| `Cannot connect to the Docker daemon` / `error during connect` | Abre Docker Desktop y espera *Engine running* |
| `port is already allocated` (5432) | Otro PostgreSQL usa el puerto: en `.env` cambia `DB_PORT=5433` y repite 3.4–3.6 |
| `EADDRINUSE :::3000` | Otro programa usa el 3000: en `.env` pon `PORT=3001` y usa ese puerto en las URLs |
| `ECONNREFUSED` | La base no está levantada: Etapa 3.4 |
| `relation "users" does not exist` | Faltan migraciones: Etapa 3.5 |
| `pnpm` bloqueado en PowerShell | Etapa 2.3 (comando `Set-ExecutionPolicy`) |
| `password authentication failed` | Cambiaste la contraseña del `.env` después de crear la base: `docker compose down -v` y repite 3.4–3.5 (borra los datos) |
| `409 ..._CONCURRENT_MODIFICATION` | Dos peticiones cambiaron lo mismo a la vez: vuelve a enviar la tuya |

## Comandos que usarás todos los días

| Quiero… | Comando |
|---|---|
| Encender la base | `docker compose up -d --wait` |
| Arrancar la API | `pnpm start:dev` (apagar: `Ctrl + C`) |
| Pruebas | `pnpm test` y `pnpm test:e2e` |
| Apagar la base (conserva datos) | `docker compose stop` |
| Borrar la base y empezar de cero | `docker compose down -v` → `docker compose up -d --wait` → `pnpm migration:run` |
| Traer cambios de GitHub | `git pull` → `pnpm install` → `pnpm migration:run` |
