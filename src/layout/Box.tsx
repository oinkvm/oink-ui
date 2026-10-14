import { forwardRef } from 'react';
import type { CSSProperties, ElementType, HTMLAttributes } from 'react';
import { cx } from '../core';
import { layoutVars, padAttr } from './responsive';
import type { SpacingProps } from './responsive';

export type BoxSurface = 'bg' | 'surface' | 'card' | 'raised' | 'well';
export type BoxRadius = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'full';

export interface BoxProps extends HTMLAttributes<HTMLElement>, SpacingProps {
  /** 渲染成哪个元素，默认 div */
  as?: ElementType;
  /** 圆角档位，对应 --ok-r-1..6；full 为全圆 */
  radius?: BoxRadius;
  /** 表面色阶：bg 画布 → surface 面板 → card 卡片 → raised 浮起；well 为凹槽 */
  surface?: BoxSurface;
  /** 1px 内描边：true 为 --ok-line，'strong' 为 --ok-line-2 */
  border?: boolean | 'strong';
  /** 顶部 1.5px 高光（只给大块容器） */
  highlight?: boolean;
}

/** 最基础的盒子：只带少量样式属性，其余用 className / style */
export const Box = forwardRef<HTMLElement, BoxProps>(function Box(
  { as, padding, paddingX, paddingY, radius, surface, border, highlight, className, style, ...rest },
  ref,
) {
  const Tag: ElementType = as ?? 'div';
  const vars: Record<string, string> = {};
  if (radius !== undefined) vars['--ok-box-r'] = radius === 0 ? '0px' : `var(--ok-r-${radius})`;
  if (surface) vars['--ok-box-bg'] = `var(--ok-${surface})`;
  return (
    <Tag
      ref={ref}
      className={cx('ok-l ok-box', className)}
      data-pad={padAttr({ padding, paddingX, paddingY })}
      data-radius={radius}
      data-surface={surface}
      data-border={border ? (border === 'strong' ? 'strong' : 'line') : undefined}
      data-highlight={highlight ? '' : undefined}
      style={layoutVars({ padding, paddingX, paddingY }, { ...(vars as CSSProperties), ...style })}
      {...rest}
    />
  );
});
