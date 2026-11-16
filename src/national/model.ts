/**
 * Chokepoint National Command — independent crisis simulation.
 *
 * This module is deliberately separate from the theatre engine. It owns the
 * country/world state, the six departments' decisions, the stronger actors'
 * reactions and the campaign endings. The classic game and the asymmetric
 * prototype never import this module.
 */
import type { Lang } from '../i18n';
import { triggeredEvents } from './events';

export type Mode = 'campaign' | 'sandbox';
export type Intensity = 'contained' | 'flashpoint' | 'brink';
export type PlayerCountryId = 'iran' | 'usa';
export type CampaignId = 'hormuz' | 'economic-pressure' | 'settlement';
export type DepartmentId = 'security' | 'treasury' | 'foreign' | 'defence' | 'intelligence' | 'interior';
export type ObjectiveId = 'security' | 'governance' | 'economy' | 'diplomacy' | 'crisis';
export type ActorId = 'iran' | 'usa' | 'gcc' | 'qatar' | 'china' | 'eu';
export type NationalStatus = 'playing' | 'won' | 'lost' | 'drawn';

export interface L {
  en: string;
  fa: string;
}

export const l = (en: string, fa: string): L => ({ en, fa });
export const pick = (value: L, lang: Lang): string => value[lang];

export const PLAYER_COUNTRIES: Record<PlayerCountryId, { name: L; short: L; capital: L }> = {
  iran: { name: l('Islamic Republic of Iran', 'جمهوری اسلامی ایران'), short: l('Iran', 'ایران'), capital: l('Tehran', 'تهران') },
  usa: { name: l('United States', 'ایالات متحده'), short: l('United States', 'ایالات متحده'), capital: l('Washington', 'واشنگتن') },
};

export const CAMPAIGNS: Record<CampaignId, { name: L; short: L; blurb: L; turns: number; startDate: string }> = {
  hormuz: {
    name: l('Campaign · Hormuz Crisis', 'کارزار · بحران هرمز'),
    short: l('Hormuz Crisis', 'بحران هرمز'),
    blurb: l(
      'Twelve weeks around the strait. Military pressure, shipping confidence and domestic patience all compete for the same decisions.',
      'دوازده هفته پیرامون تنگه. فشار نظامی، اطمینان کشتیرانی و صبر داخلی برای تصمیم‌های یکسان رقابت می‌کنند.',
    ),
    turns: 12,
    startDate: '2026-03-10',
  },
  'economic-pressure': {
    name: l('Campaign · Economic Pressure', 'کارزار · فشار اقتصادی'),
    short: l('Economic Pressure', 'فشار اقتصادی'),
    blurb: l(
      'Ten weeks of sanctions, reserves and public sacrifice. Military escalation is available, but the binding constraint is solvency.',
      'ده هفته تحریم، ذخایر و فداکاری عمومی. تشدید نظامی ممکن است، اما محدودیت اصلی توان مالی است.',
    ),
    turns: 10,
    startDate: '2026-04-07',
  },
  settlement: {
    name: l('Campaign · Diplomatic Settlement', 'کارزار · توافق دیپلماتیک'),
    short: l('Diplomatic Settlement', 'توافق دیپلماتیک'),
    blurb: l(
      'Ten weeks to turn a narrow mediation channel into a settlement while hardliners at home and allies abroad pull in different directions.',
      'ده هفته برای تبدیل یک کانال میانجی‌گری محدود به توافق، در حالی که تندروها در داخل و متحدان در خارج به جهات مختلف می‌کشند.',
    ),
    turns: 10,
    startDate: '2026-04-21',
  },
};

export const DEFAULT_PRIORITIES: ObjectiveId[] = ['security', 'governance'];
export const OBJECTIVE_IDS: ObjectiveId[] = ['security', 'governance', 'economy', 'diplomacy', 'crisis'];

export const DEPARTMENTS: Array<{ id: DepartmentId; name: L; short: L; glyph: string }> = [
  { id: 'security', name: l('National Security Council', 'شورای امنیت ملی'), short: l('Security', 'امنیت'), glyph: '◆' },
  { id: 'treasury', name: l('Treasury and Economy', 'خزانه و اقتصاد'), short: l('Treasury', 'خزانه'), glyph: '▦' },
  { id: 'foreign', name: l('Foreign Affairs', 'امور خارجه'), short: l('Foreign', 'خارجه'), glyph: '◎' },
  { id: 'defence', name: l('Ministry of Defence', 'وزارت دفاع'), short: l('Defence', 'دفاع'), glyph: '⌁' },
  { id: 'intelligence', name: l('Intelligence Directorate', 'اداره اطلاعات'), short: l('Intelligence', 'اطلاعات'), glyph: '◈' },
  { id: 'interior', name: l('Interior and Domestic Affairs', 'کشور و امور داخلی'), short: l('Interior', 'کشور'), glyph: '⌂' },
];

export type DecisionId =
  | 'naval-signal'
  | 'backchannel'
  | 'release-reserves'
  | 'cut-subsidies'
  | 'qatar-talks'
  | 'nuclear-measure'
  | 'air-defence'
  | 'mining-exercise'
  | 'validate-intel'
  | 'deception'
  | 'national-address'
  | 'rationing';

export interface Effects {
  military?: number;
  diplomatic?: number;
  economic?: number;
  domestic?: number;
  legitimacy?: number;
  stability?: number;
  elite?: number;
  confidence?: number;
  socialTension?: number;
  reserves?: number;
  currency?: number;
  inflation?: number;
  fiscal?: number;
  publicPressure?: number;
  tradeAccess?: number;
  readiness?: number;
  defence?: number;
  strategic?: number;
  accessibility?: number;
  shippingConfidence?: number;
  insurance?: number;
  oilPrice?: number;
  talks?: number;
  influence?: number;
  sanctionsRelief?: number;
  mediation?: number;
  exposure?: number;
  deception?: number;
  intelRefresh?: boolean;
  relations?: Partial<Record<ActorId, number>>;
  delayed?: Array<{ effect: Effects; note: L }>;
}

export interface DecisionDef {
  id: DecisionId;
  department: DepartmentId;
  title: L;
  description: L;
  cost: number;
  /** Full turns before this decision can be used again. */
  cooldown?: number;
  effects: Effects;
  log: L;
}

