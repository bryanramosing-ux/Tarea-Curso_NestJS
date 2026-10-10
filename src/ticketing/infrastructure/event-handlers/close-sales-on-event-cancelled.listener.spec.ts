import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { EventCancelled } from '../../../catalog/domain/events/event-cancelled.event';
import { CLOSE_SALES_LISTENER_ATTEMPTS, CloseSalesOnEventCancelledListener } from './close-sales-on-event-cancelled.listener';

describe('CloseSalesOnEventCancelledListener (RN-014)', () => {
  const event = new EventCancelled('7c9e6679-7425-40de-944b-e07fc1f90ae7', new Date('2030-01-01T10:00:00Z'));

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('retries a failed close and stops as soon as it succeeds', async () => {
    const execute = jest
      .fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ refundedTicketIds: ['a'] });
    const listener = new CloseSalesOnEventCancelledListener({ execute } as unknown as CommandBus);

    const done = listener.handle(event);
    await jest.runAllTimersAsync();
    await done;

    expect(execute).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it(`gives up after ${CLOSE_SALES_LISTENER_ATTEMPTS} attempts, logs it and never throws`, async () => {
    const execute = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const listener = new CloseSalesOnEventCancelledListener({ execute } as unknown as CommandBus);

    const done = listener.handle(event);
    await jest.runAllTimersAsync();
    await expect(done).resolves.toBeUndefined();

    expect(execute).toHaveBeenCalledTimes(CLOSE_SALES_LISTENER_ATTEMPTS);
    expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('reconciliation'));
  });
});
