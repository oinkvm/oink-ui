import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, ButtonGroup, ToggleButton } from './Button';
import { useBusy } from './useBusy';
import type { UseBusyOptions } from './useBusy';
import { Icon, TailProvider } from '../core';

describe('Button', () => {
  it('默认是 type="button" 的灰底按钮，类名与原型一致', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>保存</Button>);
    const btn = screen.getByRole('button', { name: '保存' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn.className).toBe('ok-btn ok-focusable');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('变体、尺寸、图标按钮、撑满对应原型的修饰类', () => {
    render(<Button variant="primary" size="lg" block iconOnly aria-label="上传"><Icon name="upload" /></Button>);
    const btn = screen.getByRole('button', { name: '上传' });
    expect(btn).toHaveClass('ok-btn', 'ok-btn--primary', 'ok-btn--lg', 'ok-btn--icon', 'ok-btn--block');
    for (const v of ['accent', 'ghost', 'outline', 'danger'] as const) {
      const { container, unmount } = render(<Button variant={v}>x</Button>);
      expect(container.firstChild).toHaveClass(`ok-btn--${v}`);
      unmount();
    }
  });

  it('loading 时标 aria-busy 和 data-state，并且不响应点击', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>保存</Button>);
    const btn = screen.getByRole('button', { name: '保存' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveAttribute('data-state', 'loading');
    expect(btn.querySelector('.ok-btn__status .ok-tail')).not.toBeNull();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled 用原生属性；aria-disabled 仍可聚焦但拦下点击', async () => {
    const onClick = vi.fn();
    render(<><Button disabled onClick={onClick}>甲</Button><Button aria-disabled="true" onClick={onClick}>乙</Button></>);
    expect(screen.getByRole('button', { name: '甲' })).toBeDisabled();
    const soft = screen.getByRole('button', { name: '乙' });
    expect(soft).not.toBeDisabled();
    await userEvent.click(soft);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('传 href 渲染成链接；禁用的链接没有 href', () => {
    const { rerender } = render(<Button href="/docs">文档</Button>);
    const link = screen.getByRole('link', { name: '文档' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/docs');
    expect(link).not.toHaveAttribute('type');
    rerender(<Button href="/docs" disabled>文档</Button>);
    const off = screen.getByRole('link', { name: '文档' });
    expect(off).not.toHaveAttribute('href');
    expect(off).toHaveAttribute('aria-disabled', 'true');
  });

  it('键盘 Enter / 空格触发', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>保存</Button>);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe('ButtonGroup', () => {
  it('是带名称的 group，并把尺寸和变体传给里面的按钮', () => {
    render(<ButtonGroup aria-label="对齐" size="sm" variant="outline" attached><Button>左</Button><Button variant="primary">右</Button></ButtonGroup>);
    expect(screen.getByRole('group', { name: '对齐' })).toHaveClass('ok-btn-group', 'ok-btn-group--attached');
    expect(screen.getByRole('button', { name: '左' })).toHaveClass('ok-btn--sm', 'ok-btn--outline');
    expect(screen.getByRole('button', { name: '右' })).toHaveClass('ok-btn--sm', 'ok-btn--primary');
  });
});

describe('ToggleButton', () => {
  it('非受控：点击切换 aria-pressed', async () => {
    const onChange = vi.fn();
    render(<ToggleButton onChange={onChange}>加粗</ToggleButton>);
    const btn = screen.getByRole('button', { name: '加粗' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('受控：不改 props 就不变', async () => {
    const onChange = vi.fn();
    render(<ToggleButton pressed={false} onChange={onChange}>加粗</ToggleButton>);
    const btn = screen.getByRole('button', { name: '加粗' });
    await userEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Button 加载尾巴', () => {
  it('默认是品牌尾巴；TailProvider 可以换成别的图案', () => {
    const { container, rerender } = render(<Button loading>保存</Button>);
    expect(container.querySelector('.ok-btn__status svg.ok-tail path')).toHaveAttribute('pathLength', '1');
    rerender(
      <TailProvider tail={<svg viewBox="0 0 48 48" data-testid="heart"><path d="M24 40C10 30 6 22 6 16a9 9 0 0118-2 9 9 0 0118 2c0 6-4 14-18 24z" /></svg>}>
        <Button loading>保存</Button>
      </TailProvider>,
    );
    expect(screen.getByTestId('heart')).toHaveClass('ok-tail');
    expect(container.querySelector('.ok-btn__status')).toContainElement(screen.getByTestId('heart'));
  });
});

describe('Button 失败态与播报', () => {
  it('error：data-state="error"，叉号在状态层里；不拦点击，可以直接重试', async () => {
    const onClick = vi.fn();
    const { container } = render(<Button error onClick={onClick}>保存</Button>);
    const btn = screen.getByRole('button', { name: '保存' });
    expect(btn).toHaveAttribute('data-state', 'error');
    expect(btn).not.toHaveAttribute('aria-busy');
    expect(container.querySelector('.ok-btn__status .ok-btn__cross path')).toHaveAttribute('pathLength', '1');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('success 期间同样不响应点击', async () => {
    const onClick = vi.fn();
    render(<Button success onClick={onClick}>保存</Button>);
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('状态切换用 aria-live 播报；文案可覆盖；播报区不算进按钮名称', async () => {
    const labels = { loading: '正在保存', success: '已保存', error: '保存失败' };
    const { rerender } = render(<Button loading={false} statusLabels={labels}>保存</Button>);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('');
    rerender(<Button loading statusLabels={labels}>保存</Button>);
    await waitFor(() => expect(status).toHaveTextContent('正在保存'));
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
    rerender(<Button success statusLabels={labels}>保存</Button>);
    await waitFor(() => expect(status).toHaveTextContent('已保存'));
    rerender(<Button error statusLabels={labels}>保存</Button>);
    await waitFor(() => expect(status).toHaveTextContent('保存失败'));
    // 回到常态时保留上一句，免得读屏来不及读
    rerender(<Button error={false} statusLabels={labels}>保存</Button>);
    expect(status).toHaveTextContent('保存失败');
  });

  it('默认文案；没用到过程状态的按钮不渲染播报区', async () => {
    const { rerender } = render(<Button>普通</Button>);
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<Button loading>普通</Button>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('正在处理'));
  });
});

describe('useBusy', () => {
  function Demo({ task, onError, ...opts }: UseBusyOptions & { task: () => Promise<string>; onError?: (e: unknown) => void }) {
    const busy = useBusy(opts);
    return (
      <>
        <Button {...busy.buttonProps} onClick={() => { busy.run(task).catch((e) => onError?.(e)); }}>保存</Button>
        <span data-testid="state">{busy.state}</span>
      </>
    );
  }
  afterEach(() => { vi.useRealTimers(); });

  it('成功：加载 → 成功（停留）→ 复原', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolve!: (v: string) => void;
    const task = vi.fn(() => new Promise<string>((r) => { resolve = r; }));
    render(<Demo task={task} successHold={1000} labels={{ loading: '正在保存', success: '已保存' }} />);
    const btn = screen.getByRole('button', { name: '保存' });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('data-state', 'loading');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    // 加载期间再点不会重复触发任务
    await userEvent.click(btn);
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => { resolve('ok'); });
    expect(btn).toHaveAttribute('data-state', 'success');
    expect(screen.getByRole('status')).toHaveTextContent('已保存');
    await act(async () => { vi.advanceTimersByTime(999); });
    expect(btn).toHaveAttribute('data-state', 'success');
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(btn).not.toHaveAttribute('data-state');
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
  });

  it('失败：加载 → 失败（叉号 + 抖动）→ 复原，并把错误交还调用方', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onError = vi.fn();
    const boom = new Error('offline');
    render(<Demo task={() => Promise.reject(boom)} onError={onError} errorHold={800} labels={{ error: '保存失败' }} />);
    const btn = screen.getByRole('button', { name: '保存' });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('data-state', 'error'));
    expect(onError).toHaveBeenCalledWith(boom);
    expect(screen.getByRole('status')).toHaveTextContent('保存失败');
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(btn).not.toHaveAttribute('data-state');
  });

  it('卸载后任务才结束：不报错、不改状态', async () => {
    let resolve!: (v: string) => void;
    const { unmount } = render(<Demo task={() => new Promise<string>((r) => { resolve = r; })} />);
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    unmount();
    await act(async () => { resolve('ok'); });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
