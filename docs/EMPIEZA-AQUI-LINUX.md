# 🐧 Empieza aquí (Linux): de cero a la entrega

Versión para **Linux** de [`EMPIEZA-AQUI.md`](EMPIEZA-AQUI.md). Todo se hace desde la
**terminal**: qué instalar, de dónde descargarlo, qué comandos ejecutar y qué debe salir
en cada paso.

> Probada en **Ubuntu 24.04 LTS**. Sirve tal cual para Ubuntu 22.04+, Linux Mint 21+,
> Pop!_OS y otras derivadas de Ubuntu. Para **Debian**, **Fedora** y **Arch** se indican
> las diferencias con 🟥 Debian · 🟦 Fedora · 🟪 Arch.

Marca cada casilla `[ ]` a medida que avances.

```
ETAPA 0  Preparar la terminal ........................ 5 min
ETAPA 1  Entender qué tienes ......................... 10 min
ETAPA 2  Instalar las herramientas ................... 20–30 min (solo una vez)
ETAPA 3  Descargar y levantar el proyecto ............ 10 min
ETAPA 4  Comprobar que funciona ...................... 20 min
ETAPA 5  Estudiarlo para poder explicarlo ............ 5–7 días
ETAPA 6  Preparar la entrega ......................... 30 min
ETAPA 7  Preparar la defensa ......................... 1–2 horas
```

---

## ETAPA 0 — Preparar la terminal

- [ ] Abre una terminal: **`Ctrl + Alt + T`** (o busca "Terminal" en el menú de aplicaciones).
- [ ] Comprueba tu distribución y que tienes permisos de administrador:
  ```bash
  cat /etc/os-release | head -3     # qué distribución y versión usas
  sudo -v                           # te pide tu contraseña; si no da error, tienes sudo
  ```

> 💡 Convenciones de esta guía:
> - Copia los comandos **línea por línea** (o el bloque completo si así se indica).
> - `sudo` ejecuta como administrador y te pide **tu** contraseña (no se ve mientras la escribes; es normal).
> - Las líneas que empiezan por `#` son comentarios: no hace falta copiarlas.
> - Para pegar en la terminal: **`Ctrl + Shift + V`** (no `Ctrl + V`).

---

## ETAPA 1 — Entender qué tienes (10 min)

- [ ] Lee esto:
  - **Qué es**: una API REST de **venta de entradas para eventos**. Hay un **catálogo** de
    eventos (conciertos, obras…) y una **venta** que nunca sobrevende el aforo, valida cada
    entrada en la puerta una sola vez y reembolsa si el evento se cancela.
  - **Cómo está hecho**: NestJS + TypeScript con arquitectura hexagonal, DDD y CQRS;
    PostgreSQL en Docker; migraciones; pruebas unitarias y e2e.
  - **Dónde está**: `https://github.com/bryanramosing-ux/Tarea-Curso_NestJS`.

| Documento | Para qué |
|---|---|
| `README.md` | Referencia técnica: variables, endpoints, comandos |
| `docs/EMPIEZA-AQUI-LINUX.md` | **Esta guía** |
| `docs/guia-paso-a-paso.md` | Aprender a construirlo tú mismo, fase por fase |
| `docs/rubric-self-assessment.md` | Cómo cumple cada criterio de la rúbrica |
| `docs/audit-checklist.md` | Auditoría de seguridad y bugs |
| `docs/business-rules/business-rules.md` | Las 15 reglas de negocio (RN-001…RN-015) |
| `docs/decisions/` | Por qué se tomó cada decisión (ADRs) |

---

## ETAPA 2 — Instalar las herramientas (solo una vez)

Vas a instalar, en este orden:

| # | Herramienta | Para qué | Versión mínima |
|---|---|---|---|
| 2.1 | Utilidades básicas (`git`, `curl`, `jq`, `openssl`) | Descargar el proyecto y probar la API | cualquiera |
| 2.2 | **Docker Engine** + plugin **Compose** | Levantar PostgreSQL | Docker 24+, Compose v2 |
| 2.3 | **nvm** + **Node.js 22 LTS** | Ejecutar NestJS | Node 20+ |
| 2.4 | **pnpm** | Instalar las dependencias del proyecto | 10.x |
| 2.5 | Configurar Git | Firmar tus commits | — |
| 2.6 | *(Opcional)* VS Code | Editar y leer el código | — |

