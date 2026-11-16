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

---

## GD-022 — Projectiles plus visibles ; bornes utilisables de plus loin, avec un arc électrique

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (retours d'essai de l'étape 1)

**Contexte.** Après avoir joué l'étape 1, l'utilisateur relève que les balles sont trop petites et de la couleur du sol : on ne les voit pas. Il trouve aussi qu'il faut être trop près d'une borne pour s'y brancher (110 px) et attendait « un beau lien, une sorte d'énergie » entre le robot et la borne.

**Décision.**

- Chaque projectile reçoit une traînée lumineuse : jaune pour le héros, orange pour les ennemis. Les sprites d'origine sont conservés et agrandis (×1,2 pour le héros, ×2 pour les ennemis). L'original dessinait un flou de mouvement de la longueur de la vitesse ; la traînée en tient lieu.
- La portée des bornes passe de 110 à 280 px. Un cercle indique la zone quand le héros s'approche (bleu pâle, puis jaune quand il est à portée). Pendant la recharge, un arc électrique animé relie la borne au robot. La recharge ne passe pas à travers un mur.

**Pourquoi.** Lisibilité : on doit voir d'où viennent les tirs pour les esquiver. Deux couleurs distinguent ses propres balles de celles des ennemis.

**Conséquences.** Réglages : `BULLET_STYLE` dans `src/client/view/WorldView.ts` (aspect), `outlet.range` dans `src/sim/config.ts`. Les dégâts et la taille de collision des balles ne changent pas.

---

## GD-023 — Les quatre héros et leurs tirs secondaires : écarts avec le code d'origine

- **Date** : 2026-11-16
- **Statut** : Acceptée — à ajuster après essai
- **Décidée par** : choix par défaut (application de GD-003, GD-004, GD-005, GD-014)

**Contexte.** L'étape 2 porte les tirs des quatre héros d'après le code de 2019 (voir `docs/reference/jeu-original/01-heros-et-joueur.md`, §2 et §6.3). Quelques points demandaient un arbitrage.

**Décision.** Les valeurs et les règles sont celles du code, sauf :

- **Chargeurs** (inventés, GD-005) : EngiBot 25 balles, rechargement 1,4 s ; BadaBot 25 boules, 1,5 s ; BatBot n'a pas de munitions. Point de départ : un quart de l'ancien stock.
- **Tourelle d'EngiBot** : elle ne vise que les soldats. Dans le code, elle visait le PNJ le plus proche, civils compris.
- **Batte perçante de BatBot (niveau 4)** : elle blesse chaque ennemi traversé une fois, puis explose une seule fois à l'arrêt. Dans le code, elle créait une explosion à chaque step de contact.
- **Rappel des battes** : un appui long ne rappelle que s'il y a une batte au sol, et ne coûte de l'énergie que dans ce cas. Le rappel involontaire après un lancer impossible est supprimé.
- **Batte au sol** : elle s'arrête au point d'impact, sans la glissade de l'original.
- **Plasma de BadaBot** : même explosion (rayon 50, dégât 20) sur un meuble que sur un mur ; le tir chargé ne dépense jamais plus de boules qu'il n'en reste.
- **Bouclier de BadaBot** : un arc lumineux montre la zone protégée (l'objet d'origine était invisible, la posture du sprite suffisait).
- **Choix du héros** : un écran à un seul joueur, avec les quatre héros et un résumé de leurs capacités, au lieu des quatre cadres de l'original prévus pour quatre joueurs. Ordre de l'original : BatBot, PetBot, BadaBot, EngiBot.

**Pourquoi.** Corriger les bogues relevés par l'analyse (GD-014) et éviter qu'une capacité tue des civils sans que le joueur l'ait voulu, ce qui fausserait le score.

