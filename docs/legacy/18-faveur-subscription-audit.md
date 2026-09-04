# 18 — Audit Faveur / Subscription

> Domaine 15 de l'audit GachaImpact.  
> Statut : **CLÔTURÉ — décisions produit R657 à R672 validées ; clôture technique finalisée**.  
> Ce document est la source spécialisée validée du domaine Faveur / Subscription.  
> L'état global du projet et la prochaine reprise exacte restent la responsabilité du Master.

---

# 1. Objectif du domaine

Auditer puis spécifier la **Faveur de l'Astre**, mécanique inspirée dans son principe de la Bénédiction de la Lune de Genshin, mais adaptée à GachaImpact.

Le domaine couvre notamment :

- la commande `!faveur` ;
- l'action legacy `Subscription.txt` ;
- les déclencheurs Twitch Subscription / Resubscription / Gift Subscription ;
- le bénéficiaire d'une Faveur ;
- l'éventuel bonus du gifter ;
- la durée accordée ;
- le plafond de 180 jours ;
- les Primogemmes immédiates ;
- les Primogemmes quotidiennes ;
- le comportement en cas de dépassement du plafond ;
- le décompte des jours ;
- la dépendance historique à `XP.txt` ;
- la future intégration Twitch sans Streamer.bot ;
- la liaison identité Twitch ↔ compte GachaImpact ;
- l'UI standalone de consultation ;
- le lien avec `Quotidiennes` ;
- la migration des Faveurs existantes ;
- l'idempotence des événements Twitch.

Ce domaine ne doit pas transformer GachaImpact en système d'achat Twitch intégré.

La souscription reste une action externe réalisée sur Twitch.

---

# 2. Sources inspectées

Sources legacy principales :

- `legacy/streamerbot/commands/Faveur.txt`
- `legacy/streamerbot/commands/Subscription.txt`
- `legacy/streamerbot/commands/XP.txt`
- `legacy/streamerbot/data/viewers_data.json`
- `docs/legacy/04-xp-audit.md`
- `docs/legacy/02-current-player-model.md`
- `docs/commands/command-reference.md`
- `docs/specifications/decisions-log.md`

Documentation technique externe vérifiée le 2026-09-03 :

- documentation officielle Twitch EventSub — types d'abonnement ;
- documentation officielle Twitch API — abonnements d'un broadcaster.

Le code réel prévaut sur les commentaires d'en-tête lorsque les deux divergent.

---

# 3. Intention produit explicitement fournie par le propriétaire

Les directions suivantes ont été données explicitement avant le début des décisions R657+ :

- la Faveur reste liée aux **subscriptions Twitch** ;
- un sub / gift sub doit pouvoir déclencher la mécanique si l'intégration Twitch le permet ;
- le plafond de durée reste **180 jours** ;
- une nouvelle Faveur ne peut jamais faire dépasser 180 jours ;
- les jours qui ne peuvent pas être ajoutés à cause du plafond doivent être convertis en Primogemmes selon une logique de **prorata** ;
- une Faveur complètement perdue car le joueur est déjà à 180 jours doit correspondre à **1 600 Primogemmes de compensation** ;
- exemple donné : avec 170 jours restants, seuls 10 jours peuvent être ajoutés et les 20 jours perdus doivent produire une compensation proportionnelle ;
- dans la V1, le temps de Faveur doit **s'écouler chaque jour même si le joueur ne se connecte pas et ne parle pas** ;
- le décompte ne doit plus dépendre d'un message joueur ;
- la mécanique d'obtention est **Twitch-only** : l'UI standalone n'a pas vocation à permettre l'achat d'un abonnement Twitch.

Point encore à préciser :

- l'articulation exacte entre la compensation de dépassement et les +1 600 Primogemmes immédiates actuellement données par le legacy ;
- le comportement de la récompense quotidienne lorsqu'un joueur ne se connecte pas ;
- la règle exacte des resubscriptions automatiques ;
- le bonus gifter.

---

# 4. `!faveur` legacy

`Faveur.txt` est uniquement une commande de consultation.

Syntaxes :

- `!faveur`
- `!faveur pseudo`
- `!faveur @pseudo`

Le script :

- ne crée pas de viewer ;
- ne modifie pas les données ;
- lit `favor.daysRemaining` ;
- considère la Faveur inactive si `daysRemaining <= 0` ;
- affiche `Maximum atteint` si `daysRemaining >= 180` ;
- affiche sinon les jours restants et la récompense annoncée de **+800 Primogemmes/jour**.

Le legacy permet donc actuellement de consulter la Faveur d'un autre joueur en passant son pseudo.

Cette visibilité devra être décidée pour la cible standalone.

---

# 5. Structure de données legacy

Section observée :

