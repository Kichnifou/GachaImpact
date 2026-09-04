# Registre des commandes GachaImpact

Statut : EN CONSTRUCTION — alimenté et consolidé domaine par domaine pendant l'audit des scripts.

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

## `!legende`

- **Statut audit :** CLÔTURÉ — Domaine Concours / C6 après R593
- **But :** consulter les personnages 5★ C6 et leur progression Concours
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **UI équivalente :** consultation des Légendes depuis le profil / les écrans concernés
- **Liste personnelle :** `!legende`
- **Liste d'un joueur :** `!legende <joueur>`
- **Détail d'un personnage :** `!legende <joueur> <personnage>`
- **Cible personnelle explicite :** `me` et `moi`
- **Exemple personnel détaillé :** `!legende moi <personnage>`
- **Liste :** affiche les personnages C6 accessibles de la cible
- **Détail :** cinq statistiques Concours, titres par thème, total concours/victoires et statistiques thématiques utiles
- **Confidentialité :** Public / Amis uniquement / Privé
- **Tous les canaux :** mêmes permissions et même source métier
- **Refus de permission :** ne révèle ni nombre de C6, ni noms, ni statistiques privées
- **Données catalogue :** jamais recopiées dans la progression C6
- **Personnage désactivé :** progression/historique conservés mais personnage non sélectionnable pour un nouveau concours
- **Vocabulaire player-facing :** ne jamais afficher le terme interne `legacy`

## `!concours`

- **Statut audit :** CLÔTURÉ — Domaine Concours / C6 après R593
- **But :** créer, rejoindre, regarder et jouer le Concours global
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **UI équivalente :** écran Concours complet
- **Résumé :** `!concours`
- **Créer :** `!concours open <personnage>`
- **Rejoindre / changer avant lancement :** `!concours rejoindre <personnage>`
- **Spectateur actif :** `!concours spectateur`
- **Quitter :** `!concours quitter`
- **Prêt :** `!concours pret`
- **Lancer :** `!concours start`
- **Annuler :** `!concours annuler`
- **Action sûre :** `!concours basique`
- **Action risquée :** `!concours risque`
- **Soutenir :** `!concours soutenir <participant>`
- **Alias :** `participant` / `participer`, `lancer`, `cancel`, `basic`, `risk` / `risqué`
- **Matching Légende :** nom exact après normalisation casse/accents
- **Soutien :** l'aide recommande le nom du participant/bot ; numéro de place 1–4 accepté comme raccourci
- **Lobby :** quatre places ; organisateur participant ; changement de Légende libre ; Ready obligatoire ; lancement manuel par l'organisateur
- **Participation quotidienne :** une par joueur et par journée Europe/Paris, consommée seulement au lancement effectif
- **Bots :** complètent les places vides et occupent de vraies positions de classement
- **Tours :** ordre aléatoire au lancement puis fixe
- **Timeout humain :** 60 s → action basique automatique
- **Inactivité :** trois tours consécutifs sans action humaine → remplacement par bot
- **Soutien :** après round complet, spectateur actif aléatoire ; 30 s ; +1/+2/+3
- **Actions :** basique = points de base ; risque = 0 / base / double à 1/3 chacun
- **Victoire :** premier participant atteignant ou dépassant 50
- **Récompenses :** 800 / 400 / 200 Primogemmes selon rang global ; bots non récompensés
- **Titres :** Bronze 1 victoire, Argent 3, Or 7, Platine 15 ; honorifiques
- **Historique :** public, détaillé, permanent à partir de GachaImpact ; anciens résultats non migrés
- **Confidentialité :** seules les informations nécessaires au match deviennent publiques
- **Atomicité :** lancement, actions, récompenses et résultat autoritaires côté serveur et protégés contre double exécution

## `!top`

