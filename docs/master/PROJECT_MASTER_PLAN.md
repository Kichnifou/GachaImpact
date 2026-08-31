# GachaImpact — Cahier de suivi maître / Mega récap projet

Version : 0.20
Date : 2026-08-31
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

## 1.2 Projet futur original séparé — DIRECTION À CONSERVER

Un second jeu original est envisagé à plus long terme.

Direction actuelle :
- il s'agirait d'un **jeu séparé** de GachaImpact, et non d'une simple section interne ;
- GachaImpact pourra proposer un lien vers ce futur jeu ;
- une grande partie des principes techniques et mécaniques développés ici pourra être réutilisée/adaptée ;
- le futur jeu devra cependant se détacher réellement de Genshin : noms, personnages, univers, terminologie, identité visuelle et concepts devront être suffisamment originaux ;
- objectif : créer un véritable gacha original appartenant au projet ;
- une exploitation/monétisation permettant éventuellement de financer le projet pourra être étudiée plus tard.

Différences importantes déjà envisagées :
- personnages entièrement originaux ;
- lore original ;
- véritable catégorie `Histoire` ;
- narration pouvant prendre la forme d'un visual novel ;
- possibilité de scènes plus poussées avec animations et cinématiques.

Direction artistique envisagée :
- personnages et assets pouvant être produits avec l'aide de l'IA ;
- possibilité de commander des croquis/model sheets à des artistes humains puis de les utiliser comme références canoniques ;
- forte exigence de cohérence du même personnage entre poses, angles, émotions et scènes ;
- benchmark futur des outils de génération d'images avant de choisir le pipeline ;
- pour les cinématiques, privilégier une production pré-générée/hybride plutôt qu'une génération vidéo coûteuse en temps réel.

Ce projet futur reste séparé du périmètre métier actuel de GachaImpact.
Ne pas modifier les règles GachaImpact pour anticiper arbitrairement ce futur jeu.

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

## 3.7 Écran Historique global — DIRECTION VALIDÉE

Prévoir un futur écran transversal `Historique`.

Premiers onglets validés :
- `Invocations` ;
- `Bannières`.

### Invocations
- historique détaillé depuis le lancement standalone ;
- 10 résultats par page ;
- pagination serveur ;
- pas de purge annuelle par défaut.

### Bannières
- historique depuis le lancement standalone ;
- la bannière active au cutover peut devenir la première entrée avec origine `import legacy` ;
- composition 4×5★ + 6×4★ ;
- distinction des trois 5★ aléatoires et du 5★ communautaire ;
- snapshot des votes ;
- possibilité future d'afficher qui avait voté pour quel personnage ;
- dates/statut de rotation.

D'autres domaines pourront ajouter un onglet plus tard uniquement si leur historique apporte une réelle utilité.

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
- montrer uniquement les personnages possédés et actuellement actifs côté jeu ;
- utiliser le même catalogue personnage que l'écran `Personnages`, mais enrichi par la possession propre au joueur ;
- grille de cartes ;
- recherche ;
- filtres ;
- tri ;
- constellation ;
- informations personnelles de possession.

Source métier :
- le catalogue porte les informations du personnage : nom, élément, rareté, assets, etc. ;
- la possession joueur/personnage porte notamment constellation, copies, première obtention et favori ;
- un seul enregistrement de possession par couple joueur/personnage.

Onglets UI :
- `Tous` ;
- `5★` ;
- `4★`.

Persistance UI :
- le tri choisi est mémorisé entre sessions ;
- les filtres et l'onglet courant ne sont pas mémorisés ;
- au retour dans Box, l'onglet revient sur `Tous`.

Tris actuellement validés :
- alphabétique ;
- date de première obtention ;
- constellation ;
- élément.

Pas de tri `copies` prévu actuellement.

Ordre :
- les favoris sont toujours remontés avant les non-favoris ;
- un 4★ favori peut donc apparaître avant un 5★ non favori ;
- dans chaque groupe favoris/non-favoris, les 5★ restent avant les 4★ ;
- le tri actif s'applique à l'intérieur de chaque groupe/rareté.

État par défaut :
- onglet `Tous` ;
- tri alphabétique ascendant.

Fiche d'un personnage possédé :
- première date d'obtention ;
- constellation ;
- copies ;
- favori ;
- futures statistiques propres au personnage ajoutées par leurs domaines respectifs, par exemple plus gros dégâts, victoires ou défaites lorsque Combat sera audité.