export const DECISIONS: DecisionDef[] = [
  {
    id: 'naval-signal',
    department: 'security',
    title: l('Limited naval signal', 'نمایش محدود دریایی'),
    description: l(
      'Exercise fast-attack craft near the strait without closing it. Buy leverage at the cost of insurance confidence.',
      'قایق‌های تندرو را نزدیک تنگه تمرین بدهید، بدون بستن آن. اهرم بخرید، اما به اطمینان بیمه آسیب می‌زنید.',
    ),
    cost: 2,
    effects: {
      military: 8,
      diplomatic: 4,
      shippingConfidence: -4,
      insurance: 4,
      influence: 3,
      relations: { usa: -3, gcc: -2 },
    },
    log: l(
      'Fast-attack craft exercised near the approaches. The message was visible; so was the insurance reaction.',
      'قایق‌های تندرو نزدیک ورودی تنگه تمرین کردند. پیام دیده شد؛ واکنش بیمه هم.',
    ),
  },
  {
    id: 'backchannel',
    department: 'security',
    title: l('Open a confidential back-channel', 'بازکردن کانال محرمانه'),
    description: l(
      'Use an intermediary to test Washington’s terms. Low public cost, slow diplomatic payoff.',
      'از یک واسطه برای آزمودن شرایط واشنگتن استفاده کنید. هزینه عمومی کم، نتیجه دیپلماتیک کند.',
    ),
    cost: 2,
    cooldown: 2,
    effects: {
      diplomatic: -10,
      military: -3,
      talks: 8,
      legitimacy: 2,
      relations: { usa: 5, qatar: 3 },
    },
    log: l(
      'A confidential channel opened through Doha. No public breakthrough, but the shooting conversation now has a second track.',
      'کانال محرمانه‌ای از دوحه باز شد. پیشرفت علنی نداشت، اما گفت‌وگوی درگیری اکنون مسیر دومی دارد.',
    ),
  },
  {
    id: 'release-reserves',
    department: 'treasury',
    title: l('Release reserves to defend the currency', 'آزادسازی ذخایر برای دفاع از ارز'),
    description: l(
      'Spend foreign reserves to slow the currency slide. Stabilises prices now; inflation and reserves suffer later.',
      'برای کندکردن سقوط ارز، ذخایر ارزی خرج کنید. قیمت‌ها امروز آرام می‌شوند؛ تورم و ذخایر بعداً آسیب می‌بینند.',
    ),
    cost: 1,
    cooldown: 2,
    effects: {
      reserves: -12,
      currency: 8,
      publicPressure: -3,
      inflation: 2,
      delayed: [
        {
          effect: { inflation: 4, currency: -2, publicPressure: 2 },
          note: l('The reserve intervention is running out of room; import prices are catching up.', 'فضای مداخله ارزی تمام می‌شود؛ قیمت واردات در حال جبران است.'),
        },
      ],
    },
    log: l(
      'The central bank sold reserves to hold the currency. Importers received a short breathing space.',
      'بانک مرکزی برای نگه‌داشتن ارز ذخایر فروخت. واردکنندگان نفس کوتاهی کشیدند.',
    ),
  },
  {
    id: 'cut-subsidies',
    department: 'treasury',
    title: l('Cut fuel subsidies', 'کاهش یارانه سوخت'),
    description: l(
      'Free fiscal room by raising pump prices. The budget improves immediately; the street answers next week.',
      'با افزایش قیمت سوخت، فضای مالی ایجاد کنید. بودجه فوراً بهتر می‌شود؛ خیابان هفته بعد پاسخ می‌دهد.',
    ),
    cost: 2,
    cooldown: 3,
    effects: {
      fiscal: 8,
      reserves: 5,
      publicPressure: 8,
      confidence: -5,
      socialTension: 4,
      delayed: [
        {
          effect: { publicPressure: 7, stability: -3, legitimacy: -2 },
          note: l('Fuel queues and price anger are spreading from the provinces into the cities.', 'صف سوخت و خشم قیمتی از استان‌ها به شهرها سرایت می‌کند.'),
        },
      ],
    },
    log: l(
      'Subsidy reform freed fiscal space. The first public reaction is still ahead.',
      'اصلاح یارانه فضای مالی آزاد کرد. نخستین واکنش عمومی هنوز در راه است.',
    ),
  },
  {
    id: 'qatar-talks',
    department: 'foreign',
    title: l('Accept Qatari mediation', 'پذیرش میانجی‌گری قطر'),
    description: l(
      'Give Doha a mandate to draft a maritime understanding. Builds a settlement path while slowing coercion.',
      'به دوحه مأموریت دهید پیش‌نویس تفاهم دریایی تهیه کند. مسیر توافق می‌سازد، اما فشار را کند می‌کند.',
    ),
    cost: 2,
    cooldown: 3,
    effects: {
      talks: 12,
      mediation: 8,
      diplomatic: -6,
      legitimacy: 3,
      relations: { qatar: 8, gcc: 3, usa: 2 },
    },
    log: l(
      'Qatar accepted a drafting mandate. The proposal is narrow: shipping safety first, politics later.',
      'قطر مأموریت تهیه پیش‌نویس را پذیرفت. پیشنهاد محدود است: نخست امنیت کشتیرانی، بعد سیاست.',
    ),
  },
  {
    id: 'nuclear-measure',
    department: 'foreign',
    title: l('Offer a verified nuclear measure', 'ارائه اقدام هسته‌ای قابل‌راستی‌آزمایی'),
    description: l(
      'Trade transparency for sanctions relief. Strong diplomatic and economic upside; the leadership base will call it surrender.',
      'شفافیت را با کاهش تحریم معامله کنید. سود دیپلماتیک و اقتصادی قوی؛ پایگاه رهبری آن را تسلیم می‌نامد.',
    ),
    cost: 3,
    cooldown: 3,
    effects: {
      sanctionsRelief: 10,
      legitimacy: 6,
      diplomatic: -5,
      elite: -4,
      relations: { eu: 7, usa: 3, gcc: 2 },
    },
    log: l(
      'The offer was transmitted through Vienna. Washington called it a serious basis; hardliners at home called it a concession.',
      'پیشنهاد از وین ارسال شد. واشنگتن آن را مبنایی جدی خواند؛ تندروها در داخل آن را امتیاز دانستند.',
    ),
  },
  {
    id: 'air-defence',
    department: 'defence',
    title: l('Raise air-defence readiness', 'افزایش آمادگی پدافند هوایی'),
    description: l(
      'Bring additional batteries to alert and disperse them. Better defence and calmer insurers; readiness and budget pay for it.',
      'باتری‌های بیشتری را به آماده‌باش ببرید و پراکنده کنید. دفاع بهتر و بیمه آرام‌تر؛ هزینه‌اش آمادگی و بودجه است.',
    ),
    cost: 1,
    effects: {
      defence: 9,
      readiness: -3,
      fiscal: -3,
      insurance: -2,
    },
    log: l(
      'Additional batteries went to dispersed sites. Insurers noted the reduced exposure.',
      'باتری‌های بیشتری به سایت‌های پراکنده رفتند. بیمه‌گران کاهش ریسک را ثبت کردند.',
    ),
  },
  {
    id: 'mining-exercise',
    department: 'defence',
    title: l('Covert mining exercise', 'تمرین پنهان مین‌گذاری'),
    description: l(
      'Practice a limited mining box. Raises leverage and insurance costs; risks attribution and a harder diplomatic track.',
      'یک محدوده مین‌گذاری محدود را تمرین کنید. اهرم و هزینه بیمه بالا می‌رود؛ خطر انتساب و مسیر دیپلماتیک سخت‌تر.',
    ),
    cost: 2,
    cooldown: 2,
    effects: {
      military: 10,
      accessibility: -7,
      shippingConfidence: -8,
      insurance: 8,
      talks: -5,
      influence: 3,
      exposure: 6,
      relations: { gcc: -4 },
    },
    log: l(
      'A covert mining exercise was detected by regional shipping. No one proved authorship, but confidence fell.',
      'تمرین پنهان مین‌گذاری توسط کشتیرانی منطقه شناسایی شد. کسی منشأ آن را اثبات نکرد، اما اطمینان افتاد.',
    ),
  },
  {
    id: 'validate-intel',
    department: 'intelligence',
    title: l('Task collection on shipping intentions', 'گماشتن جمع‌آوری درباره نیت کشتیرانی'),
    description: l(
      'Use a second independent source to test the weakest assessment. Reduces uncertainty and exposure.',
      'با منبع مستقل دوم، ضعیف‌ترین ارزیابی را بسنجید. ابهام و ریسک افشا را کم می‌کند.',
    ),
    cost: 1,
    cooldown: 2,
    effects: {
      intelRefresh: true,
      exposure: -3,
      strategic: 2,
    },
    log: l(
      'A second source was tasked. One assessment moved from partial to corroborated; the picture is still incomplete.',
      'منبع دومی گماشته شد. یک ارزیابی از نسبی به تأییدشده رفت؛ تصویر هنوز کامل نیست.',
    ),
  },
  {
    id: 'deception',
    department: 'intelligence',
    title: l('Run a deception campaign', 'اجرای کارزار فریب'),
    description: l(
      'Feed a false readiness picture to the other side. Can slow military pressure, but raises exposure if it unravels.',
      'تصویر نادرست آمادگی را به طرف مقابل بدهید. می‌تواند فشار نظامی را کند کند، اما اگر افشا شود ریسک را بالا می‌برد.',
    ),
    cost: 2,
    cooldown: 2,
    effects: {
      deception: 14,
      exposure: 4,
      diplomatic: -3,
      strategic: 3,
      relations: { usa: -2 },
    },
    log: l(
      'A deception package entered the other side’s reporting chain. Its effect depends on whether the story holds.',
      'بسته فریب وارد زنجیره گزارش‌دهی طرف مقابل شد. اثرش به دوام روایت بستگی دارد.',
    ),
  },
  {
    id: 'national-address',
    department: 'interior',
    title: l('Address the nation', 'سخنرانی برای ملت'),
    description: l(
      'Explain the crisis and the sacrifice asked of the public. Builds confidence and legitimacy; costs political attention.',
      'بحران و فداکاری خواسته‌شده را توضیح دهید. اعتماد و مشروعیت می‌سازد؛ توجه سیاسی می‌گیرد.',
    ),
    cost: 2,
    cooldown: 2,
    effects: {
      confidence: 7,
      legitimacy: 3,
      elite: 2,
      publicPressure: -4,
      stability: 3,
    },
    log: l(
      'The address was carried live. The public heard a plan, not only a warning.',
      'سخنرانی زنده پخش شد. مردم یک برنامه شنیدند، نه فقط هشدار.',
    ),
  },
  {
    id: 'rationing',
    department: 'interior',
    title: l('Emergency fuel rationing', 'سهمیه‌بندی اضطراری سوخت'),
    description: l(
      'Stretch domestic supply and calm import pressure. Consumers pay for it in confidence.',
      'عرضه داخلی را کش بدهید و فشار واردات را کم کنید. مصرف‌کننده هزینه‌اش را با اعتماد می‌پردازد.',
    ),
    cost: 1,
    cooldown: 2,
    effects: {
      publicPressure: -7,
      reserves: 3,
      confidence: -6,
      stability: -3,
      socialTension: -2,
      fiscal: 2,
    },
    log: l(
      'Ration cards went into effect. Queues shortened, but the measure is visibly unpopular.',
      'کارت سهمیه اجرا شد. صف‌ها کوتاه شدند، اما اقدام آشکارا محبوب نیست.',
    ),
  },
];

export type DecisionMap = Record<DecisionId, DecisionDef>;
export const DECISION_BY_ID = Object.fromEntries(DECISIONS.map((d) => [d.id, d])) as DecisionMap;

export interface EscalationState {
  military: number;
  diplomatic: number;
  economic: number;
  domestic: number;
  stage: number;
}

export interface ShippingState {
  accessibility: number;
  confidence: number;
  insurance: number;
  flow: number;
  oilPrice: number;
  energyStability: number;
}

export interface EconomyState {
  reserves: number;
  currency: number;
  inflation: number;
  fiscal: number;
  oilRevenue: number;
  tradeAccess: number;
  publicPressure: number;
}

export interface GovernmentState {
  legitimacy: number;
  stability: number;
  elite: number;
  confidence: number;
  socialTension: number;
}

export interface SecurityState {
  readiness: number;
  defence: number;
  strategic: number;
}

export interface ActorState {
  id: ActorId;
  name: L;
  objective: L;
  stance: number;
  pressure: number;
  lastAction: L;
}

export interface DiplomacyState {
  relations: Record<ActorId, number>;
  influence: number;
  talks: number;
  mediation: number;
  sanctionsRelief: number;
}

export interface IntelAssessment {
  id: string;
  title: L;
  assessment: L;
  source: L;
  reliability: L;
  confidence: number;
  age: number;
  corroboration: L;
  deception: L;
}

export interface IntelligenceState {
  assessments: IntelAssessment[];
  exposure: number;
  deception: number;
}

export interface PendingEffect {
  dueTurn: number;
  effect: Effects;
  note: L;
}

export interface ReportLine {
  text: L;
  tone: 'good' | 'warn' | 'bad' | 'info';
}

export interface NationalReport {
  turn: number;
  decisions: DecisionId[];
  headline: L;
  lines: ReportLine[];
}

