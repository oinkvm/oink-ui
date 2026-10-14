import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tag } from './Tag';

describe('Tag', () => {
  it('渲染文字和 tone', () => {
    render(<Tag tone="info" size="sm">设计</Tag>);
    const tag = screen.getByText('设计').closest('.ok-tag')!;
    expect(tag).toHaveAttribute('data-tone', 'info');
    expect(tag).toHaveClass('ok-tag--sm');
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('可移除：按钮带名字，点击和键盘都能触发', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Tag onRemove={onRemove}>设计</Tag>);
    const btn = screen.getByRole('button', { name: '移除 设计' });
    await user.click(btn);
    btn.focus();
    await user.keyboard('{Enter}');
    expect(onRemove).toHaveBeenCalledTimes(2);
  });
});
