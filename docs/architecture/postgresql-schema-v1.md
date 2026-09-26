# GachaImpact — Schéma PostgreSQL physique V1

> Statut : **CONSOLIDÉ — Phase C2 / schéma relationnel cible**
>
> Date : **2026-09-04**
>
> Baseline repository : `main` au commit `ab6b58b43d7a991fb6efbb5195b3a1a5ff2c679d`
>
> Ce document traduit `docs/specifications/v1-data-model.md` vers un schéma PostgreSQL concret.
>
> Il complète `docs/architecture/backend-architecture-v1.md`.
>
> Il décrit les tables, clés, types, contraintes, index, politiques de suppression et principes RLS à implémenter avec Prisma + migrations SQL.
>
> **Portée :** ce schéma est la cible relationnelle de référence, pas l'inventaire de toutes les tables déjà créées. L'état physique courant se vérifie dans `server/prisma/schema.prisma` et les migrations versionnées ; `docs/master/PROJECT_MASTER_PLAN.md` porte l'avancement et la prochaine étape.

---

# 1. Principes physiques

## 1.1 Conventions

- noms SQL en `snake_case`
- identifiants métier durables en `uuid`
- timestamps en `timestamptz`
- journées métier en `date`
- ressources et gros compteurs en `bigint`
- petits compteurs bornés en `integer` ou `smallint`
- texte court en `text` avec `CHECK` lorsque la longueur est métier
- `jsonb` uniquement pour metadata/snapshot/payload réellement flexible
- toutes les tables métier durables possèdent `created_at`
- `updated_at` uniquement lorsque l'état courant peut réellement être modifié

## 1.2 UUID

Génération par défaut :

`gen_random_uuid()`

Les IDs sont générés côté base ou côté application selon le contexte, mais restent opaques et immuables.

## 1.3 Suppression

Par défaut :

- catalogue/historique : désactivation ou archivage
- état temporaire sans valeur historique : suppression possible
- FK vers historique : `ON DELETE RESTRICT`
- FK vers simple enfant purement technique : `ON DELETE CASCADE` uniquement lorsque le parent est réellement propriétaire du cycle de vie

Aucun `CASCADE` ne doit pouvoir supprimer une progression joueur importante par accident.

## 1.4 Argent et ressources

Tous les montants de ressources sont des entiers.

Pas de type flottant.

Les soldes doivent respecter :

`amount >= 0`

---

# 2. Enums PostgreSQL

Les enums ci-dessous peuvent être de vrais enums PostgreSQL ou des tables de référence si une évolution fréquente devient nécessaire.

Pour V1, les valeurs stables peuvent être des enums.

## `player_status`

- `ACTIVE`
- `SUSPENDED`
- `ARCHIVED`

## `source_channel`

- `UI`
- `INTERNAL_CHAT`
- `TWITCH`
- `SYSTEM`
- `ADMIN`
- `MIGRATION`

## `operation_status`

- `PENDING`
- `COMPLETED`
- `FAILED`

## `trade_request_state`

- `PENDING`
- `ACCEPTED`
- `REFUSED`
- `CANCELLED`
- `EXPIRED`

## `friend_request_state`

- `PENDING`
- `ACCEPTED`
- `REFUSED`
- `CANCELLED`

## `friendship_state`

- `ACTIVE`
- `ARCHIVED`

## `privacy_level`

- `PUBLIC`
- `FRIENDS`
- `PRIVATE`

## `mission_kind`

- `DAILY`
- `PERMANENT`

## `mission_rank`

- `B`
- `A`
- `S`
- `Z`

## `expedition_state`

- `IDLE`
- `RUNNING`
- `READY`

## `combat_attempt_mode`

- `MANUAL`
- `AUTO`

## `notification_state`

- `UNREAD`
- `READ`
- `RESOLVED`
- `ARCHIVED`

## `banner_status`

- `SCHEDULED`
- `ACTIVE`
- `FINISHED`

## `event_edition_status`

- `SCHEDULED`
- `ACTIVE`
- `FINISHED`

## `giveaway_state`

- `OPEN`
- `CLOSED`

## `contest_state`

- `LOBBY`
- `RUNNING`
- `FINISHED`
- `CANCELLED`

## `twitch_receipt_state`

- `RECEIVED`
- `PROCESSING`
- `PROCESSED`
- `FAILED`

---

# 3. Référentiels fondamentaux

## 3.1 `elements`

Une ligne par élément GachaImpact.

Colonnes :

- `key text PRIMARY KEY`
- `display_name text NOT NULL`
- `display_order smallint NOT NULL`
- `is_active boolean NOT NULL DEFAULT true`
- `created_at timestamptz NOT NULL DEFAULT now()`

Seeds V1 :

- `pyro`
- `hydro`
- `cryo`
- `electro`
- `anemo`
- `geo`
- `dendro`

Contraintes :

- `display_order > 0`
- `UNIQUE(display_order)`

---

## 3.2 `resource_definitions`

Catalogue des ressources économiques standards.

Colonnes :

- `key text PRIMARY KEY`
- `display_name text NOT NULL`
- `category text NOT NULL`
- `element_key text NULL REFERENCES elements(key)`
- `is_active boolean NOT NULL DEFAULT true`
- `created_at timestamptz NOT NULL DEFAULT now()`

Seeds initiaux :

- `primogems`
- `moras`
- `particles_pyro`
- `particles_hydro`
- `particles_cryo`
- `particles_electro`
- `particles_anemo`
- `particles_geo`
- `particles_dendro`

La Banque ne devient pas une ressource séparée : elle possède sa propre table de solde.

---

# 4. Identité / compte

## 4.1 `players`

Identité métier centrale.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `display_name text NOT NULL`
- `element_key text NULL REFERENCES elements(key)`
- `status player_status NOT NULL DEFAULT 'ACTIVE'`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `migration_run_id uuid NULL`
- `legacy_username text NULL`

Contraintes :

- `char_length(display_name) BETWEEN 1 AND 40`
- élément nullable uniquement pour les profils Twitch-only non encore activés

Index :

- index normalisé de recherche sur `lower(display_name)`
- index sur `status`
- index sur `element_key`

Important :

le pseudo n'est pas unique par sécurité métier tant que la politique finale de handle standalone n'est pas imposée.

La future contrainte d'unicité du handle visible pourra être ajoutée lorsque le système de handle sera implémenté.

---

## 4.2 `web_identities`

Liaison avec le fournisseur Auth.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL UNIQUE REFERENCES players(id) ON DELETE RESTRICT`
- `provider text NOT NULL`
- `provider_subject text NOT NULL`
- `linked_at timestamptz NOT NULL DEFAULT now()`
- `state text NOT NULL DEFAULT 'ACTIVE'`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `UNIQUE(provider, provider_subject)`

Pour Supabase Auth :

- `provider = 'supabase'`
- `provider_subject = auth.users.id` sous forme texte

Pas de FK physique obligatoire vers `auth.users`.

Cela garde le modèle portable.

## 4.3 `twitch_identities` — pilote DEV

La migration Prisma additive 049 est appliquée sur DEV. Elle matérialise `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE RESTRICT`, `twitch_user_id text UNIQUE NOT NULL`, login courant, display name nullable, `linked_at`, `updated_at`, `first_seen_at` et `last_message_at` nullable. Les tokens OAuth ne sont jamais stockés. `twitch_link_states` conserve les SHA-256 de l'état et du nonce, Player et expiration. `migration_previews` enregistre seulement les confirmations consommées (UUID, Player, SHA-256, expiration) ; le dry-run utilise un token signé et n'écrit rien en DB. `migration_runs` conserve Player, hash, statut, source et résumé sans JSON source. Une colonne `legacy_provenance` permet de conserver une Mission terminée dans le snapshot sans inventer un versement standalone. Les quatre nouvelles tables sont backend-only : RLS active, aucun droit `PUBLIC`/`anon`/`authenticated`, aucune policy navigateur. Le registre Prisma confirme 049 appliquée ; les quatre tables ont été inspectées et les tables publiques de liaison et de runs sont vides.

Ce sous-ensemble physique du pilote ne remplace pas les structures cibles complètes de la section 34. Le mapping personnel sûr et les domaines explicitement différés sont détaillés dans [la matrice du pilote](twitch-pilot-mapping.md). La migration générale reste future.

---

## 4.3 `twitch_identities`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL UNIQUE REFERENCES players(id) ON DELETE RESTRICT`
- `twitch_user_id text NOT NULL UNIQUE`
- `login text NULL`
- `display_name text NULL`
- `linked_at timestamptz NULL`
- `first_seen_at timestamptz NULL`
- `last_message_at timestamptz NULL`
- `legacy_last_seen_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Index :

- `lower(login)` pour résolution secondaire
- `last_message_at`

`twitch_user_id` est la seule identité Twitch durable.

---

## 4.4 `player_preferences`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `preference_key text NOT NULL`
- `value jsonb NOT NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, preference_key)`

Usage initial :

- tri Box
- ordre de tri
- préférences d'affichage futures explicitement validées
- préférence physique 0.80 `navigation_menu_v1` dans le JSONB existant : `{ version: 1, order: string[], hidden: string[] }`, isolée par la PK `(player_id, preference_key)` ; aucune nouvelle table ni colonne

État physique 0.80 : la migration additive `011_reposition_daily_challenge` conserve la ligne `shop_item_definitions.external_key = 'daily-mission'`, la renomme player-facing `Défi` et impose `is_visible = false`, `is_enabled = false` tant que le service métier complet n’existe pas. La migration 010 reste immuable et aucun `ShopPurchase` ni aucune donnée Player ne sont créés.

---

## 4.5 `player_role_assignments`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `role text NOT NULL`
- `granted_at timestamptz NOT NULL DEFAULT now()`
- `granted_by_player_id uuid NULL REFERENCES players(id) ON DELETE SET NULL`
- `revoked_at timestamptz NULL`
- `source text NULL`

Index partiel unique :

`UNIQUE(player_id, role) WHERE revoked_at IS NULL`

Rôles initiaux :

- `ADMIN`
- `MODERATOR`
- `TESTER`

`TESTER` porte la capacité technique `SELF_TEST_TOOLS`; `MODERATOR` seul ne l'obtient pas.

---

## 4.6 `admin_audit_entries`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `actor_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `target_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `action text NOT NULL`
- `domain text NOT NULL`
- `before jsonb NOT NULL`
- `after jsonb NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`

Index :

- `(actor_player_id, created_at DESC)`
- `(target_player_id, created_at DESC)`

Le premier vertical physique est self-only. Les deux tables sont privées, RLS activée, sans policy de navigateur, et les droits `anon`/`authenticated` sont révoqués.

---

# 5. Opérations / idempotence

## 5.1 `business_operations`

Corrélation et idempotence des mutations sensibles.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NULL REFERENCES players(id) ON DELETE RESTRICT`
- `operation_type text NOT NULL`
- `source_channel source_channel NOT NULL`
- `idempotency_key text NULL`
- `status operation_status NOT NULL DEFAULT 'PENDING'`
- `result_summary jsonb NULL`
- `started_at timestamptz NOT NULL DEFAULT now()`
- `completed_at timestamptz NULL`

Contrainte :

`UNIQUE(source_channel, idempotency_key) WHERE idempotency_key IS NOT NULL`

Index :

- `(player_id, started_at DESC)`
- `(operation_type, started_at DESC)`

Cette table n'est pas un historique joueur.

Elle sert au retry, à l'audit technique et à la corrélation.

---

# 6. Progression

## 6.1 `player_progression`

Une ligne par Player.

Colonnes :

- `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
- `xp bigint NOT NULL DEFAULT 0`
- `level_100_overflow_rewards_claimed integer NOT NULL DEFAULT 0`
- `total_messages bigint NOT NULL DEFAULT 0`
- `counted_messages bigint NOT NULL DEFAULT 0`
- `last_xp_at timestamptz NULL`
- `last_xp_message_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `xp >= 0`
- `level_100_overflow_rewards_claimed >= 0`
- `total_messages >= 0`
- `counted_messages >= 0`
- `counted_messages <= total_messages`

Le niveau n'est pas stocké comme vérité.

État physique 0.71 : le service central de gain d'XP verrouille cette ligne dans la transaction métier appelante, met à jour `xp`, `level_100_overflow_rewards_claimed` et `last_xp_at`, puis crédite les récompenses de chaque palier/overflow par le moteur économique. Une source non-message comme le passif Cryo ne modifie ni les deux compteurs message ni `last_xp_message_at`.

