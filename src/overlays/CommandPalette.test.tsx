import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CommandPalette } from './CommandPalette';
import type { CommandItem } from './CommandPalette';

const ITEMS: CommandItem[] = [
  { id: 'new', label: '新建文件', group: '文件', shortcut: ['⌘', 'N'] },
  { id: 'open', label: '打开文件', group: '文件', keywords: ['open'] },
  { id: 'locked', label: '导出 PDF', group: '文件', disabled: true },
  { id: 'theme', label: '切换主题', group: '外观', description: '浅色 / 深色' },
  { id: 'zoom', label: '放大', group: '外观' },
];

function Demo({ onSelect, items = ITEMS }: { onSelect?: (item: CommandItem) => void; items?: CommandItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>命令</button>
      <CommandPalette open={open} onOpenChange={setOpen} items={items} onSelect={onSelect} />
    </>
  );
}

describe('CommandPalette', () => {
  it('combobox + listbox 语义：焦点在搜索框，结果分组，第一项默认高亮', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByText('命令'));
    const dialog = await screen.findByRole('dialog', { name: '命令面板' });
    expect(dialog.parentElement).toHaveAttribute('data-placement', 'top');
    const input = screen.getByRole('combobox', { name: '命令面板' });
    expect(document.activeElement).toBe(input);
    const list = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: '文件' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '外观' })).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(5);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(screen.getByRole('option', { name: /导出 PDF/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('方向键移动（跳过禁用项、首尾循环）、Home / End，Enter 执行并关闭', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onItem = vi.fn();
    render(<Demo onSelect={onSelect} items={ITEMS.map((item) => (item.id === 'theme' ? { ...item, onSelect: onItem } : item))} />);
    const trigger = screen.getByText('命令');
    await user.click(trigger);
    const input = await screen.findByRole('combobox');
    const active = () => document.getElementById(input.getAttribute('aria-activedescendant') as string);
    await user.keyboard('{ArrowDown}');
    expect(active()).toHaveTextContent('打开文件');
    await user.keyboard('{ArrowDown}');
    expect(active()).toHaveTextContent('切换主题');
    await user.keyboard('{End}');
    expect(active()).toHaveTextContent('放大');
    await user.keyboard('{ArrowDown}');
    expect(active()).toHaveTextContent('新建文件');
    await user.keyboard('{ArrowUp}');
    expect(active()).toHaveTextContent('放大');
    await user.keyboard('{Home}{ArrowDown}{ArrowDown}');
    expect(active()).toHaveTextContent('切换主题');
    expect(document.activeElement).toBe(input);
    await user.keyboard('{Enter}');
    expect(onItem).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'theme' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
    expect(document.activeElement).toBe(trigger);
  });

  it('输入即过滤（标签、关键词、说明）；没有结果时给出提示；Esc 关闭；再次打开时搜索词清空', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByText('命令'));
    const input = await screen.findByRole('combobox');
    await user.type(input, 'open');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('打开文件');
    await user.clear(input);
    await user.type(input, '深色');
    expect(screen.getByRole('option')).toHaveTextContent('切换主题');
    await user.clear(input);
    await user.type(input, '不存在的命令');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('没有匹配的结果');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
    await user.click(screen.getByText('命令'));
    expect(await screen.findByRole('combobox')).toHaveValue('');
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });

  it('点按结果执行；禁用项点了没反应', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Demo onSelect={onSelect} />);
    await user.click(screen.getByText('命令'));
    await user.click(await screen.findByRole('option', { name: /导出 PDF/ }));
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole('option', { name: /放大/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'zoom' }));
  });
});

describe('CommandPalette：共享高亮块', () => {
  it('高亮由列表里唯一的高亮块画出，随指针 / 键盘移动；指到禁用项或离开列表时淡出，键盘仍跳过禁用项', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByText('命令'));
    const input = await screen.findByRole('combobox');
    const list = screen.getByRole('listbox');
    const hl = list.querySelector(':scope > .ok-cmdk__hl');
    expect(hl).not.toBeNull();
    expect(hl).toHaveAttribute('aria-hidden', 'true');
    expect(list.querySelectorAll('.ok-cmdk__hl')).toHaveLength(1);
    // 打开时第一项高亮
    await waitFor(() => expect(list).toHaveAttribute('data-hl'));

    const theme = screen.getByRole('option', { name: /切换主题/ });
    await user.hover(theme);
    expect(input).toHaveAttribute('aria-activedescendant', theme.id);
    expect(list).toHaveAttribute('data-hl');

    // 禁用项：高亮淡出，不停在上一项；Enter 什么也不执行
    await user.hover(screen.getByRole('option', { name: /导出 PDF/ }));
    expect(list).not.toHaveAttribute('data-hl');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(screen.queryAllByRole('option', { selected: true })).toHaveLength(0);

    // 键盘从这里接着走，跳过禁用项
    await user.keyboard('{ArrowDown}');
    expect(list).toHaveAttribute('data-hl');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /新建文件/ }).id);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', theme.id);

    // 指针离开列表：淡出
    await user.hover(theme);
    await user.unhover(list);
    expect(list).not.toHaveAttribute('data-hl');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /放大/ }).id);
  });

  it('没有结果时列表整个隐藏（高亮块不会让它“非空”）', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByText('命令'));
    const input = await screen.findByRole('combobox');
    await user.type(input, '不存在的命令');
    expect(document.querySelector('.ok-cmdk__list')).toHaveAttribute('hidden');
  });
});
