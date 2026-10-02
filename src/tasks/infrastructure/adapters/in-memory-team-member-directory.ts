import { TeamMemberDirectory } from '../../domain/ports/team-member-directory.port';
import { AssigneeId } from '../../domain/value-objects/assignee-id';
import { TeamMember } from '../../domain/value-objects/team-member';

/** Adaptador en memoria del puerto TeamMemberDirectory (pruebas unitarias). */
export class InMemoryTeamMemberDirectory implements TeamMemberDirectory {
  private readonly members = new Map<string, TeamMember>();

  add(member: TeamMember): void {
    this.members.set(member.id.value, member);
  }

  async findById(id: AssigneeId): Promise<TeamMember | null> {
    return this.members.get(id.value) ?? null;
  }
}
