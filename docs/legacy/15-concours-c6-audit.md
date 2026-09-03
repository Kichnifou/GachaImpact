# 15 — Audit Concours / C6

> Domaine 12 de l'audit legacy GachaImpact.  
> Statut : **EN COURS — décisions R526 à R566 déjà validées**.  
> Ce document devient la source spécialisée du domaine Concours / C6.  
> L'état global du projet et la prochaine reprise exacte restent la responsabilité du Master.

---

## 1. Objectif du domaine

Auditer puis spécifier pour le standalone :

- les personnages 5★ C6 utilisés comme « légendes » ;
- leurs cinq statistiques de Concours ;
- la création et le cycle de vie d'un concours ;
- les participants humains et bots ;
- les spectateurs et le soutien ;
- les thèmes quotidiens ;
- les actions de tour ;
- les récompenses ;
- les statistiques et titres ;
- les historiques ;
- la migration ;
- les interactions avec Gacha / Pull / Stella / Légende / XP et les autres consommateurs.

Le legacy est une source d'observation, pas la cible à recopier aveuglément.

---

## 2. Sources legacy principales

### Scripts

- `legacy/streamerbot/commands/Concours.txt`
- `legacy/streamerbot/commands/Legende.txt`
- `legacy/streamerbot/commands/Stella.txt`
- `legacy/streamerbot/commands/Pull.txt`
- `legacy/streamerbot/commands/XP.txt`

D'autres producteurs ou consommateurs doivent être ajoutés ici s'ils sont découverts pendant l'audit.

### Données

- `legacy/streamerbot/data/contests_data.json`
- `legacy/streamerbot/data/c6_characters.json`
- `legacy/streamerbot/data/viewers_data.json`
- `legacy/streamerbot/data/genshin_characters.json` lorsque l'identité/catalogue personnage doit être vérifiée

---

## 3. Réalité legacy déjà confirmée

Le script `Concours.txt` gère notamment :

- un seul concours actif à la fois ;
- jusqu'à 4 participants ;
- jusqu'à 10 spectateurs ;
- remplacement des places participantes manquantes par des bots au lancement ;
- un thème quotidien ;
- un système tour par tour ;
- les actions `basique` et `risque` ;
- un soutien ponctuel par spectateur ;
- une victoire à partir de 50 points ;
- des récompenses de classement ;
- la progression des statistiques/titres des personnages C6.

`contests_data.json` conserve notamment :

- la date ;
- le thème quotidien ;
- l'état du concours courant ;
- les participants et spectateurs ;
- l'ordre des tours ;
- les scores ;
- les verrous quotidiens ;
- un historique legacy limité.

`c6_characters.json` conserve par joueur et personnage C6 :

- des métadonnées personnage dupliquées du catalogue legacy ;
- cinq statistiques : force, intelligence, beauté, charisme, popularité ;
- des statistiques de participation/victoire ;
- des titres par thème.

Ces structures legacy ne préjugent pas du schéma final de base de données.

---

# 4. Décisions validées

## R526 — Accès au système Concours — ✅ VALIDÉ A

Le Concours est visible par tous les joueurs.

Un joueur sans personnage 5★ C6 :

- peut consulter le système ;
- peut regarder les concours ;
- peut devenir spectateur lorsque cette mécanique est pertinente ;
- ne peut pas s'inscrire comme participant avec un personnage tant qu'il ne possède pas de 5★ C6 éligible.

L'absence de 5★ C6 ne doit donc pas masquer entièrement le système.

---

## R527 — Un seul concours global et visionnage UI — ✅ VALIDÉ A

Il n'existe qu'un seul concours global actif à la fois.

Dans l'UI standalone :

- n'importe quel joueur peut ouvrir et regarder le concours en cours sans devoir s'inscrire comme spectateur ;
- ce simple visionnage est passif et ne donne aucune action de spectateur ;
- les actions réservées aux spectateurs nécessitent le statut correspondant ;
- aucun autre concours ne peut être créé tant que le concours global courant existe.

