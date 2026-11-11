/**
 * Persian rendering for simulation-generated text: turn-log lines, resolution
 * cinematic lines and campaign outcome reports.
 *
 * The engine emits English strings and stores them in the snapshot (that is
 * what keeps replays byte-identical). This module is the presentation-layer
 * translation pass: ordered [pattern, template] pairs where the pattern has
 * NAMED capture groups and the template interpolates exactly those names —
 * ` casualtiesTurn`, `supportBefore`, `progress`… — never positional
 * concatenation. The first matching pattern wins; an unmatched line falls
 * back to the English original and the UI keeps its "engine lines are
 * English" note for those.
 *
 * Outcome texts are a closed set (victory.ts / engine.ts), so those translate
 * through an exact-match dictionary with full coverage asserted by tests.
 */

interface LogPattern {
  pattern: RegExp;
  template: string;
}

const LOG_PATTERNS: LogPattern[] = [
  // ---- domestic system (Phase 2) ------------------------------------------
  {
    pattern: /^Casualty report \(turn (?<turn>\d+)\): (?<events>\d+) US casualty events? this turn, (?<total>\d+) to date\. Congressional support (?<before>[\d.]+) → (?<after>[\d.]+)\.$/,
    template:
      'گزارش تلفات (نوبت {turn}): {events} رویداد تلفات آمریکا در این نوبت، {total} تاکنون. حمایت کنگره {before} ← {after}.',
  },
  {
    pattern: /^Congress passes a resolution demanding a withdrawal timeline\.$/,
    template: 'کنگره قطعنامه‌ای برای تعیین زمان‌بندی عقب‌نشینی تصویب می‌کند.',
  },
  {
    pattern: /^Congressional leadership demands a briefing on escalation risk\.$/,
    template: 'رهبری کنگره جلسه توجیحی درباره خطر تشدید می‌خواهد.',
  },
  {
    pattern: /^Congressional restriction announced: (?<what>.+), effective from the start of turn (?<turn>\d+) \(support (?<support>[\d.]+)\)\.$/,
    template: 'محدودیت کنگره اعلام شد: {what}، از آغاز نوبت {turn} (حمایت {support}).',
  },
  {
    pattern: /^Congressional restriction will be lifted at the start of turn (?<turn>\d+) \(support (?<support>[\d.]+)\)\.$/,
    template: 'محدودیت کنگره از آغاز نوبت {turn} برداشته می‌شود (حمایت {support}).',
  },
  {
    pattern: /^Congressional restriction in effect: US strikes inside Iranian territory are forbidden\.$/,
    template: 'محدودیت کنگره لازم‌الاجرا شد: حمله آمریکا به خاک ایران ممنوع است.',
  },
  {
    pattern: /^Congressional restriction in effect: all US offensive strikes are suspended\.$/,
    template: 'محدودیت کنگره لازم‌الاجرا شد: همه حملات تهاجمی آمریکا متوقف می‌شود.',
  },
  {
    pattern: /^Congressional restriction lifted: US offensive operations resume\.$/,
    template: 'محدودیت کنگره برداشته شد: عملیات تهاجمی آمریکا از سر گرفته می‌شود.',
  },
  {
    pattern: /^Economic pressure at home (?<before>\d+) → (?<after>\d+) \(inflation (?<inflation>\d+)%\)\.$/,
    template: 'فشار اقتصادی داخلی {before} ← {after} (تورم {inflation}٪).',
  },
  {
    pattern: /^Airlift regeneration (?<dir>cut|restored) to \+(?<n>\d+)\/turn \(economic pressure (?<econ>\d+)\)\.$/,
    template:
      '{dir,select,cut|کاهش|بازیابی} ظرفیت ترابری هوایی به {n}/نوبت (فشار اقتصادی {econ}).',
  },
  {
    pattern: /^Interceptor resupply (?<dir>cut|restored): (?<a>\d+) → (?<b>\d+) per airlift cycle \(economic pressure (?<econ>\d+)\)\.$/,
    template:
      'پشتیبانی موشک رهگیر {dir,select,cut|کاهش|بازیابی}: {a} ← {b} در هر سیکل ترابری (فشار اقتصادی {econ}).',
  },
  {
    pattern: /^Public address: the administration makes its case to Congress and the country \(support (?<before>[\d.]+) → (?<after>[\d.]+)\)\.$/,
    template: 'پیام عمومی: دولت موضع خود را به کنگره و کشور اعلام می‌کند (حمایت {before} ← {after}).',
  },
  // ---- initiative + talks (Phase 3) ---------------------------------------
  {
    pattern: /^Israel presses for a freer hand: initiative (?<level>[\d.]+) — with Washington's assent it would fly expanded strike packages\.$/,
    template: 'اسرائیل خواستار اختیار بیشتر است: ابتکار {level} — با موافقت واشنگتن بسته‌های حمله گسترده‌تر پرواز می‌کند.',
  },
  {
    pattern: /^Israeli operations contract to the standard one package per turn \(initiative (?<level>[\d.]+)\)\.$/,
    template: 'عملیات اسرائیل به یک بسته حمله در نوبت محدود شد (ابتکار {level}).',
  },
  {
    pattern: /^Washington approves expanded Israeli operations: initiative (?<level>[\d.]+) — Israel may fly two strike packages a turn above (?<threshold>\d+)\.$/,
    template: 'واشنگتن عملیات گسترده‌تر اسرائیل را تأیید کرد: ابتکار {level} — اسرائیل بالای {threshold} می‌تواند دو بسته حمله در نوبت پرواز کند.',
  },
  {
    pattern: /^Washington constrains Israeli operations: initiative (?<level>[\d.]+) — Israeli aircraft stand down from offensive missions\.$/,
    template: 'واشنگتن عملیات اسرائیل را محدود کرد: ابتکار {level} — هواپیماهای اسرائیل از مأموریت تهاجمی کنار می‌روند.',
  },
  { pattern: /^Washington returns to accepting Israeli initiative as it comes\.$/, template: 'واشنگتن به پذیرش جریان عادی ابتکار اسرائیل بازمی‌گردد.' },
  {
    pattern: /^Israel flies an expanded strike package under its initiative track \((?<level>[\d.]+) ≥ (?<threshold>\d+)\)\.$/,
    template: 'اسرائیل بسته حمله گسترده را بر پایه مسیر ابتکار خود اجرا می‌کند ({level} ≥ {threshold}).',
  },
  {
    pattern: /^Israeli aircraft stand down from offensive missions under the US constraint\.$/,
    template: 'هواپیماهای اسرائیل به دلیل محدودیت آمریکا از مأموریت تهاجمی کنار می‌روند.',
  },
  {
    pattern: /^Qatar offers to mediate a ceasefire: Doha sees a window before the war burns out\. Pursue the talks or walk away\.$/,
    template: 'قطر پیشنهاد میانجی‌گری آتش‌بس می‌دهد: دوحا پیش از فرسایش کامل جنگ، پنجره‌ای می‌بیند. مذاکرات را پیگیری کنید یا کنار بروید.',
  },
  {
    pattern: /^The Qatari mediation offer lapsed unanswered; Doha will not raise it again for a while\.$/,
    template: 'پیشنهاد میانجی‌گری قطر بی‌پاسخ ماند؛ دوحا مدتی دیگر آن را مطرح نمی‌کند.',
  },
  {
    pattern: /^Strikes on Iranian soil during the talks set the mediation back \(−(?<penalty>\d+) progress\)\.$/,
    template: 'حمله به خاک ایران در جریان مذاکرات، میانجی‌گری را عقب می‌برد (−{penalty} پیشرفت).',
  },
  {
    pattern: /^Ceasefire talks in Doha progress: (?<progress>\d+)\/(?<agree>\d+)\.$/,
    template: 'مذاکرات آتش‌بس در دوحا پیش می‌رود: {progress}/{agree}.',
  },
  {
    pattern: /^Washington takes up the Qatari track: talks open in Doha at (?<progress>\d+)\/(?<agree>\d+) progress\.$/,
    template: 'واشنگتن مسیر قطر را می‌پذیرد: مذاکرات در دوحا با پیشرفت {progress}/{agree} آغاز می‌شود.',
  },
  { pattern: /^Washington walks away from the Qatari track; the war continues and Doha steps back\.$/, template: 'واشنگتن از مسیر قطر کنار می‌رود؛ جنگ ادامه می‌یابد و دوحا عقب می‌نشیند.' },
  // ---- escalation ladder + red lines (improvement 1) ------------------------
  {
    pattern: /^Escalation ladder rung (?<level>\d+) of (?<max>\d+) \(escalation (?<meter>\d+)\)\.$/,
    template: 'نردبان تشدید به پله {level} از {max} رسید (تشدید {meter}).',
  },
  {
    pattern: /^Escalation ladder eased to rung (?<level>\d+) \(escalation (?<meter>\d+)\)\.$/,
    template: 'نردبان تشدید به پله {level} عقب نشست (تشدید {meter}).',
  },
  // The red-line labels come from scenario data; each known line translates the
  // frame and label. The effect numbers keep their English shorthand (fallback
  // convention: unmatched fragments stay English, like the rest of the log).
  {
    pattern: /^RED LINE CROSSED — Nuclear weapons used: (?<parts>.+)\.$/,
    template: 'خط سرخ شکسته شد — استفاده از سلاح هسته‌ای: {parts}.',
  },
  {
    pattern: /^RED LINE CROSSED — Leadership decapitation attempted: (?<parts>.+)\.$/,
    template: 'خط سرخ شکسته شد — تلاش برای از بین بردن رهبری: {parts}.',
  },
  {
    pattern: /^RED LINE CROSSED — Iranian nuclear complex destroyed: (?<parts>.+)\.$/,
    template: 'خط سرخ شکسته شد — نابودی مجتمع هسته‌ای ایران: {parts}.',
  },
  {
    pattern: /^RED LINE CROSSED — Hormuz strangled for four turns: (?<parts>.+)\.$/,
    template: 'خط سرخ شکسته شد — چهار نوبت اختلال شدید در هرمز: {parts}.',
  },
  // ---- ROE postures (improvement 6) -----------------------------------------
  {
    pattern: /^Rules of engagement set to CONSTRAINED: (?<parts>.+)\.$/,
    template: 'قواعد درگیری روی «محدود» تنظیم شد: {parts}.',
  },
  {
    pattern: /^Rules of engagement set to STANDARD: (?<parts>.+)\.$/,
    template: 'قواعد درگیری روی «معمول» تنظیم شد: {parts}.',
  },
  {
    pattern: /^Rules of engagement set to AGGRESSIVE: (?<parts>.+)\.$/,
    template: 'قواعد درگیری روی «تهاجمی» تنظیم شد: {parts}.',
  },
  // ---- graded settlement (improvement 7) -------------------------------------
  {
    pattern: /^Settlement — Iran (?<iran>\d+), coalition (?<coalition>\d+) \([+−-]?(?<margin>\d+) margin\)\.$/,
    template: 'مصوبه پایانی — ایران {iran}، ائتلاف {coalition} (اختلاف {margin}).',
  },
  // ---- combat ---------------------------------------------------------------
  {
    pattern: /^(?<system>.+?) intercepted (?<n>\d+)\/(?<total>\d+) (?<label>.+)\.$/,
    template: '{system} {n} از {total} فروند {label} را رهگیری کرد.',
  },
  {
    pattern: /^(?<n>\d+) (?<label>.+) impacts? at (?<where>.+?)(?: — integrity (?<int>\d+)%)?\.$/,
    template: '{n} فروند {label} به {where} اصابت کرد{int,optional, — یکپارچگی {int}٪|}.',
  },
  {
    pattern: /^(?<name>.+) destroyed at (?<col>-?\d+),(?<row>-?\d+)\.$/,
    template: '{name} در {col}،{row} نابود شد.',
  },
  {
    pattern: /^(?<name>.+) destroyed by (?<by>.+)\.$/,
    template: '{name} به دست {by} نابود شد.',
  },
  {
    pattern: /^(?<name>.+) hit \(strength (?<n>\d+)%\)\.$/,
    template: '{name} اصابت دید (قدرت {n}٪).',
  },
  {
    pattern: /^(?<name>.+) was lost on the return leg — no replacement available this campaign\.$/,
    template: '{name} در مسیر بازگشت از دست رفت — در این کارزار جایگزینی در کار نیست.',
  },
  {
    pattern: /^(?<name>.+) struck (?<target>.+?) \(integrity (?<int>\d+)%\)\.$/,
    template: '{name} به {target} حمله کرد (یکپارچگی {int}٪).',
  },
  {
    pattern: /^(?<name>.+) struck enemy forces at (?<col>-?\d+),(?<row>-?\d+)\.$/,
    template: '{name} به نیروهای دشمن در {col}،{row} حمله کرد.',
  },
  {
    pattern: /^(?<name>.+) struck (?<target>.+?) — surface plant wrecked, the halls (?<depth>\d+) m underground are untouched \((?<int>\d+)%\)$/,
    template: '{name} به {target} حمله کرد — تأسیسات سطحی ویران شد اما سالن‌های {depth} متری زیر زمین دست‌نخورده ماند ({int}٪)',
  },
  {
    pattern: /^Air defences intercepted (?<n>\d+) of (?<total>\d+) munitions? from (?<name>.+)( \((?<by>.+)\))?\.$/,
    template: 'پدافند هوایی {n} از {total} مهمات {name} را رهگیری کرد{by,optional, ({by})|}.',
  },
  {
    pattern: /^(?<name>.+) has no munitions\.$/,
    template: '{name} مهماتی ندارد.',
  },
  // ---- logistics / production ----------------------------------------------
  {
    pattern: /^Strategic airlift delivered (?<n>\d+) interceptors to the Gulf\.$/,
    template: 'ترابری راهبردی {n} موشک رهگیر به خلیج رساند.',
  },
  {
    pattern: /^(?<label>.+) requested from CONUS — arrives in (?<n>\d+) turns(?: \(Suez is closed\))?(?: — Gulf shipping under threat, expect strait delays)?\.$/,
    template: '{label} از خاک آمریکا درخواست شد — در {n} نوبت می‌رسد.',
  },
  {
    pattern: /^Strait risk delays (?<label>.+): ETA slips to turn (?<n>\d+)\.$/,
    template: 'خطر تنگه، {label} را عقب می‌اندازد: رسیدن به نوبت {n}.',
  },
  {
    pattern: /^US airlift allocated to Israel: 15 interceptors arrive in 2 turns\.$/,
    template: 'ترابری هوایی آمریکا به اسرائیل اختصاص یافت: ۱۵ رهگیر در ۲ نوبت می‌رسد.',
  },
  {
    pattern: /^(?<label>.+) arrived: interceptors replenished\.$/,
    template: '{label} رسید: موشک‌های رهگیر بازپر شد.',
  },
  {
    pattern: /^(?<name>.+) arrived in theatre and is ready for tasking\.$/,
    template: '{name} به تئاتر رسید و آماده مأموریت است.',
  },
  {
    pattern: /^Iran's production lines added (?<n>\d+) (?<what>.+) to the stockpile\.$/,
    template: 'خطوط تولید ایران {n} {what} به ذخایر افزود.',
  },
  {
    pattern: /^Iran's underground lines produced (?<what>.+); stock now (?<drones>\d+) drones, (?<missiles>\d+) ballistic missiles\.$/,
    template: 'خطوط زیرزمینی ایران {what} تولید کرد؛ ذخیره: {drones} پهپاد، {missiles} موشک بالستیک.',
  },
  {
    pattern: /^Iran launched (?<n>\d+) munitions at (?<target>.+)\.$/,
    template: 'ایران {n} مهمات به سوی {target} شلیک کرد.',
  },
  {
    pattern: /^Iran dispersed (?<n>\d+) launch crews to new hides; satellite tasking must find them again\.$/,
    template: 'ایران {n} گروه پرتاب را به پنهانگاه‌های تازه پراکنده کرد؛ ماهواره‌ها باید دوباره آن‌ها را بیابند.',
  },
  {
    pattern: /^IRGC-N laid another minefield near Hormuz \(\+15% disruption\)\.$/,
    template: 'نیروی دریایی سپاه میدان مین دیگری نزدیک هرمز کاشت (+۱۵٪ اختلال).',
  },
  {
    pattern: /^(?<name>.+) repositioned\.$/,
    template: '{name} جابه‌جا شد.',
  },
  {
    pattern: /^(?<name>.+) repositioned; the move exposed its launch site to coalition reconnaissance\.$/,
    template: '{name} جابه‌جا شد؛ جابه‌جایی محل پرتاب را برای شناسایی ائتلاف آشکار کرد.',
  },
  // ---- politics -------------------------------------------------------------
  {
    pattern: /^(?<host>.+) closed its bases for (?<n>\d+) turns — threat perception (?<threat>[\d.]+) \((?<reason>.+)\)\.$/,
    template: '{host} پایگاه‌هایش را به مدت {n} نوبت بست — حس تهدید {threat} ({reason}).',
  },
  {
    pattern: /^(?<host>.+) restricted offensive missions from its soil — threat perception (?<threat>[\d.]+)\.$/,
    template: '{host} مأموریت‌های تهاجمی از خاک خود را محدود کرد — حس تهدید {threat}.',
  },
  {
    pattern: /^(?<host>.+) restored full base access\.$/,
    template: '{host} دسترسی کامل به پایگاه‌ها را بازگرداند.',
  },
  {
    pattern: /^Washington signalled (?<host>.+): threat perception fell to (?<threat>[\d.]+)\.$/,
    template: 'واشنگتن به {host} پیام داد: حس تهدید به {threat} کاهش یافت.',
  },
  {
    pattern: /^(?<host>.+) keeps offensive missions restricted — threat perception (?<threat>[\d.]+)\.$/,
    template: '{host} مأموریت‌های تهاجمی را همچنان محدود نگه می‌دارد — حس تهدید {threat}.',
  },
  {
    pattern: /^(?<host>.+) reopened its facilities after the closure expired$/,
    template: '{host} پس از پایان مهلت بستن، تأسیساتش را بازگشایی کرد',
  },
  {
    pattern: /^Pakistan intervened defensively \(roll (?<roll>[\d.]+) < 0\.40\): two fighter squadrons and an air-defence brigade deploy to Saudi Arabia\. It will not attack Iran\.$/,
    template: 'پاکستان مداخله دفاعی کرد (قرعه {roll} < ۰٫۴۰): دو اسکادران شکاری و یک تیپ پدافند به عربستان اعزام می‌شوند. به ایران حمله نمی‌کند.',
  },
  {
    pattern: /^Saudi Arabia requested Pakistani support; Islamabad declined \(roll (?<roll>[\d.]+) ≥ 0\.40\)\.$/,
    template: 'عربستان از پاکستان کمک خواست؛ اسلام‌آباد نپذیرفت (قرعه {roll} ≥ ۰٫۴۰).',
  },
  {
    pattern: /^Egypt closed the Suez Canal, fearing regional spillover\. US reinforcement transit now takes 2 extra turns\.$/,
    template: 'مصر از بیم سرریز جنگ، کانال سوئز را بست. ترانزیت نیروهای کمکی آمریکا ۲ نوبت طولانی‌تر می‌شود.',
  },
  {
    pattern: /^India applied diplomatic pressure on Tehran: Iran's ceasefire threshold fell by 5\. New Delhi wants the war to end, not for Iran to lose\.$/,
    template: 'هند بر تهران فشار دیپلماتیک آورد: آستانه آتش‌بس ایران ۵ واحد افت کرد. دهلی نو پایان جنگ را می‌خواهد، نه شکست ایران را.',
  },
  {
    pattern: /^Qatar offered to mediate a ceasefire; both sides quietly stepped back from the brink \(Qatari threat -6, Iranian war cost \+3\)\.$/,
    template: 'قطر پیشنهاد میانجی‌گری آتش‌بس داد؛ دو طرف بی‌سروصدا از لبه پرتگاه عقب شدند (تهدید قطر −۶، هزینه جنگ ایران +۳).',
  },
  // ---- great powers ----------------------------------------------------------
  {
    pattern: /^Nuclear escalation erodes congressional support: (?<before>[\d.]+) → (?<after>[\d.]+)\.$/,
    template: 'تشدید هسته‌ای حمایت کنگره را فرسایش می‌دهد: {before} ← {after}.',
  },
  {
    pattern: /^Great-power pressure eased: Moscow and Beijing stepped back from the conflict\.$/,
    template: 'فشار قدرت‌های بزرگ کاهش یافت: مسکو و پکن از درگیری عقب کشیدند.',
  },
  {
    pattern: /^Russian and Chinese support for Iran has thinned; the air-defence pipeline slowed\.$/,
    template: 'پشتیبانی روسیه و چین از ایران کم‌رنگ شد؛ خط تأمین پدافند هوایی کند شد.',
  },
  {
    pattern: /^The no-fly zone over Iran has lapsed: coalition aircraft may strike Iranian territory again\.$/,
    template: 'منطقه پرواز ممنوع بر ایران لغو شد: هواپیماهای ائتلاف بار دیگر می‌توانند خاک ایران را بزنند.',
  },
  {
    pattern: /^Moscow and Beijing refused to join new sanctions: Iran can still sell crude and pay for its war \(income \+30%\)\.$/,
    template: 'مسکو و پکن به تحریم‌های تازه نپیوستند: ایران همچنان نفت می‌فروشد و هزینه جنگ را می‌پردازد (درآمد +۳۰٪).',
  },
  {
    pattern: /^Russia rushed air-defence reloads and Chinese advisers to Iran: Iranian air defence is now harder to penetrate\.$/,
    template: 'روسیه مهمات پدافند هوایی و مشاوران چینی به ایران فرستاد: شکستن پدافند ایران دشوارتر شد.',
  },
  {
    pattern: /^Russia and China declared a no-fly zone over Iran\. Coalition aircraft may no longer strike Iranian territory, and American political will bleeds every turn\.$/,
    template: 'روسیه و چین منطقه پرواز ممنوع بر ایران اعلام کردند. هواپیماهای ائتلاف دیگر نمی‌توانند خاک ایران را بزنند و اراده سیاسی آمریکا هر نوبت فرسایش می‌یابد.',
  },
  // ---- closeout: campaign, strategic and production lines -------------------
  {
    pattern: /^27 February 2026 — the eve of the Gulf war\. Stockpiles are at pre-war levels\. Set posture, preposition forces, and decide whether to open with strikes, diplomacy, or restraint\. No automatic first strike until you act or a configured trigger fires\.$/,
    template:
      '۲۷ فوریه ۲۰۲۶ — آستانه جنگ خلیج فارس. ذخایر در سطح پیش از جنگ است. حالت نیروها را تعیین کنید، نیروها را پیش‌دستانه مستقر کنید و تصمیم بگیرید با حمله، دیپلماسی یا خویشتن‌داری آغاز کنید. تا وقتی شما اقدام نکنید یا محرک تنظیم‌شده‌ای فعال نشود، حمله اولیه‌ای رخ نمی‌دهد.',
  },
  {
    pattern: /^You command (?<country>.+)\. (?<turns>\d+) turns\. Every interceptor and every missile is scarce\.$/,
    template: 'شما فرمانده {country} هستید. {turns} نوبت. هر رهگیر و هر موشک کمیاب است.',
  },
  {
    pattern:
      /^Air defences \((?<system>.+)\) intercepted (?<n>\d+) of (?<total>\d+) munitions? from (?<name>.+)\.$/,
    template: 'پدافند هوایی ({system}) {n} از {total} مهمات {name} را رهگیری کرد.',
  },
  {
    pattern:
      /^(?<name>.+) struck (?<target>.+?) — surface plant wrecked, the halls (?<depth>\d+) m underground are untouched \((?<int>\d+)%\)\.$/,
    template:
      '{name} به {target} حمله کرد — تأسیسات سطحی ویران شد اما سالن‌های {depth} متری زیر زمین دست‌نخورده ماند ({int}٪).',
  },
  {
    pattern: /^Beijing refused to join new sanctions: Iran can still sell crude and pay for its war \(income \+30%\)\.$/,
    template: 'پکن از پیوستن به تحریم‌های تازه خودداری کرد: ایران همچنان نفت می‌فروشد و هزینه جنگ را می‌پردازد (درآمد +۳۰٪).',
  },
  {
    pattern:
      /^Beijing signalled it would not restrain Tehran and slowed diplomatic cooperation with Washington \(US political will -2 per turn\)\.$/,
    template:
      'پکن نشان داد تهران را مهار نخواهد کرد و همکاری دیپلماتیک با واشینگتن را کند کرد (اراده سیاسی آمریکا هر نوبت −۲).',
  },
  {
    pattern: /^Chinese banks and refiners deepened sanctions workarounds for Iranian crude \(income \+45%\)\.$/,
    template: 'بانک‌ها و پالایشگاه‌های چین دور زدن تحریم‌ها برای نفت ایران را عمیق‌تر کردند (درآمد +۴۵٪).',
  },
  {
    pattern:
      /^Carrier Strike Group is escorting shipping \(coverage (?<n>\d+)\/(?<total>\d+)\) — Hormuz risk falls while it holds station\.$/,
    template: 'گروه ضربت ناو هواپیمابر در حال اسکورت کشتیرانی است (پوشش {n}/{total}) — تا در جای خود بماند، خطر هرمز کاهش می‌یابد.',
  },
  {
    pattern: /^Coalition warships begin escorting shipping through the Gulf\.$/,
    template: 'ناوهای ائتلاف اسکورت کشتیرانی در خلیج فارس را آغاز کردند.',
  },
  {
    pattern: /^Hostilities open\. Pre-war restraints lift; opposing forces begin military resolution\.$/,
    template: 'خصومت آغاز شد. محدودیت‌های پیش از جنگ برداشته می‌شود و نیروهای مقابل حل‌وفصل نظامی را آغاز می‌کنند.',
  },
  {
    pattern: /^Houthi anti-ship attacks closed the Bab al-Mandeb shipping lane for a day; insurance costs rose\.$/,
    template: 'حملات ضدکشتی حوثی‌ها تنگه باب‌المندب را یک روز بست؛ هزینه بیمه بالا رفت.',
  },
  {
    pattern: /^Houthi launch against (?:a |the )?(?<target>.+)\.$/,
    template: 'پرتاب حوثی‌ها علیه {target}.',
  },
  {
    pattern: /^Iran holds its missile fire to stabilise the home front\.$/,
    template: 'ایران آتش موشکی خود را برای تثبیت جبهه داخلی متوقف کرد.',
  },
  {
    pattern:
      /^Iranian regime stability falls to (?<n>\d+): elite cohesion (?<elite>\d+), IRGC cohesion (?<irgc>\d+)\.$/,
    template: 'ثبات رژیم ایران به {n} سقوط کرد: انسجام نخبگان {elite}، انسجام سپاه {irgc}.',
  },
  {
    pattern: /^Iranian mine warfare group laid a field in the Hormuz approach\.$/,
    template: 'گروه مین‌گذاری ایران در نزدیکی هرمز میدان مین کار گذاشت.',
  },
  {
    pattern:
      /^(?<group>Iranian mine warfare group|Mine Warfare Group) laid (?<n>\d+) mines? at (?<col>-?\d+),(?<row>-?\d+)\.$/,
    template: '{group} {n} مین در {col}،{row} کار گذاشت.',
  },
  {
    pattern: /^Israeli aircraft launched against (?<target>.+) \(doctrine: (?<doctrine>.+)\)\.$/,
    template: 'هواپیماهای اسرائیلی علیه {target} به پرواز درآمدند (دکترین: {doctrine}).',
  },
  {
    pattern: /^Israeli aircraft stand down: domestic support will not sustain more strikes\.$/,
    template: 'هواپیماهای اسرائیلی زمین‌گیر شدند: حمایت داخلی بیش از این تحمل حملات را ندارد.',
  },
  {
    pattern:
      /^Israeli reserve interceptors brought online: \+(?<n>\d+) ready \(reserve (?<reserve>\d+)\)\.$/,
    template: 'رهگیرهای ذخیره اسرائیل وارد مدار شدند: +{n} آماده (ذخیره {reserve}).',
  },
  {
    pattern: /^Moscow expedited air-defence spare parts to Iran: Iranian SAMs are marginally readier\.$/,
    template: 'مسکو قطعات یدکی پدافند هوایی را به ایران فرستاد: سامانه‌های موشکی ایران کمی آماده‌تر شدند.',
  },
  {
    pattern:
      /^Pakistan agreed to defensive support \(roll (?<roll>[\d.]+) < 0\.40\): air-defence crews and intelligence sharing reinforce Prince Sultan Air Base\. No Pakistani combat aircraft deploy, and Pakistan will not attack Iran\.$/,
    template:
      'پاکستان با پشتیبانی دفاعی موافقت کرد (قرعه {roll} < ۰٫۴۰): خدمه پدافند هوایی و اشتراک اطلاعات پایگاه هوایی شاهزاده سلطان را تقویت می‌کنند. هیچ هواپیمای رزمی پاکستان مستقر نمی‌شود و پاکستان به ایران حمله نخواهد کرد.',
  },
  {
    pattern: /^Reserve interceptors brought online: \+(?<n>\d+) US ready \(reserve (?<reserve>\d+)\)\.$/,
    template: 'رهگیرهای ذخیره وارد مدار شدند: +{n} آمریکایی آماده (ذخیره {reserve}).',
  },
  {
    pattern:
      /^Russia declared a no-fly zone over Iran, with Chinese diplomatic backing\. Coalition aircraft may no longer strike Iranian territory; naval-launched strikes are unaffected\.$/,
    template:
      'روسیه با پشتیبانی دیپلماتیک چین منطقه پرواز ممنوع بر ایران اعلام کرد. هواپیماهای ائتلاف دیگر نمی‌توانند خاک ایران را بزنند؛ حملات از دریا بی‌تأثیر نمی‌مانند.',
  },
  {
    pattern: /^Russia rushed air-defence reloads and radar crews to Iran: Iranian air defence is harder to penetrate\.$/,
    template: 'روسیه مهمات پدافند و خدمه رادار را به ایران فرستاد: شکستن پدافند ایران دشوارتر شد.',
  },
  {
    pattern: /^Saudi counter-battery fire destroyed a Houthi (?<target>.+) after oil infrastructure was hit\.$/,
    template: 'آتش ضدباتری سعودی یک {target} حوثی را پس از اصابت به زیرساخت نفتی نابود کرد.',
  },
  {
    pattern: /^Saudi counter-battery fire missed a Houthi launch site\.$/,
    template: 'آتش ضدباتری سعودی به محل پرتاب حوثی‌ها نرسید.',
  },
  {
    pattern: /^US aircraft launched against (?<target>.+) \(doctrine: (?<doctrine>.+)\)\.$/,
    template: 'هواپیماهای آمریکایی علیه {target} به پرواز درآمدند (دکترین: {doctrine}).',
  },
  {
    pattern: /^US airlift landed in Israel: \+(?<n>\d+) interceptors\.$/,
    template: 'پل هوایی آمریکا در اسرائیل فرود آمد: +{n} رهگیر.',
  },
  {
    pattern: /^Underground production delivered \+(?<n>\d+) (?<what>.+)\.$/,
    template: 'تولید زیرزمینی {n} {what} تحویل داد.',
  },
  {
    pattern: /^(?<side>US|Israeli) aircraft hit a revealed Iranian launch crew \(doctrine: (?<doctrine>.+)\)\.$/,
    template: 'هواپیماهای {side} به خدمه پرتابگر ایرانی آشکارشده حمله کردند (دکترین: {doctrine}).',
  },
  {
    pattern: /^A (?<patron>Russian|Chinese) (?:missile shipment|production package|intelligence package) (?:arrived )?(?:across the Caspian|by Chinese airbridge).*$/,
    template: 'بسته پشتیبانی {patron} از مسیر تأمین ایران رسید.',
  },
];

