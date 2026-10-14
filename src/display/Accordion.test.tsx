import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from './Accordion';

const items = [
  { value: 'data', title: 'Oink 会收集哪些数据？', content: '只收集必需的数据。' },
  { value: 'keys', title: '可以自定义快捷键吗？', content: '可以。' },
  { value: 'os', title: '支持哪些平台？', content: 'macOS 与 Windows。' },
];

describe('Accordion', () => {
  it('标题是按钮，带 aria-expanded / aria-controls，面板有名字', () => {
    render(<Accordion items={items} defaultValue={['data']} />);
    const head = screen.getByRole('button', { name: 'Oink 会收集哪些数据？' });
    expect(head).toHaveAttribute('aria-expanded', 'true');
    const body = document.getElementById(head.getAttribute('aria-controls')!)!;
    expect(body).toHaveAttribute('role', 'region');
    expect(body).toHaveAttribute('aria-labelledby', head.id);
    expect(head.closest('.ok-accordion__item')).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('button', { name: '支持哪些平台？' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });

  it('多开（默认）：各项互不影响；Enter / 空格可以切换', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Accordion items={items} onChange={onChange} />);
    const [a, b] = screen.getAllByRole('button');
    await user.click(a);
    a.focus();
    await user.tab();
    expect(b).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(a).toHaveAttribute('aria-expanded', 'true');
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(onChange).toHaveBeenLastCalledWith(['data', 'keys']);
    await user.keyboard(' ');
    expect(b).toHaveAttribute('aria-expanded', 'false');
  });

  it('单开：展开一项会收起其它项', async () => {
    const user = userEvent.setup();
    render(<Accordion items={items} type="single" defaultValue={['data']} />);
    const [a, b] = screen.getAllByRole('button');
    await user.click(b);
    expect(a).toHaveAttribute('aria-expanded', 'false');
    expect(b).toHaveAttribute('aria-expanded', 'true');
  });

  it('方向键、Home / End 在标题之间移动', async () => {
    const user = userEvent.setup();
    render(<Accordion items={items} />);
    const heads = screen.getAllByRole('button');
    heads[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(heads[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(heads[2]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(heads[0]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(heads[2]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(heads[0]).toHaveFocus();
  });

  it('受控', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Accordion items={items} value={['os']} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '可以自定义快捷键吗？' }));
    expect(onChange).toHaveBeenCalledWith(['os', 'keys']);
    expect(screen.getByRole('button', { name: '可以自定义快捷键吗？' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('variant：group 带卡片底，plain 不带底并标记为无内缩', () => {
    const { container, rerender } = render(<Accordion items={items} />);
    expect(container.firstElementChild).toHaveClass('ok-accordion', 'ok-group');
    expect(container.firstElementChild).not.toHaveClass('ok-accordion--plain');
    rerender(<Accordion items={items} variant="plain" />);
    expect(container.firstElementChild).toHaveClass('ok-accordion', 'ok-accordion--plain');
    expect(container.firstElementChild).not.toHaveClass('ok-group');
  });
});
