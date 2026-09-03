# 16 — Audit Event / monthly

> Domaine 13 de l'audit GachaImpact.  
> Statut : **EN COURS — décisions R594 à R607 et R609 à R613 validées ; reprise à R614**.  
> Ce document devient la source spécialisée du domaine Event / monthly.  
> L'état global du projet et la prochaine reprise exacte restent la responsabilité du Master.

---

# 1. Objectif du domaine

Auditer puis spécifier le système d'événement mensuel de GachaImpact :

- les douze thèmes mensuels ;
- l'inscription à l'événement ;
- les points et la monnaie mensuelle ;
- les trois mécaniques quotidiennes communes ;
- les paliers de progression ;
- la boutique Event ;
- les objets de collection permanents ;
- le classement mensuel ;
- le calendrier de décembre ;
- les annonces et codes mensuels ;
- les messages sociaux Event ;
- le changement de mois / année ;
- la migration des données existantes ;
- les interactions UI standalone / chat interne / Twitch futur.

Le Boss mensuel a déjà été audité avec Combat et ne fait pas partie de ce domaine, sauf dépendance réelle découverte ultérieurement.

---

# 2. Sources réelles inspectées

Sources principales :

- `legacy/streamerbot/commands/Event.txt`
- `legacy/streamerbot/commands/XP.txt`
- `legacy/streamerbot/data/monthly_events_data.json`
- `legacy/streamerbot/data/monthly_events.json`
- `legacy/streamerbot/data/gift_codes.json`
- données Event / dates associées dans `viewers_data.json`
- règles Coffre déjà documentées dans `docs/legacy/10-sac-coffre-shop-audit.md`

Règle de lecture :

- les commentaires de tête sont seulement des résumés ;
- le code réel de `Event.txt` et `XP.txt` est la référence pour comprendre le comportement actuel.

---

# 3. Conclusion structurelle initiale

Le système ne contient pas douze moteurs de gameplay différents.

Il possède principalement :

- **un moteur Event mensuel commun** ;
- **trois archétypes de mini-jeux quotidiens communs** ;
- une configuration / identité visuelle différente pour chacun des douze mois ;
- un calendrier supplémentaire en décembre.

Il ne faut donc pas créer douze implémentations métier indépendantes dans la V1.

La cible devra pouvoir représenter les contenus mensuels de manière data-driven/configurable tout en utilisant des services métier communs.

---

# 4. Calendrier des douze événements

| Mois | Événement | Monnaie | Objet de collection | Jeu A | Jeu B | Jeu C |
|---|---|---|---|---|---|---|
| Janvier | Festival du Nouvel An | Éclats de Fortune 🎆 | Lanterne du Nouvel An | `feu` | `coffre` | `voeu` |
| Février | Festival des Cœurs | Cœurs Étincelants 💖 | Cœur Cristallin | `coeur` | `cadeau` | `motdoux` |
| Mars | Festival du Printemps | Bourgeons Mystiques 🌱 | Bourgeon Éternel | `pousse` | `racine` | `graine` |
| Avril | Festival des Cloches | Œufs Enchantés 🥚 | Œuf Enchanté | `oeuf` | `panier` | `chocolat` |
| Mai | Festival des Fleurs | Pétales Magiques 🌸 | Fleur de Printemps | `fleur` | `bouquet` | `motprintemps` |
| Juin | Festival de l’Été | Coquillages Dorés 🏝️ | Coquillage Doré | `peche` | `tresor` | `lettre` |
| Juillet | Festival des Étoiles | Étoiles Tombées ⭐ | Étoile Filante | `etoile` | `constellation` | `voeu` |
| Août | Festival des Aventuriers | Reliques d’Exploration 🧭 | Boussole Antique | `expedition` | `ruine` | `carnet` |
| Septembre | Festival des Récoltes | Jetons de Récolte 🌾 | Gerbe de Récolte | `recolte` | `grenier` | `panier` |
| Octobre | Festival des Ombres | Bonbons Maudits 🎃 | Citrouille Hantée | `fantome` | `crypte` | `sort` |
| Novembre | Festival des Brumes | Feuilles Anciennes 🍁 | Feuille Ancienne | `feuille` | `relique` | `murmure` |
| Décembre | Festival de Noël | Étoiles de Noël 🎄 | Flocon Enchanté | `cadeau` | `hotte` | `carte` |

