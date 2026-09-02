# 11 — Audit legacy Missions / Daily

Statut : CLÔTURÉ — R299 À R339 VALIDÉS / DÉRIVÉS
Date : 2026-09-01

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

# 21. Décisions standalone validées — R299 à R339

Les décisions de cette section sont autoritatives pour la cible standalone et remplacent les mentions `À décider` encore présentes dans les constats legacy précédents.

## R299 — Organisation de l'écran Missions — mise à jour transverse R355

Un seul écran `Missions` avec deux onglets principaux :
- `Quotidienne` ;
- `Permanentes`.

L'onglet Quotidienne accueille uniquement la mécanique de mission quotidienne payante :
- achat ;
- état ;
- progression ;
- switch ;
- récompense.

L'onglet Permanentes porte les missions B/A/S/Z selon les décisions du présent domaine.

La direction initiale qui plaçait aussi le suivi général des activités quotidiennes dans cet écran est remplacée par R355.

Le suivi général appartient désormais à un écran transversal distinct :
`Quotidiennes`.

Cette correction ne change aucune règle métier de `missions.daily`.

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

## R311 — `!quotis` dynamique — précisé par R355

Conserver `!quotis` dans le chat interne et sur Twitch.

Il ne doit plus envoyer une chaîne statique.

Il interroge les vrais états serveur des activités quotidiennes et produit un résumé compact de leur état.

R355 précise son équivalent UI :
- `!quotis` est la version texte compacte de l'écran transversal `Quotidiennes` ;
- cet écran est distinct de `Missions` ;
- chaque activité renvoie vers son véritable domaine propriétaire.

La liste exacte des activités peut encore évoluer à mesure que Roue, Combat, Ami et Event sont audités.

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

## R316 — Prix de la mission quotidienne

Conserver pour la V1 :
- achat quotidien : 10 000 Moras ;
- débit depuis le portefeuille ;
- aucune utilisation automatique de la Banque.

Le montant pourra être revu uniquement dans un futur équilibrage économique global.

## R317 — Récompense de la mission quotidienne

Conserver pour la V1 :
- +800 Primogemmes à la complétion.

La récompense est auto-claim selon R303.

## R318 — Catalogue quotidien V1

Conserver comme pool initial les trois missions legacy actives :
- écrire 10 messages éligibles ;
- faire 5 Pulls ;
- convertir 320 particules.

Le catalogue reste serveur, dynamique et extensible.

Les trois missions initiales utilisent le même poids de sélection.

De nouvelles missions pourront être ajoutées après audit de leurs domaines propriétaires plutôt que d'inventer prématurément des objectifs sur des systèmes encore non audités.

## R319 — Début de progression quotidienne

La progression commence uniquement à partir du moment où la mission quotidienne est attribuée.

Les actions effectuées plus tôt dans la même journée ne sont jamais créditées rétroactivement.

Exemple :
- 20 Pulls effectués ;
- achat ultérieur de la quotidienne `Faire 5 Pulls` ;
- progression initiale = 0/5.

## R320 — Quotidienne Messages

La quotidienne Messages repose sur les messages réellement éligibles au gain d'XP, donc sur la même sémantique que `countedMessages`.

Ne comptent notamment pas :
- les commandes ;
- les messages système/bot ;
- les messages rejetés par le cooldown XP ;
- tout message non éligible à l'XP.

Le cooldown XP reste global entre Twitch et le chat interne.

## R321 — Quotidienne Pulls — règle dérivée

Chaque Pull réellement exécuté contribue de +1.

Donc :
- Pull x1 réellement exécuté → +1 ;
- Pull x10 réellement exécuté → +10 ;
- opération refusée avant exécution → +0 ;
- progression clampée à la cible ;
- aucun surplus n'est reporté sur une future mission.

La règle est identique quel que soit le canal.

## R322 — Quotidienne Conversion — règle dérivée

La progression correspond à la quantité réellement convertie.

Exemple :
- +100 ;
- +150 ;
- +100 ;
- mission 320 terminée à 320/320.

