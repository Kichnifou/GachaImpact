# GachaImpact — Cahier de suivi maître / Mega récap projet

Version : 0.12
Date : 2026-08-28
Statut : DOCUMENT MAÎTRE ÉVOLUTIF  
But : permettre à n'importe quel ChatGPT/Codex/agent ou développeur de comprendre rapidement l'état du projet, les décisions déjà prises, les contraintes, les sources legacy, et la feuille de route.

---

# 0. RÈGLE D'OR DU PROJET

Ce document doit être considéré comme une **mémoire externe centrale** du projet.

Il ne remplace pas les autres documents spécialisés dans `docs/`, mais il sert de :
- résumé global ;
- carte de navigation ;
- feuille de route ;
- historique des décisions majeures ;
- point de reprise rapide après une longue pause ;
- guide de contexte pour ChatGPT/Codex.

Quand une décision structurante change :
1. mettre à jour le document spécialisé concerné ;
2. mettre à jour ce document maître si la décision impacte la vision globale, l'architecture, les étapes, la migration ou l'organisation du projet.

Le projet ne doit pas dépendre de la mémoire d'une conversation.

---

# 1. VISION GLOBALE

## 1.1 Concept

GachaImpact est la transformation d'un ancien jeu Twitch/Streamer.bot inspiré de Genshin Impact en un vrai jeu web standalone.

Le jeu doit :
- fonctionner indépendamment de Twitch ;
- avoir sa propre interface graphique ;
- avoir de vrais comptes joueurs ;
- stocker les données dans une base de données serveur ;
- permettre d'utiliser les mécaniques par boutons/UI ;
- permettre aussi d'utiliser certaines mécaniques via un chat global interne ;
- permettre plus tard de lier un compte Twitch ;
- permettre à Twitch de devenir un canal d'entrée supplémentaire vers les mêmes mécaniques ;
- ne jamais obliger un joueur à avoir Twitch pour profiter du jeu.

Le but n'est donc PAS de faire une interface graphique au-dessus de Streamer.bot.

Le but est de créer un jeu complet, maintenable et centralisé, dont Twitch deviendra seulement une intégration optionnelle.

---

# 2. PROBLÈME PRINCIPAL DU SYSTÈME LEGACY

Le jeu actuel fonctionne via Streamer.bot.

Chaque commande est essentiellement un script indépendant.

Conséquences :
- beaucoup de logique dupliquée ;
- scripts difficiles à faire communiquer ;
- données parfois réparties dans plusieurs JSON ;
- certains scripts reconstruisent des infos qu'un autre script connaît déjà ;
- certaines données dérivables sont sauvegardées uniquement parce qu'un script avait besoin de les afficher ;
- maintenance fragile ;
- migrations de structure JSON progressives ;
- anciens joueurs pouvant avoir des sections absentes ;
- dépendance forte à Twitch et au modèle "un message déclenche une commande".

Le nouveau GachaImpact doit résoudre cela avec :
- fonctions centrales réutilisables ;
- logique métier serveur commune ;
- source de vérité unique ;
- base de données structurée ;
- services partagés ;
- même action métier appelée depuis plusieurs interfaces.

Exemple cible :

UI Invocation
        \
Chat GachaImpact !pull
          \
Twitch !pull
            \
             -> même service serveur Invocation
                         ->
                    mise à jour joueur
                         ->
                      résultat

Il ne doit jamais exister trois versions différentes de la logique du pull.

---

# 3. ÉTAT ACTUEL DU FRONTEND

## 3.1 Stack actuelle

Frontend :
- React
- TypeScript
- Vite

Projet local :
`C:\Users\axeld\Documents\GachaImpact`

Dépôt GitHub public :
`https://github.com/Kichnifou/GachaImpact`

Branche principale :
`main`

Le dépôt est versionné avec Git.

---

## 3.2 Interface réalisée

Une coque frontend responsive a été créée avec :

Navigation :
- Accueil
- Invocation
- Box
- Personnages
- Équipe
- Sac
- Boutique

Éléments globaux :
- sidebar joueur à gauche ;
- zone centrale dynamique ;
- chat global à droite ;
- notifications ;
- joueurs connectés ;
- navigation responsive ;
- panneau mobile ;
- chat repliable ;
- scroll interne plutôt que scroll global.

---

## 3.3 Direction UX validée

### Desktop
Objectif :
- pas de scroll global à 1920×1080 si évitable ;
- chaque grande zone doit tenir dans l'écran ;
- si du contenu est long, utiliser un scroll interne dans le panneau concerné ;
- gauche / centre / chat doivent paraître alignés et équilibrés verticalement.

### Mobile
Priorité :
- zone centrale ;
- chat accessible en dessous ou via panneau ;
- sidebar consultable comme volet ;
- possibilité future d'épingler ou non certains panneaux ;
- aucun overflow horizontal.

---

## 3.4 Sidebar gauche

Contient actuellement :
- pseudo joueur ;
- niveau / XP ;
- ressources principales ;
- primogemmes ;
- moras ;
- particules élémentaires ;
- équipe active ;
- objectif actuel / cible de bannière ;
- pity 5★ ;
- pity 4★ ;
- garantie ;
- brillance ;
- suivi des activités quotidiennes (actuellement présenté comme récompense quotidienne).

Décisions :
- le label "Voyageur" a été supprimé ;
- l'ancienne ligne de voeux possibles a été retirée ;
- les étoiles d'un personnage doivent être placées sous son nom ;
- la Capture de brillance doit être représentée par un compteur `X / 3` ;
- le compteur de brillance doit être placé avec les informations de garantie/pity ;
- la sidebar ne doit pas afficher une scrollbar au chargement normal 1920×1080 ;
- les chevrons permettent d'aller vers les écrans correspondants.
- le bloc du bas évolue vers un **suivi quotidien général** : la récompense quotidienne n'est qu'une activité parmi d'autres (combat, roue, etc.) ;
- navigation de ce petit bloc par chevrons compacts `‹` / `›` plutôt que par boutons texte « Précédent / Suivant » ;
- possibilité de masquer une proposition pour la journée ;
- préférences futures permettant de choisir les types de quotidiennes à afficher ;
- quand toutes les propositions pertinentes sont terminées ou masquées, le bloc reste visible avec un état du type « Tout est bon, tu es à jour ».

---

## 3.5 Chat global

Le chat :
- reste visible sur tous les écrans desktop ;
- peut être replié ;
- peut afficher un compteur de messages non lus ;
- doit devenir un vrai chat interne plus tard ;
- est indépendant de Twitch à terme ;
- pourra recevoir plus tard certains messages Twitch via pont optionnel.

Présence joueurs :
- le nombre de joueurs en ligne est affiché dans le chat ;
- cliquer dessus ouvre un petit panneau ;
- futur : ajouter/enlever un ami ;
- futur : aller vers espace social ;
- futur : cliquer sur un joueur pour voir sa fiche.

---

## 3.6 Notifications

Décision :
- cloche en haut ;
- pastille si notifications non lues ;
- clic -> panneau overlay ;
- fermeture possible par clic extérieur ;
- possibilité future de marquer lu / archiver ;
- clic sur notification -> écran concerné ;
- possibilité future d'un écran Notifications dédié.

État frontend actuel :
- la coque React possède déjà le panneau Notifications dans `GameHeader.tsx` ;
- la liste est actuellement alimentée par des données fictives de `src/data/mockData.ts` ;
- le compteur visible est encore statique dans le prototype ;
- le type actuel de notification est minimal et ne contient pas encore toute la navigation métier future ;
- ces mocks devront être remplacés plus tard par de vraies notifications provenant du backend.

Décision progression :
- lorsqu'un gain d'XP obtenu via le futur mode interface fait franchir plusieurs niveaux, les notifications de level-up s'ajoutent à cette liste ;
- plusieurs niveaux franchis peuvent produire plusieurs notifications afin que chaque progression reste visible ;
- les paliers d'overflow multiples au niveau 100 doivent également être présentés clairement.
Décisions générales notifications :
- toute notification peut être supprimée manuellement via une petite croix apparaissant au survol ;
- une notification consultée peut être marquée comme lue sans nécessairement disparaître immédiatement ;
- les notifications lues encore présentes sont nettoyées automatiquement au reset serveur quotidien ;
- une notification dynamique supprimée/lue peut réapparaître en non-lue si un nouvel événement pertinent survient.

