# Notifications V1 — contrat transverse

## Raccord Arcade R982–R984

[Arcade V1](arcade-v1.md) n'ajoute aucun producteur persistant Arcade, level-up ou tutoriel. Le bilan de partie est inline ; niveaux et overflow empruntent `LevelUpFeedback` existant. Les vraies complétions Missions provoquées par le propriétaire XP conservent leurs notifications normales R954–R955. Les anciennes intentions de découverte/notifications XP interface ne sont pas implémentées ici : Tutoriel attend son lot dédié. Aucun nouvel actionKey, typeKey ou canal Chat.

Statut : décisions propriétaire R954–R958 ; candidat fonctionnel `c11c6f5eeb9a9a9fa96fbc83f504ffcd9a7e3811` approuvé par review indépendante ChatGPT, promu techniquement au checkpoint `c5f4412a9b07832916a288905cf9a9499cbf8e30` et déployé. Étape 21 validée publiquement dans le périmètre du smoke test des surfaces Notifications/Missions décrit ci-dessous. Aucune migration 057. Ce document est la matrice du domaine Notifications. Les règles métier des producteurs restent dans leurs domaines.

Le propriétaire confirme : « C’est bon, Notifications et Missions s’affichent normalement. » Le standalone, l'ouverture et le rendu général du panneau Notifications, ainsi que la navigation et l'affichage de `Activités > Missions`, ont été observés sans erreur visible ni problème évident de layout. La production d'une nouvelle notification Mission n'a pas été forcée publiquement : Kichnifou avait terminé toutes les Missions B/A/S et ne conservait que `perfect_friendship_z` (« Amitié parfaite », 0/1) et `manual_combat_wins_z` (« Maître du combat », 30/50), chacune dotée de 160 000 Primogemmes. Ce chemin reste validé techniquement par la review indépendante et les tests PostgreSQL privés ; aucune progression, récompense ou notification publique artificielle n'a été créée. L'étape 22 est la prochaine étape officielle, sans implémentation dans ce checkpoint.

## Catégories et cycle

- **Actionnable** : une cause métier existe et une destination permet d'agir ou de consulter. La cause disparue résout `UNREAD` ou `READ` en `RESOLVED` ; elle ne supprime ni état métier, ni récompense, ni preuve.
- **Informationnelle** : signale un résultat déjà acquis. Une destination peut mener au contexte, sans claim. La lecture ne résout pas le résultat.
- **Feedback éphémère** : retour dans la surface propriétaire, sans ligne `Notification` persistante. La sélection d'un spectateur Concours en est un exemple.

`UNREAD` est visible et non consultée ; `READ` est visible et consultée ; `RESOLVED` signifie que la cause/action a disparu ; `ARCHIVED` est le retrait volontaire du Player. `readAll` lit seulement ; `archiveOne` ne lance aucune action métier. Les lignes résolues ou archivées quittent la liste active. Une notification `READ` ancienne est archivée paresseusement au changement de jour métier. La purge définitive de l'historique à un an, hors ligne active/non résolue, appartient à l'étape 27 selon [la politique de rétention](data-retention-v1.md).

Un simple GET, polling ou refresh ne réactive jamais `ARCHIVED`. Un nouvel événement métier peut le faire si le producteur le prévoit. Les receipts et clés de déduplication restent durables après archivage ou résolution. `EVENT_MESSAGES_PENDING` conserve son état et son compteur lors d'un reconcile sans nouveau message ; un message neuf réactive `READ`, `RESOLVED` ou `ARCHIVED` en `UNREAD`, remet les timestamps de lecture/résolution/archivage à `null` et actualise la date. À zéro message en attente, `UNREAD` et `READ` deviennent `RESOLVED` ; `ARCHIVED` reste archivé. Les annonces `EVENT_EDITION_AVAILABLE` et `EVENT_EDITION_LAST_DAY` actives sont résolues à la fin, à la désactivation ou lorsque le dernier jour n'est plus valide. Une édition distincte a ses propres reçus de livraison.

