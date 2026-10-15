/**
 * 超椭圆圆角的几何：和 Chromium 画 `corner-shape: superellipse(K)` 用同一条曲线。
 *
 * · 规范里 superellipse(K) 的指数是 n = 2^K：|x|^n + |y|^n = 1。K = 1 是正圆，2 是 squircle，0 是斜切，∞ 是直角，负值内凹。
 * · Chromium 不是逐点画这条数学曲线，而是每个角拆成两段三次贝塞尔：从直边起点到 45° 点（u = v = 2^(-1/n)），
 *   起点把手沿直边、45° 点把手沿对角线的切线方向。把手长度（以半径为单位）下面的 HANDLES 表是从 Chromium 149
 *   的实际渲染里拟合出来的（1000px 半径的角逐行测覆盖率，各 K 的拟合残差均方根 < 0.1px）；K = 1 时 Chromium
 *   走正圆的画法，这里也单独处理。和数学曲线相比，Chromium 的曲线最多差半径的 0.16%，我们跟 Chromium 走。
 * · 半径的取值和缩放（盒子太小时按比例缩小全部半径）与 border-radius 完全相同。
 * · 偏移出来的轮廓（内阴影的洞、描边外缘、outline）：半径按 r ± d 增减、K 不变，原点随矩形内缩 / 外扩。
 *   Chromium 对偏移轮廓的曲率还有一点微调，在 1–4px 的发丝线和焦点环上差不到 0.1px，这里不跟。
 */

/** 四个角的曲率参数 K（左上、右上、右下、左下）。Infinity 是直角，1 是正圆 */
export type CornerKs = [number, number, number, number];
/** 一个角的水平、垂直半径 */
export type CornerRadius = [number, number];
/** 四个角的半径（左上、右上、右下、左下），和 border-*-radius 的顺序一样 */
export type CornerRadii = [CornerRadius, CornerRadius, CornerRadius, CornerRadius];

export interface Box { x: number; y: number; w: number; h: number }

/** K → [c1, c2]：c1 是直边起点的把手长，c2 是 45° 点的把手长，都以半径为单位。从 Chromium 149 拟合 */
const HANDLES: Array<[number, number, number]> = [
  [0, 0, 0.4714], [0.25, 0.0266, 0.447], [0.5, 0.061, 0.4174], [0.75, 0.1043, 0.3848], [1.1, 0.1846, 0.3359],
  [1.25, 0.2171, 0.3201], [1.375, 0.2551, 0.302], [1.5, 0.2917, 0.2864], [1.625, 0.3294, 0.2714], [1.75, 0.3673, 0.2565],
  [1.875, 0.4047, 0.2418], [2, 0.4393, 0.2274], [2.25, 0.4946, 0.2011], [2.5, 0.5519, 0.1767], [2.75, 0.6129, 0.1541],
  [3, 0.6749, 0.1334], [3.5, 0.7875, 0.0985], [4, 0.8701, 0.0718], [5, 0.9667, 0.0372], [8, 1, 0],
];
/** 正圆的 45° 弧：(4/3)·tan(π/16) */
const CIRCLE_HANDLE = (4 / 3) * Math.tan(Math.PI / 16);

/** superellipse(K) 的指数 n = 2^K */
export const superellipseExponent = (k: number) => 2 ** k;

/** 两段贝塞尔的把手长度（以半径为单位），k ≥ 0 */
export function cornerHandles(k: number): [number, number] {
  if (k === 1) return [CIRCLE_HANDLE, CIRCLE_HANDLE];
  if (k >= HANDLES[HANDLES.length - 1][0]) return [1, 0];
  for (let i = 1; i < HANDLES.length; i++) {
    const [k1, a1, b1] = HANDLES[i];
    if (k <= k1) {
      const [k0, a0, b0] = HANDLES[i - 1];
      const f = (k - k0) / (k1 - k0);
      return [a0 + (a1 - a0) * f, b0 + (b1 - b0) * f];
    }
  }
  return [1, 0];
}

