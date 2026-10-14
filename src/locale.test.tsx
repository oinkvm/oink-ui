import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  Alert, AppShell, Avatar, AvatarGroup, Breadcrumb, Button, Calendar, Chip, CodeBlock, ColorPicker, CommandPalette, Combobox, Confirmer,
  DatePicker, DateRangePicker, Dialog, Dots, Drawer, FileDrop, FloatingHeader, Hotkey, Input, Kbd, LocaleProvider, MultiSelect, NumberInput,
  OinkProvider, Pagination, PinInput, RangeCalendar, RangeSlider, Rating, Reaction, SearchInput, Select, Spinner, SplitPane, Stat, Steps, Table,
  Tag, Toaster, confirm, toast, useLocale,
} from './index';
import type { OinkLocale } from './index';

const TODAY = new Date(2026, 9, 13);
const CJK = /[　-〿一-鿿＀-￯]/;

/** 页面上所有给人看 / 给读屏的文字：文本节点 + 常见的文字属性 */
function visibleStrings(root: ParentNode = document.body) {
  const out: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const t = walker.currentNode.textContent?.trim(); if (t) out.push(t); }
  const attrs = ['aria-label', 'aria-valuetext', 'aria-roledescription', 'title', 'placeholder', 'alt', 'abbr', 'data-label'];
  root.querySelectorAll('*').forEach((el) => attrs.forEach((a) => { const v = el.getAttribute(a); if (v) out.push(`${a}=${v}`); }));
  return out;
}

