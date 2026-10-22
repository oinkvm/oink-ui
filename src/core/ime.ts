import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

type KeyEvent = KeyboardEvent | ReactKeyboardEvent;

/** WebKit 先结束组字，再派发 isComposing=false、keyCode=229 的确认键。 */
export function isImeComposing(event: KeyEvent): boolean {
  const native = 'nativeEvent' in event ? event.nativeEvent : event;
  return native.isComposing || native.keyCode === 229;
}

/** 确认组字的回车不能触发组件快捷键、祖先处理器或表单的原生隐式提交。 */
export function guardImeEnter(event: KeyEvent): boolean {
  if (event.key !== 'Enter' || !isImeComposing(event)) return false;
  event.preventDefault();
  event.stopPropagation();
  return true;
}
