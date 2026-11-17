# Index du dépôt, pour un agent qui reprend le travail

Ce dépôt est le remake web du jeu GameMaker « Stand For Planet Earth » : un jeu de tir coopératif en vue du dessus, où une équipe de robots traverse des niveaux remplis de soldats, de robots ennemis et de civils. Les sessions de travail ne partagent pas de mémoire : la documentation de `docs/` est la mémoire du projet.

Ce fichier dit **où se trouve quoi** et **quoi lire selon le travail**. Les **règles de travail** (téléchargements, dépôt de référence, traçage des décisions, git, commandes, pièges de la machine) sont dans [CLAUDE.md](CLAUDE.md) : elles s'appliquent à tout agent, quel que soit l'outil.

## Quoi lire selon le travail

Dans tous les cas : [CLAUDE.md](CLAUDE.md), puis [docs/02-feuille-de-route.md](docs/02-feuille-de-route.md) (où en est le projet, journal d'avancement).

| Travail | À lire avant de commencer |
|---|---|
| **Game design narratif** : scénario, dialogues, cinématiques, consignes de mission, ordre et thème des niveaux, personnages, cohérence de l'univers et du vocabulaire | **[docs/narration/arc-narratif.md](docs/narration/arc-narratif.md), en entier, à chaque fois** : c'est la référence narrative, écrite par l'utilisateur (GD-076). Puis le [journal de game design](docs/decisions/game-design.md), et ce qui existe déjà dans le jeu : consignes dans `src/sim/session.ts` (`OBJECTIVES`), textes et dialogue d'origine dans [03-niveaux-et-interface.md](docs/reference/jeu-original/03-niveaux-et-interface.md) §6 |
| Gameplay, règles, équilibrage | [docs/decisions/game-design.md](docs/decisions/game-design.md), [docs/01-cadre-mvp.md](docs/01-cadre-mvp.md), `src/sim/config.ts`, les analyses du jeu d'origine dans [docs/reference/jeu-original/](docs/reference/jeu-original/) |
| Construction des niveaux | [docs/formats-donnees.md](docs/formats-donnees.md), [03-niveaux-et-interface.md](docs/reference/jeu-original/03-niveaux-et-interface.md), `public/levels/`, `tools/convert-rooms.ts` |
| Code, architecture, multijoueur | [docs/decisions/architecture.md](docs/decisions/architecture.md) (ADR-005 séparation simulation / affichage, ADR-014 multijoueur) |
| Sprites, animations, effets visuels | `tools/make-sprites.ts` (ADR-015), `src/client/view/WorldView.ts`, [cahier des charges graphique d'époque](docs/reference/documents-origine/cahier-des-charges-graphismes.pdf) |
| Lire le jeu d'origine | [docs/reference/README.md](docs/reference/README.md) : accès au code de 2019, pièges à éviter |

Un travail purement technique (code, sprites, équilibrage) n'a pas besoin de l'arc narratif. Dès qu'un texte montré au joueur, le thème d'un lieu ou le sens d'une mission est en jeu, il faut le lire.

## La documentation — `docs/`

| Fichier | Contenu |
|---|---|
| [narration/arc-narratif.md](docs/narration/arc-narratif.md) | **Référence narrative** : concept, les six actes SFPE, les quatre actes SFHB, dénouement, alternance des époques, personnages (le chimiste, le scientifique, PLUTO), thématique, questions en suspens |
| [01-cadre-mvp.md](docs/01-cadre-mvp.md) | Périmètre de la première version, sources de vérité, points ouverts |
| [02-feuille-de-route.md](docs/02-feuille-de-route.md) | Étapes de livraison, état actuel, journal d'avancement (une ligne par changement) |
| [decisions/game-design.md](docs/decisions/game-design.md) | Journal des décisions de game design (`GD-xxx`) : quoi, pourquoi, décidé par qui |
| [decisions/architecture.md](docs/decisions/architecture.md) | Journal des décisions techniques (`ADR-xxx`) |
| [decisions/README.md](docs/decisions/README.md) | Quand et comment ajouter une entrée aux journaux |
| [formats-donnees.md](docs/formats-donnees.md) | Formats des niveaux et des manifestes d'assets |
| [reference/README.md](docs/reference/README.md) | Le jeu d'origine : dépôt, commit de référence, comment le lire |
| [reference/jeu-original/](docs/reference/jeu-original/) | Trois analyses du code de 2019 : héros et joueur, ennemis et IA, niveaux et interface |
| [reference/documents-origine/](docs/reference/documents-origine/) | Documents de conception d'époque (PDF) : GDD, cahier des charges graphique, ancien scénario (remplacé par l'arc narratif) |

## Le code

| Dossier | Rôle | Fichiers clés |
|---|---|---|
| `src/sim/` | La simulation : toute la logique du jeu, 60 pas par seconde, sans Phaser ni navigateur | `config.ts` (**tous les réglages d'équilibrage**), `world.ts` (boucle, dégâts, objectifs), `hero.ts`, `abilities.ts`, `ulti.ts`, `link.ts`, `npc.ts` (soldats et civils), `boss.ts`, `nav.ts`, `visibility.ts`, `session.ts` (consignes, état de la partie), `types.ts` ; tests `*.test.ts` |
| `src/net/` | Multijoueur : instantanés et monde miroir du client | `snapshot.ts`, `mirror.ts`, `messages.ts`, `net.test.ts` |
| `server/` | Serveur Node : fichiers statiques, WebSocket, salon de jeu | `main.ts`, `game.ts` |
| `src/client/` | Affichage Phaser | `scenes/` (menu, choix du niveau et du héros, salon, jeu), `view/WorldView.ts` (dessin du monde et effets), `view/Hud.ts`, `assets.ts`, `sfx.ts`, `keys.ts`, `net/Connection.ts` |
| `tools/` | Outils de fabrication | `build.ts`, `convert-rooms.ts` (salles GameMaker → JSON), `extract-assets.ts` + `assets.config.json`, `make-sprites.ts` (sprites fabriqués) |
| `public/` | Ce que sert le serveur | `levels/*.json` (les salles du monde 2), `assets/sprites/` + `sprites.json`, `assets/floors/`, `assets/sounds/`, `fonts/`, `index.html` |

Racine : `start.cmd` (lancer le jeu), `dev.cmd` (développer), `package.json`, [README.md](README.md) (présentation et commandes pour un humain).

## Ce qui n'est pas dans git

| Emplacement | Contenu |
|---|---|
| `.tools/` | Node 22 portable (`.tools/node22`), à utiliser à la place du Node 14 du système |
| `.cache/reference/` | Projet GameMaker de 2019 extrait ; se recrée avec `npm run extract-assets` |
| `dist/`, `node_modules/` | Produits de la construction et dépendances |
| `C:\Users\gillo\Code\Stand-For-Planet-Earth` | Dépôt du jeu d'origine, en lecture seule (étiquette `remake-reference-2019`) ; son dossier `Resources` contient les sources graphiques et les musiques |
