# 11 — Audit legacy Missions / Daily

Statut : AUDIT EN COURS — OUVERT APRÈS CLÔTURE DU DOMAINE SAC / COFFRE / SHOP R256–R298
Date : 2026-08-31

## 1. Périmètre

Domaine audité :
- mission quotidienne achetée ;
- pool `missions_pool.json` ;
- achat / switch depuis Shop ;
- progression / complétion / récompense ;
- missions longues/permanentes B / A / S / Z ;
- commande `!mission` ;
- commande `!quotis` (`Daily.txt`) ;
- reset / expiration ;
- UI Missions standalone ;
- Twitch / chat ;
- migration des états mission legacy ;
- producteurs / consommateurs de progression.

Ne pas redécider les règles déjà validées dans Shop, XP, Ressources, Gacha, Box, Team ou Banque.

---

## 2. Sources legacy principales

### Code
- `legacy/streamerbot/commands/Missions.txt`
- `legacy/streamerbot/commands/Daily.txt`
- `legacy/streamerbot/commands/Shop.txt`
- `legacy/streamerbot/commands/XP.txt`
- `legacy/streamerbot/commands/Pull.txt`
- `legacy/streamerbot/commands/Convertir.txt`

### Données
- `legacy/streamerbot/data/missions_pool.json`
- `legacy/streamerbot/data/long_missions.json`
- `legacy/streamerbot/data/viewers_data.json`

### Consommateurs/producteurs à recroiser
Selon les types de missions longues :
- messages / XP ;
- Pull ;
- Box / possession ;
- Ressources ;
- Expedition ;
- Combat ;
- Ami / Faveur ;
- autres producteurs des statistiques utilisées.

---

## 3. Distinction importante : `Daily.txt` n'est pas la mission quotidienne

Le vrai `Daily.txt` gère uniquement `!quotis`.

Il ne lit ni n'écrit les missions joueur.

Il envoie un rappel compact des activités quotidiennes :

- Roue ;
- Combat ;
- Expedition ;
- Ami cœur ;
- Event ;
- Shop mission.

Conclusion :
- `!quotis` = aide / agrégateur des activités quotidiennes ;
- `missions.daily` = vraie mission quotidienne achetée ;
- ces deux notions sont distinctes.

Le futur suivi quotidien général de l'UI peut réutiliser l'intention de `!quotis`, mais ce n'est pas le propriétaire des missions.

---

# 4. Mission quotidienne legacy

## Catalogue

`missions_pool.json` contient actuellement trois missions actives :

### Messages
- ID : `daily_messages_10`
- objectif : 10 messages ;
- progression à partir de l'obtention.

### Pulls
- ID : `daily_pulls_5`
- objectif : 5 Pulls ;
- progression à partir de l'obtention.

### Conversion
- ID : `daily_convert_particles_320`
- objectif : convertir 320 particules ;
- progression à partir de l'obtention.

Récompense par défaut déclarée :
- 800 Primogemmes.

---

## 5. Achat quotidien legacy

L'achat est actuellement porté par `Shop.txt`.

Prix courant :
- 10 000 Moras.

Règles :
- une mission choisie aléatoirement parmi les missions `enabled` ;
- une mission déjà achetée le même jour bloque un nouvel achat ;
- état stocké dans `viewer["missions"]["daily"]`.

Champs observés :

```json
{
  "missionId": "daily_convert_particles_320",
  "type": "convert_particles",
  "progress": 0,
  "target": 320,
  "completed": false,
  "rewardClaimed": false,
  "startedAt": "2026-08-26",
  "description": "Convertir 320 particules",
  "switchCount": 0,
  "switchDate": "2026-08-26"
}
```

Décision déjà validée avant ce domaine :
- même action métier accessible depuis Boutique ou écran Missions ;
- pas deux achats différents ;
- la carte Shop reste visible/indisponible après achat du jour.

---

# 6. Switch de mission quotidienne legacy

Commande :
- `!shop switch`

Préconditions :
- mission du jour existante ;
- mission non terminée.

Prix :
- premier switch : 20 000 Moras ;
- puis double à chaque switch du même jour ;
- 20k → 40k → 80k → 160k → ...
- garde-fou legacy jusqu'à 1 000 000 000.

Sélection :
- 10 % de chance de retomber sur la même mission ;
- sinon choix uniforme parmi les autres missions actives.

Effet :
- paiement Moras ;
- `totalMorasSpent` augmente ;
- nouvelle mission ;
- progression remise à 0 ;
- `switchCount` augmente ;
- prochain prix affiché.

Décision déjà validée :
- dans le standalone, l'action de switch vit principalement dans l'écran Missions ;
- Twitch/chat peut conserver `!shop switch`.

---

# 7. Progression de la mission quotidienne legacy

