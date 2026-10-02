import { CreateUsersTable1759363200000 } from './1759363200000-CreateUsersTable';
import { CreateTasksTable1759363260000 } from './1759363260000-CreateTasksTable';

/**
 * Migraciones versionadas, en orden. Lista explícita: funciona igual con
 * ts-node (CLI), con Jest (e2e) y con el build compilado (dist/).
 * Al crear una migración nueva, añádela aquí.
 */
export const MIGRATIONS = [CreateUsersTable1759363200000, CreateTasksTable1759363260000];