---

## 6.2 `player_daily_reward_state`

Une ligne par joueur.

Colonnes :

- `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
- `first_claim_date date NULL`
- `last_claim_date date NULL`
- `last_claimed_at timestamptz NULL`
- `last_operation_id uuid NULL REFERENCES business_operations(id) ON DELETE SET NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

- `first_claim_date IS NULL OR last_claim_date IS NOT NULL`
- si les deux existent : `first_claim_date <= last_claim_date`

---

# 7. Économie

## 7.1 `player_resource_balances`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `resource_key text NOT NULL REFERENCES resource_definitions(key)`
- `amount bigint NOT NULL DEFAULT 0`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, resource_key)`

Contrainte :

`amount >= 0`

---

## 7.2 `resource_movements`

Journal natif.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `resource_key text NOT NULL REFERENCES resource_definitions(key)`
- `delta bigint NOT NULL`
- `balance_before bigint NOT NULL`
- `balance_after bigint NOT NULL`
- `cause_key text NOT NULL`
- `domain_key text NOT NULL`
- `operation_id uuid NULL REFERENCES business_operations(id) ON DELETE SET NULL`
- `source_channel source_channel NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `balance_before >= 0`
- `balance_after >= 0`
- `balance_after = balance_before + delta`

Index :

- `(player_id, created_at DESC)`
- `(player_id, resource_key, created_at DESC)`
- `(operation_id)`
- `(cause_key, created_at DESC)`

---

## 7.3 `player_economy_stats`

Conserve les compteurs historiques importés et futurs cumulés.

Colonnes :

- `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
- `total_primos_earned bigint NOT NULL DEFAULT 0`
- `total_primos_spent bigint NOT NULL DEFAULT 0`
- `total_moras_earned bigint NOT NULL DEFAULT 0`
- `total_moras_spent bigint NOT NULL DEFAULT 0`
- `total_main_element_particles_earned bigint NOT NULL DEFAULT 0`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

tous les compteurs `>= 0`.

Les valeurs legacy sont importées telles quelles lorsqu'elles sont certaines.

---

# 8. Banque

## 8.1 `player_bank_accounts`

Colonnes :

- `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
- `balance bigint NOT NULL DEFAULT 0`
- `last_interest_date date NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

`balance >= 0`

---

## 8.2 `bank_transactions`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `transaction_type text NOT NULL`
- `amount bigint NOT NULL`
- `bank_balance_before bigint NOT NULL`
- `bank_balance_after bigint NOT NULL`
- `wallet_balance_before bigint NULL`
- `wallet_balance_after bigint NULL`
- `business_date date NULL`
- `operation_id uuid NOT NULL REFERENCES business_operations(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`

Types physiques initiaux :

- `DEPOSIT`
- `WITHDRAWAL`
- `INTEREST`

Contraintes :

- `amount > 0` pour dépôt/retrait et `amount >= 0` pour intérêt au niveau de la contrainte physique 008 ; le service n'insère cependant jamais d'intérêt nul ;
- soldes `>= 0`
- dépôt/retrait : soldes wallet renseignés, `business_date NULL` ;
- intérêt : soldes wallet `NULL`, `business_date NOT NULL` ;
- `operation_id` unique ;
- unicité partielle `(player_id, business_date) WHERE transaction_type = 'INTEREST'`.

Index :

- `(player_id, created_at DESC)` ;
- `(business_date)`.

État physique 0.72 : la migration additive `008_add_banking` crée ces deux tables, backfill chaque Player DEV existant à zéro sur la journée `Europe/Paris` courante, active la RLS et révoque les accès directs `anon`/`authenticated`. Le service provisionne paresseusement les futurs comptes, verrouille le Player et les soldes dans des transactions `SERIALIZABLE`, résout `MAX` côté serveur et journalise chaque mutation via `business_operations`. L'intention demandée (`requestedAmount`, entier décimal ou `max`) est conservée dans le `result_summary` de l'opération pour refuser toute réutilisation de clé avec un payload différent. Le scheduler effectue le catch-up au démarrage puis le prochain reset Paris sans durée fixe de 24 h ; les jours manqués sont composés séquentiellement. Les transferts modifient le mouvement wallet sans toucher aux statistiques Earned/Spent. Un intérêt positif augmente uniquement le solde Banque et `total_moras_earned` ; un intérêt nul avance seulement `last_interest_date` sans opération ni transaction `+0`.

État API 0.73, sans migration : `GET /api/v1/me/bank` limite la projection récente à cinq lignes. `GET /api/v1/me/bank/history?page=N` exploite le ledger et l'index existants, filtre toujours sur le Player authentifié, trie `created_at DESC, id DESC` et pagine par dix lignes avec `totalCount` et `totalPages`. Les soldes et montants restent sérialisés en chaînes décimales lossless.

---

# 9. Échanges

État physique : migration additive `20260921100000_031_add_particle_trades`. Les deux tables sont privées backend-only : RLS activée, aucun droit PUBLIC/anon/authenticated. Aucun seed économique ni import des demandes ouvertes.

## 9.1 `trade_requests`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `sender_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `recipient_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `sender_resource_key text NOT NULL REFERENCES resource_definitions(key)`
- `recipient_resource_key text NOT NULL REFERENCES resource_definitions(key)`
- `original_amount bigint NOT NULL`
- `current_amount bigint NOT NULL`
- `state trade_request_state NOT NULL DEFAULT 'PENDING'`
- `source_channel source_channel NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT` ; la clé d'idempotence appartient à cette opération
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `resolved_at timestamptz NULL`
- `expires_at timestamptz NOT NULL` : prochain minuit Europe/Paris calculé à la création

Contraintes :

- sender != recipient
- original_amount > 0
- current_amount >= 0
- current_amount <= original_amount
- deux clés particules canoniques distinctes ; les éléments des participants sont revalidés par le service
- PENDING implique current_amount > 0 et resolved_at NULL ; un état résolu impose resolved_at
- expires_at > created_at

Index :

- `(sender_player_id, state, created_at)`
- `(recipient_player_id, state, created_at)`
- `(state, expires_at)`

Index unique partiel PostgreSQL :

une seule demande `PENDING` par paire non orientée :

`UNIQUE(LEAST(sender_player_id, recipient_player_id), GREATEST(sender_player_id, recipient_player_id)) WHERE state = 'PENDING'`

La réservation du sender est calculée depuis les demandes `PENDING`.

---

## 9.2 `trade_executions`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `trade_request_id uuid NOT NULL REFERENCES trade_requests(id) ON DELETE RESTRICT`
- `amount bigint NOT NULL`
- `operation_id uuid NOT NULL REFERENCES business_operations(id) ON DELETE RESTRICT`
- `executed_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

`amount > 0`

Unicités `trade_request_id` et `operation_id` : une demande ne produit qu'une exécution. Index `executed_at` pour l'historique récent. La baisse automatique à zéro conserve la demande CANCELLED ; l'expiration conserve EXPIRED. Toutes les FK d'audit sont restrictives.

---

# 10. Catalogue personnages

## 10.1 `characters`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `external_key text NOT NULL UNIQUE`
- `name text NOT NULL`
- `rarity smallint NOT NULL`
- `element_key text NOT NULL REFERENCES elements(key)`
- `weapon_type text NULL`
- `region text NULL`
- `class_key text NULL`
- `icon_path text NULL`
- `splash_path text NULL`
- `wish_path text NULL`
- `fullbody_path text NULL`
- `display_order integer NULL`
- `is_active boolean NOT NULL DEFAULT true`
- `release_date date NULL`
- `source_metadata jsonb NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `rarity IN (4,5)`
- `char_length(name) > 0`

Index :

- `lower(name)`
- `(is_active, rarity)`
- `(element_key, is_active)`

---

# 11. Gacha

## 11.1 `banner_rotations`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `starts_at timestamptz NOT NULL`
- `ends_at timestamptz NOT NULL`
- `status banner_status NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

`starts_at < ends_at`

Index unique partiel :

un seul banner `ACTIVE`.

---

## 11.2 `banner_featured_characters`

Colonnes :

- `banner_rotation_id uuid NOT NULL REFERENCES banner_rotations(id) ON DELETE CASCADE`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `rarity smallint NOT NULL`
- `slot smallint NOT NULL`
- `selection_source text NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(banner_rotation_id, character_id)`

Contraintes :

- `rarity IN (4,5)`
- `slot > 0`
- `UNIQUE(banner_rotation_id, rarity, slot)`

Cible V1 :

- quatre slots 5★
- six slots 4★

---

## 11.3 `banner_votes`

État physique Batch A : table existante réutilisée sans changement de colonnes ni de `schema.prisma`. RLS vérifiée active ; unique rotation/Player, index rotation/personnage et FK restrictives vérifiés sur DEV. La migration additive autorisée `20260919200000_027_harden_banner_vote_grants` retire les grants hérités `TRUNCATE`/`REFERENCES`/`TRIGGER` et révoque tout accès `PUBLIC`, `anon`, `authenticated` à cette table. Elle ne touche aucune ligne. Toutes les lectures/mutations passent par le backend ; pas de policy permissive.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `banner_rotation_id uuid NOT NULL REFERENCES banner_rotations(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `source_channel source_channel NOT NULL`
- `voted_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

`UNIQUE(banner_rotation_id, player_id)`

Index :

`(banner_rotation_id, character_id)`

Les totaux sont dérivés.

---

## 11.4 `player_gacha_states`

Une ligne par joueur.

Colonnes :

- `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
- `pity_5 smallint NOT NULL DEFAULT 0`
- `pity_4 smallint NOT NULL DEFAULT 0`
- `guaranteed_featured_5 boolean NOT NULL DEFAULT false`
- `capture_progress smallint NOT NULL DEFAULT 0`
- `fifty_fifty_lost_streak integer NOT NULL DEFAULT 0`
- `selected_banner_character_id uuid NULL REFERENCES characters(id) ON DELETE SET NULL`
- `total_pulls bigint NOT NULL DEFAULT 0`
- `total_five_stars bigint NOT NULL DEFAULT 0`
- `total_four_stars bigint NOT NULL DEFAULT 0`
- `fifty_fifty_won bigint NOT NULL DEFAULT 0`
- `fifty_fifty_lost bigint NOT NULL DEFAULT 0`
- `captures_triggered bigint NOT NULL DEFAULT 0`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `pity_5 BETWEEN 0 AND 90`
- `pity_4 BETWEEN 0 AND 10`
- `capture_progress BETWEEN 0 AND 3`
- compteurs `>= 0`

---

## 11.5 `pull_operations`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `banner_rotation_id uuid NOT NULL REFERENCES banner_rotations(id) ON DELETE RESTRICT`
- `target_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `pull_count smallint NOT NULL`
- `primogem_cost bigint NOT NULL`
- `source_channel source_channel NOT NULL`
- `business_operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `pull_count BETWEEN 1 AND 10`
- `primogem_cost >= 0`

Index :

`(player_id, created_at DESC)`

---

## 11.6 `pull_results`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `pull_operation_id uuid NOT NULL REFERENCES pull_operations(id) ON DELETE CASCADE`
- `result_index smallint NOT NULL`
- `result_type text NOT NULL`
- `character_id uuid NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `rarity smallint NULL`
- `resource_key text NULL REFERENCES resource_definitions(key)`
- `resource_amount bigint NULL`
- `was_new_character boolean NULL`
- `constellation_after smallint NULL`
- `copies_after integer NULL`
- `was_fifty_fifty boolean NOT NULL DEFAULT false`
- `won_fifty_fifty boolean NULL`
- `guarantee_consumed boolean NOT NULL DEFAULT false`
- `capture_triggered boolean NOT NULL DEFAULT false`
- `snapshot jsonb NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

`UNIQUE(pull_operation_id, result_index)`

`result_index BETWEEN 1 AND 10`

Index :

- `(character_id, created_at)`
- `(pull_operation_id, result_index)`

État physique 0.71 : aucune colonne ni migration supplémentaire n'est requise. `snapshot` conserve désormais, en plus des états Gacha et bonus existants, le snapshot de la Team active et les `passiveEffects` machine-readable de chaque vœu. L'état final après les passifs est relu par les retries afin de restituer exactement l'opération d'origine sans reroll ni double crédit.

---

# 12. Possessions / Collection personnages

## 12.1 `player_characters`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `constellation smallint NOT NULL DEFAULT 0`
- `copies integer NOT NULL DEFAULT 1`
- `first_obtained_at timestamptz NOT NULL`
- `favorite boolean NOT NULL DEFAULT false`
- `migration_run_id uuid NULL`
- `legacy_provenance jsonb NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, character_id)`

Contraintes :

- `constellation BETWEEN 0 AND 6`
- `copies >= 1`
- `copies >= constellation + 1`

Index :

- `(player_id, favorite)`
- `(player_id, first_obtained_at DESC)`
- `(character_id)`

---

# 13. C6 / Concours

## 13.1 `c6_competition_progress`

Une ligne uniquement pour les vrais 5★ C6 concernés.

Colonnes :

- `player_id uuid NOT NULL`
- `character_id uuid NOT NULL`
- cinq statistiques Concours en `smallint NOT NULL DEFAULT 1`
- `total_contests bigint NOT NULL DEFAULT 0`
- `total_wins bigint NOT NULL DEFAULT 0`
- participations/victoires thématiques en `bigint NOT NULL DEFAULT 0`
- un plancher de titre par thème en `smallint NOT NULL DEFAULT 0`
- `unlocked_at timestamptz NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, character_id)`

FK composite logique vers `player_characters`.

Contraintes :

chaque statistique Concours `BETWEEN 0 AND 20`.

---

## 13.2 `contests`

Colonnes principales :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `organizer_player_id uuid NULL REFERENCES players(id) ON DELETE RESTRICT`
- `business_date date NOT NULL`
- `status contest_status NOT NULL`
- `phase contest_phase NOT NULL`
- deadlines lobby/tour/soutien
- `current_turn_order smallint NULL`
- `winner_slot smallint NULL`
- `started_at timestamptz NULL`
- `finished_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Index unique partiel :

