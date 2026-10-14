import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { FocusScope, captureFocusTrail, restoreFocusTo } from './FocusScope';

function Scope() {
  const ref = useRef<HTMLDivElement>(null);
  return <FocusScope scopeRef={ref}><div ref={ref} tabIndex={-1} data-testid="scope"><button type="button">里面</button></div></FocusScope>;
}

describe('FocusScope', () => {
  it('挂载时聚焦进来，卸载时还给之前的元素', () => {
    const { rerender } = render(<><button type="button">触发</button></>);
    const trigger = screen.getByText('触发');
    trigger.focus();
    rerender(<><button type="button">触发</button><Scope /></>);
    expect(screen.getByTestId('scope')).toHaveFocus();
    rerender(<><button type="button">触发</button></>);
    expect(trigger).toHaveFocus();
  });

  it('原焦点目标被移除：回退到最近的仍存在的可聚焦祖先', () => {
    const { rerender } = render(<ul><li tabIndex={-1} data-testid="row"><span><button type="button">删除</button></span></li></ul>);
    screen.getByText('删除').focus();
    rerender(<ul><li tabIndex={-1} data-testid="row"><span><button type="button">删除</button></span></li><Scope /></ul>);
    // 确认之后按钮没了，行还在
    rerender(<ul><li tabIndex={-1} data-testid="row"><span /></li></ul>);
    expect(screen.getByTestId('row')).toHaveFocus();
  });

  it('没有可聚焦的祖先：落到 <main>（补上 tabindex="-1"）；连 main 都没有就留在 body', () => {
    const { rerender, unmount } = render(<main data-testid="main"><div><button type="button">删除</button></div></main>);
    screen.getByText('删除').focus();
    rerender(<main data-testid="main"><div><button type="button">删除</button></div><Scope /></main>);
    rerender(<main data-testid="main" />);
    const main = screen.getByTestId('main');
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute('tabindex', '-1');
    unmount();

    const host = document.createElement('div');
    host.innerHTML = '<button>临时</button>';
    document.body.appendChild(host);
    const btn = host.querySelector('button')!;
    btn.focus();
    const trail = captureFocusTrail(btn);
    host.remove();
    expect(restoreFocusTo(trail)).toBe(document.body);
    expect(document.activeElement).toBe(document.body);
  });

  it('进来之前焦点不在任何元素上：什么都不做', () => {
    render(<main data-testid="main" />);
    expect(restoreFocusTo(captureFocusTrail(document.body))).toBeNull();
    expect(screen.getByTestId('main')).not.toHaveAttribute('tabindex');
  });

  it('原目标还在但被模态盖着（inert）：不动焦点', () => {
    render(<><div {...{ inert: '' }}><button type="button">背景里的按钮</button></div><button type="button">上层</button></>);
    const trail = captureFocusTrail(screen.getByText('背景里的按钮'));
    screen.getByText('上层').focus();
    expect(restoreFocusTo(trail)).toBeNull();
    expect(screen.getByText('上层')).toHaveFocus();
  });
});
