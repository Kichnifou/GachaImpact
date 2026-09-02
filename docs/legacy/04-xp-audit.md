# 04 — Audit legacy : XP / cycle de vie joueur

Statut : AUDIT TECHNIQUE INITIAL CLÔTURÉ — Q1 À Q9 TRAITÉS ; RESPONSABILITÉS HORS XP REPORTÉES AUX AUDITS DÉDIÉS 
Date : 2026-08-27  
Source : `legacy/streamerbot/commands/XP.txt`

## Statut de clôture — ✅ CLÔTURÉ le 2026-08-27

Le cœur métier XP / cycle de vie joueur a été audité et les décisions nécessaires à la V1 ont été prises.

Les responsabilités étrangères au domaine XP découvertes dans `XP.txt` ne sont pas supprimées ni ignorées. Elles sont reportées vers leurs audits dédiés :
- Faveur ;
- Banque ;
- Missions ;
- échanges ;
- Gacha / bannière / votes ;
- C6 / Concours ;
- Giveaway ;
- Events.

Le futur backend ne doit donc pas reproduire `XP.txt` comme un orchestrateur monolithique.

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
Il faut distinguer **compte GachaImpact standalone** et **présence Twitch enregistrée**.

- Un vrai compte GachaImpact standalone est créé par l'authentification GachaImpact, puis ses sous-domaines sont initialisés via un service central de création/provisionnement.
- Côté Twitch, le comportement d'entrée historique est conservé : lorsqu'une personne parle pour la première fois, le système crée/enregistre son profil Twitch legacy comme aujourd'hui.
- Cet enregistrement passif ne signifie pas que la personne a terminé l'onboarding ni qu'elle doit être sollicitée en permanence par le jeu.
- Le viewer Twitch peut progresser par ses messages jusqu'au seuil d'onboarding prévu ; la direction produit validée est de conserver le passage jusqu'au niveau 2, puis de demander le choix d'un élément.
- Tant que l'élément n'a pas été choisi, les mécaniques actives du jeu restent bloquées pour ce profil Twitch, en dehors de ce qui est nécessaire pour terminer l'onboarding.

Le modèle technique exact permettant de distinguer un profil Twitch-only d'un compte GachaImpact complet sera figé pendant l'audit Auth/Twitch.

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

### Décisions cibles — ✅ VALIDÉES le 2026-08-27

Les deux compteurs historiques sont conservés, mais leur sémantique future est explicitement définie.

#### `stats.totalMessages`

Migration :
- conserver la valeur legacy existante telle quelle ;
- ne pas tenter de la recalculer rétroactivement.

Dans GachaImpact :
- incrémenter pour chaque vrai message envoyé par le joueur dans le chat interne ou sur Twitch ;
- une commande envoyée par le joueur compte bien comme un message dans `totalMessages` ;
- les réponses automatiques du jeu, messages bot et notifications système ne doivent pas augmenter le compteur personnel du joueur.

#### `stats.countedMessages`

Migration :
- conserver la valeur legacy existante telle quelle ;
- ne pas tenter de la recalculer rétroactivement.

Dans GachaImpact :
- incrémenter uniquement lorsqu'un message donne réellement de l'XP ;
- un message Twitch éligible donnant +1/+2/+3 XP ajoute +1 à `countedMessages` ;
- un message du chat interne éligible donnant +1/+2/+3 XP ajoute +1 à `countedMessages` ;
- une commande ne l'incrémente pas ;
- un message refusé par le cooldown XP ne l'incrémente pas ;
- l'XP gagnée via le futur mode XP de l'interface ne l'incrémente pas, puisqu'il ne s'agit pas d'un message.

Les futures mécaniques utilisant une statistique « nombre de messages comptés », notamment certaines missions, pourront continuer à s'appuyer sur ce compteur si leur audit dédié confirme cette règle.

#### Cooldown XP multi-canaux

Le cooldown de **2 secondes** appartient au joueur et au système XP, pas à chaque canal séparément.

