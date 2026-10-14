import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('是一个多行文本框，非受控输入并回调新值', async () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="备注" onChange={onChange} />);
    const ta = screen.getByRole('textbox', { name: '备注' });
    expect(ta.tagName).toBe('TEXTAREA');
    await userEvent.type(ta, '你好');
    expect(ta).toHaveValue('你好');
    expect(onChange).toHaveBeenLastCalledWith('你好');
  });

  it('受控：不改 props 就不变', async () => {
    render(<Textarea aria-label="备注" value="固定" onChange={() => {}} />);
    const ta = screen.getByRole('textbox', { name: '备注' });
    await userEvent.type(ta, 'x');
    expect(ta).toHaveValue('固定');
  });

  it('自动增高：默认打上 data-autogrow 并带行数变量；不支持 field-sizing 时脚本按内容设高度', async () => {
    const { rerender } = render(<Textarea aria-label="备注" minRows={2} maxRows={6} />);
    const ta = screen.getByRole('textbox', { name: '备注' }) as HTMLTextAreaElement;
    expect(ta).toHaveAttribute('data-autogrow');
    expect(ta.style.getPropertyValue('--_min-rows')).toBe('2');
    expect(ta.style.getPropertyValue('--_max-rows')).toBe('6');
    // jsdom 不支持 field-sizing，走的是脚本兜底：scrollHeight 在 jsdom 里恒为 0
    Object.defineProperty(ta, 'scrollHeight', { configurable: true, value: 120 });
    await userEvent.type(ta, 'a');
    expect(ta.style.height).toBe('120px');
    rerender(<Textarea aria-label="备注" autoGrow={false} invalid />);
    expect(ta).not.toHaveAttribute('data-autogrow');
    expect(ta).toHaveAttribute('aria-invalid', 'true');
  });
});
