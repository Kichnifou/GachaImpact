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

---

## 4.5 `player_role_assignments`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `role_key text NOT NULL`
- `granted_at timestamptz NOT NULL DEFAULT now()`
- `granted_by_player_id uuid NULL REFERENCES players(id) ON DELETE SET NULL`
- `revoked_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Index partiel unique :

`UNIQUE(player_id, role_key) WHERE revoked_at IS NULL`

Rôles initiaux :

- `ADMIN`
- `MODERATOR`

---

## 4.6 `admin_audit_entries`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `actor_player_id uuid NULL REFERENCES players(id) ON DELETE SET NULL`
- `action_key text NOT NULL`
- `domain_key text NOT NULL`
- `target_type text NULL`
- `target_id text NULL`
- `before_data jsonb NULL`
- `after_data jsonb NULL`
- `reason text NULL`
- `operation_id uuid NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Index :

- `(actor_player_id, created_at DESC)`
- `(domain_key, created_at DESC)`
- `(target_type, target_id)`

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
- `last_interest_date date NULL`
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
- `operation_id uuid NULL REFERENCES business_operations(id) ON DELETE SET NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Types initiaux :

- `DEPOSIT`
- `WITHDRAWAL`
- `INTEREST`
- `ADMIN_ADJUSTMENT`

Contraintes :

- `amount > 0`
- soldes `>= 0`

Index :

`(player_id, created_at DESC)`

---

# 9. Échanges

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
- `idempotency_key text NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `resolved_at timestamptz NULL`

Contraintes :

- sender != recipient
- original_amount > 0
- current_amount >= 0
- current_amount <= original_amount

Index :

- `(sender_player_id, state, created_at)`
- `(recipient_player_id, state, created_at)`

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
- cinq statistiques Concours en `smallint NOT NULL DEFAULT 0`
- `total_contests integer NOT NULL DEFAULT 0`
- `total_wins integer NOT NULL DEFAULT 0`
- compteurs thématiques nécessaires
- `title_rank_floor text NULL`
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
- `organizer_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `business_date date NOT NULL`
- `state contest_state NOT NULL`
- `turn_order jsonb NULL`
- `current_turn_index integer NULL`
- `winning_participant_id uuid NULL`
- `started_at timestamptz NULL`
- `finished_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Index unique partiel :

au plus un Concours global actif/lobby/running selon la règle serveur.

---

## 13.3 `contest_participants`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE`
- `slot smallint NOT NULL`
- `player_id uuid NULL REFERENCES players(id) ON DELETE RESTRICT`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `is_bot boolean NOT NULL DEFAULT false`
- `is_ready boolean NOT NULL DEFAULT false`
- `score integer NOT NULL DEFAULT 0`
- `final_rank smallint NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `slot BETWEEN 1 AND 4`
- `UNIQUE(contest_id, slot)`
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

---

# 16. Boutique

## 16.1 `shop_item_definitions`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `external_key text NOT NULL UNIQUE`
- `display_name text NOT NULL`
- `price_resource_key text NOT NULL REFERENCES resource_definitions(key)`
- `price_amount bigint NOT NULL`
- `effect_type text NOT NULL`
- `effect_config jsonb NOT NULL`
- `display_order integer NOT NULL`
- `is_visible boolean NOT NULL DEFAULT true`
- `is_enabled boolean NOT NULL DEFAULT true`
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

---

# 17. Missions

## 17.1 `mission_definitions`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `external_key text NOT NULL UNIQUE`
- `kind mission_kind NOT NULL`
- `rank mission_rank NULL`
- `title text NOT NULL`
- `objective_type text NOT NULL`
- `threshold bigint NOT NULL`
- `objective_config jsonb NULL`
- `display_order integer NOT NULL`
- `is_active boolean NOT NULL DEFAULT true`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `threshold > 0`
- `rank IS NULL` autorisé pour les quotidiennes

---

## 17.2 `mission_rewards`

Colonnes :

- `mission_definition_id uuid NOT NULL REFERENCES mission_definitions(id) ON DELETE CASCADE`
- `reward_index smallint NOT NULL`
- `resource_key text NULL REFERENCES resource_definitions(key)`
- `item_id uuid NULL REFERENCES item_definitions(id)`
- `amount bigint NOT NULL`

PK :

`PRIMARY KEY(mission_definition_id, reward_index)`

Contrainte :

- `amount > 0`
- exactement une cible reward (`resource_key` XOR `item_id`)

---

## 17.3 `player_mission_progress`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `mission_definition_id uuid NOT NULL REFERENCES mission_definitions(id) ON DELETE RESTRICT`
- `progress bigint NOT NULL DEFAULT 0`
- `completed_at timestamptz NULL`
- `rewarded_at timestamptz NULL`
- `baseline jsonb NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, mission_definition_id)`

Contrainte :

`progress >= 0`

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

## 20.1 `element_combat_rules`

Colonnes :

- `element_key text PRIMARY KEY REFERENCES elements(key)`
- `favored_against_element_key text NULL REFERENCES elements(key)`
- `disfavored_against_element_key text NULL REFERENCES elements(key)`
- `version integer NOT NULL DEFAULT 1`
- `is_active boolean NOT NULL DEFAULT true`
- `updated_at timestamptz NOT NULL DEFAULT now()`

---

## 20.2 `daily_combat_encounters`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `business_date date NOT NULL UNIQUE`
- `generated_at timestamptz NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