type Pt = [number, number];
/**
 * 单位角上的点（u 是离左边的距离，v 是离上边的距离，都以半径为单位），从左边上的 (0, 1) 走到上边上的 (1, 0)。
 * 返回 [起点, 控制点, 控制点, 终点, 控制点, 控制点, 终点]：两段三次贝塞尔；直角 / 斜切时退化成折线（控制点和端点重合）
 */
export function unitCorner(k: number): Pt[] {
  if (k < 0) return unitCorner(-k).map(([u, v]) => [1 - v, 1 - u] as Pt);   // 内凹：沿弦 u + v = 1 镜像
  if (k === Infinity) return [[0, 1], [0, 1], [0, 0], [0, 0], [0, 0], [1, 0], [1, 0]];
  const m = 1 - 2 ** (-1 / superellipseExponent(k));   // 45° 点离角的距离
  const [c1, c2] = cornerHandles(k);
  const d = c2 * Math.SQRT1_2;
  return [[0, 1], [0, 1 - c1], [m - d, m + d], [m, m], [m + d, m - d], [1 - c1, 0], [1, 0]];
}

/** 规范的半径缩放：相邻两个角的半径之和超过边长时，全部半径按同一个比例缩小 */
export function clampRadii(w: number, h: number, r: CornerRadii): CornerRadii {
  const [tl, tr, br, bl] = r;
  let f = 1;
  const fit = (len: number, sum: number) => { if (sum > len && sum > 0) f = Math.min(f, Math.max(0, len) / sum); };
  fit(w, tl[0] + tr[0]); fit(w, bl[0] + br[0]); fit(h, tl[1] + bl[1]); fit(h, tr[1] + br[1]);
  return f === 1 ? r : (r.map(([x, y]) => [x * f, y * f]) as CornerRadii);
}

/** 半径随轮廓偏移 d（正值外扩、负值内缩）：有圆角的角按 r + d 增减到不小于 0，直角保持直角 */
export function offsetRadii(r: CornerRadii, d: number): CornerRadii {
  return r.map(([x, y]) => [x > 0 ? Math.max(0, x + d) : 0, y > 0 ? Math.max(0, y + d) : 0]) as CornerRadii;
}

/** 矩形向外扩 d（负值内缩）、再平移 (dx, dy) */
export const inflate = (b: Box, d: number, dx = 0, dy = 0): Box => ({ x: b.x - d + dx, y: b.y - d + dy, w: b.w + 2 * d, h: b.h + 2 * d });

const num = (v: number) => {
  const s = (Math.round(v * 1000) / 1000).toString();
  return s === '-0' ? '0' : s;
};

/**
 * 一个闭合子路径（SVG / CSS path() 语法）：盒子 b、四角半径 r、四角曲率 ks。顺时针；reverse 时逆时针（nonzero 规则下挖洞）
 */
export function shapePath(b: Box, r: CornerRadii, ks: CornerKs, reverse = false): string {
  if (b.w <= 0 || b.h <= 0) return '';
  const { x, y, w, h } = b;
  // 每个角在单位坐标里从“前一条边”走到“后一条边”，映射到盒子上。顺时针：上边 → 右上 → 右边 → 右下 → 下边 → 左下 → 左边 → 左上
  const map: Array<(u: number, v: number, rx: number, ry: number) => Pt> = [
    (u, v, rx, ry) => [x + u * rx, y + v * ry],              // 左上：(0,1) → (1,0)
    (u, v, rx, ry) => [x + w - u * rx, y + v * ry],          // 右上：(1,0) → (0,1)，倒序
    (u, v, rx, ry) => [x + w - u * rx, y + h - v * ry],      // 右下：(0,1) → (1,0)
    (u, v, rx, ry) => [x + u * rx, y + h - v * ry],          // 左下：(1,0) → (0,1)，倒序
  ];
  const corner = (i: number): Pt[] => {
    const [rx, ry] = r[i];
    if (rx <= 0 || ry <= 0) { const p = map[i](0, 0, 0, 0); return [p]; }
    let pts = unitCorner(ks[i]);
    if (i === 1 || i === 3) pts = pts.slice().reverse();
    return pts.map(([u, v]) => map[i](u, v, rx, ry));
  };
  // 顺时针顺序：右上、右下、左下、左上
  const seq = [1, 2, 3, 0].map(corner);
  if (reverse) {
    seq.reverse();
    for (let i = 0; i < seq.length; i++) seq[i] = seq[i].slice().reverse();
  }
  let d = '';
  seq.forEach((pts, i) => {
    d += (i === 0 ? 'M' : 'L') + num(pts[0][0]) + ' ' + num(pts[0][1]);
    for (let j = 1; j + 2 < pts.length; j += 3) {
      d += 'C' + [pts[j], pts[j + 1], pts[j + 2]].map((p) => num(p[0]) + ' ' + num(p[1])).join(' ');
    }
  });
  return d + 'Z';
}

