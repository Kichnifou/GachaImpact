# Politique de rétention V1

## R1098 — B1 de simulation, sans nettoyage nouveau

Le mandat du15/10/2026 autorise le moteur de classification, les métriques et la simulation nocturne04:00 Europe/Paris sur le backend existant, après qualification/review/déploiement. Les durées produit R1097 ci-dessous ne changent pas. Modes fermés DISABLED/DRY_RUN, défaut DISABLED ; aucun mode destructif livré. La présence du scheduler ne vaut aucune permission de purger, convertir ou masquer des détails joueurs. **B1 déployé et DRY_RUN actif le15/10 à18:50UTC**, rattrapage automatique du jour SUCCESS, zéro action destructive. Première nuit réelle du16/10 à04:00Paris encore à observer ; nettoyages réels non activés, historiques non traités. [Preuve runtime](../architecture/evidence/r1098-runtime.json), état de livraison au Master. B2 non lancé.

Mois/années calendaires en heure murale Paris, fin de mois rabattue au dernier jour valide, égalité exacte conservée.30jours Twitch terminal calendaires Paris ;24h passives écoulées avec le propriétaire TTL existant inchangé. Horloge serveur injectable, dates nulles historiques inconnues ; non terminal protégé sans inventer sa date de fin. Comptages des tables principales bornés et explicitement exhaustifs/partiels/erreur ; éligibilité B2 non qualifiée et candidats techniques0 jusqu'à preuve des protections/remplacements et récupération. Les tables auxiliaires/provenances/relations JSON restent conservées. [Architecture et inventaire](../architecture/r1098-retention-engine.md).

## Contrat propriétaire du 15/10/2026 — R1097

**VALIDÉ PRODUIT — IMPLÉMENTATION ÉCHELONNÉE, SELON LOT.** Cet arbitrage supersède « pas de purge préventive avant croissance préoccupante ». Lot A : nouvelles écritures seulement, anciennes lignes intactes ; aucun scheduler nocturne, Supabase Cron ou nouvelle purge. TTL passif existant inchangé.

| Données | Conservation décidée |
| --- | --- |
| Détails Twitch définitivement terminés | 30 jours, puis compactage sécurisé avec preuve minimale durable |
| Observations Twitch passives | 24 h, TTL existant |
| Chat global | 1 mois |
| Banque | 1 mois |
| Boutique et Échanges | 3 mois |
| Codes cadeaux, détail joueur | 1 mois |
| Event, Boss, Combat, Concours | 1 an |
| Notifications résolues | 1 an |
| Invocations | Détail 1 an, puis résumé si sûr |
| Messages privés | Détail 1 an, puis retrait si sûr |
| Reçus Arcade | Compactage après 1 an si sûr |
| Journaux Catalogue | Détail 3 mois, preuves conservées |

Détails expirés normalement retirés de l'interface, sauf résumés expressément prévus. Après qualification/livraison des lots suivants : maintenance chaque nuit même avec une petite base, anciennes données également traitées. Alertes validées à **250, 350 et 400 MB** ; aucun seuil n'autorise une suppression hors contrat. États, statistiques, anti-double-claim, idempotences, migrations, modération et preuves indispensables protégés. Aucun achat, nouveau service ou purge forcée implicite. Mois/ans restent calendaires ; bornes et exemptions à qualifier par domaine avant activation.

[Contrat technique A](../architecture/r1097-storage-optimization.md). Prochaine étape : lot B moteur/planification sécurisée après examen A ; aucune purge présumée active.

## Déclenchement conditionnel antérieur — historique supersédé par R1097

Le propriétaire ne veut **aucune campagne de purge préventive** des historiques. Les durées décidées ci-dessous demeurent la **politique de référence** si un futur lot de conservation est autorisé ; elles ne valent ni permission de supprimer maintenant ni obligation de développer un scheduler post-V1.

Une étude puis, éventuellement, une purge par domaine ne sont à engager **que si les historiques et la base deviennent trop volumineux et que leur croissance continue est objectivement établie**. Mesurer périodiquement la taille PostgreSQL totale, les plus grosses tables, leur composition en données vivantes/preuves durables/space reusable, le rythme hors imports/tests et la marge du quota. N'introduire aucune date de purge automatique, seuil économique ou achat de capacité sur ce seul arbitrage. Toute intervention future demande vérification des FK/idempotences/statistiques, sauvegarde et tests privés, revue du SHA et autorisation spécifique du propriétaire.

