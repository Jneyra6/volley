import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/** Version shown in Help: build date plus the git commit, e.g. "2026-10-16 · 4fdb2a2". */
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()
const version = `${new Date().toISOString().slice(0, 10)} · ${commit}`

// https://vite.dev/config/
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Relative paths so the built app works from any address, e.g. https://you.github.io/volley/.
  base: './',
  plugins: [
    react(),
    // Makes the app installable ("Add to Home Screen") and caches it so it works offline in the gym.
    VitePWA({
      // 'prompt': a new version waits until the user taps Update, so it never reloads mid-match.
      registerType: 'prompt',
      // Registered from the app (UpdateBanner) so it can check for updates whenever the app comes back to the front.
      injectRegister: false,
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
