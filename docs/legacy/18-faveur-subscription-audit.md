# 18 — Audit Faveur / Subscription

> Domaine 15 de l'audit GachaImpact.  
> Statut : **EN COURS — audit technique initial réalisé, directions produit utilisateur intégrées, premières décisions à reprendre à R657**.  
> Ce document devient la source spécialisée du domaine Faveur / Subscription.  
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

# 23. Directions produit déjà acquises

Sans consommer de nouvelles décisions techniques :

- plafond 180 jours conservé ;
- calendrier serveur `Europe/Paris` ;
- le temps de Faveur ne dépend plus des messages ;
- l'acquisition reste issue de Twitch, pas d'un achat standalone ;
- le bénéficiaire d'un gift est le recipient du subscription ;
- identité future basée sur Twitch ID lié à un player ID ;
- événements Twitch idempotents ;
- migration de `daysRemaining` sans punition rétroactive pour les jours qui n'étaient pas décrémentés par le legacy.

---

# 24. Points produit à décider

Reprendre à :

**R657**

À préciser notamment :

- chaque journée calendaire doit-elle consommer un jour même si le reward +800 n'est pas réclamé ? direction utilisateur : oui ;
- les +800 sont-ils perdus si le joueur ne se connecte pas, comme une Welkin classique, ou crédités automatiquement hors ligne ?
- conserver +800/jour ?
- conserver +1 600 Primogemmes immédiates sur une Faveur normale ?
- relation exacte entre +1 600 normal et compensation overflow ;
- commencer le reward quotidien le jour même de l'obtention ou le lendemain ;
- conserver 30 jours par Faveur ;
- conserver ou supprimer le filtre niveau 2 ;
- comportement si le Twitch bénéficiaire n'a pas encore de compte lié ;
- bonus gifter +1 600 : conserver / modifier / supprimer ;
- gift multiple : bonus gifter par sub ou par événement ;
- Tier 1 / 2 / 3 : même Faveur ou valeur différente ;
- règle cible pour les resubs étant donné les limites EventSub ;
- visibilité de `!faveur pseudo` ;
- présentation standalone ;
- contrat final `!faveur` ;
- migration / critères d'acceptation ;
- clôture.

---

# 25. Sweep final obligatoire

Même après clôture de Faveur / Subscription et des audits restants, le sweep exhaustif final des 36 scripts `.txt` et 17 JSON reste obligatoire avant le modèle de données cible final et la V1.
