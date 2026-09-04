# 25 — Sweep final des 17 JSON legacy

> Vérification finale de couverture des données Streamer.bot.  
> Snapshot vérifié : `main` au commit `3253ac825de6ad048ba6037992af73500a34027c`.  
> Statut : **CLÔTURÉ — 17/17 JSON vérifiés ; 16 sources legacy utiles + 1 résidu vide confirmé ; aucune nouvelle décision produit requise**.  
> Cette passe clôt la vérification exhaustive des sources legacy avant la consolidation du modèle de données V1.

---

# 1. Objectif

Après le sweep des 37 scripts, le projet impose une dernière passe exhaustive sur les 17 JSON présents dans :

`legacy/streamerbot/data/`

Cette passe doit confirmer pour chaque fichier :

- son rôle réel ;
- ses producteurs et consommateurs ;
- son domaine documentaire propriétaire ;
- son caractère de configuration, catalogue, état temporel, relation, donnée joueur ou donnée dérivable ;
- ce qui doit réellement être migré ;
- ce qui ne doit pas être reproduit mécaniquement dans le futur modèle ;
- les éventuels fichiers résiduels ou obsolètes ;
- l'absence de source de vérité oubliée.

Le but n'est pas de définir ici les tables SQL finales.

Le but est de disposer d'une carte complète et fiable avant la **consolidation du modèle de données V1**.

---

# 2. Sources de vérification

La passe a été recroisée avec :

- les 17 fichiers réels du dossier `legacy/streamerbot/data/` ;
- `docs/legacy/01-data-sources-inventory.md` ;
- `docs/legacy/02-current-player-model.md` ;
- `docs/legacy/03-command-data-matrix.md` ;
- les audits spécialisés `04` à `23` ;
- `docs/legacy/24-final-script-sweep.md` ;
- `docs/commands/command-reference.md` ;
- `docs/specifications/decisions-log.md` ;
- `docs/master/PROJECT_MASTER_PLAN.md`.

Les décisions produit déjà validées ne sont pas rouvertes.

Une correction factuelle ou une classification plus précise ne crée pas un nouveau Rxxx.

---

# 3. Inventaire réel — 17/17

Le dossier contient exactement :

1. `banner_votes.json`
2. `c6_characters.json`
3. `combat_config.json`
4. `combat_data.json`
5. `contests_data.json`
6. `element_passives.json`
7. `friendships_data.json`
8. `genshin_characters.json`
9. `gift_codes.json`
10. `giveaway.json`
11. `long_missions.json`
12. `missions_pool.json`
13. `monthly_boss.json`
14. `monthly_events.json`
15. `monthly_events_data.json`
16. `shop_items.json`
17. `viewers_data.json`

Aucun 18e JSON métier n'a été découvert dans le snapshot.

---

# 4. Matrice de couverture finale

