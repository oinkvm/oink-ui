import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptionCard, OptionCardGroup } from './OptionCard';

const cards = <><OptionCard value="default">默认</OptionCard><OptionCard value="compact">紧凑</OptionCard><OptionCard value="focus">专注</OptionCard></>;

describe('OptionCardGroup', () => {
  it('单选：radiogroup + radio，没选时 Tab 落在第一张', () => {
    render(<OptionCardGroup aria-label="窗口模式">{cards}</OptionCardGroup>);
    expect(screen.getByRole('radiogroup', { name: '窗口模式' })).toHaveClass('ok-options');
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveClass('ok-option');
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it('单选非受控：点击选中；方向键移动并选中，首尾循环', async () => {
    const onChange = vi.fn();
    render(<OptionCardGroup aria-label="窗口模式" defaultValue="default" onChange={onChange}>{cards}</OptionCardGroup>);
    await userEvent.click(screen.getByRole('radio', { name: '紧凑' }));
    expect(onChange).toHaveBeenLastCalledWith('compact');
    expect(screen.getByRole('radio', { name: '紧凑' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '默认' })).toHaveAttribute('aria-checked', 'false');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '专注' })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith('focus');
    await userEvent.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('default');
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('focus');
  });

  it('单选受控：不改 props 就不变', async () => {
    const onChange = vi.fn();
    render(<OptionCardGroup aria-label="窗口模式" value="default" onChange={onChange}>{cards}</OptionCardGroup>);
    await userEvent.click(screen.getByRole('radio', { name: '专注' }));
    expect(onChange).toHaveBeenCalledWith('focus');
    expect(screen.getByRole('radio', { name: '默认' })).toHaveAttribute('aria-checked', 'true');
  });

  it('多选：group + checkbox，各自可 Tab 到，空格切换', async () => {
    const onChange = vi.fn();
    render(<OptionCardGroup aria-label="功能" multiple defaultValue={['default']} onChange={onChange}>{cards}</OptionCardGroup>);
    expect(screen.getByRole('group', { name: '功能' })).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    await userEvent.tab();
    await userEvent.tab();
    expect(boxes[1]).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(['default', 'compact']);
    await userEvent.click(boxes[0]);
    expect(onChange).toHaveBeenLastCalledWith(['compact']);
  });

  it('示意图插槽：随便放 div 或 svg 都包在 .ok-option__art 里，不进入可读名称之外的结构', () => {
    render(
      <OptionCardGroup aria-label="布局">
        <OptionCard value="a" art={<div data-testid="art-div" style={{ width: 999, height: 999 }} />}>默认</OptionCard>
        <OptionCard value="b" art={<svg data-testid="art-svg" viewBox="0 0 10 10" aria-hidden="true" />}>紧凑</OptionCard>
        <OptionCard value="c">无图</OptionCard>
      </OptionCardGroup>,
    );
    expect(screen.getByTestId('art-div').parentElement).toHaveClass('ok-option__art');
    expect(screen.getByTestId('art-svg').parentElement).toHaveClass('ok-option__art');
    const [a, , c] = screen.getAllByRole('radio');
    expect(a.firstElementChild).toHaveClass('ok-option__art');
    expect(c.querySelector('.ok-option__art')).toBeNull();
    expect(screen.getByRole('radio', { name: '紧凑' })).toBeInTheDocument();
  });
});
