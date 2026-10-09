# R1061 — Votes Twitch prouvés sans Player, candidat sensible

Décision propriétaire du 09/10/2026, prolongement de R1060. Baseline publique : `212da08e6b601d0bf5d83e550a5629ed90d21376`, Prisma 064. Le nouveau mécanisme et 065 sont candidats sur `review` ; review indépendante obligatoire avant promotion. Aucune migration, désactivation Twitch ou restitution publique effectuée dans cette mission.

## Autorité et preuves

Le registre dédié est nécessaire : `BannerVote.playerId` est obligatoire et ne peut représenter une preuve Twitch sans créer un Player. `ExternalBannerVote` conserve cycle exact, rotation FK RESTRICT, Twitch User ID numérique immuable, Character FK RESTRICT, hash du bulletin, provenance JSON, Player FK RESTRICT nullable, historique de rattachement et instant de gel. Les contraintes uniques portent sur cycle/Twitch ID et cycle/Player nullable. Les trois votants sans Player ne reçoivent ni identité applicative, ni progression, ni vote natif artificiel.

`verifyLegacyBannerVoters` reparcourt les 17 fichiers source bruts et les 17 historiques : hash du bundle et contenu parsé doivent correspondre. Le hash SHA-256 du fichier original `banner_votes.json`, le snapshot, la semaine, le personnage, le login historique normalisé, le hash de population, le rapport historique et le rapport frais sont liés au bulletin. Le propriétaire R1041/R1048 valide la classification intégrale **43 approuvés / 171 exclus / 2 quarantaines** ; aucun filtre d'élément ni élargissement implicite. Un rapport Helix frais, strictement limité à chaque votant, doit retrouver le même ID historique immuable. Rapport absent, ambigu, périmé, contradictoire ou source exclue : refus avant backup/écriture.

Les preuves et IDs réels restent dans `local-data/`, jamais dans Git. La prévisualisation vérifie les manifests locaux sans utiliser les copies GitHub d'août. La date de vérification des nouveaux rapports provient de PostgreSQL après lecture Helix, puis est confrontée à son heure réelle ; aucun ajustement de `input.now` public ni session navigateur fabriquée.

## Un seul comptage et un seul résultat

`bannerVoteContributions` est le propriétaire commun : un ballot natif se rattache à l'identité Twitch canonique ou aux aliases prouvés du registre ; un bulletin externe utilise le même ID. Même choix : un seul poids. Choix ou identité divergents : erreur explicite 409. Un Player sans Twitch garde son unicité native. Aucun rapprochement par pseudo et aucun transfert économique.

Consultation et vote UI/Chat/Twitch utilisent ce comptage. Un choix externe existant consomme le vote du Player ultérieurement lié : même choix retourne `alreadyProcessed`, autre choix est refusé sans créer une seconde ligne native. R1055 conserve son choix humain WEB/TWITCH ; une comparaison pending ne produit aucun nouveau rattachement. Son fingerprint inclut les preuves de vote : une clôture/modification entre présentation et choix exige une nouvelle confirmation sur le snapshot frais. Après choix terminal, le registre suit le gagnant vérifié, conserve les aliases de l'archive et refuse les collisions. Liaison vérifiée directe et replay terminal passent aussi par ce propriétaire. Le comptage reconnaît l'identité canonique même avant le prochain rattachement durable par Vote/R1055 ; un unlink n'efface pas le bulletin historique. Déplacement contradictoire sans résolution : refus.

Ordre : verrous d'identités triés, puis `70422401`, puis Players triés et autorité selon l'owner. R1055 prend Social avant le cycle et ses Players ; aucun chemin ajouté ne prend le cycle après un Player. Les transactions de vote restent Serializable avec retries bornés ; une bannière commitée pendant l'attente du verrou peut nécessiter un snapshot frais. Le trigger du registre prend aussi le verrou du cycle.

Le scheduler existant clôture avec les contributions dédoublonnées, persiste `closedVoteSnapshot` et gèle les preuves dans la même transaction. Sa seconde transaction utilise ce snapshot pour `selectBannerFeatured`, sans second moteur de rotation. Échec/crash entre les deux : reprise sur les mêmes compteurs et le même pool. Aucun nouveau vote après fermeture, même avec une heure de commande antérieure. Le rattachement ultérieur conserve le résultat figé. L'historique public projette les seuls champs agrégés existants, sans IDs/provenances privés. L'administration utilise les mêmes totaux et refuse d'ajouter à la composition un candidat déjà voté.

## Intégration R1060 et compensation

Le plan distingue `IMPORT`, `RETAIN`, `EXTERNAL_PROVEN`, `DEFERRED` et les collisions bloquantes. Une preuve complète sans Player ne bloque plus le remplacement. Sans nouvelle preuve, les anciens DEFERRED restent bloquants. Les votes natifs sont copiés avec provenance originale ; seul un vote source résolu vers un Player réel peut être importé comme `BannerVote` MIGRATION. Le registre conserve les quatre preuves, y compris celle résolue, et les dédoublonne avec les lignes natives.

