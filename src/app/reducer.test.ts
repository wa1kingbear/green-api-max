import { appReducer } from './reducer';
import { initialAppState } from './model';

describe('appReducer', () => {
  it('keeps credentials only in memory while connected', () => {
    const credentials = {
      idInstance: '1101000001',
      apiTokenInstance: 'test-token',
    };

    const state = appReducer(initialAppState, {
      type: 'connect',
      payload: credentials,
    });

    expect(state.connection).toBe('connected');
    expect(state.credentials).toEqual(credentials);
  });

  it('opens a chat returned by CheckAccount', () => {
    const chat = {
      chatId: '10000000',
      phoneNumber: '79991234567',
      displayName: '+7 999 123-45-67',
    };

    const state = appReducer(initialAppState, {
      type: 'open-chat',
      payload: chat,
    });

    expect(state.activeChat).toEqual(chat);
    expect(state.messages).toEqual([]);
    expect(state.processedMessageIds.size).toBe(0);
  });

  it('moves an optimistic message from sending to sent', () => {
    const optimisticMessage = {
      id: 'temp-1',
      chatId: 'chat-1',
      direction: 'outgoing' as const,
      text: 'Привет',
      timestamp: 1,
      status: 'sending' as const,
    };
    const sendingState = appReducer(initialAppState, {
      type: 'add-message',
      payload: optimisticMessage,
    });
    const sentState = appReducer(sendingState, {
      type: 'message-sent',
      payload: { temporaryId: 'temp-1', idMessage: '1763115112345' },
    });

    expect(sendingState.messages).toEqual([optimisticMessage]);
    expect(sentState.messages[0]).toMatchObject({
      id: '1763115112345',
      status: 'sent',
    });
  });

  it('marks a message as failed and returns it to sending on retry', () => {
    const stateWithMessage = {
      ...initialAppState,
      messages: [
        {
          id: 'temp-1',
          chatId: 'chat-1',
          direction: 'outgoing' as const,
          text: 'Привет',
          timestamp: 1,
          status: 'sending' as const,
        },
      ],
    };

    const failedState = appReducer(stateWithMessage, {
      type: 'message-failed',
      payload: { id: 'temp-1' },
    });
    const retryingState = appReducer(failedState, {
      type: 'message-retrying',
      payload: { id: 'temp-1' },
    });

    expect(failedState.messages[0]?.status).toBe('failed');
    expect(retryingState.messages[0]?.status).toBe('sending');
  });

  it('adds an incoming message only once', () => {
    const activeChat = {
      chatId: '10000000',
      phoneNumber: '79991234567',
      displayName: '+7 999 123-45-67',
    };
    const message = {
      id: 'incoming-1',
      chatId: '10000000',
      direction: 'incoming' as const,
      text: 'Ответ',
      timestamp: 1,
      status: 'sent' as const,
    };
    const chatState = { ...initialAppState, activeChat };
    const receivedState = appReducer(chatState, {
      type: 'receive-message',
      payload: message,
    });
    const duplicateState = appReducer(receivedState, {
      type: 'receive-message',
      payload: message,
    });

    expect(receivedState.messages).toEqual([message]);
    expect(receivedState.processedMessageIds.has('incoming-1')).toBe(true);
    expect(duplicateState).toBe(receivedState);
  });

  it('marks polling as degraded and clears the error after recovery', () => {
    const connectedState = appReducer(initialAppState, {
      type: 'connect',
      payload: {
        idInstance: '1101000001',
        apiTokenInstance: 'test-token',
      },
    });
    const degradedState = appReducer(connectedState, {
      type: 'polling-degraded',
      payload: {
        code: 'network-error',
        message: 'Соединение потеряно.',
        retryable: true,
      },
    });
    const recoveredState = appReducer(degradedState, {
      type: 'polling-recovered',
    });

    expect(degradedState.connection).toBe('degraded');
    expect(degradedState.pollingError?.code).toBe('network-error');
    expect(recoveredState.connection).toBe('connected');
    expect(recoveredState.pollingError).toBeNull();
  });

  it('clears session data on disconnect', () => {
    const connectedState = {
      ...initialAppState,
      connection: 'connected' as const,
      credentials: {
        idInstance: '1101000001',
        apiTokenInstance: 'test-token',
      },
      messages: [
        {
          id: 'message-1',
          chatId: 'chat-1',
          direction: 'outgoing' as const,
          text: 'Привет',
          timestamp: 1,
          status: 'sent' as const,
        },
      ],
      processedMessageIds: new Set(['message-1']),
    };

    const state = appReducer(connectedState, { type: 'disconnect' });

    expect(state).toEqual(initialAppState);
  });
});
