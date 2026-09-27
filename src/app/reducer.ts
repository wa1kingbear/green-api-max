import type { AppAction, AppState } from './model';

function upsertChat(state: AppState, chat: AppState['chats'][number]) {
  const existingChat = state.chats.find((item) => item.chatId === chat.chatId);

  if (!existingChat) {
    return [chat, ...state.chats];
  }

  return state.chats.map((item) =>
    item.chatId === chat.chatId ? { ...item, ...chat } : item,
  );
}

function updateChatPreview(
  state: AppState,
  chatId: string,
  text: string,
  timestamp: number,
  raise = true,
) {
  const chat = state.chats.find((item) => item.chatId === chatId);

  if (!chat) {
    return state.chats;
  }

  const updatedChat = {
    ...chat,
    lastMessage: text,
    lastMessageTimestamp: timestamp,
    previewStatus: 'ready' as const,
  };

  if (!raise) {
    return state.chats.map((item) => (item.chatId === chatId ? updatedChat : item));
  }

  return [updatedChat, ...state.chats.filter((item) => item.chatId !== chatId)];
}

function mergeMessages(history: AppState['messages'], current: AppState['messages']) {
  const messagesById = new Map(history.map((message) => [message.id, message]));

  current.forEach((message) => messagesById.set(message.id, message));

  return [...messagesById.values()].sort(
    (first, second) => first.timestamp - second.timestamp,
  );
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'connect':
      return {
        ...state,
        connection: 'connected',
        credentials: action.payload,
      };
    case 'chats-loading':
      return {
        ...state,
        chatsStatus: 'loading',
        chatsError: null,
      };
    case 'chats-loaded': {
      const loadedChatIds = new Set(action.payload.map((chat) => chat.chatId));
      const localChats = state.chats.filter((chat) => !loadedChatIds.has(chat.chatId));
      const chats = action.payload.map((chat) => {
        const existingChat = state.chats.find((item) => item.chatId === chat.chatId);
        return existingChat
          ? {
              ...existingChat,
              ...chat,
              avatarUrl: existingChat.avatarUrl,
              avatarStatus: existingChat.avatarStatus ?? chat.avatarStatus,
              lastMessage: existingChat.lastMessage,
              lastMessageTimestamp: existingChat.lastMessageTimestamp,
            }
          : chat;
      });

      return {
        ...state,
        chats: [...chats, ...localChats],
        chatsStatus: 'ready',
        chatsError: null,
      };
    }
    case 'chats-failed':
      return {
        ...state,
        chatsStatus: 'error',
        chatsError: action.payload,
      };
    case 'chat-avatar-loaded': {
      const updateAvatar = (chat: AppState['chats'][number]) =>
        chat.chatId === action.payload.chatId
          ? {
              ...chat,
              avatarUrl: action.payload.avatarUrl ?? undefined,
              avatarStatus: 'ready' as const,
            }
          : chat;

      return {
        ...state,
        chats: state.chats.map(updateAvatar),
        activeChat: state.activeChat ? updateAvatar(state.activeChat) : null,
      };
    }
    case 'chat-avatar-failed': {
      const markAvatarFailed = (chat: AppState['chats'][number]) =>
        chat.chatId === action.payload.chatId
          ? { ...chat, avatarStatus: 'error' as const }
          : chat;

      return {
        ...state,
        chats: state.chats.map(markAvatarFailed),
        activeChat: state.activeChat ? markAvatarFailed(state.activeChat) : null,
      };
    }
    case 'chat-preview-loaded':
      return {
        ...state,
        chats: state.chats.map((chat) => {
          if (chat.chatId !== action.payload.chatId) {
            return chat;
          }

          const message = action.payload.message;
          const isNewerMessage =
            message !== null &&
            (chat.lastMessageTimestamp === undefined ||
              message.timestamp >= chat.lastMessageTimestamp);

          return {
            ...chat,
            ...(isNewerMessage
              ? {
                  lastMessage: message.text,
                  lastMessageTimestamp: message.timestamp,
                }
              : {}),
            previewStatus: 'ready',
          };
        }),
      };
    case 'chat-preview-failed':
      return {
        ...state,
        chats: state.chats.map((chat) =>
          chat.chatId === action.payload.chatId
            ? { ...chat, previewStatus: 'error' }
            : chat,
        ),
      };
    case 'open-chat': {
      const isSameChat = state.activeChat?.chatId === action.payload.chatId;

      return {
        ...state,
        activeChat: action.payload,
        chats: upsertChat(state, action.payload),
        messages: isSameChat ? state.messages : [],
        historyStatus: isSameChat ? state.historyStatus : 'idle',
        historyError: null,
      };
    }
    case 'history-loading':
      if (state.activeChat?.chatId !== action.payload.chatId) {
        return state;
      }

      return {
        ...state,
        historyStatus: 'loading',
        historyError: null,
      };
    case 'history-loaded': {
      if (state.activeChat?.chatId !== action.payload.chatId) {
        return state;
      }

      const messages = mergeMessages(action.payload.messages, state.messages);
      const processedMessageIds = new Set(state.processedMessageIds);
      action.payload.messages.forEach((message) => processedMessageIds.add(message.id));
      const latestMessage = messages.at(-1);

      return {
        ...state,
        messages,
        chats: latestMessage
          ? updateChatPreview(
              state,
              action.payload.chatId,
              latestMessage.text,
              latestMessage.timestamp,
              false,
            )
          : state.chats,
        historyStatus: 'ready',
        historyError: null,
        processedMessageIds,
      };
    }
    case 'history-failed':
      if (state.activeChat?.chatId !== action.payload.chatId) {
        return state;
      }

      return {
        ...state,
        historyStatus: 'error',
        historyError: action.payload.error,
      };
    case 'add-message':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        chats: updateChatPreview(
          state,
          action.payload.chatId,
          action.payload.text,
          action.payload.timestamp,
        ),
      };
    case 'receive-message': {
      if (state.processedMessageIds.has(action.payload.id)) {
        return state;
      }

      const processedMessageIds = new Set(state.processedMessageIds);
      processedMessageIds.add(action.payload.id);
      const isActiveChat = action.payload.chatId === state.activeChat?.chatId;

      return {
        ...state,
        chats: updateChatPreview(
          state,
          action.payload.chatId,
          action.payload.text,
          action.payload.timestamp,
        ),
        messages: isActiveChat
          ? mergeMessages([], [...state.messages, action.payload])
          : state.messages,
        processedMessageIds,
      };
    }
    case 'message-sent':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.payload.temporaryId
            ? {
                ...message,
                id: action.payload.idMessage,
                status: 'sent' as const,
              }
            : message,
        ),
      };
    case 'message-failed':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.payload.id
            ? { ...message, status: 'failed' as const }
            : message,
        ),
      };
    case 'message-retrying':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.payload.id
            ? { ...message, status: 'sending' as const }
            : message,
        ),
      };
    case 'polling-degraded':
      if (!state.credentials) {
        return state;
      }

      return {
        ...state,
        connection: 'degraded',
        pollingError: action.payload,
      };
    case 'polling-recovered':
      if (!state.credentials) {
        return state;
      }

      if (state.connection === 'connected' && state.pollingError === null) {
        return state;
      }

      return {
        ...state,
        connection: 'connected',
        pollingError: null,
      };
    case 'disconnect':
      return {
        connection: 'disconnected',
        credentials: null,
        chats: [],
        chatsStatus: 'idle',
        chatsError: null,
        activeChat: null,
        messages: [],
        historyStatus: 'idle',
        historyError: null,
        processedMessageIds: new Set(),
        pollingError: null,
      };
  }
}
