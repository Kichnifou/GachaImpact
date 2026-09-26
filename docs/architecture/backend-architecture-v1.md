# GachaImpact — Architecture backend V1

> Statut : **DÉCISION TECHNIQUE — Phase C / socle backend retenu**
>
> Date de décision : **2026-09-04**
>
> Baseline repository : `main` au commit `6ed204c63c557478889d348e03c9d1199f50ff8a`
>
> Ce document complète `docs/specifications/v1-data-model.md`. Il ne remplace aucune décision métier des audits.
>
> **Portée :** ce document décrit l'architecture V1 cible. L'état physique courant doit être vérifié dans `server/prisma/schema.prisma`, les migrations versionnées et le code réellement présent ; `docs/master/PROJECT_MASTER_PLAN.md` porte l'avancement vivant.

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

**Prisma ORM 7.10.0 stable avec PostgreSQL**, en gardant les contraintes importantes dans les migrations SQL.

La V1 retient Prisma 7.10.0 stable : le socle ne doit pas être construit sur une release candidate de Prisma 8. Une migration vers une future version majeure sera réévaluée uniquement lorsqu'elle sera stable et apportera une valeur suffisante au projet.

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
- première alpha en ligne : Railway Free avec mode Serverless lorsque l'usage réel le permet ;
- si le crédit mensuel Free devient insuffisant ou ses limitations gênantes : passage direct à Railway Hobby ;
- première version réellement persistante nécessitant une disponibilité plus forte : Railway Hobby ;
- montée vers Pro uniquement lorsque les métriques le justifient.

Le passage Free → Hobby ne nécessite aucune modification d'architecture ou de code applicatif.

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

La correction de l'état métier ne doit jamais dépendre exclusivement de la présence d'un scheduler externe.

Chaque traitement temporel possède donc une opération de réconciliation idempotente capable de rattraper les périodes non encore traitées depuis l'état enregistré en base.

Cette réconciliation peut être appelée notamment :

- au démarrage du backend ;
- lors d'une requête pertinente ;
- par un déclencheur planifié.

Exemples :

- intérêt bancaire ;
- rollover mensuel ;
- création du Boss ;
- distribution automatique ;
- nettoyage d'états temporaires ;
- réconciliation de notifications.

Pour la première alpha gratuite, aucun service Cron payant n'est requis pour garantir la cohérence des données.

Supabase Cron peut éventuellement servir de déclencheur supplémentaire lorsque cela apporte une vraie valeur, mais il ne devient jamais la source de vérité de la logique temporelle.

Lorsque Railway Hobby est utilisé, Railway Cron Jobs pourra déclencher les mêmes opérations applicatives afin d'obtenir des traitements plus ponctuels.

Chaque traitement doit être :

- rejouable ;
- idempotent ;
- protégé par la base ;
- capable de détecter qu'une période a déjà été traitée.

Le scheduler ne doit pas supposer que le navigateur d'un joueur est ouvert.

Les règles calendaires utilisent `Europe/Paris` dans la couche métier.

Un traitement exécuté plusieurs fois ou avec du retard ne doit jamais créer de double gain.

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

Le [contrat Chat global R872–R895](../specifications/global-chat-v1.md) fixe le comportement produit ; les MP gardent leur contrat Social R501–R522, complété par l'ordre transverse R895. Les migrations 032–035 et 039, `GlobalChatService` et `ChatCommandDispatcher` alimentent les huit routes player-facing authentifiées et le `ChatPanel` réel. La migration 039 reste additive après le socle MP 036–038, sans réécriture de 038 ni changement de transport HTTP ; la migration 040 ultérieure porte exclusivement les signalements MP et amène DEV à 40 migrations Prisma.

Flux conceptuel cible :

1. client envoie le message à l'API ;
2. API authentifiée valide le contenu, l'anti-rafale et les permissions pertinentes, puis persiste le message et son identité ;
3. compteurs/XP éventuels et commande sont traités sans attribuer la réponse du jeu au joueur ;
4. le mécanisme de diffusion retenu pour le lot rend le nouveau message disponible aux lecteurs, avec lecture progressive et non-lus autoritaires.

Une commande reste un vrai message utilisateur public. `GlobalChatService.send` la classe et la stocke comme `COMMAND` dans une transaction distincte de son exécution métier. `ChatCommandDispatcher` passe son ID durable comme clé d'idempotence aux propriétaires Gacha, Roue, Social, Échanges, Box, Combat, Expédition, Event, Boutique, Banque, Conversion et Codes ; leurs transactions restent propriétaires des mutations. Selon R884, le dispatcher n'utilise que `ContestService.getCurrent` pour `!concours` et renvoie toute sous-commande Concours vers l'interface standalone. Event conserve ses actions Chat complètes, Jeu C compris, via `EventService` et son état métier unique. Il consulte d'abord le résultat existant, puis publie sous `GachaImpact` un ou plusieurs `GAME_RESULT` publics, liés au message d'origine, de 500 caractères maximum chacun et persistés atomiquement avec des clés stables. Un Pull 1..10 restitue les résultats persistés du moteur. Une mutation confirmée dont la restitution échoue reste rejouable sans créer de faux résultat d'erreur ; une clé de sélection Gacha ne réapplique pas une ancienne cible après un choix UI ultérieur. Les erreurs métier, aides et syntaxes invalides donnent également une réponse publique. La réponse serveur ne touche ni compteurs, ni XP, ni activité ; les services qui acceptent un canal reçoivent `INTERNAL_CHAT`. Une action UI conserve son retour UI sauf règle produit spécialisée explicite. Le socle verrouille le Player dans une transaction `SERIALIZABLE`, réutilise `BusinessOperation`, le moteur XP et `PlayerActivityRecorder`. L'idempotence est vérifiée avant le pacing ; les nouveaux `PLAYER`/`COMMAND` exigent 750 ms et, après trois en moins de quatre secondes, attendent trois secondes depuis le troisième avec `CHAT_PACING_LIMIT`. `submissionOrder` est réservé indépendamment, mais l'instant autoritatif `createdAt`/pacing n'est capturé qu'après acquisition du verrou Player : une requête arrivée plus tôt mais sérialisée plus tard ne peut donc pas comparer un faux instant antérieur au dernier message persistant. Le frontend conserve l'optimistic immédiat et possède une file de POST par instance/Player : nouveaux intents séquentiels, au moins 750 ms entre leurs démarrages, suite de file préservée après erreur, retries exacts sur la même infrastructure sans nouveau pacing. Le verrou visuel expire exactement trois secondes après M3 et rend automatiquement focus/caret ; la file conserve séparément une borne serveur sûre issue de M3, de sorte qu'un M4 optimistic puisse être saisi sans provoquer un POST volontairement trop tôt. Le frontend live ne re-trie pas les lignes déjà visibles : les nouvelles livraisons s'ajoutent et les projections connues se remplacent en place. Le filet de dix messages sur dix secondes reste en place. Un message `PLAYER` avec un élément standalone valide peut gagner de l'XP dès 0 XP ; le cooldown XP et le cas défensif sans élément restent applicables. La suppression auteur garde la ligne et masque son contenu dans le DTO ; le signalement crée un snapshot privé, tandis que les outils de modération restent futurs. Le transport player-facing utilise le polling HTTP ; seules les 200 lignes les plus récentes de la génération courante sont exposées, sans supprimer les lignes plus anciennes de PostgreSQL ; aucune réponse privée de commande n'y est prévue.

Le Chat global revalide les projections touchées par une commande mutationnelle via `refreshScopes` calculés à partir des opérations serveur confirmées. `AppBootstrap` et `GameShell` rechargent leurs propriétaires de données sans F5 ni remontage global de l'écran ; une erreur de refresh après succès ne rejoue pas la commande. `!pull` couvre ressources, Gacha/pity/garantie/Capture, Box, inventaire, Défi Pulls, progression éventuelle, Team, Combat quotidien, Boss et Concours. `!stella` revalide également Box, inventaire, ressources, Team, Combat quotidien, Boss et Concours. Ce dernier scope relit uniquement la projection standalone ; R884 conserve `!concours` en consultation. Les lectures et échecs métier ne déclenchent pas de refresh de mutation.

Les routes `GET/POST /api/v1/chat/messages`, `POST /api/v1/chat/updates`, `GET /api/v1/chat/unread`, `POST /api/v1/chat/read`, `DELETE /api/v1/chat/messages/:messageId`, `GET /api/v1/chat/mentions` et `POST /api/v1/chat/messages/:messageId/report` sont authentifiées, no-store et résolvent le Player serveur. `updates` reçoit en JSON la génération, une ancre `(createdAt, id)` facultative et jusqu'à 200 IDs connus de la fenêtre canonique. La page initiale fournit ces IDs même si seulement 50 lignes sont rendues, afin de distinguer une arrivée tardive réelle des pages historiques non encore ouvertes. L'API garde le format de curseur compatible mais résout l'ID vers `submissionOrder`; liste, curseurs, updates, suppressions connues et non-lus partagent cet ordre dans les 200 lignes les plus récentes. Les IDs connus permettent de livrer sans buffering une intention réservée avant l'ancre mais commitée plus tard, sans précharger les anciennes pages. Il retourne un reset au changement de génération et au dépassement de fenêtre ; sinon, il livre en une réponse toutes les lignes réellement inconnues de la fenêtre bornée à 200. Les IDs renvoyés au prochain appel ne comprennent que ceux déjà issus d'un snapshot ou effectivement transmis, de sorte qu'aucune ligne inconnue ne puisse être perdue par anticipation. `GlobalChatMention` résout les pseudos entiers côté serveur avec la normalisation Social, statut ACTIVE et blocages bidirectionnels ; les IDs client ne créent pas de mention. Le DTO projette les mentions résolues nécessaires au rendu sans exposer de relation sociale supplémentaire, ainsi que `mentionedMe` et `repliedToMe` au lecteur concerné. `GlobalChatReport` fige la cible et dix messages avant/après pour la modération ultérieure, sans route de lecture navigateur. Un message PLAYER qui obtient réellement de l'XP fait progresser le Défi Messages dans la même transaction ; un level-up Chat publie une ligne GachaImpact après son message sans XP ni compteur supplémentaire. Le panneau utilise `updates` toutes les 350 ms start-to-start ouvert et visible, sans overlap ; replié, il interroge les non-lus toutes les 5 secondes, suspend tout polling quand le document est caché et, à la réouverture, place d'abord le snapshot local au bas avant paint puis recharge la page récente.