/** 矩形子路径；reverse 时逆时针 */
export function rectPath(b: Box, reverse = false): string {
  const { x, y, w, h } = b;
  if (w <= 0 || h <= 0) return '';
  return reverse
    ? `M${num(x)} ${num(y)}V${num(y + h)}H${num(x + w)}V${num(y)}Z`
    : `M${num(x)} ${num(y)}H${num(x + w)}V${num(y + h)}H${num(x)}Z`;
}

/**
 * 解析 corner-shape 的值（我们从 --ok-shape 读到的就是它）：1–4 个值，顺序同 border-radius。
 * 关键字 round / squircle / square / bevel / scoop / notch 和 superellipse(K | infinity | -infinity)。全是 round 返回 null
 */
export function parseCornerShape(value: string): CornerKs | null {
  const toks = value.trim().toLowerCase().match(/superellipse\(\s*[^)]*\)|[a-z-]+/g);
  if (!toks || !toks.length || toks.length > 4) return null;
  const ks: number[] = [];
  for (const t of toks) {
    let k: number;
    const m = /^superellipse\(\s*([^)]*?)\s*\)$/.exec(t);
    if (m) k = m[1] === 'infinity' ? Infinity : m[1] === '-infinity' ? -Infinity : parseFloat(m[1]);
    else k = ({ round: 1, squircle: 2, square: Infinity, bevel: 0, scoop: -1, notch: -Infinity } as Record<string, number>)[t] ?? NaN;
    if (Number.isNaN(k)) return null;
    ks.push(k);
  }
  const [a, b = a, c = a, d = b] = ks;
  const out: CornerKs = [a, b, c, d];
  return out.every((k) => k === 1) ? null : out;
}

/* ==========================================================================
   回退绘制：把一个元素的圆角装饰（背景之外的部分）描述成数据，再生成 clip-path 和 border-image
   ========================================================================== */

/** 一层阴影（来自计算后的 box-shadow）。模糊忽略不计：设计里没有阴影，只有零模糊的描边和高光 */
export interface ShadowLayer { inset: boolean; dx: number; dy: number; spread: number; color: string }
export interface OutlineLayer { offset: number; width: number; color: string }

/** 一个元素（或伪元素）在回退里需要知道的全部：尺寸、半径（已缩放）、曲率、边框、阴影、outline */
export interface CornerDecor {
  w: number;
  h: number;
  radii: CornerRadii;
  ks: CornerKs;
  /** 上右下左的边框宽度 */
  border: [number, number, number, number];
  borderColor: string;
  shadows: ShadowLayer[];
  outline: OutlineLayer | null;
  /**
   * 元素背后的颜色（最近的不透明祖先背景）。外侧装饰（outline、外阴影）离超椭圆很近时，环在 45° 附近会伸进盒子的矩形里；
   * 那里原生画的是直角的底色，Chromium 那里露出的是背后的页面。补丁先用这个颜色盖住，再画环
   */
  backdrop?: string;
}

/** 颜色的不透明度：transparent、rgba(…, a)、rgb(… / a)、color(… / a)；解析不了当作不透明 */
export function colorAlpha(c: string): number {
  const s = c.trim().toLowerCase();
  if (s === 'transparent') return 0;
  let m = /\/\s*([\d.]+%?)\s*\)$/.exec(s);
  if (!m && /^(rgba|hsla)\(/.test(s)) m = /,\s*([\d.]+%?)\s*\)$/.exec(s);
  if (!m) return 1;
  return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
}

