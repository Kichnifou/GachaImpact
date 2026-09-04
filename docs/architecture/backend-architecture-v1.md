# GachaImpact — Architecture backend V1

> Statut : **DÉCISION TECHNIQUE — Phase C / socle backend retenu**
>
> Date de décision : **2026-09-04**
>
> Baseline repository : `main` au commit `6ed204c63c557478889d348e03c9d1199f50ff8a`
>
> Ce document complète `docs/specifications/v1-data-model.md`. Il ne remplace aucune décision métier des audits.

---

# 1. Objectif

La Phase B a défini **ce que les données signifient**.

La Phase C définit maintenant **comment les stocker, les sécuriser, les exposer et les faire évoluer**.

Le socle doit :

- rester simple pour les ~10 joueurs actuels ;
- fonctionner 24 h/24 indépendamment de Twitch ;
- pouvoir accueillir raisonnablement 50 à 100 joueurs sans refonte ;
- pouvoir évoluer davantage si GachaImpact prend de l'ampleur ;
- garder toute logique sensible côté serveur ;
- être exploitable facilement par Codex et autres agents ;
- éviter les services payants inutiles ;
- ne pas créer une architecture jetable avant le futur jeu original ;
- minimiser le verrouillage fournisseur ;
- préserver la possibilité de migrer vers une autre infrastructure plus tard.

---

# 2. Décision d'architecture retenue

## 2.1 Base de données

**PostgreSQL managé par Supabase.**

Supabase est retenu principalement pour :

- PostgreSQL standard ;
- Auth intégré ;
- Realtime adapté au chat, à la présence et aux notifications ;
- stockage éventuel ;
- outillage et dashboard accessibles ;
- free tier suffisant pour le développement ;
- offre Pro raisonnable lorsque les données joueurs deviennent importantes ;
- possibilité de migrer la base PostgreSQL ou même d'auto-héberger Supabase plus tard.

La base PostgreSQL reste la vraie fondation.

GachaImpact ne doit pas dépendre de structures propriétaires Supabase pour sa logique métier centrale.

---

## 2.2 Authentification

**Supabase Auth.**

Principe :

- Supabase Auth représente l'identité d'authentification web ;
- `Player` reste l'identité métier GachaImpact ;
- `WebIdentity` fait la liaison entre les deux ;
- `TwitchIdentity` reste séparée ;
- le backend résout toujours l'identité métier avant toute mutation de gameplay.

Les services métier ne doivent jamais dépendre directement de l'adresse e-mail ou d'un identifiant Twitch.

L'authentification est isolée derrière un petit adaptateur afin de pouvoir changer de fournisseur plus tard sans réécrire les domaines de jeu.

---

## 2.3 Backend applicatif

**Node.js + TypeScript + Fastify.**

Raisons :

- même langage que le frontend ;
- environnement Node déjà cohérent avec le projet ;
- faible surcharge ;
- très adapté à une API JSON ;
- WebSocket et plugins disponibles si nécessaire ;
- simple à tester ;
- simple à conteneuriser ;
- facile à lire et modifier par Codex ;
- pas besoin du poids architectural de NestJS pour GachaImpact.

Le backend doit rester un **monolithe modulaire**.

Pas de microservices en V1.

---

## 2.4 Accès PostgreSQL

**Prisma ORM 8 avec PostgreSQL**, en gardant les contraintes importantes dans les migrations SQL.

Prisma est retenu pour :

- typage TypeScript ;
- migrations ;
- lecture simple du modèle ;
- outillage mature ;
- très bonne documentation ;
- bonne compatibilité avec Node.js 24 et PostgreSQL ;
- facilité d'utilisation par des agents de développement.

Règle importante :

**Prisma n'est pas autorisé à affaiblir le modèle PostgreSQL.**

Lorsque PostgreSQL offre une contrainte utile que Prisma ne représente pas parfaitement, la migration SQL reste autoritative.

Exemples :

- index partiels ;
- contraintes CHECK ;
- contraintes d'unicité spécialisées ;
- politiques RLS nécessaires au Realtime ;
- extensions PostgreSQL.

Ne pas utiliser `db push` comme mécanisme de production.

Les changements de schéma passent par des migrations versionnées dans Git.

---

## 2.5 Hébergement du backend

**Railway.**

