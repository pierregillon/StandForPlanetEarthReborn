// Panneaux de l'éditeur de niveaux (ADR-018), en HTML par-dessus le jeu : barre d'outils, palette, couches,
// réglages de la sélection. Des champs de saisie, des listes et un sélecteur de couleur se font mieux en HTML
// que dans Phaser ; la carte, elle, reste dessinée par EditorScene.
import { CATEGORIES, EDITABLE, LIGHT_OBJECT, isInstance, lightRadius } from './model.ts';
import type { Catalog, Category, Ent } from './model.ts';
import type { LevelDecal, LevelInstance } from '../../sim/types.ts';

export type PaletteItem = { kind: 'object'; object: string } | { kind: 'decal'; sprite: string } | { kind: 'light'; spot: boolean };
/** Couches que l'on peut masquer : les familles d'éléments, plus les murs et les sols (pas encore éditables). */
export type LayerId = Category | 'walls' | 'floors';
export type Field =
  | 'x' | 'y' | 'angle' | 'scaleX' | 'scaleY' | 'tint' | 'alpha' | 'bulletCrossed' | 'shadow'
  | 'radius' | 'intensity' | 'color' | 'spot' | 'coneHalf';

export interface UiHandlers {
  exit(): void;
  save(thenExit: boolean): void;
  undo(): void;
  redo(): void;
  snap(step: number): void;
  lights(on: boolean): void;
  tool(item: PaletteItem | null): void;
  layer(id: LayerId, visible: boolean): void;
  edit(field: Field, value: number | string | boolean): void;
  action(name: 'delete' | 'duplicate' | 'flipX' | 'flipY' | 'fit' | 'front' | 'back'): void;
}

export interface UiStatus {
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  x: number;
  y: number;
  hint: string;
}