Le visionnage passif de l'UI et le rôle métier de spectateur sont deux notions distinctes.

---

## R528 — Thème quotidien — ✅ VALIDÉ A

Le thème du Concours est mondial et quotidien.

- un même thème est utilisé pour les concours de la journée ;
- le changement suit le reset serveur ;
- fuseau de référence : `Europe/Paris`.

Le futur backend ne doit pas dépendre du premier message Twitch ou de l'ouverture d'un navigateur pour effectuer ce changement de journée.

---

## R529 — Limite quotidienne de participation — ✅ VALIDÉ A

Un joueur peut participer comme concurrent à **un seul concours par jour**.

Le simple visionnage et le rôle de spectateur ne consomment pas cette participation quotidienne.

---

## R530 — Moment de consommation de la participation — ✅ VALIDÉ A

La participation quotidienne n'est consommée qu'au **lancement effectif du concours**.

Entrer dans un lobby puis le quitter ou voir le lobby être annulé avant lancement ne doit pas consommer la tentative quotidienne.

La mutation doit être réalisée de façon atomique avec le lancement afin d'éviter les doubles consommations ou participations concurrentes.

---

## R531 — Nombre de participants et bots — ✅ VALIDÉ A

Un concours comporte **4 places participantes**.

Il peut être lancé avec un seul participant humain.

Au lancement :

- les places participantes encore libres sont complétées par des bots ;
- les bots font partie du même concours et utilisent le même moteur de résolution ;
- ils ne créent évidemment aucune progression joueur.

---

## R532 — Délais, inactivité et remplacement — ✅ VALIDÉ A ENRICHI

Le standalone utilise des délais explicites et visibles dans l'UI.

### Lobby

Le lobby possède un délai d'inactivité de **10 minutes**.

Si aucune activité pertinente ne relance ce délai :
- le lobby est automatiquement annulé ;
- aucun concours n'est lancé ;
- aucune participation quotidienne n'est consommée.

### Tour d'un participant humain

Un participant humain dispose de **60 secondes** pour agir.

S'il n'effectue aucune action humaine pendant ce délai :
- une action `basique` est exécutée automatiquement pour ce tour ;
- ce tour compte comme un tour consécutif sans action humaine.

Après **3 tours consécutifs de ce participant sans aucune action humaine**, il est automatiquement remplacé par un bot.

Une nouvelle action humaine valide remet ce compteur d'inactivité consécutive à zéro.

Lors du remplacement :
- le bot reprend exactement la place du participant ;
- il hérite de l'état courant nécessaire à la continuité du concours, notamment le score et les données de concours déjà engagées ;
- le concours continue sans réinitialiser la progression de cette place ;
- le joueur remplacé ne peut pas reprendre sa place dans ce concours.

Le joueur pourra participer à un futur concours uniquement selon les règles normales, notamment la limite d'une participation par jour. Puisque la participation quotidienne est consommée au lancement selon R530, un remplacement après lancement ne restitue pas cette participation.

### Tour de soutien

Lorsqu'un spectateur actif est sélectionné pour soutenir, il dispose de **30 secondes**.

S'il n'effectue aucune action pendant ce délai :
- le soutien est simplement ignoré pour ce round ;
- le concours continue normalement.

### Retrait manuel

L'organisateur et les administrateurs autorisés peuvent également retirer manuellement :
- un participant → remplacé par un bot qui hérite de l'état courant nécessaire à la continuité ;
- un spectateur → retiré du rôle de spectateur sans autre remplacement.

Les détails techniques de scheduler, concurrence, verrouillage et idempotence seront définis côté backend sans nouvelle décision produit tant qu'ils respectent ces règles.

---

## R533 — Soutien des spectateurs — ✅ VALIDÉ A

La mécanique de soutien des spectateurs est conservée.

