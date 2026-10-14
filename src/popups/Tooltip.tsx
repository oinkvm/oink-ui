import { useEffect, useId, useRef, useState } from 'react';
import type { FocusEvent, MutableRefObject, PointerEvent, ReactElement, ReactNode } from 'react';
import { Portal, animate, cx, useControllable, useEscape, useEvent, usePresence } from '../core';
import { cloneWithProps } from './internal';
import { usePosition } from './usePosition';
import type { Placement, PositionInfo } from './usePosition';

export interface TooltipProps {
  /** 提示文字。字符串可以写成“文字|快捷键”，竖线后面的部分显示为快捷键 */
  content: ReactNode;
  /** 快捷键提示位 */
  shortcut?: ReactNode;
  /** 被提示的元素（一个能接收 ref 和事件的元素） */
  children: ReactElement;
  placement?: Placement;
  offset?: number;
  /** 首次出现前的等待（ms）。默认 380 */
  delay?: number;
  /** 上一个提示收起后多久之内再次悬停可以跳过等待（ms）。默认 320 */
  skipDelayWithin?: number;
  /** 指针离开后多久收起（ms）。默认 160，期间可以把指针移到提示上 */
  hideDelay?: number;
  disabled?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/** 所有提示共享的状态：同一时间只显示一个；相邻目标之间“热切换” */
const shared = {
  current: null as null | { id: string; hide: (instant: boolean) => void },
  hiddenAt: -Infinity,
  lastPos: null as null | { x: number; y: number },
};

const focusVisible = (el: Element) => {
  try { return el.matches(':focus-visible'); } catch { return true; }
};

/**
 * 文字提示：悬停或键盘聚焦触发，首次延迟出现，相邻提示之间直接滑过去。
 * 触屏不显示（触屏上没有悬停，长按留给系统菜单）；所以不要把必要信息只放在提示里。
 */
export function Tooltip({
  content, shortcut, children, placement = 'top', offset = 8, delay = 380, skipDelayWithin = 320, hideDelay = 160,
  disabled, open: openProp, defaultOpen = false, onOpenChange, className,
}: TooltipProps) {
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const [warm, setWarm] = useState(false);
  const [instant, setInstant] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout>>();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const overTip = useRef(false);
  const overTrigger = useRef(false);
  const pressing = useRef(false);   // 正在提示里按住拖选文字
  const presence = usePresence(open, 250);

  let text = content;
  let keys = shortcut;
  if (typeof content === 'string' && keys == null && content.includes('|')) {
    const i = content.indexOf('|');
    text = content.slice(0, i);
    keys = content.slice(i + 1);
  }

  const clearTimers = () => {
    clearTimeout(showTimer.current); showTimer.current = undefined;
    clearTimeout(hideTimer.current); hideTimer.current = undefined;
  };
  const hide = useEvent((isInstant = false) => {
    clearTimers();
    overTip.current = false;
    pressing.current = false;
    if (shared.current?.id === id) {
      shared.current = null;
      shared.hiddenAt = performance.now();
    }
    setInstant(isInstant);
    setWarm(false);
    setOpen(false);
  });
  const show = useEvent(() => {
    clearTimers();
    if (disabled || open) return;
    const other = shared.current;
    const isWarm = !!other && other.id !== id;
    if (isWarm) other.hide(true);   // 上一个立刻让位，这一个从它的位置滑过来
    else shared.lastPos = null;
    shared.current = { id, hide };
    setInstant(false);
    setWarm(isWarm);
    setOpen(true);
  });
  const enter = () => {
    clearTimeout(hideTimer.current); hideTimer.current = undefined;
    if (disabled || open || showTimer.current) return;
    const skip = (shared.current && shared.current.id !== id) || performance.now() - shared.hiddenAt < skipDelayWithin;
    if (skip || delay <= 0) show();
    else showTimer.current = setTimeout(show, delay);
  };
  /** 离开后稍等片刻再收起：期间指针回到目标或移到提示上，就保持显示 */
  const leave = () => {
    clearTimeout(showTimer.current); showTimer.current = undefined;
    if (!open || hideTimer.current) return;
    hideTimer.current = setTimeout(() => {
      hideTimer.current = undefined;
      if (overTip.current || overTrigger.current || pressing.current) return;
      hide();
    }, hideDelay);
  };

  useEffect(() => () => {
    clearTimers();
    if (shared.current?.id === id) shared.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (disabled && open) hide(); }, [disabled, open, hide]);

  // Esc 走 core 的栈：提示可见时它在栈顶，这一下只收起提示，下面的对话框 / 浮层要再按一次才关
  useEscape(open, () => hide());

  useEffect(() => {
    if (!open) return;
    // 在提示里按下是为了选中文字，不收起；点别处（包括目标本身）立即收起
    const onDown = (e: globalThis.PointerEvent) => {
      if (tipRef.current?.contains(e.target as Node)) { pressing.current = true; return; }
      hide();
    };
    const onUp = () => {
      if (!pressing.current) return;
      pressing.current = false;
      if (!overTip.current) leave();
    };
    const onScroll = () => hide();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hide]);

  const describedBy = (children.props as { 'aria-describedby'?: string })['aria-describedby'];
  const trigger = cloneWithProps(children, {
    'aria-describedby': presence.mounted ? cx(describedBy, id) : describedBy,
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      overTrigger.current = true;
      enter();
    },
    onPointerLeave: () => { overTrigger.current = false; leave(); },
    onFocus: (e: FocusEvent<HTMLElement>) => { if (focusVisible(e.currentTarget)) enter(); },
    onBlur: () => { if (!overTip.current && !pressing.current) hide(); },
  }, triggerRef);

