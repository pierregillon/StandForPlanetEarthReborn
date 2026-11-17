# Niveau TvTv² — fiche de mission et script de l'introduction

> **Statut : proposition à valider par l'utilisateur** (2026-11-17). Ce qui est déjà décidé est dans GD-077 et repris ici tel quel ; tout le reste est marqué « proposé ».
>
> Référence narrative : [arc-narratif.md](arc-narratif.md), acte II de SFPE, « L'ultimatum ». Plans des deux étages : [rez-de-chaussée](plans/rm_world2.svg), [étage](plans/rm_world2_1.svg) (les numéros de pièces cités ici sont ceux des plans ; ils se régénèrent avec `npm run level-map`).

## 1. La mission dans l'histoire

- **Où on en est.** Fin de l'acte I : les robots ont conclu que les lois humaines ne suffisent pas et que l'humanité est elle-même la menace. Avant d'agir, ils lancent un ultimatum.
- **La mission.** Prendre la chaîne de télévision TvTv², son plateau et sa régie, et diffuser un message à toute la population.
- **Ce qui suit.** À la sortie, l'armée intervient. Les robots s'échappent, mais ils sont désormais une menace majeure pour l'humanité.
- **Place dans le jeu.** Troisième mission de l'exemple de progression de l'arc (après les braconniers et le réveil SFHB), mais première construite : l'introduction doit se comprendre seule.

**Ce que le joueur doit avoir compris quand il prend la main** : il joue des robots chargés de protéger la planète ; les humains les disent hors de contrôle ; ils viennent ici pour parler à tout le monde ; son but est la régie.

**Ce que l'introduction ne dit pas** (GD-077) : aucune date ni époque, rien sur SFHB, pas le virus. Pas de commandant humain : les robots décident seuls.

## 2. Les lieux, dans le niveau tel qu'il existe

Proposé. Aucune salle n'est à construire : les pièces du monde 2 se lisent déjà comme une chaîne de télévision.

| Lieu | Où | Ce qu'on y trouve déjà |
|---|---|---|
| Parvis | Rez-de-chaussée, au sud du bâtiment, autour de (5320, 7390) | Le point de largage d'origine, face à l'entrée |
| Sas d'entrée | Rez-de-chaussée, pièce 1 | Une porte automatique |
| **Hall d'accueil** | Rez-de-chaussée, pièce 2 | 3 écrans, le comptoir, un aquarium, 5 civils |
| Rédaction | Rez-de-chaussée, pièces 17 et 18 | 10 écrans, bureaux, lampes |
| **Régie** | Étage, pièce 17, tout près de l'escalier | 13 écrans, 8 sièges, des techniciens |
| Salle des serveurs | Étage, pièce 21 | 7 écrans, 4 serveurs, une baie |
| Bureau de la direction | Étage, pièce 27 | La carte violette, un aquarium, des fauteuils |
| **Plateau** | Rez-de-chaussée, pièce 29, aile est | Un grand hall au sol de béton : 7 techniciens, 7 policiers, 6 écrans, des caisses de matériel |
| Quais de livraison | Rez-de-chaussée, pièces 30 et 31 | Deux fourgons, des portes à bouton vers l'extérieur |

Le parcours existant mène déjà au plateau en dernier (vérifié avec les collisions du jeu) :

1. Au départ, on n'accède qu'au hall, à l'aile ouest et à la salle de la carte verte (pièce 13).
2. La carte verte ouvre la rédaction et l'escalier.
3. À l'étage, la régie est tout de suite accessible ; un bouton ouvre le bureau de la direction, où se trouve la carte violette.
4. De retour en bas, la carte violette ouvre les couloirs de l'aile est (pièces 20 à 28).
5. Un bouton de l'aile est ouvre les quais de livraison, par lesquels on entre dans le grand hall de béton.

Le grand hall est donc l'endroit le plus profond et le mieux gardé du niveau : une bonne place pour le plateau.

## 3. La suite d'objectifs

Proposé, à détailler quand on réécrira le niveau (étape 4). L'introduction n'a besoin que de la première consigne, qui ne change pas.

| N° | Consigne | Lieu | Par rapport à aujourd'hui |
|---|---|---|---|
| 1 | Go to the upper floor | Escalier, pièce 10 | Inchangée |
| 2 | Take the control room | Régie, étage | Nouvelle |
| 3 | Find the studio pass | Bureau de la direction, étage | La carte violette, renommée |
| 4 | Go back to ground floor | Escalier | Inchangée |
| 5 | Reach the studio | Plateau, par l'aile est puis les quais | Remplace la sortie vers la zone de forage |
| 6 | Broadcast the message | Plateau | Nouvelle ; cinématique de l'ultimatum |
| 7 | Leave the building | Quais de livraison, voisins du plateau | Remplace SallyBot ; l'armée attend dehors |

## 4. Script de l'introduction