Twitch/chat :
- les présentations historiques de `!box`, pages, tris et `!box favoris` peuvent rester différentes de l'UI standalone ;
- la source métier de possession/favoris reste commune.

Filtres UI Box :
- onglets `Tous` / `5★` / `4★` ;
- filtre élément ;
- filtre constellation complet C0 à C6 ;
- recherche ;
- filtres combinables ;
- tri.

Cartes :
- ne pas afficher le nombre de copies ;
- constellation visible ;
- favori directement modifiable dans la Box personnelle.

Fiche personnage :
- fiche commune avec l'écran `Personnages` ;
- constellation ;
- copies ;
- première obtention ;
- `Favoris : Oui/Non` ;
- futures statistiques propres au personnage ajoutées par leurs domaines.

Résumé Box :
- total de personnages actifs/visibles ;
- nombre de 5★ ;
- nombre de 4★ ;
- nombre de C6 ;
- pas de total copies dans ce résumé.

Box publique :
- consultable depuis le profil d'un autre joueur si les permissions le permettent ;
- consultable même lorsque le propriétaire est hors ligne ;
- structure quasi identique à la Box personnelle ;
- mêmes onglets / recherche / filtres / tris ;
- aucune action modifiant les données du propriétaire ;
- pas d'étoile favorite sur les cartes publiques ;
- `Favoris : Oui/Non` peut apparaître dans la fiche ;
- les favoris du propriétaire ne changent pas l'ordre public.

À chaque ouverture d'une Box publique :
- `Tous` ;
- `Alphabétique ↑` ;
- aucun filtre ;
- les réglages de consultation sont temporaires.

Une Box vide conserve sa section avec un état vide graphique propre.

## 6.2 Personnages
But :
- montrer tous les personnages obtenables ;
- coloré si possédé ;
- grisé si non possédé ;
- grille + filtres + tri ;
- inutile d'avoir un bandeau séparé "possédé / non possédé" si le visuel suffit.

Vote Gacha :
- les personnages 5★ éligibles au vote hebdomadaire peuvent afficher leur nombre de votes courant ;
- permettre de voter directement depuis cet écran ;
- réutiliser les filtres / tris / recherche existants plutôt que recréer inutilement une seconde liste complète ;
- une fois le vote utilisé, afficher clairement le choix du joueur pour la semaine.

## 6.3 Équipe

### Modèle général

Chaque joueur possède plusieurs Teams.

Une seule Team est sélectionnée comme active.

Il n'existe pas dans la cible standalone une composition active indépendante copiée depuis un preset :
- la Team sélectionnée est elle-même l'équipe active ;
- l'UI, Twitch et les systèmes métier utilisent cette même Team.

Équipe active :
- 0 à 4 personnages ;
- aucun doublon ;
- une Team vide/incomplète peut rester active ;
- Team 1 active par défaut pour un nouveau joueur ;
- sélection active persistante entre sessions ;
- les domaines consommateurs peuvent imposer leurs propres préconditions.

### Sidebar

La sidebar/colonne gauche :
- affiche la Team active ;
- affiche discrètement son numéro et son nom éventuel ;
- se met à jour immédiatement ;
- est en lecture seule dans la V1.

Préserver une architecture permettant éventuellement son édition future.

### Gestion des Teams

- 10 positions permanentes de base ;
- positions actuelles 1..10 non supprimables ;
- positions 11+ supprimables depuis l'UI ;
- extensions illimitées ;
- contrôle `+` après la dernière Team ;
- créer une Team supplémentaire ne l'active pas ;
- plusieurs Teams supplémentaires peuvent rester vides ;
- une Team supplémentaire active doit être désactivée avant suppression.

Vider ≠ supprimer :
- vider conserve emplacement et nom ;
- supprimer retire l'entité supplémentaire ;
- Twitch/chat ne supprime jamais physiquement une Team.

### Réorganisation des Teams

Drag & drop vertical :
- effectué depuis la carte hors de la zone personnages ;
- permet de déplacer librement une Team à n'importe quelle position ;
- renumérotation automatique ;
- sauvegarde immédiate ;
- une Team active déplacée reste active.

La suppression dépend de la position actuelle :
- 1..10 protégées ;
- 11+ supprimables.

L'identité interne ne dépend jamais du numéro affiché.

### Composition