export interface NationalState {
  version: 1;
  mode: Mode;
  intensity: Intensity;
  player: PlayerCountryId;
  campaign: CampaignId;
  priorities: ObjectiveId[];
  firedEvents: string[];
  customStart: CustomStart | null;
  defenceUsedTurn: number;
  defenceLastScore: number;
  tacticalLog: Array<{ turn: number; allocation: DefenceAllocation }>;
  seed: number;
  turn: number;
  maxTurns: number;
  startDate: string;
  date: string;
  status: NationalStatus;
  outcome: Outcome | null;
  phase: 'decisions' | 'ended';
  escalation: EscalationState;
  shipping: ShippingState;
  economy: EconomyState;
  government: GovernmentState;
  security: SecurityState;
  diplomacy: DiplomacyState;
  intelligence: IntelligenceState;
  actors: Record<ActorId, ActorState>;
  politicalCapital: number;
  actionPoints: number;
  decisions: DecisionId[];
  used: Partial<Record<DecisionId, number>>;
  pending: PendingEffect[];
  report: NationalReport | null;
  history: NationalReport[];
}

export interface Outcome {
  status: Exclude<NationalStatus, 'playing'>;
  verdict: 'negotiated' | 'strategic' | 'limited' | 'pyrrhic' | 'defeat' | 'catastrophe';
  title: L;
  text: L;
  score: number;
}

export type DefenceSector = 'command' | 'ports' | 'cities';

export interface DefenceAllocation {
  command: number;
  ports: number;
  cities: number;
}

export interface DefenceRaid {
  sector: DefenceSector;
  strength: number;
}

export interface DefenceResult {
  ok: boolean;
  reason?: L;
  score: number;
  intercepted: number;
  total: number;
  raids: DefenceRaid[];
  effects: Effects;
  lines: L[];
}

export interface ObjectiveRow {
  id: string;
  label: L;
  detail: L;
  value: number;
  target: number;
  met: boolean;
  priority: boolean;
}

const STAGE_NAMES: L[] = [
  l('Normal relations', 'روابط عادی'),
  l('Growing tension', 'تنش فزاینده'),
  l('Active confrontation', 'رویارویی فعال'),
  l('Severe crisis', 'بحران شدید'),
  l('Regional conflict', 'درگیری منطقه‌ای'),
  l('Catastrophic escalation', 'تشدید فاجعه‌بار'),
];

export function stageName(stage: number): L {
  return STAGE_NAMES[Math.max(0, Math.min(5, stage - 1))]!;
}

export function stageOf(escalation: Omit<EscalationState, 'stage'>): number {
  const value =
    escalation.military * 0.3 +
    escalation.diplomatic * 0.25 +
    escalation.economic * 0.25 +
    escalation.domestic * 0.2;
  if (value < 22) return 1;
  if (value < 40) return 2;
  if (value < 57) return 3;
  if (value < 73) return 4;
  if (value < 88) return 5;
  return 6;
}

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDate(iso: string, lang: Lang): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export interface CustomStart {
  military: number;
  diplomatic: number;
  economic: number;
  domestic: number;
  accessibility: number;
  confidence: number;
  reserves: number;
  inflation: number;
  stability: number;
}

export interface ScenarioOptions {
  player?: PlayerCountryId;
  campaign?: CampaignId;
  priorities?: ObjectiveId[];
  custom?: CustomStart;
}

export function normalizePriorities(input?: ObjectiveId[]): ObjectiveId[] {
  const valid = (input ?? []).filter((id, index, all) => OBJECTIVE_IDS.includes(id) && all.indexOf(id) === index);
  return valid.length === 2 ? valid : [...DEFAULT_PRIORITIES];
}

export function playerCountryName(state: NationalState, lang: Lang): string {
  return PLAYER_COUNTRIES[state.player].name[lang];
}

export function createInitialState(
  mode: Mode = 'campaign',
  intensity: Intensity = 'flashpoint',
  seed = 20260310,
  options: ScenarioOptions = {},
): NationalState {
  const contained = intensity === 'contained';
  const brink = intensity === 'brink';
  const player = options.player === 'usa' ? 'usa' : 'iran';
  const campaign = options.campaign ?? 'hormuz';
  const usa = player === 'usa';
  const escalation: EscalationState = {
    military: usa ? (contained ? 42 : brink ? 78 : 55) : contained ? 40 : brink ? 80 : 58,
    diplomatic: usa ? (contained ? 40 : brink ? 74 : 58) : contained ? 36 : brink ? 78 : 62,
    economic: usa ? (contained ? 34 : brink ? 66 : 52) : contained ? 32 : brink ? 70 : 55,
    domestic: usa ? (contained ? 26 : brink ? 54 : 42) : contained ? 30 : brink ? 64 : 48,
    stage: 1,
  };
  escalation.stage = stageOf(escalation);
  const shipping: ShippingState = {
    accessibility: usa ? (contained ? 86 : brink ? 55 : 74) : contained ? 86 : brink ? 55 : 72,
    confidence: usa ? (contained ? 68 : brink ? 30 : 53) : contained ? 66 : brink ? 28 : 49,
    insurance: usa ? (contained ? 42 : brink ? 82 : 60) : contained ? 44 : brink ? 86 : 63,
    flow: usa ? (contained ? 61 : brink ? 24 : 45) : contained ? 58 : brink ? 21 : 41,
    oilPrice: usa ? (contained ? 78 : brink ? 116 : 89) : contained ? 79 : brink ? 121 : 91,
    energyStability: usa ? (contained ? 68 : brink ? 36 : 57) : contained ? 66 : brink ? 34 : 55,
  };
  const campaignStart = mode === 'sandbox' ? CAMPAIGNS.hormuz.startDate : CAMPAIGNS[campaign].startDate;
  const state: NationalState = {
    version: 1,
    mode,
    intensity,
    player,
    campaign,
    priorities: normalizePriorities(options.priorities),
    firedEvents: [],
    customStart: options.custom ? { ...options.custom } : null,
    defenceUsedTurn: 0,
    defenceLastScore: 0,
    tacticalLog: [],
    seed,
    turn: 1,
    maxTurns: mode === 'campaign' ? CAMPAIGNS[campaign].turns : 0,
    startDate: campaignStart,
    date: campaignStart,
    status: 'playing',
    outcome: null,
    phase: 'decisions',
    escalation,
    shipping,
    economy: {
      reserves: usa ? (contained ? 132 : brink ? 94 : 120) : contained ? 96 : brink ? 52 : 74,
      currency: usa ? (contained ? 76 : brink ? 55 : 68) : contained ? 62 : brink ? 35 : 48,
      inflation: usa ? (contained ? 22 : brink ? 38 : 27) : contained ? 28 : brink ? 52 : 38,
      fiscal: usa ? (contained ? 68 : brink ? 52 : 61) : contained ? 62 : brink ? 43 : 51,
      oilRevenue: usa ? (contained ? 58 : brink ? 48 : 54) : contained ? 68 : brink ? 56 : 62,
      tradeAccess: usa ? (contained ? 78 : brink ? 61 : 72) : contained ? 70 : brink ? 46 : 61,
      publicPressure: usa ? (contained ? 36 : brink ? 58 : 46) : contained ? 42 : brink ? 68 : 54,
    },
    government: {
      legitimacy: usa ? (contained ? 66 : brink ? 50 : 60) : contained ? 64 : brink ? 48 : 58,
      stability: usa ? (contained ? 70 : brink ? 56 : 64) : contained ? 68 : brink ? 52 : 61,
      elite: usa ? (contained ? 64 : brink ? 50 : 58) : contained ? 62 : brink ? 47 : 55,
      confidence: usa ? (contained ? 64 : brink ? 49 : 58) : contained ? 61 : brink ? 46 : 54,
      socialTension: usa ? (contained ? 26 : brink ? 46 : 34) : contained ? 24 : brink ? 51 : 32,
    },
    security: {
      readiness: usa ? (contained ? 64 : brink ? 76 : 70) : contained ? 51 : brink ? 68 : 58,
      defence: usa ? (contained ? 72 : brink ? 64 : 68) : contained ? 58 : brink ? 51 : 55,
      strategic: usa ? (contained ? 80 : brink ? 72 : 76) : contained ? 61 : brink ? 53 : 57,
    },
    diplomacy: {
      relations: usa
        ? { iran: contained ? 25 : brink ? 10 : 18, usa: 0, gcc: 55, qatar: 60, china: 50, eu: 58 }
        : { iran: 0, usa: contained ? 25 : brink ? 10 : 18, gcc: contained ? 48 : brink ? 32 : 42, qatar: 63, china: 58, eu: contained ? 43 : brink ? 26 : 35 },
      influence: usa ? (contained ? 68 : brink ? 52 : 61) : contained ? 51 : brink ? 37 : 44,
      talks: usa ? (contained ? 30 : brink ? 14 : 20) : contained ? 28 : brink ? 12 : 18,
      mediation: usa ? (contained ? 22 : brink ? 10 : 14) : contained ? 18 : brink ? 8 : 10,
      sanctionsRelief: usa ? (contained ? 24 : brink ? 10 : 16) : contained ? 20 : brink ? 7 : 12,
    },
    intelligence: {
      assessments: createIntel(),
      exposure: usa ? 14 : 18,
      deception: 0,
    },
    actors: createActors(),
    politicalCapital: 4,
    actionPoints: 2,
    decisions: [],
    used: {},
    pending: [],
    report: null,
    history: [],
  };
  if (mode === 'sandbox' && options.custom) {
    state.escalation.military = clamp(options.custom.military, 0, 100);
    state.escalation.diplomatic = clamp(options.custom.diplomatic, 0, 100);
    state.escalation.economic = clamp(options.custom.economic, 0, 100);
    state.escalation.domestic = clamp(options.custom.domestic, 0, 100);
    state.escalation.stage = stageOf(state.escalation);
    state.shipping.accessibility = clamp(options.custom.accessibility, 0, 100);
    state.shipping.confidence = clamp(options.custom.confidence, 0, 100);
    state.economy.reserves = clamp(options.custom.reserves, 0, 200);
    state.economy.inflation = clamp(options.custom.inflation, 0, 100);
    state.government.stability = clamp(options.custom.stability, 0, 100);
  }
  if (mode === 'campaign' && campaign === 'economic-pressure') {
    state.economy.reserves = usa ? 92 : 52;
    state.economy.inflation = usa ? 34 : 47;
    state.economy.currency = usa ? 60 : 41;
    state.economy.fiscal = usa ? 55 : 44;
    state.economy.tradeAccess = usa ? 65 : 50;
    state.economy.publicPressure = usa ? 50 : 62;
    state.escalation.economic = usa ? 58 : 64;
    state.diplomacy.sanctionsRelief = usa ? 10 : 6;
    state.diplomacy.talks = usa ? 16 : 12;
  } else if (mode === 'campaign' && campaign === 'settlement') {
    state.diplomacy.talks = usa ? 48 : 44;
    state.diplomacy.mediation = usa ? 36 : 32;
    state.diplomacy.sanctionsRelief = usa ? 28 : 24;
    state.diplomacy.relations.iran = usa ? 34 : 0;
    state.diplomacy.relations.usa = usa ? 0 : 34;
    state.escalation.diplomatic = usa ? 52 : 54;
    state.economy.publicPressure = usa ? 38 : 48;
  }
  return state;
}