| # | JSON | Nature réelle | Producteurs / consommateurs legacy principaux | Audit propriétaire principal | Résultat |
|---:|---|---|---|---|---|
| 1 | `banner_votes.json` | état hebdomadaire + votes joueurs | `Vote.txt`, `XP.txt` | Gacha / Invocation | Couvert |
| 2 | `c6_characters.json` | données joueur externes C6 / Concours | `XP.txt`, `Pull.txt`, `Stella.txt`, `Concours.txt`, `Legende.txt` | Box + Concours/C6 | Couvert |
| 3 | `combat_config.json` | configuration de règles | `Combat.txt` | Combat | Couvert |
| 4 | `combat_data.json` | état quotidien global | `Combat.txt` | Combat | Couvert |
| 5 | `contests_data.json` | état Concours + verrous + historique legacy | `Concours.txt`, nettoyage `XP.txt` | Concours/C6 | Couvert |
| 6 | `element_passives.json` | configuration de règles | `Passif.txt`, `Team.txt`, `Pull.txt` | Team / Passifs | Couvert |
| 7 | `friendships_data.json` | relations + demandes + cœurs | `Ami.txt`, lectures Missions/XP | Social / Amitié | Couvert |
| 8 | `genshin_characters.json` | catalogue personnages **et** état de rotation bannière | nombreux consommateurs ; rotation écrite par `XP.txt` | Gacha + catalogue partagé | Couvert |
| 9 | `gift_codes.json` | catalogue/configuration des codes | `Code.txt`, Event consommateur | Codes cadeaux | Couvert |
| 10 | `giveaway.json` | état global d'une session Giveaway | `Giveaway.txt`, `Wish.txt`, comptage `XP.txt` | Giveaway / Wish | Couvert |
| 11 | `long_missions.json` | catalogue/configuration Missions longues | `Missions.txt`, `XP.txt` | Missions | Couvert |
| 12 | `missions_pool.json` | catalogue Missions quotidiennes | `Shop.txt` | Missions / Shop | Couvert |
| 13 | `monthly_boss.json` | état Boss mensuel + stats associées | `Combat.txt` | Combat / Boss | Couvert |
| 14 | `monthly_events.json` | **fichier vide résiduel** | aucun producteur/consommateur trouvé | Event | Résidu confirmé |
| 15 | `monthly_events_data.json` | état actif de l'Event mensuel | `Event.txt`, `XP.txt` | Event / monthly | Couvert |
| 16 | `shop_items.json` | catalogue/configuration Boutique | `Shop.txt` | Sac / Coffre / Shop | Couvert |
| 17 | `viewers_data.json` | hub principal de données joueur legacy | majorité des scripts | tous domaines joueur | Couvert |

Conclusion :

**17/17 JSON sont maintenant classifiés et possèdent un traitement documentaire explicite.**

---

# 5. `banner_votes.json`

## Structure observée

- `version`
- `weekId`
- `votes`
- `voters`

`votes` contient notamment :

- `characterId`
- nom de personnage
- nombre de votes
- liste de voters

`voters` permet également de retrouver directement le choix d'un joueur.

## Producteurs / consommateurs

- `Vote.txt` lit et écrit les votes ;
- `XP.txt` lit cet état lors de la rotation hebdomadaire et de l'application du résultat ;
- le domaine Gacha possède les règles futures.

## Nature

Ce fichier mélange :

- état global hebdomadaire ;
- choix individuel des joueurs ;
- agrégat de comptage.

Il ne doit pas devenir une unique grosse ligne JSON dans la V1.

## Migration / cible

Appliquer les règles déjà validées dans l'audit Gacha :

- conserver uniquement l'état pertinent au cutover selon la semaine active ;
- les votes futurs sont rattachés à l'identité interne du joueur ;
- les comptes agrégés doivent pouvoir être dérivés des votes individuels ;
- l'historique natif des votes/snapshots commence proprement dans GachaImpact selon le contrat déjà documenté ;
- ne pas inventer des semaines historiques absentes.

---

# 6. `c6_characters.json`

## Structure observée

Objet indexé par pseudo.

Chaque joueur peut contenir :

- `username`
- `characters`

Chaque personnage C6 contient notamment :

- propriétaire ;
- `characterId` ;
- nom ;
- rareté ;
- élément ;
- arme ;
- région ;
- classe ;
- `createdAt` ;
- cinq statistiques Concours ;
- statistiques de participation/victoires ;
- titres.

## Producteurs / consommateurs

- `XP.txt` synchronise les 5★ C6 depuis la Box ;
- `Pull.txt` peut faire progresser une statistique après un doublon C6 5★ ;
- `Stella.txt` peut faire progresser l'état C6/Concours ;
- `Concours.txt` utilise et modifie ces personnages ;
- `Legende.txt` les consulte.

## Nature

Ce fichier n'est pas un deuxième catalogue de personnages indépendant.

Il contient des **données joueur spécialisées dérivées de la possession C6 mais enrichies par le système Concours**.

Le futur modèle doit donc rattacher ces données :

- au joueur interne ;
- au personnage catalogue ;
- à l'état de possession ;
- aux statistiques/titres Concours.

## Migration

Les décisions des domaines Box et Concours/C6 restent propriétaires.

Ne pas reconstruire les valeurs historiques à partir des seules copies si le fichier contient un état Concours plus riche.