au plus un Concours global actif/lobby/running selon la règle serveur.

---

## 13.3 `contest_participants`

Colonnes :

- `contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE`
- `slot smallint NOT NULL`
- `player_id uuid NULL REFERENCES players(id) ON DELETE RESTRICT`
- `character_id uuid NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `kind contest_participant_kind NOT NULL`
- `ready boolean NOT NULL DEFAULT false`
- snapshots identité/personnage/statistique/base/titre au lancement
- `score integer NOT NULL DEFAULT 0`
- `final_rank smallint NULL`
- `reward_primogems bigint NOT NULL DEFAULT 0`
- compteurs et métadonnées de départ/remplacement

Contraintes :

- `slot BETWEEN 1 AND 4`
- `PRIMARY KEY(contest_id, slot)`
- un participant humain unique par contest

---

## 13.4 `contest_daily_participations`

Empêche une seconde participation quotidienne.

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id)`
- `business_date date NOT NULL`
- `contest_id uuid NOT NULL REFERENCES contests(id)`
- `consumed_at timestamptz NOT NULL`

PK :

`PRIMARY KEY(player_id, business_date)`

---

## 13.5 `contest_results`

Historique natif permanent.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE RESTRICT`
- `participant_id uuid NOT NULL REFERENCES contest_participants(id) ON DELETE RESTRICT`
- `final_rank smallint NOT NULL`
- `final_score integer NOT NULL`
- `reward_primogems bigint NOT NULL DEFAULT 0`
- `result_snapshot jsonb NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

---

# 14. Teams / passifs

## 14.1 `teams`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `display_position integer NOT NULL`
- `name text NULL`
- `is_active boolean NOT NULL DEFAULT false`
- `is_base_slot boolean NOT NULL DEFAULT false`
- `legacy_saved_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `display_position > 0`
- `UNIQUE(player_id, display_position)`
- nom <= 20 caractères lorsqu'il existe

`is_base_slot` décrit uniquement la provenance des dix Teams provisionnées. Il ne doit jamais servir d'autorité de suppression : conformément à R233, cette protection est recalculée depuis la `display_position` courante (1 à 10), jamais depuis l'identité ou l'historique d'une Team.

Index unique partiel :

`UNIQUE(player_id) WHERE is_active = true`

---

## 14.2 `team_members`

Colonnes :

- `team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE`
- `position smallint NOT NULL`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`

PK :

`PRIMARY KEY(team_id, position)`

Contraintes :

- `position BETWEEN 1 AND 4`
- `UNIQUE(team_id, character_id)`

La possession est revalidée par service métier.

---

## 14.3 `element_passive_definitions`

Colonnes :

- `element_key text PRIMARY KEY REFERENCES elements(key)`
- `max_stacks smallint NOT NULL DEFAULT 2`
- `effect_key text NOT NULL`
- `effect_config jsonb NOT NULL`
- `is_active boolean NOT NULL DEFAULT true`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Les passifs actifs d'un joueur sont dérivés de sa Team active.

État physique 0.69 : la migration additive `007_add_teams` crée `teams` et `team_members`, backfill les dix Teams de base des Players DEV existants, active Team 1 lorsqu'elle est créée par ce backfill, active la RLS et révoque les droits directs `anon`/`authenticated`. Les nouveaux Players sont complétés par un provisioning paresseux transactionnel et idempotent au premier GET Team ; aucune composition existante n'est écrasée. Sans migration supplémentaire, les mêmes tables portent désormais renommage, Teams 11+ séquentielles, suppression/compaction et réordres complets. Les écritures d'ordre utilisent une transaction et des positions temporaires afin de respecter `UNIQUE(player_id, display_position)` ; l'identité active reste attachée à l'UUID.

Le cleanup transactionnel R185 distingue l'état et la position courante : une Team active perd seulement les memberships devenus inactifs ; une Team non active 1..10 perd tous ses memberships ; une Team non active 11+ est supprimée par cascade, puis l'ordre survivant est compacté une seule fois. `is_base_slot` n'intervient pas dans cette décision et aucune réactivation catalogue ne recrée les relations supprimées.

`element_passive_definitions` reste une cible d'administration future. L'état physique 0.71 conserve les sept définitions et leurs paramètres Gacha exacts dans une configuration serveur fortement typée ; `deriveActiveTeamGachaEffects` produit un contrat machine-readable pur depuis les éléments de la Team. Le moteur Pull verrouille le Player, lit la seule Team active et exclut les personnages catalogue désactivés, puis fige ce contexte pour toute l'opération. Un x10 partage le snapshot mais teste les effets par vœu. Les ratios Pyro/Géo sont appliqués en arithmétique entière exacte avec floor ; les effets post-vœu suivent l'ordre Cryo, Électro, Anémo, Dendro. Aucune nouvelle table ni valeur dérivée persistée par Player n'est introduite.

---

# 15. Inventaire / objets

## 15.1 `item_definitions`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `external_key text NOT NULL UNIQUE`
- `display_name text NOT NULL`
- `category text NOT NULL`
- `description text NULL`
- `is_active boolean NOT NULL DEFAULT true`
- `metadata jsonb NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

---

## 15.2 `player_items`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `item_id uuid NOT NULL REFERENCES item_definitions(id) ON DELETE RESTRICT`
- `quantity bigint NOT NULL DEFAULT 0`
- `first_obtained_at timestamptz NULL`
- `legacy_provenance jsonb NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, item_id)`

Contrainte :

`quantity >= 0`

État physique/API 0.96 : `GET /api/v1/me/inventory` joint uniquement le Player authentifié, restitue les neuf ressources structurelles dans un ordre stable même lorsque leur solde vaut zéro, puis les définitions d'objets actives avec la quantité et la première obtention éventuelles du joueur. La migration 018 matérialise les douze définitions Collection mensuelles sans créer de `player_items` ; elles restent donc visibles à zéro. Tous les `bigint` sont transmis en chaînes décimales lossless.

La consommation de Stella reste portée par le service transactionnel Box/possessions existant ; l'API Inventory est une projection de lecture.

## 15.3 `item_acquisitions`

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `item_id uuid NOT NULL REFERENCES item_definitions(id) ON DELETE RESTRICT`
- `quantity bigint NOT NULL CHECK (quantity > 0)`
- `source_key text NOT NULL`
- `provenance jsonb NULL`
- `operation_id uuid NULL REFERENCES business_operations(id) ON DELETE SET NULL`
- `acquired_at timestamptz NOT NULL DEFAULT now()`

Le ledger ne porte aucun solde : `player_items.quantity` reste autoritatif. L’unicité nullable `(operation_id, item_id)` aide les futurs producteurs idempotents ; les lectures personnelles utilisent l’index `(player_id, item_id, acquired_at DESC)`. La migration 018 n’effectue aucun backfill. RLS est activée et les droits `anon`/`authenticated` sont révoqués.

---

# 16. Boutique

## 16.1 `shop_item_definitions`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `external_key text NOT NULL UNIQUE`
- `display_name text NOT NULL`
- `description text NOT NULL`
- `visual_key text NOT NULL`
- `price_resource_key text NOT NULL REFERENCES resource_definitions(key)`
- `price_amount bigint NOT NULL`
- `effect_type text NOT NULL`
- `effect_config jsonb NOT NULL`
- `display_order integer NOT NULL`
- `is_visible boolean NOT NULL DEFAULT true`
- `is_enabled boolean NOT NULL DEFAULT true`
- `unavailable_reason text NULL`
- `limit_config jsonb NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `price_amount >= 0`
- `display_order > 0`

---

## 16.2 `shop_purchases`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `shop_item_id uuid NOT NULL REFERENCES shop_item_definitions(id) ON DELETE RESTRICT`
- `quantity integer NOT NULL DEFAULT 1`
- `unit_price bigint NOT NULL`
- `total_price bigint NOT NULL`
- `effect_snapshot jsonb NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `purchased_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `quantity > 0`
- `unit_price >= 0`
- `total_price >= 0`

Index :

`(player_id, purchased_at DESC)`

État physique 0.79 : la migration additive `010_add_shop` crée ces deux tables. Le modèle physique utilise `smallint` pour `display_order` et `bigint` pour `quantity`, ajoute l'index `(shop_item_id, purchased_at DESC)` et impose aux articles payants initiaux des prix strictement positifs ainsi que `total_price = unit_price × quantity`. Les relations vers Player, ressource, article et `BusinessOperation` sont en `ON DELETE RESTRICT`. La RLS est active et les droits directs `anon`/`authenticated` sont révoqués : seul le backend authentifié sert les projections personnelles.

Le seed canonique 010 contient, dans cet ordre, `daily-mission`, `primogem-bundle` et `reward-ticket`. L’additif 011 conserve `daily-mission`, le renomme player-facing `Défi`, puis le masque et le désactive tant que son service complet n’existe pas. Primos et Ticket restent visibles et actifs ; le Ticket conserve ses cinq issues de poids 1 dans `effect_config`. Aucun stock global ni achat rétroactif n'est créé.

L'API physique 0.79 expose `GET /api/v1/me/shop` et `POST /api/v1/me/shop/:itemId/purchase`. L'achat est une transaction `SERIALIZABLE` verrouillée par Player, avec débit/crédits via le service économique central, récompense Pity via le service Gacha central, snapshot avant réponse et idempotence portée par `business_operations`. Le frontend ne fournit jamais le prix ni le résultat Ticket.

État API 0.81, sans migration : `GET /api/v1/me/shop/history?page=N` projette exclusivement les achats du Player authentifié depuis `shop_purchases`, triés `purchased_at DESC, id DESC`, par pages de dix. Le DTO renvoie `purchases`, `page`, `pageSize`, `totalCount`, `totalPages` et sérialise chaque achat par le même contrat que la projection récente. Une page non entière ou inférieure à 1 produit HTTP 400 / `SHOP_HISTORY_PAGE_INVALID`. Les migrations 010 et 011 restent immuables.

---

# 17. Missions

## 17.1 État permanent physique — migrations 041–042 promues

`permanent_mission_definitions` contient exactement le catalogue B/A/S/Z. Ses enums physiques sont `permanent_mission_rank`, `permanent_mission_metric` et `permanent_mission_progress_status`. La table stocke external key, métrique, rang, textes, cible, récompense Primogemmes, ordre, activation et secret. Les unicités portent sur external key, métrique/rang et rang/ordre ; les CHECK imposent valeurs positives, textes non vides, métriques compatibles, récompense de chaque rang et secret exclusivement Z.

