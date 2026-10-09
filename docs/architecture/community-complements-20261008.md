# R1056 / 31B — compléments communautaires, 08/10/2026

## Périmètre et état

Continuation depuis e9967ae, rectifications propriétaire intégrées. Quatre canaries NATIVE/CANARY révision 12, GLOBAL false ; aucun import, OAuth, choix R1055, transfert de progression, restauration publique ou batch43 exécuté dans ce lot. Les preuves brutes, UUID, identités Twitch, manifests, hashes individuels et backups restent dans les dossiers locaux ignorés, préservés.

<a id="visibilite-archive"></a>

## Visibilité des archives — lot A

[R1059](../specifications/decisions-log.md) précise R1055. Lecture PostgreSQL READ ONLY : A « Céo » ARCHIVED sans WebIdentity/TwitchIdentity ; B enregistré « Ceotryd », désigné Céotryd par le propriétaire, ACTIVE. WebIdentity initiale sur B, TwitchIdentity immuable conservée, résolution terminée TWITCH avec A perdant et B gagnant, import DATA_IMPORTED et target NATIVE vérifiés. Aucun changement de nom nécessaire, aucun matching par seul pseudonyme.

| Owner / projection | Traitement |
| --- | --- |
| Event actuel | Exclusion ARCHIVED dans la requête avant Top 10 ; même filtre pour participation propre et comptage du rang. |
| Historique Event | Exclusion dans la lecture des participants avant tri/rang/Top 10 ; compte visible et détail personnel cohérents. Éditions, inscriptions, claims et acquisitions conservés. |
| Boss actuel / histoire / classement | Exclusion ARCHIVED des rangs ; coups, dégâts globaux et preuves conservés. Coup final et record de coup attribués à une archive : texte neutre, sans lien de profil. |
| Giveaway état / classement | Participants et chatteurs visibles filtrés en base avant classement ; gagnant et organisateur archivés présentés neutralement. Récompenses et annonces figées conservées. |
| Concours | Classement de résultat figé, scores, slots et récompenses conservés ; identité archivée neutralisée dans résultat, liste et détail historique. Aucun lien de profil dans ces surfaces. |
| Arcade | Classements déjà limités aux ACTIVE ; résultat personnel partagé conservé, adversaire archivé neutralisé. |
| Classements globaux, recherche / profils publics, contacts / présence | Owners existants limités aux ACTIVE : pas de nouveau filtre ni changement des SUSPENDED. |
| Bannières / votes | Historique public constitué de personnages et snapshots agrégés, sans profils de votants. Préserver les votes et les snapshots figés ; aucune réécriture d'un résultat de rotation. |
| Chats, MP, récompenses, claims et opérations historiques | Preuves/auteurs conservés, aucun déplacement A→B. Les accès au profil public restent refusés par l'owner aux comptes non ACTIVE. |

Tests PostgreSQL locaux en schémas privés : défaut de classement Event et Giveaway reproduit, scénarios A ARCHIVED / B ACTIVE, pseudonymes inversés, Top 10 rempli, rang personnel hors Top 10, tout ARCHIVED, SUSPENDED inchangé, historique Event sans suppression de claims, Boss sans réattribution du coup final, Giveaway sans création de récompense. Résultats Concours/Arcade vérifient neutralisation et conservation physique des résultats/événements et ressources des tiers. Deux fixtures préexistantes corrigées : initialiser le gameplay avant archivage ; comparer le registre Prisma à tous les dossiers actuels plutôt qu'à 60 migrations. Aucun garde-fou métier affaibli.

Validation : 90 tests PostgreSQL pertinents PASS ; `verify:full` 8/8 PASS (tests non-DB, builds, typechecks, lint et diff-check). La recette visuelle locale utilise le GameShell complet et les CSS de production, données synthétiques et aucune session publique : classement Event et historique Event, Top 10 rempli et tout ARCHIVED/vide, desktop 1366×768 et mobile 390×844, huit états capturés, zéro erreur JS/requête externe/débordement horizontal. Les images sont inspectées séparément des assertions. Les contrôles de déploiement restent séparés ; une réussite locale ne constitue pas une validation publique.