Pour un même joueur/profil résolu :
- Twitch et chat interne GachaImpact partagent donc le même cooldown XP ;
- alterner rapidement entre Twitch et le chat interne ne permet pas de contourner le cooldown.

La manière exacte d'unifier un profil Twitch-only avec un compte GachaImpact lié sera définie plus tard dans la spécification Auth/Twitch.

### Dates d'activité / XP legacy

`XP.txt` utilise notamment les champs suivants :

- `dates.firstSeen` : date de première création/enregistrement connu du viewer ;
- `dates.lastSeen` : mis à jour à chaque message traité par le script ;
- `dates.lastXpDate` : mis à jour lorsqu'un message donne réellement de l'XP ;
- `dates.lastMessageTime` : malgré son nom, correspond au dernier message ayant réellement donné de l'XP et sert au cooldown XP ;
- `dates.lastDailyFirstMessageReward` : dernière récompense quotidienne legacy obtenue.

Le legacy écrit ces timestamps avec `DateTime.Now`, sans information de fuseau intégrée dans la chaîne.

### Décisions cibles dates — ✅ VALIDÉES le 2026-08-27

Migration :
- conserver toutes les dates legacy existantes telles qu'elles sont connues ;
- ne pas inventer une date manquante ;
- ne pas recalculer rétroactivement les anciennes dates ;
- interpréter les timestamps legacy sans fuseau comme étant en **`Europe/Paris`**, le PC Streamer.bot historique étant configuré sur l'heure française.

Identité :
- `firstSeen` Twitch/legacy reste une information historique distincte de la date de création du futur compte GachaImpact ;
- une création de compte GachaImpact ne doit jamais écraser ou remplacer le premier `firstSeen` Twitch connu.

`lastSeen` :
- conserver la valeur legacy à la migration comme dernière activité Twitch/legacy connue ;
- ne jamais l'utiliser comme preuve d'une session standalone en ligne ;
- distinguer session connectée, activité récente de l'application, dernière activité de jeu, dernier message interne et dernier message Twitch ;
- la présence standalone utilise En ligne/Absent/Hors ligne ;
- la dernière activité exposée est soumise au réglage Public/Amis/Privé défini par Social R462/R463.

`lastMessageTime` :
- le nom legacy est trompeur ;
- dans le futur système XP, utiliser conceptuellement un état du type `lastXpMessageAt` ;
- il représente le dernier message ayant réellement accordé de l'XP ;
- il est commun entre Twitch et le chat interne pour appliquer le cooldown global de 2 secondes ;
- le futur mode XP de l'interface ne le modifie pas.

`lastXpDate` :
- doit représenter dans le futur la dernière fois où le joueur a réellement gagné de l'XP, quelle que soit la source ;
- XP via Twitch, chat interne ou futur mode XP interface mettent donc à jour cette information ;
- le choix exact entre date ou timestamp sera figé lors de la conception du modèle cible.

---

## 3. Niveau

Constantes :
- 30 XP par niveau ;
- niveau max 100.

Le niveau est calculé à partir de l'XP.

### Blocage élément
Une fois niveau 1 atteint, l'XP est bloquée tant que le joueur n'a pas choisi d'élément.

Cela sert actuellement de tutoriel/porte d'entrée vers `!element`.

### Décision cible — ✅ VALIDÉE le 2026-08-27

Dans GachaImpact standalone, le choix de l'élément est une étape obligatoire de l'inscription/onboarding.

Le joueur possède donc déjà un élément lorsqu'il se trouve au niveau 1, et le verrou legacy « niveau 1 sans élément » ne s'applique pas au parcours standalone.

### Tutoriels de montée de niveau — comportement legacy

`XP.txt` possède également une progression tutorielle envoyée lors des niveaux 1 à 10 :

