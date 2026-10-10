---
name: promotion
description: Contrôler et promouvoir un candidat GachaImpact de review vers main par fast-forward strict, selon le périmètre autorisé et le workflow propriétaire.
---

# Promotion

Lire `../../../docs/process/implementation-workflow.md` et le Master. La décision propriétaire du 10/10/2026 impose par défaut le cycle complet review → main → déploiements → postflight dans la même mission autorisée, sans nouveau GO entre gates réussies. Une exception explicite et motivée ou un vrai blocker peut suspendre la suite. Tout mécanisme sensible exige une review indépendante approuvée du vrai SHA publié avant promotion, puis correction/re-review des findings. Aucun lot, changement économique, migration de joueurs ou dépense hors mandat. Faire `fetch`, vérifier refs exactes, divergence, ancestry, chaîne de commits, index et worktree ; réconcilier tout écart inattendu avant écriture.

Finaliser les documents dans leur état post-promotion sur `review`, publier ce commit séparé si nécessaire, puis contrôler de nouveau les gates. Avancer `main` uniquement par `git merge --ff-only review` et push normal ; jamais rebase, squash ni force-push. Vérifier SHA distant commun et divergence `0/0`. Ne pas revendiquer Cloudflare, Railway, health ou validation publique sans leurs contrôles dédiés.
