import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  resolve: {
    alias: {
      // Ensure pdfjs-dist resolves correctly
    }
  }
})

