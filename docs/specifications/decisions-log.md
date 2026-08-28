# Journal des décisions validées

Statut : évolutif.

## Identité joueur
- `VALIDÉ` — Le compte GachaImpact possède un ID interne immuable.
- `VALIDÉ` — Le pseudo GachaImpact est distinct du pseudo Twitch et peut être le pseudo affiché.
- `VALIDÉ` — Un compte Twitch peut être lié séparément.
- `VALIDÉ` — Le pseudo / identifiant Twitch nécessaire à la correspondance legacy doit être conservé.
- `VALIDÉ` — Un joueur sans Twitch doit profiter de 100 % du jeu.
- `VALIDÉ` — La première présence Twitch/legacy (`firstSeen`) est distincte de la date de création du compte GachaImpact ; aucune des deux notions ne doit écraser l'autre.
- `À DÉFINIR PLUS TARD` — La future notion globale de dernière activité / dernier vu sera conçue avec les domaines Compte / Social / Présence plutôt que de réutiliser aveuglément le `lastSeen` legacy.

## Migration
- `VALIDÉ` — Tous les historiques utiles, statistiques et dates sont migrés.
- `VALIDÉ` — Les bots connus (ex. StreamElements, WizeBot) sont exclus.
- `VALIDÉ` — Une donnée supposée obsolète n'est supprimée qu'après validation explicite.
- `VALIDÉ` — La migration doit pouvoir être relancée avec des JSON Streamer.bot plus récents sans duplication ni corruption.
- `VALIDÉ` — Le profil Kichnifou sert de référence fonctionnelle la plus complète pour le schéma actuel.
- `VALIDÉ` — Toutes les dates/timestamps legacy connus sont conservés tels quels ; une date manquante n'est jamais inventée et les historiques ne sont pas recalculés rétroactivement.
- `VALIDÉ` — Les timestamps legacy sans fuseau provenant de Streamer.bot doivent être interprétés comme `Europe/Paris` lors de l'import.
- `VALIDÉ` — Une incohérence historique entre `xp` et `level` doit être détectée et signalée dans le rapport de migration plutôt que corrigée silencieusement.

