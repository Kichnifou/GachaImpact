---
name: promotion
description: Contrôler et promouvoir explicitement un candidat GachaImpact de review vers main par fast-forward strict, après approbation indépendante.
---

# Promotion

Lire `../../../docs/process/implementation-workflow.md` et le Master. Ne commencer que sur mission de promotion explicite et review indépendante approuvée. Faire `fetch`, vérifier refs exactes, divergence, ancestry, chaîne de commits, index et worktree ; réconcilier tout écart inattendu avant écriture.

Finaliser les documents dans leur état post-promotion sur `review`, publier ce commit séparé si nécessaire, puis contrôler de nouveau les gates. Avancer `main` uniquement par `git merge --ff-only review` et push normal ; jamais rebase, squash ni force-push. Vérifier SHA distant commun et divergence `0/0`. Ne pas revendiquer Cloudflare, Railway, health ou validation publique sans leurs contrôles dédiés.
