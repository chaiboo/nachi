import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'node:os'
import path from 'node:path'

const nachiCache = path.join(os.homedir(), '.nachi', 'frontend-cache')

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // node_modules lives outside the project root (symlinked to ~/.nachi)
      // because CloudStorage is hostile to Vite's file scanning.
      allow: ['.', nachiCache],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
