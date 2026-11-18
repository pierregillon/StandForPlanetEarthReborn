# Feuille de route

Dernière mise à jour : 2026-11-18.

**Ce fichier est le guide pour livrer la première version du jeu : la démo TvTv².** Il dit ce qu'on vise, ce qui reste à trancher et ce qui reste à faire, étape par étape. Le tenir à jour : cocher ce qui est fait, noter la date, réécrire « État actuel » quand la situation ou la prochaine action change. L'historique des modifications est dans git (`git log`) ; le pourquoi de chaque choix, dans les [journaux de décisions](decisions/).

## L'objectif : la démo TvTv² (GD-096)

| Question | Réponse de l'utilisateur (2026-11-18) |
|---|---|
| Pour qui | Des amis joueurs, qui la partageront à leur petite communauté : des joueurs et rétro-joueurs qui aiment essayer de nouveaux jeux. Plus tard, peut-être une plateforme (itch.io ou autre) |
| Quoi | Le niveau TvTv² seul, en entier, du largage à l'extraction : « 100 % de la carte complète » |
| Comment on joue | **En solo, obligatoirement**, avec chacun des quatre robots ; et à plusieurs, avec du défi |
| Comment on y accède | Par un lien, dans le navigateur, sans rien installer |
| Retours | Demandés directement aux joueurs contactés ; pas de mesure automatique dans le jeu |
| Droits | Les sprites, sons et musiques sont libres de diffusion et d'utilisation |

**La démo est prête quand** un joueur qui ne connaît pas le jeu reçoit un lien, comprend quoi faire, termine TvTv² seul avec le robot de son choix, et qu'une partie à plusieurs reste un défi.

## État actuel

- Le MVP d'origine (4 étapes, GD-015) est livré, et bien dépassé : jeu à plusieurs jusqu'à 4, link, attaques ultimes, ombres portées, cinématiques.
- TvTv² a été réécrit pour l'acte II de l'arc narratif et se joue du largage à l'écran de fin (GD-076 à GD-094).
- L'éditeur de niveaux a ses étapes 1 et 2 (ADR-018, ADR-019) : mobilier, lumières, décalques, murs, sols, portes et fenêtres se retouchent dans le jeu. À essayer par l'utilisateur ; suite et limites dans [editeur-niveaux.md](editeur-niveaux.md).

**Prochaine action** : trancher avec l'utilisateur les décisions ci-dessous, en commençant par le rôle du link et de la surcharge (elles orientent l'étape 5), puis commencer l'étape 5.

## Décisions à trancher

Chacune donne une entrée dans le [journal de game design](decisions/game-design.md) une fois tranchée.

- [ ] **Le link, mécanique centrale.** Aujourd'hui il transmet de l'énergie et accélère sa récupération (GD-043, GD-044) : est-ce assez pour donner envie de se lier ? Pistes de l'utilisateur : coups plus forts quand on est lié ; un effet quand on prend une balle en étant lié ; le link permet de dépasser le seuil d'énergie habituel, et ce dépassement apporte d'autres avantages.
- [ ] **La surcharge d'énergie.** Pistes de l'utilisateur : à pleine énergie, plus de dégâts ; en surcharge, une balle reçue retire de l'énergie au lieu de la vie, ou moins de vie.
- [ ] **L'identité de chaque robot.** Ce que chacun incarne (sa personnalité, sa voix : [niveau-tvtv2.md](narration/niveau-tvtv2.md) §5), et les mécaniques qui en découlent. PetBot et BadaBot sont jugés intéressants à jouer ; BatBot et EngiBot le sont moins.
- [ ] **BatBot, seul robot au corps à corps.** Face à des ennemis qui tirent presque tous, il est trop faible pour finir seul. Pistes de l'utilisateur : dash illimité ; dash qui blesse ; touche pour revenir d'un dash à son point de départ.
- [ ] **Les points de sauvegarde.** Aujourd'hui, le seul est sur le plateau, après l'ultimatum (GD-087) : mourir à l'étage fait tout recommencer. En ajouter, ou garder la difficulté d'un niveau sans filet ? Emplacements proposés par l'utilisateur : l'arrivée à l'escalier, le retour au rez-de-chaussée, l'arrivée sur le plateau.
- [ ] **L'hébergement.** Le solo doit pouvoir tourner sans serveur de jeu (la simulation tourne dans le navigateur), donc sur un hébergement de site statique ; le jeu à plusieurs a besoin du serveur Node, allumé en permanence. Où, et à quel coût ?

