import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000', '/dev': 'http://localhost:3000', '/media': 'http://localhost:3000' },
    fs: { allow: ['..'] }, // shared/ (syllabification) lives next to client/
  },
});
