import { useContext } from 'react';

import {
  ActiveChatContext,
  AppContext,
  AppDispatchContext,
  ChatListContext,
  ConversationContext,
  ProcessedMessageIdsContext,
  SessionContext,
} from './appContext';

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }

  return context;
}

export function useAppDispatch() {
  const dispatch = useContext(AppDispatchContext);

  if (!dispatch) {
    throw new Error('useAppDispatch must be used within AppProvider');
  }

  return dispatch;
}

export function useSessionState() {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error('useSessionState must be used within AppProvider');
  }

  return session;
}

export function useChatListState() {
  const chatList = useContext(ChatListContext);

  if (!chatList) {
    throw new Error('useChatListState must be used within AppProvider');
  }

  return chatList;
}

export function useActiveChat() {
  const activeChat = useContext(ActiveChatContext);

  if (activeChat === undefined) {
    throw new Error('useActiveChat must be used within AppProvider');
  }

  return activeChat;
}

export function useConversationState() {
  const conversation = useContext(ConversationContext);

  if (!conversation) {
    throw new Error('useConversationState must be used within AppProvider');
  }

  return conversation;
}

export function useProcessedMessageIds() {
  const processedMessageIds = useContext(ProcessedMessageIdsContext);

  if (!processedMessageIds) {
    throw new Error('useProcessedMessageIds must be used within AppProvider');
  }

  return processedMessageIds;
}
