import { forwardRef, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, InputHTMLAttributes, ReactNode } from 'react';
import { Icon, cx, mergeRefs, useLocale } from '../core';
import { useFieldControl } from './fieldContext';

export interface FileDropProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'value' | 'defaultValue' | 'onChange' | 'title'> {
  /** 选了或拖入了文件：参数是通过筛选的文件列表 */
  onChange?: (files: File[]) => void;
  /** 被 accept / maxSize 挡下的文件 */
  onReject?: (files: File[]) => void;
  /** 单个文件的大小上限（字节） */
  maxSize?: number;
  /** 主文案 */
  title?: ReactNode;
  /** 副文案（格式、大小限制等） */
  hint?: ReactNode;
  /** 自定义图标 */
  icon?: ReactNode;
  invalid?: boolean;
  rootClassName?: string;
  rootStyle?: CSSProperties;
}

/** 按 accept（扩展名、MIME、image/* 这类通配）判断文件是否合格 */
function accepts(file: File, accept?: string): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return accept.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/**
 * 拖拽上传区。背后是一个铺满整块的真 input[type=file]：点击、Tab 聚焦后按空格 / Enter 都由浏览器打开文件选择框。
 * 组件只负责收文件，不上传；已选文件的列表请自行展示（这里只给一行播报）。
 * ref 和其余原生属性落在 <input> 上；className / style 落在外层 <label> 上。没有可见标题时请给 aria-label。
 */
export const FileDrop = forwardRef<HTMLInputElement, FileDropProps>(function FileDrop(
  {
    onChange, onReject, maxSize, title: titleProp, hint, icon, invalid: invalidProp, accept, multiple, children,
    className, style, rootClassName, rootStyle, id, disabled: disabledProp, required: requiredProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, required: requiredProp, invalid: invalidProp, 'aria-describedby': describedByProp });
  const { messages: t } = useLocale();
  const title = titleProp === undefined ? t.fileDrop.title : titleProp;
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('');
  const inner = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  const take = (list: FileList | File[] | null) => {
    let files = Array.from(list ?? []);
    if (!files.length) return;
    const ok = files.filter((f) => accepts(f, accept) && (maxSize == null || f.size <= maxSize));
    const bad = files.filter((f) => !ok.includes(f));
    files = multiple ? ok : ok.slice(0, 1);
    if (bad.length) onReject?.(bad);
    if (files.length) onChange?.(files);
    setStatus(t.fileDrop.status(files.length, files[0]?.name ?? '', bad.length));
  };

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const drag = {
    onDragEnter: (e: DragEvent) => { if (field.disabled || !hasFiles(e)) return; e.preventDefault(); depth.current++; setDragging(true); },
    onDragOver: (e: DragEvent) => { if (field.disabled || !hasFiles(e)) return; e.preventDefault(); },
    onDragLeave: () => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); },
    onDrop: (e: DragEvent) => {
      depth.current = 0;
      setDragging(false);
      if (field.disabled || !hasFiles(e)) return;
      e.preventDefault();
      take(e.dataTransfer.files);
    },
  };

  return (
    <label
      className={cx('ok-filedrop', rootClassName, className)}
      style={{ ...rootStyle, ...style }}
      data-dragging={dragging ? '' : undefined}
      data-invalid={field.invalid ? '' : undefined}
      data-disabled={field.disabled ? '' : undefined}
      {...drag}
    >
      <input
        {...rest}
        ref={mergeRefs(ref, inner)}
        id={field.id}
        className="ok-filedrop__input"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={field.disabled}
        required={field.required || undefined}
        aria-invalid={field.invalid || undefined}
        aria-describedby={field.describedBy}
        onChange={(e) => { take(e.target.files); e.target.value = ''; }}
      />
      <span className="ok-filedrop__body">
        {icon ?? <Icon name="upload" className="ok-filedrop__icon" />}
        <span className="ok-filedrop__title">{title}</span>
        {hint != null && <span className="ok-filedrop__hint">{hint}</span>}
        {children}
        <span className="ok-filedrop__status" aria-live="polite">{status}</span>
      </span>
    </label>
  );
});
