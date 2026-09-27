import { useCallback, useEffect, useState } from 'react';

import type { AppError } from '../../../app/model';
import { useApp } from '../../../app/useApp';
import { getChatHistory } from '../../../shared/api/getChatHistory';
import { isGreenApiError } from '../../../shared/api/greenApiError';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function normalizeError(error: unknown): AppError {
  if (isGreenApiError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      httpStatus: error.httpStatus,
    };
  }

  return {
    code: 'get-chat-history-failed',
    message: 'Не удалось загрузить историю переписки. Попробуйте ещё раз.',
    retryable: true,
  };
}

export function useLoadChatHistory() {
  const { state, dispatch } = useApp();
  const [reloadVersion, setReloadVersion] = useState(0);
  const reloadHistory = useCallback(
    () => setReloadVersion((value) => value + 1),
    [],
  );

  useEffect(() => {
    const credentials = state.credentials;
    const chatId = state.activeChat?.chatId;

    if (!credentials || !chatId) {
      return undefined;
    }

    const controller = new AbortController();
    dispatch({ type: 'history-loading', payload: { chatId } });

    void getChatHistory({ credentials, chatId, signal: controller.signal })
      .then((messages) => {
        if (!controller.signal.aborted) {
          dispatch({ type: 'history-loaded', payload: { chatId, messages } });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          dispatch({
            type: 'history-failed',
            payload: { chatId, error: normalizeError(error) },
          });
        }
      });

    return () => controller.abort();
  }, [dispatch, reloadVersion, state.activeChat?.chatId, state.credentials]);

  return { reloadHistory };
}
