import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { DomainErrorKind, DomainException } from '../../domain/domain-exception';
import { DomainExceptionFilter, httpStatusFor } from './domain-exception.filter';

class SampleError extends DomainException {
  constructor(kind: DomainErrorKind) {
    super('SAMPLE_CODE', kind, 'sample message');
  }
}

describe('DomainExceptionFilter', () => {
  it.each([
    [DomainErrorKind.VALIDATION, HttpStatus.BAD_REQUEST],
    [DomainErrorKind.NOT_FOUND, HttpStatus.NOT_FOUND],
    [DomainErrorKind.CONFLICT, HttpStatus.CONFLICT],
  ])('maps %s to HTTP %s', (kind, status) => {
    expect(httpStatusFor(kind)).toBe(status);
  });

  it('covers every DomainErrorKind and never answers 500 for business errors', () => {
    for (const kind of Object.values(DomainErrorKind)) {
      expect(httpStatusFor(kind)).toBeLessThan(500);
    }
  });

  it('writes the stable code and message in the response body', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/tasks/1' }),
      }),
    } as unknown as ArgumentsHost;

    new DomainExceptionFilter().catch(new SampleError(DomainErrorKind.CONFLICT), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, code: 'SAMPLE_CODE', message: 'sample message', path: '/tasks/1' }),
    );
  });
});
