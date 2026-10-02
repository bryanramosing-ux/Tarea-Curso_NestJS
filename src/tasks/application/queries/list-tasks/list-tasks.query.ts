import { Query } from '@nestjs/cqrs';
import { TaskView } from '../../views/task.view';

/** Caso de uso de lectura: ver el tablero, filtrable por columna y responsable. */
export class ListTasksQuery extends Query<TaskView[]> {
  constructor(
    public readonly status?: string,
    public readonly assigneeId?: string,
  ) {
    super();
  }
}
