# Éditeur de niveaux

L'éditeur permet de retoucher une salle directement dans le jeu, sans passer par le code. Il est décidé par ADR-018 et livré par étapes : ce document dit ce qu'il sait faire aujourd'hui et ce qui vient ensuite.

## Ouvrir

- Lancer le jeu (`npm run dev`), puis **Level editor** au menu principal, et choisir la salle.
- Ou directement `http://localhost:3000/?edit=rm_world2` (`rm_world2_1` pour l'étage, `rm_world2_2` pour la zone de forage).
- Le bouton n'apparaît que sur la machine qui fait tourner le serveur (`localhost`) : l'éditeur écrit sur le disque.

## Ce qui se retouche (étapes 1 et 2)

En haut à gauche, trois modes disent ce que la souris attrape : **Objects**, **Walls**, **Floors**. Un sol couvre toute une pièce : sans cette séparation, chaque clic sur la carte l'attraperait.

| Mode | Famille | Ce qu'on fait |
|---|---|---|
| Objects | Mobilier et décor (onglet Props) | Poser, déplacer, tourner, retirer ; échelle, miroir, teinte, opacité, « les balles passent au-dessus », hauteur d'ombre |
| Objects | Lumières (onglet Lights) | Lampe ou projecteur ; rayon, intensité, couleur, faisceau (direction et largeur) |
| Objects | Décalques au sol (onglet Decals) | Comme le mobilier |
| Objects | Portes, boutons, fenêtres (onglet Doors) | Poser, déplacer, tourner par quarts de tour, retirer ; numéro de porte, « reste ouverte » |
| Walls | Murs épais (64 px) et fins (32 px) | Glisser pour tracer un mur droit ; gomme en rectangle |
| Floors | Sols | Choisir une texture puis tracer un rectangle ; déplacer, redimensionner par les poignées, changer de texture, devant ou derrière |
| — | Personnages, brouillard, points d'apparition | Affichés (cadenas dans la liste « Show »), pas encore retouchables |

La palette propose tous les types d'objets et de décalques déjà présents dans une salle du jeu, et toutes les textures de sol extraites. Un objet posé reprend la couche, l'échelle et les réglages d'un objet existant du même type.

**Murs.** On ne choisit pas les pièces : droit, bout, angle, T, croix ou plot se déduisent des cases voisines, par une règle relevée sur les salles d'origine (elle y redonne 98 % des pièces). Seules les cases touchées et leurs voisines sont redessinées ; le reste de la salle garde ses pièces. Les rectangles de collision sont refaits à partir des cases, comme le fait le convertisseur : un mur épais bloque 64 × 64 px, un mur fin 32 × 32 px.

**Portes et fenêtres.** En poser une retire du même geste les pièces de mur qu'elle recouvre (un seul Ctrl + Z annule les deux). La déplacer ensuite ne répare pas le mur : le refermer avec l'outil mur. Une porte à bouton (`door`) reçoit un numéro libre ; le bouton (`button`) posé ensuite prend ce numéro et l'ouvrira. Les portes à carte s'ouvrent avec la carte de leur couleur.

**Sols.** Le sol posé en dernier recouvre les autres ; « To back » le glisse dessous. « Pattern X / Y » décale le motif, pour le raccorder à celui d'un sol voisin.

## Commandes

| Geste | Effet |
|---|---|
| Clic | Sélectionne ; un second clic au même endroit passe à l'élément du dessous |
| Maj + clic, ou glisser dans le vide | Ajoute à la sélection, ou sélectionne dans un rectangle |
| Glisser un élément | Déplace la sélection, calée sur la grille (Alt : libre) |
| R, Maj + R | Tourne de 15° (avec Alt : 1°), une porte ou une fenêtre de 90° ; un groupe tourne autour de son centre |
| Poignée ronde | Tourne l'élément à la souris |
| Poignées carrées (sol) | Redimensionnent le rectangle, côté par côté ou par un coin |
| Flèches | Décalent la sélection d'un pixel (Maj : dix) |
| F, B (boutons « To front », « To back ») | Passe la sélection devant ou derrière ce qu'elle chevauche |
| Suppr | Retire la sélection |
| Ctrl + D | Duplique |
| Ctrl + Z, Ctrl + Maj + Z | Annule, rétablit |
| ZQSD / WASD, glisser au clic droit | Déplace la vue (Maj : vite) |
| Molette, 0, 1 | Zoom autour du curseur, carte entière, échelle du jeu |
| G | Active ou coupe l'aimantation à la grille |
| L | Aperçu de l'éclairage |
| Échap | Lâche l'outil de pose, puis la sélection, puis propose de quitter |
| Ctrl + S | Sauvegarde |

**Devant, derrière (GD-095).** Quand deux éléments de la même famille se chevauchent, celui qui vient en dernier dans la salle est dessiné par-dessus : un objet que l'on pose arrive donc devant. « To back » le glisse dessous (une chaise sous sa table), « To front » le remet dessus. Le jeu dessine exactement cet ordre, chaises à roulettes comprises. Les décalques restent toujours sous le mobilier.

**Aperçu de l'éclairage.** Il montre la pénombre du jeu et la zone éclairée de chaque lampe, avec les ombres des murs, des portes fermées et du mobilier, calculées comme en jeu. Il manque la lueur que chaque robot porte sur lui : une pièce paraît donc un peu plus sombre qu'en partie.

## Sauvegarder

- **Save** réécrit `public/levels/<salle>.json` et reste dans l'éditeur. **Save & exit** revient au menu : la partie suivante charge la nouvelle version, sans recharger la page.
- **La sauvegarde ne fait pas de commit** (ADR-019) : la carte retouchée est un fichier modifié, comme n'importe quel travail en cours. Tu décides avec l'agent du moment où elle entre dans Git.
- Le fichier garde une ligne par élément : un `git diff` ne montre que les éléments touchés.

### Commiter, annuler, revenir en arrière

Le plus simple est de le demander à l'agent (« commite la carte », « annule mes retouches de l'étage »). À la main :

