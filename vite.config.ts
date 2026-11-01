import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  publicDir: 'apps/citizen-app/public',
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: { rollupOptions: { input: { citizen: 'index.html', operations: 'central.html' } } },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
