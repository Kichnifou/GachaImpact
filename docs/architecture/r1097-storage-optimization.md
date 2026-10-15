# R1097 — nouvelles écritures Twitch et Gacha

Mandat propriétaire du 15/10/2026, lot A non destructif. Baseline approuvée `c8b55d3c63ff9ca27159ab227f6aeeb74ff5fdd1` : origin/main = origin/review, divergence 0/0, arbre propre ; review locale avancée de 16 commits par fast-forward. R1097 libre. Prisma : 82 migrations, aucune inachevée, status à jour et trois colonnes JSONB présentes. Aucune migration, purge, Cron, modification de gameplay ou réécriture historique.

## Stockage Gacha

Choix délégué par le mandat : une colonne/table supplémentaire imposerait une migration inutile ; `BusinessOperation.resultSummary` existe et termine déjà la même transaction Serializable. Pour count > 1, il reçoit `gachaSnapshotVersion: 2` et une seule `activeTeam` (teamId, elements, effects originaux). Chaque PullResult reçoit `snapshotVersion: 2, activeTeamRef: 'operation'` à la place de sa copie Team. États avant/après, effets appliqués, totaux, bonus et C6 inchangés. x1 reste inline : aucune répétition à éliminer, le format v2 y ajouterait du volume. Aucun SELECT, UPDATE ou résultat supplémentaire.

DTO, historique et replay utilisent les effets calculés persistés, jamais la Team pour recalculer l'économie. Ils gardent les mêmes lecteurs/sorties. `readGachaActiveTeam(snapshot, summary)` reconstruit la preuve pour les deux formats ; référence inconnue/incomplète refusée sans Team actuelle. Aucun nouveau snapshot public. Une ancienne instance peut lire les résultats économiques v2 et écrire inline. Un rollback Gacha doit conserver le lecteur d'audit compatible, sans réécrire les preuves v2.

## Stockage Twitch

Retrait de lectures, mutualisation entre opérations et fusion message/complete/Event écartés : sémantiques de reprise distinctes. Seul `intent.reads` est encodé sans perte ; le tagged tree Date/BigInt/undefined reste strictement réversible. Format `{encoding:'brotli-base64', version:1, bytes, sha256, data}` ; Brotli natif Node qualité 4, aucune dépendance. Admission ≥2 Kio, ≤16 Mio, économie logique ≥20 % et ≥256 octets ; sinon format historique. Décompression bornée à la longueur déclarée ≤16 Mio, SHA-256 et longueur vérifiés, JSON puis Zod existant. Corruption/version inconnue : échec fermé sans lectures live de secours.

Décodage central dans le schéma du pilote. Enveloppe version 1, phases, statuts, réponses exactes/ordre/fullText/IDs, identités, clé, hash, temps, mutation, cibles et références Event gardent leurs chemins. SQL/Prisma de drainage/anti-écho et barrières/verrous inchangés. Toute sauvegarde conserve les lectures initiales encodées ; une ancienne intention reprise reste inline. Différence de lectures figées refusée. Aucun détail retiré avant 30 jours.

Gzip étudié puis écarté : Box synthétique JSON 40 293 → 3 021 octets mais JSONB 3 094 → 3 123 octets, TOAST compressant déjà les répétitions. Brotli qualité 4 fait mieux ; aucun gain uniforme sur tous les receipts n'est promis.

## Déploiement et rollback

`TWITCH_INTENT_COMPRESSION_ENABLED=false` par défaut. Déployer tous les lecteurs R1097, vérifier SHA Railway, réplique saine et absence d'ancien processus ; activer ensuite uniquement cette variable sur le service existant, attendre son redéploiement et recontrôler le même SHA. Aucun frontend touché. Une instance pré-R1097 ne comprend pas l'encodage : ne pas activer en sa présence. Pour retirer le writer, variable false puis garder le lecteur R1097 pour les intentions déjà encodées ; revert aveugle pré-R1097 incompatible. Aucune conversion des données autorisée.

## Mesures et qualification

`tests-db/r1097-storage.test.ts` utilise seulement des payloads synthétiques dans un schéma privé unique, accès navigateur révoqués, supprimé en finally. `pg_column_size` mesuré après insertion, TOAST applicable ; taille physique de deux tables dédiées, 100 exemplaires par fixture, sans index métier. Gacha mesure summary/snapshots, pas les colonnes relationnelles. Mesures dans `evidence/r1097-storage-measures.json` après qualification. Ni disque de production, ni extrapolation aux historiques, ni réduction globale immédiate.

Nombre d'écritures/lignes identique : Twitch étapes existantes ; Gacha count résultats + une finalisation du résumé. Le benchmark de payload ne mesure pas toutes les transactions métier. Aucun gain de latence réseau/DB ou facture revendiqué. Tests unitaires de codec/reprise, résolveur partagé et suites PostgreSQL métier portent les autres invariants ; tests locaux, reviews, déploiements et recette humaine restent distincts au Master.

