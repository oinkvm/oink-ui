import { fireEvent, render, screen } from '@testing-library/react';
import { Field } from './Field';
import { Fieldset } from './Fieldset';
import { Label } from './Label';
import { Input } from './Input';
import { Checkbox, CheckboxGroup } from './Checkbox';
import { Slider } from './Slider';

describe('Field', () => {
  it('把标签、提示接到本库的控件上', () => {
    render(<Field label="邮箱" hint="我们不会公开它" required><Input /></Field>);
    const input = screen.getByRole('textbox', { name: /邮箱/ });
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('我们不会公开它');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('有错误时：aria-invalid、错误文字进描述、错误区是 aria-live', () => {
    const { container, rerender } = render(<Field label="邮箱" hint="提示"><Input /></Field>);
    const msg = container.querySelector('.ok-field__msg')!;
    expect(msg).toHaveAttribute('aria-live', 'polite');
    expect(msg).toHaveTextContent('');
    rerender(<Field label="邮箱" hint="提示" error="这看起来不像一个邮箱地址。"><Input /></Field>);
    const input = screen.getByRole('textbox', { name: '邮箱' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('提示 这看起来不像一个邮箱地址。');
    expect(container.firstChild).toHaveAttribute('data-invalid');
    expect(msg).toHaveTextContent('这看起来不像一个邮箱地址。');
  });

  it('原生控件会被克隆接线；也支持函数子节点', () => {
    render(
      <>
        <Field label="城市" error="必选"><select><option>上海</option></select></Field>
        <Field label="简介" disabled>{(control) => <textarea {...control} />}</Field>
      </>,
    );
    const select = screen.getByRole('combobox', { name: '城市' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('必选');
    expect(screen.getByRole('textbox', { name: '简介' })).toBeDisabled();
  });

  it('复合控件走 aria-labelledby；组内各项不会拿到重复的 id', () => {
    const { container } = render(
      <>
        <Field label="音量"><Slider /></Field>
        <Field label="通知方式" id="notify">
          <CheckboxGroup><Checkbox value="a">声音</Checkbox><Checkbox value="b">震动</Checkbox></CheckboxGroup>
        </Field>
      </>,
    );
    expect(screen.getByRole('slider', { name: '音量' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '通知方式' })).toBeInTheDocument();
    expect(container.querySelectorAll('#notify')).toHaveLength(1);
  });
});

describe('Fieldset', () => {
  it('用图例命名，说明进描述，disabled 会禁用里面的控件', () => {
    render(<Fieldset legend="收货地址" hint="仅用于配送" disabled><Input aria-label="街道" /></Fieldset>);
    const group = screen.getByRole('group', { name: '收货地址' });
    expect(group).toHaveAccessibleDescription('仅用于配送');
    expect(screen.getByRole('textbox', { name: '街道' })).toBeDisabled();
  });
});

describe('Label', () => {
  it('用 htmlFor 关联控件；必填标记不进可读名称', () => {
    render(<><Label htmlFor="n" required>昵称</Label><input id="n" /></>);
    expect(screen.getByRole('textbox', { name: '昵称' })).toBeInTheDocument();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('触发框是按钮的控件（带 data-label-focus）：点标签只聚焦、不触发点击；普通按钮不受影响', async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Field label="城市">{(control) => <button type="button" {...control} data-label-focus="" onClick={onClick}>请选择</button>}</Field>,
    );
    fireEvent.click(screen.getByText('城市'));
    expect(screen.getByRole('button', { name: '城市' })).toHaveFocus();
    expect(onClick).not.toHaveBeenCalled();

    rerender(<Field label="城市">{(control) => <button type="button" {...control} onClick={onClick}>请选择</button>}</Field>);
    fireEvent.click(screen.getByText('城市'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('函数子节点把 control 手动展开到本库控件上：和自动接线叠在一起时 aria-describedby 不重复', () => {
    render(<Field id="f" label="邮箱" hint="提示" error="必填">{(control) => <Input {...control} />}</Field>);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'f-hint f-error');
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'f');
  });
});