Ne pas garder le pseudo comme clé relationnelle future.

---

# 7. `combat_config.json`

## Structure observée

Sept éléments :

- Pyro
- Hydro
- Cryo
- Electro
- Anemo
- Geo
- Dendro

Chaque entrée déclare :

- `strongAgainst`
- `weakAgainst`

## Producteur / consommateur

- configuration statique lue par `Combat.txt`.

## Nature

**Configuration métier**, pas donnée joueur.

## Cible

La matrice élémentaire legacy a déjà été validée dans l'audit Combat.

Elle peut devenir :

- configuration seedée ;
- configuration serveur ;
- ou référentiel équivalent.

La représentation technique finale sera définie dans le modèle V1.

Aucun historique n'est à migrer depuis ce fichier.

---

# 8. `combat_data.json`

## Structure observée

Le snapshot contient uniquement :

- `date`
- `enemyTeam`

`enemyTeam` contient quatre IDs personnages.

## Producteur / consommateur

- `Combat.txt` génère et réinitialise cet état quotidien.

## Nature

**État global quotidien éphémère**, pas historique de combat.

## Cible

La V1 conserve la notion validée d'une équipe ennemie globale quotidienne commune.

Ce fichier ne justifie pas une table de logs historiques.

Lors d'un cutover, l'état du jour peut être conservé uniquement s'il est encore valide et cohérent avec le jour courant ; sinon le scheduler V1 génère l'état attendu selon les règles Combat.

Aucun historique absent n'est inventé.

---

# 9. `contests_data.json`

## Structure observée

- `version`
- `date`
- `dailyTheme`
- `currentContest`
- `dailyLocks`
- `history`

`currentContest` contient l'état complet de la session en cours :

- statut ;
- organisateur ;
- thème ;
- timestamps ;
- participants ;
- spectateurs ;
- ordre de tour ;
- round/phase ;
- scores ;
- soutien spectateur en attente.

## Producteurs / consommateurs

- `Concours.txt` en est le principal propriétaire R/W ;
- `XP.txt` peut nettoyer un concours devenu ancien.

## Nature

Mélange :

- état de session active ;
- verrou journalier ;
- historique legacy.

## Migration

La décision R564 reste autoritaire :

**l'ancien historique de `contests_data.json` n'est pas migré dans le nouvel historique Concours.**

L'état actif/temporaire est traité selon les règles de cutover du domaine.

Les titres et statistiques durables appartenant aux personnages C6 sont traités depuis leur source spécialisée.

---

# 10. `element_passives.json`

## Structure observée

Le fichier contient :

- `version`
- description ;
- `globalRules`
- `elements`

Règles globales observées :

- Team max 4 ;
- stacks max 2 par élément ;
- passifs issus de la Team ;
- application pendant les Pulls.

Les sept configurations couvrent notamment :

- Pyro : multiplicateur de particules ;
- Hydro : bonus de chance 5★ ;
- Cryo : proc XP ;
- Electro : proc pity 5★ ;
- Anemo : remboursement de Primogemmes ;
- Geo : multiplicateur de Moras ;
- Dendro : bundle de ressources.

## Producteurs / consommateurs

- `Passif.txt` : consultation ;
- `Team.txt` : calcul/affichage des passifs actifs ;
- `Pull.txt` : application pendant l'invocation.

## Nature

**Configuration métier partagée**, pas donnée joueur.

## Cible

Le domaine Team/Passifs est propriétaire.

La V1 doit conserver une seule source de définition des passifs et ne pas dupliquer leurs constantes entre plusieurs services.

---

# 11. `friendships_data.json`

## Structure observée

- `version`
- `friendships`
- `requests`

Une relation contient notamment :

- paire de joueurs ;
- statut ;
- niveau ;
- `sparkleHearts` ;
- `createdAt` ;
- `lastHeartSent` par direction.

## Producteurs / consommateurs

- `Ami.txt` gère demandes, acceptations et cœurs ;
- Missions/XP consomment certaines données pour les objectifs sociaux.

## Nature

**Donnée relationnelle joueur**, distincte du profil principal.

