import { Command } from '@nestjs/cqrs';

/** Caso de uso de escritura: dar de baja (desactivar) a un miembro. */
export class DeactivateUserCommand extends Command<void> {
  constructor(public readonly userId: string) {
    super();
  }
}
