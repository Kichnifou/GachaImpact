# 17 — Audit Roue / quotidien

> Domaine 14 de l'audit GachaImpact.  
> Statut : **CLÔTURÉ — décisions produit R645 à R656 validées**.  
> Ce document est la source spécialisée validée du domaine Roue / quotidien.  
> L'état global du projet et la prochaine reprise exacte restent la responsabilité du Master.

---

# 1. Objectif du domaine

Auditer puis spécifier la Roue quotidienne et sa place dans le suivi transversal `Quotidiennes`.

Le domaine couvre notamment :

- la commande `!roue` ;
- la limitation à une utilisation par journée ;
- les probabilités et récompenses réelles ;
- les statistiques Roue ;
- l'intégration économique ;
- la cohérence avec `totalMainElementParticlesEarned` ;
- la présentation standalone de la Roue ;
- le résultat et l'état quotidien ;
- l'intégration au hub `Quotidiennes` ;
- `!quotis` uniquement pour la partie qui dépend encore de l'état Roue ;
- la migration des données Roue ;
- l'atomicité / idempotence ;
- les interfaces UI / chat interne / Twitch futur.

Le domaine ne doit pas rouvrir les décisions déjà prises sur :

- le hub transversal `Quotidiennes` ;
- la commande dynamique `!quotis` ;
- Combat ;
- Expedition ;
- Ami / Social ;
- Event ;
- Missions ;
- les règles générales de ressources.

---

# 2. Sources réelles inspectées

Sources principales :

- `legacy/streamerbot/commands/Roue.txt`
- `legacy/streamerbot/commands/Daily.txt`
- `legacy/streamerbot/data/viewers_data.json`
- `docs/legacy/05-element-resources-audit.md`
- `docs/legacy/11-missions-daily-audit.md`
- `docs/legacy/12-expedition-audit.md`
- `docs/commands/command-reference.md`
- `docs/specifications/decisions-log.md`

Règle de lecture :

- le commentaire d'en-tête de `Roue.txt` n'est pas considéré fiable lorsqu'il contredit le code ;
- le code réellement exécuté est la preuve du comportement actuel ;
- les règles transverses déjà validées dans les audits précédents restent autoritatives.

---

# 3. Conclusion structurelle initiale

La Roue est une mécanique simple et isolée :

- une action quotidienne ;
- un tirage aléatoire ;
- une récompense immédiate ;
- quelques compteurs historiques ;
- aucune progression complexe propre ;
- aucune donnée JSON séparée.

Le legacy persiste tout dans le profil joueur de `viewers_data.json`.

La V1 ne doit pas créer un moteur lourd spécifique.

La cible logique est un service Roue léger, serveur-authoritaire, appelé depuis :

- l'écran Roue ;
- `!roue` dans le chat interne ;
- `!roue` via Twitch futur.

