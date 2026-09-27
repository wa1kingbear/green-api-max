import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ClockCountdownIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { Fragment, useLayoutEffect, useRef, useState } from 'react';

import type { Message } from '../../app/model';
import styles from './MessageList.module.css';

interface MessageListProps {
  canLoadMore: boolean;
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
  messages: Message[];
  onLoadMore: () => void;
  onRetry: (id: string) => void;
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const SCROLL_TO_BOTTOM_THRESHOLD = 120;

function getMessageDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function MessageList({
  canLoadMore,
  isLoadingMore,
  loadMoreFailed,
  messages,
  onLoadMore,
  onRetry,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const previousMessagesRef = useRef<Message[]>([]);
  const previousScrollHeightRef = useRef(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const previousMessages = previousMessagesRef.current;
    const previousFirstId = previousMessages.at(0)?.id;
    const previousLastId = previousMessages.at(-1)?.id;
    const currentFirstId = messages.at(0)?.id;
    const currentLastId = messages.at(-1)?.id;
    const messagesWerePrepended =
      previousMessages.length > 0 &&
      messages.length > previousMessages.length &&
      previousFirstId !== currentFirstId &&
      previousLastId === currentLastId;

    if (messagesWerePrepended) {
      list.scrollTop += list.scrollHeight - previousScrollHeightRef.current;
    } else if (previousMessages.length === 0 || previousLastId !== currentLastId) {
      list.scrollTop = list.scrollHeight;
    }

    previousMessagesRef.current = messages;
    previousScrollHeightRef.current = list.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    setShowScrollToBottom(distanceFromBottom > SCROLL_TO_BOTTOM_THRESHOLD);
  };

  const scrollToBottom = () => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    list.scrollTo({
      top: list.scrollHeight,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
    setShowScrollToBottom(false);
  };

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <h2>Начните переписку</h2>
        <p>В этом чате пока нет сообщений.</p>
      </div>
    );
  }

  return (
    <div className={styles.viewport}>
      <div
        className={styles.list}
        aria-label="Сообщения"
        aria-live="polite"
        onScroll={handleScroll}
        ref={listRef}
      >
        <div className={styles.inner}>
          {canLoadMore && (
            <div className={styles.historyControl}>
              <button
                className={styles.loadMoreButton}
                disabled={isLoadingMore}
                onClick={onLoadMore}
                type="button"
              >
                {isLoadingMore ? (
                  <span className={styles.loadMoreSpinner} aria-hidden="true" />
                ) : (
                  <ArrowUpIcon size={16} weight="bold" aria-hidden="true" />
                )}
                {isLoadingMore
                  ? 'Загружаем…'
                  : loadMoreFailed
                    ? 'Повторить загрузку'
                    : 'Загрузить еще сообщения'}
              </button>
            </div>
          )}
          {messages.map((message, index) => {
            const previousMessage = messages[index - 1];
            const showDateSeparator =
              !previousMessage ||
              getMessageDateKey(previousMessage.timestamp) !==
                getMessageDateKey(message.timestamp);
            const formattedDate = dateFormatter.format(message.timestamp);

            return (
              <Fragment key={message.id}>
                {showDateSeparator && (
                  <div
                    aria-label={`Сообщения за ${formattedDate}`}
                    className={styles.dateSeparator}
                    role="separator"
                  >
                    <span>{formattedDate}</span>
                  </div>
                )}
                <article
                  className={`${styles.message} ${styles[message.direction]} ${
                    message.direction === 'outgoing' && message.status === 'failed'
                      ? styles.failed
                      : ''
                  }`}
                >
                  <p>{message.text}</p>
                  <footer>
                    <time dateTime={new Date(message.timestamp).toISOString()}>
                      {timeFormatter.format(message.timestamp)}
                    </time>
                    {message.direction === 'outgoing' &&
                      message.status === 'sending' && (
                        <span className={styles.status} title="Отправляется">
                          <ClockCountdownIcon size={15} weight="bold" />
                          <span className={styles.visuallyHidden}>Отправляется</span>
                        </span>
                      )}
                    {message.direction === 'outgoing' && message.status === 'sent' && (
                      <span className={styles.status} title="Отправлено">
                        <CheckIcon size={16} weight="bold" />
                        <span className={styles.visuallyHidden}>Отправлено</span>
                      </span>
                    )}
                  </footer>
                  {message.direction === 'outgoing' && message.status === 'failed' && (
                    <button
                      className={styles.retryButton}
                      onClick={() => onRetry(message.id)}
                      type="button"
                    >
                      <WarningCircleIcon size={17} weight="fill" />
                      Не отправлено · Повторить
                    </button>
                  )}
                </article>
              </Fragment>
            );
          })}
        </div>
      </div>
      {showScrollToBottom && (
        <button
          aria-label="Прокрутить вниз"
          className={styles.scrollToBottomButton}
          onClick={scrollToBottom}
          type="button"
        >
          <ArrowDownIcon size={21} weight="bold" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
