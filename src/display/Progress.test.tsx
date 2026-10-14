import { render, screen } from '@testing-library/react';
import { Progress, ProgressRing } from './Progress';

describe('Progress', () => {
  it('确定进度：progressbar 带数值，--v 是 0–1 的比例', () => {
    render(<Progress value={30} label="上传进度" />);
    const bar = screen.getByRole('progressbar', { name: '上传进度' });
    expect(bar).toHaveAttribute('aria-valuenow', '30');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar.style.getPropertyValue('--v')).toBe('0.3');
    expect(bar).not.toHaveAttribute('data-done');
  });
  it('到 100% 标记完成；超出范围会被夹住', () => {
    render(<Progress value={150} max={120} label="进度" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '120');
    expect(bar).toHaveAttribute('data-done');
  });
  it('不确定进度：没有 aria-valuenow', () => {
    render(<Progress label="处理中" />);
    const bar = screen.getByRole('progressbar', { name: '处理中' });
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar).toHaveClass('ok-progress--indeterminate');
  });
});

describe('ProgressRing', () => {
  it('progressbar 语义，中间显示百分比', () => {
    render(<ProgressRing value={42} label="上传" />);
    const ring = screen.getByRole('progressbar', { name: '上传' });
    expect(ring).toHaveAttribute('aria-valuenow', '42');
    expect(ring).toHaveClass('ok-ring');
    expect(ring.style.getPropertyValue('--v')).toBe('0.42');
    expect(ring.querySelector('.ok-ring__label')).toHaveTextContent('42');
  });
  it('size 和自定义内容', () => {
    render(<ProgressRing value={5} max={5} size="sm" label="完成">好</ProgressRing>);
    const ring = screen.getByRole('progressbar');
    expect(ring.style.getPropertyValue('--size')).toBe('40px');
    expect(ring).toHaveAttribute('data-done');
    expect(ring).toHaveTextContent('好');
  });
});