Décembre possède en plus `!event calendrier`.

---

# 5. Commandes Event actuelles

Famille principale observée :

- `!event`
- `!event go`
- `!event sac`
- `!event boutique`
- `!event top`
- `!event primos N`
- `!event moras N`
- `!event collection`
- `!event calendrier` en décembre
- `!event <commande Jeu A>`
- `!event <commande Jeu B> <code>`
- `!event <commande Jeu C> <pseudo> "message"`

Les contrats définitifs UI / chat / Twitch seront figés pendant l'audit produit.

---

# 6. Inscription à l'événement

`!event go` :

- exige qu'un profil joueur existe déjà ;
- crée/complète l'entrée participante du mois ;
- passe `joined = true` ;
- enregistre `joinedAt` ;
- donne immédiatement **+1 monnaie Event**.

Si le Jeu B global du jour a déjà été résolu au moment de l'inscription :

- le nouveau participant reçoit également **+1 point** ;
- et **+1 monnaie Event**.

Il n'existe pas actuellement de commande de désinscription.

Les autres actions Event sont refusées au joueur non inscrit.

---

# 7. État mensuel d'un participant

Structure actuellement observée dans `monthly_events_data.json` :

- `joined`
- `joinedAt`
- `points`
- `currency`
- `milestonesClaimed[]`
- `daily[date]`

État quotidien observé :

- `gameASuccess`
- `gameBAttempts`
- `gameCSent`
- `dailyEventCurrencyClaimed`

Les points et la monnaie sont mensuels.

Les objets de Coffre obtenus via l'Event sont permanents et appartiennent au modèle Coffre, pas à l'état mensuel temporaire.

---

# 8. Jeu A — fenêtre horaire personnelle + RNG

Le Jeu A possède la même mécanique tous les mois avec un habillage différent.

Pour chaque joueur et chaque jour, le système génère trois fenêtres personnelles aléatoires :

- une fenêtre d'une heure entre 07:00 et 12:00 ;
- une fenêtre d'une heure entre 12:00 et 18:00 ;
- une fenêtre d'une heure entre 18:00 et 23:00.

Ces fenêtres sont persistées dans :

`dailyWindows[username][date]`

En dehors d'une fenêtre :

- l'action échoue sans récompense ;
- le système affiche les trois fenêtres du jour.

Pendant une fenêtre :

- le serveur tire `rng.Next(1, 6)` ;
- seule la valeur `1` réussit ;
- probabilité de réussite actuelle : **20 % par tentative**.

En cas d'échec :

- aucun compteur de tentative n'est enregistré ;
- le joueur peut retenter tant que la fenêtre est active.

En cas de réussite :

- `gameASuccess = true` ;
- **+1 point** ;
- **+1 monnaie Event** ;
- vérification automatique des paliers ;
- aucune nouvelle réussite Jeu A possible ce jour-là.

### Point produit important à auditer

L'absence actuelle de cooldown / limite rend le 20 % facilement spammable dans une vraie UI standalone.

La mécanique doit donc être explicitement adaptée ou confirmée pour la V1.

---

# 9. Jeu B — énigme coopérative globale quotidienne

Le Jeu B possède une solution globale commune à tous les participants pour la journée.

État global :

`gameB[date]`

Contient notamment :

- `winningCode`
- `found`
- `foundBy`
- `testedCodes[]`

Le code gagnant :

- contient exactement 5 bits ;
- chaque bit vaut 0 ou 1 ;
- **32 combinaisons possibles**.

Règles actuelles :

- maximum **3 essais consommés par joueur et par jour** ;
- un code déjà testé globalement ne consomme pas de nouvel essai ;
- l'aide affiche les combinaisons restant encore possibles ;
- une fois la solution trouvée, la journée est résolue.

Au premier code correct :

- `found = true` ;
- `foundBy = joueur` ;
- **tous les participants déjà inscrits** reçoivent +1 point et +1 monnaie ;
- leurs paliers sont vérifiés lorsque leur profil est disponible.

Le découvreur ne reçoit actuellement pas de bonus personnel supplémentaire.

Un joueur qui rejoint l'Event plus tard dans la même journée après résolution reçoit lui aussi rétroactivement le +1 point / +1 monnaie du Jeu B du jour.

### Points produit importants à auditer

