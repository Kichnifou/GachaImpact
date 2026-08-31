# 11 — Audit legacy Missions / Daily

Statut : AUDIT EN COURS — R299 À R315 TRAITÉS ; PROCHAINE REPRISE À R316
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

Décisions standalone validées :
- dans le standalone, l'action de switch vit principalement dans l'écran Missions ;
- Twitch/chat conserve `!shop switch` ;
- premier switch du jour : 20 000 Moras ;
- le coût double ensuite à chaque switch du même jour : 20k → 40k → 80k → 160k → ... ;
- la nouvelle mission doit obligatoirement être différente de la mission actuelle ;
- la progression de la mission remplacée est perdue et la nouvelle mission repart à 0 ;
- une mission déjà terminée ne peut pas être switchée ;
- s'il n'existe aucune autre mission active dans le catalogue, le switch est indisponible plutôt que de faire payer pour conserver la même mission.

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
- les missions B/A/S déjà complétées ;
- toute progression certaine déjà acquise ;
- l'état de déblocage Z et les missions Z déjà terminées si elles existent ;
- les informations legacy `active`, `activeRank`, `acceptedRanks` et baselines uniquement comme données de migration utiles à la reconstruction de la progression, sans reproduire le modèle d'activation/abandon dans le standalone.

Les missions permanentes du standalone progressent automatiquement dès le provisionnement du joueur, qu'il s'agisse d'un compte standalone ou d'un profil Twitch-only.

Une mission quotidienne ancienne au moment du cutover ne doit pas devenir une mission active du nouveau jour par erreur.

Aucun historique player-facing des missions quotidiennes n'est à reconstruire ou à créer.

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

# 21. Décisions standalone validées — R299 à R315

Les décisions de cette section sont autoritatives pour la cible standalone et remplacent les mentions `À décider` encore présentes dans les constats legacy précédents.

## R299 — Organisation de l'écran Missions

Un seul écran `Missions` avec deux onglets principaux :
- `Quotidienne` ;
- `Permanentes`.

L'onglet Quotidienne accueille :
- la vraie mission quotidienne achetée ;
- son état, sa progression, son switch et sa récompense ;
- le suivi général des autres actions quotidiennes disponibles.

Le suivi général s'inspire de l'intention de `!quotis`, mais reste distinct de la mécanique `missions.daily`.

## R300 — Progression cumulative B → A → S

Conserver les rangs comme des paliers cumulatifs d'une même progression.

Exemple :
- B : 50 ;
- A : 200 ;
- S : 1000.

Finir B à 50 signifie donc que A poursuit à partir de 50/200, puis S à partir de 200/1000.

## R301 — Progression permanente automatique

Supprimer l'activation manuelle des missions permanentes.

Dès le provisionnement du joueur :
- les missions permanentes accessibles existent et progressent automatiquement ;
- cela vaut pour un compte standalone comme pour un profil Twitch-only créé lors de sa première présence Twitch ;
- chaque progression dépend uniquement des vraies actions métier autorisées pour le joueur.

Les restrictions d'onboarding restent applicables aux actions elles-mêmes : une fonctionnalité encore verrouillée ne produit naturellement aucune progression correspondante.

## R302 — Suppression de l'abandon

Supprimer le concept métier d'abandon des missions permanentes.

Il n'existe plus :
- d'acceptation manuelle ;
- d'abandon ;
- de réacceptation nécessaire.

Un éventuel masquage visuel futur d'une mission ne doit pas arrêter sa progression métier.

## R303 — Récompenses automatiques

Les récompenses de missions sont créditées automatiquement au moment exact de la complétion.

Aucun bouton `Réclamer` n'est nécessaire.

Standalone UI :
- une réussite provoquée depuis l'interface crée une notification ;
- cliquer sur cette notification mène à l'écran Missions ;
- une mission permanente terminée conserve un indice visuel clair dans l'écran Missions.

Chat interne / Twitch :
- une réussite peut être restituée textuellement lorsqu'elle est provoquée directement par l'action que le joueur vient d'effectuer dans ce canal ;
- ne pas envoyer plus tard une notification de réussite dans un autre canal.

Complétion + récompense + mise à jour de progression doivent être atomiques et idempotentes.

## R304 — Reset de la mission quotidienne

Reset serveur strict à `00:00 Europe/Paris`.

À ce reset :
- une mission quotidienne inachevée expire ;
- sa progression est perdue ;
- une mission terminée a déjà été récompensée ;
- l'état quotidien actif est réinitialisé ;
- aucune nouvelle mission payante n'est attribuée automatiquement : le joueur peut acheter celle du nouveau jour.

Aucun message joueur n'est utilisé comme scheduler.

## R305 — Switch quotidien

Conserver le coût croissant :
- 20 000 Moras ;
- 40 000 ;
- 80 000 ;
- 160 000 ;
- etc.

La nouvelle mission doit obligatoirement être différente.

Le switch :
- remet la progression à 0 ;
- est impossible après complétion ;
- est indisponible s'il n'existe aucune alternative active dans le catalogue.