La progression est dupliquée dans plusieurs scripts.

### Messages
`XP.txt` :
- +1 progression uniquement lorsqu'un message donne réellement de l'XP ;
- donc l'intention legacy correspond actuellement à `countedMessages`, pas à tous les messages.

### Pulls
`Pull.txt` :
- chaque Pull individuel ajoute +1 ;
- un x10 contribue donc 10.

### Conversion
`Convertir.txt` :
- quantité réellement convertie ajoutée à la progression.

Cette duplication doit disparaître dans le standalone.

Cible architecturale :
- les services métier publient / transmettent les événements de progression pertinents ;
- `MissionService` applique la progression ;
- aucune copie de `CompleteDailyMission` dans XP, Pull, Convertir, etc.

---

# 8. Complétion / récompense quotidienne legacy

Lorsque l'objectif est atteint :
- progression clampée à la cible ;
- +800 Primogemmes immédiatement ;
- `totalPrimosEarned` augmente ;
- `completed = true` ;
- `rewardClaimed = true`.

Il n'existe donc pas réellement de claim manuel dans le legacy :
- la récompense est auto-claim dès la complétion.

Le champ `rewardClaimed` sert surtout d'état de protection.

À décider pour le standalone :
- conserver auto-claim ;
- ou transformer en bouton `Réclamer`.

---

# 9. Expiration quotidienne legacy

`XP.txt` vérifie `startedAt`.

Si la mission n'appartient plus au jour courant :
- `missions.daily` est remplacée par un état vide.

Défaut legacy :
- cette expiration dépend de l'exécution du script XP / activité utilisateur ;
- elle n'est pas un vrai reset serveur.

La cible standalone devra utiliser le reset serveur commun plutôt qu'un message comme scheduler.

À décider :
- comportement exact à 00:00 ;
- mission inachevée perdue ;
- mission terminée déjà récompensée simplement archivée/réinitialisée ;
- historique standalone éventuel.

---

# 10. Missions longues / permanentes B / A / S

`long_missions.json` contient trois rangs principaux :
- B ;
- A ;
- S.

Chaque rang possède actuellement 9 catégories correspondantes :

1. messages ;
2. Pulls ;
3. personnages 4★ ;
4. personnages 5★ ;
5. Moras gagnées ;
6. particules de l'élément principal gagnées ;
7. expéditions terminées ;
8. combats gagnés ;
9. cœurs d'amitié envoyés.

Récompenses :
- B : 160 Primogemmes ;
- A : 1 600 Primogemmes ;
- S : 16 000 Primogemmes.

Pour chaque catégorie :
- B doit être terminée avant A ;
- A doit être terminée avant S.

---

# 11. Nature cumulative B → A → S

Point important du vrai code :

À la complétion d'une mission B :
- B est marquée terminée ;
- le rang A de la même catégorie est automatiquement activé ;
- la baseline n'est pas remise à zéro.

Exemple conceptuel pour messages :

- B demande 50 ;
- A demande 200 ;
- S demande 1000.

Si B se termine à 50/50 :
- A commence conceptuellement à 50/200 ;
- puis S commence à 200/1000.

Les rangs fonctionnent donc comme des paliers cumulés depuis la baseline initiale de la catégorie, pas comme trois objectifs indépendants redémarrant à zéro.

À valider explicitement pour le standalone.

---

# 12. Plusieurs missions permanentes simultanées

Le legacy stocke une progression par catégorie.

Une seule mission peut être active dans une même catégorie/rang logique, mais plusieurs catégories différentes peuvent être actives simultanément.

Exemple possible :
- messages S active ;
- characters4 S active ;
- combatWins S active ;
- etc.

Le profil Kichnifou confirme réellement plusieurs catégories simultanément et possède déjà la majorité des chaînes B/A/S terminées.

---

# 13. Abandon

`!mission abandon ...` :
- désactive la mission ;
- conserve la progression.

Si une seule mission est active, `!mission abandon` peut l'abandonner sans préciser laquelle.

Réacceptation :
- la progression historique est conservée.

À décider pour l'UI standalone :
- conserver réellement l'abandon ;
- utilité de cette notion si les missions permanentes peuvent progresser en parallèle.

---

# 14. Bug / fragilité legacy sur les baselines

Pour la plupart des types, `Missions.txt` n'enregistre pas immédiatement la valeur cumulative de départ lors de l'acceptation.

La baseline est initialisée plus tard par `XP.txt`, lors d'un futur message éligible.

Conséquence possible :
- accepter une mission Pull ;
- effectuer plusieurs Pulls avant le prochain message XP ;
- la baseline peut être enregistrée après ces Pulls ;
- progression perdue.

Exception :
- `mainParticlesEarned` possède un correctif particulier.

