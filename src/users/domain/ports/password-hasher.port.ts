import { PasswordHash } from '../value-objects/password-hash';
import { PlainPassword } from '../value-objects/plain-password';

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/** Puerto de salida: el algoritmo concreto de hashing vive en infraestructura. */
export interface PasswordHasher {
  hash(password: PlainPassword): Promise<PasswordHash>;
  verify(password: PlainPassword, hash: PasswordHash): Promise<boolean>;
}
