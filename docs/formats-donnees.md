# Formats des données extraites du jeu d'origine

Les niveaux et les assets du remake sont **générés** à partir du projet GameMaker de référence (étiquette `remake-reference-2019`) par deux outils. Ce document décrit leurs sorties. La description du format d'origine est dans `docs/reference/jeu-original/03-niveaux-et-interface.md` (§2 et §7).

## Relancer les outils

```
npm run convert-rooms     # public/levels/<salle>.json
npm run extract-assets    # public/assets/ (sprites, sols, sons, manifestes) ; -- --verbose pour le détail
```

- Il faut Node 22 (`.tools/node22`), aucun paquet npm : les outils n'utilisent que les modules intégrés.
- Réglages dans `tools/assets.config.json` :
  - `rooms` : salles à convertir (elles déterminent aussi les sprites et les sols extraits) ;
  - `excludeSprites`, `includeSprites`, `excludeSounds` : expressions régulières insensibles à la casse, testées sur le nom. `includeSprites` l'emporte sur `excludeSprites`.
- La référence est lue dans `.cache/reference/` (ignoré par git). Si ce dossier manque, il est recréé par `git archive` depuis le dépôt d'origine (`../Stand-For-Planet-Earth`, ou le chemin donné par la variable `SFPE_REFERENCE_REPO`), qui n'est jamais modifié.
- Les outils sont déterministes et relançables : ils ne réécrivent que les fichiers qui changent et suppriment leurs sorties devenues inutiles. **Relancer `convert-rooms` écrase les retouches faites à la main dans `public/levels/`** : une correction durable se fait dans l'outil, ou se note dans `docs/decisions/game-design.md`.
- Chaque outil affiche un résumé ; `convert-rooms` compare ses comptes au tableau §1.3 de l'analyse et signale tout écart.

## Conventions communes

- **Repère** : pixels, origine en haut à gauche, y vers le bas.
- **Angles** : degrés GameMaker, **sens antihoraire**, recopiés tels quels. En Phaser : `angle = -angle`.
- **Position** d'une instance, d'un mur ou d'un décalque : celle de l'**origine** de son sprite (`ox`, `oy` dans `sprites.json`), pas de son coin.
- **Échelles** : `scaleX`, `scaleY` ; une valeur négative est un miroir.
- **Couleur** : `tint` = `#rrggbb` (teinte multiplicative, `#ffffff` = aucune), `alpha` de 0 à 1.
- **Profondeur** (`depth`) : celle de la couche d'origine ; plus petit = dessiné au-dessus.

## Niveaux : `public/levels/<salle>.json`

```jsonc
{
  "name": "rm_world2", "width": 13000, "height": 8000,
  "background": { "sprite": "spr_texture_gris_full", "color": "#ffffff", "tiled": true },
  "layers": [ { "name": "layer_doors", "type": "instances", "depth": -500, "visible": true } ],
  "objects": { "obj_door": { "sprite": "spr_door", "mask": null, "parents": ["obj_door_parent", "obj_decor_base"], "visible": true } },
  "instances": [ { "id": "inst_C4C71A4", "object": "obj_door", "layer": "layer_doors", "depth": -500,
                   "x": 3872.278, "y": 4735.864, "angle": 90, "scaleX": 1, "scaleY": 1,
                   "tint": "#ffffff", "alpha": 1, "props": { "doorId": 1, "blockedOpen": true } } ],
  "walls": [ { "object": "obj_mur_epais_T", "thick": true, "x": 1312, "y": 1376, "angle": 270, "scaleX": 1 } ],
  "wallRects": [ [0, 1344, 9920, 64, 1] ],
  "floors": [ { "object": "obj_textureGenerator_cafet", "tileset": "til_sol_cafet", "x": 2272, "y": 2864,
                "w": 592, "h": 1056, "checkBottomTile": false, "phaseX": 0, "phaseY": 208 } ],
  "decals": [ { "sprite": "spr_tapis", "x": 4543.747, "y": 6080.215, "angle": -0.8223435, "scaleX": 1.138829,
                "scaleY": 1.208469, "tint": "#6dff65", "alpha": 1, "frame": 0, "depth": 600 } ]
}
```

