export const MAX_MESSAGE_LENGTH = 4000;

export function prepareMessageText(value: string): string {
  return value.trim();
}

export function createTemporaryMessageId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
