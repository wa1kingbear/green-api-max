import type { Credentials } from '../../app/model';
import { GREEN_API_BASE_URL } from '../config/environment';
import { GreenApiError } from './greenApiError';

export interface CheckAccountResult {
  exist: boolean;
  chatId: string;
  fromCache: boolean;
}

interface CheckAccountParams {
  credentials: Credentials;
  phoneNumber: string;
  apiUrl?: string;
  signal?: AbortSignal;
}

interface ErrorResponse {
  status?: boolean;
  reason?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCheckAccountResult(value: unknown): CheckAccountResult | null {
  if (
    !isRecord(value) ||
    typeof value.exist !== 'boolean' ||
    typeof value.chatId !== 'string' ||
    typeof value.fromCache !== 'boolean'
  ) {
    return null;
  }

  return {
    exist: value.exist,
    chatId: value.chatId,
    fromCache: value.fromCache,
  };
}

function parseErrorResponse(value: unknown): ErrorResponse {
  if (!isRecord(value)) {
    return {};
  }

  return {
    status: typeof value.status === 'boolean' ? value.status : undefined,
    reason: typeof value.reason === 'string' ? value.reason : undefined,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createApiError(response: Response, body: unknown): GreenApiError {
  const { reason } = parseErrorResponse(body);
  const normalizedReason = reason?.toLowerCase() ?? '';

  if (response.status === 401 || response.status === 403) {
    return new GreenApiError({
      code: 'invalid-credentials',
      message: 'Не удалось подключиться. Проверьте параметры инстанса.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  if (response.status === 469 || normalizedReason.includes('limit reached')) {
    return new GreenApiError({
      code: 'check-account-limit',
      message: 'Проверка номера временно недоступна. Повторите позднее.',
      retryable: true,
      httpStatus: response.status,
    });
  }

  if (response.status === 400) {
    return new GreenApiError({
      code: 'invalid-phone',
      message: 'Введите номер в международном формате.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  return new GreenApiError({
    code: 'unexpected-response',
    message: 'Не удалось проверить номер. Попробуйте ещё раз.',
    retryable: response.status >= 500,
    httpStatus: response.status,
  });
}

export async function checkAccount({
  credentials,
  phoneNumber,
  apiUrl = GREEN_API_BASE_URL,
  signal,
}: CheckAccountParams): Promise<CheckAccountResult> {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const path = [
    `waInstance${encodeURIComponent(credentials.idInstance)}`,
    'checkAccount',
    encodeURIComponent(credentials.apiTokenInstance),
  ].join('/');

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber: Number(phoneNumber) }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new GreenApiError({
      code: 'network-error',
      message: 'Нет соединения с GREEN-API. Проверьте сеть и повторите попытку.',
      retryable: true,
    });
  }

  const body: unknown = await readJson(response);

  if (!response.ok) {
    throw createApiError(response, body);
  }

  const apiError = parseErrorResponse(body);

  if (apiError.status === false) {
    const normalizedReason = apiError.reason?.toLowerCase() ?? '';
    const isUnauthorized = normalizedReason.includes('not authorized');
    const isLimitReached = normalizedReason.includes('limit reached');

    throw new GreenApiError({
      code: isUnauthorized
        ? 'instance-not-authorized'
        : isLimitReached
          ? 'check-account-limit'
          : 'unexpected-response',
      message: isUnauthorized
        ? 'Авторизуйте инстанс в MAX через личный кабинет GREEN-API.'
        : isLimitReached
          ? 'Проверка номера временно недоступна. Повторите позднее.'
          : 'Не удалось проверить номер. Попробуйте ещё раз.',
      retryable: !isUnauthorized,
      httpStatus: response.status,
    });
  }

  const result = parseCheckAccountResult(body);

  if (!result) {
    throw new GreenApiError({
      code: 'unexpected-response',
      message: 'GREEN-API вернул неожиданный ответ.',
      retryable: true,
      httpStatus: response.status,
    });
  }

  return result;
}
