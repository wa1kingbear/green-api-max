import {
  ChatCircleDotsIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SignOutIcon,
  UserCircleIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Chat } from '../../app/model';
import {
  useActiveChat,
  useAppDispatch,
  useChatListState,
  useSessionState,
} from '../../app/useApp';
import { setChatIdInUrl } from '../../shared/lib/chatUrl';
import { IconButton } from '../../shared/ui/IconButton/IconButton';
import { ChatAvatar } from './ChatAvatar';
import styles from './MessengerPage.module.css';

interface ChatSidebarProps {
  loadAllChatPreviews: () => void;
  loadChatDetails: (chatId: string) => void;
  onNewChat: () => void;
  reloadChats: () => void;
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

export const ChatSidebar = memo(function ChatSidebar({
  loadAllChatPreviews,
  loadChatDetails,
  onNewChat,
  reloadChats,
}: ChatSidebarProps) {
  const dispatch = useAppDispatch();
  const activeChat = useActiveChat();
  const { chats, chatsError, chatsStatus } = useChatListState();
  const { connection, pollingError } = useSessionState();
  const [searchQuery, setSearchQuery] = useState('');
  const chatListRef = useRef<HTMLElement | null>(null);
  const isConnectionDegraded = connection === 'degraded';
  const filteredChats = useMemo(
    () => chats.filter((chat) => chatMatchesSearch(chat, searchQuery)),
    [chats, searchQuery],
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
  }, [chatsStatus, hasSearchQuery, loadAllChatPreviews]);

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
  }, [chatsStatus, filteredChatIds, loadChatDetails]);

  const openChat = useCallback(
    (chat: Chat) => {
      setChatIdInUrl(chat.chatId);
      loadChatDetails(chat.chatId);
      dispatch({ type: 'open-chat', payload: chat });
    },
    [dispatch, loadChatDetails],
  );

  const disconnect = () => {
    setChatIdInUrl(null, 'replace');
    dispatch({ type: 'disconnect' });
  };

  return (
    <>
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
              title={pollingError?.message}
            >
              {isConnectionDegraded ? 'Восстанавливаем связь…' : 'Подключено'}
            </span>
          </div>
          <IconButton label="Новый чат" onClick={onNewChat} tone="accent">
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
            disabled={chats.length === 0}
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

        {chats.length > 0 ? (
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
                  isActive={activeChat?.chatId === chat.chatId}
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
        ) : chatsStatus === 'loading' ? (
          <section className={styles.listState} aria-label="Список чатов" role="status">
            <span className={styles.loadingDot} aria-hidden="true" />
            <h2>Загружаем чаты</h2>
            <p>Получаем список диалогов из MAX.</p>
          </section>
        ) : chatsStatus === 'error' ? (
          <section className={styles.listState} aria-label="Список чатов">
            <WarningCircleIcon size={42} weight="fill" aria-hidden="true" />
            <h2>Не удалось загрузить чаты</h2>
            <p>{chatsError?.message}</p>
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
              onClick={onNewChat}
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
    </>
  );
});