```json
"favor": {
  "daysRemaining": 35,
  "obtainedDate": "2026-08-12",
  "lastClaimDate": "2026-08-26"
}
```

Champs :

- `daysRemaining` : nombre de jours encore disponibles selon la logique legacy ;
- `obtainedDate` : date de la dernière attribution de Faveur ;
- `lastClaimDate` : dernier jour où la récompense quotidienne a réellement été accordée.

Des profils réels possèdent encore des soldes actifs, par exemple :

- 35 jours ;
- 19 jours ;
- 33 jours.

D'autres profils possèdent `0`.

La donnée est donc réellement utilisée et doit être migrée.

---

# 6. `Subscription.txt` — bénéficiaire réel

Le code détermine :

- `gifter` depuis `userName` ;
- `recipient` depuis plusieurs arguments Streamer.bot possibles ;
- si aucun recipient séparé n'existe, le recipient devient le viewer ayant déclenché le sub.

Le **bénéficiaire de la Faveur est le recipient du subscription**, pas le gifter.

Pour un gift sub :

- le receveur obtient la Faveur ;
- le gifter peut recevoir un bonus séparé de Primogemmes.

Cette distinction doit rester explicite dans la cible.

---

# 7. Précondition legacy niveau 2

`Subscription.txt` ignore totalement la Faveur si :

- le bénéficiaire n'existe pas dans `viewers_data.json` ;
- ou son niveau est inférieur à 2.

Le même filtre niveau 2 est appliqué au gifter pour son éventuel bonus.

Ce comportement est une règle produit legacy, pas une nécessité technique.

À décider pour le standalone :

- conserver le niveau 2 ;
- ou remplacer cette contrainte par l'existence d'un compte GachaImpact valide et d'un lien Twitch.

---

# 8. Durée legacy

Constantes :

- `FavorDaysGranted = 30`
- `FavorMaxDays = 180`

Une attribution tente donc d'ajouter :

**30 jours**

avec plafond :

**180 jours restants**

Exemples :

- 0 → 30 ;
- 50 → 80 ;
- 150 → 180 ;
- 170 → 180, avec 20 jours qui ne peuvent pas être ajoutés ;
- 180 → 180, avec 30 jours perdus.

Le propriétaire a explicitement confirmé que le plafond 180 doit rester.

La conservation exacte des 30 jours par Faveur reste à formaliser dans R657+.

---

# 9. Primogemmes immédiates legacy

Constante :

`FavorBasePrimos = 1600`

Lorsque les 30 jours rentrent intégralement sous le plafond, le bénéficiaire reçoit immédiatement :

**+1 600 Primogemmes**

En plus des jours de Faveur.

Cette récompense est ajoutée à :

- `viewer.primogems`
- `stats.totalPrimosEarned`

Elle doit être distinguée de la récompense quotidienne de +800.

---

# 10. Dépassement du plafond legacy — comportement incohérent avec la nouvelle intention

Le code possède :

`FavorOverflowPrimos = 3200`

Si tous les jours ne peuvent pas être ajoutés :

```text
ratio = lostDays / 30
primosGiven = round(3200 × ratio)
```

Ce montant **remplace** alors le +1 600 normal.

Exemples du vrai code :

### Joueur à 180 jours

- jours ajoutés : 0 ;
- jours perdus : 30 ;
- Primogemmes immédiates : 3 200.

### Joueur à 170 jours

- jours ajoutés : 10 ;
- jours perdus : 20 ;
- Primogemmes immédiates : environ 2 133.

### Joueur à 160 jours

- jours ajoutés : 20 ;
- jours perdus : 10 ;
- Primogemmes immédiates : environ 1 067.

Le propriétaire vient d'indiquer une autre intention :

- 30 jours complètement perdus au plafond → **1 600 Primogemmes de compensation** ;
- perte partielle → compensation au prorata.

Il faudra donc remplacer la formule legacy.

Il reste à décider si cette compensation :

- remplace le +1 600 immédiat normal ;
- ou s'ajoute au +1 600 immédiat normal.

Cette distinction change fortement l'économie et doit être explicitement validée.

---

# 11. Bonus gifter legacy

Constante :

`GifterPrimos = 1600`

Pour un gift sub :

- si le gifter possède un viewer ;
- et niveau >= 2 ;
- il reçoit actuellement **+1 600 Primogemmes**.

Le code ne donne pas de jours de Faveur au gifter uniquement parce qu'il offre le sub.

Le nombre de fois où ce bonus se déclenche lors d'un gift multiple dépend du câblage Streamer.bot externe au repository.

Le script seul ne permet pas de prouver si un pack de plusieurs gifts provoquait :

- un bonus unique ;
- ou un bonus par bénéficiaire.

La cible devra fixer cette règle explicitement.

