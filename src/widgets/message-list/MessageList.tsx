import {
  CheckIcon,
  ClockCountdownIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';

import type { Message } from '../../app/model';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
  onRetry: (id: string) => void;
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

export function MessageList({ messages, onRetry }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <h2>Начните переписку</h2>
        <p>В этом чате пока нет сообщений.</p>
      </div>
    );
  }

  return (
    <div className={styles.list} aria-label="Сообщения" aria-live="polite">
      <div className={styles.inner}>
        {messages.map((message) => (
          <article
            className={`${styles.message} ${styles[message.direction]} ${
              message.direction === 'outgoing' && message.status === 'failed'
                ? styles.failed
                : ''
            }`}
            key={message.id}
          >
            <p>{message.text}</p>
            <footer>
              <time dateTime={new Date(message.timestamp).toISOString()}>
                {timeFormatter.format(message.timestamp)}
              </time>
              {message.direction === 'outgoing' && message.status === 'sending' && (
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
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
