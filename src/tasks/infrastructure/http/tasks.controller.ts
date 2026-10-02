import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { parseIdPipe } from '../../../shared/infrastructure/http/parse-id.pipe';
import { AssignTaskCommand } from '../../application/commands/assign-task/assign-task.command';
import { ChangeTaskStatusCommand } from '../../application/commands/change-task-status/change-task-status.command';
import { CreateTaskCommand, CreateTaskResult } from '../../application/commands/create-task/create-task.command';
import { GetTaskQuery } from '../../application/queries/get-task/get-task.query';
import { ListTasksQuery } from '../../application/queries/list-tasks/list-tasks.query';
import { TaskView } from '../../application/views/task.view';
import { AssignTaskDto } from './dto/assign-task.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query-dto';

/** Adaptador de entrada HTTP del tablero: solo despacha comandos y consultas. */
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTaskDto): Promise<CreateTaskResult> {
    return this.commandBus.execute(new CreateTaskCommand(dto.title, dto.description, dto.priority));
  }

  @Get()
  list(@Query() filters: ListTasksQueryDto): Promise<TaskView[]> {
    return this.queryBus.execute(new ListTasksQuery(filters.status, filters.assigneeId));
  }

  @Get(':id')
  findOne(@Param('id', parseIdPipe()) id: string): Promise<TaskView> {
    return this.queryBus.execute(new GetTaskQuery(id));
  }

  @Patch(':id/assignee')
  @HttpCode(HttpStatus.NO_CONTENT)
  assign(@Param('id', parseIdPipe()) id: string, @Body() dto: AssignTaskDto): Promise<void> {
    return this.commandBus.execute(new AssignTaskCommand(id, dto.assigneeId));
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  changeStatus(@Param('id', parseIdPipe()) id: string, @Body() dto: ChangeTaskStatusDto): Promise<void> {
    return this.commandBus.execute(new ChangeTaskStatusCommand(id, dto.status));
  }
}