Après chaque **round complet** :
- parmi les spectateurs actifs réellement inscrits au concours, un spectateur est choisi aléatoirement ;
- ce spectateur devient le spectateur autorisé à soutenir pour cette fenêtre ;
- il choisit l'un des participants qu'il souhaite aider ;
- il dispose de **30 secondes** pour effectuer ce choix conformément à R532 ;
- en l'absence d'action dans le délai, le soutien de ce round est ignoré.

Le simple viewer UI qui regarde le concours sans être inscrit comme spectateur :
- peut suivre le concours ;
- n'entre jamais dans le tirage du soutien ;
- ne dispose d'aucune action de soutien.

L'action doit être accessible selon le canal :
- **UI standalone** : bouton/action de soutien avec sélection du participant ciblé ;
- **chat interne GachaImpact** : action/commande permettant de cibler le participant à soutenir ;
- **Twitch futur** : commande équivalente lorsque l'intégration Twitch sera disponible.

Tous les canaux appellent exactement le même service métier de soutien Concours.

---

## R534 — Annulation globale et départ individuel — ✅ VALIDÉ B ENRICHI

L'organisateur conserve le droit d'annuler **l'intégralité du concours**, y compris après son lancement.

En parallèle :

- un participant peut quitter individuellement ;
- s'il quitte après lancement, il est remplacé par un bot selon les règles de continuité du concours ;
- un spectateur peut quitter individuellement ;
- son départ ne détruit pas le concours.

Les conséquences économiques/statistiques exactes d'une annulation après lancement doivent encore être auditées avant d'être figées.

---

## R535 — Conséquences d'une annulation globale après lancement — ✅ VALIDÉ C

Une annulation globale après lancement ne produit :
- aucun podium ;
- aucune récompense ;
- aucune victoire ;
- aucun titre ;
- aucune statistique de concours terminé.

L'annulation reste néanmoins journalisée côté serveur pour permettre la traçabilité.

### Annulation volontaire par l'organisateur

Si l'organisateur annule volontairement le concours après son lancement :
- sa propre participation quotidienne reste consommée ;
- les autres participants humains concernés récupèrent leur participation quotidienne ;
- aucun résultat sportif ou économique n'est validé.

Cette règle évite qu'un organisateur puisse reroll gratuitement son propre concours tout en empêchant qu'il puisse faire perdre arbitrairement la tentative quotidienne des autres joueurs.

### Annulation technique / administrative légitime

Lorsqu'un concours doit être invalidé pour une raison technique ou administrative légitime :
- tous les participants humains récupèrent leur participation quotidienne ;
- aucune progression de résultat n'est conservée ;
- la cause de l'annulation est journalisée.

Un simple départ individuel reste régi par les règles de remplacement et ne constitue pas une annulation technique.

---

## R536 — Plus aucun participant humain — ✅ VALIDÉ A

Si, après le lancement, il ne reste plus aucun participant humain :
- le concours est automatiquement annulé ;
- les bots ne continuent pas seuls jusqu'à produire un classement ;
- aucune récompense, victoire ou titre n'est attribué.

Un joueur ayant volontairement quitté le concours ou ayant été remplacé pour inactivité :
- ne récupère pas sa participation quotidienne du fait de cette annulation automatique.

Les bots servent à compléter et maintenir un concours communautaire, pas à faire continuer seuls une partie devenue entièrement automatisée.

---

## R537 — Conséquences du remplacement d'un humain par un bot — ✅ VALIDÉ B

Lorsqu'un participant humain est remplacé par un bot après le lancement :
- sa participation quotidienne reste consommée ;
- le bot reprend la place et l'état courant nécessaires à la continuité du concours ;
- le joueur remplacé n'est plus éligible aux récompenses de classement ;
- une éventuelle victoire ultérieure de cette place ne devient pas une victoire du joueur ;
- aucun titre n'est accordé au joueur remplacé ;
- le concours finalisé ne compte pas comme une participation terminée dans les statistiques de Concours de son personnage.