Dans le panneau, une ligne avec destination a le curseur `pointer`, même lue. Sans destination, seule une ligne `UNREAD` a le curseur `pointer` : son clic la lit. Une ligne informationnelle `READ` sans destination a le curseur normal et son clic n'a pas d'effet. Le bouton `×` d'archivage est toujours un contrôle indépendant et interactif.

## Catalogue physique et destinations

| Domaine / type | Catégorie | Résolution ou consommation | Destination |
| --- | --- | --- | --- |
| `expedition / ready` | Actionnable | Claim ou annulation | Box du personnage |
| `gift-codes / GIFT_CODE_AVAILABLE` | Actionnable | Claim, expiration ou désactivation | Codes |
| `event / EVENT_MESSAGES_PENDING` | Actionnable | Consultation ou rollover ; nouvel envoi peut réactiver | Événement > Jeux > Panier |
| `event / EVENT_EDITION_AVAILABLE` | Actionnable | Fin ou désactivation de l'édition | Événement |
| `event / EVENT_EDITION_LAST_DAY` | Actionnable | Fin de la journée valide ou désactivation | Événement > Shop |
| `social / FRIEND_REQUEST_RECEIVED` | Actionnable | Acceptation, refus ou annulation | Social > Demandes |
| `social / FRIEND_REQUEST_ACCEPTED` | Informationnelle | Archive au clic validée | Social > Amis |
| `trades / TRADES_PENDING` | Actionnable | Traitement des demandes | Échanges > Reçues |
| `trades / TRADE_ACCEPTED` | Informationnelle | Archive au clic validée | Échanges > Historique |
| `appearance / CHARACTER_AVATARS_UNLOCKED` | Informationnelle | Archive au clic validée | Profil > Personnalisation |
| `appearance / COSMETIC_UNLOCKED` | Informationnelle | Cycle général | Profil > Personnalisation |
| `monthly-boss / MONTHLY_BOSS_DEFEATED` | Informationnelle | Cycle général | Activités > Combat > Boss |
| `gift-supreme / GIFT_SUPREME_RECEIVED` | Informationnelle | Cycle général ; aucun claim | Aucune |
| `giveaway / GIVEAWAY_REWARD` | Informationnelle | Cycle général ; aucun claim | Aucune |
| `missions / PERMANENT_MISSION_COMPLETED` | Informationnelle | Cycle général ; aucun claim | Activités > Missions |

Le frontend valide le couple domaine/type/action dans `notification-presentation.ts`, puis `notification-navigation.ts` fournit la destination, la cible éventuelle et la règle d'archive au clic au shell. Aucun nouveau parcours écran n'est créé.

## Missions permanentes

Chaque nouvelle Mission complétée par une action `UI` ou `SYSTEM` courante crée une ligne distincte, avec `missionExternalKey`, `rank`, `displayName` et `rewardPrimogems` structurés, `OPEN_MISSIONS` et la clé `permanent-mission-completed:<playerId>:<externalKey>`. Le crédit automatique, la `BusinessOperation` de récompense, l'état `COMPLETED` et la notification sont dans la même transaction propriétaire ; un replay n'ajoute ni récompense ni ligne.

Le catch-up historique R301 (`STANDALONE_CATCHUP`), `ADMIN` et `MIGRATION` ne produisent aucune notification Mission, sans backfill des anciens Players. `INTERNAL_CHAT` restitue les nouvelles complétions dans la réponse immédiate du message ou de la commande propriétaire, sans ligne standalone. `TWITCH` suit le contrat de retour immédiat sans notification standalone ; le transport/parser/outbound générique reste en pause R942. Aucune modale de fin de Mission n'est ajoutée.

## Domaines différés

Aucune notification persistante nouvelle pour mentions Chat, cœurs d'amitié, intérêt Banque, signalement/modération non décidé, Objectifs, mini-jeux XP futurs, Tutoriel, spectateur Concours ou Pull générique. Aucun centre d'historique, push temps réel, email, push navigateur/mobile ni Twitch asynchrone n'est activé par l'étape 21. Les Objectifs restent à concevoir avec leur domaine ; les mini-jeux XP suivent l'étape 23.
