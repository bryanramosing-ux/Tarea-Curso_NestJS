import { User } from '../entities/user';
import { Email } from '../value-objects/email';
import { UserId } from '../value-objects/user-id';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/**
 * Puerto de persistencia del agregado User.
 * Las búsquedas devuelven `null` cuando no hay resultado: decidir si eso
 * es un error de negocio es responsabilidad del caso de uso, no del adaptador.
 * `save` aplica bloqueo optimista: si el usuario cambió desde que se leyó,
 * lanza UserConcurrentModificationError en lugar de sobrescribirlo.
 */
export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
}
