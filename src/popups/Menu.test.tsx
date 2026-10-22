import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DropdownMenu, Menu, MenuCheckboxItem, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuSub } from './Menu';

function Actions({ onSelect = () => {} }: { onSelect?: (v: string) => void }) {
  return (
    <DropdownMenu trigger={<button className="ok-btn">操作</button>} aria-label="操作">
      <MenuLabel>文件</MenuLabel>
      <MenuItem icon="edit" shortcut="⌘E" onSelect={() => onSelect('edit')}>Edit</MenuItem>
      <MenuItem icon="copy" onSelect={() => onSelect('copy')}>Copy</MenuItem>
      <MenuItem disabled onSelect={() => onSelect('share')}>Share</MenuItem>
      <MenuSeparator />
      <MenuItem tone="danger" icon="trash" onSelect={() => onSelect('delete')}>Delete</MenuItem>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('触发按钮带 aria-haspopup / aria-expanded；方向键打开并聚焦第一项，支持上下、Home / End、首尾相接', async () => {
    const user = userEvent.setup();
    render(<Actions />);
    const trigger = screen.getByRole('button', { name: '操作' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const menu = await screen.findByRole('menu', { name: '操作' });
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
    const edit = screen.getByRole('menuitem', { name: /Edit/ });
    await waitFor(() => expect(edit).toHaveFocus());
    expect(menu).toHaveAttribute('data-hl');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');   // 跳过禁用项
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');   // 回到开头
    expect(edit).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(edit).toHaveFocus();
  });

  it('带状态色的项：项和高亮块都带上 tone', async () => {
    const user = userEvent.setup();
    render(<Actions />);
    screen.getByRole('button', { name: '操作' }).focus();
    await user.keyboard('{ArrowUp}');
    const del = await screen.findByRole('menuitem', { name: 'Delete' });
    await waitFor(() => expect(del).toHaveFocus());
    expect(del).toHaveClass('ok-menu__item--danger');
    expect(document.querySelector('.ok-menu__hl')).toHaveAttribute('data-tone', 'danger');
  });

  it('首字母跳转；Enter 触发并收起，焦点回到触发按钮', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Actions onSelect={onSelect} />);
    const trigger = screen.getByRole('button', { name: '操作' });
    await user.click(trigger);
    const menu = await screen.findByRole('menu');
    await waitFor(() => expect(menu).toHaveFocus());
    await user.keyboard('d');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await act(async () => { await new Promise((r) => setTimeout(r, 550)); });   // 前缀缓冲 500ms 后清空
    await user.keyboard('c');
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('copy');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('禁用项标 aria-disabled，点了不触发也不收起；Esc 关闭', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Actions onSelect={onSelect} />);
    const trigger = screen.getByRole('button', { name: '操作' });
    await user.click(trigger);
    const share = await screen.findByRole('menuitem', { name: 'Share' });
    expect(share).toHaveAttribute('aria-disabled', 'true');
    await user.click(share);
    expect(onSelect).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull(), { timeout: 1500 });
  });

  it('Tab 关闭菜单', async () => {
    const user = userEvent.setup();
    render(<><Actions /><button>下一个</button></>);
    const trigger = screen.getByRole('button', { name: '操作' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Edit/ })).toHaveFocus());
    await user.tab();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('勾选项与单选组：aria-checked 跟着变，选了不收起', async () => {
    const user = userEvent.setup();
    const onChecked = vi.fn();
    function Demo() {
      const [sort, setSort] = useState('name');
      return (
        <DropdownMenu trigger={<button>视图</button>}>
          <MenuCheckboxItem defaultChecked onCheckedChange={onChecked}>显示隐藏文件</MenuCheckboxItem>
          <MenuRadioGroup aria-label="排序" value={sort} onChange={setSort}>
            <MenuRadioItem value="name">按名称</MenuRadioItem>
            <MenuRadioItem value="date">按日期</MenuRadioItem>
          </MenuRadioGroup>
        </DropdownMenu>
      );
    }
    render(<Demo />);
    const trigger = screen.getByRole('button', { name: '视图' });
    await user.click(trigger);
    const check = await screen.findByRole('menuitemcheckbox', { name: '显示隐藏文件' });
    expect(check).toHaveAttribute('aria-checked', 'true');
    await user.click(check);
    expect(check).toHaveAttribute('aria-checked', 'false');
    expect(onChecked).toHaveBeenCalledWith(false);

    expect(screen.getByRole('group', { name: '排序' })).toBeInTheDocument();
    const byDate = screen.getByRole('menuitemradio', { name: '按日期' });
    await user.click(byDate);
    expect(byDate).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: '按名称' })).toHaveAttribute('aria-checked', 'false');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('子菜单：→ 展开并聚焦第一项，← 收回，选中后整棵菜单收起', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu trigger={<button>更多</button>}>
        <MenuItem>Rename</MenuItem>
        <MenuSub label="Move to">
          <MenuItem onSelect={() => onSelect('inbox')}>Inbox</MenuItem>
          <MenuItem onSelect={() => onSelect('archive')}>Archive</MenuItem>
        </MenuSub>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole('button', { name: '更多' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    const sub = screen.getByRole('menuitem', { name: 'Move to' });
    expect(sub).toHaveFocus();
    expect(sub).toHaveAttribute('aria-haspopup', 'menu');
    expect(sub).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{ArrowRight}');
    const inbox = await screen.findByRole('menuitem', { name: 'Inbox' });
    await waitFor(() => expect(inbox).toHaveFocus());
    expect(sub).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(sub).toHaveFocus();
    expect(sub).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Inbox' })).toHaveFocus());
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('archive');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Menu', () => {
  it('可以不带触发按钮单独使用：role="menu"，指针移上去高亮跟随', async () => {
    const user = userEvent.setup();
    render(<Menu aria-label="静态菜单"><MenuItem>甲</MenuItem><MenuItem>乙</MenuItem></Menu>);
    const menu = screen.getByRole('menu', { name: '静态菜单' });
    expect(menu).not.toHaveAttribute('data-hl');
    await user.hover(screen.getByRole('menuitem', { name: '乙' }));
    expect(menu).toHaveAttribute('data-hl');
    expect(screen.getByRole('menuitem', { name: '乙' })).toHaveFocus();
    await user.unhover(menu);
    expect(menu).not.toHaveAttribute('data-hl');
  });

  it('指针移到菜单里的非菜单项内容（分隔线、自定义控件行）上：高亮淡出，焦点离开上一项，但不抢走控件的焦点', async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="屏幕">
        <MenuItem>隐藏</MenuItem>
        <MenuSeparator />
        <div data-testid="row"><input aria-label="速度" /></div>
      </Menu>,
    );
    const menu = screen.getByRole('menu', { name: '屏幕' });
    const item = screen.getByRole('menuitem', { name: '隐藏' });
    await user.hover(item);
    expect(menu).toHaveAttribute('data-hl');
    await user.hover(screen.getByTestId('row'));
    expect(menu).not.toHaveAttribute('data-hl');
    expect(item).not.toHaveFocus();
    const input = screen.getByRole('textbox', { name: '速度' });
    await user.click(input);
    expect(input).toHaveFocus();
    await user.hover(screen.getByTestId('row'));
    expect(input).toHaveFocus();
  });

  it('图标列：带图标的项标 data-icon，供样式给同一菜单里不带图标的项留出图标位', () => {
    render(
      <Menu aria-label="操作">
        <MenuItem icon="edit">编辑</MenuItem>
        <MenuItem>重命名</MenuItem>
        <MenuCheckboxItem>置顶</MenuCheckboxItem>
        <MenuItem icon={<svg data-testid="custom" />}>自定义图标</MenuItem>
      </Menu>,
    );
    expect(screen.getByRole('menuitem', { name: '编辑' })).toHaveAttribute('data-icon');
    expect(screen.getByRole('menuitem', { name: '重命名' })).not.toHaveAttribute('data-icon');
    expect(screen.getByRole('menuitemcheckbox', { name: '置顶' })).not.toHaveAttribute('data-icon');
    expect(screen.getByRole('menuitem', { name: '自定义图标' })).toHaveAttribute('data-icon');
    // 留位规则是 .ok-menu:has(.ok-menu__item[data-icon]) .ok-menu__item:not([data-icon])：两类项都在同一个 .ok-menu 里
    const menu = screen.getByRole('menu');
    expect(menu.querySelectorAll('.ok-menu__item[data-icon]')).toHaveLength(2);
    expect(menu.querySelectorAll('.ok-menu__item:not([data-icon])')).toHaveLength(2);
  });
});

