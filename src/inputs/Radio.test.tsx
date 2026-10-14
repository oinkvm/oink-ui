import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Radio, RadioGroup } from './Radio';

const items = <><Radio value="day">每天</Radio><Radio value="week">每周</Radio><Radio value="never" disabled>从不</Radio></>;

describe('RadioGroup', () => {
  it('是带名称的 radiogroup，里面是同名的原生单选', () => {
    render(<RadioGroup aria-label="频率" defaultValue="day">{items}</RadioGroup>);
    expect(screen.getByRole('radiogroup', { name: '频率' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(radios[0]).toBeChecked();
    expect(radios[0].name).toBeTruthy();
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(radios[2]).toBeDisabled();
  });

  it('非受控：点击选中并回调 value', async () => {
    const onChange = vi.fn();
    render(<RadioGroup aria-label="频率" onChange={onChange}>{items}</RadioGroup>);
    await userEvent.click(screen.getByRole('radio', { name: '每周' }));
    expect(screen.getByRole('radio', { name: '每周' })).toBeChecked();
    expect(onChange).toHaveBeenCalledWith('week');
  });

  it('方向键在组内移动并选中，跳过禁用项', async () => {
    const onChange = vi.fn();
    render(<RadioGroup aria-label="频率" defaultValue="day" onChange={onChange}>{items}</RadioGroup>);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: '每天' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: '每周' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: '每周' })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith('week');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: '每天' })).toBeChecked();
  });

  it('受控：不改 props 就不变', async () => {
    const onChange = vi.fn();
    render(<RadioGroup aria-label="频率" value="day" onChange={onChange}>{items}</RadioGroup>);
    await userEvent.click(screen.getByRole('radio', { name: '每周' }));
    expect(onChange).toHaveBeenCalledWith('week');
    expect(screen.getByRole('radio', { name: '每天' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '每周' })).not.toBeChecked();
  });

  it('带说明文字时标 data-described（样式据此把圆点对齐第一行）', () => {
    render(
      <RadioGroup aria-label="频率">
        <Radio value="day" description="每天早上 9 点">每天</Radio>
        <Radio value="week">每周</Radio>
      </RadioGroup>,
    );
    expect(screen.getByRole('radio', { name: /每天/ }).closest('label')).toHaveAttribute('data-described');
    expect(screen.getByRole('radio', { name: '每周' }).closest('label')).not.toHaveAttribute('data-described');
  });
});
