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

export interface AppError {
  code: string;
  message: string;
  retryable: boolean;
  httpStatus?: number;
}

export interface AppState {
  connection: ConnectionStatus;
  credentials: Credentials | null;
  activeChat: Chat | null;
  messages: Message[];
  processedMessageIds: Set<string>;
  pollingError: AppError | null;
}

export type AppAction =
  | { type: 'connect'; payload: Credentials }
  | { type: 'open-chat'; payload: Chat }
  | { type: 'add-message'; payload: Message }
  | { type: 'receive-message'; payload: Message }
  | {
      type: 'message-sent';
      payload: { temporaryId: string; idMessage: string };
    }
  | { type: 'message-failed'; payload: { id: string } }
  | { type: 'message-retrying'; payload: { id: string } }
  | { type: 'polling-degraded'; payload: AppError }
  | { type: 'polling-recovered' }
  | { type: 'disconnect' };

export const initialAppState: AppState = {
  connection: 'disconnected',
  credentials: null,
  activeChat: null,
  messages: [],
  processedMessageIds: new Set(),
  pollingError: null,
};