Le remplacement garde les gates opérateur/OFF/capacité false/GLOBAL false/révision/PENDING/outbound, fingerprint frais, backup fsync avant mutation, transaction atomique, journal et postimage exacte. `r1061-banner-v2` et backup **version 2** distinguent ce contrat des anciens fichiers v1 conservés ; aucun ancien backup réécrit ou converti implicitement. Une preuve déjà enregistrée sur le cycle bloque une nouvelle opération indépendante ; le même operationId rejoué exige le journal et la postimage exacte et n'ajoute rien.

L'ancienne rotation devient ENDED/supersédée et conserve **toutes** ses opérations/résultats/FK. Une seule ACTIVE officielle reçoit les dix personnages legacy exacts. Seules les cibles devenues incompatibles sont vidées ; aucun gain, solde, pity, garantie, Capture ou historique personnel recalculé. Le fingerprint et les graphes couvrent tous les Players et tous les tirages présents, pas seulement les 16/115 d'origine. Le registre fait partie du hash de postimage : changement de vote, rattachement, gel, rotation ou nouveau gameplay interdit une compensation aveugle.

Compensation v2 : gates et fenêtre fraîche, postimage/journal/schema/hash exacts, suppression des seuls ballots/proofs de la nouvelle rotation encore non figée, restauration de l'ancienne ACTIVE et des cibles exactes, comparaison à la préimage, journal ROLLED_BACK. Les FK refusent tout nouveau tirage dépendant. Après expiration du cycle, STOP pour arbitrage ; aucune application, compensation ou replay mutatif antidaté.

065 est additive, RLS activée sans policy navigateur, droits PUBLIC/anon/authenticated révoqués et FK indexées. Le trigger interdit toute modification du choix/provenance/cycle et toute suppression d'une preuve gelée. Le propriétaire de purge classe explicitement la table et bloque sur `CUTOVER_LEGACY_VOTE_PROOFS_PRESENT`, y compris la rétention privée globale : aucun contrat de purge de ces preuves n'est autorisé. `CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT` reste prioritaire et inchangé. La compensation ciblée est distincte. Le helper de restauration physique privée ne suspend que les triggers d'archive et celui du registre, sur loopback et schéma batch exact, dans une transaction ; rétablit leur mode et toutes les lignes exactes, FK/CHECK toujours actifs. Aucun bypass produit.

## Prévisualisation du 09/10/2026

Lecture seule PostgreSQL/Helix et manifests : semaine `2026-10-05`, échéance `2026-10-11T22:00:00Z`, encore courante avec environ 62 heures au contrôle. Céotryd B ACTIVE/NATIVE, correspondance Player/Web/Twitch/R1055/import vérifiée : `IMPORT`. fred_night0wl, plumereveuse66 et kadraw18 : `EXTERNAL_PROVEN`, aucun Player lié à ces IDs. Quatre contributions Raiden calculables, zéro collision observée. Le mécanisme déployé reste l'ancien plan bloqué, sans registre 065 ; ce résultat est une prévisualisation du candidat, pas une restauration effective ni un fingerprint d'application.

5★ : **Chiori, Durin, Varesa, Yae Miko**. 4★ : **Aino, Collei, Fréminet, Kaeya, Sayu, Yaoyao**. La rotation native active contient désormais **28 opérations / 226 résultats**. Les lignes des **16 opérations / 115 résultats d'origine** correspondent exactement à la preuve précédente ; les tirages supplémentaires légitimes doivent également rester acquis. Relecture fraîche obligatoire avant toute application. Un poids de vote ne garantit pas que Raiden sera choisie.

## Validation du candidat

PostgreSQL local loopback uniquement, schémas `batch_test_*` distincts nettoyés. Les écritures de fixtures et de migrations sont privées ; aucune fixture ni migration publique. **151 tests DB PASS**, suites exécutées séquentiellement et logs complets privés :

| Suite | Tests réussis |
| --- | ---: |
| legacy-banner-replacement | 39 |
| banner-votes.integration | 3 |
| gacha | 30 |
| twitch-account-link | 32 |
| twitch-canonicalization-operator | 22 |
| canonicalization-safety | 6 |
| legacy-community-complements | 9 |
| moderation | 10 |

Le ciblé vérifie les quatre preuves dont trois sans Player, native identique/divergente, exclusions/hash/rapports, replay/journal, rattachement WEB/TWITCH après revalidation du consentement, archives/déplacement contradictoire, total public, concurrence, fermeture durable/crash/restart/rejeu, preuves figées et absence d'IDs dans l'historique public. Graphes exacts avant/après pour 16/115, possessions/copies et soldes/statistiques/progression non nuls, pity/garanties/Capture ; compensation exacte et refus après nouveau gameplay/rotation/rattachement. Migration 065 via Prisma deploy/status privés, RLS/grants/indexes, backup physique complet avec preuves closes/restauration exacte et triggers remis, refus public, mauvais fingerprint/révision, OFF/PENDING/outbound ambigu et véritable statement_timeout PostgreSQL avant mutation.