- niveau 1 : `!element` ;
- niveau 2 : `!pity` ;
- niveau 3 : `!sac` ;
- niveau 4 : `!box` et ses tris ;
- niveau 5 : découverte des particules et `!convertir` ;
- niveau 6 : `!team` et les passifs ;
- niveau 7 : `!shop` ;
- niveau 8 : `!top` ;
- niveau 9 : `!obtention` ;
- niveau 10 : particules des autres éléments et `!echanger`.

Ces messages tutoriels ne suffisent pas à prouver à eux seuls que toutes ces fonctionnalités sont réellement verrouillées par ces niveaux. Les éventuels prérequis métier seront confirmés pendant l'audit des scripts concernés.

### Décision cible tutoriels — ✅ VALIDÉE le 2026-08-27

Conserver le principe de découverte progressive lors des montées de niveau, mais adapter la présentation au canal ayant provoqué le gain d'XP.

Si la montée de niveau est provoquée par de l'XP gagnée via un message :
- conserver un tutoriel/conseil envoyé dans le canal de chat concerné ;
- Twitch peut présenter les commandes adaptées à Twitch ;
- le chat interne GachaImpact peut présenter les commandes ou accès adaptés au jeu.

Si la montée de niveau est provoquée par l'XP du futur mode dédié de l'interface :
- ne pas envoyer artificiellement un message de chat ;
- créer une notification dans la zone **Notifications** en haut à droite de l'interface ;
- la notification indique la fonctionnalité à découvrir et oriente le joueur vers l'écran correspondant.

La progression tutorielle reste donc commune, tandis que son rendu dépend du contexte ayant déclenché la montée de niveau.

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

### Franchissement de plusieurs niveaux en une seule attribution d'XP

Le code legacy sait déjà traiter un gain d'XP suffisamment important pour franchir plusieurs niveaux :
- `newLevel` est recalculé depuis l'XP totale ;
- le script boucle de `oldLevel + 1` jusqu'à `newLevel` ;
- `GiveLevelRewards` est exécuté pour chaque niveau traversé ;
- les tutoriels sont également parcourus pour chaque niveau franchi.

Limite d'affichage legacy :
le message principal de level-up n'affiche actuellement que les informations de récompense du dernier niveau atteint, même si plusieurs récompenses ont réellement été accordées.

### Décision cible — ✅ VALIDÉE le 2026-08-27

Un gain d'XP important, notamment via le futur mode XP de l'interface, peut faire franchir plusieurs niveaux en une seule opération.

Dans ce cas :
- toutes les récompenses intermédiaires doivent être attribuées ;
- aucune récompense de niveau traversé ne doit être perdue ;
- toutes les découvertes/tutoriels concernés restent déclenchés ;
- l'interface doit rendre clairement visible le nombre de niveaux gagnés et les récompenses correspondantes.

Pour une montée via le futur mode XP interface :
- une notification peut être ajoutée à la liste Notifications pour chaque niveau franchi ;
- plusieurs niveaux gagnés peuvent donc produire plusieurs notifications successives ;
- ces notifications utilisent le système de notifications déjà prévu dans la coque frontend.

L'attribution XP, le calcul des niveaux, les récompenses et l'état de progression associé devront être traités de manière atomique côté serveur afin d'éviter les doubles gains lors d'un retry ou d'une requête répétée.

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

### État d'overflow

Le champ legacy :

`stats.level100OverflowRewardsClaimed`

sert à distinguer :
- le nombre de paliers d'overflow théoriquement atteints d'après l'XP totale ;
- le nombre de paliers déjà effectivement récompensés.

Cette information est indispensable pour éviter de redonner des récompenses historiques après une migration ou une reconnexion.

### Décisions cibles — ✅ VALIDÉES le 2026-08-27

- conserver exactement la valeur legacy de `level100OverflowRewardsClaimed` lors de la migration ;
- le futur modèle peut renommer ou représenter différemment cette information, mais doit préserver un état métier équivalent ;
- si plusieurs paliers d'overflow sont franchis en une seule attribution d'XP, toutes les récompenses correspondantes sont données ;
- l'interface doit indiquer clairement qu'il y a eu plusieurs récompenses de niveau maximum, par exemple via une multiplicité explicite ou plusieurs entrées adaptées dans le système de notifications ;
- le niveau reste plafonné à 100 pour la V1 actuelle.

