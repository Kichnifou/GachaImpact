# Stabilisation Supabase et corrections joueurs — R1065

## Périmètre et état du candidat

Mission consolidée du 09/10/2026, base main `32128cc` / review documentaire `5914d9c` conservée. GLOBAL demeure actif ; aucune migration, réparation économique, suppression, configuration de pool/timeout/fréquence ou dépense. StreamElements reste inchangé. Le candidat est désormais déployé et les recettes visibles sont acquises ; les sections initiales gardent leurs mesures et étapes historiques. Le résultat effectif et ses limites figurent dans la dernière section. État d'exécution courant au [Master](../master/PROJECT_MASTER_PLAN.md).

## Mesures réelles et limites

Projet Supabase `rmkpjudimoibyjsjtubh`, plan de l'organisation fraîchement retourné **Free**. Les limites documentées sont 500 MB de base par projet, 1 GB Storage et 5 GB egress par organisation : [tarification officielle](https://supabase.com/docs/guides/platform/billing-on-supabase). Les consommations facturées Storage/egress et les dashboards ne sont pas accessibles par les outils utilisés ; aucune extrapolation mensuelle ni économie financière chiffrée.

Capture PostgreSQL publique explicitement READ ONLY du 09/10, vers 20:32–20:42 UTC :

| Mesure | Observation |
| --- | --- |
| Base complète | 77 753 491 octets, environ 77,75 MB / 74,15 MiB, 15,55 % de 500 MB décimaux |
| Tables public, 144 | 38 461 440 octets, index inclus |
| Schéma privé préexistant, 140 tables | 5 685 248 octets ; conservé, aucune purge |
| Connexions instantanées | 18 / max_connections 60 : une active, quinze idle Client, deux Extension |
| Transactions >10 s / attente de verrou active | zéro à l'instant de la capture ; pas un maximum historique |
| Tables les plus volumineuses | receipts Twitch 5 758 976 ; résultats de tirage 5 480 448 ; opérations 3 473 408 ; Arcade receipts 3 203 072 octets |
| Storage SQL | agrégat NULL ; ne prouve ni une facture nulle ni un egress nul |

`pg_stat_statements` couvre depuis le **07/10 à 18:25:17 UTC**, pas sept jours ni exactement 24 h ; 4 979 signatures et 14 évictions. Les durées sont des temps PostgreSQL, pas des latences HTTP bout en bout. Quelques chemins :

| Requête | Appels cumulés | Moyenne |
| --- | ---: | ---: |
| Lookup notification par clé | 45 257 | 0,127 ms |
| Réécriture payload/action notification | 45 116 | 0,900 ms, 40 600,63 ms cumulées |
| Résolution de notifications expirées | 43 135 | 0,044 ms ; zéro ligne, contrôle conservé |
| Derniers messages Chat | 21 673 | 0,031 ms |
| Session | 3 735 | 0,557 ms |
| Heartbeat | 3 425 | 1,479 ms |
| Progression | 1 292 | 0,146 ms |

Les lectures Home réconcilient les Codes et expliquent le chemin d'écriture systématique observé. Les longues lectures de graphes de sauvegarde/rehearsal et requêtes de métadonnées restent distinctes du jeu. Les compteurs généraux cumulatifs incluent un deadlock et 25,46 GB temporaires, sans date ni attribution démontrée à une action joueur. Aucune modification aveugle de pool, scheduler, présence/XP ou timeout n'en est déduite.

Sept fenêtres contiguës de 24 h ont été interrogées une fois, du **02/10 20:00 au 09/10 20:00 UTC** :

| Source logs | Dernières 24 h | Sept jours |
| --- | ---: | ---: |
| Supavisor | 19 441 | 187 691 |
| PgBouncer | 11 599 | 81 003 |
| PostgreSQL | 646 | 83 972 |
| PostgREST | 42 | 48 114 |
| Auth | 148 | 1 322 |
| Edge | 144 | 1 179 |
| Audit Auth | 44 | 462 |
| Storage / Realtime | 2 / 2 | 20 / 17 |