Une conversion refusée ne produit aucune progression.

La règle est identique quel que soit le canal.

## R323 — Achat proche du reset

L'achat reste autorisé jusqu'au reset serveur de 00:00 `Europe/Paris`.

Standalone UI :
- afficher clairement le temps restant avant le reset ;
- rendre l'avertissement plus visible lorsque le reset est proche.

Twitch/chat :
- action directe ;
- aucune confirmation supplémentaire en plusieurs messages ;
- la réponse peut rappeler le temps restant lorsque celui-ci est particulièrement court.

Règles techniques associées :
- une mission déjà attribuée puis désactivée du catalogue reste valable pour ce joueur jusqu'à son reset normal ;
- lors de l'attribution, conserver un snapshot suffisant des termes métier de la mission, notamment son ID/version, sa cible et sa récompense ;
- une modification ultérieure du catalogue ne change pas rétroactivement une mission déjà achetée.

## R324 — Messages des missions permanentes

Les missions permanentes Messages utilisent la même sémantique que `countedMessages`.

Donc seuls les messages éligibles à l'XP font progresser ces missions.

Les commandes ou messages rejetés par le cooldown ne permettent pas de farmer la progression.

## R325 — Personnages 4★ / 5★

Les missions `characters4` et `characters5` comptent les personnages distincts possédés de la rareté concernée.

Les copies/constellations supplémentaires du même personnage ne comptent pas comme de nouveaux personnages.

Exemple :
- un personnage 4★ C6 = 1 personnage pour cette progression.

## R326 — Moras gagnées

Les missions Moras utilisent les Moras réellement générées/gagnées par le joueur.

Comptent notamment :
- récompenses de jeu ;
- Daily ;
- level-up ;
- Combat ;
- Expedition ;
- intérêts Banque ;
- Ticket ;
- Event ;
- toute autre source légitime produisant réellement des Moras.

Ne comptent pas :
- retrait Banque ;
- dépôt Banque ;
- transfert interne entre deux soldes appartenant au joueur.

Le service économique central est autoritatif sur la distinction gain / dépense / transfert.

## Particules principales — règle transverse déjà validée

La progression `mainParticlesEarned` utilise les particules de l'élément personnel réellement générées comme récompense par le jeu.

Les particules reçues d'un autre joueur via échange/transfert ne comptent pas comme un gain généré.

L'anomalie legacy où certains producteurs n'alimentent pas correctement ce compteur ne doit pas être reproduite.

## R327 — Objectifs B / A / S

Conserver pour la V1 les seuils legacy :

| Catégorie | B | A | S |
|---|---:|---:|---:|
| Messages | 50 | 200 | 1 000 |
| Pulls | 50 | 200 | 1 000 |
| Personnages 4★ distincts | 3 | 10 | 30 |
| Personnages 5★ distincts | 1 | 5 | 20 |
| Moras gagnées | 50 000 | 200 000 | 1 000 000 |
| Particules principales gagnées | 500 | 2 000 | 10 000 |
| Expéditions | 3 | 10 | 30 |
| Combats gagnés | 5 | 20 | 100 |
| Cœurs envoyés | 10 | 40 | 200 |

Ces valeurs pourront être réévaluées seulement lors d'un futur équilibrage global.

## R328 — Migration des progressions permanentes

Respecter la progression réellement acquise dans le legacy plutôt que recalculer rétroactivement toute la carrière du joueur.

À importer :
- rangs certainement terminés → restent terminés ;
- progression certaine d'une mission commencée/en cours → conservée ;
- informations de baseline fiables → utilisables pour reconstruire le minimum certain.

Un rang ou une chaîne jamais commencée dans le legacy ne reçoit pas rétroactivement toute la progression historique du joueur.

Après le cutover :
- toutes les missions accessibles progressent automatiquement selon R301.

