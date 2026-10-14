import { forwardRef } from 'react';
import { cx, useControllable } from '../core';
import { FloatingCard, resolveFloatSize } from './FloatingCard';
import type { FloatSize, FloatingCardProps } from './FloatingCard';

export type PanelPlacement = 'left' | 'right' | 'top' | 'bottom';

export interface PanelProps extends Omit<FloatingCardProps, 'open' | 'placement' | 'size' | 'modal' | 'role' | 'dragToDismiss' | 'origin'> {
  /** 受控的开合；不传则用 defaultOpen 自己管 */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 停靠在哪一侧，默认 right */
  placement?: PanelPlacement;
  /**
   * 主轴尺寸预设。左右是宽度：sm 280 / md 320 / lg 400；上下是高度：sm 200 / md 280 / lg 400。
   * 也可以给数字或 CSS 长度；'auto' 按内容（省略时是 md，不是按内容）
   */
  size?: FloatSize | 'auto' | number | string;
  /** 语义：complementary（默认，页面的辅助区域）、region，或者非模态的 dialog。记得用标题或 aria-label 给它起名 */
  role?: 'complementary' | 'region' | 'dialog';
}

const WIDTHS: Record<FloatSize, number> = { sm: 280, md: 320, lg: 400 };
const HEIGHTS: Record<FloatSize, number> = { sm: 200, md: 280, lg: 400 };

/**
 * 悬浮侧面板：非模态的悬浮卡片。没有遮罩、不锁滚动、不圈焦点，页面其余部分照常可用；
 * 焦点在面板里时 Esc 关闭。配合 container + contained 可以限制在某个区域里。用于检查器、筛选面板。
 *
 * 用户主动点开、接下来要在里面操作的面板请加 autoFocus：打开时焦点移进面板（键盘用户不用 Tab 过整页，Esc 也立刻可用），
 * 关闭时还给触发元素。右下角的悬浮卡片（写信窗口）：placement="bottom" stretch={false} align="end" size="auto"。
 */
export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { open: openProp, defaultOpen = false, onOpenChange, placement = 'right', size = 'md', role = 'complementary', className, ...rest },
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
      modal={false}
      role={role}
      size={resolveFloatSize(size, horizontal ? WIDTHS : HEIGHTS)}
      className={cx('ok-panel-float', className)}
    />
  );
});

/** Panel 的别名：和布局类的“面板”容器同名时用这个 */
export const FloatingPanel = Panel;
export type FloatingPanelProps = PanelProps;
