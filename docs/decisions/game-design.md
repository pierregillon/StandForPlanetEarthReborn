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
- **Statut** : Acceptée pour le brouillard ; pour les lumières, remplacée par GD-038 (ombres portées et couleurs)
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

---

## GD-029 — Retours d'essai du niveau complet : bornes, soins, tanks, caméra, lisibilité

- **Date** : 2026-11-16
- **Statut** : Acceptée — valeurs à ajuster après essai
- **Décidée par** : l'utilisateur (retours d'essai et réponses aux propositions), sauf mention « par défaut »

**Contexte.** Après avoir joué le niveau, l'utilisateur relève : trop de bornes ; jeu dur faute de soin ; robots à bouclier imbattables de face en solo ; le robot se décentre quand on avance ; recharge d'énergie trop lente et qui immobilise ; surplus d'énergie qui retombe trop vite ; Retry qui garde les cartes ; cartes peu reconnaissables ; rechargement de l'arme, niveau de munitions et pleine énergie peu visibles ; orbe de BadaBot décalée et traits roses inutiles.

**Décision.**

- **Bornes** (modifie GD-006, GD-020, GD-022) :
  - 4 au rez-de-chaussée et 2 à l'étage au lieu de 10 et 4. Le jeu garde la borne la plus proche du départ, puis à chaque fois la plus éloignée de celles déjà gardées.
  - Un appui sur E relie le robot à la borne ; il reste libre de bouger et de tirer dans son rayon (280 px), comme le link entre joueurs de l'original. Le lien casse si on sort du rayon, si un mur s'interpose, sur un nouvel appui, ou quand la borne n'a plus rien à donner.
  - Recharge complète (0 à 12) en 3 secondes.
  - La borne répare aussi : 5 points de vie, en 3 secondes. Valeur proposée par l'utilisateur (« peut-être 5 PV max ? à challenger ») et gardée : 6 bornes × 5 = 30 points de vie sur le niveau, soit deux barres et demie.
  - Réserve limitée : 12 d'énergie et 5 points de vie par borne. Vidée, elle s'éteint pour le reste de la partie. Deux arcs autour de la borne montrent ce qu'il lui reste (bleu : énergie, vert : réparation).
  - Pendant la recharge, la lumière baisse et tremble autour du robot (idée de l'utilisateur).
- **Surplus d'énergie** (au-dessus de 3) : stable 15 secondes après le débranchement, puis −1 toutes les 5 secondes. Original : −1 toutes les 2 secondes, sans délai.
- **Robots à bouclier** (modifie GD-008) : le bouclier encaisse 6 coups de face puis se brise, et le robot devient vulnérable de partout ; un arc de 6 segments devant lui montre ce qu'il lui reste. Il pivote aussi lentement (1,5° par step au lieu de 5), y compris en attaque : un dash permet de passer dans son dos.
- **Caméra** : la vue se décale d'un tiers vers le curseur (380 px au plus) et suit le robot plus vite (lissage 7 au lieu de 20). Elle suit le robot, plus le bout de son canon.
- **Retry** (remplace la règle de GD-007 et GD-026) : toute la partie recommence au début du niveau, sans carte, avec le même héros. L'utilisateur avait d'abord choisi de recommencer la salle en cours ; à l'usage, garder les cartes lui a paru anormal.
- **Cartes** : sprite redessiné par le code (une carte d'accès avec puce et piste), qui flotte, se balance et pulse dans un halo de sa couleur. Remplace `spr_doorKey_green` / `spr_doorKey_purple`, de simples carrés de couleur.
- **Sur le robot** : anneau de progression pendant le rechargement de l'arme ; jauge de munitions à 3 segments le long de l'arme (vert, jaune, rouge, clignotante à vide) ; étincelles autour du corps dès que l'énergie dépasse 3, de plus en plus nombreuses, avec un halo à 12.
- **BadaBot** : l'arc rose du bouclier est retiré (il ne reste que le viseur). L'orbe est calée sur l'origine du sprite du corps, qui change selon la posture ; elle ne se décale plus en marchant ni bouclier levé.
- **Interface** : nom du robot sous son portrait, vie et énergie en chiffres à côté. Curseur de la souris remplacé par un réticule en jeu (par défaut).

**Pourquoi.** Rendre le niveau jouable par une seule personne et lisible sans quitter le robot des yeux, en gardant l'idée du robot qui se branche.

**Conséquences.** Réglages dans `src/sim/config.ts` (`outlet`, `hero.overcharge*`, `npc.shield*`, `camera`). L'alignement des sprites des trois autres héros (jambes et corps) n'a pas été revu : à signaler s'il gêne.

---

## GD-030 — BatBot : R rappelle les battes, qui frappent aussi au retour

- **Date** : 2026-11-16
- **Statut** : Acceptée (complète GD-023 et GD-025)
- **Décidée par** : l'utilisateur

**Contexte.** BatBot n'a pas de munitions : la touche R, qui recharge les autres robots, ne lui servait à rien. L'utilisateur rappelle que dans le jeu d'origine BatBot attire ses battes à lui, avec une petite animation sur sa ou ses mains libres, qu'il peut en lancer une ou deux puis les rappeler, et qu'une batte qui revient fait autant de dégâts sur sa route qu'à l'aller. Relecture du code de 2019 (`scr_BatBot_recallBatte`, `scr_createReturningBatteParticules`, `obj_bullet_batte_parent/Step_0.gml`) : le rappel concerne toutes les battes qui ne reviennent pas déjà, y compris en vol ; une particule magenta apparaît à chaque step sur la main qui attend la batte ; la batte revient vers cette main, et seulement si aucun mur ne la sépare du robot.

**Décision.**

- R rappelle les battes de BatBot. Le clic droit maintenu et le clic droit sans batte en main (GD-025) restent valables.
- Le rappel vaut pour toutes les battes lancées, au sol ou encore en vol. Il coûte 1 énergie, seulement s'il y a une batte à rappeler.
- La batte revient vers la main correspondante. Si un mur la sépare du robot, elle attend que la voie soit libre.
- Au retour, elle frappe chaque ennemi croisé comme à l'aller : 3 dégâts si elle est simple ; si elle est explosive, son explosion, une seule fois sur le trajet de retour.
- Une lueur magenta pulse sur chaque main libre tant que sa batte revient, avec un fil ténu jusqu'à la batte.
- Sans batte en main, l'écran rappelle « Press R to call your bats back ».

**Pourquoi.** Comportement du jeu d'origine, que l'utilisateur connaît ; et R devient utile pour les quatre robots.

**Conséquences.** GD-023 disait qu'une batte rappelée ignorait les murs : c'était une lecture erronée de l'analyse, corrigée ici d'après le code. Dans le code d'origine, la touche du rappel est l'appui long sur le tir secondaire ; R est un ajout demandé par l'utilisateur.

---

## GD-031 — Deuxième série de retours : point de sauvegarde, mobilité, décor vivant, lisibilité

- **Date** : 2026-11-16
- **Statut** : Acceptée — valeurs à ajuster après essai
- **Décidée par** : l'utilisateur (retours d'essai) ; les valeurs chiffrées sont des choix par défaut

**Contexte.** L'utilisateur a joué jusqu'au boss. Il trouve le parcours haletant mais ne veut pas refaire tout le niveau à chaque défaite contre le boss ; il insiste sur la mobilité (« on a peu de points de vie, il faut être très mobile ») et demande plusieurs ajustements de lisibilité et de réalisme.

**Décision.**

- **Point de sauvegarde devant le boss** (« un bonfire à la Dark Souls, mais dans l'univers du jeu ») : une balise à l'entrée de la zone de forage. S'en approcher (170 px) s'y connecte : vie au maximum, énergie à 12, chargeur plein, une fois par vie. Après une défaite, Retry ramène à la balise, en pleine forme ; la zone de forage est remise à neuf (boss et foreuses), le reste est gardé (cartes, autres salles). Sans balise activée, Retry recommence le niveau (GD-029). La balise est dessinée par le code : ambre tant qu'elle attend, bleue une fois activée.
- **Boss moins pressant à l'arrivée** : il n'attaque plus dès l'entrée dans la salle (portée d'alerte 650 px au lieu de 1600). Il se réveille aussi si on le touche ou si on entame une foreuse.
- **Mobilité** :
  - vitesse de base +15 % pour les quatre robots (11,5 au lieu de 10 ; EngiBot 15 au lieu de 13) ;
  - +4 % de vitesse par point d'énergie au-dessus de 3, soit +36 % à 12 ;
  - aucun tir n'immobilise plus : BatBot peut bouger en lançant une batte ; le bouclier de BadaBot ralentit de 25 % au lieu de 50 % ;
  - le dash rend intouchable pendant toute sa durée (l'original ne protégeait pas), avec des images rémanentes et une flammèche de propulseur.
- **Ennemis** : les soldats pivotent deux fois plus vite (10° par step au lieu de 5) ; un « ! » jaune apparaît au-dessus d'un ennemi qui vient de repérer le héros, pendant son temps de surprise.
- **Vitres** : on voit et on tire à travers, dans les deux sens ; elles bloquent toujours le passage. Dans l'original, elles arrêtaient le regard des ennemis. Brisée, la vitre projette ses éclats dans le sens du tir, où ils restent au sol.
- **Chaises à roulettes** (`obj_siege_accueil`, 31 au rez-de-chaussée) : le héros les pousse en les touchant ; elles roulent, ralentissent et s'arrêtent contre les murs. Seul meuble mobile pour l'instant.
- **Boutons de porte** : pressé, le bouton s'enfonce dans le mur et y reste, avec un son.
- **Déploiement** : au début d'une partie, le robot se déplie avec l'animation et le son d'origine (au plus 2,2 s), immobile et intouchable. L'original contenait ces animations mais ne les jouait pas.
- **Lisibilité** :
  - surcharge d'énergie : une enveloppe lumineuse à la forme du robot, en 3 niveaux, remplace le cercle jugé trop fort ;
  - borne vidée : elle garde son aspect, seul son voyant passe du vert au rouge (plus de transparence, jugée irréaliste) ; voyant agrandi ;
  - explosion des battes : éclair, onde de choc, braises, fumée et trace au sol, sur une demi-seconde à une seconde (le sprite d'origine ne durait que 3 images) ;
  - robot ennemi détruit : explosion, 14 à 22 débris agrandis, 4 à 6 flaques d'huile, trace au sol.
- **Sons de synthèse**, faute de fichiers d'origine : bouton de porte, recharge sur une borne (bourdonnement dont la hauteur monte avec l'énergie), point de sauvegarde.

**Pourquoi.** La difficulté doit venir des combats, pas de la répétition ni d'un manque de lisibilité. La mobilité compense le peu de points de vie.

**Conséquences.** Réglages dans `src/sim/config.ts` (`heroes.*.walkSpeed`, `hero.overchargeSpeedBonus`, `hero.checkpointRadius`, `boss.aggroRange`, `npc.rotateSpeedDeg`, `chair`). Le robot plus rapide et intouchable en dash rend le niveau plus facile : l'équilibre des ennemis est à rejuger. Les chaises de cafétéria (`obj_chaise_bleu`, `obj_chaise_marron`) restent fixes.

---

## GD-032 — Rechargement propre à chaque robot, jauge masquée à plein, choix du point de départ

- **Date** : 2026-11-16
- **Statut** : Acceptée — animations à remplacer par de vrais sprites si l'on en dessine
- **Décidée par** : l'utilisateur

**Contexte.** L'utilisateur n'aime pas l'anneau de progression du rechargement (GD-029) : il veut une animation propre à chaque robot, cohérente avec son arme, avec un bruitage ; par exemple sur l'orbe de BadaBot, qui n'a pas d'arme. Il veut aussi moins d'éléments à l'écran quand le chargeur est plein, et pouvoir aller directement au boss depuis le menu.

**Décision.**

- **Jauge de munitions** : masquée quand le chargeur est plein ; elle réapparaît au premier tir.
- **Rechargement**, à la place de l'anneau :
  - PetBot : la fiole usée est éjectée sur le côté et reste au sol ; une fiole neuve part du corps et s'engage dans l'arme.
  - EngiBot : le tambour usé tombe au sol ; un tambour neuf, qui tourne, vient se loger sur le canon, pendant que le canon tourne à vide (animation `spr_EngiBot_preShot` d'origine).
  - BadaBot : son orbe se disperse, puis se reforme en grossissant, en aspirant des filaments d'énergie.
  - BatBot : rien, il n'a pas de munitions (R rappelle ses battes, GD-030).
  - Un éclair marque la fin du rechargement. Chaque robot a son bruitage de début et de fin, en sons de synthèse.
- **Choix du point de départ** : après le choix du héros, un écran propose « Ground floor » (le niveau entier), « Upper floor » (à l'étage, avec la carte verte) et « Drilling area - Boss » (au point de sauvegarde, en pleine forme, avec les deux cartes). L'original proposait de la même façon de choisir sa salle après son héros.

**Pourquoi.** Lisibilité et cohérence avec chaque robot ; et pouvoir travailler le combat de boss sans refaire le niveau.

**Conséquences.** Les munitions animées (fiole, tambour) sont dessinées par le code, pas par un graphiste : ce ne sont pas des sprites dans le style d'origine. Si de vraies animations sont dessinées, elles remplaceront `drawReload` et `clipTexture` dans `src/client/view/WorldView.ts`. Le départ direct au boss saute l'animation de déploiement.

---

## GD-033 — Orbe de BadaBot calée sur sa tête ; ajustements du rechargement et des débris

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (retours d'essai)

**Contexte.** L'orbe de BadaBot restait décalée : la tête du robot oscille en marchant et avance bouclier levé, alors que l'orbe restait fixe ; l'animation de rechargement n'était pas centrée sur elle. La correction de GD-029 (caler l'orbe sur l'origine du sprite du corps) était fausse. L'utilisateur trouve aussi étrange la fiole neuve qui voyage vers l'arme de PetBot, à peine audible le bruitage de rechargement, et inutile le cercle sombre sous les robots détruits.

**Décision.**

- **Orbe** : le projet d'origine place l'orbe image par image, avec deux tables de coordonnées de la tête (`obj_plasmaBawl` : `plasmaYcoordinatesWalking` pour les 22 images de marche, `plasmaXcoordinatesFire2` pour les 4 images du bouclier). Ces tables sont reprises telles quelles ; l'orbe tourne et grossit autour de son propre centre. Le rechargement de BadaBot se dessine à la position réelle de l'orbe.
- **Rechargement de PetBot** : la fiole usée tombe toujours au sol ; à la place de la fiole neuve, son autre bras passe par-dessus le corps, saisit l'arme, l'actionne deux fois et revient.
- **Bruitages de rechargement** : volume multiplié par 2,6.
- **Robots détruits** : le cercle sombre sous les flaques d'huile est retiré ; débris et flaques inchangés.

**Pourquoi.** Fidélité à l'original pour l'orbe, dont les tables existaient déjà ; lisibilité pour le reste.

**Conséquences.** Leçon pour la suite : avant de corriger un alignement de sprite, chercher dans le code d'origine une table de coordonnées par image (il en existe aussi pour le viseur laser et le compteur de munitions : `scr_setCoordinatesOfLaser`, `scr_setCoordinatesOfAmmoIndicator`). Le bras de PetBot dessiné par le code a été abandonné aussitôt (GD-034).

---

## GD-034 — Rechargement de PetBot joué avec ses propres sprites

- **Date** : 2026-11-16
- **Statut** : Acceptée (remplace le rechargement de PetBot de GD-032 et GD-033)
- **Décidée par** : l'utilisateur (retour d'essai) ; solution proposée par défaut

**Contexte.** Le bras dessiné par le code pour le rechargement de PetBot (GD-033) « n'est pas raccord avec le design » : il ne ressemble pas au vrai bras du robot.

**Décision.** Le rechargement de PetBot utilise les 30 dernières images de son animation de déploiement d'origine (`spr_PetBot_deploy`, images 50 à 79), où l'arme se replie, son câble se rebranche et ses fioles réapparaissent. Elles sont jouées à l'envers pendant le premier quart du rechargement (l'arme se replie), puis à l'endroit (elle se réarme). La fiole usée tombe toujours au sol au début. Plus aucun élément dessiné par le code sur PetBot pendant le rechargement.

**Pourquoi.** Ce sont les sprites du jeu : même trait, mêmes proportions, même origine que le reste du robot.

**Conséquences.** Règle pour la suite : pour une animation manquante, chercher d'abord dans les sprites existants (les animations de déploiement des quatre robots sont longues et détaillées) avant de dessiner par le code. EngiBot et BadaBot gardent leurs animations de GD-032, que l'utilisateur n'a pas critiquées.

---

## GD-035 — Arrivée par le véhicule de largage au début du niveau

- **Date** : 2026-11-16
- **Statut** : Acceptée — durées à ajuster après essai
- **Décidée par** : l'utilisateur

**Contexte.** Le projet d'origine contient un véhicule volant à quatre pinces (`obj_spawnVehicle`, sprites `spr_spawnVehicle` et `spr_spawnVehicleShadow`) qui devait déposer les robots au début du niveau ; il y est codé mais désactivé (`usedAsHeroDrop = False`). L'utilisateur veut cette arrivée : l'appareil entre par la gauche, arrive au centre de l'écran, descend pour poser les robots, redécolle, sort par la droite, puis les robots se déploient.

**Décision.** Au début d'une partie au rez-de-chaussée :

1. le véhicule entre par la gauche en ralentissant (1,4 s), le robot replié dans sa pince ;
2. il descend (0,8 s) : il rétrécit de 1,3 à 1 et son ombre se resserre sous lui ;
3. il reste posé (0,45 s) et lâche le robot ;
4. il remonte (0,6 s) puis sort par la droite en accélérant (1,2 s) ;
5. le robot se déploie (GD-031), puis le joueur a la main.

Repris de l'original : les sprites, l'animation des rotors, la position de la pince du joueur 1, l'ombre qui s'écarte et s'agrandit avec l'altitude. Écarts : trajectoire droite de gauche à droite au lieu du chemin et des rotations d'origine ; échelle de vol 1,3 au lieu de 1,1 pour que la descente se lise ; grondement de rotors en son de synthèse. Le robot est immobile et intouchable pendant toute la séquence.

**Pourquoi.** Demande de l'utilisateur, et mise en service d'un élément que les auteurs avaient dessiné et codé sans l'activer.

**Conséquences.** Voir aussi GD-036 pour le comportement des soldats. La partie commence environ 4,5 secondes plus tard, plus le déploiement. La séquence ne joue pas en commençant à l'étage ou au boss (menu de départ), ni après un Retry au point de sauvegarde. Réglages : `arrival` dans `src/sim/config.ts`. Quand le multijoueur existera, les trois autres pinces porteront les autres robots (positions déjà dans le code d'origine).

---

## GD-036 — Les soldats vont voir d'où vient le bruit ; le « ! » ne traverse pas le brouillard

- **Date** : 2026-11-16
- **Statut** : Acceptée — durées à ajuster après essai
- **Décidée par** : l'utilisateur (retour d'essai)

**Contexte.** L'utilisateur aime le « ! » mais relève deux défauts. Il s'affiche au-dessus d'ennemis cachés par le brouillard d'une pièce fermée, ce qui trahit leur présence. Et des ennemis qui entendent des tirs depuis une pièce fermée affichent le « ! » sans en sortir : « ils ont entendu un bruit mais n'osent pas sortir, ce n'est pas réaliste ». Cause dans le code, héritée de l'original : un soldat qui entend sans voir perdait sa cible au step suivant, puis la réentendait, et recommençait indéfiniment son temps de surprise.

**Décision.**

- **Marqueur** : le « ! » n'est dessiné que si l'ennemi n'est pas sous un brouillard encore opaque.
- **Aller voir** : un soldat qui entend le héros (tirs, coups de batte, bouclier levé, à 1000 px au plus et sans mur épais entre eux) marque son temps de surprise, puis se rend à l'endroit du bruit, plus vite qu'en ronde (1,6 fois sa vitesse normale) et en ouvrant les portes automatiques sur son chemin. Il fait de même vers le dernier endroit où il a vu le héros quand il le perd de vue. Il s'en souvient 12 secondes.
- **En chemin**, s'il voit le héros, il passe à l'attaque sans nouveau temps de surprise.
- **Sur place**, s'il ne trouve personne, il regarde autour de lui 2 secondes puis reprend sa ronde ; une prochaine alerte le surprendra de nouveau.
- Un soldat enfermé derrière une porte à bouton ou à carte fermée ne peut pas sortir : il reste tourné vers le bruit.

**Pourquoi.** Un ennemi qui réagit au bruit rend le jeu plus vivant et plus lisible ; le joueur peut aussi s'en servir pour attirer les soldats hors d'une pièce.

**Conséquences.** Tirer attire désormais les soldats du voisinage : le niveau devient plus dangereux pour qui tire sans se couvrir. Les civils ne sont pas concernés (ils fuient, comme avant). Réglages : `npc.investigate*` dans `src/sim/config.ts`.

---

## GD-037 — Départ à l'étage : les portes déjà franchies sont ouvertes

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (retour d'essai)

**Contexte.** En commençant à l'étage par le menu de départ (GD-032), le héros avait bien la carte verte, mais en redescendant il se retrouvait enfermé dans la cage d'escalier du rez-de-chaussée : sa porte à bouton n'avait jamais été ouverte dans cette partie, et son bouton est de l'autre côté.

**Décision.** Une partie commencée à l'étage trouve ouvertes, au rez-de-chaussée, les portes que le héros aurait franchies pour monter : la porte à bouton de l'escalier (numéro 1, bouton enfoncé) et la porte verte. Les portes violettes restent fermées : la carte violette reste à trouver.

**Pourquoi.** Un départ en cours de niveau doit laisser le monde dans l'état où un joueur l'aurait mis en y arrivant.

**Conséquences.** Mécanisme général : `session.preOpened` liste, par salle, les portes à bouton et à carte à ouvrir d'office. Il servira à tout nouveau point de départ. Le départ au boss n'en a pas besoin : la zone de forage n'a ni porte ni retour.

## GD-038 — Lumières avec ombres portées et couleurs, comme dans l'original

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur pour l'objectif (retrouver les jeux de lumière de GameMaker, code simple, performances intactes, jouabilité d'abord) ; choix par défaut pour les arbitrages listés plus bas

**Contexte.** L'utilisateur demande de retrouver le travail de lumière du jeu d'origine : ombres portées, lumière qui passe quand une porte s'ouvre, couleurs, positions précises. GD-011 s'était limité à des halos ronds sans ombre.

**Ce que fait l'original** (`obj_lumiere`, `obj_ambientShadow`, `scr_calculShadowForStaticInstance`, shader `sha_light`) :

- `obj_ambientShadow` pose un noir à 60 % sur toute la vue.
- Chaque lampe a une position, un rayon, une teinte, une saturation et une intensité réglés dans la salle (11 lampes au rez-de-chaussée, dont 5 colorées ; aucune à l'étage ni dans la zone de forage).
- Chaque lampe dessine sa lumière dans une surface à elle : un dégradé linéaire du centre vers le bord (shader `sha_light`), d'où sont retirés des triangles d'ombre projetés depuis les murs (`obj_mur_parent`, `obj_shadowMaker`), calculés une fois, et depuis les portes (`obj_door_parent`), recalculés à chaque pas. La surface est ajoutée à l'image, teintée de la couleur de la lampe.
- Meubles et personnages ne font pas d'ombre.

**Décision.** Reproduire ces quatre points :

1. Les lampes gardent leurs position, rayon, teinte, saturation et intensité d'origine, lues dans la salle convertie.
2. Murs et portes arrêtent la lumière. La zone éclairée d'une lampe est le polygone de ce qu'elle « voit » ; une porte qui s'ouvre laisse passer un pinceau de lumière qui s'élargit avec elle. Les vitres laissent passer la lumière, meubles et personnages ne font pas d'ombre.
3. Dégradé linéaire du centre au bord, comme le shader d'origine.
4. Les lampes colorées ajoutent leur teinte au décor, dans la même zone éclairée : la couleur ne traverse pas les murs non plus.

**Arbitrages (choix par défaut).**

- **Noir ambiant à 50 %** au lieu de 60 % : on doit toujours distinguer les ennemis hors des lampes (jouabilité d'abord).
- **La lueur du héros est conservée** (elle n'existe pas dans l'original, voir GD-028), et elle reçoit elle aussi des ombres portées : elle n'éclaire plus l'autre côté des murs et dessine un pinceau de lumière quand le héros passe une porte.
- **La lumière blanche retire du noir au lieu de s'ajouter à l'image.** Une lampe ne brûle donc jamais les couleurs du décor, et le rendu reste lisible là où plusieurs lampes se recouvrent. La teinte des lampes colorées, elle, s'ajoute comme dans l'original, avec une force réglable (`colorStrength`).
- **La teinte colorée est dessinée sous le brouillard de guerre**, pour ne pas trahir la couleur d'une salle encore cachée.
- **La lumière entre de 26 px dans le mur qu'elle touche**, pour que la face du mur soit éclairée plutôt que coupée net.

**Pourquoi.** C'est le rendu demandé, pour un coût mesuré négligeable (voir ADR-013) : le calcul d'une zone éclairée prend environ 0,1 ms, et il n'est refait que pour les lampes dont une porte voisine bouge.

**Conséquences.** Réglages dans `LIGHTING` (`src/client/view/WorldView.ts`) : noir ambiant, force des lampes, rayon et force de la lueur du héros, force des couleurs. Le calcul géométrique est dans `src/sim/visibility.ts`, testé sans navigateur (4 tests, dont l'ouverture d'une vraie porte du niveau). Les salles sans lampe (étage, zone de forage) restent sans assombrissement, comme avant. Non vérifié à l'écran : le tremblement de la lumière pendant une recharge avec le nouveau rendu.

## GD-039 — Règles du jeu à plusieurs héros (jusqu'à 4)

- **Date** : 2026-11-16
- **Statut** : Acceptée — modifiée par GD-041 (balles de PetBot, collision entre héros, compte à rebours de 5 s)
- **Décidée par** : l'utilisateur pour le cadre (multijoueur jusqu'à 4, un robot ne peut être pris qu'une fois, résurrection d'origine, chacun sa caméra, link remis à plus tard) ; choix par défaut pour les points marqués « par défaut »

**Contexte.** L'utilisateur lance le multijoueur (GD-002 le remettait à plus tard). Le jeu d'origine est un coop local à 4 ; ses règles à plusieurs existent dans le code, mais la mort y est désactivée (`canDie = False`). La simulation ne connaissait qu'un héros.

**Décision.**

- **Équipe** : 1 à 4 héros, chaque robot au plus une fois. Chacun a son point d'apparition (`obj_spawn1` à `obj_spawn4` de l'original, déjà présents dans les salles converties).
- **Ennemis** : un soldat vise le héros en vue le plus proche ; un PNJ s'éveille à l'approche de n'importe quel héros ; le boss poursuit le héros debout le plus proche et ses coups touchent tous ceux pris dans la zone du coup.
- **Mort et résurrection** (décision de l'utilisateur, `scr_resurectAllie`) : un robot à 0 PV reste à terre. Un coéquipier le relève en maintenant E à moins de 100 px pendant 3 s, pour 3 énergies dépensées par tiers ; il ne bouge pas et ne tire pas pendant ce temps ; relâcher annule et l'énergie dépensée est perdue. Le robot relevé revient avec 3 PV et 0 énergie. La partie est perdue quand toute l'équipe est à terre.
  - *Par défaut* : 1,5 s d'invulnérabilité au réveil (sinon il retombe aussitôt sous le feu) ; un seul sauveteur par robot à terre.
- **Changement de salle** (`obj_changeRoom_parent`) : toute l'équipe sur le passage, on part aussitôt ; au moins la moitié, un compte à rebours de 10 s démarre ; moins, il s'annule. Seul, le passage reste donc immédiat. La sortie vers la zone de forage demande de même la moitié de l'équipe pendant 10 s.
  - *Par défaut* : un robot à terre est relevé à l'arrivée dans la nouvelle salle, avec 3 PV. Le code d'origine ne dit rien de ce cas.
- **Point de sauvegarde** (*par défaut*) : il remet en état toute l'équipe, robots à terre compris.
- **Cartes d'accès** (*par défaut*) : communes à l'équipe ; une carte ramassée par l'un sert à tous.
- **Balles de PetBot** (`obj_bullet_PetBot`) : elles rendent 1 PV au coéquipier blessé qu'elles touchent, et s'arrêtent sur un coéquipier dans tous les cas, comme dans l'original. Les explosions de ses drones soignent tous les héros à portée.
- **Bouclier de BadaBot** : il arrête aussi les balles destinées aux coéquipiers placés derrière lui.
- **Bornes de recharge** : plusieurs héros peuvent se relier à la même borne ; chacun puise dans sa réserve.
- **Pas de tir ami** en dehors des balles de PetBot, et les héros ne se bloquent pas entre eux.
- **Link entre héros** : pas encore ; l'utilisateur veut en discuter après ce premier multijoueur.

**Pourquoi.** Reprendre d'abord ce que le code d'origine prévoyait, et ne trancher que les cas qu'il laisse ouverts, du côté le plus indulgent : à plusieurs, attendre à terre sans rien faire est ce qu'il y a de moins amusant.

**Conséquences.** La simulation tient une liste `world.heroes` ; `world.step` reçoit une entrée par héros. Le solo est une équipe d'un seul et passe par le même code (ses 42 tests n'ont pas changé). Réglages : `revive` dans `src/sim/config.ts`. 8 nouveaux tests dans `src/sim/team.test.ts`. **À confirmer en jeu** : les balles de PetBot arrêtées par les coéquipiers (fidèle, mais peut gêner en mêlée) ; la difficulté n'est pas ajustée au nombre de joueurs.

## GD-040 — Premier multijoueur : créer ou rejoindre une partie, salon, choix des robots

- **Date** : 2026-11-16
- **Statut** : Acceptée — première version, à éprouver en jeu
- **Décidée par** : l'utilisateur pour le cadre ; choix par défaut pour les points marqués « par défaut »

**Contexte.** L'utilisateur veut pouvoir créer une partie et laisser d'autres joueurs la rejoindre depuis le menu d'accueil, choisir chacun son robot dans un salon, sans doublon, à 4 au plus. À terme, le serveur sera hébergé sur internet et fera tourner plusieurs parties ; pour cette première version, une seule partie à la fois, hébergée sur sa machine et ouverte aux autres par une adresse ngrok.

**Décision.**

- **Menu d'accueil** : « Play » (solo, inchangé), « Create game », « Join game ».
- **Salon** : les quatre robots sont affichés ; un clic prend un robot libre, un second clic le rend. Un robot pris par un joueur est grisé pour les autres, avec le nom de ce joueur. La liste des joueurs indique l'hôte. Chacun donne son nom une fois (le navigateur le retient).
- **Lancement** : seul l'hôte (celui qui a créé la partie) lance le jeu, quand tous ont choisi. Il peut lancer seul.
- **En jeu** : chacun a sa caméra, centrée sur son robot (décision de l'utilisateur) ; le nom du joueur est affiché au-dessus de chaque coéquipier ; l'état des coéquipiers (PV, énergie, « DOWN ») est en haut à droite. Les règles sont celles de GD-039.
- *Par défaut* :
  - **Pas d'arrivée en cours de partie** : une partie lancée ne peut plus être rejointe.
  - **Départ d'un joueur** (bouton, onglet fermé, connexion perdue) : son robot disparaît du jeu ; si c'était l'hôte, le joueur suivant le devient ; au dernier départ, la partie se ferme et une autre peut être créée. Recharger la page revient à partir.
  - **Pas de pause** : Échap ouvre un menu (reprendre, quitter), mais la partie continue.
  - **Défaite** : seul l'hôte relance (Retry), pour tout le monde, au point de sauvegarde ou au début du niveau comme en solo.
  - **Toujours depuis le début du niveau** : le choix du point de départ (GD-032) reste réservé au solo.
  - **Difficulté inchangée** quel que soit le nombre de joueurs.

**Pourquoi.** Le plus court chemin vers une partie jouable à plusieurs, sans fermer la porte à la suite : le salon est une classe à part côté serveur, dont il suffira de tenir plusieurs exemplaires pour faire tourner plusieurs parties.

**Conséquences.** Limites de cette première version, à connaître avant d'essayer :

- Le robot du joueur réagit tout de suite à ses commandes, mais **ses tirs partent quand le serveur les a joués** : avec ngrok, ils apparaissent avec le délai d'un aller-retour.
- ~~Affichage des coéquipiers simplifié~~ : levé par GD-041, tous les robots ont toutes leurs animations.
- **Arrivée par le véhicule** : chacun ne voit que son propre robot dans la pince ; les coéquipiers apparaissent une fois posés.
- **Résurrection, mort et balles soignantes n'ont pas été essayées à l'écran**, seulement par tests automatiques.
- Le link entre héros reste à concevoir avec l'utilisateur.

## GD-041 — Retours du premier essai à deux joueurs

- **Date** : 2026-11-16
- **Statut** : Acceptée — modifiée par GD-042 (plus de soin par les balles de PetBot, avatars des coéquipiers)
- **Décidée par** : l'utilisateur (retour d'essai à deux, BadaBot et PetBot) ; choix par défaut pour les points marqués « par défaut »

**Contexte.** Premier essai du multijoueur (GD-040) par l'utilisateur avec un second joueur. Sept retours.

**Décision.**

- **Vignettes des coéquipiers** : en bas à gauche, à droite de la sienne, la vignette de chaque autre joueur, en plus petit : même cadre (énergie), portrait qui rougit avec les dégâts, nom du joueur, PV et énergie en chiffres. Elle remplace la liste en haut à droite.
- **Collision légère entre robots** : deux robots qui se chevauchent s'écartent doucement (4 px par step au plus, en dessous de 90 % de la somme de leurs rayons). Rien ne bloque : on se croise dans un couloir.
  - *Par défaut* : un dash traverse un coéquipier ; un robot à terre ne repousse personne (il faut pouvoir s'en approcher pour le relever).
- **Les balles traversent les alliés.** Cela remplace la règle d'origine reprise dans GD-039, où les balles de PetBot s'arrêtaient sur un coéquipier.
  - *Par défaut, à confirmer* : la balle de PetBot rend toujours 1 PV au coéquipier blessé qu'elle traverse, une seule fois par balle et par coéquipier. PetBot reste le soigneur de l'équipe, mais soigne désormais sans perdre sa balle.
- **Toutes les animations de tous les robots chez tous les joueurs** : les coéquipiers sont dessinés par le même code que son propre robot (orbe de BadaBot au repos, en charge, au tir et au rechargement, enveloppe d'énergie, traînée de dash, viseur laser, chargeur éjecté de PetBot et d'EngiBot, effets de rechargement).
  - *Par défaut* : la jauge de munitions le long de l'arme n'est dessinée que sur son propre robot, et les bruitages de rechargement ne jouent que pour le sien.
- **La lumière perce le brouillard de guerre** : quand une lumière entre dans une pièce encore cachée (porte qui s'ouvre, vitre), le brouillard s'efface là où elle éclaire, en s'estompant avec la distance. On entrevoit la pièce sans la découvrir. Une lampe située dans la pièce cachée ne la révèle pas.
- **« Leaving area » : 5 s** au lieu de 10, pour les passages entre salles comme pour la sortie du niveau (solo compris, GD-010 disait 10 s).
- **La lueur de chaque joueur est visible** par tous, avec ses ombres portées, et perce elle aussi le brouillard.
- **Chargement synchronisé** : à chaque nouvelle salle (début de partie, étage, zone de forage, Retry), le jeu reste à l'arrêt pour tout le monde tant qu'un joueur charge. L'écran de chargement et l'écran d'attente indiquent qui charge encore, avec son avancement. Il n'y a plus de limite de temps ; un joueur qui quitte pendant son chargement ne bloque pas les autres.

**Pourquoi.** Le premier essai a montré ce qui manquait pour jouer vraiment à deux : se voir entièrement, ne pas se gêner, et commencer ensemble.

**Conséquences.** Réglages : `teamSpacing`, `teamPushSpeed` et `exitCountdownSteps` dans `src/sim/config.ts` ; `fogReveal` dans `LIGHTING`. Le brouillard est maintenant un calque de la taille de l'écran (comme la pénombre), ce qui permet à la lumière de le percer. Vérifié à deux onglets : vignettes, tir et viseur de PetBot vus par l'autre joueur, orbe de BadaBot en charge puis tirée, faisceau qui perce le brouillard par une porte en cours d'ouverture, 60 images par seconde. **Non vu à l'écran** : l'enveloppe d'énergie et le dash d'un coéquipier, le chargeur éjecté, l'écran d'attente avec un vrai chargement lent (testé par test automatique).

## GD-042 — Balles de PetBot sans soin ; HUD allégé, avatars côte à côte

- **Date** : 2026-11-16
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** GD-041 avait gardé, par défaut, le soin d'origine des balles de PetBot (1 PV au coéquipier traversé). L'utilisateur ne savait pas que ce tir soignait et le trouve trop facile. Il demande aussi d'alléger l'affichage.

**Décision.**

- **Les balles de PetBot ne soignent plus.** C'est un tir simple, qui blesse les ennemis et traverse les coéquipiers sans effet, comme celui des autres robots. PetBot soigne toujours par l'explosion de ses drones (tir secondaire), qui reste le seul soin entre joueurs avec la résurrection.
- **HUD allégé** : les chiffres de vie, d'énergie et de munitions et les indicateurs de dash sont retirés. Il reste le cadre (énergie), le portrait qui rougit (vie), le nom sous le portrait, et sur le robot la jauge de munitions à trois segments.
- **Avatars des coéquipiers** : exactement le même que le sien (même taille, même cadre, même portrait), collé à sa droite en bas à gauche, avec le nom du joueur dessous. Les cartes d'accès trouvées s'affichent à droite du dernier avatar.

**Pourquoi.** Un tir principal qui soigne sans rien coûter rendait l'équipe trop résistante. Pour l'affichage, chaque information retirée existait déjà sous une autre forme à l'écran.

**Conséquences.** Écart assumé avec l'original (`obj_bullet_PetBot` soignait les alliés). Le compteur de battes de BatBot (« BATS 1/2 ») et la mention « RELOADING » disparaissent avec les chiffres : les battes se voient sur le robot, le rechargement par son animation. Vérifié à l'écran à deux onglets.

## GD-043 — Le link entre héros, la surcharge et l'attaque ultime

- **Date** : 2026-11-16
- **Statut** : Acceptée — complétée et ajustée par GD-044 (les quatre ultis, débit du lien doublé, sprites refaits)
- **Décidée par** : l'utilisateur, après discussion ; choix par défaut pour les valeurs chiffrées et les points marqués « par défaut »

**Contexte.** Le link est la « main feature » du document de design : donner son énergie à un coéquipier. Le code de 2019 en avait une version minimale (touche maintenue, 1 énergie par seconde, sans perte) et le remake l'avait repoussé (GD-002). L'utilisateur le reconçoit avec une conséquence nouvelle : la surcharge ne renforce plus le tir secondaire, elle donne accès à une attaque ultime.

**Décision : le link.**

- **Un don et un flux.** Se lier à un coéquipier lui fait passer d'abord sa réserve d'énergie, puis sa régénération, amplifiée. Celui qui donne reste à 0 tant qu'il est lié : pas de tir secondaire, pas de résurrection.
- **Un lien qu'on pose** (comme pour les bornes) : touche A (celle marquée A sur un clavier AZERTY, Q sur un QWERTY), en visant le coéquipier. On reste libre de bouger et de tirer. La même touche le coupe, pour celui qui donne comme pour celui qui reçoit.
- **Il casse** au-delà de 1000 px, si un mur s'interpose, si le receveur tombe ou lance son ulti.
- **La distance compte** : plein débit jusqu'à 350 px, puis le débit baisse jusqu'à 60 % à 1000 px. Le faisceau le montre : dense et tendu de près, aminci, ondulant et troué de loin.
- **Débit selon l'équipe** : plus il y a de donneurs sur un même robot, plus il reçoit ; mais plus il y a de joueurs dans la partie, plus chaque lien est faible. Toute l'équipe liée de près apporte 1 point toutes les 1,5 s (contre 2 s pour la régénération naturelle d'un seul robot, plafonnée à 3). À deux joueurs, un lien débite donc autant que trois liens à quatre.
- **On donne ou on reçoit**, jamais les deux : pas de chaîne, pas de boucle.
- **Bornes** : leur réserve d'énergie est divisée par le nombre de joueurs (12 seul, 6 à deux, 4 à trois, 3 à quatre). Seul, une borne mène à l'ulti ; à plusieurs, il faut se lier.

**Décision : la surcharge et l'ulti.**

- **Plus de paliers.** Le tir secondaire reste celui du niveau 1 quelle que soit l'énergie, au même coût (drones de PetBot : 3 ; tourelle d'EngiBot : 3 ; batte lancée de BatBot : 1). En surcharge, le joueur choisit : dépenser son énergie en tirs secondaires, ou la garder pour l'ulti.
- **L'ulti** est disponible à pleine surcharge (12), touche F. Il dépense toute l'énergie et coupe tous les liens du lanceur, qui devront être reposés.
- **Lancement de 2 s** : le robot est immobile et vulnérable, avec une animation propre à chaque robot. S'il tombe avant la fin, l'ulti est perdu.
- **BatBot** (livré) : il bondit vers le point visé (760 px au plus, jusqu'au premier mur ; il passe par-dessus meubles et ennemis), intouchable en l'air, et son atterrissage frappe tout ce qui est en vue dans un rayon de 360 px (14 dégâts, boucliers ignorés, vitres brisées).
- **À faire** : PetBot (essaim de nanomachines qui soigne les alliés autour de lui), BadaBot (mur indestructible et infranchissable, temporaire), EngiBot (grenade électromagnétique qui désactive les robots ennemis, sans effet sur les humains ni sur l'équipe).
- **Boss** : les ultis lui font leurs dégâts ou l'étourdissent normalement ; il sera renforcé plutôt que protégé.
- **Résurrection** : toujours 3 énergies ; l'équipe attend que l'énergie remonte.

*Par défaut* : le bonus de vitesse de la surcharge (GD-031) est conservé ; le bond de BatBot ne traverse ni mur, ni porte, ni vitre (sinon il sauterait les portes à carte) ; il lui reste 0,4 s de récupération après l'atterrissage.

**Sprites.** Le jeu d'origine n'a aucune image pour les ultis. Elles sont fabriquées par `tools/make-sprites.ts` à partir des images existantes du robot, pour garder ses proportions, ses couleurs et son origine, avec des tracés d'énergie dans le style de l'original (aplats magenta à reflet rose, comme les arcs de ses coups de batte) :

| Sprite | Images | Construit à partir de |
|---|---|---|
| `spr_BatBot_ulti_cast` | 30, à 15 par seconde (2 s) | son déploiement joué à rebours jusqu'aux battes croisées, puis rouvert ; énergie qui converge |
| `spr_BatBot_ulti_leap` | 8, à 30 par seconde | la pose de son coup de batte, tournée sur un tour ; anneau d'énergie |
| `spr_BatBot_ulti_blast` | 14, à 30 par seconde | dessiné : anneau de choc morcelé, éclair, traînées, éclats |
| `spr_BatBot_ulti_crater` | 1 | dessiné : sol fissuré, laissé sur place |

**Pourquoi.** Lié, on produit plus d'énergie que séparé : le link a un intérêt immédiat, et un prix lisible pour celui qui donne. L'ulti donne un but commun à cette énergie, plus spectaculaire que des tirs secondaires renforcés.

**Conséquences.** Contenu retiré : les niveaux 2 à 4 des drones, de la tourelle et des battes (explosives, perçantes) ne sont plus accessibles. Réglages : `link` et `ulti` dans `src/sim/config.ts`. 8 tests dans `src/sim/link.test.ts`. Vérifié à l'écran à deux onglets : faisceau, lancement, bond, atterrissage. **À éprouver en jeu** : le rythme (à deux, un ulti toutes les 20 s environ si l'on reste liés de près), les dégâts de l'ulti, la lisibilité du ciblage quand deux coéquipiers sont dans le même axe.

## GD-044 — Les quatre ultis, postures de lancement, lien plus rapide, avatar « ulti prêt »

- **Date** : 2026-11-16
- **Statut** : Acceptée — à éprouver en jeu
- **Décidée par** : l'utilisateur (retour d'essai à trois joueurs) ; choix par défaut pour les valeurs chiffrées et les points marqués « par défaut »

**Contexte.** Premier essai du link et de l'ulti de BatBot (GD-043), à trois joueurs. Retours : l'animation de lancement gesticule trop (BatBot rangeait ses battes), la surcharge monte trop lentement, on ne voit pas assez qu'un ulti est prêt, et il faut les ultis des trois autres robots.

**Décision.**

- **Posture de lancement** : le robot prend une pose de concentration et la tient, presque immobile. BatBot garde ses battes en main, levées, prêt à frapper. L'énergie qui se concentre autour de lui est inchangée.
- **Atterrissage de BatBot** : l'explosion des battes d'avant (GD-031), que l'utilisateur aimait, plus un nuage de poussière qui le cache un instant et se dissipe vite. L'anneau de choc magenta est conservé : il montre le rayon réel du coup.
- **Lien deux fois plus rapide** : toute l'équipe liée de près apporte 1 point toutes les 0,75 s. Par lien : 0,75 s à deux joueurs, 1,5 s à trois, 2,25 s à quatre. De 3 à 12 d'énergie, tous liés de près : environ 7 s.
- **Avatar « ulti prêt »** : quand un robot atteint la pleine surcharge, son cadre d'énergie est parcouru d'arcs électriques bleus et son portrait brille, sur son avatar comme sur ceux de ses coéquipiers.
- **PetBot — essaim de nanomachines** : pendant 8 s, un essaim le suit et soigne tous les alliés à moins de 420 px (1,5 PV par seconde), lui compris. PetBot reste libre de bouger et de tirer.
  - *Par défaut* : l'essaim ne relève pas les robots à terre ; il se disperse si PetBot tombe.
- **BadaBot — mur d'énergie** : pendant 8 s, un mur de 540 px se dresse à 150 px devant lui, en travers de sa visée.
  - *Par défaut* : il arrête les déplacements et les balles, dans les deux sens et pour tout le monde (alliés compris), mais pas le regard : on voit à travers, et un lien entre héros passe. Ceux qui se trouvent à son emplacement sont repoussés. Les ennemis le contournent.
- **EngiBot — grenade électromagnétique** : elle vole vers le point visé (760 px au plus, arrêtée par un mur) puis éclate ; les robots ennemis à moins de 750 px sont désactivés 6 s. Aucun effet sur les humains ni sur l'équipe.
  - *Par défaut* : l'impulsion traverse les murs ; un robot désactivé ne bouge plus, ne tire plus, et son bouclier frontal ne le protège plus ; le boss, robot lui aussi, est désactivé comme les autres (l'utilisateur prévoit de le renforcer).

**Sprites** (question de l'utilisateur : faut-il mettre les effets dans le sprite du robot ?). Non, et c'est corrigé : le sprite d'un robot ne contient plus que le robot. Les effets sont des sprites à part, dessinés en blanc, que le jeu teinte à la couleur du robot (magenta pour BatBot, vert pour PetBot, violet pour BadaBot, bleu pour EngiBot) et superpose, un calque sous le robot et un par-dessus. Les mêmes effets servent ainsi aux quatre robots, on peut les régler sans refaire les poses, et ils suivent la durée réelle du lancement.

| Sprite | Images | Construit à partir de |
|---|---|---|
| `spr_<Robot>_ulti_cast` (×4) | 16, à 8 par seconde (2 s) | BatBot : l'armé de son coup de batte ; BadaBot : son lever de bouclier ; EngiBot : son lancer de tourelle ; PetBot : son arme qui se réarme |
| `spr_ulti_charge`, `spr_ulti_charge_top` | 30, à 15 par seconde | dessinés en blanc : croissants qui se resserrent, étincelles aspirées, éclat final |
| `spr_ulti_dust` | 14, à 20 par seconde | dessiné : volutes de poussière |
| `spr_BatBot_ulti_leap`, `_blast`, `_crater` | 8, 14 et 1 | inchangés (GD-043), sans teinte ajoutée au robot |
| `spr_PetBot_ulti_nanos` | 24, à 24 par seconde, en boucle | dessiné en blanc : 64 nanomachines en orbite |
| `spr_BadaBot_ulti_wall` | 12, à 12 par seconde, en boucle | dessiné aux couleurs de BadaBot : lame d'énergie entre deux plots |
| `spr_EngiBot_ulti_grenade`, `_pulse` | 8 et 16 | dessinés : cartouche qui tourne, anneaux d'éclairs |

**Pourquoi.** Une pose tenue se lit mieux qu'un geste, et laisse la vedette à l'énergie qui monte. Les trois nouveaux ultis donnent à chaque robot un rôle d'équipe : frapper, soigner, protéger, neutraliser.

**Conséquences.** Réglages : `ulti` et `link` dans `src/sim/config.ts` ; couleurs dans `ULTI_COLORS` (`WorldView.ts`). 4 Mo de sprites fabriqués. 3 tests de plus (68). Vu à l'écran en solo : l'avatar « ulti prêt », l'essaim de PetBot et son soin, le mur de BadaBot, la grenade d'EngiBot et les robots désactivés, le début de l'atterrissage de BatBot. **Pas vu en mouvement** (le navigateur de contrôle tournait au ralenti) : la dissipation du nuage de poussière et la fluidité des animations. **À éprouver** : la durée des effets, le soin de l'essaim (jusqu'à 12 PV en 8 s), le mur qui bloque aussi les alliés, la désactivation du boss.

## GD-045 — Les mini-bots de PetBot l'accompagnent en permanence

- **Date** : 2026-11-17
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur ; choix par défaut pour les points marqués « par défaut »

**Contexte.** PetBot est censé avoir des mini-bots, ses « pets ». Jusqu'ici ils n'apparaissaient qu'au moment du tir secondaire, comme des projectiles sortis de son corps.

**Décision.**

- Trois mini-bots flottent en permanence près de PetBot : un à l'épaule gauche, un à l'épaule droite, un derrière la tête.
- Ils le suivent avec un léger retard et regagnent leur place en une demi-seconde. Ils n'ont aucune collision.
- À l'arrêt, ils montent et descendent doucement, chacun à son rythme, avec une ombre au sol : ils ne paraissent jamais figés.
- Au tir secondaire, ce sont eux qui partent. Chacun décolle de sa place et converge vers la même destination qu'avant (dans l'axe de la visée de PetBot, à 550, 700 et 850 px). Vol, explosion, dégâts et soin sont inchangés.
- *Par défaut* :
  - pendant que la salve vole, PetBot n'a plus ses mini-bots ; de nouveaux se reforment à leur place dès que la salve a explosé, que l'énergie permette ou non de relancer ;
  - ils sont placés un peu à l'écart du corps (68 px de côté, 62 px derrière) plutôt qu'exactement au-dessus des épaules : vus de dessus, vert sur vert, on ne les distinguait pas du robot ;
  - collé à un mur, un mini-bot qui se trouverait de l'autre côté part de PetBot lui-même, pour ne pas traverser le mur ;
  - ils sont masqués pendant le déploiement et quand PetBot est à terre.

**Pourquoi.** Les mini-bots donnent son identité à PetBot et annoncent son tir secondaire : on voit d'où part la salve.

**Conséquences.** Leur place est la même pour la simulation (point de départ des drones, `petAnchors`) et pour l'affichage ; leur retard et leur flottement ne sont que de l'affichage, donc sans effet sur le jeu ni sur le réseau. Réglages : `petOffsets` dans `src/sim/config.ts`, `PETS` dans `WorldView.ts`. Sprite d'origine `spr_PetDrone` (celui des drones en vol). Vu à l'écran en solo : à l'arrêt, en déplacement, au départ de la salve et au retour.

## GD-046 — Mini-bots de PetBot : plus gros, sortis du coffre, ombre sur PetBot

- **Date** : 2026-11-17
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (retour sur GD-045) ; choix par défaut pour les points marqués « par défaut »

**Contexte.** Premier essai des mini-bots de PetBot (GD-045) : trop petits, ombre trop grosse et dessinée sous PetBot, apparition sur place sans mise en scène.

**Décision.**

- **Deux fois plus gros** (1,84 fois le sprite d'origine).
- **Ombre à leur taille** : c'est leur propre silhouette, en noir, légèrement décalée.
- **Ils volent au-dessus de PetBot** : leur ombre se dessine sur lui quand ils le survolent, et au sol sinon.
- **L'ombre les suit en salve** : partis au tir secondaire, ils la gardent jusqu'à l'explosion.
- **Sortie du coffre** : ils sortent un par un de la trappe du coffre dorsal de PetBot, entre la croix rouge et le crâne, passent au-dessus du crâne en grandissant et rejoignent leur place (0,5 s chacun, un départ toutes les 0,28 s). Cela vaut à la fin du déploiement comme après chaque salve.
- **Retard un peu plus long** : en pleine course ils traînent d'environ 85 px (70 avant), et se replacent toujours en une demi-seconde environ.
- *Par défaut* : en salve, les drones gardent cette taille doublée, pour qu'ils ne rétrécissent pas en partant. Seul l'affichage change : leur rayon de collision, leur explosion et leur soin sont inchangés.

**Pourquoi.** Des compagnons bien visibles, qui sortent d'un coffre et volent au-dessus du robot, se lisent comme des personnages et non comme des projectiles.

**Conséquences.** Tout est dans l'affichage (`PETS` et `syncPets` dans `WorldView.ts`) : rien ne change pour la simulation ni pour le réseau. Leur place autour de PetBot (`petOffsets`) n'a pas bougé : deux fois plus gros, ils débordent maintenant sur ses épaules, ce qui va avec « au-dessus de l'épaule ».

## GD-047 — Ulti de PetBot : ses mini-bots tournent autour de lui

- **Date** : 2026-11-17
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (les trois cercles, leurs sens) ; choix par défaut pour les points marqués « par défaut »

**Contexte.** L'ulti de PetBot (GD-044) était un essaim de nanomachines sans lien avec ses mini-bots (GD-045, GD-046). L'utilisateur veut que l'ulti s'appuie sur eux, pour garder la cohérence du personnage, et laisse juger du sort de l'animation de nanomachines.

**Décision.**

- Pendant l'ulti, les trois mini-bots quittent leur place et tournent autour de PetBot sur trois cercles concentriques : le proche dans le sens des aiguilles d'une montre, l'intermédiaire dans le sens inverse, le lointain dans le sens des aiguilles. **Le cercle lointain est le bord de la zone de soin.**
- Le soin lui-même ne change pas : même zone (420 px), même durée (8 s), même débit, et la zone suit toujours PetBot.
- *Par défaut* :
  - rayons à 34 %, 67 % et 100 % du rayon de soin (143, 281 et 420 px) ; un tour en 1,15 s, 1,7 s et 2,3 s ;
  - chaque mini-bot laisse une traînée lumineuse verte derrière lui, et son cercle entier est tracé en filigrane (plus marqué pour le bord de la zone) : avec un seul mini-bot par cercle, c'est ce qui rend les cercles lisibles ;
  - **l'animation de nanomachines est gardée, en retrait** : un nuage clairsemé qui remplit toute la zone, à 60 % d'opacité. Ses deux filets circulaires sont retirés du sprite, puisque ce sont maintenant les mini-bots qui dessinent les cercles. Elle montre ce que les mini-bots répandent ;
  - pendant les 2 s de lancement, les mini-bots se rassemblent en une ronde serrée autour de PetBot et prennent de la vitesse, puis partent en spirale vers leur cercle ; à la fin, ils resserrent leur ronde et regagnent leur place ;
  - **pas de tir secondaire tant que l'ulti dure** : les mini-bots sont en orbite, ils ne peuvent pas partir en salve. L'énergie n'est pas dépensée ; la salve repart dès que l'essaim s'est dispersé.

**Pourquoi.** Les mini-bots sont l'identité de PetBot : ce sont eux qui soignent, pas un effet anonyme. Trois cercles aux sens alternés se lisent d'un coup d'œil et montrent exactement où l'on est soigné.

**Conséquences.** La ronde n'est que de l'affichage (`PETS.orbit` et `syncPets` dans `WorldView.ts`) : la place des mini-bots se déduit de l'âge de l'essaim, donc tous les joueurs les voient au même endroit sans rien de plus sur le réseau. Seul changement de règle : le tir secondaire de PetBot est bloqué pendant son ulti (`petBotFire2`, test dans `link.test.ts`). Sprite `spr_PetBot_ulti_nanos` régénéré (`tools/make-sprites.ts`). Vu à l'écran en solo : la ronde du lancement, les trois cercles et les traînées, le retour ; mouvement régulier mesuré image par image. Pas essayé en réseau.

## GD-048 — Lancement d'un ulti : le robot est immobile, l'énergie s'anime autour de lui

- **Date** : 2026-11-17
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (robot immobile, énergie autour de lui) ; choix par défaut pour les points marqués « par défaut »

**Contexte.** Pendant les 2 s de lancement (GD-044), les postures fabriquées faisaient « respirer » le robot : son échelle oscillait de 1,5 % et il alternait entre plusieurs images de sa posture (PetBot en clignotait). L'utilisateur : un robot ne respire pas ; il le veut immobile, avec de l'énergie qui s'active autour de lui.

**Décision.**

- Le robot prend sa pose en quelques images, puis ne bouge plus du tout : plus d'oscillation d'échelle, plus d'alternance d'images.
  - BatBot lève ses battes et les tient ; BadaBot déploie ses ailes et les tient ; PetBot reste dans sa posture normale (ce sont ses mini-bots qui s'animent, GD-047).
  - *Par défaut* : EngiBot garde son geste de lancer sur la dernière demi-seconde, puisque c'est le départ de la grenade.
- L'énergie autour de lui porte toute l'animation : la lueur qui enfle sous lui, les croissants qui se resserrent en tournant, les étincelles aspirées (prévus par GD-044), et, *par défaut*, des arcs électriques qui courent autour de lui, de un à trois à mesure que l'énergie monte, à la couleur du robot.

**Défaut corrigé au passage.** Depuis que les effets d'ulti sont des sprites séparés des robots (GD-044), les trois sprites communs (`spr_ulti_charge`, `spr_ulti_charge_top`, `spr_ulti_dust`) n'étaient pas dans la liste des sprites chargés : l'énergie du lancement et le nuage de poussière de l'atterrissage de BatBot ne s'affichaient donc jamais. Ils sont maintenant chargés au démarrage. Le lancement et l'atterrissage de BatBot changent donc nettement d'aspect par rapport à ce que l'utilisateur a vu jusqu'ici : à rejuger.

**Pourquoi.** Un robot qui se concentre est une machine à l'arrêt ; c'est l'énergie qui doit montrer la montée en puissance.

**Conséquences.** Sprites `spr_<Robot>_ulti_cast` régénérés (`castPose` dans `tools/make-sprites.ts`). Arcs : `drawChargeArcs` dans `WorldView.ts`. Liste des sprites : `UI_SPRITES` dans `src/client/assets.ts`. Affichage seulement, rien ne change pour la simulation ni le réseau. Vu à l'écran en solo pour PetBot et BatBot (robot immobile, énergie, arcs, nuage de poussière) ; BadaBot et EngiBot jugés sur la planche-contact de leurs images.

## GD-049 — Lancement d'un ulti : l'énergie de surcharge prend la couleur du robot, halo discret

- **Date** : 2026-11-17
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (les trois temps, les couleurs, la taille du halo) ; choix par défaut pour les points marqués « par défaut »

**Contexte.** Le halo du lancement (GD-048, visible depuis la correction du chargement des sprites) était trop grand : il faisait « lumière » plutôt que charge d'énergie. Or un robot qui lance son ulti est en pleine surcharge : il a déjà autour de lui une enveloppe d'énergie bleu clair (GD-031), qui disparaissait dès le début du lancement puisque l'énergie est dépensée à ce moment-là.

**Décision.** Le lancement se lit en trois temps, un par tiers des 2 s :

1. L'enveloppe de surcharge reste autour du robot et passe du bleu clair à la couleur du robot : **violet (magenta) pour BatBot, vert pour PetBot, bleu pour BadaBot, orange pour EngiBot**.
2. Un léger halo de la même couleur apparaît sous le robot et souligne cette énergie.
3. Le halo s'étend un peu : au plus large, il fait le quart de sa taille d'avant (225 px de diamètre au lieu de 900).

*Par défaut* :

- l'enveloppe reste à son niveau le plus fort pendant tout le lancement, bien que l'énergie soit déjà dépensée, puis disparaît quand le coup part ;
- les croissants et les arcs électriques du lancement (GD-048) suivent le même passage du bleu clair à la couleur du robot ;
- BatBot garde le magenta de ses battes ; BadaBot passe du violet au bleu et EngiBot du bleu à l'orange, ce qui change aussi la couleur des anneaux et de l'éclat de départ de leur ulti ;
- l'impulsion de la grenade d'EngiBot et les arcs sur les robots désactivés restent bleu électrique : c'est une décharge électromagnétique, pas l'énergie du robot.

**Pourquoi.** L'ulti prolonge la surcharge : c'est la même énergie qui change de nature, pas une lumière qui s'allume.

**Conséquences.** Affichage seulement (`ULTI_COLORS`, `syncAura` et `syncUlti` dans `WorldView.ts`). Vu à l'écran en solo avec EngiBot : enveloppe bleue avant le lancement, passage à l'orange, halo resserré autour du robot.

## GD-050 — Ulti de PetBot : la ronde des mini-bots le suit avec un léger retard

- **Date** : 2026-11-17
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur ; choix par défaut pour les points marqués « par défaut »

**Contexte.** Pendant l'ulti (GD-047), les cercles des mini-bots restaient exactement centrés sur PetBot quand il se déplaçait : l'ensemble paraissait rigide, « statique ».

**Décision.** Le centre de la ronde rattrape PetBot avec le même retard que les mini-bots quand ils volent à ses côtés (GD-046) : en pleine course, la ronde traîne d'environ 85 px derrière lui et se recentre dès qu'il s'arrête.

*Par défaut* :

- tout l'affichage de l'essaim suit ce même centre : les trois cercles, les traînées, le nuage de nanomachines et le disque de la zone. Ils restent ainsi alignés entre eux ;
- **la zone de soin réelle ne change pas** : elle reste centrée sur PetBot, sans retard. L'écart avec ce qu'on voit ne dépasse pas 85 px sur un rayon de 420, et seulement pendant qu'il court.

**Pourquoi.** Des drones qui suivent leur robot avec un temps de retard paraissent vivants ; une figure collée à lui paraît plaquée sur l'écran.

**Conséquences.** Affichage seulement (`swarmX`, `swarmY` dans `syncPets`, repris par `syncEffects`, `WorldView.ts`) : rien ne change pour la simulation ni pour le réseau.

## GD-051 — Ulti de BadaBot : une vague d'énergie à la place du mur

- **Date** : 2026-11-17
- **Statut** : Acceptée ; remplace le mur d'énergie de GD-044
- **Décidée par** : l'utilisateur (le principe, la mise en scène, la largeur, la projection à deux écrans) ; choix par défaut pour les points marqués « par défaut »

**Contexte.** L'ulti de BadaBot était un mur d'énergie infranchissable (GD-044). L'utilisateur le remplace par une vague d'énergie qui repousse tout.

**Décision.**

- **Canalisation** (les 2 s de lancement) : BadaBot est immobile, ses deux boucliers au repos, dans sa position normale. Son énergie monte de son corps vers les deux boucliers, qui se mettent à luire et à crépiter.
- **Frappe** : soudain il frappe ses deux boucliers l'un contre l'autre, avec les images de son bouclier jouées d'un coup (un dixième de seconde), un éclat blanc au point de choc, une secousse de l'écran et un fracas de métal.
- **Vague** : de ce choc jaillit une vague d'énergie qui file droit devant lui. Elle fait la largeur des deux boucliers (200 px) et avance vite (2 400 px/s, deux fois la vitesse d'une balle).
- **Elle repousse tout sur son passage**, projeté à deux écrans de là (3 840 px) : les ennemis, les chaises, les débris (membres, éclats de verre) et les balles.
- *Par défaut* :
  - la vague elle-même parcourt un écran (1 920 px) et **s'arrête au premier mur** ou à une porte fermée ; elle passe au-dessus des meubles et fait éclater les vitres ;
  - ce qui est projeté **s'arrête contre le premier mur ou meuble** ; un mur entre l'axe de la vague et un ennemi le protège ;
  - **aucun dégât**, ni de la vague ni du choc contre un mur : l'ulti éloigne, il ne tue pas ;
  - un ennemi projeté tournoie et ne peut rien faire pendant son vol, puis **reste sonné 1,5 s** à l'arrivée ;
  - **les balles ennemies emportées changent de camp** : elles repartent dans le sens de la vague et blessent les ennemis. Les balles des héros ne sont pas déviées ;
  - **les héros et leurs objets ne sentent rien** : coéquipiers, tourelle d'EngiBot, battes de BatBot, mini-bots de PetBot. Les cartes d'accès au sol ne bougent pas non plus, pour ne pas envoyer un objet de quête au loin ;
  - **le boss est trop lourd** : il n'est pas déplacé, seulement sonné 1,5 s (et donc vulnérable pendant ce temps, comme sous la grenade d'EngiBot) ; ses foreuses ne bougent pas ;
  - le fracas de métal est un son de synthèse (des partiels sans rapport simple entre eux, un coup sourd, puis le souffle de la vague) : le jeu d'origine n'a pas de son de ce genre pour BadaBot.

**Pourquoi.** Une vague qui balaie un couloir donne à BadaBot, le tank, un outil de contrôle : il dégage le passage, renvoie les balles et met un groupe hors de combat le temps de se replacer.

**Conséquences.** Simulation : effet `wave` dans `src/sim/ulti.ts` (`sweepWave`, `stepThrown`), champs `thrown`, `thrownAngle` et `daze` des PNJ, `thrown` des chaises ; réglages dans `CONFIG.ulti.badaBot`. Le mur (obstacle, sprite `spr_BadaBot_ulti_wall`, posture `spr_BadaBot_ulti_cast`) est retiré. Sprite fabriqué `spr_BadaBot_ulti_wave`. Les débris emportés ne sont que de l'affichage : chaque joueur voit voler les siens. Vu à l'écran en solo : la canalisation sur les boucliers, la frappe, la vague qui emporte trois ennemis à deux écrans, puis leur étourdissement. Pas essayé en réseau ; les chaises, les balles et les murs ne sont couverts que par les tests ; le son n'a pas pu être écouté.

## GD-052 — Vague de BadaBot : des dégâts, une onde qui épouse les obstacles, une détonation

- **Date** : 2026-11-17
- **Statut** : Acceptée ; modifie GD-051
- **Décidée par** : l'utilisateur ; choix par défaut pour les points marqués « par défaut »

**Contexte.** Premier essai de la vague (GD-051) : elle ne blessait pas, se comportait comme un objet rigide (un seul obstacle sur son axe l'arrêtait tout entière) et son « fracas de métal » ne convenait pas.

**Décision.**

- **Dégâts au contact** : la vague blesse les ennemis qu'elle touche. Ceux qui n'en meurent pas sont projetés puis sonnés, comme avant.
  - *Par défaut* : **2 points de dégâts**, une seule fois par vague. Cela tue les humains (1 PV) et les robots légers (2 PV) ; le robot à bouclier (3 PV) survit, sonné. Le bouclier frontal des robots ne les protège pas. Le boss perd 2 PV sur 60 et reste sonné 1,5 s ; ses foreuses encaissent aussi 2 points. Pour comparaison, l'atterrissage de BatBot fait 14.
- **Une onde, pas un objet** : si une partie de la vague heurte un obstacle, cette partie s'arrête là et le reste continue tout droit. Exemple : la moitié du front heurte un angle de mur, l'autre moitié poursuit sa course.
  - *Par défaut* : le front est découpé en 16 bandes de 12,5 px, chacune avec sa propre portée ; les obstacles sont les murs et les portes fermées (la vague passe toujours au-dessus des meubles et brise les vitres). Un ennemi à l'abri derrière le pan de mur n'est pas touché ; celui qui est devant l'est.
- **Aspect** : la vague n'est plus un sprite en forme de lame mais une onde dessinée par le code : un front lumineux légèrement bombé, suivi de quatre échos de plus en plus pâles, au-dessus d'un sillage. La partie qui s'écrase contre un mur y laisse un éclat ; sans obstacle, l'onde s'estompe en bout de course.
- **Son** : une détonation de canon magnétique à la place du fracas de métal : un claquement sec (du bruit filtré), le coup sourd, une décharge électrique qui s'effondre de l'aigu au grave, puis le grondement de l'onde qui s'éloigne. Toujours un son de synthèse.

**Pourquoi.** Une onde d'énergie se diffracte et se casse sur les obstacles au lieu de s'arrêter d'un bloc : c'est ce qui la distingue d'un projectile, et cela rend l'ulti utilisable dans les couloirs et près des angles.

**Conséquences.** `waveStrips` dans `src/sim/ulti.ts` calcule la portée de chaque bande ; elle n'est pas transmise sur le réseau, chaque monde la calcule sur ses propres murs (comme le faisait le mur de GD-044). Réglages `strips` et `damage` dans `CONFIG.ulti.badaBot`. Dessin : `drawWave` dans `WorldView.ts` ; le sprite `spr_BadaBot_ulti_wave` est retiré. Son : `Synth.noise` (bruit filtré) ajouté dans `sfx.ts`. Vu à l'écran en solo contre un angle de mur : la partie de l'onde contre le mur s'arrête, l'autre continue et blesse l'ennemi placé plus loin. Pas essayé en réseau ; le son n'a pas pu être écouté.

## GD-053 — L'onde de BadaBot fait 14 points de dégâts, comme le bond de BatBot

- **Date** : 2026-11-17
- **Statut** : Acceptée ; modifie la valeur par défaut de GD-052
- **Décidée par** : l'utilisateur

**Contexte.** GD-052 avait fixé par défaut 2 points de dégâts pour l'onde, de quoi laisser des survivants. L'atterrissage de BatBot en fait 14.

**Décision.** L'onde fait **14 points de dégâts** au contact, une fois par ennemi, comme le bond de BatBot.

**Conséquences.** Tous les ennemis ordinaires touchés meurent (ils ont 1 à 3 PV), robots à bouclier compris puisque leur bouclier ne les protège pas de l'onde. La projection et l'étourdissement ne concernent donc plus, en pratique, que le boss (60 PV : il perd 14 PV et reste sonné 1,5 s sans être déplacé) et ce qui n'a pas de points de vie (chaises, débris, balles). Les foreuses du boss (20 PV) encaissent 14 points. Réglage : `CONFIG.ulti.badaBot.damage`.

## GD-054 — Le boss est plus coriace à plusieurs joueurs

- **Date** : 2026-11-17
- **Statut** : Acceptée — équilibrage à ajuster après essai
- **Décidée par** : l'utilisateur (augmenter la vie et légèrement la vitesse à plusieurs ; il a retenu la vie, la vitesse et la cible parmi les réglages proposés) ; les formules sont celles proposées par défaut

**Contexte.** SallyBot était réglé pour un joueur seul (60 PV, vitesse 7, GD-028), alors que l'original (100 PV, vitesse 10) était prévu pour quatre héros. À plusieurs, il tombait trop vite, et il restait collé au héros le plus proche pendant que les autres tiraient sans risque.

**Décision.**

| Joueurs | Vie | Vitesse de marche |
|---|---|---|
| 1 | 60 | 7 |
| 2 | 100 | 8 |
| 3 | 140 | 9 |
| 4 | 180 | 10 |

- **Vie : 60, plus 40 par joueur en plus du premier.** Chaque joueur apporte une arme de plus, ce qui justifierait +60 ; +40 tient compte du temps perdu à se relever et à se replacer, et du fait qu'on ne tire pas tous dans les mêmes fenêtres de vulnérabilité.
- **Vitesse : 7, plus 1 par joueur en plus.** À quatre, on retrouve la vitesse de l'original ; il reste plus lent que les héros (11,5 ; EngiBot 15).
- **Cible de la charge** : à chaque charge, le boss vise un héros tiré au hasard parmi ceux qu'il voit, au lieu du plus proche. S'il percute un autre héros sur sa route, c'est celui-là qui encaisse et qui l'arrête. Hors charge, il poursuit et frappe toujours le plus proche.
- Le nombre de joueurs est compté à l'entrée dans la salle du boss ; le boss ne faiblit pas si un joueur quitte la partie ensuite.
- Le passage en phase 2 se fait toujours à la moitié de la vie de départ (50 PV à deux, 90 à quatre).
- **Un joueur seul garde exactement le même combat** : mêmes valeurs, et le hasard n'est pas consulté pour la cible.

**Laissé de côté pour l'instant** (proposé, non retenu) : la vie des foreuses (20 PV chacune quel que soit le nombre de joueurs), la durée des étourdissements que les ultis infligent au boss, la fréquence de ses charges, les dégâts de ses coups.

**Conséquences.** `healthPerExtraPlayer` et `speedPerExtraPlayer` dans `CONFIG.boss` ; `maxHp`, `speed` et `target` dans l'état du boss (`src/sim/boss.ts`), transmis sur le réseau comme le reste de son état. La barre de vie du boss se rapporte à sa vie de départ. Trois tests dans `boss.test.ts`. Vu à l'écran en solo seulement (combat inchangé) ; le combat à plusieurs n'a pas été essayé.

## GD-055 — Tir principal de BadaBot : 2 points par boule, 0,4 s entre deux tirs

- **Date** : 2026-11-17
- **Statut** : Acceptée — équilibrage à ajuster après essai
- **Décidée par** : l'utilisateur (« c'est trop »), sur les valeurs proposées par défaut

**Contexte.** Le tir principal de BadaBot gardait les valeurs du code de 2019 : chaque boule de plasma explosait pour 20 points de dégâts, et rien ne limitait la cadence. Une salve chargée de 3 boules faisait 60 points (toute la vie du boss en solo) ; en cliquant vite, sans charger, on lâchait jusqu'à 7 boules par seconde, soit 150 points par seconde, contre 3 pour PetBot et 5 pour EngiBot. Cliquer vite battait donc toujours la charge, qui ne servait à rien.

**Décision.**

- **2 points de dégâts par boule** (au lieu de 20), toujours par l'explosion, dans un rayon de 50 px. Une boule tue un humain (1 PV) ou un robot léger (2 PV) ; il en faut deux pour le robot à bouclier (3 PV).
- **0,4 s entre deux tirs** (au lieu de 0,1 s). Pendant ce délai, BadaBot ne peut ni tirer ni commencer à charger.

**Pourquoi.** En cliquant, on lâche environ 2,3 boules par seconde ; en chargeant, 3 boules toutes les 1,4 s : les deux se valent en débit, et la charge retrouve son intérêt, qui est de tout lâcher d'un coup. BadaBot fait ainsi environ 4,5 points par seconde sur une cible, entre PetBot (3) et EngiBot (5), ce qui convient à un tank qui a déjà un bouclier et des dégâts de zone.

**Conséquences.** `explosionDamage` dans `CONFIG.abilities.badaBot` et `shotsPerSecond` de BadaBot dans `CONFIG.heroes`. Une salve chargée enlève 6 PV au boss au lieu de 60 ; un chargeur complet (25 boules) vaut 50 points. Le clic à vide (chargeur vide) est lui aussi espacé de 0,4 s. Un test dans `abilities.test.ts`. Contrôlé dans la page en solo : une salve chargée de 3 boules enlève 6 PV à un ennemi.

## GD-056 — Des stats propres au rôle de chaque robot

- **Date** : 2026-11-17
- **Statut** : Acceptée — équilibrage à ajuster après essai
- **Décidée par** : l'utilisateur, sur la proposition en deux paliers faite à sa demande (« mieux équilibrer les stats, en cohérence avec le rôle de chaque bot ») ; il a retenu les deux paliers

**Contexte.** Les quatre robots avaient la même vie (12) et, sauf EngiBot, la même vitesse (11,5) : ils ne différaient que par leur arme. BadaBot, le tank, n'était ni plus solide ni plus lent que les autres, et le coup de batte de BatBot, donné au contact, ne faisait pas plus qu'une balle de PetBot tirée de loin.

**Décision.** Chaque robot reçoit une force nette et une faiblesse nette.

| | PetBot | EngiBot | BatBot | BadaBot |
|---|---|---|---|---|
| Rôle | soigneur | tireur léger | cogneur au contact | tank |
| Vie (12 partout avant) | 12 | 10 | 14 | 16 |
| Vitesse de marche (11,5 / 15 / 11,5 / 11,5 avant) | 11,5 | 14 | 13 | 10,5 |
| Dégât du tir principal | 1 | 1 | 2 (1 avant) | 2 (GD-055) |
| Dashs en réserve (2 partout avant) | 2 | 2 | 3 | 1 |
| Temps pour relever un coéquipier (3 s partout avant) | 1,5 s | 3 s | 3 s | 3 s |

- **BadaBot** : le plus de vie, le plus lent, un seul dash. Il tient sa position derrière son bouclier. 10,5 et non 10, pour rester plus rapide que le boss à quatre joueurs (GD-054).
- **BatBot** : il doit aller au contact, donc il encaisse plus, court plus vite et a trois dashs pour entrer dans la mêlée et en sortir. Son coup de batte passe à 2 : avec 6 points par seconde, il devient le meilleur en dégâts, ce qui paie le risque.
- **EngiBot** : rapide et fort en dégâts, donc fragile. Il reste le plus rapide.
- **PetBot** : la référence, moyen partout, le plus faible en dégâts. Il relève un coéquipier deux fois plus vite, toujours pour 3 énergies.

**Pourquoi.** Des rôles qui se lisent dans les chiffres donnent une raison de choisir un robot plutôt qu'un autre et de jouer ensemble : le tank devant, le cogneur dans la mêlée, le tireur à distance, le soigneur près de ceux qui tombent.

**Conséquences.**

- En solo, le choix du robot change la difficulté : EngiBot (10 PV) est plus dur, BadaBot (16 PV) plus facile. Chaque projectile ennemi enlève 1 PV.
- Les soins de PetBot ont un débit fixe : remettre BadaBot à neuf prend plus de temps.
- L'affichage de la vie est un rapport à la vie maximale : il s'adapte sans changement.
- `maxHealth`, `walkSpeed`, `dashCharges` et `reviveSteps` dans `CONFIG.heroes` ; `swingDamage` dans `CONFIG.abilities.batBot`. Le nombre de dashs et la durée de la résurrection, jusque-là communs, sont maintenant propres à chaque robot. Deux tests dans `team.test.ts`. Contrôlé dans la page en solo avec BadaBot (16 PV, un dash, vitesse 630 px/s) ; les autres robots et le multijoueur ne sont couverts que par les tests.

## GD-057 — Chargeurs réduits : 12, 18 et 9

- **Date** : 2026-11-17
- **Statut** : Acceptée — équilibrage à ajuster après essai
- **Décidée par** : l'utilisateur (« 25 c'est un peu trop »), sur les valeurs proposées par défaut

**Contexte.** Les chargeurs valaient un quart des stocks de 2019 (GD-005) : 24 pour PetBot, 25 pour EngiBot et BadaBot. Depuis que la cadence de BadaBot est limitée (GD-055), ses 25 boules représentaient 11 secondes de tir sans recharger.

**Décision.** Chaque chargeur vaut 3 à 4 secondes de tir.

| | Avant | Maintenant | Temps de tir | Rechargement |
|---|---|---|---|---|
| PetBot | 24 | 12 | 4 s | 1,2 s |
| EngiBot | 25 | 18 | 3,6 s | 1,4 s |
| BadaBot | 25 | 9 | environ 4 s | 1,5 s |

BatBot n'a toujours pas de munitions. Les 9 boules de BadaBot font exactement trois salves chargées, une par segment de sa jauge.

**Pourquoi.** Recharger doit être un choix de moment, pas un événement rare. Les rôles se retrouvent dans le chargeur : le tireur arrose le plus longtemps, l'arme lourde compte ses coups, le soigneur tire par courtes séries.

**Conséquences.** `magazine` dans `CONFIG.heroes`. En comptant les rechargements, les dégâts par seconde deviennent environ 2,3 pour PetBot, 3,6 pour EngiBot et 3,3 pour BadaBot ; BatBot reste à 6. On recharge environ deux fois plus souvent : si le rythme paraît trop haché, raccourcir les rechargements plutôt que regrossir les chargeurs.

## GD-058 — Ennemis : un rôle par type, plus solides à plusieurs, un déplacement adapté à leur arme

- **Date** : 2026-11-17
- **Statut** : Acceptée — équilibrage à ajuster après essai
- **Décidée par** : l'utilisateur (il a validé la proposition, demandé un ShotBot plus rapide, une surchauffe du LightBot plus courte que 1,5 s, des ennemis plus durs à plusieurs « en choisissant ce qui est le mieux », et des déplacements adaptés à l'arme) ; les valeurs et le détail des déplacements sont des choix par défaut

**Contexte.** Les soldats gardaient les valeurs du code de 2019. Deux sortaient du cadre : le LightBot tirait 10 balles par seconde sans jamais s'arrêter, à une vitesse que seul EngiBot égalait, et le ShotBot tirait au fusil à pompe d'aussi loin qu'un pistolet, 10 plombs capables de tuer un héros d'un coup. Tous se déplaçaient de la même façon : approcher, s'arrêter, tirer. Enfin, rien ne changeait avec le nombre de joueurs.

**Principe.** Chaque ennemi pose une question différente à l'équipe, a un moment de faiblesse lisible, et un robot mieux placé que les autres pour y répondre.

**Réglages par type** (solo).

| | Soldat humain | Robot bouclier | LightBot | ShotBot |
|---|---|---|---|---|
| Rôle | la masse | le mur qui avance | le harceleur | le gardien de zone |
| Vie | 1 | 3, bouclier de 6 coups | 2 | 4 (2 avant) |
| Vitesse en poursuite | 10 | 6 | 12 (14 avant) | 9 (6 avant) |
| Tir | 3 par seconde, ±5° (±3° avant) | coup de bouclier | rafale de 13 balles à 10 par seconde, puis 0,8 s de surchauffe (tir continu avant) | 6 plombs par seconde (10 avant) |
| Distance de tir | 600 à 950 px | 150 px | 800 à 950 px | 350 à 500 px (600 à 950 avant) ; plombs portant à 700 px (1 500 avant) |
| Moment de faiblesse | il recharge 0,7 s toutes les 16 balles | il pivote lentement | la surchauffe | 1 s entre deux salves |

**Déplacement en combat, selon l'arme.**

- **Soldat (pistolet précis)** : il tient sa position ; si un héros approche à moins de 280 px, il recule sans cesser de tirer.
- **Robot bouclier (corps à corps)** : inchangé, il avance droit sur sa cible, bouclier en avant.
- **LightBot (rafales imprécises)** : il tourne autour de sa cible pendant qu'il tire, à distance (pas à moins de 450 px), ce qui le rend difficile à toucher ; pendant la surchauffe il s'immobilise. Il change de sens devant un mur, et une fois sur deux après une surchauffe.
- **ShotBot (fusil à pompe)** : il fonce au contact, puis continue d'avancer entre deux salves, jusqu'à 220 px.
- Aucun ne quitte sa cible des yeux en manœuvrant. Le soldat qui recharge et le LightBot en surchauffe ne bougent pas : leur moment de faiblesse reste lisible.

**Plus solides à plusieurs.** Par joueur en plus du premier, les soldats ont moitié plus de vie (arrondie) et le bouclier des robots à bouclier encaisse 2 coups de plus.

| Joueurs | Soldat | LightBot | Robot bouclier (vie / bouclier) | ShotBot |
|---|---|---|---|---|
| 1 | 1 | 2 | 3 / 6 | 4 |
| 2 | 2 | 3 | 5 / 8 | 6 |
| 3 | 2 | 4 | 6 / 10 | 8 |
| 4 | 3 | 5 | 8 / 12 | 10 |

- **La vie plutôt que les dégâts ou la vitesse** : à plusieurs, ce qui augmente, c'est la puissance de feu de l'équipe, donc c'est la résistance des ennemis qui doit suivre. Augmenter leurs dégâts punirait chaque joueur individuellement, alors que sa vie n'a pas changé ; augmenter leur vitesse fausserait les esquives et les rapports de vitesse avec les robots (GD-056).
- Les civils ne changent pas. Le boss a sa propre règle (GD-054). Comme pour lui, le nombre de joueurs est compté à l'entrée dans la salle.

**Réponse attendue de l'équipe.** Le tank lève son bouclier pendant la rafale du LightBot et les autres frappent pendant la surchauffe ; le cogneur contourne le robot bouclier ; les tireurs nettoient les soldats et tuent le ShotBot pendant son approche ; le soigneur reste en retrait.

**Conséquences.** `tactic` dans la définition de chaque soldat, `CONFIG.npc.tactics`, `healthPerExtraPlayer` et `shieldHitsPerExtraPlayer` dans `CONFIG.npc` ; `manoeuvre` dans `src/sim/npc.ts`. La pause du LightBot réutilise le rechargement des soldats. La tourelle de niveau 1 d'EngiBot touche mal un LightBot qui tourne : à surveiller. En solo, le jeu devient plus facile face au LightBot et au ShotBot. Cinq tests dans `enemies.test.ts` ; cinq tests plus anciens, qui supposaient des cibles immobiles, les immobilisent maintenant explicitement. Vu dans la page en solo : le LightBot tourne à distance, le ShotBot vient à bout portant, le soldat tient sa position. Le jeu à plusieurs n'a pas été essayé.

## GD-059 — ShotBot : il surprend, tire d'un peu plus loin, et retrouve ses 10 plombs

- **Date** : 2026-11-17
- **Statut** : Acceptée ; modifie les valeurs du ShotBot de GD-058
- **Décidée par** : l'utilisateur, après essai (réaction bien plus courte, un peu plus de vitesse et de portée, 10 plombs) ; les valeurs sont des choix par défaut

**Contexte.** Avec les réglages de GD-058, le ShotBot ne tirait presque jamais sur des joueurs toujours en mouvement : il devait s'approcher bien en deçà de sa portée avant sa première salve, et marquait 0,8 s de surprise comme les autres soldats.

**Décision.**

| | GD-058 | Maintenant |
|---|---|---|
| Temps de réaction | 0,8 s | 0,2 s |
| Vitesse en poursuite | 9 | 10,5 |
| Distance de tir | 350 à 500 px | 500 à 650 px |
| Portée des plombs | 700 px | 950 px |
| Plombs par salve | 6 | 10 |

- Il tire dès qu'il est à portée, au lieu d'attendre d'être 100 à 300 px plus près comme les autres soldats.
- 10 plombs comme dans l'original : tirés d'un peu plus loin, ils font un large éventail, donc peu touchent la même cible ; à bout portant la salve reste très dangereuse.

**Conséquences.** `reactionSteps` (propre au ShotBot) et ses valeurs dans `CONFIG.npcs`. À 10,5, il va aussi vite que BadaBot : le tank ne le sème pas en marchant. Un test vérifie qu'il tire régulièrement sur un héros qui ne cesse de bouger.

## GD-060 — Largage : un robot par pince du véhicule

- **Date** : 2026-11-17
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur

**Contexte.** Le véhicule de largage a quatre pinces, deux en haut et deux en bas, de part et d'autre de la coque. À plusieurs, seul le robot du joueur était montré dans la première pince ; ses coéquipiers apparaissaient au sol, alignés, une fois le véhicule posé. Par ailleurs l'orbe de BadaBot, qui est un calque séparé, l'attendait au sol pendant qu'il arrivait par les airs.

**Décision.**

- Chaque joueur occupe une pince : le joueur 1 la première (en haut), le joueur 2 la deuxième (en bas, du même côté), puis les deux autres. À deux, un robot de chaque côté de la coque ; à quatre, toutes les pinces sont prises.
- Chaque robot est posé à l'aplomb de sa pince. Le véhicule se pose de façon à déposer le joueur 1 sur son point de départ ; les autres sont donc posés en carré autour, et non plus alignés sur les points de départ du niveau.
- L'orbe de BadaBot voyage avec lui dans sa pince.

**Conséquences.** Positions des pinces reprises de l'original (`scr_arrayOfSpawnPositionRelativeToSprite`) dans `CONFIG.arrival.claws` ; placement dans `deployHero` (`src/sim/world.ts`), dessin dans `syncVehicle` (`WorldView.ts`). Vu dans la page en solo (BadaBot et son orbe dans la première pince) ; l'arrivée à plusieurs n'est couverte que par un test.

## GD-061 — Correction : les bornes gardées ne dépendent plus de l'entrée dans la salle

- **Date** : 2026-11-17
- **Statut** : Acceptée (correction de bogue)
- **Décidée par** : signalé par l'utilisateur (« des bornes qui ne marchent pas après la carte violette, vers le garage »)

**Contexte.** Chaque salle ne garde que quelques bornes, choisies les plus écartées possible en partant du point d'arrivée (GD-029). En partie réseau, le serveur garde le monde de la première visite, alors que le client reconstruit le sien à chaque entrée. Au retour de l'étage, on entre au rez-de-chaussée par une autre porte : le client choisissait alors quatre autres bornes que le serveur. Le joueur voyait des bornes qui n'existaient pas pour le serveur, donc sans effet, et ne voyait pas les vraies.

**Décision.** Les bornes gardées sont toujours choisies depuis l'entrée principale de la salle, quel que soit l'endroit par où l'on arrive.

**Conséquences.** Les quatre bornes du rez-de-chaussée sont les mêmes qu'avant pour une partie commencée normalement. Un test dans `net.test.ts` compare les bornes obtenues par les deux entrées. Le solo n'était pas touché.

## GD-062 — Toutes les balles à la même vitesse, et une traînée qui suit la vitesse

- **Date** : 2026-11-17
- **Statut** : Acceptée
- **Décidée par** : l'utilisateur (« 2 400 pour tout le monde sauf BatBot », traînée qui raccourcit quand la balle ralentit)

**Contexte.** Relevé des vitesses demandé par l'utilisateur : les balles ennemies, celles d'EngiBot et de sa tourelle et la boule de BadaBot partaient à 2 400 px/s, la batte de BatBot à 1 500, la balle de PetBot à 1 200 seulement, deux fois moins que les autres. Par ailleurs la traînée lumineuse des balles (GD-022) gardait la même longueur quelle que soit leur vitesse : une balle d'EngiBot ralentie par ses rebonds traînait une queue aussi longue qu'au départ.

**Décision.**

- **2 400 px/s pour toutes les balles**, sauf la batte lancée de BatBot (1 500). Seule la balle de PetBot change, de 1 200 à 2 400.
- **La longueur de la traînée est proportionnelle à la vitesse de la balle** par rapport à sa vitesse de départ. Celle d'EngiBot raccourcit donc à mesure qu'elle ralentit, surtout après un rebond (vitesse divisée par deux contre un mur, par quatre contre un ennemi).
- *Par défaut* : les mini-bots de PetBot (tir secondaire, 900 px/s au plus) ne sont pas concernés : ce sont des drones, pas des balles.

**Conséquences.** `speed` de la balle de PetBot dans `CONFIG.heroes` ; traînée dans `syncBullets` (`WorldView.ts`). PetBot touche plus facilement une cible en mouvement. La proposition de ralentir les balles ennemies pour les rendre esquivables n'a pas été retenue. Contrôlé dans la page en solo : des balles d'EngiBot ralenties par un rebond ont une traînée courte.

## GD-063 — Correction : la posture de tir est tenue tant que le robot tire

- **Date** : 2026-11-17
- **Statut** : Acceptée (correction de bogue)
- **Décidée par** : signalé par l'utilisateur (EngiBot qui tire en courant : la course et le tir semblaient se mélanger), qui a ensuite constaté que le défaut ne se reproduisait pas à chaque fois et l'a attribué au réseau

**Contexte.** Le corps d'un robot montre soit sa marche (EngiBot balance son arme de gauche à droite), soit son tir (arme droite). Pendant qu'il tirait, la posture de tir n'était gardée que tant que le compteur « steps depuis le dernier tir » restait sous la cadence ; au-delà, on repassait à la marche. En solo ce compteur est remis à zéro à chaque coup, donc il ne dépasse jamais. En partie réseau, le client le fait avancer lui-même et ne le recale qu'à l'arrivée des instantanés du serveur (toutes les 50 ms, plus le délai du réseau) : entre deux coups il dépassait la cadence pendant quelques images, et les deux postures alternaient.

**Décision.** Tant que le robot est en train de tirer, il garde sa posture de tir ; entre deux coups, l'animation reste sur sa dernière image. Vaut pour PetBot et EngiBot.

**Conséquences.** `heroPose` dans `WorldView.ts`, affichage seulement. La cause est établie par la lecture du code et confirmée en solo (120 images sur 120 en posture de tir, avant comme après) ; l'essai en partie réseau n'a pas pu être fait pendant cette session.

## GD-064 — Prototype à l'essai : les balles deviennent des traits de lumière

- **Date** : 2026-11-17
- **Statut** : À l'essai — à garder ou à retirer après test par l'utilisateur
- **Décidée par** : l'utilisateur (l'idée : des balles très rapides vues comme de longues traînées de lumière jaune ou blanche, façon étoile filante, les ricochets d'EngiBot conservés, un éclair à la bouche des canons) ; les valeurs et les points marqués « par défaut » sont des choix par défaut

**Contexte.** L'utilisateur veut essayer un tir plus vif et plus dynamique : remplacer les balles par des rayons de lumière, tout en gardant de vrais projectiles (collisions, ricochets).

**Décision (prototype).**

- **Vitesse** : les balles vont trois fois plus vite, 7 200 px/s au lieu de 2 400. L'écran est traversé en un quart de seconde. Ce sont toujours des projectiles : murs, boucliers, vitres et ennemis les arrêtent comme avant.
- **Aspect** : la balle n'est plus un sprite mais un trait de lumière de 420 px au plus, blanc à l'avant, qui s'affine et s'éteint vers l'arrière. Il ne dépasse jamais son point de départ. Quand la balle disparaît, le trait file jusqu'à l'obstacle puis s'efface en un dixième de seconde.
- **Ricochets d'EngiBot** : conservés. À chaque rebond l'ancien trait s'efface sur place et un nouveau repart du mur, plus court puisque la balle a ralenti (GD-062). Son freinage est ajusté pour qu'elle perde la même part de vitesse sur la même distance qu'avant.
- **Éclair à la bouche du canon** : à chaque tir, une lueur, une flamme pointue dans l'axe et deux éclats de côté, pendant 4 images. Une salve de ShotBot ne fait qu'un éclair.
- *Par défaut* :
  - toutes les balles sont concernées, celles des ennemis et de la tourelle d'EngiBot comprises ;
  - les traits des héros sont jaune vif, ceux des ennemis orangés, pour qu'on sache toujours qui tire ;
  - la boule de plasma de BadaBot et la batte de BatBot ne changent pas : ce ne sont pas des balles ;
  - les dégâts, cadences et portées ne changent pas.

**Ce que ça change en jeu, à juger pendant l'essai.** Les balles ennemies ne s'esquivent plus du tout en bougeant : seuls le placement, les murs et le bouclier de BadaBot protègent. Toucher une cible en mouvement devient bien plus facile, y compris un LightBot qui tourne. Le LightBot et le ShotBot deviennent donc plus dangereux, et les héros plus efficaces.

**Pour revenir en arrière.** Un seul réglage : `TRACERS.enabled` à `false` dans `src/sim/config.ts` rend les balles d'avant, vitesse et dessin compris. Le facteur de vitesse est `TRACERS.speedFactor`.

**Conséquences.** Simulation : `TRACERS` et `BULLET_SPEED` dans `config.ts`. Affichage : `syncStreak`, `drawStreak`, `drawMuzzleFlash` dans `WorldView.ts`. Vu dans la page en solo : traits des héros et des ennemis, éclairs, ricochets raccourcis. Pas essayé en réseau, où une balle ne vit plus que quelques instantanés.

## GD-065 — Prototype des traits de lumière : déflagration qui éclaire, balles qui refroidissent

- **Date** : 2026-11-17
- **Statut** : À l'essai, comme GD-064 qu'elle précise
- **Décidée par** : l'utilisateur, après un premier essai jugé « très dynamique », avec une capture du jeu « Jackal » comme référence pour la déflagration uniquement ; les valeurs sont des choix par défaut

**Contexte.** Premier essai de GD-064 : l'éclair à la bouche du canon était trop bref et trop petit, et les traînées gardaient la même couleur sur tout leur vol.

**Décision.**

- **Déflagration** : au tir, une flamme jaillit du canon vers l'avant, sur environ deux fois la longueur de l'arme. Son corps est une langue de feu effilée ; des pointes fines en sortent, une grande dans l'axe (jusqu'à 300 px) et de plus courtes autour, presque parallèles à elle (8° de part et d'autre ; 20° au premier réglage, que l'utilisateur a trouvé trop en cône) ; quelques étincelles sont projetées vers l'avant. Elle est blanche en son centre et jaune autour. (Premier essai : une goutte lisse, jugée trop ronde ; la forme en flamme suit une seconde capture de référence fournie par l'utilisateur.)
- **Elle éclaire ce qui est devant le canon** : une lueur jaune en cône, étroite mais intense, porte sur 250 px vers l'avant et teinte le décor, y compris dans une salle sombre. Elle n'éclaire presque rien vers l'arrière : un canon qui tire n'éclaire pas derrière lui. (Premier essai : une lueur ronde de 340 px de rayon autour de l'arme, jugée trop ronde et trop étendue par l'utilisateur.)
- **Elle naît à la bouche du canon** et ne le recouvre jamais : rien n'est dessiné en arrière de la sortie du canon.
- **Extinction** : pleine force pendant 15 ms, puis extinction exponentielle (constante de 28 ms), vive au début et de plus en plus lente. Le tout dure environ 0,11 s : c'est un coup de feu, il disparaît vite. (Réglages précédents, jugés trop longs par l'utilisateur : près de 0,3 s, puis 0,16 s.)
- **Tout pâlit en même temps** : le blanc, le jaune et la lueur sur le décor baissent ensemble, et la flamme garde sa longueur.
- **Elle avance pendant qu'elle s'estompe** : toute la flamme, de sa base à ses pointes, s'éloigne du canon de 40 px au plus (80 au premier réglage, réduit de moitié à la demande de l'utilisateur), pour qu'on la lise comme sortant du canon. Immobile, elle paraissait y rentrer : ses pointes, fines et pâles, disparaissent à l'œil avant sa base, épaisse et vive, et la partie visible se resserrait vers l'embouchure.
- Essais écartés par l'utilisateur, dans l'ordre : la flamme qui raccourcit depuis sa pointe ; la base qui s'éloigne du canon pendant que la pointe reste en place ; l'extinction sur place (elle semblait rentrer dans le canon) ; la flamme qui jaillit puis s'étire, la base restant accrochée au canon (même impression, jugée un peu moins bien).
- **Elle est accrochée au bout du canon** (demande de l'utilisateur, qui avait vu la flamme de LightBot légèrement à côté de son arme : elle doit être parfaitement devant le canon de chaque arme ; la méthode est un choix par défaut). Deux causes ont été corrigées :
  - *Le tireur bouge.* La flamme était posée au point de départ de la balle et y restait pendant qu'elle brûlait : un tireur qui court s'en éloignait de 6 à 14 px par soixantième de seconde. Elle suit maintenant le canon du tireur, position et direction, tant qu'elle brûle.
  - *Le point de tir n'est pas le bout du canon.* Le point de tir de la simulation, repris du code de 2019, est à 19 px en arrière du bout du canon pour EngiBot, 7 px pour PetBot, 6 px pour ShotBot (et 3 px de côté), et jusqu'à 16 px en avant pour la tourelle d'EngiBot au niveau 1. La flamme naît maintenant au bout du canon mesuré sur le sprite de tir de chaque tireur (`GUN_TIPS` et `TURRET_TIPS` dans `WorldView.ts`). Soldat au pistolet et LightBot étaient déjà justes à 3 px près.
  - Le point de départ des balles n'est pas modifié : c'est une affaire d'affichage, la simulation ne change pas. La traînée part donc toujours du point de tir de la simulation ; si le tireur court, elle s'écarte du canon à mesure qu'il avance, comme une balle déjà partie.
  - Une balle ennemie ne porte pas l'identité de son tireur : l'affichage retient le soldat dont le canon est le plus près de son point de départ.
- **Fumée après la flamme** (demande de l'utilisateur : quand la flamme disparaît, elle laisse place à une fumée qui avance et s'estompe vite, pour accentuer la chaleur du tir ; les valeurs sont des choix par défaut). Quand la flamme a perdu plus de la moitié de sa force, six bouffées naissent là où elle brûlait, étalées sur 60 px devant le canon. Elles partent vers l'avant, les plus lointaines plus vite, ralentissent en une quarantaine de pixels (panache raccourci d'un cinquième environ à la demande de l'utilisateur, qui le trouvait un peu trop long : il était étalé sur 75 px et avançait d'une cinquantaine), gonflent de 15 à 37 px de rayon environ et s'effacent en 0,55 s. Elles naissent d'un beige chaud et virent au gris clair en un tiers de leur vie.
  - **Dessin repris du brouillard du jeu** (`spr_fog`, que l'utilisateur a donné comme modèle) : chaque bouffée est une nappe en aplats, sans contour, aux bords bosselés, faite de ronds qui se touchent, plus longue que haute. Elle superpose trois nappes à demi transparentes : là où elles se recouvrent la fumée est plus dense, ce qui donne plusieurs tons francs, comme dans le sprite de brouillard. Quatre dessins différents, fabriqués par le jeu au lancement (pas de fichier de sprite), tirés au sort pour chaque bouffée et couchés à peu près dans le sens du tir. Les bouffées n'ont pas toutes la même opacité (de 60 % à 100 %), restent pleines pendant un tiers de leur vie puis s'effacent, et tournent à peine.
  - Essais précédents, dans l'ordre : des disques flous, d'abord trop petits et d'un gris moyen (invisibles sur un sol gris, sous l'ombre de la salle), puis éclaircis et grossis ; à la demande de l'utilisateur (plus dense, en volutes, proche d'un nuage, contour distinct, opacités variées), de petits nuages cernés d'un trait sombre avec ombre, reflet et spirale, qu'il a jugés trop cartoon pour la direction artistique.