Idée future uniquement :
- permettre éventuellement un jour de dépasser réellement le niveau 100 ;
- cette idée n'est pas une modification de la V1 et ne doit pas être implémentée maintenant.

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

### Twitch : enregistrement passif conservé, activation du jeu verrouillée par l'élément

Le fonctionnement Twitch ne doit pas être confondu avec l'onboarding standalone.

Direction validée :
- dans l'application GachaImpact, le **choix de l'élément fait partie de l'inscription/onboarding obligatoire** ;
- un compte standalone réellement créé possède donc déjà son élément et peut utiliser le jeu dès le niveau 1, sans attendre le niveau 2 ;
- côté Twitch, lorsqu'une personne parle pour la première fois, elle doit continuer à être **enregistrée dans le jeu comme aujourd'hui** ;
- cette personne peut gagner l'XP de chat et progresser jusqu'au seuil d'onboarding ; la direction produit est de conserver le passage jusqu'au **niveau 2** ;
- à ce stade, si elle n'a pas encore choisi d'élément, le jeu lui demande de le faire ;
- tant que l'élément n'est pas choisi, **plus aucune progression/mécanique active ne doit se déclencher pour elle**, hors ce qui est nécessaire au choix de l'élément ;
- `!element <élément>` reste la porte d'activation naturelle du joueur Twitch ;
- une personne Twitch déjà dotée d'un élément est éligible aux mécaniques quotidiennes Twitch, sous réserve des autres règles du système ;
- le modèle exact d'identité et de liaison d'un joueur Twitch-only avec un compte GachaImpact sera figé pendant l'audit Auth/Twitch.

Cette décision conserve le comportement communautaire historique sans transformer immédiatement chaque chatter en joueur pleinement actif.

### UI — le rectangle devient un suivi des activités quotidiennes

Le bloc actuellement intitulé `RÉCOMPENSE QUOTIDIENNE`, en bas à gauche de l'interface, est destiné à évoluer vers un **suivi quotidien général**.

Principes validés :
- la récompense quotidienne est l'un des éléments pouvant être affichés dans ce bloc ;
- après sa réclamation, elle quitte l'élément actuellement proposé et laisse la place à une autre activité quotidienne ;
- exemples d'autres activités : combat quotidien, roue, etc. ;
- un ordre/priorité d'affichage sera défini plus tard ;
- le joueur pourra parcourir les activités visibles avec de petits boutons **chevron gauche / chevron droit** (`‹` / `›`) sans être obligé d'accomplir l'activité courante pour voir les suivantes ; les libellés « Précédent » / « Suivant » ne seront pas affichés dans cette petite carte afin de ne pas la surcharger ;
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

### Décision cible — ✅ VALIDÉE le 2026-08-27

Pour GachaImpact V1 :
- conserver le taux historique de **3 % par jour** ;
- l'intérêt devient une mécanique **automatique côté serveur** et ne dépend plus d'un message, d'une connexion ou d'une autre action du joueur ;
- le calcul est exécuté lors du reset quotidien global à **00:00 dans le fuseau `Europe/Paris`** ;
- la base de calcul est le nombre de Moras présentes dans la banque exactement au moment de ce reset ;
- l'intérêt est arrondi à l'entier inférieur, comme dans le legacy ;
- l'intérêt obtenu est ajouté au solde `bank.moras` et continue également à alimenter l'équivalent futur de `stats.totalMorasEarned`.

Conséquence volontaire par rapport au legacy :
un joueur absent continue à recevoir automatiquement ses intérêts quotidiens, puisque le serveur exécute désormais lui-même la mécanique chaque jour.

Cette décision illustre un principe d'architecture cible plus général : lorsqu'une mécanique dépend uniquement du temps serveur, elle ne doit plus être artificiellement déclenchée par une action du joueur comme c'était souvent nécessaire dans Streamer.bot.

