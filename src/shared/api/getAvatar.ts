import type { Credentials } from '../../app/model';
import { GREEN_API_BASE_URL } from '../config/environment';
import { GreenApiError } from './greenApiError';

interface GetAvatarParams {
  credentials: Credentials;
  chatId: string;
  apiUrl?: string;
  signal?: AbortSignal;
}

const AVATAR_REQUEST_INTERVAL_MS = 125;
const AVATAR_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AVATAR_QUOTA_BLOCK_TTL_MS = 60 * 60 * 1000;
const AVATAR_CACHE_PREFIX = 'green-api-max:avatar:';
const AVATAR_QUOTA_BLOCK_PREFIX = 'green-api-max:avatar-quota:';

interface AvatarCacheEntry {
  avatarUrl: string | null;
  expiresAt: number;
}

interface AvatarCacheResult {
  found: boolean;
  avatarUrl: string | null;
}

interface AvatarRateLimitState {
  lastStartedAt: number;
  tail: Promise<void>;
}

const avatarRateLimits = new Map<string, AvatarRateLimitState>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function getAvatarCacheKey(idInstance: string, chatId: string): string {
  return `${AVATAR_CACHE_PREFIX}${encodeURIComponent(idInstance)}:${encodeURIComponent(chatId)}`;
}

function readCachedAvatar(idInstance: string, chatId: string): AvatarCacheResult {
  const storage = getSessionStorage();

  if (!storage) {
    return { found: false, avatarUrl: null };
  }

  const key = getAvatarCacheKey(idInstance, chatId);

  try {
    const rawEntry = storage.getItem(key);

    if (!rawEntry) {
      return { found: false, avatarUrl: null };
    }

    const entry: unknown = JSON.parse(rawEntry);

    if (
      !isRecord(entry) ||
      (entry.avatarUrl !== null && typeof entry.avatarUrl !== 'string') ||
      typeof entry.expiresAt !== 'number' ||
      entry.expiresAt <= Date.now()
    ) {
      storage.removeItem(key);
      return { found: false, avatarUrl: null };
    }

    return { found: true, avatarUrl: entry.avatarUrl };
  } catch {
    storage.removeItem(key);
    return { found: false, avatarUrl: null };
  }
}

function cacheAvatar(idInstance: string, chatId: string, avatarUrl: string | null) {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  const entry: AvatarCacheEntry = {
    avatarUrl,
    expiresAt: Date.now() + AVATAR_CACHE_TTL_MS,
  };

  try {
    storage.setItem(getAvatarCacheKey(idInstance, chatId), JSON.stringify(entry));
  } catch {
    // Avatar caching is an optimization and must not break chat loading.
  }
}

function getAvatarQuotaBlockKey(idInstance: string): string {
  return `${AVATAR_QUOTA_BLOCK_PREFIX}${encodeURIComponent(idInstance)}`;
}

function isAvatarQuotaBlocked(idInstance: string): boolean {
  const storage = getSessionStorage();

  if (!storage) {
    return false;
  }

  const key = getAvatarQuotaBlockKey(idInstance);

  try {
    const expiresAt = Number(storage.getItem(key));

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      storage.removeItem(key);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function blockAvatarRequests(idInstance: string) {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      getAvatarQuotaBlockKey(idInstance),
      String(Date.now() + AVATAR_QUOTA_BLOCK_TTL_MS),
    );
  } catch {
    // Quota caching is an optimization and must not break chat loading.
  }
}

function createAvatarQuotaError(): GreenApiError {
  return new GreenApiError({
    code: 'get-avatar-failed',
    message: 'Исчерпан лимит запросов аватаров GREEN-API.',
    retryable: false,
    httpStatus: 466,
  });
}

function isAvatarMethodQuotaExceeded(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.invokeStatus)) {
    return false;
  }

  return (
    String(value.invokeStatus.method).toLowerCase() === 'getavatar' &&
    value.invokeStatus.status === 'QUOTE_EXCEEDED'
  );
}

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

