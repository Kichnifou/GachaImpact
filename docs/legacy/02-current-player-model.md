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
- le joueur possède un ID interne immuable ;
- le joueur choisit un pseudo GachaImpact distinct ;
- le pseudo GachaImpact est celui affiché dans le jeu ;
- Twitch est optionnel ;
- l'identité Twitch est conservée séparément ;
- le Twitch User ID stable sert de référence autoritative pour la liaison Twitch ;
- un profil Twitch-only peut exister avant création d'un compte web ;
- connecter ultérieurement ce Twitch à un compte web rattache le compte au même joueur interne et à sa progression existante.

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

Les règles métier Banque sont désormais clôturées dans `legacy/09-banque-audit.md`.

Banque :
- `bank.moras` = solde bancaire séparé ;
- dépôt/retrait = transferts internes atomiques ;
- intérêt automatique 3 % au reset serveur ;
- `bank.lastInterestDate` = donnée legacy de transition/provenance, pas source de vérité du futur scheduler ;
- historique bancaire natif créé uniquement à partir du standalone ;
- patrimoine total dérivé `wallet + bank`, jamais stocké inutilement ;
- visibilité Banque soumise à la confidentialité.

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

## 5. Box / possessions de personnages

### Relation de possession

Cible conceptuelle :
- une seule possession par `playerId + characterId`.

Données portées par la possession :
- `characterId` ;
- `constellation` ;
- `copies` ;
- `firstObtainedAt` ;
- favori ;
- provenance de la date de première obtention si nécessaire pour la migration.

Le nom, élément, rareté et assets viennent du catalogue personnage.

### `constellation`

- entier métier C0..C6 ;
- ne dépasse jamais 6.

### `copies`

- nombre de copies réelles ou synthétiques obtenues ;
- continue à augmenter après C6 ;
- une Stella utilisée sur un 5★ incrémente désormais `copies`.

Migration :
`copiesCible = max(copiesLegacy, constellation + 1)`

### `firstObtainedAt`

- première acquisition du personnage ;
- immuable après création de la possession ;
- doublons et Stella ne la remplacent pas.

Migration :
- date valide → conserver ;
- date absente/invalide → timestamp de migration ;
- conserver intérieurement que la valeur vient d'un fallback.

### Favori

Cible :
- propriété liée à une possession existante ;
- aucun favori sans possession ;
- favoris legacy orphelins ignorés côté possession et signalés dans le rapport d'import.

### Personnage désactivé

La possession reste conservée côté serveur.

Côté joueur :
- personnage totalement masqué et inutilisable ;
- exclu de Box, Personnages, Team, Expedition, Combat, votes et statistiques visibles.

Les anciennes références historiques restent conservées.

### Possession non résolue

Si le `characterId` n'existe pas dans le catalogue au cutover :
- conserver la possession ;
- masquer côté joueur ;
- signaler dans le rapport d'import ;
- permettre un rattachement futur.

### Invariants supplémentaires

- une possession est permanente en gameplay normal ;
- constellation bornée à C0..C6 ;
- pas de C7 ;
- `copies` continue au-delà de C6 ;
- un service central est propriétaire des mutations fondamentales de possession ;
- Pull, Stella, Admin et futures récompenses explicitement autorisées passent par ce service ;
- Team, Expedition, Combat, Infos et autres consommateurs ne modifient pas directement copies/constellation/date.

Migration :
- `characterId` récupérable depuis la clé Box si cela est certain ;
- constellation invalide bornée 0..6 ;
- copies invalides réparées selon le minimum certain ;
- doublons fusionnés conservativement ;
- ambiguïtés réelles mises en quarantaine pour résolution ;
- données illisibles consignées sans inventer une possession.

### Visibilité / confidentialité — précisée par Social R469/R473/R486/R488

La possession peut exister côté serveur sans être visible au visiteur.