- quatre slots maximum ;
- une Team peut être temporairement 0..4 ;
- ajout, retrait et remplacement direct ;
- sauvegarde immédiate après chaque action valide ;
- aucune composition complète dupliquée entre Teams ;
- l'ordre des personnages n'entre pas dans la détection de doublon.

Drag & drop personnage :
- uniquement horizontalement à l'intérieur de sa Team ;
- ne doit jamais déclencher le déplacement vertical de la Team ;
- ordre uniquement visuel, sans effet gameplay actuel.

### Sélecteur personnage

Ajouter/Changer utilise un sélecteur inspiré de la Box :
- personnages possédés ;
- personnages actifs ;
- recherche temps réel ;
- filtres ;
- personnage déjà présent dans cette Team non sélectionnable.

### Recherche transversale

Pour les listes pertinentes du projet :
- filtrage instantané à chaque caractère ;
- sous-chaîne contiguë uniquement ;
- normalisation casse/accents ;
- pas de fuzzy implicite par lettres dispersées.

Exemple :
`Ya` trouve Yanfei/Yaoyao mais pas Yelan.

Cette direction vaut aussi pour :
- Personnages ;
- Box ;
- joueurs ;
- objets ;
- autres listes de recherche adaptées.

### Noms

- facultatifs ;
- espaces et accents autorisés ;
- maximum cible 20 caractères ;
- noms identiques autorisés.

### Passifs

- uniquement dérivés de la Team active pour le gameplay ;
- jusqu'à deux stacks par élément ;
- Team partielle comprise ;
- recalcul immédiat lors d'une modification ;
- aperçu des passifs également visible sur les autres Teams dans l'écran de gestion ;
- valeurs déjà définies dans le Domaine Gacha.

### Présentation des cartes Team

Cartes/lignes horizontales :
- quatre personnages utilisent la largeur horizontale utile ;
- nom/passifs/informations complémentaires au-dessus ou en dessous ;
- activation séparée de l'édition ;
- contrôle d'activation compact en haut à droite, préférence actuelle pour un interrupteur gauche/droite ;
- Team active visuellement mise en évidence sans changer automatiquement de position.

### Twitch/chat

Commandes cibles principales :
- `!team`
- `!team <N>`
- `!team <N> apply`
- `!team add <nom>`
- `!team remove <nom>`
- `!team remove all`
- `!team <N> remove`
- `!team <N> rename "Nom"`
- `!team rename "Nom"`
- `!team list`
- `!team list <page>`
- `!team new`

Règles :
- `apply` sélectionne une Team comme active ;
- `add/remove` modifient la Team active ;
- `add` utilise le premier slot vide ;
- `remove` d'une Team vide sa composition, ne détruit pas son emplacement ;
- `new` crée la prochaine Team à la fin sans l'activer ;
- `list` pagine 10 Teams ;
- alias `liste` accepté mais non mis en avant ;
- `save` / `save N` ne modifient plus les données et renvoient un helper de syntaxe ;
- helpers courts, une seule syntaxe recommandée ;
- aucune formulation donnant l'impression d'une migration ;
- réponses Twitch sur une seule ligne ;
- aucune confirmation en plusieurs étapes sur Twitch.

### Visibilité

- équipe active potentiellement publique selon confidentialité ;
- visible même hors ligne ;
- Team vide/incomplète affichée telle quelle ;
- numéro visible avec la Team ;
- nom soumis à la granularité future de confidentialité ;
- passifs visibles uniquement si la Team elle-même est visible ;
- Saved Teams privées ;
- personnages de la Team publique ouvrables via la fiche publique commune.

### Désactivation personnage

- Team active → retirer uniquement le personnage ;
- position 1..10 contenant ce personnage → vider la composition complète ;
- position 11+ contenant ce personnage → supprimer la Team supplémentaire ;
- aucune restauration automatique à la réactivation.

### Migration

Le legacy possède encore `team` + `savedTeams`.

La cible devra convertir ces deux états vers :
- collection de Teams ;
- identité de la Team active.

Stratégie détaillée à finaliser pendant la dernière passe de migration Team.

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

## 6.6 Objectifs personnels — FUTUR / DIRECTION VALIDÉE

Prévoir plus tard un système transversal `Objectifs`.

Exemples de catégories :
- obtenir un personnage précis ;
- atteindre un montant de Primogemmes ;
- atteindre un montant de Moras ;
- pour les Moras, possibilité future de choisir si la Banque est incluse ;
- autres types à définir dans un audit dédié.