La [photographie en lecture seule du 15/10](../architecture/evidence/database-growth-baseline-20261015.md) montre **120 556 691 octets (114,97 Mio)** de base, dont **80 166 912 octets (76,45 Mio)** de tables publiques ; quota Free anciennement documenté de 500 MB, soit environ 24 % utilisé. Depuis le 09/10, la base a augmenté de 40,82 Mio, mais des pointes d'activité d'import/QA empêchent une extrapolation de rythme durable. Aucun historique Banque/Boutique/Échanges/Chat n'est alors au-delà de ses durées indicatives, et la plupart des gros reçus Twitch sont des preuves traitées : **pas de purge autorisée**. Une surveillance régulière est recommandée ; elle n'est pas configurée comme automatisation par cette décision.

## Activité quotidienne — R1080

PlayerDailyActivity/ActivityCoverage entrent dans les inventaires personnels/techniques. Aucune purge d'ancienneté décidée pour ce domaine, conformément à la règle des domaines non cités ; aucune purge, backfill ou réimport lancé. Quatre témoins booléens par Player/jour, pas d'horaires individuels ni texte. Archives conservées/protégées et noms archivés exclus des sorties ; toute future suppression exige de préserver couverture/indisponible et statistiques honnêtes. [Contrat Activité](player-activity-v1.md).

Les sections Twitch pilote ci-dessous conservent les preuves de leurs lots. « Sans activation » et « future passe finale » se rapportent à ces checkpoints historiques ; l'autorité GLOBAL actuelle et ses producteurs sont décrits dans [R1064](../architecture/twitch-global-r1064.md) et le Master.


Statut : **décisions propriétaire validées R943–R945, complétées et supersédées pour la politique future par R1097 en tête**. Source canonique des durées de conservation/purge et de leurs exemptions. Le [Master](../master/PROJECT_MASTER_PLAN.md) porte l'état vivant ; les autres documents renvoient ici sans recopier la matrice.

## Durées décidées

La matrice ci-dessous conserve le périmètre historique R943–R945. La matrice complète courante est celle de R1097 en tête, incluant notamment Invocations, messages privés, Arcade, Catalogue et détails Twitch terminés.

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

Pour tout domaine non cité dans la matrice courante **R1097 en tête** : aucune purge d'ancienneté décidée. Les données déjà éphémères ou déjà purgées gardent leur comportement existant ; aucun second mécanisme ne doit être ajouté uniquement pour remplir cette matrice.

## Protections obligatoires — R944

Une échéance historique n'autorise jamais à détruire statistiques cumulées, solde, progression, état courant, récompense acquise, rang/stat durable, anti-double-claim, idempotence encore nécessaire, preuve de migration, modération, audit administratif ou provenance indispensable.

Si le détail historique reste la seule source d'une statistique ou d'une preuve, **ne pas le purger**. Avant toute suppression, vérifier l'agrégat durable équivalent ou définir une conservation minimale sûre. Chaque domaine doit auditer ses FK, états, claims, compteurs, idempotence et usages d'audit.

- **Codes cadeaux :** un mois borne le détail player-facing, pas le droit de réclamer de nouveau. Si `GiftCodeClaim` est l'unique preuve anti-double-claim, la preuve minimale reste. Supprimer le détail seulement lorsque l'édition/code ne peut réellement plus être réclamé, ou après mise en place d'une preuve compacte durable équivalente. Aucun changement Codes n'est implémenté dans ce checkpoint.
- **Notifications :** une notification toujours active/non résolue reste conservée même après un an.
- **Chat :** la génération visible et `!clear` gardent leurs règles UI. Les preuves de modération figées dans un signalement sont distinctes de l'historique ordinaire ; conserver tout le Chat indéfiniment « pour audit » n'est plus la cible. Le runtime Chat ne change pas dans ce checkpoint.

## Twitch pilote — R945, rétention promue techniquement

Un reçu est éligible uniquement si **toutes** les conditions sont vraies :

- `eventType = channel.chat.message` ;
- `state = RECEIVED` ;
- `processedAt IS NULL` ;
- `externalReference IS NULL` ;
- `receivedAt < now - 24 heures` (égalité conservée) ;
- aucune relation durable connue, explicitement `favorGrant IS NULL`.

