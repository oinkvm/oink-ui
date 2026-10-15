import { canUseDOM } from './utils';
import { useIsoLayoutEffect } from './hooks';
import {
  borderImageValue, clampRadii, colorAlpha, cornerClipPath, cornerPaint, outerExtent, outerRegions, paintSizeKey, parseBoxShadow, parseCornerShape,
} from './corner';
import type { CornerDecor, CornerKs, CornerRadii } from './corner';

/**
 * 超椭圆圆角的回退：不支持 `corner-shape` 的内核（Safari / macOS 上 Tauri 用的 WKWebView、Firefox）里，
 * 用脚本把 Chromium 画出来的同一条曲线补上。支持 corner-shape 时什么都不做：不建观察器、不改 DOM。
 *
 * 机制（为什么这样做见 README 的“圆角”一节）：
 * 1. 识别：样式表里每条 `corner-shape: X` 旁边都写了一条 `--ok-shape: X`。不认识 corner-shape 的内核会丢掉前者，
 *    但保留后者；--ok-shape 注册成不继承的自定义属性（base.css），`inherit` 也照常生效。读到的不是 round 就要接管。
 *    伪元素（::before / ::after）也一样读。
 * 2. 令牌：<html> 加上 data-ok-corner-fallback，tokens.css 把 --ok-corner / --ok-rk 换成和 Chromium 一样的
 *    superellipse(1.75) / 1.45，半径和同心内边距都和 Chromium 一致。
 * 3. 接管的元素加 data-ok-se="on"：原生 border-radius 置 0（角上原生画的都是直角），
 *    clip-path 在四个角按超椭圆和外侧装饰（outline、外阴影）的真实形状裁掉多余的直角，
 *    border-image 用一张九宫格 SVG 补上直角画不出的那几弯（描边、顶部高光、焦点环、边框）。直边全部还是原生绘制，
 *    所以悬停、按下的颜色过渡照常由浏览器做；角上的补丁在过渡期间逐帧跟着计算值重画。
 * 4. 读真实半径：原生半径被置 0 了，读的时候把所有接管的元素临时切成 data-ok-se="r"（覆盖失效）、读完切回去，
 *    同一个任务里完成，中间不会绘制；组件不过渡 border-radius，所以切换不会触发过渡。
 * 5. 跟随变化：ResizeObserver（尺寸）、MutationObserver（挂载、卸载、属性）、交互事件（悬停、按下、聚焦、勾选）、
 *    过渡和动画事件（逐帧）、窗口尺寸和配色方案变化。
 */

type PseudoKey = '' | '::before' | '::after';
const PSEUDOS: PseudoKey[] = ['', '::before', '::after'];
const ATTR: Record<PseudoKey, string> = { '': 'data-ok-se', '::before': 'data-ok-se-before', '::after': 'data-ok-se-after' };
const VAR: Record<PseudoKey, string> = { '': '--ok-se', '::before': '--ok-se-before', '::after': '--ok-se-after' };
/** <html> 上的开关：tokens.css 据此把 --ok-corner / --ok-rk 换成超椭圆那一套 */
export const CORNER_FALLBACK_ATTR = 'data-ok-corner-fallback';
/** 过渡、动画里这些属性变了，角上的补丁要逐帧重画 */
const PAINT_PROPS = /^(box-shadow|outline|outline-(color|width|offset|style)|border(-(top|right|bottom|left))?(-(color|width))?|opacity|width|height|inset|top|right|bottom|left|border-.*radius|all)$/;

interface Part {
  el: HTMLElement;
  pseudo: PseudoKey;
  ks: CornerKs;
  /** 计算后的四个角半径原文（可能是百分比），读的时候覆盖已关掉 */
  rawRadii: string[] | null;
  geomDirty: boolean;
  /** 要重读计算样式（颜色、阴影、尺寸） */
  paintDirty: boolean;
  /** 读到的东西变了，要重新生成并写回 */
  needsWrite: boolean;
  /** 自己裁溢出（overflow 不是 visible）：clip 的大矩形不用外扩 */
  clipsOverflow: boolean;
  key: string;
  decor: CornerDecor | null;
  /** 叠在这个部件上的伪元素的外侧装饰（并进 clip） */
  attached: string;
  attachedReach: number;
  clip: string;
  paint: string;
  active: boolean;
  /** 伪元素：自己的外侧装饰挂到哪个部件的 clip 上 */
  anchor: Part | null;
  /** 为这个部件观察尺寸的元素 */
  watched: Element[];
  /** 上次生成 clip 时的几何键（颜色变了、几何没变就不重算 clip） */
  clipKey: string;
}

