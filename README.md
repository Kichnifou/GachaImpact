# GachaImpact

GachaImpact est la reconstruction standalone d'un jeu communautaire Twitch / Streamer.bot inspiré de Genshin Impact. **Le développement de sa V1 est terminé et validé.** Sa sortie officielle est décidée pour le **soir du 16 octobre 2026** par le propriétaire ; l'annonce et l'ouverture publiques sont distinctes de ce checkpoint documentaire. Site officiel : **[gachaimpact.fr](https://gachaimpact.fr)**.

Le repository contient :

- le frontend React / TypeScript / Vite dans `src/` ;
- le backend autoritaire Node.js / TypeScript / Fastify dans `server/` ;
- le schéma physique et les migrations PostgreSQL gérés avec Prisma, sur Supabase ;
- les sources legacy Streamer.bot et JSON ;
- les audits métier clôturés servant de spécifications fonctionnelles ;
- la documentation utilisée comme mémoire externe pour ChatGPT et comme contrat d'implémentation pour Codex.

Le frontend est déployé sur Cloudflare Pages et le backend sur Railway. Les données sensibles et mutations métier restent validées côté serveur. Le projet suit une approche Free-first ; Railway Hobby est approuvé et confirmé payé par le propriétaire. Les autorisations payantes sont limitées à leur fournisseur/service dans le Master ; toute nouvelle dépense exige un accord explicite.

## Démarrage documentaire

Pour reprendre avec ChatGPT, lire le [Guide opératoire ChatGPT](.chatgpt/CHATGPT_GUIDE.md). Pour développer avec Codex ou un autre agent, commencer par [AGENTS.md](AGENTS.md), puis le [Master](docs/master/PROJECT_MASTER_PLAN.md) et le [workflow d'implémentation](docs/process/implementation-workflow.md). Le Master porte seul l'état courant, le domaine actif et la prochaine étape ; les audits et spécifications portent les règles du domaine.

La [carte documentaire](docs/README.md) aide à trouver les sources spécialisées sans lire tout le repository.

## Développement local

Depuis la racine du dépôt, installer les dépendances du frontend avec `npm install`, puis utiliser `npm run dev`, `npm test`, `npm run lint` et `npm run build` selon le besoin. Depuis `server/`, installer séparément les dépendances avec `npm install` ; `npm run dev`, `npm test`, `npm run typecheck` et `npm run build` sont les commandes backend correspondantes. Les tests DB (`npm run test:db` depuis `server/`) utilisent une base réelle : ne les lancer que dans un lot autorisant explicitement ses fixtures et son cleanup.

Les variables d'environnement locales et les secrets ne sont pas versionnés. Aucun seed, migration ou accès à la base n'est implicite dans ces commandes frontend.

## Déploiement et environnements

`main` est la branche publique auto-déployée : Cloudflare Pages pour le frontend et Railway pour le backend. `review` sert à la review GitHub du candidat ; ce n'est pas un staging. Le [workflow](docs/process/implementation-workflow.md) distingue tests locaux, review, promotion, déploiements et validation publique ; le [guide Free-first](docs/deployment/free-first-v1.md) décrit les environnements.

## Legacy et documentation

Les scripts et données de l'ancien jeu sont conservés principalement dans :

`legacy/streamerbot/`

Ils servent de sources d'audit et de migration, mais ne constituent pas directement l'architecture cible.

Les [audits métier](docs/legacy/) documentent les règles retenues à partir de ces sources ; le [journal des décisions](docs/specifications/decisions-log.md) conserve les arbitrages durables. Ni les mocks V0 ni les sources legacy ne remplacent une spécification V1 validée.

## V0 et V1

- **V0** : prototype d'interface historique, conservé comme référence de conception ; il ne reflète pas nécessairement les règles réelles du jeu.
- **V1** : jeu standalone fonctionnel avec backend autoritaire, PostgreSQL, Twitch GLOBAL et interfaces joueur ; développement et stabilisation techniquement clôturés (R1101). Publication officielle décidée pour le 16/10/2026 au soir.

Ne jamais déduire une règle métier V1 uniquement depuis les mocks ou l'interface V0.
