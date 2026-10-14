import { act, render, screen } from '@testing-library/react';
import { OinkProvider, useOink } from './theme';

function Toggle() {
  const { resolvedTheme, setTheme } = useOink();
  return <button type="button" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark', { x: 10, y: 10 })}>{resolvedTheme}</button>;
}

describe('setTheme 带 origin 的揭开过渡', () => {
  const doc = document as unknown as { startViewTransition?: unknown };
  afterEach(() => { delete doc.startViewTransition; document.documentElement.classList.remove('ok-theming'); });

  it('从 origin 揭开：圆心写进过渡规则；过渡中再次切换时跳过当前过渡、直接换，不叠第二层', async () => {
    const transitions: Array<{ skipTransition: ReturnType<typeof vi.fn>; finish: () => void }> = [];
    doc.startViewTransition = vi.fn((cb: () => void) => {
      act(() => { cb(); });
      let finish = () => {};
      const finished = new Promise<void>((r) => { finish = r; });
      const t = { ready: Promise.resolve(), finished, skipTransition: vi.fn(() => finish()), finish };
      transitions.push(t);
      return t;
    });
    render(<OinkProvider defaultTheme="light"><Toggle /></OinkProvider>);
    const root = document.documentElement;

    act(() => { screen.getByRole('button').click(); });
    await act(async () => { await Promise.resolve(); });
    expect(transitions).toHaveLength(1);
    expect(root).toHaveClass('ok-theming');
    expect(root.dataset.theme).toBe('dark');
    expect(screen.getByRole('button')).toHaveTextContent('dark');
    // 圆心就是传进来的 origin（不经过设备像素比换算）
    const css = Array.from(document.querySelectorAll('style')).map((n) => n.textContent).join('') +
      ((document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [])
        .flatMap((sh) => Array.from(sh.cssRules).map((r) => r.cssText)).join('');
    expect(css).toContain('view-transition-new(root)');

    // 过渡进行中再点一次：当前过渡被跳过，新主题直接生效，不再开第二个过渡
    act(() => { screen.getByRole('button').click(); });
    expect(transitions[0].skipTransition).toHaveBeenCalledTimes(1);
    expect(transitions).toHaveLength(1);
    expect(root).not.toHaveClass('ok-theming');
    expect(screen.getByRole('button')).toHaveTextContent('light');
    expect(root.dataset.theme).toBe('light');
  });
});

describe('storageKey 与服务端渲染', () => {
  afterEach(() => { localStorage.clear(); delete document.documentElement.dataset.accent; });

  function Accent() { return <span data-testid="accent">{useOink().accent}</span>; }

  it('记下的选择挂载后才读：注水的第一帧与服务端 HTML 一致，读完立即生效，且不会先把默认值写回存储', async () => {
    localStorage.setItem('k', JSON.stringify({ theme: 'dark', accent: 'violet', motion: 'auto' }));
    const { renderToString } = await import('react-dom/server');
    const { hydrateRoot } = await import('react-dom/client');
    const tree = <OinkProvider storageKey="k"><Accent /></OinkProvider>;
    const html = renderToString(tree);
    expect(html).toContain('pink');

    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    const errors: unknown[] = [];
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await act(async () => { hydrateRoot(host, tree, { onRecoverableError: (e) => errors.push(e) }); });
    expect(errors).toEqual([]);
    expect(host.textContent).toBe('violet');
    expect(document.documentElement.dataset.accent).toBe('violet');
    // 只写过读到的值，从没写过默认的 pink
    expect(setItem.mock.calls.every(([, v]) => !String(v).includes('pink'))).toBe(true);
    setItem.mockRestore();
    host.remove();
  });
});

describe('自定义强调色', () => {
  afterEach(() => {
    localStorage.clear();
    const root = document.documentElement;
    delete root.dataset.accent;
    root.removeAttribute('style');
  });

  function Picker() {
    const { accent, setAccent } = useOink();
    return (
      <>
        <span data-testid="accent">{accent}</span>
        <button type="button" onClick={() => setAccent('#0B3D2E')}>dark</button>
        <button type="button" onClick={() => setAccent('#FFF3B0')}>light</button>
        <button type="button" onClick={() => setAccent('blue')}>blue</button>
      </>
    );
  }

  it('任意颜色：<html> 上是 data-accent="custom"，变量写在行内；文字黑白按亮度自动选；换回预设时清掉', () => {
    render(<OinkProvider storageKey="k"><Picker /></OinkProvider>);
    const root = document.documentElement;
    act(() => { screen.getByText('dark').click(); });
    expect(screen.getByTestId('accent').textContent).toBe('#0b3d2e');
    expect(root.dataset.accent).toBe('custom');
    expect(root.style.getPropertyValue('--ok-accent')).toBe('#0b3d2e');
    expect(root.style.getPropertyValue('--ok-on-accent')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--ok-accent-fill')).toBe('var(--ok-accent)');
    // 存储里带上算好的变量，供首帧前的内联脚本使用
    expect(JSON.parse(localStorage.getItem('k')!).vars['--ok-accent']).toBe('#0b3d2e');

    act(() => { screen.getByText('light').click(); });
    expect(root.style.getPropertyValue('--ok-on-accent')).toBe('#1b1c22');
    expect(root.style.getPropertyValue('--ok-accent-fill')).toBe('');

    act(() => { screen.getByText('blue').click(); });
    expect(root.dataset.accent).toBe('blue');
    expect(root.style.getPropertyValue('--ok-accent')).toBe('');
    expect(JSON.parse(localStorage.getItem('k')!).vars).toBeUndefined();
  });

  it('存储里是已经移除的预设（green）或不合法的值：退回默认强调色', () => {
    localStorage.setItem('k', JSON.stringify({ theme: 'light', accent: 'green', motion: 'auto' }));
    render(<OinkProvider storageKey="k"><Picker /></OinkProvider>);
    expect(screen.getByTestId('accent').textContent).toBe('pink');
    expect(document.documentElement.dataset.accent).toBe('pink');
  });
});
