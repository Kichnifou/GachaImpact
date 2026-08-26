# 01 — Inventaire des sources de données Streamer.bot

Source analysée : `Data.zip` fourni le 26 août 2026.  
Statut : PREMIER INVENTAIRE — le sens exact de certains champs sera confirmé lors de l'audit des scripts.

## Fichiers présents

| Fichier | Structure racine observée | Rôle présumé |
|---|---|---|
| `banner_votes.json` | `version`, `weekId`, `votes`, `voters` | État global des votes de bannière + vote individuel des joueurs |
| `c6_characters.json` | objet indexé par pseudo | Données supplémentaires liées aux personnages C6 |
| `combat_config.json` | 7 éléments | Configuration globale du combat par élément |
| `combat_data.json` | `date`, `enemyTeam` | État global / quotidien du combat |
| `contests_data.json` | version, thème, concours actuel, locks, historique | Concours et historique |
| `element_passives.json` | règles + éléments | Catalogue/configuration des passifs élémentaires |
| `friendships_data.json` | `friendships`, `requests` | Relations joueurs, demandes et cœurs |
| `genshin_characters.json` | rotation + `characters` | Catalogue global des personnages et données de bannière |
| `gift_codes.json` | `codes` | Catalogue / état des codes cadeaux |
| `giveaway.json` | état, participants, messages, gagnant, récompenses | État global d'un giveaway |
| `long_missions.json` | affichage, récompenses, rangs | Catalogue/configuration des missions longues |
| `missions_pool.json` | description, récompense, missions | Pool global de missions |
| `monthly_boss.json` | boss courant, stats globales, historique | État du boss mensuel et données joueurs associées |
| `monthly_events.json` | fichier vide dans cette archive | À vérifier : ancien fichier, placeholder ou système abandonné |
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

## Classification initiale

### Sauvegarde joueur principale
- `viewers_data.json`

### Données joueurs externes / relationnelles
- `c6_characters.json`
- `friendships_data.json`
- certaines sections de `banner_votes.json`
- certaines sections de `monthly_boss.json`
- certaines sections de `monthly_events_data.json`

### Catalogues / configuration globale
- `combat_config.json`
- `element_passives.json`
- `genshin_characters.json`
- `gift_codes.json`
- `long_missions.json`
- `missions_pool.json`
- `shop_items.json`

### État global / temporel
- `banner_votes.json`
- `combat_data.json`
- `contests_data.json`
- `giveaway.json`
- `monthly_boss.json`
- `monthly_events_data.json`

### À déterminer
- `monthly_events.json` : vide dans l'archive actuelle.

## Principe retenu

Le profil `Kichnifou` sera utilisé comme **référence canonique du schéma joueur le plus récent**, mais il sera agrégé avec ses données provenant de tous les fichiers ci-dessus.

Les autres joueurs seront ensuite utilisés pour tester :
- champs absents ;
- formats anciens ;
- `null` vs liste vide ;
- sections ajoutées après la création d'un profil ;
- cas limites de migration.

## Prochaine sous-étape

Construire `02-current-player-model.md` en recensant toutes les propriétés du profil `Kichnifou` dans `viewers_data.json`, puis y rattacher ses données externes depuis les autres JSON.

Aucune structure de base de données cible ne doit être figée avant cette cartographie.
