import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { AppShell, useAppShell } from './AppShell';
import type { AppShellProps } from './AppShell';
import { Nav, NavItem } from './Nav';

function Probe() {
  const shell = useAppShell();
  return (
    <div>
      <output data-testid="state">{JSON.stringify({ c: shell.sidebarCollapsed, o: shell.sidebarOpen, r: shell.rail, a: shell.asideOpen })}</output>
      <button type="button" onClick={shell.toggleSidebar}>切换</button>
      <button type="button" onClick={shell.openSidebar}>打开</button>
      <button type="button" onClick={shell.toggleAside}>详情</button>
    </div>
  );
}

function Shell(props: AppShellProps) {
  return (
    <AppShell {...props}>
      <AppShell.Header>
        <AppShell.Trigger />
        <AppShell.Trigger target="aside" label="打开详情" />
        <b>Oink</b>
      </AppShell.Header>
      <AppShell.Sidebar>
        <Nav aria-label="主导航">
          <NavItem href="#home" current icon={<svg />}>概览</NavItem>
          <NavItem href="#team" icon={<svg />}>成员</NavItem>
        </Nav>
      </AppShell.Sidebar>
      <AppShell.Main>
        <h1>页面</h1>
        <Probe />
      </AppShell.Main>
      <AppShell.Aside><p>辅助内容</p></AppShell.Aside>
      <AppShell.Footer>页脚</AppShell.Footer>
    </AppShell>
  );
}

const state = () => JSON.parse(screen.getByTestId('state').textContent!);