Le hub `Quotidiennes` reste seulement consommateur de l'état `à faire / fait aujourd'hui`.

---

# 4. Commande actuelle

Syntaxe réelle :

`!roue`

Aucun argument ou sous-commande n'est utilisé.

Préconditions :

- `userName` disponible ;
- fichier joueurs lisible ;
- profil existant.

Si le profil n'existe pas :

- aucune création automatique ;
- message d'avertissement.

---

# 5. Verrou quotidien réel

Le legacy utilise :

`dates.lastWheelDate`

Format observé :

`yyyy-MM-dd`

Au lancement :

1. le script calcule la date locale courante ;
2. si `lastWheelDate == today`, la Roue est refusée ;
3. sinon `lastWheelDate` est immédiatement positionné à la date du jour ;
4. `stats.totalWheelSpins` augmente de 1 ;
5. le résultat est tiré ;
6. la récompense est appliquée ;
7. `viewers_data.json` est sauvegardé.

Le système représente donc fonctionnellement :

**une Roue maximum par joueur et par jour.**

Défaut d'architecture legacy :

- la journée dépend de `DateTime.Now` local ;
- il n'existe pas de scheduler ou reset serveur central ;
- le verrou repose uniquement sur une date stockée.

Direction déjà acquise pour la cible :

- journée métier en `Europe/Paris` ;
- état calculé côté serveur ;
- une seule utilisation tous canaux confondus.

---

# 6. Probabilités : le commentaire d'en-tête est faux

Le commentaire d'en-tête annonce :

- 10/50 : rien ;
- 5/50 pour chacun des 7 éléments ;
- 4/50 : +20 000 Moras ;
- 1/50 : +1 600 Primogemmes.

Ce tableau n'est **pas** ce que le code exécute réellement.

Il ne doit pas être utilisé comme source de vérité sans décision produit explicite.

---

# 7. Table réellement exécutée par le code

`RollReward()` tire :

`random.Next(1, 51)`

soit 50 valeurs équiprobables.

| Roll | Résultat | Chances | Probabilité |
|---:|---|---:|---:|
| 1 | Rien | 1/50 | 2 % |
| 2–6 | +500 Cryo | 5/50 | 10 % |
| 7–11 | +500 Pyro | 5/50 | 10 % |
| 12–16 | +500 Dendro | 5/50 | 10 % |
| 17–21 | +500 Electro | 5/50 | 10 % |
| 22–26 | +500 Geo | 5/50 | 10 % |
| 27–31 | +500 Anemo | 5/50 | 10 % |
| 32–36 | +500 Hydro | 5/50 | 10 % |
| 37–46 | +50 000 Moras | 10/50 | 20 % |
| 47–50 | +1 600 Primogemmes | 4/50 | 8 % |

Répartition agrégée réellement exécutée :

- rien : **2 %** ;
- particules : **70 %** ;
- Moras : **20 %** ;
- Primogemmes : **8 %**.

---

# 8. Valeur moyenne du tirage actuel

À partir du code réellement exécuté :

## Primogemmes

8 % × 1 600 :

**128 Primogemmes attendues par Roue**

## Moras

20 % × 50 000 :

**10 000 Moras attendus par Roue**

## Particules

Chaque élément :

10 % × 500 = 50 particules moyennes.

Sur sept éléments :

**350 particules totales attendues par Roue**

Ces valeurs sont seulement des outils d'équilibrage.

Elles ne constituent pas encore une décision de conservation pour la V1.

---

# 9. Incohérence Moras confirmée

Le code réellement exécuté applique :

**+50 000 Moras**

mais `BuildRewardMessage()` annonce :

**+20 000 Moras**

Conséquence :

- le solde réel gagne 50 000 ;
- `totalMorasEarned` gagne 50 000 ;
- le joueur reçoit néanmoins un message indiquant +20 000.

Cette divergence avait déjà été repérée pendant l'audit Ressources.

Elle ne doit pas être reproduite en V1.

La valeur cible 20 000 ou 50 000 doit être décidée pendant le présent audit.

---

# 10. Incohérence des probabilités confirmée

Le commentaire de tête décrit une Roue beaucoup moins généreuse que le vrai code.

Comparaison principale :

| Récompense | Commentaire | Code réel |
|---|---:|---:|
| Rien | 20 % | 2 % |
| Particules | 70 % | 70 % |
| Moras | 8 % | 20 % |
| Primogemmes | 2 % | 8 % |

Le total Particules reste identique, mais le vrai code a déplacé une grande partie des chances de `rien` vers Moras et Primogemmes.

Aucune hypothèse n'est faite ici sur l'intention historique.

Le propriétaire du projet décidera quelle distribution devient la règle V1.

---

# 11. Récompenses Particules

Chaque résultat élémentaire donne :

**+500 particules de l'élément tiré**

Les sept éléments ont actuellement la même probabilité :

**10 % chacun.**

Le résultat ne dépend pas de l'élément personnel du joueur.

Exemple joueur Cryo :

- la Roue peut donner Cryo ;
- mais aussi Pyro, Hydro, Electro, Anemo, Geo ou Dendro.

Cela s'intègre aux règles existantes :

- particules personnelles → convertibles ;
- autres particules → échangeables selon les règles du Domaine Ressources.

---

# 12. Bug historique de `totalMainElementParticlesEarned`

`Roue.txt` ajoute les particules au stock mais ne met pas à jour :

`stats.totalMainElementParticlesEarned`

lorsque l'élément tiré correspond à l'élément personnel du joueur.

Cette incohérence est déjà documentée par le Domaine Ressources.

Règle transverse déjà validée :

`totalMainElementParticlesEarned` doit compter toute particule de l'élément personnel **générée comme récompense par le jeu**.

Donc en cible :

- joueur Cryo ;
- Roue → +500 Cryo ;
- `totalMainElementParticlesEarned` doit aussi augmenter de 500.

Ce correctif est technique et ne nécessite pas une nouvelle décision Rxxx.

Migration :

- ne pas essayer de reconstruire rétroactivement les gains Roue historiques manquants ;
- migrer le compteur legacy tel quel ;
- être cohérent pour tous les nouveaux gains standalone.

---

# 13. Récompense Moras

Le vrai crédit actuel est :

**+50 000 Moras**

Effets réels :

- `viewer.moras += 50000`
- `stats.totalMorasEarned += 50000`

Le message utilisateur annonce à tort +20 000.

Aucun débit Banque n'est impliqué.

La Roue génère de nouvelles Moras ; ce n'est pas un transfert interne.

---

# 14. Jackpot Primogemmes

Le résultat Primogemmes donne :

**+1 600 Primogemmes**

Effets :

- `viewer.primogems += 1600`
- `stats.totalPrimosEarned += 1600`
- `stats.totalWheelJackpots += 1`

Dans le code réel actuel, ce résultat arrive sur 4 valeurs parmi 50 :

**8 %**

et non 1/50 comme le prétend le commentaire.

`totalWheelJackpots` désigne donc concrètement le nombre de résultats Primogemmes de la Roue.

---

# 15. Statistiques Roue

Champs observés :

- `stats.totalWheelSpins`
- `stats.totalWheelJackpots`

`totalWheelSpins` :

- augmente de 1 pour chaque lancement valide ;
- augmente même si le résultat est `rien`.

`totalWheelJackpots` :

- augmente uniquement sur la récompense +1 600 Primogemmes.

Recherche repository :

- aucun autre consommateur métier direct de ces deux compteurs n'a été identifié hors `Roue.txt` ;
- aucune Mission actuelle ne dépend directement du nombre de Roues ou jackpots.

Ces compteurs restent néanmoins des données historiques réelles à préserver.

---

# 16. Exemples de données réelles

Le snapshot `viewers_data.json` confirme que la mécanique est réellement utilisée.

Exemple du profil de référence `kichnifou` dans le snapshot inspecté :

- `lastWheelDate = 2026-08-26`
- `totalWheelSpins = 99`
- `totalWheelJackpots = 11`

D'autres joueurs possèdent également des valeurs de Roue différentes, ce qui confirme que ces champs ne sont pas de simples defaults inutilisés.

La distribution historique de ces compteurs ne permet pas de reconstruire les résultats précis de chaque jour.

---

# 17. Aucun historique détaillé legacy

Le legacy ne stocke pas :

- la date de chaque spin historique ;
- le résultat de chaque ancienne Roue ;
- la récompense exacte de chaque ancienne Roue ;
- une liste d'historique consultable.

On connaît seulement :

- la dernière date ;
- le total de spins ;
- le total de jackpots ;
- les soldes/statistiques économiques globaux.

Il ne faudra donc pas inventer un historique rétroactif lors de la migration.

---

# 18. `!quotis` legacy

`Daily.txt` ne lit aucune donnée joueur.

Il envoie simplement une chaîne statique listant :

- Roue ;
- Combat ;
- Expedition ;
- Ami cœur ;
- Event ;
- Shop mission.

Il ne sait donc pas si la Roue est :

- encore disponible ;
- déjà utilisée.

---

# 19. `!quotis` cible déjà décidée

Le Domaine Missions/Daily a déjà validé :

- conserver `!quotis` dans le chat interne ;
- conserver `!quotis` sur Twitch ;
- supprimer la chaîne statique ;
- interroger les vrais états serveur ;
- produire un résumé compact dynamique.

R355 a également déjà fixé :

- un écran transversal séparé `Quotidiennes` ;
- `!quotis` = équivalent texte compact ;
- chaque activité reste la propriété de son domaine réel.

Il n'y a donc pas à redécider l'existence de `!quotis`.

Le présent audit doit seulement finaliser **l'état Roue** fourni à ce hub.

---

# 20. Direction UI déjà acquise

Les audits précédents ont déjà décidé que :

- la Roue possède son véritable écran dédié ;
- le hub `Quotidiennes` possède une carte Roue ;
- cette carte possède un bouton `Accéder` vers l'écran Roue ;
- le hub ne duplique pas le tirage lui-même.

Le présent domaine devra spécifier l'UX exacte de l'écran Roue :

- représentation de la roue ;
- probabilités visibles ou non ;
- état avant/après spin ;
- résultat du jour ;
- animation ;
- éventuelles statistiques visibles.

---

# 21. État quotidien cible évident

Sans consommer de Rxxx, la Roue expose au hub :

## Avant utilisation

`À faire`

## Après utilisation

`Fait aujourd'hui`

