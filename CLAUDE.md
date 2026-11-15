# Guide de reprise pour une session de travail

Ce dépôt est le remake web du jeu GameMaker « Stand For Planet Earth ». Les sessions de travail ne partagent pas de mémoire : **la documentation de `docs/` est la mémoire du projet.**

## Avant de travailler

Lire, dans cet ordre :

1. `docs/02-feuille-de-route.md` — où en est le projet, quelle est la prochaine action.
2. `docs/01-cadre-mvp.md` — le périmètre, les écarts voulus avec le jeu d'origine, les points ouverts.
3. `docs/decisions/game-design.md` et `docs/decisions/architecture.md` — les décisions prises et leurs raisons.
4. `docs/reference/README.md` — comment lire le code d'origine, et les pièges à éviter.

## Règles de travail

- **Téléchargements** : la connexion internet de l'utilisateur est limitée. Avant tout téléchargement (`npm install`, installeur, assets, `git fetch`), annoncer la taille estimée et attendre son accord. Préférer les dépendances légères.
- **Référence** : le jeu d'origine est le commit `d438c548` (étiquette `remake-reference-2019`) du dépôt `C:\Users\gillo\Code\Stand-For-Planet-Earth`. Le lire avec `git show` ou `git archive`, sans changer de branche ni rien modifier dans ce dépôt, et sans jamais y pousser.
- **Vérifier dans le code** : avant d'implémenter une mécanique, relire le fichier GML d'origine cité par les analyses de `docs/reference/jeu-original/`. Ces analyses sont des lectures du code, pas des certitudes.
- **Tracer les décisions** : tout choix de gameplay ou de game design qui n'est pas dicté par le code d'origine (écart, invention, arbitrage, correction de bogue visible, changement d'équilibrage) reçoit une entrée dans `docs/decisions/game-design.md`, dans le même commit que le changement. Les choix techniques structurants vont dans `docs/decisions/architecture.md`. Mode d'emploi : `docs/decisions/README.md`. Indiquer si la décision vient de l'utilisateur ou d'un choix par défaut.
- **Tenir la feuille de route à jour** : cocher ce qui est fait et ajouter une ligne au journal d'avancement à chaque session.
- **Git** : commits intermédiaires à chaque avancée cohérente, sur la branche `main`. Pas de `git push` sans demande de l'utilisateur.
- **Sprites manquants** : l'utilisateur autorise à en régénérer, fidèles au style d'origine, avec les ajustements nécessaires ; le consigner dans le journal de game design.
- **Livraison** : par étapes jouables ; à la fin d'une étape, le jeu se lance et se joue, et l'utilisateur teste avant la suite.

## Conventions

- Documentation et échanges avec l'utilisateur en français. Textes affichés dans le jeu en anglais, comme l'original.
- La logique de jeu ne dépend ni de Phaser ni du navigateur (voir ADR-005).
- Les valeurs d'équilibrage vivent dans un fichier de réglages unique, pas dispersées dans le code.

## Environnement (relevé le 2026-11-15)

Windows 10. Node 14.17 installé ; Node 22 LTS à installer à côté via nvm-windows (ADR-003). Présents : npm 6, yarn 1.16, git 2.21, winget, choco, `pdftotext`. Absents : Python, Docker. Dans l'outil Bash de cette machine, une commande contenant des caractères accentués perd ses variables shell : utiliser des motifs (`D*cors`) à la place des accents.
