/**
 * Pre-campaign briefings (SPEC §30–31).
 *
 * Pure, bilingual content for the faction and scenario briefings shown between
 * selection and the first turn. Nothing here reads game state: the briefing
 * describes each side's historical position, constraints and first-turn
 * priorities, and names only orders the engine actually authorises.
 */
import type { PlayableFactionId } from '../core/types';

export interface Bi {
  en: string;
  fa: string;
}

export interface FactionBriefing {
  situation: Bi;
  objectives: Bi[];
  strengths: Bi[];
  weaknesses: Bi[];
  political: Bi[];
  economic: Bi[];
  capabilities: Bi[];
  actions: Bi[];
  threats: Bi[];
  firstTurn: Bi[];
}

export interface ScenarioBriefing {
  title: Bi;
  era: Bi;
  situation: Bi;
  objectives: Bi[];
  ending: Bi[];
  firstTurn: Bi[];
}

export const FACTION_BRIEFINGS: Record<PlayableFactionId, FactionBriefing> = {
  usa: {
    situation: {
      en: 'You command the US expeditionary campaign. Your aircraft, ships and interceptors fly from Gulf hosts who can restrict or close their bases, and every sortie spends political will in Washington.',
      fa: 'شما فرماندهی کارزار اعزامی آمریکا را بر عهده دارید. هواپیماها، کشتی‌ها و رهگیرهای شما از پایگاه‌های خلیج فارس پرواز می‌کنند که می‌توانند دسترسی را محدود یا ببندند، و هر پرواز، اراده سیاسی واشینگتن را مصرف می‌کند.',
    },
    objectives: [
      {
        en: 'Keep Hormuz open and the oil price below the shock threshold.',
        fa: 'هرمز را باز و قیمت نفت را زیر آستانه شوک نگه دارید.',
      },
      {
        en: "Degrade Iran's nuclear programme, launchers and missile stock without losing the coalition.",
        fa: 'برنامه هسته‌ای، پرتابگرها و ذخیره موشکی ایران را بدون از دست دادن ائتلاف تضعیف کنید.',
      },
      {
        en: 'Preserve congressional support and enough interceptors to keep the bases alive.',
        fa: 'حمایت کنگره و رهگیرهای کافی برای زنده نگه داشتن پایگاه‌ها را حفظ کنید.',
      },
    ],
    strengths: [
      {
        en: 'Stealth aircraft, cruise missiles and deep tanker and airlift reach.',
        fa: 'هواپیماهای رادارگریز، موشک‌های کروز و برد عمیق سوخت‌رسان و هواپیمای ترابری.',
      },
      {
        en: 'Patriot, THAAD and Aegis layers backed by a large naval presence.',
        fa: 'لایه‌های پاتریوت، تاد و ایجیس با پشتیبانی حضور گسترده دریایی.',
      },
      {
        en: 'The ability to reinforce, airlift interceptors and coordinate the coalition.',
        fa: 'توان تقویت نیرو، انتقال هوایی رهگیرها و هماهنگ‌سازی ائتلاف.',
      },
    ],
    weaknesses: [
      {
        en: 'Interceptors and precision munitions are finite and replace slowly.',
        fa: 'رهگیرها و مهمات دقیق محدودند و به‌کندی جایگزین می‌شوند.',
      },
      {
        en: 'Political will and congressional support fall with strikes and casualties.',
        fa: 'اراده سیاسی و حمایت کنگره با حملات و تلفات کاهش می‌یابد.',
      },
      {
        en: 'Bases depend on host permission; a closed host grounds sorties.',
        fa: 'پایگاه‌ها به اجازه میزبان وابسته‌اند؛ میزبان بسته، پروازها را زمین‌گیر می‌کند.',
      },
    ],
    political: [
      {
        en: 'Congress starts near 60. Heavy strikes, casualties and escalation erode it; constrained rules of engagement and public communication restore it.',
        fa: 'کنگره حدود ۶۰ آغاز می‌شود. حملات سنگین، تلفات و تشدید تنش آن را می‌فرساید؛ قواعد درگیری محدود و ارتباط عمومی آن را بازمی‌گرداند.',
      },
      {
        en: 'US-only orders — diplomacy, reinforcement, airlift and public communication — are gated by domestic support.',
        fa: 'دستورهای ویژه آمریکا — دیپلماسی، تقویت نیرو، انتقال هوایی و ارتباط عمومی — به حمایت داخلی وابسته‌اند.',
      },
    ],
    economic: [
      {
        en: 'Tanker and airlift capacity is the bottleneck for sustaining sorties.',
        fa: 'ظرفیت سوخت‌رسان و هواپیمای ترابری، گلوگاه تداوم پروازهاست.',
      },
      {
        en: "An oil shock raises war costs and makes the coalition's domestic position harder.",
        fa: 'شوک نفتی هزینه جنگ را بالا می‌برد و موقعیت داخلی ائتلاف را سخت‌تر می‌کند.',
      },
    ],
    capabilities: [
      {
        en: 'Precision strike from air and naval platforms; theatre missile defence; minesweeping and convoy escort; airlift and reinforcement.',
        fa: 'حمله دقیق از سکوهای هوایی و دریایی؛ پدافند موشکی منطقه‌ای؛ مین‌روبی و اسکورت کاروان؛ انتقال هوایی و تقویت نیرو.',
      },
    ],
    actions: [
      {
        en: 'Strike, move, clear, escort, lay mines, airlift interceptors, request reinforcements, signal a host, open talks and set rules of engagement.',
        fa: 'حمله، جابه‌جایی، پاکسازی، اسکورت، مین‌گذاری، انتقال هوایی رهگیر، درخواست تقویت، رایزنی با میزبان، آغاز مذاکره و تعیین قواعد درگیری.',
      },
    ],
    threats: [
      {
        en: 'Iranian missile and drone salvos, minefields and fast attack craft in the Strait.',
        fa: 'رگبار موشک و پهپاد ایران، میدان‌های مین و قایق‌های تندرو در تنگه.',
      },
      {
        en: 'Host access loss and congressional collapse if the war becomes costly.',
        fa: 'از دست رفتن دسترسی به پایگاه‌ها و فروپاشی حمایت کنگره اگر جنگ پرهزینه شود.',
      },
      {
        en: 'Escalation that brings the nuclear programme and an oil shock into play.',
        fa: 'تشدید تنشی که برنامه هسته‌ای و شوک نفتی را وارد بازی می‌کند.',
      },
    ],
    firstTurn: [
      {
        en: 'Read the objectives strip and check host access before spending political will.',
        fa: 'نوار اهداف را بخوانید و پیش از خرج کردن اراده سیاسی، دسترسی میزبان را بررسی کنید.',
      },
      {
        en: 'Set a rules-of-engagement posture; constrained preserves will for later.',
        fa: 'قواعد درگیری را تعیین کنید؛ حالت محدود، اراده را برای بعد حفظ می‌کند.',
      },
      {
        en: 'Decide whether the opening is a strike, a signal or a diplomatic move — nothing fires automatically.',
        fa: 'تصمیم بگیرید آغاز با حمله، رایزنی یا حرکت دیپلماتیک باشد — هیچ چیز خودکار شلیک نمی‌شود.',
      },
    ],
  },

  israel: {
    situation: {
      en: 'You command a small, dense state with no strategic depth. Your air force can reach Iran, but interceptor magazines and American resupply are the real limits on how long you can fight.',
      fa: 'شما فرماندهی کشوری کوچک و پرجمعیت را بر عهده دارید که عمق راهبردی ندارد. نیروی هوایی شما به ایران می‌رسد، اما ذخیره رهگیرها و تدارک آمریکا، محدودیت واقعی مدت جنگ است.',
    },
    objectives: [
      {
        en: "Degrade Iran's nuclear and missile capacity before its salvos saturate your defences.",
        fa: 'توان هسته‌ای و موشکی ایران را پیش از اشباع پدافند شما تضعیف کنید.',
      },
      {
        en: 'Keep Israeli cities and air bases intact; every interceptor spent is one that cannot be replaced quickly.',
        fa: 'شهرها و پایگاه‌های هوایی اسرائیل را سالم نگه دارید؛ هر رهگیر مصرف‌شده به‌سرعت جایگزین نمی‌شود.',
      },
      {
        en: 'Hold US support and avoid a wider war you cannot sustain alone.',
        fa: 'حمایت آمریکا را حفظ کنید و از جنگ گسترده‌ای که تنها از عهده آن برنمی‌آیید بپرهیزید.',
      },
    ],
    strengths: [
      {
        en: 'Precision strike aircraft and deep intelligence on Iranian targets.',
        fa: 'هواپیمای حمله دقیق و اطلاعات عمیق درباره اهداف ایران.',
      },
      {
        en: 'Layered ballistic-missile defence and short warning timelines.',
        fa: 'پدافند موشکی بالستیک لایه‌ای و زمان هشدار کوتاه.',
      },
      {
        en: 'Special operations and the ability to shape the US campaign through the initiative track.',
        fa: 'عملیات ویژه و توان شکل دادن به کارزار آمریکا از مسیر ابتکار عمل.',
      },
    ],
    weaknesses: [
      {
        en: 'Very shallow magazines and no strategic depth.',
        fa: 'ذخایر بسیار کم و نبود عمق راهبردی.',
      },
      {
        en: 'Civilian casualties and escalation damage US support.',
        fa: 'تلفات غیرنظامی و تشدید تنش به حمایت آمریکا آسیب می‌زند.',
      },
      {
        en: 'A small economy and reserve mobilisation limit a long war.',
        fa: 'اقتصاد کوچک و بسیج نیروهای ذخیره، جنگ طولانی را محدود می‌کند.',
      },
    ],
    political: [
      {
        en: 'US support and escalation levels constrain how far you can push; the initiative track trades legitimacy for aggression.',
        fa: 'حمایت آمریکا و سطح تشدید تنش محدود می‌کند تا کجا پیش بروید؛ مسیر ابتکار عمل، مشروعیت را با تهاجم مبادله می‌کند.',
      },
      {
        en: 'Coalition rules of engagement are shared with Washington; the US can constrain the air campaign.',
        fa: 'قواعد درگیری ائتلاف با واشینگتن مشترک است؛ آمریکا می‌تواند کارزار هوایی را محدود کند.',
      },
    ],
    economic: [
      {
        en: 'Reserve mobilisation and interceptor resupply compete with the campaign tempo.',
        fa: 'بسیج ذخیره و تأمین رهگیر با سرعت کارزار رقابت می‌کند.',
      },
      {
        en: 'An oil shock and a wider war hit a small economy harder than the United States.',
        fa: 'شوک نفتی و جنگ گسترده‌تر به اقتصاد کوچک بیش از آمریکا آسیب می‌زند.',
      },
    ],
    capabilities: [
      {
        en: 'Precision strike, layered missile defence, special operations and intelligence.',
        fa: 'حمله دقیق، پدافند موشکی لایه‌ای، عملیات ویژه و اطلاعات.',
      },
    ],
    actions: [
      {
        en: 'Strike, move, defend, set coalition rules of engagement, push the Israeli initiative track and open talks.',
        fa: 'حمله، جابه‌جایی، دفاع، تعیین قواعد درگیری ائتلاف، پیش بردن مسیر ابتکار اسرائیل و آغاز مذاکره.',
      },
    ],
    threats: [
      {
        en: 'Mass missile and drone salvos that exhaust interceptors.',
        fa: 'رگبار انبوه موشک و پهپاد که رهگیرها را تمام می‌کند.',
      },
      {
        en: 'Escalation that isolates Israel diplomatically.',
        fa: 'تشدید تنشی که اسرائیل را دیپلماتیک منزوی می‌کند.',
      },
      {
        en: 'US retrenchment or a host-access crisis.',
        fa: 'عقب‌نشینی آمریکا یا بحران دسترسی به پایگاه.',
      },
    ],
    firstTurn: [
      {
        en: 'Set rules of engagement and inspect interceptor stocks before choosing targets.',
        fa: 'پیش از انتخاب اهداف، قواعد درگیری را تعیین و ذخیره رهگیرها را بررسی کنید.',
      },
      {
        en: 'Coordinate with the US campaign; do not spend scarce munitions on low-value targets.',
        fa: 'با کارزار آمریکا هماهنگ شوید؛ مهمات کمیاب را صرف اهداف کم‌ارزش نکنید.',
      },
      {
        en: 'Decide whether to press the initiative or preserve legitimacy for talks.',
        fa: 'تصمیم بگیرید ابتکار عمل را فشار دهید یا مشروعیت را برای مذاکره حفظ کنید.',
      },
    ],
  },

  iran: {
    situation: {
      en: 'You command an asymmetric campaign. Your air force cannot contest the coalition, but missiles, drones, mines and the Strait let you impose costs and split your opponents.',
      fa: 'شما فرماندهی یک کارزار نامتقارن را بر عهده دارید. نیروی هوایی شما نمی‌تواند با ائتلاف رقابت کند، اما موشک، پهپاد، مین و تنگه به شما امکان تحمیل هزینه و شکاف میان حریفان را می‌دهد.',
    },
    objectives: [
      {
        en: 'Survive as a regime and keep the nuclear programme intact.',
        fa: 'به‌عنوان یک نظام سیاسی باقی بمانید و برنامه هسته‌ای را سالم نگه دارید.',
      },
      {
        en: "Raise the coalition's war cost and the oil price until its domestic support cracks.",
        fa: 'هزینه جنگ و قیمت نفت را برای ائتلاف بالا ببرید تا حمایت داخلی آن ترک بخورد.',
      },
      {
        en: 'Keep Hormuz disrupted without provoking an occupation you cannot stop.',
        fa: 'هرمز را مختل نگه دارید، بدون اینکه اشغالی را برانگیزید که نمی‌توانید متوقفش کنید.',
      },
    ],
    strengths: [
      {
        en: 'Large missile and drone inventories, dispersed launchers and mobile reserves.',
        fa: 'ذخایر بزرگ موشک و پهپاد، پرتابگرهای پراکنده و ذخایر متحرک.',
      },
      {
        en: 'Mine warfare and fast attack craft that can close the Strait.',
        fa: 'جنگ مین و قایق‌های تندرو که می‌توانند تنگه را ببندند.',
      },
      {
        en: 'Strategic depth and the ability to absorb punishment.',
        fa: 'عمق راهبردی و توان تحمل ضربه.',
      },
    ],
    weaknesses: [
      {
        en: 'An obsolete air force and limited naval surface strength.',
        fa: 'نیروی هوایی فرسوده و توان محدود سطحی دریایی.',
      },
      {
        en: 'Sanctions, a weak economy and fragile regime stability.',
        fa: 'تحریم، اقتصاد ضعیف و ثبات شکننده نظام.',
      },
      {
        en: 'Production is slow and fixed sites are vulnerable to precision strikes.',
        fa: 'تولید کند است و سایت‌های ثابت در برابر حملات دقیق آسیب‌پذیرند.',
      },
    ],
    political: [
      {
        en: 'Regime stability falls under sustained war pressure; below 30 the leadership holds fire rather than risk collapse.',
        fa: 'ثبات نظام زیر فشار پیوسته جنگ کاهش می‌یابد؛ زیر ۳۰، رهبری به‌جای خطر فروپاشی، دست به شلیک نمی‌زند.',
      },
      {
        en: 'Legitimacy and internal control shape how many salvos you can sustain.',
        fa: 'مشروعیت و کنترل داخلی تعیین می‌کند چند رگبار را می‌توانید ادامه دهید.',
      },
    ],
    economic: [
      {
        en: 'Oil exports and production resources fund the war; blockade and strikes cut both.',
        fa: 'صادرات نفت و منابع تولید، جنگ را تأمین می‌کند؛ محاصره و حملات هر دو را کاهش می‌دهند.',
      },
      {
        en: 'Reconstruction and nuclear funding compete with immediate military production.',
        fa: 'بازسازی و بودجه هسته‌ای با تولید نظامی فوری رقابت می‌کند.',
      },
    ],
    capabilities: [
      {
        en: 'Massed missile and drone salvos, mine laying, production, nuclear signalling and dispersed launch.',
        fa: 'رگبار انبوه موشک و پهپاد، مین‌گذاری، تولید، علامت‌دهی هسته‌ای و پرتاب پراکنده.',
      },
    ],
    actions: [
      {
        en: 'Launch salvos, lay mines, move and disperse, produce munitions, advance the nuclear programme and respond to talks.',
        fa: 'شلیک رگبار، مین‌گذاری، جابه‌جایی و پراکندگی، تولید مهمات، پیش بردن برنامه هسته‌ای و پاسخ به مذاکره.',
      },
    ],
    threats: [
      {
        en: 'US stealth and cruise-missile strikes against launchers and air defences.',
        fa: 'حملات رادارگریز و موشک کروز آمریکا علیه پرتابگرها و پدافند هوایی.',
      },
      {
        en: 'Israeli precision strikes on nuclear and missile infrastructure.',
        fa: 'حملات دقیق اسرائیل به زیرساخت هسته‌ای و موشکی.',
      },
      {
        en: 'Blockade, domestic unrest and a regime-collapse spiral.',
        fa: 'محاصره، ناآرامی داخلی و مارپیچ فروپاشی نظام.',
      },
    ],
    firstTurn: [
      {
        en: 'Disperse launchers and inspect stocks before the first salvo.',
        fa: 'پیش از نخستین رگبار، پرتابگرها را پراکنده و ذخایر را بررسی کنید.',
      },
      {
        en: 'Decide whether to mine the approaches, hold fire, or signal the nuclear programme.',
        fa: 'تصمیم بگیرید رویکردها را مین‌گذاری کنید، دست نگه دارید یا درباره برنامه هسته‌ای علامت دهید.',
      },
      {
        en: 'Watch stability: a maximum-effort opening can cost you the war at home.',
        fa: 'ثبات را زیر نظر بگیرید: آغاز با حداکثر تلاش می‌تواند جنگ را در خانه ببازد.',
      },
    ],
  },
};

