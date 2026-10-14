import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { enUS, zhCN } from './messages';
import type { Messages } from './messages';

export type { Messages } from './messages';

/** 组件内置文案和日期格式用的语言 */
export type OinkLocale = 'zh-CN' | 'en-US';
/** 语言设置：具体的语言，或 'auto'（跟随浏览器语言，见 detectLocale） */
export type OinkLocaleSetting = OinkLocale | 'auto';

/** 各语言的内置文案 */
export const OINK_MESSAGES: Record<OinkLocale, Messages> = { 'zh-CN': zhCN, 'en-US': enUS };

/** 服务端渲染、以及注水的那一帧用的语言：服务端不知道访客的语言，注水后再换成浏览器的 */
export const SERVER_LOCALE: OinkLocale = 'en-US';

/** 浏览器语言 → 组件语言：首选语言是任何一种中文（zh、zh-CN、zh-TW、zh-Hant…）用 zh-CN，其它都用 en-US */
export function detectLocale(languages: readonly string[]): OinkLocale {
  const first = (languages.find(Boolean) ?? '').toLowerCase();
  return first === 'zh' || first.startsWith('zh-') ? 'zh-CN' : 'en-US';
}

const subscribeLanguage = (cb: () => void) => {
  window.addEventListener('languagechange', cb);
  return () => window.removeEventListener('languagechange', cb);
};
const readBrowserLocale = (): OinkLocale =>
  detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
const readServerLocale = (): OinkLocale => SERVER_LOCALE;

/** 浏览器语言对应的组件语言；服务端和注水时是 SERVER_LOCALE，之后跟着浏览器（languagechange 时也会更新） */
function useBrowserLocale(): OinkLocale {
  return useSyncExternalStore(subscribeLanguage, readBrowserLocale, readServerLocale);
}

const LocaleContext = createContext<OinkLocaleSetting>('auto');

export interface LocaleProviderProps {
  /** 'auto' 跟随浏览器语言；不传（undefined）时沿用外层的设置，最外层是 'auto' */
  locale?: OinkLocaleSetting;
  children?: ReactNode;
}

/** 在这一块里切换组件内置文案的语言。可以嵌套，内层优先。OinkProvider 的 locale 就是包了一层它 */
export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const parent = useContext(LocaleContext);
  return <LocaleContext.Provider value={locale ?? parent}>{children}</LocaleContext.Provider>;
}

/**
 * 当前语言和对应的内置文案。设置是 'auto'（默认，包括没有 Provider）时跟随浏览器语言：
 * 服务端渲染和注水那一帧是 SERVER_LOCALE，注水后换成浏览器的；只在浏览器里渲染的应用第一帧就是对的
 */
export function useLocale(): { locale: OinkLocale; messages: Messages } {
  const setting = useContext(LocaleContext);
  // 无条件调用，hook 顺序固定；设置了具体语言时用不到它
  const browser = useBrowserLocale();
  const locale = setting === 'auto' || !OINK_MESSAGES[setting] ? browser : setting;
  return { locale, messages: OINK_MESSAGES[locale] };
}
