import { forwardRef, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ImgHTMLAttributes, ReactNode, SyntheticEvent } from 'react';
import { cx, Icon } from '../core';

export type ImageRadius = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'full';
export type ImageFit = 'cover' | 'contain';
export type ImageStatus = 'loading' | 'loaded' | 'error' | 'empty' | 'content';

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'children' | 'placeholder' | 'loading'> {
  /** 图片地址。不传时显示 children；children 也没有时显示 fallback */
  src?: string;
  /** 必填。纯装饰的图传 alt=""（整块对读屏隐藏） */
  alt: string;
  /** 固定宽高比：数字（16 / 9）或 CSS 写法（'4 / 3'）。不传时按图片本身的比例 */
  ratio?: number | string;
  /** 图片怎么填进框里，默认 cover（裁切铺满）；contain 完整显示、留空处露出底色 */
  fit?: ImageFit;
  /** 圆角档位：0 直角、1..6 对应 --ok-r-1..6、full 全圆。默认 3（16） */
  radius?: ImageRadius;
  /** 加载失败、或者没有 src 也没有 children 时显示。默认是中性色块 + 图片图标 */
  fallback?: ReactNode;
  /** 加载中的占位：skeleton（默认）扫过一道微光；none 只显示底色 */
  placeholder?: 'skeleton' | 'none';
  /** 原生懒加载，默认 lazy */
  loading?: 'lazy' | 'eager';
  /**
   * 没有 src 时：children 就是“图”（内联 svg、插画、任意节点），由 alt 给它起名字。
   * 有 src 时：children 叠在图片上面（角标、标签之类）。
   */
  children?: ReactNode;
}

const ratioValue = (r: number | string | undefined) => (r === undefined ? undefined : typeof r === 'number' ? String(r) : r);

/**
 * 图片容器：固定比例、裁切方式、圆角，加载中骨架微光、加载完淡入、失败回退。
 * className / style / ref 给外框；其余 img 原生属性（srcSet、sizes、decoding、onLoad…）透传到 <img>。
 */
export const Image = forwardRef<HTMLSpanElement, ImageProps>(function Image(
  {
    src, alt, ratio, fit = 'cover', radius = 3, fallback, placeholder = 'skeleton', loading = 'lazy',
    children, className, style, onLoad, onError, decoding = 'async', ...imgProps
  }, ref,
) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loadState, setLoadState] = useState<{ src?: string; status: 'loading' | 'loaded' | 'error' }>({ src, status: 'loading' });
  const hasChildren = children !== undefined && children !== null && children !== false;

  let status: ImageStatus;
  if (src) status = loadState.src === src ? loadState.status : 'loading';
  else status = hasChildren ? 'content' : 'empty';

  // 缓存里的图可能在事件挂上之前就加载完了（比如服务端渲染后注水），补一次判断
  useEffect(() => {
    const img = imgRef.current;
    if (src && img && img.complete && img.naturalWidth > 0) setLoadState({ src, status: 'loaded' });
  }, [src]);

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => { setLoadState({ src, status: 'loaded' }); onLoad?.(e); };
  const handleError = (e: SyntheticEvent<HTMLImageElement>) => { setLoadState({ src, status: 'error' }); onError?.(e); };

  // 没有 <img> 可读（回退或 children 当图）时，由外框承担“图”的角色
  const frameIsImage = status === 'content' || status === 'error' || status === 'empty';
  const a11y = frameIsImage ? (alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true }) : null;
  const aspect = ratioValue(ratio);

  return (
    <span
      ref={ref}
      className={cx('ok-image', className)}
      data-status={status}
      data-fit={fit}
      data-radius={radius}
      data-placeholder={placeholder}
      data-ratio={aspect !== undefined ? '' : undefined}
      style={aspect !== undefined ? ({ aspectRatio: aspect, ...style } as CSSProperties) : style}
      {...a11y}
    >
      {src && status !== 'error' && (
        <img
          {...imgProps}
          ref={imgRef}
          className="ok-image__img"
          src={src}
          alt={alt}
          loading={loading}
          decoding={decoding}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      {(status === 'error' || status === 'empty') && (
        <span className="ok-image__fallback">{fallback ?? <Icon name="image" className="ok-image__icon" />}</span>
      )}
      {hasChildren && <span className={src ? 'ok-image__overlay' : 'ok-image__content'}>{children}</span>}
    </span>
  );
});
