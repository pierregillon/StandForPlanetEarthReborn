# Éditeur de niveaux

L'éditeur permet de retoucher une salle directement dans le jeu, sans passer par le code. Il est décidé par ADR-018 et livré par étapes : ce document dit ce qu'il sait faire aujourd'hui et ce qui vient ensuite.

## Ouvrir

- Lancer le jeu (`npm run dev`), puis **Level editor** au menu principal, et choisir la salle.
- Ou directement `http://localhost:3000/?edit=rm_world2` (`rm_world2_1` pour l'étage, `rm_world2_2` pour la zone de forage).
- Le bouton n'apparaît que sur la machine qui fait tourner le serveur (`localhost`) : l'éditeur écrit sur le disque.

## Ce qui se retouche

En haut à gauche, les modes disent ce que la souris attrape : **Objects**, **Walls**, **Floors**, **Zones**, **Script**. Un sol ou une zone couvre toute une pièce : sans cette séparation, chaque clic sur la carte l'attraperait.

| Mode | Famille | Ce qu'on fait |
|---|---|---|
| Objects | Mobilier et décor (onglet Props) | Poser, déplacer, tourner, retirer ; échelle, miroir, teinte, opacité, « les balles passent au-dessus », hauteur d'ombre |
| Objects | Lumières (onglet Lights) | Lampe ou projecteur ; rayon, intensité, couleur, faisceau (direction et largeur) |
| Objects | Décalques au sol (onglet Decals) | Comme le mobilier |
| Objects | Portes, boutons, fenêtres (onglet Doors) | Poser, déplacer, tourner par quarts de tour, retirer ; numéro de porte, « reste ouverte » |
| Objects | Personnages (onglet People) | Poser, déplacer, tourner, retirer ; patrouille : aucune, au hasard, ou de point en point |
| Objects | Points d'apparition, cartes, bornes, escaliers (onglet Markers) | Poser, déplacer, retirer |
| Walls | Murs épais (64 px) et fins (32 px) | Glisser pour tracer un mur droit ; gomme en rectangle |
| Floors | Sols | Choisir une texture puis tracer un rectangle ; déplacer, redimensionner par les poignées, changer de texture, devant ou derrière |
| Zones | Brouillard, zone de sortie du niveau | Tracer une zone de brouillard ; déplacer, redimensionner, numéroter |
| Script | Repères du scénario (rez-de-chaussée seulement) | Déplacer ; redimensionner les rectangles ; tourner fourgons et caméras |

La palette propose tous les types d'objets et de décalques déjà présents dans une salle du jeu, et toutes les textures de sol extraites. Un objet posé reprend la couche, l'échelle et les réglages d'un objet existant du même type.

**Murs.** On ne choisit pas les pièces : droit, bout, angle, T, croix ou plot se déduisent des cases voisines, par une règle relevée sur les salles d'origine (elle y redonne 98 % des pièces). Seules les cases touchées et leurs voisines sont redessinées ; le reste de la salle garde ses pièces. Les rectangles de collision sont refaits à partir des cases, comme le fait le convertisseur : un mur épais bloque 64 × 64 px, un mur fin 32 × 32 px.

**Portes et fenêtres.** En poser une retire du même geste les pièces de mur qu'elle recouvre (un seul Ctrl + Z annule les deux). La déplacer ensuite ne répare pas le mur : le refermer avec l'outil mur. Une porte à bouton (`door`) reçoit un numéro libre ; le bouton (`button`) posé ensuite prend ce numéro et l'ouvrira. Les portes à carte s'ouvrent avec la carte de leur couleur.

**Sols.** Le sol posé en dernier recouvre les autres ; « To back » le glisse dessous. « Pattern X / Y » décale le motif, pour le raccorder à celui d'un sol voisin.

**Personnages.** Les caractéristiques d'un type de personnage (vie, vitesse, arme) sont dans `src/sim/config.ts`, pas dans la carte : l'éditeur règle sa place, son orientation et sa patrouille. « Add points… » puis des clics sur la carte tracent une ronde, dans l'ordre de marche ; le personnage va de sa place au dernier point, puis revient. Chaque point se déplace par son rond ; déplacer le personnage déplace sa ronde avec lui.

**Brouillard.** Une zone cache ce qu'elle recouvre jusqu'à ce qu'un robot y entre. « Zone n° » lui donne un numéro ; une zone dont « Lifts with n° » porte ce numéro se lève en même temps qu'elle (une pièce et son recoin). La couche est masquée d'ordinaire et s'affiche en mode Zones.

**Repères du scénario (ADR-020).** Ce sont les endroits que le code de l'histoire vise : marque de l'ultimatum, ligne de police et fourgons, portes qui déclenchent le face-à-face, zone d'extraction, plans des cinématiques. Ils se déplacent quand le décor autour d'eux bouge ; on ne peut ni en ajouter ni en retirer. Un rectangle s'attrape par son bord. Tant qu'aucun n'a bougé, rien n'est écrit dans le fichier ; ensuite la salle porte ses repères (clé `landmarks`).

**« All settings ».** Sous les réglages d'un objet, cette section liste tout ce que le fichier contient pour lui (salle visée par un escalier, portée d'une porte…), modifiable en texte. C'est un filet de sécurité pour ce que le panneau ne propose pas.

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

- **Repères du scénario.** Ils ne suivent pas le décor tout seuls : si le pupitre, un mur ou les portes du local technique bougent, les déplacer aussi (mode Script). Le pupitre et le présentateur sont des objets ordinaires ; leur repère (« anchor's place », « desk ») sert aux tests et aux cinématiques.
- **Tests.** Des tests vérifient le niveau TvTv² (présentateur derrière son pupitre, passages libres, nombre de lampes). Une retouche qui déplace ces éléments peut les faire échouer : `npm test` le dit, et le test est alors à mettre à jour avec la carte.
- **Partie à plusieurs.** Le serveur prend la salle sauvegardée pour la partie suivante ; les autres joueurs doivent recharger la page pour la voir.
- **`npm run convert-rooms`** ne réécrit plus une salle retouchée, sauf avec `--force` (qui efface les retouches).

- **Bornes de recharge et cartes d'accès : pas le même dessin qu'en jeu.** Le jeu les dessine par le code (elles n'ont pas de sprite), alors que l'éditeur montre le sprite de l'objet d'origine qu'elles remplacent. Pour les bornes, l'écart va plus loin : chaque « recharge outlet spot » est un emplacement possible, et le jeu n'en garde que 4 au rez-de-chaussée et 2 à l'étage, les plus éloignés les uns des autres (`CONFIG.outlet.keepPerRoom`). Les « bonus box » ne sont plus dans le jeu (GD-027).

## La suite

Les trois étapes prévues sont livrées. Restent, non planifiés : créer une salle vide depuis l'éditeur, essayer la salle sans repasser par le menu, modifier les blocs de mur posés en instances (rares).

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
| `src/sim/landmarks.ts` | Repères du scénario : valeurs par défaut, lecture de ceux de la salle (`useLandmarks`), mise à plat pour l'éditeur |

Depuis la console du navigateur, `sfpeEditor` donne la scène de l'éditeur (`sfpeEditor.model.ents`, `sfpeEditor.model.toLevel()`).