La logique d'intérêt devra donc appartenir au domaine Banque / scheduler serveur, et non au futur service XP.

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
- premier message Twitch éligible pour un joueur Twitch ayant déjà choisi son élément.

Le niveau 2 ne doit plus servir de garde-fou dans le standalone : le choix de l'élément devient obligatoire pendant l'onboarding GachaImpact. Côté Twitch, l'enregistrement passif au premier message est conservé : le viewer peut progresser par le chat jusqu'au seuil d'onboarding (direction validée : niveau 2), puis le jeu lui demande de choisir son élément. Tant que cet élément n'est pas choisi, les mécaniques actives restent bloquées.

Le bloc en bas à gauche évoluera plus tard vers un **suivi des quotidiennes** parcourable avec des chevrons `‹` / `›`, sans libellés textuels visibles, avec masquage pour la journée et préférences d'affichage.

Feedback de claim :
mise à jour des compteurs + animation temporaire des gains près des ressources.

Historique spécifique :
- conserver la dernière réclamation ;
- conserver la première réclamation à partir de la nouvelle implémentation ;
- ne pas créer un historique quotidien dédié complet.

Roadmap :
- streak de 7 jours avec bonus envisagé ;
- calendriers de connexion événementiels envisagés.

## Q3 — Intérêt bancaire — ✅ VALIDÉ

### Décision

Pour GachaImpact V1 :
- conserver **+3 % d'intérêt bancaire par jour** ;
- calcul automatique côté serveur au reset global de **00:00 `Europe/Paris`** ;
- aucune connexion, aucun message et aucune autre action joueur ne sont nécessaires pour déclencher l'intérêt ;
- base de calcul = solde présent dans la banque exactement au moment du reset ;
- arrondi à l'entier inférieur ;
- intérêt ajouté au solde bancaire ;
- intérêt également comptabilisé dans l'équivalent futur de `stats.totalMorasEarned`.

Contrairement au legacy, un joueur absent reçoit donc quand même ses intérêts chaque jour.

La mécanique doit être retirée du futur domaine XP et confiée au domaine Banque / scheduler serveur.

## Q4 — XP dans GachaImpact — ✅ VALIDÉ

### XP gagnée par discussion

Le système historique de gain d'XP par messages est conservé :
- message éligible jusqu'à 100 caractères : **+1 XP** ;
- 101 à 200 caractères : **+2 XP** ;
- plus de 200 caractères : **+3 XP** ;
- cooldown de gain d'XP : **2 secondes** ;
- une commande ne donne pas d'XP simplement parce qu'elle est envoyée sous forme de message.

Cette logique pourra s'appliquer aux messages éligibles du chat interne GachaImpact et de Twitch.

### Actions ordinaires du jeu

Les actions métier ordinaires ne donnent **pas directement d'XP**, quel que soit leur canal de déclenchement.

Exemples :
- Invocation / Pull ;
- Combat ;
- Expédition ;
- Banque ;
- récompenses quotidiennes ;
- Boutique ;
- autres mécaniques normales du jeu.

Ainsi, exécuter une même action via l'interface, le chat interne ou Twitch ne nécessite pas de créer une récompense XP différente selon son canal.

### Progression XP pour les joueurs utilisant principalement l'interface

GachaImpact standalone disposera d'une **activité ou d'un mode dédié au gain d'XP**, afin qu'un joueur puisse progresser normalement sans être obligé d'écrire dans le chat.

Direction retenue :
- activité accessible depuis l'interface ;
- probablement composée de petits mini-jeux / épreuves rapides ;
- quantité maximale d'XP gagnable par ce mode chaque jour ;
- le nom du mode, les mini-jeux exacts, le plafond quotidien et l'équilibrage restent à concevoir plus tard.

### Cumul des sources

Le gain d'XP par chat et le gain d'XP via le futur mode dédié sont **cumulables**.

Un joueur utilisant à la fois le chat et le mode XP peut donc progresser par les deux sources.

