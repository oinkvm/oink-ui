import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox, CheckboxGroup } from './Checkbox';

describe('Checkbox', () => {
  it('是真的复选框，文字就是它的名称；非受控点击切换', async () => {
    const onChange = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox ref={ref} onChange={onChange}>声音</Checkbox>);
    const box = screen.getByRole('checkbox', { name: '声音' });
    expect(ref.current).toBe(box);
    expect(box).toHaveAttribute('type', 'checkbox');
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('键盘空格切换；禁用时不响应', async () => {
    render(<><Checkbox>甲</Checkbox><Checkbox disabled>乙</Checkbox></>);
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(screen.getByRole('checkbox', { name: '甲' })).toBeChecked();
    const off = screen.getByRole('checkbox', { name: '乙' });
    expect(off).toBeDisabled();
    await userEvent.click(off);
    expect(off).not.toBeChecked();
  });

  it('受控：不改 props 就不变', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange}>甲</Checkbox>);
    const box = screen.getByRole('checkbox');
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(box).not.toBeChecked();
  });

  it('indeterminate 写到 DOM 属性上，读屏读作“部分选中”', () => {
    const { rerender } = render(<Checkbox indeterminate>全选</Checkbox>);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box).toBePartiallyChecked();
    rerender(<Checkbox>全选</Checkbox>);
    expect(box.indeterminate).toBe(false);
  });
});

describe('CheckboxGroup', () => {
  it('是带名称的 group；非受控时回调选中的 value 列表', async () => {
    const onChange = vi.fn();
    render(
      <CheckboxGroup aria-label="通知" defaultValue={['a']} onChange={onChange} name="notify">
        <Checkbox value="a">声音</Checkbox><Checkbox value="b">震动</Checkbox>
      </CheckboxGroup>,
    );
    expect(screen.getByRole('group', { name: '通知' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '声音' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '震动' })).toHaveAttribute('name', 'notify');
    await userEvent.click(screen.getByRole('checkbox', { name: '震动' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    await userEvent.click(screen.getByRole('checkbox', { name: '声音' }));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
  });

  it('受控；整组禁用', async () => {
    function Demo() {
      const [v, setV] = useState<string[]>([]);
      return <CheckboxGroup aria-label="受控" value={v} onChange={setV}><Checkbox value="a">甲</Checkbox></CheckboxGroup>;
    }
    render(<><Demo /><CheckboxGroup aria-label="禁用" disabled><Checkbox value="x">乙</Checkbox></CheckboxGroup></>);
    await userEvent.click(screen.getByRole('checkbox', { name: '甲' }));
    expect(screen.getByRole('checkbox', { name: '甲' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '乙' })).toBeDisabled();
  });

  it('带说明文字时标 data-described（样式据此把勾选框对齐第一行），说明仍在同一个 label 里', () => {
    const { rerender } = render(<Checkbox description="每周一上午发送">周报</Checkbox>);
    const box = screen.getByRole('checkbox', { name: /周报/ });
    expect(box.closest('label')).toHaveAttribute('data-described');
    expect(box.closest('label')).toHaveTextContent('每周一上午发送');
    rerender(<Checkbox>周报</Checkbox>);
    expect(screen.getByRole('checkbox').closest('label')).not.toHaveAttribute('data-described');
  });
});
