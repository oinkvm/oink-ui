import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree } from './Tree';

const items = [
  { id: 'src', label: 'src', children: [
    { id: 'core', label: 'core', children: [{ id: 'motion', label: 'motion.ts' }] },
    { id: 'index', label: 'index.ts' },
  ] },
  { id: 'readme', label: 'README.md' },
  { id: 'lock', label: 'package-lock.json', disabled: true },
  { id: 'pkg', label: 'package.json' },
];
const item = (name: string) => screen.getByRole('treeitem', { name: new RegExp(`^${name}`) });

describe('Tree', () => {
  it('tree / treeitem / group 语义，只有一个节点在 Tab 序列里', () => {
    render(<Tree items={items} label="文件" defaultExpanded={['src']} />);
    expect(screen.getByRole('tree', { name: '文件' })).toBeInTheDocument();
    const src = item('src');
    expect(src).toHaveAttribute('aria-expanded', 'true');
    expect(src).toHaveAttribute('aria-level', '1');
    expect(src).toHaveAttribute('aria-setsize', '4');
    expect(src).toHaveAttribute('aria-posinset', '1');
    expect(item('index.ts')).toHaveAttribute('aria-level', '2');
    expect(item('index.ts')).not.toHaveAttribute('aria-expanded');
    expect(item('core')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('group')).toBeInTheDocument();
    expect(screen.getAllByRole('treeitem').filter((n) => n.tabIndex === 0)).toHaveLength(1);
    expect(item('package-lock.json')).toHaveAttribute('aria-disabled', 'true');
  });

  it('方向键：↓↑ 移动（跳过禁用），→ 展开再进入子级，← 收起再回父级，Home / End', async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(<Tree items={items} label="文件" onExpandedChange={onExpandedChange} />);
    await user.tab();
    expect(item('src')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(item('src')).toHaveAttribute('aria-expanded', 'true');
    expect(onExpandedChange).toHaveBeenLastCalledWith(['src']);
    await user.keyboard('{ArrowRight}');
    expect(item('core')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('index.ts')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('src')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('src')).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{ArrowDown}');
    expect(item('README.md')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('package.json')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(item('src')).toHaveFocus();
    await user.keyboard('{End}');
    expect(item('package.json')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(item('README.md')).toHaveFocus();
  });

  it('Enter / 空格 / 点击选中；禁用节点点不动', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Tree items={items} label="文件" onSelect={onSelect} />);
    await user.tab();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('readme');
    expect(item('README.md')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByText('package.json'));
    expect(onSelect).toHaveBeenLastCalledWith('pkg');
    expect(item('README.md')).toHaveAttribute('aria-selected', 'false');
    await user.click(screen.getByText('package-lock.json'));
    expect(onSelect).toHaveBeenCalledTimes(2);
    await user.click(screen.getByText('src'));
    expect(item('src')).toHaveAttribute('aria-expanded', 'true');
  });

  it('展开和选中都可以受控', async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(<Tree items={items} label="文件" expanded={[]} selected="readme" onExpandedChange={onExpandedChange} />);
    expect(item('README.md')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByText('src'));
    expect(onExpandedChange).toHaveBeenCalledWith(['src']);
    expect(item('src')).toHaveAttribute('aria-expanded', 'false');
    expect(item('README.md')).toHaveAttribute('aria-selected', 'true');
  });
});