## Les étapes vers la démo

Chaque étape se termine par un essai de l'utilisateur, comme jusqu'ici.

### Étape 5 — Les mécaniques : robots, link, énergie

- [ ] Appliquer les décisions sur le link et la surcharge.
- [ ] Repasser sur chaque robot : mécaniques cohérentes avec ce qu'il incarne, jouable seul de bout en bout, plaisir de jeu propre à chacun. Qu'aucun ne soit celui qu'on ne veut pas jouer.
  - [ ] BatBot : le rendre viable seul face aux tireurs.
  - [ ] EngiBot : le rendre plus intéressant à jouer.
  - [ ] PetBot : régler le drone à tête chercheuse après essai (GD-093, GD-094 : vitesse, rayon de recherche, puissance).
  - [ ] BadaBot : vérifier qu'il reste intéressant après les changements des autres.

**Terminée quand** l'utilisateur a joué les quatre robots et veut rejouer chacun.

### Étape 6 — L'équilibrage et la difficulté

- [ ] Ajuster ennemis et robots : dégâts, points de vie, vitesse de déplacement (`src/sim/config.ts`).
- [ ] TvTv² se termine en solo avec chacun des quatre robots.
- [ ] À plusieurs, le niveau reste un défi (effectifs selon le nombre de joueurs : GD-090).
- [ ] Le combat de la fin : face-à-face du parking, repli, dernier combat devant le portail nord, extraction.
- [ ] Le robot bouclier en solo : vulnérable seulement de dos, il se tourne vite ; s'il reste trop dur seul, ralentir sa rotation.
- [ ] Les ultis, après essais à plusieurs.

**Terminée quand** l'utilisateur a fini le niveau seul avec chaque robot, puis à deux, et juge la difficulté juste dans les deux cas.

### Étape 7 — Lire le niveau : consignes, points de sauvegarde, lumières

- [ ] Consignes plus visibles, et plus fréquentes : une petite étape à la fois, mise à jour au fil de la progression, pour qu'on sache toujours où aller et quoi faire ensuite. Les textes sont montrés au joueur : relire l'arc narratif avant de les écrire.
- [ ] Appliquer la décision sur les points de sauvegarde.
- [ ] Des lumières partout où il en manque : à l'étage et dans plusieurs pièces. L'éditeur de niveaux sait déjà poser des lumières.
- [ ] Parcourir l'étage à pied en jouant (19 ennemis, 43 civils) : jamais fait à la main.

**Terminée quand** un joueur sait toujours où aller sans aide, et aucune pièce n'est plongée dans le noir sans raison.

### Étape 8 — Les sons

- [ ] Repasser sur tous les sons et vérifier que chacun va avec ce qu'il accompagne. Les sons synthétisés par le jeu (`src/client/sfx.ts` : link, éclair des bornes, véhicule, rechargements, ultis) sont souvent mauvais : les refaire ou les remplacer, en premier le link, l'éclair et l'hélicoptère.
- [ ] Ajouter les sons qui manquent, par exemple la batte de BatBot qui frappe un mur : un son mat.
- [ ] Chaque joueur entend tous les sons qui se produisent près de lui, quel que soit le robot qui les provoque. Aujourd'hui, seuls certains passent. Point de départ : les sons partent de la simulation sous forme d'événements, que le serveur relaie à tous les joueurs ; trouver ceux qui n'en sont pas, ou que l'affichage ne joue que pour son propre robot.
- [ ] Écouter ce qui ne l'a jamais été : sons des quatre robots, musique, tirs, mort des personnages.