- **Statut audit :** CLÔTURÉ — Domaine Top / Classements globaux après R727
- **But :** consulter les classements globaux publics ou son résumé personnel
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** écran `Classements`
- **Aide :** `!top`
- **Résumé personnel :** `!top me`
- **Classement :** `!top <métrique>`
- **Résultat chat :** Top 5 compact ; rang personnel ajouté s'il est classé hors du Top affiché
- **Éligibilité globale :** joueur existant avec élément choisi
- **Niveau minimum :** aucun
- **Confidentialité :** seules les données `Public` entrent dans les classements globaux
- **Amis uniquement / Privé :** joueur totalement absent, sans rang réservé
- **Valeur 0 :** exclue
- **Ex æquo :** classement compétition `1er, 1er, 3e`
- **Moras :** patrimoine `portefeuille + Banque`; les deux composantes nécessaires doivent être Public
- **Taux 5★ :** `totalFiveStars / totalPulls × 100`, minimum 100 Pulls ; `luck` accepté comme alias historique
- **Pity :** classement du pity 5★ actuel si Public
- **Soldes actuels conservés :** Primogemmes, patrimoine Moras, particules totales et par élément
- **Statistiques économiques cumulatives :** Primogemmes/Moras gagnées et dépensées
- **Collection :** Box, C6, copies depuis les possessions player-facing actives
- **Activité ajoutée :** Combat total, Combat manuel, Expeditions terminées, cœurs envoyés
- **Classements spécialisés :** Event, Boss, Concours et Giveaway restent dans leurs propres domaines
- **Historique/saisons :** aucun pour le Top global V1
- **Récompenses :** aucune ; classement honorifique
- **Architecture :** lecture seule depuis les sources métier canoniques

### Métriques / aliases

Principales métriques legacy conservées :

- `xp`
- `niveau` / `level` / `lvl`
- `messages` / `msg`
- `messages-xp` / `counted`
- `pulls`
- `luck` → Taux de 5★
- `5stars` / `5`
- `4stars` / `4`
- `pity`
- `5050` / `50/50`
- `lose5050` / `lost5050`
- `primos`
- `moras`
- `particles` / `particules`
- `pyro`
- `hydro`
- `cryo`
- `electro`
- `anemo`
- `geo`
- `dendro`
- `box`
- `c6`
- `copies`
- `primos-earned`
- `primos-spent`
- `moras-earned`
- `moras-spent`

Nouvelles métriques V1 :

- `combat`
- `combat-manuel`
- `expeditions`
- `coeurs`

L'aide player-facing peut n'afficher que les syntaxes canoniques principales afin de rester compacte.

## `!giveaway`

- **Statut audit :** CLÔTURÉ — Domaine Giveaway / Wish après R713
- **But :** administrer ou consulter le Giveaway Twitch courant
- **Canal joueur :** Twitch
- **UI équivalente :** petit panneau Admin standalone pour Open / Close / Reroll ; aucune participation joueur standalone
- **Consultation publique :** `!giveaway stats`
- **Ouvrir :** `!giveaway open` — Admin
- **Fermer :** `!giveaway close` — Admin
- **Reroll :** `!giveaway reroll` — Admin, uniquement après fermeture
- **Ouverture :** impossible si une session est déjà ouverte
- **Gagnant :** tiré aléatoirement parmi les participants `!wish` éligibles
- **Récompense gagnant :** +1 600 Primogemmes
- **Reroll :** le gagnant précédent conserve son gain ; le nouveau reçoit également +1 600
- **Classement chat :** messages Twitch normaux pendant la session
- **Exclusions compteur :** commandes `!xxx`, bot, système
- **Cooldown Giveaway :** aucun
- **Kichnifou :** ses vrais messages humains comptent normalement
- **Ex æquo :** classement compétition `1er, 1er, 3e`
- **Récompenses chat :** rang 1 +2 000 particules personnelles ; rang 2 +1 500 ; rang 3 +1 000 ; rang >=4 +500
- **Restitution Twitch :** deux messages séparés à la fermeture, chacun sur une seule ligne : tirage puis classement
- **Notifications :** informationnelles pour tous les joueurs récompensés
- **Historique :** aucun écran joueur dédié ; historique serveur/Admin uniquement
- **Atomicité :** fermeture, tirage, récompenses et rerolls idempotents

## `!wish`

- **Statut audit :** CLÔTURÉ — Domaine Giveaway / Wish après R713
- **But :** s'inscrire au tirage aléatoire du Giveaway Twitch ouvert
- **Disponible Twitch :** oui
- **Disponible chat GachaImpact :** non
- **UI joueur équivalente :** aucune
- **Précondition :** profil joueur existant avec élément choisi
- **Niveau minimum :** aucun
- **Limite :** une inscription maximum par joueur et par session
- **Classement messages :** `!wish` étant une commande, il ne compte pas dans `messageCounts`
- **Récompense au moment du `!wish` :** aucune
- **Résultat :** le gagnant éventuel est déterminé uniquement lors de la fermeture

## Gift Suprême — Custom Reward Twitch