Le reset quotidien serveur réouvre la Roue à :

**00:00 Europe/Paris**

Il n'existe pas d'état `En cours` ou `À récupérer` pour cette mécanique.

La récompense est attribuée dans l'opération de spin elle-même.

---

# 22. Architecture cible initiale

Une seule opération métier serveur doit gérer un spin.

Exemple conceptuel :

`SpinWheel(playerId, businessDate)`

Elle doit :

1. valider le joueur ;
2. valider que la Roue n'a pas déjà été utilisée pour cette journée ;
3. tirer le résultat côté serveur ;
4. enregistrer l'utilisation quotidienne ;
5. appliquer la récompense via les services économiques centraux ;
6. maintenir les statistiques concernées ;
7. journaliser la mutation ;
8. retourner le résultat au canal appelant.

Le navigateur ne choisit jamais :

- le roll ;
- le type de récompense ;
- le montant ;
- la validité quotidienne.

UI, chat et Twitch appellent la même logique.

---

# 23. Atomicité / concurrence

La cible doit empêcher :

- double clic UI ;
- `!roue` chat + clic UI simultanés ;
- UI + Twitch simultanés ;
- retry réseau ;
- deux instances serveur concurrentes.

La journée + joueur constitue conceptuellement une unicité de spin.

La consommation du spin et la récompense doivent être une même opération transactionnelle logique.

