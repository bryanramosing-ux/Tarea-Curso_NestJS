import { Clock } from '../../domain/ports/clock.port';

/** Adaptador real del puerto Clock: la hora del sistema. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