Échanges :
- une seule notification agrégée représente les demandes d'échange reçues en attente ;
- elle affiche le nombre total courant ;
- clic -> futur écran Échanges ;
- si une nouvelle demande arrive, la notification réapparaît/redevient non lue avec le nouveau total ;
- les demandes expirant au reset quotidien, cette notification disparaît également lorsqu'il ne reste plus de demande.
- acceptation, refus, annulation, réduction automatique ou expiration d'une demande ne génèrent pas de notification individuelle ;
- le détail des échanges récemment réalisés est consultable directement dans l'écran Échanges.

---

# 4. ÉCRAN INVOCATION — DIRECTION VISUELLE VALIDÉE

Le prototype visuel constitue une base UX, mais n'est jamais une source de vérité métier.

Direction principale :
- un seul type de bannière active ;
- rotation hebdomadaire ;
- 4 personnages 5★ ;
- 6 personnages 4★ ;
- cible 5★ personnelle obligatoire avant Invocation.

## 4.1 État sans cible

Après une nouvelle rotation :
- l'ancienne cible est vidée ;
- présenter les 4 personnages 5★ disponibles ;
- le joueur choisit celui qu'il souhaite cibler ;
- aucune sélection automatique à sa place.

Direction UX :
- présentation visuelle des quatre choix ;
- inspiration possible des écrans de sélection des bannières nostalgiques de Genshin ;
- ne pas copier aveuglément le jeu d'origine.

## 4.2 État avec cible

Après sélection :
- grande bannière visuelle ;
- artwork très grand du personnage ciblé ;
- artwork intégré comme fond/composition ;
- texte et gradient adaptés à la lisibilité ;
- nom et rareté du personnage ciblé ;
- bouton `Changer` permettant de rouvrir la sélection à tout moment ;
- les 6 personnages 4★ actifs restent visibles, par exemple via de petites vignettes/portraits en bas ;
- pity 5★ ;
- pity 4★ ;
- garantie 5★ ;
- Capture de brillance ;
- Invocation x1 ;
- Invocation x10.

Décisions :
- aucun sélecteur Permanent / Temporaire ;
- aucune « Bannière permanente » ;
- coût : 160 Primogemmes par Pull ;
- x10 = 1 600 Primogemmes, sans remise.

## 4.3 Animation d'Invocation

Standalone :
- le serveur calcule et persiste le Pull avant toute animation ;
- un x10 calcule séquentiellement les dix Pulls puis persiste l'ensemble atomiquement ;
- l'animation ne décide jamais du résultat ;
- crash/fermeture pendant l'animation n'annule aucune récompense déjà validée ;
- à la reconnexion, l'état joueur reflète immédiatement les résultats acquis ;
- séquence de lancement ;
- signal visuel de rareté ;
- doré si le résultat/x10 contient au moins un 5★ ;
- révélation résultat par résultat ;
- 5★ avec présentation plus spectaculaire ;
- skip possible ;
- récapitulatif final.

Early / Back-to-back / Hard :
- principalement conservés comme mentions chat ;
- aucune information permanente supplémentaire requise dans l'UI ;
- possibilité future d'une petite mention/animation temporaire si souhaité.

Twitch/chat :
- aucune animation ;
- restitution textuelle rapide résultat par résultat ;
- même résultat métier serveur.

## 4.4 Historique d'Invocation

Prévoir un bouton `Historique` sur l'écran Invocation.

Ouverture :
- fenêtre/panneau superposé ;
- 10 résultats par page ;
- page 1 = les 10 Pulls les plus récents ;
- pagination vers les Pulls plus anciens.

Stockage :
- conserver tout l'historique détaillé depuis le lancement de GachaImpact ;
- pas de purge automatique annuelle par défaut ;
- pagination côté serveur ;
- si la volumétrie l'exige un jour, possibilité d'archivage technique sans retirer l'accès aux anciennes données.

Le legacy ne permet pas de reconstruire précisément chaque ancien Pull.

Référence d'intention visuelle :
`https://www.youtube.com/watch?v=Zea_pd2AXEY`

---

# 5. ÉCRAN ACCUEIL

L'écran Accueil contient :
- une version compacte de la bannière Invocation ;
- des raccourcis :
  - Box
  - Personnages
  - Équipe
  - Sac
  - Boutique

Décisions :
- ordre `Box` avant `Personnages` ;
- bannière d'accueil cohérente avec l'écran Invocation ;
- mêmes données de pity / garantie / brillance ;
- mêmes personnage et artwork ;
- les raccourcis doivent exploiter la hauteur sans scroll global.

---

# 6. BOX / PERSONNAGES / ÉQUIPE / SAC / BOUTIQUE

## 6.1 Box
But :
- montrer uniquement les personnages possédés ;
- grille de cartes ;
- filtres ;
- tri ;
- recherche ;
- éléments ;
- rareté ;
- constellation.

## 6.2 Personnages
But :
- montrer tous les personnages obtenables ;
- coloré si possédé ;
- grisé si non possédé ;
- grille + filtres + tri ;
- inutile d'avoir un bandeau séparé "possédé / non possédé" si le visuel suffit.

## 6.3 Équipe
But :
- 4 slots actifs ;
- hover PC / tap mobile ;
- actions :
  - Fiche
  - Changer
  - Retirer
  - Ajouter si slot vide
- possibilité future d'afficher passifs/synergies.

## 6.4 Sac
But :
- garder les ressources essentielles dans la sidebar ;
- afficher dans Sac une vue plus complète ;
- catégories ;
- monnaies ;
- particules ;
- objets ;
- ressources spéciales ;
- événements.

## 6.5 Boutique
Prototype visuel déjà présent.
La logique réelle sera auditée via `Shop.txt` + `shop_items.json`.

---

# 7. ASSETS INTÉGRÉS

Structure publique créée :

`public/assets/genshin/`

Sous-dossiers :
- `characters/icons`
- `characters/splash`
- `characters/wish`
- `characters/fullbody`
- `elements`
- `currencies`
- `items`
- `ui`
- `metadata`

Volumes actuels :
- icons : 98
- splash : 98
- wish : 98
- fullbody : 118

Éléments :
- anemo
- cryo
- dendro
- electro
- geo
- hydro
- pyro
- variantes badge

Monnaies :
- primogem
- mora
- acquaint-fate
- intertwined-fate

Mapping :
- `gi_characters.json`
- `gachaimpact_characters.json`
- `asset_mapping_report.json`

Résultat du mapping :
- 118 / 118 fullbody correctement mappés ;
- 96 personnages ont aussi icon/splash/wish historiques ;
- 22 plus récents utilisent notamment fullbody ;
- aucun doublon de chemin ;
- aucun ambiguous pour fullbody.

---

# 8. SOURCES LEGACY INTÉGRÉES AU PROJET

Chemin :
`legacy/streamerbot/`

## 8.1 Commandes
`legacy/streamerbot/commands/`

36 fichiers :
- Ami
- Banniere
- Banque
- Box
- Code
- Coffre
- Combat
- Concours
- Convertir
- Daily
- Echanger
- Element
- Event
- Expedition
- Faveur
- Gift
- Help
- Infos
- Legende
- Liste
- Missions
- Obtention
- Passif
- Pity
- Pull
- Roue
- Sac
- Select
- Shop
- Stella
- Subscription
- Team
- Top
- Vote
- Wish
- XP

Règle d'analyse :
- lire le commentaire d'en-tête ;
- NE JAMAIS supposer qu'il est complet ;
- toujours inspecter le code réel ;
- relever les ajouts non documentés ;
- relever les données lues/écrites ;
- relever les duplications de logique ;
- relever les dépendances.

---

## 8.2 Data
`legacy/streamerbot/data/`

17 JSON :
- banner_votes.json
- c6_characters.json
- combat_config.json
- combat_data.json
- contests_data.json
- element_passives.json
- friendships_data.json
- genshin_characters.json
- gift_codes.json
- giveaway.json
- long_missions.json
- missions_pool.json
- monthly_boss.json
- monthly_events.json
- monthly_events_data.json
- shop_items.json
- viewers_data.json

Décision importante :
- le modèle joueur complet ne vit PAS uniquement dans `viewers_data.json` ;
- certaines données sont réparties entre plusieurs JSON ;
- il faut reconstruire le profil agrégé complet.

---

# 9. PROFIL CANONIQUE LEGACY : KICHNIFOU