// jsdom 没有完整的 PointerEvent：用带坐标的 MouseEvent 冒充 pointermove（React 和文档上的监听都按事件类型收）
function pointerMove(target: Element, x: number, y: number) {
  fireEvent(target, new MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
}
const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;

describe('子菜单的安全三角与禁用项', () => {
  function Share() {
    return (
      <Menu aria-label="右键">
        <MenuItem>复制</MenuItem>
        <MenuSub label="分享到">
          <MenuItem>邮件</MenuItem>
          <MenuItem>复制链接</MenuItem>
        </MenuSub>
        <MenuItem>锁定图层</MenuItem>
        <MenuItem disabled>导出</MenuItem>
      </Menu>
    );
  }
  /** 指针停在“分享到”上把子菜单打开，并给子菜单一个位置：在父菜单右边 x 200–300、y 0–100 */
  async function openShare() {
    render(<Share />);
    const trigger = screen.getByRole('menuitem', { name: '分享到' });
    pointerMove(trigger, 100, 20);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
    const subMenu = document.getElementById(trigger.getAttribute('aria-controls')!)!;
    const popup = subMenu.closest('.ok-popup') as HTMLElement;
    popup.getBoundingClientRect = () => rect(200, 0, 100, 100);
    pointerMove(trigger, 100, 20);   // 记下三角形的顶点
    expect(trigger).toHaveFocus();
    return { trigger, menu: screen.getByRole('menu', { name: '右键' }) };
  }

  it('离开触发项、不朝子菜单走：下一项立即拿到高亮，子菜单马上收起（不再有固定延时）', async () => {
    const { trigger, menu } = await openShare();
    const lock = screen.getByRole('menuitem', { name: '锁定图层' });
    pointerMove(lock, 100, 40);   // 竖直向下
    expect(lock).toHaveFocus();
    expect(menu).toHaveAttribute('data-hl');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('朝子菜单斜着走、途经别的项：保持子菜单和触发项的高亮；指针停下后才让位', async () => {
    const { trigger } = await openShare();
    const lock = screen.getByRole('menuitem', { name: '锁定图层' });
    pointerMove(lock, 120, 30);   // 在 (100,20) 与子菜单左边 (200,-4)–(200,104) 组成的三角形里
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // 指针停在三角形里不动：很快按它脚下的项处理，不会一直卡着
    await waitFor(() => expect(lock).toHaveFocus(), { timeout: 600 });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('进入子菜单后子菜单的项正常高亮；回到父菜单的别的项时立即收起', async () => {
    const { trigger } = await openShare();
    const mail = screen.getByRole('menuitem', { name: '邮件' });
    pointerMove(mail, 210, 10);
    expect(mail).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const copy = screen.getByRole('menuitem', { name: '复制' });
    pointerMove(copy, 90, 5);
    expect(copy).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('指针移到禁用项：高亮淡出（不停在上一项），焦点交还菜单；键盘仍跳过禁用项', async () => {
    const user = userEvent.setup();
    render(<Share />);
    const menu = screen.getByRole('menu', { name: '右键' });
    const lock = screen.getByRole('menuitem', { name: '锁定图层' });
    pointerMove(lock, 50, 60);
    expect(lock).toHaveFocus();
    expect(menu).toHaveAttribute('data-hl');
    pointerMove(screen.getByRole('menuitem', { name: '导出' }), 50, 80);
    expect(menu).not.toHaveAttribute('data-hl');
    expect(menu).toHaveFocus();
    await user.keyboard('{End}');
    expect(lock).toHaveFocus();
  });

  it('子菜单开着时指到禁用项：子菜单收起、高亮淡出', async () => {
    const { trigger, menu } = await openShare();
    pointerMove(screen.getByRole('menuitem', { name: '导出' }), 100, 80);   // 竖直向下，不朝子菜单
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(menu).not.toHaveAttribute('data-hl');
  });

  it('选了就收起的勾选项：退场中的菜单保持点选前的勾选样子', async () => {
    const user = userEvent.setup();
    function Grid() {
      const [on, setOn] = useState(false);
      return (
        <DropdownMenu trigger={<button>视图</button>}>
          <MenuCheckboxItem closeOnSelect checked={on} onCheckedChange={setOn}>显示网格</MenuCheckboxItem>
        </DropdownMenu>
      );
    }
    render(<Grid />);
    const trigger = screen.getByRole('button', { name: '视图' });
    await user.click(trigger);
    const item = await screen.findByRole('menuitemcheckbox', { name: '显示网格' });
    await user.click(item);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // 还没卸载（退场中）：仍是点选前的未勾选
    expect(item).toBeInTheDocument();
    expect(item).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull(), { timeout: 1500 });
    await user.click(trigger);
    expect(await screen.findByRole('menuitemcheckbox', { name: '显示网格' })).toHaveAttribute('aria-checked', 'true');
  });
});