Le frontend MP garde un cache mémoire isolé par Player et conversation, alimenté immédiatement par le dernier message de la liste puis revalidé. Le fil ouvert poll toutes les 500 ms start-to-start, la liste visible toutes les 1 250 ms et l'inactif toutes les 5 s, sans overlap. Les mutations d'envoi, lecture, archivage et accusés publient d'abord leur résultat local pertinent puis revalident. `DirectMessageService` joint l'opération propriétaire afin de projeter `clientIntentKey` uniquement à l'auteur : l'optimistic est ainsi remplacé en place sans migration ni exposition de la clé d'autrui. Une projection fraîche d'un même message remplace l'objet en cache, notamment pour `readByOther` et `readByOtherAt`.

Le lot avancé ajoute `PATCH .../messages/:messageId`, `POST .../:messageId/delete` et `POST .../:messageId/restore`. Le service vérifie participant, conversation, auteur et état sous verrou de ligne, puis conserve ID, `submissionOrder` et `createdAt`. L'édition normalise le même texte Unicode 1..1 000 que l'envoi et renseigne `editedAt`; suppression et restauration basculent `deletedAt`/`restoredAt`. Les trois opérations sont rejouables par clé via `BusinessOperation`, sans nouveau message ni non-lu, et retournent le patch autoritatif `id/content/editedAt/deletedAt/restoredAt`, y compris en replay. La projection force `content = null` pour tout tombstone, même à l'auteur ; Restore peut retourner le contenu redevenu actif. Une frontière commune fixe la fenêtre restaurable : 499 messages plus récents conservent le contenu serveur, tandis que 500 messages plus récents rendent le message non restaurable. Dans ce second cas, la suppression écrit atomiquement `deletedAt`, `content = null` et `contentPurgedAt`; aucun nouvel envoi n'est requis. L'insertion suivante conserve sa purge indexée des tombstones qui sortent ultérieurement des 500 derniers.

Dans le client, aucun menu `⋯` n'existe par message. Les actions auteur et destinataire sont de petits overlays internes à la bulle, révélés au hover sur pointeur fin, au focus ou au premier tap coarse ; elles n'imposent aucune réserve d'espace permanente et leur apparition ne déplace ni texte ni bulle et ne déborde pas horizontalement. L'édition reste inline et multiligne, scrolle intégralement dans le fil puis reçoit focus/caret final. Entrée sauvegarde, Ctrl/Meta+Entrée ajoute une ligne, l'IME est protégé et un pointerdown extérieur annule l'édition. La confirmation de suppression est un overlay absolu sous la bulle ; son ouverture ne scrolle que le minimum nécessaire dans le fil récent ou l'Historique propriétaire, sans scroll global. Confirmer la ferme synchroniquement avant la mutation optimistic et elle demeure fermée pendant succès, retry ambigu ou rollback déterministe. Le tombstone garde sa position et Restore réutilise la même ligne. Le cache adopte directement le patch de mutation serveur avant sa revalidation de fond, protège cette projection d'un polling obsolète, rollbacke une erreur déterministe et conserve la clé d'une erreur ambiguë pour `Réessayer`. Un cache éphémère isolé par Player/conversation retient seulement le contenu supprimé dans la session afin d'optimiser Restore ; il est vidé au changement de Player et n'est jamais persisté. Un dernier message supprimé porte l'aperçu `Message supprimé` et ne montre aucun statut de livraison. Le signalement MP actuel est décrit dans sa section R509/R510/R517 ci-dessous.

La création d'un fil utilise `GET /api/v1/me/direct-conversations/players?q=...`, projection ciblée distincte de l'annuaire Social. Elle résout le Player authentifié, ne retourne que les comptes `ACTIVE` hors soi-même et seulement `id`, `displayName`, `elementKey`, avec recherche sous-chaîne insensible à la casse et aux accents, tri stable et limite vingt. Elle ne charge ni présence, ni amitié, ni progression, ni statistiques ; les permissions MP restent vérifiées par les mutations autoritatives d'initiation et d'envoi.

Le candidat correctif R886 persiste `GlobalChatState.generation` et la génération de chaque message et état de lecture. Envoi et clear prennent le même verrou de ligne dans une transaction sérialisable ; une réponse tardive d'une commande conserve la génération de son message source. Le clear exige une attribution active `MODERATOR` ou `ADMIN`, inscrit une `BusinessOperation chat.clear` auditée et idempotente, puis n'émet ni `COMMAND` ni `GAME_RESULT`. Liste, pagination, non-lus, lecture, réponse, suppression et signalement bornent les accès à la génération courante ; les anciens contenus restent dans PostgreSQL. L'API transmet la génération au navigateur, qui remplace son snapshot, ses curseurs et ses compteurs au changement, sans heuristique sur une page vide. L'envoi optimiste utilise la clé d'intention de l'auteur pour réconcilier le polling et la confirmation sans doublon.

## Présence

Batch B utilise des sessions PostgreSQL et du polling HTTP authentifié. Aucun Supabase Realtime supplémentaire n'est nécessaire pour la taille actuelle. Presence Supabase reste une option future, pas une dépendance du Chat global déployé.

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
| Railway | Free | 0 $ |
| Cloudflare Pages | Free | 0 $ |
| **Total** |  | **0 $/mois** |

Railway Free fournit un crédit mensuel limité. Le mode Serverless doit être utilisé lorsque possible afin de réduire la consommation pendant les périodes sans activité.

Avec la petite communauté actuelle, cette configuration doit être essayée avant de payer quoi que ce soit.

Si le crédit Railway Free devient insuffisant, le premier passage payant est simplement Railway Hobby, sans migration ni changement d'architecture.

Supabase Free est également suffisant pour la petite alpha mais ne fournit pas les sauvegardes automatiques du plan Pro.

Tant que de vraies données joueurs importantes sont conservées sur Free, prévoir des exports PostgreSQL réguliers vers un emplacement privé et séparé.

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

## Outils de test privilégiés

L'écran `Modération` consomme un DTO de permissions serveur. `MODERATOR` reste communautaire sans outil; `TESTER` (rang player-facing `Testeur`) ajuste seulement ses propres ressources; `ADMIN` (rang `Super`) possède les outils complets, peut chercher/cibler un Player ACTIVE et gérer uniquement l'attribution TESTER. Les routes personnelles et ciblées sont authentifiées, validées par Zod, transactionnelles et idempotentes. La recherche Super filtre PostgreSQL avant la limite stable de 20 résultats et reste insensible à la casse; sans extension `unaccent` physiquement installée, l'insensibilité aux accents n'est pas promise. Un coordinateur frontend de session conserve une seule intention ambiguë par acteur et cible : un retry strictement identique, y compris pour grant/revoke TESTER, réutilise la même clé, tandis qu'une autre action, cible ou payload reste bloqué jusqu'à résolution; succès, erreur déterministe et sign-out libèrent l'intention. Toute mutation écrit une `AdminAuditEntry` distinguant acteur et cible; les deltas de ressources écrivent aussi un `ResourceMovement` de source `ADMIN` sans alimenter les statistiques économiques de gameplay. Les tables de rôles/audit restent exclusivement accessibles par le backend avec RLS active et aucun accès direct navigateur.

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

## 21.1 Navigation personnelle physique 0.80

Le shell frontend utilise un registre typé unique pour la navigation principale, le Menu et Configuration. Il conserve uniquement en mémoire le dernier sous-onglet Personnages/Activités de la session et encode les destinations partageables dans des hashes canoniques compatibles avec les anciens liens.

La préférence durable du Menu suit `UI → API authentifiée → NavigationPreferencesService → PlayerPreference`. `GET/PUT /api/v1/me/navigation-preferences` résout toujours le Player depuis l’identité authentifiée ; aucun `playerId` client n’est accepté. Le store Prisma lit et upsert exclusivement la clé `navigation_menu_v1`. Le serveur valide la structure, ignore les identifiants inconnus, déduplique, ajoute les nouvelles destinations, interdit le masquage de Configuration et renvoie une valeur sûre après JSON absent ou invalide. Cette préférence n’accorde jamais une permission et ne rend jamais disponible une destination future.

Le snapshot Modération porte désormais le rang de la cible, dérivé de ses attributions actives avec la hiérarchie ADMIN, MODERATOR, TESTER, joueur. Les permissions jointes restent celles de l’acteur ; le DTO public Player n’est pas enrichi de rôles.

## 21.2 Historique Boutique physique 0.81

Le vertical Boutique ajoute une projection de lecture dédiée `GET /api/v1/me/shop/history?page=N` selon la chaîne `route authentifiée → GetPlayerShopHistory → ShopStore.getHistory`. Le service résout toujours le Player depuis l’identité authentifiée et valide la page ; Prisma applique le filtre Player, l’ordre déterministe `purchasedAt DESC, id DESC`, puis `skip/take` par dix. La route réutilise le sérialiseur d’achat de la Boutique.

Le frontend charge cet historique uniquement à l’ouverture de la modale et à ses changements de page. Il ne l’insère pas dans `ShopMemoryCache`. Une coque de modale commune porte fermeture, body défilant et pagination fixe pour Banque et Boutique, tandis que chaque écran conserve son état local, son appel API et ses colonnes métier.

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

# Complément physique Batch A — Event lifecycle / Votes

`NotificationService.list` branche `EventLifecycleNotificationReconciler` après les réconciliations existantes. L'édition est résolue côté serveur ; sous verrou Player et transaction sérialisable, l'upsert sans mise à jour conserve une preuve durable de livraison Player/édition/type. Les annonces périmées sont résolues ; un archivage ne réactive jamais la même annonce. R643 compare les dates Europe/Paris de maintenant et de `endsAt - 1 ms`. Aucun nouveau scheduler ni canal chat/Twitch.

`EventService` consomme `GiftCodeService.festivalAvailability` : le code doit être publié, ANNUAL, du mois courant, dans sa fenêtre, non réclamé par le Player **et une définition système seedée** (`createdById IS NULL`). Un ANNUAL Admin du même mois est un Code valide mais ne devient jamais un code Festival. Les éditions sont matérialisées par le moteur Codes existant ; token/titre ne sont pas l'identité Event. La projection ne divulgue aucun token et ne crédite rien ; le claim reste une mutation Codes et rafraîchit le snapshot Event client.