Chaque rubrique configurable utilise :
- Public ;
- Amis uniquement ;
- Privé.

Les catégories sensibles sont privées par défaut mais peuvent être volontairement partagées.

Lorsqu'une rubrique est autorisée :
- la vraie vue métier peut être réutilisée en lecture seule ;
- les actions de mutation sont absentes ;
- une donnée privée reste distincte d'une donnée vide.

Les contrôles de permissions sont appliqués côté serveur avant la récupération ou le retour des données.

## 6. Team

### Modèle cible conceptuel

Un joueur possède plusieurs Teams.

Une Team possède conceptuellement :
- une identité interne stable ;
- une position d'affichage courante ;
- un nom facultatif ;
- 0 à 4 références ordonnées de personnages ;
- ses métadonnées utiles ;
- éventuellement l'historique legacy `savedAt` importé.

Le joueur possède également une référence vers la Team actuellement active.

Il n'existe pas de composition `active team` séparée à copier.

### Équipe active

- exactement une Team active ;
- Team 1 par défaut à la création ;
- 0 à 4 personnages ;
- personnages possédés et actifs ;
- aucun doublon ;
- peut rester vide/incomplète ;
- ordre personnage conservé mais sans effet gameplay actuel.

Les passifs sont dérivés de cette Team.

### Positions et suppression

- positions 1..10 protégées contre suppression ;
- positions 11+ supprimables depuis l'UI si non actives ;
- déplacement vertical libre des Teams ;
- renumérotation automatique ;
- identité interne indépendante du numéro.

La protection 1..10 dépend de la position actuelle après réorganisation.

### Composition / ordre

Deux Teams complètes ne peuvent pas contenir la même combinaison de personnages.

L'ordre personnage :
- est visuel ;
- est réorganisable horizontalement dans une Team ;
- ne change pas l'identité d'une composition.

### UX

- autosave après chaque mutation valide ;
- remplacement direct d'un personnage ;
- picker basé sur les possessions actives ;
- recherche temps réel ;
- activation séparée de l'édition ;
- sidebar = vue non éditable de la Team active en V1.

### Personnage désactivé

- Team active → retirer le personnage ;
- position 1..10 concernée → vider toute la composition ;
- position 11+ concernée → supprimer cette Team ;
- aucune restauration automatique.

### Visibilité

- Team active potentiellement publique selon confidentialité ;
- Saved Teams privées par défaut mais configurables Public/Amis/Privé ;
- Team publique consultable hors ligne ;
- état vide/incomplet visible tel quel ;
- numéro visible ;
- nom/passifs soumis aux règles de visibilité appropriées ;
- fiches personnages accessibles selon les permissions de la Box.

### Migration legacy

Legacy :
- `team` = composition active séparée ;
- `savedTeams` = presets.

Cible :
- plusieurs Teams ;
- une référence `activeTeam`.

Migration :
- créer les 10 positions de base ;
- importer les Saved Teams valides dans leurs positions historiques ;
- si l'ancienne `team` correspond à une composition importée, sélectionner cette Team comme active ;
- si la combinaison correspond mais que l'ordre diffère, conserver l'ordre de l'ancienne Team active ;
- si l'ancienne Team active non vide n'existe dans aucun preset, utiliser la première position de base vide ou créer une Team supplémentaire ;
- si l'ancienne Team active est vide, sélectionner une position vide sans écraser les presets ;
- dédupliquer conservativement les Saved Teams historiques de composition identique ;
- conserver `savedAt` valide comme métadonnée historique ;
- journaliser les anomalies/corrections ;
- rendre l'import rerunnable/idempotent.

Ne pas figer la forme SQL exacte avant Phase 2.

## 7. À auditer ensuite

Prochains blocs :
- banque ;
- coffre / inventaire ;
- options ;
- missions ;
- autres statistiques ;
- combat ;
- expédition ;
- objets spéciaux ;
- autres données joueur réparties dans les JSON.
