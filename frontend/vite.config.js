import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/detections-images': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
