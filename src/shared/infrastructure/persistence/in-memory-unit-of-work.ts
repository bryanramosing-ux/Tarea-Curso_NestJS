import { UnitOfWork } from '../../domain/ports/unit-of-work.port';

/**
 * Adaptador en memoria del puerto UnitOfWork (pruebas unitarias): ejecuta el
 * trabajo tal cual. La atomicidad real (ROLLBACK) se prueba en e2e contra
 * PostgreSQL con TypeOrmUnitOfWork.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  runs = 0;

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.runs++;
    return work();
  }
}
