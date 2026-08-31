# Registre des commandes GachaImpact

Statut : À CONSTRUIRE pendant l'audit des scripts.

Ce fichier deviendra la base documentaire de la future section **Aide / Commandes** intégrée à GachaImpact.

## Règle d'audit

Pour chaque commande :
1. lire le commentaire d'en-tête pour obtenir une vue générale ;
2. lire intégralement le code réel ;
3. relever toutes les syntaxes et sous-commandes ;
4. relever préconditions, coûts, cooldowns et permissions ;
5. relever les données lues / écrites ;
6. relever les interactions avec les autres systèmes ;
7. décider ce qui reste disponible par bouton, chat GachaImpact et Twitch ;
8. documenter les réponses / erreurs pertinentes.

### Règles globales des helpers Twitch/chat

Lorsqu'une commande est mal écrite, incomplète ou utilise une syntaxe qui n'est plus l'action cible :
- répondre avec un helper court ;
- indiquer uniquement comment utiliser correctement le système actuel ;
- ne jamais mentionner une migration, un ancien comportement ou le fait qu'une commande « a changé » ;
- ne montrer qu'une seule syntaxe recommandée même si plusieurs alias sont techniquement acceptés ;
- éviter les confirmations en plusieurs messages côté Twitch/chat ;
- structurer les réponses Twitch sur une seule ligne.

## Commandes repérées dans la capture du dossier `Commandes`

Ami, Bannière, Banque, Box, Code, Coffre, Combat, Concours, Convertir, Daily, Échanger, Élément, Event, Expedition, Faveur, Gift, Help, Infos, Légende, Liste, Missions, Obtention, Passif, Pity, Pull, Roue, Sac, Select, Shop, Stella, Subscription, Team, Top, Vote, Wish, XP.

Cette liste est un inventaire visuel initial et sera confirmée par les fichiers réels.

## Modèle d'entrée

### `!commande`
- **Statut audit :** À faire
- **But :**
- **Syntaxes :**
- **Bouton UI équivalent :**
- **Disponible chat GachaImpact :**
- **Disponible Twitch :**
- **Préconditions :**
- **Coûts :**
- **Cooldown :**
- **Données lues :**
- **Données écrites :**
- **Réponses utilisateur :**
- **Erreurs / edge cases :**
- **Interactions :**
- **Décisions de migration :**

---

## `!element`

- **Statut audit :** Audité — domaine Élément
- **But :** Choisir définitivement l'élément personnel du joueur.
- **Syntaxes :** `!element pyro|hydro|cryo|electro|anemo|geo|dendro`
- **Bouton UI équivalent :** choix intégré à l'onboarding standalone
- **Disponible chat GachaImpact :** à conserver si pertinent pour les profils nécessitant encore un choix
- **Disponible Twitch :** oui, mécanisme d'onboarding Twitch
- **Préconditions :** profil existant ; aucun élément déjà choisi
- **Coûts :** aucun
- **Cooldown :** aucun observé
- **Données lues :** profil joueur, `element`
- **Données écrites :** `element`
- **Réponses utilisateur :** confirmation du choix ; aide si élément invalide ; message si élément déjà choisi
- **Erreurs / edge cases :** profil absent ; élément absent/invalide ; tentative de changement après choix
- **Interactions :** onboarding, particules personnelles, conversion, échanges, autres systèmes dépendant de l'élément
- **Décisions de migration :** élément permanent conservé ; standalone = choix obligatoire pendant onboarding ; Twitch conserve `!element`

## `!convertir`

- **Statut audit :** Audité — conversion R1 à R4 validée
- **But :** Convertir les particules de l'élément personnel en Primogemmes.
- **Syntaxes :** `!convertir <montant>`
- **Bouton UI équivalent :** oui, future interface de conversion avec quantité et raccourcis pratiques
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** profil existant ; élément choisi ; montant entier >= 1 ; stock personnel suffisant
- **Coûts :** X particules personnelles
- **Cooldown :** aucun observé
- **Taux :** 1 particule = 1 Primogemme
- **Données lues :** `element`, `particles[element]`, mission quotidienne éventuelle
- **Données écrites :** `particles[element]`, `primogems`, `stats.totalPrimosEarned`, progression mission quotidienne legacy éventuelle
- **Réponses utilisateur :** confirmation avec quantité convertie et nouveau total de Primogemmes
- **Erreurs / edge cases :** profil absent ; élément non choisi ; montant invalide ; stock insuffisant
- **Interactions :** Missions/Daily via `convert_particles`
- **Décisions de migration :** conversion manuelle conservée ; toute quantité entière >= 1 ; une seule logique métier serveur partagée UI/chat/Twitch