describe('AppShell', () => {
  it('停靠形态：各区是对的地标，侧栏和辅助栏是卡片', () => {
    render(<Shell collapsed={false} data-testid="shell" />);
    expect(screen.getByTestId('shell')).toHaveClass('ok-shell');
    expect(screen.getByRole('banner')).toHaveClass('ok-shell__header');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('页脚');
    const main = screen.getByRole('main');
    expect(main).toHaveClass('ok-shell__main', 'ok-scroll');
    const sidebar = screen.getByRole('complementary', { name: '侧栏' });
    expect(sidebar).toHaveClass('ok-shell__sidebar', 'ok-shell-card');
    expect(within(sidebar).getByRole('navigation', { name: '主导航' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '辅助栏' })).toHaveClass('ok-shell__aside', 'ok-shell-card');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(state()).toMatchObject({ c: false, o: false, r: false });
  });

  it('跳转链接是第一个可聚焦元素，激活后焦点到 <main>', async () => {
    render(<Shell collapsed={false} />);
    const user = userEvent.setup();
    await user.tab();
    const skip = screen.getByRole('link', { name: '跳到主要内容' });
    expect(skip).toHaveFocus();
    const main = screen.getByRole('main');
    expect(skip).toHaveAttribute('href', `#${main.id}`);
    await user.keyboard('{Enter}');
    expect(main).toHaveFocus();
  });

  it('停靠形态：触发按钮把侧栏收成图标窄条，导航项用 aria-label / title 兜底', async () => {
    const onRailChange = vi.fn();
    render(<Shell collapsed={false} onRailChange={onRailChange} />);
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: '切换导航' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // 辅助栏的按钮在停靠形态下也在：控制那一栏显示 / 隐藏
    expect(screen.getByRole('button', { name: '打开详情' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(trigger);
    expect(onRailChange).toHaveBeenCalledWith(true);
    const sidebar = screen.getByRole('complementary', { name: '侧栏' });
    expect(sidebar).toHaveAttribute('data-rail');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(within(sidebar).getByRole('navigation')).toHaveAttribute('data-collapsed');
    expect(within(sidebar).getByRole('link', { name: '概览' })).toHaveAttribute('title', '概览');
    await user.click(screen.getByRole('button', { name: '切换' }));
    expect(sidebar).not.toHaveAttribute('data-rail');
    expect(state().r).toBe(false);
  });

  it('抽屉形态：侧栏不占位，按钮打开悬浮卡片（模态对话框），Esc 关闭并归还焦点', async () => {
    render(<Shell collapsed />);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByRole('main')).toBeInTheDocument();
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: '切换导航' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(trigger);
    const drawer = await screen.findByRole('dialog', { name: '侧栏' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).toHaveClass('ok-float__card', 'ok-shell-card');
    expect(drawer.parentElement).toHaveAttribute('data-placement', 'left');
    // 抽屉里的导航是完整的，不是图标窄条
    expect(within(drawer).getByRole('navigation', { name: '主导航' })).not.toHaveAttribute('data-collapsed');
    expect(state()).toMatchObject({ c: true, o: true });
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 2000 });
    expect(state().o).toBe(false);
    expect(trigger).toHaveFocus();
  });

  it('抽屉形态：点导航项后自动关上', async () => {
    const onOpen = vi.fn();
    render(<Shell collapsed defaultSidebarOpen onSidebarOpenChange={onOpen} />);
    const drawer = await screen.findByRole('dialog', { name: '侧栏' });
    await userEvent.setup().click(within(drawer).getByRole('link', { name: '成员' }));
    expect(onOpen).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 2000 });
  });

  it('抽屉形态：辅助栏从右侧滑入', async () => {
    render(<Shell collapsed />);
    await userEvent.setup().click(screen.getByRole('button', { name: '打开详情' }));
    const drawer = await screen.findByRole('dialog', { name: '辅助栏' });
    expect(drawer.parentElement).toHaveAttribute('data-placement', 'right');
    expect(within(drawer).getByText('辅助内容')).toBeInTheDocument();
    expect(state().a).toBe(true);
  });

  it('sidebarOpen 受控', async () => {
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>外部打开</button>
          <Shell collapsed sidebarOpen={open} onSidebarOpenChange={setOpen} />
        </>
      );
    }
    render(<Demo />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '外部打开' }));
    expect(await screen.findByRole('dialog', { name: '侧栏' })).toBeInTheDocument();
    expect(state().o).toBe(true);
  });

  it('contained：标记在根上，抽屉渲染在骨架自己里面', async () => {
    render(<div style={{ height: 480 }}><Shell contained collapsed data-testid="shell" /></div>);
    const shell = screen.getByTestId('shell');
    expect(shell).toHaveAttribute('data-contained');
    await act(async () => { screen.getByRole('button', { name: '打开' }).click(); });
    const drawer = await screen.findByRole('dialog', { name: '侧栏' });
    expect(shell.contains(drawer)).toBe(true);
    expect(drawer.parentElement).toHaveClass('ok-float--contained');
  });

  it('collapsed="auto" 时把断点写在根上，供 CSS 在脚本接管前判断', () => {
    render(<Shell collapseBelow="lg" asideCollapseBelow="xl" gap={2} data-testid="shell" />);
    const shell = screen.getByTestId('shell');
    expect(shell).toHaveAttribute('data-collapsed', 'auto');
    expect(shell).toHaveAttribute('data-collapse-below', 'lg');
    expect(shell).toHaveAttribute('data-aside-collapse-below', 'xl');
    expect(shell.style.getPropertyValue('--ok-shell-gap')).toBe('var(--ok-s-2)');
  });

  it('部件和 useAppShell 必须在 AppShell 里面', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AppShell.Main />)).toThrow(/AppShell/);
    expect(() => render(<Probe />)).toThrow(/AppShell/);
    spy.mockRestore();
  });

  it('停靠形态：辅助栏默认显示，触发按钮 / asideOpen 控制它显示或隐藏', async () => {
    const onAsideOpenChange = vi.fn();
    render(<Shell collapsed={false} onAsideOpenChange={onAsideOpenChange} />);
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: '打开详情' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).not.toHaveAttribute('aria-haspopup');
    expect(screen.getByRole('complementary', { name: '辅助栏' })).toBeInTheDocument();
    expect(state().a).toBe(true);
    await user.click(trigger);
    expect(onAsideOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('complementary', { name: '辅助栏' })).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // 不会变成抽屉
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: '详情' }));
    expect(screen.getByRole('complementary', { name: '辅助栏' })).toBeInTheDocument();
  });

  it('停靠形态：defaultAsideOpen={false} 一开始就不显示；受控时完全听外面的', async () => {
    const first = render(<Shell collapsed={false} defaultAsideOpen={false} />);
    expect(screen.queryByRole('complementary', { name: '辅助栏' })).toBeNull();
    first.unmount();

    const onAsideOpenChange = vi.fn();
    const { rerender } = render(<Shell collapsed={false} asideOpen={false} onAsideOpenChange={onAsideOpenChange} />);
    expect(screen.queryByRole('complementary', { name: '辅助栏' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: '打开详情' }));
    expect(onAsideOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('complementary', { name: '辅助栏' })).toBeNull();
    rerender(<Shell collapsed={false} asideOpen onAsideOpenChange={onAsideOpenChange} />);
    expect(screen.getByRole('complementary', { name: '辅助栏' })).toBeInTheDocument();
  });

  it('形态切换：变成抽屉时辅助栏收起（不自己弹出模态抽屉），回到停靠时恢复显示', async () => {
    const { rerender } = render(<Shell collapsed={false} />);
    expect(state().a).toBe(true);
    rerender(<Shell collapsed />);
    await waitFor(() => expect(state().a).toBe(false));
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<Shell collapsed={false} />);
    await waitFor(() => expect(state().a).toBe(true));
    expect(screen.getByRole('complementary', { name: '辅助栏' })).toBeInTheDocument();
  });

  it('drawerOnly 的辅助栏按钮在停靠形态下不渲染', () => {
    render(
      <AppShell collapsed={false}>
        <AppShell.Header><AppShell.Trigger target="aside" drawerOnly label="详情开关" /></AppShell.Header>
        <AppShell.Main />
        <AppShell.Aside>内容</AppShell.Aside>
      </AppShell>,
    );
    expect(screen.queryByRole('button', { name: '详情开关' })).toBeNull();
  });

  it('抽屉形态下其余原生属性也透传到卡片上（role 除外）', async () => {
    const onClick = vi.fn();
    render(
      <AppShell collapsed defaultSidebarOpen defaultAsideOpen>
        <AppShell.Sidebar id="side" data-testid="side" data-tour="nav" aria-describedby="hint" role="navigation" onClick={onClick}><a href="#x">链接</a></AppShell.Sidebar>
        <AppShell.Main />
        <AppShell.Aside id="aside" data-testid="aside" lang="en">内容</AppShell.Aside>
      </AppShell>,
    );
    const side = await screen.findByTestId('side');
    expect(side).toHaveClass('ok-float__card');
    expect(side).toHaveAttribute('id', 'side');
    expect(side).toHaveAttribute('data-tour', 'nav');
    expect(side).toHaveAttribute('aria-describedby', 'hint');
    expect(side).toHaveAttribute('role', 'dialog');
    expect(side).toHaveAttribute('aria-label', '侧栏');
    const aside = await screen.findByTestId('aside');
    expect(aside).toHaveAttribute('id', 'aside');
    expect(aside).toHaveAttribute('lang', 'en');
    await userEvent.setup().click(within(side).getByText('链接'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