function createActors(): Record<ActorId, ActorState> {
  return {
    iran: {
      id: 'iran',
      name: l('Islamic Republic of Iran', 'جمهوری اسلامی ایران'),
      objective: l('Preserve the regime and its leverage', 'حفظ نظام و اهرم فشار آن'),
      stance: -30,
      pressure: 62,
      lastAction: l('Reviewing the latest signal', 'در حال بررسی آخرین نشانه'),
    },
    usa: {
      id: 'usa',
      name: l('United States', 'ایالات متحده'),
      objective: l('Restore navigation without a ground war', 'بازگرداندن کشتیرانی بدون جنگ زمینی'),
      stance: -38,
      pressure: 72,
      lastAction: l('Reviewing options', 'در حال بررسی گزینه‌ها'),
    },
    gcc: {
      id: 'gcc',
      name: l('Gulf Cooperation Council', 'شورای همکاری خلیج فارس'),
      objective: l('Protect exports and avoid becoming a target', 'حفاظت از صادرات و پرهیز از هدف قرار گرفتن'),
      stance: 10,
      pressure: 58,
      lastAction: l('Consulting insurers', 'در حال رایزنی با بیمه‌گران'),
    },
    qatar: {
      id: 'qatar',
      name: l('Qatar', 'قطر'),
      objective: l('Mediate before the strait closes', 'میانجی‌گری پیش از بسته‌شدن تنگه'),
      stance: 54,
      pressure: 34,
      lastAction: l('Preparing a drafting mandate', 'در حال آماده‌سازی مأموریت تدوین'),
    },
    china: {
      id: 'china',
      name: l('China', 'چین'),
      objective: l('Keep energy flows and trade lanes open', 'بازنگه‌داشتن جریان انرژی و مسیر تجارت'),
      stance: 44,
      pressure: 36,
      lastAction: l('Watching the oil price', 'در حال پایش قیمت نفت'),
    },
    eu: {
      id: 'eu',
      name: l('European Union', 'اتحادیه اروپا'),
      objective: l('Contain escalation and protect shipping', 'مهار تشدید و حفاظت از کشتیرانی'),
      stance: 20,
      pressure: 41,
      lastAction: l('Preparing a statement', 'در حال آماده‌سازی بیانیه'),
    },
  };
}

function createIntel(): IntelAssessment[] {
  return [
    {
      id: 'carrier',
      title: l('Carrier intent', 'نیت ناوگروه'),
      assessment: l(
        'The US carrier group may be preparing a limited strike package rather than a sustained campaign.',
        'به نظر می‌رسد ناوگروه آمریکا در حال آماده‌سازی بسته حمله محدود است، نه یک کارزار طولانی.',
      ),
      source: l('Naval reporting', 'گزارش دریایی'),
      reliability: l('Usually reliable', 'معمولاً قابل‌اعتماد'),
      confidence: 62,
      age: 0,
      corroboration: l('Partial', 'نسبی'),
      deception: l('Possible', 'ممکن'),
    },
    {
      id: 'insurance',
      title: l('Insurance reopening', 'بازگشایی بیمه'),
      assessment: l(
        'Several Gulf insurers are testing a conditional return of Hormuz cover if the next two weeks are quiet.',
        'چند بیمه‌گر خلیجی بازگشت مشروط پوشش هرمز را در صورت آرامش دو هفته آینده آزمایش می‌کنند.',
      ),
      source: l('Commercial liaison', 'رابط تجاری'),
      reliability: l('Mixed', 'متلون'),
      confidence: 48,
      age: 2,
      corroboration: l('Unconfirmed', 'تأییدنشده'),
      deception: l('Possible', 'ممکن'),
    },
    {
      id: 'qatar-offer',
      title: l('Qatari mediation offer', 'پیشنهاد میانجی‌گری قطر'),
      assessment: l(
        'Doha has a narrow maritime proposal ready, but will only table it if Tehran avoids a visible escalation this week.',
        'دوحه پیشنهاد دریایی محدودی آماده دارد، اما تنها اگر تهران این هفته از تشدید آشکار بپرهیزد آن را ارائه می‌کند.',
      ),
      source: l('Diplomatic reporting', 'گزارش دیپلماتیک'),
      reliability: l('Usually reliable', 'معمولاً قابل‌اعتماد'),
      confidence: 71,
      age: 1,
      corroboration: l('Corroborated', 'تأییدشده'),
      deception: l('Low', 'کم'),
    },
  ];
}

export function decisionsFor(state: NationalState, department: DepartmentId): DecisionDef[] {
  return DECISIONS.filter((decision) => decision.department === department && !state.decisions.includes(decision.id));
}

export interface QueueResult {
  ok: boolean;
  reason?: L;
}

export function canQueue(state: NationalState, id: DecisionId): QueueResult {
  if (state.phase !== 'decisions' || state.status !== 'playing') return { ok: false, reason: l('The crisis is no longer accepting orders.', 'بحران دیگر دستور نمی‌پذیرد.') };
  if (state.decisions.includes(id)) return { ok: false, reason: l('This decision is already queued.', 'این تصمیم قبلاً ثبت شده است.') };
  if (state.decisions.length >= state.actionPoints) return { ok: false, reason: l('Only two departmental decisions fit in this turn.', 'در این نوبت فقط دو تصمیم وزارتی جا می‌شود.') };
  const decision = DECISION_BY_ID[id];
  if (!decision) return { ok: false, reason: l('Unknown decision.', 'تصمیم ناشناخته.') };
  if (decisionCost(state) + decision.cost > state.politicalCapital) return { ok: false, reason: l('Not enough political capital.', 'سرمایه سیاسی کافی نیست.') };
  const lastUsed = state.used?.[id];
  if (lastUsed !== undefined && decision.cooldown) {
    const readyTurn = lastUsed + decision.cooldown;
    if (state.turn < readyTurn) {
      return { ok: false, reason: l(`Available again in week ${readyTurn}.`, `دوباره از هفته ${readyTurn} در دسترس است.`) };
    }
  }
  return { ok: true };
}

export function queueDecision(state: NationalState, id: DecisionId): QueueResult {
  const result = canQueue(state, id);
  if (!result.ok) return result;
  state.decisions.push(id);
  return { ok: true };
}

export function unqueueDecision(state: NationalState, id: DecisionId): void {
  state.decisions = state.decisions.filter((decision) => decision !== id);
}

export function decisionCost(state: NationalState): number {
  return state.decisions.reduce((sum, id) => sum + DECISION_BY_ID[id].cost, 0);
}

type NumericEffectKey = Exclude<keyof Effects, 'relations' | 'delayed' | 'intelRefresh'>;

const EFFECT_LABELS: Record<NumericEffectKey, L> = {
  military: l('military tension', 'تنش نظامی'),
  diplomatic: l('diplomatic hostility', 'خصومت دیپلماتیک'),
  economic: l('economic confrontation', 'رویارویی اقتصادی'),
  domestic: l('domestic pressure', 'فشار داخلی'),
  legitimacy: l('legitimacy', 'مشروعیت'),
  stability: l('stability', 'ثبات'),
  elite: l('elite support', 'حمایت نخبگان'),
  confidence: l('public confidence', 'اعتماد عمومی'),
  socialTension: l('social tension', 'تنش اجتماعی'),
  reserves: l('reserves', 'ذخایر'),
  currency: l('currency', 'ارز'),
  inflation: l('inflation', 'تورم'),
  fiscal: l('fiscal capacity', 'توان مالی'),
  publicPressure: l('public pressure', 'فشار عمومی'),
  tradeAccess: l('trade access', 'دسترسی تجاری'),
  readiness: l('readiness', 'آمادگی'),
  defence: l('air defence', 'پدافند هوایی'),
  strategic: l('strategic capacity', 'توان راهبردی'),
  accessibility: l('route access', 'دسترسی مسیر'),
  shippingConfidence: l('market confidence', 'اطمینان بازار'),
  insurance: l('insurance cost', 'هزینه بیمه'),
  oilPrice: l('oil price', 'قیمت نفت'),
  talks: l('talks progress', 'پیشرفت مذاکره'),
  influence: l('influence', 'نفوذ'),
  sanctionsRelief: l('sanctions relief', 'کاهش تحریم'),
  mediation: l('mediation', 'میانجی‌گری'),
  exposure: l('exposure risk', 'ریسک افشا'),
  deception: l('deception', 'فریب'),
};

export function describeEffects(effects: Effects, lang: Lang, player: PlayerCountryId = 'iran'): string[] {
  const rows: string[] = [];
  for (const [key, value] of Object.entries(effects)) {
    if (key === 'relations' || key === 'delayed' || key === 'intelRefresh' || typeof value !== 'number') continue;
    const label = EFFECT_LABELS[key as NumericEffectKey];
    if (!label || value === 0) continue;
    rows.push(`${value > 0 ? '+' : ''}${Math.round(value)} ${pick(label, lang)}`);
  }
  if (effects.intelRefresh) rows.push(pick(l('refreshes the weakest assessment', 'ضعیف‌ترین ارزیابی را تازه می‌کند'), lang));
  if (effects.relations) {
    for (const [actor, value] of Object.entries(effects.relations)) {
      if (!value) continue;
      const displayActor = player === 'usa' && actor === 'usa' ? 'iran' : player === 'iran' && actor === 'iran' ? 'usa' : actor;
      rows.push(`${value > 0 ? '+' : ''}${Math.round(value)} ${pick(l('relations', 'روابط'), lang)} · ${pick(actorName(displayActor as ActorId), lang)}`);
    }
  }
  for (const delayed of effects.delayed ?? []) {
    const next = describeEffects(delayed.effect, lang).join(', ');
    if (next) rows.push(`${pick(l('next week', 'هفته بعد'), lang)}: ${next}`);
  }
  return rows;
}

