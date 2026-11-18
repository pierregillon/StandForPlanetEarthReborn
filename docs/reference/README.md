# Références : le jeu d'origine et ses sources

Dernière mise à jour : 2026-11-15.

## 1. Le code d'origine

| | |
|---|---|
| Dépôt GitHub | `https://github.com/Leuyck/Stand-For-Planet-Earth` (dépôt d'un autre contributeur : lecture seule, ne jamais y pousser) |
| Copie locale | À côté de ce dépôt, `../Stand-For-Planet-Earth`, ou au chemin donné par la variable `SFPE_REFERENCE_REPO` (lu par `convert-rooms` et `extract-assets`). Sur la machine Windows : `C:\Users\gillo\Code\Stand-For-Planet-Earth`. Une copie neuve n'a pas l'étiquette ci-dessous : la recréer sur le commit de référence |
| **Commit de référence** | **`d438c5482ca1419af8ad39faae5326b9b2667d88`** (branche `develop` distante, 17 janvier 2019) |
| Étiquette locale | `remake-reference-2019` (créée le 2026-11-15 pour retrouver ce commit et empêcher git de le purger) |
| Format | GameMaker Studio 2, dans le sous-dossier `Stand-For-Planet-Earth/` du commit |

**Pièges.**

- Le dossier de travail de la copie locale est sur une version de **février 2017** (format GameMaker Studio 1, dossier `Stand-For-Planet-Earth.gmx`). Ce n'est **pas** la référence. Ne pas changer de branche dans cette copie : lire le commit de référence sans y toucher.
- Les branches locales `origin/*` de cette copie datent de mars 2017. Le commit de 2019 est présent dans `.git` mais seulement via l'étiquette ci-dessus.
- `git fetch`, même avec `--dry-run`, télécharge réellement les objets (plusieurs centaines de Mo). Connexion limitée : ne pas le lancer sans l'accord de l'utilisateur.
- Les trois analyses de `jeu-original/` ont été écrites à partir d'une extraction partielle (sans `sprites/`, `tilesets/`, `options/`). Elles citent des chemins relatifs à la racine du projet GameMaker.

### Lire ou extraire le code de référence

Depuis la copie locale du dépôt d'origine, sans rien modifier :

```bash
# Lister un dossier
git ls-tree --name-only remake-reference-2019 Stand-For-Planet-Earth/objects/

# Lire un fichier
git show remake-reference-2019:Stand-For-Planet-Earth/objects/obj_localPlayer/Create_0.gml

# Extraire des dossiers vers un répertoire temporaire (aucun téléchargement)
git archive remake-reference-2019 Stand-For-Planet-Earth/objects Stand-For-Planet-Earth/scripts Stand-For-Planet-Earth/rooms | tar -x -C <dossier-temporaire>
```

Contenu du projet à ce commit : `objects/` (282 objets), `scripts/` (259 scripts, environ 14 600 lignes de GML avec les objets), `rooms/` (24 salles), `sprites/` (407 sprites, 159 Mo), `sounds/` (40 sons, 20 Mo), `tilesets/`, `fonts/`, `shaders/`, `options/`, `views/` (arborescence des ressources), `Stand-For-Planet-Earth.yyp` (index du projet).

Structure GameMaker Studio 2 : `objects/<nom>/<nom>.yy` (JSON : parent, sprite, événements, variables par défaut) et un fichier `.gml` par événement (`Create_0.gml`, `Step_0.gml`, `Alarm_N.gml`, `Collision_<guid>.gml`…) ; `scripts/<nom>/<nom>.gml` ; `rooms/<nom>/<nom>.yy` ; `sprites/<nom>/<nom>.yy` et ses images PNG.

**Vitesse du jeu : 60 images par seconde** (`option_game_speed` dans `options/main/inherited/options_main.inherited.yy`). Les durées du code, écrites en « steps », se convertissent sur cette base. Les analyses la donnent comme « supposée » : elle est confirmée.

## 2. Les analyses du code — `jeu-original/`

Spécifications extraites du commit de référence le 2026-11-15, avec les valeurs chiffrées et le fichier d'origine de chaque fait.

| Fichier | Contenu |
|---|---|
| [01-heros-et-joueur.md](jeu-original/01-heros-et-joueur.md) | Héros, tirs, déplacement, dash, commandes, munitions, énergie, link, mort, bonus, caméra, HUD |
| [02-ennemis-et-ia.md](jeu-original/02-ennemis-et-ia.md) | Soldats, civils, projectiles, IA, recherche de chemin, boss, score, ennemis par salle |
| [03-niveaux-et-interface.md](jeu-original/03-niveaux-et-interface.md) | Inventaire des salles, format des fichiers de salles, portes, cartes, consignes, murs et sols, menus, lumière, sons |

**À savoir avant de s'y fier.**

- Ce sont des analyses produites par lecture du code, pas des vérités vérifiées en jouant. Quelques points clés ont été recontrôlés (12 PV, énergie de 0 à 12 avec maximum naturel de 3, mort désactivée, textes des consignes, zone de fin de niveau, vitesse du jeu). **Avant d'implémenter une mécanique, relire le fichier GML cité.**
- Elles décrivent le jeu d'origine. Quand elles contredisent une décision de `docs/decisions/`, c'est la décision qui l'emporte.
- Chaque document se termine par ses zones d'incertitude. La principale : les sprites n'avaient pas été extraits, donc tailles, origines, masques de collision et nombres d'images sont à mesurer sur les fichiers `sprites/*/*.yy`.

## 3. Les documents de conception d'époque — `documents-origine/`

| Fichier | Contenu |
|---|---|
| [game-design-document.pdf](documents-origine/game-design-document.pdf) | Gameplay, link, bonus, IA, synopsis, personnages, commandes |
| [scenario.pdf](documents-origine/scenario.pdf) | Histoire : SFPE, puis SFHB ; premières missions. **Remplacé** le 2026-11-17 par [l'arc narratif de l'utilisateur](../narration/arc-narratif.md) (GD-076) ; gardé comme trace historique |
| [cahier-des-charges-graphismes.pdf](documents-origine/cahier-des-charges-graphismes.pdf) | Personnages, animations attendues, ennemis, décors |

Ils décrivent une vision plus large et parfois différente du code (7 héros, fusion d'ennemis, bornes d'arcade…). Ils servent à combler un manque, pas à contredire le code (voir GD-001). Pour en extraire le texte : `pdftotext -enc UTF-8 -layout <fichier.pdf> <sortie.txt>` (l'outil de lecture de PDF intégré ne fonctionne pas sur cette machine).

## 4. Les assets

| Source | Emplacement | Usage |
|---|---|---|
| Projet GameMaker de 2019 | `sprites/`, `sounds/`, `tilesets/`, `fonts/` du commit de référence | **Source principale** : images à la bonne taille, avec origines et masques dans les `.yy` |
| Dossier `Resources` | `Resources/` de la copie locale (1,3 Go, hors git : présent seulement sur la machine Windows) | Complément : sources PNG et PSD, variantes, musiques WAV (« forage », « usine »), polices |

Ne copier dans ce dépôt que ce qui est utilisé. Sprites manquants : régénération autorisée, fidèle au style d'origine (voir ADR-007).
