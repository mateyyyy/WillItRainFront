import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // permite acceso desde LAN / IPv4
    port: 5173,
    allowedHosts: [
      'unwatched-sindy-bully.ngrok-free.dev'
    ],
    proxy: {
      // proxear llamadas /api al backend en dev
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
})
