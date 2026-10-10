import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';
import { REQUIRED_ROLES, Role } from './roles';

const ORGANIZER_KEY = 'organizer-key-for-unit-tests-0123456789abcdef';
const GATE_KEY = 'gate-key-for-unit-tests-0123456789abcdef-gate';

function contextFor(roles: Role[] | undefined, authorization?: string) {
  const handler = () => undefined;
  if (roles) {
    Reflect.defineMetadata(REQUIRED_ROLES, roles, handler);
  }
  const setHeader = jest.fn();
  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization === undefined ? {} : { authorization } }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
  return { context, setHeader };
}

describe('ApiKeyGuard', () => {
  const config = { get: (key: string) => ({ ORGANIZER_API_KEY: ORGANIZER_KEY, GATE_API_KEY: GATE_KEY })[key] };
  const guard = new ApiKeyGuard(new Reflector(), config as unknown as ConfigService<never, true>);

  it('lets public routes through without any key', () => {
    expect(guard.canActivate(contextFor(undefined).context)).toBe(true);
  });

  it('accepts the key of an allowed role', () => {
    expect(guard.canActivate(contextFor([Role.ORGANIZER], `Bearer ${ORGANIZER_KEY}`).context)).toBe(true);
    expect(guard.canActivate(contextFor([Role.GATE, Role.ORGANIZER], `bearer ${GATE_KEY}`).context)).toBe(true);
  });

  it.each([
    ['no header', undefined],
    ['an unknown key', 'Bearer not-a-real-key-0123456789abcdef0123456789'],
    ['the key without the Bearer scheme', ORGANIZER_KEY],
    ['an empty bearer', 'Bearer '],
  ])('answers 401 with WWW-Authenticate for %s', (_case, header) => {
    const { context, setHeader } = contextFor([Role.ORGANIZER], header);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer');
  });

  it('answers 403 when the key is valid but belongs to another role', () => {
    expect(() => guard.canActivate(contextFor([Role.ORGANIZER], `Bearer ${GATE_KEY}`).context)).toThrow(ForbiddenException);
  });

  it('never includes the received key in the error', () => {
    const { context } = contextFor([Role.ORGANIZER], 'Bearer leaked-secret-value-0123456789abcdef');
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('leaked-secret-value') }),
    );
  });
});
