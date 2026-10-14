import { forwardRef, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, HTMLAttributes, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Icon, clamp, cx, hexToHsv, hsvToHex, normalizeHex, useControllable, useEvent, useLocale } from '../core';
import type { HSV } from '../core';
import { ColorSwatches } from './ColorSwatches';
import { Input } from './Input';
import { FieldContext, useFieldControl } from './fieldContext';
import { dragSession } from './internal';

export interface ColorPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** '#rrggbb'（受控） */
  value?: string;
  /** 非受控初始值，默认 '#ff6b8e' */
  defaultValue?: string;
  /** 拖动中连续触发，输出小写 #rrggbb */
  onChange?: (hex: string) => void;
  /** 一次操作结束：松开指针、键盘调整、输入框提交、点色板、屏幕取色 */
  onChangeEnd?: (hex: string) => void;
  /** 可选的预设色板，显示在下方 */
  swatches?: string[];
  disabled?: boolean;
  /** 整组的名称，默认“颜色”（放进 Field 时取 Field 的标签） */
  'aria-label'?: string;
}

const DEFAULT_HEX = '#ff6b8e';

/** 浏览器的屏幕取色（Chromium 系才有） */
interface EyeDropperCtor { new (): { open: () => Promise<{ sRGBHex: string }> } }

/** 特性检测不订阅任何变化：预渲染和注水的第一帧都按“没有”渲染，注水后再换成真实值，两边标记一致 */
const noSubscribe = () => () => {};
const hasEyeDropper = () => 'EyeDropper' in window;
const noEyeDropper = () => false;

/** 由十六进制推出 HSV；灰色（饱和度 0）和黑色（亮度 0）推不出色相，沿用上一次的，黑色连饱和度也沿用 */
function deriveHsv(hex: string, prev: HSV): HSV {
  const next = hexToHsv(hex);
  if (!next) return prev;
  if (next.v === 0) return { h: prev.h, s: prev.s, v: 0 };
  if (next.s === 0) return { h: prev.h, s: 0, v: next.v };
  return next;
}

const pct = (n: number) => Math.round(n * 100);

/**
 * 取色面板（内联，不自带浮层；需要弹出时放进 Popover）。
 * 上面是饱和度 × 亮度的二维滑块，下面是色相条（原生 range 换肤）、十六进制输入框、屏幕取色按钮和可选的预设色板。
 * 内部按 HSV 记状态：饱和度或亮度拖到 0 时色相不会丢。
 */
