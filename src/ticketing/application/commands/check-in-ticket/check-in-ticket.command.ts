import { Command } from '@nestjs/cqrs';

export interface CheckInTicketResult {
  id: string;
}

/** Caso de uso de escritura: validar una entrada en la puerta con su código. */
export class CheckInTicketCommand extends Command<CheckInTicketResult> {
  constructor(public readonly code: string) {
    super();
  }
}
