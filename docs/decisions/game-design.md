# Journal des décisions de game design

Mode d'emploi et modèle d'entrée : [README.md](README.md).

« Le code » désigne le jeu GameMaker Studio 2 de janvier 2019 (voir GD-001). « Le GDD » désigne le Game Design Document d'époque.

| N° | Décision | Date | Statut |
|---|---|---|---|
| GD-001 | La référence est le code GameMaker Studio 2 de janvier 2019 | 2026-11-15 | Acceptée |
| GD-002 | Solo d'abord ; multijoueur, link et résurrection plus tard | 2026-11-15 | Acceptée |
| GD-003 | Quatre héros : BadaBot, BatBot, EngiBot, PetBot | 2026-11-15 | Acceptée |
| GD-004 | Capacités des héros : celles du code, avec les 4 stades d'énergie | 2026-11-15 | Acceptée |
| GD-005 | Munitions illimitées avec rechargement manuel (touche R) | 2026-11-15 | Acceptée |
| GD-006 | Des prises de courant remplacent les bonus énergie | 2026-11-15 | Acceptée |
| GD-007 | La mort du héros est activée ; Retry relance la salle | 2026-11-15 | Acceptée |
| GD-008 | Ennemis, civils et IA : ceux du code | 2026-11-15 | Acceptée |
| GD-009 | Premier niveau : le monde 2 complet, avec le boss | 2026-11-15 | Acceptée |
| GD-010 | Le niveau suit 6 consignes et se termine à la mort de SallyBot | 2026-11-15 | Acceptée |
| GD-011 | Brouillard de guerre et lumières simples, sans ombres portées | 2026-11-15 | Acceptée |
| GD-012 | Textes en anglais ; clavier-souris en ZQSD et WASD ; manette plus tard | 2026-11-15 | Acceptée |
| GD-013 | Équilibrage : valeurs du code, ajustées pour un joueur seul | 2026-11-15 | Acceptée |
| GD-014 | Les bogues du jeu d'origine sont corrigés, pas reproduits | 2026-11-15 | Acceptée |
| GD-015 | Livraison en 4 étapes jouables | 2026-11-15 | Acceptée |

---

## GD-001 — La référence est le code GameMaker Studio 2 de janvier 2019

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** Trois états du jeu existent : le dossier de travail local (février 2017, GameMaker Studio 1), la branche `develop` connue localement (mars 2017), et la branche `develop` sur GitHub (commit `d438c548`, 17 janvier 2019, migrée vers GameMaker Studio 2, 637 commits plus loin). Les documents d'époque (GDD, scénario, cahier des charges graphique) décrivent une vision plus large et souvent différente du code.

**Décision.** Le périmètre fonctionnel du remake est celui du code de janvier 2019. Les documents d'époque servent à combler ce que le code n'a pas, pas à le contredire.

**Pourquoi.** L'utilisateur a confirmé que la version GameMaker Studio 2 est la version de référence. C'est la plus aboutie : vrais visuels des 4 héros, 4 types d'ennemis, civils, boss, bonus, cartes, sons.

**Conséquences.** Une première série de réponses de cadrage avait été donnée sur la base de la version 2017, analysée par erreur ; elle est caduque et remplacée par les entrées de ce journal. Le code de 2019 est décrit dans `docs/reference/jeu-original/`.

---

## GD-002 — Solo d'abord ; multijoueur, link et résurrection plus tard

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** Le jeu d'origine est coopératif jusqu'à 4. Sa mécanique phare, le link, consiste à donner son énergie à un coéquipier ; la résurrection demande aussi un coéquipier.

**Décision.** Le MVP se joue seul. Le multijoueur, le link entre héros et la résurrection ne sont pas développés dans le MVP.

**Pourquoi.** L'utilisateur veut d'abord un jeu jouable et un premier niveau en solo, en acceptant que le link, bien que central, attende.

**Conséquences.** Sans link, l'énergie ne dépasserait jamais 3 : voir GD-006. La logique de jeu est écrite pour pouvoir tourner côté serveur plus tard (ADR-005). Le système d'énergie garde sa plage de 0 à 12 pour accueillir le link.

---

