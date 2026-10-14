import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('是搜索框语义；Enter 触发 onSearch，Esc 清空', async () => {
    const onSearch = vi.fn();
    const onChange = vi.fn();
    render(<SearchInput aria-label="搜索设置" onSearch={onSearch} onChange={onChange} />);
    const input = screen.getByRole('searchbox', { name: '搜索设置' });
    expect(input.parentElement).toHaveClass('ok-input--pill');
    await userEvent.type(input, '快捷键{Enter}');
    expect(onSearch).toHaveBeenCalledWith('快捷键');
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('带清除按钮；受控时值由外部决定', async () => {
    const onChange = vi.fn();
    render(<SearchInput aria-label="搜索" value="abc" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '清除' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('searchbox')).toHaveValue('abc');
  });
});
