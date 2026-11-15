# Feuille de route

Dernière mise à jour : 2026-11-15.

Le MVP est livré en **4 étapes jouables** `[GD-015]`. À la fin de chaque étape, le jeu se lance et se joue ; l'utilisateur teste et corrige la direction avant l'étape suivante.

**Tenir ce fichier à jour** : cocher ce qui est fait, noter la date, et ajouter une ligne dans « Journal d'avancement » à chaque session de travail.

## État actuel

**Étape 0 terminée — documentation et dépôt créés. Aucun code de jeu, rien d'installé.**
Prochaine action : étape 1, en commençant par les prérequis.

## Prérequis (début de l'étape 1)

Connexion internet limitée : **annoncer la taille et attendre l'accord avant chaque téléchargement**.

- [ ] Installer nvm-windows (~5 Mo) puis Node 22 LTS (~30 Mo), en gardant Node 14. *Approche validée par l'utilisateur le 2026-11-15.*
- [ ] Installer les dépendances du projet (~100 Mo estimés ; donner le chiffre réel avant de lancer).
- [ ] Extraire sprites et sons du commit `d438c548` (déjà sur la machine, aucun téléchargement) — voir [reference/README.md](reference/README.md).

## Étape 1 — Rez-de-chaussée jouable avec un héros

- [ ] Squelette du projet : TypeScript, Phaser 3, serveur Node, commande unique de lancement.
- [ ] Convertisseur des salles GameMaker vers JSON ; conversion de `rm_world2`.
- [ ] Affichage de la salle : sols, murs, mobilier, fenêtres.
- [ ] Un héros (PetBot proposé) : déplacement, visée, dash, tir principal, rechargement avec R, PV, énergie.
- [ ] Caméra et HUD (énergie, PV sur le portrait, chargeur).
- [ ] Les 4 types d'ennemis avec l'IA du code ; les civils.
- [ ] Portes automatiques et à bouton.
- [ ] Prises de courant.
- [ ] Mort du héros : « YOU LOSE », Retry, Exit.
- [ ] Menu minimal : titre → jeu → pause.

## Étape 2 — Les 3 autres héros

- [ ] Écran de choix du héros.
- [ ] Tirs secondaires et leurs 4 stades : drones de PetBot, tourelle d'EngiBot, battes de BatBot, bouclier de BadaBot.
- [ ] BadaBot, BatBot, EngiBot complets.
- [ ] Sons des héros.

## Étape 3 — Étage, cartes, objectifs

- [ ] Conversion de `rm_world2_1` ; passage entre salles (escalier, téléporteurs, fondu).
- [ ] Cartes verte et violette, portes à carte, messages associés.
- [ ] Enchaînement des 6 consignes.
- [ ] Bonus (selon la décision prise sur les boîtes bonus).

## Étape 4 — Boss, ambiance, score

- [ ] Conversion de `rm_world2_2` et liaison avec le rez-de-chaussée.
- [ ] Foreuses destructibles.
- [ ] Boss SallyBot, 2 phases, mort, fin de niveau.
- [ ] Brouillard de guerre ; lumières simples.
- [ ] Écran de score.
- [ ] Musiques.

## Après le MVP (non planifié)

Multijoueur en ligne, link et résurrection, manette, ombres portées, autres mondes, autres héros.

## Journal d'avancement

| Date | Ce qui a été fait |
|---|---|
| 2026-11-15 | Analyse du jeu d'origine (version 2019), cadrage du MVP avec l'utilisateur, création du dépôt et de la documentation. |
