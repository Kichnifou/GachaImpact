# 05 — Audit legacy : Élément / ressources / conversion / échanges

Statut : AUDIT EN COURS — R1 À R27 VALIDÉS — SOUS-DOMAINE ÉCHANGES FINALISÉ
Date : 2026-08-27

Sources principales :
- `legacy/streamerbot/commands/Element.txt`
- `legacy/streamerbot/commands/Convertir.txt`
- `legacy/streamerbot/commands/Echanger.txt`
- `legacy/streamerbot/commands/XP.txt`
- `legacy/streamerbot/data/viewers_data.json`

---

## 1. Périmètre

Ce domaine couvre actuellement :
- élément personnel du joueur ;
- sept types de particules élémentaires ;
- conversion des particules personnelles en Primogemmes ;
- échanges de particules entre joueurs ;
- réservations de stock liées aux échanges ;
- expiration des demandes d'échange ;
- future présentation UI de ces mécaniques.

Ne pas confondre ce domaine avec :
- les sources précises de particules provenant du Gacha, des niveaux, Events, etc. ;
- la Boutique ;
- la Banque ;
- les Missions ;
- les passifs élémentaires.

Ces interactions seront vérifiées dans leurs audits respectifs.

---

# 2. Élément joueur

## Comportement legacy confirmé

`Element.txt` :
- ne crée pas un viewer absent ;
- exige qu'un profil legacy existe déjà ;
- accepte uniquement :
  - Pyro
  - Hydro
  - Cryo
  - Electro
  - Anemo
  - Geo
  - Dendro
- normalise la casse et certaines variantes accentuées ;
- refuse un nouveau choix si `viewer.element` est déjà renseigné ;
- écrit l'élément dans `viewer["element"]` ;
- après le choix, le legacy oriente le joueur vers `!banniere`.

Commande legacy :
`!element <élément>`

## Décisions déjà validées

- choix unique ;
- non modifiable en V1 ;
- donnée métier permanente ;
- détermine l'élément personnel du joueur ;
- standalone : choix obligatoire pendant l'inscription/onboarding ;
- Twitch : `!element` reste le mécanisme naturel d'activation du profil Twitch au moment prévu par l'onboarding.

Le futur modèle technique d'identité Twitch-only / compte standalone sera défini dans la spécification Auth/Twitch.

---

# 3. Particules élémentaires

Chaque joueur peut posséder des particules des sept éléments :

- pyro
- hydro
- cryo
- electro
- anemo
- geo
- dendro

L'élément du joueur ne limite donc pas les types de particules qu'il peut posséder.

Distinction métier :

- particules correspondant à l'élément personnel :
  - convertibles en Primogemmes ;
- particules des autres éléments :
  - principalement destinées aux échanges entre joueurs dans le système actuellement audité.

Aucun autre usage des particules n'est considéré définitivement absent tant que les autres scripts n'ont pas tous été audités.

---

# 4. Conversion — comportement legacy

Source :
`Convertir.txt`

Commande :
`!convertir <montant>`

Préconditions observées :
- profil existant ;
- élément personnel déjà choisi ;
- montant entier positif ;
- stock suffisant de particules correspondant à l'élément personnel.

Taux réel :
**1 particule personnelle = 1 Primogemme**

Effets :
- retire le montant de particules personnelles ;
- ajoute exactement le même montant de Primogemmes ;
- incrémente `stats.totalPrimosEarned` du même montant ;
- peut faire progresser une mission quotidienne legacy de type `convert_particles`.

La partie Mission appartient au futur audit Missions/Daily et ne doit pas être implémentée comme responsabilité du futur service de conversion.

---

# 5. Conversion — décisions V1

## R1 — Taux — ✅ VALIDÉ

Conserver :

**1 particule de l'élément personnel = 1 Primogemme**

Pas de rééquilibrage pendant la migration initiale.

---

## R2 — Type de particules convertibles — ✅ VALIDÉ

Seules les particules correspondant à l'élément personnel du joueur sont directement convertibles en Primogemmes.

Exemple :
joueur Cryo :
- Cryo → convertible ;
- Pyro / Hydro / Electro / Anemo / Geo / Dendro → non convertibles directement.

---

## R3 — Conversion volontaire — ✅ VALIDÉ

La conversion reste manuelle / volontaire.

