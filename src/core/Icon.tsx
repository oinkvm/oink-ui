import { forwardRef } from 'react';
import type { SVGAttributes } from 'react';
import { ICONS } from './icons';
import type { IconName } from './icons';
import { cx } from './utils';

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'name'> {
  /** 内置图标名；也可以不传 name，直接把 <path> 写在 children 里 */
  name?: IconName;
  size?: number;
  /** 有含义的图标给一个标签；不传则对读屏隐藏 */
  label?: string;
  filled?: boolean;
}

/** 20×20 描线图标，颜色跟随文字 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon({ name, size, label, filled, className, style, children, ...rest }, ref) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  const sized = size ? { width: size, height: size, ...style } : style;
  const cls = cx('ok-icon', filled && 'ok-icon--fill', className);
  if (name) {
    return <svg ref={ref} viewBox="0 0 20 20" className={cls} style={sized} {...a11y} {...rest} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
  }
  return <svg ref={ref} viewBox="0 0 20 20" className={cls} style={sized} {...a11y} {...rest}>{children}</svg>;
});
