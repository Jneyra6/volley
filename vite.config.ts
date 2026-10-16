import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the built app works from any address, e.g. https://you.github.io/volley/.
  base: './',
  plugins: [
    react(),
    // Makes the app installable ("Add to Home Screen") and caches it so it works offline in the gym.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-180.png'],
      manifest: {
        name: 'Volley – Rotations & Stats',
        short_name: 'Volley',
        description: 'Volleyball rotations, live match stats and reports.',
        theme_color: '#1d4ed8',
        background_color: '#f3f5f8',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // jsPDF's optional add-ons for HTML and SVG rendering; the rotations PDF doesn't use them.
        globIgnores: ['**/html2canvas*.js', '**/purify*.js', '**/index.es-*.js'],
      },
    }),
  ],
})