## `!echanger`

- **Statut audit :** Audité — sous-domaine Échanges finalisé, R5 à R27 validées
- **But :** Échanger des particules avec un joueur d'un autre élément.
- **Syntaxes :**
  - `!echanger`
  - `!echanger <pseudo>`
  - `!echanger <pseudo> <montant>`
  - `!echanger liste`
  - `!echanger accepter`
  - `!echanger accepter <pseudo>`
  - `!echanger annuler`
  - `!echanger annuler <pseudo>`
  
- **Bouton UI équivalent :** oui, futur écran Échanges
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** profils existants ; éléments choisis ; joueurs différents ; éléments différents ; montant réalisable ; aucune demande active entre la paire
- **Coûts :** X particules de l'élément de l'autre joueur contre X particules de son propre élément
- **Cooldown :** aucun observé
- **Données lues :** `element`, `particles`, `tradeRequests`
- **Données écrites legacy :** `particles`, `tradeRequests`
- **`!echanger` sans argument :** ne devra plus proposer que les joueurs avec lesquels un échange est réellement possible ; afficher la quantité échangeable entre parenthèses
- **`!echanger <pseudo>` :** raccourci MAX, demande le maximum actuellement échangeable
- **`!echanger accepter` :** accepter toutes les demandes de la plus ancienne à la plus récente, avec revalidation/réduction dynamique entre chaque opération
- **Refuser tout :** supprime toutes les demandes reçues concernées et libère immédiatement les réservations chez les expéditeurs
- **Réponses utilisateur :** création, liste, acceptation, annulation, erreurs de stock, partenaires réellement compatibles
- **Erreurs / edge cases :** auto-échange ; même élément ; montant invalide ; joueur absent ; élément manquant ; stock insuffisant ; demande déjà existante ; demande réduite automatiquement si le stock destinataire baisse
- **Réservation cible :** uniquement le stock de l'expéditeur est réservé
- **Stock destinataire :** vérifié à la création mais non réservé ; une baisse ultérieure réduit automatiquement le montant courant
- **Montant dynamique :** peut uniquement diminuer ; à 0 la demande disparaît silencieusement ; la réservation libérée redevient immédiatement disponible
- **Acceptation :** pas d'acceptation partielle manuelle
- **Interactions :** réservation de stock ; expiration quotidienne ; notification agrégée des demandes en attente ; historique récent UI ; historique serveur ; réconciliation automatique lors des variations de stock
- **Décisions de migration :** troc X contre X conservé ; une demande par paire ; expiration serveur à 00:00 Europe/Paris ; écran UI reçues/envoyées ; notification agrégée ; source de vérité DB unique
- **Historique futur :** conserver les événements importants d'échange côté serveur à partir de GachaImpact, sans inventer d'historique rétroactif
- **Action future supplémentaire :** `Refuser tout` pour les demandes reçues ; syntaxe chat exacte à figer lors de l'adaptation finale des commandes.
- **Notifications :** aucune notification individuelle lors d'une acceptation/refus/annulation/expiration ; seule la notification agrégée des demandes en attente est utilisée
- **Historique UI :** environ 3 transactions visibles puis scroll jusqu'à environ 20–30 dernières
- **Migration :** les demandes en attente ne sont pas migrées au cutover
- **Identité cible :** relations basées sur les IDs internes immuables des joueurs
## `!banniere`
- **Statut audit :** Audité — domaine Gacha / Invocation clôturé
- **But :** Afficher la bannière active et la cible 5★ personnelle lorsqu'elle est valide.
- **Syntaxe :** `!banniere`
- **Bouton UI équivalent :** écran Invocation complet
- **Disponible chat GachaImpact :** oui, sous forme compacte
- **Disponible Twitch :** oui
- **Préconditions :** bannière active
- **Coûts :** aucun
- **Données lues :** catalogue personnages, bannière active, cible personnelle
- **Données écrites :** aucune
- **Décisions cible :** bannière hebdomadaire 4×5★ + 6×4★ ; conserver un seul message Twitch contenant tous les personnages et la cible personnelle ; UI standalone beaucoup plus riche

