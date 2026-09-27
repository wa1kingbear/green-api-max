import {
  ArrowRightIcon,
  SpinnerGapIcon,
  UserPlusIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';

import { isGreenApiError } from '../../../shared/api/greenApiError';
import { IconButton } from '../../../shared/ui/IconButton/IconButton';
import { validatePhoneNumber, type PhoneValidationError } from '../model/phone';
import styles from './NewChatDialog.module.css';

interface NewChatDialogProps {
  onClose: () => void;
  onCreate: (phoneNumber: string) => Promise<void>;
}

const validationMessages: Record<PhoneValidationError, string> = {
  empty: 'Введите номер телефона.',
  'invalid-length': 'Для РФ нужно 11 цифр, для Беларуси — 12.',
  'unsupported-country': 'Сейчас поддерживаются номера РФ и Беларуси.',
};

export function NewChatDialog({ onClose, onCreate }: NewChatDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const isSubmittingRef = useRef(isSubmitting);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
    onCloseRef.current = onClose;
  }, [isSubmitting, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmittingRef.current) {
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled)',
      );

      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const validation = validatePhoneNumber(phoneNumber);

    if (validation.error) {
      setErrorMessage(validationMessages[validation.error]);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onCreate(validation.normalized);
      onClose();
    } catch (error) {
      setErrorMessage(
        isGreenApiError(error)
          ? error.message
          : 'Не удалось создать чат. Попробуйте ещё раз.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-describedby="new-chat-description"
        aria-labelledby="new-chat-title"
        aria-modal="true"
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
      >
        <div className={styles.headingRow}>
          <span className={styles.icon} aria-hidden="true">
            <UserPlusIcon size={27} weight="fill" />
          </span>
          <div>
            <h2 id="new-chat-title">Новый чат</h2>
            <p id="new-chat-description">Найдите пользователя MAX по номеру.</p>
          </div>
          <IconButton
            className={styles.closeButton}
            disabled={isSubmitting}
            label="Закрыть"
            onClick={onClose}
          >
            <XIcon size={22} weight="bold" />
          </IconButton>
        </div>

        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Номер телефона</span>
            <input
              aria-describedby={errorMessage ? 'phone-error' : 'phone-hint'}
              aria-invalid={Boolean(errorMessage)}
              autoComplete="tel"
              autoFocus
              disabled={isSubmitting}
              inputMode="tel"
              name="phoneNumber"
              onChange={(event) => {
                setPhoneNumber(event.target.value);
                setErrorMessage(null);
              }}
              placeholder="+7 (999) 123-45-67"
              type="tel"
              value={phoneNumber}
            />
          </label>

          {errorMessage ? (
            <p className={styles.error} id="phone-error" role="alert">
              <WarningCircleIcon size={19} weight="fill" aria-hidden="true" />
              {errorMessage}
            </p>
          ) : (
            <p className={styles.hint} id="phone-hint">
              Номера РФ и Беларуси в международном формате.
            </p>
          )}

          <button className={styles.submitButton} disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <>
                <SpinnerGapIcon className={styles.spinner} size={21} weight="bold" />
                Проверяем номер…
              </>
            ) : (
              <>
                Продолжить
                <ArrowRightIcon size={20} weight="bold" />
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
