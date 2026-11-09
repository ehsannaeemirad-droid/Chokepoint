/**
 * Localisation. Two languages, one flat dictionary, no dependencies.
 * Missing keys fall back to the key string so typecheck stays green.
 */
export type Lang = 'en' | 'fa';

type Entry = readonly [en: string, fa: string];

const DICT: Record<string, Entry> = {
  'app.title': ['Chokepoint', 'چوک‌پوینت'],
  'btn.forces': ['FORCES', 'نیروها'],
  'btn.intel': ['INTEL', 'اطلاعات'],
  'btn.log': ['LOG', 'گزارش'],
  'btn.endTurn': ['END TURN', 'پایان نوبت'],
  'btn.victory': ['VICTORY', 'پیروزی'],
  'btn.defeat': ['DEFEAT', 'شکست'],
  'btn.cancel': ['CANCEL', 'لغو'],
  'btn.close': ['Close', 'بستن'],
  'btn.save': ['SAVE', 'ذخیره'],
  'btn.load': ['LOAD', 'بارگذاری'],
  'btn.start': ['START CAMPAIGN', 'آغاز کارزار'],
  'btn.continue': ['CONTINUE', 'ادامه'],
  'btn.move': ['MOVE', 'حرکت'],
  'btn.attack': ['ATTACK', 'حمله'],
  'btn.strike': ['STRIKE', 'حمله'],
  'btn.hold': ['HOLD', 'حفظ موضع'],
  'btn.deselect': ['DESELECT', 'لغو انتخاب'],
  'btn.nextUnit': ['NEXT READY UNIT', 'یگان آماده بعدی'],
  'btn.sabotage': ['SABOTAGE', 'خرابکاری'],
  'btn.cyber': ['CYBER', 'سایبری'],
  'btn.signal': ['SIGNAL', 'رایزنی'],
  'btn.jump': ['Jump to location', 'پرش به مکان'],
  'btn.myForces': ['My forces', 'نیروهای من'],
  'btn.nextThreat': ['Next threat', 'تهدید بعدی'],
  'btn.minimap': ['Minimap', 'نقشه کوچک'],
  'btn.zoomIn': ['Zoom in', 'بزرگ‌نمایی'],
  'btn.zoomOut': ['Zoom out', 'کوچک‌نمایی'],
  'btn.recentre': ['Centre on selection', 'تمرکز روی انتخاب'],
  'btn.centre': ['CENTRE', 'مرکز'],
  'btn.selectUnit': ['SELECT A UNIT', 'انتخاب یگان'],
  'btn.del': ['DEL', 'حذف'],
  'btn.exportReplay': ['EXPORT REPLAY JSON', 'خروجی بازپخش JSON'],
  'btn.communicate': ['PUBLIC ADDRESS', 'پیام عمومی'],
  'panel.forces': ['Forces', 'نیروها'],
  'panel.strategic': ['Strategic', 'راهبردی'],
  'panel.log': ['Turn log', 'گزارش نوبت'],
  'panel.hostOpen': ['Open', 'باز'],
  'panel.hostRestricted': ['Restricted', 'محدود'],
  'panel.hostClosed': ['Closed', 'بسته'],
  'panel.domestic': ['Domestic pressure', 'فشار داخلی'],
  'panel.basing': ['Gulf basing', 'پایگاه‌های خلیج'],
  'panel.hosts': ['Host nations', 'کشورهای میزبان'],
  'panel.hormuz': ['Hormuz fire control', 'کنترل آتش هرمز'],
  'panel.warCost': ['War cost', 'هزینه جنگ'],
  'panel.reinforcements': ['Reinforcements', 'نیروهای کمکی'],
  'panel.airlift': ['Airlift', 'ترابری هوایی'],
  'panel.victoryPaths': ['Victory paths', 'مسیرهای پیروزی'],
  'nav.title': ['Jump to', 'پرش به'],
  'nav.search': ['Search name (English / Persian)…', 'جستجوی نام (انگلیسی/فارسی)…'],
  'nav.empty': ['No locations match.', 'موردی مطابقت ندارد.'],
  'nav.kind.all': ['All', 'همه'],
  'nav.kind.airbase': ['Airbases', 'پایگاه‌های هوایی'],
  'nav.kind.nuclear': ['Nuclear', 'هسته‌ای'],
  'nav.kind.oil': ['Oil', 'نفت'],
  'nav.kind.urban': ['Cities', 'شهرها'],
  'nav.kind.naval': ['Naval', 'دریایی'],
  'nav.kind.port': ['Ports', 'بندرها'],
  'nav.kind.chokepoint': ['Chokepoints', 'گلوگاه‌ها'],
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
  'gauge.int': ['INT', 'پدافند'],
  'gauge.will': ['WILL', 'اراده'],
  'gauge.lift': ['LIFT', 'ترابری'],
  'gauge.tank': ['TANK', 'سوخت‌رسان'],
  'gauge.drone': ['DRONE', 'پهپاد'],
  'gauge.ball': ['BALL', 'موشک'],
  'gauge.res': ['RES', 'منابع'],
  'gauge.congress': ['CONGRESS', 'کنگره'],
  'gauge.econ': ['ECON', 'اقتصاد'],
  'label.hormuz': ['HORMUZ', 'هرمز'],
  'order.hint': ['queued — resolves on END TURN', 'ثبت شد — در پایان نوبت اجرا می‌شود'],
  'tip.lang': ['Switch language (English / Persian)', 'تغییر زبان (فارسی / انگلیسی)'],
  'tip.menu': ['Campaign menu', 'منوی کارزار'],
  'tip.hormuz': ['Hormuz disruption meter', 'شاخص اختلال هرمز'],
};

export type StringKey = string;

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

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
  applyDocument();
  listeners.forEach((fn) => fn());
}

export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function t(key: StringKey): string {
  const entry = DICT[key];
  if (!entry) return key;
  return lang === 'fa' ? entry[1] : entry[0];
}

export function localName(record: { name: string; name_fa?: string }): string {
  return lang === 'fa' && record.name_fa ? record.name_fa : record.name;
}

export function localEffect(record: { effect: string; effect_fa?: string }): string {
  return lang === 'fa' && record.effect_fa ? record.effect_fa : record.effect;
}

export function initLang(): void {
  lang = detect();
  applyDocument();
}

initLang();