Prisma validate PASS ; **verify:full 8/8 PASS**, frontend 1 378/1 378 et backend non-DB 1 985/1 985, builds/typechecks/lint/diff-check. Deux contrôles globaux intermédiaires 7/8 sont conservés : mock de purge incomplet corrigé, puis ancien test frontend TTL120ms échoué sous charge et passé isolément sans changement (1 PASS, 90 autres tests du fichier non exécutés pour cette seule reproduction). Le dernier verify:full est complet et réussi, sans tests DB concurrents ni augmentation de timeout. Aucun test local ne vaut review indépendante, migration 065 publique, validation runtime après futur déploiement ou recette publique.

Preuves privées : `local-data/identity-resolutions/legacy-votes-20261009/`, logs de contrôles complémentaires sous `review-fix-20261009/` et logs verify:full dans le répertoire temporaire indiqué par leurs processus. Les anciens backups/snapshots restent préservés. Avant commit : confidentialité et diff/index exacts ; après push : vrai diff GitHub depuis main et blobs à vérifier dans les preuves de publication, sans recopier un SHA du commit dans son propre contenu.

## Mission opérateur ultérieure, non exécutée ici

1. Review indépendante ChatGPT du **SHA exact et du vrai diff cumulé depuis main**, incluant 065 et tous les owners. Corriger sur review si nécessaire ; aucune promotion par défaut.
2. Mission dédiée de promotion `review → main`, déploiements Railway/Cloudflare au même SHA et migration via preDeploy Prisma normal. Backup frais préalable au DDL ; registre/migrate status, RLS/grants/contraintes/triggers vérifiés. Aucune application métier par migration.
3. Après redémarrage : contrôles canoniques CANARY/configuration/PostgreSQL/Helix et transport effectif ; nouvelle gate humaine seulement si nécessaire. La confirmation F5 du checkpoint 212da08 est acquise et n'est pas réutilisable comme preuve d'un nouveau runtime.
4. Autorisation métier **distincte** de restituer la bannière et ses quatre votes, dans la fenêtre réelle. Conserver les snapshots/manifests/backups et les nouvelles preuves Helix ciblées ; ne pas relancer import, OAuth, choix R1055, ancien smoke, batch43 ou GLOBAL.
5. Revalider source, cycle, identité B et les trois IDs Twitch, population fixe, composition, nouveaux tirages/votes natifs et collisions. Si lundi dépassé, résultat déjà figé, preuve périmée/insuffisante ou collision : STOP, nouvel arbitrage, aucune antidate.
6. OFF par le mécanisme canonique avec la **révision fraîche** ; attendre le drainage et l'absence de PENDING, receipt engagé, outbound PENDING/SENDING/AMBIGUOUS et opération/lock en cours. Ne jamais reconstruire les targets canary.
7. Désactiver de manière contrôlée la seule capacité commandes selon le contrat de réparation ; GLOBAL false. Vérifier le déploiement, desired/effective OFF et les quatre NATIVE persistées. Configuration désactivée et contrôle SQL ne valent pas preuve fabriquée de session HTTP.
8. Backup durable complet frais et preuves v2 ; recalcul immédiat du plan/fingerprint avec les 17 fichiers et les quatre rapports frais. Sauvegarder ces preuves privées, puis vérifier de nouveau OFF/révision/temps/absence de dérive. Ne jamais réutiliser le fingerprint de cette prévisualisation.
9. Appeler une fois l'owner interne `applyLegacyBannerReplacement`, operationId UUID stable, acknowledgement exact, config réelle, sans `input.now` public ; callback de backup privé exclusif/fsync et vérification du fichier avant retour. Aucun endpoint/commande/CLI public n'est ajouté par ce candidat.
10. Réconcilier un timeout ou retour ambigu **par journal et postimage**, jamais en lançant un nouvel operationId. Postflight exact : une seule ACTIVE legacy, ancienne rotation conservée avec toutes les FK/tirages, quatre preuves/poids au maximum une fois, totaux natifs+externes, cibles seules autorisées, aucun gain/solde/statistique réécrit. En cas de dérive, STOP ; compensation uniquement v2 encore admissible, sinon diagnostic.
11. Remettre la capacité, valider le runtime puis reprendre **l'ensemble canary persisté** avec l'owner canonique et la nouvelle révision ; jamais un second extendImportedCanary ou une liste reconstruite. Revalider état effectif **et transport** après remise en service/redémarrage, avant tout éventuel smoke nouvellement autorisé.
12. Recette humaine ciblée si demandée : composition/votes/historique et compte, sans ancien message Twitch rejoué. Lundi, le scheduler normal ferme/génère une fois avec son snapshot durable ; vérifier la continuité sans forcer un personnage gagnant.

Event reste séparé : source 14/21, dernière cible proposée 15/23 à recalculer, palier 10 sans second paiement. Onze faits d'amitié différés ; A ARCHIVED/B ACTIVE/NATIVE, quatre canaries et population fixe conservés. Aucun changement d'ordre de roadmap.
