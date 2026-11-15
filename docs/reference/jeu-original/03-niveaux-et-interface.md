# 03 — Niveaux, déroulement et interface (version GMS2 de janvier 2019)

Source analysée (lecture seule) : `scratchpad\v2019\Stand-For-Planet-Earth` (objects/, scripts/, rooms/, views/, shaders/, notes/, `.yyp`).
Les dossiers `sprites/` et `tilesets/` ne sont pas extraits : seules leurs listes de noms ont été consultées (`git ls-tree d438c548`). **Aucune taille, origine ou masque de collision de sprite n'a donc pu être lu** (voir « Zones d'incertitude » en fin de document).

Conventions de ce document :
- « (fichier) » = fichier d'origine du fait cité, chemin relatif à la racine du projet GMS2.
- **[DÉSACTIVÉ]** = code commenté ou jamais appelé ; **[INACHEVÉ]** = fonctionnalité partielle ; **[TEST]** = contenu de test/développement ; **[INFÉRENCE]** = déduction de ma part, pas un fait lu tel quel.
- Les durées écrites `N*room_speed` sont données en secondes ; la vitesse du jeu (`room_speed`, options du projet) est **non trouvée** dans les sources extraites.
- Les textes affichés au joueur sont recopiés tels quels (la plupart sont en anglais dans le code).

---

## 1. Inventaire des 24 rooms

### 1.1 Vue d'ensemble : rôle, code de création, accessibilité

24 dossiers existent dans `rooms/`, mais **22 seulement sont déclarés dans le projet** (`Stand-For-Planet-Earth.yyp`, liste `resources`). `rm_arena1_3` et `rm_arena2` sont des dossiers orphelins (restes de fusion git : `rm_arena2_BACKUP_16096.yy`, `_BASE_`, `_LOCAL_`, `_REMOTE_` ; leur `RoomCreationCode.gml` référencé est absent).

Arborescence des rooms dans l'éditeur (views/*.yy, filtre GMRoom) :
- `rooms/Menu` : rm_mainMenu, rm_score, rm_choseHero, rm_loadingScreen, rm_recapitulatif
- `rooms/Maps/rm_world1` : _rm_world1, _rm_world1_1, _rm_world1_2, _rm_world1_3, _rm_world1_4, _rm_arena1, _rm_arena1_1, _rm_arena1_2, _rm_arena1_3
- `rooms/Maps/rm_world2` : rm_world2, rm_world2_1, rm_world2_2
- `rooms/Maps/rm_world3` : _rm_world3
- `rooms/Maps/rm_world4` : rm_world4, rm_world4_1
- racine : rm_test_textureGenerator, rm_test_light

Le `.yyp` ne contient pas d'ordre explicite des rooms (sa liste `resources` est triée par GUID). **[INFÉRENCE]** l'ordre des rooms de GMS2 2.2 est celui de cette arborescence : la première room du jeu est donc `rm_mainMenu`.

| Salle | Rôle | Code de création (RoomCreationCode.gml) | Dans le .yyp | Proposée dans le menu de choix de salle |
|---|---|---|---|---|
| rm_mainMenu | Menu principal (room de démarrage) | `scr_room_menu_ini()` ; `randomise()` ; détruit `obj_roomsMemory` ; remet `playerNumber`/`heroSelected` des contrôleurs à `noone` ; crée `obj_musicController` s'il n'existe pas | oui | — |
| rm_choseHero | Choix du héros puis choix de la salle | `scr_room_menu_ini()` | oui | — |
| rm_score | Écran de score (fin de niveau) | `global.inWorld = false;` | oui | — |
| rm_loadingScreen | Écran de chargement **[DÉSACTIVÉ]** (aucune référence dans le code) | `scr_room_menu_ini()` | oui | — |
| rm_recapitulatif | Récapitulatif **[DÉSACTIVÉ]** (seule référence : un test dans obj_btn_retry) | `scr_room_menu_ini()` | oui | — |
| rm_world2 | Monde 2, salle 1 (rez-de-chaussée) — première salle du niveau | `scr_room_world_ini(true)` ; `scr_createMurEpaisFromTile("tiles_mur_epais")` ; `scr_createMurFinFromTile("tiles_mur_fin")` ; crée `obj_ambientShadow` dans `layer_lumiere` ; crée `obj_consigne_world2` dans `layer_code` | oui | **oui** |
| rm_world2_1 | Monde 2, salle 2 (étage) | `scr_room_world_ini(false)` ; murs depuis tuiles (2 appels) ; `with(obj_lumiere){ scr_initializeLumiere(); }` | oui | **oui** |
| rm_world2_2 | Monde 2, salle 3 (zone des foreuses, boss SallyBot) **[INACHEVÉ]** | identique à rm_world2_1 | oui | **oui** |
| rm_world4 | Monde 4, salle 1 | Le fichier contient `scr_room_world_ini(true)` + murs depuis tuiles, **mais `creationCodeFile` vaut `""` dans rm_world4.yy** : le code n'est pas rattaché à la room (voir incertitudes) | oui | **oui** |
| rm_world4_1 | Monde 4, salle 2 (usine) | `scr_room_world_ini(false)` ; murs depuis tuiles | oui | **oui** |
| _rm_world1 | Ancien monde 1, salle 1 **[DÉSACTIVÉ par le préfixe `_`]** | `scr_room_world_ini(true)` ; `//scr_room_chat_ini()` ; `audio_play_sound(snd_music_room1,2,false)` | oui | non |
| _rm_world1_1 | Ancien monde 1 | `scr_room_world_ini(false)` ; `roomid=2` | oui | non |
| _rm_world1_2 | Ancien monde 1 (cafétéria : 70 tables, 379 chaises) | `scr_room_world_ini(false)` ; `roomid=1` | oui | non |
| _rm_world1_3 | Ancien monde 1 (labyrinthe de murs fins, 23 lumières) | `scr_room_world_ini(false)` ; `roomid=2` | oui | non |
| _rm_world1_4 | Ancien monde 1 | `scr_room_world_ini(false)` ; `roomid=1` | oui | non |
| _rm_arena1 | Ancienne arène | `scr_room_world_ini(true)` | oui | non |
| _rm_arena1_1 | Ancienne arène | `scr_room_world_ini(true)` | oui | non |
| _rm_arena1_2 | Ancienne arène (sol en « megatexture ») | `scr_room_world_ini(true)` | oui | non |
| _rm_arena1_3 | Ancienne arène (la plus grande) | `scr_room_world_ini(true)` ; `scr_room_chat_ini()` | oui | non |
| _rm_world3 | Ancien monde 3 **[TEST]** (le log git parle d'un « world 3 pour tester le fichier .ini ») | `scr_room_world_ini(true)` | oui | non |
| rm_test_textureGenerator | **[TEST]** générateur de sols | `scr_room_world_ini(true)` ; murs depuis tuiles | oui | non |
| rm_test_light | **[TEST]** lumières | aucun | oui | non |
| rm_arena1_3 | Copie orpheline de _rm_arena1_3 avec une couche de sol megatexture | fichier référencé mais absent | **non** | non |
| rm_arena2 | Arène orpheline (murs seuls, aucun PNJ) | fichier référencé mais absent | **non** | non |

**Pourquoi seules 5 salles sont jouables depuis les menus.** `scr_getAllRoomWorldList` (scripts/scr_getAllRoomWorldList) construit la liste par nom : pour j de 1 à 9, si la room `rm_world<j>` existe, elle est ajoutée, puis `rm_world<j>_<i>` pour i = 1, 2, … jusqu'au premier manquant ; même chose ensuite avec `rm_arena<j>` / `rm_arena<j>_<i>`. Toutes les anciennes salles ont été renommées avec un `_` initial et ne correspondent donc plus à ces noms. Résultat avec ce projet : **`rm_world2`, `rm_world2_1`, `rm_world2_2`, `rm_world4`, `rm_world4_1`**, plus un bouton **`random`** ajouté par `scr_btnGoCreateBtnRoom`.

**Première salle d'une partie.** Il n'y a pas de salle imposée : après le choix des héros, le joueur choisit l'une des 5 salles (ou `random`) et `obj_btn_go` fait `room_goto(asset_get_index(lockedRoom))` (objects/obj_btn_go/Step_0.gml). Les salles conçues comme début de niveau sont celles qui appellent `scr_room_world_ini(true)` : `rm_world2` et `rm_world4`. Choisir directement `rm_world2_1`, `rm_world2_2` ou `rm_world4_1` est possible (aucun garde-fou), mais `obj_score` n'est alors pas créé.

**Système d'accès par sauvegarde [DÉSACTIVÉ].** `scr_checkRoomAccess` / `scr_giveRoomAccess` lisent/écrivent la section `roomAccess` de `savedData.ini`. Ils ne sont appelés que par `obj_btn_map_parent` / `obj_btn_map1..3` (qui référencent `rm_world1` et `rm_world3`, rooms qui n'existent plus sous ce nom), objets placés dans aucune room. `obj_btn_start`, `obj_chose_hero_information`, `obj_mapselection`, `obj_waitingMap` (cible `rm_go`, inexistante) appartiennent au même ancien écran et ne sont placés nulle part.

### 1.2 Enchaînement des salles par « monde »

Les passages sont des instances de `obj_nextRoom` / `obj_previousRoom` / `obj_endLevel` (voir §4). Valeurs lues dans les rooms :

- **Monde 2**
  - `rm_world2` : `obj_nextRoom` en (3168, 4896), propriétés par défaut → `nextRoom = rm_world2_1`, `spawnNumberOfNextRoom = 1`, message « Going Upstairs in :  ».
  - `rm_world2_1` : `obj_previousRoom` en (3136, 4928) avec `nextRoom = rm_world2`, `spawnNumberOfNextRoom = 2`, `message = "Going downstairs in : "`. Le retour dans rm_world2 se fait donc sur le 2ᵉ jeu de spawns (x = 3616, y = 4688 à 5152), à côté de l'escalier.
  - `rm_world2` : `obj_endLevel` (invisible) en (6560, 320), échelle 29,59 × 4,06 : grande zone en haut de la carte → `rm_score`.
  - `rm_world2_2` : **aucun passage n'y mène et aucun n'en sort**. Elle n'est atteignable que par le menu de choix de salle. **[INACHEVÉ]**
- **Monde 4**
  - `rm_world4` : `obj_nextRoom` en (10432, 9472) avec `nextRoom = rm_world4_1` (spawn 1).
  - `rm_world4_1` : aucun passage, aucune fin de niveau. **[INACHEVÉ]**
- **Ancien monde 1** (toutes désactivées) : les `obj_nextRoom`/`obj_previousRoom` présents n'ont aucune propriété surchargée ; ils pointeraient donc tous vers la valeur par défaut `rm_world2_1`. L'ancien chaînage (`rm_world1 → rm_world1_1 → rm_world1_2`) n'existe plus qu'en commentaire dans `scr_nextRoom_previousRoom` (entièrement commenté).
- **Arènes** : aucune sortie.

### 1.3 Tableau condensé des instances

Colonnes : **Portes** = automatiques / à bouton (`obj_door`) / carte verte / carte violette. **Cartes** = verte / violette. **Soldats** = `obj_npc_human_pistol` / `obj_npc_robot_lightBot` / `obj_npc_robot_shotBot` / `obj_npc_robot_shield`. **Bonus** = `obj_bonus_box` / `_ammo` / `_energy` / `_invincibilite` / `_speed`. **Mobilier** = tous les enfants de `obj_mobilier_parent`. **TexGen** = `obj_textureGenerator_*` (sols). **Décalques** = sprites de la couche d'assets. **Autres** = objets hors de ces catégories.

