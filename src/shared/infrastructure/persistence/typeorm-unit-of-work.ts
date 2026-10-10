import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../domain/ports/unit-of-work.port';
import { TypeOrmTransactionContext } from './typeorm-transaction-context';

/**
 * Adaptador real del puerto UnitOfWork: una transacción de PostgreSQL
 * (READ COMMITTED). Si ya hay una transacción abierta, se reutiliza.
 */
@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly context: TypeOrmTransactionContext) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.context.isActive() ? work() : this.context.runInTransaction(work);
  }
}
