import { useCallback, useEffect, useState } from 'react';

import type { AppError, Chat } from '../../../app/model';
import { useApp } from '../../../app/useApp';
import { getAvatar } from '../../../shared/api/getAvatar';
import { getChatHistory } from '../../../shared/api/getChatHistory';
import { getChats } from '../../../shared/api/getChats';
import { isGreenApiError } from '../../../shared/api/greenApiError';
import { formatPhoneNumber } from '../../create-chat/model/phone';

const PREVIEW_REQUEST_CONCURRENCY = 1;
const AVATAR_REQUEST_CONCURRENCY = 1;

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
  const reloadChats = useCallback(() => setReloadVersion((value) => value + 1), []);

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
            avatarStatus: 'loading',
            previewStatus: 'loading',
          }));

        dispatch({ type: 'chats-loaded', payload: chats });

        let nextChatIndex = 0;

        const loadNextPreview = async () => {
          while (!controller.signal.aborted) {
            const chat = chats[nextChatIndex];
            nextChatIndex += 1;

            if (!chat) {
              return;
            }

            try {
              const messages = await getChatHistory({
                credentials,
                chatId: chat.chatId,
                count: 1,
                signal: controller.signal,
              });

              if (!controller.signal.aborted) {
                dispatch({
                  type: 'chat-preview-loaded',
                  payload: { chatId: chat.chatId, message: messages.at(-1) ?? null },
                });
              }
            } catch (error: unknown) {
              if (controller.signal.aborted || isAbortError(error)) {
                return;
              }

              dispatch({
                type: 'chat-preview-failed',
                payload: { chatId: chat.chatId },
              });
            }
          }
        };

        const workerCount = Math.min(PREVIEW_REQUEST_CONCURRENCY, chats.length);
        void Promise.all(Array.from({ length: workerCount }, () => loadNextPreview()));

        let nextAvatarIndex = 0;

        const loadNextAvatar = async () => {
          while (!controller.signal.aborted) {
            const chat = chats[nextAvatarIndex];
            nextAvatarIndex += 1;

            if (!chat) {
              return;
            }

            try {
              const avatarUrl = await getAvatar({
                credentials,
                chatId: chat.chatId,
                signal: controller.signal,
              });

              if (!controller.signal.aborted) {
                dispatch({
                  type: 'chat-avatar-loaded',
                  payload: { chatId: chat.chatId, avatarUrl },
                });
              }
            } catch (error: unknown) {
              if (controller.signal.aborted || isAbortError(error)) {
                return;
              }

              dispatch({
                type: 'chat-avatar-failed',
                payload: { chatId: chat.chatId },
              });
            }
          }
        };

        const avatarWorkerCount = Math.min(AVATAR_REQUEST_CONCURRENCY, chats.length);
        void Promise.all(
          Array.from({ length: avatarWorkerCount }, () => loadNextAvatar()),
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          dispatch({ type: 'chats-failed', payload: normalizeError(error) });
        }
      });

    return () => controller.abort();
  }, [dispatch, reloadVersion, state.credentials]);

  return { reloadChats };
}