---

# 12. Récompense quotidienne legacy

La récompense quotidienne n'est pas gérée par `Faveur.txt` ni par `Subscription.txt`.

Elle est portée par :

`XP.txt`

Montant :

**+800 Primogemmes**

Conditions principales observées :

- message non commande ;
- message non système ;
- `favor.daysRemaining > 0` ;
- la Faveur n'a pas été obtenue le jour même ;
- `lastClaimDate` n'est pas déjà aujourd'hui.

Lors du claim :

- +800 Primogemmes ;
- `totalPrimosEarned` augmente ;
- `daysRemaining` diminue de 1 ;
- `lastClaimDate` devient aujourd'hui.

---

# 13. Défaut structurel legacy : le temps ne passe que si le joueur parle

Le legacy ne décrémente pas les jours selon le calendrier.

Il décrémente uniquement lorsqu'un joueur obtient effectivement son reward via `XP.txt`.

Conséquence :

- joueur absent 10 jours ;
- aucune exécution de son claim Faveur ;
- aucun jour consommé ;
- la Faveur est artificiellement mise en pause.

Cette logique était cohérente avec les limitations Streamer.bot mais n'est plus souhaitée.

Direction utilisateur explicite :

**les jours doivent désormais s'écouler selon le calendrier même lorsque le joueur est absent.**

La présence, le chat interne ou Twitch ne doivent jamais être utilisés comme scheduler.

---

# 14. Cible temporelle initiale

Direction technique compatible avec la demande :

- journée métier : `Europe/Paris` ;
- la durée de Faveur est liée à une échéance / calendrier serveur ;
- un jour passe indépendamment de toute activité utilisateur ;
- l'état est calculable même si personne n'est connecté ;
- le serveur ne doit pas lancer un traitement individuel fragile à minuit pour chaque joueur si une représentation par échéance permet de dériver proprement les jours restants.

La future structure pourra donc préférer une notion telle que :

- date/instant d'expiration ;
- journal des attributions ;
- état du reward quotidien ;

plutôt qu'un entier décrémenté uniquement par activité.

Le modèle exact sera fixé lors du modèle de données cible.

---

# 15. Twitch : faisabilité vérifiée

La mécanique peut rester liée à Twitch sans Streamer.bot.

La documentation officielle Twitch actuelle expose EventSub.

## Nouveau sub / gift reçu

`channel.subscribe`

- notifie lorsqu'une chaîne reçoit un subscriber ;
- ne couvre pas les resubs ;
- fournit l'identité du subscriber ;
- indique si le sub est un gift avec `is_gift`.

Cela permet de détecter le **bénéficiaire** d'un nouveau sub, y compris lorsqu'il a reçu un gift.

## Gift côté gifter

`channel.subscription.gift`

- notifie lorsqu'un utilisateur offre un ou plusieurs subscriptions ;
- fournit l'identité du gifter, sauf anonymat ;
- fournit le nombre `total` et le tier ;
- ne fournit pas directement la liste des bénéficiaires.

La combinaison :

- `channel.subscribe` pour chaque bénéficiaire ;
- `channel.subscription.gift` pour le gifter / volume ;

permet de couvrir proprement la majorité du comportement legacy.

## Fin d'abonnement

`channel.subscription.end`

permet également de savoir qu'un abonnement s'est terminé.

La Faveur n'a cependant pas besoin d'être retirée lorsqu'un sub expire : une attribution déjà obtenue constitue une durée de jeu indépendante.

---

# 16. Resubscription : nuance importante de faisabilité

Twitch expose :

`channel.subscription.message`

mais cet événement correspond à un **message de resubscription envoyé par l'utilisateur dans le chat**.

La documentation ne présente pas cet événement comme une notification garantie pour chaque renouvellement automatique silencieux.

`channel.chat.notification` peut également exposer des notices `resub`, mais reste lié à une notification de chat.

Conclusion conservatrice :

- nouveau sub : détectable ;
- gift sub au bénéficiaire : détectable ;
- gifter / quantité de gifts : détectable ;
- resub explicitement annoncé : détectable ;
- chaque renouvellement automatique silencieux : **pas considéré garanti par les preuves techniques actuelles**.

L'API `Get Broadcaster Subscriptions` permet de vérifier qui est actuellement abonné et si un sub est gift, mais ne fournit pas à elle seule une date de renouvellement exploitable garantissant une nouvelle attribution mensuelle sans risque de double crédit.

La règle produit cible sur les resubs devra donc être choisie en tenant compte de cette limite.

---

# 17. Autorisation Twitch requise

Les événements Subscription concernés demandent actuellement le scope Twitch :

`channel:read:subscriptions`

Le broadcaster devra autoriser l'application GachaImpact avec ce scope.

