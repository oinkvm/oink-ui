import { Children, cloneElement, createContext, forwardRef, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cx, Icon, Portal, speed, useEscape, useLocale } from '../core';
import { usePosition } from '../popups/usePosition';
import type { DisplaySize } from './types';

export type AvatarStatus = 'online' | 'busy' | 'away' | 'offline';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** 图片地址；加载失败时回退到首字母 */
  src?: string;
  /** 人名：用来生成首字母，也是读屏读到的名字 */
  name?: string;
  /** 覆盖读屏读到的名字 */
  alt?: string;
  /** sm 28、md 36（原型）、lg 48，或像素值 */
  size?: DisplaySize | number;
  /** 首字母底色。默认强调色；auto 按名字从一组固定颜色里挑 */
  color?: string;
  /** 右下角的状态点 */
  status?: AvatarStatus;
  /** 状态的读屏文字，默认 在线 / 忙碌 / 离开 / 离线 */
  statusLabel?: string;
  /**
   * 装饰性的：旁边已经有这个人的名字时用。name 照样用来取色（color="auto"）和生成首字母，
   * 但整个头像对读屏隐藏（aria-hidden），不再是一张带名字的图
   */
  decorative?: boolean;
  /** 自定义回退内容，替换首字母 */
  children?: ReactNode;
}

const SIZES = { sm: 28, md: 36, lg: 48 } as const;
const PALETTE = ['#FF8FA9', '#FFBE3B', '#4CD787', '#D9A6FF', '#7FB0FF', '#FF9A5C'];

/** 首字母：中日韩文字取第一个字；拉丁文字取前两个词的首字母 */
export function initialsOf(name: string): string {
  const s = name.trim();
  if (!s) return '';
  const first = Array.from(s)[0];
  if (/[⺀-鿿가-힯豈-﫿]/.test(first)) return first;
  const words = s.split(/[\s._-]+/).filter(Boolean);
  const a = Array.from(words[0])[0] ?? '';
  const b = words.length > 1 ? Array.from(words[words.length - 1])[0] : '';
  return (a + b).toUpperCase();
}

const AvatarSizeContext = createContext<DisplaySize | number | undefined>(undefined);

/** 头像：图片失败回退到首字母；整体是一张带名字的图（role="img"） */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { src, name, alt, size: sizeProp, color, status, statusLabel, decorative, className, style, children, ...rest }, ref,
) {
  const inherited = useContext(AvatarSizeContext);
  const size = sizeProp ?? inherited ?? 'md';
  const px = typeof size === 'number' ? size : SIZES[size];
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);

  const { messages: t } = useLocale();
  const who = alt ?? name;
  const label = [who, status ? statusLabel ?? t.avatar.status[status] : undefined].filter(Boolean).join(t.common.separator);
  let bg = color;
  if (color === 'auto') {
    let h = 0;
    for (const ch of name ?? '') h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
    bg = PALETTE[h % PALETTE.length];
  }
  const vars = { '--size': `${px}px`, ...(bg ? { '--c': bg } : null) } as CSSProperties;

  return (
    <span
      ref={ref}
      className={cx('ok-avatar', className)}
      style={{ ...vars, ...style }}
      {...(label && !decorative ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      {...rest}
    >
      <span className="ok-avatar__fallback" aria-hidden="true">
        {children ?? (name ? initialsOf(name) : <Icon><circle cx="10" cy="7.500" r="3" /><path d="M4 16.500c.8-2.800 3.100-4.300 6-4.300s5.200 1.500 6 4.300" /></Icon>)}
      </span>
      {src && !failed && <img className="ok-avatar__img" src={src} alt="" onError={() => setFailed(true)} draggable={false} />}
      {status && <span className="ok-avatar__status" data-status={status} aria-hidden="true" />}
    </span>
  );
});

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** 最多显示几个头像，其余折成 “+N” */
  max?: number;
  /** 实际总人数（比传进来的头像多时用），用来算 “+N” */
  total?: number;
  /** 统一设置里面头像的尺寸 */
  size?: DisplaySize | number;
  /** 这组头像的名字，如“项目成员” */
  label?: string;
  /** 悬停或聚焦 “+N” 时浮出一个面板，列出全部成员的头像和名字（默认开启） */
  overflowList?: boolean;
}