- **Statut audit :** CLÔTURÉ — Domaine Gift Suprême après R701
- **Déclenchement cible :** redemption de la Custom Reward Twitch `Gift Suprême`
- **Legacy :** l'action/script `Gift.txt` pouvait être assimilé à `!gift`, mais aucune commande joueur `!gift` n'est canonique en V1
- **Coût Twitch :** 10 000 Points de chaîne
- **Saisie :** pseudo du bénéficiaire obligatoire
- **Matching cible :** exact / contains / fuzzy Levenshtein legacy
- **Bénéficiaire :** joueur GachaImpact existant avec élément choisi
- **Gifter :** peut être n'importe quel viewer Twitch, même non-joueur
- **Auto-ciblage :** autorisé
- **Récompense :** +1 600 particules de l'élément personnel du bénéficiaire
- **Twitch :** message public après succès
- **Standalone :** aucun déclenchement ni dépense de Points de chaîne ; notification informationnelle du Gift reçu
- **Custom Reward :** créée/gérée à terme par l'application GachaImpact et identifiée par `reward.id`
- **Succès :** redemption `FULFILLED`
- **Erreur cible :** redemption `CANCELED`, aucun gain, remboursement Twitch
- **Atomicité :** une redemption ID ne peut produire qu'un Gift
- **Historique :** journal serveur/admin des nouvelles redemptions uniquement ; aucun historique player-facing dédié

## `!code`

- **Statut audit :** CLÔTURÉ — Domaine Codes cadeaux après R691
- **But :** consulter et réclamer les Codes cadeaux actuellement disponibles
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **UI équivalente :** écran `Codes` avec zones `Disponibles` / `Récupérés`
- **Liste :** `!code`
- **Réclamation :** `!code <CODE>`
- **Matching :** token normalisé et insensible à la casse
- **Code ponctuel :** une seule réclamation par joueur
- **Code annuel :** une réclamation par joueur et par édition annuelle
- **Codes Event :** douze codes annuels conservés, +1 600 Primogemmes et +200 000 Moras
- **Récompenses Admin V1 :** Primogemmes, Moras et particules des sept éléments
- **UI :** récompenses visibles avant claim ; bouton `Récupérer`
- **Après claim :** code déplacé vers `Récupérés` et notification actionnable résolue
- **Nouveau joueur :** peut voir/réclamer tout code global encore actif
- **Twitch-only :** un profil interne existant peut utiliser Codes même sans élément choisi
- **Rappel Twitch :** premier message éligible peut signaler compactement qu'un nouveau code est disponible, sans spam
- **Event :** peut signaler la disponibilité et ouvrir Codes mais ne possède jamais le claim
- **Admin :** Brouillon → Publication ; programmation, désactivation et statistiques simples
- **Modification :** récompenses/token/type verrouillés après le premier claim
- **Atomicité :** claim + récompenses dans une seule opération serveur idempotente
- **Migration :** conserver les douze définitions Event et tous les `usedCodes` sans repayer les anciens claims

## `!event`

- **Statut audit :** CLÔTURÉ — Domaine Event / monthly après R644
- **But :** consulter et participer au Festival mensuel courant
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **UI équivalente :** écran Event avec onglets Activités / Boutique / Classement
- **Résumé :** `!event`
- **Inscription :** `!event go`
- **État personnel :** `!event sac`
- **Boutique :** `!event boutique`
- **Classement :** `!event top`
- **Primogemmes :** `!event primos <quantité|max>`
- **Moras :** `!event moras <quantité|max>`
- **Collection :** `!event collection`
- **Calendrier Noël :** `!event calendrier`
- **Jeu A :** `!event <commande thématique>`
- **Jeu B :** `!event <commande thématique> <code 5 bits>`
- **Jeu C :** `!event <commande thématique> <pseudo> "message"`
- **Avant inscription :** `!event`, `!event boutique` et `!event top` restent consultables
- **Mutations :** inscription obligatoire
- **Inscription :** +1 monnaie saisonnière, une seule fois par édition
- **Jeu A :** trois fenêtres personnelles quotidiennes ; 20 % par tentative ; cooldown serveur 3 s ; une réussite par jour
- **Jeu B :** 32 combinaisons ; trois essais consommables/joueur/jour ; combinaison déjà testée non consommée ; récompense communautaire +1 point/+1 monnaie
- **Jeu B déjà résolu :** nouvelle inscription le même jour reçoit le rattrapage +1 point/+1 monnaie
- **Découvreur Jeu B :** honorifique, aucun bonus économique supplémentaire
- **Jeu C :** un envoi réussi/jour ; cible existante soumise aux règles Social ; expéditeur +1 point/+1 monnaie
- **Messages Jeu C UI :** visibles uniquement par le destinataire dans son écran Event et uniquement pour la journée courante
- **Bonus quotidien :** +1 monnaie ; bouton Réclamer UI ; premier message normal éligible chat/Twitch peut effectuer la même réclamation
- **Paliers :** 10/20/30/40/50/60/70/80, récompenses automatiques
- **Boutique :** 1 monnaie = 160 Primogemmes ou 20 000 Moras
- **Collection :** 80 monnaies ; maximum une acquisition par édition annuelle ; anciennes monnaies saisonnières utilisables
- **Classement :** complet en temps réel dans l'UI ; `!event top` = Top 10 ; classement honorifique
- **Historique :** via écran transversal Historique → Event
- **Collection UI :** bouton Event → Sac → Collection
- **Noël :** calendrier 1–25 décembre ; aucun rattrapage ; jours 1–24 = 1–5 monnaies ; jour 25 = 50 ; aucun point
- **Commandes mensuelles :** conservent leurs noms thématiques ; l'aide du mois indique les syntaxes utiles
- **Code cadeau :** Event peut signaler qu'un code est disponible mais la consultation/réclamation appartient au Domaine Codes
- **Rollover :** 00:00 Europe/Paris au changement de mois ; nouvelle inscription requise ; monnaie saisonnière conservée
- **Atomicité :** gains, paliers, Jeu B, calendrier, boutique, Collection et rollover protégés contre concurrence/retry/double exécution
- **Migration :** état actif conservé uniquement lorsqu'il correspond au cutover ; monnaie du snapshot conservée comme solde saisonnier ; aucun historique ou gain absent inventé

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