Elle ne doit pas se produire automatiquement simplement parce que le joueur possède des particules.

Une seule logique métier serveur doit être utilisable depuis :
- UI ;
- chat interne GachaImpact ;
- Twitch.

---

## R4 — Quantité — ✅ VALIDÉ

Toute quantité entière supérieure ou égale à 1 peut être convertie dans la limite du stock disponible.

Pas de lots obligatoires.

Direction UI appréciée :
- champ quantité ;
- raccourcis pratiques possibles comme `+10`, `+100`, `MAX` ou équivalent ;
- ces raccourcis ne modifient pas la règle métier.

---

# 6. Échanges — comportement legacy

Source :
`Echanger.txt`

Le système est un troc bilatéral de particules entre joueurs d'éléments différents.

Exemple :

- joueur A = Cryo ;
- joueur B = Pyro ;
- montant = 100.

A doit posséder 100 particules Pyro disponibles.
B doit posséder 100 particules Cryo disponibles.

À l'acceptation :
- A donne 100 Pyro et reçoit 100 Cryo ;
- B donne 100 Cryo et reçoit 100 Pyro.

Chacun récupère donc des particules correspondant à son propre élément.

Le taux entre les deux côtés est symétrique :
**X contre X**.

---

# 7. Commandes d'échange legacy

Syntaxes réelles observées :

`!echanger`
- affiche l'aide et les joueurs compatibles possédant des particules de l'élément du demandeur.

`!echanger <pseudo>`
- crée automatiquement une demande au montant maximal actuellement échangeable entre les deux joueurs.

`!echanger <pseudo> <montant>`
- crée une demande pour un montant précis.

`!echanger liste`
- affiche les demandes reçues puis envoyées.

`!echanger accepter`
- tente d'accepter toutes les demandes reçues valides.

`!echanger accepter <pseudo>`
- accepte la demande reçue du joueur indiqué.

`!echanger annuler`
- annule toutes les demandes envoyées par le joueur.

`!echanger annuler <pseudo>`
- supprime la demande existante entre les deux joueurs.

Préconditions principales :
- les deux profils existent ;
- les deux joueurs ont choisi un élément ;
- pas d'auto-échange ;
- éléments différents ;
- montant positif ;
- stocks disponibles suffisants ;
- aucune autre demande déjà active entre la même paire.

---

# 8. Réservation du stock legacy

Le legacy distingue déjà :

**stock total**
et
**stock disponible**

Formule :

`disponible = total - réservé`

Une demande en attente réserve les particules que chaque joueur devrait céder si l'échange est accepté.

Exemple :
- total Pyro : 500 ;
- 300 Pyro engagées dans une demande ;
- disponible pour de nouvelles opérations nécessitant ce stock : 200.

Cette règle empêche de promettre les mêmes particules à plusieurs personnes.

---

# 9. Acceptation et revalidation

Le legacy revalide les stocks au moment de l'acceptation.

Si un des profils ou stocks nécessaires n'est plus valide :
- la demande concernée est supprimée ;
- aucun échange partiel n'est exécuté pour cette demande.

Le futur backend devra lui aussi :
- revalider l'état réel au moment de l'acceptation ;
- exécuter le transfert de façon transactionnelle ;
- éviter double acceptation / double dépense / race condition.

---

# 10. Expiration legacy

Chaque demande stocke :

`createdAt`

Dans `XP.txt`, les demandes dont la date de création n'est plus celle du jour courant sont supprimées des deux profils.

Le legacy obtient donc fonctionnellement une expiration au changement de jour, mais le nettoyage est déclenché paresseusement par l'activité du joueur via `XP.txt`.

Cette dépendance à un message est une contrainte Streamer.bot, pas une règle à reproduire.

---

# 11. Décisions échanges V1

## R5 — Principe de troc — ✅ VALIDÉ

Conserver le système bilatéral actuel :

- chaque joueur cède des particules correspondant à l'élément personnel de l'autre ;
- chaque joueur reçoit des particules correspondant à son propre élément.

---

## R6 — Éléments différents — ✅ VALIDÉ

Deux joueurs du même élément ne peuvent pas créer ce type d'échange.

L'auto-échange reste également interdit.

---

## R7 — Quantité symétrique — ✅ VALIDÉ

Conserver un taux :