**Conséquences.** Les stades 2 à 4 des tirs secondaires (6, 9 et 12 points d'énergie) s'obtiennent en se rechargeant sur une borne (GD-006). Réglages dans `src/sim/config.ts` (`heroes`, `abilities`). Les animations de déploiement des héros ne sont pas jouées, comme dans l'original.

---

## GD-024 — Carte verte et portes à carte avancées à l'étape 2

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (remarque pendant l'étape 2 : « pour déverrouiller la porte il ne faut pas une carte normalement ? »)

**Contexte.** Les cartes étaient prévues à l'étape 3. Sans elles, les portes verte et violette du rez-de-chaussée restent fermées et l'utilisateur ne peut pas explorer le niveau.

**Décision.** La carte verte (au rez-de-chaussée) et le fonctionnement des portes à carte sont livrés dès l'étape 2, comme dans le code : la carte se ramasse au contact et ne peut pas être posée ; à moins de 100 px d'une porte à carte fermée, le jeu affiche « Green card needed » / « Purple card needed », ou « Press Use (E) » si le héros porte la bonne carte ; la porte ouverte le reste. L'icône de la carte s'affiche à côté du portrait.

**Pourquoi.** Débloquer l'exploration du rez-de-chaussée sans attendre l'étage.

**Conséquences.** Les deux portes violettes du rez-de-chaussée restent fermées jusqu'à l'étape 3 : la carte violette se trouve à l'étage.

---

## GD-025 — BatBot : un clic droit sans batte en main rappelle les battes

- **Date** : 2026-11-16
- **Statut** : Acceptée (corrige un point de GD-023)
- **Décidée par** : l'utilisateur (souvenir du jeu d'origine : « quand on jetait ses battes, elles pouvaient revenir quand on cliquait sur clic droit »)

**Contexte.** Dans le code d'origine, un appui court qui ne peut pas lancer de batte laisse courir le délai de l'appui long, et les battes reviennent quand même. L'analyse y voyait un bogue, et GD-023 l'avait supprimé : il fallait maintenir le clic droit pour rappeler. L'utilisateur se souvient de ce retour au simple clic comme du comportement normal.

**Décision.** Sans batte en main, un simple clic droit rappelle les battes au sol (1 énergie, seulement s'il y en a une à rappeler). Avec une batte en main, le clic court lance et l'appui long rappelle, comme avant.

**Pourquoi.** C'est le comportement que le joueur connaissait, et il évite de rester sans arme en cherchant le bon geste.

**Conséquences.** Le clic court sans batte ne coûte rien s'il n'y a aucune batte au sol ou pas d'énergie. Marcher sur une batte la reprend toujours gratuitement.

---

## GD-026 — Passage entre les salles, consignes et fin provisoire du niveau

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : choix par défaut (application de GD-007, GD-009, GD-010)

**Contexte.** L'étape 3 relie le rez-de-chaussée et l'étage et fait avancer les consignes, que le code d'origine déclare sans jamais les enchaîner.

**Décision.**

- **Escalier** : le passage est immédiat dès que le héros marche dessus, avec un fondu. C'est la règle d'origine quand tous les héros sont sur la zone ; seul, le joueur est « tous les héros ». On arrive à l'étage sur le premier jeu de points d'apparition, et au retour sur le second, à côté de l'escalier.
- **Persistance** : une salle quittée garde son état (ennemis morts, portes ouvertes, vitres brisées, carte ramassée), comme avec `obj_roomsMemory`. Le héros garde ses points de vie, son énergie, son chargeur et ses cartes.
- **Ce qui ne suit pas le héros** : la tourelle d'EngiBot reste dans sa salle (non persistante dans l'original). Les battes de BatBot laissées dans une salle lui sont rendues en changeant de salle, pour qu'il ne se retrouve pas désarmé sans pouvoir les rappeler.
- **Consignes** : « Go to the upper floor » est validée en arrivant à l'étage ; « Find the purple key » en ramassant la carte violette ; « Go back to ground floor » en revenant au rez-de-chaussée avec la carte ; « Exit to the drilling area » en restant 10 secondes dans la zone de sortie d'origine (`obj_endLevel`, la bande nord de la carte), avec le compte à rebours « Leaving area ». La zone de sortie est inactive avant cette consigne.
- **Fin provisoire** : tant que la zone de forage n'existe pas (étape 4), la sortie affiche un panneau « TO BE CONTINUED » avec les statistiques de l'écran de score d'origine.
- **Retry après une défaite** : la salle en cours repart de zéro avec un héros neuf ; l'autre salle, les cartes et la consigne en cours sont conservées.
- **Musique** : elle continue d'une salle à l'autre.

**Pourquoi.** Suivre le scénario que décrivent les textes de consigne et les réglages des passages posés dans les salles, sans inventer d'étape.

**Conséquences.** À l'étape 4, la zone de sortie mènera à la zone de forage au lieu du panneau provisoire. Le sort des boîtes bonus aléatoires est tranché par GD-027.

---

## GD-027 — Les boîtes bonus à ramasser sont retirées du jeu

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** Le monde 2 d'origine contient 17 boîtes bonus (`obj_bonus_box` : 13 au rez-de-chaussée, 4 à l'étage) qui donnent au hasard invincibilité, vitesse ou énergie, stockées dans deux emplacements et activées avec les touches 1 et 2. Les bonus munitions sont déjà devenus des bornes de recharge (GD-020). L'utilisateur avait dit préférer les bornes, « plus réalistes que des bonus à ramasser » ; la question restait ouverte pour les boîtes.

