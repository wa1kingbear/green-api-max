import { createContext, type Dispatch } from 'react';

import type { AppAction, AppState, Chat } from './model';

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export type SessionState = Pick<
  AppState,
  'connection' | 'credentials' | 'pollingError'
>;
export type ChatListState = Pick<AppState, 'chats' | 'chatsStatus' | 'chatsError'>;
export type ConversationState = Pick<
  AppState,
  'messages' | 'historyStatus' | 'historyError'
>;

export const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);
export const SessionContext = createContext<SessionState | null>(null);
export const ChatListContext = createContext<ChatListState | null>(null);
export const ActiveChatContext = createContext<Chat | null | undefined>(undefined);
export const ConversationContext = createContext<ConversationState | null>(null);
export const ProcessedMessageIdsContext = createContext<Set<string> | null>(null);
