import { Children, Fragment, forwardRef, isValidElement } from 'react';
import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../core';
import { Divider } from './Divider';
import { layoutVars, padAttr } from './responsive';
import type { Align, Justify, Responsive, Space, SpacingProps } from './responsive';

export interface StackProps extends HTMLAttributes<HTMLElement>, SpacingProps {
  as?: ElementType;
  /** 子项间距（间距档位），默认 4 */
  gap?: Responsive<Space>;
  /** 交叉轴（横向）对齐，默认 stretch */
  align?: Responsive<Align>;
  /** 主轴（纵向）分布，默认 start */
  justify?: Responsive<Justify>;
  /** 子项之间插入分隔线：true 用默认的 Divider，也可以传自定义节点 */
  divider?: boolean | ReactNode;
}

/** 纵向排列 */
export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(
  { as, gap, align, justify, divider, padding, paddingX, paddingY, className, style, children, ...rest },
  ref,
) {
  const Tag: ElementType = as ?? 'div';
  let content: ReactNode = children;
  if (divider) {
    const items = Children.toArray(children).filter((c) => c !== null && c !== undefined && typeof c !== 'boolean');
    content = items.map((child, i) => (
      <Fragment key={isValidElement(child) && child.key != null ? child.key : i}>
        {i > 0 && (divider === true ? <Divider /> : divider)}
        {child}
      </Fragment>
    ));
  }
  return (
    <Tag
      ref={ref}
      className={cx('ok-l ok-stack', className)}
      data-pad={padAttr({ padding, paddingX, paddingY })}
      style={layoutVars({ gap, align, justify, padding, paddingX, paddingY }, style)}
      {...rest}
    >
      {content}
    </Tag>
  );
});