Les autres types, états, reçus consommés ou porteurs de référence/provenance/preuve durable sont exclus. Toute future relation durable doit être ajoutée au filtre **avant activation de son consommateur**. Une future commande ayant produit un effet devra être explicitement marquée consommée selon un contrat à définir (`processedAt`, état, référence ou relation durable) ; ce pipeline n'est pas implémenté ici.

`TwitchReceiptRetention` est utilisé par l'observer singleton du backend : après une observation Chat acceptée, seul un contrôle mémoire décide de lancer une tentative. Cadence normale **1 h** ; si le lot sélectionné contient exactement **1 000 IDs**, cadence de rattrapage **1 min**, même si certains reçus devenus protégés réduisent le nombre supprimé. Un lot partiel revient à 1 h. Chaque délai part de la **fin** de la tentative ; une seule purge concurrente, au maximum un SELECT et un DELETE de 1 000 IDs les plus anciens par tentative, aucune boucle ou récursion immédiate. Les tentatives suivantes dépendent de nouveaux messages, sans timer autonome. Le DELETE répète les protections pour conserver un reçu devenu consommé après la sélection. L'index existant `(event_type, received_at)` et la relation unique FavorGrant sont réutilisés ; aucune migration 055.

La réception **n'attend pas** la maintenance. Un échec de sélection/DELETE est absorbé, sans faire échouer le message ni provoquer de retry EventSub ; il ramène la cadence à 1 h après la fin de l'échec, sans tempête de retries rapides. Il n'y a ni scheduler, appel de purge à chaque message, tâche payante, ni garantie de nettoyage à la seconde près. Sans trafic, ou avec un backlog dépassant un lot, des lignes peuvent dépasser temporairement 24 h. Un restart remet à zéro le contrôle mémoire ; la coordination est locale au process, pas distribuée.

Le rattrapage évite le plafond structurel de 1 000 suppressions/h : sous trafic continu, sa capacité théorique est de 1 000/min, environ 60 000/h avant coût DB et durée des tentatives. Ce chiffre n'est pas une capacité globale Twitch validée et ne prouve aucune recette de charge R942, désormais acceptée en observation bêta non bloquante selon R1034.

Cette purge limite la croissance du stockage ; elle **ne supprime pas le coût d'une écriture Receipt par nouvelle notification** du pilote. La déduplication dans la fenêtre conservée reste inchangée. Après purge d'une observation pure ancienne, son ID n'est plus une preuve d'idempotence : ce TTL n'est jamais autorisé pour un reçu ayant un effet durable.

## État physique historique et travaux reportés — complété par R1097

L'historique R1034/R945 ci-dessous reste une preuve de ses anciens périmètres. La politique future R1097 en tête fait désormais autorité ; ses traitements nocturnes et anciens historiques ne sont pas encore livrés par le lot A.

**R1034 : 27 CLÔTURÉE PAR DÉCISION DE PÉRIMÈTRE PROPRIÉTAIRE.** La politique reste une référence valide et ses protections anti-perte/anti-double-claim demeurent obligatoires pour toute purge future. Ce qui est déjà implémenté reste actif selon ses gates ; ce qui ne l'est pas relève du backlog maintenance post-V1/besoin réel, sans obligation préalable au cutover ni implémentation présumée. Charge/performance Twitch et autres observations rares sont ACCEPTÉES — observation bêta/situation réelle, non bloquantes ; aucune campagne artificielle supplémentaire imposée. Anomalie observée → correctif borné.

Le complément de rétention Twitch 24 h et sa cadence adaptative sont **promus techniquement sur `main`**, sans activation réelle ni test public du transport. Les autres durées sont **décidées et non implémentées par ce lot** ; les mécanismes éphémères existants restent en place. 27 est clôturée par décision de périmètre R1034 ; les travaux non implémentés sont du backlog maintenance post-V1/besoin réel, et toute purge future exige encore un audit domaine par domaine. Ils ne constituent plus un gate obligatoire préalable au cutover.

La passe finale Twitch évaluera tous les messages ordinaires en mémoire pour XP/classification/parser, avec absence de persistance de chat ordinaire lorsque inutile. Les reçus durables devraient être réservés à l'idempotence, aux effets métier et aux diagnostics bornés nécessaires. Ni cette refonte, ni XP/commandes, ni mirroring, ni outbound ne sont développés ici ; voir [l'architecture Twitch](../architecture/backend-architecture-v1.md).
