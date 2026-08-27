# GachaImpact — Cahier de suivi maître / Mega récap projet

Version : 0.9
Date : 2026-08-27  
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

L'écran Invocation est désormais proche du rendu souhaité.

Direction actuelle :
- grande bannière visuelle ;
- artwork personnage très grand ;
- artwork intégré comme fond/composition ;
- texte au-dessus de l'artwork ;
- gradient sombre pour conserver la lisibilité ;
- nom du personnage vedette affiché ;
- rareté affichée avec étoiles ;
- zone basse contenant :
  - Pity 5★ ;
  - Pity 4★ ;
  - Garantie 5★ ;
  - Brillance ;
  - Invocation x1 ;
  - Invocation x10.

Décisions importantes :
- ne plus afficher de sélecteur Permanent / Temporaire ;
- il n'y aura qu'un type de bannière active dans le jeu final ;
- ne pas afficher "Bannière permanente" ;
- la mention "Version de développement" a été supprimée ;
- les petits blocs séparés "Capture de brillance", "Coût d'une invocation", "Garantie actuelle" ont été supprimés ;
- les informations utiles ont été intégrées au panneau principal.

À corriger plus tard côté logique :
- la mention "Disponible en permanence" est héritée du prototype et ne correspond pas forcément au vrai fonctionnement final ;
- la bannière réelle sera liée au système hebdomadaire / sélection / vote.

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

Autres usages potentiels des particules :
- restent à vérifier au fil des autres audits.

## 13.4 Récompense quotidienne
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

Règle connue :
- au-delà de C6, les doublons supplémentaires peuvent augmenter certaines caractéristiques ;
- ces caractéristiques servent aux concours réservés aux personnages C6.

À auditer dans :
- Pull
- Concours
- éventuellement Obtention / autres scripts liés.

---

# 16. DATE DE PREMIÈRE OBTENTION

Pour un personnage possédé :
- conserver la date de la toute première obtention ;
- les copies suivantes ne remplacent pas cette date ;
- il n'existe pas, à ce stade, de besoin validé de stocker l'historique de chaque copie.

---

# 17. SYSTÈME DE BANNIÈRE / GACHA — CONCEPT ACTUEL

Le système s'inspire fortement de Genshin Impact.

Concept connu :
- une bannière hebdomadaire propose plusieurs personnages 5★ ;
- le joueur doit sélectionner un personnage cible avant de pull ;
- `selectedBannerCharacterId` semble correspondre à cette cible personnelle ;
- les joueurs peuvent voter chaque semaine pour influencer la bannière future ;
- pity 5★ ;
- pity 4★ ;
- garantie ;
- Capture de brillance avec compteur /3 ;
- pulls x1 et x10.

À auditer ensemble via :
- Banniere.txt
- Select.txt
- Pull.txt
- Pity.txt
- Vote.txt
- Wish.txt
- banner_votes.json
- genshin_characters.json
- viewers_data.json

Important :
ces commandes ne doivent probablement pas devenir six services indépendants.
Elles représentent un **domaine fonctionnel commun : Gacha / Invocation**.

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
Statut : **EN COURS**.

Décisions déjà validées :
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
- réconciliation immédiate des demandes après toute modification de stock ;
- expiration des demandes au reset serveur 00:00 `Europe/Paris` ;
- annulation/refus des demandes ;
- écran UI reçues/envoyées ;
- notification agrégée pour les demandes reçues.
Sous-domaine `Echanger.txt` : **FINALISÉ**.


Ordre recommandé :

1. XP / cycle de vie joueur
2. Élément / ressources / conversion
3. Gacha :
   - Banniere
   - Select
   - Pull
   - Pity
   - Vote
   - Wish
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
  - brillance ;
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
- pull calculé côté serveur ;
- pity calculée côté serveur ;
- shop côté serveur ;
- banque côté serveur ;
- échanges validés côté serveur ;
- stocks disponibles = stock total - stock réservé si système de réservation ;
- opérations sensibles transactionnelles ;
- prévention double clic/double dépense ;
- timestamps serveur ;
- journalisation des transactions importantes.

---

# 33. DONNÉES DÉRIVABLES

Principe :
ne pas sauvegarder inutilement ce qui peut être calculé depuis une source centrale.

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

Le premier domaine détaillé de la Phase 1D est maintenant clôturé :

- `docs/legacy/04-xp-audit.md` : **CLÔTURÉ** ;
- Q1 à Q9 : traités/validés selon leur statut ;
- responsabilités hors XP reportées vers les audits dédiés.

Le travail actif est désormais le deuxième domaine :

**Élément / ressources / conversion / échanges**

Document :
`docs/legacy/05-element-resources-audit.md`

État :
1. `Element.txt` : lecture initiale effectuée ;
2. `Convertir.txt` : lecture initiale effectuée ;
3. `Echanger.txt` : lecture initiale effectuée ;
4. R1 à R4 — conversion : validés ;
5. R5 à R9 — principes d'échange initiaux : validés ;
6. R10 à R27 — réservation, montant dynamique, acceptation, découverte partenaires, historique, migration, identité et notifications : validés ;
7. expiration serveur des demandes : validée ;
8. UI reçues/envoyées + annulation/refus/MAX/Accepter tout : direction validée ;
9. notification agrégée dynamique des demandes reçues : validée ;
10. historique serveur complet des échanges : validé ; affichage UI limité aux 20–30 transactions récentes ;
11. demandes legacy ouvertes : non migrées au cutover ;
12. sous-domaine `Echanger.txt` : finalisé.

**Prochaine étape unique : `Echanger.txt` étant finalisé, rechercher dans l'ensemble des scripts legacy les autres lectures/écritures/usages des particules et ressources afin de terminer le deuxième domaine avant de passer au Gacha.**

Ne pas commencer le Gacha tant que ce domaine n'est pas suffisamment clôturé et documenté.

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
- bannière hebdo avec cible sélectionnée ;
- vote pour bannière future ;
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
`Echanger.txt` finalisé ; balayer les autres scripts utilisant les particules/ressources afin de clôturer le deuxième domaine.