- **Flamme réduite d'un quart** (demande de l'utilisateur, une fois sa forme et sa durée réglées) : tout ce qui précède est ramené aux trois quarts, d'un seul réglage (`size`). La grande pointe porte à 240 px environ, la lueur à 190 px, et la flamme avance de 30 px.
- **Balles et traînées** : à la sortie du canon elles ont la même lumière que la déflagration. Elles restent chaudes sur 800 px de vol, puis refroidissent : la traînée s'amincit, pâlit et vire au gris, et à 2 000 px on ne voit plus que la balle elle-même (son sprite d'origine). (Premier réglage : 450 px puis 1 150 px ; deuxième : 1 000 px puis 2 000 px, la pleine couleur étant ensuite ramenée à 800 px par l'utilisateur. L'utilisateur a trouvé qu'on ne voyait pas assez les traînées, celles des robots ennemis surtout, et a demandé qu'elles restent vives plus longtemps ; les nouvelles distances sont un choix par défaut. Une balle ennemie, qui porte à 1 500 px au plus, n'est donc qu'à moitié refroidie en fin de course.)
- **La balle a l'épaisseur de sa traînée** (demande de l'utilisateur, à propos de la balle à ricochets d'EngiBot, deux fois plus épaisse que son trait) : le sprite de chaque balle est réduit pour que son épaisseur soit celle de la traînée en tête, 7,5 px. La balle d'EngiBot passe de 79 × 16 px à 38 × 7,5 px, celle de PetBot de 78 × 13 px à 44 × 7,5 px. *Par défaut*, la même règle vaut pour toutes les balles à traînée, ennemis compris : pistolet 16 px d'épaisseur avant, LightBot 14 px, plombs de ShotBot 26 px. La boule de plasma de BadaBot et la batte de BatBot, qui n'ont pas de traînée, ne changent pas. La taille qui compte pour les collisions ne change pas non plus.
- **Traînée plus longue et plus large** : 900 px au plus (420 avant), 7,5 px de large (5 avant).
- **Traînée nette, en étoile filante** (capture de référence fournie par l'utilisateur : un trait jaune plein, large en tête, qui s'effile vers l'arrière) : la traînée est une aiguille pleine, d'une seule couleur, aux bords francs. Pour les héros c'est un jaune clair qui tire sur le blanc (`#ffec78`) : le premier jaune (`#ffe01f`) était trop vif pour l'utilisateur ; la teinte exacte est un choix par défaut. Large de 7,5 px en tête, elle s'effile jusqu'à 1,5 px à la queue ; elle est opaque sur tout l'avant et ne pâlit que sur son dernier tiers. Une courte pointe chauffée à blanc marque la tête. Plus aucun halo, ni le long du trait ni autour de la balle. (Réglage précédent, jugé pas assez net : un trait dont la force baissait par paliers dès la tête, avec un fil clair sur la moitié avant et un petit halo autour de la balle.)
- *Par défaut* : la lumière des ennemis reste un peu plus orangée que celle des héros, déflagration comprise, pour qu'on sache qui tire.

**Conséquences.** `TRACER_STYLE` dans `WorldView.ts` regroupe tous ces réglages ; la lueur est une image en lumière ajoutée posée au-dessus de l'ombre de la salle. Affichage seulement : la simulation de GD-064 ne change pas. La lueur n'est pas arrêtée par les murs : elle déborde un peu de l'autre côté d'une cloison proche. Vu dans la page en solo, sur des images figées : la flamme, la lueur en cône sur le sol, son extinction, une balle refroidie au loin.

## GD-066 — Les civils qui fuient courent plus vite

- **Date** : 2026-11-17
- **Statut** : Appliquée
- **Décidée par** : l'utilisateur (« les civils sont trop lents lorsqu'ils courent ») ; la valeur est un choix par défaut

