import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, ScryptOptions, timingSafeEqual } from 'node:crypto';
import { PasswordHasher } from '../../domain/ports/password-hasher.port';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { PlainPassword } from '../../domain/value-objects/plain-password';

const ALGORITHM = 'scrypt';
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) =>
      error ? reject(error) : resolve(derivedKey),
    );
  });
}

/**
 * Adaptador del puerto PasswordHasher con scrypt (función de derivación
 * resistente a fuerza bruta incluida en Node, sin dependencias nativas).
 * Formato: scrypt$N$r$p$<salt base64>$<hash base64>
 */
@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: PlainPassword): Promise<PasswordHash> {
    const salt = randomBytes(SALT_BYTES);
    const derived = await scrypt(password.reveal(), salt, KEY_LENGTH, {
      N: COST,
      r: BLOCK_SIZE,
      p: PARALLELIZATION,
    });
    return PasswordHash.create(
      [ALGORITHM, COST, BLOCK_SIZE, PARALLELIZATION, salt.toString('base64'), derived.toString('base64')].join('$'),
    );
  }

  async verify(password: PlainPassword, hash: PasswordHash): Promise<boolean> {
    const [algorithm, cost, blockSize, parallelization, saltB64, hashB64] = hash.value.split('$');
    if (algorithm !== ALGORITHM || !saltB64 || !hashB64) {
      return false;
    }
    const expected = Buffer.from(hashB64, 'base64');
    const derived = await scrypt(password.reveal(), Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }
}
