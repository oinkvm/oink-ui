# oink-ui 组件约定

写组件之前读完这一页。设计规则以这一页和文档站“开始”分组里的设计基础章节（设计原则、色彩、字体、形状 · 间距 · 层级、动效）为准；现有组件的实现就是最直接的参考。**不要读仓库以外的文件，不要上网找参考，不要新增 npm 依赖。**

（最初的原生原型已经移出仓库，React 版此后的规则以这里为准。源码注释里的“搬自 oink.css 第 N 节”只是来历说明。）

## 设计语言

形状柔和、表面平整、用色安静、动效利落。

- **没有阴影。** 分层靠表面色阶（`--ok-bg` → `--ok-surface` → `--ok-card` → `--ok-raised`）和发丝线。
- **几乎不用半透明。** 只有四样东西是半透明的：禁用态（整体降透明度）、悬停高亮 `--ok-hover`、发丝线 `--ok-line / --ok-line-2 / --ok-hi`、模态遮罩 `--ok-scrim`。浮层（菜单、下拉、通知）是不透明的 `--ok-pop`，不加背景模糊；柔和底（`--ok-*-soft`）是不透明固有色：状态色按比例混纯白；深色模式混卡片色 `#2A2927`（固定值，不跟页面底色走）。
- **描边只有两档。** 白色块在页面上用 1px `--ok-line`；浮层用 1px `--ok-line-2`；复选框、单选、描边按钮用 1.5px `--ok-line-2`。有填充色能分清的就不描边。悬停只加深线色，不加粗。
- **顶部高光 `--ok-hi`** 只给大块容器（面板、分组、卡片、表格、菜单、通知、对话框）。
- **选中用中性色**，强调色只给主操作和少数状态。
- **圆角**用 `--ok-r-1..6`，并配 `corner-shape: var(--ok-corner)`；全圆用 `--ok-r-full` 配 `corner-shape: round`。
- **容器内边距四边相等**，约为圆角的四分之三并落在 4pt 栅格：R20→16，R24→20，R32→24。套圆角容器时内边距 = 外圆角 − 内圆角。
- **同心圆角的实现**：装圆角容器的外层（Surface、FloatingCard、AppShell 侧栏卡片、Popover 内容区；Card 写到自己的直接子元素上，避免读到自己写的值）设置 `--ok-r-nested: max(calc(4px * var(--ok-rk)), calc(<圆角> - <内边距> * var(--ok-rk)))`，可嵌套的容器（Card、Group、Table、CodeBlock、Image、Alert）写 `border-radius: var(--ok-r-nested, <默认圆角>)`。内边距也要乘 `--ok-rk`：超椭圆转角下这样四角间距才均匀。组件内部固定的嵌套（菜单 18 套高亮 12、选项卡片 20 套示意图 12）按名义值相减再整体乘 `--ok-rk`。
- **控件高度**用 `--ok-h-sm / md / lg`（32 / 40 / 48，触屏自动 36 / 44 / 52）。
- **动效**：时长 `--ok-dur-1..6`，缓动 `--ok-ease-out / in`，弹簧 `--ok-spring-soft / (默认) / snappy / bouncy / wobbly` 配 `-dur`。进场慢、退场快。悬浮卡片（FloatingCard 及其封装）的进退场只用 `--ok-float-in-dur / -in-ease / -fade-dur / -out-dur / -out-ease` 这一组，不要按位置另写过渡。所有时长已经乘了 `--ok-ms`，不要写死毫秒。
- **悬停样式一律包在 `@media (hover: hover)` 里。**
- **悬停不改文字**：不改字号、字重，文字和带文字的元素不位移。纯图形可以有轻微的悬停反馈（滑块圆钮、评分星星、色板放大）；按下时的回缩不受限制。
- **原生行为交给浏览器**：滚动、滚动条、文本选择、表单校验等只换外观，不用脚本重做。滚动容器加 `.ok-scroll`。

## 目录与文件

