import { forwardRef, useId } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { cx } from './utils';

/**
 * 标志（视口 32×32，整体逆时针转 8°）：墨色圆角方块（左下角收得更小），
 * 右下角压着一只强调色的猪鼻子（两个鼻孔）
 */
export const OINK_LOGO_INK_PATH = 'M10 3H18A7 7 0 0 1 25 10V18A7 7 0 0 1 18 25H5A2 2 0 0 1 3 23V10A7 7 0 0 1 10 3Z';
export const OINK_LOGO_SNOUT = { x: 15.5, y: 15, width: 13.5, height: 10, rx: 5 } as const;
export const OINK_LOGO_NOSTRILS = [{ cx: 20, cy: 20 }, { cx: 24.5, cy: 20 }] as const;

export interface OinkLogoProps extends HTMLAttributes<HTMLSpanElement> {
  /** 图形的边长（px），默认 28。字标字号跟着按比例变 */
  size?: number;
  /** 图形右边带 “Oink UI” 字标 */
  wordmark?: boolean;
  /** 给读屏的名字，默认 "Oink UI"。传了 aria-hidden 时不输出 */
  title?: string;
  /** 出现时播一次的小动效：猪鼻子拱一下。减弱动效时直接显示终态 */
  animated?: boolean;
  /**
   * 单色版：整枚标志只用 currentColor（用 color 设色）。方块在鼻子周围让出一圈空隙，
   * 鼻子是实心的、两个鼻孔镂空，所以放在任何底色上都只有「一种颜色 + 底色」。
   * 适合强调色底、照片上、单色印刷。单色版不读 --ok-logo-ink / --ok-logo-accent / --ok-logo-nostril
   */
  mono?: boolean;
}

/**
 * Oink UI 组件库的标志：墨色圆角方块 + 右下角强调色的猪鼻子。
 * 颜色由三个 CSS 变量控制（写在 .ok-logo 或任意祖先上）：
 * · --ok-logo-ink：方块和字标，默认 currentColor（.ok-logo 的 color 是 --ok-text，深色主题自动变浅）
 * · --ok-logo-accent：鼻子，默认跟着强调色（自定义强调色和方块对比度不够时，浅色主题换白、深色主题换墨，见 logoSnoutColors）
 * · --ok-logo-nostril：两个鼻孔，默认跟随 --ok-logo-ink；设成底色就是镂空的效果
 * 只要一种颜色时用 mono。
 */
export const OinkLogo = forwardRef<HTMLSpanElement, OinkLogoProps>(function OinkLogo(
  { size = 28, wordmark = false, title = 'Oink UI', animated = false, mono = false, className, style, ...rest }, ref,
) {
  const uid = useId().replace(/:/g, '');
  const gapId = `ok-logo-gap-${uid}`;
  const holesId = `ok-logo-holes-${uid}`;
  const hidden = rest['aria-hidden'] === true || rest['aria-hidden'] === 'true';
  const a11y = hidden ? null : { role: 'img', 'aria-label': title };
  return (
    <span
      ref={ref}
      className={cx('ok-logo', mono && 'ok-logo--mono', className)}
      data-animated={animated || undefined}
      style={{ '--ok-logo-size': `${size}px`, ...style } as CSSProperties}
      {...a11y}
      {...rest}
    >
      <svg className="ok-logo__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        {mono && (
          <defs>
            {/* 方块在鼻子外面让出 1.5 的空隙 */}
            <mask id={gapId} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
              <rect x="0" y="0" width="32" height="32" fill="#fff" />
              <rect {...OINK_LOGO_SNOUT} fill="#000" stroke="#000" strokeWidth={3} />
            </mask>
            {/* 鼻孔镂空 */}
            <mask id={holesId} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
              <rect {...OINK_LOGO_SNOUT} fill="#fff" />
              {OINK_LOGO_NOSTRILS.map((n) => <ellipse key={n.cx} cx={n.cx} cy={n.cy} rx={1.3} ry={1.9} fill="#000" />)}
            </mask>
          </defs>
        )}
        <g transform="rotate(-8 16 16)">
          <path className="ok-logo__ink" d={OINK_LOGO_INK_PATH} mask={mono ? `url(#${gapId})` : undefined} />
          <g className="ok-logo__snout">
            <rect className="ok-logo__accent" {...OINK_LOGO_SNOUT} mask={mono ? `url(#${holesId})` : undefined} />
            {!mono && OINK_LOGO_NOSTRILS.map((n) => <ellipse key={n.cx} className="ok-logo__nostril" cx={n.cx} cy={n.cy} rx={1.3} ry={1.9} />)}
          </g>
        </g>
      </svg>
      {wordmark && <span className="ok-logo__word" aria-hidden="true">Oink UI</span>}
    </span>
  );
});
