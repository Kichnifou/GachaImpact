# Déploiement Free-first V1 — état public et checklist

## Gift Suprême — déploiement et récupération publics validés, bridge désactivé

Le pilote Gift a été réellement activé après le correctif image Prisma. Le callback EventSub a répondu 200, mais la première redemption réelle, déjà dépensée côté Twitch, a reçu quatre 409 webhook ; aucun effet économique Gift n'avait été créé et la subscription était devenue non active. Le correctif hot path/terminal/recovery/message `ad826c7` a été promu puis déployé publiquement dans `e705ebd` : Railway `SUCCESS`, `/health` réussi, 55 migrations appliquées, dernière `20260929151500_055_add_twitch_gift_supreme_credential`. Le contrat GitHub `main` → build image → pre-deploy `npx prisma migrate deploy` → application → health est opérationnel ; aucun nouveau changement d'infrastructure n'est requis.

Le propriétaire a utilisé une seule action UI « Réessayer », sans second achat ni compensation. Ensure a pu recréer la subscription exacte après l'entrée terminale ; la récupération bornée des redemptions Helix UNFULFILLED de la Reward app-owned a traité la redemption existante via le core et le settlement usuels. Résultat public vérifié : receipt core PROCESSED, outcome SUCCESS, settlement FULFILLED, annonce SENT durable, une opération Gift, un mouvement +1600 Cryo, une notification et solde 85 850 → 87 450. Le propriétaire confirme le message Twitch avec total final, envoyé par le nouveau backend GachaImpact. Le transport receipt n'est créé que pour un vrai webhook signé ; la récupération Helix crée seulement la preuve métier par redemption ID. Aucune migration 056.

Après cette preuve, le propriétaire a volontairement désactivé le bridge Gift GachaImpact. Vérification backend transmise : TwitchIdentity Kichnifou présente (1), credentials Gift et reward ID local actif absents (0), opération/mouvement/notification historiques présents (1 chacun), Cryo 87 450. Streamer.bot / legacy demeure autoritatif jusqu'au cutover ; l'état ON/OFF actuel de l'ancienne Reward manuelle n'a pas été vérifié indépendamment. Au cutover : désactiver cette Reward manuelle, arrêter le chemin Gift Streamer.bot, vérifier l'identité, réautoriser/activer Gift GachaImpact, retrouver/réactiver ou recréer la Reward app-owned, confirmer EventSub exact `enabled`, puis smoke test crédit, FULFILLED, notification et annonce avant de considérer Gift natif autoritatif.

## Gift Suprême Lot 12 — préparation historique avant activation

Lots 11 + 12 et correctif shutdown ont été approuvés indépendamment puis promus techniquement ensemble sur main par fast-forward strict. Railway avait déployé `61c04bd` avec succès et le propriétaire avait configuré `preDeployCommand = npx prisma migrate deploy`. Ce déploiement n'avait pas appliqué 055 : DEV était alors à 54/054 et la table credential absente. L'image backend de ce SHA n'embarquait pas la CLI Prisma, sa configuration ou ses migrations dans l'étape runtime. Le correctif image `c4566aa`, approuvé en review indépendante puis promu techniquement sur `main` avec son checkpoint documentaire, a ajouté ces seuls éléments et laissé la migration au pre-deploy Railway. Le redeploy et l'activation pilote sont intervenus depuis ; leur état actuel et l'incident de première redemption figurent en tête du document.

**Contrat du déploiement corrigé et validé :** GitHub `main` → build de l'image runtime Railway → pre-deploy `npx prisma migrate deploy` avec `DATABASE_URL` Railway → succès de la migration → nouveau conteneur applicatif → `/health`. Ce pipeline a déployé `e705ebd` avec succès et 55 migrations appliquées. Un pre-deploy en échec doit faire échouer ce nouveau déploiement sans remplacer l'instance saine. Ni `CMD` ni le code serveur ne lancent la migration au démarrage ; aucune variable ou commande Railway n'est modifiée par ce checkpoint documentaire.

Variables serveur uniquement : TWITCH_GIFT_SUPREME_ENABLED (false par défaut) ; TWITCH_OAUTH_CREDENTIAL_KEY (base64 strict/canonique de 32 bytes, clé privée AES-256-GCM). Ne jamais mettre cette clé dans VITE_*, un log, une capture ou Git. Absence de clé laisse démarrer le serveur et rend Gift indisponible ; clé présente invalide bloque le démarrage avec une erreur sans sa valeur. Conserver la clé durablement : un changement non coordonné empêche de lire les credentials et impose une réautorisation/gestion opérateur ; aucun coffre générique ni rotation automatique de clé dans ce lot.

