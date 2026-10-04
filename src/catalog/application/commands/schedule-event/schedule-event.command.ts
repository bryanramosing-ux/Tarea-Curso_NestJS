import { Command } from '@nestjs/cqrs';

export interface ScheduleEventResult {
  id: string;
}

/** Caso de uso de escritura: programar un evento en el catálogo. */
export class ScheduleEventCommand extends Command<ScheduleEventResult> {
  constructor(
    public readonly name: string,
    public readonly venue: string,
    public readonly startsAt: string,
    public readonly capacity: number,
    public readonly priceCents: number,
    public readonly currency: string,
  ) {
    super();
  }
}