## XP
- `VALIDÉ` — Niveau maximal : 100.
- `VALIDÉ` — Après le niveau 100, l'XP/progression continue à produire les récompenses périodiques sans augmenter le niveau.
- `VALIDÉ` — Le code réel XP utilise 30 XP par palier, avec gains de +1/+2/+3 XP selon la longueur du message éligible et un cooldown de gain de 2 secondes (seuils exacts documentés dans `legacy/04-xp-audit.md`).
- `VALIDÉ` — Récompense de level-up V1 : +800 Primogemmes et +10 000 Moras à chaque palier ; à partir du niveau 5, +80 particules de l'élément personnel ; à partir du niveau 10, +40 particules d'un autre élément aléatoire.
- `VALIDÉ` — Les montants de level-up sont conservés pour la V1 et seront réévalués seulement lors d'un futur audit global de l'économie.
- `VALIDÉ` — Le gain d'XP par messages est conservé : +1/+2/+3 XP selon la longueur du message éligible, avec cooldown de 2 secondes ; une commande ne donne pas d'XP simplement parce qu'elle est envoyée dans le chat.
- `VALIDÉ` — Les actions ordinaires du jeu (Pull, Combat, Expédition, Banque, quotidiennes, Boutique, etc.) ne donnent pas directement d'XP, quel que soit leur canal de déclenchement UI/chat/Twitch.
- `VALIDÉ` — Le standalone disposera d'un mode ou d'une activité dédiée permettant de gagner de l'XP depuis l'interface, probablement via de petits mini-jeux / épreuves rapides avec un plafond quotidien.
- `VALIDÉ` — L'XP gagnée par le chat et celle gagnée via ce futur mode dédié sont cumulables.
- `À CONCEVOIR PLUS TARD` — Nom et contenu du mode XP, mini-jeux exacts, plafond quotidien, récompenses et équilibrage.
- `VALIDÉ` — Les tutoriels/découvertes liés aux montées de niveau sont conservés, mais leur présentation dépend de la source de l'XP : montée via chat → tutoriel dans le canal de chat concerné ; montée via le futur mode XP de l'interface → notification dans la zone Notifications orientant vers la fonctionnalité concernée.
- `VALIDÉ` — Les niveaux tutoriels legacy 1 à 10 constituent une base de découverte progressive ; ils ne prouvent pas à eux seuls l'existence d'un verrou métier, qui doit être confirmé lors de l'audit de chaque système.
- `VALIDÉ` — Les valeurs legacy de `stats.totalMessages` et `stats.countedMessages` sont migrées telles quelles, sans recalcul rétroactif.
- `VALIDÉ` — Dans GachaImpact, `totalMessages` compte les vrais messages envoyés par le joueur sur Twitch ou dans le chat interne, commandes comprises, mais exclut les réponses automatiques/bot/notifications système.
- `VALIDÉ` — Dans GachaImpact, `countedMessages` augmente uniquement lorsqu'un message donne réellement de l'XP ; l'XP gagnée via le futur mode dédié de l'interface ne l'incrémente pas.
- `VALIDÉ` — Le cooldown XP de 2 secondes est global au joueur entre Twitch et le chat interne GachaImpact afin d'empêcher le contournement par alternance de canaux.
- `VALIDÉ` — L'XP cumulée est la source de vérité métier du niveau joueur ; pour la V1, le niveau correspond à `min(floor(xp / 30), 100)`.
- `VALIDÉ` — `level100OverflowRewardsClaimed` doit être conservé à la migration, ou remplacé par un état strictement équivalent, afin d'éviter tout double paiement de récompenses d'overflow.
- `VALIDÉ` — Si une attribution d'XP franchit plusieurs niveaux, toutes les récompenses intermédiaires sont accordées.
- `VALIDÉ` — Les montées multiples déclenchées via le futur mode XP interface doivent être clairement représentées dans la liste Notifications ; plusieurs niveaux peuvent générer plusieurs notifications.
- `VALIDÉ` — Plusieurs paliers d'overflow niveau 100 gagnés simultanément doivent eux aussi être clairement représentés visuellement.
- `VALIDÉ` — L'XP joueur est cumulative, ne se dépense pas et ne se reset pas dans la V1 actuelle.
- `VALIDÉ` — Le futur équivalent de `lastMessageTime` représente uniquement le dernier message ayant réellement accordé de l'XP et sert au cooldown global Twitch/chat interne.
- `VALIDÉ` — La future information de dernière XP gagnée doit être mise à jour quelle que soit la source de l'XP : Twitch, chat interne ou mode XP interface.
- `FUTUR / À CONCEVOIR` — Une progression réelle au-delà du niveau 100 pourra éventuellement être étudiée plus tard.
- `FUTUR / À CONCEVOIR` — Une mécanique de prestige/rebirth pourra éventuellement être étudiée plus tard.

## Personnages / C6
- `VALIDÉ` — `constellation` reste plafonnée à C6.
- `VALIDÉ` — `copies` conserve le nombre historique total, y compris au-delà de C6.
- `À AUDITER DANS SCRIPT` — Les doublons après C6 peuvent augmenter des caractéristiques utilisées dans les concours.

## Bannière / invocation
- `VALIDÉ` — Une seule bannière active est présentée dans la nouvelle interface ; pas de sélecteur Permanent/Temporaire.
- `VALIDÉ` — La bannière hebdomadaire peut proposer plusieurs personnages 5★.
- `VALIDÉ` — Le joueur sélectionne une cible avant d'invoquer.
- `VALIDÉ` — Les joueurs peuvent voter chaque semaine pour influencer une future bannière.
- `À AUDITER DANS SCRIPT` — Règles exactes de sélection, pity, garantie, brillance, votes et rotation.

## Architecture
- `VALIDÉ` — Le navigateur ne détient jamais la sauvegarde autoritative.
- `VALIDÉ` — La logique métier doit être centralisée côté serveur.
- `VALIDÉ` — Bouton UI, commande chat GachaImpact et future commande Twitch doivent appeler la même action métier.
- `VALIDÉ` — Streamer.bot disparaît de la logique GachaImpact à terme.

