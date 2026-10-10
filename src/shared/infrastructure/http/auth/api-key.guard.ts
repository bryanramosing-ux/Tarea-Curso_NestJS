import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Request, Response } from 'express';
import { EnvironmentVariables } from '../../../../config/env.validation';
import { REQUIRED_ROLES, Role } from './roles';

const BEARER = /^Bearer\s+(\S+)$/i;

/** Huella de longitud fija: permite comparar en tiempo constante claves de cualquier longitud. */
const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/**
 * Autenticación por clave de API (cabecera `Authorization: Bearer <clave>`)
 * para las rutas marcadas con @RequireRoles. Cada rol tiene su propia clave,
 * definida en la configuración (ORGANIZER_API_KEY, GATE_API_KEY).
 *  - sin clave o clave desconocida -> 401 UNAUTHORIZED;
 *  - clave válida pero de otro rol -> 403 FORBIDDEN.
 * La comparación es en tiempo constante y la clave nunca se registra.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly keys: { role: Role; digest: Buffer }[];

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.keys = [
      { role: Role.ORGANIZER, digest: digest(config.get('ORGANIZER_API_KEY', { infer: true })) },
      { role: Role.GATE, digest: digest(config.get('GATE_API_KEY', { infer: true })) },
    ];
  }

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const http = context.switchToHttp();
    const role = this.roleOf(http.getRequest<Request>().headers.authorization);
    if (!role) {
      http.getResponse<Response>().setHeader('WWW-Authenticate', 'Bearer');
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'A valid API key is required (Authorization: Bearer <key>)' });
    }
    if (!required.includes(role)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Your API key does not allow this operation' });
    }
    return true;
  }

  private roleOf(header: string | undefined): Role | null {
    const token = typeof header === 'string' ? BEARER.exec(header.trim())?.[1] : undefined;
    if (!token) {
      return null;
    }
    const candidate = digest(token);
    // Se comparan TODAS las claves (sin cortocircuito) para no filtrar por tiempos cuál coincide.
    let match: Role | null = null;
    for (const key of this.keys) {
      if (timingSafeEqual(candidate, key.digest)) {
        match = key.role;
      }
    }
    return match;
  }
}
