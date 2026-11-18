# Feuille de route

Dernière mise à jour : 2026-11-18.

Le MVP est livré en **4 étapes jouables** `[GD-015]`. À la fin de chaque étape, le jeu se lance et se joue ; l'utilisateur teste et corrige la direction avant l'étape suivante.

**Tenir ce fichier à jour** : cocher ce qui est fait, noter la date, et réécrire « État actuel » quand la situation ou la prochaine action change. L'historique des modifications est dans git (`git log`).

## État actuel

**Les 4 étapes du MVP sont livrées (2026-11-16) — l'étape 4 attend les essais de l'utilisateur.**
**Depuis, TvTv² a été réécrit pour l'acte II de l'arc narratif (GD-076 à GD-089) et se joue du largage à l'écran de fin (2026-11-18)** : introduction, régie, ultimatum, barrage de police au sud, repli par le garage nord, extraction. La zone de forage et SallyBot ne font plus partie de ce niveau (jouables depuis le menu).
**Éditeur de niveaux, étapes 1 et 2 livrées (2026-11-18, ADR-018)** : mobilier, lumières, décalques, portes, fenêtres, murs et sols se retouchent dans le jeu, la sauvegarde réécrit le fichier de la salle, sans commit (ADR-019). À essayer par l'utilisateur ; suite et limites dans [editeur-niveaux.md](editeur-niveaux.md).
Prochaine action : recueillir les retours de l'utilisateur sur l'éditeur ; et toujours sur le nouveau tir de PetBot (GD-093, GD-094 : vitesse du drone, rayon de recherche, puissance) et sur la fin du niveau (face-à-face du parking, dernier combat devant le portail nord, extraction), en premier lieu la difficulté ; puis décider de la suite (voir « Après le MVP »).

## Prérequis (début de l'étape 1)

Connexion internet limitée : **annoncer la taille et attendre l'accord avant chaque téléchargement**.

- [x] Node 22.23.5 en copie portable dans `.tools/node22` (35,6 Mo téléchargés), Node 14 intact. nvm-windows n'a pas été installé (ADR-009).
- [x] Dépendances du projet installées : 33 Mo téléchargés, 183 Mo sur disque (ADR-010).
- [x] Projet GameMaker de 2019 extrait dans `.cache/reference` (287 Mo, non versionné) ; sprites, sols et sons utiles copiés dans `public/assets` (29 Mo).

## Étape 1 — Rez-de-chaussée jouable avec un héros

- [x] Squelette du projet : TypeScript, Phaser 3, serveur Node, commande unique de lancement (`start.cmd`).
- [x] Convertisseur des salles GameMaker vers JSON ; les trois salles du monde 2 sont converties, sans écart de comptage avec l'original.
- [x] Affichage de la salle : sols, murs, mobilier, fenêtres, décalques.
- [x] PetBot : déplacement, visée, dash, tir principal, rechargement avec R, PV, énergie.
- [x] Caméra et HUD (énergie, PV sur le portrait, chargeur, consigne).
- [x] Les 4 types d'ennemis avec l'IA du code ; les civils (patrouille, panique, fuite).
- [x] Portes automatiques et à bouton.
- [x] Prises de courant (bornes de recharge, GD-020).
- [x] Mort du héros : « YOU LOSE », Retry, Exit.
- [x] Menu minimal : titre → jeu → pause.

### Ce qui a été vérifié, et comment

- Par tests automatiques (`npm test`, 8 tests sur le vrai niveau) : chargement du niveau (36 soldats, 52 civils, 36 portes, 4 boutons, 20 fenêtres, 10 bornes), marche, tir et rechargement, énergie et bornes, dégâts et mort, robot bouclier (coup, repoussement, vulnérable seulement de dos), vitre brisée par une balle qui continue, 60 secondes de simulation sans erreur.
- À l'écran dans le navigateur : menu, affichage du rez-de-chaussée, HUD, soldats au pistolet qui repèrent, tirent et meurent, civils qui paniquent, 26 portes automatiques traversées, porte à bouton, pause, écran de défaite et Retry, 60 images par seconde.

