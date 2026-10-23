import { createContext, forwardRef, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent, MouseEvent, ReactElement, ReactNode } from 'react';
import { Icon, cx, mergeRefs, useControllable, useEvent } from '../core';
import type { IconName } from '../core';
import { Popup, usePopupOpen } from './Popup';
import type { Placement } from './usePosition';
import { CheckMark, cloneWithProps, isTypeaheadKey, renderIcon, towardSubmenu, useHeld, useHighlight, useTypeahead } from './internal';
import type { MenuTone, Point } from './internal';

/* ---------------------------------------------------------------------------
   上下文
   --------------------------------------------------------------------------- */
export type MenuCloseReason = 'select' | 'tab';
/** 整棵菜单（含子菜单）的根：由 DropdownMenu / ContextMenu 提供 */
interface MenuRootValue { open: boolean; close: (reason: MenuCloseReason) => void }
export const MenuRootContext = createContext<MenuRootValue | null>(null);

interface MenuValue {
  highlight: (el: HTMLElement | null) => void;
  openSub: string | null;
  setOpenSub: (id: string | null) => void;
  /** 指针正沿“安全三角”朝开着的子菜单移动：途经的其它项不抢高亮、不收起子菜单 */
  holding: () => boolean;
  /** 指针落在禁用项 / 空白处：高亮淡出，收起子菜单，焦点交还菜单本身 */
  clear: () => void;
}
const MenuContext = createContext<MenuValue | null>(null);

const ITEM = '[data-ok-item]:not([aria-disabled="true"])';
/** 所有项，包括禁用项（禁用项自己处理指针：高亮淡出） */
const ITEM_ANY = '[data-ok-item]';
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
/** 指针停在安全三角里不动超过这么久，就按它脚下的项处理（不会一直卡着） */
const SETTLE_MS = 150;
const textOf = (el: HTMLElement) => el.dataset.text ?? el.querySelector('.ok-menu__label')?.textContent ?? el.textContent ?? '';

/* ---------------------------------------------------------------------------
   Menu：role="menu" 的列表本体（方向键、Home / End、首字母跳转、共享高亮块）
   --------------------------------------------------------------------------- */
export interface MenuProps extends HTMLAttributes<HTMLDivElement> {
  /** 打开时把焦点放到哪：第一项 / 最后一项 / 菜单本身。传 null 表示不动焦点 */
  focusOnOpen?: 'first' | 'last' | 'menu' | null;
  /** 不带浮层表面（放在 Popup 里时用）。单独使用时默认带表面 */
  bare?: boolean;
}

