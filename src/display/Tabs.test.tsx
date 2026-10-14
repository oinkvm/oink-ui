import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

const items = [
  { value: 'overview', label: '概览', content: '3 个项目进行中' },
  { value: 'activity', label: '活动记录', content: '今天 14:02' },
  { value: 'members', label: '成员', content: '5 位成员', disabled: true },
  { value: 'settings', label: '设置', content: '项目可见性' },
];

describe('Tabs', () => {
  it('tablist / tab / tabpanel 语义和关联', () => {
    render(<Tabs items={items} label="项目" />);
    expect(screen.getByRole('tablist', { name: '项目' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    const panel = document.getElementById(tabs[0].getAttribute('aria-controls')!)!;
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0].id);
    expect(panel).toHaveAttribute('data-state', 'active');
    expect(panel).toHaveTextContent('3 个项目进行中');
  });

  it('自动激活：方向键移动并切换，跳过禁用项，Home / End 到两端，循环', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={items} onChange={onChange} />);
    const tabs = screen.getAllByRole('tab');
    await user.tab();
    expect(tabs[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(onChange).toHaveBeenLastCalledWith('activity');
    await user.keyboard('{ArrowRight}');
    expect(tabs[3]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[0]).toHaveFocus();
    await user.keyboard('{End}');
    expect(tabs[3]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(tabs[3]).toHaveFocus();
  });

  it('手动激活：方向键只移动焦点，Enter 才切换', async () => {
    const user = userEvent.setup();
    render(<Tabs items={items} activation="manual" />);
    const tabs = screen.getAllByRole('tab');
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('受控：只在外部更新 value 后才切换', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Tabs items={items} value="overview" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: '设置' }));
    expect(onChange).toHaveBeenCalledWith('settings');
    expect(screen.getByRole('tab', { name: '概览' })).toHaveAttribute('aria-selected', 'true');
    rerender(<Tabs items={items} value="settings" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: '设置' })).toHaveAttribute('aria-selected', 'true');
  });

  it('unmountInactive（已是默认行为，保留兼容）只渲染当前面板', async () => {
    const user = userEvent.setup();
    function Demo() {
      const [v, setV] = useState('overview');
      return <Tabs items={items} value={v} onChange={setV} unmountInactive />;
    }
    render(<Demo />);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    await user.click(screen.getByRole('tab', { name: '活动记录' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('今天 14:02');
  });

  it('默认只渲染当前面板：只有当前标签带 aria-controls，切换后换成新面板', async () => {
    const user = userEvent.setup();
    render(<Tabs items={items} />);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('3 个项目进行中');
    expect(screen.queryByText('今天 14:02')).toBeNull();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id);
    expect(tabs[1]).not.toHaveAttribute('aria-controls');
    await user.click(tabs[1]);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('今天 14:02');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[1].id);
  });

  it('keepMounted：所有面板都在 DOM 里叠放，只有当前的是 active，面板里的状态保留', async () => {
    const user = userEvent.setup();
    const withInput = [{ value: 'a', label: '甲', content: <input aria-label="备注" /> }, { value: 'b', label: '乙', content: '乙的内容' }];
    const { container } = render(<Tabs items={withInput} keepMounted />);
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(2);
    expect(container.querySelector('.ok-tabs__panels')).toHaveAttribute('data-keep-mounted');
    expect(panels[0]).toHaveAttribute('data-state', 'active');
    expect(panels[1]).toHaveAttribute('data-state', 'inactive');
    screen.getAllByRole('tab').forEach((t, i) => expect(t).toHaveAttribute('aria-controls', panels[i].id));
    await user.type(screen.getByLabelText('备注'), '还在');
    await user.click(screen.getByRole('tab', { name: '乙' }));
    expect(panels[1]).toHaveAttribute('data-state', 'active');
    await user.click(screen.getByRole('tab', { name: '甲' }));
    expect(container.querySelector('input')).toHaveValue('还在');
  });

  it('切换时面板区的高度从旧高度过渡到新高度', async () => {
    const user = userEvent.setup();
    const { container } = render(<Tabs items={items} />);
    const panels = container.querySelector('.ok-tabs__panels') as HTMLElement;
    let height = 120;
    Object.defineProperty(panels, 'offsetHeight', { configurable: true, get: () => height });
    // 让组件先记下旧高度
    await user.click(screen.getByRole('tab', { name: '活动记录' }));
    const spy = vi.spyOn(panels, 'animate');
    height = 480;
    await user.click(screen.getByRole('tab', { name: '设置' }));
    const call = spy.mock.calls.find(([frames]) => Array.isArray(frames) && 'height' in (frames[0] as Keyframe));
    expect(call).toBeDefined();
    const frames = call![0] as Keyframe[];
    expect(frames[0].height).toBe('120px');
    expect(frames[1].height).toBe('480px');
  });
});
