import { createContext, forwardRef, useContext, useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import { cx, OINK_MESSAGES, Portal, TailGlyph, useControllable, useLocale, VisuallyHidden } from '../core';
import { CHECK_D, CROSS_D } from './internal';

export type ButtonVariant = 'primary' | 'accent' | 'soft' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
/** 按钮的过程状态：加载、成功、失败 */
export type ButtonStatus = 'loading' | 'success' | 'error';
/** 过程状态的播报文案（aria-live）。按场景覆盖成「正在保存」「已保存」「保存失败」这类 */
export type ButtonStatusLabels = Partial<Record<ButtonStatus, string>>;

/** 中文的默认播报文案（只为兼容保留；组件实际按 useLocale() 的语言取 messages.button.status） */
export const DEFAULT_STATUS_LABELS: Record<ButtonStatus, string> = OINK_MESSAGES['zh-CN'].button.status;

interface ButtonOwnProps {
  /** 变体，默认 soft（灰底） */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 加载中：文字上滑让位，尾巴加载器弹入；期间不响应点击 */
  loading?: boolean;
  /** 成功：描出对勾。通常在 loading 结束后短暂置为 true */
  success?: boolean;
  /** 失败：文字让位、描出叉号并横向抖一下（ok-shake）。通常在 loading 结束后短暂置为 true；期间仍可点击重试。
   *  加载 → 成功 / 失败 → 复原的整套流程见 useBusy() */
  error?: boolean;
  /**
   * 过程状态的读屏播报文案。只要传了 loading / success / error 任意一个，按钮旁就有一个 aria-live 区域
   * （渲染在 body 下，不影响布局和按钮自己的名称），状态切换时播报对应文案。
   * 默认「正在处理」「已完成」「操作失败」
   */
  statusLabels?: ButtonStatusLabels;
  /** 文字前的图标 */
  leading?: ReactNode;
  /** 文字后的图标 */
  trailing?: ReactNode;
  /** 撑满一行 */
  block?: boolean;
  disabled?: boolean;
  /** 传了 href 就渲染成 <a> */
  href?: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
  children?: ReactNode;
}

/** 图标按钮必须有可读名称 */
type IconOnlyProps =
  | { iconOnly?: false }
  | ({ iconOnly: true } & ({ 'aria-label': string } | { 'aria-labelledby': string }));

export type ButtonProps = ButtonOwnProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps> & IconOnlyProps;

interface GroupContextValue { size?: ButtonSize; variant?: ButtonVariant; disabled?: boolean }
const ButtonGroupContext = createContext<GroupContextValue>({});

/** 按钮。全圆胶囊；传 href 渲染成链接 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(props, ref) {
  const group = useContext(ButtonGroupContext);
  const {
    variant = group.variant ?? 'soft', size = group.size ?? 'md', loading, success, error, statusLabels, leading, trailing, block, iconOnly,
    disabled = group.disabled, href, target, rel, download, type = 'button', className, children, onClick,
    'aria-disabled': ariaDisabled, ...rest
  } = props as ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement> & { iconOnly?: boolean };

  const statusText = useLocale().messages.button.status;
  const softDisabled = ariaDisabled === true || ariaDisabled === 'true';
  const blocked = !!disabled || softDisabled;
  const state: ButtonStatus | undefined = loading ? 'loading' : success ? 'success' : error ? 'error' : undefined;
  const hasStatus = loading !== undefined || success !== undefined || error !== undefined;

  // 播报：进入某个状态时写入对应文案；回到常态时保留上一句（马上清空的话读屏可能来不及读）
  const [spoken, setSpoken] = useState('');
  const spokenText = state ? statusLabels?.[state] ?? statusText[state] : null;
  useEffect(() => { if (spokenText) setSpoken(spokenText); }, [spokenText]);

  const handleClick = (e: MouseEvent<HTMLElement>) => {
    // aria-disabled 的按钮仍然接收指针事件（好显示“禁止”光标），点击在这里拦下；加载、成功期间也不响应（失败态可以直接重试）
    if (blocked || state === 'loading' || state === 'success') { e.preventDefault(); e.stopPropagation(); return; }
    (onClick as ((ev: MouseEvent<HTMLElement>) => void) | undefined)?.(e);
  };

  const cls = cx(
    'ok-btn ok-focusable',
    variant !== 'soft' && `ok-btn--${variant}`,
    size !== 'md' && `ok-btn--${size}`,
    iconOnly && 'ok-btn--icon',
    block && 'ok-btn--block',
    className,
  );

  const content = (
    <>
      <span className="ok-btn__label">{leading}{children}{trailing}</span>
      {hasStatus && (
        <span className="ok-btn__status" aria-hidden="true">
          <TailGlyph className="ok-tail" />
          <svg className="ok-btn__check" viewBox="0 0 16 16"><path d={CHECK_D} pathLength={1} /></svg>
          <svg className="ok-btn__cross" viewBox="0 0 16 16"><path d={CROSS_D} pathLength={1} /></svg>
        </span>
      )}
    </>
  );
  // 播报区放在 body 下：放在按钮里会被算进按钮名称，且 aria-busy 期间读屏会压住它；放成兄弟节点又会打乱 ButtonGroup 的 :last-child
  const live = hasStatus && (
    <Portal><VisuallyHidden role="status" aria-live="polite" aria-atomic="true" data-ok-button-status="">{spoken}</VisuallyHidden></Portal>
  );

  if (href !== undefined) {
    return (
      <>
        <a
          {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
          ref={ref as Ref<HTMLAnchorElement>}
          className={cls}
          href={blocked ? undefined : href}
          target={target}
          rel={rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)}
          download={download}
          role={blocked ? 'link' : undefined}
          aria-disabled={blocked || undefined}
          aria-busy={loading || undefined}
          data-state={state}
          onClick={handleClick}
        >
          {content}
        </a>
        {live}
      </>
    );
  }

  return (
    <>
      <button
        {...rest}
        ref={ref as Ref<HTMLButtonElement>}
        type={type}
        className={cls}
        disabled={disabled}
        aria-disabled={softDisabled || undefined}
        aria-busy={loading || undefined}
        data-state={state}
        onClick={handleClick}
      >
        {content}
      </button>
      {live}
    </>
  );
});

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** 组内按钮的默认尺寸 */
  size?: ButtonSize;
  /** 组内按钮的默认变体 */
  variant?: ButtonVariant;
  /** 整组禁用 */
  disabled?: boolean;
  /** 连体：按钮贴在一起，中间的圆角收小 */
  attached?: boolean;
  orientation?: 'horizontal' | 'vertical';
  /** 撑满一行并平分宽度 */
  block?: boolean;
}

