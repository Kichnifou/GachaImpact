# Activité quotidienne des joueurs — R1080, 13/10/2026

Contrat du mandat post-recette R1079. Le [Master](../master/PROJECT_MASTER_PLAN.md) possède seul le statut testé/reviewé/main/déployé et la prochaine action. Activité quotidienne et présence connectée sont distinctes.

## Source de vérité et événements

`PlayerActivityRecorder.record` reste l'unique propriétaire d'écriture, dans la transaction de l'action accomplie. Il conserve `PlayerActivityState` et ajoute au plus une `PlayerDailyActivity` par `(businessDate, playerId)`. Les quatre témoins booléens se cumulent par OR, sans horaire individuel, texte, score ou récompense dans ce modèle. `ON CONFLICT` et la clé primaire rendent répétitions et concurrence idempotentes ; un rollback retire aussi le témoin.

Producteurs existants conservés : `PresenceService.touch` pour les interactions applicatives APPLICATION ; `GlobalChatService.send` pour un message accepté INTERNAL_CHAT ; `TwitchMessageActivity` pour les messages Twitch reconnus dans son périmètre d'autorité ; `FriendshipService` et `TradeService` pour leurs mutations/amitiés/cœurs et création/mutation d’échanges réussies (APPLICATION en UI, INTERNAL_CHAT ou TWITCH selon leur canal) ; `EventService.sendGameC` pour son envoi accompli GAMEPLAY. Ces catégories décrivent les producteurs actuels, pas une instrumentation fictive de tous les boutons. Les autres actions UI sont reconnues par l'interaction applicative existante. Le message d'une consultation `!actif` suit les règles normales Chat/Twitch ; aucune XP ni récompense spécifique ajoutée.

Le hook de présence ne déclare plus d'activité au montage ou au retour `pageshow` passif. Seuls les événements d'interaction navigateur reconnus, puis acceptés par le serveur, rendent son pulse actif. La coalescence de 15 s est conservée ; le throttle serveur ne saute pas un changement de journée Paris. L'instant accepté est l'horloge serveur, jamais une date envoyée par le client. Heartbeat technique, poll/GET de projection, lecture, réception passive, worker et récompense automatique ne sont pas de nouveaux producteurs.

MP : `DirectMessageService` conserve ses producteurs accomplis existants INTERNAL_CHAT (initiate/send/edit/delete/restore) et APPLICATION (accept/ignore, block/unblock réellement changé, modification des accusés et archivage). Recherche, lecture/history, typing, unread et markRead ne deviennent pas des producteurs. Aucun message privé ni horaire MP n'est projeté ; le témoin INTERNAL_CHAT ne rend pas un joueur nominativement visible sur Twitch.

## Calendrier, couverture et historique

Le jour va de minuit Europe/Paris inclus au suivant exclu. `getBusinessDate`, les porteurs SQL DATE et les helpers calendaires existants définissent les dates ; les journées de 23/25 h sont conservées. Aucun calcul d'un jour par soustraction de 24 h à un instant local.

`ActivityCoverage('daily-v1').startedAt` est créé par la migration additive 080 au predeploy Prisma normal. C'est le début réel de collecte, pas la date de rédaction ni le premier joueur observé. Aucun backfill de `lastSeen`, dernière activité, XP ou soldes. La première journée est PARTIAL si la collecte commence après son minuit. Avant cette date : UNAVAILABLE/count null ; journée couverte sans témoin : zéro. Aujourd'hui reste « en cours ».

`PlayerActivityService.history` est une lecture agrégée des témoins durables, dix jours par page, par dates indexées. Une page supplémentaire expose la frontière antérieure indisponible. Les nombres comprennent tous les canaux et les témoins historiques conservés d'un Player archivé, sans exposer son identité. Ils peuvent dépasser le nombre de noms publiables. Pas de liste d'horaires individuels. F5 et une nouvelle instance de service relisent PostgreSQL.

Historique > Activité réutilise `ScreenHeader`, `ScrollableScreenPanel`, onglets et pagination. La destination typée `history=activity` est autorisée dans le propriétaire de navigation et son sérialiseur navigateur. Aucun nouvel écran principal, chapitre Tutoriel ou menu concurrent. Les états chargement, erreur/réessayer, zéro, partiel et indisponible sont distincts.

## Commande publique et confidentialité

Commande `!actif`, alias `!act`, `!active`, `!actifs`, `!actives`, casse normalisée par le registre partagé. Aucun argument ; Help partagé. Le même `PlayerActivityService` sert UI et resolver commun INTERNAL_CHAT/TWITCH. Noms uniques par Player, tri stable français puis UUID, Unicode conservé. Lecture par lots de 200 sous snapshot RepeatableRead ; découpage par entrées entières via `entryParts` et les limites du transport. Aucun pseudo transformé en mention notifiant un joueur.

Les réponses Chat et Twitch sont publiques : LAST_ACTIVITY doit être PUBLIC (valeur par défaut actuelle comprise). Aucun override propriétaire ou FRIENDS ne rend publiable une activité privée. Les blocs bilatéraux avec le demandeur et les Players non ACTIVE sont exclus. Twitch exige en plus le témoin quotidien TWITCH ; une activité exclusivement APPLICATION/GAMEPLAY/INTERNAL_CHAT ne révèle donc pas l'usage privé du standalone sur Twitch. La liste est libellée en termes de joueurs visibles, sans annoncer le standalone avant révélation. La consultation ne crée pas d'autre effet métier. Les reçus/publications existants assurent le replay sans nouvelle exécution économique.

## Identité, archives et rétention

La résolution Player existante reste autoritaire ; onglets, sessions et canaux ne sont pas des identités supplémentaires. Aucun import, fusion générale, compte fantôme ou nouvelle identité. Les inventaires `knownTables`, `personalReplacementTables` et `legacy-cutover-purge` classifient les deux nouvelles tables ; ce classement ne lance aucune purge ni opération historique. Les archives personnelles restent protégées par `reject_archived_player_mutation`.

La projection de consentement peut neutraliser seulement la forme exacte des témoins APPLICATION-only, comme la dernière activité technique actuelle. GAMEPLAY/INTERNAL_CHAT/TWITCH, une colonne inconnue ou une forme invalide restent significatifs. Les graphes bruts, backups et preuves sont inchangés ; aucune preuve de consentement n'est fabriquée.

Les tables sont backend-only, RLS activée et droits PUBLIC/anon/authenticated révoqués ; API Historique authentifiée, acteur ACTIVE et no-store. Aucune route nominative publique nouvelle. La [politique de rétention](data-retention-v1.md) ne fixe pas encore de purge d'ancienneté pour ce domaine : pas de durée inventée ni de scheduler ajouté. Toute future purge doit préserver la distinction couverture/indisponible et les garanties d'identité.

## Qualification requise

Tests privés PostgreSQL : migration normale/registre, RLS/grants, unicité multicanal/concurrence/rejeu, rollback, minuit et DST, couverture/zero/partiel, noms filtrés/blocs/archives et projection d'auteur de réponse. Tests non-DB : alias/aide/couverture, morceaux Unicode complets, route refus anonyme/no-store, UI et navigation. Tests ciblés ne qualifient pas les anciennes suites Gacha/GlobalChat élargies. Les noms exacts des dix échecs full historiques et les futures observations publiques restent au Master et dans la preuve datée de cette mission.
