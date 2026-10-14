/**
 * 颜色工具：十六进制 ↔ RGB / HSV、相对亮度与对比度、OKLab 感知亮度，以及从任意颜色派生一套强调色变量。
 * 只处理不透明的 sRGB 颜色；十六进制统一输出小写 #rrggbb。
 */

/** 0–255 */
export type RGB = [number, number, number];
/** h 0–360，s / v 0–1 */
export interface HSV { h: number; s: number; v: number }

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/** 解析 #rgb / #rrggbb（# 可省略，大小写不限）；不合法返回 null */
export function parseHex(input: string): RGB | null {
  const s = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) return [0, 1, 2].map((i) => parseInt(s[i] + s[i], 16)) as RGB;
  if (/^[0-9a-f]{6}$/i.test(s)) return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;
  return null;
}

/** 规范化成小写 #rrggbb；不合法返回 null */
export function normalizeHex(input: string): string | null {
  const rgb = parseHex(input);
  return rgb ? toHex(rgb) : null;
}

export function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsv([r, g, b]: RGB): HSV {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
}

export const hexToHsv = (hex: string): HSV | null => { const rgb = parseHex(hex); return rgb ? rgbToHsv(rgb) : null; };
export const hsvToHex = (hsv: HSV): string => toHex(hsvToRgb(hsv));

const toLinear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** WCAG 相对亮度 0–1 */
export function luminance([r, g, b]: RGB): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 对比度 1–21 */
export function contrastRatio(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/* —— OKLab / OKLCH：按人眼感知的亮度调颜色 —— */
type Lab = [number, number, number];
function rgbToOklab([r, g, b]: RGB): Lab {
  const [R, G, B] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
/** OKLab → 线性 sRGB（可能越界，调用方判断是否在色域内） */
function oklabToLinear([L, a, b]: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** 感知亮度（OKLab 的 L，0–1） */
export const perceivedLightness = (rgb: RGB): number => rgbToOklab(rgb)[0];

/** 保持色相，把感知亮度换成 L；色度超出 sRGB 色域时逐步收小色度 */
function withLightness(rgb: RGB, L: number): RGB {
  const [, a, b] = rgbToOklab(rgb);
  const C = Math.hypot(a, b), H = Math.atan2(b, a);
  let lo = 0, hi = C;
  const at = (c: number) => oklabToLinear([L, c * Math.cos(H), c * Math.sin(H)]);
  const inGamut = (v: number[]) => v.every((x) => x >= -1e-4 && x <= 1 + 1e-4);
  if (!inGamut(at(C))) {
    for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (inGamut(at(mid))) lo = mid; else hi = mid; }
  } else lo = C;
  return at(lo).map((v) => fromLinear(clamp(v))) as RGB;
}

/** 沿感知亮度往暗（toward = 0）或往亮（toward = 1）调，直到与 bg 的对比度达到 ratio；做不到时返回最接近的 */
function untilContrast(rgb: RGB, bg: RGB, ratio: number, toward: 0 | 1): RGB {
  if (contrastRatio(rgb, bg) >= ratio) return rgb;
  const L0 = perceivedLightness(rgb);
  let lo = 0, hi = 1, best = withLightness(rgb, toward);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const L = toward === 0 ? L0 - (L0 - 0) * mid : L0 + (1 - L0) * mid;
    const c = withLightness(rgb, L);
    if (contrastRatio(c, bg) >= ratio) { best = c; hi = mid; } else lo = mid;
  }
  return best;
}

/** 强调色上的文字（墨色 / 白）以感知亮度为界：比它暗的颜色上用白字 */
export const ON_ACCENT_THRESHOLD = 0.65;
const WHITE: RGB = [255, 255, 255];
/** 深色主题下卡片的底色，算深色模式下的强调色文字时对比它 */
const DARK_CARD: RGB = [0x2a, 0x29, 0x27];

/** 标志的方块：浅色主题下是墨色，深色主题下是纸色（都跟着 --ok-text） */
const LOGO_SQUARE = { light: [0x1b, 0x1c, 0x22] as RGB, dark: [0xf4, 0xf4, 0xf6] as RGB };
/** 猪鼻子和方块的对比度低于它就换色。五个预设里最低的是深色主题下的琥珀色（约 1.51），都保持原色 */
export const LOGO_SNOUT_MIN_CONTRAST = 1.45;

/**
 * 标志上猪鼻子的颜色：平时就是强调色；和方块对比度不够时换掉——
 * 浅色主题（墨色方块）换成白色，深色主题（纸色方块）换成墨色
 */
export function logoSnoutColors(hex: string): { light: string; dark: string } {
  const rgb = parseHex(hex);
  if (!rgb) return { light: '#ffffff', dark: '#1b1c22' };
  const own = toHex(rgb);
  return {
    light: contrastRatio(rgb, LOGO_SQUARE.light) < LOGO_SNOUT_MIN_CONTRAST ? '#ffffff' : own,
    dark: contrastRatio(rgb, LOGO_SQUARE.dark) < LOGO_SNOUT_MIN_CONTRAST ? '#1b1c22' : own,
  };
}

/** 这个颜色上该用墨色还是白色的字 */
export function onAccentColor(hex: string): '#1b1c22' | '#ffffff' {
  const rgb = parseHex(hex);
  if (!rgb) return '#1b1c22';
  return perceivedLightness(rgb) < ON_ACCENT_THRESHOLD ? '#ffffff' : '#1b1c22';
}

/**
 * 从任意颜色派生强调色的 CSS 变量（写在声明 data-accent="custom" 的元素上）：
 * · --ok-accent        原色
 * · --ok-on-accent     强调色上的字：按感知亮度自动选墨色或白色
 * · --ok-accent-deep   浅色主题下当文字用的深一档（对白底至少 4.5:1）
 * · --ok-accent-light  深色主题下当文字用的亮一档（对深色卡片至少 4.5:1）
 * · --ok-logo-snout-light / -dark  标志的猪鼻子在浅色 / 深色主题下的颜色（对比度不够时换成白色 / 墨色，见 logoSnoutColors）
 * · 白字的颜色不再提亮填充（提亮会掉对比度），--ok-accent-fill 直接用原色，和预设里的蓝色一样
 */
export function accentVars(hex: string): Record<string, string> {
  const rgb = parseHex(hex);
  if (!rgb) return {};
  const on = onAccentColor(hex);
  const vars: Record<string, string> = {
    '--ok-accent': toHex(rgb),
    '--ok-on-accent': on,
    '--ok-accent-deep': toHex(untilContrast(rgb, WHITE, 4.6, 0)),
    '--ok-accent-light': toHex(untilContrast(rgb, DARK_CARD, 4.6, 1)),
    '--ok-logo-snout-light': logoSnoutColors(hex).light,
    '--ok-logo-snout-dark': logoSnoutColors(hex).dark,
  };
  if (on === '#ffffff') {
    vars['--ok-accent-fill'] = 'var(--ok-accent)';
    vars['--ok-accent-fill-hover'] = 'var(--ok-accent-hover)';
  }
  return vars;
}