/** 当前内核要不要回退：能确定不支持 corner-shape、并且有需要的观察器时才要 */
export function cornerFallbackNeeded(): boolean {
  if (!canUseDOM) return false;
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  if (CSS.supports('corner-shape', 'superellipse(2)')) return false;
  return typeof ResizeObserver === 'function' && typeof MutationObserver === 'function';
}

let installs = 0;
let runtime: Runtime | null = null;

/**
 * 打开超椭圆回退。可以重复调用（引用计数），返回的函数撤销这一次；最后一个撤销时清掉所有观察器、属性和行内变量。
 * 内核支持 corner-shape 或在服务端时什么都不做。OinkProvider 默认会调用它
 */
export function installCornerFallback(): () => void {
  if (!cornerFallbackNeeded()) return () => {};
  installs++;
  if (!runtime) runtime = new Runtime(document);
  let undone = false;
  return () => {
    if (undone) return;
    undone = true;
    if (--installs === 0 && runtime) { runtime.destroy(); runtime = null; }
  };
}

/** 回退是否正在工作 */
export const cornerFallbackActive = () => runtime !== null;

/** 组件里打开回退（OinkProvider 用它）。在布局副作用里打开：首帧绘制前角就已经画好。enabled 为 false 时不打开 */
export function useCornerFallback(enabled = true) {
  useIsoLayoutEffect(() => (enabled ? installCornerFallback() : undefined), [enabled]);
}

const px = (v: string) => parseFloat(v) || 0;
/** 半径原文 → [水平, 垂直]，百分比按盒子尺寸换算 */
function resolveRadius(raw: string, w: number, h: number): [number, number] {
  const parts = raw.trim().split(/\s+/);
  const one = (s: string, len: number) => (s.endsWith('%') ? (parseFloat(s) / 100) * len : px(s));
  return [one(parts[0], w), one(parts[1] ?? parts[0], h)];
}

/**
 * 补丁（border-image 的值）按“去掉尺寸后的装饰”缓存：九宫格的补丁不随尺寸变，同样半径、同样描边的元素共用一张图，
 * 换主题、悬停时不用一个个重新拼 SVG。尺寸只在盒子小到不能拉伸时才进键
 */
const paintCache = new Map<string, string>();
function paintFor(d: CornerDecor): string {
  const key = JSON.stringify({ ...d, w: 0, h: 0 }) + paintSizeKey(d);
  let v = paintCache.get(key);
  if (v === undefined) {
    const spec = cornerPaint(d);
    v = spec ? borderImageValue(spec) : '';
    if (paintCache.size > 500) paintCache.clear();
    paintCache.set(key, v);
  }
  return v;
}

/** 最近的不透明祖先背景色；都透明就取 <html> 的 */
function backdropOf(view: Window, from: Element | null): string {
  for (let el = from; el; el = el.parentElement) {
    const c = view.getComputedStyle(el).backgroundColor;
    if (colorAlpha(c) >= 0.99) return c;
  }
  return '';
}

class Runtime {
  private doc: Document;
  private root: HTMLElement;
  private parts = new Map<HTMLElement, Map<PseudoKey, Part>>();
  private sizes = new WeakMap<Element, [number, number]>();
  /** 被 ResizeObserver 观察的元素 → 依赖它尺寸的部件 */
  private watchers = new Map<Element, Set<Part>>();
  private mo: MutationObserver;
  private ro: ResizeObserver;
  private raf = 0;
  private animating = new Map<Part, number>();
  private pendingScan = new Set<Element>();
  private scanAll = false;
  private mql: MediaQueryList | null = null;
  private flushing = false;

