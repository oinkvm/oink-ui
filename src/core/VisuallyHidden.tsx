import type { HTMLAttributes } from 'react';
import { cx } from './utils';

/** 只给读屏看的文字 */
export function VisuallyHidden({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('ok-sr', className)} {...rest} />;
}
