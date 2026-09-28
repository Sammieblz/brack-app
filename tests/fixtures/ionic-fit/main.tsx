import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import '@/index.css';
import './style.css';
import { initializeTheme } from './theme';
import { FitExperience } from './experience';
import { IonicSurface } from './ionic-surface';

const params = new URLSearchParams(location.search);
// The surface owns the live motion preference. A false global value would keep
// overriding its animated prop after the system preference changes.
setupIonicReact({ mode: params.get('runtime') === 'native' && params.get('mode') !== 'md' ? 'ios' : 'md',
  animated: true });
initializeTheme();
createRoot(document.getElementById('root')!).render(<FitExperience Surface={IonicSurface} kind="Ionic modal" />);
