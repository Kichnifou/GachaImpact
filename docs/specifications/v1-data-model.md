# GachaImpact — Modèle de données V1 consolidé

> Statut : **EN COURS — Phase B / consolidation du modèle cible**  
> Baseline documentaire : `main` au commit `fae1d4e6884af6375b8f12dd4fb5f9263075a4f8`  
> Nature du document : modèle conceptuel/relational cible destiné à préparer le backend et la migration.  
> Il ne fige pas encore le fournisseur de base de données ni le DDL SQL final.

---

# 1. Objectif

Ce document transforme les audits legacy clôturés en un modèle de données V1 cohérent.

Il ne doit pas reproduire mécaniquement :

- `viewers_data.json` ;
- les 16 autres JSON legacy ;
- les 37 scripts Streamer.bot ;
- la structure des mocks frontend V0.

Le modèle V1 doit au contraire :

- posséder des identités stables ;
- séparer les domaines métier ;
- définir une source de vérité claire pour chaque donnée ;
- distinguer état courant, historique et données dérivées ;
- permettre des mutations atomiques et idempotentes ;
- supporter UI standalone, chat interne et Twitch avec les mêmes services métier ;
- rendre la migration legacy vérifiable et rejouable ;
- rester simple à faire évoluer avec Codex.

---

# 2. Principes techniques retenus

## 2.1 Identifiants

Toutes les entités métier durables utilisent un ID interne immuable.

Le pseudo GachaImpact, le pseudo Twitch, un nom de Team, un nom de personnage ou un token de code ne servent jamais de clé primaire métier.

Les références inter-domaines utilisent les IDs internes.

## 2.2 Joueur ≠ compte d'authentification

`Player` représente l'identité métier du joueur et sa progression.

Un Player peut exister :

- avec un compte web ;
- avec Twitch lié ;
- avec les deux ;
- comme profil Twitch-only avant création du compte web.

La création ultérieure d'un compte web ne recrée jamais la progression d'un profil Twitch-only existant.

## 2.3 Backend autoritaire

Le navigateur n'est jamais autoritaire pour :

- ressources ;
- XP ;
- personnages ;
- constellations ;
- pity ;
- garanties ;
- progression ;
- inventaire ;
- récompenses ;
- états temporels.

Le client envoie une intention d'action ; le serveur valide, exécute et persiste.

## 2.4 État courant vs historique

Les valeurs courantes restent les sources de vérité lorsqu'elles représentent un solde ou un état actif.

Les historiques servent à :

- expliquer les mutations ;
- afficher l'historique joueur ;
- auditer ;
- calculer certaines statistiques natives futures.

La V1 n'est pas un système d'event sourcing pur : on ne recalcule pas tous les soldes depuis zéro à chaque lecture.

## 2.5 Données dérivées

Une donnée calculable de façon fiable depuis des sources autoritatives n'est pas créée comme troisième source de vérité.

Exemples :

- niveau depuis XP ;
- patrimoine Moras depuis portefeuille + Banque ;
- passifs depuis Team active ;
- taille de Box depuis les possessions ;
- nombre de C6 depuis les possessions ;
- total de votes depuis les votes individuels ;
- Top depuis les domaines propriétaires ;
- Quotidiennes depuis les états des activités ;
- Historique global depuis les historiques spécialisés.

Une projection peut être mise en cache techniquement plus tard si nécessaire, mais ce cache reste reconstruisible.

## 2.6 Temps

Les timestamps persistés doivent être des instants non ambigus.

Choix technique cible :

- stockage en timestamps avec fuseau / UTC côté base ;
- règles de journée, reset et calendriers métier évalués en `Europe/Paris` lorsque les audits l'imposent ;
- timestamps legacy sans fuseau interprétés selon les règles de migration déjà validées.

## 2.7 Suppression

Pour les données ayant une valeur historique ou relationnelle, préférer archivage/désactivation à suppression destructive.

Exemples :

- personnages retirés du catalogue ;
- relations sociales retirées ;
- catalogues passés ;
- résultats historiques ;
- éditions Event/Boss ;
- bannières terminées.

## 2.8 Idempotence

Toute mutation sensible ou réessayable doit pouvoir recevoir une clé d'idempotence ou un identifiant d'opération équivalent.

Domaines concernés notamment :

- économie ;
- Pull ;
- récompenses ;
- claims ;
- achats ;
- échanges ;
- cœurs ;
- migration ;
- événements Twitch.