Cela signifie que l'intégration future devra prévoir :

- une application Twitch ;
- authentification OAuth du broadcaster ;
- EventSub ;
- secret / validation des webhooks ou transport EventSub adapté ;
- stockage sécurisé des credentials nécessaires ;
- renouvellement / révocation gérés proprement.

Ce chantier appartient à l'intégration Twitch future, pas au moteur Faveur lui-même.

---

# 18. Identité Twitch ↔ GachaImpact

La cible standalone possède ses propres comptes.

Pour créditer une Faveur au bon joueur, le backend doit relier :

`Twitch user_id`

à :

`GachaImpact player_id`

Le pseudo Twitch ne doit pas devenir une clé métier permanente.

Cas à décider :

- Twitch lié à un compte GachaImpact existant ;
- recipient Twitch non lié ;
- gifter Twitch non lié ;
- liaison réalisée après l'événement.

Le système ne doit jamais créditer un joueur par simple égalité de pseudo.

---

# 19. UI standalone

La souscription elle-même reste sur Twitch.

L'écran GachaImpact ne doit donc pas proposer un faux bouton d'achat interne du type :

`Acheter la Faveur`

sans réelle intégration commerciale.

En revanche, l'UI peut parfaitement afficher :

- Faveur active / inactive ;
- jours restants ;
- plafond 180 ;
- récompense quotidienne ;
- état du reward du jour ;
- origine Twitch ;
- éventuellement un lien externe vers la chaîne Twitch si souhaité plus tard.

La place exacte dans l'UI reste à décider.

---

# 20. `Quotidiennes`

Si la récompense +800 reste à réclamer / obtenir pendant une journée active :

- la Faveur peut devenir un contributeur du hub `Quotidiennes`.

Exemple d'état :

- `À récupérer aujourd'hui`
- `Récupérée aujourd'hui`
- `Inactive`

Si la cible décide au contraire de créditer automatiquement +800 même lorsque le joueur est absent, la Faveur n'est plus une vraie action quotidienne à effectuer et ne doit pas être présentée comme telle.

Ce point dépend donc directement de R657+.

---

# 21. Migration initiale

Données certaines à préserver :

- `favor.daysRemaining`
- `favor.obtainedDate`
- `favor.lastClaimDate`

Principe conservateur :

- ne pas recalculer rétroactivement les jours que le joueur aurait « dû perdre » selon la nouvelle règle ;
- le legacy avait volontairement une durée liée aux claims ;
- la valeur `daysRemaining` au cutover devient donc le solde de départ certain ;
- à partir du cutover seulement, la nouvelle règle calendaire s'applique.

Exemple :

legacy au cutover :

`35 jours restants`

→ cible :

`35 jours restants à partir du cutover`

et non une tentative de reconstituer combien de jours calendaires se sont réellement écoulés depuis `obtainedDate`.

Aucune Primogemme n'est distribuée uniquement parce que la migration a lieu.

---

# 22. Idempotence des événements Twitch

Les callbacks Twitch peuvent être redélivrés / retry.

Une attribution Faveur doit être protégée par un identifiant d'événement externe ou une clé d'idempotence équivalente.

Le même événement Twitch traité deux fois ne peut jamais produire :

- +60 jours au lieu de +30 ;
- double +1 600 ;
- double compensation overflow ;
- double bonus gifter.

Les mutations Faveur et économiques doivent être transactionnelles.

---

## R657 — Décompte calendaire même en cas d'absence — ✅ VALIDÉ A

Chaque journée de Faveur s'écoule selon le calendrier serveur, indépendamment de l'activité du joueur.

La durée ne dépend plus :

- d'un message Twitch ;
- d'un message dans le chat interne ;
- d'une connexion standalone ;
- d'une commande ;
- d'une tâche déclenchée par le joueur.

Référence temporelle :

`Europe/Paris`

Une absence ne met donc jamais la Faveur en pause.

---

## R658 — Récompense quotidienne conditionnée à une présence — ✅ VALIDÉ A ENRICHI

Chaque journée active de Faveur consomme un jour, que le joueur soit présent ou non.

Les **+800 Primogemmes quotidiennes ne sont cependant accordées que si le joueur se manifeste pendant cette journée**.

Une seule réclamation est possible tous canaux confondus.

### Standalone

La première présence authentifiée pertinente peut réclamer automatiquement la récompense du jour.

Lorsqu'elle est réellement accordée depuis le standalone :

- afficher une petite animation Faveur ;
- montrer clairement `+800 Primogemmes` ;
- mettre immédiatement à jour le profil.

### Twitch

Le premier message normal éligible du joueur peut continuer à déclencher la récompense quotidienne, comme dans l'esprit du système actuel.

### État partagé

