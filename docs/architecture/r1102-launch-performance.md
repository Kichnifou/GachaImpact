# R1102 — maintenance des performances après lancement

Mandat propriétaire du 16/10/2026 après ouverture officielle déclarée et ralentissements avec environ dix joueurs. Départ GitHub `bd3dcb0c2ec183210314cfad0863b6e646998e6a`, main/review distantes alignées, arbre local propre puis avance rapide de review. V1 reste acceptée et clôturée ; aucune ancienne tâche rouverte. Le [Master](../master/PROJECT_MASTER_PLAN.md) possède seul le statut de livraison ; ce document conserve le diagnostic et le contrat technique du correctif.

## Causes et limites de preuve

Les fenêtres Railway avant correction montrent environ 53 000 requêtes/heure, 661 réponses 5xx, plusieurs p95 à 30 s ; CPU maximum 0,190 et mémoire maximum 0,634 Go. `/chat/updates` représente environ 24 000 requêtes/heure et atteint aussi 30 s de p95. Logs : réconciliation cadeaux expirée à 6 387 et 10 271 ms pour une transaction de 5 000 ms, puis impossibilité d'acquérir une transaction. Les lectures PostgreSQL alternent absence de blocage, transactions actives de plus de 50 s sans wait_event, puis trois attentes tuple/transactionid. Cela confirme une contention intermittente, **pas une cause unique ni l'identité du bloqueur racine**. Aucun verrou supprimé, pool agrandi ou timeout relevé.

`pg_stat_statements` est cumulatif depuis le 7 octobre ; les requêtes privées non qualifiées ne se distinguent pas sûrement de leurs équivalents publics. Leurs compteurs ne servent donc pas à quantifier la charge du lancement. Les statistiques explicitement publiques et index existants ont été inspectés, sans migration ni création d'index. Pas de benchmark synthétique public. [Mesures agrégées et qualification](evidence/r1102-performance.json).

## Corrections locales

- **Chat frontend, P0 confirmé :** ancien polling 350 ms start-to-start et délai nul après réponse lente. Délai désormais mesuré après la fin : 1 500–2 000 ms actif, 5 000–5 500 ms replié ; jitter par cycle, ralentissement progressif jusqu'à 8 500 ms, erreurs jusqu'à 15 500 ms. Retour visible/focus/reconnexion réseau relit immédiatement. Document caché : pas de polling global. Le coordinateur par panneau/joueur coalesce les lectures identiques en vol et sérialise les autres lectures ; aucun cache de réponse. L'envoi reste optimiste, commandes séquencées et réponses locales immédiates.
- **Lectures backend, P0 confirmé :** `updates` charge d'abord seulement ID/date/ordre/état de la fenêtre retenue, puis hydrate les relations des inconnus et suppressions connues. Une lecture inactive avec messages actifs ne recharge aucun auteur/avatar/opération/réponse/mention. Curseur `(createdAt,id)`, `submissionOrder`, arrivées tardives, fenêtre 200, reset de génération, masquage des parents expirés, permissions et projections par lecteur conservés. Les suppressions connues restent retransmises conformément au protocole existant ; aucun cache interjoueurs. Aucun writer Chat/Twitch ni transaction métier modifié.
- **Cadeaux, P0 confirmé :** N consultations de notification sous verrou Player remplacées par une lecture groupée ; éditions annuelles créées en un `createMany(skipDuplicates)` ; seconde matérialisation dans un même `listForPlayer` évitée. Verrou Player puis partage codes, écritures, déduplication, dates Paris, réactivation/résolution et notification immédiate conservés. Scheduler toutes 60 s/lots quatre inchangé.

Alternative transport Realtime/WebSocket/Redis écartée conformément au mandat. Cache temporel de codes, suppression des verrous et refonte des transactions différés : aucune preuve suffisante permettant de les qualifier sans risque. Aucune nouvelle décision produit, économique ou architecturale structurante ; correction technique sous mandat existant.

## Analyse complémentaire ciblée