/** 浮出面板：悬停 “+N” 或用键盘聚焦它时出现，指针移进面板时保持；Esc 收起 */
function OverflowList({ extra, members, label, total }: { extra: number; members: ReactElement<AvatarProps>[]; label?: string; total: number }) {
  const { messages: t } = useLocale();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const id = useId();
  usePosition({ open, anchorRef: anchor, floatingRef: panel, placement: 'bottom', offset: 8 });
  useEscape(open, () => setOpen(false));
  useEffect(() => () => clearTimeout(timer.current), []);
  // 进出之间留一点宽限，指针从按钮移到面板的路上不会把面板关掉
  const show = (delay: number) => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), delay); };
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 160); };
  const [state, setState] = useState<'open' | 'closed'>('closed');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); const r = requestAnimationFrame(() => requestAnimationFrame(() => setState('open'))); return () => cancelAnimationFrame(r); }
    setState('closed');
    // 等退场过渡播完再卸载；时长跟着全局倍率（减弱动效时立即卸载）
    const unmount = setTimeout(() => setMounted(false), 200 * speed());
    return () => clearTimeout(unmount);
  }, [open]);
  const names = members.map((m) => m.props.name || m.props.alt).filter(Boolean) as string[];
  return (
    <>
      <button
        ref={anchor} type="button" className="ok-avatars__more ok-focusable"
        aria-expanded={open} aria-controls={mounted ? id : undefined}
        aria-label={t.avatar.moreButton(extra, label)}
        onPointerEnter={(e) => { if (e.pointerType !== 'touch') show(120); }}
        onPointerLeave={hide}
        onFocus={() => show(0)} onBlur={hide}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar className="ok-avatar--more" decorative>+{extra}</Avatar>
      </button>
      {mounted && (
        <Portal>
          <div
            ref={panel} id={id} className="ok-popup ok-popup--surface ok-avatars__panel" data-state={state}
            role="group" aria-label={t.avatar.panel(total, label)}
            onPointerEnter={() => clearTimeout(timer.current)} onPointerLeave={hide}
          >
            <ul className="ok-avatars__list ok-scroll">
              {members.map((m, i) => (
                <li key={m.key ?? i} className="ok-avatars__item">
                  {cloneElement(m, { size: 'sm', decorative: true })}
                  <span className="ok-avatars__name">{m.props.name || m.props.alt}</span>
                </li>
              ))}
            </ul>
            {total > names.length && <p className="ok-avatars__rest">{t.avatar.rest(total - names.length)}</p>}
          </div>
        </Portal>
      )}
    </>
  );
}

/** 头像组：固定叠放（间距 −10），放不下的折成 “+N”；悬停 “+N” 浮出全部成员 */
export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(function AvatarGroup(
  { max, total, size, label, overflowList = true, className, children, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const all = Children.toArray(children);
  const shown = max != null && all.length > max ? all.slice(0, max) : all;
  const extra = Math.max(0, (total ?? all.length) - shown.length);
  const members = all.filter((c): c is ReactElement<AvatarProps> => isValidElement(c));
  const listable = overflowList && members.some((m) => m.props.name || m.props.alt);
  return (
    <div ref={ref} role="group" aria-label={label} className={cx('ok-avatars', className)} {...rest}>
      <AvatarSizeContext.Provider value={size}>
        {shown}
        {extra > 0 && (listable
          ? <OverflowList extra={extra} members={members} label={label} total={total ?? all.length} />
          : <Avatar className="ok-avatar--more" alt={t.avatar.more(extra)}>+{extra}</Avatar>)}
      </AvatarSizeContext.Provider>
    </div>
  );
});
