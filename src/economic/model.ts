/**
 * Chokepoint: Economic Survival — independent monthly crisis simulation.
 *
 * Deliberately isolated from the theatre game and from National Command.
 * All data below is illustrative, not a claim of real-world statistical accuracy.
 */
import type { Lang } from '../i18n';
import { triggeredEconomicEvents } from './events';

export type Mode = 'campaign' | 'sandbox';
export type ScenarioId = 'hormuz' | 'oil-collapse' | 'currency-crisis' | 'sanctions-squeeze' | 'food-energy-shock';
export type InstitutionId = 'central-bank' | 'finance' | 'energy' | 'trade' | 'security' | 'political';
export type ImportId = 'food' | 'medicine' | 'inputs' | 'consumer';
export type PartnerId = 'china' | 'uae' | 'turkey' | 'eu' | 'oman';
export type Status = 'playing' | 'won' | 'lost' | 'drawn';

export interface L {
  en: string;
  fa: string;
}

export const l = (en: string, fa: string): L => ({ en, fa });

export function pick(value: L, lang: Lang): string {
  return value[lang];
}

export type PolicyId =
  | 'rate-hike'
  | 'spend-reserves'
  | 'priority-imports'
  | 'managed-devaluation'
  | 'unify-rates'
  | 'capital-controls'
  | 'cut-subsidies'
  | 'targeted-transfers'
  | 'tax-rise'
  | 'spending-cut'
  | 'oil-discount'
  | 'diversify-trade'
  | 'bank-liquidity'
  | 'bank-recapitalize'
  | 'invest-refining'
  | 'invest-agriculture'
  | 'negotiate-exemptions'
  | 'public-communication';

export type EffectKey =
  | 'usableReserves'
  | 'frozenAssets'
  | 'gold'
  | 'externalDebt'
  | 'debtDue'
  | 'importCover'
  | 'fxGap'
  | 'devaluation'
  | 'capitalFlight'
  | 'headlineInflation'
  | 'coreInflation'
  | 'foodInflation'
  | 'fuelInflation'
  | 'medicineInflation'
  | 'inputInflation'
  | 'expectations'
  | 'oilRevenue'
  | 'taxRevenue'
  | 'customsRevenue'
  | 'otherRevenue'
  | 'wages'
  | 'pensions'
  | 'subsidySpend'
  | 'healthSpending'
  | 'educationSpending'
  | 'infrastructureSpending'
  | 'defenceSpending'
  | 'interest'
  | 'emergencySpending'
  | 'debt'
  | 'arrears'
  | 'production'
  | 'capacity'
  | 'domesticUse'
  | 'exports'
  | 'realizedPrice'
  | 'discount'
  | 'refinery'
  | 'foodCoverage'
  | 'medicineCoverage'
  | 'inputCoverage'
  | 'consumerCoverage'
  | 'supplierRisk'
  | 'shippingCost'
  | 'bankLiquidity'
  | 'npl'
  | 'bankConfidence'
  | 'credit'
  | 'unemployment'
  | 'realWage'
  | 'foodAffordability'
  | 'medicineAffordability'
  | 'energyAffordability'
  | 'poverty'
  | 'publicConfidence'
  | 'legitimacy'
  | 'fairness'
  | 'hardship'
  | 'laborUnrest'
  | 'protests'
  | 'elite'
  | 'cohesion'
  | 'sanctionsFinancial'
  | 'sanctionsEnergy'
  | 'sanctionsShipping'
  | 'sanctionsTechnology'
  | 'investment'
  | 'infrastructureQuality'
  | 'productivity'
  | 'techAccess'
  | 'privateConfidence'
  | 'humanCapital'
  | 'fdi'
  | 'politicalCapital'
  | 'credibility';

export type Effect = Partial<Record<EffectKey, number>>;

export interface PolicyDef {
  id: PolicyId;
  institution: InstitutionId;
  name: L;
  summary: L;
  cost: number;
  cooldown?: number;
  duration?: number;
  support: Partial<Record<InstitutionId, number>>;
  benefits: L[];
  costs: L[];
  effects: Effect;
  delayed?: Array<{ months: number; effects: Effect; note: L }>;
  monthly?: Effect;
  risk: L;
}

export interface ImportLine {
  need: number;
  financed: number;
  coverage: number;
  inventory: number;
  availability: number;
}

export interface EconomicReport {
  turn: number;
  month: string;
  decisions: PolicyId[];
  headline: L;
  lines: Array<{ text: L; tone: 'good' | 'warn' | 'bad' | 'info' }>;
}

export interface Snapshot {
  turn: number;
  label: string;
  reserves: number;
  inflation: number;
  official: number;
  parallel: number;
  social: number;
  coverage: number;
  debt: number;
}

export interface Outcome {
  status: Exclude<Status, 'playing'>;
  verdict:
    | 'stabilized'
    | 'managed'
    | 'stagnation'
    | 'political-failure'
    | 'political-crisis'
    | 'financial-collapse'
    | 'humanitarian'
    | 'transformation';
  title: L;
  text: L;
  axes: Record<'survival' | 'financial' | 'welfare' | 'political' | 'productive' | 'independence', number>;
  notes: L[];
}

export interface ActivePolicy {
  id: PolicyId;
  remaining: number;
}

export interface PendingEffect {
  dueTurn: number;
  effects: Effect;
  note: L;
}

export interface EconomicState {
  version: 1;
  mode: Mode;
  scenario: ScenarioId;
  country: 'iran';
  seed: number;
  turn: number;
  maxMonths: number;
  startDate: string;
  date: string;
  status: Status;
  outcome: Outcome | null;
  phase: 'decisions' | 'ended';
  world: {
    globalOilPrice: number;
    shippingDisruption: number;
    sanctionsPressure: number;
    globalGrowth: number;
    monthIndex: number;
  };
  reserves: {
    usable: number;
    frozen: number;
    gold: number;
    externalDebt: number;
    debtDue: number;
    importCover: number;
  };
  currency: {
    official: number;
    parallel: number;
    managed: number;
    fxGap: number;
    capitalFlight: number;
  };
  prices: {
    headline: number;
    core: number;
    food: number;
    fuel: number;
    medicine: number;
    inputs: number;
    expectations: number;
    cpi: number;
  };
  fiscal: {
    oilRevenue: number;
    taxRevenue: number;
    customs: number;
    otherRevenue: number;
    wages: number;
    pensions: number;
    subsidySpend: number;
    health: number;
    education: number;
    infrastructure: number;
    defence: number;
    interest: number;
    emergency: number;
    deficit: number;
    primary: number;
    debt: number;
    arrears: number;
  };
  energy: {
    production: number;
    capacity: number;
    domesticUse: number;
    exports: number;
    realizedPrice: number;
    discount: number;
    refinery: number;
    investment: number;
  };
  trade: {
    nonOilExports: number;
    supplierRisk: number;
    shippingCost: number;
    food: ImportLine;
    medicine: ImportLine;
    inputs: ImportLine;
    consumer: ImportLine;
  };
  banking: {
    liquidity: number;
    npl: number;
    confidence: number;
    credit: number;
  };
  households: {
    unemployment: number;
    realWage: number;
    foodAffordability: number;
    medicineAffordability: number;
    energyAffordability: number;
    poverty: number;
    informal: number;
  };
  society: {
    confidence: number;
    legitimacy: number;
    fairness: number;
    hardship: number;
    laborUnrest: number;
    protests: number;
    elite: number;
    cohesion: number;
  };
  sanctions: {
    financial: number;
    energy: number;
    shipping: number;
    technology: number;
  };
  partners: Record<PartnerId, { share: number; reliability: number; terms: number }>;
  investment: {
    infrastructure: number;
    productivity: number;
    techAccess: number;
    privateConfidence: number;
    humanCapital: number;
    fdi: number;
  };
  policies: {
    queued: PolicyId[];
    active: ActivePolicy[];
    used: Partial<Record<PolicyId, number>>;
    pending: PendingEffect[];
    politicalCapital: number;
    credibility: number;
    actionSlots: number;
  };
  report: EconomicReport | null;
  history: EconomicReport[];
  snapshots: Snapshot[];
  firedEvents: string[];
}

export const INSTITUTIONS: Array<{ id: InstitutionId; name: L; short: L; role: L; glyph: string }> = [
  { id: 'central-bank', name: l('Central Bank', 'بانک مرکزی'), short: l('Central Bank', 'بانک مرکزی'), role: l('Reserves, rates, currency and banks', 'ذخایر، نرخ‌ها، ارز و بانک‌ها'), glyph: '◉' },
  { id: 'finance', name: l('Ministry of Finance', 'وزارت دارایی'), short: l('Finance', 'دارایی'), role: l('Budget, taxes, debt and subsidies', 'بودجه، مالیات، بدهی و یارانه'), glyph: '▦' },
  { id: 'energy', name: l('Ministry of Energy', 'وزارت انرژی'), short: l('Energy', 'انرژی'), role: l('Production, exports and domestic energy', 'تولید، صادرات و انرژی داخلی'), glyph: '◍' },
  { id: 'trade', name: l('Trade and Industry', 'تجارت و صنعت'), short: l('Trade', 'تجارت'), role: l('Imports, industry and supply chains', 'واردات، صنعت و زنجیره تأمین'), glyph: '⌁' },
  { id: 'security', name: l('Economic Security Council', 'شورای امنیت اقتصادی'), short: l('Economic Security', 'امنیت اقتصادی'), role: l('Sanctions, intelligence and strategic reserves', 'تحریم، اطلاعات و ذخایر راهبردی'), glyph: '◈' },
  { id: 'political', name: l('Political Leadership', 'رهبری سیاسی'), short: l('Leadership', 'رهبری'), role: l('Public trust, priorities and survival', 'اعتماد عمومی، اولویت‌ها و بقا'), glyph: '⌂' },
];