Cible initiale :

- développement : backend local ;
- tests hébergés ponctuels : Free/Trial si suffisant ;
- première version réellement disponible 24 h/24 : Railway Hobby ;
- montée vers Pro uniquement lorsque les métriques le justifient.

Le backend doit disposer d'un `Dockerfile` standard.

Ainsi, le même service pourra être déplacé plus tard vers :

- Render ;
- Fly.io ;
- AWS ;
- Google Cloud ;
- Azure ;
- VPS ;
- autre plateforme Docker.

Railway est donc un hébergeur choisi pour sa simplicité, pas une dépendance métier.

---

## 2.6 Frontend

**React / TypeScript / Vite existant conservé.**

Hébergement recommandé :

**Cloudflare Pages** pour le frontend statique.

Raisons :

- coût nul pour les assets statiques dans la cible actuelle ;
- très bonne distribution mondiale ;
- HTTPS et domaine personnalisé ;
- aucun besoin de serveur Node pour servir la V0/V1 frontend.

La structure frontend actuelle n'est pas reconstruite uniquement pour adopter le backend.

---

## 2.7 Temps réel

**Supabase Realtime** pour les usages qui en ont réellement besoin :

- chat global ;
- présence ;
- notifications ;
- rafraîchissement réactif de certaines vues.

Le Realtime n'est pas la source de vérité.

Flux normal :

1. le client demande une action au backend ;
2. le backend valide ;
3. le backend écrit dans PostgreSQL ;
4. l'interface reçoit ensuite la nouvelle information par réponse API et/ou événement Realtime.

Aucune mutation économique sensible ne doit être acceptée directement parce qu'un client a envoyé un événement Realtime.

---

## 2.8 Tâches planifiées

La logique temporelle reste dans le code métier du backend.

Les tâches planifiées utilisent le **même code applicatif** que les actions normales.

Déclencheur recommandé pour la première version hébergée :

**Railway Cron Jobs** exécutant des commandes dédiées du backend.

Exemples :

- intérêt bancaire ;
- rollover mensuel ;
- création du Boss ;
- distribution automatique ;
- nettoyage d'états temporaires ;
- réconciliation de notifications.

Chaque job doit être :

- rejouable ;
- idempotent ;
- protégé par la base ;
- capable de détecter qu'une période a déjà été traitée.

Le scheduler ne doit pas supposer que le navigateur d'un joueur est ouvert.

Les règles calendaires utilisent `Europe/Paris` dans la couche métier.

Si un cron s'exécute plusieurs fois ou avec quelques minutes de retard, il ne doit jamais créer un double gain.

---

# 3. Flux général

```text
┌──────────────────────┐
│ React / Vite         │
│ Cloudflare Pages     │
└──────────┬───────────┘
           │
           │ Auth
           ▼
┌──────────────────────┐
│ Supabase Auth        │
└──────────┬───────────┘
           │ JWT
           ▼
┌────────────────────────────┐
│ API GachaImpact            │
│ Node.js / TS / Fastify     │
│ Railway                    │
│                            │
│ Routes / Auth / Permissions│
│            │               │
│ Application Services       │
│            │               │
│ Domain Services            │
└──────────┬─────────────────┘
           │
           │ Prisma / SQL
           ▼
┌────────────────────────────┐
│ Supabase PostgreSQL        │
│ Source de vérité           │
└──────────┬─────────────────┘
           │
           ├──── Supabase Realtime ────► clients
           │
           └──── données persistées
```

Twitch s'ajoutera plus tard comme un autre adaptateur :

```text
Twitch
   │
   ▼
Twitch Adapter / Webhook
   │
   ▼
mêmes Application Services
   │
   ▼
mêmes Domain Services
```

Aucune règle de gameplay ne sera recopiée dans l'intégration Twitch.

---

# 4. Frontières du backend

Structure conceptuelle recommandée :

```text
server/
├── api/
│   ├── routes/
│   ├── auth/
│   ├── middleware/
│   └── serializers/
├── application/
│   ├── commands/
│   ├── queries/
│   └── services/
├── domain/
│   ├── identity/
│   ├── progression/
│   ├── economy/
│   ├── gacha/
│   ├── collection/
│   ├── teams/
│   ├── missions/
│   ├── activities/
│   ├── social/
│   └── events/
├── infrastructure/
│   ├── database/
│   ├── auth/
│   ├── realtime/
│   ├── scheduler/
│   └── twitch/
└── jobs/
```

