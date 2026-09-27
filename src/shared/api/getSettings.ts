import type { Credentials } from '../../app/model';
import { GREEN_API_BASE_URL } from '../config/environment';
import { GreenApiError } from './greenApiError';

export interface InstanceSettings {
  incomingWebhook: 'yes' | 'no';
  webhookUrl: string;
}

interface GetSettingsParams {
  credentials: Credentials;
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

function parseSettings(value: unknown): InstanceSettings | null {
  if (
    !isRecord(value) ||
    (value.incomingWebhook !== 'yes' && value.incomingWebhook !== 'no') ||
    typeof value.webhookUrl !== 'string'
  ) {
    return null;
  }

  return {
    incomingWebhook: value.incomingWebhook,
    webhookUrl: value.webhookUrl,
  };
}

function parseReason(value: unknown): string {
  return isRecord(value) && typeof value.reason === 'string' ? value.reason : '';
}

function createSettingsError(response: Response, body: unknown): GreenApiError {
  const reason = parseReason(body).toLowerCase();

  if (response.status === 401 || response.status === 403) {
    return new GreenApiError({
      code: 'invalid-credentials',
      message: 'Не удалось подключиться. Проверьте параметры инстанса.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  if (reason.includes('not authorized')) {
    return new GreenApiError({
      code: 'instance-not-authorized',
      message: 'Авторизуйте инстанс в MAX через личный кабинет GREEN-API.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  return new GreenApiError({
    code: 'get-settings-failed',
    message: 'Не удалось проверить настройки инстанса. Попробуйте ещё раз.',
    retryable: response.status >= 500 || response.status === 429,
    httpStatus: response.status,
  });
}

export async function getSettings({
  credentials,
  apiUrl = GREEN_API_BASE_URL,
  signal,
}: GetSettingsParams): Promise<InstanceSettings> {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const path = [
    `waInstance${encodeURIComponent(credentials.idInstance)}`,
    'getSettings',
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
      message: 'Нет соединения с GREEN-API. Проверьте сеть и повторите попытку.',
      retryable: true,
    });
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw createSettingsError(response, body);
  }

  if (isRecord(body) && body.status === false) {
    throw createSettingsError(response, body);
  }

  const settings = parseSettings(body);

  if (!settings) {
    throw new GreenApiError({
      code: 'unexpected-response',
      message: 'GREEN-API вернул неожиданный ответ при проверке настроек.',
      retryable: true,
      httpStatus: response.status,
    });
  }

  return settings;
}