---

# 3. Carte des domaines V1

Le modèle est organisé autour des domaines suivants :

1. Identité / Compte
2. Progression
3. Ressources / Économie
4. Banque
5. Échanges
6. Catalogue personnages
7. Gacha / Bannière / Votes
8. Collection / Possessions
9. Concours / C6
10. Teams / Passifs
11. Inventaire / Objets
12. Boutique
13. Missions
14. Quotidiennes
15. Expedition
16. Combat quotidien
17. Boss mensuel
18. Social / Amitié
19. Présence
20. Confidentialité
21. Cosmétiques
22. Messages privés
23. Events mensuels
24. Codes cadeaux
25. Faveur
26. Giveaway / Wish
27. Notifications
28. Historique / projections
29. Top / Classements
30. Help / métadonnées de commandes
31. Migration / provenance

---

# 4. Identité / Compte

## 4.1 `Player`

Source de vérité de l'identité métier du joueur.

Champs conceptuels :

- `id`
- `displayName`
- `element`
- `createdAt`
- `status`
- métadonnées de migration nécessaires

Contraintes :

- ID immuable ;
- pseudo modifiable sans casser les relations ;
- élément permanent après choix valide ;
- un Player peut exister sans compte web.

## 4.2 `WebIdentity`

Liaison entre le Player et le fournisseur d'authentification web.

Conceptuellement :

- `playerId`
- identifiant auth externe
- `linkedAt`
- état de liaison

Cardinalité cible :

- Player 0..1 WebIdentity pour la V1.

## 4.3 `TwitchIdentity`

Identité Twitch vérifiée.

Conceptuellement :

- `playerId`
- `twitchUserId`
- dernier login/pseudo Twitch connu
- `linkedAt`
- première présence Twitch connue
- dernier message Twitch connu
- métadonnées legacy utiles

Contraintes :

- `twitchUserId` unique ;
- le pseudo Twitch n'est jamais la clé durable.

## 4.4 État d'onboarding

L'onboarding ne nécessite pas une grosse structure générique.

Prévoir les informations minimales nécessaires pour distinguer :

- profil Twitch-only nouvellement créé ;
- seuil d'onboarding atteint ;
- élément choisi ou non ;
- compte web finalisé ou non.

Le détail technique exact pourra être soit un petit état du Player, soit une structure dédiée selon le backend retenu.

---

# 5. Progression

## 5.1 `PlayerProgression`

Source autoritative :

- `playerId`
- XP cumulée
- état d'overflow niveau max si nécessaire
- compteurs de messages utiles
- dates de claim quotidien utiles

Le niveau est dérivé de l'XP selon les règles validées.

Si le niveau est matérialisé techniquement pour lecture rapide, il reste une projection contrôlée et ne peut pas diverger de l'XP.

## 5.2 Statistiques de progression

Les compteurs historiques certains du legacy sont importés tels quels lorsque les audits l'exigent.

Les nouvelles statistiques sont mises à jour par les services propriétaires.

Éviter une table géante contenant toute statistique imaginable.

Préférer :

- champs dédiés pour compteurs fortement structurants et souvent utilisés ;
- agrégats spécialisés dans leurs domaines ;
- vues/projections pour les classements.

---

# 6. Ressources / Économie

## 6.1 `ResourceDefinition`

Catalogue des types de ressources.

Exemples V1 :

- Primogemmes
- Moras
- particules Pyro
- particules Hydro
- particules Cryo
- particules Electro
- particules Anemo
- particules Geo
- particules Dendro

La définition peut porter :

- clé stable ;
- catégorie ;
- nom player-facing ;
- icône/asset ;
- précision/unité ;
- statut actif.

## 6.2 `PlayerResourceBalance`

Source de vérité des soldes joueur hors Banque.

Clé conceptuelle unique :

`playerId + resourceDefinitionId`

Contient :

- `amount`
- timestamp de dernière mutation utile

Invariant :

- aucun solde négatif.

## 6.3 `ResourceMovement`

Journal serveur des mutations économiques natives.

Contient conceptuellement :

- joueur ;
- ressource ;
- delta ;
- solde avant/après si utile à l'audit ;
- domaine/cause ;
- opération métier source ;
- canal d'origine ;
- timestamp ;
- idempotency key.

Le journal ne remplace pas le solde autoritatif.

## 6.4 Statistiques économiques

Les statistiques cumulatives legacy sont importées telles quelles selon les audits.