### 2.1 Utilidades básicas

```bash
sudo apt update
sudo apt install -y git curl jq openssl ca-certificates
```
- 🟥 Debian: igual.
- 🟦 Fedora: `sudo dnf install -y git curl jq openssl ca-certificates`
- 🟪 Arch: `sudo pacman -S --needed git curl jq openssl ca-certificates`

Comprueba:
```bash
git --version && curl --version | head -1 && jq --version && openssl version
```
- [ ] Los cuatro muestran una versión.

### 2.2 Docker Engine y Docker Compose

> ⚠️ **No uses** el paquete `docker.io` ni `docker-compose` (con guion) de los repositorios
> de Ubuntu: suelen ser antiguos y no traen `docker compose` (con espacio), que es el que usa
> el proyecto. Instala Docker desde **su repositorio oficial**
> (documentación: https://docs.docker.com/engine/install/).

**a) Quitar versiones antiguas** (si no había ninguna, mostrará avisos; no pasa nada):
```bash
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt remove -y $pkg; done
```

**b) Añadir el repositorio oficial de Docker** (copia el bloque completo):
```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
```
> 🟥 Debian: cambia las dos apariciones de `linux/ubuntu` por `linux/debian`.
> (En Linux Mint/Pop!_OS el bloque funciona tal cual: usa el nombre de la versión de Ubuntu en la que se basan.)

**c) Instalar Docker y el plugin Compose:**
```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```
- 🟦 Fedora (41+):
  ```bash
  sudo dnf -y install dnf-plugins-core
  sudo dnf config-manager addrepo --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo
  sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  ```
  (En Fedora 40 o anterior: `sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo`.)
- 🟪 Arch: `sudo pacman -S --needed docker docker-compose docker-buildx`

**d) Arrancar Docker y que arranque solo al encender el equipo:**
```bash
sudo systemctl enable --now docker
```

**e) Usar Docker sin `sudo`** (añade tu usuario al grupo `docker`):
```bash
sudo usermod -aG docker $USER
newgrp docker
```
> ⚠️ `newgrp` solo aplica el cambio a **esa** terminal. Para que valga en todas,
> **cierra sesión y vuelve a entrar** (o reinicia el equipo).

**f) Comprobar:**
```bash
docker --version
docker compose version
docker run --rm hello-world
```
- [ ] `docker --version` → `Docker version 2x.x.x…`
- [ ] `docker compose version` → `Docker Compose version v2.x.x`
- [ ] `hello-world` imprime **"Hello from Docker!"** (sin pedir `sudo`).

### 2.3 Node.js 22 LTS con nvm

> 💡 **¿Por qué nvm y no `sudo apt install nodejs`?** Los repositorios de muchas
> distribuciones traen un Node antiguo, y con el Node del sistema los paquetes globales
> exigen `sudo` (errores `EACCES`). `nvm` instala Node en tu carpeta personal, sin `sudo`.

**a) Instalar nvm** (versión actual en https://github.com/nvm-sh/nvm#installing-and-updating):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

**b) Cargar nvm en la terminal actual** (o cierra y abre la terminal):
```bash
source ~/.bashrc
```
> Si usas **zsh**: `source ~/.zshrc`.

**c) Instalar Node 22 y dejarlo por defecto:**
```bash
nvm install 22
nvm alias default 22
```

**d) Comprobar:**
```bash
node -v      # v22.x.x
npm -v       # 10.x.x
```
- [ ] `node -v` empieza por `v22` (o `v20`+).

### 2.4 pnpm