async function waitForAvatarRequestSlot(
  key: string,
  signal?: AbortSignal,
): Promise<void> {
  const rateLimit = avatarRateLimits.get(key) ?? {
    lastStartedAt: 0,
    tail: Promise.resolve(),
  };
  avatarRateLimits.set(key, rateLimit);

  const previousRequest = rateLimit.tail;
  let releaseRequest: () => void = () => undefined;
  rateLimit.tail = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });

  await previousRequest;

  try {
    const remainingDelay = Math.max(
      0,
      rateLimit.lastStartedAt + AVATAR_REQUEST_INTERVAL_MS - Date.now(),
    );
    await wait(remainingDelay, signal);
    rateLimit.lastStartedAt = Date.now();
  } finally {
    releaseRequest();
  }
}

function createAvatarError(response: Response): GreenApiError {
  if (response.status === 401 || response.status === 403) {
    return new GreenApiError({
      code: 'invalid-credentials',
      message: 'Не удалось загрузить аватар. Проверьте параметры инстанса.',
      retryable: false,
      httpStatus: response.status,
    });
  }

  if (response.status === 466) {
    return createAvatarQuotaError();
  }

  return new GreenApiError({
    code: 'get-avatar-failed',
    message: 'Не удалось загрузить аватар.',
    retryable: response.status === 429 || response.status >= 500,
    httpStatus: response.status,
  });
}

export async function getAvatar({
  credentials,
  chatId,
  apiUrl = GREEN_API_BASE_URL,
  signal,
}: GetAvatarParams): Promise<string | null> {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const cachedAvatar = readCachedAvatar(credentials.idInstance, chatId);

  if (cachedAvatar.found) {
    return cachedAvatar.avatarUrl;
  }

  if (isAvatarQuotaBlocked(credentials.idInstance)) {
    throw createAvatarQuotaError();
  }

  await waitForAvatarRequestSlot(`${baseUrl}|${credentials.idInstance}`, signal);

  const queuedCachedAvatar = readCachedAvatar(credentials.idInstance, chatId);

  if (queuedCachedAvatar.found) {
    return queuedCachedAvatar.avatarUrl;
  }

  if (isAvatarQuotaBlocked(credentials.idInstance)) {
    throw createAvatarQuotaError();
  }

  const path = [
    `waInstance${encodeURIComponent(credentials.idInstance)}`,
    'getAvatar',
    encodeURIComponent(credentials.apiTokenInstance),
  ].join('/');

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new GreenApiError({
      code: 'network-error',
      message: 'Нет соединения с GREEN-API. Не удалось загрузить аватар.',
      retryable: true,
    });
  }

  if (!response.ok) {
    if (response.status === 466) {
      let errorBody: unknown;

      try {
        errorBody = await response.clone().json();
      } catch {
        errorBody = null;
      }

      if (isAvatarMethodQuotaExceeded(errorBody)) {
        blockAvatarRequests(credentials.idInstance);
      }
    }

    throw createAvatarError(response);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!isRecord(body) || typeof body.urlAvatar !== 'string') {
    throw new GreenApiError({
      code: 'unexpected-response',
      message: 'GREEN-API вернул неожиданный ответ при загрузке аватара.',
      retryable: true,
      httpStatus: response.status,
    });
  }

  const avatarUrl = body.urlAvatar.trim();

  if (!avatarUrl) {
    cacheAvatar(credentials.idInstance, chatId, null);
    return null;
  }

  try {
    const parsedUrl = new URL(avatarUrl);

    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Unsupported avatar protocol');
    }
  } catch {
    throw new GreenApiError({
      code: 'unexpected-response',
      message: 'GREEN-API вернул некорректную ссылку на аватар.',
      retryable: true,
      httpStatus: response.status,
    });
  }

  cacheAvatar(credentials.idInstance, chatId, avatarUrl);
  return avatarUrl;
}