Les futures mutations natives alimentent les compteurs de façon centralisée.

Les transferts internes ne doivent pas être comptés comme gains/dépenses externes.

---

# 7. Banque

## 7.1 `PlayerBankAccount`

Domaine Banque propriétaire.

V1 initiale :

- une Banque Moras par joueur ;
- solde bancaire ;
- métadonnées utiles.

Le portefeuille Moras reste dans les ressources normales.

Le patrimoine Moras est dérivé :

`wallet Moras + bank Moras`

## 7.2 `BankTransaction`

Historique natif :

- dépôt ;
- retrait ;
- intérêt ;
- ajustement Admin éventuel.

Les dépôts/retraits sont des transferts internes atomiques.

## 7.3 Intérêt

Le scheduler serveur calcule l'intérêt selon la règle Banque validée.

`lastInterestDate` legacy peut être conservé comme provenance de migration, pas comme architecture future principale.

---

# 8. Échanges de particules

## 8.1 `TradeRequest`

Une seule source de vérité par demande.

Conceptuellement :

- `id`
- `senderPlayerId`
- `recipientPlayerId`
- élément/ressource de l'expéditeur
- élément/ressource attendue
- `originalAmount`
- `currentAmount`
- état
- dates création/expiration/résolution
- canal/source
- idempotency key

Ne jamais reproduire la duplication legacy `sent` / `received`.

## 8.2 Réservation

La réservation est portée par la demande envoyée.

Le stock réellement disponible est dérivé :

`solde réel - réservations actives de l'expéditeur`

La réconciliation est déclenchée après toute mutation pertinente du stock.

## 8.3 `TradeExecution`

Historique des échanges réellement exécutés :

- demande source ;
- montant final ;
- deux joueurs ;
- deux ressources ;
- date.

Les demandes legacy ouvertes au cutover ne sont pas importées.

---

# 9. Catalogue personnages

## 9.1 `Character`

Source unique des métadonnées du personnage :

- ID stable
- nom
- rareté
- élément
- arme
- région
- classe
- assets
- statut actif/désactivé
- ordre/métadonnées utiles

Une possession ne duplique jamais ces informations.

## 9.2 Désactivation

Un Character désactivé reste référencé historiquement.

Il est exclu des nouvelles actions player-facing selon les règles validées.

---

# 10. Gacha / Bannière / Votes

## 10.1 `BannerRotation`

Une bannière/rotation est séparée du catalogue.

Conceptuellement :

- `id`
- début/fin ou identifiant de semaine
- statut
- timestamps
- métadonnées de génération

## 10.2 `BannerFeaturedCharacter`

Relation entre une bannière et ses personnages présents.

Peut porter :

- caractère featured ;
- groupe/rareté ;
- origine de sélection si nécessaire ;
- ordre d'affichage.

## 10.3 `BannerVote`

Vote individuel autoritatif :

- banner/rotation
- player
- character
- timestamp

Contrainte :

- un vote définitif par joueur/semaine selon les règles validées.

Le total par personnage est dérivé.

## 10.4 `PlayerGachaState`

État personnel courant :

- `playerId`
- pity 5★
- pity 4★
- garantie featured
- progression Capture
- streak statistique de pertes 50/50
- cible actuelle éventuelle
- autres compteurs courants strictement nécessaires

## 10.5 `PullOperation`

Une action de Pull :

- joueur
- bannière
- quantité 1..10
- coût
- canal
- timestamp
- idempotency key

## 10.6 `PullResult`

Résultats ordonnés d'une opération :

- opération
- index
- personnage
- rareté
- état featured/garantie/capture utile
- contexte nécessaire aux statistiques natives

Les x10 restent groupés par opération.

---

# 11. Collection / Possessions

## 11.1 `PlayerCharacter`

Source de vérité d'une possession.

Contrainte :

`UNIQUE(playerId, characterId)`

Champs :

- constellation C0..C6
- copies
- première obtention
- favori
- provenance de date legacy si nécessaire
- état/quarantaine de migration si exceptionnel

Le personnage du catalogue est référencé par ID.

## 11.2 Règles

- possession permanente en gameplay normal ;
- constellation bornée 0..6 ;
- copies continuent après C6 ;
- première obtention immuable ;
- Stella passe par le service central de possession.

## 11.3 Données dérivées

Ne pas persister comme vérités indépendantes :

