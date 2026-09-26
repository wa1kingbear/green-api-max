import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

import styles from './IconButton.module.css';

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  label: string;
  tone?: 'plain' | 'accent';
}

export function IconButton({
  children,
  label,
  tone = 'plain',
  className = '',
  ...props
}: PropsWithChildren<IconButtonProps>) {
  return (
    <button
      aria-label={label}
      className={`${styles.button} ${styles[tone]} ${className}`}
      title={label}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
