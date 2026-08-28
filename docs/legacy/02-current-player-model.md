# 02 — Modèle joueur legacy actuel

Statut : EN CONSTRUCTION  
Référence canonique principale : profil `Kichnifou` dans les données Streamer.bot les plus récentes.

## Méthode

- Le profil `Kichnifou` sert de référence fonctionnelle principale car il contient les sections les plus récentes et les plus complètes.
- Les autres profils servent ensuite à tester les anciennes structures, champs absents, valeurs `null`, formats historiques et cas limites.
- Les données peuvent être réparties dans plusieurs JSON : `viewers_data.json` n'est donc pas la seule source.
- Toute propriété reste à confirmer par les scripts si son rôle exact n'est pas certain.
- Une donnée supposée obsolète n'est jamais supprimée sans validation explicite.
- Le futur import devra pouvoir être relancé avec des JSON plus récents sans duplication ni corruption.

## 1. Identité

### Ancien `username`

Statut : `MIGRATION / IDENTITÉ TWITCH`

Dans le système legacy, `username` correspond au pseudo Twitch utilisé comme clé du joueur.

Dans GachaImpact :
- le compte possède un ID interne immuable ;
- le joueur choisit un pseudo GachaImpact distinct ;
- le pseudo GachaImpact est celui affiché dans le jeu ;
- Twitch est optionnel ;
- si Twitch est lié, l'identité Twitch doit être conservée séparément pour permettre la correspondance avec les anciennes données.

## 2. Progression

### `level`

Statut : `MIGRER TEL QUEL`

- Niveau joueur.
- Niveau maximal : 100.
- Une fois niveau 100 atteint, le niveau n'augmente plus.

### `xp`

Statut : `MIGRER TEL QUEL / LOGIQUE XP AUDITÉE`

- L'XP cumulée est la source de vérité métier du niveau.
- 30 XP par palier.
- Niveau plafonné à 100 pour la V1.
- Après le niveau 100, l'XP continue d'augmenter et produit les récompenses d'overflow tous les 30 XP.
- Les règles complètes sont documentées dans `legacy/04-xp-audit.md`.

### `element`

Statut : `DONNÉE MÉTIER PERMANENTE`

Valeurs :
- Pyro
- Hydro
- Cryo
- Electro
- Anemo
- Geo
- Dendro

Règles :
- choisi une seule fois au début du jeu ;
- actuellement choisi via `!element` ;
- non modifiable ensuite ;
- définit l'élément personnel du joueur ;
- les particules de cet élément sont ses particules attitrées ;
- les particules de son propre élément peuvent être converties en primogemmes au taux 1:1 ;
- les particules des autres éléments peuvent être échangées avec d'autres joueurs, sous réserve des règles d'échange et des stocks disponibles ;
- les règles de conversion et les premières règles d'échange ont été confirmées dans `legacy/05-element-resources-audit.md`.

## 3. Ressources principales

### `primogems`

Statut : `MIGRER TEL QUEL`

Usage actuel validé :
- uniquement utilisées pour les invocations / pulls.

Aucun autre usage connu actuellement.

Les coûts exacts et la logique d'invocation seront documentés lors de l'audit de Pull / Bannière / Pity.

### `moras`

Statut : `MIGRER TEL QUEL`

Usages actuels connus :
- boutique ;
- banque.

Principes déjà validés :
- `moras` représente le portefeuille disponible ;
- les Moras déposées en banque restent un solde distinct ;
- un dépôt/retrait est un transfert interne et non un gain/dépense ;
- les dépenses ordinaires utilisent le portefeuille et ne prélèvent pas automatiquement la banque ;
- aucun solde ne peut devenir négatif ;
- aucun plafond artificiel n'est prévu en V1.

Les règles métier complètes de Banque seront approfondies dans son audit dédié.

### `particles`

Statut : `MIGRER TEL QUEL`

Structure :
- `pyro`
- `hydro`
- `cryo`
- `electro`
- `anemo`
- `geo`
- `dendro`

