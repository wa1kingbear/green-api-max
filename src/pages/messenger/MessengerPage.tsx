import {
  ArrowLeftIcon,
  ChatCircleDotsIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SignOutIcon,
  UserCircleIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Chat } from '../../app/model';
import { useApp } from '../../app/useApp';
import { useCreateChat } from '../../features/create-chat/model/useCreateChat';
import { NewChatDialog } from '../../features/create-chat/ui/NewChatDialog';
import { useLoadChatHistory } from '../../features/load-chat-history/model/useLoadChatHistory';
import { useLoadChats } from '../../features/load-chats/model/useLoadChats';
import { useReceiveMessages } from '../../features/receive-messages/model/useReceiveMessages';
import { useSendMessage } from '../../features/send-message/model/useSendMessage';
import { getChatIdFromUrl, setChatIdInUrl } from '../../shared/lib/chatUrl';
import { IconButton } from '../../shared/ui/IconButton/IconButton';
import { MessageComposer } from '../../widgets/message-composer/MessageComposer';
import { MessageList } from '../../widgets/message-list/MessageList';
import styles from './MessengerPage.module.css';

interface ChatAvatarProps {
  avatarStatus?: string;
  avatarUrl?: string;
  className: string;
  iconSize: number;
  lazy?: boolean;
}

function ChatAvatar({
  avatarStatus,
  avatarUrl,
  className,
  iconSize,
  lazy = false,
}: ChatAvatarProps) {
  return (
    <span className={className} aria-hidden="true">
      {avatarStatus === 'loading' && !avatarUrl ? (
        <span className={styles.avatarSkeleton} />
      ) : (
        <UserCircleIcon size={iconSize} weight="fill" />
      )}
      {avatarUrl && (
        <img
          alt=""
          className={styles.avatarImage}
          decoding="async"
          loading={lazy ? 'lazy' : 'eager'}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
          referrerPolicy="no-referrer"
          src={avatarUrl}
        />
      )}
    </span>
  );
}

function getChatPreview(chat: { lastMessage?: string; previewStatus?: string }) {
  if (chat.lastMessage) {
    return chat.lastMessage;
  }

  if (chat.previewStatus === 'error') {
    return 'Не удалось загрузить сообщение';
  }

  return 'Сообщений пока нет';
}

function chatMatchesSearch(
  chat: {
    chatId: string;
    displayName: string;
    phoneNumber: string;
    lastMessage?: string;
  },
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');

  if (!normalizedQuery) {
    return true;
  }

  const queryDigits = query.replace(/\D/g, '');
  const phoneDigits = chat.phoneNumber.replace(/\D/g, '');
  const phoneSearchVariants = [queryDigits];

  if (queryDigits.length > 1 && queryDigits.startsWith('8')) {
    phoneSearchVariants.push(`7${queryDigits.slice(1)}`);
  }

  if (queryDigits.length > 1 && queryDigits.startsWith('7')) {
    phoneSearchVariants.push(`8${queryDigits.slice(1)}`);
  }

  return (
    chat.displayName.toLocaleLowerCase('ru-RU').includes(normalizedQuery) ||
    chat.lastMessage?.toLocaleLowerCase('ru-RU').includes(normalizedQuery) ||
    chat.chatId.toLocaleLowerCase('ru-RU').includes(normalizedQuery) ||
    (queryDigits.length > 0 &&
      phoneSearchVariants.some((phoneQuery) => phoneDigits.includes(phoneQuery)))
  );
}

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onOpen: (chat: Chat) => void;
}