## Banque
- `VALIDÉ` — L'intérêt bancaire quotidien reste fixé à **3 %** pour GachaImpact V1.
- `VALIDÉ` — L'intérêt est calculé automatiquement côté serveur chaque jour au reset global de **00:00 `Europe/Paris`**, sans nécessiter de connexion, message ou action du joueur.
- `VALIDÉ` — La base du calcul est le solde présent dans la banque exactement au moment du reset.
- `VALIDÉ` — L'intérêt est arrondi à l'entier inférieur.
- `VALIDÉ` — Les Moras gagnées par intérêt continuent à être comptabilisées dans l'équivalent futur de `stats.totalMorasEarned`.
- `VALIDÉ` — Un joueur absent continue à recevoir ses intérêts quotidiennement ; cette mécanique temporelle appartient au domaine Banque / scheduler serveur et ne doit plus dépendre du système XP.

## Ressources
- `VALIDÉ` — Les Primogemmes servent actuellement aux invocations / pulls.
- `VALIDÉ` — Les Moras sont utilisées au minimum pour la Boutique et la Banque ; les usages précis supplémentaires seront confirmés dans leurs audits dédiés.
- `VALIDÉ` — Le joueur peut posséder des particules des sept éléments.
- `VALIDÉ` — Les particules correspondant à l'élément personnel du joueur peuvent être converties manuellement en Primogemmes au taux 1:1.
- `VALIDÉ` — Toute quantité entière >= 1 peut être convertie dans la limite du stock disponible.
- `VALIDÉ` — Pour la V1 actuelle, les usages fondamentaux des particules restent Conversion et Échange ; ne pas inventer de nouvelle dépense pendant la migration.
- `VALIDÉ` — `Main` signifie l'élément personnel du joueur ; `totalMainElementParticlesEarned` compte les particules de cet élément générées comme récompense par le jeu.
- `VALIDÉ` — Une ressource reçue depuis un autre joueur par transfert/échange n'est pas considérée comme une ressource générée par le jeu.
- `VALIDÉ` — Les statistiques économiques legacy sont migrées telles quelles sans reconstruction rétroactive incertaine.
- `VALIDÉ` — Aucun solde de ressource ne peut devenir négatif.
- `VALIDÉ` — Aucun plafond artificiel de ressources n'est imposé en V1.
- `VALIDÉ` — Portefeuille Moras et Banque sont deux soldes distincts.
- `VALIDÉ` — Une dépense en Moras utilise le portefeuille ; la Banque n'est pas débitée automatiquement pour compléter un achat.
- `VALIDÉ` — La richesse Moras totale portefeuille + banque est une donnée dérivable, pas un champ à persister inutilement.
- `VALIDÉ` — Le nombre d'invocations possibles et les données équivalentes sont dérivés des sources réelles, pas stockés comme champs persistants.

## Statistiques économiques
- `VALIDÉ` — `totalPrimosEarned` représente les Primogemmes réellement créditées/générées par une opération du jeu.
- `VALIDÉ` — `totalPrimosSpent` représente les Primogemmes réellement consommées définitivement.
- `VALIDÉ` — `totalMorasEarned` représente les Moras réellement générées/créditées par le jeu.
- `VALIDÉ` — `totalMorasSpent` représente les Moras réellement consommées définitivement.
- `VALIDÉ` — Dépôt/retrait bancaire = transfert interne, pas gain/dépense.
- `VALIDÉ` — Le solde courant reste la source de vérité financière ; les compteurs cumulés sont des statistiques.
- `VALIDÉ` — À partir de GachaImpact, les mouvements importants de ressources sont journalisés côté serveur avec une cause/source.
- `VALIDÉ` — Les statistiques futures doivent être dérivées autant que raisonnablement possible depuis des transactions/événements fiables.

## Architecture économique
- `VALIDÉ` — Toute mutation de ressource passe par une logique métier centrale accompagnée de sa cause/source.
- `VALIDÉ` — Une opération économique multi-étapes importante doit être atomique/transactionnelle.
- `VALIDÉ` — Les opérations sensibles doivent être protégées contre double clic, retry réseau et double exécution accidentelle.
- `VALIDÉ` — Les mécaniques dépendant uniquement du temps ou de l'état serveur doivent fonctionner même lorsque le joueur est hors ligne.
- `VALIDÉ` — Toute donnée autoritative modifiée côté serveur doit être reflétée immédiatement dans toutes les zones pertinentes de l'UI sans F5.
- `VALIDÉ` — Distinguer conceptuellement ressources cœur, solde bancaire, objets/ressources spéciales, monnaies temporaires d'Events et collections/inventaire.
- `VALIDÉ` — Tous les domaines futurs donnant/consommant une ressource utilisent la logique centrale de mutation des ressources.
- `VALIDÉ` — Le domaine Ressources définit comment une ressource est mutée ; chaque domaine producteur/consommateur reste propriétaire de ses montants, probabilités et conditions.
- `VALIDÉ` — Domaine Élément / Ressources / Conversion / Échanges clôturé après R53.

