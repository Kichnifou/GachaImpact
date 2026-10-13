# Retrait indépendant R1085

Depuis un checkout propre du runtime qualifié, ou un checkpoint documentaire conservant ce runtime :

```powershell
node docs/architecture/evidence/r1085-rollback/apply-r1085-rollback.mjs Header
```

Remplacer `Header` par l'un des quatorze noms du manifeste. Le script vérifie le runtime, les empreintes et l'applicabilité, puis indexe **un seul retrait**. Il ne crée aucun commit et ne publie rien. Examiner le diff, exécuter les contrôles du lot, créer un nouveau commit sur review et suivre revue indépendante, promotion et déploiements. Ne pas appliquer aussi les `git revert` du lot : le patch constitue leur résultat complet qualifié.

Les contacts de contexte Header/Général-Shop/Jeux dans EventScreen ont été résolus explicitement, sans retirer les autres lots : conservation du message du découvreur et du contexte responsive pour Header ; conservation du choix Envoyer/Reçus pour Général-Shop ; conservation des vues saisonnières pour Jeux. Les résolutions exactes et bases de tests sont dans le manifeste. Le test Codes initialement en échec lors du retrait Ranking était déjà obsolète dans la base intermédiaire ; la base finale corrigée passe sans résolution Ranking.

Les fondations neutres restent en place. Quatorze retraits vérifiés séparément, compilation/build/tests ciblés ; les preuves des lots inchangés sont réutilisées uniquement lorsque les deltas suivants n'intersectent pas leurs fichiers, avec contrôle d'application final. Aucune recette visuelle du produit retiré ni mutation DB n'est revendiquée. Ces patches sont propres à ce runtime : tout changement de code ultérieur exige requalification.
