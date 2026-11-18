# Cadre du MVP

Dernière mise à jour : 2026-11-17.

> **Ce MVP est livré.** La version visée maintenant est la démo TvTv² (GD-096) : son objectif et ce qui reste à faire sont dans la [feuille de route](02-feuille-de-route.md). Ce document reste l'état des lieux de départ : périmètre initial, écarts voulus avec le jeu d'origine, sources de vérité. Certains points en sont dépassés (multijoueur, link, cinématiques, Node portable).

Ce document décrit **ce que l'on construit** pour la première version jouable. Le **pourquoi** de chaque choix est dans les journaux de décisions ([game design](decisions/game-design.md), [architecture](decisions/architecture.md)) ; les identifiants entre crochets (`GD-005`, `ADR-002`) y renvoient.

## 1. Le projet en une phrase

Refaire en **jeu web** (jouable dans un navigateur) le jeu GameMaker « Stand For Planet Earth » : un jeu de tir en vue du dessus où une équipe de robots traverse des niveaux remplis de soldats, de robots ennemis et de civils. Le jeu d'origine est coopératif à 4 ; **le MVP est solo** `[GD-002]`.

## 2. Sources de vérité, par ordre de priorité

1. **Les décisions de ce dépôt** (ce document et les journaux de décisions).
2. **Le code GameMaker Studio 2 de janvier 2019** (commit `d438c548` du dépôt d'origine) : c'est la référence fonctionnelle `[GD-001]`. Il est décrit en détail dans [reference/jeu-original/](reference/jeu-original/).
3. **Les documents de conception d'époque** (GDD, scénario, cahier des charges graphique), dans [reference/documents-origine/](reference/documents-origine/). Ils décrivent une vision plus large que le code ; on y puise pour combler un manque, pas pour contredire le code.

**Pour l'histoire** (actes, missions, personnages, ordre et thème des niveaux, dialogues), la référence est [narration/arc-narratif.md](narration/arc-narratif.md), écrit par l'utilisateur `[GD-076]`. Il remplace le scénario d'époque. Il ne change rien aux mécaniques ni au périmètre du MVP décrits ici.

Comment accéder au code et aux assets d'origine : voir [reference/README.md](reference/README.md).

## 3. Périmètre du MVP

### Héros `[GD-003]` `[GD-004]`

Quatre héros sélectionnables, avec les capacités du code de 2019. Tous : 12 PV, 2 dashs, énergie de 0 à 12 qui remonte seule jusqu'à 3.

| Héros | Tir principal | Tir secondaire (coûte de l'énergie) |
|---|---|---|
| BadaBot | Tir chargé : 1 à 3 boules de plasma explosives selon la durée de charge | Bouclier qui bloque les balles ennemies |
| BatBot | Coups de batte au corps à corps | Lance une batte ; appui long pour rappeler les battes |
| EngiBot | Rafale de balles qui rebondissent | Pose une tourelle (une seule à la fois) |
| PetBot | Tir qui blesse les ennemis et soigne les alliés (remake : des mini-drones à tête chercheuse, GD-093) | Lâche 3 drones qui explosent et soignent autour d'eux |

Les tirs secondaires ont **4 stades de puissance**, par tranches de 3 points d'énergie (3, 6, 9, 12).

### Écarts volontaires avec le code d'origine

| Sujet | Code de 2019 | MVP | Décision |
|---|---|---|---|
| Munitions | Stock limité (~100), aucun rechargement, bonus munitions | **Illimitées, rechargement manuel avec R** | `[GD-005]` |
| Énergie au-delà de 3 | Link (multijoueur) ou bonus énergie | **Prises de courant où le robot se recharge** | `[GD-006]` |
| Mort du héros | Désactivée par défaut | **Activée** : « YOU LOSE », Retry relance la salle | `[GD-007]` |
| Fin du niveau | Rester 10 s sur une zone du rez-de-chaussée | **Enchaînement de 6 consignes, fin à la mort du boss** | `[GD-010]` |
| Salle du boss | Reliée à rien, boss inachevé | **Reliée au niveau, boss terminé** | `[GD-009]` |
| Bogues connus | Une quinzaine relevés | **Corrigés, pas reproduits** | `[GD-014]` |
| Lumière | Lumières + ombres portées | **Brouillard de guerre + lumières d'origine avec ombres portées et couleurs** (ajoutées après le MVP) | `[GD-011]` `[GD-038]` |

### Ennemis et PNJ `[GD-008]`

- Humain au pistolet, robot à bouclier (vulnérable de dos, repousse le héros), LightBot (rapide, mitraillette), ShotBot (fusil à pompe).
- Civils (6 apparences) qui paniquent et fuient ; le score compte ceux qui sont tués.
- Boss SallyBot : 100 PV, corps à corps, 2 phases.
- IA du code : patrouille, ouïe des tirs, temps de surprise, poursuite, attaque à portée avec ligne de vue.

### Niveau `[GD-009]` `[GD-010]`

Le **monde 2 complet**, trois salles converties automatiquement depuis le projet GameMaker `[ADR-006]` :

1. `rm_world2` — rez-de-chaussée (36 ennemis, 52 civils, carte verte, escalier, sortie).
2. `rm_world2_1` — étage (19 ennemis, 43 civils, carte violette).
3. `rm_world2_2` — zone de forage (boss SallyBot, 3 foreuses).

Consignes enchaînées, en anglais comme dans le code :
`Go to the upper floor` → `Find the purple key` → `Go back to ground floor` → `Exit to the drilling area` → `Destroy the drills` → `Kill SallyBot`. Puis écran de score.

> Depuis GD-085 (2026-11-17), le niveau est celui de la chaîne TvTv² : après le retour au rez-de-chaussée, les consignes mènent à la régie, au plateau et à l'ultimatum (`docs/narration/niveau-tvtv2.md`, section 10). La zone de forage n'en fait plus partie ; elle reste jouable depuis le menu.

Portes : automatiques, à bouton, à carte verte ou violette.

### Présentation

- Textes **en anglais**, comme le code `[GD-012]`.
- Clavier-souris : déplacement **ZQSD et WASD** (mêmes touches physiques, sans réglage), souris pour viser, clic gauche / clic droit pour les tirs, Espace ou Maj pour le dash, E pour utiliser et pour se brancher sur une borne (maintenir), R pour recharger, Échap pour la pause `[GD-016]`. Manette : plus tard `[GD-012]`.
- Visuels et sons : ceux du projet GameMaker de 2019. S'il manque un sprite ou une posture, il peut être régénéré fidèlement à l'existant `[ADR-007]`.
- Équilibrage : valeurs du code, ajustées pour un joueur seul, regroupées dans un fichier de réglages `[GD-013]`.

## 4. Technique `[ADR-001]` à `[ADR-006]`

- **Phaser 3** (moteur de jeu 2D) pour l'affichage.
- **Un seul projet TypeScript** : un serveur Node sert le jeu et pourra héberger du code serveur ; une seule commande pour lancer.
- **Logique de jeu séparée de l'affichage**, pour pouvoir la faire tourner côté serveur quand le multijoueur arrivera.
- **Niveaux en fichiers JSON** générés par un convertisseur depuis les salles GameMaker, modifiables à la main.
- Node 22 LTS en copie portable dans `.tools/node22`, à côté du Node 14 du système `[ADR-009]`. Hébergement : non décidé, local pour l'instant.

## 5. Hors périmètre du MVP

Multijoueur et chat ; link entre héros et résurrection (ils demandent un coéquipier) ; boîtes bonus à ramasser (retirées, `[GD-027]`) ; manette ; ombres portées dynamiques ; mondes 1, 3, 4 et arènes ; héros NanoBot, RamBot, ShotBot ; fusion d'ennemis ; bornes d'arcade ; cinématiques et dialogues ; New Game + ; partie « Stand For Human Being » du scénario.

## 6. Points encore ouverts

À trancher au moment où le sujet arrive, puis à consigner dans le journal de game design.

| Sujet | Proposition par défaut | À décider à l'étape |
|---|---|---|
| Emplacement et nombre des prises de courant | **Fait par défaut à l'étape 1** `[GD-020]` : une borne à la place de chaque bonus munitions (10 au rez-de-chaussée). À confirmer par l'utilisateur ; un vrai sprite reste à produire | 1, à revoir |
| Boîtes bonus aléatoires (invincibilité, vitesse, énergie), stockées dans 2 emplacements (touches 1 et 2) | **Tranché** `[GD-027]` : retirées du jeu, sur décision de l'utilisateur | — |
| Tailles de chargeur et durées de rechargement | PetBot : 24 balles, 1,2 s `[GD-021]`, à ajuster après essai. Les trois autres héros : à l'étape 2 | 2 |
| Premier héros livré | **Fait** : PetBot | — |
| Conflit de la touche A | **Résolu** `[GD-016]` : touches lues par position physique, branchement avec E | — |
| Difficulté en solo | Invulnérabilité après un dégât allongée à 0,5–1 s `[GD-018]` ; à revoir après essai et quand le soin de PetBot existera | 2 |
| Tir soignant de PetBot en solo | Sans allié à soigner, garder seulement le soin de zone des drones sur soi-même | 2 |
| Foreuses destructibles | Non destructibles dans le code : PV et effets à inventer | 4 |
| Passage du rez-de-chaussée vers la zone de forage | La zone de sortie du rez-de-chaussée y mène, une fois la consigne 4 active | 3 |
| Mort de SallyBot | Pas d'animation de mort dans le code : explosion de robot existante, ou sprite régénéré | 4 |
| Note finale de l'écran de score | « Global note : 42 » est codé en dur : la calculer ou la retirer | 4 |
