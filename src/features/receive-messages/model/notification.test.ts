import { parseIncomingMessage, parseOutgoingMessageStatus } from './notification';

const notification = {
  typeWebhook: 'incomingMessageReceived',
  timestamp: 1763115112,
  idMessage: '1763115112345',
  senderData: { chatId: '10000000' },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'Ответ из MAX' },
  },
};

describe('parseIncomingMessage', () => {
  it('converts a MAX text notification to the app message model', () => {
    expect(parseIncomingMessage(notification)).toEqual({
      id: '1763115112345',
      chatId: '10000000',
      direction: 'incoming',
      text: 'Ответ из MAX',
      timestamp: 1763115112000,
      status: 'sent',
    });
  });

  it('converts a MAX media notification to a message with a safe link', () => {
    expect(
      parseIncomingMessage({
        ...notification,
        idMessage: 'image-1',
        messageData: {
          typeMessage: 'imageMessage',
          fileMessageData: {
            downloadUrl: 'https://media.example.com/image.webp',
            caption: 'Фотография',
          },
        },
      }),
    ).toEqual({
      id: 'image-1',
      chatId: '10000000',
      direction: 'incoming',
      text: 'Фотография',
      mediaUrl: 'https://media.example.com/image.webp',
      timestamp: 1763115112000,
      status: 'sent',
    });
  });

  it.each([
    { ...notification, typeWebhook: 'outgoingMessageReceived' },
    {
      ...notification,
      messageData: { typeMessage: 'imageMessage', fileMessageData: {} },
    },
    {
      ...notification,
      messageData: {
        typeMessage: 'imageMessage',
        fileMessageData: { downloadUrl: 'javascript:alert(1)' },
      },
    },
    { ...notification, idMessage: null },
  ])('ignores unsupported or malformed notifications', (value) => {
    expect(parseIncomingMessage(value)).toBeNull();
  });
});

describe('parseOutgoingMessageStatus', () => {
  it.each(['sent', 'delivered', 'read'] as const)(
    'converts the %s status notification',
    (status) => {
      expect(
        parseOutgoingMessageStatus({
          typeWebhook: 'outgoingMessageStatus',
          chatId: '10000000',
          idMessage: 'message-1',
          status,
        }),
      ).toEqual({
        chatId: '10000000',
        idMessage: 'message-1',
        status,
      });
    },
  );

  it('maps terminal delivery errors to failed', () => {
    expect(
      parseOutgoingMessageStatus({
        typeWebhook: 'outgoingMessageStatus',
        chatId: '10000000',
        idMessage: 'message-1',
        status: 'noAccount',
      }),
    ).toEqual({
      chatId: '10000000',
      idMessage: 'message-1',
      status: 'failed',
    });
  });

  it('ignores unrelated or malformed status notifications', () => {
    expect(
      parseOutgoingMessageStatus({
        typeWebhook: 'incomingMessageReceived',
        chatId: '10000000',
        idMessage: 'message-1',
        status: 'read',
      }),
    ).toBeNull();
    expect(
      parseOutgoingMessageStatus({
        typeWebhook: 'outgoingMessageStatus',
        chatId: '10000000',
        idMessage: 'message-1',
        status: 'unknown',
      }),
    ).toBeNull();
  });
});
