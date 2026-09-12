# Migration pilote legacy — runbook Phase 1 dry-run

Statut : CANDIDAT 0.90 — analyse et rapport uniquement, aucune écriture joueur.

Ce runbook centralise les règles déjà validées par le modèle V1 et les audits legacy. Il ne crée pas de règle métier concurrente. La Phase 1 sert à examiner un bundle et un Player standalone explicitement ciblés avant qu'un futur lot d'import soit seulement conçu.

## Garde-fous absolus

- La commande est uniquement `migration:legacy:dry-run`. Elle ne possède aucun mode d'application ou d'écriture DB.
- Le cœur reçoit seulement un `MigrationTargetReader` avec `readTarget(playerId)` ; aucun service Economy, opération métier ou repository de mutation n'est injectable.
- Le lecteur Prisma utilise exclusivement des lectures du Player UUID demandé. Il ne cible jamais un compte d'après son seul `displayName`.
- Supabase Auth ID, e-mail, mot de passe, session et token sont hors migration.
- Aucun bundle privé ni rapport nominatif ne doit entrer dans Git. `server/.migration-reports/` est ignoré.
- La Phase 1 ne crée ni migration Prisma 016, ni DDL, ni `BusinessOperation`, ni mouvement économique.

## Prérequis et source acceptée

Le propriétaire fournit localement un répertoire externe contenant `viewers_data.json` et, idéalement, les 16 autres JSON inventoriés dans `docs/legacy/01-data-sources-inventory.md`. Le parseur accepte `viewers_data.json` comme objet indexé par pseudo legacy ou sous une clé racine `viewers`. Tous les fichiers `.json` présents à la racine sont lus ; les 17 noms attendus sont inventoriés et les absents sont signalés.

Le vrai bundle n'est pas versionné dans ce repository. S'il n'est pas disponible, le résultat de l'intervention est `REAL_LEGACY_SOURCE_NOT_AVAILABLE` : aucune valeur réelle, notamment pour Kichnifou, ne doit être inventée.

Chaque exécution exige deux identifiants distincts :

- `--target-player-id` : UUID immuable du Player standalone à lire ;
- `--legacy-username` : clé exacte du profil à analyser dans `viewers_data.json`.

Exemple PowerShell :

```powershell
cd server
npm.cmd run migration:legacy:dry-run -- --source "C:\chemin\externe\Data" --target-player-id "<uuid>" --legacy-username "<pseudo-legacy>" --output ".migration-reports\pilot-dry-run.json"
```

La sortie JSON est créée sans écraser un fichier existant. La console produit en parallèle un résumé humain domaine/champ avec valeurs legacy, standalone, proposées et statuts.

## Fingerprint et provenance

Le fingerprint `sha256:` couvre, dans un ordre stable, le chemin relatif, la longueur et les octets exacts de chaque JSON lu. Un changement d'un fichier produit donc une autre source à reviewer.

Chaque proposition porte : fichier source, chemin/champ, pseudo legacy, audit/règle appliqué et transformation. Le rapport contient `mode`, `targetPlayerId`, `legacyUsername`, `sourceFingerprint`, l'inventaire `sourceFiles` découvert/absent, `generatedAt`, le résumé des statuts, les domaines et les avertissements.

Vocabulaire stable :

| Statut | Signification Phase 1 |
|---|---|
| `NOOP` | valeur déjà identique |
| `CREATE` | cible physique absente ; création seulement proposée |
| `UPDATE` | valeur standalone encore au baseline déterministe ; mise à jour seulement proposée |
| `CONFLICT` | valeurs legacy et standalone incompatibles, aucune priorité arbitraire |
| `DEFERRED` | domaine cible non physique ou dépendance absente |
| `NOT_RECONSTRUCTIBLE` | historique absent des sources, aucun faux enregistrement |
| `INVALID_SOURCE` | champ/fichier absent, illisible ou invalide |
| `MANUAL_REVIEW` | règle certaine mais contexte/cutover à arbitrer humainement |

## Mapping analysé en Phase 1

| Domaine | Règle consolidée |
|---|---|
| Player / élément | rattachement au UUID explicite ; pseudo legacy en provenance ; élément normalisé parmi les sept valeurs |
| Progression / XP | XP cumulative exacte, compteurs messages ; incohérence `level`/XP signalée sans correction silencieuse |
| Ressources | soldes Primos, Moras, sept particules et agrégats économiques conservés comme entiers décimaux exacts |
| Banque | solde séparé ; `lastInterestDate` seulement comme donnée de transition ; aucun historique bancaire inventé |
| Gacha | pity 5★/4★, garantie, streak, agrégats ; Capture initialisée depuis le streak borné 0..3 ; `capturesTriggered` proposé à 0 faute d'historique fiable, sans reset d'une valeur standalone ; cible de bannière en review manuelle |
| Box | possession unique, constellation bornée 0..6, `copies=max(copies,constellation+1)`, date/fallback traçable, favoris possédés seulement |
| Teams | dix positions de base, compositions dédupliquées prudemment, ordre actif et `savedAt` conservés quand certains |
| Stella / objets | quantité de Masterless Stella Fortuna conservée exactement |
| Récompense quotidienne | dernière date certaine seulement ; première date historique non reconstruite |
| Roue | totaux spins/jackpots ; état du jour seulement si la date correspond au cutover revu |
| Défi | état `missions.daily` seulement s'il appartient au jour de cutover et ne provoque aucun double paiement |
| Combat | compteurs exacts, `totalManualCombatWins=0` si absent selon R434 ; état journalier seulement au cutover ; slots nouveaux vides |
| Expedition | total récupéré conservé ; active seulement si personnage/dates certains ; aucune récompense ni incrément pendant l'analyse/import |

Social, Event, Missions permanentes, Boss et identité Twitch sont `DEFERRED` tant que leurs structures/lot d'import ne sont pas physiques et revus. Historiques Pull, Banque et Roue impossibles à reconstruire sont `NOT_RECONSTRUCTIBLE`.

## Protection des données standalone et cutover

Les données standalone postérieures à la mise en ligne ne sont jamais écrasées par défaut. Une valeur différente devient `CONFLICT`, sauf baseline explicitement déterministe où le rapport peut proposer `UPDATE`. Un conflit reste sans résolution dans Phase 1.

Les états journaliers/actifs dépendent d'une frontière commune de cutover `Europe/Paris`. Tant qu'elle n'est pas explicitement arrêtée avec le bundle final, le rapport porte `CUTOVER_BOUNDARY_UNRESOLVED` et classe ces propositions `MANUAL_REVIEW`.

## Review humaine et futur lot distinct

Avant tout futur import réel, le propriétaire et la review indépendante devront valider : UUID et pseudo ciblés, inventaire des fichiers, fingerprint exact, chaque conflit, chaque fallback, les domaines différés et tous les invariants. Le rapport seul ne vaut jamais autorisation d'import.

Un futur lot séparé devra encore concevoir et tester : snapshot/backup de la cible, source au fingerprint identique, provenance persistée, mutation transactionnelle et idempotente, post-check, puis rollback ou compensation vérifiable. Aucun de ces mécanismes d'application n'est codé en 0.90.
