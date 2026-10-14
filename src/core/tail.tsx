import { cloneElement, createContext, isValidElement, useContext } from 'react';
import type { ReactElement, ReactNode, SVGProps } from 'react';
import { cx } from './utils';

/** 默认尾巴的路径（48×48） */
export const TAIL_PATH = 'M9 10C9 26 20 38 31 38c7 0 11-5 11-10.500S37.500 18 32 18c-5 0-8.500 3.500-9 8';

/**
 * 替换尾巴用的图案：
 * - 一个节点（通常是 48×48 viewBox 的 svg）：渲染时把 className 合并到它的根元素上；
 * - 或一个函数：拿到 { className } 自己渲染。
 * 图案里带 pathLength="1" 的路径 / 图形会跟着做描线动效；没有的只跟着整体摆动。
 */
export type TailGlyphSource = ReactNode | ((props: { className: string }) => ReactNode);

const TailContext = createContext<TailGlyphSource | undefined>(undefined);

export interface TailProviderProps {
  /** 替换的图案；不传（undefined）时沿用外层的设置，最外层就是默认尾巴 */
  tail?: TailGlyphSource;
  children?: ReactNode;
}

/** 在这一块里把品牌尾巴（加载器、按钮的加载状态……）换成别的图案。可以嵌套，内层优先 */
export function TailProvider({ tail, children }: TailProviderProps) {
  const parent = useContext(TailContext);
  return <TailContext.Provider value={tail === undefined ? parent : tail}>{children}</TailContext.Provider>;
}

/** 当前生效的替换图案；undefined 表示用默认尾巴 */
export function useTail(): TailGlyphSource | undefined {
  return useContext(TailContext);
}

export interface TailGlyphProps extends SVGProps<SVGSVGElement> {
  /** 一般传 "ok-tail"，动效和尺寸都挂在这个类上 */
  className?: string;
}

/** 渲染尾巴图案：默认是品牌尾巴，外层有 TailProvider 时换成它给的图案。纯装饰，对读屏隐藏 */
export function TailGlyph({ className = 'ok-tail', ...rest }: TailGlyphProps) {
  const tail = useContext(TailContext);
  if (tail === undefined || tail === null || tail === false) {
    return (
      <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false" {...rest}>
        <path pathLength={1} d={TAIL_PATH} />
      </svg>
    );
  }
  if (typeof tail === 'function') return <>{tail({ className })}</>;
  if (isValidElement(tail)) {
    const el = tail as ReactElement<{ className?: string; 'aria-hidden'?: unknown; focusable?: unknown }>;
    return cloneElement(el, {
      className: cx(className, el.props.className),
      'aria-hidden': el.props['aria-hidden'] ?? true,
      ...(el.type === 'svg' ? { focusable: el.props.focusable ?? 'false' } : null),
    });
  }
  // 文字、数字之类：包一层，类名照样挂上
  return <span className={className} aria-hidden="true">{tail}</span>;
}
