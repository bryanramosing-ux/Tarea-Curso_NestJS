import { Command } from '@nestjs/cqrs';

export interface CreateUserResult {
  id: string;
}

/** Caso de uso de escritura: registrar un miembro del equipo. */
export class CreateUserCommand extends Command<CreateUserResult> {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
  ) {
    super();
  }
}
