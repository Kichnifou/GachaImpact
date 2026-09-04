# 21 — Audit Giveaway / Wish

> Domaine 18 de l'audit GachaImpact.  
> Statut : **CLÔTURÉ — décisions produit R702 à R713 validées ; clôture technique finalisée**.  
> Ce document est la source spécialisée validée du domaine Giveaway / Wish.  
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

Sans consommer de Rxxx supplémentaires :

- le Giveaway est reproductible sans Streamer.bot via `channel.chat.message` ;
- Twitch User ID est l'identité Twitch autoritative ;
- le comptage quitte `XP.txt` et appartient à GiveawayService ;
- les commandes Giveaway sont routées par le CommandRouter ;
- les permissions Admin sont vérifiées côté serveur ;
- un `open` ne peut plus écraser une session déjà ouverte ;
- `!wish` est unique par session/joueur ;
- tout ancien filtre `niveau >= 2` du Giveaway est remplacé par la règle centrale `élément choisi = joueur Twitch activé` ;
- gagnant `!wish` et classement messages restent deux populations distinctes ;
- les commandes `!xxx` sont exclues du compteur Giveaway en V1 ;
- les messages bot / système sont également exclus ;
- aucun cooldown spécifique n'est appliqué aux vrais messages Giveaway ;
- Kichnifou n'est plus exclu par son pseudo : ses vrais messages humains peuvent compter, tandis que l'identité bot est séparée ;
- les égalités produisent des rangs ex æquo selon un classement compétition ;
- l'ordre d'affichage de joueurs partageant exactement le même rang peut rester déterministe sans modifier leur récompense ;
- rang 1 = 2 000 particules, rang 2 = 1 500, rang 3 = 1 000, rang >=4 = 500 ;
- les montants Top 3 sont des montants totaux et non `500 + bonus` ;
- toutes les récompenses passent par les services économiques centraux ;
- `totalMainElementParticlesEarned` est maintenu pour toutes les particules personnelles générées ;
- fermeture / récompenses / rerolls sont reprise-sûrs et idempotents ;
- le tirage final est persisté avant sa restitution Twitch ;
- aucun historique legacy absent n'est inventé.

---

# 32. Décisions produit validées

## R702 — Filtrage des messages du classement — ✅ VALIDÉ

Contrairement au legacy, toutes les commandes Twitch sont exclues du compteur Giveaway.

Ne comptent donc pas :

- `!wish` ;
- `!pull` ;
- `!box` ;
- `!giveaway` ;
- toute autre commande commençant par `!` ;
- messages bot ;
- messages système.

Comptent :

- les vrais messages de discussion Twitch d'un joueur éligible.

Aucun cooldown Giveaway spécifique n'est ajouté.

Chaque vrai message normal éligible compte donc pour `+1 message`, même s'il ne donne pas nécessairement de l'XP pour une autre raison.

---

## R703 — Participation joueur strictement Twitch — ✅ VALIDÉ A

Le Giveaway reste une animation de live Twitch.

Côté joueur :

- inscription depuis Twitch ;
- activité mesurée uniquement dans le chat Twitch ;
- tirage lié au Giveaway Twitch.

Le chat interne GachaImpact n'alimente jamais `messageCounts`.

Les récompenses appartiennent néanmoins au même joueur serveur et sont immédiatement visibles dans le standalone.

---

## R704 — Aucun bouton standalone `Participer` — ✅ VALIDÉ A

Le moyen joueur de rejoindre le tirage reste :

`!wish`

sur Twitch.

Le standalone ne possède pas de bouton permettant à un joueur ordinaire de rejoindre le tirage.

Cette restriction ne concerne pas les futurs contrôles Admin du Giveaway.

---

## R705 — Les vrais messages de Kichnifou comptent — ✅ VALIDÉ B

La V1 ne conserve pas l'exclusion historique :

`username == "kichnifou"`

Le bot Twitch possède sa propre identité technique.

Par conséquent :

- les messages du bot restent exclus ;
- les messages système restent exclus ;
- les vrais messages humains envoyés par Kichnifou sont comptés normalement s'il satisfait les mêmes règles d'éligibilité que les autres joueurs.

