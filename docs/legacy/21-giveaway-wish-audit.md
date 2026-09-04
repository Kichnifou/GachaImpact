# 21 — Audit Giveaway / Wish

> Domaine 18 de l'audit GachaImpact.  
> Statut : **EN COURS — audit technique initial refait avec `Giveaway.txt`, faisabilité Twitch confirmée, récompenses legacy confirmées à conserver ; premières décisions restantes à reprendre à R702**.  
> Ce document devient la source spécialisée du domaine Giveaway / Wish.  
> L'état global du projet et la prochaine reprise exacte restent la responsabilité du Master.

---

# 1. Objectif du domaine

Auditer puis spécifier le système **Giveaway / Wish**.

Principe fonctionnel confirmé :

1. un administrateur ouvre un Giveaway ;
2. les joueurs éligibles peuvent s'inscrire avec `!wish` ;
3. les messages Twitch écrits pendant la période ouverte sont comptés ;
4. l'administrateur ferme le Giveaway ;
5. un gagnant aléatoire est choisi parmi les participants `!wish` ;
6. un classement séparé est calculé selon le nombre de messages Twitch ;
7. les récompenses du tirage et du classement sont distribuées.

Le Giveaway reste une mécanique communautaire liée au live Twitch.

Il ne dépend d'aucune Custom Reward / redemption de Points de chaîne.

---

# 2. Sources réelles inspectées

Sources legacy principales :

- `Giveaway.txt` — script fourni par le propriétaire et désormais disponible pour l'audit ;
- `legacy/streamerbot/commands/Wish.txt` ;
- `legacy/streamerbot/commands/XP.txt` ;
- `legacy/streamerbot/data/giveaway.json` ;
- `legacy/streamerbot/data/viewers_data.json`.

Documents recroisés :

- `docs/legacy/04-xp-audit.md` ;
- `docs/legacy/05-element-resources-audit.md` ;
- `docs/legacy/03-command-data-matrix.md` ;
- `docs/master/PROJECT_MASTER_PLAN.md` ;
- `docs/commands/command-reference.md` ;
- `docs/specifications/decisions-log.md`.

Documentation Twitch vérifiée :

- EventSub `channel.chat.message` ;
- authentification / scopes nécessaires à la lecture du chat.

Le vrai code est utilisé comme source de vérité lorsque le header est incomplet ou contradictoire.

---

# 3. `Giveaway.txt` réel — commandes disponibles

Le script gère :

- `!giveaway`
- `!giveaway open`
- `!giveaway close`
- `!giveaway stats`
- `!giveaway reroll`

Alias réellement acceptés :

- `open` / `ouvrir`
- `close` / `fermer`
- `stats` / `stat`

`!giveaway` sans argument affiche l'aide.

Syntaxe recommandée cible à conserver dans les helpers :

- `!giveaway open`
- `!giveaway close`
- `!giveaway stats`
- `!giveaway reroll`

Les alias historiques peuvent rester techniquement acceptés s'ils n'introduisent aucune ambiguïté, mais les helpers n'ont pas besoin de tous les exposer.

---

# 4. Permission legacy : le script ne contrôle pas lui-même le rôle

Le header décrit `!giveaway` comme une commande streamer/modérateur.

Mais le code de `Giveaway.txt` ne vérifie pas :

- broadcaster ;
- modérateur ;
- pseudo `kichnifou` ;
- rôle interne.

La restriction était donc nécessairement assurée hors du script, par la configuration Streamer.bot / trigger.

Cible :

- ne jamais reproduire cette dépendance implicite ;
- `open`, `close`, `reroll` et les actions administratives doivent vérifier un rôle Admin/Modérateur côté serveur ;
- Twitch User ID est résolu vers l'identité autorisée ;
- aucun pseudo codé en dur ne constitue une permission.

Cette correction est technique.

---

# 5. `!giveaway open` legacy

`OpenGiveaway()` crée un **nouvel objet Giveaway par défaut** puis écrit :

