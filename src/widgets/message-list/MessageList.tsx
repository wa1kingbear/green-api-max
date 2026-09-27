import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ClockCountdownIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

interface MessageRowData {
  formattedDate: string;
  message: Message;
  showDateSeparator: boolean;
}

interface VirtualRowMetric {
  end: number;
  row: MessageRowData;
  start: number;
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
const VIRTUALIZATION_THRESHOLD = 80;
const VIRTUAL_OVERSCAN = 500;
const DEFAULT_VIEWPORT_HEIGHT = 640;
const MESSAGE_ROW_GAP = 8;

function getMessageDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function estimateRowHeight(row: MessageRowData): number {
  const explicitLines = row.message.text ? row.message.text.split('\n').length : 0;
  const wrappedLines = row.message.text ? Math.ceil(row.message.text.length / 52) : 0;
  const textLines = Math.max(explicitLines, wrappedLines, row.message.text ? 1 : 0);
  const textHeight = Math.min(textLines, 8) * 20;
  const mediaHeight = row.message.mediaUrl ? 43 : 0;
  const retryHeight = row.message.status === 'failed' ? 35 : 0;
  const separatorHeight = row.showDateSeparator ? 38 : 0;

  return (
    35 + textHeight + mediaHeight + retryHeight + separatorHeight + MESSAGE_ROW_GAP
  );
}

function getVisibleRange(
  metrics: VirtualRowMetric[],
  scrollTop: number,
  viewportHeight: number,
) {
  const visibleStart = Math.max(0, scrollTop - VIRTUAL_OVERSCAN);
  const visibleEnd = scrollTop + viewportHeight + VIRTUAL_OVERSCAN;
  let startIndex = 0;

  while (startIndex < metrics.length && metrics[startIndex]!.end < visibleStart) {
    startIndex += 1;
  }

  let endIndex = startIndex;
  while (endIndex < metrics.length && metrics[endIndex]!.start <= visibleEnd) {
    endIndex += 1;
  }

  return {
    startIndex: Math.min(startIndex, Math.max(metrics.length - 1, 0)),
    endIndex: Math.max(endIndex, Math.min(startIndex + 1, metrics.length)),
  };
}

function buildVirtualMetrics(
  rows: MessageRowData[],
  measuredHeights: Map<string, number>,
) {
  const metrics: VirtualRowMetric[] = [];
  let totalHeight = 0;

  rows.forEach((row) => {
    const start = totalHeight;
    totalHeight += measuredHeights.get(row.message.id) ?? estimateRowHeight(row);
    metrics.push({ end: totalHeight, row, start });
  });

  return { metrics, totalHeight };
}

interface MessageBubbleProps {
  message: Message;
  onRetry: (id: string) => void;
}

const MessageBubble = memo(function MessageBubble({
  message,
  onRetry,
}: MessageBubbleProps) {
  return (
    <article
      className={`${styles.message} ${styles[message.direction]} ${
        message.direction === 'outgoing' && message.status === 'failed'
          ? styles.failed
          : ''
      }`}
    >
      {message.text && <p>{message.text}</p>}
      {message.mediaUrl && (
        <a
          className={styles.mediaLink}
          href={message.mediaUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Открыть медиафайл
        </a>
      )}
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
        {message.direction === 'outgoing' &&
          (message.status === 'delivered' || message.status === 'read') && (
            <span
              className={`${styles.status} ${
                message.status === 'read' ? styles.statusRead : styles.statusDelivered
              }`}
              title={message.status === 'read' ? 'Прочитано' : 'Доставлено'}
            >
              <span className={styles.doubleCheck} aria-hidden="true">
                <CheckIcon size={16} weight="bold" />
                <CheckIcon size={16} weight="bold" />
              </span>
              <span className={styles.visuallyHidden}>
                {message.status === 'read' ? 'Прочитано' : 'Доставлено'}
              </span>
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
  );
});

interface MessageRowProps {
  row: MessageRowData;
  onRetry: (id: string) => void;
}

const MessageRow = memo(function MessageRow({ row, onRetry }: MessageRowProps) {
  return (
    <>
      {row.showDateSeparator && (
        <div
          aria-label={`Сообщения за ${row.formattedDate}`}
          className={styles.dateSeparator}
          role="separator"
        >
          <span>{row.formattedDate}</span>
        </div>
      )}
      <MessageBubble message={row.message} onRetry={onRetry} />
    </>
  );
});

interface VirtualMessageRowProps extends MessageRowProps {
  onMeasure: (id: string, height: number) => void;
  start: number;
}

const VirtualMessageRow = memo(function VirtualMessageRow({
  onMeasure,
  onRetry,
  row,
  start,
}: VirtualMessageRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = rowRef.current;

    if (!element) {
      return undefined;
    }

    const measure = () => {
      const height = element.getBoundingClientRect().height;
      if (height > 0) {
        onMeasure(row.message.id, height);
      }
    };

    measure();

    if (!('ResizeObserver' in window)) {
      return undefined;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onMeasure, row.message.id]);

  return (
    <div
      className={styles.virtualRow}
      data-message-id={row.message.id}
      ref={rowRef}
      style={{ transform: `translateY(${start}px)` }}
    >
      <MessageRow onRetry={onRetry} row={row} />
    </div>
  );
});

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
  const previousVirtualHeightRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);
  const [measuredHeights, setMeasuredHeights] = useState(
    () => new Map<string, number>(),
  );
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [viewport, setViewport] = useState({
    height: DEFAULT_VIEWPORT_HEIGHT,
    scrollTop: 0,
  });
  const rows = useMemo<MessageRowData[]>(
    () =>
      messages.map((message, index) => {
        const previousMessage = messages[index - 1];
        return {
          formattedDate: dateFormatter.format(message.timestamp),
          message,
          showDateSeparator:
            !previousMessage ||
            getMessageDateKey(previousMessage.timestamp) !==
              getMessageDateKey(message.timestamp),
        };
      }),
    [messages],
  );
  const isVirtualized = rows.length > VIRTUALIZATION_THRESHOLD;
  const { metrics, totalHeight } = useMemo(
    () => buildVirtualMetrics(rows, measuredHeights),
    [measuredHeights, rows],
  );
  const { endIndex, startIndex } = useMemo(
    () => getVisibleRange(metrics, viewport.scrollTop, viewport.height),
    [metrics, viewport.height, viewport.scrollTop],
  );
  const visibleMetrics = isVirtualized ? metrics.slice(startIndex, endIndex) : metrics;

  const updateViewport = useCallback(
    (list: HTMLDivElement) => {
      const nextViewport = {
        height: list.clientHeight || DEFAULT_VIEWPORT_HEIGHT,
        scrollTop: list.scrollTop,
      };
      setViewport((current) =>
        current.height === nextViewport.height &&
        current.scrollTop === nextViewport.scrollTop
          ? current
          : nextViewport,
      );
    },
    [setViewport],
  );

  const scheduleViewportUpdate = useCallback(
    (list: HTMLDivElement) => {
      if (scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        updateViewport(list);
      });
    },
    [updateViewport],
  );

