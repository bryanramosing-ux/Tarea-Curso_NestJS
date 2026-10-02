import { randomUUID } from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Utilidades del shared kernel (no son value objects: cada contexto define los suyos). */
export function generateUuid(): string {
  return randomUUID();
}

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
