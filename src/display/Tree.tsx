import { forwardRef, useRef, useState } from 'react';
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cx, Icon, useControllable } from '../core';

export interface TreeNode {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  children?: TreeNode[];
  disabled?: boolean;
}

export interface TreeProps extends Omit<HTMLAttributes<HTMLUListElement>, 'onSelect'> {
  items: TreeNode[];
  /** 展开的节点 id */
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** 选中的节点 id；null = 没有选中 */
  selected?: string | null;
  defaultSelected?: string | null;
  onSelect?: (id: string | null) => void;
  /** 树的名字（aria-label） */
  label?: string;
}

interface Flat { node: TreeNode; level: number; parent: string | null }

/** 树：role="tree"，↑↓ 在可见节点间移动，→ 展开 / 进入子级，← 收起 / 回到父级，Home / End，Enter / 空格选中 */
export const Tree = forwardRef<HTMLUListElement, TreeProps>(function Tree(
  { items, expanded: expandedProp, defaultExpanded, onExpandedChange, selected: selectedProp, defaultSelected = null, onSelect, label, className, ...rest }, ref,
) {
  const [expanded, setExpanded] = useControllable<string[]>(expandedProp, defaultExpanded ?? [], onExpandedChange);
  const [selected, setSelected] = useControllable<string | null>(selectedProp, defaultSelected, onSelect);
  const [active, setActive] = useState<string | null>(selected);
  const nodes = useRef(new Map<string, HTMLLIElement>());
  const open = new Set(expanded);

  // 当前可见的节点，按显示顺序
  const flat: Flat[] = [];
  const walk = (list: TreeNode[], level: number, parent: string | null) => list.forEach((node) => {
    flat.push({ node, level, parent });
    if (node.children?.length && open.has(node.id)) walk(node.children, level + 1, node.id);
  });
  walk(items, 1, null);
  const usable = flat.filter((f) => !f.node.disabled);
  // roving tabindex：落点不可见了就退回第一个可用节点
  const tabStop = usable.some((f) => f.node.id === active) ? active : usable[0]?.node.id ?? null;

  const focus = (id: string | undefined) => {
    if (id == null) return;
    setActive(id);
    nodes.current.get(id)?.focus();
  };
  const setOpen = (id: string, on: boolean) => setExpanded(on ? [...expanded.filter((x) => x !== id), id] : expanded.filter((x) => x !== id));

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const el = e.target as HTMLElement;
    if (el.getAttribute('role') !== 'treeitem') return;   // 节点内容里的控件自己处理按键
    const at = usable.findIndex((f) => f.node.id === el.dataset.id);
    if (at < 0) return;
    const { node, parent } = usable[at];
    const branch = !!node.children?.length;
    let handled = true;
    switch (e.key) {
      case 'ArrowDown': focus(usable[at + 1]?.node.id); break;
      case 'ArrowUp': focus(usable[at - 1]?.node.id); break;
      case 'Home': focus(usable[0].node.id); break;
      case 'End': focus(usable[usable.length - 1].node.id); break;
      case 'ArrowRight':
        if (branch && !open.has(node.id)) setOpen(node.id, true);
        else if (branch) focus(node.children!.find((c) => !c.disabled)?.id);
        break;
      case 'ArrowLeft':
        if (branch && open.has(node.id)) setOpen(node.id, false);
        else if (parent) focus(parent);
        break;
      case 'Enter':
      case ' ':
        setSelected(node.id);
        if (branch) setOpen(node.id, !open.has(node.id));
        break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  };

  const render = (list: TreeNode[], level: number): ReactNode => list.map((node, i) => {
    const branch = !!node.children?.length;
    const isOpen = branch && open.has(node.id);
    return (
      <li
        key={node.id}
        ref={(n) => { if (n) nodes.current.set(node.id, n); else nodes.current.delete(node.id); }}
        role="treeitem"
        data-id={node.id}
        className="ok-tree__item"
        aria-level={level}
        aria-setsize={list.length}
        aria-posinset={i + 1}
        aria-expanded={branch ? isOpen : undefined}
        aria-selected={selected === node.id}
        aria-disabled={node.disabled || undefined}
        tabIndex={tabStop === node.id ? 0 : -1}
        onFocus={(e) => { if (e.target === e.currentTarget) setActive(node.id); }}
      >
        <div
          className="ok-tree__row"
          onClick={() => {
            if (node.disabled) return;
            setActive(node.id);
            setSelected(node.id);
            if (branch) setOpen(node.id, !isOpen);
          }}
        >
          <span className="ok-tree__chev" aria-hidden="true">{branch && <Icon name="chevron-right" />}</span>
          {node.icon != null && <span className="ok-tree__icon" aria-hidden="true">{node.icon}</span>}
          <span className="ok-tree__label">{node.label}</span>
        </div>
        {isOpen && <ul role="group" className="ok-tree__group">{render(node.children!, level + 1)}</ul>}
      </li>
    );
  });

  return (
    <ul ref={ref} role="tree" aria-label={label} className={cx('ok-tree', className)} onKeyDown={onKeyDown} {...rest}>
      {render(items, 1)}
    </ul>
  );
});
