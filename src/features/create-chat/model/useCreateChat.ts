import { useApp } from '../../../app/useApp';
import { checkAccount } from '../../../shared/api/checkAccount';
import { getAvatar } from '../../../shared/api/getAvatar';
import { GreenApiError } from '../../../shared/api/greenApiError';
import { formatPhoneNumber } from './phone';

export function useCreateChat() {
  const { state, dispatch } = useApp();

  return async (phoneNumber: string) => {
    if (!state.credentials) {
      throw new GreenApiError({
        code: 'invalid-credentials',
        message: 'Подключитесь к GREEN-API ещё раз.',
        retryable: false,
      });
    }

    const result = await checkAccount({
      credentials: state.credentials,
      phoneNumber,
    });

    if (!result.exist) {
      throw new GreenApiError({
        code: 'account-not-found',
        message: 'Пользователь MAX с таким номером не найден.',
        retryable: false,
      });
    }

    if (!result.chatId) {
      throw new GreenApiError({
        code: 'unexpected-response',
        message: 'GREEN-API не вернул идентификатор чата.',
        retryable: true,
      });
    }

    const existingChat = state.chats.find((chat) => chat.chatId === result.chatId);
    const chat = existingChat ?? {
      chatId: result.chatId,
      phoneNumber,
      displayName: formatPhoneNumber(phoneNumber),
      avatarStatus: 'loading' as const,
    };

    dispatch({
      type: 'open-chat',
      payload: chat,
    });

    if (
      existingChat?.avatarStatus === 'ready' ||
      existingChat?.avatarStatus === 'loading'
    ) {
      return chat;
    }

    void getAvatar({
      credentials: state.credentials,
      chatId: result.chatId,
    })
      .then((avatarUrl) => {
        dispatch({
          type: 'chat-avatar-loaded',
          payload: { chatId: result.chatId, avatarUrl },
        });
      })
      .catch(() => {
        dispatch({
          type: 'chat-avatar-failed',
          payload: { chatId: result.chatId },
        });
      });

    return chat;
  };
}