Décision :
- `Kichnifou` est la référence principale pour comprendre le modèle joueur actuel ;
- raison : profil très actif, passé par les versions les plus récentes, contenant le maximum de sections ;
- les autres profils servent à détecter :
  - anciennes structures ;
  - champs manquants ;
  - null ;
  - sections ajoutées plus tard ;
  - cas limites de migration.

Important :
- ne pas copier aveuglément Kichnifou en schéma SQL ;
- utiliser Kichnifou comme photographie la plus complète du modèle métier actuel ;
- vérifier chaque champ avec le script qui le manipule avant de figer la cible.

---

# 10. IDENTITÉ JOUEUR — DÉCISIONS VALIDÉES

Le futur compte GachaImpact doit avoir :
- ID interne immuable ;
- pseudo GachaImpact choisi par le joueur ;
- pseudo GachaImpact affiché dans le jeu ;
- liaison Twitch optionnelle ;
- conservation du pseudo / identifiant Twitch pour correspondance legacy.

Le pseudo Twitch ne devient PAS automatiquement le pseudo GachaImpact.

Un joueur peut jouer sans Twitch.

Pour récupérer son ancien profil Streamer.bot :
- il crée/se connecte à un compte GachaImpact ;
- il lie son Twitch ;
- le système retrouve le profil legacy correspondant ;
- les données sont importées.

Bots connus :
- StreamElements
- WizeBot
- autres bots identifiés
=> exclus de la migration.

### Entrée Twitch sans compte standalone
Décision :
- lorsqu'une personne parle pour la première fois sur Twitch, elle continue à être enregistrée dans les données du jeu comme dans le legacy ;
- cet enregistrement passif ne constitue pas encore un compte GachaImpact standalone complet ;
- elle peut progresser via ses messages jusqu'au seuil d'onboarding Twitch ; direction validée : niveau 2 ;
- si elle n'a pas choisi d'élément à ce stade, le jeu lui demande de le faire puis bloque les mécaniques actives tant que l'élément n'est pas choisi ;
- `!element <élément>` reste la porte d'activation naturelle du profil Twitch ;
- la représentation technique de ce profil Twitch-only et sa future fusion/liaison avec un compte GachaImpact seront spécifiées plus tard.

---

# 11. PROGRESSION JOUEUR

## 11.1 Niveau
- niveau max : 100 ;
- 30 XP par palier ;
- gain par message éligible selon longueur : +1 XP jusqu'à 100 caractères, +2 XP de 101 à 200, +3 XP au-delà ;
- au niveau 100 :
  - le niveau reste 100 ;
  - la progression continue ;
  - une récompense d'overflow est redonnée tous les 30 XP supplémentaires.

Récompense de level-up V1 validée :
- +800 primogemmes ;
- +10 000 moras ;
- à partir du niveau 5 : +80 particules de l'élément personnel ;
- à partir du niveau 10 : +40 particules d'un autre élément aléatoire.

Ces montants sont conservés pour la V1 ; l'équilibrage global de l'économie sera traité plus tard.

Direction standalone validée :
- le gain d'XP par messages est conservé avec les règles legacy actuelles : +1/+2/+3 XP selon la longueur du message éligible et cooldown de 2 secondes ;
- les commandes et les actions ordinaires du jeu ne donnent pas directement d'XP ;
- cette règle reste identique quel que soit le canal utilisé pour déclencher une mécanique : UI, chat interne ou Twitch ;
- le standalone disposera d'un mode/activité dédié permettant aux joueurs utilisant principalement l'interface de gagner de l'XP, probablement sous forme de mini-jeux ou d'épreuves rapides ;
- ce mode disposera d'un plafond quotidien d'XP à définir ;
- XP chat et XP du mode dédié sont cumulables ;
- nom, contenu, plafond et équilibrage de ce mode seront conçus plus tard.

Compteurs de messages validés :
- conserver les valeurs legacy `totalMessages` et `countedMessages` à la migration sans recalcul ;
- `totalMessages` = vrais messages envoyés par le joueur sur Twitch ou dans le chat interne, commandes comprises, hors réponses bot/système ;
- `countedMessages` = messages ayant réellement donné de l'XP ;
- l'XP du futur mode interface n'incrémente pas `countedMessages` ;
- cooldown XP de 2 secondes global au joueur entre Twitch et chat interne.

Tutoriels de niveau validés :
- conserver la découverte progressive historique associée aux montées de niveau ;
- montée provoquée par XP de chat → tutoriel dans le canal de chat concerné ;
- montée provoquée par le futur mode XP de l'interface → notification dans la zone Notifications avec orientation vers la fonctionnalité concernée ;
- les messages tutoriels legacy ne sont pas considérés comme preuve d'un verrou métier : les prérequis exacts seront confirmés dans les audits dédiés.
Source de vérité progression validée :
- l'XP cumulée est la source de vérité métier du niveau ;
- formule V1 : `niveau = min(floor(xp / 30), 100)` ;
- le niveau ne doit pas évoluer indépendamment de l'XP ;
- pendant la migration, une incohérence XP/niveau doit être signalée plutôt que corrigée silencieusement.

Gains multi-paliers validés :
- une attribution d'XP peut faire franchir plusieurs niveaux ;
- toutes les récompenses de chaque niveau intermédiaire doivent être attribuées ;
- toutes les découvertes/tutoriels concernés restent traités ;
- une montée multiple via le futur mode XP interface doit être clairement visible dans la liste Notifications.

Niveau 100 :
- conserver `level100OverflowRewardsClaimed` legacy ou un état futur strictement équivalent ;
- plusieurs paliers d'overflow gagnés en une fois donnent toutes les récompenses correspondantes ;
- leur multiplicité doit être clairement visible pour le joueur.

XP V1 :
- cumulative ;
- non dépensable ;
- aucun reset.

Idées futures uniquement :
- niveau réel supérieur à 100 ;
- prestige / rebirth.

## 11.2 Niveau des personnages
Actuellement :
- les personnages NE MONTENT PAS DE NIVEAU.

Idée future :
- ajouter un système de niveaux/progression des personnages.
Statut :
- FUTUR / À CONCEVOIR
- ne pas inventer de modèle maintenant.

---

# 12. ÉLÉMENT DU JOUEUR

Le joueur choisit un élément au début via `!element`.

Valeurs :
- Pyro
- Hydro
- Cryo
- Electro
- Anemo
- Geo
- Dendro

Règles validées :
- choix unique ;
- non modifiable ensuite ;
- donnée métier permanente ;
- détermine les particules attitrées du joueur ;
- dans l'application standalone, le choix de l'élément est obligatoire pendant l'inscription/onboarding ;
- le joueur possède donc déjà un élément lorsqu'il se trouve au niveau 1 ; le verrou legacy « niveau 1 sans élément » ne s'applique pas au parcours standalone ;
- côté Twitch, un nouveau chatter peut être enregistré et progresser jusqu'au seuil d'onboarding (direction validée : niveau 2), puis les mécaniques actives sont bloquées tant que `!element` n'a pas été utilisé.

Exemple :
joueur Cryo
=> particules Cryo = particules personnelles.

Particules personnelles :
- convertibles manuellement en Primogemmes ;
- taux V1 validé : 1:1 ;
- toute quantité entière >= 1 dans la limite du stock ;
- logique métier unique accessible depuis UI / chat interne / Twitch.

Particules des autres éléments :
- échangeables avec des joueurs d'un élément différent ;
- échange symétrique X contre X ;
- stock disponible = total - réservé ;
- une seule demande active entre une même paire ;
- règles détaillées documentées dans `docs/legacy/05-element-resources-audit.md`.

---

# 13. RESSOURCES

## 13.1 Primogemmes
Usage actuel validé :
- uniquement pour les pulls / invocations.

## 13.2 Moras
### Intérêt bancaire V1 — décision validée
- taux quotidien conservé : **3 %** ;
- calcul automatique côté serveur au reset global de **00:00 `Europe/Paris`** ;
- aucune activité du joueur n'est nécessaire ;
- base de calcul : solde bancaire présent exactement au moment du reset ;
- arrondi à l'entier inférieur ;
- les gains alimentent également l'équivalent futur de `stats.totalMorasEarned` ;
- les intérêts continuent donc à être appliqués quotidiennement même lorsque le joueur est absent.

Principe architectural associé :
une mécanique dépendant uniquement du temps serveur ne doit plus être artificiellement déclenchée par un message ou une autre action joueur lorsque le backend peut l'exécuter lui-même.

