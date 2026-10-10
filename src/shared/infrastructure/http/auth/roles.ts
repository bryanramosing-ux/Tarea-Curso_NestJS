import { SetMetadata } from '@nestjs/common';

/**
 * Roles del personal. El público (compradores) no necesita credencial:
 * consulta la cartelera, la disponibilidad y compra.
 *  - ORGANIZER: programa y cancela eventos, consulta entradas y concilia ventas.
 *  - GATE: personal de puerta; valida entradas (check-in) y las consulta.
 */
export const Role = {
  ORGANIZER: 'ORGANIZER',
  GATE: 'GATE',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const REQUIRED_ROLES = 'auth:required-roles';

/** Marca una ruta como protegida: basta con tener UNO de los roles indicados. */
export const RequireRoles = (...roles: Role[]) => SetMetadata(REQUIRED_ROLES, roles);
