import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { DomainException } from '../../../shared/domain/domain-exception';
import { GetUserQuery } from '../../../users/application/queries/get-user/get-user.query';
import { UserView } from '../../../users/application/views/user.view';
import { TeamMemberDirectory } from '../../domain/ports/team-member-directory.port';
import { AssigneeId } from '../../domain/value-objects/assignee-id';
import { TeamMember } from '../../domain/value-objects/team-member';

const USER_NOT_FOUND = 'USER_NOT_FOUND';
const ACTIVE_STATUS = 'ACTIVE';

/**
 * Anti-corruption layer Tasks -> Users.
 * Consulta el contexto Users únicamente a través de su API pública de
 * lectura (GetUserQuery por el QueryBus) y traduce la UserView al modelo
 * propio de Tasks (TeamMember). Nunca toca el dominio ni la base de Users.
 */
@Injectable()
export class UsersTeamMemberDirectory implements TeamMemberDirectory {
  constructor(private readonly queryBus: QueryBus) {}

  async findById(id: AssigneeId): Promise<TeamMember | null> {
    try {
      const user: UserView = await this.queryBus.execute(new GetUserQuery(id.value));
      return TeamMember.create({ id, active: user.status === ACTIVE_STATUS });
    } catch (error) {
      if (error instanceof DomainException && error.code === USER_NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }
}