Node 22 incluye **Corepack**, que instala la versión exacta de pnpm que pide el proyecto:
```bash
corepack enable
corepack prepare pnpm@10.28.0 --activate
pnpm -v      # 10.28.0
```
> Alternativa si `corepack` no existe en tu Node: `npm install -g pnpm@10.28.0`
> (con nvm no necesita `sudo`).

- [ ] `pnpm -v` muestra `10.x`.

### 2.5 Configurar Git (para tus commits)
```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu-correo@ejemplo.com"
git config --global init.defaultBranch main
```
- [ ] Hecho.

### 2.6 (Opcional) VS Code
```bash
sudo snap install code --classic
```
- O descarga el `.deb` de https://code.visualstudio.com/download e instálalo con
  `sudo apt install ./code_*.deb` desde la carpeta Descargas.
- 🟦 Fedora / 🟪 Arch: sigue https://code.visualstudio.com/docs/setup/linux

### 2.7 Resumen: comprobar todo de una vez
```bash
echo "git:    $(git --version)"
echo "docker: $(docker --version)"
echo "compose:$(docker compose version)"
echo "node:   $(node -v)"
echo "pnpm:   $(pnpm -v)"
echo "jq:     $(jq --version)"
```
- [ ] Las seis líneas muestran una versión.

---

## ETAPA 3 — Descargar y levantar el proyecto

### 3.1 Descargar
```bash
mkdir -p ~/proyectos && cd ~/proyectos
git clone https://github.com/bryanramosing-ux/Tarea-Curso_NestJS.git
cd Tarea-Curso_NestJS
ls
```
- [ ] Ves `README.md`, `docker-compose.yml`, `package.json`, `src`, `test`, `docs`.

> Si GitHub pide usuario y contraseña: la "contraseña" debe ser un **token personal**
> (GitHub → *Settings → Developer settings → Personal access tokens*), no tu contraseña de la web.

### 3.2 Instalar dependencias
```bash
pnpm install
```
- [ ] Termina con `Done in …`.

### 3.3 Crear tu `.env` (configuración)
```bash
cp .env.example .env
```
Genera un secreto propio para los códigos de entrada (recomendado):
```bash
sed -i "s/^TICKET_CODE_SECRET=.*/TICKET_CODE_SECRET=$(openssl rand -hex 32)/" .env
grep TICKET_CODE_SECRET .env      # debe mostrar 64 caracteres hexadecimales
```
- [ ] Existe `.env` (no lo subas nunca a GitHub; ya está en `.gitignore`).

### 3.4 ¿Tienes un PostgreSQL instalado en el sistema?
El proyecto usa el puerto **5432**. Si tu equipo ya tiene PostgreSQL instalado, ese puerto
estará ocupado:
```bash
sudo ss -ltnp | grep ':5432' || echo "Puerto 5432 libre"
```
Si aparece algo (por ejemplo `postgres`), elige **una** opción:
- Detener el PostgreSQL del sistema: `sudo systemctl stop postgresql` (y `sudo systemctl disable postgresql` para que no arranque solo).
- O usar otro puerto: `sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env`

- [ ] El puerto que usará el proyecto está libre.

### 3.5 Levantar la base de datos
```bash
docker compose up -d --wait
docker compose ps
```
- [ ] Dice `Container ticketing-postgres Healthy` y `ps` muestra `ticketing-postgres` con estado `healthy`.

### 3.6 Crear las tablas (migraciones)
```bash
pnpm migration:run
```
- [ ] Aparecen **2** mensajes `... has been executed successfully`.

### 3.7 Arrancar la API
```bash
pnpm start:dev
```
- [ ] Ves `Ticketing API listening on port 3000`. **Deja esta terminal abierta** (para pararla: `Ctrl + C`).

---

## ETAPA 4 — Comprobar que funciona

Abre **otra terminal** (`Ctrl + Shift + T` abre una pestaña nueva) y entra en el proyecto:
```bash
cd ~/proyectos/Tarea-Curso_NestJS
```

### 4.1 Pruebas automáticas
```bash
pnpm test
pnpm test:e2e
```
- [ ] `pnpm test` → `Tests: 189 passed, 189 total`
- [ ] `pnpm test:e2e` → `Tests: 44 passed, 44 total`