export const SCENARIOS: Record<ScenarioId, { name: L; short: L; blurb: L; months: number; startDate: string; difficulty: L }> = {
  hormuz: {
    name: l('The Hormuz Crisis', 'بحران هرمز'),
    short: l('Hormuz Crisis', 'بحران هرمز'),
    blurb: l('A shipping disruption threatens energy exports, essential imports and the budget. Keep the state solvent and the shops supplied.', 'اختلال کشتیرانی صادرات انرژی، واردات ضروری و بودجه را تهدید می‌کند. دولت را توانمند و فروشگاه‌ها را پر نگه دارید.'),
    months: 12,
    startDate: '2026-03-01',
    difficulty: l('Recommended first crisis', 'نخستین بحران پیشنهادی'),
  },
  'oil-collapse': {
    name: l('The Oil Revenue Collapse', 'فروپاشی درآمد نفت'),
    short: l('Oil Revenue Collapse', 'فروپاشی نفت'),
    blurb: l('Global prices fall and the oil-dependent budget loses its anchor. Restructure spending before reserves disappear.', 'قیمت‌های جهانی سقوط می‌کنند و بودجه متکی به نفت لنگر خود را از دست می‌دهد. پیش از پایان ذخایر، هزینه‌ها را بازساخت کنید.'),
    months: 10,
    startDate: '2026-06-01',
    difficulty: l('Hard', 'سخت'),
  },
  'currency-crisis': {
    name: l('The Currency Crisis', 'بحران ارز'),
    short: l('Currency Crisis', 'بحران ارز'),
    blurb: l('Confidence in the national currency breaks. Capital flight, parallel rates and inflation feed one another.', 'اعتماد به ارز ملی می‌شکند. فرار سرمایه، نرخ موازی و تورم یکدیگر را تقویت می‌کنند.'),
    months: 10,
    startDate: '2026-02-01',
    difficulty: l('Hard', 'سخت'),
  },
  'sanctions-squeeze': {
    name: l('The Sanctions Squeeze', 'فشار تحریم‌ها'),
    short: l('Sanctions Squeeze', 'فشار تحریم'),
    blurb: l('Financial and shipping restrictions tighten. Protect medicine, food and the industrial base without surrendering the economy.', 'محدودیت‌های مالی و کشتیرانی سخت می‌شوند. از دارو، غذا و پایه صنعتی محافظت کنید، بدون تسلیم اقتصاد.'),
    months: 10,
    startDate: '2026-05-01',
    difficulty: l('Very hard', 'بسیار سخت'),
  },
  'food-energy-shock': {
    name: l('The Food and Energy Shock', 'شوک غذا و انرژی'),
    short: l('Food and Energy Shock', 'شوک غذا و انرژی'),
    blurb: l('Drought, expensive imports and an energy squeeze put household survival at the centre of the crisis.', 'خشکسالی، واردات گران و فشار انرژی، بقای خانوار را در مرکز بحران قرار می‌دهد.'),
    months: 10,
    startDate: '2026-07-01',
    difficulty: l('Hard', 'سخت'),
  },
};

