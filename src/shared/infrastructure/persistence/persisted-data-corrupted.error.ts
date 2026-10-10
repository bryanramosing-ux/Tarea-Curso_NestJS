/**
 * Una fila de la base viola las reglas del dominio (alguien la modificó fuera
 * de la aplicación o una migración la dejó mal). NO es un error de negocio del
 * cliente: es un fallo del servidor y debe responder 500, no 400. Por eso NO
 * extiende DomainException. Se registra el detalle en el log; al cliente solo
 * le llega un mensaje genérico.
 */
export class PersistedDataCorruptedError extends Error {
  constructor(table: string, key: string, cause: unknown) {
    super(`Row ${key} of table "${table}" violates the domain rules: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    });
    this.name = 'PersistedDataCorruptedError';
  }
}

/** Reconstruye un agregado y convierte cualquier violación de sus reglas en PersistedDataCorruptedError. */
export function rehydrate<T>(table: string, key: string, build: () => T): T {
  try {
    return build();
  } catch (error) {
    throw new PersistedDataCorruptedError(table, key, error);
  }
}