Le serveur conserve néanmoins la trace historique que le joueur avait commencé le concours puis avait été remplacé.

Le bot devient donc le propriétaire métier de cette place pour le résultat final, sans réattribuer rétroactivement ses performances au joueur initial.

---

## R538 — Les bots occupent de vraies places dans le classement — ✅ VALIDÉ A

Le classement final inclut réellement les humains et les bots.

Un bot peut donc :
- gagner le concours ;
- terminer deuxième ou troisième ;
- empêcher un humain d'occuper une meilleure place.

Les bots ne reçoivent évidemment aucune récompense économique.

Les récompenses humaines dépendent néanmoins de la véritable position obtenue dans le classement complet.

Exemple :

1. Bot ;
2. Joueur A ;
3. Joueur B ;
4. Bot.

Résultat :
- le Bot ne reçoit rien ;
- Joueur A reçoit la récompense de deuxième place ;
- Joueur B reçoit la récompense de troisième place.

Les places prises par les bots ne sont pas compressées pour recalculer un second classement réservé aux humains.

---

## R539 — Actions `basique` et `risque` — ✅ VALIDÉ A

Conserver le fonctionnement réel du code legacy.

### Action `basique`

Le participant reçoit toujours :
- `pointsDeBase`.

### Action `risque`

Le serveur tire uniformément l'un des trois résultats suivants :
- 1/3 → `0` point ;
- 1/3 → `pointsDeBase` ;
- 1/3 → `pointsDeBase × 2`.

L'espérance mathématique de l'action risquée reste donc égale à celle de l'action basique.

Le choix porte sur :
- `basique` → sécurité ;
- `risque` → variance.

Le résultat aléatoire doit être calculé côté serveur.

---

## R540 — Conversion de la statistique C6 en points — ✅ VALIDÉ A

Conserver les paliers du code legacy :

| Statistique du thème | Points de base |
|---:|---:|
| 1 à 4 | 1 |
| 5 à 9 | 2 |
| 10 à 14 | 3 |
| 15 à 19 | 4 |
| 20 | 5 |

La valeur maximale `20` reste donc un palier exceptionnel donnant à elle seule accès au maximum de 5 points de base.

Une statistique invalide ou inférieure au minimum devra être normalisée de manière conservatrice côté backend sans modifier cette règle de gameplay.

---

## R541 — Limite des spectateurs actifs — ✅ VALIDÉ A

Conserver un maximum de **10 spectateurs actifs inscrits** par concours.

Cette limite ne concerne pas le visionnage passif.

Dans le standalone :
- le nombre de joueurs pouvant regarder le concours passivement dans l'UI n'est pas limité par cette règle ;
- seules les places de spectateurs actifs sont limitées à 10 ;
- seuls ces spectateurs actifs peuvent être sélectionnés pour la mécanique de soutien selon R533.

Les 10 places constituent donc des places interactives plutôt qu'une limite de public total.

---

## R542 — Condition de victoire — ✅ VALIDÉ A

Le premier participant qui atteint ou dépasse **50 points** gagne immédiatement.

- il n'est pas nécessaire d'obtenir exactement 50 ;
- le concours s'arrête dès l'action gagnante ;
- les autres participants ne terminent pas le round ;
- un soutien de spectateur peut également provoquer directement la victoire ;
- il n'existe donc pas d'égalité simultanée à départager dans le fonctionnement normal.

---

## R543 — Stratégie des bots — ✅ VALIDÉ C

Les bots n'utilisent plus un simple taux fixe de `risque`.

Ils prennent une décision adaptative selon l'état courant du concours.

Le comportement exact est précisé par R551.

---

## R544 — Puissance des bots de remplissage — ✅ VALIDÉ C

Les bots créés au lancement pour compléter les quatre places ne reçoivent plus une statistique totalement indépendante de celle des humains.

