# 04 — Audit legacy : XP / cycle de vie joueur

Statut : AUDIT TECHNIQUE INITIAL — VALIDATION EN COURS  
Date : 2026-08-27  
Source : `legacy/streamerbot/commands/XP.txt`

## Conclusion immédiate

Le nom `XP` est trompeur : ce script est actuellement le **principal orchestrateur de cycle de vie du jeu Streamer.bot**.

Il ne faut surtout pas le traduire tel quel en un unique fichier/service du nouveau backend.

Il contient au minimum les responsabilités suivantes :
1. création du joueur ;
2. application des valeurs par défaut ;
3. activité/messages ;
4. XP et level-up ;
5. récompense quotidienne du premier message ;
6. récompense quotidienne Faveur ;
7. intérêt bancaire quotidien ;
8. mission quotidienne “messages” ;
9. missions longues ;
10. expiration d'échanges ;
11. comptage giveaway ;
12. event mensuel ;
13. synchronisation C6 ;
14. nettoyage concours ;
15. initialisation/rotation bannière hebdomadaire ;
16. application des votes à la bannière.

Dans GachaImpact, chacune de ces responsabilités devra être centralisée dans son domaine approprié.

---

## 1. Création et defaults joueur

Au premier message, le script peut créer le viewer.

Defaults majeurs observés :
- `username`
- `xp`
- `level`
- `element`
- `primogems`
- `moras`
- `particles.*`
- `box`
- `team`
- `pity.pity5`
- `pity.pity4`
- `guarantee.guaranteedFeatured5`
- `selectedBannerCharacterId`
- `options`
- `missions`
- `stats`
- `dates`
- `tradeRequests`
- `usedCodes`
- `favor`
- `coffre`
- `specialItems`
- `longMissions`
- `bank`

### Décision architecture cible
Le nouveau compte ne doit PAS être “créé au premier message Twitch”.

Il sera créé par l'authentification GachaImpact, puis ses sous-domaines seront initialisés via un service central de création/provisionnement.

---

## 2. Activité et messages

Le script :
- met à jour la dernière activité ;
- incrémente `stats.totalMessages` pour les messages ;
- distingue les messages comptés pour XP via `stats.countedMessages`.

### XP autorisée si
- message non commande (`!`) ;
- message non système/bot ;
- cooldown XP de 2 secondes respecté ;
- si niveau >= 1, élément choisi.

### Gain XP par longueur
Code réel :
- `<= 100 caractères` : +1 XP
- `101–200` : +2 XP
- `> 200` : +3 XP

Important :
le code réel est la référence. Les commentaires de tête doivent être vérifiés car ils peuvent être obsolètes.

---

## 3. Niveau

Constantes :
- 30 XP par niveau ;
- niveau max 100.

Le niveau est calculé à partir de l'XP.

### Blocage élément
Une fois niveau 1 atteint, l'XP est bloquée tant que le joueur n'a pas choisi d'élément.

Cela sert actuellement de tutoriel/porte d'entrée vers `!element`.

### À décider pour GachaImpact
Dans une UI standalone, il sera probablement plus propre de demander l'élément lors de l'onboarding plutôt que de laisser le joueur atteindre niveau 1 puis bloquer sa progression.

---

## 4. Récompenses de level-up — divergence importante commentaire/code

Le commentaire d'en-tête de XP décrit des récompenses dépendant du niveau.

**Mais le code actuel fait autre chose.**

Code réel `GiveLevelRewards` :
- +800 primogemmes par niveau ;
- +10 000 moras par niveau ;
- niveau >= 5 :
  - +80 particules de l'élément principal ;
- niveau >= 10 :
  - +40 particules d'un autre élément aléatoire.

C'est donc cette mécanique qui doit être considérée comme le comportement legacy actuel, sauf décision contraire.

### Statistiques mises à jour
- `totalPrimosEarned`
- `totalMorasEarned`
- `totalMainElementParticlesEarned` si particules de l'élément personnel.

---

## 5. Niveau 100

Le niveau reste plafonné à 100.

Le script calcule des paliers d'overflow et donne à nouveau une récompense de niveau 100 tous les 30 XP supplémentaires.

Champ :
- `stats.level100OverflowRewardsClaimed`