Cette décision permet :
- de conserver le fonctionnement historique pour les joueurs Twitch/chat ;
- de permettre une progression complète aux joueurs utilisant principalement l'interface ;
- d'éviter d'ajouter artificiellement une récompense XP à chaque mécanique du jeu.

## Q5 — Onboarding élément — ✅ PRINCIPE VALIDÉ

Une décision directement liée à Q2 est déjà actée :
- dans l'application GachaImpact, le choix de l'élément sera une étape obligatoire de l'inscription/onboarding ;
- le joueur possède donc déjà un élément lorsqu'il se trouve au niveau 1 ;
- le verrou legacy « niveau 1 sans élément » ne s'applique pas au parcours standalone ;
- le nouveau joueur standalone ne doit donc pas être bloqué derrière un niveau 2 avant d'accéder aux systèmes dépendant de l'élément ;
- côté Twitch, un nouveau chatter continue à être enregistré automatiquement comme aujourd'hui ;
- il peut progresser par ses messages jusqu'au seuil d'onboarding (direction validée : niveau 2) ;
- à partir de ce seuil, le jeu lui demande de choisir un élément et les mécaniques actives restent bloquées tant qu'il ne l'a pas fait ;
- `!element` reste la porte d'activation naturelle du profil Twitch.

Restent à définir lors de la spécification Auth/Onboarding/Twitch :
- niveau de départ exact du compte standalone ;
- moment précis où le compte standalone est considéré comme complètement créé ;
- représentation technique d'un profil Twitch-only avant liaison éventuelle avec un compte GachaImpact ;
- règles exactes de notifications/pings d'onboarding Twitch pour éviter le spam ;
- comportement de liaison lorsqu'un profil Twitch existant est rattaché ultérieurement à un compte GachaImpact.

## Q6 — Tutoriels de montée de niveau — ✅ VALIDÉ

La progression tutorielle par niveaux est conservée, mais son rendu dépend de la source de l'XP ayant provoqué la montée de niveau.

### Montée de niveau via un message

Si le niveau est gagné grâce à l'XP provenant d'un message Twitch ou du chat interne GachaImpact :
- le tutoriel reste présenté dans le chat ;
- le contenu est adapté au canal et à la fonctionnalité concernée ;
- le principe historique de découverte progressive est conservé.

### Montée de niveau via le mode XP de l'interface

Si le niveau est gagné grâce au futur mode XP dédié à l'interface :
- une notification est créée dans la zone Notifications en haut à droite ;
- elle présente la fonctionnalité à découvrir ;
- elle indique/oriente vers l'écran concerné.

Les niveaux historiques 1 à 10 servent de base à cette progression tutorielle.

Les éventuels vrais déblocages de mécaniques à certains niveaux ne sont pas déduits des messages tutoriels : ils seront confirmés lors de l'audit des domaines concernés.

## Q7 — Compteurs de messages et cooldown multi-canaux — ✅ VALIDÉ

### Migration

Conserver les valeurs historiques existantes de :
- `stats.totalMessages` ;
- `stats.countedMessages`.

Aucun recalcul rétroactif.

### `totalMessages`

Dans GachaImpact :
- compte les vrais messages envoyés par le joueur sur Twitch ou dans le chat interne ;
- les commandes envoyées par le joueur sont incluses ;
- les réponses automatiques, messages bot et notifications système ne sont pas inclus.

### `countedMessages`

Dans GachaImpact :
- augmente uniquement lorsqu'un message donne réellement de l'XP ;
- fonctionne aussi bien pour Twitch que pour le chat interne ;
- une commande ne compte pas ;
- un message bloqué par le cooldown ne compte pas ;
- l'XP obtenue via le futur mode XP de l'interface ne compte pas comme message.

### Cooldown

Le cooldown XP de **2 secondes est global au joueur** entre Twitch et le chat interne GachaImpact.

Il ne doit donc pas être possible de contourner le cooldown en alternant les deux canaux.