Cette arborescence est indicative.

L'objectif important est la séparation :

**transport HTTP ≠ logique applicative ≠ règles métier ≠ infrastructure.**

---

# 5. API

## 5.1 Style

API HTTP JSON versionnée :

`/api/v1/...`

Principes :

- `GET` pour les lectures ;
- `POST` pour les actions métier ;
- mutations sensibles avec identifiant d'opération/idempotence ;
- erreurs structurées ;
- validation runtime des entrées ;
- documentation OpenAPI générable.

Le frontend ne doit pas envoyer un nouvel état complet du joueur.

Il envoie une intention.

Exemple correct :

```text
POST /api/v1/gacha/pulls
{
  count: 10
}
```

Exemple interdit :

```text
POST /api/v1/player/update
{
  primogems: 500000,
  pity5: 89
}
```

---

## 5.2 Commandes chat

Le parser des commandes `!xxx` est un adaptateur.

Exemple :

```text
!pull 10
```

devient conceptuellement :

```text
PullCommand(playerId, 10, source=INTERNAL_CHAT)
```

Le bouton graphique crée la même commande :

```text
PullCommand(playerId, 10, source=UI)
```

Twitch fera plus tard :

```text
PullCommand(playerId, 10, source=TWITCH)
```

La source change.

La règle métier ne change pas.

---

# 6. Décisions SQL transversales

## 6.1 Identifiants

Type PostgreSQL :

`uuid`

Génération initiale recommandée :

UUID v4 standard.

Raisons :

- très portable ;
- support natif partout ;
- aucun ID séquentiel exposé ;
- suffisant très largement pour l'échelle prévue.

Une migration future vers une autre stratégie d'UUID n'est pas nécessaire à prévoir maintenant.

---

## 6.2 Temps

Timestamp métier :

`timestamptz`

Date métier quotidienne :

`date`

Les timestamps représentent un instant absolu.

Les calculs de journée utilisent explicitement :

`Europe/Paris`

---

## 6.3 Ressources et grands compteurs

Les soldes économiques utilisent :

`bigint`

notamment :

- Primogemmes ;
- Moras ;
- particules ;
- Banque.

Motif :

ne pas créer artificiellement une limite 32 bits sur un jeu qui peut accumuler des ressources pendant des années.

Les petits compteurs bornés utilisent `integer`.

Exemples :

- constellation ;
- position dans une Team ;
- pity ;
- rang.

---

## 6.4 Données flexibles

`jsonb` est autorisé pour :

- payload externe opaque ;
- snapshot technique ;
- metadata non structurante ;
- traces de migration.

`jsonb` ne doit pas remplacer les vraies colonnes métier.

Ne pas recréer `viewers_data.json` dans une colonne JSONB.

---

## 6.5 Nommage

Base :

`snake_case`

TypeScript / API :

`camelCase`

Exemple :

```text
player_id      → playerId
created_at     → createdAt
business_date  → businessDate
```

---

## 6.6 Contraintes

Une règle pouvant être imposée fiablement par PostgreSQL doit idéalement l'être.

Exemples :

- solde >= 0 ;
- constellation entre 0 et 6 ;
- possession unique joueur/personnage ;
- claim quotidien unique ;
- Twitch User ID unique ;
- Gift redemption ID unique.

La couche métier valide également avant la transaction afin de fournir une erreur utilisateur propre.

---

# 7. Transactions et concurrence

Toutes les mutations économiques importantes s'exécutent dans une transaction PostgreSQL.

Exemples :

- Pull ;
- achat ;
- échange ;
- Roue ;
- récompense quotidienne ;
- Faveur ;
- cœur ;
- Code cadeau ;
- récompense Boss ;
- Gift Suprême.

Patron général :

```text
BEGIN
  verrouiller/lire état nécessaire
  valider
  appliquer mutation
  écrire journal
  marquer opération consommée
COMMIT
```

Les contraintes uniques de la base restent la dernière ligne de défense.

---

# 8. Sécurité

## 8.1 Navigateur

Le navigateur peut posséder :

- clé publique Supabase ;
- token de session de son utilisateur.

