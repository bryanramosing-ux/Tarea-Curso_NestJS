import { QueryBus } from '@nestjs/cqrs';
import { UserNotFoundError } from '../../../users/domain/errors/user.errors';
import { GetUserQuery } from '../../../users/application/queries/get-user/get-user.query';
import { AssigneeId } from '../../domain/value-objects/assignee-id';
import { UsersTeamMemberDirectory } from './users-team-member-directory.adapter';

const ID = AssigneeId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');

function directoryAnswering(answer: () => Promise<unknown>): { directory: UsersTeamMemberDirectory; execute: jest.Mock } {
  const execute = jest.fn(answer);
  return { directory: new UsersTeamMemberDirectory({ execute } as unknown as QueryBus), execute };
}

describe('UsersTeamMemberDirectory (ACL Tasks -> Users)', () => {
  it('asks the Users context through GetUserQuery and translates the view', async () => {
    const { directory, execute } = directoryAnswering(async () => ({ id: ID.value, status: 'ACTIVE' }));

    const member = await directory.findById(ID);

    expect(execute).toHaveBeenCalledWith(new GetUserQuery(ID.value));
    expect(member?.id.equals(ID)).toBe(true);
    expect(member?.isActive()).toBe(true);
  });

  it('maps an INACTIVE user to a member that cannot receive work', async () => {
    const { directory } = directoryAnswering(async () => ({ id: ID.value, status: 'INACTIVE' }));
    expect((await directory.findById(ID))?.isActive()).toBe(false);
  });

  it('returns null when the user does not exist', async () => {
    const { directory } = directoryAnswering(async () => {
      throw new UserNotFoundError(ID.value);
    });
    await expect(directory.findById(ID)).resolves.toBeNull();
  });

  it('propagates unexpected failures', async () => {
    const { directory } = directoryAnswering(async () => {
      throw new Error('connection lost');
    });
    await expect(directory.findById(ID)).rejects.toThrow('connection lost');
  });
});
