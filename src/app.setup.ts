import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { DomainExceptionFilter } from './shared/infrastructure/http/domain-exception.filter';
import { HttpExceptionFilter } from './shared/infrastructure/http/http-exception.filter';
import { createValidationPipe } from './shared/infrastructure/http/validation.pipe';

/** Configuración HTTP común a main.ts y a las pruebas e2e (mismo comportamiento). */
export function configureApp(app: INestApplication): INestApplication {
  // Cabeceras de seguridad (nosniff, frameguard, HSTS...) y sin "X-Powered-By".
  app.use(helmet());
  app.useGlobalPipes(createValidationPipe());
  // Tipos disjuntos: los errores de negocio los traduce SOLO DomainExceptionFilter.
  app.useGlobalFilters(new HttpExceptionFilter(), new DomainExceptionFilter());
  app.enableShutdownHooks();
  return app;
}