Principes conservateurs :
- ne jamais retirer un rang certainement terminé ;
- ne jamais inventer de progression depuis une baseline ambiguë/corrompue ;
- conserver le minimum certain ;
- signaler les anomalies ;
- ne jamais reverser une récompense dont il n'est pas certain qu'elle n'a pas déjà été attribuée.

## R329 — Renommage des intitulés trop liés à Twitch

Les intitulés de mission ne doivent pas supposer que le joueur utilise Twitch.

Renommages cibles :
- `Voix du stream` → `Voix infatigable` ;
- `Millionnaire du stream` → `Millionnaire`.

Les autres intitulés legacy restent conservés tant qu'ils fonctionnent naturellement dans le standalone.

Les fichiers legacy sources ne sont pas modifiés ; ces nouveaux intitulés appartiennent au catalogue standalone.

## R330 — Présentation UI des missions permanentes

L'onglet `Permanentes` contient quatre sous-onglets :
- `B` ;
- `A` ;
- `S` ;
- `Z`.

Dans les rangs B/A/S, chaque mission affiche clairement son état :
- `✅` mission terminée, avec traitement visuel grisé ;
- `▶` mission actuellement en progression ;
- `🔒` mission encore verrouillée.

Le rang Z :
- possède son onglet visible ;
- l'onglet reste grisé/verrouillé tant que toutes les missions B/A/S ne sont pas terminées ;
- avant déblocage, son contenu n'est pas révélé ;
- afficher uniquement un message indiquant que le rang Z sera accessible après accomplissement de toutes les missions de rang B, A et S ;
- ne révéler ni intitulés, ni objectifs, ni récompenses Z avant ce déblocage.

## R331 — Quotidienne terminée

Après complétion :
- la récompense est immédiatement attribuée ;
- la mission reste visible jusqu'au reset quotidien ;
- afficher `✅ Terminée` ;
- conserver la barre de progression pleine.

Elle disparaît/réinitialise seulement au reset de 00:00.

## R332 — Confirmation du switch dans l'UI

Standalone UI :
- progression actuelle = 0 → switch direct ;
- progression actuelle > 0 → demander confirmation avant de détruire cette progression.

La confirmation affiche au minimum :
- progression qui sera perdue ;
- coût actuel du switch.

Twitch/chat :
- `!shop switch` reste une action directe ;
- aucune confirmation en deux étapes.

## R333 — Mission inconnue avant achat

La mission quotidienne exacte n'est pas révélée avant le paiement des 10 000 Moras.

Flux :
`achat → paiement validé → tirage serveur → révélation de la mission`.

Le joueur ne choisit pas sa mission quotidienne initiale.

## R334 — Probabilités quotidiennes non affichées

Ne pas afficher au joueur les pourcentages/chances de tirage des missions quotidiennes.

Aucune vue player-facing de probabilités n'est nécessaire.

Le catalogue serveur peut néanmoins conserver des poids configurables pour le fonctionnement interne.

Cette décision ne change pas R333 : la mission effectivement obtenue reste inconnue avant l'achat.

## R335 — Missions publiques en V1

Les missions et leurs progressions sont publiques en V1 et peuvent être consultées depuis le profil d'un autre joueur.

Cela concerne :
- mission quotidienne actuelle et sa progression ;
- missions permanentes B/A/S et leurs états/progressions ;
- rang Z après son déblocage.

Le secret de R308/R330 reste prioritaire :
- tant que le rang Z d'un joueur est verrouillé, les autres joueurs ne voient pas davantage d'informations que le propriétaire ;
- intitulés, objectifs et récompenses Z restent cachés.

Une future évolution globale de la confidentialité pourra éventuellement rendre cette catégorie configurable, mais la règle V1 est publique.

## R336 — Consultation des missions d'autres joueurs

Les commandes `!mission` du chat interne et de Twitch consultent uniquement les missions du joueur qui exécute la commande.

Ne pas ajouter de syntaxe :
- `!mission <pseudo>` ;
- ou équivalent destiné à consulter les missions d'un autre joueur depuis le chat.

La visibilité publique validée en R335 est portée par la fiche/profil joueur du standalone.

