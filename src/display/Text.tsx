import { forwardRef } from 'react';
import type { CSSProperties, ElementType, HTMLAttributes } from 'react';
import { cx } from '../core';
import type { DisplayTone } from './types';

export type TextVariant = 'display' | 'h1' | 'h2' | 'h3' | 'body-l' | 'body' | 'label' | 'caption' | 'micro' | 'mono';
/** default 跟随父级；neutral 是次要色；subtle 是三级色（对比度不足 4.5:1，只用于装饰性文字） */
export type TextTone = 'default' | 'subtle' | DisplayTone;

export interface TextProps extends HTMLAttributes<HTMLElement> {
  /** 字体样式，对应 .ok-t-* */
  variant?: TextVariant;
  /** 渲染成什么元素，默认 span */
  as?: ElementType;
  tone?: TextTone;
  /** 单行省略 */
  truncate?: boolean;
  /** 多行省略的行数 */
  lineClamp?: number;
  align?: 'start' | 'center' | 'end';
}

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { variant = 'body', as = 'span', tone = 'default', truncate, lineClamp, align, className, style, ...rest }, ref,
) {
  const Comp = as as ElementType;
  const clamp = lineClamp && lineClamp > 0 ? ({ '--ok-clamp': lineClamp } as CSSProperties) : undefined;
  return (
    <Comp
      ref={ref}
      className={cx('ok-text', `ok-t-${variant}`, className)}
      data-tone={tone === 'default' ? undefined : tone}
      data-truncate={truncate ? '' : undefined}
      data-clamp={clamp ? '' : undefined}
      data-align={align}
      style={clamp ? { ...clamp, ...style } : style}
      {...rest}
    />
  );
});

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** 语义层级，渲染成 h1–h4 */
  level?: 1 | 2 | 3 | 4;
  /** 视觉大小；默认跟随 level。想要“h2 的语义、h3 的大小”时用它 */
  variant?: 'display' | 'h1' | 'h2' | 'h3' | 'h4';
  tone?: TextTone;
  truncate?: boolean;
  align?: 'start' | 'center' | 'end';
}

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { level = 2, variant, tone = 'default', truncate, align, className, ...rest }, ref,
) {
  const Comp = `h${level}` as 'h1';
  return (
    <Comp
      ref={ref}
      className={cx('ok-text ok-heading', `ok-t-${variant ?? `h${level}`}`, className)}
      data-tone={tone === 'default' ? undefined : tone}
      data-truncate={truncate ? '' : undefined}
      data-align={align}
      {...rest}
    />
  );
});
