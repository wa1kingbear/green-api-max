import {
  type Dispatch,
  type PropsWithChildren,
  useCallback,
  useMemo,
  useReducer,
} from 'react';

import {
  clearSelectedInstance,
  loadSelectedInstance,
  saveSelectedInstance,
} from '../shared/lib/selectedInstanceStorage';
import {
  ActiveChatContext,
  AppContext,
  AppDispatchContext,
  ChatListContext,
  ConversationContext,
  ProcessedMessageIdsContext,
  SessionContext,
} from './appContext';
import { type AppAction, type AppState, initialAppState } from './model';
import { appReducer } from './reducer';

function restoreAppState(defaultState: AppState): AppState {
  const credentials = loadSelectedInstance();

  if (!credentials) {
    return defaultState;
  }

  return {
    ...defaultState,
    connection: 'connected',
    credentials,
  };
}

export function AppProvider({ children }: PropsWithChildren) {
  const [state, reducerDispatch] = useReducer(
    appReducer,
    initialAppState,
    restoreAppState,
  );
  const dispatch = useCallback<Dispatch<AppAction>>((action) => {
    if (action.type === 'connect') {
      saveSelectedInstance(action.payload);
    } else if (action.type === 'disconnect') {
      clearSelectedInstance();
    }

    reducerDispatch(action);
  }, []);
  const value = useMemo(() => ({ state, dispatch }), [dispatch, state]);
  const session = useMemo(
    () => ({
      connection: state.connection,
      credentials: state.credentials,
      pollingError: state.pollingError,
    }),
    [state.connection, state.credentials, state.pollingError],
  );
  const chatList = useMemo(
    () => ({
      chats: state.chats,
      chatsStatus: state.chatsStatus,
      chatsError: state.chatsError,
    }),
    [state.chats, state.chatsError, state.chatsStatus],
  );
  const conversation = useMemo(
    () => ({
      messages: state.messages,
      historyStatus: state.historyStatus,
      historyError: state.historyError,
    }),
    [state.historyError, state.historyStatus, state.messages],
  );

  return (
    <AppContext.Provider value={value}>
      <AppDispatchContext.Provider value={dispatch}>
        <SessionContext.Provider value={session}>
          <ChatListContext.Provider value={chatList}>
            <ActiveChatContext.Provider value={state.activeChat}>
              <ConversationContext.Provider value={conversation}>
                <ProcessedMessageIdsContext.Provider value={state.processedMessageIds}>
                  {children}
                </ProcessedMessageIdsContext.Provider>
              </ConversationContext.Provider>
            </ActiveChatContext.Provider>
          </ChatListContext.Provider>
        </SessionContext.Provider>
      </AppDispatchContext.Provider>
    </AppContext.Provider>
  );
}
