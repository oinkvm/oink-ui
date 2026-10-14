import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from '../core';

export interface AspectRatioProps extends HTMLAttributes<HTMLDivElement> {
  /** 宽高比：数字（16 / 9）或 '16 / 9' 这样的字符串，默认 16 / 9 */
  ratio?: number | string;
}

/** 固定宽高比的盒子；里面的图片、视频、iframe 自动铺满 */
export const AspectRatio = forwardRef<HTMLDivElement, AspectRatioProps>(function AspectRatio({ ratio = 16 / 9, className, style, ...rest }, ref) {
  return <div ref={ref} className={cx('ok-aspect', className)} style={{ aspectRatio: String(ratio), ...style }} {...rest} />;
});
