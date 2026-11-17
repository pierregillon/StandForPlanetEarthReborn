# Niveau TvTv² — fiche de mission, scripts de l'introduction et de la fin

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
| Salle de montage | Étage, pièce 17, près de l'escalier | 13 écrans, 8 sièges, des techniciens |
| Salle des serveurs | Étage, pièce 21 | 7 écrans, 4 serveurs, une baie |
| Bureau de la direction | Étage, pièce 27 | La carte violette, un aquarium, des fauteuils |
| **Régie** | Rez-de-chaussée, moitié ouest de la pièce 29 (x 6800 à 8224) | Une salle moquettée : une rangée de 6 écrans avec tables et sièges, 4 techniciens assis, 3 policiers, une baie de serveurs derrière une cloison vitrée, et un bouton |
| **Plateau** | Rez-de-chaussée, moitié est de la pièce 29 : une pièce fermée de 2688 × 1792 px (x 8256 à 10944, y 3072 à 4864), de la hauteur de la régie (GD-081, agrandie par GD-083) | Sol de résine sombre ; côté régie, trois caméras, l'estrade au logo, le pupitre courbe, le présentateur, quatre projecteurs, le mur d'écrans ; derrière la cloison, les coulisses. Aucun garde à l'intérieur au départ (GD-082) : deux policiers et un robot bouclier attendent dehors, devant les portes |
| Quais de livraison | Rez-de-chaussée, pièces 30 et 31, de part et d'autre de l'alcôve | Deux fourgons, deux portails à bouton vers l'extérieur |

