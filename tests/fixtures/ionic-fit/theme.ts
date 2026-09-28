import { getTheme } from '@/lib/themes';

/** Actual BRACK palettes, without auth/preferences or an alternate theme store. */
export function initializeTheme() {
  const params = new URLSearchParams(window.location.search);
  const root = document.documentElement;
  const theme = getTheme(params.get('palette') ?? 'default');
  const dark = params.get('theme') === 'dark';
  root.classList.toggle('dark', dark);
  root.dataset.brackThemeStyle = theme.surfaceStyle ?? 'standard';
  root.classList.add(`brack-theme-${theme.surfaceStyle ?? 'standard'}`);
  root.lang = params.get('locale') ?? 'en-US';
  if (params.get('text') === '200') root.style.fontSize = '32px';
  const colors = dark ? theme.colors.dark : theme.colors.light;
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/chart(\d+)/g, 'chart-$1')}`, value);
  }
  // Ionic components consume full CSS colors; BRACK tokens contain HSL channels.
  root.style.setProperty('--ion-font-family', "'Inter', system-ui, -apple-system, sans-serif");
  root.style.setProperty('--fit-background-channels', colors.background);
  root.style.setProperty('--ion-background-color', 'hsl(var(--background))');
  root.style.setProperty('--ion-text-color', 'hsl(var(--foreground))');
  root.style.setProperty('--ion-color-primary', 'hsl(var(--primary))');
  root.style.setProperty('--ion-color-primary-contrast', 'hsl(var(--primary-foreground))');
}
