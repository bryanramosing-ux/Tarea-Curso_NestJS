import { User, UserPrimitives } from '../../../domain/entities/user';
import { UserConcurrentModificationError, UserEmailAlreadyInUseError } from '../../../domain/errors/user.errors';
import { UserRepository } from '../../../domain/ports/user.repository';
import { Email } from '../../../domain/value-objects/email';
import { UserId } from '../../../domain/value-objects/user-id';

/**
 * Adaptador en memoria del puerto UserRepository (pruebas unitarias).
 * Cumple el mismo contrato que el adaptador real: guarda copias de las
 * primitivas, reconstruye con fromPrimitives, emula la restricción UNIQUE
 * del email y el bloqueo optimista por versión.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, UserPrimitives>();

  async save(user: User): Promise<void> {
    const primitives = user.toPrimitives();
    const stored = this.rows.get(primitives.id);
    if ((stored?.version ?? 0) !== primitives.version) {
      throw new UserConcurrentModificationError(primitives.id);
    }
    const emailOwner = [...this.rows.values()].find((row) => row.email === primitives.email);
    if (emailOwner && emailOwner.id !== primitives.id) {
      throw new UserEmailAlreadyInUseError(primitives.email);
    }
    this.rows.set(primitives.id, { ...primitives, version: primitives.version + 1 });
    user.markAsPersisted();
  }

  async findById(id: UserId): Promise<User | null> {
    const row = this.rows.get(id.value);
    return row ? User.fromPrimitives({ ...row }) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = [...this.rows.values()].find((candidate) => candidate.email === email.value);
    return row ? User.fromPrimitives({ ...row }) : null;
  }

  /** Utilidad de pruebas: inspeccionar lo persistido. */
  all(): UserPrimitives[] {
    return [...this.rows.values()].map((row) => ({ ...row }));
  }
}
