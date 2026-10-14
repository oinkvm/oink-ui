import { render, screen, within } from '@testing-library/react';
import { Steps } from './Steps';

const items = [{ title: '填写信息' }, { title: '确认订单', description: '核对地址' }, { title: '完成' }];

describe('Steps', () => {
  it('有序列表，当前步骤 aria-current="step"，状态有读屏文字', () => {
    render(<Steps items={items} current={1} />);
    const list = screen.getByRole('list', { name: '步骤' });
    expect(list.tagName).toBe('OL');
    expect(list).toHaveAttribute('data-orientation', 'horizontal');
    const steps = within(list).getAllByRole('listitem');
    expect(steps.map((s) => s.getAttribute('data-state'))).toEqual(['complete', 'current', 'upcoming']);
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(steps[0]).not.toHaveAttribute('aria-current');
    expect(steps[0]).toHaveTextContent('第 1 步，已完成：填写信息');
    expect(steps[1]).toHaveTextContent('核对地址');
    expect(steps[2]).toHaveTextContent('第 3 步，未开始：完成');
  });
  it('纵向和出错状态', () => {
    render(<Steps items={items} current={0} orientation="vertical" status="error" />);
    expect(screen.getByRole('list')).toHaveAttribute('data-orientation', 'vertical');
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('data-error');
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('出错');
  });
});