### 4.2 Probar la API a mano con `curl` + `jq`

Copia **bloque por bloque** en la segunda terminal (con la API arrancada en la primera).
Cada respuesta termina con una línea `→ HTTP xxx`.

**Preparación** (variables y una función `api` para no repetir opciones):
```bash
API=http://localhost:3000
STARTS=$(date -u -d '+30 days' +%Y-%m-%dT21:00:00Z)      # una fecha futura, con zona horaria
api() { curl -s -w '\n→ HTTP %{http_code}\n' -H 'Content-Type: application/json' "$@"; }
echo "El evento empezará el $STARTS"
```

**Paso 1 — Programar un evento con aforo 3** → `201`
```bash
EVENT_ID=$(curl -s -X POST $API/events -H 'Content-Type: application/json' \
  -d "{\"name\":\"Rock en el Parque\",\"venue\":\"Estadio Nacional\",\"startsAt\":\"$STARTS\",\"capacity\":3,\"priceCents\":4500,\"currency\":\"PEN\"}" \
  | jq -r .id)
echo "EVENT_ID=$EVENT_ID"
api $API/events/$EVENT_ID | head -1 | jq .
```

**Paso 2 — Mismo recinto (en minúsculas) y misma hora** → `409 EVENT_SLOT_TAKEN`
```bash
api -X POST $API/events -d "{\"name\":\"Otro concierto\",\"venue\":\"estadio nacional\",\"startsAt\":\"$STARTS\",\"capacity\":10,\"priceCents\":0,\"currency\":\"USD\"}"
```

**Paso 3 — Disponibilidad** → `200` con `"available": 3`
```bash
api $API/tickets/availability/$EVENT_ID
```

**Paso 4 — Comprar 2 entradas** → `201`, total 9000 (90,00 PEN)
```bash
PURCHASE=$(curl -s -X POST $API/tickets -H 'Content-Type: application/json' \
  -d "{\"eventId\":\"$EVENT_ID\",\"quantity\":2,\"holderName\":\"Ana Pérez\",\"holderEmail\":\"ana@mail.com\"}")
echo "$PURCHASE" | jq .
TICKET_1=$(echo "$PURCHASE" | jq -r '.tickets[0].id')
CODE_1=$(echo "$PURCHASE" | jq -r '.tickets[0].code')
TICKET_2=$(echo "$PURCHASE" | jq -r '.tickets[1].id')
echo "TICKET_1=$TICKET_1  CODE_1=$CODE_1  TICKET_2=$TICKET_2"
```
> 🔐 Los códigos (`XXXX-XXXX-XXXX`) solo se muestran **ahora**. La base guarda únicamente su HMAC.

**Paso 5 — Intentar comprar 2 más (solo queda 1)** → `409 TICKET_NOT_ENOUGH_AVAILABLE`
```bash
api -X POST $API/tickets -d "{\"eventId\":\"$EVENT_ID\",\"quantity\":2,\"holderName\":\"Luis\",\"holderEmail\":\"luis@mail.com\"}"
```

**Paso 6 — Comprar 11 de golpe** → `400 TICKET_INVALID_QUANTITY`
```bash
api -X POST $API/tickets -d "{\"eventId\":\"$EVENT_ID\",\"quantity\":11,\"holderName\":\"Luis\",\"holderEmail\":\"luis@mail.com\"}"
```

**Paso 7 — Consultar la entrada 1** → `200`, **sin** el código
```bash
api $API/tickets/$TICKET_1
```

**Paso 8 — Validar la entrada 1 en la puerta** → `200`
```bash
api -X POST $API/tickets/check-in -d "{\"code\":\"$CODE_1\"}"
```

**Paso 9 — Validarla otra vez** → `409 TICKET_ALREADY_USED`
```bash
api -X POST $API/tickets/check-in -d "{\"code\":\"$CODE_1\"}"
```

**Paso 10 — Cancelar el evento** → `204`
```bash
api -X POST $API/events/$EVENT_ID/cancel
```

