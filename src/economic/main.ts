import './economic.css';
import { EconomicApp } from './ui';

const root = document.getElementById('economic-root');
if (root) {
  document.title = document.documentElement.lang === 'fa' ? 'چوک‌پوینت — بقای اقتصادی' : 'Chokepoint — Economic Survival';
  new EconomicApp(root);
}

// PWA: this page installs and reloads offline after a first visit, like the theatre game.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is best-effort */
    });
  });
}
