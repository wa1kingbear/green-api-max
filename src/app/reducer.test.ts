import { appReducer } from './reducer';
import { initialAppState } from './model';

describe('appReducer', () => {
  it('sets credentials while connected', () => {
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

    expect(state.activeChat).toEqual({ ...chat, unreadCount: 0 });
    expect(state.chats).toEqual([{ ...chat, unreadCount: 0 }]);
    expect(state.messages).toEqual([]);
    expect(state.processedMessageIds.size).toBe(0);
  });

  it('closes the active chat without clearing the loaded chat list', () => {
    const chat = {
      chatId: '10000000',
      phoneNumber: '79991234567',
      displayName: 'Анна',
    };
    const openedState = appReducer(initialAppState, {
      type: 'open-chat',
      payload: chat,
    });
    const state = appReducer(openedState, { type: 'close-chat' });

    expect(state.activeChat).toBeNull();
    expect(state.chats).toHaveLength(1);
    expect(state.messages).toEqual([]);
    expect(state.historyStatus).toBe('idle');
  });

  it('loads chat history and merges messages received while loading', () => {
    const chat = {
      chatId: '10000000',
      phoneNumber: '79991234567',
      displayName: 'Анна',
    };
    const chatState = appReducer(initialAppState, {
      type: 'open-chat',
      payload: chat,
    });
    const liveMessage = {
      id: 'live-message',
      chatId: chat.chatId,
      direction: 'incoming' as const,
      text: 'Новое',
      timestamp: 20,
      status: 'sent' as const,
    };
    const stateWithLiveMessage = appReducer(chatState, {
      type: 'receive-message',
      payload: liveMessage,
    });
    const historyMessage = {
      id: 'history-message',
      chatId: chat.chatId,
      direction: 'outgoing' as const,
      text: 'Старое',
      timestamp: 10,
      status: 'sent' as const,
    };
    const state = appReducer(stateWithLiveMessage, {
      type: 'history-loaded',
      payload: { chatId: chat.chatId, messages: [historyMessage] },
    });

    expect(state.messages).toEqual([historyMessage, liveMessage]);
    expect(state.processedMessageIds).toEqual(
      new Set(['live-message', 'history-message']),
    );
    expect(state.chats[0]).toMatchObject({
      lastMessage: 'Новое',
      lastMessageTimestamp: 20,
    });
  });

  it('updates and raises a chat after an incoming message', () => {
    const stateWithChats = appReducer(initialAppState, {
      type: 'chats-loaded',
      payload: [
        { chatId: 'chat-1', phoneNumber: '70000000001', displayName: 'Первый' },
        { chatId: 'chat-2', phoneNumber: '70000000002', displayName: 'Второй' },
      ],
    });
    const state = appReducer(stateWithChats, {
      type: 'receive-message',
      payload: {
        id: 'incoming-2',
        chatId: 'chat-2',
        direction: 'incoming',
        text: 'Ответ',
        timestamp: 30,
        status: 'sent',
      },
    });

    expect(state.chats.map((chat) => chat.chatId)).toEqual(['chat-2', 'chat-1']);
    expect(state.chats[0]?.lastMessage).toBe('Ответ');
    expect(state.chats[0]?.unreadCount).toBe(1);
  });

  it('uses a media label in the chat preview when there is no caption', () => {
    const stateWithChats = appReducer(initialAppState, {
      type: 'chats-loaded',
      payload: [
        { chatId: 'chat-1', phoneNumber: '70000000001', displayName: 'Первый' },
      ],
    });
    const state = appReducer(stateWithChats, {
      type: 'receive-message',
      payload: {
        id: 'image-1',
        chatId: 'chat-1',
        direction: 'incoming',
        text: '',
        mediaUrl: 'https://media.example.com/image.webp',
        timestamp: 30,
        status: 'sent',
      },
    });

    expect(state.chats[0]?.lastMessage).toBe('Медиафайл');
  });

  it('counts unread messages and clears the count when the chat opens', () => {
    const stateWithChats = appReducer(initialAppState, {
      type: 'chats-loaded',
      payload: [
        { chatId: 'chat-1', phoneNumber: '70000000001', displayName: 'Первый' },
      ],
    });
    const firstMessageState = appReducer(stateWithChats, {
      type: 'receive-message',
      payload: {
        id: 'incoming-1',
        chatId: 'chat-1',
        direction: 'incoming',
        text: 'Первое',
        timestamp: 10,
        status: 'sent',
      },
    });
    const secondMessageState = appReducer(firstMessageState, {
      type: 'receive-message',
      payload: {
        id: 'incoming-2',
        chatId: 'chat-1',
        direction: 'incoming',
        text: 'Второе',
        timestamp: 20,
        status: 'sent',
      },
    });
    const duplicateState = appReducer(secondMessageState, {
      type: 'receive-message',
      payload: {
        id: 'incoming-2',
        chatId: 'chat-1',
        direction: 'incoming',
        text: 'Второе',
        timestamp: 20,
        status: 'sent',
      },
    });
    const openedState = appReducer(duplicateState, {
      type: 'open-chat',
      payload: duplicateState.chats[0]!,
    });

    expect(firstMessageState.chats[0]?.unreadCount).toBe(1);
    expect(secondMessageState.chats[0]?.unreadCount).toBe(2);
    expect(duplicateState).toBe(secondMessageState);
    expect(openedState.chats[0]?.unreadCount).toBe(0);
    expect(openedState.activeChat?.unreadCount).toBe(0);
  });

  it('loads a chat preview without replacing a newer live message', () => {
    const loadedState = appReducer(initialAppState, {
      type: 'chats-loaded',
      payload: [
        {
          chatId: 'chat-1',
          phoneNumber: '70000000001',
          displayName: 'Первый',
          previewStatus: 'loading',
        },
      ],
    });
    const stateWithLiveMessage = appReducer(loadedState, {
      type: 'receive-message',
      payload: {
        id: 'live-message',
        chatId: 'chat-1',
        direction: 'incoming',
        text: 'Новое сообщение',
        timestamp: 20,
        status: 'sent',
      },
    });
    const state = appReducer(stateWithLiveMessage, {
      type: 'chat-preview-loaded',
      payload: {
        chatId: 'chat-1',
        message: {
          id: 'history-message',
          chatId: 'chat-1',
          direction: 'outgoing',
          text: 'Старое сообщение',
          timestamp: 10,
          status: 'sent',
        },
      },
    });

    expect(state.chats[0]).toMatchObject({
      lastMessage: 'Новое сообщение',
      lastMessageTimestamp: 20,
      previewStatus: 'ready',
    });
  });

  it('updates an avatar in the chat list and the active chat', () => {
    const chat = {
      chatId: 'chat-1',
      phoneNumber: '70000000001',
      displayName: 'Первый',
      avatarStatus: 'loading' as const,
    };
    const chatState = appReducer(initialAppState, {
      type: 'open-chat',
      payload: chat,
    });
    const state = appReducer(chatState, {
      type: 'chat-avatar-loaded',
      payload: {
        chatId: chat.chatId,
        avatarUrl: 'https://i.oneme.ru/avatar.jpg',
      },
    });

    expect(state.chats[0]).toMatchObject({
      avatarUrl: 'https://i.oneme.ru/avatar.jpg',
      avatarStatus: 'ready',
    });
    expect(state.activeChat).toMatchObject({
      avatarUrl: 'https://i.oneme.ru/avatar.jpg',
      avatarStatus: 'ready',
    });
  });

  it('applies batched preview and avatar updates in one reducer action', () => {
    const chats = [
      {
        chatId: 'chat-1',
        phoneNumber: '70000000001',
        displayName: 'Первый',
        avatarStatus: 'idle' as const,
        previewStatus: 'idle' as const,
      },
      {
        chatId: 'chat-2',
        phoneNumber: '70000000002',
        displayName: 'Второй',
        avatarStatus: 'idle' as const,
        previewStatus: 'idle' as const,
      },
    ];
    const loadedState = appReducer(initialAppState, {
      type: 'chats-loaded',
      payload: chats,
    });
    const state = appReducer(loadedState, {
      type: 'chat-details-updated',
      payload: [
        {
          chatId: 'chat-1',
          avatar: {
            status: 'ready',
            avatarUrl: 'https://i.oneme.ru/avatar.jpg',
          },
          preview: {
            status: 'ready',
            message: {
              id: 'message-1',
              chatId: 'chat-1',
              direction: 'incoming',
              text: 'Новое сообщение',
              timestamp: 10,
              status: 'sent',
            },
          },
        },
        {
          chatId: 'chat-2',
          avatar: { status: 'error' },
          preview: { status: 'error' },
        },
      ],
    });

    expect(state.chats[0]).toMatchObject({
      avatarStatus: 'ready',
      avatarUrl: 'https://i.oneme.ru/avatar.jpg',
      lastMessage: 'Новое сообщение',
      previewStatus: 'ready',
    });
    expect(state.chats[1]).toMatchObject({
      avatarStatus: 'error',
      previewStatus: 'error',
    });
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

  it('advances outgoing message delivery statuses without downgrading them', () => {
    const stateWithMessage = {
      ...initialAppState,
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
    };
    const deliveredState = appReducer(stateWithMessage, {
      type: 'message-status-updated',
      payload: {
        idMessage: 'message-1',
        chatId: 'chat-1',
        status: 'delivered',
      },
    });
    const readState = appReducer(deliveredState, {
      type: 'message-status-updated',
      payload: {
        idMessage: 'message-1',
        chatId: 'chat-1',
        status: 'read',
      },
    });
    const staleState = appReducer(readState, {
      type: 'message-status-updated',
      payload: {
        idMessage: 'message-1',
        chatId: 'chat-1',
        status: 'delivered',
      },
    });

    expect(deliveredState.messages[0]?.status).toBe('delivered');
    expect(readState.messages[0]?.status).toBe('read');
    expect(staleState.messages[0]?.status).toBe('read');
  });

  it('applies a delivery status received before the send response', () => {
    const sendingState = appReducer(initialAppState, {
      type: 'add-message',
      payload: {
        id: 'temp-1',
        chatId: 'chat-1',
        direction: 'outgoing',
        text: 'Привет',
        timestamp: 1,
        status: 'sending',
      },
    });
    const statusReceivedState = appReducer(sendingState, {
      type: 'message-status-updated',
      payload: {
        idMessage: 'message-1',
        chatId: 'chat-1',
        status: 'read',
      },
    });
    const sentState = appReducer(statusReceivedState, {
      type: 'message-sent',
      payload: { temporaryId: 'temp-1', idMessage: 'message-1' },
    });

    expect(statusReceivedState.pendingMessageStatuses.get('message-1')).toEqual({
      chatId: 'chat-1',
      status: 'read',
    });
    expect(sentState.messages[0]).toMatchObject({
      id: 'message-1',
      status: 'read',
    });
    expect(sentState.pendingMessageStatuses.size).toBe(0);
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
    const chatState = appReducer(initialAppState, {
      type: 'open-chat',
      payload: activeChat,
    });
    const receivedState = appReducer(chatState, {
      type: 'receive-message',
      payload: message,
    });
    const duplicateState = appReducer(receivedState, {
      type: 'receive-message',
      payload: message,
    });

    expect(receivedState.messages).toEqual([message]);
    expect(receivedState.chats[0]?.unreadCount).toBe(0);
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