```
src/core/      工具、hooks、动效内核、Portal、FocusScope、Icon（已完成，可以用，不要改）
src/styles/    tokens.css / base.css / keyframes.css（已完成，不要改；缺令牌时在自己的 css 里用局部变量）
src/inputs/    表单与操作类
src/overlays/  悬浮卡片类：Dialog / Drawer / Sheet / Panel / Toast…（FloatingCard 基座已完成）
src/popups/    锚定弹出类：Popover / Tooltip / Menu / Select…
src/display/   数据展示与反馈类
src/layout/    布局与应用骨架
```

每个组只动自己的目录。一个组件一个文件夹或一对文件：

```
src/<组>/Button.tsx        组件
src/<组>/button.css        样式
src/<组>/Button.test.tsx   测试
src/<组>/index.ts          导出本组全部组件和类型
src/<组>/styles.css        只写 @import './xxx.css';
```

跨组引用：`core` 随便用（`import { Icon, cx } from '../core'`），`FloatingCard` 从 `'../overlays/FloatingCard'` 导入。并行开发阶段不要导入其它组的组件；需要按钮时直接写原型里的标记（`<button type="button" className="ok-btn ok-btn--ghost ok-focusable">`），样式由 inputs 组按原型类名提供。

## 组件写法

- TypeScript + 函数组件 + `forwardRef`，把 ref 和其余原生属性（`...rest`、`className`、`style`）透传到根节点。
- 类名沿用原型的 `.ok-*`，状态用 `data-*` 或 `aria-*` 属性表达，尽量不新造 `is-*`。
- 取值类组件同时支持受控和非受控：`value` / `defaultValue` / `onChange`（或 `checked`、`open`），用 `useControllable`。`onChange` 的第一个参数是新值，不是事件。
- 尺寸统一叫 `size: 'sm' | 'md' | 'lg'`，变体叫 `variant`，状态色叫 `tone: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'`。
- 需要图标就用 `<Icon name="…" />`；内置图标不够时在自己组件里内联 `<Icon><path d="…" /></Icon>`（20×20，描线）。
- 需要动效时优先 CSS 过渡；要脚本就用 `animate()`、`playFlip()`、`presets`，不要自己写 `setTimeout` 动画。
- 进退场用 `usePresence`；浮在页面上的容器一律基于 `FloatingCard`，不要另写一套遮罩、焦点圈、滚动锁。
- 不要写 `'use client'` 以外的任何框架特定代码；组件不能在模块顶层访问 `window` / `document`。
- 文案、注释、测试名用中文；中文旁边的标点用全角。
- **组件里给用户看 / 给读屏的文字一律从 `useLocale().messages` 取，不要写死**（默认的 aria-label、按钮文字、占位符、空状态、aria-live 播报、日期格式……）。新文案在 `src/core/messages.ts` 的 `Messages` 里加键，`zhCN` 和 `enUS` 都要写；带参数的写成函数。能被属性覆盖的文案照旧保留属性，只是默认值改成 `prop ?? messages.xxx`（`useLocale()` 要在组件顶层无条件调用，不要写在 `??` 右边）。日期、数字用 `Intl` 时传 `useLocale().locale`。语言由 `OinkProvider` / `LocaleProvider` 的 `locale`（`'zh-CN' | 'en-US'`，默认 zh-CN）决定；`src/locale.test.tsx` 会检查 en-US 下页面里没有残留中文，新组件请加进去。

## 无障碍（每个组件都要满足）

- 用对的原生元素：按钮是 `<button type="button">`，开关 / 复选框 / 单选是真的 `<input>`，链接是 `<a>`。
- 可交互根节点加类 `ok-focusable`（提供统一的焦点环）；不要去掉 `:focus-visible`。
- 键盘：按 WAI-ARIA 的常规模式做（Tab 进出、方向键在组内移动、Home / End、Enter / Space 触发、Esc 关闭）。组内移动用 roving tabindex 或 `aria-activedescendant`。
- 语义：正确的 `role`、`aria-*`、`aria-label` / `aria-labelledby`；图标按钮必须有 `aria-label`；状态变化用 `aria-live`（Toast、表单错误）。
- 禁用：原生 `disabled` 或 `aria-disabled`，指针显示 `not-allowed`，不再响应悬停和按压。
- 颜色之外要有第二种提示（图标、文字、形状）；文字对比度不低于 4.5:1（用 `--ok-*-text` 那组颜色）。
- 尊重减弱动效：不用自己判断，`--ok-ms` 会变成 0；脚本动画走 `animate()` 即可。

