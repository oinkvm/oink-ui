import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes } from 'react';
import { cx } from '../core';
import type { ContainerSize } from './Container';
import { layoutVars } from './responsive';
import type { Responsive, Space } from './responsive';

export interface PageProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** 内容最大宽度档位（同 Container），默认 lg */
  size?: ContainerSize;
  /** 各区块之间的间距（间距档位），默认 8 */
  gap?: Responsive<Space>;
  /** 上下留白，默认 true */
  padded?: boolean;
}

/** 一页内容的外框：限宽、左右留白、区块纵向排开。放在 AppShell.Main 或 <main> 里 */
export const Page = forwardRef<HTMLElement, PageProps>(function Page({ as, size = 'lg', gap, padded = true, className, style, ...rest }, ref) {
  const Tag: ElementType = as ?? 'div';
  return (
    <Tag
      ref={ref}
      className={cx('ok-l ok-container ok-page', className)}
      data-size={size}
      data-padded={padded ? undefined : 'false'}
      style={layoutVars({ gap }, style)}
      {...rest}
    />
  );
});