export const POLICIES: PolicyDef[] = [
  {
    id: 'rate-hike',
    institution: 'central-bank',
    name: l('Raise policy rates', 'افزایش نرخ سیاستی'),
    summary: l('Defend the currency and cool expectations, at the cost of credit and jobs.', 'از ارز دفاع کنید و انتظارات را آرام کنید، به قیمت اعتبار و اشتغال.'),
    cost: 2,
    cooldown: 2,
    duration: 3,
    support: { 'central-bank': 82, finance: 32, trade: 28, political: 25 },
    benefits: [l('Lower inflation expectations', 'کاهش انتظارات تورمی'), l('Slower currency depreciation', 'کندشدن کاهش ارزش ارز')],
    costs: [l('Tighter credit', 'اعتبار محدودتر'), l('Higher unemployment pressure', 'فشار بیشتر بر بیکاری')],
    effects: { headlineInflation: -1.8, expectations: -5, fxGap: -1.5, credit: -5, unemployment: 0.25, investment: -1 },
    monthly: { headlineInflation: -0.35, expectations: -0.6, credit: -0.8 },
    risk: l('A rate rise can choke a fragile recovery.', 'افزایش نرخ می‌تواند بازیابی شکننده را خفه کند.'),
  },
  {
    id: 'spend-reserves',
    institution: 'central-bank',
    name: l('Spend reserves to defend the currency', 'خرج ذخایر برای دفاع از ارز'),
    summary: l('Buy time in the currency market. The reserve buffer shrinks and the underlying deficit remains.', 'در بازار ارز زمان بخرید. سپر ذخایر کوچک می‌شود و کسری بنیادی باقی می‌ماند.'),
    cost: 1,
    cooldown: 1,
    support: { 'central-bank': 55, finance: 35, political: 45 },
    benefits: [l('Narrower parallel gap', 'شکاف موازی کمتر'), l('Calmer import prices this month', 'قیمت واردات آرام‌تر این ماه')],
    costs: [l('$3.8B of usable reserves', '۳٫۸ میلیارد دلار ذخایر قابل استفاده'), l('No structural fix', 'بدون درمان ساختاری')],
    effects: { usableReserves: -3.8, fxGap: -5, headlineInflation: -0.5, capitalFlight: -3 },
    delayed: [{ months: 1, effects: { fxGap: 2, headlineInflation: 0.5 }, note: l('The market tests the central bank again.', 'بازار دوباره بانک مرکزی را می‌آزماید.') }],
    risk: l('Repeated intervention can exhaust the buffer before the real crisis arrives.', 'مداخله مکرر می‌تواند سپر را پیش از بحران واقعی تمام کند.'),
  },
  {
    id: 'priority-imports',
    institution: 'trade',
    name: l('Priority import allocation', 'تخصیص اولویت‌دار واردات'),
    summary: l('Route scarce foreign exchange to food and medicine instead of consumer goods.', 'ارز کمیاب را به غذا و دارو برسانید، نه کالاهای مصرفی.'),
    cost: 1,
    cooldown: 1,
    support: { trade: 68, 'central-bank': 42, political: 55 },
    benefits: [l('Food and medicine coverage', 'پوشش غذا و دارو'), l('Lower household hardship', 'کاهش سختی خانوار')],
    costs: [l('$2.4B reserves', '۲٫۴ میلیارد دلار ذخایر'), l('Consumer goods shortages', 'کمبود کالاهای مصرفی')],
    effects: { usableReserves: -2.4, foodCoverage: 1.6, medicineCoverage: 1.8, consumerCoverage: -1, foodAffordability: 3, medicineAffordability: 3 },
    risk: l('Priority allocation can create a parallel market in import licenses.', 'تخصیص اولویت‌دار می‌تواند بازار موازی مجوز واردات بسازد.'),
  },
  {
    id: 'managed-devaluation',
    institution: 'central-bank',
    name: l('Managed devaluation', 'کاهش ارزش مدیریت‌شده'),
    summary: l('Move the official rate toward the market, restoring export receipts while raising import costs.', 'نرخ رسمی را به بازار نزدیک کنید؛ دریافتی صادرات بهتر و هزینه واردات بیشتر می‌شود.'),
    cost: 2,
    cooldown: 3,
    support: { 'central-bank': 58, finance: 48, energy: 62, political: 18 },
    benefits: [l('More realistic export conversion', 'تبدیل واقعی‌تر صادرات'), l('Lower official-market arbitrage', 'کاهش آربیتراژ رسمی-بازار')],
    costs: [l('Import and food inflation', 'تورم واردات و غذا'), l('Household purchasing power', 'قدرت خرید خانوار')],
    effects: { devaluation: 10, fxGap: -7, foodInflation: 2.5, medicineInflation: 2, inputInflation: 2, headlineInflation: 1.4, exports: 2, foodAffordability: -2 },
    risk: l('A devaluation without supply or credibility can become a spiral.', 'کاهش ارزش بدون عرضه و اعتبار می‌تواند به مارپیچ تبدیل شود.'),
  },
  {
    id: 'unify-rates',
    institution: 'central-bank',
    name: l('Unify exchange rates', 'یکسان‌سازی نرخ ارز'),
    summary: l('End multiple rates and accept a visible price shock in exchange for transparency.', 'نرخ‌های چندگانه را پایان دهید و در ازای شفافیت، شوک قیمتی آشکار را بپذیرید.'),
    cost: 3,
    cooldown: 4,
    support: { 'central-bank': 62, finance: 55, trade: 48, political: 22 },
    benefits: [l('Less rent-seeking', 'رانت‌جویی کمتر'), l('Clearer import pricing', 'قیمت‌گذاری شفاف‌تر واردات')],
    costs: [l('Short-run inflation spike', 'جهش تورمی کوتاه‌مدت'), l('Business disruption', 'اختلال کسب‌وکار')],
    effects: { fxGap: -14, headlineInflation: 3.5, foodInflation: 2, expectations: 1, credibility: 4, privateConfidence: -3, importCover: 0.4 },
    delayed: [{ months: 1, effects: { headlineInflation: 1.2, expectations: -2 }, note: l('The unified rate is being tested by importers.', 'نرخ یکسان توسط واردکنندگان آزموده می‌شود.') }],
    risk: l('Unification may expose how weak the currency really is.', 'یکسان‌سازی ممکن است ضعف واقعی ارز را آشکار کند.'),
  },
  {
    id: 'capital-controls',
    institution: 'central-bank',
    name: l('Temporary capital controls', 'کنترل موقت سرمایه'),
    summary: l('Slow the flight out of the currency. Investors will remember it.', 'فرار از ارز را کند کنید. سرمایه‌گذاران آن را به یاد خواهند آورد.'),
    cost: 2,
    cooldown: 3,
    duration: 4,
    support: { 'central-bank': 55, finance: 38, trade: 22, political: 48 },
    benefits: [l('Lower capital flight', 'فرار سرمایه کمتر'), l('More room for the currency', 'فضای بیشتر برای ارز')],
    costs: [l('Investor confidence', 'اعتماد سرمایه‌گذار'), l('Foreign direct investment', 'سرمایه‌گذاری خارجی')],
    effects: { capitalFlight: -15, fxGap: -2, privateConfidence: -5, fdi: -2, credibility: -2 },
    monthly: { capitalFlight: -2, privateConfidence: -1 },
    risk: l('Controls can become permanent and trap the economy.', 'کنترل‌ها می‌توانند دائمی شوند و اقتصاد را گرفتار کنند.'),
  },
  {
    id: 'cut-subsidies',
    institution: 'finance',
    name: l('Reduce universal fuel subsidies', 'کاهش یارانه همگانی سوخت'),
    summary: l('Free fiscal room and reduce leakage, but transport, food and household budgets absorb the shock.', 'فضای مالی آزاد و نشت کمتر می‌شود، اما حمل‌ونقل، غذا و بودجه خانوار شوک را جذب می‌کنند.'),
    cost: 3,
    cooldown: 4,
    support: { finance: 72, energy: 48, 'central-bank': 42, political: 18 },
    benefits: [l('Lower subsidy bill', 'کاهش هزینه یارانه'), l('Fiscal credibility', 'اعتبار مالی')],
    costs: [l('Higher transport and food costs', 'هزینه بیشتر حمل‌ونقل و غذا'), l('Protest risk', 'ریسک اعتراض')],
    effects: { subsidySpend: -0.65, debt: -0.3, fuelInflation: 5, foodInflation: 1.5, energyAffordability: -5, hardship: 4, protests: 7, legitimacy: -3, credibility: 2 },
    delayed: [{ months: 1, effects: { foodAffordability: -2, protests: 3 }, note: l('The subsidy cut is showing up in transport and bread prices.', 'کاهش یارانه در قیمت حمل‌ونقل و نان دیده می‌شود.') }],
    risk: l('Without compensation, the reform can become a political crisis.', 'بدون جبران، اصلاحات می‌تواند به بحران سیاسی تبدیل شود.'),
  },
  {
    id: 'targeted-transfers',
    institution: 'finance',
    name: l('Targeted household transfers', 'پرداخت هدفمند به خانوار'),
    summary: l('Protect the poorest households while allowing prices to adjust.', 'از فقیرترین خانوارها محافظت کنید و اجازه دهید قیمت‌ها تنظیم شوند.'),
    cost: 2,
    cooldown: 2,
    duration: 3,
    support: { finance: 55, political: 75, 'central-bank': 38, trade: 45 },
    benefits: [l('Food affordability', 'قدرت خرید غذا'), l('Lower protest pressure', 'کاهش فشار اعتراض')],
    costs: [l('Monthly fiscal cost', 'هزینه مالی ماهانه'), l('Inflation if supply is constrained', 'تورم در صورت محدودیت عرضه')],
    effects: { subsidySpend: 0.25, foodAffordability: 4, hardship: -4, protests: -3, legitimacy: 2 },
    monthly: { subsidySpend: 0.25, foodAffordability: 0.8, hardship: -0.7, protests: -0.4 },
    risk: l('Transfers cannot substitute for missing food or medicine.', 'پرداخت نقدی جایگزین غذای موجود یا دارو نمی‌شود.'),
  },
  {
    id: 'tax-rise',
    institution: 'finance',
    name: l('Raise taxes on high incomes', 'افزایش مالیات بر درآمدهای بالا'),
    summary: l('Improve the primary balance without touching the poorest households.', 'تراز اولیه را بهبود دهید بدون آسیب به فقیرترین خانوارها.'),
    cost: 2,
    cooldown: 3,
    support: { finance: 66, political: 35, 'central-bank': 52 },
    benefits: [l('Higher tax revenue', 'درآمد مالیاتی بیشتر'), l('Lower borrowing need', 'نیاز کمتر به استقراض')],
    costs: [l('Business confidence', 'اعتماد کسب‌وکار'), l('Elite opposition', 'مخالفت نخبگان')],
    effects: { taxRevenue: 0.38, privateConfidence: -3, elite: -2, credibility: 2 },
    risk: l('Collection capacity may lag the announcement.', 'توان وصول ممکن است از اعلام عقب بماند.'),
  },
  {
    id: 'spending-cut',
    institution: 'finance',
    name: l('Cut nonessential spending', 'کاهش هزینه‌های غیرضروری'),
    summary: l('Reduce the deficit through lower infrastructure and administrative outlays.', 'کسری را با کاهش هزینه زیرساخت و اداری کم کنید.'),
    cost: 2,
    cooldown: 3,
    support: { finance: 70, 'central-bank': 55, political: 25 },
    benefits: [l('Smaller deficit', 'کسری کمتر'), l('Lower debt growth', 'رشد کمتر بدهی')],
    costs: [l('Infrastructure and demand', 'زیرساخت و تقاضا'), l('Unemployment pressure', 'فشار بیکاری')],
    effects: { infrastructureSpending: -0.25, emergencySpending: -0.15, debt: -0.4, infrastructureQuality: -1, unemployment: 0.35, protests: 3 },
    risk: l('Cutting investment now can damage recovery later.', 'کاهش سرمایه‌گذاری امروز می‌تواند بازیابی فردا را آسیب بزند.'),
  },
  {
    id: 'oil-discount',
    institution: 'energy',
    name: l('Discount crude to secure buyers', 'تخفیف نفت برای حفظ خریداران'),
    summary: l('Move volume at a lower realized price. Revenue today, dependence tomorrow.', 'حجم را با قیمت واقعی کمتر بفروشید. درآمد امروز، وابستگی فردا.'),
    cost: 1,
    cooldown: 2,
    support: { energy: 58, finance: 62, political: 38 },
    benefits: [l('Higher export volume', 'حجم صادرات بیشتر'), l('Immediate revenue relief', 'کاهش فوری فشار درآمدی')],
    costs: [l('Lower realized price', 'قیمت واقعی کمتر'), l('Strategic dependence', 'وابستگی راهبردی')],
    effects: { discount: 4, exports: 6, oilRevenue: 0.15, credibility: -1 },
    risk: l('Buyers may treat the discount as the new baseline.', 'خریداران ممکن است تخفیف را به baseline جدید تبدیل کنند.'),
  },
  {
    id: 'diversify-trade',
    institution: 'trade',
    name: l('Diversify trade partners', 'تنوع‌بخشی شرکای تجاری'),
    summary: l('Build alternate corridors and suppliers. Costly now, resilient later.', 'کریدورها و تأمین‌کنندگان جایگزین بسازید. امروز گران، فردا مقاوم.'),
    cost: 2,
    cooldown: 3,
    duration: 3,
    support: { trade: 70, security: 62, political: 55 },
    benefits: [l('Lower supplier concentration', 'تمرکز کمتر تأمین‌کننده'), l('More strategic independence', 'استقلال راهبردی بیشتر')],
    costs: [l('Trade costs and delay', 'هزینه و تأخیر تجارت'), l('Fiscal and diplomatic attention', 'توجه مالی و دیپلماتیک')],
    effects: { supplierRisk: -7, shippingCost: 1.5, sanctionsTechnology: -2, credibility: 1, fdi: 1 },
    monthly: { supplierRisk: -1.2, shippingCost: 0.4 },
    risk: l('New partners can also become new dependencies.', 'شرکای جدید هم می‌توانند وابستگی جدید شوند.'),
  },
  {
    id: 'bank-liquidity',
    institution: 'central-bank',
    name: l('Emergency bank liquidity', 'نقدینگی اضطراری بانک‌ها'),
    summary: l('Stop a funding panic without fixing bad loans.', 'وحشت تأمین مالی را متوقف کنید، بدون حل وام‌های بد.'),
    cost: 2,
    cooldown: 2,
    support: { 'central-bank': 60, finance: 38, trade: 46 },
    benefits: [l('Bank liquidity and credit', 'نقدینگی و اعتبار بانک'), l('Depositor confidence', 'اعتماد سپرده‌گذار')],
    costs: [l('Moral hazard', 'خطر اخلاقی'), l('Inflation pressure', 'فشار تورمی')],
    effects: { bankLiquidity: 12, credit: 4, bankConfidence: 4, npl: 1, headlineInflation: 0.4 },
    risk: l('Liquidity can become a subsidy for insolvent banks.', 'نقدینگی می‌تواند یارانه بانک‌های ورشکسته شود.'),
  },
  {
    id: 'bank-recapitalize',
    institution: 'finance',
    name: l('Recapitalize weak banks', 'افزایش سرمایه بانک‌های ضعیف'),
    summary: l('Use public money to repair balance sheets and keep credit alive.', 'با پول عمومی ترازنامه‌ها را ترمیم کنید و اعتبار را زنده نگه دارید.'),
    cost: 3,
    cooldown: 4,
    support: { finance: 40, 'central-bank': 72, political: 30 },
    benefits: [l('Lower non-performing loans', 'کاهش وام‌های بد'), l('Depositor confidence', 'اعتماد سپرده‌گذار')],
    costs: [l('Public debt', 'بدهی عمومی'), l('Fiscal space', 'فضای مالی')],
    effects: { bankLiquidity: 7, npl: -5, bankConfidence: 7, debt: 1.1, credit: 2 },
    risk: l('Recapitalization without restructuring can repeat the problem.', 'افزایش سرمایه بدون بازسازی می‌تواند مشکل را تکرار کند.'),
  },
  {
    id: 'invest-refining',
    institution: 'energy',
    name: l('Invest in refining and storage', 'سرمایه‌گذاری در پالایش و ذخیره‌سازی'),
    summary: l('Spend now to improve domestic supply and export resilience later.', 'امروز خرج کنید تا عرضه داخلی و مقاومت صادرات بعداً بهتر شود.'),
    cost: 3,
    cooldown: 5,
    duration: 6,
    support: { energy: 82, finance: 42, trade: 55, political: 48 },
    benefits: [l('Refinery capacity', 'ظرفیت پالایش'), l('Energy security and future productivity', 'امنیت انرژی و بهره‌وری آینده')],
    costs: [l('Upfront fiscal cost', 'هزینه مالی اولیه'), l('Long implementation', 'اجرای طولانی')],
    effects: { refinery: 3, investment: 2, infrastructureQuality: 1, emergencySpending: 0.2 },
    monthly: { refinery: 1.1, investment: 0.6, productivity: 0.25 },
    risk: l('The payoff arrives after the immediate crisis.', 'نتیجه پس از بحران فوری می‌رسد.'),
  },
  {
    id: 'invest-agriculture',
    institution: 'trade',
    name: l('Invest in food security', 'سرمایه‌گذاری در امنیت غذایی'),
    summary: l('Support domestic production and strategic food inventories.', 'از تولید داخلی و ذخایر راهبردی غذا حمایت کنید.'),
    cost: 2,
    cooldown: 4,
    duration: 4,
    support: { trade: 68, political: 72, finance: 48 },
    benefits: [l('Food inventory and affordability', 'ذخیره و قدرت خرید غذا'), l('Long-term resilience', 'مقاومت بلندمدت')],
    costs: [l('Fiscal cost', 'هزینه مالی'), l('Slow results', 'نتایج کند')],
    effects: { foodCoverage: 1, foodAffordability: 1.5, investment: 1, emergencySpending: 0.15 },
    monthly: { foodCoverage: 0.35, foodAffordability: 0.4, productivity: 0.2 },
    risk: l('A harvest cannot be moved forward by a decree.', 'برداشت محصول با فرمان جلو نمی‌افتد.'),
  },
  {
    id: 'negotiate-exemptions',
    institution: 'security',
    name: l('Negotiate humanitarian exemptions', 'مذاکره برای معافیت‌های بشردوستانه'),
    summary: l('Seek legal carve-outs for food, medicine and civil trade.', 'برای غذا، دارو و تجارت غیرنظامی معافیت قانونی بگیرید.'),
    cost: 2,
    cooldown: 3,
    support: { security: 65, trade: 72, political: 60, 'central-bank': 52 },
    benefits: [l('Lower sanctions friction', 'اصطکاک کمتر تحریم'), l('Medicine and food access', 'دسترسی غذا و دارو')],
    costs: [l('Diplomatic concessions', 'امتیازات دیپلماتیک'), l('Slow, uncertain talks', 'مذاکرات کند و نامطمئن')],
    effects: { sanctionsFinancial: -3, sanctionsShipping: -2, sanctionsTechnology: -2, medicineCoverage: 0.8, foodCoverage: 0.6, credibility: 2 },
    risk: l('Exemptions may be narrow and slow to arrive.', 'معافیت‌ها ممکن است محدود و دیر برسند.'),
  },
  {
    id: 'public-communication',
    institution: 'political',
    name: l('Level with the public', 'صداقت با مردم'),
    summary: l('Explain the crisis and the sacrifices. Credibility buys time, not money.', 'بحران و فداکاری‌ها را توضیح دهید. اعتبار زمان می‌خرد، نه پول.'),
    cost: 1,
    cooldown: 2,
    support: { political: 82, 'central-bank': 55, finance: 48, trade: 52 },
    benefits: [l('Public confidence and legitimacy', 'اعتماد عمومی و مشروعیت'), l('Lower expectations', 'انتظارات پایین‌تر')],
    costs: [l('Political attention', 'توجه سیاسی'), l('No direct fiscal relief', 'بدون کاهش مالی مستقیم')],
    effects: { publicConfidence: 4, legitimacy: 2, credibility: 3, expectations: -2, protests: -2 },
    risk: l('A communication strategy cannot hide empty shelves.', 'ارتباطات نمی‌تواند قفسه‌های خالی را پنهان کند.'),
  },
];

export const POLICY_BY_ID = Object.fromEntries(POLICIES.map((policy) => [policy.id, policy])) as Record<PolicyId, PolicyDef>;