**Paso 11 — Ver las dos entradas tras cancelar** → la usada sigue `USED`, la otra pasa a `REFUNDED`
```bash
sleep 1
curl -s $API/tickets/$TICKET_1 | jq -r '"Entrada 1: " + .status'
curl -s $API/tickets/$TICKET_2 | jq -r '"Entrada 2: " + .status'
curl -s $API/tickets/availability/$EVENT_ID | jq '{sold, available, salesOpen}'
```

- [ ] Las 11 respuestas coinciden con lo esperado.

### 4.3 (Opcional) Demostrar que no se sobrevende
30 compras **simultáneas** para un evento con aforo 5:
```bash
STARTS2=$(date -u -d '+40 days' +%Y-%m-%dT20:00:00Z)
EVENT2=$(curl -s -X POST $API/events -H 'Content-Type: application/json' \
  -d "{\"name\":\"Concierto agotado\",\"venue\":\"Sala Pequeña\",\"startsAt\":\"$STARTS2\",\"capacity\":5,\"priceCents\":1000,\"currency\":\"USD\"}" | jq -r .id)
for i in $(seq 1 30); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST $API/tickets -H 'Content-Type: application/json' \
    -d "{\"eventId\":\"$EVENT2\",\"quantity\":1,\"holderName\":\"Fan $i\",\"holderEmail\":\"fan$i@mail.com\"}" &
done | sort | uniq -c
wait
curl -s $API/tickets/availability/$EVENT2 | jq '{capacity, sold, available}'
```
- [ ] Salen **5** respuestas `201` y **25** `409`, y `sold` es **5**.

### 4.4 (Opcional) Mirar dentro de la base de datos
```bash
docker exec -it ticketing-postgres psql -U ticketing -d ticketing
```
Dentro de `psql`:
```sql
\dt                                        -- lista de tablas
SELECT name, venue, status FROM events;
SELECT status, left(code_hash, 16) FROM tickets;   -- solo hashes, nunca el código
\q                                         -- salir
```

---

## ETAPA 5 — Estudiarlo para poder explicarlo

Tienes dos caminos. **Recomendado: el B**, porque construir es la mejor forma de aprender.

### Camino A — Leer el código en orden (2–3 días)
```bash
code .        # abre el proyecto en VS Code (si lo instalaste)
```
Lee en este orden (de adentro hacia afuera del hexágono):
1. `src/shared/domain/` → la base: errores, eventos, agregado con versión.
2. `src/catalog/domain/value-objects/venue.ts` y `ticket-price.ts` → value objects.
3. `src/catalog/domain/entities/event.ts` → agregado rico (`schedule`, `cancel`).
4. `src/catalog/domain/ports/` → puertos.
5. `src/catalog/application/commands/schedule-event/` → caso de uso CQRS.
6. `src/catalog/infrastructure/persistence/` → adaptadores + mapper.
7. `src/catalog/infrastructure/http/events.controller.ts` → controlador delgado.
8. `src/catalog/catalog.module.ts` → conexión de puertos y adaptadores.
9. Lo mismo en `src/ticketing/`. Lo clave: `ticket-allocation.ts` y `purchase-tickets.handler.ts`.
10. `src/ticketing/infrastructure/adapters/` y `event-handlers/` → comunicación entre contextos.
11. `src/database/migrations/` y `src/config/`.
12. `test/` → e2e y prueba de arquitectura.

Atajos útiles en la terminal:
```bash
grep -rn "RN-009" src                    # dónde se implementa una regla
grep -rln "@nestjs" src/*/domain || echo "El dominio no importa NestJS ✔"
find src -name "*.spec.ts" | wc -l       # cuántos archivos de prueba hay
```

### Camino B — Construirlo tú desde cero (5–7 días)
- [ ] Sigue [`guia-paso-a-paso.md`](guia-paso-a-paso.md) (18 fases).