## `!sac`
- **Statut audit :** Audité — Domaine Sac / Coffre / Shop clôturé après R298
- **But :** Consulter les ressources et objets spéciaux personnels.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** écran Sac
- **Profil ciblé :** propriétaire uniquement ; pas de `!sac <pseudo>`
- **Contenu :** Primogemmes, invocations possibles dérivées, Moras, sept particules, objets spéciaux persistants possédés
- **Particules :** élément principal affiché en premier
- **Stella :** visible comme objet spécial si possédée
- **Collection :** non incluse dans la ligne `!sac`; utiliser `!coffre`
- **Mutation :** aucune
- **Réponse Twitch :** une seule ligne
- **Donnée dérivée :** invocations possibles = `floor(primogems / 160)`

## `!coffre`
- **Statut audit :** Audité — Domaine Sac / Coffre / Shop clôturé après R298
- **But :** Consulter les objets de Collection possédés.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** Sac → Collection
- **Affichage texte :** objets possédés uniquement
- **Tri :** alphabétique
- **Quantité :** affichée
- **Mutation :** aucune
- **Obtention :** propriété du Domaine Event
- **ID inconnu :** possession conservée sous placeholder
- **Migration :** quantité préservée ; dates absentes → fallback cutover traçable
- **UI standalone :** montre aussi les objets non possédés et leur méthode d'obtention

## `!shop`
- **Statut audit :** Audité — Domaine Sac / Coffre / Shop clôturé après R298
- **But :** Consulter et acheter les articles de la Boutique.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **UI équivalente :** écran Boutique
- **Catalogue :** serveur dynamique
- **Ordre :** `displayOrder`
- **Pagination :** 5 articles par page lorsque nécessaire
- **Syntaxes principales :**
  - `!shop`
  - `!shop <page>`
  - `!shop primos <quantité>`
  - `!shop primos max`
  - `!shop ticket`
  - `!shop mission`
  - `!shop switch`
- **Primos :** 50 000 Moras → 160 Primogemmes par lot ; quantité multiple autorisée
- **Ticket :** 150 000 Moras legacy actuel ; achat/tirage immédiat ; unitaire ; probabilités visibles
- **Ticket pity :** +10 pity 5★ via moteur Gacha, plafond 90
- **Mission :** `!shop mission` partage l'action de l'écran Missions ; coût 10 000 Moras ; mission aléatoire inconnue avant achat ; récompense 800 Primogemmes ; progression à partir de l'attribution
- **Switch :** mission quotidienne incomplète uniquement ; 20 000 Moras puis coût doublé à chaque switch du même jour ; nouvelle mission obligatoirement différente ; progression remise à 0 ; indisponible s'il n'existe aucune alternative active ; aucune confirmation Twitch/chat
- **États article :** achetable / visible indisponible / masqué
- **Limites futures :** supportées par catalogue si nécessaire
- **Stock mondial V1 :** aucun
- **Historique :** journalisé à partir du standalone ; détaillé privé ; `Voir tout` via Historique global
- **Atomicité :** débit + effet + récompense + historique forment une opération atomique/idempotente
- **Banque :** jamais débitée automatiquement
- **Stats :** dépenses Moras réelles → `totalMorasSpent`; gains réels suivent leurs compteurs Earned
- **Réponses Twitch :** une seule ligne