**X particules contre X particules**

Pas de marché libre avec taux arbitraires du type 100 contre 50 dans la V1.

---

## R8 — Réservation du stock — ✅ VALIDÉ

Conserver impérativement :

`stock disponible = stock total - stock réservé`

Le joueur doit pouvoir voir simplement :
- son stock total ;
- le stock actuellement réservé ;
- le stock encore réellement échangeable.

La validation et la réservation devront être garanties côté serveur.

---

## R9 — Une demande active par paire — ✅ VALIDÉ

Conserver une seule demande active entre deux mêmes joueurs à un instant donné.

Peu importe le sens :
s'il existe déjà une demande entre A et B, une deuxième demande entre ces deux profils ne peut pas être créée tant que la première existe.

---

## R10 — Réservation uniquement côté expéditeur — ✅ VALIDÉ

Le comportement cible diffère volontairement du legacy.

Lors de la création d'une demande :
- seul le stock que l'expéditeur promet de céder est réservé ;
- le stock du destinataire n'est pas réservé tant qu'il n'a pas accepté ;
- le destinataire reste donc libre d'utiliser ses particules pour d'autres opérations.

Objectif :
éviter qu'un autre joueur puisse bloquer les ressources du destinataire simplement en lui envoyant une demande.

Le stock disponible reste :

`stock disponible = stock total - réservations des demandes envoyées`

Le serveur doit garantir cette réservation côté expéditeur.

---

## R11 — Raccourci MAX — ✅ VALIDÉ

Conserver le comportement legacy :

`!echanger <pseudo>`

sans montant signifie :
créer une demande pour le maximum actuellement échangeable entre les deux joueurs.

Dans l'UI :
- proposer un bouton `MAX` ;
- cliquer sur `MAX` remplit directement le champ quantité ;
- pas besoin d'afficher en permanence une ligne séparée « maximum possible ».

---

## R12 — Accepter tout — ✅ VALIDÉ

Conserver une action permettant de traiter toutes les demandes reçues.

Chat legacy :
`!echanger accepter`

UI cible :
bouton conceptuel `Accepter tout`.

Chaque demande doit être revalidée et exécutée individuellement.

L'échec ou l'ajustement d'une demande ne doit pas empêcher les autres demandes encore réalisables d'être traitées.

L'ordre détaillé est défini dans R17.

---

## R13 — Historique serveur des échanges — ✅ VALIDÉ

Le legacy ne possède pas d'historique complet des échanges résolus.

Migration :
- ne pas inventer rétroactivement des échanges historiques qui ne sont pas présents dans les données legacy.

À partir de GachaImpact :
- conserver côté serveur les données nécessaires à l'audit des échanges ;
- demande créée ;
- acceptée ;
- refusée ;
- annulée ;
- expirée ;
- éventuellement réduite automatiquement ;
- participants ;
- éléments ;
- montant initial ;
- montant final ;
- dates pertinentes.

L'historique serveur complet n'a pas vocation à être affiché intégralement dans l'interface.

En revanche, l'écran Échanges affichera un historique récent limité :
- environ 3 transactions visibles immédiatement ;
- scroll jusqu'à environ 20–30 dernières transactions maximum.

Le reste demeure disponible côté serveur pour diagnostic, sécurité et statistiques futures.

Utilités :
- diagnostic ;
- sécurité ;
- résolution de bugs ;
- statistiques futures ;
- audit des transactions.

Idée future :
un écran de statistiques pourra présenter des statistiques personnelles et éventuellement globales du jeu, dont certaines pourront être dérivées de cet historique.

Ne pas créer inutilement des compteurs dérivés si les données transactionnelles permettent de les recalculer proprement.

---

## R14 — Découverte des partenaires réellement échangeables — ✅ VALIDÉ

Le comportement legacy de `!echanger` doit être amélioré.

Ne proposer que des joueurs avec lesquels un échange est réellement possible au moment de la consultation.

Conditions principales :
- profil valide ;
- élément choisi ;
- élément différent ;
- aucune demande active entre la paire ;
- maximum réellement échangeable supérieur à 0.

Chat :
- conserver une présentation proche du legacy ;
- afficher le montant échangeable entre parenthèses à côté du pseudo.

Exemple conceptuel :

`Bob (350) | Alice (120)`

