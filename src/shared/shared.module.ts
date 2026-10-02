import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER } from './domain/ports/domain-event-publisher.port';
import { NestDomainEventPublisher } from './infrastructure/events/nest-domain-event-publisher';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [{ provide: DOMAIN_EVENT_PUBLISHER, useClass: NestDomainEventPublisher }],
  exports: [DOMAIN_EVENT_PUBLISHER],
})
export class SharedModule {}
