import './national.css';
import { NationalApp } from './ui';

const root = document.getElementById('national-root');
if (root) {
  document.title = document.documentElement.lang === 'fa' ? 'چوک‌پوینت — فرمان ملی' : 'Chokepoint — National Command';
  new NationalApp(root);
}
