import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileDrop } from './FileDrop';

const png = new File(['x'], 'a.png', { type: 'image/png' });
const txt = new File(['hello'], 'b.txt', { type: 'text/plain' });

describe('FileDrop', () => {
  it('背后是真的 input[type=file]，可以 Tab 聚焦，标题就是它的名称', async () => {
    render(<FileDrop title="上传头像" hint="PNG，不超过 2MB" accept="image/*" />);
    const input = screen.getByLabelText(/上传头像/) as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.type).toBe('file');
    expect(input).toHaveAttribute('accept', 'image/*');
    await userEvent.tab();
    expect(input).toHaveFocus();
  });

  it('通过文件选择框选文件：回调文件数组并播报', async () => {
    const onChange = vi.fn();
    render(<FileDrop title="上传" multiple onChange={onChange} />);
    await userEvent.upload(screen.getByLabelText(/上传/), [png, txt]);
    expect(onChange).toHaveBeenCalledWith([png, txt]);
    expect(screen.getByText('已选择 2 个文件')).toHaveAttribute('aria-live', 'polite');
  });

  it('拖入文件：悬停时标 data-dragging，松手后按 accept / maxSize 分流', () => {
    const onChange = vi.fn();
    const onReject = vi.fn();
    const { container } = render(<FileDrop title="上传" accept=".png" multiple onChange={onChange} onReject={onReject} />);
    const zone = container.querySelector('.ok-filedrop')!;
    const dataTransfer = { types: ['Files'], files: [png, txt] };
    fireEvent.dragEnter(zone, { dataTransfer });
    expect(zone).toHaveAttribute('data-dragging');
    fireEvent.drop(zone, { dataTransfer });
    expect(zone).not.toHaveAttribute('data-dragging');
    expect(onChange).toHaveBeenCalledWith([png]);
    expect(onReject).toHaveBeenCalledWith([txt]);
  });

  it('单选时只收第一个；禁用时不收', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<FileDrop title="上传" onChange={onChange} />);
    const zone = container.querySelector('.ok-filedrop')!;
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [png, txt] } });
    expect(onChange).toHaveBeenLastCalledWith([png]);
    onChange.mockClear();
    rerender(<FileDrop title="上传" onChange={onChange} disabled />);
    expect(screen.getByLabelText(/上传/)).toBeDisabled();
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [png] } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