`player_permanent_mission_states` possède une PK/FK `player_id` avec cascade, `initialized_at`, `z_unlocked_at` et `standalone_catchup_completed_at`. Les timestamps de déblocage Z et de catch-up ne peuvent précéder l’initialisation. La migration additive 042 ajoute uniquement cette dernière colonne nullable et son CHECK ; elle ne modifie aucune ligne métier, progression, opération, ressource ou statistique.

`player_permanent_mission_progress` possède la PK `(player_id, definition_id)`, les FK vers Player/définition et deux FK optionnelles vers `business_operations`. Il stocke état, progression, baseline, report certain, dates et preuve de récompense. Les CHECK interdisent les valeurs négatives et un état `COMPLETED` dépourvu de `completed_at`, `rewarded_at` ou `reward_operation_id`; ce dernier est unique. Les index couvrent Player/état, définition/état, déblocages Z et opération déclenchante.

Le seed de migration et `prisma/seed.ts` sont déterministes et rejouables par `external_key`. Les Players existants reçoivent état + 31 progressions, B actif depuis `players.created_at`, A/S/Z verrouillés, baseline/report à 0 et marqueur de catch-up nul. Les nouveaux Players sont marqués par le service de provisionnement dans sa transaction. Aucun solde ni mouvement économique n’est écrit par 041 ou 042. Les trois tables ont RLS active et tous les droits `PUBLIC`, `anon`, `authenticated` révoqués.

---

## 17.2 Récompenses permanentes

Il n’existe pas de table générique `mission_rewards` physique dans le Lot 1 : chaque définition porte sa récompense Primogemmes unique. La preuve exactement-une-fois repose sur une `BusinessOperation` `permanent-mission.reward`, un `ResourceMovement` créé par Economy et le `reward_operation_id` unique de la progression, le tout dans la transaction appelante.

---

## 17.3 Progression et reprise

La progression effective vaut `carried_progress + max(compteur_autoritatif - baseline_value, 0)`, bornée à la cible. Baseline 0 couvre les standalone selon R301 ; les deux colonnes restent disponibles pour la future reprise conservative legacy R328. Le catch-up applicatif crée une `BusinessOperation` SYSTEM dédiée, relie les récompenses historiques à cette opération puis écrit `standalone_catchup_completed_at` atomiquement. Les migrations 041–042 n’exécutent aucun catch-up économique.

---

## 17.4 `player_daily_mission_state`

Une ligne par joueur/journée active.

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `business_date date NOT NULL`
- `mission_definition_id uuid NOT NULL REFERENCES mission_definitions(id) ON DELETE RESTRICT`
- `progress bigint NOT NULL DEFAULT 0`
- `switch_count integer NOT NULL DEFAULT 0`
- `purchased_at timestamptz NOT NULL`
- `completed_at timestamptz NULL`
- `rewarded_at timestamptz NULL`
- `mission_snapshot jsonb NOT NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, business_date)`

Contraintes :

- `progress >= 0`
- `switch_count >= 0`

---

# 18. Roue

## 18.1 `player_wheel_stats`

Colonnes :

- `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
- `total_spins bigint NOT NULL DEFAULT 0`
- `total_jackpots bigint NOT NULL DEFAULT 0`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- compteurs >= 0
- `total_jackpots <= total_spins`

---

## 18.2 `player_wheel_daily_states`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `business_date date NOT NULL`
- `spun_at timestamptz NULL`
- `result_known boolean NOT NULL DEFAULT true`
- `result_type text NULL`
- `resource_key text NULL REFERENCES resource_definitions(key)`
- `amount bigint NULL`
- `operation_id uuid NULL UNIQUE REFERENCES business_operations(id) ON DELETE SET NULL`
- `legacy_provenance jsonb NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, business_date)`

Une ligne native = Roue consommée.

---

# 19. Expedition

## 19.1 `player_expeditions`

Une ligne d'état courant par joueur.

Colonnes :

- `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
- `state expedition_state NOT NULL DEFAULT 'IDLE'`
- `character_id uuid NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `departed_at timestamptz NULL`
- `ready_at timestamptz NULL`
- `departure_business_date date NULL`
- `last_completed_at timestamptz NULL`
- `total_completed bigint NOT NULL DEFAULT 0`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes cohérence :

- `RUNNING/READY` => character + departed_at + ready_at + departure date non nuls
- `ready_at > departed_at`
- `total_completed >= 0`

La récompense historique détaillée n'est pas conservée ici.

Elle reste traçable via `resource_movements`.

---

# 20. Combat quotidien

## 20.1 `element_combat_matchups`

Matrice normalisée réellement migrée par 014. L'ancien modèle cible `element_combat_rules`, limité à un avantage et un désavantage par élément, est remplacé.

Colonnes :

- `attacker_element_key text NOT NULL REFERENCES elements(key) ON DELETE RESTRICT`
- `defender_element_key text NOT NULL REFERENCES elements(key) ON DELETE RESTRICT`
- `relation smallint NOT NULL CHECK (relation IN (-1, 1))`

PK : `PRIMARY KEY(attacker_element_key, defender_element_key)`. Attaquant et défenseur doivent être distincts. L'absence d'une paire signifie une relation neutre ; le seed canonique contient 28 relations.

---

## 20.2 `daily_combat_encounters`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `business_date date NOT NULL UNIQUE`
- `created_at timestamptz NOT NULL DEFAULT now()`

État physique 0.92 : aucune table `contest_results` séparée n’est créée. Le résultat permanent est normalisé dans le `Contest` terminal et ses quatre `ContestParticipant` snapshotés ; cette représentation couvre rang, score, récompense et historique sans dupliquer la vérité.

## 13.6 État physique candidat 0.92 — migration 017

La migration additive `20260913170000_017_add_contests` crée les enums thème, statut, phase, type de participant, type d’annulation et motif de remplacement. Elle ajoute à `c6_competition_progress` les compteurs globaux/thématiques et cinq planchers de titre, tous initialisés à zéro et bornés par contraintes, sans modifier les cinq statistiques 1..20 existantes.

Les tables physiques sont `contest_daily_themes`, `contests`, `contest_participants`, `contest_spectators`, `contest_daily_participations`, `contest_lobby_removals`, `contest_events` et `contest_rewards`. Les contraintes imposent thème unique par date, au plus un LOBBY/RUNNING global, quatre slots/ordres/rangs bornés, cohérence humain/bot, score non négatif, spectateur/daily uniques, trois retraits maximum et une récompense/opération unique. Les FK historiques sont restrictives ; seules les agrégations internes au concours utilisent les cascades nécessaires.

Toutes les tables 017 activent la RLS sans policy navigateur et révoquent `anon`/`authenticated`. Le backend avec rôle serveur reste le seul chemin d’écriture et l’API filtre l’historique public sur FINISHED.

---

## 20.3 `daily_combat_enemies`

Colonnes :

- `encounter_id uuid NOT NULL REFERENCES daily_combat_encounters(id) ON DELETE CASCADE`
- `position smallint NOT NULL`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `element_key_snapshot text NOT NULL REFERENCES elements(key) ON DELETE RESTRICT`

PK :

`PRIMARY KEY(encounter_id, position)`

Contraintes :

- `position BETWEEN 1 AND 4`
- `UNIQUE(encounter_id, character_id)`

---

## 20.4 `player_daily_combat_loadouts` et `player_daily_combat_loadout_slots`

Le parent persistant, indépendant du jour, porte :

- `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
- `next_attempt_mode combat_attempt_mode NOT NULL DEFAULT 'MANUAL'`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Les slots portent :

- `player_id uuid NOT NULL REFERENCES player_daily_combat_loadouts(player_id) ON DELETE CASCADE`
- `position smallint NOT NULL CHECK (position BETWEEN 1 AND 4)`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`

PK : `(player_id, position)` ; unicité `(player_id, character_id)`.

---

## 20.5 `player_daily_combat_states`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `encounter_id uuid NOT NULL REFERENCES daily_combat_encounters(id) ON DELETE CASCADE`
- `won_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, encounter_id)`

---

## 20.6 `player_daily_combat_kos`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `encounter_id uuid NOT NULL REFERENCES daily_combat_encounters(id) ON DELETE CASCADE`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, encounter_id, character_id)`

---

## 20.7 `daily_combat_attempts`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `encounter_id uuid NOT NULL REFERENCES daily_combat_encounters(id) ON DELETE RESTRICT`
- `mode combat_attempt_mode NOT NULL`
- `chance_half_points smallint NOT NULL CHECK (chance_half_points BETWEEN 10 AND 190)`
- `won boolean NOT NULL`
- `rng_roll smallint NOT NULL CHECK (rng_roll BETWEEN 1 AND 200)`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`

Index :

`(player_id, encounter_id, created_at DESC)`

---

## 20.8 `daily_combat_attempt_members`

Snapshot de l'équipe utilisée.

Colonnes :

- `attempt_id uuid NOT NULL REFERENCES daily_combat_attempts(id) ON DELETE CASCADE`
- `position smallint NOT NULL`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `rarity_snapshot smallint NOT NULL CHECK (rarity_snapshot IN (4, 5))`
- `constellation_snapshot smallint NOT NULL CHECK (constellation_snapshot BETWEEN 0 AND 6)`
- `element_key_snapshot text NOT NULL REFERENCES elements(key)`
- `contribution_half_points smallint NOT NULL`

PK :

`PRIMARY KEY(attempt_id, position)`

## 20.9 `player_combat_stats`

Une ligne par Player : `total_fights`, `total_wins`, `total_losses`, `total_manual_wins` en `bigint` non négatifs. Les contraintes imposent `total_fights = total_wins + total_losses` et `total_manual_wins <= total_wins`.

## 20.10 `player_character_combat_stats`

PK `(player_id, character_id)`, avec `wins` et `losses` en `bigint` non négatifs. Le nombre de combats et le taux de victoire sont dérivés.

## 20.11 État physique 0.86

La migration additive Prisma `20260912120000_014_add_daily_combat` crée `combat_attempt_mode` (`MANUAL`, `AUTO`) et toutes les tables 20.1 à 20.10. Les tables ont la RLS active, aucune policy navigateur, et tous les droits directs sont révoqués à `anon` et `authenticated`. Le Boss mensuel n'est pas créé par cette migration.

---

# 21. Boss mensuel

## 21.1 `monthly_bosses`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `year smallint NOT NULL`
- `month smallint NOT NULL`
- `name text NOT NULL`
- `base_hp bigint NOT NULL`
- `max_hp bigint NOT NULL`
- `current_hp bigint NOT NULL`
- `resistance_element_key text NOT NULL REFERENCES elements(key)`
- `status text NOT NULL`
- `final_blow_player_id uuid NULL REFERENCES players(id) ON DELETE SET NULL`
- `generated_at timestamptz NOT NULL`
- `defeated_at timestamptz NULL`
- `adaptive_config jsonb NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `UNIQUE(year, month)`
- `month BETWEEN 1 AND 12`
- `base_hp > 0`
- `max_hp > 0`
- `current_hp BETWEEN 0 AND max_hp`

---

## 21.2 `player_boss_loadout`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `position smallint NOT NULL`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, position)`

Contraintes :

- position 1..4
- unique character/player

---

