import type { Credentials } from '../../app/model';

export const SELECTED_INSTANCE_STORAGE_KEY = 'selectedInstance';

function isCredentials(value: unknown): value is Credentials {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.idInstance === 'string' &&
    /^\d+$/.test(candidate.idInstance) &&
    typeof candidate.apiTokenInstance === 'string' &&
    candidate.apiTokenInstance.length > 0
  );
}

export function loadSelectedInstance(): Credentials | null {
  try {
    const storedValue = window.localStorage.getItem(SELECTED_INSTANCE_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (!isCredentials(parsedValue)) {
      window.localStorage.removeItem(SELECTED_INSTANCE_STORAGE_KEY);
      return null;
    }

    return {
      idInstance: parsedValue.idInstance,
      apiTokenInstance: parsedValue.apiTokenInstance,
    };
  } catch {
    try {
      window.localStorage.removeItem(SELECTED_INSTANCE_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }

    return null;
  }
}

export function saveSelectedInstance(credentials: Credentials): void {
  try {
    window.localStorage.setItem(
      SELECTED_INSTANCE_STORAGE_KEY,
      JSON.stringify(credentials),
    );
  } catch {
    // The active session still works when persistent browser storage is unavailable.
  }
}

export function clearSelectedInstance(): void {
  try {
    window.localStorage.removeItem(SELECTED_INSTANCE_STORAGE_KEY);
  } catch {
    // There is nothing else to clear when browser storage is unavailable.
  }
}
