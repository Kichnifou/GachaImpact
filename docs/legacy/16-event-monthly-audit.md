# 16 — Audit Event / monthly

> Domaine 13 de l'audit GachaImpact.  
> Statut : **EN COURS — audit technique initial réalisé, premières décisions produit à reprendre à R594**.  
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

# 22. Points produit à auditer

Première reprise produit : **R594**.

À traiter notamment :

- conserver les douze événements fixes par mois ou changer le calendrier ;
- inscription explicite ou automatique ;
- reset / expiration de la monnaie au changement de mois ;
- maintien des trois mêmes archétypes de mini-jeux ;
- adaptation du Jeu A au standalone pour éviter le spam instantané ;
- mécanique collaborative du Jeu B et récompense des arrivants tardifs ;
- destinataires / confidentialité / blocage du Jeu C ;
- bonus quotidien Event indépendant du chat ;
- maintien des valeurs des paliers et de la boutique ;
- vraie règle annuelle des objets de collection ;
- calendrier de décembre et éventuel rattrapage ;
- classement et éventuel historique mensuel ;
- présentation UI Event ;
- contrats `!event` ;
- changement de mois atomique ;
- migration de l'état actif.

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