---

## 20.3 `daily_combat_enemies`

Colonnes :

- `encounter_id uuid NOT NULL REFERENCES daily_combat_encounters(id) ON DELETE CASCADE`
- `position smallint NOT NULL`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`

PK :

`PRIMARY KEY(encounter_id, position)`

Contraintes :

- `position BETWEEN 1 AND 4`
- `UNIQUE(encounter_id, character_id)`

---

## 20.4 `player_daily_combat_loadout`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `position smallint NOT NULL`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, position)`

Contraintes :

- `position BETWEEN 1 AND 4`
- `UNIQUE(player_id, character_id)`

---

## 20.5 `player_daily_combat_states`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `encounter_id uuid NOT NULL REFERENCES daily_combat_encounters(id) ON DELETE CASCADE`
- `won_at timestamptz NULL`
- `blocked_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, encounter_id)`

---

## 20.6 `daily_combat_ko`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `encounter_id uuid NOT NULL REFERENCES daily_combat_encounters(id) ON DELETE CASCADE`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `ko_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, encounter_id, character_id)`

---

## 20.7 `daily_combat_attempts`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `encounter_id uuid NOT NULL REFERENCES daily_combat_encounters(id) ON DELETE RESTRICT`
- `mode combat_attempt_mode NOT NULL`
- `success_chance numeric(5,2) NOT NULL`
- `won boolean NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

`success_chance BETWEEN 0 AND 100`

Index :

`(player_id, created_at DESC)`

---

## 20.8 `daily_combat_attempt_members`

Snapshot de l'équipe utilisée.

Colonnes :

- `attempt_id uuid NOT NULL REFERENCES daily_combat_attempts(id) ON DELETE CASCADE`
- `position smallint NOT NULL`
- `character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`
- `rarity smallint NOT NULL`
- `constellation smallint NOT NULL`
- `element_key text NOT NULL REFERENCES elements(key)`
- `contribution numeric(8,2) NULL`

PK :

`PRIMARY KEY(attempt_id, position)`

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

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_a_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `player_b_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `state friendship_state NOT NULL DEFAULT 'ACTIVE'`
- `level integer NOT NULL DEFAULT 0`
- `total_hearts bigint NOT NULL DEFAULT 0`
- compteurs directionnels legacy si nécessaires
- `became_friends_at timestamptz NULL`
- `archived_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Contraintes :

- `player_a_id < player_b_id` conceptuellement pour canonicaliser la paire
- `UNIQUE(player_a_id, player_b_id)`
- `level BETWEEN 0 AND 1000`
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

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `session_token_hash text NOT NULL UNIQUE`
- `started_at timestamptz NOT NULL DEFAULT now()`
- `last_activity_at timestamptz NOT NULL DEFAULT now()`
- `ended_at timestamptz NULL`
- `client_metadata jsonb NULL`

Index :

- `(player_id, ended_at)`
- `(last_activity_at)`

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

Le seed de profil crée la matrice par défaut validée.

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
- `is_active boolean NOT NULL DEFAULT true`
- `created_at timestamptz NOT NULL DEFAULT now()`

---

## 25.2 `player_cosmetics`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `cosmetic_id uuid NOT NULL REFERENCES cosmetic_definitions(id) ON DELETE RESTRICT`
- `unlocked_at timestamptz NOT NULL`
- `unlock_source text NOT NULL`

PK :

`PRIMARY KEY(player_id, cosmetic_id)`

---

## 25.3 Équipement cosmétique

Dans `players` ou table dédiée légère :

- `equipped_avatar_cosmetic_id`
- `equipped_title_cosmetic_id`

Le choix exact peut être finalisé pendant le mapping Prisma sans impact métier.

---

# 26. Messages privés

## 26.1 `direct_conversations`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `last_message_at timestamptz NULL`

Pour V1, une conversation directe contient exactement deux participants.

---

## 26.2 `direct_conversation_participants`

Colonnes :

- `conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `joined_at timestamptz NOT NULL DEFAULT now()`
- `archived_at timestamptz NULL`
- `last_read_message_id uuid NULL`
- `read_receipts_enabled boolean NOT NULL DEFAULT true`

