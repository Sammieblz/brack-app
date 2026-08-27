import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, "../..");
  const env = loadEnv(mode, repoRoot, "");
  const configuredTurnstileSiteKey = env.VITE_TURNSTILE_SITE_KEY?.trim();
  if (mode === "production" && !configuredTurnstileSiteKey) {
    throw new Error(
      "Missing VITE_TURNSTILE_SITE_KEY. Production Auth builds must include the existing Turnstile widget sitekey.",
    );
  }
  const configuredSupabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const configuredSupabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!configuredSupabaseUrl || !configuredSupabasePublishableKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Brack cannot produce a runnable client bundle without both public Supabase values.",
    );
  }
  const escapedSupabaseUrl = configuredSupabaseUrl?.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const publicSupabaseStoragePattern = escapedSupabaseUrl
    ? new RegExp(`^${escapedSupabaseUrl}/storage/v1/object/public/`)
    : /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//;

  return {
    envDir: repoRoot,
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "brack-mark.webp",
        "brack-favicon/favicon.ico",
        "brack-favicon/apple-touch-icon.png",
      ],
      manifest: {
        id: "/",
        name: "Brack",
        short_name: "Brack",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Auth links should remain in the reader's browser by default. This is
        // advisory in browsers that support link-handling preferences; OTP is
        // the guaranteed same-context path.
        handle_links: "not-preferred",
        // If the reader explicitly opens Brack as an app, reuse its current
        // window instead of creating duplicate PWA windows.
        launch_handler: {
          client_mode: "navigate-existing",
        },
        theme_color: "#F97316",
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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Auth callbacks must always reach the network and must never receive
        // an offline shell containing stale one-time credentials.
        navigateFallbackDenylist: [/^\/auth(?:\/|$)/],
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
        globIgnores: [
          // The native/Electron Turnstile bridge carries one-time challenge
          // state and must always be fetched from the canonical HTTPS origin.
          "turnstile.html",
          "**/assets/*scanner*",
          "**/assets/*tesseract*",
          "**/assets/ReactionBar-*.js",
          "**/assets/apex-vendor-*.js",
          "**/assets/Feed-*.js",
          "**/assets/Messages-*.js",
          "**/assets/BookClub*.js",
          "**/assets/Reviews-*.js",
          "**/assets/ReviewDetail-*.js",
          "**/assets/ScanCover-*.js",
          "**/assets/ScanBarcode-*.js",
        ],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.js$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "brack-lazy-chunks",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Workbox serializes route matchers into the service worker. A
            // RegExp embeds the configured origin without leaking a closure
            // such as the previous undefined `env` runtime reference.
            urlPattern: publicSupabaseStoragePattern,
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
    build: {
      rollupOptions: {
        input: {
          app: path.resolve(__dirname, "index.html"),
          turnstile: path.resolve(__dirname, "turnstile.html"),
        },
        output: {
          manualChunks: {
            // Vendor chunks for better caching
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
            'query-vendor': ['@tanstack/react-query', '@tanstack/react-query-persist-client'],
            'supabase-vendor': ['@supabase/supabase-js'],
            'apex-vendor': ['apexcharts', 'react-apexcharts'],
            'animation-vendor': ['gsap', '@gsap/react', 'framer-motion'],
            'offline-vendor': ['dexie', 'fflate', 'papaparse'],
          },
        },
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
      // Enable source maps for production debugging (optional)
      sourcemap: false,
    },
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@supabase/supabase-js',
        '@tanstack/react-query',
      ],
    },
  };
});