Leur puissance est adaptée à celle des participants humains du concours.

Les bots issus du remplacement d'un humain restent un autre cas : ils héritent de l'état et de la statistique du participant remplacé conformément aux décisions précédentes.

Le calibrage cible est précisé par R552.

---

## R545 — Bonus de soutien — ✅ VALIDÉ A

Lorsqu'un spectateur soutient un participant :

- le serveur tire uniformément `+1`, `+2` ou `+3` points ;
- chaque valeur possède une probabilité de 1/3 ;
- le bonus est ajouté immédiatement ;
- il peut déclencher la victoire selon R542.

Le tirage est toujours autoritaire côté serveur.

---

## R546 — Récompenses de classement — ✅ VALIDÉ A

Conserver les récompenses actuelles :

- 🥇 1er : **800 Primogemmes** ;
- 🥈 2e : **400 Primogemmes** ;
- 🥉 3e : **200 Primogemmes** ;
- 4e : aucune récompense.

Les bots occupent de vraies places conformément à R538 mais ne reçoivent aucune récompense.

Une place occupée par un bot n'est pas retirée du classement pour améliorer artificiellement la récompense d'un humain.

Ces montants peuvent être revus lors d'un futur équilibrage économique global sans modifier la règle fonctionnelle du Concours.

---

## R547 — Statistiques d'un concours terminé — ✅ VALIDÉ A

Les statistiques de participation Concours sont ajoutées uniquement aux participants humains encore présents lorsque le concours se termine normalement.

Pour chacun :

- `totalContests +1` ;
- compteur de participations du thème `+1`.

Pour le gagnant humain :

- `totalWins +1` ;
- compteur de victoires du thème `+1`.

Un joueur ayant quitté ou ayant été remplacé par un bot :

- conserve sa consommation quotidienne ;
- ne reçoit aucune statistique de concours terminé.

Un concours annulé ne produit aucune de ces statistiques.

---

## R548 — Progression des titres — ✅ VALIDÉ B

Les rangs de titres sont conservés :

- Bronze ;
- Argent ;
- Or ;
- Platine.

Ils ne progressent plus automatiquement d'un rang à chaque victoire.

Chaque rang exige désormais un nombre cumulé de victoires dans le thème concerné.

Les seuils exacts sont définis par R553.

---

## R549 — Un titre distinct par thème — ✅ VALIDÉ A

Chaque personnage C6 possède une progression de titre indépendante pour chacun des cinq thèmes :

- Force → Titan ;
- Intelligence → Sage ;
- Beauté → Éclat ;
- Charisme → Icône ;
- Popularité → Idôle.

Un même personnage peut donc être Platine dans un thème et Bronze ou sans titre dans un autre.

---

## R550 — Historique player-facing détaillé — ✅ VALIDÉ B

Les nouveaux concours terminés produisent un historique consultable par les joueurs.

Une fiche de concours peut notamment présenter :

- date et heure ;
- thème ;
- classement complet ;
- participants ;
- personnages utilisés ;
- distinction humain / bot ;
- scores finaux ;
- vainqueur ;
- informations importantes de déroulement lorsque pertinentes.

L'écran Concours peut afficher quelques résultats récents puis proposer un accès à un historique plus complet.

La migration de l'ancien historique est traitée séparément par R564.

---

## R551 — IA contextuelle des bots — ✅ VALIDÉ A

Les bots utilisent une stratégie contextuelle simple.

Direction cible :

- si une action `basique` garantit immédiatement la victoire → toujours `basique` ;
- bot nettement en retard → environ **70 %** de chance de choisir `risque` ;
- situation intermédiaire → environ **40 %** ;
- bot en position favorable ou proche de la victoire → environ **20 %** ;
- l'IA conserve donc une part d'aléatoire et ne cherche pas une stratégie mathématique parfaite.

