import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, ReactElement, ReactNode } from 'react';
import { useControllable, useIsoLayoutEffect } from '../core';
import { Menu, MenuRootContext } from './Menu';
import type { MenuProps } from './Menu';
import { Popup } from './Popup';
import { cloneWithProps } from './internal';
import type { VirtualElement } from './usePosition';

export interface ContextMenuProps extends Omit<MenuProps, 'focusOnOpen' | 'bare' | 'children'> {
  /** 响应右键 / 长按的区域（一个能接收 ref 和事件的元素） */
  children: ReactElement;
  /** 菜单项 */
  menu: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** 触屏长按多久弹出（ms）。默认 500 */
  longPressMs?: number;
}

const MOVE_TOLERANCE = 10;

/** 右键菜单：右键、键盘的菜单键 / Shift+F10、触屏长按触发，出现在指针处 */
export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(function ContextMenu(
  { children, menu, open: openProp, onOpenChange, disabled, longPressMs = 500, id, ...rest },
  ref,
) {
  const [open, setOpen] = useControllable(openProp, false, onOpenChange);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const pointRef = useRef(point);
  pointRef.current = point;
  const anchorRef = useRef<VirtualElement>({
    getBoundingClientRect: () => {
      const { x, y } = pointRef.current;
      return { left: x, top: y, right: x, bottom: y, width: 0, height: 0 };
    },
  });
  const updateRef = useRef<(() => void) | null>(null);
  const areaRef = useRef<HTMLElement | null>(null);
  const restore = useRef<HTMLElement | null>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const auto = useId();
  const menuId = id ?? `${auto}-menu`;

  const show = (x: number, y: number) => {
    const active = document.activeElement as HTMLElement | null;
    if (!active?.closest('.ok-popup')) restore.current = active;
    setPoint({ x, y });
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    if (refocus && restore.current?.isConnected) restore.current.focus({ preventScroll: true });
    setOpen(false);
  };
  // 已经开着时再次右键：挪到新位置
  useIsoLayoutEffect(() => { updateRef.current?.(); }, [point]);

  const cancelPress = () => {
    if (press.current) { clearTimeout(press.current.timer); press.current = null; }
  };
  useEffect(() => cancelPress, []);

  // 页面滚动后指针处的内容已经变了，收起
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('.ok-popup')) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, [open, setOpen]);

  const root = useMemo(() => ({
    open,
    close: () => close(true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [open, setOpen]);

  const area = cloneWithProps(children, {
    'data-state': open ? 'open' : 'closed',
    className: 'ok-context-area',
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      if (disabled) return;
      e.preventDefault();
      cancelPress();
      // 键盘触发时没有指针坐标：落在目标元素的左下角
      if (e.clientX === 0 && e.clientY === 0) {
        const r = (e.target as HTMLElement).getBoundingClientRect();
        show(r.left, r.bottom);
      } else show(e.clientX, e.clientY);
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (disabled || e.pointerType !== 'touch') return;
      cancelPress();
      const { clientX: x, clientY: y } = e;
      press.current = { x, y, timer: setTimeout(() => { press.current = null; show(x, y); }, longPressMs) };
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) cancelPress();
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    onPointerLeave: cancelPress,
  }, areaRef);

  return (
    <MenuRootContext.Provider value={root}>
      {area}
      <Popup
        open={open}
        anchorRef={anchorRef}
        placement="bottom-start"
        offset={2}
        className="ok-popup--menu"
        updateRef={updateRef}
        onDismiss={(reason) => close(reason === 'escape')}
      >
        <Menu {...rest} bare id={menuId} ref={ref} focusOnOpen={open ? 'menu' : null}>{menu}</Menu>
      </Popup>
    </MenuRootContext.Provider>
  );
});
