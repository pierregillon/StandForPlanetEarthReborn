// Chargement des assets : manifestes produits par tools/extract-assets.ts et choix des sprites à charger.
import { CONFIG } from '../sim/config.ts';
import type { HeroKind } from '../sim/config.ts';
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
  'spr_healthBar', 'spr_cadre_anchor', 'spr_cadre_police', 'spr_fondMenu_1', 'spr_title', 'spr_btn_play', 'spr_btn_exit', 'spr_btn_resume', 'spr_btn_retry',
  'spr_electricity1', 'spr_electricity2', 'spr_electricity3',
  'spr_teleporteur_waiting', 'spr_teleporteur_active', 'spr_fenetre_eclats', 'spr_explosion_robot',
  'spr_spawnVehicle', 'spr_spawnVehicleShadow',
  // effets d'ulti communs à tous les robots (fabriqués, ADR-015) : énergie du lancement, nuage de poussière
  'spr_ulti_charge', 'spr_ulti_charge_top', 'spr_ulti_dust',
  'spr_membreMortHumain_sang', 'spr_membreMortRobot_huile',
  // cartes d'accès et borne : sprites fabriqués (GD-097) ; les cartes s'affichent aussi dans l'interface, dans toutes les salles
  'spr_card_green', 'spr_card_purple', 'spr_outlet',
  ...Array.from({ length: 11 }, (_, i) => `spr_membreMortHumain_${i + 1}`),
  ...Array.from({ length: 11 }, (_, i) => `spr_membreMortRobot_${i + 1}`),
];

/** Sprites communs à toutes les parties de ce niveau (les sprites du héros choisi sont chargés ensuite). */
export function spritesNeeded(level: LevelData, manifest: SpriteManifest): string[] {
  const names = new Set<string>(UI_SPRITES);
  if (level.background.sprite) names.add(level.background.sprite);
  for (const o of Object.values(level.objects)) if (o.sprite) names.add(o.sprite);
  for (const d of level.decals) names.add(d.sprite);
  for (const hero of Object.values(CONFIG.heroes)) {
    names.add(hero.sprites.select);
    names.add(hero.sprites.portrait);
  }
  for (const npc of Object.values(CONFIG.npcs)) {
    for (const s of Object.values(npc.sprites)) if (s) names.add(s);
    if (npc.kind === 'soldier' && npc.bullet) names.add(npc.bullet.sprite);
  }
  return [...names].filter((n) => manifest[n]);
}

/** Familles de sprites propres à chaque héros. */
const HERO_SPRITES: Record<HeroKind, RegExp> = {
  PetBot: /^spr_(PetBot_(?!pointingArrow)|PetDrone|bullet_PetBot$)/,
  EngiBot: /^spr_(EngiBot_(?!pointingArrow)|turet|bullet_pistol$)/,
  BatBot: /^spr_(BatBot_(?!pointingArrow)|batte_BatBot|bullet2_explosion$)/,
  BadaBot: /^spr_(BadaBot_(?!pointingArrow)|plasmaBawl_)/,
};

export function heroSprites(kind: HeroKind, manifest: SpriteManifest): string[] {
  return Object.keys(manifest).filter((n) => HERO_SPRITES[kind].test(n));
}

/** Sprites propres à une salle, chargés à l'entrée (le boss et ses foreuses pèsent lourd). */
const ROOM_SPRITES: Record<string, RegExp> = {
  rm_world2_2: /^spr_(sallyBot_(?!.*HitBox)|explosion_robot$|foreuse_(contours|faisceau)$)/,
};

export function roomSprites(room: string, manifest: SpriteManifest): string[] {
  const pattern = ROOM_SPRITES[room];
  return pattern ? Object.keys(manifest).filter((n) => pattern.test(n)) : [];
}

/** Sons propres à chaque héros ; les autres sons sont communs. */
const HERO_SOUNDS: Record<HeroKind, RegExp> = {
  PetBot: /^snd_petBot_/,
  EngiBot: /^snd_engiBot_/,
  BatBot: /^snd_batBot_/,
  BadaBot: /^snd_badaBot_/,
};
const ANY_HERO_SOUND = /^snd_(petBot|engiBot|batBot|badaBot)_/;

export function commonSounds(sounds: SoundManifest): string[] {
  return Object.keys(sounds).filter((n) => !ANY_HERO_SOUND.test(n));
}

export function heroSounds(kind: HeroKind, sounds: SoundManifest): string[] {
  // PetBot n'a pas de son de déploiement à lui : l'original lui donne celui de BatBot
  return Object.keys(sounds).filter((n) => HERO_SOUNDS[kind].test(n) || (kind === 'PetBot' && n === 'snd_batBot_deploiement'));
}