export const Menu = forwardRef<HTMLDivElement, MenuProps>(function Menu(
  { focusOnOpen = null, bare = false, className, children, onKeyDown, onPointerMove, onPointerLeave, onFocus, ...rest },
  ref,
) {
  const root = useContext(MenuRootContext);
  const elRef = useRef<HTMLDivElement | null>(null);
  const { hlRef, moveTo } = useHighlight();
  const [openSub, setOpenSub] = useState<string | null>(null);
  const typeahead = useTypeahead();
  /** 指针上一次的位置（安全三角的顶点） */
  const pointer = useRef<Point | null>(null);
  const hold = useRef(false);
  const holding = useEvent(() => hold.current);
  const clear = useEvent(() => {
    hold.current = false;
    setOpenSub(null);
    moveTo(null);
    // 焦点在某一项上才交回菜单本身；在菜单里的输入框等控件上则不动，指针离开不打断输入
    const el = elRef.current;
    const active = document.activeElement;
    if (el && active !== el && active?.matches(ITEM_ANY) && el.contains(active)) el.focus({ preventScroll: true });
  });
  const value = useMemo<MenuValue>(() => ({ highlight: moveTo, openSub, setOpenSub, holding, clear }), [moveTo, openSub, holding, clear]);

  const items = () => Array.from(elRef.current?.querySelectorAll<HTMLElement>(ITEM) ?? []);

  // 子菜单开着时跟踪指针：朝子菜单移动（在安全三角里）就保持，否则立即让位给指针下面的东西
  useEffect(() => {
    if (!openSub) return;
    hold.current = false;
    /** 指针进过子菜单之后，再移到两个菜单之外的空白处不收起（和系统菜单一致） */
    let entered = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subEl = () => document.getElementById(`${openSub}-sub`)?.closest<HTMLElement>('.ok-popup') ?? null;
    const triggerEl = () => elRef.current?.querySelector<HTMLElement>(`[aria-controls="${openSub}-sub"]`) ?? null;
    /** 按指针下面的元素决定：本菜单的可用项拿到高亮（它的 onFocus 收起子菜单），禁用项和空白处清掉高亮 */
    const resolve = (t: Element | null) => {
      if (!t || subEl()?.contains(t) || triggerEl()?.contains(t)) return;
      const own = elRef.current;
      const item = own?.contains(t) ? t.closest<HTMLElement>(ITEM) : null;
      if (item) item.focus({ preventScroll: true });
      else if (own?.contains(t) || !entered) clear();
    };
    const onMove = (e: PointerEvent) => {
      const cur = { x: e.clientX, y: e.clientY };
      const prev = pointer.current;
      pointer.current = cur;
      clearTimeout(timer);
      const t = e.target as Element | null;
      const sub = subEl();
      hold.current = false;
      if (!sub || !t) return;
      if (sub.contains(t)) { entered = true; return; }
      if (triggerEl()?.contains(t)) return;
      if (prev && towardSubmenu(prev, cur, sub.getBoundingClientRect())) {
        hold.current = true;
        // 指针停下来了（没有新的 pointermove）：它还在 t 上，按 t 处理
        timer = setTimeout(() => { hold.current = false; resolve(t); }, SETTLE_MS);
        return;
      }
      // 本菜单的可用项由它自己的 pointermove 接手（紧接着就会触发）；其余情况在这里处理
      if (!(elRef.current?.contains(t) && t.closest(ITEM))) resolve(t);
    };
    // 捕获阶段：先于项上的 React 事件判断是否“保持”
    document.addEventListener('pointermove', onMove, true);
    return () => { document.removeEventListener('pointermove', onMove, true); clearTimeout(timer); hold.current = false; };
  }, [openSub, clear]);

  useEffect(() => {
    if (!focusOnOpen) return;
    const list = items();
    const target = focusOnOpen === 'first' ? list[0] : focusOnOpen === 'last' ? list[list.length - 1] : null;
    (target ?? elRef.current)?.focus({ preventScroll: true });
    if (!target) moveTo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOnOpen]);

  // 整棵菜单收起时，子菜单一起退场
  const rootOpen = root?.open;
  useEffect(() => { if (rootOpen === false) setOpenSub(null); }, [rootOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    // 子菜单在自己的 portal 里，事件会顺着 React 树冒上来：不是本层的不管
    if (!e.currentTarget.contains(e.target as Node)) return;
    const list = items();
    const n = list.length;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (index: number) => {
      e.preventDefault();
      const el = list[index];
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'nearest' });
    };
    if (e.key === 'ArrowDown') go(i < 0 ? 0 : (i + 1) % n);
    else if (e.key === 'ArrowUp') go(i < 0 ? n - 1 : (i - 1 + n) % n);
    else if (e.key === 'Home' || e.key === 'PageUp') go(0);
    else if (e.key === 'End' || e.key === 'PageDown') go(n - 1);
    else if (e.key === 'Tab') root?.close('tab');
    else if (isTypeaheadKey(e) && (e.key !== ' ' || typeahead.pending())) {
      const hit = typeahead.search(e.key, list.map(textOf), i);
      e.preventDefault();
      if (hit >= 0) go(hit);
    }
  };

  return (
    <MenuContext.Provider value={value}>
      <div
        role="menu"
        aria-orientation="vertical"
        tabIndex={-1}
        {...rest}
        ref={mergeRefs(ref, elRef)}
        className={cx('ok-menu ok-scroll', !bare && 'ok-menu--static', className)}
        onKeyDown={handleKeyDown}
        onPointerMove={(e) => {
          onPointerMove?.(e);
          // 子菜单开着时由上面的文档监听记录（它在捕获阶段，先于这里）
          if (openSub) return;
          pointer.current = { x: e.clientX, y: e.clientY };
          // 指针在本菜单里、但不在任何项上（分隔线、标题、自定义控件行）：高亮淡出
          const t = e.target as Element;
          if (e.currentTarget.contains(t) && !t.closest(ITEM_ANY)) clear();
        }}
        onFocus={(e) => {
          onFocus?.(e);
          if (e.target === e.currentTarget) moveTo(null);
        }}
        onPointerLeave={(e) => {
          onPointerLeave?.(e);
          if (openSub) return;   // 子菜单开着：交给上面的指针跟踪（朝子菜单去就保持，否则收起）
          clear();
        }}
      >
        <span className="ok-menu__hl" ref={hlRef} aria-hidden="true" />
        {children}
      </div>
    </MenuContext.Provider>
  );
});