| Salle | Taille (px) | Persist. | Inst. | Murs | Portes | Boutons | Cartes | Soldats | Civils | Bonus | Fenêtres | Mobilier | Lumières | WarFog | TexGen | Décalques | Spawns 1+2+3+4 | Sorties | Autres |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rm_mainMenu | 1920×1080 | non | 7 | 0 | 0/0/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 0+0+0+0 | — | btn_play×1, btn_exit×1, btn_option×1, compte×1, controller_xbox×1, controller_keyboard×1, title×1 |
| rm_choseHero | 1920×1080 | non | 6 | 0 | 0/0/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 0+0+0+0 | — | btn_back×1, btn_player×4, btn_go×1 |
| rm_score | 1920×1080 | non | 0 | 0 | 0/0/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 0+0+0+0 | — | — |
| rm_loadingScreen | 1920×1080 | non | 1 | 0 | 0/0/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 0+0+0+0 | — | title×1 |
| rm_recapitulatif | 1920×1080 | non | 1 | 0 | 0/0/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 0+0+0+0 | — | btn_exit×1 |
| rm_world2 | 13000×8000 | non | 570 | tuiles 622 ép. / 1240 fins | 26/7/1/2 | 4 | 1/0 | 22/5/4/5 | 52 | 13/10/0/0/0 | 20 | 304 | 11 | 34 | 33 | 37 | 2+2+2+2 +véhicule | next×1, endLevel×1 | fauteuilRond1..4 ×1 chacun |
| rm_world2_1 | 13000×8000 | non | 405 | tuiles 393 ép. / 1249 fins | 24/1/0/1 | 1 | 0/1 | 11/4/3/1 | 43 | 4/4/0/0/0 | 13 | 213 | 0 | 38 | 27 | 3 | 1+1+1+1 | prev×1 | fauteuilRond ×11 |
| rm_world2_2 | 13000×8000 | non | 8 | tuiles 0 / 0 | 0/0/0/0 | 0 | 0/0 | 0/0/0/0 + SallyBot | 0 | 0/0/0/0/0 | 0 | 3 (foreuses) | 0 | 0 | 0 | 0 | 1+1+1+1 | — | — |
| rm_world4 | 14200×14200 | non | 260 | tuiles 723 ép. / 243 fins | 17/1/0/1 | 2 | 0/1 | 4/1/0/0 | 34 | 1/1/0/0/0 | 6 | 135 | 0 | 27 | 22 | 0 | 1+1+1+1 | next×1 | mur_dessousFenetre×2 |
| rm_world4_1 | 15200×20200 | non | 535 | tuiles 716 ép. / 2811 fins | 39/5/0/1 | 3 | 0/1 | 20/2/1/3 | 55 | 7/12/0/0/0 | 19 | 209 | 0 | 59 | 34 | 1162 | 1+1+1+1 | — | robot_atelier1×14, robot_atelier2×14, robot_atelier3×13, fauteuilRond ×4, mur_dessousFenetre×16 |
| _rm_world1 | 24000×10000 | oui | 1225 | 1054 inst. | 28/2/2/0 | 0 | 1/0 | 15/2/1/5 | 0 | 0/0/2/1/1 | 1 | 102 | 0 | 0 | 0 | 0 | 1+1+1+1 | — | tapis_accueil×4 |
| _rm_world1_1 | 17664×15200 | oui | 135 | 68 inst. | 0/2/0/0 | 2 | 0/0 | 0/0/0/0 | 0 | 0/0/1/1/1 | 0 | 52 | 0 | 0 | 0 | 0 | 1+1+1+1 +véhicule | next×1, prev×1 | — |
| _rm_world1_2 | 10496×10368 | oui | 516 | 65 inst. | 0/0/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 449 | 0 | 0 | 0 | 0 | 1+0+0+0 | prev×1 | — |
| _rm_world1_3 | 10000×10000 | oui | 2451 | 2366 inst. | 4/2/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 51 | 23 | 0 | 0 | 0 | 1+1+1+1 | prev×1 | — |
| _rm_world1_4 | 10496×10368 | oui | 68 | 44 inst. | 18/0/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 2 | 0 | 0 | 0 | 0 | 1+0+0+0 | next×1, prev×1 | gabari_hero×1 |
| _rm_arena1 | 10024×7680 | non | 279 | 256 inst. | 5/1/0/0 | 1 | 0/0 | 10/0/0/2 | 0 | 0/0/0/0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 1+1+1+1 | — | — |
| _rm_arena1_1 | 20024×8680 | non | 1297 | 1194 inst. | 3/6/1/1 | 4 | 1/1 | 11/4/5/7 | 0 | 0/0/10/3/4 | 7 | 31 | 0 | 0 | 0 | 0 | 1+1+1+1 | — | — |
| _rm_arena1_2 | 10024×7680 | non | 531 | 502 inst. | 8/0/0/1 | 0 | 0/1 | 8/2/3/2 | 0 | 0/0/0/0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 1+1+1+1 | — | — |
| _rm_arena1_3 | 18024×17080 | non | 2855 | 2744 inst. | 44/16/1/1 | 5 | 1/1 | 21/4/3/6 | 0 | 0/0/1/2/1 | 0 | 0 | 0 | 0 | 0 | 0 | 1+1+1+1 | — | — |
| _rm_world3 | 4096×8000 | oui | 37 | 21 inst. | 0/0/0/0 | 0 | 0/0 | 4/0/0/0 | 0 | 0/0/0/0/0 | 0 | 6 | 0 | 0 | 0 | 0 | 1+1+1+1 | next×1 | grid×1 |
| rm_test_textureGenerator | 1024×768 | non | 3 | tuiles 0 / 0 | 0/0/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 0 | 0 | 0 | 3 | 0 | 0+0+0+0 | — | — |
| rm_test_light | 1024×768 | non | 31 | 17 inst. | 0/0/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 0 | 12 (dont 11 `ignore`) | 0 | 0 | 0 | 0+0+0+0 | — | gabari_hero×1, camera×1 |
| rm_arena1_3 (orpheline) | 18024×17080 | non | 2855 | 2744 inst. | 44/16/1/1 | 5 | 1/1 | 21/4/3/6 | 0 | 0/0/1/2/1 | 0 | 0 | 0 | 0 | 0 | 0 | 1+1+1+1 | — | — |
| rm_arena2 (orpheline) | 10024×7680 | non | 189 | 180 inst. | 5/0/0/0 | 0 | 0/0 | 0/0/0/0 | 0 | 0/0/0/0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 1+1+1+1 | — | — |