La disponibilité de ces fenêtres ne garantit pas une rétention contractuelle au-delà. Sur 24 h : trois événements Supavisor ERROR non attribués faute de détail accessible, un PostgreSQL LOG `08006`, aucun PostgreSQL ERROR/FATAL dans l'agrégat ; 126 réponses Auth avec statut, toutes 200, et 22 entrées sans statut. Les durées Auth brutes ont une unité non confirmée et ne sont pas publiées comme millisecondes. Un échantillon Railway plafonné à 100 entrées contient un timeout Prisma P2028 antérieur ; ce plafond ne permet pas de comptabiliser tous les incidents d'une journée. Les avertissements de dépréciation pg et les messages Prisma sur stderr ne sont pas assimilés à des erreurs métier. Aucun incident ou bénéfice de latence n'est inventé.

## Optimisation mesurée et bornée

La réconciliation des Codes relisait id/state puis réécrivait chaque notification existante, même identique. Elle sélectionne maintenant aussi payload/actionKey/actionTargetId dans **la même lecture**, compare leur contenu canonique et évite l'UPDATE identique. Une notification RESOLVED est toujours réactivée selon le contrat existant ; créations, modifications, suppressions logiques, claims, résolution et verrous restent inchangés. Aucun cache ni changement de fréquence.

Avant : chemin inconditionnel et 45 116 UPDATE réellement observés. Après en PostgreSQL privé : cinq réconciliations séquentielles et deux concurrentes d'une notification inchangée conservent son `xmin` ; une modification réelle du titre change sa version. Tests unitaires UNREAD/READ/ARCHIVED/RESOLVED : cinq répétitions, zéro update inutile pour les trois premiers états, réactivation conservée pour RESOLVED. Gain démontré : suppression des écritures identiques, pas une réduction globale d'egress ou une P95 publique anticipée. Une mesure après déploiement reste requise.

EXPLAIN JSON du lookup utilise `notifications_deduplication_key_key` (Index Scan, estimation une ligne, coût 0,27–2,49). Aucun nouvel index justifié pour cette optimisation. Les advisors signalent 46 FK public sans index couvrant et 85 index public inutilisés dans leur fenêtre ; ces informations ne justifient pas à elles seules une création/suppression. Les trois doublons d'index concernent uniquement le schéma privé préexistant.

## Sécurité et observations conservées

