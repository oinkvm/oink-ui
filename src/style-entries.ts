/**
 * 按需引入的样式入口清单（构建和测试共用，不从包里导出）。
 *
 * 每一项输出成 dist/styles/<name>.css，对应 `import 'oink-ui/styles/<name>.css'`：
 * · files   —— 拼进这个入口的源文件（相对 src/），按顺序
 * · deps    —— 这个入口里的组件还要用到的其它入口（比如很多组件直接用 .ok-btn 画按钮）。
 *              入口文件里不 @import 依赖：同一份样式被多个入口各带一份，后引入的会盖掉使用者写在中间的覆盖样式。
 *              依赖要由使用者自己引入一次；顺序不要求，各入口之间没有互相覆盖的规则
 * · modules —— 这个入口负责的组件源文件（相对 src/），测试据此核对 deps 是否写全
 *
 * base 是所有入口的前提（令牌、基础样式、关键帧、主题切换），每个页面只引一次、最先引。
 * 整包 oink-ui/styles.css = base + 下面全部入口。
 */
export interface StyleEntry {
  name: string;
  files: string[];
  deps: string[];
  modules: string[];
}

export const BASE_ENTRY: StyleEntry = {
  name: 'base',
  files: ['styles/tokens.css', 'styles/base.css', 'styles/keyframes.css', 'styles/theme.css'],
  deps: [],
  // Icon（.ok-icon）、VisuallyHidden（.ok-sr）、OinkProvider 的主题切换、焦点环 .ok-focusable、滚动条 .ok-scroll 都在 base 里
  modules: ['core/Icon.tsx', 'core/VisuallyHidden.tsx', 'core/theme.tsx', 'core/FocusScope.tsx', 'core/Portal.tsx', 'core/tail.tsx', 'core/locale.tsx'],
};

const e = (name: string, file: string, modules: string[], deps: string[] = []): StyleEntry => ({ name, files: [file], deps, modules });