Si la récompense a déjà été reçue sur Twitch puis que le joueur ouvre le standalone :

- aucune seconde récompense ;
- aucune seconde animation de gain ;
- le profil affiche clairement que la récompense du jour a déjà été reçue.

Le profil personnel affiche notamment :

- jours de Faveur restants ;
- état actif / inactif ;
- `✓ Récompense du jour reçue` lorsque le claim a déjà eu lieu ;
- état contraire lorsqu'elle reste encore récupérable aujourd'hui.

Une journée passée sans présence consomme normalement un jour de Faveur et ses +800 sont définitivement perdues.

---

## R659 — Récompense quotidienne — ✅ VALIDÉ A

Conserver :

**+800 Primogemmes par journée réclamée**

Le gain maintient les statistiques économiques centrales de Primogemmes.

---

## R660 — Récompense immédiate normale — ✅ VALIDÉ A

Une nouvelle Faveur Tier 1 donne immédiatement :

**+1 600 Primogemmes**

Cette récompense est distincte :

- des 30 jours ajoutés ;
- des +800 quotidiennes ;
- de la compensation éventuelle due au plafond.

---

## R661 — Compensation du dépassement en plus du bonus normal — ✅ VALIDÉ A

La récompense immédiate normale de la Faveur est toujours accordée.

En complément, chaque jour que le plafond de 180 empêche d'ajouter donne une compensation proportionnelle.

Base de compensation :

**30 jours perdus = 1 600 Primogemmes**

Formule conceptuelle :

`compensation = round(1600 × jours_perdus / 30)`

Exemples Tier 1 :

### Joueur à 100 jours

- +30 jours ;
- 130/180 ;
- +1 600 immédiates ;
- aucune compensation.

### Joueur à 170 jours

- +10 jours ;
- 180/180 ;
- 20 jours perdus ;
- compensation ≈ +1 067 Primogemmes ;
- gain immédiat total ≈ +2 667.

### Joueur déjà à 180 jours

- +0 jour ;
- 30 jours perdus ;
- compensation +1 600 ;
- bonus normal +1 600 ;
- gain immédiat total **+3 200 Primogemmes**.

La compensation représente uniquement la valeur des jours impossibles à ajouter.

---

## R662 — Premier reward quotidien le lendemain — ✅ VALIDÉ A

Le jour où une nouvelle Faveur est obtenue ou prolongée ne consomme pas immédiatement un jour de cette nouvelle attribution.

Le premier jour quotidien correspondant commence le lendemain selon `Europe/Paris`.

Cela évite notamment qu'un sub reçu très tard dans la journée fasse perdre presque instantanément une journée.

---

## R663 — Durée d'une attribution — ✅ VALIDÉ A

Une Faveur ajoute normalement :

**30 jours**

Plafond :

**180 jours**

Les différentes attributions se cumulent jusqu'à ce plafond.

---

## R664 — Éligibilité basée sur l'activation par l'élément — ✅ VALIDÉ PERSONNALISÉ

L'objectif est d'éviter qu'un viewer Twitch passif ou totalement extérieur au jeu profite automatiquement de la Faveur simplement parce qu'il reçoit un gift sub.

La Faveur applique la règle centrale d'activation Twitch :

**élément choisi = joueur activé.**

### Joueur Twitch-only

Pour recevoir une nouvelle Faveur :

- le joueur interne doit déjà exister ;
- son élément personnel doit être choisi.

Aucun niveau minimum supplémentaire n'est requis.

Un profil Twitch-only peut donc exister sans être encore éligible à la Faveur tant que son élément est vide.

Cette règle remplace le filtre legacy `niveau >= 2`.

### Joueur standalone complet

Le standalone impose déjà le choix d'élément pendant l'onboarding.

Si son Twitch User ID est correctement relié au même joueur interne :

- il satisfait automatiquement le verrou d'activation ;
- son niveau n'a aucune importance pour recevoir une Faveur.

Faveur ne possède donc pas sa propre définition de « joueur actif » : elle réutilise la règle centrale de l'élément.

---

## R665 — Aucun entitlement différé pour un viewer extérieur au jeu — ✅ VALIDÉ PERSONNALISÉ

Un événement de subscription ou gift sub ne crée pas à lui seul un joueur GachaImpact.

### Twitch

Le fonctionnement général reste cohérent avec l'architecture déjà validée :

- le premier message Twitch peut créer un profil joueur Twitch-only ;
- ce profil appartient déjà au joueur interne ;
- `!element` permet ensuite de terminer son activation ;
- il pourra éventuellement être rattaché plus tard à un compte web.

Si un bénéficiaire d'un gift :

- n'a encore aucun joueur interne GachaImpact ;
- ou possède un profil Twitch-only sans élément choisi ;

