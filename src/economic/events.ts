import type { EconomicState, Effect, L } from './model';

/**
 * Economic Survival events are data, not branches in the monthly resolver.
 * Each definition declares a causal trigger and the effects it applies when it
 * fires. The resolver evaluates every definition once per month and records
 * the id in `state.firedEvents`, so a beat never repeats.
 *
 * All figures are illustrative. They are tuned to create pressure, not to
 * model a real economy.
 */
export interface EconomicEventDef {
  id: string;
  text: L;
  tone: 'good' | 'warn' | 'bad' | 'info';
  effects: Effect;
  trigger: (state: EconomicState) => boolean;
}

export const ECONOMIC_EVENTS: EconomicEventDef[] = [
  {
    id: 'buyer-cuts-purchases',
    text: {
      en: 'A major oil buyer cuts its nomination for next month. The volume exists; the payment and the tanker do not.',
      fa: 'یک خریدار بزرگ نفت سفارش ماه آینده را کاهش داد. حجم هست؛ پرداخت و نفتکش نیست.',
    },
    tone: 'bad',
    effects: { exports: -0.28, oilRevenue: -0.22, supplierRisk: 3 },
    trigger: (state) => state.sanctions.financial > 58 && state.energy.exports > 0.8 && state.turn >= 2,
  },
  {
    id: 'insurance-unavailable',
    text: {
      en: 'War-risk cover for the main export terminal is withdrawn. Cargoes can still move, but only at rates that consume the margin.',
      fa: 'پوشش ریسک جنگ برای پایانه صادراتی اصلی لغو شد. محموله‌ها هنوز جابه‌جا می‌شوند، اما با نرخی که حاشیه سود را می‌خورد.',
    },
    tone: 'bad',
    effects: { shippingCost: 9, realizedPrice: -3, discount: 2, inputCoverage: -0.4 },
    trigger: (state) => state.world.shippingDisruption > 62 || state.sanctions.shipping > 70,
  },
  {
    id: 'currency-confidence-break',
    text: {
      en: 'Currency confidence breaks in the bazaar. Moneychangers stop quoting the official rate, and importers begin pricing next month’s goods today.',
      fa: 'اعتماد به ارز در بازار شکست. صرافی‌ها نرخ رسمی را اعلام نمی‌کنند و واردکنندگان امروز قیمت کالای ماه بعد را می‌گذارند.',
    },
    tone: 'bad',
    effects: { fxGap: 8, expectations: 5, capitalFlight: 6, foodInflation: 2, medicineInflation: 1.5 },
    trigger: (state) => state.currency.fxGap > 48 && state.currency.capitalFlight > 55,
  },
  {
    id: 'harvest-shock',
    text: {
      en: 'A dry season cuts the wheat harvest. Domestic supply falls short just as import financing is already stretched.',
      fa: 'فصل خشک، برداشت گندم را کاهش داد. عرضه داخلی درست وقتی کم می‌آید که تأمین مالی واردات از پیش تحت فشار است.',
    },
    tone: 'bad',
    effects: { foodCoverage: -1.1, foodInflation: 3, foodAffordability: -3 },
    trigger: (state) => state.turn >= 3 && (state.scenario === 'food-energy-shock' || state.trade.food.coverage < 5),
  },
  {
    id: 'bank-liquidity-squeeze',
    text: {
      en: 'A mid-sized bank cannot roll its interbank line. Depositors queue quietly, and the central bank is asked for an answer before opening hours.',
      fa: 'یک بانک متوسط نمی‌تواند خط بین‌بانکی خود را تمدید کند. سپرده‌گذاران آرام صف می‌بندند و از بانک مرکزی پیش از ساعت کاری پاسخ خواسته می‌شود.',
    },
    tone: 'bad',
    effects: { bankLiquidity: -8, bankConfidence: -6, credit: -4, npl: 2 },
    trigger: (state) => state.banking.npl > 24 && state.banking.liquidity < 44,
  },
  {
    id: 'wage-arrears-spread',
    text: {
      en: 'Public-sector wages are paid late in three provinces. Teachers and nurses are the first to notice, and the first to speak.',
      fa: 'دستمزد بخش عمومی در سه استان با تأخیر پرداخت شد. معلمان و پرستاران نخستین کسانی‌اند که متوجه می‌شوند و نخستین کسانی که سخن می‌گویند.',
    },
    tone: 'bad',
    effects: { laborUnrest: 4, protests: 3, publicConfidence: -3, legitimacy: -2 },
    trigger: (state) => state.fiscal.arrears > 1.1 || state.fiscal.deficit > 2.6,
  },
  {
    id: 'subsidy-reform-backlash',
    text: {
      en: 'The subsidy reform reaches the provinces. Bread queues form, and the cabinet discovers that the compensation system is slower than the price change.',
      fa: 'اصلاح یارانه به استان‌ها رسید. صف نان شکل گرفت و کابینه دید که سامانه جبران از تغییر قیمت کندتر است.',
    },
    tone: 'bad',
    effects: { protests: 6, hardship: 4, fairness: -3, foodAffordability: -2 },
    trigger: (state) => state.policies.used['cut-subsidies'] !== undefined && state.society.fairness < 50,
  },
  {
    id: 'trade-agreement-offer',
    text: {
      en: 'A neighboring government offers a bilateral settlement channel for food and medicine. The terms are workable; the political price is visible.',
      fa: 'دولت همسایه کانال تسویه دوجانبه برای غذا و دارو پیشنهاد داد. شرایط عملی است؛ بهای سیاسی آن دیده می‌شود.',
    },
    tone: 'good',
    effects: { sanctionsFinancial: -2, foodCoverage: 0.8, medicineCoverage: 0.9, supplierRisk: -2 },
    trigger: (state) => state.turn >= 2 && state.trade.medicine.coverage < 4.5 && state.policies.used['negotiate-exemptions'] === undefined,
  },
  {
    id: 'export-windfall',
    text: {
      en: 'Global prices spike on a supply scare. For once the discount works in the country’s favor: buyers accept cargoes at a better net price.',
      fa: 'قیمت‌های جهانی با یک شوک عرضه جهش کرد. برای یک بار تخفیف به سود کشور شد: خریداران محموله‌ها را با قیمت خالص بهتر می‌پذیرند.',
    },
    tone: 'good',
    effects: { realizedPrice: 6, oilRevenue: 0.3, usableReserves: 0.6, sanctionsFinancial: -1 },
    trigger: (state) => state.world.globalOilPrice > 104 && state.energy.exports > 0.6,
  },
  {
    id: 'smuggling-corridor',
    text: {
      en: 'An informal corridor opens through a border province. Fuel and medicine move again, but at a price that never appears in the budget.',
      fa: 'کریدوری غیررسمی از یک استان مرزی باز شد. سوخت و دارو دوباره جابه‌جا می‌شوند، اما با قیمتی که هرگز در بودجه دیده نمی‌شود.',
    },
    tone: 'warn',
    effects: { consumerCoverage: 0.9, foodCoverage: 0.5, fairness: -2, customsRevenue: -0.08, sanctionsFinancial: 1.5 },
    trigger: (state) => state.trade.consumer.coverage < 3 && state.sanctions.financial > 60,
  },
  {
    id: 'refinery-outage',
    text: {
      en: 'A refinery unit trips offline. Domestic fuel supply tightens and the energy ministry asks whether to cut exports or ration households.',
      fa: 'یک واحد پالایشگاه از مدار خارج شد. عرضه سوخت داخلی فشرده شد و وزارت انرژی می‌پرسد صادرات کاهش یابد یا خانوار سهمیه‌بندی شود.',
    },
    tone: 'bad',
    effects: { refinery: -6, domesticUse: 0.12, fuelInflation: 4, energyAffordability: -3 },
    trigger: (state) => state.energy.refinery < 45 && state.turn >= 3,
  },
  {
    id: 'creditor-grace-period',
    text: {
      en: 'A creditor grants a short grace period on an external instalment. The payment is deferred, not forgiven, and the market knows the difference.',
      fa: 'یک طلبکار دوره تنفس کوتاهی برای یک قسط خارجی داد. پرداخت به تعویق افتاد، نه بخشیده شد، و بازار تفاوت را می‌داند.',
    },
    tone: 'warn',
    effects: { debtDue: -0.6, usableReserves: 0.5, credibility: -1, privateConfidence: -1 },
    trigger: (state) => state.reserves.usable < 7 && state.reserves.debtDue > 2,
  },
  {
    id: 'diplomatic-breakthrough',
    text: {
      en: 'Technical talks produce a narrow humanitarian understanding. Inspectors get access; food and medicine get a legal route.',
      fa: 'مذاکرات فنی به یک تفاهم بشردوستانه محدود رسید. بازرسان دسترسی گرفتند؛ غذا و دارو مسیر قانونی یافتند.',
    },
    tone: 'good',
    effects: { sanctionsFinancial: -4, sanctionsShipping: -3, medicineCoverage: 0.7, credibility: 3, privateConfidence: 2 },
    trigger: (state) => state.policies.used['negotiate-exemptions'] !== undefined && state.policies.credibility > 55,
  },
  {
    id: 'brain-drain',
    text: {
      en: 'Engineers and doctors begin leaving for neighboring countries. The immediate budget improves; the productive base quietly weakens.',
      fa: 'مهندسان و پزشکان به کشورهای همسایه مهاجرت می‌کنند. بودجه فوری بهتر می‌شود؛ پایه تولیدی بی‌صدا ضعیف می‌شود.',
    },
    tone: 'warn',
    effects: { humanCapital: -3, productivity: -2, techAccess: -1, wages: -0.05 },
    trigger: (state) => state.households.realWage < 32 && state.prices.headline > 55,
  },
  {
    id: 'global-recession',
    text: {
      en: 'A global downturn cuts demand for non-oil exports. The economy that was supposed to diversify is reminded how narrow it still is.',
      fa: 'رکود جهانی تقاضای صادرات غیرنفتی را کاهش داد. اقتصادی که قرار بود متنوع شود یادآوری می‌شود چقدر هنوز باریک است.',
    },
    tone: 'bad',
    effects: { oilRevenue: -0.18, taxRevenue: -0.12, customsRevenue: -0.05, unemployment: 0.4 },
    trigger: (state) => state.world.globalGrowth < 42 && state.turn >= 4,
  },
];

export function triggeredEconomicEvents(state: EconomicState): EconomicEventDef[] {
  const fired: EconomicEventDef[] = [];
  for (const event of ECONOMIC_EVENTS) {
    if (state.firedEvents.includes(event.id)) continue;
    let triggered = false;
    try {
      triggered = event.trigger(state);
    } catch {
      triggered = false;
    }
    if (triggered) fired.push(event);
  }
  // At most one event per month keeps the report readable and the pressure legible.
  return fired.slice(0, 1);
}