## GD-003 — Quatre héros : BadaBot, BatBot, EngiBot, PetBot

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** Le GDD décrit sept héros. Le code de 2019 en rend quatre sélectionnables ; NanoBot et RamBot y subsistent comme vestiges non fonctionnels.

**Décision.** Les quatre héros du code : BadaBot, BatBot, EngiBot, PetBot.

**Pourquoi.** Ce sont ceux que l'utilisateur a cités de mémoire comme « ceux du jeu », ceux que le code rend jouables, et les seuls à avoir de vrais visuels.

**Conséquences.** NanoBot, RamBot, ShotBot : hors périmètre.

---

## GD-004 — Capacités des héros : celles du code, avec les 4 stades d'énergie

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** Le GDD et le code divergent sur les capacités (par exemple : dans le GDD, BatBot saute vers sa batte lancée ; dans le code, il la rappelle). Le code donne à chaque tir secondaire 4 niveaux de puissance selon l'énergie, par tranches de 3.

**Décision.** Suivre le code de 2019 pour les tirs principaux, les tirs secondaires et leurs stades. Ne puiser dans le GDD que pour combler un manque réel.

**Pourquoi.** L'utilisateur avait choisi « le code, complété par le GDD là où il manque quelque chose ». Dans la version de 2019, les quatre héros ont déjà leurs deux tirs : il ne reste presque rien à combler.

**Conséquences.** Valeurs exactes dans `docs/reference/jeu-original/01-heros-et-joueur.md`. BadaBot n'a aucun stade dans le code. Le tir de PetBot soigne les alliés, ce qui n'a pas d'objet en solo (point ouvert).

---

## GD-005 — Munitions illimitées avec rechargement manuel (touche R)

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur, contre la recommandation de suivre le code

