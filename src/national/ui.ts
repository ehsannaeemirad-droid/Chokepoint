import type { Lang } from '../i18n';
import {
  CAMPAIGNS,
  DEFAULT_PRIORITIES,
  DECISION_BY_ID,
  DEPARTMENTS,
  PLAYER_COUNTRIES,
  availableCapital,
  canQueue,
  canRunDefence,
  clearSave,
  createInitialState,
  createReplay,
  decisionCost,
  decisionsFor,
  describeEffects,
  formatDate,
  l,
  loadState,
  metricTone,
  objectives,
  objectiveCount,
  pick,
  playerCountryName,
  adversaryRelation,
  queueDecision,
  replaySession,
  resolveDefence,
  resolveTurn,
  saveState,
  score,
  stageName,
  unqueueDecision,
  type CampaignId,
  type CustomStart,
  type DefenceAllocation,
  type DefenceResult,
  type DepartmentId,
  type DecisionId,
  type Intensity,
  type L,
  type NationalReplay,
  type NationalState,
  type ObjectiveId,
  type Outcome,
  type PlayerCountryId,
} from './model';

const LABELS = {
  app: l('CHOKEPOINT', 'چوک‌پوینت'),
  command: l('NATIONAL COMMAND', 'فرمان ملی'),
  standfirst: l('A crisis cabinet simulator', 'شبیه‌ساز کابینه بحران'),
  back: l('Theatre game', 'بازی میدانی'),
  save: l('Save', 'ذخیره'),
  exportReplay: l('Export replay', 'خروجی بازپخش'),
  importReplay: l('Import replay', 'ورود بازپخش'),
  replayExported: l('Replay file prepared.', 'پرونده بازپخش آماده شد.'),
  replayFailed: l('Could not read that replay.', 'خواندن این بازپخش ممکن نشد.'),
  replayLoaded: l('Replay restored. The state matches the saved decisions.', 'بازپخش بازیابی شد. وضعیت با تصمیم‌های ذخیره‌شده مطابقت دارد.'),
  saved: l('Situation saved.', 'وضعیت ذخیره شد.'),
  saveFailed: l('Could not save this session.', 'ذخیره این نشست ممکن نشد.'),
  newSession: l('New session', 'نشست تازه'),
  language: l('فا', 'EN'),
  week: l('Week', 'هفته'),
  of: l('of', 'از'),
  openEnded: l('open-ended', 'بی‌پایان'),
  next: l('Resolve week', 'حل هفته'),
  noDecisions: l('No decisions queued. Routine government continues.', 'تصمیمی ثبت نشده است. دولت روزمره ادامه می‌دهد.'),
  decisions: l('Decisions', 'تصمیم‌ها'),
  queued: l('Queued', 'ثبت‌شده'),
  queue: l('Add to queue', 'افزودن به صف'),
  remove: l('Remove', 'حذف'),
  political: l('political capital', 'سرمایه سیاسی'),
  actionPoints: l('two decisions per week', 'دو تصمیم در هفته'),
  situation: l('Situation', 'وضعیت'),
  objectives: l('National objectives', 'اهداف ملی'),
  objectiveMet: l('On track', 'در مسیر'),
  objectiveRisk: l('At risk', 'در خطر'),
  latest: l('Last week', 'هفته گذشته'),
  forecast: l('Assessment', 'ارزیابی'),
  crisis: l('Crisis level', 'سطح بحران'),
  crisisStage: l('Stage', 'مرحله'),
  military: l('Military tension', 'تنش نظامی'),
  diplomatic: l('Diplomatic hostility', 'خصومت دیپلماتیک'),
  economic: l('Economic confrontation', 'رویارویی اقتصادی'),
  domestic: l('Domestic pressure', 'فشار داخلی'),
  map: l('Strategic map', 'نقشه راهبردی'),
  schematic: l('Strategic schematic · select a node', 'طرح راهبردی · یک گره را انتخاب کنید'),
  shipping: l('Shipping', 'کشتیرانی'),
  energy: l('Energy', 'انرژی'),
  diplomacy: l('Diplomacy', 'دیپلماسی'),
  politics: l('Politics', 'سیاست'),
  routeAccess: l('Route access', 'دسترسی مسیر'),
  marketConfidence: l('Market confidence', 'اطمینان بازار'),
  insurance: l('Insurance', 'بیمه'),
  oil: l('Oil', 'نفت'),
  flow: l('Flow', 'جریان'),
  talks: l('Talks', 'مذاکره'),
  mediation: l('Mediation', 'میانجایی'),
  economy: l('Economy', 'اقتصاد'),
  government: l('Government', 'دولت'),
  governance: l('Governance', 'حکمرانی'),
  security: l('Security', 'امنیت'),
  intel: l('Intelligence', 'اطلاعات'),
  reserves: l('Reserves', 'ذخایر'),
  currency: l('Currency', 'ارز'),
  inflation: l('Inflation', 'تورم'),
  fiscal: l('Fiscal capacity', 'توان مالی'),
  publicPressure: l('Public pressure', 'فشار عمومی'),
  tradeAccess: l('Trade access', 'دسترسی تجاری'),
  stability: l('Stability', 'ثبات'),
  legitimacy: l('Legitimacy', 'مشروعیت'),
  elite: l('Elite support', 'حمایت نخبگان'),
  confidence: l('Public confidence', 'اعتماد عمومی'),
  assessmentConfidence: l('Assessment confidence', 'اطمینان ارزیابی'),
  socialTension: l('Social tension', 'تنش اجتماعی'),
  readiness: l('Readiness', 'آمادگی'),
  defence: l('Air defence', 'پدافند هوایی'),
  commandSector: l('Command', 'فرماندهی'),
  ports: l('Ports', 'بنادر'),
  cities: l('Cities', 'شهرها'),
  defencePlot: l('Air-defence plot', 'طرح پدافند هوایی'),
  defenceIntro: l(
    'Three interceptor batteries are ready. Allocate them across the command network, the port approach and the cities. The plot can be run once per week.',
    'سه باتری رهگیر آماده است. آن‌ها را میان شبکه فرماندهی، ورودی بندر و شهرها توزیع کنید. این طرح هر هفته یک بار اجرا می‌شود.',
  ),
  availableBatteries: l('batteries available', 'باتری در دسترس'),
  intercept: l('Run interception', 'اجرای رهگیری'),
  defenceDone: l('The defence plot is complete for this week.', 'طرح پدافندی این هفته کامل شد.'),
  strategic: l('Strategic capacity', 'توان راهبردی'),
  influence: l('Influence', 'نفوذ'),
  relations: l('US relations', 'روابط آمریکا'),
  iranRelations: l('Iran relations', 'روابط ایران'),
  sanctionsRelief: l('Sanctions relief', 'کاهش تحریم'),
  exposure: l('Exposure risk', 'ریسک افشا'),
  deception: l('Deception', 'فریب'),
  source: l('Source', 'منبع'),
  reliability: l('Reliability', 'اعتبار'),
  age: l('Age', 'قدمت'),
  corroboration: l('Corroboration', 'تأیید'),
  deceptionPossible: l('Deception', 'فریب'),
  weeksOld: l('weeks', 'هفته'),
  weekOne: l('week', 'هفته'),
  noReport: l('No cabinet report yet. Set the first week’s priorities.', 'هنوز گزارش کابینه‌ای نیست. اولویت‌های هفته اول را تعیین کنید.'),
  report: l('After-action report', 'گزارش پس از اقدام'),
  reportLead: l('What changed and why', 'چه چیزی و چرا تغییر کرد'),
  continue: l('Continue', 'ادامه'),
  outcome: l('Outcome', 'نتیجه'),
  score: l('Governance score', 'امتیاز حکمرانی'),
  restart: l('New session', 'نشست تازه'),
  inspect: l('Inspect the state', 'بررسی وضعیت'),
  close: l('Close', 'بستن'),
  startTitle: l('Govern the crisis, not only the war.', 'بحران را اداره کنید، نه فقط جنگ را.'),
  startBlurb: l(
    'You are the head of state. Set national priorities, protect the economy and the public contract, use intelligence and diplomacy, and decide how much military pressure the country can bear.',
    'شما رئیس کشور هستید. اولویت‌های ملی را تعیین کنید، از اقتصاد و قرارداد عمومی محافظت کنید، از اطلاعات و دیپلماسی استفاده کنید و تصمیم بگیرید کشور چه میزان فشار نظامی را تحمل می‌کند.',
  ),
  campaign: l('Campaign · Hormuz Crisis', 'کارزار · بحران هرمز'),
  campaignCopy: l(
    'Twelve weeks. Iran starts under sanctions and military pressure. Reach a sustainable settlement, survive with the state intact, or lose control of the crisis.',
    'دوازده هفته. ایران زیر تحریم و فشار نظامی آغاز می‌کند. به توافقی پایدار برسید، با دولت سالم دوام بیاورید، یا کنترل بحران را از دست بدهید.',
  ),
  sandbox: l('Sandbox · Open crisis', 'جعبه‌شن · بحران باز'),
  sandboxCopy: l(
    'No fixed clock. Choose how close the region starts to the brink, then keep governing while the actors pursue their own interests.',
    'بدون ساعت ثابت. انتخاب کنید منطقه از ابتدا چقدر به لبه پرتگاه نزدیک باشد، سپس حکمرانی را ادامه دهید تا بازیگران منافع خود را دنبال کنند.',
  ),
  contained: l('Contained', 'مهارشده'),
  flashpoint: l('Flashpoint', 'نقطه اشتعال'),
  brink: l('On the brink', 'لب پرتگاه'),
  beginCampaign: l('Begin the campaign', 'آغاز کارزار'),
  beginSandbox: l('Begin the sandbox', 'آغاز جعبه‌شن'),
  continueSaved: l('Continue saved situation', 'ادامه وضعیت ذخیره‌شده'),
  startSave: l('Saved · week', 'ذخیره‌شده · هفته'),
  noSave: l('No saved situation', 'وضعیت ذخیره‌شده‌ای نیست'),
  separate: l(
    'A separate mode. The original theatre campaigns are untouched.',
    'یک حالت جداگانه. کارزارهای میدانی اصلی دست‌نخورده‌اند.',
  ),
  startFootnote: l(
    'Two playable governments · three campaigns · a shared simulation. Pick a country, a crisis and the priorities you will be judged on.',
    'دو دولت قابل بازی · سه کارزار · یک شبیه‌سازی مشترک. کشور، بحران و اولویت‌هایی را انتخاب کنید که با آن‌ها سنجیده می‌شوید.',
  ),
  selectMode: l('Choose a mode', 'یک حالت انتخاب کنید'),
  playAs: l('Play as', 'بازی با'),
  chooseCampaign: l('Choose a campaign', 'یک کارزار انتخاب کنید'),
  choosePriorities: l('Choose two national priorities', 'دو اولویت ملی انتخاب کنید'),
  priorityHint: l('Priorities shape the final verdict. Choose exactly two.', 'اولویت‌ها نتیجه نهایی را شکل می‌دهند. دقیقاً دو مورد را انتخاب کنید.'),
  customCrisis: l('Custom crisis', 'بحران سفارشی'),
  customHint: l('Set the opening pressure instead of using a preset.', 'فشار آغازین را به‌جای استفاده از پیش‌تنظیم تعیین کنید.'),
  customOn: l('Use custom start', 'استفاده از شروع سفارشی'),
  pressure: l('Military pressure', 'فشار نظامی'),
  accessibility: l('Shipping access', 'دسترسی کشتیرانی'),
  begin: l('Open the situation room', 'ورود به اتاق وضعیت'),
  beginHint: l('The campaign clock starts when you enter.', 'ساعت کارزار با ورود شما آغاز می‌شود.'),
  selected: l('Selected', 'انتخاب‌شده'),
  playerLabel: l('Your government', 'دولت شما'),
  decisionsLimit: l('Two departmental decisions per week.', 'دو تصمیم وزارتی در هر هفته.'),
  noCapital: l('Political capital is committed elsewhere.', 'سرمایه سیاسی جای دیگری تعهد شده است.'),
  crisisIntro: l('The strait is contested. The next decision is yours.', 'تنگه محل مناقشه است. تصمیم بعدی با شماست.'),
  manifest: l('A separate national-leadership prototype. The classic theatre game remains available from the header.', 'نمونه جداگانه رهبری ملی. بازی میدانی کلاسیک از سربرگ در دسترس است.'),
  node: l('Selected location', 'مکان انتخاب‌شده'),
  final: l('Final week', 'هفته پایانی'),
  openCrisis: l('Open-ended crisis', 'بحران باز'),
  notEnough: l('Not enough political capital', 'سرمایه سیاسی کافی نیست'),
  queuedLimit: l('Two decisions already queued', 'دو تصمیم قبلاً ثبت شده'),
  cooldown: l('cooldown', 'دوره انتظار'),
  collapse: l('Institutional capacity', 'ظرفیت نهادی'),
  securityAxis: l('Security', 'امنیت'),
  governanceAxis: l('Governance', 'حکمرانی'),
  economyAxis: l('Economy', 'اقتصاد'),
  diplomacyAxis: l('Diplomacy', 'دیپلماسی'),
  overallAxis: l('Overall', 'کلی'),
};

