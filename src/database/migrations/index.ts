import { CreateEventsTable1759536000000 } from './1759536000000-CreateEventsTable';
import { CreateTicketingTables1759536060000 } from './1759536060000-CreateTicketingTables';

/**
 * Migraciones versionadas, en orden. Lista explícita: funciona igual con
 * ts-node (CLI), con Jest (e2e) y con el build compilado (dist/).
 * Al crear una migración nueva, añádela aquí.
 */
export const MIGRATIONS = [CreateEventsTable1759536000000, CreateTicketingTables1759536060000];
