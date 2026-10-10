import { randomUUID } from 'node:crypto';
import { IdGenerator } from '../../domain/ports/id-generator.port';

/** Adaptador real del puerto IdGenerator: UUID v4 con el CSPRNG de Node. */
export class CryptoIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