**Terminée quand** l'utilisateur a joué une partie à deux sans relever de son faux, absent ou entendu d'un seul côté.

### Étape 9 — Accueillir le joueur et mettre en ligne

- [ ] Menu épuré pour un joueur : retirer ou cacher les outils de développement (« Explore the level », caméra libre, choix du point de départ).
- [ ] Apprendre les commandes en jouant, ou sur un écran clair : déplacement, tirs, dash, borne (E maintenu), rechargement, link, ulti.
- [ ] Réglages minimaux : volume, plein écran. Prévenir que le jeu se joue au clavier et à la souris, sur ordinateur.
- [ ] Écran de crédits, avec les auteurs du jeu d'origine.
- [ ] Alléger les assets (90 Mo aujourd'hui : sons en WAV, une image par fichier, sprites du boss en 840 × 840, ADR-012) et afficher la progression du chargement.
- [ ] Héberger le solo, et le serveur pour jouer à plusieurs.
- [ ] À plusieurs : plusieurs parties en même temps, rejoindre par un code, reconnexion après une coupure.

**Terminée quand** un ami à distance lance le jeu depuis un simple lien, seul puis avec l'utilisateur.

### Étape 10 — La partie d'essai

- [ ] Préparer les questions à poser aux joueurs (compréhension, difficulté, robot préféré, link, ce qui a manqué).
- [ ] Envoyer le lien aux amis choisis.
- [ ] Rassembler les retours dans la documentation et en tirer la suite.

## Finitions, si le temps le permet

- [ ] Effet « glitch » fidèle quand un robot est touché (aujourd'hui un clignotement) ; ventilation animée.
- [ ] Mort de SallyBot et destruction d'une foreuse : effets jamais observés à l'écran (salle hors de TvTv², pour l'acte I).
- [ ] Éditeur de niveaux, étape 3 : personnages et patrouilles, brouillard, points d'apparition, repères du scénario.

## Après la démo

- Les missions suivantes de l'arc narratif : l'acte I (la zone de forage et SallyBot existent déjà), le premier niveau SFHB.
- Une plateforme de diffusion (itch.io ou autre).
- Non planifié : manette, autres héros.

## Ce qui est livré

Le détail est dans git et dans les journaux de décisions.

- **Étape 1** (2026-11-16) : rez-de-chaussée jouable avec PetBot, ennemis et civils avec l'IA du code, portes, bornes de recharge, mort et Retry, menus.
- **Étape 2** (2026-11-16) : les quatre robots avec leurs tirs principaux et secondaires, écran de choix, cartes et portes à carte (GD-022 à GD-024).
- **Étape 3** (2026-11-16) : étage, cartes verte et violette, consignes enchaînées, sortie du niveau (GD-024 à GD-027).
- **Étape 4** (2026-11-16) : zone de forage, foreuses, boss SallyBot, brouillard, lumières, écran de score, musique (GD-028).
- **Après le MVP** : lumières avec ombres portées et couleurs (GD-038) ; jeu à plusieurs jusqu'à 4 avec résurrection (GD-039, GD-040, ADR-014) ; link et surcharge (GD-043) ; les quatre ultis (GD-044).
- **TvTv², acte II** (2026-11-17 et 18) : introduction et largage, régie, plateau, ultimatum, riposte de la police, face-à-face, repli par le nord, extraction (GD-076 à GD-094).
- **Éditeur de niveaux, étapes 1 et 2** (2026-11-18) : mobilier, lumières, décalques, ordre de dessin, murs, sols, portes, boutons et fenêtres (ADR-018, ADR-019, GD-095).