function actorName(id: ActorId): L {
  return createActors()[id].name;
}

function applyEffects(state: NationalState, effects: Effects): void {
  if (effects.military !== undefined) state.escalation.military = clamp(state.escalation.military + effects.military, 0, 100);
  if (effects.diplomatic !== undefined) state.escalation.diplomatic = clamp(state.escalation.diplomatic + effects.diplomatic, 0, 100);
  if (effects.economic !== undefined) state.escalation.economic = clamp(state.escalation.economic + effects.economic, 0, 100);
  if (effects.domestic !== undefined) state.escalation.domestic = clamp(state.escalation.domestic + effects.domestic, 0, 100);
  if (effects.legitimacy !== undefined) state.government.legitimacy = clamp(state.government.legitimacy + effects.legitimacy, 0, 100);
  if (effects.stability !== undefined) state.government.stability = clamp(state.government.stability + effects.stability, 0, 100);
  if (effects.elite !== undefined) state.government.elite = clamp(state.government.elite + effects.elite, 0, 100);
  if (effects.confidence !== undefined) state.government.confidence = clamp(state.government.confidence + effects.confidence, 0, 100);
  if (effects.socialTension !== undefined) state.government.socialTension = clamp(state.government.socialTension + effects.socialTension, 0, 100);
  if (effects.reserves !== undefined) state.economy.reserves = clamp(state.economy.reserves + effects.reserves, 0, 200);
  if (effects.currency !== undefined) state.economy.currency = clamp(state.economy.currency + effects.currency, 0, 100);
  if (effects.inflation !== undefined) state.economy.inflation = clamp(state.economy.inflation + effects.inflation, 0, 100);
  if (effects.fiscal !== undefined) state.economy.fiscal = clamp(state.economy.fiscal + effects.fiscal, 0, 100);
  if (effects.publicPressure !== undefined) state.economy.publicPressure = clamp(state.economy.publicPressure + effects.publicPressure, 0, 100);
  if (effects.tradeAccess !== undefined) state.economy.tradeAccess = clamp(state.economy.tradeAccess + effects.tradeAccess, 0, 100);
  if (effects.readiness !== undefined) state.security.readiness = clamp(state.security.readiness + effects.readiness, 0, 100);
  if (effects.defence !== undefined) state.security.defence = clamp(state.security.defence + effects.defence, 0, 100);
  if (effects.strategic !== undefined) state.security.strategic = clamp(state.security.strategic + effects.strategic, 0, 100);
  if (effects.accessibility !== undefined) state.shipping.accessibility = clamp(state.shipping.accessibility + effects.accessibility, 0, 100);
  if (effects.shippingConfidence !== undefined) state.shipping.confidence = clamp(state.shipping.confidence + effects.shippingConfidence, 0, 100);
  if (effects.insurance !== undefined) state.shipping.insurance = clamp(state.shipping.insurance + effects.insurance, 0, 100);
  if (effects.oilPrice !== undefined) state.shipping.oilPrice = clamp(state.shipping.oilPrice + effects.oilPrice, 40, 180);
  if (effects.talks !== undefined) state.diplomacy.talks = clamp(state.diplomacy.talks + effects.talks, 0, 100);
  if (effects.influence !== undefined) state.diplomacy.influence = clamp(state.diplomacy.influence + effects.influence, 0, 100);
  if (effects.sanctionsRelief !== undefined) state.diplomacy.sanctionsRelief = clamp(state.diplomacy.sanctionsRelief + effects.sanctionsRelief, 0, 100);
  if (effects.mediation !== undefined) state.diplomacy.mediation = clamp(state.diplomacy.mediation + effects.mediation, 0, 100);
  if (effects.exposure !== undefined) state.intelligence.exposure = clamp(state.intelligence.exposure + effects.exposure, 0, 100);
  if (effects.deception !== undefined) state.intelligence.deception = clamp(state.intelligence.deception + effects.deception, 0, 100);
  if (effects.relations) {
    for (const [actor, value] of Object.entries(effects.relations)) {
      const id = (state.player === 'usa' && actor === 'usa' ? 'iran' : state.player === 'iran' && actor === 'iran' ? 'usa' : actor) as ActorId;
      if (value !== undefined) state.diplomacy.relations[id] = clamp(state.diplomacy.relations[id] + value, -100, 100);
    }
  }
  if (effects.intelRefresh) refreshIntel(state);
  for (const delayed of effects.delayed ?? []) {
    state.pending.push({ dueTurn: state.turn + 1, effect: delayed.effect, note: delayed.note });
  }
}

function refreshIntel(state: NationalState): void {
  const weakest = [...state.intelligence.assessments].sort((a, b) => a.confidence - b.confidence)[0];
  if (!weakest) return;
  weakest.confidence = clamp(weakest.confidence + 15, 0, 96);
  weakest.age = 0;
  weakest.corroboration = l('Corroborated', 'تأییدشده');
}