- `status = open`
- `openedBy`
- `openedAt`
- `participants = []`
- `messageCounts = {}`
- `chatRewardsDistributed = false`

Puis annonce :

`Utilisez !wish pour tenter votre chance de remporter 1600 primos à la fin du live.`

Point important :

**le code ne vérifie pas qu'un Giveaway est déjà ouvert.**

Relancer `!giveaway open` pendant une session active écrase donc silencieusement :

- les participants ;
- les compteurs de messages ;
- l'état de distribution.

Cible technique :

- refuser `open` si une session est déjà ouverte ;
- ne jamais détruire silencieusement une session active ;
- un nouveau Giveaway possède sa propre identité/session.

---

# 6. `!wish` legacy

`Wish.txt` gère l'inscription au Giveaway courant.

Conditions :

- `giveaway.json` existe et est lisible ;
- `status == open` ;
- profil joueur existant ;
- niveau legacy >= 2 ;
- le joueur n'est pas déjà participant.

Le script ajoute :

- username normalisé dans `participants` ;
- `participantCount` ;
- `lastParticipant` ;
- `lastWishAt`.

Il envoie ensuite une phrase de confirmation aléatoire.

Aucune récompense n'est distribuée au moment de `!wish`.

---

# 7. Activation Twitch : remplacer le seuil niveau 2 par l'élément

Le seuil legacy `niveau >= 2` apparaît dans :

- `Wish.txt` ;
- sélection du gagnant dans `Giveaway.txt` ;
- classement de chat dans `Giveaway.txt` ;
- comptage de messages dans `XP.txt`.

La règle transversale GachaImpact désormais acquise est :

**élément choisi = profil Twitch activé.**

Pour la cible :

- supprimer les seuils artificiels `niveau >= 2` lorsqu'ils servent uniquement à reconnaître un joueur activé ;
- exiger à la place un joueur existant avec élément choisi ;
- le standalone satisfait naturellement cette règle après onboarding.

Le Giveaway n'a donc pas besoin d'une règle d'onboarding particulière.

---

# 8. Une seule participation au tirage

`Wish.txt` vérifie qu'un username n'est pas déjà présent dans `participants`.

Cible :

**une participation maximum par joueur et par session Giveaway.**

Unicité conceptuelle :

`giveawaySession + player`

Double commande / retry / concurrence ne doivent jamais créer deux tickets.

---

# 9. Population du tirage et population du classement sont distinctes

Le snapshot `giveaway.json` confirme :

- 9 joueurs dans `participants` ;
- davantage de joueurs dans `messageCounts`.

Des joueurs peuvent donc :

- ne jamais taper `!wish` ;
- écrire pendant le Giveaway ;
- apparaître dans le classement d'activité ;
- recevoir une récompense de chat s'ils sont éligibles.

Conclusion :

## Tirage

Population = joueurs inscrits avec `!wish`.

## Classement chat

Population = joueurs éligibles ayant écrit pendant la session.

La V1 ne doit pas fusionner ces deux ensembles.

---

# 10. Comptage des messages legacy — comportement exact

`XP.txt` appelle `TryCountGiveawayMessage(...)` avant le filtrage XP principal.

Le vrai code du comptage vérifie :

- viewer non null ;
- username différent de `kichnifou` ;
- niveau legacy >= 2 ;
- message non vide ;
- `giveaway.json` présent ;
- `status == open`.

Puis :

`messageCounts[username] += 1`

Point important :

**le comptage Giveaway ne vérifie ni `IsCommand(message)` ni `IsSystemMessage(message)`.**

Donc dans le legacy :

- `!wish` compte comme un message ;
- `!box` compte comme un message ;
- toute autre commande non vide compte ;
- les messages ne donnant pas d'XP peuvent quand même compter ;
- il n'existe aucun cooldown de comptage Giveaway.

L'exclusion de `kichnifou` servait notamment à éviter de compter les messages du bot Streamer.bot envoyés sous le même pseudo.