const ChatListItem = memo(function ChatListItem({
  chat,
  isActive,
  onOpen,
}: ChatListItemProps) {
  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      className={`${styles.chatItem} ${isActive ? styles.chatItemActive : ''} ${
        chat.unreadCount ? styles.chatItemUnread : ''
      }`}
      data-chat-id={chat.chatId}
      onClick={() => onOpen(chat)}
      type="button"
    >
      <ChatAvatar
        avatarStatus={chat.avatarStatus}
        avatarUrl={chat.avatarUrl}
        className={styles.chatAvatar}
        iconSize={42}
        lazy
      />
      <span className={styles.chatSummary}>
        <strong>{chat.displayName}</strong>
        {chat.previewStatus !== 'ready' &&
        chat.previewStatus !== 'error' &&
        !chat.lastMessage ? (
          <span
            aria-label="Загружается последнее сообщение"
            className={styles.chatPreviewSkeleton}
          />
        ) : (
          <span>{getChatPreview(chat)}</span>
        )}
      </span>
      {Boolean(chat.unreadCount) && (
        <span
          aria-label={`Непрочитанных сообщений: ${chat.unreadCount}`}
          className={styles.unreadBadge}
        >
          {chat.unreadCount! > 99 ? '99+' : chat.unreadCount}
        </span>
      )}
    </button>
  );
});

