import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// SPA leve, mobile-first. Base relativa para hospedagem estática
// ou via HTML Service do Apps Script (mesma origem, sem CORS).
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 5173, host: true },
})
