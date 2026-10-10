export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

/**
 * Puerto de salida "unidad de trabajo": todo lo que los repositorios guarden
 * dentro de `run` se confirma junto o no se confirma (atómico). Si `work`
 * lanza, se deshace todo y el error se propaga.
 * El caso de uso decide QUÉ es atómico; el adaptador decide CÓMO
 * (transacción de PostgreSQL, nada en memoria...).
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}