## Fiche joueur / statistiques
- `VALIDÉ POUR LA DIRECTION ACTUELLE` — La fiche d'un autre joueur peut pour l'instant afficher ses ressources et ses statistiques ; des restrictions de confidentialité pourront être décidées ultérieurement.
- `VALIDÉ` — Les statistiques cumulatives peuvent alimenter un futur écran Statistiques joueur.
- `FUTUR / À CONCEVOIR` — Un écran de statistiques globales du jeu pourra également exploiter les données transactionnelles/historiques.

## Anomalies legacy à corriger
- `BUG LEGACY` — `totalMainElementParticlesEarned` n'est pas alimenté uniformément par tous les scripts générant des particules ; migrer la valeur historique telle quelle mais corriger toutes les nouvelles mutations GachaImpact.
- `BUG LEGACY À TRAITER DANS ROUE` — Divergence entre récompense Moras du code et message utilisateur ; code/message devront être alignés.
- `BUG LEGACY À TRAITER DANS PASSIF/GACHA` — Divergence entre la mécanique Dendro code/config et son texte de déclenchement ; logique/config/texte devront être alignés.

## Échanges de particules
- `VALIDÉ` — Les échanges restent un troc bilatéral entre joueurs d'éléments différents : chaque joueur donne des particules de l'élément de l'autre et reçoit des particules de son propre élément.
- `VALIDÉ` — L'auto-échange et l'échange entre deux joueurs du même élément sont interdits.
- `VALIDÉ` — Le taux d'échange est symétrique : X particules contre X particules.
- `VALIDÉ` — Une seule demande d'échange active peut exister entre une même paire de joueurs.
- `VALIDÉ` — Une demande en attente réserve uniquement le stock engagé par l'expéditeur ; le stock du destinataire n'est jamais bloqué avant acceptation.
- `VALIDÉ` — Le stock réellement échangeable correspond au stock total moins le stock réservé.
- `VALIDÉ` — L'UI devra afficher clairement le stock total, le stock réservé et le stock encore disponible lorsque pertinent.
- `VALIDÉ` — Une demande envoyée peut être annulée et une demande reçue peut être refusée/annulée ; la suppression libère immédiatement les réservations.
- `VALIDÉ` — Les demandes non résolues expirent au reset serveur quotidien à 00:00 `Europe/Paris`.
- `VALIDÉ` — L'expiration devient automatique côté serveur et ne dépend plus d'un message joueur comme dans le legacy.
- `VALIDÉ` — L'écran d'échange doit présenter séparément les demandes reçues et envoyées et permettre de traiter plusieurs demandes reçues.
- `VALIDÉ` — Les demandes reçues en attente utilisent une notification agrégée indiquant leur nombre ; cliquer dessus mène vers l'écran d'échange.
- `VALIDÉ` — Ne pas créer une notification séparée par demande d'échange.
- `VALIDÉ` — À la création, le destinataire doit néanmoins posséder suffisamment de stock disponible pour le montant demandé.
- `VALIDÉ` — Si le stock disponible du destinataire diminue après création, le montant courant de la demande diminue automatiquement pour rester réalisable.
- `VALIDÉ` — Si le montant réalisable tombe à 0, la demande est supprimée automatiquement et silencieusement.
- `VALIDÉ` — Une demande réduite ne remonte jamais automatiquement vers son montant initial.
- `VALIDÉ` — Toute réduction libère immédiatement la partie correspondante de la réservation de l'expéditeur.
- `VALIDÉ` — Plusieurs demandes reçues peuvent viser le même stock du destinataire, puisque ce stock n'est pas réservé avant acceptation.
- `VALIDÉ` — `Accepter tout` traite les demandes de la plus ancienne à la plus récente et réévalue dynamiquement les demandes restantes après chaque échange.
- `VALIDÉ` — Une demande ne peut pas être acceptée partiellement manuellement : elle est acceptée ou refusée pour son montant courant complet.
- `VALIDÉ` — `!echanger <pseudo>` sans montant conserve le comportement MAX ; dans l'UI, un bouton `MAX` remplit le champ quantité.
- `VALIDÉ` — `!echanger` et l'écran UI ne doivent proposer par défaut que les partenaires avec lesquels un échange est actuellement réellement possible.
- `VALIDÉ` — Dans le chat, la quantité réellement échangeable est affichée entre parenthèses à côté du pseudo.
- `VALIDÉ` — À partir de GachaImpact, conserver côté serveur un historique des événements importants d'échange pour sécurité, diagnostic et statistiques futures, sans inventer d'historique rétroactif legacy.
- `VALIDÉ` — L'historique serveur complet n'est pas exposé intégralement ; l'écran Échanges affiche seulement une fenêtre récente limitée à environ 20–30 transactions.
- `VALIDÉ` — Une résolution d'échange (acceptation, refus, annulation, réduction automatique, suppression à 0 ou expiration) ne crée pas de notification individuelle.
- `VALIDÉ` — L'écran Échanges affiche un historique récent des transactions : environ 3 visibles immédiatement, avec scroll jusqu'à environ 20–30 dernières transactions maximum.
- `VALIDÉ` — L'historique serveur complet reste disponible au-delà de cette fenêtre UI pour audit, diagnostic et statistiques futures.
- `VALIDÉ` — Ajouter une action `Refuser tout` pour les demandes reçues ; UI et future commande chat doivent appeler la même logique métier, syntaxe chat exacte à définir plus tard.
- `VALIDÉ` — Les demandes d'échange legacy encore en attente au cutover ne sont pas migrées et leurs réservations temporaires ne sont pas conservées.
- `VALIDÉ` — Les soldes réels de particules sont migrés indépendamment des demandes temporaires.
- `VALIDÉ` — Les demandes et historiques GachaImpact référencent les joueurs par leurs IDs internes immuables, jamais par leurs pseudos comme clés métier.
- `VALIDÉ` — Toute transaction modifiant un stock de particules doit réconcilier immédiatement les demandes affectées : réduction, suppression à 0 et libération de réservation si nécessaire.
- `FUTUR / À CONCEVOIR` — Un écran de statistiques joueur et éventuellement globales du jeu pourra exploiter ces données plus tard.
- `À CONCEVOIR EN PHASE 2` — Le stockage legacy dupliqué `sent` / `received` ne doit pas être copié automatiquement ; le futur modèle doit avoir une source de vérité unique pour la demande.

