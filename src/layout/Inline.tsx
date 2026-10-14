import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes } from 'react';
import { cx } from '../core';
import { layoutVars, padAttr } from './responsive';
import type { Align, Justify, Responsive, Space, SpacingProps } from './responsive';

export interface InlineProps extends HTMLAttributes<HTMLElement>, SpacingProps {
  as?: ElementType;
  /** 子项间距（间距档位），默认 2 */
  gap?: Responsive<Space>;
  /** 换行后的行距，默认同 gap */
  rowGap?: Responsive<Space>;
  /** 交叉轴（纵向）对齐，默认 center */
  align?: Responsive<Align>;
  /** 主轴（横向）分布，默认 start */
  justify?: Responsive<Justify>;
  /** 放不下时换行，默认 true */
  wrap?: boolean;
}

/** 横向排列，放不下自动换行 */
export const Inline = forwardRef<HTMLElement, InlineProps>(function Inline(
  { as, gap, rowGap, align, justify, wrap = true, padding, paddingX, paddingY, className, style, ...rest },
  ref,
) {
  const Tag: ElementType = as ?? 'div';
  return (
    <Tag
      ref={ref}
      className={cx('ok-l ok-inline', className)}
      data-nowrap={wrap ? undefined : ''}
      data-pad={padAttr({ padding, paddingX, paddingY })}
      style={layoutVars({ gap, rowGap, align, justify, padding, paddingX, paddingY }, style)}
      {...rest}
    />
  );
});

export type ClusterProps = InlineProps;
/** Inline 的别名：一簇可换行的小东西（标签、按钮组） */
export const Cluster = Inline;
