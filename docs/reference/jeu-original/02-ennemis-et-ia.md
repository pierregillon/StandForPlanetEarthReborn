# 02 — Ennemis, PNJ et IA (spécification tirée du code source, version janvier 2019)

Source analysée (lecture seule) : projet GMS2 `v2019/Stand-For-Planet-Earth` (dossiers `objects/`, `scripts/`, `rooms/`, `notes/`).
Les chemins entre parenthèses sont relatifs à cette racine. `objects/X/Create_0.gml` = événement Create, `Step_0` = Step, `Step_1` = Begin Step, `Step_2` = End Step, `Alarm_N` = alarme N, `Other_4` = Room Start, `.yy` = définition de l'objet (parent, « Variable Definitions », surcharges).

## Conventions et constantes globales

| Élément | Valeur | Source |
|---|---|---|
| `room_speed` (pas de jeu) | **60 steps/s** | Aucune affectation de `room_speed` dans le GML ; `options/main/options_main.yy` est **absent** de l'extrait. Seule trace : `notes/compatibility_report_250417_1810181018.txt` ligne 111 « game speed set to 60 » (import GMS1 → GMS2). La version GMX 2017 a aussi `<speed>60</speed>` dans ses 21 salles. |
| Unités de vitesse | pixels **par step** (×60 pour px/s) | usage de `speed`, `mp_potential_step` |
| Durées | exprimées en secondes × `room_speed` dans le code | — |
| `scripts/macros/macros.gml` | ne contient **que** des identifiants de messages réseau (dont `C_NPC_MOVE_MESSAGE 10`, `C_NPC_DESTROY_MESSAGE 11`). Aucune constante de gameplay. | `scripts/macros/macros.gml` |
| Vitesse de marche d'un héros (repère) | `walkingMaxSpd = 10` px/step | `objects/obj_localPlayer/obj_localPlayer.yy` |
| Sprites | le dossier `sprites/` est **absent** de l'extrait : nombre d'images, tailles et masques de collision = **non trouvé** (indicatif, version GMX 2017 : `spr_npc1_*` et `spr_npc2_*` font 154×154 px ; `spr_npc1_shot` 7 images, `spr_npc2_shot` 8 images, `spr_npc2_bullet` 2 images). |

Particularité GameMaker utilisée partout par l'IA : une alarme réglée à N décompte, déclenche son événement en arrivant à 0, **vaut 0 pendant ce step**, puis −1 au step suivant. Les tests `alarm[n] == -1` (« libre ») et `alarm[n] > 0` (« en cours ») du code reposent là-dessus (le cas `== 0` sert de « vient de finir »). Les événements d'alarme vides (un simple commentaire) existent uniquement pour que GameMaker décompte ces alarmes.

Hypothèse de lecture : les « Variable Definitions » du type `2*normalSpd` sont évaluées à la création de l'instance avec la valeur surchargée de `normalSpd` de l'objet enfant (comportement standard GMS2, non vérifiable sans exécuter).

---

## 1. Hiérarchie et caractéristiques des PNJ

### 1.1 Arbre d'héritage

```
obj_localNpc                       (parent commun, solide)
├── obj_localNpc_soldier           (IA de combat)
│   ├── obj_npc_human_pistol
│   ├── obj_npc_robot_shield
│   ├── obj_npc_robot_lightBot
│   ├── obj_npc_robot_shotBot
│   └── obj_sallyBot               (boss, voir §6)
└── obj_localNpc_civil             (IA de fuite)
    ├── obj_npc_civil_femme
    ├── obj_npc_civil_handi
    ├── obj_npc_civil_malette
    ├── obj_npc_civil_ouvrier      (0 instance placée)
    ├── obj_npc_civil_scientifique (0 instance placée)
    └── obj_npc_civil_technicien
obj_npc_mort                       (cadavre/effet de mort, sans parent)
```

### 1.2 `obj_localNpc` — valeurs par défaut (`objects/obj_localNpc/obj_localNpc.yy`, `Create_0.gml`)

| Variable | Défaut | Rôle |
|---|---|---|
| `normalSpd` | 5 | vitesse « standard » ; copiée dans `spd`. `spd != 0` ⇒ le PNJ patrouille, `spd == 0` ⇒ il attend (`scripts/src_getDefaultNpcBehaviour`) |
| `maxHealth` | 5 | PV (`currentHealth = maxHealth`) |
| `hearRange` | 1000 px | portée d'ouïe |
| `viewRange` | 800 px | portée de vue (portée à 1600 px pour un soldat qui a repéré un héros, §3.2) |
| `genre` | `"humain"` | `"humain"` ou `"robot"` : choisit débris et flaques à la mort |
| `patrolRange` | 1500 px | distance max d'un point de patrouille aléatoire |
| `patrolPauseTime` | 2 s | pause de base entre deux patrouilles |
| `patrolSpeed` | **5 px/step** | vitesse de patrouille — **indépendante de `normalSpd`** et surchargée par aucun enfant : tous les PNJ patrouillent à 5 px/step |
| `patrolType` | `"random"` | `"random"`, `"points"` ou `"none"` |
| `activationRange` | 4000 px | le PNJ reste inactif tant que `distance_to_object(obj_localPlayer) > 4000` ; une fois actif il le reste (`Step_1.gml`) |
| `invulnerable` | false | utilisé seulement par le boss |
| `maxTimeToReachNextPosition` | 1 s | délai max pour atteindre le point suivant d'un chemin |
| `maxFailedAttemptToReachPointInPath` | 2 | nombre d'échecs avant abandon du chemin |
| `distanceWherePointConsideredReached` | `sprite_width / 4` | rayon d'arrivée sur un point de chemin |
| `state` initial / `behaviour` initial | `"standing"` / `"waiting"` | |
| `solid` | true | les PNJ ne se superposent pas ; `mp_potential_step` les contourne |
| `size` | 2 | utilisé par le système d'ombres/lumière uniquement |

Boucle (`objects/obj_localNpc/Step_0.gml`, `Step_1.gml`, `Step_2.gml`) :
- Begin Step : activation par distance (4000 px).
- Step : si `global.gamePaused` ⇒ `state = "standing"` ; sinon si actif ⇒ `scr_setNPCBehaviourActions()` (patrouille / attente / mort, §3.6).
- End Step : `sprite_index` et `image_speed` pris dans deux tables indexées par `state`.

### 1.3 `obj_localNpc_soldier` — valeurs par défaut (`objects/obj_localNpc_soldier/obj_localNpc_soldier.yy`, `Create_0.gml`)

| Variable | Défaut | Rôle |
|---|---|---|
| `spdChase` | `2*normalSpd` | vitesse de poursuite |
| `attack_range_min` / `attack_range_max` | 200 / 400 px | `attack_range = irandom_range(min, max)` tiré **une fois à la création** |
| `shot1_bullet_count` | 1 | projectiles par tir |
| `shot1PerSecMax` | 12 | tirs/s (`shot1PerSec = shot1PerSecMax`) |
| `shot1_bullet_type` | `obj_bulletNPC` | objet projectile |
| `amoQuantity` | 10 | taille du chargeur |
| `precision` | 3 | dispersion : angle de tir = `image_angle ± random(precision)` degrés (`scripts/scr_createAndSendNewBullet`) |
| `canReload` | true | si false, les munitions ne sont jamais décomptées ⇒ **tir illimité, jamais de rechargement** |
| `reloadingTime` | 2 s | durée du rechargement |
| `fire1Sound` | `snd_pistolBot_fire1` | son joué **une fois par projectile** |
| `reactionTime` | 0,8 s | durée de l'état « surpris » |
| `relativeBoutCanonX/Y` | 185 / −4 | décalage de la bouche du canon (repère du sprite) |

### 1.4 Tableau des ennemis (valeurs effectives = défauts + surcharges de chaque `.yy`)

Vitesses en px/step (px/s à 60 steps/s entre parenthèses).

