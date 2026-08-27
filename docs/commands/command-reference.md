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

- **Statut audit :** Audit en cours — R5 à R9 validées
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
- **Préconditions :** profils existants ; éléments choisis ; joueurs différents ; éléments différents ; stocks disponibles suffisants ; aucune demande active entre la paire
- **Coûts :** X particules de l'élément de l'autre joueur contre X particules de son propre élément
- **Cooldown :** aucun observé
- **Données lues :** `element`, `particles`, `tradeRequests`
- **Données écrites :** `particles`, `tradeRequests`
- **Réponses utilisateur :** création, liste, acceptation, annulation, erreurs de stock
- **Erreurs / edge cases :** auto-échange ; même élément ; montant invalide ; joueur absent ; élément manquant ; stock insuffisant ; demande déjà existante ; demande devenue invalide avant acceptation
- **Interactions :** réservation de stock ; expiration quotidienne actuellement nettoyée depuis `XP.txt`
- **Décisions de migration :** troc X contre X conservé ; stock réservé ; une demande par paire ; expiration serveur à 00:00 Europe/Paris ; écran UI reçues/envoyées ; notification agrégée des demandes reçues
