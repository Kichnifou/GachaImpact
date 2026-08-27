# 05 — Audit legacy : Élément / ressources / conversion / échanges

Statut : AUDIT EN COURS — R1 À R9 VALIDÉS
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

---

# 16. Stockage futur — NE PAS FIGER MAINTENANT

Dans le legacy, une même demande est dupliquée :
- entrée `sent` chez l'expéditeur ;
- entrée `received` chez le destinataire.

Ne pas reproduire automatiquement cette duplication dans la future DB.

Le modèle relationnel cible sera décidé en Phase 2.

Il devra au minimum être capable de représenter :
- demandeur ;
- destinataire ;
- quantité ;
- éléments concernés ;
- état ;
- date de création ;
- expiration ;
- réservation ;
- résolution / annulation.

La source de vérité d'une demande devra être unique.

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
- expiration automatique au reset 00:00 Europe/Paris ;
- annulation/refus possible ;
- écran UI avec reçues/envoyées ;
- notification agrégée des demandes reçues.

Audit encore en cours :
- autres usages éventuels des particules ;
- autres interactions de ressources ;
- éventuelles statistiques liées aux échanges ;
- détails restants du système legacy à confronter avant clôture du domaine.