  return (
    <>
      {trigger}
      {presence.mounted && text != null && text !== '' && (
        <Portal>
          <TipBody
            id={id}
            anchorRef={triggerRef}
            tipRef={tipRef}
            presenceRef={presence.ref}
            state={presence.state}
            warm={warm}
            instant={instant}
            placement={placement}
            offset={offset}
            className={className}
            onPointerEnter={() => { overTip.current = true; clearTimeout(hideTimer.current); hideTimer.current = undefined; }}
            onPointerLeave={() => { overTip.current = false; if (!pressing.current) leave(); }}
          >
            {text}
            {keys != null && keys !== '' && <kbd>{keys}</kbd>}
          </TipBody>
        </Portal>
      )}
    </>
  );
}

interface TipBodyProps {
  id: string;
  anchorRef: MutableRefObject<HTMLElement | null>;
  tipRef: MutableRefObject<HTMLDivElement | null>;
  presenceRef: MutableRefObject<HTMLElement | null>;
  state: 'open' | 'closed';
  warm: boolean;
  instant: boolean;
  placement: Placement;
  offset: number;
  className?: string;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  children: ReactNode;
}

function TipBody({ id, anchorRef, tipRef, presenceRef, state, warm, instant, placement, offset, className, onPointerEnter, onPointerLeave, children }: TipBodyProps) {
  const first = useRef(true);
  const onPosition = (info: PositionInfo) => {
    const el = tipRef.current;
    if (!el) return;
    // 提示与目标之间的空隙由一块透明的“桥”补上（宽度覆盖两者），指针移向提示时不会掉出去
    el.style.setProperty('--bl', Math.max(0, info.x - info.anchor.left) + 'px');
    el.style.setProperty('--br', Math.max(0, info.anchor.right - (info.x + info.width)) + 'px');
    const from = shared.lastPos;
    if (first.current && warm && from) {
      // 热切换：从上一个提示的位置滑到自己的位置
      animate(el, [{ translate: `${from.x - info.x}px ${from.y - info.y}px` }, { translate: '0 0' }], { spring: 'snappy' });
    }
    first.current = false;
    shared.lastPos = { x: info.x, y: info.y };
  };
  usePosition({ open: true, anchorRef, floatingRef: tipRef, placement, offset, onPosition });
  return (
    <div
      id={id}
      role="tooltip"
      ref={(node) => { tipRef.current = node; presenceRef.current = node; }}
      className={cx('ok-tip', className)}
      data-state={state}
      data-warm={warm || undefined}
      data-instant={instant || undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>
  );
}
