import type { AppAction, AppState } from './model';

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'connect':
      return {
        ...state,
        connection: 'connected',
        credentials: action.payload,
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