/** 按顶层逗号切开（括号里的逗号不算） */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}

/** 解析计算后的 box-shadow（颜色可能在前也可能在后；长度一律是 px） */
export function parseBoxShadow(value: string): ShadowLayer[] {
  if (!value || value === 'none') return [];
  return splitTop(value).map((layer) => {
    const fn = /[a-z-]+\([^()]*(?:\([^()]*\)[^()]*)*\)/i.exec(layer);
    let color = fn ? fn[0] : '';
    let rest = fn ? layer.replace(fn[0], ' ') : layer;
    const inset = /\binset\b/.test(rest);
    rest = rest.replace(/\binset\b/, ' ');
    if (!color) { const w = rest.split(/\s+/).find((t) => t && !/^-?[\d.]/.test(t)); color = w || 'currentcolor'; }
    const n = (rest.match(/-?[\d.]+(?:e-?\d+)?(?=px)/g) || []).map(Number);
    return { inset, dx: n[0] || 0, dy: n[1] || 0, spread: n[3] || 0, color };
  });
}

/** 外侧的装饰（外阴影、outline）伸出盒子多远 */
export function outerExtent(d: Pick<CornerDecor, 'shadows' | 'outline'>): number {
  let e = 0;
  for (const s of d.shadows) if (!s.inset && colorAlpha(s.color) > 0) e = Math.max(e, s.spread + Math.max(Math.abs(s.dx), Math.abs(s.dy)));
  if (d.outline && colorAlpha(d.outline.color) > 0) e = Math.max(e, d.outline.offset + d.outline.width);
  return Math.max(0, e);
}

const boxOf = (d: { w: number; h: number }): Box => ({ x: 0, y: 0, w: d.w, h: d.h });

/** 内边框轮廓（padding box）：按各边宽度内缩，每个角的两个半径各减去相邻边的宽度 */
function paddingContour(d: CornerDecor): { box: Box; radii: CornerRadii } {
  const [t, r, b, l] = d.border;
  const [tl, tr, br, bl] = d.radii;
  const sub = (v: number, by: number) => Math.max(0, v - by);
  return {
    box: { x: l, y: t, w: d.w - l - r, h: d.h - t - b },
    radii: [[sub(tl[0], l), sub(tl[1], t)], [sub(tr[0], r), sub(tr[1], t)], [sub(br[0], r), sub(br[1], b)], [sub(bl[0], l), sub(bl[1], b)]],
  };
}

/**
 * 外侧装饰在这个元素坐标里的可见区域（nonzero 子路径），供 clip-path 合并。
 * 外阴影 = 外扩后的形状（盒内部分本来就可见）；outline = 外扩到外缘的形状 + 外扩到内缘的形状（逆时针挖掉中间的缝）
 */
export function outerRegions(d: CornerDecor, at: { x: number; y: number } = { x: 0, y: 0 }): string {
  let p = '';
  const base = { x: at.x, y: at.y, w: d.w, h: d.h };
  for (const s of d.shadows) {
    if (s.inset || colorAlpha(s.color) <= 0) continue;
    p += shapePath(inflate(base, s.spread, s.dx, s.dy), offsetRadii(d.radii, s.spread), d.ks);
  }
  const o = d.outline;
  if (o && o.width > 0 && colorAlpha(o.color) > 0) {
    p += shapePath(inflate(base, o.offset + o.width), offsetRadii(d.radii, o.offset + o.width), d.ks);
    p += shapePath(inflate(base, o.offset), offsetRadii(d.radii, o.offset), d.ks, true);
  }
  return p;
}

