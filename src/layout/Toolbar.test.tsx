import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  it('是带名字的 toolbar，整条只有一个 Tab 停靠点', async () => {
    render(
      <>
        <button>前</button>
        <Toolbar aria-label="格式">
          <button type="button">加粗</button>
          <button type="button">斜体</button>
          <button type="button" disabled>禁用</button>
          <a href="#x">链接</a>
        </Toolbar>
        <button>后</button>
      </>,
    );
    const bar = screen.getByRole('toolbar', { name: '格式' });
    expect(bar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByText('加粗')).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('斜体')).toHaveAttribute('tabindex', '-1');
    const user = userEvent.setup();
    await user.tab();
    await user.tab();
    expect(screen.getByText('加粗')).toHaveFocus();
    await user.tab();
    expect(screen.getByText('后')).toHaveFocus();
  });

  it('方向键、Home、End 在控件间移动，跳过禁用项并首尾循环', async () => {
    render(
      <Toolbar aria-label="格式">
        <button type="button">加粗</button>
        <button type="button">斜体</button>
        <button type="button" disabled>禁用</button>
        <a href="#x">链接</a>
      </Toolbar>,
    );
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('斜体')).toHaveFocus();
    expect(screen.getByText('斜体')).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('加粗')).toHaveAttribute('tabindex', '-1');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('链接')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('加粗')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('链接')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByText('加粗')).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByText('链接')).toHaveFocus();
  });

  it('纵向用上下键；loop={false} 时到头不循环', async () => {
    render(
      <Toolbar aria-label="工具" orientation="vertical" loop={false}>
        <button type="button">甲</button>
        <button type="button">乙</button>
      </Toolbar>,
    );
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('甲')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('乙')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('乙')).toHaveFocus();
  });

  it('在文本框里不抢方向键', async () => {
    render(
      <Toolbar aria-label="搜索">
        <input aria-label="关键字" defaultValue="abc" />
        <button type="button">搜索</button>
      </Toolbar>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('关键字'));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByLabelText('关键字')).toHaveFocus();
  });

  it('当前项被移除后，Tab 停靠点回到第一项', () => {
    function Demo() {
      const [show, setShow] = useState(true);
      return (
        <Toolbar aria-label="格式">
          <button type="button">加粗</button>
          {show ? <button type="button" onClick={() => setShow(false)}>删除我</button> : null}
        </Toolbar>
      );
    }
    render(<Demo />);
    const target = screen.getByText('删除我');
    target.focus();
    expect(target).toHaveAttribute('tabindex', '0');
    fireEvent.click(target);
    expect(screen.getByText('加粗')).toHaveAttribute('tabindex', '0');
  });
});