describe('语言（locale）', () => {
  it('没有 Provider 时是 zh-CN；LocaleProvider 可以嵌套，内层优先，不传时沿用外层', () => {
    const seen: OinkLocale[] = [];
    function Probe() { seen.push(useLocale().locale); return null; }
    render(
      <>
        <Probe />
        <OinkProvider locale="en-US">
          <Probe />
          <LocaleProvider><Probe /></LocaleProvider>
          <LocaleProvider locale="zh-CN"><Probe /></LocaleProvider>
        </OinkProvider>
      </>,
    );
    expect(seen).toEqual(['zh-CN', 'en-US', 'en-US', 'zh-CN']);
  });

  it('en-US：DatePicker 的按钮、弹层名称、占位符和日历月份标题是英文', async () => {
    const user = userEvent.setup();
    render(<OinkProvider locale="en-US"><DatePicker today={TODAY} aria-label="Due" /></OinkProvider>);
    expect(screen.getByRole('textbox', { name: 'Due' })).toHaveAttribute('placeholder', 'YYYY-MM-DD');
    await user.click(screen.getByRole('button', { name: 'Open calendar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose date' });
    expect(within(dialog).getByRole('grid', { name: 'October 2026' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Next month' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^Tuesday, October 13, 2026, today$/ })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('columnheader')[0]).toHaveAttribute('abbr', 'Monday');
  });

  it('en-US：DateRangePicker 的占位符和弹层名称；显式的 locale 属性仍然优先', async () => {
    const user = userEvent.setup();
    render(
      <OinkProvider locale="en-US">
        <DateRangePicker today={TODAY} />
        <Calendar today={TODAY} locale="zh-CN" aria-label="cal" />
      </OinkProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Start date – End date' });
    expect(screen.getByRole('grid', { name: 'cal' }).querySelector('th')).toHaveAttribute('abbr', '星期一');
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Choose date range' })).toBeInTheDocument();
  });

  it('zh-CN（默认）：日历标题仍是“2026年10月”', () => {
    render(<Calendar today={TODAY} />);
    expect(screen.getByRole('grid', { name: '2026年10月' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上个月' })).toBeInTheDocument();
  });

  it('en-US：PinInput 的组名和每一格的名字', () => {
    render(<OinkProvider locale="en-US"><PinInput length={4} /></OinkProvider>);
    expect(screen.getByRole('group', { name: 'Verification code' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Digit 1 of 4' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Digit 4 of 4' })).toBeInTheDocument();
  });

  it('en-US：Dialog 和 Drawer 的关闭按钮叫 Close；传了 closeLabel 时仍以它为准', async () => {
    render(
      <OinkProvider locale="en-US">
        <Dialog defaultOpen closable title="Settings" />
      </OinkProvider>,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('en-US：Drawer 的关闭按钮', async () => {
    render(
      <OinkProvider locale="en-US">
        <Drawer defaultOpen><FloatingHeader title="Details" /></Drawer>
      </OinkProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('closeLabel 覆盖默认文案', async () => {
    render(<OinkProvider locale="en-US"><Dialog defaultOpen closable closeLabel="Dismiss" title="T" /></OinkProvider>);
    expect(await screen.findByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('en-US：confirm() 的按钮跟着 <Confirmer /> 所在的语言', async () => {
    render(<OinkProvider locale="en-US"><Confirmer /></OinkProvider>);
    let result: Promise<boolean> | undefined;
    act(() => { result = confirm('Discard changes?'); });
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard changes?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    await expect(result).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), { timeout: 1500 });
  });

  it('en-US：toast() 的出口名称和关闭按钮跟着 <Toaster /> 所在的语言', async () => {
    render(<OinkProvider locale="en-US"><Toaster /></OinkProvider>);
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    act(() => { toast({ title: 'Saved', closable: true, duration: 0 }); });
    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument();
    act(() => { toast.dismiss(); });
    await waitFor(() => expect(screen.queryByText('Saved')).toBeNull());
  });

  it('en-US：Pagination', () => {
    render(<OinkProvider locale="en-US"><Pagination count={5} defaultPage={2} /></OinkProvider>);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('status')).toHaveTextContent('Page 2 of 5');
  });

  it('en-US：ColorPicker', () => {
    render(<OinkProvider locale="en-US"><ColorPicker defaultValue="#3366cc" swatches={['#ff0000']} /></OinkProvider>);
    expect(screen.getByRole('group', { name: 'Color' })).toBeInTheDocument();
    const area = screen.getByRole('slider', { name: 'Saturation and brightness' });
    expect(area).toHaveAttribute('aria-roledescription', '2D slider');
    expect(area.getAttribute('aria-valuetext')).toMatch(/^Saturation \d+%, brightness \d+%$/);
    expect(screen.getByRole('slider', { name: 'Hue' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Hex color' })).toBeInTheDocument();
  });

  it('en-US：Select / MultiSelect 的占位符和计数', () => {
    const options = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }];
    render(
      <OinkProvider locale="en-US">
        <Select options={options} aria-label="Fruit" />
        <MultiSelect options={options} defaultValue={['a', 'b']} display="count" aria-label="Fruits" />
      </OinkProvider>,
    );
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveTextContent('Select…');
    expect(screen.getByRole('combobox', { name: 'Fruits' })).toHaveTextContent('2 selected');
  });

  it('en-US：大范围渲染后，页面上没有残留中文', async () => {
    const options = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }];
    const rows = [{ id: 1, name: 'Ann', age: 30 }, { id: 2, name: 'Bob', age: 25 }, { id: 3, name: 'Cy', age: 40 }];
    render(
      <OinkProvider locale="en-US">
        <Confirmer />
        <Toaster />
        <AppShell collapsed={false}>
          <AppShell.Header><AppShell.Trigger /><AppShell.Trigger target="aside" /></AppShell.Header>
          <AppShell.Sidebar><p>Nav</p></AppShell.Sidebar>
          <AppShell.Main>
            <Alert closable title="Heads up">Body</Alert>
            <Avatar name="Ann" status="online" />
            <AvatarGroup max={1} overflowList={false}><Avatar name="Ann" /><Avatar name="Bob" /><Avatar name="Cy" /></AvatarGroup>
            <AvatarGroup max={1}><Avatar name="Ann" /><Avatar name="Bob" /></AvatarGroup>
            <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'A', href: '/a' }, { label: 'B', href: '/a/b' }, { label: 'C' }]} maxItems={3} />
            <CodeBlock code="const a = 1;" />
            <CodeBlock code="x" label="named" />
            <Pagination count={3} />
            <Reaction count={2} />
            <Spinner /><Dots />
            <Stat label="Revenue" value="1" delta="+2%" trend="up" />
            <Steps items={[{ title: 'One' }, { title: 'Two' }, { title: 'Three' }]} current={1} status="error" />
            <Table
              columns={[{ key: 'name', header: 'Name' }, { key: 'age', header: 'Age', sortable: true }]}
              data={rows} rowKey="id" selectable defaultSelectedKeys={['1']} pageSize={2} scroll
            />
            <Table columns={[{ key: 'name', header: 'Name' }]} data={[]} />
            <Tag onRemove={() => {}}>tag</Tag>
            <Button loading>Save</Button>
            <Chip onRemove={() => {}}>chip</Chip>
            <ColorPicker swatches={['#ff0000']} />
            <FileDrop />
            <Hotkey />
            <Hotkey defaultValue="Meta+Shift+K" />
            <Kbd k="Space" /><Kbd k="ArrowUp" />
            <Input clearable defaultValue="x" aria-label="name" />
            <Input type="password" aria-label="pw" />
            <NumberInput aria-label="n" />
            <PinInput />
            <RangeSlider aria-label="range" />
            <Rating />
            <Rating readOnly defaultValue={3} />
            <SearchInput aria-label="search" />
            <Select options={options} aria-label="s" />
            <Combobox options={options} clearable defaultValue="a" aria-label="c" />
            <Calendar today={TODAY} />
            <RangeCalendar today={TODAY} />
            <DatePicker today={TODAY} aria-label="d" />
            <DateRangePicker today={TODAY} />
            <SplitPane><div>L</div><div>R</div></SplitPane>
            <Dialog defaultOpen closable title="Dialog" />
            <CommandPalette defaultOpen items={[{ id: 'x', label: 'Run' }]} />
          </AppShell.Main>
          <AppShell.Aside><p>Aside</p></AppShell.Aside>
        </AppShell>
      </OinkProvider>,
    );
    act(() => { void confirm('Sure?'); });
    await screen.findByRole('alertdialog');
    act(() => { toast({ title: 'Done', closable: true, duration: 0 }); });
    await screen.findByText('Done');
    // 读屏播报的 aria-live 文案（CodeBlock 复制、FileDrop 选择）在交互后才出现，这里只查静态的部分
    const bad = visibleStrings().filter((s) => CJK.test(s));
    expect(bad).toEqual([]);
  });

  it('SSR：renderToString 用 Provider 的语言，不读浏览器', () => {
    // jsdom 里做服务端渲染，useLayoutEffect 会报“服务端不执行”的警告；与本测试无关，静音
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const html = renderToString(
      <OinkProvider locale="en-US">
        <Pagination count={3} />
        <DatePicker today={TODAY} aria-label="d" />
        <PinInput length={2} />
      </OinkProvider>,
    );
    expect(html).toContain('Next page');
    expect(html).toContain('Open calendar');
    expect(html).toContain('Digit 1 of 2');
    expect(CJK.test(html)).toBe(false);
    spy.mockRestore();
  });
});