UX envisagée :
- écran `Objectifs` dédié ;
- possibilité de définir un personnage comme objectif depuis l'écran `Personnages` ;
- si ce personnage apparaît dans une bannière, afficher une indication discrète comme `🎯` ;
- lorsqu'un objectif est atteint, il est automatiquement considéré comme terminé/retiré ;
- possibilité d'une notification d'accomplissement.

Architecture :
- ne pas coder séparément une logique d'objectif dans chaque domaine ;
- les systèmes métier produisent leurs changements/événements autoritatifs ;
- un futur service Objectifs évalue les objectifs concernés.

La liste exacte des catégories, limites et historiques sera définie plus tard.

## 6.7 Confidentialité joueur — DIRECTION VALIDÉE

Prévoir dans le futur écran `Paramètres` un onglet `Confidentialité`.

Principe :
- informations publiques par défaut ;
- selon la catégorie, possibilité de choisir :
  - `Public` ;
  - `Amis uniquement` ;
  - `Privé`.

Le système doit être capable à terme d'une granularité plus fine que la simple Box entière.

Exemples potentiels :
- Box ;
- date d'obtention ;
- favoris ;
- copies ;
- ressources ;
- statistiques ;
- statistiques Combat ;
- autres catégories futures.

La V1 n'est pas obligée d'exposer immédiatement toute cette granularité.

Sécurité :
- appliquer les permissions côté serveur ;
- ne jamais dépendre uniquement du masquage frontend.

UX :
- une section inaccessible reste visible avec un état de confidentialité ;
- distinguer clairement contenu vide et contenu privé.

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
- un joueur peut commencer et continuer à jouer depuis Twitch sans avoir créé de compte web GachaImpact ;
- le backend lui associe un joueur interne Twitch-only ;
- la liaison autoritative repose sur le Twitch User ID stable, jamais sur le pseudo comme clé métier ;
- elle peut progresser via ses messages jusqu'au seuil d'onboarding Twitch ; direction validée : niveau 2 ;
- si elle n'a pas choisi d'élément à ce stade, le jeu lui demande de le faire puis bloque les mécaniques actives tant que l'élément n'est pas choisi ;
- `!element <élément>` reste la porte d'activation naturelle du profil Twitch.

Si ce joueur crée plus tard un compte web :
- il choisit `Connecter Twitch` ;
- l'identité Twitch est vérifiée ;
- si le Twitch User ID possède déjà un profil Twitch-only, le compte web est rattaché à ce même joueur interne ;
- ne pas créer un second profil ;
- ne pas recommencer sa progression ;
- ne pas copier les données : elles appartenaient déjà au même joueur interne.

Anciens joueurs Streamer.bot :
- leurs données historiques suivent la stratégie de migration legacy déjà prévue ;
- la liaison Twitch ultérieure permet de retrouver leur identité migrée.

Direction intégration Twitch :
- prévoir un service serveur de pont Twitch, conceptuellement `TwitchBridge` ;
- réception des messages Twitch via les mécanismes Twitch prévus pour les chatbots ;
- résolution Twitch User ID → joueur interne ;
- appel des mêmes services métier que l'UI/chat interne ;
- réponse sur Twitch via le compte bot ;
- Streamer.bot ne fait pas partie de l'architecture finale.

L'implémentation technique exacte OAuth/EventSub/bot sera définie avec le backend et le domaine Twitch.

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

# 14. PERSONNAGES / BOX / CONSTELLATIONS — AUDIT CLÔTURÉ

Document spécialisé :
`docs/legacy/07-box-possession-obtention-audit.md`

## 14.1 Catalogue et possession

Séparer conceptuellement :
- le personnage du catalogue ;
- la possession de ce personnage par un joueur.

Une seule possession par couple joueur/personnage.

La possession porte notamment :
- `constellation` ;
- `copies` ;
- `firstObtainedAt` ;
- statut favori ;
- futures données personnelles du personnage si nécessaire.

## 14.2 Première obtention

Première copie :
- `copies = 1` ;
- `constellation = 0` ;
- `firstObtainedAt` initialisé.

`firstObtainedAt` reste ensuite immuable.

Dans l'UI, cette date est consultable depuis la fiche Box du personnage.

## 14.3 Doublons

Deuxième copie :
- C1.

Troisième :
- C2.

...

Septième :
- C6.

À partir de la huitième :
- constellation reste C6 ;
- `copies` continue à augmenter.

## 14.4 Masterless Stella Fortuna

