import { Command } from '@nestjs/cqrs';

/** Caso de uso de escritura: mover la tarjeta a otra columna del tablero. */
export class ChangeTaskStatusCommand extends Command<void> {
  constructor(
    public readonly taskId: string,
    public readonly status: string,
  ) {
    super();
  }
}
