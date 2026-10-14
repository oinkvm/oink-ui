import { forwardRef } from 'react';
import type { CSSProperties, ElementType, HTMLAttributes } from 'react';
import { cx } from '../core';
import { layoutVars, padAttr, responsiveVars } from './responsive';
import type { Align, Justify, Responsive, Space, SpacingProps } from './responsive';

export interface GridProps extends HTMLAttributes<HTMLElement>, SpacingProps {
  as?: ElementType;
  /** 列数，等宽。支持响应式：{ base: 1, md: 2, lg: 3 }。默认 1 */
  columns?: Responsive<number>;
  /** 每项的最小宽度（数字按 px）。给了它就改为自动填充：能放几列放几列，忽略 columns */
  minItemWidth?: number | string;
  /** 行列间距（间距档位），默认 4 */
  gap?: Responsive<Space>;
  /** 行距，默认同 gap */
  rowGap?: Responsive<Space>;
  /** 单元格内纵向对齐，默认 stretch */
  align?: Responsive<Align>;
  /** 单元格内横向对齐，默认 stretch */
  justify?: Responsive<Exclude<Justify, 'between' | 'around' | 'evenly'> | 'stretch'>;
}

const JUSTIFY_ITEMS = { start: 'start', center: 'center', end: 'end', stretch: 'stretch' } as const;
const ALIGN_ITEMS = { start: 'start', center: 'center', end: 'end', stretch: 'stretch', baseline: 'baseline' } as const;

/** 等宽栅格 */
export const Grid = forwardRef<HTMLElement, GridProps>(function Grid(
  { as, columns, minItemWidth, gap, rowGap, align, justify, padding, paddingX, paddingY, className, style, ...rest },
  ref,
) {
  const Tag: ElementType = as ?? 'div';
  const auto = minItemWidth !== undefined;
  const vars = {
    ...responsiveVars('cols', auto ? undefined : columns, (v) => Math.max(1, Math.round(v))),
    ...responsiveVars('align', align, (v) => ALIGN_ITEMS[v]),
    ...responsiveVars('justify', justify, (v) => JUSTIFY_ITEMS[v]),
    ...(auto ? { '--ok-grid-min': typeof minItemWidth === 'number' ? `${minItemWidth}px` : minItemWidth } : null),
  } as CSSProperties;
  return (
    <Tag
      ref={ref}
      className={cx('ok-l ok-grid', className)}
      data-auto={auto ? '' : undefined}
      data-pad={padAttr({ padding, paddingX, paddingY })}
      style={layoutVars({ gap, rowGap, padding, paddingX, paddingY }, { ...vars, ...style })}
      {...rest}
    />
  );
});

export interface GridItemProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** 横跨几列；'full' 为整行。支持响应式：{ base: 'full', md: 2 } */
  span?: Responsive<number | 'full'>;
  /** 纵跨几行 */
  rowSpan?: number;
}

/** 栅格里需要跨列 / 跨行的单元格（普通单元格不用包） */
export const GridItem = forwardRef<HTMLElement, GridItemProps>(function GridItem({ as, span, rowSpan, className, style, ...rest }, ref) {
  const Tag: ElementType = as ?? 'div';
  const vars = responsiveVars('span', span, (v) => (v === 'full' ? '1 / -1' : `span ${Math.max(1, Math.round(v))}`)) as CSSProperties;
  return (
    <Tag
      ref={ref}
      className={cx('ok-l ok-grid__item', className)}
      style={{ ...vars, ...(rowSpan ? { gridRow: `span ${rowSpan}` } : null), ...style }}
      {...rest}
    />
  );
});
