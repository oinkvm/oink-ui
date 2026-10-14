import { render, screen } from '@testing-library/react';
import { Stat } from './Stat';

describe('Stat', () => {
  it('标签、数值、涨跌（箭头 + 读屏文字）', () => {
    render(<Stat label="本周提交" value="83" delta="12.5%" trend="up" hint="较上周" data-testid="s" />);
    const el = screen.getByTestId('s');
    expect(el).toHaveClass('ok-stat', 'ok-card');
    expect(el).toHaveTextContent('本周提交');
    expect(screen.getByText('83')).toHaveClass('ok-stat__value');
    const delta = el.querySelector('.ok-stat__delta')!;
    expect(delta).toHaveAttribute('data-mood', 'good');
    expect(delta).toHaveTextContent('上升12.5%');
    expect(delta.querySelector('.ok-icon')).not.toBeNull();
    expect(screen.getByText('较上周')).toBeInTheDocument();
  });
  it('positive="down"：下降才是好事', () => {
    const { container, rerender } = render(<Stat label="错误率" value="0.4%" delta="0.1%" trend="down" positive="down" variant="plain" />);
    expect(container.querySelector('.ok-stat')).not.toHaveClass('ok-card');
    expect(container.querySelector('.ok-stat__delta')).toHaveAttribute('data-mood', 'good');
    rerender(<Stat label="错误率" value="0.6%" delta="0.2%" trend="up" positive="down" />);
    expect(container.querySelector('.ok-stat__delta')).toHaveAttribute('data-mood', 'bad');
    expect(container.querySelector('.ok-stat__delta')).toHaveTextContent('上升');
  });

  it('固定的三行结构：标签 / 数值 / 底部信息行，顺序不随内容变', () => {
    const { container, rerender } = render(<Stat label="收入" value="¥12,400" delta="8%" trend="up" hint="较上月同期，含退款" />);
    const kids = () => Array.from(container.querySelector('.ok-stat')!.children).map((n) => n.className);
    expect(kids()).toEqual(['ok-stat__label', 'ok-stat__value', 'ok-stat__foot']);
    const foot = container.querySelector('.ok-stat__foot')!;
    expect(foot.children[0]).toHaveClass('ok-stat__delta');
    expect(foot.children[1]).toHaveClass('ok-stat__hint');
    rerender(<Stat label="收入" value="¥12,400" />);
    expect(kids()).toEqual(['ok-stat__label', 'ok-stat__value']);
  });
});