| | `obj_npc_human_pistol` | `obj_npc_robot_shield` | `obj_npc_robot_lightBot` | `obj_npc_robot_shotBot` |
|---|---|---|---|---|
| Genre | humain | robot | robot | robot |
| PV (`maxHealth`) | **1** | **3** | **2** | **2** |
| `normalSpd` | 5 | 3 | 7 | 3 |
| Patrouille (`patrolSpeed`) | 5 (300) | 5 (300) | 5 (300) | 5 (300) |
| Poursuite (`spdChase = 2*normalSpd`) | 10 (600) | 6 (360) | 14 (840) | 6 (360) |
| Vue / vue alertée / ouïe | 800 / 1600 / 1000 | idem | idem | idem |
| Portée d'attaque (tirée à la création) | 600–950 | 150 (fixe) | 800–950 | 600–950 |
| Cadence (`shot1PerSecMax`) | 3 tirs/s (alarme 20 steps) | 1 coup/s (60 steps) | 10 tirs/s (6 steps) | 1 tir/s (60 steps) |
| Projectiles par tir | 1 | 1 (zone de mêlée) | 1 | **10** |
| Précision (± degrés) | 3 | 3 | 10 | 10 |
| Chargeur (`amoQuantity`) | 16 | 25 (inutilisé) | 13 (inutilisé) | 10 (inutilisé) |
| Rechargement | **oui, 0,7 s** tous les 16 tirs | non (`canReload = False`) | non | non |
| Projectile | `obj_bullet_pistol` | `obj_bullet_robot_shield` | `obj_bullet_lightBot` | `obj_bullet_shotgun` |
| Son de tir | `snd_pistolBot_fire1` | aucun (`noone`) | `snd_pistolBot_fire1` | `snd_pistolBot_fire1` (joué 10 fois par tir) |
| Bouche du canon (X, Y) | 82, 7 | 73, 0 | 79, 24 (`134-55`, `106-82`) | 79, −35 (`161-82`, `63-98`) |
| Sprite de mort | `spr_npc1_mort` | `spr_npc2_mort` | **`spr_npc1_mort`** (sprite de l'humain) | `spr_npc_shotBot_mort` |
| Particularité | seul ennemi qui recharge | bouclier frontal : ne prend des dégâts que par l'arrière (§8) ; attaque de mêlée qui repousse | rapide, rafale continue imprécise | tir en gerbe |

Sources : `objects/obj_npc_human_pistol/obj_npc_human_pistol.yy` + `Create_0.gml`, idem pour `obj_npc_robot_shield`, `obj_npc_robot_lightBot`, `obj_npc_robot_shotBot` ; sprites de mort dans `scripts/scr_setDeathSpriteToNpc`.

Remarques :
- Le `Create_0.gml` de chaque ennemi remplit seulement les tables état → sprite / vitesse d'animation. États utilisés : `standing`, `walking`, `chasing`, `firing`, `delay_firing`, `reloading` (une entrée `dashing` existe mais aucun code ne met un PNJ dans cet état).
- `obj_npc_robot_shield` et `obj_npc_robot_lightBot` n'ont **pas** d'entrée `reloading` (commentée) : sans conséquence puisqu'ils ne rechargent jamais.
- `obj_npc_robot_shotBot` utilise `spr_npc1_reload` (sprite de l'humain) pour `reloading`, jamais affiché.
- Les appels `scr_createLightCollisionCircle(...)` sont **commentés** dans tous les PNJ.
- Animation de tir : `scr_setFireImageSpeed(sprite, shot1PerSec)` règle l'animation à (nombre d'images × tirs/s) images/s, soit une animation complète par tir. Animation de marche : `scr_setMoveImageSpeed(sprite, normalSpd, 128)` (foulée de 128 px).
- Le soldat tourne son sprite vers `direction` avec une friction de 5°/step (`objects/obj_localNpc_soldier/Step_2.gml`, `scripts/scr_setCharacterImageAngleWithFriction`). Défaut du script : pour un écart compris entre 5° et 10°, aucune rotation n'est appliquée (zone morte).

### 1.5 Civils (`objects/obj_localNpc_civil/obj_localNpc_civil.yy`, `Create_0.gml`, `Alarm_3.gml`)

| Variable | Valeur |
|---|---|
| `maxHealth` | **1** (surcharge de `obj_localNpc`) |
| `normalSpd` | 3 (surchargé dans les 6 objets civils) |
| Patrouille | 5 px/step (`patrolSpeed` par défaut — donc plus rapide que `normalSpd`) |
| `fearSpeed` | `2*normalSpd` = **6 px/step** |
| `fearDuration` | **30 s** |
| Vue / ouïe | 800 / 1000 px (défauts) |

Les six civils (`obj_npc_civil_femme`, `_handi`, `_malette`, `_ouvrier`, `_scientifique`, `_technicien`) ne diffèrent **que par leurs sprites** :

| Civil | Marche | Course | Vitesse d'animation de course | Mort |
|---|---|---|---|---|
| femme | `spr_npc_femme_move` | même sprite | 2 | `spr_npc_femme_mort` |
| handi | `spr_npc_handi_move` | même sprite | 2 | `spr_npc_handi_mort` |
| malette | `spr_npc_valise` | `spr_npc_valise_course` | 1 | `spr_npc_valise_mort` |
| ouvrier | `spr_npc_ouvrier_marche` | `spr_npc_ouvrier_cours` | 1 | `spr_npc_ouvier_mort` (sic) |
| scientifique | `spr_npc_scientifique_marche` | `spr_npc_scientifique_cours` | 1 | `spr_npc_scientifique_mort` |
| technicien | `spr_npc_techni_move` | `spr_npc_techni_course` | 1 | `spr_npc_techni_mort` |

États : `standing`, `walking`, `running`, `hide`. **`hide` n'est jamais utilisé** (inachevé).

### 1.6 `obj_npc_mort`

Objet d'effet créé à la mort de tout PNJ ; détaillé au §7.

---

## 2. Projectiles ennemis

### 2.1 `obj_bullet_base` (`objects/obj_bullet_base/obj_bullet_base.yy`, `Create_0.gml`, `Step_0.gml`, `Step_1.gml`, `Destroy_0.gml`)

| Propriété | Défaut |
|---|---|
| `speed` | **40 px/step** (2400 px/s) |
| `maxDistance` | **1500 px** depuis le point de création, puis destruction (≈ 37 steps ≈ 0,63 s) |
| `damage` | **1** |
| `explosive` | false (`explosionDamage` 20, `explosionRange` 374, `explosionObject` `obj_bullet2_explosion` — non utilisés par les projectiles ennemis) |
| `owner` | `"ennemi"` ou `"hero"` (fixé par `scr_createAndSendNewBullet`) |

Chaque step (`Step_0.gml`), dans cet ordre :
1. distance parcourue > `maxDistance` ⇒ destruction ;
2. contact avec un `obj_decor_base` (murs, portes, mobilier) ⇒ `scr_bulletCollisionActionWithMurParent` : mur ou porte ⇒ balle détruite avec particules ; **fenêtre (`obj_fenetre`) ⇒ la vitre casse (`hp` 1 → 0) et la balle continue** ;
3. contact avec le mobilier « sur la trajectoire » ⇒ balle détruite. Ce mobilier est pré-calculé une fois au Begin Step : le meuble le plus proche sur la ligne de tir dont `bulletCrossed == false` (`scripts/scr_getMobilierOnTheWayOfBullet`). Les meubles `bulletCrossed == true` laissent passer les balles ;
4. contact avec un `obj_localNpc` ⇒ `scr_bulletCollisionActionWithLocalNpc` : **sans effet si `owner != "hero"`** (pas de tir ami entre ennemis, la balle traverse les PNJ) ;
5. contact avec un `obj_localPlayer` ⇒ `scr_bulletCollisionActionWithLocalPlayer` (ci-dessous).

Collision avec `obj_BadaBot_shield` (événement de collision de `obj_bullet_base`) : une balle `"ennemi"` est détruite et incrémente `bulletTanked` du bouclier.

Dégâts à un héros (`scripts/scr_bulletCollisionActionWithLocalPlayer`), seulement si `owner == "ennemi"` :
- la balle est **toujours détruite** au contact d'un héros ;
- les dégâts (`currentHealth -= damage`) ne s'appliquent que si `glitch == noone` **et** `deployed != false` **et** `currentHealth > 0` **et** `bonusInvincible == false` ;
- un `obj_glitch` est alors créé sur le héros : tant qu'il existe, le héros ne prend plus de dégâts. Durée : `irandom_range(10, 40)` steps (`objects/obj_glitch/obj_glitch.yy` : `minGlitchDuration` 10, `maxGlitchDuration` 40) ;
- `obj_score.totalDamageTaken += damage`.

Conséquence chiffrée : les 10 plombs du shotBot ou la rafale du lightBot (1 balle toutes les 6 steps) n'infligent au mieux **1 dégât par fenêtre de 10 à 40 steps** ; les balles suivantes sont absorbées sans effet.

### 2.2 Tableau des projectiles ennemis

| Objet | Parent | Sprite | Vitesse | Portée | Dégâts | Effet | Source |
|---|---|---|---|---|---|---|---|
| `obj_bulletNPC` | `obj_bullet_base` | `spr_bullet1` | 40 | 1500 | 1 | aucun ; type par défaut de `obj_localNpc_soldier`. **Aucun ennemi ne le tire** : les quatre ennemis le remplacent, et le boss, qui le garde par défaut, ne tire pas | `.yy` sans surcharge ni événement |
| `obj_bullet_pistol` | `obj_bullet_base` | `spr_bullet_pistol` | 40 | 1500 | 1 | aucun | idem |
| `obj_bullet_shotgun` | `obj_bullet_base` | `spr_bullet_shotgun` | 40 | 1500 | 1 par plomb | aucun (10 plombs à ±10°) | idem |
| `obj_bullet_lightBot` | `obj_bullet_base` | `spr_bullet_lightBot` | 40 | 1500 | 1 | aucun | idem |
| `obj_bullet_robot_shield` | `obj_bullet_base` | `spr_npc2_bullet` (invisible) | **0** | sans objet | 1 | zone de mêlée + **repoussement** | `.yy`, `Create_0.gml`, `Step_0.gml`, collision avec `obj_localPlayer` |

Les quatre premiers sont strictement identiques hors sprite.

### 2.3 `obj_bullet_robot_shield` (coup de bouclier)

- Créé à la bouche du canon (73, 0) à chaque « tir » du robot bouclier, immobile, invisible ; `bumpSpeed = 15`.
- Détruit quand son animation atteint sa dernière image **ou** dès que le tireur n'est plus en état `firing`/`delay_firing` (`Step_0.gml`).
- Collision avec un héros (événement de collision), si le héros n'est pas déjà repoussé (`bump == false`) :
  - annule son dash (`dashing = false`) ;
  - cible de repoussement = position du héros + **350 px** dans la direction `image_angle` de la zone ;
  - s'il n'y a pas de décor à 15 px dans cette direction : `move_towards_point(cible, 15)` et `bump = true` (le héros glisse à **15 px/step**, soit ≈ 23 steps) ; sinon pas de repoussement ;
  - `currentHealth -= 1` si `currentHealth > 0` et pas `bonusInvincible` (**ne teste ni `glitch` ni `deployed`**) ;
  - puis la zone est détruite.
- Fin du repoussement côté héros (`scripts/scr_bumpCheck`) : à moins de 2 px de la cible, ou en atteignant le bord de la caméra.
- **Ambigu / probablement bogué** : le Step hérité de `obj_bullet_base` s'exécute avant l'événement de collision ; s'il détecte déjà le héros, il applique 1 dégât « classique » (avec test du glitch) et détruit la zone **sans repoussement**. De même la zone est détruite si elle touche un mur. Selon l'ordre des événements, le joueur subit donc soit « 1 dégât + repoussement », soit « 1 dégât sans repoussement ». À trancher pour le remake (intention manifeste : 1 dégât + repoussement de 350 px).

### 2.4 `obj_dot` et `scr_giveDotTo` — **code mort**

- `scripts/scr_giveDotTo` crée un `obj_dot` attaché à une cible en recopiant `damagePerTic`, `moveSpeedDividor`, `attackSpeedDividor`, `numberOfTic` du projectile.
- `objects/obj_dot` : un tic par seconde (`ticDuration = 1*room_speed`), premier tic 1 step après création. Premier tic : dégâts + division de `spd`, `patrolSpeed` et (soldats) `shot1PerSec`. Tics suivants : dégâts seuls. À la fin : valeurs re-multipliées et plafonnées (`spd ≤ normalSpd`, `patrolSpeed ≤ 2*normalSpd`, `shot1PerSec ≤ shot1PerSecMax`).
- **Jamais actif** : `createDot` vaut `false` dans `obj_bullet_base/Create_0.gml` et n'est mis à `true` nulle part ; toutes les valeurs de DOT valent 0. De plus l'appel `scr_giveDotTo(other.id)` dans `scr_bulletCollisionActionWithLocalNpc` passe `other` (hors `with`), ce qui ne désigne pas le PNJ touché : bogue latent. Les diviseurs à 0 provoqueraient aussi une division par zéro.

---

## 3. Machine à états de l'IA soldat

### 3.1 Boucle (`objects/obj_localNpc_soldier/Step_0.gml`, `scripts/scr_setSoldierNPCBehaviourActions`)

Chaque step, si le jeu n'est pas en pause et que le PNJ est actif :
1. `ennemy = scr_getTargetEnnemy(id, obj_localPlayer)` (commentaire du code : « provoque freeze ») ;
2. si une cible existe : `behaviour = scr_getSoldierNPCBehaviour(id, ennemy)` ; sinon `behaviour = noone` ;
3. `"chase"` ⇒ `scr_chaseHero`, `"attack"` ⇒ `scr_attackHero`, `"surprised"` ⇒ `scr_surprised` ;
4. si `behaviour == noone` ⇒ comportement parent (patrouille / attente / mort, §3.6).

Deux variables distinctes : `behaviour` (décision : `noone`, `surprised`, `chase`, `attack`, puis `walking`/`waiting`/`dead` côté parent) et `state` (animation : `standing`, `walking`, `chasing`, `firing`, `delay_firing`, `reloading`).

### 3.2 Choix de la cible (`scripts/scr_getTargetEnnemy`)

1. Si `ennemySpotted` (une cible existait au step précédent) : `viewRange = 1600`, puis recherche du héros visible le plus proche. Aucun ⇒ `ennemySpotted = false` et **retour `noone` immédiat** (l'ouïe n'est pas consultée ce step-là).
2. Sinon : héros visible le plus proche (`scr_getTheNearestVisibleEnnemy`).
3. À défaut : héros **entendu** le plus proche (`scr_getTheNearestHeardEnnemy`).
4. `ennemySpotted = (cible != noone)` ; si aucune cible, `viewRange = 800`.

Vue (`scripts/scr_getTheNearestVisibleEnnemy`) — un héros est visible si :
- son `state != "dead"` ;
- la ligne PNJ → héros ne croise **aucun `obj_mur_parent`** (boîte englobante ; inclut les fenêtres `obj_fenetre`, même cassées) **ni aucune porte `obj_door_parent`** (collision précise) (`scripts/scr_isCollidingWithRoom`) ;
- `point_distance ≤ viewRange` (800, ou 1600 une fois repéré).
- **Pas de cône de vision** : détection à 360°. Le mobilier ne bloque pas la vue.

Ouïe (`scripts/scr_getTheNearestHeardEnnemy`) — un héros est entendu si :
- son `state` vaut `"firing1"` ou `"firing2"` (il est en train de tirer) ;
- `point_distance ≤ hearRange` (1000) ;
- pas de **mur épais** entre les deux (`scripts/scr_collideLineWithLargeWall`). Les murs fins et les portes ne bloquent pas le son. Imprécision du script : il ne teste qu'**un seul** mur renvoyé par `collision_line` (arbitraire) et regarde si son nom commence par `obj_mur_epais` ; s'il n'existe aucun `obj_mur_epais` dans la salle, rien ne bloque le son.

`scripts/scr_getTheNearestHeardSoldierAttacking` (soldat en `behaviour == "attack"` à portée d'ouïe, sans mur épais) n'est **pas utilisé par les soldats** : seulement par les civils (§4). Les soldats ne s'alertent donc pas entre eux.

### 3.3 Transitions (`scripts/scr_getSoldierNPCBehaviour`)

Évaluées dans cet ordre, une cible étant connue :

| # | Condition | Résultat |
|---|---|---|
| 1 | `currentHealth <= 0` | `noone` (⇒ mort via le parent) |
| 2 | premier contact (`behaviour` précédent ∉ {chase, attack, surprised}) **ou** `alarm[6] != -1` | `"surprised"` |
| 3 | pas de ligne de vue (mur ou porte) | `"chase"` |
| 4 | attaquait déjà **et** distance ≤ `attack_range` | `"attack"` (le test du mobilier n'est pas refait) |
| 5 | distance > `max(attack_range − irandom_range(100, 300), sprite_width)` | `"chase"` |
| 6 | un meuble `bulletCrossed == false` sur la ligne PNJ → héros | `"chase"` |
| 7 | sinon | `"attack"` |

Lecture : le soldat poursuit jusqu'à une distance un peu **inférieure** à sa portée (portée − 100 à 300, **retiré à chaque step**, donc en pratique il s'arrête vers portée − 100), puis continue de tirer tant que la cible reste sous `attack_range` avec ligne de vue. Pour le robot bouclier (portée 150) le seuil d'entrée devient `sprite_width` (≈ 154 px en 2017, valeur 2019 non trouvée).

Perte de cible : `behaviour = noone` ⇒ retour à la patrouille. Le chemin de poursuite n'est pas supprimé : le parent le **termine à vitesse de patrouille** (le soldat va jusqu'à la dernière position connue), puis fait sa pause et reprend une patrouille aléatoire. Toute nouvelle détection repasse par « surpris ».

### 3.4 États

**Surpris** (`scripts/scr_surprised`, `objects/obj_localNpc_soldier/Alarm_6.gml`)
- À l'entrée : `alarm[6] = reactionTime * room_speed` = **0,8 s (48 steps)**.
- Pendant : `direction` vers la cible, `state = "standing"` (immobile, ne tire pas).
- Sortie : fin de l'alarme ⇒ chase ou attack selon §3.3.

**Poursuite** (`scripts/scr_chaseHero`, `Alarm_5.gml`)
- Quand `alarm[5] == -1` : suppression de l'ancien chemin, calcul A* `mp_grid_path(obj_grid.grid, …, x, y, hero.x, hero.y, true)` (diagonales autorisées).
  - Succès ⇒ `scr_initNpcPath`, `state = "chasing"`, `alarm[5] = room_speed / 2` : **chemin recalculé toutes les 0,5 s**.
  - Échec ⇒ `state = "standing"`, `alarm[5] = -1` : nouvelle tentative **à chaque step** (coûteux).
- Déplacement : `scr_moveToNextPointInPath(spdChase, false)` ; le sprite regarde le héros.

**Attaque** (`scripts/scr_attackHero`, `scripts/scr_processFire`, `Alarm_3.gml`, `Alarm_4.gml`)
- `speed = 0`, `direction` et `image_angle` vers le héros, chemin supprimé : **le soldat tire à l'arrêt**, visée exacte sur la position courante du héros (pas d'anticipation), dispersion ± `precision`.
- `scr_processFire`, dans l'ordre :
  1. `alarm[4] > 0` ⇒ `state = "reloading"` ;
  2. `remainingAmoQuantity == 0` ⇒ `alarm[4] = reloadingTime * room_speed`, chargeur rempli immédiatement, `state = "reloading"` ;
  3. `alarm[3] == -1` ⇒ tir : `shot1_bullet_count` projectiles via `scr_createAndSendNewBullet(id, type, "ennemi", true)` (+ son par projectile), `remainingAmoQuantity--` si `canReload`, `alarm[3] = room_speed / shot1PerSec`, `state = "firing"` ;
  4. sinon `state = "delay_firing"`.