Dans GachaImpact, une Stella utilisée sur un personnage 5★ compte comme une copie synthétique :
- `copies +1` ;
- si le personnage est inférieur à C6 : `constellation +1` ;
- si le passage atteint C6 : initialisation normale du système Concours ;
- si le 5★ est déjà C6 : progression Concours correspondante.

Règles supplémentaires :
- Stella interdite sur tous les personnages 4★ ;
- Stella ne donne jamais le remboursement Primogemmes d'un doublon C6+ obtenu via Pull ;
- si un 5★ C6 possède déjà toutes ses statistiques Concours au maximum, l'utilisation est refusée avant consommation ;
- aucune compensation +100 000 Moras via Stella dans ce cas ;
- validation, consommation et mise à jour doivent être transactionnelles ;
- `!stella` côté texte exige le nom exact après normalisation casse/accents ;
- ne pas accepter de nom partiel, fuzzy matching ou ID technique ;
- l'UI demande confirmation avant consommation.

Correction legacy :
`Stella.txt` augmente actuellement la constellation sans augmenter `copies` et autorise certains 4★ ; ces comportements ne sont pas conservés.

## 14.5 Favoris

- favoris uniquement pour les personnages possédés ;
- aucune limite ;
- favoris visibles dans Box, pas comme favoris dans l'écran catalogue Personnages ;
- favoris toujours remontés en haut de la Box ;
- ordre interne dépend du tri actif ;
- Twitch `!box favoris` conserve son affichage legacy propre.

## 14.6 Données dérivées

Ne pas stocker inutilement :
- nombre de personnages possédés ;
- nombre de C6 ;
- total de copies.

Ces valeurs sont dérivées depuis les possessions actives/visibles.

## 14.7 Personnage désactivé

Un personnage désactivé est entièrement invisible et inutilisable côté joueur :
- Personnages ;
- Box ;
- Team ;
- passifs ;
- Expedition ;
- Combat ;
- votes ;
- bannières ;
- autres usages player-facing.

Ses données et anciennes relations restent conservées côté serveur/Admin.

Conséquences :
- retirer le personnage des Teams active et sauvegardées ;
- annuler une Expedition active sans consommer la tentative quotidienne ;
- historiques player-facing : afficher un placeholder `Personnage indisponible` ;
- statistiques visibles de collection excluent le personnage tant qu'il est désactivé.

## 14.8 Migration Box

Correction certaine de `copies` :

`copiesCible = max(copiesLegacy, constellation + 1)`

Objectif :
- réparer le minimum mathématiquement certain causé notamment par l'ancien comportement Stella ;
- ne jamais inventer davantage de copies.

Favoris orphelins :
- ne créent jamais de possession.

Possession dont le personnage catalogue est introuvable :
- conserver les données ;
- masquer côté joueur ;
- signaler dans le rapport d'import ;
- permettre un rattachement futur après correction du catalogue.

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
- une Stella ne remplace pas cette date ;
- l'information est consultable depuis la Box/fiche personnage ;
- il n'existe pas, à ce stade, de besoin validé de stocker l'historique de chaque copie.

Migration :
- date legacy valide → conserver la date réelle ;
- date absente/invalide → utiliser le timestamp du cutover/import comme date fallback ;
- conserver intérieurement la provenance `legacy` ou `migration_fallback` afin de ne pas confondre une date artificielle avec une vérité historique.

---

# 17. SYSTÈME DE BANNIÈRE / GACHA — AUDIT CLÔTURÉ

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
- désactivation/archivage rapide d'un import incorrect ;
- éviter la suppression destructive des personnages déjà référencés ;
- remplacement d'urgence de bannière via action spécifique et journalisée si nécessaire ;
- ajout manuel exceptionnel ;
- corrections de ressources ;
- corrections de possessions/personnages ;
- actions sur un ou plusieurs joueurs ;
- permissions fortes ;
- journalisation des actions sensibles.

Administration initiale :
- Kichnifou = administrateur initial ;
- prévoir plus tard un système de rôles permettant de promouvoir d'autres comptes administrateurs ;
- gestion/révocation des permissions à concevoir dans le futur domaine Admin/Modération.

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

## Finalisation Gacha — R96 à R116 validées