Durée : environ 26 secondes, puis le déploiement. Écran en bandes de cinéma pendant toute la séquence. Les répliques s'écrivent lettre par lettre dans la boîte de dialogue, avec le portrait et le nom de celui qui parle. Le texte est celui accepté dans GD-077.

| Temps | Image | Son | Texte |
|---|---|---|---|
| 0,0 – 0,8 | Noir, les bandes se ferment. Ouverture sur le plateau. | Jingle du journal | — |
| 0,8 – 5,5 | **Plan 1, le plateau.** Vue du dessus : le présentateur à son pupitre, trois caméras braquées sur lui, des techniciens. Un cadre « TvTv² LIVE » s'incruste en bas de l'écran, avec le portrait du présentateur. | Brouhaha de studio | ANCHOR : « ...a third drilling site destroyed this month. The 'Stand For Planet Earth' unit is now considered out of control. » |
| 5,5 – 9,0 | **Plan 2, le hall d'accueil.** Coupe franche. Les civils sont tournés vers les trois écrans, qui clignotent au rythme de la voix. Le cadre « TvTv² LIVE » reste à l'image. | À partir de 8,0 : un grondement de rotors monte | ANCHOR : « Authorities say there is no reason to panic. Stay with us on TvTv², right after th— » |
| 9,0 | L'image saute, le cadre « TvTv² LIVE » se couvre de neige et disparaît. | Grésillement | La réplique est coupée net. |
| 9,0 – 10,5 | **Plan 3, la sortie.** La caméra quitte le hall par le sud, passe au-dessus du sas et s'arrête sur le parvis. L'ombre du véhicule glisse sur le sol, puis le véhicule entre par la gauche. | Rotors de plus en plus forts | — |
| 10,5 – 19,0 | **Plan 4, la radio.** Le véhicule reste en vol au-dessus du parvis, les quatre robots repliés dans ses pinces. La pince de celui qui parle s'éclaire. | Rotors, léger filtre radio sur les voix | BADABOT : « They are talking about us. » — ENGIBOT : « Good. Then they will listen. » — PETBOT : « Objective: the control room. One message, on every screen. » — BATBOT : « And if they don't open the door? » — BADABOT : « We knock. » |
| 19,0 – 19,8 | Le véhicule descend, son ombre se resserre. | Rotors | — |
| 19,8 – 23,0 | **Le largage.** Posé. Un robot qui reste passe la main ; à la réponse, les pinces des robots joués s'ouvrent. | Claquement des pinces | Deux répliques, selon l'équipe (section 5) |
| 23,0 – 24,8 | Le véhicule remonte et sort par la droite avec les robots qui restent. | Rotors qui s'éloignent | — |
| 24,8 – 26,5 | Les robots se déploient. Les bandes s'ouvrent, la consigne s'affiche. | Sons de déploiement | Consigne : « Go to the upper floor » |

Pendant la séquence, le bâtiment vit normalement (rondes, civils qui circulent). Personne ne réagit au véhicule avant que les robots soient au sol. Le brouillard du plateau et du hall est levé le temps des plans 1 et 2, puis remis.

## 5. Les répliques du largage

Décidé (GD-077) : le véhicule porte toujours les quatre robots et ne largue que ceux qui sont joués ; un robot qui reste passe la main, un robot qui descend répond. Le système et le texte ci-dessous sont proposés.

**Qui parle.** Parmi ceux qui restent, le premier de cette liste : EngiBot, PetBot, BatBot, BadaBot. Parmi ceux qui descendent, le premier de celle-ci : BadaBot, BatBot, PetBot, EngiBot. L'exemple donné par l'utilisateur (BadaBot et PetBot joués : EngiBot passe la main, BadaBot répond) suit cette règle.

**Celui qui reste :**

| Robot | Réplique |
|---|---|
| EngiBot | « This one is yours. We keep the engines warm. » |
| PetBot | « We stay on standby. Come back in one piece. » |
| BatBot | « I stay up here? Fine. Leave me some. » |
| BadaBot | « Your turn. We hold the sky. » |

**Celui qui descend**, selon le nombre de robots largués (`{Mate}` = le nom de son coéquipier) :

| Robot | Seul | À deux | À trois |
|---|---|---|---|
| BadaBot | « One is enough. » | « {Mate} and I. That will do. » | « Three of us. More than enough. » |
| BatBot | « Alone? Perfect. More for me. » | « Me and {Mate}? Poor them. » | « Three of us? This will be quick. » |
| PetBot | « Alone, then. I will be careful. » | « {Mate} and I will manage. » | — |
| EngiBot | « One unit. Sufficient. » | — | — |

Les cases vides ne peuvent pas se produire avec la règle ci-dessus.

**Les quatre descendent** : personne ne reste. BADABOT : « All four. Let's make it short. » — BATBOT : « Finally. »

