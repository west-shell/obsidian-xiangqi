import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig, type Plugin, type PluginOption } from 'vite';

const setOutDir = (mode: string) => {
  switch (mode) {
    case 'development':
      return './test-vault/.obsidian/plugins/xiangqi';
    case 'production':
    case 'production-min':
      return 'build';
  }
};

function copyPikafish(): Plugin {
  return {
    name: 'copy-pikafish',
    writeBundle(options) {
      const outDir = options.dir || setOutDir('production');
      const srcDir = path.resolve(__dirname, 'assets/pikafish');
      const destDir = path.resolve(outDir);
      if (!fs.existsSync(srcDir)) return;
      for (const file of ['pikafish.js', 'pikafish.wasm', 'pikafish.data']) {
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
    },
  };
}

/**
 * base64-asset — 把以 `?base64` 结尾的导入（如 `../assets/wood.png?base64`）
 * 在构建期读取为 base64 字符串并作为 JS 模块默认导出，从而把图片内嵌进 main.js，
 * 而不作为独立文件输出。
 */
function base64Asset(): Plugin {
  return {
    name: 'base64-asset',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.endsWith('?base64')) return null;
      // 去掉 query，得到真实文件路径并解析为绝对路径
      const filePath = source.slice(0, -'?base64'.length);
      const id =
        importer && !filePath.startsWith('/')
          ? path.resolve(path.dirname(importer), filePath)
          : path.resolve(filePath);
      return `\0${id}?base64`;
    },
    load(id) {
      if (!id.endsWith('?base64')) return null;
      const filePath = id.slice(1, -'?base64'.length); // 去掉开头的 \0 和结尾 query
      if (!fs.existsSync(filePath)) {
        this.error(`base64-asset: 文件不存在: ${filePath}`);
      }
      const b64 = fs.readFileSync(filePath).toString('base64');
      return `export default ${JSON.stringify(b64)};`;
    },
  };
}

export default defineConfig(({ mode }) => {
  const isMin = mode === 'production-min';
  return {
    plugins: [
      base64Asset(),
      copyPikafish(),
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
      sourcemap: isMin ? false : true,
    },
  };
});
