import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { OINK_MESSAGES, cx, useLocale } from '../core';

/** 按键名 → 键帽上的符号（照搬原型） */
export const KEY_SYMBOL: Record<string, string> = {
  Meta: '⌘', Control: '⌃', Alt: '⌥', Shift: '⇧', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓',
  ArrowLeft: '←', ArrowRight: '→', Enter: '↩', Backspace: '⌫', Tab: '⇥', Escape: 'Esc',
};
export const keySymbol = (key: string) => KEY_SYMBOL[key] ?? key;
/** 符号读不出来，给读屏一个可读的名字。names 默认中文，组件里传 useLocale().messages.keyNames */
export const keyName = (key: string, names: Record<string, string> = OINK_MESSAGES['zh-CN'].keyNames) => names[key] ?? key;

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** 按键名（KeyboardEvent.key 的写法，如 Meta、Shift、K）：自动换成符号并带上可读名称。也可以直接写 children */
  k?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** 键帽 */
export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd({ k, size = 'md', className, children, ...rest }, ref) {
  const names = useLocale().messages.keyNames;
  const symbol = k ? keySymbol(k) : null;
  return (
    <kbd ref={ref} className={cx('ok-kbd', size !== 'md' && `ok-kbd--${size}`, className)} data-key={k} {...rest}>
      {symbol !== null && symbol !== keyName(k!, names) ? <abbr title={keyName(k!, names)} style={{ textDecoration: 'none' }}>{symbol}</abbr> : symbol ?? children}
    </kbd>
  );
});