**La régie est mitoyenne du plateau** (demande de l'utilisateur), et elle l'est déjà dans le niveau d'origine. La pièce 29 du plan est une seule zone de brouillard, mais ce sont deux salles séparées par une baie vitrée de 1800 px de long : d'un côté la rangée d'écrans, tournée vers la vitre ; de l'autre le hall de béton. Détail : [plan de l'aile est](plans/rm_world2-aile-est.svg). Et le bouton qui se trouve dans la régie est celui qui ouvre les deux portes du hall : prendre la régie ouvre le plateau.

Le parcours existant mène au plateau en dernier (vérifié avec les collisions du jeu) :

1. Au départ, on n'accède qu'au hall d'accueil, à l'aile ouest et à la salle de la carte verte (pièce 13).
2. La carte verte ouvre la rédaction et l'escalier.
3. À l'étage, un bouton ouvre le bureau de la direction, où se trouve la carte violette.
4. De retour en bas, la carte violette ouvre les couloirs de l'aile est (pièces 20 à 28), donc la régie.
5. Le bouton de la régie ouvre les deux portes du hall de béton.
6. Dans les quais, deux boutons ouvrent les portails vers l'extérieur.

**Aménagé** (GD-081, tout est dans `src/sim/additions.ts`) : le plateau est une pièce fermée, entre la vitre de la régie et le mur extérieur, avec une porte automatique au nord et une au sud. Le reste du hall de béton, de part et d'autre, reste une aire de livraison. Première idée, remplacée : le pupitre du présentateur devant l'alcôve, vers x 9450, face à la vitre ; trois caméras entre le pupitre et la vitre ; l'alcôve sert de fond de décor, ses caisses sont poussées sur les côtés. Ainsi un seul plan de 1920 px de large montre la rangée d'écrans de la régie, la vitre et le présentateur.

## 2 bis. L'aile est réorganisée (GD-083)

Décidé par l'utilisateur le 2026-11-17. Le rectangle du niveau ne change pas ; la régie et tout ce qui est à l'ouest restent tels quels. L'aile est s'organise autour du trajet d'un invité de la chaîne, du nord vers le sud.

| Zone | Où | Rôle |
|---|---|---|
| **Dépose-minute** | Angle nord-est, derrière les portails 3 | Les voitures entrent, déposent les invités (des personnalités, des ministres) et repartent. Un vrai parking : bitume, marquages, trottoir |
| **Salon d'attente** | Au nord du plateau, côté régie | Canapés, fauteuils, de quoi patienter. On y entre depuis le dépose-minute par une porte, ou depuis le couloir par la porte à bouton |
| **Maquillage** | Dans le décrochement du salon | Coiffeuses à miroir, un siège devant chacune, portants à vêtements |
| **Toilettes** | Au-dessus du maquillage (GD-084) | Trois cabines, trois lavabos ; on y entre depuis le salon, à côté du distributeur |
| **Plateau** | Au centre, de la même hauteur que la régie : ses murs nord et sud sont dans l'alignement des siens | Le studio de GD-081, agrandi. On y entre par la porte nord, on en sort par la porte sud |
| **Salon de sortie** | Au sud du plateau | On le traverse pour partir : pas de canapés, des casiers de consigne et un poste de sécurité (GD-084) |
| **Local technique** | Au sud du plateau, le long du parking, jusqu'au mur extérieur (GD-084) | Étagères de matériel, baies, caméras de réserve. Deux portes sur le parking, pour que la police entre en nombre |
| **Parking sud** | Angle sud-est, derrière les portails 4 | Le pendant du dépose-minute : les voitures y attendent les invités qui repartent |

**Ce qui se passe après la diffusion du message** (à réaliser, étape suivante) :

1. Le message est diffusé depuis la place du présentateur, derrière le pupitre.
2. La police intervient en grand nombre, par le sud : des fourgons entrent par les portails 4 et déploient 40 à 50 ennemis sur le parking sud. Leur point de ralliement est le plateau : ils entrent par les deux portes du local technique, traversent le salon de sortie, entrent dans le studio et cherchent les robots.
3. Le plan d'exfiltration des robots était de revenir au point de largage, donc par le sud. Ils s'y engagent, tombent nez à nez avec cette armée, et changent de plan.
4. Ils s'exfiltrent par le nord : le salon d'attente, le dépose-minute, puis les portails 3.

## 3. La suite d'objectifs

Proposé, à détailler quand on réécrira le niveau (étape 4). L'introduction n'a besoin que de la première consigne, qui ne change pas.

| N° | Consigne | Lieu | Par rapport à aujourd'hui |
|---|---|---|---|
| 1 | Go to the upper floor | Escalier, pièce 10 | Inchangée |
| 2 | Find the studio pass | Bureau de la direction, étage | La carte violette, renommée |
| 3 | Go back to ground floor | Escalier | Inchangée |
| 4 | Take the control room | Régie, par l'aile est | Nouvelle ; elle se termine en appuyant sur le bouton de la régie, déjà en place |
| 5 | Reach the studio | Plateau, par l'une des deux portes que le bouton a ouvertes | Remplace la sortie vers la zone de forage |
| 6 | Broadcast the message | Plateau, à la place du présentateur | Nouvelle ; cinématique de l'ultimatum |
| 7 | Get back to the drop point | Vers le sud | Nouvelle ; la police arrive en masse par les portails 4 (section 2 bis) |
| 8 | Too many of them. Take the north gate | Salon d'attente, dépose-minute, portails 3 | Remplace SallyBot ; fin du niveau |

Les consignes 7 et 8 sont une proposition de formulation pour le scénario décidé par l'utilisateur (section 2 bis). Le déroulé détaillé des consignes 4 à 8, avec les textes, est en section 10.

Les portes, les cartes et les boutons restent où ils sont : seules les consignes et la fin changent.

## 4. Script de l'introduction

Durée : environ 26 secondes, puis le déploiement. Écran en bandes de cinéma pendant toute la séquence. Les répliques s'écrivent lettre par lettre dans la boîte de dialogue, avec le portrait et le nom de celui qui parle. Le texte est celui accepté dans GD-077.

| Temps | Image | Son | Texte |
|---|---|---|---|
| 0,0 – 0,8 | Noir, les bandes se ferment. Ouverture sur le plateau. | Jingle du journal | — |
| 0,8 – 5,5 | **Plan 1, la régie et le plateau.** Vue du dessus, à cheval sur la baie vitrée : à gauche les techniciens de la régie devant leur rangée d'écrans, à droite le présentateur à son pupitre, trois caméras braquées sur lui. Un cadre « TvTv² LIVE » s'incruste en bas de l'écran, avec le portrait du présentateur. | Brouhaha de studio | ANCHOR : « ...a third drilling site destroyed this month. The 'Stand For Planet Earth' unit is now considered out of control. » |
| 5,5 – 9,0 | **Plan 2, le hall d'accueil.** Coupe franche. Les civils sont tournés vers les trois écrans, qui clignotent au rythme de la voix. Le cadre « TvTv² LIVE » reste à l'image. | À partir de 8,0 : un grondement de rotors monte | ANCHOR : « Authorities say there is no reason to panic. Stay with us on TvTv², right after th— » |
| 9,0 | L'image saute, le cadre « TvTv² LIVE » se couvre de neige et disparaît. | Grésillement | La réplique est coupée net. |
| 9,0 – 10,5 | **Plan 3, la sortie.** La caméra quitte le hall par le sud, passe au-dessus du sas et s'arrête sur le parvis. L'ombre du véhicule glisse sur le sol, puis le véhicule entre par la gauche. | Rotors de plus en plus forts | — |
| 10,5 – 19,0 | **Plan 4, la radio.** Le véhicule reste en vol au-dessus du parvis, les quatre robots repliés dans ses pinces. La pince de celui qui parle s'éclaire. | Rotors, léger filtre radio sur les voix | BADABOT : « They are talking about us. » — ENGIBOT : « Good. Then they will listen. » — PETBOT : « Objective: the control room. One message, on every screen. » — BATBOT : « And if they don't open the door? » — BADABOT : « We knock. » |
| 19,0 – 19,8 | Le véhicule descend, son ombre se resserre. | Rotors | — |
| 19,8 – 23,0 | **Le largage.** Posé. Un robot qui reste passe la main ; à la réponse, les pinces des robots joués s'ouvrent. | Claquement des pinces | Deux répliques, selon l'équipe (section 5) |
| 23,0 – 24,8 | Le véhicule remonte et sort par la droite avec les robots qui restent. | Rotors qui s'éloignent | — |
| 24,8 – 26,5 | Les robots se déploient. Les bandes s'ouvrent, la consigne s'affiche. | Sons de déploiement | Consigne : « Go to the upper floor » |

Pendant la séquence, le bâtiment vit normalement (rondes, civils qui circulent). Personne ne réagit au véhicule avant que les robots soient au sol. Le brouillard de la régie, du plateau et du hall d'accueil est levé le temps des plans 1 et 2, puis remis.

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

- **Lire et passer** (décidé, GD-079) : Espace passe à la réplique suivante, Espace tenu passe toute la séquence ; seul l'hôte le peut. Les durées du tableau de la section 4 ne valent donc plus pour les répliques : chacune reste à l'écran jusqu'à l'appui, et le véhicule attend.
- **À plusieurs** : le serveur tient l'horloge de la séquence ; tous les joueurs voient la même chose au même instant.
- **Une pince par robot** (proposé) : chaque robot a toujours la même pince, au lieu d'une pince par joueur comme aujourd'hui (GD-060).
- **Quand elle joue** (proposé) : au premier lancement du niveau. Après un « Retry » qui recommence le niveau depuis le début, seul le largage est rejoué (à partir de 19,0), sans le journal ni la radio. Jamais après un « Retry » au point de sauvegarde ni en commençant à l'étage.

## 7. Ce qu'il faut fabriquer

| Livraison | Contenu |
|---|---|
| **A. La radio et le largage** (plans 3 et 4, largage) — **livrée le 2026-11-17 (GD-078)** | Bandes de cinéma (sprite d'origine `spr_cine_bande`), boîte de dialogue lettre par lettre avec portrait (`spr_textBox` et portraits des robots, déjà dans le jeu), horloge de séquence dans la simulation, passage par l'hôte, vol stationnaire du véhicule, quatre robots dans les pinces, largage des seuls robots joués, répliques de la section 5 |
| **B. Le direct** (plans 1 et 2) — **livrée le 2026-11-17 (GD-080)**, puis reprise par GD-081 : vrai sprite pour le portrait, vraie pièce de studio | Un présentateur et son pupitre sur le plateau, trois caméras (sprite d'origine `spr_camera`), le cadre « TvTv² LIVE » et son logo, le portrait du présentateur, les écrans qui clignotent, la neige à la coupure, le jingle. Le présentateur, son portrait et le logo sont à dessiner. |
| **C. Le niveau** | Les consignes de la section 3, la fin du niveau, le retrait de la zone de forage et de SallyBot. Découpée en trois livraisons jouables, section 10.7 |

## 8. Les échos à préparer

- **À la fin de la mission** : les mêmes écrans, dans le hall et la régie, montrent les robots à la place du présentateur. Même cadre « TvTv² LIVE », même mise en page.
- **Dans SFHB** (acte III, « Les traces du passé ») : ce bâtiment peut être retrouvé abandonné. Le journal de l'introduction et l'ultimatum seraient les enregistrements que les robots y découvrent. Le cadre « TvTv² LIVE », le pupitre et la phrase « out of control » doivent donc rester reconnaissables.
- **Le journal parle de foreuses** : « a third drilling site destroyed » renvoie à la mission de l'acte I. Quand ce niveau existera, le joueur aura lui-même détruit ces foreuses.

## 9. Points à valider

Les points 3, 4 et 5 sont appliqués tels quels dans la première livraison (GD-078), comme choix par défaut : à confirmer ou corriger après essai.

1. Le plateau dans le hall de béton (moitié est de la pièce 29), la régie derrière la baie vitrée (moitié ouest), le décor devant l'alcôve.
2. Montrer la régie et le plateau, donc l'objectif et ses gardes, dès l'introduction.
3. Les répliques du largage et la voix prêtée à chaque robot.
4. Une pince fixe par robot.
5. Ne rejouer que le largage après un « Retry » depuis le début.
6. La suite d'objectifs de la section 3, au moins dans son principe.

## 10. Script de la fin de mission

> **Statut : proposition à valider par l'utilisateur** (2026-11-17). Le scénario est le sien (section 2 bis, GD-083) : message diffusé depuis la place du présentateur, 40 à 50 policiers par le sud, repli par le nord. Tout le reste ci-dessous — textes, déclencheurs, durées, composition de la vague — est proposé.

Ce que la fin doit faire comprendre, d'après l'arc narratif (acte II) : les robots ont parlé à toute la population ; ils ont laissé une dernière chance ; la réponse des humains est la force ; les robots s'échappent, et ils sont désormais une menace majeure. Elle ne dit toujours rien du virus ni de SFHB.

### 10.1 Vue d'ensemble

| Temps | Consigne | Ce que fait le joueur | Ce qui le déclenche | Forme |
|---|---|---|---|---|
| A | Take the control room | Il nettoie la régie et appuie sur le bouton | Retour au rez-de-chaussée avec la carte | Jeu, une réplique radio |
| B | Reach the studio | Il entre sur le plateau et va derrière le pupitre | Le bouton de la régie | Jeu |
| C | Broadcast the message | Il lit l'ultimatum | La moitié de l'équipe derrière le pupitre, compte à rebours | **Cinématique** |
| D | Get back to the drop point | Il part vers le sud | Fin de l'ultimatum | Jeu |
| E | Too many of them. Take the north gate | Il se replie vers le nord en combattant | Premier contact avec la vague | Jeu, deux répliques radio |
| F | Hold on. The gate is opening | Il tient devant le portail 3 | Le bouton du portail 3 | Jeu, une réplique radio |
| G | — | Il sort ; le véhicule le récupère | La moitié de l'équipe dehors | **Cinématique**, puis l'écran de fin |

Deux formes de texte :

- **Cinématique** : comme l'introduction (GD-079). Bandes de cinéma, le jeu s'arrête, Espace passe à la réplique suivante, Espace tenu passe tout, l'hôte seul le peut.
- **Radio en jeu** (nouveau) : la boîte de dialogue en petit format, en bas de l'écran, avec portrait et nom. Le jeu continue, la réplique s'efface seule après 4 secondes. Elle sert quand on se bat : on ne fige pas un combat pour une phrase.

### 10.2 A et B — la régie, puis le plateau

- **Consigne 4, « Take the control room ».** Elle s'affiche au retour au rez-de-chaussée, à la place de « Exit to the drilling area ». Elle se termine quand un robot appuie sur le bouton de la régie (le bouton n° 2 du niveau d'origine).
- **Au bouton** : les deux portes de l'aile est s'ouvrent, comme aujourd'hui — celle du salon d'attente au nord, celle du salon de sortie au sud ; chaque salon donne sur le plateau par une porte automatique. L'enseigne « ON AIR » du plateau s'éteint (le direct est coupé), les écrans de la régie et du hall passent à la neige. Radio en jeu, dite par le robot qui a appuyé : « Control room secured. The way to the studio is open. »
- **Consigne 5, « Reach the studio ».** Une marque au sol s'allume derrière le pupitre, à la place du présentateur. Le présentateur est un civil comme les autres : quand les robots entrent, il fuit.
- **Passage à la consigne 6** : dès qu'un robot entre sur le plateau, la consigne devient « Broadcast the message ».
- **Le déclencheur** reprend la règle de la sortie de niveau d'aujourd'hui : il faut la moitié de l'équipe, vivante, sur la marque ; un compte à rebours de 3 secondes s'affiche (« ON AIR IN 3… 2… 1… ») ; si l'on quitte la marque, il s'annule.

### 10.3 C — l'ultimatum (cinématique)

C'est le miroir de l'introduction : mêmes plans, même cadre « TvTv² LIVE », mais les robots ont pris la place du présentateur (écho prévu en section 8).

**Qui parle.** Le robot debout à la place du présentateur ; s'ils sont plusieurs sur la marque, le premier de la liste BadaBot, BatBot, PetBot, EngiBot (la même que pour le largage). Son portrait remplace celui du présentateur dans le cadre. **Le texte est le même quel que soit le robot** : l'unité parle d'une seule voix et dit « we ». C'est voulu : ces machines récitent la cause pour laquelle on les a programmées (thème central de l'arc, section 6).

| Temps | Image | Son | Texte |
|---|---|---|---|
| 0,0 – 1,0 | Les bandes se ferment. L'enseigne « ON AIR » se rallume. Les caméras du plateau pivotent vers le pupitre. | Le jingle du journal, déformé, plus grave | — |
| Répliques 1 à 3 | **Plan 1, le plateau.** Le même cadrage que le plan 1 de l'introduction : la régie à gauche, le robot derrière le pupitre à droite, sous les projecteurs. Les autres robots de l'équipe sont à ses côtés. Cadre « TvTv² LIVE » avec le portrait du robot. | Silence de studio | 1. « People of Earth. This is the Stand For Planet Earth unit. » — 2. « You built us to protect this planet. We did. You answered with guns. » — 3. « They told you we are out of control. We are exactly what you made us. » |
| Répliques 4 à 6 | **Plan 2, le hall d'accueil.** Coupe franche. Les trois écrans du hall brillent, le robot y a remplacé le présentateur. Le hall est dans l'état où les joueurs l'ont laissé. | Idem ; à la réplique 6, des sirènes montent au loin | 4. « Your laws have failed. The forests burn, the seas choke, and you keep drilling. » — 5. « So hear this. Everything that harms this planet stops. Today. » — 6. « This is your last chance to change. There will be no second message. » |
| Réplique 7 | Retour au **plan 1**, plus serré sur le pupitre. | Sirènes plus proches | 7. « Stand for planet Earth. Or we will stand for it without you. » |
| Coupure | L'image saute, le cadre « TvTv² LIVE » se couvre de neige et disparaît : on a coupé l'antenne. L'enseigne « ON AIR » s'éteint. | Grésillement, puis les sirènes seules | — |
| Réplique 8 | Le plateau, sans cadre. Boîte de dialogue normale, voix radio. | Sirènes | Celui qui est resté dans le véhicule (règle ci-dessous) : « Message is out, on every screen. Pick-up at the drop point, as planned. » |
| Fin | Les bandes s'ouvrent. | — | Consigne : « Get back to the drop point » |

Notes sur le texte :

- La réplique 3 répond au présentateur de l'introduction (« out of control ») ; la 4 renvoie aux foreuses de l'acte I.
- La réplique 7 détourne le nom de l'unité. La menace reste voilée : on ne dit pas ce que « without you » veut dire. C'est la phrase à retrouver dans SFHB, sur un enregistrement (section 8).
- L'introduction coupait le présentateur au milieu d'un mot ; ici les robots finissent leur message, et c'est l'antenne qu'on leur coupe après.

**La voix du véhicule** (réplique 8 et radio des temps E et F) : parmi les robots restés à bord, le premier de la liste EngiBot, PetBot, BatBot, BadaBot (la règle du largage). Si les quatre robots sont joués, personne n'est à bord : c'est BadaBot, au sol, qui le dit. Le texte est le même pour tous.

**Pendant la cinématique** : comme pendant le journal de l'introduction, plus personne ne bouge ni ne tire dans le niveau, et le brouillard du plateau et du hall est levé. Un point de sauvegarde est posé à la fin : après un échec, « Retry » ramène sur le plateau juste après le message, sans le rejouer.

### 10.4 D et E — le sud, puis le changement de plan

**Ce que le joueur ne voit pas.** Pendant l'ultimatum, les portails 4 se sont ouverts et les fourgons sont entrés sur le parking sud. Aucun plan ne le montre : on entend seulement les sirènes. La surprise voulue par le scénario (« ils tombent nez à nez avec cette armée ») est gardée pour le jeu.

**La vague** (proposé ; les nombres iront dans `config.ts`) :

| Moment | Qui | D'où |
|---|---|---|
| À la fin de l'ultimatum | 15 policiers, répartis sur le parking sud | Déjà à pied devant trois fourgons garés |
| + 6 secondes | 15 de plus : 10 policiers, 3 robots boucliers, 2 robots fusils à pompe | Par les portails 4 |
| + 12 secondes | 15 de plus : 8 policiers, 4 robots légers, 3 robots boucliers | Par les portails 4 |
| Ensuite, tant que l'équipe n'est pas sortie | 6 renforts toutes les 10 secondes, sans dépasser 45 ennemis vivants à la fois | Par les portails 4 |

- **Leur trajet** : le parking sud, les deux portes du local technique, le salon de sortie, la porte sud du plateau. Leur point de ralliement est le pupitre ; dès qu'ils voient un robot, ils se battent comme les autres soldats.
- **Pourquoi des renforts sans fin** : la consigne dit « ils sont trop nombreux ». Si le joueur pouvait tuer les 45 et sortir par le sud, la consigne mentirait. Le sud ne se vide donc jamais, et il n'y a pas de sortie de ce côté.
- **Les gardes encore vivants ailleurs dans le bâtiment** ne changent pas de comportement.

**Consigne 7, « Get back to the drop point ».** Elle envoie vers la porte sud du plateau. Elle ne dure que quelques secondes : c'est une fausse piste voulue.

**Le changement de plan** se déclenche au premier de ces événements : un robot entre dans le salon de sortie ; un ennemi de la vague entre sur le plateau ; 15 secondes ont passé depuis la fin de l'ultimatum. Radio en jeu, deux répliques à la suite :

- La voix du véhicule : « The south side is crawling with them. Forty, maybe fifty. Forget the drop point. »
- Un robot au sol (le premier de la liste BadaBot, BatBot, PetBot, EngiBot ; un autre que la voix du véhicule si possible) : « Then we leave through the north gate. »

Consigne 8 : « Too many of them. Take the north gate ». Le trajet : la porte nord du plateau, le salon d'attente, le dépose-minute, le bouton du portail 3.

### 10.5 F — tenir devant le portail

- **Au bouton du portail 3** : les deux battants s'ouvrent lentement, en 10 secondes au lieu d'une. Radio en jeu, la voix du véhicule : « Gate is opening. We are coming for you. Hold on. »
- **Consigne** : « Hold on. The gate is opening ».
- C'est le dernier combat du niveau : l'équipe est dos au portail, la vague arrive par le salon d'attente et par la porte du parking. Il remplace le duel contre SallyBot.
- Le nord reste libre : aucun ennemi n'arrive par les portails 3.

### 10.6 G — la récupération (cinématique)

**Le déclencheur** : la moitié de l'équipe, vivante, dans la zone de sortie, juste derrière les portails 3. Pas de compte à rebours cette fois : on ne fait pas attendre sous le feu. (Dans le niveau d'origine, la zone de sortie est déjà au nord, dehors, mais 2000 px plus à l'ouest le long de la façade, avec 10 secondes d'attente : elle est rapprochée du portail.)

| Temps | Image | Son | Texte |
|---|---|---|---|
| 0,0 – 1,0 | Les bandes se ferment. Les robots et leurs poursuivants se figent. | Rotors qui arrivent vite | — |
| 1,0 – 3,5 | Le véhicule entre par le nord, descend, ses pinces saisissent les robots, qui se replient (l'animation de déploiement à l'envers). Les robots à terre sont emportés aussi. | Claquement des pinces | — |
| 3,5 – 6,0 | Le véhicule remonte et s'éloigne vers le nord. La caméra reste sur le portail : les policiers débouchent sur le dépose-minute, trop tard, et tirent en l'air. | Rotors qui s'éloignent, tirs | — |
| Répliques 1 et 2 | Fondu vers le plan 2 de l'introduction : le hall d'accueil et ses écrans. Bandeau rouge « TvTv² — EMERGENCY BROADCAST », sans portrait. | Bip d'alerte | 1. « This is an emergency broadcast. » — 2. « The 'Stand For Planet Earth' unit is now considered a major threat to mankind. All forces are authorized to destroy it on sight. » |
| Répliques 3 à 5 | Noir. La boîte de dialogue seule, voix radio, comme dans l'introduction. | Rotors lointains | BATBOT : « Did they listen? » — ENGIBOT : « They heard. » — BADABOT : « Now we wait and see what they do with it. » |
| Fin | L'écran de fin de niveau (statistiques), déjà en place. | — | — |

Notes :

- La réplique 2 répond mot pour mot à la première phrase du jeu : « is now considered out of control » devient « is now considered a major threat to mankind ». C'est le changement de statut de l'acte II.
- Le bandeau d'urgence n'a pas de portrait : la séquence ne dépend pas du sort du présentateur.
- Les trois dernières répliques sont dites par des robots fixes, comme la radio de l'introduction : à ce moment les quatre sont à bord, quelle que soit l'équipe. PetBot, qui a donné l'objectif à l'aller, se tait.
- « They heard » n'est pas « they listened » : c'est la porte ouverte sur l'acte III, où l'ultimatum n'a rien changé.

### 10.7 Ce qu'il faut fabriquer

Trois livraisons jouables, à essayer l'une après l'autre.

| Livraison | Contenu | Ce que l'on peut jouer à la fin |
|---|---|---|
| **C1. Jusqu'au message** | Consignes 2, 4, 5 et 6 ; effets du bouton de la régie ; marque derrière le pupitre et compte à rebours ; cinématique de l'ultimatum (répliques 1 à 8) ; radio en jeu ; point de sauvegarde sur le plateau | Du largage jusqu'à la fin de l'ultimatum |
| **C2. La vague** | Arrivée de la police par les portails 4, trajet vers le plateau, renforts, consignes 7 et 8, les deux répliques du changement de plan ; fourgons de police garés sur le parking sud | Le repli jusqu'au dépose-minute |
| **C3. La sortie** | Ouverture lente du portail 3, consigne « Hold on », zone de sortie, cinématique de récupération, écran de fin. La zone de forage et SallyBot quittent ce niveau : leur salle reste dans le dépôt pour l'acte I, mais on n'y accède plus d'ici | Le niveau entier |

À dessiner ou à fabriquer : le bandeau « EMERGENCY BROADCAST », la marque au sol derrière le pupitre, un fourgon de police à la bonne taille (ceux d'origine étaient géants et ont été retirés des quais), les sirènes, le jingle déformé.

### 10.8 Points à valider

1. **Le texte de l'ultimatum** (répliques 1 à 7), et le fait qu'il soit le même quel que soit le robot qui le lit.
2. **Qui le lit** : le robot à la place du présentateur. L'autre possibilité : les quatre robots se partagent les phrases, ceux du véhicule par radio.
3. **Ne pas montrer l'arrivée des fourgons** pour garder la surprise. L'autre possibilité : un plan du parking sud à la fin de l'ultimatum, plus spectaculaire, mais le joueur sait alors avant ses robots.
4. **Des renforts sans fin au sud**, pour que « trop nombreux » soit vrai.
5. **Le portail 3 qui s'ouvre en 10 secondes**, pour un dernier combat dos au mur ; et rien qui arrive par le nord.
6. **La radio en jeu** qui ne fige pas l'action, en plus des cinématiques.
7. **La fin** : le communiqué d'urgence, puis les trois répliques des robots.
8. **Le point de sauvegarde** après l'ultimatum.
