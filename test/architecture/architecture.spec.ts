import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * Pruebas de arquitectura: automatizan las comprobaciones de la rúbrica
 * (regla de dependencias, faltas graves, separación de contextos).
 * Leen el código fuente; no arrancan Nest ni tocan la base de datos.
 */

const ROOT = resolve(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const CONTEXTS = ['users', 'tasks'];
const THIS_FILE = resolve(__filename);

function walk(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const tsFiles = (dir: string) => walk(dir).filter((file) => file.endsWith('.ts'));
const productionFiles = (dir: string) => tsFiles(dir).filter((file) => !file.endsWith('.spec.ts'));
const rel = (file: string) => relative(ROOT, file).split(sep).join('/');

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const pattern = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  return [...source.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? match[3]);
}

/** Ruta absoluta (sin extensión) de un import relativo; null si es un paquete. */
function resolveImport(file: string, specifier: string): string | null {
  return specifier.startsWith('.') ? resolve(dirname(file), specifier) : null;
}

function contextOf(absolutePath: string): string | null {
  const [first] = relative(SRC, absolutePath).split(sep);
  return CONTEXTS.includes(first) ? first : null;
}

describe('Architecture', () => {
  describe('bounded contexts (al menos dos, con las tres capas)', () => {
    it.each(CONTEXTS)('%s has domain/, application/ and infrastructure/', (context) => {
      for (const layer of ['domain', 'application', 'infrastructure']) {
        expect(existsSync(join(SRC, context, layer))).toBe(true);
      }
    });

    it.each(CONTEXTS)('%s exposes at least one command (write) and one query (read)', (context) => {
      expect(tsFiles(join(SRC, context, 'application', 'commands')).some((f) => f.endsWith('.command.ts'))).toBe(true);
      expect(tsFiles(join(SRC, context, 'application', 'queries')).some((f) => f.endsWith('.query.ts'))).toBe(true);
    });
  });

  describe('dependency rule', () => {
    const domainFiles = [...CONTEXTS.map((c) => join(SRC, c, 'domain')), join(SRC, 'shared', 'domain')].flatMap(
      productionFiles,
    );
    const FORBIDDEN_IN_DOMAIN = /^(@nestjs\/|typeorm|class-validator|class-transformer|express|pg$|dotenv)/;

    it('finds domain files to check', () => {
      expect(domainFiles.length).toBeGreaterThan(10);
    });

    it('domain/ never imports frameworks (NestJS, TypeORM, class-validator...)', () => {
      const offenders = domainFiles.flatMap((file) =>
        importsOf(file)
          .filter((specifier) => FORBIDDEN_IN_DOMAIN.test(specifier))
          .map((specifier) => `${rel(file)} -> ${specifier}`),
      );
      expect(offenders).toEqual([]);
    });

    it('domain/ never imports application/ or infrastructure/', () => {
      const offenders = domainFiles.flatMap((file) =>
        importsOf(file)
          .map((specifier) => resolveImport(file, specifier))
          .filter((target): target is string => target !== null)
          .filter((target) => /[\\/](application|infrastructure)([\\/]|$)/.test(relative(SRC, target)))
          .map((target) => `${rel(file)} -> ${rel(target)}`),
      );
      expect(offenders).toEqual([]);
    });

    it('a context domain/ never imports another context (no shared domain or value objects)', () => {
      const offenders = CONTEXTS.flatMap((context) =>
        productionFiles(join(SRC, context, 'domain')).flatMap((file) =>
          importsOf(file)
            .map((specifier) => resolveImport(file, specifier))
            .filter((target): target is string => target !== null)
            .filter((target) => {
              const other = contextOf(target);
              return other !== null && other !== context;
            })
            .map((target) => `${rel(file)} -> ${rel(target)}`),
        ),
      );
      expect(offenders).toEqual([]);
    });

    it('application/ depends on ports, never on infrastructure or concrete adapters', () => {
      const offenders = CONTEXTS.flatMap((context) =>
        productionFiles(join(SRC, context, 'application')).flatMap((file) =>
          importsOf(file)
            .filter((specifier) => /infrastructure|typeorm/.test(specifier))
            .map((specifier) => `${rel(file)} -> ${specifier}`),
        ),
      );
      expect(offenders).toEqual([]);
    });

    it('application/ of a context never imports another context', () => {
      const offenders = CONTEXTS.flatMap((context) =>
        productionFiles(join(SRC, context, 'application')).flatMap((file) =>
          importsOf(file)
            .map((specifier) => resolveImport(file, specifier))
            .filter((target): target is string => target !== null && ![null, context].includes(contextOf(target)))
            .map((target) => `${rel(file)} -> ${rel(target)}`),
        ),
      );
      expect(offenders).toEqual([]);
    });
  });

  describe('faltas graves', () => {
    it('ORM decorators (@Entity, @Column...) only live in *.orm-entity.ts files under infrastructure/', () => {
      const offenders = productionFiles(SRC)
        .filter((file) => /@(Entity|Column|PrimaryColumn|PrimaryGeneratedColumn|ManyToOne|OneToMany)\(/.test(readFileSync(file, 'utf8')))
        .filter((file) => !(file.endsWith('.orm-entity.ts') && file.includes(`${sep}infrastructure${sep}`)))
        .map(rel);
      expect(offenders).toEqual([]);
    });

    it('domain/ never throws NestJS HTTP exceptions', () => {
      const offenders = productionFiles(SRC)
        .filter((file) => file.includes(`${sep}domain${sep}`))
        .filter((file) => /HttpException|NotFoundException|ConflictException|BadRequestException|HttpStatus/.test(readFileSync(file, 'utf8')))
        .map(rel);
      expect(offenders).toEqual([]);
    });

    it('controllers only talk to the CommandBus / QueryBus (no repositories, ports or handlers)', () => {
      const controllers = productionFiles(SRC).filter((file) => file.endsWith('.controller.ts'));
      expect(controllers.length).toBeGreaterThanOrEqual(2);
      const offenders = controllers.flatMap((file) =>
        importsOf(file)
          .filter((specifier) => /repository|persistence|domain\/ports|\.handler$|typeorm/i.test(specifier))
          .map((specifier) => `${rel(file)} -> ${specifier}`),
      );
      expect(offenders).toEqual([]);
      for (const file of controllers) {
        expect(readFileSync(file, 'utf8')).toMatch(/CommandBus|QueryBus/);
      }
    });

    it('value objects have private constructors and implement equals()', () => {
      const valueObjects = CONTEXTS.flatMap((c) => productionFiles(join(SRC, c, 'domain', 'value-objects')));
      expect(valueObjects.length).toBeGreaterThanOrEqual(10);
      for (const file of valueObjects) {
        const source = readFileSync(file, 'utf8');
        expect({ file: rel(file), privateConstructor: /private constructor\(/.test(source) }).toEqual({
          file: rel(file),
          privateConstructor: true,
        });
        expect({ file: rel(file), publicConstructor: /(^|\s)(public\s+)?constructor\(/m.test(source.replace(/private constructor\(/g, '')) }).toEqual({
          file: rel(file),
          publicConstructor: false,
        });
        expect({ file: rel(file), equals: /equals\(other: \w+\): boolean/.test(source) }).toEqual({
          file: rel(file),
          equals: true,
        });
      }
    });

    it('domain entities and ORM entities are different classes, connected by a mapper', () => {
      for (const context of CONTEXTS) {
        const infra = productionFiles(join(SRC, context, 'infrastructure'));
        expect(infra.some((file) => file.endsWith('.orm-entity.ts'))).toBe(true);
        expect(infra.some((file) => file.endsWith('.mapper.ts'))).toBe(true);
        expect(productionFiles(join(SRC, context, 'domain', 'entities')).length).toBeGreaterThan(0);
      }
    });

    it('every repository port has an in-memory and a real (TypeORM) adapter', () => {
      for (const context of CONTEXTS) {
        const infra = productionFiles(join(SRC, context, 'infrastructure')).map(rel);
        expect(infra.some((file) => /in-memory\/in-memory-.*\.repository\.ts$/.test(file))).toBe(true);
        expect(infra.some((file) => /typeorm\/typeorm-.*\.repository\.ts$/.test(file))).toBe(true);
      }
    });

    it('process.env is only read inside src/config/', () => {
      const offenders = productionFiles(SRC)
        .filter((file) => !file.startsWith(join(SRC, 'config') + sep))
        .filter((file) => readFileSync(file, 'utf8').includes('process.env'))
        .map(rel);
      expect(offenders).toEqual([]);
    });

    it('synchronize is never enabled', () => {
      const offenders = productionFiles(SRC)
        .filter((file) => /synchronize\s*:\s*true/.test(readFileSync(file, 'utf8')))
        .map(rel);
      expect(offenders).toEqual([]);
      expect(readFileSync(join(SRC, 'config', 'database.config.ts'), 'utf8')).toMatch(/synchronize:\s*false/);
    });

    it('command handlers publish domain events only after persisting', () => {
      const handlers = CONTEXTS.flatMap((c) => productionFiles(join(SRC, c, 'application', 'commands'))).filter((file) =>
        file.endsWith('.handler.ts'),
      );
      expect(handlers.length).toBeGreaterThanOrEqual(5);
      for (const file of handlers) {
        const source = readFileSync(file, 'utf8');
        const save = source.lastIndexOf('.save(');
        const publish = source.indexOf('.publishAll(');
        expect({ file: rel(file), saveBeforePublish: save !== -1 && publish !== -1 && save < publish }).toEqual({
          file: rel(file),
          saveBeforePublish: true,
        });
      }
    });

    it('no test is disabled or focused (skip / only / xit / xdescribe)', () => {
      const disabled = new RegExp(['\\b(it|test|describe)\\.(skip|only)\\(', '\\bx(it|test|describe)\\(', '\\bf(it|describe)\\('].join('|'));
      const testFiles = [...tsFiles(SRC), ...tsFiles(join(ROOT, 'test'))]
        .filter((file) => /\.(spec|e2e-spec)\.ts$/.test(file))
        .filter((file) => resolve(file) !== THIS_FILE);
      expect(testFiles.length).toBeGreaterThan(10);
      const offenders = testFiles.filter((file) => disabled.test(readFileSync(file, 'utf8'))).map(rel);
      expect(offenders).toEqual([]);
    });

    it('.env is ignored by git and only .env.example is provided', () => {
      const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/);
      expect(gitignore).toContain('.env');
      expect(existsSync(join(ROOT, '.env.example'))).toBe(true);
    });
  });
});
