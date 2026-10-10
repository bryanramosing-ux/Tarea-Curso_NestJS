import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { EnvironmentVariables } from './config/env.validation';
import { DomainExceptionFilter } from './shared/infrastructure/http/domain-exception.filter';
import { HttpExceptionFilter } from './shared/infrastructure/http/http-exception.filter';
import { UnhandledExceptionFilter } from './shared/infrastructure/http/unhandled-exception.filter';
import { createValidationPipe } from './shared/infrastructure/http/validation.pipe';

/** Configuración HTTP común a main.ts y a las pruebas e2e (mismo comportamiento). */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  if (config.get('TRUST_PROXY', { infer: true })) {
    // La IP del cliente (límite de peticiones) sale de X-Forwarded-For, que pone el proxy.
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  // Cabeceras de seguridad (nosniff, frameguard, HSTS...) y sin "X-Powered-By".
  app.use(helmet());
  app.useGlobalPipes(createValidationPipe());
  // Nest prueba los filtros globales del ÚLTIMO al primero: el de "todo lo demás"
  // va primero para que solo actúe si ninguno específico coincide. Los errores
  // de negocio los traduce SOLO DomainExceptionFilter.
  app.useGlobalFilters(new UnhandledExceptionFilter(), new HttpExceptionFilter(), new DomainExceptionFilter());
  app.enableShutdownHooks();
  return app;
}
