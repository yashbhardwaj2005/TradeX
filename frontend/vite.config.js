import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.TRADEX_API_TARGET || 'http://127.0.0.1:4000',
        configure(proxy) {
          proxy.on('error', (error, req, res) => {
            if (res.headersSent || typeof res.writeHead !== 'function') return;
            res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '2' });
            res.end(
              JSON.stringify({
                success: false,
                error: {
                  code: 'API_STARTING',
                  message: 'TradeX is starting or reconnecting. Please try again in a moment.',
                },
              }),
            );
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'stock-charts': ['lightweight-charts'],
          'analytics-charts': ['recharts'],
          forms: ['react-hook-form', '@hookform/resolvers/zod', 'zod'],
        },
      },
    },
  },
});
