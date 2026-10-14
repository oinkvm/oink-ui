import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import type { HTMLAttributes, KeyboardEvent } from 'react';
import { VisuallyHidden, animate, cx, mergeRefs, useControllable, useLocale } from '../core';
import { useFieldControl } from './fieldContext';
import { keyName, keySymbol } from './Kbd';

const MODS = ['Control', 'Alt', 'Shift', 'Meta'] as const;
const heldMods = (e: KeyboardEvent) => MODS.filter((m) => ({ Control: e.ctrlKey, Alt: e.altKey, Shift: e.shiftKey, Meta: e.metaKey })[m]);

export interface HotkeyProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** 组合键，用 + 连接，如 "Meta+Shift+K"；空字符串表示未设置 */
  value?: string;
  defaultValue?: string;
  /** 第一个参数是新的组合键字符串，第二个是拆开的按键数组 */
  onChange?: (value: string, keys: string[]) => void;
  /** 未设置时的提示 */
  placeholder?: string;
  /** 录制中的提示 */
  recordingText?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

/** 键帽：新出现时弹入 */
function Cap({ k, index }: { k: string; index: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    animate(ref.current, [{ transform: 'scale(.3) translateY(8px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { spring: 'bouncy', delay: index * 45 });
    // 只在挂载时播一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <kbd ref={ref} className="ok-kbd" data-key={k}>{keySymbol(k)}</kbd>;
}

/**
 * 快捷键录制器。点击或按 Enter / 空格开始录制，直接按下组合键；修饰键按下即显示；Esc、Tab 或失焦取消。
 * 录制期间会拦下按键（包括 Esc），不会冒泡到外层浮层。
 */
export const Hotkey = forwardRef<HTMLDivElement, HotkeyProps>(function Hotkey(
  {
    value, defaultValue = '', onChange, placeholder: placeholderProp, recordingText: recordingTextProp, size = 'md', disabled: disabledProp, className, id,
    onClick, onKeyDown, onKeyUp, onBlur, onPointerDown, 'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel }, false);
  const { messages: t } = useLocale();
  const placeholder = placeholderProp ?? t.hotkey.placeholder;
  const recordingText = recordingTextProp ?? t.hotkey.recording;
  const [current, setCurrent] = useControllable(value, defaultValue, (v: string) => onChange?.(v, v.split('+').filter(Boolean)));
  const keys = current.split('+').filter(Boolean);
  const [recording, setRecording] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [pointer, setPointer] = useState(false);
  const inner = useRef<HTMLDivElement>(null);
  const statusId = `ok-hotkey-${useId()}`;

  const start = () => { if (!recording && !field.disabled) { setRecording(true); setMods([]); } };
  const stop = () => { setRecording(false); setMods([]); };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (field.disabled) return;
    if (!recording) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); }
      return;
    }
    if (e.key === 'Tab') { stop(); return; }
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation?.();
    if (e.key === 'Escape') { stop(); return; }
    const held = heldMods(e);
    if ((MODS as readonly string[]).includes(e.key)) { setMods(held); return; }
    const code = e.code || '';
    let key = code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code === 'Space' ? 'Space' : e.key;
    if (key.length === 1) key = key.toUpperCase();
    stop();
    setCurrent([...held, key].join('+'));
  };

  const shown = recording ? mods : keys;
  const hint = recording ? (mods.length ? '…' : recordingText) : keys.length ? '' : placeholder;
  const spoken = recording ? t.hotkey.spokenRecording(recordingText) : keys.length ? t.hotkey.spokenCurrent(keys.map((k) => keyName(k, t.keyNames)).join(' + ')) : t.hotkey.none;

  return (
    <div
      ref={mergeRefs(ref, inner)}
      id={field.id}
      role="button"
      tabIndex={field.disabled ? -1 : 0}
      className={cx('ok-hotkey ok-focusable', size !== 'md' && `ok-hotkey--${size}`, className)}
      aria-label={ariaLabel}
      aria-labelledby={field.labelledBy}
      aria-describedby={[field.describedBy, statusId].filter(Boolean).join(' ')}
      aria-disabled={field.disabled || undefined}
      aria-pressed={recording}
      data-recording={recording ? '' : undefined}
      data-pointer={pointer ? '' : undefined}
      onPointerDown={(e) => { onPointerDown?.(e); setPointer(true); }}   // 指针点开：失焦前不显示键盘焦点环
      onClick={(e) => { onClick?.(e); if (!e.defaultPrevented) start(); }}
      onKeyDown={handleKeyDown}
      onKeyUp={(e) => { onKeyUp?.(e); if (recording) setMods(heldMods(e)); }}
      onBlur={(e) => { onBlur?.(e); setPointer(false); if (recording) stop(); }}
      {...rest}
    >
      {shown.map((k, i) => <Cap key={k} k={k} index={i} />)}
      {hint && <span className="ok-hotkey__hint">{hint}</span>}
      <VisuallyHidden id={statusId} aria-live="polite">{spoken}</VisuallyHidden>
    </div>
  );
});