const NODES = [
  {
    id: 'kharg',
    name: l('Kharg Island', 'جزیره خارک'),
    x: 144,
    y: 166,
    detail: l('The main crude loading terminal. Export volume depends on shipping flow and war-risk insurance.', 'پایانه اصلی بارگیری نفت خام. حجم صادرات به جریان کشتیرانی و بیمه ریسک جنگ بستگی دارد.'),
  },
  {
    id: 'bandar',
    name: l('Bandar Abbas', 'بندرعباس'),
    x: 444,
    y: 196,
    detail: l('Naval district and the northern gate to the strait. Defensive readiness matters here.', 'منطقه دریایی و دروازه شمالی تنگه. آمادگی دفاعی اینجا اهمیت دارد.'),
  },
  {
    id: 'qeshm',
    name: l('Qeshm', 'قشم'),
    x: 477,
    y: 214,
    detail: l('Coastal defence and a visible signal of Iranian presence. Visibility cuts both ways.', 'پدافند ساحلی و نشانه آشکار حضور ایران. آشکار بودن دو لبه دارد.'),
  },
  {
    id: 'hormuz',
    name: l('Strait of Hormuz', 'تنگه هرمز'),
    x: 493,
    y: 241,
    detail: l('The signature chokepoint. Physical access and commercial confidence are separate constraints.', 'تنگه شاخص. دسترسی فیزیکی و اطمینان تجاری دو محدودیت جداگانه‌اند.'),
  },
  {
    id: 'dubai',
    name: l('Dubai', 'دبی'),
    x: 502,
    y: 301,
    detail: l('Insurance, re-export and finance. A confidence hub more than a military one.', 'بیمه، صادرات مجدد و مالی. مرکز اطمینان، بیش از مرکز نظامی.'),
  },
  {
    id: 'doha',
    name: l('Doha', 'دوحه'),
    x: 396,
    y: 285,
    detail: l('The quiet mediation channel. Qatari proposals become more valuable as the crisis deepens.', 'کانال آرام میانجی‌گری. هرچه بحران عمیق‌تر شود، پیشنهادهای قطر ارزشمندتر می‌شوند.'),
  },
  {
    id: 'riyadh',
    name: l('Riyadh', 'ریاض'),
    x: 274,
    y: 331,
    detail: l('GCC coordination and the Gulf states’ fear of becoming the next target.', 'هماهنگی شورای همکاری و ترس کشورهای خلیج از هدف بعدی بودن.'),
  },
  {
    id: 'muscat',
    name: l('Muscat', 'مسقط'),
    x: 587,
    y: 300,
    detail: l('The southern exit from the Gulf. Shipping flows here are a direct read on market confidence.', 'خروجی جنوبی خلیج. جریان کشتیرانی اینجا خوانش مستقیم اطمینان بازار است.'),
  },
];