## `!mission`

- **Statut audit :** Clôturé — R299 à R339
- **But :** Consulter la mission quotidienne et les progressions permanentes du joueur.
- **Syntaxes cible :**
  - `!mission`
  - `!mission B`
  - `!mission A`
  - `!mission S`
  - `!mission Z`
- **Alias de compatibilité accepté :** `!mission resume` peut agir comme `!mission`, mais n'est pas mis en avant dans les helpers
- **Bouton UI équivalent :** écran Missions avec Quotidienne / Permanentes puis sous-onglets B / A / S / Z
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Consultation d'un autre joueur :** non via commande ; la visibilité publique passe par le profil standalone
- **Activation :** aucune ; les missions permanentes progressent automatiquement dès le provisionnement du joueur
- **Abandon :** supprimé du fonctionnement cible
- **Progression :** B→A→S cumulative
- **Rang Z :** verrouillé jusqu'à complétion de toutes les B/A/S ; l'onglet Z peut être visible mais grisé ; avant déblocage, ne révéler ni intitulés, ni objectifs, ni récompenses
- **Évaluation Z :** à son déblocage, évaluer immédiatement les états/statistiques déjà acquis
- **Récompenses :** automatiques à la complétion
- **Visibilité V1 :** missions/progressions publiques depuis le profil joueur ; le secret du rang Z verrouillé reste absolu
- **Réponses chat/Twitch :** résumé compact ; une réussite est annoncée uniquement lorsqu'elle est la conséquence immédiate d'une action effectuée dans ce même canal
- **Longue réponse :** découper proprement en plusieurs messages d'une ligne si nécessaire plutôt que tronquer silencieusement
- **Twitch :** aucune notification asynchrone de réussite vers un joueur potentiellement absent
- **Interactions :** MissionService, Chat/XP, Gacha, Ressources, Expedition, Combat, Social
- **Décisions cible :** les anciennes syntaxes d'acceptation `!mission B 1` et d'abandon ne font plus partie du fonctionnement standalone

## `!faveur`

- **Statut audit :** CLÔTURÉ — Domaine Faveur / Subscription après R672
- **But :** Consulter l'état de la Faveur de l'Astre.
- **Syntaxes :** `!faveur` ; `!faveur <pseudo>`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **UI équivalente :** informations Faveur dans Profil et Quotidiennes ; aucun écran Faveur complet dédié
- **Acquisition :** uniquement via événements de subscription Twitch compatibles
- **Activation Twitch-only :** élément personnel choisi obligatoire ; aucun seuil de niveau supplémentaire
- **Standalone :** onboarding déjà terminé = élément déjà choisi
- **Durée :** +30 jours par attribution, maximum 180 jours
- **Daily :** +800 Primogemmes une fois par journée active si le joueur se manifeste
- **Temps :** les jours s'écoulent même si le joueur est absent
- **Tier 1 :** +1 600 Primogemmes immédiates
- **Tier 2 :** +4 800 Primogemmes immédiates
- **Tier 3 :** +9 600 Primogemmes immédiates
- **Overflow :** compensation supplémentaire `1600 × jours perdus / 30`
- **Gift :** la Faveur appartient au bénéficiaire ; gifter éligible = +1 600 par sub offert
- **Confidentialité :** `!faveur <pseudo>` respecte la visibilité du profil
- **Commande :** consultation uniquement ; `!faveur` ne constitue pas un claim économique séparé
- **Migration :** préserver les jours restants certains et le claim du jour sans reconstruire les anciens jours absents
- **Atomicité :** attribution, overflow, daily et bonus gifter protégés contre retry et doublons Twitch

## `!roue`