/**
 * clip-path 的路径：
 * · 一个比盒子大 bleed 的大矩形（溢出盒子的子元素照常可见，只在四个角动刀）；
 * · 每个有圆角的角挖一个洞：从角往盒内到半径、往盒外到外侧装饰的最远处 reach；
 * · 再把超椭圆形状本身、以及外侧装饰（outline 环、外阴影）的可见区域并回来。
 * 原生绘制在角上是直角（回退时 border-radius 置 0），洞里只留下超椭圆和装饰的真实形状。
 * extra 是叠在这个元素上的其它部件（伪元素）的外侧装饰，reach 要覆盖它们
 */
export function cornerClipPath(d: CornerDecor, bleed: number, extra = '', extraReach = 0): string {
  const { w, h, radii } = d;
  const reach = Math.max(outerExtent(d), extraReach);
  const B = Math.max(bleed, reach + 1);
  let p = rectPath({ x: -B, y: -B, w: w + 2 * B, h: h + 2 * B });
  const [tl, tr, br, bl] = radii;
  const E = reach;
  if (tl[0] > 0 && tl[1] > 0) p += rectPath({ x: -E, y: -E, w: tl[0] + E, h: tl[1] + E }, true);
  if (tr[0] > 0 && tr[1] > 0) p += rectPath({ x: w - tr[0], y: -E, w: tr[0] + E, h: tr[1] + E }, true);
  if (br[0] > 0 && br[1] > 0) p += rectPath({ x: w - br[0], y: h - br[1], w: br[0] + E, h: br[1] + E }, true);
  if (bl[0] > 0 && bl[1] > 0) p += rectPath({ x: -E, y: h - bl[1], w: bl[0] + E, h: bl[1] + E }, true);
  p += shapePath(boxOf(d), radii, d.ks);
  return p + outerRegions(d) + extra;
}

export interface CornerPaint {
  /** SVG 源码 */
  svg: string;
  /** border-image-slice（也是 border-image-width，单位 px），上右下左 */
  slice: [number, number, number, number];
  /** border-image-outset */
  outset: number;
}

/**
 * 角上的补丁，画成一张九宫格的 SVG（border-image）。原生绘制（border-radius 为 0）在直边上已经是对的，
 * 补丁只补角上原生画不出来的部分，和原生的部分不重叠：
 * · 内阴影（描边、顶部高光）：原生的是贴着四边的直条；补丁 = 超椭圆内 ∩ 洞的外接矩形 − 洞（洞是内缩 / 平移后的超椭圆）；
 * · 外阴影：补丁 = 外扩形状落在盒子矩形里、超椭圆外的那一弯；以及上层原生阴影在角上多出来、本该露出下层的地方；
 * · outline：原生是直角的环；补丁 = 超椭圆的环落在原生环内侧的那一弯；
 * · 边框：border-image 会顶替原生边框，所以边框整圈都由补丁画（直边部分在九宫格的边上拉伸）。
 * 角上的内容都在九宫格的四个角块里，边块只有直线，所以元素尺寸变化时这张图不用重画（半径被缩放时除外）。
 * 没有可画的东西时返回 null
 */
/** 补丁九宫格的布局：外扩、角块往盒内伸多远、能不能拉伸。补丁只在这些和装饰本身变了时才需要重画 */
function paintLayout(d: CornerDecor) {
  const shadows = d.shadows.filter((s) => colorAlpha(s.color) > 0);
  const E = Math.ceil(outerExtent(d)) + 1;
  // 角块往盒内要伸到：半径 + 内阴影的内缩和平移 + 边框 + 1px 抗锯齿
  let pad = 1 + Math.max(...d.border);
  for (const s of shadows) if (s.inset) pad = Math.max(pad, 1 + s.spread + Math.max(Math.abs(s.dx), Math.abs(s.dy)));
  pad = Math.ceil(pad);
  const [tl, tr, br, bl] = d.radii;
  const L = Math.ceil(Math.max(tl[0], bl[0])) + pad, R = Math.ceil(Math.max(tr[0], br[0])) + pad;
  const T = Math.ceil(Math.max(tl[1], tr[1])) + pad, B = Math.ceil(Math.max(bl[1], br[1])) + pad;
  return { E, L, R, T, B, stretchX: L + R + 1 <= d.w, stretchY: T + B + 1 <= d.h };
}

