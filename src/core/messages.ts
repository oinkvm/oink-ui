/**
 * 组件内置文案（默认的 aria-label、按钮文字、读屏播报、占位符、空状态……）。
 * 每种语言一份；带参数的写成函数。组件里一律通过 useLocale().messages 取，不要写死。
 * zh-CN 就是组件原来的文案，改动时注意测试里断言的中文。
 */

export type AvatarStatusText = Record<'online' | 'busy' | 'away' | 'offline', string>;

export interface Messages {
  common: {
    /** 关闭按钮 */
    close: string;
    /** 清除按钮 */
    clear: string;
    /** 加载器的读屏文字 */
    loading: string;
    /** 移除按钮 */
    remove: string;
    /** 读屏文字里分隔几段话的标点 */
    separator: string;
  };
  avatar: {
    status: AvatarStatusText;
    /** “+N” 头像的名字 */
    more: (n: number) => string;
    /** “+N” 按钮的名字；label 是头像组的名字 */
    moreButton: (n: number, label?: string) => string;
    /** 浮出的成员面板的名字 */
    panel: (total: number, label?: string) => string;
    /** 面板底部：还有几个人没列出 */
    rest: (n: number) => string;
  };
  breadcrumb: {
    label: string;
    /** 展开折叠的中间几级 */
    expand: (n: number) => string;
  };
  code: {
    label: string;
    copy: string;
    copied: string;
    copyFailed: string;
  };
  pagination: {
    label: string;
    prev: string;
    next: string;
    page: (page: number) => string;
    status: (page: number, total: number) => string;
  };
  reaction: { label: string };
  stat: { trend: Record<'up' | 'down' | 'flat', string> };
  steps: {
    label: string;
    state: Record<'complete' | 'current' | 'upcoming', string>;
    error: string;
    /** 每一步标题前的读屏前缀 */
    prefix: (step: number, state: string) => string;
  };
  table: {
    label: string;
    empty: string;
    selectAll: string;
    /** 选择列的移动端标签 */
    selectColumn: string;
    selectRow: (rowLabel: string) => string;
    /** 第一列不是文字时的行名 */
    row: (n: number) => string;
    selected: (n: number) => string;
    pagination: (tableLabel: string) => string;
  };
  tag: { remove: (text?: string) => string };
  button: { status: Record<'loading' | 'success' | 'error', string> };
  colorPicker: {
    label: string;
    area: string;
    areaRole: string;
    areaValue: (saturation: number, brightness: number) => string;
    hue: string;
    hex: string;
    eyedropper: string;
    swatches: string;
  };
  fileDrop: {
    title: string;
    /** 选完文件后的读屏播报：accepted 个收下（只有一个时给出文件名），rejected 个不符合要求 */
    status: (accepted: number, firstName: string, rejected: number) => string;
  };
  hotkey: {
    placeholder: string;
    recording: string;
    spokenRecording: (recordingText: string) => string;
    spokenCurrent: (keys: string) => string;
    none: string;
  };
  /** 按键的可读名称（KeyboardEvent.key → 名字），给读屏和键帽的提示用 */
  keyNames: Record<string, string>;
  input: { showPassword: string };
  numberInput: { decrement: string; increment: string };
  pinInput: {
    label: string;
    cell: (index: number, length: number) => string;
  };
  rangeSlider: { thumbs: [string, string] };
  rating: {
    label: string;
    star: (n: number) => string;
    value: (current: number, max: number) => string;
  };
  searchInput: { placeholder: string };
  appShell: {
    skipLink: string;
    sidebar: string;
    aside: string;
    toggleSidebar: string;
    toggleAside: string;
  };
  splitPane: { separator: string };
  commandPalette: {
    label: string;
    placeholder: string;
    empty: string;
    results: (n: number) => string;
  };
  toast: { label: string };
  confirm: { confirm: string; cancel: string };
  calendar: {
    prevMonth: string;
    nextMonth: string;
    /** 接在“今天”那一格的日期名字后面 */
    todaySuffix: string;
  };
  datePicker: {
    placeholder: string;
    dialog: string;
    open: string;
    rangePlaceholder: string;
    rangeDialog: string;
  };
  combobox: {
    loading: string;
    empty: string;
    listbox: string;
  };
  select: {
    placeholder: string;
    count: (n: number) => string;
  };
}

