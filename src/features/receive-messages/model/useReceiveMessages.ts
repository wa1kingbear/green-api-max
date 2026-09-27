import { useEffect, useRef } from 'react';

import type { Chat } from '../../../app/model';
import { useApp } from '../../../app/useApp';
import { deleteNotification } from '../../../shared/api/deleteNotification';
import { receiveNotification } from '../../../shared/api/receiveNotification';
import { parseIncomingTextMessage } from './notification';
import { runPolling, startPollingSession } from './polling';

const RECEIVE_TIMEOUT_SECONDS = 10;

export function useReceiveMessages() {
  const { state, dispatch } = useApp();
  const activeChatRef = useRef<Chat | null>(state.activeChat);
  const processedMessageIdsRef = useRef(state.processedMessageIds);

  useEffect(() => {
    activeChatRef.current = state.activeChat;
  }, [state.activeChat]);

  useEffect(() => {
    processedMessageIdsRef.current = state.processedMessageIds;
  }, [state.processedMessageIds]);

  useEffect(() => {
    const credentials = state.credentials;

    if (!credentials) {
      return undefined;
    }

    return startPollingSession((signal) =>
      runPolling({
        signal,
        receive: (requestSignal) =>
          receiveNotification({
            credentials,
            receiveTimeout: RECEIVE_TIMEOUT_SECONDS,
            signal: requestSignal,
          }),
        remove: (receiptId, requestSignal) =>
          deleteNotification({ credentials, receiptId, signal: requestSignal }),
        onNotification: (body) => {
          const message = parseIncomingTextMessage(body);
          const activeChat = activeChatRef.current;

          if (
            !message ||
            !activeChat ||
            message.chatId !== activeChat.chatId ||
            processedMessageIdsRef.current.has(message.id)
          ) {
            return;
          }

          const processedMessageIds = new Set(processedMessageIdsRef.current);
          processedMessageIds.add(message.id);
          processedMessageIdsRef.current = processedMessageIds;
          dispatch({ type: 'receive-message', payload: message });
        },
        onDegraded: (error) =>
          dispatch({ type: 'polling-degraded', payload: error }),
        onRecovered: () => dispatch({ type: 'polling-recovered' }),
      }),
    );
  }, [dispatch, state.credentials]);
}
