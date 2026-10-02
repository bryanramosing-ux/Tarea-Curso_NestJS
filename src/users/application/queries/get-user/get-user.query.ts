import { Query } from '@nestjs/cqrs';
import { UserView } from '../../views/user.view';

/** Caso de uso de lectura: consultar un miembro por id. */
export class GetUserQuery extends Query<UserView> {
  constructor(public readonly userId: string) {
    super();
  }
}