export const STYLE_ENTRIES: StyleEntry[] = [
  // core
  e('oink-logo', 'core/oink-logo.css', ['core/OinkLogo.tsx']),

  // display
  e('roll', 'display/roll.css', ['display/Roll.tsx']),
  e('text', 'display/text.css', ['display/Text.tsx']),
  e('surface', 'display/surface.css', ['display/Surface.tsx']),
  e('image', 'display/image.css', ['display/Image.tsx']),
  e('card', 'display/card.css', ['display/Card.tsx'], ['image']),
  // .ok-collapse（高度折叠）也在这里
  e('group', 'display/group.css', ['display/Group.tsx']),
  e('list', 'display/list.css', ['display/List.tsx']),
  e('description-list', 'display/description-list.css', ['display/DescriptionList.tsx']),
  // 可选行的复选框用 .ok-check 的标记（样式在 checkbox）
  e('table', 'display/table.css', ['display/Table.tsx'], ['checkbox', 'pagination']),
  e('tabs', 'display/tabs.css', ['display/Tabs.tsx']),
  e('accordion', 'display/accordion.css', ['display/Accordion.tsx'], ['group']),
  e('breadcrumb', 'display/breadcrumb.css', ['display/Breadcrumb.tsx']),
  e('pagination', 'display/pagination.css', ['display/Pagination.tsx']),
  e('steps', 'display/steps.css', ['display/Steps.tsx']),
  e('timeline', 'display/timeline.css', ['display/Timeline.tsx']),
  e('tree', 'display/tree.css', ['display/Tree.tsx']),
  e('badge', 'display/badge.css', ['display/Badge.tsx']),
  e('tag', 'display/tag.css', ['display/Tag.tsx']),
  e('count', 'display/count.css', ['display/Count.tsx'], ['roll']),
  e('alert', 'display/alert.css', ['display/Alert.tsx'], ['button', 'group']),
  e('progress', 'display/progress.css', ['display/Progress.tsx'], ['roll']),
  e('meter', 'display/meter.css', ['display/Meter.tsx']),
  e('skeleton', 'display/skeleton.css', ['display/Skeleton.tsx']),
  e('spinner', 'display/spinner.css', ['display/Spinner.tsx']),
  e('empty-state', 'display/empty-state.css', ['display/EmptyState.tsx']),
  e('stat', 'display/stat.css', ['display/Stat.tsx'], ['card']),
  e('avatar', 'display/avatar.css', ['display/Avatar.tsx'], ['popup']),
  e('reaction', 'display/reaction.css', ['display/Reaction.tsx'], ['roll']),
  e('code', 'display/code.css', ['display/Code.tsx'], ['button']),

  // inputs
  e('button', 'inputs/button.css', ['inputs/Button.tsx']),
  e('label', 'inputs/label.css', ['inputs/Label.tsx']),
  e('field', 'inputs/field.css', ['inputs/Field.tsx']),
  e('fieldset', 'inputs/fieldset.css', ['inputs/Fieldset.tsx']),
  e('form', 'inputs/form.css', ['inputs/Form.tsx']),
  e('input', 'inputs/input.css', ['inputs/Input.tsx', 'inputs/SearchInput.tsx']),
  e('textarea', 'inputs/textarea.css', ['inputs/Textarea.tsx']),
  e('number-input', 'inputs/number-input.css', ['inputs/NumberInput.tsx']),
  e('pin-input', 'inputs/pin-input.css', ['inputs/PinInput.tsx']),
  e('checkbox', 'inputs/checkbox.css', ['inputs/Checkbox.tsx']),
  e('radio', 'inputs/radio.css', ['inputs/Radio.tsx']),
  e('switch', 'inputs/switch.css', ['inputs/Switch.tsx']),
  e('slider', 'inputs/slider.css', ['inputs/Slider.tsx', 'inputs/RangeSlider.tsx']),
  // 可拖动量条 .ok-meter 只有样式、没有组件（原生标记用）；和 display 的 Meter（分段电平）重名，所以换个名字
  e('fill-meter', 'inputs/meter.css', []),
  e('segmented', 'inputs/segmented.css', ['inputs/Segmented.tsx']),
  e('chip', 'inputs/chip.css', ['inputs/Chip.tsx']),
  e('option-card', 'inputs/option-card.css', ['inputs/OptionCard.tsx']),
  e('color-swatches', 'inputs/color-swatches.css', ['inputs/ColorSwatches.tsx']),
  // 十六进制输入框就是 Input，预设色板就是 ColorSwatches，屏幕取色按钮用 .ok-btn 的标记
  e('color-picker', 'inputs/color-picker.css', ['inputs/ColorPicker.tsx'], ['button', 'input', 'color-swatches']),
  e('kbd', 'inputs/kbd.css', ['inputs/Kbd.tsx']),
  e('hotkey', 'inputs/hotkey.css', ['inputs/Hotkey.tsx'], ['kbd']),
  e('rating', 'inputs/rating.css', ['inputs/Rating.tsx']),
  e('file-drop', 'inputs/file-drop.css', ['inputs/FileDrop.tsx']),

  // layout
  e('responsive', 'layout/responsive.css', ['layout/Show.tsx']),
  e('primitives', 'layout/primitives.css', [
    'layout/Box.tsx', 'layout/Stack.tsx', 'layout/Inline.tsx', 'layout/Grid.tsx', 'layout/Center.tsx', 'layout/Container.tsx',
    'layout/Divider.tsx', 'layout/Spacer.tsx', 'layout/Sticky.tsx', 'layout/AspectRatio.tsx', 'layout/ScrollArea.tsx',
  ], ['responsive']),
  e('page', 'layout/page.css', ['layout/Page.tsx', 'layout/PageHeader.tsx', 'layout/Section.tsx'], ['primitives', 'responsive']),
  e('toolbar', 'layout/toolbar.css', ['layout/Toolbar.tsx'], ['responsive']),
  e('nav', 'layout/nav.css', ['layout/Nav.tsx']),
  e('tab-bar', 'layout/tab-bar.css', ['layout/TabBar.tsx']),
  e('split-pane', 'layout/split-pane.css', ['layout/SplitPane.tsx']),
  e('app-shell', 'layout/app-shell.css', ['layout/AppShell.tsx'], ['floating-card', 'button', 'nav']),

  // overlays
  e('floating-card', 'overlays/floating-card.css', ['overlays/FloatingCard.tsx', 'overlays/FloatingParts.tsx', 'overlays/Panel.tsx'], ['button']),
  e('dialog', 'overlays/dialog.css', ['overlays/Dialog.tsx', 'overlays/Drawer.tsx', 'overlays/Sheet.tsx', 'overlays/confirm.tsx'], ['floating-card', 'button']),
  e('toast', 'overlays/toast.css', ['overlays/Toast.tsx'], ['button']),
  e('command-palette', 'overlays/command-palette.css', ['overlays/CommandPalette.tsx'], ['floating-card', 'kbd']),

  // popups
  e('popup', 'popups/popup.css', ['popups/Popup.tsx']),
  e('popover', 'popups/popover.css', ['popups/Popover.tsx'], ['popup']),
  e('tooltip', 'popups/tooltip.css', ['popups/Tooltip.tsx']),
  e('menu', 'popups/menu.css', ['popups/Menu.tsx', 'popups/ContextMenu.tsx', 'popups/Listbox.tsx'], ['popup']),
  e('select', 'popups/select.css', ['popups/Select.tsx'], ['popup', 'menu']),
  e('combobox', 'popups/combobox.css', ['popups/Combobox.tsx'], ['popup', 'menu', 'input']),
  e('calendar', 'popups/calendar.css', ['popups/Calendar.tsx', 'popups/DatePicker.tsx'], ['button', 'popover', 'popup', 'input']),
];

/** 某个入口要先引入的全部入口（含间接依赖，不含 base），被依赖的排在前面 */
export function styleDeps(name: string): string[] {
  const byName = new Map(STYLE_ENTRIES.map((x) => [x.name, x]));
  const out: string[] = [];
  const visit = (n: string, trail: string[]) => {
    const entry = byName.get(n);
    if (!entry) throw new Error(`未知的样式入口：${n}`);
    if (trail.includes(n)) throw new Error(`样式入口循环依赖：${[...trail, n].join(' → ')}`);
    for (const d of entry.deps) visit(d, [...trail, n]);
    if (n !== name && !out.includes(n)) out.push(n);
  };
  visit(name, []);
  return out;
}