PK :

`PRIMARY KEY(conversation_id, player_id)`

Index :

`(player_id, archived_at, conversation_id)`

Une contrainte/application garantit exactement deux joueurs par conversation directe.

---

## 26.3 `direct_messages`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE RESTRICT`
- `author_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `content text NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `edited_at timestamptz NULL`
- `deleted_at timestamptz NULL`
- `restored_at timestamptz NULL`

Contraintes :

- longueur 1..1000 caractères côté application et CHECK approprié

Index :

- `(conversation_id, created_at DESC)`
- `(author_player_id, created_at DESC)`

Les messages restent historiquement conservés selon les règles validées.

---

## 26.4 `moderation_reports`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `reporter_player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `reported_player_id uuid NULL REFERENCES players(id) ON DELETE RESTRICT`
- `target_type text NOT NULL`
- `target_id uuid NULL`
- `reason text NOT NULL`
- `evidence_snapshot jsonb NULL`
- `status text NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `resolved_at timestamptz NULL`

Les administrateurs ne disposent pas d'une lecture libre des MP.

---

# 27. Chat global

## 27.1 `global_chat_messages`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `author_player_id uuid NULL REFERENCES players(id) ON DELETE RESTRICT`
- `source_channel source_channel NOT NULL`
- `message_type text NOT NULL`
- `content text NOT NULL`
- `external_message_id text NULL`
- `operation_id uuid NULL REFERENCES business_operations(id) ON DELETE SET NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `edited_at timestamptz NULL`
- `deleted_at timestamptz NULL`
- `moderation_state text NULL`

Index unique partiel :

`UNIQUE(source_channel, external_message_id) WHERE external_message_id IS NOT NULL`

Index :

`(created_at DESC)`

Le stockage et l'exécution d'une commande sont séparés.

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

---

## 28.5 `event_daily_player_states`

Colonnes :

- `event_edition_id uuid NOT NULL REFERENCES event_editions(id) ON DELETE CASCADE`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE`
- `business_date date NOT NULL`
- `game_a_success boolean NOT NULL DEFAULT false`
- `game_a_attempts integer NOT NULL DEFAULT 0`
- `game_b_attempts_used integer NOT NULL DEFAULT 0`
- `game_c_sent boolean NOT NULL DEFAULT false`
- `daily_bonus_claimed boolean NOT NULL DEFAULT false`
- `state jsonb NULL`
- `updated_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(event_edition_id, player_id, business_date)`

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

Index :

`(recipient_player_id, event_edition_id, business_date, created_at)`

---

## 28.9 `event_collection_acquisitions`

Colonnes :

- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `item_id uuid NOT NULL REFERENCES item_definitions(id) ON DELETE RESTRICT`
- `year smallint NOT NULL`
- `event_edition_id uuid NOT NULL REFERENCES event_editions(id) ON DELETE RESTRICT`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `acquired_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(player_id, item_id, year)`

---

## 28.10 `event_calendar_claims`

Colonnes :

- `event_edition_id uuid NOT NULL REFERENCES event_editions(id) ON DELETE RESTRICT`
- `player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT`
- `calendar_day smallint NOT NULL`
- `operation_id uuid NOT NULL UNIQUE REFERENCES business_operations(id) ON DELETE RESTRICT`
- `claimed_at timestamptz NOT NULL DEFAULT now()`

PK :

`PRIMARY KEY(event_edition_id, player_id, calendar_day)`

Contrainte :

`calendar_day BETWEEN 1 AND 25`

---

# 29. Codes cadeaux

## 29.1 `gift_codes`

Colonnes :

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `token text NOT NULL UNIQUE`
- `display_title text NOT NULL`
- `code_type text NOT NULL`
- `status text NOT NULL`
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
- `ends_at timestamptz NULL`
- `year smallint NULL`
- `status text NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Contrainte :

`UNIQUE(gift_code_id, edition_key)`

---

## 29.3 `gift_code_rewards`

Colonnes :

- `gift_code_edition_id uuid NOT NULL REFERENCES gift_code_editions(id) ON DELETE CASCADE`
- `reward_index smallint NOT NULL`
- `resource_key text NOT NULL REFERENCES resource_definitions(key)`
- `amount bigint NOT NULL`

PK :

`PRIMARY KEY(gift_code_edition_id, reward_index)`

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
- `migration_run_id uuid NULL`

PK :

`PRIMARY KEY(gift_code_edition_id, player_id)`

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
11. Team 1 et positions de base lorsque le domaine Team est installé
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
