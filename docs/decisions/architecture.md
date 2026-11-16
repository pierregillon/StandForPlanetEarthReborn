# Journal des décisions d'architecture

Mode d'emploi et modèle d'entrée : [README.md](README.md).

| N° | Décision | Date | Statut |
|---|---|---|---|
| ADR-001 | Phaser 3 en 2D pour l'affichage | 2026-11-15 | Acceptée |
| ADR-002 | Un seul projet TypeScript avec un serveur Node, pas Next.js | 2026-11-15 | Acceptée |
| ADR-003 | Node 22 LTS installé à côté de Node 14 via nvm-windows | 2026-11-15 | Acceptée |
| ADR-004 | Un dépôt séparé du dépôt GameMaker | 2026-11-15 | Acceptée |
| ADR-005 | Logique de jeu séparée de l'affichage ; hébergement non décidé | 2026-11-15 | Acceptée |
| ADR-006 | Niveaux en JSON, convertis automatiquement depuis les salles GameMaker | 2026-11-15 | Acceptée |
| ADR-007 | Assets repris du projet GameMaker de 2019 ; sprites manquants régénérés | 2026-11-15 | Acceptée |
| ADR-008 | Documentation en français, décisions tracées, commits intermédiaires | 2026-11-15 | Acceptée |

---

## ADR-001 — Phaser 3 en 2D pour l'affichage

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (sur recommandation)

**Contexte.** Le jeu doit tourner dans un navigateur. Le jeu d'origine est en 2D vue du dessus, avec environ 400 sprites déjà dessinés. L'utilisateur n'avait pas de préférence technique et notait qu'un jeu vu du dessus n'a pas besoin de 3D compliquée.

**Décision.** Utiliser Phaser 3, un moteur de jeu 2D pour navigateur.

**Pourquoi.** Phaser fournit caméra, animations, entrées clavier-souris, son et chargement d'assets, et il réutilise directement les sprites existants. Options écartées : Three.js en 3D (il faudrait refaire tous les visuels en modèles 3D) ; PixiJS (moteur d'affichage seul, sans caméra ni gestion de jeu : tout serait à écrire).

**Conséquences.** Le rendu reste en sprites 2D. Voir ADR-005 : Phaser n'héberge que l'affichage, pas les règles du jeu.

---

## ADR-002 — Un seul projet TypeScript avec un serveur Node, pas Next.js

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (sur recommandation)

**Contexte.** L'utilisateur veut un seul livrable contenant le front et le back, « comme Next.js », pour pouvoir ajouter du code serveur et faire communiquer les deux. Le multijoueur en ligne est prévu après le MVP.

**Décision.** Un seul projet TypeScript : un serveur Node sert le jeu compilé et expose des routes côté serveur ; une seule commande lance l'ensemble.

**Pourquoi.** Le multijoueur temps réel demandera des connexions persistantes (WebSocket) entre navigateur et serveur. Next.js ne les gère pas nativement et pousse vers un hébergement sans serveur permanent ; un serveur Node classique les gère sans contournement. Next.js est aussi plus lourd à télécharger (environ 100 Mo de plus), ce qui compte avec une connexion limitée.

**Conséquences.** Le choix précis des briques (outil de build, bibliothèque serveur) se fait au début de l'étape 1 et s'ajoute à ce journal. Préférer des dépendances légères.

---

## ADR-003 — Node 22 LTS installé à côté de Node 14 via nvm-windows

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (sur recommandation)

**Contexte.** La machine de développement a Node 14.17, trop ancien pour les outils web actuels. D'autres projets de l'utilisateur peuvent en dépendre. Sont aussi présents : npm 6, yarn 1.16, winget, choco. Absents : Python, Docker.

**Décision.** Installer nvm-windows, puis Node 22 LTS, en conservant Node 14.

**Pourquoi.** nvm-windows permet de basculer d'une version à l'autre sans casser les projets existants. Option écartée : remplacer Node 14.

**Conséquences.** Téléchargements : environ 5 Mo (nvm-windows) et 30 Mo (Node 22). La connexion internet de l'utilisateur est limitée : annoncer la taille et attendre son accord avant tout téléchargement, y compris `npm install`.

**Mise à jour du 2026-11-16 (voir ADR-009).** nvm-windows n'a pas été installé : Node 22 est une copie portable dans `.tools/node22`.

---

## ADR-004 — Un dépôt séparé du dépôt GameMaker

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** Le code d'origine vit dans le dépôt GitHub d'un autre contributeur (`Leuyck/Stand-For-Planet-Earth`). La recommandation initiale était un dossier `web/` dans ce dépôt.

**Décision.** Le jeu web a son propre dépôt, `C:\Users\gillo\Code\stand-for-planet-earth-web`, destiné à un autre dépôt GitHub.

**Pourquoi.** Choix de l'utilisateur : ne rien lier au dépôt d'origine.

