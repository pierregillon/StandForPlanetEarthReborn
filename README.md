# Stand For Planet Earth — version web

Remake pour navigateur de « Stand For Planet Earth », un jeu de tir en vue du dessus développé sous GameMaker entre 2016 et 2019. Une équipe de robots traverse des niveaux remplis de soldats, de robots ennemis et de civils.

**État : les 4 étapes du MVP sont livrées — le monde 2 se joue en entier avec les quatre héros (PetBot, EngiBot, BatBot, BadaBot) : rez-de-chaussée, étage, zone de forage et boss SallyBot, jusqu'à l'écran de score.** Voir la [feuille de route](docs/02-feuille-de-route.md).

## Documentation

| Document | Contenu |
|---|---|
| [docs/01-cadre-mvp.md](docs/01-cadre-mvp.md) | Ce que contient la première version jouable, et les points encore ouverts |
| [docs/02-feuille-de-route.md](docs/02-feuille-de-route.md) | Les 4 étapes de livraison et l'avancement |
| [docs/decisions/game-design.md](docs/decisions/game-design.md) | Journal des décisions de game design : quoi, et pourquoi |
| [docs/decisions/architecture.md](docs/decisions/architecture.md) | Journal des décisions techniques |
| [docs/formats-donnees.md](docs/formats-donnees.md) | Formats des niveaux et des manifestes d'assets produits par les outils |
| [docs/reference/](docs/reference/README.md) | Le jeu d'origine : accès au code, analyses détaillées, documents de conception d'époque |

## Lancer le jeu

Double-cliquer sur `start.cmd` (ou le lancer dans un terminal), puis ouvrir <http://localhost:3000> dans un navigateur.

Il faut Node 22.18 ou plus récent. Sur la machine de développement, une copie portable se trouve dans `.tools/node22` (non versionnée) et `start.cmd` l'utilise automatiquement. Ailleurs : installer Node 22, puis `npm install` (33 Mo) et `npm start`.

### Commandes

| Action | Touche |
|---|---|
| Se déplacer | ZQSD sur clavier AZERTY, WASD sur QWERTY (mêmes touches physiques), ou les flèches |
| Viser | souris |
| Tirer (BadaBot : maintenir pour charger) | clic gauche |
| Tir secondaire (coûte de l'énergie) | clic droit |
| Recharger | R |
| Dash (en marchant) | Espace ou Maj |
| Utiliser un bouton ; se recharger sur une borne (maintenir) | E |
| Pause | Échap |

## Développer

| Commande | Effet |
|---|---|
| `dev.cmd` ou `npm run dev` | Reconstruit le code à chaque modification et sert le jeu ; `http://localhost:3000/?play` saute le menu, `?play=EngiBot` choisit le héros |
| `npm test` | Tests de la simulation, sans navigateur |
| `npm run typecheck` | Vérification des types |
| `npm run convert-rooms` | Reconvertit les salles GameMaker en `public/levels/*.json` |
| `npm run extract-assets` | Recopie sprites, sols et sons depuis le projet GameMaker (réglages : `tools/assets.config.json`) |

Organisation du code : `src/sim` (logique du jeu, sans Phaser ni navigateur ; réglages dans `src/sim/config.ts`), `src/client` (affichage Phaser), `server` (serveur Node), `tools` (build et conversion), `public` (assets et niveaux).

Dans la console du navigateur, `sfpeWorld` donne l'état du jeu et `sfpeDebug.teleport(x, y)` déplace le héros.