Les 144 tables public ont RLS sans policy, conformément à l'accès backend seul ; droits navigateur contrôlés par le postflight Prisma. Trois fonctions trigger public ont search_path mutable, sont SECURITY INVOKER et exécutables seulement par postgres selon leurs ACL relues. L'advisor signale aussi `rls_auto_enable` SECURITY DEFINER/exécutable : signature réelle **event_trigger**, search_path `pg_catalog`, fonction d'activation RLS ; son signalement ne démontre pas une RPC normale exploitable. Aucune ACL ou fonction n'est modifiée implicitement. La protection des mots de passe compromis est signalée désactivée ; Auth R1058 et ses possibilités de plan restent un lot distinct, sans upgrade. [Linter officiel](https://supabase.com/docs/guides/database/database-linter).

Changelog et documentation officiels relus fraîchement, fichiers privés conservés : aucune dépréciation applicable imposant une nouvelle infrastructure dans ce lot. Les receipts, opérations, audits, historiques, sauvegardes et snapshots sont préservés intégralement.

## Correctifs et contrôles

Alias `!votes` dans le registre unique et son Help ; Banque utilise le formateur français BigInt partagé ; Quotidiennes distinguent Faveur inactive/aucun ami des vrais blocages ; `!sac` ajoute la Stella positive en dernier depuis l'inventaire déjà chargé. XP Chat/Twitch partage une présentation française du plan réellement exécuté, capture les seuls soldes récompensés sous verrou Player et gèle la réponse Twitch. Aucun changement d'XP, RNG, cooldown, seuil, récompense ou idempotence. Limite Twitch 450 mention incluse, continuations logiques.

Campagne PostgreSQL privée **106 PASS, un contrôle de métadonnées exclu**, migrations 68 appliquées : Codes enrichis 24, anciens Codes 6, pilote Twitch 28, Chat 48. Le contrôle exclu avait échoué : migration 035 enregistrée en CRLF dans l'ancienne base privée, hash `7e5862fe…` contre canonical LF `29d7e56c…`, cause reproduite en lecture seule sans réécriture du registre. Il n'est pas annoncé réussi ; les **68 checksums LF publics** et `prisma migrate status` sont vérifiés séparément avec succès. Les essais de connexion et assertions de fixture initialement échoués sont conservés avec les corrections ; aucun échec masqué.

`verify:full` 8/8, campagnes de non-régression et rendu synthétique du GameShell/CSS : seize états Codes existants et huit états bonus/Quotidiennes, quatre viewports 390/1366/1920/2560, F5, aucune API publique ni mutation. Captures desktop/mobile inspectées. Les tests dédiés couvrent minuit Paris/DST/masques/erreurs, votes contradictoires tous canaux, redelivery, Stella après claim/consommation et XP normal/max/multiple/retry/cooldown. Ces preuves ne valent pas une recette humaine publique.

Preuves privées : `local-data/identity-resolutions/r1065-20261009/` (mesures RO, sept agrégats, logs complets, captures et backup applicatif listé/intégralement décodé/fsync, sans restauration). Snapshot initial 144 tables/44 historiques : SHA-256 `cea89290d265256ee6e909f0f233fb81098edc70cf6b4d2940ac0429411e0796`. Contrôle public Prisma 68 : `dcd66b1c0cf8840429bcf5efed3ce2141586408e99059984db6646e6661e8c23`. Aucun fichier privé ou secret publié.


## Résolution du build Docker Hub

Le candidat 706bcfd a reçu APPROVED indépendant (32 vrais blobs GitHub, 37 tests serveur et 112 frontend distincts), puis a été promu par fast-forward strict main. Cloudflare a522a38e-a345-4219-bc59-320da2a32ba5 SUCCESS, assets publics identiques. Les quatre builds Railway échouent **avant compilation** sur HEAD registry-1.docker.io/v2/library/node/manifests/24-alpine, HTTP 429. Déploiements : 4b9b7d66,3c9d68e6,7c34be76,db765ec4 ; le dernier retry main est demandé explicitement par le propriétaire. Aucun npm/build/Prisma/preDeploy de R1065 n'a encore été exécuté par ces tentatives. Ancien 32128cc reste Online/GLOBAL.

La même requête anonyme HEAD depuis Codex reçoit200. Cela prouve l'existence et l'accessibilité locale de l'image, pas l'état du réseau Railway. Docker distingue limites de pulls et limitation anti-abus ; les plateformes peuvent partager une IP sortante. Hypothèse : limitation du trafic constructeur Railway, qui apparaît sous le même identifiant dans les quatre logs. Les en-têtes de sa réponse ne sont pas disponibles : aucun quota, délai de reset ni compte responsable n'est inventé. Les statuts officiels Docker et Railway sont opérationnels au contrôle ; ils n'excluent pas un incident isolé. [Docker429](https://docs.docker.com/docker-hub/troubleshoot/), [attribution/limites](https://docs.docker.com/docker-hub/usage/pulls/).

Résolution proposée sans nouvelle infrastructure : miroir **officiel Docker**, publié sur ECR Public en partenariat Docker/AWS. Accès public sans compte, aucune base/région/service/plan ou dépense provisionnée. [Provenance officielle Docker](https://www.docker.com/blog/news-from-aws-reinvent-docker-official-images-on-amazon-ecr-public/), [accès public AWS](https://docs.aws.amazon.com/AmazonECR/latest/public/public-gallery.html). Les deux FROM du Dockerfile emploient public.ecr.aws/docker/library/node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1. L'index complet des deux registres a été téléchargé, SHA-256 recalculé et octets comparés ; manifeste linux/amd64 idem, digest 83f1c388c31fb2e51f7cbd4dea949b96260798c98f206e8e4696bc93bd964e3a, configuration et quatre layers référencés identiques. Aucun layer complet téléchargé pour ce contrôle ; aucun secret/token persistant. Preuve privée official-image-equivalence.json. Le digest protège le build contre une divergence ultérieure du tag ; son renouvellement suivra une mise à jour explicite et reviewée de l'image, pas un nouveau moteur économique.

La correction n'altère ni Node/Alpine sélectionnés au moment du contrôle, ni les étapes/build contexts/npm, ni le code métier. Elle nécessite sa propre review du vrai SHA publié avant promotion. Son déploiement réussi, la mesure publique après optimisation et la recette ne sont pas anticipés.

Postflight intermédiaire de l'ancien backend : capture snapshot-GLOBAL-1791580349359.json après les deux premiers échecs, avant les deux derniers ;139/144 tables exactes,54 Players/44 historiques conservés.70 nouvelles opérations =24 message+24 complete+22 presence ;26 receipts dont24 PROCESSED et2 RECEIVED métadonnées seules, sans intent. XP+9/+6/+7 sur22 messages normaux, deux commandes sans mutation ; deux heartbeats. Aucun mouvement économique, claims/domaines/identités inchangés. Audit indépendant 151/151 PASS, preuve reviewer-postflight-independent.json et rapport review-postflight-blocker-independent.md (84616ca95368226e70a892d6ed96541e5d1eb9c05046c03c79d51092a08a9cf2, établi après trois échecs). Prisma 68/transportGLOBAL recontrôlés ; health 200 en 238 ms sur un appel. Ces observations ne valent pas un postflight du nouveau code.

L'API métriques HTTP Railway a retourné 37 634 requêtes, zéro 5xx et 47 erreurs client pour une fenêtre demandée de 24 h, 18 buckets exposés : pas de couverture complète garantie ni de confusion avec l'échantillon plafonné des logs. Aucun gain de latence/egress public attribué à l'optimisation non encore déployée. Backup applicatif 3 234 275 octets, listé/décodé/fsync, SHA-256 4b96f963f7709ef05db87e56cbb8b602012535a2f6e2091d7d72e8ad5ba72944 ; pas de restauration.

## Déploiement et recette R1065 effectivement obtenus — 09/10/2026

Après review indépendante APPROVED de 2aa7dd5 (quatre blobs GitHub et téléchargement/hash indépendant des deux manifestes), fast-forward strict main et contrôle des refs distantes, Railway ca2ae190-c788-4e22-bc55-8f28d472b1f6 a terminé SUCCESS au SHA 2aa7dd584effa421ff804dcd850ab3bbcdc9d8ff. Compilation et génération Prisma normales, service Online 1/1, zéro replica crash/avertissement actif/pending work. Quatre builds échoués demeurent dans l'historique récent/hasIssues ; ils ne sont pas effacés ni présentés comme une panne du nouveau déploiement. Cloudflare 80ff253d-44a0-4c93-bfb5-86807ec2c905 SUCCESS au même SHA ; JS/CSS live et preview byte-identiques. Health 200, 182 ms sur un seul appel, sans prétention de P95.

Prisma 68/checksums LF/status et transport canonique GLOBAL 19/Chat ACTIVE sont fraîchement conformes. Le propriétaire confirme après F5 les six indications runtime GLOBAL ; aucune session ou preuve HTTP authentifiée inventée. Snapshot avant nouveau déploiement 1791581101004 (71f1db608ab1974f5183e6650c0899ade36ea9cc0d6838aa406f5e8922718e70), après 1791581531120 (e4d8edf070e3900a815f5bf884fd2f351048fc3591d1a0536224f5e846cc690b). Comparaison primaire 9 807 contrôles PASS ; audit indépendant 175/175 PASS : 139 tables identiques/5 écarts attribués, 54 Players/44 historiques, 45 targets NATIVE, Céo A ARCHIVED et Céotryd B ACTIVE/NATIVE/R1055 conservés. Un vrai message explique trois opérations COMPLETED, +1 XP/+1 compteurs et un receipt PROCESSED ; deux heartbeats seuls. Zéro mouvement économique, 86 claims/29 paliers/150 opérations de tirage/1 382 résultats conservés. Rapport indépendant review-final-postflight-independent.md, SHA-256 e2202a4f58422d1963eb9a42bde0a9f381bd22063c83355d420c95d1b9a33e58.

**Mesure après optimisation en production :** fenêtre naturelle 21:31:34.876–21:32:59.645 UTC, nouveau lookup étendu +168 appels, ancien UPDATE payload/actions +0 ; six autres signatures interrogées +0. Delta recalculé indépendamment depuis query-live-start/end.json, preuve query-live-delta.json. Le gain est la suppression du chemin de réécriture identique ; aucun benchmark synthétique public, aucune causalité globale de latence/egress/coût extrapolée.

Échantillon HTTP après démarrage : 101 entrées plafonnées, 50 réponses 200/51 OPTIONS 204, zéro 4xx/5xx ; 44 GET unread, six heartbeats et un EventSub. Les totalDuration natifs ne sont pas convertis sans unité confirmée. L'API Railway de percentiles, explicitement en ms, expose trois buckets strictement après démarrage : EventSub P95 2 732/2 097/1 184 ms (21:31/32/33 UTC), avec faible trafic et sans preuve de baisse causale. Les buckets antérieurs culminent à 5 000 ms ; ils restent distingués. Preuves railway-logs-final-summary.json et latency-live-metrics.json.

Le propriétaire confirme la distinction gains directs/bonus CADEAU_PHASE1 et l'aperçu Codes, sans anomalie, puis !votes/!banque/!sac. Trois nouveaux IDs, hashes exacts des textes, args vides, receipts PROCESSED, réponses SENT/IDs Twitch : maximum 47/156/190 caractères avec la mention réservée, Stella positive en dernier, Banque française, aucun contenu de secours ou perte signalée. Ces consultations ne valident pas un franchissement XP public ; les tests XP/Quotidiennes restent privés et synthétiques quand aucune action réelle applicable n'est observée. Aucun claim, gain XP forcé, achat, tirage ou vote avec argument de recette.

**Capture après la recette :** snapshot RO 1791581793070 (SHA-256 7c5f3ad9b4a50bd6072db5f00b4664bfa3d49c03f5d5359f539bb386c4ab37a0), 9 882 contrôles primaires PASS, 135 tables exactes/9 écarts ; 75 opérations COMPLETED et 34 receipts, zéro mouvement de ressource. Une commande Stella volontaire d’un autre joueur, distincte des trois consultations, consomme une Stella (1→0), augmente une copie (18→19) et Intelligence C6 (2→3), conformément à son unique opération/resultSummary/receipt SENT. Le stock Kichnifou reste deux Stella. Les autres écarts relèvent de présence/XP, sessions et refresh automatique du credential Twitch existant (identité/scopes/reward inchangés). Aucune absence globale de mutation économique n’est déduite du seul zéro mouvement de ressource.

Cette clôture documentaire est poussée sur review ; production/main reste 2aa7dd5 pour éviter un redémarrage uniquement documentaire. GLOBAL et StreamElements restent inchangés, snapshots/backups conservés ; prochain domaine R1053 sous mission dédiée.
