import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ForwardedRef, HTMLAttributes, PointerEvent as ReactPointerEvent, ReactElement, ReactNode, Ref, UIEvent } from 'react';
import { chain, clamp, cx, Icon, mergeRefs, useControllable, useIsoLayoutEffect, useLocale } from '../core';
import type { Breakpoint } from '../core';
import { Pagination } from './Pagination';

export type TableSortDirection = 'asc' | 'desc';
export type TableSort = { key: string; direction: TableSortDirection } | null;

export interface TableColumn<T> {
  /** 列标识；没有 accessor / render 时也用它从行数据里取值 */
  key: string;
  header: ReactNode;
  /** 表头不是纯文字时，给读屏和卡片式布局用的文字标签 */
  label?: string;
  /** 取值，用于排序和默认渲染。默认 row[key] */
  accessor?: (row: T) => unknown;
  /** 自定义单元格 */
  render?: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  /** 自定义比较（升序）；降序时自动取反 */
  compare?: (a: T, b: T) => number;
  /** 数字列：右对齐、等宽数字 */
  numeric?: boolean;
  align?: 'start' | 'center' | 'end';
  width?: number | string;
  /**
   * 表格自己的宽度小于该断点（sm 520 / md 768 / lg 1024 / xl 1280）时隐藏这一列。
   * 按容器宽度判断（@container），所以放在侧栏旁边的窄主区里也对；浏览器不支持容器查询时退回按视口宽度
   */
  hideBelow?: Breakpoint;
}

/** 行的主操作：label 是按钮的无障碍名称（“打开 小朱”），onSelect 在点行或在按钮上按 Enter / 空格时调用 */
export interface TableRowAction { label: string; onSelect: () => void }

export interface TableProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  columns: TableColumn<T>[];
  data: T[];
  /** 行的唯一标识：字段名或函数。默认用下标 */
  rowKey?: keyof T | ((row: T, index: number) => string);
  /** 表格的名字（aria-label）；可滚动时也是滚动区域的名字 */
  label?: string;
  /** 可见的表格标题 <caption> */
  caption?: ReactNode;
  /** 排序（受控）。null = 不排序 */
  sort?: TableSort;
  defaultSort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
  /** 只发出排序事件、不在内部排序（服务端排序） */
  manualSort?: boolean;
  /** 行选择：首列出现复选框，表头是全选 */
  selectable?: boolean;
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  /** 行的名字，用在复选框的 aria-label 里。默认取第一列的文字 */
  getRowLabel?: (row: T, index: number) => string;
  /** 可滚动变体：限高、表头吸顶 */
  scroll?: boolean;
  /** 可滚动变体的最大高度，默认 320 */
  maxHeight?: number | string;
  /** 窄屏（< 520px）把每一行变成卡片式的键值对 */
  stackOnMobile?: boolean;
  /** 没有数据时显示的内容 */
  empty?: ReactNode;
  /**
   * 整行可点。不是给 <tr> 绑 onClick（那样键盘到不了、读屏不知道能点），而是在每行第一个数据单元格里放一个
   * 铺满整行的真按钮：Tab 能到、有名字、Enter / 空格触发。行里别的按钮、链接、复选框照常可以单独点。
   * 返回 null / undefined 的行不可点。
   */
  rowAction?: (row: T, index: number) => TableRowAction | null | undefined;
  /**
   * 内建分页：每页几行。给了它就在内部先排序、再切出当前页，并在表格下方渲染一个 Pagination
   * （这时最外层多一层 .ok-table-paged，ref 和其余属性仍然落在 .ok-table 上）。不到两页时不显示分页
   */
  pageSize?: number;
  /** 当前页，从 1 开始（受控） */
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /** 关掉跟随指针的共享悬停高亮 */
  noHighlight?: boolean;
}

const CHECK = <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.6 8.4l2.9 2.9 5.9-6.4" pathLength={1} /></svg>;

