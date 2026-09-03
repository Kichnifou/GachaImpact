# 15 — Audit Concours / C6

> Domaine 12 de l'audit legacy GachaImpact.  
> Statut : **CLÔTURÉ — décisions R526 à R593 validées**.  
> Ce document est la source spécialisée du domaine Concours / C6.  
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

## R567 — Retrait forcé après lancement — ✅ VALIDÉ B

Avant lancement :
- l'organisateur peut retirer un participant du lobby.

Après lancement :
- l'organisateur ne peut plus expulser arbitrairement un autre participant ;
- seul un administrateur autorisé peut effectuer un retrait forcé exceptionnel ;
- le participant retiré est remplacé par un bot selon les règles normales de continuité ;
- l'action administrative est journalisée.

Les absences ordinaires sont gérées par les délais et remplacements automatiques de R532 et ne nécessitent pas de pouvoir d'expulsion supplémentaire pour l'organisateur.

---

## R568 — Snapshot de puissance au lancement — ✅ VALIDÉ A

Au lancement du concours, chaque place participante fige notamment :

- le personnage utilisé ;
- la statistique du thème ;
- les points de base correspondants ;
- le rang/titre utile à l'affichage du thème courant.

Une progression C6 obtenue pendant le concours via Pull, Stella ou une autre source n'affecte donc pas la partie déjà lancée.

Elle s'applique au concours suivant.

---

## R569 — Changement de Légende dans le lobby — ✅ VALIDÉ B ENRICHI

Avant lancement, un participant peut librement remplacer sa Légende par un autre de ses 5★ C6 éligibles.

Dans l'UI :
- action `Changer de Légende`.

Dans le chat interne ou Twitch :
- refaire `!concours rejoindre <personnage>` avec un autre personnage remplace simplement la sélection actuelle du joueur ;
- cela ne crée jamais une seconde place participante.

Le changement :
- conserve la place dans le lobby ;
- ne consomme aucune participation quotidienne ;
- remet le participant en état `Pas prêt`.

Après lancement, le personnage est définitivement figé pour le concours.

---

## R570 — Confidentialité pendant un concours public — ✅ VALIDÉ A

Participer à un Concours global rend publiques uniquement les informations nécessaires au déroulement de la partie.

Peuvent être visibles :
- joueur ;
- personnage utilisé ;
- humain / bot ;
- score ;
- ordre et tour courant ;
- rang du thème courant ;
- informations de puissance explicitement autorisées par R574.

Ne deviennent pas publiques pour autant :
- les quatre autres statistiques C6 ;
- les valeurs détaillées non nécessaires ;
- les titres des autres thèmes ;
- la fiche Légende complète lorsqu'elle est protégée par les paramètres Public / Amis uniquement / Privé.

Participer publiquement n'annule donc pas les préférences générales de confidentialité.

---

## R571 — Historique global public — ✅ VALIDÉ A

L'historique des Concours terminés est un palmarès communautaire public.

Tous les joueurs peuvent consulter les informations publiques d'un concours terminé, notamment :
- thème ;
- participants ;
- personnages utilisés ;
- classement ;
- scores ;
- vainqueur ;
- rangs/informations qui étaient publiques pendant cette partie.

Les informations C6 privées qui n'étaient pas nécessaires au match ne sont pas ajoutées à l'historique.

---

## R572 — Famille de commandes `!concours` — ✅ VALIDÉ A

Commandes canoniques :

- `!concours` → état/résumé ;
- `!concours open <personnage>` → créer le lobby ;
- `!concours rejoindre <personnage>` → rejoindre ou changer de Légende avant lancement ;
- `!concours spectateur` → devenir spectateur actif ;
- `!concours quitter` → quitter son rôle courant ;
- `!concours pret` → confirmer que le participant est prêt ;
- `!concours start` → lancer lorsque les conditions sont réunies ;
- `!concours annuler` → annuler lorsque l'utilisateur en a le droit ;
- `!concours basique` → action sûre ;
- `!concours risque` → action risquée ;
- `!concours soutenir <participant>` → soutenir pendant la fenêtre correspondante.

Alias textuels possibles :
- `participant` / `participer` → `rejoindre` ;
- `lancer` → `start` ;
- `cancel` → `annuler` ;
- `basic` → `basique` ;
- `risk` / `risqué` → `risque`.

Les aides recommandent toujours une seule syntaxe canonique.

---

## R573 — Matching des personnages Concours — ✅ VALIDÉ A

