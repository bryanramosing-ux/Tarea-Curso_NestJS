import { validateEnv } from './env.validation';

const VALID = {
  NODE_ENV: 'development',
  PORT: '3000',
  DB_HOST: 'db.internal',
  DB_PORT: '5432',
  DB_USER: 'ticketing',
  DB_PASSWORD: 'super-secret-value',
  DB_NAME: 'ticketing',
  TICKET_CODE_SECRET: 'a-very-long-server-secret-for-tests-0123456789',
};

describe('validateEnv', () => {
  it('accepts a complete configuration and converts numbers', () => {
    const env = validateEnv(VALID);
    expect(env.PORT).toBe(3000);
    expect(env.DB_PORT).toBe(5432);
  });

  it.each(['NODE_ENV', 'PORT', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'TICKET_CODE_SECRET'])(
    'fails fast when %s is missing (no silent defaults)',
    (key) => {
      const incomplete: Record<string, string> = { ...VALID };
      delete incomplete[key];
      expect(() => validateEnv(incomplete)).toThrow(/Invalid environment configuration/);
    },
  );

  it('requires DB_NAME_TEST only when running tests', () => {
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'test' })).toThrow(/DB_NAME_TEST/);
    expect(validateEnv({ ...VALID, NODE_ENV: 'test', DB_NAME_TEST: 'ticketing_test' }).DB_NAME_TEST).toBe('ticketing_test');
  });

  it('rejects invalid values', () => {
    expect(() => validateEnv({ ...VALID, PORT: 'abc' })).toThrow();
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'staging' })).toThrow();
  });

  it('requires a ticket code secret of at least 32 characters', () => {
    expect(() => validateEnv({ ...VALID, TICKET_CODE_SECRET: 'short' })).toThrow(/TICKET_CODE_SECRET/);
  });

  it('never prints secret values in the error message', () => {
    expect(() => validateEnv({ ...VALID, TICKET_CODE_SECRET: 'tooshort-secret' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('tooshort-secret') }),
    );
    expect(() => validateEnv({ ...VALID, DB_NAME: '' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('super-secret-value') }),
    );
  });
});