| Point | Qualification | Impact / risque / priorité |
|---|---|---|
| MP : fil 500 ms, liste 1 250 ms, non-lus 5 s, relance immédiate après lenteur | Cadences confirmées dans `use-direct-messages.ts` ; contribution publique non mesurée | Potentiellement élevé / moyen (droits, accusés, éditions) / P1 à mesurer si incident persiste |
| Notifications : 15 s, 3 s panneau ouvert ; expédition puis gift/Event/Arcade et archivage sur lecture | Plusieurs propriétaires reprennent le même verrou Player ; surcoût structurel confirmé, responsabilité publique non isolée | Élevé possible / élevé si réconciliation différée / P1 diagnostic ciblé, sans suppression de notifications |
| Cadeaux scheduler et consultation | Les deux chemins réconcilient ; leur fusion par cache n'est pas sûre aux bornes ou après admin/claim | N+1 corrigé / risque élevé pour saut de réconciliation / différé |
| Présence | Projection 30 s, heartbeat 45 s, activité coalescée 15 s ; advisory par Player et écritures sessions | Cadences raisonnables / verrou FK indirect non prouvé / pas de changement actuellement |
| Chat writers | Player puis état global exclusif durant acceptation et progression ; clear/modération/déduplication en dépendent | Contention possible / risque élevé / conserver ; tracer une chaîne précise avant intervention |
| Concours | 69 réponses 5xx dans la fenêtre ciblée ; réconciliation single-flight et candidate/due checks existent | Symptôme confirmé / cause locale non établie / pas de refonte automatique |
| Accueil, combat, commandes, schedulers | Rafraîchissements métier et mutations communs ; aucune nouvelle boucle/N+1 attribuée à l'incident | Non prouvé / risque métier élevé / code conservé |
| Plusieurs onglets | Chaque panneau possède sa boucle ; pause des onglets cachés et jitter réduisent la pression, plusieurs fenêtres visibles restent additives | Moyen / coordination interonglets hors correction / à mesurer |
| Rendus React | Pas de setMessages sur update vide ; pas de changement de disposition/CSS/DOM | Aucun défaut de rendu coûteux établi / optimisation non nécessaire actuellement |
| Index / capacité Railway | Index génération+ordre, auteurs, sessions et déduplication notifications déjà présents ; CPU/RAM Railway non saturés dans la fenêtre | Aucun achat/index/pool supplémentaire justifié |

Avec un réseau rapide, le seul chat actif passe d'environ 28,6/71,4/142,9 lectures par seconde pour 10/25/50 joueurs à un maximum de 6,7/16,7/33,3 (moyenne indicative avec jitter 5,7/14,3/28,6), hors actions/initialisations. **Calcul de cadence, pas gain mesuré de latence ou promesse de capacité.** Dix joueurs : cible immédiate à confirmer passivement. Vingt-cinq : plausible sous réserve des autres lecteurs et transactions. Cinquante : non qualifié ; MP/notifications et contention doivent être mesurés avant engagement. Aucun supplément d'infrastructure recommandé.

## Vérifications et reprise

Tests frontend ciblés 82/82, cadeaux/notifications/social non-DB 25/25, chat API/pression 7/7 ; quick 5/5 et full 8/8. Reproduction non-DB exécutée avec le service au checkpoint initial puis corrigé : 10/30 lectures concurrentes entraînent 20/60 appels hydratés avant, zéro après, même réponse vide. Ce nombre représente les appels ORM avec relations, pas un comptage SQL ni une mesure de latence PostgreSQL.

La première qualification PostgreSQL cadeaux n'a exécuté aucun test : préparation >60 s puis cleanup timeout, six cas skipped. Schéma propre à l'essai ensuite supprimé et absence vérifiée, schéma préexistant intact. Qualification Chat ciblée en cours ; promotion backend suspendue tant que ses preuves nécessaires et la review indépendante du SHA publié ne sont pas acquises. Les nouvelles fixtures Chat prévoient 10 et 30 lecteurs plus envoi/replay concurrents, suppression et rattrapage ; les suites existantes portent bornes, mentions, génération et ordre. Les preuves Twitch GLOBAL/MP restent séparées des changements de lecture. Aucun test ni recette propriétaire non exécuté n'est revendiqué.

Après déploiement : observer passivement volume par route, p50/p95/p99, 5xx, logs Prisma, attentes PostgreSQL, CPU/RAM. Comparer des fenêtres réellement comparables ; attendre le renouvellement naturel des anciens onglets pour que leur polling change. Recette naturelle propriétaire : discussion à deux, commande déjà habituelle, masquage/retour onglet, repli/réouverture, réponse/suppression de son propre message et MP ; PC/mobile. Aucun achat/tirage/récompense artificiel.
