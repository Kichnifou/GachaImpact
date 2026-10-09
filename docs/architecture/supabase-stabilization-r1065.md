# Stabilisation Supabase et corrections joueurs — R1065

## Périmètre et état du candidat

Mission consolidée du 09/10/2026, base main `32128cc` / review documentaire `5914d9c` conservée. GLOBAL demeure actif ; aucune migration, réparation économique, suppression, configuration de pool/timeout/fréquence ou dépense. StreamElements reste inchangé. L'implémentation et ses preuves ci-dessous précèdent la review indépendante, la promotion et la recette publique : leur succès n'est pas anticipé. État d'exécution courant au [Master](../master/PROJECT_MASTER_PLAN.md).

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
