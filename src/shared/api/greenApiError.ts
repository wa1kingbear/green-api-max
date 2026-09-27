export type GreenApiErrorCode =
  | 'invalid-credentials'
  | 'instance-not-authorized'
  | 'invalid-phone'
  | 'account-not-found'
  | 'check-account-limit'
  | 'message-too-long'
  | 'send-message-failed'
  | 'get-chats-failed'
  | 'get-chat-history-failed'
  | 'get-settings-failed'
  | 'receive-notification-failed'
  | 'delete-notification-failed'
  | 'webhook-conflict'
  | 'network-error'
  | 'unexpected-response';

export interface GreenApiErrorOptions {
  code: GreenApiErrorCode;
  message: string;
  retryable: boolean;
  httpStatus?: number;
}

export class GreenApiError extends Error {
  readonly code: GreenApiErrorCode;
  readonly retryable: boolean;
  readonly httpStatus?: number;

  constructor({ code, message, retryable, httpStatus }: GreenApiErrorOptions) {
    super(message);
    this.name = 'GreenApiError';
    this.code = code;
    this.retryable = retryable;
    this.httpStatus = httpStatus;
  }
}

export function isGreenApiError(error: unknown): error is GreenApiError {
  return error instanceof GreenApiError;
}