Règles de consultation :
- `!mission` → résumé compact comprenant la quotidienne actuelle ainsi qu'un aperçu des progressions permanentes ;
- `!mission B` → consultation du rang B ;
- `!mission A` → consultation du rang A ;
- `!mission S` → consultation du rang S ;
- `!mission Z` → consultation du rang Z ou information de verrouillage.

`!mission resume` peut rester accepté comme alias de compatibilité de `!mission`, mais il n'est pas présenté comme syntaxe recommandée dans les helpers.

Si une réponse de rang dépasse la taille raisonnable d'un message Twitch/chat :
- découper proprement en plusieurs messages ;
- chaque message reste sur une seule ligne ;
- ne pas tronquer silencieusement des missions pour tenir artificiellement dans un seul message.

La vue publique d'un autre joueur dans le standalone réutilise l'écran Missions en lecture seule :
- même structure Quotidienne / Permanentes ;
- mêmes rangs B / A / S / Z ;
- mêmes progressions autorisées ;
- aucune action d'achat, switch ou mutation ;
- Z verrouillé conserve exactement le même secret que pour le propriétaire.

## R337 — Mission quotidienne lors du cutover

Si une mission quotidienne legacy appartient réellement au jour du cutover, elle est conservée jusqu'au reset normal.

Préserver lorsque les données sont certaines :
- mission attribuée ;
- progression ;
- état de complétion ;
- `switchCount` du jour ;
- informations nécessaires à son prochain coût de switch.

Une mission appartenant à un jour précédent n'est pas importée comme quotidienne active.

Règles conservatrices :
- mission du jour valide et connue → import ;
- mission inconnue/incompatible avec le catalogue → signaler l'anomalie sans inventer de correspondance ;
- `completed = true` et `rewardClaimed = true` → conserver l'état terminé jusqu'au reset, sans nouvelle récompense ;
- état contradictoire tel que `completed = true` / `rewardClaimed = false` → ne jamais créditer automatiquement une récompense pendant la migration ; signaler pour contrôle ;
- charger une donnée de migration ne déclenche jamais à lui seul une récompense.

Le reset suivant à 00:00 `Europe/Paris` reprend ensuite le fonctionnement standalone normal.

## R338 — Évaluation rétroactive des missions Z

Les missions Z utilisent l'état ou les statistiques autoritatives déjà acquis par le joueur.

Lors du déblocage du rang Z :
- toutes les missions Z deviennent actives selon R307 ;
- elles sont immédiatement évaluées ;
- une condition déjà satisfaite peut donc compléter immédiatement la mission correspondante.

Exemples :
- le joueur était déjà niveau 100 ;
- il possédait déjà suffisamment de personnages C6 ;
- une condition Amitié était déjà satisfaite ;
- un compteur Combat déjà acquis satisfait l'objectif, sous réserve de sa définition finale dans le Domaine Combat.

Le joueur n'a jamais à reproduire artificiellement une condition déjà atteinte avant le déblocage de Z.

Une complétion immédiate :
- utilise l'auto-claim normal ;
- respecte les mêmes règles atomiques/idempotentes ;
- restitue éventuellement la réussite uniquement dans le canal de l'action qui vient de provoquer le déblocage.

Migration Z :
- `unlockedZ = true` certain → conserver le déblocage ;
- sinon, toutes les B/A/S certainement terminées → Z est débloqué ;
- une contradiction ne doit pas retirer un déblocage historiquement certain ;
- journaliser l'anomalie ;
- une mission Z déjà certainement terminée ne redonne jamais sa récompense.

## R339 — Clôture du Domaine Missions / Daily

Le Domaine Missions / Daily est considéré comme clôturé après R339.

Les dépendances suivantes sont volontairement reportées et devront recroiser ce document lors de leurs audits :

### Expedition
Définir précisément quel événement autoritatif constitue une expédition terminée et alimente la progression Mission correspondante.

### Combat — ✅ RÉSOLU PAR R387 / R388, MIS À JOUR R426 / R427

