import { forwardRef, useId, useRef } from 'react';
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cx, Icon, useControllable } from '../core';

export interface AccordionItem {
  value: string;
  title: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface AccordionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  items: AccordionItem[];
  /** single：同时只展开一项；multiple（默认）：互不影响 */
  type?: 'single' | 'multiple';
  /** 展开的项（value 数组）；single 时最多一个 */
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  /** single 时是否允许把唯一展开的一项收起，默认允许 */
  collapsible?: boolean;
  /** 标题的层级，默认 h3 */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** group（默认）：带卡片底的分组（.ok-group）；plain：没有底、左右不内缩，嵌在 Card 等已有内边距的容器里用 */
  variant?: 'group' | 'plain';
}

/** 折叠面板：高度用无过冲的 soft 弹簧展开，箭头转 90°，内容稍后淡入 */
export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(function Accordion(
  { items, type = 'multiple', value, defaultValue, onChange, collapsible = true, headingLevel = 3, variant = 'group', className, ...rest }, ref,
) {
  const uid = useId();
  const [open, setOpen] = useControllable<string[]>(value, defaultValue ?? [], onChange);
  const heads = useRef<Array<HTMLButtonElement | null>>([]);
  const Heading = `h${headingLevel}` as 'h3';

  const toggle = (v: string) => {
    const on = open.includes(v);
    if (type === 'single') {
      if (on) { if (collapsible) setOpen([]); }
      else setOpen([v]);
    } else setOpen(on ? open.filter((x) => x !== v) : [...open, v]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = heads.current.filter((n): n is HTMLButtonElement => !!n && !n.disabled);
    const at = list.indexOf(e.target as HTMLButtonElement);
    if (at < 0) return;
    let next: number;
    if (e.key === 'ArrowDown') next = (at + 1) % list.length;
    else if (e.key === 'ArrowUp') next = (at - 1 + list.length) % list.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = list.length - 1;
    else return;
    e.preventDefault();
    list[next].focus();
  };

  return (
    <div ref={ref} className={cx('ok-accordion', variant === 'group' ? 'ok-group' : 'ok-accordion--plain', className)} onKeyDown={onKeyDown} {...rest}>
      {items.map((it, i) => {
        const on = open.includes(it.value);
        const locked = type === 'single' && on && !collapsible;
        return (
          <div key={it.value} className="ok-accordion__item" data-state={on ? 'open' : 'closed'}>
            <Heading className="ok-accordion__heading">
              <button
                ref={(n) => { heads.current[i] = n; }}
                type="button"
                id={`${uid}-head-${i}`}
                className="ok-accordion__head ok-focusable"
                aria-expanded={on}
                aria-controls={`${uid}-body-${i}`}
                aria-disabled={locked || undefined}
                disabled={it.disabled}
                onClick={() => toggle(it.value)}
              >
                <span className="ok-accordion__title">{it.title}</span>
                <Icon name="chevron-right" />
              </button>
            </Heading>
            <div className="ok-accordion__body" id={`${uid}-body-${i}`} role="region" aria-labelledby={`${uid}-head-${i}`}>
              <div><div className="ok-accordion__content">{it.content}</div></div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
