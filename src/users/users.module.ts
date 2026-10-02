import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateUserHandler } from './application/commands/create-user/create-user.handler';
import { DeactivateUserHandler } from './application/commands/deactivate-user/deactivate-user.handler';
import { GetUserHandler } from './application/queries/get-user/get-user.handler';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.port';
import { USER_REPOSITORY } from './domain/ports/user.repository';
import { UsersController } from './infrastructure/http/users.controller';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm/typeorm-user.repository';
import { UserOrmEntity } from './infrastructure/persistence/typeorm/user.orm-entity';
import { ScryptPasswordHasher } from './infrastructure/security/scrypt-password-hasher';

/**
 * Composición del contexto Users: aquí (y solo aquí) se decide qué
 * implementación concreta satisface cada puerto.
 */
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UsersController],
  providers: [
    CreateUserHandler,
    DeactivateUserHandler,
    GetUserHandler,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
  ],
})
export class UsersModule {}
