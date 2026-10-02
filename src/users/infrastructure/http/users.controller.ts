import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateUserCommand, CreateUserResult } from '../../application/commands/create-user/create-user.command';
import { DeactivateUserCommand } from '../../application/commands/deactivate-user/deactivate-user.command';
import { GetUserQuery } from '../../application/queries/get-user/get-user.query';
import { UserView } from '../../application/views/user.view';
import { CreateUserDto } from './dto/create-user.dto';

/**
 * Adaptador de entrada HTTP. Delgado: traduce HTTP -> comando/consulta
 * y despacha por los buses. Sin reglas de negocio ni acceso a repositorios.
 */
@Controller('users')
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto): Promise<CreateUserResult> {
    return this.commandBus.execute(new CreateUserCommand(dto.name, dto.email, dto.password));
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserView> {
    return this.queryBus.execute(new GetUserQuery(id));
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.commandBus.execute(new DeactivateUserCommand(id));
  }
}
