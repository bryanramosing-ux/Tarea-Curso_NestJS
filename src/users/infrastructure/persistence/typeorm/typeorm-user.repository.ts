import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../../../domain/entities/user';
import { UserConcurrentModificationError, UserEmailAlreadyInUseError } from '../../../domain/errors/user.errors';
import { UserRepository } from '../../../domain/ports/user.repository';
import { Email } from '../../../domain/value-objects/email';
import { UserId } from '../../../domain/value-objects/user-id';
import { UserMapper } from './user.mapper';
import { UserOrmEntity } from './user.orm-entity';

const UNIQUE_VIOLATION = '23505';
export const USERS_EMAIL_UNIQUE_CONSTRAINT = 'uq_users_email';

/**
 * Adaptador real (PostgreSQL + TypeORM) del puerto UserRepository.
 * Solo consulta, guarda y traduce:
 *  - un agregado nuevo (version 0) se INSERTA;
 *  - uno existente se ACTUALIZA solo si la versión almacenada sigue siendo la
 *    leída (bloqueo optimista); si no, otra operación lo cambió en paralelo;
 *  - la violación del índice único de email se traduce a RN-002, que la base
 *    garantiza incluso ante dos registros concurrentes.
 */
@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: Repository<UserOrmEntity>,
  ) {}

  async save(user: User): Promise<void> {
    const row = UserMapper.toPersistence(user);
    try {
      if (user.version === 0) {
        await this.repository.insert({ ...row, version: 1 });
      } else {
        const { id, version, ...changes } = row;
        const result = await this.repository.update({ id, version }, { ...changes, version: version + 1 });
        if (!result.affected) {
          throw new UserConcurrentModificationError(id);
        }
      }
    } catch (error) {
      if (this.isEmailUniqueViolation(error)) {
        throw new UserEmailAlreadyInUseError(user.email.value);
      }
      throw error;
    }
    user.markAsPersisted();
  }

  async findById(id: UserId): Promise<User | null> {
    const row = await this.repository.findOneBy({ id: id.value });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.repository.findOneBy({ email: email.value });
    return row ? UserMapper.toDomain(row) : null;
  }

  private isEmailUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as { code?: string; constraint?: string };
    return driverError.code === UNIQUE_VIOLATION && driverError.constraint === USERS_EMAIL_UNIQUE_CONSTRAINT;
  }
}
