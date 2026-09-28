import { createRoot } from 'react-dom/client';
import '@/index.css';
import './style.css';
import { initializeTheme } from './theme';
import { FitExperience } from './experience';
import { RadixSurface } from './radix-surface';

initializeTheme();
createRoot(document.getElementById('root')!).render(<FitExperience Surface={RadixSurface} kind="existing Radix dialog" />);