## Gacha / Invocation
- `VALIDÉ` — La bannière tourne automatiquement chaque lundi à 00:00 `Europe/Paris`, sans dépendre d'un message ou d'un joueur connecté.
- `VALIDÉ` — Une bannière contient 4 personnages 5★ et 6 personnages 4★.
- `VALIDÉ` — Les headers legacy parlant de 3×5★ / 5×4★ sont périmés ; le code réel de génération fait foi.
- `VALIDÉ` — Un personnage 5★ ou 4★ présent une semaine ne peut pas revenir immédiatement la semaine suivante.
- `VALIDÉ` — Trois des quatre 5★ sont tirés aléatoirement ; le quatrième provient du vote communautaire ou d'un fallback aléatoire.
- `VALIDÉ` — Le vote communautaire est un tirage pondéré par nombre de votes et non une victoire automatique du premier.
- `VALIDÉ` — Un joueur possède un seul vote par semaine et ne peut plus le modifier après validation.
- `VALIDÉ` — Le vote porte uniquement sur des personnages 5★ non présents dans la bannière actuelle.
- `VALIDÉ` — Le joueur doit sélectionner un des quatre 5★ actifs avant de pouvoir invoquer.
- `VALIDÉ` — La cible peut être changée librement à tout moment hors opération de Pull en cours.
- `VALIDÉ` — À chaque nouvelle rotation hebdomadaire, l'ancienne cible est vidée et le joueur choisit à nouveau.
- `VALIDÉ` — UI : sans cible, présenter les quatre 5★ disponibles ; après sélection, afficher le grand artwork du personnage ciblé avec un bouton `Changer`.
- `VALIDÉ` — UI : les six 4★ actifs restent visibles sur la bannière principale, par exemple sous forme de petites vignettes/portraits.
- `VALIDÉ` — 160 Primogemmes par Pull.
- `VALIDÉ` — UI : x1 et x10 ; aucune remise sur le x10.
- `VALIDÉ` — Chat/Twitch : `!pull` ou `!pull 1..10`.
- `VALIDÉ` — Pity 5★ : 0,6 % jusqu'au 73e ; 6,6 % au 74e ; +6 points de pourcentage par Pull ensuite ; garantie au 90e ; reset lors d'un 5★.
- `VALIDÉ` — Pity 4★ : 1,5 % jusqu'au 8e ; 19,5 % au 9e ; garantie au 10e ; reset lors d'un 4★.
- `VALIDÉ` — Si les jets 5★ et 4★ réussissent ensemble, le 5★ est prioritaire et la pity 4★ n'est pas reset.
- `VALIDÉ` — Pity 5★, pity 4★, garantie et Capture traversent les changements de bannière et les changements de cible.
- `VALIDÉ` — Sans 4★/5★ : 50 % Moras aléatoires 5 000–15 000 ; 50 % particules aléatoires 20–80 dans un élément aléatoire, avant prise en compte des passifs.
- `VALIDÉ` — L'animation UI ne décide jamais du résultat : le Pull complet doit être calculé/persisté côté serveur avant sa révélation.
- `VALIDÉ` — UI : animation d'invocation avec anticipation de rareté, signal doré lorsqu'au moins un 5★ est présent, révélation progressive, skip et récapitulatif final.
- `VALIDÉ` — Twitch/chat conserve une restitution textuelle rapide, résultat par résultat, sans animation.
- `VALIDÉ` — `Wish.txt` n'appartient pas au Gacha : il relève du Giveaway Twitch et reste conservé pour un audit ultérieur.
- `VALIDÉ` — Prévoir une synchronisation périodique automatique du catalogue des personnages Genshin, sans validation humaine obligatoire pour chaque ajout.
- `VALIDÉ` — Ne pas importer automatiquement un candidat incomplet/non sorti : release vérifiée, rareté et élément notamment obligatoires.
- `VALIDÉ` — Rechercher également la localisation française officielle/fiable des informations importées.
- `VALIDÉ` — Les personnages importés correctement apparaissent naturellement dans l'écran Personnages.
- `VALIDÉ` — Prévoir une vue Admin/Modérateur permettant de corriger/ajouter/supprimer des entrées catalogue et d'effectuer des corrections de ressources/personnages sur un ou plusieurs joueurs.
- `VALIDÉ` — Les changements administratifs sensibles devront être protégés et journalisés.
- `À SPÉCIFIER` — Les champs propres à GachaImpact comme classe/passif ne doivent jamais être inventés par une source externe ; leur traitement automatique reste à concevoir.
- `VALIDÉ` — Un 50/50 perdu donne aléatoirement l'un des trois autres 5★ actifs de la bannière.
- `VALIDÉ` — Une perte de 50/50 active la garantie du prochain 5★ ciblé.
- `VALIDÉ` — La garantie normale est consommée avant une Capture de brillance à 3/3 et ne modifie pas `captureProgress`.
- `VALIDÉ` — `captureProgress` est distinct de `fiftyFiftyLostStreak`.
- `VALIDÉ` — Perte de vrai 50/50 : `captureProgress +1`, maximum 3.
- `VALIDÉ` — Victoire de vrai 50/50 : `captureProgress -1`, minimum 0.
- `VALIDÉ` — Déclenchement de Capture : cible garantie puis `captureProgress = 0`.
- `VALIDÉ` — `fiftyFiftyLostStreak` représente seulement les vrais 50/50 perdus consécutivement et revient à 0 lors d'une vraie victoire ; il peut dépasser 3.
- `VALIDÉ` — `fiftyFiftyWon` et `fiftyFiftyLost` ne comptent que de vrais tirages 50/50.
- `BUG LEGACY CORRIGÉ` — Une Capture ne doit plus incrémenter `fiftyFiftyWon`.
- `VALIDÉ` — Ajouter `capturesTriggered` pour les Captures réellement déclenchées depuis GachaImpact.
- `VALIDÉ` — Garantie/Capture concernent toujours la cible actuellement sélectionnée.
- `VALIDÉ` — Plusieurs 5★ dans un x10 sont résolus séquentiellement.
- `VALIDÉ` — Seule la team active fournit les passifs ; maximum deux stacks par élément ; plusieurs éléments peuvent être actifs ensemble.
- `VALIDÉ` — Pyro : ×1,25 / ×1,5 sur les particules de récompense secondaire uniquement.
- `VALIDÉ` — Geo : ×1,25 / ×1,5 sur les Moras de récompense secondaire uniquement.
- `VALIDÉ` — Hydro : +0,3 / +0,6 point de pourcentage de chance 5★.
- `VALIDÉ` — Cryo : 1/20 ou 1/10 de +1 XP par Pull via le moteur XP central.
- `VALIDÉ` — Electro : 1/30 ou 1/20 de +2 pity 5★, appliqué après résolution du Pull.
- `VALIDÉ` — Anemo : 1/12 ou 1/8 de remboursement de 80 Primogemmes.
- `VALIDÉ` — Dendro : 1/25 ou 1/15 de +40 Primogemmes, +1 000 Moras et +5 particules de chacun des sept éléments.
- `BUG LEGACY CORRIGÉ` — Le texte Dendro doit être aligné sur la mécanique réelle et ne plus parler de particules aléatoires.
- `VALIDÉ` — Plusieurs passifs peuvent proc sur le même Pull et chaque Pull d'un x10 possède ses propres tests de passifs.
- `VALIDÉ` — 1re copie = C0 ; 7e = C6 ; `copies` continue après C6.
- `VALIDÉ` — Doublon C6+ : remboursement 4★ = 80 Primogemmes ; remboursement 5★ = 160 Primogemmes.
- `VALIDÉ` — Doublon 5★ C6+ : +1 stat Concours aléatoire encore sous 20 ; si toutes sont à 20, compensation actuelle +100 000 Moras.
- `VALIDÉ` — Lorsqu'un 5★ atteint C6, ses cinq statistiques Concours sont initialisées à 1.
- `VALIDÉ` — La future section Concours n'apparaît qu'aux joueurs possédant au moins un personnage 5★ C6.
- `VALIDÉ` — Un x10 est intégralement calculé et persisté atomiquement avant toute animation.
- `VALIDÉ` — Un crash/fermeture pendant l'animation n'annule jamais les récompenses déjà persistées.
- `VALIDÉ` — Un résultat 4★ est choisi uniformément parmi les six 4★ actifs, sans cible/protection anti-répétition.
- `VALIDÉ` — Une bannière invalide/incomplète ne doit jamais être activée.
- `VALIDÉ` — Conserver tout l'historique détaillé des Pulls depuis GachaImpact.
- `VALIDÉ` — Historique Invocation : 10 résultats par page, pagination serveur, pas de purge automatique à un an.
- `VALIDÉ` — Les statistiques Gacha legacy sont migrées telles quelles sans reconstruction rétroactive.
- `VALIDÉ` — `captureProgress` est initialisé depuis l'état legacy disponible au cutover ; `capturesTriggered` démarre à 0.
- `VALIDÉ` — `lastPullWasFiveStar` devient une donnée dérivable depuis l'historique natif.
- `VALIDÉ` — Conserver les notions Early et Back-to-back ; ajouter Hard à partir de pity 80.
- `VALIDÉ` — Ces mentions restent principalement destinées au chat ; un effet UI temporaire pourra éventuellement être ajouté plus tard.
- `VALIDÉ` — Les statistiques Early / Back-to-back / Hard pourront être dérivées de l'historique.
- `VALIDÉ` — Les multiplicateurs Pyro/Geo utilisent un arrondi à l'entier le plus proche avec `.5` vers le haut.
- `À AUDITER` — Derniers edge cases Bannière / Vote / Select / Pity avant clôture éventuelle du domaine Gacha.

