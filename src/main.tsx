import { createRoot } from 'react-dom/client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'

if (!window.brackDesktop) {
  registerSW({
    immediate: true,
  });
}

createRoot(document.getElementById("root")!).render(
  <NextThemesProvider 
    attribute="class" 
    defaultTheme="light" 
    enableSystem
    storageKey="theme-mode"
  >
    <App />
  </NextThemesProvider>
);