- taille Box ;
- nombre de 4★ ;
- nombre de 5★ ;
- nombre de C6 ;
- taux de complétion.

---

# 12. Concours / progression C6

## 12.1 `C6CompetitionProgress`

Extension spécialisée de :

`playerId + characterId`

Uniquement pour un vrai 5★ C6.

Contient :

- cinq statistiques Concours ;
- concours terminés ;
- victoires ;
- compteurs par thème ;
- victoires par thème ;
- plancher de titre/rang migré si nécessaire ;
- date historique C6 connue éventuelle.

Ne duplique aucune métadonnée du Character.

## 12.2 `Contest`

Instance de Concours :

- état ;
- organisateur ;
- thème ;
- timestamps ;
- phase/round ;
- autres informations de session.

## 12.3 Participations / résultats

Séparer conceptuellement :

- participants ;
- personnage utilisé ;
- score ;
- résultat ;
- soutien spectateur si encore pertinent dans la cible validée.

L'ancien historique non migré n'est pas recréé.

---

# 13. Teams / Passifs

## 13.1 `Team`

- ID stable
- player
- position d'affichage
- nom facultatif
- `savedAt` legacy éventuel
- état

Le Player porte une référence vers sa Team active.

## 13.2 `TeamMember`

- team
- character
- position 1..4

Contraintes :

- personnage unique dans une Team ;
- membres possédés et actifs ;
- ordre visuel conservé.

## 13.3 Passifs

Les passifs actifs sont dérivés :

`Team active + Character.element + catalogue de passifs`

Ils ne sont pas persistés par joueur comme vérité indépendante.

## 13.4 `ElementPassiveDefinition`

Catalogue/configuration serveur des passifs.

Une seule définition partagée entre Team, affichage et moteur Gacha.

---

# 14. Inventaire / objets

## 14.1 `ItemDefinition`

Catalogue générique d'objets persistants.

Exemples :

- Stella ;
- futurs objets spéciaux réellement introduits.

Ne pas créer artificiellement des catégories vides.

## 14.2 `PlayerItem`

Clé conceptuelle :

`playerId + itemDefinitionId`

Contient :

- quantité ;
- dates/métadonnées utiles.

La consommation passe par un service central d'inventaire.

---

# 15. Boutique

## 15.1 `ShopItemDefinition`

Catalogue serveur dynamique :

- ID
- nom
- description
- visuel
- prix
- monnaie
- displayOrder
- visibilité
- disponibilité
- type d'effet
- règles de quantité
- limite éventuelle
- statut

## 15.2 `ShopPurchase`

Historique natif des achats :

- joueur
- article
- quantité
- coût
- résultat/récompense
- timestamp
- canal
- operation/idempotency key

Le catalogue ne contient pas l'historique d'achat.

---

# 16. Missions

## 16.1 `MissionDefinition`

Définition générique :

- ID
- catégorie quotidienne/permanente
- rang B/A/S/Z ou type équivalent
- objectif
- seuil
- récompense
- ordre
- règles de visibilité/déblocage
- statut actif

## 16.2 `PlayerMissionProgress`

Progression personnelle :

- player
- mission
- état
- valeur courante/baseline si nécessaire
- dates de début/completion/claim selon le contrat du type de mission

Les missions permanentes validées sont automatiques et auto-récompensées selon leur domaine.

## 16.3 Mission quotidienne payante

Prévoir un état journalier spécifique au joueur :

- date serveur
- mission tirée
- progression
- coût de switch courant
- nombre de switches
- état terminé

La définition vient du catalogue ; l'état journalier appartient au joueur.

---

# 17. Quotidiennes

Il n'existe pas de table métier `DailyHub`.

Le hub Quotidiennes est une projection à partir de :

- Roue ;
- Combat ;
- Expedition ;
- cœur Ami ;
- Event ;
- Shop/Mission ;
- autres activités réellement intégrées.

États normalisés d'affichage :

- À faire
- En cours
- À récupérer
- Fait aujourd'hui
- états spécialisés validés lorsque nécessaire

`!quotis` et l'écran graphique lisent la même projection.

---

# 18. Expedition

## 18.1 `PlayerExpedition`

État courant par joueur :

- personnage
- départ
- `readyAt`
- journée de départ
- état
- timestamps utiles

Un départ du jour est distinct d'une Expedition ancienne encore en cours/prête.

## 18.2 Résolution

La récompense est déterminée côté serveur au claim selon les règles validées.

