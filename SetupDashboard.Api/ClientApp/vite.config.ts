import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// `vite build --mode demo` (npm run build:demo): the real screens with src/demo/mockApi.ts in
// place of src/lib/api.ts - sample data, no server, nothing leaves the browser. Built to
// dist-demo/ with relative paths so it can be hosted anywhere.
function demoApi(): Plugin {
  const real = path.resolve(__dirname, 'src/lib/api.ts')
  const mock = path.resolve(__dirname, 'src/demo/mockApi.ts')
  return {
    name: 'setup-dashboard-demo-api',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || path.resolve(importer) === mock) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved && path.resolve(resolved.id) === real ? mock : null
    },
  }
}

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'
  return {
    plugins: [react(), tailwindcss(), ...(demo ? [demoApi()] : [])],
    base: demo ? './' : '/setup-dashboard/',
    build: {
      outDir: demo ? 'dist-demo' : '../wwwroot/setup-dashboard',
      emptyOutDir: true,
      manifest: !demo,
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
  }
})
