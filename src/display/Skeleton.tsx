import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { cx } from '../core';

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  /** text（默认）：一条文字；circle：头像；rect：图片 / 卡片块 */
  variant?: 'text' | 'circle' | 'rect';
  width?: number | string;
  height?: number | string;
  /** text 时渲染几行，最后一行短一些 */
  lines?: number;
}

const px = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v);

/** 骨架占位。纯装饰，对读屏隐藏；请在外层容器上标 aria-busy="true" */
export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(function Skeleton(
  { variant = 'text', width, height, lines = 1, className, style, ...rest }, ref,
) {
  const cls = cx('ok-skel', variant === 'circle' && 'ok-skel--circle', variant === 'rect' && 'ok-skel--rect');
  if (variant === 'text' && lines > 1) {
    return (
      <span ref={ref} aria-hidden="true" className={cx('ok-skel-lines', className)} style={{ width: px(width), ...style }} {...rest}>
        {Array.from({ length: lines }, (_, i) => <span key={i} className={cls} style={{ height: px(height), width: i === lines - 1 ? '70%' : undefined }} />)}
      </span>
    );
  }
  const size: CSSProperties = variant === 'circle' ? { width: px(width ?? height), height: px(height ?? width) } : { width: px(width), height: px(height) };
  return <span ref={ref} aria-hidden="true" className={cx(cls, className)} style={{ ...size, ...style }} {...rest} />;
});
