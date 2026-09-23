import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [viteReact()],
  server: { port: 3500, cors: true },
  preview: { port: 3500, cors: true },
});