UI :
- liste/recherche de partenaires réellement échangeables ;
- ne pas griser par défaut les joueurs impossibles ;
- les masquer ;
- des filtres/recherches pourront être proposés.

---

## R15 — Vérification du stock destinataire à la création — ✅ VALIDÉ

Même si le stock du destinataire n'est pas réservé, le serveur doit vérifier au moment de la création que le destinataire possède actuellement suffisamment de particules pour le montant demandé.

Exemple :
- demande = 500 ;
- destinataire disponible = 200 ;
- la demande de 500 ne peut pas être créée.

Cette vérification évite de créer volontairement des demandes impossibles.

Une fois la demande créée, le stock du destinataire reste libre et peut évoluer.

---

## R16 — Réduction dynamique du montant — ✅ VALIDÉ

Le montant d'une demande peut diminuer automatiquement après sa création si le stock disponible du destinataire devient insuffisant.

Exemple :
1. demande créée à 500 ;
2. l'expéditeur réserve 500 ;
3. le destinataire ne dispose ensuite plus que de 200 ;
4. la demande devient automatiquement une demande de 200 ;
5. l'expéditeur ne conserve plus que 200 réservées.

Si le maximum réalisable tombe à 0 :
- la demande est automatiquement supprimée ;
- aucune notification spécifique d'annulation n'est nécessaire ;
- la réservation restante de l'expéditeur est libérée.

Cette cohérence doit être assurée côté serveur lorsqu'une opération modifie les stocks concernés.

---

## R17 — Ordre de `Accepter tout` — ✅ VALIDÉ

`Accepter tout` traite les demandes reçues de la plus ancienne à la plus récente.

Chaque demande est traitée transactionnellement.

Après chaque échange :
- les stocks sont mis à jour ;
- les demandes restantes sont réévaluées selon R16 ;
- une demande peut donc être réduite ;
- une demande dont le montant devient 0 disparaît automatiquement ;
- le traitement continue ensuite avec les demandes encore existantes.

Une demande devenue impossible ne bloque pas arbitrairement les autres.

---

## R18 — Affichage chat des partenaires — ✅ VALIDÉ

`!echanger` sans argument ne doit plus afficher un joueur simplement parce qu'il possède des particules de l'élément du demandeur.

Il doit uniquement afficher les partenaires pour lesquels un échange réel est actuellement possible.

La quantité échangeable reste affichée entre parenthèses à côté du pseudo, dans l'esprit du rendu legacy.

---

## R19 — Notification agrégée dynamique — ✅ VALIDÉ

La notification d'échanges représente un état agrégé.

Exemple :

`3 demandes d'échange en attente`

Comportement :
- elle peut passer en état lu après consultation ;
- elle peut rester visible tant que des demandes existent ;
- le joueur peut la supprimer manuellement ;
- une petite croix de suppression apparaît au survol ;
- si une nouvelle demande arrive après suppression ou lecture, la notification réapparaît / redevient non lue ;
- elle indique alors le nombre total actuel de demandes reçues en attente.

La notification n'est pas un historique d'une demande individuelle.

---

## R20 — Une demande réduite ne remonte jamais — ✅ VALIDÉ

Si une demande a été automatiquement réduite :
- son montant courant peut encore diminuer ;
- il ne remonte jamais automatiquement vers son montant initial.

Exemple :
- initial : 500 ;
- réduit à 200 ;
- le destinataire récupère ensuite du stock ;
- la demande reste à 200.

Pour revenir à 500 :
- annuler/résoudre la demande existante ;
- créer ensuite une nouvelle demande.

Cette règle garantit un comportement prévisible et évite de tenter de réserver de nouveau des particules que l'expéditeur a pu utiliser entre-temps.

---

## R21 — Libération immédiate de la réservation — ✅ VALIDÉ

Lorsqu'une demande est réduite, la réservation côté expéditeur est immédiatement réduite du même montant.

Exemple :
- demande : 500 ;
- réservation expéditeur : 500 ;
- demande réduite à 200 ;
- nouvelle réservation : 200 ;
- 300 particules redeviennent immédiatement disponibles.

Tous les calculs de stock et toutes les nouvelles demandes doivent utiliser cette nouvelle disponibilité sans délai.

---

## R22 — Plusieurs demandes reçues peuvent viser le même stock — ✅ VALIDÉ