## 13.3 Particules
7 types élémentaires :
- Pyro
- Hydro
- Cryo
- Electro
- Anemo
- Geo
- Dendro

Conversion V1 validée :
- le joueur peut posséder les sept types ;
- seules les particules correspondant à son élément personnel sont directement convertibles ;
- taux : 1 particule = 1 Primogemme ;
- conversion volontaire/manuelle ;
- toute quantité entière >= 1 dans la limite du stock.

Échanges V1 — décisions déjà validées :
- uniquement entre joueurs d'éléments différents ;
- chacun donne des particules de l'élément de l'autre ;
- chacun reçoit donc des particules de son propre élément ;
- échange symétrique X contre X ;
- auto-échange interdit ;
- une seule demande active entre une même paire ;
- seul le stock engagé par l'expéditeur est réservé ;
- le stock du destinataire est vérifié à la création mais reste libre jusqu'à acceptation ;
- stock disponible expéditeur = stock total - réservations de ses demandes envoyées ;
- si la disponibilité du destinataire baisse, la demande diminue automatiquement ;
- une demande réduite ne remonte jamais automatiquement ;
- à montant 0, elle disparaît silencieusement ;
- toute réduction libère immédiatement la réservation correspondante de l'expéditeur ;
- annulation/refus libère le stock réservé ;
- expiration des demandes au reset serveur de 00:00 `Europe/Paris` ;
- expiration automatique, indépendante de l'activité joueur.
- toute transaction modifiant un stock de particules réconcilie immédiatement les demandes concernées ;
- `Refuser tout` disponible pour les demandes reçues ;
- participants référencés côté métier par IDs internes immuables, jamais par pseudo ;

UI cible :
- écran dédié avec demandes reçues et envoyées ;
- possibilité de traiter plusieurs demandes ;
- affichage clair du stock réellement échangeable ;
- notification agrégée indiquant le nombre de demandes reçues en attente et menant vers cet écran.
- bouton `MAX` remplissant le champ quantité ;
- `Accepter tout` traite les demandes de la plus ancienne à la plus récente ;
- pas d'acceptation partielle manuelle ;
- liste normale limitée aux partenaires réellement échangeables.
- historique récent des transactions dans l'écran Échanges : environ 3 visibles, scroll jusqu'à environ 20–30 dernières.

Important :
- le legacy duplique chaque demande en `sent` / `received` dans les deux profils ;
- ne pas reproduire automatiquement cette duplication dans la future DB ;
- le modèle cible devra avoir une source de vérité unique pour chaque demande.

Historique futur :
- ne pas inventer d'historique d'échanges legacy absent ;
- à partir de GachaImpact, journaliser les opérations importantes d'échange côté serveur ;
- historique complet conservé côté serveur pour audit, diagnostic et statistiques futures ;
- seule une fenêtre récente d'environ 20–30 transactions est affichée dans l'écran Échanges.
- idée future : écran de statistiques joueur / globales du jeu.

Migration :
- les demandes legacy encore en attente ne sont pas migrées ;
- aucune réservation temporaire associée n'est conservée au cutover ;
- les soldes réels de particules restent évidemment migrés.

Balayage global des particules :
- les usages métier fondamentaux actuels identifiés sont Conversion et Échange ;
- de nombreuses mécaniques peuvent générer des particules ;
- ne pas inventer de nouvelle dépense en particules pendant la migration ;
- les incohérences legacy de statistiques sont corrigées à partir de GachaImpact sans reconstruction rétroactive incertaine.

## 13.4 Principes globaux de ressources

Source de vérité :
- les soldes courants sont les sources de vérité financières ;
- les compteurs cumulés `Earned/Spent` servent aux statistiques ;
- le futur journal des mutations sert à la traçabilité.

Mutations :
- toute mutation de ressource passe par une logique métier centrale ;
- chaque mutation possède une cause/source métier ;
- aucune ressource ne peut devenir négative ;
- aucun plafond artificiel n'est imposé en V1.

Statistiques :
- `totalPrimosEarned` = Primogemmes générées/créditées par le jeu ;
- `totalPrimosSpent` = Primogemmes définitivement consommées ;
- `totalMorasEarned` / `totalMorasSpent` suivent la même logique ;
- `totalMainElementParticlesEarned` = particules de l'élément personnel générées comme récompense ;
- un transfert joueur↔joueur n'est pas un gain généré ;
- les compteurs legacy sont migrés tels quels sans reconstruction incertaine.

Sécurité :
- opérations économiques multi-étapes atomiques/transactionnelles ;
- protection contre double clic / retry / double exécution ;
- journalisation des mutations importantes ;
- stocks/réservations vérifiés côté serveur.

Automatisation :
- une mécanique dépendant du temps ou d'un état serveur fonctionne même joueur hors ligne ;
- l'activité/message joueur ne sert plus artificiellement de scheduler.

UI :
- toute modification autoritative est répercutée sans F5 dans toutes les vues concernées ;
- une même ressource ne doit pas présenter plusieurs valeurs divergentes dans différents écrans.

Moras :
- portefeuille et banque restent deux soldes distincts ;
- richesse totale = somme dérivable ;
- les dépenses ordinaires utilisent le portefeuille uniquement.

Données dérivées :
- ne pas persister des valeurs comme le nombre d'invocations possibles si elles peuvent être calculées depuis le solde et le coût courant.

Catégories conceptuelles :
- ressources cœur : Primogemmes, Moras portefeuille, sept particules ;
- solde spécifique : Banque ;
- ressources/objets spéciaux : ex. Masterless Stella Fortuna ;
- ressources temporaires/scopées : monnaies d'Events ;
- collections/inventaire : Coffre et autres objets.

Frontières de responsabilité :
- tous les domaines utilisent la logique centrale Ressources pour modifier un solde ;
- chaque domaine reste propriétaire de ses propres montants, probabilités et conditions ;
- le moteur Ressources ne doit pas devenir un monolithe connaissant toutes les règles du jeu.

## 13.5 Récompense quotidienne
Décision V1 validée :
- +160 primogemmes ;
- +160 particules de l'élément du joueur ;
- +10 000 moras ;
- reset global à 00:00 `Europe/Paris` ;
- jour non réclamé = perdu ;
- aucune accumulation des jours manqués.

Une seule opération métier idempotente doit gérer le claim, qu'il soit déclenché par :
- le bouton `Réclamer` de l'interface ;
- le premier message éligible du chat GachaImpact ;
- le premier message Twitch éligible d'un profil ayant déjà choisi son élément.

Le bloc UI correspondant doit évoluer vers un suivi quotidien plus général avec chevrons `‹` / `›`, masquage pour la journée et préférences futures.

Idées futures non V1 :
- streak de connexion avec bonus au 7e jour consécutif ;
- calendriers de connexion événementiels.

---

# 14. PERSONNAGES / BOX / CONSTELLATIONS

## 14.1 Première obtention
Première copie :
- `copies = 1`
- `constellation = 0`

## 14.2 Doublons
Deuxième copie :
- C1

Troisième :
- C2

...

Septième :
- C6

À partir de la huitième :
- constellation reste C6 ;
- `copies` continue à augmenter.

Donc :
- `constellation` = progression limitée ;
- `copies` = nombre historique total.

Ne jamais reconstruire `copies` depuis `constellation`.

---

# 15. C6 ET STATISTIQUES DE CONCOURS

Source actuelle :
`c6_characters.json`

Pour chaque joueur, certains personnages C6 ont une structure dédiée.

Exemples de données :
- owner
- characterId
- name
- rarity
- element
- weapon
- region
- class
- createdAt

Stats :
- strength
- intelligence
- beauty
- charisma
- popularity

ContestStats :
- totalContests
- totalWins
- victoires par catégorie
- participations par catégorie

Titles :
- titres par statistique

Règles Gacha déjà validées :
- lorsqu'un personnage 5★ atteint C6, ses cinq statistiques Concours sont initialisées à 1 ;
- à partir de la copie suivante, un doublon 5★ C6+ augmente aléatoirement de +1 une statistique encore inférieure à 20 ;
- si toutes les statistiques sont à 20, compensation actuelle : +100 000 Moras ;
- doublon 4★ C6+ : +80 Primogemmes ;
- doublon 5★ C6+ : +160 Primogemmes ;
- `copies` continue d'augmenter après C6 ;
- la future section Concours apparaît seulement aux joueurs possédant au moins un 5★ C6.