Les seuils numériques exacts permettant de qualifier retard / situation normale / position favorable sont des paramètres techniques du moteur et pourront être ajustés sans nouvelle décision produit tant que cette intention est respectée.

---

## R552 — Calibrage de puissance des bots de remplissage — ✅ VALIDÉ A

Au lancement :

1. calculer la moyenne de la statistique du thème des participants humains ;
2. utiliser cette moyenne comme référence ;
3. générer les statistiques des bots légèrement sous cette référence avec une petite variation aléatoire ;
4. borner le résultat final entre 1 et 20.

Direction de calibrage :

`statBot ≈ moyenneHumaine - 2`, avec une variation d'environ `±2`.

Le but est que :

- les bots suivent globalement le niveau des joueurs présents ;
- un joueur ayant développé une excellente Légende conserve néanmoins un avantage naturel ;
- les fillers ne deviennent pas automatiquement aussi puissants qu'un personnage optimisé.

Les détails exacts d'arrondi, clamp et tirage sont des décisions techniques du backend.

---

## R553 — Seuils exacts des titres — ✅ VALIDÉ A

Les seuils sont cumulatifs et propres à chaque thème :

- **Bronze** : 1 victoire ;
- **Argent** : 3 victoires ;
- **Or** : 7 victoires ;
- **Platine** : 15 victoires.

Le rang est donc dérivable du nombre de victoires du thème, sous réserve de la règle de migration R554.

---

## R554 — Migration des titres déjà acquis — ✅ VALIDÉ A

Un titre déjà acquis par un ancien personnage constitue un **plancher garanti**.

À la migration :

- conserver le vrai compteur historique de victoires connu ;
- conserver au minimum le meilleur rang déjà acquis ;
- ne jamais rétrograder un joueur à cause des nouveaux seuils ;
- ne jamais inventer de victoire supplémentaire pour faire correspondre artificiellement compteur et rang.

Exemple :

un personnage possédant historiquement 2 victoires et un rang Argent reste Argent, puis devra atteindre le nouveau seuil d'Or pour continuer sa progression.

---

## R555 — Ordre des participants — ✅ VALIDÉ A

L'ordre des quatre participants est mélangé aléatoirement une seule fois au lancement.

Cet ordre :

- est déterminé côté serveur ;
- devient visible aux joueurs ;
- reste identique pour les rounds suivants.

Il n'est pas remélangé à chaque round.

---

## R556 — Soutien possible sur un bot — ✅ VALIDÉ A

Un spectateur actif peut soutenir n'importe lequel des quatre participants :

- humain ;
- bot.

Un bot reste donc une cible valide de soutien et peut gagner grâce à ce bonus.

---

## R557 — Sélection indépendante des spectateurs — ✅ VALIDÉ A

Le tirage du spectateur actif est indépendant à chaque round.

Une même personne peut donc être sélectionnée :

- deux rounds consécutifs ;
- ou plusieurs fois sur un même concours.

Aucune protection anti-répétition ni rotation complète n'est imposée.

---

## R558 — Inscription spectateur après lancement — ✅ VALIDÉ A

Un joueur peut devenir spectateur actif même après le lancement du concours si :

- le concours existe encore ;
- il n'est pas participant ;
- il reste une place parmi les 10 spectateurs actifs.

Si le joueur rejoint pendant une fenêtre de soutien déjà commencée :

- il n'est pas ajouté au tirage déjà effectué ;
- il devient éligible à partir du prochain round.

Le visionnage passif reste accessible indépendamment de cette inscription.

---

## R559 — Départ de l'organisateur après lancement — ✅ VALIDÉ A

Si l'organisateur quitte individuellement le concours après lancement :

- sa place participante est remplacée par un bot selon les règles normales ;
- il perd son rôle d'organisateur ;
- le rôle est transféré au premier participant humain encore présent selon l'ordre du concours ;
- les administrateurs conservent leurs pouvoirs indépendamment de ce rôle.