function rngFor(seed: number, turn: number, salt: string): () => number {
  let h = seed ^ (turn * 374761393) ^ [...salt].reduce((acc, c) => acc + c.charCodeAt(0) * 131, 0);
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

function actorLine(state: NationalState, actor: ActorState, text: L, tone: ReportLine['tone'], report: NationalReport): void {
  actor.lastAction = text;
  report.lines.push({ text, tone });
  state.diplomacy.relations[actor.id] = clamp(state.diplomacy.relations[actor.id] + (tone === 'good' ? 1 : tone === 'bad' ? -1 : 0), -100, 100);
}

function iranActorPhase(state: NationalState, report: NationalReport): void {
  const iran = state.actors.iran;
  if (state.diplomacy.talks >= 55) {
    state.diplomacy.talks = clamp(state.diplomacy.talks + 3, 0, 100);
    state.escalation.diplomatic = clamp(state.escalation.diplomatic - 3, 0, 100);
    actorLine(
      state,
      iran,
      l(
        'Tehran signals that a technical shipping channel is better than a wider war, while denying that it is negotiating under pressure.',
        'تهران نشان می‌دهد که کانال فنی کشتیرانی را بهتر از جنگ گسترده می‌داند، اما مذاکره تحت فشار را رد می‌کند.',
      ),
      'good',
      report,
    );
  } else if (state.escalation.stage >= 5) {
    state.escalation.military = clamp(state.escalation.military + 3, 0, 100);
    state.shipping.confidence = clamp(state.shipping.confidence - 3, 0, 100);
    actorLine(
      state,
      iran,
      l(
        'Iran moves coastal defence batteries and warns that any strike will be answered across the Gulf.',
        'ایران باتری‌های دفاع ساحلی را جابه‌جا کرد و هشدار داد هر حمله‌ای در سراسر خلیج پاسخ داده می‌شود.',
      ),
      'bad',
      report,
    );
  } else {
    state.escalation.military = clamp(state.escalation.military + 1, 0, 100);
    state.shipping.insurance = clamp(state.shipping.insurance + 2, 0, 100);
    actorLine(
      state,
      iran,
      l(
        'Iran tests a short-range naval system near the strait. The exercise is calibrated to be seen, not to close the route.',
        'ایران یک سامانه دریایی کوتاه‌برد را نزدیک تنگه آزمایش کرد. این رزمایش برای دیده‌شدن تنظیم شده، نه بستن مسیر.',
      ),
      'info',
      report,
    );
  }
}

function actorPhase(state: NationalState, report: NationalReport): void {
  const rng = rngFor(state.seed, state.turn, 'actors');
  const usa = state.actors.usa;
  if (state.player === 'usa') {
    iranActorPhase(state, report);
  } else if (state.intelligence.deception >= 10 && rng() > 0.35) {
    state.escalation.military = clamp(state.escalation.military - 4, 0, 100);
    usa.pressure = clamp(usa.pressure - 5, 0, 100);
    actorLine(
      state,
      usa,
      l(
        'US analysts over-read Iranian readiness. The carrier group slows its tempo while it re-checks the picture.',
        'تحلیل‌گران آمریکایی آمادگی ایران را بیش‌برآورد کردند. ناوگروه تا بازبینی تصویر، آهنگ خود را کند کرد.',
      ),
      'info',
      report,
    );
    state.intelligence.deception = clamp(state.intelligence.deception - 7, 0, 100);
  } else if (state.diplomacy.talks >= 52) {
    state.escalation.diplomatic = clamp(state.escalation.diplomatic - 4, 0, 100);
    state.diplomacy.talks = clamp(state.diplomacy.talks + 4, 0, 100);
    actorLine(
      state,
      usa,
      l(
        'Washington authorises a technical channel on shipping safety, while keeping sanctions in place.',
        'واشنگتن یک کانال فنی درباره امنیت کشتیرانی را مجاز کرد، در حالی که تحریم‌ها را حفظ می‌کند.',
      ),
      'good',
      report,
    );
  } else if (state.escalation.stage >= 5) {
    state.escalation.military = clamp(state.escalation.military + 3, 0, 100);
    state.shipping.confidence = clamp(state.shipping.confidence - 3, 0, 100);
    actorLine(
      state,
      usa,
      l(
        'The Pentagon moves additional interceptors into the Gulf and warns that the next attack will bring a wider response.',
        'پنتاگون رهگیرهای بیشتری را به خلیج فرستاد و هشدار داد حمله بعدی پاسخ گسترده‌تری خواهد داشت.',
      ),
      'bad',
      report,
    );
  } else {
    state.diplomacy.sanctionsRelief = clamp(state.diplomacy.sanctionsRelief - 2, 0, 100);
    state.economy.tradeAccess = clamp(state.economy.tradeAccess - 2, 0, 100);
    actorLine(
      state,
      usa,
      l(
        'The Treasury tightens enforcement on oil shipments and insurance broking linked to Iran.',
        'خزانه‌داری اجرای مقررات بر محموله‌های نفتی و دلالان بیمه مرتبط با ایران را سخت‌تر کرد.',
      ),
      'bad',
      report,
    );
  }

  const gcc = state.actors.gcc;
  if (state.shipping.confidence < 45 || state.diplomacy.talks < 35) {
    state.shipping.insurance = clamp(state.shipping.insurance + 4, 0, 100);
    state.shipping.confidence = clamp(state.shipping.confidence - 3, 0, 100);
    actorLine(
      state,
      gcc,
      l(
        'Gulf insurers demand government guarantees before writing new Hormuz cover. Rates rise again.',
        'بیمه‌گران خلیجی پیش از صدور پوشش تازه هرمز، ضمانت دولتی می‌خواهند. نرخ‌ها دوباره بالا رفت.',
      ),
      'warn',
      report,
    );
  } else {
    state.diplomacy.talks = clamp(state.diplomacy.talks + 3, 0, 100);
    actorLine(
      state,
      gcc,
      l(
        'The GCC quietly supports a technical shipping corridor and asks both sides to keep the lane open.',
        'شورای همکاری خلیج فارس بی‌سروصدا از کریدور فنی کشتیرانی حمایت کرد و از دو طرف خواست مسیر باز بماند.',
      ),
      'good',
      report,
    );
  }

  const qatar = state.actors.qatar;
  if (state.escalation.stage >= 4 && state.diplomacy.talks < 75) {
    state.diplomacy.talks = clamp(state.diplomacy.talks + 2, 0, 100);
    state.diplomacy.mediation = clamp(state.diplomacy.mediation + 2, 0, 100);
    state.escalation.diplomatic = clamp(state.escalation.diplomatic - 2, 0, 100);
    actorLine(
      state,
      qatar,
      l(
        'Doha circulates a one-page maritime understanding: no formal truce, but a shared hotline and a shipping lane.',
        'دوحه یک تفاهم یک‌صفحه‌ای دریایی را توزیع کرد: نه آتش‌بس رسمی، بلکه خط تماس مشترک و یک مسیر کشتیرانی.',
      ),
      'good',
      report,
    );
  } else {
    state.diplomacy.relations.qatar = clamp(state.diplomacy.relations.qatar + 2, -100, 100);
    actorLine(
      state,
      qatar,
      l('Qatar keeps its mediation channel warm and waits for a quieter week.', 'قطر کانال میانجی‌گری را گرم نگه می‌دارد و منتظر هفته‌ای آرام‌تر است.'),
      'info',
      report,
    );
  }

  const china = state.actors.china;
  if (state.shipping.oilPrice >= 105) {
    state.diplomacy.relations.china = clamp(state.diplomacy.relations.china - 2, -100, 100);
    state.economy.tradeAccess = clamp(state.economy.tradeAccess + 2, 0, 100);
    actorLine(
      state,
      china,
      l(
        'Beijing presses Tehran to keep energy flows open while quietly buying discounted cargoes.',
        'پکن تهران را به بازنگه‌داشتن جریان انرژی فشار می‌دهد و همزمان محموله‌های تخفیف‌دار می‌خرد.',
      ),
      'warn',
      report,
    );
  } else {
    state.diplomacy.relations.china = clamp(state.diplomacy.relations.china + 1, -100, 100);
    actorLine(
      state,
      china,
      l('China calls for de-escalation and offers to host technical talks.', 'چین خواستار کاهش تنش شد و پیشنهاد میزبانی مذاکرات فنی را داد.'),
      'info',
      report,
    );
  }

  const eu = state.actors.eu;
  if (state.government.legitimacy < 46) {
    state.escalation.economic = clamp(state.escalation.economic + 3, 0, 100);
    state.diplomacy.sanctionsRelief = clamp(state.diplomacy.sanctionsRelief - 4, 0, 100);
    actorLine(
      state,
      eu,
      l('The EU freezes a package of shipping and financial measures, citing the government’s domestic conduct.', 'اتحادیه اروپا بسته‌ای از اقدامات کشتیرانی و مالی را با استناد به رفتار داخلی دولت توقف کرد.'),
      'bad',
      report,
    );
  } else {
    state.diplomacy.relations.eu = clamp(state.diplomacy.relations.eu + 2, -100, 100);
    state.government.legitimacy = clamp(state.government.legitimacy + 1, 0, 100);
    actorLine(
      state,
      eu,
      l('The EU keeps humanitarian trade open and praises the government’s restraint.', 'اتحادیه اروپا تجارت بشردوستانه را باز نگه داشت و خویشتن‌داری دولت را ستود.'),
      'good',
      report,
    );
  }
}

function updateSystems(state: NationalState, report: NationalReport): void {
  const beforeStage = state.escalation.stage;
  const s = state.shipping;
  const e = state.economy;
  const g = state.government;

  const flowTarget = clamp(s.accessibility * (0.35 + s.confidence / 155), 4, 100);
  s.flow = clamp(s.flow + (flowTarget - s.flow) * 0.36, 3, 100);
  s.insurance = clamp(55 + (100 - s.confidence) * 0.55 + (100 - s.accessibility) * 0.25 + state.escalation.military * 0.12, 0, 100);
  s.oilPrice = clamp(73 + (100 - s.flow) * 0.72 + state.escalation.military * 0.18 + (100 - s.energyStability) * 0.08, 45, 180);
  s.energyStability = clamp(100 - (s.oilPrice - 75) * 0.55 - (100 - s.flow) * 0.18, 15, 100);

  const sanctions = (100 - state.diplomacy.sanctionsRelief) * 0.012;
  e.reserves = clamp(e.reserves + (s.oilPrice - 80) * 0.035 + (s.flow - 45) * 0.03 - sanctions - (100 - e.tradeAccess) * 0.025 - 0.35, 0, 200);
  e.currency = clamp(e.currency + (e.reserves - 48) * 0.035 - (e.inflation - 35) * 0.05 - sanctions * 0.4, 0, 100);
  e.inflation = clamp(e.inflation + (s.oilPrice - 86) * 0.07 + (50 - e.currency) * 0.06 + (58 - s.flow) * 0.025 - e.fiscal * 0.012, 0, 100);
  e.fiscal = clamp(e.fiscal + (s.oilPrice - 85) * 0.025 + (s.flow - 40) * 0.02 - (e.publicPressure - 50) * 0.025, 0, 100);
  e.publicPressure = clamp(e.publicPressure + (e.inflation - 40) * 0.08 + (52 - g.confidence) * 0.035 - (g.legitimacy - 50) * 0.02, 0, 100);
  e.oilRevenue = clamp(40 + s.flow * 0.42 + (s.oilPrice - 70) * 0.2, 0, 100);

  g.socialTension = clamp(g.socialTension + (e.publicPressure - 50) * 0.045 - (g.confidence - 50) * 0.025 + (50 - g.elite) * 0.015, 0, 100);
  g.stability = clamp(g.stability + (g.legitimacy - 50) * 0.025 + (g.confidence - 50) * 0.025 - (g.socialTension - 35) * 0.04 - (e.publicPressure - 55) * 0.025, 0, 100);
  g.legitimacy = clamp(g.legitimacy + (g.elite - 50) * 0.012 - (e.publicPressure - 55) * 0.012, 0, 100);

  state.escalation.military = clamp(state.escalation.military + (state.security.readiness - 55) * 0.02 - (state.diplomacy.talks > 50 ? 1.2 : 0.25), 0, 100);
  state.escalation.diplomatic = clamp(
    state.escalation.diplomatic + (45 - state.diplomacy.sanctionsRelief) * 0.035 - state.diplomacy.talks * 0.018 + (state.government.legitimacy < 45 ? 2 : 0),
    0,
    100,
  );
  state.escalation.economic = clamp(
    state.escalation.economic + (55 - state.economy.tradeAccess) * 0.035 + (50 - state.shipping.confidence) * 0.018 - state.diplomacy.sanctionsRelief * 0.012,
    0,
    100,
  );
  state.escalation.domestic = clamp(state.escalation.domestic + (state.economy.publicPressure - 50) * 0.045 + (state.government.socialTension - 35) * 0.025, 0, 100);
  state.escalation.stage = stageOf(state.escalation);

  if (state.escalation.stage !== beforeStage) {
    report.lines.push({
      text:
        state.escalation.stage > beforeStage
          ? l('The crisis has moved to a higher stage.', 'بحران به مرحله بالاتری رفته است.')
          : l('The crisis has stepped back from the brink.', 'بحران یک پله از لبه عقب نشسته است.'),
      tone: state.escalation.stage > beforeStage ? 'bad' : 'good',
    });
  }
  if (s.insurance >= 78) {
    report.lines.push({ text: l('War-risk insurance is now the binding constraint on shipping, not the physical route.', 'اکنون بیمه ریسک جنگ محدودکننده اصلی کشتیرانی است، نه مسیر فیزیکی.'), tone: 'warn' });
  }
  if (s.flow <= 24) {
    report.lines.push({ text: l('Commercial traffic has thinned to a trickle. Export revenue is falling faster than the official price suggests.', 'ترافیک تجاری به قطره‌ای رسیده است. درآمد صادرات سریع‌تر از قیمت رسمی افت می‌کند.'), tone: 'bad' });
  }
  if (e.inflation >= 58) {
    report.lines.push({ text: l('Food and import inflation is becoming a household crisis, not a statistics problem.', 'تورم غذا و واردات به بحران خانوار تبدیل می‌شود، نه یک مسئله آماری.'), tone: 'bad' });
  }
  if (e.reserves <= 22) {
    report.lines.push({ text: l('Reserves are approaching the level where the central bank can no longer defend the currency.', 'ذخایر به سطحی نزدیک می‌شود که بانک مرکزی دیگر نمی‌تواند از ارز دفاع کند.'), tone: 'bad' });
  }
  if (g.stability <= 30) {
    report.lines.push({ text: l('Provincial governors report that the security services are stretched.', 'استانداران گزارش می‌دهند که نیروهای امنیتی تحت فشارند.'), tone: 'bad' });
  }
}

export function adversaryRelation(state: NationalState): number {
  return state.player === 'iran' ? state.diplomacy.relations.usa : state.diplomacy.relations.iran;
}

function objectivesFor(state: NationalState): ObjectiveRow[] {
  const governance = Math.min(state.government.stability, state.government.legitimacy + 8);
  const economy = Math.min(state.economy.reserves * 2.2, 100 - state.economy.inflation);
  const diplomacy = Math.max(state.diplomacy.talks, state.diplomacy.influence, adversaryRelation(state));
  return [
    {
      id: 'security',
      label: l('National security', 'امنیت ملی'),
      detail: l('Defensive readiness and crisis below regional war', 'آمادگی دفاعی و بحران زیر جنگ منطقه‌ای'),
      value: Math.round((state.security.defence + (state.escalation.stage <= 4 ? 100 : 50)) / 2),
      target: 55,
      met: state.security.defence >= 52 && state.escalation.stage <= 4,
      priority: state.priorities.includes('security'),
    },
    {
      id: 'governance',
      label: l('Political survival', 'بقای سیاسی'),
      detail: l('Stability and legitimacy remain above the floor', 'ثبات و مشروعیت بالای کف'),
      value: Math.round(governance),
      target: 45,
      met: state.government.stability >= 45 && state.government.legitimacy >= 48,
      priority: state.priorities.includes('governance'),
    },
    {
      id: 'economy',
      label: l('Economic resilience', 'تاب‌آوری اقتصادی'),
      detail: l('Reserves and inflation stay within a governing range', 'ذخایر و تورم در محدوده قابل اداره'),
      value: Math.round(economy),
      target: 45,
      met: state.economy.reserves >= 25 && state.economy.inflation <= 60,
      priority: state.priorities.includes('economy'),
    },
    {
      id: 'diplomacy',
      label: l('Diplomatic room', 'فضای دیپلماتیک'),
      detail: l('A settlement track or usable major-power relationship', 'مسیر توافق یا رابطه قابل استفاده با قدرت بزرگ'),
      value: Math.round(diplomacy),
      target: 50,
      met: state.diplomacy.talks >= 55 || adversaryRelation(state) >= 35 || state.diplomacy.influence >= 55,
      priority: state.priorities.includes('diplomacy'),
    },
    {
      id: 'crisis',
      label: l('Crisis control', 'کنترل بحران'),
      detail: l('Keep the crisis below catastrophic escalation', 'نگه‌داشتن بحران زیر تشدید فاجعه‌بار'),
      value: state.escalation.stage <= 4 ? 100 - state.escalation.stage * 8 : Math.max(5, 42 - state.escalation.stage * 6),
      target: 55,
      met: state.escalation.stage <= 4,
      priority: state.priorities.includes('crisis'),
    },
  ];
}

export function objectives(state: NationalState): ObjectiveRow[] {
  return objectivesFor(state);
}

export function objectiveCount(state: NationalState): { met: number; total: number } {
  const rows = objectivesFor(state);
  return { met: rows.filter((row) => row.met).length, total: rows.length };
}

function axes(state: NationalState): Record<string, number> {
  const security = clamp((state.security.defence + state.security.readiness + (100 - state.escalation.military)) / 3, 0, 100);
  const governance = clamp((state.government.legitimacy + state.government.stability + state.government.confidence - state.government.socialTension * 0.5) / 2.5, 0, 100);
  const economy = clamp((state.economy.reserves * 1.6 + state.economy.currency + (100 - state.economy.inflation) + state.economy.tradeAccess) / 4, 0, 100);
  const diplomacy = clamp((state.diplomacy.talks + state.diplomacy.influence + (adversaryRelation(state) + 100) / 2 + state.diplomacy.mediation) / 4, 0, 100);
  return {
    security,
    governance,
    economy,
    diplomacy,
    overall: (security + governance + economy + diplomacy) / 4,
  };
}

export function score(state: NationalState): Record<string, number> {
  const raw = axes(state);
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Math.round(value)]));
}

