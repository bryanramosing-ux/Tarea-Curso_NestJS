import { Command } from '@nestjs/cqrs';

export interface CreateTaskResult {
  id: string;
}

/** Caso de uso de escritura: crear una tarjeta en la columna TODO. */
export class CreateTaskCommand extends Command<CreateTaskResult> {
  constructor(
    public readonly title: string,
    public readonly description?: string,
    public readonly priority?: string,
  ) {
    super();
  }
}
