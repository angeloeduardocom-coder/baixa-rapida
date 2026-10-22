import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Instalável na tela inicial e abre mesmo sem sinal (tudo é guardado no aparelho).
    VitePWA({
      registerType: 'autoUpdate',
      // Notificações push (servidor → celular): eventos 'push' e clique na notificação.
      workbox: { importScripts: ['push-sw.js'] },
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Baixa Rápida',
        short_name: 'Baixa',
        description: 'Baixa de insumos e transferências, pronta pro WhatsApp',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#16a34a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
