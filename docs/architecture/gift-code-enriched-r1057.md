# Codes cadeaux enrichis — R1057

Statut au 09/10/2026 : candidat validé localement sur `review`, review indépendante avant promotion, non déployé. GLOBAL R1064 reste actif ; aucun code cadeau public créé ou publié par cette mission. [Décision propriétaire](../specifications/decisions-log.md#codes-enrichis-r1057), [état courant](../master/PROJECT_MASTER_PLAN.md).

## Configuration et propriétaires

`GiftCodeService` conserve la création, publication, édition autorisée et réclamation. Les neuf récompenses classiques restent dans `gift_code_rewards`, avec leurs FK vers `resource_definitions`. Trois quantités additives sur `gift_codes` représentent la Stella, les points Event et la monnaie Event. Elles ne deviennent pas de fausses ressources générales.

Migration Prisma `20261009190000_068_enrich_gift_code_rewards` : `stella_amount bigint`, `event_points integer`, `event_currency bigint`, non NULL, défaut zéro et CHECK non négatif. Aucun backfill économique, claim, code ou changement de statut. RLS et privilèges privés de la table existante conservés. Les valeurs sont validées sans perte : INT64 pour les montants, INT32 pour les points ; un dépassement de total annule la transaction entière.

L'API Codes conserve `rewards: [{resourceKey, amount}]` ; seules les clés Codes ajoutent `masterless-stella-fortuna`, `event_points`, `event_currency`. Une modification explicite de ce tableau remplace toutes les récompenses, donc remet à zéro les types omis. Un tableau absent les conserve. Après le premier claim de n'importe quelle édition, le verrou existant protège aussi ces trois quantités. Admin, aperçu et audit utilisent la même configuration. Aucun changement des droits ADMIN ou du mécanisme annuel/ponctuel.

La Stella est créditée par le propriétaire PostgreSQL de la Box dans `PlayerItem`, avec une `ItemAcquisition` liée à l'opération Codes et provenance code/édition. La première acquisition est conservée. Consommation, constellations, C6 et économie de la Stella restent inchangés.

## Réclamation atomique

La transaction sérialisable existante acquiert le verrou Player puis la définition du code. Elle vérifie opération source/clé/Player/type/requête, disponibilité et claim unique avant tout gain. Une ancienne réclamation sans opération reste un refus ; aucune transformation ni attribution historique.

Les ressources classiques passent par `PrismaEconomyService`. `EventService.creditGiftCodeRewards` réutilise son propriétaire de points et de paliers. Il cherche seulement une édition déjà existante du mois/année courants, acquiert son verrou SHARE puis recontrôle statut ACTIVE et fenêtre. Il n'appelle pas la matérialisation normale d'édition et ne crée ni inscription ni état quotidien.

Le contrôle Event emploie l'heure réelle du serveur, y compris si l'intention Chat conserve un ancien mois. Les gains vont uniquement à l'édition réellement active, si le Player y est déjà inscrit et le domaine disponible. Sinon, tous les gains Event sont ignorés, les gains indépendants sont accordés et le code est consommé normalement. Une inscription ultérieure ne crée aucun droit au rattrapage de ce code.

Les points franchissent tous les nouveaux seuils dans la même transaction ; les claims de paliers existants sont conservés. Le propriétaire commun conserve RNG, récompenses, opérations SYSTEM et mouvements. Les seuils antérieurs à l'ajout ne sont pas inventés ou réparés par Codes. Aucun écran ou animation supplémentaire de palier. La monnaie utilise le solde par définition Festival existant, après contrôle de l'édition courante ; aucune refonte de cette économie.

La clôture concurrente est sérialisée par le verrou d'édition et le retry borné existant. Les deux claims concurrents reviennent sur la même opération : un seul gain, une seule acquisition Stella et un seul ensemble de paliers. Les collisions de clés entre Players/codes sont refusées avant crédit. Tout échec économique annule code, ressources, Stella, points, monnaie, paliers et notification ensemble.

La matérialisation annuelle utilise `createMany(skipDuplicates)` / INSERT ON CONFLICT au lieu de l'upsert émulé à update vide : la campagne concurrente a reproduit un P2002 avant claim sur ce dernier. Les éditions existantes ne sont ni modifiées ni recréditées.

## Restitution et reprise

`BusinessOperation.resultSummary` persiste `grantedRewards` agrégées, plus l'édition Event réellement créditée, les seuils payés ou le motif de non-attribution. Replay et historique retournent ces faits, y compris après changement de mois. Les anciens résultats sans ces champs gardent leur lecture classique ; aucun ancien claim n'est rejoué.

La notification personnelle existante est résolue avec les gains réels. L'écran Codes distingue la configuration conditionnelle et les gains réclamés. `!code` rapporte les gains réels, notamment les ressources des paliers, et signale une part Event non accordée. Les réponses Twitch passent par le découpage logique acquis à 450 caractères avec mention ; leurs receipts gelés restent autoritaires pour les retries. Une redelivery identique conserve aussi l'horodatage signé EventSub ; réutiliser cet ID avec un nouvel horodatage est un conflit légitime.

Après claim Web, les caches Box/Sac sont invalidés ; le rafraîchissement Event/ressources/notifications existant reste commun. Les scopes Chat Codes incluent Box et Sac. Aucun changement de sélection Gacha ou de protections des mutations Twitch.

## Contrôles acquis avant review

- PostgreSQL local isolé : 68 migrations réellement déployées/enregistrées, `migrate status` à jour ; 69/69 tests sur Codes enrichis, Codes existants, paliers Event, cycle de vie Event, Stella et GLOBAL, puis 22/22 enrichis avec le dernier cas Stella à date inconnue (70 cas distincts).
- Cas couverts : chacun des trois types seul, mixte, inscrit/non inscrit, ACTIVE/FINISHED/SCHEDULED/absente/expirée, un ou huit nouveaux paliers, anciens paliers payés, claims historiques, annuel, claims simultanés UI/Twitch, collision de clé, overflow et rollback intégral, clôture concurrente, ancien contexte Chat, retry des réponses et redelivery signée.
- Intégration Twitch privée réelle : une opération Codes, une acquisition Stella et huit paliers ; réponse gelée identique après changement de mois, nouveau message identique refusé sans second gain ; 44 profils privés acquis conservés.
- Charge GLOBAL sous 68 migrations : 289 requêtes, 245 réponses, huit clients/pool3, zéro erreur finale, perte, doublon ou verrou en attente ; 429 certain récupéré. P95 local 656 ms, provisioning P95 105 ms. Ce n'est pas une mesure de production.
- Journaux d'échecs conservés : fixtures historiques/annuelles corrigées, course annuelle réelle corrigée, fausse redelivery avec horodatage changé identifiée. Aucune de ces corrections ne supprime un garde-fou économique.

verify:full 8/8 : 1 383 frontend et 2 117 serveur, compilations/types/lint/diff conformes. Dernier delta Stella à date inconnue vérifié dans les 22 tests enrichis ; libellé d'acquisition « Code cadeau » vérifié par 11 tests Sac. Contrôle statique final verify:quick 5/5 avant commit. Seize états GameShell/CSS réels (création, édition verrouillée, disponible et réclamé × 1920/1366/2560/390) PASS, zéro erreur navigateur/appel externe. Auteur : trois captures inspectées puis restitution disponible relue après texte conditionnel sur toute la largeur. Fixtures synthétiques, sans authentification ni récompense publique.

Publication GitHub, review indépendante du SHA, promotion, migration publique normale et postflight restent à consigner après exécution. Preuves privées sous `local-data/identity-resolutions/r1057-20261009/` ; elles ne contiennent aucun test mutatif public.
