import type { Credentials, Message } from '../../app/model';
import { GREEN_API_BASE_URL } from '../config/environment';
import { GreenApiError } from './greenApiError';

interface GetChatHistoryParams {
  credentials: Credentials;
  chatId: string;
  count?: number;
  apiUrl?: string;
  signal?: AbortSignal;
}

export interface ChatHistoryPage {
  messages: Message[];
  hasMore: boolean;
}

const HISTORY_REQUEST_INTERVAL_MS = 1_250;

interface HistoryRateLimitState {
  lastStartedAt: number;
  tail: Promise<void>;
}

const historyRateLimits = new Map<string, HistoryRateLimitState>();

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, milliseconds);

    function handleAbort() {
      clearTimeout(timeoutId);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    }

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

async function waitForHistoryRequestSlot(
  key: string,
  signal?: AbortSignal,
): Promise<void> {
  const rateLimit = historyRateLimits.get(key) ?? {
    lastStartedAt: 0,
    tail: Promise.resolve(),
  };
  historyRateLimits.set(key, rateLimit);

  const previousRequest = rateLimit.tail;
  let releaseRequest: () => void = () => undefined;
  rateLimit.tail = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });

  await previousRequest;

  try {
    const remainingDelay = Math.max(
      0,
      rateLimit.lastStartedAt + HISTORY_REQUEST_INTERVAL_MS - Date.now(),
    );
    await wait(remainingDelay, signal);
    rateLimit.lastStartedAt = Date.now();
  } finally {
    releaseRequest();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseHistoryMessage(value: unknown): Message | null {
  if (
    !isRecord(value) ||
    (value.type !== 'incoming' && value.type !== 'outgoing') ||
    typeof value.idMessage !== 'string' ||
    !value.idMessage ||
    typeof value.chatId !== 'string' ||
    !value.chatId ||
    typeof value.timestamp !== 'number' ||
    !Number.isFinite(value.timestamp) ||
    typeof value.textMessage !== 'string' ||
    !value.textMessage
  ) {
    return null;
  }

  return {
    id: value.idMessage,
    chatId: value.chatId,
    direction: value.type,
    text: value.textMessage,
    timestamp: value.timestamp * 1000,
    status: value.statusMessage === 'failed' ? 'failed' : 'sent',
  };
}

function createHistoryError(response: Response): GreenApiError {
  if (response.status === 401 || response.status === 403) {
    return new GreenApiError({
      code: 'invalid-credentials',
      message: 'Не удалось загрузить переписку. Проверьте параметры инстанса.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  return new GreenApiError({
    code: 'get-chat-history-failed',
    message: 'Не удалось загрузить историю переписки. Попробуйте ещё раз.',
    retryable: response.status >= 500,
    httpStatus: response.status,
  });
}

export async function getChatHistoryPage({
  credentials,
  chatId,
  count = 100,
  apiUrl = GREEN_API_BASE_URL,
  signal,
}: GetChatHistoryParams): Promise<ChatHistoryPage> {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  await waitForHistoryRequestSlot(`${baseUrl}|${credentials.idInstance}`, signal);

  const path = [
    `waInstance${encodeURIComponent(credentials.idInstance)}`,
    'getChatHistory',
    encodeURIComponent(credentials.apiTokenInstance),
  ].join('/');

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, count }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new GreenApiError({
      code: 'network-error',
      message: 'Нет соединения с GREEN-API. Не удалось загрузить переписку.',
      retryable: true,
    });
  }

  if (!response.ok) {
    throw createHistoryError(response);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!Array.isArray(body)) {
    throw new GreenApiError({
      code: 'unexpected-response',
      message: 'GREEN-API вернул неожиданную историю переписки.',
      retryable: true,
      httpStatus: response.status,
    });
  }

  return {
    messages: body
      .map(parseHistoryMessage)
      .filter((message): message is Message => message !== null)
      .sort((first, second) => first.timestamp - second.timestamp),
    hasMore: body.length >= count,
  };
}

export async function getChatHistory(
  params: GetChatHistoryParams,
): Promise<Message[]> {
  const page = await getChatHistoryPage(params);
  return page.messages;
}
