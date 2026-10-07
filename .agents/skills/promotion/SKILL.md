---
name: promotion
description: Contrôler et promouvoir un candidat GachaImpact de review vers main par fast-forward strict, selon le périmètre autorisé et le workflow propriétaire.
---

# Promotion

Lire `../../../docs/process/implementation-workflow.md` et le Master. La méthode propriétaire du 07/10/2026 autorise la promotion dans la même mission pour un changement borné, testé, sans blocker et utilisant les mécanismes déjà validés, après contrôle du vrai diff GitHub. Un nouveau mécanisme sensible non prévu exige une review indépendante approuvée avant promotion ; une mission plus restrictive conserve ses gates. Faire `fetch`, vérifier refs exactes, divergence, ancestry, chaîne de commits, index et worktree ; réconcilier tout écart inattendu avant écriture.

Finaliser les documents dans leur état post-promotion sur `review`, publier ce commit séparé si nécessaire, puis contrôler de nouveau les gates. Avancer `main` uniquement par `git merge --ff-only review` et push normal ; jamais rebase, squash ni force-push. Vérifier SHA distant commun et divergence `0/0`. Ne pas revendiquer Cloudflare, Railway, health ou validation publique sans leurs contrôles dédiés.