### À vérifier par l'utilisateur (non contrôlé à la fin de l'étape 1)

- Sensations de jeu : vitesse, glissement contre les murs et le mobilier, dash, difficulté (GD-018).
- Robot bouclier : logique testée automatiquement, pas observée à l'écran. LightBot et ShotBot : même code que le soldat au pistolet avec d'autres réglages, pas observés en combat.
- Sons (tirs, mort d'un PNJ) et musique : chargés, pas écoutés.
- Éclats de vitre, débris et flaques à la mort d'un PNJ : effets visuels pas observés à l'écran.
- Emplacement des 10 bornes de recharge (GD-020).

### Limites connues de l'étape 1

- L'escalier affiche « The upper floor is not open yet. » : l'étage arrive à l'étape 3.
- Portes à carte fermées, pas de cartes, pas de boîtes bonus, pas de brouillard ni de lumières (étapes 3 et 4).
- Pas de tir secondaire (clic droit) : étape 2. L'énergie se recharge mais ne sert pas encore.
- L'effet « glitch » du héros touché est remplacé par un clignotement ; la ventilation animée est figée.
- Chargement d'une dizaine de secondes : images chargées une par une (ADR-012).

## Étape 2 — Les 3 autres héros

Livrée le 2026-11-16, en attente des essais de l'utilisateur.

- [x] Retours de l'étape 1 traités : projectiles visibles, bornes utilisables de plus loin avec un arc électrique (GD-022).
- [x] Écran de choix du héros.
- [x] Tirs secondaires et leurs 4 stades : drones de PetBot, tourelle d'EngiBot, battes de BatBot, bouclier de BadaBot (GD-023).
- [x] BadaBot, BatBot, EngiBot complets (tirs principaux compris : plasma chargé, coups de batte, balles rebondissantes).
- [x] Sons des héros (chargés avec le héros choisi).
- [x] Carte verte et portes à carte, avancées de l'étape 3 (GD-024).

### Ce qui a été vérifié, et comment

- Par tests automatiques (`npm test`, 17 tests) : salve de drones (coût, dégâts, soin), tourelle (pose, niveau, tir, repli), rebond des balles d'EngiBot, coups de batte, lancer, explosion et rappel des battes, tir chargé et bouclier de BadaBot, robot bouclier vulnérable seulement de dos aux explosions.
- À l'écran : écran de choix, EngiBot avec sa tourelle, BadaBot avec sa boule de plasma et son bouclier, BatBot et sa batte lancée, traînées des balles, arc électrique des bornes.

### À vérifier par l'utilisateur

- Sensations de chaque héros, et équilibre entre eux.
- Drones de PetBot : logique testée, pas observés à l'écran.
- Sons des quatre héros : chargés, pas écoutés.
- Carte verte et porte verte : codées, pas parcourues à l'écran.
- Robot bouclier en solo : il n'est vulnérable que de dos et se tourne vite vers le héros. Les tirs secondaires permettent de le battre (drone ou batte explosive qui éclate derrière lui, balle d'EngiBot qui rebondit, tourelle posée dans son dos). À juger en jouant : s'il reste trop dur seul, ralentir sa rotation.

### Limites connues

- Chargement plus long dans un panneau de navigateur masqué ; le dépôt contient maintenant 51 Mo d'assets, dont 16 Mo de sons au format WAV.

## Étape 3 — Étage, cartes, objectifs

Livrée le 2026-11-16, en attente des essais de l'utilisateur.

- [x] Conversion de `rm_world2_1` ; passage entre salles par l'escalier, avec fondu, dans les deux sens (GD-026).
- [x] Cartes verte et violette, portes à carte, messages associés (GD-024).
- [x] Enchaînement des consignes 1 à 4 ; les deux dernières (foreuses, boss) arrivent avec l'étape 4.
- [x] Sortie du niveau : compte à rebours « Leaving area », puis panneau de fin provisoire avec les statistiques.
- [x] Bonus : les boîtes bonus à ramasser sont retirées du jeu, sur décision de l'utilisateur (GD-027). Rien à développer.