Le compteur `totalExpeditionsCompleted` est alimenté au claim réussi.

Aucun historique player-facing supplémentaire n'est nécessaire en V1 si le domaine ne le demande pas.

---

# 19. Combat quotidien

## 19.1 `DailyCombatEncounter`

État global du jour :

- date serveur
- quatre ennemis
- statut/configuration utile

Une seule rencontre globale est partagée par tous.

## 19.2 `PlayerDailyCombatLoadout`

Mémoire persistante des quatre slots du joueur.

Distincte de Team.

## 19.3 `DailyCombatAttempt`

- joueur
- encounter
- composition snapshot
- type MANUAL/AUTO
- chance calculée
- résultat
- timestamp

## 19.4 `PlayerDailyCombatState`

État du jour :

- victoire obtenue ou non ;
- personnages KO ;
- informations nécessaires aux retentes.

Les KO sont propres au quotidien et reset selon la journée serveur.

---

# 20. Boss mensuel

## 20.1 `MonthlyBoss`

Instance mensuelle :

- mois/année
- nom
- baseHp
- maxHp
- currentHp
- résistance élémentaire
- statut
- coup final
- timestamps
- paramètres adaptatifs utiles

## 20.2 `PlayerBossLoadout`

Quatre slots persistants par joueur, indépendants de Team et du Combat quotidien.

## 20.3 `BossAttack`

Chaque attaque valide :

- boss
- joueur
- timestamp
- dégâts
- snapshot composition/personnages/constellations
- informations de calcul utiles

## 20.4 Récompenses / statistiques

La participation et les classements sont dérivés des attaques autoritatives.

L'historique Boss natif conserve les instances passées.

---

# 21. Social / Amitié

## 21.1 `Friendship`

Paire canonique de joueurs :

- deux Player IDs
- état actif/archivé
- niveau
- total de cœurs
- dates utiles
- métadonnées migration

Contrainte :

- une relation logique par paire canonique.

## 21.2 `FriendRequest`

- expéditeur
- destinataire
- état pending/accepted/refused/cancelled
- dates
- canal
- idempotence

Une seule demande ouverte par paire.

## 21.3 `FriendHeart`

Événement de cœur validé :

- friendship
- sender
- recipient
- journée Europe/Paris
- timestamp
- récompenses associées/opération économique

Contrainte logique :

`friendship + sender + serverDay` unique.

## 21.4 `PlayerBlock`

Blocage entre joueurs :

- auteur
- cible
- dates
- état

---

# 22. Présence

Ne pas réutiliser `lastSeen` comme notion universelle.

Séparer conceptuellement :

## 22.1 `PlayerSession`

Session standalone connectée.

## 22.2 Activités récentes

Selon besoin :

- dernière activité application ;
- dernier message chat interne ;
- dernier message Twitch ;
- dernière activité gameplay.

Certaines valeurs peuvent être stockées directement comme timestamps récents plutôt qu'en historique exhaustif si aucun produit ne demande l'historique complet.

La présence en ligne est un état temps réel distinct de l'historique métier.

---

# 23. Confidentialité

## 23.1 `PrivacySetting`

Clé conceptuelle :

`playerId + privacyCategory`

Valeurs :

- Public
- Friends
- Private

Contient :

- valeur
- version/politique initiale si utile
- date de modification

Le serveur applique la permission avant de renvoyer les données.

Une donnée privée et une donnée vide restent deux états différents.

---

# 24. Cosmétiques

## 24.1 `CosmeticDefinition`

Catalogue :

- ID
- type Avatar/Titre
- nom
- asset
- règle de déblocage
- niveau de secret
- statut

## 24.2 `PlayerCosmetic`

- joueur
- cosmétique
- date/source de déblocage
- provenance legacy/native éventuelle

## 24.3 Équipement

Le profil du joueur référence :

- avatar équipé ;
- titre équipé.

Les déblocages sont permanents et idempotents.

---

# 25. Messages privés

## 25.1 `DirectConversation`

Conversation privée standalone.

## 25.2 `ConversationParticipant`

Participants et états personnels :

- conversation
- player
- unread/read state utile
- paramètres liés aux accusés si nécessaire

## 25.3 `DirectMessage`

- conversation
- auteur
- contenu courant
- createdAt
- editedAt
- deletedAt
- état de restauration temporaire selon les règles validées

## 25.4 Modération / signalement

Une copie signalée nécessaire à la modération est distincte du contenu courant modifiable/supprimable par l'auteur.