Cette séparation confirme que le futur profil complet ne peut pas être importé depuis `viewers_data.json` seul.

## Cible

Les règles Social déjà validées s'appliquent :

- relations basées sur IDs internes immuables ;
- une relation unique par paire ;
- états explicites ;
- dates/cœurs conservés lorsqu'ils sont certains ;
- ne pas reproduire une clé concaténée de pseudos comme identité métier.

---

# 12. `genshin_characters.json`

## Structure observée

Le fichier mélange deux familles de données.

### Catalogue

`characters[]` :

- ID ;
- nom ;
- rareté ;
- élément ;
- arme ;
- région ;
- classe ;
- autres métadonnées.

### État de rotation

- `lastBannerUpdate`
- `previousBannerFeaturedIds`
- `bannerFeatured` sur les personnages

## Producteurs / consommateurs

Consommateurs nombreux :

- Bannière ;
- Select ;
- Pull ;
- Box ;
- Obtention ;
- Infos ;
- Stella ;
- Team ;
- Combat ;
- XP ;
- autres domaines utilisant le catalogue.

`XP.txt` modifie aussi l'état de rotation hebdomadaire.

## Nature

Ce fichier est **hybride** :

1. catalogue de personnages ;
2. état mutable de bannière/rotation.

Cette distinction doit être faite dans le modèle V1.

## Cible

Ne pas mélanger durablement le catalogue statique avec l'instance/rotation active de bannière.

Les IDs de personnages restent les références communes aux possessions, Teams, C6, combats et autres systèmes.

---

# 13. `gift_codes.json`

## Structure observée

- `codes[]`

Le snapshot contient notamment les douze codes Festival annuels.

Chaque définition contient :

- token du code ;
- expiration éventuelle ;
- mois ;
- caractère renouvelable annuel ;
- récompenses ;
- message.

Les douze codes Festival donnent dans le snapshot :

- +1 600 Primogemmes ;
- +200 000 Moras ;
- aucune particule sur ces définitions actuelles.

## Producteurs / consommateurs

- `Code.txt` lit le catalogue ;
- Event consomme la disponibilité du code Festival du mois.

## Point structurel important

`gift_codes.json` ne porte pas les claims individuels.

Les claims joueurs sont conservés dans :

`viewers_data.json -> usedCodes`

## Nature

**Catalogue/configuration de codes**.

## Cible

Les définitions et les claims doivent rester deux concepts séparés.

La migration est déjà cadrée par l'audit Codes cadeaux :

- importer les définitions pertinentes ;
- importer les claims historiques certains ;
- empêcher les doubles récompenses ;
- ne pas recalculer des claims absents.

---

# 14. `giveaway.json`

## Structure observée

Le snapshot contient notamment :

- `status`
- ouverture/fermeture ;
- gagnant ;
- `rewardPrimos`
- `participants`
- `messageCounts`
- `chatRewardsDistributed`
- compteurs/dernier participant ;
- `lastWishAt`.

## Producteurs / consommateurs

- `Giveaway.txt` administre la session ;
- `Wish.txt` inscrit les participants ;
- `XP.txt` comptabilise historiquement les messages du chat.

## Nature

**État global de session Twitch**, pas donnée joueur durable principale.

## Cible / migration

Le domaine Giveaway/Wish reste propriétaire.

Préférence opérationnelle déjà documentée :

**effectuer le cutover hors Giveaway actif.**

Si un état doit malgré tout être repris, appliquer strictement les règles de migration déjà validées dans l'audit Giveaway.

Ne pas transformer `messageCounts` en historique général de chat.

---

# 15. `long_missions.json`

## Structure observée

- `version`
- informations d'affichage ;
- récompenses par rang ;
- `ranks`

Rangs :

- B
- A
- S
- Z

Les missions décrivent notamment :

- messages ;
- Pulls ;
- personnages 4★/5★ ;
- Moras gagnées ;
- particules principales ;
- Expeditions ;
- victoires Combat ;
- cœurs ;
- objectifs Z.

## Producteurs / consommateurs

- `Missions.txt` lit les définitions ;
- `XP.txt` les utilise pour certaines vérifications/progressions.

