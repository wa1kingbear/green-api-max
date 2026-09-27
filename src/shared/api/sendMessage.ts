import type { Credentials } from '../../app/model';
import { GREEN_API_BASE_URL } from '../config/environment';
import { GreenApiError } from './greenApiError';

export interface SendMessageResult {
  idMessage: string;
}

interface SendMessageParams {
  credentials: Credentials;
  chatId: string;
  message: string;
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

function createSendError(response: Response): GreenApiError {
  if (response.status === 400) {
    return new GreenApiError({
      code: 'message-too-long',
      message: 'Сообщение не должно превышать 4000 символов.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  if (response.status === 401) {
    return new GreenApiError({
      code: 'invalid-credentials',
      message: 'Не удалось отправить сообщение. Проверьте параметры инстанса.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  if (response.status === 403) {
    return new GreenApiError({
      code: 'send-message-failed',
      message: 'Отправка сообщений временно ограничена для этого инстанса.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  return new GreenApiError({
    code: 'send-message-failed',
    message: 'Не удалось отправить сообщение.',
    retryable: response.status >= 500,
    httpStatus: response.status,
  });
}

export async function sendMessage({
  credentials,
  chatId,
  message,
  apiUrl = GREEN_API_BASE_URL,
  signal,
}: SendMessageParams): Promise<SendMessageResult> {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const path = [
    `waInstance${encodeURIComponent(credentials.idInstance)}`,
    'sendMessage',
    encodeURIComponent(credentials.apiTokenInstance),
  ].join('/');

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chatId, message }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new GreenApiError({
      code: 'network-error',
      message: 'Нет соединения с GREEN-API. Сообщение не отправлено.',
      retryable: true,
    });
  }

  const body: unknown = await readJson(response);

  if (!response.ok) {
    throw createSendError(response);
  }

  if (!isRecord(body) || typeof body.idMessage !== 'string' || !body.idMessage) {
    throw new GreenApiError({
      code: 'unexpected-response',
      message: 'GREEN-API не вернул идентификатор сообщения.',
      retryable: true,
      httpStatus: response.status,
    });
  }

  return { idMessage: body.idMessage };
}