const getValue = <T,>(col: TableColumn<T>, row: T): unknown => (col.accessor ? col.accessor(row) : (row as Record<string, unknown>)[col.key]);
const labelOf = <T,>(col: TableColumn<T>) => col.label ?? (typeof col.header === 'string' ? col.header : col.key);

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function TableInner<T>(
  {
    columns, data, rowKey, label, caption, sort: sortProp, defaultSort = null, onSortChange, manualSort,
    selectable, selectedKeys, defaultSelectedKeys, onSelectionChange, getRowLabel,
    scroll, maxHeight, stackOnMobile, empty: emptyProp, noHighlight, rowAction, pageSize, page: pageProp, defaultPage = 1, onPageChange,
    className, style, onScroll, ...rest
  }: TableProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { messages: t } = useLocale();
  const empty = emptyProp === undefined ? t.table.empty : emptyProp;
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const allRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useControllable<TableSort>(sortProp, defaultSort, onSortChange);
  const [selected, setSelected] = useControllable<string[]>(selectedKeys, defaultSelectedKeys ?? [], onSelectionChange);
  const [overflowing, setOverflowing] = useState(false);

  const keyOf = (row: T, i: number) => (typeof rowKey === 'function' ? rowKey(row, i) : rowKey != null ? String(row[rowKey]) : String(i));

  const sorted = useMemo(() => {
    const list = data.map((row, index) => ({ row, index }));
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col || manualSort) return list;
    const sign = sort.direction === 'desc' ? -1 : 1;
    const cmp = col.compare ?? ((a: T, b: T) => compareValues(getValue(col, a), getValue(col, b)));
    return list.sort((a, b) => sign * cmp(a.row, b.row) || a.index - b.index);
  }, [data, columns, sort, manualSort]);

  // 分页：先排序再切片。数据变少后当前页超出范围时落到最后一页
  const paged = pageSize != null && pageSize > 0;
  const size = paged ? Math.max(1, Math.floor(pageSize)) : 0;
  const pageCount = paged ? Math.max(1, Math.ceil(sorted.length / size)) : 1;
  const [pageRaw, setPage] = useControllable(pageProp, defaultPage, onPageChange);
  const page = clamp(pageRaw, 1, pageCount);
  const rows = useMemo(() => (paged ? sorted.slice((page - 1) * size, page * size) : sorted), [sorted, paged, page, size]);

  const keys = rows.map((r) => keyOf(r.row, r.index));
  const picked = new Set(selected);
  const pickedHere = keys.filter((k) => picked.has(k)).length;
  const all = keys.length > 0 && pickedHere === keys.length;
  const some = pickedHere > 0 && !all;

  useIsoLayoutEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  }, [some]);

  // 普通变体只在内容真的超宽时才成为可聚焦的滚动区域
  useEffect(() => {
    const wrap = wrapRef.current;
    const table = tableRef.current;
    if (!wrap || !table || typeof ResizeObserver === 'undefined') return;
    const check = () => setOverflowing(wrap.scrollWidth > wrap.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(wrap);
    ro.observe(table);
    return () => ro.disconnect();
  }, []);

  /* —— 共享悬停高亮：一块浅灰底跟着指针在行之间滑动。直接改 DOM，不触发渲染 —— */
  const hl = useRef<{ cur: HTMLElement | null; x: number; y: number; top: number; calm: ReturnType<typeof setTimeout> | undefined }>({ cur: null, x: 0, y: 0, top: 0, calm: undefined });
  const moveTo = (tr: HTMLElement | null) => {
    const table = tableRef.current;
    const s = hl.current;
    if (!table || tr === s.cur) return;
    s.cur = tr;
    if (!tr) { delete table.dataset.hl; return; }
    const place = () => {
      // 用未取整的几何尺寸：offsetTop / offsetHeight 会四舍五入，最后一行可能因此溢出半个像素
      const r = tr.getBoundingClientRect();
      table.style.setProperty('--hl-y', (r.top - table.getBoundingClientRect().top).toFixed(2) + 'px');
      table.style.setProperty('--hl-h', r.height.toFixed(2) + 'px');
    };
    if (table.dataset.hl !== undefined) place();
    else {   // 第一次出现：直接落在这一行上淡入，不从别处滑过来
      table.dataset.noAnim = '';
      place();
      void table.offsetWidth;
      delete table.dataset.noAnim;
      table.dataset.hl = '';
    }
  };
  const rowUnder = (n: Element | null) => {
    const tr = n?.closest?.('tr') as HTMLElement | null;
    return tr && tr.parentElement?.tagName === 'TBODY' && !tr.hasAttribute('data-empty') ? tr : null;
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLTableSectionElement>) => {
    if (e.pointerType === 'touch') return;
    hl.current.x = e.clientX; hl.current.y = e.clientY;
    const tr = rowUnder(e.target as Element);
    if (tr) moveTo(tr);
  };
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const view = e.currentTarget;
    const table = tableRef.current;
    const s = hl.current;
    if (!table) return;
    if (view.scrollTop !== s.top) {
      // 纵向滚动期间关掉高亮的滑动动画：高亮直接落在指针下的那一行，不追着内容跑
      s.top = view.scrollTop;
      table.dataset.jumping = '';
      clearTimeout(s.calm);
      s.calm = setTimeout(() => { delete table.dataset.jumping; }, 140);
    }
    if (!s.cur || typeof document.elementFromPoint !== 'function') return;
    moveTo(rowUnder(document.elementFromPoint(s.x, s.y)));
  };
  useEffect(() => () => clearTimeout(hl.current.calm), []);
  // 行变了（排序、换数据）之后旧的高亮位置作废
  useIsoLayoutEffect(() => { moveTo(null); }, [rows]);

  const toggleSort = (key: string) => {
    if (!sort || sort.key !== key) setSort({ key, direction: 'asc' });
    else if (sort.direction === 'asc') setSort({ key, direction: 'desc' });
    else setSort(null);
    // 换了排序，原来那一页的内容已经不是同一批行了：回到第一页
    if (paged) setPage(1);
  };
  const toggleAll = () => {
    if (all) setSelected(selected.filter((k) => !keys.includes(k)));
    else setSelected(Array.from(new Set([...selected, ...keys])));
  };
  const toggleRow = (key: string) => setSelected(picked.has(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  const region = scroll || overflowing;
  const name = label ?? (typeof caption === 'string' ? caption : undefined);
  // display 被改成 block 之后表格语义会丢，卡片式布局时显式写回 role
  const r = (role: string) => (stackOnMobile ? { role } : null);
  const colCount = columns.length + (selectable ? 1 : 0);
  const cellClass = (c: TableColumn<T>) => cx(c.numeric && 'is-num', c.align && `ok-table__cell--${c.align}`) || undefined;
  const responsive = columns.some((c) => c.hideBelow);
  const vars = maxHeight != null ? ({ '--ok-table-h': typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight } as CSSProperties) : undefined;

  const table = (
    <div
      ref={mergeRefs(ref, wrapRef)}
      className={cx('ok-table', scroll && 'ok-table--scroll ok-scroll', stackOnMobile && 'ok-table--stack', className)}
      data-ready={noHighlight ? undefined : ''}
      data-responsive={responsive ? '' : undefined}
      style={vars ? { ...vars, ...style } : style}
      {...(region ? { role: 'region', tabIndex: 0, 'aria-label': name ?? t.table.label } : null)}
      onScroll={chain(onScroll, noHighlight ? undefined : handleScroll)}
      {...rest}
    >
      <table ref={tableRef} aria-label={caption == null ? name : undefined} {...r('table')}>
        {caption != null && <caption className="ok-table__caption">{caption}</caption>}
        <thead {...r('rowgroup')}>
          <tr {...r('row')}>
            {selectable && (
              <th className="ok-table__select" scope="col" {...r('columnheader')}>
                <label className="ok-check">
                  <input ref={allRef} type="checkbox" checked={all} onChange={toggleAll} disabled={keys.length === 0} aria-label={t.table.selectAll} />
                  <span className="ok-check__box">{CHECK}</span>
                </label>
              </th>
            )}
            {columns.map((c) => {
              const dir = sort && sort.key === c.key ? sort.direction : null;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={cellClass(c)}
                  data-hide-below={c.hideBelow}
                  style={c.width != null ? { width: c.width } : undefined}
                  aria-sort={c.sortable ? (dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none') : undefined}
                  {...r('columnheader')}
                >
                  {c.sortable ? (
                    <button type="button" className="ok-table__sort ok-focusable" data-dir={dir ?? undefined} onClick={() => toggleSort(c.key)}>
                      {c.header}
                      <Icon className="ok-table__sort-icon"><path d="M10 15.500v-11M5.500 9L10 4.500 14.500 9" /></Icon>
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody onPointerMove={noHighlight ? undefined : onPointerMove} onPointerLeave={noHighlight ? undefined : () => moveTo(null)} {...r('rowgroup')}>
          {rows.length === 0 && (
            <tr data-empty="" {...r('row')}>
              <td className="ok-table__empty" colSpan={colCount} {...r('cell')}>{empty}</td>
            </tr>
          )}
          {rows.map(({ row, index }, i) => {
            const key = keys[i];
            const on = picked.has(key);
            const first = columns[0] ? getValue(columns[0], row) : undefined;
            const rowLabel = getRowLabel ? getRowLabel(row, index) : typeof first === 'string' || typeof first === 'number' ? String(first) : t.table.row(i + 1);
            const action = rowAction?.(row, index) ?? null;
            return (
              <tr key={key} data-selected={selectable && on ? '' : undefined} data-action={action ? '' : undefined} aria-selected={selectable ? on : undefined} {...r('row')}>
                {selectable && (
                  <td className="ok-table__select" data-label={t.table.selectColumn} {...r('cell')}>
                    <label className="ok-check">
                      <input type="checkbox" checked={on} onChange={() => toggleRow(key)} aria-label={t.table.selectRow(rowLabel)} />
                      <span className="ok-check__box">{CHECK}</span>
                    </label>
                  </td>
                )}
                {columns.map((c, ci) => {
                  const v = c.render ? c.render(row, index) : (getValue(c, row) as ReactNode);
                  return (
                    <td key={c.key} className={cx(cellClass(c), ci === 0 && 'ok-table__primary') || undefined} data-label={labelOf(c)} data-hide-below={c.hideBelow} {...r('cell')}>
                      {/* 覆盖按钮：绝对定位铺满这一行（tr 是定位容器），不占单元格里的位置 */}
                      {ci === 0 && action && <button type="button" className="ok-table__row-action ok-focusable" aria-label={action.label} onClick={action.onSelect} />}
                      {stackOnMobile ? <span className="ok-table__value">{v}</span> : v}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {selectable && <span className="ok-sr" role="status" id={`${id}-count`}>{selected.length > 0 ? t.table.selected(selected.length) : ''}</span>}
    </div>
  );

  if (!paged) return table;
  return (
    <div className="ok-table-paged">
      {table}
      {pageCount > 1 && <Pagination className="ok-table__pagination" label={t.table.pagination(name ?? t.table.label)} count={pageCount} page={page} onChange={setPage} />}
    </div>
  );
}

/** 表格：列定义 + 数据。排序、行选择、整行主操作、内建分页、按容器宽度隐藏列、吸顶滚动、共享悬停高亮、窄屏卡片式布局 */
export const Table = forwardRef(TableInner) as <T>(props: TableProps<T> & { ref?: Ref<HTMLDivElement> }) => ReactElement | null;
