import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Field } from '../inputs/Field';
import { MultiSelect, Select } from './Select';
import type { SelectOptions } from './Listbox';

const LANGS: SelectOptions = [
  { value: 'zh', label: '简体中文', textValue: 'Chinese' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語', textValue: 'Japanese', disabled: true },
  { label: '欧洲', options: [{ value: 'de', label: 'Deutsch' }, { value: 'fr', label: 'Français', textValue: 'Francais' }] },
];

describe('Select', () => {
  it('触发框是 combobox + listbox 语义；没选时显示 placeholder', async () => {
    const user = userEvent.setup();
    render(<Select options={LANGS} aria-label="语言" placeholder="选择语言" />);
    const trigger = screen.getByRole('combobox', { name: '语言' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('选择语言');

    await user.click(trigger);
    const list = await screen.findByRole('listbox', { name: '语言' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', list.id);
    expect(screen.getAllByRole('option')).toHaveLength(5);
    expect(screen.getByRole('group', { name: '欧洲' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '日本語' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('非受控：点选后文字直接切换并立即收起，选中项 aria-selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={LANGS} defaultValue="zh" onChange={onChange} aria-label="语言" name="lang" />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('简体中文');
    expect(document.querySelector('input[name="lang"]')).toHaveValue('zh');

    await user.click(trigger);
    expect(await screen.findByRole('option', { name: '简体中文' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: 'English' }));
    expect(onChange).toHaveBeenCalledWith('en', expect.objectContaining({ value: 'en' }));
    expect(trigger).toHaveTextContent('English');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('input[name="lang"]')).toHaveValue('en');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull(), { timeout: 1500 });
  });

  it('键盘：方向键打开并用 aria-activedescendant 指向高亮项，跳过禁用项，Enter 选中，Esc 关闭', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={LANGS} defaultValue="en" onChange={onChange} aria-label="语言" />);
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const english = await screen.findByRole('option', { name: 'English' });
    expect(trigger).toHaveAttribute('aria-activedescendant', english.id);
    expect(trigger).toHaveFocus();

    await user.keyboard('{ArrowDown}');   // 日本語 被禁用，直接到 Deutsch
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Deutsch' }).id);
    await user.keyboard('{End}');
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Français' }).id);
    await user.keyboard('{Home}');
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: '简体中文' }).id);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('zh', expect.anything());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard(' ');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('首字母跳转（用 textValue）', async () => {
    const user = userEvent.setup();
    render(<Select options={LANGS} aria-label="语言" />);
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('f');
    const fr = await screen.findByRole('option', { name: 'Français' });
    expect(trigger).toHaveAttribute('aria-activedescendant', fr.id);
    await user.keyboard('{Enter}');
    expect(trigger).toHaveTextContent('Français');
  });

  it('受控：不更新 value 就不会变；禁用时点不开', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Select options={LANGS} value="zh" onChange={onChange} aria-label="语言" />);
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Deutsch' }));
    expect(onChange).toHaveBeenCalledWith('de', expect.anything());
    expect(trigger).toHaveTextContent('简体中文');
    rerender(<Select options={LANGS} value="de" onChange={onChange} aria-label="语言" />);
    expect(trigger).toHaveTextContent('Deutsch');

    rerender(<Select options={LANGS} value="de" disabled aria-label="语言" />);
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('MultiSelect', () => {
  it('多选：选中后不收起，触发框显示小标签，超过上限折成 +N；每个值一个隐藏 input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Demo() {
      const [value, setValue] = useState<string[]>([]);
      return <MultiSelect options={LANGS} value={value} onChange={(v) => { onChange(v); setValue(v); }} aria-label="语言" name="langs" maxChips={2} />;
    }
    render(<Demo />);
    const trigger = screen.getByRole('combobox', { name: '语言' });
    await user.click(trigger);
    const list = await screen.findByRole('listbox');
    expect(list).toHaveAttribute('aria-multiselectable', 'true');

    await user.click(screen.getByRole('option', { name: 'English' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('option', { name: 'Deutsch' }));
    await user.click(screen.getByRole('option', { name: 'Français' }));
    expect(onChange).toHaveBeenLastCalledWith(['en', 'de', 'fr']);
    expect(screen.getByRole('option', { name: 'Deutsch' })).toHaveAttribute('aria-selected', 'true');
    expect(trigger).toHaveTextContent('EnglishDeutsch+1');
    expect(document.querySelectorAll('input[name="langs"]')).toHaveLength(3);

    await user.click(screen.getByRole('option', { name: 'English' }));
    expect(onChange).toHaveBeenLastCalledWith(['de', 'fr']);
  });

  it('display="count" 显示“已选 N 项”；键盘空格切换', async () => {
    const user = userEvent.setup();
    render(<MultiSelect options={LANGS} defaultValue={['zh']} display="count" aria-label="语言" />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('已选 1 项');
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown} ');
    expect(trigger).toHaveTextContent('已选 2 项');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Select / MultiSelect 接入 Field', () => {
  it('放进 Field 直接可用：名称来自标签，错误进描述，aria-invalid / aria-required 自动带上，默认撑满', async () => {
    const user = userEvent.setup();
    render(<Field label="语言" hint="界面语言" error="必填" required><Select options={LANGS} /></Field>);
    const trigger = screen.getByRole('combobox', { name: /语言/ });
    expect(trigger).toBe(screen.getByLabelText(/语言/));
    expect(trigger).toHaveAccessibleDescription('界面语言 必填');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-required', 'true');
    expect(trigger.parentElement).toHaveClass('ok-select', 'ok-select--block');

    // 弹出的列表也用 Field 的标签命名
    await user.click(trigger);
    expect(await screen.findByRole('listbox', { name: /语言/ })).toBeInTheDocument();
  });

  it('点 Field 的标签：聚焦触发框，但不替用户点开', async () => {
    const user = userEvent.setup();
    render(<Field label="语言"><Select options={LANGS} /></Field>);
    const trigger = screen.getByRole('combobox');
    await user.click(screen.getByText('语言'));
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Field 禁用时跟着禁用；自己传的属性优先；MultiSelect 同样接线', () => {
    const { rerender } = render(<Field label="语言" disabled><Select options={LANGS} name="lang" defaultValue="zh" /></Field>);
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(document.querySelector('input[name="lang"]')).toBeDisabled();

    rerender(<Field label="语言" error="至少选一种" id="f"><MultiSelect options={LANGS} id="mine" aria-describedby="extra" block={false} /></Field>);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('id', 'mine');
    expect(trigger).toHaveAttribute('aria-describedby', 'extra f-error');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger.parentElement).not.toHaveClass('ok-select--block');
  });

  it('不在 Field 里：默认不撑满，block 属性打开', () => {
    const { rerender } = render(<Select options={LANGS} aria-label="语言" />);
    const root = screen.getByRole('combobox').parentElement!;
    expect(root).not.toHaveClass('ok-select--block');
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-required');
    rerender(<Select options={LANGS} aria-label="语言" block required />);
    expect(root).toHaveClass('ok-select--block');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-required', 'true');
  });

  it('选项带图标时标 data-icon（图标列对齐）', async () => {
    const user = userEvent.setup();
    render(<Select aria-label="操作" options={[{ value: 'a', label: '编辑', icon: 'edit' }, { value: 'b', label: '重命名' }]} />);
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: '编辑' })).toHaveAttribute('data-icon');
    expect(screen.getByRole('option', { name: '重命名' })).not.toHaveAttribute('data-icon');
  });
});

describe('Select：点选后的退场与禁用项悬停', () => {
  it('单选点下立即收起；退场中的列表保持点选前的勾号和加粗（旧项），不播放描线；下次打开直接在新项上', async () => {
    const user = userEvent.setup();
    render(<Select options={LANGS} defaultValue="zh" aria-label="语言" />);
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    const list = await screen.findByRole('listbox');
    // 单选：对勾不描线，直接出现
    expect(list).toHaveAttribute('data-check', 'instant');
    const zh = screen.getByRole('option', { name: '简体中文' });
    const en = screen.getByRole('option', { name: 'English' });
    await user.click(en);
    // 触发框里的文字立即换，菜单立即开始收起
    expect(trigger).toHaveTextContent('English');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // 退场中（还没卸载）：勾号 / 加粗仍在旧项上
    expect(list).toBeInTheDocument();
    expect(list.closest('.ok-popup')).toHaveAttribute('data-state', 'closed');
    expect(zh).toHaveAttribute('aria-selected', 'true');
    expect(en).toHaveAttribute('aria-selected', 'false');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull(), { timeout: 1500 });

    await user.click(trigger);
    await screen.findByRole('listbox');
    expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: '简体中文' })).toHaveAttribute('aria-selected', 'false');
  });

  it('多选列表照常描线（选了不收起，勾号就在眼前画出来）', async () => {
    const user = userEvent.setup();
    render(<MultiSelect options={LANGS} aria-label="语言" />);
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('listbox')).not.toHaveAttribute('data-check');
  });

  it('指针移到禁用项：高亮淡出、不再指向上一项；键盘仍跳过禁用项', async () => {
    const user = userEvent.setup();
    render(<Select options={LANGS} aria-label="语言" />);
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    const list = await screen.findByRole('listbox');
    const en = screen.getByRole('option', { name: 'English' });
    await user.hover(en);
    expect(list).toHaveAttribute('data-hl');
    expect(trigger).toHaveAttribute('aria-activedescendant', en.id);
    await user.hover(screen.getByRole('option', { name: '日本語' }));
    expect(list).not.toHaveAttribute('data-hl');
    expect(trigger).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: '简体中文' }).id);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Deutsch' }).id);
  });
});
