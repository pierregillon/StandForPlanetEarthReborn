// Chargement des assets : manifestes produits par tools/extract-assets.ts et choix des sprites à charger.
import { CONFIG } from '../sim/config.ts';
import type { LevelData, SpriteManifest } from '../sim/types.ts';

export interface FloorInfo {
  image: string;
  srcX: number;
  srcY: number;
  periodW: number;
  periodH: number;
}
export type FloorManifest = Record<string, FloorInfo>;
export type SoundManifest = Record<string, { file: string; bytes: number }>;

/** Clé de texture Phaser d'une image de sprite. */
export function frameKey(sprite: string, frame: number): string {
  return `${sprite}/${frame}`;
}

/** Sprites de l'interface et des effets, en plus de ceux du niveau et des personnages. */
const UI_SPRITES = [
  'spr_healthBar', 'spr_fondMenu_1', 'spr_title', 'spr_btn_play', 'spr_btn_exit', 'spr_btn_resume', 'spr_btn_retry',
  'spr_electricity1', 'spr_electricity2', 'spr_electricity3',
  'spr_teleporteur_waiting', 'spr_teleporteur_active', 'spr_fenetre_eclats',
  'spr_membreMortHumain_sang', 'spr_membreMortRobot_huile',
  ...Array.from({ length: 11 }, (_, i) => `spr_membreMortHumain_${i + 1}`),
  ...Array.from({ length: 11 }, (_, i) => `spr_membreMortRobot_${i + 1}`),
];

/** Liste des sprites nécessaires pour jouer ce niveau. */
export function spritesNeeded(level: LevelData, manifest: SpriteManifest): string[] {
  const names = new Set<string>(UI_SPRITES);
  if (level.background.sprite) names.add(level.background.sprite);
  for (const o of Object.values(level.objects)) if (o.sprite) names.add(o.sprite);
  for (const d of level.decals) names.add(d.sprite);
  for (const hero of Object.values(CONFIG.heroes)) {
    for (const s of Object.values(hero.sprites)) names.add(s);
    names.add(hero.bullet.sprite);
  }
  for (const npc of Object.values(CONFIG.npcs)) {
    for (const s of Object.values(npc.sprites)) if (s) names.add(s);
    if (npc.kind === 'soldier' && npc.bullet) names.add(npc.bullet.sprite);
  }
  return [...names].filter((n) => manifest[n]);
}