export const SCENARIO_BRIEFINGS: Record<string, ScenarioBriefing> = {
  campaign: {
    title: { en: 'The Narrow Sea', fa: 'دریای باریک' },
    era: {
      en: '27 February 2026 · pre-war · 30 turns',
      fa: '۲۷ فوریه ۲۰۲۶ · پیش از جنگ · ۳۰ نوبت',
    },
    situation: {
      en: 'The Gulf war has not started. Stockpiles are at pre-war levels and no automatic first strike is scripted: the first move is yours. Set posture, preposition forces and choose whether the opening is military or diplomatic.',
      fa: 'جنگ خلیج آغاز نشده است. ذخایر در سطح پیش از جنگ است و هیچ ضربه نخست خودکاری برنامه‌ریزی نشده: حرکت اول با شماست. حالت را تعیین کنید، نیروها را پیش‌استقرار دهید و انتخاب کنید آغاز نظامی باشد یا دیپلماتیک.',
    },
    objectives: [
      {
        en: 'Thirty turns to secure your faction’s victory paths.',
        fa: 'سی نوبت برای تثبیت مسیرهای پیروزی جناح شما.',
      },
      {
        en: 'Coalition: break Iranian nuclear and offensive capacity while keeping Hormuz open and the coalition intact.',
        fa: 'ائتلاف: توان هسته‌ای و تهاجمی ایران را بشکنید و همزمان هرمز را باز و ائتلاف را سالم نگه دارید.',
      },
      {
        en: 'Iran: survive, keep the programme, and make the war cost more than the coalition will pay.',
        fa: 'ایران: بقا، حفظ برنامه و گران‌تر کردن جنگ از آنچه ائتلاف حاضر است بپردازد.',
      },
    ],
    ending: [
      {
        en: 'Regime survival is judged in the final ten turns against nuclear integrity.',
        fa: 'بقای نظام در ده نوبت پایانی بر پایه یکپارچگی هسته‌ای سنجیده می‌شود.',
      },
      {
        en: 'Occupation, an oil-price shock above the threshold, and Israeli offensive degradation are separate decisive outcomes.',
        fa: 'اشغال، شوک قیمت نفت بالاتر از آستانه و تضعیف توان تهاجمی اسرائیل، پایان‌های قاطع جداگانه‌اند.',
      },
      {
        en: 'A negotiated settlement or exhaustion can end the war before any of them.',
        fa: 'توافق مذاکره‌شده یا فرسایش می‌تواند جنگ را پیش از هر یک از این‌ها پایان دهد.',
      },
    ],
    firstTurn: [
      {
        en: "Read the strategic panel's Situation group and the objectives strip.",
        fa: 'گروه «وضعیت» در پنل راهبردی و نوار اهداف را بخوانید.',
      },
      {
        en: 'Check host access, interceptor stocks and the Hormuz index.',
        fa: 'دسترسی میزبان، ذخیره رهگیرها و شاخص هرمز را بررسی کنید.',
      },
      {
        en: 'Queue one coherent opening: posture and signals, or a first strike.',
        fa: 'یک آغاز منسجم ثبت کنید: حالت و رایزنی، یا ضربه نخست.',
      },
    ],
  },

  tutorial: {
    title: { en: 'First Strike (Tutorial)', fa: 'ضربه نخست (آموزشی)' },
    era: {
      en: '5 turns · United States · tutorial',
      fa: '۵ نوبت · ایالات متحده · آموزشی',
    },
    situation: {
      en: 'A scripted five-turn introduction as the United States. The Iranian response is fixed, so you can learn base access, interceptor attrition and the Hormuz clock without a full campaign.',
      fa: 'یک معرفی پنج‌نوبتی از پیش نوشته‌شده به‌عنوان ایالات متحده. پاسخ ایران ثابت است، تا دسترسی پایگاه، فرسایش رهگیرها و ساعت هرمز را بدون کارزار کامل بیاموزید.',
    },
    objectives: [
      {
        en: 'Follow the coach and resolve five turns.',
        fa: 'راهنمای آموزش را دنبال کنید و پنج نوبت را اجرا کنید.',
      },
      {
        en: 'Keep the Gulf hosts open and watch your interceptor stocks.',
        fa: 'میزبان‌های خلیج را باز نگه دارید و ذخیره رهگیرها را ببینید.',
      },
      {
        en: 'See how strikes move the Hormuz index and coalition political will.',
        fa: 'ببینید حملات چگونه شاخص هرمز و اراده سیاسی ائتلاف را جابه‌جا می‌کنند.',
      },
    ],
    ending: [
      {
        en: 'The exercise ends after five turns with a summary, not a full campaign outcome.',
        fa: 'تمرین پس از پنج نوبت با یک خلاصه پایان می‌یابد، نه نتیجه کامل کارزار.',
      },
    ],
    firstTurn: [
      {
        en: 'Use the coach’s suggested target, then open the strategic panel’s Economy group to see the cost.',
        fa: 'هدف پیشنهادی آموزش را به کار ببرید، سپس گروه «اقتصاد» پنل راهبردی را برای دیدن هزینه باز کنید.',
      },
    ],
  },
};

export function factionBriefing(faction: PlayableFactionId): FactionBriefing {
  return FACTION_BRIEFINGS[faction];
}

export function scenarioBriefing(id: string): ScenarioBriefing {
  return SCENARIO_BRIEFINGS[id] ?? SCENARIO_BRIEFINGS.campaign!;
}
