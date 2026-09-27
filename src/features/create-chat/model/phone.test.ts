import { formatPhoneNumber, normalizePhoneNumber, validatePhoneNumber } from './phone';

describe('phone number helpers', () => {
  it('removes formatting characters', () => {
    expect(normalizePhoneNumber('+7 (999) 123-45-67')).toBe('79991234567');
  });

  it.each(['79991234567', '375291234567'])(
    'accepts a supported international number: %s',
    (phoneNumber) => {
      expect(validatePhoneNumber(phoneNumber)).toEqual({
        normalized: phoneNumber,
        error: null,
      });
    },
  );

  it('rejects an unsupported country code', () => {
    expect(validatePhoneNumber('+1 202 555 0100').error).toBe('unsupported-country');
  });

  it('rejects a supported prefix with the wrong length', () => {
    expect(validatePhoneNumber('+7 999 123').error).toBe('invalid-length');
  });

  it('formats Russian and Belarusian numbers for display', () => {
    expect(formatPhoneNumber('79991234567')).toBe('+7 999 123-45-67');
    expect(formatPhoneNumber('375291234567')).toBe('+375 29 123-45-67');
  });
});