## Q8 — Dates et activité joueur — ✅ VALIDÉ

### Conservation historique

Toutes les dates legacy existantes sont conservées à la migration :
- aucune date connue n'est supprimée ;
- aucune date absente n'est inventée ;
- aucun recalcul rétroactif.

Les timestamps legacy sans information de fuseau sont interprétés comme `Europe/Paris`, correspondant au fuseau du PC Streamer.bot historique.

### `firstSeen`

La première présence Twitch/legacy et la création du compte GachaImpact sont deux événements différents.

Le futur modèle doit donc pouvoir distinguer conceptuellement :
- première présence connue dans le legacy/Twitch ;
- date de création du compte GachaImpact.

### `lastSeen`

La valeur legacy est conservée.

La définition du futur « dernier vu / dernière activité » est reportée aux domaines Compte / Social / Présence afin de ne pas mélanger :
- connexion au jeu ;
- présence en ligne ;
- activité de jeu ;
- message Twitch ;
- message du chat interne.

### `lastMessageTime`

Le nom legacy est trompeur.

Dans le futur système XP, il correspond conceptuellement à un état du type `lastXpMessageAt` :
- dernier message ayant réellement accordé de l'XP ;
- partagé entre Twitch et chat interne ;
- utilisé pour le cooldown global de 2 secondes ;
- non modifié par le futur mode XP de l'interface.

### `lastXpDate`

Dans le futur, cette information représente la dernière fois où le joueur a gagné de l'XP, quelle que soit la source :
- Twitch ;
- chat interne ;
- futur mode XP interface.

Le format DB exact sera défini pendant le modèle cible.

## Q9 — Source de vérité XP / niveaux multiples — ✅ VALIDÉ

### XP comme source de vérité

L'XP cumulée est la source de vérité métier de la progression joueur.

Pour la V1 actuelle :

`niveau = min(floor(xp / 30), 100)`

Le niveau ne doit pas être une progression indépendante pouvant diverger arbitrairement de l'XP.

Pendant la migration :
- importer l'XP legacy telle quelle ;
- conserver également les données historiques nécessaires ;
- comparer le niveau legacy avec le niveau attendu depuis l'XP ;
- en cas d'incohérence, la signaler dans le rapport de migration ;
- ne pas corriger silencieusement une incohérence historique.

Le choix final consistant à stocker matériellement `level` en DB ou à le dériver sera décidé pendant la conception du modèle cible.

### Overflow niveau 100

Conserver l'état historique `level100OverflowRewardsClaimed` ou un équivalent strict afin de ne jamais redonner des récompenses déjà obtenues.

### Gain d'XP franchissant plusieurs paliers

Si une attribution d'XP franchit plusieurs niveaux :
- toutes les récompenses intermédiaires sont accordées ;
- tous les tutoriels/découvertes concernés sont traités ;
- le retour visuel doit montrer clairement les multiples niveaux gagnés.

Le futur mode XP interface peut donc par exemple donner 100 XP et faire franchir plusieurs niveaux d'un coup.

Dans l'interface actuelle, une liste de notifications existe déjà dans la cloche du header. Elle utilise encore des données `mockData` et n'est pas encore reliée à un vrai backend.

Direction future :
- les montées de niveau provoquées par le mode XP pourront alimenter cette vraie liste de notifications ;
- plusieurs niveaux gagnés peuvent produire plusieurs notifications ;
- les données factices actuelles seront remplacées ultérieurement par les notifications réelles du serveur.

Au niveau 100, plusieurs paliers d'overflow gagnés simultanément doivent eux aussi être présentés clairement au joueur.

### XP cumulative

Pour la V1 :
- l'XP ne se dépense pas ;
- l'XP ne se reset pas ;
- elle continue à augmenter après le niveau 100 pour les cycles d'overflow.

Idées futures, non validées pour implémentation immédiate :
- niveau supérieur à 100 ;
- prestige / rebirth.

Ces idées restent en roadmap potentielle et ne modifient pas les règles V1 actuelles.