function evaluateOutcome(state: NationalState, finalTurn: boolean): Outcome | null {
  const g = state.government;
  const e = state.economy;
  const scores = axes(state);
  if (g.stability <= 12 || g.legitimacy <= 10) {
    return {
      status: 'lost',
      verdict: 'defeat',
      title: l('Government collapse', 'فروپاشی دولت'),
      text: l('The government lost the confidence of its own institutions. The crisis is now being settled by people who do not answer to you.', 'دولت اعتماد نهادهای خود را از دست داد. بحران اکنون توسط کسانی حل می‌شود که به شما پاسخ نمی‌دهند.'),
      score: Math.round(scores.overall),
    };
  }
  if (e.reserves <= 1) {
    return {
      status: 'lost',
      verdict: 'defeat',
      title: l('Economic collapse', 'فروپاشی اقتصادی'),
      text: l('Reserves are exhausted and the currency can no longer finance the state. The war ends with a government that cannot pay for peace.', 'ذخایر تمام شد و ارز دیگر نمی‌تواند دولت را تأمین کند. جنگ با دولتی تمام می‌شود که هزینه صلح را هم ندارد.'),
      score: Math.round(scores.overall),
    };
  }
  if (state.escalation.stage >= 6 && state.escalation.military >= 88 && state.escalation.diplomatic >= 85) {
    return {
      status: 'lost',
      verdict: 'catastrophe',
      title: l('Catastrophic escalation', 'تشدید فاجعه‌بار'),
      text: l('The crisis crossed every off-ramp. The regime survives only as a subordinate of the wider war.', 'بحران از همه خروجی‌ها گذشت. رژیم تنها به‌عنوان زیرمجموعه جنگ گسترده‌تر باقی می‌ماند.'),
      score: Math.round(scores.overall),
    };
  }
  if (
    state.turn >= 5 &&
    state.diplomacy.talks >= 88 &&
    state.diplomacy.mediation >= 38 &&
    state.government.stability >= 45 &&
    state.economy.reserves >= 18 &&
    state.economy.inflation <= 75 &&
    state.escalation.stage <= 4
  ) {
    return {
      status: 'won',
      verdict: 'negotiated',
      title: l('Negotiated settlement', 'توافق مذاکره‌شده'),
      text: l('A narrow maritime understanding is signed. The strait reopens under monitoring, sanctions are eased in stages, and both sides call it restraint.', 'یک تفاهم دریایی محدود امضا شد. تنگه زیر نظارت باز می‌شود، تحریم‌ها مرحله‌ای کاهش می‌یابد و دو طرف آن را خویشتن‌داری می‌نامند.'),
      score: Math.round(scores.overall),
    };
  }
  if (!finalTurn) return null;

  const rows = objectivesFor(state);
  const met = rows.filter((row) => row.met).length;
  const priorityMet = rows.filter((row) => row.priority && row.met).length;
  const economyMet = rows.find((row) => row.id === 'economy')?.met ?? false;
  if (
    scores.security >= 55 &&
    (scores.economy < 45 || scores.governance < 45 || state.economy.reserves < 18 || state.economy.inflation > 75)
  ) {
    return {
      status: 'drawn',
      verdict: 'pyrrhic',
      title: l('Pyrrhic survival', 'بقای پیره‌ای'),
      text: l('The regime survives and the armed forces remain intact, but the economy and public contract are badly damaged. This is endurance, not a victory.', 'رژیم و نیروهای مسلح باقی می‌مانند، اما اقتصاد و قرارداد عمومی به‌شدت آسیب دیده است. این تاب‌آوری است، نه پیروزی.'),
      score: Math.round(scores.overall),
    };
  }
  if (met >= 4 && priorityMet >= 1 && scores.overall >= 58 && economyMet) {
    return {
      status: 'won',
      verdict: 'strategic',
      title: l('Strategic victory', 'پیروزی راهبردی'),
      text: l('The state ends the campaign with its government, economy and diplomatic channels intact. The strait is still contested, but the crisis no longer dictates the country’s future.', 'کشور کارزار را با دولت، اقتصاد و کانال‌های دیپلماتیک سالم به پایان می‌رساند. تنگه هنوز محل منازعه است، اما بحران دیگر آینده کشور را تعیین نمی‌کند.'),
      score: Math.round(scores.overall),
    };
  }
  if (met >= 3 || scores.overall >= 52) {
    return {
      status: 'won',
      verdict: 'limited',
      title: l('Limited victory', 'پیروزی محدود'),
      text: l('The country holds together, but the settlement is incomplete. Some objectives were traded away to keep the state solvent and the crisis contained.', 'کشور سرپا ماند، اما توافق ناقص است. بخشی از اهداف برای حفظ توان مالی دولت و مهار بحران معامله شد.'),
      score: Math.round(scores.overall),
    };
  }
  return {
    status: 'lost',
    verdict: 'defeat',
    title: l('Strategic defeat', 'شکست راهبردی'),
    text: l('The crisis ends on terms set by others. The government remains in office, but it has lost the ability to choose its next move.', 'بحران با شرایط دیگران پایان می‌یابد. دولت در قدرت می‌ماند، اما توان انتخاب گام بعدی را از دست داده است.'),
    score: Math.round(scores.overall),
  };
}

export function canRunDefence(state: NationalState): { ok: boolean; reason?: L } {
  if (state.phase === 'ended') return { ok: false, reason: l('The campaign is over.', 'کارزار تمام شده است.') };
  if (state.defenceUsedTurn === state.turn) return { ok: false, reason: l('The defence plot has already been run this week.', 'طرح پدافندی این هفته قبلاً اجرا شده است.') };
  return { ok: true };
}

