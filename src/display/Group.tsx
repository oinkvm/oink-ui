import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx, Icon } from '../core';

export interface GroupProps extends HTMLAttributes<HTMLElement> {
  /** 渲染成什么元素，默认 div */
  as?: ElementType;
  /** 紧凑：内边距 16、行高 48 */
  compact?: boolean;
}

/** 设置分组（.ok-group）：一组 Row，行间发丝线，首尾行到四边的距离相等 */
export const Group = forwardRef<HTMLElement, GroupProps>(function Group({ as = 'div', compact, className, ...rest }, ref) {
  const Comp = as as ElementType;
  return <Comp ref={ref} className={cx('ok-group', compact && 'ok-group--compact', className)} {...rest} />;
});

export interface RowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** 静态行渲染成什么元素，默认 div。传了 href 或 interactive 时忽略 */
  as?: ElementType;
  /** 左侧标题 */
  label?: ReactNode;
  /** 标题下的说明 */
  description?: ReactNode;
  /** 标题前的图标 / 头像 */
  leading?: ReactNode;
  /** 纵向堆叠：控件放到标题下面并撑满（滑块、分段这类宽控件）。
   *  'auto'：放得下就左右排，行太窄（标题 + 控件最小宽度 --ok-row-wrap-at，默认 12rem，放不下）时自动换行成上下排 */
  stack?: boolean | 'auto';
  /**
   * 右侧控件区的宽度。默认 'auto'：控件按自身宽度排在最右（开关、值、按钮）。
   * · 'fill'：控件区吃掉标题之外的全部宽度，且至少占一半（--ok-row-control-min，默认 50%）；标题区收缩、换行。
   *   滑块这类可伸展的控件用它；直接放 Slider / RangeSlider 时会自动按 fill 排，不用传。
   * · 数字（px）或 CSS 长度：控件区固定这么宽，行窄时最多缩到 --ok-row-control-min。
   * 不是 'auto' 时，右侧内容包在 .ok-row__control 里。可点击行（href / interactive）不支持
   */
  controlWidth?: 'auto' | 'fill' | number | string;
  /** 整行是链接：渲染成 <a>，末尾带箭头 */
  href?: string;
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
  rel?: string;
  /** 整行是按钮：渲染成 <button type="button">，末尾带箭头 */
  interactive?: boolean;
  disabled?: boolean;
  /** 右侧内容：控件，或可点击行里箭头前的值 */
  children?: ReactNode;
}

/** 列表行（.ok-row）：左标签、右控件 */
export const Row = forwardRef<HTMLElement, RowProps>(function Row(
  { as = 'div', label, description, leading, stack, controlWidth = 'auto', href, target, rel, interactive, disabled, className, children, ...rest }, ref,
) {
  const isLink = href !== undefined;
  const isButton = !isLink && !!interactive;
  const clickable = isLink || isButton;
  const Comp = (isLink ? 'a' : isButton ? 'button' : as) as ElementType;
  const extra = isLink ? { href, target, rel } : isButton ? { type: 'button', disabled } : null;
  const hasText = label != null || description != null;
  const sized = !clickable && controlWidth !== 'auto' && children != null;
  const fill = sized && controlWidth === 'fill';
  const fixed = sized && !fill;
  const control = sized
    ? <span className="ok-row__control" style={fixed ? ({ '--_cw': typeof controlWidth === 'number' ? `${controlWidth}px` : controlWidth } as CSSProperties) : undefined}>{children}</span>
    : children;
  return (
    <Comp
      ref={ref}
      className={cx('ok-row', stack === true && 'ok-row--stack', stack === 'auto' && 'ok-row--wrap', fill && 'ok-row--fill', fixed && 'ok-row--fixed', clickable && 'ok-row--link ok-focusable', className)}
      {...extra}
      {...rest}
    >
      {leading != null && <span className="ok-row__leading">{leading}</span>}
      {hasText && (
        <span className="ok-row__text">
          {label != null && <span className="ok-row__label">{label}</span>}
          {description != null && <span className="ok-row__desc">{description}</span>}
        </span>
      )}
      {clickable && children != null ? <span className="ok-row__value">{children}</span> : control}
      {clickable && <Icon name="chevron-right" className="ok-row__chev" />}
    </Comp>
  );
});
