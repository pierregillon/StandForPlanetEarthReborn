# Guide de l'agent

## Ce fichier

- Il est chargé au début de chaque session (`CLAUDE.md` ne fait que l'importer) : chaque ligne coûte du contexte à chaque fois.
- Il ne contient que deux choses : **comment se comporter** dans ce dépôt, et **où trouver** le reste.
- Une règle tient en une ligne. Pas d'explication technique, de procédure ni d'historique : le détail va dans `docs/`, et ce fichier n'en garde que le lien.
- Avant d'ajouter une ligne, se demander si c'est une règle de comportement ou un point d'entrée. Sinon, elle va dans la doc concernée. Reformuler ou remplacer une ligne existante plutôt qu'en ajouter une.

## Le projet

Remake web (TypeScript, Phaser 3, serveur Node) du jeu GameMaker « Stand For Planet Earth » : un jeu de tir coopératif en vue du dessus, où des robots affrontent soldats, robots ennemis et civils. Les sessions ne partagent pas de mémoire : **`docs/` est la mémoire du projet.**

## En début de session

1. [docs/02-feuille-de-route.md](docs/02-feuille-de-route.md) : où en est le projet, prochaine action.
2. [docs/01-cadre-mvp.md](docs/01-cadre-mvp.md) : périmètre, écarts voulus avec l'original, points ouverts.
3. Les index des journaux de décisions ([game design](docs/decisions/game-design.md), [architecture](docs/decisions/architecture.md)), puis en entier les entrées liées au travail.
4. `node --version` (22.18 au moins) et le système : particularités de la machine dans [docs/developpement.md § Selon la machine](docs/developpement.md#selon-la-machine).

## Règles de travail

- **Langue** : documentation et échanges en français ; textes affichés dans le jeu en anglais, comme l'original.
- **Téléchargements** : la connexion de l'utilisateur est limitée. Annoncer la taille et attendre son accord avant tout téléchargement (`npm install`, `git fetch`, `git clone`, assets).
- **Jeu d'origine** : lecture seule (`git show`, `git archive`), jamais de changement de branche ni de push ([docs/reference/](docs/reference/README.md)).
- **Vérifier dans le code** : avant d'implémenter une mécanique, relire le fichier GML d'origine cité par les analyses. Ces analyses sont des lectures du code, pas des certitudes.
- **Narration** : dès qu'un texte montré au joueur, le thème d'un lieu ou le sens d'une mission est en jeu, lire d'abord en entier [docs/narration/arc-narratif.md](docs/narration/arc-narratif.md). Ne la modifier qu'à la demande de l'utilisateur.
- **Décisions** : un choix de gameplay que l'original ne dicte pas reçoit une entrée `GD`, un choix technique structurant une entrée `ADR`. L'entrée va dans le même commit que le changement et dit qui a décidé ([mode d'emploi](docs/decisions/README.md)).
- **Code** : `src/sim`, `src/net` et `server` restent sans Phaser, sans navigateur et sans syntaxe TypeScript non effaçable (`enum`, propriétés-paramètres). Les valeurs d'équilibrage vont dans `src/sim/config.ts` seulement.
- **Sprites manquants** : en fabriquer est autorisé, fidèlement au style d'origine ; le consigner en `GD`.
- **Vérifier** : `npm test` et `npm run typecheck`. Dans le navigateur, garder le panneau affiché, sinon la page tourne au ralenti.
- **Feuille de route** : cocher ce qui est fait et ajouter une ligne au journal à chaque session.
- **Git** : commits intermédiaires sur `main` ; pas de `git push` sans l'accord de l'utilisateur.
- **Proposer de pousser** : à la fin d'une étape, ou dès que plusieurs commits attendent, demander à l'utilisateur s'il veut pousser sur GitHub, sans attendre qu'il y pense. Il n'est pas expert de git : expliquer en une phrase ce qui part et pourquoi (éviter d'accumuler des changements locaux et des conflits).
- **Livraison** : par étapes jouables ; l'utilisateur teste avant la suite.

## Frictions : améliorer ce guide

Une friction, c'est par exemple l'utilisateur qui corrige ou répète une consigne, une commande qui échoue à cause de l'environnement, une doc fausse ou incomplète, ou un aller-retour qu'on aurait pu éviter.

- Une fois la friction résolue, proposer à l'utilisateur, avant la fin du tour, la ligne qui l'aurait évitée. Elle va ici si c'est une règle de comportement ou un point d'entrée, sinon dans la doc concernée.
- Respecter « Ce fichier » : le garder court, et sortir dans `docs/` ce qui s'allonge.
- N'écrire qu'avec l'accord de l'utilisateur.

## Sommaire

Toute la documentation : [docs/README.md](docs/README.md).

| Pour | Lire |
|---|---|
| Lancer, tester, déboguer ; particularités de la machine | [docs/developpement.md](docs/developpement.md) |
| Architecture, multijoueur, chaîne des assets, carte du code | [docs/architecture-code.md](docs/architecture-code.md) |
| Narration, dialogues, consignes de mission | [arc-narratif.md](docs/narration/arc-narratif.md), puis [niveau-tvtv2.md](docs/narration/niveau-tvtv2.md) ; consignes dans `src/sim/session.ts` (`OBJECTIVES`) ; textes d'origine dans [03-niveaux-et-interface.md](docs/reference/jeu-original/03-niveaux-et-interface.md) §6 |
| Gameplay, équilibrage | `src/sim/config.ts`, [analyses du jeu d'origine](docs/reference/jeu-original/) |
| Construction des niveaux | [docs/formats-donnees.md](docs/formats-donnees.md), `public/levels/`, `src/sim/additions.ts` |
| Sprites, effets visuels | [docs/developpement.md § Sprites](docs/developpement.md#sprites-et-animations), `tools/make-sprites.ts`, `src/client/view/WorldView.ts` |
| Le jeu d'origine | [docs/reference/README.md](docs/reference/README.md) |

| Code | Rôle | Entrée |
|---|---|---|
| `src/sim/` | Simulation : toute la logique, 60 steps/s | `world.ts`, `config.ts`, `session.ts` |
| `src/net/`, `server/` | Multijoueur : serveur qui fait autorité, monde miroir du client | `server/game.ts`, `src/net/mirror.ts` |
| `src/client/` | Affichage Phaser | `scenes/GameScene.ts`, `view/WorldView.ts` |
| `tools/` | Build, conversion des salles, fabrication des sprites | `package.json` (scripts) |
| `public/` | Ce que sert le serveur : niveaux, assets | `levels/`, `assets/` |