## 响应式

- 断点（min-width）：`sm` 520、`md` 768、`lg` 1024、`xl` 1280。CSS 里直接写 `@media (min-width: 768px)`；脚本里用 `useBreakpoint('md')`。
- 组件默认按容器宽度自适应：`min-width: 0`、能换行就换行、长文字省略。不要写死宽度。
- 触屏：点按区域不小于 44px（高度令牌已处理）；`touch-action: manipulation`；不依赖悬停才能看到的信息。
- 响应式属性统一写法：`T | { base?: T; sm?: T; md?: T; lg?: T; xl?: T }`（布局组提供类型 `Responsive<T>`）。

## 测试与自检

- 每个组件至少一个测试文件：渲染出正确的 role / 名称、键盘能操作、受控与非受控都对。用 `@testing-library/react` + `user-event`，全局 `describe / it / expect` 已开启。
- 交付前在 `packages/oink-ui` 下跑通：`npx tsc --noEmit`、`npx vitest run src/<你的组>`。多组并行开发时不要跑 `vite build`（会互相覆盖 dist）。只修自己组的问题；别的组报错时如实说明，不要去改。

## 按需引入样式

组件的 JS 不引任何 CSS，样式由使用者显式引入。两种方式任选其一，不要混用：

```ts
// 整包：令牌、基础样式和全部组件（约 170 KB，gzip 后约 28 KB）
import 'oink-ui/styles.css';

// 按需：先引 base（令牌 + 基础样式 + 关键帧 + 主题切换，所有组件都依赖，只引一次、最先引），再引用到的组件家族
import 'oink-ui/styles/base.css';
import 'oink-ui/styles/button.css';
import 'oink-ui/styles/floating-card.css';
import 'oink-ui/styles/dialog.css';
```

- 每个入口是一个组件家族的样式（`dist/styles/<名字>.css`，单独压缩），由 `package.json` 的 `"./styles/*"` 导出。入口文件里**不** `@import` 依赖，免得同一份样式被带进好几次、后引入的盖掉你写在中间的覆盖样式；依赖由下表列出，自己引一次即可。
- 有些组件直接用别的家族的类名画内部零件（比如很多组件的关闭、复制按钮就是 `.ok-btn`），所以要把下表「还要引入」一栏也带上（已含间接依赖）。建议按「base → 被依赖的 → 自己」的顺序引入。
- `Icon`、`VisuallyHidden`、`OinkProvider`（主题切换）、焦点环 `.ok-focusable`、滚动条 `.ok-scroll`、`.ok-sr` 的样式都在 `base` 里。

