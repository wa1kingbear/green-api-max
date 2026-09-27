import type { Message } from '../../../app/model';
import { useApp } from '../../../app/useApp';
import { sendMessage as sendMessageRequest } from '../../../shared/api/sendMessage';
import { createTemporaryMessageId, prepareMessageText } from './message';

export function useSendMessage() {
  const { state, dispatch } = useApp();

  const performRequest = async (message: Message) => {
    if (!state.credentials) {
      dispatch({ type: 'message-failed', payload: { id: message.id } });
      return;
    }

    try {
      const result = await sendMessageRequest({
        credentials: state.credentials,
        chatId: message.chatId,
        message: message.text,
      });

      dispatch({
        type: 'message-sent',
        payload: {
          temporaryId: message.id,
          idMessage: result.idMessage,
        },
      });
    } catch {
      dispatch({ type: 'message-failed', payload: { id: message.id } });
    }
  };

  const sendMessage = (value: string) => {
    const text = prepareMessageText(value);

    if (!text || !state.activeChat) {
      return;
    }

    const message: Message = {
      id: createTemporaryMessageId(),
      chatId: state.activeChat.chatId,
      direction: 'outgoing',
      text,
      timestamp: Date.now(),
      status: 'sending',
    };

    dispatch({ type: 'add-message', payload: message });
    void performRequest(message);
  };

  const retryMessage = (id: string) => {
    const message = state.messages.find(
      (item) => item.id === id && item.status === 'failed',
    );

    if (!message) {
      return;
    }

    dispatch({ type: 'message-retrying', payload: { id } });
    void performRequest(message);
  };

  return { sendMessage, retryMessage };
}
