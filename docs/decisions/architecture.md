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
| ADR-009 | Node 22 portable dans le projet, sans nvm-windows | 2026-11-16 | Acceptée (remplace le moyen prévu par ADR-003, pas son objectif) |
| ADR-010 | Outils minimaux : esbuild, TypeScript exécuté par Node, serveur sans dépendance | 2026-11-16 | Acceptée |
| ADR-011 | Simulation à pas fixe de 60 par seconde, séparée de l'affichage | 2026-11-16 | Acceptée (précise ADR-005) |
| ADR-012 | Images de sprites chargées une par une ; sprites sélectionnés par configuration | 2026-11-16 | Acceptée — à améliorer |
| ADR-013 | Lumières : zone éclairée pré-dessinée par lampe, recalculée quand une porte bouge | 2026-11-16 | Acceptée |
| ADR-014 | Multijoueur : le serveur fait tourner le jeu, les navigateurs en tiennent un miroir | 2026-11-16 | Acceptée — première version |
| ADR-015 | Sprites manquants fabriqués par un outil, à partir des sprites d'origine | 2026-11-16 | Acceptée |
| ADR-016 | Les ajouts aux salles d'origine sont décrits à part et greffés au chargement | 2026-11-17 | Acceptée |
| ADR-017 | Une caméra libre pour parcourir le niveau sans jouer | 2026-11-17 | Acceptée |

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

**Mise à jour du 2026-11-18.** Le projet tourne aussi sur macOS, sans `.tools/` : le Node 24 de nvm suffit, et `npm start` / `npm run dev` remplacent les scripts `.cmd`. La copie portable reste propre à la machine Windows. Consignes par plateforme : README (« Lancer le jeu ») et `docs/developpement.md` (« Selon la machine »).

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

