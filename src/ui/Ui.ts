/**
 * DOM UI layer. Sits above the Phaser canvas: crisp text, 44px tap targets, and
 * every number the player needs to reason about the political constraints.
 *
 * The interface is bilingual (English / Persian). All chrome goes through
 * `t()`; map nodes and units use their localised data fields.
 */
import { strikeTargetsFor, type StrikeTarget } from '../combat/targets';
import { FACTION_COLORS } from '../core/config';
import { ISRAEL_AIRLIFT, REINFORCEMENTS, effectiveArrival } from '../core/engine';
import { ARSENAL_UNCERTAINTY_PCT, arsenalRows, deliveryClassFor } from '../core/inventory';
import { game, SCENARIOS, type Game, type InteractionMode } from '../core/Game';
import type { FactionId, Order, ResolveEvent, UnitInstance } from '../core/types';
import { unitType } from '../core/world';
import {
  getLang,
  localEffect,
  localName,
  onLangChange,
  setLang,
  t,
  type Lang,
  type StringKey,
} from '../i18n';
import { faLog, faOutcome } from '../i18n/log';
import { TERRAIN } from '../map/terrain';
import { bandLabel, nodeIntegrityEstimate, unitStrengthEstimate } from './fog';
import { informationState } from '../core/intel';
import { majorBaseState } from '../politics/politics';
import { domesticCfg } from '../politics/domestic';
import { escalationCfg } from '../politics/escalation';
import { ROE_POSTURES, roeCfg } from '../politics/roe';
import { initiativeCfg } from '../politics/initiative';
import { talksCfg } from '../politics/talks';
import { victoryPaths } from '../politics/victory';
import { buildObjectives, previewOrderImpact, type ObjectiveRow } from './objectives';
import { buildTurnReview, reportKey } from './review';
import { factionLabel, unitLabel } from './labels';
import { deleteSave, downloadText, exportReplay, listSaves, SLOTS, type SlotId } from '../services/save';
import { Minimap } from './Minimap';
import { bus, focusHex, zoomBy } from './bus';
import { filterNodes, NAV_KINDS, nextOwnUid, nextThreatUid, nodeCatalog, type NavEntry, type NavKind } from './nav';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector(selector) as T;

const navKindKey = (kind: string): StringKey => `nav.kind.${kind}` as StringKey;

const CATEGORY_LABELS: Record<string, string> = {
  air: 'AIR',
  ground: 'GROUND',
  naval: 'NAVAL',
  defense: 'DEFENCE',
  missile: 'MISSILE',
  drone: 'DRONE',
  production: 'PRODUCTION',
  specops: 'SPECIAL OPS',
  cyber: 'CYBER',
};

const CATEGORY_FA: Record<string, string> = {
  air: 'هوایی',
  ground: 'زمینی',
  naval: 'دریایی',
  defense: 'پدافند',
  missile: 'موشک',
  drone: 'پهپاد',
  production: 'تولید',
  specops: 'نیروی ویژه',
  cyber: 'سایبری',
};

const KIND_FA: Record<string, string> = {
  airbase: 'پایگاه هوایی',
  naval: 'پایگاه دریایی',
  chokepoint: 'گلوگاه',
  oil: 'نفت',
  urban: 'شهری',
  nuclear: 'هسته‌ای',
  'missile-industry': 'صنایع موشکی',
  port: 'بندر',
};

/** Facility taxonomy labels (Phase 1a): what the site does, not what it looks like. */
const FACILITY_LABELS: Record<string, { en: string; fa: string }> = {
  'nuclear-enrichment': { en: 'Enrichment', fa: 'غنی‌سازی' },
  'nuclear-conversion': { en: 'Conversion', fa: 'تبدیل' },
  'nuclear-storage': { en: 'Nuclear storage', fa: 'انبار هسته‌ای' },
  'missile-production': { en: 'Missile production', fa: 'تولید موشک' },
  'drone-production': { en: 'Drone production', fa: 'تولید پهپاد' },
  'defence-industry': { en: 'Defence industry', fa: 'صنایع دفاعی' },
  'weapons-storage': { en: 'Weapons storage', fa: 'انبار سلاح' },
  command: { en: 'Command', fa: 'فرماندهی' },
  radar: { en: 'Radar', fa: 'رادار' },
  'naval-facility': { en: 'Naval facility', fa: 'تأسیسات دریایی' },
  'port-logistics': { en: 'Port logistics', fa: 'لجستیک بندری' },
};


const SCENARIO_FA: Record<string, string> = {
  campaign: 'دریای باریک',
  tutorial: 'ضربه نخست',
};

function template(): string {
  const fa = getLang() === 'fa';
  return `
<header class="topbar">
  <button class="icon-btn" data-action="menu" data-tip="${t('tip.menu')}">☰</button>
  <div class="turn-block"><b id="turn-num">1</b><span id="turn-max">/30</span></div>
  <div id="faction-chip" class="faction-chip"></div>
  <div id="gauges" class="gauges"></div>
  <div class="hormuz" data-tip="${t('tip.hormuz')}">
    <span>${t('label.hormuz')}</span>
    <div class="bar"><i id="hormuz-bar"></i></div>
    <b id="hormuz-val">0%</b>
  </div>
  <button class="icon-btn lang-btn" data-action="lang:${fa ? 'en' : 'fa'}" data-tip="${t('tip.lang')}">${fa ? 'EN' : 'فا'}</button>
</header>

<div id="objectives-strip" class="objectives-strip" role="region" aria-label="Objectives"></div>
<div id="impact-preview" class="impact-preview" hidden></div>
<div id="coach" class="coach" hidden></div>
<div id="tutorial-banner" class="tutorial-banner"></div>

<div class="map-controls">
  <button data-action="zoom-in" aria-label="${t('btn.zoomIn')}" data-tip="${t('btn.zoomIn')}">+</button>
  <button data-action="zoom-out" aria-label="${t('btn.zoomOut')}" data-tip="${t('btn.zoomOut')}">−</button>
  <button data-action="recentre" aria-label="${t('btn.recentre')}" data-tip="${t('btn.recentre')}">◎</button>
  <button data-action="forces-cycle" aria-label="${t('btn.myForces')}" data-tip="${t('btn.myForces')}">⚑</button>
  <button data-action="next-threat" aria-label="${t('btn.nextThreat')}" data-tip="${t('btn.nextThreat')}">⚠</button>
  <button data-action="minimap-toggle" aria-label="${t('btn.minimap')}" data-tip="${t('btn.minimap')}">▣</button>
  <button data-action="nav" aria-label="${t('btn.jump')}" data-tip="${t('btn.jump')}">⌖</button>
</div>

<div id="minimap-root" class="minimap-root"></div>

<div id="nav-drawer" class="nav-drawer" role="dialog" aria-label="${t('nav.title')}"></div>

<div class="bottom">
  <div id="order-strip" class="order-strip"></div>
  <div id="sheet" class="sheet"></div>
  <nav class="command-bar">
    <button data-action="panel:forces" data-tip="${t('panel.forces')}">${t('btn.forces')}</button>
    <button data-action="panel:strategic" data-tip="${t('panel.strategic')}">${t('btn.intel')}</button>
    <button data-action="panel:log" data-tip="${t('panel.log')}">${t('btn.log')}</button>
    <button class="primary" data-action="end-turn" id="end-turn">${t('btn.endTurn')}</button>
  </nav>
</div>

<aside id="panel-forces" class="slide-panel left"></aside>
<aside id="panel-strategic" class="slide-panel right"></aside>
<section id="panel-log" class="log-drawer"></section>

<div id="modal" class="modal"></div>

<div id="cinematic" class="cinematic">
  <div class="cin-card">
    <header>
      <span id="cin-title">${t('cin.resolution', { n: 1 })}</span>
      <span class="cin-actions">
        <button data-action="skip-cinematic" id="cin-skip">${t('cin.skip')}</button>
        <button data-action="continue-cinematic" class="cin-x" aria-label="${t('btn.close')}">✕</button>
      </span>
    </header>
    <div id="cin-list" class="cin-list"></div>
    <footer><button class="primary" data-action="continue-cinematic" id="cin-continue">${t('btn.continue')}</button></footer>
  </div>
</div>

<div id="tooltip" class="tooltip"></div>
<div id="toast" class="toast"></div>
`;
}

const TUTORIAL_HINTS: Record<number, StringKey> = {
  1: 'tutorial.1',
  2: 'tutorial.2',
  3: 'tutorial.3',
  4: 'tutorial.4',
  5: 'tutorial.5',
};



export class Ui {
  private root: HTMLElement;
  private game: Game;
  private openPanel: 'forces' | 'strategic' | 'log' | null = null;
  private menuScenario = 'campaign';
  private menuFaction: FactionId = 'usa';
  private toastTimer = 0;
  private tipTimer = 0;
  private tipHideTimer = 0;
  private cinTimer = 0;
  private cinEvents: ResolveEvent[] = [];
  private cinIndex = 0;
  private modalKind: 'menu' | 'outcome' | 'review' | null = null;
  private reviewOpen = false;
  private lastFocused: HTMLElement | null = null;
  private reportCategory: StringKey | null = null;
  private navOpen = false;
  private navQuery = '';
  private navKind: NavKind = 'all';
  private threatVisited: string[] = [];
  private forcesVisited: string[] = [];
  private minimap: Minimap | null = null;
  private coachDismissed = false;

  private get reducedMotion(): boolean {
    try {
      return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  constructor(gameInstance: Game = game) {
    this.game = gameInstance;
    this.root = $('#ui-root');
    this.root.innerHTML = template();
    this.bind();
    this.game.subscribe(() => this.render());
    bus.addEventListener('toast', ((event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone: string }>).detail;
      this.showToast(detail.message, detail.tone);
    }) as EventListener);
    onLangChange(() => this.rebuildShell());
    this.mountMinimap();
    this.bindKeyboard();
    this.render();
    this.showToast(t('toast.ready'), 'info');
    // Land on the campaign menu so a new player picks a scenario and a faction
    // instead of being dropped into a default campaign.
    this.openMenu();
  }

