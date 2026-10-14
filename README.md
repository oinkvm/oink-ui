<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/banner-dark.png">
    <img alt="Oink UI — soft, flat, quiet React components" src="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/banner-light.png" width="860">
  </picture>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oink-ui"><img alt="npm" src="https://img.shields.io/npm/v/oink-ui?color=ff6b8e"></a>
  <a href="https://github.com/oinkvm/oink-ui/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/oinkvm/oink-ui/actions/workflows/ci.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-1b1c22"></a>
</p>

# Oink UI

A soft, flat, quiet React component library: large continuous corner radii, flat surfaces with hairlines instead of shadows, an ink-and-neutral palette with one accent color, and quick, purposeful motion. Responsive and accessible out of the box, with light and dark themes.

**Docs and live examples:** https://oink-ui.hachiwii.com

## Examples

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/showcase-dark.webp">
  <img alt="The Oink UI component showcase: inputs, a select, checkboxes, a switch, radios, a slider, a product card, buttons, a table, progress, toasts, rating, tabs and an accordion" src="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/showcase-light.webp">
</picture>

<img alt="Twelve common components animating in a 4 by 3 grid: Button, Input, Select, Checkbox, Switch, Slider, Tabs, DatePicker, Dialog, Menu, Tooltip and Toast" src="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/components.gif">

<img alt="The Mail example app with a three-column layout: folders, the inbox list and an open email thread" src="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/example-mail.webp">

<img alt="The Analytics example app in dark mode: date range and comparison controls, four KPI cards, a revenue trend chart and quarterly goals" src="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/example-analytics-dark.webp">

## Install

```bash
npm install oink-ui
```

React 18 or newer is a peer dependency.

## Usage

Import the styles once in your entry file, then wrap your app in `OinkProvider`:

```tsx
import 'oink-ui/styles.css';
import { Button, OinkProvider, Toaster } from 'oink-ui';

export function App() {
  return (
    <OinkProvider>
      <Button variant="primary">Get started</Button>
      <Toaster />
    </OinkProvider>
  );
}
```

`oink-ui/styles.css` contains every design token (`--ok-*`) and every component's styles. To ship only what you use, import `oink-ui/styles/base.css` first and then one entry per component family, e.g. `oink-ui/styles/button.css`, `oink-ui/styles/dialog.css`. The comment at the top of each entry lists the other entries it depends on.

## Theming and locale

`OinkProvider` sets the theme, accent color, motion preference and the language of built-in strings:

| Prop | Values | Default |
|---|---|---|
| `defaultTheme` | `'light' \| 'dark' \| 'system'` | `'system'` |
| `defaultAccent` | `'pink' \| 'orange' \| 'amber' \| 'blue' \| 'violet'` or any `#rrggbb` | `'pink'` |
| `defaultMotion` | `'auto' \| 'full' \| 'reduced'` | `'auto'` |
| `locale` | `'auto' \| 'zh-CN' \| 'en-US'` — `'auto'` follows the browser language: Chinese → `zh-CN`, anything else → `en-US` | `'auto'` |
| `storageKey` | remember the user's choices in `localStorage` under this key | — |

With a custom accent color, the text color on top of it (ink or white) and the darker / lighter variants used for text are derived automatically. `useOink()` reads and changes the theme at runtime.

Components render the same markup on the server and the client, so they work with server rendering and static prerendering. The server can't know the visitor's language, so with `locale="auto"` the server render and the hydration pass use `en-US` and switch to the browser's language right after; if you render on the server, pass `locale` explicitly (for example from the URL or the `Accept-Language` header).

## Development

```bash
npm install
npm test           # vitest
npm run typecheck
npm run build      # dist/: ESM + CJS, type declarations, styles.css and per-component style entries
```

Every push to `main` that changes code is released automatically as a new patch version (`1.0.x`) by [`release.yml`](./.github/workflows/release.yml); put `[skip ci]` in the commit message to skip a release.

## License

[MIT](./LICENSE) © Hachiwii