`BannerVoteService` expose GET/POST `/api/v1/gacha/vote`. La lecture RepeatableRead retourne cycle serveur, candidats/id/compteurs, ownVote et version légère du catalogue. La mutation reçoit les UUID personnage/rotation, résout le Player authentifié, impose UI et utilise le verrou advisory `70422401` partagé avec `PrismaGachaStore.ensureRotation`, en SERIALIZABLE avec retry borné. L'unicité rotation/Player permet le replay naturel ; une rotation fournie périmée ne vote jamais dans la nouvelle semaine. Aucun compteur ni état Gacha/économique n'est muté par le vote.

`WeeklyBannerScheduler` et `selectBannerFeatured` restent uniques : les votes de l'ancienne ACTIVE pondèrent le quatrième 5★ de la suivante après exclusion des trois random et des featured précédents. L'échec de génération rollbacke sans fermer/remplacer la bannière ni supprimer ses votes ; la fenêtre temporelle ferme néanmoins le vote. Le scheduler remonte l'erreur puis conserve un seul timer de retry technique de 60 secondes, aussi après un échec au démarrage ; `stop()` annule ce retry. Une génération réussie clôt la rotation, conserve les lignes historiques et ouvre le nouveau cycle, tout en vidant les anciennes cibles selon la règle existante, puis réarme la frontière hebdomadaire normale.

Le Catalogue utilise une boucle de trois secondes après réponse, visible-only, anti-overlap, réveil focus/visibility et nettoyage au démontage. Les réponses de lecture obsolètes ne remplacent pas une mutation récente. Le catalogue complet n'est rechargé que si sa version change ; pas de polling Gacha complet. Aucun cache de votes inter-Player.

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

## Vertical backend physique 0.82 — Défi et conversion

Les routes authentifiées `GET /api/v1/me/daily-challenge`, `POST .../purchase`, `POST .../switch` et `POST /api/v1/me/inventory/particles/convert` suivent `route → service d’application → store Prisma`. Elles ne reçoivent jamais Player, prix, récompense, cible, type, pool ou RNG du client. Tous les montants `bigint` traversent l’API en chaînes décimales.

Achat, switch et conversion utilisent `BusinessOperation`, une clé d’intention stable et une transaction `SERIALIZABLE` verrouillée par Player. `PrismaDailyChallengeStore.progress` est appelé par les producteurs dans leur propre transaction : Gacha après persistance effective des résultats, Conversion après ses mouvements économiques. La complétion et le crédit de 800 Primos sont atomiques. Le frontend recharge le snapshot Défi après chaque producteur sans refaire le bootstrap complet.

## Vertical backend physique 0.86 — Combat quotidien

Les routes privées `GET /api/v1/me/combat/daily`, les mutations ciblées de loadout et `POST /fight` suivent `route Fastify → CombatService → DailyCombatStore → Prisma`. `CombatService` résout le Player authentifié et la `businessDate` Europe/Paris ; aucun Player, ennemi, chance, roll ou mode autoritaire n'est accepté du navigateur.

La formule de chance vit dans une fonction de domaine pure unique, utilisée par le preview, l'Auto et le fight en demi-points exacts. Le store génère paresseusement la rencontre globale sous verrou transactionnel, persiste les quatre éléments ennemis snapshotés, nettoie seulement les slots devenus inactifs, lit Box/possessions et Team active sans jamais les modifier, et mémorise le mode de la prochaine tentative côté serveur.

Le fight utilise une transaction `SERIALIZABLE`, un verrou Player et `BusinessOperation`. Tentative, snapshots des quatre membres, KO de défaite, compteurs Player/personnage, récompense de victoire et `ResourceMovement` sont atomiques. Un retry de la même intention relit son résultat ; deux intentions concurrentes ne peuvent ni dépasser la première victoire ni créditer deux fois les +800 Primogemmes et +20 000 Moras. Mission reste un futur consommateur de l'événement autoritatif ; elle ne recalcule pas Combat. Le Boss mensuel n'est pas implémenté dans ce vertical.
## État physique candidat 0.89 — Expedition et Notifications

`ExpeditionService` est l'unique propriétaire métier des lectures, départs, transitions READY, claims et annulations administratives d'Expedition. Ses mutations verrouillent le Player dans la transaction afin de sérialiser toutes les intentions concurrentes sans créer de verrou global sur le personnage : Team, Combat et Box restent utilisables.

Le départ ne produit aucun RNG ni gain. Le claim seul choisit la récompense via une source aléatoire injectable, puis orchestre atomiquement `BusinessOperation`, `EconomyService`, `ResourceMovement`, `totalCompleted +1`, résolution de notification et frontière typée `expedition.completed`. Cette frontière est prévue pour un futur consommateur Missions mais ne constitue pas une implémentation du domaine Missions.

`GET /api/v1/me/expedition` alimente les projections personnelles Box et Quotidiennes. Les mutations `start` et `claim` réutilisent le même service et renvoient leurs snapshots autoritatifs. `NotificationService` expose le socle header minimal ; la réconciliation Expedition crée une unique notification READY actionnable vers la fiche Box, sans écran dédié ni dépendance chat/Twitch. Chaque entrée non résolue peut être archivée individuellement par une route personnelle qui contrôle son appartenance au Player. La lecture GET reste l’entrée de refresh complète et réconcilie Expedition puis Codes avant projection. `readOne`, `readAll`, `archiveOne` et `archiveRead` retournent directement un snapshot personnel après leur mutation, sans relancer ces deux domaines. Tous ces snapshots archivent paresseusement les seules entrées `READ` antérieures au début du jour métier courant `Europe/Paris` ; les entrées `UNREAD` sont conservées indépendamment de leur âge.

## Vertical backend physique candidat 0.91 — Boss mensuel

`MonthlyBossService` résout le Player authentifié, la date/journée et le mois Europe/Paris. `MonthlyBossScheduler` appelle la même primitive race-safe au démarrage et au prochain début de mois ; chaque GET/mutation conserve le fallback de premier accès. La génération est sous advisory lock et reçoit une `RandomSource` injectable pour la variation et la résistance. Aucun Boss courant n’est encodé en SQL.

Les routes privées couvrent vue courante, PUT/DELETE de slot, copie Team active, clear et attaque. `GET /api/v1/combat/boss/:bossId/ranking` et `GET /api/v1/combat/boss/history` exposent les lectures communautaires contrôlées par le serveur, sans accès SQL navigateur. Les DTO sérialisent tous les `bigint` en chaînes. Le client ne transmet jamais dégâts, HP, résistance, composition snapshot, rang ni récompense.

Pour un Boss vaincu, la projection courante dérive les groupes Boss/Communauté/Records/Joueur depuis les tables 016 existantes : durée calendaire Paris, attaques, dégâts, moyenne, Top 3, records et part personnelle. L’historique paginé à dix entrées expose les mêmes agrégats, les trois valeurs HP et l’ajustement suivant calculé par la formule de scaling autoritative. Aucun résumé d’affichage n’est persisté et aucune migration supplémentaire n’est requise.

L’attaque utilise `SERIALIZABLE`, verrou Player puis verrou de la ligne Boss, `BusinessOperation` et une clé stable. Elle revalide l’instance explicite, le quota journalier et les quatre possessions, calcule/snapshotte les contributions, met à jour PV, participation et statistiques. Le lethal fige l’instance et verse dans la même transaction les deux crédits Economy à chaque participant trié, avec une opération système propre au bénéficiaire, un `BossReward` unique et une notification dédupliquée. Le payload structuré de cette notification reprend le nom du Boss et les montants directement depuis `MONTHLY_BOSS_REWARD`, afin que le frontend présente les gains exacts sans recalcul ni duplication de constantes ; les anciennes notifications textuelles conservent un fallback de présentation. Les codes d’erreur Boss sont stables et une course perdante n’écrit aucune attaque.

## Vertical backend physique candidat 0.92 — Concours / C6

Les routes authentifiées de consultation et mutations Concours suivent `Fastify → ContestService → Prisma/Economy`. Le client ne fournit jamais thème, statistiques, points, ordre, RNG, deadline, bot, rang ni récompense. Les lectures publiques contrôlées de l’historique ne donnent aucun accès SQL direct et n’exposent que les concours FINISHED.

`ContestService` résout la date Europe/Paris et réutilise un verrou advisory transactionnel global pour création, mutations et réconciliation. Le thème du jour est créé une fois de façon race-safe avec RNG injectable. Le deadline du lobby représente dix minutes d’inactivité : une primitive centrale le repousse après chaque mutation réussie d’un participant (join, Légende, Ready, départ, retrait ou transfert), tandis que GET, polling, replay idempotent et membership spectateur ne le touchent pas. Cette exclusion des spectateurs empêche un keep-alive artificiel sans action d’un participant. Ready appartient à chaque humain : un join, départ ou retrait conserve les autres états et un changement de Légende remet seulement son propriétaire à `false`. Le lancement revalide chaque possession 5★ C6 active, snapshotte statistique/base/titre, consomme les daily dans la transaction, complète à quatre bots puis persiste un ordre mélangé. Chaque action, timeout, soutien, départ et remplacement repart de l’état persistant ; plusieurs schedulers ne peuvent pas jouer deux fois le même tour.

Le reconciler tourne côté serveur et en fallback au premier accès. Il applique les Basic automatiques à 60 secondes, remplace au troisième timeout, exécute les bots, ouvre/ferme le soutien de 30 secondes, annule les états impossibles et arrête les parties sans humain. La fin à 50 classe les quatre slots, verse les récompenses exactes via `PrismaEconomyService`, met à jour compteurs/titres et persiste le résultat atomiquement. Les événements `TITLE_PROMOTED` sont projetés explicitement dans le résultat et le détail historique sans altérer le snapshot de titre du lancement. La liste publique FINISHED reste compacte et paginée par dix ; sa route de détail projette classement, ordre, horaires, récompenses et seulement les départs, remplacements, soutiens et promotions utiles, jamais le JSON événementiel brut ni les `/20` privés. Les événements d’intention et `BusinessOperation` garantissent replay identique ou conflit explicite ; les récompenses ont leur propre opération système idempotente.

## Stabilisation physique candidate 0.93 — réconciliation Concours

La réconciliation automatique ne repose plus sur un `setInterval` lançant des promesses détachées. Un scheduler séquentiel attend l’exécution en cours avant d’armer la suivante, intercepte et journalise localement le nom et le code d’une erreur sans exposer de donnée privée, puis reprend au tick suivant ; son arrêt attend la promesse active avant la déconnexion Prisma. `ContestService` coalesce aussi les appels concurrents du même processus, tandis que le verrou advisory transactionnel reste l’autorité entre plusieurs processus.

