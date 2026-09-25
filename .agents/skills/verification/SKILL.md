---
name: verification
description: Déterminer et exécuter les validations proportionnées d'un lot GachaImpact, sans lancer implicitement de tests ou migrations sur la base DEV.
---

# Vérification

Lire les règles de validation dans `../../../docs/process/implementation-workflow.md` et le périmètre dans le Master. Reproduire d'abord le défaut avec un test ciblé, élargir au sous-système, puis à la suite complète si le risque le justifie. `npm run verify:quick` et `npm run verify:full` ne couvrent que le non-DB ; choisir explicitement les tests DB nécessaires hors de ces scripts.

Conserver les logs complets hors contexte, vérifier chaque code de retour et rapporter séparément réussi, échoué, exclu et non exécuté. Avant le checkpoint, exécuter `git diff --check`, contrôler exactement les fichiers indexés et le worktree. Ne jamais assimiler un test local à la review GitHub ou à la validation publique.