- conserver ou non ce rattrapage des inscriptions tardives ;
- conserver ou non la mécanique globale 5 bits / 32 possibilités ;
- éventuelle distinction de récompense pour le découvreur.

---

# 10. Jeu C — message social quotidien

Le Jeu C est une action sociale reskinnée selon le mois.

Syntaxe actuelle :

`!event <commande C> <pseudo> "message"`

Règles observées :

- un seul envoi réussi par joueur et par jour ;
- impossible de se cibler soi-même ;
- le destinataire doit exister dans `viewers_data.json` ;
- le destinataire n'a pas besoin d'être inscrit à l'Event ;
- le message est enregistré pour livraison différée ;
- l'expéditeur reçoit :
  - +1 point ;
  - +1 monnaie Event ;
  - vérification des paliers.

Le destinataire ne reçoit pas de point ou de monnaie juste pour recevoir le message.

Données du message :

- sender
- text
- read
- type
- createdAt

Dans le système actuel, `XP.txt` affiche les messages Event reçus au prochain message normal du destinataire puis les supprime pour éviter une répétition.

### Direction d'architecture déjà évidente

Dans la V1 :

- XP ne doit plus être propriétaire de la livraison ;
- le système Event / notifications / social doit gérer la réception ;
- les règles de blocage, confidentialité et modération déjà définies par Social devront s'appliquer ;
- UI, chat interne et Twitch futur devront appeler une même opération métier.

Le comportement produit précis reste à auditer.

---

# 11. Bonus quotidien Event actuellement déclenché par XP

Pour un joueur déjà inscrit :

- le premier message ordinaire éligible du jour ;
- non commande ;
- non système ;

donne :

**+1 monnaie Event**

Champ :

`dailyEventCurrencyClaimed`

Cette récompense est séparée des Jeux A/B/C.

### Point produit important

Cette mécanique dépend actuellement du chat parce que Streamer.bot fonctionne par messages.

La V1 standalone doit définir comment un joueur principalement UI récupère ce bonus sans être obligé d'écrire dans le chat.

Cette responsabilité doit sortir du futur domaine XP.

---

# 12. Paliers de progression

Les paliers sont automatiquement attribués lorsqu'un gain de points fait atteindre ou dépasser un seuil encore non réclamé.

Seuils actuels :

| Points | Récompense |
|---:|---|
| 10 | +500 particules d'un élément aléatoire |
| 20 | +1 monnaie Event |
| 30 | +500 particules de l'élément du joueur ; fallback aléatoire si absent |
| 40 | +2 monnaies Event |
| 50 | +50 000 Moras |
| 60 | +5 monnaies Event |
| 70 | +1 600 Primogemmes |
| 80 | +10 monnaies Event |

Le compteur de points peut dépasser 80.

80 est seulement le dernier palier actuel.

---

# 13. Boutique Event

Conversions actuelles :

- **1 monnaie Event → 160 Primogemmes**
- **1 monnaie Event → 20 000 Moras**
- objet de collection du mois → **80 monnaies Event**

Les achats Primogemmes / Moras peuvent porter sur plusieurs unités à la fois.

L'achat Collection :

- retire 80 monnaies ;
- ajoute +1 à l'objet permanent correspondant dans `viewer.coffre`.

Les statistiques économiques correspondantes sont mises à jour pour Primogemmes / Moras.

---

# 14. Bug structurel de l'historique annuel des collections

Le code cherche à empêcher l'achat du même objet de collection plus d'une fois dans l'année via :

`collectionPurchases[year][username]`

Mais au changement de mois, le code actuel exécute un reset intégral de `monthly_events_data.json` avec `RemoveAll()`.

Par conséquent :

- `collectionPurchases` est lui aussi supprimé chaque mois ;
- la mémoire « déjà acheté cette année » ne peut pas réellement survivre au changement mensuel.

L'intention fonctionnelle « une acquisition du même objet par année » existe bien dans le code, mais son stockage actuel est incompatible avec cette intention.

La V1 devra séparer :

- état temporaire du mois ;
- progression / acquisition annuelle durable ;
- objet permanent du Coffre.

---

# 15. Classement mensuel

`!event top` :

- prend les participants inscrits ;
- trie par points décroissants ;
- affiche le Top 10.

Aucune récompense de classement n'a été trouvée dans le code réel inspecté.

