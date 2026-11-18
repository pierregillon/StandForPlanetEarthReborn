# Guide de reprise pour une session de travail

Ce dépôt est le remake web du jeu GameMaker « Stand For Planet Earth » : un jeu de tir coopératif en vue du dessus, où une équipe de robots traverse des niveaux remplis de soldats, de robots ennemis et de civils. Les sessions de travail ne partagent pas de mémoire : **la documentation de `docs/` est la mémoire du projet.**

Ce fichier est le seul guide pour un agent : règles de travail, quoi lire selon le travail, où se trouve quoi. `CLAUDE.md` ne contient qu'une ligne qui l'importe.

## Avant de travailler

Lire, dans cet ordre :

1. `docs/02-feuille-de-route.md` — où en est le projet, quelle est la prochaine action.
2. `docs/01-cadre-mvp.md` — le périmètre, les écarts voulus avec le jeu d'origine, les points ouverts.
3. `docs/decisions/game-design.md` et `docs/decisions/architecture.md` — les décisions prises et leurs raisons.
4. `docs/reference/README.md` — comment lire le code d'origine, et les pièges à éviter.

**Pour tout travail de game design narratif** (scénario, dialogues, cinématiques, consignes de mission, ordre et thème des niveaux, personnages, cohérence de l'univers et du vocabulaire) : lire d'abord, en entier, `docs/narration/arc-narratif.md`. C'est la référence narrative écrite par l'utilisateur (GD-076) ; on ne la modifie qu'à sa demande. Un travail purement technique (code, sprites, équilibrage) n'en a pas besoin. Dès qu'un texte montré au joueur, le thème d'un lieu ou le sens d'une mission est en jeu, il faut la lire.

### Quoi lire en plus, selon le travail

| Travail | À lire avant de commencer |
|---|---|
| **Game design narratif** | **[docs/narration/arc-narratif.md](docs/narration/arc-narratif.md), en entier, à chaque fois.** Pour le niveau en cours : [docs/narration/niveau-tvtv2.md](docs/narration/niveau-tvtv2.md). Puis ce qui existe déjà dans le jeu : consignes dans `src/sim/session.ts` (`OBJECTIVES`), textes et dialogue d'origine dans [03-niveaux-et-interface.md](docs/reference/jeu-original/03-niveaux-et-interface.md) §6 |
| Gameplay, règles, équilibrage | `src/sim/config.ts`, les analyses du jeu d'origine dans [docs/reference/jeu-original/](docs/reference/jeu-original/) |
| Construction des niveaux | [docs/formats-donnees.md](docs/formats-donnees.md), [03-niveaux-et-interface.md](docs/reference/jeu-original/03-niveaux-et-interface.md), `public/levels/`, `tools/convert-rooms.ts` |
| Code, architecture, multijoueur | [docs/decisions/architecture.md](docs/decisions/architecture.md) : ADR-005 (séparation simulation / affichage), ADR-014 (multijoueur) |
| Sprites, animations, effets visuels | `tools/make-sprites.ts` (ADR-015), `src/client/view/WorldView.ts`, [cahier des charges graphique d'époque](docs/reference/documents-origine/cahier-des-charges-graphismes.pdf) |

## Règles de travail

- **Téléchargements** : la connexion internet de l'utilisateur est limitée. Avant tout téléchargement (`npm install`, installeur, assets, `git fetch`), annoncer la taille estimée et attendre son accord. Préférer les dépendances légères.
- **Référence** : le jeu d'origine est le commit `d438c548` (étiquette `remake-reference-2019`) du dépôt `Stand-For-Planet-Earth`, cloné à côté de celui-ci (`../Stand-For-Planet-Earth`, ou chemin donné par `SFPE_REFERENCE_REPO` ; voir « Selon la machine » plus bas). Le lire avec `git show` ou `git archive`, sans changer de branche ni rien modifier dans ce dépôt, et sans jamais y pousser.
- **Vérifier dans le code** : avant d'implémenter une mécanique, relire le fichier GML d'origine cité par les analyses de `docs/reference/jeu-original/`. Ces analyses sont des lectures du code, pas des certitudes.
- **Tracer les décisions** : tout choix de gameplay ou de game design qui n'est pas dicté par le code d'origine (écart, invention, arbitrage, correction de bogue visible, changement d'équilibrage) reçoit une entrée dans `docs/decisions/game-design.md`, dans le même commit que le changement. Les choix techniques structurants vont dans `docs/decisions/architecture.md`. Mode d'emploi : `docs/decisions/README.md`. Indiquer si la décision vient de l'utilisateur ou d'un choix par défaut.
- **Tenir la feuille de route à jour** : cocher ce qui est fait et ajouter une ligne au journal d'avancement à chaque session.
- **Git** : commits intermédiaires à chaque avancée cohérente, sur la branche `main`. Pas de `git push` sans demande de l'utilisateur.
- **Sprites manquants** : l'utilisateur autorise à en régénérer, fidèles au style d'origine, avec les ajustements nécessaires ; le consigner dans le journal de game design.
- **Livraison** : par étapes jouables ; à la fin d'une étape, le jeu se lance et se joue, et l'utilisateur teste avant la suite.

## Conventions

- Documentation et échanges avec l'utilisateur en français. Textes affichés dans le jeu en anglais, comme l'original.
- La logique de jeu ne dépend ni de Phaser ni du navigateur (voir ADR-005).
- Les valeurs d'équilibrage vivent dans un fichier de réglages unique, pas dispersées dans le code.

## Lancer, tester, vérifier

- Il faut Node 22.18 ou plus récent (`node` exécute le TypeScript directement, ADR-010). Vérifier `node --version` en début de session. Si celui du PATH est trop ancien, voir « Selon la machine » plus bas.
- `npm test` (simulation sur le vrai niveau, sans navigateur), `npm run typecheck`, `npm run dev` (serveur sur le port 3000, reconstruction automatique).
- Dans le navigateur : `http://localhost:3000/?play` saute le menu ; `?play=PetBot&start=studio` commence juste après l'ultimatum (`drop`, `upstairs`, `studio`, `boss` : GD-091 ; à plusieurs, l'hôte choisit le point de départ après le choix des robots) ; `?view` ouvre la partie en caméra libre (ADR-017 : sans brouillard ni éclairage (la touche L le rallume), jeu arrêté, déplacement au clavier, zoom à la molette ; la touche V en jeu fait de même) ; `sfpeWorld` expose l'état du jeu ; `sfpeDebug.teleport(x, y)` et `sfpeDebug.advance(steps, entrées)` permettent d'inspecter une zone ou de jouer une séquence. Si le panneau du navigateur est masqué, la page tourne au ralenti (chargement de plusieurs minutes, 1 image par seconde) : l'afficher avant de mesurer quoi que ce soit.
- Multijoueur (ADR-014) : le serveur (`server/game.ts`) fait tourner la simulation, `src/net` contient les instantanés et le monde miroir du client ; `src/net/net.test.ts` fait jouer un salon et deux clients sans navigateur. Pour essayer à la main : deux onglets, `http://localhost:3000/?name=Alice` et `?name=Bob` (le paramètre évite la demande de nom). Un onglet en arrière-plan tourne au ralenti. Après une modification de `server/` ou de `src/net`, relancer le serveur. `sfpeDebug.teleport` n'agit en réseau que si le serveur est lancé avec `SFPE_DEBUG=1`.
- Sprites absents de l'original (ultis) : fabriqués par `npm run make-sprites` à partir des sprites d'origine (ADR-015). Pour juger une animation, composer une planche-contact des images et la regarder avant de l'essayer en jeu. Dans la console, `sfpeDebug.tap({ linkPressed: true })` ou `tap({ ultiPressed: true })` applique une entrée à un seul step.
- Le projet GameMaker de référence est extrait dans `.cache/reference` (non versionné ; `npm run extract-assets` le recrée depuis l'étiquette `remake-reference-2019` si besoin).
- Ne jamais écrire dans `src/sim`, `src/net` ou `server` de code qui dépend de Phaser ou du navigateur, ni de syntaxe TypeScript non effaçable (`enum`, propriétés-paramètres) : `npm test` exécute ces fichiers directement avec Node (ADR-010, ADR-011).

## Où se trouve quoi

### La documentation — `docs/`

| Fichier | Contenu |
|---|---|
| [narration/arc-narratif.md](docs/narration/arc-narratif.md) | **Référence narrative** : concept, les six actes SFPE, les quatre actes SFHB, dénouement, alternance des époques, personnages (le chimiste, le scientifique, PLUTO), thématique, questions en suspens |
| [narration/niveau-tvtv2.md](docs/narration/niveau-tvtv2.md) | Le niveau TvTv² (acte II) : fiche de mission, lieux, suite d'objectifs, script de la cinématique d'introduction, répliques du largage. Plans annotés des deux étages dans `docs/narration/plans/` (`npm run level-map` les régénère) |
| [01-cadre-mvp.md](docs/01-cadre-mvp.md) | Périmètre de la première version, sources de vérité, points ouverts |
| [02-feuille-de-route.md](docs/02-feuille-de-route.md) | Étapes de livraison, état actuel, journal d'avancement (une ligne par changement) |
| [decisions/game-design.md](docs/decisions/game-design.md) | Journal des décisions de game design (`GD-xxx`) : quoi, pourquoi, décidé par qui |
| [decisions/architecture.md](docs/decisions/architecture.md) | Journal des décisions techniques (`ADR-xxx`) |
| [decisions/README.md](docs/decisions/README.md) | Quand et comment ajouter une entrée aux journaux |
| [formats-donnees.md](docs/formats-donnees.md) | Formats des niveaux et des manifestes d'assets |
| [reference/README.md](docs/reference/README.md) | Le jeu d'origine : dépôt, commit de référence, comment le lire |
| [reference/jeu-original/](docs/reference/jeu-original/) | Trois analyses du code de 2019 : héros et joueur, ennemis et IA, niveaux et interface |
| [reference/documents-origine/](docs/reference/documents-origine/) | Documents de conception d'époque (PDF) : GDD, cahier des charges graphique, ancien scénario (remplacé par l'arc narratif) |

### Le code

| Dossier | Rôle | Fichiers clés |
|---|---|---|
| `src/sim/` | La simulation : toute la logique du jeu, 60 pas par seconde, sans Phaser ni navigateur | `config.ts` (**tous les réglages d'équilibrage**), `world.ts` (boucle, dégâts, objectifs), `hero.ts`, `abilities.ts`, `ulti.ts`, `link.ts`, `intro.ts` (déroulé et répliques de l'introduction), `broadcast.ts` (l'ultimatum : texte, plans, qui parle), `scenes.ts` (les séquences en cours de niveau : ce qui est commun, et le face-à-face avec le barrage de police, l'extraction qui finit le niveau), `wave.ts` (la riposte de la police après l'ultimatum), `additions.ts` (ce que le remake ajoute, retire ou déplace dans les salles d'origine, ADR-016 ; toute l'aile est de TvTv² y est décrite), `npc.ts` (soldats et civils), `boss.ts`, `nav.ts`, `visibility.ts`, `session.ts` (consignes, état de la partie), `types.ts` ; tests `*.test.ts` |
| `src/net/` | Multijoueur : instantanés et monde miroir du client | `snapshot.ts`, `mirror.ts`, `messages.ts`, `net.test.ts` |
| `server/` | Serveur Node : fichiers statiques, WebSocket, salon de jeu | `main.ts`, `game.ts` |
| `src/client/` | Affichage Phaser | `scenes/` (menu, choix du niveau et du héros, salon, jeu), `view/WorldView.ts` (dessin du monde et effets), `view/Hud.ts`, `view/IntroOverlay.ts` (bandes de cinéma et boîte de dialogue), `assets.ts`, `sfx.ts`, `keys.ts`, `net/Connection.ts` |
| `tools/` | Outils de fabrication | `build.ts`, `convert-rooms.ts` (salles GameMaker → JSON), `extract-assets.ts` + `assets.config.json`, `make-sprites.ts` (sprites fabriqués des robots), `make-studio.ts` (sprites et sols de l'aile est de TvTv² : plateau, maquillage, parkings ; dessinés avec `lib/draw.ts`), `level-map.ts` (plan annoté d'une salle, en SVG) |
| `public/` | Ce que sert le serveur | `levels/*.json` (les salles du monde 2), `assets/sprites/` + `sprites.json`, `assets/floors/`, `assets/sounds/`, `fonts/`, `index.html` |

Racine : `start.cmd` et `dev.cmd` (Windows seulement : `npm start` et `npm run dev` avec le Node portable), `package.json`, [README.md](README.md) (présentation et commandes pour un humain).

### Ce qui n'est pas dans git

| Emplacement | Contenu |
|---|---|
| `.tools/` | Node 22 portable (`.tools/node22`), sur la machine Windows seulement (ADR-009) |
| `.cache/reference/` | Projet GameMaker de 2019 extrait ; se recrée avec `npm run extract-assets` (il faut le dépôt d'origine) |
| `dist/`, `node_modules/` | Produits de la construction et dépendances ; `npm install` sur une machine neuve |
| `../Stand-For-Planet-Earth` (ou `SFPE_REFERENCE_REPO`) | Dépôt du jeu d'origine, en lecture seule (étiquette `remake-reference-2019`) ; son dossier `Resources` (hors git) contient les sources graphiques et les musiques |

## Selon la machine

Le projet tourne de la même façon sous Windows, macOS et Linux : chemins construits avec `node:path`, fins de ligne LF, noms de fichiers des assets cohérents en casse (ce qui compte sous Linux). Seuls diffèrent la façon d'avoir un Node assez récent et la présence du dépôt d'origine. Relever `uname -a` (ou `ver` sous Windows) et `node --version` en début de session pour savoir dans quel cas on est.

**Windows, machine de développement (relevé le 2026-11-16).** Windows 10. Node 14.17 installé sur le système : il ne fait pas tourner le projet. Node 22.23.5 portable dans `.tools/node22` : `export PATH="$PWD/.tools/node22:$PATH"` dans Bash, ou passer par `start.cmd` / `dev.cmd`, qui le font. Présents : npm 6 (système), git 2.21, winget, choco, `pdftotext`. Absents : Python, Docker. Dépôt d'origine dans `C:\Users\gillo\Code\Stand-For-Planet-Earth`, avec l'étiquette `remake-reference-2019`. Dans l'outil Bash de cette machine, une commande contenant des caractères accentués échoue ou perd ses variables shell, y compris dans un heredoc : utiliser des motifs (`D*cors`) à la place des accents, et écrire tout texte accentué avec l'outil d'écriture de fichiers (message de commit dans un fichier puis `git commit -F`).

**macOS (relevé le 2026-11-18).** macOS 26.5 sur Apple Silicon. Node 24.7 par nvm dans le PATH, npm 11.5 : `npm start`, `npm run dev`, `npm test` marchent directement, sans `.tools/`. Présents : git 2.39, Homebrew, Python 3, Docker. Absents : `pdftotext` (pour lire les PDF de `docs/reference/documents-origine/`, l'installer avec Homebrew, paquet `poppler`, après accord pour le téléchargement), la commande `timeout`. Le dépôt d'origine n'est pas cloné : `convert-rooms` et `extract-assets` échouent tant qu'il manque, le reste n'en a pas besoin. Le cloner (plusieurs centaines de Mo) seulement avec l'accord de l'utilisateur ; l'étiquette `remake-reference-2019` n'existe que dans la copie Windows, il faudra la recréer sur le commit `d438c5482ca1419af8ad39faae5326b9b2667d88`.

**Linux, ou une autre machine.** Installer Node 22.18 ou plus récent (paquet de la distribution, nvm…), puis `npm install` et les commandes `npm`. Les scripts `.cmd` ne servent pas.
