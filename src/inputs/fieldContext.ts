import { createContext, useContext } from 'react';

/** Field 往下传给子控件的接线信息 */
export interface FieldContextValue {
  /** 控件 id（label 的 for 指向它） */
  id: string;
  /** 标签元素的 id，给不能用 label[for] 的复合控件（滑块、单选组等）走 aria-labelledby */
  labelId?: string;
  /** 提示 + 错误文字的 id，空格分隔 */
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldControlInput {
  id?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}

export interface FieldControlResult {
  id: string | undefined;
  disabled: boolean;
  required: boolean;
  invalid: boolean;
  describedBy: string | undefined;
  /** 仅复合控件（labelable: false）才会从 Field 取到 */
  labelledBy: string | undefined;
}

/**
 * 控件接入 Field：自己的属性优先，没传就用 Field 给的。
 * labelable = 根节点是 input / textarea 这类能被 label[for] 关联的元素。
 */
export function useFieldControl(own: FieldControlInput, labelable = true): FieldControlResult {
  const field = useContext(FieldContext);
  // 去重：用函数子节点把 Field 给的 aria-describedby 手动传进来、控件自己又从上下文里取了一遍时，同一个 id 只留一次
  const ids = `${own['aria-describedby'] ?? ''} ${field?.describedBy ?? ''}`.split(/\s+/).filter(Boolean);
  const describedBy = Array.from(new Set(ids)).join(' ') || undefined;
  return {
    id: own.id ?? field?.id,
    disabled: own.disabled ?? field?.disabled ?? false,
    required: own.required ?? field?.required ?? false,
    invalid: own.invalid ?? field?.invalid ?? false,
    describedBy,
    labelledBy: own['aria-labelledby'] ?? (!labelable && !own['aria-label'] ? field?.labelId : undefined),
  };
}