Les MP ne passent jamais par Twitch.

---

# 26. Events mensuels

Le futur Event est une vraie édition métier, pas un gros blob mensuel.

## 26.1 `EventDefinition`

Configuration/type d'Event réutilisable si nécessaire.

## 26.2 `EventEdition`

Instance mensuelle :

- année/mois
- statut
- début/fin
- configuration snapshot nécessaire

## 26.3 `EventParticipant`

- edition
- player
- joinedAt
- points
- monnaie Event courante
- métadonnées participant

## 26.4 Sous-états Event

Prévoir des entités spécialisées uniquement lorsque nécessaires :

- claim de palier ;
- état quotidien ;
- messages sociaux Event ;
- achats/collection Event ;
- état du Jeu B ;
- tirage mensuel ;
- résultat final / classement snapshot.

Ne pas introduire `monthly_events.json` dans le modèle : ce fichier legacy est vide et non migré.

---

# 27. Codes cadeaux

## 27.1 `GiftCode`

Définition du code :

- ID
- token
- titre
- disponibilité
- expiration/annualité
- statut
- métadonnées

## 27.2 `GiftCodeReward`

Récompenses attachées à la définition.

Supporte les types autorisés par le moteur de ressources.

## 27.3 `GiftCodeClaim`

Clé conceptuelle unique :

`giftCodeId + playerId`

Contient :

- claimAt
- opération de récompense
- provenance migration/native

Définition et claim sont deux concepts séparés.

---

# 28. Faveur

## 28.1 `PlayerFavor`

État courant :

- player
- jours/solde de Faveur ou représentation métier équivalente
- dates nécessaires au cycle validé

La représentation exacte doit préserver le comportement métier sans recopier obligatoirement `daysRemaining`.

## 28.2 `FavorGrant`

Historique natif des acquisitions de Faveur :

- bénéficiaire
- cause Twitch/subscription
- quantité/durée
- timestamp
- source event/idempotency key

## 28.3 Claims

Les claims quotidiens utilisent l'état Faveur mais passent par le moteur de récompenses central.

---

# 29. Giveaway / Wish

## 29.1 `GiveawaySession`

État d'une session Twitch :

- status
- openedAt/closedAt
- récompense
- gagnant
- paramètres
- état distribution chat

## 29.2 `GiveawayParticipant`

- session
- player/Twitch identity
- joinedAt
- état

## 29.3 `GiveawayChatStat`

Compteurs de messages de session uniquement.

Ne devient pas un historique général du chat.

## 29.4 Résultat

Le résultat et les récompenses doivent être persistés avant d'être considérés définitifs côté public.

---

# 30. Notifications

## 30.1 `Notification`

Catégories :

- actionnable ;
- informationnelle.

Les feedbacks éphémères d'UI n'ont pas besoin d'être persistés comme notifications durables.

Conceptuellement :

- player
- type
- catégorie/domaine
- payload minimal
- createdAt
- readAt
- resolvedAt/archivedAt
- lien/action cible

Une notification actionnable est résolue dès que l'action n'est plus réellement disponible, quel que soit le canal ayant exécuté l'action.

---

# 31. Historique global

L'écran global `Historique` n'a pas sa propre source métier.

Il agrège les historiques de domaines tels que :

- Pulls ;
- Boutique ;
- Banque ;
- échanges ;
- Boss ;
- autres domaines ayant un historique player-facing validé.

Une projection/read model pourra unifier l'affichage.

---

# 32. Top / Classements

Top est entièrement read-only.

Aucune table `top_rankings` n'est nécessaire comme source de vérité métier.

Les métriques sont lues depuis :

- progression ;
- Gacha ;
- ressources ;
- collection ;
- activité ;
- domaines spécialisés.

Un cache de classement est possible techniquement plus tard si le volume le justifie, mais il doit être reconstruisible.

Les règles de confidentialité sont appliquées avant inclusion dans les classements.

---

# 33. Help / commandes

Help n'a aucune donnée joueur persistante.

Prévoir un registre de métadonnées de commande utilisable par :

- chat interne ;
- Twitch ;
- futur écran Aide/Guide ;
- administration selon permissions.

Les métadonnées décrivent :

- nom canonique ;
- aliases ;
- catégorie ;
- canaux ;
- permission ;
- aide courte ;
- statut actif.

Les règles métier détaillées restent dans les services/domaines propriétaires et ne sont pas copiées dans Help.

