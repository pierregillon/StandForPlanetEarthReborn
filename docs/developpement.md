# Développer : lancer, tester, déboguer

Mode d'emploi technique du dépôt, pour un agent comme pour un humain. Les commandes de base sont aussi dans le [README](../README.md). Pour savoir comment le code est organisé, voir [architecture-code.md](architecture-code.md).

## Lancer et tester

- Node 22.18 ou plus récent : `node` exécute directement le TypeScript du projet (ADR-010). Si le Node du PATH est plus ancien, voir [Selon la machine](#selon-la-machine).
- `npm install` une fois (environ 25 Mo à télécharger).
- `npm test` : tests de la simulation sur le vrai niveau, du modèle de l'éditeur et de sa sauvegarde, sans navigateur. `npm run typecheck` : vérification des types.
- `npm run dev` : serveur sur le port 3000, avec reconstruction du code à chaque modification. Après une modification de `server/` ou de `src/net`, relancer le serveur.
- `npm start` : construction unique, puis serveur.
- Les fichiers de `src/sim`, `src/net` et `server` sont exécutés par Node sans compilation : pas de Phaser ni d'API du navigateur, et pas de syntaxe TypeScript non effaçable (`enum`, `namespace`, propriétés déclarées dans les paramètres d'un constructeur). Voir ADR-010 et ADR-011.

## Essayer dans le navigateur

| Adresse ou commande | Effet |
|---|---|
| `http://localhost:3000/?play` | Saute le menu |
| `?play=PetBot` | Choisit le héros |
| `?play=PetBot&start=studio` | Point de départ : `drop`, `upstairs`, `studio` (juste après l'ultimatum), `boss` (GD-091). À plusieurs, l'hôte choisit le point de départ après le choix des robots |
| `?edit=rm_world2` | Ouvre l'[éditeur de niveaux](editeur-niveaux.md) sur une salle (ADR-018) ; `sfpeEditor` dans la console |
| `?view`, ou la touche V en jeu | Caméra libre (ADR-017) : jeu arrêté, sans brouillard ni éclairage (L le rallume), déplacement au clavier, zoom à la molette |
| `sfpeWorld` (console) | L'état du jeu |
| `sfpeDebug.teleport(x, y)` | Déplace le héros |
| `sfpeDebug.advance(steps, entrées)` | Avance la simulation de n steps avec ces entrées |
| `sfpeDebug.hold({ use: true })`, `hold({})` | Maintient des entrées en continu, puis les relâche |
| `sfpeDebug.tap({ linkPressed: true })`, `tap({ ultiPressed: true })` | Applique une entrée pendant un seul step |

**Panneau du navigateur masqué = page au ralenti** : plusieurs minutes de chargement, 1 image par seconde. L'afficher avant de mesurer ou de juger quoi que ce soit. Un onglet en arrière-plan ralentit de la même façon.

## Multijoueur à la main

Ouvrir deux onglets, `http://localhost:3000/?name=Alice` et `?name=Bob` (le paramètre évite la demande de nom). `sfpeDebug.teleport` n'agit en réseau que si le serveur est lancé avec `SFPE_DEBUG=1`. À ne jamais activer sur un serveur ouvert. Sans navigateur, `src/net/net.test.ts` fait jouer un salon et deux clients. Fonctionnement : [architecture-code.md](architecture-code.md#multijoueur).

## Sprites et animations

- Les sprites absents de l'original (ultis, rechargements, plateau de TvTv²) sont fabriqués par `npm run make-sprites` et `npm run make-studio` (ADR-015).
- Pour juger une animation : composer une planche-contact de ses images et la regarder avant de l'essayer en jeu.
- Effets et dessin du monde : `src/client/view/WorldView.ts`. Style à respecter : le [cahier des charges graphique d'époque](reference/documents-origine/cahier-des-charges-graphismes.pdf).

## Le jeu d'origine et le cache de référence

- `npm run convert-rooms` et `npm run extract-assets` lisent le projet GameMaker de 2019. Il est extrait au besoin dans `.cache/reference/` depuis un clone du dépôt d'origine, cherché dans `../Stand-For-Planet-Earth` ou à l'emplacement donné par `SFPE_REFERENCE_REPO`. Ce clone doit avoir l'étiquette `remake-reference-2019` (voir [reference/README.md](reference/README.md)).
- Les autres commandes n'en ont pas besoin : assets et niveaux convertis sont versionnés dans `public/`.

## Ce qui n'est pas dans git

| Emplacement | Contenu |
|---|---|
| `node_modules/`, `dist/` | Dépendances (`npm install`) et code du navigateur assemblé |
| `.cache/reference/` | Projet GameMaker de 2019 extrait ; se recrée tout seul s'il y a le dépôt d'origine |
| `.tools/node22` | Node portable, sur la machine Windows seulement (ADR-009) |
| `../Stand-For-Planet-Earth` | Dépôt du jeu d'origine, en lecture seule ; son dossier `Resources` (hors git) contient les sources graphiques et les musiques |

## Selon la machine

Le projet tourne de la même façon sous Windows, macOS et Linux : chemins construits avec `node:path`, fins de ligne LF, noms de fichiers des assets cohérents en casse (ce qui compte sous Linux). Seuls diffèrent la façon d'avoir un Node assez récent et la présence du dépôt d'origine.

### Windows, machine de développement (relevé le 2026-11-16)

- Windows 10. Node 14.17 sur le système : il ne fait pas tourner le projet.
- Node 22.23.5 portable dans `.tools/node22`. Dans Bash : `export PATH="$PWD/.tools/node22:$PATH"`. Sinon, passer par `start.cmd` / `dev.cmd`, qui font `npm start` / `npm run dev` avec ce Node.
- Présents : npm 6 (système), git 2.21, winget, choco, `pdftotext`. Absents : Python, Docker.
- Dépôt d'origine : `C:\Users\gillo\Code\Stand-For-Planet-Earth`, avec l'étiquette `remake-reference-2019`.
- **Accents dans l'outil Bash** : une commande qui contient des caractères accentués échoue ou perd ses variables shell, même dans un heredoc. Utiliser des motifs (`D*cors`) à la place des accents. Écrire tout texte accentué avec l'outil d'écriture de fichiers ; pour un message de commit, l'écrire dans un fichier puis lancer `git commit -F`.

### macOS (relevé le 2026-11-18)

- macOS 26.5 sur Apple Silicon. Node 24.7 par nvm dans le PATH, npm 11.5 : les commandes `npm` marchent directement, sans `.tools/`.
- Présents : git 2.39, Homebrew, Python 3, Docker. Absents : la commande `timeout`, et `pdftotext`, utile pour lire les PDF de `reference/documents-origine/` (Homebrew, paquet `poppler`, après accord pour le téléchargement).
- Le dépôt d'origine n'est pas cloné : `convert-rooms` et `extract-assets` échouent tant qu'il manque. Le cloner (plusieurs centaines de Mo) seulement avec l'accord de l'utilisateur, puis recréer l'étiquette `remake-reference-2019` sur le commit `d438c5482ca1419af8ad39faae5326b9b2667d88`.

### Linux, ou une autre machine

Installer Node 22.18 ou plus récent (paquet de la distribution, nvm…), puis `npm install` et les commandes `npm`. Les scripts `.cmd` ne servent pas. Ajouter ici une fiche pour la machine dès qu'elle a une particularité.