Kichnifou peut donc apparaître dans le classement et recevoir la récompense de rang correspondante.

---

## R706 — Rangs ex æquo — ✅ VALIDÉ B

Deux joueurs possédant le même nombre de messages partagent le même rang.

Le départage alphabétique legacy n'est plus utilisé pour attribuer des rangs différents.

L'ordre d'affichage au sein d'un même rang peut rester déterministe, par exemple alphabétique, mais il ne modifie jamais :

- le rang ;
- la médaille ;
- la récompense.

---

## R707 — `!giveaway stats` public — ✅ VALIDÉ A

`!giveaway stats` reste consultable par les viewers.

Il s'agit d'une commande de lecture.

Elle peut notamment afficher selon l'état :

### Ouvert

- Giveaway ouvert ;
- nombre de participants ;
- rappel `!wish`.

### Fermé

- nombre de participants ;
- dernier gagnant courant lorsqu'il existe.

Les actions :

- `open`
- `close`
- `reroll`

restent réservées à l'administration.

---

## R708 — Reroll conservant les gains précédents — ✅ VALIDÉ A

`!giveaway reroll` est autorisé uniquement sur une session déjà fermée.

Le reroll :

- exclut le gagnant actuellement affiché ;
- choisit aléatoirement un autre participant éligible ;
- donne au nouveau gagnant +1 600 Primogemmes ;
- ne retire jamais les +1 600 déjà accordées au gagnant précédent ;
- remplace le gagnant courant affiché par le nouveau ;
- conserve l'historique serveur des gagnants successifs.

La sémantique économique legacy est donc conservée :

**un reroll crée un nouveau paiement.**

Si plusieurs rerolls sont effectués, seule la personne qui est gagnante courante est obligatoirement exclue du tirage suivant, conformément au comportement legacy.

Un ancien gagnant plus ancien peut donc redevenir éligible lors d'un reroll ultérieur.

Chaque opération reste idempotente : retry technique d'un même reroll ≠ nouveau reroll économique.

---

## R709 — Notification standalone pour tous les récompensés — ✅ VALIDÉ A

Tout joueur recevant une récompense Giveaway reçoit une notification standalone **informationnelle**.

Exemples :

### Gagnant du tirage

`🎟️ Giveaway remporté — +1 600 Primogemmes`

### Classement

`🥇 1er du classement Giveaway — +2 000 particules Hydro`

### Autre chatter récompensé

`🎉 Récompense Giveaway — +500 particules Cryo`

La récompense est déjà créditée.

Aucun bouton `Récupérer`.

Si un même joueur cumule plusieurs gains pendant la fermeture, par exemple :

- gagnant du `!wish` ;
- rang du classement chat ;

la notification peut agréger les récompenses dans une seule restitution informationnelle.

Un profil Twitch-only conserve cette information sur son joueur interne et peut la retrouver après liaison au standalone selon les règles générales de Notifications.

---

## R710 — Aucun historique Giveaway player-facing dédié — ✅ VALIDÉ A

La V1 ne crée pas d'écran complet d'historique des Giveaways.

Restent possibles :

- état courant ;
- dernier gagnant via `stats` ;
- résultat immédiatement restitué lors de la fermeture.

Le serveur/Admin conserve en revanche les sessions nécessaires à :

- audit ;
- support ;
- statistiques ;
- idempotence ;
- rerolls.

---

## R711 — Contrôles Giveaway dans l'Admin standalone — ✅ VALIDÉ A

L'interface Admin standalone peut gérer le Giveaway Twitch.

Elle peut au minimum afficher :

- état ouvert / fermé ;
- nombre de participants ;
- informations utiles sur la session.

Actions :

- `Ouvrir`
- `Fermer`
- `Reroll`

Ces boutons appellent exactement le même GiveawayService que :

- `!giveaway open`
- `!giveaway close`
- `!giveaway reroll`

Aucune logique économique n'est dupliquée dans le frontend.

Cela ne crée aucun bouton de participation pour les joueurs ordinaires.

---

## R712 — Restitution Twitch actuelle conservée — ✅ VALIDÉ A PERSONNALISÉ

