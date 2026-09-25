---
name: database-change
description: Préparer et vérifier tout changement Prisma/PostgreSQL GachaImpact, avec suivi des migrations et tests DEV partagée sans reset.
---

# Changement de base

Lire `../../../docs/process/implementation-workflow.md`, `../../../docs/architecture/backend-architecture-v1.md` et le propriétaire métier. Vérifier le schéma Prisma et préparer une migration additive sans reset ni écriture manuelle de `_prisma_migrations`.

Confronter les dossiers `server/prisma/migrations` au registre Prisma, puis exécuter explicitement `prisma migrate deploy`/`prisma migrate status` selon la mission. Les tests PostgreSQL DEV partagée se lancent fichier par fichier : fixtures bornées aux UUID exacts, nettoyage suivi, aucune fixture globale visible par un autre domaine. Déclarer toute écriture DB, même nettoyée, et distinguer migration présente, appliquée et testée.