export function MessengerPage() {
  const { state, dispatch } = useApp();
  const createChat = useCreateChat();
  const { sendMessage, retryMessage } = useSendMessage();
  useReceiveMessages();
  const { loadAllChatPreviews, loadChatDetails, reloadChats } = useLoadChats();
  const { hasMore, isLoadingMore, loadMoreFailed, loadMoreHistory, reloadHistory } =
    useLoadChatHistory();
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const newChatTriggerRef = useRef<HTMLElement | null>(null);
  const chatListRef = useRef<HTMLElement | null>(null);
  const isMobileChatOpen = state.activeChat !== null;
  const isConnectionDegraded = state.connection === 'degraded';
  const filteredChats = useMemo(
    () => state.chats.filter((chat) => chatMatchesSearch(chat, searchQuery)),
    [searchQuery, state.chats],
  );
  const hasSearchQuery = searchQuery.trim().length > 0;
  const filteredChatIds = useMemo(
    () => filteredChats.map((chat) => chat.chatId).join('\u0000'),
    [filteredChats],
  );

  useEffect(() => {
    if (hasSearchQuery) {
      loadAllChatPreviews();
    }
  }, [hasSearchQuery, loadAllChatPreviews, state.chatsStatus]);

  useEffect(() => {
    const list = chatListRef.current;

    if (!list) {
      return undefined;
    }

    const chatItems = Array.from(list.querySelectorAll<HTMLElement>('[data-chat-id]'));

    if (!('IntersectionObserver' in window)) {
      chatItems.forEach((item) => {
        const chatId = item.dataset.chatId;
        if (chatId) {
          loadChatDetails(chatId);
        }
      });
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const chatId = (entry.target as HTMLElement).dataset.chatId;
          if (chatId) {
            loadChatDetails(chatId);
          }
          observer.unobserve(entry.target);
        });
      },
      { root: list, rootMargin: '240px 0px' },
    );

    chatItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [filteredChatIds, loadChatDetails, state.chatsStatus]);

  const syncChatFromUrl = useEffectEvent(() => {
    const chatId = getChatIdFromUrl();

    if (!chatId) {
      if (state.activeChat) {
        dispatch({ type: 'close-chat' });
      }
      return;
    }

    if (state.chatsStatus !== 'ready') {
      return;
    }

    const chat = state.chats.find((item) => item.chatId === chatId);

    if (!chat) {
      setChatIdInUrl(null, 'replace');
      if (state.activeChat) {
        dispatch({ type: 'close-chat' });
      }
      return;
    }

    if (state.activeChat?.chatId !== chat.chatId) {
      dispatch({ type: 'open-chat', payload: chat });
    }
    loadChatDetails(chat.chatId);
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(syncChatFromUrl, 0);
    return () => window.clearTimeout(timeoutId);
  }, [state.chatsStatus]);

  useEffect(() => {
    const handlePopState = () => syncChatFromUrl();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    const chat = await createChat(phoneNumber);
    setChatIdInUrl(chat.chatId);
    newChatTriggerRef.current = null;
  };

  const openChat = useCallback(
    (chat: Chat) => {
      setChatIdInUrl(chat.chatId);
      loadChatDetails(chat.chatId);
      dispatch({ type: 'open-chat', payload: chat });
    },
    [dispatch, loadChatDetails],
  );

  const closeChat = () => {
    setChatIdInUrl(null);
    dispatch({ type: 'close-chat' });
  };

  const disconnect = () => {
    setChatIdInUrl(null, 'replace');
    dispatch({ type: 'disconnect' });
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
          <button className={styles.railItem} onClick={disconnect} type="button">
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

          <div className={styles.search}>
            <MagnifyingGlassIcon size={21} aria-hidden="true" />
            <label className={styles.visuallyHidden} htmlFor="chat-search">
              Найти чат
            </label>
            <input
              aria-controls="chat-list"
              autoComplete="off"
              disabled={state.chats.length === 0}
              id="chat-search"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && searchQuery) {
                  setSearchQuery('');
                }
              }}
              placeholder="Найти"
              type="search"
              value={searchQuery}
            />
            {hasSearchQuery && (
              <button
                aria-label="Очистить поиск"
                className={styles.searchClear}
                onClick={() => setSearchQuery('')}
                type="button"
              >
                <XIcon size={17} weight="bold" />
              </button>
            )}
          </div>

          {state.chats.length > 0 ? (
            filteredChats.length > 0 ? (
              <section
                className={styles.chatList}
                id="chat-list"
                aria-label="Список чатов"
                ref={chatListRef}
              >
                {filteredChats.map((chat) => (
                  <ChatListItem
                    chat={chat}
                    isActive={state.activeChat?.chatId === chat.chatId}
                    key={chat.chatId}
                    onOpen={openChat}
                  />
                ))}
              </section>
            ) : (
              <section className={styles.searchEmpty} role="status">
                <MagnifyingGlassIcon size={34} aria-hidden="true" />
                <h2>Ничего не найдено</h2>
                <p>Попробуйте изменить имя или номер телефона.</p>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setSearchQuery('')}
                  type="button"
                >
                  Сбросить поиск
                </button>
              </section>
            )
          ) : state.chatsStatus === 'loading' ? (
            <section
              className={styles.listState}
              aria-label="Список чатов"
              role="status"
            >
              <span className={styles.loadingDot} aria-hidden="true" />
              <h2>Загружаем чаты</h2>
              <p>Получаем список диалогов из MAX.</p>
            </section>
          ) : state.chatsStatus === 'error' ? (
            <section className={styles.listState} aria-label="Список чатов">
              <WarningCircleIcon size={42} weight="fill" aria-hidden="true" />
              <h2>Не удалось загрузить чаты</h2>
              <p>{state.chatsError?.message}</p>
              <button
                className={styles.secondaryButton}
                onClick={reloadChats}
                type="button"
              >
                Повторить
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
            <button onClick={disconnect} type="button">
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
                  onClick={closeChat}
                >
                  <ArrowLeftIcon size={25} weight="bold" />
                </IconButton>
                <ChatAvatar
                  avatarStatus={state.activeChat.avatarStatus}
                  avatarUrl={state.activeChat.avatarUrl}
                  className={styles.headerAvatar}
                  iconSize={38}
                />
                <div>
                  <h2>{state.activeChat.displayName}</h2>
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
              {state.historyStatus === 'loading' && state.messages.length === 0 ? (
                <div className={styles.historyState} role="status">
                  <span className={styles.loadingDot} aria-hidden="true" />
                  <h2>Загружаем переписку</h2>
                  <p>Получаем последние сообщения из MAX.</p>
                </div>
              ) : state.historyStatus === 'error' && state.messages.length === 0 ? (
                <div className={styles.historyState}>
                  <WarningCircleIcon size={42} weight="fill" aria-hidden="true" />
                  <h2>Не удалось загрузить переписку</h2>
                  <p>{state.historyError?.message}</p>
                  <button
                    className={styles.secondaryButton}
                    onClick={reloadHistory}
                    type="button"
                  >
                    Повторить
                  </button>
                </div>
              ) : (
                <MessageList
                  canLoadMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  loadMoreFailed={loadMoreFailed}
                  messages={state.messages}
                  onLoadMore={loadMoreHistory}
                  onRetry={retryMessage}
                />
              )}
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
        <NewChatDialog onClose={closeNewChatDialog} onCreate={handleCreateChat} />
      )}
    </>
  );
}