---

# 34. Migration / provenance

## 34.1 `MigrationRun`

Une tentative/import :

- ID
- snapshot source
- démarrage/fin
- statut
- version du migrateur
- statistiques globales
- hash/identité du snapshot si utile

## 34.2 `MigrationSourceSnapshot`

Référence aux sources utilisées :

- fichiers
- date de capture
- checksums/hashes
- provenance

## 34.3 `MigrationMapping`

Permet de retrouver la correspondance entre :

- identité legacy ;
- Player V1 ;
- entités spécialisées si nécessaire.

## 34.4 `MigrationIssue`

Anomalie détectée :

- source
- joueur/entité concernée
- catégorie
- sévérité
- valeur originale
- traitement appliqué
- statut de résolution

## 34.5 Règles

- import rerunnable ;
- idempotent ;
- aucune duplication silencieuse ;
- aucune donnée inconnue supprimée arbitrairement ;
- fallback traçable ;
- quarantaine pour ambiguïtés réelles ;
- bots exclus selon les décisions existantes ;
- les demandes temporaires explicitement non migrées restent non migrées.

---

# 35. Ordre logique de migration

Ordre conceptuel recommandé :

1. charger et valider les catalogues/configurations nécessaires ;
2. créer les Players et mappings d'identité legacy ;
3. importer progression et ressources ;
4. importer possessions ;
5. importer extensions C6 ;
6. importer Teams ;
7. importer états Gacha personnels ;
8. importer données sociales ;
9. importer états temporels conservés au cutover ;
10. importer claims/codes/Faveur et autres états spécialisés ;
11. importer historiques explicitement conservés ;
12. recalculer uniquement les projections dérivables autorisées ;
13. produire le rapport d'anomalies ;
14. vérifier les invariants ;
15. marquer le run terminé.

Chaque étape doit être relançable sans multiplier les données.

---

# 36. Invariants transversaux prioritaires

Le backend devra pouvoir imposer au minimum :

- aucun solde négatif ;
- une possession unique par joueur/personnage ;
- constellation 0..6 ;
- une identité Twitch liée à au plus un Player ;
- une Team membre uniquement de personnages possédés et actifs pour les nouvelles mutations ;
- aucune duplication de personnage dans une Team ;
- une demande d'échange logique unique et cohérente ;
- une relation d'amitié logique par paire ;
- un cœur par relation/expéditeur/journée ;
- un vote hebdomadaire définitif par joueur selon la règle Gacha ;
- un claim de code par joueur/code ;
- récompenses économiques atomiques ;
- mutations sensibles idempotentes ;
- permissions appliquées côté serveur ;
- aucune projection ne devient une vérité concurrente.

---

# 37. Ce que ce modèle ne fige pas encore

À décider pendant la préparation backend / DB :

- Supabase/PostgreSQL ou autre socle final ;
- noms SQL définitifs ;
- UUID vs autre forme d'ID interne ;
- index exacts ;
- partitionnement éventuel ;
- politique de cache ;
- RLS/permissions techniques ;
- détails du Realtime ;
- jobs/schedulers concrets ;
- API/transport ;
- structure exacte des payloads.

Ces choix doivent être faits à partir du besoin V1 réel, pas à partir du legacy.

---

# 38. Points produit encore volontairement hors modèle

Certains sujets déjà marqués comme futurs dans les audits n'empêchent pas de consolider la structure :

- contenu exact du futur mode XP standalone ;
- certains équilibrages futurs ;
- Objectifs personnels futurs ;
- futurs objets/monnaies non encore introduits ;
- polish UI ;
- fonctionnalités commerciales du futur jeu original.

Le modèle reste extensible sans inventer ces fonctionnalités maintenant.

---

# 39. État de readiness du modèle

Le modèle est suffisamment défini pour :

- préparer la traduction en schéma relationnel ;
- vérifier les cardinalités ;
- préparer le mapping de migration ;
- définir les propriétaires d'écriture ;
- préparer les lots backend.

Avant de considérer la Phase B clôturée, il reste à :

1. recroiser cette carte entité par entité avec les audits spécialisés ;
2. formaliser les cardinalités et contraintes uniques principales ;
3. formaliser le mapping legacy -> V1 par domaine ;
4. identifier les rares décisions produit réellement bloquantes, s'il en reste ;
5. checkpoint documentaire ;
6. effectuer une revue de readiness avant Phase C.
