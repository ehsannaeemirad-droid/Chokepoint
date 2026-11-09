/**
 * Localisation. Two languages, one flat dictionary, no dependencies.
 */

export type Lang = 'en' | 'fa';

type Entry = readonly [en: string, fa: string];

const DICT = {
  'app.title': ['Chokepoint', 'چوک‌پوینت'],
  'tip.menu': ['Campaign menu: new game, saves and replay export.', 'منوی کارزار: بازی تازه، ذخیره‌ها و خروجی بازپخش.'],
  'tip.hormuz': ['Hormuz disruption.', 'اختلال هرمز.'],
  'tip.lang': ['Switch language', 'تغییر زبان'],
  'btn.endTurn': ['END TURN', 'پایان نوبت'],
  'btn.forces': ['FORCES', 'نیروها'],
  'btn.intel': ['INTEL', 'اطلاعات'],
  'btn.log': ['LOG', 'گزارش'],
  'btn.continue': ['CONTINUE', 'ادامه'],
  'btn.close': ['Close', 'بستن'],
  'btn.zoomIn': ['Zoom in', 'بزرگ‌نمایی'],
  'btn.zoomOut': ['Zoom out', 'کوچک‌نمایی'],
  'btn.recentre': ['Centre on selection', 'تمرکز روی انتخاب'],
  'btn.myForces': ['My forces', 'نیروهای من'],
  'btn.nextThreat': ['Next threat', 'تهدید بعدی'],
  'btn.minimap': ['Minimap', 'نقشه کوچک'],
  'btn.jump': ['Jump', 'پرش'],
  'panel.forces': ['Forces', 'نیروها'],
  'panel.strategic': ['Strategic', 'راهبردی'],
  'panel.log': ['Log', 'گزارش'],
  'label.hormuz': ['HORMUZ', 'هرمز'],
  'toast.ready': ['Ready.', 'آماده.'],
  'toast.invalid': ['Invalid order.', 'دستور نامعتبر.'],
  'obj.nuclear': ['Nuclear complex', 'مجتمع هسته‌ای'],
  'obj.warCost': ['Iran war cost', 'هزینه جنگ ایران'],
  'obj.domestic': ['Domestic pressure', 'فشار داخلی'],
  'obj.basing': ['Gulf basing', 'پایگاه‌های خلیج'],
  'obj.hormuz': ['Hormuz open', 'هرمز باز'],
  'obj.enemyNuclear': ['Enemy nuclear progress', 'پیشرفت هسته‌ای دشمن'],
  'obj.grade': ['Campaign grade', 'نمره کارزار'],
  'obj.impact': ['Impact preview', 'پیش‌بینی اثر'],
  'obj.afterAction': ['This turn', 'این نوبت'],
  'coach.title': ['First turns', 'نوبت‌های نخست'],
  'coach.dismiss': ['Got it', 'متوجه شدم'],
  'path.regimeSurvival': ['Regime survival', 'بقای نظام'],
  'path.noOccupation': ['No occupation', 'بدون اشغال'],
  'path.oilShock': ['Oil shock', 'شوک نفتی'],
  'path.israeliDegradation': ['Israeli degradation', 'تضعیف اسرائیل'],
} as const satisfies Record<string, Entry>;

export type StringKey = keyof typeof DICT;

const STORAGE_KEY = 'chokepoint.lang';
const listeners = new Set<() => void>();
let lang: Lang = 'en';
let revision = 0;

function detect(): Lang {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'fa' || stored === 'en') return stored;
    }
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fa')) return 'fa';
  } catch {
    /* storage may be unavailable */
  }
  return 'en';
}

lang = detect();

function applyDocument(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
}

applyDocument();

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  revision += 1;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* persistence is best-effort */
  }
  applyDocument();
  for (const listener of listeners) listener();
}

export function onLangChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  const entry = DICT[key];
  let text = entry ? entry[lang === 'fa' ? 1 : 0] : String(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function localName(node: { name: string; name_fa?: string }): string {
  return lang === 'fa' && node.name_fa ? node.name_fa : node.name;
}

export function localEffect(node: { effect: string; effect_fa?: string }): string {
  return lang === 'fa' && node.effect_fa ? node.effect_fa : node.effect;
}

export function getRevision(): number {
  return revision;
}