/** 补丁缓存键里和尺寸有关的部分：能拉伸的方向不看尺寸 */
export function paintSizeKey(d: CornerDecor): string {
  const l = paintLayout(d);
  return (l.stretchX ? 'S' : d.w) + 'x' + (l.stretchY ? 'S' : d.h);
}

export function cornerPaint(d: CornerDecor): CornerPaint | null {
  const { w, h, radii, ks } = d;
  if (w <= 0 || h <= 0) return null;
  const hasRadius = radii.some(([x, y]) => x > 0 && y > 0);
  const hasBorder = d.border.some((b) => b > 0) && colorAlpha(d.borderColor) > 0;
  const shadows = d.shadows.filter((s) => colorAlpha(s.color) > 0);
  const outline = d.outline && d.outline.width > 0 && colorAlpha(d.outline.color) > 0 ? d.outline : null;
  if (!hasBorder && (!hasRadius || (!shadows.length && !outline))) return null;

  const { E, L, R, T, B: Bt, stretchX, stretchY } = paintLayout(d);
  // 虚拟盒子：比四个角块加起来多 1px，中间那 1px 拉伸到真实尺寸。真实盒子更小就直接按真实尺寸画、不拉伸
  const vw = stretchX ? L + R + 1 : w, vh = stretchY ? T + Bt + 1 : h;
  const slice: [number, number, number, number] = [
    stretchY ? T + E : vh / 2 + E, stretchX ? R + E : vw / 2 + E, stretchY ? Bt + E : vh / 2 + E, stretchX ? L + E : vw / 2 + E,
  ];
  const v: CornerDecor = { ...d, w: vw, h: vh };
  const box = boxOf(v);
  const C = shapePath(box, radii, ks);
  const pad0 = paddingContour(v);
  const P = hasBorder ? shapePath(pad0.box, pad0.radii, ks) : null;
  // 边缘只抗锯齿一次：补丁的外缘如果正好落在元素 clip-path 的边上（超椭圆本身、最外一圈装饰的外缘），
  // 两边各抗锯齿一次，1px 的线在角上会变淡、断续。这些边上补丁多画 1px，由 clip-path 统一切边
  const AA = 1;
  const outerShadows = shadows.filter((s) => !s.inset);
  const shadowReach = (s: ShadowLayer) => s.spread + Math.max(Math.abs(s.dx), Math.abs(s.dy));
  const reach = outerExtent(d);
  // C 外面紧挨着的地方要是可见（外阴影、贴着边的 outline），补丁不能越过 C
  const nearOutside = outerShadows.length > 0 || (outline !== null && outline.offset < AA && outline.offset + outline.width > 0);
  const Cx = nearOutside ? C : shapePath(inflate(box, AA), offsetRadii(radii, AA), ks);

  // 角上的洞（和 cornerClipPath 里挖的洞同一范围）：多画的那 1px 只许落在洞里，直边上原生绘制本来就对
  const [rtl, rtr, rbr, rbl] = radii;
  const holes = rectPath({ x: -E, y: -E, w: rtl[0] + E, h: rtl[1] + E }) + rectPath({ x: vw - rtr[0], y: -E, w: rtr[0] + E, h: rtr[1] + E })
    + rectPath({ x: vw - rbr[0], y: vh - rbr[1], w: rbr[0] + E, h: rbr[1] + E }) + rectPath({ x: -E, y: vh - rbl[1], w: rbl[0] + E, h: rbl[1] + E });
  let defs = `<clipPath id='h'><path d='${holes}'/></clipPath><clipPath id='p'><path d='${P ?? Cx}'/></clipPath>`;
  let body = '';
  // 外侧装饰伸进盒子矩形、又在超椭圆外的那一弯：先铺背后的颜色，盖住原生直角底色
  if (reach > 0 && d.backdrop && colorAlpha(d.backdrop) > 0) {
    defs += `<mask id='bd' maskUnits='userSpaceOnUse' x='${-E}' y='${-E}' width='${vw + 2 * E}' height='${vh + 2 * E}'><path fill='#fff' d='${outerRegions(v)}'/><path fill='#000' d='${C}'/></mask>`;
    body += `<path mask='url(#bd)' clip-path='url(#h)' fill='${d.backdrop}' d='${rectPath(box)}'/>`;
  }
  // 外阴影：从最下层画起（box-shadow 列表里越靠前越在上）
  outerShadows.slice().reverse().forEach((s, ri) => {
    const i = outerShadows.length - 1 - ri;
    const grow = shadowReach(s) >= reach && reach > 0 ? AA : 0;   // 最外一圈：外缘就是 clip 的边
    const shape = shapePath(inflate(box, s.spread + grow, s.dx, s.dy), offsetRadii(radii, s.spread + grow), ks);
    let mask = '';
    for (let j = 0; j < i; j++) {
      const u = outerShadows[j];
      mask += `<path fill='#fff' d='${rectPath(inflate(box, u.spread, u.dx, u.dy))}'/>`;
      mask += `<path fill='#000' d='${shapePath(inflate(box, u.spread, u.dx, u.dy), offsetRadii(radii, u.spread), ks)}'/>`;
    }
    mask += `<path fill='#fff' d='${rectPath(box)}'/><path fill='#000' d='${C}'/>`;
    defs += `<mask id='m${i}' maskUnits='userSpaceOnUse' x='${-E}' y='${-E}' width='${vw + 2 * E}' height='${vh + 2 * E}'>${mask}</mask>`;
    body += `<path mask='url(#m${i})' fill='${s.color}' d='${shape}'/>`;
  });
  // 内阴影：洞 = 内边框轮廓内缩 spread、再平移
  shadows.filter((s) => s.inset).reverse().forEach((s) => {
    const hr = inflate(pad0.box, -s.spread, s.dx, s.dy);
    if (hr.w <= 0 || hr.h <= 0) return;
    const hole = shapePath(hr, offsetRadii(pad0.radii, -s.spread), ks);
    body += `<path clip-path='url(#p)' fill-rule='evenodd' fill='${s.color}' d='${rectPath(hr)}${hole}'/>`;
  });
  if (P) {
    body += `<path fill-rule='evenodd' fill='${d.borderColor}' d='${C}${P}'/>`;
    if (Cx !== C) body += `<path clip-path='url(#h)' fill-rule='evenodd' fill='${d.borderColor}' d='${Cx}${C}'/>`;
  }
  if (outline && hasRadius) {
    const o = outline.offset, w2 = outline.width;
    const inner = inflate(box, o);
    defs += `<clipPath id='o' clip-path='url(#h)'><path d='${rectPath(inner)}'/></clipPath>`;
    const outGrow = o + w2 > 0 && o + w2 >= reach ? AA : 0;   // 外缘在盒子外、又是最外一圈：外缘是 clip 的边
    const inGrow = o >= AA ? AA : 0;                           // 内缘在盒子外：内缘也是 clip 的边（缝被 clip 挖掉）
    const out = shapePath(inflate(box, o + w2 + outGrow), offsetRadii(radii, o + w2 + outGrow), ks);
    const inn = shapePath(inflate(box, o - inGrow), offsetRadii(radii, o - inGrow), ks);
    body += `<path clip-path='url(#o)' fill-rule='evenodd' fill='${outline.color}' d='${out}${inn}'/>`;
  }
  if (!body) return null;
  const iw = vw + 2 * E, ih = vh + 2 * E;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${iw}' height='${ih}' viewBox='${-E} ${-E} ${iw} ${ih}'><defs>${defs}</defs>${body}</svg>`;
  return { svg, slice, outset: E };
}

/** 把补丁写成 border-image 的值 */
export function borderImageValue(p: CornerPaint): string {
  const s = p.slice.map((x) => num(x)).join(' ');
  const wpx = p.slice.map((x) => num(x) + 'px').join(' ');
  return `url("data:image/svg+xml,${encodeURIComponent(p.svg)}") ${s} / ${wpx} / ${num(p.outset)}px stretch`;
}
