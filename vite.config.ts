import { svelte } from '@sveltejs/vite-plugin-svelte';
import { pathToFileURL } from 'url';
import { type PluginOption, defineConfig } from 'vite';

const setOutDir = (mode: string) => {
  switch (mode) {
    case 'development':
      return './test-vault/.obsidian/plugins/xiangqi';
    case 'production':
    case 'production-min':
      return 'build';
  }
};

export default defineConfig(({ mode }) => {
  const isMin = mode === 'production-min';
  return {
    plugins: [
      svelte({
        compilerOptions: {
          compatibility: {
            componentApi: 4,
          },
        },
      }) as PluginOption,
    ],
    build: {
      lib: {
        entry: 'src/main',
        formats: ['cjs'],
      },
      rollupOptions: {
        output: {
          entryFileNames: 'main.js',
          assetFileNames: 'styles.css',
          sourcemapBaseUrl: pathToFileURL(`${__dirname}/test-vault/.obsidian/plugins/xiangqi/`).toString(),
        },
        external: [
          'obsidian',
          'electron',
          '@codemirror/autocomplete',
          '@codemirror/collab',
          '@codemirror/commands',
          '@codemirror/language',
          '@codemirror/lint',
          '@codemirror/search',
          '@codemirror/state',
          '@codemirror/view',
          '@lezer/common',
          '@lezer/highlight',
          '@lezer/lr',
        ],
      },
      outDir: setOutDir(mode),
      emptyOutDir: false,
      minify: isMin,
      sourcemap: isMin ? false : 'inline',
    },
  };
});
