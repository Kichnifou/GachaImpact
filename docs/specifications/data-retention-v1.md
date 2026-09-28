# Politique de rétention V1

Statut : **décisions propriétaire validées R943–R945**. Source canonique des durées de conservation/purge et de leurs exemptions. Le [Master](../master/PROJECT_MASTER_PLAN.md) porte l'état vivant ; les autres documents renvoient ici sans recopier la matrice.

## Durées décidées

Ces durées concernent le **détail historique**, jamais l'état métier nécessaire. « Mois » et « an » conservent les unités de la décision ; leur traduction exacte en bornes calendaires sera précisée dans le lot d'implémentation de chaque domaine.

| Domaine | Détail concerné | Durée |
| --- | --- | --- |
| Banque | Historique détaillé | 1 mois |
| Boutique | Historique détaillé | 3 mois |
| Event | Historique détaillé | 1 an |
| Boss | Historique détaillé | 1 an |
| Concours | Historique détaillé | 1 an |
| Combat | Historique détaillé | 1 an |
| Échanges | Historique détaillé | 3 mois |
| Codes cadeaux | Historique détaillé player-facing | 1 mois |
| Chat global standalone | Messages/historique ordinaire | 1 mois |
| Notifications | Historique, hors notification active/non résolue | 1 an |
| TwitchEventReceipt | Observation pure `channel.chat.message` | Cible de 24 heures glissantes |

Pour tout domaine non cité : **aucune purge d'ancienneté décidée**. Les données déjà éphémères ou déjà purgées gardent leur comportement existant ; aucun second mécanisme ne doit être ajouté uniquement pour remplir cette matrice.

## Protections obligatoires — R944

Une échéance historique n'autorise jamais à détruire statistiques cumulées, solde, progression, état courant, récompense acquise, rang/stat durable, anti-double-claim, idempotence encore nécessaire, preuve de migration, modération, audit administratif ou provenance indispensable.

Si le détail historique reste la seule source d'une statistique ou d'une preuve, **ne pas le purger**. Avant toute suppression, vérifier l'agrégat durable équivalent ou définir une conservation minimale sûre. Chaque domaine doit auditer ses FK, états, claims, compteurs, idempotence et usages d'audit.

- **Codes cadeaux :** un mois borne le détail player-facing, pas le droit de réclamer de nouveau. Si `GiftCodeClaim` est l'unique preuve anti-double-claim, la preuve minimale reste. Supprimer le détail seulement lorsque l'édition/code ne peut réellement plus être réclamé, ou après mise en place d'une preuve compacte durable équivalente. Aucun changement Codes n'est implémenté dans ce checkpoint.
- **Notifications :** une notification toujours active/non résolue reste conservée même après un an.
- **Chat :** la génération visible et `!clear` gardent leurs règles UI. Les preuves de modération figées dans un signalement sont distinctes de l'historique ordinaire ; conserver tout le Chat indéfiniment « pour audit » n'est plus la cible. Le runtime Chat ne change pas dans ce checkpoint.

## Twitch pilote — R945, seule rétention codée dans ce candidat

Un reçu est éligible uniquement si **toutes** les conditions sont vraies :

- `eventType = channel.chat.message` ;
- `state = RECEIVED` ;
- `processedAt IS NULL` ;
- `externalReference IS NULL` ;
- `receivedAt < now - 24 heures` (égalité conservée) ;
- aucune relation durable connue, explicitement `favorGrant IS NULL`.

Les autres types, états, reçus consommés ou porteurs de référence/provenance/preuve durable sont exclus. Toute future relation durable doit être ajoutée au filtre **avant activation de son consommateur**. Une future commande ayant produit un effet devra être explicitement marquée consommée selon un contrat à définir (`processedAt`, état, référence ou relation durable) ; ce pipeline n'est pas implémenté ici.

`TwitchReceiptRetention` est utilisé par l'observer singleton du backend : après une observation Chat acceptée, seul un contrôle mémoire décide de lancer une tentative. Au plus une tentative par heure et par process, une seule purge concurrente, un lot maximal de **1 000 IDs** les plus anciens, sans boucle de rattrapage. Le DELETE répète les protections pour conserver un reçu devenu consommé après la sélection. L'index existant `(event_type, received_at)` et la relation unique FavorGrant sont réutilisés ; aucune migration 055.

La réception **n'attend pas** la maintenance. Un échec de sélection/DELETE est absorbé, sans faire échouer le message ni provoquer de retry EventSub ; la tentative ratée conserve l'espacement horaire. Il n'y a ni scheduler, appel de purge à chaque message, tâche payante, ni garantie de nettoyage à la seconde près. Sans trafic, ou avec un backlog dépassant un lot, des lignes peuvent dépasser temporairement 24 h. Un restart remet à zéro le contrôle mémoire ; la coordination est locale au process, pas distribuée.

Cette purge limite la croissance du stockage ; elle **ne supprime pas le coût d'une écriture Receipt par nouvelle notification** du pilote. La déduplication dans la fenêtre conservée reste inchangée. Après purge d'une observation pure ancienne, son ID n'est plus une preuve d'idempotence : ce TTL n'est jamais autorisé pour un reçu ayant un effet durable.

## État physique et travaux reportés

Le complément de rétention Twitch est **candidat `review`**, sans activation réelle. Les autres durées sont **décidées et non implémentées par ce lot** ; les mécanismes éphémères existants restent en place. Le lot ultérieur « Finition technique / rétention / maintenance », dans [l'étape 27](../roadmap/implementation-order-v1.md), vérifiera chaque domaine avant purge et la maintenance DB.

La passe finale Twitch évaluera tous les messages ordinaires en mémoire pour XP/classification/parser, avec absence de persistance de chat ordinaire lorsque inutile. Les reçus durables devraient être réservés à l'idempotence, aux effets métier et aux diagnostics bornés nécessaires. Ni cette refonte, ni XP/commandes, ni mirroring, ni outbound ne sont développés ici ; voir [l'architecture Twitch](../architecture/backend-architecture-v1.md).
