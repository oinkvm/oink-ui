import { Fragment } from 'react';
import { render, screen } from '@testing-library/react';
import { Hide, Show } from './Show';
import { layoutVars, responsiveVars, spaceVar } from './responsive';

describe('responsiveVars', () => {
  it('单个值只写基础变量', () => {
    expect(responsiveVars('gap', 4, spaceVar)).toEqual({ '--ok-l-gap': 'var(--ok-s-4)' });
    expect(responsiveVars('gap', 0, spaceVar)).toEqual({ '--ok-l-gap': '0px' });
    expect(responsiveVars('gap', undefined, spaceVar)).toEqual({});
  });

  it('对象写法按断点落成带后缀的变量，并向上补齐', () => {
    expect(responsiveVars('cols', { base: 1, md: 3 }, (v: number) => v)).toEqual({
      '--ok-l-cols': '1', '--ok-l-cols-sm': '1', '--ok-l-cols-md': '3', '--ok-l-cols-lg': '3', '--ok-l-cols-xl': '3',
    });
  });

  it('没给 base 时，小于首个断点不写变量（交给组件默认值）', () => {
    expect(responsiveVars('gap', { lg: 8 }, spaceVar)).toEqual({ '--ok-l-gap-lg': 'var(--ok-s-8)', '--ok-l-gap-xl': 'var(--ok-s-8)' });
  });

  it('layoutVars 合并间距、对齐，并让传入的 style 优先', () => {
    const style = layoutVars({ gap: 2, align: 'center', justify: 'between', paddingX: { base: 4, md: 6 } }, { color: 'red' }) as Record<string, string>;
    expect(style['--ok-l-gap']).toBe('var(--ok-s-2)');
    expect(style['--ok-l-align']).toBe('center');
    expect(style['--ok-l-justify']).toBe('space-between');
    expect(style['--ok-l-px-md']).toBe('var(--ok-s-6)');
    expect(style.color).toBe('red');
  });
});

describe('Show / Hide', () => {
  it('Show 用 data 属性表达断点，内容始终在 DOM 里', () => {
    render(<Show above="md" below="xl" data-testid="s">内容</Show>);
    const el = screen.getByTestId('s');
    expect(el).toHaveClass('ok-show');
    expect(el).toHaveAttribute('data-ok-hide-below', 'md');
    expect(el).toHaveAttribute('data-ok-hide-above', 'xl');
    expect(el).toHaveTextContent('内容');
  });

  it('Hide 的方向和 Show 相反，支持 as 和 ref 透传', () => {
    let node: HTMLElement | null = null;
    render(<Hide as="span" below="md" ref={(n) => { node = n; }} className="x">内容</Hide>);
    expect(node).not.toBeNull();
    expect(node!.tagName).toBe('SPAN');
    expect(node).toHaveAttribute('data-ok-hide-below', 'md');
    expect(node).not.toHaveAttribute('data-ok-hide-above');
    expect(node).toHaveClass('ok-show', 'x');
    expect(node).toHaveAttribute('data-box');
  });

  it('不传 as 时是不产生盒子的包裹层；传了 as 就是真实的盒子，显隐属性照旧', () => {
    render(
      <>
        <Show above="md" data-testid="wrap">内容</Show>
        <Show as="section" above="md" className="card" style={{ padding: 8 }} data-testid="box">内容</Show>
        <Hide as={Fragment} below="sm" data-testid="frag">内容</Hide>
      </>,
    );
    const wrap = screen.getByTestId('wrap');
    expect(wrap.tagName).toBe('DIV');
    expect(wrap).not.toHaveAttribute('data-box');
    const box = screen.getByTestId('box');
    expect(box.tagName).toBe('SECTION');
    expect(box).toHaveAttribute('data-box');
    expect(box).toHaveClass('card');
    expect(box.style.padding).toBe('8px');
    expect(box).toHaveAttribute('data-ok-hide-below', 'md');
    // Fragment 带不了属性：退回默认的包裹层
    const frag = screen.getByTestId('frag');
    expect(frag.tagName).toBe('DIV');
    expect(frag).not.toHaveAttribute('data-box');
    expect(frag).toHaveAttribute('data-ok-hide-below', 'sm');
  });
});