La récompense utilise la même fonction `GiveLevelRewards(100)` :
- +800 primos ;
- +10 000 moras ;
- +80 particules élément principal ;
- +40 particules autre élément aléatoire.

Cette observation confirme la décision déjà validée :
- niveau bloqué à 100 ;
- progression/récompenses continues.

---

## 6. Récompense quotidienne — legacy « premier message valide »

### Comportement legacy observé

Conditions actuelles :
- pas une commande ;
- pas un message système ;
- niveau >= 2 ;
- élément choisi ;
- pas déjà réclamé aujourd'hui.

Récompense :
- +160 primogemmes ;
- +160 particules de l'élément personnel ;
- +10 000 moras.

Champ date :
- `dates.lastDailyFirstMessageReward`

Stats :
- `totalPrimosEarned`
- `totalMorasEarned`
- progression particules principales.

### Décision cible — ✅ VALIDÉE le 2026-08-27

La mécanique est **conservée sur le long terme** comme véritable récompense quotidienne de GachaImpact.

Pour la V1 :
- conserver les montants actuels : **160 primogemmes + 160 particules de l'élément du joueur + 10 000 moras** ;
- aucun rééquilibrage maintenant ; les montants pourront être revus lors de l'audit global de l'économie ;
- la récompense se renouvelle selon un **reset global quotidien à 00:00 dans le fuseau `Europe/Paris`** ;
- un jour non réclamé est perdu ;
- aucune récompense quotidienne normale ne s'accumule ou ne se reporte au jour suivant.

### Plusieurs moyens de réclamer, une seule règle métier

Le backend devra exposer **une seule opération idempotente de réclamation**. Tous les canaux utilisent cette même règle afin d'éviter les doubles gains.

Canaux voulus :
1. **Interface GachaImpact** : bouton `Réclamer` dans le suivi quotidien ;
2. **chat interne GachaImpact** : le premier message éligible du jour peut déclencher automatiquement la même réclamation ;
3. **Twitch** : le premier message éligible d'un joueur réellement inscrit/activé dans le jeu peut également déclencher la même réclamation.

Si la récompense a déjà été récupérée par un canal, les autres canaux ne donnent rien de plus.

### Important — ne plus enrôler les simples viewers Twitch passivement

Le garde-fou legacy `niveau >= 2` existe notamment parce que Streamer.bot crée/enregistre beaucoup de personnes qui écrivent simplement dans le chat sans réellement jouer.

Ce fonctionnement ne doit pas être reproduit tel quel.

Direction validée :
- dans l'application GachaImpact, le **choix de l'élément fait partie de l'inscription/onboarding obligatoire** ;
- un compte standalone réellement créé possède donc déjà son élément et peut utiliser le jeu dès le début, sans attendre le niveau 2 ;
- le verrou `niveau >= 2` n'est plus une condition souhaitée pour la récompense quotidienne standalone ;
- un simple message Twitch d'une personne qui n'a jamais choisi de jouer ne doit **ni créer silencieusement un joueur actif, ni la ping, ni déclencher des messages/récompenses du jeu** ;
- côté Twitch, l'entrée dans le jeu doit passer par une action explicite du viewer, avec `!element <élément>` comme mécanisme legacy naturel à conserver/adapter ;
- le modèle exact d'identité d'un joueur Twitch non encore lié à un compte GachaImpact sera figé pendant l'audit Auth/Twitch.

### UI — le rectangle devient un suivi des activités quotidiennes

Le bloc actuellement intitulé `RÉCOMPENSE QUOTIDIENNE`, en bas à gauche de l'interface, est destiné à évoluer vers un **suivi quotidien général**.

Principes validés :
- la récompense quotidienne est l'un des éléments pouvant être affichés dans ce bloc ;
- après sa réclamation, elle quitte l'élément actuellement proposé et laisse la place à une autre activité quotidienne ;
- exemples d'autres activités : combat quotidien, roue, etc. ;
- un ordre/priorité d'affichage sera défini plus tard ;
- le joueur pourra parcourir les activités visibles avec des contrôles **Précédent / Suivant** sans être obligé d'accomplir l'activité courante pour voir les suivantes ;
- certaines activités proposées pourront être **masquées pour la journée** via une petite croix ; ce masquage ne les accomplit pas et elles pourront réapparaître le lendemain ;
- plus tard, les paramètres du joueur permettront de choisir quelles catégories d'activités il souhaite ou non voir dans ce suivi ;
- lorsque toutes les activités visibles sont terminées ou écartées pour la journée, le bloc reste affiché avec un message du type **« Tout est bon, tu es à jour »**.

