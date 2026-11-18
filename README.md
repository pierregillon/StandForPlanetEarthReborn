# Stand For Planet Earth — version web

Remake pour navigateur de « Stand For Planet Earth », un jeu de tir en vue du dessus développé sous GameMaker entre 2016 et 2019. Une équipe de robots traverse des niveaux remplis de soldats, de robots ennemis et de civils.

**État : les 4 étapes du MVP sont livrées — le monde 2 se joue en entier avec les quatre héros (PetBot, EngiBot, BatBot, BadaBot) : rez-de-chaussée, étage, zone de forage et boss SallyBot, jusqu'à l'écran de score.** Voir la [feuille de route](docs/02-feuille-de-route.md).

## Documentation

| Document | Contenu |
|---|---|
| [AGENTS.md](AGENTS.md) | Guide pour un agent : règles de travail, quoi lire selon le travail, où se trouve quoi |
| [docs/narration/arc-narratif.md](docs/narration/arc-narratif.md) | L'histoire du jeu : les actes SFPE et SFHB, les personnages, le dénouement. Référence pour tout travail de scénario |
| [docs/01-cadre-mvp.md](docs/01-cadre-mvp.md) | Ce que contient la première version jouable, et les points encore ouverts |
| [docs/02-feuille-de-route.md](docs/02-feuille-de-route.md) | Les 4 étapes de livraison et l'avancement |
| [docs/decisions/game-design.md](docs/decisions/game-design.md) | Journal des décisions de game design : quoi, et pourquoi |
| [docs/decisions/architecture.md](docs/decisions/architecture.md) | Journal des décisions techniques |
| [docs/formats-donnees.md](docs/formats-donnees.md) | Formats des niveaux et des manifestes d'assets produits par les outils |
| [docs/reference/](docs/reference/README.md) | Le jeu d'origine : accès au code, analyses détaillées, documents de conception d'époque |

## Lancer le jeu

Il faut Node 22.18 ou plus récent : `node` exécute directement les fichiers TypeScript du projet, ce que les versions antérieures ne savent pas faire. Une fois, installer les dépendances avec `npm install` (environ 25 Mo à télécharger).

- **macOS, Linux** : `npm start`, puis ouvrir <http://localhost:3000>. N'importe quel Node assez récent fait l'affaire (paquet du système, Homebrew, nvm…).
- **Windows** : double-cliquer sur `start.cmd` (ou le lancer dans un terminal), puis ouvrir <http://localhost:3000>. Ce script et `dev.cmd` placent en tête du PATH le Node portable de `.tools/node22` s'il existe (non versionné, ADR-009), pour une machine dont le Node du système est trop ancien. Sans ce dossier, ils utilisent le Node du PATH ; `npm start` fonctionne aussi.

### Jouer à plusieurs

Le serveur du jeu héberge aussi la partie multijoueur (une seule à la fois pour l'instant, 4 joueurs au plus).

1. L'hôte lance le jeu (voir ci-dessus), ouvre <http://localhost:3000> et choisit **Create game**.
2. Les autres ouvrent la même adresse depuis leur machine et choisissent **Join game** :
   - sur le même réseau : `http://adresse-de-l'hôte:3000` ;
   - à distance : l'adresse fournie par un tunnel, par exemple `ngrok http 3000`.
3. Chacun choisit son robot (un robot ne peut être pris qu'une fois), puis l'hôte lance la partie.

À savoir : chaque joueur télécharge une fois les images et les sons du jeu (87 Mo au fil des salles) par la connexion de l'hôte ; ensuite la partie elle-même consomme environ 2 ko/s par joueur. Détails et limites : GD-040 et ADR-014.

En jeu à plusieurs : **A** (Q sur un clavier QWERTY) en visant un coéquipier pour lui donner son énergie par un lien, **F** pour lancer son attaque ultime une fois l'énergie au maximum (GD-043).

### Commandes

| Action | Touche |
|---|---|
| Se déplacer | ZQSD sur clavier AZERTY, WASD sur QWERTY (mêmes touches physiques), ou les flèches |
| Viser | souris |
| Tirer (BadaBot : maintenir pour charger) | clic gauche |
| Tir secondaire (coûte de l'énergie) | clic droit |
| Recharger ; BatBot : rappeler ses battes | R |
| Dash (en marchant) ; pendant l'introduction du niveau : réplique suivante, ou tenir pour passer la séquence (l'hôte seulement, à plusieurs) | Espace ou Maj |
| Utiliser un bouton ; se recharger sur une borne (maintenir) | E |
| Pause | Échap |
| Caméra libre, pour parcourir la salle sans jouer (aussi au menu principal et au menu de pause) | V ; puis déplacement, Maj pour aller vite, molette pour le zoom, 1 pour l'échelle du jeu, L pour l'éclairage, V ou Échap pour revenir |

## Développer

| Commande | Effet |
|---|---|
| `npm run dev` (ou `dev.cmd` sous Windows) | Reconstruit le code à chaque modification et sert le jeu ; `http://localhost:3000/?play` saute le menu, `?play=EngiBot` choisit le héros, `?view` ouvre la partie en caméra libre |
| `npm test` | Tests de la simulation, sans navigateur |
| `npm run typecheck` | Vérification des types |
| `npm run convert-rooms` | Reconvertit les salles GameMaker en `public/levels/*.json` |
| `npm run make-sprites`, `npm run make-studio` | Refabriquent les sprites que l'original n'avait pas (ultis et rechargements des robots ; plateau de TvTv²) |
| `npm run level-map` | Redessine les plans annotés des salles dans `docs/narration/plans/` |
| `npm run extract-assets` | Recopie sprites, sols et sons depuis le projet GameMaker (réglages : `tools/assets.config.json`) |

`convert-rooms` et `extract-assets` lisent le projet GameMaker d'origine. Ils l'extraient au besoin dans `.cache/reference` depuis un clone du dépôt d'origine, cherché à côté de celui-ci (`../Stand-For-Planet-Earth`) ou à l'emplacement donné par la variable `SFPE_REFERENCE_REPO`. Ce clone doit contenir l'étiquette `remake-reference-2019` (voir [docs/reference/](docs/reference/README.md)). Les autres commandes n'en ont pas besoin : les assets et les niveaux convertis sont déjà dans `public/`.

Organisation du code : `src/sim` (logique du jeu, sans Phaser ni navigateur ; réglages dans `src/sim/config.ts`), `src/client` (affichage Phaser), `server` (serveur Node), `tools` (build et conversion), `public` (assets et niveaux).

Dans la console du navigateur, `sfpeWorld` donne l'état du jeu et `sfpeDebug.teleport(x, y)` déplace le héros.
