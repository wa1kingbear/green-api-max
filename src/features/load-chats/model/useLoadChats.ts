import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppError, Chat, Credentials } from '../../../app/model';
import { useApp } from '../../../app/useApp';
import { getAvatar } from '../../../shared/api/getAvatar';
import { getChatHistory } from '../../../shared/api/getChatHistory';
import { getChats } from '../../../shared/api/getChats';
import { isGreenApiError } from '../../../shared/api/greenApiError';
import { formatPhoneNumber } from '../../create-chat/model/phone';

interface ChatDetailsRuntime {
  chatsById: Map<string, Chat>;
  controller: AbortController;
  credentials: Credentials;
  requestedAvatars: Set<string>;
  requestedPreviews: Set<string>;
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
    code: 'get-chats-failed',
    message: 'Не удалось загрузить список чатов. Попробуйте ещё раз.',
    retryable: true,
  };
}

export function useLoadChats() {
  const { state, dispatch } = useApp();
  const [reloadVersion, setReloadVersion] = useState(0);
  const runtimeRef = useRef<ChatDetailsRuntime | null>(null);
  const reloadChats = useCallback(() => setReloadVersion((value) => value + 1), []);

  const loadChatPreview = useCallback(
    (runtime: ChatDetailsRuntime, chat: Chat) => {
      if (runtime.requestedPreviews.has(chat.chatId)) {
        return;
      }

      runtime.requestedPreviews.add(chat.chatId);
      void getChatHistory({
        credentials: runtime.credentials,
        chatId: chat.chatId,
        count: 1,
        priority: 'background',
        signal: runtime.controller.signal,
      })
        .then((messages) => {
          if (!runtime.controller.signal.aborted) {
            dispatch({
              type: 'chat-preview-loaded',
              payload: { chatId: chat.chatId, message: messages.at(-1) ?? null },
            });
          }
        })
        .catch((error: unknown) => {
          if (!runtime.controller.signal.aborted && !isAbortError(error)) {
            dispatch({
              type: 'chat-preview-failed',
              payload: { chatId: chat.chatId },
            });
          }
        });
    },
    [dispatch],
  );

  const loadChatAvatar = useCallback(
    (runtime: ChatDetailsRuntime, chat: Chat) => {
      if (runtime.requestedAvatars.has(chat.chatId)) {
        return;
      }

      runtime.requestedAvatars.add(chat.chatId);
      void getAvatar({
        credentials: runtime.credentials,
        chatId: chat.chatId,
        signal: runtime.controller.signal,
      })
        .then((avatarUrl) => {
          if (!runtime.controller.signal.aborted) {
            dispatch({
              type: 'chat-avatar-loaded',
              payload: { chatId: chat.chatId, avatarUrl },
            });
          }
        })
        .catch((error: unknown) => {
          if (!runtime.controller.signal.aborted && !isAbortError(error)) {
            dispatch({
              type: 'chat-avatar-failed',
              payload: { chatId: chat.chatId },
            });
          }
        });
    },
    [dispatch],
  );

  const loadChatDetails = useCallback(
    (chatId: string) => {
      const runtime = runtimeRef.current;
      const chat = runtime?.chatsById.get(chatId);

      if (!runtime || !chat || runtime.controller.signal.aborted) {
        return;
      }

      loadChatPreview(runtime, chat);
      loadChatAvatar(runtime, chat);
    },
    [loadChatAvatar, loadChatPreview],
  );

  const loadAllChatPreviews = useCallback(() => {
    const runtime = runtimeRef.current;

    if (!runtime || runtime.controller.signal.aborted) {
      return;
    }

    runtime.chatsById.forEach((chat) => loadChatPreview(runtime, chat));
  }, [loadChatPreview]);

  useEffect(() => {
    const credentials = state.credentials;

    if (!credentials) {
      return undefined;
    }

    const controller = new AbortController();
    dispatch({ type: 'chats-loading' });

    void getChats({ credentials, signal: controller.signal })
      .then((apiChats) => {
        if (controller.signal.aborted) {
          return;
        }

        const chats: Chat[] = apiChats
          .filter((chat) => chat.type === 'user')
          .map((chat) => ({
            chatId: chat.chatId,
            phoneNumber: chat.phoneNumber,
            displayName:
              chat.name.trim() ||
              (chat.phoneNumber ? formatPhoneNumber(chat.phoneNumber) : 'Чат MAX'),
            avatarStatus: 'idle',
            previewStatus: 'idle',
            unreadCount: chat.unreadCount,
          }));

        runtimeRef.current = {
          chatsById: new Map(chats.map((chat) => [chat.chatId, chat])),
          controller,
          credentials,
          requestedAvatars: new Set(),
          requestedPreviews: new Set(),
        };
        dispatch({ type: 'chats-loaded', payload: chats });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          dispatch({ type: 'chats-failed', payload: normalizeError(error) });
        }
      });

    return () => {
      controller.abort();
      if (runtimeRef.current?.controller === controller) {
        runtimeRef.current = null;
      }
    };
  }, [dispatch, reloadVersion, state.credentials]);

  return { loadAllChatPreviews, loadChatDetails, reloadChats };
}
