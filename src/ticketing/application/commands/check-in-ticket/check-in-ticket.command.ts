import { Command } from '@nestjs/cqrs';

export interface CheckInTicketResult {
  id: string;
}

/** Caso de uso de escritura: validar una entrada con su código en la puerta de un evento concreto. */
export class CheckInTicketCommand extends Command<CheckInTicketResult> {
  constructor(
    public readonly eventId: string,
    public readonly code: string,
  ) {
    super();
  }
}
