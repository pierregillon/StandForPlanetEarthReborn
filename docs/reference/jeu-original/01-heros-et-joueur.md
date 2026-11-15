# 01 — Héros et systèmes du joueur (snapshot GMS2 de janvier 2019)

Source analysée (lecture seule) : projet GameMaker Studio 2 `Stand-For-Planet-Earth` (snapshot v2019).
Tous les chemins cités sont relatifs à la racine de ce projet (`objects/...`, `scripts/...`).

Conventions de lecture :

- **[DÉSACTIVÉ]** = code commenté ou jamais appelé. **[BOGUE]** = comportement manifestement non voulu. **[INACHEVÉ]** = variable/objet présent mais sans effet. **[MULTI]** = ne fonctionne qu'avec au moins 2 héros.
- Les vitesses sont en **pixels par step**, les durées en **steps** sauf mention contraire.
- Beaucoup de valeurs propres aux héros ne sont pas dans les `.gml` mais dans les « Variable Definitions » des `.yy` (`properties` du parent, `overriddenProperties` des enfants). Elles sont citées « (obj_X.yy) ».

## 0. Préambule : room_speed, données manquantes

- **room_speed : non trouvé dans le snapshot.** Le dossier `options/` (où GMS2 stocke `option_game_speed`) est absent, aucun `game_set_speed` / `room_speed =` dans le code, et les `.yy` de rooms GMS2 n'ont pas de champ de vitesse.
  Indices convergents vers **60** : l'ancienne version GMS1 du dépôt (`Stand-For-Planet-Earth.gmx/rooms/*.room.gmx`) a `<speed>60</speed>` dans ses 19 rooms ; 60 est la valeur par défaut GMS2 ; le code contient `frict = (360/60)` (obj_turret_EngiBot.yy), `duration = 180` pour un compte à rebours de 3 s (obj_circularCountDown.yy), `alarm[0] = 10//room_speed/3-(2/0.6)` (objects/obj_bullet_BatBot/Create_0.gml).
  Toutes les conversions « en secondes » ci-dessous supposent 60 steps/s et sont notées « (à 60) ».