const SCENARIO_START: Record<ScenarioId, { maxMonths: number; world: { globalOilPrice: number; shippingDisruption: number; sanctionsPressure: number; globalGrowth: number }; reserves: number; inflation: number; parallelGap: number }> = {
  hormuz: { maxMonths: 12, world: { globalOilPrice: 91, shippingDisruption: 55, sanctionsPressure: 55, globalGrowth: 48 }, reserves: 18.4, inflation: 38.6, parallelGap: 44 },
  'oil-collapse': { maxMonths: 10, world: { globalOilPrice: 48, shippingDisruption: 34, sanctionsPressure: 50, globalGrowth: 38 }, reserves: 14.2, inflation: 31, parallelGap: 39 },
  'currency-crisis': { maxMonths: 10, world: { globalOilPrice: 88, shippingDisruption: 42, sanctionsPressure: 62, globalGrowth: 44 }, reserves: 12.8, inflation: 55, parallelGap: 76 },
  'sanctions-squeeze': { maxMonths: 10, world: { globalOilPrice: 84, shippingDisruption: 61, sanctionsPressure: 78, globalGrowth: 43 }, reserves: 16.1, inflation: 43, parallelGap: 58 },
  'food-energy-shock': { maxMonths: 10, world: { globalOilPrice: 101, shippingDisruption: 64, sanctionsPressure: 54, globalGrowth: 41 }, reserves: 16.9, inflation: 48, parallelGap: 51 },
};

export function grossReserves(state: EconomicState): number {
  return state.reserves.usable + state.reserves.frozen + state.reserves.gold;
}

export function totalRevenue(fiscal: EconomicState['fiscal']): number {
  return fiscal.oilRevenue + fiscal.taxRevenue + fiscal.customs + fiscal.otherRevenue;
}

export function totalSpending(fiscal: EconomicState['fiscal']): number {
  return fiscal.wages + fiscal.pensions + fiscal.subsidySpend + fiscal.health + fiscal.education + fiscal.infrastructure + fiscal.defence + fiscal.interest + fiscal.emergency;
}

export function coverageAverage(state: EconomicState): number {
  return (state.trade.food.coverage + state.trade.medicine.coverage + state.trade.inputs.coverage + state.trade.consumer.coverage) / 4;
}

export function reserveWeeks(state: EconomicState): number {
  const inflow = state.energy.exports * 30 * state.energy.realizedPrice / 1000 + state.trade.nonOilExports;
  const outflow = state.reserves.debtDue + (state.trade.food.need + state.trade.medicine.need + state.trade.inputs.need + state.trade.consumer.need) * 0.72;
  const monthlyDrain = Math.max(0.35, outflow - inflow * 0.72);
  return Math.max(0, state.reserves.usable / monthlyDrain);
}

export function criticalIssues(state: EconomicState): Array<{ title: L; detail: L; tone: 'bad' | 'warn' | 'good' }> {
  const issues: Array<{ title: L; detail: L; tone: 'bad' | 'warn' | 'good' }> = [];
  if (state.reserves.usable < 6) issues.push({ title: l('Usable reserves are nearly gone', 'ذخایر قابل استفاده تقریباً تمام شده'), detail: l('Only essential import financing and debt service remain fundable.', 'تنها تأمین مالی واردات ضروری و بازپرداخت بدهی قابل پرداخت است.'), tone: 'bad' });
  if (state.trade.food.coverage < 3) issues.push({ title: l('Food coverage is dangerously short', 'پوشش غذا خطرناک کوتاه است'), detail: l('Shops and bread supply depend on the next import allocation.', 'فروشگاه‌ها و نان به تخصیص واردات بعدی وابسته‌اند.'), tone: 'bad' });
  if (state.prices.headline > 55) issues.push({ title: l('Inflation is eroding household budgets', 'تورم بودجه خانوار را می‌خورد'), detail: l('Food, fuel and medicine prices are moving faster than wages.', 'قیمت غذا، سوخت و دارو سریع‌تر از دستمزد حرکت می‌کند.'), tone: 'bad' });
  if (state.currency.fxGap > 35) issues.push({ title: l('The parallel exchange rate is diverging', 'نرخ موازی ارز فاصله گرفته'), detail: l('Official allocations are becoming a scarce privilege.', 'تخصیص رسمی به امتیازی کمیاب تبدیل می‌شود.'), tone: 'bad' });
  if (state.society.protests > 60) issues.push({ title: l('Street pressure is rising', 'فشار خیابان بالا می‌رود'), detail: l('Price anger and wage arrears are feeding each other.', 'خشم قیمتی و معوقات دستمزد یکدیگر را تقویت می‌کنند.'), tone: 'warn' });
  if (state.fiscal.deficit > 2.2) issues.push({ title: l('The budget is borrowing from the next crisis', 'بودجه از بحران بعدی قرض می‌گیرد'), detail: l('The deficit is being financed by debt and arrears, not new revenue.', 'کسری با بدهی و معوقات تأمین می‌شود، نه درآمد تازه.'), tone: 'warn' });
  if (issues.length === 0) issues.push({ title: l('The immediate line is holding', 'خط مقدم فعلی پایدار است'), detail: l('Reserves, supplies and confidence are still within the governing range.', 'ذخایر، عرضه و اعتماد هنوز در محدوده قابل اداره‌اند.'), tone: 'good' });
  return issues.slice(0, 4);
}

export function canQueuePolicy(state: EconomicState, id: PolicyId): { ok: boolean; reason?: L } {
  if (state.phase !== 'decisions' || state.status !== 'playing') return { ok: false, reason: l('The government is no longer accepting decisions.', 'دولت دیگر تصمیم نمی‌پذیرد.') };
  const policy = POLICY_BY_ID[id];
  if (!policy) return { ok: false, reason: l('Unknown policy.', 'سیاست ناشناخته.') };
  if (state.policies.queued.includes(id)) return { ok: false, reason: l('Already in this month’s agenda.', 'قبلاً در دستور این ماه است.') };
  if (state.policies.active.some((active) => active.id === id)) return { ok: false, reason: l('This policy is already active.', 'این سیاست قبلاً فعال است.') };
  if (state.policies.queued.length >= state.policies.actionSlots) return { ok: false, reason: l('Only two major policies fit in a month.', 'در یک ماه فقط دو سیاست اصلی جا می‌شود.') };
  if (policyCost(state) + policy.cost > state.policies.politicalCapital) return { ok: false, reason: l('Not enough political capital.', 'سرمایه سیاسی کافی نیست.') };
  const used = state.policies.used[id];
  if (used !== undefined && policy.cooldown) {
    const ready = used + policy.cooldown;
    if (state.turn < ready) return { ok: false, reason: l(`Available again in month ${ready}.`, `دوباره از ماه ${ready} در دسترس است.`) };
  }
  return { ok: true };
}

export function queuePolicy(state: EconomicState, id: PolicyId): { ok: boolean; reason?: L } {
  const result = canQueuePolicy(state, id);
  if (!result.ok) return result;
  state.policies.queued.push(id);
  return { ok: true };
}

export function unqueuePolicy(state: EconomicState, id: PolicyId): void {
  state.policies.queued = state.policies.queued.filter((queued) => queued !== id);
}

export function policyCost(state: EconomicState): number {
  return state.policies.queued.reduce((sum, id) => sum + POLICY_BY_ID[id].cost, 0);
}

export function institutionalSupport(policy: PolicyDef): number {
  const values = Object.values(policy.support).filter((value): value is number => typeof value === 'number');
  return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
}

export function supportTone(value: number): 'bad' | 'warn' | 'good' {
  return value >= 65 ? 'good' : value >= 40 ? 'warn' : 'bad';
}

function importLine(need: number, financed: number, coverage: number, inventory: number, availability: number): ImportLine {
  return { need, financed, coverage, inventory, availability };
}

