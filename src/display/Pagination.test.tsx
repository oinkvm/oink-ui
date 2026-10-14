import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination, paginationRange } from './Pagination';

describe('Pagination', () => {
  it('页码序列：头尾固定，中间用省略号', () => {
    expect(paginationRange(5, 1)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationRange(10, 1)).toEqual([1, 2, 3, 4, 5, 0, 10]);
    expect(paginationRange(10, 5)).toEqual([1, 0, 4, 5, 6, 0, 10]);
    expect(paginationRange(10, 10)).toEqual([1, 0, 6, 7, 8, 9, 10]);
  });

  it('nav 语义，当前页 aria-current，首页时“上一页”禁用', () => {
    render(<Pagination count={10} />);
    expect(screen.getByRole('navigation', { name: '分页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '第 1 页' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '第 2 页' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一页' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('第 1 页，共 10 页');
  });

  it('非受控：点击和键盘都能翻页', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination count={10} defaultPage={3} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '下一页' }));
    expect(onChange).toHaveBeenLastCalledWith(4);
    expect(screen.getByRole('button', { name: '第 4 页' })).toHaveAttribute('aria-current', 'page');
    screen.getByRole('button', { name: '第 10 页' }).focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(10);
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
    expect(screen.getByText('10 / 10')).toHaveClass('ok-pagination__status');
  });

  it('受控', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination count={5} page={2} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '第 4 页' }));
    expect(onChange).toHaveBeenCalledWith(4);
    expect(screen.getByRole('button', { name: '第 2 页' })).toHaveAttribute('aria-current', 'page');
  });
});
