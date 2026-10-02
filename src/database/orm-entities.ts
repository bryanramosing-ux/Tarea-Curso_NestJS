import { TaskOrmEntity } from '../tasks/infrastructure/persistence/typeorm/task.orm-entity';
import { UserOrmEntity } from '../users/infrastructure/persistence/typeorm/user.orm-entity';

/** Modelos de persistencia registrados (lista explícita, sin globs frágiles). */
export const ORM_ENTITIES = [UserOrmEntity, TaskOrmEntity];