Avant d’ouvrir une transaction, une projection minimale détermine si une transition est réellement due. Le reconciler tente ensuite le verrou global, recharge l’état live et revalide la date, la phase et le délai sous verrou avant toute écriture. Les retries sont bornés aux conflits sérialisables `P2034` et aux seuls `P2028` d’acquisition de transaction ; `maxWait` d’acquisition et timeout de transaction restent distincts. Une indisponibilité transitoire est une erreur technique reprise, jamais une annulation métier arbitraire.

Les mutations sérialisées ne déclenchent plus un rattrapage de bots préalable : Quitter et Annuler peuvent acquérir directement le verrou et appliquer leurs validations atomiques. Les lectures live chargent participants et spectateurs, mais ni historique d’événements ni récompenses ; le dernier résultat complet n’est chargé qu’en l’absence de Concours actif. La liste d’historique utilise une projection de résumé, tandis que le détail seul charge les événements nécessaires. Les contrôles d’ancien participant et d’idempotence sont conservés par des requêtes ciblées.

## Vertical backend physique candidat 0.96 — détail Collection

`GET /api/v1/me/inventory` reste la projection légère de grille. La route authentifiée `GET /api/v1/me/inventory/items/:itemId?page=N` résout le Player courant, charge une définition active et son unique `PlayerItem`, puis lit uniquement les acquisitions de ce Player par pages de vingt. Elle ne somme pas le ledger et ne remplace jamais `PlayerItem.quantity`. Le catalogue Collection et `item_acquisitions` sont privés côté base : RLS active, aucun droit navigateur, accès uniquement via Fastify → service d’application → store Prisma.

## Vertical backend physique candidat 0.97 — Codes cadeaux

`GiftCodeService` est l’unique orchestration native des Codes. `GET /api/v1/me/gift-codes` matérialise si nécessaire l’édition annuelle du mois Europe/Paris, réconcilie les notifications de ce Player et projette `available` / `claimed`. `POST /api/v1/me/gift-codes/:editionId/claim` exécute sous isolation sérialisable et verrou Player : validation de fenêtre/statut, unicité Player/édition, `BusinessOperation`, crédits `PrismaEconomyService`, mouvements/statistiques et résolution de notification. Les collisions uniques ou sérialisables ont un retry borné ; un replay connu retourne l’opération déjà traitée sans second crédit.

Le scheduler Codes réconcilie les passages de fenêtres chaque minute et au démarrage ; il attend la fin d’une exécution avant d’armer la suivante, borne explicitement la concurrence à quatre Players par groupe et journalise une erreur avant de reprendre au tick suivant. Ce cap réduit la pression de connexions au boot tout en conservant le rattrapage par lecture personnelle. La lecture Notifications garde ce fallback par Player, couvrant un nouveau joueur ou une reprise après indisponibilité du scheduler. Une notification est dédupliquée par Player/édition et son `actionTargetId` est l’édition. Une expiration, désactivation ou claim la fait passer à `RESOLVED`. La réconciliation acquiert `FOR SHARE` sur les définitions encore publiées pendant sa décision : ce verrou de ligne bloque le `FOR UPDATE` de la mutation de statut, contrairement à `FOR KEY SHARE` qui autoriserait un `UPDATE` sans changement de clé. Une désactivation concurrente passe donc avant la lecture ou après la projection, résout dans sa transaction les notifications de toutes les éditions du seul code concerné et ne peut pas être suivie d’une résurrection obsolète.

Les routes `/api/v1/moderation/gift-codes/**` délèguent au même service mais celui-ci exige une attribution ADMIN active avant toute projection. La liste des codes applique recherche, filtres de statut/type/disponibilité annuelle, tri déterministe et pagination PostgreSQL de vingt avant hydratation de la page. Les récupérations appliquent elles aussi recherche pseudo, filtre édition, total réel, tri date décroissante stable et pagination serveur de vingt, sans exposer email ni identité Auth.

Création, publication et modification contrôlée sont des opérations ADMIN idempotentes et auditables. Avant le premier claim, token, type, récurrence/période et récompenses sont modifiables selon R687 ; après le premier claim, identité/token/type/récompenses sont verrouillés et seuls les champs expressément autorisés par R687 restent éditables. Une mutation retourne seulement le snapshot du code affecté : elle ne parcourt plus tous les Players et ne recharge pas un catalogue complet. Publication/réactivation matérialisent uniquement l’édition annuelle concernée ; la diffusion restante appartient au scheduler suivi et à la réconciliation lors de la lecture du Player. Le frontend ne reçoit aucun accès direct aux tables RLS privées.

## Vertical backend physique candidat Event Lot 1

`EventService` est l’unique orchestration des fondations mensuelles. Il reçoit une horloge injectable, dérive la business date et les deux débuts de mois en `Europe/Paris`, sélectionne la définition active par mois puis récupère ou upsert l’édition unique définition/année. La définition est data-driven ; aucune branche métier propre à septembre ou à un autre Festival n’existe. À la création, le snapshot d’édition fige l’identité et la configuration utiles ; toute projection ultérieure de cette édition relit et valide ce snapshot plutôt que la définition mutable. L’identifiant de définition reste, lui, propriétaire de la balance saisonnière durable.

`GET /api/v1/me/event` résout le Player authentifié et projette Festival, édition, participation et balance du seul Player courant, y compris avant inscription. `POST /api/v1/me/event/join` accepte uniquement une clé d’idempotence UUID. Sous isolation `SERIALIZABLE`, le service verrouille le Player, vérifie la `BusinessOperation`, partage le verrou de l’édition et crée au plus une participation `(eventEditionId, playerId)`. Seule cette création incrémente la balance `(playerId, eventDefinitionId)` de un ; une nouvelle intention après inscription et deux intentions concurrentes restent sans second crédit. Le replay d’une intention réussie restitue la même opération.

Le frontend charge le snapshot au bootstrap, le rafraîchit à chaque entrée dans `Activités > Événement` et remplace immédiatement son état par la réponse du join. Aucun full bootstrap, notification Event, scheduler, jeu, boutique, classement, calendrier ou canal chat/Twitch n’est introduit dans ce lot.

## Vertical backend physique candidat Event Lot 2 — Jeu A

`EventService` étend la même orchestration avec un moteur Jeu A commun aux douze Festivals et une source aléatoire injectable. L’habillage est une configuration immutable versionnée indexée par la clé de Festival déjà figée dans `EventEdition.snapshot` ; aucune branche mensuelle de gameplay ni relecture d’une définition mutable ne modifie une édition existante.

Pour un Player inscrit, le GET ou le join matérialise paresseusement sous transaction `SERIALIZABLE` et verrou Player un unique `EventDailyPlayerState` par édition et business date. Le JSON typé version 1 persiste trois fenêtres de 60 minutes dont les débuts sont choisis uniformément à la minute dans `07:00–11:00`, `12:00–17:00` et `18:00–22:00`. Les timestamps projetés sont dérivés avec les helpers `Europe/Paris` et les fenêtres suivent exactement `[start, end[`. Un GET antérieur à l’inscription ne fabrique aucune fausse configuration personnelle.

`POST /api/v1/me/event/game-a/attempt` accepte uniquement `idempotencyKey`. La transaction verrouille d’abord le Player, vérifie le replay `BusinessOperation`, prend un verrou partagé sur l’édition puis verrouille l’état quotidien. Elle arbitre inscription, fenêtre active, succès déjà acquis et cooldown de trois secondes avant tout RNG. Une tentative valide consomme exactement un tirage ; les valeurs 0 à 19 sur 100 réussissent. Les refus et replays ne consomment aucun nouveau tirage.

Un échec incrémente `gameAAttempts` et met à jour `gameALastAttemptAt`. La première réussite quotidienne effectue dans la même transaction ces écritures, `gameASuccess = true`, `EventParticipant.points + 1`, la balance saisonnière `amount + 1` et la complétion de l’opération. Le verrou quotidien empêche deux clés concurrentes de contourner cooldown ou réussite ; une même clé rejouée rend le résumé de l’intention initiale sans reroll ni double crédit. Aucun palier n’est payé : un futur service de paliers traitera idempotemment les points déjà atteints.

La projection personnelle expose thème, fenêtres `PAST | ACTIVE | FUTURE`, index actif, tentatives, succès, possibilité d’essai et cooldown restant. Elle expose aussi `refreshAfterMs`, calculé depuis `now` serveur vers la plus proche frontière métier future : fin du cooldown, début de la prochaine fenêtre, fin de la fenêtre active ou prochain reset de business date `Europe/Paris`. Le reset reste toujours candidat, y compris après réussite ou avant inscription, afin de réconcilier automatiquement un nouveau jour ou mois.

`AppBootstrap` est l’unique propriétaire du timer temporel Event parce que son snapshot alimente à la fois Event et Quotidiennes. Il attend le délai serveur depuis la réception, ajoute une marge courte, recharge `GET /api/v1/me/event`, puis publie la nouvelle projection. Le remplacement du snapshot et le changement de session nettoient l’ancien timer. `EventScreen` conserve son refresh d’entrée mais aucun timer cooldown concurrent ; le navigateur ne recalcule jamais l’échéance depuis `Date.now()` et seul le serveur autorise une nouvelle tentative. Le Lot 2 n’ajoutait ni polling constant, ni scheduler serveur, Jeu B/C, R602, Boutique, Collection, Classement, Calendrier, notification Event ou canal chat/Twitch ; le Lot 3 Jeu B et son polling léger sont décrits ci-dessous.

## Vertical backend physique candidat Event Lot 3 — Jeu B

Le même `EventService` matérialise paresseusement une seule ligne `EventGameBDailyState` par édition/date avant les transactions Player. Deux premières lectures concurrentes utilisent l'unicité physique ; les collisions de création de l'édition ou de la ligne Jeu B relisent la ligne gagnante sans reroll durable. La solution est générée par `RandomSource` injectable parmi 32 codes cinq bits et n'est jamais incluse dans le DTO. Les combinaisons restantes sont dérivées du catalogue déterministe moins `testedCodes` ; l'état personnel lit uniquement `event_daily_player_states.game_b_attempts_used`.

