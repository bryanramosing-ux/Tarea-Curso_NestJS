import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

/**
 * Transacción en curso, compartida de forma implícita por todos los
 * repositorios TypeORM que trabajan en la misma petición.
 * AsyncLocalStorage propaga el EntityManager transaccional a través de los
 * `await` sin pasarlo como parámetro (el dominio y los casos de uso no
 * saben que existe). Fuera de una transacción se usa el manager normal.
 */
@Injectable()
export class TypeOrmTransactionContext {
  private readonly storage = new AsyncLocalStorage<EntityManager>();

  constructor(private readonly dataSource: DataSource) {}

  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return (this.storage.getStore() ?? this.dataSource.manager).getRepository(entity);
  }

  isActive(): boolean {
    return this.storage.getStore() !== undefined;
  }

  /** Abre una transacción y ejecuta `work` dentro de ella (COMMIT si termina, ROLLBACK si lanza). */
  runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) => this.storage.run(manager, work));
  }
}