  const measureRow = useCallback(
    (id: string, height: number) => {
      setMeasuredHeights((current) => {
        const previousHeight = current.get(id);

        if (previousHeight !== undefined && Math.abs(previousHeight - height) < 1) {
          return current;
        }

        const next = new Map(current);
        next.set(id, height);
        return next;
      });
    },
    [setMeasuredHeights],
  );

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    [],
  );

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
      stickToBottomRef.current = true;
      list.scrollTop = list.scrollHeight;
    }

    previousMessagesRef.current = messages;
    previousScrollHeightRef.current = list.scrollHeight;
    updateViewport(list);
  }, [messages, updateViewport]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const heightChanged = previousVirtualHeightRef.current !== totalHeight;

    if (list && isVirtualized && heightChanged && stickToBottomRef.current) {
      list.scrollTop = list.scrollHeight;
      updateViewport(list);
    }

    previousVirtualHeightRef.current = totalHeight;
  }, [isVirtualized, totalHeight, updateViewport]);

  useLayoutEffect(() => {
    const list = listRef.current;

    if (!list || !isVirtualized || !('ResizeObserver' in window)) {
      return undefined;
    }

    const observer = new ResizeObserver(() => updateViewport(list));
    observer.observe(list);
    return () => observer.disconnect();
  }, [isVirtualized, updateViewport]);

  const handleScroll = () => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= SCROLL_TO_BOTTOM_THRESHOLD;
    setShowScrollToBottom(distanceFromBottom > SCROLL_TO_BOTTOM_THRESHOLD);

    if (isVirtualized) {
      scheduleViewportUpdate(list);
    }
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
    stickToBottomRef.current = true;
    setShowScrollToBottom(false);
    scheduleViewportUpdate(list);
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
          {isVirtualized ? (
            <div
              aria-label={`Виртуализированный список: ${messages.length} сообщений`}
              className={styles.virtualSpace}
              data-testid="virtual-message-list"
              style={{ height: totalHeight }}
            >
              {visibleMetrics.map((metric) => (
                <VirtualMessageRow
                  key={metric.row.message.id}
                  onMeasure={measureRow}
                  onRetry={onRetry}
                  row={metric.row}
                  start={metric.start}
                />
              ))}
            </div>
          ) : (
            rows.map((row) => (
              <MessageRow key={row.message.id} onRetry={onRetry} row={row} />
            ))
          )}
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