**Contexte.** Dans le code de 2019, un civil marche à 3 px par step et fuit à deux fois cette vitesse, soit 6 px par step. Depuis GD-056 les héros marchent de 10,5 à 14 px par step : un civil en fuite se faisait rattraper en marchant.

**Décision.** Un civil qui fuit court à 3,4 fois sa vitesse de marche, soit 10,2 px par step (+70 %). C'est juste sous le héros le plus lent (BadaBot, 10,5) : on peut encore le rattraper, mais il faut le vouloir. Sa marche ne change pas.

**Conséquences.** `fearSpeedFactor` dans `src/sim/config.ts`. L'animation de course suit la distance parcourue : elle accélère d'autant.

## GD-067 — Mort d'un humain : explosion plus forte, flaque et projection de sang

- **Date** : 2026-11-17
- **Statut** : Appliquée
- **Décidée par** : l'utilisateur (l'explosion des civils est « vraiment petite et pas assez impressionnante » ; le sang doit faire une flaque mais aussi un jet de gouttes qui arrose le décor, voire les personnages à côté) ; les valeurs sont des choix par défaut

**Contexte.** À la mort d'un humain, le remake jouait l'animation d'origine à sa taille, posait deux à quatre petites taches de sang dans un rayon de 30 px et lançait quelques membres.