Conserver le principe actuel de `Giveaway.txt`.

Une fermeture normale génère **deux messages Twitch distincts**, sans faux retour à la ligne interne.

### Message 1

Résultat du tirage `!wish` :

- message de victoire aléatoire du gagnant ;
- ou message indiquant qu'aucun participant éligible n'a gagné.

### Message 2

Classement activité :

- podium ;
- nombre de messages ;
- récompense de chaque rang du podium ;
- mention générique de la récompense des autres joueurs classés.

Ne pas chercher à fusionner artificiellement ces deux restitutions.

Le Giveaway peut donc volontairement être l'un des rares systèmes produisant deux messages lors d'une seule clôture.

Chaque message Twitch reste sur une seule ligne.

---

## R713 — Classement compétition pour les ex æquo — ✅ VALIDÉ A

Utiliser un **classement compétition**.

Exemple :

- Alice : 100 messages → rang 1 ;
- Bob : 100 messages → rang 1 ;
- Chloé : 80 messages → rang 3 ;
- David : 70 messages → rang 4.

Récompenses :

- Alice → +2 000 particules ;
- Bob → +2 000 ;
- Chloé → +1 000 ;
- David → +500.

Le rang 2 est sauté puisqu'il est occupé par la deuxième personne partageant le rang 1.

Autre exemple avec trois joueurs premiers ex æquo :

- rang 1 ;
- rang 1 ;
- rang 1 ;
- joueur suivant = rang 4.

Les trois premiers reçoivent chacun +2 000.

Table des récompenses par **rang**, et non par index dans le tableau :

- rang 1 → +2 000 ;
- rang 2 → +1 500 ;
- rang 3 → +1 000 ;
- rang >=4 → +500.

---

# 33. Contrats cibles

## `!wish`

Canal :

**Twitch uniquement.**

Préconditions :

- Giveaway ouvert ;
- joueur interne existant ;
- élément choisi ;
- aucune inscription préalable dans cette session.

Succès :

- inscription unique au tirage ;
- confirmation Twitch.

`!wish` ne compte pas lui-même dans `messageCounts` conformément à R702.

---

## `!giveaway`

### `!giveaway stats`

Lecture publique.

### `!giveaway open`

Admin uniquement.

Refuse si une session est déjà ouverte.

### `!giveaway close`

Admin uniquement.

Ferme exactement une fois la session ouverte.

### `!giveaway reroll`

Admin uniquement.

Autorisé uniquement après fermeture.

Aucun reroll implicite ou automatique.

---

# 34. Comptage Twitch cible

Un message augmente `messageCounts` uniquement si :

- une session Giveaway est ouverte ;
- le Twitch User ID est résolu vers un joueur GachaImpact existant ;
- le joueur a choisi son élément ;
- le message n'est pas une commande ;
- le message n'est pas bot/système ;
- le `message_id` n'a pas déjà été traité pour cette session.

Aucun cooldown Giveaway.

Les messages internes GachaImpact ne participent pas au classement.

Le comptage s'arrête dès que la fermeture autoritative verrouille la session.

---

# 35. Fermeture et classement

La fermeture :

1. verrouille la session ;
2. arrête le comptage ;
3. snapshotte participants et compteurs ;
4. construit les rangs avec ex æquo compétition ;
5. distribue les récompenses chat ;
6. tire le gagnant parmi les participants éligibles ;
7. distribue +1 600 Primogemmes ;
8. enregistre le résultat ;
9. crée les notifications informationnelles ;
10. produit les deux messages Twitch validés.

Participants et chatters classés restent deux populations distinctes.

Une fermeture sans participant `!wish` reste valide :

- aucun gagnant aléatoire ;
- classement chat et récompenses d'activité toujours distribuables.

---

# 36. Atomicité / idempotence

Doivent être protégés :

- inscription `!wish` ;
- comptage par `message_id` ;
- fermeture ;
- tirage gagnant ;
- récompense +1 600 ;
- récompenses de classement ;
- notifications ;
- rerolls.

Une même fermeture retryée :

- ne reroll jamais le gagnant ;
- ne recompte pas les messages ;
- ne repaie aucune récompense ;
- restitue le résultat déjà persisté si nécessaire.

