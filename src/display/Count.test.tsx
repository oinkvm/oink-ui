import { render, screen } from '@testing-library/react';
import { Count } from './Count';
import { Roll } from './Roll';

describe('Count', () => {
  it('显示数字，超过 max 显示 “99+”，0 默认不显示', () => {
    const { rerender, container } = render(<Count value={3} />);
    expect(container.querySelector('.ok-count')).toHaveTextContent('3');
    rerender(<Count value={120} />);
    expect(container.querySelector('.ok-count')).toHaveTextContent('99+');
    rerender(<Count value={0} />);
    expect(container.querySelector('.ok-count')).toBeNull();
    rerender(<Count value={0} showZero />);
    expect(container.querySelector('.ok-count')).toHaveTextContent('0');
  });
  it('label 给读屏完整说法，数字本身隐藏', () => {
    render(<Count value={3} label="3 条未读通知" />);
    expect(screen.getByText('3 条未读通知')).toHaveClass('ok-sr');
    expect(screen.getByText('3').closest('.ok-roll')).toHaveAttribute('aria-hidden', 'true');
  });
  it('数字变化时触发滚动和 bump 动画', () => {
    const spy = vi.spyOn(Element.prototype, 'animate');
    const { rerender, container } = render(<Count value={3} />);
    spy.mockClear();
    rerender(<Count value={4} />);
    expect(container.querySelector('.ok-count')).toHaveTextContent('4');
    // 旧值滚出、新值滚入、徽标 bump
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});

describe('Roll', () => {
  it('值变化后只留下新值（旧值的临时节点在动画结束后移除）', async () => {
    const { rerender, container } = render(<Roll value={1} />);
    rerender(<Roll value={2} />);
    await Promise.resolve();
    await Promise.resolve();
    const box = container.querySelector('.ok-roll')!;
    expect(box.children).toHaveLength(1);
    expect(box).toHaveTextContent('2');
  });
});