## 21.3 `boss_attacks`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `boss_id uuid NOT NULL REFERENCES monthly_bosses(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `business_date date NOT NULL`
- `damage bigint NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `damage > 0`
- `UNIQUE(boss_id, player_id, business_date)`

Index :

- `(boss_id, damage DESC)`
- `(player_id, created_at DESC)`

---

## 21.4 `boss_attack_members`

Colonnes :

- `boss_attack_id uuid NOT NULL REFERENCES boss_attacks(id) ON DELETE CASCADE`
- `position smallint NOT NULL`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `rarity smallint NOT NULL`
- `constellation smallint NOT NULL`
- `element_key text NOT NULL REFERENCES elements(key)`
- `damage bigint NOT NULL`

PK :

`PRIMARY KEY(boss_attack_id, position)`

---

## 21.5 `boss_legacy_contributions`

Colonnes :

- `boss_id uuid NOT NULL REFERENCES monthly_bosses(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `total_damage bigint NOT NULL DEFAULT 0`
- `attack_count integer NOT NULL DEFAULT 0`
- `best_hit bigint NOT NULL DEFAULT 0`
- `last_attack_at timestamptz NULL`
- `rewarded boolean NOT NULL DEFAULT false`
- `migration_run_id uuid NULL`
- `provenance jsonb NOT NULL`

PK :

`PRIMARY KEY(boss_id, player_id)`

Aucune écriture native après cutover.

---

## 21.6 `boss_rewards`

Colonnes :

- `boss_id uuid NOT NULL REFERENCES monthly_bosses(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `rewarded_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(boss_id, player_id)`

Garantit une seule récompense communautaire.

---

# 22. Social / Amitié

## 22.1 `friendships`

Stocke une paire canonique.

État physique Batch C : `20260920210000_029_add_friendship_workflows` complète le socle 023 sans recréer cette table. L'ancien default/intervalle 0..1000 du socle minimal est corrigé à **1..1000**, conformément à R457 et aux invariants de l'audit. La migration refuse une ligne incompatible au lieu de réécrire silencieusement un historique ; la table était vide lors du contrôle DEV préalable.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_a_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `player_b_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `state friendship_state NOT NULL DEFAULT 'ACTIVE'`
- `level integer NOT NULL DEFAULT 1`
- `total_hearts bigint NOT NULL DEFAULT 0`
- compteurs directionnels legacy si nécessaires
- `became_friends_at timestamptz NULL`
- `archived_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `player_a_id < player_b_id` conceptuellement pour canonicaliser la paire
- `UNIQUE(player_a_id, player_b_id)`
- `level BETWEEN 1 AND 1000`
- `total_hearts >= 0`

Le service ordonne toujours les UUID avant insertion.

---

## 22.2 `friend_requests`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `sender_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `recipient_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `state friend_request_state NOT NULL DEFAULT 'PENDING'`
- `source_channel source_channel NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `resolved_at timestamptz NULL`

Contraintes :

sender != recipient

Index unique partiel :

une demande ouverte max par paire non orientée.

Physique 029 : index unique partiel sur `LEAST(sender_player_id, recipient_player_id), GREATEST(...) WHERE state = 'PENDING'`, index `(sender_player_id, state)` et `(recipient_player_id, state)`, CHECK expéditeur distinct et cohérence de `resolved_at`. Les demandes résolues restent conservées. Les intentions/replays sont portés par `BusinessOperation`, sans clé concurrente dans la demande.

---

## 22.3 `friend_hearts`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `friendship_id uuid NOT NULL REFERENCES friendships(id) ON DELETE RESTRICT`
- `sender_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `recipient_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `business_date date NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

`UNIQUE(friendship_id, sender_player_id, business_date)`

Physique 029 : unicité de `operation_id`, index expéditeur/date et destinataire, CHECK participants distincts et trigger `check_friend_heart_pair` vérifiant leur appartenance à la relation. La fonction reste SECURITY INVOKER et son exécution directe est révoquée à PUBLIC/anon/authenticated. La migration additive 030 fixe explicitement son `search_path` à `pg_catalog, public`, sans recréer la fonction ni le trigger. Le verrou quotidien survit à l'archivage puisque le cœur et l'identité de la relation sont conservés.

### `player_social_stats`

Physique 029 : `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE RESTRICT`, `total_friend_hearts_sent bigint NOT NULL DEFAULT 0 CHECK (total_friend_hearts_sent >= 0)`, `updated_at timestamptz NOT NULL`. Compteur cumulatif indépendant de l'historique détaillé pour permettre une future reprise legacy exacte.

Les trois nouvelles tables ont RLS activée, sans politique navigateur ni droits PUBLIC/anon/authenticated. Les crédits utilisent les ledgers économiques existants. Aucun import legacy ni reset de confidentialité.

---

## 22.4 `player_blocks`

Colonnes :

- `blocker_player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `blocked_player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `created_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(blocker_player_id, blocked_player_id)`

Contrainte :

blocker != blocked

---

# 23. Présence

## 23.1 `player_sessions`

État physique Batch B : migration additive `20260920130000_028_add_social_presence`, pour cette table et `player_activity_state`. Hash SHA-256 unique, CHECK format/chronologie, FK cascade Player, index `(player_id, ended_at)` et heartbeat. RLS activée et tous droits PUBLIC/anon/authenticated révoqués sur les deux tables ; seuls les services backend lisent/écrivent. Le modèle actuel n'utilise pas `client_metadata`. Le suivi et le checksum vérifiés sont consignés dans le Master.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `session_token_hash text NOT NULL UNIQUE`
- `started_at timestamptz NOT NULL DEFAULT now()`
- `last_heartbeat_at timestamptz NOT NULL DEFAULT now()`
- `last_activity_at timestamptz NULL`
- `ended_at timestamptz NULL`

Index :

- `(player_id, ended_at)`
- `(last_heartbeat_at)`

L'état En ligne/Absent/Hors ligne reste dérivé.

---

## 23.2 `player_activity_state`

Une ligne par joueur pour faciliter les lectures.

Colonnes :

- `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
- `last_app_activity_at timestamptz NULL`
- `last_internal_chat_at timestamptz NULL`
- `last_twitch_activity_at timestamptz NULL`
- `last_gameplay_activity_at timestamptz NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Aucun `last_seen` universel.

---

# 24. Confidentialité

## 24.1 `privacy_settings`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `category_key text NOT NULL`
- `level privacy_level NOT NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, category_key)`

Les lignes présentes sont des overrides. Batch B applique la matrice serveur R518/R519 version 1 aux catégories sans ligne ; aucun seed/backfill ne réinitialise les réglages existants.

---

# 25. Cosmétiques

## 25.1 `cosmetic_definitions`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `external_key text NOT NULL UNIQUE`
- `type text NOT NULL`
- `display_name text NOT NULL`
- `asset_path text NULL`
- `unlock_rule jsonb NULL`
- `condition_text text NULL`
- `visibility cosmetic_visibility NOT NULL DEFAULT 'VISIBLE'`
- `is_active boolean NOT NULL DEFAULT true`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

---

## 25.2 `player_cosmetics`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `cosmetic_id uuid NOT NULL REFERENCES cosmetic_definitions(id) ON DELETE RESTRICT`
- `unlocked_at timestamptz NOT NULL`
- `unlock_source text NOT NULL`
- `provenance jsonb NULL`

PK :

`PRIMARY KEY(player_id, cosmetic_id)`

---

## 25.3 Équipement cosmétique

Dans `players` ou table dédiée légère :

- `equipped_avatar_cosmetic_id`
- `equipped_title_cosmetic_id`

Le mapping 045 retient les deux colonnes nullable sur `players`, avec FK `ON DELETE RESTRICT`. Le service serveur impose possession, type et activité avant un nouvel équipement ; l'avatar élémentaire reste une projection de `element_key`, sans fausse possession. `cosmetic_definitions` et `player_cosmetics` ont RLS active et aucun grant navigateur direct. La 045 est appliquée et suivie sur DEV ; elle ne seed aucun cosmétique.

La migration additive `20260926100000_046_clear_disabled_equipped_avatars` crée un trigger `AFTER UPDATE OF is_active` sur `cosmetic_definitions`. Au seul passage `true → false` d'un `AVATAR`, il met à `NULL` les références `players.equipped_avatar_cosmetic_id` correspondantes. Il ne touche ni aux possessions, ni aux titres, ni aux notifications ; un retour à `true` ne restaure aucun équipement. La migration additive `20260926110000_047_harden_avatar_trigger_search_path` fixe `search_path = pg_catalog, public` sur la fonction existante du trigger sans recréer celui-ci ni modifier son corps ou les données. 045 et 046 restent byte pour byte inchangées. DEV compte 47 migrations terminées ; les deux tables Apparence gardent RLS et aucune permission directe `PUBLIC`/`anon`/`authenticated`.

La migration additive `20260926130000_048_unlock_owned_character_avatars` ajoute `cosmetic_definitions.source_character_id` nullable avec FK `ON DELETE RESTRICT`, index unique et CHECK imposant `type = AVATAR` lorsqu'il est renseigné. Elle crée une définition par Character 4★/5★ déjà possédé par au moins un Player, sans copier `icon_path` dans `asset_path`, puis insère les possessions manquantes et une notification agrégée par Player d'après les lignes effectivement insérées. Sur DEV après le nettoyage audité des fixtures : 28 définitions, 60 `player_cosmetics`, cinq notifications (25, 24, 7, 2, 2), zéro modification de `player_characters` ou de l'économie. DEV compte désormais **48 migrations terminées**, aucune rollback ; checksum 048 `15f1a8291309920cbf65c2a8b1b14d78ba56a4209eb6c7e8b84d0c48773dabf2`, identique au registre Prisma. Les deux tables Apparence gardent RLS et zéro permission directe `PUBLIC`/`anon`/`authenticated`. 045–047 restent inchangées.

---

# 26. Messages privés

État physique courant : les migrations 036–039 matérialisent conversations, participants, demandes, messages, lecture partagée et ordre serveur. La 040 ajoute la preuve de signalement MP et la migration additive `20260925100000_043_add_direct_message_replies` ajoute l'auto-référence nullable de R898, sans backfill. DEV suit **43 migrations Prisma** appliquées. Les cinq tables ont RLS active, aucune policy navigateur et aucun droit `PUBLIC`/`anon`/`authenticated`. R515 reste sans DDL ; R509/R510/R517 et R898 conservent la frontière privée et la preuve serveur jusqu'à 10/cible/10 messages.

## 26.1 `direct_conversations`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_a_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `player_b_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `last_message_at timestamptz NULL`
- `last_message_order bigint NULL`

La paire est ordonnée par CHECK et unique. Elle constitue l'identité durable d'une conversation exactement entre ces deux Players ; un trigger interdit participant, demande ou auteur hors paire.

---

## 26.2 `direct_conversation_participants`

Colonnes :

- `conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `joined_at timestamptz NOT NULL DEFAULT now()`
- `archived_at timestamptz NULL`
- `last_read_message_id uuid NULL`
- `last_read_created_at timestamptz NULL`
- `last_read_submission_order bigint NULL`
- `read_receipts_enabled boolean NOT NULL DEFAULT true`
- `last_shared_read_message_id uuid NULL`
- `last_shared_read_created_at timestamptz NULL`
- `last_shared_read_submission_order bigint NULL`
- `last_shared_read_at timestamptz NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(conversation_id, player_id)`

Index :

`(player_id, archived_at)` et index des deux FK de curseur.

`last_shared_read_at` mémorise l'heure de lecture, jamais le `created_at` du message. Il avance dans la même écriture monotone que `last_shared_read_*`, uniquement si le curseur interne progresse et si les accusés sont actifs. Désactiver puis réactiver les accusés ne publie donc aucune lecture intermédiaire rétroactivement.

Le curseur interne avance même lorsque l'accusé est désactivé ; seul le curseur partagé s'arrête, afin qu'une lecture future ne soit pas communiquée.

---

## 26.3 `direct_conversation_requests`

Colonnes : conversation, expéditeur, destinataire, `first_message_id`, état `PENDING | ACCEPTED | REFUSED`, création, résolution et `retry_after`. Un index unique partiel limite chaque conversation à une demande `PENDING`. Les CHECKs imposent deux Players distincts et exactement 24 h entre résolution et retry d'un refus.

---

## 26.4 `direct_messages`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE RESTRICT`
- `author_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `content text NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `submission_order bigint NOT NULL DEFAULT nextval('direct_messages_submission_order_seq') UNIQUE`
- `edited_at timestamptz NULL`
- `deleted_at timestamptz NULL`
- `restored_at timestamptz NULL`
- `content_purged_at timestamptz NULL`
- `reply_to_message_id uuid NULL REFERENCES direct_messages(id) ON DELETE RESTRICT`

Contraintes :

- contenu présent de 1..1000 caractères, ou contenu nul seulement avec suppression et purge futures explicites

Index :

- `(conversation_id, submission_order DESC)`
- `(author_player_id, created_at DESC)`
- `(reply_to_message_id)`

Les messages restent historiquement conservés. `submission_order` est réservé avant les traitements susceptibles d'inverser les commits ; il gouverne le fil, les 500 plus récents, les curseurs de lecture, accusés, non-lus et `last_message_order`. `created_at` reste descriptif. Le service n'expose que les 500 plus récents dans la conversation normale ; R515 lit toutes les lignes via une route Historique séparée, paginée par keyset sur le même ordre. `reply_to_message_id` ne copie aucun contenu : le serveur joint la cible pour produire un aperçu dynamique et refuse à l'écriture toute cible absente, supprimée, purgée ou issue d'une autre conversation.

