import { INestApplication } from '@nestjs/common';
import { DomainExceptionFilter } from './shared/infrastructure/http/domain-exception.filter';
import { createValidationPipe } from './shared/infrastructure/http/validation.pipe';

/** Configuración HTTP común a main.ts y a las pruebas e2e (mismo comportamiento). */
export function configureApp(app: INestApplication): INestApplication {
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableShutdownHooks();
  return app;
}