## Lot A publié et recetté

Checkpoint `01a9d1425e2be104125b88a942899bbee0d8d33b` : vrai diff GitHub et 14 blobs rapprochés, fast-forward main strict, Railway/Cloudflare SUCCESS au SHA exact, production/preview/assets exacts, health 200, Prisma 63/noms/checksums conformes. Après redémarrage, PostgreSQL/configuration Railway/Helix READ ONLY : quatre NATIVE, CANARY 12, capacité/armement/effectifCANARY, subscription Chat ACTIVE exacte, GLOBALfalse ; aucun PENDING/outbound incertain. La sonde canonique n'est pas un GET authentifié de l'instance. Le propriétaire confirme ensuite F5/classement/historique/lisibilité (« Oui c'est bon ») et les quatre indications Configuration→Compte (« je confirme »), sans commande supplémentaire. A recetté ; aucune session navigateur inventée.

<a id="correction-review-20261009"></a>

## Correction après review indépendante — 09/10/2026

Baseline contrôlée avant correction : `main/origin/main = 01a9d1425e2be104125b88a942899bbee0d8d33b`, `review/origin/review = d62cb7cedc35de0e6236dcf3f2f8f74ac2eb021a`, ahead 1 / behind 0, worktree propre. La review indépendante conclut CORRECTION REQUISE ; le candidat initial n'est pas promu. Cette section complète les preuves du 08/10 sans les transformer en contrôles publics du 09/10.

### Sélection concurrente et ordre des verrous

Le défaut est reproduit avec de vraies transactions PostgreSQL : après la lecture réelle de l'ancienne composition, le test suspend la requête UI avant son écriture, laisse R1060 terminer, puis reprend la sélection. Sans correction, celle-ci réussit et enregistre une cible retirée. Le parcours Chat attendait d'abord le verrou Player, contrairement à l'ordre global. Les logs des essais intermédiaires, dont un conflit Serializable avant stabilisation de cette reproduction, sont préservés localement.

`PrismaGachaStore.setTarget` prend maintenant `70422401` au début de sa transaction, avec ou sans clé. L'éligibilité et l'écriture sont sérialisées avec votes, pulls, rotation et remplacement ; idempotence, validations ACTIVE/5★ et erreurs existantes restent inchangées. Les tests contrôlent les bloqueurs réels dans PostgreSQL, pas un simple délai supposé suffisant.

La concurrence inverse révèle aussi qu'un snapshot Serializable peut être fixé avant l'attente du cycle. Verrouiller seulement Player ne suffit pas : `setTarget` modifie l'état Gacha. R1060 suit désormais identités → cycle → Players triés → états Gacha triés → autorité. Un état modifié pendant l'attente provoque SQLSTATE 40001 **avant le backup**, y compris si la cible reste compatible. L'opérateur doit relire un nouveau plan puis réessayer ; aucun retry économique automatique ni écrasement de backup. Les tests couvrent UI/Chat, les deux ordres, cible conservée/retirée, absence de deadlock, replay de clé et absence de gain supplémentaire.

Audit des autres writers : Pull, votes et rotation prenaient déjà le cycle avant Player ; correction administrative via `AdminOperation` également. Ils restent inchangés. Bootstrap initialise une cible vide ; les écritures d'import personnel ne deviennent pas accessibles aux NATIVE. La répétition globale reste privée. Le contexte d'exécution Twitch ne prend pas de verrou transactionnel Player externe autour du store. Aucune règle Pull, pity, garantie, Capture ou économie modifiée.

### Horloge et fenêtre courante

Le candidat initial utilisait `input.now ?? new Date()` sans frontière suffisante. Le remplacement lit maintenant `clock_timestamp()` dans PostgreSQL. Une heure injectée exige simultanément le schéma effectif `batch_test_` suivi de 32 caractères hexadécimaux, une connexion PostgreSQL loopback et une Date valide ; sinon `PRIVATE_CLOCK_ONLY`. La protection concerne plan, application, replay et compensation. Une entrée publique ne peut donc pas antidater via ce paramètre.

La fenêtre source est relue après acquisition des verrous, avant et après le backup, puis après les écritures avant retour de transaction. Une expiration pendant le backup ou les écritures refuse/annule la transaction ; le backup reste préservé. Tests : heure réelle, injection privée autorisée, injection refusée sur le schéma public local sans mutation, vraie source expirée refusée et expiration aux deux frontières. La rotation normale du lundi à 00:00 Europe/Paris reste inchangée.

### Votes des historiques sans destination définitive

Les sources vérifiées du 08/10 contiennent quatre votes de membres des 43 : B est rattaché par preuve Twitch/import/R1055 ; trois autres n'ont pas de destination NATIVE définitive prouvée. Pour ces sources et l'état lu alors : **IMPORT 1 (B, Raiden), RETAIN 0, DEFERRED 3, aucune collision observée**. Ce constat ne remplace pas la relecture fraîche exigée lors d'une éventuelle application.

Le plan R1060 expose `legacyVoteDisposition` et transforme explicitement les exclusions non rattachées en DEFERRED. Toute présence différée produit `BLOCKED_VOTES` / `LEGACY_VOTES_REQUIRE_DECISION` et refuse l'application avant backup ou écriture. Un vote natif identique est RETAIN, une divergence ou une inéligibilité reste une collision bloquante. Les tests couvrent IMPORT/RETAIN avec différé et refus d'une liaison à un Player encore LEGACY. Aucun Player fantôme, rattachement par pseudo, double vote ou changement d'un résultat passé. Le planificateur générique de population conserve ses exclusions historiques, sans élargir les 43.

**Gate de future application :** ces trois votes ne peuvent pas contribuer au prochain lundi avec le mécanisme actuel sans preuves de rattachement définitif suffisantes ou une nouvelle décision métier et un mécanisme revu pour les non-NATIVE. Aucune pondération anonyme ou omission silencieuse n'est choisie. Le correctif peut être publié pour review ; l'application reste bloquée par cette gate, par la fenêtre courante et par les gates opératoires existantes.

### Vérification et arrêt du candidat corrigé

Résultats finaux réellement exécutés après correction :

| Contrôle | Résultat |
| --- | --- |
| `legacy-banner-replacement` : concurrence UI/Chat, horloge, votes différés, conservation, replay et compensation | 15/15 PASS |
| Invocation et BannerVote PostgreSQL | 33/33 PASS |
| Compléments communautaires, Event shop et paliers PostgreSQL | 32/32 PASS |
| Total PostgreSQL local privé | 80/80 PASS, codes de retour 0, aucun timeout |
| Prisma validate ; deploy/status des 64 migrations dans la fixture privée R1060 | PASS ; schéma à jour et contraintes physiques vérifiées |
| `verify:full` | 8/8 PASS, code 0 : 1 378 tests frontend, 1 984 backend non-DB, builds, typechecks, lint et deux diff-checks |
| Nettoyage des fixtures et contrôle des ajouts avant publication | Zéro schéma privé restant, zéro fuite des valeurs privées vérifiées, UTF-8 valide |

Logs complets de cette correction : `local-data/identity-resolutions/review-fix-20261009/`, logs R1060 `community-complements-20261008/db-b-verified-*` et `db-b-process-*` ; full sous `%TEMP%/gachaimpact-verify-full-CdSnWu/`. Les backups restent préservés. Le contrôle GitHub cumulé et ses preuves de publication sont distincts de ces tests locaux.

Aucun changement de sources, identités réelles, backups existants, infrastructure, migration publique ou armement. Les mécanismes Event, compensation, rétention, population et la migration 064 du candidat initial restent inchangés ; seuls le store, le remplacement, sa régression PostgreSQL et quatre documents sont corrigés.

**STOP avant main pour une nouvelle review indépendante ChatGPT de tout le diff cumulé `main...review` (candidat initial et correction).** Aucune promotion, migration 064 publique, restauration Event, remplacement public, commande Twitch, réimport NATIVE, batch 43 ou GLOBAL dans cette intervention. Event B reste une proposition 15/23 depuis 14/21, sans attribution ; les onze faits sociaux restent DEFERRED et `CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT` demeure mandatory.

<a id="sources-verifiees"></a>

## Sources vérifiées — lot B

Le ZIP exact est accessible : `C:\Users\axeld\Documents\Kichnifou\Twitch\Streambot\Data\package.zip`. Lecture du ZIP seul, sans source vivante substituée aux snapshots. Création/mtime filesystem le 06/10 à 15:01:46 UTC ;17 entrées vérifiées par taille et SHA-256. Toutes leurs bytes sont identiques aux sept bundles réels récents d'octobre utilisés par les imports. Les manifestes de **14 dossiers complets à 17 JSON** passent :10 captures réelles et 4 fixtures `retention-global-fixture-*`, ces dernières exclues des autorités métier. Le ZIP, tous les dossiers et backups sont préservés.

Captures réelles : deux du 26/09, `20261004T200232514Z`, `preflight-kichni-test-2026-10-06`, `controlled-canaries-2026-10-07` et cinq `ceo-separated-*` récents. La capture 04/10 et les deux 26/09 diffèrent des sept récents. Les sept bundles récents sont intégralement identiques : une date de dossier plus tardive n'est pas une nouvelle activité métier. Le hash canonique des 17 JSON est recalculé avec le parser existant, et rapproché à chaque import.

| Import réel | Instant UTC | Source exacte | Backup |
| --- | --- | --- | --- |
| Kichni_Test | 06/10 17:40:22.880 | `preflight-kichni-test-2026-10-06` | v1 ; bytes/provenance exactes |
| Mynonyme | 07/10 11:19:36.125 | `controlled-canaries-2026-10-07` | v2 ; bytes/provenance exactes |
| Kichnifou | 07/10 11:55:13.257 | `controlled-canaries-2026-10-07` | v2 ; bytes/provenance exactes |
| Céotryd | 08/10 12:30:27.792 | `ceo-separated-operator-20261008` | v3 ; hash canonique du backup recomputé exact |

Reports d'identité exacts retrouvés, notamment le rapport **resume** de Kichni_Test, différent de sa première prévalidation. Import IDs/Player IDs/Twitch IDs/snapshotHash/identityReportHash/backupHash sont confrontés sans publication de leurs valeurs. Les trois backups historiques ont en plus leur SHA-256 de bytes rapproché au contrôle précédent ; pour v3, intégrité canonique et provenance vérifiées, sans inventer une ancienne empreinte de fichier absente.

### Fraîcheur fichier par fichier

Dates internes ZIP ci-dessous en heure Paris, sans les assimiler à une borne commune de gameplay. « Diffère Git » décrit les bytes de la copie suivie, pas son âge métier.

| Fichier | Date interne ZIP | Diffère 04/10 | Diffère Git |
| --- | --- | --- | --- |
| banner_votes.json | 06/10 11:51:40 | oui | oui |
| c6_characters.json | 05/10 20:52:10 | oui | oui |
| combat_config.json | 03/06 15:22:12 | non | non |
| combat_data.json | 06/10 16:55:06 | oui | oui |
| contests_data.json | 05/07 10:53:06 | non | non |
| element_passives.json | 25/05 10:08:08 | non | non |
| friendships_data.json | 06/10 16:54:44 | oui | oui |
| genshin_characters.json | 05/10 08:17:08 | oui | oui |
| gift_codes.json | 31/05 13:06:28 | non | non |
| giveaway.json | 01/10 21:10:28 | non | oui |
| long_missions.json | 10/08 21:26:40 | non | non |
| missions_pool.json | 09/08 18:19:14 | non | non |
| monthly_boss.json | 06/10 16:55:06 | oui | oui |
| monthly_events.json | 30/05 10:49:54 | non | non ; fichier vide accepté par le parser |
| monthly_events_data.json | 06/10 16:54:16 | oui | oui |
| shop_items.json | 01/06 21:59:08 | non | non |
| viewers_data.json | 06/10 17:01:12 | oui | oui |

Dates métier :26/09 semaine 21/09,8 votants,Event septembre 12 participants/213 viewers ;04/10 semaine 28/09,7 votants,Event octobre 11 participants/216 viewers ; bundles récents semaine 05/10,**4 votes individuels/4 votants**,Event octobre 11 participants/217 viewers. Les dates Event récentes vont jusqu'au 06/10 12:59:13, celles des viewers jusqu'au 07/10 12:55:01. Certaines dates métier dépassent la capture ou le mtime ZIP : ces dates ne prouvent donc pas un cutoff universel. Comparer chaque fait à sa période et aux receipts natifs ; ne pas déclarer les fichiers Git tous obsolètes ni considérer le ZIP comme l'état actuel de production.

<a id="matrice-restauration"></a>

## Matrice source → définitif → cible → écart → règle

| Domaine | Source et cible | Constat vérifié | Règle/candidat |
| --- | --- | --- | --- |
| Identité Céotryd | Source Twitch importée → B via ID immuable, WebIdentity et résolution TWITCH R1055 | B ACTIVE/NATIVE ; A ARCHIVED sans accès. | Jamais choisir par pseudo, fusionner A/B ou réimporter la progression personnelle. |
| Event Céotryd | Octobre : joined,14 points,21 monnaies,palier 10 obtenu ; B actuel 1 point/3 monnaies | Import personnel a différé les faits Event ; six opérations natives terminées : inscription, bonus quotidien, trois essais B incorrects, succès A. Lecture globale des opérations : aucun succès B distribuant des crédits tiers. | Cible prévisualisée 15 points/23 monnaies ; delta+14/+20. Dédupliquer le bonus d'inscription natif+1 ; conserver bonus 08/10+1 et Jeu A+1 point/+1 monnaie. Palier 10 : marqueur LEGACY uniquement, paiement déjà compris dans le passé importé ; aucune nouvelle récompense. |
| Event autres NATIVE | Leurs sources exactes → Player vérifié | Kichni_Test/Mynonyme n'ont pas de participant source correspondant ; Kichnifou a un état/claims exigeant une autre preuve de rapprochement. | Aucun auto-enrollment/crédit. Le planner ciblé refuse ces cas. Montants et états détaillés privés ; pas de généralisation du calcul Céotryd. |
| Vote Céotryd | Semaine 05/10, choix Raiden → B | Source individuelle et agrégats concordants ; aucun vote natif B au contrôle. | Import une fois sur le cycle correspondant après remplacement R1060 ; autres votants non résolus restent différés, jamais inventés. |
| Autres votes | Quatre votes de source récente | Tous les votants appartiennent aux 43 historiques vérifiés ; les trois autres canaries n'ont pas de vote source à reprendre. | Bindings fournis par l'owner d'identité, y compris NATIVE. Votes identiques reconnus ; contradictoires bloqués. Semaine révolue : preuve historique, aucune injection dans le cycle actuel. |
| Bannière | Source 05/10 vs rotation native du même intervalle | Deux compositions distinctes ; tous les 10 personnages source existent au catalogue. Native :16 opérations/115 résultats B. | Priorité legacy R1060, sans réécrire les invocations. Dates exactes, origine LEGACY_UNKNOWN et génération inconnue conservées. |
| État personnel | viewers exact utilisé à l'import → B | Activité native postérieure et historique de présence acquis. | Aucun réimport NATIVE, rollback personnel depuis le backup pré-liaison, addition de ressources ou transfert de A. |

<a id="event-rapprochement"></a>

### Event : mécanisme ciblé et limites

`legacy-event-reconciliation.ts` prépare READ ONLY sous RepeatableRead/statement 5 s/transaction 30 s. Source et import sont liés par les preuves immuables et le choix R1055 effectif. Un premier receipt d'inscription créditée, ses snapshots et les receipts suivants reconstruisent la baseline native nulle ; chaque variation est contrôlée contre les règles de l'owner, puis contre les points/solde actuels. Pas de MAX ni addition de deux soldes. Les conversions natives vérifiables restent soustraites, sans annuler leurs ressources reçues.

Apply interne non exposé : opérateur canonique ADMIN/allowlist, configuration capacité OFF/GLOBAL false et autorité OFF/révision exacte, aucune opération PENDING/outbound PENDING ou incertain, verrouillage des identités, état B et édition, fingerprint frais, backup durable terminé avant première écriture, journal MigrationBatch et audit. Transaction atomique, rejeu sans second crédit. Claims legacy sans operation/paiement ; états quotidiens et acquisitions natifs conservés. Compensation exacte limitée à la postimage inchangée, journal/audits conservés ; après jeu nouveau, STOP.

Ce mécanisme **n'est pas un import Event général prêt pour tous les 43** : ancien mois, daily chevauchant la borne d'import, baseline incomplète, claims natifs, acquisition legacy non rapprochée, récompense de nouveau palier, succès B global sans ledger de membership, opération non supportée ou drift sont refusés explicitement. Points anciens jamais activés dans le mois courant ; monnaie saisonnière ancienne à traiter séparément selon l'owner Event. L'import initial des LEGACY reste l'owner existant ; les NATIVE sont protégés, puis leurs compléments suffisamment prouvés passent par le planner ciblé.

<a id="banniere-r1060"></a>

### Bannière R1060 : remplacement avec conservation de la rotation native

Composition prouvée :5★ **Chiori, Durin, Varesa, Yae Miko** ;4★ **Aino, Collei, Fréminet, Kaeya, Sayu, Yaoyao**. Fenêtre 05/10 00:00→12/10 00:00 Paris, soit 04/10 22:00→11/10 22:00 UTC. La source récente n'est pas une bannière périmée ; la composition concurrente native reste une preuve des invocations antérieures. Aucune autre bannière reconstruite par supposition.

La contrainte existante `starts_at` unique empêche deux objets de rotation distincts sur la même période. **Migration 064 nécessaire, candidate seulement** : `superseded_at`, unicité partielle des cycles officiels non remplacés, ancien index une seule ACTIVE conservé, CHECK remplacement⇒ENDED. La rotation native garde son UUID, dates, featured, votes et generationVoteSnapshot ; seules son statut et sa date de remplacement changent. Une nouvelle rotation legacy reçoit les mêmes dates et 10 featured exacts, génération inconnueNULL, provenance/source et référence à la native. Les 115 résultats et leurs FK restent sur la rotation native, sans aucun changement.

`legacy-banner-replacement.ts` : préparation READ ONLY, mêmes gates OFF opérateur, backup/fingerprint/journal/compensation. Le backup contient aussi la rotation native complète et les lignes personnelles protégées en JSON textuel, sans perte des int 8. Verrou de cycle 70422401 commun aux votes, scheduler **et invocations avant leurs verrous Player** ; périmètre des Players verrouillé pendant le remplacement. Cette sérialisation des pulls entre joueurs exige une attention de performance à la review ; aucun benchmark public revendiqué. Une dérive ou collision transactionnelle annule tout, sans replay automatique d'une action économique. Cibles compatibles conservées ; cible hors nouveaux 5★ effacée selon R109 uniquement pour les progressions non archivées, sans changer pity/garantie/Capture ni restaurer une cible personnelle source sur un NATIVE. Les états archivés restent strictement intacts ; un vote natif dont l'auteur n'est plus ACTIVE bloque la préparation, sans effacement silencieux.

Les votes natifs originaux restent sur la rotation native ; leurs copies sur le cycle officiel gardent choix, auteur, canal, date et référence à l'original. Les votes source prouvés se superposent une fois aux IDs définitifs : même choix retenu, autre choix ou choix natif devenu inéligible⇒conflit avant écritures. Votant legacy sans endpoint définitif⇒différé. Les agrégats source sont contrôlés et les agrégats natifs dérivés des ballots individuels. `applyLegacyBanner` réutilise une rotation compatible et inclut désormais les votes `personalImport=false`, sans réimporter leurs cibles/états personnels.

Le scheduler retrouve uniquement le cycle officiel non remplacé : aucune génération artificielle pendant cette semaine ; prochaine rotation normale au lundi 00:00 Paris, votes du cycle officiel consommés. L'historique public des bannières filtre les rotations remplacées avant count/pagination ; preuves natives et histoires personnelles d'invocations restent conservées. Pas de nouvelle UI ni message technique aux joueurs.

<a id="r1056-global"></a>

## R1056 / GLOBAL — preuve, ordre et limites

Les rapports historiques strictement valides du 05/10 rapprochés au snapshot 04/10 donnent la **même population de 43 IDs**,171 discarded/deuxquarantaines exclus ; Kichni_Test hors 43. Trois NATIVE actuels appartiennent aux 43. Reconstitution en mémoire de la membership historique pour audit, sans nouvelle sélection d'élément ni nouvelle autorisation de batch. Sur la capture récente 217 viewers, le profil supplémentaire Kichni_Test n'agrandit pas cette population.

Inventaire des sources :443 faits différés à classifier par owner, **285 Social/29 Boss/12 Event/31 Giveaway/4 Votes/82 Codes** ;88 paires/176 endpoints Social. Ces nombres décrivent la source entière, pas 443 faits autorisés à écrire. Onze faits d'amitié Céotryd restent DEFERRED, aucun materialized ; un seul endpoint Twitch public vérifié dans leur graphe, B. Peer proof/import manquants : conserver niveaux/cœurs/dates/usage directionnel, ne créer ni compte ni relation fictive. Collisions, blocages/révocations, quotas et daily anti-double-claim restent ceux de l'owner R1056 existant.

Boss : conserver dégâts/attaques/coups finaux et agrégats natifs ; source partagée et endpoint immuable requis avant contribution historique, sans ajouter deux fois des statistiques déjà importées. Event : séparer inscriptions/points/monnaie/paliers/daily/messages/acquisitions et résoudre les tiers ; succès B global nécessite membership prouvée. Giveaway : auteurs/participants/chatteurs/gagnant historique sans nouveau tirage/paiement. Concours : données anciennes de juillet, aucun concours courant d'octobre réveillé ni récompense rejouée ; locks quotidiens seulement dans leur période. Codes : preuves d'usage avant claims futurs, jamais nouveau paiement d'un ancien code ; distinguer ancien token/édition et reward natif déjà obtenu. Votes : semaine et ballot individuels, pas 171 fantômes ou deuxquarantaines.

Ordre futur : source/manifest + population historique→fresh identity proof→état définitif R1055 de chaque endpoint→rétention et backup des graphes protégés→préflight différenciant personnel LEGACY et NATIVE→faits partagés rapprochés par domaine→postconditions/compensation privées→review indépendante→mission publique distincte. Ne pas déplacer automatiquement un ancien fait économique vers un gagnant WEB dont la progression legacy a été abandonnée.

`CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT` reste **inchangé sur le propriétaire par défaut/public**. Deux plans opérateur présents (dont l'ancien expiré et le plan consommé) restent des preuves ; zéro relation legacy matérialisée réelle. Le planner borné `legacy-operator-retention-plan.ts` capture les preuves relationnelles et retourne BLOCKED, sans prétendre avoir vérifié tout le gameplay public. Une première capture trop large a atteint sa limite 30 s et a été remplacée par cette préparation bornée ; aucune écriture publique et aucune augmentation de timeout.

Adaptation candidate du même owner, **schémas `batch_test_*` uniquement** : conserver opérateur, A/B, tous endpoints de toutes versions sociales et leur fermeture FK, en plus des NATIVE/protections explicites. Vérifier schéma réellement connecté, fingerprint des preuves avant purge et lignes protégées après. Le chemin privé refuse public/faux schéma/drift et reste séparé de l'export par défaut bloqué. Tests privés de purge/rejeu/backup-restauration exacte et conservation des plans expirés/consommés, graphes et usage social. Cette préparation **n'active aucun cutover public ni batch 43** : réconciliation des autres domaines partagés et review de compensation restent des gates de 31B.

La restauration physique d'une fixture contenant un Player ARCHIVED utilise le helper de tests seulement : sur PostgreSQL loopback et schéma privé validé, il suspend transactionnellement les seuls triggers `archived_player_write_guard` du schéma, conserve FK/CHECK, restaure chaque mode de trigger avant commit et vérifie l'image exacte. Le test prouve qu'une nouvelle mutation ARCHIVED reste refusée après restauration. Aucune fonction/garde produit, rôle de réplication ou trigger public modifié ; ce helper n'est pas un mécanisme de restauration économique publique.

<a id="validation-du-candidat-et-stop"></a>

## Validation du candidat et prochaine reprise

Contrôles B/C exécutés sur PostgreSQL17 loopback, schémas privés isolés et nettoyés : neuf tests compléments Event/votes/rétention, quatre tests remplacement de bannière (16 opérations/115 résultats),17 tests réconciliation sociale ;33 tests Invocation/Votes et six tests Historique/backup. Les 13 tests opérateur social et 23 tests shop/paliers Event ciblés passés pendant ce lot restent acquis. Total 105 tests DB distincts pertinents, sans rejouer les 179 du bootstrap. Les nouvelles fixtures sensibles répètent les 64 migrations réelles et vérifient cleanup/pools fermés. Sauvegardes exclusives avec fsync, rejeu, compensation exacte et refus après gameplay/drift/conflit testés ; public/faux schéma et mutation ARCHIVED après restauration refusés.

`verify:full` : **8/8 PASS**,1378 tests frontend et 1984 tests backend non-DB, builds/typechecks/lint/diff checks. Le premier run avait une expiration du test frontend ChatPanel à 15 s ; run séquentiel sans tests DB concurrents réussi, sans changer son timeout ni prétendre une cause générale démontrée. Les erreurs initiales de fixtures et le défaut de compensation des ballots nouveaux (FK Restrict) sont corrigés et retestés ; les logs complets restent locaux/ignorés. Les assertions de replay Vote ancien cycle sont alignées sur le comportement déjà existant, sans modifier son service ; fixture Gacha initialise uniquement sa rotation privée si le catalogue local n'en contient pas.

Le lot A conserve ses 90 tests/8 étapes/8 captures GameShell et sa recette publique acquise. B n'ajoute aucune UI ; les projections officielles sont contrôlées en DB et par les suites frontend, pas par une nouvelle inspection authentifiée autonome. B/C restent **candidats techniques**, sans recette publique, correction économique ni répétition exhaustive de tous les domaines communautaires du batch 43. Après la dernière modification, typecheck/build backend et les trois tests purs de bannière PASS ; dernier remplacement PostgreSQL privé 4/4 PASS. Contrôle exact du diff/index avant commit ; vrais diff/blobs GitHub après push.

**STOP obligatoire après publication du candidat sur review et contrôle du vrai diff/blobs GitHub : review indépendante ChatGPT**, puis éventuelle mission dédiée de promotion/application. Main reste 01a9d14, production Prisma 63/CANARY 12 ;064 et mécanismes sensibles ne sont que candidats. Aucun import/OAuth/résolution R1055/commande Twitch historique, restauration économique publique, raccordement social public, batch 43 ou GLOBAL exécuté. L'application future devra recontrôler fraîcheur de source/semaine, ledger natif, fingerprints/backups, gates OFF avant correction, puis état effectif/transport CANARY après remise en capacité et tout redémarrage, avant un éventuel nouveau smoke explicitement autorisé.

Clôture publique READ ONLY : targets/imports/autorité strictement identiques à la préimage de l'audit, A ARCHIVED et B ACTIVE avec Web+Twitch exacts, quatre NATIVE/CANARY 12/capacitétrue/GLOBALfalse,63 migrations terminées et checksums LF canoniques conformes ; zéroPENDING/outbound en attente ou incertain. Les 16 opérations et 115 résultats natifs précédents sont conservés. Connexion du helper fermée ; ce constat PostgreSQL/configuration n'est ni un GET authentifié ni une nouvelle recette Twitch. Aucun redéploiement de B/C déclenché.
