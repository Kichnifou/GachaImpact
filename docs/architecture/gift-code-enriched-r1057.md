# Codes cadeaux enrichis — R1057

État au 09/10/2026 : R1057 déployé au SHA `32128cc54d4262d1eab758eeac57781e2bb5be7b`, approuvé indépendamment après corrections puis promu par fast-forward strict. Railway et Cloudflare SUCCESS au SHA exact, Prisma 68 à jour ; GLOBAL R1064 reste actif en révision 19. Le propriétaire confirme après F5 le runtime GLOBAL et les trois quantités du formulaire, visibles et lisibles. Aucun code cadeau public créé ou publié par cette mission ; aucun claim enrichi public exécuté pour la recette. [Décision propriétaire](../specifications/decisions-log.md#codes-enrichis-r1057), [état courant](../master/PROJECT_MASTER_PLAN.md).


## R1065 — Première recette réelle et clarification

Le propriétaire a ensuite créé/publié et réclamé CADEAU_PHASE1 depuis Twitch. Contrôle public **strictement en lecture seule** : claim Kichnifou du 09/10/2026 à 20:15:20 UTC, unique pour cette édition/Player, opération COMPLETED. Gains directs configurés et persistés : 30 000 Primogemmes, 1 000 000 Moras, une Stella (une acquisition GIFT_CODE), 30 Points Event et 30 Bonbons Maudits sur l'édition courante. Nouveaux claims Event 20/30/40 prouvés : +1 monnaie, +500 Cryo personnel, +2 monnaies. Le résultat total +33 Bonbons/+500 Cryo est conforme ; mouvements de primos/Moras/Cryo et opérations enfants justifiés, aucun débit ou replay économique ajouté. Aucun changement de ce Code et aucune recette humaine inventée pour les autres joueurs.

L'aperçu de création/édition affiche : « Les Points Event peuvent également débloquer des récompenses de palier supplémentaires selon votre progression. » Les restitutions UI/Chat distinguent les gains directs du Code et les bonus des nouveaux paliers à partir du résultat persisté, lorsque cette preuve existe ; elles ne recalculent aucun palier/RNG ni ne réécrivent les anciens claims ou réponses gelées. Configuration immuable après premier claim. L'historique sans preuve enrichie conserve sa restitution antérieure.

La réconciliation des notifications évite l'UPDATE lorsque payload et action sont identiques, avec réactivation RESOLVED et autres contrôles conservés. [Mesures et tests privés R1065](supabase-stabilization-r1065.md). La recette propriétaire acquise est distincte du postflight et de la future recette visible du correctif R1065, suivis au Master. Les paragraphes de livraison R1057 ci-dessous décrivent leur état historique avant ce premier vrai Code.

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

Review indépendante du candidat initial : CHANGES_REQUIRED pour une restitution UI P2, sans défaut économique démontré. Le claim confirmé n'attend désormais plus les lectures secondaires Event/Notifications ; leur refus ou attente ne masque plus les gains ni l'invalidation Box/Sac. Un vrai refus de claim reste propagé sans gain inventé. Deux tests Bootstrap ajoutés, suite ciblée 27/27, frontend complet 1 385/1 385, build frontend et contrôle statique 5/5 acquis. Les cartes adaptent leur nombre de colonnes à la largeur disponible ; les seize états visuels repassent avec huit contrôles de contenu supplémentaires, vrai bouton Récupérer mesuré/focalisé, largeur de texte 280–539 px, titres sur une ou deux lignes et zéro récompense débordante. Captures 1366 réclamé et 390 disponible inspectées. Les anciennes assertions visuelles étaient partielles ; ce correctif couvre les points P2/P3 relevés.

## Livraison et postflight acquis

Reviewer distinct `/root/review_final` : APPROVED du SHA final, 37 contenus GitHub cumulés depuis le précédent main vérifiés exactement, P2/P3 fermés. Les déploiements ne reposent pas sur ce verdict seul : Railway `4e496c4f-11b2-44d5-9f46-02b747f87f13` SUCCESS, une réplique Online, zéro pending work/échec ; Cloudflare `fb52efb7-59ab-430b-9a8c-dc2c0a957171` SUCCESS et assets de production identiques à son déploiement exact. Health HTTP 200.

068 est appliquée par le preDeploy Prisma normal, sans SQL parallèle. Les 68 noms/checksums correspondent aux sources Git LF approuvées ; `prisma migrate status` retourne 0 et à jour. Trois colonnes non NULL à défaut zéro, CHECK exact validé, RLS conservée et droits navigateur absents ; les 15 codes existants restent configurés sans nouvelle récompense. Les lectures PostgreSQL publiques du postflight sont explicitement READ ONLY. Backup applicatif public 2 873 910 octets, listé et intégralement décodé, SHA-256 `a5a42bc4294046ffb64996d39a1307f01865e17e8d8bba858ff4afea8311fcc6`, fsync ; auth/storage/grants exclus, aucune restauration réelle effectuée.

Les captures avant/après portent sur 144 tables. La comparaison stricte isole 068, les colonnes à zéro et une activité Twitch réelle distincte : deux messages, quatre opérations de comptage COMPLETED, un nouveau profil de bot StreamElements NATIVE hors des 44, neuf soldes initiaux à zéro et un XP. Aucun intent de commande ni réponse n'est produit par ces deux messages ; cela ne valide pas la recette d'un nouveau joueur humain. L'audit détaillé de ces écarts est conservé séparément de la comparaison stricte, sans transformer son premier FAIL en PASS silencieux.

Audit indépendant `/root/economic_postflight` : PASS_WITH_OBSERVATION, 660/660 contrôles et 17/17 écarts attribués, zéro résidu économique ou d'identité inexpliqué. 125 tables identiques sur 144 ; 068/configuration et activité expliquent les 19 autres. Les 44 graphes initiaux, 79 claims et anciennes économies/historiques sont conservés. L'automate possède 31 missions initialisées, sans récompense ; une notification annonce seulement un code existant. Son attribution à une invocation précise de maintenance n'est pas démontrée par les captures, qui établissent sa conformité à la configuration et au contrat inchangés. Preuve `independent-postflight-1791575687706.json`, SHA-256 `8d24f4ae12b3bc4a2dfe5ebd9d6938c98a7b3d2fe20b6413c4163e20cb7445c0` ; premier comparatif strict et limites de l'observation conservés.

Transport canonique frais PostgreSQL/configuration/Helix : GLOBAL demandé/effectif 19, Chat ACTIVE, 44 cibles historiques conservées ; PENDING, receipt bloquant et annonce Giveaway incertaine à zéro. Le propriétaire confirme les six indications runtime après le redémarrage et la lisibilité des trois champs ; aucun HTTP authentifié n'est inventé. Les trois parcours humains de nouveaux comptes R1064 restent différés par son arbitrage.

R1057 est disponible techniquement et visuellement ; un vrai code et son éventuelle recette économique publique nécessitent une décision propriétaire distincte. Aucun nouveau chantier pré-release lancé automatiquement. Preuves privées sous `local-data/identity-resolutions/r1057-20261009/` ; aucune fixture métier publique, aucun réimport ni écriture économique corrective.
