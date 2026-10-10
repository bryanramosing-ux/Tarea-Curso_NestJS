const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Utilidad del shared kernel (no es un value object: cada contexto define los
 * suyos). Solo VALIDA el formato; generar identificadores es una dependencia
 * externa (azar del sistema) y vive detrás del puerto IdGenerator.
 */
export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
