export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'degraded';

export interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
}

export interface Chat {
  chatId: string;
  phoneNumber: string;
  displayName: string;
}

export type MessageDirection = 'incoming' | 'outgoing';
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  chatId: string;
  direction: MessageDirection;
  text: string;
  timestamp: number;
  status: MessageStatus;
}

export interface AppState {
  connection: ConnectionStatus;
  credentials: Credentials | null;
  activeChat: Chat | null;
  messages: Message[];
  processedMessageIds: Set<string>;
  pollingError: null;
}

export type AppAction =
  | { type: 'connect'; payload: Credentials }
  | { type: 'open-chat'; payload: Chat }
  | { type: 'disconnect' };

export const initialAppState: AppState = {
  connection: 'disconnected',
  credentials: null,
  activeChat: null,
  messages: [],
  processedMessageIds: new Set(),
  pollingError: null,
};
