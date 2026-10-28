import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // The Express API runs on :3001 in development (npm run dev starts both).
      proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 3001}`, changeOrigin: false } },
    },

    preview: {
      host: '0.0.0.0',
      allowedHosts: ['farmdirectykisan-connect-qd31.onrender.com'],
    },
  };
});
