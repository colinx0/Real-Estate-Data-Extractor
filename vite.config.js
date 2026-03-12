import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['pdfjs-dist', 'xlsx']
  },
  resolve: {
    alias: {
      'xlsx': 'xlsx/dist/xlsx.full.min.js'
    }
  }
})