  constructor(doc: Document) {
    this.doc = doc;
    this.root = doc.documentElement;
    this.root.setAttribute(CORNER_FALLBACK_ATTR, '');
    this.ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const b = e.borderBoxSize && e.borderBoxSize[0];
        this.sizes.set(e.target, b ? [b.inlineSize, b.blockSize] : [e.contentRect.width, e.contentRect.height]);
        this.watchers.get(e.target)?.forEach((p) => { p.paintDirty = true; });
      }
      this.flush();
    });
    this.mo = new MutationObserver((records) => { this.onMutations(records); this.flush(); });
    this.mo.observe(this.root, { subtree: true, childList: true, attributes: true });
    for (const t of ['pointerover', 'pointerout', 'pointerdown', 'pointerup', 'pointercancel', 'focusin', 'focusout', 'keydown', 'keyup', 'click', 'change', 'input'])
      doc.addEventListener(t, this.onInteract, true);
    for (const t of ['transitionrun', 'transitionend', 'transitioncancel', 'animationstart', 'animationend', 'animationcancel'])
      doc.addEventListener(t, this.onAnim as EventListener, true);
    doc.defaultView?.addEventListener('resize', this.onResize);
    this.mql = doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
    this.mql?.addEventListener?.('change', this.onResize);
    this.scanAll = true;
    this.flush();
  }

  destroy() {
    this.mo.disconnect();
    this.ro.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
    for (const t of ['pointerover', 'pointerout', 'pointerdown', 'pointerup', 'pointercancel', 'focusin', 'focusout', 'keydown', 'keyup', 'click', 'change', 'input'])
      this.doc.removeEventListener(t, this.onInteract, true);
    for (const t of ['transitionrun', 'transitionend', 'transitioncancel', 'animationstart', 'animationend', 'animationcancel'])
      this.doc.removeEventListener(t, this.onAnim as EventListener, true);
    this.doc.defaultView?.removeEventListener('resize', this.onResize);
    this.mql?.removeEventListener?.('change', this.onResize);
    for (const map of this.parts.values()) for (const p of map.values()) this.clearPart(p);
    this.parts.clear();
    this.watchers.clear();
    this.animating.clear();
    this.root.removeAttribute(CORNER_FALLBACK_ATTR);
  }

  /* —— 发现 —— */

  private onMutations(records: MutationRecord[]) {
    for (const r of records) {
      if (r.type === 'childList') {
        r.addedNodes.forEach((n) => { if (n.nodeType === 1) this.pendingScan.add(n as Element); });
      } else if (r.type === 'attributes') {
        const t = r.target as Element;
        if (r.attributeName === 'style') {
          // 行内样式：可能改了半径、阴影（比如 Box 的 --ok-box-r、组件逐帧写的变量）。不改 --ok-shape，不重新识别
          this.forPartsIn(t, (p) => { p.paintDirty = true; if (p.el === t) p.geomDirty = true; });
        } else if (t === this.root || t === this.doc.body) {
          // <html> / <body> 上的属性（主题、强调色、动效偏好、data-touch）：只改颜色和尺寸，不改哪些元素是超椭圆、半径多大。
          // 全页重新识别要读每个元素三次计算样式（几百个元素的页面上十几毫秒），这里只重读颜色
          if (r.attributeName !== CORNER_FALLBACK_ATTR) this.forPartsIn(this.doc, (p) => { p.paintDirty = true; });
        } else {
          // 类名、data-*、aria-*：可能改了形状、半径、颜色；兄弟选择器也可能受影响，所以从父元素起重新识别
          this.pendingScan.add(t.parentElement ?? t);
        }
      }
    }
  }

  private forPartsIn(root: Node, fn: (p: Part) => void) {
    for (const [el, map] of this.parts) if (root === this.doc || root.contains(el)) map.forEach(fn);
  }

  /** 读一个元素（及其伪元素）的 --ok-shape，登记或注销 */
  private identify(el: Element) {
    if (!(el instanceof HTMLElement)) return;
    const view = this.doc.defaultView!;
    for (const ps of PSEUDOS) {
      const v = view.getComputedStyle(el, ps || null).getPropertyValue('--ok-shape');
      const ks = v ? parseCornerShape(v) : null;
      const existing = this.parts.get(el)?.get(ps);
      if (ks && !existing) this.addPart(el, ps, ks);
      else if (!ks && existing) this.removePart(existing);
      else if (ks && existing) {
        if (ks.join() !== existing.ks.join()) existing.ks = ks;
        existing.geomDirty = existing.paintDirty = true;
      }
    }
  }

  private addPart(el: HTMLElement, pseudo: PseudoKey, ks: CornerKs) {
    const p: Part = { el, pseudo, ks, rawRadii: null, geomDirty: true, paintDirty: true, needsWrite: true, clipsOverflow: false, key: '', decor: null, attached: '', attachedReach: 0, clip: '', paint: '', active: false, anchor: null, watched: [], clipKey: '' };
    let map = this.parts.get(el);
    if (!map) { map = new Map(); this.parts.set(el, map); }
    map.set(pseudo, p);
    this.watch(el, p);
    // 伪元素绝对定位时尺寸跟着包含块走：包含块也要观察
    if (pseudo) { const cb = el.offsetParent; if (cb && cb !== el) this.watch(cb, p); }
  }

  private watch(target: Element, p: Part) {
    let set = this.watchers.get(target);
    if (!set) { set = new Set(); this.watchers.set(target, set); this.ro.observe(target); }
    set.add(p);
    p.watched.push(target);
  }

  private removePart(p: Part) {
    this.clearPart(p);
    const map = this.parts.get(p.el);
    map?.delete(p.pseudo);
    if (map && !map.size) this.parts.delete(p.el);
    this.animating.delete(p);
    for (const t of p.watched) {
      const set = this.watchers.get(t);
      if (set && set.delete(p) && !set.size) { this.watchers.delete(t); this.ro.unobserve(t); }
    }
    p.watched = [];
  }

  private clearPart(p: Part) {
    p.el.removeAttribute(ATTR[p.pseudo]);
    p.el.style.removeProperty(VAR[p.pseudo] + '-clip');
    p.el.style.removeProperty(VAR[p.pseudo] + '-paint');
    p.active = false;
  }

  /* —— 触发 —— */

  private onInteract = (e: Event) => {
    if (!this.parts.size) return;
    const t = e.target instanceof Node ? e.target : null;
    const rel = (e as FocusEvent).relatedTarget instanceof Node ? ((e as FocusEvent).relatedTarget as Node) : null;
    // 悬停、聚焦状态变了的是 target 和 relatedTarget 的最近公共祖先以下的元素；:has() 还会影响祖先
    let scope: Node = this.doc;
    if (t && rel) { let a: Node | null = t; while (a && !a.contains(rel)) a = a.parentNode; scope = a ?? this.doc; }
    else if (t && (e.type === 'click' || e.type === 'change' || e.type === 'input' || e.type === 'pointerdown' || e.type === 'pointerup')) scope = t.parentNode ?? this.doc;
    let any = false;
    for (const [el, map] of this.parts) {
      if (scope === this.doc || scope.contains(el) || (t && el.contains(t))) { map.forEach((p) => { p.paintDirty = true; }); any = true; }
    }
    if (any) this.schedule();
  };

  private onAnim = (e: TransitionEvent | AnimationEvent) => {
    const el = e.target as HTMLElement;
    const p = this.parts.get(el)?.get((e.pseudoElement || '') as PseudoKey);
    if (!p) return;
    if ('propertyName' in e) {
      if (!PAINT_PROPS.test(e.propertyName)) return;
    } else if (e.type === 'animationstart' && !this.animationTouchesPaint(el, e.animationName)) return;
    const n = this.animating.get(p) ?? 0;
    if (e.type === 'transitionrun' || e.type === 'animationstart') this.animating.set(p, n + 1);
    else if (n <= 1) this.animating.delete(p);
    else this.animating.set(p, n - 1);
    p.paintDirty = true;
    this.schedule();
  };

  /** CSS 动画是否动到描边、outline、透明度这类会影响补丁的属性（比如 ok-breathe 动 box-shadow；ok-shimmer 只动背景位置） */
  private animationTouchesPaint(el: Element, name: string): boolean {
    try {
      const a = el.getAnimations?.({ subtree: true }).find((x) => (x as CSSAnimation).animationName === name);
      const frames = (a?.effect as KeyframeEffect | null)?.getKeyframes?.();
      if (!frames) return true;
      return frames.some((f) => Object.keys(f).some((k) => /^(boxShadow|outline|opacity|border)/.test(k)));
    } catch { return true; }
  }

  private onResize = () => {
    // 媒体查询可能换了半径（比如窄屏的卡片）或颜色：全部重读
    for (const map of this.parts.values()) map.forEach((p) => { p.geomDirty = p.paintDirty = true; });
    this.schedule();
  };

  private schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.animating.forEach((_, p) => { p.paintDirty = true; });
      this.flush();
      if (this.animating.size) this.schedule();
    });
  }

  /* —— 读、算、写 —— */

  flush() {
    if (this.flushing) return;
    this.flushing = true;
    try { this.flushInner(); } finally {
      this.mo.takeRecords();   // 丢掉自己改属性和行内变量产生的记录
      this.flushing = false;
    }
  }

  private flushInner() {
    // 先把别人产生、还没交给回调的记录处理掉
    this.onMutations(this.mo.takeRecords());
    if (this.scanAll) {
      this.scanAll = false;
      this.pendingScan.clear();
      this.identify(this.root);
      this.root.querySelectorAll('*').forEach((el) => this.identify(el));
    } else if (this.pendingScan.size) {
      const roots = [...this.pendingScan];
      this.pendingScan.clear();
      for (const r of roots) {
        if (!r.isConnected) continue;
        this.identify(r);
        r.querySelectorAll('*').forEach((el) => this.identify(el));
        this.forPartsIn(r, (p) => { p.geomDirty = p.paintDirty = true; });
      }
    }
    // 已经从文档里拿掉的
    for (const [el, map] of this.parts) if (!el.isConnected) map.forEach((p) => this.removePart(p));

    const all: Part[] = [];
    this.parts.forEach((map) => map.forEach((p) => all.push(p)));
    const geom = all.filter((p) => p.geomDirty);
    if (geom.length) this.readRadii(geom);

    const view = this.doc.defaultView!;
    for (const p of all) if (p.paintDirty) { p.paintDirty = false; this.readDecor(p, view); }

    // 伪元素的外侧装饰并到它覆盖的那个部件的 clip 上（卡片的覆盖链接焦点环、选项卡片的选中环）
    const attached = new Map<Part, { path: string; reach: number }>();
    for (const p of all) {
      if (!p.pseudo || !p.decor) continue;
      const reach = outerExtent(p.decor);
      if (reach <= 0) continue;
      const a = this.anchorOf(p);
      if (!a) continue;
      const cur = attached.get(a) ?? { path: '', reach: 0 };
      cur.path += outerRegions(p.decor);
      cur.reach = Math.max(cur.reach, reach);
      attached.set(a, cur);
    }
    for (const p of all) {
      const at = attached.get(p) ?? { path: '', reach: 0 };
      if (at.path !== p.attached) { p.attached = at.path; p.attachedReach = at.reach; p.needsWrite = true; }
    }

    for (const p of all) if (p.needsWrite) { p.needsWrite = false; this.write(p); }
  }

  /** 临时关掉覆盖，读真实半径。要关的是这些部件自己和它们祖先上的部件（border-radius: inherit 会从祖先继承到 0） */
  private readRadii(parts: Part[]) {
    const view = this.doc.defaultView!;
    const on = new Set<Part>();
    const off = (p: Part) => { if (p.active && !on.has(p)) { on.add(p); p.el.setAttribute(ATTR[p.pseudo], 'r'); } };
    const seen = new Set<Element>();
    for (const p of parts) {
      for (let el: Element | null = p.el; el && !seen.has(el); el = el.parentElement) {
        seen.add(el);
        this.parts.get(el as HTMLElement)?.forEach(off);
      }
    }
    for (const p of parts) {
      const cs = view.getComputedStyle(p.el, p.pseudo || null);
      p.rawRadii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
      p.geomDirty = false;
      p.paintDirty = true;
    }
    // 读完切回去（新登记的部件这时还没有属性，等写的时候再打开）
    for (const p of on) p.el.setAttribute(ATTR[p.pseudo], 'on');
  }

  private sizeOf(p: Part, cs: CSSStyleDeclaration): [number, number] | null {
    if (p.pseudo) {
      if (cs.display === 'none' || cs.content === 'none') return null;
      return [px(cs.width), px(cs.height)];
    }
    if (cs.display === 'inline') {
      // 行内元素没有 ResizeObserver 尺寸：改为观察它的父元素，父元素一变就重新量
      const parent = p.el.parentElement;
      if (parent && !p.watched.includes(parent)) this.watch(parent, p);
      const rects = p.el.getClientRects();
      // 折行的行内元素每段各自成形，回退不处理，保持原生圆角
      if (rects.length !== 1) return null;
      return [rects[0].width, rects[0].height];
    }
    return this.sizes.get(p.el) ?? null;
  }

  private readDecor(p: Part, view: Window) {
    const cs = view.getComputedStyle(p.el, p.pseudo || null);
    const size = this.sizeOf(p, cs);
    if (!size || !p.rawRadii) { if (p.decor || p.active) p.needsWrite = true; p.decor = null; p.key = ''; return; }
    const [w, h] = size;
    const raw = p.rawRadii.map((r) => resolveRadius(r, w, h)) as CornerRadii;
    const outlineOn = cs.outlineStyle !== 'none' && cs.outlineStyle !== 'auto' && px(cs.outlineWidth) > 0;
    const decor: CornerDecor = {
      w, h,
      radii: clampRadii(w, h, raw),
      ks: p.ks,
      border: [px(cs.borderTopWidth), px(cs.borderRightWidth), px(cs.borderBottomWidth), px(cs.borderLeftWidth)],
      borderColor: cs.borderTopColor,
      shadows: parseBoxShadow(cs.boxShadow),
      outline: outlineOn ? { offset: px(cs.outlineOffset), width: px(cs.outlineWidth), color: cs.outlineColor } : null,
    };
    // 伪元素整体透明（比如还没选中的选项卡片的环）：外侧装饰不可见，不并进锚点的 clip
    if (p.pseudo && px(cs.opacity) === 0) {
      decor.shadows = decor.shadows.map((s) => (s.inset ? s : { ...s, color: 'transparent' }));
      if (decor.outline) decor.outline = { ...decor.outline, color: 'transparent' };
    }
    // 有可见的外侧装饰时，记下背后的颜色（见 CornerDecor.backdrop）。伪元素背后是它覆盖的那个元素的背后
    if (outerExtent(decor) > 0) {
      const a = p.pseudo ? this.anchorOf({ ...p, decor }) : null;
      decor.backdrop = backdropOf(view, ((a ? a.el : p.el) as HTMLElement).parentElement);
    }
    const clips = p.pseudo ? true : cs.overflowX !== 'visible' && cs.overflowY !== 'visible';
    const key = JSON.stringify(decor) + clips;
    if (key !== p.key) { p.key = key; p.decor = decor; p.clipsOverflow = clips; p.needsWrite = true; }
  }

  /** 伪元素覆盖的部件：自己的元素（同尺寸）或最近的同尺寸祖先 */
  private anchorOf(p: Part): Part | null {
    const d = p.decor!;
    const same = (el: Element) => { const s = this.sizes.get(el); return !!s && Math.abs(s[0] - d.w) < 0.5 && Math.abs(s[1] - d.h) < 0.5; };
    for (let el: HTMLElement | null = p.el; el; el = el.parentElement) {
      const self = this.parts.get(el)?.get('');
      if (self && self !== p && same(el)) return self;
    }
    return null;
  }

  private write(p: Part) {
    const d = p.decor;
    const attr = ATTR[p.pseudo], v = VAR[p.pseudo];
    if (!d) {
      if (p.active) this.clearPart(p);
      return;
    }
    // clip 只和几何有关（外侧装饰只看可见与否，不看颜色）
    const clipKey = JSON.stringify([d.w, d.h, d.radii, d.ks, d.shadows.map((x) => [x.inset, x.dx, x.dy, x.spread, colorAlpha(x.color) > 0]),
      d.outline && [d.outline.offset, d.outline.width, colorAlpha(d.outline.color) > 0], p.attached, p.attachedReach, p.clipsOverflow]);
    // 不裁溢出的元素：大矩形外扩 1024px，溢出的子元素（角标、提示）照常可见
    const clip = clipKey === p.clipKey ? p.clip : `path("${cornerClipPath(d, p.clipsOverflow ? 0 : 1024, p.attached, p.attachedReach)}")`;
    p.clipKey = clipKey;
    const paint = paintFor(d);
    if (clip !== p.clip) { p.el.style.setProperty(v + '-clip', clip); p.clip = clip; }
    if (paint !== p.paint) {
      if (paint) p.el.style.setProperty(v + '-paint', paint); else p.el.style.removeProperty(v + '-paint');
      p.paint = paint;
    }
    if (!p.active || p.el.getAttribute(attr) !== 'on') { p.el.setAttribute(attr, 'on'); p.active = true; }
  }
}