type MapLayer = 'shipping' | 'energy' | 'diplomacy' | 'political' | 'military' | 'intelligence';

function num(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', { maximumFractionDigits: 0 }).format(value);
}

function money(value: number, lang: Lang): string {
  return `$${num(Math.round(value), lang)}B`;
}

function pct(value: number, lang: Lang): string {
  return `${num(Math.round(value), lang)}%`;
}

function toneClass(value: number, inverse = false): string {
  return `tone-${metricTone(value, inverse)}`;
}

function bar(value: number, inverse = false): string {
  const width = Math.max(2, Math.min(100, Math.round(value)));
  return `<span class="nat-bar ${toneClass(value, inverse)}"><i style="width:${width}%"></i></span>`;
}

function fmtAssessmentAge(age: number, lang: Lang): string {
  return `${num(age, lang)} ${pick(age === 1 ? LABELS.weekOne : LABELS.weeksOld, lang)}`;
}

function copy(key: keyof typeof LABELS, lang: Lang): string {
  return pick(LABELS[key], lang);
}

function label(value: L, lang: Lang): string {
  return pick(value, lang);
}

export class NationalApp {
  private root: HTMLElement;
  private state: NationalState | null = null;
  private lang: Lang = 'en';
  private department: DepartmentId = 'security';
  private mapLayer: MapLayer = 'shipping';
  private selectedNode = 'hormuz';
  private intensity: Intensity = 'flashpoint';
  private startMode: 'campaign' | 'sandbox' = 'campaign';
  private campaignId: CampaignId = 'hormuz';
  private player: PlayerCountryId = 'iran';
  private priorities: ObjectiveId[] = [...DEFAULT_PRIORITIES];
  private customEnabled = false;
  private custom: CustomStart = {
    military: 58,
    diplomatic: 62,
    economic: 55,
    domestic: 48,
    accessibility: 72,
    confidence: 49,
    reserves: 74,
    inflation: 38,
    stability: 61,
  };
  private modal: 'report' | 'outcome' | 'defence' | null = null;
  private defenceAllocation: DefenceAllocation = { command: 1, ports: 1, cities: 1 };
  private defenceResult: DefenceResult | null = null;
  private toastTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    try {
      const savedLang = localStorage.getItem('chokepoint:national:lang');
      if (savedLang === 'fa' || savedLang === 'en') this.lang = savedLang;
    } catch {
      /* language falls back to English */
    }
    this.root.addEventListener('click', (event) => this.onClick(event));
    this.root.addEventListener('input', (event) => {
      const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[data-custom]');
      if (!input) return;
      const key = input.dataset.custom as keyof CustomStart;
      const value = Number(input.value);
      if (!(key in this.custom) || !Number.isFinite(value)) return;
      this.custom[key] = value;
      const output = input.parentElement?.querySelector<HTMLOutputElement>('output');
      if (output) output.textContent = num(value, this.lang);
    });
    this.root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = (event.target as Element).closest<SVGElement>('[data-act]');
      if (!(target instanceof SVGElement)) return;
      event.preventDefault();
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    this.render();
  }

  private setLanguage(lang: Lang): void {
    this.lang = lang;
    document.title = lang === 'fa' ? 'چوک‌پوینت — فرمان ملی' : 'Chokepoint — National Command';
    try {
      localStorage.setItem('chokepoint:national:lang', lang);
    } catch {
      /* optional persistence */
    }
    this.render();
  }

  private onClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const raw = target.dataset.act ?? '';
    const [verb, value] = raw.split(':');
    switch (verb) {
      case 'lang': {
        const next = value === 'fa' || value === 'en' ? value : this.lang === 'en' ? 'fa' : 'en';
        this.setLanguage(next);
        break;
      }
      case 'save':
        this.doSave();
        break;
      case 'export-replay':
        this.exportReplay();
        break;
      case 'import-replay':
        this.importReplay();
        break;
      case 'start':
        this.start(value === 'sandbox' ? 'sandbox' : 'campaign');
        break;
      case 'mode':
        this.startMode = value === 'sandbox' ? 'sandbox' : 'campaign';
        this.render();
        break;
      case 'campaign':
        this.campaignId = value === 'economic-pressure' || value === 'settlement' ? value : 'hormuz';
        this.startMode = 'campaign';
        this.render();
        break;
      case 'country':
        this.player = value === 'usa' ? 'usa' : 'iran';
        this.render();
        break;
      case 'priority':
        this.togglePriority(value as ObjectiveId);
        break;
      case 'begin':
        this.start(this.startMode);
        break;
      case 'custom':
        this.customEnabled = !this.customEnabled;
        this.render();
        break;
      case 'intensity':
        this.intensity = value === 'contained' ? 'contained' : value === 'brink' ? 'brink' : 'flashpoint';
        this.render();
        break;
      case 'continue':
        this.loadSaved();
        break;
      case 'new':
        this.state = null;
        this.modal = null;
        this.render();
        break;
      case 'dept':
        this.department = (value as DepartmentId) ?? 'security';
        this.render();
        break;
      case 'layer':
        this.mapLayer = value === 'energy' || value === 'diplomacy' || value === 'political' || value === 'military' || value === 'intelligence' ? value : 'shipping';
        this.render();
        break;
      case 'node':
        this.selectedNode = value ?? 'hormuz';
        this.render();
        break;
      case 'queue':
        this.queue(value as DecisionId);
        break;
      case 'unqueue':
        if (this.state) {
          unqueueDecision(this.state, value as DecisionId);
          this.render();
        }
        break;
      case 'resolve':
        this.resolve();
        break;
      case 'tactical':
        if (this.state && canRunDefence(this.state).ok) {
          this.defenceAllocation = { command: 1, ports: 1, cities: 1 };
          this.defenceResult = null;
          this.modal = 'defence';
          this.render();
        } else if (this.state) {
          this.toast(label(canRunDefence(this.state).reason ?? l('Unavailable.', 'ناموجود.'), this.lang));
        }
        break;
      case 'def-add':
        this.adjustDefence(value, 1);
        break;
      case 'def-remove':
        this.adjustDefence(value, -1);
        break;
      case 'def-resolve':
        this.runDefence();
        break;
      case 'close-defence':
        this.modal = null;
        this.defenceResult = null;
        this.render();
        break;
      case 'close-report':
        this.modal = this.state?.phase === 'ended' ? 'outcome' : null;
        this.render();
        break;
      case 'close-outcome':
        this.modal = null;
        this.render();
        break;
      case 'clear-save':
        clearSave();
        this.toast(label(l('Saved situation cleared.', 'وضعیت ذخیره‌شده پاک شد.'), this.lang));
        this.render();
        break;
      default:
        break;
    }
  }

  private togglePriority(id: ObjectiveId): void {
    if (!['security', 'governance', 'economy', 'diplomacy', 'crisis'].includes(id)) return;
    if (this.priorities.includes(id)) {
      this.priorities = this.priorities.filter((priority) => priority !== id);
    } else if (this.priorities.length < 2) {
      this.priorities = [...this.priorities, id];
    } else {
      this.priorities = [this.priorities[1]!, id];
    }
    this.render();
  }

  private start(mode: 'campaign' | 'sandbox'): void {
    if (this.priorities.length !== 2) {
      this.toast(label(l('Choose exactly two national priorities.', 'دقیقاً دو اولویت ملی انتخاب کنید.'), this.lang));
      return;
    }
    this.state = createInitialState(mode, mode === 'sandbox' ? this.intensity : 'flashpoint', Math.floor(Date.now() % 900000) + 1000, {
      player: this.player,
      campaign: this.campaignId,
      priorities: this.priorities,
      custom: mode === 'sandbox' && this.customEnabled ? this.custom : undefined,
    });
    this.modal = null;
    this.department = 'security';
    this.save(true);
    this.render();
  }

  private loadSaved(): void {
    const state = loadState();
    if (!state) {
      this.toast(label(l('No saved situation found.', 'وضعیت ذخیره‌شده‌ای پیدا نشد.'), this.lang));
      return;
    }
    this.state = state;
    this.modal = state.phase === 'ended' ? 'outcome' : null;
    this.render();
  }

  private exportReplay(): void {
    if (!this.state) return;
    try {
      const payload = JSON.stringify(createReplay(this.state), null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `chokepoint-national-${this.state.campaign}-week-${this.state.turn}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.toast(label(LABELS.replayExported, this.lang));
    } catch {
      this.toast(label(LABELS.replayFailed, this.lang));
    }
  }

  private importReplay(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      file
        .text()
        .then((raw) => {
          const parsed = JSON.parse(raw) as NationalReplay;
          const result = replaySession(parsed);
          if (!result.ok) {
            this.toast(label(result.error, this.lang));
            return;
          }
          this.state = result.state;
          this.modal = this.state.phase === 'ended' ? 'outcome' : null;
          this.department = 'security';
          this.save(true);
          this.render();
          this.toast(label(LABELS.replayLoaded, this.lang));
        })
        .catch(() => this.toast(label(LABELS.replayFailed, this.lang)));
    });
    input.click();
  }

  private doSave(): void {
    this.save(false);
  }

  private save(silent: boolean): void {
    if (!this.state) return;
    const ok = saveState(this.state);
    if (!silent) this.toast(label(ok ? LABELS.saved : LABELS.saveFailed, this.lang));
  }

  private queue(id: DecisionId): void {
    if (!this.state) return;
    const result = queueDecision(this.state, id);
    if (!result.ok) {
      this.toast(label(result.reason ?? l('Cannot queue that decision.', 'این تصمیم ثبت نمی‌شود.'), this.lang));
      return;
    }
    this.render();
  }

  private adjustDefence(sector: string, delta: number): void {
    if (!['command', 'ports', 'cities'].includes(sector)) return;
    const key = sector as keyof DefenceAllocation;
    const used = this.defenceAllocation.command + this.defenceAllocation.ports + this.defenceAllocation.cities;
    const next = this.defenceAllocation[key] + delta;
    if (next < 0 || (delta > 0 && used >= 3)) return;
    this.defenceAllocation = { ...this.defenceAllocation, [key]: next };
    this.render();
  }

  private runDefence(): void {
    if (!this.state) return;
    const result = resolveDefence(this.state, this.defenceAllocation);
    if (!result.ok) {
      this.toast(label(result.reason ?? l('Could not run the defence plot.', 'اجرای طرح پدافندی ممکن نشد.'), this.lang));
      return;
    }
    this.defenceResult = result;
    this.save(true);
    this.render();
  }

  private resolve(): void {
    if (!this.state || this.state.phase === 'ended') return;
    resolveTurn(this.state);
    this.save(true);
    this.modal = 'report';
    this.render();
  }

  private toast(message: string): void {
    window.clearTimeout(this.toastTimer);
    document.querySelector('.nat-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'nat-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    this.toastTimer = window.setTimeout(() => toast.remove(), 2800);
  }

  private render(): void {
    document.documentElement.lang = this.lang;
    document.documentElement.dir = this.lang === 'fa' ? 'rtl' : 'ltr';
    document.body.classList.toggle('lang-fa', this.lang === 'fa');
    if (!this.state) {
      this.root.innerHTML = this.startHtml();
      return;
    }
    this.root.innerHTML = this.shellHtml(this.state);
    if (this.modal === 'report') this.mountOverlay(this.reportHtml(this.state));
    if (this.modal === 'outcome' && this.state.outcome) this.mountOverlay(this.outcomeHtml(this.state, this.state.outcome));
    if (this.modal === 'defence') this.mountOverlay(this.defenceHtml(this.state));
  }

  private mountOverlay(html: string): void {
    const overlay = document.createElement('div');
    overlay.className = 'nat-overlay';
    overlay.innerHTML = html;
    this.root.appendChild(overlay);
  }

  private startHtml(): string {
    const lang = this.lang;
    const saved = loadState();
    const fa = lang === 'fa';
    const campaignIds = ['hormuz', 'economic-pressure', 'settlement'] as const;
    const priorityIds = ['security', 'governance', 'economy', 'diplomacy', 'crisis'] as const;
    return `
      <main class="nat-start">
        <header class="nat-start-head">
          <div>
            <span class="nat-kicker">${copy('app', lang)} / ${copy('command', lang)}</span>
            <h1>${copy('startTitle', lang)}</h1>
            <p class="nat-lede">${copy('startBlurb', lang)}</p>
          </div>
          <div class="nat-start-actions">
            <button class="nat-ghost" data-act="lang">${copy('language', lang)}</button>
            <button class="nat-ghost" data-act="import-replay">${copy('importReplay', lang)}</button>
            <a class="nat-ghost" href="./index.html">${copy('back', lang)}</a>
          </div>
        </header>
        <div class="nat-start-grid">
          <section class="nat-start-hero">
            ${this.mapSvg(null, lang)}
            <div class="nat-hero-note">
              <span class="nat-accent">${copy('standfirst', lang)}</span>
              <p>${copy('separate', lang)}</p>
            </div>
          </section>
          <section class="nat-start-panel nat-setup">
            <div class="nat-section-head">
              <span class="nat-kicker">${copy('selectMode', lang)}</span>
              <span class="nat-small">${copy('startFootnote', lang)}</span>
            </div>
            <div class="nat-mode-grid">
              <button class="nat-mode ${this.startMode === 'campaign' ? 'active' : ''}" data-act="mode:campaign">
                <span class="nat-mode-mark">01</span>
                <b>${copy('campaign', lang)}</b>
                <small>${copy('campaignCopy', lang)}</small>
                <span class="nat-mode-cta">${this.startMode === 'campaign' ? copy('selected', lang) : copy('chooseCampaign', lang)}</span>
              </button>
              <button class="nat-mode ${this.startMode === 'sandbox' ? 'active' : ''}" data-act="mode:sandbox">
                <span class="nat-mode-mark">∞</span>
                <b>${copy('sandbox', lang)}</b>
                <small>${copy('sandboxCopy', lang)}</small>
                <span class="nat-mode-cta">${this.startMode === 'sandbox' ? copy('selected', lang) : copy('beginSandbox', lang)}</span>
              </button>
            </div>

            <div class="nat-setup-block">
              <span class="nat-kicker">${copy('playAs', lang)}</span>
              <div class="nat-segment">
                ${(['iran', 'usa'] as const)
                  .map(
                    (country) => `<button class="${this.player === country ? 'active' : ''}" data-act="country:${country}">${label(PLAYER_COUNTRIES[country].name, lang)}</button>`,
                  )
                  .join('')}
              </div>
            </div>

            ${
              this.startMode === 'campaign'
                ? `<div class="nat-setup-block">
                    <span class="nat-kicker">${copy('chooseCampaign', lang)}</span>
                    <div class="nat-campaign-list">
                      ${campaignIds
                        .map(
                          (id) => `<button class="nat-campaign-option ${this.campaignId === id ? 'active' : ''}" data-act="campaign:${id}">
                            <b>${label(CAMPAIGNS[id].name, lang)}</b>
                            <small>${label(CAMPAIGNS[id].blurb, lang)}</small>
                            <span>${num(CAMPAIGNS[id].turns, lang)} ${copy('week', lang)} · ${label(PLAYER_COUNTRIES[this.player].short, lang)}</span>
                          </button>`,
                        )
                        .join('')}
                    </div>
                  </div>`
                : `<div class="nat-intensity">
                    <span class="nat-kicker">${copy('sandbox', lang)} · ${copy('crisis', lang)}</span>
                    <div class="nat-segment">
                      ${(['contained', 'flashpoint', 'brink'] as const)
                        .map(
                          (intensity) =>
                            `<button class="${this.intensity === intensity ? 'active' : ''}" data-act="intensity:${intensity}">${copy(intensity, lang)}</button>`,
                        )
                        .join('')}
                    </div>
                    <button class="nat-ghost" data-act="custom">${this.customEnabled ? copy('customOn', lang) : copy('customCrisis', lang)}</button>
                    ${
                      this.customEnabled
                        ? `<p class="nat-small">${copy('customHint', lang)}</p>
                          <div class="nat-custom-grid">
                            ${(
                              [
                                ['military', copy('pressure', lang)],
                                ['economic', copy('economic', lang)],
                                ['accessibility', copy('accessibility', lang)],
                                ['confidence', copy('confidence', lang)],
                                ['stability', copy('stability', lang)],
                              ] as Array<[keyof CustomStart, string]>
                            )
                              .map(
                                ([key, name]) => `<label class="nat-range"><span>${name} <output>${num(this.custom[key], lang)}</output></span><input type="range" min="0" max="100" value="${this.custom[key]}" data-custom="${key}" /></label>`,
                              )
                              .join('')}
                          </div>`
                        : ''
                    }
                  </div>`
            }

            <div class="nat-setup-block">
              <span class="nat-kicker">${copy('choosePriorities', lang)}</span>
              <div class="nat-priority-grid">
                ${priorityIds
                  .map(
                    (id) => `<button class="nat-priority ${this.priorities.includes(id) ? 'active' : ''}" data-act="priority:${id}">
                      <span>${copy(id, lang)}</span><b>${this.priorities.includes(id) ? '✓' : '+'}</b>
                    </button>`,
                  )
                  .join('')}
              </div>
              <span class="nat-small">${copy('priorityHint', lang)}</span>
            </div>

            <button class="nat-primary wide nat-begin" data-act="begin">${copy('begin', lang)} → <span>${label(PLAYER_COUNTRIES[this.player].short, lang)} · ${this.startMode === 'sandbox' ? copy('sandbox', lang) : label(CAMPAIGNS[this.campaignId].short, lang)}</span></button>
            <span class="nat-fine">${copy('beginHint', lang)}</span>

            <div class="nat-save-row">
              ${
                saved
                  ? `<button class="nat-ghost" data-act="continue">${copy('continueSaved', lang)} <span>${copy('startSave', lang)} ${num(saved.turn, lang)}</span></button>`
                  : `<span class="nat-small">${copy('noSave', lang)}</span>`
              }
              ${saved ? `<button class="nat-ghost" data-act="clear-save">${fa ? 'پاک‌کردن ذخیره' : 'Clear save'}</button>` : ''}
            </div>
            <p class="nat-fine">${copy('manifest', lang)}</p>
          </section>
        </div>
      </main>
    `;
  }

  private shellHtml(state: NationalState): string {
    const lang = this.lang;
    const stage = state.escalation.stage;
    const objectivesMet = objectiveCount(state).met;
    const cap = availableCapital(state);
    const decisions = state.decisions.map((id) => DECISION_BY_ID[id]);
    const current = DEPARTMENTS.find((d) => d.id === this.department)!;
    const decisionRows = decisionsFor(state, this.department);
    const date = formatDate(state.date, lang);
    const turnLabel = state.mode === 'campaign' ? `${copy('week', lang)} ${num(state.turn, lang)} ${copy('of', lang)} ${num(state.maxTurns, lang)}` : `${copy('week', lang)} ${num(state.turn, lang)} · ${copy('openEnded', lang)}`;
    return `
      <div class="nat-shell">
        <header class="nat-header">
          <div class="nat-brand">
            <span class="nat-kicker">${copy('app', lang)} / ${copy('command', lang)}</span>
            <h1>${state.mode === 'sandbox' ? copy('sandbox', lang) : label(CAMPAIGNS[state.campaign].short, lang)}</h1>
            <p>${playerCountryName(state, lang)} · ${turnLabel} · ${date}</p>
          </div>
          <div class="nat-head-actions">
            <button class="nat-ghost" data-act="lang">${copy('language', lang)}</button>
            <button class="nat-ghost" data-act="save">${copy('save', lang)}</button>
            <button class="nat-ghost" data-act="export-replay">${copy('exportReplay', lang)}</button>
            <button class="nat-ghost" data-act="import-replay">${copy('importReplay', lang)}</button>
            <button class="nat-ghost" data-act="new">${copy('newSession', lang)}</button>
            <a class="nat-ghost" href="./index.html">${copy('back', lang)}</a>
          </div>
        </header>

        <section class="nat-crisis-strip">
          <div class="nat-stage">
            <span class="nat-kicker">${copy('crisis', lang)} · ${copy('crisisStage', lang)} ${num(stage, lang)}</span>
            <strong>${label(stageName(stage), lang)}</strong>
            <div class="nat-stage-dots">${[1, 2, 3, 4, 5, 6].map((n) => `<i class="${n <= stage ? 'on' : ''} ${n === stage ? 'now' : ''}"></i>`).join('')}</div>
          </div>
          ${this.factor('military', state.escalation.military, lang)}
          ${this.factor('diplomatic', state.escalation.diplomatic, lang)}
          ${this.factor('economic', state.escalation.economic, lang)}
          ${this.factor('domestic', state.escalation.domestic, lang)}
          <div class="nat-capital">
            <span class="nat-kicker">${copy('political', lang)}</span>
            <strong>${num(Math.max(0, cap), lang)}</strong>
            <small>${copy('actionPoints', lang)}</small>
          </div>
        </section>

        <div class="nat-layout">
          <nav class="nat-rail" aria-label="${label(l('Government departments', 'وزارت‌ها'), lang)}">
            ${DEPARTMENTS.map(
              (dept) => `<button class="${this.department === dept.id ? 'active' : ''}" data-act="dept:${dept.id}">
                <span class="nat-rail-icon">${dept.glyph}</span>
                <span>${label(dept.short, lang)}</span>
              </button>`,
            ).join('')}
          </nav>

          <main class="nat-main">
            <section class="nat-overview">
              <div class="nat-section-head">
                <div><span class="nat-kicker">${copy('objectives', lang)}</span><b>${num(objectivesMet, lang)} / ${num(objectives(state).length, lang)} ${copy('objectiveMet', lang).toLowerCase()}</b></div>
                <span class="nat-small">${copy('decisionsLimit', lang)}</span>
              </div>
              <div class="nat-objective-grid">
                ${objectives(state)
                  .map(
                    (row) => `<article class="nat-objective ${row.met ? 'met' : ''} ${row.priority ? 'priority' : ''}">
                      <div class="nat-objective-top"><span>${label(row.label, lang)}${row.priority ? ` <em>${copy('selected', lang)}</em>` : ''}</span><b>${row.met ? '✓' : '—'}</b></div>
                      <p>${label(row.detail, lang)}</p>
                      ${bar(row.value)}
                      <small>${num(row.value, lang)} / ${num(row.target, lang)} · ${row.met ? copy('objectiveMet', lang) : copy('objectiveRisk', lang)}</small>
                    </article>`,
                  )
                  .join('')}
              </div>

              <div class="nat-ledger-grid">
                ${this.ledger(copy('economy', lang), [
                  [copy('reserves', lang), money(state.economy.reserves, lang), state.economy.reserves * 2.4],
                  [copy('inflation', lang), pct(state.economy.inflation, lang), 100 - state.economy.inflation],
                  [copy('currency', lang), pct(state.economy.currency, lang), state.economy.currency],
                  [copy('publicPressure', lang), pct(state.economy.publicPressure, lang), 100 - state.economy.publicPressure],
                ])}
                ${this.ledger(copy('government', lang), [
                  [copy('stability', lang), pct(state.government.stability, lang), state.government.stability],
                  [copy('legitimacy', lang), pct(state.government.legitimacy, lang), state.government.legitimacy],
                  [copy('confidence', lang), pct(state.government.confidence, lang), state.government.confidence],
                  [copy('socialTension', lang), pct(state.government.socialTension, lang), 100 - state.government.socialTension],
                ])}
                ${this.ledger(copy('security', lang), [
                  [copy('readiness', lang), pct(state.security.readiness, lang), state.security.readiness],
                  [copy('defence', lang), pct(state.security.defence, lang), state.security.defence],
                  [copy('influence', lang), pct(state.diplomacy.influence, lang), state.diplomacy.influence],
                  [copy('talks', lang), pct(state.diplomacy.talks, lang), state.diplomacy.talks],
                ])}
              </div>

              <section class="nat-latest">
                <div class="nat-section-head">
                  <span class="nat-kicker">${copy('latest', lang)}</span>
                  <button class="nat-text-button" data-act="dept:intelligence">${copy('intel', lang)} ◈</button>
                </div>
                ${state.report ? this.reportSummary(state, lang) : `<p class="nat-muted">${copy('noReport', lang)}</p>`}
              </section>
            </section>

            <aside class="nat-map-panel">
              <div class="nat-section-head">
                <div><span class="nat-kicker">${copy('map', lang)}</span><span class="nat-small">${copy('schematic', lang)}</span></div>
                <div class="nat-layers">
                  ${(['shipping', 'energy', 'diplomacy', 'political', 'military', 'intelligence'] as const)
                    .map(
                      (layer) => `<button class="${this.mapLayer === layer ? 'active' : ''}" data-act="layer:${layer}">${copy(layer === 'intelligence' ? 'intel' : layer === 'political' ? 'politics' : layer, lang)}</button>`,
                    )
                    .join('')}
                </div>
              </div>
              ${this.mapSvg(state, lang)}
              <div class="nat-map-metrics">
                ${this.simpleMetric(copy('routeAccess', lang), pct(state.shipping.accessibility, lang), state.shipping.accessibility)}
                ${this.simpleMetric(copy('marketConfidence', lang), pct(state.shipping.confidence, lang), state.shipping.confidence)}
                ${this.simpleMetric(copy('insurance', lang), pct(state.shipping.insurance, lang), 100 - state.shipping.insurance)}
                ${this.simpleMetric(copy('oil', lang), `$${num(state.shipping.oilPrice, lang)}`, 100 - Math.min(100, state.shipping.oilPrice - 60))}
              </div>
              <div class="nat-node-card">
                <span class="nat-kicker">${copy('node', lang)}</span>
                <b>${label(NODES.find((node) => node.id === this.selectedNode)?.name ?? NODES[3]!.name, lang)}</b>
                <p>${label(NODES.find((node) => node.id === this.selectedNode)?.detail ?? NODES[3]!.detail, lang)}</p>
              </div>
            </aside>
          </main>
        </div>

        <section class="nat-department">
          <div class="nat-department-head">
            <div>
              <span class="nat-kicker">${label(current.name, lang)}</span>
              <h2>${label(current.short, lang)} · ${copy('decisions', lang)}</h2>
            </div>
                          <div class="nat-dept-stats">${this.departmentStats(state, this.department, lang)}</div>
              ${this.department === 'defence' ? `<button class="nat-ghost" data-act="tactical" ${canRunDefence(state).ok ? '' : 'disabled'}>${copy('defencePlot', lang)}</button>` : ''}
            </div>
          ${this.department === 'intelligence' ? this.intelHtml(state, lang) : ''}
          <div class="nat-decision-grid">
            ${decisionRows.length === 0 ? `<p class="nat-muted">${lang === 'fa' ? 'همه تصمیم‌های این وزارت در این هفته ثبت شده‌اند.' : 'All of this department’s decisions are already queued this week.'}</p>` : ''}
            ${decisionRows.map((decision) => this.decisionCard(state, decision.id, lang)).join('')}
          </div>
        </section>

        <footer class="nat-command">
          <div class="nat-queue">
            <span class="nat-kicker">${copy('queued', lang)} · ${num(decisions.length, lang)} / ${num(state.actionPoints, lang)}</span>
            <div class="nat-queue-chips">
              ${decisions.length === 0 ? `<span class="nat-muted">${copy('noDecisions', lang)}</span>` : decisions.map((d) => `<button class="nat-chip" data-act="unqueue:${d.id}">${label(d.title, lang)} <b>×</b></button>`).join('')}
            </div>
          </div>
          <div class="nat-command-right">
            <span class="nat-capital-line">${num(decisionCost(state), lang)} / ${num(state.politicalCapital, lang)} ${copy('political', lang)}</span>
            <button class="nat-primary" data-act="resolve" ${state.phase === 'ended' ? 'disabled' : ''}>${copy('next', lang)} <span>→</span></button>
          </div>
        </footer>
      </div>
    `;
  }

  private factor(id: 'military' | 'diplomatic' | 'economic' | 'domestic', value: number, lang: Lang): string {
    return `<div class="nat-factor">
      <div><span>${copy(id, lang)}</span><b>${num(value, lang)}</b></div>
      ${bar(value, true)}
    </div>`;
  }

  private ledger(title: string, rows: Array<[string, string, number]>): string {
    return `<article class="nat-ledger">
      <h3>${title}</h3>
      ${rows
        .map(
          ([name, value, tone]) => `<div class="nat-ledger-row">
            <span>${name}</span><b class="${toneClass(tone)}">${value}</b>
            ${bar(tone)}
          </div>`,
        )
        .join('')}
    </article>`;
  }

  private simpleMetric(name: string, value: string, tone: number): string {
    return `<div class="nat-simple-metric"><span>${name}</span><b>${value}</b><i class="${toneClass(tone)}"></i></div>`;
  }

  private mapSvg(state: NationalState | null, lang: Lang): string {
    const shipping = state?.shipping;
    const layer = this.mapLayer;
    const access = shipping?.accessibility ?? 72;
    const routeTone = access < 35 ? 'bad' : access < 58 ? 'warn' : 'good';
    const nodes = NODES.map((node) => {
      const selected = state && node.id === this.selectedNode;
      const anchorEnd = node.id === 'hormuz' || node.x > 540;
      return `<g class="nat-node ${selected ? 'selected' : ''} ${node.id === 'hormuz' ? 'chokepoint' : ''}" data-act="node:${node.id}" role="button" tabindex="0" aria-label="${label(node.name, lang)}">
        <circle cx="${node.x}" cy="${node.y}" r="${node.id === 'hormuz' ? 11 : 7}" />
        <circle class="nat-node-ring" cx="${node.x}" cy="${node.y}" r="${node.id === 'hormuz' ? 19 : 13}" />
        <text x="${anchorEnd ? node.x - 12 : node.x + 12}" y="${node.y + 4}" text-anchor="${anchorEnd ? 'end' : 'start'}">${label(node.name, lang)}</text>
      </g>`;
    }).join('');
    const layerBadge =
      layer === 'energy'
        ? `$${num(shipping?.oilPrice ?? 91, lang)} · ${pct(shipping?.flow ?? 41, lang)}`
        : layer === 'diplomacy'
          ? `${copy('talks', lang)} ${pct(shipping ? state!.diplomacy.talks : 18, lang)} · ${copy('mediation', lang)} ${pct(shipping ? state!.diplomacy.mediation : 10, lang)}`
          : layer === 'political'
            ? `${copy('legitimacy', lang)} ${pct(state?.government.legitimacy ?? 58, lang)} · ${copy('stability', lang)} ${pct(state?.government.stability ?? 61, lang)}`
            : layer === 'military'
              ? `${copy('readiness', lang)} ${pct(state?.security.readiness ?? 58, lang)} · ${copy('defence', lang)} ${pct(state?.security.defence ?? 55, lang)}`
              : layer === 'intelligence'
                ? `${copy('exposure', lang)} ${pct(state?.intelligence.exposure ?? 18, lang)} · ${copy('deception', lang)} ${pct(state?.intelligence.deception ?? 0, lang)}`
                : `${copy('routeAccess', lang)} ${pct(access, lang)} · ${copy('marketConfidence', lang)} ${pct(shipping?.confidence ?? 49, lang)}`;
    return `<div class="nat-map-wrap nat-map-${layer}">
      <svg class="nat-map-svg" viewBox="0 0 640 400" role="img" aria-label="${copy('map', lang)}">
        <defs>
          <radialGradient id="nat-sea" cx="55%" cy="50%" r="70%">
            <stop offset="0%" stop-color="#16313c" />
            <stop offset="100%" stop-color="#081117" />
          </radialGradient>
          <linearGradient id="nat-land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1c292c" />
            <stop offset="100%" stop-color="#111b1e" />
          </linearGradient>
          <filter id="nat-glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="640" height="400" fill="url(#nat-sea)" />
        <path class="nat-grid" d="M0 80H640M0 160H640M0 240H640M0 320H640M100 0V400M200 0V400M300 0V400M400 0V400M500 0V400M600 0V400" />
        <path class="nat-land" d="M0 0H640V126C598 132 558 151 520 168C485 184 452 181 424 203L392 207L354 185L300 171L248 156L188 126L130 112L0 118Z" />
        <path class="nat-land" d="M0 400V228C78 236 151 244 214 248C281 252 329 269 365 291C408 317 483 334 560 330L640 318V400Z" />
        <path class="nat-coast" d="M0 118L130 112L188 126L248 156L300 171L354 185L392 207L424 203C452 181 485 184 520 168C558 151 598 132 640 126" />
        <path class="nat-coast" d="M0 228C78 236 151 244 214 248C281 252 329 269 365 291C408 317 483 334 560 330L640 318" />
        <path class="nat-route route-${routeTone}" d="M144 166 C230 188 300 183 350 198 C400 213 440 211 474 229 C515 251 550 262 596 281" />
        <path class="nat-route-echo route-${routeTone}" d="M144 166 C230 188 300 183 350 198 C400 213 440 211 474 229 C515 251 550 262 596 281" />
        <circle class="nat-route-pulse" cx="474" cy="229" r="18" />
        <text class="nat-map-water" x="205" y="222">${lang === 'fa' ? 'خلیج فارس' : 'PERSIAN GULF'}</text>
        <text class="nat-map-water" x="530" y="250">${lang === 'fa' ? 'دریای عمان' : 'GULF OF OMAN'}</text>
        <text class="nat-map-land" x="74" y="66">${lang === 'fa' ? 'ایران' : 'IRAN'}</text>
        <text class="nat-map-land" x="192" y="352">${lang === 'fa' ? 'عربستان' : 'ARABIA'}</text>
        ${nodes}
      </svg>
      <span class="nat-map-badge">${layerBadge}</span>
    </div>`;
  }

  private departmentStats(state: NationalState, department: DepartmentId, lang: Lang): string {
    const rows: Record<DepartmentId, Array<[string, string]>> = {
      security: [
        [copy('crisis', lang), pct(state.escalation.stage * 16.6, lang)],
        [copy('talks', lang), pct(state.diplomacy.talks, lang)],
        [copy('influence', lang), pct(state.diplomacy.influence, lang)],
      ],
      treasury: [
        [copy('reserves', lang), money(state.economy.reserves, lang)],
        [copy('inflation', lang), pct(state.economy.inflation, lang)],
        [copy('fiscal', lang), pct(state.economy.fiscal, lang)],
      ],
      foreign: [
        [copy('talks', lang), pct(state.diplomacy.talks, lang)],
        [state.player === 'iran' ? copy('relations', lang) : copy('iranRelations', lang), num(adversaryRelation(state), lang)],
        [copy('sanctionsRelief', lang), pct(state.diplomacy.sanctionsRelief, lang)],
      ],
      defence: [
        [copy('readiness', lang), pct(state.security.readiness, lang)],
        [copy('defence', lang), pct(state.security.defence, lang)],
        [copy('strategic', lang), pct(state.security.strategic, lang)],
      ],
      intelligence: [
        [copy('exposure', lang), pct(state.intelligence.exposure, lang)],
        [copy('deception', lang), pct(state.intelligence.deception, lang)],
        [copy('assessmentConfidence', lang), pct(state.intelligence.assessments[0]?.confidence ?? 0, lang)],
      ],
      interior: [
        [copy('confidence', lang), pct(state.government.confidence, lang)],
        [copy('stability', lang), pct(state.government.stability, lang)],
        [copy('socialTension', lang), pct(state.government.socialTension, lang)],
      ],
    };
    return rows[department].map(([name, value]) => `<span><small>${name}</small><b>${value}</b></span>`).join('');
  }

  private intelHtml(state: NationalState, lang: Lang): string {
    return `<div class="nat-intel-grid">
      ${state.intelligence.assessments
        .map(
          (assessment) => `<article class="nat-assessment">
            <div class="nat-assessment-head"><b>${label(assessment.title, lang)}</b><span class="${toneClass(assessment.confidence)}">${pct(assessment.confidence, lang)}</span></div>
            <p>${label(assessment.assessment, lang)}</p>
            ${bar(assessment.confidence)}
            <div class="nat-intel-meta">
              <span>${copy('source', lang)} · ${label(assessment.source, lang)}</span>
              <span>${copy('reliability', lang)} · ${label(assessment.reliability, lang)}</span>
              <span>${copy('age', lang)} · ${fmtAssessmentAge(assessment.age, lang)}</span>
              <span>${copy('corroboration', lang)} · ${label(assessment.corroboration, lang)}</span>
              <span>${copy('deceptionPossible', lang)} · ${label(assessment.deception, lang)}</span>
            </div>
          </article>`,
        )
        .join('')}
    </div>`;
  }

  private decisionCard(state: NationalState, id: DecisionId, lang: Lang): string {
    const decision = DECISION_BY_ID[id];
    const selected = state.decisions.includes(id);
    const check = canQueue(state, id);
    const disabled = !selected && !check.ok;
    const costs = [`${num(decision.cost, lang)} ${copy('political', lang)}`];
    if (decision.cooldown) costs.push(`${num(decision.cooldown, lang)} ${copy('cooldown', lang)}`);
    return `<article class="nat-decision ${selected ? 'selected' : ''}">
      <div class="nat-decision-top">
        <span class="nat-kicker">${label(DEPARTMENTS.find((d) => d.id === decision.department)!.short, lang)}</span>
        <span class="nat-cost">${costs.join(' · ')}</span>
      </div>
      <h3>${label(decision.title, lang)}</h3>
      <p>${label(decision.description, lang)}</p>
      <div class="nat-effects">${describeEffects(decision.effects, lang, state.player).map((effect) => `<span>${effect}</span>`).join('')}</div>
      <div class="nat-decision-foot">
        <span class="nat-small">${selected ? copy('queued', lang) : check.ok ? copy('queue', lang) : label(check.reason ?? l('Unavailable', 'ناموجود'), lang)}</span>
        ${
          selected
            ? `<button class="nat-chip" data-act="unqueue:${id}">${copy('remove', lang)} ×</button>`
            : `<button class="nat-secondary" data-act="queue:${id}" ${disabled ? 'disabled' : ''}>${copy('queue', lang)}</button>`
        }
      </div>
    </article>`;
  }

  private reportSummary(state: NationalState, lang: Lang): string {
    const report = state.report!;
    return `<div class="nat-report-summary">
      <b>${label(report.headline, lang)}</b>
      <div class="nat-report-lines">${report.lines.slice(0, 4).map((line) => `<p class="tone-${line.tone}"><i></i>${label(line.text, lang)}</p>`).join('')}</div>
    </div>`;
  }

  private reportHtml(state: NationalState): string {
    const report = state.report!;
    const lang = this.lang;
    const met = objectiveCount(state);
    return `<article class="nat-modal nat-report-modal" role="dialog" aria-modal="true" aria-label="${copy('report', lang)}">
      <header>
        <div><span class="nat-kicker">${copy('week', lang)} ${num(report.turn, lang)} · ${copy('report', lang).toUpperCase()}</span><h2>${label(report.headline, lang)}</h2></div>
        <button class="nat-close" data-act="close-report" aria-label="${copy('close', lang)}">✕</button>
      </header>
      <div class="nat-modal-body">
        <span class="nat-kicker">${copy('reportLead', lang)}</span>
        <div class="nat-report-lines">${report.lines.map((line) => `<p class="tone-${line.tone}"><i></i>${label(line.text, lang)}</p>`).join('') || `<p class="nat-muted">${lang === 'fa' ? 'هیچ تغییر بزرگی ثبت نشد.' : 'No major change was recorded.'}</p>`}</div>
        <div class="nat-report-objectives">
          <span class="nat-kicker">${copy('objectives', lang)}</span>
          <b>${num(met.met, lang)} / ${num(met.total, lang)}</b>
          <span class="nat-small">${copy('objectiveMet', lang)}</span>
        </div>
        <div class="nat-modal-actions"><button class="nat-primary" data-act="close-report">${copy('continue', lang)} →</button></div>
      </div>
    </article>`;
  }

  private defenceHtml(state: NationalState): string {
    const lang = this.lang;
    const used = this.defenceAllocation.command + this.defenceAllocation.ports + this.defenceAllocation.cities;
    const sectors: Array<{ id: keyof DefenceAllocation; label: string }> = [
      { id: 'command', label: copy('commandSector', lang) },
      { id: 'ports', label: copy('ports', lang) },
      { id: 'cities', label: copy('cities', lang) },
    ];
    return `<article class="nat-modal nat-defence-modal" role="dialog" aria-modal="true" aria-label="${copy('defencePlot', lang)}">
      <header>
        <div><span class="nat-kicker">${copy('defence', lang).toUpperCase()} · ${copy('week', lang)} ${num(state.turn, lang)}</span><h2>${copy('defencePlot', lang)}</h2></div>
        <button class="nat-close" data-act="close-defence" aria-label="${copy('close', lang)}">✕</button>
      </header>
      <div class="nat-modal-body">
        ${
          this.defenceResult
            ? `<div class="nat-defence-result">
                <span class="nat-kicker">${copy('report', lang)}</span>
                <b class="${toneClass(this.defenceResult.score)}">${num(this.defenceResult.score, lang)}%</b>
                <p>${this.defenceResult.lines.map((line) => label(line, lang)).join(' ')}</p>
                <div class="nat-modal-actions"><button class="nat-primary" data-act="close-defence">${copy('continue', lang)} →</button></div>
              </div>`
            : `<p class="nat-muted">${copy('defenceIntro', lang)}</p>
              <div class="nat-defence-grid">
                ${sectors
                  .map(
                    (sector) => `<div class="nat-sector">
                      <span class="nat-kicker">${sector.label}</span>
                      <div class="nat-sector-strength">${'▲'.repeat(this.defenceAllocation[sector.id])}${'·'.repeat(3 - this.defenceAllocation[sector.id])}</div>
                      <div class="nat-stepper">
                        <button class="nat-chip" data-act="def-remove:${sector.id}" aria-label="Remove">−</button>
                        <b>${num(this.defenceAllocation[sector.id], lang)}</b>
                        <button class="nat-chip" data-act="def-add:${sector.id}" aria-label="Add">+</button>
                      </div>
                    </div>`,
                  )
                  .join('')}
              </div>
              <div class="nat-defence-foot">
                <span class="nat-small">${num(3 - used, lang)} ${copy('availableBatteries', lang)}</span>
                <button class="nat-primary" data-act="def-resolve" ${used === 3 ? '' : 'disabled'}>${copy('intercept', lang)} →</button>
              </div>`
        }
      </div>
    </article>`;
  }

  private outcomeHtml(state: NationalState, outcome: Outcome): string {
    const lang = this.lang;
    const scores = score(state);
    const rows: Array<[string, number]> = [
      [copy('securityAxis', lang), scores.security ?? 0],
      [copy('governanceAxis', lang), scores.governance ?? 0],
      [copy('economyAxis', lang), scores.economy ?? 0],
      [copy('diplomacyAxis', lang), scores.diplomacy ?? 0],
      [copy('overallAxis', lang), scores.overall ?? 0],
    ];
    const verdict = outcome.status === 'won' ? copy('outcome', lang).toUpperCase() : outcome.verdict.toUpperCase();
    return `<article class="nat-modal nat-outcome-modal ${outcome.status}" role="dialog" aria-modal="true" aria-label="${copy('outcome', lang)}">
      <header>
        <div><span class="nat-kicker">${verdict} · ${copy('week', lang)} ${num(state.turn, lang)}</span><h2>${label(outcome.title, lang)}</h2></div>
        <button class="nat-close" data-act="close-outcome" aria-label="${copy('close', lang)}">✕</button>
      </header>
      <div class="nat-modal-body">
        <p class="nat-outcome-text">${label(outcome.text, lang)}</p>
        <div class="nat-outcome-grid">${rows.map(([name, value]) => `<div><span>${name}</span>${bar(value)}<b>${num(value, lang)}</b></div>`).join('')}</div>
        <div class="nat-modal-actions">
          <button class="nat-primary" data-act="new">${copy('restart', lang)} →</button>
          <button class="nat-ghost" data-act="close-outcome">${copy('inspect', lang)}</button>
        </div>
      </div>
    </article>`;
  }
}

