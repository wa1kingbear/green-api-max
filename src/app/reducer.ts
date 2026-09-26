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
