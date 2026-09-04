# 03 — Matrice commandes ↔ données legacy

Statut : PREMIER AUDIT STRUCTUREL  
Date : 2026-08-27  
Sources : 37 scripts du snapshot Streamer.bot + 17 JSON du snapshot Data.

> Cette matrice est volontairement séparée des futures spécifications métier. Elle décrit d'abord **ce que fait réellement le legacy**. Les décisions “garder / adapter / supprimer” seront prises domaine par domaine.

## Légende

- `R` : lecture
- `W` : écriture
- `R/W` : lecture + écriture
- `—` : aucune persistance JSON propre identifiée
- “Domaine cible” : regroupement recommandé dans le nouveau GachaImpact, pas une traduction 1 script = 1 service.

| Commande / action | Données legacy principales | Accès | Domaine cible probable | Notes initiales |
|---|---|---:|---|---|
| Ami | `friendships_data.json`, `viewers_data.json` | R/W | Social / Amitié | demandes, amitiés, cœurs, primos |
| Banniere | `genshin_characters.json`, `viewers_data.json` | R | Gacha / Bannière | affichage bannière + sélection joueur |
| Banque | `viewers_data.json` | R/W | Économie / Banque | solde, dépôt, retrait |
| Box | `viewers_data.json`, `genshin_characters.json` | R/W | Collection / Box | préférences tri + favoris |
| Code | `gift_codes.json`, `viewers_data.json` | R + R/W | Récompenses / Codes | codes utilisés et récompenses |
| Coffre | `viewers_data.json` | R/W prudent | Inventaire / Event | affiche collection ; initialise defaults |
| Combat | `viewers_data.json`, `genshin_characters.json`, `combat_config.json`, `combat_data.json`, `monthly_boss.json` | R/W | Combat | combat quotidien + boss mensuel |
| Concours | `contests_data.json`, `c6_characters.json`, `viewers_data.json` | R/W | Concours / C6 | système fortement transversal |
| Convertir | `viewers_data.json` | R/W | Économie / Particules | particule élément joueur → primo 1:1 |
| Daily / Quotis | — | — | UI / Aide | simple résumé des activités |
| Echanger | `viewers_data.json` | R/W | Économie / Échanges | demandes bilatérales + réservations de stock |
| Element | `viewers_data.json` | R/W | Profil joueur | choix permanent élément |
| Event | `monthly_events_data.json`, `viewers_data.json` | R/W | Events mensuels | participation, monnaie, social, achats/tirages |
| Expedition | `viewers_data.json`, `genshin_characters.json` | R/W | Expédition | état temporisé + récompenses |
| Faveur | `viewers_data.json` | R | Faveur / Abonnement | consultation de l'état uniquement ; claim quotidien legacy porté par XP, acquisition portée par Subscription |
| Gift | `viewers_data.json` | R/W | Twitch / Custom Reward | Gift Suprême : cible saisie dans la redemption, +1600 particules de l'élément du viewer cible ; aucun `!gift` canonique V1 |
| Giveaway | `giveaway.json`, `viewers_data.json` | R/W | Giveaway / Twitch | ouverture, fermeture, tirage, classement chat, récompenses, stats, reroll |
| Help | — | — | Aide | aide statique par catégories ; aucune donnée joueur ni persistance |
| Infos | `viewers_data.json`, `genshin_characters.json` | R | Personnages / Fiche | infos catalogue + possession |
| Legende | `c6_characters.json`, `viewers_data.json` | R | Concours / C6 | affiche personnages C6/statistiques |
| Liste | `viewers_data.json` | R | Social / Présence legacy | liste joueurs selon données Streamer.bot |
| Missions | `long_missions.json`, `viewers_data.json` | R/W | Missions longues | B/A/S/Z, abandon, reprise, auto-chaînage |
| Obtention | `genshin_characters.json`, `viewers_data.json` | R | Collection / Historique | première date d'obtention |
| Passif | `element_passives.json` | R | Équipe / Passifs | référentiel général des passifs ; aucune donnée joueur lue |
| Pity | `viewers_data.json` | R | Gacha / Invocation | pity, garantie, etc. |
| Pull | `viewers_data.json`, `genshin_characters.json`, `element_passives.json`, `c6_characters.json` | R/W | Gacha / Invocation | cœur du système de tirage |
| Roue | `viewers_data.json` | R/W | Daily / Roue | 1/jour + récompenses |
| Sac | `viewers_data.json` | R | Inventaire / Ressources | vue agrégée des ressources |
| Select | `genshin_characters.json`, `viewers_data.json` | R/W | Gacha / Bannière | sélection personnelle du 5★ ciblé |
| Shop | `shop_items.json`, `missions_pool.json`, `viewers_data.json` | R/W | Boutique | achats, ticket, mission quotidienne |
| Stella | `viewers_data.json`, `genshin_characters.json`, `c6_characters.json` | R/W | Personnages / Constellations | Stella Fortuna ; C0→C6 ou stat C6 5★ |
| Subscription | `viewers_data.json` | R/W | Twitch / Faveur | trigger Twitch, faveur + primos |
| Team | `viewers_data.json`, `genshin_characters.json`, `element_passives.json` | R/W | Équipe | team active + jusqu'à 10 teams sauvegardées |
| Top | `viewers_data.json` | R | Classements | classements globaux dérivés / lecture seule |
| Vote | `banner_votes.json`, `genshin_characters.json` | R (`genshin_characters`) + R/W (`banner_votes`) | Gacha / Vote hebdo | 1 vote/semaine |
| Wish | `giveaway.json`, `viewers_data.json` | R/W (`giveaway`) | Giveaway | participation giveaway |
| XP | `viewers_data.json`, `genshin_characters.json`, `c6_characters.json`, `contests_data.json`, `monthly_events_data.json`, `long_missions.json`, `friendships_data.json`, `giveaway.json`, `banner_votes.json` | R/W massif | Cycle de vie / Orchestrateur legacy | énorme script central à découpler |