Derniers edge cases :
- votes publics et vote intégré à l'écran Personnages ;
- personnage voté déjà présent parmi les trois 5★ aléatoires correctement géré ;
- aucune bannière invalide/incomplète publiée ;
- nouveau personnage importé en cours de semaine sans modification de la bannière active ;
- `!vote` conserve son fuzzy matching legacy sans confirmation ;
- `!banniere` reste un message Twitch unique ;
- `!pity` n'affiche pas le streak statistique.

Historique :
- écran Historique global ;
- onglets Invocations / Bannières au minimum ;
- snapshots des votes ;
- votes individuels conservés via IDs internes ;
- origine exacte du 5★ communautaire ;
- possibilité future de consulter qui avait voté pour quoi.

Robustesse :
- votes figés avant génération ;
- échec de rotation = ancien cycle conservé + snapshot intact ;
- bannière séparée conceptuellement du catalogue ;
- désactivation/archivage préférée à suppression destructive ;
- cible devenue invalide vidée sans perte de progression ;
- coût complet requis avant x10.

Cutover :
- conserver la bannière legacy active jusqu'à sa rotation normale ;
- migrer les votes actifs ;
- conserver les cibles valides ;
- bannière legacy active = première entrée Historique avec origine `import legacy` ;
- ne jamais inventer les informations historiques inconnues.

Vérification croisée finale effectuée sur :
- `Pull.txt` ;
- `Banniere.txt` ;
- `Vote.txt` ;
- `Select.txt` ;
- `Pity.txt` ;
- génération hebdomadaire de `XP.txt` ;
- JSON liés.

**Domaine Gacha / Invocation : CLÔTURÉ après R116.**

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
- `legacy/07-box-possession-obtention-audit.md`
- `legacy/08-team-audit.md`
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

Troisième domaine : Gacha / Invocation.
Document : `docs/legacy/06-gacha-invocation-audit.md`.
Statut : **CLÔTURÉ le 2026-08-28**.
Décisions validées :
- R54 à R59 : bannière / rotation / vote / sélection ;
- R60 à R65 : coût / pity / priorité / récompenses secondaires ;
- R66 à R74 : 50/50 / garantie / Capture / statistiques associées ;
- R75 à R84 : passifs élémentaires du Pull ;
- R85 à R88 : copies / C6 / hook Concours ;
- R89 à R95 : atomicité x10 / historique / statistiques / Early-Back-to-back-Hard / arrondis ;
- R96 à R102 : derniers edge cases Bannière / Vote / Pity ;
- R103 à R112 : historique global / historique bannière-votes / robustesse / Admin ;
- R113 à R116 : cutover legacy Gacha ;
- direction animation UI validée ;
- historique Invocation complet avec pagination 10/page validé ;
- historique des bannières et votes validé ;
- direction synchronisation automatique catalogue validée ;
- direction vue Admin/Modérateur validée.

Domaine Gacha / Invocation : **CLÔTURÉ**.

Quatrième domaine :
**Box / Possessions / Obtention**

Document :
`docs/legacy/07-box-possession-obtention-audit.md`

Statut :
**CLÔTURÉ le 2026-08-28 — R117 À R176 VALIDÉS**

Correction de périmètre :
- `Liste.txt` ne concerne pas la Box ;
- `!liste <élément>` liste des joueurs selon leur élément ;
- ce script est reporté à un futur domaine utilitaire/social/joueurs.

Sources principales actuelles :
- `Box.txt` ;
- `Obtention.txt` ;
- `Stella.txt` ;
- possessions `box` dans `viewers_data.json` ;
- `boxFavorites` ;
- options de tri Box ;
- dépendances Team / Expedition / Concours / Gacha.

Décisions déjà validées :
- R117/R118 : catalogue et possession séparés, une possession unique joueur/personnage ;
- R119/R127–R129 : Stella = copie synthétique 5★ avec règles corrigées ;
- R120/R135/R138 : première date d'obtention + fallback migration traçable ;
- R121–R123/R130/R131/R133/R136/R137 : favoris, tris et onglets Box ;
- R124 : présentation paginée Twitch distincte de l'UI ;
- R125 : `!obtention` côté chat, information intégrée à la fiche UI ;
- R126 : statistiques collection dérivées ;
- R132 : correction minimale certaine de `copies` au cutover ;
- R134/R139–R142 : comportement des personnages désactivés ;
- R143 : possessions orphelines conservées et signalées ;
- R144 à R149 : règles de réparation/quarantaine des anomalies Box legacy ;
- R150 : service central de possession personnage ;
- R151 à R156 : tris legacy, désactivation/réactivation, C6 et permanence des possessions ;
- R157 à R159 : filtres constellation, cartes Box et favori UI ;
- R160 à R169 : Box publique, fiche commune, consultation, filtres et résumé collection ;
- R170/R172/R173/R174 : système de confidentialité public/amis/privé et granularité future ;
- R171 : copies visibles dans la fiche détaillée mais pas sur les cartes ;
- R175 : `!stella` sécurisé par nom exact, sans ID ni correspondance partielle ;
- R176 : confirmation UI obligatoire avant consommation d'une Stella.