- **Dossier `sprites/` absent du snapshot** : nombre d'images, dimensions, origines et masques de collision des sprites sont **non trouvés**, sauf ceux déductibles des tables du viseur laser (scripts/scr_setCoordinatesOfLaser/scr_setCoordinatesOfLaser.gml) : `spr_EngiBot_shot` 3 images, `spr_EngiBot_shotTuret` 14, `spr_EngiBot_move` 12, `spr_PetBot_move` 8, `spr_PetBot_shot` 15, `spr_BadaBot_move` 22, `spr_BadaBot_stand` 1, `spr_BadaBot_fire2` 4. Origines citées en commentaire : PetBot (43,73), EngiBot_shotTuret (59,83), BadaBot_move (130,137).
- Le jeu de ce snapshot est un **coop local** (1 clavier/souris + jusqu'à 4 manettes). Tout le code réseau côté joueur est commenté (objects/obj_localPlayer/Alarm_1.gml, Other_4.gml, fin de scripts/scr_createAndSendNewBullet/scr_createAndSendNewBullet.gml).

---

## 1. obj_localPlayer (parent de tous les héros) et obj_localPlayer_jambes

### 1.1 Métadonnées

- obj_localPlayer : pas de parent, sprite par défaut `spr_hero1_stand`, **persistent = true** (le héros et ses PV survivent aux changements de room), `solid = true` posé dans Create (objects/obj_localPlayer/obj_localPlayer.yy, Create_0.gml).
- Événements : Create, Destroy, Alarm 0/1/2/3/4/5/7/8, Step, End Step, Draw, Draw GUI, Room Start, Game End, KeyRelease 65 (A), 72 (H), 74 (J). **Aucun événement de collision** sur l'objet (voir 1.6).
- obj_localPlayer_jambes : aucun événement, sprite par défaut `spr_PetBot_jambes`. Une instance est créée par héros à `depth+1` avec `sprite_index = legs_type` si `legs_type != noone` (objects/obj_localPlayer/Create_0.gml). Pilotée par scr_setLegsMovements (voir 3.8).

### 1.2 Variable Definitions du parent (obj_localPlayer.yy)

| Variable | Valeur par défaut | Rôle |
|---|---|---|
| walkingMaxSpd | 10 | vitesse de marche (px/step) |
| legs_type | noone | sprite des jambes |
| rotateFriction | 15 | rotation max du corps (degrés/step) |
| canMove | True | |
| enableDeploy | False | animation de déploiement à l'apparition (voir 3.7) |
| enableStandardFire1 | True | autorise scr_fire1Check |
| shot1PerSec | 5 | cadence tir primaire (tirs/s) |
| shot2PerSec | 2 | cadence/cooldown tir secondaire |
| shot1_bullet_type | obj_bullet1 | projectile primaire |
| precision | 3 | dispersion ± degrés |
| maxMunition | 99 | munitions max |
| energyCostForFire2 | 1 | coût énergie du secondaire |
| staticFire2 | false | immobilise pendant l'état "firing2" |
| shot1_bullet_count | 1 | projectiles par tir |
| fire1Sound / fire2Sound | snd_petBot_fire1 | |
| deploiementSound | snd_batBot_deploiement | |
| bonusDuration | 10*room_speed | durée des bonus (600 steps = 10 s à 60) |
| attackSpeedBonusFactor | 0.5 | +50 % de cadence sous bonus vitesse |
| moveSpeedBonusFactor | 0.5 | +50 % de walkingMaxSpd sous bonus vitesse |
| canDie | **False** | voir 7.1 |
| mainColor | $FF000000 | couleur du héros (flèche hors écran) |

### 1.3 Variables de Create (objects/obj_localPlayer/Create_0.gml)

Générales : `size = 2` ; `controller = noone` ; `playerNumber = -1` ; `playerId = noone` ; `playerName = ""` ; `state = "standing"` ; `depth = 0` ; `solid = true`.

Déplacement : `currentSpeed = walkingMaxSpd` ; `objectBlockingMovement` = liste [obj_mur_parent, obj_decor_base, obj_localPlayer, obj_localNpc] (scripts/scr_createobjectBlockingMovementList) ; `deployed = false`.

Arme : `relativeBoutCanonX = 185`, `relativeBoutCanonY = -4` (surchargés par chaque héros) ; `currentMunition = maxMunition` ; `scr_setFireImageSpeed(spr_hero1_shot, shot1PerSec)`.

Dash : `dashing = false` ; `dashTime = 0.3` **[INACHEVÉ, jamais lu]** ; `dashSpeed = 3 * currentSpeed` ; `dashNumber = 2` ; `dashCooldown = 2` (secondes) ; `dashTargetX = dashTargetY = noone`. Bump : `bump = false`.

Santé : `maxHealth = 12` ; `currentHealth = maxHealth` ; `percentOfOneHp = 0` (accumulateur de soin fractionnaire). **Aucun héros ne surcharge maxHealth : les 4 héros ont 12 PV.**

Énergie : `maxEnergy = 3` ; `currentMaxEnergy = maxEnergy` ; `currentEnergy = maxEnergy` ; `energyRegen = 0.5` (par seconde) ; `currentEnergyRegen = energyRegen` ; `pauseEnergyRegen = false` ; `energyStack = 0`.

Link : `linkTarget = noone` ; `internalLinkColor = c_red` ; `externalLinkColor = c_aqua` ; `internalLinkRatio = 0.3` ; `linkDistanceMin = 100` ; `linkDistanceMax = 1000` ; `linkPower = 1` ; `linkWeightMin = 5` ; `linkWeightMax = 13` ; `linkEnergyDegen = -3*energyRegen` (= -1.5) ; `linkedHeros = ds_list_create()` ; `overChargedDegen = -0.5` ; `timePerEnergyTic = 1 * room_speed`.
**[INACHEVÉ]** : seuls `linkTarget`, `linkDistanceMax`, `linkedHeros`, `overChargedDegen`, `timePerEnergyTic` sont utilisés ; les couleurs, ratios, épaisseurs, `linkDistanceMin`, `linkPower`, `linkEnergyDegen` ne servent qu'à du code commenté/obsolète.

Résurrection : `resurectAllie = noone` ; `resurectDuration = 3*room_speed` ; `countdownResurection = noone`.

Divers : `onSpawnVehicle = false` ; `bonusList` = liste de 2 emplacements [noone, noone] ; `bonusInvincible = bonusSpeed = bonusEnergy = false` ; `currentInvincibiliteDuration = currentSpeedDuration = currentEnergyDuration = -1` ; `glitch = noone` ; `sprites` et `imageSpeeds` = ds_map (état → sprite / image_speed).

Alarmes initiales : `alarm[1] = 1`, `alarm[5] = 0.5 * room_speed`, toutes les autres à -1.

Instances créées par Create : jambes (si `legs_type`), `obj_camera` (si absente), un `obj_aimLaser` (`hero = id`), un `obj_compteurMunition` (sauf pour obj_BatBot) à `depth-1`, et le système de particules « vie basse » (scripts/scr_createLowLifeParticuleSystem).

### 1.4 Alarmes (objects/obj_localPlayer/Alarm_N.gml)

| Alarme | Effet |
|---|---|
| 0 | Fin du délai entre deux tirs primaires : `alarm[0] = -1; state = "standing"`. |
| 1 | Envoi des coordonnées au serveur : **[DÉSACTIVÉ]** (tout est commenté, l'alarme ne se relance pas). |
| 2 | Récupération du dash : si `dashNumber < 2` → `dashNumber++` et relance `dashCooldown * room_speed` (120 steps) ; si `dashNumber == 2` → arrêt. |
| 3 | « durée du dash ou bump » : `speed = 0`, `dashing = false`, `bump = false`. **[DÉSACTIVÉ de fait]** : aucun code n'arme `alarm[3]` sur un héros. |
| 4 | Tic de transfert d'énergie du link : si `linkTarget != noone && currentEnergy >= 1` → `currentEnergy--`, `linkTarget.currentEnergy++` ; relance `timePerEnergyTic` (60 steps). |
| 5 | Régénération d'énergie (détail en 6.1). Se relance toutes les `0.1 * room_speed` (6 steps), ou `2 * room_speed` après une pause. Le commentaire parle de « life regen » mais **il n'y a aucune régénération de PV**. |
| 7 | Compte à rebours du tir secondaire : événement vide, l'alarme sert uniquement de cooldown testé par les scripts. |
| 8 | Particules de vie basse : `part_emitter_burst` de 2 particules de chaque type. Armée par scr_setParticuleEmitterState : à 1 PV toutes les 0.2/0.4/0.5 s (tirage), à 2 PV 0.4/0.5/0.8 s, à 3 PV 0.8/1/1.2 s. |

Alarmes propres aux enfants : `alarm[9]` de obj_BatBot (rappel des battes, voir 2.2) ; `alarm[4]` de obj_RamBot (fin du godmode, héritage mort).

### 1.5 Ordre des scripts

**Step** (objects/obj_localPlayer/Step_0.gml), dans l'ordre :
1. scr_canMove
2. scr_detectKey
3. scr_dashCheck
4. scr_aimHero
5. scr_moveAndCollision
6. scr_setLegsMovements
7. scr_setLink
8. scr_updateLinkEnergyState
9. scr_bumpCheck
10. scr_setParticuleEmitterState
11. scr_setDead
12. scr_resurectAllie
13. scr_activateBonus
14. scr_bonusEffects
15. scr_deployHero
16. Conversion du soin : si `percentOfOneHp >= 1 && state != "dead"` → `percentOfOneHp = 0; currentHealth += 1; obj_score.totalHeal += 1`.
17. `currentHealth = clamp(currentHealth, 0, maxHealth)` ; `currentEnergy = clamp(currentEnergy, 0, 12)`.
18. Si `global.gamePaused` → `image_speed = 0`.

Les enfants appellent `event_inherited()` puis leurs scripts de tir : BadaBot → scr_fire1CheckBadaBot, scr_fire2CheckBadaBot ; EngiBot → scr_fire1Check, scr_EngiBot_fire2Check ; PetBot → scr_fire1Check, scr_PetBot_fire2Check.
**Exception : obj_BatBot n'appelle pas `event_inherited()`** et réécrit toute la séquence (objects/obj_BatBot/Step_0.gml) : scr_deployHero, scr_canMove, scr_detectKey, scr_dashCheck, scr_aimHero, scr_fire1CheckBatBot, scr_fire2CheckBatBot, scr_moveAndCollision, scr_setBatBotSprites, scr_setLegsMovements, scr_setLink, scr_updateLinkEnergyState, scr_bumpCheck, scr_setParticuleEmitterState, scr_setDead, scr_resurectAllie, scr_activateBonus, scr_bonusEffects, puis les mêmes clamps (sans incrément de `obj_score.totalHeal`).

**End Step** (Step_2.gml) : `scr_setSprites()` (sprite et image_speed selon `state`), puis arrêt du dash ou du bump si `place_meeting(x+hspeed, y+vspeed, obj_decor_base)`, puis arrêt si la bbox approche à moins de 10 px du bord de la room.

**Draw** (Draw_0.gml) : `draw_self()` ; flou de mouvement `scr_motionBlur(75, direction+180)` pendant un dash, `scr_motionBlur(60, …)` pendant un bump. Le dessin du lien par sprite est commenté.

**Draw GUI** (Draw_64.gml) : flèche hors écran vers le héros mort (voir 9.4) et icônes des 2 bonus stockés (voir 8).

**Destroy / Game End** : détruisent la healthBar, le laser, le cercle de lumière, le compteur de munitions du héros, les listes et l'émetteur de particules.

**Touches de debug** (événements clavier de obj_localPlayer) :
- A relâché (KeyRelease_65.gml) : ancien bascule de link — **[DÉSACTIVÉ]**, entièrement commenté.
- H relâché (KeyRelease_72.gml) : crée/rafraîchit un `obj_glitch` sur le héros (debug ; rend au passage le héros insensible aux balles tant que le glitch existe, voir 7.2).
- J relâché (KeyRelease_74.gml) : si le contrôleur du héros est le clavier → `currentHealth = 0; canDie = true` (suicide de debug, **seul endroit du code qui met canDie à true**).

### 1.6 Collisions

obj_localPlayer n'a aucun événement Collision. Les interactions passent par :
- le déplacement : `place_meeting` contre obj_mur_parent, obj_decor_base, obj_localPlayer, obj_localNpc (scripts/scr_calculMovingPoint) ;
- le dash/bump : arrêt contre obj_decor_base uniquement (Step_2.gml, scr_dashCheck) — un dash traverse donc PNJ et autres héros ;
- les balles ennemies : `instance_place(x,y,obj_localPlayer)` dans objects/obj_bullet_base/Step_0.gml → scripts/scr_bulletCollisionActionWithLocalPlayer ;
- les bonus : événements Collision ou `instance_place` côté bonus (voir 8) ;
- obj_bullet_robot_shield (coup de bouclier d'un PNJ) : événement Collision avec obj_localPlayer → dégâts + bump (voir 3.6) ;
- obj_sallyBot_hitBox : `instance_place` → dégâts (objects/obj_sallyBot_hitBox/Step_0.gml).

---

## 2. Les héros

### 2.0 Tableau comparatif

Valeurs effectives (défaut du parent sauf surcharge dans le `.yy` du héros ou son Create).

| | BadaBot | BatBot | EngiBot | PetBot |
|---|---|---|---|---|
| walkingMaxSpd (px/step) | 10 | 10 | **13** | 10 |
| PV max | 12 | 12 | 12 | 12 |
| Énergie max naturelle | 3 | 3 | 3 | 3 |
| shot1PerSec | **10** | **3** (1.5 avec 1 batte) | 5 | **3** |
| shot2PerSec | **4** | 2 | 2 | 2 |
| Projectile primaire | obj_bullet_BadaBot | obj_bullet_BatBot | obj_bullet_EngiBot | obj_bullet_PetBot |
| precision (± degrés) | 3 (3/6/9 selon charge) | **2** | **10** | 3 |
| maxMunition | **100** | 99 (inutilisé, pas de compteur) | **100** | 99 |
| energyCostForFire2 | 1 (seuil d'activation) | 1 à 4 (dynamique) | **3** | **3** |
| enableStandardFire1 | False | False | True | True |
| staticFire2 | False | **True** | false | false |
| legs_type | spr_BadaBot_jambes | spr_BatBot_jambes2 | spr_EngiBot_jambes | spr_PetBot_jambes2 |
| mainColor ($AABBGGRR) | $FFA94D54 → RGB(84,77,169) | $FF7CC2E0 → RGB(224,194,124) | $FF6C6CDE → RGB(222,108,108) | $FF96C790 → RGB(144,199,150) |
| Bout du canon (relativeBoutCanonX, Y) | (28, 0) | (65, 0) | (43, 57) | (90, 23) |
| Couleur du viseur laser | c_purple | pas de laser | c_red | c_green |
| Sons fire1 / fire2 | snd_badaBot_fire1_1..3 (tirage) / snd_badaBot_fire2_1..3 | snd_batBot_fire1_1 / snd_batBot_fire2_1 | snd_engiBot_tourelleFire_3 / snd_engiBot_fire2 (non joué) | snd_petBot_fire1 / aucun son joué |

(objects/obj_BadaBot/obj_BadaBot.yy, obj_BatBot.yy, obj_EngiBot.yy, obj_PetBot.yy et les Create_0.gml correspondants.)

Projectile de base — obj_bullet_base (obj_bullet_base.yy) : `speed = 40`, `maxDistance = 1500`, `damage = 1`, `explosive = false`, `explosionDamage = 20`, `explosionRange = 374`, `explosionObject = obj_bullet2_explosion`.
Step (objects/obj_bullet_base/Step_0.gml) : détruit au-delà de `maxDistance` depuis l'origine ; puis teste dans l'ordre obj_decor_base, le mobilier bloquant pré-calculé sur la trajectoire (`mobilierOnTheWay`, scripts/scr_getMobilierOnTheWayOfBullet, uniquement le mobilier `bulletCrossed == false`), obj_localNpc, obj_localPlayer. Draw : flou de mouvement de longueur `speed`. Destroy : si `explosive`, crée `explosionObject` avec `damage = explosionDamage`, `range = explosionRange`.
Création (scripts/scr_createAndSendNewBullet) : position = bout du canon tourné selon `image_angle` (ou position du héros si `useWeaponPos == false`), `direction = image_angle + random_range(-precision, precision)`, `owner = "hero"`.
Dégâts aux PNJ (scripts/scr_bulletCollisionActionWithLocalNpc) : un même projectile ne touche pas deux fois de suite le même PNJ (`lastHitId`) ; robot-bouclier (obj_npc_robot_shield) touché seulement si l'angle d'impact est à plus de 140° de sa face ; `invulnerable` respecté ; la balle est détruite (sauf BatBot et EngiBot, voir plus bas).
**Pas de tir ami** : scr_bulletCollisionActionWithLocalPlayer ne traite que `owner == "ennemi"`.

Explosions — obj_explosion_parent (objects/obj_explosion_parent/Step_0.gml, .yy : `range = 1`, `damage = 3`) : le sprite est mis à l'échelle pour que sa largeur vaille `range` ; touche **une seule fois** chaque obj_localNpc non `invulnerable` dans un cercle de rayon `range/2`, sans obj_mur_parent sur la ligne de vue ; robot-bouclier touché seulement de dos (≥ 140°) ; détruite à la fin de son animation (durée : non trouvée, dépend du sprite). **Les explosions ne blessent jamais les héros.** obj_explosion et obj_bullet2_explosion (sprite `spr_bullet2_explosion`) n'ajoutent rien ; obj_plasma_explosion ajoute une rotation et un son ; obj_explosion_robot est purement visuel (mort d'un héros).

### 2.1 BadaBot (tank à boule de plasma et bouclier)

Create (objects/obj_BadaBot/Create_0.gml) : `relativeBoutCanon = (28, 0)` ; `releaseBullet = false` ; `shieldSize = 1` et `shieldBuffFactor = 0.65` **[INACHEVÉ : jamais lus]** ; `loadingFire1Time` calculé mais jamais lu ; crée un `obj_plasmaBawl` (`parent = id`, `depth-1`) ; image_speed "dashing" = 0.5 ; cercle de lumière (96,164,103,171).

**Tir primaire — tir chargé** (scripts/scr_fire1CheckBadaBot, scripts/scr_animPlasmaBawl, objects/obj_plasmaBawl) :
1. Tant que fire1 est maintenu (et `alarm[0] == -1`, pas de dash, déployé, `currentMunition > 0`, pas en train de ressusciter), la boule passe en animation `spr_plasmaBawl_loading` et `currentCharge` repart de 1 puis augmente de 1 par step jusqu'à `fullChargeDuration = 60` (obj_plasmaBawl.yy).
2. Au relâchement de fire1, la boule joue `spr_plasmaBawl_shot` et, si `alarm[0] < 0`, pose `releaseBullet = true` sur le héros.
3. Le héros tire alors `shot1_bullet_count = 1 + (currentCharge-1) div 20` projectiles, soit **1 balle (charge 1–20), 2 balles (21–40), 3 balles (41–60)**, avec `precision = 3 + ((currentCharge-1) div 20) * 3`, soit ± 3°, 6°, 9°. Un simple clic donne 1 balle.
4. `alarm[0] = room_speed / (shot1PerSec × (1 + 0.5 si bonus vitesse))` = 6 steps à 60 (4 sous bonus) ; `currentMunition -= shot1_bullet_count`.
5. L'état "firing1" réutilise le sprite de l'état courant : on peut donc tirer en marchant et **en tenant le bouclier** (Alarm_0 de BadaBot remet `state = "firing2"` si fire2 est tenu, sinon "standing").

Projectile obj_bullet_BadaBot (obj_bullet_BadaBot.yy, Create_0.gml) : vitesse 40, portée 1500, **dégât direct 0**, `explosive = True`, `explosionObject = obj_plasma_explosion`, `explosionDamage = 20` (défaut), `explosionRange = 100` (donc rayon 50 px), échelle 0.25. Explose à toute destruction (impact mur, PNJ, ou fin de portée).
- **[BOGUE probable]** Contre du mobilier bloquant, scripts/scr_bulletCollisionActionWithMobilierParent crée en plus un `obj_bullet2_explosion` de dégât 20 avec le `range` par défaut 374 (rayon 187 px) : l'explosion est ~3,7 fois plus large sur un meuble que sur un mur.
- **[BOGUE]** `currentMunition` peut devenir négatif (3 balles tirées avec 1 munition restante), auquel cas le compteur ne clignote pas (il teste `== 0`).
- **[BOGUE multi]** Le script lit `obj_plasmaBawl.currentCharge` (première instance de l'objet), pas la boule du héros : faux avec deux BadaBot.
- Le calcul commenté `ratio = currentCharge/fullChargeDuration` (dégâts proportionnels à la charge) est **[DÉSACTIVÉ]**.

**Tir secondaire — bouclier** (scripts/scr_fire2CheckBadaBot, objects/obj_BadaBot_shield) :
1. Appui fire2 avec `currentEnergy >= 1` et `alarm[7] < 0` : `alarm[7] = room_speed/shot2PerSec` = 15 steps, `state = "firing2"`, `currentSpeed = walkingMaxSpd/2` (**vitesse 5**), son aléatoire, pause de régénération si personne ne le lie.
2. À partir de l'image 2 de `spr_BadaBot_fire2`, l'animation se fige ; le sprite est remplacé par une copie d'origine (158,133) avec masque rectangulaire 88×88 (scripts/scr_duplicateFire2SpriteBadaBot), le héros est avancé de 17 px (anti-blocage) et un `obj_BadaBot_shield` invisible est créé, collé au héros (même position, même angle).
3. Tant que fire2 est tenu et `currentEnergy > 0` : la régénération est mise en pause à chaque step (si aucun allié lié). **Aucun coût d'activation ni drain continu.** Toute balle `owner == "ennemi"` qui touche le bouclier est détruite et incrémente `bulletTanked` (objects/obj_bullet_base/Collision_…gml) ; **toutes les 3 balles encaissées** (`tankedBulletPerEnergyBar = 3`, obj_BadaBot_shield.yy) → `currentEnergy--`.
4. Relâchement ou énergie à 0 : bouclier détruit, héros reculé de 17 px, vitesse rétablie, fin d'animation puis "standing".
- Forme exacte de la zone protégée : dépend du masque de `spr_BadaBot_shield` — **non trouvé**.
- `staticFire2 = False` : le BadaBot se déplace (à mi-vitesse) bouclier levé.

### 2.2 BatBot (mêlée à deux battes, battes lançables)

Create (objects/obj_BatBot/Create_0.gml) : `shot1PerSec2 = shot1PerSec/2` (= 1.5) ; `relativeBoutCanon = (65, 0)` ; bras : `relativeBrasX = 17`, `relativeBrasDroitY = 50`, `relativeBrasGaucheY = -50` ; `maxNumberOfBatte = 2` ; `numberOfBatte = 2` ; `fire1_droite = true` ; `actionDefiniedForFire2 = false` ; image_speed "dashing" = 1 ; cercle de lumière (80,114,85,154). Pas de compteur de munitions ni de laser. Sprites de marche/mort selon le nombre de battes en main (`spr_BatBot_move_0/1/2`, `spr_BatBot_mort_0/1/2`, scripts/scr_setBatBotSprites).

**Tir primaire — coup de batte** (scripts/scr_fire1CheckBatBot) :
1. fire1 maintenu (pas de dash, pas fire2, déployé, vivant, pas en résurrection) et `numberOfBatte != 0` → `state = "firing1"`. **Sans batte en main, aucune attaque primaire.**
2. Avec 2 battes : alternance droite/gauche (`spr_BatBot_fire1_d` / `_g`) ; avec 1 batte : `spr_BatBot_fire1_gg`.
3. À chaque coup : création d'un obj_bullet_BatBot **à la position du héros** (pas au bout du canon), `alarm[0]` = `room_speed/shot1PerSec − 2 × (sprite_get_speed(spr_BatBot_fire1_d)/room_speed)` avec 2 battes (≈ 20 steps moins un dixième du nombre d'images du sprite, non trouvé), ou `room_speed/shot1PerSec2` = 40 steps avec 1 batte. Le bonus vitesse multiplie la cadence par 1,5.
4. Pas de munitions consommées.

Hitbox obj_bullet_BatBot (obj_bullet_BatBot.yy, Create_0.gml, Step_0.gml) : `speed = 0`, **invisible**, dégât 1, durée de vie **10 steps**, masque `spr_bullet_BatBot_d` ou `_g` selon le bras (dimensions non trouvées). Touche chaque PNJ une fois, seulement s'il n'y a pas d'obj_mur_parent entre le BatBot et le PNJ ; n'est pas détruite à l'impact ; casse les fenêtres.

**Tir secondaire — lancer / rappel de batte** (scripts/scr_fire2CheckBatBot, scr_BatBot_lanchBatte, scr_BatBot_recallBatte, scr_getBatteTypeForFire2, objects/obj_BatBot/Alarm_9.gml) :
- Coût recalculé à chaque step selon l'énergie : **1** (énergie < 4), **2** (4 à 6), **3** (7 à 9), **4** (≥ 10). Ce coût est aussi le « niveau » de la batte lancée.
- Appui fire2 : arme `alarm[9] = 15` steps.
- **Appui court** (relâché avant 15 steps) avec au moins 1 batte en main, `currentEnergy >= coût` et `alarm[7] <= 0` → **lancer** : batte droite (obj_bullet_batte_d) si 2 en main, sinon gauche (obj_bullet_batte_g) ; `alarm[7] = room_speed/shot2PerSec` = 30 steps ; `state = "firing2"` (immobile pendant l'animation car `staticFire2 = True`) ; `currentEnergy -= coût` ; `numberOfBatte--` ; pause de régénération si non lié.
- **Appui long** (15 steps écoulés, Alarm 9) avec `currentEnergy >= 1` → **rappel** : toutes ses battes au sol passent en `returnToBatBot` ; coûte **1 énergie** seulement si au moins une batte n'était pas déjà en retour.
- **[BOGUE/à trancher]** Si l'appui court ne peut pas lancer (0 batte en main ou énergie insuffisante), `alarm[9]` n'est pas annulée et déclenche quand même un rappel à son échéance.

Batte lancée obj_bullet_batte_parent (obj_bullet_batte_parent.yy, Create_0.gml, Step_0.gml, scripts/scr_createAndSendNewBulletBatBot, scr_setBatteHit) : `bulletSpeed = 25`, `maxDistance = 1500`, `damage = 3`, dispersion ± 2°.

| Niveau (= coût) | Énergie requise | Effet |
|---|---|---|
| 1 | 1 à 3 | dégât direct 3 |
| 2 | 4 à 6 | explosive : `explosionRange = 500` (rayon 250), `explosionDamage = 4` ; dégât direct annulé |
| 3 | 7 à 9 | explosive : `explosionRange = 1000` (rayon 500), `explosionDamage = 7` |
| 4 | ≥ 10 | comme 3 + `canPierce = true` (traverse les ennemis) |

Comportement : à l'impact d'un PNJ (non perçante) → dégâts une fois, passage en état « hit » (explosion `obj_explosion` si explosive, sprite d'impact, `batteStoped = true`). Mur ou porte → rebond + « hit ». Fenêtre intacte → brisée, la batte continue. Mobilier bloquant → rebond + « hit ». Au-delà de 1500 px ou à moins de 70 px du bord de room → « hit ». En état « hit » elle glisse (vitesse 0 sur les 4 premières images, 12.5 ensuite, puis décélération de 25/48 par step) puis reste au sol, signalée par une flèche hors écran violette (Draw_64.gml).
Récupération : la batte est reprise (`numberOfBatte++`) quand elle touche le BatBot en étant arrêtée ou en retour — donc **marcher dessus suffit, sans coût**. En retour, elle vole vers le bras à 25 px/step tant qu'aucun décor bloquant n'est sur la ligne, ignore les murs et peut de nouveau blesser (dégât 3).
- **[BOGUE probable]** Batte perçante (niveau 4) : crée un `obj_explosion` (dégât 7, rayon 500) **à chaque step** de chevauchement avec un PNJ, chaque explosion ayant sa propre liste de cibles.
- À la mort du BatBot, toutes les battes lancées sont détruites et `numberOfBatte = 2` (scripts/scr_setDead).

### 2.3 EngiBot (mitrailleur à balles rebondissantes, tourelle)

Create (objects/obj_EngiBot/Create_0.gml) : `relativeBoutCanon = (43, 57)` ; `turretPrecision = 1` ; `turret = noone` ; `fire1Sprite = spr_EngiBot_shot` ; cercle de lumière (19,99,43,123). Sprite "standing" = `spr_EngiBot_shot` figé.

**Tir primaire** (scripts/scr_fire1Check) : fire1 maintenu (pas de dash, pas fire2, déployé, `currentMunition > 0`, pas en résurrection) → 1 balle tous les `room_speed/shot1PerSec` = **12 steps** (8 sous bonus vitesse), `currentMunition -= 1`, dispersion **± 10°**.
Projectile obj_bullet_EngiBot (Create_0.gml, Step_0.gml) : vitesse initiale 40, **décélère de 0.2 px/step** (`speed = lerp(speed-1, speed, 0.8)`), détruit quand `speed < 1` ou à plus de 1500 px de son origine ; dégât 1 ; rotation visuelle aléatoire. **Rebondit** : sur mur/porte/mobilier (vitesse ÷ 2, recul de 20 px), sur PNJ (dégât 1 puis vitesse ÷ 4) ; n'est jamais détruit par un impact. Détruit normalement face à un robot-bouclier.

**Tir secondaire — tourelle** (scripts/scr_EngiBot_fire2Check, scr_reployTurret, objects/obj_turret_EngiBot) :
1. fire2 sans fire1, déployé, `alarm[7] <= 0` ; dans tous les cas `alarm[7] = room_speed/shot2PerSec` = 30 steps.
2. Si une tourelle existe à 20 px ou moins → elle est **repliée** (gratuit, pas de remboursement d'énergie).
3. Sinon, si `currentEnergy >= 3` : l'ancienne tourelle est repliée, `state = "firing2"` (animation `spr_EngiBot_shotTuret`, 14 images, 0.5 s).
4. À la fin de l'animation : tourelle créée au bout du canon, direction = `image_angle ± 1°`, **`level = floor(currentEnergy/3)`** (1 à 4), puis `currentEnergy = currentEnergy mod 3` (**consomme toutes les barres pleines**), pause de régénération si non lié. **Une seule tourelle à la fois.**
- **[BOGUE]** Le score ajoute `currentEnergy mod 3` à `totalUsedEnergy` au lieu de l'énergie réellement dépensée.

Tourelle obj_turret_EngiBot (obj_turret_EngiBot.yy : `attack_range = 1000`, `shot1_bullet_count = 1`, `precision = 5`, `frict = 6`, `aliveDuration = 15` ; Create_0.gml, Step_0.gml) :
- Lancée à vitesse 40, perd 2 px/step (arrêt en 20 steps, ~380 px), rebondit sur le décor (vitesse ÷ 2) ; puis animation de déploiement (`spr_turet_deploy`, durée non trouvée) ; puis état "deployed".
- Déployée : `image_index = level - 1`, **cadence = `level` tirs/s** (1 à 4) ; cible le PNJ vivant le plus proche en ligne de vue (ni mur ni porte, scripts/src_getTheNearestVisibleEnnemyForTurret), champ 360°, portée 1000 ; pivote de 6°/step et ne tire qu'une fois alignée ; tire des **obj_bullet_pistol** (valeurs de base : vitesse 40, dégât 1, portée 1500) avec ± 5°.
- `maxHealth = 100` mais rien ne l'endommage ; `aliveDuration` **[INACHEVÉ : jamais lu]** → la tourelle est permanente jusqu'au repli. Non persistante : elle disparaît au changement de room (la variable `turret` du héros n'est alors pas remise à `noone` — **incertitude**, risque d'erreur au fire2 suivant).
- obj_bulletTurret existe (dégât 1) mais **n'est pas utilisé** ; scripts/scr_getTargetEnnemyForTurret est **vide**.

### 2.4 PetBot (soigneur, drones explosifs)

Create (objects/obj_PetBot/Create_0.gml) : `relativeBoutCanon = (90, 23)` ; `relativeBaseCanon = (35, 23)` ; `fire1Sprite = spr_PetBot_shot` ; image_speed "deploying" = 0.5 ; cercle de lumière (26,60,19,126).

**Tir primaire** (scripts/scr_fire1Check) : 1 balle tous les `room_speed/3` = **20 steps** (≈ 13 sous bonus vitesse), `currentMunition -= 1`, dispersion ± 3°.
Projectile obj_bullet_PetBot (obj_bullet_PetBot.yy, Step_0.gml) : **vitesse 20**, dégât 1, portée 1500. Contre un PNJ : dégât 1, détruit. Contre un **autre héros vivant** : si `0 < currentHealth < maxHealth` → **+1 PV** ; la balle est détruite dans tous les cas (les alliés font écran). **[MULTI]** pour le soin.

**Tir secondaire — salve de 3 drones** (scripts/scr_PetBot_fire2Check, objects/obj_PetDrone, obj_PetDrone_explosion) :
1. fire2 avec `currentEnergy >= 3` (vivant) : crée **3 obj_PetDrone** à la position du héros, direction = `image_angle + irandom_range(-10, 10)`, portées **550, 700 et 850 px** (`400 + 150*(i+1)`), `level = floor(currentEnergy/3)` (1 à 4).
2. `currentEnergy = 0` (**consomme toute l'énergie**), pause de régénération si non lié. Pas de cooldown `alarm[7]`, pas de test `deployed`, pas de son.
3. Drone (obj_PetDrone.yy `maxSpd = 15`, Create_0.gml, Step_0.gml) : accélère de 0.5 px/step jusqu'à 15 ; détruit en atteignant sa portée, ou au contact d'un mur/porte, de mobilier bloquant ou d'un PNJ (brise les fenêtres intactes).
4. À sa destruction : obj_PetDrone_explosion de sprite `spr_PetDrone_explosion<level>` ; `range` = largeur du sprite (non trouvée, croît vraisemblablement avec le niveau) ; **dégât 3** (défaut de obj_explosion_parent) une fois par PNJ dans le rayon ; **soin de zone** : à partir de l'image 7 et jusqu'à la fin de l'animation, chaque héros vivant et blessé dans le rayon gagne `percentOfOneHp += 4/room_speed` par step, soit **1 PV tous les 15 steps** d'exposition, cumulable entre explosions. Ce soin s'applique aussi au PetBot lui-même (fonctionne en solo).
- **[DÉSACTIVÉ]** Les scripts scr_PetDrone_activeMovements, scr_PetDrone_passiveMovements, scr_PetDrone_setPathToTarget, scr_PetDrone_setState, scr_PetDrone_attack_heal, scr_PetBot_targetOnMouse (ancien drone-familier à réservoir qui attaquait puis soignait) ne sont appelés nulle part ; seul scr_PetDrone_movementSpeed sert.

### 2.5 NanoBot et RamBot

**Plus sélectionnables.** La liste de sélection du menu actuel est `availableHero` = obj_BatBot, obj_PetBot, obj_RoomCreator, obj_BadaBot, obj_EngiBot (objects/obj_btn_player/Create_0.gml ; héros initial tiré au hasard dans cette liste, scripts/scr_playerButtonActions). obj_RoomCreator est un outil d'édition, pas un héros.
- obj_btn_scrollHero (ancien menu réseau) ne propose que "PetBot", "BatBot", "RoomCreator" et envoie des paquets réseau ; scripts/scr_getLocalPlayerType connaît encore "NanoBot" et "RamBot" (et écrit "EginBot" pour EngiBot — **[BOGUE]** de frappe) mais n'est appelé que par scripts/scr_receivedPacket_client. **[DÉSACTIVÉ / vestige réseau]**.
- scripts/scr_getNameOfChar retire juste le préfixe "obj_" du nom d'objet.
- obj_NanoBot (Create seul) : `runningMaxSpd = 12`, obj_bullet1, precision 3, sprites `spr_hero1_*` ; pas de Step → ne peut pas tirer.
- obj_RamBot : `runningMaxSpd = 7`, `shot1PerSec = 30`, obj_bullet4 (dégât 5), precision 12, « godmode » de 5 s max drainant l'énergie ; son Step dépend de `global.playerId` et de obj_chatTyping (réseau). Tous deux utilisent des variables et sprites de l'ancien système : **non fonctionnels en l'état**.
- Autres vestiges non référencés : obj_energyWall (mur d'énergie de 5 s absorbant les balles), obj_bullet2, obj_bullet4, obj_bulletTurret, obj_particule1.

### 2.6 obj_aimLaser (viseur)

Un par héros (objects/obj_aimLaser, scripts/scr_calculAndDrawLaser, scr_setCoordinatesOfLaser) : trait de **200 px** partant du canon (coordonnées par image de sprite), raccourci au premier obj_decor_base ; couleur vert (PetBot), rouge (EngiBot), violet (BadaBot) ; se détruit pour tout autre héros (BatBot). Alpha 0.5 en tir / 0.3 sinon (0.7 / 0.4 pour le vert). Purement visuel.

---

## 3. Déplacement et visée

### 3.1 scr_detectKey
Recopie l'état du contrôleur dans le héros (`dashKey`, `fire1`, `fire2`, `useKey`, `useKeyPressed`, `linkKey`, `bonus1Key`, `bonus2Key`, plus `jumpKey` = dashKey, inutilisé) — **sauf pendant un bump ou quand le menu pause existe** (les valeurs restent alors figées à leur dernier état).

### 3.2 scr_getPlayerMoveDirection
Clavier : `horizontalValue = droite − gauche`, `verticalValue = bas − haut` → 8 directions. Manette : stick gauche (`lJoyHValue`, `lJoyVValue`, zone morte 0.40). Retourne un angle ou `noone`. **La vitesse est constante : l'amplitude du stick n'est pas prise en compte.**

### 3.3 scr_moveAndCollision (+ scr_calculMovingPoint)
- Si pas de dash et `canMove` : vitesse du step = `currentSpeed + bonusSpeed × moveSpeedBonusFactor × walkingMaxSpd` (soit ×1,5 sous bonus vitesse pour un héros à vitesse normale).
- Déplacement de `spd` px dans la direction ; si bloqué (mur, décor, autre héros, PNJ), essais à ±10°, ±20° … ±80° (**glissement le long des obstacles**) ; sinon anti-blocage.
- Position bornée à la vue maximale de la caméra moins une marge : `obj_camera.x ± (maxViewWidth/2 − 300)`, idem en y (maxView = 2880×1620) — les héros ne peuvent pas s'éloigner indéfiniment les uns des autres.
- Position bornée à la room avec 70 px de marge (sauf sur le véhicule de largage).
- États : "walking" si déplacement (sauf si "firing1"/"firing2"), sinon "standing".

### 3.4 scr_aimHero et scr_setCharacterImageAngleWithFriction
Actif si pas de dash, déployé, pas de bump, vivant, pas de menu pause.
- Clavier/souris : l'angle demandé est corrigé pour que **le bout du canon** (et non le centre du héros) pointe vers un point situé 150 px au-delà du curseur ; `direction` = angle héros → souris.
- Manette : stick droit, point visé à 500 px ; stick au repos → l'angle est conservé.
- Rotation limitée à `rotateFriction = 15°` par step (alignement direct si l'écart est ≤ 15°).

### 3.5 scr_canMove
`canMove = false` si : non déployé, mort, en train de ressusciter un allié, en bump, en "firing2" avec `staticFire2` (BatBot uniquement), ou menu pause ouvert. Sinon true.

### 3.6 scr_dashCheck et scr_bumpCheck
Dash :
- Déclenchement : `dashKey` (appui) **et `state == "walking"`** (il faut se déplacer ; impossible pendant les états "firing1"/"firing2", donc pas de dash en tirant ni bouclier levé), `dashNumber > 0`, pas déjà en dash, `canMove`, pas de bump.
- Direction = direction de **déplacement** (pas de visée). Cible à **500 px**. Annulé si un obj_decor_base se trouve à un pas de dash devant.
- Vitesse `dashSpeed = 3 × currentSpeed`, recalculée chaque step : **30 px/step** (EngiBot 39) → environ 17 steps (≈ 0.28 s à 60) pour 500 px.
- **2 charges** ; chaque dash relance `alarm[2] = 120` steps (2 s) ; à l'échéance +1 charge puis nouvelle attente de 2 s si la seconde manque.
- Fin : à moins de 2 px de la cible, collision avec obj_decor_base, bord de vue caméra (marge 150 px), bord de room (10 px).
- Pendant le dash : ni visée ni déplacement ni tir primaire ; **aucune invulnérabilité** ; flou de mouvement ; traverse PNJ et héros.
- **[INACHEVÉ]** `dashTime = 0.3` et l'Alarm 3 ne sont pas utilisés ; l'état "dashing" (présent dans les maps de sprites) n'est jamais affecté.

Bump : uniquement déclenché par obj_bullet_robot_shield (objects/obj_bullet_robot_shield/Collision_…gml, `bumpSpeed = 15`) : le héros est projeté de **350 px** à 15 px/step dans la direction du coup, perd `damage` PV (1, sauf invincibilité ; ce coup ignore la protection du glitch), et perd le contrôle (`canMove = false`, touches figées) jusqu'à l'arrivée, un décor ou un bord. scr_bumpCheck gère les mêmes conditions de fin que le dash.

### 3.7 scr_deployHero
Si `enableDeploy` : animation "deploying" (son à l'image 1) puis `deployed = true` ; sur le véhicule de largage, état "notDeployed" figé. Sinon `deployed = true` immédiatement.
**`enableDeploy = False` pour tous les héros** (aucune surcharge) : **[DÉSACTIVÉ]** l'animation de déploiement n'est jamais jouée dans ce snapshot, bien que les sprites `spr_*_deploy` et les sons existent. Tant que `deployed == false` : pas de mouvement, visée, tir, ni dégâts subis.

### 3.8 scr_setLegsMovements
Jambes visibles si déployé et `canMove` ; collées au héros ; `image_angle` = direction de déplacement et animation active en mouvement ; image 0 figée à l'arrêt ; masquées sinon. Le haut du corps suit la visée, les jambes suivent le déplacement.

### 3.9 scr_setSprites, scr_setMoveImageSpeed, scr_setFireImageSpeed
- scr_setSprites (End Step) : `sprite_index = sprites[state]`, `image_speed = imageSpeeds[state]`. États utilisés : "deploying", "notDeployed", "standing", "walking", "firing1", "firing2", "dead" ("dashing" défini mais jamais atteint).
- scr_setMoveImageSpeed(sprite, vitesse, 256) : règle la vitesse du sprite pour **un cycle d'animation par 256 px parcourus** (`images × room_speed × vitesse / 256` images/s).
- scr_setFireImageSpeed(sprite, tirsParSec) : `images × tirsParSec` images/s, soit **un cycle d'animation par tir**.

---

## 4. Commandes

Architecture (objects/obj_controller_parent, obj_controller_keyboard, obj_controller_xbox) : un objet contrôleur persistant par périphérique, qui expose des booléens lus par le héros via `controller.xxx`. obj_controller_keyboard est toujours contrôleur principal ; obj_controller_xbox crée automatiquement une instance par manette connectée (jusqu'à 4), zone morte `joystickDeadzone = 0.40` (obj_controller_xbox.yy). Couleur par joueur : 1 bleu, 2 rouge, 3 vert, 4 jaune.

**scripts/scr_createObjectBindAction n'a rien à voir avec les commandes du joueur** : c'est un outil de l'éditeur de room (molette pour redimensionner/tourner/teinter l'objet sélectionné).

### 4.1 Clavier / souris (scripts/scr_nameControllerBindsKeyboard) — disposition AZERTY

| Action | Touche | Mode |
|---|---|---|
| Déplacement | Z / Q / S / D ou flèches | maintenu |
| Visée | position de la souris | — |
| Tir primaire (fire1) | clic gauche | maintenu |
| Tir secondaire (fire2) | clic droit | maintenu |
| Dash | Espace ou Maj | appui |
| Utiliser (boutons, portes à carte, WC) | E ou Entrée | appui |
| Ressusciter | E ou Entrée | **maintenu** |
| Link | A | **maintenu** |
| Bonus emplacement 1 / 2 | 1 / 2 (rangée du haut) | maintenu |
| Pause | Échap | appui |
| Annuler (menus, ferme la pause) | Échap | appui |
| Valider (menus) | E ou Entrée ; Entrée = Start | appui |
| Navigation menus | flèches ou Z/Q/S/D | appui |
| Taunt | T | lu (`tauntKey`) mais **[INACHEVÉ]** aucun effet |
| Saut (`k_bindJump` = Espace) | — | **[INACHEVÉ]** confondu avec le dash |

L'écran d'aide (objects/obj_keyboard_command/Create_0.gml) affiche « WASD : Move » alors que le code lit ZQSD — **[BOGUE d'affichage]**.

Touches de debug : H (glitch), J (tuer son héros et activer canDie) sur obj_localPlayer ; F1 à F5 sur obj_gui (grille, portées PNJ, zones de patrouille, chemins, portée des portes) ; F9 sur obj_camera (mode debug si RoomCreator présent) ; F12 sur obj_musicController (non analysé).

### 4.2 Manette Xbox (scripts/scr_nameControllerBindsXbox)

| Action | Bouton |
|---|---|
| Déplacement | stick gauche |
| Visée | stick droit |
| Tir primaire | RB ou RT (`gp_shoulderr`, `gp_shoulderrb`), maintenu |
| Tir secondaire | LB ou LT (`gp_shoulderl`, `gp_shoulderlb`), maintenu |
| Dash | A (`gp_face1`), appui |
| Utiliser / Ressusciter | X (`gp_face3`), appui / maintenu |
| Link | clic stick droit (`gp_stickr`), maintenu |
| Bonus 1 / 2 | croix gauche / croix droite, appui |
| Pause | Start |
| Annuler | B (`gp_face2`) |
| Valider (menus) | A |
| Navigation menus | stick gauche (seuil 0.4) ou croix, répétition 0.15 s ; boutons anti-rebond 5 steps |
| Taunt | Y (`gp_face4`) — **[INACHEVÉ]** aucun effet |

---

## 5. Munitions et rechargement

- **Il n'y a pas de rechargement pour les héros.** Aucune touche, aucun état, aucune alarme de recharge côté joueur. Les mots « reload / reloadingTime / amoQuantity » ne concernent que les PNJ soldats (scripts/scr_processFire, obj_localNpc_soldier).
- Stock : `currentMunition = maxMunition` à la création — **100** pour BadaBot et EngiBot, **99** pour PetBot ; BatBot n'en consomme pas.
- Consommation : 1 par tir (scripts/scr_fire1Check) ; BadaBot : 1 à 3 selon la charge (scripts/scr_fire1CheckBadaBot).
- À 0 : le tir primaire ne se déclenche plus (condition `currentMunition > 0`) ; les tirs secondaires restent disponibles (ils ne coûtent que de l'énergie).
- **Seule recharge : le bonus obj_bonus_ammo**, qui remet `currentMunition = maxMunition` (voir 8).
- Les munitions ne sont pas réinitialisées au changement de room (héros persistant).
- Affichage — obj_compteurMunition (un par héros sauf BatBot ; objects/obj_compteurMunition) :
  - GUI : texte « courant/max » à côté de la barre de vie (`healthBar.x+40, healthBar.y+30`, police fnt_2_large, contour noir) ;
  - dans le monde : nombre de munitions dessiné le long de l'arme, orienté comme le laser, pour EngiBot et PetBot seulement (exclu pour BadaBot) ; positions par image dans scripts/scr_setCoordinatesOfAmmoIndicator ;
  - à 0 munition : clignotement rouge/blanc toutes les 15 steps.
- Statistique : `obj_score.totalAmmoUsed++` à la création de chaque balle BadaBot/EngiBot/PetBot.

---

## 6. Énergie et link

### 6.1 Énergie (objects/obj_localPlayer/Alarm_5.gml, Step_0.gml, scripts/scr_updateLinkEnergyState)

- Valeur entière, bornée à **[0, 12]** à chaque step. Départ à 3. Maximum naturel **3** ; au-delà = surcharge (link ou bonus énergie).
- Tic de régénération toutes les 6 steps (0.1 s) :
  - si `0 <= currentEnergy < 3` : `energyStack += currentEnergyRegen × 0.1` (= +0.05) ; quand `abs(energyStack) == 1` → `currentEnergy += energyStack`, remise à 0. Soit **+1 énergie toutes les 2 s**.
  - si `currentEnergy > 3` et qu'aucun allié ne le lie : `energyStack += overChargedDegen × 0.1` (= −0.05) → **−1 énergie toutes les 2 s** jusqu'à 3.
  - à exactement 3 : rien.
- Pause : dès que `pauseEnergyRegen` est vrai, le tic suivant remet le drapeau à faux, vide `energyStack` et attend **2 s** avant de reprendre. Est posée par : usage d'un tir secondaire (si aucun allié ne lie le héros), résurrection en cours, bonus énergie, link actif (dans les deux sens, à chaque step → aucune régénération ni dégénérescence pendant un link).
- `currentMaxEnergy = max(maxEnergy, currentEnergy)` : recalculé mais sans usage en jeu.
- Remarque d'implémentation : le test `abs(energyStack) == 1` repose sur la tolérance d'égalité des réels de GameMaker ; dans un remake, compter en entiers (20 tics).
- Mort : `currentEnergy = 0`, `currentEnergyRegen = 0` (rétabli à la résurrection).

### 6.2 Link **[MULTI — sans effet en solo]** (scripts/scr_setLink, scr_updateLinkEnergyState, scr_getClosestInstanceInFront, objects/obj_particule_link)

**Le link est actif dans le code**, mais nécessite un second obj_localPlayer vivant.
- **Créer** : maintenir la touche link (A / clic stick droit), héros déployé, vivant, pas en dash ni en résurrection. La cible est cherchée dans un **couloir de 100 px de large et 1000 px de long devant le héros** (11 lignes légèrement en éventail), parmi les héros ni morts ni en déploiement, et doit être à `distance_to_object <= linkDistanceMax` (1000). Le lieur s'inscrit dans `linkTarget.linkedHeros`.
  - **[BOGUE]** scr_getClosestInstanceInFront retient la cible **la plus éloignée** (comparaison `>`), contrairement à son nom.
- **Rompre** : relâcher la touche, ou dépasser 1000 px de distance. À la rupture, si plus personne ne lie la cible, celle-ci subit une pause de régénération.
- **Effet** : toutes les `timePerEnergyTic` = 60 steps (1 s), si le lieur a au moins 1 énergie : **−1 énergie pour le lieur, +1 pour la cible** (transfert pur, sans perte). La cible peut ainsi monter jusqu'à 12. Régénération suspendue pour les deux pendant le link. Un héros lié ne subit pas la pause de régénération quand il utilise son tir secondaire.
- **Visuel** : 3 obj_particule_link par step (vitesse 15, rayon 0.5 à 5 px, blanc ou aqua, trajectoire courbée vers la cible, détruites à son contact).
- **[DÉSACTIVÉ]** : obj_link (faisceau en sprite `spr_link`) n'est jamais créé (code commenté) ; scr_updateLinkState, scr_updateCurrentEnergyRegenFromLinks, scr_updateMaxEnergyFromLinks sont marqués OBSOLETE et entièrement commentés (ancien modèle : puissance selon la distance entre `linkDistanceMin` 100 et max, énergie max additionnée) ; les messages réseau C_HEROS_LINKED / C_HEROS_UNLINKED (scripts/macros/macros.gml) ne sont plus émis.

### 6.3 Stades d'évolution des tirs secondaires selon l'énergie

Les paliers existent et suivent des tranches de 3 énergies (4 « barres » de 3 sur 12). Comme le maximum naturel est 3, **les stades 2 à 4 ne sont atteignables que par le link (multi) ou le bonus énergie (qui met l'énergie à 12)**.

| Énergie | BatBot (batte lancée) | EngiBot (tourelle) | PetBot (drones) | BadaBot (bouclier) |
|---|---|---|---|---|
| 1–2 | niveau 1, coût 1 | indisponible (< 3) | indisponible (< 3) | actif, 3 balles par énergie |
| 3 | niveau 1, coût 1 | niveau 1 : 1 tir/s | niveau 1 | idem |
| 4–5 | niveau 2, coût 2 : explosion rayon 250, dégât 4 | niveau 1 | niveau 1 | idem |
| 6 | niveau 2 | niveau 2 : 2 tirs/s | niveau 2 | idem |
| 7–8 | niveau 3, coût 3 : explosion rayon 500, dégât 7 | niveau 2 | niveau 2 | idem |
| 9 | niveau 3 | niveau 3 : 3 tirs/s | niveau 3 | idem |
| 10–11 | niveau 4, coût 4 : idem + perçante | niveau 3 | niveau 3 | idem |
| 12 | niveau 4 | niveau 4 : 4 tirs/s | niveau 4 | idem |

- EngiBot consomme `3 × niveau` énergies, PetBot consomme tout, BatBot consomme son coût, BadaBot 1 énergie par 3 balles bloquées. BadaBot n'a **aucun stade** (`shieldSize`, `shieldBuffFactor` inutilisés).
- **« otherBar » : [DÉSACTIVÉ].** scripts/scr_drawOtherBar n'est appelé nulle part ; l'appel à scripts/scr_otherBarImageIndex est commenté dans objects/obj_healthBar/Step_0.gml. C'était une jauge secondaire (`spr_healthBar_redCross`) affichant le réservoir de l'ancien drone du PetBot (`currentTankFuel/tankSpace`), variables qui n'existent plus. Ce n'est pas un système de stades d'armes.

---

## 7. Mort et résurrection

### 7.1 À 0 PV (scripts/scr_setDead)

**Point crucial : `canDie = False` par défaut (obj_localPlayer.yy) et aucun héros ne le surcharge.** Tout le bloc mort/résurrection de scr_setDead est conditionné par `canDie == true`, qui n'est posé que par la touche de debug J. En l'état du snapshot, **un héros à 0 PV ne meurt pas** : il reste jouable, ne subit plus de dégâts (les balles exigent `currentHealth > 0`), et sa vignette de HUD passe en gris avec le texte glitché « Dead ». **[BOGUE ou réglage de debug — à trancher pour le remake.]**

Comportement prévu quand `canDie == true` :
1. `currentHealth <= 0` et pas déjà mort : `currentEnergy = 0`, `currentEnergyRegen = 0`, `deployed = false`, les 2 bonus stockés et les bonus actifs sont perdus, `state = "dead"`, animation de mort depuis l'image 0, création d'un obj_explosion_robot (visuel, démarre à l'image 4 de l'animation de mort).
2. L'animation de mort se fige sur sa dernière image (BatBot : battes détruites, `numberOfBatte = 2`). Le héros reste dans la room comme épave ; la caméra cesse de le suivre ; une flèche hors écran le signale.
3. Mort : pas de déplacement, visée, tir, dash, link ; ne subit plus de dégâts.
4. Si `currentHealth > 0` alors que `state == "dead"` (résurrection) : `state = "standing"`, régénération rétablie.

**Fin de partie** (hors du test canDie, évaluée chaque step par chaque héros) : si **tous** les obj_localPlayer sont en `state == "dead"` → création de obj_endGameMenu, qui après **2.5 s** affiche « YOU LOSE » avec les boutons Retry (détruit les héros et recharge la room courante via obj_cleaningRoom) et Exit (retour au menu principal) (objects/obj_endGameMenu, obj_btn_retry, obj_btn_exit).
- **En solo** : aucune résurrection possible ; la mort du héros déclenche directement cet écran.
- **À plusieurs** : la partie continue tant qu'un héros vit ; les morts attendent une résurrection.
- scripts/scr_dead ne concerne **que les PNJ** (appelé par scr_setNPCBehaviourActions).
- objects/obj_flaqueMort : flaque de sang (« humain ») ou d'huile (« robot ») laissée par les **PNJ** morts ; sans rapport avec les héros.
- objects/obj_countdown_GUI : compte à rebours textuel en haut d'écran (10 s par défaut) utilisé par les changements de room (obj_changeRoom_parent), pas par la mort.

### 7.2 Dégâts subis et invulnérabilité temporaire

- Balle ennemie (scripts/scr_bulletCollisionActionWithLocalPlayer) : dégâts appliqués seulement si le héros n'a pas de glitch en cours, est déployé, a `currentHealth > 0` et n'a pas le bonus invincibilité ; la balle est détruite dans tous les cas.
- Chaque dégât crée un **obj_glitch** sur le héros (effet visuel) d'une durée tirée entre **10 et 40 steps** (obj_glitch.yy) : tant qu'il existe, les balles et les coups du sallyBot n'infligent rien → **frames d'invulnérabilité de 0.17 à 0.67 s (à 60)**. Le coup de bouclier (bump) ignore cette protection.
- Aucune régénération de PV ; seuls soins : balles et explosions de drones du PetBot, résurrection.

### 7.3 Résurrection **[MULTI]** (scripts/scr_resurectAllie, objects/obj_circularCountDown)

1. Conditions : sauveteur vivant, pas déjà en train de ressusciter ; un allié `state == "dead"` à **moins de 100 px** ; touche Utiliser **maintenue** (E/Entrée, X) ; **`currentEnergy >= 3`**.
2. Un obj_circularCountDown (disque de rayon 30, `job = "resurect"`, couleur évolutive) apparaît à 100 px sur le côté ; durée `resurectDuration = 3 × room_speed` = **180 steps (3 s)**.
3. Pendant le maintien : le sauveteur est immobile (`canMove = false`), ne tire pas, se tourne vers l'allié, régénération en pause.
4. Coût : **−1 énergie aux 2/3, au 1/3 et à la fin** du compte à rebours (3 au total).
5. À la fin : **l'allié revient avec 3 PV**. Il repart avec 0 énergie.
6. Relâcher la touche annule tout ; l'énergie déjà dépensée est perdue.
- Comme la mort elle-même, ce système n'est atteignable que si `canDie` vaut true.

---

## 8. Bonus

Tous les bonus sont **posés à la main dans les rooms** (aucun largage par les ennemis, aucune création par script). Nombre d'instances : obj_bonus_ammo — rm_world2 (10), rm_world2_1 (4), rm_world4 (1), rm_world4_1 (12) ; obj_bonus_box — rm_world2 (13), rm_world2_1 (4), rm_world4 (1), rm_world4_1 (7) ; obj_bonus_energy / invincibilite / speed — uniquement dans _rm_arena1_1, _rm_arena1_3, rm_arena1_3, _rm_world1, _rm_world1_1 (rooms d'arène et world1 ; absents de world2 et world4).

obj_bonus_parent (obj_bonus_parent.yy : `rotationSpeed = 1`, `scaleModifier = -0.002`, `imageScale = 1` ; Step_0.gml) : animation d'attente — échelle oscillant entre 0.9 et 1 (pas 0.002), angle oscillant entre −10° et +10° (pas 0.1°).

| Objet | Ramassage | Effet |
|---|---|---|
| obj_bonus_ammo | contact, seulement si `currentMunition != maxMunition` | munitions remises au maximum ; bonus détruit |
| obj_bonus_box | contact, seulement si un des 2 emplacements est libre | stocke un bonus tiré au hasard à la création de la boîte (« invincibilité », « vitesse », « energie », équiprobables) ; boîte détruite |
| obj_bonus_invincibilite | contact | `bonusInvincible = true` pendant `bonusDuration` |
| obj_bonus_speed | contact | `bonusSpeed = true` pendant `bonusDuration`, `alarm[0] = -1` |
| obj_bonus_energy | contact | `currentEnergy = 12`, pause de régénération, `bonusEnergy = true` |

- **[BOGUE]** obj_bonus_energy, obj_bonus_invincibilite et obj_bonus_speed appellent `event_inherited()` dans leur événement Collision, mais obj_bonus_parent n'a pas d'événement Collision : **ils ne sont jamais détruits** et réappliquent leur effet à chaque step de contact (bonus réutilisables à l'infini). Ils ne figurent que dans les rooms d'arène et world1.
- **Activation d'un bonus stocké** (scripts/scr_activateBonus) : touche 1 / 2 (croix gauche / droite) → applique l'effet de l'emplacement et le vide. Les 2 emplacements sont affichés en GUI près de la barre de vie (`healthBar.x + 80 + i×40`, échelle 0.5 ; objects/obj_localPlayer/Draw_64.gml).
- **Durée** : `bonusDuration = 10 × room_speed` = 600 steps (10 s à 60), décomptée par scripts/scr_bonusEffects.
- **Effets détaillés** :
  - Invincibilité : aucun dégât de balle, de sallyBot ni de coup de bouclier (le bump, lui, a quand même lieu).
  - Vitesse : déplacement `+ 0.5 × walkingMaxSpd` (15 px/step ; EngiBot 19.5) et cadence du tir primaire × 1.5.
  - Énergie : énergie à 12 immédiatement (donne accès aux stades 4) ; ensuite la surcharge décroît de 1 toutes les 2 s. Le drapeau `bonusEnergy` et sa durée n'ont **aucun autre effet [INACHEVÉ]**.
- Tous les bonus (stockés et actifs) sont perdus à la mort.
- **obj_cadeau** : simple élément de décor (enfant de obj_mobilier_parent, sprite `spr_cadeaux`, aucun événement, 3 instances dans _rm_world1). Ne donne rien. **[INACHEVÉ]**

---

## 9. Caméra et HUD

### 9.1 Caméra (objects/obj_camera, scripts/scr_setCameraActive, scr_setCameraCoordinates, scr_setCameraZoom)

- Une seule caméra partagée (pas d'écran scindé), projection orthographique. Vue de base **1920 × 1080** ; dézoom maximal ×1.5 → **2880 × 1620** (`dezoomMaxFactor = 1.5`) ; `borderMargin = 300`.
- Position initiale : moyenne des 4 points d'apparition obj_spawn1..4.
- Mise à jour en Begin Step, seulement si la caméra est « active » : inactive quand obj_endGameMenu ou obj_pauseMenu existe.
  - **[BOGUE]** scr_setCameraActive veut aussi désactiver la caméra quand un héros n'est pas déployé, mais écrit dans `other.active` (variable d'instance) au lieu de la variable locale retournée : ce test est sans effet.
- **Cible** : moyenne des positions des **bouts de canon** de tous les héros non « morts animation terminée ». L'avance de 300 px devant l'arme est commentée **[DÉSACTIVÉ]**. Bornée pour que la vue de base reste dans la room, et bloquée du côté opposé quand un héros atteint le bord de la vue maximale.
- **Lissage** : `x += (cible − x) / 20` par step, puis borne à la room.
- **Zoom** : hauteur visée = max(1080, 2 × (écart vertical caméra-héros + 300)), largeur visée = max(1920, 2 × (écart horizontal + 300)), ratio 16:9 conservé, plafonnée à 1620 ; lissage `1/10` par step. **En solo, la vue reste à 1920 × 1080** et suit le canon du héros.
- Audio : l'écouteur est placé sur la caméra.
- Mode debug (F9, si RoomCreator présent) : zoom à la molette, déplacement libre à 40 px/step.

### 9.2 HUD par héros (scripts/scr_createHealthBar, objects/obj_healthBar, obj_healthBar_vignette, obj_electricityFX)

- Un obj_healthBar par héros, créé à l'apparition, couche GUI, persistant. Position : 4 emplacements répartis sur la largeur en bas d'écran — `marge = (30 + xoffset(spr_healthBar) + 20) × ratio`, `x = marge − 20×ratio + (playerNumber − 1) × (largeurGUI − 2×marge)/3`, `y = hauteurGUI − 90 × ratio`, avec `ratio = global.displayRatio = largeurGUI/1920`. Visible seulement en jeu (`global.inWorld`).
- **Le sprite `spr_healthBar` affiche l'énergie**, pas la vie : `image_index = hero.currentEnergy` (0 à 12).
- **La vie est affichée sur le portrait** (obj_healthBar_vignette, sprite `spr_cadre_<Héros>` pour BatBot, EngiBot, BadaBot, PetBot) : une teinte rouge (alpha 0.8) recouvre le bas du portrait sur une hauteur proportionnelle aux PV manquants. À 0 PV : portrait grisé et texte glitché `deathText = "Dead"` rafraîchi aléatoirement toutes les 15 à 120 steps.
- obj_electricityFX : 3 animations d'éclairs (8 images, 1 image toutes les 8 steps) affichées si énergie ≥ 1, ≥ 2, ≥ 3.
- Compteur de munitions « courant/max » (voir 5) et icônes des 2 bonus stockés (voir 8).
- **[DÉSACTIVÉ]** « otherBar » (voir 6.3) ; l'effet de glitch sur la vignette à chaque dégât est commenté.

### 9.3 obj_gui (objects/obj_gui)
Uniquement du texte de **debug** en haut à droite : FPS, et en jeu `state` et `direction` du premier héros, nombre de héros, valeurs brutes du stick gauche. Bascule de debug F1–F5. À ne pas reproduire tel quel.

### 9.4 scr_drawArrowTowardOutOfScreenObject
Si l'objet est hors de la vue (marge 30 px) : flèche `spr_pointingArrow` sur le bord de l'écran GUI (marge 30 × échelle), orientée caméra → objet, teintée de la couleur passée, avec une vignette de l'objet. Utilisée pour : un **héros mort** (sprite `spr_<Héros>_pointingArrow`, couleur `mainColor`) et une **batte du BatBot au sol** (violet RGB 209,0,254).

### 9.5 Autres
- Pause (scripts/scr_setPauseGame, objects/obj_pauseMenu) : Échap / Start crée un panneau Resume / Exit et met `global.gamePaused = true` ; les héros figent leur animation et ne lisent plus les touches. Le reste du jeu n'est pas globalement suspendu par ce seul drapeau (à vérifier côté PNJ).
- Statistiques de fin de niveau (objects/obj_score) : % de civils et de soldats tués, dégâts subis, soins, munitions utilisées, énergie utilisée, « Global note : 42 » en dur **[INACHEVÉ]**.

---

## 10. Récapitulatif des points à trancher pour le remake

1. **room_speed** : non trouvé, 60 supposé.
2. **canDie = False** : héros immortels en l'état ; décider si la mort est activée (le système complet existe).
3. **Sprites absents** : nombres d'images, masques de collision (hitbox de batte, bouclier, explosions de drones, tailles des héros) non trouvés — à mesurer sur les assets.
4. **Link et résurrection** : fonctionnels mais multijoueur uniquement ; en solo, les stades 2–4 des tirs secondaires ne sont atteignables que par le bonus énergie.
5. **Bogues à reproduire ou corriger** : cible de link la plus éloignée ; bonus énergie/invincibilité/vitesse jamais détruits ; batte perçante qui explose à chaque step ; grosse explosion du plasma sur le mobilier ; munitions négatives du BadaBot ; rappel de batte involontaire après un lancer impossible.
6. **Déploiement** (`enableDeploy`), **taunt**, **obj_cadeau**, **durée de vie de la tourelle**, **agrandissement du bouclier par les alliés liés** : prévus mais inactifs.