`POST /api/v1/me/event/game-b/attempt` valide strictement code et UUID. La transaction sérialisable prend le verrou de la ligne globale avant celui du Player ; le join suit le même ordre afin qu'une inscription concurrente de la résolution reçoive soit le paiement collectif, soit le rattrapage, jamais zéro ni deux fois. Une combinaison globalement testée ne consomme rien. Une nouvelle combinaison consomme un des trois essais personnels et rejoint `testedCodes`. Le premier code correct marque la ligne résolue, mémorise le découvreur et crédite dans la même transaction chaque participant inscrit de +1 point et +1 monnaie, sans bonus propre au découvreur. `BusinessOperation` rend le replay d'une même clé/code sans effet additionnel et rejette les autres intentions.

`AppBootstrap` conserve le timer métier `refreshAfterMs` pour le passage de business date et les fenêtres Jeu A. L'écran Event recharge à l'entrée, à l'ouverture de Jeu B, au retour focus/visibilité et, tant que la surface Jeux est ouverte et Jeu B non résolu, toutes les 30 secondes. Ce polling borné sert uniquement à découvrir l'action d'un autre Player ; il ne remplace ni le reset serveur ni l'autorité du GET. Aucun Realtime, scheduler ou autre domaine Event n'est ajouté.

Le correctif de review client ajoute un coordinateur Event distinct de celui du Concours. Le chargement initial peut dédupliquer les lectures ordinaires ; les refreshs explicites ouvrent une révision plus récente et invalident les réponses antérieures. Les mutations `join`, Jeu A et Jeu B invalident les GET en vol avant de publier leur résultat autoritatif ; chaque appelant reçoit néanmoins son résultat réel même si sa publication est écartée. Le changement de session réinitialise la génération et les réponses d'une ancienne session ne publient plus. Une protection supplémentaire refuse de revenir à une business date ou édition antérieure, ainsi qu'à un état non résolu/non inscrit/non réussi après un état confirmé dans la même frontière. Côté écran, le changement de business date efface sélection, intention ambiguë et feedback Jeu B sans imposer de quitter Grenier ; une nouvelle édition revient sur Inscription. Aucun intervalle supplémentaire n'est ajouté.

## Vertical backend physique Event Lot 4 — Jeu C

`GET /api/v1/me/event/game-c/recipients` recherche des Players éligibles par pseudo avec pagination serveur de dix, dès l'ouverture du navigateur ou le premier caractère, avec filtre Élément et tri Nom/Niveau dans les deux sens, sans exposer de cible arbitraire non résolue. Le prédicat Social partagé vérifie statut `ACTIVE`, blocages dans les deux sens et permission MP `PUBLIC | FRIENDS | PRIVATE` contre une amitié active. L'envoi reçoit exclusivement le Player ID sélectionné, un texte nettoyé borné techniquement à 500 caractères et une clé UUID ; cette limite reprend la taille des descriptions joueur déjà acceptées par l'API, sans créer une règle produit.

`POST /api/v1/me/event/game-c/send` effectue une transaction sérialisable. Il verrouille expéditeur et destinataire dans l'ordre des UUID, revérifie contact/participation/quota et crée `BusinessOperation`, message privé Event, `gameCSent`, +1 point et +1 monnaie pour le seul expéditeur. Une tentative rejetée rollbacke sans consommer l'action. Le replay d'une même intention est sans second effet, tandis qu'un autre destinataire/texte/édition/date avec la même clé est un conflit. `GET /api/v1/me/event` projette uniquement l'inbox personnelle du jour du Player authentifié ; `POST .../messages/consult` est l'unique mutation de consultation. Aucun GET ne marque les messages consultés et aucune livraison chat/Twitch n'est implémentée.

`EventMessageNotificationReconciler` réutilise `NotificationService` : la source de vérité est le nombre de `event_social_messages` courants dont `viewed_at IS NULL`. L'envoi met à jour dans sa transaction un agrégat unique `EVENT_MESSAGES_PENDING` dédupliqué par destinataire, édition et business date ; le verrou Player du destinataire empêche deux envois de créer deux notifications. La consultation Panier marque les messages puis résout l'agrégat (`RESOLVED`, `resolvedAt` renseigné, sans `archivedAt`) sous le même verrou. Un nouvel envoi réactive ce dernier en `UNREAD` avec compteur mis à jour. `READ` reste un état visuel et n'invente aucune consultation. Le GET Notifications réconcilie un archivage manuel ou un rollover de journée : une cause métier disparue devient `RESOLVED`, tandis que `ARCHIVED` reste une action volontaire de l'utilisateur. Le header réutilise son refresh existant et `OPEN_EVENT_MESSAGES` transporte une destination typée vers Panier, sans texte libre, Realtime ou polling supplémentaire.

Le header interroge uniquement `GET /api/v1/me/notifications` par une boucle de 3 secondes après la fin de chaque requête, lorsque l'onglet est visible. Focus et retour de visibilité provoquent un refresh immédiat, sans requêtes superposées ; le changement de session et le démontage annulent la boucle. Ce GET conserve les réconciliations nécessaires dans `NotificationService`, notamment Expedition, Codes et messages Event, sans charger les snapshots UI complets Boss ou Expedition côté frontend à chaque tick. Leurs refresh métier restent à la demande ou à leurs échéances propres. Ce polling visible-only est la solution alpha/V1 actuelle ; une montée en charge justifierait un mécanisme push plutôt qu'une cadence encore plus rapide.

## Vertical backend physique candidat Event Lot 5 — bonus quotidien et paliers

`POST /api/v1/me/event/daily-bonus/claim` utilise la même frontière transactionnelle et idempotente que les jeux Event. Il verrouille le Player, constate l'édition et la business date côté serveur, réclame `event_daily_player_states.daily_bonus_claimed` une seule fois et crédite +1 sur le solde du Festival concerné. Le GET Event ne réalise aucun claim implicite ; il projette disponibilité et état réclamé pour le bouton Event et l'agrégateur Quotidiennes.

La fonction commune d'attribution des points Event est appelée par la réussite Jeu A, la résolution collective Jeu B, le rattrapage Jeu B lors de l'inscription et l'envoi Jeu C. Elle met à jour les points, calcule les seuils 10–80 nouvellement franchis et crée pour chacun une `EventMilestoneClaim` et une `BusinessOperation` système dans la même transaction sérialisable. Les récompenses standard utilisent `PrismaEconomyService` ; les balances saisonnières et les particules restent attribuées côté serveur. Le snapshot Event projette les claims et les ressources pour afficher immédiatement le résultat dans Event et dans le shell. La migration additive 024 matérialise les claims, sans job de backfill ni migration des données legacy.

## Vertical backend physique candidat Event Lot 6 — Boutique

`GET /api/v1/me/event` expose le solde saisonnier durable `PlayerEventCurrencyBalance` et les trois offres Shop de l'édition courante, même avant inscription. Les mutations `POST /api/v1/me/event/shop/convert` et `/shop/collection` exigent une participation réelle. Une transaction sérialisable verrouille le Player puis sa balance saisonnière, valide la quantité positive et le solde, débite la monnaie et complète une `BusinessOperation` idempotente. Une même clé et une même intention ne débitent jamais deux fois ; une intention différente provoque un conflit. Le taux est immuable : une monnaie Event vaut 160 Primogemmes ou 20 000 Moras. Le crédit standard passe exclusivement par `PrismaEconomyService`, avec `ResourceMovement`, puis la projection Event republie les ressources de la sidebar.

L'achat Collection coûte 80 monnaies et ajoute un exemplaire à `PlayerItem`, une ligne au ledger `ItemAcquisition` et la garde durable `EventCollectionAcquisition` dans la même transaction. Sa clé primaire édition + Player empêche un second achat annuel même en concurrence ; une autre édition annuelle peut ajouter un exemplaire au stock permanent. Les clés de présentation gelées dans `EventEdition.snapshot` sont mappées explicitement aux douze clés du catalogue Collection existant. Le Sac réutilise son API autoritative et son cache est invalidé après un achat confirmé. La migration 025 n'ajoute que la garde d'unicité, sans deuxième inventaire ni backfill.

## Échanges de particules — état physique 031

`TradeService` possède création, acceptation, refus, annulation, actions groupées, snapshot et découverte ; les futurs transports UI/chat/Twitch utilisent ce même service. Les partenaires ne sont pas limités aux amis : ACTIVE, élément choisi différent, aucune PENDING sur la paire, blocages bidirectionnels absents et maximum positif. La découverte groupe soldes et réservations, normalise pseudo accents/casse, filtre avant pagination serveur de dix.

Les mutations et projections cohérentes utilisent SERIALIZABLE avec retry borné des collisions, verrou advisory `particles:trades`, Players verrouillés dans l'ordre UUID et soldes verrouillés dans un ordre Player/ressource déterministe. Les producteurs économiques existants conservent leurs transactions sérialisables ; les dépendances de réservation sont lues dans la même transaction. BusinessOperation possède les intentions et résultats : contrôle acteur/type/cible/montant/canal, replay sans activité ni nouvelle exécution. L'unicité SQL PENDING de la paire non orientée et celle de TradeExecution constituent des gardes supplémentaires.

`PrismaEconomyService` reste le propriétaire des soldes : toute consommation de particules compare total moins SUM(currentAmount des PENDING envoyées). Sa primitive `exchangeParticlesWithoutStats` réalise quatre ResourceMovement et aucun compteur Earned/Spent. La demande acceptée libère sa réservation dans cette transaction avant le transfert ; le rollback rétablit tout. L'ajustement Modération réutilise `adjustWithoutStats`, conserve sa neutralité statistique et respecte les mêmes disponibilités. Aucun domaine ne modifie désormais directement PlayerResourceBalance hors de ce moteur.

`trade-state` réconcilie immédiatement les demandes affectées après mutation de particules, y compris une nouvelle réservation. Le montant ne peut que diminuer ; zéro conserve CANCELLED et résout l'agrégat, sans notification individuelle. Chaque incoming compare indépendamment le stock disponible du destinataire, qui n'est jamais réservé indirectement. Accepter tout fige les IDs initiaux oldest-first dans une BusinessOperation et traite chaque demande en transaction indépendante avec une sous-clé stable. Un refus métier n'empêche pas les suivantes ; une erreur d'infrastructure laisse l'opération globale rejouable après traitement des autres demandes. Refuser tout partage cette stratégie.

`TradeScheduler` est branché au lifecycle réel : rattrapage au démarrage, prochain minuit Europe/Paris calculé par le calendrier métier existant (23/25 heures au DST), retry après 30 secondes en cas d'échec et arrêt sans replanification. `expiresAt` permet le catch-up de plusieurs jours et le fallback transactionnel au premier accès/mutation. Réduction et expiration n'enregistrent pas d'activité. `PlayerActivityRecorder` ne reçoit que l'acteur d'une vraie mutation ; les participants passifs, GET, polling et replays sont exclus.