export const zhCN: Messages = {
  common: { close: '关闭', clear: '清除', loading: '加载中', remove: '移除', separator: '，' },
  avatar: {
    status: { online: '在线', busy: '忙碌', away: '离开', offline: '离线' },
    more: (n) => `还有 ${n} 人`,
    moreButton: (n, label) => `还有 ${n} 人${label ? '，' + label : ''}，查看全部成员`,
    panel: (total, label) => (label ? `${label}（共 ${total} 人）` : `全部成员（共 ${total} 人）`),
    rest: (n) => `另有 ${n} 人`,
  },
  breadcrumb: { label: '面包屑', expand: (n) => `显示中间的 ${n} 级路径` },
  code: { label: '代码', copy: '复制代码', copied: '已复制', copyFailed: '复制失败' },
  pagination: {
    label: '分页',
    prev: '上一页',
    next: '下一页',
    page: (p) => `第 ${p} 页`,
    status: (p, total) => `第 ${p} 页，共 ${total} 页`,
  },
  reaction: { label: 'Oink 一下' },
  stat: { trend: { up: '上升', down: '下降', flat: '持平' } },
  steps: {
    label: '步骤',
    state: { complete: '已完成', current: '当前步骤', upcoming: '未开始' },
    error: '出错',
    prefix: (i, state) => `第 ${i} 步，${state}：`,
  },
  table: {
    label: '表格',
    empty: '暂无数据',
    selectAll: '选择全部',
    selectColumn: '选择',
    selectRow: (row) => `选择 ${row}`,
    row: (n) => `第 ${n} 行`,
    selected: (n) => `已选择 ${n} 行`,
    pagination: (table) => `${table}分页`,
  },
  tag: { remove: (text) => `移除${text ? ` ${text}` : ''}` },
  button: { status: { loading: '正在处理', success: '已完成', error: '操作失败' } },
  colorPicker: {
    label: '颜色',
    area: '饱和度与亮度',
    areaRole: '二维滑块',
    areaValue: (s, v) => `饱和度 ${s}%，亮度 ${v}%`,
    hue: '色相',
    hex: '十六进制色值',
    eyedropper: '从屏幕取色',
    swatches: '预设颜色',
  },
  fileDrop: {
    title: '把文件拖到这里，或点击选择',
    status: (ok, first, bad) =>
      ok
        ? (ok === 1 ? `已选择 ${first}` : `已选择 ${ok} 个文件`) + (bad ? `，${bad} 个不符合要求` : '')
        : `${bad} 个文件不符合要求`,
  },
  hotkey: {
    placeholder: '点击录制',
    recording: '按下组合键…',
    spokenRecording: (text) => `正在录制，${text}`,
    spokenCurrent: (keys) => `当前：${keys}`,
    none: '未设置',
  },
  keyNames: {
    Meta: 'Command', Control: 'Control', Alt: 'Option', Shift: 'Shift', Space: '空格', ArrowUp: '上', ArrowDown: '下',
    ArrowLeft: '左', ArrowRight: '右', Enter: '回车', Backspace: '退格', Tab: 'Tab', Escape: 'Esc',
  },
  input: { showPassword: '显示密码' },
  numberInput: { decrement: '减少', increment: '增加' },
  pinInput: { label: '验证码', cell: (i, n) => `第 ${i} 位，共 ${n} 位` },
  rangeSlider: { thumbs: ['最小值', '最大值'] },
  rating: { label: '评分', star: (n) => `${n} 星`, value: (c, max) => `评分：${c} / ${max}` },
  searchInput: { placeholder: '搜索…' },
  appShell: { skipLink: '跳到主要内容', sidebar: '侧栏', aside: '辅助栏', toggleSidebar: '切换导航', toggleAside: '切换辅助栏' },
  splitPane: { separator: '调整分栏大小' },
  commandPalette: { label: '命令面板', placeholder: '搜索命令…', empty: '没有匹配的结果', results: (n) => `${n} 条结果` },
  toast: { label: '通知' },
  confirm: { confirm: '确定', cancel: '取消' },
  calendar: { prevMonth: '上个月', nextMonth: '下个月', todaySuffix: '，今天' },
  datePicker: {
    placeholder: '年-月-日',
    dialog: '选择日期',
    open: '打开日历',
    rangePlaceholder: '开始日期 – 结束日期',
    rangeDialog: '选择日期范围',
  },
  combobox: { loading: '加载中…', empty: '没有匹配的选项', listbox: '选项' },
  select: { placeholder: '请选择', count: (n) => `已选 ${n} 项` },
};

