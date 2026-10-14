import { forwardRef, useId } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../core';
import type { HeadingLevel } from './PageHeader';
import { layoutVars } from './responsive';
import type { Responsive, Space } from './responsive';

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** 区块标题；有标题时 <section> 自动用它命名（aria-labelledby） */
  title?: ReactNode;
  /** 标题下面的说明 */
  description?: ReactNode;
  /** 标题右侧的操作 */
  actions?: ReactNode;
  /** 标题的级别，默认 2 */
  headingLevel?: HeadingLevel;
  /** 标题与内容、内容与内容之间的间距（间距档位），默认 4 */
  gap?: Responsive<Space>;
}

/** 带标题的内容区 */
export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  { title, description, actions, headingLevel = 2, gap, className, style, children, ...rest },
  ref,
) {
  const id = useId();
  const Heading = `h${headingLevel}` as 'h2';
  const hasTitle = title !== undefined && title !== null && title !== false;
  const labelled = rest['aria-labelledby'] ?? (hasTitle && !rest['aria-label'] ? id : undefined);
  return (
    <section ref={ref} className={cx('ok-l ok-section', className)} style={layoutVars({ gap }, style)} {...rest} aria-labelledby={labelled}>
      {hasTitle || actions ? (
        <div className="ok-section__head">
          <div className="ok-section__text">
            {hasTitle ? <Heading id={id} className="ok-section__title">{title}</Heading> : null}
            {description ? <p className="ok-section__desc">{description}</p> : null}
          </div>
          {actions ? <div className="ok-section__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
});