const CSS = `
.ed { position: fixed; inset: 0; pointer-events: none; font: 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #dfe6f5; z-index: 10; user-select: none; }
.ed * { box-sizing: border-box; }
.ed .bar, .ed .panel, .ed .status, .ed .modal { pointer-events: auto; background: rgba(14, 18, 30, 0.94); border: 1px solid #2c3550; }
.ed .bar { position: absolute; top: 0; left: 0; right: 0; height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border-width: 0 0 1px; }
.ed .bar .name { font-weight: 600; margin: 0 6px; white-space: nowrap; }
.ed .bar .dot { color: #ffb84d; margin-left: 4px; }
.ed .bar .grow { flex: 1; }
.ed button, .ed select, .ed input { font: inherit; color: inherit; }
.ed button { background: #232b42; border: 1px solid #3a4666; border-radius: 5px; padding: 5px 10px; cursor: pointer; white-space: nowrap; }
.ed button:hover:not(:disabled) { background: #2f3a59; }
.ed button:disabled { opacity: 0.4; cursor: default; }
.ed button.on { background: #3b5bdb; border-color: #5c7cfa; }
.ed button.primary { background: #2f9e44; border-color: #51cf66; color: #fff; }
.ed button.primary:hover:not(:disabled) { background: #37b24d; }
.ed select, .ed input[type=number], .ed input[type=text], .ed input[type=search] { background: #0b0f1a; border: 1px solid #3a4666; border-radius: 4px; padding: 4px 6px; min-width: 0; }
.ed label.inline { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.ed .panel { position: absolute; top: 44px; bottom: 26px; width: 268px; display: flex; flex-direction: column; }
.ed .panel.left { left: 0; border-width: 0 1px 0 0; }
.ed .panel.right { right: 0; border-width: 0 0 0 1px; }
.ed .panel h3 { margin: 0; padding: 8px 10px 6px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #8d9abb; }
.ed .tabs { display: flex; gap: 4px; padding: 0 10px 8px; }
.ed .tabs button { flex: 1; padding: 5px 4px; }
.ed .search { margin: 0 10px 8px; }
.ed .search input { width: 100%; }
.ed .items { flex: 1; overflow-y: auto; padding: 0 10px 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; align-content: start; }
.ed .item { height: 86px; padding: 4px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; }
.ed .item img { max-width: 100%; max-height: 52px; object-fit: contain; pointer-events: none; }
.ed .item .swatch { width: 44px; height: 44px; border-radius: 50%; margin-top: 4px; }
.ed .item span { font-size: 10px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #aab5d3; }
.ed .layers { padding: 0 10px 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; border-top: 1px solid #2c3550; }
.ed .layers h3 { grid-column: 1 / -1; padding-left: 0; }
.ed .layers label { display: flex; align-items: center; gap: 5px; font-size: 12px; white-space: nowrap; }
.ed .layers .locked { color: #7c88a8; }
.ed .props { padding: 0 10px 10px; overflow-y: auto; flex: 1; }
.ed .props .what { font-weight: 600; word-break: break-all; }
.ed .props .sub { color: #8d9abb; font-size: 11px; margin-bottom: 8px; word-break: break-all; }
.ed .row { display: grid; grid-template-columns: 84px 1fr; align-items: center; gap: 6px; margin: 5px 0; }
.ed .row.two { grid-template-columns: 84px 1fr 1fr; }
.ed .row input[type=number] { width: 100%; }
.ed .row input[type=range] { width: 100%; }
.ed .row .pair { display: flex; gap: 6px; align-items: center; }
.ed .row .pair output { width: 38px; text-align: right; font-variant-numeric: tabular-nums; color: #aab5d3; }
.ed .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.ed .empty { color: #8d9abb; padding: 4px 0; }
.ed .keys { color: #8d9abb; font-size: 11.5px; line-height: 1.6; margin-top: 12px; border-top: 1px solid #2c3550; padding-top: 8px; }
.ed .keys b { color: #c9d3ee; font-weight: 600; }
.ed .status { position: absolute; left: 0; right: 0; bottom: 0; height: 26px; display: flex; align-items: center; gap: 16px; padding: 0 10px; border-width: 1px 0 0; font-size: 12px; color: #aab5d3; white-space: nowrap; overflow: hidden; }
.ed .status .coords { font-variant-numeric: tabular-nums; min-width: 190px; }
.ed .toast { position: absolute; left: 50%; top: 58px; transform: translateX(-50%); padding: 8px 14px; border-radius: 6px; background: #1c2540; border: 1px solid #5c7cfa; pointer-events: none; max-width: 60%; text-align: center; }
.ed .toast.bad { border-color: #ff6b6b; background: #3a1c22; }
.ed .veil { position: absolute; inset: 0; background: rgba(4, 6, 12, 0.6); pointer-events: auto; display: flex; align-items: center; justify-content: center; }
.ed .modal { padding: 18px 20px; border-radius: 8px; max-width: 420px; }
.ed .modal p { margin: 0 0 14px; }
.ed .modal .actions { justify-content: flex-end; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<Omit<HTMLElementTagNameMap[K], 'style'>> & { class?: string; css?: string } = {}, children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: className, css, ...rest } = props;
  Object.assign(node, rest);
  if (className) node.className = className;
  if (css) node.style.cssText = css;
  node.append(...children);
  return node;
}

const round = (v: number, digits = 2): number => Number(v.toFixed(digits));

/** Teinte et saturation sur 255 (réglages d'une lampe) vers une couleur `#rrggbb`, et retour. */
export function lampColor(hue: number, sat: number): string {
  const h = ((hue / 255) % 1) * 6;
  const s = Math.min(1, Math.max(0, sat / 255));
  const f = (n: number): number => {
    const k = (n + h) % 6;
    return 1 - s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
}

export function colorToLamp(hex: string): { hue: number; sat: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (max === 0 || d === 0) return { hue: 0, sat: 0 };
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: Math.round((h / 6) * 255), sat: Math.round((d / max) * 255) };
}

const LOCKED_LAYERS: { id: LayerId; label: string }[] = [{ id: 'walls', label: 'Walls' }, { id: 'floors', label: 'Floors' }];
/** Couches masquées à l'ouverture : les zones de brouillard recouvrent toute la carte. */
export const HIDDEN_AT_START: ReadonlySet<LayerId> = new Set<LayerId>(['fog']);

type Tab = 'decor' | 'light' | 'decal';

