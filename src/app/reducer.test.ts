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
