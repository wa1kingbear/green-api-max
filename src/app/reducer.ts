import type { AppAction, AppState } from './model';

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'connect':
      return {
        ...state,
        connection: 'connected',
        credentials: action.payload,
      };
    case 'open-chat':
      return {
        ...state,
        activeChat: action.payload,
        messages: [],
      };
    case 'add-message':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    case 'receive-message': {
      if (
        !state.activeChat ||
        action.payload.chatId !== state.activeChat.chatId ||
        state.processedMessageIds.has(action.payload.id)
      ) {
        return state;
      }

      const processedMessageIds = new Set(state.processedMessageIds);
      processedMessageIds.add(action.payload.id);

      return {
        ...state,
        messages: [...state.messages, action.payload],
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
        activeChat: null,
        messages: [],
        processedMessageIds: new Set(),
        pollingError: null,
      };
  }
}
