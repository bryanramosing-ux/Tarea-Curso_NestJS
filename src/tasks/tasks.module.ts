import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignTaskHandler } from './application/commands/assign-task/assign-task.handler';
import { ChangeTaskStatusHandler } from './application/commands/change-task-status/change-task-status.handler';
import { CreateTaskHandler } from './application/commands/create-task/create-task.handler';
import { ReleaseMemberTasksHandler } from './application/commands/release-member-tasks/release-member-tasks.handler';
import { GetTaskHandler } from './application/queries/get-task/get-task.handler';
import { ListTasksHandler } from './application/queries/list-tasks/list-tasks.handler';
import { TASK_REPOSITORY } from './domain/ports/task.repository';
import { TEAM_MEMBER_DIRECTORY } from './domain/ports/team-member-directory.port';
import { UsersTeamMemberDirectory } from './infrastructure/adapters/users-team-member-directory.adapter';
import { ReleaseTasksOnUserDeactivatedListener } from './infrastructure/event-handlers/release-tasks-on-user-deactivated.listener';
import { TasksController } from './infrastructure/http/tasks.controller';
import { TaskOrmEntity } from './infrastructure/persistence/typeorm/task.orm-entity';
import { TypeOrmTaskRepository } from './infrastructure/persistence/typeorm/typeorm-task.repository';

/** Composición del contexto Tasks: enlaza cada puerto con su adaptador. */
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([TaskOrmEntity])],
  controllers: [TasksController],
  providers: [
    CreateTaskHandler,
    AssignTaskHandler,
    ChangeTaskStatusHandler,
    ReleaseMemberTasksHandler,
    GetTaskHandler,
    ListTasksHandler,
    ReleaseTasksOnUserDeactivatedListener,
    { provide: TASK_REPOSITORY, useClass: TypeOrmTaskRepository },
    { provide: TEAM_MEMBER_DIRECTORY, useClass: UsersTeamMemberDirectory },
  ],
})
export class TasksModule {}