la Faveur n'est pas appliquée.

Elle n'est pas mise dans une file d'attente de plusieurs semaines/mois pour être récupérée plus tard.

Créer plus tard un profil ou choisir ultérieurement son élément ne ressuscite donc pas une ancienne attribution ignorée.

### Standalone

Un joueur ayant terminé l'onboarding standalone possède déjà :

- son joueur interne ;
- son élément.

Si son Twitch est correctement relié, il satisfait donc automatiquement R664.

---

## R666 — Bonus du gifter — ✅ VALIDÉ A

Conserver :

**+1 600 Primogemmes au gifter par abonnement offert**

Le gifter doit lui-même correspondre à un joueur GachaImpact éligible.

Pour un joueur Twitch-only, appliquer le même principe de participation active que R664.

Pour un joueur standalone correctement lié, le niveau ne constitue pas un blocage.

Un gifter anonyme ou ne correspondant à aucun joueur éligible ne reçoit aucun bonus GachaImpact.

---

## R667 — Gift multiple proportionnel — ✅ VALIDÉ A

Le bonus gifter est accordé **par abonnement réellement offert**.

Exemple :

5 gift subs éligibles :

`5 × 1 600 = 8 000 Primogemmes`

Le backend doit utiliser les données autoritatives Twitch de quantité du gift et garantir l'idempotence.

Un même gift ne doit jamais être comptabilisé une fois via l'événement global puis une deuxième fois via les événements des bénéficiaires.

---

## R668 — Tier Twitch modifie uniquement la récompense immédiate — ✅ VALIDÉ PERSONNALISÉ

Les tiers ne changent pas :

- la durée de 30 jours ;
- le cap 180 ;
- les +800 quotidiennes ;
- la formule de compensation des jours perdus.

Ils modifient uniquement la récompense immédiate du bénéficiaire.

### Tier 1

**+1 600 Primogemmes**

### Tier 2

**+4 800 Primogemmes**

### Tier 3

**+9 600 Primogemmes**

La compensation du plafond reste calculée sur :

**1 600 Primogemmes pour 30 jours perdus**

quel que soit le tier.

Le bonus gifter défini par R666 reste lui aussi à +1 600 par abonnement offert, quel que soit le tier, sauf révision produit explicite ultérieure.

---

## R669 — Resub uniquement sur événement fiable — ✅ VALIDÉ A

Une nouvelle attribution de Faveur est produite lorsqu'un événement Twitch suffisamment fiable prouve le resub.

Sont notamment acceptables :

- nouveau subscription ;
- gift subscription ;
- resub explicitement remonté par Twitch selon l'intégration disponible.

Un renouvellement automatique silencieux que l'intégration ne peut pas identifier de manière fiable ne doit pas être inventé à partir d'une estimation de date.

Si Twitch expose ultérieurement un événement fiable couvrant ces renouvellements, l'intégration pourra l'utiliser sans changer la règle métier.

---

## R670 — Consultation de la Faveur soumise à la confidentialité — ✅ VALIDÉ A

`!faveur`

permet toujours de consulter sa propre Faveur.

`!faveur <pseudo>`

peut être conservé, mais l'accès aux informations d'un autre joueur respecte les règles de visibilité de profil déjà définies.

La durée restante d'une Faveur ne contourne pas les préférences de confidentialité du joueur.

---

## R671 — Pas d'écran Faveur dédié — ✅ VALIDÉ A ENRICHI

La Faveur ne possède pas de grand écran métier indépendant dans la V1.

Elle est présentée principalement :

### Profil personnel

Afficher notamment :

- Faveur active / inactive ;
- jours restants sur 180 ;
- +800 Primogemmes/jour ;
- état de la récompense du jour.

### Hub Quotidiennes

Lorsqu'une Faveur est active, une carte peut afficher :

- reward du jour disponible ;
- reward déjà reçu ;
- jours restants.

### Faveur inactive

Afficher une mention expliquant que la Faveur peut être obtenue en s'abonnant à la chaîne Twitch de Kichnifou.

Lien externe :

`https://www.twitch.tv/kichnifou`

L'action ouvre Twitch ; aucun paiement Twitch n'est exécuté par GachaImpact lui-même.

---

## R672 — Animation quotidienne et état persistant — ✅ VALIDÉ PERSONNALISÉ

La restitution principale de la Faveur dans le standalone concerne la récompense quotidienne.

Lorsque la première présence standalone du jour déclenche réellement les +800 :

- petite animation dédiée à la Faveur ;
- affichage du gain ;
- mise à jour immédiate des Primogemmes ;
- profil marqué `Récompense du jour reçue`.

Si les +800 ont déjà été obtenues auparavant dans la journée via Twitch :