Dans les commandes texte :

- le personnage doit être réellement possédé en 5★ C6 ;
- le nom demandé correspond au nom exact après normalisation de casse et d'accents ;
- pas de fuzzy matching ni de nom partiel pouvant sélectionner accidentellement une autre Légende.

Dans l'UI, la sélection passe par un picker des personnages éligibles.

---

## R574 — Informations de puissance publiques — ✅ VALIDÉ B

Sur la carte d'un participant, le Concours peut afficher :

- son rang/titre du thème courant ;
- ses points de base pour ce concours ;
- son score courant.

La valeur C6 exacte n'est pas affichée publiquement.

Exemple :
- `Icône d'Or` ;
- `Puissance : 4 pts` ;
- `Score : 37`.

Ainsi, une statistique comprise entre 15 et 19 reste privée tout en permettant de comprendre la puissance réelle des actions.

---

## R575 — Ancien participant et rôle spectateur — ✅ VALIDÉ B

Un joueur ayant déjà été participant au concours courant puis ayant quitté ou été remplacé :

- peut continuer à regarder passivement ;
- ne peut pas devenir spectateur actif du même concours ;
- ne peut donc pas influencer ensuite le résultat via un soutien.

---

## R576 — Départ de l'organisateur dans le lobby — ✅ VALIDÉ A

Avant lancement, si l'organisateur quitte :

- sa place participante disparaît ;
- s'il reste au moins un autre participant humain, le rôle d'organisateur est transféré au premier humain restant ;
- s'il ne reste plus aucun participant, le lobby est annulé.

Aucune participation quotidienne n'est consommée.

---

## R577 — Retraits répétés du lobby — ✅ VALIDÉ A ENRICHI

Lorsqu'un organisateur retire un joueur du lobby :

- aucune participation quotidienne n'est consommée ;
- le joueur peut normalement rejoindre de nouveau.

Le serveur compte cependant les retraits effectués par l'organisateur contre ce joueur dans le lobby courant.

Après le **troisième retrait** :
- le joueur ne peut plus rejoindre ce lobby ;
- il peut toujours le regarder passivement ;
- un nouveau lobby remet ce compteur à zéro et restaure son éligibilité normale.

Le compteur appartient donc au couple `lobby + joueur ciblé`.

---

## R578 — Identité des bots — ✅ VALIDÉ A

Les bots utilisent des noms fictifs distinctifs, par exemple ceux déjà présents dans le système historique.

Présentation cible :
- nom fictif ;
- avatar générique dédié ;
- badge ou symbole `BOT` / `🤖` clairement visible ;
- identités distinctes entre les bots d'un même concours.

Un bot ne prétend pas posséder un vrai personnage du catalogue.

---

## R579 — Cible du soutien — ✅ VALIDÉ A ENRICHI

`!concours soutenir` accepte une cible non ambiguë.

L'aide recommande le **nom affiché du participant ou du bot**, par exemple :

`!concours soutenir Kyo`

Les numéros de place `1` à `4` peuvent également être acceptés comme raccourci pratique, notamment sur Twitch.

Ils ne constituent cependant pas la syntaxe mise en avant dans l'aide.

---

## R580 — Spectateurs actifs et viewers passifs — ✅ VALIDÉ A ENRICHI

Les spectateurs actifs sont publiquement visibles dans le Concours, puisqu'ils ont volontairement pris un rôle interactif.

L'écran peut afficher par exemple :

`Spectateurs actifs : 4/10`

avec la liste correspondante.

### Viewers passifs de l'écran Concours

Il est également prévu, lorsque l'infrastructure temps réel est disponible, d'afficher le nombre de joueurs ayant actuellement l'écran Concours ouvert sans être :
- participant ;
- spectateur actif.

Exemple :

`👁 4 regardent`

Cette information peut être cliquable pour afficher les joueurs autorisés.

La faisabilité technique a été vérifiée : une infrastructure de présence temps réel peut maintenir ce type d'état éphémère de page/canal.

Règles :
- information temps réel best-effort ;
- jamais persistée comme historique ;
- jamais utilisée comme vérité métier du Concours ;
- plusieurs onglets/appareils d'un même compte sont dédupliqués côté affichage ;
- les permissions Social de présence Public / Amis uniquement / Privé restent appliquées ;
- un utilisateur non autorisé n'est pas révélé dans cette liste.

---

