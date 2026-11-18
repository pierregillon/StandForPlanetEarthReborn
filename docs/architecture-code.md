# Architecture et carte du code

Vue d'ensemble du code et de ses outils. Les raisons de chaque choix sont dans le [journal des décisions techniques](decisions/architecture.md) (ADR cités entre parenthèses). Pour lancer et déboguer : [developpement.md](developpement.md).

## Principe

Toute la logique du jeu vit dans un objet `World` (`src/sim`), avancé d'un step à la fois (60 par seconde) par `world.step(entrées)`. Il ne dépend ni de Phaser ni du navigateur et a son propre générateur aléatoire (ADR-005, ADR-011). L'affichage Phaser (`src/client`) lit l'état du monde à chaque image, sans jamais le modifier, et consomme une file d'événements : sons, impacts, morts. Les réglages d'équilibrage sont tous dans `src/sim/config.ts`, dans les unités du jeu d'origine (pixels, steps).

```
Solo
  clavier, souris ──entrées──▶ World (src/sim) ──état, événements──▶ WorldView, Hud (src/client)
                               GameScene appelle world.step 60 fois par seconde

Multijoueur (ADR-014)
  navigateur ──entrées numérotées, WebSocket /ws──▶ server/game.ts : Lobby ─▶ World (fait autorité)
  navigateur ◀──instantanés différentiels, 20/s (src/net/snapshot.ts)──┘
      └─ src/net/mirror.ts : World miroir, jamais avancé par step ─▶ même affichage qu'en solo
```

## Multijoueur

- **Le serveur fait tourner le jeu.** `Lobby` (`server/game.ts`) tient le salon puis la partie : il avance le même `World` que le solo, avec une entrée par joueur et par step. Il ne connaît pas les WebSockets (il parle à des « pairs »), ce qui le rend testable sans réseau. `server/main.ts` sert les fichiers statiques et ouvre les WebSockets.
- **Instantanés** (`src/net/snapshot.ts`) : seuls les champs simples qui ont changé depuis l'envoi précédent. Ajouter un champ à une entité le synchronise d'office ; s'il change à chaque step sans servir à l'affichage, l'ajouter aux exclusions de `LISTS`.
- **Miroir** (`src/net/mirror.ts`) : le navigateur construit un `World` depuis la même salle et le met à jour avec les instantanés. Pour masquer le délai : le robot du joueur est prédit avec le code du serveur (`steerHero`), les autres personnages glissent d'une position à l'autre, les balles avancent seules.
- **Changement de salle** : chaque client charge la salle puis répond « prêt » ; le jeu reprend quand tous ont répondu.
- Messages échangés : `src/net/messages.ts`. Connexion côté navigateur : `src/client/net/Connection.ts`. Tests sans navigateur : `src/net/net.test.ts`.

## Niveaux et assets

```
dépôt d'origine (étiquette remake-reference-2019)
 └─ .cache/reference/ ── extrait au besoin par tools/lib/reference.ts
     ├─ npm run convert-rooms  ─▶ public/levels/*.json             (formats : formats-donnees.md)
     └─ npm run extract-assets ─▶ public/assets/{sprites,floors,sounds}/ + manifestes *.json
                                  puis relance make-sprites
npm run make-sprites ─▶ ultis et rechargements des robots, recomposés des sprites d'origine (ADR-015)
npm run make-studio  ─▶ sprites et sols de l'aile est de TvTv², dessinés avec tools/lib/draw.ts
npm run level-map    ─▶ plans annotés en SVG dans docs/narration/plans/
```

- Les salles d'origine converties ne sont jamais retouchées : ce que le remake ajoute, retire ou déplace est décrit dans `src/sim/additions.ts`, greffé au chargement par `withAdditions(level)` (ADR-016). Toute l'aile est de TvTv² y est décrite.
- Le navigateur charge une image par fichier, seulement pour la salle en cours (ADR-012).

## Carte du code

| Dossier | Rôle | Fichiers clés |
|---|---|---|
| `src/sim/` | La simulation : toute la logique du jeu | `world.ts` (boucle, dégâts, objectifs), `config.ts` (**tous les réglages**), `session.ts` (consignes `OBJECTIVES`, état de la partie), `types.ts` |
| | Héros | `hero.ts`, `abilities.ts`, `ulti.ts`, `link.ts` (lien d'énergie entre robots) |
| | Adversaires et personnages | `npc.ts` (soldats et civils), `boss.ts`, `wave.ts` (riposte de la police après l'ultimatum), `nav.ts` (grille et chemins A* des PNJ) |
| | Monde et partie | `geom.ts` (géométrie, collisions), `visibility.ts` (zones éclairées, ombres), `match.ts` (enchaînement des salles, solo et serveur) |
| | Séquences scénarisées | `intro.ts` (introduction du niveau), `broadcast.ts` (l'ultimatum), `scenes.ts` (face-à-face avec le barrage, extraction finale) |
| | Contenu des salles | `additions.ts` (ajouts du remake aux salles d'origine) |
| `src/net/` | Multijoueur, partagé client et serveur | `snapshot.ts`, `mirror.ts`, `messages.ts`, `net.test.ts` |
| `server/` | Serveur Node : fichiers statiques, WebSocket, salon | `main.ts`, `game.ts` |
| `src/client/` | Affichage Phaser | `main.ts`, `scenes/` (menu, choix du niveau et du héros, salon, `GameScene.ts`), `view/WorldView.ts` (dessin du monde, effets), `view/Hud.ts`, `view/IntroOverlay.ts` (bandes de cinéma, dialogues), `assets.ts`, `sfx.ts`, `keys.ts` |
| `tools/` | Fabrication | `build.ts` (esbuild vers `dist/game.js`), `convert-rooms.ts`, `extract-assets.ts` + `assets.config.json`, `make-sprites.ts`, `make-studio.ts`, `level-map.ts` ; `lib/` (lecture du projet GameMaker, PNG, dessin) |
| `public/` | Ce que sert le serveur | `index.html`, `levels/*.json`, `assets/` (sprites, sols, sons et leurs manifestes), `fonts/` |

Les tests sont à côté du code (`*.test.ts`) et tournent avec `node --test`.
