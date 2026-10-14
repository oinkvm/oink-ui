import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useEvent, useIsoLayoutEffect, useMediaQuery } from './hooks';
import { speed } from './motion';
import { canUseDOM } from './utils';
import { accentVars, normalizeHex } from './color';
import { TailProvider } from './tail';
import { LocaleProvider } from './locale';
import type { OinkLocale } from './locale';
import type { TailGlyphSource } from './tail';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
/** 五种预设强调色 */
export type AccentPreset = 'pink' | 'orange' | 'amber' | 'blue' | 'violet';
/** 强调色：预设名，或任意颜色（#rrggbb）。自定义颜色的文字黑白、深浅变体都自动派生，见 accentVars */
export type Accent = AccentPreset | `#${string}`;
export type MotionMode = 'auto' | 'full' | 'reduced';
export const ACCENTS: AccentPreset[] = ['pink', 'orange', 'amber', 'blue', 'violet'];

/** 是不是自定义颜色（而不是预设名） */
export const isCustomAccent = (a: string): a is `#${string}` => a.startsWith('#');
/** 合法的强调色：预设名，或能解析的十六进制颜色。读存储、读外部输入时用它把关 */
export function isAccent(v: unknown): v is Accent {
  return typeof v === 'string' && ((ACCENTS as string[]).includes(v) || (v.startsWith('#') && normalizeHex(v) !== null));
}
/** 规范化：预设名原样返回，颜色统一成小写 #rrggbb；不合法返回 null */
export function normalizeAccent(v: unknown): Accent | null {
  if (!isAccent(v)) return null;
  return isCustomAccent(v) ? (normalizeHex(v) as `#${string}`) : v;
}

export interface OinkContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  accent: Accent;
  motion: MotionMode;
  /** 切换主题。传入 origin（视口坐标）时，新主题从该点以圆形揭开 */
  setTheme: (theme: ThemeMode, origin?: { x: number; y: number }) => void;
  setAccent: (accent: Accent) => void;
  setMotion: (motion: MotionMode) => void;
}

interface ViewTransitionLike { ready: Promise<void>; finished: Promise<void>; skipTransition?: () => void }

/** 主题揭开过渡的时长（ms），沿用原型的 520。过渡期间画面是快照，但它不拦指针（见 theme.css），点按照常落到页面上 */
export const THEME_REVEAL_MS = 520;

const OinkContext = createContext<OinkContextValue | null>(null);

export interface OinkProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeMode;
  defaultAccent?: Accent;
  defaultMotion?: MotionMode;
  /** 传了就把选择记到 localStorage 的这个键下 */
  storageKey?: string;
  /** 替换全局的“尾巴”图案（加载、提示里用到的品牌图形）。见 TailProvider */
  tail?: TailGlyphSource;
  /** 组件内置文案（默认的读屏文字、按钮文字、占位符……）和日期格式的语言。默认 zh-CN。见 LocaleProvider */
  locale?: OinkLocale;
}

/** 读存储并逐项校验：已经不存在的值（比如移除了的预设色）当作没存 */
function read(key: string | undefined): Partial<{ theme: ThemeMode; accent: Accent; motion: MotionMode }> {
  if (!key || !canUseDOM) return {};
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
  return {
    theme: (['light', 'dark', 'system'] as unknown[]).includes(raw.theme) ? (raw.theme as ThemeMode) : undefined,
    accent: normalizeAccent(raw.accent) ?? undefined,
    motion: (['auto', 'full', 'reduced'] as unknown[]).includes(raw.motion) ? (raw.motion as MotionMode) : undefined,
  };
}

/** 自定义强调色写在 <html> 行内样式上的变量；换回预设时要清掉 */
const CUSTOM_VARS = ['--ok-accent', '--ok-on-accent', '--ok-accent-deep', '--ok-accent-light', '--ok-accent-fill', '--ok-accent-fill-hover', '--ok-logo-snout-light', '--ok-logo-snout-dark'];

/** 揭开用的两条样式规则：新画面的 clip-path、旧画面的停留时长。按需创建一次 */
let revealRules: { next: CSSStyleDeclaration; old: CSSStyleDeclaration } | null = null;
function getRevealRules() {
  if (revealRules) return revealRules;
  const css = ':root.ok-theming::view-transition-new(root){clip-path:circle(0px at 50% 0%)}' +
    ':root.ok-theming::view-transition-old(root){animation-duration:600ms}';
  let sheet: CSSStyleSheet;
  try {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {
    const tag = document.createElement('style');
    tag.textContent = css;
    document.head.appendChild(tag);
    sheet = tag.sheet as CSSStyleSheet;
  }
  revealRules = { next: (sheet.cssRules[0] as CSSStyleRule).style, old: (sheet.cssRules[1] as CSSStyleRule).style };
  return revealRules;
}

/** cubic-bezier(.4, 0, .2, 1)：起步利落、收尾平缓，没有长尾 */
function revealEase(x: number) {
  const x1 = 0.4, y1 = 0, x2 = 0.2, y2 = 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  let t = x;
  for (let k = 0; k < 6; k++) {
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(d) < 1e-6) break;
    t -= (((ax * t + bx) * t + cx) * t - x) / d;
  }
  return ((ay * t + by) * t + cy) * t;
}

/**
 * 主题、强调色、动效偏好。把结果写到 <html> 的 data-theme / data-accent / data-motion 上，
 * 所有组件的样式都从这三个属性派生。不包 Provider 也能用组件，默认浅色 + 粉色强调。
 */