- Position de création du projectile : bouche du canon = position + décalage (`relativeBoutCanonX`, `relativeBoutCanonY`) tourné de `image_angle`.

### 3.5 Suivi de chemin (`scripts/scr_initNpcPath`, `scripts/scr_moveToNextPointInPath`, `objects/obj_localNpc/Alarm_1.gml`)

- `scr_initNpcPath` : `positionInPath = 1`, prochain point = point 1 du chemin, `alarm[1] = maxTimeToReachNextPosition * room_speed` (1 s).
- `scr_moveToNextPointInPath(vitesse, regarderLePointSuivant)` :
  - point atteint (distance ≤ `sprite_width/4`) **ou** délai dépassé (`alarm[1] == -1`) ⇒ passage au point suivant ;
  - plus de point valide, ou délai dépassé avec déjà 2 échecs consécutifs ⇒ chemin supprimé, `src_wait()` (arrêt) ;
  - sinon compteur d'échecs incrémenté (délai dépassé) ou remis à 0 (point atteint), et `alarm[1]` relancée ;
  - déplacement : `mp_potential_step(pointX, pointY, vitesse, false)` (évitement local des instances **solides** uniquement) ;
  - orientation : vers `direction`, ou vers le point n+1 si `regarderLePointSuivant` (patrouille aléatoire, fuite des civils).