Un joueur ne doit jamais pouvoir :

- consommer deux spins ;
- recevoir deux récompenses ;
- consommer le spin sans recevoir la récompense validée.

---

# 24. Animation UI et persistance

L'animation graphique éventuelle est purement une restitution.

Le résultat doit être déterminé et persisté côté serveur **avant** que l'animation client ne soit considérée comme source du résultat.

Un crash ou une fermeture d'onglet pendant l'animation :

- ne reroll jamais ;
- ne redonne pas un spin ;
- ne change pas la récompense déjà validée.

La V1 pourra conserver le résultat de la journée ou un journal transactionnel suffisant pour restituer l'état après reconnexion.

Le choix exact de présentation reste à décider.

---

# 25. Migration initiale

À préserver :

- `dates.lastWheelDate`
- `stats.totalWheelSpins`
- `stats.totalWheelJackpots`

Règles :

- compteurs importés tels quels ;
- aucune reconstruction de spins historiques absents ;
- aucun jackpot historique inventé ;
- aucun correctif rétroactif du compteur `totalMainElementParticlesEarned`.

Concernant `lastWheelDate` :

- si la date correspond à la journée serveur du cutover, le spin du jour reste consommé ;
- si elle est antérieure, la Roue est disponible normalement ;
- une date future ou invalide doit être signalée comme anomalie de migration et ne doit pas accorder arbitrairement plusieurs récompenses.

Aucune récompense n'est déclenchée pendant l'import.

---

# 26. Décisions produit validées

## R645 — Une Roue par jour — ✅ VALIDÉ A

La Roue reste utilisable :

**une seule fois par joueur et par journée serveur.**

Le reset quotidien utilise :

`00:00 Europe/Paris`

Cette utilisation est commune à tous les canaux :

- UI standalone ;
- chat interne ;
- Twitch futur.

Alterner les canaux ne permet jamais d'obtenir plusieurs spins.

---

## R646 — Distribution réelle du code conservée — ✅ VALIDÉ A

La V1 conserve la distribution réellement exécutée par le legacy, et non celle indiquée dans l'ancien commentaire erroné.

Répartition cible :

