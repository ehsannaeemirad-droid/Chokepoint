import type { Lang } from '../i18n';
import {
  INSTITUTIONS,
  POLICIES,
  POLICY_BY_ID,
  SCENARIOS,
  canQueuePolicy,
  clearSave,
  coverageAverage,
  createInitialState,
  criticalIssues,
  fmt,
  forecast,
  grossReserves,
  institutionalSupport,
  l,
  loadState,
  money,
  objectives,
  pick,
  queuePolicy,
  reserveWeeks,
  resolveMonth,
  saveState,
  totalRevenue,
  totalSpending,
  unqueuePolicy,
  type EconomicState,
  type InstitutionId,
  type L,
  type Outcome,
  type PolicyDef,
  type ScenarioId,
} from './model';

type Tab = 'overview' | 'economy' | 'trade' | 'society' | 'government';
type StartMode = 'campaign' | 'sandbox';
type Modal = 'report' | 'outcome' | null;
type Tone = 'good' | 'warn' | 'bad' | 'info';

const TABS: Array<{ id: Tab; label: L; glyph: string }> = [
  { id: 'overview', label: l('Overview', 'نمای کلی'), glyph: '◉' },
  { id: 'economy', label: l('Economy', 'اقتصاد'), glyph: '▦' },
  { id: 'trade', label: l('Trade', 'تجارت'), glyph: '⌁' },
  { id: 'society', label: l('Society', 'جامعه'), glyph: '⌂' },
  { id: 'government', label: l('Government', 'دولت'), glyph: '◈' },
];

const TEXT = {
  mode: l('Economic Survival', 'بقای اقتصادی'),
  subtitle: l('National Economic Crisis Simulator', 'شبیه‌ساز بحران اقتصادی ملی'),
  back: l('Theatre game', 'بازی میدانی'),
  language: l('فا', 'EN'),
  illustrative: l(
    'Illustrative data · a strategy game, not a forecast',
    'داده‌های نمونه · یک بازی راهبردی، نه پیش‌بینی',
  ),
  startTitle: l('How long can the economy hold?', 'اقتصاد تا کجا دوام می‌آورد؟'),
  startBlurb: l(
    'You are the country’s economic leadership: central bank, finance ministry, energy, trade, security and the political cabinet. Protect reserves, keep shelves supplied, hold the currency and keep the government legitimate — while external pressure keeps rising.',
    'شما رهبری اقتصادی کشور هستید: بانک مرکزی، وزارت دارایی، انرژی، تجارت، امنیت و کابینه سیاسی. از ذخایر محافظت کنید، قفسه‌ها را پر نگه دارید، ارز را حفظ کنید و مشروعیت دولت را نگه دارید — در حالی که فشار خارجی بالا می‌رود.',
  ),
  campaign: l('Campaign', 'کارزار'),
  sandbox: l('Sandbox', 'جعبه‌شن'),
  choose: l('Choose a crisis', 'یک بحران انتخاب کنید'),
  months: l('months', 'ماه'),
  beginCampaign: l('Begin the campaign', 'آغاز کارزار'),
  beginSandbox: l('Begin the sandbox', 'آغاز جعبه‌شن'),
  continueSaved: l('Continue saved situation', 'ادامه وضعیت ذخیره‌شده'),
  noSave: l('No saved situation', 'وضعیت ذخیره‌شده‌ای نیست'),
  sandboxHint: l('Set the opening conditions. The clock is open-ended.', 'شرایط آغازین را تعیین کنید. زمان محدود نیست.'),
  reserves: l('Usable reserves', 'ذخایر قابل استفاده'),
  oilPrice: l('Global oil price', 'قیمت جهانی نفت'),
  sanctions: l('Sanctions intensity', 'شدت تحریم'),
  stability: l('Political stability', 'ثبات سیاسی'),
  shipping: l('Shipping disruption', 'اختلال کشتیرانی'),
  separate: l(
    'A separate mode. The original Chokepoint campaigns, saves and map are untouched.',
    'یک حالت جداگانه. کارزارها، ذخیره‌ها و نقشه اصلی چوک‌پوینت دست‌نخورده‌اند.',
  ),
  briefing: l('National economic situation', 'وضعیت اقتصادی ملی'),
  month: l('Month', 'ماه'),
  of: l('of', 'از'),
  openEnded: l('open-ended', 'بی‌پایان'),
  inflation: l('Annual inflation', 'تورم سالانه'),
  parallel: l('Parallel rate', 'نرخ موازی'),
  coverage: l('Import cover', 'پوشش واردات'),
  balance: l('Budget balance', 'تراز بودجه'),
  legitimacy: l('Social stability', 'ثبات اجتماعی'),
  weeks: l('weeks', 'هفته'),
  urgent: l('Most urgent issues', 'فوری‌ترین مسائل'),
  forecast: l('Assessment', 'ارزیابی'),
  reserveHorizon: l('Reserve horizon', 'افق ذخایر'),
  inflationRange: l('Inflation range', 'بازه تورم'),
  decisions: l('This month’s decisions', 'تصمیم‌های این ماه'),
  noDecisions: l('No decisions queued. Routine government continues.', 'تصمیمی ثبت نشده است. دولت روزمره ادامه می‌دهد.'),
  political: l('political capital', 'سرمایه سیاسی'),
  resolve: l('Resolve the month', 'حل ماه'),
  save: l('Save', 'ذخیره'),
  newSession: l('New session', 'نشست تازه'),
  saved: l('Situation saved.', 'وضعیت ذخیره شد.'),
  saveFailed: l('Could not save this session.', 'ذخیره این نشست ممکن نشد.'),
  queue: l('Add to agenda', 'افزودن به دستور'),
  remove: l('Remove', 'حذف'),
  queued: l('On the agenda', 'در دستور'),
  unavailable: l('Unavailable', 'ناموجود'),
  support: l('Institutional support', 'حمایت نهادی'),
  benefits: l('Potential benefits', 'منافع احتمالی'),
  costs: l('Potential costs', 'هزینه‌های احتمالی'),
  risk: l('Risk', 'ریسک'),
  cost: l('Political cost', 'هزینه سیاسی'),
  active: l('In force', 'در اجرا'),
  monthEnd: l('Month report', 'گزارش ماه'),
  continue: l('Continue', 'ادامه'),
  close: l('Close', 'بستن'),
  outcome: l('Outcome', 'نتیجه'),
  whatChanged: l('What changed and why', 'چه چیزی و چرا تغییر کرد'),
  reservesTitle: l('Foreign reserves and liquidity', 'ذخایر خارجی و نقدینگی'),
  gross: l('Gross reserves', 'ذخایر ناخالص'),
  frozen: l('Frozen assets', 'دارایی‌های بلوکه'),
  gold: l('Gold and other assets', 'طلا و سایر دارایی‌ها'),
  externalDebt: l('External debt', 'بدهی خارجی'),
  debtDue: l('Due this month', 'سررسید این ماه'),
  currencyTitle: l('Currency and exchange rates', 'ارز و نرخ‌های تبدیل'),
  official: l('Official rate', 'نرخ رسمی'),
  managed: l('Managed rate', 'نرخ مدیریت‌شده'),
  gap: l('Official–parallel gap', 'شکاف رسمی–موازی'),
  flight: l('Capital flight pressure', 'فشار فرار سرمایه'),
  pricesTitle: l('Inflation by source', 'تورم بر پایه منبع'),
  headline: l('Headline', 'کلی'),
  core: l('Core', 'هسته‌ای'),
  food: l('Food', 'غذا'),
  fuel: l('Fuel and power', 'سوخت و انرژی'),
  medicine: l('Medicine', 'دارو'),
  inputs: l('Industrial inputs', 'نهاده صنعتی'),
  expectations: l('Expectations', 'انتظارات'),
  budgetTitle: l('Government budget', 'بودجه دولت'),
  revenue: l('Revenue', 'درآمد'),
  spending: l('Expenditure', 'هزینه'),
  deficit: l('Deficit', 'کسری'),
  primary: l('Primary balance', 'تراز اولیه'),
  debt: l('Public debt', 'بدهی عمومی'),
  arrears: l('Arrears', 'معوقات'),
  oilRevenue: l('Oil and gas', 'نفت و گاز'),
  taxes: l('Taxes', 'مالیات'),
  customs: l('Customs', 'گمرک'),
  other: l('Other income', 'سایر درآمدها'),
  wages: l('Public wages', 'دستمزد عمومی'),
  pensions: l('Pensions', 'بازنشستگی'),
  subsidies: l('Subsidies', 'یارانه'),
  health: l('Health', 'بهداشت'),
  education: l('Education', 'آموزش'),
  infrastructure: l('Infrastructure', 'زیرساخت'),
  defence: l('Defence and security', 'دفاع و امنیت'),
  interest: l('Debt interest', 'سود بدهی'),
  emergency: l('Emergency spending', 'هزینه اضطراری'),
  bankingTitle: l('Banks and credit', 'بانک‌ها و اعتبار'),
  liquidity: l('Bank liquidity', 'نقدینگی بانک'),
  npl: l('Non-performing loans', 'وام‌های بد'),
  bankConfidence: l('Depositor confidence', 'اعتماد سپرده‌گذار'),
  credit: l('Credit availability', 'دسترسی به اعتبار'),
  investmentTitle: l('Investment and recovery', 'سرمایه‌گذاری و بازیابی'),
  infraQuality: l('Infrastructure', 'زیرساخت'),
  productivity: l('Productivity', 'بهره‌وری'),
  tech: l('Technology access', 'دسترسی فناوری'),
  privateConfidence: l('Private confidence', 'اعتماد بخش خصوصی'),
  humanCapital: l('Human capital', 'سرمایه انسانی'),
  fdi: l('Foreign investment', 'سرمایه‌گذاری خارجی'),
  energyTitle: l('Oil, gas and exports', 'نفت، گاز و صادرات'),
  production: l('Production', 'تولید'),
  capacity: l('Capacity', 'ظرفیت'),
  domesticUse: l('Domestic use', 'مصرف داخلی'),
  exports: l('Export volume', 'حجم صادرات'),
  realizedPrice: l('Realized price', 'قیمت واقعی'),
  discount: l('Discount', 'تخفیف'),
  refinery: l('Refinery capacity', 'ظرفیت پالایش'),
  importsTitle: l('Essential imports', 'واردات ضروری'),
  consumer: l('Consumer goods', 'کالاهای مصرفی'),
  need: l('Monthly need', 'نیاز ماهانه'),
  financed: l('Financed', 'تأمین‌شده'),
  availability: l('Market availability', 'دسترسی بازار'),
  partnersTitle: l('Trading partners', 'شرکای تجاری'),
  share: l('Export share', 'سهم صادرات'),
  reliability: l('Reliability', 'قابلیت اتکا'),
  sanctionsTitle: l('Sanctions pressure', 'فشار تحریم'),
  financial: l('Financial', 'مالی'),
  energySanctions: l('Energy sector', 'بخش انرژی'),
  shippingSanctions: l('Shipping and insurance', 'کشتیرانی و بیمه'),
  technology: l('Technology', 'فناوری'),
  map: l('Economic map', 'نقشه اقتصادی'),
  mapHint: l('Select a node to see the economic dependency behind it.', 'یک گره را انتخاب کنید تا وابستگی اقتصادی آن را ببینید.'),
  householdsTitle: l('Households', 'خانواده‌ها'),
  unemployment: l('Unemployment', 'بیکاری'),
  realWage: l('Real wages', 'دستمزد واقعی'),
  foodAffordability: l('Food affordability', 'قدرت خرید غذا'),
  medicineAffordability: l('Medicine affordability', 'قدرت خرید دارو'),
  energyAffordability: l('Energy affordability', 'قدرت خرید انرژی'),
  poverty: l('Poverty', 'فقر'),
  informal: l('Informal employment', 'اشتغال غیررسمی'),
  stabilityTitle: l('Social and political stability', 'ثبات اجتماعی و سیاسی'),
  confidence: l('Public confidence', 'اعتماد عمومی'),
  fairness: l('Perceived fairness', 'احساس عدالت'),
  hardship: l('Household hardship', 'سختی خانوار'),
  laborUnrest: l('Labour unrest', 'ناآرامی کارگری'),
  protests: l('Protest activity', 'فعالیت اعتراضی'),
  elite: l('Elite support', 'حمایت نخبگان'),
  cohesion: l('Institutional cohesion', 'انسجام نهادی'),
  groupsTitle: l('Who carries the cost', 'چه کسانی هزینه را می‌پردازند'),
  institutionsTitle: l('Institutions and recommendations', 'نهادها و توصیه‌ها'),
  policiesTitle: l('Policy decisions', 'تصمیم‌های سیاستی'),
  objectivesTitle: l('Six outcomes, no single score', 'شش نتیجه، بدون امتیاز واحد'),
  survival: l('Economic survival', 'بقای اقتصادی'),
  financialAxis: l('Financial stability', 'ثبات مالی'),
  welfare: l('Public welfare', 'رفاه عمومی'),
  politicalAxis: l('Political stability', 'ثبات سیاسی'),
  productive: l('Productive capacity', 'ظرفیت تولیدی'),
  independence: l('Strategic independence', 'استقلال راهبردی'),
  activePolicies: l('Policies in force', 'سیاست‌های در اجرا'),
  pending: l('Pending effects', 'اثرات معوق'),
  monthsAhead: l('months ahead', 'ماه آینده'),
  final: l('Final month', 'ماه پایانی'),
  report: l('Monthly report', 'گزارش ماهانه'),
  verdict: l('Post-game analysis', 'تحلیل پس از بازی'),
  saveHint: l('Saved automatically each month.', 'هر ماه به‌طور خودکار ذخیره می‌شود.'),
  seeVerdict: l('See the verdict', 'دیدن نتیجه'),
  review: l('Review the situation', 'بررسی وضعیت'),
  ended: l('The crisis is over', 'بحران تمام شد'),
};