Le détail complet de ce `DailyTracker`/suivi quotidien fera l'objet d'une spécification dédiée ultérieure. Il ne faut pas mélanger ici la règle métier de la récompense avec toutes les futures règles d'affichage des autres quotidiennes.

### Feedback visuel lors de la réclamation

La carte n'a pas besoin d'afficher en permanence les trois montants.

Lors d'une réclamation :
- les compteurs de ressources de la colonne gauche sont mis à jour ;
- un feedback temporaire et translucide affiche les gains à proximité des compteurs concernés, par exemple `+160`, `+10 000`, etc. ;
- ce feedback disparaît automatiquement après une courte animation ;
- aucun badge supplémentaire n'est nécessaire pour signaler une récompense disponible puisque le bloc est déjà très visible.

### Rafraîchissement temps réel

Objectif UX :
- si le joueur reste connecté pendant le passage de 23:59 à 00:00, l'interface doit pouvoir détecter le nouveau jour et rafraîchir automatiquement l'état des quotidiennes ;
- le même principe pourra servir aux autres états temporels du jeu, par exemple un changement de bannière ;
- le serveur reste la source de vérité du reset ; le client ne doit pas décider seul qu'une récompense est disponible.

### Données à conserver

Pour la nouvelle implémentation :
- conserver l'équivalent de la **dernière date de réclamation** pour empêcher les doubles gains ;
- conserver également la **date de toute première réclamation quotidienne** comme information historique/statistique ;
- aucun historique dédié contenant une ligne pour chaque journée réclamée n'est requis pour cette mécanique.

Point migration :
`dates.lastDailyFirstMessageReward` permet de connaître la dernière réclamation legacy, mais ne suffit pas à reconstruire la toute première réclamation historique. Si aucune autre source n'est découverte, la première date historique des joueurs legacy devra rester inconnue plutôt que d'être inventée.

### Idées futures — non V1

À conserver dans la roadmap, sans les implémenter pendant la migration initiale :

**Streak quotidien**
- suivi des jours consécutifs ;
- idée de bonus après 7 jours consécutifs :
  - +1 000 primogemmes ;
  - +30 000 moras ;
  - +800 particules de l'élément du joueur ;
- la règle exacte reste à définir plus tard : bonus au 7e claim consécutif, dimanche calendaire, ou autre.

**Calendriers événementiels**
- certains événements pourront proposer un calendrier de connexion temporaire ;
- récompenses différentes selon le jour ;
- durée et contenu propres à chaque événement.

---

## 7. Faveur — récompense quotidienne

Si `favor.daysRemaining > 0` et conditions respectées :
- +800 primogemmes ;
- décrémente `daysRemaining` de 1 ;
- stocke `lastClaimDate`.

La date d'obtention empêche également une réclamation le jour même de l'activation selon le code.

### Clarification utilisateur

La Faveur est inspirée de la **Blessing of the Welkin Moon** de Genshin Impact, mais son comportement GachaImpact est volontairement différent sur un point important :

- dans GachaImpact legacy, un jour de Faveur n'est consommé que lorsqu'il est effectivement réclamé ;
- si le joueur ne se connecte pas, son nombre de jours restants ne diminue pas ;
- les Faveurs peuvent notamment être obtenues lors d'événements spéciaux du stream ou via certains abonnements Twitch ;
- la possibilité de détecter et attribuer proprement une Faveur à partir d'un abonnement Twitch devra être auditée séparément lors du domaine Twitch/Faveur.

### Architecture cible
Cette logique appartient à un service Faveur/abonnement, pas au service XP.

---

## 8. Banque — intérêt quotidien

`XP.txt` applique également l'intérêt bancaire.

Au premier message valide du jour :
- si solde banque > 0 ;
- intérêt = `3%` du solde (division entière) ;
- ajouté à `bank.moras` ;
- `totalMorasEarned` augmenté ;
- `bank.lastInterestDate` mis à jour.

