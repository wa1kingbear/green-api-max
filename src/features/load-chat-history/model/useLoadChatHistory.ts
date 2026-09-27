import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppError } from '../../../app/model';
import {
  useActiveChat,
  useAppDispatch,
  useConversationState,
  useSessionState,
} from '../../../app/useApp';
import { getChatHistoryPage } from '../../../shared/api/getChatHistory';
import { isGreenApiError } from '../../../shared/api/greenApiError';

const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_COUNT = 5_000;

interface HistoryPaginationState {
  chatId: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
}

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
  const dispatch = useAppDispatch();
  const { credentials } = useSessionState();
  const activeChat = useActiveChat();
  const { historyStatus } = useConversationState();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pagination, setPagination] = useState<HistoryPaginationState>({
    chatId: null,
    hasMore: false,
    isLoadingMore: false,
    loadMoreFailed: false,
  });
  const loadedCountRef = useRef(HISTORY_PAGE_SIZE);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const reloadHistory = useCallback(() => setReloadVersion((value) => value + 1), []);

  useEffect(() => {
    const chatId = activeChat?.chatId;

    if (!credentials || !chatId) {
      return undefined;
    }

    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    loadedCountRef.current = HISTORY_PAGE_SIZE;
    dispatch({ type: 'history-loading', payload: { chatId } });

    void getChatHistoryPage({
      credentials,
      chatId,
      count: HISTORY_PAGE_SIZE,
      signal: controller.signal,
    })
      .then((page) => {
        if (!controller.signal.aborted) {
          dispatch({
            type: 'history-loaded',
            payload: { chatId, messages: page.messages },
          });
          setPagination({
            chatId,
            hasMore: page.hasMore && HISTORY_PAGE_SIZE < HISTORY_MAX_COUNT,
            isLoadingMore: false,
            loadMoreFailed: false,
          });
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

    return () => {
      controller.abort();
      loadMoreControllerRef.current?.abort();
    };
  }, [activeChat?.chatId, credentials, dispatch, reloadVersion]);

  const loadMoreHistory = useCallback(() => {
    const chatId = activeChat?.chatId;

    if (
      !credentials ||
      !chatId ||
      pagination.chatId !== chatId ||
      !pagination.hasMore ||
      pagination.isLoadingMore
    ) {
      return;
    }

    const controller = new AbortController();
    const nextCount = Math.min(loadedCountRef.current * 2, HISTORY_MAX_COUNT);
    loadMoreControllerRef.current = controller;
    setPagination((current) => ({
      ...current,
      isLoadingMore: true,
      loadMoreFailed: false,
    }));

    void getChatHistoryPage({
      credentials,
      chatId,
      count: nextCount,
      signal: controller.signal,
    })
      .then((page) => {
        if (controller.signal.aborted) {
          return;
        }

        loadedCountRef.current = nextCount;
        dispatch({
          type: 'history-loaded',
          payload: { chatId, messages: page.messages },
        });
        setPagination({
          chatId,
          hasMore: page.hasMore && nextCount < HISTORY_MAX_COUNT,
          isLoadingMore: false,
          loadMoreFailed: false,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }

        setPagination((current) =>
          current.chatId === chatId
            ? {
                ...current,
                isLoadingMore: false,
                loadMoreFailed: true,
              }
            : current,
        );
      });
  }, [activeChat?.chatId, credentials, dispatch, pagination]);

  const activePagination =
    pagination.chatId === activeChat?.chatId && historyStatus === 'ready'
      ? pagination
      : {
          chatId: activeChat?.chatId ?? null,
          hasMore: false,
          isLoadingMore: false,
          loadMoreFailed: false,
        };

  return { ...activePagination, loadMoreHistory, reloadHistory };
}
