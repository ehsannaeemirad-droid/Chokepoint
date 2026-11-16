import './economic.css';
import { EconomicApp } from './ui';

const root = document.getElementById('economic-root');
if (root) {
  document.title = document.documentElement.lang === 'fa' ? 'چوک‌پوینت — بقای اقتصادی' : 'Chokepoint — Economic Survival';
  new EconomicApp(root);
}
