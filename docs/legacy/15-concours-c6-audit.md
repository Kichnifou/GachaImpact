# 15 — Audit Concours / C6

> Domaine 12 de l'audit legacy GachaImpact.  
> Statut : **EN COURS — décisions R526 à R534 déjà validées**.  
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

# 5. Points encore ouverts

À reprendre à partir de **R535** après relecture des scripts et données concernés.

À auditer notamment :

- conséquences exactes d'une annulation après lancement ;
- comportement du verrou quotidien en cas d'annulation ;
- règles précises des actions `basique` / `risque` ;
- conversion des statistiques C6 en points ;
- comportement des bots ;
- sélection et fonctionnement du soutien ;
- condition de victoire et égalités éventuelles ;
- récompenses de classement ;
- statistiques de participation/victoire ;
- progression et paliers de titres ;
- historique cible ;
- migration de `c6_characters.json` et `contests_data.json` ;
- interactions avec Pull, Stella, Légende et XP ;
- producteurs/consommateurs ;
- concurrence, idempotence et scheduler.

Le domaine actif et la prochaine étape exacte du projet doivent être indiqués uniquement dans `docs/master/PROJECT_MASTER_PLAN.md`.