### À décider
Dans GachaImpact, l'intérêt devrait être déterminé par le temps/date serveur, indépendamment d'un message Twitch.

---

## 9. Mission quotidienne “messages”

Le script incrémente une mission quotidienne si :
- mission active aujourd'hui ;
- type = `messages` ;
- non terminée.

Quand cible atteinte :
- mission terminée ;
- récompense automatiquement réclamée ;
- +800 primogemmes.

Le script expire la mission si `startedAt` n'est plus aujourd'hui.

---

## 10. Missions longues

XP surveille les missions longues actives et calcule leur progression à partir de compteurs globaux.

Comportements observés :
- catégories ;
- rang actif ;
- mission active ;
- baseline ;
- progression calculée `currentValue - baseline` ;
- auto-complétion ;
- récompense primogemmes ;
- auto-acceptation du rang suivant ;
- chaîne B → A → S ;
- déblocage Z après fin des rangs principaux ;
- vérification des missions Z actives.

### Architecture cible
Les missions devraient écouter des événements métier centraux (`MessageCounted`, `PullPerformed`, `CharacterObtained`, etc.) plutôt que XP aller relire tous les compteurs à chaque message.

---

## 11. Bannière hebdomadaire

XP vérifie la bannière à chaque exécution.

Comportement observé :
- semaine calculée à partir du lundi ;
- rotation si semaine différente ;
- bannière 5★/4★ ;
- historique des IDs précédemment featured ;
- prise en compte du vote pour au moins une sélection 5★ ;
- remise à zéro du fichier de votes pour la nouvelle semaine.

Le commentaire parle de 3 personnages 5★ et 5 personnages 4★.  
Le système de vote pondéré exclut notamment :
- personnages non 5★ ;
- personnage déjà featured ;
- personnages de la bannière précédente.

### À auditer ensuite
Le détail complet doit être confirmé en croisant :
- XP
- Vote
- Banniere
- Select
- Pull
- `banner_votes.json`
- `genshin_characters.json`

---

## 12. C6

XP synchronise aussi les 5★ C6 depuis la box vers `c6_characters.json`.

Lorsqu'un 5★ C6 manque du fichier C6, le script crée une entrée avec :
- owner ;
- characterId ;
- métadonnées personnage ;
- createdAt ;
- stats ;
- contestStats ;
- titles.

### Point de modélisation
Cette synchronisation permanente est un symptôme de la séparation des JSON legacy.

Dans la cible :
- la possession et ses stats C6 doivent être reliées proprement ;
- les métadonnées catalogue ne doivent pas être recopiées inutilement.

---

## 13. Giveaway

XP compte les messages liés au giveaway.

Cela confirme que le giveaway a une composante d'activité passive et ne dépend pas uniquement de `!wish`.

À approfondir pendant l'audit Giveaway/Wish.

---

## 14. Event mensuel

XP :
- charge/crée `monthly_events_data.json` ;
- assure les defaults mensuels ;
- annonce l'event le 1er du mois aux joueurs éligibles ;
- ajoute +1 monnaie événementielle quotidienne au premier message valide si inscrit ;
- affiche les messages sociaux Event en attente ;
- supprime les messages après affichage.

### Architecture cible
À séparer :
- scheduler mensuel ;
- participation event ;
- récompense quotidienne ;
- messagerie event ;
- notification UI.

---

## 15. Concours

XP peut nettoyer/réinitialiser un ancien concours selon les règles de date.

Encore une responsabilité qui n'appartient pas à XP dans la cible.

---

## 16. Liste de responsabilités à extraire dans le futur backend

Proposition de découpage :

### `PlayerService`
- création/provisionnement ;
- profil ;
- élément.

### `ProgressionService`
- XP ;
- niveau ;
- récompenses level-up ;
- overflow niveau 100.

### `ActivityService`
- messages/activité ;
- cooldown de gain ;
- compteurs.

### `DailyRewardService`
- récompense quotidienne.

### `FavorService`
- faveur ;
- récompense quotidienne faveur.

### `BankService`
- solde ;
- intérêt.

### `MissionService`
- missions quotidiennes ;
- longues ;
- Z.