Cette réalité corrige l'hypothèse de l'audit précédent.

---

# 11. Le comptage Giveaway n'appartient pas à XP

Le comptage se trouve actuellement dans `XP.txt` uniquement pour profiter du trigger « nouveau message ».

La cible doit déplacer cette responsabilité.

Architecture conceptuelle :

```text
Twitch EventSub channel.chat.message
        |
        v
    TwitchBridge
        |
        +--> Activity / XP
        |
        +--> CommandRouter
        |
        +--> GiveawayService.RecordMessage(...)
```

Giveaway décide lui-même si le message compte.

XP n'écrit plus `messageCounts`.

---

# 12. Faisabilité Twitch sans Streamer.bot — CONFIRMÉE

Twitch expose EventSub :

`channel.chat.message`

L'événement fournit notamment :

- `chatter_user_id`
- `chatter_user_login`
- `chatter_user_name`
- `message_id`
- texte du message

Cela permet de :

- identifier le chatter via Twitch User ID ;
- résoudre le joueur interne ;
- détecter les commandes ;
- compter les messages pendant le Giveaway ouvert ;
- dédupliquer une éventuelle redelivery via `message_id`.

Le Giveaway est donc totalement reproductible sans Streamer.bot.

---

# 13. Authentification Twitch pour le chat

Pour `channel.chat.message`, Twitch demande actuellement au minimum le scope :

`user:read:chat`

Selon l'architecture choisie pour le bot/cloud chatbot, des autorisations supplémentaires peuvent être nécessaires, notamment :

- `user:bot`
- `channel:bot`

ou un statut modérateur adapté.

Ce branchement appartient au futur `TwitchBridge` général.

Giveaway ne doit jamais développer son propre client Twitch indépendant.

---

# 14. `!giveaway open/close/stats/reroll` sans Streamer.bot

Puisque le TwitchBridge reçoit les messages Twitch, le `CommandRouter` peut reconnaître :

- `!giveaway open`
- `!giveaway close`
- `!giveaway stats`
- `!giveaway reroll`
- `!wish`

Puis appeler `GiveawayService`.

Aucune Reward Redemption Twitch n'est nécessaire.

---

# 15. `!giveaway close` — déroulement réel

Le vrai `CloseGiveaway()` :

1. charge la session ;
2. exige `status == open` ;
3. charge les viewers ;
4. appelle `GiveChatActivityRewards(...)` ;
5. construit la liste des participants éligibles ;
6. choisit aléatoirement un gagnant si la liste n'est pas vide ;
7. lui donne +1 600 Primogemmes ;
8. met `status = closed` ;
9. écrit `closedBy` / `closedAt` ;
10. sauvegarde viewers + giveaway ;
11. annonce le gagnant ou l'absence de gagnant éligible ;
12. affiche le classement chat.

Contrairement au commentaire d'en-tête :

**le code ne refuse pas réellement la fermeture lorsque `participants` est vide.**

Une session peut donc :

- ne produire aucun gagnant `!wish` ;
- quand même distribuer les récompenses d'activité chat ;
- puis se fermer normalement.

Cette nuance est désormais prouvée.

---

# 16. Récompense du gagnant aléatoire

Constante réelle :

`GiveawayRewardPrimos = 1600`

Le gagnant choisi parmi les participants éligibles reçoit :

**+1 600 Primogemmes**

Le script maintient également :

`stats.totalPrimosEarned`

Le propriétaire a explicitement confirmé qu'il souhaite conserver les récompenses actuelles.

Cette valeur est donc une direction produit déjà acquise pour la V1.

---

# 17. Classement activité réel

`BuildChatRanking(...)` :

- parcourt `messageCounts` ;
- ignore les usernames vides ;
- exclut `kichnifou` ;
- exige un viewer existant ;
- exige niveau legacy >= 2 ;
- ignore les compteurs <= 0 ;
- trie d'abord par nombre de messages décroissant.

