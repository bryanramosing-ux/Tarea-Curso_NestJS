import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { DomainEvent } from '../../domain/domain-event';
import { DomainEventPublisher } from '../../domain/ports/domain-event-publisher.port';

/** Adaptador del puerto DomainEventPublisher sobre el EventBus de @nestjs/cqrs. */
@Injectable()
export class NestDomainEventPublisher implements DomainEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishAll(events: DomainEvent[]): Promise<void> {
    if (events.length > 0) {
      this.eventBus.publishAll(events);
    }
  }
}