### 3.6 Comportement par défaut : patrouille, attente, mort (`scripts/scr_setNPCBehaviourActions`, `scripts/src_getDefaultNpcBehaviour`, `scripts/src_patrol`, `scripts/src_wait`, `scripts/scr_dead`)

- `currentHealth <= 0` ⇒ `"dead"` ⇒ `scr_dead()` : destruction immédiate de l'instance (pas d'état d'agonie). Sinon `spd != 0` ⇒ `"walking"` (patrouille), sinon `"waiting"` (`src_wait` : arrêt, `state = "standing"`).
- `src_patrol` :
  1. `alarm[0] > 0` ⇒ pause (immobile) ;
  2. pas de chemin et `alarm[0] == -1` ⇒ lance la pause : `alarm[0] = room_speed * (patrolPauseTime + choose(0, 0.5, 1, 1.5, 2))` = **2 à 4 s** ;
  3. pause terminée ⇒ `scr_buildNpcPatrolPath()` ; succès ⇒ `state = "walking"` ; échec ⇒ attente (nouvelle pause) ;
  4. chemin en cours ⇒ avance à `patrolSpeed` (5 px/step).
- `scripts/scr_buildNpcPatrolPath` selon `patrolType` :
  - `"random"` : deux points candidats tirés par `scr_getRandomPointInRoom(x, y, patrolRange)`, on garde **le plus éloigné** (pour décoller le PNJ des murs) ; chemin A* lissé (`path_set_kind 1`, précision 8). Le tirage part de la **position courante** : le PNJ dérive, `patrolXOrigin/YOrigin` ne servent pas ici.
    - `scripts/scr_getRandomPointInRoom` : angle aléatoire 0–360°, point le plus lointain atteignable dans cette direction sans croiser mur ni porte (dichotomie jusqu'à un pas < 10 px, max `patrolRange` = 1500 px ; `scripts/scr_getFarestPointInRoom`), puis X et Y tirés **indépendamment** entre la position et ce point (le point final est dans le rectangle englobant, pas forcément sur le rayon).
  - `"points"` : chemin ouvert passant par l'origine puis les points de la liste `patrolPoints` (chaînes `"X;Y"`), inversé si le PNJ n'est pas à l'origine (aller-retour), non lissé. Utilisé par **une seule instance** (un `obj_npc_civil_malette` de `rm_world2`, points `5486;5612`, `5060;5721`, `5151;5277`, `maxTimeToReachNextPosition = 2`).
  - `"none"` : aucun chemin, le PNJ reste sur place.
- `scripts/scr_calculPatrolRectangle` (rectangle de patrouille par recherche des limites de la pièce, via `scripts/scr_getClosestPointToRoomLimits`) : **non appelé** (ses seuls appels sont commentés dans `scr_calculNewGridAroundObject` et `scr_calculNewGridIfTargetIsOutside`).

### 3.7 Débogage

Touches du HUD (`objects/obj_gui/KeyRelease_112..115.gml`) : F1 grille de pathfinding, F2 portées (vue rouge, ouïe verte, attaque noire), F3 zone de patrouille, F4 chemins. Sans incidence sur le jeu.

---

## 4. IA des civils

### 4.1 Boucle (`objects/obj_localNpc_civil/Step_0.gml`)

Chaque step (hors pause, PNJ actif) : `behaviour = scr_getNpcBehaviourCivil()` ; `"run away"` ⇒ `scr_runAwayFromHero()` ; `noone` ⇒ comportement parent (patrouille/attente/mort, §3.6).
`scripts/scr_setCivilNPCBehaviourActions` fait la même chose mais **n'est appelé nulle part** (doublon).

### 4.2 Déclenchement de la peur (`scripts/scr_getNpcBehaviourCivil`, `scripts/scr_getFearObject`)

1. `currentHealth <= 0` ⇒ `noone` (mort via le parent).
2. Si déjà `fear` : tant que `alarm[3]` tourne ⇒ `"run away"` ; à son expiration ⇒ `fear = false`, chemin supprimé (l'événement `Alarm_3.gml` remet aussi `fear = false`).
3. Sinon recherche d'un objet de peur, par priorité :
   1. un **héros qui tire** entendu (même règle que §3.2 : ≤ 1000 px, pas de mur épais) ;
   2. un **soldat en train d'attaquer** entendu (`scr_getTheNearestHeardSoldierAttacking` : `behaviour == "attack"`, ≤ 1000 px, pas de mur épais) ;
   3. un **autre civil apeuré visible** (`scripts/scr_getTheNearestVisibleCivilFearing` : `fear == true`, `distance_to_object < viewRange` (800), ligne de vue sans mur ni porte) ⇒ **contagion de la panique**.
4. Si trouvé : `fear = true`, `patrolType = "random"` (définitif), `alarm[3] = fearDuration * room_speed` (**30 s**), chemin supprimé, `"run away"`.

Les civils **ne réagissent pas à la simple vue d'un héros** : il faut des tirs, un soldat qui attaque, ou un civil déjà paniqué. La peur dure 30 s sans prolongation pendant ce délai, puis est réévaluée aussitôt.

### 4.3 Fuite (`scripts/scr_runAwayFromHero`)

- Sans chemin en cours :
  - menace = héros le plus proche (`instance_nearest`) ; à défaut de héros, soldat le plus proche ;
  - si la menace est à moins de `viewRange` (800 px) : angle de fuite = direction menace → civil **± 20°** aléatoire ; point de fuite = point le plus lointain de la pièce dans cette direction (sans croiser mur ni porte, recherche bornée par `max(room_width, room_height)`) ;
  - si ce point est à au moins `sprite_width/4` : chemin A* lissé vers lui, `state = "running"` ;
  - sinon (menace trop loin, point trop proche, ou A* en échec) : `src_wait()` — le civil **reste figé** tout en étant apeuré.
- Avec chemin : `scr_moveToNextPointInPath(fearSpeed, true)` (6 px/step).
- Arrivé au bout, il recalcule une fuite si la menace est toujours à moins de 800 px.
- Défaut mineur : ce script n'appelle pas `scr_initNpcPath`, donc `alarm[1]` n'est pas armée ; le premier point du chemin est en général sauté et compté comme un échec.

### 4.4 Cas particuliers placés dans les salles

Dans `rm_world2` (`rooms/rm_world2/rm_world2.yy` + codes de création d'instance) : 4 civils `patrolType = none` (statiques), 4 civils `normalSpd = 0` (ils « attendent » ; leur `fearSpeed` vaut donc 0 : ils ne fuient pas réellement), 1 civil en patrouille par points, 1 civil avec `DEBUG_NPC = true` (variable inutilisée).

---

## 5. Recherche de chemin

### 5.1 `obj_grid` (`objects/obj_grid/Create_0.gml`, `Destroy_0.gml`, `Other_3.gml`, `Draw_0.gml`)

- Une grille `mp_grid` **unique par salle**, créée par `scripts/scr_room_world_ini` (`if(!instance_exists(obj_grid)) instance_create(0, 0, obj_grid)`), non persistante. Seule `_rm_world3` (salle archivée) en contient une instance placée à la main.
- **Cellules de 32 × 32 px**, origine (0, 0).
- Nombre de cellules : `room_width / 16` × `room_height / 16` (`numberOfCells = cell_size / 2`). **Incohérence** : c'est le double du nécessaire dans chaque dimension (la grille couvre 2× la salle) et le résultat peut être non entier (ex. 13000/16 = 812,5).
- Obstacles ajoutés à la création : toutes les instances de `obj_mur_parent` et de `obj_mobilier_parent` (boîte englobante, `prec = false`).
- Correctif : pour tout PNJ posé sur du mobilier, les cellules dans un carré de ± `sprite_width/4` autour de lui sont libérées (sinon aucun chemin ne peut partir de sa case).
- A* : `mp_grid_path(..., allowdiag = true)` ; utilisé par la poursuite, la patrouille aléatoire, la fuite des civils et le boss.

### 5.2 Ce qui n'est pas dans la grille — bogue probable

- **Les murs générés depuis les tuiles.** Dans `rm_world2`, `rm_world2_1`, `rm_world2_2`, `rm_world4`, `rm_world4_1`, le code de création de salle appelle `scr_room_world_ini(...)` (qui crée la grille) **avant** `scr_createMurEpaisFromTile("tiles_mur_epais")` et `scr_createMurFinFromTile("tiles_mur_fin")`. Or le calque d'instances `layer_murs` de ces salles est vide : tous les murs viennent des tuiles. La grille est donc construite **sans ces murs** (elle ne contient que le mobilier, les fenêtres, et quelques murets placés à la main dans world4). Aucun code ne la met à jour ensuite. Les chemins A* traversent donc les murs ; seul `mp_potential_step` évite localement les obstacles solides, avec les garde-fous anti-blocage (1 s par point, 2 échecs). À confirmer en jeu, mais c'est ce que dit le code.
- **Les portes** : `obj_door_parent` hérite de `obj_decor_base`, pas de `obj_mur_parent` ; elles ne sont pas ajoutées à la création.

### 5.3 Mise à jour avec les portes (`objects/obj_door_parent/Alarm_0.gml`, `Alarm_2.gml`)

- Fin d'ouverture d'une porte **non automatique** : `mp_grid_clear_rectangle` sur le rectangle `x ± sprite_width/2`, `y ± sprite_height/2`.
- Fin de fermeture d'une porte non automatique : `mp_grid_add_rectangle` sur le même rectangle.
- Conséquence : une porte non automatique n'est un obstacle dans la grille **qu'après son premier cycle ouverture/fermeture**. Le rectangle ignore la rotation de la porte.
- Portes automatiques (`obj_automaticDoor`, `automaticDoor = True`) : jamais dans la grille ; elles s'ouvrent quand un héros, **un PNJ** ou le PetDrone est à moins de `detectionRange` = 200 px (`scripts/scr_antiBlockingDoorSecurity`, appelé pour `obj_localPlayer`, `obj_localNpc`, `obj_PetDrone`). Temps par défaut : ouverture 0,5 s, maintien 1 s, fermeture 0,5 s (`obj_door` et portes à carte : 1 s / 2 s / 1 s).
- Les portes fermées bloquent la **ligne de vue** des PNJ (§3.2) et les balles.

### 5.4 Scripts de grille inutilisés ou désactivés

| Script | État |
|---|---|
| `scripts/scr_initialize_grid` | reconstruit une grille limitée à un rectangle (arrondi à la cellule) à partir d'une liste `gridInstances` : **jamais appelé** (reste d'une conception « une grille par PNJ ») |
| `scripts/scr_addNPCCellToGrid` | marque comme obstacles les cellules des autres PNJ à moins de 200 px du propriétaire de la grille : **jamais appelé** |
| `scripts/scr_clearGridCellAndArray` | libère ces cellules temporaires : **jamais appelé** |
| `scripts/scr_calculNewGridAroundObject` | corps **entièrement commenté** |
| `scripts/scr_calculNewGridIfTargetIsOutside` | corps **entièrement commenté** ; encore appelé par `scr_PetDrone_setPathToTarget` (sans effet) |

Les PNJ ne sont donc jamais des obstacles dans la grille ; ils s'évitent uniquement par `mp_potential_step` (solides).

---

## 6. Boss : SallyBot

### 6.1 Fiche (`objects/obj_sallyBot/obj_sallyBot.yy`, `Create_0.gml`)

| Élément | Valeur |
|---|---|
| Parent | `obj_localNpc_soldier` (compté comme « soldat » au score) |
| Genre | robot |
| PV (`maxHealth`) | **100** |
| `normalSpd` / `spdChase` | 10 / **10 px/step** (600 px/s, vitesse d'un héros) |
| Charge (`fire2`) | `spdChase * 2` = **20 px/step** |
| Patrouille (sans cible) | 5 px/step (défaut) |
| `attack_range_min` / `max` | 1 / 20 px (`attack_range` tiré à la création) |
| `reactionTime` | `1/room_speed` = 1 step |
| `shot1PerSecMax` | 2 (sans effet : il ne tire pas) |
| `canReload` | False |
| Portée d'aggro | 1600 px (`distance_to_object`), **sans ligne de vue** |
| Dégâts | 2 / 2 / 3 / 4 (combo phase 1), 3 (attaque phase 2), 4 (charge) |
| `chargeForBreathing` | 180 steps (3 s) |
| Salle | **`rm_world2_2`** (13000 × 8000), 1 instance en (6560, 6208) |

Le boss **ne tire aucun projectile** : les appels `scr_createAndSendNewBullet` sont commentés dans `scr_setBossAction1/2`. Tous ses dégâts passent par une zone de frappe.

### 6.2 Zone de frappe (`objects/obj_sallyBot_hitBox/Create_0.gml`, `Step_0.gml`, `scripts/scr_setSallyBotHitBoxSpriteIndex`)

- Créée avec le boss ; suit sa position et son angle ; se détruit s'il n'existe plus.
- Son sprite (masque de collision) dépend du sprite courant du boss, image par image (`image_index` recopié) :

| Sprite du boss | Masque de frappe |
|---|---|
| `spr_sallyBot_1_AttackD1` | `spr_sallyBot_1_HitBoxD1` |
| `spr_sallyBot_1_AttackG1` | `spr_sallyBot_1_HitBoxG1` |
| `spr_sallyBot_1_AttackD2` | `spr_sallyBot_1_HitBoxD2` |
| `spr_sallyBot_1_AttackG2` | `spr_sallyBot_1_HitBoxG2` |
| `spr_sallyBot_1_fire2` | `spr_sallyBot_1_fire2_HitBox` |
| `spr_sallyBot_2_attack` | `spr_sallyBot_2_HitBox1` |
| `spr_sallyBot_2_fire2` | `spr_sallyBot_2_HitBox2` |
| autre | aucun |

- Un héros touché prend `obj_sallyBot.damage` aux mêmes conditions qu'une balle (pas de glitch en cours, déployé, vivant, pas invincible) puis reçoit un glitch (invulnérabilité de 10 à 40 steps) ; `totalDamageTaken` est incrémenté.
- Chaque héros n'est touché **qu'une fois par changement de masque** (liste `hittedHeroes` vidée seulement quand le sprite de la zone change). Conséquence en phase 2 : deux attaques consécutives utilisent le même sprite ⇒ la seconde ne peut pas retoucher le même héros tant que le boss n'a pas changé d'animation (limitation probablement involontaire).

### 6.3 Ciblage (`scripts/scr_getSallyBotTargetEnnemy`, `scripts/scr_getRandomObjectId`, `objects/obj_sallyBot/Alarm_7.gml`)

- Sans cible : dès qu'un héros est à moins de **1600 px**, cible = **héros tiré au hasard** (par `playerNumber` entre 1 et le nombre de héros), `alarm[7] = choose(3, 4, 5, 6, 7) * room_speed`.
- Avec cible : à chaque expiration de `alarm[7]` (toutes les **3 à 7 s**), nouveau tirage au hasard.
- La cible n'est jamais abandonnée (aggro permanent) ; ni la ligne de vue ni l'état « mort » du héros ne sont testés.
- Fragilité : si aucun héros n'a le `playerNumber` tiré, le script ne renvoie rien (cible indéfinie).
- Sans cible, le boss patrouille comme un PNJ ordinaire (`objects/obj_sallyBot/Step_0.gml`).

### 6.4 Phases (`scripts/scr_setBossBehaviourActions`)

- **Phase 1** tant que `currentHealth > maxHealth/2` ; **phase 2** dès `currentHealth <= 50`, sans retour.
- En phase 2, `chargeBeforeBreathing` augmente de 1 par step passé en `fire1` ou `fire2`.
- **Invulnérabilité** : `invulnerable = true` si `state == "fire2"` (charge) ou si le sprite courant est `spr_sallyBot_2_attack`, `spr_sallyBot_2_marche` ou `spr_sallyBot_2_standing`. Donc :
  - phase 1 : vulnérable sauf pendant la charge ;
  - phase 2 : **invulnérable en permanence, sauf pendant la transformation et pendant la « respiration »**.

### 6.5 Phase 1 (`scripts/scr_getBossBehaviour1`, `scripts/scr_setBossAction1`, `scripts/scr_setFire1CoupSallyBot`)

Décision (distances mesurées par `distance_to_object`, de bord à bord) :
1. PV ≤ 0 ⇒ `noone` ; 2. premier contact ou `alarm[6]` en cours ⇒ `surprised` (1 step) ; 3. pas de ligne de vue ⇒ `chase` ; 4. attaquait déjà et distance ≤ `attack_range + 150` ⇒ `attack` ; 5. distance > `attack_range_min` (1 px) et pas au milieu d'une frappe ⇒ `chase` ; 6. meuble bloquant sur la ligne ⇒ `chase` ; 7. sinon `attack`.

Autrement dit : il poursuit jusqu'au **contact** (≤ 1 px), puis enchaîne les frappes tant que la cible reste à moins de ≈ 151–170 px.

- **Poursuite** : quand `alarm[5] == -1` et hors charge, tirage `irandom(4) < 4` :
  - 4 chances sur 5 : chemin A* vers la cible, `state = "walking"`, `alarm[5] = room_speed/2` (recalcul toutes les 0,5 s), déplacement à 10 px/step ;
  - 1 chance sur 5 : **charge** (`state = "fire2"`).
- **Charge (`fire2`)** : s'oriente en continu vers la cible ; `damage = 4` ; à partir de l'image 7 de l'animation, avance à **20 px/step** vers la cible (trajectoire corrigée à chaque step), s'arrête s'il rencontrerait un décor ou un héros ; à la dernière image ⇒ `standing`. Invulnérable pendant toute la charge.
- **Attaque (`fire1`)** : immobile, tourné vers la cible ; à chaque fin d'animation, `scr_setFire1CoupSallyBot` passe au coup suivant du **combo cyclique de 4 coups** :

| Coup | Sprite | Dégâts |
|---|---|---|
| 1 | `spr_sallyBot_1_AttackD1` (droite) | 2 |
| 2 | `spr_sallyBot_1_AttackG1` (gauche) | 2 |
| 3 | `spr_sallyBot_1_AttackD2` | 3 |
| 4 | `spr_sallyBot_1_AttackG2` | 4 |

Durées des animations : **non trouvé** (sprites absents).

### 6.6 Phase 2 (`scripts/scr_getBossBehaviour2`, `scripts/scr_setBossAction2`)

Décision, dans l'ordre :
1. PV ≤ 0 ⇒ `noone` ;
2. pas encore transformé ⇒ `transformation` ;
3. `chargeBeforeBreathing >= 180` et animation courante terminée (ou déjà en respiration) ⇒ `breathing` ;
4. pas de ligne de vue ⇒ `chase` ;
5. attaquait déjà et distance ≤ `attack_range + 150` ⇒ `attack` ;
6. distance > `attack_range` (1–20 px) et pas au milieu d'une frappe ⇒ `chase` ;
7. meuble bloquant ⇒ `chase` ; sinon `attack`.

- **Transformation** : joue `spr_sallyBot_transformation` une fois (boss vulnérable), puis remplace les sprites : `spr_sallyBot_2_standing`, `spr_sallyBot_2_marche`, `spr_sallyBot_2_attack`, `spr_sallyBot_2_fire2`.
- **Poursuite et charge** : identiques à la phase 1 (10 px/step, 1 chance sur 5 de charger à 20 px/step, 4 dégâts).
- **Attaque** : un seul type de frappe, `damage = 3`, répétée (pas de combo).
- **Respiration** (`breathing`, sprite `spr_sallyBot_2_respire`) : après **180 steps cumulés** d'attaque ou de charge, le boss s'arrête et joue l'animation une fois ; c'est la **fenêtre de vulnérabilité** de la phase 2 ; puis `chargeBeforeBreathing = 0`.
- Pas d'état « surpris » en phase 2 (la branche existe mais n'est jamais renvoyée).

### 6.7 Divers et défauts

- Barre de vie : affichée dans le HUD dès que le boss est entré une fois dans la vue (marge 10 px) ; barre rouge sur noir, de 200 px du bord gauche à 200 px du bord droit, entre y = 100 et y = 130 (× `global.displayRatio`) (`objects/obj_sallyBot/Draw_64.gml`).
- **Mort inachevée** : `scripts/scr_setDeathSpriteToNpc` n'a pas de cas `obj_sallyBot` ⇒ aucun sprite de mort ; le boss disparaît comme un PNJ ordinaire (débris « robot », son `snd_human_explosion`), sans séquence de victoire ni déclenchement de fin de niveau.
- **Blocage possible** : si le comportement passe à `attack` pendant une charge (`state == "fire2"`), aucune branche ne sort de cet état tant que la cible reste proche ; le boss reste en animation de charge, invulnérable.
- **Invulnérabilité contournable** : les battes de BatBot (`obj_bullet_batte_parent`) et le PetDrone retirent des PV sans tester `invulnerable` (§8).
- Accès à la salle : `rm_world2_2` ne contient que le boss, 4 points d'apparition de héros et 3 `obj_foreuse` (foreuses) — **aucun mur, aucune porte, aucune sortie**. Aucun `obj_nextRoom` d'une autre salle n'y mène : la sortie de `rm_world2` (`obj_endLevel`) va directement à `rm_score`. La salle n'est atteignable que par le menu de sélection de salle (`scripts/scr_getAllRoomWorldList`). Les consignes « Exit to the drilling area », « Destroy the drills », « Kill SallyBot » existent en texte (`objects/obj_consigne_world2/Create_0.gml`) mais aucun code ne les fait défiler. Niveau du boss **inachevé**.

---

## 7. Apparition, mort et score

### 7.1 Apparition des ennemis

- **Aucun système de vagues ni d'apparition dynamique.** Tous les PNJ sont des instances posées à la main dans les salles (§9). Aucun `instance_create` d'un `obj_npc_*` ou de `obj_sallyBot` n'existe dans le code.
- `obj_spawner` (`objects/obj_spawner/obj_spawner.yy`, `Other_4.gml`) ne concerne **que les héros** : objet persistant créé par `scr_room_world_ini`, qui à chaque début de salle appelle `scr_spawnLocalPlayer()` (sauf largage par véhicule ou nettoyage de salle). `spawnNumber` (défaut 1) = numéro du point d'apparition des héros dans la salle suivante. `obj_spawn1`…`obj_spawn4` sont les points d'apparition des héros 1 à 4.
- Activation : un PNJ ne commence à agir que lorsqu'un héros est à moins de 4000 px (§1.2).
- Salles non persistantes (`"persistent": false` dans les `.yy`) ; un mécanisme `obj_roomsMemory` / `obj_cleaningRoom` existe pour revisiter les salles — hors périmètre de ce document.

### 7.2 Mort d'un PNJ

1. `currentHealth <= 0` ⇒ au step suivant `scr_dead()` ⇒ `instance_destroy()`.
2. Événement Destroy (`objects/obj_localNpc/Destroy_0.gml`) :
   - son `snd_human_explosion` (pour tous, robots compris) ;
   - création d'un `obj_npc_mort` à la même position, avec le type d'objet, l'angle et le `genre` du défunt ;
   - `obj_score.civilKilled++` (parent direct = civil) ou `obj_score.soldierKilled++` (parent direct = soldat, boss inclus) ;
   - destruction des `obj_lightCollisionCircle` associés.
3. `obj_npc_mort` (`objects/obj_npc_mort/Create_0.gml`, `Step_0.gml`) :
   - joue une fois l'animation de mort (`scripts/scr_setDeathSpriteToNpc`, tableau §1.4/§1.5) puis se détruit ;
   - au premier step, projette des débris `obj_projectionOfElementMort` : `numberOfPieces = irandom_range(3, 10)` et boucle `i <= numberOfPieces` ⇒ **4 à 11 débris**, chacun décalé de ±5 px ;
   - et des flaques `obj_flaqueMort` : `irandom_range(1, 3)` avec la même boucle ⇒ **2 à 4 flaques**, décalées de ±15 px.
   - Sprite d'un débris : `spr_membreMortHumain_N` ou `spr_membreMortRobot_N`, N tiré sans remise dans une liste :
     - humain (`scripts/scr_fillHumainElementList`, 18 entrées) : 1,1,2,3,3,4,4,5,6,7,7,8,8,9,9,10,10,11 ;
     - robot (`scripts/scr_fillRobotElementList`, 22 entrées) : 1,1,2,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11.
   - Bogue mineur : l'index est tiré dans `[0, taille]` inclus ⇒ parfois hors liste, donc un débris sans sprite.
4. `obj_projectionOfElementMort` (`Create_0.gml`, `Step_0.gml`, collision avec `obj_decor_base`) : angle et direction aléatoires, vitesse initiale `random_range(20, 40)` px/step, décélération 3 px/step², tourne de 1°/step tant qu'il bouge ; rebondit sur le décor en divisant sa vitesse par 2. **Jamais détruit** (reste au sol).
5. `obj_flaqueMort` (`Create_0.gml`, `Step_0.gml`) : `spr_membreMortHumain_sang` (humain) ou `spr_membreMortRobot_huile` (robot), image aléatoire parmi 3, angle aléatoire, statique, jamais détruite.
6. `obj_explosion_robot` (`Create_0.gml`, `Step_0.gml`) : animation d'explosion **des héros** (créée par `scripts/scr_setDead` à la mort d'un héros, visible à partir de l'image 4 de leur animation). **Elle n'est pas utilisée pour la mort des PNJ**, malgré son nom.

### 7.3 Score (`objects/obj_score/Create_0.gml`, `Other_4.gml`, `Step_0.gml`, `Draw_0.gml`)

- **Aucun ennemi ne rapporte de points.** Il n'existe ni valeur par ennemi ni compteur de points.
- `obj_score` (persistant, recréé au début de chaque niveau par `scr_room_world_ini(true)`) tient des statistiques : `civilKilled`, `soldierKilled`, `totalCivil`, `totalSoldier` (cumulés à chaque nouvelle salle traversée), `totalDamageTaken`, `totalHeal`, `totalAmmoUsed`, `totalUsedEnergy`.
- Écran `rm_score` : « Percent of civil killed », « Percent of soldier killed », « Total damage taken », « Total heal point », « Total ammo used », « Total energy used », puis **« Global note : 42 » codé en dur** (note finale non implémentée).
- Bogue probable : la première salle est comptée deux fois dans les totaux (une fois au Create, une fois au Room Start), ce qui fausse les pourcentages. Division par zéro si un niveau n'a aucun civil.
- L'affichage en jeu des compteurs est **commenté** (`Draw_64.gml`).

---

## 8. Dégâts reçus par les PNJ

`obj_localNpc` n'a **aucun événement de collision**. Ce sont les projectiles qui testent le contact à chaque step (`instance_place(x, y, obj_localNpc)` dans `objects/obj_bullet_base/Step_0.gml`) et appellent `scripts/scr_bulletCollisionActionWithLocalNpc`.

### 8.1 `scr_bulletCollisionActionWithLocalNpc(pnj)`

N'agit que si `owner == "hero"`.
- Anti-doublon : si `pnj.lastHitId == id` (même projectile que le dernier coup reçu) ⇒ rien. Sert aux projectiles persistants (coup de batte).
- **Robot bouclier (`obj_npc_robot_shield`)** : `angle` = direction du robot vers le projectile ; dégâts seulement si `abs(angle_difference(robot.image_angle, angle)) > 140`, c'est-à-dire si l'impact vient de **l'arrière, dans un cône de ± 40°**. Sinon : particules d'impact (et son métallique pour BatBot), **aucun dégât**. Le projectile est détruit dans les deux cas (sauf coup de batte). Cette branche ne teste pas `invulnerable`.
- **Autres PNJ** :
  - coup de batte (`obj_bullet_BatBot`) : dégâts seulement s'il n'y a pas de mur entre le héros et le PNJ ; le projectile n'est pas détruit ;
  - autres projectiles : `currentHealth -= damage` si `invulnerable == false`, puis destruction — sauf `obj_bullet_EngiBot` qui **rebondit** et perd les 3/4 de sa vitesse ;
  - particules d'impact (`scr_createBulletNPCImpactParticules`) dans tous les cas.
- Fin : `pnj.lastHitId = id` ; DOT éventuel (jamais actif, §2.4).
- Pas d'invulnérabilité temporaire, pas de recul, pas de réaction (un PNJ touché sans avoir vu ni entendu le tireur ne s'alerte pas par ce biais ; il s'alerte par l'ouïe si le héros est en état de tir à moins de 1000 px).

### 8.2 Sources de dégâts côté héros (valeurs lues dans les objets, pour référence)

| Source | Dégâts | Remarques | Source |
|---|---|---|---|
| `obj_bullet1`, `obj_bullet_EngiBot`, `obj_bullet_PetBot`, `obj_bulletTurret`, `obj_bullet_BatBot` | 1 | PetBot : vitesse 20 ; BatBot : vitesse 0, vit 10 steps | `.yy` respectifs |
| `obj_bullet4` | 5 | | `objects/obj_bullet4/obj_bullet4.yy` |
| `obj_bullet2` | 0 + explosion | explosion `obj_bullet2_explosion` : 3 dégâts, diamètre 374 | `objects/obj_bullet2`, `objects/obj_explosion_parent` |
| `obj_bullet_BadaBot` | 0 + explosion | `obj_plasma_explosion` : 20 dégâts, diamètre 100 | `objects/obj_bullet_BadaBot/Create_0.gml` |
| Batte lancée (`obj_bullet_batte_parent`) | 3 | variante explosive : 4 ou 7 (défaut 5) ; **ignore `invulnerable`** | `objects/obj_bullet_batte_parent`, `scripts/scr_createAndSendNewBulletBatBot` |
| PetDrone | **non trouvé** | `target.currentHealth -= damage` mais `damage` n'est défini nulle part pour `obj_PetDrone` ; ignore `invulnerable` | `scripts/scr_PetDrone_activeMovements` |

### 8.3 Explosions (`objects/obj_explosion_parent/Step_0.gml`)

- Touchent tous les `obj_localNpc` dans un cercle de rayon `range/2`, **une seule fois par explosion**, si `invulnerable == false` et s'il n'y a pas de mur entre le centre et le PNJ.
- Robot bouclier : dégâts seulement si l'explosion est dans son dos (`>= 140°`).
- Les explosions ne blessent pas les héros.

### 8.4 Réseau

`scripts/scr_receivedPacket_server`, message `S_PETDRONE_ACTION_MESSAGE` : retire `damage` au PNJ dont l'`id` est reçu. Seul point où le réseau modifie les PV d'un PNJ (voir aussi « Dépendances réseau »).

---

## 9. Placement des ennemis par salle

Comptage des instances dans `rooms/<salle>/<salle>.yy` (tous calques). `obj_spawner` : **0 instance placée** dans toutes les salles (créé par code). `obj_npc_civil_ouvrier`, `obj_npc_civil_scientifique` : **0 instance** partout.

### 9.1 Salles actives

Salles listées par le menu de sélection (`scripts/scr_getAllRoomWorldList` : noms `rm_worldN`, `rm_worldN_M`, `rm_arenaN`, `rm_arenaN_M`).

| Salle | Taille | pistol | shield | lightBot | shotBot | SallyBot | **Soldats** | femme | handi | malette | technicien | **Civils** | **Total PNJ** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `rm_world2` | 13000×8000 | 22 | 5 | 5 | 4 | 0 | **36** | 15 | 1 | 20 | 16 | **52** | **88** |
| `rm_world2_1` | 13000×8000 | 11 | 1 | 4 | 3 | 0 | **19** | 12 | 1 | 16 | 14 | **43** | **62** |
| `rm_world2_2` | 13000×8000 | 0 | 0 | 0 | 0 | **1** | **1** | 0 | 0 | 0 | 0 | 0 | **1** |
| `rm_world4` | 14200×14200 | 4 | 0 | 1 | 0 | 0 | **5** | 9 | 6 | 11 | 8 | **34** | **39** |
| `rm_world4_1` | 15200×20200 | 20 | 3 | 2 | 1 | 0 | **26** | 3 | 3 | 3 | 46 | **55** | **81** |
| `rm_arena2` | 10024×7680 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total actif** | | **57** | **9** | **12** | **8** | **1** | **87** | **39** | **11** | **50** | **84** | **184** | **271** |

Enchaînements trouvés : `rm_world2` → `rm_world2_1` par `obj_nextRoom` (valeur par défaut `nextRoom = rm_world2_1`) ; retour `rm_world2_1` → `rm_world2` par `obj_previousRoom` (`spawnNumberOfNextRoom = 2`) ; `rm_world2` → `rm_score` par `obj_endLevel` ; `rm_world4` → `rm_world4_1` par `obj_nextRoom`. `rm_world2_2` (boss) et `rm_arena2` ne sont reliées à rien.

Anomalies sur les codes de création de salle :
- `rm_arena2` et `rm_arena1_3` : leur `.yy` référence `RoomCreationCode.gml`, mais ce fichier est **absent de l'extrait** ; leur initialisation est donc inconnue.
- `rm_world4` : un `RoomCreationCode.gml` existe dans le dossier (`scr_room_world_ini(true)` + création des murs depuis les tuiles) mais le `.yy` a `creationCodeFile` **vide**. Il n'est pas certain que ce code soit exécuté ; s'il ne l'est pas, la salle n'a ni murs, ni grille, ni héros.

### 9.2 Salles archivées ou inatteignables

Préfixe `_` : elles ne correspondent plus aux noms cherchés par le menu ; le code qui référence encore `rm_world1`, `rm_world3`, `rm_arena` (boutons de carte, `scr_consoleMessage`) pointe vers des salles qui n'existent plus sous ce nom.

| Salle | Taille | pistol | shield | lightBot | shotBot | Soldats | Civils |
|---|---|---|---|---|---|---|---|
| `_rm_arena1` | 10024×7680 | 10 | 2 | 0 | 0 | 12 | 0 |
| `_rm_arena1_1` | 20024×8680 | 11 | 7 | 4 | 5 | 27 | 0 |
| `_rm_arena1_2` | 10024×7680 | 8 | 2 | 2 | 3 | 15 | 0 |
| `_rm_arena1_3` | 18024×17080 | 21 | 6 | 4 | 3 | 34 | 0 |
| `rm_arena1_3` (copie de `_rm_arena1_3` ; non listée par le menu car `rm_arena1` n'existe pas) | 18024×17080 | 21 | 6 | 4 | 3 | 34 | 0 |
| `_rm_world1` | 24000×10000 | 15 | 5 | 2 | 1 | 23 | 0 |
| `_rm_world1_1`, `_rm_world1_2`, `_rm_world1_3`, `_rm_world1_4` | divers | 0 | 0 | 0 | 0 | 0 | 0 |
| `_rm_world3` | 4096×8000 | 4 | 0 | 0 | 0 | 4 | 0 |

Salles de menu et de test (`rm_mainMenu`, `rm_choseHero`, `rm_loadingScreen`, `rm_recapitulatif`, `rm_score`, `rm_test_light`, `rm_test_textureGenerator`) : aucun PNJ.

### 9.3 Surcharges par instance

Seule `rm_world2` en contient, toutes sur des civils (§4.4). Aucun soldat placé n'a de valeur modifiée : le tableau §1.4 s'applique tel quel partout.

---

## Dépendances réseau (serveur)

- En v2019, **toute l'IA tourne en local** sur `obj_localNpc` ; aucun envoi réseau de l'état des PNJ n'a été trouvé.
- Restes d'une synchronisation serveur → client, **sans émetteur** dans cette version :
  - `scripts/scr_receivedPacket_client`, `C_NPC_MOVE_MESSAGE` : crée ou met à jour un `obj_localNpc` générique (position, direction, vitesse, sprite, image, PV) identifié par `npcId` — le type reçu est lu mais pas utilisé ;
  - `C_NPC_DESTROY_MESSAGE` : détruit le PNJ portant ce `npcId` ;
  - `global.npcIdCounter` est remis à 0 mais `npcId` n'est jamais attribué aux PNJ.
- `scripts/scr_createAndSendNewBullet` : la diffusion réseau de la création de projectile est **commentée**.
- `scripts/scr_receivedPacket_server`, `S_PETDRONE_ACTION_MESSAGE` : applique des dégâts à un PNJ par identifiant d'instance (§8.4).
- Le boss choisit sa cible par `playerNumber` des héros (numérotation liée aux manettes/joueurs).

Pour un remake solo, rien de tout cela n'est nécessaire.

---

## Récapitulatif des éléments désactivés, inachevés ou bogués

| Élément | Nature | Référence |
|---|---|---|
| DOT (`obj_dot`, `scr_giveDotTo`) | code mort, jamais déclenché, bogué | §2.4 |
| `scr_calculNewGridAroundObject`, `scr_calculNewGridIfTargetIsOutside` | corps commentés | §5.4 |
| `scr_initialize_grid`, `scr_addNPCCellToGrid`, `scr_clearGridCellAndArray`, `scr_calculPatrolRectangle`, `scr_setCivilNPCBehaviourActions` | jamais appelés | §3.6, §4.1, §5.4 |
| Murs issus des tuiles absents de la grille A* | bogue probable (ordre d'initialisation) | §5.2 |
| Taille de grille doublée (`room_width / 16` cellules de 32 px) | incohérence | §5.1 |
| Portes non automatiques absentes de la grille avant leur premier cycle | incohérence | §5.3 |
| Coup de bouclier : deux chemins de dégâts, repoussement non garanti | ambigu | §2.3 |
| Gerbe du shotBot et rafale du lightBot plafonnées par l'invulnérabilité de 10–40 steps du héros | effet de bord à connaître | §2.1 |
| `patrolSpeed` (5) indépendant de `normalSpd` : shield et shotBot patrouillent plus vite que leur vitesse « normale », lightBot moins vite ; civils à 5 en marche et 6 en fuite | incohérence | §1.2, §1.5 |
| Civils : état `hide` jamais utilisé ; ouvrier et scientifique jamais placés | inachevé | §1.5 |
| LightBot : sprite de mort de l'humain | provisoire | §1.4 |
| Soldats : pas d'alerte entre eux, pas de réaction à un coup reçu | absent | §3.2, §8.1 |
| Zone morte de rotation entre 5° et 10° | bogue mineur | §1.4 |
| Fuite des civils sans armement de `alarm[1]` | bogue mineur | §4.3 |
| Débris : index hors liste | bogue mineur | §7.2 |
| Boss : pas de sprite de mort, pas de fin de niveau, salle non reliée, consignes non branchées | inachevé | §6.7 |
| Boss : blocage possible en charge, invulnérabilité ignorée par battes et PetDrone, cible indéfinie possible, pas de double touche en phase 2 | bogues probables | §6.2, §6.3, §6.7 |
| Boss : création de projectiles commentée (il ne frappe qu'au corps à corps) | désactivé | §6.1 |
| Score : pas de points, note « 42 » en dur, première salle comptée deux fois | inachevé / bogue | §7.3 |
| `obj_spawner` : aucun rôle pour les ennemis, pas de vagues | absent | §7.1 |
| Synchronisation réseau des PNJ | vestige sans émetteur | Dépendances réseau |

## Non trouvé

- `options/main/options_main.yy` (valeur officielle de la vitesse de jeu) : absent ; 60 déduit du rapport de compatibilité.
- Tous les sprites : nombre d'images, durées d'animation (frappes et charge du boss, transformation, respiration, coup de bouclier, animations de mort), tailles (`sprite_width` utilisé par l'IA), origines et masques de collision.
- Valeur de `damage` du PetDrone.
- `RoomCreationCode.gml` de `rm_arena2` et de `rm_arena1_3` (référencés, absents).
- Toute valeur de points par ennemi, tout système de vagues ou de réapparition.
- Tout déclencheur menant à la salle du boss ou gérant sa mort.
