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

## 6. Premier message valide du jour

Conditions :
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

### À décider
Dans GachaImpact standalone, “premier message Twitch du jour” n'est plus un trigger universel acceptable.

Il faudra décider si cette récompense devient :
- récompense de connexion quotidienne ;
- récompense réclamable dans l'UI ;
- premier message du chat GachaImpact ;
- ou autre mécanisme.

---

## 7. Faveur — récompense quotidienne

Si `favor.daysRemaining > 0` et conditions respectées :
- +800 primogemmes ;
- décrémente `daysRemaining` de 1 ;
- stocke `lastClaimDate`.

La date d'obtention empêche également une réclamation le jour même de l'activation selon le code.

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

## Q2 — Premier message quotidien
Dans le standalone, faut-il transformer cette récompense en **récompense de connexion quotidienne / bouton Réclamer** ?
C'est cohérent avec l'UI actuelle qui possède déjà “Récompense quotidienne”.

## Q3 — Intérêt bancaire
Souhaites-tu conserver le +3% quotidien ?
Si oui, recommandation : calcul serveur par date, plus du tout dépendant du premier message.

## Q4 — XP dans GachaImpact
Twitch ne sera plus obligatoire. Il faut donc décider plus tard quelles activités GachaImpact donnent de l'XP.
Recommandation provisoire :
- conserver les messages du chat interne comme source possible ;
- mais ne pas lier toute la progression du jeu uniquement au chat.

## Q5 — Onboarding élément
Recommandation : lors de la création du compte, le joueur commence niveau 0/1 puis l'UI lui demande obligatoirement son élément au moment approprié, plutôt que reproduire le blocage silencieux legacy.

À valider lors de la spécification Auth/Onboarding.