function copy(value: L, lang: Lang): string {
  return pick(value, lang);
}

function toneFor(value: number, inverse = false, thresholds: [number, number] = [40, 60]): Tone {
  const [low, high] = thresholds;
  const v = inverse ? 100 - value : value;
  return v < low ? 'bad' : v < high ? 'warn' : 'good';
}

function pct(value: number, lang: Lang, digits = 0): string {
  return `${fmt(value, lang, digits)}%`;
}

function bar(value: number, inverse = false): string {
  const width = Math.max(2, Math.min(100, Math.round(value)));
  return `<span class="econ-bar tone-${toneFor(width, inverse)}"><i style="width:${width}%"></i></span>`;
}

function metric(label: string, value: string, sub: string, tone: Tone): string {
  return `<article class="econ-metric tone-${tone}">
    <span class="econ-metric-label">${label}</span>
    <strong>${value}</strong>
    <span class="econ-metric-sub">${sub}</span>
  </article>`;
}

function chart(values: number[], colour: string): string {
  const points = values.slice(-14);
  if (points.length < 2) return '<div class="econ-chart-empty"></div>';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(0.001, max - min);
  const width = 300;
  const height = 88;
  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 12) - 6;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return `<svg class="econ-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${path}" fill="none" stroke="${colour}" stroke-width="2" vector-effect="non-scaling-stroke" />
    <path d="${path} L${width},${height} L0,${height} Z" fill="${colour}" opacity="0.09" />
  </svg>`;
}

function section(title: string, body: string, extra = ''): string {
  return `<section class="econ-card">
    <header class="econ-card-head"><h2>${title}</h2>${extra}</header>
    ${body}
  </section>`;
}

