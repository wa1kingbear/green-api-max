import type { Message } from '../../../app/model';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseIncomingTextMessage(value: unknown): Message | null {
  if (!isRecord(value) || value.typeWebhook !== 'incomingMessageReceived') {
    return null;
  }

  const senderData = value.senderData;
  const messageData = value.messageData;

  if (
    typeof value.idMessage !== 'string' ||
    !value.idMessage ||
    typeof value.timestamp !== 'number' ||
    !Number.isFinite(value.timestamp) ||
    !isRecord(senderData) ||
    typeof senderData.chatId !== 'string' ||
    !senderData.chatId ||
    !isRecord(messageData) ||
    messageData.typeMessage !== 'textMessage' ||
    !isRecord(messageData.textMessageData) ||
    typeof messageData.textMessageData.textMessage !== 'string'
  ) {
    return null;
  }

  return {
    id: value.idMessage,
    chatId: senderData.chatId,
    direction: 'incoming',
    text: messageData.textMessageData.textMessage,
    timestamp: value.timestamp * 1000,
    status: 'sent',
  };
}
