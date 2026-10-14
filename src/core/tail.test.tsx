import { render } from '@testing-library/react';
import { TailGlyph, TailProvider, useTail } from './tail';

describe('TailGlyph / TailProvider', () => {
  it('默认渲染品牌尾巴：48×48、带 pathLength=1、对读屏隐藏', () => {
    const { container } = render(<TailGlyph className="ok-tail" />);
    const svg = container.querySelector('svg.ok-tail')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 48 48');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.querySelector('path')).toHaveAttribute('pathLength', '1');
  });

  it('TailProvider 传 svg 节点：替换图案并合并类名', () => {
    const { container } = render(
      <TailProvider tail={<svg viewBox="0 0 48 48" className="star"><path pathLength={1} d="M24 6l5 12h13l-10 8 4 13-12-8-12 8 4-13-10-8h13z" /></svg>}>
        <TailGlyph className="ok-tail ok-x" />
      </TailProvider>,
    );
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveClass('ok-tail', 'ok-x', 'star');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.querySelector('path')!.getAttribute('d')).toMatch(/^M24 6/);
  });

  it('传函数：拿到 className 自己渲染；嵌套时内层优先，undefined 沿用外层', () => {
    let seen: unknown;
    function Peek() { seen = useTail(); return null; }
    const { container } = render(
      <TailProvider tail={({ className }) => <i className={className} data-testid="outer" />}>
        <TailProvider tail={({ className }) => <b className={className} data-testid="inner" />}>
          <TailGlyph className="ok-tail" />
        </TailProvider>
        <TailProvider>
          <TailGlyph className="ok-tail" />
          <Peek />
        </TailProvider>
      </TailProvider>,
    );
    expect(container.querySelector('b.ok-tail')).not.toBeNull();
    expect(container.querySelector('i.ok-tail')).not.toBeNull();
    expect(typeof seen).toBe('function');
  });

  it('传文字时包一层 span', () => {
    const { container } = render(<TailProvider tail="★"><TailGlyph className="ok-tail" /></TailProvider>);
    const span = container.querySelector('span.ok-tail')!;
    expect(span).toHaveTextContent('★');
    expect(span).toHaveAttribute('aria-hidden', 'true');
  });
});
