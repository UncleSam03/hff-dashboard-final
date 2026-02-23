import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      manifest: {
        name: 'HFF Dashboard V2',
        short_name: 'HFF',
        description: 'Hope For Families Campaign Dashboard',
        theme_color: '#800080', // Purple from logo
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },

      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "enketo/config": path.resolve(__dirname, "./src/enketo-config.js"),
      "enketo/widgets": path.resolve(__dirname, "./src/enketo-core/js/widgets.js"),
      "enketo/translator": path.resolve(__dirname, "./src/enketo-core/js/fake-translator.js"),
      "enketo/dialog": path.resolve(__dirname, "./src/enketo-core/js/fake-dialog.js"),
      "enketo/file-manager": path.resolve(__dirname, "./src/enketo-core/js/file-manager.js"),
      "enketo/xpath-evaluator-binding": path.resolve(__dirname, "./src/enketo-core/js/xpath-evaluator-binding.js"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
})

