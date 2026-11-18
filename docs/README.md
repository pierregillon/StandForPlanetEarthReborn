# Sommaire de la documentation

Les sessions de travail ne partagent pas de mémoire : ces documents sont la mémoire du projet. Le guide de comportement d'un agent est [AGENTS.md](../AGENTS.md), à la racine.

## Le projet

| Document | Contenu |
|---|---|
| [02-feuille-de-route.md](02-feuille-de-route.md) | Étapes de livraison, état actuel, prochaine action. L'historique des modifications est dans git |
| [01-cadre-mvp.md](01-cadre-mvp.md) | Périmètre de la première version, écarts voulus avec le jeu d'origine, sources de vérité, points ouverts |

## Narration

| Document | Contenu |
|---|---|
| [narration/arc-narratif.md](narration/arc-narratif.md) | **Référence narrative**, écrite par l'utilisateur : concept, actes SFPE et SFHB, dénouement, personnages, thématique, questions en suspens |
| [narration/niveau-tvtv2.md](narration/niveau-tvtv2.md) | Le niveau TvTv² (acte II) : fiche de mission, lieux, suite d'objectifs, scripts des cinématiques |
| [narration/plans/](narration/plans/) | Plans annotés des salles (`npm run level-map` les régénère) |

## Décisions

| Document | Contenu |
|---|---|
| [decisions/game-design.md](decisions/game-design.md) | Décisions de game design (`GD-xxx`) : quoi, pourquoi, décidé par qui. Index en tête de fichier |
| [decisions/architecture.md](decisions/architecture.md) | Décisions techniques (`ADR-xxx`). Index en tête de fichier |
| [decisions/README.md](decisions/README.md) | Quand et comment ajouter une entrée |

## Technique

| Document | Contenu |
|---|---|
| [architecture-code.md](architecture-code.md) | Principe simulation / affichage, multijoueur, chaîne des niveaux et des assets, carte du code |
| [developpement.md](developpement.md) | Lancer, tester, déboguer dans le navigateur, fabriquer les sprites, particularités de chaque machine |
| [formats-donnees.md](formats-donnees.md) | Formats des niveaux et des manifestes d'assets |

## Le jeu d'origine

| Document | Contenu |
|---|---|
| [reference/README.md](reference/README.md) | Dépôt, commit de référence, comment le lire, pièges |
| [reference/jeu-original/](reference/jeu-original/) | Trois analyses du code de 2019 : héros et joueur, ennemis et IA, niveaux et interface (textes et dialogues d'origine : §6 du troisième) |
| [reference/documents-origine/](reference/documents-origine/) | Documents de conception d'époque (PDF) : GDD, cahier des charges graphique, ancien scénario (remplacé par l'arc narratif) |
