import { forwardRef, useEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cx, Icon, useLocale } from '../core';

export type CodeProps = HTMLAttributes<HTMLElement>;

/** 行内代码 */
export const Code = forwardRef<HTMLElement, CodeProps>(function Code({ className, ...rest }, ref) {
  return <code ref={ref} className={cx('ok-code', className)} {...rest} />;
});

export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title' | 'onCopy'> {
  /** 代码文本；也可以写在 children 里 */
  code?: string;
  children?: string;
  /** 语言名，显示在左上角，并写到 <code> 的 language-* 类名上 */
  language?: string;
  /** 标题（文件名等），显示在语言前面 */
  title?: ReactNode;
  /** 显示复制按钮，默认显示 */
  copyable?: boolean;
  /** 长行自动换行。默认不换行，横向滚动 */
  wrap?: boolean;
  /** 最大高度，超出后纵向滚动 */
  maxHeight?: number | string;
  /** 代码区域的名字（给读屏），默认取 title / language / “代码” */
  label?: string;
  onCopy?: (code: string) => void;
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  // 没有异步剪贴板（非安全上下文）时退回选中 + execCommand
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
}

/** 代码块：等宽、可横向滚动（原生滚动 + .ok-scroll 外观），右上角复制按钮，复制结果用 aria-live 播报 */
export const CodeBlock = forwardRef<HTMLDivElement, CodeBlockProps>(function CodeBlock(
  { code, children, language, title, copyable = true, wrap, maxHeight, label, onCopy, className, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const text = code ?? children ?? '';
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    let next: 'copied' | 'failed' = 'copied';
    try { await writeClipboard(text); onCopy?.(text); } catch { next = 'failed'; }
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  const hasHead = title != null || !!language;
  const name = label ?? (typeof title === 'string' ? title : undefined) ?? language ?? t.code.label;
  return (
    <div ref={ref} className={cx('ok-codeblock', className)} data-head={hasHead ? '' : undefined} {...rest}>
      {(hasHead || copyable) && (
        <div className="ok-codeblock__head">
          {title != null && <span className="ok-codeblock__title">{title}</span>}
          {language && <span className="ok-codeblock__lang">{language}</span>}
          {copyable && (
            <button type="button" className="ok-btn ok-btn--sm ok-btn--ghost ok-btn--icon ok-focusable ok-codeblock__copy" aria-label={t.code.copy} data-state={state} onClick={copy}>
              <Icon name={state === 'copied' ? 'check' : state === 'failed' ? 'x' : 'copy'} />
            </button>
          )}
        </div>
      )}
      <pre
        className="ok-codeblock__pre ok-scroll"
        tabIndex={0}
        role="group"
        aria-label={name}
        data-wrap={wrap ? '' : undefined}
        style={maxHeight != null ? ({ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight } as CSSProperties) : undefined}
      >
        <code className={language ? `language-${language}` : undefined}>{text}</code>
      </pre>
      <span className="ok-sr" role="status" aria-live="polite">{state === 'copied' ? t.code.copied : state === 'failed' ? t.code.copyFailed : ''}</span>
    </div>
  );
});