**Domaine Box / Possessions / Obtention : CLÔTURÉ.**

Idées transverses découvertes :
- futur système `Objectifs` personnels, à spécifier dans un domaine dédié ;
- confidentialité joueur transversale à spécifier avec Paramètres / Social / Permissions ;
- profil Twitch-only rattachable ultérieurement au compte web via Twitch User ID.

Cinquième domaine :
**Team**

Document :
`docs/legacy/08-team-audit.md`

Statut :
**CLÔTURÉ le 2026-08-30 — R177 À R236 VALIDÉS**

Décisions principales :
- équipe active = une Team directement sélectionnée ;
- Team 1 active par défaut ;
- 0 à 4 personnages ;
- aucune duplication d'un personnage ;
- 10 positions protégées selon l'ordre courant ;
- extensions illimitées ;
- Teams >10 supprimables depuis l'UI si non actives ;
- drag vertical des Teams avec renumérotation ;
- drag horizontal des personnages au sein d'une Team ;
- autosave ;
- ajout / retrait / remplacement direct ;
- compositions complètes dupliquées interdites ;
- noms facultatifs jusqu'à 20 caractères avec espaces/accents ;
- passifs dérivés et recalculés immédiatement ;
- passifs actifs même avec Team partielle ;
- Team active potentiellement publique selon confidentialité ;
- Saved Teams privées ;
- sidebar en lecture seule dans la V1 ;
- `!team new` pour créer une Team supplémentaire ;
- `!team list` paginé par 10 ;
- `apply` sélectionne la Team active ;
- `save` ne réalise plus de mutation métier et renvoie un helper ;
- réponses Twitch en une seule ligne ;
- recherche temps réel transversale par sous-chaîne contiguë ;
- `!passifs` conservé comme référentiel général.

Consommateurs confirmés :
- Gacha/Pull → passifs ;
- Combat → composition active ;
- Profil/Infos → consultation ;
- Expedition → aucune dépendance métier Team ;
- Passif → référentiel général sans état joueur.

Migration :
- conversion de `team` + `savedTeams` vers collection de Teams + Team active ;
- conservation des positions/presets historiques autant que possible ;
- détection des compositions identiques ;
- préservation d'une ancienne équipe active distincte sans écraser les presets ;
- importer rerunnable/idempotent.

**Domaine Team : CLÔTURÉ.**

Sixième domaine :
**Banque**

Document :
`docs/legacy/09-banque-audit.md`

Statut :
**CLÔTURÉ le 2026-08-31 — R237 À R255 VALIDÉS**

Décisions principales :
- portefeuille et Banque = soldes distincts ;
- dépôt/retrait = transferts internes ;
- aucun frais/cooldown/plafond V1 ;
- MAX UI et `max` Twitch/chat ;
- écran Banque dédié ;
- patrimoine total dérivé ;
- intérêt 3 % automatique au reset serveur ;
- joueur hors ligne inclus ;
- estimation dynamique de l'intérêt ;
- compte à rebours uniquement UI ;
- pas de notification quotidienne d'intérêt ;
- historique récent Banque + Historique global complet ;
- historique bancaire détaillé privé ;
- solde Banque soumis à Public / Amis / Privé ;
- protection contre fuite via données dérivées ;
- sidebar = portefeuille uniquement ;
- message `!banque` complet sur une ligne avec emojis et helpers ;
- montants texte = entier ou `max`.

Migration :
- importer portefeuille / Banque / stats exacts ;
- ne pas reconstruire d'intérêts passés ;
- ne pas fabriquer d'historique Banque legacy ;
- `lastInterestDate` legacy ne pilote pas le scheduler cible ;
- premier intérêt standalone au prochain reset normal.

Dépendance reportée :
- `Top / Classements` devra décider la définition d'un classement Moras ;
- le legacy `!top moras` utilise actuellement le portefeuille uniquement ;
- aucun classement ne devra permettre de déduire une Banque privée.