/* ---------------------------------------------------------------------------
   菜单项
   --------------------------------------------------------------------------- */
export interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  /** 前置图标：内置图标名或自定义节点 */
  icon?: IconName | ReactNode;
  /** 右侧的快捷键提示（只是文字，不负责绑定按键） */
  shortcut?: ReactNode;
  tone?: MenuTone;
  disabled?: boolean;
  /** 被点选或用 Enter / Space 触发 */
  onSelect?: () => void;
  /** 触发后是否收起整个菜单。普通项默认 true，勾选 / 单选项默认 false */
  closeOnSelect?: boolean;
  /** 首字母跳转用的文字；默认取项里的文字内容 */
  textValue?: string;
}

interface ItemBaseProps extends MenuItemProps {
  trailing?: ReactNode;
  /** 子菜单的触发项：获得焦点时不关掉自己的子菜单 */
  subId?: string;
}

const ItemBase = forwardRef<HTMLButtonElement, ItemBaseProps>(function ItemBase(
  {
    role = 'menuitem', icon, shortcut, tone, disabled, onSelect, closeOnSelect = true, textValue, trailing, subId,
    className, children, onClick, onFocus, onPointerMove, ...rest
  },
  ref,
) {
  const menu = useContext(MenuContext);
  const root = useContext(MenuRootContext);
  const toned = tone && tone !== 'neutral' ? tone : undefined;
  return (
    <button
      type="button"
      role={role}
      tabIndex={-1}
      {...rest}
      ref={ref}
      className={cx('ok-menu__item', toned && `ok-menu__item--${toned}`, className)}
      data-ok-item=""
      data-icon={icon != null && icon !== false ? '' : undefined}
      data-tone={toned}
      data-text={textValue}
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        if (disabled) { e.preventDefault(); return; }
        onClick?.(e);
        if (e.defaultPrevented) return;
        onSelect?.();
        if (closeOnSelect) root?.close('select');
      }}
      onFocus={(e) => {
        onFocus?.(e);
        menu?.highlight(e.currentTarget);
        if (menu && !subId && menu.openSub) menu.setOpenSub(null);
      }}
      onPointerMove={(e) => {
        onPointerMove?.(e);
        if (!menu) return;
        // 正朝开着的子菜单斜着移动，途经的项不抢高亮
        if (menu.openSub && menu.openSub !== subId && menu.holding()) return;
        // 禁用项：高亮淡出，不停在上一项
        if (disabled) { menu.clear(); return; }
        const active = document.activeElement;
        // 菜单里的输入框正在输入：只移高亮、收起别的子菜单，不抢焦点，指针路过不打断输入
        if (active instanceof HTMLElement && active !== e.currentTarget && active.matches(EDITABLE) && e.currentTarget.closest('.ok-menu')?.contains(active)) {
          menu.highlight(e.currentTarget);
          if (!subId && menu.openSub) menu.setOpenSub(null);
          return;
        }
        if (active !== e.currentTarget) e.currentTarget.focus({ preventScroll: true });
      }}
    >
      {renderIcon(icon)}
      <span className="ok-menu__label">{children}</span>
      {shortcut != null && <span className="ok-menu__meta">{shortcut}</span>}
      {trailing}
    </button>
  );
});