## R581 — Notification du spectateur sélectionné — ✅ VALIDÉ A

Lorsqu'un spectateur actif est choisi pour soutenir :

- UI ouverte → mise en évidence de la zone de soutien et notification visuelle ;
- chat interne → message ou mention adaptée ;
- Twitch futur → information adaptée lorsque ce canal est pertinent.

Le délai reste de 30 secondes pour tous les canaux.

La présentation doit éviter d'envoyer inutilement plusieurs notifications identiques au même joueur.

---

## R582 — Sélection du thème quotidien — ✅ VALIDÉ A

Conserver un tirage aléatoire pur parmi les cinq thèmes :

- Force ;
- Intelligence ;
- Beauté ;
- Charisme ;
- Popularité.

Chaque thème possède la même probabilité.

Le même thème peut donc être tiré plusieurs jours consécutifs.

---

## R583 — État `Prêt` du lobby — ✅ VALIDÉ B

Chaque participant humain possède un état :
- `Prêt` ;
- `Pas prêt`.

Dans l'UI :
- bouton `Prêt`.

Chat interne / Twitch :
- `!concours pret`.

Changer de Légende remet automatiquement le joueur en `Pas prêt`.

Quitter puis rejoindre produit également un nouvel état `Pas prêt`.

Le concours ne peut être lancé que lorsque tous les humains présents sont prêts.

Les bots n'utilisent pas cet état.

L'état `Prêt` ne dépend pas du fait que la page web soit encore ouverte : le joueur peut ensuite utiliser un autre canal.

---

## R584 — Même personnage chez plusieurs joueurs — ✅ VALIDÉ A

Plusieurs participants peuvent utiliser le même personnage du catalogue.

Exemple :
- Chasca d'Axel ;
- Chasca de Kyo.

Chaque place utilise la progression C6 propre au propriétaire concerné.

Aucune exclusivité globale sur le personnage n'est appliquée au lobby.

---

## R585 — Concours annulés dans l'historique public — ✅ VALIDÉ A

L'historique visible aux joueurs contient uniquement les concours terminés normalement.

Les concours annulés :
- restent traçables côté serveur lorsque nécessaire ;
- ne sont pas ajoutés au palmarès public ;
- ne révèlent pas inutilement les motifs techniques ou administratifs.

---

## R586 — Conservation de l'historique GachaImpact — ✅ VALIDÉ A

Tous les concours terminés à partir du standalone sont conservés sans limite arbitraire de type 20 ou 100 résultats.

L'UI utilise :
- pagination ;
- chargement progressif ;
- ou action `Voir plus`.

La croissance de l'historique ne provoque pas de purge métier automatique.

---

## R587 — Thème et choix de Légende — ✅ VALIDÉ A

Le thème quotidien est clairement visible avant de choisir ou changer sa Légende.

Le joueur peut également voir ses **propres** valeurs utiles dans le picker de sélection.

Exemple pour le thème Charisme :
- Chasca — 17/20 ;
- Itto — 8/20 ;
- Zhongli — 12/20.

Ces informations appartiennent au joueur lui-même et ne constituent pas une divulgation publique de sa fiche C6.

---

## R588 — Classement en direct — ✅ VALIDÉ A

Les scores et le classement sont visibles en direct.

La disposition principale des cartes reste toutefois stable selon l'ordre de tour fixé par R555.

Les cartes ne sautent donc pas de position à chaque changement de score.

Un badge ou indicateur dynamique peut afficher :
- 1er ;
- 2e ;
- 3e ;
- 4e.

---

## R589 — Passage spectateur actif → participant — ✅ VALIDÉ A

Avant lancement, un spectateur actif peut rejoindre comme participant s'il :
- possède un 5★ C6 éligible ;
- dispose encore de sa participation quotidienne ;
- dispose d'une place participante libre.

Son rôle spectateur est alors retiré automatiquement et il devient participant `Pas prêt`.

Après lancement, aucun passage spectateur → participant n'est autorisé.

---

## R590 — Tous prêts ne lance pas automatiquement — ✅ VALIDÉ B

Lorsque tous les humains sont prêts :

- le concours devient lançable ;
- il ne démarre pas automatiquement.

L'organisateur conserve l'action explicite :
- bouton `Lancer` ;
- ou `!concours start`.

Cela évite qu'une simple confirmation `Prêt` du dernier joueur déclenche immédiatement le concours.

---

## R591 — Annonce publique du résultat — ✅ VALIDÉ B

