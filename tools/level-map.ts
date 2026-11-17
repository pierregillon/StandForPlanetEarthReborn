// Plan annoté d'une salle, en SVG, pour discuter de level design et de mise en scène :
// murs, sols, zones de brouillard numérotées (= les pièces), écrans, personnages, portes, points d'apparition.
// Usage : node tools/level-map.ts rm_world2 rm_world2_1   → docs/narration/plans/<salle>.svg
//         node tools/level-map.ts rm_world2 --crop=x,y,largeur,hauteur --name=aile-est   → un détail, <salle>-aile-est.svg
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { withAdditions } from '../src/sim/additions.ts';
import type { LevelData } from '../src/sim/types.ts';

interface Instance {
  object: string;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  props: Record<string, unknown>;
}
interface Level {
  name: string;
  width: number;
  height: number;
  instances: Instance[];
  wallRects: [number, number, number, number, number][];
  floors: { tileset: string; x: number; y: number; w: number; h: number }[];
}

const FLOOR_COLORS: Record<string, string> = {
  til_sol_accueil: '#5d6b78',
  til_sol_cafet: '#6f6a55',
  til_sol_beton: '#4a4a4a',
  til_sol_studio: '#2b2e3a',
  til_sol_asphalte: '#3a3a40',
  til_sol_carrelage: '#7d8fb0',
  til_sol_pave: '#55504a',
  til_sol_carreau: '#56707a',
  til_sol_moquette1: '#5b4a6b',
  til_sol_moquette2: '#4d5a7a',
  til_sol_parquet: '#7a5f43',
  til_sol_grille: '#3f4a4f',
};

/** Pastilles des personnages : couleur et lettre. */
const PEOPLE: Record<string, [string, string]> = {
  obj_npc_human_pistol: ['#ff4b4b', 'P'],
  obj_npc_robot_lightBot: ['#ff9a2e', 'L'],
  obj_npc_robot_shotBot: ['#ff9a2e', 'S'],
  obj_npc_robot_shield: ['#ff9a2e', 'B'],
  obj_npc_civil_malette: ['#58d868', 'c'],
  obj_npc_civil_femme: ['#58d868', 'c'],
  obj_npc_civil_technicien: ['#58d868', 't'],
  obj_npc_civil_handi: ['#58d868', 'c'],
};

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const n = (v: number): string => String(Math.round(v));