/** 普通菜单项 */
export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(props, ref) {
  return <ItemBase {...props} ref={ref} />;
});

export interface MenuCheckboxItemProps extends Omit<MenuItemProps, 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/** 可勾选的菜单项（role="menuitemcheckbox"） */
export const MenuCheckboxItem = forwardRef<HTMLButtonElement, MenuCheckboxItemProps>(function MenuCheckboxItem(
  { checked, defaultChecked = false, onCheckedChange, onSelect, closeOnSelect = false, ...rest },
  ref,
) {
  const [on, setOn] = useControllable(checked, defaultChecked, onCheckedChange);
  // 选了就收起（closeOnSelect）时，退场中的菜单保持点选前的样子，不在退场途中描对勾
  const shown = useHeld(on, !usePopupOpen());
  return (
    <ItemBase
      {...rest}
      ref={ref}
      role="menuitemcheckbox"
      aria-checked={shown}
      closeOnSelect={closeOnSelect}
      onSelect={() => { setOn(!on); onSelect?.(); }}
      trailing={<CheckMark />}
    />
  );
});

interface RadioValue { value: string | null; set: (v: string) => void }
const RadioContext = createContext<RadioValue | null>(null);

export interface MenuRadioGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
}

/** 单选组：里面放 MenuRadioItem。用 aria-label 给组起名 */
export const MenuRadioGroup = forwardRef<HTMLDivElement, MenuRadioGroupProps>(function MenuRadioGroup(
  { value, defaultValue = null, onChange, children, ...rest },
  ref,
) {
  const [current, setCurrent] = useControllable<string | null>(value, defaultValue, onChange as (v: string | null) => void);
  const ctx = useMemo<RadioValue>(() => ({ value: current, set: setCurrent }), [current, setCurrent]);
  return (
    <RadioContext.Provider value={ctx}>
      <div role="group" {...rest} ref={ref}>{children}</div>
    </RadioContext.Provider>
  );
});

export interface MenuRadioItemProps extends MenuItemProps { value: string }

/** 单选菜单项（role="menuitemradio"），必须放在 MenuRadioGroup 里 */
export const MenuRadioItem = forwardRef<HTMLButtonElement, MenuRadioItemProps>(function MenuRadioItem(
  { value, onSelect, closeOnSelect = false, ...rest },
  ref,
) {
  const group = useContext(RadioContext);
  const shown = useHeld(group?.value === value, !usePopupOpen());
  return (
    <ItemBase
      {...rest}
      ref={ref}
      role="menuitemradio"
      aria-checked={shown}
      closeOnSelect={closeOnSelect}
      onSelect={() => { group?.set(value); onSelect?.(); }}
      trailing={<CheckMark />}
    />
  );
});

/** 分隔线 */
export const MenuSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MenuSeparator({ className, ...rest }, ref) {
  return <div role="separator" {...rest} ref={ref} className={cx('ok-menu__sep', className)} />;
});

/** 分组小标题（不可聚焦） */
export const MenuLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MenuLabel({ className, ...rest }, ref) {
  return <div role="presentation" {...rest} ref={ref} className={cx('ok-menu__heading', className)} />;
});

/* ---------------------------------------------------------------------------
   子菜单（一层）
   --------------------------------------------------------------------------- */
export interface MenuSubProps extends Omit<MenuItemProps, 'onSelect' | 'closeOnSelect' | 'shortcut' | 'children'> {
  /** 触发项上的文字 */
  label: ReactNode;
  /** 子菜单里的项 */
  children: ReactNode;
}