Puisque le stock du destinataire n'est pas réservé, plusieurs demandes reçues peuvent chacune être réalisables individuellement au moment de leur création même si elles ne peuvent pas toutes être acceptées simultanément.

Exemple :
- destinataire disponible : 500 ;
- demande A : 300 ;
- demande B : 300.

Les deux peuvent exister à 300.

Le système ne réserve pas indirectement 300 pour A puis seulement 200 pour B.

Lors d'un `Accepter tout` :
1. A, plus ancienne, est acceptée pour 300 ;
2. il reste 200 ;
3. B est réévaluée et réduite automatiquement à 200 ;
4. B peut ensuite être acceptée pour 200 ;
5. si le stock arrive à 0, les autres demandes dépendant de ce stock disparaissent conformément à R16.

La priorité temporelle intervient donc lors de l'exécution, pas comme réservation préalable du stock du destinataire.

---

## R23 — Pas d'acceptation partielle manuelle — ✅ VALIDÉ

Le destinataire accepte ou refuse le montant courant complet de la demande.

Exemple :
demande courante = 200.

Le joueur peut :
- accepter 200 ;
- refuser.

Il ne peut pas répondre manuellement :
`j'accepte seulement 75`.

Si les joueurs souhaitent négocier un autre montant :
- annuler/refuser la demande ;
- créer une nouvelle demande.

La réduction automatique R16 reste distincte d'une négociation manuelle.

---

## R24 — Résolution des échanges et historique UI — ✅ VALIDÉ

Ne pas créer de notification individuelle lorsqu'une demande est :
- acceptée ;
- refusée ;
- annulée ;
- réduite automatiquement ;
- supprimée automatiquement à montant 0 ;
- expirée au reset.

La notification dédiée aux échanges reste uniquement la notification agrégée des **demandes reçues actuellement en attente**.

Pour informer le joueur des échanges réellement effectués, l'écran Échanges doit posséder une zone d'historique récent.

Direction UI validée :
- section discrète mais clairement visible dans l'écran Échanges ;
- environ les 3 dernières transactions visibles immédiatement ;
- possibilité de scroller dans cette zone ;
- limiter l'affichage à environ 20 à 30 transactions récentes maximum ;
- ne pas charger/afficher tout l'historique serveur.

Cette vue récente est distincte de l'historique serveur complet destiné à l'audit, au diagnostic et aux statistiques futures.

---

## R25 — Refuser tout — ✅ VALIDÉ

Ajouter une action `Refuser tout` pour les demandes reçues.

UI :
- action disponible depuis l'écran Échanges ;
- supprime toutes les demandes reçues actuellement concernées ;
- libère immédiatement les réservations correspondantes chez leurs expéditeurs.

Chat :
- conserver la possibilité d'exposer la même action métier par commande ;
- la syntaxe exacte de cette future sous-commande sera figée lors de l'adaptation finale de la grammaire des commandes.

Comme pour les autres actions :
UI et chat doivent appeler la même logique métier serveur.

---

## R26 — Migration des demandes en attente — ✅ VALIDÉ

Les demandes d'échange encore en attente au moment du cutover legacy → GachaImpact **ne sont pas migrées**.

Raisons :
- une demande non acceptée n'est pas une progression définitivement acquise ;
- elle est éphémère et expire déjà quotidiennement ;
- les règles cible de réservation diffèrent du legacy ;
- les joueurs pourront recréer simplement leurs demandes dans GachaImpact.

À migrer :
- les stocks réels de particules ;
- les autres données historiques persistantes réellement disponibles.

À ne pas migrer :
- les demandes `tradeRequests` encore ouvertes ;
- les réservations temporaires associées.

Ne pas modifier les soldes de particules pour simuler l'exécution d'une demande non résolue.

---

## R27 — Identité interne des participants — ✅ VALIDÉ

Dans GachaImpact, une demande d'échange et son historique ne doivent jamais utiliser un pseudo modifiable comme identité métier.

La relation doit utiliser :
- ID interne immuable du demandeur ;
- ID interne immuable du destinataire.

Les pseudos GachaImpact / Twitch sont uniquement des informations d'affichage ou de recherche.

Le nom exact des clés/colonnes sera décidé en Phase 2.