| Résultat | Probabilité |
|---|---:|
| Rien | 2 % |
| +500 Cryo | 10 % |
| +500 Pyro | 10 % |
| +500 Dendro | 10 % |
| +500 Electro | 10 % |
| +500 Geo | 10 % |
| +500 Anemo | 10 % |
| +500 Hydro | 10 % |
| +50 000 Moras | 20 % |
| +1 600 Primogemmes | 8 % |

Répartition agrégée :

- rien : 2 % ;
- particules : 70 % ;
- Moras : 20 % ;
- Primogemmes : 8 %.

Le commentaire historique annonçant 20 % de `rien` et seulement 2 % de Primogemmes ne définit pas la cible.

---

## R647 — Récompense Moras — ✅ VALIDÉ A

La récompense Moras devient officiellement :

**+50 000 Moras**

Il s'agit de la valeur réellement créditée par le code legacy.

L'ancien texte annonçant +20 000 était erroné et doit disparaître.

Le gain met normalement à jour les statistiques économiques centrales correspondantes.

---

## R648 — Récompense Particules — ✅ VALIDÉ A

Chaque résultat élémentaire donne :

**+500 particules de l'élément tiré**

Les sept éléments restent équiprobables :

**10 % chacun.**

L'élément personnel du joueur n'influence pas le tirage.

Si l'élément tiré correspond à son élément personnel, les règles Ressources déjà validées s'appliquent également à `totalMainElementParticlesEarned`.

---

## R649 — Jackpot Primogemmes — ✅ VALIDÉ A

Le jackpot reste :

**+1 600 Primogemmes**

Probabilité :

**8 %**

Le résultat incrémente également :

`totalWheelJackpots`

Le terme `jackpot` désigne donc ce résultat Primogemmes.

---

## R650 — Vraie roue graphique animée — ✅ VALIDÉ A

L'écran Roue standalone présente une vraie roue circulaire animée.

Les différentes zones représentent les résultats possibles.

Leur taille doit refléter de manière cohérente les probabilités réelles.

Le déroulement cible est :

1. le joueur demande à tourner ;
2. le serveur valide et détermine le résultat ;
3. le résultat est persisté ;
4. l'animation démarre ;
5. la roue s'arrête visuellement sur le résultat déjà déterminé ;
6. le gain est affiché.

La position visuelle du client ne décide jamais du résultat métier.

---

## R651 — Probabilités consultables — ✅ VALIDÉ A

Les probabilités exactes sont consultables depuis l'écran Roue.

Une action du type :

`Probabilités`

peut ouvrir un détail clair de la table.

L'interface n'a pas besoin d'afficher un pourcentage sur chaque portion en permanence si cela surcharge visuellement la Roue.

Les probabilités affichées doivent provenir de la même configuration autoritative que celle utilisée par le serveur pour les tirages.

Il ne doit jamais exister une table UI différente de la table métier réelle.

---

## R652 — Résultat du jour conservé dans l'écran — ✅ VALIDÉ A

Après utilisation de la Roue :

- la Roue devient indisponible jusqu'au prochain reset ;
- le résultat du jour reste visible ;
- le gain obtenu reste visible ;
- l'écran indique clairement `Déjà tournée aujourd'hui` ;
- un compte à rebours jusqu'au reset suivant peut être affiché.

Exemple conceptuel :

`🎡 Résultat du jour : +50 000 Moras`

`Prochaine Roue dans 06:42:18`

Une reconnexion pendant la même journée retrouve ce résultat.

---

## R653 — Statistiques personnelles visibles — ✅ VALIDÉ A

L'écran Roue affiche discrètement les statistiques historiques déjà réellement disponibles :

- nombre total de spins ;
- nombre total de jackpots.

Exemple :

`Tours effectués : 99`

`Jackpots : 11`

La V1 n'invente pas de nouveaux compteurs historiques par type de récompense uniquement pour enrichir cet écran.

---

## R654 — `!roue` après utilisation rappelle le résultat — ✅ VALIDÉ A

Si le joueur utilise `!roue` alors que son spin du jour est déjà consommé :

- aucune nouvelle récompense ;
- aucun nouveau tirage ;
- la réponse rappelle que la Roue est déjà utilisée ;
- si le résultat quotidien est disponible, elle rappelle également ce résultat.

Exemple :

`⚠️ Roue déjà utilisée aujourd'hui — résultat : +500 particules Hydro.`