| 入口 `oink-ui/styles/…` | 组件 | 还要引入（base 之外） |
|---|---|---|
| `oink-logo.css` | OinkLogo | — |
| `roll.css` | Roll | — |
| `text.css` | Text、Heading | — |
| `surface.css` | Surface | — |
| `image.css` | Image | — |
| `card.css` | Card、CardLink、CardHeader、CardBody、CardFooter、CardMedia | `image` |
| `group.css` | Group、Row；高度折叠 `.ok-collapse` | — |
| `list.css` | List、ListItem | — |
| `description-list.css` | DescriptionList、DescriptionItem | — |
| `table.css` | Table | `checkbox`、`pagination` |
| `tabs.css` | Tabs | — |
| `accordion.css` | Accordion | `group` |
| `breadcrumb.css` | Breadcrumb | — |
| `pagination.css` | Pagination | — |
| `steps.css` | Steps | — |
| `timeline.css` | Timeline | — |
| `tree.css` | Tree | — |
| `badge.css` | Badge | — |
| `tag.css` | Tag | — |
| `count.css` | Count | `roll` |
| `alert.css` | Alert | `button`、`group` |
| `progress.css` | Progress、ProgressRing | `roll` |
| `meter.css` | Meter（分段电平） | — |
| `skeleton.css` | Skeleton | — |
| `spinner.css` | Spinner、Dots | — |
| `empty-state.css` | EmptyState | — |
| `stat.css` | Stat | `image`、`card` |
| `avatar.css` | Avatar、AvatarGroup | `popup` |
| `reaction.css` | Reaction | `roll` |
| `code.css` | Code、CodeBlock | `button` |
| `button.css` | Button、ButtonGroup、ToggleButton | — |
| `label.css` | Label | — |
| `field.css` | Field | — |
| `fieldset.css` | Fieldset | — |
| `form.css` | Form、FormActions | — |
| `input.css` | Input、SearchInput | — |
| `textarea.css` | Textarea | — |
| `number-input.css` | NumberInput | — |
| `pin-input.css` | PinInput | — |
| `checkbox.css` | Checkbox、CheckboxGroup | — |
| `radio.css` | Radio、RadioGroup | — |
| `switch.css` | Switch | — |
| `slider.css` | Slider、RangeSlider | — |
| `fill-meter.css` | 可拖动量条 `.ok-meter`（只有样式，给原生标记用） | — |
| `segmented.css` | Segmented | — |
| `chip.css` | Chip、ChipGroup | — |
| `option-card.css` | OptionCard、OptionCardGroup | — |
| `color-swatches.css` | ColorSwatches | — |
| `color-picker.css` | ColorPicker | `button`、`input`、`color-swatches` |
| `kbd.css` | Kbd | — |
| `hotkey.css` | Hotkey | `kbd` |
| `rating.css` | Rating | — |
| `file-drop.css` | FileDrop | — |
| `responsive.css` | Show、Hide；布局组件的响应式属性 | — |
| `primitives.css` | Box、Stack、Inline、Cluster、Grid、GridItem、Center、Container、Divider、Spacer、Sticky、AspectRatio、ScrollArea | `responsive` |
| `page.css` | Page、PageHeader、Section | `responsive`、`primitives` |
| `toolbar.css` | Toolbar | `responsive` |
| `nav.css` | Nav、NavGroup、NavItem | — |
| `tab-bar.css` | TabBar、TabBarItem | — |
| `split-pane.css` | SplitPane | — |
| `app-shell.css` | AppShell | `button`、`floating-card`、`nav` |
| `floating-card.css` | FloatingCard 及其 Header / Body / Footer / Grip、Panel | `button` |
| `dialog.css` | Dialog、Drawer、Sheet、`confirm()` | `button`、`floating-card` |
| `toast.css` | Toaster、`toast()` | `button` |
| `command-palette.css` | CommandPalette | `button`、`floating-card`、`kbd` |
| `popup.css` | 锚定浮层的基座（Popover、Menu、Select 等共用） | — |
| `popover.css` | Popover | `popup` |
| `tooltip.css` | Tooltip | — |
| `menu.css` | Menu 一族、DropdownMenu、ContextMenu | `popup` |
| `select.css` | Select、MultiSelect | `popup`、`menu` |
| `combobox.css` | Combobox、Autocomplete | `popup`、`menu`、`input` |
| `calendar.css` | Calendar、RangeCalendar、DatePicker、DateRangePicker | `button`、`popup`、`popover`、`input` |

给库加样式文件时：在 `src/style-entries.ts` 里登记它属于哪个入口、负责哪些组件文件、依赖哪些入口，并加进对应组的 `styles.css`。`src/style-entries.test.ts` 会核对源文件不重不漏、组件用到的类名都在「base + 自己 + 依赖」里；`vite build` 按这份清单输出 `dist/styles/`。