Le classement est donc actuellement essentiellement honorifique.

---

# 16. Calendrier de décembre

Disponible uniquement :

- du 1er au 25 décembre ;
- pour le Festival de Noël ;
- au jour courant uniquement.

Le joueur ne peut pas actuellement ouvrir une case manquée via un paramètre.

Récompenses :

- jours 1 à 24 : **1 à 5 monnaies Event aléatoires** ;
- jour 25 : **50 monnaies Event garanties**.

Chaque case ne peut être ouverte qu'une fois.

Le calendrier donne de la monnaie, pas de point Event.

---

# 17. Annonce mensuelle et code cadeau

`XP.txt` contient encore une responsabilité Event :

le 1er du mois, lors du premier message ordinaire éligible d'un joueur non encore inscrit, il annonce :

- le début de l'Event ;
- `!event go` ;
- le code cadeau du mois.

Le mois déjà annoncé est suivi via :

`dates.lastMonthlyEventAnnouncement`

Les codes mensuels existent dans `gift_codes.json`, par exemple :

- janvier : `FESTIVALNOUVELAN`
- février : `FESTIVALCOEURS`
- etc.

Ils sont configurés comme codes renouvelables annuellement selon le mois.

Leur règle complète de réclamation reste la responsabilité de l'audit futur **Codes cadeaux**.

Dans la V1, l'annonce Event ne doit plus dépendre exclusivement d'un message Twitch/chat.

---

# 18. Changement de mois / année

`Event.txt` et `XP.txt` savent tous deux actuellement remettre l'état Event au mois courant.

Lorsque `year` ou `month` diffèrent :

- l'objet mensuel est entièrement vidé ;
- nouveau `year` ;
- nouveau `month` ;
- nouveaux participants ;
- nouvelles fenêtres ;
- nouveau Jeu B ;
- nouveaux messages ;
- nouveau calendrier ;
- nouvelles collections mensuelles ;
- nouveau `monthlyDraw`.

### Direction technique

Cette logique devra devenir un vrai changement de période côté serveur / scheduler, pas une conséquence opportuniste d'une commande ou d'un message.

Le reset mensuel doit être défini selon le fuseau serveur déjà standardisé par le projet : `Europe/Paris`.

---

# 19. Données inutilisées / résidus identifiés

## `monthly_events.json`

Le fichier actuel est vide.

Aucune lecture de ce fichier n'a été trouvée dans les scripts inspectés.

Décision technique provisoire :

- ne pas le reproduire dans la V1 ;
- le considérer comme placeholder / résidu historique ;
- le recroiser une dernière fois pendant le sweep exhaustif final de tous les fichiers.

## `monthlyDraw`

`monthlyDraw` contient actuellement :

- `drawDone`
- `winner`

Le champ est initialisé / normalisé par Event et XP, mais aucune mécanique exécutant réellement un tirage mensuel n'a été trouvée.

Décision technique provisoire :

- ne pas inventer de tirage mensuel dans la V1 ;
- ne pas porter ce champ comme fonctionnalité sans preuve contraire ;
- recroiser pendant le sweep exhaustif final.

---

# 20. Architecture cible provisoire

Sans figer encore les décisions produit :

### Configuration Event

Les douze identités mensuelles doivent pouvoir être représentées comme données/configuration :

- mois ;
- nom ;
- emoji ;
- monnaie ;
- objet de collection ;
- noms/commandes des trois jeux ;
- textes/labels utiles.

Ne pas coder douze services séparés.

### État mensuel

À isoler conceptuellement :

- participation ;
- points ;
- solde de monnaie ;
- progression quotidienne ;
- Jeu B global ;
- classement ;
- calendrier du mois si applicable.

### État permanent / multi-mois

À ne pas détruire au reset mensuel :

- Coffre ;
- acquisitions annuelles de collection si conservées ;
- historique mensuel éventuel ;
- statistiques globales éventuelles.

### Services partagés

UI standalone, chat interne et Twitch futur doivent appeler les mêmes opérations serveur.

---

# 21. Migration — constat initial

`monthly_events_data.json` contient de vraies données mensuelles actives :

- participants ;
- points ;
- monnaie restante ;
- paliers réclamés ;
- état quotidien ;
- fenêtres ;
- progression du Jeu B ;
- messages ;
- calendrier ;
- achats connus.

