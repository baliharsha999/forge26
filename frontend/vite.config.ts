import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    minify: 'oxc',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('marked')) {
              return 'vendor-marked';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 800
  }
})