export function createInitialState(mode: Mode = 'campaign', scenario: ScenarioId = 'hormuz', seed = 20260301, sandbox?: Partial<{ reserves: number; oilDependency: number; sanctions: number; stability: number; oilPrice: number; shipping: number; eventFrequency: number }>): EconomicState {
  const config = SCENARIO_START[scenario] ?? SCENARIO_START.hormuz;
  const maxMonths = mode === 'campaign' ? config.maxMonths : 0;
  const startDate = mode === 'campaign' ? SCENARIOS[scenario].startDate : '2026-03-01';
  const reserves = sandbox?.reserves ?? config.reserves;
  const oilPrice = sandbox?.oilPrice ?? config.world.globalOilPrice;
  const shipping = sandbox?.shipping ?? config.world.shippingDisruption;
  const sanctions = sandbox?.sanctions ?? config.world.sanctionsPressure;
  const stability = sandbox?.stability ?? 52;
  const state: EconomicState = {
    version: 1,
    mode,
    scenario,
    country: 'iran',
    seed,
    turn: 1,
    maxMonths,
    startDate,
    date: startDate,
    status: 'playing',
    outcome: null,
    phase: 'decisions',
    world: {
      globalOilPrice: oilPrice,
      shippingDisruption: shipping,
      sanctionsPressure: sanctions,
      globalGrowth: config.world.globalGrowth,
      monthIndex: 0,
    },
    reserves: {
      usable: reserves,
      frozen: 12.1,
      gold: 2.2,
      externalDebt: 38,
      debtDue: 2.2,
      importCover: Math.max(2, (reserves / 3.1) * 1.4),
    },
    currency: {
      official: 420000,
      parallel: 420000 * (1 + config.parallelGap / 100),
      managed: 512000,
      fxGap: config.parallelGap,
      capitalFlight: scenario === 'currency-crisis' ? 76 : 56,
    },
    prices: {
      headline: config.inflation,
      core: Math.max(12, config.inflation - 10),
      food: config.inflation + 7,
      fuel: scenario === 'food-energy-shock' ? 42 : 22,
      medicine: config.inflation + 3,
      inputs: config.inflation - 1,
      expectations: config.inflation + 5,
      cpi: 100,
    },
    fiscal: {
      oilRevenue: 2.6,
      taxRevenue: 1.5,
      customs: 0.4,
      otherRevenue: 0.3,
      wages: 1.3,
      pensions: 0.7,
      subsidySpend: 1.5,
      health: 0.5,
      education: 0.4,
      infrastructure: 0.4,
      defence: 0.8,
      interest: 0.5,
      emergency: 0.2,
      deficit: 1.6,
      primary: 1.1,
      debt: scenario === 'currency-crisis' ? 66 : 58,
      arrears: scenario === 'currency-crisis' ? 0.8 : 0.4,
    },
    energy: {
      production: 3.1,
      capacity: 3.6,
      domesticUse: 1.5,
      exports: 1.6,
      realizedPrice: Math.max(30, oilPrice - 12 - shipping * 0.08),
      discount: 12,
      refinery: 55,
      investment: 44,
    },
    trade: {
      nonOilExports: 0.8,
      supplierRisk: 55,
      shippingCost: 72 + shipping * 0.2,
      food: importLine(2.2, 1.7, 6, 4, 62),
      medicine: importLine(0.9, 0.7, 5, 4, 58),
      inputs: importLine(1.4, 0.9, 4, 3, 55),
      consumer: importLine(1.8, 1.1, 5, 4, 60),
    },
    banking: { liquidity: 48, npl: 18, confidence: 52, credit: 44 },
    households: { unemployment: 14.2, realWage: 41, foodAffordability: 45, medicineAffordability: 42, energyAffordability: 50, poverty: 35, informal: 40 },
    society: { confidence: 48, legitimacy: stability, fairness: 44, hardship: 58, laborUnrest: 37, protests: scenario === 'food-energy-shock' ? 51 : 39, elite: 52, cohesion: 55 },
    sanctions: {
      financial: scenario === 'sanctions-squeeze' ? 82 : scenario === 'currency-crisis' ? 68 : 55,
      energy: scenario === 'sanctions-squeeze' ? 72 : 48,
      shipping: scenario === 'sanctions-squeeze' ? 78 : 62,
      technology: scenario === 'sanctions-squeeze' ? 76 : 55,
    },
    partners: {
      china: { share: 45, reliability: 70, terms: 57 },
      uae: { share: 20, reliability: 55, terms: 48 },
      turkey: { share: 15, reliability: 62, terms: 52 },
      eu: { share: 10, reliability: 35, terms: 40 },
      oman: { share: 10, reliability: 65, terms: 60 },
    },
    investment: { infrastructure: 50, productivity: 48, techAccess: 40, privateConfidence: 45, humanCapital: 55, fdi: 22 },
    policies: {
      queued: [],
      active: [],
      used: {},
      pending: [],
      politicalCapital: 5,
      credibility: scenario === 'currency-crisis' ? 38 : 60,
      actionSlots: 2,
    },
    report: null,
    history: [],
    snapshots: [],
    firedEvents: [],
  };
  if (scenario === 'oil-collapse') {
    state.fiscal.oilRevenue = 1.15;
    state.energy.realizedPrice = 36;
    state.fiscal.deficit = 2.6;
    state.prices.headline = 31;
  } else if (scenario === 'currency-crisis') {
    state.currency.parallel = state.currency.official * 1.76;
    state.currency.fxGap = 76;
    state.prices.headline = 55;
    state.prices.expectations = 63;
    state.fiscal.arrears = 0.8;
  } else if (scenario === 'sanctions-squeeze') {
    state.trade.food.coverage = 4;
    state.trade.medicine.coverage = 3;
    state.trade.inputs.coverage = 3;
    state.trade.consumer.coverage = 4;
    state.world.shippingDisruption = 71;
    state.fiscal.oilRevenue = 2.15;
  } else if (scenario === 'food-energy-shock') {
    state.trade.food.coverage = 3;
    state.prices.food = 64;
    state.prices.fuel = 44;
    state.households.foodAffordability = 34;
    state.households.energyAffordability = 37;
    state.society.hardship = 68;
  }
  if (mode === 'sandbox' && sandbox) {
    state.reserves.usable = sandbox.reserves ?? state.reserves.usable;
    state.society.legitimacy = sandbox.stability ?? state.society.legitimacy;
    state.world.globalOilPrice = sandbox.oilPrice ?? state.world.globalOilPrice;
    state.world.shippingDisruption = sandbox.shipping ?? state.world.shippingDisruption;
    state.sanctions.financial = sandbox.sanctions ?? state.sanctions.financial;
    state.sanctions.energy = Math.max(20, state.sanctions.financial - 8);
    state.sanctions.shipping = Math.max(20, state.world.shippingDisruption);
  }
  state.reserves.importCover = Math.max(2, (state.reserves.usable / 3.1) * 1.4);
  state.snapshots.push(snapshot(state));
  return state;
}

export function snapshot(state: EconomicState): Snapshot {
  return {
    turn: state.turn,
    label: formatMonth(state.date, 'en'),
    reserves: Number(state.reserves.usable.toFixed(2)),
    inflation: Number(state.prices.headline.toFixed(1)),
    official: Math.round(state.currency.official),
    parallel: Math.round(state.currency.parallel),
    social: Math.round(state.society.legitimacy),
    coverage: Number(coverageAverage(state).toFixed(1)),
    debt: Number(state.fiscal.debt.toFixed(1)),
  };
}