Mesure finale privée du 15/10, octets ; JSONB = datum stocké après insertion, pas taille relationnelle de production :

| Fixture | JSON avant → après | JSONB avant → après | Gain JSONB |
| --- | ---: | ---: | ---: |
| Twitch courte / sans réponse complémentaire | 357 → 357 / 180 → 180 | 463 → 463 / 241 → 241 | 0 % |
| Twitch Box volumineuse | 40 293 → 2 423 | 3 094 → 2 527 | 18,3 % |
| Twitch lectures multiples | 80 324 → 2 451 | 5 634 → 2 555 | 54,6 % |
| Twitch mutation | 40 361 → 2 491 | 3 168 → 2 610 | 17,6 % |
| Twitch multisegments | 45 601 → 7 731 | 3 729 → 3 357 | 10,0 % |
| Gacha x1, Team vide/partielle/complète | inchangé | inchangé | 0 % |
| Gacha x10 Team vide | 3 869 → 1 773 | 5 456 → 2 680 | 50,9 % |
| Gacha x10 Team partielle | 4 069 → 1 793 | 5 696 → 2 700 | 52,6 % |
| Gacha x10 Team complète | 5 119 → 1 898 | 7 536 → 2 888 | 61,7 % |

Pour les quatre fixtures Twitch volumineuses, encodage 0,89–1,35 ms et décodage 0,76–1,25 ms sur un échantillon local Node 24.19.0, hors validation Zod et requêtes ; aucun percentile ni comparaison runtime serveur. Deux tables synthétiques (100 copies/fixture, mêmes nombres de lignes) : **4 284 416 → 2 662 400 octets**, soit 1 622 016 octets/37,9 % dans ce montage seulement. Les montants Gacha concernent exclusivement les champs JSON ciblés. La preuve conserve les valeurs exactes, algorithmes comparés et compteurs.

Les premiers runs ont détecté des attentes de harnais obsolètes et délais trop courts : réutilisation du helper d'isolation obligatoire, délais de bootstrap/cleanup privés adaptés, attente Syntaxe alignée sur le préfixe ⚠️ déjà présent à la baseline. Une connexion abandonnée par un run interrompu a été attribuée exclusivement à son schéma privé puis fermée, schéma supprimé ; aucune connexion tierce interrompue. Reprises ciblées et résultats exacts dans la qualification. Toutes les assertions économiques restent présentes et les deadlines des propriétaires de production inchangées. Aucun échec n'est qualifié arbitrairement de flaky.

## Livraison et postflight

Livraison du 15/10/2026 : code qualifié `9e2b3b4919203aecc307cdee9f69a5965f9bdce1`, deux reviews indépendantes APPROVED (code et delta documentaire). Lecteurs Railway `93233a82-db76-4288-bd35-2ccfc4b6d991` SUCCESS et ancienne instance REMOVED avant ajout de la seule variable writer à true ; activation `928b31d9-040d-41a9-983e-0254eb00b82c` SUCCESS au même SHA. Une réplique saine, aucun pending/incident ; Cloudflare automatique et assets exacts PASS. Health 200 et 18 gardes anonymes PASS. Postflight SQL read-only à 16:14:31 UTC : cohortes historiques identiques, ledger 82, autorité GLOBAL/révision 19, zéro référence rompue. Zéro nouvelle opération publique dans les nouveaux formats à cet instant ; aucune action publique provoquée. Les gains restent les mesures synthétiques ci-dessus. Le checkpoint documentaire de clôture conserve exactement le code et nécessite son propre contrôle de publication/revue/déploiement final.

## Futur terminal compact — contrat non activé

Après 30 jours de terminaison définitive, futur `terminalProof.version=1` conservant enveloppe queryable version 1, réponses finales/IDs ordonnés et preuve minimale durable. Candidats seulement PROCESSED/processedAt fiable/tout SENT ; jamais EXECUTING, PENDING, SENDING, FAILED, AMBIGUOUS, Event non confirmé ou recovery/migration/provenance dépendant du détail. Conserver identité/ID événement, empreinte, clés métier, dates, résultat terminal et liens durables. Tout retrait d'intent/arguments/fullText exige audit lecteurs/statistiques/déduplication/échos/FK et preuve équivalente, tests de bornes et concurrence. Sans preuve, conversion bloquée. Aucune fonction de conversion irréversible, job ou conversion d'âge prématurés.

La [politique canonique](../specifications/data-retention-v1.md) porte durées et exemptions. Lot B après examen A : moteur de conservation, dry-run/éligibilité par domaine, preuves minimales/statistiques/FK/idempotence, cadence nocturne et reprise/échecs bornés. Cette préparation n'active aucune suppression.
