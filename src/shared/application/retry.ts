/**
 * Espera aleatoria creciente entre reintentos (jitter): evita que varias
 * operaciones que chocaron vuelvan a chocar exactamente a la vez.
 */
export function backoff(attempt: number, maxJitterMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * maxJitterMs * attempt)));
}