La politique exacte de migration dépendra notamment du moment du cutover :

- état du mois courant ;
- monnaie encore disponible ;
- progression quotidienne ;
- messages Event encore non délivrés.

Aucune donnée historique mensuelle antérieure fiable ne doit être inventée.

---

# 22. Décisions produit validées

## R594 — Calendrier annuel — ✅ VALIDÉ A

Les douze Festivals restent associés à leurs mois fixes chaque année.

Exemples :
- janvier → Festival du Nouvel An ;
- février → Festival des Cœurs ;
- octobre → Festival des Ombres ;
- décembre → Festival de Noël.

Le calendrier n'est ni aléatoire ni réordonné chaque année.

Les contenus pourront évoluer ultérieurement, mais l'identité saisonnière mensuelle reste stable.

---

## R595 — Inscription volontaire — ✅ VALIDÉ A

La participation à l'Event mensuel reste explicite.

UI :
- bouton/action `Participer à l'événement`.

Chat interne / Twitch :
- `!event go`.

Avant inscription, le joueur peut consulter l'écran Event, ses règles, son contenu et les informations publiques utiles.

L'inscription crée sa participation réelle au Festival courant.

---

## R596 — Cadeau d'inscription — ✅ VALIDÉ A

La première inscription du joueur au Festival courant donne immédiatement :

**+1 monnaie Event**

Ce bonus n'est attribué qu'une fois pour cette édition du Festival.

---

## R597 — Conservation saisonnière de la monnaie — ✅ VALIDÉ C ENRICHI

La monnaie Event non dépensée à la fin du mois n'est ni supprimée ni convertie automatiquement.

Elle reste associée au Festival correspondant.

Exemple :

des Éclats de Fortune non utilisés en janvier restent stockés puis redeviennent utilisables au retour du Festival du Nouvel An l'année suivante.

Entre deux éditions :
- la monnaie reste possédée ;
- elle n'est pas utilisable dans les autres Festivals.

Le dernier jour du Festival, le joueur reçoit une notification claire indiquant :
- que l'Event se termine ;
- que sa monnaie peut encore être utilisée dans la boutique courante ;
- que le solde restant sera conservé mais ne redeviendra utilisable qu'au retour du même Festival l'année suivante.

Cette notification ne doit pas être répétée inutilement plusieurs fois au même joueur.

---

## R598 — Trois archétypes communs — ✅ VALIDÉ A

La V1 conserve les trois archétypes de mini-jeux du moteur Event :

1. Jeu A — activité personnelle dépendant de fenêtres horaires ;
2. Jeu B — recherche coopérative d'une solution globale quotidienne ;
3. Jeu C — interaction/message social quotidien.

Les douze Festivals changent :
- noms ;
- textes ;
- commandes ;
- monnaie ;
- objet de collection ;
- identité visuelle ;
- ambiance.

Ils ne possèdent pas douze moteurs métier distincts.

---

## R599 — Trois fenêtres personnelles quotidiennes — ✅ VALIDÉ A

Le Jeu A conserve trois fenêtres horaires personnelles quotidiennes :

- une fenêtre aléatoire d'une heure entre 07:00 et 12:00 ;
- une fenêtre aléatoire d'une heure entre 12:00 et 18:00 ;
- une fenêtre aléatoire d'une heure entre 18:00 et 23:00.

Les heures exactes sont propres au joueur et au jour.

L'UI doit rendre ces fenêtres clairement consultables.

---

## R600 — Essais répétés avec cooldown — ✅ VALIDÉ B ENRICHI

Pendant une fenêtre active du Jeu A :

- le joueur peut effectuer plusieurs tentatives ;
- un cooldown de **3 secondes** s'applique entre deux tentatives ;
- il n'existe pas de limite fixe du nombre d'essais tant que la fenêtre reste ouverte ;
- une réussite termine le Jeu A pour la journée.

Le cooldown est serveur et commun aux différents canaux.

Alterner rapidement UI, chat interne et Twitch ne permet donc pas de le contourner.

---

## R601 — Probabilité du Jeu A — ✅ VALIDÉ A

Chaque tentative valide du Jeu A conserve la probabilité historique :

**20 % de réussite**

Une réussite donne :
- +1 point Event ;
- +1 monnaie Event ;
- validation des éventuels paliers atteints.