**Conséquences.** Les assets utiles sont copiés dans ce dépôt (ADR-007). Le code d'origine reste consultable à côté ; la façon d'y accéder est décrite dans `docs/reference/README.md`. Rien n'est poussé vers GitHub sans demande de l'utilisateur.

---

## ADR-005 — Logique de jeu séparée de l'affichage ; hébergement non décidé

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (sur recommandation)

**Contexte.** Le MVP est solo, mais le multijoueur viendra. Dans le jeu d'origine de 2019, chaque client simulait l'IA en local et le réseau était en partie débranché. L'hébergement final n'est pas choisi.

**Décision.** Écrire les règles du jeu (déplacements, tirs, IA, dégâts, portes, objectifs) dans un module qui ne dépend pas de Phaser ni du navigateur. Phaser lit l'état du jeu et l'affiche. Le projet reste un serveur Node standard, déployable presque partout.

**Pourquoi.** Le jour du multijoueur, cette logique pourra tourner sur le serveur, qui fera autorité, sans réécriture. C'est aussi ce qui rend les règles testables sans navigateur.

**Conséquences.** Ne pas utiliser la physique de Phaser pour les règles : collisions et déplacements sont calculés dans le module de jeu. Le jeu d'origine teste les collisions par masques de sprites ; il faudra des formes simples (rectangles, cercles) mesurées sur les sprites.

---

## ADR-006 — Niveaux en JSON, convertis automatiquement depuis les salles GameMaker

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (sur recommandation)

**Contexte.** Les salles du monde 2 comptent plusieurs centaines d'instances chacune (570 pour le rez-de-chaussée). Les fichiers de salles GameMaker Studio 2 sont du JSON régulier : instances avec position, rotation et échelle ; murs peints dans deux couches de tuiles, épais (64 px) et fins (32 px) ; sols en rectangles de texture répétée.

**Décision.** Un script convertit chaque salle GameMaker en un fichier JSON propre au jeu web, lisible et modifiable à la main. Les fichiers générés sont versionnés.

**Pourquoi.** Refaire les salles à la main serait long et infidèle. L'analyse a confirmé la faisabilité (un script d'inventaire a parcouru les 24 salles). Options écartées : l'éditeur Tiled (téléchargement et apprentissage) ; un éditeur intégré au jeu (chantier à part entière).

**Conséquences.** Le convertisseur a besoin des fichiers `.yy` des sprites (tailles, origines, masques) et de la table des objets. Détails du format : `docs/reference/jeu-original/03-niveaux-et-interface.md`, thème 2. Une fois une salle retouchée à la main, la reconvertir écraserait les retouches : séparer ce qui est généré de ce qui est ajouté (prises de courant, liaison vers le boss).

---

## ADR-007 — Assets repris du projet GameMaker de 2019 ; sprites manquants régénérés

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** Le projet de 2019 contient 407 sprites (159 Mo) et 40 sons (20 Mo), à la bonne taille et déjà sur la machine dans le dossier `.git` du dépôt d'origine. L'utilisateur a aussi rassemblé les sources graphiques, des musiques et des polices dans un dossier `Resources` (1,3 Go). Certains visuels manquent : mort du boss, peut-être des postures.

**Décision.** Prendre les sprites et les sons dans le projet de 2019 ; utiliser `Resources` en complément. Quand un sprite ou une posture manque, en régénérer un qui soit fidèle au style d'origine, en l'ajustant si nécessaire.

**Pourquoi.** L'utilisateur a explicitement autorisé la régénération de sprites manquants, fidèles à l'original, avec des ajustements pour les postures ou éléments absents des animations.

**Conséquences.** Ne copier dans ce dépôt que les assets utilisés, pour garder un dépôt léger. Chaque sprite régénéré est listé dans le journal de game design (ce qui manquait, ce qui a été produit, à partir de quoi). Sons manquants à première vue : ennemis autres que le pistolet, boss, portes, dash, menus.

---

## ADR-008 — Documentation en français, décisions tracées, commits intermédiaires

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** Le développement s'étalera sur plusieurs sessions, qui ne partagent pas de mémoire. L'utilisateur veut pouvoir retracer les décisions de game design et leurs raisons.

**Décision.** La documentation de `docs/` est la mémoire du projet. Chaque session met à jour la feuille de route et ajoute aux journaux de décisions ce qu'elle a tranché. Git est utilisé avec des commits intermédiaires à chaque avancée cohérente.

**Pourquoi.** Demande de l'utilisateur : qu'une session future puisse reprendre avec la documentation complète, et que les décisions de jeu soient tracées « comme des ADR, mais plus finement ».

**Conséquences.** Documentation en français ; textes du jeu en anglais (GD-012). Pas de `git push` sans demande de l'utilisateur.

---

## ADR-009 — Node 22 portable dans le projet, sans nvm-windows

