# R1100 — suppression effective du compte

## Extension de schéma post-V1 — R1107

La migration 088 ajoute arcade_sessions.after_match au registre JSON classifié, soit 84 colonnes contre 83 au checkpoint R1100 historique. Aucun nouvel acteur, identifiant externe, secret ou contenu personnel n’est produit ; seuls les IDs opaques et la présence séquencée du contexte Arcade sont internes. Les FK, la fermeture des lignes possédées et le scrub générique restent sous le propriétaire d’effacement existant. Classification physique et cycle réel d’effacement/reprise qualifiés en PostgreSQL privé avec les 88 migrations : 2/2 PASS, 13 cas non sélectionnés ; pas d’effacement public de QA. [Contrat Arcade](post-v1-arcade-after-match-20261017.md), état livré au Master.

**Continuité R1101 :** le suivi différé est désormais porté hors GameShell, avec intention locale non secrète avant dispatch et retry sur le même POST avec JWT capturé encore valide. Le bouton PENDING était disponible ; le défaut corrigé concernait le démontage après401/reload/perte de réponse. Après expiration, clôture non confirmée et worker poursuivi si accepté ; aucune nouvelle authentification de suivi, endpoint anonyme ou exception JWT. [Contrat et preuves R1101](r1101-v1-closure.md). Le périmètre d'effacement et la politique de sauvegardes restent inchangés ; les constats datés ci-dessous restent historiques.

Continuité du 16/10/2026, bootstrap `201e81fdf4a9884a17c15fff0f75799d5f9aca1b` : ancien repli désactivé, quatre références alignées et arbre propre. Le [Master](../master/PROJECT_MASTER_PLAN.md) conserve le premier état historique et distingue qualification, publication, activation et recette humaine. Aucun compte public pour la QA.

## Décisions et accès privilégié

Le propriétaire autorise l'effacement effectif et le cycle review → main → déploiements/postflight sans GO générique. Décision complémentaire explicite : données actives effacées immédiatement ; sauvegardes privées chiffrées conservées au maximum 30 jours, accès restreint, restauration bloquée pour le compte supprimé et information explicite du joueur.

L'accès Auth Admin avec `SUPABASE_STORAGE_SECRET_KEY` a été établi par la CLI Railway authentifiée, valeur uniquement en mémoire. GET Admin sur UUID synthétique inexistant : `404 user_not_found`, User-Agent serveur explicite. Aucun utilisateur réel interrogé/supprimé, aucun secret publié. Le nom Storage ne limite pas les privilèges du secret `sb_secret_`. Client backend dédié, SDK officiel épinglé, persistance/rafraîchissement désactivés, timeout borné.