La fin d'un Concours produit un résultat public adapté au canal.

### UI
Résultat détaillé :
- podium ;
- scores ;
- vainqueur ;
- récompenses ;
- promotions de titre éventuelles.

### Chat interne
Message compact avec au minimum le vainqueur et le podium utile.

### Twitch futur
Même information adaptée aux contraintes du canal lorsque le pont Twitch est actif.

Un bot gagnant est annoncé comme tel, sans récompense économique.

---

## R592 — Promotion de titre publique — ✅ VALIDÉ A

Lorsqu'une victoire fait franchir un seuil de titre :

- la promotion est clairement affichée dans le résultat final ;
- elle peut également être mentionnée dans le message public compact.

Exemple :

`✨ Chasca devient Icône d'Or !`

Les titres restent honorifiques conformément à R563.

---

## R593 — Conservation visuelle du dernier résultat — ✅ VALIDÉ A

Après la fin d'un concours, l'écran Concours continue d'afficher son résultat tant qu'aucun nouveau lobby n'existe.

Il peut notamment proposer :
- podium ;
- résultat détaillé ;
- `Voir l'historique` ;
- `Créer un nouveau concours` pour un joueur éligible.

La création d'un nouveau lobby remplace naturellement cet affichage.

Aucun délai artificiel n'empêche de créer le concours suivant.

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

### Source de vérité C6

La possession du personnage est la source de vérité permettant de déterminer qu'un joueur possède réellement un 5★ C6.

Une entrée isolée de `c6_characters.json` ne crée jamais artificiellement une possession.

La progression Concours cible est unique pour le couple :
- joueur ;
- personnage possédé.

Les cinq statistiques sont bornées entre 1 et 20.

Les métadonnées du catalogue ne sont pas dupliquées dans cette progression.

### Modèle conceptuel C6

Pour chaque 5★ C6 concerné, conserver conceptuellement :

- référence du joueur ;
- référence du personnage ;
- éventuelle date historique connue de déblocage C6 ;
- `strength` ;
- `intelligence` ;
- `beauty` ;
- `charisma` ;
- `popularity` ;
- total de concours terminés ;
- total de victoires ;
- participations par thème ;
- victoires par thème ;
- plancher de rang migré lorsque nécessaire pour préserver R554.

Les chaînes comme `Sage de Bronze` ou `Icône d'Or` ne sont pas la source de vérité cible.

Le titre affiché est dérivé :
- du thème ;
- du nombre de victoires ;
- du plancher historique éventuellement migré.

### Migration de `c6_characters.json`

Pour chaque véritable possession 5★ C6 :
- importer les cinq statistiques connues ;
- borner les valeurs invalides à 1..20 de manière conservatrice ;
- importer les compteurs globaux connus ;
- importer les compteurs thématiques connus ;
- un compteur thématique absent est initialisé à 0 ;
- ne pas recalculer artificiellement les totaux pour les faire correspondre aux sous-compteurs historiques ;
- importer le rang de titre historique reconnaissable comme plancher de migration ;
- conserver `createdAt` comme information historique de déblocage lorsqu'il est valide ;
- une date inconnue reste inconnue plutôt que d'être inventée.

Si un vrai 5★ C6 possédé ne possède aucune entrée C6 :
- initialiser ses cinq statistiques à 1 ;
- initialiser ses compteurs à 0 ;
- aucun titre initial ;
- signaler l'initialisation dans le rapport de migration.

Une entrée C6 ne correspondant pas à une possession 5★ C6 certaine :
- n'est pas transformée en possession ;
- est signalée/quarantainée pour inspection.

### Producteurs / consommateurs

Une logique centrale de progression C6 devient propriétaire de ces mutations.

Producteurs :
- passage d'un 5★ à C6 ;
- nouvelle copie d'un 5★ déjà C6 via Pull ;
- Stella sur un 5★ déjà C6 ;
- fin valide d'un Concours.

Consommateurs :
- Concours ;
- `!legende` ;
- fiches UI de Légendes ;
- historique/statistiques ;
- autres systèmes explicitement autorisés à lire ces informations.

XP ne synchronise plus périodiquement Box → C6.

Cette responsabilité historique disparaît du futur moteur XP.

### Personnage désactivé

Si un personnage devient désactivé dans le catalogue :
- sa progression C6 est conservée ;
- son historique reste valide ;
- il n'est plus sélectionnable dans un nouveau Concours tant qu'il reste désactivé.

