import {
  ArrowLeftIcon,
  ChatCircleDotsIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SignOutIcon,
  UserCircleIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { useRef, useState } from 'react';

import { useApp } from '../../app/useApp';
import { useCreateChat } from '../../features/create-chat/model/useCreateChat';
import { NewChatDialog } from '../../features/create-chat/ui/NewChatDialog';
import { useReceiveMessages } from '../../features/receive-messages/model/useReceiveMessages';
import { useSendMessage } from '../../features/send-message/model/useSendMessage';
import { IconButton } from '../../shared/ui/IconButton/IconButton';
import { MessageComposer } from '../../widgets/message-composer/MessageComposer';
import { MessageList } from '../../widgets/message-list/MessageList';
import styles from './MessengerPage.module.css';

export function MessengerPage() {
  const { state, dispatch } = useApp();
  const createChat = useCreateChat();
  const { sendMessage, retryMessage } = useSendMessage();
  useReceiveMessages();
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(state.activeChat !== null);
  const newChatTriggerRef = useRef<HTMLElement | null>(null);
  const latestMessage = state.messages.at(-1);
  const isConnectionDegraded = state.connection === 'degraded';

  const openNewChatDialog = () => {
    newChatTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsNewChatOpen(true);
  };

  const closeNewChatDialog = () => {
    setIsNewChatOpen(false);
    requestAnimationFrame(() => newChatTriggerRef.current?.focus());
  };

  const handleCreateChat = async (phoneNumber: string) => {
    await createChat(phoneNumber);
    newChatTriggerRef.current = null;
    setIsMobileChatOpen(true);
  };

  return (
    <>
      <main
        className={`${styles.shell} ${isMobileChatOpen ? styles.shellMobileChatOpen : ''}`}
      >
        <nav className={styles.rail} aria-label="Основная навигация">
          <div className={styles.railTop}>
            <button
              className={`${styles.railItem} ${styles.railItemActive}`}
              type="button"
            >
              <ChatCircleDotsIcon size={27} weight="fill" />
              <span>Чаты</span>
            </button>
          </div>
          <button
            className={styles.railItem}
            onClick={() => dispatch({ type: 'disconnect' })}
            type="button"
          >
            <SignOutIcon size={27} weight="fill" />
            <span>Выйти</span>
          </button>
        </nav>

        <aside className={styles.sidebar}>
          <header className={styles.sidebarHeader}>
            <div>
              <h1>Чаты</h1>
              <span
                aria-live="polite"
                className={`${styles.connectionStatus} ${
                  isConnectionDegraded ? styles.connectionStatusDegraded : ''
                }`}
                title={state.pollingError?.message}
              >
                {isConnectionDegraded ? 'Восстанавливаем связь…' : 'Подключено'}
              </span>
            </div>
            <IconButton label="Новый чат" onClick={openNewChatDialog} tone="accent">
              <PlusIcon size={25} weight="bold" />
            </IconButton>
          </header>

          <label className={styles.search}>
            <MagnifyingGlassIcon size={21} aria-hidden="true" />
            <span className={styles.visuallyHidden}>Найти чат</span>
            <input disabled placeholder="Найти" type="search" />
          </label>

          {state.activeChat ? (
            <section className={styles.chatList} aria-label="Список чатов">
              <button
                className={styles.chatItem}
                onClick={() => setIsMobileChatOpen(true)}
                type="button"
              >
                <span className={styles.chatAvatar} aria-hidden="true">
                  <UserCircleIcon size={42} weight="fill" />
                </span>
                <span className={styles.chatSummary}>
                  <strong>{state.activeChat.displayName}</strong>
                  <span>{latestMessage?.text ?? 'Чат создан'}</span>
                </span>
              </button>
            </section>
          ) : (
            <section className={styles.emptyList} aria-label="Список чатов">
              <span className={styles.avatarFallback} aria-hidden="true">
                <UserCircleIcon size={46} weight="fill" />
              </span>
              <h2>Здесь появятся чаты</h2>
              <p>Создайте первый диалог по номеру телефона.</p>
              <button
                className={styles.secondaryButton}
                onClick={openNewChatDialog}
                type="button"
              >
                <PlusIcon size={20} weight="bold" />
                Новый чат
              </button>
            </section>
          )}

          <footer className={styles.mobileFooter}>
            <button className={styles.mobileFooterActive} type="button">
              <ChatCircleDotsIcon size={27} weight="fill" />
              Чаты
            </button>
            <button onClick={() => dispatch({ type: 'disconnect' })} type="button">
              <SignOutIcon size={27} weight="fill" />
              Выйти
            </button>
          </footer>
        </aside>

        <section className={styles.conversation} aria-label="Переписка">
          {state.activeChat ? (
            <>
              <header className={styles.chatHeader}>
                <IconButton
                  className={styles.backButton}
                  label="Назад к чатам"
                  onClick={() => setIsMobileChatOpen(false)}
                >
                  <ArrowLeftIcon size={25} weight="bold" />
                </IconButton>
                <span className={styles.headerAvatar} aria-hidden="true">
                  <UserCircleIcon size={38} weight="fill" />
                </span>
                <div>
                  <h2>{state.activeChat.displayName}</h2>
                  <span>MAX</span>
                </div>
              </header>
              {isConnectionDegraded && (
                <div className={styles.connectionNotice} role="status">
                  <WarningCircleIcon size={18} weight="fill" aria-hidden="true" />
                  <span>
                    {state.pollingError?.message ??
                      'Соединение потеряно. Пытаемся восстановить…'}
                  </span>
                </div>
              )}
              <MessageList messages={state.messages} onRetry={retryMessage} />
              <MessageComposer onSend={sendMessage} />
            </>
          ) : (
            <div className={styles.emptyConversation}>
              <span className={styles.chatGlyph} aria-hidden="true">
                <ChatCircleDotsIcon size={40} weight="fill" />
              </span>
              <h2>Выберите или создайте чат</h2>
              <p>Здесь появится переписка с пользователем MAX.</p>
              <button
                className={styles.primaryButton}
                onClick={openNewChatDialog}
                type="button"
              >
                <PlusIcon size={20} weight="bold" />
                Новый чат
              </button>
            </div>
          )}
        </section>
      </main>

      {isNewChatOpen && (
        <NewChatDialog
          onClose={closeNewChatDialog}
          onCreate={handleCreateChat}
        />
      )}
    </>
  );
}
