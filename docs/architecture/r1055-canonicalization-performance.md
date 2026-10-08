# R1055 — fermeture, sûreté et empreinte des progressions

Candidat review du 08/10/2026, baseline publique `52b5631c1988a895b90046347a8db320f810432f`. Aucun déploiement ni préflight Ceo public dans ce lot. Le contrat de choix reste porté par [l’owner de liaison](backend-architecture-v1.md#owner-de-liaison-twitch-unifiée--r1055) ; [le Master](../master/PROJECT_MASTER_PLAN.md#r1055-astra-20261008) porte les gates et l’état courant.

## Diagnostic et limites de la preuve

Le préflight public précédent termine trois projections, puis 57014 à `CANONICALIZATION_EVIDENCE` : 282 FK, graphe de 4 895 lignes/55 tables/5 566 868 octets et 241 branches de références. Il ne permet pas de séparer planification et exécution de cette dernière requête. Ce résultat reste historique : aucun nouveau diagnostic distant n’a été lancé.

La reproduction utilise les 62 migrations réelles sur PostgreSQL **17.11 local**, des données entièrement synthétiques, 282 FK et 55 tables personnelles remplies. Les volumes sont comparables, sans copier le graphe public. Elle produit 244 branches de références ; sa distribution métier diffère donc de celle de Ceo.

L’ancien moteur `52b5631` renvoie le graphe complet à chaque itération puis aux références. Pour 4 895 lignes/5,63 Mo, cela représente 16,89 Mo de paramètres, trois projections, des recordsets de lignes complètes, des comparaisons JSONB et un plan de références à 1 804 nœuds. Le parcours répète aussi la recherche linéaire `Array.includes` pour dédupliquer les lignes. Sur la reproduction à dix fois le volume, ce travail dépasse nettement le budget d’une requête de cinq secondes.

Les mesures `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, TIMING OFF)` départagent les coûts **locaux** ; les résultats numériques sont ci-dessous. PostgreSQL peut transformer certains EXISTS en sous-plans hachés : il serait incorrect de déclarer toutes les comparaisons SQL quadratiques. Le défaut démontré est le traitement répété des images complètes, la fermeture redondante et la taille non bornée du plan. Aucun index manquant ni réglage infrastructure nécessaire n’est démontré. Le timeout public exact et l’ancien incident PostgreSQL/pool ne sont pas déclarés résolus par ces essais.

## Stratégies évaluées

| Stratégie | Coût et garanties | Décision |
| --- | --- | --- |
| Un grand UNION et les CTE de lignes complètes | Peu d’allers-retours ; réexpansion des gros JSON et plan croissant avec les FK | Oracle conservé, remplacé dans le candidat |
| Une requête par FK | Plans simples ; centaines d’allers-retours sur Shared Pooler | Écartée |
| Tables temporaires indexées dans la transaction | Réutilisation/indexation possibles ; cycle DDL/ANALYZE/nettoyage, contraintes du chemin READ ONLY et maintenance supplémentaire | Non nécessaire aux volumes mesurés ; aucun staging introduit |
| Groupes seuls avec les mêmes lignes complètes | Plan borné, mais duplique encore le gros paramètre et les traitements d’images | Insuffisant comme solution globale |
| Fermeture incrémentale, clés typées et groupes par parent | Même snapshot et mêmes lignes pour l’empreinte ; clés compactes seulement pour les jointures ; nombre d’appels dépend des groupes, pas des joueurs/lignes | Retenue |

Expérience locale séparée sur **les mêmes lignes**, trois passages par taille, résultat identique à chaque passage. La médiane inclut le parcours complet ; EXPLAIN est exécuté séparément au troisième passage et n’entre pas dans cette médiane. Aucune latence réseau artificielle n’est ajoutée.

| Branches maximum | Requêtes projection + références | Paramètres cumulés | Médiane | Plan maximum | Exécution maximum EXPLAIN |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 8 | 40 | 2 508 153 octets | 328 ms | 1,52 ms | 22,05 ms |
| 16 | 21 | 1 894 929 octets | 274 ms | 1,73 ms | 28,56 ms |
| 32 | 11 | 1 493 084 octets | 246 ms | 3,15 ms | 28,73 ms |
| **64** | **6** | **1 292 073 octets** | **236 ms** | **6,14 ms** | **43,61 ms** |
| 256 | 3 | 650 696 octets | 212 ms | 23,21 ms | 54,04 ms |

**64** garde un plan borné tout en divisant les allers-retours par rapport à 32. Le gain local supplémentaire de 256 est faible au regard du quadruplement du temps maximal de planification. C’est une constante interne testée, pas un réglage opérateur ni une adaptation silencieuse du timeout. Le paramètre JSON et chaque recordset requis restent MATERIALIZED une fois par requête.

## Algorithme et preuve d’équivalence

1. Vérifier `transaction_isolation` : **Repeatable Read ou Serializable obligatoire**, sinon arrêt `CANONICALIZATION_STABLE_SNAPSHOT_REQUIRED` avant capture. `TwitchAccountLink` utilise déjà Serializable ; le préflight utilise Repeatable Read READ ONLY. Aucun niveau, verrou, retry ou délai de ces owners ne change. Un simple READ COMMITTED ne permettrait pas de remplacer une égalité d’image par une égalité de clé entre plusieurs statements. [Snapshots PostgreSQL](https://www.postgresql.org/docs/17/transaction-iso.html).
2. Charger les mêmes métadonnées, les mêmes domaines personnels et la même racine. La découverte conserve toutes les FK du schéma canonique, sans liste de signatures filtrant les inconnues. Les noms non admis échouent fermés. Le périmètre de schéma de `targetedRowMetadata` reste inchangé.
3. Capturer pour chaque ligne **son JSONB textuel complet** et un JSONB compact des colonnes de toutes ses FK entrantes/sortantes. PostgreSQL fabrique ces valeurs ; aucun entier n’est converti en Number JavaScript. Plus de 50 colonnes restent supportées par plusieurs constructeurs JSONB bornés. Deux lignes différentes ayant les mêmes clés sortantes restent deux lignes : seule l’image complète déduplique.
4. Suivre seulement les nouveaux parents jusqu’au point fixe. L’ensemble complet reste une Map indexée par image de ligne. Le premier passage depuis `players` capture toutes les lignes des tables ayant une FK directe simple `player_id`. Les autres chemins vers ces tables imposent déjà `c.player_id = Player` : ils ne peuvent produire que des doublons et sont omis. Les autres descendants continuent jusqu’à fermeture, y compris les cycles. Le tri final des tables/lignes est exactement conservé.
5. Pour chaque FK entrante issue d’un parent capturé, la ligne réelle du child est classifiée avec la **même politique métier**. Après fermeture, l’appartenance personnelle est exactement le garde de descente : son `player_id` doit être celui de la racine s’il existe ; sans ce garde, le child atteint est déjà capturé. `players` n’est jamais parcouru vers le bas et reste explicitement limité à `c.id = racine`. Les exceptions historiques et les nouvelles colonnes vers un autre Player gardent leur traitement fail-closed avant cette règle.
6. Pour les références sortantes vers un parent personnel, joindre le parent réel puis rechercher sa **clé FK référencée** dans les parents capturés. Une FK PostgreSQL référence une clé unique ; l’égalité des composantes non nulles identifie donc la même ligne complète dans le snapshot stable. Conserver exactement la sémantique SQL des clés composites/nulles, ainsi que les exceptions de rôles et d’adversaires Arcade. Un parent extérieur reste SHARED_ACTIVE.
7. Regrouper toutes les branches par parent, par lots de 64 maximum. Envoyer seulement les clés des tables requises par ce lot. Attendre séquentiellement chaque requête sur **la transaction initiale**. Aucune réponse partielle, opération détachée, `Promise.race`, table temporaire, écriture métier ou nouvelle connexion. Une erreur ou annulation SQL abandonne tout le calcul.
8. Trier les références comme auparavant, exclure le même housekeeping, calculer la même sûreté puis **le même SHA-256/version 1** sur les images complètes, les signatures FK et les classifications. Aucun changement de consentement pour un graphe identique ; toute modification invisible de gameplay reste détectée. Aucune empreinte/graphe/clé n’est ajoutée au DTO ni au snapshot persistant.

Les requêtes restent sensibles au coût réel des index et du volume global PostgreSQL ; aucune complexité constante n’est promise. La fermeture ne retransmet plus tout le graphe à chaque niveau. La mémoire et le hash restent proportionnels aux données personnelles capturées, avec tri canonique en O(R log R). Les ensembles de déduplication remplacent les recherches linéaires répétées. Le nombre de groupes croît avec les FK pertinentes, sans requête par Player ou par opération.

## Mesures et validations

Les mesures facultatives exposent uniquement étapes fixes, durée, lot/itération, nombre de branches/lignes/tables et octets. Les phases racine, projection (construction/exécution/fusion/tri), références, fingerprint et total sont distinguées. Ni SQL, ni identité, ni contenu, ni hash n’est journalisé ; une erreur de l’observateur est ignorée. [Méthode EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html).

Les chiffres finaux et le bilan des suites sont consignés au [Master](../master/PROJECT_MASTER_PLAN.md#r1055-astra-20261008). Ils mesurent une machine Windows locale, sans Shared Pooler ni réseau Railway/Supabase : ce sont des preuves comparatives, pas une promesse de latence publique.

Deux oracles indépendants restent figés dans les tests : `canonicalization-safety-reference.ts` (0af5827) et `canonicalization-materialized-reference.ts` (52b5631 ; seuls les imports et le nom exporté diffèrent). Un observateur de test collecte les lignes effectivement retournées, sans modifier les algorithmes des oracles. Comparaison exacte du graphe trié, de toutes les classifications/comptages, de la sûreté et du fingerprint. Les gros graphes utilisent l’oracle 52b5631 ; les cas de sûreté comparent les deux oracles.

Les tests couvrent 1×/4×/10×, augmentation de la population, deux graphes significatifs dans le parcours réel verified/pending/resolve pour WEB et TWITCH, conservation intégrale du gameplay du gagnant et de l’archive, bigint adjacent au-delà de 2^53, clés composites/nulles, doublons de tuples de clés, cycles, références tierces, 96 nouvelles FK inconnues, 65 nouvelles colonnes FK, future référence inverse de `players`, READ ONLY, écrivain concurrent, consentement/révision, opérations actives, choix simultanés, erreur après déplacement d’identité et rollback, timeout SQL annulé sans travail orphelin, réutilisation puis fermeture du pool.

Le budget augmenté **uniquement pour l’oracle de diagnostic privé** lui permet de terminer et de fournir une comparaison exacte. Le candidat garde 5 s par statement dans les mesures ; les méthodes réelles R1055 gardent leurs transactions Serializable de 30 s. Aucun délai opérationnel n’est relevé. Les fixtures sont limitées aux schémas privés créés pour les tests et nettoyées ; aucune donnée publique n’a été utilisée.

Commandes reproductibles, après préparation explicite d’une base locale et de ses catalogues versionnés, avec `DATABASE_URL` pointant exclusivement vers celle-ci :

```text
npm --prefix server run test:db -- tests-db/canonicalization-safety.test.ts
npm --prefix server run test:db -- tests-db/twitch-account-link.test.ts
npm --prefix server run test:db -- tests-db/canonicalization-performance.test.ts
npm run verify:full
```

## Gate suivante

Publication **review uniquement**, vrai diff GitHub contrôlé, puis review indépendante ChatGPT. Après approbation seulement : mission de promotion/déploiements contrôlés, protections publiques, **un préflight Ceo complet** mesurant aussi références/fingerprint. Si 57014, instabilité ou OPERATOR_REQUIRED : STOP exact sans hausse de limite. Sinon seulement suivre le runbook B séparé/rehearsal/backup/rollback/import. Aucune liaison humaine avant B importé et vérifié. La dette Supabase reste prioritaire après migration des joueurs ; aucune optimisation d’infrastructure ni abonnement dans ce candidat.