export function formatMonth(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

export function addMonths(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function applyEffect(state: EconomicState, effect: Effect): void {
  const set = (key: EffectKey, apply: (value: number) => void): void => {
    const value = effect[key];
    if (value !== undefined && Number.isFinite(value)) apply(value);
  };
  set('usableReserves', (value) => { state.reserves.usable = clamp(state.reserves.usable + value, 0, 100); });
  set('frozenAssets', (value) => { state.reserves.frozen = clamp(state.reserves.frozen + value, 0, 100); });
  set('gold', (value) => { state.reserves.gold = clamp(state.reserves.gold + value, 0, 100); });
  set('externalDebt', (value) => { state.reserves.externalDebt = clamp(state.reserves.externalDebt + value, 0, 200); });
  set('debtDue', (value) => { state.reserves.debtDue = clamp(state.reserves.debtDue + value, 0, 30); });
  set('importCover', (value) => {
    state.reserves.importCover = clamp(state.reserves.importCover + value, 0, 52);
    for (const key of ['food', 'medicine', 'inputs', 'consumer'] as ImportId[]) state.trade[key].coverage = clamp(state.trade[key].coverage + value, 0, 52);
  });
  set('fxGap', (value) => { state.currency.fxGap = clamp(state.currency.fxGap + value, 0, 180); });
  set('devaluation', (value) => { state.currency.official = clamp(state.currency.official * (1 + value / 100), 1000, 10000000); });
  set('capitalFlight', (value) => { state.currency.capitalFlight = clamp(state.currency.capitalFlight + value, 0, 100); });
  set('headlineInflation', (value) => { state.prices.headline = clamp(state.prices.headline + value, -10, 250); });
  set('coreInflation', (value) => { state.prices.core = clamp(state.prices.core + value, -10, 250); });
  set('foodInflation', (value) => { state.prices.food = clamp(state.prices.food + value, -10, 250); });
  set('fuelInflation', (value) => { state.prices.fuel = clamp(state.prices.fuel + value, -10, 250); });
  set('medicineInflation', (value) => { state.prices.medicine = clamp(state.prices.medicine + value, -10, 250); });
  set('inputInflation', (value) => { state.prices.inputs = clamp(state.prices.inputs + value, -10, 250); });
  set('expectations', (value) => { state.prices.expectations = clamp(state.prices.expectations + value, -10, 250); });
  set('oilRevenue', (value) => { state.fiscal.oilRevenue = clamp(state.fiscal.oilRevenue + value, 0, 20); });
  set('taxRevenue', (value) => { state.fiscal.taxRevenue = clamp(state.fiscal.taxRevenue + value, 0, 20); });
  set('customsRevenue', (value) => { state.fiscal.customs = clamp(state.fiscal.customs + value, 0, 10); });
  set('otherRevenue', (value) => { state.fiscal.otherRevenue = clamp(state.fiscal.otherRevenue + value, 0, 10); });
  set('wages', (value) => { state.fiscal.wages = clamp(state.fiscal.wages + value, 0, 10); });
  set('pensions', (value) => { state.fiscal.pensions = clamp(state.fiscal.pensions + value, 0, 10); });
  set('subsidySpend', (value) => { state.fiscal.subsidySpend = clamp(state.fiscal.subsidySpend + value, 0, 10); });
  set('healthSpending', (value) => { state.fiscal.health = clamp(state.fiscal.health + value, 0, 10); });
  set('educationSpending', (value) => { state.fiscal.education = clamp(state.fiscal.education + value, 0, 10); });
  set('infrastructureSpending', (value) => { state.fiscal.infrastructure = clamp(state.fiscal.infrastructure + value, 0, 10); });
  set('defenceSpending', (value) => { state.fiscal.defence = clamp(state.fiscal.defence + value, 0, 10); });
  set('interest', (value) => { state.fiscal.interest = clamp(state.fiscal.interest + value, 0, 10); });
  set('emergencySpending', (value) => { state.fiscal.emergency = clamp(state.fiscal.emergency + value, 0, 10); });
  set('debt', (value) => { state.fiscal.debt = clamp(state.fiscal.debt + value, 0, 250); });
  set('arrears', (value) => { state.fiscal.arrears = clamp(state.fiscal.arrears + value, 0, 30); });
  set('production', (value) => { state.energy.production = clamp(state.energy.production + value, 0.2, 8); });
  set('capacity', (value) => { state.energy.capacity = clamp(state.energy.capacity + value, 0.5, 8); });
  set('domesticUse', (value) => { state.energy.domesticUse = clamp(state.energy.domesticUse + value, 0.2, 8); });
  set('exports', (value) => { state.energy.exports = clamp(state.energy.exports + value, 0, 8); });
  set('realizedPrice', (value) => { state.energy.realizedPrice = clamp(state.energy.realizedPrice + value, 10, 250); });
  set('discount', (value) => { state.energy.discount = clamp(state.energy.discount + value, 0, 100); });
  set('refinery', (value) => { state.energy.refinery = clamp(state.energy.refinery + value, 0, 100); });
  set('foodCoverage', (value) => { state.trade.food.coverage = clamp(state.trade.food.coverage + value, 0, 52); });
  set('medicineCoverage', (value) => { state.trade.medicine.coverage = clamp(state.trade.medicine.coverage + value, 0, 52); });
  set('inputCoverage', (value) => { state.trade.inputs.coverage = clamp(state.trade.inputs.coverage + value, 0, 52); });
  set('consumerCoverage', (value) => { state.trade.consumer.coverage = clamp(state.trade.consumer.coverage + value, 0, 52); });
  set('supplierRisk', (value) => { state.trade.supplierRisk = clamp(state.trade.supplierRisk + value, 0, 100); });
  set('shippingCost', (value) => { state.trade.shippingCost = clamp(state.trade.shippingCost + value, 0, 250); });
  set('bankLiquidity', (value) => { state.banking.liquidity = clamp(state.banking.liquidity + value, 0, 100); });
  set('npl', (value) => { state.banking.npl = clamp(state.banking.npl + value, 0, 100); });
  set('bankConfidence', (value) => { state.banking.confidence = clamp(state.banking.confidence + value, 0, 100); });
  set('credit', (value) => { state.banking.credit = clamp(state.banking.credit + value, 0, 100); });
  set('unemployment', (value) => { state.households.unemployment = clamp(state.households.unemployment + value, 0, 60); });
  set('realWage', (value) => { state.households.realWage = clamp(state.households.realWage + value, 0, 100); });
  set('foodAffordability', (value) => { state.households.foodAffordability = clamp(state.households.foodAffordability + value, 0, 100); });
  set('medicineAffordability', (value) => { state.households.medicineAffordability = clamp(state.households.medicineAffordability + value, 0, 100); });
  set('energyAffordability', (value) => { state.households.energyAffordability = clamp(state.households.energyAffordability + value, 0, 100); });
  set('poverty', (value) => { state.households.poverty = clamp(state.households.poverty + value, 0, 100); });
  set('publicConfidence', (value) => { state.society.confidence = clamp(state.society.confidence + value, 0, 100); });
  set('legitimacy', (value) => { state.society.legitimacy = clamp(state.society.legitimacy + value, 0, 100); });
  set('fairness', (value) => { state.society.fairness = clamp(state.society.fairness + value, 0, 100); });
  set('hardship', (value) => { state.society.hardship = clamp(state.society.hardship + value, 0, 100); });
  set('laborUnrest', (value) => { state.society.laborUnrest = clamp(state.society.laborUnrest + value, 0, 100); });
  set('protests', (value) => { state.society.protests = clamp(state.society.protests + value, 0, 100); });
  set('elite', (value) => { state.society.elite = clamp(state.society.elite + value, 0, 100); });
  set('cohesion', (value) => { state.society.cohesion = clamp(state.society.cohesion + value, 0, 100); });
  set('sanctionsFinancial', (value) => { state.sanctions.financial = clamp(state.sanctions.financial + value, 0, 100); });
  set('sanctionsEnergy', (value) => { state.sanctions.energy = clamp(state.sanctions.energy + value, 0, 100); });
  set('sanctionsShipping', (value) => { state.sanctions.shipping = clamp(state.sanctions.shipping + value, 0, 100); });
  set('sanctionsTechnology', (value) => { state.sanctions.technology = clamp(state.sanctions.technology + value, 0, 100); });
  set('investment', (value) => { state.investment.privateConfidence = clamp(state.investment.privateConfidence + value, 0, 100); });
  set('infrastructureQuality', (value) => { state.investment.infrastructure = clamp(state.investment.infrastructure + value, 0, 100); });
  set('productivity', (value) => { state.investment.productivity = clamp(state.investment.productivity + value, 0, 100); });
  set('techAccess', (value) => { state.investment.techAccess = clamp(state.investment.techAccess + value, 0, 100); });
  set('privateConfidence', (value) => { state.investment.privateConfidence = clamp(state.investment.privateConfidence + value, 0, 100); });
  set('humanCapital', (value) => { state.investment.humanCapital = clamp(state.investment.humanCapital + value, 0, 100); });
  set('fdi', (value) => { state.investment.fdi = clamp(state.investment.fdi + value, 0, 100); });
  set('politicalCapital', (value) => { state.policies.politicalCapital = clamp(state.policies.politicalCapital + value, 0, 10); });
  set('credibility', (value) => { state.policies.credibility = clamp(state.policies.credibility + value, 0, 100); });
}

function syncCurrency(state: EconomicState): void {
  state.currency.fxGap = clamp(state.currency.fxGap, 0, 180);
  state.currency.parallel = state.currency.official * (1 + state.currency.fxGap / 100);
  state.currency.managed = state.currency.official * (1 + state.currency.fxGap / 180);
}

function syncFiscal(state: EconomicState): void {
  const f = state.fiscal;
  const revenue = totalRevenue(f);
  const spending = totalSpending(f);
  f.deficit = Number((spending - revenue).toFixed(2));
  f.primary = Number((f.deficit - f.interest).toFixed(2));
}

function makeReportHeadline(decisions: PolicyId[]): L {
  if (decisions.length === 0) return l('A month of holding the line', 'ماهی از حفظ وضع موجود');
  return l(`The government chose: ${POLICY_BY_ID[decisions[0]!].name.en}.`, `دولت انتخاب کرد: ${POLICY_BY_ID[decisions[0]!].name.fa}.`);
}

export function resolveMonth(state: EconomicState): EconomicReport {
  if (state.phase === 'ended') return state.report ?? { turn: state.turn, month: state.date, decisions: [], headline: l('The crisis is over.', 'بحران تمام شده است.'), lines: [] };
  const report: EconomicReport = { turn: state.turn, month: state.date, decisions: [...state.policies.queued], headline: makeReportHeadline(state.policies.queued), lines: [] };
  const before = {
    reserves: state.reserves.usable,
    inflation: state.prices.headline,
    currency: state.currency.parallel,
    coverage: coverageAverage(state),
    legitimacy: state.society.legitimacy,
    debt: state.fiscal.debt,
  };
  const decisions = [...state.policies.queued];
  state.policies.politicalCapital = clamp(state.policies.politicalCapital - policyCost(state), 0, 10);
  for (const id of decisions) {
    const policy = POLICY_BY_ID[id];
    applyEffect(state, policy.effects);
    state.policies.used[id] = state.turn;
    if (policy.duration) state.policies.active.push({ id, remaining: policy.duration });
    for (const delayed of policy.delayed ?? []) state.policies.pending.push({ dueTurn: state.turn + delayed.months, effects: delayed.effects, note: delayed.note });
    const averageSupport = institutionalSupport(policy);
    if (averageSupport < 35) state.policies.credibility = clamp(state.policies.credibility - 2, 0, 100);
    if (averageSupport > 65) state.policies.credibility = clamp(state.policies.credibility + 1, 0, 100);
    report.lines.push({ text: l(`${policy.name.en} entered implementation.`, `${policy.name.fa} وارد مرحله اجرا شد.`), tone: 'info' });
  }
  for (const active of state.policies.active) {
    const policy = POLICY_BY_ID[active.id];
    if (active.remaining > 0 && policy.monthly) applyEffect(state, policy.monthly);
  }
  state.policies.active = state.policies.active.map((active) => ({ ...active, remaining: active.remaining - 1 })).filter((active) => active.remaining > 0);
  const due = state.policies.pending.filter((item) => item.dueTurn <= state.turn);
  state.policies.pending = state.policies.pending.filter((item) => item.dueTurn > state.turn);
  for (const item of due) {
    applyEffect(state, item.effects);
    report.lines.push({ text: item.note, tone: 'warn' });
  }

  // External environment.
  state.world.monthIndex += 1;
  const priceAnchor = state.scenario === 'oil-collapse' ? 48 : state.scenario === 'food-energy-shock' ? 101 : 91;
  state.world.globalOilPrice = clamp(state.world.globalOilPrice + (priceAnchor - state.world.globalOilPrice) * 0.18 + (state.scenario === 'oil-collapse' ? -1.5 : 0.15), 35, 180);
  const shippingAnchor = state.scenario === 'food-energy-shock' ? 64 : state.scenario === 'sanctions-squeeze' ? 71 : 55;
  state.world.shippingDisruption = clamp(state.world.shippingDisruption + (shippingAnchor - state.world.shippingDisruption) * 0.12 + (state.scenario === 'hormuz' && state.turn > 6 ? 0.8 : 0), 10, 95);
  state.world.sanctionsPressure = clamp(state.world.sanctionsPressure + (state.scenario === 'sanctions-squeeze' ? 1.1 : 0.2), 20, 95);
  state.sanctions.shipping = clamp(state.sanctions.shipping + (state.world.shippingDisruption - 55) * 0.04, 0, 100);
  state.sanctions.financial = clamp(state.sanctions.financial + (state.scenario === 'sanctions-squeeze' ? 0.7 : 0.1), 0, 100);

  // Energy production and export receipts.
  const inputAvailability = Math.min(state.trade.inputs.availability, state.trade.inputs.coverage * 10 + 25);
  state.energy.production = clamp(Math.min(state.energy.capacity, state.energy.capacity * (0.62 + inputAvailability / 250) + state.investment.productivity / 250), 0.2, state.energy.capacity);
  state.energy.domesticUse = clamp(state.energy.domesticUse + (state.households.energyAffordability < 40 ? 0.03 : -0.01), 0.7, state.energy.production);
  const exportable = Math.max(0, state.energy.production - state.energy.domesticUse);
  const routeFactor = 1 - state.world.shippingDisruption / 260 - state.sanctions.shipping / 520;
  state.energy.exports = clamp(exportable * clamp(routeFactor, 0.15, 1), 0, exportable);
  state.energy.realizedPrice = clamp(state.world.globalOilPrice - state.energy.discount - state.trade.shippingCost * 0.08, 15, 180);
  const exportRevenue = (state.energy.exports * 30 * state.energy.realizedPrice) / 1000;
  state.fiscal.oilRevenue = clamp(exportRevenue * 0.68, 0, 15);
  state.fiscal.taxRevenue = clamp(state.fiscal.taxRevenue + (state.investment.productivity - 50) * 0.004 - (state.households.informal - 40) * 0.002, 0.5, 8);
  state.fiscal.customs = clamp(state.fiscal.customs + (state.trade.consumer.availability - 50) * 0.003, 0.1, 4);

  // Import financing. Priority policies and coverage determine how much gets through.
  const essentialNeed = state.trade.food.need + state.trade.medicine.need + state.trade.inputs.need;
  const totalNeed = essentialNeed + state.trade.consumer.need;
  const financingCapacity = Math.min(state.reserves.usable * 0.14, totalNeed * 0.48);
  const financingRatio = clamp(financingCapacity / Math.max(0.1, totalNeed), 0.15, 1);
  for (const key of ['food', 'medicine', 'inputs', 'consumer'] as ImportId[]) {
    const line = state.trade[key];
    const priority = key === 'food' || key === 'medicine' ? 1.12 : key === 'inputs' ? 1.03 : 0.86;
    line.financed = Number((line.need * financingRatio * priority).toFixed(2));
    const lineRatio = clamp(line.financed / Math.max(0.2, line.need), 0, 1.2);
    line.coverage = clamp(
      line.coverage + (lineRatio - 0.5) * 3.4 - (state.world.shippingDisruption > 62 ? 0.2 : 0) + (state.trade.supplierRisk < 45 ? 0.2 : 0),
      0,
      20,
    );
    line.inventory = clamp(line.inventory + (lineRatio - 0.55) * 1.6, 0, 12);
    line.availability = clamp(30 + line.coverage * 9 + line.inventory * 2 - state.world.shippingDisruption * 0.18, 5, 98);
  }
  state.reserves.usable = clamp(state.reserves.usable - financingCapacity + exportRevenue * 0.95 + state.trade.nonOilExports * 0.55, 0, 100);
  state.reserves.importCover = clamp(state.reserves.usable / Math.max(1, totalNeed - exportRevenue * 0.2), 0, 30);

  // Debt service, capital flight and reserve accounting.
  const debtPressure = state.reserves.debtDue + Math.max(0, state.fiscal.debt - 75) * 0.02;
  const debtPaid = Math.min(state.reserves.usable * 0.3, debtPressure);
  state.reserves.usable = clamp(state.reserves.usable - debtPaid, 0, 100);
  const unpaidDebt = Math.max(0, debtPressure - debtPaid);
  if (unpaidDebt > 0.05) state.fiscal.arrears = clamp(state.fiscal.arrears + unpaidDebt * 0.45, 0, 30);
  const flight = (state.currency.capitalFlight / 100) * 0.6 * (1 + state.currency.fxGap / 100) * (state.policies.active.some((p) => p.id === 'capital-controls') ? 0.45 : 1);
  state.reserves.usable = clamp(state.reserves.usable - flight, 0, 100);
  state.reserves.importCover = newWeeks(state.reserves.usable, totalNeed, exportRevenue);

  // Currency pass-through.
  const inflationGap = state.prices.headline - state.prices.core;
  const pressure = (state.reserves.importCover < 3 ? 4 : 0.8) + state.currency.capitalFlight * 0.025 + state.sanctions.financial * 0.018 + state.fiscal.deficit * 1.8 + inflationGap * 0.06 - (state.policies.active.some((p) => p.id === 'rate-hike') ? 2.5 : 0) - (state.policies.active.some((p) => p.id === 'spend-reserves') ? 1 : 0);
  state.currency.fxGap = clamp(state.currency.fxGap + pressure - 0.5, 0, 180);
  state.currency.official = clamp(state.currency.official * (1 + Math.max(0, pressure) * 0.0025), 1000, 10000000);
  syncCurrency(state);

  // Inflation by source.
  const depreciation = Math.max(0, state.currency.fxGap - 20) * 0.012;
  const supplyShock = (100 - state.trade.food.availability) * 0.035 + (100 - state.trade.medicine.availability) * 0.02 + (100 - state.trade.inputs.availability) * 0.025;
  state.prices.food = clamp(state.prices.food + depreciation * 1.3 + supplyShock * 0.55 - (state.policies.active.some((p) => p.id === 'targeted-transfers') ? 0.35 : 0) - (state.policies.active.some((p) => p.id === 'invest-agriculture') ? 0.25 : 0), -5, 250);
  state.prices.fuel = clamp(state.prices.fuel + (state.world.globalOilPrice - 80) * 0.02 + (state.policies.active.some((p) => p.id === 'cut-subsidies') ? 1.1 : 0), -5, 250);
  state.prices.medicine = clamp(state.prices.medicine + depreciation * 1.1 + (100 - state.trade.medicine.availability) * 0.03, -5, 250);
  state.prices.inputs = clamp(state.prices.inputs + depreciation + (100 - state.trade.inputs.availability) * 0.04, -5, 250);
  state.prices.core = clamp(state.prices.core + (state.prices.headline - state.prices.core) * 0.08 - (state.policies.active.some((p) => p.id === 'rate-hike') ? 0.45 : 0) + state.fiscal.deficit * 0.08, -5, 250);
  state.prices.expectations = clamp(state.prices.expectations * 0.88 + state.prices.headline * 0.12 + (state.fiscal.deficit > 2 ? 0.5 : 0) - (state.policies.credibility > 60 ? 0.3 : 0), 0, 250);
  state.prices.headline = clamp(state.prices.food * 0.36 + state.prices.fuel * 0.18 + state.prices.medicine * 0.16 + state.prices.inputs * 0.12 + state.prices.core * 0.18, -5, 250);
  state.prices.cpi = Number((state.prices.cpi * (1 + state.prices.headline / 1200)).toFixed(2));

  // Budget, debt and arrears.
  syncFiscal(state);
  const financing = Math.max(0, state.fiscal.deficit);
  state.fiscal.debt = clamp(state.fiscal.debt + financing * 0.72 - (state.fiscal.deficit < 0 ? Math.abs(state.fiscal.deficit) * 0.4 : 0), 0, 250);
  if (state.fiscal.deficit > 2.5) state.fiscal.arrears = clamp(state.fiscal.arrears + (state.fiscal.deficit - 2.5) * 0.18, 0, 30);
  state.reserves.debtDue = clamp(0.7 + state.fiscal.debt * 0.01, 0.5, 8);
  state.reserves.usable = clamp(state.reserves.usable - Math.max(0, state.reserves.debtDue - debtPaid) * 0.2, 0, 100);

  // Banking, jobs and household welfare.
  state.banking.npl = clamp(state.banking.npl + (state.households.unemployment - 12) * 0.12 + state.fiscal.arrears * 0.5 + Math.max(0, state.prices.headline - 35) * 0.035 - (state.policies.active.some((p) => p.id === 'bank-recapitalize') ? 1.1 : 0), 0, 80);
  state.banking.liquidity = clamp(state.banking.liquidity - Math.max(0, state.banking.npl - 18) * 0.08 + (state.policies.active.some((p) => p.id === 'bank-liquidity') ? 2.2 : 0) + (state.reserves.usable > 15 ? 0.3 : -1.2), 0, 100);
  state.banking.confidence = clamp(state.banking.confidence + (state.policies.credibility - 50) * 0.04 - Math.max(0, state.banking.npl - 20) * 0.12 + (state.policies.active.some((p) => p.id === 'bank-recapitalize') ? 1 : 0), 0, 100);
  state.banking.credit = clamp(state.banking.credit + state.banking.liquidity * 0.02 - state.banking.npl * 0.025 - (state.policies.active.some((p) => p.id === 'rate-hike') ? 1.4 : 0), 0, 100);
  const productionGap = inputAvailability < 50 ? (50 - inputAvailability) * 0.12 : 0;
  state.households.unemployment = clamp(state.households.unemployment + productionGap - (state.investment.productivity > 55 ? 0.12 : 0) - (state.policies.active.some((p) => p.id === 'bank-liquidity') ? 0.1 : 0), 2, 55);
  state.households.realWage = clamp(state.households.realWage - state.prices.headline * 0.065 + (state.households.unemployment < 15 ? 0.25 : 0), 0, 100);
  state.households.foodAffordability = clamp(state.households.foodAffordability - state.prices.food * 0.035 + (state.trade.food.availability > 55 ? 0.4 : -0.5) + (state.policies.active.some((p) => p.id === 'targeted-transfers') ? 0.8 : 0), 0, 100);
  state.households.medicineAffordability = clamp(state.households.medicineAffordability - state.prices.medicine * 0.025 + (state.trade.medicine.availability > 55 ? 0.35 : -0.5), 0, 100);
  state.households.energyAffordability = clamp(state.households.energyAffordability - state.prices.fuel * 0.035 + (state.policies.active.some((p) => p.id === 'cut-subsidies') ? -0.8 : 0), 0, 100);
  state.households.poverty = clamp(state.households.poverty + (55 - state.households.foodAffordability) * 0.03 + (state.households.unemployment - 12) * 0.05, 0, 100);
  state.households.informal = clamp(state.households.informal + (state.households.unemployment - 12) * 0.03 - (state.banking.credit > 50 ? 0.1 : 0), 0, 100);

  // Political feedback.
  state.society.confidence = clamp(state.society.confidence + (58 - state.prices.headline) * 0.02 + (state.households.foodAffordability - 45) * 0.035 - (state.households.unemployment - 12) * 0.03 - Math.max(0, state.fiscal.arrears - 1) * 0.8, 0, 100);
  state.society.hardship = clamp(state.society.hardship + (50 - state.households.foodAffordability) * 0.05 + (50 - state.households.energyAffordability) * 0.025 + (state.households.unemployment - 12) * 0.05, 0, 100);
  state.society.protests = clamp(state.society.protests + (state.society.hardship - 45) * 0.045 + (state.prices.food - 45) * 0.025 - (state.policies.active.some((p) => p.id === 'targeted-transfers') ? 0.6 : 0), 0, 100);
  state.society.laborUnrest = clamp(state.society.laborUnrest + (state.households.realWage < 40 ? 0.5 : -0.2) + Math.max(0, state.fiscal.arrears - 1) * 0.8, 0, 100);
  state.society.legitimacy = clamp(state.society.legitimacy + (state.society.confidence - 50) * 0.025 - (state.society.protests - 40) * 0.02 - Math.max(0, state.fiscal.arrears - 1) * 0.4, 0, 100);
  state.society.fairness = clamp(state.society.fairness + (state.households.poverty - 35) * -0.015 - (state.policies.active.some((p) => p.id === 'cut-subsidies') ? 0.6 : 0), 0, 100);
  state.society.elite = clamp(state.society.elite - Math.max(0, state.fiscal.arrears - 1) * 0.35 - Math.max(0, state.fiscal.taxRevenue - 1.8) * 0.2 + (state.investment.privateConfidence > 50 ? 0.2 : -0.1), 0, 100);
  state.society.cohesion = clamp(state.society.cohesion - (state.society.protests > 55 ? 0.35 : 0.02) + (state.society.legitimacy > 55 ? 0.1 : 0), 0, 100);

  // Long-term capacity.
  state.investment.privateConfidence = clamp(state.investment.privateConfidence + (state.society.confidence - 50) * 0.02 - Math.max(0, state.prices.headline - 40) * 0.02 + (state.policies.active.some((p) => p.id === 'invest-refining') ? 0.25 : 0), 0, 100);
  state.investment.productivity = clamp(state.investment.productivity + (state.investment.privateConfidence - 45) * 0.012 + (state.policies.active.some((p) => p.id === 'invest-refining') ? 0.18 : 0) - (state.energy.production < state.energy.capacity * 0.7 ? 0.12 : 0), 0, 100);
  state.investment.infrastructure = clamp(state.investment.infrastructure - 0.03 + (state.policies.active.some((p) => p.id === 'invest-refining') ? 0.12 : 0), 0, 100);
  state.investment.techAccess = clamp(state.investment.techAccess - state.sanctions.technology * 0.003 + (state.policies.active.some((p) => p.id === 'diversify-trade') ? 0.1 : 0), 0, 100);
  state.investment.humanCapital = clamp(state.investment.humanCapital - (state.households.poverty > 40 ? 0.05 : 0) + (state.policies.active.some((p) => p.id === 'targeted-transfers') ? 0.05 : 0), 0, 100);
  state.investment.fdi = clamp(state.investment.fdi + (state.investment.privateConfidence - 45) * 0.015 - state.sanctions.financial * 0.006, 0, 100);

  // Data-defined events.
  for (const event of triggeredEconomicEvents(state)) {
    applyEffect(state, event.effects);
    state.firedEvents.push(event.id);
    report.lines.push({ text: event.text, tone: event.tone });
  }

  // Reconciliation and thresholds.
  syncFiscal(state);
  syncCurrency(state);
  state.policies.politicalCapital = clamp(state.policies.politicalCapital + 2 + (state.society.legitimacy > 55 ? 1 : 0), 0, 10);
  state.policies.credibility = clamp(state.policies.credibility + (state.society.confidence > 55 ? 0.4 : -0.2), 0, 100);
  if (state.reserves.usable < before.reserves) report.lines.push({ text: l(`Usable reserves fell from $${before.reserves.toFixed(1)}B to $${state.reserves.usable.toFixed(1)}B.`, `ذخایر قابل استفاده از ${before.reserves.toFixed(1)} به ${state.reserves.usable.toFixed(1)} میلیارد دلار رسید.`), tone: state.reserves.usable < before.reserves / 2 ? 'bad' : 'warn' });
  if (state.prices.headline > before.inflation + 3) report.lines.push({ text: l('Inflation accelerated beyond the monthly baseline. Household purchasing power is falling.', 'تورم از خط پایه ماهانه فراتر رفت. قدرت خرید خانوار کاهش می‌یابد.'), tone: 'bad' });
  if (state.trade.food.coverage < 3) report.lines.push({ text: l('Food coverage is below three weeks. The next allocation is now a political decision.', 'پوشش غذا کمتر از سه هفته است. تخصیص بعدی اکنون یک تصمیم سیاسی است.'), tone: 'bad' });
  if (state.society.protests > 65) report.lines.push({ text: l('Protests are spreading beyond the usual districts.', 'اعتراض‌ها از محله‌های معمول فراتر می‌روند.'), tone: 'bad' });

  const finalTurn = state.mode === 'campaign' && state.turn >= state.maxMonths;
  const outcome = evaluateOutcome(state, finalTurn);
  state.report = report;
  state.history.push(report);
  state.snapshots.push(snapshot(state));
  if (outcome) {
    state.status = outcome.status;
    state.phase = 'ended';
    state.outcome = outcome;
  } else {
    state.turn += 1;
    state.date = addMonths(state.startDate, state.turn - 1);
    state.policies.queued = [];
  }
  return report;
}

function newWeeks(usable: number, totalNeed: number, exportRevenue: number): number {
  return clamp(usable / Math.max(1, totalNeed - exportRevenue * 0.2), 0, 30);
}

export function forecast(state: EconomicState): { weeks: number; low: number; high: number; inflationRange: [number, number]; risk: L } {
  const weeks = reserveWeeks(state);
  const low = Math.max(0, Math.round(weeks * 0.7));
  const high = Math.round(weeks * 1.3);
  const inflationRange: [number, number] = [Math.max(0, Math.round(state.prices.headline - 5)), Math.round(state.prices.headline + 9)];
  const risk = weeks < 4 || state.trade.food.coverage < 3 ? l('Critical', 'بحرانی') : weeks < 8 || state.prices.headline > 55 ? l('Elevated', 'بالا') : l('Guarded', 'تحت کنترل');
  return { weeks: Math.round(weeks), low, high, inflationRange, risk };
}

function axisScores(state: EconomicState): Outcome['axes'] {
  const survival = clamp((state.reserves.usable * 4 + state.trade.food.coverage * 6 + state.trade.medicine.coverage * 4 + state.energy.exports * 10) / 3, 0, 100);
  const financial = clamp((state.reserves.usable * 3 + (100 - state.currency.fxGap) * 0.45 + (100 - state.fiscal.debt) * 0.35 + (100 - state.banking.npl) * 0.2) / 2, 0, 100);
  const welfare = clamp((state.households.foodAffordability + state.households.medicineAffordability + state.households.energyAffordability + (100 - state.households.unemployment * 2) + state.households.realWage) / 5, 0, 100);
  const political = clamp((state.society.confidence + state.society.legitimacy + state.society.fairness + state.society.elite + (100 - state.society.protests)) / 5, 0, 100);
  const productive = clamp((state.investment.infrastructure + state.investment.productivity + state.investment.techAccess + state.banking.credit + state.investment.privateConfidence) / 5, 0, 100);
  const independence = clamp((100 - state.sanctions.financial) * 0.45 + (100 - state.trade.supplierRisk) * 0.35 + state.investment.techAccess * 0.2, 0, 100);
  return { survival: Math.round(survival), financial: Math.round(financial), welfare: Math.round(welfare), political: Math.round(political), productive: Math.round(productive), independence: Math.round(independence) };
}

export function evaluateOutcome(state: EconomicState, finalTurn: boolean): Outcome | null {
  const axes = axisScores(state);
  if (state.trade.food.coverage <= 0.5 || state.trade.medicine.coverage <= 0.5 || state.households.foodAffordability < 12) {
    return {
      status: 'lost',
      verdict: 'humanitarian',
      title: l('Humanitarian emergency', 'وضعیت اضطراری بشردوستانه'),
      text: l('Essential food or medicine is no longer reaching enough of the population. The government still exists, but its first duty has failed.', 'غذا یا داروی ضروری دیگر به بخش کافی از مردم نمی‌رسد. دولت هنوز وجود دارد، اما نخستین وظیفه‌اش شکست خورده است.'),
      axes,
      notes: [l('Food and medicine coverage collapsed before the financial system did.', 'پوشش غذا و دارو پیش از نظام مالی فروپاشید.'), l('Import financing and shipping constraints were the proximate causes.', 'محدودیت تأمین مالی واردات و کشتیرانی علل نزدیک بودند.')],
    };
  }
  if (state.reserves.usable <= 0.2 && state.fiscal.arrears > 3) {
    return {
      status: 'lost',
      verdict: 'financial-collapse',
      title: l('Financial collapse', 'فروپاشی مالی'),
      text: l('Usable reserves are exhausted and arrears are spreading through the state. The government can no longer choose which obligations to meet.', 'ذخایر قابل استفاده تمام شده و معوقات در دولت گسترش می‌یابد. دولت دیگر نمی‌تواند انتخاب کند کدام تعهد را انجام دهد.'),
      axes,
      notes: [l('Reserve depletion and unpaid obligations reinforced each other.', 'کاهش ذخایر و تعهدات پرداخت‌نشده یکدیگر را تقویت کردند.'), l('The currency and import pipeline were not stabilized in time.', 'ارز و مسیر واردات به‌موقع تثبیت نشد.')],
    };
  }
  if (state.society.legitimacy < 18 || state.society.protests > 88) {
    return {
      status: 'lost',
      verdict: 'political-crisis',
      title: l('Political crisis', 'بحران سیاسی'),
      text: l('Economic hardship has broken the government’s political mandate. The crisis is now being settled outside the cabinet.', 'سختی اقتصادی مشروعیت سیاسی دولت را شکسته است. بحران اکنون بیرون از کابینه حل می‌شود.'),
      axes,
      notes: [l('Food and fuel prices, wage arrears and perceived unfairness eroded legitimacy.', 'قیمت غذا و سوخت، معوقات دستمزد و احساس بی‌عدالتی مشروعیت را فرسود.'), l('The government preserved fiscal room but not public consent.', 'دولت فضای مالی را حفظ کرد اما رضایت عمومی را نه.')],
    };
  }
  if (!finalTurn) return null;
  const strongest = Math.max(axes.survival, axes.financial, axes.welfare, axes.political, axes.productive, axes.independence);
  if (axes.survival >= 58 && axes.financial >= 55 && axes.welfare >= 48 && axes.political >= 48 && axes.productive >= 52 && state.investment.infrastructure >= 45 && state.investment.privateConfidence >= 45) {
    return {
      status: 'won',
      verdict: axes.productive >= 68 ? 'transformation' : 'stabilized',
      title: axes.productive >= 68 ? l('Recovery and transformation', 'بازیابی و تحول') : l('Successful stabilization', 'تثبیت موفق'),
      text: l('The economy remains functioning, essential supplies are moving, and the state has preserved room to invest in recovery. The crisis is not forgotten, but it no longer dictates the future.', 'اقتصاد همچنان کار می‌کند، عرضه ضروری جریان دارد و دولت فضای سرمایه‌گذاری در بازیابی را حفظ کرده است. بحران فراموش نشده، اما دیگر آینده را تعیین نمی‌کند.'),
      axes,
      notes: [l('Reserve management and import prioritization protected the supply chain.', 'مدیریت ذخایر و اولویت‌بندی واردات زنجیره تأمین را حفظ کرد.'), l('Investment and institutional credibility kept recovery possible.', 'سرمایه‌گذاری و اعتبار نهادی بازیابی را ممکن نگه داشت.')],
    };
  }
  if (axes.political >= 45 && axes.financial < 40 && axes.welfare < 42) {
    return {
      status: 'drawn',
      verdict: 'political-failure',
      title: l('Political survival, economic failure', 'بقای سیاسی، شکست اقتصادی'),
      text: l('The government is still standing, but households and productive capacity have paid a heavy price. Survival has become a holding pattern.', 'دولت هنوز سرپاست، اما خانوارها و ظرفیت تولیدی بهای سنگینی داده‌اند. بقا به حفظ وضع موجود تبدیل شده است.'),
      axes,
      notes: [l('Political control was preserved at the expense of welfare and investment.', 'کنترل سیاسی به قیمت رفاه و سرمایه‌گذاری حفظ شد.'), l('The next government will inherit a weaker economy.', 'دولت بعدی اقتصادی ضعیف‌تر را به ارث می‌برد.')],
    };
  }
  if (axes.productive < 42 || (state.fiscal.debt > 110 && axes.financial < 50)) {
    return {
      status: 'drawn',
      verdict: 'stagnation',
      title: l('Economic stagnation', 'رکود اقتصادی'),
      text: l('The immediate crisis is contained, but investment, productivity and public capacity have been consumed to get here.', 'بحران فوری مهار شده، اما سرمایه‌گذاری، بهره‌وری و ظرفیت عمومی برای رسیدن به این نقطه مصرف شده‌اند.'),
      axes,
      notes: [l('Short-term survival crowded out long-term capacity.', 'بقای کوتاه‌مدت ظرفیت بلندمدت را کنار زد.'), l('The country remains operational but less able to absorb the next shock.', 'کشور فعال می‌ماند اما کمتر می‌تواند شوک بعدی را جذب کند.')],
    };
  }
  if (strongest >= 45) {
    return {
      status: 'won',
      verdict: 'managed',
      title: l('Managed survival', 'بقای مدیریت‌شده'),
      text: l('The state avoided collapse and kept the core economy running, but the settlement is fragile and the costs are unevenly shared.', 'دولت از فروپاشی دوری کرد و اقتصاد اصلی را فعال نگه داشت، اما وضعیت شکننده است و هزینه‌ها نابرابر تقسیم شده‌اند.'),
      axes,
      notes: [l('The crisis was contained, not resolved.', 'بحران مهار شد، نه حل.'), l('Reserve cover and import flows remain the main constraints.', 'پوشش ذخایر و جریان واردات محدودیت‌های اصلی باقی می‌مانند.')],
    };
  }
  return {
    status: 'lost',
    verdict: 'stagnation',
    title: l('Economic failure', 'شکست اقتصادی'),
    text: l('The government remains in office, but the economy has lost the capacity to protect households or recover on its own.', 'دولت در قدرت می‌ماند، اما اقتصاد توان محافظت از خانوارها یا بازیابی مستقل را از دست داده است.'),
    axes,
    notes: [l('The crisis outlasted the policy response.', 'بحران از پاسخ سیاستی دوام بیشتری آورد.'), l('Reserves, welfare and productive capacity all ended below a sustainable line.', 'ذخایر، رفاه و ظرفیت تولیدی همه زیر خط پایدار پایان یافتند.')],
  };
}

export function objectives(state: EconomicState): Outcome['axes'] {
  return axisScores(state);
}

export function saveKey(): string {
  return 'chokepoint:economic:v1';
}

export function encodeState(state: EconomicState): string {
  return JSON.stringify({ version: 1, savedAt: Date.now(), state });
}

export function decodeState(raw: string): EconomicState | null {
  try {
    const parsed = JSON.parse(raw) as { version?: number; state?: EconomicState };
    if (parsed.version !== 1 || !parsed.state) return null;
    const state = parsed.state;
    if (!state || state.version !== 1 || !state.reserves || !state.prices || !state.fiscal) return null;
    if (!state.policies) return null;
    if (!state.snapshots) state.snapshots = [];
    if (!state.history) state.history = [];
    if (!state.firedEvents) state.firedEvents = [];
    return state;
  } catch {
    return null;
  }
}

export function saveState(state: EconomicState): boolean {
  try {
    localStorage.setItem(saveKey(), encodeState(state));
    return true;
  } catch {
    return false;
  }
}

export function loadState(): EconomicState | null {
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
    /* optional */
  }
}

export function fmt(value: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', { maximumFractionDigits: digits }).format(value);
}

export function money(value: number, lang: Lang): string {
  return `$${fmt(value, lang, 1)}B`;
}