## `!select`
- **Statut audit :** Audité — domaine Gacha / Invocation clôturé
- **But :** Sélectionner le 5★ ciblé parmi les quatre personnages actifs.
- **Syntaxes :** `!select`, `!select <nom>`
- **Bouton UI équivalent :** sélection visuelle des quatre 5★ + bouton `Changer`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** profil valide ; bannière active ; personnage 5★ présent dans la bannière
- **Coûts :** aucun
- **Données lues :** bannière active, cible actuelle
- **Données écrites legacy :** `selectedBannerCharacterId`
- **Décisions cible :** cible librement modifiable ; vidée automatiquement à chaque nouvelle bannière ; aucune pity/garantie reset lors d'un changement

## `!vote`
- **Statut audit :** Audité — domaine Gacha / Invocation clôturé
- **But :** Influencer le quatrième personnage 5★ de la bannière suivante.
- **Syntaxes :** `!vote`, `!vote <nom>`
- **Bouton UI équivalent :** vote directement depuis l'écran Personnages ; nombre de votes public sur les 5★ éligibles
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** personnage 5★ valide ; pas déjà en bannière ; joueur n'ayant pas encore voté cette semaine
- **Coûts :** aucun
- **Données lues/écrites legacy :** `banner_votes.json`, catalogue personnages
- **Décisions cible :** un vote définitif par ID joueur/semaine tous canaux confondus ; résultat pondéré ; conservation du fuzzy matching legacy côté texte ; snapshot + votes individuels historisés à partir de GachaImpact

## `!pity`
- **Statut audit :** Audité — domaine Gacha / Invocation clôturé
- **But :** Afficher pity 5★, pity 4★, garantie et Capture de brillance.
- **Syntaxe :** `!pity`
- **Bouton UI équivalent :** informations intégrées directement dans l'écran Invocation/sidebar
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Coûts :** aucun
- **Données lues :** pity 5★/4★, `guaranteedFeatured5`, `captureProgress`
- **Données écrites :** aucune
- **Décisions cible :** progression conservée entre rotations/cibles ; `fiftyFiftyLostStreak` et `captureProgress` sont distincts ; affichage compact `Garantie 5★ : oui/non` + `Capture : X/3` ; le streak n'est pas affiché par `!pity`

## `!pull`
- **Statut audit :** Audité — domaine Gacha / Invocation clôturé après R116
- **But :** Exécuter une ou plusieurs invocations.
- **Syntaxes :** `!pull`, `!pull <1..10>`
- **Bouton UI équivalent :** `Invocation x1` / `Invocation x10`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** profil valide ; cible 5★ active ; Primogemmes suffisantes ; bannière serveur valide
- **Coût :** 160 Primogemmes par Pull
- **Maximum :** 10 Pulls par action
- **Pré-paiement :** le coût complet est requis avant l'opération ; un x10 nécessite 1 600 Primogemmes avant tout remboursement/proc interne
- **Pity 5★ :** 0,6 % jusqu'à 73 ; soft pity dès 74 ; garantie 90
- **Pity 4★ :** 1,5 % jusqu'à 8 ; 19,5 % au 9e ; garantie 10
- **Priorité :** 5★ prioritaire si les deux jets réussissent ensemble ; pity 4★ conservée
- **50/50 gagné :** personnage 5★ ciblé
- **50/50 perdu :** un des trois autres 5★ actifs choisi uniformément
- **Garantie :** après perte, prochain 5★ = cible actuelle
- **Capture :** `captureProgress` +1 sur perte, -1 sur victoire, max 3 ; déclenchement à 3/3 puis reset 0
- **Streak :** `fiftyFiftyLostStreak` distinct de Capture ; perte +1, vraie victoire → 0
- **4★ :** tirage uniforme parmi les six personnages actifs
- **Récompense secondaire :** 50 % Moras 5k–15k / 50 % particules 20–80 d'un élément aléatoire
- **Passifs :** team active uniquement ; max deux stacks par élément ; plusieurs procs simultanés possibles
- **Pyro :** ×1,25 / ×1,5 particules secondaires
- **Geo :** ×1,25 / ×1,5 Moras secondaires
- **Hydro :** +0,3 / +0,6 point de chance 5★
- **Cryo :** 1/20 / 1/10 pour +1 XP via moteur XP
- **Electro :** 1/30 / 1/20 pour +2 pity après résolution
- **Anemo :** 1/12 / 1/8 pour remboursement 80 Primogemmes
- **Dendro :** 1/25 / 1/15 pour +40 Primogemmes, +1 000 Moras et +5 particules de chacun des 7 éléments
- **Copies :** C0 première copie ; C6 septième copie ; `copies` continue ensuite
- **C6+ 4★ :** remboursement 80 Primogemmes
- **C6+ 5★ :** remboursement 160 Primogemmes + progression Concours
- **x10 :** dix résultats calculés séquentiellement mais persistés dans une opération atomique avant animation
- **UI :** animation uniquement après persistance serveur ; fermeture/crash n'annule jamais les gains
- **Historique :** historique complet depuis GachaImpact ; bouton Historique ; 10 résultats par page
- **Twitch :** résultat textuel rapide, résultat par résultat
- **Mentions chat :** Early, Back-to-back et Hard (pity >= 80) conservés
- **Stats futures :** Early/Back-to-back/Hard et autres métriques dérivables depuis l'historique
- **Arrondi Pyro/Geo :** entier le plus proche, `.5` vers le haut
- **Interactions reportées :** chaque Pull individuel contribue aux éventuelles missions de type `pulls`, mais les règles et récompenses Missions appartiennent au domaine Missions ; règles Concours détaillées reportées au domaine Concours/C6