/**
 * Exact-match Persian renderings of every campaign outcome. Keys are the
 * outcome strings emitted by `victory.ts` and the tutorial endings.
 */
const OUTCOME_FA: Record<string, string> = {
  'The campaign has ended. The regime is still standing and its nuclear complex was never pushed below the survival threshold — Iran outlasted the coalition.':
    'کارزار به پایان رسید. رژیم همچنان پابرجاست و مجتمع هسته‌ای‌اش هرگز زیر آستانه بقا نرفت — ایران از ائتلاف فرسوده‌تر شد.',
  'The campaign has ended. American ground forces never held enough Iranian soil for long enough — there is no occupation, and the regime claims the field.':
    'کارزار به پایان رسید. نیروهای زمینی آمریکا هرگز به اندازه کافی خاک ایران را اشغال نکردند — اشغالی در کار نیست و رژیم میدان را از آن خود می‌داند.',
  'The campaign has ended. Iran avoided occupation and still held a credible deterrent, cohesive institutions and enough leverage to claim a strategic result.':
    'کارزار به پایان رسید. ایران از اشغال گریخت و همچنان بازدارندگی معتبر، نهادهای منسجم و اهرم کافی برای ادعای نتیجه‌ای راهبردی را در دست داشت.',
  'Iran’s hardened nuclear complex is destroyed, its launch force is broken, the basing network holds and Congress is still behind the war. The programme is set back a decade.':
    'مجتمع هسته‌ای سخت‌شده ایران نابود شد، نیروی پرتابی‌اش شکست، شبکه پایگاه‌ها پابرجاست و کنگره هنوز پشت جنگ است. برنامه یک دهه عقب افتاد.',
  'The nuclear complex is destroyed, Hormuz is open and Iran’s institutions have broken. The regime cannot continue.':
    'مجتمع هسته‌ای نابود شده، هرمز باز است و نهادهای ایران شکسته‌اند. رژیم نمی‌تواند ادامه دهد.',
  'The campaign has ended. Iran preserved its government, a credible deterrent and enough regional and economic leverage to claim a strategic result.':
    'کارزار به پایان رسید. ایران دولت خود، بازدارندگی معتبر و اهرم منطقه‌ای و اقتصادی کافی برای ادعای نتیجه‌ای راهبردی را حفظ کرد.',
  'The campaign has ended without a strategic result for Iran: its deterrent, cohesion or leverage fell short, whatever the map looked like.':
    'کارزار بدون نتیجه راهبردی برای ایران پایان یافت: بازدارندگی، انسجام یا اهرم آن کافی نبود، هر چه نقشه نشان می‌داد.',
  'The campaign has ended with a coalition strategic result: the nuclear programme is set back, Iran’s launch force is reduced, access holds and domestic support endured.':
    'کارزار با نتیجه راهبردی ائتلاف پایان یافت: برنامه هسته‌ای عقب افتاد، نیروی پرتابی ایران کاهش یافت، دسترسی پابرجا ماند و حمایت داخلی دوام آورد.',
  'The campaign has ended without a coalition strategic result: Iran still holds a deterrent or leverage, or the coalition’s access, costs or domestic support gave way.':
    'کارزار بدون نتیجه راهبردی ائتلاف پایان یافت: ایران همچنان بازدارندگی یا اهرم دارد، یا دسترسی، هزینه‌ها یا حمایت داخلی ائتلاف از دست رفت.',
  'The oil shock has arrived: with Hormuz strangled for turns on end the price index blew through the threshold and held. The coalition economies blinked first.':
    'شوک نفتی فرا رسید: با خفگی چندین‌نوبتی هرمز، شاخص قیمت از آستانه گذشت و بر جای ماند. اقتصادهای ائتلاف زودتر پلک زدند.',
  "Israel's offensive air arm has been worn down past the breaking point — too few squadrons remain combat-ready. Iran has degraded the coalition's sharpest sword.":
    'بازوی هوایی تهاجمی اسرائیل از نقطه شکنندگی گذشته است — اسکادران‌های آماده نبرد بسیار کم‌اند. ایران تیزترین شمشیر ائتلاف را کُند کرد.',
  'The first nuclear release since 1945. Russia and China put their forces on alert, every Gulf host closed its bases and the campaign ends in a global crisis — not a victory.':
    'نخستین کاربرد هسته‌ای از ۱۹۴۵ تاکنون. روسیه و چین نیروهایشان را هشدار دادند، همه میزبانان خلیج پایگاه‌ها را بستند و کارزار در یک بحران جهانی پایان می‌یابد — نه در یک پیروزی.',
  'The domestic consensus collapsed: congressional support and economic pressure broke the war coalition. Washington orders a general withdrawal.':
    'اجماع داخلی فروپاشید: حمایت کنگره و فشار اقتصادی ائتلاف جنگی را شکست. واشنگتن عقب‌نشینی عمومی دستور می‌دهد.',
  'The American domestic consensus collapsed under casualties and prices. Congress forced a withdrawal — the regime outlasted the coalition.':
    'اجماع داخلی آمریکا زیر تلفات و قیمت‌ها فروپاشید. کنگره عقب‌نشینی را تحمیل کرد — رژیم از ائتلاف دیرپاتر بود.',
  'US political will reached zero. Washington orders a general withdrawal; the campaign is lost at home.':
    'اراده سیاسی آمریکا به صفر رسید. واشنگتن عقب‌نشینی عمومی دستور می‌دهد؛ کارزار در خانه باخته شد.',
  'Every major Gulf base is out of action. Washington orders a general withdrawal.':
    'همه پایگاه‌های اصلی خلیج از کار افتاده‌اند. واشنگتن عقب‌نشینی عمومی دستور می‌دهد.',
  'The carrier strike group is lost and fewer than two bases remain: political will collapses.':
    'گروه ضربت ناوهونده از دست رفت و کمتر از دو پایگاه مانده است: اراده سیاسی فرو می‌ریزد.',
  'Israel held out for 25 turns, kept its cities intact and broke Iran’s launch force.':
    'اسرائیل ۲۵ نوبت مقاومت کرد، شهرهایش را سالم نگه داشت و نیروی پرتابی ایران را شکست.',
  'Interceptors are exhausted and five missiles have landed on Israeli cities. Domestic collapse.':
    'موشک‌های رهگیر تمام شد و پنج موشک به شهرهای اسرائیل خورد. فروپاشی داخلی.',
  'Production is destroyed, Hormuz is open and Tehran is in ruins. The regime cannot continue.':
    'تولید نابود شد، هرمز باز است و تهران در ویرانه است. رژیم نمی‌تواند ادامه دهد.',
  'US political will reached zero. The Americans are withdrawing — the regime survives.':
    'اراده سیاسی آمریکا به صفر رسید. آمریکایی‌ها در حال عقب‌نشینی‌اند — رژیم زنده می‌ماند.',
  'The campaign has ended. Iran holds none of its four victory paths: the regime is broken, Hormuz is open, and the nuclear programme is in ruins.':
    'کارزار به پایان رسید. ایران هیچ‌یک از چهار مسیر پیروزی را در اختیار ندارد: رژیم شکسته، هرمز باز و برنامه هسته‌ای در ویرانه است.',
  'The campaign has ended. Iran holds none of its four victory paths: the regime survived on the map, but achieved nothing it set out to win.':
    'کارزار به پایان رسید. ایران هیچ‌یک از چهار مسیر پیروزی را ندارد: رژیم روی نقشه دوام آورد اما به هیچ‌یک از اهدافش نرسید.',
  'A favorable armistice is signed in Doha: Iran’s war cost broke past its ceiling while the Gulf basing network held, and Tehran accepts coalition terms. The campaign ends at the table.':
    'آتش‌بس پرسود در دوحا امضا شد: هزینه جنگ ایران از سقفش گذشت و شبکه پایگاه‌های خلیج پابرجا ماند، و تهران شرایط ائتلاف را پذیرفت. کارزار پشت میز مذاکره پایان می‌یابد.',
  'A costly armistice is signed in Doha: exhausted, the coalition settles for terms short of its objectives while Iran’s regime still stands. The campaign ends at the table.':
    'آتش‌بس پرهزینه در دوحا امضا شد: ائتلافِ فرسوده به شرایطی کمتر از اهدافش تن می‌دهد و رژیم ایران هنوز پابرجاست. کارزار پشت میز مذاکره پایان می‌یابد.',
  'Iran accepted a ceasefire: its war cost passed the threshold while the Gulf basing network held.':
    'ایران آتش‌بس را پذیرفت: هزینه جنگش از آستانه گذشت و شبکه پایگاه‌های خلیج پابرجا ماند.',
  'Iran’s hardened nuclear and missile complex is destroyed. The programme is set back a decade.':
    'مجتمع سخت‌شده هسته‌ای و موشکی ایران نابود شد. برنامه یک دهه عقب می‌افتد.',
  'Tutorial complete: the Gulf basing network held and you managed the interceptor economy.':
    'آموزش کامل شد: شبکه پایگاه‌های خلیج پابرجا ماند و اقتصاد رهگیرها را مدیریت کردید.',
  'Tutorial failed: too many Gulf bases were knocked out.':
    'آموزش ناکام ماند: پایگاه‌های خلیج بیش از اندازه از کار افتادند.',
};