| Clé | Contenu |
|---|---|
| `background` | Fond de la salle. `sprite` = `null` pour une couleur unie (`color`). Avec un sprite, `color` est sa teinte et `tiled` indique qu'il est répété dans les deux sens depuis (0, 0). |
| `layers` | Couches d'origine, de la plus proche à la plus lointaine : `type` = `instances`, `tiles`, `assets` ou `background`. `visible` est le réglage de l'éditeur ; le jeu peut le changer (`obj_warFog` rend sa couche visible à sa création). |
| `objects` | Un par type d'objet présent dans `instances` ou `walls`, trié par nom. `sprite` et `mask` (masque de collision, `null` = celui du sprite) sont hérités du parent le plus proche si l'objet n'en a pas ; `parents` va du plus proche au plus lointain ; `visible` est le réglage de l'objet. |
| `instances` | Toutes les instances non `ignore`, dans l'ordre de création d'origine, sauf les `obj_textureGenerator_*` (voir `floors`). `id` = nom de l'instance dans l'éditeur. |
| `walls` | Une pièce de mur par case de tuile non vide des couches `tiles_mur_epais` (cases de 64 px) et `tiles_mur_fin` (32 px) ; `x`, `y` = centre de la case. Sert au rendu. |
| `wallRects` | Rectangles de collision des murs, fusionnés : `[x, y, largeur, hauteur, épais]`, `épais` = 1 pour un mur épais, 0 pour un mur fin. Un rectangle épais n'est jamais fusionné avec un rectangle fin. Les rectangles épais viennent d'abord. |
| `floors` | Un sol par générateur, dans l'ordre de création (= ordre de dessin en cas de recouvrement). Voir « Sols ». |
| `decals` | Sprites décoratifs de la couche d'assets, sans objet ni collision. `frame` = image de départ ; un sprite à plusieurs images s'anime à sa vitesse (`spr_ventilation`). |

### `props`

Variables de l'instance, fusionnées dans cet ordre (le dernier gagne) : valeurs par défaut de l'objet et de ses parents, surcharges des objets enfants, surcharges de l'instance, puis affectations simples `nom = valeur` de son code de création.

- nombres → nombres ; `True`/`False` → booléens ; `noone` → `null` ;
- noms de ressources (`"rm_world2_1"`, `"obj_bullet_pistol"`, `"spr_PetBot_jambes2"`) et expressions GML (`"10*room_speed"`, `"2*normalSpd"`) → chaînes, à interpréter par le jeu ;
- liste `ds_list_add` → tableau : `"patrolPoints": ["5486;5612", "5060;5721", "5151;5277"]` (chaque point est `"x;y"`).

