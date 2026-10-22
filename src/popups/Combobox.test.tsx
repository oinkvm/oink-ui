import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { Field } from '../inputs/Field';
import { Autocomplete, Combobox } from './Combobox';
import type { SelectOption } from './Listbox';

const FRUITS: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry', disabled: true },
];

describe('Combobox', () => {
  it('输入筛选：combobox 语义，aria-activedescendant 指向高亮项，Enter 选中', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Combobox options={FRUITS} onChange={onChange} aria-label="水果" name="fruit" />);
    const input = screen.getByRole('combobox', { name: '水果' });
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.type(input, 'ap');
    const list = await screen.findByRole('listbox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Apple', 'Apricot']);
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Apple' }).id);

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('apricot', expect.objectContaining({ value: 'apricot' }));
    expect(input).toHaveValue('Apricot');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('input[name="fruit"]')).toHaveValue('apricot');
    expect(input).toHaveFocus();
  });

  it('没有匹配项时显示自定义空状态；Esc 关闭；失焦后文字回到选中项', async () => {
    const user = userEvent.setup();
    render(<><Combobox options={FRUITS} defaultValue="banana" emptyText={<span>找不到“水果”</span>} aria-label="水果" /><button>别处</button></>);
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('Banana');
    await user.clear(input);
    await user.type(input, 'zzz');
    expect(await screen.findByText('找不到“水果”')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: '别处' }));
    expect(input).toHaveValue('');
  });

  it('异步：loading 时显示加载状态并标 aria-busy，选项由外部给出', async () => {
    const user = userEvent.setup();
    let completeSearch!: () => void;
    function Demo() {
      const [loading, setLoading] = useState(false);
      const [options, setOptions] = useState<SelectOption[]>([]);
      return (
        <Combobox
          aria-label="城市" filter={false} options={options} loading={loading} loadingText="正在搜索…"
          onInputChange={(text) => {
            setLoading(true);
            completeSearch = () => { setOptions(text ? [{ value: 'sh', label: `${text}-上海` }] : []); setLoading(false); };
          }}
        />
      );
    }
    render(<Demo />);
    const input = screen.getByRole('combobox');
    await user.type(input, 's');
    // 加载态由外部请求决定；先断言，再放行结果，避免 20ms 定时器抢在断言前结束。
    expect(screen.getByText('正在搜索…')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-busy', 'true');
    act(() => { completeSearch(); });
    const option = await screen.findByRole('option', { name: 's-上海' });
    await waitFor(() => expect(screen.queryByText('正在搜索…')).toBeNull());
    // 结果回来后自动高亮第一项，回车直接选中
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', option.id));
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('s-上海');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('异步结果换了一批：高亮回到新的第一项，跳过禁用项', async () => {
    const user = userEvent.setup();
    const first: SelectOption[] = [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }];
    const second: SelectOption[] = [{ value: 'x', label: '停用', disabled: true }, { value: 'c', label: '丙' }, { value: 'd', label: '丁' }];
    const { rerender } = render(<Combobox aria-label="城市" filter={false} options={[]} loading emptyText={null} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'k');
    rerender(<Combobox aria-label="城市" filter={false} options={first} emptyText={null} />);
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: '甲' }).id));
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: '乙' }).id);
    // 选项内容没变、只是换了个数组：不打断键盘导航
    rerender(<Combobox aria-label="城市" filter={false} options={[...first]} emptyText={null} />);
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: '乙' }).id);
    rerender(<Combobox aria-label="城市" filter={false} options={second} emptyText={null} />);
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: '丙' }).id));
  });

  it('ref 指向原生 input（和 Input 一致），rootRef / rootClassName / rootStyle 给外框', () => {
    const ref = createRef<HTMLInputElement>();
    const rootRef = createRef<HTMLDivElement>();
    const autoRef = createRef<HTMLInputElement>();
    render(
      <>
        <Combobox ref={ref} rootRef={rootRef} rootClassName="mine" rootStyle={{ maxWidth: 200 }} className="also" options={FRUITS} aria-label="水果" />
        <Autocomplete ref={autoRef} options={FRUITS} aria-label="建议" />
      </>,
    );
    expect(ref.current).toBe(screen.getByRole('combobox', { name: '水果' }));
    expect(ref.current!.tagName).toBe('INPUT');
    expect(rootRef.current).toBe(ref.current!.parentElement);
    expect(rootRef.current).toHaveClass('ok-input', 'ok-combobox', 'mine', 'also');
    expect(rootRef.current).toHaveStyle({ maxWidth: '200px' });
    expect(autoRef.current).toBe(screen.getByRole('combobox', { name: '建议' }));
  });

  it('放进 Field 直接可用：标签、描述、aria-invalid、required、disabled', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Field label="水果" hint="选一种" error="必填" required><Combobox options={FRUITS} /></Field>);
    const input = screen.getByRole('combobox', { name: /水果/ });
    expect(input).toBe(screen.getByLabelText(/水果/));
    expect(input).toHaveAccessibleDescription('选一种 必填');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input.parentElement).toHaveAttribute('data-invalid');
    await user.click(screen.getByText('水果'));
    expect(input).toHaveFocus();
    expect(await screen.findByRole('listbox', { name: /水果/ })).toBeInTheDocument();

    rerender(<Field label="水果" disabled><Combobox options={FRUITS} /></Field>);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('点击选项选中；禁用项点不动', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Combobox options={FRUITS} onChange={onChange} aria-label="水果" />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.click(await screen.findByRole('option', { name: 'Cherry' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('option', { name: 'Banana' }));
    expect(onChange).toHaveBeenCalledWith('banana', expect.anything());
    expect(input).toHaveValue('Banana');
  });
});

describe('Autocomplete', () => {
  it('可以任意输入，值就是文字；选建议会填进输入框', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<><Autocomplete options={FRUITS} onChange={onChange} aria-label="标签" /><button>别处</button></>);
    const input = screen.getByRole('combobox', { name: '标签' });
    await user.type(input, 'ba');
    expect(onChange).toHaveBeenLastCalledWith('ba', undefined);
    await user.click(await screen.findByRole('option', { name: 'Banana' }));
    expect(input).toHaveValue('Banana');
    expect(onChange).toHaveBeenLastCalledWith('Banana', expect.anything());
    await user.clear(input);
    await user.type(input, 'kiwi');
    await user.click(screen.getByRole('button', { name: '别处' }));
    expect(input).toHaveValue('kiwi');
  });
});

describe('Combobox：禁用项悬停与点选后的退场', () => {
  it('指针移到禁用项：高亮淡出；点选后退场中的列表保持点选前的选中样子', async () => {
    const user = userEvent.setup();
    render(<Combobox options={FRUITS} defaultValue="apple" aria-label="水果" />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    const list = await screen.findByRole('listbox');
    await user.hover(screen.getByRole('option', { name: 'Banana' }));
    expect(list).toHaveAttribute('data-hl');
    await user.hover(screen.getByRole('option', { name: 'Cherry' }));
    expect(list).not.toHaveAttribute('data-hl');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    const apple = screen.getByRole('option', { name: 'Apple' });
    const banana = screen.getByRole('option', { name: 'Banana' });
    await user.click(banana);
    expect(input).toHaveValue('Banana');
    expect(apple).toHaveAttribute('aria-selected', 'true');
    expect(banana).toHaveAttribute('aria-selected', 'false');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull(), { timeout: 1500 });
  });
});
