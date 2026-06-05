import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

import { cloudflare } from "@cloudflare/vite-plugin";

// SPA leve, mobile-first, instalável como PWA. Hospedagem estática no root
// do domínio (ex.: checkin.seramor.com.br) → base '/'. O Apps Script é só a
// API (VITE_API_URL); nunca é cacheada (o estado é recalculado no servidor).
export default defineConfig({
  base: '/',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 5173, host: true },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate', // nova versão entra no próximo carregamento
    includeAssets: ['favicon-32x32.png', 'apple-touch-icon.png'],
    manifest: {
      name: 'Check-in · Igreja Ser Amor',
      short_name: 'Ser Amor',
      description: 'Check-in de voluntários da Igreja Ser Amor.',
      lang: 'pt-BR',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#FFFFFF',
      theme_color: '#FFFFFF',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: 'maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      // Precacheia só o app shell (HTML/CSS/JS/ícones/fonte).
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      navigateFallback: '/index.html',
      runtimeCaching: [
        {
          // API do Apps Script: SEMPRE rede, nunca cache (estado do servidor).
          urlPattern: ({ url }) => url.hostname.endsWith('script.google.com'),
          handler: 'NetworkOnly',
        },
        {
          // Inter (Google Fonts): cacheia para o shell carregar rápido/offline.
          urlPattern: ({ url }) =>
            url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } },
        },
      ],
    },
  }), cloudflare()],
})