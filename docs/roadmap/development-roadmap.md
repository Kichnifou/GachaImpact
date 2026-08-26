# Roadmap de préparation GachaImpact

## Phase actuelle — documentation avant backend

### Étape 0 — Coque visuelle
Statut : presque finalisée.

### Étape 1A — Inventaire de toutes les sources JSON
Statut : EN COURS.
- Data.zip reçu.
- 17 fichiers JSON recensés, dont un vide.
- Première classification réalisée.

### Étape 1B — Profil canonique Kichnifou
Statut : À FAIRE.
- Cartographier `viewers_data.json`.
- Agréger les données Kichnifou présentes dans les autres JSON.

### Étape 1C — Classification des données
Statut : À FAIRE.
Pour chaque donnée :
- MIGRER TEL QUEL
- NORMALISER
- CALCULABLE / DÉRIVABLE
- À CONFIRMER AVEC SCRIPT
- LEGACY / OBSOLÈTE À VÉRIFIER

### Étape 1D — Validation utilisateur
Statut : À FAIRE.
Questions uniquement sur les champs ambigus et décisions de structure.

### Étape 1E — Document du modèle legacy actuel
Statut : À FAIRE.
Produit attendu : `legacy/02-current-player-model.md`.

## Étape 2 — Audit des scripts
Statut : FUTUR.
Audit système par système, sans traduction aveugle Streamer.bot → nouveau code.

Ordre initial pressenti :
1. XP / cycle de vie joueur
2. Bannière / Select / Pull / Pity / Vote
3. Box / personnages
4. Équipe
5. Sac / ressources
6. autres systèmes selon dépendances

## Étape 3 — Modèle de données cible
Statut : FUTUR.
Produit attendu : schéma cible validé avant choix/implémentation complète du backend.

## Étape 4 — Backend + authentification + base
Statut : FUTUR.

## Étape 5 — Migration pilote Kichnifou
Statut : FUTUR.
Créer un compte GachaImpact, lier Twitch, importer les données legacy et afficher les vraies données dans l'UI.

## Étape 6 — Fonctionnalités réelles progressivement
Statut : FUTUR.
Ressources, Box, Équipe, Invocation, etc.

## Étape 7 — Social
Statut : FUTUR.
Chat global, présence, puis fonctionnalités sociales.

## Étape 8 — Pont Twitch
Statut : FUTUR.
Même logique métier appelée depuis le chat Twitch, sans Streamer.bot.
