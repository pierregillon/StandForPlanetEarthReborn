// Zone éclairée par une lampe : polygone de ce qu'on voit depuis un point, murs et portes faisant écran.
// Sert aux ombres portées (GD-038). Géométrie pure, sans Phaser.
import { TAU } from './geom.ts';
import type { CollisionWorld } from './geom.ts';
import type { Point } from './nav.ts';

/** Nombre de rayons tirés régulièrement pour dessiner le bord du cercle là où rien ne fait écran. */
const RING_RAYS = 48;
/** Écart angulaire des deux rayons tirés de part et d'autre de chaque coin d'obstacle. */
const CORNER_EPSILON = 0.0015;

/**
 * Polygone visible depuis (x, y) jusqu'à `radius`, les obstacles ayant un des drapeaux `mask` arrêtant la
 * lumière. `reach` prolonge chaque rayon de quelques pixels dans l'obstacle touché, pour que la face du mur
 * soit éclairée. Les points sont rendus dans l'ordre des angles.
 */
export function visibilityPolygon(world: CollisionWorld, x: number, y: number, radius: number, mask: number, reach = 0): Point[] {
  const angles: number[] = [];
  for (let k = 0; k < RING_RAYS; k++) angles.push((k / RING_RAYS) * TAU);
  // un rayon vers chaque coin d'obstacle, et un de chaque côté : c'est là que les ombres commencent
  for (const o of world.obstaclesIn(x - radius, y - radius, x + radius, y + radius, mask)) {
    for (let k = 0; k < 4; k++) {
      const sx = k < 2 ? 1 : -1;
      const sy = k % 2 === 0 ? 1 : -1;
      const cx = o.cx + sx * o.hw * o.cos - sy * o.hh * o.sin;
      const cy = o.cy + sx * o.hw * o.sin + sy * o.hh * o.cos;
      if (Math.hypot(cx - x, cy - y) > radius * 1.05) continue;
      const a = Math.atan2(cy - y, cx - x);
      angles.push(a - CORNER_EPSILON, a, a + CORNER_EPSILON);
    }
  }
  for (let i = 0; i < angles.length; i++) angles[i] = ((angles[i] % TAU) + TAU) % TAU;
  angles.sort((a, b) => a - b);

  const points: Point[] = [];
  for (const a of angles) {
    const ex = x + Math.cos(a) * radius;
    const ey = y + Math.sin(a) * radius;
    const hit = world.raycast(x, y, ex, ey, mask);
    const t = hit ? Math.min(1, hit.t + reach / radius) : 1;
    points.push({ x: x + (ex - x) * t, y: y + (ey - y) * t });
  }
  return points;
}