### `BannerService`
- rotation hebdomadaire ;
- featured ;
- votes.

### `ContestService`
- concours ;
- nettoyage.

### `EventService`
- event mensuel.

### `GiveawayService`
- giveaway.

### `CharacterProgressionService`
- C6 ;
- stats concours.

Ce sont des **domaines conceptuels**, pas forcément un fichier/classe chacun.

---

# Décisions/questions à valider avant de figer l'audit XP

## Q1 — Récompense de level-up — ✅ VALIDÉ
Le code réel donne aujourd'hui **800 primos + 10 000 moras par niveau**, puis :
- à partir du niveau 5 : **+80 particules de l'élément principal** ;
- à partir du niveau 10 : **+40 particules d'un autre élément aléatoire**.

### Décision validée
**Conserver ce comportement tel quel pour GachaImpact V1.**

L'objectif de cette phase est de migrer fidèlement le jeu avant de rééquilibrer son économie. Les montants pourront être réévalués plus tard lors d'un audit global de l'économie (coûts des pulls, boutique, banque, missions, récompenses, etc.).

Pour la migration historique, les niveaux, XP, ressources et statistiques déjà acquis sont conservés tels quels : aucun recalcul rétroactif des récompenses de niveau.

## Q2 — Récompense quotidienne — ✅ VALIDÉ

### Décision
Conserver cette mécanique comme **récompense quotidienne permanente** de GachaImpact.

V1 :
- +160 primogemmes ;
- +160 particules de l'élément du joueur ;
- +10 000 moras ;
- reset global à 00:00 `Europe/Paris` ;
- récompense non réclamée = perdue à la fin du jour ;
- aucune accumulation des jours manqués.

Réclamation possible via la même opération métier :
- bouton `Réclamer` dans l'interface ;
- premier message éligible dans le chat GachaImpact ;
- premier message Twitch éligible pour un joueur ayant explicitement rejoint/activé le jeu.

Le niveau 2 ne doit plus servir de garde-fou dans le standalone. Le choix de l'élément devient obligatoire pendant l'onboarding GachaImpact. Côté Twitch, un viewer ordinaire ne doit jamais être enrôlé/pingé passivement ; l'entrée dans le jeu doit être explicite, avec `!element` comme base legacy à conserver/adapter.

Le bloc en bas à gauche évoluera plus tard vers un **suivi des quotidiennes** parcourable (précédent/suivant), avec masquage pour la journée et préférences d'affichage.

Feedback de claim :
mise à jour des compteurs + animation temporaire des gains près des ressources.

Historique spécifique :
- conserver la dernière réclamation ;
- conserver la première réclamation à partir de la nouvelle implémentation ;
- ne pas créer un historique quotidien dédié complet.

Roadmap :
- streak de 7 jours avec bonus envisagé ;
- calendriers de connexion événementiels envisagés.

## Q3 — Intérêt bancaire
Souhaites-tu conserver le +3% quotidien ?
Si oui, recommandation : calcul serveur par date, plus du tout dépendant du premier message.

## Q4 — XP dans GachaImpact
Twitch ne sera plus obligatoire. Il faut donc décider plus tard quelles activités GachaImpact donnent de l'XP.
Recommandation provisoire :
- conserver les messages du chat interne comme source possible ;
- mais ne pas lier toute la progression du jeu uniquement au chat.

## Q5 — Onboarding élément — 🟡 DIRECTION DÉJÀ CADRÉE
Une décision directement liée à Q2 est déjà actée :
- dans l'application GachaImpact, le choix de l'élément sera une étape obligatoire de l'inscription/onboarding ;
- le nouveau joueur standalone ne doit donc pas être bloqué derrière un niveau 2 avant d'accéder aux systèmes dépendant de l'élément ;
- côté Twitch, les viewers ordinaires ne doivent plus devenir des joueurs actifs simplement parce qu'ils écrivent un message.

Restent à définir lors de la spécification Auth/Onboarding/Twitch :
- niveau de départ exact ;
- moment précis où le compte est considéré comme complètement créé ;
- fonctionnement d'un joueur Twitch-only avant liaison éventuelle avec un compte GachaImpact ;
- mécanisme final d'opt-in Twitch autour de `!element`.
