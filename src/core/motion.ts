/**
 * 动效内核：弹簧 → linear()、WAAPI 封装、FLIP。
 * 全局倍率读 :root 上的 --ok-ms（0 = 减弱动效）。
 */
import { canUseDOM, clamp } from './utils';

export interface SpringOptions { stiffness?: number; damping?: number; mass?: number; precision?: number }
export interface SpringResult { stiffness: number; damping: number; mass: number; duration: number; easing: string; overshoot: number; at: (p: number) => number; fallback?: string }

export function speed(): number {
  if (!canUseDOM) return 1;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ok-ms'));
  return Number.isFinite(v) ? v : 1;
}
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms * speed()));

function springFn(k: number, c: number, m: number) {
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return (t: number) => 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  if (z === 1) return (t: number) => 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const s = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - s);
  const r2 = -w0 * (z + s);
  return (t: number) => 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

/** 弹簧参数 → 时长（ms）+ linear() 缓动 */
export function spring(o: SpringOptions = {}): SpringResult {
  const k = o.stiffness || 260;
  const c = o.damping || 24;
  const m = o.mass || 1;
  const f = springFn(k, c, m);
  let dur = 0.1;
  for (let t = 3; t > 0; t -= 1 / 240) {
    if (Math.abs(f(t) - 1) > (o.precision || 0.004)) { dur = t + 1 / 240; break; }
  }
  const n = clamp(Math.round(dur * 70), 18, 48);
  const pts: number[] = [];
  let peak = 1;
  for (let i = 0; i <= n; i++) {
    const v = i === n ? 1 : f((dur * i) / n);
    if (v > peak) peak = v;
    pts.push(+v.toFixed(3));
  }
  return { stiffness: k, damping: c, mass: m, duration: Math.round(dur * 1000), easing: 'linear(' + pts.join(', ') + ')', overshoot: peak - 1, at: (p) => f(p * dur) };
}

export const supportsLinear = canUseDOM && typeof CSS !== 'undefined' && !!CSS.supports?.('transition-timing-function', 'linear(0, 1)');

export const ease = {
  out: 'cubic-bezier(.22, 1, .36, 1)',
  in: 'cubic-bezier(.55, 0, 1, .45)',
  inOut: 'cubic-bezier(.65, 0, .35, 1)',
  standard: 'cubic-bezier(.2, 0, 0, 1)',
} as const;

/**
 * 悬浮卡片（FloatingCard 及其封装）共用的进退场时长，单位 ms，未乘 --ok-ms。
 * 和 tokens.css 里的 --ok-float-in-dur / --ok-float-fade-dur / --ok-float-out-dur 一一对应，改一处要一起改（有测试对着两边）
 */
export const floatMotion = { in: 303, fade: 100, out: 160 } as const;

export type SpringPreset ='soft' | 'spring' | 'snappy' | 'bouncy' | 'wobbly';
const RAW: Record<SpringPreset, SpringOptions & { fallback: string }> = {
  soft: { stiffness: 170, damping: 26, fallback: 'cubic-bezier(.22, 1, .36, 1)' },
  spring: { stiffness: 260, damping: 24, fallback: 'cubic-bezier(.3, 1.3, .5, 1)' },
  snappy: { stiffness: 520, damping: 34, fallback: 'cubic-bezier(.3, 1.25, .45, 1)' },
  bouncy: { stiffness: 300, damping: 18, fallback: 'cubic-bezier(.3, 1.7, .5, 1)' },
  wobbly: { stiffness: 180, damping: 9, fallback: 'cubic-bezier(.3, 2.3, .5, 1)' },
};
export const presets = Object.fromEntries(
  (Object.keys(RAW) as SpringPreset[]).map((k) => [k, { ...spring(RAW[k]), fallback: RAW[k].fallback }]),
) as Record<SpringPreset, SpringResult>;

export interface AnimateOptions extends KeyframeAnimationOptions { spring?: SpringPreset | SpringOptions }

/** WAAPI 封装：时长乘以全局倍率；{ spring: 'bouncy' } 直接套弹簧预设。默认不保留 fill */
export function animate(node: Element | null | undefined, keyframes: Keyframe[] | PropertyIndexedKeyframes, options: AnimateOptions = {}): Animation | null {
  if (!node || typeof node.animate !== 'function') return null;
  const { spring: sp, ...rest } = options;
  const o: KeyframeAnimationOptions = { duration: 240, easing: ease.out, ...rest };
  if (sp) {
    const p = typeof sp === 'string' ? presets[sp] : spring(sp);
    o.duration = p.duration;
    o.easing = supportsLinear ? p.easing : p.fallback || ease.out;
  }
  const s = speed();
  o.duration = Math.max(0, (o.duration as number) * s);
  if (o.delay) { o.delay *= s; if (!o.fill) o.fill = 'backwards'; }
  return node.animate(keyframes, o);
}

/** FLIP：记录位置 → 变更 → 从旧位置弹到新位置。React 里在 useLayoutEffect 中调用第二步，见 useFlip */
export function flip(nodes: Array<Element | null | undefined>, mutate: () => void, options?: AnimateOptions) {
  const list = nodes.filter(Boolean) as Element[];
  const first = new Map(list.map((n) => [n, n.getBoundingClientRect()]));
  mutate();
  playFlip(first, options);
}

export function playFlip(first: Map<Element, DOMRect>, options?: AnimateOptions) {
  first.forEach((a, n) => {
    if (!n.isConnected) return;
    const b = n.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    animate(n, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { spring: 'spring', ...options });
  });
}