/** 子菜单：悬停、点击或按 → 展开；← 或 Esc 收回 */
export const MenuSub = forwardRef<HTMLButtonElement, MenuSubProps>(function MenuSub({ label, children, disabled, onKeyDown, ...rest }, ref) {
  const id = useId();
  const menu = useContext(MenuContext);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const subRef = useRef<HTMLDivElement | null>(null);
  const open = !!menu && menu.openSub === id;
  const [focus, setFocus] = useState<'first' | null>(null);

  const show = (withFocus: boolean) => {
    if (disabled || !menu) return;
    if (open && withFocus) {
      subRef.current?.querySelector<HTMLElement>(ITEM)?.focus({ preventScroll: true });
      return;
    }
    setFocus(withFocus ? 'first' : null);
    menu.setOpenSub(id);
  };
  const hide = () => {
    menu?.setOpenSub(null);
    triggerRef.current?.focus({ preventScroll: true });
  };
  useEffect(() => { if (!open) setFocus(null); }, [open]);

  return (
    <>
      <ItemBase
        {...rest}
        ref={mergeRefs(ref, triggerRef)}
        disabled={disabled}
        subId={id}
        closeOnSelect={false}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-sub` : undefined}
        onSelect={() => show(true)}
        onPointerMove={() => { if (!open && !menu?.holding()) show(false); }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === 'ArrowRight') { e.preventDefault(); show(true); }
        }}
        trailing={<Icon name="chevron-right" className="ok-menu__chevron" />}
      >
        {label}
      </ItemBase>
      <Popup
        open={open}
        anchorRef={triggerRef}
        placement="right-start"
        // 越过父菜单的 6px 内边距贴在它外侧；向上提 6px，让第一项和触发项对齐
        offset={8}
        alignOffset={-6}
        className="ok-popup--menu"
        onDismiss={(reason) => { if (reason === 'escape') hide(); }}
      >
        <Menu
          bare
          id={`${id}-sub`}
          ref={subRef}
          focusOnOpen={open ? focus : null}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' && e.currentTarget.contains(e.target as Node)) { e.preventDefault(); hide(); }
          }}
        >
          {children}
        </Menu>
      </Popup>
    </>
  );
});

/* ---------------------------------------------------------------------------
   DropdownMenu：触发按钮 + 弹出的菜单
   --------------------------------------------------------------------------- */
export interface DropdownMenuProps extends Omit<MenuProps, 'focusOnOpen' | 'bare'> {
  /** 触发元素（一个能接收 ref 和事件的元素，通常是 <button className="ok-btn">） */
  trigger: ReactElement;
  /** 菜单项 */
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  offset?: number;
  /** 菜单不窄于触发元素。默认 true */
  matchTriggerWidth?: boolean;
}

export const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(function DropdownMenu(
  { trigger, children, open: openProp, defaultOpen = false, onOpenChange, placement = 'bottom-start', offset = 8, matchTriggerWidth = true, id, ...rest },
  ref,
) {
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const [focus, setFocus] = useState<'first' | 'last' | 'menu'>('menu');
  const triggerRef = useRef<HTMLElement | null>(null);
  const auto = useId();
  const menuId = id ?? `${auto}-menu`;

  const show = (to: 'first' | 'last' | 'menu') => { setFocus(to); setOpen(true); };
  const close = (refocus: boolean) => {
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
    setOpen(false);
  };
  const root = useMemo<MenuRootValue>(() => ({
    open,
    // Tab：先把焦点交还触发元素，浏览器接着把它移到下一个可聚焦元素
    close: () => close(true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [open, setOpen]);

  const triggerEl = cloneWithProps(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    'data-state': open ? 'open' : 'closed',
    onClick: (e: MouseEvent) => (open ? close(false) : show(e.detail === 0 ? 'first' : 'menu')),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        show(e.key === 'ArrowDown' ? 'first' : 'last');
      }
    },
  }, triggerRef);

  return (
    <MenuRootContext.Provider value={root}>
      {triggerEl}
      <Popup
        open={open}
        anchorRef={triggerRef}
        placement={placement}
        offset={offset}
        matchWidth={matchTriggerWidth ? 'min' : false}
        className="ok-popup--menu"
        onDismiss={(reason) => close(reason === 'escape')}
      >
        <Menu {...rest} bare id={menuId} ref={ref} focusOnOpen={open ? focus : null}>{children}</Menu>
      </Popup>
    </MenuRootContext.Provider>
  );
});
