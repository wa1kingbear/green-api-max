import type { Message } from '../../../app/model';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const MEDIA_MESSAGE_TYPES = new Set([
  'imageMessage',
  'videoMessage',
  'documentMessage',
  'audioMessage',
  'stickerMessage',
]);

function parseMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function parseIncomingMessage(value: unknown): Message | null {
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
    !isRecord(messageData)
  ) {
    return null;
  }

  const textMessageData = messageData.textMessageData;
  const isTextMessage =
    messageData.typeMessage === 'textMessage' &&
    isRecord(textMessageData) &&
    typeof textMessageData.textMessage === 'string';
  const fileMessageData = messageData.fileMessageData;
  const mediaUrl =
    MEDIA_MESSAGE_TYPES.has(String(messageData.typeMessage)) &&
    isRecord(fileMessageData)
      ? parseMediaUrl(fileMessageData.downloadUrl)
      : null;

  if (!isTextMessage && !mediaUrl) {
    return null;
  }

  return {
    id: value.idMessage,
    chatId: senderData.chatId,
    direction: 'incoming',
    text: isTextMessage
      ? String(textMessageData.textMessage)
      : isRecord(fileMessageData) && typeof fileMessageData.caption === 'string'
        ? fileMessageData.caption
        : '',
    ...(mediaUrl ? { mediaUrl } : {}),
    timestamp: value.timestamp * 1000,
    status: 'sent',
  };
}