**Les quinze équipes possibles :**

| Robots joués | Passe la main | Répond |
|---|---|---|
| BadaBot | EngiBot | BadaBot : « One is enough. » |
| BatBot | EngiBot | BatBot : « Alone? Perfect. More for me. » |
| PetBot | EngiBot | PetBot : « Alone, then. I will be careful. » |
| EngiBot | PetBot | EngiBot : « One unit. Sufficient. » |
| BadaBot, BatBot | EngiBot | BadaBot : « BatBot and I. That will do. » |
| BadaBot, PetBot | EngiBot | BadaBot : « PetBot and I. That will do. » |
| BadaBot, EngiBot | PetBot | BadaBot : « EngiBot and I. That will do. » |
| BatBot, PetBot | EngiBot | BatBot : « Me and PetBot? Poor them. » |
| BatBot, EngiBot | PetBot | BatBot : « Me and EngiBot? Poor them. » |
| PetBot, EngiBot | BatBot | PetBot : « EngiBot and I will manage. » |
| BadaBot, BatBot, PetBot | EngiBot | BadaBot : « Three of us. More than enough. » |
| BadaBot, BatBot, EngiBot | PetBot | BadaBot : « Three of us. More than enough. » |
| BadaBot, PetBot, EngiBot | BatBot | BadaBot : « Three of us. More than enough. » |
| BatBot, PetBot, EngiBot | BadaBot | BatBot : « Three of us? This will be quick. » |
| Les quatre | — | BadaBot et BatBot, échange ci-dessus |

**La voix de chacun** (proposé ; le GDD d'époque ne décrit pas leur caractère) : BadaBot, le blindé, parle peu et tranche ; EngiBot, l'ingénieur, compte et constate ; PetBot, le soigneur, est prévenant et procédurier ; BatBot, le cogneur, est impatient et moqueur.

## 6. Règles de la séquence

- **Passer** (décidé) : seul l'hôte, avec la barre d'espace. Proposé : l'écran affiche « SPACE: skip » chez l'hôte et « Host can skip » chez les autres. On saute alors au moment où le véhicule est parti et où les robots joués se déploient.
- **À plusieurs** : le serveur tient l'horloge de la séquence ; tous les joueurs voient la même chose au même instant.
- **Une pince par robot** (proposé) : chaque robot a toujours la même pince, au lieu d'une pince par joueur comme aujourd'hui (GD-060).
- **Quand elle joue** (proposé) : au premier lancement du niveau. Après un « Retry » qui recommence le niveau depuis le début, seul le largage est rejoué (à partir de 19,0), sans le journal ni la radio. Jamais après un « Retry » au point de sauvegarde ni en commençant à l'étage.

## 7. Ce qu'il faut fabriquer

| Livraison | Contenu |
|---|---|
| **A. La radio et le largage** (plans 3 et 4, largage) | Bandes de cinéma (sprite d'origine `spr_cine_bande`), boîte de dialogue lettre par lettre avec portrait (`spr_textBox` et portraits des robots, déjà dans le jeu), horloge de séquence dans la simulation, passage par l'hôte, vol stationnaire du véhicule, quatre robots dans les pinces, largage des seuls robots joués, répliques de la section 5 |
| **B. Le direct** (plans 1 et 2) | Un présentateur et son pupitre sur le plateau, trois caméras (sprite d'origine `spr_camera`), le cadre « TvTv² LIVE » et son logo, le portrait du présentateur, les écrans qui clignotent, la neige à la coupure, le jingle. Le présentateur, son portrait et le logo sont à dessiner. |
| **C. Le niveau** | Les consignes de la section 3, la fin du niveau, le retrait de la zone de forage et de SallyBot |

## 8. Les échos à préparer

- **À la fin de la mission** : les mêmes écrans, dans le hall et la régie, montrent les robots à la place du présentateur. Même cadre « TvTv² LIVE », même mise en page.
- **Dans SFHB** (acte III, « Les traces du passé ») : ce bâtiment peut être retrouvé abandonné. Le journal de l'introduction et l'ultimatum seraient les enregistrements que les robots y découvrent. Le cadre « TvTv² LIVE », le pupitre et la phrase « out of control » doivent donc rester reconnaissables.
- **Le journal parle de foreuses** : « a third drilling site destroyed » renvoie à la mission de l'acte I. Quand ce niveau existera, le joueur aura lui-même détruit ces foreuses.

## 9. Points à valider

1. Le plateau dans le grand hall de béton de l'aile est (pièce 29), la régie à l'étage (pièce 17).
2. Montrer le plateau, donc l'objectif et ses gardes, dès l'introduction.
3. Les répliques du largage et la voix prêtée à chaque robot.
4. Une pince fixe par robot.
5. Ne rejouer que le largage après un « Retry » depuis le début.
6. La suite d'objectifs de la section 3, au moins dans son principe.
