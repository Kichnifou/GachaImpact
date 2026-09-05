# Checklist de déploiement Free-first V1

État au 2026-09-05 : préparation locale uniquement. Parcours manuel propriétaire validé ; aucun déploiement effectué par ce lot. `PAID_INFRA_APPROVED = false`.

## 1. Avant publication

- Faire valider puis committer/pousser le lot séparément, sur instruction du propriétaire.
- Vérifier l'éligibilité, les crédits et limites Free du compte Railway avant activation. Aucun upgrade payant automatique autorisé ; si Free est insuffisant, demander une décision au propriétaire.
- Choisir explicitement le projet Supabase cible ; ne pas réinitialiser la base DEV ni migrer implicitement ses profils.
- Prévoir un export PostgreSQL privé avant toute future opération de schéma. Aucune migration ni seed automatique au démarrage du conteneur.

## 2. Backend Railway

- Connecter le dépôt GitHub et choisir la branche/checkpoint validé.
- Racine du service : `server` ; utiliser le `Dockerfile` présent dans cette racine. Aucune configuration Railway supplémentaire nécessaire.
- Build : `npm ci` → `npm run prisma:generate` → `npm run build`. Prisma généré est compilé dans `dist/generated/prisma` et copié avec `dist` dans l'image runtime.
- Start Docker : `node dist/src/server.js` (équivalent au script `npm start`, Node reçoit directement SIGTERM). Ne pas remplacer cette commande par `npm run dev`.
- Healthcheck : `/health` (santé HTTP, pas une preuve de disponibilité PostgreSQL/JWKS). Vérifier séparément le parcours authentifié.
- Variables runtime à saisir dans Railway, jamais dans Git :

| Variable | Valeur attendue |
| --- | --- |
| `HOST` | `0.0.0.0` (défaut Docker) |
| `PORT` | Port injecté par la plateforme ; `EXPOSE 3001` est seulement indicatif |
| `FRONTEND_ORIGIN` | Origine HTTPS exacte de Pages une fois connue, sans chemin ni slash final |
| `DATABASE_URL` | URL PostgreSQL privée du projet choisi ; conserver le mode de connexion/TLS validé |
| `SUPABASE_URL` | URL publique du même projet Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Clé publishable publique du même projet |
| `SUPABASE_JWT_ISSUER` | URL du projet suivie de `/auth/v1`, correspondant à l'issuer des JWT |

- Activer le domaine public HTTPS du backend et conserver son URL pour Pages. Tant que l'URL Pages n'est pas connue, ne pas ouvrir CORS à `*`.
- Vérifier les logs de démarrage, `/health`, puis l'arrêt propre (`app.close()` ferme aussi Prisma).
- Le build Docker/Linux reste à exécuter sur une machine équipée de Docker ou lors du déploiement : les builds Node locaux ne le remplacent pas.

## 3. Frontend Cloudflare Pages

- Connecter le dépôt GitHub, même branche validée ; racine du projet : racine du dépôt.
- Node : version 24 (variable de build `NODE_VERSION=24`). Build command : `npm run build`. Output directory : `dist`.
- Variables de build publiques : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` (URL HTTPS Railway).
- Aucune `DATABASE_URL`, aucun mot de passe PostgreSQL, aucune clé service-role/secret dans Pages ou dans une variable `VITE_*`.
- Les variables Vite sont incorporées au build : reconstruire après toute modification.
- Navigation actuelle par hash (`#home`, etc.) : un seul document statique, pas de configuration serveur pour chaque écran.
- Vérifier la taille et le nombre des assets contre les limites Pages du compte avant publication.

## 4. CORS et confirmation e-mail

- Reporter l'origine Pages finale dans `FRONTEND_ORIGIN` sur Railway, puis redémarrer/redéployer le backend.
- L'origine locale reste `http://localhost:5173` dans l'environnement serveur local. Les previews Pages ne sont pas autorisées automatiquement.
- Dans Supabase Auth → URL Configuration : définir la Site URL sur l'URL frontend publique et autoriser le retour exact vers sa racine. Le signup actuel utilise cette Site URL par défaut.
- Conserver les redirects locaux nécessaires ; vérifier le lien de confirmation et ses templates. Aucun wildcard global en production.
- Ce changement sur un projet Supabase partagé affecte aussi les confirmations du développement : en tenir compte lors des tests locaux.

## 5. Validation publique avant partage

- `/health` public ; CORS autorisé depuis Pages et refusé depuis une origine étrangère.
- Inscription avec un compte de test, réception/confirmation e-mail, pseudo, élément permanent.
- Ressources, premier spin et feedback frais ; navigation aller/retour, F5, logout/login : résultat quotidien historique restauré et aucun second gain.
- PC/mobile, absence d'images cassées, erreurs réseau lisibles ; aucune grosse Roue sur l'Accueil.
- Vérifier les limites d'envoi d'e-mails/Free, les crédits consommés et la disponibilité effective avant de partager le premier lien alpha. Aucun engagement de disponibilité 24 h/24 sans mesure.

Sources officielles consultées : [Railway Dockerfile](https://docs.railway.com/builds/dockerfiles), [Cloudflare Pages Vite](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/), [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls). Revérifier les offres au moment de l'activation.