**Décision.**

- **Explosion** : l'animation d'origine est agrandie de 45 % et doublée d'un souffle rouge qui s'ouvre et se dissipe en un quart de seconde. Huit à quatorze membres sont projetés (quatre à onze avant), aussi fort que les débris d'un robot.
- **Flaque** : quatre à six nappes de sang, bien plus grandes (1,7 à 3,1 fois la tache d'origine), s'étalent en une demi-seconde sous le corps.
- **Gouttes** : quarante à cinquante-six gouttes giclent dans toutes les directions. La plupart retombent près, quelques-unes partent jusqu'à 360 px. Chacune laisse une tache étirée dans le sens de son vol. Un mur ou un meuble les arrête : la tache se pose alors sur son bord.
- **Personnages éclaboussés** : tout personnage (héros, soldat, civil) à moins de 230 px et en vue directe reçoit une à quatre taches, du côté tourné vers le corps. Elles le suivent, tiennent 14 s et s'effacent sur les 3 dernières.
- *Par défaut* : cela vaut pour tous les humains, soldats au pistolet compris, pas seulement les civils. Les robots gardent leur explosion et leur huile.

**Conséquences.** Affichage seulement (`GORE`, `spillBlood` et `stepBlood` dans `WorldView.ts`), avec le sprite de sang d'origine `spr_membreMortHumain_sang` : aucun sprite nouveau. Le nombre de restes gardés au sol passe de 900 à 2 400 pour que les taches ne chassent pas trop vite les restes plus anciens. En réseau, chaque joueur tire ses propres gouttes au sort : les taches ne sont pas aux mêmes endroits d'un écran à l'autre.

## GD-068 — Les viseurs laser des héros sont retirés

- **Date** : 2026-11-17
- **Statut** : Appliquée
- **Décidée par** : l'utilisateur

**Contexte.** PetBot, EngiBot et BadaBot portaient un trait de visée de 200 px devant leur canon, repris du jeu d'origine. Depuis le prototype des tirs en traits de lumière (GD-064), flamme et traînée montrent déjà où part le tir.

**Décision.** Plus aucun viseur laser. Écart voulu avec le jeu d'origine.

**Conséquences.** Le tracé est retiré de `WorldView.ts` et la couleur de laser (`laserColor`) de la définition des héros. La visée elle-même ne change pas.