L'état personnel n'est pas stocké dans ce fichier.

Il se trouve dans :

`viewers_data.json -> longMissions`

## Nature

**Catalogue/configuration Missions longues**.

## Cible

Séparer :

- définition de mission ;
- progression/acceptation du joueur.

Ne pas dupliquer les définitions dans chaque joueur.

---

# 16. `missions_pool.json`

## Structure observée

- `version`
- description ;
- `defaultReward`
- `missions[]`

Le snapshot contient trois missions quotidiennes :

- 10 messages ;
- 5 Pulls ;
- convertir 320 particules.

## Producteur / consommateur

- `Shop.txt` lit ce pool lors de l'attribution / changement de mission ;
- `shop_items.json` référence explicitement `missions_pool.json`.

## Nature

**Catalogue/configuration des missions quotidiennes**.

## Cible

Le domaine Missions est propriétaire des définitions et de la progression.

Le Shop n'est qu'un moyen d'acquérir/changer la mission selon les règles déjà validées.

---

# 17. `monthly_boss.json`

## Structure observée

- `currentBoss`
- `globalStats`
- `history`

Le Boss courant contient notamment :

- mois ;
- nom ;
- PV max/courants ;
- résistance ;
- état vaincu ;
- coup final ;
- dégâts/attaques globaux ;
- distribution de récompenses ;
- participants avec dégâts/attaques/date/plus gros coup.

## Producteur / consommateur

- `Combat.txt`.

## Nature

**État mensuel global autoritatif du Boss**, enrichi de statistiques joueurs.

## Migration

Le domaine Combat/Boss a déjà fixé que :

- `monthly_boss.json` est autoritatif par Boss ;
- l'état actif n'est repris que s'il correspond au mois du cutover ;
- les données historiques certaines sont traitées de manière conservatrice ;
- aucune attaque/composition manquante n'est inventée.

Le futur modèle devra séparer clairement instance de Boss, participations et agrégats.

---

# 18. `monthly_events.json`

## Constat final

Le fichier est **strictement vide** dans le snapshot.

Son SHA correspond au blob Git vide.

Le sweep de code ne trouve :

- aucun producteur ;
- aucun consommateur ;
- aucune lecture ;
- aucune écriture.

Les seules références restantes sont documentaires/historiques.

## Conclusion

`monthly_events.json` est désormais classé comme :

**résidu / placeholder legacy confirmé.**

Il ne doit :

- pas être migré ;
- pas produire une table ou une entité V1 ;
- pas servir de justification pour inventer une fonctionnalité ;
- pas être confondu avec `monthly_events_data.json`.

Le fichier peut rester dans `legacy/` comme artefact historique du snapshot.

Cette conclusion ferme le dernier `À déterminer` de l'inventaire initial.

---

# 19. `monthly_events_data.json`

## Structure observée

État mensuel réellement actif, comprenant notamment :

- `year`
- `month`
- `participants`

Pour un participant :

- `joined`
- `joinedAt`
- `points`
- `currency`
- `milestonesClaimed`
- `daily[date]`

Les structures utilisées par le système incluent également selon les sections :

- fenêtres quotidiennes ;
- Jeu B global ;
- messages sociaux ;
- achats / collection ;
- calendrier ;
- `monthlyDraw`.

## Producteurs / consommateurs

- `Event.txt` est le principal propriétaire R/W ;
- `XP.txt` assure plusieurs comportements transversaux legacy :
  - defaults ;
  - annonce ;
  - monnaie quotidienne ;
  - distribution/lecture de messages sociaux.

## Nature

**État global et joueur de l'édition Event active.**

## Cible / migration

Le domaine Event/monthly est propriétaire.

La migration conserve seulement les données actives/certaines prévues par le contrat validé.

Aucun palmarès, gain ou fonctionnalité absente n'est inventé.

`monthly_events.json` ne complète pas ce fichier : il est vide et résiduel.

---

# 20. `shop_items.json`

## Structure observée

- `version`
- `currency`
- description ;
- paramètres d'affichage ;
- `items`

Articles du snapshot :