### Ce qui a été vérifié, et comment

- Par tests automatiques (`npm test`, 22 tests) : le parcours complet escalier → étage → carte violette → retour → porte violette → zone de sortie → fin ; la zone de sortie inactive avant la consigne ; l'état d'une salle conservé au retour.
- À l'écran : montée à l'étage avec fondu, affichage de l'étage, ramassage de la carte violette, retour au rez-de-chaussée, compte à rebours de sortie, panneau de fin.

### À vérifier par l'utilisateur

- Le trajet à pied dans l'étage (19 ennemis, 43 civils) : je m'y suis déplacé par commandes de test, pas en jouant.
- La difficulté de l'ensemble du niveau avec un seul héros.
- La lisibilité de la zone de sortie : c'est toute la bande nord de la carte, sans marquage au sol.

## Étape 4 — Boss, ambiance, score

Livrée le 2026-11-16, en attente des essais de l'utilisateur. Décisions : GD-028.

- [x] Conversion de `rm_world2_2` et liaison avec le rez-de-chaussée (la sortie y mène).
- [x] Foreuses destructibles (20 PV, inventé).
- [x] Boss SallyBot, 2 phases, mort, fin de niveau.
- [x] Brouillard de guerre ; lumières simples.
- [x] Écran de score.
- [x] Musique du niveau (une seule piste dans l'original, jouée dans les trois salles).

### Ce qui a été vérifié, et comment

- Par tests automatiques (`npm test`, 26 tests) : consigne des foreuses, dégâts par balle et par explosion, consigne du boss, fin du niveau après sa mort, poursuite et frappe du boss, transformation à mi-vie, invulnérabilité de la phase 2 et fenêtre de respiration, levée du brouillard par une porte.
- À l'écran : arrivée dans la zone de forage, boss qui attaque, barre de vie du boss, foreuse, brouillard sur les pièces fermées, halo des lampes et lueur du héros, 60 images par seconde avec l'éclairage.

### À vérifier par l'utilisateur

- **L'équilibre du combat de boss** : c'est le point le moins sûr. À 10 de vitesse, le boss tuait le héros immobile en une dizaine de secondes ; il est passé à 7 et à 60 PV sans nouvel essai complet.
- L'aspect des lumières (assombrissement, taille de la lueur du héros) et du brouillard.
- La mort du boss et la destruction d'une foreuse : effets pas observés à l'écran.
- L'écran de score au bout du parcours complet joué à la main.

### Limites connues

- Le dépôt contient 82 Mo d'assets (sprites du boss en 840 × 840, sons en WAV) : à alléger avant une mise en ligne (ADR-012).
- Pas d'ombres portées, pas d'effet « glitch » fidèle, pas d'animation de déploiement des héros.

## Après le MVP

- [x] Lumières avec ombres portées et couleurs (GD-038).
- [x] Multijoueur en ligne, première version : salon, 4 joueurs au plus, résurrection (GD-039, GD-040, ADR-014).
- [x] Link entre héros, surcharge sans paliers, attaque ultime de BatBot (GD-043).
- [x] Ultis de PetBot (nanomachines), BadaBot (mur) et EngiBot (grenade électromagnétique), avec leurs sprites (GD-044).
- [x] Éditeur de niveaux, étape 1 : mobilier, lumières, décalques, ordre devant/derrière, sauvegarde du fichier (ADR-018, ADR-019, GD-095).
- [x] Éditeur de niveaux, étape 2 : murs, sols, portes, boutons et fenêtres.
- [ ] Éditeur de niveaux, étape 3 : personnages et patrouilles, brouillard, points d'apparition, repères du scénario.
- [ ] Équilibrage des ultis et du boss après essais à plusieurs.
- [ ] Multijoueur public : plusieurs parties à la fois, reconnexion, hébergement, assets allégés.
- Non planifié : manette, autres mondes, autres héros.
