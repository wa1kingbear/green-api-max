import {
  ChatCircleDotsIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SignOutIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';

import { useApp } from '../../app/useApp';
import { IconButton } from '../../shared/ui/IconButton/IconButton';
import styles from './MessengerPage.module.css';

export function MessengerPage() {
  const { dispatch } = useApp();

  return (
    <main className={styles.shell}>
      <nav className={styles.rail} aria-label="Основная навигация">
        <div className={styles.railTop}>
          <button
            className={`${styles.railItem} ${styles.railItemActive}`}
            type="button"
          >
            <ChatCircleDotsIcon size={27} weight="fill" />
            <span>Чаты</span>
          </button>
          <button className={styles.railItem} type="button">
            <UsersThreeIcon size={27} weight="fill" />
            <span>Контакты</span>
          </button>
        </div>
        <button
          className={styles.railItem}
          onClick={() => dispatch({ type: 'disconnect' })}
          type="button"
        >
          <SignOutIcon size={27} weight="fill" />
          <span>Выйти</span>
        </button>
      </nav>

      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <div>
            <h1>Чаты</h1>
            <span className={styles.connectionStatus}>Подключено</span>
          </div>
          <IconButton label="Новый чат" tone="accent">
            <PlusIcon size={25} weight="bold" />
          </IconButton>
        </header>

        <label className={styles.search}>
          <MagnifyingGlassIcon size={21} aria-hidden="true" />
          <span className={styles.visuallyHidden}>Найти чат</span>
          <input disabled placeholder="Найти" type="search" />
        </label>

        <section className={styles.emptyList} aria-label="Список чатов">
          <span className={styles.avatarFallback} aria-hidden="true">
            <UserCircleIcon size={46} weight="fill" />
          </span>
          <h2>Здесь появятся чаты</h2>
          <p>Создайте первый диалог по номеру телефона.</p>
          <button className={styles.secondaryButton} type="button">
            <PlusIcon size={20} weight="bold" />
            Новый чат
          </button>
        </section>

        <footer className={styles.mobileFooter}>
          <button type="button">
            <UsersThreeIcon size={27} weight="fill" />
            Контакты
          </button>
          <button className={styles.mobileFooterActive} type="button">
            <ChatCircleDotsIcon size={27} weight="fill" />
            Чаты
          </button>
          <button onClick={() => dispatch({ type: 'disconnect' })} type="button">
            <GearSixIcon size={27} weight="fill" />
            Выйти
          </button>
        </footer>
      </aside>

      <section className={styles.conversation} aria-label="Переписка">
        <div className={styles.emptyConversation}>
          <span className={styles.chatGlyph} aria-hidden="true">
            <ChatCircleDotsIcon size={40} weight="fill" />
          </span>
          <h2>Выберите или создайте чат</h2>
          <p>Здесь появится переписка с пользователем MAX.</p>
          <button className={styles.primaryButton} type="button">
            <PlusIcon size={20} weight="bold" />
            Новый чат
          </button>
        </div>
      </section>
    </main>
  );
}