## Notifications
- `VALIDÉ` — Toute notification doit pouvoir être supprimée manuellement par le joueur via une petite croix affichée au survol.
- `VALIDÉ` — Les notifications lues qui n'ont pas été supprimées manuellement sont nettoyées automatiquement au reset serveur quotidien.
- `VALIDÉ` — Une notification représentant un état dynamique peut réapparaître/redevenir non lue lorsqu'un nouvel événement pertinent survient.
- `VALIDÉ` — Pour les échanges, une seule notification agrégée représente le nombre total actuel de demandes reçues en attente.
- `VALIDÉ` — Si cette notification a été lue ou supprimée puis qu'une nouvelle demande arrive, elle est réaffichée en non-lue avec le nouveau total.

## Élément joueur
- `VALIDÉ` — Le joueur choisit son élément une seule fois au début du jeu.
- `VALIDÉ` — L'élément joueur est non modifiable ensuite.
- `VALIDÉ` — Il s'agit d'une donnée métier permanente, pas d'une préférence d'affichage.
- `VALIDÉ` — L'élément choisi détermine quelles particules sont ses particules attitrées.
- `VALIDÉ` — Dans l'application standalone, le choix de l'élément fait partie obligatoirement de l'inscription/onboarding afin que le joueur dispose immédiatement des prérequis élémentaires dès son premier niveau.
- `VALIDÉ` — Le verrou legacy « niveau 1 sans élément » ne s'applique pas au parcours standalone, puisque l'élément est déjà choisi pendant l'onboarding.

