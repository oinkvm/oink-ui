import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table } from './Table';
import type { TableColumn, TableSort } from './Table';

interface Member { id: string; name: string; role: string; commits: number }
const data: Member[] = [
  { id: 'a', name: '小朱', role: '设计负责人', commits: 24 },
  { id: 'b', name: '林一', role: '动效设计', commits: 17 },
  { id: 'c', name: '陈默', role: '前端工程', commits: 31 },
];
const columns: TableColumn<Member>[] = [
  { key: 'name', header: '成员' },
  { key: 'role', header: '角色' },
  { key: 'commits', header: '本周提交', numeric: true, sortable: true },
];
const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').find((c) => c.classList.contains('ok-table__primary'))!.textContent);

describe('Table', () => {
  it('按列定义渲染表头和数据', () => {
    render(<Table columns={columns} data={data} rowKey="id" label="成员" />);
    expect(screen.getByRole('table', { name: '成员' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['成员', '角色', '本周提交']);
    expect(names()).toEqual(['小朱', '林一', '陈默']);
    expect(screen.getByRole('cell', { name: '24' })).toHaveClass('is-num');
  });

  it('可排序列是按钮：升序 → 降序 → 取消，aria-sort 同步；键盘可操作', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<Table columns={columns} data={data} rowKey="id" onSortChange={onSortChange} />);
    const th = screen.getByRole('columnheader', { name: '本周提交' });
    const btn = within(th).getByRole('button', { name: '本周提交' });
    expect(th).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('columnheader', { name: '成员' })).not.toHaveAttribute('aria-sort');

    await user.click(btn);
    expect(th).toHaveAttribute('aria-sort', 'ascending');
    expect(names()).toEqual(['林一', '小朱', '陈默']);
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'commits', direction: 'asc' });

    btn.focus();
    await user.keyboard('{Enter}');
    expect(th).toHaveAttribute('aria-sort', 'descending');
    expect(names()).toEqual(['陈默', '小朱', '林一']);

    await user.keyboard(' ');
    expect(th).toHaveAttribute('aria-sort', 'none');
    expect(names()).toEqual(['小朱', '林一', '陈默']);
    expect(onSortChange).toHaveBeenLastCalledWith(null);
  });

  it('排序可以受控', async () => {
    const user = userEvent.setup();
    function Demo() {
      const [sort, setSort] = useState<TableSort>({ key: 'commits', direction: 'desc' });
      return <Table columns={columns} data={data} rowKey="id" sort={sort} onSortChange={setSort} />;
    }
    render(<Demo />);
    expect(names()).toEqual(['陈默', '小朱', '林一']);
    await user.click(screen.getByRole('button', { name: '本周提交' }));
    expect(names()).toEqual(['小朱', '林一', '陈默']);
  });

  it('行选择：单选一行后全选框是半选，点全选全部选中，再点清空', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<Table columns={columns} data={data} rowKey="id" selectable onSelectionChange={onSelectionChange} />);
    const all = screen.getByRole('checkbox', { name: '选择全部' }) as HTMLInputElement;
    const first = screen.getByRole('checkbox', { name: '选择 小朱' });
    expect(all.checked).toBe(false);
    expect(all.indeterminate).toBe(false);

    await user.click(first);
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a']);
    expect(all.indeterminate).toBe(true);
    expect(first.closest('tr')).toHaveAttribute('aria-selected', 'true');

    await user.click(all);
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'b', 'c']);
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);

    all.focus();
    await user.keyboard(' ');
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
    expect(screen.getAllByRole('checkbox').every((c) => !(c as HTMLInputElement).checked)).toBe(true);
  });

  it('选择可以受控', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<Table columns={columns} data={data} rowKey="id" selectable selectedKeys={['b']} onSelectionChange={onSelectionChange} />);
    expect(screen.getByRole('checkbox', { name: '选择 林一' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: '选择 陈默' }));
    expect(onSelectionChange).toHaveBeenCalledWith(['b', 'c']);
    expect(screen.getByRole('checkbox', { name: '选择 陈默' })).not.toBeChecked();
  });

  it('可滚动变体：容器是带名字、可聚焦的区域，并带 .ok-scroll', () => {
    render(<Table columns={columns} data={data} rowKey="id" scroll maxHeight={268} label="文件列表" />);
    const region = screen.getByRole('region', { name: '文件列表' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('ok-table', 'ok-table--scroll', 'ok-scroll');
    expect(region.style.getPropertyValue('--ok-table-h')).toBe('268px');
  });

  it('没有数据时显示空状态', () => {
    render(<Table columns={columns} data={[]} empty="还没有成员" selectable />);
    const cell = screen.getByText('还没有成员');
    expect(cell).toHaveAttribute('colspan', '4');
    expect(screen.getByRole('checkbox', { name: '选择全部' })).toBeDisabled();
  });

  it('共享悬停高亮：指针移到行上时在 table 上标记并写入位置', () => {
    render(<Table columns={columns} data={data} rowKey="id" />);
    const table = screen.getByRole('table');
    const row = screen.getByText('林一').closest('tr')!;
    fireEvent.pointerMove(row, { clientX: 10, clientY: 10 });
    expect(table).toHaveAttribute('data-hl');
    expect(table.style.getPropertyValue('--hl-h')).not.toBe('');
    fireEvent.pointerLeave(row.parentElement!);
    expect(table).not.toHaveAttribute('data-hl');
  });

  it('stackOnMobile：单元格带列名，并显式写回表格语义', () => {
    render(<Table columns={columns} data={data} rowKey="id" stackOnMobile />);
    expect(screen.getByRole('table').parentElement).toHaveClass('ok-table--stack');
    const cell = screen.getByText('设计负责人').closest('td')!;
    expect(cell).toHaveAttribute('data-label', '角色');
    expect(cell).toHaveAttribute('role', 'cell');
  });

  it('rowAction：每行第一格里有一个铺满整行的真按钮，有名字、键盘可达；行里别的控件照常', async () => {
    const user = userEvent.setup();
    const opened: string[] = [];
    const other = vi.fn();
    const cols: TableColumn<Member>[] = [...columns, { key: 'op', header: '操作', render: () => <button type="button" onClick={other}>更多</button> }];
    render(
      <Table
        columns={cols} data={data} rowKey="id" selectable
        rowAction={(row) => (row.id === 'b' ? null : { label: `打开 ${row.name}`, onSelect: () => opened.push(row.id) })}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    const btn = within(rows[0]).getByRole('button', { name: '打开 小朱' });
    expect(btn).toHaveClass('ok-table__row-action', 'ok-focusable');
    expect(btn).toHaveAttribute('type', 'button');
    // 在第一个数据单元格里，而不是选择列里；行上有标记供样式定位
    expect(btn.closest('td')).toHaveClass('ok-table__primary');
    expect(rows[0]).toHaveAttribute('data-action');
    // 返回 null 的行不可点
    expect(within(rows[1]).queryByRole('button', { name: /打开/ })).toBeNull();
    expect(rows[1]).not.toHaveAttribute('data-action');

    await user.click(btn);
    expect(opened).toEqual(['a']);
    btn.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(opened).toEqual(['a', 'a', 'a']);
    // 行里的其它按钮、复选框不触发主操作
    await user.click(within(rows[0]).getByRole('button', { name: '更多' }));
    await user.click(within(rows[0]).getByRole('checkbox'));
    expect(other).toHaveBeenCalledTimes(1);
    expect(opened).toHaveLength(3);
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('内建分页：先排序再切片，下方渲染 Pagination；换排序回到第一页', async () => {
    const user = userEvent.setup();
    const many: Member[] = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `成员${i}`, role: '工程', commits: (i * 3) % 7 }));
    const onPageChange = vi.fn();
    const { container } = render(<Table columns={columns} data={many} rowKey="id" label="成员" pageSize={3} onPageChange={onPageChange} defaultSort={{ key: 'commits', direction: 'desc' }} />);
    expect(container.firstElementChild).toHaveClass('ok-table-paged');
    const nav = screen.getByRole('navigation', { name: '成员分页' });
    expect(within(nav).getAllByRole('button', { name: /^第 \d 页$/ })).toHaveLength(3);
    // commits：0 3 6 2 5 1 4 → 降序 6 5 4 | 3 2 1 | 0
    expect(names()).toEqual(['成员2', '成员4', '成员6']);
    await user.click(within(nav).getByRole('button', { name: '下一页' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(names()).toEqual(['成员1', '成员3', '成员5']);
    await user.click(within(nav).getByRole('button', { name: '第 3 页' }));
    expect(names()).toEqual(['成员0']);
    // 取消排序：回到第一页，按原始顺序
    await user.click(screen.getByRole('button', { name: '本周提交' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    expect(names()).toEqual(['成员0', '成员1', '成员2']);
  });

  it('分页可以受控；数据变少时落到最后一页；只有一页时不显示分页；全选只管当前页', async () => {
    const user = userEvent.setup();
    const many: Member[] = Array.from({ length: 5 }, (_, i) => ({ id: String(i), name: `成员${i}`, role: '工程', commits: i }));
    const onPageChange = vi.fn();
    const onSelectionChange = vi.fn();
    const { rerender } = render(<Table columns={columns} data={many} rowKey="id" pageSize={2} page={3} onPageChange={onPageChange} selectable onSelectionChange={onSelectionChange} />);
    expect(names()).toEqual(['成员4']);
    await user.click(screen.getByRole('button', { name: '上一页' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(names()).toEqual(['成员4']);
    rerender(<Table columns={columns} data={many} rowKey="id" pageSize={2} page={2} onPageChange={onPageChange} selectable onSelectionChange={onSelectionChange} />);
    expect(names()).toEqual(['成员2', '成员3']);
    await user.click(screen.getByRole('checkbox', { name: '选择全部' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['2', '3']);
    rerender(<Table columns={columns} data={many.slice(0, 3)} rowKey="id" pageSize={2} page={5} onPageChange={onPageChange} />);
    expect(names()).toEqual(['成员2']);
    rerender(<Table columns={columns} data={many.slice(0, 2)} rowKey="id" pageSize={2} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(names()).toEqual(['成员0', '成员1']);
  });

  it('不分页时根节点仍是 .ok-table', () => {
    const { container } = render(<Table columns={columns} data={data} rowKey="id" />);
    expect(container.firstElementChild).toHaveClass('ok-table');
    expect(container.firstElementChild).not.toHaveAttribute('data-responsive');
  });

  it('hideBelow：表头和单元格都带断点标记，表格成为查询容器', () => {
    const cols: TableColumn<Member>[] = [columns[0], { ...columns[1], hideBelow: 'md' }, { ...columns[2], hideBelow: 'sm' }];
    const { container } = render(<Table columns={cols} data={data} rowKey="id" />);
    expect(container.firstElementChild).toHaveAttribute('data-responsive');
    expect(screen.getByRole('columnheader', { name: '角色' })).toHaveAttribute('data-hide-below', 'md');
    expect(screen.getByRole('columnheader', { name: '成员' })).not.toHaveAttribute('data-hide-below');
    expect(screen.getByRole('cell', { name: '设计负责人' })).toHaveAttribute('data-hide-below', 'md');
    expect(screen.getByRole('cell', { name: '24' })).toHaveAttribute('data-hide-below', 'sm');
  });
});
