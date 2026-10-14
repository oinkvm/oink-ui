import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Breadcrumb } from './Breadcrumb';

const items = [
  { label: '首页', href: '/' },
  { label: '项目', href: '/projects' },
  { label: '品牌', href: '/projects/brand' },
  { label: '标志系统' },
];

describe('Breadcrumb', () => {
  it('nav + ol，最后一项是当前页', () => {
    render(<Breadcrumb items={items} />);
    const nav = screen.getByRole('navigation', { name: '面包屑' });
    expect(within(nav).getByRole('list').tagName).toBe('OL');
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['首页', '项目', '品牌']);
    const current = within(nav).getByText('标志系统');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.tagName).toBe('SPAN');
  });

  it('窄屏折叠中间项：有一个可展开的“…”按钮，展开后焦点落到第一个中间项', async () => {
    const user = userEvent.setup();
    render(<Breadcrumb items={items} />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('data-collapse', 'narrow');
    expect(screen.getByRole('link', { name: '项目' }).closest('li')).toHaveAttribute('data-middle');
    const more = screen.getByRole('button', { name: '显示中间的 2 级路径' });
    more.focus();
    await user.keyboard('{Enter}');
    expect(nav).not.toHaveAttribute('data-collapse');
    expect(screen.queryByRole('button', { name: /显示中间/ })).toBeNull();
    expect(screen.getByRole('link', { name: '项目' })).toHaveFocus();
  });

  it('maxItems：超过数量时任何宽度都折叠', () => {
    render(<Breadcrumb items={items} maxItems={3} />);
    expect(screen.getByRole('navigation')).toHaveAttribute('data-collapse', 'always');
  });
});
