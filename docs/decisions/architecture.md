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