## Twitch / entrée dans le jeu
- `VALIDÉ` — Un nouveau chatter Twitch continue à être enregistré automatiquement dans les données du jeu lors de ses premiers messages, comme dans le legacy.
- `VALIDÉ` — Cet enregistrement Twitch passif n'équivaut pas à un compte standalone complètement onboardé.
- `VALIDÉ` — Le chatter Twitch peut progresser par les messages jusqu'au seuil d'onboarding ; direction produit : passage jusqu'au niveau 2.
- `VALIDÉ` — Si aucun élément n'a été choisi à ce stade, le jeu demande le choix d'un élément et bloque ensuite les mécaniques actives tant que ce choix n'est pas effectué.
- `VALIDÉ` — `!element <élément>` reste la porte d'activation naturelle du profil Twitch.
- `À SPÉCIFIER` — Le modèle technique d'un profil Twitch-only, sa future liaison à un compte GachaImpact et les règles anti-spam de rappel d'onboarding seront définis dans la spécification Auth/Twitch.

## Récompense quotidienne
- `VALIDÉ` — La récompense quotidienne est conservée durablement comme mécanique du jeu.
- `VALIDÉ` — V1 : +160 Primogemmes, +160 particules de l'élément du joueur et +10 000 Moras.
- `VALIDÉ` — Reset global quotidien à 00:00 dans le fuseau `Europe/Paris`.
- `VALIDÉ` — Une récompense quotidienne non réclamée est perdue ; les jours manqués ne s'accumulent pas.
- `VALIDÉ` — Une seule opération métier idempotente gère la réclamation, quel que soit le canal.
- `VALIDÉ` — La réclamation peut venir du bouton UI, du premier message éligible du chat GachaImpact, ou du premier message Twitch éligible d'un profil ayant choisi son élément.
- `VALIDÉ` — Le bloc en bas à gauche évolue vers un suivi des activités quotidiennes : navigation compacte par chevrons `‹` / `›`, masquage d'une proposition pour la journée, préférences d'affichage futures, puis état « tout est à jour » lorsque plus rien n'est à proposer.
- `VALIDÉ` — Le claim affiche un feedback visuel temporaire près des compteurs de ressources plutôt que de surcharger la carte avec les montants permanents.
- `VALIDÉ` — Conserver la date de dernière réclamation et, dans la nouvelle implémentation, la date de première réclamation ; pas d'historique quotidien détaillé dédié requis.
- `FUTUR / À CONCEVOIR` — Streak quotidien avec bonus après 7 jours consécutifs ; idée actuelle : +1 000 Primogemmes, +30 000 Moras, +800 particules de l'élément personnel. La règle exacte n'est pas encore figée.
- `FUTUR / À CONCEVOIR` — Des calendriers de connexion événementiels pourront proposer des récompenses différentes selon les jours pendant certains événements.

## Faveur
- `VALIDÉ` — Une Faveur GachaImpact est inspirée de la Blessing of the Welkin Moon, mais ses jours ne diminuent que lorsqu'une récompense est effectivement réclamée.
- `VALIDÉ` — Une absence ne consomme donc pas de jour de Faveur.
- `À AUDITER` — Les attributions par événements de stream et abonnements Twitch, ainsi que leur future intégration sans Streamer.bot, seront traitées dans le domaine Faveur/Twitch.