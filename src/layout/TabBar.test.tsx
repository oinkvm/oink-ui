import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useState } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { TabBar, TabBarItem } from './TabBar';

describe('TabBar', () => {
  it('是带名字的导航地标，非受控切换并标出当前项', async () => {
    const onChange = vi.fn();
    render(
      <TabBar aria-label="主导航" defaultValue="home" onChange={onChange} action={<button type="button" className="ok-btn">新建</button>}>
        <TabBar.Item value="home">今天</TabBar.Item>
        <TabBar.Item value="settings">设置</TabBar.Item>
      </TabBar>,
    );
    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(nav).toHaveClass('ok-tabbar');
    expect(nav).toHaveAttribute('data-position', 'fixed');
    const home = within(nav).getByRole('button', { name: '今天' });
    const settings = within(nav).getByRole('button', { name: '设置' });
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(settings).not.toHaveAttribute('aria-current');
    await userEvent.setup().click(settings);
    expect(onChange).toHaveBeenCalledWith('settings');
    expect(settings).toHaveAttribute('aria-current', 'page');
    expect(home).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('button', { name: '新建' })).toBeInTheDocument();
  });

  it('受控：不更新 value 就不会变', async () => {
    const onChange = vi.fn();
    render(
      <TabBar aria-label="主导航" value="home" onChange={onChange} position="absolute">
        <TabBarItem value="home">今天</TabBarItem>
        <TabBarItem value="settings">设置</TabBarItem>
      </TabBar>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: '设置' }));
    expect(onChange).toHaveBeenCalledWith('settings');
    expect(screen.getByRole('button', { name: '今天' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation')).toHaveAttribute('data-position', 'absolute');
  });

  it('方向键、Home、End 在项之间移动焦点，Enter 选中', async () => {
    function Demo() {
      const [value, setValue] = useState('a');
      return (
        <TabBar aria-label="主导航" value={value} onChange={setValue}>
          <TabBar.Item value="a">甲</TabBar.Item>
          <TabBar.Item value="b">乙</TabBar.Item>
          <TabBar.Item value="c" disabled>丙</TabBar.Item>
          <TabBar.Item value="d" href="#d" label="丁" icon={<svg />} />
        </TabBar>
      );
    }
    render(<Demo />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button', { name: '甲' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: '乙' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: '乙' })).toHaveAttribute('aria-current', 'page');
    await user.keyboard('{End}');
    const link = screen.getByRole('link', { name: '丁' });
    expect(link).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: '甲' })).toHaveFocus();
    expect(screen.getByRole('button', { name: '丙' })).toBeDisabled();
  });

  it('不到 4 项横排；4 项及以上自动改成图标在上、文字在下；layout 可以强制', () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => <TabBar.Item key={i} value={String(i)} icon={<svg />} badge={i === 0 ? 3 : undefined}>第{i}项</TabBar.Item>);
    const { rerender } = render(<TabBar aria-label="主导航" defaultValue="0">{items(3)}</TabBar>);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('data-layout', 'inline');
    // 包在 Fragment 里也数得对
    rerender(<TabBar aria-label="主导航" defaultValue="0"><>{items(4)}</></TabBar>);
    expect(nav).toHaveAttribute('data-layout', 'stacked');
    rerender(<TabBar aria-label="主导航" defaultValue="0" layout="inline">{items(5)}</TabBar>);
    expect(nav).toHaveAttribute('data-layout', 'inline');
    rerender(<TabBar aria-label="主导航" defaultValue="0" layout="stacked">{items(2)}</TabBar>);
    expect(nav).toHaveAttribute('data-layout', 'stacked');
    // 只有图标的 4 项不需要上下排
    rerender(<TabBar aria-label="主导航" defaultValue="0">{[0, 1, 2, 3].map((i) => <TabBar.Item key={i} value={String(i)} icon={<svg />} label={`第${i}项`} />)}</TabBar>);
    expect(nav).toHaveAttribute('data-layout', 'inline');
    rerender(<TabBar aria-label="主导航" defaultValue="0" layout="stacked">{items(2)}</TabBar>);
    // 徽标仍然在项里面，名字里读得到
    expect(screen.getByRole('button', { name: /第0项/ })).toHaveTextContent('3');
  });

  it('insetStart / insetEnd 让出一侧的空间', () => {
    render(
      <TabBar aria-label="主导航" insetEnd={72} insetStart="calc(56px + 8px)" style={{ zIndex: 3 }}>
        <TabBar.Item value="a">甲</TabBar.Item>
      </TabBar>,
    );
    const nav = screen.getByRole('navigation');
    expect(nav.style.getPropertyValue('--ok-tabbar-inset-end')).toBe('72px');
    expect(nav.style.getPropertyValue('--ok-tabbar-inset-start')).toBe('calc(56px + 8px)');
    expect(nav.style.zIndex).toBe('3');
  });

  it('as 是多态的：路由库的 Link 和它自己的属性（to）可以直接传', async () => {
    const Link = forwardRef<HTMLAnchorElement, { to: string; replace?: boolean } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>>(
      function Link({ to, replace: _replace, ...rest }, ref) { return <a ref={ref} href={`#${to}`} {...rest} />; },
    );
    const onChange = vi.fn();
    render(
      <TabBar aria-label="主导航" defaultValue="home" onChange={onChange}>
        <TabBar.Item as={Link} to="/home" value="home">首页</TabBar.Item>
        <TabBarItem as={Link} to="/inbox" replace value="inbox">收件箱</TabBarItem>
        {/* @ts-expect-error Link 必须有 to */}
        <TabBar.Item as={Link} value="broken">坏的</TabBar.Item>
      </TabBar>,
    );
    const inbox = screen.getByRole('link', { name: '收件箱' });
    expect(inbox).toHaveAttribute('href', '#/inbox');
    expect(inbox).toHaveClass('ok-tabbar__item');
    await userEvent.setup().click(inbox);
    expect(onChange).toHaveBeenCalledWith('inbox');
    expect(inbox).toHaveAttribute('aria-current', 'page');
  });
});
