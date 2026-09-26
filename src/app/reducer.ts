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
        processedMessageIds: new Set(),
      };
    case 'add-message':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
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