Les `EXPLAIN (ANALYZE, BUFFERS)` R515 ont été exécutés dans une transaction rollbackée sur 250 000 lignes synthétiques, sans Player réel. La pagination utilise bien `direct_messages_conversation_submission_idx`. Sur cette donnée représentative, la recherche bornée à une conversation reste à environ 5,5 ms avec l'index existant, tandis qu'un GIN trigram expérimental atteint environ 20,4 ms à froid ; `pg_trgm` est disponible mais non installé. L'ancre date passe d'environ 2,3 ms à 1,8 ms avec un index expérimental conversation/date. Ces gains n'ont nécessité aucun index R515 supplémentaire ; la migration 040 ultérieure concerne exclusivement les signalements.

Le lot avancé promu ne change aucun DDL. Les mutations auteur-only mettent à jour la ligne sous transaction sérialisable et `BusinessOperation` idempotente. `deleted_at` masque immédiatement `content` dans toute projection normale ; `restored_at` trace le dernier retour. La fenêtre R504 est gouvernée uniquement par `submission_order` : avec 499 lignes plus récentes, une suppression conserve le contenu serveur et `content_purged_at = NULL`; avec 500 lignes plus récentes, elle écrit atomiquement `content = NULL` et `content_purged_at = now`. À chaque insertion MP, une lecture indexée de la 500e position conserve en complément la purge des tombstones qui sortent ultérieurement de cette fenêtre. Les messages actifs ne sont jamais purgés et aucun scan JS de la table n'est effectué.

---

## 26.5 `direct_message_reports` — migration 040

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `reporter_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `reported_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE RESTRICT`
- `message_id uuid NOT NULL REFERENCES direct_messages(id) ON DELETE RESTRICT`
- `message_snapshot jsonb NOT NULL`
- `context_snapshot jsonb NOT NULL`
- `snapshot_fingerprint text NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes/index : unique `(reporter_player_id, message_id)`, index `created_at DESC`, `(reported_player_id, created_at DESC)`, `(conversation_id, created_at DESC)` et FK message. Les JSON sont écrits une fois et jamais recalculés depuis les messages courants. La table ne porte ni raison, ni statut, ni sanction. RLS est active et `REVOKE ALL` vise `PUBLIC`, `anon`, `authenticated`; seul le backend authentifié y accède. Les administrateurs et modérateurs ne disposent d'aucune lecture libre des MP.

---

# 27. Chat global

Cible relationnelle alignée sur le [contrat Chat global R872–R895](../specifications/global-chat-v1.md). La migration additive 032 matérialise `global_chat_messages` et `global_chat_read_states` dans Prisma ; 033 corrige la contrainte de contenu interne ; 034 ajoute mentions, signalements et éligibilité du Défi Messages ; 035 ajoute la génération de visibilité ; 039 ajoute l'ordre de réception serveur au Chat et aux MP sans réécrire 038.

## 27.1 `global_chat_messages`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `author_player_id uuid NULL REFERENCES players(id) ON DELETE RESTRICT`
- `source_channel source_channel NOT NULL`
- `message_type global_chat_message_type NOT NULL` (`PLAYER`, `COMMAND`, `GAME_RESULT`, `SYSTEM`)
- `content text NOT NULL`
- `external_message_id text NULL`
- `operation_id uuid NULL REFERENCES business_operations(id) ON DELETE SET NULL`
- `reply_to_message_id uuid NULL REFERENCES global_chat_messages(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `submission_order bigint NOT NULL DEFAULT nextval('global_chat_messages_submission_order_seq') UNIQUE`
- `deleted_at timestamptz NULL`
- `deletion_state global_chat_deletion_state NOT NULL DEFAULT ACTIVE` (`ACTIVE`, `AUTHOR`, `MODERATION`)
- `generation integer NOT NULL DEFAULT 0` — génération visible du message, conservée lors d'un clear.

Index uniques :

`UNIQUE(source_channel, external_message_id)` et `UNIQUE(operation_id)` ; PostgreSQL accepte plusieurs `NULL`.

Index :

`(created_at DESC, id DESC)`, `(generation, submission_order DESC)`, `(author_player_id, created_at DESC)` et `(reply_to_message_id)`.

Les CHECKs lient l'état de suppression à `deleted_at`, imposent un auteur aux messages joueur/commande et bornent le contenu interne joueur à 1–500 caractères sans saut de ligne. `global_chat_read_states` porte `player_id` comme PK/FK, `last_read_message_id` comme FK, `last_read_created_at`, `last_read_submission_order`, `generation` et `updated_at`. `submission_order` est réservé avant le traitement métier et devient l'unique chronologie player-facing ; `created_at` demeure descriptif et la paire temps/ID reste seulement le format de curseur API compatible, résolu vers l'ordre canonique. Les deux tables ont RLS activée, aucun droit direct `PUBLIC`/`anon`/`authenticated` et aucune policy navigateur permissive. Aucun `edited_at` global n'est requis. Le contenu supprimé est masqué par la projection serveur ; l'aperçu de réponse suit l'état actuel de la cible. Masquage local et rétention exacte restent distincts.

## 27.2 Mentions et signalements — migration 034

`global_chat_mentions` possède la clé `(message_id, mentioned_player_id)`, deux FK restrictives et un index `(mentioned_player_id, created_at DESC)`. Le serveur vérifie Player ACTIVE, pseudo courant présent dans le texte et absence de blocage dans les deux sens. Le flux ne projette que `mentionedMe` pour le lecteur courant.

`global_chat_reports` possède un UUID, `reporter_player_id`, `message_id`, `reported_player_id`, `message_snapshot jsonb`, `context_snapshot jsonb` et `created_at`. L'unicité reporter/message empêche les doublons ; les FK sont restrictives et le CHECK interdit l'auto-signalement. Le snapshot privé fige la cible et au plus dix messages précédents et suivants déjà existants. Aucune route de lecture arbitraire de ces dossiers n'est exposée. Les deux nouvelles tables ont RLS active, aucun grant navigateur et aucune policy permissive.

## 27.3 Frontière de visibilité — migration 035

`global_chat_state` contient une seule ligne `id = 1`, `generation integer NOT NULL DEFAULT 0` et `updated_at`. Un CHECK borne l'ID et la génération. `global_chat_messages.generation` et `global_chat_read_states.generation` sont additifs, non nuls et initialisés à 0 ; depuis 039, l'index `(generation, submission_order DESC)` sert les pages visibles. `!clear` augmente la génération sous verrou et garde toutes les anciennes lignes dans la base. La table d'état a RLS active et aucun droit `PUBLIC`/`anon`/`authenticated` ; seul le backend accède au modèle. R890 borne désormais toutes les projections joueur aux 200 dernières lignes de cette génération sans purge SQL.

## 27.4 Ordre de réception — migration 039

Les séquences `global_chat_messages_submission_order_seq` et `direct_messages_submission_order_seq` réservent une position monotone avant les traitements métier. Les historiques sont rétro-remplis séparément par `row_number() OVER (ORDER BY created_at, id)` ; lectures Chat/MP, curseur partagé et dernier message MP reprennent la position de leur message. Les gaps dus à un rejet après réservation sont admis et n'altèrent pas l'ordre. `GAME_RESULT`/`SYSTEM` prennent leur position lors de leur insertion, donc après leur commande. RLS reste inchangée et les séquences ne donnent aucun droit à `PUBLIC`, `anon` ou `authenticated`.

---

# 28. Events

## 28.1 `event_definitions`

Décrit un Festival récurrent.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `external_key text NOT NULL UNIQUE`
- `display_name text NOT NULL`
- `calendar_month smallint NOT NULL`
- `currency_key text NOT NULL UNIQUE`
- `config jsonb NOT NULL`
- `is_active boolean NOT NULL DEFAULT true`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes physiques :

- `calendar_month BETWEEN 1 AND 12`
- `calendar_month` unique
- clés externes et monnaies uniques au format stable
- `config` est un objet JSON

---

## 28.2 `event_editions`

Une édition mensuelle concrète.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `event_definition_id uuid NOT NULL REFERENCES event_definitions(id) ON DELETE RESTRICT`
- `year smallint NOT NULL`
- `starts_at timestamptz NOT NULL`
- `ends_at timestamptz NOT NULL`
- `status event_edition_status NOT NULL`
- `snapshot jsonb NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `UNIQUE(event_definition_id, year)`
- `starts_at < ends_at`

---

## 28.3 `player_event_currency_balances`