À approfondir dans :
- Concours ;
- éventuellement Obtention / autres scripts liés.

Le domaine Gacha ne doit pas absorber toute la logique Concours : il déclenche seulement les hooks appropriés.

---

# 16. DATE DE PREMIÈRE OBTENTION

Pour un personnage possédé :
- conserver la date de la toute première obtention ;
- les copies suivantes ne remplacent pas cette date ;
- il n'existe pas, à ce stade, de besoin validé de stocker l'historique de chaque copie.

---

# 17. SYSTÈME DE BANNIÈRE / GACHA — AUDIT EN COURS

Document spécialisé :
`docs/legacy/06-gacha-invocation-audit.md`

Sources principales :
- `Banniere.txt`
- `Select.txt`
- `Pull.txt`
- `Pity.txt`
- `Vote.txt`
- génération hebdomadaire présente dans `XP.txt`
- `banner_votes.json`
- `genshin_characters.json`
- `viewers_data.json`

Correction importante :
- `Wish.txt` ne fait pas partie du Gacha ;
- il appartient au Giveaway Twitch ;
- il reste dans le legacy et sera audité plus tard avec les commandes Twitch de giveaway.

## Bannière

Décisions R54–R59 :
- rotation automatique chaque lundi à 00:00 `Europe/Paris` ;
- 4 personnages 5★ + 6 personnages 4★ ;
- aucun personnage 5★ ou 4★ deux semaines consécutives ;
- 3 des 5★ sont tirés aléatoirement ;
- le 4e dépend du vote communautaire pondéré ;
- fallback aléatoire si aucun vote exploitable ;
- un vote définitif par joueur/semaine ;
- cible personnelle obligatoire parmi les quatre 5★ ;
- changement de cible libre ;
- ancienne cible vidée à chaque rotation.

## Pull / Pity

Décisions R60–R65 :
- 160 Primogemmes par Pull ;
- UI x1/x10, aucune remise ;
- chat/Twitch 1 à 10 pulls ;
- pity 5★ : 0,6 % jusqu'à 73, soft pity +6 points/pull à partir de 74, garantie à 90 ;
- pity 4★ : 1,5 % jusqu'à 8, 19,5 % au 9e, garantie à 10 ;
- priorité du 5★ lorsque les deux jets réussissent ;
- obtenir un 5★ ne reset pas la pity 4★ ;
- pity/garantie/Capture traversent les rotations et changements de cible ;
- sans personnage : 50 % Moras 5k–15k ou 50 % particules 20–80 d'un élément aléatoire.

## Catalogue personnages automatique

Direction validée :
- synchronisation externe périodique automatique ;
- pas de validation manuelle obligatoire à chaque nouveau personnage ;
- job séparé des resets critiques du jeu ;
- ne pas importer un personnage incomplet ou non encore réellement sorti ;
- vérifier la date de release ;
- rareté et élément notamment obligatoires ;
- croiser plusieurs sources avec priorité à la confirmation officielle ;
- rechercher les équivalents/localisations françaises ;
- personnage importé correctement -> apparaît naturellement dans l'écran Personnages ;
- ne jamais inventer les champs propres à GachaImpact à partir d'une source externe.

Sources actuelles à revalider lors de l'implémentation :
1. annonces officielles / archives fiables d'annonces officielles pour confirmer la sortie ;
2. Honey Hunter live / autres bases structurées récentes pour les détails ;
3. Gachabase en excluant strictement les données bêta pour confirmer une sortie ;
4. `genshin-db` / API pour données structurées et multilingues lorsqu'il est à jour sur la version courante.

## Administration

Prévoir une vue Admin/Modérateur permettant notamment :
- gestion/correction du catalogue personnages ;
- suppression/désactivation rapide d'un import incorrect ;
- ajout manuel exceptionnel ;
- corrections de ressources ;
- corrections de possessions/personnages ;
- actions sur un ou plusieurs joueurs ;
- permissions fortes ;
- journalisation des actions sensibles.

## 50/50 / Garantie / Capture — R66 à R74 validées

- perte 50/50 → un des trois autres 5★ actifs ;
- garantie normale → cible actuelle au prochain 5★ ;
- garantie prioritaire sur Capture si les deux états coexistent ;
- `captureProgress` séparé du streak ;
- perte 50/50 → Capture +1 ;
- victoire 50/50 → Capture -1 ;
- Capture à 3/3 → cible garantie puis reset 0 ;
- `fiftyFiftyLostStreak` mesure uniquement les vraies pertes consécutives et peut dépasser 3 ;
- vraie victoire 50/50 → streak 0 ;
- garantie/Capture suivent toujours la cible actuelle ;
- `fiftyFiftyWon/Lost` ne comptent que de vrais 50/50 ;
- nouvelle statistique `capturesTriggered`.

## Passifs Pull — R75 à R84 validées

- passifs uniquement depuis la team active ;
- maximum deux stacks par élément ;
- plusieurs éléments et plusieurs procs simultanés possibles ;
- Pyro ×1,25/×1,5 particules secondaires ;
- Geo ×1,25/×1,5 Moras secondaires ;
- Hydro +0,3/+0,6 point de chance 5★ ;
- Cryo 1/20 ou 1/10 pour +1 XP via moteur XP ;
- Electro 1/30 ou 1/20 pour +2 pity appliqué après résolution ;
- Anemo 1/12 ou 1/8 pour +80 Primogemmes ;
- Dendro 1/25 ou 1/15 pour +40 Primogemmes, +1 000 Moras et +5 particules de chacun des sept éléments ;
- chaque Pull individuel d'un x10 effectue ses propres tests.

## Copies / C6 — R85 à R88 validées

- C0 première copie, C6 septième copie ;
- `copies` continue ensuite ;
- C6+ 4★ : +80 Primogemmes ;
- C6+ 5★ : +160 Primogemmes + progression Concours ;
- accès UI Concours uniquement avec au moins un 5★ C6.

## Exécution / historique — R89 à R95 validées

- x10 calculé séquentiellement puis persisté atomiquement avant animation ;
- crash UI après validation serveur = aucune perte de résultat ;
- 4★ uniforme parmi les six actifs ;
- historique complet des Pulls depuis GachaImpact ;
- 10 résultats par page dans l'UI ;
- aucune purge annuelle par défaut ;
- statistiques legacy migrées telles quelles ;
- `lastPullWasFiveStar` devient dérivable ;
- Early / Back-to-back conservés ;
- Hard = 5★ obtenu à partir de pity 80 ;
- stats correspondantes dérivables de l'historique ;
- arrondi Pyro/Geo `.5` vers le haut.

## Prochaine passe Gacha

Le cœur de `Pull.txt` est quasi finalisé.

À vérifier avant clôture éventuelle :
- derniers edge cases `Banniere.txt` ;
- derniers edge cases `Vote.txt` ;
- derniers edge cases `Select.txt` ;
- derniers edge cases `Pity.txt` ;
- interactions catalogue automatique / rotation / votes ;
- génération impossible faute de suffisamment de personnages éligibles ;
- éventuels champs ou comportements Gacha legacy encore non classés.

---

# 18. MIGRATION — PRINCIPE CRITIQUE

La migration ne doit PAS être un import jetable exécuté une seule fois.

Pendant le développement :
- les joueurs continuent de jouer via Streamer.bot ;
- leurs JSON continuent d'évoluer.

Il faut donc prévoir une migration / synchronisation réexécutable.

Scénario :

Snapshot JSON A
-> import initial

joueurs continuent à jouer

Snapshot JSON B plus récent
-> update/synchronisation

Snapshot JSON final
-> dernière synchro
-> bascule définitive

Exigences :
- pas de duplication ;
- pas de corruption ;
- import idempotent ;
- reconnaître les joueurs déjà migrés ;
- mettre à jour les données legacy pertinentes ;
- ne pas écraser des données natives créées uniquement dans GachaImpact ;
- tracer si nécessaire la source et la date d'import.

Cette partie devra faire l'objet d'une spécification dédiée.

---

# 19. DONNÉES HISTORIQUES

Décisions validées :
- migrer toutes les statistiques historiques ;
- migrer les dates historiques ;
- conserver premières obtentions ;
- conserver historiques de combats/missions/events si existants ;
- conserver les données même si la fonctionnalité ne sera développée que plus tard.