Remarques :
- Dans les salles récentes (world2, world4), **les murs ne sont pas des instances** : ils sont peints dans deux couches de tuiles et transformés en instances au chargement (§7.2).
- « Persist. » est le réglage de la room dans son `.yy`. À l'exécution, `obj_roomsMemory` force de toute façon `room_persistent = true` dans toute salle de jeu (§3.3).
- `rm_world4_1` : les 1162 décalques sont des morceaux de robots/humains (`spr_membreMortRobot_1..11`, `spr_membreMortHumain_1..11`, flaques d'huile/sang) et quelques sprites de PNJ posés comme décor.

### 1.4 Éléments de progression des salles jouables (positions en px)

- **rm_world2** : spawns jeu 1 (départ) en (5179/5339/5435/5531, 7616) ; spawns jeu 2 (retour d'étage) en (3616, 4688/4832/4992/5152) ; `obj_spawnVehicle` (4171, 8448) + `obj_spawnHeros` (5323, 7392) (arrivée en véhicule, désactivée, §3.5) ; carte verte (3344, 1664) ; porte verte (5440, 4896) ; portes violettes (6176, 5184) et (6656, 2481) ; portes à bouton : doorId 1 → 1 porte (3872, 4736), bouton (3276, 4552) ; doorId 2 → 2 portes (8240, 6047) et (8240, 1632), bouton (7253, 3936) ; doorId 3 → 2 portes (10112, 1376) et (10496, 1376) (échelle 1,5 et −1,5 : porte double en miroir), bouton (9008, 1632) ; doorId 4 → 2 portes (10112, 6304) et (10496, 6304), bouton (9008, 5952). Toutes ces `obj_door` ont `blockedOpen = True` (restent ouvertes). Escalier `obj_nextRoom` (3168, 4896). Sortie `obj_endLevel` (6560, 320).
- **rm_world2_1** : spawns (3552–3632, 4752–5104) ; carte violette (8112, 1728) ; porte violette (7936, 3424) ; porte doorId 1 (6304, 1664) `blockedOpen`, bouton (5978, 3701) ; `obj_previousRoom` (3136, 4928).
- **rm_world2_2** : spawns (6162–6523, ≈7280) ; `obj_sallyBot` (6560, 6208) ; 3 `obj_foreuse` en (4224, 2656), (7936, 2688), (10304, 2656). Aucun mur, aucun sol généré.
- **rm_world4** : spawns (10240–10592, 11216) ; carte violette (9952, 4352) ; porte violette (10432, 9074) ; porte doorId 1 (10432, 5216) avec 2 boutons (10033, 5939) et (10235, 5179) ; `obj_nextRoom` (10432, 9472).
- **rm_world4_1** : spawns (9472–9824, 19888) ; carte violette (9184, 9568) ; porte violette (14208, 10160) ; portes doorId 1 (8961, 10161), doorId 2 ×2 (9408, 14769) et (9919, 14768), doorId 3 (9664, 17952), chacune avec 1 bouton ; une `obj_door` en (5552, 13504) dont le code de création référencé est absent (doorId reste −1 : porte inouvrable).

### 1.5 Couches (layers) par salle

Notation : `nom` (type, profondeur) [contenu]. Types : I = instances, T = tuiles, A = assets (sprites décoratifs), B = arrière-plan. Profondeur plus petite = dessiné au-dessus.

- **rm_mainMenu** : `Instances` (I, 0) [7] ; `background` (B, 2147483600) [spr_fondMenu_1]
- **rm_choseHero** : `Gamepad` (I, -100) [0] ; `Buttons` (I, 0) [6] ; `Compatibility_Colour` (B, 2147483600) [spr_fondMenu_2]
- **rm_score** : `background` (B, 2147483600) [spr_fondMenu_1]
- **rm_loadingScreen**, **rm_recapitulatif** : `Compatibility_Instances_Depth_0` (I, 0) [1] ; `Compatibility_Colour` (B, 2147483600) [couleur 0xff290a01]
- **rm_world2** : `layer_doors` (I, -500) [36] ; `layer_murs` (I, -400) [0, remplie à l'exécution] ; `tiles_mur_epais` (T, -300) [til_murs_epais, 204×125 cases de 64 px, 622 non vides] ; `tiles_mur_fin` (T, -200) [tile_murs_fin, 407×250 cases de 32 px, 1240 non vides] ; `layer_warFog` (I, -100, masquée dans l'éditeur) [34] ; `layer_npc` (I, 0) [88] ; `layer_code` (I, 100) [38] ; `layer_deco` (I, 200) [308] ; `layer_fenetre` (I, 300) [20] ; `layer_nextRoomInstances` (I, 400) [2] ; `layer_lumiere` (I, 500) [11] ; `tiles_element_graphiques` (A, 600) [37 sprites : spr_tapis×3, spr_route×9, spr_route_bordG×9, spr_route_bordD×9, spr_route_bordH×2, spr_coinHautGauche×2, spr_coinHautDroite×2, spr_ventilation×1] ; `layer_textureGenerator` (I, 700) [33] ; `Background` (B, 800) [spr_texture_gris_full, répété]
- **rm_world2_1** : mêmes couches (ordre : `layer_doors` -500, `layer_murs` -400, `tiles_mur_epais` -300 [393 non vides], `tiles_mur_fin` -200 [1249], `layer_warFog` -100 masquée [38], `layer_npc` 0 [62], `layer_lumiere` 100 [0], `layer_code` 200 [14], `layer_deco` 300 [224], `layer_fenetre` 400 [13], `layer_nextRoomInstances` 500 [1], `tiles_element_graphiques` 600 [3 × spr_tapis], `layer_textureGenerator` 700 [27]) ; `Background` (B, 800) [couleur 0xff4c4c4c]
- **rm_world2_2** : mêmes couches que rm_world2_1, presque toutes vides (`layer_npc` [1], `layer_code` [4], `layer_deco` [3]) ; `Background` [spr_texture_gris_full, répété]
- **rm_world4** : `layer_doors` (I, -600) [22 : portes, boutons et carte] ; `layer_murs` (I, -500) [0] ; `tiles_mur_epais` (T, -400) [222×222 cases de 64 px, 723] ; `tiles_mur_fin` (T, -300) [444×444 cases de 32 px, 243] ; `layer_warFog` (I, -200, masquée) [27] ; `layer_npc` (I, -100) [39] ; `layer_code` (I, 0) [6] ; `layer_deco` (I, 100) [135] ; `layer_fenetre` (I, 200) [6] ; `layer_muret` (I, 300) [2] ; `layer_nextRoomInstances` (I, 400) [1] ; `tiles_element_graphiques` (A, 500) [0] ; `layer_textureGenerator` (I, 600) [22] ; `Background` (B, 700) [spr_texture_gris_full, répété]
- **rm_world4_1** : `layer_doors` (I, -600) [49] ; `layer_murs` (I, -500) [0] ; `tiles_mur_epais` (T, -400) [238×316 cases de 64 px, 716] ; `tiles_mur_fin` (T, -300) [475×632 cases de 32 px, 2811] ; `layer_warFog` (I, -200) [59] ; `layer_npc` (I, -100) [84] ; `layer_code` (I, 0) [23] ; `layer_deco` (I, 100) [251] ; `layer_fenetre` (I, 200) [17] ; `layer_muret` (I, 300) [18] ; `layer_light` (I, 400) [0] ; `layer_textureGenerator` (I, 500) [34] ; `tiles_element_graphiques` (A, 600) [1162] ; `Background` (B, 700) [spr_texture_gris_full, répété]
- **_rm_world1** : `layer_murs` (I, -50) [1096] ; `layer_noir` (I, -34) [18 obj_wall] ; `layer_player_npc` (I, -18) [10] ; `layer_objet_decor` (I, 0) [97] ; `layer_objet_code` (I, 100) [4] ; fond bck_01 répété
- **_rm_world1_1, _1_2, _1_4, _rm_world3** : couches `Compatibility_Instances_Depth_*` issues de la conversion GMS1→GMS2, fonds `Compatibility_Background_*` (bck_01) et `Compatibility_Colour`
- **_rm_world1_3** : `layer_murs` (I, -300) [2372] ; `layer_lumiere` (I, -200) [23] ; `layer_decor` (I, -100) [51] ; `layer_code` (I, 0) [5] ; `layer_labyrinthe` (B, masquée) [sprite_136] ; fond bck_01
- **_rm_arena1 / _1_1 / _1_2 / _1_3** : `layer_player_npc` (I, 0) ; `layer_murs` (I, 100) ; (`layer_noir`, `layer_objet_decor` dans _1_1) ; `layer_objet_code` ; `Background` bck_01 ; **_rm_arena1_2** a en plus `sol_megatexture` (T, 300) [til_megatexture, 1253×960 cases de 8 px, 239 885 non vides]
- **rm_arena1_3 (orpheline)** : comme _rm_arena1_3 + `sol_megatexture` (T, 300) [til_megatexture, 2253×2135 cases de 8 px, 1 167 653 non vides] ; **rm_arena2 (orpheline)** : `Tiles_1` (T, 300) [til_sol_accueil, 1253×960 cases de 8 px, 6615 non vides]
- **rm_test_textureGenerator** : `layer_murs` ; `tiles_mur_fin` (32×24 cases de 32 px, vide) ; `tiles_mur_epais` (16×12 cases de 64 px, vide) ; `Instances` [3 obj_textureGenerator_cafet] ; fond spr_texture_gris_full
- **rm_test_light** : `mumurs` (I, 0) [17 obj_mur_epais + obj_gabari_hero] ; `lumiere` (I, 100) [12 obj_lumiere + obj_camera] ; fond spr_texture_carrelage_cafet

Tilesets du projet (noms, `git ls-tree`) : `til_murs_epais`, `tile_murs_fin`, `til_megatexture`, `til_sol_accueil`, `til_sol_beton`, `til_sol_cafet`, `til_sol_carrelage`, `til_sol_eau`, `til_sol_grille`, `til_sol_gris`, `til_sol_moquette1`, `til_sol_moquette2`, `til_sol_parquet`, `til_sol_pave`, `bck_02_tileset`, `bck_pave_tileset`, `maze`. Les trois derniers ne sont utilisés par aucune room.

---

## 2. Format des fichiers rooms/*.yy

### 2.1 Structure générale

Chaque room est un fichier JSON `rooms/<nom>/<nom>.yy` (format GMS2 2.2, `"mvc": "1.0"`). Clés de premier niveau (ex. rooms/rm_world2/rm_world2.yy) :

```json
{
  "name": "rm_world2",
  "id": "c5fc0ff8-e66e-427b-83b0-629496e834b5",
  "creationCodeFile": "RoomCreationCode.gml",
  "inheritCode": false, "inheritCreationOrder": false, "inheritLayers": false,
  "instanceCreationOrderIDs": [ "<id d'instance>", "... 570 entrées ..." ],
  "IsDnD": false,
  "layers": [ "... voir 2.2 ..." ],
  "modelName": "GMRoom",
  "parentId": "00000000-0000-0000-0000-000000000000",
  "physicsSettings": { "PhysicsWorld": false, "PhysicsWorldGravityX": 0, "PhysicsWorldGravityY": 10, "PhysicsWorldPixToMeters": 0.1, "...": "..." },
  "roomSettings": { "Width": 13000, "Height": 8000, "persistent": false, "inheritRoomSettings": false, "modelName": "GMRoomSettings", "...": "..." },
  "mvc": "1.0",
  "views": [ "... 8 objets GMRView ..." ],
  "viewSettings": { "enableViews": true, "clearDisplayBuffer": true, "clearViewBackground": false, "...": "..." }
}
```

- **Taille** : `roomSettings.Width` / `roomSettings.Height` (pixels).
- **Code de création de la room** : `creationCodeFile` = nom d'un fichier dans le même dossier (`RoomCreationCode.gml`) ou `""` s'il n'y en a pas.
- **Ordre de création** : `instanceCreationOrderIDs` = liste des `id` d'instances dans l'ordre de création (toutes couches confondues).
- **Vues** : tableau de 8 `GMRView` : `{"id","hborder","hport","hspeed","hview","inherit","modelName":"GMRView","objId","vborder","visible","vspeed","wport","wview","xport","xview","yport","yview"}`. Seule la vue 0 est `visible`. Valeurs rencontrées : 1024×768 (salles récentes), 1920×1080 avec bordures 1024/768 (anciens `_rm_world*`), port 1920×1000 pour rm_mainMenu et rm_score. `objId` (objet suivi) est nul partout sauf dans _rm_world1 et _rm_world1_3 où il désigne un objet supprimé du projet. **Ces réglages sont sans importance pour le remake** : `obj_camera` remplace la caméra de la vue 0 à l'exécution (§3.4).

### 2.2 Couches

`layers` est un tableau d'objets ; chaque couche a un champ `layers` (sous-couches) qui est vide partout dans ce projet, mais un convertisseur devrait le parcourir récursivement. Champs communs : `name`, `id`, `depth` (entier, plus petit = devant), `visible`, `grid_x`, `grid_y`, `userdefined_depth`, `hierarchyFrozen`, `hierarchyVisible`, `inherit*`, `m_parentID`, `m_serialiseFrozen`, `modelName`, `__type`, `mvc`. Quatre types sont utilisés (`modelName`) :

**a) `GMRInstanceLayer`** — champ `instances` : tableau d'objets `GMRInstance` :

```json
{"name": "inst_C4C71A4", "id": "545ad719-8f06-4a95-adb7-d2275197ac15",
 "colour": { "Value": 4294967295 },
 "creationCodeFile": "", "creationCodeType": "",
 "ignore": false, "inheritCode": false, "inheritItemSettings": false, "IsDnD": false,
 "m_originalParentID": "00000000-0000-0000-0000-000000000000", "m_serialiseFrozen": false,
 "modelName": "GMRInstance", "name_with_no_file_rename": "inst_C4C71A4",
 "objId": "45016e94-47bf-4991-862f-a8c32afa8083",
 "properties": [
   {"id": "a7cef7fd-...", "modelName": "GMOverriddenProperty", "objectId": "45016e94-47bf-4991-862f-a8c32afa8083", "propertyId": "56ce56f7-f877-4748-8132-f4be28cc9223", "mvc": "1.0", "value": "1"},
   {"id": "87ea66ed-...", "modelName": "GMOverriddenProperty", "objectId": "ba6bdae0-421e-418c-afdc-87400a7c20f1", "propertyId": "4c546c64-13ba-4507-b09a-fea44482a65a", "mvc": "1.0", "value": "True"}
 ],
 "rotation": 90, "scaleX": 1, "scaleY": 1, "mvc": "1.0", "x": 3872.278, "y": 4735.864}
```

(exemple réel : une `obj_door` de rm_world2 avec `doorId = 1` et `blockedOpen = True`.)

- `x`, `y` : position de l'origine du sprite, en pixels, flottants possibles.
- `rotation` : `image_angle` en degrés, sens **antihoraire** (convention GameMaker, axe y vers le bas). En Phaser : `angle = -rotation`. Valeurs non multiples de 90 fréquentes (PNJ, mobilier, quelques murs).
- `scaleX`, `scaleY` : `image_xscale` / `image_yscale`. Très utilisés pour dimensionner les zones (`obj_warFog`, `obj_textureGenerator_*`, `obj_endLevel`, `obj_lumiere`). Valeurs négatives = miroir (30 instances, ex. portes doubles).
- `colour.Value` : entier 32 bits `0xAABBGGRR` (teinte `image_blend` + alpha). 4294967295 = blanc opaque. 20 instances seulement ont une teinte (tables et conteneurs assombris dans rm_world2, lumières de rm_test_light).
- `objId` : GUID de l'objet (voir 2.3).
- `ignore: true` : l'instance n'est pas créée à l'exécution (11 lumières de rm_test_light uniquement).
- `creationCodeFile` : `""` ou `InstanceCreationCode_<name>.gml` dans le dossier de la room (voir 2.4). **Attention** : 38 instances référencent un fichier qui n'existe pas sur disque (31 dans les rooms du projet, 7 dans l'orpheline rm_arena1_3 ; probablement du code vidé dans l'éditeur) ; à traiter comme « pas de code ».
- `properties` : `null`, `[]` ou tableau de surcharges de variables d'objet (voir 2.4).

**b) `GMRTileLayer`** — une tilemap :

```json
{"modelName": "GMRTileLayer", "name": "tiles_mur_epais", "depth": -300, "visible": true,
 "prev_tilewidth": 64, "prev_tileheight": 64, "x": 0, "y": 0,
 "tilesetId": "0253f248-3a5b-4331-8acd-c5bd5dd6e4b2",
 "tiles": { "SerialiseData": null, "SerialiseWidth": 204, "SerialiseHeight": 125,
            "TileSerialiseData": [2147483648, 2147483648, 1, 1, 15, 1, "..."] }}
```

- `tiles.TileSerialiseData` : tableau plat **non compressé** de `SerialiseWidth × SerialiseHeight` entiers, **ligne par ligne** (indice = `y * SerialiseWidth + x`).
- Valeur d'une case : bits 0–18 = indice de tuile dans le tileset (0 = vide) ; bits 28/29/30 = miroir / retournement / rotation (convention GMS2) ; la valeur `2147483648` (bit 31 seul) = case jamais peinte, à traiter comme vide. **Dans tout le projet, seuls des indices simples et 2147483648 apparaissent** (aucun miroir/rotation).
- Taille d'une case : `prev_tilewidth` / `prev_tileheight` (64 pour `til_murs_epais`, 32 pour `tile_murs_fin`, 8 pour megatexture). Décalage de la couche : `x`, `y` (toujours 0).
- `tilesetId` : GUID du tileset (résolution comme en 2.3).
- Exemple réel, rm_world2, `tiles_mur_epais`, début de la ligne 21 (`.` = 2147483648) : `1 1 1 … 1 15 1 1 … 1 12 . . . . . . . . . . . . 10 1 1 1 15 1 …` (1 = mur horizontal, 15 = T, 12 et 10 = bouts : une ouverture de 12 cases dans le mur).

**c) `GMRAssetLayer`** — champ `assets` : sprites décoratifs sans objet (`GMRSpriteGraphic`) : `{"name","id","spriteId","x","y","rotation","scaleX","scaleY","colour":{"Value"},"frameIndex","animationFPS","animationSpeedType","ignore", ...}`. Exemple réel (rm_world2) : `spriteId` de spr_tapis, `x: 4543.747, y: 6080.215, rotation: -0.8223435, scaleX: 1.138829, scaleY: 1.208469, colour 4284874605`.

**d) `GMRBackgroundLayer`** — `spriteId` (ou GUID nul = couleur unie), `colour.Value`, `htiled`, `vtiled`, `stretch`, `hspeed`, `vspeed`, `x`, `y`.

### 2.3 Retrouver un nom à partir d'un GUID

Deux méthodes équivalentes :
1. `Stand-For-Planet-Earth.yyp` → `resources` : tableau de `{"Key": "<GUID>", "Value": {"id": "...", "resourcePath": "objects\\obj_door\\obj_door.yy", "resourceType": "GMObject"}}`. Le nom est le dernier segment du chemin. Vaut pour les objets (`GMObject`), sprites (`GMSprite`), tilesets (`GMTileSet`), rooms (`GMRoom`).
2. Lire chaque `objects/<nom>/<nom>.yy` : champs `"id"` (le GUID utilisé dans `objId`) et `"name"`.

Champs utiles d'un objet (`objects/<nom>/<nom>.yy`) : `parentObjectId` (héritage), `spriteId`, `maskSpriteId`, `solid`, `visible`, `persistent`, `eventList` (événements ; un `.gml` par événement : `Create_0`, `Step_0`, `Draw_0`, `Draw_64` = Draw GUI, `Other_4` = Room Start, `Other_5` = Room End, `Other_3` = Game End, `Alarm_N`, …), `properties` et `overriddenProperties`.

### 2.4 Propriétés par instance

Trois mécanismes se cumulent, appliqués dans cet ordre (le dernier gagne) :