Règles validées :
- le joueur peut obtenir des particules de n'importe quel élément ;
- les particules correspondant à son élément personnel sont convertibles manuellement en Primogemmes au taux 1:1 ;
- toute quantité entière >= 1 peut être convertie dans la limite du stock disponible ;
- les particules des autres éléments sont échangeables avec des joueurs d'un élément différent ;
- les échanges sont symétriques : X particules contre X particules ;
- le stock disponible pour un échange correspond au stock total moins les quantités déjà réservées ;
- une seule demande d'échange active est autorisée entre deux mêmes joueurs ;
- le balayage global du legacy n'a identifié comme usages métier fondamentaux actuels que Conversion et Échange ;
- une nouvelle utilisation des particules ne doit pas être inventée pendant la migration ;
- `Main` désigne l'élément personnel du joueur ;
- `totalMainElementParticlesEarned` représente les particules de cet élément générées comme récompense par le jeu ;
- les particules reçues par transfert/échange ne sont pas comptées comme gain généré.

### Statistiques économiques cumulatives

Statut : `MIGRER TEL QUEL / HISTORIQUE POTENTIELLEMENT IMPARFAIT`

Champs principaux identifiés :
- `stats.totalPrimosEarned`
- `stats.totalPrimosSpent`
- `stats.totalMorasEarned`
- `stats.totalMorasSpent`
- `stats.totalMainElementParticlesEarned`

Décisions :
- migrer les valeurs legacy telles quelles ;
- ne pas reconstruire rétroactivement les oublis historiques ;
- les soldes courants restent les sources de vérité financières ;
- les compteurs servent aux statistiques ;
- à partir de GachaImpact, les mutations passent par une logique centrale et maintiennent ces informations de façon cohérente ;
- un journal serveur des mouvements importants est conservé à partir de la nouvelle implémentation.

### `tradeRequests`

Statut : `NE PAS MIGRER LES DEMANDES EN ATTENTE / STRUCTURE LEGACY À COMPRENDRE POUR LA TRANSITION`

Le legacy stocke les demandes d'échange directement dans chaque profil.

Pour une même demande :
- l'expéditeur possède une entrée `sent` ;
- le destinataire possède une entrée `received`.

Champs observés :
- `type`
- `otherUser`
- `amount`
- `myElement`
- `otherElement`
- `createdAt`

Règles métier confirmées :
- demande uniquement entre deux joueurs d'éléments différents ;
- pas d'auto-échange ;
- une seule demande active par paire ;
- échange symétrique X contre X ;
- comportement legacy : les deux côtés sont considérés réservés pendant l'attente ;
- cible GachaImpact validée : seul le stock engagé par l'expéditeur est réservé ;
- stock disponible de l'expéditeur = total - réservations de ses demandes envoyées ;
- le stock du destinataire reste libre jusqu'à acceptation ;
- les demandes expirent au changement de journée ;
- cible GachaImpact : expiration automatique au reset serveur 00:00 `Europe/Paris` ;
- le stock destinataire est vérifié lors de la création sans être réservé ;
- si sa disponibilité baisse ensuite, le montant courant de la demande diminue automatiquement ;
- à 0, la demande disparaît silencieusement ;
- une réduction ne remonte jamais automatiquement ;
- la réservation de l'expéditeur diminue immédiatement avec la demande ;
- `Accepter tout` traite les demandes reçues de la plus ancienne à la plus récente ;
- pas d'acceptation partielle manuelle ;
- le futur système conserve un historique serveur des échanges à partir de GachaImpact, sans inventer d'historique legacy absent.
- les demandes legacy encore ouvertes au cutover ne sont pas migrées ;
- leurs réservations temporaires ne sont pas migrées ;
- seuls les soldes réels de particules sont conservés ;
- les joueurs recréent leurs demandes après migration ;
- les nouvelles demandes GachaImpact utilisent les IDs internes immuables des joueurs et non leurs pseudos.

Important :
la duplication `sent` / `received` est une nécessité du modèle JSON legacy et ne doit pas être reproduite aveuglément dans le futur schéma relationnel.

