import { forwardRef } from 'react';
import { cx, useControllable } from '../core';
import { FloatingCard } from './FloatingCard';
import type { FloatSize, FloatingCardProps } from './FloatingCard';
import { FloatingGrip } from './FloatingParts';

export type SheetSize = 'auto' | FloatSize | 'full';

export interface SheetProps extends Omit<FloatingCardProps, 'open' | 'placement' | 'size' | 'contained' | 'origin'> {
  /** 受控的开合；不传则用 defaultOpen 自己管 */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 高度：auto 跟随内容（默认）；sm 40% / md 60% / lg 85% / full 撑满（都减去间隙）；也可以给数字（px）或 CSS 长度 */
  size?: SheetSize | number | string;
  /** 顶上的抓手，默认带 */
  grip?: boolean;
  /** 按住抓手或头部向下拖拽关闭，默认开 */
  dragToDismiss?: boolean;
  /** 宽屏上是否横向撑满；默认不撑满（最宽 560，居中） */
  stretch?: boolean;
}

const HEIGHTS: Record<string, string | undefined> = { auto: undefined, sm: '40%', md: '60%', lg: '85%', full: '100%' };

/** 底部弹层：从底边升起的悬浮卡片，带抓手，可以向下拖拽关闭。窄屏上代替对话框和抽屉 */
export const Sheet = forwardRef<HTMLDivElement, SheetProps>(function Sheet(
  { open: openProp, defaultOpen = false, onOpenChange, size = 'auto', grip = true, dragToDismiss = true, stretch = false, modal = true, className, children, ...rest },
  ref,
) {
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const height = typeof size === 'string' && size in HEIGHTS ? HEIGHTS[size] : size;
  return (
    <FloatingCard
      {...rest}
      ref={ref}
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
      modal={modal}
      stretch={stretch}
      size={height}
      dragToDismiss={dragToDismiss}
      className={cx('ok-sheet', className)}
    >
      {grip && <FloatingGrip />}
      {children}
    </FloatingCard>
  );
});
