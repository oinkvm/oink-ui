import { forwardRef } from 'react';
import { useControllable, useLocale } from '../core';
import { Input } from './Input';
import type { InputProps } from './Input';

export interface SearchInputProps extends Omit<InputProps, 'type' | 'icon' | 'revealable'> {
  /** 按下 Enter 时触发 */
  onSearch?: (value: string) => void;
}

/** 搜索框：全圆、带放大镜和清除按钮。Enter 触发 onSearch，Esc 清空 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, defaultValue = '', onChange, onSearch, onKeyDown, pill = true, clearable = true, placeholder: placeholderProp, ...rest }, ref,
) {
  const { messages: t } = useLocale();
  const placeholder = placeholderProp ?? t.searchInput.placeholder;
  const [current, setCurrent] = useControllable(value, defaultValue, onChange);
  return (
    <Input
      ref={ref}
      type="search"
      icon="search"
      enterKeyHint="search"
      autoComplete="off"
      pill={pill}
      clearable={clearable}
      placeholder={placeholder}
      value={current}
      onChange={setCurrent}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === 'Enter') onSearch?.(current);
        else if (e.key === 'Escape' && current !== '') { e.preventDefault(); setCurrent(''); }
      }}
      {...rest}
    />
  );
});
