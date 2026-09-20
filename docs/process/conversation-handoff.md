# Passation entre conversations ChatGPT

Ce document décrit la fermeture contrôlée d'une conversation ChatGPT et le bootstrap de la suivante. Il ne porte ni l'état vivant du projet, ni un batch, ni une migration, ni une prochaine étape : ces informations restent exclusivement dans le [Master](../master/PROJECT_MASTER_PLAN.md).

Il complète le [Guide opératoire ChatGPT](../../.chatgpt/CHATGPT_GUIDE.md), qui définit le comportement de ChatGPT, et le [workflow d'implémentation](implementation-workflow.md), qui décrit le cycle d'un lot.

## Fermer une conversation proprement

### 1. Décider explicitement la passation

Ne pas abandonner une conversation devenue longue. Avant de la quitter, décider d'un checkpoint documentaire afin que la suite ne dépende pas de sa mémoire implicite.

### 2. Consolider l'état réel

Recenser ce qui est développé et corrigé, les commits reviewés, l'état de `main` et `review`, les déploiements, les validations publiques réellement effectuées, les défauts ouverts, les prochaines fonctionnalités décidées et les reports explicites.

Toujours distinguer : implémenté, testé automatiquement, reviewé, présent sur `main`, déployé, validé publiquement et simplement prévu. Une information non vérifiée ne devient pas un fait dans le checkpoint.

### 3. Vérifier les documents propriétaires

Relire au minimum le Master et évaluer les documents spécialisés concernés. Avant la passation, le Master doit exposer l'état public réel, le domaine terminé ou en cours, les défauts ouverts, la prochaine étape exacte, la dernière migration pertinente et les contraintes nécessaires à la reprise.

Ne pas créer de second tracker vivant. Les documents spécialisés décrivent leur domaine ; le Master reste le seul pointeur global.

### 4. Publier et reviewer le checkpoint documentaire

Les modifications suivent le workflow normal : travail sur `review`, commit propre, push normal sur `review`, puis worktree propre. ChatGPT vérifie ensuite le vrai commit GitHub : SHA, parent, diff, fichiers, cohérence du Master et références `main`/`review`. Le rapport local de Codex ne remplace pas cette review indépendante.

Après approbation explicite, promouvoir le checkpoint par fast-forward strict de `review` vers `main`. Ne pas rebase, squash, créer de merge commit inutile ni force-push. Vérifier ensuite que `main == review`, que la divergence est nulle et que le worktree est propre.

### 5. Préparer le bootstrap seulement après la promotion

Le prompt de la nouvelle conversation est finalisé seulement après la promotion documentaire. Il utilise alors le SHA de `main` réellement vérifié, jamais une référence provisoire.

## Contrat du prompt de bootstrap

Le prompt de bootstrap reste court et renvoie au repository ; il ne recopie pas l'état courant du jeu. Il demande à la nouvelle conversation de :

1. lire `AGENTS.md`, le [Guide opératoire ChatGPT](../../.chatgpt/CHATGPT_GUIDE.md), le [Master](../master/PROJECT_MASTER_PLAN.md), le [workflow d'implémentation](implementation-workflow.md), ce document et l'[ordre d'implémentation V1](../roadmap/implementation-order-v1.md) ;
2. lire les documents spécialisés indiqués par le Master pour le domaine actif ;
3. vérifier le vrai GitHub : `main`, `review`, leur divergence et les derniers commits pertinents ;
4. vérifier les preuves infrastructure ou DB seulement lorsque le Master indique qu'elles sont nécessaires pour comprendre l'état ;
5. comparer GitHub au Master et signaler toute incohérence avant de développer ;
6. reformuler une reprise comprenant au minimum les SHA `main`/`review`, leur divergence, la dernière migration, le dernier lot terminé, le niveau de validation publique, les défauts ouverts, la prochaine étape et les hors-scope explicites ;
7. ne rien modifier pendant cette première reprise, puis attendre la confirmation du propriétaire avant de préparer un nouveau prompt Codex.

Le prompt rappelle aussi, par renvoi au Guide, de répondre en français avec un style direct, naturel et concret ; de ne pas traiter le propriétaire comme un débutant ; de préparer des prompts Codex complets et copiables ; de reviewer le vrai GitHub après Codex ; de signaler les problèmes réels ; de réutiliser les patterns UI existants ; et de ne générer une image que sur demande explicite.

## Indépendance de la nouvelle conversation

La nouvelle conversation ne doit jamais avoir besoin de la mémoire de l'ancienne pour comprendre le projet. Les informations nécessaires vivent dans le repository ou sont explicitement fournies par le bootstrap. Les souvenirs de conversation peuvent aider, mais ne sont jamais une source de vérité.

Le développement ne reprend qu'après cette vérification de contexte, la reformulation de reprise et la confirmation du propriétaire.