### En ambos casos
- [ ] Lee `docs/business-rules/business-rules.md` y localiza 3 reglas con `grep -rn "RN-0" src`.
- [ ] Lee los ADR-001, ADR-007, ADR-011 y ADR-012 de `docs/decisions/`.
- [ ] Haz el experimento (y deshazlo al final):
  ```bash
  sed -i "1i import { Injectable } from '@nestjs/common';" src/ticketing/domain/value-objects/quantity.ts
  pnpm test 2>&1 | grep -E "✕|Tests:"        # falla la prueba de arquitectura
  git checkout -- src/ticketing/domain/value-objects/quantity.ts   # deshacer
  pnpm test 2>&1 | grep "Tests:"             # vuelve a estar en verde
  ```

---

## ETAPA 6 — Preparar la entrega

### 6.1 Pasar el código a la rama `main` (recomendado)
```bash
git checkout -b main
git push -u origin main
```
Luego en GitHub: **Settings → General → Default branch** → `main` → **Update**.
- [ ] La página del repositorio en GitHub muestra la rama `main`.

### 6.2 Verificación final: instalación limpia (lo que hará el evaluador)
```bash
cd ~/proyectos/Tarea-Curso_NestJS && docker compose down -v      # apaga y borra tu base
cd /tmp && rm -rf prueba-entrega
git clone https://github.com/bryanramosing-ux/Tarea-Curso_NestJS.git prueba-entrega
cd prueba-entrega
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait
pnpm migration:run
pnpm test
pnpm test:e2e
```
- [ ] Todo en verde **solo siguiendo el README**.

Al terminar, apaga la copia y vuelve a tu carpeta:
```bash
docker compose down -v
cd ~/proyectos/Tarea-Curso_NestJS
docker compose up -d --wait && pnpm migration:run
```

### 6.3 Comprobaciones de la rúbrica (copia el bloque completo)
```bash
echo "== .env versionado? (solo debe salir .env.example)";  git ls-files | grep '\.env'
echo "== dominio importa frameworks? (debe estar vacío)";   grep -rnE "@nestjs|typeorm|class-validator" src/*/domain/ || echo "OK, vacío"
echo "== process.env fuera de config? (debe estar vacío)";  grep -rn "process.env" src | grep -v "^src/config/" || echo "OK, vacío"
echo "== synchronize";                                      grep -rn "synchronize" src/config
echo "== tests desactivados? (debe estar vacío)";           grep -rnE "\.(skip|only)\(" src test --include=*.ts | grep -v architecture.spec || echo "OK, vacío"
echo "== vulnerabilidades en producción";                   pnpm audit --prod | tail -1
```
- [ ] Todas las comprobaciones dan el resultado esperado.
- [ ] Repasaste `docs/rubric-self-assessment.md` (los 10 criterios).

### 6.4 Entregar
- [ ] Entrega el enlace: `https://github.com/bryanramosing-ux/Tarea-Curso_NestJS`

---

## ETAPA 7 — Preparar la defensa

### 7.1 Ensaya las preguntas
- [ ] Responde **en voz alta** las 14 preguntas de la Fase 18 de `docs/guia-paso-a-paso.md`.

### 7.2 Guion de demostración (5 minutos)
1. **(30 s)** "Es una venta de entradas con dos contextos: Catálogo y Venta. La regla clave: nunca sobrevender."
2. **(1 min)** `tree -L 3 src/ticketing` (instálalo con `sudo apt install tree`) y explica `domain` / `application` / `infrastructure`.
3. **(1 min)** Abre `ticket-allocation.ts` (`sell`): "el cupo es un agregado y su versión impide que dos compras simultáneas se pisen".
4. **(1 min)** Demo en vivo: pasos 1, 4, 5, 8 y 9 de la Etapa 4.2.
5. **(1 min)** Demo del evento entre contextos: pasos 10 y 11 (la entrada no usada queda `REFUNDED`).
6. **(30 s)** Ejecuta la Etapa 4.3 (30 compras simultáneas → 5 vendidas) o `pnpm test:e2e`.

> 💡 Guarda los bloques de la Etapa 4.2 en un archivo `demo.sh` para no escribirlos en vivo.