Précisions dates legacy :
- conserver toutes les dates réellement connues sans recalcul ni invention ;
- interpréter les timestamps Streamer.bot sans timezone comme `Europe/Paris` ;
- conserver séparément la première présence Twitch/legacy et la future date de création du compte GachaImpact ;
- ne pas figer maintenant une unique notion future de `lastSeen` : connexion, présence, activité de jeu et activité chat seront distinguées lors de la conception des domaines concernés.

Champ supposé obsolète :
- marquer `LEGACY / OBSOLÈTE À VÉRIFIER`
- ne pas supprimer tant que la suppression n'a pas été explicitement validée.

---

# 20. DOCUMENTATION DES COMMANDES

Une documentation complète doit être construite au fil de l'audit.

But :
- servir à l'équipe de dev ;
- servir à Codex ;
- servir plus tard de base à la section Aide / Commandes du jeu.

Pour chaque commande documenter :
- nom ;
- syntaxe ;
- alias ;
- arguments ;
- sous-commandes ;
- préconditions ;
- coûts ;
- cooldown ;
- permissions ;
- données lues ;
- données écrites ;
- erreurs ;
- edge cases ;
- interaction avec autres systèmes ;
- comportement Twitch actuel ;
- comportement futur GachaImpact ;
- disponibilité future :
  - UI
  - chat GachaImpact
  - Twitch

Document existant :
`docs/commands/command-reference.md`

---

# 21. DOCS ACTUELLES

Sous `docs/` :

- `README.md`
- `legacy/01-data-sources-inventory.md`
- `legacy/02-current-player-model.md`
- `legacy/03-command-data-matrix.md`
- `legacy/04-xp-audit.md`
- `legacy/05-element-resources-audit.md`
- `legacy/06-gacha-invocation-audit.md`
- `specifications/decisions-log.md`
- `commands/command-reference.md`
- `roadmap/development-roadmap.md`

Ce document maître vient s'ajouter à cette structure.

---

# 22. ORGANISATION DOCUMENTAIRE RECOMMANDÉE

Structure cible :

docs/
├── README.md
├── master/
│   └── PROJECT_MASTER_PLAN.md
├── legacy/
│   ├── 01-data-sources-inventory.md
│   ├── 02-current-player-model.md
│   ├── 03-command-data-matrix.md
│   └── ...
├── specifications/
│   ├── decisions-log.md
│   ├── target-data-model.md
│   ├── authentication.md
│   ├── migration-strategy.md
│   ├── invocation.md
│   ├── box.md
│   ├── team.md
│   └── ...
├── commands/
│   └── command-reference.md
└── roadmap/
    └── development-roadmap.md

---

# 23. FEUILLE DE ROUTE GLOBALE

## PHASE 0 — Prototype visuel
Statut : TRÈS AVANCÉ / QUASI VALIDÉ

Fait :
- React/Vite ;
- navigation ;
- sidebar ;
- chat ;
- responsive ;
- écrans ;
- assets ;
- Invocation visuelle ;
- Box ;
- Personnages ;
- Équipe ;
- Sac ;
- Boutique.

À garder :
- petites retouches possibles plus tard ;
- ne pas bloquer l'architecture backend dessus.

---

## PHASE 1 — Audit legacy complet
Statut : EN COURS

### 1A — Inventaire des JSON
Fait.

### 1B — Profil canonique Kichnifou
En cours.

### 1C — Matrice commandes ↔ données
Fait.

Document : `docs/legacy/03-command-data-matrix.md`.

Objectif :
pour chaque script :
- JSON lus ;
- JSON écrits ;
- sections joueur ;
- dépendances ;
- mécaniques dupliquées ;
- triggers ;
- logique réellement métier ;
- logique spécifique Streamer.bot.

### 1D — Audit domaine par domaine
EN COURS.

Premier domaine : `XP.txt` / cycle de vie joueur.
Document : `docs/legacy/04-xp-audit.md`.
Statut : **CLÔTURÉ le 2026-08-27**.

État de validation XP au 2026-08-27 :
- Q1 récompenses de level-up : VALIDÉ ;
- Q2 récompense quotidienne : VALIDÉ ;
- Q3 intérêt bancaire : VALIDÉ — 3 % automatiques au reset serveur de 00:00 `Europe/Paris`, sur le solde présent au reset, sans activité joueur ;
- Q4 modèle de gain d'XP standalone : VALIDÉ — messages +1/+2/+3 avec cooldown 2 secondes conservés, pas d'XP directe sur les actions ordinaires, futur mode XP dédié dans l'interface avec plafond quotidien à concevoir, cumul chat + mode autorisé ;
- principe Q5 onboarding élément standalone : VALIDÉ — choix obligatoire pendant l'onboarding, donc pas de verrou legacy « niveau 1 sans élément » dans le standalone ;
- Q6 tutoriels de montée de niveau : VALIDÉ — rendu dans le chat si le niveau provient d'XP chat, notification UI si le niveau provient du futur mode XP de l'interface ;
- Q7 compteurs/messages/cooldown : VALIDÉ — historique conservé sans recalcul, `totalMessages` et `countedMessages` clairement séparés, cooldown 2 secondes global Twitch + chat interne ;
- Q8 dates/activité : VALIDÉ — dates legacy conservées sans invention, timestamps legacy interprétés en `Europe/Paris`, `firstSeen` Twitch distinct de la création du compte, futurs concepts de dernière activité séparés ;
- Q9 source de vérité XP / multi-level : VALIDÉ — XP source de vérité du niveau, état overflow conservé, toutes les récompenses intermédiaires accordées, XP cumulative/non dépensable, retours UI adaptés aux montées multiples ;
- domaine XP clôturé ; les responsabilités hors XP découvertes dans le script sont reportées vers leurs audits dédiés.

Deuxième domaine : Élément / ressources / conversion / échanges.
Document : `docs/legacy/05-element-resources-audit.md`.
Statut : **CLÔTURÉ le 2026-08-28**.

Décisions validées :
- R1 conversion 1:1 ;
- R2 seules les particules personnelles sont directement convertibles ;
- R3 conversion manuelle ;
- R4 toute quantité entière >= 1 dans la limite du stock ;
- R5 troc élémentaire bilatéral conservé ;
- R6 joueurs d'éléments différents uniquement ;
- R7 échange X contre X ;
- R8 réservation des stocks ;
- R9 une seule demande active par paire ;
- R10 réservation uniquement côté expéditeur ;
- R11 raccourci MAX ;
- R12 Accepter tout ;
- R13 historique serveur futur des échanges ;
- R14 partenaires réellement échangeables uniquement ;
- R15 vérification initiale du stock destinataire ;
- R16 réduction dynamique des demandes ;
- R17 traitement Accepter tout de la plus ancienne à la plus récente ;
- R18 quantité échangeable affichée dans le chat ;
- R19 notification agrégée dynamique ;
- R20 une demande réduite ne remonte pas ;
- R21 libération immédiate des réservations après réduction ;
- R22 plusieurs demandes reçues peuvent viser le même stock non réservé ;
- R23 pas d'acceptation partielle manuelle ;
- R24 historique récent dans l'écran Échanges plutôt que notifications de résolution ;
- R25 Refuser tout ;
- R26 demandes legacy en attente non migrées ;
- R27 IDs internes immuables pour les participants ;
- R28 à R31 usages des particules / définition Main / migration des statistiques : validés ;
- R32 mutation centralisée des ressources avec cause/source : validé ;
- R33 à R38 définitions statistiques économiques / journalisation / soldes sources de vérité : validés ;
- R39 à R44 invariants économiques / atomicité / idempotence / automatisation serveur / stats dérivées : validés ;
- R45 à R50 visibilité joueur / données dérivées / portefeuille-banque / synchronisation UI : validés ;
- R51 à R53 catégorisation des ressources / moteur central partagé / responsabilités des domaines : validés ;
- réconciliation immédiate des demandes après toute modification de stock ;
- expiration des demandes au reset serveur 00:00 `Europe/Paris` ;
- annulation/refus des demandes ;
- écran UI reçues/envoyées ;
- notification agrégée pour les demandes reçues.

Domaine Élément / Ressources / Conversion / Échanges : **CLÔTURÉ**.

