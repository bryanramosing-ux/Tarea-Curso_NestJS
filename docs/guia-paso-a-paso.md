# Guía paso a paso: construir el proyecto desde cero (para aprenderlo)

Esta guía te lleva a **reconstruir tú mismo** el proyecto, fase por fase, entendiendo
el *porqué* de cada pieza. Al final podrás explicarlo y defenderlo ante el evaluador.

> **Cómo usarla**
> 1. Crea una carpeta **nueva y vacía** (tu versión). Ten abierto al lado este
>    repositorio (la versión de referencia).
> 2. En cada fase: lee la explicación → **escribe tú el código** (no copies y pegues
>    sin leer) → ejecuta el **punto de control** → compara con el archivo de referencia
>    indicado → haz un `git commit`.
> 3. Responde las **preguntas de repaso** de cada fase sin mirar. Si no puedes, relee.
>
> Tiempo estimado: 12–20 horas repartidas en varios días. No intentes hacerlo de golpe.
>
> Requisitos instalados: Node 20+, pnpm, Docker Desktop, Git y VS Code
> (si no los tienes, sigue la Parte 1 del README).

---

## Índice

0. [Las ideas antes del código](#fase-0--las-ideas-antes-del-código)
1. [Proyecto vacío y herramientas](#fase-1--proyecto-vacío-y-herramientas)
2. [Shared kernel: errores, eventos, agregados](#fase-2--shared-kernel)
3. [Value objects de Users](#fase-3--value-objects-de-users)
4. [La entidad User](#fase-4--la-entidad-user-agregado)
5. [Puertos de Users](#fase-5--puertos-de-users)
6. [Adaptadores en memoria y hasher](#fase-6--adaptadores-en-memoria-y-hasher)
7. [Casos de uso con CQRS (Users)](#fase-7--casos-de-uso-con-cqrs-users)
8. [Dominio de Tasks: el tablero Kanban](#fase-8--dominio-de-tasks)
9. [Casos de uso de Tasks](#fase-9--casos-de-uso-de-tasks)
10. [Configuración validada](#fase-10--configuración-validada)
11. [Docker y migraciones](#fase-11--docker-y-migraciones)
12. [Persistencia real: TypeORM + mappers](#fase-12--persistencia-real-typeorm--mappers)
13. [El borde HTTP: DTOs, controladores, filtros](#fase-13--el-borde-http)
14. [Comunicación entre contextos](#fase-14--comunicación-entre-contextos)
15. [Pruebas e2e](#fase-15--pruebas-e2e)
16. [Prueba de arquitectura](#fase-16--prueba-de-arquitectura)
17. [Documentación y autoevaluación](#fase-17--documentación-y-autoevaluación)
18. [Preguntas que te puede hacer el evaluador](#fase-18--preguntas-del-evaluador)

---

## Fase 0 — Las ideas antes del código

Lee esto con calma: es lo que más te van a preguntar.

### El problema que resolvemos
El NestJS "de tutorial" es `Controller → Service → Repository de TypeORM`. Las reglas de
negocio quedan desparramadas en servicios, las entidades son bolsas de datos con
decoradores de base de datos, y para probar una regla necesitas levantar Nest y una BD.

### Arquitectura hexagonal (puertos y adaptadores)
Imagina el **dominio** (las reglas del negocio) en el centro de un hexágono. Todo lo
técnico (HTTP, PostgreSQL, hashing) está **afuera** y se conecta por **puertos**:

- **Puerto**: una *interfaz* que el dominio define ("necesito guardar usuarios").
- **Adaptador**: una *implementación* concreta de ese puerto ("los guardo en
  PostgreSQL con TypeORM" o "los guardo en un `Map` en memoria para las pruebas").

**Regla de dependencias**: el código de afuera conoce al de adentro, nunca al revés.

```
infrastructure  ──►  application  ──►  domain
(HTTP, BD, Nest)     (casos de uso)    (reglas puras, TypeScript sin frameworks)
```

### DDD táctico (las piezas del dominio)
| Pieza | Qué es | Ejemplo en el proyecto |
|---|---|---|
| **Value object** | Un valor con reglas propias, sin identidad, inmutable, se compara por valor | `Email`, `TaskStatus` |
| **Entidad / Agregado** | Algo con identidad que cambia con el tiempo y protege sus reglas | `User`, `Task` |
| **Invariante** | Regla que *siempre* debe cumplirse | "Fuera de TODO, una tarea tiene responsable" |
| **Evento de dominio** | Un hecho que ya ocurrió (nombre en pasado) | `UserDeactivated` |
| **Bounded context** | Un "subsistema" con su propio lenguaje y modelo | Users y Tasks |

### CQRS
Separar **escribir** (Commands: `CreateUser`) de **leer** (Queries: `GetUser`).
El controlador no llama a servicios: pone un mensaje en un **bus** y un **handler** lo atiende.

### El dominio que modelamos
Una startup con un tablero Kanban:
- **Users**: miembros del equipo (alta, baja, consulta).
- **Tasks**: tarjetas que se asignan y se mueven `TODO → IN_PROGRESS → IN_REVIEW → DONE`.

**Preguntas de repaso**
1. ¿Por qué el dominio no puede importar NestJS ni TypeORM?
2. ¿Qué diferencia hay entre un puerto y un adaptador? Da un ejemplo de cada uno.
3. ¿Qué diferencia hay entre un value object y una entidad?

---

## Fase 1 — Proyecto vacío y herramientas

### 1.1 Crear la carpeta y Git
```bash
mkdir kanban-mi-version
cd kanban-mi-version
git init
pnpm init
```

### 1.2 Instalar dependencias (versiones fijas, iguales a la referencia)
```bash
pnpm add -E @nestjs/common@11.2.7 @nestjs/core@11.2.7 @nestjs/platform-express@11.2.7 @nestjs/cqrs@11.0.3 @nestjs/config@4.0.4 @nestjs/typeorm@11.0.3 typeorm@0.3.31 pg@8.16.3 class-validator@0.14.4 class-transformer@0.5.1 reflect-metadata@0.2.2 rxjs@7.8.2 dotenv@16.6.1 helmet@8.3.0

pnpm add -D -E @nestjs/cli@11.0.24 @nestjs/testing@11.2.7 typescript@5.9.3 ts-node@10.9.2 jest@29.7.0 ts-jest@29.4.14 @types/jest@29.5.14 @types/node@22.20.5 @types/express@5.0.6 @types/pg@8.23.1 supertest@7.1.4 @types/supertest@6.0.3
```

**Para qué sirve cada una** (apréndelo, te lo pueden preguntar):
- `@nestjs/cqrs`: `CommandBus`, `QueryBus`, `EventBus`.
- `typeorm` + `pg`: acceso a PostgreSQL. `@nestjs/typeorm` lo integra en Nest.
- `@nestjs/config`: lee y valida variables de entorno.
- `class-validator` / `class-transformer`: validan los DTOs en el borde HTTP.
- `helmet`: cabeceras de seguridad HTTP.
- `jest` + `ts-jest`: pruebas. `supertest`: hacer peticiones HTTP en las e2e.

### 1.3 Archivos de configuración
Copia de la referencia y **lee cada línea**:

| Archivo | Lo importante |
|---|---|
| `tsconfig.json` | `strict: true`; `experimentalDecorators` y `emitDecoratorMetadata` (Nest los necesita) |
| `tsconfig.build.json` | Excluye tests del build; `incremental: false` (evita un `dist/` incompleto) |
| `nest-cli.json` | Le dice a `nest build` qué tsconfig usar |
| `.gitignore` | **`.env` nunca se sube**; solo `.env.example` |
| `.gitattributes` | Fin de línea LF (evita problemas Windows ↔ Linux) |
| `.env.example` | Plantilla de variables, sin secretos reales |

En `package.json` copia las secciones `scripts` y `jest` de la referencia.

La configuración de Jest busca pruebas también en `test/architecture`, así que crea la
carpeta aunque esté vacía (si no, `pnpm test` falla con *"roots option was not found"*):
```bash
mkdir test
mkdir test/architecture
```

### Punto de control
```bash
pnpm exec tsc --version   # 5.9.3
git add -A && git commit -m "chore: scaffold project"
```

**Preguntas de repaso**
1. ¿Por qué `.env` está en `.gitignore` y `.env.example` no?
2. ¿Por qué fijamos versiones exactas?

---

## Fase 2 — Shared kernel

El *shared kernel* (`src/shared/domain`) contiene abstracciones **genéricas** que usan
ambos contextos. **Nunca** conceptos de negocio (nada de `Email` aquí).

### 2.1 La excepción de dominio
El dominio necesita decir "esto es inválido / no existe / choca con el estado actual"
**sin saber nada de HTTP**.

```ts
// src/shared/domain/domain-exception.ts
export const DomainErrorKind = {
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
} as const;
export type DomainErrorKind = (typeof DomainErrorKind)[keyof typeof DomainErrorKind];

export abstract class DomainException extends Error {
  protected constructor(
    public readonly code: string,        // estable: 'USER_NOT_FOUND'
    public readonly kind: DomainErrorKind,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
```
> 💡 `code` es un contrato con el cliente (no cambia). `kind` es lo que más tarde
> un filtro traducirá a 400/404/409.

### 2.2 Eventos y raíz de agregado
```ts
// src/shared/domain/domain-event.ts
export interface DomainEvent {
  readonly eventName: string;
  readonly occurredOn: Date;
}
```

La raíz de agregado **acumula eventos** y lleva una **versión** (para el bloqueo
optimista, que entenderás en la fase 12):

```ts
// src/shared/domain/aggregate-root.ts (resumen)
export abstract class AggregateRoot {
  private domainEvents: DomainEvent[] = [];
  private _version: number;

  protected constructor(version: number) { /* valida entero >= 0 */ this._version = version; }

  get version(): number { return this._version; }
  markAsPersisted(): void { this._version += 1; }        // lo llama el repositorio al guardar

  protected record(event: DomainEvent): void { this.domainEvents.push(event); }
  pullDomainEvents(): DomainEvent[] {                    // los saca y vacía la lista
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
```

### 2.3 El puerto para publicar eventos
```ts
// src/shared/domain/ports/domain-event-publisher.port.ts
export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');
export interface DomainEventPublisher {
  publishAll(events: DomainEvent[]): Promise<void>;
}
```
> 💡 **¿Por qué un `Symbol`?** Las interfaces de TypeScript desaparecen al compilar.
> Nest necesita un *valor* real para saber qué inyectar: el `Symbol` es ese valor.

Copia también `src/shared/domain/uuid.ts`.

**Referencia**: `src/shared/domain/*`

### Punto de control
```bash
pnpm exec tsc --noEmit
git commit -am "feat: shared kernel"
```

**Preguntas de repaso**
1. ¿Por qué `DomainException` no usa `HttpStatus`?
2. ¿Qué hace `pullDomainEvents()` y por qué vacía la lista?

---

## Fase 3 — Value objects de Users

Un value object **no puede existir en estado inválido**. Para garantizarlo:
1. **Constructor privado** (nadie puede hacer `new Email('basura')`).
2. **Factory estática** `create()` que **normaliza** y **valida**.
3. `equals()` para comparar por valor (nunca `===` entre objetos).

```ts
// src/users/domain/value-objects/email.ts
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_LENGTH = 254;

/** RN-001: email válido, sin espacios exteriores y en minúsculas. */
export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Email {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized.length === 0 || normalized.length > MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError();
    }
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return other instanceof Email && this.value === other.value;
  }
}
```

Cada error es una subclase de `DomainException` con su código:

```ts
// src/users/domain/errors/user.errors.ts (uno de ellos)
export class InvalidEmailError extends DomainException {
  constructor() {
    super('USER_INVALID_EMAIL', DomainErrorKind.VALIDATION, 'Email must be a valid address of at most 254 characters');
  }
}
```

Ahora escribe tú los demás siguiendo el mismo patrón:

| Value object | Regla |
|---|---|
| `UserId` | UUID válido; `generate()` crea uno nuevo |
| `UserName` | 2–80 caracteres, espacios colapsados (RN-003) |
| `PlainPassword` | 8–72 caracteres, letra y dígito (RN-004). `toString()` y `toJSON()` devuelven `[REDACTED]` para que nunca salga en un log |
| `PasswordHash` | No vacío; también `[REDACTED]` |
| `UserStatus` | `ACTIVE` o `INACTIVE` |

> 💡 **Ojo con la seguridad**: el mensaje de `WeakPasswordError` **no** incluye la contraseña.

### Tu primera prueba
```ts
// src/users/domain/value-objects/email.spec.ts
describe('Email (RN-001)', () => {
  it('normalizes surrounding spaces and casing', () => {
    expect(Email.create('  Ana@Startup.IO ').value).toBe('ana@startup.io');
  });
  it.each(['', 'ana', 'ana@', 'ana perez@startup.io'])('rejects %p', (value) => {
    expect(() => Email.create(value)).toThrow(InvalidEmailError);
  });
  it('compares by value', () => {
    expect(Email.create('ANA@x.io').equals(Email.create('ana@x.io'))).toBe(true);
  });
});
```

**Referencia**: `src/users/domain/value-objects/*` y sus `.spec.ts`.

### Punto de control
```bash
pnpm test          # tus pruebas en verde, sin Nest ni base de datos
git commit -am "feat(users): value objects"
```

**Preguntas de repaso**
1. ¿Qué pasaría si el constructor de `Email` fuera público?
2. ¿Por qué `Email.create(' A@B.io ')` y `Email.create('a@b.io')` son "iguales"?
3. ¿Por qué `PlainPassword` sobrescribe `toJSON()`?

---

## Fase 4 — La entidad User (agregado)

Una entidad **rica**: no tiene setters; cambia solo con métodos que expresan una
**intención de negocio** y que protegen las reglas.

```ts
// src/users/domain/entities/user.ts (lo esencial)
export class User extends AggregateRoot {
  private constructor(
    private readonly _id: UserId,
    private _name: UserName,
    private readonly _email: Email,
    private readonly _passwordHash: PasswordHash,
    private _status: UserStatus,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    version: number,
  ) {
    super(version);
  }

  /** Alta: nace ACTIVO, versión 0 (nunca guardado) y registra UserRegistered. */
  static register(props: RegisterUserProps, now = new Date()): User {
    const user = new User(props.id, props.name, props.email, props.passwordHash, UserStatus.active(), now, now, 0);
    user.record(new UserRegistered(user._id.value, user._email.value, user._name.value, now));
    return user;
  }

  /** RN-005: solo un usuario activo puede desactivarse. */
  deactivate(now = new Date()): void {
    if (!this._status.isActive()) throw new UserAlreadyInactiveError(this._id.value);
    this._status = UserStatus.inactive();
    this._updatedAt = now;
    this.record(new UserDeactivated(this._id.value, now));
  }

  /** Reconstruir desde la BD: VUELVE A VALIDAR todo con los value objects. */
  static fromPrimitives(p: UserPrimitives): User {
    return new User(
      UserId.create(p.id), UserName.create(p.name), Email.create(p.email),
      PasswordHash.create(p.passwordHash), UserStatus.create(p.status),
      p.createdAt, p.updatedAt, AggregateRoot.persistedVersion(p.version),
    );
  }

  toPrimitives(): UserPrimitives { /* devuelve un objeto plano con todos los campos */ }
}
```

Los eventos son **clases planas** con nombre en **pasado**:

```ts
// src/users/domain/events/user-deactivated.event.ts
export class UserDeactivated implements DomainEvent {
  readonly eventName = 'users.user_deactivated';
  constructor(public readonly userId: string, public readonly occurredOn: Date) {}
}
```

> 💡 **¿Por qué `fromPrimitives` revalida?** Si alguien corrompe una fila en la base
> (por ejemplo, un email inválido), no queremos un `User` inválido circulando por el
> sistema. Un simple `return new User(...)` sin validar sería un error.

> 💡 **¿Por qué `now` es un parámetro?** Para que las pruebas puedan fijar la fecha.

**Referencia**: `src/users/domain/entities/user.ts`, `user.spec.ts`, `src/users/domain/events/*`.

### Punto de control
Escribe pruebas para: registrar (emite `UserRegistered` sin hash), desactivar,
desactivar dos veces (error CONFLICT) y `fromPrimitives` con datos corruptos.
```bash
pnpm test
git commit -am "feat(users): User aggregate"
```

**Preguntas de repaso**
1. ¿Dónde vive la regla "no se puede desactivar dos veces"? ¿Por qué ahí y no en el controlador?
2. ¿Por qué el evento `UserRegistered` no lleva el hash?

---

## Fase 5 — Puertos de Users

El dominio declara **lo que necesita**, no **cómo** se hace:

```ts
// src/users/domain/ports/user.repository.ts
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;   // null si no existe: NO lanza error
  findByEmail(email: Email): Promise<User | null>;
}
```

```ts
// src/users/domain/ports/password-hasher.port.ts
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export interface PasswordHasher {
  hash(password: PlainPassword): Promise<PasswordHash>;
  verify(password: PlainPassword, hash: PasswordHash): Promise<boolean>;
}
```

> 💡 **¿Por qué `findById` devuelve `null` y no lanza "no encontrado"?** Porque
> decidir si "no existir" es un error de negocio le corresponde al caso de uso, no a
> la base de datos. El adaptador solo traduce datos.

**Preguntas de repaso**
1. ¿En qué carpeta van los puertos y por qué?
2. ¿Quién decide qué implementación concreta se usa para `USER_REPOSITORY`?

---

## Fase 6 — Adaptadores en memoria y hasher

### 6.1 Repositorio en memoria
Implementa el puerto con un `Map`. Debe comportarse **igual que el real**:
- guarda **copias** de las primitivas (no la instancia);
- devuelve `User.fromPrimitives(...)` (como haría con una fila de la BD);
- emula el email único y el control de versión (fase 12).

**Referencia**: `src/users/infrastructure/persistence/in-memory/in-memory-user.repository.ts`

### 6.2 Hasher con scrypt
`crypto.scrypt` viene con Node (sin dependencias nativas). Sal aleatoria de 16 bytes,
formato `scrypt$N$r$p$sal$hash`, y comparación con `timingSafeEqual`.

**Referencia**: `src/users/infrastructure/security/scrypt-password-hasher.ts`

### 6.3 Publicador de eventos en memoria
```ts
// src/shared/infrastructure/events/in-memory-domain-event-publisher.ts
export class InMemoryDomainEventPublisher implements DomainEventPublisher {
  readonly published: DomainEvent[] = [];
  async publishAll(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }
}
```

> 💡 Todo esto vive en `infrastructure/`: son **adaptadores**, aunque no usen base de datos.

**Preguntas de repaso**
1. ¿Por qué el repositorio en memoria guarda copias y no el objeto?
2. ¿Por qué scrypt y no SHA-256?

---

## Fase 7 — Casos de uso con CQRS (Users)

Cada caso de uso tiene **su propia carpeta** con el mensaje y su handler:

```
src/users/application/
├── commands/create-user/      create-user.command.ts + create-user.handler.ts
├── commands/deactivate-user/  ...
├── queries/get-user/          get-user.query.ts + get-user.handler.ts
└── views/user.view.ts         lo que se devuelve al leer (SIN hash)
```

### 7.1 El comando
```ts
export class CreateUserCommand extends Command<{ id: string }> {
  constructor(public readonly name: string, public readonly email: string, public readonly password: string) {
    super();
  }
}
```

### 7.2 El handler: solo **orquesta**
```ts
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CreateUserCommand) {
    const name = UserName.create(command.name);          // 1. validar con value objects
    const email = Email.create(command.email);
    const password = PlainPassword.create(command.password);

    if (await this.users.findByEmail(email)) {           // 2. cargar / comprobar
      throw new UserEmailAlreadyInUseError(email.value);
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const user = User.register({ id: UserId.generate(), name, email, passwordHash }); // 3. delegar al dominio

    await this.users.save(user);                                  // 4. persistir
    await this.eventPublisher.publishAll(user.pullDomainEvents()); // 5. publicar DESPUÉS

    return { id: user.id.value };
  }
}
```

> 💡 **Orden sagrado: guardar → publicar.** Si publicas antes y el guardado falla,
> otros contextos reaccionarían a algo que nunca ocurrió.

### 7.3 La vista de lectura
```ts
export function toUserView(user: User): UserView {
  return { id: user.id.value, name: user.name.value, email: user.email.value,
           status: user.status.value, createdAt: ..., updatedAt: ... };   // ¡sin hash!
}
```

### 7.4 Probar el handler SIN Nest y SIN base de datos
```ts
const users = new InMemoryUserRepository();
const events = new InMemoryDomainEventPublisher();
const handler = new CreateUserHandler(users, new FakePasswordHasher(), events); // ¡con new!

const { id } = await handler.execute(new CreateUserCommand('Ana', 'ana@x.io', 'secret123'));
expect(events.published[0]).toBeInstanceOf(UserRegistered);
```

**Referencia**: `src/users/application/**` y sus `.spec.ts` (mira cómo se comprueba el orden guardar → publicar con `jest.spyOn`).

### Punto de control
```bash
pnpm test
git commit -am "feat(users): CQRS use cases"
```

**Preguntas de repaso**
1. ¿Qué hace el handler y qué **no** debe hacer?
2. ¿Cómo demuestra la prueba que la capa de aplicación solo depende de puertos?
3. ¿Por qué `UserView` se arma campo a campo en vez de usar `toPrimitives()`?

---

## Fase 8 — Dominio de Tasks

Repite el patrón de Users. Lo interesante aquí son las **reglas del tablero**.

### 8.1 `TaskStatus`: el flujo Kanban vive en el value object (RN-009)
```ts
const ALLOWED_TRANSITIONS: Record<TaskStatusValue, readonly TaskStatusValue[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['TODO', 'IN_REVIEW'],
  IN_REVIEW: ['IN_PROGRESS', 'DONE'],
  DONE: [],                                   // estado final
};

canTransitionTo(next: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[this.value].includes(next.value);
}
requiresAssignee(): boolean {                 // RN-010
  return this.value !== 'TODO';
}
```

### 8.2 `Task`: la entidad protege las invariantes
```ts
changeStatus(next: TaskStatus, now = new Date()): void {
  this.assertNotDone();                                         // RN-012
  if (!this._status.canTransitionTo(next)) {
    throw new InvalidStatusTransitionError(this._status.value, next.value); // RN-009
  }
  if (next.requiresAssignee() && this._assigneeId === null) {
    throw new TaskRequiresAssigneeError(next.value);            // RN-010
  }
  const previous = this._status;
  this._status = next;
  this._updatedAt = now;
  this.record(new TaskStatusChanged(this._id.value, previous.value, next.value, now));
}
```
Escribe también `create()` (RN-008), `assignTo(member)` (RN-011, RN-012) y
`releaseAssignee()` (RN-013: sin responsable y de vuelta a TODO).

### 8.3 ¡No compartir modelos entre contextos!
Tasks **no** usa `UserId`. Crea su propio `AssigneeId` y un `TeamMember` (id + ¿activo?).
Para Tasks, un miembro solo es "alguien que puede o no recibir trabajo".

**Referencia**: `src/tasks/domain/**` y sus `.spec.ts` (fíjate en la matriz de transiciones de `task-status.spec.ts`).

**Preguntas de repaso**
1. ¿Por qué la tabla de transiciones está en `TaskStatus` y no en el controlador?
2. ¿Por qué Tasks tiene `AssigneeId` en vez de importar `UserId`?
3. ¿Qué pasa con una tarea `IN_PROGRESS` cuando se libera su responsable, y por qué?

---

## Fase 9 — Casos de uso de Tasks

| Tipo | Caso de uso | Qué orquesta |
|---|---|---|
| Command | `CreateTask` | crea en TODO |
| Command | `AssignTask` | carga tarea + miembro (por el puerto `TeamMemberDirectory`) → `task.assignTo()` |
| Command | `ChangeTaskStatus` | carga → `task.changeStatus()` |
| Command | `ReleaseMemberTasks` | interno, lo dispara un evento (fase 14) |
| Query | `GetTask`, `ListTasks` | leen y devuelven `TaskView` |

El puerto **propio** de Tasks para preguntar por miembros:
```ts
// src/tasks/domain/ports/team-member-directory.port.ts
export const TEAM_MEMBER_DIRECTORY = Symbol('TEAM_MEMBER_DIRECTORY');
export interface TeamMemberDirectory {
  findById(id: AssigneeId): Promise<TeamMember | null>;
}
```
Para las pruebas usa `InMemoryTeamMemberDirectory`.

**Referencia**: `src/tasks/application/**`.

### Punto de control
```bash
pnpm test
git commit -am "feat(tasks): domain and use cases"
```
> 🎉 En este punto tienes **toda la lógica de negocio funcionando y probada sin
> base de datos ni HTTP**. Esa es la gran ventaja de la arquitectura hexagonal.

---

## Fase 10 — Configuración validada

Reglas: todas las variables vienen del `.env`, se **validan al arrancar**, no hay
valores por defecto peligrosos y **solo `src/config/` lee `process.env`**.

```ts
// src/config/env.validation.ts (resumen)
export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test']) NODE_ENV: string;
  @IsInt() @Min(1) @Max(65535) PORT: number;
  @IsString() @IsNotEmpty() DB_HOST: string;
  // ... DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
  @ValidateIf((env) => env.NODE_ENV === 'test') @IsString() @IsNotEmpty() DB_NAME_TEST?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env);
  if (errors.length > 0) throw new Error('Invalid environment configuration ...'); // nombra la variable, NUNCA su valor
  return env;
}
```

Y **una sola** definición de la conexión para la app y para el CLI de migraciones:
```ts
// src/config/database.config.ts
export function buildDataSourceOptions(s: DatabaseSettings): DataSourceOptions {
  return {
    type: 'postgres', host: s.host, port: s.port, username: s.username,
    password: s.password, database: s.database,
    entities: ORM_ENTITIES, migrations: MIGRATIONS,
    synchronize: false,   // ¡SIEMPRE! El esquema lo crean las migraciones
    logging: false,       // para que los parámetros (hashes) no lleguen a los logs
  };
}
```

**Referencia**: `src/config/*` (incluido `typeorm.data-source.ts`, el que usa el CLI).

**Preguntas de repaso**
1. ¿Qué pasa si arrancas sin `.env`? ¿Por qué es mejor que tener un valor por defecto?
2. ¿Por qué app y CLI comparten `buildDataSourceOptions`?
3. ¿Por qué `synchronize: false`?

---

## Fase 11 — Docker y migraciones

### 11.1 `docker-compose.yml`
Levanta PostgreSQL leyendo **el mismo `.env`**. Fíjate en:
- `${DB_USER:?...}`: si falta la variable, Compose falla en vez de inventarla.
- `"127.0.0.1:${DB_PORT}:5432"`: la base **solo** es accesible desde tu equipo.
- `healthcheck`: permite `docker compose up -d --wait`.

### 11.2 Migraciones
Son SQL versionado con `up()` (aplicar) y `down()` (deshacer):
```ts
export class CreateUsersTable1759363200000 implements MigrationInterface {
  name = 'CreateUsersTable1759363200000';
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL,
        "email" varchar(254) NOT NULL,
        ...
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email")      -- RN-002 garantizado por la BD
      )`);
  }
  async down(q: QueryRunner) {
    await q.query(`DROP TABLE "users"`);
  }
}
```
Regístralas en `src/database/migrations/index.ts` (lista explícita).

> 💡 **¿Por qué `UNIQUE` si el handler ya comprueba el email?** Porque dos registros
> **simultáneos** pueden pasar ambos el `findByEmail`. Solo la base de datos puede
> garantizar la unicidad ante la concurrencia.

**Referencia**: `docker-compose.yml`, `src/database/migrations/*` (incluye la FK de
`tasks.assignee_id`, los `CHECK` y la columna `version`).

### Punto de control
```bash
cp .env.example .env
docker compose up -d --wait
pnpm migration:run
pnpm migration:revert && pnpm migration:run    # comprueba que down() funciona
git commit -am "feat: docker and migrations"
```

---

## Fase 12 — Persistencia real: TypeORM + mappers

### 12.1 La entidad ORM es OTRA clase
Los decoradores `@Entity`/`@Column` **nunca** van en el dominio (falta grave de la rúbrica):

```ts
// src/users/infrastructure/persistence/typeorm/user.orm-entity.ts
@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryColumn({ type: 'uuid' }) id: string;
  @Column({ type: 'varchar', length: 254 }) email: string;
  @Column({ name: 'password_hash', type: 'varchar', length: 255 }) passwordHash: string;
  // ...
  @Column({ type: 'integer' }) version: number;
}
```

### 12.2 El mapper traduce entre los dos mundos
```ts
export class UserMapper {
  static toDomain(row: UserOrmEntity): User { return User.fromPrimitives({ ...campos de row }); }
  static toPersistence(user: User): UserOrmEntity { /* copia user.toPrimitives() a un UserOrmEntity */ }
}
```

### 12.3 El repositorio real con **bloqueo optimista**
Problema: dos peticiones leen la misma tarea y la guardan después; la segunda borraría
en silencio el cambio de la primera ("actualización perdida"). Solución: una columna
`version` y guardar **solo si nadie la cambió desde que la leíste**:

```ts
async save(task: Task): Promise<void> {
  const row = TaskMapper.toPersistence(task);
  if (task.version === 0) {
    await this.repository.insert({ ...row, version: 1 });           // nuevo
  } else {
    const { id, version, ...changes } = row;
    const result = await this.repository.update(
      { id, version },                                              // WHERE id = ? AND version = ?
      { ...changes, version: version + 1 },
    );
    if (!result.affected) throw new TaskConcurrentModificationError(id);   // 409
  }
  task.markAsPersisted();
}
```
El repositorio de usuarios además traduce el error `23505` de PostgreSQL (violación de
`uq_users_email`) a `UserEmailAlreadyInUseError`: eso es **traducir**, no duplicar reglas.

**Referencia**: `src/*/infrastructure/persistence/typeorm/*` y ADR-011.

**Preguntas de repaso**
1. ¿Por qué no poner `@Entity` en `User`?
2. ¿Qué es una "actualización perdida" y cómo la evita la columna `version`?
3. ¿Qué responde la API cuando ocurre un conflicto de versión?

---

## Fase 13 — El borde HTTP

### 13.1 DTOs: validación nivel 1 (forma y tipos)
```ts
export class CreateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsString() @IsNotEmpty() @MaxLength(320) email: string;
  @IsString() @IsNotEmpty() @MaxLength(200) password: string;
}
```
> 💡 **Dos niveles de validación**: el DTO comprueba que sea un string de tamaño
> razonable; el **dominio** decide si es un email válido o una contraseña fuerte.
> Prueba: `"password":"abcdefgh"` pasa el DTO pero el dominio responde `USER_WEAK_PASSWORD`.

`ValidationPipe` con `whitelist: true` y `forbidNonWhitelisted: true` → rechaza campos
que no estén en el DTO (por ejemplo `"rol":"admin"`).

### 13.2 Controlador delgado: solo buses
```ts
@Controller('users')
export class UsersController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.commandBus.execute(new CreateUserCommand(dto.name, dto.email, dto.password));
  }

  @Get(':id')
  findOne(@Param('id', parseIdPipe()) id: string) {
    return this.queryBus.execute(new GetUserQuery(id));
  }
}
```
Nada de repositorios, nada de reglas, nada de `if` de negocio.

### 13.3 El filtro que traduce errores de dominio a HTTP (único)
```ts
export function httpStatusFor(kind: DomainErrorKind): HttpStatus {
  switch (kind) {
    case 'VALIDATION': return HttpStatus.BAD_REQUEST;   // 400
    case 'NOT_FOUND':  return HttpStatus.NOT_FOUND;     // 404
    case 'CONFLICT':   return HttpStatus.CONFLICT;      // 409
    default: { const unreachable: never = kind; throw new Error(`Unmapped ${unreachable}`); }
  }
}
```
> 💡 El `never` hace que TypeScript **no compile** si algún día añades un `kind` sin mapearlo.

### 13.4 El módulo: aquí se conectan puertos con adaptadores
```ts
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UsersController],
  providers: [
    CreateUserHandler, DeactivateUserHandler, GetUserHandler,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },   // ← aquí se elige el adaptador
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
  ],
})
export class UsersModule {}
```

### 13.5 Arranque
`src/app.setup.ts` aplica `helmet`, el `ValidationPipe` y los filtros (se reutiliza en
las e2e). `src/main.ts` crea la app y escucha en `PORT`.

**Referencia**: `src/*/infrastructure/http/*`, `src/shared/infrastructure/http/*`,
`src/app.module.ts`, `src/app.setup.ts`, `src/main.ts`.

### Punto de control
```bash
pnpm start:dev
# Prueba con Thunder Client: POST /users, GET /users/:id, errores 400/404/409
git commit -am "feat: HTTP adapters"
```

---

## Fase 14 — Comunicación entre contextos

Dos mecanismos, ambos en `tasks/infrastructure` (nunca en el dominio):

### 14.1 Consulta: anti-corruption layer (ACL)
El adaptador del puerto `TeamMemberDirectory` pregunta a Users **por su API pública**
(`GetUserQuery` por el `QueryBus`) y traduce la respuesta al modelo de Tasks:
```ts
async findById(id: AssigneeId): Promise<TeamMember | null> {
  try {
    const user: UserView = await this.queryBus.execute(new GetUserQuery(id.value));
    return TeamMember.create({ id, active: user.status === 'ACTIVE' });
  } catch (error) {
    if (error instanceof DomainException && error.code === 'USER_NOT_FOUND') return null;
    throw error;
  }
}
```

### 14.2 Reacción: un evento
Cuando Users publica `UserDeactivated`, Tasks libera las tareas de esa persona:
```ts
@EventsHandler(UserDeactivated)
export class ReleaseTasksOnUserDeactivatedListener implements IEventHandler<UserDeactivated> {
  constructor(private readonly commandBus: CommandBus) {}
  async handle(event: UserDeactivated) {
    await this.commandBus.execute(new ReleaseMemberTasksCommand(event.userId));
  }
}
```
> 💡 Users **no sabe** que Tasks existe. Si mañana se añade otro contexto que reaccione
> al mismo evento, Users no cambia.

**Referencia**: `src/tasks/infrastructure/adapters/*`, `src/tasks/infrastructure/event-handlers/*`.

**Preguntas de repaso**
1. ¿Por qué Tasks no consulta directamente la tabla `users`?
2. ¿Por qué el listener vive en `infrastructure/` y no en `domain/`?

---

## Fase 15 — Pruebas e2e

Prueban la aplicación **completa** contra **PostgreSQL real** con las **migraciones reales**.

- `test/e2e/support/global-setup.ts`: fuerza `NODE_ENV=test`, crea `DB_NAME_TEST` si
  no existe, la vacía y ejecuta las migraciones desde cero.
- `test/e2e/support/test-app.ts`: arranca `AppModule` con el mismo `configureApp()` que `main.ts`.

```ts
it('409: the email is unique regardless of casing (RN-002)', async () => {
  await http().post('/users').send({ name: 'Ana', email: 'ana@x.io', password: 'secret123' }).expect(201);
  const response = await http().post('/users').send({ name: 'Otra', email: 'ANA@X.IO', password: 'secret456' }).expect(409);
  expect(response.body.code).toBe('USER_EMAIL_ALREADY_IN_USE');
});
```
Cubre siempre: éxito (200/201/204), 400, 404 y 409.

**Referencia**: `test/e2e/*`, `test/jest-e2e.json`.

### Punto de control
```bash
pnpm test:e2e
git commit -am "test: e2e"
```

---

## Fase 16 — Prueba de arquitectura

Convierte la checklist de la rúbrica en una prueba automática: lee los archivos y
falla si, por ejemplo, un archivo de `domain/` importa `@nestjs`:

```ts
it('domain/ never imports frameworks', () => {
  const offenders = domainFiles.flatMap((file) =>
    importsOf(file)
      .filter((spec) => /^(@nestjs\/|typeorm|class-validator)/.test(spec))
      .map((spec) => `${file} -> ${spec}`),
  );
  expect(offenders).toEqual([]);
});
```
> 💡 **Haz el experimento**: añade `import { Injectable } from '@nestjs/common'` en
> `email.ts`, ejecuta `pnpm test` y mira cómo falla. Luego quítalo.

**Referencia**: `test/architecture/architecture.spec.ts`.

---

## Fase 17 — Documentación y autoevaluación

- `README.md`: instalación desde cero, comandos, endpoints, arquitectura.
- `docs/business-rules/`: reglas con IDs estables (RN-001…) → archivo que las implementa → prueba.
- `docs/decisions/`: ADRs (contexto → decisión → **porqué** → consecuencias → alternativas).
- `docs/technical-debt.md`: lo que **no** está resuelto, con honestidad.

Antes de entregar, comprueba (lo hace la prueba de arquitectura, pero apréndetelo):
```bash
grep -rn "@nestjs\|typeorm\|class-validator" src/*/domain/   # debe estar vacío
grep -rn "process.env" src | grep -v "^src/config/"          # debe estar vacío
grep -rn "synchronize" src                                   # solo false
pnpm test && pnpm test:e2e
```

---

## Fase 18 — Preguntas del evaluador

Practica responderlas **en voz alta**.

**1. ¿Qué es la arquitectura hexagonal y cómo la aplicaste?**
> El dominio está en el centro y no depende de nada técnico. Define puertos (interfaces
> como `UserRepository`) en `domain/ports`, y la infraestructura los implementa con
> adaptadores (`TypeOrmUserRepository`, `InMemoryUserRepository`). Los módulos de Nest
> deciden qué adaptador usar. Las dependencias apuntan hacia dentro y lo verifica una
> prueba automática.

**2. ¿Por qué hay dos repositorios para el mismo puerto?**
> El de memoria permite probar los casos de uso sin base de datos y demuestra que el
> puerto es intercambiable. El de TypeORM es el que usa la app real.

**3. ¿Dónde están las reglas de negocio? Muéstrame una.**
> En el dominio. Ejemplo: `Task.changeStatus` rechaza saltar columnas (RN-009) y mover
> una tarea sin responsable fuera de TODO (RN-010). El controlador no tiene ni un `if` de negocio.

**4. ¿Qué es un value object? ¿Cómo garantizas que no sea inválido?**
> Un valor sin identidad que se compara por valor. Constructor privado + factory
> `create()` que normaliza y valida; si algo falla lanza un error de dominio. Por eso no
> puede existir un `Email` inválido.

**5. ¿Por qué `fromPrimitives` vuelve a validar?**
> Porque los datos de la base podrían estar corruptos; no queremos agregados inválidos
> circulando. Además se valida la versión (≥ 1) y las invariantes.

**6. ¿Cómo implementaste CQRS?**
> Commands para escribir y Queries para leer, cada uno con su handler y su carpeta. Los
> controladores solo hacen `commandBus.execute` o `queryBus.execute`.

**7. ¿Cómo se convierte un error de dominio en una respuesta HTTP?**
> El dominio lanza `DomainException` con `code` y `kind`. Un único filtro,
> `DomainExceptionFilter`, traduce `VALIDATION→400`, `NOT_FOUND→404`, `CONFLICT→409`.
> El dominio no conoce HTTP.

**8. ¿Cuándo se publican los eventos y por qué?**
> Después de guardar. Si se publicaran antes y el guardado fallara, otros contextos
> reaccionarían a un hecho que no ocurrió.

**9. ¿Cómo se comunican Users y Tasks sin acoplarse?**
> Tasks tiene su propio puerto `TeamMemberDirectory`; un adaptador (ACL) consulta Users
> por `GetUserQuery` y traduce a `TeamMember`. Y un listener en `tasks/infrastructure`
> reacciona al evento `UserDeactivated`. Ningún dominio importa al otro.

**10. ¿Cómo proteges las contraseñas?**
> Política en el dominio, hash scrypt con sal, solo se guarda el hash, las vistas se
> construyen sin él, `toJSON()` devuelve `[REDACTED]` y TypeORM no registra consultas.

**11. ¿Por qué no usas `synchronize: true`?**
> Porque cambia el esquema automáticamente, sin control ni historial, y puede perder
> datos. Uso migraciones versionadas con `up()` y `down()`.

**12. ¿Qué pasa si dos personas modifican la misma tarea al mismo tiempo?**
> Bloqueo optimista: cada fila tiene `version`; solo se guarda si la versión no cambió
> desde que se leyó. Si cambió, el segundo recibe 409 `TASK_CONCURRENT_MODIFICATION`.

**13. ¿Qué no está resuelto?**
> Autenticación, rate limiting, paginación, outbox para eventos y una carrera residual
> entre asignar y desactivar. Está documentado en `docs/technical-debt.md`.

---

## Plan de estudio sugerido

| Día | Fases | Meta |
|---|---|---|
| 1 | 0–2 | Entender las ideas; proyecto y shared kernel |
| 2 | 3–4 | Value objects y entidad `User` con pruebas |
| 3 | 5–7 | Puertos, adaptadores en memoria y casos de uso de Users |
| 4 | 8–9 | Dominio y casos de uso de Tasks |
| 5 | 10–12 | Configuración, Docker, migraciones y TypeORM |
| 6 | 13–14 | HTTP y comunicación entre contextos |
| 7 | 15–18 | e2e, arquitectura, documentación y ensayo de preguntas |

**Truco final**: cuando termines una fase, cierra la guía e intenta explicar en voz alta
qué hace cada archivo que creaste. Si te trabas, ahí es donde tienes que repasar.