## `!box`
- **Statut audit :** Audité — domaine Box / Possessions / Obtention clôturé après R176
- **But :** Consulter et organiser les personnages possédés.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Bouton UI équivalent :** écran Box complet
- **Données principales :** possessions joueur, catalogue personnage, favoris, préférences de tri
- **Sous-commandes legacy conservées côté texte :** `!box`, `!box 5`, `!box 4`, `!box 6`, `!box <élément>`, `!box pN`, `!box favoris`, tris textuels
- **UI standalone :** onglets Tous / 5★ / 4★, grille, recherche, filtres combinables élément + constellation C0..C6, et tri
- **Favoris UI personnel :** toujours avant les non-favoris ; pas de limite ; toggle direct en un clic
- **Cartes :** ne pas afficher `copies`
- **Fiche détaillée :** constellation, copies, première obtention, `Favoris : Oui/Non`, futures stats propres au personnage
- **Tri UI persistant :** alphabétique, date d'obtention, constellation, élément
- **Filtres/onglet :** non persistants
- **Box publique :** mêmes outils de consultation mais aucune mutation ; favoris sans priorité d'ordre et sans étoile sur les cartes
- **État public initial :** Tous + Alphabétique ↑ + aucun filtre à chaque ouverture
- **Confidentialité :** accès soumis au futur système Public / Amis / Privé
- **Présentation Twitch :** peut conserver un format différent de l'UI ; `!box favoris <nom>` cible cependant désormais un nom exact normalisé et ne conserve pas le fallback legacy par nom partiel
- **Données dérivées :** taille Box, nombre de C6 et total copies
- **Personnage désactivé :** invisible/inutilisable côté joueur

## `!obtention`
- **Statut audit :** Audité — domaine Box / Possessions / Obtention clôturé
- **But :** Afficher la date de première obtention d'un personnage possédé.
- **Syntaxe :** `!obtention <personnage>`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Bouton UI équivalent :** aucune commande dédiée nécessaire ; information intégrée à la fiche du personnage dans Box
- **Données lues :** possession, `firstObtainedAt`, catalogue personnage
- **Données écrites :** aucune
- **Décision cible :** la première date est immuable ; date legacy absente/invalide → fallback à la date de migration, traçable intérieurement

## `!stella`
- **Statut audit :** Audité — domaine Box / Possessions / Obtention clôturé après R176
- **But :** Utiliser une Masterless Stella Fortuna comme copie synthétique sur un personnage 5★ possédé.
- **Syntaxe cible :** `!stella <nom exact>`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** action future depuis l'inventaire/fiche appropriée ; confirmation obligatoire avant consommation
- **Matching texte :** nom exact après normalisation casse/accents ; pas de nom partiel, fuzzy matching ou ID technique
- **Préconditions cible :** personnage possédé, rareté 5★, Stella disponible
- **Sous C6 :** `copies +1` et `constellation +1`
- **Passage C6 :** initialise le système Concours du 5★
- **Déjà C6 :** `copies +1` + progression Concours
- **4★ :** utilisation interdite
- **Stats Concours toutes max :** utilisation refusée avant consommation
- **Remboursement Primogemmes :** aucun remboursement C6+ via Stella
- **Atomicité :** vérification, consommation et progression doivent former une seule transaction
- **Bug legacy corrigé :** `Stella.txt` n'incrémente actuellement pas `copies` et autorise des 4★ sous C6