Troisième domaine actif : Gacha / Invocation.
Document : `docs/legacy/06-gacha-invocation-audit.md`.
Statut : **EN COURS**.
Décisions validées :
- R54 à R59 : bannière / rotation / vote / sélection ;
- R60 à R65 : coût / pity / priorité / récompenses secondaires ;
- R66 à R74 : 50/50 / garantie / Capture / statistiques associées ;
- R75 à R84 : passifs élémentaires du Pull ;
- R85 à R88 : copies / C6 / hook Concours ;
- R89 à R95 : atomicité x10 / historique / statistiques / Early-Back-to-back-Hard / arrondis ;
- direction animation UI validée ;
- historique Invocation complet avec pagination 10/page validé ;
- direction synchronisation automatique catalogue validée ;
- direction vue Admin/Modérateur validée.

Cœur de `Pull.txt` : **QUASI FINALISÉ**.

Ordre recommandé :

1. XP / cycle de vie joueur
2. Élément / ressources / conversion
3. Gacha :
   - Banniere
   - Select
   - Pull
   - Pity
   - Vote
4. Box / Obtention / Liste
5. Team
6. Banque
7. Sac / Coffre / Shop
8. Missions / Daily
9. Expedition
10. Combat
11. Ami / social
12. Concours / C6
13. Event / monthly
14. autres utilitaires
15. Twitch / Giveaway :
   - `Wish.txt`
   - `giveaway.json`
   - autres commandes/triggers Twitch de giveaway à identifier ;
   - non prioritaire pour le cœur standalone mais à ne pas oublier avant la fin de l'audit.

---

# 24. PHASE 2 — MODÈLE DE DONNÉES CIBLE

Statut : FUTUR

Après audit :
- définir les vraies entités ;
- séparer données fondamentales et dérivables ;
- séparer joueur / possession / catalogue / historique / état global ;
- normaliser null / dates / listes ;
- définir contraintes ;
- définir relations ;
- définir données temporaires ;
- définir données globales.

Ne pas simplement reproduire les JSON en SQL.

---

# 25. PHASE 3 — CHOIX DU BACKEND

Statut : FUTUR

Solutions à comparer :
- Supabase / PostgreSQL ;
- backend Node personnalisé ;
- autres solutions si besoin.

Critères :
- auth ;
- DB relationnelle ;
- temps réel ;
- coûts ;
- simplicité ;
- migration ;
- sécurité ;
- déploiement ;
- chat ;
- présence ;
- Twitch OAuth.

Supabase paraît prometteur mais décision non figée.

---

# 26. PHASE 4 — AUTHENTIFICATION / COMPTE

Premier vrai prototype backend attendu :

- inscription ;
- connexion ;
- création profil ;
- pseudo GachaImpact ;
- ID interne ;
- initialization de données ;
- liaison Twitch optionnelle ;
- récupération du profil legacy ;
- affichage des vraies données dans l'UI.

Premier pilote :
- compte du créateur / profil Kichnifou.

But :
remplacer progressivement les mocks par les données serveur.

---

# 27. PHASE 5 — MIGRATION PILOTE

Objectif :
- importer Kichnifou ;
- vérifier :
  - niveau ;
  - XP ;
  - élément ;
  - primos ;
  - moras ;
  - particules ;
  - box ;
  - constellation ;
  - copies ;
  - équipe ;
  - pity ;
  - garantie ;
  - `fiftyFiftyLostStreak` ;
  - `captureProgress` / brillance ;
  - stats Gacha historiques ;
  - stats C6 ;
  - dates ;
  - autres historiques.

Ensuite tester quelques profils anciens/incomplets.

---

# 28. PHASE 6 — FONCTIONNALITÉS RÉELLES

Ordre recommandé initial :

1. Ressources
2. Box
3. Équipe
4. Invocation

Pourquoi :
- ensemble cohérent ;
- donne rapidement un mini-jeu jouable complet ;
- permet de tester transactions et sauvegarde serveur.

Ensuite :
- Boutique
- Banque
- Missions
- Combat
- Expédition
- Social
- Events
- Concours
- etc.

---

# 29. PHASE 7 — CHAT INTERNE

Créer un vrai chat GachaImpact :
- messages globaux ;
- identité GachaImpact ;
- présence ;
- commandes ;
- réponses système ;
- historique ;
- non lus ;
- modération.

Les commandes internes doivent appeler les mêmes services que les boutons.

---

# 30. PHASE 8 — SOCIAL

Prévu :
- liste joueurs en ligne ;
- fiche joueur ;
- amis ;
- demandes ;
- retirer ami ;
- messages privés ;
- espace social.

Direction actuelle pour la fiche joueur :
- permettre pour l'instant de consulter les ressources et statistiques des autres joueurs ;
- la liste exacte des informations visibles sera affinée plus tard si certaines doivent devenir privées ;
- un futur écran Statistiques pourra exploiter les historiques/transactions pour afficher des statistiques joueur ;
- des statistiques globales du jeu pourront également être ajoutées plus tard.

Les MP sont indépendants de Twitch.

---

# 31. PHASE 9 — TWITCH

Seulement après que le jeu standalone fonctionne.

Objectifs :
- OAuth Twitch ;
- liaison compte ;
- reconnaître l'identité Twitch ;
- messages Twitch dans GachaImpact ;
- éventuellement messages GachaImpact -> Twitch selon règles ;
- commandes Twitch déclenchant la même logique serveur.

Streamer.bot ne doit plus être requis.

---

# 32. SÉCURITÉ / ARCHITECTURE SERVEUR

Principes :
- jamais faire confiance au navigateur pour une transaction ;
- ressources modifiées côté serveur ;
- toute mutation de ressource passe par une logique centrale avec cause/source métier ;
- pull calculé côté serveur ;
- pity calculée côté serveur ;
- shop côté serveur ;
- banque côté serveur ;
- échanges validés côté serveur ;
- stocks disponibles = stock total - stock réservé si système de réservation ;
- aucun solde ne peut devenir négatif ;
- opérations sensibles transactionnelles et atomiques ;
- protection idempotente contre double clic, retry réseau et double exécution ;
- timestamps serveur ;
- journalisation des transactions importantes ;
- mécaniques temporelles exécutables même si le joueur est hors ligne ;
- changements autoritatifs répercutés immédiatement dans les clients/UI concernés.

---

# 33. DONNÉES DÉRIVABLES

Principe :
ne pas sauvegarder inutilement ce qui peut être calculé depuis une source centrale.

Exemples :
- nombre d'invocations possibles = solde Primogemmes / coût courant ;
- richesse Moras totale = portefeuille + banque ;
- statistiques calculables depuis des transactions fiables lorsque le coût de calcul reste raisonnable.

Exemple legacy :
une expédition peut stocker :
- characterId
- characterName
- element

Dans le futur :
- `characterId` peut suffire si `name` et `element` viennent du catalogue.

Exception :
si une donnée doit représenter un snapshot historique, elle peut être volontairement copiée.

À décider au cas par cas.

---

# 34. SOURCE DE VÉRITÉ PERSONNAGES

Le catalogue personnage doit devenir central.

Il doit fournir au minimum :
- ID ;
- nom ;
- rareté ;
- élément ;
- arme ;
- région ;
- classe ;
- assets ;
- autres données nécessaires.

Les systèmes ne doivent pas redéfinir chacun le nom/élément du personnage.

---

# 35. RÈGLES DE TRAVAIL AVEC CODEX

Avant un développement important :
1. lire `AGENTS.md` ;
2. lire les docs concernées ;
3. inspecter les sources legacy si la fonctionnalité vient de Streamer.bot ;
4. ne pas inventer une mécanique non validée ;
5. ne pas faire de gros refactor sans nécessité ;
6. tester lint/build ;
7. tester desktop/mobile si UI ;
8. lister les fichiers modifiés ;
9. ne pas créer de commit sauf demande.

---

# 36. RÈGLES DE TRAVAIL CHATGPT / DOCUMENTATION

ChatGPT doit :
- consulter la documentation avant de prendre une décision structurante ;
- mettre à jour les docs à intervalles réguliers ;
- préciser exactement quel fichier créer/modifier ;
- ne pas dépendre uniquement de la mémoire de conversation ;
- lire le code réel des scripts legacy ;
- conserver les incertitudes sous statut explicite ;
- distinguer :
  - comportement actuel ;
  - décision validée ;
  - recommandation ;
  - idée future.

---

# 37. GIT / GITHUB

Dépôt public :
`https://github.com/Kichnifou/GachaImpact`

Routine générale :

