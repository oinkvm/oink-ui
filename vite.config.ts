/// <reference types="vitest" />
import { defineConfig, transformWithEsbuild } from 'vite';
import type { Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_ENTRY, STYLE_ENTRIES, styleDeps } from './src/style-entries';

/**
 * 按需引入的样式：把 src/style-entries.ts 里的每个入口拼好、单独压缩，输出到 dist/styles/<name>.css。
 * 整包 dist/oink-ui.css 照旧由 src/index.ts 引入的 styles.css 生成。组件的 JS 不引任何 CSS。
 */
function styleEntries(): Plugin {
  let target: string | string[] | false = false;
  return {
    name: 'oink-style-entries',
    apply: 'build',
    configResolved(config) { target = config.build.cssTarget; },
    async generateBundle(output) {
      if (output.format !== 'es') return;   // es、cjs 两次输出只写一份
      for (const entry of [BASE_ENTRY, ...STYLE_ENTRIES]) {
        const css = entry.files.map((f) => readFileSync(resolve(__dirname, 'src', f), 'utf8')).join('\n');
        if (/@import\b/.test(css)) this.error(`样式入口 ${entry.name} 的源文件里不能有 @import`);
        const { code } = await transformWithEsbuild(css, `${entry.name}.css`, {
          loader: 'css', minify: true, legalComments: 'none', ...(target ? { target } : {}),
        });
        const deps = entry.name === 'base' ? [] : styleDeps(entry.name);
        const needs = entry.name === 'base' ? '所有组件样式的前提，最先引入' : `先引入 base${deps.map((d) => '、' + d).join('')}`;
        this.emitFile({ type: 'asset', fileName: `styles/${entry.name}.css`, source: `/* oink-ui/styles/${entry.name}.css · ${needs} */\n${code}` });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), styleEntries()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'OinkUI',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'oink-ui.js' : 'oink-ui.cjs'),
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
      output: { assetFileNames: 'oink-ui[extname]' },
    },
  },
  test: {
    environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'], css: false,
    minWorkers: 1, maxWorkers: 4,
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
