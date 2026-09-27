import {
  EyeIcon,
  EyeSlashIcon,
  LockKeyIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react';
import { type SyntheticEvent, useState } from 'react';

import { useApp } from '../../app/useApp';
import { getSettings } from '../../shared/api/getSettings';
import { isGreenApiError } from '../../shared/api/greenApiError';
import styles from './ConnectionPage.module.css';

interface FormErrors {
  idInstance?: string;
  apiTokenInstance?: string;
}

function validate(idInstance: string, apiTokenInstance: string): FormErrors {
  const errors: FormErrors = {};

  if (!idInstance.trim()) {
    errors.idInstance = 'Введите ID инстанса';
  } else if (!/^\d+$/.test(idInstance.trim())) {
    errors.idInstance = 'ID инстанса должен содержать только цифры';
  }

  if (!apiTokenInstance.trim()) {
    errors.apiTokenInstance = 'Введите API-токен инстанса';
  }

  return errors;
}

export function ConnectionPage() {
  const { dispatch } = useApp();
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [settingsIssues, setSettingsIssues] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const nextErrors = validate(idInstance, apiTokenInstance);
    setErrors(nextErrors);
    setConnectionError(null);
    setSettingsIssues([]);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const credentials = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    };

    setIsConnecting(true);

    try {
      const settings = await getSettings({ credentials });
      const issues: string[] = [];

      if (settings.incomingWebhook !== 'yes') {
        issues.push(
          'Включите «Получать уведомления о входящих сообщениях и файлах» в настройках инстанса GREEN-API.',
        );
      }

      if (settings.webhookUrl.trim()) {
        issues.push('Для HTTP API очистите webhookUrl в настройках инстанса.');
      }

      if (issues.length > 0) {
        setSettingsIssues(issues);
        return;
      }

      dispatch({ type: 'connect', payload: credentials });
    } catch (error) {
      setConnectionError(
        isGreenApiError(error)
          ? error.message
          : 'Не удалось проверить настройки инстанса. Попробуйте ещё раз.',
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="connection-title">
        <div className={styles.brand}>MAX Chat</div>

        <div className={styles.intro}>
          <span className={styles.securityIcon} aria-hidden="true">
            <ShieldCheckIcon size={30} weight="fill" />
          </span>
          <div>
            <h1 id="connection-title">Подключите GREEN-API</h1>
            <p>Введите параметры инстанса, авторизованного в MAX.</p>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span>ID инстанса</span>
            <input
              aria-describedby={errors.idInstance ? 'id-instance-error' : undefined}
              aria-invalid={Boolean(errors.idInstance)}
              autoComplete="off"
              inputMode="numeric"
              name="idInstance"
              onChange={(event) => setIdInstance(event.target.value)}
              placeholder="Например, 1101000001"
              value={idInstance}
            />
            {errors.idInstance && (
              <small id="id-instance-error" role="alert">
                {errors.idInstance}
              </small>
            )}
          </label>

          <label className={styles.field}>
            <span>API-токен инстанса</span>
            <span className={styles.tokenField}>
              <input
                aria-describedby={
                  errors.apiTokenInstance ? 'api-token-error' : undefined
                }
                aria-invalid={Boolean(errors.apiTokenInstance)}
                autoComplete="off"
                name="apiTokenInstance"
                onChange={(event) => setApiTokenInstance(event.target.value)}
                placeholder="Введите токен"
                type={isTokenVisible ? 'text' : 'password'}
                value={apiTokenInstance}
              />
              <button
                aria-label={isTokenVisible ? 'Скрыть токен' : 'Показать токен'}
                className={styles.revealButton}
                onClick={() => setIsTokenVisible((value) => !value)}
                type="button"
              >
                {isTokenVisible ? <EyeSlashIcon size={22} /> : <EyeIcon size={22} />}
              </button>
            </span>
            {errors.apiTokenInstance && (
              <small id="api-token-error" role="alert">
                {errors.apiTokenInstance}
              </small>
            )}
          </label>

          {(connectionError || settingsIssues.length > 0) && (
            <div className={styles.connectionError} role="alert">
              {connectionError ? (
                <p>{connectionError}</p>
              ) : (
                <>
                  <p>Проверьте настройки инстанса:</p>
                  <ul>
                    {settingsIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                  <p>После исправления повторите подключение.</p>
                </>
              )}
            </div>
          )}

          <button className={styles.submitButton} disabled={isConnecting} type="submit">
            {isConnecting ? 'Проверяем настройки…' : 'Подключиться'}
          </button>
        </form>

        <div className={styles.privacyNote}>
          <LockKeyIcon size={19} weight="fill" aria-hidden="true" />
          <p>
            Данные сохраняются в этом браузере и удаляются после выхода из
            приложения. Не подключайтесь на чужом устройстве.
          </p>
        </div>

        <a
          className={styles.helpLink}
          href="https://green-api.com/v3/docs/before-start/"
          rel="noreferrer"
          target="_blank"
        >
          Как подготовить инстанс
        </a>
      </section>
    </main>
  );
}
