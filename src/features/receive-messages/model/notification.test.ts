import { parseIncomingTextMessage } from './notification';

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

describe('parseIncomingTextMessage', () => {
  it('converts a MAX text notification to the app message model', () => {
    expect(parseIncomingTextMessage(notification)).toEqual({
      id: '1763115112345',
      chatId: '10000000',
      direction: 'incoming',
      text: 'Ответ из MAX',
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
    { ...notification, idMessage: null },
  ])('ignores unsupported or malformed notifications', (value) => {
    expect(parseIncomingTextMessage(value)).toBeNull();
  });
});