Il ne possède jamais :

- secret backend ;
- credential PostgreSQL ;
- Supabase secret/service role ;
- token Admin ;
- secret Twitch.

---

## 8.2 API

L'API :

1. vérifie le JWT ;
2. résout `WebIdentity` ;
3. récupère le `Player` ;
4. vérifie permissions/confidentialité ;
5. appelle le service métier.

Les rôles Admin et Modérateur sont lus depuis les données serveur.

---

## 8.3 PostgreSQL

Le backend dispose d'un accès DB serveur.

Le navigateur n'effectue aucune écriture sensible directement sur les tables métier.

RLS est activée lorsque des tables sont exposées directement au Realtime ou à une lecture client contrôlée.

Une donnée privée ne doit jamais être envoyée au client pour être cachée ensuite uniquement en CSS/React.

---

# 9. Realtime / chat / présence

## Chat global

Flux cible :

1. client envoie le message à l'API ;
2. API valide et persiste ;
3. XP/commande éventuelle est traitée ;
4. Realtime diffuse le nouveau message.

Une commande reste donc un vrai message utilisateur, mais son exécution métier est séparée.

## Présence

Presence Supabase peut servir de signal temps réel de session.

Les états métier :

- En ligne ;
- Absent ;
- Hors ligne ;

restent dérivés selon les règles Social validées et ne deviennent pas une vérité financière ou de progression.

---

# 10. Ce que nous n'ajoutons PAS maintenant

Pas de :

- microservices ;
- Kubernetes ;
- Redis ;
- Kafka ;
- RabbitMQ ;
- moteur de recherche externe ;
- Data Warehouse ;
- cache distribué ;
- serveur Twitch séparé ;
- event sourcing complet ;
- GraphQL obligatoire ;
- service payant d'observabilité ;
- PITR coûteux ;
- CDN d'assets payant.

PostgreSQL + un backend modulaire suffisent très largement à la V1.

Ces composants ne seront ajoutés qu'avec une mesure montrant un besoin réel.

---

# 11. Sauvegardes

## Développement

Supabase Free est acceptable.

Cependant :

- il peut être mis en pause après une période d'inactivité ;
- il ne fournit pas les mêmes sauvegardes automatiques que Pro.

Les données de développement ne doivent donc pas être considérées comme irremplaçables.

## Production réelle

**Supabase Pro recommandé dès que les joueurs possèdent une progression que nous ne sommes pas prêts à perdre.**

Le plan Pro apporte notamment les sauvegardes quotidiennes avec 7 jours de rétention.

Ajouter ensuite un export PostgreSQL externe périodique.

Ne jamais compter uniquement sur une sauvegarde située chez le même fournisseur.

## PITR

Le Point-in-Time Recovery Supabase est techniquement excellent mais trop cher pour GachaImpact à son échelle initiale.

Au snapshot tarifaire du 2026-09-04 :

- 7 jours de PITR ≈ 100 USD/mois.

**Non recommandé au lancement.**

Les daily backups Pro + export externe sont proportionnés au projet.

---

# 12. Coûts — recommandation transparente

> Les prix ci-dessous sont un snapshot au 2026-09-04 et doivent être reverifiés avant souscription.

## 12.1 Développement

| Service | Plan | Coût cible |
|---|---|---:|
| Supabase | Free | 0 $ |
| Backend | local | 0 $ |
| Cloudflare Pages | Free | 0 $ |
| Railway | non nécessaire en permanence | 0 $ |
| **Total** |  | **0 $/mois** |

---

## 12.2 Alpha en ligne non critique

| Service | Plan | Coût cible |
|---|---|---:|
| Supabase | Free | 0 $ |
| Railway | Hobby | 5 $ minimum |
| Cloudflare Pages | Free | 0 $ |
| **Total** |  | **≈ 5 $/mois** |

Ce niveau est acceptable si les données sont encore considérées comme testables/recréables.

Il n'est pas la recommandation pour une vraie progression joueur importante.

---

## 12.3 Beta / production réelle

| Service | Plan | Coût cible |
|---|---|---:|
| Supabase | Pro | 25 $ |
| Railway | Hobby | ≈ 5 $ minimum |
| Cloudflare Pages | Free | 0 $ |
| **Total de base** |  | **≈ 30 $/mois** |

