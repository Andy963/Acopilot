import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';
import { stripKatexFontFaceRules } from './src/utils/katexCss';

// 读取根目录下的 package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'strip-katex-font-assets',
      enforce: 'pre',
      transform(code, id) {
        if (!id.includes('/katex/dist/katex.min.css')) {
          return null;
        }

        return {
          code: stripKatexFontFaceRules(code),
          map: null
        };
      }
    }
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_NAME__: JSON.stringify(packageJson.displayName || packageJson.name),
    __APP_REPOSITORY__: JSON.stringify(packageJson.repository?.url || ''),
    __APP_AUTHOR__: JSON.stringify(packageJson.author || '')
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
});
