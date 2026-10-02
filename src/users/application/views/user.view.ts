import { User } from '../../domain/entities/user';

/**
 * Modelo de lectura público del contexto Users.
 * Construido campo a campo: el hash de contraseña NUNCA forma parte de la vista.
 */
export interface UserView {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function toUserView(user: User): UserView {
  return {
    id: user.id.value,
    name: user.name.value,
    email: user.email.value,
    status: user.status.value,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
