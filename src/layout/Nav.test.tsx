import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { Icon } from '../core';
import { Nav, NavGroup, NavItem } from './Nav';

describe('Nav', () => {
  it('是带名字的导航地标，当前项带 aria-current="page"', () => {
    render(
      <Nav aria-label="主导航">
        <NavItem href="#home" current icon={<Icon name="search" />}>概览</NavItem>
        <NavItem href="#team" badge={3}>成员</NavItem>
      </Nav>,
    );
    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(nav).toHaveClass('ok-nav');
    const current = within(nav).getByRole('link', { name: '概览' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('ok-nav__item', 'ok-focusable');
    expect(within(nav).getByRole('link', { name: /成员/ })).not.toHaveAttribute('aria-current');
    expect(nav.querySelector('.ok-nav__badge')).toHaveTextContent('3');
    // 指示块已经就位
    expect(nav).toHaveAttribute('data-ready');
    expect(nav.querySelector('.ok-nav__pill')).toHaveAttribute('aria-hidden', 'true');
  });

  it('没有 href 时是按钮，可以点击；禁用时不响应', async () => {
    const onClick = vi.fn();
    const onDisabled = vi.fn();
    render(
      <Nav aria-label="主导航">
        <NavItem onClick={onClick}>设置</NavItem>
        <NavItem onClick={onDisabled} disabled>账单</NavItem>
        <NavItem href="#x" disabled>链接</NavItem>
      </Nav>,
    );
    const user = userEvent.setup();
    const btn = screen.getByRole('button', { name: '设置' });
    expect(btn).toHaveAttribute('type', 'button');
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    const disabled = screen.getByRole('button', { name: '账单' });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await user.click(disabled);
    expect(onDisabled).not.toHaveBeenCalled();
    expect(screen.getByText('链接').closest('a')).not.toHaveAttribute('href');
  });

  it('NavGroup 用标题给一组导航项命名', () => {
    render(
      <Nav aria-label="主导航">
        <NavGroup label="工作区">
          <NavItem href="#a">项目</NavItem>
          <NavItem href="#b" sub>归档</NavItem>
        </NavGroup>
      </Nav>,
    );
    const group = screen.getByRole('group', { name: '工作区' });
    expect(within(group).getAllByRole('link')).toHaveLength(2);
    expect(within(group).getByRole('link', { name: '归档' })).toHaveClass('ok-nav__item--sub');
  });

  it('折叠时只显示图标，名称由 aria-label / title 兜底', () => {
    render(
      <Nav aria-label="主导航" collapsed>
        <NavItem href="#home" icon={<Icon name="search" />}>概览</NavItem>
        <NavItem href="#team" icon={<Icon name="bell" />} label="通知中心"><b>通知</b></NavItem>
      </Nav>,
    );
    expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed');
    const a = screen.getByRole('link', { name: '概览' });
    expect(a).toHaveAttribute('aria-label', '概览');
    expect(a).toHaveAttribute('title', '概览');
    const b = screen.getByRole('link', { name: '通知中心' });
    expect(b).toHaveAttribute('title', '通知中心');
  });

  it('当前项变化后指示块跟着走', () => {
    const { rerender } = render(
      <Nav aria-label="主导航"><NavItem href="#a">甲</NavItem><NavItem href="#b">乙</NavItem></Nav>,
    );
    const nav = screen.getByRole('navigation');
    expect(nav).not.toHaveAttribute('data-ready');
    rerender(<Nav aria-label="主导航"><NavItem href="#a">甲</NavItem><NavItem href="#b" current>乙</NavItem></Nav>);
    expect(screen.getByRole('link', { name: '乙' })).toHaveAttribute('aria-current', 'page');
  });

  it('as 是多态的：路由库的 Link 和它自己的属性（to）可以直接传，原生属性照常', () => {
    const Link = forwardRef<HTMLAnchorElement, { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>>(
      function Link({ to, ...rest }, ref) { return <a ref={ref} href={`#${to}`} {...rest} />; },
    );
    let node: HTMLElement | null = null;
    render(
      <Nav aria-label="主导航">
        <NavItem as={Link} to="/settings" current data-testid="s" ref={(n) => { node = n; }}>设置</NavItem>
        {/* @ts-expect-error Link 必须有 to */}
        <NavItem as={Link}>坏的</NavItem>
        <NavItem href="#plain" target="_blank" rel="noreferrer">普通链接</NavItem>
        <NavItem onClick={() => {}}>按钮</NavItem>
      </Nav>,
    );
    const link = screen.getByRole('link', { name: '设置' });
    expect(link).toHaveAttribute('href', '#/settings');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass('ok-nav__item');
    expect(node).toBe(link);
    expect(screen.getByRole('link', { name: '普通链接' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('button', { name: '按钮' })).toHaveAttribute('type', 'button');
  });
});