function drawLevel(level: Level, crop: number[] | null): string {
  const out: string[] = [];
  // cadre : ce qui est construit, avec une marge
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x: number, y: number, w = 0, h = 0): void => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  };
  for (const [x, y, w, h] of level.wallRects) grow(x, y, w, h);
  for (const f of level.floors) grow(f.x, f.y, f.w, f.h);
  for (const i of level.instances) grow(i.x, i.y);
  const M = 300;
  x0 = Math.max(0, x0 - M); y0 = Math.max(0, y0 - M);
  x1 = Math.min(level.width, x1 + M); y1 = Math.min(level.height, y1 + M);
  if (crop) [x0, y0, x1, y1] = [crop[0], crop[1], crop[0] + crop[2], crop[1] + crop[3]];
  const W = x1 - x0, H = y1 - y0;

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x0)} ${n(y0 - 260)} ${n(W)} ${n(H + 260)}" font-family="Arial, sans-serif">`);
  out.push(`<rect x="${n(x0)}" y="${n(y0 - 260)}" width="${n(W)}" height="${n(H + 260)}" fill="#26282c"/>`);
  out.push(`<text x="${n(x0 + 60)}" y="${n(y0 - 90)}" font-size="150" fill="#fff" font-weight="bold">${esc(level.name)}</text>`);
  out.push(`<text x="${n(x0 + 1500)}" y="${n(y0 - 90)}" font-size="80" fill="#ccc">` +
    `<tspan fill="#ff4b4b">● P policier</tspan>  <tspan fill="#ff9a2e">● L/S/B robots ennemis</tspan>  <tspan fill="#58d868">● civils (t = technicien)</tspan>  ` +
    `<tspan fill="#35e0ff">■ écran</tspan>  <tspan fill="#c77dff">■ serveur</tspan>  <tspan fill="#ffe14a">▬ porte à bouton, ◆ bouton</tspan>  ` +
    `<tspan fill="#d24bff">▬ porte à carte</tspan>  <tspan fill="#fff">▬ porte auto</tspan>  <tspan fill="#9fd8ff">▬ vitre</tspan><tspan fill="#ffd9a0">n° = pièce (zone de brouillard)</tspan></text>`);

  for (const f of level.floors) {
    out.push(`<rect x="${n(f.x)}" y="${n(f.y)}" width="${n(f.w)}" height="${n(f.h)}" fill="${FLOOR_COLORS[f.tileset] ?? '#444'}"/>`);
  }
  // quadrillage tous les 1000 px, avec ses coordonnées
  for (let x = Math.ceil(x0 / 1000) * 1000; x < x1; x += 1000) {
    out.push(`<line x1="${x}" y1="${n(y0)}" x2="${x}" y2="${n(y1)}" stroke="#fff" stroke-opacity="0.12" stroke-width="6"/>`);
    out.push(`<text x="${x + 12}" y="${n(y0 + 70)}" font-size="64" fill="#fff" fill-opacity="0.5">x ${x}</text>`);
  }
  for (let y = Math.ceil(y0 / 1000) * 1000; y < y1; y += 1000) {
    out.push(`<line x1="${n(x0)}" y1="${y}" x2="${n(x1)}" y2="${y}" stroke="#fff" stroke-opacity="0.12" stroke-width="6"/>`);
    out.push(`<text x="${n(x0 + 12)}" y="${y - 14}" font-size="64" fill="#fff" fill-opacity="0.5">y ${y}</text>`);
  }
  for (const [x, y, w, h, thick] of level.wallRects) {
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${thick ? '#0c0d0f' : '#b9bcc2'}"/>`);
  }

  const labels: string[] = [];
  let fog = 0;
  for (const i of level.instances) {
    const o = i.object;
    if (o === 'obj_warFog') {
      fog++;
      const w = 64 * i.scaleX, h = 64 * i.scaleY;
      out.push(`<rect x="${n(i.x)}" y="${n(i.y)}" width="${n(w)}" height="${n(h)}" fill="none" stroke="#ffd9a0" stroke-opacity="0.55" stroke-width="8" stroke-dasharray="30 22"/>`);
      const attached = i.props.attachedWarFogNumber != null ? `+${String(i.props.attachedWarFogNumber)}` : '';
      const own = i.props.warFogNumber != null ? `/${String(i.props.warFogNumber)}` : '';
      labels.push(`<text x="${n(i.x + 26)}" y="${n(i.y + 120)}" font-size="110" font-weight="bold" fill="#ffd9a0" stroke="#000" stroke-width="5" paint-order="stroke">${fog}<tspan font-size="56">${own}${attached}</tspan></text>`);
    } else if (o === 'obj_ecran') {
      out.push(`<rect x="${n(i.x - 28)}" y="${n(i.y - 28)}" width="56" height="56" fill="#35e0ff"/>`);
    } else if (o === 'obj_serveur' || o === 'obj_rack_serveur') {
      out.push(`<rect x="${n(i.x - 50)}" y="${n(i.y - 50)}" width="100" height="100" fill="#c77dff"/>`);
    } else if (PEOPLE[o]) {
      const [color, letter] = PEOPLE[o];
      out.push(`<circle cx="${n(i.x)}" cy="${n(i.y)}" r="44" fill="${color}" stroke="#000" stroke-width="6"/>`);
      out.push(`<text x="${n(i.x)}" y="${n(i.y + 24)}" font-size="68" font-weight="bold" text-anchor="middle" fill="#000">${letter}</text>`);
    } else if (o === 'obj_automaticDoor' || o === 'obj_door' || o.startsWith('obj_door_card')) {
      const color = o === 'obj_automaticDoor' ? '#ffffff' : o === 'obj_door' ? '#ffe14a' : o.includes('Purple') ? '#d24bff' : '#4bff7b';
      const vertical = Math.abs(Math.round(i.angle / 90)) % 2 === 1;
      const [w, h] = vertical ? [44, 190] : [190, 44];
      out.push(`<rect x="${n(i.x - w / 2)}" y="${n(i.y - h / 2)}" width="${w}" height="${h}" fill="${color}" stroke="#000" stroke-width="5"/>`);
      if (o === 'obj_door') labels.push(`<text x="${n(i.x + 60)}" y="${n(i.y - 60)}" font-size="70" font-weight="bold" fill="#ffe14a" stroke="#000" stroke-width="4" paint-order="stroke">porte ${String(i.props.doorId ?? '?')}</text>`);
    } else if (o === 'obj_button') {
      out.push(`<rect x="${n(i.x - 40)}" y="${n(i.y - 40)}" width="80" height="80" fill="#ffe14a" stroke="#000" stroke-width="5" transform="rotate(45 ${n(i.x)} ${n(i.y)})"/>`);
      labels.push(`<text x="${n(i.x + 60)}" y="${n(i.y + 90)}" font-size="70" font-weight="bold" fill="#ffe14a" stroke="#000" stroke-width="4" paint-order="stroke">bouton ${String(i.props.buttonId ?? i.props.doorId ?? '?')}</text>`);
    } else if (/^obj_spawn[1-4]$/.test(o)) {
      out.push(`<circle cx="${n(i.x)}" cy="${n(i.y)}" r="50" fill="#3d7bff" stroke="#fff" stroke-width="8"/>`);
      labels.push(`<text x="${n(i.x)}" y="${n(i.y + 24)}" font-size="64" font-weight="bold" text-anchor="middle" fill="#fff">${o.slice(-1)}</text>`);
    } else if (o === 'obj_fenetre') {
      // un pan vitré : 32 × 256 px depuis son origine, tourné dans le sens antihoraire de GameMaker
      out.push(`<rect x="${n(i.x)}" y="${n(i.y)}" width="32" height="256" fill="#9fd8ff" transform="rotate(${-i.angle} ${n(i.x)} ${n(i.y)})"/>`);
    } else if (['obj_nextRoom', 'obj_previousRoom', 'obj_endLevel', 'obj_car_van', 'obj_spawnVehicle', 'obj_spawnHeros', 'obj_card_purple', 'obj_card_green', 'obj_table_accueil', 'obj_gene'].includes(o)) {
      const names: Record<string, string> = {
        obj_nextRoom: 'ESCALIER ↑', obj_previousRoom: 'ESCALIER ↓', obj_endLevel: 'SORTIE DU NIVEAU', obj_car_van: 'fourgon',
        obj_spawnVehicle: 'véhicule (départ)', obj_spawnHeros: 'point de largage', obj_card_purple: 'CARTE VIOLETTE',
        obj_card_green: 'CARTE VERTE', obj_table_accueil: 'comptoir d\'accueil', obj_gene: 'générateur',
      };
      out.push(`<circle cx="${n(i.x)}" cy="${n(i.y)}" r="60" fill="none" stroke="#fff" stroke-width="12"/>`);
      labels.push(`<text x="${n(i.x + 80)}" y="${n(i.y + 26)}" font-size="80" font-weight="bold" fill="#fff" stroke="#000" stroke-width="5" paint-order="stroke">${esc(names[o])}</text>`);
    } else if (!o.startsWith('obj_bonus') && o !== 'obj_lumiere') {
      // mobilier : un point discret, pour lire la densité d'une pièce
      out.push(`<circle cx="${n(i.x)}" cy="${n(i.y)}" r="16" fill="#fff" fill-opacity="0.35"/>`);
    }
  }
  out.push(...labels, '</svg>');
  return out.join('\n');
}

const args = process.argv.slice(2);
const option = (name: string): string | null => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? null;
const crop = option('crop')?.split(',').map(Number) ?? null;
const suffix = option('name');
const rooms = args.filter((a) => !a.startsWith('--'));
if (rooms.length === 0) throw new Error('Usage : node tools/level-map.ts <salle> [<salle>...]');
mkdirSync('docs/narration/plans', { recursive: true });
for (const room of rooms) {
  // la salle telle que le jeu la charge : la conversion d'origine, plus les ajouts du remake (ADR-016)
  const level = withAdditions(JSON.parse(readFileSync(`public/levels/${room}.json`, 'utf8')) as LevelData) as unknown as Level;
  const file = `docs/narration/plans/${room}${suffix ? `-${suffix}` : ''}.svg`;
  writeFileSync(file, drawLevel(level, crop));
  console.log(file);
}
