import { createRoot } from 'react-dom/client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'

if (import.meta.env.PROD && !window.brackDesktop) {
  registerSW({
    immediate: true,
  });
}

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    })
    .catch(() => undefined);
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
