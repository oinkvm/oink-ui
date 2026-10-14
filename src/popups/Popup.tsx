import { createContext, forwardRef, useContext, useEffect, useMemo, useRef } from 'react';
import type { HTMLAttributes, MutableRefObject, RefObject } from 'react';
import { Portal, cx, mergeRefs, useEscape, useEvent, useIsoLayoutEffect, usePresence } from '../core';
import { usePosition } from './usePosition';
import type { Placement, PositionAnchor, PositionInfo } from './usePosition';

/** 嵌套浮层登记处：子浮层（子菜单、Popover 里的 Select…）渲染在各自的 portal 里，点在它们身上不算“点外面” */
interface PopupTree { register: (el: HTMLElement) => () => void }
const PopupTreeContext = createContext<PopupTree | null>(null);

/** 所在浮层是否开着：退场期间为 false。不在浮层里时恒为 true */
const PopupOpenContext = createContext(true);
export const usePopupOpen = () => useContext(PopupOpenContext);

export type DismissReason = 'outside' | 'escape';

export interface PopupProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  /** 定位参照：元素或虚拟矩形 */
  anchorRef: RefObject<PositionAnchor | null>;
  placement?: Placement;
  offset?: number;
  alignOffset?: number;
  padding?: number;
  flip?: boolean;
  shift?: boolean;
  matchWidth?: boolean | 'min';
  /** 点在浮层、锚点和子浮层之外，或按下 Esc */
  onDismiss?: (reason: DismissReason, event: Event) => void;
  /** 除锚点外，另外算作“里面”的元素 */
  insideRefs?: Array<RefObject<HTMLElement | null>>;
  /** 套上浮层表面（底色、圆角、发丝线 + 顶部高光）。默认 true */
  surface?: boolean;
  container?: HTMLElement | null;
  /** 拿到“重新定位”函数（锚点是虚拟矩形、位置变了的时候用） */
  updateRef?: MutableRefObject<(() => void) | null>;
  onPosition?: (info: PositionInfo) => void;
}

/**
 * 锚定浮层的基座（内部使用）：Portal 到 body、position: fixed 定位、进退场、点外面与 Esc 关闭。
 * 不管焦点和语义，由上层组件决定。
 */
export const Popup = forwardRef<HTMLDivElement, PopupProps>(function Popup(props, ref) {
  const { open, container } = props;
  const presence = usePresence(open, 200);
  if (!presence.mounted) return null;
  return (
    <Portal container={container}>
      <PopupBody {...props} ref={ref} state={presence.state} presenceRef={presence.ref} />
    </Portal>
  );
});

interface PopupBodyProps extends PopupProps { state: 'open' | 'closed'; presenceRef: MutableRefObject<HTMLElement | null> }

const PopupBody = forwardRef<HTMLDivElement, PopupBodyProps>(function PopupBody(
  {
    open, anchorRef, placement = 'bottom-start', offset = 8, alignOffset = 0, padding = 8, flip = true, shift = true, matchWidth = false,
    onDismiss, insideRefs, surface = true, container: _container, updateRef, onPosition, state, presenceRef,
    className, children, ...rest
  },
  ref,
) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const { update } = usePosition({ open: true, anchorRef, floatingRef: elRef, placement, offset, alignOffset, padding, flip, shift, matchWidth, onPosition });
  useIsoLayoutEffect(() => {
    if (!updateRef) return;
    updateRef.current = update;
    return () => { updateRef.current = null; };
  }, [updateRef, update]);

  // 嵌套登记：自己和所有后代浮层都算父浮层的“里面”
  const parent = useContext(PopupTreeContext);
  const nodes = useRef(new Set<HTMLElement>());
  const tree = useMemo<PopupTree>(() => ({
    register(el) {
      nodes.current.add(el);
      const off = parent?.register(el);
      return () => { nodes.current.delete(el); off?.(); };
    },
  }), [parent]);
  useEffect(() => {
    const el = elRef.current;
    if (!el || !parent) return;
    return parent.register(el);
  }, [parent]);

  const dismiss = useEvent(onDismiss);
  const extra = useRef(insideRefs);
  extra.current = insideRefs;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (elRef.current?.contains(t)) return;
      const anchor = anchorRef.current;
      if (anchor instanceof Element && anchor.contains(t)) return;
      if (extra.current?.some((r) => r.current?.contains(t))) return;
      for (const n of nodes.current) if (n.contains(t)) return;
      dismiss('outside', e);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, anchorRef, dismiss]);
  useEscape(open && !!onDismiss, () => dismiss('escape', new Event('keydown')));

  return (
    <PopupTreeContext.Provider value={tree}>
      <PopupOpenContext.Provider value={open}>
        <div
          {...rest}
          ref={mergeRefs(ref, elRef, presenceRef as MutableRefObject<HTMLDivElement | null>)}
          className={cx('ok-popup', surface && 'ok-popup--surface', className)}
          data-state={state}
          data-ok-layer=""
        >
          {children}
        </div>
      </PopupOpenContext.Provider>
    </PopupTreeContext.Provider>
  );
});
