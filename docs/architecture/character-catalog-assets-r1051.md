# Catalogue Character et assets — R1051

État au 10/10/2026. Ce document porte les sources, la collecte et les images ; les décisions produit restent dans [R1051](../specifications/decisions-log.md#catalogue-character-et-assets-avant-révélation--r1051-2026-10-06). PostgreSQL `characters` demeure le catalogue vivant unique. Aucun catalogue économique Genshin n'est importé. Projet communautaire non commercial confirmé par le propriétaire.

## Lot 1 : diagnostic et livraison bornée

Base initiale GitHub : main = review = `2397b61c53f5d40d8452028c5df06b9483495362`. Audit direct PostgreSQL en transaction READ ONLY : **120 actifs, 96 iconPath, 96 splashPath, 96 wishPath, 118 fullbodyPath, zéro releaseDate**, aucun Mitya. Tous les chemins non NULL correspondent à un fichier physique. Rapport historique : 118 fiches, 96 matched et 22 unmatched ; les additions 119/120 étaient absentes du mapping, pas du catalogue.

Les 24 fiches concernées : Aino, Alyosha, Columbina, Dahlia, Durin, Escoffier, Flins, Ifa, Illuga, Ineffa, Jahoda, Lauma, Linnea, Lohen, Nefer, Nicole, Odette, Prune, Sandrone, Skirk, Varka, Vesna, Vodyanitsa, Zibai. Aino/Alyosha avaient un fullbody et aucun portrait : le fallback icon → fullbody → wish → splash fonctionnait, avec une composition inadaptée à une carte. La correction fournit le portrait à la source ; aucun CSS par personnage.

Le contrôle en GameShell réel a également montré sur PC une contrainte générique Team : portrait carré de 325 px dans une carte de 108 px à 1366×768, nom hors cadre. La grille laisse désormais la place aux cartes, le portrait utilise leur hauteur disponible et le bloc nom/étoiles/C reste non rétractable. Règle commune desktop, aucun zoom ni sélecteur par personnage ; mobile conserve son flux. Vérification de la présence des visages et noms aux trois formats, sans mutation de Team.

**Candidat local : 72 nouveaux PNG, 24 portraits + 24 splash + 24 bandes wish.** Les 118 fullbody existants restent intacts. Vesna et Vodyanitsa restent sans **fullbody distinct validé** : le fournisseur donne le même gacha splash 2048×1024, qui n'est pas recopié artificiellement dans une quatrième catégorie. Elles disposent désormais de trois types d'images dans le candidat ; aucun personnage sans image après application du patch. Couverture attendue : 120/120 icon/splash/wish, 118/120 fullbody ; **24 → 2 incomplets** au sens strict des quatre champs. L'état public appliqué et les déploiements acquis sont consignés dans le [Master](../master/PROJECT_MASTER_PLAN.md#r1051-lot-1).

Le [manifeste récupéré](../../public/assets/genshin/metadata/recovered_character_assets.json) contient pour chaque clé historique : ID fournisseur validé par la fiche française, nom technique, URL exacte par rôle, SHA-256, taille, dimensions et pixels transparents/visibles mesurés après décodage Edge. Identité explicite, sans dérivation du nom affiché : Skirk = `SkirkNew`, Sandrone = `MarionetteNew`. Les 72 nouveaux fichiers sont décodés, transparents et comparés visuellement avec les illustrations existantes. Portrait 256×256 ; splash 2048×1024 ; wish 320×1024. Aucun portrait n'est remplacé par un splash étiqueté comme portrait.

Le générateur de mapping rassemble le catalogue historique et son addendum 119/120, refuse les identités conflictuelles et vérifie les hashes de ce manifeste. Le générateur de seed existant consomme le rapport ainsi obtenu. **Ne pas exécuter un seed public pour ce rattrapage** : il risquerait d'écraser notamment les classes internes Columbina = Déesse et Skirk = Abyss, ou les régions corrigées en ADMIN.

### Application conservatrice et ordre de publication

Depuis `server/` :

```powershell
node --env-file=.env scripts/backfill-character-assets.mjs
# Après review indépendante du SHA publié, main et disponibilité réelle Pages :
node --env-file=.env scripts/backfill-character-assets.mjs --apply
# Rejouer : zéro champ modifié attendu.
```

Sans `--apply`, transaction READ ONLY et plan uniquement. L'application vérifie d'abord chaque fichier local puis **chaque binaire public officiel Pages** : HTTP, MIME, signature PNG, dimensions et hash ; un HTTP 200 contenant la SPA échoue. Ensuite transaction SERIALIZABLE, verrou des seules fiches ciblées, identité clé/nom exacte et UPDATE uniquement des chemins **NULL**, avec condition NULL répétée dans SQL. Rollback intégral sur conflit ou fiche absente. Aucune création, désactivation, suppression, modification de métadonnées/sourceMetadata ou de possessions/bannières/économie ; seul `updated_at` accompagne les chemins. Une correction ADMIN déjà renseignée reste prioritaire, même si son URL diffère. Pas d'exécution au démarrage et pas de scheduler.

Publier les fichiers dans Pages **avant** d'inscrire les références publiques ; Railway seul ne publie pas `public/`. Conserver un plan privé avant/après, vérifier les autres colonnes Character dans les lignes ciblées, relancer le plan puis le replay et auditer la couverture. Ne pas comparer les soldes de joueurs vivants hors périmètre. Pour revenir sur ce lot : revert Git contrôlé et patch inverse limité aux valeurs exactes du manifeste, jamais reset/seed global ; conserver les assets tant que des références existent.

## Registre de fournisseurs : politique validée, implémentation future

Un registre versionné, ordonné **par champ**, configurable et auditable doit remplacer les recherches ponctuelles. Une panne ponctuelle n'édite pas sa priorité. L'action future ADMIN « Réauditer les sources » produit un rapport comparatif, sans changement implicite de fournisseur.

| Priorité / usage | Source retenue | Contrôle et limites |
|---|---|---|
| 1, annonce et calendrier | [Actualités HoYoverse](https://genshin.hoyoverse.com/en/news), comptes officiels Genshin | Auteur certifié/identifiant officiel et preuve datée. Hébergement HoYoLAB seul insuffisant. Une annonce n'est pas une date de sortie. |
| 1, métadonnées structurées | [genshin-db](https://github.com/theBowja/genshin-db) | Snapshot épinglé, égalité d'identité sans autocomplétion. Français officiel préféré. Aucun script tiers téléchargé exécuté. |
| Images, premier contrôle | Fichiers locaux et manifestes validés | Réutiliser la dernière bonne image et la provenance. Pas de téléchargement si déjà valide. |
| Images, complément | URL HoYoverse déclarée dans le manifeste puis [Enka](https://github.com/EnkaNetwork/API-docs/blob/master/docs/gi/api.md) | Nom technique vérifié ; HTTP et vrai binaire contrôlés séparément pour chaque rôle. Aucun UID/profil joueur interrogé. |
| Métadonnées/images de secours | [genshin.dev](https://github.com/genshindev/api), https://genshin.jmp.blue | GET /characters réussi au lot 1, 92 entrées ; aucun des 24 manquants ni Mitya. Non retenu pour ce rattrapage. Schémas/langues/couverture à requalifier avant activation. |
| Recherche seulement | Wikis, archives, Yatta/Honey Hunter/Hakushin | Remonter à l'original ; distinguer live/bêta. Non configurés comme fournisseurs automatiques validés dans ce lot. |

Snapshot réel genshin-db : `49a6544a6c6ae36089cb42fa591fc46f01de8bcf`, [manifeste images](https://raw.githubusercontent.com/theBowja/genshin-db/49a6544a6c6ae36089cb42fa591fc46f01de8bcf/src/data/image/characters.json), SHA-256 `3da0d49db479f255ca15f89acf16e10b1887aa0edb78e3a8e24fc1b79b7744c2`. Les 24 fiches françaises ont répondu HTTP 200, avec IDs concordants. Plusieurs URL d'icônes HoYoverse ont répondu 404 : Enka fournit les binaires retenus lorsque nécessaire. Un timeout initial du splash Columbina n'est pas une absence : téléchargement repris avec un autre client HTTP. Le rapport d'import conserve les URL effectivement réussies, pas les hypothèses de recherche.

Licence du code ≠ licence des illustrations. [Licence genshin-db](https://github.com/theBowja/genshin-db/blob/main/LICENSE), [conditions HoYoverse](https://genshin.hoyoverse.com/en-us/company/terms). Provenance conservée ; aucune autorisation de redistribution des œuvres n'est déduite de la licence MIT, du caractère gratuit ni d'un tag tiers « Official ». Aucun achat ni nouvelle autorisation juridique revendiqués par ce lot.

## Futur pipeline quotidien — seulement spécifié

Job vers 00:00 Europe/Paris, indépendant des resets critiques ; catch-up au démarrage sur dernier cycle durable réussi, sans lancer une exécution par journée manquée. Verrou/lease unique, expiration et reprise bornées. Un fournisseur indisponible ne bloque pas le jeu. Collecter candidats officiellement annoncés, comparer au catalogue, puis reprendre les champs manquants des candidats et des fiches historiques. Ne pas désactiver les 120 historiques parce que leur releaseDate est actuellement NULL.

Étapes : collecte cache/ETag → identité stable/alias explicites → preuve d'annonce/calendrier → normalisation par champ → téléchargement borné → validation/décodage → stockage → disponibilité HTTP → transaction catalogue/idempotence → notification ADMIN persistante. Pas de dépendance fournisseur au chargement de la Box, Team ou Gacha. Les JSON versionnés sont des preuves/amorces, pas un second catalogue vivant.

Publication normale : officiellement sorti ou date de disponibilité officielle confirmée dans [maintenant, maintenant + 7 jours], nom/rareté/élément fiables, identité unique et aucun conflit critique. Date absente ou donnée bêta seule = attente. Arme/région/localisation/assets peuvent être enrichis lorsqu'ils sont fiables ; définir explicitement les rôles d'images requis avant activation du prochain lot. Une fiche partielle reste enrichissable ; elle ne doit pas inventer une classe, un passif ou des règles GachaImpact. L'override hors fenêtre reste une exception ADMIN explicite, auditée et motivée ; aucun nom hardcodé et aucune utilisation implicite pour Mitya.

### État durable à prévoir dans le prochain lot

Prévoir une migration dédiée ultérieure, revue avant application : candidat lié à Character nullable et identités externes uniques (namespace + ID), alias localisés sans autocomplétion ambiguë ; par champ valeur/provenance/date/qualité/override ADMIN ; assets par rôle/hash/type/dimensions/URL/état ; tentatives fournisseur/status/erreur bornée/dates/nextCheckAt ; dernier cycle et clé d'idempotence. Statuts explicites : détecté, incomplet, conflit, hors fenêtre, éligible, publié, erreur temporaire, exception à traiter. Enregistrer champs présents/manquants, sources tentées et images absentes ; « absent confirmé » distinct de timeout/HTTP500/schéma invalide. Une erreur ne vide jamais une bonne fiche.

Essayer les sources configurées dans l'ordre pour **chaque champ manquant**. Ne pas écraser une valeur valide ou une correction ADMIN ; proposer les divergences. Vérifier les changements de schéma avant ingestion ; sérialiser la publication d'une même identité, contrainte unique et replay sans duplication. Retrys bornés, délais/backoff avec jitter, prochain passage quotidien ; budget global et concurrence faible, pas de boucle infinie. Logs techniques expurgés, ni tokens ni contenu privé.

### Stockage durable sans redéploiement frontend

Aujourd'hui : `public/assets/` embarqué dans Pages. Cible proposée pour le prochain lot : stockage objet **Supabase existant**, bucket dédié aux seuls assets publics du catalogue, lecture publique, écritures exclusivement backend/importeur et upload ADMIN authentifié via le même owner. [Modèle officiel des buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) : un bucket public autorise la lecture publique mais ses écritures restent contrôlées. Vérifier les quotas du projet et les coûts effectifs avant activation ; aucune création de bucket/service/abonnement dans le lot 1, aucun nouveau service payant autorisé.

Objets immuables `characters/<stable-id>/<role>/<sha256>.png`, MIME et limite de taille imposés, cache long immutable ; remplacement par nouvel objet puis référence atomique. Le backend valide les domaines sources et chaque redirection, refuse adresses privées/localhost, tailles excessives, MIME trompeur, fichier corrompu, dimensions/rôle incorrects et absence de contenu visible ; télécharger en flux plafonné et décoder avant publication. Nettoyage différé des objets réellement non référencés, jamais suppression sur panne source. Pas de secret Storage dans le navigateur. Le DTO continue de renvoyer des chaînes de chemins/URL ; valider les URLs publiques autorisées et les politiques CSP/cache lors de cette extension. Les chemins locaux restent compatibles. Ni disque éphémère Railway ni hotlink externe comme stockage autoritaire.

## ADMIN : exceptions et notification, prochain lot

Réutiliser [Modération > Personnages](../specifications/administration-moderation-v1.md), son owner et ses permissions. Vues complètes/incomplètes, filtre assets manquants, candidats en attente, erreurs actionnables et derniers imports. Ajouter/modifier dans la modale prévue, sans refonte générale. Upload manuel passe par la même validation/stockage ; pas de SQL/JSON libre. Classe/passifs internes et conflits sont les principaux arbitrages humains ; les cas fiables nominaux s'importent automatiquement.

Après commit d'un nouvel import seulement : notification ADMIN persistante « Nouveau personnage ajouté : <nom> » → destination canonique Modération > Personnages + ID stable ouvrant la fiche exacte. Clé unique par import/Character et outbox/retry après commit, pas de doublon au redémarrage. Afficher données trouvées, manquantes, provenance, images et action attendue en français. Une simple tentative échouée ne produit pas une notification d'ajout. Réutiliser le socle Notification existant après étude de sa cible ADMIN, sans diffuser aux joueurs. Aucune notification ni adaptation ADMIN structurante implémentées ici.

## Mitya : dry-run réel du 10/10/2026

[Rapport reproductible des résultats](evidence/r1051-mitya-dry-run-20261010.json). Aucun Character créé, aucune activation ni override.

L'[annonce HoYoLAB](https://www.hoyolab.com/article/46884007), récupérée par [getPostFull](https://bbs-api-os.hoyolab.com/community/post/wapi/getPostFull?gids=2&post_id=46884007), a répondu HTTP 200 / retcode 0. Auteur UID `1015537`, « Genshin Impact Official », certification `Official Big Boss` ; le flag de post `is_official` vaut pourtant false : ne pas utiliser ce seul flag comme arbitre. Le texte primaire du 29/09 confirme individuellement nom, titre **Rules Set at Naught**, fonction **Specialist, Royal Energy Commission of Snezhnaya**, affiliation Snezhnaya, **Stellar Linchpin: Electro**, constellation **Nodus Gordianus**. Pas de traduction française officielle inventée.

Rareté, arme, ID numérique et date officielle restent non confirmés. Date attendue **04/11/2026** communiquée par le propriétaire : hors fenêtre J-7 au 10/10, et insuffisante comme preuve officielle. Fiche française genshin-db `mitya.json` : **HTTP 404 au snapshot épinglé**. Le manifeste images de ce snapshot ne comporte pas Mitya. Les reprises Siliconera/Pocket Tactics ont servi de découverte, pas de validation automatique du calendrier.

Trois illustrations promotionnelles HoYoLAB sont réellement téléchargées et décodées (1200×675, 1500×1500, 750×1800), hashes/URL exactes dans le rapport ; elles ne sont pas des portraits UI ni des splash transparents. Probe explicite `https://enka.network/ui/UI_AvatarIcon_Mitya.png` : HTTP 200, PNG 256×256 observé, **candidat non scellé par un manifeste d'identité/finalité**, conservé en preuve privée uniquement. Les probes `UI_Gacha_AvatarImg_Mitya.png` et `UI_Gacha_AvatarIcon_Mitya.png` donnent HTTP 404 ; noms eux-mêmes non confirmés. Une URL devinée qui répond ne prouve ni ID officiel ni asset final. Verdict **import normal bloqué** : calendrier/rareté/identité structurée/finalité des images à recontrôler.

## Recherche remise par le propriétaire et limites

Originaux inchangés dans Téléchargements : `GachaImpact-R1051-recherche-2026-10-10.zip` et `R1051-recherche-sources-et-Mitya.md`. ZIP lu intégralement : dossier MD, audit JSON, candidat Mitya JSON, registre fournisseurs JSON, requêtes SQL READ ONLY. Leur audit historique 120/96/118 a été reproduit, leurs alias rapprochés du manifeste, leurs limites techniques conservées. Les pistes non vérifiées n'ont pas été promues en sources fiables. La recherche ne constituait pas 24 téléchargements réussis ; les 72 binaires et le texte primaire Mitya ont été acquis pendant ce lot. Originaux et captures détaillées sont conservés localement ; ce document et les deux manifestes versionnés portent uniquement les éléments utiles et vérifiés, sans nouveau tracker global.

Empreintes SHA-256 des originaux : ZIP `a7d3fbff69ad5e824fa45b1bc42d17f9a9e4e1a85f93f5a10024704c6ba27b42` ; MD `ea8009237b7ac7eb3033eeb18f6e3b65b9eace00431e6b796dc460b72ad82335`. Les 24 lignes de l'audit fourni ont été rapprochées champ par champ du relevé frais.

Contrôles du candidat : 47 tests frontend ciblés, 9 tests opérateur dont schéma PostgreSQL privé isolé, verify:quick 5/5, build ; génération rejouée sans différence. Les tests couvrent alias, doublons, confusion de rôle/ID, chemins invalides, PNG corrompu, réponse SPA/404/panne, disponibilité par hash, non-écrasement, plan READ ONLY, rollback intégral et replay. GameShell avec CSS réel aux trois viewports 390×844, 1366×768, 1920×1080 : 15 états Box/Catalogue/Team/Invocation/fallback, aucun débordement horizontal ni erreur JS, aucun appel joueur réel ; planches des 72 nouveaux fichiers inspectées. Le patch conserve le contrat DTO existant (chaînes d'assets seulement). Build avec warning préexistant de chunk >500 kB. Pas de campagne PostgreSQL économique ni de recette Auth répétées.

R1051 reste actif : automatisation quotidienne, persistance des candidats/tentatives, stockage objet, imports futurs, notification et adaptations ADMIN à livrer dans les lots suivants. Domaine/SMTP suivent un chantier opérationnel séparé. Aucune nouvelle mission métier lancée automatiquement.
