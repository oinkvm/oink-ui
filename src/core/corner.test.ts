import {
  clampRadii, colorAlpha, outerExtent, cornerClipPath, cornerHandles, cornerPaint, parseBoxShadow, parseCornerShape, shapePath, superellipseExponent, unitCorner,
} from './corner';
import type { CornerDecor, CornerRadii } from './corner';

/** 三次贝塞尔上的点 */
const bez = (p: number[][], t: number) => [0, 1].map((k) => (1 - t) ** 3 * p[0][k] + 3 * (1 - t) ** 2 * t * p[1][k] + 3 * (1 - t) * t * t * p[2][k] + t ** 3 * p[3][k]);
/** 单位角两段贝塞尔上均匀取点 */
function samples(k: number) {
  const p = unitCorner(k);
  const out: number[][] = [];
  for (const seg of [p.slice(0, 4), p.slice(3, 7)]) for (let i = 0; i <= 20; i++) out.push(bez(seg, i / 20));
  return out;
}
const R = (r: number): CornerRadii => [[r, r], [r, r], [r, r], [r, r]];
const decor = (over: Partial<CornerDecor> = {}): CornerDecor => ({
  w: 300, h: 120, radii: R(34.8), ks: [1.75, 1.75, 1.75, 1.75], border: [0, 0, 0, 0], borderColor: 'transparent',
  shadows: [], outline: null, ...over,
});

describe('超椭圆曲线', () => {
  it('superellipse(K) 的指数是 2^K', () => {
    expect(superellipseExponent(1)).toBe(2);
    expect(superellipseExponent(2)).toBe(4);
    expect(superellipseExponent(1.75)).toBeCloseTo(3.3636, 4);
  });

  it('45° 点正好落在 |u|^n + |v|^n = 1 上，曲线整体和数学曲线的偏差不超过半径的 0.3%', () => {
    for (const k of [0.5, 1.25, 1.75, 2, 3]) {
      const n = superellipseExponent(k);
      const [, , , mid] = unitCorner(k);
      // 单位角里 u、v 是离边的距离，换成离角心的距离 1 - u
      expect((1 - mid[0]) ** n + (1 - mid[1]) ** n).toBeCloseTo(1, 10);
      for (const [u, v] of samples(k)) {
        // 沿径向量偏差：点到角心的距离 / 曲线在同一方向上的距离
        const x = 1 - u, y = 1 - v, rho = Math.hypot(x, y);
        const th = Math.atan2(y, x);
        const onCurve = 1 / ((Math.abs(Math.cos(th)) ** n + Math.abs(Math.sin(th)) ** n) ** (1 / n));
        expect(Math.abs(rho - onCurve)).toBeLessThan(0.003);
      }
    }
  });

  it('K = 1 是正圆（误差小于半径的 0.03%）', () => {
    for (const [u, v] of samples(1)) expect(Math.hypot(1 - u, 1 - v)).toBeCloseTo(1, 3);
    expect(cornerHandles(1)[0]).toBeCloseTo((4 / 3) * Math.tan(Math.PI / 16), 10);
  });

  it('每个角关于对角线对称：两段贝塞尔互为镜像', () => {
    for (const k of [0.5, 1.75, 2, 4, -1.75]) {
      const p = unitCorner(k);
      for (let i = 0; i < 7; i++) {
        expect(p[i][0]).toBeCloseTo(p[6 - i][1], 12);
        expect(p[i][1]).toBeCloseTo(p[6 - i][0], 12);
      }
    }
  });

  it('K 越大越方；负值内凹（沿弦镜像），∞ 是直角', () => {
    const m = (k: number) => unitCorner(k)[3][0];
    expect(m(2)).toBeLessThan(m(1.75));
    expect(m(1.75)).toBeLessThan(m(1));
    expect(unitCorner(-1.75)[3][0]).toBeCloseTo(1 - m(1.75), 12);
    expect(unitCorner(Infinity)[3]).toEqual([0, 0]);
  });

  it('解析 corner-shape：关键字、函数、1–4 个值；全是 round 时不用接管', () => {
    expect(parseCornerShape('superellipse(1.75)')).toEqual([1.75, 1.75, 1.75, 1.75]);
    expect(parseCornerShape(' superellipse( 2 ) round ')).toEqual([2, 1, 2, 1]);
    expect(parseCornerShape('squircle bevel square scoop')).toEqual([2, 0, Infinity, -1]);
    expect(parseCornerShape('superellipse(infinity)')).toEqual([Infinity, Infinity, Infinity, Infinity]);
    expect(parseCornerShape('round')).toBeNull();
    expect(parseCornerShape('')).toBeNull();
    expect(parseCornerShape('banana')).toBeNull();
  });
});

