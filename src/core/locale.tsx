import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { enUS, zhCN } from './messages';
import type { Messages } from './messages';

export type { Messages } from './messages';

/** 组件内置文案和日期格式用的语言 */
export type OinkLocale = 'zh-CN' | 'en-US';

/** 各语言的内置文案 */
export const OINK_MESSAGES: Record<OinkLocale, Messages> = { 'zh-CN': zhCN, 'en-US': enUS };

const LocaleContext = createContext<OinkLocale>('zh-CN');

export interface LocaleProviderProps {
  /** 不传（undefined）时沿用外层的设置，最外层是 zh-CN */
  locale?: OinkLocale;
  children?: ReactNode;
}

/** 在这一块里切换组件内置文案的语言。可以嵌套，内层优先。OinkProvider 的 locale 就是包了一层它 */
export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const parent = useContext(LocaleContext);
  return <LocaleContext.Provider value={locale ?? parent}>{children}</LocaleContext.Provider>;
}

/** 当前语言和对应的内置文案。没有 Provider 时是 zh-CN；不认识的语言回退到 zh-CN */
export function useLocale(): { locale: OinkLocale; messages: Messages } {
  const locale = useContext(LocaleContext);
  const messages = OINK_MESSAGES[locale];
  return messages ? { locale, messages } : { locale: 'zh-CN', messages: zhCN };
}