**Contexte.** Dans le code : environ 100 munitions par héros (BatBot n'en a pas), aucun rechargement, et un bonus munitions qui remet le stock au maximum. Le GDD prévoit l'inverse : munitions illimitées et rechargement manuel.

**Décision.** Munitions illimitées ; chaque arme à feu a un chargeur que l'on recharge avec R.

**Pourquoi.** Choix de l'utilisateur, exprimé deux fois : c'est la règle du GDD. Options écartées : le stock limité du code ; un stock limité combiné au rechargement.

**Conséquences.** Tailles de chargeur et durées de rechargement sont à inventer (le code n'en a pas) et à placer dans le fichier de réglages. Les bonus munitions du niveau n'ont plus d'objet et sont retirés ; leurs emplacements peuvent servir aux prises de courant (GD-006). La statistique « munitions utilisées » de l'écran de score reste possible. BatBot n'est pas concerné : sa contrainte reste de récupérer ses battes.

---

## GD-006 — Des prises de courant remplacent les bonus énergie

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** L'énergie remonte seule jusqu'à 3 (stade 1 des tirs secondaires). Les stades 2 à 4 demandent 6, 9 et 12 points. Dans le code, on n'y arrive que par le link (multijoueur) ou par un bonus énergie qui remplit tout d'un coup. En solo, sans link, les stades élevés seraient presque inaccessibles.

**Décision.** Placer dans le niveau des prises de courant (bornes) auxquelles le robot se branche pour recharger son énergie. Elles remplacent les bonus énergie.

**Pourquoi.** L'utilisateur trouve qu'un robot qui se recharge sur une prise est plus réaliste qu'un « bonus » à ramasser. Cela permet aussi de pratiquer en solo le geste du link et les stades élevés. Options écartées : garder seulement les bonus énergie du code ; laisser l'énergie remonter seule jusqu'à 12 (pouvoirs trop puissants, link sans intérêt plus tard).

**Conséquences.** Ni le code ni le GDD ne décrivent ces prises : leur fonctionnement est à préciser à l'étape 1 et à consigner ici. Proposition de départ : se brancher en maintenant la touche de link (A) à proximité, +1 énergie par seconde jusqu'à 12 (le rythme du link d'origine), héros immobile pendant la charge ; au-delà de 3, l'énergie redescend de 1 toutes les 2 secondes comme dans le code. Emplacement : le monde 2 ne contient aucun bonus énergie posé, donc les positions sont à choisir (les emplacements des bonus munitions sont candidats). Le tirage « énergie » des boîtes bonus aléatoires devient redondant (point ouvert).

---

## GD-007 — La mort du héros est activée ; Retry relance la salle

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** Dans le code, la mort est désactivée par défaut (`canDie = False`) : à 0 PV le héros reste jouable. Le système complet existe pourtant : épave au sol, puis « YOU LOSE » quand tous les héros sont morts, avec Retry (recharge la salle courante) et Exit. Le GDD prévoit une résurrection par un coéquipier, impossible seul.

**Décision.** Activer la mort. En solo, 0 PV mène à « YOU LOSE » ; Retry relance la salle en cours, remise à zéro ; Exit ramène au menu.

**Pourquoi.** Sans mort, le jeu n'a pas d'enjeu. L'utilisateur a choisi de recommencer la salle en cours, ce qui correspond au bouton Retry déjà prévu par le code. Options écartées : recommencer tout le niveau (trop punitif) ; réapparaître sur place (sans enjeu).

**Conséquences.** Définir ce qui est conservé après un Retry : les salles déjà traversées restent acquises ; l'état des cartes et des consignes au moment d'entrer dans la salle doit être restauré (à préciser à l'étape 3). Chaque dégât donne 10 à 40 images d'invulnérabilité, comme dans le code.

---

## GD-008 — Ennemis, civils et IA : ceux du code

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : Claude (choix par défaut annoncé à l'utilisateur, sans objection)

**Contexte.** Le code de 2019 a quatre soldats (humain au pistolet, robot à bouclier, LightBot, ShotBot), six apparences de civils et un boss. Le GDD décrit d'autres ennemis (Riotbot, fusion d'ennemis) et le cahier graphique d'autres encore.

**Décision.** Reprendre les ennemis, les civils et l'IA du code : patrouille, ouïe des tirs, temps de surprise, poursuite avec recherche de chemin, attaque à portée avec ligne de vue, retour à la patrouille quand la cible est perdue ; civils qui paniquent par contagion et fuient.

**Pourquoi.** Le monde 2 est peuplé de ces ennemis et de ces civils ; les retirer viderait le niveau.

**Conséquences.** Détails dans `docs/reference/jeu-original/02-ennemis-et-ia.md`. Deux points à trancher en codant : le coup du robot à bouclier a deux comportements concurrents dans le code (avec ou sans repoussement) ; la recherche de chemin d'origine ignore les murs à cause d'un bogue (voir GD-014).

---

## GD-009 — Premier niveau : le monde 2 complet, avec le boss

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur, au-delà de la recommandation (rez-de-chaussée et étage seulement)

**Contexte.** Seules cinq salles sont proposées au joueur dans le code de 2019. Le monde 2 est le plus abouti : rez-de-chaussée (`rm_world2`), étage (`rm_world2_1`) et zone de forage (`rm_world2_2`) où se trouve le boss SallyBot. Cette dernière salle n'est reliée à aucune autre et n'a pas de murs ; le boss n'a ni animation de mort ni fin de niveau. Le monde 4 n'a pas de fin ; les mondes 1 et 3 et les arènes sont archivés.

**Décision.** Le MVP contient les trois salles du monde 2. La zone de forage est reliée au rez-de-chaussée et le boss est terminé.

**Pourquoi.** Choix de l'utilisateur : avoir un niveau complet, boss compris.

**Conséquences.** À inventer : le passage vers la zone de forage, la mort de SallyBot, les limites de sa salle, des foreuses destructibles (GD-010). Ce travail est placé en étape 4.

---

## GD-010 — Le niveau suit 6 consignes et se termine à la mort de SallyBot

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (sur recommandation)

**Contexte.** Le code déclare des consignes pour le monde 2 mais n'affiche que la première, sans aucune logique d'objectifs. Aujourd'hui le niveau se termine en restant 10 secondes sur une zone invisible du rez-de-chaussée, quels que soient les ennemis restants.

**Décision.** Afficher les consignes l'une après l'autre, chacune quand la précédente est remplie :

1. `Go to the upper floor`
2. `Find the purple key`
3. `Go back to ground floor`
4. `Exit to the drilling area`
5. `Destroy the drills`
6. `Kill SallyBot`

Le niveau se termine à la mort de SallyBot, suivie de l'écran de score.

**Pourquoi.** C'est le scénario que le code annonçait sans l'avoir branché ; il donne un fil conducteur au niveau. Options écartées : le même enchaînement sans les foreuses ; l'exploration libre du code actuel.

**Conséquences.** Les foreuses ne sont pas destructibles dans le code : PV et effets à inventer. Le code liste « Destroy the drills » deux fois (textes 5 et 7) ; on n'en garde qu'une, avant le boss. La zone de fin du rez-de-chaussée devient le passage vers la zone de forage.

---

## GD-011 — Brouillard de guerre et lumières simples, sans ombres portées

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur, au-delà de la recommandation (brouillard seul)

**Contexte.** Le code masque les pièces tant que leur porte n'a pas été ouverte (brouillard de guerre) et calcule lumières et ombres portées par les murs et les objets. Le GDD liste la « gestion de la lumière » parmi les mécaniques.

**Décision.** Reprendre le brouillard de guerre, et éclairer autour des lampes du niveau sur un fond assombri, sans calculer d'ombres portées.

**Pourquoi.** Le brouillard change la façon de jouer : on ne voit pas ce qui attend derrière une porte. Les lumières simples donnent l'ambiance pour un coût modéré. Les ombres portées sont le chantier technique le plus lourd du jeu d'origine et n'apportent rien au gameplay.

**Conséquences.** Placé en étape 4. Les ombres portées restent possibles après le MVP.

---

## GD-012 — Textes en anglais ; clavier-souris en ZQSD et WASD ; manette plus tard

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur, contre la recommandation de traduire en français

**Contexte.** Les textes du code sont en anglais (« YOU LOSE », consignes). Le clavier est lu en ZQSD alors que l'aide en jeu affiche « WASD ». Une manette Xbox est gérée.

**Décision.** Garder les textes en anglais. Clavier-souris seulement dans le MVP, avec déplacement en ZQSD et en WASD. Touches du code : souris pour viser, clic gauche et clic droit pour les tirs, Espace ou Maj pour le dash, E pour utiliser, A pour le link (réutilisée pour les prises de courant), 1 et 2 pour les bonus stockés, Échap pour la pause. R, libre dans le code, sert au rechargement (GD-005).

**Pourquoi.** L'utilisateur préfère rester fidèle aux textes d'origine. Accepter ZQSD et WASD règle l'incohérence entre l'aide et le code, et sert les claviers AZERTY comme QWERTY.

**Conséquences.** La touche A sert à la fois à aller à gauche en WASD et au link dans le code : le conflit est à résoudre à l'étape 1 (par exemple une autre touche pour se brancher, ou un choix de disposition dans les options), et la solution à consigner ici. La manette viendra après le MVP.

---

## GD-013 — Équilibrage : valeurs du code, ajustées pour un joueur seul

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (sur recommandation)

**Contexte.** Le jeu d'origine est réglé pour quatre joueurs : le rez-de-chaussée du monde 2 compte 36 ennemis. Un héros a 12 PV et chaque projectile ennemi enlève 1 PV.

**Décision.** Partir des valeurs du code et les ajuster pour que le jeu soit jouable et intéressant seul. Toutes les valeurs sont regroupées dans un fichier de réglages modifiable.

**Pourquoi.** Reprendre les valeurs à l'identique donnerait un jeu trop dur ou mal rythmé en solo.

**Conséquences.** Tout écart notable avec une valeur du code est consigné dans ce journal, avec la valeur d'origine et la raison.

---

## GD-014 — Les bogues du jeu d'origine sont corrigés, pas reproduits

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : Claude (choix par défaut annoncé à l'utilisateur, sans objection)

**Contexte.** L'analyse du code a relevé une quinzaine de bogues ou d'inachèvements. Exemples : la recherche de chemin des ennemis ignore les murs ; certains bonus ne disparaissent pas au ramassage ; la batte perçante explose à chaque image ; les volumes réglés dans les options ne sont jamais appliqués ; la note finale est codée en dur.

**Décision.** Implémenter le comportement manifestement voulu, pas le bogue.

**Pourquoi.** L'objectif est un jeu fidèle à l'intention, pas une copie des défauts.

**Conséquences.** Quand l'intention n'est pas évidente, ou quand la correction change sensiblement l'expérience, le cas fait l'objet d'une entrée dans ce journal. Les bogues relevés sont listés à la fin de chacun des trois documents de `docs/reference/jeu-original/`.

---

## GD-015 — Livraison en 4 étapes jouables

- **Date** : 2026-11-15
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (sur recommandation)

**Contexte.** Le périmètre retenu est large : 4 héros, 4 types d'ennemis, civils, boss, 3 salles, objectifs, brouillard et lumières.

**Décision.** Quatre étapes, chacune jouable : (1) rez-de-chaussée avec un héros, ennemis, civils, portes, prises de courant ; (2) les trois autres héros ; (3) étage, cartes, consignes ; (4) boss, brouillard, lumières, score.

**Pourquoi.** L'utilisateur peut tester et corriger la direction à chaque étape ; une erreur de direction coûte moins cher.

**Conséquences.** Le détail et l'avancement sont dans `docs/02-feuille-de-route.md`.

---

## GD-016 — Touches lues par position physique ; se brancher avec la touche Utiliser

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : choix par défaut (à valider par l'utilisateur)

**Contexte.** GD-012 demande ZQSD et WASD. En WASD, la touche A sert à aller à gauche, alors que le code d'origine l'utilise pour le link, que GD-006 proposait de reprendre pour les prises de courant.

**Décision.** Le jeu lit la position physique des touches (`KeyboardEvent.code`), pas la lettre : les quatre touches de déplacement sont les mêmes sur un clavier AZERTY (ZQSD) et QWERTY (WASD), sans réglage. On se branche sur une prise en maintenant la touche Utiliser (E), la même que pour les boutons de porte. Autres touches : R recharge, Espace ou Maj pour le dash, Échap pour la pause, flèches en alternative pour se déplacer.

**Pourquoi.** Aucun écran de choix de disposition à écrire, et le conflit de la touche A disparaît. Une seule touche d'interaction suffit en solo.

**Conséquences.** Le link (multijoueur, hors MVP) devra recevoir sa propre touche le moment venu ; la position physique du A d'un clavier AZERTY est libre.

---

## GD-017 — Coup de bouclier : 1 dégât et repoussement, toujours

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : choix par défaut

**Contexte.** Dans le code d'origine, selon l'ordre d'exécution des événements, le coup du robot bouclier inflige soit 1 dégât avec repoussement de 350 px, soit 1 dégât sans repoussement (voir `docs/reference/jeu-original/02-ennemis-et-ia.md`, §2.3).

**Décision.** Le coup inflige toujours 1 dégât et repousse le héros de 350 px à 15 px par step, sauf si un obstacle se trouve juste derrière lui. Il ignore l'invulnérabilité temporaire, comme dans l'original.

**Pourquoi.** C'est l'intention manifeste du code (GD-014).

**Conséquences.** La zone de frappe est la boîte du sprite `spr_npc2_bullet` placée au bout du bouclier ; elle est testée au moment du coup. Couvert par un test automatique ; pas encore observé à l'écran.

---

## GD-018 — Invulnérabilité après un dégât allongée pour le solo

- **Date** : 2026-11-16
- **Statut** : Acceptée — à ajuster après essai
- **Décidée par** : choix par défaut (application de GD-013)

**Contexte.** Dans l'original, un dégât rend le héros invulnérable 10 à 40 steps (0,17 à 0,67 s), mais la mort y est désactivée. Avec la mort activée (GD-007), un seul héros et aucun soin avant l'étape 2, deux soldats au pistolet ont tué le héros immobile en une dizaine de secondes lors des essais.

**Décision.** L'invulnérabilité dure 30 à 60 steps (0,5 à 1 s). Les autres valeurs de combat restent celles du code.

**Pourquoi.** Rendre la première étape jouable sans toucher aux ennemis eux-mêmes. Un seul réglage, dans `src/sim/config.ts` (`invulnMinSteps`, `invulnMaxSteps`).

**Conséquences.** L'équilibrage complet sera revu quand les tirs secondaires (soin des drones de PetBot) existeront, à l'étape 2.

---

## GD-019 — Corrections de collision par rapport à l'original

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : choix par défaut (application de GD-014)

**Contexte.** L'original teste les collisions avec les masques des sprites. Le remake n'utilise pas ces masques pixel par pixel.

**Décision.**

- Héros et PNJ sont des cercles (rayon tiré du masque elliptique de leur sprite) ; murs, portes, fenêtres et meubles sont des rectangles orientés (boîte englobante du masque). Le héros glisse le long des obstacles.
- Les murs sont dans la grille de déplacement des PNJ. Dans l'original, la grille était construite avant les murs : les chemins des PNJ les traversaient.
- Une porte à bouton ou à carte fermée est un obstacle pour les PNJ dès le début (dans l'original, seulement après son premier cycle d'ouverture).
- Une balle dont le canon est de l'autre côté d'un mur s'écrase sur ce mur au lieu d'apparaître derrière.
- Le battant d'une porte se rétracte comme sur les images du sprite ; sa zone de collision suit, image par image.

**Pourquoi.** Comportement voulu par l'original, et collisions simples à faire tourner plus tard sur un serveur (ADR-005).

**Conséquences.** Un meuble rond ou en L est approché par un rectangle : léger écart possible avec l'original aux angles.

---

## GD-020 — Prises de courant : emplacement et fonctionnement à l'étape 1

- **Date** : 2026-11-16
- **Statut** : Acceptée — emplacements à revoir avec l'utilisateur
- **Décidée par** : choix par défaut (application de GD-005 et GD-006)

**Contexte.** Le monde 2 ne contient aucun bonus énergie, et ses bonus munitions n'ont plus d'usage depuis que les munitions sont illimitées.

**Décision.** Chaque `obj_bonus_ammo` du niveau d'origine devient une borne de recharge (10 au rez-de-chaussée). À moins de 110 px, maintenir E : le héros s'immobilise, ne tire pas et gagne 1 énergie par seconde jusqu'à 12 ; au-delà de 3, l'énergie redescend ensuite de 1 toutes les 2 s, comme la surcharge d'origine. La borne est dessinée par le code (plaque au sol avec un éclair), faute de sprite d'origine.

**Pourquoi.** Aucun emplacement à inventer : ceux des bonus munitions étaient déjà répartis dans le niveau par les auteurs. Le réglage est dans `src/sim/config.ts` (`outlet`).

**Conséquences.** Sans tir secondaire, l'énergie ne sert pas encore à l'étape 1 : la mécanique est visible mais sans effet en combat. Un vrai sprite de borne ou de prise murale reste à produire. Les boîtes bonus aléatoires (`obj_bonus_box`) ne sont pas encore affichées (étape 3).

---

## GD-021 — Chargeur de PetBot et éléments d'interface ajoutés

- **Date** : 2026-11-16
- **Statut** : Acceptée — valeurs à ajuster après essai
- **Décidée par** : choix par défaut (application de GD-005)

**Contexte.** Le rechargement n'existe pas dans le code d'origine : taille de chargeur et durée sont à inventer. L'original n'affiche ni les points de vie en chiffres ni les charges de dash.

**Décision.** PetBot : chargeur de 24 balles (un quart de l'ancien stock de 99), rechargement de 1,2 s avec R, possible en se déplaçant, impossible de tirer pendant ce temps. Le rechargement n'est jamais automatique : chargeur vide, le compteur clignote en rouge et « Press R to reload » s'affiche. L'interface ajoute, à côté du portrait d'origine : les points de vie en chiffres, deux pastilles pour les charges de dash, et une aide contextuelle (« Press E », « Hold E to recharge »).

**Pourquoi.** L'utilisateur a choisi un rechargement manuel (GD-005). Les ajouts d'interface rendent lisibles des informations que l'original ne montrait que par le portrait qui rougit.

**Conséquences.** Les trois autres héros recevront leur chargeur à l'étape 2.