Une seule Notification `trades / TRADES_PENDING`, clé `trades:pending:<recipient>`, porte le compteur courant et OPEN_TRADES. Une nouvelle demande réactive UNREAD, même après lecture/archive ; les autres changements préservent lecture/archive et actualisent le compteur. Zéro devient RESOLVED. La même infrastructure générique porte aussi TRADE_ACCEPTED (R24 révisée) : notification UNREAD à l'expéditeur, créée dans la transaction SERIALIZABLE après les quatre transferts et TradeExecution, dédupliquée par `trade-accepted:<requestId>`. Payload : requestId, accepterPlayerId/displayName, amount string, senderResourceKey, recipientResourceKey ; action OPEN_TRADES_HISTORY. Rollback annule toutes les écritures ; les replays sortent avant création. Accepter tout réutilise cette primitive, sans notification pour UNAVAILABLE. Aucun changement de schéma.

API authentifiée, Player résolu depuis l'identité, bigint en chaînes et Cache-Control no-store :

- GET `/api/v1/me/trades` : stocks Total/Réservé/Disponible, reçues/envoyées, 25 dernières exécutions ;
- GET `/api/v1/me/trades/partners?q=&page=` : partenaires réalisables ;
- POST `/api/v1/me/trades` : recipientPlayerId, amount, idempotencyKey ;
- POST `/api/v1/me/trades/:requestId/accept|refuse|cancel` ;
- POST `/api/v1/me/trades/accept-all|refuse-all`.

`useTrades` ne poll le snapshot que sur la surface visible (trois secondes après la lecture), recharge au focus/retour visible, sérialise ses refreshs et invalide les réponses antérieures à une mutation/sortie. Les partenaires ont une lecture séparée, limitée à leur onglet et debounced à 120 ms. Dès le changement de saisie, avant même la fin du debounce, une nouvelle intention annule la requête précédente par `AbortController` puis part sans attendre sa fin ; seule l'intention latest-wins peut publier. Une annulation volontaire reste silencieuse. Une mutation confirmée annule et invalide toute lecture partenaires antérieure, puis demande une projection fraîche seulement si Partenaires est actif. Le polling/focus partenaires à quinze secondes ne concurrence ni une recherche active ni son debounce et la sortie annule la lecture utile devenue obsolète. Une intention ambiguë conserve sa clé et un bouton de retry, même si le partenaire disparaît entre-temps. Un succès confirmé libère le pending avant la synchronisation ; une erreur de snapshot reste distincte du résultat métier et ne crée aucun replay. Le snapshot publié met à jour les particules globales et le cache Sac avec révision anti-stale, sans GET Resources post-mutation redondant. Aucun Realtime ni infrastructure payante.

Sur Partenaires uniquement, focus/retour visible et un polling de quinze secondes entretiennent l'éligibilité multi-client, sans lancer de nouvelle lecture pendant une requête ou mutation en cours. La projection serveur des stocks lit les soldes une fois et groupe les réservations PENDING par ressource en une requête, au lieu de relire solde et agrégat pour chaque élément : treize requêtes en moins pour sept éléments. Les verrous, transactions et règles économiques restent identiques. Les envois de cœurs conservent leur transaction existante ; Resources et Amitié sont synchronisés en arrière-plan après confirmation. Notifications coalesce ses lectures côté bootstrap et poll toutes les quinze secondes panneau fermé, trois secondes ouvert ; aucun timeout serveur n'a été augmenté.

## Social Foundations

Batch B implémente `SocialService`, `PrivacyService` et `PresenceService`. Toutes les routes suivantes exigent une identité authentifiée résolue en Player ACTIVE ; les écritures `/me` ne prennent jamais un Player propriétaire fourni par le client. Les réponses Social portent `Cache-Control: no-store`.

| Route | Contrat physique |
| --- | --- |
| `GET /api/v1/players` | Annuaire ACTIVE ; `q` normalisé accents/casse, filtre `element`, `page`, vingt résultats par page, ordre alphabétique stable. |
| `GET /api/v1/players/:playerId/profile` | Identité, présence autorisée, dernière activité autorisée et sections avec accès `ALLOWED`/`PRIVATE`. |
| `GET /api/v1/social/presence` | Liste et compteur des Players En ligne/Absent visibles pour le lecteur. Une présence masquée est omise, jamais inventée Hors ligne. |
| `GET /api/v1/me/privacy`, `PATCH /api/v1/me/privacy` | Matrice effective ; écriture d'une seule catégorie/niveau validés strictement. |
| `POST /api/v1/me/presence/session`, `POST /api/v1/me/presence/heartbeat` | Clé UUID d'onglet et booléen d'activité ; temps autoritaire serveur. |
| `DELETE /api/v1/me/presence/session` | Fin idempotente de cette session, y compris avant l'arrivée réseau de son start. |

L'annuaire charge les seules identités/progressions ACTIVE, normalise la recherche et lit les présences autorisées en requêtes groupées. Depuis Batch C, le filtre `status` s'applique avant la pagination serveur de vingt. Ce choix simple convient à l'alpha d'environ cent Players ; l'ensemble des identités est encore trié en mémoire serveur. La liste connectée groupe elle aussi permissions et sessions, sans requête par Player. Aucun snapshot de gameplay complet n'est chargé pour ces deux listes.

Le Profil vérifie chaque permission **avant** la lecture du domaine. `PRIVATE` ne contient aucune donnée cachée. La Team lit la formation active sans provisioning ni nettoyage ; la Box utilise une projection dédiée des possessions, sans favoris/Stella/préférences personnelles ni lecture de `C6CompetitionProgress` ou de statistiques Concours détaillées. La Collection filtre les définitions puis lit uniquement les balances Collection, sans Sac ni monnaie. Les statistiques sélectionnent les agrégats physiques disponibles (XP, tirages/raretés, victoires Combat, expéditions terminées) ; une donnée absente reste indisponible. Aucun GET public ne modifie la cible.

La politique version 1 complète les lignes absentes sans seed ni reset : PUBLIC pour Team active, Box, Collection, statistiques générales, Missions, dernière activité, pity/garantie, réception MP et présence ; FRIENDS pour liste d'amis ; PRIVATE pour monnaies, Banque, Sac, presets Team, expédition active, Combat quotidien, état Boss et historique détaillé. Les overrides existants restent prioritaires. Le propriétaire voit ses données ; FRIENDS exige une amitié ACTIVE dans les relations canoniques existantes. Les blocages dans les deux sens masquent présence, dernière activité et réception MP. Le contrôle Event Game C existant reste conservé. Les catégories sans projection actuelle sont réglables et persistées pour leurs futurs consommateurs ; cela ne crée pas ces domaines.

La migration additive 028 matérialise `PlayerSession` et `PlayerActivityState`, protégées par RLS et sans grants PUBLIC/anon/authenticated. La clé UUID propre au montage d'onglet est stockée en sessionStorage et hachée avec le Player côté serveur ; elle ne remplace pas l'authentification. Le client envoie un heartbeat toutes les 45 s et regroupe les interactions réelles toutes les 15 s. Un heartbeat seul n'avance pas l'activité. Le serveur sérialise start/heartbeat/end et agrégat par verrou transactionnel Player. Une session close reste close ; un tombstone empêche sa résurrection par un start en vol.

Une session est En ligne avant dix minutes d'inactivité, Absente ensuite et Hors ligne à deux heures sans activité. Trois minutes sans heartbeat ou une fermeture explicite la rendent aussi Hors ligne. Les sessions vivantes s'agrègent : une session active suffit pour En ligne ; terminer un onglet ne ferme pas les autres. L'activité application durable est distincte des champs Chat/Twitch/gameplay. Fermeture pagehide et logout sont best-effort ; le timeout couvre une fermeture brutale. Les lectures automatiques ne sont pas des activités utilisateur.

Le panneau connecté et son compteur partagent un polling HTTP visible-only de 30 s, sans chevauchement ; l'annuaire rafraîchit sa page ouverte. Ce choix réutilise le backend et ne requiert ni service payant ni Realtime supplémentaire. Les erreurs de transport sont affichées distinctement d'une liste vide. Batch C complète Amitié ci-dessous ; l'UI MP, Twitch réel, avatars/titres déblocables et Historique global restent différés.

## Messages privés — fondations serveur 036

`DirectMessageService` est l'unique propriétaire du cycle MP. Il résout l'acteur authentifié, sérialise les mutations avec le verrou Social puis les Players dans l'ordre UUID, applique `PrivacyService`/`Friendship`/`PlayerBlock`, journalise les intentions rejouables dans `BusinessOperation` et enregistre l'activité réelle via `PlayerActivityRecorder`. Le blocage appelle la primitive Social partagée, archive une amitié active et fige l'archive physique des deux participants. La primitive partagée de déblocage retire uniquement le blocage posé par l'acteur : elle ne réactive ni l'amitié ni les archives. Aucun état Event Game C n'est réutilisé ou modifié.

Les routes no-store `/api/v1/me/direct-conversations` couvrent liste normale/archivée, initiation, pages de messages, envoi, acceptation, refus, blocage/déblocage, non-lus, lecture monotone, accusés et archivage personnel. Elles n'acceptent jamais l'auteur depuis le navigateur. La projection `canSend` réutilise le prédicat serveur de permission et reste neutre sur sa cause ; `blockedByMe` permet seulement à l'acteur de retirer son propre blocage. La projection normale reste limitée aux 500 derniers messages de chaque conversation selon `submissionOrder`; les curseurs plus anciens sont refusés sans supprimer les lignes. Le même ordre réservé avant transaction gouverne non-lus, curseurs interne/partagé, accusés, dernier message et liste ; une transaction A tardive reprend sa place avant B sans attente. Le timestamp partagé avance uniquement lorsqu'un nouveau curseur interne est accepté et que les accusés sont actifs. Les MP ne reçoivent aucun pacing 750 ms/rafale et gardent leur protection dix envois sur dix secondes.