**Décision.** Les boîtes bonus ne sont pas portées dans le remake : ni les boîtes, ni les deux emplacements de stockage, ni les effets d'invincibilité et de vitesse.

**Pourquoi.** Cohérence avec le choix des bornes : un robot se recharge sur une prise, il ne ramasse pas de bonus. L'énergie et les tirs secondaires portent déjà la montée en puissance.

**Conséquences.** Les instances `obj_bonus_box` restent dans les fichiers de niveau convertis mais sont ignorées par le jeu. Les touches 1 et 2 n'ont pas d'usage. Si la difficulté en solo s'avère trop élevée, on la règle par les valeurs de combat (GD-018), pas par des bonus.

---

## GD-028 — Zone de forage, foreuses, boss SallyBot, brouillard, lumières et score

- **Date** : 2026-11-16
- **Statut** : Acceptée — équilibrage à ajuster après essai
- **Décidée par** : choix par défaut (application de GD-009, GD-010, GD-011, GD-013, GD-014)

**Contexte.** Dans le code d'origine, la salle du boss n'est reliée à rien, les foreuses sont indestructibles, le boss n'a pas de mort ni de fin de niveau, et l'écran de score affiche une note codée en dur. L'étape 4 termine ce que les textes de consigne annonçaient.

**Décision.**

- **Liaison** : la sortie du rez-de-chaussée (10 s dans la bande nord) mène à la zone de forage. On y arrive avec son héros tel qu'il est.
- **Foreuses** (inventé) : 20 points de vie chacune. Balles, explosions, coups de batte et battes lancées les entament ; une barre de vie apparaît dès qu'elles sont touchées. Détruite, la foreuse perd son faisceau et reste en épave. Leur collision est un disque, car elles sont rondes. Les trois détruites, la consigne passe à « Kill SallyBot ».
- **Boss** : règles du code (poursuite, combo de 4 coups à 2/2/3/4 dégâts, charge à 4 dégâts, transformation à mi-vie, phase 2 invulnérable sauf pendant la « respiration » après 3 s cumulées d'attaque). Écarts :
  - 60 points de vie au lieu de 100, et vitesse de marche 7 au lieu de 10 : l'original est prévu pour quatre héros entre lesquels le boss change de cible ; seul, le joueur l'a en permanence sur lui. Lors des essais à 10 de vitesse, le héros immobile mourait en une dizaine de secondes.
  - Il se tourne vers le héros à 4° par step au lieu d'instantanément, pour qu'un dash permette d'esquiver un coup.
  - Un coup touche pendant la partie centrale de son animation (35 % à 85 %), dans la boîte du masque d'origine ; les masques image par image ne sont pas portés.
  - L'invulnérabilité vaut pour toutes les armes ; dans le code, les battes de BatBot et les drones l'ignoraient.
  - Mort : il n'a pas d'animation de mort dans l'original ; il explose avec le sprite `spr_explosion_robot` et laisse des débris de robot.
- **Fin du niveau** : foreuses détruites et boss mort, dans n'importe quel ordre, puis écran de score 2,5 s plus tard. Le score reprend les statistiques de l'original ; la « Global note : 42 » codée en dur est retirée.
- **Brouillard de guerre** : rectangles gris de l'original, levés quand le héros se tient devant une porte ouverte à fond qui les touche, avec le chaînage d'origine entre pièces. Ajout : un brouillard qui contient le héros se lève toujours, pour ne jamais jouer à l'aveugle.
- **Lumières** (GD-011) : un voile sombre sur la vue, percé d'un halo par lampe du niveau, sans ombres portées. Assombrissement de 50 % au lieu de 60 %, et le héros porte une lueur propre, pour garder les combats lisibles. Seul le rez-de-chaussée a des lampes, comme dans l'original.

**Pourquoi.** Achever le niveau tel que les consignes le décrivent, en restant jouable par une seule personne.

**Conséquences.** Réglages dans `src/sim/config.ts` (`boss`, `drill`, `npcs.obj_sallyBot`) et `LIGHTING` dans `src/client/view/WorldView.ts`. L'équilibre du combat de boss n'a été vérifié que par des tests automatiques et un essai bref : c'est le premier point à faire juger par l'utilisateur.
