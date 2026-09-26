import type { Credentials } from '../../app/model';
import { GREEN_API_BASE_URL } from '../config/environment';
import { GreenApiError } from './greenApiError';

interface DeleteNotificationParams {
  credentials: Credentials;
  receiptId: number;
  apiUrl?: string;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function deleteNotification({
  credentials,
  receiptId,
  apiUrl = GREEN_API_BASE_URL,
  signal,
}: DeleteNotificationParams): Promise<void> {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const path = [
    `waInstance${encodeURIComponent(credentials.idInstance)}`,
    'deleteNotification',
    encodeURIComponent(credentials.apiTokenInstance),
    encodeURIComponent(String(receiptId)),
  ].join('/');

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/${path}`, {
      method: 'DELETE',
      signal,
    });
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

  const body = await readJson(response);

  if (!response.ok) {
    throw new GreenApiError({
      code: 'delete-notification-failed',
      message: 'Соединение потеряно. Пытаемся восстановить…',
      retryable: response.status >= 500,
      httpStatus: response.status,
    });
  }

  if (!isRecord(body) || typeof body.result !== 'boolean') {
    throw new GreenApiError({
      code: 'unexpected-response',
      message: 'GREEN-API не подтвердил обработку уведомления.',
      retryable: true,
      httpStatus: response.status,
    });
  }
}
