import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip, ChipGroup } from './Chip';

describe('Chip', () => {
  it('可选中：是带 aria-pressed 的按钮，非受控点击切换', async () => {
    const onChange = vi.fn();
    render(<Chip defaultSelected={false} onChange={onChange}>设计</Chip>);
    const chip = screen.getByRole('button', { name: '设计' });
    expect(chip).toHaveClass('ok-chip');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(onChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard(' ');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('受控：不改 props 就不变', async () => {
    const onChange = vi.fn();
    render(<Chip selected onChange={onChange}>设计</Chip>);
    await userEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('可移除：本体不是按钮，移除按钮带上标签名，点击后回调', async () => {
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>光标</Chip>);
    expect(screen.getByText('光标').closest('.ok-chip')!.tagName).toBe('SPAN');
    await userEvent.click(screen.getByRole('button', { name: '移除 光标' }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
  });
});

describe('ChipGroup', () => {
  it('多选（默认）：回调选中的 value 列表', async () => {
    const onChange = vi.fn();
    render(
      <ChipGroup aria-label="方向" defaultValue={['a']} onChange={onChange}>
        <Chip value="a">设计</Chip><Chip value="b">动效</Chip>
      </ChipGroup>,
    );
    expect(screen.getByRole('group', { name: '方向' })).toHaveClass('ok-chips');
    expect(screen.getByRole('button', { name: '设计' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: '动效' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('单选：选中一个会取消其它；受控', async () => {
    function Demo() {
      const [v, setV] = useState(['a']);
      return <ChipGroup aria-label="方向" multiple={false} value={v} onChange={setV}><Chip value="a">设计</Chip><Chip value="b">动效</Chip></ChipGroup>;
    }
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: '动效' }));
    expect(screen.getByRole('button', { name: '设计' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '动效' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('可移除的标签：移除后从列表消失', async () => {
    function Demo() {
      const [tags, setTags] = useState(['光标', '尾巴']);
      return <ChipGroup aria-label="标签">{tags.map((t) => <Chip key={t} onRemove={() => setTags(tags.filter((x) => x !== t))}>{t}</Chip>)}</ChipGroup>;
    }
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: '移除 光标' }));
    await waitFor(() => expect(screen.queryByText('光标')).toBeNull());
    expect(screen.getByText('尾巴')).toBeInTheDocument();
  });
});

describe('ChipGroup 的补位动画（FLIP）', () => {
  // jsdom 没有布局：按标签在父元素里的序号排成一行（每格 70px），再减去「页面滚动」；
  // 还在播的补位动画按它的起点位移算进视觉位置，模拟 getBoundingClientRect 读到的带 transform 的结果
  let scrollY = 0;
  type Rec = { el: Element; keyframes: Keyframe[]; options: KeyframeAnimationOptions; anim: { id: string; cancelled: boolean; cancel: () => void } };
  let calls: Rec[] = [];
  const offsetOf = (t: unknown) => {
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(String(t));
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
  };
  const flips = () => calls.filter((c) => offsetOf(c.keyframes[0]?.transform));
  const flipOf = (text: string) => flips().filter((c) => c.el.textContent?.includes(text));

  beforeEach(() => {
    scrollY = 0;
    calls = [];
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (!this.classList.contains('ok-chip')) return new DOMRect(0, 0, 0, 0);
      const i = Array.from(this.parentElement!.children).indexOf(this);
      let x = 10 + i * 70;
      let y = 300 - scrollY;
      for (const c of calls) {
        const o = offsetOf(c.keyframes[0]?.transform);
        if (c.el === this && o && !c.anim.cancelled) { x += o[0]; y += o[1]; }
      }
      return new DOMRect(x, y, 60, 32);
    });
    vi.spyOn(Element.prototype, 'animate').mockImplementation(function (this: Element, keyframes, options) {
      const anim = { id: (options as KeyframeAnimationOptions)?.id ?? '', cancelled: false, cancel() { anim.cancelled = true; }, finished: Promise.resolve() };
      calls.push({ el: this, keyframes: keyframes as Keyframe[], options: options as KeyframeAnimationOptions, anim });
      return anim as unknown as Animation;
    });
    (Element.prototype as unknown as { getAnimations: () => unknown[] }).getAnimations = function (this: Element) {
      return calls.filter((c) => c.el === this && !c.anim.cancelled).map((c) => c.anim);
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (Element.prototype as unknown as { getAnimations?: unknown }).getAnimations;
  });

  function Demo({ initial }: { initial: string[] }) {
    const [tags, setTags] = useState(initial);
    return <ChipGroup aria-label="标签">{tags.map((t) => <Chip key={t} onRemove={() => setTags((l) => l.filter((x) => x !== t))}>{t}</Chip>)}</ChipGroup>;
  }

  it('页面滚动后再删除：位移只等于布局变化，不带滚动距离，也不翻倍', async () => {
    render(<Demo initial={['甲', '乙', '丙']} />);
    scrollY = 200; // 渲染之后页面滚动了 200px
    await userEvent.click(screen.getByRole('button', { name: '移除 乙' }));
    await waitFor(() => expect(screen.queryByText('乙')).toBeNull());
    const f = flipOf('丙');
    expect(f).toHaveLength(1);
    expect(f[0].keyframes[0].transform).toBe('translate(70px, 0px)');
    expect(f[0].keyframes[1].transform).toBe('none');
    // 前面的「甲」没动，不播
    expect(flipOf('甲')).toHaveLength(0);
  });

  it('上一段补位还在播时再删除：先取消旧的，从当前视觉位置出发', async () => {
    render(<Demo initial={['甲', '乙', '丙', '丁']} />);
    await userEvent.click(screen.getByRole('button', { name: '移除 乙' }));
    await waitFor(() => expect(screen.queryByText('乙')).toBeNull());
    const first = flipOf('丁');
    expect(first).toHaveLength(1);
    expect(first[0].keyframes[0].transform).toBe('translate(70px, 0px)');
    // 丁的第一段补位刚开始（视觉上还在原第 4 格），马上再删「丙」
    scrollY = 120;
    await userEvent.click(screen.getByRole('button', { name: '移除 丙' }));
    await waitFor(() => expect(screen.queryByText('丙')).toBeNull());
    expect(first[0].anim.cancelled).toBe(true);
    const second = flipOf('丁');
    expect(second).toHaveLength(2);
    // 视觉位置第 4 格（220）→ 新布局第 2 格（80）
    expect(second[1].keyframes[0].transform).toBe('translate(140px, 0px)');
  });
});