## Constats structurels

### 1. `viewers_data.json` est un hub legacy
La majorité des commandes le lisent et beaucoup l'écrivent. Il mélange :
- profil ;
- progression ;
- ressources ;
- collection ;
- équipe ;
- pity ;
- options ;
- missions ;
- stats ;
- dates ;
- échanges ;
- faveur ;
- coffre ;
- banque ;
- états temporaires.

Le futur modèle ne doit pas reproduire mécaniquement cet objet géant.

### 2. XP est un orchestrateur, pas seulement “XP”
`XP.txt` touche au cycle de vie joueur, mais aussi :
- bannière hebdomadaire ;
- votes ;
- C6 ;
- concours ;
- giveaway ;
- event mensuel ;
- banque ;
- faveur ;
- missions quotidiennes ;
- missions longues ;
- échanges expirés.

Dans le nouveau jeu, ces responsabilités doivent être séparées en services/modules centraux.

### 3. Le domaine Gacha est réparti
À auditer ensemble :
- `Banniere`
- `Select`
- `Pull`
- `Pity`
- `Vote`
- `Stella` (partiellement)
- données `genshin_characters`, `banner_votes`, `c6_characters`, `viewers_data`

Le futur système doit avoir une seule logique métier cohérente.

### 4. Plusieurs données sont dupliquées par nécessité legacy
Exemple : `c6_characters.json` répète des métadonnées catalogue (`name`, `element`, `weapon`, `region`, etc.).  
Dans la cible, ces données devraient normalement venir du catalogue personnage central, sauf besoin de snapshot historique explicite.

## Prochaine amélioration de cette matrice

Pendant chaque audit détaillé, compléter pour chaque commande :
- syntaxes ;
- triggers ;
- préconditions ;
- champs exacts lus/écrits ;
- transactions ;
- cooldowns ;
- erreurs/edge cases ;
- fonctions dupliquées ;
- décision cible : garder / adapter / supprimer / futur ;
- interfaces futures : UI / chat GachaImpact / Twitch.