Un échec ne consomme pas la possibilité quotidienne et permet de retenter après le cooldown R600 tant que la fenêtre est active.

---

## R602 — Réclamation du bonus quotidien — ✅ VALIDÉ B ENRICHI

Le bonus quotidien Event reste :

**+1 monnaie Event par jour pour un participant inscrit.**

### UI

L'écran Event propose un bouton explicite :

`Réclamer`

Le joueur choisit donc volontairement de récupérer son bonus depuis l'interface.

### Chat interne / Twitch

Pour conserver l'approche actuelle :

- le premier message normal éligible du jour du joueur fait automatiquement office de réclamation ;
- aucune commande spécifique supplémentaire n'est nécessaire.

La réclamation est commune à tous les canaux et ne peut jamais être obtenue plusieurs fois dans la même journée.

---

## R603 — Jeu B à 32 combinaisons — ✅ VALIDÉ A

Conserver le fonctionnement général du Jeu B :

- une solution quotidienne globale ;
- code de 5 bits ;
- 32 combinaisons possibles ;
- même solution pour tous les participants ;
- nouvelle solution au reset quotidien.

L'habillage dépend du Festival :
- coffre ;
- ruine ;
- constellation ;
- crypte ;
- etc.

---

## R604 — Trois essais par joueur — ✅ VALIDÉ A

Chaque participant dispose de :

**3 essais consommables par jour**

sur le Jeu B.

Un code déjà essayé globalement par un autre joueur :
- ne consomme pas de nouvel essai ;
- doit être refusé avant consommation.

Une personne ne peut donc pas brute-force seule les 32 possibilités avec ses trois essais.

---

## R605 — Combinaisons restantes visibles — ✅ VALIDÉ A

L'état communautaire du Jeu B est publiquement consultable.

L'UI peut notamment représenter :
- les 32 combinaisons ;
- celles déjà testées comme barrées/grisées ;
- celles encore disponibles ;
- le nombre restant.

Chat interne / Twitch peuvent fournir une présentation textuelle compacte adaptée.

La solution correcte reste évidemment secrète tant qu'elle n'a pas été trouvée.

---

## R606 — Rattrapage après découverte — ✅ VALIDÉ A

Un joueur qui rejoint l'Event après que le Jeu B du jour a déjà été résolu reçoit rétroactivement la récompense communautaire de cette journée :

- +1 point Event ;
- +1 monnaie Event.

Cela s'ajoute au bonus normal d'inscription R596 lorsqu'il s'agit de sa première inscription au Festival courant.

---

## R607 — Découvreur sans bonus économique — ✅ VALIDÉ A ENRICHI

Le participant qui trouve la combinaison correcte ne reçoit pas de bonus économique supplémentaire par rapport aux autres participants.

La récompense de résolution reste collective.

En revanche, le découvreur est valorisé visuellement.

L'écran Event affiche clairement l'état quotidien du Jeu B :

avant résolution :
- `Encore à découvrir` ou équivalent ;

après résolution :
- solution trouvée ;
- joueur ayant effectué la découverte.

Exemple :

`✅ Découvert par Kyo`

Cette reconnaissance est honorifique.

---

## R609 — Destinataire du Jeu C — ✅ VALIDÉ A

Le message social quotidien peut cibler tout joueur existant, même s'il ne participe pas lui-même au Festival.

Les règles Social restent prioritaires :
- joueur bloqué ;
- restrictions de contact ;
- permissions applicables ;
- modération.

Une relation interdite par le système Social ne peut pas être contournée via l'Event.

---

## R610 — Récompense du destinataire — ✅ VALIDÉ A

Seul l'expéditeur du message social reçoit la récompense du Jeu C :

- +1 point Event ;
- +1 monnaie Event.

Le destinataire ne reçoit aucune monnaie ni aucun point simplement parce qu'il a été ciblé.

Cela évite notamment le farming réciproque ou via comptes secondaires.

---

## R611 — Un envoi réussi par jour — ✅ VALIDÉ A

Chaque participant peut effectuer au maximum :

**1 envoi social Event réussi par jour.**

Une tentative invalide ne consomme pas cette action quotidienne.

Exemples :
- cible inexistante ;
- soi-même ;
- joueur bloqué ;
- message refusé par validation/modération.

L'action est consommée uniquement lorsque le message est réellement accepté.

