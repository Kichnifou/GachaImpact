# Retraits indépendants R1091

Base runtime qualifiée : `22cb7b250f6616c487d95405ddfa1118122e9844`, au-dessus du checkpoint R1090 `dffec5a63af14a5a3424022180a037813a93911d`.

Depuis une copie propre du candidat, retirer un seul lot avec son commit :

| Lot | Commande |
| --- | --- |
| Équipe | `git revert d8b1f613` |
| Shop Event | `git revert 0d92f6e2` |
| Tracker Quotidiennes | `git revert e94c99f0` |
| Navigation/header Event | `git revert 22cb7b25` |

Les quatre recettes ont été exécutées séparément dans des worktrees privés depuis cette base, avec `git revert --no-commit`, contrôle exact des fichiers indexés, typecheck frontend, build Vite et suite ciblée du lot. Quatre PASS, sorties 0. Chaque diff ne touche que les fichiers de son commit ; les trois autres lots et les sept corrections R1090 sont donc conservés. Registre et empreintes dans [la qualification](../r1091-visual-qualification.json).

Après retrait : réconcilier les seules mentions R1091 devenues fausses dans Master/spécifications, inspecter le diff et répéter les contrôles sur le HEAD réel, puis suivre review → review indépendante → main FF → déploiements/postflight. Un changement ultérieur ou un cumul de retraits nécessite une nouvelle qualification. Aucun reset, force push, migration ou mutation publique. Les retraits ont des tests/builds locaux ; aucune recette visuelle de chaque retrait ni déploiement de rollback n'est prétendu.

Logs complets hors Git dans `local-data/r1091/rollback-<lot>-<outil>.log`. Les avertissements Vite de taille du bundle et erreurs asynchrones du harnais vers localhost:3000 sont conservés avec leurs codes de sortie réels ; les tests de retrait ne remplacent pas le full final du candidat.
