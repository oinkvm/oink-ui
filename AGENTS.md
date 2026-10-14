# oink-ui component conventions

Read this whole page before writing a component. The design rules are defined by this page and by the design foundations chapters in the docs site's "Get started" group (Design principles, Color, Typography, Shape · Spacing · Layers, Motion); the existing components are the most direct reference. **Don't read files outside the repository, don't look for references online, and don't add npm dependencies.**

(The original native prototype has been moved out of the repository; from the React version on, the rules here are authoritative. Source comments like "moved from oink.css section N" only describe where code came from.)

## Design language

Soft shapes, flat surfaces, quiet color, crisp motion.

- **No shadows.** Layering comes from surface steps (`--ok-bg` → `--ok-surface` → `--ok-card` → `--ok-raised`) and hairlines.
- **Almost no translucency.** Only four things are translucent: disabled states (lowered opacity overall), the hover highlight `--ok-hover`, hairlines `--ok-line / --ok-line-2 / --ok-hi`, and the modal scrim `--ok-scrim`. Overlays (menus, dropdowns, toasts) use the opaque `--ok-pop`, with no backdrop blur. Soft fills (`--ok-*-soft`) are opaque solid colors: status colors mixed with pure white in a fixed ratio; in dark mode mixed with the card color `#2A2927` (a fixed value that doesn't follow the page background).
- **Only two stroke weights.** White blocks on the page use a 1px `--ok-line`; overlays use a 1px `--ok-line-2`; checkboxes, radios and outline buttons use a 1.5px `--ok-line-2`. If fill colors already separate things, don't add a stroke. Hover only darkens the stroke color, never thickens it.
- **Top highlight `--ok-hi`** is only for large containers (panels, groups, cards, tables, menus, toasts, dialogs).
- **Selection uses neutral colors**; the accent color is reserved for primary actions and a few states.
- **Corner radii** use `--ok-r-1..6` together with `corner-shape: var(--ok-corner)`; fully round shapes use `--ok-r-full` with `corner-shape: round`.
- **Container padding is equal on all four sides**, about three quarters of the corner radius, snapped to the 4pt grid: R20→16, R24→20, R32→24. For nested rounded containers, padding = outer radius − inner radius.
- **Concentric radii in practice:** an outer layer that holds rounded containers (Surface, FloatingCard, the AppShell sidebar card, the Popover content area; Card writes it on its direct children so it doesn't read its own value) sets `--ok-r-nested: max(calc(4px * var(--ok-rk)), calc(<radius> - <padding> * var(--ok-rk)))`, and nestable containers (Card, Group, Table, CodeBlock, Image, Alert) use `border-radius: var(--ok-r-nested, <default radius>)`. Padding is multiplied by `--ok-rk` too: with superellipse corners that keeps the gap even at all four corners. Fixed nesting inside a component (an 18 menu around a 12 highlight, a 20 option card around a 12 illustration) subtracts nominal values and then multiplies the result by `--ok-rk`.
- **Control heights** use `--ok-h-sm / md / lg` (32 / 40 / 48, automatically 36 / 44 / 52 on touch screens).
- **Motion:** durations `--ok-dur-1..6`, easings `--ok-ease-out / in`, springs `--ok-spring-soft / (default) / snappy / bouncy / wobbly` paired with their `-dur`. Enter slowly, exit quickly. Floating cards (FloatingCard and everything built on it) enter and exit only with the `--ok-float-in-dur / -in-ease / -fade-dur / -out-dur / -out-ease` set; don't write per-placement transitions. Every duration is already multiplied by `--ok-ms`; never hard-code milliseconds.
- **Always wrap hover styles in `@media (hover: hover)`.**
- **Hover never changes text:** no font-size or font-weight changes, and text and elements containing text don't move. Pure graphics may have subtle hover feedback (slider thumbs, rating stars, color swatches growing); the press-down shrink is not restricted.
- **Leave native behavior to the browser:** scrolling, scrollbars, text selection, form validation and the like are only restyled, never reimplemented in script. Add `.ok-scroll` to scroll containers.

## Directories and files

```
src/core/      utilities, hooks, motion core, Portal, FocusScope, Icon (done — use them, don't change them)
src/styles/    tokens.css / base.css / keyframes.css (done — don't change; if a token is missing, use a local variable in your own CSS)
src/inputs/    forms and actions
src/overlays/  floating cards: Dialog / Drawer / Sheet / Panel / Toast… (the FloatingCard base is done)
src/popups/    anchored popups: Popover / Tooltip / Menu / Select…
src/display/   data display and feedback
src/layout/    layout and app shell
```

Each group only touches its own directory. One folder or one pair of files per component:

```
src/<group>/Button.tsx        component
src/<group>/button.css        styles
src/<group>/Button.test.tsx   tests
src/<group>/index.ts          exports every component and type in the group
src/<group>/styles.css        only @import './xxx.css';
```

Cross-group imports: use `core` freely (`import { Icon, cx } from '../core'`), and import `FloatingCard` from `'../overlays/FloatingCard'`. During parallel development, don't import components from other groups; when you need a button, write the prototype markup directly (`<button type="button" className="ok-btn ok-btn--ghost ok-focusable">`) and the inputs group provides the styles under the prototype's class names.

## Writing components

- TypeScript + function components + `forwardRef`; pass the ref and the remaining native props (`...rest`, `className`, `style`) through to the root node.
- Keep the prototype's `.ok-*` class names; express state with `data-*` or `aria-*` attributes and avoid inventing `is-*` classes.
- Value components support both controlled and uncontrolled use: `value` / `defaultValue` / `onChange` (or `checked`, `open`), via `useControllable`. The first argument of `onChange` is the new value, not the event.
- Sizes are always `size: 'sm' | 'md' | 'lg'`, variants are `variant`, and status colors are `tone: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'`.
- Use `<Icon name="…" />` for icons; when the built-in set isn't enough, inline `<Icon><path d="…" /></Icon>` in your component (20×20, stroked).
- Prefer CSS transitions for motion; when you need script, use `animate()`, `playFlip()` and `presets` — don't write your own `setTimeout` animations.
- Use `usePresence` for enter/exit; every container that floats over the page is built on `FloatingCard` — don't write another scrim, focus trap or scroll lock.
- Don't write any framework-specific code other than `'use client'`; components must not touch `window` / `document` at module top level.
- Copy, code comments and test names are written in Chinese; use full-width punctuation next to Chinese text.
- **All text shown to users or screen readers comes from `useLocale().messages`, never hard-coded** (default aria-labels, button text, placeholders, empty states, aria-live announcements, date formats…). Add new strings as keys on `Messages` in `src/core/messages.ts`, filling in both `zhCN` and `enUS`; strings with parameters are functions. Strings that a prop can override keep the prop; only the default becomes `prop ?? messages.xxx` (call `useLocale()` unconditionally at the top of the component, not on the right of `??`). When formatting dates and numbers with `Intl`, pass `useLocale().locale`. The language is set by the `locale` of `OinkProvider` / `LocaleProvider` (`'zh-CN' | 'en-US'`, default zh-CN); `src/locale.test.tsx` checks that no Chinese is left on screen under en-US — add new components to it.

## Accessibility (every component must meet these)

- Use the right native element: buttons are `<button type="button">`, switches / checkboxes / radios are real `<input>`s, links are `<a>`.
- Add the class `ok-focusable` to interactive root nodes (it provides the shared focus ring); never remove `:focus-visible`.
- Keyboard: follow the usual WAI-ARIA patterns (Tab in and out, arrow keys within a group, Home / End, Enter / Space to activate, Esc to close). Move within a group with roving tabindex or `aria-activedescendant`.
- Semantics: correct `role`, `aria-*`, `aria-label` / `aria-labelledby`; icon buttons must have an `aria-label`; announce state changes with `aria-live` (toasts, form errors).
- Disabled: native `disabled` or `aria-disabled`, a `not-allowed` cursor, and no more hover or press responses.
- Pair color with a second cue (icon, text, shape); text contrast is at least 4.5:1 (use the `--ok-*-text` colors).
- Respect reduced motion: no need to check it yourself — `--ok-ms` becomes 0; script animations just go through `animate()`.

## Responsive design

- Breakpoints (min-width): `sm` 520, `md` 768, `lg` 1024, `xl` 1280. Write `@media (min-width: 768px)` directly in CSS; use `useBreakpoint('md')` in script.
- Components adapt to their container width by default: `min-width: 0`, wrap where possible, truncate long text. Don't hard-code widths.
- Touch screens: tap targets are at least 44px (the height tokens handle this); `touch-action: manipulation`; never hide information behind hover only.
- Responsive props are always written as `T | { base?: T; sm?: T; md?: T; lg?: T; xl?: T }` (the layout group provides the `Responsive<T>` type).

## Tests and self-checks

- Every component has at least one test file: it renders the right role / name, works with the keyboard, and behaves correctly controlled and uncontrolled. Use `@testing-library/react` + `user-event`; the global `describe / it / expect` are enabled.
- Before handing off, run these from the repository root: `npx tsc --noEmit` and `npx vitest run src/<your group>`. When several groups are developed in parallel, don't run `vite build` (they would overwrite each other's dist). Only fix your own group's problems; if another group fails, report it as is — don't change it.

## Importing styles per component

Component JS doesn't import any CSS; users import styles explicitly. Pick one of the two approaches, don't mix them:

```ts
// The whole package: tokens, base styles and every component (about 170 KB, about 28 KB gzipped)
import 'oink-ui/styles.css';

// Per component: import base first (tokens + base styles + keyframes + theme switching; every component depends on it — import it once, first), then the component families you use
import 'oink-ui/styles/base.css';
import 'oink-ui/styles/button.css';
import 'oink-ui/styles/floating-card.css';
import 'oink-ui/styles/dialog.css';
```

- Each entry is the styles of one component family (`dist/styles/<name>.css`, minified on its own), exported via `"./styles/*"` in `package.json`. Entry files do **not** `@import` their dependencies, so the same styles never get bundled several times and a later import can't override styles you placed in between; the dependencies are listed in the table below — import each once yourself.
- Some components draw internal parts with another family's class names (for example many close and copy buttons are `.ok-btn`), so also bring the "Also import" column of the table (indirect dependencies included). Import in the order base → dependencies → the component itself.
- The styles for `Icon`, `VisuallyHidden`, `OinkProvider` (theme switching), the `.ok-focusable` focus ring, the `.ok-scroll` scrollbar and `.ok-sr` all live in `base`.

| Entry `oink-ui/styles/…` | Components | Also import (besides base) |
|---|---|---|
| `oink-logo.css` | OinkLogo | — |
| `roll.css` | Roll | — |
| `text.css` | Text, Heading | — |
| `surface.css` | Surface | — |
| `image.css` | Image | — |
| `card.css` | Card, CardLink, CardHeader, CardBody, CardFooter, CardMedia | `image` |
| `group.css` | Group, Row; height collapse `.ok-collapse` | — |
| `list.css` | List, ListItem | — |
| `description-list.css` | DescriptionList, DescriptionItem | — |
| `table.css` | Table | `checkbox`, `pagination` |
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
| `alert.css` | Alert | `button`, `group` |
| `progress.css` | Progress, ProgressRing | `roll` |
| `meter.css` | Meter (segmented level meter) | — |
| `skeleton.css` | Skeleton | — |
| `spinner.css` | Spinner, Dots | — |
| `empty-state.css` | EmptyState | — |
| `stat.css` | Stat | `image`, `card` |
| `avatar.css` | Avatar, AvatarGroup | `popup` |
| `reaction.css` | Reaction | `roll` |
| `code.css` | Code, CodeBlock | `button` |
| `button.css` | Button, ButtonGroup, ToggleButton | — |
| `label.css` | Label | — |
| `field.css` | Field | — |
| `fieldset.css` | Fieldset | — |
| `form.css` | Form, FormActions | — |
| `input.css` | Input, SearchInput | — |
| `textarea.css` | Textarea | — |
| `number-input.css` | NumberInput | — |
| `pin-input.css` | PinInput | — |
| `checkbox.css` | Checkbox, CheckboxGroup | — |
| `radio.css` | Radio, RadioGroup | — |
| `switch.css` | Switch | — |
| `slider.css` | Slider, RangeSlider | — |
| `fill-meter.css` | Draggable level bar `.ok-meter` (styles only, for native markup) | — |
| `segmented.css` | Segmented | — |
| `chip.css` | Chip, ChipGroup | — |
| `option-card.css` | OptionCard, OptionCardGroup | — |
| `color-swatches.css` | ColorSwatches | — |
| `color-picker.css` | ColorPicker | `button`, `input`, `color-swatches` |
| `kbd.css` | Kbd | — |
| `hotkey.css` | Hotkey | `kbd` |
| `rating.css` | Rating | — |
| `file-drop.css` | FileDrop | — |
| `responsive.css` | Show, Hide; responsive props of the layout components | — |
| `primitives.css` | Box, Stack, Inline, Cluster, Grid, GridItem, Center, Container, Divider, Spacer, Sticky, AspectRatio, ScrollArea | `responsive` |
| `page.css` | Page, PageHeader, Section | `responsive`, `primitives` |
| `toolbar.css` | Toolbar | `responsive` |
| `nav.css` | Nav, NavGroup, NavItem | — |
| `tab-bar.css` | TabBar, TabBarItem | — |
| `split-pane.css` | SplitPane | — |
| `app-shell.css` | AppShell | `button`, `floating-card`, `nav` |
| `floating-card.css` | FloatingCard and its Header / Body / Footer / Grip, Panel | `button` |
| `dialog.css` | Dialog, Drawer, Sheet, `confirm()` | `button`, `floating-card` |
| `toast.css` | Toaster, `toast()` | `button` |
| `command-palette.css` | CommandPalette | `button`, `floating-card`, `kbd` |
| `popup.css` | The base for anchored popups (shared by Popover, Menu, Select and others) | — |
| `popover.css` | Popover | `popup` |
| `tooltip.css` | Tooltip | — |
| `menu.css` | The Menu family, DropdownMenu, ContextMenu | `popup` |
| `select.css` | Select, MultiSelect | `popup`, `menu` |
| `combobox.css` | Combobox, Autocomplete | `popup`, `menu`, `input` |
| `calendar.css` | Calendar, RangeCalendar, DatePicker, DateRangePicker | `button`, `popup`, `popover`, `input` |

When adding a style file to the library: register it in `src/style-entries.ts` (which entry it belongs to, which component files it covers, which entries it depends on) and add it to its group's `styles.css`. `src/style-entries.test.ts` checks that every source file is listed exactly once and that every class name a component uses is in "base + its own entry + its dependencies"; `vite build` writes `dist/styles/` from this list.
