import type { Credentials } from '../../app/model';
import { GREEN_API_BASE_URL } from '../config/environment';
import { GreenApiError } from './greenApiError';

export interface ReceivedNotification {
  receiptId: number;
  body: unknown;
}

interface ReceiveNotificationParams {
  credentials: Credentials;
  apiUrl?: string;
  receiveTimeout?: number;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseErrorReason(value: unknown): string {
  return isRecord(value) && typeof value.reason === 'string' ? value.reason : '';
}

function createReceiveError(response: Response, body: unknown): GreenApiError {
  const reason = parseErrorReason(body).toLowerCase();

  if (reason.includes('custom webhook url is set')) {
    return new GreenApiError({
      code: 'webhook-conflict',
      message: 'Для HTTP API очистите webhookUrl в настройках инстанса.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  if (response.status === 401 || response.status === 403) {
    return new GreenApiError({
      code: 'invalid-credentials',
      message: 'Не удалось получать сообщения. Проверьте параметры инстанса.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  return new GreenApiError({
    code: 'receive-notification-failed',
    message: 'Соединение потеряно. Пытаемся восстановить…',
    retryable: response.status >= 500,
    httpStatus: response.status,
  });
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function receiveNotification({
  credentials,
  apiUrl = GREEN_API_BASE_URL,
  receiveTimeout = 10,
  signal,
}: ReceiveNotificationParams): Promise<ReceivedNotification | null> {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const path = [
    `waInstance${encodeURIComponent(credentials.idInstance)}`,
    'receiveNotification',
    encodeURIComponent(credentials.apiTokenInstance),
  ].join('/');
  const query = new URLSearchParams({ receiveTimeout: String(receiveTimeout) });

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/${path}?${query}`, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new GreenApiError({
      code: 'network-error',
      message: 'Соединение потеряно. Пытаемся восстановить…',
      retryable: true,
    });
  }

  const body = await readResponse(response);

  if (!response.ok) {
    throw createReceiveError(response, body);
  }

  if (body === null) {
    return null;
  }

  if (
    !isRecord(body) ||
    typeof body.receiptId !== 'number' ||
    !Number.isInteger(body.receiptId) ||
    !('body' in body)
  ) {
    throw new GreenApiError({
      code: 'unexpected-response',
      message: 'GREEN-API вернул неожиданный ответ при получении сообщений.',
      retryable: true,
      httpStatus: response.status,
    });
  }

  return {
    receiptId: body.receiptId,
    body: body.body,
  };
}