export function OinkProvider({ children, defaultTheme = 'system', defaultAccent = 'pink', defaultMotion = 'auto', storageKey, tail, locale }: OinkProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [accent, setAccentState] = useState<Accent>(defaultAccent);
  const setAccent = useCallback((a: Accent) => { const n = normalizeAccent(a); if (n) setAccentState(n); }, []);
  const [motion, setMotion] = useState<MotionMode>(defaultMotion);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolvedTheme: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // 记下的选择在挂载后、绘制前才读：服务端渲染的 HTML 和注水时的第一帧必须一致（都用默认值），
  // 读完立刻同步重渲染，用户看不到默认值那一帧。读完之前不写 <html> 也不写回存储，免得把默认值盖上去
  const [ready, setReady] = useState(!storageKey);
  useIsoLayoutEffect(() => {
    if (!storageKey) return;
    const saved = read(storageKey);
    if (saved.theme) setThemeState(saved.theme);
    if (saved.accent) setAccentState(saved.accent);
    if (saved.motion) setMotion(saved.motion);
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    // 自定义颜色：data-accent="custom"，颜色和派生变量写在 <html> 的行内样式上
    root.dataset.accent = isCustomAccent(accent) ? 'custom' : accent;
    CUSTOM_VARS.forEach((k) => root.style.removeProperty(k));
    if (isCustomAccent(accent)) Object.entries(accentVars(accent)).forEach(([k, v]) => root.style.setProperty(k, v));
    if (motion === 'auto') delete root.dataset.motion; else root.dataset.motion = motion;
    root.style.colorScheme = resolvedTheme;
  }, [ready, resolvedTheme, accent, motion]);

  useEffect(() => {
    if (!storageKey || !ready) return;
    // 自定义颜色连同派生好的变量一起存：页面可以在首帧前用一小段内联脚本直接套上，不用再算一遍
    const vars = isCustomAccent(accent) ? accentVars(accent) : undefined;
    try { localStorage.setItem(storageKey, JSON.stringify({ theme, accent, motion, vars })); } catch { /* 隐私模式下写不进去，忽略 */ }
  }, [storageKey, ready, theme, accent, motion]);

  /** 正在进行的揭开过渡；再次切换时先跳过它 */
  const activeVT = useRef<ViewTransitionLike | null>(null);
  const revealSeq = useRef(0);

  const setTheme = useEvent((next: ThemeMode, origin?: { x: number; y: number }) => {
    const root = document.documentElement;
    const startVT = (document as Document & { startViewTransition?: (cb: () => void) => ViewTransitionLike }).startViewTransition;
    const nextResolved = next === 'system' ? (systemDark ? 'dark' : 'light') : next;
    const apply = () => { root.dataset.theme = nextResolved; root.style.colorScheme = nextResolved; setThemeState(next); };
    const seq = ++revealSeq.current;
    // 上一次揭开还没结束：直接落到终态再换，不叠两层过渡
    if (activeVT.current) {
      const running = activeVT.current;
      activeVT.current = null;
      root.classList.remove('ok-theming');
      try { running.skipTransition?.(); } catch { /* 已经结束 */ }
      apply();
      return;
    }
    if (!origin || !startVT || speed() === 0 || document.hidden || nextResolved === resolvedTheme) { setThemeState(next); return; }

    // 圆形揭开：新主题的画面从 origin 铺开，一次盖满整页。
    // · 圆的半径逐帧写进一条只作用于过渡画面的样式规则，不对伪元素做补间：
    //   直接补间 clip-path 在部分内核里会按设备像素比缩放，圆心偏离、只扫到一部分
    // · 不写根元素的样式变量：根上的变量整页继承，每帧都要重算整页样式
    // · 过渡期间暂停页面上所有 CSS 过渡（见 theme.css），否则快照之后颜色还在慢慢变，看起来停了一下
    const radius = Math.ceil(Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y)));
    const dur = THEME_REVEAL_MS * speed();
    const rules = getRevealRules();
    const at = ` at ${Math.round(origin.x)}px ${Math.round(origin.y)}px)`;
    rules.next.clipPath = 'circle(0px' + at;
    rules.old.animationDuration = Math.round(dur + 80) + 'ms';
    root.classList.add('ok-theming');
    let vt: ViewTransitionLike;
    try { vt = startVT.call(document, () => flushSync(apply)); } catch { root.classList.remove('ok-theming'); apply(); return; }
    activeVT.current = vt;
    vt.ready.then(() => {
      const t0 = performance.now();
      const frame = (now: number) => {
        if (seq !== revealSeq.current) return;
        const p = Math.min(1, (now - t0) / dur);
        rules.next.clipPath = `circle(${Math.round(radius * revealEase(p))}px${at}`;
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }).catch(() => {});
    const done = () => {
      // 只有最新的那次过渡结束才收尾
      if (activeVT.current !== vt) return;
      activeVT.current = null;
      root.classList.remove('ok-theming');
    };
    vt.finished.then(done, done);
  });

  const value = useMemo(() => ({ theme, resolvedTheme, accent, motion, setTheme, setAccent, setMotion }), [theme, resolvedTheme, accent, motion, setTheme, setAccent]);
  return <OinkContext.Provider value={value}><LocaleProvider locale={locale}><TailProvider tail={tail}>{children}</TailProvider></LocaleProvider></OinkContext.Provider>;
}

/** 读写主题。没有 Provider 时返回只读的默认值，方便组件在任何地方使用 */
export function useOink(): OinkContextValue {
  const ctx = useContext(OinkContext);
  const noop = useCallback(() => {}, []);
  return ctx ?? { theme: 'light', resolvedTheme: 'light', accent: 'pink', motion: 'auto', setTheme: noop, setAccent: noop, setMotion: noop };
}