C'est la cible recommandée dès que GachaImpact devient un vrai service persistant.

Avec 10 à 100 joueurs, cette infrastructure possède beaucoup de marge.

---

## 12.4 Si le jeu grossit

Supabase Pro inclut actuellement notamment :

- 100 000 MAU Auth ;
- 8 GB de base ;
- 250 GB d'egress ;
- 5 millions de messages Realtime ;
- 500 connexions Realtime simultanées.

Au-delà :

- Realtime : environ 2,50 $ par million de messages supplémentaire ;
- connexions Realtime : environ 10 $ par tranche de 1 000 connexions peak supplémentaire.

Railway facture ensuite les ressources réellement consommées.

Il est donc inutile de payer aujourd'hui pour une architecture destinée à des dizaines de milliers de joueurs.

---

# 13. Pourquoi Supabase plutôt que Neon

Neon est un excellent PostgreSQL managé.

Son plan Free et son plan Launch sont financièrement attractifs.

Mais GachaImpact a aussi besoin à terme de :

- Auth ;
- Realtime ;
- présence ;
- chat ;
- notifications réactives ;
- stockage éventuel.

Neon fournirait très bien PostgreSQL mais nécessiterait davantage de briques externes ou de logique maison autour.

Supabase réduit le nombre de fournisseurs sans sacrifier PostgreSQL.

**Décision : Supabase est plus cohérent pour GachaImpact.**

---

# 14. Pourquoi pas Firebase

Firebase est excellent pour certains produits temps réel.

Il n'est pas retenu car le modèle GachaImpact est fortement relationnel :

- joueurs ;
- personnages ;
- possessions ;
- équipes ;
- relations ;
- demandes ;
- historiques ;
- événements ;
- contraintes d'unicité ;
- transactions économiques ;
- classements.

PostgreSQL correspond naturellement au modèle déjà consolidé.

Utiliser une base NoSQL ici créerait davantage de travail sans bénéfice.

---

# 15. Pourquoi pas Supabase Edge Functions comme backend principal

Cette solution pourrait économiser les quelques dollars du backend Railway.

Elle n'est pas retenue comme architecture centrale.

Raisons :

- davantage de dépendance au runtime Supabase/Deno ;
- logique métier plus dispersée ;
- portabilité moindre vers le futur jeu ;
- backend Node standard plus facile à déplacer ;
- coût Railway Hobby très faible.

Les Edge Functions restent autorisées plus tard pour des intégrations ponctuelles lorsqu'elles apportent un vrai avantage.

Aucune règle métier centrale ne doit dépendre uniquement d'elles.

---

# 16. Pourquoi pas auto-héberger Supabase

Supabase peut être auto-hébergé.

Mais alors le projet devient responsable de :

- maintenance serveur ;
- sécurité ;
- mises à jour ;
- PostgreSQL ;
- sauvegardes ;
- disponibilité ;
- monitoring ;
- restauration ;
- scaling.

Pour économiser environ 25 $/mois, ce serait aujourd'hui un mauvais échange.

**Managed Supabase est recommandé.**

L'auto-hébergement reste une porte de sortie future, pas une optimisation V1.

---

# 17. Stratégie anti-lock-in

Pour garder GachaImpact et le futur jeu portables :

1. PostgreSQL standard reste la source de vérité.
2. Toutes les migrations sont versionnées dans Git.
3. Le backend utilise PostgreSQL directement via Prisma.
4. La logique métier ne vit pas dans PostgREST.
5. La logique métier principale ne vit pas dans Edge Functions.
6. Auth est encapsulé derrière un adaptateur.
7. Realtime est encapsulé derrière une interface.
8. L'hébergement API reste Docker-compatible.
9. Les secrets sont injectés par variables d'environnement.
10. Twitch reste un adaptateur externe.
11. Aucun ID métier ne dépend du fournisseur.

Ainsi, changer Supabase ou Railway devient un projet d'infrastructure, pas une réécriture du jeu.

---

# 18. Réutilisation pour le futur jeu original

Cette architecture est volontairement choisie pour pouvoir être réutilisée.

Éléments directement réutilisables :

