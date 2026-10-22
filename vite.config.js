import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        importScripts: ['push-sw.js'],
        // Serverless functions must always hit the network, never the app shell.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Limitless',
        short_name: 'Limitless',
        description: 'Track, understand and change your patterns.',
        start_url: '/',
        theme_color: '#D6EEF7',
        background_color: '#D6EEF7',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['health', 'lifestyle'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