La réponse peut également indiquer que la prochaine Roue sera disponible le lendemain.

---

## R655 — Gain du jour dans le hub Quotidiennes — ✅ VALIDÉ A

La carte Roue du hub transversal `Quotidiennes` conserve ses deux états principaux :

- `À faire` ;
- `Fait aujourd'hui`.

Après utilisation, elle affiche également le gain du jour lorsque celui-ci est disponible.

Exemple :

`🎡 Roue`

`✅ Fait aujourd'hui`

`+1 600 Primogemmes`

La carte reste un résumé.

L'action `Accéder` continue d'ouvrir le véritable écran Roue.

---

## R656 — Animation courte et skippable — ✅ VALIDÉ A

L'animation de la Roue doit rester assez courte pour une activité quotidienne.

Elle peut durer quelques secondes afin de conserver un effet de suspense.

Le joueur peut la passer pour afficher immédiatement le résultat.

Passer l'animation :

- ne change pas le résultat ;
- ne produit pas un second appel métier ;
- ne modifie pas la récompense.

Fermer ou recharger l'écran pendant l'animation ne reroll jamais.

---

# 27. Décisions techniques acquises

- Heure métier : `Europe/Paris`.
- Une utilisation maximum par joueur et par journée serveur.
- L'unicité logique est portée par joueur + journée métier.
- L'état Roue est commun à UI, chat interne et Twitch.
- `!quotis` reste dynamique et l'écran `Quotidiennes` reste un agrégateur.
- La carte Roue du hub possède les états `À faire` / `Fait aujourd'hui` et peut restituer le gain du jour.
- Le résultat est tiré exclusivement côté serveur.
- Les probabilités métier utilisent une configuration serveur unique réutilisable également pour la présentation UI.
- Le résultat du jour contient suffisamment d'informations pour restituer au minimum le type de récompense, l'élément éventuel, le montant et la journée concernée.
- Le résultat est persisté avant que l'animation client ne constitue une restitution.
- Spin + consommation quotidienne + récompense + statistiques forment une opération transactionnelle logique.
- Un retry, double clic ou appel concurrent ne peut jamais produire un second résultat ni une seconde récompense.
- Passer l'animation est une action client sans nouvel effet économique.
- Une récompense de particules correspondant à l'élément personnel met à jour `totalMainElementParticlesEarned`.
- +50 000 Moras met à jour les statistiques de Moras générées selon les règles économiques centrales.
- +1 600 Primogemmes met à jour les statistiques de Primogemmes générées et `totalWheelJackpots`.
- `totalWheelSpins` augmente exactement une fois pour un spin validé, y compris lorsque le résultat est `rien`.
- Le message utilisateur et la valeur réellement créditée sont toujours dérivés du même résultat autoritatif.
- Le compte à rebours UI est dérivé du prochain reset serveur ; il n'est pas une source de vérité pour l'éligibilité.

---

# 28. Migration Roue

Migrer :

- `dates.lastWheelDate` ;
- `stats.totalWheelSpins` ;
- `stats.totalWheelJackpots`.

Les compteurs historiques sont conservés tels quels.

Ne pas tenter de reconstruire :

- les dates de tous les anciens spins ;
- les récompenses de tous les anciens spins ;
- le nombre historique de chaque type de récompense ;
- les particules personnelles anciennes qui auraient dû augmenter `totalMainElementParticlesEarned`.

Si `lastWheelDate` correspond à la journée serveur du cutover :

- considérer le spin du jour comme déjà consommé ;
- ne jamais offrir un nouveau spin pour compenser l'absence de détail historique.

Le legacy ne permettant pas de connaître le résultat exact de ce spin, l'UI peut exceptionnellement afficher :

`✅ Roue déjà effectuée aujourd'hui — ancien résultat non disponible`

jusqu'au reset suivant.

Dès le premier spin réalisé dans GachaImpact, le résultat quotidien complet devient disponible pour R652/R654/R655.

Une date legacy invalide ou future est journalisée comme anomalie de migration et traitée conservativement.

Aucune récompense n'est déclenchée par l'import lui-même.

La migration doit être idempotente.

