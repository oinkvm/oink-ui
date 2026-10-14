import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes } from 'react';
import { cx } from '../core';
import { layoutVars, padAttr } from './responsive';
import type { SpacingProps } from './responsive';

export interface CenterProps extends HTMLAttributes<HTMLElement>, SpacingProps {
  as?: ElementType;
  /** 在哪个方向上居中，默认 both */
  axis?: 'both' | 'horizontal' | 'vertical';
  /** 行内（inline-grid），用来把图标之类的小东西居中 */
  inline?: boolean;
}

/** 把内容居中 */
export const Center = forwardRef<HTMLElement, CenterProps>(function Center(
  { as, axis = 'both', inline, padding, paddingX, paddingY, className, style, ...rest },
  ref,
) {
  const Tag: ElementType = as ?? 'div';
  return (
    <Tag
      ref={ref}
      className={cx('ok-l ok-center', className)}
      data-axis={axis}
      data-inline={inline ? '' : undefined}
      data-pad={padAttr({ padding, paddingX, paddingY })}
      style={layoutVars({ padding, paddingX, paddingY }, style)}
      {...rest}
    />
  );
});
