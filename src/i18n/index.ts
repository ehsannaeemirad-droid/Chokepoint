/** RESTORED - see root i18n/index.ts for full DICT; build will use this path */
export type Lang = 'en' | 'fa';
type Entry = readonly [en: string, fa: string];
const DICT = {
  'app.title': ['Chokepoint', 'چوک‌پوینت'],
  'btn.endTurn': ['END TURN', 'پایان نوبت'],
  'btn.victory': ['VICTORY', 'پیروزی'],
  'btn.defeat': ['DEFEAT', 'شکست'],
  'btn.forces': ['FORCES', 'نیروها'],
  'btn.intel': ['INTEL', 'اطلاعات'],
  'btn.log': ['LOG', 'گزارش'],
  'btn.close': ['Close', 'بستن'],
  'btn.cancel': ['CANCEL', 'لغو'],
  'btn.save': ['SAVE', 'ذخیره'],
  'btn.load': ['LOAD', 'بارگذاری'],
  'btn.start': ['START CAMPAIGN', 'آغاز کارزار'],
  'btn.continue': ['CONTINUE', 'ادامه'],
  'panel.forces': ['Forces', 'نیروها'],
  'panel.strategic': ['Strategic', 'راهبردی'],
  'panel.log': ['Turn log', 'گزارش نوبت'],
  'panel.hostOpen': ['Open', 'باز'],
  'panel.hostRestricted': ['Restricted', 'محدود'],
  'panel.hostClosed': ['Closed', 'بسته'],
  'nav.title': ['Jump to', 'پرش به'],
  'obj.nuclear': ['Nuclear complex', 'مجتمع هسته‌ای'],
  'obj.warCost': ['Iran war cost', 'هزینه جنگ ایران'],
  'obj.domestic': ['Domestic pressure', 'فشار داخلی'],
  'obj.basing': ['Gulf basing', 'پایگاه‌های خلیج'],
  'obj.hormuz': ['Hormuz open', 'هرمز باز'],
  'obj.enemyNuclear': ['Enemy nuclear progress', 'پیشرفت هسته‌ای دشمن'],
  'obj.grade': ['Campaign grade', 'نمره کارزار'],
  'obj.impact': ['Impact preview', 'پیش‌بینی اثر'],
  'obj.afterAction': ['This turn', 'این نوبت'],
  'coach.title': ['Quick start', 'شروع سریع'],
  'coach.gotIt': ['Got it', 'متوجه شدم'],
  'path.satisfied': ['ACHIEVED', 'محقق شد'],
  'path.pending': ['IN PROGRESS', 'در جریان'],
  'path.atEnd': ['final turn', 'نوبت پایانی'],
  'path.regimeSurvival': ['Regime survival', 'بقای رژیم'],
  'path.noOccupation': ['No occupation', 'بدون اشغال'],
  'path.oilShock': ['Oil shock', 'شوک نفتی'],
  'path.israeliDegradation': ['Israeli offense degraded', 'تضعیف بازوی تهاجمی اسرائیل'],
} as const satisfies Record<string, Entry>;
export type StringKey = keyof typeof DICT;
const STORAGE_KEY = 'chokepoint.lang';
const listeners = new Set<() => void>();
let lang: Lang = 'en';
function detect(): Lang {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'fa' || stored === 'en') return stored;
    }
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fa')) return 'fa';
  } catch {}
  return 'en';
}
function applyDocument(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'fa' ? 'rtl' : 'ltr';
}
export function getLang(): Lang { return lang; }
export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  applyDocument();
  listeners.forEach((fn) => fn());
}
export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function t(key: StringKey): string {
  const entry = (DICT as Record<string, Entry>)[key];
  if (!entry) return key as string;
  return lang === 'fa' ? entry[1] : entry[0];
}
export function localName(record: { name: string; name_fa?: string }): string {
  return lang === 'fa' && record.name_fa ? record.name_fa : record.name;
}
export function localEffect(record: { effect: string; effect_fa?: string }): string {
  return lang === 'fa' && record.effect_fa ? record.effect_fa : record.effect;
}
export function initLang(): void { lang = detect(); applyDocument(); }
initLang();
