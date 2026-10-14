import { forwardRef, useEffect, useId, useRef } from 'react';
import type { HTMLAttributes, KeyboardEvent, ReactElement, ReactNode, RefObject } from 'react';
import { cx, getFocusable, useControllable } from '../core';
import { Popup } from './Popup';
import { cloneWithProps } from './internal';
import type { Placement } from './usePosition';

export interface PopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 触发元素（一个能接收 ref 和事件的元素，通常是 <button className="ok-btn">） */
  trigger: ReactElement;
  /** 内容；传函数可以拿到 close */
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  offset?: number;
  /** true：与锚点等宽；'min'：不窄于锚点 */
  matchWidth?: boolean | 'min';
  /** 相对另一个元素定位（默认相对触发元素） */
  anchorRef?: RefObject<Element | null>;
  /** 打开时聚焦的元素；不传则找 [data-autofocus]，再不行是第一个可聚焦元素，最后是浮层本身 */
  initialFocus?: RefObject<HTMLElement | null>;
  /** 打开时是否把焦点移进去。默认 true */
  autoFocus?: boolean;
  closeOnOutsidePress?: boolean;
  closeOnEscape?: boolean;
}

/** 点击触发的非模态浮层：Esc 与点外面关闭，焦点移入、关闭时归还 */
export const Popover = forwardRef<HTMLDivElement, PopoverProps>(function Popover(
  {
    trigger, children, open: openProp, defaultOpen = false, onOpenChange, placement = 'bottom', offset = 8, matchWidth = false,
    anchorRef, initialFocus, autoFocus = true, closeOnOutsidePress = true, closeOnEscape = true,
    id, className, role = 'dialog', onKeyDown, ...rest
  },
  ref,
) {
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const triggerRef = useRef<HTMLElement | null>(null);
  const auto = useId();
  const popId = id ?? `${auto}-popover`;

  const close = (refocus = true) => {
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
    setOpen(false);
  };

  const triggerEl = cloneWithProps(trigger, {
    'aria-haspopup': role === 'dialog' ? 'dialog' : 'true',
    'aria-expanded': open,
    'aria-controls': open ? popId : undefined,
    'data-state': open ? 'open' : 'closed',
    onClick: () => (open ? close(false) : setOpen(true)),
  }, triggerRef);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || e.key !== 'Tab') return;
    const el = e.currentTarget;
    if (!el.contains(e.target as Node)) return;   // 嵌套浮层里的 Tab 不归这一层管
    // 非模态：Tab 走到头就离开浮层。先把焦点还给触发元素，浏览器再从那里继续往下（或往上）走
    const list = getFocusable(el);
    const activeEl = document.activeElement;
    const atEnd = !list.length || activeEl === list[list.length - 1];
    const atStart = !list.length || activeEl === list[0] || activeEl === el;
    if (e.shiftKey ? atStart : atEnd) {
      if (e.shiftKey) e.preventDefault();
      close(true);
    }
  };

  return (
    <>
      {triggerEl}
      <Popup
        {...rest}
        ref={ref}
        id={popId}
        role={role}
        tabIndex={-1}
        open={open}
        anchorRef={anchorRef ?? triggerRef}
        insideRefs={[triggerRef]}
        placement={placement}
        offset={offset}
        matchWidth={matchWidth}
        className={cx('ok-popover', className)}
        onKeyDown={handleKeyDown}
        onDismiss={(reason) => {
          if (reason === 'escape') { if (closeOnEscape) close(true); }
          else if (closeOnOutsidePress) close(false);
        }}
      >
        <PopoverBody open={open} autoFocus={autoFocus} initialFocus={initialFocus}>
          {typeof children === 'function' ? children({ close: () => close(true) }) : children}
        </PopoverBody>
      </Popup>
    </>
  );
});

/** 挂载在浮层里面：等浮层真的进了文档再移焦点 */
function PopoverBody({ open, autoFocus, initialFocus, children }: { open: boolean; autoFocus: boolean; initialFocus?: RefObject<HTMLElement | null>; children: ReactNode }) {
  const marker = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || !autoFocus) return;
    const el = marker.current?.parentElement;
    if (!el || el.contains(document.activeElement)) return;
    const target = initialFocus?.current ?? el.querySelector<HTMLElement>('[data-autofocus]') ?? getFocusable(el)[0] ?? el;
    target.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return <div className="ok-popover__body ok-scroll" ref={marker}>{children}</div>;
}
