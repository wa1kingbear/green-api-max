export type GreenApiErrorCode =
  | 'invalid-credentials'
  | 'instance-not-authorized'
  | 'invalid-phone'
  | 'account-not-found'
  | 'check-account-limit'
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
