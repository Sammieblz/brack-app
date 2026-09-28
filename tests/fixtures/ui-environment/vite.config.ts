import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import path from "node:path";
import baseTailwind from "../../../apps/client/tailwind.config";
const client = path.resolve(__dirname, "../../../apps/client");
export default defineConfig({
  cacheDir: path.resolve(__dirname, '../../../node_modules/.vite/ui-environment'),
  root: __dirname, publicDir: false, plugins: [react()],
  resolve: { alias: [
    { find: "@/hooks/useHapticFeedback", replacement: path.join(__dirname, "haptics.ts") },
    { find: /^@capacitor\/core$/, replacement: path.join(__dirname, "capacitor.ts") },
    { find: /^@capacitor\/(browser|app-launcher)$/, replacement: path.join(__dirname, "plugins.ts") },
    { find: "@", replacement: path.join(client, "src") },
  ] },
  css: { postcss: { plugins: [tailwindcss({ ...baseTailwind,
    content: [path.join(client, "src/**/*.{ts,tsx}"), path.join(__dirname, "**/*.{ts,tsx}")],
  }), autoprefixer()] } },
  server: { host: "127.0.0.1", port: 8089, strictPort: true, hmr: false,
    fs: { allow: [path.resolve(__dirname, "../../..")] }, watch: { ignored: ["**/*.{test,spec}.{ts,tsx}"] } },
});
