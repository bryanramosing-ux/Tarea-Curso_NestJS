import { AssigneeId } from './assignee-id';

/**
 * Lo que el contexto Tasks necesita saber de un miembro del equipo:
 * su identidad y si puede recibir trabajo. Se obtiene por el puerto
 * TeamMemberDirectory (anti-corruption layer hacia el contexto Users).
 */
export class TeamMember {
  private constructor(
    public readonly id: AssigneeId,
    private readonly active: boolean,
  ) {}

  static create(props: { id: AssigneeId; active: boolean }): TeamMember {
    return new TeamMember(props.id, props.active === true);
  }

  isActive(): boolean {
    return this.active;
  }

  equals(other: TeamMember): boolean {
    return other instanceof TeamMember && this.id.equals(other.id) && this.active === other.active;
  }
}