### Atomicité / concurrence / idempotence

Les actions sensibles sont autoritaires côté serveur.

Le lancement :
- revalide tous les participants ;
- revalide leur état `Prêt` ;
- snapshotte les informations nécessaires ;
- consomme les participations quotidiennes dans une même opération logique ;
- ne peut jamais consommer partiellement certaines tentatives si le lancement échoue.

Les tours, soutiens, départs, remplacements, annulations et fin de concours utilisent :
- validation de l'état/phase courant ;
- protection contre les appels concurrents ;
- idempotence adaptée aux requêtes rejouées ;
- versionnement/verrouillage transactionnel ou mécanisme équivalent du backend retenu.

Une seule mutation peut clôturer avec succès un concours.

Les récompenses et statistiques de fin sont persistées côté serveur même si le navigateur du joueur est fermé.

### Permissions administratives

Avant lancement :
- l'organisateur gère son lobby selon les règles validées.

Après lancement :
- seul un administrateur autorisé peut forcer le retrait d'un autre participant ;
- les actions administratives exceptionnelles sont journalisées ;
- une invalidation technique/administrative applique R535.

Aucune interface client ne peut s'accorder elle-même ces permissions.

### État persistant de reprise

Un concours lancé doit persister au minimum les informations nécessaires à une reprise fiable, conceptuellement :

- identité stable du concours ;
- statut et phase ;
- date métier ;
- thème ;
- organisateur ;
- timestamps de création et lancement ;
- participants et origine humain/bot ;
- snapshots de personnages/statistiques/points de base ;
- scores ;
- ordre des tours ;
- round courant ;
- joueur ou spectateur actif ;
- délais/timestamps utiles aux timeouts ;
- soutien en attente ;
- informations nécessaires aux remplacements ;
- compteurs de retraits du lobby lorsque pertinents avant lancement ;
- métadonnées techniques de version/concurrence.

Après redémarrage :
- état cohérent → reprise ;
- état impossible à reprendre sûrement → annulation technique selon R561/R535.

### Présence de l'écran Concours

La liste des viewers passifs définie par R580 :
- repose sur une présence temps réel éphémère ;
- est dédupliquée par joueur pour l'affichage ;
- respecte les permissions Social ;
- n'est pas enregistrée comme historique ;
- n'est jamais utilisée pour déterminer une règle de gameplay.

Cette fonctionnalité nécessite une capacité de présence temps réel dans l'infrastructure finalement retenue, capacité dont la faisabilité a été vérifiée pour la trajectoire technique actuellement envisagée.

---

# 5. Clôture du domaine

**Concours / C6 est clôturé après R593.**

Le domaine possède désormais suffisamment de décisions pour permettre ultérieurement une implémentation bornée par Codex sans reprendre l'audit produit depuis zéro.

## Critères d'acceptation principaux

Une future implémentation devra notamment vérifier :

- un seul concours global à la fois ;
- lobby, Ready, changement de Légende et transferts d'organisateur conformes ;
- consommation quotidienne uniquement au lancement effectif ;
- lancement atomique ;
- quatre places complétées par bots ;
- snapshots immuables après lancement ;
- ordre de tour stable ;
- timeouts humain/soutien ;
- remplacement automatique après inactivité ;
- interdiction d'expulsion arbitraire post-lancement par l'organisateur ;
- actions `basique` / `risque` conformes ;
- premier score >= 50 gagnant immédiatement ;
- soutien +1/+2/+3 ;
- bots adaptatifs selon R551/R552 ;
- classement incluant les bots ;
- récompenses 800/400/200 selon rang global ;
- progression statistique uniquement pour les humains ayant terminé ;
- titres 1/3/7/15 et plancher de migration ;
- historique public des concours terminés uniquement ;
- aucune migration de l'ancien historique de `contests_data.json` ;
- confidentialité C6 respectée hors informations nécessaires au match public ;
- `!concours` et `!legende` utilisent exactement les mêmes services métier que l'UI ;
- reprise après crash ou annulation technique sûre ;
- appels concurrents/retry incapables de dupliquer tours, récompenses, participation ou résultat.

Les détails d'implémentation SQL, classes, tables, indexes et primitives de verrouillage seront choisis lors de la conception backend en respectant ces invariants.

Le domaine actif et la prochaine étape exacte du projet doivent être indiqués uniquement dans `docs/master/PROJECT_MASTER_PLAN.md`.
