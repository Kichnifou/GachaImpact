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

La finalité opérationnelle principale de cette documentation est de préparer une base suffisamment précise, cohérente et non contradictoire pour que Codex puisse ensuite implémenter GachaImpact progressivement, par lots bornés, sans devoir redécider ou deviner les règles métier à partir du legacy.

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

- `master/` : source centrale de navigation, état global, domaine actif et prochaine étape exacte.
- `legacy/` : inventaire, compréhension de l'ancien jeu et audits spécialisés par domaine.
- `specifications/` : décisions validées et durables pour le nouveau GachaImpact.
- `architecture/` : choix du socle backend, schéma PostgreSQL physique, sécurité, infrastructure et préparation technique de l'implémentation.
- `commands/` : contrats des commandes et future aide intégrée.
- `notion/` : documentations externes prêtes à être publiées dans Notion, notamment les guides Twitch joueur et technique.
- `roadmap/` : trajectoire macro de développement, sans dupliquer l'état courant du Master.

Les sources brutes de l'ancien jeu restent hors de `docs/`, principalement dans `legacy/streamerbot/`.

Le code actuel de la V0 se trouve principalement dans `src/`.

## Parcours de lecture recommandé

### Nouvelle conversation ChatGPT

Commencer par :

`.chatgpt/CHATGPT_GUIDE.md`

Ce Guide indique ensuite la procédure de reprise complète et les documents à lire selon l'état courant.

Il ne faut donc pas essayer de charger toute la documentation dans chaque nouvelle conversation.

### Audit d'un domaine

Ordre général :

1. Master ;
2. audit spécialisé du domaine ;
3. vrais scripts / JSON legacy concernés ;
4. modèle joueur ou matrice commandes/données lorsque nécessaire ;
5. decisions-log pour les décisions transverses ;
6. command-reference lorsqu'une commande est concernée.

### Développement avec Codex

Ordre général :

1. `AGENTS.md` ;
2. Master ;
3. audit(s) spécialisé(s) du lot demandé ;
4. décisions transverses nécessaires ;
5. command-reference si nécessaire ;
6. code réel déjà présent dans le repository.

Codex ne doit pas être obligé de lire tous les audits pour implémenter un seul domaine. Le lot préparé doit lui indiquer les sources pertinentes.

## Convention de statut

Chaque point peut être marqué :
- `VALIDÉ`
- `À CONFIRMER`
- `À AUDITER DANS SCRIPT`
- `LEGACY / OBSOLÈTE À VÉRIFIER`
- `FUTUR`
