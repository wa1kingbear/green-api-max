import type { AppError } from '../../../app/model';
import type { ReceivedNotification } from '../../../shared/api/receiveNotification';
import { isGreenApiError } from '../../../shared/api/greenApiError';

const POLLING_BACKOFF = [1_000, 2_000, 5_000] as const;
const MIN_EMPTY_POLL_DURATION = 10_000;

interface PollingOptions {
  signal: AbortSignal;
  receive: (signal: AbortSignal) => Promise<ReceivedNotification | null>;
  remove: (receiptId: number, signal: AbortSignal) => Promise<void>;
  onNotification: (body: unknown) => void;
  onDegraded: (error: AppError) => void;
  onRecovered: () => void;
  wait?: (delay: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
}

interface PollingSession {
  controller: AbortController;
  promise: Promise<void>;
}

let activeSession: PollingSession | null = null;

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AbortError')
  );
}

function normalizePollingError(error: unknown): AppError {
  if (isGreenApiError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      httpStatus: error.httpStatus,
    };
  }

  return {
    code: 'receive-notification-failed',
    message: 'Соединение потеряно. Пытаемся восстановить…',
    retryable: true,
  };
}

export function getPollingBackoff(failureCount: number): number {
  const index = Math.min(Math.max(failureCount, 0), POLLING_BACKOFF.length - 1);
  return POLLING_BACKOFF[index];
}

export function waitForPolling(delay: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, delay);

    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

export async function runPolling({
  signal,
  receive,
  remove,
  onNotification,
  onDegraded,
  onRecovered,
  wait = waitForPolling,
  now = Date.now,
}: PollingOptions): Promise<void> {
  let failureCount = 0;

  while (!signal.aborted) {
    try {
      const requestStartedAt = now();
      const notification = await receive(signal);

      if (signal.aborted) {
        return;
      }

      if (notification) {
        try {
          onNotification(notification.body);
        } finally {
          await remove(notification.receiptId, signal);
        }
      }

      if (signal.aborted) {
        return;
      }

      failureCount = 0;
      onRecovered();

      if (!notification) {
        const remainingDelay = MIN_EMPTY_POLL_DURATION - (now() - requestStartedAt);

        if (remainingDelay > 0) {
          await wait(remainingDelay, signal);
        }
      }
    } catch (error) {
      if (signal.aborted || isAbortError(error)) {
        return;
      }

      onDegraded(normalizePollingError(error));
      const delay = getPollingBackoff(failureCount);
      failureCount += 1;
      await wait(delay, signal);
    }
  }
}

export function startPollingSession(
  run: (signal: AbortSignal) => Promise<void>,
): () => void {
  const controller = new AbortController();
  const previousSession = activeSession;

  previousSession?.controller.abort();

  const promise = (async () => {
    if (previousSession) {
      await previousSession.promise.catch(() => undefined);
    }

    if (!controller.signal.aborted) {
      await run(controller.signal);
    }
  })();
  const session = { controller, promise };
  activeSession = session;

  const clearSession = () => {
    if (activeSession === session) {
      activeSession = null;
    }
  };

  void promise.then(clearSession, clearSession);

  return () => controller.abort();
}
