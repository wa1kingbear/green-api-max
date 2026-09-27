import { useEffect, useRef } from 'react';

import {
  useAppDispatch,
  useProcessedMessageIds,
  useSessionState,
} from '../../../app/useApp';
import { deleteNotification } from '../../../shared/api/deleteNotification';
import { receiveNotification } from '../../../shared/api/receiveNotification';
import { parseIncomingMessage, parseOutgoingMessageStatus } from './notification';
import { runPolling, startPollingSession } from './polling';

const RECEIVE_TIMEOUT_SECONDS = 10;

export function useReceiveMessages() {
  const dispatch = useAppDispatch();
  const { credentials } = useSessionState();
  const processedMessageIds = useProcessedMessageIds();
  const processedMessageIdsRef = useRef(processedMessageIds);

  useEffect(() => {
    processedMessageIdsRef.current = processedMessageIds;
  }, [processedMessageIds]);

  useEffect(() => {
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
          const statusUpdate = parseOutgoingMessageStatus(body);

          if (statusUpdate) {
            dispatch({ type: 'message-status-updated', payload: statusUpdate });
            return;
          }

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
  }, [credentials, dispatch]);
}
