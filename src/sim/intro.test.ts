// Tests de l'introduction du niveau (GD-077, GD-078) : déroulé de l'arrivée, répliques, passage par l'hôte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { arrivalPhases, arrivalTotal, dropExchange, introLineAt, introLines } from './intro.ts';
import { retrySession, startTeam } from './match.ts';
import { GROUND_FLOOR, UPPER_FLOOR, createSession } from './session.ts';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { LevelData, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

test('arrivée : le vol stationnaire ne s\'ajoute qu\'à l\'introduction complète', () => {
  const a = CONFIG.arrival;
  assert.equal(arrivalTotal(true) - arrivalTotal(false), a.hoverSteps);
  const full = arrivalPhases(arrivalTotal(true));
  assert.equal(full.hover - full.flyIn, a.hoverSteps);
  assert.ok(full.flyIn < full.hover && full.hover < full.descend && full.descend < full.release && full.release < full.hold && full.hold < full.ascend && full.ascend < full.total);
  const short = arrivalPhases(arrivalTotal(false));
  assert.equal(short.hover, short.flyIn, 'pas de vol stationnaire');
  assert.equal(short.hold - short.descend, a.holdSteps, 'l\'échange du largage reste');
});

test('répliques : la radio remplit le vol stationnaire, l\'échange du largage se joue au sol', () => {
  const total = arrivalTotal(true);
  const p = arrivalPhases(total);
  const lines = introLines(['BadaBot', 'PetBot'], total);
  assert.deepEqual(lines.map((l) => l.speaker), ['BadaBot', 'EngiBot', 'PetBot', 'BatBot', 'BadaBot', 'EngiBot', 'BadaBot']);
  assert.equal(lines[0].from, p.flyIn);
  assert.equal(lines[4].to, p.hover);
  for (let i = 1; i < 5; i++) assert.equal(lines[i].from, lines[i - 1].to, 'les répliques radio s\'enchaînent');
  assert.match(lines[2].text, /control room/);
  // au sol : celui qui reste parle dès que le véhicule est posé, la réponse vient quand les pinces s'ouvrent
  assert.deepEqual([lines[5].from, lines[5].to, lines[6].from, lines[6].to], [p.descend, p.release, p.release, p.hold]);
  assert.equal(introLineAt(lines, p.flyIn - 1), null, 'silence pendant l\'entrée du véhicule');
  assert.equal(introLineAt(lines, p.descend - 1), null, 'et pendant la descente');
  assert.equal(introLineAt(lines, p.release)?.speaker, 'BadaBot');
  // quand le niveau recommence, il ne reste que l'échange du largage
  const again = introLines(['BadaBot', 'PetBot'], arrivalTotal(false));
  assert.deepEqual(again.map((l) => l.speaker), ['EngiBot', 'BadaBot']);
});

test('largage : les quinze équipes possibles ont leur échange', () => {
  const expected: Record<string, [string, string, string]> = {
    'BadaBot': ['EngiBot', 'BadaBot', 'One is enough.'],
    'BatBot': ['EngiBot', 'BatBot', 'Alone? Perfect. More for me.'],
    'PetBot': ['EngiBot', 'PetBot', 'Alone, then. I will be careful.'],
    'EngiBot': ['PetBot', 'EngiBot', 'One unit. Sufficient.'],
    'BadaBot,BatBot': ['EngiBot', 'BadaBot', 'BatBot and I. That will do.'],
    'BadaBot,PetBot': ['EngiBot', 'BadaBot', 'PetBot and I. That will do.'],
    'BadaBot,EngiBot': ['PetBot', 'BadaBot', 'EngiBot and I. That will do.'],
    'BatBot,PetBot': ['EngiBot', 'BatBot', 'Me and PetBot? Poor them.'],
    'BatBot,EngiBot': ['PetBot', 'BatBot', 'Me and EngiBot? Poor them.'],
    'PetBot,EngiBot': ['BatBot', 'PetBot', 'EngiBot and I will manage.'],
    'BadaBot,BatBot,PetBot': ['EngiBot', 'BadaBot', 'Three of us. More than enough.'],
    'BadaBot,BatBot,EngiBot': ['PetBot', 'BadaBot', 'Three of us. More than enough.'],
    'BadaBot,PetBot,EngiBot': ['BatBot', 'BadaBot', 'Three of us. More than enough.'],
    'BatBot,PetBot,EngiBot': ['BadaBot', 'BatBot', 'Three of us? This will be quick.'],
  };
  for (const [team, [giver, taker, answer]] of Object.entries(expected)) {
    const players = team.split(',');
    // l'ordre des joueurs ne change rien
    for (const order of [players, [...players].reverse()]) {
      const [stay, go] = dropExchange(order);
      assert.equal(stay[0], giver, `${team} : qui passe la main`);
      assert.ok(!players.includes(stay[0]), `${team} : celui qui passe la main reste à bord`);
      assert.deepEqual(go, [taker, answer], team);
    }
  }
  assert.deepEqual(dropExchange(['PetBot', 'BatBot', 'EngiBot', 'BadaBot']).map((l) => l[0]), ['BadaBot', 'BatBot'], 'les quatre descendent');
  assert.equal(Object.keys(expected).length, 14);
});

test('passer l\'introduction : la touche de dash de l\'hôte, et de lui seul', () => {
  const w = new World(ground, sprites, ['PetBot', 'BatBot'], 3);
  w.npcs = [];
  w.deployHero(true);
  w.drainEvents();
  const dash = { ...NO_INPUT, dashPressed: true };
  for (let i = 0; i < 20; i++) w.step([NO_INPUT, NO_INPUT]);
  const before = w.heroes[0].arrivalSteps;
  w.step([NO_INPUT, dash]);
  assert.equal(w.heroes[0].arrivalSteps, before - 1, 'le deuxième joueur ne passe rien');
  w.hostSlot = 1;
  w.step([NO_INPUT, dash]);
  assert.ok(w.heroes.every((h) => h.arrivalSteps === 0), 'le véhicule est parti');
  const events = w.drainEvents();
  assert.ok(events.some((e) => e.type === 'introSkipped'));
  assert.equal(events.filter((e) => e.type === 'deploy').length, 2, 'les deux robots se déploient');
  assert.ok(w.heroes.every((h) => h.deploySteps === h.deployTotal));
  // une fois l'arrivée finie, la touche redevient le dash
  w.step([NO_INPUT, dash]);
  assert.ok(!w.drainEvents().some((e) => e.type === 'introSkipped'));
});

test('l\'introduction complète ne joue qu\'une fois par partie', () => {
  const session = createSession('EngiBot');
  const first = new World(ground, sprites, session.heroNames, 5, session);
  startTeam(session, first);
  assert.equal(first.hero.arrivalTotal, arrivalTotal(true));
  // Retry sans point de sauvegarde : le niveau recommence, mais seul le largage est rejoué
  const retried = retrySession(session);
  const second = new World(ground, sprites, retried.heroNames, 5, retried);
  startTeam(retried, second);
  assert.equal(second.hero.arrivalTotal, arrivalTotal(false));
  // à l'étage, pas de véhicule
  const upstairs = createSession('EngiBot', UPPER_FLOOR);
  const level = JSON.parse(readFileSync(new URL(`../../public/levels/${UPPER_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
  const third = new World(level, sprites, upstairs.heroNames, 5, upstairs);
  startTeam(upstairs, third);
  assert.equal(third.hero.arrivalTotal, 0);
  assert.equal(upstairs.introSeen, false);
});