Cette règle s'applique également :
- à l'historique serveur ;
- aux transactions réalisées ;
- aux statistiques futures liées aux échanges.

---

## Règle technique — Réconciliation après changement de stock — ✅ VALIDÉE

Toute transaction serveur susceptible de modifier un stock de particules doit réconcilier immédiatement les demandes d'échange affectées.

Après une modification de stock :
- recalculer les montants concernés ;
- appliquer R16 si une réduction est nécessaire ;
- supprimer silencieusement une demande tombée à 0 ;
- libérer immédiatement la réservation devenue inutile ;
- rendre le nouvel état visible aux autres opérations et aux clients concernés.

Il ne faut pas dépendre d'un timer de polling permanent pour maintenir cette cohérence.

Cette logique fait partie du domaine métier Ressources / Échanges et devra être exécutée transactionnellement côté serveur.

# 12. Expiration cible — ✅ VALIDÉE

Les demandes envoyées et reçues non résolues expirent au reset quotidien global du serveur :

**00:00 `Europe/Paris`**

À la différence du legacy :
- aucun message joueur n'est nécessaire pour effectuer le nettoyage ;
- le serveur est responsable de l'expiration.

La suppression doit libérer immédiatement le stock réservé.

---

# 13. Annulation / refus — ✅ VALIDÉ

L'utilisateur doit pouvoir supprimer une demande qu'il ne souhaite plus conserver.

UI cible :
- annuler une demande envoyée ;
- refuser/annuler une demande reçue ;
- la suppression retire la demande pour les deux joueurs ;
- le stock réservé est immédiatement libéré.

Le legacy permet déjà de supprimer une demande entre deux joueurs via la commande ciblée.

---

# 14. UI cible des échanges — ✅ DIRECTION VALIDÉE

Créer plus tard un écran / espace dédié aux échanges.

Il doit permettre de voir clairement :

### Demandes reçues
- joueur demandeur ;
- éléments échangés ;
- quantité ;
- actions accepter / refuser.

### Demandes envoyées
- destinataire ;
- éléments échangés ;
- quantité ;
- action annuler.

Le joueur doit pouvoir traiter plusieurs demandes reçues depuis cet écran.

Actions prévues :
- accepter une demande ;
- refuser une demande ;
- `Accepter tout` ;
- `Refuser tout` ;
- annuler une demande envoyée ;
- créer une demande avec quantité libre ;
- raccourci `MAX` remplissant le champ quantité.

Découverte des partenaires :
- afficher/rechercher uniquement les partenaires réellement échangeables par défaut ;
- un partenaire dont le maximum échangeable est 0 n'est pas affiché dans la liste normale ;
- filtres/recherche pourront compléter cette vue.

Stocks :
- rendre lisibles le total, le réservé côté expéditeur et le réellement disponible lorsque pertinent ;
- toute réduction automatique d'une demande doit être reflétée dynamiquement dans l'interface.

Historique récent :
- petite section dédiée aux dernières transactions réalisées ;
- environ 3 entrées visibles sans scroll ;
- scroll interne pour consulter environ 20 à 30 dernières transactions maximum ;
- ne pas exposer tout l'historique serveur.

La présentation exacte reste à concevoir avec Codex lors de l'implémentation UI.

---

# 15. Notification des échanges — ✅ DIRECTION VALIDÉE

Lorsqu'un joueur possède une ou plusieurs demandes reçues en attente :

- ne pas créer une notification différente pour chaque demande ;
- afficher une notification agrégée indiquant qu'il existe des demandes en attente et leur nombre ;
- cliquer sur cette notification doit mener vers l'écran d'échange ;
- le contenu de cet écran constitue la source détaillée des demandes.

Exemple conceptuel :

`3 demandes d'échange en attente`

La notification doit évoluer lorsque le nombre de demandes change.

Comportement validé :
- ouverture/consultation peut marquer la notification comme lue ;
- une notification lue peut rester visible tant que l'état correspondant existe ;
- toutes les notifications de l'application doivent pouvoir être supprimées manuellement via une petite croix affichée au survol ;
- si la notification agrégée d'échanges est supprimée mais qu'une nouvelle demande est reçue ensuite, elle est recréée/réaffichée en non-lue avec le nombre total courant ;
- les demandes elles-mêmes expirant au reset, la notification agrégée disparaît également lorsque plus aucune demande n'existe.

