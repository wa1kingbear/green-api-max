export type PhoneValidationError = 'empty' | 'unsupported-country' | 'invalid-length';

export interface PhoneValidationResult {
  normalized: string;
  error: PhoneValidationError | null;
}

export function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

export function validatePhoneNumber(value: string): PhoneValidationResult {
  const normalized = normalizePhoneNumber(value);

  if (!normalized) {
    return { normalized, error: 'empty' };
  }

  if (normalized.startsWith('7')) {
    return {
      normalized,
      error: normalized.length === 11 ? null : 'invalid-length',
    };
  }

  if (normalized.startsWith('375')) {
    return {
      normalized,
      error: normalized.length === 12 ? null : 'invalid-length',
    };
  }

  return { normalized, error: 'unsupported-country' };
}

export function formatPhoneNumber(phoneNumber: string): string {
  if (/^7\d{10}$/.test(phoneNumber)) {
    return phoneNumber.replace(/^(7)(\d{3})(\d{3})(\d{2})(\d{2})$/, '+$1 $2 $3-$4-$5');
  }

  if (/^375\d{9}$/.test(phoneNumber)) {
    return phoneNumber.replace(
      /^(375)(\d{2})(\d{3})(\d{2})(\d{2})$/,
      '+$1 $2 $3-$4-$5',
    );
  }

  return `+${phoneNumber}`;
}