## `!team`
- **Statut audit :** Audité — Domaine Team clôturé après R236
- **But :** Consulter, activer et modifier les Teams du joueur.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** écran Équipe complet
- **Équipe active :** une des Teams du joueur, 0 à 4 personnages, sans doublon
- **Team par défaut :** Team 1 pour un nouveau joueur
- **Matching personnage texte :** nom exact après normalisation casse/accents
- **Commandes cibles principales :**
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
- **`apply` :** sélectionne la Team N comme active ; 0..4 autorisé
- **`add` :** ajoute au premier slot vide de la Team active
- **`remove` personnage :** retire de la Team active
- **`remove all` :** vide la Team active sans changer son nom ni son état actif
- **`<N> remove` :** vide la Team N côté Twitch/chat ; ne supprime jamais physiquement l'emplacement
- **`rename` :** nom facultatif, espaces/accents autorisés, cible 20 caractères
- **`list` :** pagination de 10 Teams ; Team active clairement indiquée ; Teams partielles affichées avec leur remplissage
- **Alias accepté :** `liste`, mais les helpers recommandent uniquement `list`
- **`new` :** crée la prochaine Team supplémentaire, vide et non active
- **`save` / `save N` :** aucune mutation cible ; helper vers les commandes actuelles
- **Saved Teams de base :** positions actuelles 1 à 10 non supprimables
- **Positions 11+ :** supprimables depuis l'UI si non actives
- **Réorganisation UI :** drag vertical des Teams → renumérotation immédiate
- **Réorganisation personnage :** drag horizontal uniquement à l'intérieur d'une Team
- **Composition dupliquée :** interdite pour les Teams complètes, ordre personnage ignoré
- **Passifs :** dérivés de la Team ; actifs même si composition partielle ; maximum deux stacks par élément
- **Saved Teams :** privées
- **Équipe active :** potentiellement publique selon Public / Amis / Privé
- **Profil public :** numéro/nom/composition/passifs selon permissions
- **UI :** autosave, remplacement direct, picker filtré, sélecteur actif séparé
- **Sidebar :** affiche numéro/nom/composition active ; non éditable dans la V1
- **Personnage désactivé :** actif → retrait ; position 1..10 concernée → composition vidée ; position 11+ concernée → Team supprimée
- **Réponses Twitch :** toujours structurées sur une seule ligne
- **Helpers :** courts, une syntaxe recommandée, aucune référence à une migration
- **Interactions :** Box/Possession, Passifs, Gacha, Combat, confidentialité

## `!passifs`
- **Statut audit :** Audité — Domaine Team clôturé après R236
- **But :** Afficher la table générale des passifs élémentaires et leur détail par élément.
- **Données joueur lues :** aucune
- **Données écrites :** aucune
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** présentation contextuelle des passifs dans l'écran Team, avec possibilité de détail
- **Source métier :** règles de passifs validées dans le Domaine Gacha R75–R84
- **Correction cible :** les textes affichés doivent refléter les règles Gacha finales, y compris les corrections apportées aux descriptions legacy
- **Différence avec `!team` :** `!passifs` décrit les règles générales ; Team calcule les passifs réellement actifs pour une composition

## `!banque`
- **Statut audit :** Audité — Domaine Banque clôturé après R255
- **But :** Consulter et transférer les Moras entre portefeuille et Banque.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** écran Banque dédié
- **Syntaxes cibles :**
  - `!banque`
  - `!banque deposer <montant>`
  - `!banque deposer max`
  - `!banque retirer <montant>`
  - `!banque retirer max`
- **Montant :** entier positif ou `max`; pas de `k`, `m`, décimales ou abréviations
- **Dépôt :** portefeuille → Banque
- **Retrait :** Banque → portefeuille
- **Frais :** aucun
- **Cooldown :** aucun
- **Plafond :** aucun en V1
- **Stats :** dépôt/retrait ne modifient pas `totalMorasEarned` / `totalMorasSpent`
- **Intérêt :** 3 % quotidien automatique au reset serveur, arrondi inférieur
- **Intérêt hors ligne :** oui
- **Message consultation :** une seule ligne, conserve emojis legacy, soldes, intérêt estimé et aide dépôt/retrait
- **Format cible :** `🏦 Banque <joueur> : X moras | 💰 Portefeuille : Y | Intérêt estimé (3%) : +Z | 📥 !banque deposer X | 📤 !banque retirer X`
- **UI :** MAX, intérêt estimé, compte à rebours, patrimoine total dérivé, historique récent, animation légère
- **Historique :** complet via écran Historique ; détaillé privé
- **Profil :** solde Banque exposable selon Public / Amis / Privé
- **Migration :** wallet/banque/stats exacts ; aucun historique ou intérêt rétroactif inventé
- **Interactions reportées :** `!top moras` / Classements à auditer séparément pour respecter la confidentialité Banque