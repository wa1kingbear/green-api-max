import { useEffect, useRef } from 'react';

import { useApp } from '../../../app/useApp';
import { deleteNotification } from '../../../shared/api/deleteNotification';
import { receiveNotification } from '../../../shared/api/receiveNotification';
import { parseIncomingMessage } from './notification';
import { runPolling, startPollingSession } from './polling';

const RECEIVE_TIMEOUT_SECONDS = 10;

export function useReceiveMessages() {
  const { state, dispatch } = useApp();
  const processedMessageIdsRef = useRef(state.processedMessageIds);

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
          const message = parseIncomingMessage(body);

          if (!message || processedMessageIdsRef.current.has(message.id)) {
            return;
          }

          const processedMessageIds = new Set(processedMessageIdsRef.current);
          processedMessageIds.add(message.id);
          processedMessageIdsRef.current = processedMessageIds;
          dispatch({ type: 'receive-message', payload: message });
        },
        onDegraded: (error) => dispatch({ type: 'polling-degraded', payload: error }),
        onRecovered: () => dispatch({ type: 'polling-recovered' }),
      }),
    );
  }, [dispatch, state.credentials]);
}
