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
- **Statut audit :** Audit Gacha en cours — R54 à R65 validées
- **But :** Afficher la bannière active et la cible 5★ personnelle lorsqu'elle est valide.
- **Syntaxe :** `!banniere`
- **Bouton UI équivalent :** écran Invocation complet
- **Disponible chat GachaImpact :** oui, sous forme compacte
- **Disponible Twitch :** oui
- **Préconditions :** bannière active
- **Coûts :** aucun
- **Données lues :** catalogue personnages, bannière active, cible personnelle
- **Données écrites :** aucune
- **Décisions cible :** bannière hebdomadaire 4×5★ + 6×4★ ; UI beaucoup plus riche que la réponse Twitch

## `!select`
- **Statut audit :** Audit Gacha en cours — R59 validée
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
- **Statut audit :** Audit Gacha en cours — R57/R58 validées
- **But :** Influencer le quatrième personnage 5★ de la bannière suivante.
- **Syntaxes :** `!vote`, `!vote <nom>`
- **Bouton UI équivalent :** future zone de vote communautaire
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** personnage 5★ valide ; pas déjà en bannière ; joueur n'ayant pas encore voté cette semaine
- **Coûts :** aucun
- **Données lues/écrites legacy :** `banner_votes.json`, catalogue personnages
- **Décisions cible :** un vote définitif par semaine ; résultat pondéré par nombre de votes ; reset lors de la rotation

## `!pity`
- **Statut audit :** Audit Gacha en cours — R61 à R64 validées
- **But :** Afficher pity 5★, pity 4★, garantie et Capture de brillance.
- **Syntaxe :** `!pity`
- **Bouton UI équivalent :** informations intégrées directement dans l'écran Invocation/sidebar
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Coûts :** aucun
- **Données lues :** pity 5★/4★, garantie, compteur de pertes/Capture
- **Données écrites :** aucune
- **Décisions cible :** progression conservée entre rotations et changements de cible

## `!pull`
- **Statut audit :** Audit Gacha en cours — R60 à R65 validées ; 50/50/Capture encore à terminer
- **But :** Exécuter une ou plusieurs invocations.
- **Syntaxes :** `!pull`, `!pull <1..10>`
- **Bouton UI équivalent :** `Invocation x1` / `Invocation x10`
- **Disponible chat GachaImpact :** oui
- **Disponible Twitch :** oui
- **Préconditions :** profil valide ; cible 5★ active ; Primogemmes suffisantes
- **Coût :** 160 Primogemmes par Pull
- **Maximum :** 10 pulls par action
- **Données principales :** Primogemmes, pity, garantie, statistiques, box, personnages de bannière, passifs
- **Pity 5★ :** 0,6 % jusqu'à 73 ; soft pity dès 74 ; garantie 90
- **Pity 4★ :** 1,5 % jusqu'à 8 ; 19,5 % au 9e ; garantie 10
- **Priorité :** 5★ prioritaire si 5★ et 4★ réussissent ensemble ; pity 4★ conservée
- **Récompense secondaire :** 50 % Moras 5k–15k / 50 % particules 20–80 d'un élément aléatoire
- **UI :** résultat calculé/persisté côté serveur avant animation ; révélation progressive et skip
- **Twitch :** résultat textuel rapide, résultat par résultat
- **Interactions encore à auditer :** 50/50, garantie, Capture, passifs, doublons/C6