- ne rien repayer ;
- ne pas rejouer une fausse animation de récompense ;
- afficher simplement dans le profil que la récompense du jour a déjà été reçue.

Inversement, une récompense déjà obtenue dans le standalone empêche naturellement un nouveau paiement lors du premier message Twitch ultérieur.

L'état quotidien est donc global au joueur et non propre au canal.

L'obtention/prolongation Twitch peut produire son message de confirmation adapté au canal, tandis que le standalone reflète immédiatement les nouveaux jours et les Primogemmes dans le profil.

---

# 23. Décisions techniques acquises

- Plafond métier : 180 jours.
- Une attribution normale représente 30 jours.
- Calendrier métier : `Europe/Paris`.
- La durée restante est indépendante de la présence et doit pouvoir être dérivée à partir d'une échéance serveur plutôt que d'un compteur décrémenté par des messages.
- Chaque journée possède au maximum une récompense Faveur par joueur, tous canaux confondus.
- Un claim Twitch et un claim standalone concurrents sont sérialisés/idempotents.
- Le standalone vérifie l'état autoritatif du jour avant d'afficher une animation de gain.
- Une animation ne constitue jamais la preuve métier d'un paiement.
- La récompense quotidienne et son état sont persistés de manière à être immédiatement visibles depuis l'autre canal.
- Le profil affiche un état dérivé du serveur et ne décrémente jamais localement les jours.
- Les récompenses immédiates par tier sont : T1 1 600, T2 4 800, T3 9 600.
- La compensation du plafond est distincte du bonus immédiat et utilise `round(1600 × jours_perdus / 30)`.
- Les événements Twitch sont dédupliqués par identifiant externe / clé d'idempotence.
- L'événement `channel.subscription.gift` ou équivalent est propriétaire du bonus gifter afin de ne pas le doubler avec les événements individuels de bénéficiaires.
- Un gift multiple applique le nombre autoritatif de gifts exactement une fois.
- Un événement de subscription ne crée jamais à lui seul un joueur interne.
- Twitch-only : l'éligibilité Faveur utilise la règle centrale `élément choisi = joueur activé` ; aucun seuil de niveau supplémentaire.
- Standalone onboardé + Twitch lié : l'élément est déjà obligatoire, donc aucune condition supplémentaire d'activation ou de niveau.
- Le pseudo Twitch n'est jamais utilisé comme identité métier ; utiliser le Twitch User ID résolu vers le player ID interne.
- Une Faveur ignorée pour absence de joueur / inéligibilité n'est pas conservée comme entitlement différé.
- La migration conserve le `daysRemaining` certain au cutover sans recalcul rétroactif.
- À partir du cutover seulement, la nouvelle consommation calendaire s'applique.
- Une attribution Faveur déjà active au cutover n'est jamais repayée pendant la migration.
- Les +800 historiques non réclamés ne sont pas reconstruits.

---

# 24. Modèle temporel cible

`daysRemaining` ne doit plus être un compteur décrémenté lorsqu'un joueur parle.

La cible conserve une échéance serveur permettant de dériver les jours réellement restants.

Conceptuellement :

- journée métier en `Europe/Paris` ;
- une attribution ajoute jusqu'à 30 journées futures ;
- maximum 180 journées restantes ;
- une nouvelle attribution reçue aujourd'hui commence ses nouvelles journées à partir du lendemain ;
- les journées passent automatiquement avec le calendrier.

Le modèle de données final pourra matérialiser cette règle avec une date d'expiration / dernière journée active plutôt qu'un compteur mutable.

Le claim quotidien reste une donnée séparée identifiée par :

`player + businessDate`

Il ne modifie jamais la durée de la Faveur.

---

# 25. Migration Faveur

Migrer lorsque présents :

- `favor.daysRemaining` ;
- `favor.obtainedDate` ;
- `favor.lastClaimDate`.

Principe :

**la valeur `daysRemaining` du legacy au cutover est considérée certaine.**

Ne pas appliquer rétroactivement la nouvelle consommation calendaire aux jours antérieurs au cutover.

### Reward du jour du cutover

Si `lastClaimDate` correspond déjà à la journée du cutover :

- considérer les +800 du jour comme déjà reçues ;
- ne jamais les repayer.

Si le joueur possède une Faveur active et que le reward du jour n'a pas encore été reçu :

- il peut rester récupérable ce jour-là si les règles legacy ne l'interdisaient pas déjà ;
- à partir de minuit suivant, la nouvelle consommation calendaire s'applique normalement.

Si `obtainedDate` correspond au jour du cutover :

- préserver la règle empêchant le reward quotidien le jour même de l'obtention.

Aucune récompense immédiate, compensation ou journée supplémentaire n'est déclenchée uniquement par l'import.

La migration est idempotente.

---

