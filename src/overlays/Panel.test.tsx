import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Panel } from './Panel';
import { FloatingBody, FloatingHeader } from './FloatingParts';

function Demo(props: Partial<React.ComponentProps<typeof Panel>>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)}>检查器</button>
      <button type="button">页面上的别的按钮</button>
      <Panel open={open} onOpenChange={setOpen} {...props}>
        <FloatingHeader title="检查器" />
        <FloatingBody><input aria-label="宽度" /></FloatingBody>
      </Panel>
    </>
  );
}

describe('Panel', () => {
  it('非模态：complementary 地标，没有遮罩，不锁滚动，不抢焦点', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByText('检查器', { selector: 'button' });
    await user.click(trigger);
    const panel = await screen.findByRole('complementary', { name: '检查器' });
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(panel).toHaveClass('ok-panel-float');
    expect(panel.parentElement).toHaveAttribute('data-placement', 'right');
    expect(panel.parentElement?.style.getPropertyValue('--ok-float-size')).toBe('320px');
    expect(document.querySelector('.ok-float__scrim')).toBeNull();
    expect(document.documentElement.style.overflow).not.toBe('hidden');
    expect(document.activeElement).toBe(trigger);
  });

  it('焦点不在面板里时 Esc 不关；焦点在里面时 Esc 关闭，并把焦点还给进来之前的元素', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByText('检查器', { selector: 'button' });
    await user.click(trigger);
    await screen.findByRole('complementary');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('complementary')).toBeInTheDocument();

    const other = screen.getByText('页面上的别的按钮');
    act(() => { other.focus(); });
    act(() => { screen.getByLabelText('宽度').focus(); });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull(), { timeout: 1500 });
    expect(document.activeElement).toBe(other);
  });

  it('可以 contained 在某个容器里；role 可以换成非模态 dialog', async () => {
    function Contained() {
      const [host, setHost] = useState<HTMLDivElement | null>(null);
      return (
        <div ref={setHost} data-testid="host" style={{ position: 'relative' }}>
          <Panel defaultOpen container={host} contained role="dialog" placement="left" size="sm" aria-label="筛选" />
        </div>
      );
    }
    render(<Contained />);
    const panel = await screen.findByRole('dialog', { name: '筛选' });
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(screen.getByTestId('host').contains(panel)).toBe(true);
    expect(panel.parentElement).toHaveClass('ok-float--contained');
    expect(panel.parentElement?.style.getPropertyValue('--ok-float-size')).toBe('280px');
  });

  it('autoFocus：打开时焦点进面板，关闭后回到触发按钮；size="auto" 按内容、align 控制交叉轴位置', async () => {
    const user = userEvent.setup();
    render(<Demo autoFocus placement="bottom" stretch={false} align="end" size="auto" />);
    const trigger = screen.getByText('检查器', { selector: 'button' });
    await user.click(trigger);
    const panel = await screen.findByRole('complementary', { name: '检查器' });
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    expect(panel.parentElement).toHaveAttribute('data-align', 'end');
    expect(panel.parentElement).toHaveAttribute('data-size', 'auto');
    expect(panel.parentElement?.style.getPropertyValue('--ok-float-size')).toBe('');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull(), { timeout: 1500 });
    expect(trigger).toHaveFocus();
  });

  it('上下贴边时省略 size 仍是 md（280 高）', async () => {
    render(<Panel defaultOpen placement="bottom" aria-label="日志" />);
    const panel = await screen.findByRole('complementary', { name: '日志' });
    expect(panel.parentElement?.style.getPropertyValue('--ok-float-size')).toBe('280px');
  });
});
