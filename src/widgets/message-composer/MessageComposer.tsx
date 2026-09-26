import { PaperPlaneRightIcon } from '@phosphor-icons/react';
import { type SyntheticEvent, useState } from 'react';

import {
  MAX_MESSAGE_LENGTH,
  prepareMessageText,
} from '../../features/send-message/model/message';
import styles from './MessageComposer.module.css';

interface MessageComposerProps {
  onSend: (message: string) => void;
}

export function MessageComposer({ onSend }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const preparedValue = prepareMessageText(value);
  const isEmpty = preparedValue.length === 0;
  const showCounter = value.length >= MAX_MESSAGE_LENGTH - 200;

  const submit = () => {
    if (isEmpty || value.length > MAX_MESSAGE_LENGTH) {
      return;
    }

    onSend(preparedValue);
    setValue('');
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    submit();
  };

  return (
    <form className={styles.wrapper} onSubmit={handleSubmit}>
      <div className={styles.composer}>
        <label className={styles.inputArea}>
          <span className={styles.visuallyHidden}>Сообщение</span>
          <textarea
            aria-label="Сообщение"
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Сообщение…"
            rows={1}
            value={value}
          />
          {showCounter && (
            <span className={styles.counter} aria-live="polite">
              {value.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </label>

        <button
          aria-label="Отправить сообщение"
          className={styles.sendButton}
          disabled={isEmpty}
          type="submit"
        >
          <PaperPlaneRightIcon size={23} weight="fill" />
        </button>
      </div>
    </form>
  );
}
