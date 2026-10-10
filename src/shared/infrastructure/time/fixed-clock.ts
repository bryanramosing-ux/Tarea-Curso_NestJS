import { Clock } from '../../domain/ports/clock.port';

/** Adaptador del puerto Clock para pruebas: hora fija que se puede adelantar a mano. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(start: Date | string = '2030-01-01T10:00:00.000Z') {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(moment: Date | string): void {
    this.current = new Date(moment);
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