Le Domaine Combat définit maintenant :

- `totalCombatWins` = toutes les victoires du combat quotidien, manuelles ou Auto ;
- les missions permanentes B/A/S Combat utilisent `totalCombatWins` ;
- seuils conservés : B 5 / A 20 / S 100 victoires ;
- `totalManualCombatWins` = victoires obtenues lors d'une tentative dont le mode autoritatif est `MANUAL` ;
- une composition construite manuellement compte comme manuelle ;
- `Sélectionner l'équipe active` puis combattre compte comme manuel ;
- une composition Auto mémorisée puis réutilisée ultérieurement sans relancer Auto compte comme manuelle ;
- une tentative exécutée immédiatement après `Équipe automatique` est Auto ;
- `!combat auto` reste Auto ;
- la sémantique exacte de `!combat go` sera finalisée dans Combat, mais MissionService ne la déduit jamais lui-même ;
- la mission Z `Maître du combat` conserve son objectif de 50 victoires manuelles.

`CombatService` fournit explicitement le mode `MANUAL` / `AUTO` de la victoire et `MissionService` consomme cet événement sans recalculer la composition.

### Ami / Social
Définir précisément :
- les cœurs envoyés comptabilisés ;
- Amitié Parfaite ;
- les interactions nécessaires avec les missions permanentes/Z.

### Roue / Combat / Expedition / Ami / Event
Finaliser les états quotidiens réellement exposés par `!quotis` et le suivi quotidien général.

Ces dépendances ne rouvrent pas automatiquement le Domaine Missions.

Lorsqu'un domaine propriétaire fixe sa règle :
- mettre à jour son audit ;
- mettre également à jour `11-missions-daily-audit.md` si nécessaire ;
- ne pas réinventer une seconde logique dans `MissionService`.

---

# 22. Règles techniques dérivées déjà fixées

- `MissionService` est propriétaire de la progression, de la complétion et des récompenses.
- XP, Pull, Conversion, Combat, Expedition, Social, etc. produisent les événements métier pertinents mais ne réimplémentent jamais les règles Mission.
- les missions permanentes sont initialisées avec le joueur ;
- aucune baseline ne dépend d'un futur message XP ;
- les anciens champs d'activation/abandon ne doivent pas dicter le modèle standalone ;
- toute complétion/récompense sensible est atomique et idempotente ;
- plusieurs missions terminées par une même action de chat peuvent être regroupées dans une réponse compacte afin d'éviter le spam ;
- le backend détecte la réussite immédiatement au moment de la vraie action métier, et non au prochain message du joueur ;
- le catalogue quotidien supporte des poids configurables sans obligation de les exposer aux joueurs ;
- les termes nécessaires d'une quotidienne attribuée sont snapshotés afin qu'une modification de catalogue ne la transforme pas rétroactivement ;
- les mutations économiques autoritatives produisent les informations de gain/dépense/transfert utilisées par les Missions ;
- `MissionService` consomme ces événements métier fiables au lieu de déduire les gains depuis l'UI ou depuis un futur message ;
- Expedition et Combat ont désormais défini leurs événements autoritatifs de progression ; Social reste propriétaire de la définition exacte de ses événements.

---

# 23. État final

Décisions R299 à R339 validées / dérivées.

**Domaine Missions / Daily : CLÔTURÉ.**

Sont maintenant cadrés :
- mission quotidienne ;
- achat ;
- switch ;
- reset ;
- catalogue initial ;
- progression ;
- récompenses ;
- missions permanentes B/A/S ;
- rang Z ;
- activation automatique ;
- consultation UI/chat/Twitch ;
- restitution multi-canaux ;
- visibilité publique ;
- migration ;
- architecture de progression centralisée.

Recroisements effectués après clôture :
- Expedition → résolu par R362 ;
- Combat → résolu par R387/R388.

Dépendances restant explicitement reportées :
- Ami / Social ;
- Roue / Event pour leur contribution au suivi `!quotis`.

Le Domaine Missions reste clôturé.
