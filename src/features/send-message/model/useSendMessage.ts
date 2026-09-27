import type { Message } from '../../../app/model';
import {
  useActiveChat,
  useAppDispatch,
  useConversationState,
  useSessionState,
} from '../../../app/useApp';
import { sendMessage as sendMessageRequest } from '../../../shared/api/sendMessage';
import { createTemporaryMessageId, prepareMessageText } from './message';

export function useSendMessage() {
  const dispatch = useAppDispatch();
  const { credentials } = useSessionState();
  const activeChat = useActiveChat();
  const { messages } = useConversationState();

  const performRequest = async (message: Message) => {
    if (!credentials) {
      dispatch({ type: 'message-failed', payload: { id: message.id } });
      return;
    }

    try {
      const result = await sendMessageRequest({
        credentials,
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

    if (!text || !activeChat) {
      return;
    }

    const message: Message = {
      id: createTemporaryMessageId(),
      chatId: activeChat.chatId,
      direction: 'outgoing',
      text,
      timestamp: Date.now(),
      status: 'sending',
    };

    dispatch({ type: 'add-message', payload: message });
    void performRequest(message);
  };

  const retryMessage = (id: string) => {
    const message = messages.find((item) => item.id === id && item.status === 'failed');

    if (!message) {
      return;
    }

    dispatch({ type: 'message-retrying', payload: { id } });
    void performRequest(message);
  };

  return { sendMessage, retryMessage };
}