---

# 29. Producteurs / consommateurs cibles

## Roue

Produit :

- utilisation quotidienne ;
- résultat quotidien ;
- récompense ;
- `totalWheelSpins` ;
- `totalWheelJackpots`.

## Économie / Ressources

Reçoit :

- +50 000 Moras ;
- +1 600 Primogemmes ;
- +500 particules élémentaires.

Les statistiques économiques centrales sont maintenues par les mutations de ressources correspondantes.

## Quotidiennes

Consomme :

- Roue disponible ou effectuée ;
- gain du jour lorsqu'il existe.

Le hub ne produit jamais le spin.

## UI / chat interne / Twitch

Appellent tous la même opération serveur.

---

# 30. Contrat cible `!roue`

Commande canonique :

`!roue`

Aucun argument nécessaire.

### Si disponible

La commande :

- valide le spin ;
- tire côté serveur ;
- applique immédiatement la récompense ;
- retourne le résultat.

### Si déjà utilisée

La commande :

- ne relance pas la Roue ;
- rappelle que le spin est consommé ;
- rappelle le résultat du jour lorsqu'il est disponible.

### UI

L'écran Roue possède :

- roue graphique ;
- bouton `Tourner` ;
- accès aux probabilités ;
- résultat quotidien ;
- compte à rebours ;
- total de spins ;
- total de jackpots.

### Twitch / chat interne

La réponse reste compacte.

Aucune animation n'est nécessaire côté texte.

---

# 31. Critères d'acceptation

Le Domaine Roue / quotidien est considéré prêt pour une future implémentation V1 si les tests peuvent prouver notamment que :

1. un joueur ne peut obtenir qu'un seul spin par journée `Europe/Paris` ;
2. UI, chat et Twitch partagent exactement le même verrou ;
3. le serveur utilise bien la distribution 2 % / 70 % / 20 % / 8 % validée ;
4. chacun des sept éléments possède 10 % ;
5. la récompense élémentaire vaut exactement 500 particules ;
6. la récompense Moras vaut exactement 50 000 ;
7. le jackpot vaut exactement 1 600 Primogemmes ;
8. `rien` reste un résultat valide à 2 % ;
9. les probabilités affichées utilisent la même configuration que le tirage serveur ;
10. un double clic ne produit pas deux récompenses ;
11. deux appels simultanés provenant de canaux différents ne produisent pas deux récompenses ;
12. un retry réseau ne reroll pas ;
13. fermer l'écran pendant l'animation ne reroll pas ;
14. passer l'animation ne produit aucun nouvel effet métier ;
15. le résultat du jour est retrouvable après reconnexion ;
16. `!roue` après utilisation rappelle le résultat sans payer à nouveau ;
17. la carte Quotidiennes affiche correctement `À faire` ou `Fait aujourd'hui` ;
18. le gain du jour est affiché dans cette carte lorsqu'il est connu ;
19. `totalWheelSpins` augmente exactement une fois par spin valide ;
20. `totalWheelJackpots` augmente uniquement sur +1 600 Primogemmes ;
21. les gains Moras/Primogemmes maintiennent leurs statistiques économiques ;
22. une récompense de l'élément personnel maintient `totalMainElementParticlesEarned` ;
23. la migration conserve les compteurs historiques sans inventer les anciens résultats ;
24. un spin legacy déjà effectué le jour du cutover reste consommé ;
25. l'import ne distribue aucune récompense.

---

# 32. Conclusion du domaine

**Domaine Roue / quotidien : CLÔTURÉ après R656.**

Le comportement produit, l'économie, les probabilités, l'UX standalone, le contrat `!roue`, l'intégration au hub Quotidiennes, la migration et les garanties de concurrence sont suffisamment définis pour une future implémentation V1 bornée.

Le domaine ne doit être rouvert que si :

- le sweep final révèle une dépendance oubliée ;
- un audit restant introduit une vraie interaction nouvelle ;
- une décision produit est explicitement révisée.

---

# 33. Sweep final obligatoire du projet

Même après clôture de Roue / quotidien et des audits restants, le projet devra toujours effectuer le sweep exhaustif final des 36 scripts `.txt` et 17 JSON avant la conception finale du modèle de données et le passage à la V1.