- Primogemmes ;
- Ticket ;
- Mission.

Les définitions incluent :

- prix ;
- type de récompense ;
- montants ;
- résultats possibles du Ticket ;
- limites ;
- référence vers `missions_pool.json`.

## Producteur / consommateur

- `Shop.txt`.

## Nature

**Catalogue/configuration Boutique**.

## Cible

Les règles métier validées dans le domaine Shop restent propriétaires.

La future Boutique ne doit pas copier les définitions économiques dans plusieurs services.

Les achats historiques absents ne sont pas reconstruits depuis le catalogue.

---

# 21. `viewers_data.json`

## Rôle réel

C'est la **sauvegarde joueur principale legacy**, mais ce n'est pas le profil complet à lui seul.

La racine est indexée par pseudo Twitch.

Le profil de référence le plus complet contient de nombreuses familles :

- identité legacy ;
- XP / niveau ;
- élément ;
- Primogemmes ;
- Moras ;
- particules ;
- Box / copies / constellations / dates d'obtention ;
- Team active ;
- Saved Teams ;
- Pity / garantie / Capture ;
- sélection de bannière ;
- options ;
- missions quotidiennes ;
- missions longues ;
- statistiques ;
- dates ;
- échanges ;
- Faveur ;
- Coffre ;
- objets spéciaux ;
- Banque ;
- états temporaires et champs ajoutés progressivement.

## Producteurs / consommateurs

La majorité des 37 scripts le lisent ou l'écrivent.

Les exemples incluent :

- XP ;
- Element ;
- Banque ;
- Box ;
- Team ;
- Pull ;
- Missions ;
- Expedition ;
- Combat ;
- Shop ;
- Event ;
- Ami ;
- Codes ;
- Giveaway ;
- Faveur ;
- etc.

Certains scripts sont explicitement read-only, par exemple Sac, Pity ou Faveur.

Help n'en dépend pas.

## Nature

**Hub JSON legacy multi-domaines.**

## Conclusion architecturale

Il ne faut surtout pas créer une table/colonne JSON `viewer` géante comme traduction directe.

Le modèle V1 devra distribuer les données entre les domaines propriétaires tout en permettant de reconstruire un profil agrégé.

## Migration

Principes déjà acquis :

- IDs internes immuables côté GachaImpact ;
- identité Twitch séparée ;
- import conservateur ;
- importer les valeurs historiques certaines ;
- ne jamais inventer une valeur absente ;
- conserver les anomalies/provenances nécessaires ;
- import rerunnable/idempotent ;
- ne pas écraser une information plus fiable provenant d'un JSON spécialisé.

`viewers_data.json` est le point de départ principal du joueur, pas l'unique source.

---

# 22. Classification consolidée

## A. Hub principal joueur

- `viewers_data.json`

## B. Données joueur externes / relationnelles

- `c6_characters.json`
- `friendships_data.json`
- partie individuelle de `banner_votes.json`
- participations de `monthly_boss.json`
- participations de `monthly_events_data.json`

## C. Catalogues / configurations

- `combat_config.json`
- `element_passives.json`
- partie catalogue de `genshin_characters.json`
- `gift_codes.json`
- `long_missions.json`
- `missions_pool.json`
- `shop_items.json`

## D. États globaux / temporels

- `banner_votes.json`
- partie rotation de `genshin_characters.json`
- `combat_data.json`
- `contests_data.json`
- `giveaway.json`
- `monthly_boss.json`
- `monthly_events_data.json`

## E. Résidu historique

- `monthly_events.json`

---

# 23. Sources autoritatives et données dérivables

Le sweep confirme qu'il faudra expliciter dans le modèle V1 quelles données sont :

- autoritatives ;
- des configurations ;
- des agrégats ;
- des projections ;
- ou des caches.

Exemples importants :

### Votes

Le vote individuel est une donnée métier.

Le nombre total de votes par personnage est dérivable.

### Box / C6

La possession/constellation appartient au joueur.

Les données Concours d'un C6 ne doivent pas être écrasées en recalculant naïvement tout `c6_characters.json` depuis la Box.