describe('半径', () => {
  it('相邻两角之和超过边长时，全部半径按同一比例缩小（和 border-radius 一样）', () => {
    expect(clampRadii(200, 30, R(40))).toEqual(R(15));
    expect(clampRadii(200, 100, R(40))).toEqual(R(40));
    const r = clampRadii(100, 100, [[80, 80], [40, 40], [0, 0], [0, 0]]);
    expect(r[0][0]).toBeCloseTo(100 * 80 / 120, 10);
    expect(r[1][0]).toBeCloseTo(100 * 40 / 120, 10);
  });

  it('每个角可以有自己的半径，0 是直角；椭圆半径按两个方向分别缩放', () => {
    const d = shapePath({ x: 0, y: 0, w: 200, h: 100 }, [[40, 40], [10, 10], [0, 0], [24, 24]], [1.75, 1.75, 1.75, 1.75]);
    expect(d.startsWith('M190 0')).toBe(true);    // 右上角从 (w − 10, 0) 开始
    expect(d).toContain('L200 100');             // 右下角是直角
    expect(d).toContain('L24 100');              // 左下角从 (24, h) 开始
    expect(d.endsWith('40 0Z')).toBe(true);      // 左上角收在 (40, 0)
    const e = shapePath({ x: 0, y: 0, w: 200, h: 100 }, [[60, 24], [60, 24], [60, 24], [60, 24]], [1.75, 1.75, 1.75, 1.75]);
    expect(e.startsWith('M140 0')).toBe(true);
    expect(e).toContain('L200 76');
  });

  it('逆时针子路径（挖洞用）经过同样的点、方向相反', () => {
    const b = { x: 0, y: 0, w: 100, h: 60 };
    const cw = shapePath(b, R(20), [2, 2, 2, 2]);
    const ccw = shapePath(b, R(20), [2, 2, 2, 2], true);
    const pts = (s: string) => (s.match(/-?[\d.]+ -?[\d.]+/g) || []).sort();
    expect(pts(ccw)).toEqual(pts(cw));
    expect(ccw).not.toEqual(cw);
  });
});

describe('计算样式的解析', () => {
  it('box-shadow：WebKit 和 Chromium 的写法都能读（颜色在前、inset 在后）', () => {
    expect(parseBoxShadow('rgba(27, 28, 34, 0.07) 0px 0px 0px 1px inset, color(srgb 1 0.88 0.91) 0px 1.5px 0px 0px inset')).toEqual([
      { inset: true, dx: 0, dy: 0, spread: 1, color: 'rgba(27, 28, 34, 0.07)' },
      { inset: true, dx: 0, dy: 1.5, spread: 0, color: 'color(srgb 1 0.88 0.91)' },
    ]);
    expect(parseBoxShadow('rgb(236, 236, 239) 0px 0px 0px 4px')).toEqual([{ inset: false, dx: 0, dy: 0, spread: 4, color: 'rgb(236, 236, 239)' }]);
    expect(parseBoxShadow('none')).toEqual([]);
  });

  it('preserves a blurred outer shadow and reserves its Gaussian tail', () => {
    const shadows = parseBoxShadow('rgba(0, 0, 0, .12) 0px 6px 18px 0px');
    expect(shadows).toEqual([{inset:false,dx:0,dy:6,blur:18,spread:0,color:'rgba(0, 0, 0, .12)'}]);
    expect(outerExtent({shadows,outline:null})).toBe(33);
  });

  it('颜色的不透明度', () => {
    expect(colorAlpha('transparent')).toBe(0);
    expect(colorAlpha('rgba(0, 0, 0, 0)')).toBe(0);
    expect(colorAlpha('rgba(27, 28, 34, 0.07)')).toBeCloseTo(0.07);
    expect(colorAlpha('color(srgb 1 0 0 / 0.5)')).toBe(0.5);
    expect(colorAlpha('rgb(255, 107, 142)')).toBe(1);
  });
});

