import { Query } from '@nestjs/cqrs';
import { TaskView } from '../../views/task.view';

/** Caso de uso de lectura: detalle de una tarea. */
export class GetTaskQuery extends Query<TaskView> {
  constructor(public readonly taskId: string) {
    super();
  }
}