## ADR-013 — Lumières : zone éclairée pré-dessinée par lampe, recalculée quand une porte bouge

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : choix par défaut (contrainte de l'utilisateur : code simple, performances intactes)

**Contexte.** GD-038 demande des ombres portées par les murs et les portes. L'original projette des triangles d'ombre dans une surface par lampe, avec un shader. Les pistes écartées : le pipeline de lumières de Phaser (`Light2D`), qui demande des cartes de normales et ne fait pas d'ombres portées ; un shader d'ombres écrit à la main, plus de code et plus fragile.

**Décision.**

- `src/sim/visibility.ts` calcule le polygone visible depuis un point : un rayon vers chaque coin d'obstacle du voisinage (plus un de chaque côté) et 48 rayons réguliers, lancés avec le `raycast` de collision existant sur les obstacles qui arrêtent le regard (`BLOCK_SIGHT`). Aucune dépendance au navigateur.
- Chaque lampe a une petite texture canevas (35 % de sa taille réelle) où son dégradé est dessiné, découpé par ce polygone. Elle n'est redessinée que si l'ouverture d'une porte de son rayon a changé, et au plus deux lampes par image.
- À chaque image, le calque noir (`RenderTexture` de la taille de l'écran, déjà en place depuis l'étape 4) est rempli, puis chaque texture de lampe visible y est « gommée ». Les lampes colorées ont en plus une image du monde, en mélange additif, qui réutilise la même texture.
- La lueur du héros est une lampe comme les autres, à 25 % de sa taille, redessinée quand il s'est déplacé de plus de 3 px.

**Pourquoi.** Les murs sont peu nombreux et déjà rangés dans la grille de collision ; un polygone coûte environ 0,1 ms. Dessiner le résultat dans une texture ramène le coût par image à un tampon par lampe, comme avec les anciens halos. Tout tient en une centaine de lignes, sans shader.

**Conséquences.** Mesures sur la machine de l'utilisateur, panneau du navigateur affiché : 60 images par seconde à l'arrêt, en déplacement et pendant qu'une porte éclairée par deux lampes s'ouvre et se ferme ; le travail par image en déplacement passe d'environ 6 ms à 6,5 ms (budget : 16,6 ms). Limites connues : les ombres ont un bord net adouci seulement par la faible résolution des textures ; un obstacle qui bougerait sans être une porte ne mettrait pas à jour les lampes fixes.

## ADR-014 — Multijoueur : le serveur fait tourner le jeu, les navigateurs en tiennent un miroir

- **Date** : 2026-11-16
- **Statut** : Acceptée — première version
- **Décidée par** : l'utilisateur pour le cadre (serveur faisant autorité, jouable à distance par ngrok, bibliothèque `ws` acceptée) ; choix par défaut pour la technique

**Contexte.** ADR-002 et ADR-005 prévoyaient que la simulation, indépendante du navigateur, tourne un jour sur le serveur. Le jeu doit rester agréable à distance (ngrok ajoute plusieurs dizaines de millisecondes) et la connexion de l'utilisateur est limitée : tout passe par elle quand il héberge.

**Décision.**

- **Serveur** (`server/game.ts`, `server/main.ts`) : une WebSocket par navigateur sur `/ws` (bibliothèque `ws`, compression activée). La classe `Lobby` tient le salon puis la partie : elle fait avancer le même `World` que le solo à 60 steps par seconde, avec une entrée par joueur et par step. Elle ne connaît pas les WebSockets (elle parle à des « pairs »), ce qui permet de la tester sans réseau.
- **Entrées** : chaque navigateur envoie son entrée à chaque step, numérotée. Le serveur les joue dans l'ordre, une par step ; sans nouvelle depuis 12 steps, le robot s'arrête.
- **Instantanés** (`src/net/snapshot.ts`) : 20 fois par seconde, le serveur envoie les champs simples des entités qui ont changé depuis l'envoi précédent. WebSocket garantit l'ordre et la livraison : ce différentiel n'a besoin d'aucun accusé de réception. Les champs sont découverts automatiquement (tout champ nombre, texte ou booléen), moins une liste d'exclusions par type pour l'état interne de la simulation ; une référence vers `CONFIG` (le `def` d'un PNJ) voyage sous forme de chemin.
- **Miroir** (`src/net/mirror.ts`) : chaque navigateur construit un `World` depuis la même salle et le tient à jour avec les instantanés, sans jamais appeler `world.step`. L'affichage (`WorldView`, `Hud`) lit ce monde comme en solo, sans rien savoir du réseau.
- **Pour masquer le délai** :
  - *prédiction* : le robot du joueur est déplacé tout de suite avec le même code que le serveur (`steerHero`) ; à chaque instantané, on repart de l'état du serveur et on rejoue les entrées qu'il n'a pas encore jouées ;
  - *glissement* : les autres personnages glissent de leur position affichée à la dernière reçue ;
  - *extrapolation* : les balles volent seules entre deux nouvelles ; les compteurs d'animation avancent d'un par step.
- **Changement de salle** : le serveur annonce la salle, chaque client la charge puis répond « prêt » ; le jeu reprend quand tous ont répondu, sans limite de temps ; les clients s'envoient l'avancement de leur chargement par le serveur (GD-041). Chaque salle a un numéro d'ordre, pour ignorer ce qui concerne la précédente.

**Pourquoi.** Un serveur qui fait autorité évite les désaccords entre joueurs et la triche, et réutilise la simulation testée. Les pistes écartées : faire tourner la simulation à l'identique chez chacun en n'échangeant que les entrées (très peu de trafic, mais le moindre écart de calcul entre navigateurs désynchronise la partie, et chaque commande attend le réseau) ; envoyer l'état complet à chaque fois (des dizaines de ko/s).

**Conséquences.**

- **Trafic mesuré** (deux joueurs en local, compression comprise) : environ 1,5 ko/s envoyés et 0,5 à 0,8 ko/s reçus par joueur, soit de l'ordre de 8 Mo par heure et par joueur. Le serveur l'affiche toutes les 10 s pendant une partie. En revanche chaque nouveau joueur télécharge une fois les images et les sons (87 Mo au total, au fil des salles) par la connexion de l'hôte : voir ADR-012.
- Deux corrections après essai à distance (GD-044) : la distance de marche du robot prédit n'est plus recomptée à chaque instantané (animation saccadée) ; les chaises glissent entre deux instantanés. Pousser une chaise garde le délai du réseau : c'est le serveur qui la déplace.
- 6 tests sans navigateur : `src/net/net.test.ts` fait jouer un salon et deux clients simulés (prédiction, miroir, changement de salle, Retry, départ d'un joueur).
- Ajouter un champ à une entité le synchronise d'office ; s'il change à chaque step sans servir à l'affichage, l'ajouter aux exclusions de `LISTS` (`lobby.traffic()` donne les champs les plus envoyés).
- Outil de développement : `sfpeDebug.teleport` fonctionne en réseau si le serveur est lancé avec `SFPE_DEBUG=1` ; à ne jamais activer sur un serveur ouvert.
- À faire pour un serveur public : plusieurs salons à la fois, reconnexion, et limiter ce qu'un client peut envoyer.

## ADR-015 — Sprites manquants fabriqués par un outil, à partir des sprites d'origine

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur pour l'objectif (de vrais sprites, cohérents avec les animations existantes) ; choix par défaut pour la méthode

**Contexte.** Les attaques ultimes (GD-043) n'ont aucune image dans le projet d'origine. L'utilisateur veut des sprites, avec un nombre d'images et une cadence comparables aux animations existantes, pas des effets improvisés à l'exécution.

**Décision.** `tools/make-sprites.ts` (`npm run make-sprites`) produit ces sprites en PNG avec les seuls modules de Node : il relit les images du robot (`tools/lib/png.ts`), les recompose (rotation, teinte, superposition) et y ajoute des formes dessinées par distance signée, avec un bord lissé (croissants effilés, disques, traits). Les images vont dans `public/assets/sprites` et sont déclarées dans `sprites.json`, comme celles de l'original ; le jeu ne les distingue pas. `npm run extract-assets` relance la fabrication après avoir extrait les sprites d'origine.

**Pourquoi.** Partir des images d'origine garantit les proportions, les couleurs et l'origine du robot. Un outil rejouable vaut mieux que des fichiers retouchés à la main : on ajuste une valeur et tout est régénéré à l'identique (hasard à graine fixe).

**Conséquences.** Les poses sont limitées à ce que l'original a dessiné : l'outil réagence et habille, il ne dessine pas de nouvelle pose de robot. 4 Mo pour les quatre ultis.

**Règle ajoutée par GD-044.** Le sprite d'un robot ne contient que le robot. Les effets (énergie, poussière, ondes) sont des sprites séparés, dessinés en blanc quand ils doivent prendre la couleur du robot, et superposés par le jeu. On planche d'abord l'animation sur une planche-contact avant de l'essayer en jeu.

## ADR-016 — Les ajouts aux salles d'origine sont décrits à part et greffés au chargement

- **Date** : 2026-11-17
- **Statut** : Acceptée
- **Décidée par** : Claude (choix par défaut, à signaler à l'utilisateur), à la suite de son accord pour redessiner les salles (GD-077)

**Contexte.** Les fichiers de `public/levels` sont produits par `npm run convert-rooms` à partir des salles GameMaker (ADR-006) : toute retouche à la main y serait perdue à la conversion suivante. Le niveau TvTv² demande pourtant d'ajouter du décor et un personnage (GD-080).

**Décision.** Ce que le remake ajoute à une salle est décrit dans `src/sim/additions.ts` : des instances au format de la salle, et au besoin de nouveaux types d'objets. `withAdditions(level)` rend la salle complétée ; le monde l'appelle à sa construction, et le préchargement des sprites aussi. Le fichier d'origine n'est jamais modifié.

**Pourquoi.** La conversion reste fidèle et rejouable ; on voit d'un coup d'œil ce qui vient du remake. Le serveur, le navigateur et les tests passent par le même point, donc voient la même salle. Piste écartée : un second fichier JSON par salle, qui aurait demandé un chargement de plus et un outil pour l'écrire.

**Conséquences.** Les ajouts suivent les règles des instances d'origine (collisions, PNJ, décor). `npm run level-map` les dessine aussi.

**Étendu par GD-081** (même jour). Le mécanisme sait aussi ajouter des pièces de mur et leurs rectangles de collision, des sols et des décalques, et retirer ou modifier un élément d'origine : une fonction reçoit chaque instance et la rend telle quelle, déplacée, ou la supprime ; d'autres désignent les décalques, les pièces de mur et (depuis GD-083) les rectangles de collision à retirer. Le fichier s'appelle toujours `additions.ts`, bien qu'il fasse plus qu'ajouter.

**Sprites du studio.** `tools/make-studio.ts` suit ADR-015 (de vrais sprites, produits par un outil rejouable), mais dessine ses formes au lieu de recomposer des images du jeu : il n'existait rien à recomposer pour un pupitre ou un projecteur. Seul le logo de la chaîne est repris d'un sprite d'origine. Comme pour `make-sprites`, il faut relancer l'outil après un `npm run extract-assets`, qui réécrit les manifestes.

## ADR-017 — Une caméra libre pour parcourir le niveau sans jouer

- **Date** : 2026-11-17
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (« un mode caméra libre afin que je puisse explorer sans brouillard toutes les pièces pour voir le rendu sans avoir à jouer vraiment ; un bouton dans le jeu ») ; les commandes sont des choix par défaut

**Contexte.** Pour juger l'aménagement d'une salle, il fallait jouer jusqu'à elle : trouver les cartes, ouvrir les portes, survivre aux gardes, et le brouillard de guerre cachait encore ce qu'on n'avait pas visité.

**Décision.** Le jeu a une caméra libre, qui quitte le robot pour parcourir la salle en cours.

- **On y entre** par « Explore the level » au menu principal, par « Free camera » au menu de pause, par la touche V en jeu, ou en ouvrant `http://localhost:3000/?view`. On en sort par V ou Échap.
- **On s'y déplace** avec les touches de mouvement (Maj pour aller vite) et on change d'échelle à la molette, de 14 % (la salle entière) à 150 % ; la touche 1 revient à l'échelle du jeu.
- **Le brouillard de guerre n'est pas dessiné, et l'éclairage est coupé au départ** : tout est montré en pleine lumière. La touche L rallume l'éclairage du jeu, à l'échelle 1 seulement, parce que la pénombre est calculée pour la vue normale. Il était allumé par défaut dans la première version ; l'utilisateur l'a fait couper le 2026-11-17 (« ça fait lagger, l'idée est juste de voir les textures et les rooms »). Mesure sur sa machine, plateau de TvTv² à l'échelle 1 : 9,5 ms par image avec l'éclairage, 5,5 ms sans, à toutes les échelles.
- **En solo le jeu s'arrête** : personne ne bouge, le robot ne risque rien, et l'introduction en cours est passée d'un coup. En réseau la partie continue et le robot reste immobile.
- L'interface de jeu est masquée ; un bandeau rappelle les commandes, l'échelle et l'état de l'éclairage.

**Pourquoi.** C'est un outil de travail sur les niveaux, pour l'utilisateur comme pour les sessions de développement. Tout se passe dans l'affichage : la simulation ne sait rien de la caméra libre, donc aucun risque pour les règles du jeu ni pour le réseau.

**Conséquences.** `enterFreeCamera`, `updateFreeCamera` et `placeCamera` dans `GameScene.ts` ; `reveal` et `lightsOff` dans `WorldView.ts` ; `hidden` dans `Hud.ts`. Elle montre la salle en cours seulement : pour voir l'étage, commencer la partie à l'étage (choix du niveau) puis appuyer sur V. Le bouton reste dans le jeu livré : à retirer ou à cacher si le jeu est un jour ouvert au public, puisqu'il dévoile tout le niveau.