S'il ne reste plus aucun humain, R536 s'applique et le concours est annulé.

Un joueur ayant quitté ne peut donc pas conserver un pouvoir extérieur lui permettant d'annuler ensuite la partie.

---

## R560 — Concours traversant le changement de journée — ✅ VALIDÉ A

Le changement de journée serveur n'annule pas un concours déjà lancé.

Au lancement, le concours fige notamment :

- sa date métier ;
- son thème ;
- ses participants ;
- les consommations quotidiennes associées.

S'il se termine après minuit :

- il conserve son ancien thème ;
- son résultat appartient à sa date de lancement ;
- il continue normalement jusqu'à sa résolution.

Une fois ce concours terminé, un nouveau concours peut utiliser le nouveau jour et le nouveau thème serveur.

---

## R561 — Reprise après crash / redémarrage — ✅ VALIDÉ A

L'état d'un concours lancé doit être suffisamment persisté pour permettre une reprise après redémarrage serveur.

Au redémarrage :

- recharger l'état autoritaire ;
- vérifier sa cohérence ;
- recalculer les délais depuis les timestamps serveur ;
- reprendre le concours à son état courant lorsque cela est fiable.

Si l'état est incohérent ou insuffisant pour reprendre correctement :

- effectuer une annulation technique ;
- appliquer R535 ;
- restituer les participations concernées ;
- ne produire aucun résultat ;
- journaliser la cause technique.

Un redémarrage normal ne doit donc pas annuler systématiquement les concours.

---

## R562 — L'organisateur est obligatoirement participant — ✅ VALIDÉ A

Pour créer un nouveau lobby Concours, un joueur doit :

- posséder un 5★ C6 éligible ;
- être encore autorisé à participer ce jour-là ;
- sélectionner le personnage utilisé ;
- devenir immédiatement le premier participant du lobby.

Il n'existe pas de rôle normal d'organisateur extérieur ne participant pas au concours.

---

## R563 — Titres honorifiques et représentation visuelle — ✅ VALIDÉ A ENRICHI

Les titres Concours sont honorifiques.

Ils :

- ne donnent aucun bonus de statistiques ;
- ne modifient pas les points obtenus ;
- ne renforcent pas les chances de victoire ;
- servent à valoriser la progression du personnage.

Dans l'UI Concours, le rang correspondant au **thème courant** doit être visuellement identifiable sur le participant.

Direction visuelle validée :

- cadre autour de l'avatar/carte du participant correspondant au rang Bronze / Argent / Or / Platine ;
- et/ou symbole/badge distinctif permettant d'identifier immédiatement le rang ;
- Platine doit notamment être clairement reconnaissable au premier regard.

Cette représentation peut également être réutilisée sur les fiches de Légendes et autres emplacements adaptés.

Les choix graphiques précis restent une décision UI à réaliser lors de l'implémentation sans modifier le fonctionnement métier.

---

## R564 — Ancien historique Concours — ✅ VALIDÉ B

L'ancien historique stocké dans `contests_data.json` n'est **pas migré** dans l'historique joueur du standalone.

Le nouvel historique Concours commence donc à **zéro** au démarrage de GachaImpact.

Les anciennes entrées ne sont pas reconstruites à partir des statistiques C6 et aucune information historique manquante n'est inventée.

Règle de vocabulaire globale :

- le terme interne `legacy` ne doit jamais être affiché aux joueurs ;
- l'UI, les aides et les messages du jeu utilisent toujours un vocabulaire naturel propre à GachaImpact.

---

## R565 — Consultation des Légendes d'autres joueurs — ✅ VALIDÉ B ENRICHI

Les informations C6 / Légendes peuvent être consultées selon les autorisations sociales du propriétaire :

- `Public` ;
- `Amis uniquement` ;
- `Privé`.

Les mêmes permissions s'appliquent :

