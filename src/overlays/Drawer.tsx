import { forwardRef } from 'react';
import { cx, useControllable } from '../core';
import { FloatingCard, resolveFloatSize } from './FloatingCard';
import type { FloatSize, FloatingCardProps } from './FloatingCard';

export type DrawerPlacement = 'left' | 'right' | 'top' | 'bottom';

export interface DrawerProps extends Omit<FloatingCardProps, 'open' | 'placement' | 'size' | 'contained' | 'origin'> {
  /** 受控的开合；不传则用 defaultOpen 自己管 */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 从哪一侧滑入，默认 right */
  placement?: DrawerPlacement;
  /**
   * 主轴尺寸预设。左右是宽度：sm 280 / md 360 / lg 480；上下是高度：sm 240 / md 360 / lg 520。
   * 也可以给数字（px）或 CSS 长度。永远不会超过视口减去四周的间隙。
   */
  size?: FloatSize | number | string;
}

const WIDTHS: Record<FloatSize, number> = { sm: 280, md: 360, lg: 480 };
const HEIGHTS: Record<FloatSize, number> = { sm: 240, md: 360, lg: 520 };

/** 抽屉：贴着一侧滑入的悬浮卡片，默认模态。内容用 FloatingHeader / FloatingBody / FloatingFooter 搭 */
export const Drawer = forwardRef<HTMLDivElement, DrawerProps>(function Drawer(
  { open: openProp, defaultOpen = false, onOpenChange, placement = 'right', size = 'md', modal = true, className, ...rest },
  ref,
) {
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const horizontal = placement === 'left' || placement === 'right';
  return (
    <FloatingCard
      {...rest}
      ref={ref}
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      modal={modal}
      size={resolveFloatSize(size, horizontal ? WIDTHS : HEIGHTS)}
      className={cx('ok-drawer', className)}
    />
  );
});
