import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';

import { useActiveChat, useAppDispatch, useChatListState } from '../../app/useApp';
import { useCreateChat } from '../../features/create-chat/model/useCreateChat';
import { NewChatDialog } from '../../features/create-chat/ui/NewChatDialog';
import { useLoadChats } from '../../features/load-chats/model/useLoadChats';
import { useReceiveMessages } from '../../features/receive-messages/model/useReceiveMessages';
import { getChatIdFromUrl, setChatIdInUrl } from '../../shared/lib/chatUrl';
import { ChatSidebar } from './ChatSidebar';
import { Conversation } from './Conversation';
import styles from './MessengerPage.module.css';

interface ChatUrlSyncProps {
  loadChatDetails: (chatId: string) => void;
}

function ChatUrlSync({ loadChatDetails }: ChatUrlSyncProps) {
  const dispatch = useAppDispatch();
  const activeChat = useActiveChat();
  const { chats, chatsStatus } = useChatListState();
  const syncChatFromUrl = useEffectEvent(() => {
    const chatId = getChatIdFromUrl();

    if (!chatId) {
      if (activeChat) {
        dispatch({ type: 'close-chat' });
      }
      return;
    }

    if (chatsStatus !== 'ready') {
      return;
    }

    const chat = chats.find((item) => item.chatId === chatId);

    if (!chat) {
      setChatIdInUrl(null, 'replace');
      if (activeChat) {
        dispatch({ type: 'close-chat' });
      }
      return;
    }

    if (activeChat?.chatId !== chat.chatId) {
      dispatch({ type: 'open-chat', payload: chat });
    }
    loadChatDetails(chat.chatId);
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(syncChatFromUrl, 0);
    return () => window.clearTimeout(timeoutId);
  }, [chatsStatus]);

  useEffect(() => {
    const handlePopState = () => syncChatFromUrl();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return null;
}

function MessagePolling() {
  useReceiveMessages();
  return null;
}

interface CreateChatDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateChatDialog({ onClose, onCreated }: CreateChatDialogProps) {
  const createChat = useCreateChat();

  const handleCreateChat = async (phoneNumber: string) => {
    const chat = await createChat(phoneNumber);
    setChatIdInUrl(chat.chatId);
  };

  return (
    <NewChatDialog
      onClose={onClose}
      onCreate={handleCreateChat}
      onCreated={onCreated}
    />
  );
}

export function MessengerPage() {
  const activeChat = useActiveChat();
  const { loadAllChatPreviews, loadChatDetails, reloadChats } = useLoadChats();
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const newChatTriggerRef = useRef<HTMLElement | null>(null);

  const openNewChatDialog = useCallback(() => {
    newChatTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsNewChatOpen(true);
  }, []);

  const closeNewChatDialog = useCallback(() => {
    setIsNewChatOpen(false);
    requestAnimationFrame(() => newChatTriggerRef.current?.focus());
  }, []);

  const completeNewChatDialog = useCallback(() => {
    setIsNewChatOpen(false);
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>('[aria-label="Сообщение"]')?.focus();
    });
  }, []);

  return (
    <>
      <MessagePolling />
      <ChatUrlSync loadChatDetails={loadChatDetails} />
      <main
        className={`${styles.shell} ${activeChat ? styles.shellMobileChatOpen : ''}`}
      >
        <ChatSidebar
          loadAllChatPreviews={loadAllChatPreviews}
          loadChatDetails={loadChatDetails}
          onNewChat={openNewChatDialog}
          reloadChats={reloadChats}
        />
        <Conversation onNewChat={openNewChatDialog} />
      </main>

      {isNewChatOpen && (
        <CreateChatDialog
          onClose={closeNewChatDialog}
          onCreated={completeNewChatDialog}
        />
      )}
    </>
  );
}