- dans l'UI standalone ;
- dans le chat interne ;
- via Twitch lorsque l'intégration existera.

### Commandes cibles

`!legende`
- affiche la liste des personnages C6 du demandeur.

`!legende <joueur>`
- affiche la liste des personnages C6 du joueur ciblé si les permissions l'autorisent.

`!legende <joueur> <personnage>`
- affiche les informations détaillées du personnage C6 ciblé si les permissions l'autorisent.

Les cibles `me` et `moi` peuvent représenter le demandeur lui-même.

Pour consulter son propre personnage précisément, on peut donc utiliser :

`!legende moi <personnage>`

La réponse détaillée peut présenter notamment :

- les cinq statistiques Concours ;
- les rangs/titres des cinq thèmes ;
- le nombre total de concours terminés ;
- le nombre total de victoires ;
- les compteurs par thème utiles.

Une commande ne doit jamais permettre de contourner une rubrique `Privé` ou `Amis uniquement`.

Un refus de confidentialité ne doit pas révéler indirectement le nombre de C6, leurs noms ou leurs statistiques.

---

## R566 — Niveau de détail de l'historique — ✅ VALIDÉ B

Le stockage durable player-facing conserve le résultat détaillé et les événements importants, sans devenir obligatoirement un replay complet action par action.

Conserver notamment :

- participants ;
- personnages utilisés ;
- statistiques de thème figées au lancement ;
- ordre des tours ;
- classement final ;
- scores ;
- vainqueur ;
- durée / nombre de rounds ;
- abandons ;
- remplacements humain → bot ;
- soutiens importants ;
- état d'annulation éventuel et raison lorsqu'un enregistrement technique est nécessaire.

Il n'est pas nécessaire de conserver éternellement chaque action `basique`, chaque jet `risque` ou chaque variation intermédiaire de score dans l'historique joueur.

Des logs techniques plus détaillés peuvent être conservés séparément selon les besoins d'audit et de diagnostic.

---

## Décisions techniques acquises pendant ce lot

### Normalisation des données C6

Le futur modèle C6 ne doit pas recopier les métadonnées du catalogue personnage comme le fait actuellement `c6_characters.json`.

Ne pas dupliquer durablement :

- nom ;
- rareté ;
- élément ;
- arme ;
- région ;
- classe ;
- autres métadonnées de catalogue.

La progression C6 référence le personnage concerné par son identité interne et conserve uniquement les données réellement propres à cette progression, notamment :

- cinq statistiques Concours ;
- statistiques de participations/victoires ;
- progression de titres ;
- métadonnées techniques utiles.

Le catalogue personnage reste la source de vérité pour l'identité et les caractéristiques statiques du personnage.

### Paramètres techniques des bots

Les seuils exacts utilisés par l'IA adaptative, les arrondis et le tirage final de puissance des bots sont des paramètres techniques serveur.

Ils peuvent être ajustés sans nouvelle décision Rxxx tant qu'ils respectent R551 et R552.

---

# 5. Points encore ouverts

À reprendre à partir de **R567**.

À finaliser notamment :

- modèle cible précis des données C6 persistées ;
- migration de `c6_characters.json`, notamment stats, compteurs et titres ;
- producteurs et consommateurs C6 : Pull, Stella, XP, Légende et Concours ;
- suppression de l'ancien rôle de synchronisation C6 détenu par XP lorsqu'il devient inutile ;
- contrats finaux des actions/commandes Concours ;
- permissions administratives finales ;
- règles de concurrence, atomicité et idempotence entre lancement, tours, soutien, annulation et récompenses ;
- état persistant minimal nécessaire à une reprise sûre après incident ;
- UI cible de l'écran Concours et des fiches Légendes ;
- critères d'acceptation et cas limites nécessaires à l'implémentation Codex.

Le domaine actif et la prochaine étape exacte du projet doivent être indiqués uniquement dans `docs/master/PROJECT_MASTER_PLAN.md`.