En cas d'égalité exacte de messages :

**le legacy trie ensuite par username en ordre alphabétique insensible à la casse.**

Le legacy ne crée donc pas de rang partagé.

Ce comportement devra être explicitement conservé ou adapté.

---

# 18. Récompenses activité chat — comportement exact

`GiveChatActivityRewards(...)` construit le classement puis récompense chaque joueur classé.

Récompenses **totales** :

- rang 1 : **+2 000 particules** de son élément ;
- rang 2 : **+1 500 particules** ;
- rang 3 : **+1 000 particules** ;
- tous les autres joueurs classés : **+500 particules**.

Important :

les Top 3 ne reçoivent pas :

`500 + bonus`

Ils reçoivent directement :

- 2 000 ;
- 1 500 ;
- 1 000.

Le message public final confirme cette lecture.

Le propriétaire a demandé de conserver les récompenses actuelles telles quelles.

---

# 19. Élément nécessaire pour les récompenses de chat

Même si le classement legacy filtre surtout au niveau >=2, `GiveChatActivityRewards()` vérifie ensuite l'élément du joueur.

Si l'élément est vide :

- aucune particule n'est donnée.

Dans la cible, cette incohérence disparaît naturellement grâce à la règle centrale :

**joueur Giveaway éligible = élément choisi.**

Les récompenses passent par le service Ressources central.

`totalMainElementParticlesEarned` doit être mis à jour pour ces gains.

Le legacy `Giveaway.txt` ne maintient pas ce compteur : bug transverse à corriger.

---

# 20. `chatRewardsDistributed`

Le fichier conserve :

`chatRewardsDistributed`

`GiveChatActivityRewards()` quitte immédiatement si ce champ est déjà `true`.

Puis le passe à `true` après traitement.

Ce garde-fou empêche principalement de redistribuer l'activité chat dans le legacy.

Cible :

- ne pas utiliser un simple booléen comme unique protection ;
- la fermeture économique doit être idempotente/transactionnelle ;
- gagnant, récompenses chat et classement final doivent être liés à la même session.

---

# 21. `!giveaway stats`

Comportement réel :

### Giveaway ouvert

Affiche :

- statut ouvert ;
- nombre de participants `!wish` ;
- rappel `!wish`.

### Giveaway fermé avec gagnant

Affiche :

- statut fermé ;
- nombre de participants ;
- dernier gagnant.

### Aucun gagnant

Affiche qu'aucun Giveaway n'est ouvert.

Le script ne montre pas le classement complet dans `stats`.

---

# 22. `!giveaway reroll` — comportement réel important

Le reroll existe réellement.

Il :

- recharge les participants ;
- exige au moins un participant ;
- charge les viewers ;
- lit `previousWinner = giveaway["winner"]` ;
- exclut ce gagnant de la nouvelle sélection ;
- choisit un autre participant éligible ;
- lui donne **à nouveau +1 600 Primogemmes** ;
- remplace `giveaway["winner"]` par le nouveau gagnant ;
- enregistre :
  - `previousWinner`
  - `rerolledAt`
- met / conserve le statut `closed` ;
- annonce le nouveau gagnant.

Points importants :

- le script ne retire jamais les +1 600 du gagnant précédent ;
- le reroll crée donc économiquement **un deuxième paiement**, pas un rollback ;
- le script ne vérifie pas explicitement que le Giveaway est déjà `closed` ;
- le reroll n'appelle pas `GiveChatActivityRewards()` ;
- il ne refait pas le classement.

La sémantique cible du reroll est donc un vrai point produit à décider.

---

# 23. Ouverture destructive : correction cible évidente

Le legacy recrée `CreateDefaultGiveaway()` à chaque `open`.

Cela permet d'effacer une session active par erreur.

La cible doit refuser :

`OpenGiveaway`

si une session est déjà ouverte.

Cette protection ne change pas le gameplay voulu ; elle évite seulement une perte de données accidentelle.

