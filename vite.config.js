import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'BeHave',
        short_name: 'BeHave',
        description: 'Track, understand and change your patterns.',
        start_url: '/',
        theme_color: '#F6FBFA',
        background_color: '#F6FBFA',
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