**Domaine Banque : CLÔTURÉ.**

Septième domaine à auditer :
**Sac / Coffre / Shop**

Document spécialisé à créer au démarrage :
`docs/legacy/10-sac-coffre-shop-audit.md`

Objectifs initiaux :
- comprendre le vrai contenu du Sac ;
- comprendre ce que `Coffre.txt` représente réellement ;
- auditer `Shop.txt` et `shop_items.json` ;
- distinguer ressources cœur, objets spéciaux, tickets, monnaies temporaires et inventaire ;
- vérifier achats/prix/stocks ;
- vérifier interactions Missions/Daily ;
- cadrer l'UI Sac/Boutique ;
- préparer la future modélisation inventaire.

Ordre recommandé :

1. XP / cycle de vie joueur
2. Élément / ressources / conversion
3. Gacha :
   - Banniere
   - Select
   - Pull
   - Pity
   - Vote
4. Box / Possessions / Obtention
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
  - box / possessions ;
  - constellation ;
  - copies ;
  - `firstObtainedAt` + provenance fallback éventuelle ;
  - favoris ;
  - possessions orphelines/non résolues ;
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
- `docs/legacy/04-xp-audit.md` — XP / cycle de vie joueur ;
- `docs/legacy/05-element-resources-audit.md` — Élément / Ressources / Conversion / Échanges ;
- `docs/legacy/06-gacha-invocation-audit.md` — Gacha / Invocation ;
- `docs/legacy/07-box-possession-obtention-audit.md` — Box / Possessions / Obtention ;
- `docs/legacy/08-team-audit.md` — Team ;
- `docs/legacy/09-banque-audit.md` — Banque — **R237 À R255**.

Domaine Banque :
- code legacy lu ;
- dépôt/retrait cadrés ;
- intérêt automatique cadré ;
- UI cadrée ;
- Twitch/chat cadré ;
- historique cadré ;
- confidentialité cadrée ;
- migration cadrée ;
- dépendance Top/Classements explicitement reportée.

**Prochaine étape unique : démarrer le Domaine 7 — Sac / Coffre / Shop en lisant intégralement les trois scripts et leurs données associées avant de poser de nouvelles décisions.**

Document à créer :
`docs/legacy/10-sac-coffre-shop-audit.md`

À vérifier :
1. rôle réel de `Sac.txt` ;
2. rôle réel de `Coffre.txt` ;
3. rôle réel de `Shop.txt` ;
4. `shop_items.json` ;
5. objets/ressources spéciales ;
6. monnaies/tickets ;
7. prix et achats ;
8. stocks éventuels ;
9. interactions Missions/Daily ;
10. architecture future inventaire / boutique.

Dépendance future à conserver :
- lors de l'audit `Top / Classements`, décider explicitement portefeuille vs patrimoine total pour les Moras ;
- respecter la confidentialité Banque et empêcher toute déduction indirecte d'un solde privé.

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
- historique des bannières/votes depuis le standalone, avec snapshot et votes individuels ;
- écran Historique global prévu avec onglets Invocations / Bannières et futurs onglets pertinents ;
- Early / Back-to-back / Hard conservés et statistiques dérivables ;
- animation UI de Pull avec révélation progressive et anticipation dorée du 5★ ; Twitch reste textuel ;
- futur catalogue personnages automatiquement synchronisé avec vérification de sortie/complet + français ;
- nouveaux 5★ importés en cours de semaine immédiatement votables sans modifier la bannière active ;
- vote possible directement depuis l'écran Personnages ;
- future vue Admin/Modérateur pour corrections catalogue/joueurs ; Kichnifou admin initial, autres admins promouvables plus tard ;
- cutover Gacha : bannière/votes/cible actifs conservés si valides ;
- domaine Gacha / Invocation clôturé après R116 ;
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
- dates legacy valides conservées et timestamps historiques interprétés comme Europe/Paris ; exception explicitement validée pour `firstObtainedAt` manquant/invalide : utiliser la date de migration comme fallback traçable ;
- Twitch : nouveau chatter enregistré passivement, progression jusqu'au seuil d'onboarding puis blocage des mécaniques actives tant que l'élément n'est pas choisi ;
- suivi quotidien UI prévu dans le bloc bas gauche avec chevrons compacts.

Prochaine étape :
démarrer le Domaine Sac / Coffre / Shop ; la question `!top moras` portefeuille vs patrimoine total reste explicitement reportée au futur audit Classements.
