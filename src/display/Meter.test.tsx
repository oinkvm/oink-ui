import { render, screen } from '@testing-library/react';
import { Meter } from './Meter';

describe('Meter', () => {
  it('只读电平：role="meter"，按比例点亮分段', () => {
    render(<Meter value={68} label="音量" valueText="68%" />);
    const meter = screen.getByRole('meter', { name: '音量' });
    expect(meter).toHaveAttribute('aria-valuenow', '68');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(meter).toHaveAttribute('aria-valuetext', '68%');
    expect(meter).not.toHaveAttribute('tabindex');
    expect(meter.querySelectorAll('.ok-level__seg')).toHaveLength(10);
    expect(meter.querySelectorAll('.ok-level__seg[data-on]')).toHaveLength(7);
  });
  it('自定义范围、段数和警告 / 危险区', () => {
    render(<Meter value={5} min={0} max={5} segments={5} warnAt={3} dangerAt={4} label="信号" />);
    const segs = Array.from(screen.getByRole('meter').querySelectorAll('.ok-level__seg'));
    expect(segs.filter((s) => s.hasAttribute('data-on'))).toHaveLength(5);
    expect(segs.map((s) => s.getAttribute('data-zone'))).toEqual([null, null, null, 'warning', 'danger']);
  });
});