/** 英文的单复数：1 file / 2 files */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const enUS: Messages = {
  common: { close: 'Close', clear: 'Clear', loading: 'Loading', remove: 'Remove', separator: ', ' },
  avatar: {
    status: { online: 'Online', busy: 'Busy', away: 'Away', offline: 'Offline' },
    more: (n) => `${n} more`,
    moreButton: (n, label) => `${n} more${label ? ', ' + label : ''}, show all members`,
    panel: (total, label) => (label ? `${label} (${plural(total, 'person', 'people')})` : `All members (${total})`),
    rest: (n) => `And ${n} more`,
  },
  breadcrumb: { label: 'Breadcrumb', expand: (n) => `Show ${plural(n, 'hidden level', 'hidden levels')}` },
  code: { label: 'Code', copy: 'Copy code', copied: 'Copied', copyFailed: 'Copy failed' },
  pagination: {
    label: 'Pagination',
    prev: 'Previous page',
    next: 'Next page',
    page: (p) => `Page ${p}`,
    status: (p, total) => `Page ${p} of ${total}`,
  },
  reaction: { label: 'Oink' },
  stat: { trend: { up: 'Up', down: 'Down', flat: 'Unchanged' } },
  steps: {
    label: 'Steps',
    state: { complete: 'Completed', current: 'Current step', upcoming: 'Not started' },
    error: 'Error',
    prefix: (i, state) => `Step ${i}, ${state}: `,
  },
  table: {
    label: 'Table',
    empty: 'No data',
    selectAll: 'Select all',
    selectColumn: 'Select',
    selectRow: (row) => `Select ${row}`,
    row: (n) => `Row ${n}`,
    selected: (n) => `${plural(n, 'row', 'rows')} selected`,
    pagination: (table) => `${table} pagination`,
  },
  tag: { remove: (text) => `Remove${text ? ` ${text}` : ''}` },
  button: { status: { loading: 'Working', success: 'Done', error: 'Failed' } },
  colorPicker: {
    label: 'Color',
    area: 'Saturation and brightness',
    areaRole: '2D slider',
    areaValue: (s, v) => `Saturation ${s}%, brightness ${v}%`,
    hue: 'Hue',
    hex: 'Hex color',
    eyedropper: 'Pick color from screen',
    swatches: 'Preset colors',
  },
  fileDrop: {
    title: 'Drop files here, or click to browse',
    status: (ok, first, bad) =>
      ok
        ? (ok === 1 ? `Selected ${first}` : `Selected ${ok} files`) + (bad ? `, ${bad} not accepted` : '')
        : `${plural(bad, 'file', 'files')} not accepted`,
  },
  hotkey: {
    placeholder: 'Click to record',
    recording: 'Press keys…',
    spokenRecording: (text) => `Recording, ${text}`,
    spokenCurrent: (keys) => `Current: ${keys}`,
    none: 'Not set',
  },
  keyNames: {
    Meta: 'Command', Control: 'Control', Alt: 'Option', Shift: 'Shift', Space: 'Space', ArrowUp: 'Up', ArrowDown: 'Down',
    ArrowLeft: 'Left', ArrowRight: 'Right', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab', Escape: 'Esc',
  },
  input: { showPassword: 'Show password' },
  numberInput: { decrement: 'Decrease', increment: 'Increase' },
  pinInput: { label: 'Verification code', cell: (i, n) => `Digit ${i} of ${n}` },
  rangeSlider: { thumbs: ['Minimum', 'Maximum'] },
  rating: { label: 'Rating', star: (n) => plural(n, 'star', 'stars'), value: (c, max) => `Rating: ${c} of ${max}` },
  searchInput: { placeholder: 'Search…' },
  appShell: {
    skipLink: 'Skip to main content',
    sidebar: 'Sidebar',
    aside: 'Side panel',
    toggleSidebar: 'Toggle navigation',
    toggleAside: 'Toggle side panel',
  },
  splitPane: { separator: 'Resize panes' },
  commandPalette: { label: 'Command palette', placeholder: 'Search commands…', empty: 'No results', results: (n) => plural(n, 'result', 'results') },
  toast: { label: 'Notifications' },
  confirm: { confirm: 'OK', cancel: 'Cancel' },
  calendar: { prevMonth: 'Previous month', nextMonth: 'Next month', todaySuffix: ', today' },
  datePicker: {
    placeholder: 'YYYY-MM-DD',
    dialog: 'Choose date',
    open: 'Open calendar',
    rangePlaceholder: 'Start date – End date',
    rangeDialog: 'Choose date range',
  },
  combobox: { loading: 'Loading…', empty: 'No matching options', listbox: 'Options' },
  select: { placeholder: 'Select…', count: (n) => `${n} selected` },
};