Monnaie saisonnière durable entre éditions annuelles.

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `event_definition_id uuid NOT NULL REFERENCES event_definitions(id) ON DELETE RESTRICT`
- `amount bigint NOT NULL DEFAULT 0`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, event_definition_id)`

Contrainte :

`amount >= 0`

---

## 28.4 `event_participants`

Colonnes :

- `event_edition_id uuid NOT NULL REFERENCES event_editions(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `points integer NOT NULL DEFAULT 0`
- `joined_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(event_edition_id, player_id)`

Contrainte :

`points >= 0`

## 28.4.1 État physique Event Lot 1

La migration `20260915120000_020_add_monthly_event_foundations` matérialise exactement les sections 28.1 à 28.4. Les douze lignes `event_definitions` possèdent des UUID fixes, des mois uniques 1..12 et un `config` portant emoji, libellé de monnaie et métadonnée Collection. Le seed ne crée ni édition, ni participation, ni balance Player.

Les éditions sont matérialisées paresseusement par le service avec l’unicité définition/année, des bornes calculées au début des mois `Europe/Paris`, le statut initial `ACTIVE` et un snapshot de définition. La participation reste annuelle et porte les points ; la balance monétaire reste durable sur Player/définition, donc indépendante de l’édition et des autres Festivals.

Les quatre tables ont RLS active sans policy client et les droits directs `anon`/`authenticated` sont révoqués. Les tables des sections 28.6 à 28.10 restent des cibles futures non matérialisées par 020 ; la section 28.5 est désormais matérialisée séparément par la migration 021.

---

## 28.5 `event_daily_player_states`

Colonnes :

- `event_edition_id uuid NOT NULL REFERENCES event_editions(id) ON DELETE CASCADE`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `business_date date NOT NULL`
- `game_a_success boolean NOT NULL DEFAULT false`
- `game_a_attempts integer NOT NULL DEFAULT 0`
- `game_a_last_attempt_at timestamptz NULL`
- `game_b_attempts_used integer NOT NULL DEFAULT 0`
- `game_c_sent boolean NOT NULL DEFAULT false`
- `daily_bonus_claimed boolean NOT NULL DEFAULT false`
- `state jsonb NOT NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(event_edition_id, player_id, business_date)`

Index :

`INDEX(player_id, business_date DESC)`

Contraintes :

- `game_a_attempts >= 0`
- `game_b_attempts_used >= 0`
- `jsonb_typeof(state) = 'object'`

### 28.5.1 État physique Event Lot 2 — Jeu A

La migration `20260915180000_021_add_event_game_a` matérialise cette table quotidienne commune. Elle n’implémente aucune mécanique Jeu B, Jeu C ou bonus quotidien : leurs colonnes structurelles restent à leurs valeurs par défaut pour permettre les extensions prévues sans table concurrente.

`game_a_last_attempt_at` est une colonne explicite plutôt qu’une chaîne enfouie dans `state` : la mutation peut ainsi verrouiller la ligne et comparer atomiquement le cooldown serveur de trois secondes avec un type temporel PostgreSQL. `state` reste réservé à la configuration quotidienne versionnée :

```json
{
  "version": 1,
  "gameA": {
    "windows": [
      { "startMinute": 420, "endMinute": 480 },
      { "startMinute": 720, "endMinute": 780 },
      { "startMinute": 1080, "endMinute": 1140 }
    ]
  }
}
```

Les valeurs illustrent uniquement la forme. Le service génère et persiste trois débuts personnels uniformes à la minute dans les intervalles autorisés, avec `endMinute = startMinute + 60`. La clé primaire rend unique la matérialisation par édition, Player et business date. Les deux clés étrangères sont couvertes par la clé primaire ou l’index Player/date. RLS est active, sans policy navigateur permissive, et les droits directs `anon`/`authenticated` sont révoqués.

---

## 28.6 `event_game_b_daily_states`

Colonnes :

- `event_edition_id uuid NOT NULL REFERENCES event_editions(id) ON DELETE CASCADE`
- `business_date date NOT NULL`
- `solution_code text NOT NULL`
- `solved_at timestamptz NULL`
- `discoverer_player_id uuid NULL REFERENCES players(id) ON DELETE SET NULL`
- `tested_codes jsonb NOT NULL DEFAULT '[]'::jsonb`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(event_edition_id, business_date)`

### 28.6.1 État physique Event Lot 3 — Jeu B

La migration additive `20260916120000_022_add_event_game_b` matérialise cette unique ligne globale par édition et business date. `solution_code` est contraint à cinq bits (`^[01]{5}$`) et `tested_codes` à un tableau JSON ; le service valide en plus chaque entrée, son unicité et son appartenance aux 32 possibilités. La FK édition est couverte par la clé primaire ; la FK facultative du découvreur possède son index dédié et passe à `NULL` si le Player est supprimé sans annuler l'état résolu. La table a RLS active, aucune policy navigateur permissive et aucun droit direct `anon`/`authenticated`.

Le compteur personnel `game_b_attempts_used` reste dans `event_daily_player_states` (migration 021) : aucune seconde table d'essais n'est créée. La solution demeure privée au serveur ; seuls résolu, découvreur, codes testés/restants et quota personnel sont projetés. La résolution et la distribution collective ont lieu dans la même transaction sérialisable.

---

## 28.7 `event_milestone_claims`

Colonnes :

- `event_edition_id uuid NOT NULL REFERENCES event_editions(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `milestone integer NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `claimed_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(event_edition_id, player_id, milestone)`

### 28.7.1 État physique Event Lot 5

La migration additive `20260917120000_024_add_event_milestones` matérialise `event_milestone_claims` sans modifier les migrations 001–023. La clé composite empêche un second versement pour le même palier de la même édition ; `operation_id` est unique et référence l'opération métier système qui trace le versement. Les clés étrangères et leur index Player sont présents, la RLS est activée et les droits directs `anon`/`authenticated` sont révoqués. Les claims sont créées automatiquement dans la transaction sérialisable d'attribution des points, y compris lorsque plusieurs seuils sont franchis d'un seul coup. Aucun rattrapage économique global n'est exécuté lors de la migration.

---

## 28.8 `event_social_messages`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `event_edition_id uuid NOT NULL REFERENCES event_editions(id) ON DELETE RESTRICT`
- `business_date date NOT NULL`
- `sender_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `recipient_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `content text NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `viewed_at timestamptz NULL` : consultation effective de Panier, indépendante de la lecture d'une notification.

Index :

`(recipient_player_id, event_edition_id, business_date, created_at)`

La migration additive `20260916180000_023_add_event_game_c` matérialise cette table, ainsi que le seul socle Social nécessaire à R609 : `friendships`, `player_blocks` et `privacy_settings` avec le réglage `PRIVATE_MESSAGES` initialement `PUBLIC`. Les index additionnels couvrent les FK expéditeur, édition/date, deuxième joueur d'une amitié et joueur bloqué. Les quatre tables ont RLS activée et aucun droit direct `anon`/`authenticated`. Elle ne matérialise pas demandes d'ami, MP généraux, présence ni UI Social. Les messages Event historiques sont conservés ; la projection Panier filtre la business date `Europe/Paris`.

---

## 28.9 `event_collection_acquisitions`

Colonnes :

- `event_edition_id uuid NOT NULL REFERENCES event_editions(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `item_id uuid NOT NULL REFERENCES item_definitions(id) ON DELETE RESTRICT`
- `item_acquisition_id uuid NOT NULL UNIQUE REFERENCES item_acquisitions(id) ON DELETE RESTRICT`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `acquired_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(event_edition_id, player_id)`

La migration additive `20260917180000_025_add_event_shop_collection` matérialise uniquement ce garde-fou annuel. L'édition identifie déjà la définition du Festival et son année : une seconde acquisition du même Player pour cette édition est impossible, tandis que l'édition de l'année suivante possède une clé distincte. `item_id` désigne l'objet réel du catalogue ; `item_acquisition_id` relie l'entrée du ledger générique. Les index couvrent les FK non couvertes par la PK ou les uniques. RLS est active et les droits directs `anon`/`authenticated` sont révoqués. Cette table ne porte aucun stock : `player_items.quantity` reste autoritatif. Aucun backfill fictif ni modification des migrations 001–024.

---

## 28.10 `event_calendar_claims`

Colonnes :

- `event_edition_id uuid NOT NULL REFERENCES event_editions(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `calendar_day smallint NOT NULL`
- `reward_amount smallint NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `claimed_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(event_edition_id, player_id, calendar_day)`

Contrainte :

`calendar_day BETWEEN 1 AND 25`

État physique candidat Noël : migration additive `20260919120000_026_add_event_christmas_calendar`, sans modification 001–025. CHECK supplémentaire : jours 1–24 avec `reward_amount BETWEEN 1 AND 5`, ou jour 25 avec `reward_amount = 50`. Le montant est définitif après commit ; un replay ne retire jamais une nouvelle valeur.

Index unique `operation_id`, index `player_id` ; le préfixe de la PK couvre `event_edition_id`. FK `ON DELETE RESTRICT`, RLS activée et droits `PUBLIC`, `anon`, `authenticated` révoqués. Le serveur seul exécute la transaction sérialisable claim + incrément du solde saisonnier + complétion de l'opération, avec verrou Player et édition. Aucune attribution de points/palier. L'inscription et la date exacte Europe/Paris restent des validations métier serveur ; aucun accès SQL navigateur.

---

# 29. Codes cadeaux

## 29.1 `gift_codes`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `token text NOT NULL UNIQUE`
- `title text NOT NULL`
- `description text NOT NULL`
- `type gift_code_type NOT NULL`
- `status gift_code_status NOT NULL`
- `recurring_month smallint NULL`
- `starts_at timestamptz NULL`
- `ends_at timestamptz NULL`
- `published_at timestamptz NULL`
- `disabled_at timestamptz NULL`
- `created_by_id uuid NULL REFERENCES players(id) ON DELETE SET NULL`
- `updated_by_id uuid NULL REFERENCES players(id) ON DELETE SET NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Le token peut être verrouillé après premier claim par service métier.

---

## 29.2 `gift_code_editions`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `gift_code_id uuid NOT NULL REFERENCES gift_codes(id) ON DELETE RESTRICT`
- `edition_key text NOT NULL`
- `starts_at timestamptz NOT NULL`
- `ends_at timestamptz NOT NULL`
- `year smallint NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

`UNIQUE(gift_code_id, edition_key)`

---

## 29.3 `gift_code_rewards`

Colonnes :

- `gift_code_id uuid NOT NULL REFERENCES gift_codes(id) ON DELETE CASCADE`
- `resource_key text NOT NULL REFERENCES resource_definitions(key)`
- `amount bigint NOT NULL`

PK :

`PRIMARY KEY(gift_code_id, resource_key)`

Contrainte :

`amount > 0`

---

## 29.4 `gift_code_claims`

Colonnes :

- `gift_code_edition_id uuid NOT NULL REFERENCES gift_code_editions(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `source_channel source_channel NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `claimed_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(gift_code_edition_id, player_id)`

État physique candidat 0.97 : migration additive `20260914180000_019_add_gift_codes`, quatre tables avec RLS active et `REVOKE ALL ... FROM anon, authenticated`. Les types sont des enums PostgreSQL ; des checks bornent token, récurrence, période, montants positifs et les neuf seules ressources autorisées. Les récompenses vivent sur la définition car l’API ne propose aucune mutation de leur snapshot ; les éditions conservent les périodes annuelles/ponctuelles et les claims expliquent exactement quelle définition a été distribuée. La migration insère les douze définitions Festival annuelles et leurs deux récompenses, sans ligne dans `gift_code_claims`, `business_operations`, `resource_movements` ou les soldes joueurs.

---

# 30. Faveur

## 30.1 `player_favors`

Une ligne par joueur.

Colonnes :

- `player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE`
- `active_from_date date NULL`
- `active_until_date date NULL`
- `legacy_obtained_at timestamptz NULL`
- `legacy_last_claim_date date NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

- si les deux existent : `active_from_date <= active_until_date`

Le nombre de jours restants est dérivé.

---

## 30.2 `favor_grants`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `twitch_event_receipt_id uuid NULL`
- `subscription_tier text NULL`
- `requested_days integer NOT NULL`
- `added_days integer NOT NULL`
- `blocked_days integer NOT NULL DEFAULT 0`
- `immediate_primogems bigint NOT NULL DEFAULT 0`
- `compensation_primogems bigint NOT NULL DEFAULT 0`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

tous les nombres >= 0.

---

## 30.3 `favor_daily_claims`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `business_date date NOT NULL`
- `source_channel source_channel NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `claimed_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, business_date)`

---

# 31. Giveaway

## 31.1 `giveaway_sessions`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `state giveaway_state NOT NULL`
- `opened_by_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `opened_at timestamptz NOT NULL DEFAULT now()`
- `closed_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Index unique partiel :

un seul Giveaway `OPEN`.

---

## 31.2 `giveaway_participants`

Colonnes :

- `giveaway_session_id uuid NOT NULL REFERENCES giveaway_sessions(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `joined_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(giveaway_session_id, player_id)`

---

## 31.3 `giveaway_chat_stats`

Colonnes :

- `giveaway_session_id uuid NOT NULL REFERENCES giveaway_sessions(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `message_count bigint NOT NULL DEFAULT 0`

PK :

`PRIMARY KEY(giveaway_session_id, player_id)`

---

## 31.4 `giveaway_wins`

Permet le gagnant initial et les rerolls.

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `giveaway_session_id uuid NOT NULL REFERENCES giveaway_sessions(id) ON DELETE RESTRICT`
- `draw_index integer NOT NULL`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `drawn_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

`UNIQUE(giveaway_session_id, draw_index)`

---

# 32. Twitch / événements externes

## 32.1 `twitch_event_receipts`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `external_event_id text NOT NULL UNIQUE`
- `event_type text NOT NULL`
- `twitch_user_id text NULL`
- `state twitch_receipt_state NOT NULL DEFAULT 'RECEIVED'`
- `external_reference text NULL`
- `payload_hash text NULL`
- `payload_minimal jsonb NULL`
- `received_at timestamptz NOT NULL DEFAULT now()`
- `processed_at timestamptz NULL`
- `error_message text NULL`

Index :

- `(event_type, received_at DESC)`
- `(twitch_user_id, received_at DESC)`

---

## 32.2 `gift_supreme_redemptions`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `redemption_id text NOT NULL UNIQUE`
- `twitch_event_receipt_id uuid NOT NULL UNIQUE REFERENCES twitch_event_receipts(id) ON DELETE RESTRICT`
- `reward_id text NOT NULL`
- `gifter_twitch_user_id text NOT NULL`
- `gifter_player_id uuid NULL REFERENCES players(id) ON DELETE SET NULL`
- `beneficiary_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `status text NOT NULL`
- `resource_key text NOT NULL REFERENCES resource_definitions(key)`
- `amount bigint NOT NULL`
- `operation_id uuid NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `processed_at timestamptz NULL`

Contrainte :

`amount > 0`

---

# 33. Notifications

## 33.1 `notifications`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `domain_key text NOT NULL`
- `type_key text NOT NULL`
- `payload jsonb NOT NULL`
- `state notification_state NOT NULL DEFAULT 'UNREAD'`
- `action_key text NULL`
- `action_target_id text NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `read_at timestamptz NULL`
- `resolved_at timestamptz NULL`
- `archived_at timestamptz NULL`

Index :

- `(player_id, state, created_at DESC)`
- `(player_id, created_at DESC)`

Une notification actionable devient `RESOLVED` dès que son action n'est plus disponible.

---

# 34. Migration / provenance

## 34.1 `migration_runs`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `source_commit_sha text NULL`
- `source_snapshot_label text NOT NULL`
- `status text NOT NULL`
- `started_at timestamptz NOT NULL DEFAULT now()`
- `completed_at timestamptz NULL`
- `summary jsonb NULL`

---

## 34.2 `migration_source_snapshots`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `migration_run_id uuid NOT NULL REFERENCES migration_runs(id) ON DELETE CASCADE`
- `source_name text NOT NULL`
- `content_hash text NOT NULL`
- `metadata jsonb NULL`
- `captured_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

`UNIQUE(migration_run_id, source_name)`

---

## 34.3 `migration_mappings`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `migration_run_id uuid NOT NULL REFERENCES migration_runs(id) ON DELETE CASCADE`
- `source_name text NOT NULL`
- `legacy_type text NOT NULL`
- `legacy_key text NOT NULL`
- `target_type text NOT NULL`
- `target_id uuid NOT NULL`
- `mapping_metadata jsonb NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

`UNIQUE(migration_run_id, source_name, legacy_type, legacy_key, target_type)`

---

## 34.4 `migration_issues`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `migration_run_id uuid NOT NULL REFERENCES migration_runs(id) ON DELETE CASCADE`
- `source_name text NOT NULL`
- `legacy_key text NULL`
- `severity text NOT NULL`
- `issue_code text NOT NULL`
- `description text NOT NULL`
- `details jsonb NULL`
- `resolved_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Index :

`(migration_run_id, severity, resolved_at)`

---

# 35. Données qui NE deviennent pas des tables métier

## Niveau

Dérivé de `player_progression.xp`.

## Nombre de personnages / C6 / copies

Dérivés de `player_characters`.

## Passifs actifs

Dérivés de la Team active et `element_passive_definitions`.

## Quotidiennes

Projection des états Roue / Combat / Expedition / Ami / Event / mission / etc.

## Top

Projection depuis les sources métier.

Aucune table `top_rankings` autoritative.

## Historique global

Projection sur les historiques spécialisés :

- Pulls
- ressources
- Banque
- Shop
- Boss
- Concours
- Event
- autres domaines natifs

Pas de table globale qui duplique tous les événements.

La migration `20260925160000_044_add_banner_generation_vote_snapshot` ajoute uniquement la colonne nullable `banner_rotations.generation_vote_snapshot JSONB`. Elle est appliquée sur DEV ; le registre Prisma compte 44 migrations. Sans nouvelle migration, la rotation source reçoit d'abord un état de fermeture durable dans ce JSONB ; la transaction suivante relit ce pool figé et écrit le snapshot final sur la nouvelle rotation. Un retry conserve la même fermeture. La toute première rotation sans source conserve SQL `NULL` ; les rotations anciennes sans snapshot restent également `NULL`. La projection History ne publie que le snapshot final et lit les tables propriétaires Gacha, Banque, Boutique et Event ; elle ne crée ni table ni écriture transverse. Cette migration n'est pas encore promue sur `main` ni déployée publiquement.

## Help

Pas de table joueur.

Les métadonnées de commandes restent dans le code/configuration documentaire tant qu'aucun besoin Admin dynamique ne justifie une table.

## `monthly_events.json`

Aucune table.

Résidu legacy vide confirmé.

---

# 36. RLS / exposition Supabase

## 36.1 Règle par défaut

Toutes les tables métier sont privées par défaut.

Le navigateur ne reçoit jamais un droit d'écriture directe sur :

- progression
- ressources
- Banque
- Pulls
- pity
- possession
- Teams
- Missions
- activités
- Event
- Faveur
- Giveaway
- Admin
- migration

Ces mutations passent par l'API backend.

## 36.2 Tables pouvant être utilisées par Realtime

La publication Realtime pourra concerner notamment :

- `global_chat_messages`
- `notifications`
- certaines vues de présence
- éventuellement des projections publiques spécialisées

Même lorsqu'une table est publiée :

- RLS doit filtrer la lecture
- aucune donnée privée ne doit être exposée
- les écritures métier restent côté serveur

## 36.3 Authenticated

Les politiques RLS ne doivent pas tenter de retrouver directement un Player via une hypothèse `players.id = auth.uid()`.

La liaison passe par `web_identities`.

Une fonction SQL contrôlée peut résoudre le Player courant si cela devient utile pour les policies de lecture Realtime.

---

# 37. Index prioritaires transversaux

À ne pas oublier pendant la migration physique :

- toutes les FK très utilisées en lookup
- tous les `created_at DESC` des historiques paginés
- toutes les dates d'activité quotidienne
- toutes les colonnes de statut utilisées avec joueur
- `lower(display_name)` pour recherche joueur
- `lower(character.name)` pour recherche personnage
- `twitch_user_id`
- `external_event_id`
- `redemption_id`
- indexes partiels des états actifs

Ne pas créer des dizaines d'indexes hypothétiques.

Mesurer ensuite avec `EXPLAIN ANALYZE`.

---

# 38. Vues PostgreSQL utiles

Les vues ne sont pas des sources de vérité.

Candidats :

## `player_level_view`

Expose :

- player
- XP
- niveau dérivé
- progression vers prochain palier

## `player_wealth_view`

Expose :

- wallet Moras
- Banque
- patrimoine total

## `player_collection_stats_view`

Expose :

- nombre de personnages
- C6
- copies

## `active_team_passives_view`

Expose les stacks de passifs dérivées.

## vues de classements

À créer seulement lorsque l'écran Top est implémenté.

---

# 39. Séquence de migrations SQL

Le schéma ne sera pas créé en une migration géante.

Cette numérotation décrit le découpage thématique cible historique, pas les noms physiques déjà versionnés. La séquence réelle est autoritative dans `server/prisma/migrations/` et atteint actuellement `20260925100000_043_add_direct_message_replies` sur Supabase DEV ; les ajouts restent versionnés dans leur migration réelle et ne sont jamais réécrits rétroactivement.

## Migration 001 — fondations

- extensions nécessaires
- enums
- elements
- resource_definitions
- players
- web_identities
- twitch_identities
- player_preferences
- roles
- admin audit
- business_operations

## Migration 002 — progression / économie

- player_progression
- daily reward state
- resource balances
- resource movements
- economy stats
- bank

## Migration 003 — catalogue / Gacha / Collection

- characters
- banners
- votes
- gacha states
- pulls
- player_characters
- C6 progress

## Migration 004 — Teams / inventory / shop / missions

- Teams
- passifs
- items
- shop
- missions

## Migration 005 — activités

- Roue
- Expedition
- Combat quotidien
- Boss

## Migration 006 — Social

- friendships
- requests
- hearts
- blocks
- presence
- privacy
- cosmetics
- MP
- chat global
- moderation

## Migration 007 — Events / Twitch

- Events
- codes
- Faveur
- Giveaway
- Twitch receipts
- Gift Suprême
- notifications

## Migration 008 — migration legacy

- migration_runs
- snapshots
- mappings
- issues

## Migration 009 — RLS / Realtime / views

- policies
- publication Realtime
- vues dérivées nécessaires au premier lot

Cette séparation pourra être encore réduite pendant l'implémentation si un lot Codex doit rester plus petit.

---

# 40. Premier sous-ensemble à réellement coder

Le premier vertical slice ne nécessite pas de créer toutes les tables immédiatement.

Tables nécessaires :

- `elements`
- `resource_definitions`
- `players`
- `web_identities`
- `business_operations`
- `player_resource_balances`
- `resource_movements`
- `player_economy_stats`
- `player_wheel_stats`
- `player_wheel_daily_states`

Éventuellement :

- `player_progression`
- `player_daily_reward_state`

si le premier onboarding test inclut déjà l'initialisation complète du Player.

Ce sous-ensemble suffit à tester :

- Supabase Auth
- résolution Auth → Player
- onboarding élément
- lecture ressources
- transaction économique
- RNG serveur
- idempotence
- journée Europe/Paris
- reload
- refus second spin
- historique économique

---

# 41. Provisionnement d'un nouveau Player

Le service unique de création doit créer atomiquement :

1. `players`
2. `web_identities`
3. `player_progression`
4. `player_daily_reward_state`
5. `player_economy_stats`
6. les `player_resource_balances` de toutes les ressources cœur à 0
7. `player_bank_accounts`
8. `player_gacha_states`
9. `player_wheel_stats`
10. les valeurs de confidentialité par défaut
11. Team 1 et positions de base lorsque le domaine Team est installé, actuellement complétées de façon transactionnelle au premier GET Team
12. autres sous-états seulement lorsque leurs migrations existent

Le provisionnement doit être rejouable sans créer de doublons.

Un profil Twitch-only utilise le même principe mais sans `web_identity`.

---

# 42. Stratégie Free-first confirmée

Pour la petite alpha actuelle, aucune table ou feature SQL ne doit nécessiter un plan payant.

Le schéma fonctionne sur Supabase Free.

Les contraintes importantes :

- 500 MB de base
- absence de backups automatiques téléchargeables
- possibilité de pause après faible activité

Avec environ 10 joueurs, la taille de DB ne constitue pas un problème à court terme.

La première montée en gamme ne nécessite aucune migration de schéma.

Passer Supabase Free → Pro garde le même projet et la même base.

Même principe pour Railway Free → Hobby : l'application ne change pas d'architecture.

---

# 43. Critères de readiness avant code

Le schéma physique est considéré suffisamment défini pour commencer le backend lorsque :

- les identités sont stables
- les soldes sont transactionnels
- l'idempotence a une représentation
- la Roue dispose d'une contrainte quotidienne
- Auth reste distinct du Player
- les timestamps/journées sont définis
- les contraintes économiques fondamentales sont en base
- le premier vertical slice possède toutes ses tables
- aucune décision produit n'est encore nécessaire pour écrire le premier lot

Ces critères sont satisfaits par ce document.

---

# 44. Conclusion Phase C2

Le modèle conceptuel V1 peut désormais être traduit en Prisma + SQL sans que Codex ait à deviner :

- les tables
- les types
- les clés
- les principales contraintes
- les index structurants
- les relations
- les données dérivées
- les frontières RLS
- l'ordre des migrations

La prochaine étape n'est plus un audit documentaire.

## Prochaine étape : commencer à coder.

Premier lot recommandé :

**squelette backend + Prisma + connexion Supabase + migrations 001/002 réduites au vertical slice Roue + Auth adapter + healthcheck + tests de base.**

## Migration physique 012 — Défi quotidien

La migration additive `20260911180000_012_add_daily_challenge` crée l’enum `daily_challenge_status`, `daily_challenge_definitions` et `player_daily_challenges`. Le catalogue impose clés externes uniques, valeurs positives et index de pool. L’état Player impose l’unicité `(player_id, business_date)`, une progression entre zéro et la cible snapshot, la cohérence de `completed_at`, et indexe les lectures Player/statut/date.

Les trois définitions finales sont seedées avec UUID stables ; messages est conservé mais `is_eligible=false` jusqu’au vrai producteur. Les deux tables ont RLS activée et tous les droits sont retirés à `anon` et `authenticated` : seul le backend Prisma direct les utilise. Les migrations 010 et 011 ne sont pas modifiées.
## État physique candidat 0.89 — migration 015

La migration additive `20260912180000_015_add_expedition_and_notifications` matérialise les enums `expedition_state` (`IDLE`, `RUNNING`, `READY`) et `notification_state` (`UNREAD`, `READ`, `RESOLVED`, `ARCHIVED`).

`player_expeditions` porte un état unique par Player : personnage et timestamps actifs, `departure_business_date`, `last_completed_at` et `total_completed`. Une contrainte de forme garantit que les références/timestamps sont absents en IDLE et complets en RUNNING/READY ; des index couvrent le personnage et la transition par état/échéance.

`notifications` porte le domaine/type, le payload JSON, l'action, sa cible, l'état et les timestamps de cycle de vie. `deduplication_key` est unique pour rendre la notification Expedition READY idempotente.

Les deux tables sont privées, avec RLS activée et tous les droits révoqués à `anon` et `authenticated`. Aucun accès navigateur direct ni policy d'écriture n'est créé ; les accès passent par le backend authentifié.

## État physique candidat 0.91 — migration 016 Boss mensuel

La migration additive `20260913160000_016_add_monthly_boss` ajoute huit tables sans modifier 001–015 : `monthly_bosses`, `player_boss_loadouts`, `player_boss_loadout_slots`, `boss_attacks`, `boss_attack_members`, `player_boss_participations`, `player_boss_stats` et `boss_rewards`.

Les contraintes SQL imposent mois unique, variation -15..15, cohérence PV/défaite/coup final, positions 1..4, personnages distincts dans une formation, attaque positive unique par Boss/Player/jour, snapshots 4★/5★ et C0..C6, agrégats positifs et récompense unique par participant. Les index servent rollover, historique, classements déterministes, consultations Player/personnage et versements. Les FK historiques sont restrictives ; loadout/stats personnels suivent le cycle du Player.

RLS est activée sur les huit tables et tous les privilèges sont révoqués à `anon` et `authenticated`. Le backend direct reste l’unique propriétaire des écritures. Aucune extension payante, fonction planifiée Supabase ni ligne d’instance courante n’est requise : le rollover est assuré par le process Node et un fallback de premier accès.