function rows(items: Array<[string, string, string?]>): string {
  return `<dl class="econ-rows">${items
    .map(([label, value, tone]) => `<div><dt>${label}</dt><dd${tone ? ` class="tone-${tone}"` : ''}>${value}</dd></div>`)
    .join('')}</dl>`;
}

function signed(value: number, lang: Lang, digits = 1): string {
  return `${value >= 0 ? '+' : '−'}${fmt(Math.abs(value), lang, digits)}`;
}

export class EconomicApp {
  private root: HTMLElement;
  private state: EconomicState | null = null;
  private lang: Lang = 'en';
  private tab: Tab = 'overview';
  private startMode: StartMode = 'campaign';
  private scenario: ScenarioId = 'hormuz';
  private sandbox = { reserves: 18.4, oilPrice: 91, sanctions: 55, stability: 52, shipping: 55 };
  private modal: Modal = null;
  private outcomePending = false;
  private mapNode = 'hormuz';
  private toast = '';
  private toastTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    try {
      const saved = localStorage.getItem('chokepoint:economic:lang');
      if (saved === 'fa' || saved === 'en') this.lang = saved;
    } catch {
      /* default language */
    }
    this.applyDocumentLanguage();
    this.root.addEventListener('click', (event) => this.onClick(event));
    this.root.addEventListener('input', (event) => this.onInput(event));
    this.root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = (event.target as Element).closest<SVGGElement>('[data-act="map-node"]');
      if (!target) return;
      event.preventDefault();
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    this.render();
  }

  private applyDocumentLanguage(): void {
    document.documentElement.lang = this.lang;
    document.documentElement.dir = this.lang === 'fa' ? 'rtl' : 'ltr';
    document.title = this.lang === 'fa' ? 'چوک‌پوینت — بقای اقتصادی' : 'Chokepoint — Economic Survival';
  }

  private setLanguage(lang: Lang): void {
    this.lang = lang;
    try {
      localStorage.setItem('chokepoint:economic:lang', lang);
    } catch {
      /* optional persistence */
    }
    this.applyDocumentLanguage();
    this.render();
  }

  private flash(message: string): void {
    this.toast = message;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast = '';
      this.render();
    }, 2600);
    this.render();
  }

  private text(key: keyof typeof TEXT): string {
    return copy(TEXT[key], this.lang);
  }

  private begin(): void {
    const seed = 20260301 + Object.keys(SCENARIOS).indexOf(this.scenario) * 137;
    this.state = createInitialState(this.startMode, this.scenario, seed, this.startMode === 'sandbox' ? { ...this.sandbox } : undefined);
    this.tab = 'overview';
    this.modal = null;
    this.outcomePending = false;
    this.render();
  }

  private restore(): void {
    const restored = loadState();
    if (!restored) {
      this.flash(this.lang === 'fa' ? 'وضعیت ذخیره‌شده‌ای نیست.' : 'No saved situation.');
      return;
    }
    this.state = restored;
    this.tab = 'overview';
    this.outcomePending = false;
    this.modal = restored.status !== 'playing' ? 'outcome' : null;
    this.render();
  }

  private onClick(event: Event): void {
    const target = (event.target as Element).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const act = target.dataset.act;
    const state = this.state;
    switch (act) {
      case 'lang':
        this.setLanguage(this.lang === 'en' ? 'fa' : 'en');
        return;
      case 'scenario':
        this.scenario = (target.dataset.id as ScenarioId) ?? 'hormuz';
        this.render();
        return;
      case 'start-mode':
        this.startMode = target.dataset.mode === 'sandbox' ? 'sandbox' : 'campaign';
        this.render();
        return;
      case 'begin':
        this.begin();
        return;
      case 'continue':
        this.restore();
        return;
      case 'tab':
        this.tab = (target.dataset.id as Tab) ?? 'overview';
        this.render();
        return;
      case 'queue': {
        if (!state) return;
        const id = target.dataset.id as PolicyDef['id'];
        const result = queuePolicy(state, id);
        if (!result.ok && result.reason) this.flash(copy(result.reason, this.lang));
        this.render();
        return;
      }
      case 'unqueue':
        if (!state) return;
        unqueuePolicy(state, target.dataset.id as PolicyDef['id']);
        this.render();
        return;
      case 'resolve': {
        if (!state || state.phase === 'ended') return;
        resolveMonth(state);
        saveState(state);
        // Always show the final month's report first; the verdict follows it.
        this.modal = 'report';
        this.outcomePending = state.status !== 'playing';
        this.render();
        return;
      }
      case 'outcome':
      case 'show-outcome':
        this.modal = 'outcome';
        this.outcomePending = false;
        this.render();
        return;
      case 'save':
        if (!state) return;
        this.flash(saveState(state) ? this.text('saved') : this.text('saveFailed'));
        return;
      case 'new':
        clearSave();
        this.state = null;
        this.modal = null;
        this.outcomePending = false;
        this.tab = 'overview';
        this.render();
        return;
      case 'close-modal':
        this.modal = this.outcomePending ? 'outcome' : null;
        this.outcomePending = false;
        this.render();
        return;
      case 'map-node':
        this.mapNode = target.dataset.node ?? 'hormuz';
        this.render();
        return;
      case 'goto':
        this.tab = (target.dataset.tab as Tab) ?? 'overview';
        this.modal = null;
        this.render();
        return;
      default:
        return;
    }
  }

  private onInput(event: Event): void {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[data-sandbox]');
    if (!input) return;
    const key = input.dataset.sandbox as keyof EconomicApp['sandbox'];
    if (!(key in this.sandbox)) return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    this.sandbox[key] = value;
    const output = input.parentElement?.querySelector('output');
    if (output) output.textContent = fmt(value, this.lang, key === 'reserves' ? 1 : 0);
  }

  render(): void {
    this.root.innerHTML = this.state ? this.renderGame(this.state) : this.renderStart();
    if (this.modal && this.state) {
      this.root.insertAdjacentHTML('beforeend', this.renderModal(this.state, this.modal));
    }
    if (this.toast) this.root.insertAdjacentHTML('beforeend', `<div class="econ-toast">${this.toast}</div>`);
  }

  private header(inner: string): string {
    return `<header class="econ-topbar">
      <div class="econ-brand">
        <span class="econ-brand-mark">◈</span>
        <span><strong>CHOKEPOINT</strong><em>${this.text('mode')}</em></span>
      </div>
      <div class="econ-topbar-actions">
        <a class="econ-ghost" href="./index.html">${this.text('back')}</a>
        ${inner}
        <button class="econ-ghost" data-act="lang">${this.text('language')}</button>
      </div>
    </header>`;
  }

  private renderStart(): string {
    const saved = this.savedSummary();
    const scenarios = (Object.keys(SCENARIOS) as ScenarioId[])
      .map((id) => {
        const scenario = SCENARIOS[id];
        const active = id === this.scenario;
        return `<button class="econ-scenario ${active ? 'is-active' : ''}" data-act="scenario" data-id="${id}">
          <span class="econ-scenario-head"><strong>${copy(scenario.name, this.lang)}</strong><em>${fmt(scenario.months, this.lang)} ${this.text('months')}</em></span>
          <span class="econ-scenario-blurb">${copy(scenario.blurb, this.lang)}</span>
          <span class="econ-scenario-tag">${copy(scenario.difficulty, this.lang)}</span>
        </button>`;
      })
      .join('');
    const sandboxRow = (key: keyof EconomicApp['sandbox'], label: string, min: number, max: number, step: number) => `
      <label class="econ-slider">
        <span>${label}</span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${this.sandbox[key]}" data-sandbox="${key}" />
        <output>${fmt(this.sandbox[key], this.lang, key === 'reserves' ? 1 : 0)}</output>
      </label>`;
    return `<div class="econ-shell">
      ${this.header('')}
      <main class="econ-start">
        <section class="econ-hero">
          <p class="econ-kicker">${this.text('subtitle')}</p>
          <h1>${this.text('startTitle')}</h1>
          <p class="econ-lead">${this.text('startBlurb')}</p>
          <p class="econ-disclaimer">${this.text('illustrative')}</p>
        </section>
        <div class="econ-segmented" role="tablist">
          <button class="${this.startMode === 'campaign' ? 'is-active' : ''}" data-act="start-mode" data-mode="campaign">${this.text('campaign')}</button>
          <button class="${this.startMode === 'sandbox' ? 'is-active' : ''}" data-act="start-mode" data-mode="sandbox">${this.text('sandbox')}</button>
        </div>
        <h2 class="econ-start-heading">${this.text('choose')}</h2>
        <div class="econ-scenarios">${scenarios}</div>
        ${this.startMode === 'sandbox'
          ? `<section class="econ-card econ-sandbox">
              <header class="econ-card-head"><h2>${this.text('sandbox')}</h2><span class="econ-hint">${this.text('sandboxHint')}</span></header>
              ${sandboxRow('reserves', this.text('reserves'), 1, 60, 0.5)}
              ${sandboxRow('oilPrice', this.text('oilPrice'), 35, 160, 1)}
              ${sandboxRow('sanctions', this.text('sanctions'), 10, 95, 1)}
              ${sandboxRow('stability', this.text('stability'), 10, 90, 1)}
              ${sandboxRow('shipping', this.text('shipping'), 10, 95, 1)}
            </section>`
          : ''}
        <div class="econ-start-actions">
          <button class="econ-primary" data-act="begin">${this.text(this.startMode === 'campaign' ? 'beginCampaign' : 'beginSandbox')}</button>
          <button class="econ-secondary" data-act="continue" ${saved ? '' : 'disabled'}>${saved ? `${this.text('continueSaved')} · ${saved}` : this.text('noSave')}</button>
        </div>
        <p class="econ-footnote">${this.text('separate')}</p>
      </main>
    </div>`;
  }

  private savedSummary(): string {
    const saved = loadState();
    if (!saved) return '';
    return `${this.text('month')} ${fmt(saved.turn, this.lang)} · ${money(saved.reserves.usable, this.lang)}`;
  }

  private renderGame(state: EconomicState): string {
    const month = this.monthLabel(state);
    const horizon = state.mode === 'campaign' ? `${this.text('month')} ${fmt(state.turn, this.lang)} ${this.text('of')} ${fmt(state.maxMonths, this.lang)}` : `${this.text('month')} ${fmt(state.turn, this.lang)} · ${this.text('openEnded')}`;
    const tabs = TABS.map(
      (tab) => `<button class="econ-tab ${this.tab === tab.id ? 'is-active' : ''}" data-act="tab" data-id="${tab.id}">
        <span aria-hidden="true">${tab.glyph}</span><em>${copy(tab.label, this.lang)}</em>
      </button>`,
    ).join('');
    return `<div class="econ-shell">
      ${this.header(`<button class="econ-ghost" data-act="save">${this.text('save')}</button>`)}
      <header class="econ-statusbar">
        <div>
          <span class="econ-kicker">${copy(SCENARIOS[state.scenario].short, this.lang)}</span>
          <strong>${month}</strong>
        </div>
        <div class="econ-status-meta">
          <span>${horizon}</span>
          <span class="econ-pill ${state.phase === 'ended' ? 'tone-bad' : 'tone-warn'}">${state.phase === 'ended' ? this.text('final') : copy(forecast(state).risk, this.lang)}</span>
        </div>
      </header>
      <nav class="econ-tabs">${tabs}</nav>
      <main class="econ-main">
        ${this.renderTab(state)}
      </main>
      <div class="econ-decision-dock">
        <div class="econ-dock-queued">
          ${state.policies.queued.length
            ? state.policies.queued.map((id) => `<button class="econ-chip" data-act="unqueue" data-id="${id}">${copy(POLICY_BY_ID[id].name, this.lang)} ×</button>`).join('')
            : `<span class="econ-dock-empty">${this.text('noDecisions')}</span>`}
        </div>
        <div class="econ-dock-actions">
          <span class="econ-capital">${state.phase === 'ended' ? this.text('ended') : `${fmt(state.policies.politicalCapital, this.lang)} · ${this.text('political')}`}</span>
          ${state.phase === 'ended'
            ? `<button class="econ-primary" data-act="outcome">${this.text('outcome')}</button>`
            : `<button class="econ-primary" data-act="resolve">${this.text('resolve')}</button>`}
        </div>
      </div>
    </div>`;
  }

  private monthLabel(state: EconomicState): string {
    return this.formatMonthLabel(state.report && state.phase === 'ended' ? state.report.month : state.date);
  }

  private formatMonthLabel(iso: string): string {
    try {
      return new Intl.DateTimeFormat(this.lang === 'fa' ? 'fa-IR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
    } catch {
      return iso;
    }
  }

  private renderTab(state: EconomicState): string {
    switch (this.tab) {
      case 'economy':
        return this.renderEconomy(state);
      case 'trade':
        return this.renderTrade(state);
      case 'society':
        return this.renderSociety(state);
      case 'government':
        return this.renderGovernment(state);
      default:
        return this.renderOverview(state);
    }
  }

  private renderOverview(state: EconomicState): string {
    const risk = forecast(state);
    const snapshots = state.snapshots;
    const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2]! : snapshots[0]!;
    const current = snapshots[snapshots.length - 1]!;
    const delta = current.reserves - previous.reserves;
    const issues = criticalIssues(state)
      .map((issue) => `<article class="econ-issue tone-${issue.tone}"><h3>${copy(issue.title, this.lang)}</h3><p>${copy(issue.detail, this.lang)}</p></article>`)
      .join('');
    const metrics = [
      metric(this.text('reserves'), money(state.reserves.usable, this.lang), `${signed(delta, this.lang)} B`, delta < -0.5 ? 'bad' : delta < 0 ? 'warn' : 'good'),
      metric(this.text('inflation'), pct(state.prices.headline, this.lang, 1), `${this.text('expectations')} ${pct(state.prices.expectations, this.lang, 0)}`, toneFor(state.prices.headline, true, [30, 50])),
      metric(this.text('parallel'), fmt(Math.round(state.currency.parallel), this.lang), `${this.text('gap')} ${pct(state.currency.fxGap, this.lang, 0)}`, toneFor(state.currency.fxGap, true, [25, 45])),
      metric(this.text('coverage'), `${fmt(coverageAverage(state), this.lang, 1)} ${this.text('weeks')}`, `${this.text('food')} ${fmt(state.trade.food.coverage, this.lang, 1)}w`, toneFor(coverageAverage(state), false, [3, 6])),
      metric(
        this.text('balance'),
        `${state.fiscal.deficit >= 0 ? '−' : '+'}${money(Math.abs(state.fiscal.deficit), this.lang)}`,
        `${this.text('primary')} ${state.fiscal.primary >= 0 ? '−' : '+'}${money(Math.abs(state.fiscal.primary), this.lang)}`,
        toneFor(state.fiscal.deficit, true, [1.2, 2.2]),
      ),
      metric(this.text('legitimacy'), `${fmt(state.society.legitimacy, this.lang)} / 100`, `${this.text('protests')} ${fmt(state.society.protests, this.lang)}`, toneFor(state.society.legitimacy)),
    ].join('');
    const lastReport = state.report
      ? `${section(
          this.text('monthEnd'),
          `<p class="econ-report-headline">${copy(state.report.headline, this.lang)}</p>
           <ul class="econ-report-lines">${state.report.lines.slice(0, 5).map((line) => `<li class="tone-${line.tone}">${copy(line.text, this.lang)}</li>`).join('')}</ul>`,
          `<button class="econ-link" data-act="tab" data-id="government">${this.text('decisions')}</button>`,
        )}`
      : '';
    return `<div class="econ-grid">
      <section class="econ-card econ-briefing">
        <header class="econ-card-head"><h2>${this.text('briefing')}</h2><span class="econ-pill tone-${risk.weeks < 8 ? 'bad' : 'warn'}">${copy(risk.risk, this.lang)}</span></header>
        <div class="econ-metrics">${metrics}</div>
      </section>
      ${section(this.text('urgent'), `<div class="econ-issues">${issues}</div>`)}
      ${section(
        this.text('forecast'),
        `<div class="econ-forecast">
          <div><span>${this.text('reserveHorizon')}</span><strong>${fmt(risk.low, this.lang)}–${fmt(risk.high, this.lang)} ${this.text('weeks')}</strong><em>${fmt(reserveWeeks(state), this.lang)} ${this.text('weeks')} ${this.lang === 'fa' ? 'برآورد مرکزی' : 'central estimate'}</em></div>
          <div><span>${this.text('inflationRange')}</span><strong>${fmt(risk.inflationRange[0], this.lang)}–${fmt(risk.inflationRange[1], this.lang)}%</strong><em>${this.text('illustrative')}</em></div>
        </div>
        <div class="econ-chart-wrap">${chart(snapshots.map((snap) => snap.reserves), '#e6b55f')}<span class="econ-chart-label">${this.text('reserves')}</span></div>`,
      )}
      ${lastReport}
    </div>`;
  }

  private renderEconomy(state: EconomicState): string {
    const snapshots = state.snapshots;
    const revenue = [
      [this.text('oilRevenue'), money(state.fiscal.oilRevenue, this.lang)],
      [this.text('taxes'), money(state.fiscal.taxRevenue, this.lang)],
      [this.text('customs'), money(state.fiscal.customs, this.lang)],
      [this.text('other'), money(state.fiscal.otherRevenue, this.lang)],
    ] as Array<[string, string]>;
    const spending = [
      [this.text('wages'), money(state.fiscal.wages, this.lang)],
      [this.text('pensions'), money(state.fiscal.pensions, this.lang)],
      [this.text('subsidies'), money(state.fiscal.subsidySpend, this.lang)],
      [this.text('health'), money(state.fiscal.health, this.lang)],
      [this.text('education'), money(state.fiscal.education, this.lang)],
      [this.text('infrastructure'), money(state.fiscal.infrastructure, this.lang)],
      [this.text('defence'), money(state.fiscal.defence, this.lang)],
      [this.text('interest'), money(state.fiscal.interest, this.lang)],
      [this.text('emergency'), money(state.fiscal.emergency, this.lang)],
    ] as Array<[string, string]>;
    const priceRows: Array<[string, number]> = [
      [this.text('headline'), state.prices.headline],
      [this.text('core'), state.prices.core],
      [this.text('food'), state.prices.food],
      [this.text('fuel'), state.prices.fuel],
      [this.text('medicine'), state.prices.medicine],
      [this.text('inputs'), state.prices.inputs],
      [this.text('expectations'), state.prices.expectations],
    ];
    return `<div class="econ-grid">
      ${section(
        this.text('reservesTitle'),
        `${rows([
          [this.text('reserves'), money(state.reserves.usable, this.lang)],
          [this.text('gross'), money(grossReserves(state), this.lang)],
          [this.text('frozen'), money(state.reserves.frozen, this.lang), 'bad'],
          [this.text('gold'), money(state.reserves.gold, this.lang)],
          [this.text('externalDebt'), money(state.reserves.externalDebt, this.lang)],
          [this.text('debtDue'), money(state.reserves.debtDue, this.lang)],
        ])}
        <div class="econ-chart-wrap">${chart(snapshots.map((snap) => snap.reserves), '#e6b55f')}</div>`,
      )}
      ${section(
        this.text('currencyTitle'),
        `${rows([
          [this.text('official'), fmt(Math.round(state.currency.official), this.lang)],
          [this.text('managed'), fmt(Math.round(state.currency.managed), this.lang)],
          [this.text('parallel'), fmt(Math.round(state.currency.parallel), this.lang), 'warn'],
          [this.text('gap'), pct(state.currency.fxGap, this.lang), toneFor(state.currency.fxGap, true, [25, 45])],
        ])}
        <div class="econ-meter"><span>${this.text('flight')}</span>${bar(state.currency.capitalFlight, true)}<em>${fmt(state.currency.capitalFlight, this.lang)}</em></div>
        <div class="econ-chart-wrap">${chart(snapshots.map((snap) => snap.parallel), '#df7064')}</div>`,
      )}
      ${section(
        this.text('pricesTitle'),
        `<div class="econ-bars">${priceRows
          .map(([label, value]) => `<div class="econ-bar-row"><span>${label}</span>${bar(value, true)}<em>${pct(value, this.lang, 1)}</em></div>`)
          .join('')}</div>
        <p class="econ-note">${this.lang === 'fa' ? 'تورم می‌تواند کند شود، در حالی که قیمت‌ها بالا می‌مانند.' : 'Inflation can slow while prices stay high. The index remembers what the rate forgets.'}</p>`,
      )}
      ${section(
        this.text('budgetTitle'),
        `<div class="econ-split">
          <div><h3>${this.text('revenue')} · ${money(totalRevenue(state.fiscal), this.lang)}</h3>${rows(revenue)}</div>
          <div><h3>${this.text('spending')} · ${money(totalSpending(state.fiscal), this.lang)}</h3>${rows(spending)}</div>
        </div>
        ${rows([
          [this.text('deficit'), money(state.fiscal.deficit, this.lang), toneFor(state.fiscal.deficit, true, [1.2, 2.2])],
          [this.text('primary'), money(state.fiscal.primary, this.lang)],
          [this.text('debt'), `${fmt(state.fiscal.debt, this.lang)}% / GDP`],
          [this.text('arrears'), money(state.fiscal.arrears, this.lang), state.fiscal.arrears > 1 ? 'warn' : undefined],
        ])}`,
      )}
      ${section(
        this.text('bankingTitle'),
        `<div class="econ-bars">
          ${[[this.text('liquidity'), state.banking.liquidity], [this.text('bankConfidence'), state.banking.confidence], [this.text('credit'), state.banking.credit], [this.text('npl'), state.banking.npl]]
            .map(([label, value]) => `<div class="econ-bar-row"><span>${label}</span>${bar(Number(value), String(label) === this.text('npl'))}<em>${fmt(Number(value), this.lang)}</em></div>`)
            .join('')}
        </div>`,
      )}
      ${section(
        this.text('investmentTitle'),
        `<div class="econ-bars">
          ${[
            [this.text('infraQuality'), state.investment.infrastructure],
            [this.text('productivity'), state.investment.productivity],
            [this.text('tech'), state.investment.techAccess],
            [this.text('privateConfidence'), state.investment.privateConfidence],
            [this.text('humanCapital'), state.investment.humanCapital],
            [this.text('fdi'), state.investment.fdi],
          ]
            .map(([label, value]) => `<div class="econ-bar-row"><span>${label}</span>${bar(Number(value))}<em>${fmt(Number(value), this.lang)}</em></div>`)
            .join('')}
        </div>`,
      )}
    </div>`;
  }

  private renderTrade(state: EconomicState): string {
    const importLine = (label: string, line: EconomicState['trade']['food']) => `
      <div class="econ-import">
        <div class="econ-import-head"><strong>${label}</strong><em class="tone-${toneFor(line.coverage, false, [3, 6])}">${fmt(line.coverage, this.lang, 1)} ${this.text('weeks')}</em></div>
        ${bar(Math.min(100, line.coverage * 8), false)}
        <span class="econ-note">${this.text('need')} ${money(line.need, this.lang)} · ${this.text('financed')} ${money(line.financed, this.lang)} · ${this.text('availability')} ${pct(line.availability, this.lang)}</span>
      </div>`;
    const partners = (Object.keys(state.partners) as Array<keyof EconomicState['partners']>)
      .map((id) => {
        const partner = state.partners[id];
        const name = { china: l('China', 'چین'), uae: l('UAE', 'امارات'), turkey: l('Türkiye', 'ترکیه'), eu: l('European Union', 'اتحادیه اروپا'), oman: l('Oman', 'عمان') }[id];
        return `<div class="econ-partner">
          <span>${copy(name, this.lang)}</span>
          <div class="econ-bar-row">${bar(partner.reliability)}<em>${pct(partner.share, this.lang)}</em></div>
          <span class="econ-note">${this.text('reliability')} ${fmt(partner.reliability, this.lang)} · ${this.text('share')} ${pct(partner.share, this.lang)}</span>
        </div>`;
      })
      .join('');
    return `<div class="econ-grid">
      ${section(
        this.text('energyTitle'),
        `${rows([
          [this.text('production'), `${fmt(state.energy.production * 1000, this.lang)} kb/d`],
          [this.text('capacity'), `${fmt(state.energy.capacity * 1000, this.lang)} kb/d`],
          [this.text('domesticUse'), `${fmt(state.energy.domesticUse * 1000, this.lang)} kb/d`],
          [this.text('exports'), `${fmt(state.energy.exports * 1000, this.lang)} kb/d`],
          [this.text('realizedPrice'), `$${fmt(state.energy.realizedPrice, this.lang, 1)}`],
          [this.text('discount'), `$${fmt(state.energy.discount, this.lang, 1)}`],
          [this.text('refinery'), pct(state.energy.refinery, this.lang), toneFor(state.energy.refinery)],
        ])}
        <p class="econ-note">${this.lang === 'fa' ? 'درآمد نفتی از صادرات قابل فروش و قیمت واقعی محاسبه می‌شود، نه از تولید ضربدر قیمت جهانی.' : 'Oil revenue is calculated from saleable exports and the realized price — not production multiplied by the global benchmark.'}</p>`,
      )}
      ${section(
        this.text('importsTitle'),
        `<div class="econ-imports">
          ${importLine(this.text('food'), state.trade.food)}
          ${importLine(this.text('medicine'), state.trade.medicine)}
          ${importLine(this.text('inputs'), state.trade.inputs)}
          ${importLine(this.text('consumer'), state.trade.consumer)}
        </div>`,
      )}
      ${section(
        this.text('map'),
        `<div class="econ-map">${this.renderMap(state)}</div>
        <p class="econ-map-detail">${this.mapDetail(state)}</p>
        <p class="econ-hint">${this.text('mapHint')}</p>`,
      )}
      ${section(this.text('partnersTitle'), `<div class="econ-partners">${partners}</div>`)}
      ${section(
        this.text('sanctionsTitle'),
        `<div class="econ-bars">
          ${[
            [this.text('financial'), state.sanctions.financial],
            [this.text('energySanctions'), state.sanctions.energy],
            [this.text('shippingSanctions'), state.sanctions.shipping],
            [this.text('technology'), state.sanctions.technology],
          ]
            .map(([label, value]) => `<div class="econ-bar-row"><span>${label}</span>${bar(Number(value), true)}<em>${fmt(Number(value), this.lang)}</em></div>`)
            .join('')}
        </div>
        ${rows([
          [this.text('shipping'), `${pct(state.world.shippingDisruption, this.lang)} ${this.lang === 'fa' ? 'اختلال' : 'disruption'}`],
          [this.text('oilPrice'), `$${fmt(state.world.globalOilPrice, this.lang, 0)}`],
        ])}`,
      )}
    </div>`;
  }

  private renderMap(state: EconomicState): string {
    const routeTone = state.world.shippingDisruption > 65 ? 'bad' : state.world.shippingDisruption > 48 ? 'warn' : 'good';
    const nodes: Array<{ id: string; label: L; x: number; y: number; kind: 'energy' | 'port' | 'farm' | 'industry' | 'partner' }> = [
      { id: 'kharg', label: l('Kharg terminal', 'پایانه خارک'), x: 104, y: 168, kind: 'energy' },
      { id: 'tehran', label: l('Industrial belt', 'کمربند صنعتی'), x: 264, y: 128, kind: 'industry' },
      { id: 'bandar', label: l('Bandar Abbas', 'بندرعباس'), x: 392, y: 206, kind: 'port' },
      { id: 'hormuz', label: l('Hormuz', 'هرمز'), x: 446, y: 232, kind: 'port' },
      { id: 'jask', label: l('Jask outlet', 'خروجی جاسک'), x: 502, y: 282, kind: 'port' },
      { id: 'farm', label: l('Agricultural south', 'جنوب کشاورزی'), x: 300, y: 292, kind: 'farm' },
      { id: 'china', label: l('China', 'چین'), x: 528, y: 74, kind: 'partner' },
      { id: 'turkey', label: l('Türkiye', 'ترکیه'), x: 108, y: 70, kind: 'partner' },
      { id: 'uae', label: l('UAE', 'امارات'), x: 492, y: 250, kind: 'partner' },
    ];
    const links: Array<[string, string]> = [
      ['kharg', 'hormuz'],
      ['tehran', 'bandar'],
      ['bandar', 'hormuz'],
      ['hormuz', 'jask'],
      ['farm', 'bandar'],
      ['kharg', 'turkey'],
      ['jask', 'china'],
      ['hormuz', 'uae'],
    ];
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const lines = links
      .map(([from, to]) => {
        const a = byId[from];
        const b = byId[to];
        if (!a || !b) return '';
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="econ-route tone-${routeTone}" />`;
      })
      .join('');
    const dots = nodes
      .map((node) => {
        const active = node.id === this.mapNode;
        return `<g class="econ-map-node ${active ? 'is-active' : ''}" data-act="map-node" data-node="${node.id}" tabindex="0" role="button" aria-label="${copy(node.label, this.lang)}">
          <circle cx="${node.x}" cy="${node.y}" r="${active ? 11 : 7}" class="node-${node.kind}" />
          <text x="${node.x + 12}" y="${node.y + 4}">${copy(node.label, this.lang)}</text>
        </g>`;
      })
      .join('');
    return `<svg viewBox="0 0 620 340" role="img" aria-label="${this.text('map')}">
      <rect x="0" y="0" width="620" height="340" fill="transparent" />
      ${lines}
      ${dots}
    </svg>`;
  }

  private mapDetail(state: EconomicState): string {
    const details: Record<string, L> = {
      kharg: l(
        `The main crude loading terminal. ${fmt(state.energy.exports * 1000, this.lang)} kb/d is being exported at $${fmt(state.energy.realizedPrice, this.lang, 1)} after discounts.`,
        `پایانه اصلی بارگیری نفت. ${fmt(state.energy.exports * 1000, this.lang)} هزار بشکه در روز با قیمت ${fmt(state.energy.realizedPrice, this.lang, 1)} دلار پس از تخفیف صادر می‌شود.`,
      ),
      tehran: l(
        `Industrial production is limited by imported inputs: availability is ${pct(state.trade.inputs.availability, this.lang)} and coverage ${fmt(state.trade.inputs.coverage, this.lang, 1)} weeks.`,
        `تولید صنعتی به نهاده وارداتی محدود است: دسترسی ${pct(state.trade.inputs.availability, this.lang)} و پوشش ${fmt(state.trade.inputs.coverage, this.lang, 1)} هفته.`,
      ),
      bandar: l(
        `The main import gateway. Food coverage is ${fmt(state.trade.food.coverage, this.lang, 1)} weeks and medicine ${fmt(state.trade.medicine.coverage, this.lang, 1)} weeks.`,
        `دروازه اصلی واردات. پوشش غذا ${fmt(state.trade.food.coverage, this.lang, 1)} هفته و دارو ${fmt(state.trade.medicine.coverage, this.lang, 1)} هفته است.`,
      ),
      hormuz: l(
        `Shipping disruption stands at ${pct(state.world.shippingDisruption, this.lang)}. The route affects export volume, insurance and the price of every imported input.`,
        `اختلال کشتیرانی ${pct(state.world.shippingDisruption, this.lang)} است. این مسیر بر حجم صادرات، بیمه و قیمت هر نهاده وارداتی اثر می‌گذارد.`,
      ),
      jask: l(
        `The southern outlet bypasses the strait. Refinery capacity is ${pct(state.energy.refinery, this.lang)}; more capacity would make this route matter more.`,
        `خروجی جنوبی تنگه را دور می‌زند. ظرفیت پالایش ${pct(state.energy.refinery, this.lang)} است؛ ظرفیت بیشتر این مسیر را مهم‌تر می‌کند.`,
      ),
      farm: l(
        `Domestic food supply supports ${pct(state.trade.food.availability, this.lang)} of market availability. Climate and irrigation investment decide whether that improves.`,
        `عرضه داخلی غذا ${pct(state.trade.food.availability, this.lang)} از دسترسی بازار را تأمین می‌کند. سرمایه‌گذاری در اقلیم و آبیاری تعیین می‌کند این بهتر شود یا نه.`,
      ),
      china: l(
        `The largest oil buyer, at ${pct(state.partners.china.share, this.lang)} of exports. Reliability ${fmt(state.partners.china.reliability, this.lang)}. Concentration is leverage for them and exposure for you.`,
        `بزرگ‌ترین خریدار نفت با ${pct(state.partners.china.share, this.lang)} صادرات. قابلیت اتکا ${fmt(state.partners.china.reliability, this.lang)}. تمرکز برای آن‌ها اهرم و برای شما ریسک است.`,
      ),
      turkey: l(
        `A land corridor for trade and settlement. Share ${pct(state.partners.turkey.share, this.lang)}, reliability ${fmt(state.partners.turkey.reliability, this.lang)}.`,
        `کریدور زمینی تجارت و تسویه. سهم ${pct(state.partners.turkey.share, this.lang)} و قابلیت اتکا ${fmt(state.partners.turkey.reliability, this.lang)}.`,
      ),
      uae: l(
        `Re-export and finance, close to the route. Reliability ${fmt(state.partners.uae.reliability, this.lang)}; sanctions enforcement is the binding constraint.`,
        `صادرات مجدد و مالی، نزدیک مسیر. قابلیت اتکا ${fmt(state.partners.uae.reliability, this.lang)}؛ اجرای تحریم محدودیت اصلی است.`,
      ),
    };
    return copy(details[this.mapNode] ?? details.hormuz!, this.lang);
  }

  private renderSociety(state: EconomicState): string {
    const groupNotes: Array<[L, L]> = [
      [
        l('Low-income households', 'خانوارهای کم‌درآمد'),
        state.households.foodAffordability < 35
          ? l('Food is the binding constraint; cash transfers are doing most of the work.', 'غذا محدودیت اصلی است؛ پرداخت نقدی بیشتر کار را انجام می‌دهد.')
          : l('Food access is holding, but energy and rent absorb any wage gain.', 'دسترسی غذا پایدار است، اما انرژی و اجاره هر افزایش دستمزد را می‌بلعد.'),
      ],
      [
        l('Public employees', 'کارکنان دولت'),
        state.fiscal.arrears > 0.8
          ? l('Wage arrears are visible and politically costly.', 'معوقات دستمزد آشکار و از نظر سیاسی پرهزینه است.')
          : l('Wages are being paid on time, which buys the government patience.', 'دستمزدها به‌موقع پرداخت می‌شود و برای دولت صبر می‌خرد.'),
      ],
      [
        l('Pensioners', 'بازنشستگان'),
        state.prices.medicine > 45
          ? l('Medicine inflation hits fixed incomes hardest.', 'تورم دارو بیشترین فشار را بر درآمد ثابت می‌آورد.')
          : l('Fixed incomes are eroding more slowly than the headline rate.', 'درآمد ثابت کندتر از نرخ کلی فرسایش می‌یابد.'),
      ],
      [
        l('Industrial workers', 'کارگران صنعتی'),
        state.trade.inputs.coverage < 4
          ? l('Factories are short of imported inputs; shifts are being cut.', 'کارخانه‌ها کمبود نهاده وارداتی دارند؛ شیفت‌ها کاهش می‌یابد.')
          : l('Production lines are still supplied, so employment is stable for now.', 'خطوط تولید هنوز تأمین می‌شوند، پس اشتغال فعلاً پایدار است.'),
      ],
      [
        l('Farmers', 'کشاورزان'),
        l('Input costs and water decide next season more than any cabinet meeting.', 'هزینه نهاده و آب بیشتر از هر جلسه کابینه فصل بعد را تعیین می‌کند.'),
      ],
      [
        l('Small businesses', 'کسب‌وکارهای کوچک'),
        state.banking.credit < 40
          ? l('Credit is scarce; working capital is being financed informally.', 'اعتبار کمیاب است؛ سرمایه در گردش به‌صورت غیررسمی تأمین می‌شود.')
          : l('Credit is available enough to keep inventories moving.', 'اعتبار به‌اندازه‌ای هست که موجودی‌ها بچرخند.'),
      ],
      [
        l('Exporters', 'صادرکنندگان'),
        state.currency.fxGap > 40
          ? l('A wider gap rewards those with access to official currency, not producers.', 'شکاف بیشتر به دارندگان ارز رسمی پاداش می‌دهد، نه به تولیدکنندگان.')
          : l('Exchange-rate access is less of a barrier than shipping and payment risk.', 'دسترسی به ارز کمتر از کشتیرانی و ریسک پرداخت مانع است.'),
      ],
    ];
    const societyRows: Array<[string, number, boolean]> = [
      [this.text('confidence'), state.society.confidence, false],
      [this.text('legitimacy'), state.society.legitimacy, false],
      [this.text('fairness'), state.society.fairness, false],
      [this.text('hardship'), state.society.hardship, true],
      [this.text('laborUnrest'), state.society.laborUnrest, true],
      [this.text('protests'), state.society.protests, true],
      [this.text('elite'), state.society.elite, false],
      [this.text('cohesion'), state.society.cohesion, false],
    ];
    return `<div class="econ-grid">
      ${section(
        this.text('householdsTitle'),
        `<div class="econ-bars">
          ${[
            [this.text('foodAffordability'), state.households.foodAffordability],
            [this.text('medicineAffordability'), state.households.medicineAffordability],
            [this.text('energyAffordability'), state.households.energyAffordability],
            [this.text('realWage'), state.households.realWage],
            [this.text('unemployment'), state.households.unemployment],
            [this.text('poverty'), state.households.poverty],
            [this.text('informal'), state.households.informal],
          ]
            .map(([label, value]) => {
              const number = Number(value);
              const inverse = [this.text('unemployment'), this.text('poverty'), this.text('informal')].includes(String(label));
              return `<div class="econ-bar-row"><span>${label}</span>${bar(number, inverse)}<em>${fmt(number, this.lang)}</em></div>`;
            })
            .join('')}
        </div>`,
      )}
      ${section(
        this.text('stabilityTitle'),
        `<div class="econ-bars">
          ${societyRows
            .map(([label, value, inverse]) => `<div class="econ-bar-row"><span>${label}</span>${bar(value, inverse)}<em>${fmt(value, this.lang)}</em></div>`)
            .join('')}
        </div>
        <div class="econ-chart-wrap">${chart(state.snapshots.map((snap) => snap.social), '#69c6bd')}<span class="econ-chart-label">${this.text('legitimacy')}</span></div>`,
      )}
      ${section(
        this.text('groupsTitle'),
        `<ul class="econ-groups">${groupNotes
          .map(([label, note]) => `<li><strong>${copy(label, this.lang)}</strong><span>${copy(note, this.lang)}</span></li>`)
          .join('')}</ul>`,
      )}
    </div>`;
  }

  private renderGovernment(state: EconomicState): string {
    const axes = objectives(state);
    const axisRows: Array<[string, number]> = [
      [this.text('survival'), axes.survival],
      [this.text('financialAxis'), axes.financial],
      [this.text('welfare'), axes.welfare],
      [this.text('politicalAxis'), axes.political],
      [this.text('productive'), axes.productive],
      [this.text('independence'), axes.independence],
    ];
    const active = state.policies.active.length
      ? state.policies.active.map((item) => `<li>${copy(POLICY_BY_ID[item.id].name, this.lang)} · ${fmt(item.remaining, this.lang)} ${this.text('monthsAhead')}</li>`).join('')
      : `<li class="econ-note">${this.lang === 'fa' ? 'هیچ سیاستی در اجرا نیست.' : 'No policies are in force.'}</li>`;
    const pending = state.policies.pending.length
      ? state.policies.pending.map((item) => `<li>${copy(item.note, this.lang)}</li>`).join('')
      : `<li class="econ-note">${this.lang === 'fa' ? 'اثر معوقی ثبت نشده است.' : 'No delayed effects are pending.'}</li>`;
    const institutions = INSTITUTIONS.map((institution) => this.renderInstitution(state, institution.id, copy(institution.name, this.lang), copy(institution.role, this.lang), institution.glyph)).join('');
    return `<div class="econ-grid">
      ${section(
        this.text('objectivesTitle'),
        `<div class="econ-bars">${axisRows
          .map(([label, value]) => `<div class="econ-bar-row"><span>${label}</span>${bar(value)}<em>${fmt(value, this.lang)}</em></div>`)
          .join('')}</div>`,
      )}
      ${section(this.text('activePolicies'), `<ul class="econ-list">${active}</ul>`)}
      ${section(this.text('pending'), `<ul class="econ-list">${pending}</ul>`)}
      <div class="econ-institutions">${institutions}</div>
    </div>`;
  }

  private renderInstitution(state: EconomicState, id: InstitutionId, name: string, role: string, glyph: string): string {
    const policies = POLICIES.filter((policy) => policy.institution === id);
    const recommendations = policies
      .filter((policy) => !state.policies.active.some((active) => active.id === policy.id) && canQueuePolicy(state, policy.id).ok)
      .sort((a, b) => institutionalSupport(b) - institutionalSupport(a));
    const lead = recommendations[0];
    return `<section class="econ-card econ-institution">
      <header class="econ-card-head">
        <h2><span class="econ-glyph">${glyph}</span>${name}</h2>
        <span class="econ-hint">${role}</span>
      </header>
      <p class="econ-recommendation">${lead
        ? `${this.lang === 'fa' ? 'توصیه:' : 'Recommendation:'} <strong>${copy(lead.name, this.lang)}</strong> — ${copy(lead.summary, this.lang)}`
        : this.lang === 'fa' ? 'همه پیشنهادهای این نهاد در دسترس نیستند.' : 'This institution has no available proposal right now.'}</p>
      <div class="econ-policies">${policies.map((policy) => this.renderPolicy(state, policy)).join('')}</div>
    </section>`;
  }

  private renderPolicy(state: EconomicState, policy: PolicyDef): string {
    const queued = state.policies.queued.includes(policy.id);
    const active = state.policies.active.some((item) => item.id === policy.id);
    const check = canQueuePolicy(state, policy.id);
    const support = institutionalSupport(policy);
    const disabled = !queued && !check.ok;
    return `<article class="econ-policy ${queued ? 'is-queued' : ''} ${active ? 'is-active' : ''}">
      <header>
        <div>
          <h3>${copy(policy.name, this.lang)}</h3>
          <p>${copy(policy.summary, this.lang)}</p>
        </div>
        <span class="econ-cost">${fmt(policy.cost, this.lang)} PC</span>
      </header>
      <div class="econ-policy-support">
        <span>${this.text('support')}</span>
        ${bar(support)}
        <em class="tone-${support >= 60 ? 'good' : support >= 40 ? 'warn' : 'bad'}">${pct(support, this.lang)}</em>
      </div>
      <details>
        <summary>${this.text('benefits')} · ${this.text('costs')} · ${this.text('risk')}</summary>
        <div class="econ-policy-detail">
          <div><h4>${this.text('benefits')}</h4><ul>${policy.benefits.map((item) => `<li>${copy(item, this.lang)}</li>`).join('')}</ul></div>
          <div><h4>${this.text('costs')}</h4><ul>${policy.costs.map((item) => `<li>${copy(item, this.lang)}</li>`).join('')}</ul></div>
          <p class="econ-note"><strong>${this.text('risk')}:</strong> ${copy(policy.risk, this.lang)}</p>
        </div>
      </details>
      <footer>
        ${active ? `<span class="econ-pill tone-good">${this.text('active')}</span>` : ''}
        <button class="${queued ? 'econ-secondary' : 'econ-ghost'} ${disabled ? 'is-disabled' : ''}" data-act="${queued ? 'unqueue' : 'queue'}" data-id="${policy.id}" ${disabled ? 'disabled' : ''}>
          ${queued ? this.text('remove') : active ? this.text('active') : check.ok ? this.text('queue') : this.text('unavailable')}
        </button>
      </footer>
      ${disabled && check.reason ? `<p class="econ-hint">${copy(check.reason, this.lang)}</p>` : ''}
    </article>`;
  }

  private renderModal(state: EconomicState, modal: Exclude<Modal, null>): string {
    if (modal === 'outcome' && state.outcome) {
      return this.renderOutcome(state.outcome);
    }
    const report = state.report;
    if (!report) return '';
    const last = state.status !== 'playing';
    return `<div class="econ-modal" role="dialog" aria-modal="true">
      <div class="econ-modal-card">
        <header><span class="econ-kicker">${this.text('report')} · ${this.formatMonthLabel(report.month)}</span><h2>${copy(report.headline, this.lang)}</h2></header>
        <ul class="econ-report-lines">${report.lines.map((line) => `<li class="tone-${line.tone}">${copy(line.text, this.lang)}</li>`).join('')}</ul>
        <footer>
          ${last ? '' : `<button class="econ-secondary" data-act="goto" data-tab="government">${this.text('decisions')}</button>`}
          <button class="econ-primary" data-act="${last ? 'show-outcome' : 'close-modal'}">${this.text(last ? 'seeVerdict' : 'continue')}</button>
        </footer>
      </div>
    </div>`;
  }

  private renderOutcome(outcome: Outcome): string {
    const axes: Array<[string, number]> = [
      [this.text('survival'), outcome.axes.survival],
      [this.text('financialAxis'), outcome.axes.financial],
      [this.text('welfare'), outcome.axes.welfare],
      [this.text('politicalAxis'), outcome.axes.political],
      [this.text('productive'), outcome.axes.productive],
      [this.text('independence'), outcome.axes.independence],
    ];
    return `<div class="econ-modal" role="dialog" aria-modal="true">
      <div class="econ-modal-card econ-outcome tone-${outcome.status === 'lost' ? 'bad' : outcome.status === 'won' ? 'good' : 'warn'}">
        <header><span class="econ-kicker">${this.text('verdict')}</span><h2>${copy(outcome.title, this.lang)}</h2></header>
        <p class="econ-lead">${copy(outcome.text, this.lang)}</p>
        <div class="econ-bars">${axes
          .map(([label, value]) => `<div class="econ-bar-row"><span>${label}</span>${bar(value)}<em>${fmt(value, this.lang)}</em></div>`)
          .join('')}</div>
        <ul class="econ-report-lines">${outcome.notes.map((note) => `<li class="tone-info">${copy(note, this.lang)}</li>`).join('')}</ul>
        <footer>
          <button class="econ-ghost" data-act="close-modal">${this.text('review')}</button>
          <button class="econ-secondary" data-act="save">${this.text('save')}</button>
          <button class="econ-primary" data-act="new">${this.text('newSession')}</button>
        </footer>
        <p class="econ-hint">${this.text('saveHint')}</p>
      </div>
    </div>`;
  }
}