---

# 16. Stockage futur — NE PAS FIGER MAINTENANT

Dans le legacy, une même demande est dupliquée :
- entrée `sent` chez l'expéditeur ;
- entrée `received` chez le destinataire.

Ne pas reproduire automatiquement cette duplication dans la future DB.

Le modèle relationnel cible sera décidé en Phase 2.

Il devra au minimum être capable de représenter conceptuellement :
- ID interne immuable du demandeur ;
- ID interne immuable du destinataire ;
- élément fourni par chaque côté ;
- montant initial demandé ;
- montant courant après éventuelles réductions automatiques ;
- montant finalement échangé ;
- état ;
- date de création ;
- expiration ;
- réservation côté expéditeur ;
- résolution / acceptation / refus / annulation.

Le choix exact des colonnes/tables reste réservé à la Phase 2.

La source de vérité d'une demande devra être unique.

À partir de GachaImpact, conserver également un historique serveur suffisant des changements importants :
- création ;
- réduction automatique si utile à l'audit ;
- acceptation ;
- refus ;
- annulation ;
- expiration.

Cet historique complet est destiné à l'intégrité, au diagnostic et aux statistiques futures.

L'UI V1 n'en expose qu'une fenêtre récente limitée, d'environ 20 à 30 transactions maximum dans l'écran Échanges.

---

# 17. Interactions à auditer plus tard

### Missions / Daily
`Convertir.txt` fait progresser `convert_particles`.

À reporter vers :
- Missions / Daily.

### XP
L'expiration legacy des échanges est actuellement déclenchée depuis `XP.txt`.

Décision :
- retirer cette responsabilité du futur système XP ;
- expiration serveur automatique.

### Notifications
L'UI actuelle possède déjà un système de notifications prototype.
Les demandes d'échange devront plus tard s'y intégrer avec la notification agrégée validée.

---

# 18. État des décisions

Validé :
- R1 : conversion 1:1 ;
- R2 : seulement particules personnelles convertibles ;
- R3 : conversion manuelle ;
- R4 : quantité entière libre >= 1 ;
- R5 : troc élémentaire bilatéral conservé ;
- R6 : éléments différents obligatoires ;
- R7 : échange symétrique X contre X ;
- R8 : réservation de stock ;
- R9 : une demande active par paire ;
- R10 : seul le stock de l'expéditeur est réservé ;
- R11 : raccourci MAX conservé ;
- R12 : Accepter tout conservé ;
- R13 : historique serveur futur des échanges ;
- R14 : ne proposer que les partenaires réellement échangeables ;
- R15 : stock du destinataire vérifié à la création ;
- R16 : réduction automatique d'une demande si le stock destinataire baisse, suppression silencieuse à 0 ;
- R17 : Accepter tout traite de la plus ancienne à la plus récente ;
- R18 : montant échangeable affiché entre parenthèses dans `!echanger` ;
- R19 : notification agrégée dynamique ;
- R20 : une demande réduite ne peut jamais remonter automatiquement ;
- R21 : réservation expéditeur libérée immédiatement lors d'une réduction ;
- R22 : plusieurs demandes reçues peuvent viser le même stock non réservé ;
- R23 : aucune acceptation partielle manuelle ;
- R24 : pas de notifications individuelles de résolution ; historique récent directement dans l'écran Échanges ;
- R25 : action Refuser tout ;
- R26 : ne pas migrer les demandes legacy encore en attente ;
- R27 : participants identifiés par IDs internes immuables, jamais par pseudo comme clé métier ;
- réconciliation immédiate des demandes après toute transaction modifiant un stock concerné ;
- expiration automatique au reset 00:00 Europe/Paris ;
- annulation/refus possible ;
- écran UI avec reçues/envoyées ;
- notification agrégée des demandes reçues.

Audit encore en cours :
- sous-domaine `Echanger.txt` : finalisé ;
- vérifier les autres usages éventuels des particules dans les autres scripts ;
- vérifier les autres interactions de ressources avant clôture du domaine.

Idée future documentée :
- écran de statistiques joueur / statistiques globales du jeu ;
- l'historique serveur des échanges pourra alimenter certaines de ces statistiques ;
- l'écran Échanges possède un historique récent limité ; l'écran de statistiques futur pourra exploiter l'historique serveur plus largement.