- **Date** : 2026-11-16
- **Statut** : Acceptée (remplace le moyen prévu par ADR-003, pas son objectif)
- **Décidée par** : choix par défaut (à valider par l'utilisateur)

**Contexte.** Node 14 est installé dans `C:\Program Files\nodejs`. nvm-windows a besoin de prendre la main sur ce dossier (droits administrateur, désinstallation ou renommage de l'installation existante) et bascule la version de Node pour toute la machine, pas par projet.

**Décision.** Télécharger l'archive officielle `node-v22.23.5-win-x64.zip` (35,6 Mo, somme SHA-256 vérifiée) et la décompresser dans `.tools/node22`, dossier ignoré par git. Les scripts `start.cmd` et `dev.cmd` mettent ce dossier en tête du PATH le temps de la commande.

**Pourquoi.** Rien n'est modifié sur la machine : pas de droits administrateur, Node 14 intact pour les autres projets, suppression en effaçant un dossier. Même volume de téléchargement.

**Conséquences.** Sur une autre machine, il faut Node 22.18 ou plus récent dans le PATH, ou refaire cette copie. Dans un terminal, `node` reste le Node 14 du système : passer par `start.cmd` / `dev.cmd`, ou préfixer le PATH.

---

## ADR-010 — Outils minimaux : esbuild, TypeScript exécuté par Node, serveur sans dépendance

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : choix par défaut

**Contexte.** La connexion de l'utilisateur est limitée (ADR-003) ; chaque dépendance se paie en téléchargement.

**Décision.** Quatre paquets seulement : `phaser` 3.90.0 (version figée), `esbuild` (assemble le code du navigateur dans `dist/game.js`), `typescript` 5.9 (vérification des types uniquement) et `@types/node`. Le serveur (`server/main.ts`) et les outils (`tools/*.ts`) sont du TypeScript exécuté directement par Node 22, qui efface les types : ni `enum`, ni `namespace`, ni propriétés déclarées dans les paramètres d'un constructeur. Le serveur n'utilise que le module `http` de Node. Les tests utilisent le lanceur intégré `node --test`.

**Pourquoi.** 33 Mo de téléchargement au lieu d'une centaine avec Vite, Express et un lanceur de tests. Moins de pièces à maintenir.

**Conséquences.** Phaser 4 est sorti entre-temps ; on reste sur Phaser 3.90 (ADR-001), dernière version de la série 3. Une migration serait limitée à `src/client`, puisque la logique n'en dépend pas (ADR-005). Le multijoueur demandera une bibliothèque WebSocket, à annoncer avant téléchargement.

---

## ADR-011 — Simulation à pas fixe de 60 par seconde, séparée de l'affichage

- **Date** : 2026-11-16
- **Statut** : Acceptée (précise ADR-005)
- **Décidée par** : choix par défaut

**Contexte.** Le jeu d'origine tourne à 60 steps par seconde et exprime vitesses et durées dans cette unité.

**Décision.** `src/sim` contient toute la logique : un objet `World` avancé d'un step à la fois par `world.step(entrées)`, sans Phaser, sans navigateur, avec son propre générateur aléatoire. `src/client` lit l'état du monde à chaque image, le dessine, et consomme une file d'événements (sons, impacts, morts). Les réglages sont dans `src/sim/config.ts`, dans les unités du jeu d'origine (pixels, steps, pixels par step).

**Pourquoi.** Les valeurs du code GameMaker se recopient sans conversion. La simulation se teste sans navigateur (`npm test` la fait tourner sur le vrai niveau) et pourra tourner sur le serveur pour le multijoueur.

**Conséquences.** L'affichage ne doit jamais modifier l'état du monde. Sur un écran plus rapide que 60 Hz, le mouvement n'est pas interpolé pour l'instant.

---

## ADR-012 — Images de sprites chargées une par une ; sprites sélectionnés par configuration

- **Date** : 2026-11-16
- **Statut** : Acceptée — à améliorer
- **Décidée par** : choix par défaut

**Contexte.** GameMaker stocke chaque image d'animation dans un fichier PNG séparé. Le projet d'origine pèse 159 Mo de sprites.

**Décision.** `tools/extract-assets.ts` copie dans `public/assets` uniquement les sprites utiles (ceux des salles converties et ceux cités par le code, moins les exclusions de `tools/assets.config.json`) : 29 Mo à l'étape 1. Le jeu charge une image par fichier, et seulement celles du niveau en cours (environ 600 fichiers).

**Pourquoi.** Simple, sans outil de traitement d'image supplémentaire, et le dépôt reste raisonnable à pousser sur une connexion limitée.

**Conséquences.** Le chargement prend une dizaine de secondes en local et serait lent sur un hébergement distant : il faudra regrouper les images en planches de sprites avant toute mise en ligne. Les sprites des héros de l'étape 2 et du boss sont à retirer des exclusions le moment venu, puis relancer `npm run extract-assets`.