---

## R612 — Restitution des messages Event — ✅ VALIDÉ PERSONNALISÉ

Le fonctionnement prévu pour le chat interne et Twitch n'est pas remplacé par une messagerie privée UI.

Les messages Event continuent à pouvoir être restitués via le fonctionnement chat/Twitch correspondant au joueur.

En complément, l'écran Event possède une **zone dédiée aux messages Event du jour**.

Cette zone :
- n'est pas un chat temps réel ;
- n'est pas une boîte de MP ;
- présente une simple liste structurée des messages Event envoyés pendant la journée.

La visibilité exacte de cette liste entre joueurs sera précisée séparément lors de la poursuite de l'audit afin de ne pas inventer une règle de confidentialité non explicitement décidée.

---

## R613 — Reset quotidien de la liste UI — ✅ VALIDÉ PERSONNALISÉ

La zone dédiée R612 affiche les messages de la journée serveur courante.

À **00:00 Europe/Paris** :
- les messages de la journée précédente disparaissent de cette liste UI ;
- la nouvelle journée commence avec une liste vide.

Ce reset de présentation ne doit pas, à lui seul, casser une éventuelle livraison chat/Twitch encore en attente.

La visibilité quotidienne UI et l'état technique de livraison vers un canal sont donc deux responsabilités distinctes.

---

# 23. Décisions techniques acquises

- Les douze Festivals utilisent une configuration commune plutôt que douze implémentations métier copiées.
- Le changement de journée et de mois dépend du temps serveur `Europe/Paris`.
- `monthly_events.json` reste considéré comme fichier vide / résidu sans fonctionnalité V1 tant que le sweep final n'apporte aucune preuve contraire.
- `monthlyDraw` ne devient pas un tirage mensuel V1 sans preuve d'une mécanique réellement existante.
- Le cooldown de 3 secondes du Jeu A est imposé côté serveur et partagé entre UI, chat interne et Twitch.
- Les soldes de monnaie sont identifiés par Festival / monnaie saisonnière afin de pouvoir survivre jusqu'à l'édition suivante.
- La réclamation quotidienne R602 est idempotente et commune aux canaux.
- La notification de dernier jour R597 est dédupliquée par joueur et édition du Festival.
- Pour le Jeu B, la première requête correcte validée côté serveur devient le découvreur ; la résolution, l'attribution collective et le marquage `found` sont atomiques.
- Deux requêtes simultanées ne peuvent jamais distribuer deux fois les récompenses du Jeu B.
- La liste UI quotidienne du Jeu C et la file technique de livraison chat/Twitch sont séparées afin que le reset visuel de minuit n'entraîne pas une perte involontaire.

---

# 24. Points produit encore ouverts

Reprendre à **R614**.

À traiter notamment :

- visibilité exacte de la liste quotidienne des messages du Jeu C ;
- maintien ou évolution des paliers 10/20/30/40/50/60/70/80 ;
- valeurs de la boutique Event ;
- vraie règle d'achat et de conservation des objets de collection ;
- relation entre ancienne monnaie saisonnière conservée et nouvelle édition annuelle ;
- calendrier de décembre ;
- rattrapage éventuel des cases manquées ;
- classement mensuel ;
- éventuelles récompenses de classement ;
- historique des éditions précédentes ;
- présentation générale de l'écran Event ;
- contrats finaux de `!event` ;
- annonces de début/fin d'Event ;
- interaction avec les codes cadeaux mensuels ;
- migration de l'état Event actif au cutover ;
- changement de mois atomique ;
- producteurs / consommateurs finaux ;
- critères d'acceptation.

---

# 23. Sweep final obligatoire du projet

Même après clôture d'Event et des audits restants, le projet devra effectuer une passe exhaustive finale sur :

- les **36 scripts / commandes `.txt`** inventoriés ;
- les **17 fichiers JSON** inventoriés.

Objectif :

- vérifier qu'aucun système n'a été oublié ;
- recroiser les producteurs / consommateurs ;
- confirmer les champs considérés morts ou obsolètes ;
- détecter les dépendances transverses restantes ;
- confirmer la couverture des commandes ;
- préparer le modèle de données cible avec une couverture complète.

Le passage à la conception finale du modèle de données puis à la V1 ne doit avoir lieu qu'après ce sweep.
