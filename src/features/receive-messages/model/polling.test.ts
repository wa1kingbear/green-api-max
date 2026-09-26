import { GreenApiError } from '../../../shared/api/greenApiError';
import { getPollingBackoff, runPolling, startPollingSession } from './polling';

describe('polling', () => {
  it('uses the 1, 2 and 5 second backoff sequence', () => {
    expect([0, 1, 2, 3, 10].map(getPollingBackoff)).toEqual([
      1_000, 2_000, 5_000, 5_000, 5_000,
    ]);
  });

  it('processes and deletes a notification before receiving the next one', async () => {
    const controller = new AbortController();
    const order: string[] = [];
    let receiveCount = 0;

    await runPolling({
      signal: controller.signal,
      receive: async () => {
        receiveCount += 1;
        order.push(`receive-${receiveCount}`);

        if (receiveCount === 1) {
          return { receiptId: 42, body: { event: 'message' } };
        }

        controller.abort();
        return null;
      },
      remove: async (receiptId) => {
        order.push(`delete-${receiptId}`);
      },
      onNotification: () => order.push('process'),
      onDegraded: () => order.push('degraded'),
      onRecovered: () => order.push('recovered'),
    });

    expect(order).toEqual([
      'receive-1',
      'process',
      'delete-42',
      'recovered',
      'receive-2',
    ]);
  });

  it('backs off after temporary errors and stops when aborted', async () => {
    const controller = new AbortController();
    const delays: number[] = [];
    const errors: string[] = [];
    let attempts = 0;

    await runPolling({
      signal: controller.signal,
      receive: async () => {
        attempts += 1;

        if (attempts === 4) {
          controller.abort();
          return null;
        }

        throw new GreenApiError({
          code: 'network-error',
          message: 'Нет сети',
          retryable: true,
        });
      },
      remove: async () => undefined,
      onNotification: () => undefined,
      onDegraded: (error) => errors.push(error.code),
      onRecovered: () => undefined,
      wait: async (delay) => {
        delays.push(delay);
      },
    });

    expect(errors).toEqual(['network-error', 'network-error', 'network-error']);
    expect(delays).toEqual([1_000, 2_000, 5_000]);
  });

  it('resets the backoff after a successful long poll', async () => {
    const controller = new AbortController();
    const delays: number[] = [];
    let attempts = 0;

    await runPolling({
      signal: controller.signal,
      receive: async () => {
        attempts += 1;

        if (attempts === 1 || attempts === 3) {
          throw new Error('temporary failure');
        }

        if (attempts === 4) {
          controller.abort();
        }

        return null;
      },
      remove: async () => undefined,
      onNotification: () => undefined,
      onDegraded: () => undefined,
      onRecovered: () => undefined,
      wait: async (delay) => {
        delays.push(delay);
      },
      now: (() => {
        let time = 0;

        return () => {
          time += 10_000;
          return time;
        };
      })(),
    });

    expect(delays).toEqual([1_000, 1_000]);
  });

  it('prevents a hot loop when an empty response returns immediately', async () => {
    const controller = new AbortController();
    const delays: number[] = [];
    let attempts = 0;

    await runPolling({
      signal: controller.signal,
      receive: async () => {
        attempts += 1;

        if (attempts === 2) {
          controller.abort();
        }

        return null;
      },
      remove: async () => undefined,
      onNotification: () => undefined,
      onDegraded: () => undefined,
      onRecovered: () => undefined,
      wait: async (delay) => {
        delays.push(delay);
      },
      now: () => 100,
    });

    expect(attempts).toBe(2);
    expect(delays).toEqual([10_000]);
  });

  it('fully stops the previous session before starting a replacement', async () => {
    const events: string[] = [];
    const stopFirst = startPollingSession(
      (signal) =>
        new Promise((resolve) => {
          events.push('first-start');
          signal.addEventListener(
            'abort',
            () => {
              events.push('first-abort');
              queueMicrotask(() => {
                events.push('first-stop');
                resolve();
              });
            },
            { once: true },
          );
        }),
    );

    await Promise.resolve();

    const stopSecond = startPollingSession(async () => {
      events.push('second-start');
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(events).toEqual([
      'first-start',
      'first-abort',
      'first-stop',
      'second-start',
    ]);

    stopFirst();
    stopSecond();
  });
});
