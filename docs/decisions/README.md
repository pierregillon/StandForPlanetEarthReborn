# Journaux de décisions

Deux journaux, pour retrouver **ce qui a été décidé et pourquoi** :

| Journal | Contenu | Identifiants |
|---|---|---|
| [game-design.md](game-design.md) | Règles du jeu, gameplay, équilibrage, niveaux, interface, tout écart avec le jeu d'origine | `GD-001`, `GD-002`… |
| [architecture.md](architecture.md) | Technologies, structure du code, outils, formats de données | `ADR-001`, `ADR-002`… |

## Quand ajouter une entrée

Dès qu'un choix n'est pas dicté mécaniquement par le code d'origine. En particulier :

- on **s'écarte** du jeu d'origine (règle changée, ajoutée, retirée) ;
- on **invente** quelque chose que le code n'a pas (une valeur, une animation, une règle) ;
- on **tranche** entre le code et les documents d'époque, ou entre deux lectures possibles du code ;
- on **corrige un bogue** du jeu d'origine d'une façon qui change ce que le joueur vit ;
- on **modifie une valeur d'équilibrage** de façon notable ;
- l'utilisateur **demande** un changement de gameplay ;
- on fait un choix technique qui serait coûteux à défaire.

Un simple détail d'implémentation sans effet sur le jeu ni sur l'architecture n'a pas besoin d'entrée.

## Règles

- **On n'efface pas une décision.** Si elle change, on ajoute une nouvelle entrée et on passe l'ancienne à « Remplacée par GD-0xx ».
- L'entrée est écrite **dans le même commit** que le changement qu'elle décrit.
- Les numéros se suivent, sans réutilisation. Les nouvelles entrées vont à la fin, et dans le tableau d'index en tête de fichier.
- Rédaction en français, phrases complètes, lisible sans avoir suivi la discussion.

## Modèle d'entrée

```markdown
## GD-0xx — Titre court qui énonce la décision

- **Date** : AAAA-MM-JJ
- **Statut** : Acceptée | Proposée (à valider par l'utilisateur) | Remplacée par GD-0yy
- **Décidée par** : l'utilisateur | Claude (choix par défaut, à signaler à l'utilisateur)

**Contexte.** Ce que fait le jeu d'origine, ce que disent les documents, le problème à résoudre.

**Décision.** Ce que l'on fait, précisément.

**Pourquoi.** La raison, et les options écartées avec ce qui les a fait écarter.

**Conséquences.** Ce que ça entraîne ailleurs, ce qui reste à faire, ce qu'il faudra revoir plus tard.
```

« Décidée par » compte : une décision prise par défaut par Claude sans validation doit pouvoir être retrouvée et remise en cause facilement.
