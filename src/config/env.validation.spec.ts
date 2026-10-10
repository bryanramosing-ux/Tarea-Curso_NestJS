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
  ORGANIZER_API_KEY: 'organizer-key-for-unit-tests-0123456789abcdef',
  GATE_API_KEY: 'gate-key-for-unit-tests-0123456789abcdef-gate',
  THROTTLE_TTL_SECONDS: '60',
  THROTTLE_LIMIT: '120',
  THROTTLE_SENSITIVE_LIMIT: '20',
  TRUST_PROXY: 'false',
};

const REQUIRED = Object.keys(VALID);

describe('validateEnv', () => {
  it('accepts a complete configuration and converts numbers and booleans', () => {
    const env = validateEnv(VALID);
    expect(env.PORT).toBe(3000);
    expect(env.DB_PORT).toBe(5432);
    expect(env.THROTTLE_LIMIT).toBe(120);
    expect(env.TRUST_PROXY).toBe(false);
    expect(validateEnv({ ...VALID, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
  });

  it.each(REQUIRED)('fails fast when %s is missing (no silent defaults)', (key) => {
    const incomplete: Record<string, string> = { ...VALID };
    delete incomplete[key];
    expect(() => validateEnv(incomplete)).toThrow(/Invalid environment configuration/);
  });

  it('requires DB_NAME_TEST only when running tests', () => {
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'test' })).toThrow(/DB_NAME_TEST/);
    expect(validateEnv({ ...VALID, NODE_ENV: 'test', DB_NAME_TEST: 'ticketing_test' }).DB_NAME_TEST).toBe('ticketing_test');
  });

  it('rejects invalid values', () => {
    expect(() => validateEnv({ ...VALID, PORT: 'abc' })).toThrow();
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'staging' })).toThrow();
    expect(() => validateEnv({ ...VALID, TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
    expect(() => validateEnv({ ...VALID, THROTTLE_LIMIT: '0' })).toThrow(/THROTTLE_LIMIT/);
  });

  it.each(['TICKET_CODE_SECRET', 'ORGANIZER_API_KEY', 'GATE_API_KEY'])('requires %s to have at least 32 characters', (key) => {
    expect(() => validateEnv({ ...VALID, [key]: 'short' })).toThrow(new RegExp(key));
  });

  it('requires different API keys for each role', () => {
    expect(() => validateEnv({ ...VALID, GATE_API_KEY: VALID.ORGANIZER_API_KEY })).toThrow(/must be different/);
  });

  it('requires the sensitive throttle limit to be stricter than the general one', () => {
    expect(() => validateEnv({ ...VALID, THROTTLE_SENSITIVE_LIMIT: '500' })).toThrow(/THROTTLE_SENSITIVE_LIMIT/);
  });

  it.each(['DB_PASSWORD', 'TICKET_CODE_SECRET', 'ORGANIZER_API_KEY', 'GATE_API_KEY'])(
    'rejects the public example value of %s in production, but allows it locally',
    (key) => {
      const example = { ...VALID, [key]: 'change-me-local-only-0123456789abcdef-0123' };
      expect(() => validateEnv({ ...example, NODE_ENV: 'production' })).toThrow(new RegExp(`${key} still has the public example value`));
      expect(() => validateEnv(example)).not.toThrow();
    },
  );

  it('never prints secret values in the error message', () => {
    expect(() => validateEnv({ ...VALID, TICKET_CODE_SECRET: 'tooshort-secret' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('tooshort-secret') }),
    );
    expect(() => validateEnv({ ...VALID, DB_NAME: '' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('super-secret-value') }),
    );
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'production', GATE_API_KEY: 'change-me-gate-0123456789abcdef-0123456' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('change-me-gate') }),
    );
  });
});