# 26. Producteurs / consommateurs cibles

## Intégration Twitch

Produit les événements externes nécessaires :

- nouveau sub ;
- gift sub ;
- gifter / quantité offerte ;
- resub fiable lorsqu'il existe.

Elle résout le Twitch User ID vers le joueur interne.

Elle ne décide pas elle-même des montants économiques.

## Service Faveur

Produit :

- attribution / prolongation ;
- durée active ;
- compensation overflow ;
- éligibilité quotidienne ;
- état `reward reçu aujourd'hui`.

## Économie

Reçoit :

- bonus immédiat Tier 1 / 2 / 3 ;
- compensation du plafond ;
- +800 quotidien ;
- bonus gifter.

Toutes ces mutations maintiennent `totalPrimosEarned`.

## Profil

Consomme :

- Faveur active / inactive ;
- jours restants ;
- maximum 180 ;
- état du reward quotidien.

## Quotidiennes

Consomme :

- reward Faveur disponible aujourd'hui ;
- reward déjà reçu ;
- Faveur inactive.

## Notifications / UI

Peut restituer :

- obtention/prolongation de Faveur ;
- animation des +800 lorsqu'ils sont réellement accordés depuis le standalone.

---

# 27. Contrat cible `!faveur`

Syntaxes :

- `!faveur`
- `!faveur <pseudo>`

La commande reste une **consultation**.

Elle ne constitue pas elle-même un claim quotidien.

### Sa propre Faveur

Afficher de manière compacte :

- active / inactive ;
- jours restants ;
- +800 par jour ;
- reward du jour déjà reçu ou encore disponible.

### Faveur d'un autre joueur

Respecter les règles de confidentialité du profil.

### Twitch

Le premier message normal éligible peut réclamer les +800.

`!faveur` n'est pas utilisé comme deuxième chemin économique indépendant.

---

# 28. Critères d'acceptation

Le Domaine Faveur / Subscription est prêt pour la V1 si les tests peuvent prouver notamment que :

1. une attribution normale ajoute 30 jours au maximum ;
2. la durée ne dépasse jamais 180 jours ;
3. les jours passent même si le joueur est totalement absent ;
4. une journée absente consomme un jour sans accorder +800 ;
5. un reward quotidien ne peut être payé qu'une fois tous canaux confondus ;
6. Twitch puis standalone le même jour ne paient pas deux fois ;
7. standalone puis Twitch le même jour ne paient pas deux fois ;
8. le profil indique correctement `Récompense du jour reçue` ;
9. l'animation standalone n'apparaît que lorsqu'un vrai paiement est effectué ;
10. Tier 1 donne +1 600 immédiates ;
11. Tier 2 donne +4 800 immédiates ;
12. Tier 3 donne +9 600 immédiates ;
13. chaque jour bloqué par le plafond produit la compensation proportionnelle validée ;
14. la compensation s'ajoute au bonus immédiat ;
15. un nouveau bloc de 30 jours commence ses daily rewards le lendemain ;
16. un profil Twitch-only sans élément choisi ne reçoit pas de Faveur ;
17. un profil Twitch-only avec élément choisi est éligible sans seuil de niveau supplémentaire ;
18. un joueur standalone onboardé et correctement Twitch-lié est éligible quel que soit son niveau ;
19. un gift ne crée pas automatiquement un joueur GachaImpact ;
20. une Faveur ignorée n'est pas réclamable rétroactivement après activation ;
21. le gifter éligible reçoit exactement +1 600 par sub offert ;
22. un gift multiple n'est jamais doublé par les événements des bénéficiaires ;
23. un même événement Twitch retraité ne produit aucune seconde récompense ;
24. un resub n'est crédité que lorsqu'une preuve Twitch suffisamment fiable existe ;
25. `!faveur pseudo` respecte la confidentialité ;
26. la migration conserve les jours restants certains sans punition rétroactive ;
27. aucun reward historique absent n'est inventé pendant la migration.

---

# 29. Conclusion du domaine

**Domaine Faveur / Subscription : CLÔTURÉ après R672.**

Le comportement produit, l'intégration Twitch, l'activation par élément, le calendrier de Faveur, les rewards, l'overflow, les gifts, les tiers, la migration et les contrats de consultation sont suffisamment définis pour une future implémentation V1 bornée.

Le domaine ne doit être rouvert que si :

- l'intégration Twitch réelle révèle une limitation nouvelle ;
- le sweep final découvre une dépendance oubliée ;
- une décision produit est explicitement modifiée.

---

# 30. Sweep final obligatoire

Même après clôture de Faveur / Subscription et des audits restants, le sweep exhaustif final des 37 scripts `.txt` et 17 JSON reste obligatoire avant le modèle de données cible final et la V1.
