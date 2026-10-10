import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CLOCK } from './domain/ports/clock.port';
import { DOMAIN_EVENT_PUBLISHER } from './domain/ports/domain-event-publisher.port';
import { ID_GENERATOR } from './domain/ports/id-generator.port';
import { UNIT_OF_WORK } from './domain/ports/unit-of-work.port';
import { NestDomainEventPublisher } from './infrastructure/events/nest-domain-event-publisher';
import { CryptoIdGenerator } from './infrastructure/ids/crypto-id-generator';
import { TypeOrmTransactionContext } from './infrastructure/persistence/typeorm-transaction-context';
import { TypeOrmUnitOfWork } from './infrastructure/persistence/typeorm-unit-of-work';
import { SystemClock } from './infrastructure/time/system-clock';

/**
 * Adaptadores de los puertos compartidos por todos los contextos (reloj,
 * identificadores, transacciones y publicación de eventos). Aquí, y solo
 * aquí, se elige la implementación concreta de cada uno.
 */
@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    TypeOrmTransactionContext,
    { provide: DOMAIN_EVENT_PUBLISHER, useClass: NestDomainEventPublisher },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
  ],
  exports: [TypeOrmTransactionContext, DOMAIN_EVENT_PUBLISHER, CLOCK, ID_GENERATOR, UNIT_OF_WORK],
})
export class SharedModule {}
