export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'degraded';

export interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
}

export interface Chat {
  chatId: string;
  phoneNumber: string;
  displayName: string;
  avatarUrl?: string;
  avatarStatus?: LoadingStatus;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  previewStatus?: LoadingStatus;
  unreadCount?: number;
}

export type LoadingStatus = 'idle' | 'loading' | 'ready' | 'error';

export type MessageDirection = 'incoming' | 'outgoing';
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  chatId: string;
  direction: MessageDirection;
  text: string;
  mediaUrl?: string;
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
  chats: Chat[];
  chatsStatus: LoadingStatus;
  chatsError: AppError | null;
  activeChat: Chat | null;
  messages: Message[];
  historyStatus: LoadingStatus;
  historyError: AppError | null;
  processedMessageIds: Set<string>;
  pollingError: AppError | null;
}

export type AppAction =
  | { type: 'connect'; payload: Credentials }
  | { type: 'chats-loading' }
  | { type: 'chats-loaded'; payload: Chat[] }
  | { type: 'chats-failed'; payload: AppError }
  | {
      type: 'chat-avatar-loaded';
      payload: { chatId: string; avatarUrl: string | null };
    }
  | { type: 'chat-avatar-failed'; payload: { chatId: string } }
  | {
      type: 'chat-preview-loaded';
      payload: { chatId: string; message: Message | null };
    }
  | { type: 'chat-preview-failed'; payload: { chatId: string } }
  | { type: 'open-chat'; payload: Chat }
  | { type: 'history-loading'; payload: { chatId: string } }
  | {
      type: 'history-loaded';
      payload: { chatId: string; messages: Message[] };
    }
  | {
      type: 'history-failed';
      payload: { chatId: string; error: AppError };
    }
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
