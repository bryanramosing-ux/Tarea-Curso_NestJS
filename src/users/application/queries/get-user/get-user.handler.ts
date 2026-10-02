import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '../../../domain/errors/user.errors';
import { USER_REPOSITORY, UserRepository } from '../../../domain/ports/user.repository';
import { UserId } from '../../../domain/value-objects/user-id';
import { toUserView, UserView } from '../../views/user.view';
import { GetUserQuery } from './get-user.query';

@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(query: GetUserQuery): Promise<UserView> {
    const id = UserId.create(query.userId);
    const user = await this.users.findById(id);
    if (!user) {
      throw new UserNotFoundError(id.value);
    }
    return toUserView(user);
  }
}
