import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/setup-dashboard/',
  build: {
    outDir: '../wwwroot/setup-dashboard',
    emptyOutDir: true,
    manifest: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://setupdashboard.local.deliverdifferent.com:5200',
        changeOrigin: true,
      },
      '/API': {
        target: 'http://setupdashboard.local.deliverdifferent.com:5200',
        changeOrigin: true,
      },
    },
  },
})