  // ------------------------------------------------------------------ wiring
  private bind(): void {
    this.root.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!target) return;
      this.handle(target.dataset.action ?? '');
    });

    // Tapping the dimmed backdrop dismisses a modal.
    this.root.addEventListener('click', (event) => {
      const modal = event.target as HTMLElement;
      if (modal.id === 'modal') this.closeModal();
    });

    // Bilingual search in the jump drawer re-renders the result list only.
    this.root.addEventListener('input', (event) => {
      const input = event.target as HTMLElement;
      if (input.id !== 'nav-search') return;
      this.navQuery = (input as HTMLInputElement).value;
      const drawer = document.getElementById('nav-drawer');
      if (drawer && this.navOpen) drawer.innerHTML = this.navDrawerHtml();
      const fresh = document.getElementById('nav-search');
      if (fresh) {
        fresh.focus();
        const caret = this.navQuery.length;
        (fresh as HTMLInputElement).setSelectionRange(caret, caret);
      }
    });

    this.root.addEventListener('pointerdown', (event) => {
      const target = (event.target as HTMLElement).closest('[data-tip]') as HTMLElement | null;
      if (!target) return;
      const tip = target.dataset.tip ?? '';
      if (!tip) return;
      window.clearTimeout(this.tipTimer);
      this.tipTimer = window.setTimeout(() => this.showTooltip(tip, event.clientX, event.clientY), 420);
    });
    for (const type of ['pointerup', 'pointermove', 'pointercancel']) {
      this.root.addEventListener(type, () => window.clearTimeout(this.tipTimer));
    }

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if ($('#cinematic')?.classList.contains('active')) this.closeCinematic();
      else this.closeModal();
    });
  }

  /** Rebuild the shell after a language switch, preserving what was open. */
  private rebuildShell(): void {
    window.clearTimeout(this.cinTimer);
    this.root.innerHTML = template();
    this.render();
    if (this.modalKind === 'menu') this.openMenu();
    else if (this.modalKind === 'outcome') this.openOutcome();
  }

  private handle(action: string): void {
    const [verb, a, b] = action.split(':');

    if (verb === 'menu') return this.openMenu();
    if (verb === 'coach-dismiss') {
      this.coachDismissed = true;
      this.renderCoach();
      return;
    }
    if (verb === 'obj-detail' && a) {
      this.showObjectiveDetail(a);
      return;
    }
    if (verb === 'end-turn') return this.openReview();
    if (verb === 'review-back') return this.closeModal();
    if (verb === 'review-resolve') {
      this.reviewOpen = false;
      this.closeModal();
      return this.endTurn();
    }
    if (verb === 'lang') {
      setLang((a === 'fa' ? 'fa' : 'en') as Lang);
      return;
    }
    if (verb === 'zoom-in') return zoomBy(1.25);
    if (verb === 'zoom-out') return zoomBy(0.8);
    if (verb === 'recentre') {
      const hex = this.game.selectedHex ?? this.homeHex();
      if (hex) focusHex(hex);
      return;
    }
    if (verb === 'panel') {
      this.openPanel = this.openPanel === a ? null : (a as typeof this.openPanel);
      return this.render();
    }
    if (verb === 'select') {
      const unit = this.game.snap.units.find((u) => u.uid === a);
      if (!unit) return;
      // The drawer would otherwise cover the unit sheet the player needs next.
      this.openPanel = null;
      if (unit.faction !== this.game.snap.faction) {
        this.game.selectHex(unit.col, unit.row);
        this.showToast(t('toast.enemyUnit'), 'info');
        return;
      }
      this.game.selectUnit(unit.uid);
      focusHex({ col: unit.col, row: unit.row });
      return;
    }
    if (verb === 'clear-selection') return this.game.clearSelection();
    if (verb === 'next-unit') return this.selectNextReadyUnit();
    if (verb === 'mode') {
      const mode = a as InteractionMode;
      if (!this.game.selectedUnit) return this.showToast(t('toast.selectUnitFirst'), 'warn');
      this.game.setMode(mode);
      this.showToast(
        mode === 'move' ? t('sheet.modeMove') : mode === 'strike' ? t('sheet.modeStrike') : t('sheet.modeSpecial'),
        'info',
      );
      return;
    }
    if (verb === 'attack') {
      const unit = this.game.snap.units.find((u) => u.uid === a);
      if (!unit) return;
      const [col, row] = (b ?? '').split(',').map(Number);
      const nodeId = action.split(':')[3] || undefined;
      if (!Number.isFinite(col) || !Number.isFinite(row)) return;
      const result = this.game.queueOrder({ kind: 'strike', unitUid: unit.uid, col: col!, row: row!, nodeId });
      if (!result.ok) {
        this.showToast(result.reason ?? t('toast.invalid'), 'warn');
        return;
      }
      const node = nodeId ? this.game.map.nodeById.get(nodeId) : undefined;
      const label = node ? localName(node) : t('target.hex', { col: col!, row: row! });
      this.showToast(t('toast.strikeQueued', { target: label }), 'good');
      focusHex({ col: col!, row: row! });
      this.game.selectUnit(unit.uid);
      return;
    }
    if (verb === 'hold') {
      const unit = this.game.selectedUnit;
      if (!unit) return;
      const result = this.game.queueOrder({ kind: 'hold', unitUid: unit.uid });
      this.showToast(
        result.ok ? t('toast.hold', { name: unitLabel(unit) }) : (result.reason ?? t('toast.cannotHold')),
        result.ok ? 'good' : 'warn',
      );
      return;
    }
    if (verb === 'cancel-mode') return this.game.setMode('idle');
    if (verb === 'cyber-order') {
      const unit = this.game.selectedUnit;
      if (!unit) return;
      const result = this.game.queueOrder({ kind: 'cyber', unitUid: unit.uid, col: unit.col, row: unit.row });
      this.showToast(result.ok ? t('toast.cyberQueued') : (result.reason ?? t('toast.invalid')), result.ok ? 'good' : 'warn');
      return;
    }
    if (verb === 'remove-order') {
      this.game.removeOrder(Number(a));
      if (this.reviewOpen) this.openReview();
      return;
    }
    if (verb === 'diplomacy' && a) {
      const result = this.game.queueOrder({ kind: 'diplomacy', host: a as FactionId });
      this.showToast(
        result.ok ? t('toast.signalled', { name: factionLabel(a) }) : (result.reason ?? t('toast.invalid')),
        result.ok ? 'good' : 'warn',
      );
      return;
    }
    if (verb === 'reinforce' && a) {
      const result = this.game.queueOrder({ kind: 'reinforce', packageId: a });
      this.showToast(result.ok ? t('toast.reinforce') : (result.reason ?? t('toast.invalid')), result.ok ? 'good' : 'warn');
      return;
    }
    if (verb === 'airlift') {
      const result = this.game.queueOrder({ kind: 'airlift' });
      this.showToast(result.ok ? t('toast.airlift') : (result.reason ?? t('toast.invalid')), result.ok ? 'good' : 'warn');
      return;
    }
    if (verb === 'communicate') {
      const result = this.game.queueOrder({ kind: 'communicate' });
      this.showToast(result.ok ? t('toast.communicate') : (result.reason ?? t('toast.invalid')), result.ok ? 'good' : 'warn');
      return;
    }
    if (verb === 'initiative' && a) {
      const result = this.game.queueOrder({ kind: 'israel-initiative', stance: a as 'approved' | 'constrained' | 'accepted' });
      this.showToast(result.ok ? t('toast.initiative') : (result.reason ?? t('toast.invalid')), result.ok ? 'good' : 'warn');
      return;
    }
    if (verb === 'talks' && a) {
      const result = this.game.queueOrder({ kind: 'talks', stance: a as 'pursue' | 'walk' });
      this.showToast(result.ok ? t('toast.talks') : (result.reason ?? t('toast.invalid')), result.ok ? 'good' : 'warn');
      return;
    }
    if (verb === 'roe' && a) {
      const result = this.game.queueOrder({ kind: 'roe', posture: a as 'constrained' | 'standard' | 'aggressive' });
      this.showToast(result.ok ? t('toast.roe') : (result.reason ?? t('toast.invalid')), result.ok ? 'good' : 'warn');
      return;
    }
    if (verb === 'produce' && a) {
      const result = this.game.queueOrder({ kind: 'produce', unitTypeId: a, count: 1 });
      this.showToast(result.ok ? t('toast.produce') : (result.reason ?? t('toast.invalid')), result.ok ? 'good' : 'warn');
      return;
    }
    if (verb === 'focus-node' && a) {
      const hex = this.game.map.nodeHexOf(a);
      if (hex) {
        focusHex(hex);
        this.game.selectHex(hex.col, hex.row);
      }
      return;
    }
    if (verb === 'nav') return this.toggleNav();
    if (verb === 'nav-kind' && a) {
      this.navKind = a as NavKind;
      this.render();
      return;
    }
    if (verb === 'nav-jump' && a) {
      const catalog = nodeCatalog(this.game.snap, this.game.map);
      const entry = catalog.find((e) => e.id === a);
      if (entry) this.jumpToNode(entry);
      return;
    }
    if (verb === 'forces-cycle') return this.cycleOwnForces();
    if (verb === 'next-threat') return this.jumpToNextThreat();
    if (verb === 'minimap-toggle') return this.toggleMinimap();
    if (verb === 'skip-cinematic') return this.revealAll();
    if (verb === 'continue-cinematic') return this.closeCinematic();
    if (verb === 'close-modal') return this.closeModal();
    if (verb === 'start') {
      const scenario = a ?? this.menuScenario;
      const faction = (b ?? this.menuFaction) as FactionId;
      this.closeModal();
      this.game.start(scenario, faction as never, Math.floor(Math.random() * 900000) + 1000);
      const hex = this.homeHex();
      if (hex) focusHex(hex);
      this.showToast(t('toast.newCampaign'), 'good');
      return;
    }
    if (verb === 'continue') {
      this.closeModal();
      this.loadSlot('auto');
      return;
    }
    if (verb === 'save') return this.saveSlot(a as SlotId);
    if (verb === 'load') return this.loadSlot(a as SlotId);
    if (verb === 'delete') {
      deleteSave(a as SlotId);
      this.openMenu();
      return;
    }
    if (verb === 'export-replay') {
      downloadText(`chokepoint-replay-turn-${this.game.snap.turn}.json`, exportReplay(this.game.snap));
      this.showToast(t('toast.replayExported'), 'good');
      return;
    }
    if (verb === 'scenario') {
      this.menuScenario = a ?? 'campaign';
      this.openMenu();
      return;
    }
    if (verb === 'faction') {
      this.menuFaction = (a ?? 'usa') as FactionId;
      this.openMenu();
      return;
    }
  }

  private mountMinimap(): void {
    const root = document.getElementById('minimap-root');
    if (!root) return;
    this.minimap?.destroy();
    this.minimap = new Minimap(root, this.game);
  }

  /**
   * Phase 5 keyboard support: arrows/WASD pan, +/- zoom, N next unit,
   * T next threat, J jump drawer, M minimap, Escape closes (bound above).
   */
  private bindKeyboard(): void {
    window.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const pan = 110;
      switch (event.key) {
        case 'ArrowLeft':
          bus.dispatchEvent(new CustomEvent('pan', { detail: { dx: -pan, dy: 0 } }));
          break;
        case 'ArrowRight':
          bus.dispatchEvent(new CustomEvent('pan', { detail: { dx: pan, dy: 0 } }));
          break;
        case 'ArrowUp':
          bus.dispatchEvent(new CustomEvent('pan', { detail: { dx: 0, dy: -pan } }));
          break;
        case 'ArrowDown':
          bus.dispatchEvent(new CustomEvent('pan', { detail: { dx: 0, dy: pan } }));
          break;
        case '+':
        case '=':
          zoomBy(1.25);
          break;
        case '-':
          zoomBy(0.8);
          break;
        case 'n':
        case 'N':
          this.selectNextReadyUnit();
          break;
        case 't':
        case 'T':
          this.jumpToNextThreat();
          break;
        case 'j':
        case 'J':
          this.toggleNav();
          break;
        case 'm':
        case 'M':
          this.toggleMinimap();
          break;
        default:
          return;
      }
      event.preventDefault();
    });
  }

  private toggleNav(): void {
    this.navOpen = !this.navOpen;
    this.render();
  }

  private toggleMinimap(): void {
    const root = document.getElementById('minimap-root');
    if (!root) return;
    root.classList.toggle('hidden');
  }

  private jumpToNode(entry: NavEntry): void {
    focusHex({ col: entry.col, row: entry.row });
    this.game.selectHex(entry.col, entry.row);
    this.navOpen = false;
    this.render();
  }

  private jumpToNextThreat(): void {
    const uid = nextThreatUid(this.game.snap, this.threatVisited);
    if (!uid) {
      this.showToast(t('toast.noThreat'), 'info');
      return;
    }
    this.threatVisited = [...this.threatVisited, uid].slice(-24);
    const unit = this.game.snap.units.find((u) => u.uid === uid);
    if (!unit) return;
    focusHex({ col: unit.col, row: unit.row });
    this.game.selectHex(unit.col, unit.row);
  }

  private cycleOwnForces(): void {
    const uid = nextOwnUid(this.game.snap, this.forcesVisited);
    if (!uid) {
      this.showToast(t('toast.nothingNext'), 'warn');
      return;
    }
    this.forcesVisited = [...this.forcesVisited, uid].slice(-48);
    const unit = this.game.snap.units.find((u) => u.uid === uid);
    if (!unit) return;
    focusHex({ col: unit.col, row: unit.row });
    this.game.selectUnit(unit.uid);
  }

  // ------------------------------------------------------------------ render
  render(): void {
    const s = this.game.snap;
    if (!s) return;

    $('#turn-num').textContent = String(s.turn);
    $('#turn-max').textContent = `/${s.maxTurns}`;

    const chip = $('#faction-chip');
    chip.innerHTML = `<i style="background:${FACTION_COLORS[s.faction]}"></i>${shortFaction(s.faction)}`;
    chip.style.borderColor = FACTION_COLORS[s.faction] ?? '#333';

    $('#gauges').innerHTML = this.gaugesHtml();
    this.renderObjectives();
    this.renderImpactPreview();
    this.renderCoach();

    const hormuz = Math.round(s.meters.hormuz);
    const bar = $('#hormuz-bar');
    bar.style.width = `${hormuz}%`;
    bar.style.background = hormuz > 65 ? 'var(--alert)' : hormuz > 40 ? 'var(--warn)' : 'var(--ok)';
    $('#hormuz-val').textContent = `${hormuz}%`;

    const endTurn = $('#end-turn') as HTMLButtonElement;
    endTurn.disabled = s.status !== 'playing';
    endTurn.textContent =
      s.status === 'playing' ? t('btn.endTurn') : s.status === 'won' ? t('btn.victory') : t('btn.defeat');

    $('#order-strip').innerHTML = this.orderStripHtml();
    $('#sheet').innerHTML = this.sheetHtml();
    $('#sheet').classList.toggle('empty', !this.game.selectedUnit && !this.game.selectedHex);
    $('#tutorial-banner').innerHTML = this.tutorialHtml();

    const forces = $('#panel-forces');
    const strategic = $('#panel-strategic');
    const log = $('#panel-log');
    forces.classList.toggle('open', this.openPanel === 'forces');
    strategic.classList.toggle('open', this.openPanel === 'strategic');
    log.classList.toggle('open', this.openPanel === 'log');
    if (this.openPanel === 'forces') forces.innerHTML = this.forcesHtml();
    if (this.openPanel === 'strategic') strategic.innerHTML = this.strategicHtml();
    if (this.openPanel === 'log') {
      log.innerHTML = this.logHtml();
      log.scrollTop = log.scrollHeight;
    }

    const drawer = $('#nav-drawer');
    drawer.classList.toggle('open', this.navOpen);
    if (this.navOpen) drawer.innerHTML = this.navDrawerHtml();
  }

  private navDrawerHtml(): string {
    const catalog = nodeCatalog(this.game.snap, this.game.map);
    const results = filterNodes(catalog, this.navQuery, this.navKind);
    const chips = NAV_KINDS.map(
      (kind) =>
        `<button class="choice ${this.navKind === kind ? 'active' : ''}" data-action="nav-kind:${kind}">${t(navKindKey(kind))}</button>`,
    ).join('');
    const rows = results
      .map(
        (entry) =>
          `<button class="nav-row" data-action="nav-jump:${entry.id}">
            <span class="dot" style="background:${FACTION_COLORS[entry.kind === 'nuclear' ? 'iran' : entry.kind === 'airbase' ? 'usa' : 'neutral']}"></span>
            <span class="f-name">${getLang() === 'fa' ? entry.nameFa : entry.name}<small>${t(navKindKey(entry.kind))}</small></span>
            <span class="f-stat">${t('target.hex', { col: entry.col, row: entry.row })}</span>
          </button>`,
      )
      .join('');
    return `<header class="panel-head"><h3>${t('nav.title')}</h3><button data-action="nav" aria-label="${t('btn.close')}">✕</button></header>
      <div class="panel-body">
        <input id="nav-search" type="search" placeholder="${t('nav.search')}" aria-label="${t('nav.search')}" value="${this.navQuery.replace(/"/g, '&quot;')}">
        <div class="choice-row nav-chips">${chips}</div>
        <div class="nav-results">${rows || `<p class="note">${t('nav.empty')}</p>`}</div>
      </div>`;
  }

  private gaugesHtml(): string {
    const s = this.game.snap;
    const pills: Array<[string, string, string]> = [];
    if (s.faction === 'usa') {
      pills.push([t('gauge.int'), `${Math.round(s.resources.interceptorsUSA)}`, t('tip.intUS')]);
      pills.push([t('gauge.will'), `${Math.round(s.resources.politicalWill)}`, t('tip.willUS')]);
      pills.push([t('gauge.lift'), `${Math.round(s.resources.airlift)}`, t('tip.lift')]);
      pills.push([t('gauge.congress'), `${Math.round(s.domestic?.congress ?? 0)}`, t('tip.congress')]);
      pills.push([t('gauge.econ'), `${Math.round(s.domestic?.economy ?? 0)}`, t('tip.econ')]);
    } else if (s.faction === 'israel') {
      pills.push([t('gauge.int'), `${Math.round(s.resources.interceptorsIsrael)}`, t('tip.intIL')]);
      pills.push([t('gauge.tank'), `${Math.round(s.resources.tankerSorties)}`, t('tip.tank')]);
      pills.push([t('gauge.will'), `${Math.round(s.resources.politicalWill)}`, t('tip.willIL')]);
    } else {
      pills.push([t('gauge.drone'), `${Math.round(s.iran.rounds.drone)}`, t('tip.drone')]);
      pills.push([
        t('gauge.ball'),
        `${Math.round(s.iran.rounds.fateh + s.iran.rounds.khorramshahr + s.iran.rounds.fattah)}`,
        t('tip.ball'),
      ]);
      pills.push([t('gauge.res'), `${Math.round(s.iran.resources)}`, t('tip.res')]);
      pills.push([t('gauge.will'), `${Math.round(s.resources.politicalWill)}`, t('tip.willIran')]);
    }
    return pills
      .map(
        ([label, value, tip]) =>
          `<div class="pill" data-tip="${tip}"><span>${label}</span><b>${value}</b></div>`,
      )
      .join('');
  }

  private tutorialHtml(): string {
    if (this.game.snap.scenarioId !== 'tutorial') return '';
    const key = TUTORIAL_HINTS[this.game.snap.turn];
    const hint = key ? t(key) : t('tutorial.complete');
    return `<div class="tutorial-card"><b>${t('tutorial.tag', { n: this.game.snap.turn })}</b><span>${hint}</span></div>`;
  }

  private orderStripHtml(): string {
    const orders = this.game.snap.orders;
    if (orders.length === 0) return '';
    return `<div class="order-strip-inner">${orders
      .map(
        (order, index) =>
          `<span class="order-chip"><b>${this.describeOrder(order)}</b><button data-action="remove-order:${index}" aria-label="${t('btn.cancel')}">✕</button></span>`,
      )
      .join('')}<span class="order-hint">${t('order.hint')}</span></div>`;
  }

  private describeOrder(order: Order): string {
    const unit = 'unitUid' in order ? this.game.snap.units.find((u) => u.uid === order.unitUid) : undefined;
    const name = unit ? unitLabel(unit) : '';
    const fa = getLang() === 'fa';
    switch (order.kind) {
      case 'move':
        return `${name} → ${order.col},${order.row}`;
      case 'strike': {
        const node = order.nodeId ? this.game.map.nodeById.get(order.nodeId) : undefined;
        return `${name} → ${node ? localName(node) : `${order.col},${order.row}`}`;
      }
      case 'produce':
        return fa
          ? `تولید ۱× ${localName(unitType(order.unitTypeId))}`
          : `Produce 1× ${unitType(order.unitTypeId).name}`;
      case 'diplomacy':
        return fa ? `رایزنی با ${factionLabel(order.host)}` : `Signal ${factionLabel(order.host)}`;
      case 'reinforce':
        return REINFORCEMENTS.find((r) => r.id === order.packageId)?.label ?? (fa ? 'نیروی کمکی' : 'Reinforcement');
      case 'airlift':
        return fa ? 'ترابری به اسرائیل' : 'Airlift to Israel';
      case 'communicate':
        return fa ? 'پیام عمومی' : 'Public address';
      case 'israel-initiative':
        return fa
          ? `دستور اسرائیل: ${order.stance === 'approved' ? 'تأیید' : order.stance === 'constrained' ? 'محدود' : 'پذیرش'}`
          : `Israel directive: ${order.stance}`;
      case 'talks':
        return fa ? (order.stance === 'pursue' ? 'پیگیری مذاکرات' : 'ترک مذاکرات') : order.stance === 'pursue' ? 'Pursue talks' : 'Walk away';
      case 'roe':
        return t(`roe.${order.posture}`);
      case 'special': {
        const nodeId = this.game.map.hexToNode.get(`${order.col},${order.row}`);
        const node = nodeId ? this.game.map.nodeById.get(nodeId) : undefined;
        const where = node ? localName(node) : `${order.col},${order.row}`;
        return fa ? `خرابکاری ${where}` : `Sabotage ${where}`;
      }
      case 'cyber':
        return fa ? 'عملیات واحد 8200' : 'Unit 8200 operation';
      case 'hold':
        return fa ? `${name} در موضع` : `${name} holds`;
      default:
        return fa ? 'فرمان' : 'Order';
    }
  }

  // ------------------------------------------------------------------- sheets
  private sheetHtml(): string {
    const unit = this.game.selectedUnit;
    if (unit) return this.unitCard(unit);
    const hex = this.game.selectedHex;
    if (hex) return this.hexCard(hex.col, hex.row);
    return `<div class="sheet-empty">
      <b>${t('sheet.none.title')}</b>
      <span>${t('sheet.none.hint')}</span>
      <button class="primary wide" data-action="next-unit">${t('btn.selectUnit')}</button>
    </div>`;
  }

  private unitCard(unit: UnitInstance): string {
    const def = unitType(unit.typeId);
    const mode = this.game.selection.mode;
    const tile = this.game.map.hexAt(unit.col, unit.row);
    const node = tile?.nodeId ? this.game.map.nodeById.get(tile.nodeId) : undefined;
    const hostileHost = tile ? this.game.snap.hosts[tile.owner] : undefined;
    const stock = this.iranStockFor(unit);
    const active = this.game.snap.orders.some((o) => 'unitUid' in o && o.unitUid === unit.uid);

    const canStrike =
      def.atk > 0 && def.rng > 0 && def.category !== 'defense' && def.category !== 'production' && def.category !== 'cyber';
    const canMove = def.mov > 0 && def.category !== 'cyber' && def.category !== 'production';
    const targets = canStrike ? this.strikeTargets(unit) : [];

    const actions: string[] = [];
    if (canMove) actions.push(`<button data-action="mode:move" class="${mode === 'move' ? 'active' : ''}">${t('btn.move')}</button>`);
    if (canStrike) {
      actions.push(`<button data-action="mode:strike" class="${mode === 'strike' ? 'active' : ''}">${t('btn.attack')}</button>`);
    }
    if (def.category === 'specops') actions.push(`<button data-action="mode:special">${t('btn.sabotage')}</button>`);
    if (def.id === 'unit8200') actions.push(`<button data-action="cyber-order">${t('btn.cyber')}</button>`);
    actions.push(`<button data-action="hold">${t('btn.hold')}</button>`);
    actions.push(`<button data-action="clear-selection">${t('btn.deselect')}</button>`);

    const hostWarn =
      hostileHost && hostileHost.status !== 'open'
        ? `<div class="warn-line">${t('sheet.hostWarn', {
            host: factionLabel(hostileHost.id),
            status: hostileHost.status === 'closed' ? t('panel.hostClosed') : t('panel.hostRestricted'),
          })}</div>`
        : '';

    return `
      <div class="sheet-head">
        <span class="unit-icon ${def.category}"></span>
        <div class="u-title"><b>${unitLabel(unit)}</b><span>${factionLabel(unit.faction)} · ${categoryLabel(def.category)}${node ? ` · ${localName(node)}` : ''}</span></div>
        <button class="x" data-action="clear-selection" aria-label="${t('btn.close')}">✕</button>
      </div>
      ${this.targetsHtml(unit, targets, active)}
      <div class="stat-row">
        <div class="stat"><span>${t('sheet.atk')}</span><b>${def.atk}</b></div>
        <div class="stat"><span>${t('sheet.def')}</span><b>${def.def}</b></div>
        <div class="stat"><span>${t('sheet.mov')}</span><b>${def.mov}</b></div>
        <div class="stat"><span>${t('sheet.rng')}</span><b>${def.rng}</b></div>
        <div class="stat wide"><span>${t('sheet.status')}</span><b>${Math.round(unit.strength)}%</b></div>
        <div class="stat wide"><span>${this.game.snap.faction === 'iran' ? t('sheet.stock') : t('sheet.munitions')}</span><b>${this.game.snap.faction === 'iran' ? stock : unit.magazine}</b></div>
      </div>
      ${unit.cooldown > 0 ? `<div class="warn-line">${t('sheet.rearming', { n: unit.cooldown })}</div>` : ''}
      ${hostWarn}
      ${active ? `<div class="warn-line">${t('sheet.tasked')}</div>` : ''}
      ${mode !== 'idle' ? `<div class="mode-hint">${mode === 'move' ? t('sheet.modeMove') : mode === 'strike' ? t('sheet.modeStrike') : t('sheet.modeSpecial')} <button data-action="cancel-mode">${t('btn.cancel')}</button></div>` : ''}
      <div class="actions">${actions.join('')}</div>
      <p class="note">${def.note}</p>
    `;
  }

  private targetsHtml(unit: UnitInstance, targets: StrikeTarget[], active: boolean): string {
    if (unitType(unit.typeId).atk <= 0) return '';
    if (unit.magazine <= 0 && this.game.snap.faction !== 'iran') {
      return `<div class="warn-line">${t('sheet.noMunitions')}</div>`;
    }
    if (active) {
      return `<section class="targets queued">
        <h4>${t('sheet.tasked')}</h4>
        <button class="wide" data-action="next-unit">${t('btn.nextUnit')}</button>
      </section>`;
    }
    if (targets.length === 0) {
      return `<section class="targets"><h4>${t('sheet.targets')}</h4><p class="note">${t('sheet.noTargets')}</p></section>`;
    }
    const rows = targets.slice(0, 10).map((target) => {
      const badge = target.buried
        ? `<em class="badge deep">${t('sheet.buried', { n: target.buried })}</em>`
        : target.hardened
          ? `<em class="badge hard">${t('target.hardened')}</em>`
          : '';
      const targetEst = target.nodeId
        ? nodeIntegrityEstimate(this.game.snap, this.game.map, target.nodeId)
        : null;
      const integrityText = targetEst
        ? t('fog.band', { lo: bandLabel(targetEst) })
        : `${Math.round(target.integrity ?? 100)}`;
      const meta = target.units
        ? t('target.metaUnits', { dist: target.dist })
        : t('target.meta', { dist: target.dist, integrity: integrityText });
      return `<button class="target-row" data-action="attack:${unit.uid}:${target.col},${target.row}:${target.nodeId ?? ''}">
        <span class="t-main"><b>${target.label}</b>${badge}</span>
        <span class="t-meta">${meta}</span>
        <span class="t-go">${t('btn.strike')}</span>
      </button>`;
    });
    return `<section class="targets"><h4>${t('sheet.targets')} <span>${targets.length}</span></h4>${rows.join('')}</section>`;
  }

  private hexCard(col: number, row: number): string {
    const tile = this.game.map.hexAt(col, row);
    if (!tile) return '';
    const node = tile.nodeId ? this.game.map.nodeById.get(tile.nodeId) : undefined;
    const terrain = TERRAIN[tile.terrain];
    const units = this.game
      .unitsAt(col, row)
      .filter((u) => u.faction === this.game.snap.faction || u.revealed);
    const fa = getLang() === 'fa';
    const unitChips = units.length
      ? `<div class="hex-units">${units
          .map((u) => {
            const chipEst = unitStrengthEstimate(this.game.snap, u);
            const strengthText = chipEst ? t('fog.band', { lo: bandLabel(chipEst) }) : `${Math.round(u.strength)}%`;
            const intel =
              u.faction === this.game.snap.faction
                ? ''
                : ` · ${t(`intel.state.${informationState(this.game.snap, this.game.snap.faction, u)}`)}`;
            return u.faction === this.game.snap.faction
              ? `<button class="unit-chip ${u.faction}" data-action="select:${u.uid}">${unitLabel(u)} · ${strengthText}</button>`
              : `<span class="unit-chip ${u.faction}" data-tip="${t('tip.fog')}">${unitLabel(u)} · ${strengthText}${intel}</span>`;
          })
          .join('')}</div>`
      : '';

    if (node) {
      const state = this.game.snap.nodes[node.id];
      const integrity = state ? Math.round(state.integrity) : 100;
      // Phase 4: enemy facility integrity shows as a recon-quality estimate.
      const fogEst = nodeIntegrityEstimate(this.game.snap, this.game.map, node.id);
      const integrityText = fogEst ? t('fog.band', { lo: bandLabel(fogEst) }) : `${integrity}%`;
      const integrityBar = fogEst ? Math.round((fogEst.lo + fogEst.hi) / 2) : integrity;
      const buriedWarn = node.buried
        ? `<div class="warn-line">${t('sheet.buried', { n: node.buried })} — ${t('sheet.buriedWarn')}</div>`
        : node.hardened
          ? `<div class="warn-line">${t('sheet.hardenedWarn')}</div>`
          : '';
      return `
        <div class="sheet-head">
          <span class="node-glyph ${node.kind}"></span>
          <div class="u-title"><b>${localName(node)}</b><span>${nodeKindLabel(node.kind)}${node.facility ? ` · ${facilityLabel(node.facility)}` : ''} · ${factionLabel(node.host)}</span></div>
          <button class="x" data-action="clear-selection" aria-label="${t('btn.close')}">✕</button>
        </div>
        <div class="meter-row"${fogEst ? ` data-tip="${t('tip.fog')}"` : ''}><span>${t('sheet.integrity')}</span><div class="bar"><i style="width:${integrityBar}%;background:${integrityBar > 60 ? 'var(--ok)' : integrityBar > 25 ? 'var(--warn)' : 'var(--alert)'}"></i></div><b>${integrityText}</b></div>
        <p class="effect">${localEffect(node)}</p>
        ${fa ? '' : `<p class="detail">${node.detail}${node.personnel ? ` · ${t('sheet.personnel', { n: node.personnel.toLocaleString() })}` : ''}</p>`}
        ${buriedWarn}
        ${unitChips}
        <div class="actions"><button data-action="focus-node:${node.id}">${t('btn.centre')}</button><button data-action="panel:strategic">${t('btn.intel')}</button></div>
      `;
    }

    return `
      <div class="sheet-head">
        <span class="terrain-swatch" style="background:${terrain.color}"></span>
        <div class="u-title"><b>${fa ? terrain.label_fa ?? terrain.label : terrain.label}</b><span>${factionLabel(tile.owner)} · ${t('target.hex', { col, row })}</span></div>
        <button class="x" data-action="clear-selection" aria-label="${t('btn.close')}">✕</button>
      </div>
      <p class="effect">${fa ? terrain.blurb_fa ?? terrain.blurb : terrain.blurb}</p>
      <div class="stat-row">
        <div class="stat"><span>${t('sheet.moveCost')}</span><b>${Number.isFinite(terrain.moveCost) ? terrain.moveCost : t('sheet.sea')}</b></div>
        <div class="stat"><span>${t('sheet.defence')}</span><b>+${Math.round(terrain.defence * 100)}%</b></div>
        <div class="stat wide"><span>${t('sheet.coord')}</span><b>${tile.lon.toFixed(1)}E ${tile.lat.toFixed(1)}N</b></div>
      </div>
      ${unitChips}
    `;
  }

  // ------------------------------------------------------------------ panels
  private forcesHtml(): string {
    const units = this.game.snap.units.filter((u) => u.faction === this.game.snap.faction);
    const byType = new Map<string, UnitInstance[]>();
    for (const unit of units) {
      const list = byType.get(unit.typeId) ?? [];
      list.push(unit);
      byType.set(unit.typeId, list);
    }
    const rows = [...byType.entries()]
      .sort((a, b) => unitType(b[0]).category.localeCompare(unitType(a[0]).category))
      .map(([typeId, list]) => {
        const def = unitType(typeId);
        return `<section class="force-group">
          <h4>${localName(def)} <span>${list.length}×</span></h4>
          ${list
            .map(
              (unit) => `<button class="force-row" data-action="select:${unit.uid}">
                <span class="dot" style="background:${FACTION_COLORS[unit.faction]}"></span>
                <span class="f-name">${t('target.hex', { col: unit.col, row: unit.row })}</span>
                <span class="f-stat">${Math.round(unit.strength)}%</span>
                <span class="f-stat">${def.category === 'defense' ? 'DEF' : `${unit.magazine}`}</span>
              </button>`,
            )
            .join('')}
        </section>`;
      })
      .join('');
    return `<header class="panel-head"><h3>${t('panel.forces')}</h3><button data-action="panel:forces" aria-label="${t('btn.close')}">✕</button></header><div class="panel-body">${rows}</div>`;
  }

  private strategicHtml(): string {
    const s = this.game.snap;
    const bases = majorBaseState(s, this.game.map);
    const hostRows = Object.values(s.hosts)
      .filter((h) => ['qatar', 'uae', 'kuwait', 'bahrain', 'saudi', 'turkey'].includes(h.id))
      .map((host) => {
        const tone = host.threat > 80 ? 'alert' : host.threat > 60 ? 'warn' : 'ok';
        const signal =
          s.faction === 'usa' && host.status !== 'closed'
            ? `<button class="mini" data-action="diplomacy:${host.id}" data-tip="${t('panel.signalTip')}">${t('btn.signal')}</button>`
            : '';
        return `<div class="host-row">
          <div class="host-top"><b>${factionLabel(host.id)}</b><span class="status ${host.status}">${hostStatus(host.status)}</span></div>
          <div class="meter-row"><span>${t('panel.threat')}</span><div class="bar"><i style="width:${host.threat}%;background:var(--${tone})"></i></div><b>${Math.round(host.threat)}</b>${signal}</div>
        </div>`;
      })
      .join('');

    const facilities = ['natanz', 'fordow', 'isfahan']
      .map((id) => {
        const node = this.game.map.nodeById.get(id);
        const state = s.nodes[id];
        if (!node || !state) return '';
        const value = Math.round(state.integrity);
        const tag = node.buried ? ` · ${node.buried}m` : '';
        const est = nodeIntegrityEstimate(s, this.game.map, id);
        const shown = est ? Math.round((est.lo + est.hi) / 2) : value;
        const label = est ? t('fog.band', { lo: bandLabel(est) }) : `${value}%`;
        return `<div class="facility-row"${est ? ` data-tip="${t('tip.fog')}"` : ''}><span>${localName(node)}${tag}</span><div class="bar"><i style="width:${shown}%;background:${shown > 50 ? 'var(--ok)' : shown > 0 ? 'var(--warn)' : 'var(--alert)'}"></i></div><b>${label}</b></div>`;
      })
      .join('');

    // Phase 4: only revealed Iranian batteries are countable from the outside.
    const seeAll = s.faction === 'iran';
    const launchers = s.units.filter((u) => u.typeId === 'asm_launcher' && (seeAll || u.revealed)).length;
    const facs = s.units.filter((u) => u.typeId === 'fac' && (seeAll || u.revealed)).length;
    const launcherLabel = seeAll ? `${launchers} × 10%` : `${launchers}+ × 10%`;
    const facLabel = seeAll ? `${facs} × 5%` : `${facs}+ × 5%`;
    const naval = s.units.filter(
      (u) => (u.faction === 'usa' || u.faction === 'israel') && unitType(u.typeId).category === 'naval',
    ).length;
    const hormuzCalc = `<div class="calc">
      <div><span>${t('panel.asm')}</span><b>${launcherLabel}</b></div>
      <div><span>${t('panel.mines')}</span><b>${seeAll ? `${s.iran.minesLaid} × 15%` : `≥ ${Math.max(0, s.iran.minesLaid - 1)} × 15%`}</b></div>
      <div><span>${t('panel.fac')}</span><b>${facLabel}</b></div>
      <div><span>${t('panel.coalitionNaval')}</span><b>−${naval * 10 + (s.hosts.bahrain?.status !== 'closed' ? 10 : 0)}%</b></div>
      <div class="total"><span>${t('panel.disruption')}</span><b>${Math.round(s.meters.hormuz)}%</b></div>
      <small>${t('panel.above50', { a: s.meters.hormuzTurnsAbove50, b: s.meters.hormuzTurnsAbove70 })}</small>
    </div>`;

    let factionSection = '';
    if (s.faction === 'usa') {
      const pending = s.reinforcements
        .map((r) => {
          const eta = effectiveArrival(r);
          const late = (r.delayTurns ?? 0) > 0;
          return `<div class="queue-row"><span>${r.label}${late ? ` <span class="status closed">${t('panel.delayed', { n: r.delayTurns! })}</span>` : ''}</span><b>${t('panel.arrives', { n: eta })}</b></div>`;
        })
        .join('');
      const packages = REINFORCEMENTS.map(
        (pkg) => `<button class="pkg-row" data-action="reinforce:${pkg.id}">
          <span><b>${pkg.label}</b><small>${pkg.note}</small></span>
          <span class="pkg-cost">${pkg.cost} · ${pkg.turns}t</span>
        </button>`,
      ).join('');
      factionSection = `<section class="panel-section"><h4>${t('panel.reinforcements')}</h4>${pending}${packages}</section>`;
    }
    if (s.faction === 'usa' || s.faction === 'israel') {
      factionSection += `<section class="panel-section"><h4>${t('panel.airlift')}</h4>
        <button class="pkg-row" data-action="airlift"><span><b>${ISRAEL_AIRLIFT.label}</b><small>${ISRAEL_AIRLIFT.note}</small></span><span class="pkg-cost">5 · 2</span></button>
        <small>${t('panel.available', { n: s.resources.airlift })}</small>
      </section>`;
    }
    if (s.faction === 'iran') {
      const lines: Array<[string, string, number]> = [
        ['shahed136', localName(unitType('shahed136')), 5],
        ['fateh110', localName(unitType('fateh110')), 10],
        ['khorramshahr', localName(unitType('khorramshahr')), 25],
        ['fattah', localName(unitType('fattah')), 40],
      ];
      factionSection += `<section class="panel-section"><h4>${t('panel.production', { n: Math.round(s.iran.resources) })}</h4>
        ${lines
          .map(([id, label, cost]) => {
            const cls = deliveryClassFor(id);
            const rounds = cls ? s.iran.rounds[cls] : 0;
            const pct = cls ? ARSENAL_UNCERTAINTY_PCT[cls] : 0;
            return `<button class="pkg-row" data-action="produce:${id}"><span><b>${label}</b><small>${t('panel.inStock', { n: rounds })} · ${t('panel.assessed', { pct })}</small></span><span class="pkg-cost">${cost}</span></button>`;
          })
          .join('')}
      </section>
      <section class="panel-section"><h4>${t('panel.arsenal')}</h4>
        ${arsenalRows(s.iran)
          .map((row) => `<div class="queue-row"><span>${row.label}</span><b>${t('panel.assessed', { pct: row.uncertaintyPct })}</b></div>`)
          .join('')}
        <small>${t('panel.launchers', { d: s.iran.launchers.drone - s.iran.launchers.usedDrone, b: s.iran.launchers.ballistic - s.iran.launchers.usedBallistic })}</small>
        <small>${t('panel.unmated', { a: s.iran.airframes.drone + s.iran.airframes.missile, w: s.iran.warheads.conventional })}</small>
        <small>${t('panel.nuclearMaterial', { n: s.iran.nuclearMaterial })}</small>
      </section>`;
    }

    // Phase 2: the domestic-pressure section. The gauge is visible to every
    // faction (it is public news); the public-address order is US-only.
    let domesticSection = '';
    if (s.domestic) {
      const d = s.domestic;
      const cfg = domesticCfg(s);
      const pressureTone = d.pressure >= cfg.collapsePressure ? 'alert' : d.pressure >= 60 ? 'warn' : 'ok';
      const restrictionLabel =
        d.restriction === 'restricted'
          ? t('domestic.restricted')
          : d.restriction === 'suspended'
            ? t('domestic.suspended')
            : t('domestic.none');
      const pending = d.pending
        ? `<small>${t('domestic.pending', { n: d.pending.effectiveTurn, level: d.pending.level === 'restricted' ? t('domestic.restricted') : d.pending.level === 'suspended' ? t('domestic.suspended') : t('domestic.none') })}</small>`
        : '';
      const onCooldown = d.cooldown > 0;
      const communicate =
        s.faction === 'usa'
          ? `<button class="pkg-row" data-action="communicate" ${onCooldown ? 'disabled' : ''} data-tip="${t('tip.communicate', { cost: cfg.communicate.cost, gain: cfg.communicate.gain, cd: cfg.communicate.cooldown })}">
              <span><b>${t('btn.communicate')}</b><small>${onCooldown ? t('domestic.cooldown', { n: d.cooldown }) : t('tip.communicate', { cost: cfg.communicate.cost, gain: cfg.communicate.gain, cd: cfg.communicate.cooldown })}</small></span>
              <span class="pkg-cost">${cfg.communicate.cost}</span>
            </button>`
          : '';
      domesticSection = `<section class="panel-section"><h4>${t('panel.domestic')}</h4>
        <div class="meter-row"><span>${t('domestic.pressure')}</span><div class="bar"><i style="width:${d.pressure}%;background:var(--${pressureTone})"></i></div><b>${d.pressure}</b></div>
        <div class="meter-row"><span>${t('gauge.congress')}</span><div class="bar"><i style="width:${Math.round(d.congress)}%;background:var(--info)"></i></div><b>${Math.round(d.congress)}</b></div>
        <div class="meter-row"><span>${t('gauge.econ')}</span><div class="bar"><i style="width:${Math.round(d.economy)}%;background:var(--warn)"></i></div><b>${Math.round(d.economy)}</b></div>
        <div class="host-top"><b>${t('domestic.restrictionLabel')}</b><span class="status ${d.restriction === 'none' ? 'open' : 'closed'}">${restrictionLabel}</span></div>
        ${pending}
        <small>${t('panel.casualties', { n: d.casualtiesTotal })}</small>
        ${communicate}
      </section>`;
    }

    // Improvement 6: rules-of-engagement presets — a coalition policy choice,
    // visible to every faction (partners react to it too).
    let roeSection = '';
    if (s.roe) {
      const cfg = roeCfg(s);
      const current = s.roe.posture;
      const buttons = ROE_POSTURES.map(
        (posture) =>
          `<button class="choice ${current === posture ? 'active' : ''}" data-action="roe:${posture}">${t(`roe.${posture}`)}</button>`,
      ).join('');
      roeSection = `<section class="panel-section"><h4>${t('roe.title')}</h4>
        <div class="host-top"><b>${t('roe.standing')}</b><span class="status ${current === 'aggressive' ? 'closed' : current === 'constrained' ? 'restricted' : 'open'}">${t(`roe.${current}`)}</span></div>
        ${s.faction === 'usa' || s.faction === 'israel' ? `<div class="choice-row roe">${buttons}</div>` : ''}
        <small>${t('roe.tip', { dmg: Math.round((cfg[current].damageMultiplier - 1) * 100), esc: cfg[current].escalationMultiplier })}</small>
      </section>`;
    }

    // Phase 3: the Israeli initiative track and the Qatari ceasefire talks.
    let phase3Section = '';
    const track = s.israelInitiative;
    const talks = s.ceasefire;
    if (track || talks) {
      phase3Section = '<section class="panel-section">';
      if (track) {
        const cfg = initiativeCfg(s);
        const tone = track.level >= cfg.aggressiveThreshold ? 'warn' : 'info';
        const stanceLabel =
          track.stance === 'approved'
            ? t('initiative.approved')
            : track.stance === 'constrained'
              ? t('initiative.constrained')
              : t('initiative.accepted');
        const stanceButtons =
          s.faction === 'usa'
            ? `<div class="choice-row initiative">
                ${(['approved', 'accepted', 'constrained'] as const)
                  .map(
                    (stance) =>
                      `<button class="choice ${track.stance === stance ? 'active' : ''} ${track.stance === stance && stance !== 'accepted' ? 'current' : ''}" data-action="initiative:${stance}">${t(`initiative.${stance}`)}</button>`,
                  )
                  .join('')}
              </div>`
            : '';
        phase3Section += `<h4>${t('initiative.title')}</h4>
          <div class="meter-row"><span>${t('initiative.level')}</span><div class="bar"><i style="width:${Math.round(track.level)}%;background:var(--${tone})"></i></div><b>${Math.round(track.level)}</b></div>
          <div class="host-top"><b>${t('initiative.stance')}</b><span class="status ${track.stance === 'constrained' ? 'closed' : 'open'}">${stanceLabel}</span></div>
          ${stanceButtons}
          <small>${t('initiative.tip', { threshold: cfg.aggressiveThreshold })}</small>`;
      }
      if (talks) {
        const cfg = talksCfg(s);
        const stateLabel =
          talks.state === 'offered'
            ? t('talks.offered')
            : talks.state === 'talks'
              ? t('talks.talks')
              : talks.state === 'collapsed'
                ? t('talks.collapsed')
                : t('talks.none');
        const bar =
          talks.state === 'talks'
            ? `<div class="meter-row"><span>${t('talks.progress')}</span><div class="bar"><i style="width:${talks.progress}%;background:var(--info)"></i></div><b>${Math.round(talks.progress)}/${cfg.agreeProgress}</b></div>`
            : '';
        const actions =
          s.faction !== 'iran' && talks.state === 'offered'
            ? `<div class="choice-row talks">
                <button data-action="talks:pursue">${t('talks.pursue')}</button>
                <button data-action="talks:walk">${t('talks.walk')}</button>
              </div>`
            : '';
        phase3Section += `<h4>${t('talks.title')}</h4>
          <div class="host-top"><b>${t('talks.state')}</b><span class="status ${talks.state === 'talks' ? 'open' : talks.state === 'offered' ? 'restricted' : 'closed'}">${stateLabel}</span></div>
          ${bar}${actions}`;
      }
      phase3Section += '</section>';
    }

    // Improvement 1: the escalation ladder and its crossed red lines. Public
    // news — every faction sees the same world heat.
    let escalationSection = '';
    if (s.escalation) {
      const cfg = escalationCfg(s);
      const level = s.escalation.level;
      const max = cfg.levels.length;
      const tone = level >= 4 ? 'alert' : level >= 2 ? 'warn' : 'info';
      const fired = s.escalation.fired
        .map((id) => {
          const def = cfg.redLines.find((r) => r.id === id);
          if (!def) return '';
          const label = getLang() === 'fa' && def.label_fa ? def.label_fa : def.label;
          return `<div class="host-top"><span class="status closed">${t('escalation.crossed')}</span><b>${label}</b></div>`;
        })
        .join('');
      escalationSection = `<section class="panel-section"><h4>${t('escalation.title')}</h4>
        <div class="meter-row"><span>${t('escalation.meter')}</span><div class="bar"><i style="width:${Math.round(s.meters.nuclearEscalation)}%;background:var(--${tone})"></i></div><b>${Math.round(s.meters.nuclearEscalation)}</b></div>
        <div class="meter-row"><span>${t('escalation.ladder')}</span><div class="bar"><i style="width:${(level / max) * 100}%;background:var(--${tone})"></i></div><b>${level}/${max}</b></div>
        ${fired}
        <small>${t('escalation.tip', { n: max })}</small>
      </section>`;
    }

    const baseRows = bases
      .map(
        (base) => `<div class="base-row">
          <div class="host-top"><b>${base.name}</b><span class="status ${base.operational ? 'open' : 'closed'}">${base.operational ? t('panel.operational') : t('panel.down')}</span></div>
          <div class="bar"><i style="width:${Math.round(base.integrity)}%;background:${base.integrity > 60 ? 'var(--ok)' : base.integrity > 25 ? 'var(--warn)' : 'var(--alert)'}"></i></div>
        </div>`,
      )
      .join('');

    // Phase 1: live progress for all four Iranian victory paths. Shown to every
    // faction for now; Phase 4 (fog of war) will gate the Iranian-internal values.
    let victorySection = '';
    if (s.victory) {
      const pathRows = victoryPaths(s, this.game.map)
        .map((p) => {
          const tone = p.satisfied ? 'ok' : p.progress > 60 ? 'warn' : 'info';
          const badge = p.satisfied
            ? `<span class="status open">${t('path.satisfied')}</span>`
            : `<span class="status restricted">${t('path.pending')}</span>`;
          const when = p.decidesAtEnd ? `<span class="status">${t('path.atEnd')}</span>` : '';
          return `<div class="host-row">
            <div class="host-top"><b>${t(`path.${p.id}`)}</b>${badge}${when}</div>
            <div class="meter-row"><span>${p.progress}%</span><div class="bar"><i style="width:${p.progress}%;background:var(--${tone})"></i></div><b></b></div>
            <small>${t(`path.${p.id}.detail`, p.stats)}</small>
          </div>`;
        })
        .join('');
      victorySection = `<section class="panel-section"><h4>${t('panel.victoryPaths')}</h4>${pathRows}</section>`;
    }

    const warCost = `<section class="panel-section"><h4>${t('panel.warCost')}</h4>
      <div class="meter-row"><span>${t('panel.iranCost')}</span><div class="bar"><i style="width:${(s.meters.iranWarCost / s.meters.iranWarCostThreshold) * 100}%;background:var(--info)"></i></div><b>${Math.round(s.meters.iranWarCost)}/${s.meters.iranWarCostThreshold}</b></div>
      <div class="meter-row"><span>${t('panel.usWill')}</span><div class="bar"><i style="width:${s.resources.politicalWill}%;background:var(--warn)"></i></div><b>${Math.round(s.resources.politicalWill)}</b></div>
    </section>`;

    return `<header class="panel-head"><h3>${t('panel.strategic')}</h3><button data-action="panel:strategic" aria-label="${t('btn.close')}">✕</button></header>
      <div class="panel-body">
        <details class="panel-group" open>
          <summary>${t('panel.situation')}</summary>
          <section class="panel-section"><h4>${t('panel.basing')}</h4>${baseRows}</section>
          <section class="panel-section"><h4>${t('panel.hosts')}</h4>${hostRows}</section>
          ${warCost}
        </details>
        <details class="panel-group">
          <summary>${t('panel.military')}</summary>
          <section class="panel-section"><h4>${t('panel.programme')}</h4>${facilities}</section>
          ${victorySection}
        </details>
        <details class="panel-group">
          <summary>${t('panel.economy')}</summary>
          <section class="panel-section"><h4>${t('panel.hormuz')}</h4>${hormuzCalc}</section>
          ${factionSection}
        </details>
        <details class="panel-group">
          <summary>${t('panel.diplomacy')}</summary>
          ${phase3Section}
        </details>
        <details class="panel-group">
          <summary>${t('panel.politics')}</summary>
          ${domesticSection}
          ${roeSection}
          ${escalationSection}
        </details>
      </div>`;

  }

  private logHtml(): string {
    const entries = this.game.snap.log;
    const groups: string[] = [];
    let current = -1;
    for (const entry of entries) {
      if (entry.turn !== current) {
        current = entry.turn;
        groups.push(`<h4 class="log-turn">${t('log.turn', { n: entry.turn })}</h4>`);
      }
      const text = getLang() === 'fa' ? faLog(entry.text) ?? entry.text : entry.text;
      groups.push(`<p class="log-line ${entry.tone}">${text}</p>`);
    }
    const note = getLang() === 'fa' ? `<p class="log-note">${t('log.englishNote')}</p>` : '';
    return `<header class="panel-head"><h3>${t('panel.log')}</h3><button data-action="panel:log" aria-label="${t('btn.close')}">✕</button></header><div class="panel-body">${note}${groups.join('')}</div>`;
  }

  // ------------------------------------------------------------------ targeting
  private strikeTargets(unit: UnitInstance): StrikeTarget[] {
    // Iranian launchers fire from a national stockpile, not their magazine.
    if (unit.faction === 'iran' && this.iranStockFor(unit) <= 0) return [];
    return strikeTargetsFor(
      this.game.snap,
      this.game.map,
      unit,
      (nodeId) => {
        const node = this.game.map.nodeById.get(nodeId);
        return node ? localName(node) : nodeId;
      },
      (col, row) => t('target.hex', { col, row }),
    );
  }

  private selectNextReadyUnit(): void {
    const snap = this.game.snap;
    const tasked = new Set(
      snap.orders.filter((o) => 'unitUid' in o).map((o) => (o as { unitUid: string }).unitUid),
    );
    const candidate = snap.units.find(
      (u) =>
        u.faction === snap.faction &&
        !tasked.has(u.uid) &&
        unitType(u.typeId).atk > 0 &&
        u.cooldown === 0 &&
        this.strikeTargets(u).length > 0,
    );
    if (!candidate) {
      this.showToast(t('toast.nothingNext'), 'warn');
      return;
    }
    this.game.selectUnit(candidate.uid);
    focusHex({ col: candidate.col, row: candidate.row });
  }

  /** The player's own corner of the theatre, used for the opening camera. */
  private homeHex(): { col: number; row: number } | null {
    const anchor =
      this.game.snap.faction === 'usa'
        ? 'al_udeid'
        : this.game.snap.faction === 'israel'
          ? 'hatzerim'
          : 'bandar_abbas';
    return this.game.map.nodeHexOf(anchor) ?? this.game.map.nodeHexOf('gulf_platforms') ?? null;
  }

  // ------------------------------------------------------------------ actions
  private openReview(): void {
    if (this.game.snap.status !== 'playing') return;
    this.reviewOpen = true;
    this.modalKind = 'review';
    this.openModal(this.reviewHtml());
  }

  private reviewHtml(): string {
    const review = buildTurnReview(this.game.snap, this.game.map);
    const orderRows =
      review.orders.length === 0
        ? `<p class="modal-note">${t('review.noOrders')}</p>`
        : review.orders
            .map((order) => {
              const status = order.errors.length
                ? `<span class="status closed">${t('review.invalid')}</span>`
                : `<span class="status open">${t('review.valid')}</span>`;
              const errors = order.errors.map((e) => `<li class="risk">${e}</li>`).join('');
              const list = (title: string, items: string[]) =>
                items.length
                  ? `<div class="review-consequence"><b>${title}</b><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`
                  : '';
              return `<div class="review-order">
                <div class="review-order-head"><b>${order.label}</b>${status}
                  <button class="mini" data-action="remove-order:${order.index}" aria-label="${t('btn.cancel')}">✕</button>
                </div>
                ${errors ? `<ul class="review-errors">${errors}</ul>` : ''}
                ${list(t('review.guaranteed'), order.guaranteed)}
                ${list(t('review.likely'), order.likely)}
                ${list(t('review.uncertain'), order.uncertain)}
              </div>`;
            })
            .join('');
    const spend = review.spending.length
      ? review.spending.map((s) => `<span class="review-chip"><b>${s.label}</b> ${s.value}</span>`).join('')
      : `<span class="review-chip">${t('review.none')}</span>`;
    const warnings = review.warnings.length
      ? review.warnings.map((w) => `<li class="risk">${w}</li>`).join('')
      : `<li>${t('review.noneWarnings')}</li>`;

    return `<div class="modal-card review" role="document" aria-labelledby="review-title">
      <header><h2 id="review-title">${t('review.title')} · ${this.game.snap.turn}</h2>
        <button data-action="review-back" aria-label="${t('btn.close')}">✕</button></header>
      <div class="modal-body review-body">
        <p class="modal-note">${t('review.subtitle')}</p>
        <p class="modal-note">${t('review.ordersCount', { n: review.orders.length, v: review.validCount })}</p>
        <section class="review-section"><h4>${t('review.orders')}</h4>${orderRows}</section>
        <section class="review-section"><h4>${t('review.spend')}</h4><div class="review-chips">${spend}</div></section>
        <section class="review-section"><h4>${t('review.warnings')}</h4><ul>${warnings}</ul></section>
      </div>
      <footer class="review-foot">
        <button data-action="review-back">${t('review.back')}</button>
        <button class="primary" data-action="review-resolve">${t('review.resolve')}</button>
      </footer>
    </div>`;
  }

  private endTurn(): void {
    if (this.game.snap.status !== 'playing') return;
    const { events, resolvedTurn } = this.game.endTurn();
    this.openPanel = null;
    this.playResolution(events, resolvedTurn);
  }

  private playResolution(events: ResolveEvent[], turn: number): void {
    const overlay = $('#cinematic');
    overlay.classList.add('active');
    $('#cin-title').textContent = t('cin.resolution', { n: turn });
    const list = $('#cin-list');
    list.innerHTML = '';
    if (getLang() === 'fa') {
      const note = document.createElement('p');
      note.className = 'cin-line info';
      note.textContent = t('cin.note');
      list.appendChild(note);
    }

    this.cinEvents = events.length ? events : [{ text: t('cin.none'), tone: 'info' }];
    this.cinIndex = 0;
    this.reportCategory = null;
    if (this.reducedMotion) {
      this.revealAll();
      return;
    }
    const skip = this.root.querySelector('#cin-skip') as HTMLButtonElement | null;
    if (skip) {
      skip.disabled = false;
      skip.textContent = t('cin.skip');
    }
    const cont = this.root.querySelector('#cin-continue') as HTMLButtonElement | null;
    if (cont) cont.disabled = false;
    list.scrollTop = 0;
    window.clearTimeout(this.cinTimer);
    this.stepCinematic();
  }

  private stepCinematic(): void {
    const event = this.cinEvents[this.cinIndex];
    if (!event) return this.revealAll();
    this.cinIndex++;
    this.appendCinematicLine(event);
    if (event.focus) focusHex(event.focus);
    const delay = this.cinEvents.length > 30 ? 140 : 420;
    this.cinTimer = window.setTimeout(() => this.stepCinematic(), delay);
  }

  private appendCinematicLine(event: ResolveEvent): void {
    const list = document.getElementById('cin-list');
    if (!list) return;
    const category = reportKey(event.text);
    if (category !== this.reportCategory) {
      this.reportCategory = category;
      const heading = document.createElement('h4');
      heading.className = 'cin-group';
      heading.textContent = t(category);
      list.appendChild(heading);
    }
    const line = document.createElement('p');
    line.className = `cin-line ${event.tone}`;
    // Phase 6: engine lines render through the Persian template pass when the
    // interface is Persian; unmatched lines keep the English original.
    line.textContent = getLang() === 'fa' ? faLog(event.text) ?? event.text : event.text;
    list.appendChild(line);
    list.scrollTop = list.scrollHeight;
  }

  /** Print every remaining line immediately; the report stays open to be read. */
  private revealAll(): void {
    window.clearTimeout(this.cinTimer);
    while (this.cinIndex < this.cinEvents.length) {
      const event = this.cinEvents[this.cinIndex++];
      if (event) this.appendCinematicLine(event);
    }
    const skip = this.root.querySelector('#cin-skip') as HTMLButtonElement | null;
    if (skip) {
      skip.disabled = true;
      skip.textContent = '✓';
    }
    const cont = this.root.querySelector('#cin-continue') as HTMLButtonElement | null;
    if (cont) cont.disabled = false;
  }

  private closeCinematic(): void {
    window.clearTimeout(this.cinTimer);
    this.revealAll();
    $('#cinematic').classList.remove('active');
    if (this.game.snap.status !== 'playing') {
      this.openOutcome();
    } else {
      this.render();
    }
  }

  private openOutcome(): void {
    const s = this.game.snap;
    const won = s.status === 'won';
    // Improvement 7: the graded multi-axis settlement, when the campaign
    // ended under the victory-path system.
    const scorecard = s.scorecard
      ? `<div class="scorecard">
          <h4>${t('scorecard.title')}</h4>
          ${s.scorecard.axes
            .map((axis) => {
              const tone = axis.side === 'iran' ? 'ok' : 'info';
              return `<div class="host-row">
                <div class="host-top"><b>${t(`axis.${axis.id}` as StringKey)}</b><span class="status ${axis.side === 'iran' ? 'restricted' : ''}">${t(axis.side === 'iran' ? 'scorecard.iran' : 'scorecard.coalition')}</span></div>
                <div class="meter-row"><span>${axis.score}</span><div class="bar"><i style="width:${axis.score}%;background:var(--${tone})"></i></div><b>×${axis.weight}</b></div>
              </div>`;
            })
            .join('')}
          <div class="calc">
            <div><span>${t('scorecard.iran')}</span><b>${s.scorecard.iranTotal}</b></div>
            <div><span>${t('scorecard.coalition')}</span><b>${s.scorecard.coalitionTotal}</b></div>
            <div class="total"><span>${t('scorecard.verdict')}</span><b>${t(`verdict.${s.scorecard.verdict}`)}</b></div>
          </div>
        </div>`
      : '';
    this.modalKind = 'outcome';
    this.openModal(`
      <div class="modal-card outcome ${won ? 'won' : 'lost'}">
        <header><h2>${won ? t('outcome.victory') : t('outcome.defeat')}</h2><button data-action="close-modal" aria-label="${t('btn.close')}">✕</button></header>
        <div class="modal-body">
          <p class="outcome-text">${getLang() === 'fa' ? faOutcome(s.outcome) ?? s.outcome : s.outcome}</p>
          <div class="stat-row">
            <div class="stat"><span>${t('outcome.turns')}</span><b>${s.turn}</b></div>
            <div class="stat"><span>${t('outcome.hormuz')}</span><b>${Math.round(s.meters.hormuz)}%</b></div>
            <div class="stat"><span>${t('outcome.iranCost')}</span><b>${Math.round(s.meters.iranWarCost)}</b></div>
          </div>
          ${scorecard}
          <div class="actions">
            <button class="primary" data-action="menu">${t('outcome.new')}</button>
            <button data-action="close-modal">${t('outcome.inspect')}</button>
          </div>
        </div>
      </div>
    `);
  }

  private openMenu(): void {
    const saves = listSaves();
    const slotRows = SLOTS.map((slot, index) => {
      const info = saves[index];
      return `<div class="slot-row">
        <span><b>${slot.toUpperCase()}</b><small>${info ? `${info.label} · ${new Date(info.savedAt).toLocaleString()}` : t('menu.empty')}</small></span>
        <span class="slot-actions">
          <button data-action="save:${slot}" ${slot === 'auto' ? 'disabled' : ''}>${t('btn.save')}</button>
          <button data-action="load:${slot}" ${info ? '' : 'disabled'}>${t('btn.load')}</button>
          <button data-action="delete:${slot}" ${info && slot !== 'auto' ? '' : 'disabled'}>${t('btn.del')}</button>
        </span>
      </div>`;
    }).join('');

    const auto = saves[SLOTS.indexOf('auto')];
    const fa = getLang() === 'fa';
    this.modalKind = 'menu';
    this.openModal(`
      <div class="modal-card">
        <header><h2>${t('app.title')}</h2><button data-action="close-modal" aria-label="${t('btn.close')}">✕</button></header>
        <div class="modal-body">
          <section>
            <p class="modal-note">${t('menu.blurb')}</p>
            ${auto ? `<button class="primary wide" data-action="continue">${t('menu.continue', { label: auto.label })}</button>` : ''}
          </section>
          <section>
            <h3>${t('menu.new')}</h3>
            <div class="choice-row">
              ${Object.values(SCENARIOS)
                .map((scenario) => {
                  const name = fa ? SCENARIO_FA[scenario.id] ?? scenario.name : scenario.name;
                  return `<button class="choice ${this.menuScenario === scenario.id ? 'active' : ''}" data-action="scenario:${scenario.id}">${name}<small>${t('menu.turns', { n: scenario.turns })}${scenario.tutorial ? ` · ${t('menu.tutorial')}` : ''}</small></button>`;
                })
                .join('')}
            </div>
            <div class="choice-row factions">
              ${(['usa', 'israel', 'iran'] as const)
                .map(
                  (faction) =>
                    `<button class="choice ${this.menuFaction === faction ? 'active' : ''}" data-action="faction:${faction}"><i style="background:${FACTION_COLORS[faction]}"></i>${shortFaction(faction)}</button>`,
                )
                .join('')}
            </div>
            <button class="primary wide" data-action="start:${this.menuScenario}:${this.menuFaction}">${t('btn.start')}</button>
          </section>
          <section>
            <h3>${t('menu.saves')}</h3>
            ${slotRows}
          </section>
          <section>
            <h3>${t('menu.replay')}</h3>
            <p class="modal-note">${t('menu.replayNote')}</p>
            <button data-action="export-replay">${t('btn.exportReplay')}</button>
          </section>
          <section>
            <h3>${t('menu.language')}</h3>
            <div class="choice-row language">
              <button class="choice ${fa ? '' : 'active'}" data-action="lang:en">English</button>
              <button class="choice ${fa ? 'active' : ''}" data-action="lang:fa">فارسی</button>
            </div>
            <p class="modal-note">${t('menu.languageNote')}</p>
          </section>
          <section>
            <h3>${t('menu.controls')}</h3>
            <p class="modal-note">${t('menu.controlsText')}</p>
          </section>
        </div>
      </div>
    `);
  }

  private saveSlot(slot: SlotId): void {
    const ok = this.game.save(slot);
    this.showToast(ok ? t('toast.saved', { slot }) : t('toast.saveFailed'), ok ? 'good' : 'bad');
    this.openMenu();
  }

  private loadSlot(slot: SlotId): void {
    const ok = this.game.load(slot);
    this.showToast(ok ? t('toast.loaded', { slot }) : t('toast.nothingToLoad'), ok ? 'good' : 'warn');
    if (ok) this.closeModal();
  }

  private openModal(html: string): void {
    const modal = $('#modal');
    if (!modal.classList.contains('active')) {
      this.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = html;
    modal.classList.add('active');
    const target = modal.querySelector<HTMLElement>('button, [href], input, select, textarea');
    target?.focus();
  }

  private closeModal(): void {
    const modal = $('#modal');
    modal.classList.remove('active');
    modal.innerHTML = '';
    this.modalKind = null;
    this.reviewOpen = false;
    this.lastFocused?.focus();
    this.lastFocused = null;
  }

  // ------------------------------------------------------------------- helpers
  private iranStockFor(unit: UnitInstance): number {
    const s = this.game.snap.iran;
    if (unit.typeId === 'mine_layer') return s.mines;
    const cls = deliveryClassFor(unit.typeId);
    return cls ? s.rounds[cls] : unit.magazine;
  }

  private showToast(message: string, tone: string): void {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${tone}`;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      toast.className = 'toast';
    }, 2600);
  }

  private showTooltip(text: string, x: number, y: number): void {
    const tip = $('#tooltip');
    if (!tip) return;
    tip.textContent = text;
    tip.classList.add('show');
    const width = Math.min(280, window.innerWidth - 24);
    const rtl = getLang() === 'fa';
    tip.style.maxWidth = `${width}px`;
    const left = rtl ? Math.max(12, x - width) : Math.min(x, window.innerWidth - width - 12);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.min(y + 14, window.innerHeight - 110)}px`;
    window.clearTimeout(this.tipHideTimer);
    this.tipHideTimer = window.setTimeout(() => tip.classList.remove('show'), 3200);
  }

  // ---------------------------------------------------------- objectives / coach
  private renderObjectives(): void {
    const el = document.getElementById('objectives-strip');
    if (!el) return;
    if (this.game.snap.status !== 'playing') {
      el.innerHTML = '';
      return;
    }
    const view = buildObjectives(this.game.snap, this.game.map);
    const rows = view.rows
      .map((row) => {
        const tone = row.tone;
        const enemy = row.enemy ? 'enemy' : '';
        const label = this.objLabel(row);
        return `<button class="obj-row ${tone} ${enemy}" data-action="obj-detail:${row.id}" aria-label="${label}">
          <span class="obj-name">${label}</span>
          <span class="obj-bar"><i style="width:${Math.max(4, row.progress)}%"></i></span>
          <span class="obj-cap">${row.caption}</span>
        </button>`;
      })
      .join('');
    const grade = `<div class="obj-grade" data-tip="Live campaign grade estimate"><b>${view.grade}</b><span>${view.gradeLabel}</span></div>`;
    el.innerHTML = `<div class="obj-inner">${grade}${rows}</div>`;
  }

  private objLabel(row: ObjectiveRow): string {
    // Prefer i18n path.* keys; fall back to id.
    const key = row.labelKey as StringKey;
    try {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    } catch {
      /* ignore */
    }
    const fallback: Record<string, string> = {
      'obj.nuclear': getLang() === 'fa' ? 'مجتمع هسته‌ای' : 'Nuclear complex',
      'obj.warCost': getLang() === 'fa' ? 'هزینه جنگ ایران' : 'Iran war cost',
      'obj.domestic': getLang() === 'fa' ? 'فشار داخلی' : 'Domestic pressure',
      'obj.basing': getLang() === 'fa' ? 'پایگاه‌های خلیج' : 'Gulf basing',
      'obj.hormuz': getLang() === 'fa' ? 'هرمز باز' : 'Hormuz open',
      'obj.enemyNuclear': getLang() === 'fa' ? 'تهدید هسته‌ای' : 'Enemy nuclear progress',
    };
    return fallback[row.labelKey] ?? row.labelKey;
  }

  private showObjectiveDetail(id: string): void {
    const view = buildObjectives(this.game.snap, this.game.map);
    const row = view.rows.find((r) => r.id === id);
    if (!row) return;
    this.showToast(`${this.objLabel(row)} — ${row.movesIt}`, 'info');
    // Also surface stats in the strategic panel if open.
    if (this.openPanel === 'strategic') this.render();
  }

  private renderImpactPreview(): void {
    const el = document.getElementById('impact-preview');
    if (!el) return;
    const orders = this.game.snap.orders;
    if (orders.length === 0) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const last = orders[orders.length - 1]!;
    const preview = previewOrderImpact(this.game.snap, last as { kind: string; host?: string; packageId?: string; posture?: string });
    const lines = preview.lines.map((l) => `<li>${l}</li>`).join('');
    const risks = preview.risks.map((l) => `<li class="risk">${l}</li>`).join('');
    el.hidden = false;
    el.innerHTML = `<div class="impact-card"><b>${getLang() === 'fa' ? 'پیش‌بینی اثر' : 'Impact preview'}</b><ul>${lines}${risks}</ul></div>`;
  }

  private renderCoach(): void {
    const el = document.getElementById('coach');
    if (!el) return;
    if (this.coachDismissed || this.game.snap.turn > 1 || this.game.snap.scenarioId === 'tutorial') {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const fa = getLang() === 'fa';
    el.hidden = false;
    el.innerHTML = `<div class="coach-card" role="dialog" aria-label="Coach">
      <header><b>${fa ? 'شروع سریع' : 'Quick start'}</b>
        <button data-action="coach-dismiss" aria-label="${t('btn.close')}">✕</button></header>
      <ol>
        <li>${fa ? 'سه راه پیروزی شما در نوار اهداف بالاست.' : 'Your three win paths are in the objectives strip above.'}</li>
        <li>${fa ? 'دو متری که می‌توانند شما را شکست دهند: فشار داخلی و شوک نفتی.' : 'Two meters that can end you: domestic pressure and the oil shock.'}</li>
        <li>${fa ? 'یک واحد را انتخاب کنید → فهرست اهداف → پیش‌بینی اثر را ببینید.' : 'Select a unit → target list → read the impact preview.'}</li>
      </ol>
      <button class="primary" data-action="coach-dismiss">${fa ? 'متوجه شدم' : 'Got it'}</button>
    </div>`;
  }
}


function categoryLabel(category: string): string {
  return getLang() === 'fa' ? CATEGORY_FA[category] ?? category : CATEGORY_LABELS[category] ?? category.toUpperCase();
}

function nodeKindLabel(kind: string): string {
  return getLang() === 'fa' ? KIND_FA[kind] ?? kind : kind.toUpperCase();
}

function facilityLabel(facility: string): string {
  const labels = FACILITY_LABELS[facility];
  if (!labels) return facility;
  return getLang() === 'fa' ? labels.fa : labels.en;
}


function hostStatus(status: string): string {
  if (status === 'closed') return t('panel.hostClosed');
  if (status === 'restricted') return t('panel.hostRestricted');
  return t('panel.hostOpen');
}

/** Short faction codes for the header chip and menu buttons. */
function shortFaction(faction: string): string {
  if (faction === 'usa') return 'USA';
  if (faction === 'israel') return getLang() === 'fa' ? 'اسرائیل' : 'ISRAEL';
  if (faction === 'iran') return getLang() === 'fa' ? 'ایران' : 'IRAN';
  return factionLabel(faction).toUpperCase();
}