- **Statut audit :** CLÔTURÉ — Domaine Roue / quotidien après R656
- **But :** Effectuer la Roue quotidienne et recevoir immédiatement son résultat.
- **Syntaxe :** `!roue`
- **Bouton UI équivalent :** écran Roue dédié avec roue graphique et bouton `Tourner`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui lorsque l'intégration Twitch sera disponible
- **Préconditions :** profil joueur valide ; spin du jour encore disponible
- **Cooldown :** une utilisation maximum par journée `Europe/Paris`, tous canaux confondus
- **Distribution :** 2 % rien ; 70 % particules ; 20 % Moras ; 8 % Primogemmes
- **Particules :** 10 % par élément, +500 particules
- **Moras :** +50 000
- **Jackpot :** +1 600 Primogemmes
- **Résultat quotidien :** persisté et consultable jusqu'au reset ; une reconnexion ne reroll pas
- **Après utilisation :** `!roue` rappelle que la Roue est consommée et restitue le résultat du jour lorsqu'il est connu
- **UI :** probabilités consultables ; animation courte/skippable ; résultat, prochain reset, total spins et total jackpots visibles
- **Quotidiennes :** état `À faire` / `Fait aujourd'hui` ; gain du jour affichable après le spin
- **Statistiques :** `totalWheelSpins` +1 par spin valide ; `totalWheelJackpots` +1 uniquement sur jackpot Primogemmes
- **Ressources :** les mutations centrales maintiennent aussi `totalPrimosEarned`, `totalMorasEarned` et `totalMainElementParticlesEarned` lorsque pertinent
- **Atomicité :** spin, verrou quotidien, résultat, récompense et statistiques protégés contre double clic, concurrence inter-canaux et retry
- **Migration :** conserver `lastWheelDate`, `totalWheelSpins`, `totalWheelJackpots` ; ne pas inventer les anciens résultats détaillés

## `!quotis`

- **Statut audit :** Principe transverse validé R355 ; contenu enrichi progressivement avec les domaines quotidiens
- **But :** Afficher un résumé compact et dynamique des activités quotidiennes du joueur.
- **Syntaxe :** `!quotis`
- **Bouton UI équivalent :** écran transversal `Quotidiennes`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Coût :** aucun
- **Données lues :** vrais états quotidiens serveur
- **Données écrites :** aucune
- **Distinction :** `!quotis` n'est pas la mission quotidienne payante ; il est l'équivalent texte compact du hub `Quotidiennes`
- **Réponse :** état dynamique des activités pertinentes, avec présentation compacte
- **Architecture :** chaque activité reste propriétaire de sa logique ; l'écran Quotidiennes et `!quotis` ne font qu'agréger les états
- **Évolution :** le Combat quotidien possède désormais ses états À faire / En cours / Terminé / Bloqué ; Roue, Ami et Event continueront à préciser leurs états lors de leurs audits

## `!expedition`

- **Statut audit :** Clôturé — R340 à R369
- **But :** Lancer, consulter puis récupérer l'Expedition quotidienne.
- **Syntaxes :**
  - `!expedition`
  - `!expedition <personnage>`
  - `!expedition retour`
  - `!expedition <personnage envoyé>` peut également récupérer l'Expedition lorsqu'elle est prête
- **Bouton UI équivalent :** Box > fiche d'un personnage possédé ; accès également depuis le hub `Quotidiennes`
- **Hub Quotidiennes :** états `À faire` / `En cours` / `À récupérer` / `Fait aujourd'hui` ; un départ précédent peut bloquer l'action tout en laissant la quotidienne actuelle encore à faire ; bouton `Accéder` toujours disponible
- **Écran dédié :** aucun
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Durée :** 20 heures
- **Limite :** un nouveau départ par journée serveur, reset 00:00 Europe/Paris
- **Reset avec Expedition active :** l'Expedition continue normalement et bloque le nouveau départ jusqu'à récupération ; `readyAt` n'est jamais modifié par le reset
- **Personnage éligible :** tout personnage possédé et actif
- **Disponibilité du personnage :** reste utilisable dans Team/Combat/autres systèmes pendant l'Expedition
- **Récupération :** manuelle après `readyAt`
- **Récompenses V1 :** 10 % = 1 600 Primogemmes ; 30 % = 800 particules de l'élément personnel du joueur ; 60 % = 30 000 Moras
- **Tirage :** serveur, uniquement lors de la récupération
- **Statistique :** `totalExpeditionsCompleted +1` uniquement lors d'une récupération réussie
- **Missions :** la récupération réussie produit immédiatement l'événement de progression permanent Expedition
- **Box :** personnage en cours à sa place normale ; personnage prêt temporairement devant les favoris ; retour au tri normal après récupération
- **Badges Box :** `🧭 En expédition` / `✅ À récupérer`
- **Annulation volontaire :** non
- **Notification :** notification UI à `readyAt`, aucune notification Twitch asynchrone
- **Historique player-facing :** aucun en V1
- **Migration :** préserver une Expedition active valide et son `readyAt`; aucune récompense automatique au cutover

