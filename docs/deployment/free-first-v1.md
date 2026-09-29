# Déploiement Free-first V1 — état public et checklist

## Gift Suprême Lot 12 — préparation sans activation

Lots 11 + 12 et correctif shutdown approuvés indépendamment puis promus techniquement ensemble sur main par fast-forward strict. Railway a ensuite déployé `61c04bd` avec succès et le propriétaire a configuré `preDeployCommand = npx prisma migrate deploy`. Ce déploiement n'a pas appliqué 055 : DEV reste à 54/054 et la table credential est absente. L'image backend de ce SHA n'embarquait pas la CLI Prisma, sa configuration ou ses migrations dans l'étape runtime. Le correctif image `c4566aa`, approuvé en review indépendante et promu techniquement sur `main` avec son checkpoint documentaire, ajoute ces seuls éléments et laisse la migration au pre-deploy Railway. Un seul nouveau redeploy doit apporter la preuve du vrai build runtime, de 055, d'Application ready, du healthcheck, de zéro effet Gift et de QA Faveur intacte. Aucune activation OAuth/Reward/EventSub/annonce Twitch Gift réelle ni aucune variable Gift n'est ajoutée ici.

**Contrat du déploiement corrigé et promu :** GitHub `main` → build de l'image runtime Railway → pre-deploy `npx prisma migrate deploy` avec `DATABASE_URL` Railway → succès de la migration → nouveau conteneur applicatif → `/health`. Un pre-deploy en échec doit faire échouer ce nouveau déploiement sans remplacer l'instance saine. Ni `CMD` ni le code serveur ne lancent la migration au démarrage ; aucune variable ou commande Railway n'est modifiée par cette promotion. Le build Docker réel et cette séquence restent à vérifier après le redeploy.

Variables serveur uniquement : TWITCH_GIFT_SUPREME_ENABLED (false par défaut) ; TWITCH_OAUTH_CREDENTIAL_KEY (base64 strict/canonique de 32 bytes, clé privée AES-256-GCM). Ne jamais mettre cette clé dans VITE_*, un log, une capture ou Git. Absence de clé laisse démarrer le serveur et rend Gift indisponible ; clé présente invalide bloque le démarrage avec une erreur sans sa valeur. Conserver la clé durablement : un changement non coordonné empêche de lire les credentials et impose une réautorisation/gestion opérateur ; aucun coffre générique ni rotation automatique de clé dans ce lot.

Avant activation future : appliquer/vérifier migration 055 via le pre-deploy Prisma (dernière lecture DEV après déploiement `61c04bd` : 54/054 ; répétition privée 55 à jour), contrôler health et statut OFF, configurer la clé et le flag de façon contrôlée. Gift exige la configuration OAuth/EventSub existante et l'allowlist pilote. OAuth propriétaire accorde openid/channel:manage:redemptions/user:write:chat. Si ancienne reward manuelle active : propriétaire la désactive/supprime dans Twitch puis Réessayer ; GachaImpact ne la modifie jamais. Ensure app-owned et EventSub, puis validation réelle sans dépense monétaire obligatoire. Ne pas confondre préparation technique et validation publique.

Désactivation en deux phases sur la même file Player : Reward OFF confirmée d'abord, puis drain et lecture Twitch UNFULFILLED + guard settlements locaux, puis EventSub OFF confirmé et credential/cache supprimés. Un pending retourne une erreur retryable et conserve EventSub/credential/identité, pour que le webhook/retry termine même reward OFF. Réessayer la désactivation après settlement ; ne réactiver que par une action propriétaire explicite. Unlink attend ce cleanup Gift avant Chat/Faveur/identité. Flag OFF seul n'efface pas une reward déjà active. Aucune activation/configuration publique acquise par ce correctif ; 055 inchangée, aucune 056. Annonce at-most-once en cas ambigu, possibilité d'annonce manquante documentée dans l'[architecture](../architecture/backend-architecture-v1.md#gift-suprême-lot-12--bridge-twitch-durable-promu-techniquement-sur-main).


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
