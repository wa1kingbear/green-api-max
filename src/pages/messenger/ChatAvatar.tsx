import { UserCircleIcon } from '@phosphor-icons/react';

import styles from './MessengerPage.module.css';

interface ChatAvatarProps {
  avatarStatus?: string;
  avatarUrl?: string;
  className: string;
  iconSize: number;
  lazy?: boolean;
}

export function ChatAvatar({
  avatarStatus,
  avatarUrl,
  className,
  iconSize,
  lazy = false,
}: ChatAvatarProps) {
  return (
    <span className={className} aria-hidden="true">
      {avatarStatus === 'loading' && !avatarUrl ? (
        <span className={styles.avatarSkeleton} />
      ) : (
        <UserCircleIcon size={iconSize} weight="fill" />
      )}
      {avatarUrl && (
        <img
          alt=""
          className={styles.avatarImage}
          decoding="async"
          loading={lazy ? 'lazy' : 'eager'}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
          referrerPolicy="no-referrer"
          src={avatarUrl}
        />
      )}
    </span>
  );
}