```
git status --short public/levels                            # les cartes retouchées, pas encore commitées
git commit -m "Carte rm_world2 : ..." -- public/levels/rm_world2.json
git checkout -- public/levels/rm_world2.json                # jeter les retouches non commitées de cette carte
git log --oneline -- public/levels/rm_world2.json           # les versions commitées de la carte
git checkout <commit> -- public/levels/rm_world2.json       # reprendre l'une d'elles (puis la commiter)
```

Après un retour en arrière, rouvrir l'éditeur ou relancer une partie : la salle est relue sur le disque.

## Limites à connaître

- **Repères du scénario.** La marque de l'ultimatum, la ligne de police, les fourgons, la zone d'extraction et les plans de caméra sont des coordonnées dans `src/sim/landmarks.ts`. Si le pupitre, un mur ou les portes du local technique bougent, ces repères ne suivent pas : le signaler pour qu'ils soient corrigés dans le code, en attendant l'étape 3.
- **Tests.** Des tests vérifient le niveau TvTv² (présentateur derrière son pupitre, passages libres, nombre de lampes). Une retouche qui déplace ces éléments peut les faire échouer : `npm test` le dit, et le test est alors à mettre à jour avec la carte.
- **Partie à plusieurs.** Le serveur prend la salle sauvegardée pour la partie suivante ; les autres joueurs doivent recharger la page pour la voir.
- **`npm run convert-rooms`** ne réécrit plus une salle retouchée, sauf avec `--force` (qui efface les retouches).

## La suite

1. **Étape 3** : personnages et leurs patrouilles, zones de brouillard, points d'apparition, repères du scénario déplaçables.
2. Plus tard : créer une salle vide, essayer la salle depuis l'éditeur.

## Dans le code

| Fichier | Rôle |
|---|---|
| `src/client/scenes/EditorScene.ts` | Affichage de la salle, souris, clavier, aperçu de l'éclairage, sauvegarde |
| `src/client/editor/model.ts` | Éléments de la salle, familles, historique (annuler, rétablir), palette ; sans Phaser, testé par `model.test.ts` |
| `src/client/editor/walls.ts` | Murs : pièce de chaque case d'après ses voisines, coup de pinceau et de gomme, rectangles de collision ; testé par `walls.test.ts` |
| `src/client/editor/EditorUi.ts` | Panneaux HTML : barre d'outils, modes, palette, couches, réglages |
| `src/client/scenes/EditorSelectScene.ts` | Choix de la salle (`MAPS` de `src/sim/session.ts`) |
| `server/levels.ts` | `PUT /api/levels/<salle>` : contrôle et écriture du fichier, sans commit ; testé par `levels.test.ts` |
| `src/sim/levelFile.ts` | Mise en forme et contrôle d'un fichier de niveau, partagés avec `convert-rooms` |

Depuis la console du navigateur, `sfpeEditor` donne la scène de l'éditeur (`sfpeEditor.model.ents`, `sfpeEditor.model.toLevel()`).
