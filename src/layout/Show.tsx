import { Fragment, forwardRef } from 'react';
import type { ElementType, HTMLAttributes } from 'react';
import { cx } from '../core';
import type { Breakpoint } from '../core';

export interface ShowProps extends HTMLAttributes<HTMLElement> {
  /**
   * 不传时包裹层是 display: contents 的 <div>：它自己不产生盒子，子节点直接参与外层的布局。
   * 所以这时传给它的 className / style 里的盒子样式（内外边距、宽高、背景、flex / grid 属性……）都不生效，
   * 只有会继承的属性（color、font 等）有用。
   * 需要一个真实的盒子时传 as（'div'、'span'、'li'、Stack……）：它就是那个元素本身，className / style / 布局属性照常生效，
   * 显隐仍然由 CSS 按断点切 display: none。传 Fragment 等同于不传。
   */
  as?: ElementType;
  /** 视口不小于该断点时才显示 */
  above?: Breakpoint;
  /** 视口小于该断点时才显示 */
  below?: Breakpoint;
}

/** 传了 as（且不是 Fragment）就是真实的盒子 */
const resolve = (as: ElementType | undefined): { Tag: ElementType; box: boolean } => {
  const box = as !== undefined && as !== null && as !== Fragment;
  return { Tag: box ? as : 'div', box };
};

/** 按断点显示：<Show above="md">。纯 CSS，内容始终在 DOM 里，只是 display: none。默认不产生盒子，见 as 的说明 */
export const Show = forwardRef<HTMLElement, ShowProps>(function Show({ as, above, below, className, ...rest }, ref) {
  const { Tag, box } = resolve(as);
  return <Tag ref={ref} className={cx('ok-show', className)} data-box={box ? '' : undefined} data-ok-hide-below={above} data-ok-hide-above={below} {...rest} />;
});

export interface HideProps extends HTMLAttributes<HTMLElement> {
  /** 同 Show：不传时是 display: contents（className / 盒子样式不生效）；传了就是真实的盒子 */
  as?: ElementType;
  /** 视口小于该断点时隐藏 */
  below?: Breakpoint;
  /** 视口不小于该断点时隐藏 */
  above?: Breakpoint;
}

/** 按断点隐藏：<Hide below="md">。纯 CSS。默认不产生盒子，见 as 的说明 */
export const Hide = forwardRef<HTMLElement, HideProps>(function Hide({ as, above, below, className, ...rest }, ref) {
  const { Tag, box } = resolve(as);
  return <Tag ref={ref} className={cx('ok-show', className)} data-box={box ? '' : undefined} data-ok-hide-below={below} data-ok-hide-above={above} {...rest} />;
});
