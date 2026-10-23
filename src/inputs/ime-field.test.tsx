import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Dialog } from '../overlays/Dialog';
import { Field } from './Field';
import { Input } from './Input';

function inputEvent(input: HTMLElement, value: string, inputType: string) {
  const data = inputType === 'deleteCompositionText' ? null : value;
  fireEvent(input, new InputEvent('beforeinput', { bubbles: true, cancelable: inputType === 'insertFromComposition', inputType, data, isComposing: true }));
  fireEvent.input(input, { target: { value }, inputType, data, isComposing: true });
}

function setup() {
  const submit = vi.fn(), change = vi.fn();
  function LayoutName() {
    const [name, setName] = useState('');
    const [typed, setTyped] = useState(false);
    const problem = !name.trim() ? '请输入布局名称' : name === '已有' ? '已有同名布局' : null;
    return <Dialog open as="form" onSubmit={submit} actions={<button type="submit" disabled={!!problem}>新建</button>}>
      <Field label="布局名称" error={typed ? problem : null}>
        <Input value={name} onChange={v => { change(v); setName(v); setTyped(true); }}/>
      </Field>
    </Dialog>;
  }
  render(<LayoutName/>);
  const shake = vi.spyOn(Element.prototype, 'animate');
  shake.mockClear();
  return { input: screen.getByRole('textbox'), shake, submit, change };
}

afterEach(() => vi.restoreAllMocks());

it('WebKit 提交组字时先删再插；临时空值不触发 Field 抖动', () => {
  const { input, shake, submit, change } = setup();
  fireEvent.compositionStart(input);
  fireEvent.compositionUpdate(input, { data: 'q w f q f' });
  inputEvent(input, 'q w f q f', 'insertCompositionText');
  // WKWebView 的原生 NSTextInputClient 提交顺序：不是提交表单，也不是额外的回车。
  inputEvent(input, '', 'deleteCompositionText');
  expect(shake).not.toHaveBeenCalled();
  inputEvent(input, 'qwfqf', 'insertFromComposition');
  fireEvent.compositionEnd(input, { data: 'qwfqf' });
  expect(input).toHaveValue('qwfqf');
  expect(input).not.toHaveAttribute('aria-invalid');
  expect(shake).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
  expect(change.mock.calls.map(([v]) => v)).toEqual(['q w f q f', '', 'qwfqf']);
  expect(fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: false })).toBe(false);
  fireEvent.keyUp(input, { key: 'Enter', keyCode: 13 });
  expect(fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 })).toBe(true);
  // JSDOM 不会执行隐式提交；显式派发表单事件验证回调仍可用。
  fireEvent.submit(input.closest('form')!);
  expect(submit).toHaveBeenCalledTimes(1);
});

it('组字完成后确有错误才抖动', () => {
  const { input, shake } = setup();
  fireEvent.compositionStart(input);
  inputEvent(input, '已有', 'insertCompositionText');
  expect(shake).not.toHaveBeenCalled();
  inputEvent(input, '', 'deleteCompositionText');
  inputEvent(input, '已有', 'insertFromComposition');
  fireEvent.compositionEnd(input, { data: '已有' });
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(shake).toHaveBeenCalledTimes(1);
});

it('普通清空仍然立即校验并抖动', () => {
  const { input, shake } = setup();
  fireEvent.input(input, { target: { value: 'Office' }, inputType: 'insertText' });
  fireEvent.input(input, { target: { value: '' }, inputType: 'deleteContentBackward' });
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(shake).toHaveBeenCalledTimes(1);
});

it('Field 合并组字 capture 回调', () => {
  const start = vi.fn(), end = vi.fn();
  render(<Field label="名称" onCompositionStartCapture={start} onCompositionEndCapture={end}><Input/></Field>);
  fireEvent.compositionStart(screen.getByRole('textbox'));
  fireEvent.compositionEnd(screen.getByRole('textbox'), { data: '名称' });
  expect(start).toHaveBeenCalledTimes(1);
  expect(end).toHaveBeenCalledTimes(1);
});
