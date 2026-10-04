import { Command } from '@nestjs/cqrs';

/** Caso de uso de escritura: cancelar un evento programado. */
export class CancelEventCommand extends Command<void> {
  constructor(public readonly eventId: string) {
    super();
  }
}
