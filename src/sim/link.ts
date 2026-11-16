// Link entre héros (GD-043) : un robot donne son énergie à un coéquipier par un lien qu'il pose et garde.
// Sa réserve passe d'abord, puis sa régénération, amplifiée : liée, l'équipe produit plus d'énergie que séparée.
// C'est ce qui permet au receveur d'atteindre la surcharge, donc son ulti.
import { CONFIG } from './config.ts';
import type { Hero, Input } from './types.ts';
import type { World } from './world.ts';

const L = CONFIG.link;

/** Héros qui donnent leur énergie à celui-ci. */
export function donorsOf(world: World, h: Hero): Hero[] {
  return world.heroes.filter((o) => !o.gone && o.linkTo === h.id);
}

/** Force du lien selon la distance : entière jusqu'à `fullRange`, puis elle baisse jusqu'à `minFactor` à `maxRange`. */
export function linkFactor(distance: number): number {
  if (distance <= L.fullRange) return 1;
  const t = Math.min(1, (distance - L.fullRange) / (L.maxRange - L.fullRange));
  return 1 - t * (1 - L.minFactor);
}

function linkable(h: Hero): boolean {
  return !h.gone && h.state !== 'dead' && h.arrivalSteps === 0 && h.deploySteps === 0;
}

/** L'allié visé : le plus proche de la ligne de visée, devant soi, à portée et en vue. */
function aimedAlly(world: World, h: Hero, input: Input): Hero | null {
  const ax = input.aimX - h.x;
  const ay = input.aimY - h.y;
  const len = Math.hypot(ax, ay) || 1;
  const ux = ax / len;
  const uy = ay / len;
  let best: Hero | null = null;
  let bestOff = Infinity;
  for (const o of world.heroes) {
    // on ne se lie ni à un robot qui donne déjà (pas de chaîne), ni à un robot en plein ulti
    if (o === h || !linkable(o) || o.linkTo >= 0 || o.ultiPhase > 0) continue;
    const dx = o.x - h.x;
    const dy = o.y - h.y;
    if (dx * ux + dy * uy <= 0 || Math.hypot(dx, dy) > L.maxRange) continue;
    const dist = Math.hypot(dx, dy);
    const off = Math.abs(dx * uy - dy * ux);
    if (off > L.aimWidth || world.sightBlocked(h.x, h.y, o.x, o.y)) continue;
    // deux robots dans l'axe : le plus proche l'emporte
    const score = off + dist * 0.05;
    if (score >= bestOff) continue;
    bestOff = score;
    best = o;
  }
  return best;
}

/** Coupe le lien que ce héros donne. Le surplus du receveur tient encore un moment, comme après une borne. */
export function unlink(world: World, h: Hero): void {
  if (h.linkTo < 0) return;
  const target = world.heroes[h.linkTo];
  h.linkTo = -1;
  h.linkTimer = 0;
  h.linkStrength = 0;
  if (!target) return;
  if (target.energy > CONFIG.hero.naturalEnergy) target.overchargeHold = CONFIG.hero.overchargeHoldSteps;
  world.emit({ type: 'unlinked', from: h.id, to: target.id });
}

/** Coupe tous les liens que ce héros reçoit (il lance son ulti, ou il appuie sur la touche de lien). */
export function dropDonors(world: World, h: Hero): void {
  for (const donor of donorsOf(world, h)) unlink(world, donor);
}

export function stepLink(world: World, h: Hero, input: Input): void {
  if (input.linkPressed) {
    // la même touche pose le lien et le coupe, pour celui qui donne comme pour celui qui reçoit
    if (h.linkTo >= 0) {
      unlink(world, h);
    } else if (donorsOf(world, h).length > 0) {
      dropDonors(world, h);
    } else {
      const target = aimedAlly(world, h, input);
      if (target) {
        h.linkTo = target.id;
        h.linkTimer = 0;
        world.emit({ type: 'linked', from: h.id, to: target.id });
      }
    }
  }
  if (h.linkTo < 0) return;
  const target = world.heroes[h.linkTo];
  const distance = target ? Math.hypot(target.x - h.x, target.y - h.y) : Infinity;
  // le lien casse si l'on s'éloigne trop, si un mur s'interpose, ou si le receveur tombe
  if (!target || !linkable(target) || distance > L.maxRange || world.sightBlocked(h.x, h.y, target.x, target.y)) {
    unlink(world, h);
    return;
  }
  h.linkStrength = linkFactor(distance);
  if (target.energy >= CONFIG.hero.maxEnergy) {
    h.linkTimer = 0;
    return;
  }
  // débit : toute l'équipe liée de près à un même robot lui apporte 1 point toutes les `teamStepsPerEnergy` ;
  // chaque lien en porte sa part. À deux joueurs, un lien débite donc autant que trois liens à quatre.
  const givers = Math.max(1, world.present().length - 1);
  h.linkTimer += h.linkStrength / (L.teamStepsPerEnergy * givers);
  if (h.linkTimer < 1) return;
  h.linkTimer -= 1;
  // le don : la réserve de celui qui donne passe d'abord ; vide, c'est sa régénération amplifiée qui passe
  if (h.energy > 0) h.energy--;
  target.energy++;
}
