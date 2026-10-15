<p align="center">
  <a href="https://oink-ui.hachiwii.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/banner-dark.png">
      <img alt="Oink UI — soft, flat, quiet React components" src="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/banner-light.png" width="860">
    </picture>
  </a>
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

<a href="https://oink-ui.hachiwii.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/showcase-dark.webp">
    <img alt="The Oink UI component showcase: inputs, a select, checkboxes, a switch, radios, a slider, a product card, buttons, a table, progress, toasts, rating, tabs and an accordion" src="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/showcase-light.webp">
  </picture>
</a>

<a href="https://oink-ui.hachiwii.com/components"><img alt="Twelve common components animating in a 4 by 3 grid: Button, Input, Select, Checkbox, Switch, Slider, Tabs, DatePicker, Dialog, Menu, Tooltip and Toast" src="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/components.gif"></a>

<a href="https://oink-ui.hachiwii.com/examples/mail"><img alt="The Mail example app with a three-column layout: folders, the inbox list and an open email thread" src="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/example-mail.webp"></a>

<a href="https://oink-ui.hachiwii.com/examples/analytics"><img alt="The Analytics example app in dark mode: date range and comparison controls, four KPI cards, a revenue trend chart and quarterly goals" src="https://raw.githubusercontent.com/oinkvm/oink-ui/main/.github/assets/example-analytics-dark.webp"></a>

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
| `cornerFallback` | draw the superellipse corners with script in engines without `corner-shape` (see [Corners](#corners)) | `true` |

With a custom accent color, the text color on top of it (ink or white) and the darker / lighter variants used for text are derived automatically. `useOink()` reads and changes the theme at runtime.

Components render the same markup on the server and the client, so they work with server rendering and static prerendering. The server can't know the visitor's language, so with `locale="auto"` the server render and the hydration pass use `en-US` and switch to the browser's language right after; if you render on the server, pass `locale` explicitly (for example from the URL or the `Accept-Language` header).

## Corners

Containers use continuous-curvature superellipse corners: `border-radius` plus `corner-shape: superellipse(1.75)` (the `--ok-corner` token), with radii multiplied by `--ok-rk` (1.45) so they look as large as their nominal size. Fully round shapes (pills, circles) stay `corner-shape: round`.

Only Chromium supports `corner-shape` (Chrome, Edge, WebView2). In Safari, in the `WKWebView` that Tauri uses on macOS, and in Firefox, `OinkProvider` turns on a small script fallback that draws the same curve Chromium draws, so a Mac build looks like the Windows build:

- It does nothing at all where `corner-shape` is supported, and nothing on the server.
- It finds the elements to redraw through `--ok-shape`, a non-inherited custom property every stylesheet declaration of `corner-shape` is paired with. Fully round elements keep the native `border-radius`.
- On those elements the native corners are squared off and then cut along the curve with `clip-path`; the parts native painting can't put on a curve — the hairline, the top highlight, borders and the focus ring — are patched in with a nine-slice SVG `border-image`. Fills, straight edges and hover / press transitions stay native; the corner patches follow transitions frame by frame. Clipped content (images, scrolling areas) is cut on the curve too.
- It follows mounts, unmounts, resizes, theme changes, hover, focus and running transitions. On a page with 300 rounded elements (about 1,900 elements in all) in WKWebView it costs about 13 ms once at start-up plus 8 ms for the first paint, 6–8 ms extra on a theme switch, and 1–2 ms of script per frame while 50 rounded elements resize or 10 animate their ring colour.

Without `OinkProvider`, call `installCornerFallback()` once on the client (it returns a function that removes it again; calls are reference-counted). `<OinkProvider cornerFallback={false}>` turns it off. Your own CSS gets the same treatment when it pairs the declarations: `corner-shape: var(--ok-corner); --ok-shape: var(--ok-corner);`.

Code that reads the tokens to draw matching shapes (`getComputedStyle(document.documentElement).getPropertyValue('--ok-corner')`) sees `superellipse(1.75)` and `--ok-rk: 1.45` wherever the corners are superellipses: natively in Chromium, and in other engines once the fallback is running (it marks `<html data-ok-corner-fallback>`). Before the script runs, or with the fallback turned off, those engines draw plain round corners and the tokens say `round` and `1`. `cornerShapePath()` returns the SVG path of a box with these corners, using the same Bézier construction as Chromium.

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
