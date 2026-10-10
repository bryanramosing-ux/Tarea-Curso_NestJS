export const ID_GENERATOR = Symbol('ID_GENERATOR');

/**
 * Puerto de salida para generar identificadores únicos (UUID). El azar es una
 * dependencia externa: el adaptador real usa el CSPRNG del sistema y las
 * pruebas pueden usar uno determinista.
 */
export interface IdGenerator {
  generate(): string;
}
