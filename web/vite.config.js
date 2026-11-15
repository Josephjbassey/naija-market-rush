import { defineConfig } from 'vite';
export default defineConfig({
  base: './',                       // relative paths: works on Vercel, ModelScope static, GitHub Pages
  server: { host: true, proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: { outDir: 'dist', assetsDir: 'static', chunkSizeWarningLimit: 1200 },
});