### Top

Aucune donnée Top globale n'a besoin d'une source legacy séparée : les classements sont dérivés des domaines propriétaires.

### Patrimoine Moras

Le total portefeuille + banque est dérivable et ne doit pas être stocké comme troisième solde.

### Missions

Les définitions de mission et la progression joueur sont deux responsabilités distinctes.

### Catalogue personnage / Bannière

Le catalogue et l'instance de bannière active sont deux concepts distincts malgré leur cohabitation dans `genshin_characters.json`.

---

# 24. Risques de migration à conserver pour la consolidation V1

La prochaine spécification du modèle cible doit traiter explicitement :

- résolution pseudo Twitch legacy -> identité interne ;
- provenance des données importées ;
- dates legacy sans timezone explicite ;
- sections absentes dans les vieux profils ;
- objets `null` vs absents vs vides ;
- données dupliquées entre fichiers ;
- données dérivées qui ne doivent pas devenir des sources de vérité ;
- états temporaires au moment précis du cutover ;
- imports interrompus/rejoués ;
- idempotence ;
- anomalies historiques connues ;
- ordre de migration entre catalogue, joueurs, relations et états globaux.

Aucune de ces contraintes ne justifie de recopier le modèle JSON tel quel.

---

# 25. Corrections documentaires découvertes

Le sweep ne nécessite aucune nouvelle décision produit.

Il révèle cependant plusieurs mises à jour documentaires devenues nécessaires.

## `01-data-sources-inventory.md`

À finaliser :

- passer du statut de premier inventaire à inventaire consolidé ;
- remplacer les rôles « présumés » par les rôles confirmés ;
- classer `genshin_characters.json` comme source hybride catalogue + rotation ;
- préciser que `gift_codes.json` contient les définitions, pas les claims joueurs ;
- classer définitivement `monthly_events.json` comme résidu vide non migré ;
- retirer le bloc `À déterminer`.

## `02-current-player-model.md`

Le document reste une excellente description du modèle legacy mais :

- son statut `EN CONSTRUCTION` est désormais périmé ;
- sa section `À auditer ensuite` liste des domaines maintenant clôturés.

Il doit devenir :

**modèle legacy consolidé**, utilisé comme entrée de la prochaine consolidation V1.

## `command-reference.md`

Le registre n'est plus « sous réserve du sweep JSON ».

Après ce checkpoint :

**37 scripts + 17 JSON auront été vérifiés.**

## Master

Le pointeur vivant doit quitter le sweep JSON et passer à :

**Consolidation du modèle de données V1.**

---

# 26. Résultat final de la vérification legacy

## Scripts

**37 / 37 vérifiés**

## JSON

**17 / 17 vérifiés**

## JSON utile sans propriétaire documentaire

**0**

## Résidu explicite

**1 : `monthly_events.json`**

## Nouvelle décision produit nécessaire

**0**

## Nouveau Rxxx nécessaire

**Non**

---

# 27. Étape suivante

La prochaine étape n'est plus un audit de source legacy.

Elle consiste à **consolider le modèle de données V1** à partir de :

- `02-current-player-model.md` ;
- tous les audits spécialisés ;
- le sweep scripts `24` ;
- le présent sweep JSON `25`.

Cette consolidation devra définir explicitement :

- entités métier ;
- identités et relations ;
- propriétaires des écritures ;
- données autoritatives ;
- données dérivées ;
- historiques ;
- états temporaires ;
- catalogues/configurations ;
- contraintes d'unicité ;
- règles de confidentialité influant sur les projections ;
- mapping de migration ;
- provenance ;
- idempotence d'import ;
- ordre de cutover.

La forme SQL exacte ne doit pas être improvisée avant cette consolidation.

---

# 28. Clôture

La couverture des sources legacy est maintenant complète.

**37 scripts + 17 JSON ont un traitement documentaire explicite.**

Le seul fichier sans rôle métier actif est `monthly_events.json`, désormais confirmé comme résidu vide non migré.

Statut final :

**CLÔTURÉ — sweep legacy complet ; prêt pour la consolidation du modèle de données V1.**
