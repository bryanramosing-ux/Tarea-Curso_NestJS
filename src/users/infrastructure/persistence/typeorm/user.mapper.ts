import { User } from '../../../domain/entities/user';
import { UserOrmEntity } from './user.orm-entity';

/** Traduce entre el agregado de dominio y el modelo de persistencia. */
export class UserMapper {
  static toDomain(row: UserOrmEntity): User {
    return User.fromPrimitives({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.passwordHash,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }

  static toPersistence(user: User): UserOrmEntity {
    const primitives = user.toPrimitives();
    const row = new UserOrmEntity();
    row.id = primitives.id;
    row.name = primitives.name;
    row.email = primitives.email;
    row.passwordHash = primitives.passwordHash;
    row.status = primitives.status;
    row.createdAt = primitives.createdAt;
    row.updatedAt = primitives.updatedAt;
    row.version = primitives.version;
    return row;
  }
}