---

# 24. Administration cible

Les actions suivantes sont administratives :

- open ;
- close ;
- reroll.

`stats` peut techniquement être rendu public ou rester Admin selon décision produit.

Les droits sont vérifiés côté serveur.

La cible peut aussi proposer plus tard des boutons Admin dans le standalone qui appellent exactement les mêmes opérations :

- `Ouvrir`
- `Fermer`
- `Reroll`

Mais les joueurs ordinaires ne disposent jamais de ces actions.

---

# 25. Standalone

Le Giveaway repose sur l'activité réelle du chat Twitch.

Donc :

- les messages du chat interne GachaImpact ne doivent pas être injectés artificiellement dans le classement Twitch ;
- le standalone ne remplace pas l'action `!wish` Twitch sans décision explicite ;
- les récompenses modifient néanmoins le même joueur serveur et sont immédiatement visibles dans l'application ;
- le standalone peut éventuellement afficher l'état d'un Giveaway en cours ;
- un panneau Admin peut éventuellement gérer open/close/reroll.

Ces points d'UX restent à décider.

---

# 26. État réel `giveaway.json`

Le snapshot actuel contient notamment :

- `status`
- `openedBy`
- `openedAt`
- `closedBy`
- `closedAt`
- `winner`
- `rewardPrimos`
- `participants`
- `messageCounts`
- `chatRewardsDistributed`
- `participantCount`
- `lastParticipant`
- `lastWishAt`

Le dernier snapshot observé est fermé et prouve l'usage réel du système.

Le script `Giveaway.txt` peut également produire après reroll :

- `previousWinner`
- `rerolledAt`

Ces champs ne sont pas garantis sur toutes les anciennes sessions.

---

# 27. Modèle cible conceptuel

Une session Giveaway native peut conserver :

- `id`
- `status`
- `openedBy`
- `openedAt`
- `closedBy`
- `closedAt`
- participants au tirage ;
- compteurs d'activité chat ;
- gagnant initial ;
- éventuels rerolls / gagnants successifs ;
- classement final ;
- état de distribution ;
- snapshots de récompenses ;
- données d'audit utiles.

Le modèle final DB sera défini en Phase modèle de données.

---

# 28. Atomicité / idempotence

## Inscription `!wish`

Unicité :

`giveawaySession + player`

## Message Twitch

`message_id` EventSub peut servir à empêcher un double comptage si Twitch redélivre un événement.

## Fermeture

Une session ne peut être économiquement fermée qu'une fois.

Le gagnant et le classement doivent être persistés avant que la réponse publique soit considérée définitive.

## Récompenses

Les mutations suivantes doivent être protégées :

- +1 600 Primogemmes gagnant ;
- particules du classement ;
- état de distribution ;
- éventuel reroll.

Un crash/retry ne peut jamais dupliquer un paiement.

---

# 29. Migration

Le legacy conserve surtout la session globale courante / dernière session.

### Si elle est fermée

- migrer comme provenance si utile ;
- ne distribuer aucune récompense ;
- `chatRewardsDistributed = true` doit empêcher toute redistribution ;
- conserver le gagnant connu ;
- conserver `previousWinner` / `rerolledAt` s'ils existent.

### Si elle est ouverte au cutover

Préférer opérationnellement une migration hors Giveaway actif.

Si ce n'est pas possible :

- migrer participants + compteurs ;
- coordonner précisément l'instant de bascule Twitch ;
- ne pas compter deux fois les messages ;
- ne pas reroll automatiquement.

Ne pas inventer un historique complet des Giveaways qui n'existe pas dans les données legacy.

---

# 30. Producteurs / consommateurs cibles

## TwitchBridge

Produit :

- événements de messages ;
- commandes Twitch ;
- identité Twitch stable ;
- message ID.

## GiveawayService

Produit :

- session ;
- inscriptions ;
- compteurs ;
- gagnant ;
- classement ;
- états de fermeture / reroll.

