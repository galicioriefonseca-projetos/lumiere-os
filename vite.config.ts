import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({ 
        registerType: 'autoUpdate',
        injectRegister: 'inline',
        devOptions: {
          enabled: true
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          runtimeCaching: [
            {
              // Priorizar arquivos core da própria aplicação (HTML, bundles de JS, CSS e ativos principais locais)
              // usando a estratégia NetworkFirst para garantir que profissionais sempre tenham a versão mais recente se online,
              // com fallback offline instantâneo.
              urlPattern: ({ url }) => url.origin === self.location.origin && (
                url.pathname === '/' || 
                url.pathname.endsWith('.html') || 
                url.pathname.includes('/assets/') ||
                url.pathname.includes('/icons/') ||
                url.pathname.endsWith('.webmanifest')
              ),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'core-application-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 8, // Expirar a cada 8 horas para incentivar refresco constante do cache core
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'firestore-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                networkTimeoutSeconds: 5,
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            }
          ]
        },
        manifest: {
          name: 'LumièreOS - Gestão de Beleza Premium',
          short_name: 'LumièreOS',
          description: 'Sistema de gestão inteligente de alta performance com assessoria de IA integrada para salões de beleza e clínicas de estética parceiras.',
          theme_color: '#D4AF37',
          background_color: '#050505',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/?source=pwa',
          scope: '/',
          id: '/?source=pwa',
          categories: ['business', 'productivity', 'utilities'],
          lang: 'pt-BR',
          dir: 'ltr',
          prefer_related_applications: false,
          icons: [
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/icons/icon-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any'
            }
          ],
          shortcuts: [
            {
              name: 'Agenda Lumière',
              short_name: 'Agenda',
              description: 'Veja e gerencie horários de clientes',
              url: '/dashboard/appointments?source=pwa_shortcut',
              icons: [
                {
                  src: '/icons/icon-192x192.png',
                  sizes: '192x192',
                  type: 'image/png'
                }
              ]
            },
            {
              name: 'Checklists Essenza',
              short_name: 'Checklists',
              description: 'Acompanhe checklists operacionais de abertura e fechamento',
              url: '/dashboard/checklist?source=pwa_shortcut',
              icons: [
                {
                  src: '/icons/icon-192x192.png',
                  sizes: '192x192',
                  type: 'image/png'
                }
              ]
            },
            {
              name: 'Painel de Metas',
              short_name: 'Metas',
              description: 'Visualize faturamento, cumprimento de metas e comissão',
              url: '/dashboard/goals?source=pwa_shortcut',
              icons: [
                {
                  src: '/icons/icon-192x192.png',
                  sizes: '192x192',
                  type: 'image/png'
                }
              ]
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      watch: null,
    },
  };
});
