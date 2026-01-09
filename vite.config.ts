import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "brack-favicon/favicon.ico",
        "brack-favicon/apple-touch-icon.png",
        "brack-favicon/favicon.svg",
      ],
      manifest: {
        name: "Brack",
        short_name: "Brack",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#6366f1",
        background_color: "#0b1021",
        description: "Track your reading progress, discover new books, connect with readers, and achieve your reading goals.",
        icons: [
          {
            src: "/brack-favicon/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/brack-favicon/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/brack-favicon/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Use environment variable or fallback pattern
            // Note: Replace hardcoded URL with VITE_SUPABASE_URL in production
            urlPattern: ({ url }) => {
              const supabaseUrl = process.env.VITE_SUPABASE_URL;
              if (supabaseUrl) {
                return url.href.startsWith(`${supabaseUrl}/storage/v1/object/public/`);
              }
              // Fallback to pattern matching any supabase storage URL
              return /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\//.test(url.href);
            },
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-public-assets",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/www\.googleapis\.com\/books\/v1\/volumes/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-books",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 5,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