## EconomyService

Applique :

- +1 600 Primogemmes du gagnant.

## ResourceService

Applique :

- +2 000 / +1 500 / +1 000 / +500 particules personnelles.

## Notifications / UI

Peut restituer les gains et l'état du Giveaway selon les décisions produit restantes.

---

# 31. Décisions techniques acquises

Sans consommer de Rxxx :

- le Giveaway est reproductible sans Streamer.bot via `channel.chat.message` ;
- Twitch User ID est la vraie identité externe ;
- le comptage quitte `XP.txt` ;
- les commandes Giveaway sont routées par le CommandRouter ;
- les permissions Admin sont vérifiées côté serveur ;
- un `open` ne peut plus écraser une session déjà ouverte ;
- `!wish` est unique par session/joueur ;
- le filtre legacy niveau >=2 devient la règle centrale `élément choisi` ;
- gagnant `!wish` et classement messages restent deux populations distinctes ;
- les commandes Twitch comptent actuellement comme messages dans le legacy ;
- le legacy ne possède aucun cooldown de message Giveaway ;
- Kichnifou est historiquement exclu du classement/comptage ;
- les égalités legacy sont départagées alphabétiquement ;
- Top 3 = montants totaux 2 000 / 1 500 / 1 000, pas +500 supplémentaires ;
- tous les autres classés reçoivent 500 ;
- récompenses via services économiques centraux ;
- `totalMainElementParticlesEarned` doit être maintenu ;
- fermeture / récompenses / rerolls deviennent reprise-sûrs et idempotents ;
- aucun historique ancien absent n'est inventé.

---

# 32. Directions produit déjà explicitement fournies

Le propriétaire a déjà confirmé vouloir conserver :

- principe `!giveaway open` → inscriptions `!wish` → `!giveaway close` ;
- tirage aléatoire parmi les participants ;
- classement par nombre de messages Twitch ;
- récompense gagnant : +1 600 Primogemmes ;
- récompense rang 1 : +2 000 particules personnelles ;
- récompense rang 2 : +1 500 ;
- récompense rang 3 : +1 000 ;
- autres joueurs classés : +500 ;
- principe global des récompenses actuelles sans rééquilibrage dans cet audit.

Ces points ne doivent pas être redemandés sans raison.

---

# 33. Points produit restant à décider

Reprendre à :

**R702**

Le domaine reste court.

À trancher principalement :

- le Giveaway reste-t-il strictement Twitch côté joueur ou le standalone affiche-t-il aussi un état en direct ?
- `!wish` reste-t-il le seul moyen joueur de rejoindre ou un bouton standalone peut-il s'inscrire au tirage Twitch ?
- commandes Twitch : conserver le fait qu'elles comptent dans `messageCounts` ?
- Kichnifou / administrateur : rester exclu du classement ou compter ses vrais messages maintenant que le bot aura une identité séparée ?
- égalités : conserver le départage alphabétique ou créer des rangs ex æquo ?
- `!giveaway stats` : public ou Admin uniquement ?
- `reroll` : deuxième gagnant payé en plus, remplacement logique, ou autre comportement ?
- autoriser `reroll` uniquement après fermeture ?
- notifications standalone pour gagnant / Top 3 / autres récompensés ?
- afficher un historique récent de Giveaways ou uniquement état courant/dernier résultat ?
- boutons Admin standalone open/close/reroll ou commandes Twitch seulement ?
- message final Twitch : format gagnant + podium actuel ou présentation adaptée ?

Aucun nouvel arbitrage sur les montants de récompenses n'est nécessaire.

---

# 34. Sweep final obligatoire

Même après clôture Giveaway / Wish et des audits restants, le sweep exhaustif final de toutes les commandes legacy et JSON reste obligatoire avant le modèle de données cible final et la V1.

`Giveaway.txt` est désormais une source connue et doit être inclus dans ce sweep comme script legacy supplémentaire s'il est ajouté au repository.
