import {
  ArrowLeftIcon,
  ChatCircleDotsIcon,
  PlusIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { memo } from 'react';

import {
  useActiveChat,
  useAppDispatch,
  useConversationState,
  useSessionState,
} from '../../app/useApp';
import { useLoadChatHistory } from '../../features/load-chat-history/model/useLoadChatHistory';
import { useSendMessage } from '../../features/send-message/model/useSendMessage';
import { setChatIdInUrl } from '../../shared/lib/chatUrl';
import { IconButton } from '../../shared/ui/IconButton/IconButton';
import { MessageComposer } from '../../widgets/message-composer/MessageComposer';
import { MessageList } from '../../widgets/message-list/MessageList';
import { ChatAvatar } from './ChatAvatar';
import styles from './MessengerPage.module.css';

interface ConversationProps {
  onNewChat: () => void;
}

export const Conversation = memo(function Conversation({
  onNewChat,
}: ConversationProps) {
  const dispatch = useAppDispatch();
  const activeChat = useActiveChat();
  const { connection, pollingError } = useSessionState();
  const { historyError, historyStatus, messages } = useConversationState();
  const { sendMessage, retryMessage } = useSendMessage();
  const { hasMore, isLoadingMore, loadMoreFailed, loadMoreHistory, reloadHistory } =
    useLoadChatHistory();
  const isConnectionDegraded = connection === 'degraded';

  const closeChat = () => {
    setChatIdInUrl(null);
    dispatch({ type: 'close-chat' });
  };

  return (
    <section className={styles.conversation} aria-label="Переписка">
      {activeChat ? (
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
              avatarStatus={activeChat.avatarStatus}
              avatarUrl={activeChat.avatarUrl}
              className={styles.headerAvatar}
              iconSize={38}
            />
            <div>
              <h2>{activeChat.displayName}</h2>
            </div>
          </header>
          {isConnectionDegraded && (
            <div className={styles.connectionNotice} role="status">
              <WarningCircleIcon size={18} weight="fill" aria-hidden="true" />
              <span>
                {pollingError?.message ?? 'Соединение потеряно. Пытаемся восстановить…'}
              </span>
            </div>
          )}
          {historyStatus === 'loading' && messages.length === 0 ? (
            <div className={styles.historyState} role="status">
              <span className={styles.loadingDot} aria-hidden="true" />
              <h2>Загружаем переписку</h2>
              <p>Получаем последние сообщения из MAX.</p>
            </div>
          ) : historyStatus === 'error' && messages.length === 0 ? (
            <div className={styles.historyState}>
              <WarningCircleIcon size={42} weight="fill" aria-hidden="true" />
              <h2>Не удалось загрузить переписку</h2>
              <p>{historyError?.message}</p>
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
              messages={messages}
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
          <button className={styles.primaryButton} onClick={onNewChat} type="button">
            <PlusIcon size={20} weight="bold" />
            Новый чат
          </button>
        </div>
      )}
    </section>
  );
});