Le futur modèle devra posséder une source de vérité unique pour chaque demande d'échange.
Le futur modèle devra également pouvoir distinguer conceptuellement le montant initial demandé, le montant courant après réductions éventuelles et le montant finalement échangé, sans figer ici le schéma SQL exact.
Toute modification transactionnelle d'un stock de particules devra déclencher la réconciliation immédiate des demandes affectées.

## 4. État personnel Gacha / Invocation

### `selectedBannerCharacterId`

Statut : `MIGRER / CIBLE PERSONNELLE`

Legacy :
- identifie le 5★ ciblé.

Cible :
- référence vers le personnage ciblé de la bannière active ;
- vidée automatiquement à chaque rotation hebdomadaire ;
- nouvelle sélection obligatoire avant Invocation ;
- changement libre sans reset pity/garantie/Capture ;
- au cutover legacy → standalone, conserver la cible si elle reste valide dans la bannière active importée ;
- si elle est invalide, la vider sans modifier pity/garantie/Capture.

### Pity

À migrer :
- pity 5★ ;
- pity 4★.

Règles :
- progression conservée entre rotations et changements de cible ;
- 5★ garanti au 90e selon la courbe validée ;
- 4★ garanti au 10e selon la courbe validée.

### `guaranteedFeatured5`

Statut : `MIGRER TEL QUEL`

- active après une vraie perte de 50/50 ;
- garantit le prochain 5★ ciblé ;
- consommée avant une Capture de brillance éventuelle ;
- traverse les rotations et changements de cible.

### `fiftyFiftyLostStreak`

Statut : `MIGRER TEL QUEL / SÉMANTIQUE CIBLE CLARIFIÉE`

Dans GachaImpact :
- compteur statistique des vrais 50/50 perdus consécutivement ;
- vraie perte → +1 ;
- vraie victoire → 0 ;
- garantie normale / Capture ne modifient pas ce streak ;
- peut dépasser 3 ;
- ne pilote plus directement la Capture.

### `captureProgress`

Statut : `NOUVELLE DONNÉE MÉTIER`

Valeur :
- 0..3.

Migration :
- initialiser depuis la valeur legacy actuelle de `fiftyFiftyLostStreak`, bornée à 0..3.

Après cutover :
- vraie perte 50/50 → +1 ;
- vraie victoire → -1, minimum 0 ;
- garantie normale → inchangé ;
- Capture déclenchée → 0.

### Statistiques Gacha cumulatives

Migrer telles quelles :
- `totalPulls`
- `totalFiveStars`
- `totalFourStars`
- `fiftyFiftyWon`
- `fiftyFiftyLost`
- `fiftyFiftyLostStreak`

Ne pas réparer rétroactivement les incohérences historiques.

Nouveau :
- `capturesTriggered`, démarrant à 0 faute d'historique legacy fiable.

### `lastPullWasFiveStar`

Statut cible : `TRANSITION / DONNÉE DÉRIVABLE`

- peut être importé pour préserver le contexte immédiat au cutover ;
- ne doit pas rester une source de vérité durable ;
- une fois l'historique natif disponible, le dernier résultat permet de déterminer un Back-to-back.

### Historique des Pulls

Le legacy ne permet pas de reconstruire un historique détaillé complet.

À partir de GachaImpact :
- conserver chaque Pull ;
- historique permanent ;
- x1/x10 groupés par opération ;
- ordre interne conservé ;
- 10 résultats par page dans l'UI ;
- pas de purge automatique annuelle par défaut.

## 5. À auditer ensuite

Prochain bloc prévu :
- Box / possessions de personnages
- équipe active
- options
- missions
- autres statistiques

Puis :
- options ;
- missions ;
- stats ;
- dates ;
- codes ;
- faveur ;
- coffre ;
- objets spéciaux ;
- combat ;
- expédition ;
- missions longues ;
- banque ;
- favoris ;
- équipes sauvegardées ;
- données joueur réparties dans les autres JSON.
