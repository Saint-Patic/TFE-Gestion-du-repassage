/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'La Manne à Bulles',
        short_name: 'Manne à Bulles',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1babce',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    // Mesure seulement : aucun seuil bloquant côté frontend (US #320). On veut le
    // chiffre pour savoir où l'on en est, pas s'engager à le combler dans cette US.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/setupTests.ts',
        // Point d'entrée : monte l'application dans le DOM, aucune règle métier.
        // Même raisonnement que server.js côté backend.
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
    },
  },
});