- structure backend modulaire ;
- auth → Player séparé ;
- transactions économiques ;
- journal des ressources ;
- idempotence ;
- patterns Gacha ;
- catalogues ;
- inventaires ;
- équipes ;
- tâches temporelles ;
- notifications ;
- chat ;
- social ;
- permissions ;
- migrations ;
- observabilité ;
- CI/CD ;
- déploiement Docker.

Le futur jeu pourra avoir :

- son propre repository ;
- sa propre DB ;
- son propre domaine ;
- ses propres assets et règles.

Il n'aura pas besoin d'utiliser Twitch.

Le but est de réutiliser les **patterns et éventuellement certains packages génériques**, pas de faire dépendre le futur jeu du code spécifique à Genshin.

---

# 19. Environnements

## Développement

- frontend local ;
- backend local ;
- Supabase Free de développement ;
- aucune donnée joueur importante.

## Production

- frontend Cloudflare Pages ;
- API Railway ;
- Supabase Pro ;
- domaine personnalisé ;
- sauvegardes automatiques + export externe.

Un environnement staging séparé ne sera ajouté que lorsque le rythme de livraison le justifiera.

---

# 20. Observabilité minimale

Dès le premier backend réel :

- logs JSON structurés ;
- request/correlation ID ;
- operation/idempotency ID ;
- logs d'erreurs ;
- endpoint `/health` ;
- historique des jobs ;
- `AdminAuditEntry` ;
- `ResourceMovement` ;
- `MigrationIssue`.

Un service externe comme Sentry peut être ajouté plus tard sur son free tier.

Pas de service payant d'observabilité au départ.

---

# 21. Premier vertical slice recommandé

Après le schéma physique et le squelette backend, le premier test complet recommandé est :

## Onboarding + Ressources + Roue

Parcours :

1. inscription/authentification ;
2. création du `Player` ;
3. choix de l'élément ;
4. affichage des ressources ;
5. utilisation de la Roue ;
6. transaction de récompense ;
7. `ResourceMovement` ;
8. verrou quotidien ;
9. rechargement de la page ;
10. restitution du même résultat sans reroll ;
11. second essai refusé ;
12. reset quotidien testé.

Pourquoi la Roue :

- simple à comprendre ;
- couvre Auth ;
- couvre Player ;
- couvre ressources ;
- couvre RNG serveur ;
- couvre transaction ;
- couvre idempotence ;
- couvre journée `Europe/Paris` ;
- couvre historique minimal ;
- couvre synchronisation frontend/backend ;
- constitue déjà une vraie petite boucle jouable.

Elle permet de valider le socle avant d'attaquer le Gacha, beaucoup plus complexe.

---

# 22. Ordre de travail Phase C

## C1 — Architecture
**Terminé par ce document.**

## C2 — Schéma PostgreSQL physique
À produire :

- tables ;
- types ;
- clés ;
- contraintes ;
- index ;
- relations ;
- règles de suppression/archivage ;
- RLS nécessaire ;
- mapping Prisma.

## C3 — Squelette backend
À produire :

- serveur Fastify ;
- configuration ;
- Auth adapter ;
- DB adapter ;
- gestion erreurs ;
- logs ;
- health ;
- tests ;
- environnement.

## C4 — Provisionnement Supabase de développement
Seulement après validation du schéma initial.

## C5 — Premier vertical slice
Onboarding + Ressources + Roue.

## C6 — Migration pilote
Après une première base métier stable, conformément à la roadmap.

---

# 23. Alternatives réévaluables

Cette décision n'interdit pas un changement futur.

Réévaluer si :

- Supabase change fortement ses tarifs ;
- Railway devient beaucoup plus cher ;
- une contrainte réglementaire apparaît ;
- le jeu atteint une charge réelle supérieure aux capacités choisies ;
- le futur jeu exige une autre topologie.

Toute réévaluation doit comparer les coûts **au moment où elle est faite**, et non réutiliser les prix de ce document.

---

# 24. Sources de prix consultées — snapshot 2026-09-04

Supabase :
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/realtime/pricing

Railway :
- https://railway.com/pricing
- https://docs.railway.com/pricing
- https://docs.railway.com/cron-jobs

Cloudflare Pages :
- https://www.cloudflare.com/developer-platform/products/pages/
- https://developers.cloudflare.com/pages/functions/pricing/

Neon :
- https://neon.com/pricing

Les prix sont informatifs et ne constituent jamais une constante métier du repository.