## R306 — Déblocage du rang Z

Conserver la condition legacy :
- toutes les missions B, A et S de toutes les catégories principales doivent être terminées avant de débloquer Z.

## R307 — Activation automatique des Z

Au déblocage du rang Z :
- toutes les missions Z disponibles deviennent automatiquement actives ;
- elles progressent simultanément ;
- aucune acceptation manuelle n'est requise.

## R308 — Présentation du rang Z verrouillé

Avant son déblocage :
- montrer qu'un `Rang Z` existe ;
- afficher son état verrouillé ;
- ne révéler aucun intitulé de mission ;
- ne révéler aucun objectif ;
- ne révéler aucune récompense ;
- ne révéler aucun détail permettant de découvrir les missions à l'avance.

## R309 — Objectifs Z à recroiser

Les quatre objectifs Z legacy restent la référence provisoire :
1. obtenir 5 personnages C6 ;
2. atteindre Amitié Parfaite ;
3. atteindre niveau 100 ;
4. gagner 50 combats manuels.

Leur formulation et leurs conditions finales devront être recroisées avec les audits Combat et Social/Ami avant clôture définitive.

## R310 — Nouvelle fonction de `!mission`

`!mission` devient une commande de consultation.

Cible actuelle :
- `!mission` → résumé compact des missions ;
- `!mission B` → état du rang B ;
- `!mission A` → état du rang A ;
- `!mission S` → état du rang S ;
- `!mission Z` → état du rang Z ou information de verrouillage.

Supprimer du fonctionnement cible :
- acceptation `!mission B 1` / A / S / Z ;
- `!mission abandon` et variantes.

Les helpers ne montrent que la syntaxe cible recommandée.

## R311 — `!quotis` dynamique

Conserver `!quotis` dans le chat interne et sur Twitch.

Il ne doit plus envoyer une chaîne statique.

Il interroge les vrais états serveur des activités quotidiennes et produit un résumé compact de leur état.

La liste exacte des activités pourra évoluer à mesure que Roue, Combat, Expedition, Ami et Event seront audités.

## R312 — Pas de duplication inter-canaux

Une réussite de mission est un événement métier unique, mais sa restitution dépend du canal ayant provoqué l'action.

- action UI → notification UI ;
- action chat interne → retour immédiat dans le chat interne ;
- action Twitch → retour immédiat sur Twitch ;
- ne pas recopier automatiquement cette réussite dans les autres canaux.

En particulier, Twitch ne doit jamais servir de canal de notification asynchrone vers un joueur potentiellement absent.

Exemple :
si `!pull` sur Twitch obtient le personnage qui complète une mission, la réponse à cette action Twitch peut annoncer immédiatement la réussite.

Si la même mission a été terminée depuis le standalone, aucun message Twitch différé ne doit être envoyé.

## R313 — Récompenses B / A / S

Conserver pour la V1 :
- B : 160 Primogemmes ;
- A : 1 600 Primogemmes ;
- S : 16 000 Primogemmes.

Ces valeurs pourront être réévaluées uniquement lors d'un futur audit économique global.

## R314 — Récompense Z

Conserver provisoirement pour la V1 :
- 160 000 Primogemmes par mission Z.

La valeur pourra être réévaluée lors d'un futur audit global économie/endgame.

## R315 — Historique / état terminé

Ne pas créer d'historique player-facing des missions.

Mission quotidienne :
- aucun historique quotidien à afficher.

Missions permanentes :
- les missions terminées restent visibles dans l'écran Missions ;
- elles reçoivent un traitement visuel clair de complétion, par exemple carte grisée + indicateur `Terminée`.

Les données techniques strictement nécessaires à la cohérence, l'idempotence et au diagnostic serveur restent autorisées sans constituer un écran d'historique joueur.

---

# 22. Règles techniques dérivées déjà fixées

- `MissionService` est propriétaire de la progression, de la complétion et des récompenses.
- XP, Pull, Conversion, Combat, Expedition, Social, etc. produisent les événements métier pertinents mais ne réimplémentent jamais les règles Mission.
- les missions permanentes sont initialisées avec le joueur ;
- aucune baseline ne dépend d'un futur message XP ;
- les anciens champs d'activation/abandon ne doivent pas dicter le modèle standalone ;
- toute complétion/récompense sensible est atomique et idempotente ;
- plusieurs missions terminées par une même action de chat peuvent être regroupées dans une réponse compacte afin d'éviter le spam ;
- le backend détecte la réussite immédiatement au moment de la vraie action métier, et non au prochain message du joueur.

---

# 23. État

Domaine toujours ouvert.

Décisions R299 à R315 traitées.

Prochaine reprise :
**R316**

Points restant notamment à finaliser :
- catalogue et équilibrage exact de la mission quotidienne ;
- récompense quotidienne exacte ;
- sémantique détaillée de chaque type de progression ;
- cas particuliers liés aux objectifs dépendant de Combat / Expedition / Social ;
- migration finale des progressions permanentes legacy ;
- éventuels derniers détails UI / confidentialité avant clôture.
