/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/logo.png',
        'icons/logo-motion.png',
        'pictos/ARASAAC_NOTICE.txt'
      ],
      manifest: {
        name: 'Motion EDUmind',
        short_name: 'Motion EDU',
        description: 'Stopmotion accesible con cámara, pictogramas y exportaciones WebM fiables.',
        theme_color: '#0b172b',
        background_color: '#0b172b',
        start_url: '.',
        display: 'standalone',
        orientation: 'portrait',
        scope: '.',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest,webp}'],
        globIgnores: ['icons/logo-motion.png'],
        maximumFileSizeToCacheInBytes: 3000000,
        runtimeCaching: [
          {
            urlPattern: /pictos\/catalogs\/.*\.json/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'picto-catalogs'
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-files',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 120
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('pdf-lib')) return 'export-pdf'
          if (id.includes('jszip')) return 'export-zip'
          if (id.includes('idb')) return 'storage'
          if (id.includes('workbox-window')) return 'pwa-runtime'
          return 'vendor'
        }
      }
    }
  },
  server: {
    host: true
  }
})