export const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(function ColorPicker(
  {
    value, defaultValue = DEFAULT_HEX, onChange, onChangeEnd, swatches, disabled: disabledProp,
    className, style, id, 'aria-label': ariaLabel, 'aria-labelledby': labelledByProp, 'aria-describedby': describedByProp, ...rest
  }, ref,
) {
  const field = useFieldControl({ id, disabled: disabledProp, 'aria-describedby': describedByProp, 'aria-labelledby': labelledByProp, 'aria-label': ariaLabel }, false);
  const { messages: t } = useLocale();
  const disabled = field.disabled;
  const [current, setCurrent] = useControllable(value, normalizeHex(defaultValue) ?? DEFAULT_HEX, onChange);
  const hex = normalizeHex(current) ?? DEFAULT_HEX;

  // HSV 和它对应的十六进制成对记着：外面给的值变了（不是自己刚算出来的）才从十六进制重新推，
  // 这样色相、以及灰色时的饱和度都不会被来回换算抹掉
  const [sync, setSync] = useState(() => ({ hex, hsv: deriveHsv(hex, { h: 0, s: 0, v: 0 }) }));
  let hsv = sync.hsv;
  if (sync.hex !== hex) {
    hsv = deriveHsv(hex, sync.hsv);
    setSync({ hex, hsv });   // 渲染期间按新的 props 校正状态（React 会立刻用新状态重渲这一次）
  }

  const latest = useRef({ hex, hsv });
  latest.current = { hex, hsv };
  const apply = useEvent((next: HSV) => {
    const h = hsvToHex(next);
    latest.current = { hex: h, hsv: next };
    setSync({ hex: h, hsv: next });
    setCurrent(h);
  });
  const applyHex = useEvent((h: string) => apply(deriveHsv(h, latest.current.hsv)));
  const end = useEvent(() => onChangeEnd?.(latest.current.hex));

  /* —— 饱和度 × 亮度 —— */
  const area = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  const handleAreaPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const node = area.current;
    if (e.button || disabled || !node) return;
    stopDrag.current?.();   // 上一次拖动如果没有正常收尾，先清掉
    node.focus({ preventScroll: true });
    setActive(true);
    const fromPointer = (x: number, y: number) => {
      const r = node.getBoundingClientRect();
      const s = clamp((x - r.left) / (r.width || 1), 0, 1);
      const v = 1 - clamp((y - r.top) / (r.height || 1), 0, 1);
      apply({ h: latest.current.hsv.h, s, v });
    };
    fromPointer(e.clientX, e.clientY);
    stopDrag.current = dragSession(node, e, (ev) => fromPointer(ev.clientX, ev.clientY), () => {
      stopDrag.current = null;
      setActive(false);
      end();
    });
  };

  // ←/→ 饱和度、↑/↓ 亮度，一步 1%，按住 Shift 一步 10%；PageUp / PageDown 亮度 ±10%；Home / End 饱和度到两端
  const handleAreaKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const { h, s, v } = latest.current.hsv;
    const d = e.shiftKey ? 10 : 1;
    const step = (x: number, by: number) => clamp(Math.round(x * 100 + by) / 100, 0, 1);
    let next: HSV;
    switch (e.key) {
      case 'ArrowLeft': next = { h, s: step(s, -d), v }; break;
      case 'ArrowRight': next = { h, s: step(s, d), v }; break;
      case 'ArrowUp': next = { h, s, v: step(v, d) }; break;
      case 'ArrowDown': next = { h, s, v: step(v, -d) }; break;
      case 'PageUp': next = { h, s, v: step(v, 10) }; break;
      case 'PageDown': next = { h, s, v: step(v, -10) }; break;
      case 'Home': next = { h, s: 0, v }; break;
      case 'End': next = { h, s: 1, v }; break;
      default: return;
    }
    e.preventDefault();
    apply(next);
    end();
  };

  /* —— 色相：原生 range，键盘和拖动都交给浏览器；松手 / 每次按键后的原生 change 事件算“一次操作结束” —— */
  const hue = useRef<HTMLInputElement>(null);
  const applyHue = useEvent((h: number) => { if (h !== Math.round(latest.current.hsv.h)) apply({ ...latest.current.hsv, h }); });
  useEffect(() => {
    const node = hue.current;
    if (!node) return;
    // 原生监听先于 React 的 onChange 执行：先按这次的值更新一遍（同值不会重复触发 onChange），再收尾
    const onNativeChange = () => { applyHue(Number(node.value)); end(); };
    node.addEventListener('change', onNativeChange);
    return () => node.removeEventListener('change', onNativeChange);
  }, [applyHue, end]);

  /* —— 十六进制：失焦或回车时校验，不合法就恢复成当前值；Esc 放弃这次编辑 —— */
  const [draft, setDraft] = useState<string | null>(null);
  const commitDraft = () => {
    if (draft === null) return;
    setDraft(null);
    const next = normalizeHex(draft);
    if (!next || next === latest.current.hex) return;
    applyHex(next);
    end();
  };

  /* —— 屏幕取色 —— */
  const canPick = useSyncExternalStore(noSubscribe, hasEyeDropper, noEyeDropper);
  const pickFromScreen = async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) return;
    try {
      const { sRGBHex } = await new Ctor().open();
      const next = normalizeHex(sRGBHex);
      if (!next) return;
      applyHex(next);
      end();
    } catch { /* 用户按 Esc 取消了 */ }
  };

  const swatchItems = swatches?.map((c) => { const n = normalizeHex(c) ?? c; return { value: n, color: c, label: n }; });

  return (
    <div
      ref={ref}
      id={field.id}
      role="group"
      className={cx('ok-color-picker', className)}
      style={{ '--h': hsv.h, '--c': hex, ...style } as CSSProperties}
      aria-label={ariaLabel ?? (field.labelledBy ? undefined : t.colorPicker.label)}
      aria-labelledby={field.labelledBy}
      aria-describedby={field.describedBy}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? '' : undefined}
      {...rest}
    >
      <div
        ref={area}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        className="ok-color-picker__area ok-focusable"
        style={{ '--s': hsv.s, '--v': hsv.v } as CSSProperties}
        aria-label={t.colorPicker.area}
        aria-roledescription={t.colorPicker.areaRole}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct(hsv.s)}
        aria-valuetext={t.colorPicker.areaValue(pct(hsv.s), pct(hsv.v))}
        aria-disabled={disabled || undefined}
        data-active={active ? '' : undefined}
        onPointerDown={handleAreaPointerDown}
        onKeyDown={handleAreaKey}
      >
        <span className="ok-color-picker__thumb" />
      </div>

      <input
        ref={hue}
        type="range"
        className="ok-color-picker__hue ok-focusable"
        min={0}
        max={360}
        step={1}
        value={Math.round(hsv.h)}
        aria-label={t.colorPicker.hue}
        aria-valuetext={`${Math.round(hsv.h)}°`}
        disabled={disabled}
        onChange={(e) => applyHue(Number(e.target.value))}
      />

      {/* 里面的输入框和色板是面板的零件，不接 Field 的 id / 描述（那些给整组） */}
      <FieldContext.Provider value={null}>
        <div className="ok-color-picker__row">
          <Input
            size="sm"
            className="ok-color-picker__hex"
            aria-label={t.colorPicker.hex}
            prefix={<span className="ok-color-picker__chip" />}
            value={draft ?? hex}
            onChange={setDraft}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitDraft(); }
              else if (e.key === 'Escape' && draft !== null) setDraft(null);
            }}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            disabled={disabled}
          />
          {canPick && (
            <button
              type="button"
              className="ok-btn ok-btn--ghost ok-btn--sm ok-btn--icon ok-focusable"
              aria-label={t.colorPicker.eyedropper}
              title={t.colorPicker.eyedropper}
              disabled={disabled}
              onClick={pickFromScreen}
            >
              <Icon><path d="M13.6 3.4a2 2 0 0 1 2.9 2.9l-1.7 1.7.9.9-1.4 1.4-4.2-4.2 1.4-1.4.9.9zM10.6 7.4l-6 6a1.5 1.5 0 0 0-.4.8l-.4 2.4 2.4-.4a1.5 1.5 0 0 0 .8-.4l6-6" /></Icon>
            </button>
          )}
        </div>
        {swatchItems && swatchItems.length > 0 && (
          <ColorSwatches
            size="sm"
            className="ok-color-picker__swatches"
            aria-label={t.colorPicker.swatches}
            colors={swatchItems}
            value={swatchItems.some((c) => c.value === hex) ? hex : null}
            onChange={(v) => { const n = normalizeHex(v); if (n) { applyHex(n); end(); } }}
            disabled={disabled}
          />
        )}
      </FieldContext.Provider>
    </div>
  );
});