Ce que l'événement Create de l'objet calcule n'y figure pas. Les instances dont le code de création est référencé mais absent du projet d'origine sont traitées comme sans code (l'outil les liste).

### Murs

`walls` suit les tables de `scr_createMurEpaisInstanceFromTileCell` et `scr_createMurFinInstanceFromTileCell` (indice de tuile → objet, angle, miroir `scaleX`). Chaque rectangle de `wallRects` est la boîte englobante du sprite de la pièce (`bbox`, relative à l'origine, tournée et mise à l'échelle) ; les rectangles jointifs de même hauteur sont réunis sur une ligne, puis ceux de même largeur sont empilés. Dans les salles converties, toutes les pièces ont un masque rectangulaire couvrant leur case entière : un mur épais bloque 64×64 px, un mur fin 32×32 px.

### Sols

Chaque entrée est le rectangle réellement couvert par un `obj_textureGenerator_*` (arrondi à la case comme `obj_textureGenerator_parent`, avec l'arrondi au pair de `round()`), rempli par la texture répétée de `floors.json` :

```
pixel du sol en (X, Y)  =  image[ (X - x + phaseX) mod periodW , (Y - y + phaseY) mod periodH ]
```

Avec un `TileSprite` Phaser d'origine (0, 0) placé en (`x`, `y`) et de taille `w`×`h` : `tilePositionX = phaseX`, `tilePositionY = phaseY`.

`phaseX`/`phaseY` reproduisent le raccord du jeu d'origine : un générateur prolonge le motif du générateur **du même objet**, déjà initialisé, situé juste au-dessus de lui (juste en dessous si `checkBottomTile`) ; sinon son motif démarre à son coin haut-gauche (phase 0). L'outil simule les scripts d'origine tuile par tuile et vérifie que « texture répétée + phase » redonne exactement le même résultat.

Tous les sols sont au-dessus du fond et sous tout le reste (profondeur d'origine : celle de la couche la plus lointaine, moins 1).

## Sprites : `public/assets/sprites.json` et `public/assets/sprites/<nom>/<index>.png`

```json
{ "spr_automaticDoor": { "w": 256, "h": 32, "ox": 128, "oy": 16, "frames": 12, "bbox": [0, 0, 255, 31], "bboxmode": 0, "colkind": 0, "sepmasks": true, "speed": 1, "speedType": 1 } }
```

- Une image par fichier, `0.png` à `<frames - 1>.png`, dans l'ordre de l'animation ; toutes font `w`×`h`.
- `ox`, `oy` : origine. `bbox` : `[gauche, haut, droite, bas]` en pixels de l'image, **bornes incluses** (largeur = droite − gauche + 1).
- `bboxmode` : 0 automatique, 1 image entière, 2 manuelle.
- `colkind` (forme du masque dans `bbox`) : 0 précis (pixels opaques), 1 rectangle, 2 ellipse, 3 losange. `sepmasks` : avec un masque précis, un masque par image (portes : l'image ouverte ne bloque plus le passage).
- `speed`, `speedType` : vitesse d'animation ; `speedType` 0 = images par seconde, 1 = images par image de jeu. Le code d'origine remplace souvent cette vitesse (`image_speed`).
- Sprites retenus : ceux des salles converties (objets et leurs parents, masques, murs, décalques, fond) ; ceux référencés par un objet (sprite, masque, valeur de variable) ; ceux cités dans le GML de `objects/`, `scripts/` et des salles converties, y compris les noms construits à l'exécution (`"spr_cadre_" + …`) ; moins `excludeSprites`, plus `includeSprites`.
- Les images sont copiées telles quelles, sauf les blocs PNG de profil de couleur (gAMA, cHRM, iCCP, sRGB), retirés pour que le navigateur affiche les valeurs brutes comme GameMaker.

## Sols : `public/assets/floors.json` et `public/assets/floors/<tileset>.png`

```json
{ "til_sol_cafet": { "image": "floors/til_sol_cafet.png", "srcX": 0, "srcY": 0, "periodW": 512, "periodH": 256, "cellSize": 16 } }
```

Le rectangle (`srcX`, `srcY`, `periodW`, `periodH`) de l'image, répété, reproduit le motif. L'outil découpe l'image du tileset pour qu'elle soit **exactement une période** (`srcX` = `srcY` = 0, taille de l'image = période) : elle s'utilise directement comme texture répétée. La première colonne de tuiles de l'image d'origine (transparente, car la tuile 0 est « vide » pour GameMaker) est retirée. `cellSize` est la taille d'une tuile d'origine (les phases en sont des multiples). Seuls les tilesets utilisés par les salles converties sont extraits.

## Sons : `public/assets/sounds.json` et `public/assets/sounds/<nom>.<ext>`

```json
{ "snd_petBot_fire1": { "file": "sounds/snd_petBot_fire1.wav", "bytes": 344664 } }
```

Tous les sons déclarés dans le projet d'origine, moins `excludeSounds`. L'extension (`wav`, `ogg`, `mp3`) est déduite du contenu du fichier. Les chemins `image` et `file` des manifestes sont relatifs à `public/assets/`.