R898 étend uniquement le POST d'une conversation existante avec `replyToMessageId` nullable. `DirectMessageService` vérifie dans la transaction que la cible UUID est persistante, active, non purgée et dans la même conversation, inclut son ID dans l'empreinte idempotente puis ne persiste que l'auto-relation. Initiation reste sans réponse. Le même include Prisma alimente dernier message de liste, fil récent, historique et recherche ; `replyPreview` est calculé depuis la cible actuelle, ou vaut `Message supprimé`. Les overlays frontend propagent immédiatement édition/suppression/restauration d'une cible à toutes les réponses déjà en cache. L'optimistic transporte relation et aperçu. Le composer restaure brouillon/réponse uniquement si la génération de session et les révisions de saisie/réponse correspondent toujours à l'envoi ; un échec devenu tardif reste récupérable explicitement dans sa conversation d'origine avec sa clé de retry. Une initiation tardive ne change plus la conversation sélectionnée après sortie du parcours. Dans une conversation existante, l'envoi actif libère le composer et son focus dès le départ ; une seule intention suivante est figée dans le composer grisé, sans optimistic ni POST concurrent. Son UUID, son contenu et sa cible de réponse sont capturés à Entrée puis conservés jusqu'à sa promotion après succès ; les actions Répondre sont désactivées pendant l'attente et la primitive de sélection refuse aussi tout changement indirect. Sur échec, l'intention attendue redevient un brouillon éditable et l'envoi échoué reste récupérable avec sa clé ; quitter la session empêche toute promotion tardive et garde la récupération dans la conversation d'origine. Le focus/caret n'est rendu que si génération, vue, conversation, visibilité, capacité d'écriture et focus volontaire restent compatibles. Sur mobile, le panneau MP dispose d'une hauteur explicite liée au viewport dynamique, tandis que la liste reste propriétaire du scroll vertical et le composer reste hors de ce scroll ; le scroll initial du fil live attend la page récente chargée, sans consommer l'intention sur le seul dernier message prérempli depuis la liste.

R515 ajoute trois GET no-store participant-only : `/history` accepte une seule direction `beforeOrder`, `afterOrder` ou `aroundOrder`, limite 1..100 et défaut 50 ; `/history/search` accepte `q`, `limit` et un curseur d'ordre ; `/history/date` accepte un timestamp ISO. Le premier renvoie les lignes en `submissionOrder ASC` avec `olderCursor`/`newerCursor`; la recherche exécute en PostgreSQL une sous-chaîne case-insensitive strictement bornée à la conversation avec `deletedAt = null` et `content != null`, puis trie DESC ; la date choisit côté PostgreSQL le premier instant supérieur/égal, ou le dernier antérieur. Aucun de ces chemins n'appelle `markRead`, n'écrit une activité, n'exige `canSend` et n'ouvre d'accès tiers/admin. La borne de restauration est lue une fois par réponse et produit `canRestore` sans projeter le contenu d'un tombstone.

Le frontend porte un propriétaire `useDirectMessages` dans le panneau `Chat | MP`, sans nouvelle route de navigation. Il maintient listes normale/archivée, fil sélectionné, pages, non-lus, invalidations de mutation et révisions anti-réponse obsolète. Les lectures liste/fil/non-lus et mutations sont sérialisées par catégorie ; le retry d'envoi conserve sa clé UUID et son brouillon. Le polling HTTP est de 500 ms start-to-start pour un fil actif, 1 250 ms pour la liste MP active et 5 s pour les seuls badges lorsque Chat est actif, Historique ouvert ou panneau replié, avec reprise immédiate au focus/retour visible. Ouvrir seulement l'onglet MP ne marque rien lu ; seule une conversation live ouverte et positionnée au récent avance son curseur. `useDirectMessageHistory` est un propriétaire séparé, éphémère et isolé par Player/conversation : pages keyset sans polling, prepend avec conservation d'ancre, recherche 200 ms physiquement sérialisée/latest-wins, jump autour d'un ordre et mutation optimistic/revalidation par les mêmes routes edit/delete/restore. Pendant cette vue, le propriétaire live passe à son polling léger de non-lus et conserve son cache, scroll et draft. Aucun `!mp`, pont Twitch, Realtime, WebSocket ou SSE.

### Signalement MP — état final validé publiquement — R509/R510/R517

`DirectMessageReportService` possède les deux routes participant-only `report-preview`/`report` et les trois routes `MODERATOR|ADMIN` liste/détail/suppression. Un seul constructeur produit la preuve complète cible + contexte 10/1/10, masque les tombstones, projette et fige aussi les métadonnées de réponse, puis calcule le SHA-256 du JSON exact ; le GET joueur en projette séparément seulement le voisin immédiat précédent, la cible et le voisin immédiat suivant. Le POST reconstruit la preuve complète dans `SERIALIZABLE`, refuse un fingerprint obsolète en 409, persiste les snapshots 21 lignes maximum et déduplique par reporter/message. Il n'appelle ni Notification, ni lecture, ni blocage, ni archivage.

La frontière de modération est volontairement étroite : liste par vingt, détail et `DELETE /api/v1/moderation/direct-message-reports/:reportId` adressés uniquement par `reportId`, depuis `direct_message_reports`. La suppression transactionnelle retire le seul dossier et écrit une `BusinessOperation`/`AdminAuditEntry` sans message ni `contextSnapshot` : acteur, reportId, Player signalé, action et timestamp seulement. Aucune route ne reçoit un `conversationId`, ne relit `direct_messages` pour le détail ou ne propose recherche/extension de contexte. `communityModeration` vaut vrai seulement pour MODERATOR/ADMIN et élargit `moderationAccess` sans accorder les outils Ressources/XP/Gacha/Stella/Testeur/Codes.

## Amitié et activité Player — Batch C

`FriendshipService`, composé par `SocialService`, possède demandes, transitions, relations, cœurs, statistiques sociales et projection personnelle. Les futurs adaptateurs chat/Twitch peuvent appeler ses mêmes méthodes avec un canal joueur explicite ; aucun transport supplémentaire n'est implémenté. SYSTEM/ADMIN/MIGRATION ne sont pas des sources admises pour ces actions.

| Route authentifiée | Responsabilité |
| --- | --- |
| `GET /api/v1/me/friends` | Amis ACTIVE, demandes reçues/envoyées, identités et présences autorisées, palier, disponibilité du cœur et résumé Quotidiennes. |
| `POST /api/v1/me/friends/actions` | `ADD`, `ACCEPT`, `REFUSE`, `CANCEL`, `REMOVE` ; cible et clé UUID, demande explicite pour une résolution. Auteur résolu côté serveur. |
| `POST /api/v1/me/friends/hearts` | Cible UUID ou `all`, clé UUID ; résultat compact et gains exacts. |
| `PATCH /api/v1/me/friends/sort` | Préférence `friend_sort_v1` dans `player_preferences`, sans autre table. |
| `GET /api/v1/players` | Ajoute `status=ONLINE/AWAY/OFFLINE`, appliqué **avant** pagination de vingt ; statut privé exclu d'un filtre précis, toujours distinct de Hors ligne. État relationnel personnel joint par requêtes groupées. |

Toutes ces réponses portent `Cache-Control: no-store`. L'alpha utilise des lectures groupées simples ; aucun appel par ami pour résoudre identité/présence. `useFriendships` partage la projection entre Social et Quotidiennes et invalide les anciennes lectures pendant une mutation. Une erreur garde le dernier état confirmé et la clé d'intention ambiguë ; succès puis refresh synchronisent amis, demandes, annuaire et disponibilité Quotidiennes. Le shell est propre à l'identité Player ; l'envoi recharge également les ressources du shell.

Les mutations utilisent `SERIALIZABLE`, retry borné, un verrou advisory transactionnel Social puis les lignes Player dans l'ordre croissant des UUID. Cette stratégie volontairement simple convient à l'alpha ; les autres domaines coordonnent leurs crédits via les verrous Player/solde existants. Les blocages sont revérifiés dans la transaction par le prédicat Social commun, sans imposer la permission MP aux demandes d'amitié. Une résolution concurrente ne peut gagner qu'une fois. Une demande inverse est acceptée, une relation archivée réactivée avec le même UUID et sans reset de ses compteurs.

L'envoi individuel et global suivent la même primitive. Chaque cœur possède sa propre `BusinessOperation` et deux mouvements Economy ; l'intention globale a son résultat persisté. Cœur, niveau plafonné, total commun, `PlayerSocialStats.totalFriendHeartsSent`, soldes et statistiques économiques sont atomiques. Les contraintes de 029 renforcent le verrou quotidien Europe/Paris, la paire des participants et l'unicité des demandes ouvertes. Les phrases individuelles R497 proviennent du catalogue legacy ; aucun tirage par ami dans l'envoi global. Aucune notification de cœur.

`PlayerActivityRecorder` est l'unique écrivain de `player_activity_state` pour les producteurs intégrés : interaction de présence réelle, Game C réussi, transitions Amitié effectives et cœur réellement envoyé. Ses catégories APPLICATION/GAMEPLAY/INTERNAL_CHAT/TWITCH réutilisent les colonnes physiques ; GAMEPLAY nourrit aussi la dernière activité application, TWITCH reste distinct. Les `GREATEST` préservent la monotonie des timestamps. L'écriture accompagne la transaction métier ; elle ne crée aucune opération à elle seule et ne modifie pas les sessions de présence. Replays, échecs, GET/polling, heartbeat technique, scheduler, destinataire/notification reçue et fin automatique d'Expédition n'appellent pas ce producteur. Les autres domaines pourront le réutiliser au fil de leurs intégrations explicites.

## Vertical backend physique candidat Event Lot 6 — Classement actif

`GET /api/v1/me/event/ranking` résout l'édition mensuelle active côté serveur puis lit uniquement dix `EventParticipant` au maximum avec pseudo public, points et rang. L'ordre est `points DESC, joinedAt ASC, playerId ASC` : les égalités restent stables, sans avantage économique. L'endpoint ne charge ni le snapshot personnel complet ni les états des Jeux et ne crée aucune opération, monnaie, récompense ou notification. Le client appelle ce GET à l'ouverture de l'onglet Classement, puis environ toutes les trois secondes uniquement tant que cet onglet est visible, avec garde anti-chevauchement, réveil focus/visibility et nettoyage au démontage. L'historique des éditions passées et l'écran Historique transversal sont reportés.

## Bootstrap frontend — lectures sûres et GET réconciliants

Le chargement authentifié conserve en parallèle Ressources, progression, Roue du jour, état de récompense quotidienne, état Gacha, catalogue de personnages et permissions. La voie réconciliante commence par Notifications. Ensuite, les opérations démontrées à faible conflit — Défi quotidien, Combat quotidien, Boss mensuel et Concours — s’exécutent en parallèle, tandis que la voie à verrou Player reste ordonnée : projection Expedition de fallback éventuelle, Teams, puis Event. Cette concurrence bornée évite à la fois la contention initiale et la somme de huit latences séquentielles.