## `!combat`

- **Statut audit :** Clôturé — R370 à R450
- **But :** Consulter puis effectuer le Combat quotidien ; consulter et attaquer le Boss mensuel.
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Bouton UI équivalent :** écran Combat ; accès également depuis le hub `Quotidiennes`
- **Navigation UI :** `Combat quotidien` ouvert par défaut / `Boss mensuel`
- **Mémoires :** chaque mode possède quatre slots persistants indépendants des Teams et indépendants l'un de l'autre

### Syntaxes quotidiennes

- `!combat`
- `!combat info`
- `!combat go`
- `!combat auto`
- `!combat elements`
- `!combat help`

### Consultation quotidienne

- `!combat` affiche les quatre ennemis globaux du jour, l'état quotidien et les actions utiles
- `!combat info` évalue en lecture seule la Team active que `!combat go` utiliserait
- `!combat elements` affiche la matrice élémentaire
- **Reset :** 00:00 `Europe/Paris`
- **Équipe ennemie :** quatre personnages actifs distincts, identiques pour tous les joueurs pendant la journée

### `!combat go`

- valide la Team active
- exige exactement quatre personnages distincts, possédés, actifs et non-KO
- copie la Team active dans les slots persistants du Combat quotidien
- lance immédiatement une tentative `MANUAL`
- ne modifie jamais la Team active
- en cas d'échec de validation, ne modifie pas les slots et ne crée aucune tentative

### `!combat auto`

- sélectionne les quatre meilleurs personnages valides/non-KO
- utilise la même formule autoritative que le vrai Combat
- remplit et mémorise les slots Combat
- lance immédiatement la tentative côté chat/Twitch
- marque cette tentative `AUTO`
- ne modifie jamais la Team active
- une réutilisation ultérieure de la composition sans nouvel Auto devient `MANUAL`

### Règles quotidiennes

- **KO :** uniquement pour le Combat quotidien jusqu'au reset
- **Tentatives :** après défaite, retenter avec d'autres personnages jusqu'à victoire ou impossibilité d'en composer quatre
- **Victoire :** clôt le Combat quotidien du joueur
- **Récompense :** +800 Primogemmes et +20 000 Moras à la première victoire
- **Quotidiennes :** À faire / En cours / Terminé / Bloqué aujourd'hui
- **Formule V1 :** base 50 ; 4★ +3 ; 5★ +6 ; constellation 4★ +0,5/C ; constellation 5★ +1/C ; élément ±4 ; clamp 5–95 %
- **Résumé :** seule la chance finale est visible normalement
- **Détails UI :** base / rareté / constellations / éléments / brut / clamp / final
- **Missions B/A/S :** `totalCombatWins`
- **Mission Z :** 50 `totalManualCombatWins`

### Syntaxes Boss

- `!combat boss`
- `!combat boss go`

### `!combat boss`

Boss vivant :
- affiche nom, PV, résistance et disponibilité de l'attaque
- affiche les dégâts prévus de la Team active si elle est valide
- reste entièrement en lecture seule

Boss vaincu :
- affiche dans un seul message compact le bilan mensuel et la contribution du joueur
- utilise plusieurs messages uniquement si la limite du canal impose une coupure
- réserve le classement et l'historique détaillés à l'interface

### `!combat boss go`

- vérifie que le Boss est vivant et actuel
- vérifie que l'attaque quotidienne est disponible
- valide la Team active complète
- copie la Team active dans les slots Boss
- snapshotte les personnages et constellations
- attaque immédiatement
- ne modifie jamais la Team active
- un refus ne modifie pas les slots et ne consomme pas l'attaque

### Règles Boss

- **Cycle :** un Boss global par mois civil
- **Création :** premier du mois à 00:00 `Europe/Paris`
- **Respawn :** aucun avant le mois suivant
- **Noms :** rotation fixe de douze Boss liée aux mois calendaires
- **Base initiale :** 1 500 000 `baseHp`
- **Variation :** `maxHp` uniforme à ±15 %, arrondi aux 10 000 PV
- **Scaling victoire :** +75 000 `baseHp` par journée restante, hausse mensuelle max +1 500 000
- **Scaling échec :** retirer les PV restants, même sans attaque ; plancher 500 000
- **Attaque :** une par joueur/jour
- **Indépendance :** les KO du quotidien ne s'appliquent pas au Boss
- **Slots Boss :** quatre slots persistants indépendants ; première utilisation vide
- **Auto Boss :** aucun
- **Résistance :** élément mensuel ; personnage correspondant → dégâts ×0,5
- **Dégâts 4★ :** 500 +150 × constellation
- **Dégâts 5★ :** 1 000 +650 × constellation
- **Preview :** total uniquement par défaut ; détail individuel/résistance dans le panneau déroulant
- **Participation :** une attaque valide ayant infligé plus de zéro dégât
- **Récompense :** +16 000 Primogemmes et +500 000 Moras à chaque participant
- **Distribution :** automatique, offline, atomique et idempotente
- **Coup final :** honorifique/statistique, sans bonus économique
- **Classements :** publics
- **Historique :** player-facing avec fiches détaillées par mois
- **Quotidiennes :** sous-indicateur dans la carte Combat, jamais une carte séparée

