import { computePosition } from './usePosition';

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
const viewport = { width: 1000, height: 800 };

describe('computePosition', () => {
  it('默认放在锚点下方，按 start / center / end 对齐', () => {
    const anchor = rect(100, 100, 80, 40);
    const floating = { width: 200, height: 120 };
    expect(computePosition({ anchor, floating, viewport, placement: 'bottom-start', offset: 8 })).toMatchObject({ x: 100, y: 148, side: 'bottom', align: 'start' });
    expect(computePosition({ anchor, floating, viewport, placement: 'bottom', offset: 8 })).toMatchObject({ x: 40, y: 148, align: 'center' });
    expect(computePosition({ anchor, floating, viewport, placement: 'bottom-end', offset: 8 })).toMatchObject({ x: 8, y: 148, align: 'end' });
    expect(computePosition({ anchor, floating, viewport, placement: 'right-start', offset: 4 })).toMatchObject({ x: 184, y: 100, side: 'right' });
  });

  it('下方放不下而上方更宽裕时翻到上方', () => {
    const r = computePosition({ anchor: rect(100, 700, 80, 40), floating: { width: 200, height: 300 }, viewport, placement: 'bottom-start', offset: 8 });
    expect(r.side).toBe('top');
    expect(r.y).toBe(700 - 8 - 300);
  });

  it('关掉 flip 就不翻，并把可用高度限制在剩余空间内', () => {
    const r = computePosition({ anchor: rect(100, 400, 80, 40), floating: { width: 200, height: 600 }, viewport, placement: 'bottom-start', offset: 8, flip: false });
    expect(r.side).toBe('bottom');
    expect(r.availableHeight).toBe(800 - 440 - 8 - 8);
  });

  it('超出视口右缘时平移回来', () => {
    const r = computePosition({ anchor: rect(900, 100, 80, 40), floating: { width: 300, height: 100 }, viewport, placement: 'bottom-start' });
    expect(r.x).toBe(1000 - 8 - 300);
  });

  it('窄屏：浮层比视口还宽时，可用宽度收在视口内，位置贴着留白', () => {
    const narrow = { width: 360, height: 640 };
    const r = computePosition({ anchor: rect(200, 100, 120, 40), floating: { width: 500, height: 100 }, viewport: narrow, placement: 'bottom-start' });
    expect(r.availableWidth).toBe(344);
    expect(r.x).toBe(8);
  });

  it('左右两侧：右边放不下就翻到左边', () => {
    const r = computePosition({ anchor: rect(850, 100, 100, 40), floating: { width: 200, height: 100 }, viewport, placement: 'right-start', offset: 4 });
    expect(r.side).toBe('left');
    expect(r.x).toBe(850 - 4 - 200);
  });
});