export function resolveDefence(state: NationalState, allocation: DefenceAllocation): DefenceResult {
  const available = canRunDefence(state);
  const values = [allocation.command, allocation.ports, allocation.cities];
  if (!available.ok) {
    return { ok: false, reason: available.reason, score: 0, intercepted: 0, total: 0, raids: [], effects: {}, lines: [] };
  }
  if (values.some((value) => !Number.isInteger(value) || value < 0) || values.reduce((sum, value) => sum + value, 0) !== 3) {
    return {
      ok: false,
      reason: l('Allocate exactly three interceptor batteries.', 'دقیقاً سه باتری رهگیر تخصیص دهید.'),
      score: 0,
      intercepted: 0,
      total: 0,
      raids: [],
      effects: {},
      lines: [],
    };
  }
  const raids: DefenceRaid[] = [
    { sector: 'command', strength: 2 },
    { sector: 'ports', strength: state.escalation.stage >= 5 ? 3 : 2 },
    { sector: 'cities', strength: 2 },
  ];
  const total = raids.reduce((sum, raid) => sum + raid.strength, 0);
  const intercepted = raids.reduce((sum, raid) => sum + Math.min(raid.strength, allocation[raid.sector]), 0);
  const score = Math.round((intercepted / total) * 100);
  const effects: Effects =
    score >= 70
      ? { defence: 2, readiness: 1, confidence: 2, stability: 1 }
      : score >= 45
        ? { insurance: 2, confidence: -1, readiness: -1 }
        : { defence: -3, stability: -3, insurance: 4, socialTension: 2, confidence: -2 };
  applyEffects(state, effects);
  state.defenceUsedTurn = state.turn;
  state.defenceLastScore = score;
  state.tacticalLog.push({ turn: state.turn, allocation: { ...allocation } });
  const lines: L[] = [
    l(
      `The air-defence plot intercepts ${intercepted} of ${total} raid packages.`, `طرح پدافند هوایی ${intercepted} از ${total} بسته حمله را رهگیری کرد.`,
    ),
    score >= 70
      ? l('Command nodes and the port approach hold. The public sees a competent defence.', 'گره‌های فرماندهی و ورودی بندر حفظ شد. مردم دفاعی شایسته می‌بینند.')
      : score >= 45
        ? l('The raid is partial. Some traffic is hit and insurers reprice the route.', 'حمله ناقص مهار شد. بخشی از ترافیک آسیب دید و بیمه‌گران مسیر را بازقیمت‌گذاری کردند.')
        : l('A sector is left uncovered. The damage is visible and the cabinet is blamed for it.', 'یک بخش بی‌پوشش ماند. خسارت آشکار است و کابینه سرزنش می‌شود.'),
  ];
  return { ok: true, score, intercepted, total, raids, effects, lines };
}

function headlineFor(decisions: DecisionId[]): L {
  if (decisions.length === 0) return l('A week of waiting and managing the inherited crisis.', 'هفته‌ای از انتظار و مدیریت بحران به‌ارث‌رسیده.');
  const first = DECISION_BY_ID[decisions[0]!];
  return l(`The cabinet chose: ${first.title.en}.`, `کابینه برگزید: ${first.title.fa}.`);
}

export function resolveTurn(state: NationalState): NationalReport {
  if (state.phase === 'ended') {
    return state.report ?? { turn: state.turn, decisions: [], headline: l('The campaign is over.', 'کارزار تمام شده است.'), lines: [] };
  }
  const report: NationalReport = {
    turn: state.turn,
    decisions: [...state.decisions],
    headline: headlineFor(state.decisions),
    lines: [],
  };
  const spent = decisionCost(state);
  state.politicalCapital = clamp(state.politicalCapital - spent, 0, 10);
  for (const id of state.decisions) {
    const decision = DECISION_BY_ID[id];
    applyEffects(state, decision.effects);
    state.used[id] = state.turn;
    report.lines.push({ text: decision.log, tone: 'info' });
  }

  const due = state.pending.filter((item) => item.dueTurn <= state.turn);
  state.pending = state.pending.filter((item) => item.dueTurn > state.turn);
  for (const item of due) {
    applyEffects(state, item.effect);
    report.lines.push({ text: item.note, tone: 'warn' });
  }

  actorPhase(state, report);
  updateSystems(state, report);

  for (const event of triggeredEvents(state)) {
    applyEffects(state, event.effects);
    state.firedEvents.push(event.id);
    report.lines.push({ text: event.text, tone: event.tone });
  }

  for (const assessment of state.intelligence.assessments) {
    assessment.age += 1;
    assessment.confidence = clamp(assessment.confidence - 2, 0, 100);
  }
  state.intelligence.exposure = clamp(state.intelligence.exposure + (state.escalation.stage >= 5 ? 2 : 0), 0, 100);

  const finalTurn = state.mode === 'campaign' && state.turn >= state.maxTurns;
  const outcome = evaluateOutcome(state, finalTurn);
  state.report = report;
  state.history.push(report);
  if (outcome) {
    state.status = outcome.status;
    state.outcome = outcome;
    state.phase = 'ended';
  } else {
    state.turn += 1;
    state.date = addDays(state.startDate, (state.turn - 1) * 7);
    state.decisions = [];
    state.actionPoints = 2;
    state.politicalCapital = clamp(state.politicalCapital + 3, 0, 10);
  }
  return report;
}

export function availableCapital(state: NationalState): number {
  return state.politicalCapital - decisionCost(state);
}

export function saveKey(): string {
  return 'chokepoint:national:v1';
}

export interface NationalReplayTurn {
  turn: number;
  decisions: DecisionId[];
  tactical?: DefenceAllocation;
}

export interface NationalReplay {
  version: 1;
  mode: Mode;
  intensity: Intensity;
  player: PlayerCountryId;
  campaign: CampaignId;
  priorities: ObjectiveId[];
  seed: number;
  customStart?: CustomStart;
  turns: NationalReplayTurn[];
}

export function createReplay(state: NationalState): NationalReplay {
  return {
    version: 1,
    mode: state.mode,
    intensity: state.intensity,
    player: state.player,
    campaign: state.campaign,
    priorities: [...state.priorities],
    seed: state.seed,
    ...(state.customStart ? { customStart: { ...state.customStart } } : {}),
    turns: state.history.map((entry) => {
      const tactical = state.tacticalLog.find((action) => action.turn === entry.turn);
      return {
        turn: entry.turn,
        decisions: [...entry.decisions],
        ...(tactical ? { tactical: { ...tactical.allocation } } : {}),
      };
    }),
  };
}

export function replaySession(replay: NationalReplay): { ok: true; state: NationalState } | { ok: false; error: L } {
  if (
    !replay ||
    replay.version !== 1 ||
    !Number.isFinite(replay.seed) ||
    !['campaign', 'sandbox'].includes(replay.mode) ||
    !['contained', 'flashpoint', 'brink'].includes(replay.intensity) ||
    !['iran', 'usa'].includes(replay.player) ||
    !(replay.campaign in CAMPAIGNS) ||
    !Array.isArray(replay.priorities) ||
    !Array.isArray(replay.turns) ||
    replay.turns.length > 200
  ) {
    return { ok: false, error: l('Not a valid National Command replay.', 'این یک بازپخش معتبر فرمان ملی نیست.') };
  }
  let state = createInitialState(replay.mode, replay.intensity, replay.seed, {
    player: replay.player,
    campaign: replay.campaign,
    priorities: replay.priorities,
    custom: replay.customStart,
  });
  for (const entry of replay.turns) {
    if (state.phase === 'ended') break;
    if (!entry || entry.turn !== state.turn || !Array.isArray(entry.decisions)) {
      return { ok: false, error: l('The replay turns are corrupted or out of order.', 'هفته‌های بازپخش خراب یا نامرتب هستند.') };
    }
    if (entry.tactical) {
      const defence = resolveDefence(state, entry.tactical);
      if (!defence.ok) return { ok: false, error: defence.reason ?? l('Invalid defence action in replay.', 'اقدام پدافندی نامعتبر در بازپخش.') };
    }
    for (const id of entry.decisions) {
      const result = queueDecision(state, id);
      if (!result.ok) {
        return { ok: false, error: result.reason ?? l('A replay decision is not valid in this state.', 'یک تصمیم بازپخش در این وضعیت معتبر نیست.') };
      }
    }
    resolveTurn(state);
  }
  return { ok: true, state };
}

export function encodeState(state: NationalState): string {
  return JSON.stringify({ version: 1, savedAt: Date.now(), state });
}

export function decodeState(raw: string): NationalState | null {
  try {
    const parsed = JSON.parse(raw) as { version?: number; state?: NationalState };
    if (parsed.version !== 1 || !parsed.state) return null;
    const state = parsed.state;
    if (!state || state.version !== 1 || !state.government || !state.shipping || !state.economy) return null;
    if (!state.used) state.used = {};
    state.player = state.player === 'usa' ? 'usa' : 'iran';
    state.campaign = state.campaign && state.campaign in CAMPAIGNS ? state.campaign : 'hormuz';
    state.priorities = normalizePriorities(state.priorities);
    state.firedEvents = Array.isArray(state.firedEvents) ? state.firedEvents : [];
    state.customStart = state.customStart && typeof state.customStart === 'object' ? state.customStart : null;
    state.defenceUsedTurn = Number.isFinite(state.defenceUsedTurn) ? state.defenceUsedTurn : 0;
    state.defenceLastScore = Number.isFinite(state.defenceLastScore) ? state.defenceLastScore : 0;
    state.tacticalLog = Array.isArray(state.tacticalLog) ? state.tacticalLog : [];
    if (state.diplomacy.relations && !state.diplomacy.relations.iran) state.diplomacy.relations.iran = 0;
    if (state.actors && !state.actors.iran) state.actors.iran = createActors().iran;
    return state;
  } catch {
    return null;
  }
}

export function saveState(state: NationalState): boolean {
  try {
    localStorage.setItem(saveKey(), encodeState(state));
    return true;
  } catch {
    return false;
  }
}

export function loadState(): NationalState | null {
  try {
    const raw = localStorage.getItem(saveKey());
    return raw ? decodeState(raw) : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(saveKey());
  } catch {
    /* storage is optional */
  }
}

export function metricTone(value: number, inverse = false): 'good' | 'warn' | 'bad' {
  const v = inverse ? 100 - value : value;
  if (v >= 60) return 'good';
  if (v >= 38) return 'warn';
  return 'bad';
}
