import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' : la nouvelle version attend ; l'app propose « Mettre à jour » (ou recharge seule au
      // retour au premier plan, hors saisie). L'enregistrement est fait dans main.tsx (virtual:pwa-register).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'robots.txt', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'Pronos Miss',
        short_name: 'Pronos Miss',
        description: 'Les pronos Miss France entre amis.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1D2B78',
        background_color: '#DCEEF4',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png}'],
        // Supprime les précaches des versions précédentes à l'activation de la nouvelle.
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // /__/ = handlers Firebase Auth (signInWithRedirect) : ne jamais les servir depuis le cache.
        navigateFallbackDenylist: [/^\/__\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/candidates/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'candidates-photos',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
