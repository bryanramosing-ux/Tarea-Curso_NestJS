# Guía paso a paso: construir el proyecto desde cero (para aprenderlo)

Esta guía te lleva a **reconstruir tú mismo** la API de venta de entradas, fase por fase,
entendiendo el *porqué* de cada pieza. Al final podrás explicarla y defenderla ante el evaluador.

> **Cómo usarla**
> 1. Crea una carpeta **nueva y vacía** (tu versión). Ten abierto al lado este repositorio
>    (la versión de referencia).
> 2. En cada fase: lee la explicación → **escribe tú el código** (no copies sin leer) →
>    ejecuta el **punto de control** → compara con el archivo de referencia → `git commit`.
> 3. Responde las **preguntas de repaso** sin mirar. Si no puedes, relee.
>
> Tiempo estimado: 12–20 horas repartidas en varios días.
> Requisitos instalados: Node 20+, pnpm, Docker Desktop, Git y VS Code (ver `EMPIEZA-AQUI.md`).

---

## Índice

0. [Las ideas antes del código](#fase-0--las-ideas-antes-del-código)
1. [Proyecto vacío y herramientas](#fase-1--proyecto-vacío-y-herramientas)
2. [Shared kernel: errores, eventos, agregados](#fase-2--shared-kernel)
3. [Value objects del Catálogo](#fase-3--value-objects-del-catálogo)
4. [El agregado Event](#fase-4--el-agregado-event)
5. [Puertos del Catálogo](#fase-5--puertos-del-catálogo)
6. [Adaptador en memoria](#fase-6--adaptador-en-memoria)
7. [Casos de uso con CQRS (Catálogo)](#fase-7--casos-de-uso-con-cqrs-catálogo)
8. [Dominio de la Venta: cupo y entradas](#fase-8--dominio-de-la-venta)
9. [Casos de uso de la Venta](#fase-9--casos-de-uso-de-la-venta)
10. [Configuración validada](#fase-10--configuración-validada)
11. [Docker y migraciones](#fase-11--docker-y-migraciones)
12. [Persistencia real: TypeORM, mappers y bloqueo optimista](#fase-12--persistencia-real)
13. [El borde HTTP: DTOs, controladores, filtros](#fase-13--el-borde-http)
14. [Comunicación entre contextos](#fase-14--comunicación-entre-contextos)
15. [Pruebas e2e (incluida la de sobreventa)](#fase-15--pruebas-e2e)
16. [Prueba de arquitectura](#fase-16--prueba-de-arquitectura)
17. [Documentación y autoevaluación](#fase-17--documentación-y-autoevaluación)
18. [Preguntas que te puede hacer el evaluador](#fase-18--preguntas-del-evaluador)

---

## Fase 0 — Las ideas antes del código

### El problema que resolvemos
El NestJS "de tutorial" es `Controller → Service → Repository de TypeORM`. Las reglas quedan
desparramadas en servicios, las entidades son bolsas de datos con decoradores de base de
datos, y para probar una regla necesitas levantar Nest y una base de datos.

### Arquitectura hexagonal (puertos y adaptadores)
El **dominio** (las reglas) está en el centro. Todo lo técnico (HTTP, PostgreSQL, hashing)
está afuera y se conecta por **puertos**:
- **Puerto**: una *interfaz* que el dominio define ("necesito guardar eventos").
- **Adaptador**: una *implementación* ("los guardo en PostgreSQL" o "en un `Map` para pruebas").

**Regla de dependencias**: lo de afuera conoce lo de adentro, nunca al revés.
```
infrastructure  ──►  application  ──►  domain
(HTTP, BD, Nest)     (casos de uso)    (reglas puras, TypeScript sin frameworks)
```

### DDD táctico
| Pieza | Qué es | Ejemplo |
|---|---|---|
| **Value object** | Valor con reglas propias, inmutable, se compara por valor | `Venue`, `Quantity`, `Money` |
| **Agregado** | Algo con identidad que cambia y protege sus reglas | `Event`, `TicketAllocation`, `Ticket` |
| **Invariante** | Regla que *siempre* se cumple | "vendidas ≤ aforo" |
| **Evento de dominio** | Hecho ocurrido (en pasado) | `EventCancelled`, `TicketsSold` |
| **Bounded context** | Subsistema con su propio lenguaje | Catálogo y Venta |

> ⚠️ Cuidado con la palabra "evento": un **evento** (concierto) es el agregado `Event`; un
> **evento de dominio** es un hecho del negocio (`TicketsSold`). Distínguelos al explicar.

### CQRS
Separar **escribir** (Commands: `PurchaseTickets`) de **leer** (Queries: `GetTicket`). El
controlador pone un mensaje en un **bus** y un **handler** lo atiende.

### El dominio
Una productora de eventos:
- **Catálogo**: programa eventos (fecha, recinto, aforo, precio) y los cancela.
- **Venta**: vende entradas **sin sobrevender nunca**, las valida en la puerta **una vez** y
  las reembolsa si el evento se cancela.

**Preguntas de repaso**
1. ¿Por qué el dominio no puede importar NestJS ni TypeORM?
2. Diferencia entre puerto y adaptador, con un ejemplo de cada uno.
3. Diferencia entre un "evento" (concierto) y un "evento de dominio".

---

## Fase 1 — Proyecto vacío y herramientas

```bash
mkdir mi-ticketing && cd mi-ticketing
git init
pnpm init

pnpm add -E @nestjs/common@11.2.7 @nestjs/core@11.2.7 @nestjs/platform-express@11.2.7 @nestjs/cqrs@11.0.3 @nestjs/config@4.0.4 @nestjs/typeorm@11.0.3 typeorm@0.3.31 pg@8.16.3 class-validator@0.14.4 class-transformer@0.5.1 reflect-metadata@0.2.2 rxjs@7.8.2 dotenv@16.6.1 helmet@8.3.0

pnpm add -D -E @nestjs/cli@11.0.24 @nestjs/testing@11.2.7 typescript@5.9.3 ts-node@10.9.2 jest@29.7.0 ts-jest@29.4.14 @types/jest@29.5.14 @types/node@22.20.5 @types/express@5.0.6 @types/pg@8.23.1 supertest@7.1.4 @types/supertest@6.0.3
```

Para qué sirve cada una: `@nestjs/cqrs` (buses), `typeorm` + `pg` (PostgreSQL),
`@nestjs/config` (variables de entorno), `class-validator`/`class-transformer` (DTOs),
`helmet` (cabeceras de seguridad), `jest`/`ts-jest` (pruebas), `supertest` (HTTP en e2e).

Copia de la referencia y **lee cada línea**: `tsconfig.json`, `tsconfig.build.json`,
`nest-cli.json`, `.gitignore` (**`.env` nunca se sube**), `.gitattributes`, `.env.example`,
y las secciones `scripts` y `jest` de `package.json`. Crea también `test/architecture`
(Jest la busca aunque esté vacía):
```bash
mkdir test
mkdir test/architecture
```

**Punto de control**: `pnpm exec tsc --version` → 5.9.3 · `git commit -m "chore: scaffold"`.

---

## Fase 2 — Shared kernel

`src/shared/domain` contiene abstracciones **genéricas** de ambos contextos. Nunca conceptos de negocio.

### 2.1 La excepción de dominio
```ts
// src/shared/domain/domain-exception.ts
export const DomainErrorKind = { VALIDATION: 'VALIDATION', NOT_FOUND: 'NOT_FOUND', CONFLICT: 'CONFLICT' } as const;
export type DomainErrorKind = (typeof DomainErrorKind)[keyof typeof DomainErrorKind];

export abstract class DomainException extends Error {
  protected constructor(
    public readonly code: string,        // estable: 'TICKET_NOT_ENOUGH_AVAILABLE'
    public readonly kind: DomainErrorKind,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
```
> 💡 `code` es un contrato con el cliente. `kind` lo traducirá un filtro a 400/404/409.
> El dominio **no sabe** qué es HTTP.

### 2.2 Raíz de agregado: eventos + versión
```ts
// src/shared/domain/aggregate-root.ts (resumen)
export abstract class AggregateRoot {
  private domainEvents: DomainEvent[] = [];
  private _version: number;                       // 0 = nunca guardado; >= 1 = guardado

  protected constructor(version: number) { /* valida entero >= 0 */ this._version = version; }
  get version(): number { return this._version; }
  markAsPersisted(): void { this._version += 1; }  // lo llama el repositorio tras guardar

  protected record(event: DomainEvent): void { this.domainEvents.push(event); }
  pullDomainEvents(): DomainEvent[] { const e = this.domainEvents; this.domainEvents = []; return e; }
}
```
La versión servirá para el **bloqueo optimista** (fase 12): es lo que impide sobrevender.

### 2.3 Puerto para publicar eventos y utilidades
```ts
export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');
export interface DomainEventPublisher { publishAll(events: DomainEvent[]): Promise<void>; }
```
> 💡 **¿Por qué `Symbol`?** Las interfaces de TypeScript desaparecen al compilar; Nest
> necesita un valor real para saber qué inyectar.

Copia también `src/shared/domain/uuid.ts` (`generateUuid`, `isValidUuid`, `randomString`
con un generador **criptográfico**, que usaremos para los códigos de entrada).

---

## Fase 3 — Value objects del Catálogo

Un value object **no puede existir inválido**: constructor **privado**, factory `create()`
que **normaliza y valida**, y `equals()` para comparar por valor.

```ts
// src/catalog/domain/value-objects/venue.ts
/** RN-002: "Estadio Nacional" y "estadio nacional" son el mismo recinto. */
export class Venue {
  private constructor(public readonly value: string) {}

  static create(value: string): Venue {
    const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (normalized.length < 2 || normalized.length > 120) throw new InvalidVenueError();
    return new Venue(normalized);
  }

  get key(): string { return this.value.toLowerCase(); }   // para comparar
  equals(other: Venue): boolean { return other instanceof Venue && this.key === other.key; }
}
```

```ts
// src/catalog/domain/value-objects/ticket-price.ts (lo esencial)
/** RN-005: céntimos ENTEROS (en coma flotante 0,1 + 0,2 ≠ 0,3). */
static create(amountCents: number, currency: string): TicketPrice {
  const c = currency.trim().toUpperCase();
  if (!Number.isInteger(amountCents) || amountCents < 0 || amountCents > 10_000_000 || !['PEN','USD','EUR'].includes(c)) {
    throw new InvalidTicketPriceError();
  }
  return new TicketPrice(amountCents, c);
}
```

Escribe tú: `EventId`, `EventName` (3–120), `EventStart` (fecha ISO **con zona horaria**),
`Capacity` (1–100.000), `EventStatus` (SCHEDULED/CANCELLED). Cada error es una subclase de
`DomainException` (`catalog/domain/errors/event.errors.ts`).

> 💡 **¿Por qué exigir zona horaria?** `"2027-03-20T21:00:00"` sin `Z` se interpreta con
> la hora del servidor: el mismo dato daría horas distintas en tu PC y en producción.

```ts
// prueba: src/catalog/domain/value-objects/catalog-values.spec.ts
it('keeps the display casing but compares case-insensitively', () => {
  expect(Venue.create('  Estadio   Nacional ').value).toBe('Estadio Nacional');
  expect(Venue.create('Estadio Nacional').equals(Venue.create('ESTADIO NACIONAL'))).toBe(true);
});
```

**Punto de control**: `pnpm test` en verde · commit.

**Preguntas de repaso**
1. ¿Qué pasaría si el constructor de `Venue` fuera público?
2. ¿Por qué el precio se guarda en céntimos enteros?

---

## Fase 4 — El agregado Event

Un agregado **rico**: sin setters; cambia con métodos que expresan una **intención**.

```ts
// src/catalog/domain/entities/event.ts (lo esencial)
export class Event extends AggregateRoot {
  /** RN-003: solo se programa a futuro. Nace SCHEDULED, versión 0, y registra EventScheduled. */
  static schedule(props: ScheduleEventProps, now = new Date()): Event {
    if (!props.startsAt.isAfter(now)) throw new EventStartInPastError();
    const event = new Event(props.id, props.name, props.venue, props.startsAt, props.capacity,
                            props.price, EventStatus.scheduled(), now, now, 0);
    event.record(new EventScheduled(event.id.value, props.name.value, props.startsAt.value, props.capacity.value, now));
    return event;
  }

  /** RN-007: solo se cancela si está programado y no ha empezado. */
  cancel(now = new Date()): void {
    if (this._status.isCancelled()) throw new EventAlreadyCancelledError(this._id.value);
    if (this.hasStarted(now)) throw new EventAlreadyStartedError(this._id.value);
    this._status = EventStatus.cancelled();
    this._updatedAt = now;
    this.record(new EventCancelled(this._id.value, now));
  }

  /** Reconstruir desde la BD: VUELVE A VALIDAR todo (y la versión >= 1). */
  static fromPrimitives(p: EventPrimitives): Event { /* EventName.create(p.name), ... */ }
  toPrimitives(): EventPrimitives { /* objeto plano */ }
}
```
> 💡 **¿Por qué `fromPrimitives` revalida?** Si una fila está corrupta, no queremos un
> agregado inválido circulando. Un `return new Event(...)` sin validar sería un error.
> **Ojo**: al reconstruir NO se exige fecha futura (un evento pasado sigue siendo válido).

**Referencia**: `src/catalog/domain/entities/event.ts`, `event.spec.ts`, `src/catalog/domain/events/*`.

---

## Fase 5 — Puertos del Catálogo

```ts
// src/catalog/domain/ports/event.repository.ts
export const EVENT_REPOSITORY = Symbol('EVENT_REPOSITORY');
export interface EventRepository {
  save(event: Event): Promise<void>;
  findById(id: EventId): Promise<Event | null>;                       // null, NO lanza
  findByVenueAndStart(venue: Venue, startsAt: EventStart): Promise<Event | null>;
  search(criteria: { status?: EventStatus }): Promise<Event[]>;
}
```
> 💡 `findById` devuelve `null` porque decidir si "no existir" es un error de negocio le
> corresponde al caso de uso, no a la base de datos.

---

## Fase 6 — Adaptador en memoria

Implementa el puerto con un `Map` y haz que se comporte **igual que el real**: guarda
copias de primitivas, reconstruye con `fromPrimitives`, emula el índice único recinto+hora
y el control de versión.

**Referencia**: `src/catalog/infrastructure/persistence/in-memory/in-memory-event.repository.ts`
y el publicador `src/shared/infrastructure/events/in-memory-domain-event-publisher.ts`.

---

## Fase 7 — Casos de uso con CQRS (Catálogo)

```
src/catalog/application/
├── commands/schedule-event/   schedule-event.command.ts + .handler.ts
├── commands/cancel-event/     ...
├── queries/get-event/         get-event.query.ts + .handler.ts
├── queries/list-events/       ...
└── views/event.view.ts
```

El handler **orquesta** (no decide):
```ts
async execute(command: ScheduleEventCommand) {
  const name = EventName.create(command.name);                 // 1. validar con value objects
  const venue = Venue.create(command.venue);
  const startsAt = EventStart.create(command.startsAt);
  const capacity = Capacity.create(command.capacity);
  const price = TicketPrice.create(command.priceCents, command.currency);

  if (await this.events.findByVenueAndStart(venue, startsAt)) { // 2. comprobar (RN-006)
    throw new EventSlotTakenError(venue.value, startsAt.value);
  }
  const event = Event.schedule({ id: EventId.generate(), name, venue, startsAt, capacity, price }); // 3. dominio

  await this.events.save(event);                                    // 4. persistir
  await this.eventPublisher.publishAll(event.pullDomainEvents());   // 5. publicar DESPUÉS
  return { id: event.id.value };
}
```
> 💡 **Orden sagrado: guardar → publicar.** Si publicas antes y el guardado falla, otros
> contextos reaccionarían a algo que nunca ocurrió.

Prueba **sin Nest y sin base de datos**:
```ts
const handler = new ScheduleEventHandler(new InMemoryEventRepository(), new InMemoryDomainEventPublisher());
const { id } = await handler.execute(new ScheduleEventCommand('Rock', 'Estadio', FUTURE, 500, 4500, 'PEN'));
```

**Punto de control**: `pnpm test` · commit.

---

## Fase 8 — Dominio de la Venta

Aquí está lo más interesante del proyecto.

### 8.1 Modelo propio, no compartido
La venta **no** usa `EventId` ni `TicketPrice` del catálogo: tiene `EventReference`, `Money`
y `SaleableEvent` ("lo que la venta necesita saber de un evento": aforo, inicio, precio,
¿se puede vender?).

### 8.2 El cupo: el agregado que impide sobrevender (ADR-012)
```ts
// src/ticketing/domain/entities/ticket-allocation.ts (lo esencial)
sell(quantity: Quantity, now = new Date()): Money {
  if (!this._status.isOpen()) throw new SalesClosedError(this._eventId.value);              // RN-010
  if (this._startsAt.getTime() <= now.getTime()) throw new EventAlreadyStartedError(...);   // RN-010
  if (quantity.value > this.available) throw new NotEnoughTicketsError(quantity.value, this.available); // RN-009
  this._sold += quantity.value;
  this.record(new TicketsSold(this._eventId.value, quantity.value, this.available, now));
  if (this.available === 0) this.record(new EventSoldOut(this._eventId.value, now));
  return this._unitPrice.times(quantity.value);                                             // RN-015
}
```
> 💡 **¿Por qué un agregado aparte para el cupo?** Un agregado es la frontera de
> consistencia: "vendidas ≤ aforo" debe vivir dentro de **uno**. Si contaras entradas
> (`COUNT(*)`) antes de vender, dos compras simultáneas contarían lo mismo y venderían de más.

### 8.3 La entrada
`Ticket` guarda **solo el hash** de su código (`TicketCodeHash`), el titular, el precio
pagado y el estado `ISSUED → USED | REFUNDED`:
```ts
checkIn(now = new Date()): void {                       // RN-013
  if (this._status.isUsed()) throw new TicketAlreadyUsedError(this._id.value);
  if (this._status.isRefunded()) throw new TicketRefundedError(this._id.value);
  this._status = TicketStatus.used();
  this._usedAt = now;
  this.record(new TicketCheckedIn(this._id.value, this._eventId.value, now));
}
```

### 8.4 El código secreto
`TicketCode.generate()` crea `XXXX-XXXX-XXXX` con azar criptográfico y sin letras ambiguas
(0/O, 1/I/L). `toString()` y `toJSON()` devuelven `[REDACTED]` para que nunca acabe en un log.

**Referencia**: `src/ticketing/domain/**` y sus `.spec.ts`.

**Preguntas de repaso**
1. ¿Por qué la venta tiene su propio `Money` en lugar de usar `TicketPrice`?
2. ¿Por qué el cupo es un agregado distinto de la entrada?
3. ¿Por qué `Ticket` no guarda el código en claro?

---

## Fase 9 — Casos de uso de la Venta

| Tipo | Caso de uso | Qué orquesta |
|---|---|---|
| Command | `PurchaseTickets` | cupo (o abrirlo consultando el catálogo) → `sell` → guardar con reintentos → emitir entradas (solo hash) → releer cupo (¿cancelado?) → publicar |
| Command | `CheckInTicket` | hash del código → buscar → `checkIn` → guardar |
| Command | `CloseEventSales` | interno (lo dispara un evento): cerrar cupo + reembolsar no usadas |
| Query | `GetTicket`, `GetEventAvailability` | vistas sin código ni hash |

Puertos propios de la venta: `TicketAllocationRepository`, `TicketRepository`,
`EventCatalog` (para preguntar al catálogo) y `TicketCodeHasher`.

### Reintentos ante compras simultáneas
```ts
for (let attempt = 1; ; attempt++) {
  const allocation = (await this.allocations.findByEvent(eventId)) ?? (await this.openSales(eventId));
  const total = allocation.sell(quantity);
  try {
    await this.allocations.save(allocation);       // falla si otra compra lo cambió (versión)
    return { allocation, total };
  } catch (error) {
    if (!(error instanceof SalesConcurrentModificationError) || attempt >= PURCHASE_MAX_ATTEMPTS) throw error;
    await backoff(attempt);                        // espera aleatoria: no volver a chocar a la vez
  }
}
```

**Punto de control**: `pnpm test` (todas las reglas probadas **sin base de datos ni HTTP**) · commit.

> 🎉 Aquí ya tienes toda la lógica de negocio funcionando y probada. Esa es la gran ventaja
> de la arquitectura hexagonal.

---

## Fase 10 — Configuración validada

Todas las variables vienen del `.env`, se **validan al arrancar**, sin valores por defecto,
y **solo `src/config/` lee `process.env`**.

```ts
// src/config/env.validation.ts (resumen)
export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test']) NODE_ENV: string;
  @IsInt() @Min(1) @Max(65535) PORT: number;
  // ... DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
  @IsString() @MinLength(32) TICKET_CODE_SECRET: string;        // secreto del HMAC
  @ValidateIf((env) => env.NODE_ENV === 'test') @IsString() @IsNotEmpty() DB_NAME_TEST?: string;
}
```
Y **una sola** definición de conexión para la app y el CLI (`buildDataSourceOptions`) con
`synchronize: false` y `logging: false`.

**Preguntas de repaso**
1. ¿Qué pasa si arrancas sin `TICKET_CODE_SECRET`? ¿Por qué es mejor que un valor por defecto?
2. ¿Por qué app y CLI comparten la configuración?

---

## Fase 11 — Docker y migraciones

`docker-compose.yml` levanta PostgreSQL leyendo **el mismo `.env`**, solo en `127.0.0.1`.

Migraciones = SQL versionado con `up()` y `down()`:
```ts
await q.query(`
  CREATE TABLE "ticket_allocations" (
    "event_id" uuid NOT NULL, "capacity" integer NOT NULL, "sold" integer NOT NULL, ...
    CONSTRAINT "pk_ticket_allocations" PRIMARY KEY ("event_id"),
    CONSTRAINT "ck_ticket_allocations_sold" CHECK ("sold" >= 0 AND "sold" <= "capacity")   -- RN-009
  )`);
await q.query(`CREATE UNIQUE INDEX "uq_events_venue_starts_at" ON "events" (lower("venue"), "starts_at")`); // RN-006
```
> 💡 **¿Por qué restricciones en la base si el dominio ya valida?** Porque dos peticiones
> **simultáneas** pueden pasar ambas la validación del código. Solo la base garantiza la
> unicidad ante concurrencia; los `CHECK` son la última barrera.

**Punto de control**:
```bash
cp .env.example .env && docker compose up -d --wait
pnpm migration:run && pnpm migration:revert && pnpm migration:run
```

---

## Fase 12 — Persistencia real

### 12.1 La entidad ORM es OTRA clase
```ts
@Entity({ name: 'tickets' })
export class TicketOrmEntity {
  @PrimaryColumn({ type: 'uuid' }) id: string;
  @Column({ name: 'code_hash', type: 'varchar', length: 64 }) codeHash: string;   // nunca el código
  // ...
  @Column({ type: 'integer' }) version: number;
}
```
`@Entity`/`@Column` **nunca** van en el dominio (falta grave). El **mapper** traduce entre
`Ticket` y `TicketOrmEntity` usando `toPrimitives()`/`fromPrimitives()`.

### 12.2 Bloqueo optimista: lo que hace imposible sobrevender
```ts
async save(allocation: TicketAllocation): Promise<void> {
  const row = TicketAllocationMapper.toPersistence(allocation);
  if (allocation.version === 0) {
    await this.repository.insert({ ...row, version: 1 });                 // nuevo
  } else {
    const { eventId, version, ...changes } = row;
    const result = await this.repository.update(
      { eventId, version },                                               // WHERE ... AND version = ?
      { ...changes, version: version + 1 },
    );
    if (!result.affected) throw new SalesConcurrentModificationError(eventId); // otra compra ganó
  }
  allocation.markAsPersisted();
}
```
> 💡 **El experimento que debes conocer**: si quitas `version` del `WHERE`, la prueba e2e
> de 30 compradores para 5 plazas vende **16 entradas**. Con la condición, exactamente **5**.

### 12.3 HMAC del código
`HmacTicketCodeHasher` calcula `HMAC-SHA256(TICKET_CODE_SECRET, código)`. No usamos scrypt
(eso es para contraseñas con poca entropía): el código ya es aleatorio y la puerta necesita
un hash **determinista** para buscarlo. El secreto evita que alguien con una copia de la
base pueda probar códigos.

---

## Fase 13 — El borde HTTP

### DTOs (validación nivel 1: forma y tipos)
```ts
export class PurchaseTicketsDto {
  @IsUUID() eventId: string;
  @IsInt() quantity: number;
  @IsString() @IsNotEmpty() @MaxLength(200) holderName: string;
  @IsString() @IsNotEmpty() @MaxLength(320) holderEmail: string;
}
```
> 💡 **Dos niveles**: el DTO rechaza `quantity: "2"` (texto); el **dominio** rechaza
> `quantity: 11` (RN-008). Y como `forbidNonWhitelisted` está activo, el cliente **no puede
> mandar `priceCents`** para pagar menos.

### Controlador delgado
```ts
@Controller('tickets')
export class TicketsController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post()
  purchase(@Body() dto: PurchaseTicketsDto) {
    return this.commandBus.execute(new PurchaseTicketsCommand(dto.eventId, dto.quantity, dto.holderName, dto.holderEmail));
  }
}
```

### Filtro único de errores de dominio
```ts
switch (kind) {
  case 'VALIDATION': return HttpStatus.BAD_REQUEST;   // 400
  case 'NOT_FOUND':  return HttpStatus.NOT_FOUND;     // 404
  case 'CONFLICT':   return HttpStatus.CONFLICT;      // 409
  default: { const unreachable: never = kind; throw new Error(`Unmapped ${unreachable}`); }
}
```

### El módulo conecta puertos con adaptadores
```ts
providers: [
  PurchaseTicketsHandler, /* ... */
  { provide: TICKET_ALLOCATION_REPOSITORY, useClass: TypeOrmTicketAllocationRepository },
  { provide: EVENT_CATALOG, useClass: CatalogEventCatalog },
  { provide: TICKET_CODE_HASHER, inject: [ConfigService],
    useFactory: (config) => new HmacTicketCodeHasher(config.get('TICKET_CODE_SECRET')) },
]
```

**Punto de control**: `pnpm start:dev` y prueba con Thunder Client (Etapa 4 de `EMPIEZA-AQUI.md`).

---

## Fase 14 — Comunicación entre contextos

### Consulta (ACL)
```ts
// src/ticketing/infrastructure/adapters/catalog-event-catalog.adapter.ts
async findEvent(id: EventReference): Promise<SaleableEvent | null> {
  try {
    const event: EventView = await this.queryBus.execute(new GetEventQuery(id.value));
    return SaleableEvent.create({
      id, capacity: event.capacity, startsAt: new Date(event.startsAt),
      unitPrice: Money.create(event.price.amountCents, event.price.currency),
      onSale: event.status === 'SCHEDULED',
    });
  } catch (error) {
    if (error instanceof DomainException && error.code === 'EVENT_NOT_FOUND') return null;
    throw error;
  }
}
```

### Reacción a un evento de dominio
```ts
@EventsHandler(EventCancelled)
export class CloseSalesOnEventCancelledListener implements IEventHandler<EventCancelled> {
  constructor(private readonly commandBus: CommandBus) {}
  async handle(event: EventCancelled) {
    await this.commandBus.execute(new CloseEventSalesCommand(event.eventId));
  }
}
```
> 💡 El catálogo **no sabe** que la venta existe. Y si una compra coincide con la
> cancelación, la compra relee el cupo al final y reembolsa sus entradas (RN-014).

---

## Fase 15 — Pruebas e2e

`global-setup.ts` crea la base de pruebas, la vacía y aplica las **migraciones reales**;
`test-app.ts` arranca la app real escuchando en un puerto efímero.

La prueba estrella:
```ts
it('30 simultaneous buyers for 5 seats: exactly 5 tickets are sold, never more (RN-009)', async () => {
  const eventId = await scheduleEvent(app, { capacity: 5 });
  const responses = await Promise.all(
    Array.from({ length: 30 }, (_, i) => purchase(app, eventId, 1, `fan${i}@mail.com`)),
  );
  expect(responses.filter((r) => r.status === 201)).toHaveLength(5);
  // y en la base: 5 filas en tickets y sold = 5
});
```

**Punto de control**: `pnpm test:e2e`.

---

## Fase 16 — Prueba de arquitectura

Convierte la checklist de la rúbrica en una prueba que lee el código:
```ts
it('domain/ never imports frameworks', () => {
  const offenders = domainFiles.flatMap((file) =>
    importsOf(file).filter((spec) => /^(@nestjs\/|typeorm|class-validator)/.test(spec)));
  expect(offenders).toEqual([]);
});
```
> 💡 **Experimento**: añade `import { Injectable } from '@nestjs/common'` en `quantity.ts`,
> ejecuta `pnpm test` y mira cómo falla. Luego quítalo.

---

## Fase 17 — Documentación y autoevaluación

- `README.md`: instalación desde cero, comandos, endpoints, arquitectura.
- `docs/business-rules/`: RN-001…RN-015 → archivo que las implementa → prueba.
- `docs/decisions/`: ADRs (contexto → decisión → **porqué** → consecuencias → alternativas).
- `docs/technical-debt.md`: lo que no está resuelto, con honestidad.

```bash
grep -rn "@nestjs\|typeorm\|class-validator" src/*/domain/   # vacío
grep -rn "process.env" src | grep -v "^src/config/"          # vacío
pnpm test && pnpm test:e2e
```

---

## Fase 18 — Preguntas del evaluador

Practícalas **en voz alta**.

**1. ¿Qué es la arquitectura hexagonal y cómo la aplicaste?**
> El dominio está en el centro y no depende de nada técnico. Define puertos (como
> `TicketAllocationRepository`) y la infraestructura los implementa con adaptadores
> (TypeORM y en memoria). Los módulos de Nest eligen el adaptador. Una prueba automática
> verifica que las dependencias apunten hacia adentro.

**2. ¿Cómo garantizas que no se vendan más entradas que el aforo?**
> Con tres capas. El agregado `TicketAllocation` rechaza vender más de lo disponible. Su
> columna `version` hace bloqueo optimista: si dos compras leyeron el mismo cupo, solo una
> puede guardar y la otra relee y reintenta. Y la base tiene un `CHECK sold <= capacity`.
> Lo pruebo con 30 compras simultáneas para 5 plazas: se venden exactamente 5. Sin el
> bloqueo, la misma prueba vende 16.

**3. ¿Por qué el cupo es un agregado y no un conteo de entradas?**
> Porque un agregado es la frontera de consistencia. Contar entradas antes de vender falla
> con compras simultáneas: las dos cuentan lo mismo. El cupo concentra la regla en un solo objeto versionado.

**4. ¿Qué es un value object? Muéstrame uno.**
> Un valor sin identidad, inmutable, que se compara por valor. `Venue`: constructor
> privado, `create()` normaliza y valida, y `equals()` compara sin distinguir mayúsculas.

**5. ¿Por qué `fromPrimitives` vuelve a validar?**
> Porque los datos de la base podrían estar corruptos; no queremos agregados inválidos.

**6. ¿Cómo implementaste CQRS?**
> Commands para escribir y Queries para leer, cada uno con su handler y su carpeta. Los
> controladores solo hacen `commandBus.execute` o `queryBus.execute`.

**7. ¿Cómo se convierte un error de dominio en HTTP?**
> El dominio lanza `DomainException` con `code` y `kind`. Un único filtro traduce
> `VALIDATION→400`, `NOT_FOUND→404`, `CONFLICT→409`. El dominio no conoce HTTP.

**8. ¿Cuándo se publican los eventos de dominio?**
> Después de guardar. Si se publicaran antes y el guardado fallara, la venta reaccionaría
> a una cancelación que nunca ocurrió.

**9. ¿Cómo se comunican el Catálogo y la Venta sin acoplarse?**
> La venta tiene su propio puerto `EventCatalog`; un adaptador (ACL) consulta el catálogo
> por `GetEventQuery` y traduce a `SaleableEvent`. Y un oyente en `ticketing/infrastructure`
> reacciona a `EventCancelled`. Ningún dominio importa al otro.

**10. ¿Cómo proteges los códigos de entrada?**
> Son aleatorios (azar criptográfico), se muestran una sola vez y solo guardo su HMAC con
> un secreto del servidor. Ninguna vista, evento ni log los contiene.

**11. ¿Por qué HMAC y no bcrypt/scrypt como con las contraseñas?**
> Las contraseñas tienen poca entropía y necesitan un hash lento con sal. El código ya es
> aleatorio (~59 bits) y la puerta necesita buscarlo, así que el hash debe ser determinista.
> El secreto del HMAC impide que alguien con una copia de la base pruebe códigos.

**12. ¿Qué pasa si se cancela un evento mientras alguien compra?**
> La cancelación cierra el cupo antes de buscar entradas; la compra guarda sus entradas
> antes de releer el cupo. Así, al menos uno ve al otro: o la cancelación reembolsa esas
> entradas, o la compra ve el cupo cerrado y reembolsa las suyas. Hay una prueba que falla
> si quito esa compensación.

**13. ¿Por qué no `synchronize: true`?**
> Cambia el esquema automáticamente, sin historial y con riesgo de perder datos. Además mi
> índice único es funcional (`lower(venue)`), algo que solo puedo expresar en una migración.

**14. ¿Qué no está resuelto?**
> Autenticación, pasarela de pago, rate limiting, outbox para eventos y la compra sin
> transacción común. Está en `docs/technical-debt.md`.

---

## Plan de estudio sugerido

| Día | Fases | Meta |
|---|---|---|
| 1 | 0–2 | Ideas; proyecto y shared kernel |
| 2 | 3–4 | Value objects y agregado `Event` con pruebas |
| 3 | 5–7 | Puertos, adaptador en memoria y casos de uso del Catálogo |
| 4 | 8–9 | Cupo, entradas y casos de uso de la Venta |
| 5 | 10–12 | Configuración, Docker, migraciones, TypeORM y bloqueo optimista |
| 6 | 13–14 | HTTP y comunicación entre contextos |
| 7 | 15–18 | e2e, arquitectura, documentación y ensayo de preguntas |

**Truco final**: al terminar cada fase, cierra la guía y explica en voz alta qué hace cada
archivo que creaste. Donde te trabes, ahí tienes que repasar.