Cette dépendance au prochain message est un bug/artefact Streamer.bot.

Cible :
- snapshot/baseline déterminé transactionnellement dès l'activation ;
- ou, mieux, architecture de progression qui rend cette duplication inutile ;
- aucune progression ne doit dépendre d'un message sans rapport.

Pas de décision produit nécessaire pour corriger ce défaut.

---

# 15. Complétion B/A/S

Le legacy vérifie les missions longues dans `XP.txt`.

Lorsqu'un objectif actif est atteint :
- progression clampée ;
- rang ajouté à `completedRanks` ;
- mission désactivée ;
- récompense Primogemmes immédiate ;
- rang suivant de la même catégorie auto-activé pour B→A et A→S.

La récompense est donc auto-claim.

Le contrôle de complétion est lui aussi artificiellement rattaché au traitement XP/message dans le legacy.

Cible :
- `MissionService` doit réagir aux vraies mutations métier ;
- récompense et complétion transactionnelles ;
- pas d'attente du prochain message.

---

# 16. Rang Z

Déblocage legacy :
- toutes les missions B, A et S de toutes les catégories principales doivent être terminées.

Une fois débloqué :
- `unlockedZ = true`.

Quatre missions Z actuelles :

1. obtenir 5 personnages C6 ;
2. atteindre Amitié Parfaite ;
3. atteindre niveau 100 ;
4. gagner 50 combats manuels (`!combat go`).

Récompense par mission Z :
- 160 000 Primogemmes.

Contrairement à B/A/S :
- les Z sont stockées individuellement dans `longMissions.z` ;
- plusieurs Z peuvent être actives ;
- pas de chaîne Z suivante ;
- progression basée sur l'état actuel / statistiques.

À décider :
- logique d'activation Z ;
- pertinence des objectifs/montants ;
- présentation UI.

---

# 17. Commande `!mission`

Formes legacy principales :

- `!mission`
- `!mission resume`
- `!mission B`
- `!mission A`
- `!mission S`
- `!mission Z`
- `!mission B 1`
- `!mission A 1`
- `!mission S 1`
- `!mission Z 1`
- `!mission abandon`
- `!mission abandon B 1`

Aliases legacy d'abandon :
- `abandon`
- `abandonne`
- `giveup`
- `out`

Aliases legacy de résumé :
- `resume`
- `résumé`
- `resumé`
- `recap`
- `récap`

Les helpers standalone devront n'afficher qu'une syntaxe recommandée selon la règle globale.

---

# 18. `!quotis`

`Daily.txt` ne fait qu'envoyer :

- Roue ;
- Combat ;
- Expedition ;
- Ami cœur ;
- Event ;
- Shop mission.

C'est un ancien aide-mémoire Twitch.

Le standalone possède déjà une direction validée de suivi quotidien général dans la sidebar / accueil.

À décider plus tard dans ce domaine :
- garder `!quotis` sur Twitch/chat ;
- quelle information il doit réellement refléter depuis les états serveur actuels plutôt qu'une chaîne statique.

---

# 19. Migration observée

Profil Kichnifou :
- mission quotidienne legacy datée du 2026-08-26, non terminée ;
- nombreuses chaînes B/A/S déjà complétées ;
- `characters4` S et `combatWins` S encore actives ;
- Z encore verrouillées dans le snapshot.

La migration devra préserver :
- missions B/A/S complétées ;
- catégories actives ;
- progression ;
- baselines si elles restent nécessaires ;
- état Z ;
- historique certain présent dans les structures.

Une mission quotidienne ancienne au moment du cutover ne doit pas devenir une mission active du nouveau jour par erreur.

La stratégie précise sera finalisée après décisions de reset/historique.

---

# 20. Architecture cible provisoire

Conceptuellement :

```text
MissionCatalog
    ├── DailyMission definitions
    └── PermanentMission definitions

MissionService
    ├── assignDaily(...)
    ├── switchDaily(...)
    ├── progress(...)
    ├── complete(...)
    └── permanent progression / unlocks

Producteurs métier
    ├── Chat / XP
    ├── Gacha
    ├── Ressources
    ├── Box
    ├── Expedition
    ├── Combat
    └── Social
```

Les producteurs ne doivent pas contenir eux-mêmes les règles de récompense Mission.

Le SQL exact reste Phase 2.

---

# 21. Premiers points produit à décider

- organisation UI Quotidienne / Permanentes ;
- nature cumulative B→A→S ;
- activation manuelle ou automatique des permanentes ;
- utilité de l'abandon ;
- auto-claim ou claim manuel ;
- reset de la mission quotidienne ;
- comportement du switch ;
- présentation/déblocage des Z ;
- visibilité / historique.

---

# 22. État

Domaine ouvert.

Prochaines décisions à partir de R299.