Notifications reste un endpoint autonome et conserve toute sa chaîne métier : réconciliation Expedition, Codes cadeaux, messages Event, cycle de vie Event, archivage quotidien et snapshot. Il inclut désormais la projection Expedition obtenue par cette même réconciliation. Le bootstrap la réutilise et ne refait le GET Expedition qu’en fallback de compatibilité avec un backend plus ancien pendant un déploiement roulant. En interne, Expedition reste première ; Codes cadeaux peut ensuite s’exécuter en parallèle de la voie Event, mais messages Event et cycle de vie Event restent séquentiels car ils partagent le verrou Player. Aucun paramètre public de contournement, timeout augmenté ou perte d’autonomie des endpoints n’est introduit.

Chaque GET idempotent du bootstrap, y compris la résolution initiale du Player, accepte au plus une seconde tentative après une erreur réseau ou HTTP 5xx. Les 4xx métier/auth ne sont jamais retentées et un second échec reste visible comme erreur de bootstrap. La politique est locale au bootstrap : elle ne modifie ni les mutations ni les règles métier des endpoints.

## Missions permanentes — Lots 1 à 5 validés publiquement

`PermanentMissionService` est une primitive applicative transaction-local : initialisation, catch-up R301, réconciliation complète ou bornée et projection reçoivent toujours une `Prisma.TransactionClient` existante et n’ouvrent aucune transaction imbriquée. Le producteur conserve la transaction propriétaire de son action, puis appelle Missions après sa mutation autoritative et avant commit. La voie bornée ne lit que les agrégats demandés ; Gacha regroupe ainsi Pulls, possessions, C6 et gains économiques en un passage final au lieu d’un scan après chaque sous-récompense.

Le calcul est cumulatif par métrique : B, puis A, puis S sans reset. Une seule réconciliation peut franchir plusieurs rangs et plusieurs catégories. Après 27 B/A/S terminées, `zUnlockedAt` est écrit une fois et les quatre conditions Z sont évaluées immédiatement depuis les états persistés : personnages C6, relation niveau 1000, niveau Player 100 et victoires manuelles.

Chaque complétion crée une `BusinessOperation` `permanent-mission.reward` avec clé stable Player/external key, appelle `PrismaEconomyService.credit` pour les Primogemmes, finalise l’opération et lie `rewardOperationId` à la progression avant le commit de la transaction appelante. Le résultat durable porte trigger, canal et contexte `CURRENT_ACTION` ou `STANDALONE_CATCHUP`. Le crédit de récompense active une garde `skipPermanentMissions` strictement interne : il journalise normalement Economy mais ne réentre jamais dans le moteur Missions.

Le catch-up standalone verrouille le Player avant toute mutation courante. Si son marqueur est nul, il crée une opération `permanent-mission.standalone-catchup` SYSTEM, exécute la réconciliation complète et écrit le marqueur seulement après les récompenses, dans la même transaction. Le second appel ne lit pas le catalogue et ne paie rien ; concurrence et rollback restent sérialisés par le verrou Player. Les nouveaux Players reçoivent le marqueur lors de leur provisionnement. Aucun bulk de vrais Players n’est exécuté par la migration, les outils de développement ou le simple parcours d’un scheduler.

Les raccords promus des Lots 1/2 restent : Chat après `countedMessages + 1`, XP après persistance, Gacha après l’état final, Stella avec son canal UI/INTERNAL_CHAT réel, Economy seulement pour Moras et particules personnelles générées, Banque avant puis après un intérêt positif SYSTEM. Dans ce dernier cas, le scheduler appelle R301 au plus une fois, immédiatement avant le premier intérêt strictement positif de la séquence, puis réconcilie `MORAS_EARNED` sur la vraie opération `bank.interest` ; aucune journée à intérêt nul ni absence de journée à traiter ne déclenche R301. Les transferts internes, dépôts/retraits, échanges de particules, replays et refus n’avancent rien.

Le Lot 3 promu ajoute les producteurs restants sans nouveau schéma. `expedition.claim` exécute le catch-up avant récompense et compteur, crédite avec `skipPermanentMissions`, puis effectue une seule passe finale pour `EXPEDITIONS_COMPLETED` et l’éventuelle métrique Moras/particules ; start et claim portent le vrai canal UI ou INTERNAL_CHAT. Le Combat quotidien suit le même ordre et réconcilie sur victoire `COMBAT_WINS`, `MORAS_EARNED` et seulement en mode MANUAL `MANUAL_COMBAT_WINS`; une défaite ne progresse aucune de ces métriques.

L’intention Social `friendship.hearts` groupe tous les cœurs effectifs, incrémente une fois `totalFriendHeartsSent`, puis effectue une seule réconciliation sender `FRIEND_HEARTS_SENT`. Si une relation passe réellement de 999 à 1000, la même transaction réconcilie `PERFECT_FRIENDSHIP` pour le sender et uniquement cette métrique pour l’autre participant. Les crédits +5/+5 utilisent `skipPermanentMissions` : le destinataire passif ne reçoit ni catch-up R301 ni progression de cœurs envoyés. Toutes les complétions du batch pointent vers l’opération d’intention globale, pas vers un cœur arbitraire.

La projection canonique B/A/S contient uniquement les données nécessaires aux consommateurs. Tant que `zUnlockedAt` est nul, Z est réduit à son état global `LOCKED` : aucune définition, cible, progression ou récompense secrète n’est projetée.

Le Lot 4 validé publiquement ajoute `GetCurrentPlayerMissions`, propriétaire de la transaction de consultation personnelle. La query résout le Player depuis l’identité authentifiée, appelle `catchUpStandalone` puis `project` dans la même transaction et expose `catchUpApplied` afin que le frontend relise Ressources une seule fois après un rattrapage réellement appliqué. Le fast-path marqué ne crée ni opération de vue ni réconciliation générale supplémentaire.

`GET /api/v1/me/missions` est authentifié, sans `playerId` client et avec `Cache-Control: no-store`. Un serializer unique convertit BigInt en chaînes décimales et dates en ISO/null ; avant déblocage, le JSON Z vaut strictement `{ "status": "LOCKED" }`.

Le Lot 5 promu raccorde `!mission` à cette query personnelle et au propriétaire du Défi. R301 reste SYSTEM/exactly-once et, s’il est appliqué par l’envoi Chat avant le dispatcher, le résultat durable `chat.send` porte le refresh `resources`; le `commandMessageId` n’est jamais la preuve des complétions historiques. Le handler produit une chaîne logique monoligne et laisse `GlobalChatService.splitGameResult()` publier atomiquement les segments de 500 caractères maximum.

`GET /api/v1/players/:playerId/missions` authentifie le viewer, exige une cible ACTIVE, évalue `PrivacyService.permissions(target, viewer).MISSIONS`, puis retourne `PRIVATE` sans donnée ou la projection persistée sérialisée par le même serializer. Cette lecture n’appelle que `project` dans une transaction read-only applicative : aucun catch-up, reconcile, reward, `BusinessOperation` ou `ResourceMovement`, y compris si le marqueur R301 de la cible est nul. Le Profil utilise `/me/missions` pour son propriétaire et cette route dédiée seulement pour un tiers ; le payload général Profil et son polling restent inchangés. Notification player-facing, Twitch et migration legacy restent absents.
## Historique global candidat review — R911

La route authentifiée `GET /api/v1/me/history?category=banners|event&page=N` résout l'acteur depuis l'identité serveur, impose dix lignes par page et ne fait aucune écriture. `HistoryService` lit `BannerRotation` avec ses `BannerFeaturedCharacter` ou les éditions Event dont `endsAt` est passé, puis les participants, claims et acquisitions nécessaires. Il calcule le classement final sur les points persistés, conserve le Top public et isole le détail du seul acteur. Un snapshot de vote nul reste nul dans la réponse ; aucun catalogue actuel ne sert de reconstruction. Invocations, Banque et Boutique continuent à utiliser leurs routes propriétaires ; la route Banque accepte le filtre optionnel `type=DEPOSIT|WITHDRAWAL|INTEREST` avant `count` et pagination. Aucune table History transverse.

La rotation hebdomadaire utilise deux transactions sous le même verrou logique : fermeture durable du pool de votes 5★ sur la rotation source, puis génération depuis cette capture et écriture du snapshot final sur la nouvelle rotation. Une reprise relit la fermeture persistée même si le catalogue a changé. La première rotation sans source écrit SQL `NULL`. `HistoryService` ne projette que les champs du snapshot final et masque la fermeture en attente.

## Apparence — premier vertical candidat review

`AppearanceService` est le propriétaire unique du catalogue, des possessions et de l'équipement. `unlockCosmetic` accepte une transaction métier existante, utilise la PK `(player_id, cosmetic_id)` avec insertion idempotente, conserve source/date/provenance et exige `notificationMode: PLAYER_FACING | SILENT_BACKFILL`. Seule une nouvelle insertion `PLAYER_FACING` notifie ; replay et import technique restent neutres. Aucun producteur de gameplay n'est branché faute de règle de déblocage canonique. `GET /api/v1/me/appearance` est sans écriture ; `PATCH` accepte seulement le type et l'ID cosmétique ou `null` de l'acteur authentifié. Le serveur refuse type erroné, définition inactive et cosmétique non possédé. Les entrées SECRET non possédées ne sortent pas, MYSTERY masque nom, asset et condition ; VISIBLE expose la condition déclarée.

Les DTO d'identité Player de Social, Classements, Chat, MP, Event > Panier, Modération et partenaires Échanges joignent la définition d'avatar équipée dans leur lecture de liste ; aucun aller-retour par ligne. Le frontend commun choisit l'asset officiel équipé, l'asset de l'élément permanent, puis l'initiale si aucun élément ou si les images échouent. Le titre est projeté uniquement dans le DTO Profil. `effectiveAvatar` exige type AVATAR, activité et asset officiel ; 046 retire physiquement l'équipement dès la désactivation, sans rééquipement automatique après réactivation. Le catalogue officiel n'est pas modifiable depuis le navigateur ; 045 active RLS et retire les droits directs `anon`/`authenticated`. Aucun upload, URL externe, titre de départ, récompense économique ni intégration Twitch n'est ajouté.