/** 按钮组：一组相关操作。记得给 aria-label */
export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(function ButtonGroup(
  { size, variant, disabled, attached, orientation = 'horizontal', block, className, children, ...rest }, ref,
) {
  return (
    <div
      ref={ref}
      role="group"
      className={cx('ok-btn-group', attached && 'ok-btn-group--attached', orientation === 'vertical' && 'ok-btn-group--vertical', block && 'ok-btn-group--block', className)}
      {...rest}
    >
      <ButtonGroupContext.Provider value={{ size, variant, disabled }}>{children}</ButtonGroupContext.Provider>
    </div>
  );
});

export type ToggleButtonProps = ButtonOwnProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps | 'onChange' | 'href'> & {
  iconOnly?: boolean;
  /** 是否按下（受控） */
  pressed?: boolean;
  defaultPressed?: boolean;
  onChange?: (pressed: boolean) => void;
};

/** 开关按钮：按下 / 弹起两个状态，用 aria-pressed 表达 */
export const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(function ToggleButton(
  { pressed, defaultPressed = false, onChange, onClick, ...rest }, ref,
) {
  const [on, setOn] = useControllable(pressed, defaultPressed, onChange);
  const props = {
    ...rest,
    'aria-pressed': on,
    onClick: (e: MouseEvent<HTMLButtonElement>) => { onClick?.(e); if (!e.defaultPrevented) setOn(!on); },
  } as ButtonProps;
  return <Button ref={ref as Ref<HTMLButtonElement | HTMLAnchorElement>} {...props} />;
});