1. **Variables d'objet** (`properties` dans le `.yy` de l'objet) : `{"id": "<GUID de propriété>", "varName": "doorId", "varType": 1, "value": "-1", ...}`. `value` est toujours une chaîne : nombre, `"True"`/`"False"`, nom de ressource (`"rm_world2_1"`, `"obj_card_green"`) ou expression GML (`"10*room_speed"`). Types rencontrés (`varType`) : 0 réel, 1 entier, 2 chaîne, 3 booléen, 5 ressource, 7 couleur.
2. **Surcharges par un objet enfant** (`overriddenProperties` dans le `.yy` de l'enfant) : `{"objectId": "<objet qui déclare la propriété>", "propertyId": "<GUID>", "value": "..."}`. Ex. obj_automaticDoor : `automaticDoor = True`.
3. **Surcharges par instance** (`properties` de l'instance dans la room, même forme). Il faut chercher `propertyId` dans les `properties` de l'objet désigné par `objectId` (qui peut être un parent) pour obtenir `varName`.
4. Puis l'événement Create de l'objet, puis le **code de création d'instance** (`InstanceCreationCode_<inst>.gml`), qui est du GML libre. Dans ce projet ce sont presque uniquement des affectations simples.

Variables d'objet déclarées (défauts) utiles aux niveaux :

| Objet | Variables (valeur par défaut) |
|---|---|
| obj_door_parent | automaticDoor=false ; blockedOpen=false ; detectionRange=200 ; openTime=0.5 ; closeTime=0.5 ; stayOpenTime=1 |
| obj_door | doorId=-1 (surcharge : openTime=1, closeTime=1, stayOpenTime=2) |
| obj_door_card_parent | cardToOpen=noone (surcharge : blockedOpen=True, openTime=1, closeTime=1, stayOpenTime=2) |
| obj_button | doorId=-1 |
| obj_changeRoom_parent | nextRoom=rm_world2_1 ; message="Going Upstairs in : " ; countdownDuration=10*room_speed ; spawnNumberOfNextRoom=1 |
| obj_spawn1..4, obj_spawner | spawnNumber=1 |
| obj_spawnVehicle | dropingAngle=0 ; stayDownDuration=1 ; startDecelerateDistance=300 ; spd=8 ; usedAsHeroDrop=False |
| obj_warFog | warFogNumber=noone ; attachedWarFogNumber=noone ; apparitionSpeed=0.08 |
| obj_textureGenerator_parent | checkBottomTile=0 ; tileSet=noone ; cellSize=16 ; cellsPerLine=22 ; cellsPerColonne=21 |
| obj_decor_base | bulletCrossed=False |
| obj_casierModulable | angleGauche=0 ; angleDroite=0 ; maxAngle=10 ; closed=0 |
| obj_localNpc | normalSpd=5 ; maxHealth=5 ; hearRange=1000 ; viewRange=800 ; genre=humain ; patrolRange=1500 ; patrolPauseTime=2 ; patrolSpeed=5 ; patrolType=random |
| obj_countdown_GUI | parent=noone ; duration=10*room_speed ; color=$FF4843E0 ; message="no message" |

Surcharges par instance réellement présentes dans les rooms :
- `obj_door` : `doorId`, `blockedOpen` ; `obj_button` : `doorId` ;
- `obj_warFog` : `warFogNumber`, `attachedWarFogNumber`, `apparitionSpeed` (0.12 pour 4 instances de rm_world4_1) ;
- `obj_spawn1..4` : `spawnNumber = 2` (second jeu de spawns de rm_world2) ;
- `obj_nextRoom` / `obj_previousRoom` : `nextRoom`, `spawnNumberOfNextRoom`, `message` ;
- `obj_textureGenerator_cafet` : `checkBottomTile = True` (9 instances) ;
- `obj_casierModulable` : `closed = True` ; PNJ : `patrolType` (`points`, `none`), `normalSpd = 0` ;
- boutons du menu : `colonne`, `position`, `spawnDelay`.

Codes de création d'instance existants (exhaustif par forme) :
- `doorId=N` (portes et boutons de rm_world4, rm_world4_1, anciennes arènes) ; `buttonId = N` (anciennes salles ; variable **jamais lue**, le code qui s'en servait est commenté dans `scr_pressButtonCheck`) ;
- `obj_lumiere` : 4 lignes `radius = 716.80` / `hue = 0` / `sat = 0` / `lightIntensity = 0.45` (ex. réel, rooms/rm_world2/InstanceCreationCode_inst_6146A738.gml) ;
- menus : `buttonNumber = 1..4` (obj_btn_player), `visible = false;` (obj_btn_back de rm_choseHero) ;
- cas isolés dans rm_world2 : `solid = false` (un siège), `DEBUG_NPC = true;` (un PNJ), et un PNJ à points de patrouille : `patrolPoints = ds_list_create(); ds_list_add(patrolPoints, "5486;5612", "5060;5721", "5151;5277"); maxTimeToReachNextPosition = 2;`.

### 2.5 Faisabilité d'un convertisseur automatique vers JSON

**Faisable sans difficulté majeure** : tout est du JSON régulier, les tuiles ne sont pas compressées, et les codes de création se réduisent à des affectations `nom = valeur` lisibles par expression régulière (un seul cas avec `ds_list_add`). Un prototype d'inventaire en Node.js (≈ 60 lignes) a parcouru les 24 rooms pour produire les tableaux de ce document. Étapes recommandées :

1. Charger le `.yyp` et tous les `objects/*.yy` → tables GUID→nom, parent, sprite, propriétés (défauts + surcharges d'enfant résolues en remontant la chaîne de parents).
2. Pour chaque room : parcourir `layers` récursivement ; pour chaque instance non `ignore`, émettre `{objet, x, y, angle, scaleX, scaleY, teinte, couche, profondeur, props}` où `props` = défauts ← surcharges d'enfant ← surcharges d'instance ← affectations du code de création (si le fichier existe).
3. Couches de tuiles de murs : convertir chaque case non vide en mur avec la table indice → (pièce, rotation) du §7.2 (reproduit `scr_createMurEpaisFromTile` / `scr_createMurFinFromTile`).
4. Sols : chaque `obj_textureGenerator_*` devient un rectangle texturé (§7.3). Fond : couche `Background`.
5. Couche d'assets : liste de sprites décoratifs (position, rotation, échelle, teinte).
6. Ajouter à la main ce qui est créé par code et non placé dans la room : `obj_consigne_world2`, `obj_ambientShadow`, `obj_score`, caméra, etc. (§3).

Prérequis manquant ici : les `sprites/*/*.yy` (largeur, hauteur, origine `xorig`/`yorig`, type de masque) sont indispensables pour convertir les échelles en tailles en pixels (zones de brouillard, sols, sortie de niveau) et pour les boîtes de collision. Ils existent dans le dépôt (commit d438c548) mais n'ont pas été extraits pour cette analyse.

---

## 3. Initialisation d'une salle

### 3.1 scr_room_world_ini(firstRoom) (scripts/scr_room_world_ini)

Appelé par le code de création de chaque salle de jeu :
1. `scr_showNotification("Joined world " + room_get_name(room), c_green)` : notification verte (voir §6.3).
2. Globales : `global.inWorld = true` ; `global.currentWorld = room` ; `global.firstRoomOfTheLevel = firstRoom` ; `global.npcIdCounter = 0` ; `global.creativeMod = false` ; `global.gamePaused = false`.
3. Si `firstRoom` : détruit `obj_score` s'il existe et en recrée un sur la couche `"layer_code"` (remise à zéro du score). L'appel `scr_requestToEnterRoom()` (réseau) est commenté **[DÉSACTIVÉ]**.
4. Crée s'ils n'existent pas : `obj_gui`, `obj_roomsMemory`, `obj_camera`, `obj_spawner`, `obj_grid` (grille de pathfinding des PNJ, cases de 32 px).

**[INFÉRENCE]** les anciennes salles marquées `firstRoom = true` sans couche `layer_code` (_rm_world1, _rm_arena1*, _rm_world3, rm_test_textureGenerator) provoqueraient une erreur à `instance_create_layer(…,"layer_code",…)` : confirmation qu'elles ne sont plus maintenues.

### 3.2 scr_room_chat_ini et scr_room_menu_ini

- `scr_room_chat_ini()` : crée `obj_chatTyping` (zone de saisie de chat ; Entrée pour écrire). Appelé seulement par `_rm_arena1_3` et par `obj_RoomCreator` ; commenté ailleurs **[DÉSACTIVÉ en jeu normal]**. La saisie sert de console : `scr_consoleMessage` (`goto_world1`, `goto_world1_1`, … `goto_world2`, `goto_arena` ; seul `goto_world2` vise une room existante) et `scr_creativeModMessage` (§3.6).
- `scr_room_menu_ini()` : `global.inWorld = false` ; crée `obj_gui` si absent ; détruit `obj_score`.

### 3.3 obj_roomsMemory et obj_cleaningRoom (persistance des salles)

- `obj_roomsMemory` (persistant) tient la liste `ds_roomCrossed`. À chaque début de salle en jeu (Other_4) : `room_persistent = true` et ajout de la salle à la liste. Conséquence : **une salle quittée garde son état** (PNJ morts, portes ouvertes, bonus ramassés) quand on y revient (rm_world2 ↔ rm_world2_1). Le code de création d'une salle persistante ne se rejoue pas au retour.
- `obj_cleaningRoom` (persistant) sert à quitter proprement : à chaque step il met `room_persistent = false`, visite une à une les salles de `ds_roomCrossed` (de la dernière à la première) pour les réinitialiser, puis fait `room_goto(roomToGo)` et se détruit. Créé par `scr_exitLevel` et par `obj_btn_retry`. `obj_roomsMemory` est détruit au retour dans rm_mainMenu (code de création de rm_mainMenu).

### 3.4 Caméra (objects/obj_camera)

- Créée par `scr_room_world_ini` (ou par la première `obj_lumiere`). Vue de base **1920×1080**, dézoom maximal ×1,5 (`maxViewHeight = 1620`, `maxViewWidth = 2880`), marge `borderMargin = 300`. Projection orthographique affectée à `view_camera[0]`.
- Position initiale : moyenne des positions de `obj_spawn1..4`.
- Chaque step (Step_1) : si des héros existent, `scr_setCameraZoom()` puis `scr_setCameraCoordinates()` : cible = moyenne des « bouts de canon » des héros encore affichés, bornée à la salle et aux marges ; lissage `x += (xTo - x)/20`. Les héros sont en retour bornés à la vue maximale moins 300 px et à 70 px des bords de la salle (scripts/scr_moveAndCollision).
- La caméra est aussi l'auditeur audio (`audio_listener_position`). F9 (KeyRelease_120) : contrôle manuel, seulement si le héros `obj_RoomCreator` existe **[TEST]**.

### 3.5 Apparition des héros

**Points de spawn** : `obj_spawn1`, `obj_spawn2`, `obj_spawn3`, `obj_spawn4` (objets sans sprite ni code ; un par numéro de joueur), chacun avec `spawnNumber` (1 par défaut). `obj_spawner` (persistant, `spawnNumber = 1` par défaut) désigne le jeu de spawns à utiliser.

**obj_spawner, événement Room Start** (objects/obj_spawner/Other_4.gml) : si `global.inWorld`, et sauf si un `obj_spawnVehicle` avec `usedAsHeroDrop` existe ou si `obj_cleaningRoom` existe, il appelle `scr_spawnLocalPlayer()` puis recale la caméra.

**scr_spawnLocalPlayer** (scripts/scr_spawnLocalPlayer) :
- s'il n'existe aucun héros : pour chaque contrôleur ayant un `heroSelected`, crée ce héros sur `scr_getHeroSpawn(playerNumber)` (l'instance de `obj_spawn<playerNumber>` dont `spawnNumber == obj_spawner.spawnNumber`), lui affecte `playerNumber` et `controller`, et crée sa barre de vie (`scr_createHealthBar`) ;
- sinon (changement de salle : les héros sont persistants) : déplace chaque héros sur son spawn.

En solo, le joueur occupe le premier emplacement libre de l'écran de sélection, donc normalement `playerNumber = 1` → `obj_spawn1`.

**Arrivée en véhicule (obj_spawnVehicle) — codée mais [DÉSACTIVÉE dans les données]** :
- Présent dans rm_world2 (4171, 8448) et _rm_world1_1, avec un `obj_spawnHeros` (point de dépose, rm_world2 : (5323, 7392)). Dans les deux cas `usedAsHeroDrop` garde sa valeur par défaut `False`, et le Create de `obj_spawnVehicle` se termine alors par `instance_destroy()` : **le véhicule n'apparaît jamais** et les héros naissent sur les spawns.
- Comportement prévu si `usedAsHeroDrop = True` (objects/obj_spawnVehicle) : états `coming` → `descending` → (attente) → `ascending` → `escaping`. Le véhicule (échelle 1,1) suit un chemin jusqu'à `obj_spawnHeros` à la vitesse `spd = 8` en ralentissant à `startDecelerateDistance = 300` px ; à moins de 100 px il « descend » : rotation de 0,8°/step vers `dropingAngle`, échelle réduite de 0,001/step jusqu'à 1 ; une fois posé, attente `stayDownDuration` (1 s) puis les héros sont libérés (`onSpawnVehicle = false`), le véhicule remonte (échelle → 1,1), tourne vers `escapeAngle` (direction d'arrivée − 90°) et repart jusqu'à un point symétrique où il se détruit. Une ombre (`spr_spawnVehicleShadow`, alpha 0,5) est dessinée décalée selon l'altitude.
- `scr_createDisabledHerosOnSpawnVehicle` crée les héros directement sur le véhicule (`onSpawnVehicle = true`, même échelle que lui) aux 4 positions relatives au sprite données par `scr_arrayOfSpawnPositionRelativeToSprite` : joueur 1 (355, 208), 2 (355, 400), 3 (212, 208), 4 (212, 400) ; à chaque step (Step_2) ils sont recollés au véhicule, orientés à ±90° de son angle. Tant que `onSpawnVehicle`, `scr_deployHero` maintient l'état `notDeployed`.
- `obj_dropHeros` : dossier orphelin (un seul `Draw_0.gml` qui dessine un cercle rouge, pas de `.yy`) **[DÉSACTIVÉ]**.

### 3.6 obj_RoomCreator et scr_roomCreatorMove **[TEST / outil de développement]**

`obj_RoomCreator` est un enfant de `obj_localPlayer` (sprite `spr_npc_valise`) sélectionnable comme un héros (§8.2). Son Create met `global.creativeMod = true`, active le chat (`scr_room_chat_ini`) et masque la couche du brouillard. C'est un éditeur en jeu : commandes de chat `create <objet>` (crée l'objet sous la souris ; les `obj_lumiere` vont dans `layer_lumiere`), `resize <sprite>`, `debug path|patrol|range [view|hear|attack]|grid`, `fire`, `pause` (scripts/scr_creativeModMessage) ; molette pour redimensionner/tourner, touches 1/2/3 + molette pour teinte/saturation/intensité d'une lumière ; à la fermeture du jeu (Other_3) il écrit dans la console de debug la liste des instances créées, à recopier à la main dans l'éditeur. Textes d'aide affichés (Draw_64) : « Exemple : create obj_lumiere », « Exemple : resize spr_wall », « F9 to control camera », « Controlling camera... », « ZQSD to move camera », « MouseWheel to dezoom », « F9 to stop controlling Camera », « TAB for more incrementation speed », « MouseWheel for radius(…) », etc. `scr_roomCreatorMove` est sa variante de déplacement (sans bonus de vitesse ni bornage caméra). **À ne pas porter dans le remake.**

---

## 4. Changement de salle et fin de niveau

### 4.1 obj_changeRoom_parent et ses enfants

Enfants : `obj_nextRoom`, `obj_previousRoom` (sprite `spr_teleporteur_waiting`, visibles), `obj_nextRoom_invisible` (invisible, placé nulle part), `obj_endLevel` (sprite `spr_exitLevel`, invisible). `obj_nextRoom` et `obj_previousRoom` n'ont aucun code propre : seule la valeur de `nextRoom` les distingue.

Logique (objects/obj_changeRoom_parent/Step_0.gml), à chaque step :
1. `playerReady` = nombre de héros (`obj_localPlayer`) en contact avec la zone (`place_meeting`).
2. Si `playerReady >= nombre de héros / 2` :
   - si **tous** les héros sont dans la zone → `countdownIsOver = true` (passage immédiat) ;
   - sinon, s'il n'y a pas déjà de compte à rebours → crée un `obj_countdown_GUI` avec `message` et `duration = countdownDuration` (10 s).
3. Sinon : détruit le compte à rebours en cours.
4. Quand `countdownIsOver` : détruit le compte à rebours, `obj_spawner.spawnNumber = spawnNumberOfNextRoom`, puis `scr_transitionToNextRoom(nextRoom)`.
5. Sprite : `spr_teleporteur_active` si un héros est dessus, sinon `spr_teleporteur_waiting`.

**En solo** : le joueur seul représente « tous les héros » ; le passage est donc immédiat dès qu'il touche la zone, sans compte à rebours. Les héros morts comptent dans le nombre total de héros.

Un ancien algorithme (liste `ds_playerReady`, appel réseau `scr_askAllPlayersToGoToRoom`) est conservé en commentaire en tête du même fichier **[DÉSACTIVÉ]**. L'événement Destroy fait encore `ds_list_destroy(ds_playerReady)` alors que cette liste n'est plus créée (reliquat, erreur potentielle).

`obj_countdown_GUI` (Draw_64) : affiche `message` centré en haut de l'écran (à 1/8 de la hauteur), police `fnt_2_large`, couleur `$FF4843E0` (rouge RVB 224, 67, 72), puis en dessous les secondes restantes en grand (`fnt_2_XXL`) suivies de ` : ` et du reste en steps. Une seule instance à la fois. À zéro : `parent.countdownIsOver = true`.

### 4.2 Transition (scr_transitionToNextRoom, scr_transitionMapTo, obj_roomTransition)

Les deux scripts sont identiques : s'il n'existe pas d'`obj_roomTransition`, en créer un avec `tempTarget = <room>`. `obj_roomTransition` (persistant, Draw_64) : fondu vers une couleur unie à `fadeSpeed = 0.15` d'alpha par step (≈ 7 steps), une image tenue à alpha 1, `room_goto(tempTarget)`, puis fondu inverse et destruction. Couleur : gris très sombre `make_color_hsv(0,0,19)` si une caméra existe (en jeu), blanc sinon (menus).

Exceptions sans fondu : le lancement de partie (`obj_btn_go` → `room_goto` direct) et la fin de niveau (`obj_endLevel` → `room_goto(rm_score)` direct).

`scr_nextRoom_previousRoom` : entièrement commenté **[DÉSACTIVÉ]**.

### 4.3 Fin de niveau : obj_endLevel → rm_score

`obj_endLevel` (objects/obj_endLevel/Step_0.gml) reprend la logique du parent avec une différence : la branche « tous les héros présents → passage immédiat » est commentée. **Il y a donc toujours un compte à rebours de 10 s**, déclenché dès que la moitié au moins des héros est dans la zone, annulé s'ils en sortent ; message « Leaving area :  ». À la fin : destruction de tous les héros et de `obj_spawner`, puis `room_goto(rm_score)`.

Une seule instance existe dans tout le jeu : rm_world2, zone invisible en haut de la carte.

**Écran de score** (rm_score ; dessiné par `obj_score`, persistant, Draw_0) : fond `spr_fondMenu_1`, texte blanc `fnt_2_XXL` :
- titre « Score »
- « Percent of civil killed : N% »
- « Percent of soldier killed : N% »
- « Total damage taken : N »
- « Total heal point : N »
- « Total ammo used : N »
- « Total energy used : N »
- « Global note : 42 » (valeur **codée en dur** **[INACHEVÉ]**)
- un bouton `obj_btn_exit` créé sous la liste → `scr_exitLevel(rm_mainMenu)`.

Compteurs de `obj_score` : `totalCivil` / `totalSoldier` = nombre d'instances de `obj_localNpc_civil` / `obj_localNpc_soldier` à sa création, augmenté à l'entrée de chaque nouvelle salle (Other_4, liste `roomCrossed`) ; `civilKilled` / `soldierKilled` incrémentés à la destruction d'un PNJ (objects/obj_localNpc/Destroy_0.gml) ; `totalAmmoUsed`, `totalUsedEnergy`, `totalHeal`, `totalDamageTaken` incrémentés par les scripts de tir/dégâts. L'affichage en jeu de ces compteurs (Draw_64) est commenté **[DÉSACTIVÉ]**.

`scr_exitLevel(roomToGo)` : détruit les héros, `obj_spawner` et les cartes (`obj_card_parent`), ferme la connexion réseau (`scr_closeConnectionToServer`), crée `obj_cleaningRoom` avec `roomToGo` (§3.3).

`rm_recapitulatif` (un bouton Exit) et `rm_loadingScreen` (le titre) ne sont atteints par aucun code **[DÉSACTIVÉ]**.

### 4.4 Défaite : obj_endGameMenu

`scr_setDead` (appelé par les héros) : si **tous** les `obj_localPlayer` sont dans l'état `"dead"`, crée `obj_endGameMenu` (une seule fois). Après 2,5 s (alarme 0), un panneau apparaît au centre de la vue (moitié de la vue en largeur et hauteur, couleur RVB (4, 12, 41), alpha 0,9) avec le texte « YOU LOSE » et deux boutons : `obj_btn_retry` (sélectionné par défaut) et `obj_btn_exit`.
- **Retry** (objects/obj_btn_retry/Step_0.gml) : détruit les héros puis crée `obj_cleaningRoom` avec `roomToGo` = **la salle courante** (et non la première salle du niveau). `obj_spawner` n'est pas détruit, donc son `spawnNumber` courant est conservé ; les cartes ramassées ne sont pas détruites ; `obj_score` n'est pas remis à zéro sauf si la salle est une « première salle ». **[INFÉRENCE]** : comportements probablement involontaires.
- **Exit** : `audio_stop_all()` puis `scr_exitLevel(rm_mainMenu)`.

Résurrection d'un allié (coop, scripts/scr_resurectAllie) : un héros vivant à moins de 100 px d'un héros mort, qui maintient la touche Use et possède au moins 3 points d'énergie, lance un compte à rebours circulaire (`obj_circularCountDown`, `resurectDuration = 3 s`) ; il perd 1 énergie à 2/3, 1/3 et 0 du temps restant, puis l'allié revient avec 3 points de vie. **En solo, la mort du héros est donc la défaite.**

### 4.5 Récapitulatif des conditions de victoire/défaite

- **Victoire** : uniquement dans rm_world2 — rester 10 s dans la zone `obj_endLevel` → écran de score. Aucune condition sur les ennemis, les foreuses ou le boss.
- **Défaite** : tous les héros morts → « YOU LOSE » → Retry (même salle) / Exit.
- Mondes 4 et salle 2_2 : aucune condition de victoire **[INACHEVÉ]**.

---

## 5. Portes, boutons, cartes

### 5.1 Hiérarchie et paramètres

`obj_decor_base` → `obj_door_parent` → `obj_automaticDoor`, `obj_door`, `obj_door_card_parent` → `obj_door_cardGreen`, `obj_door_cardPurple`.

| Type | Sprite | Ouverture | openTime | closeTime | stayOpenTime | blockedOpen | Déclencheur |
|---|---|---|---|---|---|---|---|
| obj_automaticDoor | spr_automaticDoor | automatique | 0,5 s | 0,5 s | 1 s | non | héros, PNJ ou PetDrone à moins de `detectionRange` = 200 px |
| obj_door | spr_door | par bouton | 1 s | 1 s | 2 s | non par défaut ; **True sur toutes les portes à bouton de rm_world2 et rm_world2_1** | `obj_button` de même `doorId` |
| obj_door_cardGreen | spr_door_key_green | par carte | 1 s | 1 s | 2 s | **oui** (reste ouverte) | porteur de `obj_card_green` + touche Use à moins de 100 px |
| obj_door_cardPurple | spr_door_key_purple | par carte | 1 s | 1 s | 2 s | **oui** | porteur de `obj_card_purple` + touche Use à moins de 100 px |

(objects/obj_door_parent/obj_door_parent.yy et `overriddenProperties` des enfants.)

### 5.2 Mécanique commune (objects/obj_door_parent)

- L'animation du sprite sert d'état : image 0 = fermée, dernière image = ouverte. `openSpeed = (image_number − 1) / (openTime × room_speed)` ; idem pour la fermeture.
- Trois alarmes : `alarm[0]` fin d'ouverture (→ `doorOpen = true`, lance `alarm[1] = stayOpenTime`) ; `alarm[1]` fin du maintien (→ si `!blockedOpen`, lance la fermeture, `alarm[2] = closeTime`) ; `alarm[2]` fin de fermeture (→ image 0, `doorOpen = false`).
- Pour les portes **non automatiques**, la zone de la porte est retirée de la grille de pathfinding des PNJ à l'ouverture et remise à la fermeture (`mp_grid_clear_rectangle` / `mp_grid_add_rectangle`).
- Chaque step, `scr_antiBlockingDoorSecurity` est appelé pour `obj_localPlayer`, `obj_localNpc` et `obj_PetDrone`. Si une instance de ce type est dans le cercle de rayon `detectionRange` (200 px) centré sur la porte :
  - porte automatique fermée (image 0) → lance l'ouverture ;
  - porte ouverte à fond → le maintien est relancé (`alarm[1] = stayOpenTime`) : la porte ne se referme pas tant que quelqu'un est à portée ; **et**, si l'occupant est un héros, tous les `obj_warFog` en contact avec la porte sont activés (§9.1) ;
  - porte en cours de fermeture → elle se rouvre.
  Cette sécurité vaut pour tous les types de portes : un PNJ proche maintient ouverte une porte à bouton déjà ouverte.
- Debug : F5 (obj_gui, KeyRelease_116) affiche le cercle de détection.

### 5.3 Boutons (objects/obj_button, scripts/scr_pressButton)

- `obj_button` (sprite `spr_button`) : n'agit que si `doorId >= 0`. Pour chaque héros à **120 px ou moins** (`distance_to_point`) et situé **du côté avant** du bouton (écart ≤ 90° entre la direction bouton→héros et l'angle du bouton), vivant, qui appuie sur Use (`useKey`) → `scr_pressButton`.
- `scr_pressButton` : pour chaque `obj_door` de même `doorId`, si aucune de ses alarmes n'est en cours (porte au repos), lance l'ouverture (`alarm[0] = openTime`). Un bouton peut commander plusieurs portes et plusieurs boutons la même porte.
- `scr_pressButtonCheck` : vidé de son contenu (envoi réseau commenté), appelé seulement par `obj_RoomCreator` **[DÉSACTIVÉ]**.
- Touche Use : E ou Entrée au clavier (scripts/scr_nameControllerBindsKeyboard), bouton X sur manette Xbox (obj_xbox_command).

### 5.4 Cartes (objects/obj_card_parent) et portes à carte (objects/obj_door_card_parent)

- `obj_card_green`, `obj_card_purple` (sprites `spr_doorKey_green` / `spr_doorKey_purple`) sont **persistantes** : ramassées au contact d'un héros (`carryBy = héros`), elles ne sont plus dessinées dans la salle mais en icône (échelle 0,5) à côté de la barre de vie du porteur (Draw_64). Elles suivent donc le groupe d'une salle à l'autre : la carte violette trouvée à l'étage (rm_world2_1) ouvre les portes violettes du rez-de-chaussée (rm_world2). Aucune possibilité de la poser ou de la passer.
- Porte à carte fermée, à chaque step :
  - si le **porteur** de la bonne carte est à moins de 100 px : s'il appuie sur Use → ouverture ; sinon texte « Press Use » (jaune, contour noir) ;
  - sinon, si un héros quelconque est à moins de 100 px : texte « Purple card needed » (violet) ou « Green card needed » (vert) ;
  - le texte est un `obj_text_glitch` (police `fnt_3_large`) placé à 80 px de la porte dans la direction `image_angle − 45°`, détruit quand plus personne n'est à portée ou que la porte est ouverte.
- Une fois ouverte, la porte à carte reste ouverte (`blockedOpen`).

### 5.5 obj_message **[DÉSACTIVÉ]**

`obj_message` : texte blanc centré en bas de la salle qui s'efface (alpha −0,005/step). Jamais créé par aucun code. Les messages réellement utilisés passent par `scr_showNotification` → `obj_chat` (§6.3).

---

## 6. Consignes, dialogues, cinématiques

### 6.1 obj_consigne_world2 **[INACHEVÉ]**

Créé par le code de création de rm_world2, persistant. Textes déclarés (objects/obj_consigne_world2/Create_0.gml) :

1. « Go to the upper floor »
2. « Find the purple key »
3. « Go back to ground floor »
4. « Exit to the drilling area »
5. « Destroy the drills »
6. « Kill SallyBot »
7. « Destroy the drills »

Affichage (Draw_64) : police `fnt_chat`, blanc, aligné à gauche à x = 10, y = 2/3 de la hauteur d'écran, largeur 200 px ; visible dès que tous les héros sont « déployés » (Step_0).

**Seul le texte 1 est affiché : `currentText` n'est modifié nulle part.** Les textes 2 à 7 décrivent le scénario prévu du monde 2 (étage → carte violette → retour → sortie vers la zone de forage → détruire les foreuses → tuer SallyBot) mais aucune logique d'objectifs n'existe. L'objet n'est jamais détruit par le code (il resterait affiché après le retour au menu). Les foreuses n'ont pas de points de vie (§7.6).

### 6.2 Cinématique et boîte de dialogue **[DÉSACTIVÉ]**

- `obj_cinematique` : bandes de cinéma (`spr_cine_bande`) qui se referment, boîte `spr_textBox`, texte écrit lettre par lettre, durée 3 s, met `global.gamePaused = true`. Texte unique (scripts/scr_cinematique1) : « You can run but you can't hide ! Bitch ! ». **Jamais instancié.**
- `obj_textBox` : boîte de dialogue de 300 px de large, texte lettre par lettre (`fnt_chat`), 2 s par réplique. Dialogue unique (scripts/scr_dialog_1, appelé avec `obj_PetBot` et `"elvis"`) :
  - « PetBot : Bienvenu dans SFPE Bienvenu dans SFPE Bienvenu dans SFPE  Bienvenu dans SFPE Bienvenu dans SFPE »
  - « elvis : Merci, je suis ravi d'être ici »
  **Jamais instancié** (texte de test).
- `scr_setTextBoxActions` : ne concerne pas les dialogues ; il dessine les champs de saisie réseau (« Enter port », « Enter IP », « Pseudo : … ») des `obj_textbox_*`, placés dans aucune room **[DÉSACTIVÉ]**.

### 6.3 Notifications et textes divers réellement affichés

- **Notifications** (`scr_showNotification(texte, couleur)` → `obj_chat`) : texte en bas à gauche (x = 5, y ≈ 4/5 de l'écran), police `fnt_chat`, largeur 400 px, affiché 5 s puis fondu ; les notifications précédentes sont décalées vers le haut. Messages :
  - « Joined world <nom de la room> » (vert), à chaque entrée dans une salle (scr_room_world_ini) — message de debug visible par le joueur ;
  - « Init lumiere » (bleu), une fois par lumière initialisée (scr_initializeLumiere) — debug ;
  - « The room <nom> is not available » (rouge) et « You need to choose a map. » (rouge) : ancien écran de cartes **[DÉSACTIVÉ]** ;
  - « Veuillez entrer une adresse IP et un port ! » (rouge) : écran réseau **[DÉSACTIVÉ]**.
- **Changement de salle** : « Going Upstairs in :  », « Going downstairs in :  », « Leaving area :  » (§4).
- **Portes à carte** : « Press Use », « Purple card needed », « Green card needed » (§5.4).
- **Défaite** : « YOU LOSE ». **Vignette de barre de vie** : « Dead » (propriété `deathText` de obj_healthBar_vignette).
- **Sélection** : « Press A/ENTER », « RoomCreator », « READY ! », « Waiting », « 3 », « 2 », « 1 », « GO ! », noms des salles, « random » (§8).
- **Debug permanent** (obj_gui, Draw_64, en haut à droite, vert) : « FPS : N » partout ; en jeu « state : … », « direction : … », « Number of heros : N », « hJoystick : … », « vjoystick : … ». À retirer dans le remake.

### 6.4 Effets « glitch »

- `obj_text_glitch` (monde) et `obj_text_glitch_GUI` (interface) : texte rendu dans une surface puis découpé en bandes horizontales décalées aléatoirement pendant 15 steps (rafraîchi toutes les 2 à 5 steps), puis affiché normalement ; rejoué à la disparition. Créés par `scr_createTextGlitch(GUI)` / `scr_refreshOrCreateTextGlitch(GUI)` (un seul texte par `parent`). Utilisés par les portes à carte et la vignette « Dead ».
- `obj_glitch` / `obj_glitch_GUI` : même effet sur le sprite d'une instance (bandes de 2 à 50 px, durée 10–40 ou 20–40 steps), l'instance étant masquée pendant l'effet. Créés par `scr_createGlitch` : boutons de menu sélectionnés, titre, vignette du héros dans la sélection, héros touché par une balle ou par SallyBot.
- `obj_global_glitch` : glitch de tout l'écran (30–60 steps). **Jamais instancié** **[DÉSACTIVÉ]**.

---

## 7. Murs, sols et décor

### 7.1 Hiérarchie et principe des collisions

```
obj_decor_base (bulletCrossed=False)
├── obj_door_parent → portes (§5)
├── obj_mur_parent → obj_mur_epais, _long, _angle, _bout, _croix, _plot, _T ;
│                    obj_mur_fin, _fin1, _fin_45, _fin_angle, _fin_bout, _fin_croix, _fin_long, _fin_plot, _fin_T ;
│                    obj_wall ; obj_fenetre
└── obj_mobilier_parent → tout le mobilier (dont voitures, foreuse, obj_mur_tres_long) ; obj_chaise_base → chaises
```

Il n'y a **ni moteur physique ni événements de collision** pour les déplacements ; tout est fait par tests `place_meeting` / `instance_place` / `collision_line` entre masques de sprites :

- **Déplacement des héros** (scripts/scr_calculMovingPoint) : la position visée est refusée si le héros y toucherait une instance de `obj_mur_parent`, `obj_decor_base` (donc murs, fenêtres, portes et **tout le mobilier, chaises comprises**), `obj_localPlayer` ou `obj_localNpc` (liste de scripts/scr_createobjectBlockingMovementList). En cas de blocage, le héros essaie de glisser : directions à ±10°, ±20°, … ±80° de la direction voulue, première libre retenue. Le drapeau `solid` des objets n'intervient pas dans ce test.
- **Balles** (objects/obj_bullet_base/Step_0.gml, §7.5).
- **PNJ** : grille de pathfinding `obj_grid` (cases de 32 px) où sont marqués `obj_mur_parent` et `obj_mobilier_parent` ; lignes de vue par `collision_line` contre `obj_mur_parent` et `obj_door_parent` (scripts/scr_isCollidingWithRoom).
- **Objets sans parent = décor pur, aucune collision** : `obj_mur_dessousFenetre` (muret dessiné sous les fenêtres), `obj_fauteuilRond1..4`, `obj_robot_atelier1..3`, `obj_tapis_accueil`, `obj_tapisRoulant_*`, `obj_foreuse_contours`, `obj_foreuse_faisceau`, ainsi que tous les sprites de la couche d'assets. `obj_button` n'est pas non plus dans la liste bloquante.
- `obj_decor_base` (Create) : `solid = true`, invisible à la création puis visible au premier step.

La forme exacte des collisions dépend des masques des sprites (rectangle englobant ou précis, par image pour les portes) : **non lisible ici** (sprites non extraits).

### 7.2 Murs générés depuis des tuiles

Dans les salles récentes, les murs sont peints dans deux couches de tuiles puis **convertis en instances au chargement** par le code de création de la room :

- `scr_createMurEpaisFromTile("tiles_mur_epais")` : parcourt la salle par pas de **64 px** ; pour chaque case non vide, crée dans la couche `layer_murs` l'objet correspondant **au centre de la case** (x + 32, y + 32) ; puis détruit la couche de tuiles.
- `scr_createMurFinFromTile("tiles_mur_fin")` : idem par pas de **32 px** (centre x + 16, y + 16).

Tables indice de tuile → objet et `image_angle` (degrés antihoraires), recopiées de scripts/scr_createMurEpaisInstanceFromTileCell et scr_createMurFinInstanceFromTileCell :

| Indice | Mur épais (64 px) | Mur fin (32 px) |
|---|---|---|
| 1 | obj_mur_epais, 0° | obj_mur_fin, 0° |
| 2 | obj_mur_epais, 90° | obj_mur_fin, 90° |
| 3 | obj_mur_epais_croix | obj_mur_fin_croix |
| 4 | obj_mur_epais_plot | obj_mur_fin_plot |
| 5 | obj_mur_epais_angle, 0° | obj_mur_fin_angle, 0° |
| 6 | obj_mur_epais_angle, 270° | obj_mur_fin_angle, 270° |
| 7 | obj_mur_epais_angle, 180° | obj_mur_fin_bout, 0° |
| 8 | obj_mur_epais_angle, 90° | obj_mur_fin_bout, 180° |
| 9 | — | obj_mur_fin_bout, 270° |
| 10 | obj_mur_epais_bout, 0° | obj_mur_fin_angle, 90° |
| 11 | obj_mur_epais_bout, 270° | obj_mur_fin_angle, 180° |
| 12 | obj_mur_epais_bout, 180° | — |
| 13 | obj_mur_epais_bout, 90° | — |
| 14 | — | obj_mur_fin_bout, 90° |
| 15 | obj_mur_epais_T, 0° | obj_mur_fin_T, 90° |
| 16 | obj_mur_epais_T, 270° | obj_mur_fin_T, 0° |
| 17 | obj_mur_epais_T, 180° | obj_mur_fin_T, 180° |
| 18 | obj_mur_epais_T, 90° | obj_mur_fin_T, 270° |
| 20 | — | obj_mur_fin_45, 0° |
| 21 | — | obj_mur_fin_45, 90°, xscale −1 |
| 22 | — | obj_mur_fin_45, 270°, xscale −1 |
| 23 | — | obj_mur_fin_45, 180° |
| 25 | — | obj_mur_fin_45, 270° |
| 26 | — | obj_mur_fin_45, 0°, xscale −1 |
| 27 | — | obj_mur_fin_45, 180°, xscale −1 |
| 28 | — | obj_mur_fin_45, 90° |

Tout autre indice est ignoré. Les indices réellement présents dans les 5 salles jouables vont de 1 à 18 (aucun mur à 45°).

**Fusion des murs alignés** (objects/obj_mur_parent/Draw_0.gml) : au premier dessin, chaque mur cherche ses voisins de la même famille (« épais » ou « fin », comparaison des 11 premiers caractères du nom d'objet) à ± une largeur de sprite horizontalement, sinon à ± une hauteur verticalement ; la rangée entière est dessinée dans une surface, transformée en un sprite unique (`sprite_create_from_surface`), et remplacée par **une seule instance de `obj_mur_parent`** centrée sur la rangée ; les pièces d'origine sont détruites. C'est une optimisation (moins d'instances, ombres plus simples). Les `obj_lumiere` attendent que tous les murs soient fusionnés (`copied`) pour s'initialiser. `obj_fenetre` est exclue de la fusion (`copied = true` dès la création). Les murs fins ont une profondeur augmentée de 1 (dessinés sous les murs épais).

**Anciennes salles** : les murs y sont des instances posées à la main (`obj_mur_fin_long`, `obj_mur_epais_long`, … et `obj_wall`, bloc noir redimensionné). `obj_mur_fin1` n'existe que dans _rm_world1_3. `obj_mur_tres_long` (enfant du mobilier, sprite introuvable) n'est placé nulle part.

**Pour le remake** : un mur = un rectangle plein par case de tuile (64×64 ou 32×32) est l'approximation naturelle ; l'épaisseur réelle des sprites de murs fins dans leur case de 32 px est à vérifier sur les images.

### 7.3 Sols : obj_textureGenerator_*

Les sols ne sont pas peints dans l'éditeur : on y pose des rectangles `obj_textureGenerator_<type>` (instances étirées par `scaleX`/`scaleY`) qui, à l'exécution, créent une tilemap remplie d'une texture répétée (objects/obj_textureGenerator_parent) :

- Rectangle couvert : de `x_start = cellSize × round(x / cellSize)` à `x_end = cellSize × round((x + sprite_width) / cellSize)` (idem en y), `sprite_width` = largeur native du sprite × `scaleX`.
- Une couche par type, nommée `tile_<nom de l'objet>`, créée sous toutes les autres ; la tilemap utilise le tileset `tileSet`.
- Remplissage (scripts/scr_setTilesOnTilemap) : les tuiles du tileset sont posées dans l'ordre, en bouclant sur `cellsPerLine − 1` colonnes et `cellsPerColonne` lignes : c'est une **texture répétée**. **[INFÉRENCE]** période = (cellsPerLine − 1) × cellSize en largeur et cellsPerColonne × cellSize en hauteur, soit 336×336 px par défaut et 512×256 px pour accueil/cafet ; à vérifier sur les images des tilesets.
- Raccord : avant de se remplir, un générateur cherche une tilemap **du même type** déjà initialisée juste au-dessus de lui (ou juste en dessous si `checkBottomTile`) et cale sa première tuile pour que le motif se prolonge sans couture (scripts/scr_getTileDataOfOtherTileMapAround, scr_getTileDataOfFirstCellFromTile).
- Quand tous les générateurs sont initialisés, la couche d'instances `layer_textureGenerator` est détruite.

| Objet | Tileset | Sprite (aperçu éditeur) | cellSize | cellsPerLine × cellsPerColonne |
|---|---|---|---|---|
| obj_textureGenerator_accueil | til_sol_accueil | spr_texture_carrelage_accueil | 16 | 33 × 16 |
| obj_textureGenerator_cafet | til_sol_cafet | spr_texture_carrelage_cafet | 16 | 33 × 16 |
| obj_textureGenerator_carreau, _carreau2 | til_sol_carrelage (les deux) | spr_texture_carreaux, spr_texture_carreaux2 | 16 | 22 × 21 |
| obj_textureGenerator_moquette1 / _moquette2 | til_sol_moquette1 / 2 | spr_texture_moquette / spr_texture_moquette2 | 16 | 22 × 21 |
| obj_textureGenerator_parquet | til_sol_parquet | spr_texture_parquet | 16 | 22 × 21 |
| obj_textureGenerator_grille | til_sol_grille | spr_texture_grille | 16 | 22 × 21 |
| obj_textureGenerator_gris | til_sol_gris | spr_texture_gris | 16 | 22 × 21 |
| obj_textureGenerator_beton | til_sol_beton | spr_texture_beton | 16 | 22 × 21 |
| obj_textureGenerator_eau | til_sol_eau | spr_texture_eau | 8 | 22 × 21 |
| obj_textureGenerator_pave | til_sol_pave | spr_texture_pave | 8 | 22 × 21 |

Utilisation : rm_world2 (accueil 2, carreau 3, cafet 11, moquette2 3, moquette1 1, parquet 2, grille 2, beton 5, pave 4), rm_world2_1 (27), rm_world4 (22), rm_world4_1 (34). `_carreau2`, `_gris` et `_eau` ne sont placés nulle part.

Sous ces sols, le fond de salle est `spr_texture_gris_full` répété (ou gris uni 0x4C4C4C pour rm_world2_1). Par-dessus, la couche d'assets `tiles_element_graphiques` porte des décalques (tapis, route et bordures, coins, ventilation).

**Autres techniques de sol, abandonnées** : « megatexture » (`til_megatexture`, tuiles de 8 px peintes à la main, dans _rm_arena1_2 et l'orpheline rm_arena1_3) et fond `bck_01` répété (anciennes salles).

**Pour le remake** : chaque générateur devient un rectangle à texture répétée (TileSprite Phaser) ; le raccord sans couture peut s'obtenir en alignant la texture sur les coordonnées du monde.

### 7.4 Mobilier

Tous les enfants de `obj_mobilier_parent` sont de simples obstacles statiques **sans code** (sauf mention) et **indestructibles** (aucun point de vie). Ils bloquent le déplacement des héros et la grille des PNJ. La variable `bulletCrossed` décide s'ils arrêtent les balles :

- **Laissent passer les balles** (`bulletCrossed = True`) : obj_canape, obj_fauteuil, obj_chaise_bleu, obj_chaise_marron, obj_siege_accueil, obj_lavabo, obj_plante, obj_plante2, obj_poubelle, obj_sapin, obj_table, obj_table0 à obj_table4, obj_table_attente.
- **Arrêtent les balles** (`False`, valeur par défaut) : obj_aquarium, obj_cadeau, obj_car, obj_car_amb, obj_car_audi, obj_car_cop, obj_car_minitruck, obj_car_taxi, obj_car_truck, obj_car_van, obj_car_viper, obj_casier, obj_casierModulable, obj_container, obj_crate, obj_decor_camera, obj_distributeur, obj_ecran, obj_etager1 à 4, obj_foreuse, obj_gene, obj_lampeBureau, obj_photocopieuse, obj_rack_serveur, obj_radiateur, obj_serveur, obj_table_accueil, obj_table_usine, obj_wc.

Cas particuliers :
- `obj_chaise_base` (chaises, siège d'accueil) : `solid = false` et profondeur +1 (dessinées sous les tables). Elles bloquent quand même le héros (test `place_meeting` sur `obj_decor_base`).
- `obj_casierModulable` : sprite `spr_casierModulable` avec deux portes dessinées par-dessus (`spr_casier_porteGauche` / `_porteDroite`) ; 2 chances sur 3 d'être fermé, sinon chaque porte est entrouverte d'un angle aléatoire de 0 à `maxAngle` = 10°. Purement visuel.
- `obj_crate` : angle aléatoire à la création.
- `obj_car*` : 9 modèles de voitures, obstacles simples (49 dans _rm_world1 ; 2 `obj_car_van` dans rm_world2).

### 7.5 Balles contre décor (objects/obj_bullet_base, scripts/scr_bulletCollision*)

À chaque step, une balle teste dans l'ordre :
1. **Contact avec un `obj_decor_base`** → `scr_bulletCollisionActionWithMurParent` :
   - mur (enfant direct de `obj_mur_parent`, mur fusionné) ou porte → `scr_bulletCollisionMur` ;
   - `obj_fenetre` → `scr_bulletCollisionFenetre` : si la fenêtre est intacte (`hp = 1`), elle se brise (`hp = 0`, image 1 du sprite) avec projection d'éclats (`obj_fenetre_eclat`, 3 salves) ; **la balle n'est pas arrêtée**, ni par la fenêtre intacte ni par la fenêtre brisée ;
   - mobilier → rien à cette étape.
2. **Contact avec le « mobilier sur la trajectoire »** : à sa création (Step_1), la balle calcule une seule fois le meuble **non traversable** le plus proche sur sa ligne de tir (portée `maxDistance`, scripts/scr_getMobilierOnTheWayOfBullet). Au contact → `scr_bulletCollisionActionWithMobilierParent` : effet d'impact, puis destruction de la balle (sauf balle d'EngiBot) ; une balle de BadaBot crée en plus une explosion.
3. PNJ, puis héros.

`scr_bulletCollisionMur` : balle ordinaire → particules d'impact (`scr_createBulletWallImpactParticules`) et destruction ; balle d'EngiBot (`obj_bullet_EngiBot`) → **rebond** (`action_bounce`) avec vitesse divisée par 2 ; batte de BatBot → son d'impact (`snd_batBot_hitMur1/2`).

`obj_fenetre` (sprite `spr_murEtFenetre`, enfant de `obj_mur_parent`) : bloque le déplacement dans tous les cas, même brisée. `obj_mur_dessousFenetre` est le muret décoratif associé.

### 7.6 Tapis roulants, foreuses, usine

- `obj_tapisRoulant_droit`, `_angle`, `_croix`, `_T` : sprites seuls, **aucun code, aucun parent, placés dans aucune room** **[INACHEVÉ]**.
- `obj_foreuse` (enfant du mobilier, sprite `spr_foreuse_socle`, masque `spr_foreuse_masqueCollision`) : à sa création, superpose `obj_foreuse_contours` et `obj_foreuse_faisceau` (rangés dans un dossier d'éditeur nommé « ne pas utiliser », car ils ne doivent pas être posés à la main). Obstacle indestructible : **l'objectif « Destroy the drills » n'est pas implémenté**. 3 instances, toutes dans rm_world2_2.
- `obj_robot_atelier1..3` : décor sans collision ; `obj_table_usine` : mobilier (rm_world4_1).
- `obj_energyWall` : mur d'énergie temporaire lié à un héros (ancienne capacité, `obj_bulletNPC`) ; placé nulle part, hors périmètre des niveaux.

---

## 8. Menus

### 8.1 Enchaînement des écrans

```
rm_mainMenu ──Play──▶ rm_choseHero ──(héros verrouillés, 3-2-1-GO)──▶ choix de la salle (même room)
     ▲                     │ Échap/B sans joueur inscrit                    │ (salle verrouillée, 3-2-1-GO)
     │◀────────────────────┘                                                ▼
     │                                                              salle de jeu (rm_world…)
     │◀── Exit (pause) ◀── Échap : obj_pauseMenu ◀─────────────────────────┤
     │◀── Exit ◀── « YOU LOSE » (obj_endGameMenu) ── Retry ──▶ même salle ◀┤
     │◀── Exit ◀── rm_score ◀── obj_endLevel (rm_world2 seulement) ◀───────┘
```

Principes communs (objects/obj_btn_parent, objects/obj_controller_parent) :
- Tous les boutons héritent de `obj_btn_parent` : variables `colonne`, `position` (ligne) et `spawnDelay` (apparition différée) ; un bouton non sélectionné est dessiné à 20 % d'opacité ; le bouton sélectionné reçoit un effet glitch ; survol souris = sélection, clic gauche = validation.
- Deux contrôleurs persistants sont posés dans rm_mainMenu : `obj_controller_keyboard` et `obj_controller_xbox`. Clavier en menu : haut/bas/gauche/droite = flèches ou Z/S/Q/D ; valider = E ou Entrée ; annuler = Échap. Navigation par colonnes (`scr_selectButtonWithController`) ou en grille (`scr_selectRoomButtonWithController` pour les salles).
- `obj_compte` (persistant, rm_mainMenu) : `global.playerPseudo = "John"` ; au démarrage du jeu applique `scr_setResolution()` et `scr_setVolume()`.

### 8.2 rm_mainMenu

Fond `spr_fondMenu_1` ; `obj_title` (logo `spr_title`, effet glitch) ; trois boutons en colonne 1 :
1. **Play** (`obj_btn_play`) → fondu vers `rm_choseHero`.
2. **Option** (`obj_btn_option`) → remplace le titre par une colonne 2 de trois boutons : **Video**, **Sound** (`obj_btn_audio`), **Controls**. Sélectionner l'un d'eux affiche son contenu en colonne 3 :
   - *Video* : sélecteur de résolution (`obj_btn_scrollResolution`, flèches précédent/suivant) parmi 1920×1080, 1600×900, 1400×1050, 1366×768, 1280×720, 1024×768, 800×480 ; « Fullscreen : ON/OFF » (`obj_btn_fullScreen`) ; **Apply** (`obj_btn_apply`) qui écrit `settings.ini` et appelle `scr_setResolution()`.
   - *Sound* : trois curseurs 0–100 (`obj_sliderBar_global` « Global », `obj_sliderBar_music` « Music », `obj_sliderBar_effects` « Effects »), à la souris ou gauche/droite ; la valeur est enregistrée dans `settings.ini` à la fermeture du panneau. **Ces volumes ne sont appliqués à aucun son** (aucun `audio_master_gain`/`audio_sound_gain` ne lit `global.globalVolume`, `musicVolume`, `effectVolume`) **[INACHEVÉ]**.
   - *Controls* : sélecteur « xbox » / « PS4 » / « Keyboard » (`obj_btn_scrollController`) qui affiche l'aide des commandes, **en lecture seule** (pas de reconfiguration) :
     - xbox (`obj_xbox_command`) : A = « Dash », B = « Cancel », X = « Use », RT = « 1st attack », LT = « 2nd attack », stick droit = « Aim », clic stick droit = « Link », stick gauche = « Move » ;
     - Keyboard (`obj_keyboard_command`) : « E : Use », « A : Link », « Space/Shift : Dash », « Left Click : 1st attack », « Right Click : 2nd attack », « WASD : Move » (les touches réellement codées sont **ZQSD**), « Mouse : Aim », « Echap : Cancel » ;
     - PS4 : rien n'est affiché **[INACHEVÉ]**.
   - Échap/B revient d'une colonne.
3. **Exit** (`obj_btn_exit`) → `game_end()`.

`scr_setResolution` : lit `settings.ini`, règle la taille de l'interface et de la fenêtre, redimensionne la surface de jeu à la hauteur min(1080, hauteur choisie) en 16:9, applique le plein écran, et définit `global.displayRatio = largeur d'interface / 1920` (échelle du HUD).

Boutons multijoueur `obj_btn_multi` (→ `rm_multi`), `obj_btn_host`, `obj_btn_join` (→ `rm_join`), `obj_btn_fastJoin`, `obj_btn_ok`, `obj_textbox_ip/port/pseudo` : placés dans aucune room et ciblant des rooms inexistantes **[DÉSACTIVÉ]**.

### 8.3 rm_choseHero : choix du héros puis de la salle

Fond `spr_fondMenu_2`. Quatre cadres `obj_btn_player` (`buttonNumber` 1 à 4, aux quatre coins : (480, 256), (1440, 256), (480, 736), (1440, 736)), un `obj_btn_go` au centre, un `obj_btn_back` invisible.

**Phase 1 — héros** (scripts/scr_playerButtonActions) :
- Cadre libre : texte « Press A/ENTER ». Un contrôleur sans numéro qui valide (A, E, Entrée, Start) prend le **premier cadre libre** (`scr_getActivePlayerButton`) ; il reçoit ce numéro de joueur et un héros **tiré au hasard** dans la liste.
- Gauche/droite : héros précédent/suivant. Valider : verrouille (« READY ! » en jaune, incliné à 45°). Annuler : déverrouille ; si non verrouillé, libère le cadre.
- Le cadre affiche la vignette `spr_selection<Héros>` (avec glitchs aléatoires) et le nom du héros.
- **Héros sélectionnables** (objects/obj_btn_player/Create_0.gml, dans cet ordre) : `obj_BatBot`, `obj_PetBot`, `obj_RoomCreator` (outil de développement, affiché « RoomCreator » sans vignette), `obj_BadaBot`, `obj_EngiBot`. `obj_NanoBot` et `obj_RamBot` existent comme objets mais ne sont pas dans la liste.
- `obj_btn_go` affiche « Waiting » (gris) tant qu'un cadre inscrit n'est pas verrouillé (ou qu'aucun n'est inscrit) ; quand tous les inscrits sont verrouillés : décompte « 3 », « 2 », « 1 », « GO ! » (rouge RVB 224, 67, 72 ; 0,3 s par étape ; à chaque étape le texte apparaît très agrandi puis rétrécit jusqu'à sa taille normale). Tout déverrouillage annule le décompte.
- Échap/B alors qu'aucun cadre n'est inscrit → retour à rm_mainMenu (via `obj_btn_back`).

**Phase 2 — salle** : à la fin du décompte, les cadres glissent hors de l'écran (1 s), puis `scr_btnGoCreateBtnRoom(4)` crée un bouton `obj_btn_room` par salle de `scr_getAllRoomWorldList` plus un bouton « random », 4 par ligne (soit ici 6 boutons : rm_world2, rm_world2_1, rm_world2_2, rm_world4 / rm_world4_1, random). Chaque bouton montre le sprite `spr_btn_room` et le **nom technique de la room** dessous ; jaune = survolé, rouge = verrouillé.
- Valider verrouille la salle (« random » tire une salle au hasard dans la liste) ; `obj_btn_go` (déplacé en bas de l'écran) refait le décompte 3-2-1-GO puis recopie le héros choisi dans chaque contrôleur et fait `room_goto` vers la salle.
- Annuler (ou clic droit) déverrouille la salle ; annuler sans salle verrouillée → retour à la phase 1 (les cadres reviennent).

L'ancien écran de sélection en réseau (`obj_btn_scrollHero`, `scr_createScrollButton`, `obj_btn_next/previous` pour le héros) n'est plus utilisé **[DÉSACTIVÉ]** ; `obj_btn_next/previous` servent encore aux sélecteurs de résolution et de manette.

### 8.4 Pause (scripts/scr_setPauseGame, objects/obj_pauseMenu)

- En jeu, la touche pause (Échap au clavier ; même touche que « annuler ») d'un contrôleur ayant un héros (ou du clavier) crée `obj_pauseMenu` ; une seconde pression, ou annuler, le ferme (protégé 5 steps contre la fermeture immédiate).
- Panneau centré sur la caméra, moitié de la vue, couleur RVB (4, 12, 41) à 90 % ; deux boutons : **Resume** (`obj_btn_resume`) et **Exit** (`obj_btn_exit` → retour au menu principal via `scr_exitLevel`).
- Tant qu'il existe : `global.gamePaused = true` (les steps des PNJ, de SallyBot, du PetDrone et une partie de celui des héros sont suspendus), les héros ne peuvent ni bouger ni viser (`scr_canMove`, `scr_aimHero`, `scr_detectKey`), la caméra est figée. Les balles en vol et les animations ne sont pas explicitement gelées **[INFÉRENCE]**.

### 8.5 HUD en jeu (pour mémoire)

`obj_healthBar` (persistant, une par héros ; l'image du sprite `spr_healthBar` = énergie courante ; avec vignette du héros et effet électrique), `obj_compteurMunition` (« courant/max » près de la barre et nombre de munitions dessiné près de l'arme ; clignote en rouge à 0), icônes de cartes (§5.4), texte de consigne (§6.1), compte à rebours de changement de salle (§4.1), lignes de debug de `obj_gui` (§6.3). Le détail des héros relève d'un autre document.

---

## 9. En bref

### 9.1 Lumière, ombres, brouillard

- **obj_lumiere** (sprite `spr_lumiere`) : lumière ponctuelle définie par `radius`, `hue`, `sat`, `lightIntensity` (code de création d'instance, sinon rayon = échelle × demi-largeur du sprite et teinte de l'instance). Dessinée en mélange additif avec le shader `sha_light` (dégradé radial du centre vers le bord du rayon).
- **Ombres** : polygones projetés depuis les arêtes des instances de `obj_mur_parent` et `obj_shadowMaker` (calcul statique, une fois, `scr_initializeLumiere`) et des portes (recalcul à chaque step, `scr_calculShadowForDoors`). Mobilier et personnages ne projettent pas d'ombre (lignes commentées).
- **obj_ambientShadow** : voile noir à 60 % (`shadowDensity = 0.6`) sur toute la vue quand au moins une lumière existe ; se détruit sinon.
- **Présence** : 11 lumières dans rm_world2 (seule salle jouable éclairée), 23 dans _rm_world1_3, rm_test_light. Les autres salles sont sans voile ni lumière.
- `obj_lumiere_tiles` (ombres depuis la tilemap) et `sha_blur` (flou) : utilisés nulle part **[DÉSACTIVÉ]**.
- **obj_warFog** (brouillard de guerre par pièces) : rectangles opaques gris foncé (`$313131`) recouvrant chaque pièce (taille = échelle de l'instance). Un brouillard devient `enabled` quand un héros se tient à portée d'une porte **complètement ouverte** qui touche ce rectangle ; il s'efface alors (`alpha −= apparitionSpeed`, 0,08 par step) puis se détruit. Chaînage : un brouillard dont `attachedWarFogNumber = N` s'active dès qu'un brouillard de `warFogNumber = N` est activé (pièces révélées ensemble). 34 / 38 / 27 / 59 instances dans rm_world2 / 2_1 / 4 / 4_1.
- **Pour le remake** : le brouillard par pièces est simple et structurant ; l'éclairage dynamique avec ombres portées est le poste le plus coûteux et n'existe que dans rm_world2.

### 9.2 Musique et sons

- **obj_musicController** (persistant, créé dans rm_mainMenu) : joue `snd_rm_world2` en boucle dans rm_world2 et rm_world2_1 uniquement ; silence ailleurs (menus compris). F12 coupe/rétablit la musique. `snd_music_room1` n'est lancé que par l'ancienne _rm_world1.
- **Effets** (41 sons dans sounds/) : tirs et capacités des héros (`snd_badaBot_*`, `snd_batBot_*`, `snd_engiBot_*`, `snd_petBot_*`), déploiement (`scr_deployHero`), impacts de batte (mur/humain/robot), tourelle, tir des soldats (`snd_pistolBot_fire1`), mort d'un PNJ (`snd_human_explosion`, objects/obj_localNpc/Destroy_0.gml), explosions.
- Aucun son pour les portes, boutons, cartes, menus, changement de salle.
- Audio positionnel : l'auditeur est la caméra, atténuation linéaire (objects/obj_camera).
- `scr_setVolume` charge les trois volumes depuis `settings.ini` mais ils ne sont appliqués nulle part (§8.2).

### 9.3 Réseau

- `obj_server` (serveur TCP, port 8000, 4 clients max), `obj_client`, `obj_player`, `scr_receivedPacket_client/server`, macros de messages (scripts/macros) existent toujours.
- Ils ne sont créés que par `obj_btn_host`, `obj_btn_join`, `obj_btn_fastJoin`, **placés dans aucune room**. **Le jeu de 2019 est purement local** : solo ou coop sur la même machine (1 clavier + manettes), **sans serveur local**. Les appels réseau dans la logique de jeu sont commentés ou sans effet (`scr_requestToEnterRoom`, `scr_pressButtonCheck`, Room Start de obj_localPlayer).
- Rien à porter pour un remake solo.

### 9.4 Sauvegarde

- `settings.ini` : sections `VIDEO SETTING` (`width`, `height`, `fullScreen`) et `AUDIO SETTING` (`Global`, `Music`, `Effects`).
- `savedData.ini` : section `roomAccess` (déblocage de salles), lue/écrite uniquement par du code désactivé (§1.1).
- **Aucune sauvegarde de progression** : ni score, ni salle atteinte, ni héros.

---

## 10. notes/notes.txt

Le fichier `notes/notes.txt` fait 9 octets : quatre sauts de ligne et un octet nul. **Il est vide de contenu.**

Le dossier contient aussi `compatibility_report_250417_1810181018.txt` (125 lignes) : rapport automatique de conversion GMS1 → GMS2 daté du 25/04/2017 (liste des fonctions converties, ex. `view_xview[...] -> __view_get(...)`), sans information de conception.

---

## Zones d'incertitude

1. **Sprites non extraits** : tailles, origines, nombre d'images et masques de collision inconnus. Conséquences : dimensions en pixels des zones mises à l'échelle (`obj_warFog`, `obj_textureGenerator_*`, `obj_endLevel`, téléporteurs) non calculables ici ; emprise réelle des murs fins, des portes (et la manière dont une porte ouverte laisse passer : cela dépend du masque de ses images), du mobilier.
2. **rm_world4** : son `.yy` a `creationCodeFile: ""` alors qu'un `RoomCreationCode.gml` correct existe dans le dossier. Si le fichier n'est réellement pas exécuté, la salle démarre sans initialisation ni murs. Il peut s'agir d'un accident de fusion ; à vérifier dans GameMaker ou dans une version voisine du dépôt.
3. **Ordre des rooms / room de démarrage** : déduit de l'arborescence `views/` ; le `.yyp` n'a pas de champ d'ordre. Deux fichiers `views/*.yy.orig` contiennent des marqueurs de conflit git (ignorés).
4. **`room_speed`** (images par seconde) non trouvé : toutes les durées exprimées en « steps » (fondus, vitesse d'effacement du brouillard, lissage caméra) dépendent de cette valeur.
5. **Période exacte des textures de sol** et rôle des colonnes de marge des tilesets (`cellsPerLine − 2`) : inférés du code, à confirmer sur les images.
6. **38 instances référencent un code de création dont le fichier est absent** (_rm_arena1 : 11, rm_world2 : 10, rm_arena1_3 : 7, rm_mainMenu : 3, rm_world2_1 : 2, une chacune dans rm_world2_2, rm_world4, rm_world4_1, _rm_arena1_1 et _rm_world1 ; dont une `obj_door` de rm_world4_1 et plusieurs PNJ) : considérées comme sans code, mais une valeur a pu être perdue.
7. **Ordre d'application propriété/code de création** : quand une instance a à la fois une propriété surchargée et un code de création pour la même variable (ex. _rm_arena1_1 : propriété `doorId = 4`, code `doorId=3`), j'ai supposé que le code de création l'emporte (ordre normal de GMS2). Cas limité aux anciennes arènes.
8. **Scénario du monde 2** : la suite prévue (zone de forage, foreuses à détruire, boss) n'est connue que par les 7 textes de consigne ; rien n'indique comment rm_world2_2 devait être reliée.
9. **Comportement pendant la pause** des balles, particules et alarmes : non vérifié objet par objet.
10. **Monde 3 et anciennes salles** : jugés abandonnés d'après leur préfixe `_`, leur absence du menu et l'incompatibilité avec `scr_room_world_ini` ; leur état de fonctionnement réel n'a pas été testé.