describe('裁剪和补丁', () => {
  it('clip：大矩形 + 四角的洞 + 超椭圆；有可见 outline 时再并上外环、挖掉中间的缝', () => {
    const plain = cornerClipPath(decor(), 1024);
    expect(plain.match(/M/g)!.length).toBe(1 + 4 + 1);
    const ring = cornerClipPath(decor({ outline: { offset: 2, width: 2, color: 'rgb(255, 107, 142)' } }), 0);
    expect(ring.match(/M/g)!.length).toBe(1 + 4 + 1 + 2);
    // 透明的 outline（没聚焦的 .ok-focusable）不算：不然原生直角背景会从缝里露出来
    const hidden = cornerClipPath(decor({ outline: { offset: 5, width: 2, color: 'rgba(0, 0, 0, 0)' } }), 0);
    expect(hidden.match(/M/g)!.length).toBe(1 + 4 + 1);
  });

  it('只有底色、没有描边和 outline 时不需要补丁', () => {
    expect(cornerPaint(decor())).toBeNull();
  });

  it('补丁是九宫格：同样的装饰、不同的尺寸用同一张图，盒子太小才按真实尺寸画', () => {
    const shadows = parseBoxShadow('rgba(27, 28, 34, 0.07) 0px 0px 0px 1px inset, rgba(255, 255, 255, 0.9) 0px 1.5px 0px 0px inset');
    const a = cornerPaint(decor({ shadows }))!;
    const b = cornerPaint(decor({ shadows, w: 640, h: 400 }))!;
    expect(a.svg).toBe(b.svg);
    expect(a.slice).toEqual(b.slice);
    expect(a.outset).toBe(1);
    const small = cornerPaint(decor({ shadows, w: 60, h: 40, radii: clampRadii(60, 40, R(34.8)) }))!;
    // 60 宽还放得下左右两个角块（拉伸），40 高放不下上下两个（按真实高度画，切片正好铺满）
    expect(small.svg).toContain("height='42'");
    expect(small.slice[0] + small.slice[2]).toBeCloseTo(42, 6);
    expect(small.svg).not.toContain("width='62'");
  });

  it('repaints stacked outer rings in one corner clip without per-layer mask seams', () => {
    const p = cornerPaint(decor({
      backdrop: 'rgb(236, 236, 239)',
      shadows: parseBoxShadow('rgb(236, 236, 239) 0px 0px 0px 2.5px, rgb(46, 123, 255) 0px 0px 0px 4.5px'),
    }))!;
    // Both rings share the outside-of-fill clip. Repeated masks previously
    // exposed the native square rings as extra antialiased lines at corners.
    expect(p.svg).toContain("<g clip-path='url(#h)'><g clip-path='url(#s)'>");
    expect(p.svg).not.toContain('<mask');
    const paths = p.svg.slice(p.svg.indexOf("<g clip-path='url(#h)'>"));
    expect([...paths.matchAll(/<path fill='([^']+)'/g)].map(match => match[1])).toEqual([
      'rgb(236, 236, 239)', 'rgb(46, 123, 255)', 'rgb(236, 236, 239)',
    ]);
  });

  it('clips negative-spread shadow patches outside the fill', () => {
    const p = cornerPaint(decor({shadows: parseBoxShadow('red 6px 0px 0px -2px')}))!;
    const clip = /<clipPath id='s'><path clip-rule='evenodd' d='([^']+)'/.exec(p.svg);
    expect(clip).not.toBeNull();
    // An explicit rectangle with the original contour cut out constrains
    // shifted/shrunken shadows too; XOR of shadow and fill would paint inside.
    expect(clip![1].match(/M/g)).toHaveLength(2);
    expect(p.svg).toContain("<g clip-path='url(#s)'>");
  });

  it('renders blurred outer corners with the CSS Gaussian and enough patch margin', () => {
    const shadows = parseBoxShadow('rgba(0, 0, 0, .12) 0px 6px 18px 0px');
    const p = cornerPaint(decor({shadows}))!;
    expect(p.outset).toBe(34);
    expect(p.svg).toContain("<feGaussianBlur stdDeviation='9'/>");
    expect(p.svg).toContain("filter='url(#sb0)'");
    // A compact nine-slice source still needs enough straight edge between
    // corners for the two Gaussian kernels to decay before they meet.
    expect(p.slice[0]).toBeGreaterThan(34.8 + 27 + 6);
    expect(cornerClipPath(decor({shadows}),1024)).not.toEqual(cornerClipPath(decor(),1024));
  });

  it('outline 把补丁往外扩到外缘', () => {
    const p = cornerPaint(decor({ outline: { offset: 2, width: 2, color: 'rgb(255, 107, 142)' } }))!;
    expect(p.outset).toBe(5);
    expect(p.svg).toContain("fill='rgb(255, 107, 142)'");
  });
});