export class EditorUi {
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly handlers: UiHandlers;
  private readonly catalog: Catalog;
  private readonly spriteOf: (object: string) => string | null;
  private tab: Tab = 'decor';
  private tool: PaletteItem | null = null;
  private readonly items: HTMLDivElement;
  private readonly tabs = new Map<Tab, HTMLButtonElement>();
  private readonly search: HTMLInputElement;
  private readonly snapSelect: HTMLSelectElement;
  private readonly props: HTMLDivElement;
  private readonly dot: HTMLSpanElement;
  private readonly undoBtn: HTMLButtonElement;
  private readonly redoBtn: HTMLButtonElement;
  private readonly saveBtn: HTMLButtonElement;
  private readonly saveExitBtn: HTMLButtonElement;
  private readonly lightsBtn: HTMLButtonElement;
  private readonly zoomOut: HTMLSpanElement;
  private readonly coords: HTMLSpanElement;
  private readonly hint: HTMLSpanElement;
  private toastNode: HTMLDivElement | null = null;
  private toastTimer = 0;
  /** Éléments affichés dans le panneau de droite, et les champs à tenir à jour. */
  private shown = 'none yet';
  private readonly fields = new Map<Field, (ent: Ent) => void>();
  private lightsOn = false;

  constructor(title: string, catalog: Catalog, spriteOf: (object: string) => string | null, handlers: UiHandlers) {
    this.handlers = handlers;
    this.catalog = catalog;
    this.spriteOf = spriteOf;
    this.style = el('style', { textContent: CSS });
    document.head.append(this.style);

    // ---- barre d'outils
    this.dot = el('span', { class: 'dot', textContent: '' });
    this.undoBtn = el('button', { textContent: 'Undo', title: 'Ctrl+Z', onclick: () => handlers.undo() });
    this.redoBtn = el('button', { textContent: 'Redo', title: 'Ctrl+Shift+Z', onclick: () => handlers.redo() });
    const snap = el('select', { title: 'Grid snap (G toggles it, Alt ignores it while dragging)' });
    for (const [value, label] of [[1, 'off'], [8, '8 px'], [16, '16 px'], [32, '32 px'], [64, '64 px']] as const) snap.append(el('option', { value: String(value), textContent: label }));
    snap.value = '16';
    snap.onchange = () => handlers.snap(Number(snap.value));
    this.snapSelect = snap;
    this.lightsBtn = el('button', { textContent: 'Lighting preview', title: 'L — the room as lit in the game, without the robots\' own glow', onclick: () => this.setLights(!this.lightsOn, true) });
    this.zoomOut = el('span', { textContent: '100%' });
    this.saveBtn = el('button', { class: 'primary', textContent: 'Save', title: 'Ctrl+S — writes the level file (no git commit)', onclick: () => handlers.save(false) });
    this.saveExitBtn = el('button', { class: 'primary', textContent: 'Save & exit', onclick: () => handlers.save(true) });
    const bar = el('div', { class: 'bar' }, [
      el('button', { textContent: '← Menu', onclick: () => handlers.exit() }),
      el('span', { class: 'name' }, [title, this.dot]),
      this.undoBtn, this.redoBtn,
      el('label', { class: 'inline' }, ['Snap', snap]),
      this.lightsBtn,
      el('button', { textContent: 'Fit', title: '0 — show the whole map (1: back to 100%)', onclick: () => handlers.action('fit') }),
      this.zoomOut,
      el('span', { class: 'grow' }),
      this.saveBtn, this.saveExitBtn,
    ]);

    // ---- palette et couches
    const tabs = el('div', { class: 'tabs' });
    for (const [id, label] of [['decor', 'Props'], ['light', 'Lights'], ['decal', 'Decals']] as const) {
      const button = el('button', { textContent: label, onclick: () => this.showTab(id) });
      this.tabs.set(id, button);
      tabs.append(button);
    }
    this.search = el('input', { type: 'search', placeholder: 'Filter…', oninput: () => this.fillItems() });
    this.items = el('div', { class: 'items' });
    const layers = el('div', { class: 'layers' }, [el('h3', { textContent: 'Show' })]);
    const layerRow = (id: LayerId, label: string, editable: boolean): void => {
      const box = el('input', { type: 'checkbox', checked: !HIDDEN_AT_START.has(id), onchange: () => handlers.layer(id, box.checked) });
      layers.append(el('label', { class: editable ? '' : 'locked', title: editable ? '' : 'Shown, not editable yet' }, [box, editable ? label : `${label} 🔒`]));
    };
    for (const c of CATEGORIES) layerRow(c.id, c.label, EDITABLE.has(c.id));
    for (const l of LOCKED_LAYERS) layerRow(l.id, l.label, false);
    const left = el('div', { class: 'panel left' }, [el('h3', { textContent: 'Place' }), tabs, el('div', { class: 'search' }, [this.search]), this.items, layers]);

    // ---- réglages de la sélection
    this.props = el('div', { class: 'props' });
    const right = el('div', { class: 'panel right' }, [el('h3', { textContent: 'Selection' }), this.props]);

    this.coords = el('span', { class: 'coords' });
    this.hint = el('span');
    const status = el('div', { class: 'status' }, [this.coords, this.hint]);

    this.root = el('div', { class: 'ed' }, [bar, left, right, status]);
    // un clic dans un panneau ne doit pas laisser le clavier dans un champ : la scène reprend les raccourcis
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') (e.target as HTMLElement).blur?.();
    });
    document.body.append(this.root);
    this.showTab('decor');
    this.setSelection([]);
  }

  destroy(): void {
    window.clearTimeout(this.toastTimer);
    this.root.remove();
    this.style.remove();
  }

  /** Vrai si le clavier est dans un champ : les raccourcis de l'éditeur ne doivent pas s'appliquer. */
  static typing(): boolean {
    const a = document.activeElement;
    return a instanceof HTMLElement && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
  }

  // ---------- Barre d'outils ----------

  setStatus(s: UiStatus): void {
    this.dot.textContent = s.dirty ? ' ●' : '';
    this.dot.title = s.dirty ? 'Unsaved changes' : '';
    this.undoBtn.disabled = !s.canUndo;
    this.redoBtn.disabled = !s.canRedo;
    this.saveBtn.disabled = !s.dirty;
    this.zoomOut.textContent = `${Math.round(s.zoom * 100)}%`;
    this.coords.textContent = `x ${Math.round(s.x)}   y ${Math.round(s.y)}`;
    this.hint.textContent = s.hint;
  }

  setSnap(step: number): void {
    this.snapSelect.value = String(step);
  }

  setLights(on: boolean, notify = false): void {
    this.lightsOn = on;
    this.lightsBtn.classList.toggle('on', on);
    if (notify) this.handlers.lights(on);
  }

  setBusy(busy: boolean): void {
    this.saveBtn.disabled = busy;
    this.saveExitBtn.disabled = busy;
  }

  toast(text: string, bad = false): void {
    this.toastNode?.remove();
    window.clearTimeout(this.toastTimer);
    this.toastNode = el('div', { class: bad ? 'toast bad' : 'toast', textContent: text });
    this.root.append(this.toastNode);
    this.toastTimer = window.setTimeout(() => this.toastNode?.remove(), bad ? 7000 : 3500);
  }

  /** Question posée par-dessus l'éditeur ; renvoie le rang du bouton choisi. */
  ask(text: string, buttons: string[]): Promise<number> {
    return new Promise((done) => {
      const veil = el('div', { class: 'veil' });
      const actions = el('div', { class: 'actions' });
      buttons.forEach((label, i) => actions.append(el('button', {
        textContent: label, class: i === 0 ? 'primary' : '', onclick: () => {
          veil.remove();
          done(i);
        },
      })));
      veil.append(el('div', { class: 'modal' }, [el('p', { textContent: text }), actions]));
      this.root.append(veil);
    });
  }

  // ---------- Palette ----------

  private showTab(tab: Tab): void {
    this.tab = tab;
    for (const [id, button] of this.tabs) button.classList.toggle('on', id === tab);
    this.search.value = '';
    this.fillItems();
  }

  private sameItem(a: PaletteItem | null, b: PaletteItem): boolean {
    return !!a && JSON.stringify(a) === JSON.stringify(b);
  }

  private fillItems(): void {
    const filter = this.search.value.trim().toLowerCase();
    const entries: { item: PaletteItem; label: string; sprite: string | null; swatch?: string }[] = [];
    if (this.tab === 'decor') {
      for (const t of this.catalog.objects.values()) {
        if (t.category === 'decor') entries.push({ item: { kind: 'object', object: t.object }, label: t.object.replace(/^obj_/, ''), sprite: this.spriteOf(t.object) });
      }
    } else if (this.tab === 'decal') {
      for (const sprite of this.catalog.decals.keys()) entries.push({ item: { kind: 'decal', sprite }, label: sprite.replace(/^spr_/, ''), sprite });
    } else {
      entries.push({ item: { kind: 'light', spot: false }, label: 'Lamp', sprite: null, swatch: 'radial-gradient(circle, #fff 0%, #fff6 45%, #fff0 70%)' });
      entries.push({ item: { kind: 'light', spot: true }, label: 'Spotlight', sprite: null, swatch: 'conic-gradient(from 60deg, #ffe9b0 0 60deg, #0000 60deg)' });
    }
    entries.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
    this.items.replaceChildren(...entries.filter((e) => e.label.toLowerCase().includes(filter)).map((e) => {
      const picture = e.sprite
        ? el('img', { src: `assets/sprites/${e.sprite}/0.png`, loading: 'lazy', alt: '' })
        : el('div', { class: 'swatch', css: `background: ${e.swatch ?? '#444'}` });
      const button = el('button', { class: this.sameItem(this.tool, e.item) ? 'item on' : 'item', title: e.label }, [picture, el('span', { textContent: e.label })]);
      button.onclick = () => this.handlers.tool(this.sameItem(this.tool, e.item) ? null : e.item);
      return button;
    }));
  }

  /** L'outil de pose en cours (null : sélection). */
  setTool(tool: PaletteItem | null): void {
    this.tool = tool;
    this.fillItems();
  }

  // ---------- Sélection ----------

  setSelection(ents: Ent[]): void {
    const key = ents.map((e) => e.uid).join(',');
    if (key !== this.shown) {
      this.shown = key;
      this.buildProps(ents);
    }
    if (ents.length === 1) for (const update of this.fields.values()) update(ents[0]);
  }

  private help(): HTMLDivElement {
    const node = el('div', { class: 'keys' });
    node.innerHTML = [
      '<b>Click</b> select · <b>Shift+click</b> add · <b>drag</b> move or box-select',
      '<b>R</b> / <b>Shift+R</b> rotate 15° (<b>Alt</b>: 1°) · drag the round handle',
      '<b>F</b> to front · <b>B</b> to back (overlapping elements)',
      '<b>Del</b> delete · <b>Ctrl+D</b> duplicate · <b>arrows</b> nudge',
      '<b>WASD / ZQSD</b> or <b>right-drag</b> pan · <b>wheel</b> zoom',
      '<b>Esc</b> drop the tool or the selection · <b>G</b> snap · <b>L</b> lighting',
      '<b>Ctrl+Z</b> undo · <b>Ctrl+Shift+Z</b> redo · <b>Ctrl+S</b> save',
    ].join('<br>');
    return node;
  }

  private buildProps(ents: Ent[]): void {
    this.fields.clear();
    const h = this.handlers;
    const actions = el('div', { class: 'actions' }, [
      el('button', { textContent: 'To front', title: 'F — drawn over the elements it overlaps', onclick: () => h.action('front') }),
      el('button', { textContent: 'To back', title: 'B — drawn under the elements it overlaps (a chair under its table)', onclick: () => h.action('back') }),
      el('button', { textContent: 'Duplicate', onclick: () => h.action('duplicate') }),
      el('button', { textContent: 'Delete', onclick: () => h.action('delete') }),
    ]);
    if (ents.length === 0) {
      this.props.replaceChildren(el('div', { class: 'empty', textContent: 'Nothing selected. Click an element on the map, or pick one on the left to place it.' }), this.help());
      return;
    }
    if (ents.length > 1) {
      this.props.replaceChildren(el('div', { class: 'what', textContent: `${ents.length} elements` }), el('div', { class: 'sub', textContent: 'Drag to move them together, R to rotate the group.' }), actions, this.help());
      return;
    }
    const ent = ents[0];
    const inst = isInstance(ent) ? ent.data : null;
    const light = inst?.object === LIGHT_OBJECT;
    const rows: HTMLElement[] = [];

    const number = (field: Field, label: string, read: (e: Ent) => number, step = 1, min?: number, max?: number): void => {
      const input = el('input', { type: 'number', step: String(step) });
      if (min !== undefined) input.min = String(min);
      if (max !== undefined) input.max = String(max);
      input.oninput = () => {
        const v = Number(input.value);
        if (input.value !== '' && Number.isFinite(v)) h.edit(field, v);
      };
      this.fields.set(field, (e) => {
        if (document.activeElement !== input) input.value = String(round(read(e)));
      });
      rows.push(el('div', { class: 'row' }, [el('span', { textContent: label }), input]));
    };
    const slider = (field: Field, label: string, read: (e: Ent) => number, min: number, max: number, step: number): void => {
      const input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step) });
      const out = el('output');
      input.oninput = () => {
        out.textContent = String(round(Number(input.value)));
        h.edit(field, Number(input.value));
      };
      this.fields.set(field, (e) => {
        const v = read(e);
        if (document.activeElement !== input) input.value = String(v);
        out.textContent = String(round(v));
      });
      rows.push(el('div', { class: 'row' }, [el('span', { textContent: label }), el('div', { class: 'pair' }, [input, out])]));
    };
    const color = (field: Field, label: string, read: (e: Ent) => string): void => {
      const input = el('input', { type: 'color' });
      input.oninput = () => h.edit(field, input.value);
      this.fields.set(field, (e) => {
        if (document.activeElement !== input) input.value = read(e);
      });
      rows.push(el('div', { class: 'row' }, [el('span', { textContent: label }), input]));
    };
    const check = (field: Field, label: string, title: string, read: (e: Ent) => boolean): void => {
      const input = el('input', { type: 'checkbox', onchange: () => h.edit(field, input.checked) });
      this.fields.set(field, (e) => {
        input.checked = read(e);
      });
      rows.push(el('label', { class: 'inline', title, css: 'margin: 6px 0' }, [input, label]));
    };

    const data = (e: Ent): LevelInstance | LevelDecal => e.data;
    const props = (e: Ent): Record<string, unknown> => (e.data as LevelInstance).props ?? {};
    number('x', 'X', (e) => data(e).x);
    number('y', 'Y', (e) => data(e).y);
    if (light) {
      slider('radius', 'Radius', (e) => lightRadius(e.data as LevelInstance), 60, 1600, 10);
      slider('intensity', 'Intensity', (e) => Number(props(e).lightIntensity ?? 0.5), 0, 1, 0.01);
      color('color', 'Color', (e) => lampColor(Number(props(e).hue ?? 0), Number(props(e).sat ?? 0)));
      check('spot', 'Spotlight (lights a beam only)', 'A cone instead of a full circle; characters and tall props cast a shadow in it.', (e) => props(e).coneAngle !== undefined);
      if (inst!.props.coneAngle !== undefined) {
        number('angle', 'Direction °', (e) => Number(props(e).coneAngle ?? 0), 1);
        slider('coneHalf', 'Beam width °', (e) => Number(props(e).coneHalf ?? 25), 5, 90, 1);
      }
    } else {
      number('angle', 'Angle °', (e) => data(e).angle, 1);
      number('scaleX', 'Scale X', (e) => data(e).scaleX, 0.05);
      number('scaleY', 'Scale Y', (e) => data(e).scaleY, 0.05);
      color('tint', 'Tint', (e) => data(e).tint);
      slider('alpha', 'Opacity', (e) => data(e).alpha, 0, 1, 0.01);
      if (inst && ent.category === 'decor') {
        check('bulletCrossed', 'Bullets fly over it', 'Low furniture: it stops the robots, not the shots.', (e) => props(e).bulletCrossed === true);
        number('shadow', 'Shadow height', (e) => Number(props(e).shadow ?? 0), 5, 0, 300);
      }
      actions.append(
        el('button', { textContent: 'Flip ↔', onclick: () => h.action('flipX') }),
        el('button', { textContent: 'Flip ↕', onclick: () => h.action('flipY') }),
      );
    }
    const what = inst ? inst.object.replace(/^obj_/, '') : (ent.data as LevelDecal).sprite.replace(/^spr_/, '');
    this.props.replaceChildren(
      el('div', { class: 'what', textContent: light ? (inst!.props.coneAngle !== undefined ? 'Spotlight' : 'Lamp') : what }),
      el('div', { class: 'sub', textContent: inst ? `${CATEGORIES.find((c) => c.id === ent.category)?.label ?? ''} · ${inst.id}` : 'Floor decal' }),
      ...rows, actions, this.help(),
    );
  }

  /** Reconstruit le panneau même si la sélection n'a pas changé (un réglage a fait apparaître d'autres champs). */
  rebuild(ents: Ent[]): void {
    this.shown = '';
    this.setSelection(ents);
  }
}
