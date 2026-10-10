import { ArgumentsHost, Logger } from '@nestjs/common';
import { UnhandledExceptionFilter } from './unhandled-exception.filter';

function hostWith() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', path: '/tickets', url: '/tickets' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('UnhandledExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('answers a generic 500 and logs the real error (never sent to the client)', () => {
    const { host, status, json } = hostWith();
    new UnhandledExceptionFilter().catch(new Error('duplicate key value violates "uq_secret"'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' }),
    );
    expect(JSON.stringify(json.mock.calls)).not.toContain('uq_secret');
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('keeps client errors raised by express (e.g. 413) as client errors, without logging them as server errors', () => {
    const { host, status, json } = hostWith();
    const tooLarge = Object.assign(new Error('request entity too large'), { status: 413, expose: true, type: 'entity.too.large' });

    new UnhandledExceptionFilter().catch(tooLarge, host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 413, code: 'PAYLOAD_TOO_LARGE' }));
    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });
});