Références officielles : [clés serveur](https://supabase.com/docs/guides/getting-started/api-keys), [suppression physique Auth](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [utilisateurs et Storage](https://supabase.com/docs/guides/auth/managing-user-data), [sessions](https://supabase.com/docs/guides/auth/sessions). Supprimer Auth ne suffit pas à invalider immédiatement les JWT.

## Anniversaires post-V1 — R1106

Les quatre scalaires Birthday du Player sont remis à NULL dans erasePlayerData, y compris dans les anciennes sources archivées du périmètre prouvé. Aucune FK/colonneJSON supplémentaire ; inventaires fermés existants inchangés. Le verrou Player empêche toute attribution concurrente après acceptation ARCHIVED. Preuves économiques gardées selon la politique existante, sans jour/mois d’anniversaire ; notifications personnelles supprimées avec le compte. Les marqueurs anti-restauration et barrières Auth ne changent pas. Test privé ciblé de suppression effective avec date présente, puis champs absents ; résultat réel au Master.

## Parcours et acceptation

Même section Compte, modale, styles danger et unique `POST /api/v1/me/account/deletion`. Corps strict : `confirmation: SUPPRIMER` et preuve de réauthentification ; aucun ID cible accepté. Client Supabase isolé sans persistance pour le mot de passe courant. Le serveur vérifie signature/issuer/expiration, subject identique à la session, AMR password signé récent de cinq minutes et utilisateur Auth vivant. `iat`, refresh et métadonnées utilisateur ne constituent pas cette preuve.

L'acceptation sérialisée prend les verrous subject, admission Twitch puis Player ; vérifie schéma, dépendances, responsabilités et opérations en cours. `clock_timestamp()` après verrous/préflight fixe le cutoff, pas le `now()` du début de transaction. Player ARCHIVED, journal et marqueurs privés sont atomiques. Cette acceptation est irréversible ; aucun succès avant clôture.

Le périmètre durable contient le Player courant et les anciennes sources Web archivées rattachées au même WebIdentity, ainsi que les perdants Twitch de choix WEB effectivement terminés. La récupération automatique est incluse ; cible Twitch non choisie et opérateur sont exclus. Une archive active/réassignée, une identité historique liée hors périmètre ou plus de 25 versions provoque un refus avant acceptation. Les admissions Twitch sont triées, puis les Editions Event sont verrouillées avant les Players triés. Les archives sont effacées avant le Player courant ; aliases historiques collectés avant retrait des résolutions. Les identifiants Twitch temporaires du journal sont vidés au checkpoint DATABASE_ERASED.

Les nouveaux accès consultent le journal puis le statut WebIdentity. Un JWT sans identité Web doit passer `getUser` vivant avant provisionnement ; le polling ordinaire d'un compte actif n'ajoute pas d'appel Auth réseau. Guard SQL des sujets supprimés, verrou commun au provisionnement et gardes de mutations empêchent la recréation/écriture sur l'ancien compte. La route de reprise vérifie le JWT initial sans lui appliquer la barrière des routes de jeu.

Refus avant acceptation : ADMIN actif, credential/opérateur Twitch indispensable non transféré/révoqué, opérations non terminales, échanges/invitations/sessions partagées en cours. Les diffusions Invocation sont arrêtées et les spectateurs détachés. De nouvelles policies Storage d'écriture navigateur suspendraient l'acceptation jusqu'à requalification de cette course ; aucune n'existe au préflight lu.

## Effacement et conservation

Migration 085 additive : deux tables privées RLS/revoke navigateur, journal avec bail/token et marqueurs HMAC. Contrat explicite de **307 FK, 136 références directes Player et 83 colonnes JSON** ; une extension inconnue refuse l'effacement. Graphe personnel dédié, descendants et références extérieures contrôlés avant retrait ; aucune cascade Player générale.

- Retrait des identités Web/Twitch, sessions, préférences, confidentialité, rôles personnels, ressources/progression, Box/Teams/Sac, états/statistiques personnels, récompenses et preuves privées propres au joueur, votes et relations privées capturées.
- Contenus Chat/MP/Event de l'auteur retirés, signalements/citations nettoyés ; textes des autres auteurs conservés. Notifications/historiques partagés neutralisent les références personnelles de la cible sans changer montants, récompenses ou progression des tiers.
- Nettoyage des références de migration sans FK, issues sans Player, provenance, sources historiques Boss/Giveaway/Event et clés de maps identitaires connues. Annonces Giveaway des simples participants/chatteurs incluses.
- R1099 lossless et lectures Twitch Brotli décodés avant inspection, y compris les imbrications. Aucune preuve d'absence fondée sur la seule chaîne compressée.
- Preuves LegacyFriendshipFact identifiantes supprimées, références et hashes déterministes copiés neutralisés ; chiffres/dates des relations des pairs conservés. Marqueur HMAC FRIENDSHIP_SOURCE du hash de paire contrôlé à l'enregistrement et à la restauration pour empêcher sa recréation depuis un ancien snapshot.
- Catalogue, définitions, snapshots de bannières agrégés et métriques de rétention : producteurs examinés sans donnée ordinaire de joueur ; aucune réécriture par collision avec un Character. Curseur technique opaque conservé.

Un Player ARCHIVED neutre « Compte supprimé » ancre les seules relations partagées indispensables. Il ne possède plus de compte, progression ou identifiant externe dans ses données propres. UUID techniques, références de preuves et marqueurs HMAC restent **pseudonymes**, pas une promesse d'anonymat irréversible face à des sources externes. Conversations et ancres de modération restent cohérentes. Les anciennes progressions archivées conservent leur libellé distinct.

## Reprise et anti-restauration

Étapes ACCEPTED → DATABASE_ERASED → COMPLETED. BACKUP_PENDING existe pour une politique exigeant l'effacement hors ligne avant clôture ; la politique runtime approuvée est RETENTION_30_DAYS. Worker borné, bail cinq minutes/token, CAS de clôture, reprise après coupure ; étape d'échec fixe, jamais erreur fournisseur/secret dans le journal. Arrêt attend le worker courant. Subject Auth brut retiré après confirmation fournisseur ; hash de reprise retiré sept jours après clôture.

Storage : inventaire owner/owner_id, API officielle de suppression et contrôle d'absence avant/après Auth ; les tests privés ne touchent jamais Storage public. Auth : `admin.deleteUser(subject, false)` puis contrôle officiel d'absence ; `user_not_found` rend la reprise idempotente. Une panne laisse PENDING et le compte bloqué.

Marqueurs HMAC Player/Twitch : imports personnels, canary/rollback, snapshots, récupération partagée et sauvegardes ciblées. Ils restent nécessaires tant que d'anciennes sources peuvent être présentées. Cutoff Twitch actualisé à chaque suppression, recontrôlé sous le verrou commun. `min(timestamp source authentifié, receivedAt serveur)` empêche un callback antérieur ou à horloge avancée de créer un compte après acceptation. Inscription ultérieure vérifiée autorisée comme compte vierge ; aucun marqueur effacé pour restaurer une ancienne sauvegarde.

## Copies privées Windows

Copies opérateur prises en charge sous `local-data` : AES-256-GCM, dates authentifiées en AAD, clé DPAPI CurrentUser, ACL propriétaire Windows/SYSTEM/Administrateurs. Gros fichiers streamés, intégrité exacte vérifiée avant remplacement. Le clone PostgreSQL R1099 est désormais une copie chiffrée non exécutable ; aucune base publique ou archive Git R1099 modifiée.

Writers canary, canonicalisation, rapports identité/population, social et réparation : chiffrement dès création. Lecteurs locaux : déchiffrement en mémoire et refus à expiration ; marqueurs HMAC interdisant en plus la restauration d'un compte supprimé. Aucun rollback global public autorisé : toute récupération de base doit conserver le journal courant des effacements et réappliquer leurs exclusions avant ouverture.

La clé HMAC stable du serveur possède une copie locale DPAPI CurrentUser dans le vault Git ignoré `local-data/private-backups/account-erasure-marker-key.dpapi`. Elle est distincte de la clé AES des sauvegardes et n'est pas une copie joueur à purger à30jours : sa conservation protège les exclusions. Un outil opérateur charge cette clé uniquement en mémoire dans `ACCOUNT_DELETION_MARKER_KEY` pour sa commande autorisée, puis retire la variable de son processus ; ne jamais l'afficher, la committer, la renouveler isolément ou supprimer les marqueurs pour permettre un restore. Une clé absente après création de marqueurs refuse les imports/restaurations. La tâche de rétention exclut le vault des copies joueur gérées.

Tâche locale `GachaImpact-PrivateBackupRetention` : seal puis sweep à 03:00 et au logon, StartWhenAvailable, fenêtre cachée. Sweep découvre aussi nouvelles enveloppes/interruption de seal, vérifie scope/liens/hash/dates et retire les copies avec une journée de réserve. **Limite matérielle : un PC éteint peut retarder la destruction physique du ciphertext ; elle reprend au réveil. Le lecteur interdit strictement toute restauration après 30 jours, même dans ce cas. La clé DPAPI commune n'a pas d'expiration cryptographique.** Preuves publiques réduites aux compteurs et résultat réel de tâche, aucun contenu privé.

Cette précision matérielle est explicitement validée par le propriétaire : « Refus de restauration à 30 jours ; effacement physique au prochain réveil du PC. » Elle figure aussi dans la notice joueur.

## Qualification et activation

Tests destructifs exclusivement synthétiques en schémas PostgreSQL privés ; adaptateur Admin mocké. Contrôles réels non destructifs pour privilèges, métadonnées Storage, déploiements et postflight. Aucune suppression Auth/Storage publique pour QA.

Couverture : vierge/progression/Box/Team, MP/citations/signalements, tiers/tiers archivés, notifications, migrations sans FK, compressions, mauvaise identité de réauthentification, ADMIN, ancien JWT/provisionnement, reprise Auth, double onglet, inscription vierge et seconde suppression Twitch. GameShell compilé/CSS production : quatre viewports PC/mobile, mauvais/bon mot de passe, pending/erreur/clôture, focus et nettoyage local.

Résultats exacts, reviews GitHub et déploiements au Master/preuves ; les tests locaux ne prouvent aucune activation. Déploiement en deux temps : nouveau guard sur toutes les répliques, ancienne version retirée, puis clé privée `ACCOUNT_DELETION_MARKER_KEY`. Retour au backend antérieur après activation interdit sans conservation des barrières. Durées et moteurs de maintenance R1099 inchangés.

Activation réelle et contrôles non destructifs du16/10 consignés au [checkpoint de continuité](evidence/r1100-continuity-qualification.json). Deux échecs historiques de replay après remplacement d'un compte actif sont documentés séparément : writer canaryv3 contre détection historiquev2, déjà présents au bootstrap et hors effacement R1100. Les chiffres ciblés réussis ne représentent pas une suite PostgreSQL entièrement verte. Aucune suppression publique ni recette humaine inventée. STOP R1100.

Les copies de profil conservées dans les snapshots de commandes sont également traitées : account-deletion-scrub retire birthday par ID du Player présenté, y compris dans un reçu appartenant à un autre Player, sans toucher à sa propre date ni aux montants/années économiques. Les quatre scalaires Birthday sérialisés d’un Player supprimé sont neutralisés.
