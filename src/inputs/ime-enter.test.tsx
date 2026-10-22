import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Input } from './Input';
import { SearchInput } from './SearchInput';
import { Textarea } from './Textarea';
import { NumberInput } from './NumberInput';
import { PinInput } from './PinInput';
import { Form } from './Form';
import { Combobox } from '../popups/Combobox';
import { Dialog } from '../overlays/Dialog';
import { CommandPalette } from '../overlays/CommandPalette';

const orders = ['Chromium：确认键先于 compositionend', 'WebKit：compositionend 后的 229 确认键'] as const;
function commit(input: Element, order: typeof orders[number]) {
  fireEvent.compositionStart(input);
  const webkit = order.startsWith('WebKit');
  if (webkit) fireEvent.compositionEnd(input, { data: 'qwfqf' });
  const accepted = fireEvent.keyDown(input, { key: 'Enter', keyCode: webkit ? 229 : 13, isComposing: !webkit });
  if (!webkit) fireEvent.compositionEnd(input, { data: 'qwfqf' });
  return accepted;
}

describe.each(orders)('%s', order => {
  const controls: Array<[string, () => ReactElement]> = [
    ['Input', () => <Input aria-label="内容"/>],
    ['SearchInput', () => <SearchInput aria-label="内容"/>],
    ['Textarea', () => <Textarea aria-label="内容"/>],
    ['NumberInput', () => <NumberInput aria-label="内容"/>],
    ['Combobox', () => <Combobox aria-label="内容" options={[{ value: 'one', label: '一' }]} defaultOpen/>],
    ['PinInput', () => <PinInput aria-label="内容"/>],
  ];
  it.each(controls)('%s 阻止默认提交与祖先回车处理器；下一次普通回车仍可用', (_name, control) => {
    const enter = vi.fn(), submit = vi.fn();
    const { container } = render(<form onKeyDown={enter} onSubmit={event => { event.preventDefault(); submit(); }}>{control()}<button type="submit">提交</button></form>);
    const input = container.querySelector('input:not([type=hidden]),textarea')!;
    // JSDOM 不模拟隐式提交；返回 false 证明浏览器默认动作已被取消。
    expect(commit(input, order)).toBe(false);
    expect(enter).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 })).toBe(true);
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('Input 在调用者的 capture、keydown 与 SearchInput 的 onSearch 之前拦截', () => {
    const capture = vi.fn(), down = vi.fn(), search = vi.fn();
    render(<SearchInput aria-label="搜索" onKeyDownCapture={capture} onKeyDown={down} onSearch={search}/>);
    const input = screen.getByRole('searchbox');
    expect(commit(input, order)).toBe(false);
    expect(capture).not.toHaveBeenCalled();
    expect(down).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('Form 也保护原生输入；Dialog as=form 由 Input 的通用边界保护', () => {
    const down = vi.fn();
    const raw = render(<Form onKeyDown={down}><input aria-label="原生"/></Form>);
    expect(commit(screen.getByLabelText('原生'), order)).toBe(false);
    expect(down).not.toHaveBeenCalled();
    raw.unmount();
    render(<Dialog open as="form" onSubmit={down}><Input aria-label="布局名称" onKeyDown={down}/></Dialog>);
    expect(commit(screen.getByLabelText('布局名称'), order)).toBe(false);
    expect(down).not.toHaveBeenCalled();
  });

  it('命令面板的原生搜索框不会把确认组字的回车当作执行命令', () => {
    const select = vi.fn();
    render(<CommandPalette open items={[{ id: 'new', label: '新建' }]} onSelect={select}/>);
    const input = screen.getByRole('combobox');
    expect(commit(input, order)).toBe(false);
    expect(select).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
    expect(select).toHaveBeenCalledTimes(1);
  });
});