Au checkpoint historique avant première activation, il fallait appliquer/vérifier migration 055 via le pre-deploy Prisma (lecture DEV après déploiement `61c04bd` : 54/054 ; répétition privée 55 à jour), contrôler health et statut OFF, configurer la clé et le flag de façon contrôlée. Ces prérequis ont été franchis pour le pilote, puis le bridge a été désactivé après validation. Pour une réactivation au cutover, Gift exige toujours la configuration OAuth/EventSub et l'allowlist pilote ; OAuth propriétaire accorde openid/channel:manage:redemptions/user:write:chat. Si l'ancienne Reward manuelle est active, le propriétaire doit la désactiver avant la réactivation du bridge ; GachaImpact ne la modifie jamais. Retrouver/réactiver ou recréer proprement la Reward app-owned selon le contrat, puis vérifier EventSub exact et effectuer un smoke test.

Désactivation en deux phases sur la même file Player : Reward OFF confirmée d'abord, puis drain et lecture Twitch UNFULFILLED + guard settlements locaux, puis EventSub OFF confirmé et credential/cache supprimés. Un pending retourne une erreur retryable et conserve EventSub/credential/identité, pour que le webhook/retry termine même reward OFF. Réessayer la désactivation après settlement ; ne réactiver que par une action propriétaire explicite. Unlink attend ce cleanup Gift avant Chat/Faveur/identité. Flag OFF seul n'efface pas une reward déjà active. Ce cleanup a été vérifié publiquement après le Gift réussi ; 055 inchangée, aucune 056. Annonce at-most-once en cas ambigu, possibilité d'annonce manquante documentée dans l'[architecture](../architecture/backend-architecture-v1.md#gift-suprême-lot-12--bridge-twitch-durable-promu-techniquement-sur-main).


État au 2026-09-05 : premier déploiement public validé. `PAID_INFRA_APPROVED = false`.

## État réalisé

### Backend Railway — FAIT

- Projet Railway : `precious-nourishment` (nom automatique, renommable plus tard sans impact technique).
- Service : `GachaImpact` ; environnement : `production`.
- Dépôt : `Kichnifou/GachaImpact`, branche `main`, Root Directory : `/server`.
- Le `server/Dockerfile` a construit et démarré le backend avec succès sous Linux/Railway.
- Variables runtime configurées, sans valeur secrète dans Git : `HOST`, `FRONTEND_ORIGIN`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_ISSUER`. Le port est fourni par Railway.
- Healthcheck : `/health` ; domaine public : [https://gachaimpact-production.up.railway.app](https://gachaimpact-production.up.railway.app). `GET /health` retourne `{"status":"ok"}`.
- Le vertical Banque utilise un scheduler interne au processus backend : catch-up idempotent au démarrage, puis planification du prochain minuit `Europe/Paris`. Aucune infrastructure cron payante n'est requise ; l'unicité DB par Player/journée protège les intérêts positifs et le checkpoint monotone `lastInterestDate` protège les journées à intérêt nul sans créer d'historique `+0`. Le statut courant des lots appartient au Master.

Railway est actuellement en **Trial Free** (30 jours ou 5 USD de crédits). Railway Hobby n’est pas activé. Observer la consommation réelle avant toute décision ; aucune disponibilité 24/7 ne doit être promise après l’expiration du Trial.

### Frontend Cloudflare Pages — FAIT

- Dépôt GitHub connecté, branche `main`, Root Directory : racine du dépôt.
- Framework preset : `None` ; build : `npm run build` ; sortie : `dist` ; `NODE_VERSION=24`.
- Variables de build configurées : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`.
- Domaine public : [https://gachaimpact.pages.dev](https://gachaimpact.pages.dev).

Les variables `VITE_*` sont intégrées au build. Elles ne doivent jamais contenir `DATABASE_URL`, un mot de passe PostgreSQL, une clé service-role ou une autre clé secrète.

### CORS et Supabase Auth — FAIT

- `FRONTEND_ORIGIN` Railway : `https://gachaimpact.pages.dev` (origine exacte, sans wildcard).
- Supabase Auth Site URL : `https://gachaimpact.pages.dev`.
- Redirect URLs autorisées : `https://gachaimpact.pages.dev` et `http://localhost:5173`.
- Cloudflare Pages et Supabase utilisent leurs offres Free actuelles.

### Validation publique — FAIT

Depuis [https://gachaimpact.pages.dev](https://gachaimpact.pages.dev), sans backend ni frontend local, le propriétaire a validé : connexion, chargement du Player réel, élément et ressources persistants, état quotidien de la Roue restauré, logout/login et communication Cloudflare → Railway → Supabase. Le premier lien alpha est disponible.

## À surveiller

- Consommation Railway et fin du Trial Free ; ne pas activer Hobby ou un autre service payant sans accord explicite du propriétaire.
- Healthcheck public et parcours authentifié après les futurs déploiements.
- Après un déploiement qui touche la Banque ou son scheduler, vérifier dans les logs que le démarrage/catch-up ne produit aucune erreur et valider le reset concerné ; l'exactitude ne dépend pas d'un processus resté actif sans interruption, car le prochain démarrage reprend les journées manquées.
- Limites Free effectives (Railway, Cloudflare Pages, Supabase et e-mails Auth) avant d’élargir les tests externes.

## Workflow de validation alpha

Le workflow général de conception, implémentation, review et checkpoint appartient à [implementation-workflow.md](../process/implementation-workflow.md). Le présent document reste propriétaire des particularités Railway, Cloudflare Pages, alpha publique et déploiement.

- `main` reste la branche de production alpha auto-déployée vers Railway et Cloudflare Pages.
- `review` est la branche permanente de pré-review Git : elle n’est reliée à aucun backend, aucune base ou aucun environnement staging supplémentaire.
- Cloudflare Pages utilise `main` comme Production branch, avec les déploiements automatiques de production activés et Preview branch deployments réglé sur `None`. Un push sur `review` ne déclenche donc aucun build Pages.
- Railway utilise le dépôt `Kichnifou/GachaImpact`, la branche `main` et la Root Directory `/server`. Un push sur `review` ne déclenche donc aucun déploiement Railway.
- Cette séparation permet d’inspecter les candidats sur GitHub sans environnement supplémentaire et sans coût additionnel.
- Codex exécute les tests automatisés pertinents avant toute proposition de checkpoint.
- Un smoke test local reste possible mais n'est plus obligatoire par défaut : l'alpha actuelle accepte le workflow tests automatisés → push sur `review` → review GitHub → promotion sur `main` → test public. Pour un changement visible ou backend sensible, le propriétaire peut toujours tester avant la publication du candidat avec le backend/frontend locaux et Supabase DEV.
- Le frontend local doit cibler le backend local via ses variables d'environnement ; l'URL Railway ne doit jamais être codée en dur. Un push n'est donc pas nécessaire pour tester localement le code.
- Après les tests locaux, le candidat est committé/poussé sur `review` pour inspection GitHub. Après approbation seulement, il est promu vers `main`, puis l’équipe attend les déploiements Railway et Cloudflare verts avant le smoke test public.
- Les checkpoints Git validés permettent un rollback propre ; annuler un lot public avec `git revert` plutôt qu'un force-push ou un reset destructif de `main`.
- Les quelques testeurs publics actuels ne justifient pas encore un environnement staging séparé. Aucun environnement payant supplémentaire n'est ajouté ; le staging reste reporté tant que la taille de l'alpha ne justifie pas sa complexité ou son coût.
- `PAID_INFRA_APPROVED = false` reste inchangé.

## Checklist de redéploiement utile

1. Committer/pousser le candidat sur `review`, faire approuver sa review GitHub, puis le promouvoir vers `main` uniquement sur instruction du propriétaire.
2. Vérifier le déploiement Railway, ses logs et [le healthcheck public](https://gachaimpact-production.up.railway.app/health).
3. Vérifier le build Pages et que `VITE_API_BASE_URL` cible l’URL Railway HTTPS publique.
4. Après tout changement d’URL Pages, reporter l’origine exacte dans `FRONTEND_ORIGIN`, redéployer Railway, puis ajuster Site URL et redirects Supabase Auth.
5. Tester : connexion, confirmation e-mail si concernée, onboarding, élément, ressources, premier spin, navigation, F5, logout/login, PC/mobile et absence d’erreurs réseau.
6. Ne jamais lancer une migration, un seed ou une réinitialisation PostgreSQL automatiquement au démarrage ; prévoir un export privé avant toute future opération de schéma.

Sources utiles : [Railway Dockerfile](https://docs.railway.com/builds/dockerfiles), [Cloudflare Pages Vite](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/), [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls).
