import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/partes/', // Subcarpeta en producción
  server: {
    port: 5173,
    strictPort: true, // Fallar si el puerto no está disponible
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Generar source maps para debugging en producción (opcional)
    sourcemap: false,
  },
})
