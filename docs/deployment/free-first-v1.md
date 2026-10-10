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


État initial au 2026-09-05 : premier déploiement public validé sans infrastructure payante autorisée. État courant au 2026-10-04 : Railway Hobby / hébergement payant approuvé et confirmé payé par le propriétaire ; autorisation limitée à Railway selon le registre du Master, facturation non vérifiée directement par Codex/ChatGPT.

## État réalisé

### Backend Railway — FAIT

- Projet Railway : `precious-nourishment` (nom automatique, renommable plus tard sans impact technique).
- Service : `GachaImpact` ; environnement : `production`.
- Dépôt : `Kichnifou/GachaImpact`, branche `main`, Root Directory : `/server`.
- Le `server/Dockerfile` a construit et démarré le backend avec succès sous Linux/Railway.
- Variables runtime configurées, sans valeur secrète dans Git : `HOST`, `FRONTEND_ORIGIN`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_ISSUER`. Le port est fourni par Railway.
- Healthcheck : `/health` ; domaine public : [https://gachaimpact-production.up.railway.app](https://gachaimpact-production.up.railway.app). `GET /health` retourne `{"status":"ok"}`.
- Le vertical Banque utilise un scheduler interne au processus backend : catch-up idempotent au démarrage, puis planification du prochain minuit `Europe/Paris`. Aucune infrastructure cron payante n'est requise ; l'unicité DB par Player/journée protège les intérêts positifs et le checkpoint monotone `lastInterestDate` protège les journées à intérêt nul sans créer d'historique `+0`. Le statut courant des lots appartient au Master.

Railway Hobby / hébergement payant est approuvé et confirmé payé par le propriétaire, en remplacement du Trial Free historique. ChatGPT a vérifié le service GachaImpact en **EU West / Amsterdam**, région europe-west4-drams3a : 1/1 replica running, 0 crashed, aucun volume ni warning/critical ; ancien déploiement Virginia/iad supprimé. Le propriétaire confirme une réactivité nettement améliorée ; aucun benchmark réseau chiffré n'est revendiqué. Supabase reste Europe centrale. La confirmation de paiement vient du propriétaire, sans vérification directe de facturation par Codex/ChatGPT.

Cette autorisation ne couvre ni autre fournisseur/infrastructure payante, ni Redis, Realtime, service tiers ou environnement supplémentaire. Toute nouvelle dépense demande un accord explicite. Aucun changement Railway ou Serverless n'est effectué dans le checkpoint de promotion. ContestScheduler (2 s) et GiftCodeScheduler (60 s) restent inchangés ; fonctionnement stable/rapide, Concours autonome conservé (tours auto, bots, timeouts, remplacements, soutien). 27 est clôturée par décision de périmètre R1034 ; toute optimisation éventuelle relève de la maintenance post-V1/besoin réel après audit dédié.

### Frontend Cloudflare Pages — FAIT

- Dépôt GitHub connecté, branche `main`, Root Directory : racine du dépôt.
- Framework preset : `None` ; build : `npm run build` ; sortie : `dist` ; `NODE_VERSION=24`.
- Variables de build configurées : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`.
- Domaine public : [https://gachaimpact.pages.dev](https://gachaimpact.pages.dev).

Les variables `VITE_*` sont intégrées au build. Elles ne doivent jamais contenir `DATABASE_URL`, un mot de passe PostgreSQL, une clé service-role ou une autre clé secrète.

### CORS et Supabase Auth — FAIT

- `FRONTEND_ORIGIN` Railway : `https://gachaimpact.pages.dev` (origine exacte, sans wildcard).
- Supabase Auth Site URL : `https://gachaimpact.pages.dev`.
- Redirect URLs confirmées par le propriétaire le 10/10/2026 : `https://gachaimpact.pages.dev`, `http://localhost:5173` et leurs deux chemins `/auth/recovery` explicites.
- Cloudflare Pages et Supabase utilisent leurs offres Free actuelles.

### Validation publique — FAIT

Depuis [https://gachaimpact.pages.dev](https://gachaimpact.pages.dev), sans backend ni frontend local, le propriétaire a validé : connexion, chargement du Player réel, élément et ressources persistants, état quotidien de la Roue restauré, logout/login et communication Cloudflare → Railway → Supabase. Le premier lien alpha est disponible.

## R1058 — configuration et preuves requises

Le candidat utilise un retour fixe `/auth/recovery`, servi directement par le fallback SPA Cloudflare Pages. Conserver Site URL `https://gachaimpact.pages.dev` et autoriser explicitement `https://gachaimpact.pages.dev/auth/recovery` ainsi que `http://localhost:5173/auth/recovery` pour le développement. Les origines seules documentées plus haut ne prouvent pas l'autorisation de ces chemins. Aucun wildcard, retour arbitraire, modification SMTP payante ou secret frontend ajouté.

Le propriétaire confirme les quatre Redirect URLs et le modèle Reset Password par défaut ; il a personnellement réussi la demande, la réception Supabase, le lien local, la modification puis la reconnexion sur son adresse autorisée d’équipe. La recette visuelle des trois retouches du candidat `a6f28e8` est également validée. Ces preuves ne sont pas une inspection Management Auth par Codex : valeurs privées d’expiration/politique/quota non relevées. La validation native du SDK, le refus des callbacks invalides/expirés, la vérification serveur `getUser`, la séparation des sessions et le filtrage des erreurs restent obligatoires et couverts par les contrôles acquis ; aucune exception de sécurité n’est introduite.

**Exception temporaire décidée explicitement le 10/10/2026 :** le propriétaire autorise promotion et déploiements de R1058 malgré la restriction du SMTP intégré. Seule la gate de délivrabilité générale est levée pour cette livraison. Le fournisseur intégré refuse les destinataires hors équipe Supabase ; aucune disponibilité générale de la récupération e-mail ni réception pour les joueurs ordinaires n’est revendiquée. Aucun SMTP personnalisé, fournisseur ou achat supplémentaire configuré. [Restriction officielle Supabase](https://supabase.com/docs/guides/auth/auth-smtp). Une erreur fournisseur reste une erreur, jamais une certitude d’envoi.

Preuve e-mail uniquement dans une boîte contrôlée autorisée ; aucun envoi aux joueurs ni mot de passe demandé. Un GET 200 valide l’hébergement SPA, pas le callback ou une session. Les tests simulés et captures ne valent jamais réception réelle. Suspendre la promotion si un défaut critique de validation/expiration, confidentialité, session ou identité apparaît ; l’exception SMTP ne le couvre pas. État des SHA et déploiements : [Master](../master/PROJECT_MASTER_PLAN.md#point-courant--r1058-codesmissions-et-restitution-du-tirage-event).

**Livraison du 10/10 vérifiée :** `56ddc4a634fd09277479abe2b7a10b727ab3286d`, main/review communs après fast-forward strict ; Railway `994f1142-9611-475a-966f-581187d735ab` et Pages `6cde4c62-1e68-43eb-becf-20bd54d8797e` SUCCESS au SHA exact. Assets publics identiques au build Pages, health 200, recovery SPA 200 et accès sans lien valide refusé ; API Player non authentifiée 401. 69 migrations à jour, aucune migration nouvelle. GLOBAL/Chat confirmés par configuration Railway, PostgreSQL et Helix ; invariants ciblés d’identité/économie contrôlés en lecture seule. Le checkpoint documentaire de clôture est ensuite vérifié séparément dans le rapport de livraison ; aucun nouveau fonctionnement, changement DNS ou SMTP ajouté.

<a id="domaine-gachaimpactfr--pause-propriétaire-jusquau-11102026"></a>
<a id="gachaimpact-domain-handoff-20261010"></a>
## Domaine gachaimpact.fr — suivi actuel DNSSEC / Cloudflare (passation du 10/10/2026)

**État actuel validé par les captures du propriétaire :** domaine `gachaimpact.fr` acheté chez OVHcloud pour trois ans, enregistré et actif jusqu'au **10/10/2029**. Cloudflare **Free (0 $)** sélectionné ; zone `gachaimpact.fr` créée, mais affichant encore l'attente de la délégation vers ses serveurs de noms. Le propriétaire **n'a pas encore changé les serveurs de noms chez OVHcloud**. L'URL du jeu reste `https://gachaimpact.pages.dev` ; Railway, Chat Twitch GLOBAL, identités et progression ne sont pas modifiés par cette préparation.

**DNS déjà repérés :** l'import Cloudflare contient neuf enregistrements : deux A (`@`, `www` → `213.186.33.5`, redirection/parcage OVH ; proxied orange), un CNAME `ftp` → `gachaimpact.fr` (également orange/proxied : passer en DNS-only avant usage FTP si conservé), trois MX OVH (`mx1.mail.ovh.net` priorité 1, `mx2.mail.ovh.net` priorité 5, `mx3.mail.ovh.net` priorité 100) et trois TXT (redirection OVH, SPF OVH, marqueur `www`). Comparaison visuelle faite avec la zone OVH ; contrôler les valeurs complètes avant activation et préserver le service de messagerie éventuel, notamment le Zimbra Starter inclus. Les NS OVH figurant dans la zone d'origine ne doivent pas être recopiés dans les enregistrements DNS Cloudflare ; la délégation se règle chez le registrar.

**DNSSEC — dernière action réelle :** OVHcloud a d'abord affiché DNSSEC **ON/Actif**, puis le propriétaire a demandé la désactivation. Le Manager affiche **« Votre demande a bien été prise en compte »** et **« En cours de désactivation »** (capture du 10/10). Délai annoncé pouvant atteindre 24 h. L'onglet Opérations DNS avait auparavant un plantage UI intermittent `Cannot read properties of undefined (reading 'id')`, sans preuve de corruption de zone ; une ancienne consultation des DS montrait une table vide. **L'absence de DS lors d'un contrôle précédent ne prouve pas l'état après la bascule ON puis la demande OFF**. Vérifier l'état DS au parent `.fr` avec une source autoritative/fraîche avant toute nouvelle délégation. Ne pas toucher à la protection contre le transfert, qui doit rester active.

**Décision de reprise du propriétaire :** attendre **30–60 min** après la demande de désactivation, vérifier si DNSSEC est devenu totalement **OFF** et si le DS a disparu au parent. Si le statut reste en cours, attendre et éventuellement avancer sur un chantier indépendant ; pas d'opération automatique, pas de deadline inventée. L'ancienne « pause jusqu'au 11/10 » inscrite lors de R1058 est **supersédée uniquement sur le calendrier** : le domaine peut être repris dès que les gates sont réellement satisfaites. Ne pas changer les NS OVH pendant l'attente.

**Ordre des prochaines opérations (chacune avec vérification avant la suivante) :**
1. Confirmer DNSSEC **OFF**, aucun ancien DS dans le registre parent, et état NS OVH courant ; préserver la zone DNS existante.
2. Vérifier les neuf DNS importés dans Cloudflare (MX, SPF, TXT et éventuels DKIM), retirer le proxy de `ftp` si conservé ; déterminer les changements `@`/`www` nécessaires pour le futur Cloudflare Pages. Ne pas annoncer une page OVH redirigée comme une version fonctionnelle du jeu.
3. Remplacer les deux NS OVH par les **deux nameservers exacts affichés dans la zone Cloudflare** uniquement après ces gates. Observer la délégation et l'activation de zone Cloudflare, sans prétendre qu'un onboarding DNS équivaut à un rattachement à Pages.
4. Configurer séparément le **custom domain Cloudflare Pages**. Préparer puis tester dans un lot autorisé l'acceptation des deux origines côté Railway/CORS, la redirection Supabase Auth et la logique front `recoveryDestination`, les retours et liaisons Twitch, ainsi que les reconnexions sur la nouvelle origine ; maintenir `pages.dev` accessible. Aucun arrêt planifié de GLOBAL/Twitch ou migration de données. Les sessions navigateur sont propres à chaque origine : une reconnexion peut être nécessaire.
5. Préparer l'expéditeur transactionnel du domaine et le SMTP personnalisé pour Supabase Auth (Brevo Free envisagé, non configuré et sans dépense autorisée), DNS SPF/DKIM/DMARC selon fournisseur et test de réception vers une adresse de test contrôlée hors équipe. Ne déclarer le reset e-mail général disponible qu'après cette preuve réelle. Les étapes web et SMTP peuvent être ordonnées indépendamment si leurs prérequis sont satisfaits.

**Protection des données et coûts :** pas de nouvel hébergement, service payant, token divulgué, modification de comptes joueurs, déplacement PostgreSQL, changement du transport Twitch ni interruption générale implicite. Aucune bascule n'est initiée par le simple présent checkpoint documentaire. Cette étape opérationnelle reste distincte de **R1051 Catalogue Character**, prochain lot métier non commencé.

## À surveiller

- Consommation Railway Hobby ; toute nouvelle dépense ou service payant demande une autorisation explicite de son périmètre.
- Healthcheck public et parcours authentifié après les futurs déploiements.
- Après un déploiement qui touche la Banque ou son scheduler, vérifier dans les logs que le démarrage/catch-up ne produit aucune erreur et valider le reset concerné ; l'exactitude ne dépend pas d'un processus resté actif sans interruption, car le prochain démarrage reprend les journées manquées.
- Limites effectives Railway Hobby et offres Free Cloudflare Pages, Supabase et e-mails Auth avant d'élargir les tests externes.

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
- Les autorisations payantes par fournisseur/service du Master font autorité ; Railway Hobby autorisé ne vaut aucune autorisation générale.

## Checklist de redéploiement utile

1. Committer/pousser le candidat sur `review`, faire approuver sa review GitHub, puis appliquer le cycle autorisé du [workflow permanent](../process/implementation-workflow.md) : fast-forward strict vers `main` après acquisition des gates, sans nouveau GO générique. Un vrai blocker suspend la promotion.
2. Vérifier le déploiement Railway, ses logs et [le healthcheck public](https://gachaimpact-production.up.railway.app/health).
3. Vérifier le build Pages et que `VITE_API_BASE_URL` cible l’URL Railway HTTPS publique.
4. Après tout changement d’URL Pages, reporter l’origine exacte dans `FRONTEND_ORIGIN`, redéployer Railway, puis ajuster Site URL et redirects Supabase Auth.
5. Tester : connexion, confirmation e-mail si concernée, onboarding, élément, ressources, premier spin, navigation, F5, logout/login, PC/mobile et absence d’erreurs réseau.
6. Ne jamais lancer une migration, un seed ou une réinitialisation PostgreSQL automatiquement au démarrage ; prévoir un export privé avant toute future opération de schéma.

Sources utiles : [Railway Dockerfile](https://docs.railway.com/builds/dockerfiles), [Cloudflare Pages Vite](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/), [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls).
