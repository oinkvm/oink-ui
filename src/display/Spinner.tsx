import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { cx, TailGlyph, useLocale } from '../core';
import type { DisplaySize } from './types';

interface LoaderBase extends HTMLAttributes<HTMLSpanElement> {
  /** 给读屏的文字，默认“加载中” */
  label?: string;
}

export interface SpinnerProps extends LoaderBase {
  /** tail（默认）：品牌加载器，一截画出来、甩一下、再收回去的尾巴（图案可用 TailProvider 全局替换）；ring：普通的转圈 */
  variant?: 'tail' | 'ring';
  /** sm 20、md 28（原型）、lg 40，或像素值 */
  size?: DisplaySize | number;
}

const SIZES = { sm: 20, md: 28, lg: 40 } as const;

/** 加载器。role="status"，文字只给读屏 */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { variant = 'tail', size = 'md', label: labelProp, className, style, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const label = labelProp ?? t.common.loading;
  const px = typeof size === 'number' ? size : SIZES[size];
  return (
    <span ref={ref} role="status" className={cx('ok-loader', className)} style={{ '--size': `${px}px`, ...style } as CSSProperties} {...rest}>
      {variant === 'tail' ? (
        <TailGlyph className="ok-tail" />
      ) : <span className="ok-spinner" aria-hidden="true" />}
      <span className="ok-sr">{label}</span>
    </span>
  );
});

export type DotsProps = LoaderBase;

/** 三个依次弹跳的圆点：“对方正在输入”这类轻量等待 */
export const Dots = forwardRef<HTMLSpanElement, DotsProps>(function Dots({ label: labelProp, className, ...rest }, ref) {
  const { messages: t } = useLocale();
  const label = labelProp ?? t.common.loading;
  return (
    <span ref={ref} role="status" className={cx('ok-dots', className)} {...rest}>
      <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
      <span className="ok-sr">{label}</span>
    </span>
  );
});