Un reroll explicitement demandé est une nouvelle action économique.

Un retry technique du même reroll ne l'est pas.

---

# 37. Migration

Le snapshot legacy actuel peut être conservé comme provenance de dernière session connue.

Ne jamais :

- redistribuer les anciennes récompenses ;
- reconstruire un historique de sessions absent ;
- inventer des dates ;
- inventer des gagnants.

Si `chatRewardsDistributed = true` :

- considérer les récompenses chat de cette session comme déjà distribuées.

Conserver lorsque connus :

- gagnant ;
- participants ;
- compteurs ;
- openedAt / closedAt ;
- previousWinner ;
- rerolledAt.

Préférer effectuer le cutover Twitch hors Giveaway actif.

---

# 38. Critères d'acceptation

Le Domaine Giveaway / Wish est prêt pour la V1 si les tests peuvent prouver notamment que :

1. un Admin peut ouvrir un Giveaway ;
2. un second `open` ne peut pas écraser une session ouverte ;
3. un joueur sans élément ne peut pas participer ;
4. aucun niveau minimum n'est requis si l'élément est choisi ;
5. `!wish` inscrit une seule fois ;
6. `!wish` ne compte pas dans le classement messages ;
7. aucune commande `!xxx` ne compte ;
8. les messages bot/système ne comptent pas ;
9. chaque vrai message normal éligible compte sans cooldown Giveaway ;
10. une redelivery du même `message_id` ne compte pas deux fois ;
11. les messages du chat interne standalone ne comptent jamais ;
12. les vrais messages de Kichnifou peuvent compter ;
13. le tirage choisit uniquement parmi les participants `!wish` éligibles ;
14. un chatter non inscrit à `!wish` peut quand même être classé ;
15. le gagnant reçoit exactement +1 600 Primogemmes ;
16. rang 1 reçoit exactement +2 000 particules personnelles ;
17. rang 2 reçoit exactement +1 500 ;
18. rang 3 reçoit exactement +1 000 ;
19. rang >=4 reçoit exactement +500 ;
20. deux joueurs à égalité peuvent partager le même rang ;
21. `1er, 1er, 3e` applique correctement les récompenses ;
22. `totalPrimosEarned` est maintenu ;
23. `totalMainElementParticlesEarned` est maintenu ;
24. une fermeture sans participant `!wish` peut toujours distribuer le classement chat ;
25. `!giveaway stats` est public ;
26. open/close/reroll restent administratifs ;
27. le panneau Admin appelle le même service que les commandes Twitch ;
28. un reroll n'est possible qu'après fermeture ;
29. le gagnant précédent conserve ses +1 600 après reroll ;
30. le nouveau gagnant reçoit +1 600 ;
31. une même fermeture retryée ne redistribue rien ;
32. une même requête de reroll retryée ne paie pas deux fois ;
33. les récompensés obtiennent une notification informationnelle ;
34. aucune notification Giveaway ne possède de second claim ;
35. la fermeture Twitch produit le message résultat puis le message classement ;
36. aucun faux retour à la ligne n'est requis dans ces messages ;
37. aucun historique player-facing Giveaway dédié n'est nécessaire ;
38. aucune récompense legacy n'est rejouée pendant la migration.

---

# 39. Conclusion du domaine

**Domaine Giveaway / Wish : CLÔTURÉ après R713.**

Le tirage, l'activité chat, les récompenses, les ex æquo, les commandes, le reroll, les notifications, l'administration standalone, l'intégration Twitch, la migration et l'idempotence sont suffisamment définis pour une future implémentation V1 bornée.

Le domaine ne doit être rouvert que si :

- Twitch modifie réellement les capacités nécessaires au chat ;
- le sweep final révèle une dépendance oubliée ;
- une décision produit est explicitement révisée.

---

# 40. Sweep final obligatoire

Même après clôture Giveaway / Wish et des audits restants, le sweep exhaustif final des **37 scripts `.txt` et 17 JSON** reste obligatoire avant le modèle de données cible final et la V1.

`Giveaway.txt` fait désormais officiellement partie des sources à couvrir pendant ce sweep.
