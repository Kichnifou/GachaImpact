# 01 — Inventaire des sources de données Streamer.bot

Source analysée : `Data.zip` fourni le 26 août 2026.  
Statut : CONSOLIDÉ APRÈS SWEEP FINAL DES 17 JSON — rôles, propriétaires et statut de migration confirmés.

## Fichiers présents

| Fichier | Structure racine observée | Rôle confirmé |
|---|---|---|
| `banner_votes.json` | `version`, `weekId`, `votes`, `voters` | État global des votes de bannière + vote individuel des joueurs |
| `c6_characters.json` | objet indexé par pseudo | Données supplémentaires liées aux personnages C6 |
| `combat_config.json` | 7 éléments | Configuration globale du combat par élément |
| `combat_data.json` | `date`, `enemyTeam` | État global / quotidien du combat |
| `contests_data.json` | version, thème, concours actuel, locks, historique | Concours et historique |
| `element_passives.json` | règles + éléments | Catalogue/configuration des passifs élémentaires |
| `friendships_data.json` | `friendships`, `requests` | Relations joueurs, demandes et cœurs |
| `genshin_characters.json` | rotation + `characters` | Source hybride : catalogue global des personnages + état mutable de rotation/bannière |
| `gift_codes.json` | `codes` | Catalogue/configuration des codes cadeaux ; les claims joueurs vivent dans `viewers_data.json -> usedCodes` |
| `giveaway.json` | état, participants, messages, gagnant, récompenses | État global d'un giveaway |
| `long_missions.json` | affichage, récompenses, rangs | Catalogue/configuration des missions longues |
| `missions_pool.json` | description, récompense, missions | Pool global de missions |
| `monthly_boss.json` | boss courant, stats globales, historique | État du boss mensuel et données joueurs associées |
| `monthly_events.json` | fichier strictement vide | Résidu / placeholder legacy confirmé ; aucun producteur ou consommateur runtime ; ne pas migrer |
| `monthly_events_data.json` | participants, fenêtres, messages, achats, tirage | État mensuel et données joueurs d'événement |
| `shop_items.json` | monnaie, affichage, items | Catalogue/configuration boutique |
| `viewers_data.json` | objet indexé par pseudo, 199 profils | Sauvegarde joueur principale |

## Où `Kichnifou` apparaît déjà hors de `viewers_data.json`

Détecté dans :
- `banner_votes.json`
- `c6_characters.json`
- `friendships_data.json`
- `monthly_boss.json`
- `monthly_events_data.json`
- `viewers_data.json`

Cela confirme qu'un **profil joueur complet est réparti sur plusieurs JSON** et ne peut pas être modélisé uniquement depuis `viewers_data.json`.

## Classification consolidée

### Sauvegarde joueur principale
- `viewers_data.json`

### Données joueurs externes / relationnelles
- `c6_characters.json`
- `friendships_data.json`
- partie individuelle de `banner_votes.json`
- participations de `monthly_boss.json`
- participations de `monthly_events_data.json`

### Catalogues / configuration globale
- `combat_config.json`
- `element_passives.json`
- partie catalogue de `genshin_characters.json`
- `gift_codes.json`
- `long_missions.json`
- `missions_pool.json`
- `shop_items.json`

### État global / temporel
- `banner_votes.json`
- partie rotation/bannière de `genshin_characters.json`
- `combat_data.json`
- `contests_data.json`
- `giveaway.json`
- `monthly_boss.json`
- `monthly_events_data.json`

### Résidu legacy non migré
- `monthly_events.json` : fichier strictement vide ; aucun producteur ou consommateur runtime trouvé pendant les sweeps ; aucune fonctionnalité V1 ne doit en être déduite.

## Principe retenu

Le profil `Kichnifou` sera utilisé comme **référence canonique du schéma joueur le plus récent**, mais il sera agrégé avec ses données provenant de tous les fichiers ci-dessus.

Les autres joueurs seront ensuite utilisés pour tester :
- champs absents ;
- formats anciens ;
- `null` vs liste vide ;
- sections ajoutées après la création d'un profil ;
- cas limites de migration.

## Rôle durable de ce document

Ce fichier reste l'inventaire factuel des sources de données legacy et de leur rôle identifié.

Il peut être enrichi lorsqu'un audit révèle une nouvelle relation entre fichiers, mais il ne doit pas servir de tracker de reprise du projet.

Le domaine actif et la prochaine étape exacte sont indiqués uniquement dans le Master.

Aucune structure de base de données cible ne doit être déduite mécaniquement de la structure des JSON legacy.
