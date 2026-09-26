import {
  EyeIcon,
  EyeSlashIcon,
  LockKeyIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react';
import { type SyntheticEvent, useState } from 'react';

import { useApp } from '../../app/useApp';
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

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const nextErrors = validate(idInstance, apiTokenInstance);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    dispatch({
      type: 'connect',
      payload: {
        idInstance: idInstance.trim(),
        apiTokenInstance: apiTokenInstance.trim(),
      },
    });
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

          <button className={styles.submitButton} type="submit">
            Подключиться
          </button>
        </form>

        <div className={styles.privacyNote}>
          <LockKeyIcon size={19} weight="fill" aria-hidden="true" />
          <p>
            Данные остаются только в памяти вкладки и удаляются после отключения или
            перезагрузки страницы.
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
