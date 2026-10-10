/** Token de inyección: las interfaces no existen en tiempo de ejecución. */
export const CLOCK = Symbol('CLOCK');

/**
 * Puerto de salida para conocer la hora actual. El dominio nunca llama a
 * `new Date()` por su cuenta: recibe `now` del caso de uso, que lo pide a este
 * puerto. Así las reglas que dependen del tiempo (RN-003, RN-007, RN-010,
 * RN-016) se prueban con un reloj fijo, sin esperas ni fechas mágicas.
 */
export interface Clock {
  now(): Date;
}
