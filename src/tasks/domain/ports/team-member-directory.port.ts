import { AssigneeId } from '../value-objects/assignee-id';
import { TeamMember } from '../value-objects/team-member';

export const TEAM_MEMBER_DIRECTORY = Symbol('TEAM_MEMBER_DIRECTORY');

/**
 * Puerto PROPIO del contexto Tasks para conocer a los miembros del equipo.
 * Tasks no importa el dominio de Users: un adaptador de infraestructura
 * traduce la información del otro contexto a este modelo (ACL).
 * Devuelve `null` si el miembro no existe.
 */
export interface TeamMemberDirectory {
  findById(id: AssigneeId): Promise<TeamMember | null>;
}
