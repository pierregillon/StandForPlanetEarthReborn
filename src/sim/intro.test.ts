// Tests de l'introduction du niveau (GD-077 à GD-079) : déroulé de l'arrivée, répliques que l'hôte fait
// défiler, touche tenue qui passe la séquence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { arrivalPhases, arrivalTotal, crewReleased, dropExchange, introLines, typingSteps } from './intro.ts';
import { retrySession, startTeam } from './match.ts';
import { GROUND_FLOOR, UPPER_FLOOR, createSession } from './session.ts';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { Input, LevelData, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

const PRESS: Input = { ...NO_INPUT, dashPressed: true, dash: true };

/** Monde où l'arrivée vient de commencer. */
function arriving(names: string[], full = true): World {
  const w = new World(ground, sprites, names, 3);
  w.npcs = [];
  w.deployHero(true, full);
  w.drainEvents();
  return w;
}

/** Horloge de l'arrivée. */
const clock = (w: World): number => w.heroes[0].arrivalTotal - w.heroes[0].arrivalSteps;

test('arrivée : le vol stationnaire ne s\'ajoute qu\'à l\'introduction complète', () => {
  const a = CONFIG.arrival;
  assert.equal(arrivalTotal(true) - arrivalTotal(false), a.hoverSteps);
  const full = arrivalPhases(arrivalTotal(true));
  assert.ok(full.full);
  assert.equal(full.hover - full.flyIn, a.hoverSteps);
  assert.ok(full.flyIn < full.hover && full.hover < full.descend && full.descend < full.hold && full.hold < full.ascend && full.ascend < full.total);
  const short = arrivalPhases(arrivalTotal(false));
  assert.ok(!short.full);
  assert.equal(short.hover, short.flyIn, 'pas de vol stationnaire');
});

test('répliques : la radio en vol, l\'échange du largage au sol', () => {
  const total = arrivalTotal(true);
  const p = arrivalPhases(total);
  const lines = introLines(['BadaBot', 'PetBot'], total);
  assert.deepEqual(lines.map((l) => l.speaker), ['BadaBot', 'EngiBot', 'PetBot', 'BatBot', 'BadaBot', 'EngiBot', 'BadaBot']);
  assert.deepEqual(lines.map((l) => l.at), [p.hover, p.hover, p.hover, p.hover, p.hover, p.descend, p.descend]);
  assert.match(lines[2].text, /control room/);
  assert.deepEqual(lines.map((l) => l.release === true), [false, false, false, false, false, false, true], 'les pinces s\'ouvrent à la réponse');
  // les robots joués quittent leur pince quand la réponse commence, pas avant
  assert.equal(crewReleased(lines, p, p.descend - 1, 5), false);
  assert.equal(crewReleased(lines, p, p.descend, 5), false, 'pendant que celui qui reste parle');
  assert.equal(crewReleased(lines, p, p.descend, 6), true);
  assert.equal(crewReleased(lines, p, p.descend + 1, 7), true);
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

test('une réplique attend l\'appui de l\'hôte : un appui finit de l\'écrire, le suivant passe à la suite (GD-079)', () => {
  const w = arriving(['PetBot']);
  const p = arrivalPhases(w.hero.arrivalTotal);
  const lines = introLines(['PetBot'], w.hero.arrivalTotal);
  // le véhicule arrive et se stabilise : l'horloge tourne
  for (let i = 0; i < p.hover; i++) w.step(NO_INPUT);
  assert.equal(clock(w), p.hover);
  // la première réplique s'écrit ; l'horloge ne bouge plus tant que personne n'appuie
  for (let i = 0; i < 200; i++) w.step(NO_INPUT);
  assert.equal(clock(w), p.hover, 'l\'horloge est arrêtée');
  assert.equal(w.introLine, 0);
  assert.ok(w.introLineSteps >= typingSteps(lines[0].text), 'la réplique est écrite en entier');
  w.step(PRESS);
  assert.equal(w.introLine, 1, 'un appui passe à la réplique suivante');
  assert.equal(w.introLineSteps, 0);
  // appui pendant l'écriture : la réplique s'écrit d'un coup, sans passer à la suivante
  w.step(NO_INPUT);
  w.step(NO_INPUT);
  w.step(PRESS);
  assert.equal(w.introLine, 1);
  assert.equal(w.introLineSteps, typingSteps(lines[1].text));
  w.step(PRESS);
  assert.equal(w.introLine, 2);
  // deux appuis par réplique jusqu'à la fin de la radio : le véhicule descend alors
  while (w.introLine < 5) w.step(PRESS);
  w.step(NO_INPUT);
  assert.ok(clock(w) > p.hover, 'l\'horloge repart après la dernière réplique radio');
  for (let i = 0; i < CONFIG.arrival.descendSteps; i++) w.step(NO_INPUT);
  assert.equal(clock(w), p.descend, 'posé : l\'horloge s\'arrête pour l\'échange du largage');
  while (w.introLine < lines.length) w.step(PRESS);
  let left = false;
  for (let i = 0; i < 400 && w.hero.arrivalSteps > 0; i++) {
    w.step(NO_INPUT);
    left ||= w.drainEvents().some((e) => e.type === 'vehicleLeaves');
  }
  assert.ok(left, 'le véhicule redécolle');
  assert.equal(w.hero.arrivalSteps, 0);
});

test('sans appui, une réplique finit par laisser la place à la suivante', () => {
  const w = arriving(['PetBot']);
  const p = arrivalPhases(w.hero.arrivalTotal);
  const first = introLines(['PetBot'], w.hero.arrivalTotal)[0];
  for (let i = 0; i < p.hover; i++) w.step(NO_INPUT);
  const wait = typingSteps(first.text) + CONFIG.arrival.autoAdvanceSteps;
  for (let i = 0; i < wait - 1; i++) w.step(NO_INPUT);
  assert.equal(w.introLine, 0);
  w.step(NO_INPUT);
  assert.equal(w.introLine, 1);
});

test('seul l\'hôte mène la séquence : tenir la touche la passe en entier', () => {
  const w = arriving(['PetBot', 'BatBot']);
  const p = arrivalPhases(w.heroes[0].arrivalTotal);
  for (let i = 0; i < p.hover + 5; i++) w.step([NO_INPUT, NO_INPUT]);
  // le deuxième joueur appuie, puis tient la touche : rien ne se passe
  for (let i = 0; i < CONFIG.arrival.skipHoldSteps + 10; i++) w.step([NO_INPUT, PRESS]);
  assert.equal(w.introLine, 0);
  assert.equal(w.introHold, 0);
  assert.ok(w.heroes[0].arrivalSteps > 0);
  // l'hôte tient la touche : la jauge monte, puis la séquence est passée
  w.hostSlot = 1;
  const hold: Input = { ...NO_INPUT, dash: true };
  for (let i = 0; i < CONFIG.arrival.skipHoldSteps - 1; i++) w.step([NO_INPUT, hold]);
  assert.equal(w.introHold, CONFIG.arrival.skipHoldSteps - 1);
  assert.ok(w.heroes[0].arrivalSteps > 1);
  w.step([NO_INPUT, hold]);
  assert.ok(w.heroes.every((h) => h.arrivalSteps === 0), 'le véhicule est parti');
  const events = w.drainEvents();
  assert.ok(events.some((e) => e.type === 'introSkipped'));
  assert.equal(events.filter((e) => e.type === 'deploy').length, 2, 'les deux robots se déploient');
  assert.ok(w.heroes.every((h) => h.deploySteps === h.deployTotal));
  // relâcher avant la fin remet la jauge à zéro
  const again = arriving(['PetBot']);
  for (let i = 0; i < 20; i++) again.step(hold);
  again.step(NO_INPUT);
  assert.equal(again.introHold, 0);
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
