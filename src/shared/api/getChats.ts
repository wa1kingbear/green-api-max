import type { Credentials } from '../../app/model';
import { GREEN_API_BASE_URL } from '../config/environment';
import { GreenApiError } from './greenApiError';

export type GreenApiChatType = 'user' | 'group' | 'channel' | 'bot';

export interface GreenApiChat {
  chatId: string;
  name: string;
  type: GreenApiChatType;
  phoneNumber: string;
}

interface GetChatsParams {
  credentials: Credentials;
  apiUrl?: string;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseChat(value: unknown): GreenApiChat | null {
  if (
    !isRecord(value) ||
    typeof value.chatId !== 'string' ||
    !value.chatId ||
    typeof value.name !== 'string' ||
    !['user', 'group', 'channel', 'bot'].includes(String(value.type)) ||
    (typeof value.phoneNumber !== 'number' && typeof value.phoneNumber !== 'string')
  ) {
    return null;
  }

  return {
    chatId: value.chatId,
    name: value.name,
    type: value.type as GreenApiChatType,
    phoneNumber:
      typeof value.phoneNumber === 'number'
        ? value.phoneNumber > 0
          ? String(value.phoneNumber)
          : ''
        : value.phoneNumber,
  };
}

function createGetChatsError(response: Response): GreenApiError {
  if (response.status === 401 || response.status === 403) {
    return new GreenApiError({
      code: 'invalid-credentials',
      message: 'Не удалось загрузить чаты. Проверьте параметры инстанса.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  return new GreenApiError({
    code: 'get-chats-failed',
    message: 'Не удалось загрузить список чатов. Попробуйте ещё раз.',
    retryable: response.status >= 500,
    httpStatus: response.status,
  });
}

export async function getChats({
  credentials,
  apiUrl = GREEN_API_BASE_URL,
  signal,
}: GetChatsParams): Promise<GreenApiChat[]> {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const path = [
    `waInstance${encodeURIComponent(credentials.idInstance)}`,
    'getChats',
    encodeURIComponent(credentials.apiTokenInstance),
  ].join('/');

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/${path}`, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new GreenApiError({
      code: 'network-error',
      message: 'Нет соединения с GREEN-API. Не удалось загрузить чаты.',
      retryable: true,
    });
  }

  if (!response.ok) {
    throw createGetChatsError(response);
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
      message: 'GREEN-API вернул неожиданный список чатов.',
      retryable: true,
      httpStatus: response.status,
    });
  }

  return body.map(parseChat).filter((chat): chat is GreenApiChat => chat !== null);
}
