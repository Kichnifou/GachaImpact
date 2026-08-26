# GachaImpact — Documentation de référence

Version documentaire : 0.1  
Statut : EN CONSTRUCTION

## But

Ce dossier devient la **source de vérité documentaire** de GachaImpact.

Il doit permettre :
- à Axel de conserver toutes les décisions du projet hors de la mémoire d'une conversation ;
- à ChatGPT de reprendre rapidement le contexte après relecture ;
- à Codex de développer à partir de spécifications validées plutôt que d'interpréter les anciens scripts ;
- de documenter progressivement la migration depuis Streamer.bot ;
- de constituer plus tard l'aide intégrée du jeu, notamment la liste des commandes.

## Règle de travail

1. Les JSON et scripts Streamer.bot sont des **sources legacy**.
2. Les commentaires en tête des scripts sont seulement des résumés : **le code réel doit toujours être inspecté**.
3. Le profil `Kichnifou` sert de **profil canonique de référence pour le modèle joueur actuel**, car il contient les systèmes les plus récents et les plus complets.
4. Les autres profils servent à identifier les anciennes structures, valeurs absentes, migrations partielles et cas limites.
5. Une donnée ou mécanique n'est jamais supprimée de la migration sans validation explicite.
6. Toutes les statistiques et dates historiques doivent être conservées.
7. La migration finale doit être **réexécutable / idempotente** : un JSON Streamer.bot plus récent doit pouvoir mettre à jour la base sans dupliquer ni écraser les données natives du nouveau jeu de manière incorrecte.
8. Les fonctions du nouveau jeu doivent être centralisées et réutilisables : plusieurs interfaces (bouton, chat GachaImpact, Twitch) doivent appeler la même logique serveur.

## Structure

- `legacy/` : inventaire et compréhension de l'ancien jeu.
- `specifications/` : décisions validées pour le nouveau GachaImpact.
- `commands/` : registre des commandes et future aide intégrée.
- `roadmap/` : ordre de développement et état d'avancement.

## Convention de statut

Chaque point peut être marqué :
- `VALIDÉ`
- `À CONFIRMER`
- `À AUDITER DANS SCRIPT`
- `LEGACY / OBSOLÈTE À VÉRIFIER`
- `FUTUR`