```powershell
git status
git add .
git status
git commit -m "Description courte"
git push
git status
```

Docs uniquement :

```powershell
git status
git add docs
git status
git commit -m "docs: update project documentation"
git push
git status
```

Sources legacy uniquement :

```powershell
git status
git add legacy
git status
git commit -m "Update Streamerbot legacy snapshot"
git push
git status
```

---

# 38. PROCHAINE ÉTAPE EXACTE

Domaines clôturés :
- `docs/legacy/04-xp-audit.md` — XP / cycle de vie joueur : **CLÔTURÉ** ;
- `docs/legacy/05-element-resources-audit.md` — Élément / Ressources / Conversion / Échanges : **CLÔTURÉ**.

Domaine actif :
**Gacha / Invocation**

Document :
`docs/legacy/06-gacha-invocation-audit.md`

État :
1. R54–R59 : Bannière / Vote / Sélection validés ;
2. R60–R65 : coût / pity / récompenses secondaires validés ;
3. R66–R74 : 50/50 / garantie / Capture validés ;
4. `fiftyFiftyLostStreak` séparé de `captureProgress` ;
5. R75–R84 : passifs du Pull validés ;
6. correction Cryo → moteur XP central validée ;
7. correction Electro → proc après résolution validée ;
8. correction texte Dendro validée ;
9. R85–R88 : copies / C6 / hook Concours validés ;
10. remboursements C6+ cible : 80 primos 4★ / 160 primos 5★ ;
11. R89 : x10 séquentiel mais transaction atomique persistée avant animation ;
12. R90 : 4★ uniforme parmi les six actifs ;
13. R91 : historique complet permanent depuis GachaImpact, 10 résultats par page ;
14. R92/R93 : migration statistiques + suppression future de `lastPullWasFiveStar` comme donnée redondante ;
15. R94 : Early / Back-to-back / Hard validés ;
16. R95 : arrondi `.5` vers le haut ;
17. animation UI / catalogue automatique / Admin toujours validés ;
18. cœur de `Pull.txt` : **QUASI FINALISÉ**.

**Prochaine étape unique : effectuer la dernière passe des edge cases de `Banniere.txt`, `Vote.txt`, `Select.txt` et `Pity.txt`, puis déterminer si le domaine Gacha / Invocation peut être clôturé ou s'il reste un dernier bloc métier à décider.**

Ne pas figer le modèle SQL Gacha avant cette vérification finale.

---

# 39. PRINCIPE DE VALIDATION DES DÉCISIONS

Une décision n'est considérée définitive que si elle est :
- explicitement validée par le propriétaire du projet ;
- écrite dans la documentation.

Une hypothèse trouvée dans un script n'est pas automatiquement une règle à conserver.

Pour chaque mécanique legacy :
- comprendre ;
- expliquer ;
- décider :
  - garder ;
  - adapter ;
  - supprimer ;
  - repousser ;
  - centraliser ;
  - refondre.

---

# 40. OBJECTIF FINAL

Obtenir un projet où :

- l'interface actuelle devient un vrai jeu ;
- toutes les données sont centralisées ;
- la logique métier est maintenable ;
- un joueur peut jouer entièrement sans Twitch ;
- Twitch peut être lié en bonus ;
- les données historiques Streamer.bot ne sont pas perdues ;
- les anciens joueurs peuvent récupérer leur progression ;
- les nouveaux joueurs ont un modèle propre dès la création ;
- toutes les commandes sont documentées ;
- UI et chat utilisent les mêmes services ;
- les systèmes futurs peuvent être ajoutés sans reproduire les défauts de Streamer.bot.

---

# 41. RÉSUMÉ ULTRA COURT POUR REPRISE RAPIDE

Projet :
GachaImpact = migration d'un jeu Twitch/Streamer.bot vers un jeu web standalone React + futur backend.

Frontend :
prototype très avancé, assets Genshin intégrés, UI quasi validée.

Legacy :
36 scripts + 17 JSON intégrés sous `legacy/streamerbot/`.

Docs :
déjà présentes sous `docs/`.

Profil canonique :
Kichnifou.

Décisions clés :
- compte GachaImpact distinct de Twitch ;
- Twitch optionnel ;
- migration complète ;
- niveau max 100 ;
- XP continue après 100 ;
- élément joueur permanent ;
- primos = pulls ;
- moras = shop/banque ;
- particules personnelles -> Primogemmes 1:1, conversion manuelle ;
- échanges de particules : X contre X entre éléments différents, une demande par paire, réservation uniquement côté expéditeur, montant dynamique si le stock destinataire baisse, expiration au reset serveur ;
- UI échange future : reçues/envoyées, annulation/refus, MAX, Accepter tout, partenaires réellement échangeables uniquement, notification agrégée dynamique ;
- échanges résolus : pas de notification individuelle ; historique récent directement dans l'écran Échanges ;
- demandes legacy ouvertes non migrées ; nouvelles relations basées sur IDs internes immuables ;
- historique des échanges conservé côté serveur à partir de GachaImpact pour audit/statistiques, sans affichage V1 ;
- copies continuent après C6 ;
- C6 ouvre stats/concours ;
- Gacha : rotation automatique lundi 00:00 Europe/Paris, 4×5★ + 6×4★, pas de personnage deux semaines consécutives ;
- vote hebdo définitif, tirage pondéré pour le quatrième 5★ ;
- cible 5★ obligatoire parmi les quatre actifs, vidée à chaque rotation et modifiable librement ;
- coût 160 primos ; UI x1/x10 ; pity 5★ 90 / pity 4★ 10 selon courbes validées ;
- 50/50 perdu = un des trois autres 5★ ; garantie normale + Capture séparées ;
- `fiftyFiftyLostStreak` = streak statistique ; `captureProgress` = mécanique 0..3 ;
- Capture : perte +1, victoire -1, déclenchement à 3 puis reset ;
- passifs Pyro/Hydro/Cryo/Electro/Anemo/Geo/Dendro du Pull spécifiés ;
- copies continuent après C6 ; remboursements C6+ 80 primos 4★ / 160 primos 5★ ;
- C6 5★ ouvre la future section Concours ;
- x10 entièrement persisté avant animation ; un crash UI ne change jamais les résultats ;
- historique complet des Pulls depuis GachaImpact avec 10 résultats/page ;
- Early / Back-to-back / Hard conservés et statistiques dérivables ;
- animation UI de Pull avec révélation progressive et anticipation dorée du 5★ ; Twitch reste textuel ;
- futur catalogue personnages automatiquement synchronisé avec vérification de sortie/complet + français ;
- future vue Admin/Modérateur pour corrections catalogue/joueurs ;
- `Wish.txt` = Giveaway Twitch, pas Gacha ;
- une seule logique serveur partagée par UI/chat/Twitch ;
- récompenses de level-up V1 conservées selon le code legacy réel ;
- récompense quotidienne V1 conservée avec reset global à minuit Europe/Paris ;
- intérêt bancaire V1 : +3 % automatiques chaque jour à 00:00 Europe/Paris sur le solde bancaire présent au reset, même sans activité du joueur ;
- standalone : élément obligatoire pendant l'onboarding ;
- standalone : XP chat conservée (+1/+2/+3, cooldown 2 s), pas d'XP directe sur les actions ordinaires, futur mode XP dédié dans l'interface avec plafond quotidien à concevoir, cumul chat + mode autorisé ;
- XP multi-canaux : cooldown 2 s global entre Twitch/chat interne ; `totalMessages` conserve tous les vrais messages joueur, `countedMessages` uniquement ceux ayant réellement donné de l'XP ;
- tutoriels de niveau : chat si montée via XP chat, notification UI si montée via le futur mode XP interface ;
- XP = source de vérité du niveau ; gains multi-level récompensent chaque niveau traversé et sont clairement affichés dans les notifications ;
- niveau 100 : état d'overflow historique conservé, récompenses multiples prises en charge ;
- dates legacy conservées sans invention, timestamps historiques interprétés comme Europe/Paris ;
- Twitch : nouveau chatter enregistré passivement, progression jusqu'au seuil d'onboarding puis blocage des mécaniques actives tant que l'élément n'est pas choisi ;
- suivi quotidien UI prévu dans le bloc bas gauche avec chevrons compacts.

Prochaine étape :
effectuer la dernière passe Gacha sur `Banniere.txt`, `Vote.txt`, `Select.txt` et `Pity.txt` avant clôture éventuelle du domaine.
