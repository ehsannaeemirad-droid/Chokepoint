/**
 * DOM UI layer. Sits above the Phaser canvas: crisp text, 44px tap targets, and
 * every number the player needs to reason about the political constraints.
 *
 * The interface is bilingual (English / Persian). All chrome goes through
 * `t()`; map nodes and units use their localised data fields.
 */
import { hostileTo, strikeRange, validateStrike } from '../combat/combat';
import { FACTION_COLORS } from '../core/config';
import { ISRAEL_AIRLIFT, REINFORCEMENTS } from '../core/engine';
import { game, SCENARIOS, type Game, type InteractionMode } from '../core/Game';
import type { FactionId, Order, ResolveEvent, UnitInstance } from '../core/types';
import { defenderOfNode, unitType } from '../core/world';
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
import { hexDistance } from '../map/hex';
import { TERRAIN } from '../map/terrain';
import { majorBaseState } from '../politics/politics';
import { deleteSave, downloadText, exportReplay, listSaves, SLOTS, type SlotId } from '../services/save';
import { bus, focusHex, zoomBy } from './bus';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector(selector) as T;

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
  port: 'بندر',
};

const FACTION_FA: Record<string, string> = {
  usa: 'ایالات متحده',
  israel: 'اسرائیل',
  iran: 'ایران',
  houthi: 'جنبش حوثی',
  saudi: 'عربستان سعودی',
  pakistan: 'پاکستان',
  india: 'هند',
  qatar: 'قطر',
  uae: 'امارات',
  kuwait: 'کویت',
  bahrain: 'بحرین',
  jordan: 'اردن',
  egypt: 'مصر',
  turkey: 'ترکیه',
  neutral: 'بی‌طرف',
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

<div id="tutorial-banner" class="tutorial-banner"></div>

<div class="map-controls">
  <button data-action="zoom-in" aria-label="${t('btn.zoomIn')}" data-tip="${t('btn.zoomIn')}">+</button>
  <button data-action="zoom-out" aria-label="${t('btn.zoomOut')}" data-tip="${t('btn.zoomOut')}">−</button>
  <button data-action="recentre" aria-label="${t('btn.recentre')}" data-tip="${t('btn.recentre')}">◎</button>
</div>

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

interface StrikeTarget {
  col: number;
  row: number;
  nodeId?: string;
  label: string;
  dist: number;
  integrity?: number;
  buried?: number;
  hardened: boolean;
  units: boolean;
}

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
  private modalKind: 'menu' | 'outcome' | null = null;

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
    if (verb === 'end-turn') return this.endTurn();
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
  }

  private gaugesHtml(): string {
    const s = this.game.snap;
    const pills: Array<[string, string, string]> = [];
    if (s.faction === 'usa') {
      pills.push([t('gauge.int'), `${Math.round(s.resources.interceptorsUSA)}`, t('tip.intUS')]);
      pills.push([t('gauge.will'), `${Math.round(s.resources.politicalWill)}`, t('tip.willUS')]);
      pills.push([t('gauge.lift'), `${Math.round(s.resources.airlift)}`, t('tip.lift')]);
    } else if (s.faction === 'israel') {
      pills.push([t('gauge.int'), `${Math.round(s.resources.interceptorsIsrael)}`, t('tip.intIL')]);
      pills.push([t('gauge.tank'), `${Math.round(s.resources.tankerSorties)}`, t('tip.tank')]);
      pills.push([t('gauge.will'), `${Math.round(s.resources.politicalWill)}`, t('tip.willIL')]);
    } else {
      pills.push([t('gauge.drone'), `${Math.round(s.iran.drones)}`, t('tip.drone')]);
      pills.push([
        t('gauge.ball'),
        `${Math.round(s.iran.fateh + s.iran.khorramshahr + s.iran.fattah)}`,
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
      const meta = target.units
        ? t('target.metaUnits', { dist: target.dist })
        : t('target.meta', { dist: target.dist, integrity: Math.round(target.integrity ?? 100) });
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
    const units = this.game.unitsAt(col, row);
    const fa = getLang() === 'fa';
    const unitChips = units.length
      ? `<div class="hex-units">${units
          .map((u) =>
            u.faction === this.game.snap.faction
              ? `<button class="unit-chip ${u.faction}" data-action="select:${u.uid}">${unitLabel(u)} · ${Math.round(u.strength)}%</button>`
              : `<span class="unit-chip ${u.faction}">${unitLabel(u)} · ${Math.round(u.strength)}%</span>`,
          )
          .join('')}</div>`
      : '';

    if (node) {
      const state = this.game.snap.nodes[node.id];
      const integrity = state ? Math.round(state.integrity) : 100;
      const buriedWarn = node.buried
        ? `<div class="warn-line">${t('sheet.buried', { n: node.buried })} — ${t('sheet.buriedWarn')}</div>`
        : node.hardened
          ? `<div class="warn-line">${t('sheet.hardenedWarn')}</div>`
          : '';
      return `
        <div class="sheet-head">
          <span class="node-glyph ${node.kind}"></span>
          <div class="u-title"><b>${localName(node)}</b><span>${nodeKindLabel(node.kind)} · ${factionLabel(node.host)}</span></div>
          <button class="x" data-action="clear-selection" aria-label="${t('btn.close')}">✕</button>
        </div>
        <div class="meter-row"><span>${t('sheet.integrity')}</span><div class="bar"><i style="width:${integrity}%;background:${integrity > 60 ? 'var(--ok)' : integrity > 25 ? 'var(--warn)' : 'var(--alert)'}"></i></div><b>${integrity}%</b></div>
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
        return `<div class="facility-row"><span>${localName(node)}${tag}</span><div class="bar"><i style="width:${value}%;background:${value > 50 ? 'var(--ok)' : value > 0 ? 'var(--warn)' : 'var(--alert)'}"></i></div><b>${value}%</b></div>`;
      })
      .join('');

    const launchers = s.units.filter((u) => u.typeId === 'asm_launcher').length;
    const facs = s.units.filter((u) => u.typeId === 'fac').length;
    const naval = s.units.filter(
      (u) => (u.faction === 'usa' || u.faction === 'israel') && unitType(u.typeId).category === 'naval',
    ).length;
    const hormuzCalc = `<div class="calc">
      <div><span>${t('panel.asm')}</span><b>${launchers} × 10%</b></div>
      <div><span>${t('panel.mines')}</span><b>${s.iran.minesLaid} × 15%</b></div>
      <div><span>${t('panel.fac')}</span><b>${facs} × 5%</b></div>
      <div><span>${t('panel.coalitionNaval')}</span><b>−${naval * 10 + (s.hosts.bahrain?.status !== 'closed' ? 10 : 0)}%</b></div>
      <div class="total"><span>${t('panel.disruption')}</span><b>${Math.round(s.meters.hormuz)}%</b></div>
      <small>${t('panel.above50', { a: s.meters.hormuzTurnsAbove50, b: s.meters.hormuzTurnsAbove70 })}</small>
    </div>`;

    let factionSection = '';
    if (s.faction === 'usa') {
      const pending = s.reinforcements
        .map((r) => `<div class="queue-row"><span>${r.label}</span><b>${t('panel.arrives', { n: r.arrivesTurn })}</b></div>`)
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
          .map(
            ([id, label, cost]) =>
              `<button class="pkg-row" data-action="produce:${id}"><span><b>${label}</b><small>${t('panel.inStock', { n: s.iran.drones + s.iran.fateh + s.iran.khorramshahr + s.iran.fattah })}</small></span><span class="pkg-cost">${cost}</span></button>`,
          )
          .join('')}
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

    return `<header class="panel-head"><h3>${t('panel.strategic')}</h3><button data-action="panel:strategic" aria-label="${t('btn.close')}">✕</button></header>
      <div class="panel-body">
        <section class="panel-section"><h4>${t('panel.basing')}</h4>${baseRows}</section>
        <section class="panel-section"><h4>${t('panel.hosts')}</h4>${hostRows}</section>
        <section class="panel-section"><h4>${t('panel.programme')}</h4>${facilities}</section>
        <section class="panel-section"><h4>${t('panel.hormuz')}</h4>${hormuzCalc}</section>
        ${factionSection}
        <section class="panel-section"><h4>${t('panel.warCost')}</h4>
          <div class="meter-row"><span>${t('panel.iranCost')}</span><div class="bar"><i style="width:${(s.meters.iranWarCost / s.meters.iranWarCostThreshold) * 100}%;background:var(--info)"></i></div><b>${Math.round(s.meters.iranWarCost)}/${s.meters.iranWarCostThreshold}</b></div>
          <div class="meter-row"><span>${t('panel.usWill')}</span><div class="bar"><i style="width:${s.resources.politicalWill}%;background:var(--warn)"></i></div><b>${Math.round(s.resources.politicalWill)}</b></div>
        </section>
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
      groups.push(`<p class="log-line ${entry.tone}">${entry.text}</p>`);
    }
    const note = getLang() === 'fa' ? `<p class="log-note">${t('log.englishNote')}</p>` : '';
    return `<header class="panel-head"><h3>${t('panel.log')}</h3><button data-action="panel:log" aria-label="${t('btn.close')}">✕</button></header><div class="panel-body">${note}${groups.join('')}</div>`;
  }

  // ------------------------------------------------------------------ targeting
  private strikeTargets(unit: UnitInstance): StrikeTarget[] {
    const snap = this.game.snap;
    const map = this.game.map;
    const def = unitType(unit.typeId);
    if (def.atk <= 0 || def.rng <= 0) return [];
    if (unit.magazine <= 0 || unit.cooldown > 0) return [];
    // Iranian launchers fire from a national stockpile, not their magazine.
    if (unit.faction === 'iran' && this.iranStockFor(unit) <= 0) return [];
    const range = strikeRange(snap, unit);
    const targets: StrikeTarget[] = [];
    const nodeHexes = new Set<string>();

    for (const node of map.nodes) {
      const hex = map.nodeHexOf(node.id);
      if (!hex) continue;
      const state = snap.nodes[node.id];
      if (!state || state.integrity <= 0) continue;
      const defender = defenderOfNode(node);
      if (!defender || !hostileTo(unit.faction, defender)) continue;
      const dist = hexDistance({ col: unit.col, row: unit.row }, hex);
      if (dist > range) continue;
      if (!validateStrike(snap, map, unit, hex.col, hex.row, node.id).ok) continue;
      nodeHexes.add(`${hex.col},${hex.row}`);
      targets.push({
        col: hex.col,
        row: hex.row,
        nodeId: node.id,
        label: localName(node),
        dist,
        integrity: state.integrity,
        buried: node.buried,
        hardened: node.hardened === true,
        units: false,
      });
    }

    const seen = new Set<string>();
    for (const enemy of snap.units) {
      if (!hostileTo(unit.faction, enemy.faction) || !enemy.revealed) continue;
      const key = `${enemy.col},${enemy.row}`;
      if (nodeHexes.has(key) || seen.has(key)) continue;
      const dist = hexDistance({ col: unit.col, row: unit.row }, { col: enemy.col, row: enemy.row });
      if (dist > range) continue;
      seen.add(key);
      targets.push({
        col: enemy.col,
        row: enemy.row,
        label: t('target.hex', { col: enemy.col, row: enemy.row }),
        dist,
        hardened: false,
        units: true,
      });
    }

    return targets.sort((x, y) => x.dist - y.dist);
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
    const line = document.createElement('p');
    line.className = `cin-line ${event.tone}`;
    line.textContent = event.text;
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
    this.modalKind = 'outcome';
    this.openModal(`
      <div class="modal-card outcome ${won ? 'won' : 'lost'}">
        <header><h2>${won ? t('outcome.victory') : t('outcome.defeat')}</h2><button data-action="close-modal" aria-label="${t('btn.close')}">✕</button></header>
        <div class="modal-body">
          <p class="outcome-text">${s.outcome}</p>
          <div class="stat-row">
            <div class="stat"><span>${t('outcome.turns')}</span><b>${s.turn}</b></div>
            <div class="stat"><span>${t('outcome.hormuz')}</span><b>${Math.round(s.meters.hormuz)}%</b></div>
            <div class="stat"><span>${t('outcome.iranCost')}</span><b>${Math.round(s.meters.iranWarCost)}</b></div>
          </div>
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
    modal.innerHTML = html;
    modal.classList.add('active');
  }

  private closeModal(): void {
    const modal = $('#modal');
    modal.classList.remove('active');
    modal.innerHTML = '';
    this.modalKind = null;
  }

  // ------------------------------------------------------------------- helpers
  private iranStockFor(unit: UnitInstance): number {
    const s = this.game.snap.iran;
    switch (unit.typeId) {
      case 'shahed136':
        return s.drones;
      case 'fateh110':
        return s.fateh;
      case 'khorramshahr':
        return s.khorramshahr;
      case 'fattah':
        return s.fattah;
      case 'asm_launcher':
        return s.asm;
      case 'mine_layer':
        return s.mines;
      default:
        return unit.magazine;
    }
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
}

function unitLabel(unit: UnitInstance): string {
  return localName(unitType(unit.typeId));
}

function categoryLabel(category: string): string {
  return getLang() === 'fa' ? CATEGORY_FA[category] ?? category : CATEGORY_LABELS[category] ?? category.toUpperCase();
}

function nodeKindLabel(kind: string): string {
  return getLang() === 'fa' ? KIND_FA[kind] ?? kind : kind.toUpperCase();
}

function factionLabel(id: string): string {
  return getLang() === 'fa' ? FACTION_FA[id] ?? id : FACTION_LABELS_FALLBACK[id] ?? id;
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

const FACTION_LABELS_FALLBACK: Record<string, string> = {
  usa: 'United States',
  israel: 'Israel',
  iran: 'Iran',
  houthi: 'Houthi Movement',
  saudi: 'Saudi Arabia',
  pakistan: 'Pakistan',
  india: 'India',
  qatar: 'Qatar',
  uae: 'UAE',
  kuwait: 'Kuwait',
  bahrain: 'Bahrain',
  jordan: 'Jordan',
  egypt: 'Egypt',
  turkey: 'Turkey',
  neutral: 'Neutral',
};
