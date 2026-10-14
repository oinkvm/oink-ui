import type { CSSProperties } from 'react';

/** 响应式属性：单个值，或按断点（min-width：sm 520 / md 768 / lg 1024 / xl 1280）给值 */
export type Responsive<T> = T | { base?: T; sm?: T; md?: T; lg?: T; xl?: T };

/** 间距档位，对应令牌 --ok-s-*（0 表示没有间距） */
export type Space = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;

export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

const ORDER = ['base', 'sm', 'md', 'lg', 'xl'] as const;
type Step = (typeof ORDER)[number];

export function isResponsiveObject<T>(v: Responsive<T> | undefined): v is { [K in Step]?: T } {
  return typeof v === 'object' && v !== null;
}

/** 间距档位 → CSS 值 */
export const spaceVar = (n: Space): string => (n === 0 ? '0px' : `var(--ok-s-${n})`);
/** 间距档位 → px 数值（4pt 栅格） */
export const spacePx = (n: Space): number => n * 4;

const ALIGN: Record<Align, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' };
const JUSTIFY: Record<Justify, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around', evenly: 'space-evenly',
};
export const alignVar = (v: Align) => ALIGN[v];
export const justifyVar = (v: Justify) => JUSTIFY[v];

/**
 * 把响应式值落成带断点后缀的自定义属性：--ok-l-<name>、--ok-l-<name>-sm …
 * 样式表（responsive.css）在对应的 @media 里把它们解析到 --_l-<name>，组件只读 --_l-<name>。
 * 全程不需要脚本判断视口，所以服务端渲染出来的首屏就是对的。
 * 对象写法会向上补齐：{ base: 2, md: 4 } → base 2、sm 2、md 4、lg 4、xl 4；没给 base 时，小于首个断点用组件默认值。
 */
export function responsiveVars<T>(name: string, value: Responsive<T> | undefined, map: (v: T) => string | number): Record<string, string> {
  const out: Record<string, string> = {};
  if (value === undefined || value === null) return out;
  const key = `--ok-l-${name}`;
  if (!isResponsiveObject(value)) {
    out[key] = String(map(value as T));
    return out;
  }
  let cur: string | undefined;
  for (const step of ORDER) {
    const v = value[step];
    if (v !== undefined) cur = String(map(v));
    if (cur !== undefined) out[step === 'base' ? key : `${key}-${step}`] = cur;
  }
  return out;
}

export interface SpacingProps {
  /** 四边内边距（间距档位） */
  padding?: Responsive<Space>;
  /** 左右内边距，优先于 padding */
  paddingX?: Responsive<Space>;
  /** 上下内边距，优先于 padding */
  paddingY?: Responsive<Space>;
}

export interface LayoutVarInput extends SpacingProps {
  gap?: Responsive<Space>;
  rowGap?: Responsive<Space>;
  align?: Responsive<Align>;
  justify?: Responsive<Justify>;
}

/** 布局原语共用：把间距 / 对齐类属性落成自定义属性 */
export function layoutVars(p: LayoutVarInput, style?: CSSProperties): CSSProperties {
  return {
    ...responsiveVars('gap', p.gap, spaceVar),
    ...responsiveVars('rgap', p.rowGap, spaceVar),
    ...responsiveVars('p', p.padding, spaceVar),
    ...responsiveVars('px', p.paddingX, spaceVar),
    ...responsiveVars('py', p.paddingY, spaceVar),
    ...responsiveVars('align', p.align, alignVar),
    ...responsiveVars('justify', p.justify, justifyVar),
    ...style,
  } as CSSProperties;
}

/** 有任何内边距属性时返回 ''（用于 data-pad），否则 undefined */
export const padAttr = (p: SpacingProps) => (p.padding !== undefined || p.paddingX !== undefined || p.paddingY !== undefined ? '' : undefined);