### 7.3 Antes de la presentación
```bash
cd ~/proyectos/Tarea-Curso_NestJS
docker compose up -d --wait
pnpm migration:run
pnpm start:dev
```
- [ ] La API responde: `curl -s localhost:3000/events | jq length`

---

## Si algo sale mal

| Mensaje | Qué hacer |
|---|---|
| `permission denied while trying to connect to the Docker daemon socket` | Tu usuario no está en el grupo `docker`: `sudo usermod -aG docker $USER`, luego **cierra sesión y vuelve a entrar** (o `newgrp docker`). |
| `Cannot connect to the Docker daemon … Is the docker daemon running?` | `sudo systemctl start docker` (y `sudo systemctl enable docker`). |
| `docker: 'compose' is not a docker command` | Falta el plugin: `sudo apt install docker-compose-plugin` (Etapa 2.2). |
| `Bind for 0.0.0.0:5432 failed: port is already allocated` o `address already in use` | Otro PostgreSQL usa el puerto: Etapa 3.4. |
| `EADDRINUSE: address already in use :::3000` | `sudo ss -ltnp \| grep ':3000'` para ver quién lo usa; ciérralo o pon `PORT=3001` en `.env`. |
| `pnpm: command not found` | `corepack enable` (Etapa 2.4) o abre una terminal nueva. |
| `nvm: command not found` | `source ~/.bashrc` o abre una terminal nueva. |
| `EACCES: permission denied` al instalar algo global con npm | Estás usando el Node del sistema: instala Node con nvm (Etapa 2.3). **No uses `sudo` con npm/pnpm.** |
| `node: … requires Node.js >= 20` o errores de sintaxis raros | `node -v`; si es menor que 20: `nvm install 22 && nvm alias default 22`. |
| `ENOSPC: System limit for number of file watchers reached` (al usar `pnpm start:dev`) | `echo fs.inotify.max_user_watches=524288 \| sudo tee -a /etc/sysctl.conf && sudo sysctl -p` |
| `Invalid environment configuration (check your .env)` | Falta el `.env` o una variable (p. ej. `TICKET_CODE_SECRET`): Etapa 3.3. |
| `password authentication failed for user "ticketing"` | Cambiaste el `.env` después de crear la base: `docker compose down -v`, luego Etapas 3.5 y 3.6 (borra los datos). |
| `relation "events" does not exist` | Faltan migraciones: Etapa 3.6. |
| `400 EVENT_INVALID_START` / `EVENT_START_IN_PAST` | La fecha debe ser futura y llevar zona horaria (`…T21:00:00Z`). Usa la variable `STARTS` de la Etapa 4.2. |
| `jq: error … parse error` | La API no respondió JSON (¿está arrancada? ¿URL correcta?). Repite el comando sin `\| jq` para ver la respuesta. |
| `curl: (7) Failed to connect to localhost port 3000` | La API no está arrancada: Etapa 3.7. |
| `409 …_CONCURRENT_MODIFICATION` | Dos peticiones cambiaron lo mismo a la vez: vuelve a enviar la tuya. |

## Comandos que usarás todos los días

| Quiero… | Comando |
|---|---|
| Encender la base | `docker compose up -d --wait` |
| Ver si la base está viva | `docker compose ps` |
| Ver los logs de la base | `docker compose logs -f postgres` (salir: `Ctrl + C`) |
| Arrancar la API | `pnpm start:dev` (parar: `Ctrl + C`) |
| Pruebas | `pnpm test` y `pnpm test:e2e` |
| Comprobar tipos | `pnpm typecheck` |
| Estado de las migraciones | `pnpm migration:show` |
| Apagar la base (conserva datos) | `docker compose stop` |
| Borrar la base y empezar de cero | `docker compose down -v && docker compose up -d --wait && pnpm migration:run` |
| Traer cambios de GitHub | `git pull && pnpm install && pnpm migration:run` |
| Liberar espacio de Docker (imágenes sin usar) | `docker system prune` |