### `!combat stat`

- **Syntaxe canonique :** `!combat stat`
- **Alias accepté :** `!combat stats`
- **Réponse normale :** un seul message compact
- **Coupure :** uniquement si la limite technique du canal l'impose
- **Contenu :** combats, victoires, victoires manuelles, défaites, dégâts/attaques Boss, participations, Boss vaincus, coups finaux, meilleur coup et résumé global public

### Alias

- `help` / `aide`
- `info` / `infos`
- `stat` / `stats`
- `element` / `elements`
- `faiblesse` / `faiblesses`

Les aides ne recommandent qu'une seule syntaxe canonique.

## `!ami`

- **Statut audit :** CLÔTURÉ — R451 à R525
- **Canaux :** UI standalone, chat interne et Twitch partagent le même service métier
- **Résumé :** `!ami`
- **Liste :** `!ami liste [page]`
- **Demandes :** `!ami demandes [page]`
- **Ajouter :** `!ami ajouter <pseudo>`
- **Accepter :** `!ami accepter <pseudo>`
- **Refuser :** `!ami refuser <pseudo>`
- **Annuler :** `!ami annuler <pseudo>`
- **Retirer :** `!ami retirer <pseudo>`
- **Consulter :** `!ami voir <pseudo>`
- **Alias de consultation :** `!ami <pseudo>`
- **Cœur individuel :** `!ami coeur <pseudo>`
- **Cœur global :** `!ami coeur all`
- **Demandes :** persistantes, paire unique par IDs, transitions explicites et idempotentes
- **Relation :** retrait archivé ; progression restaurée au réajout
- **Cœur :** un par relation, sens et journée Europe/Paris
- **Récompense :** +5 Primogemmes aux deux joueurs
- **Niveau :** partagé, plafonné à 1000 ; total historique non plafonné
- **Résultat individuel :** phrase legacy + niveau/palier + récompense
- **Résultat global :** envoyés/déjà faits/gains, sans liste de pseudos
- **Notifications :** aucune notification dédiée au cœur
- **Missions :** B/A/S comptent les cœurs sortants validés ; Z à la première relation niveau 1000
- **Concurrence :** transaction/idempotence communes à UI, chat interne et Twitch

## `!infos`

- **Statut audit :** CLÔTURÉ — R471/R489/R490/R525
- **Syntaxe canonique :** `!infos <pseudo>`
- **Alias accepté :** `!info <pseudo>`
- **Cible personnelle :** `me` et `moi` acceptés
- **Aide :** présente uniquement `!infos`
- **Chat interne/Twitch :** une seule réponse compacte
- **Contenu :** pseudo, niveau, élément, nombre de personnages, Team active remplie, total Pulls, victoires Combat et amitié avec le demandeur
- **Confidentialité :** champ privé omis ; aucune fausse valeur zéro
- **Pity/garantie :** consultables dans l'UI selon confidentialité, pas dans le résumé chat
- **Sections supprimées :** `team`, `box`, `sac`, `pity`, `stats`, `mission`
- **UI standalone :** Profil détaillé en lecture seule selon permissions
- **Titre :** jamais affiché dans les chats

## `!liste`

- **Statut audit :** CLÔTURÉ — R462/R464/R472/R523/R524
- **Élément :** `!liste <élément> [page]`
- **Ordre élément :** alphabétique, sans statut de présence
- **Présence :** `!liste online [page]`
- **Ordre online :** En ligne alphabétiques puis Absents alphabétiques
- **Marqueurs :** 🟢 En ligne ; 🟡 Absent
- **Pagination :** vingt joueurs par page
- **Confidentialité :** présence privée/non autorisée totalement absente de `online`
- **Hors ligne :** jamais inclus dans `online`
- **UI standalone :** recherche, filtres et listes détaillées dans Social