/**
 * Render a Persian version of an engine line through the named-variable
 * templates. Returns `null` when no pattern matches — the caller keeps the
 * English original.
 */
export function faLog(text: string): string | null {
  for (const { pattern, template } of LOG_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const groups = match.groups ?? {};
    let out = template;
    // {name} — plain substitution.
    out = out.replace(/\{(\w+)\}/g, (_whole, name: string) =>
      name in groups ? (groups[name] ?? `{${name}}`) : `{${name}}`,
    );
    // {name,select,case1|Out1|case2|Out2} — C-style switch on a group.
    out = out.replace(
      /\{(\w+),select,([^}]+)\}/g,
      (whole, name: string, body: string) => {
        if (!(name in groups)) return whole;
        const value = groups[name];
        const cases = body.split('|');
        for (let i = 0; i + 1 < cases.length; i += 2) {
          if (cases[i] === value) return cases[i + 1]!;
        }
        return whole;
      },
    );
    // {name,optional,rendered|} — only when the group is present.
    out = out.replace(
      /\{(\w+),optional,([^|]*)\|\}/g,
      (_whole, name: string, rendered: string) => (name in groups && groups[name] !== undefined ? rendered : ''),
    );
    return out;
  }
  return null;
}

/** Persian rendering of a campaign outcome; `null` keeps the English text. */
export function faOutcome(text: string): string | null {
  return OUTCOME_FA[text] ?? null;
}

/** True when the line is a known outcome (test-coverage helper). */
export function isKnownOutcome(text: string): boolean {
  return text in OUTCOME_FA;
}
