# GachaImpact — Cahier de suivi maître / Mega récap projet

Version : Mission du 10/10/2026 — candidat R1058 et compléments Codes/Event.
Date : 2026-10-10
Statut : **R1058 et compléments Codes/Event publiés sur review ; deux findings P2 de la revue indépendante corrigés et testés, re-review du correctif requise. Promotion et déploiements suspendus aux gates Auth : configuration opérateur et délivrabilité non démontrées.** R1053 reste livré ; premier tirage naturel et recette humaine des nouveaux états encore futurs.
But : porter l'état réel, les preuves et la prochaine reprise.

## Point courant — R1058, Codes/Missions et restitution du tirage Event

Base réelle vérifiée par fetch et connecteur GitHub : `main = review = fab14c3ba83987befe08f1dc7fb94d812f51e572`, divergence 0/0, worktree initial propre. Mandat consolidé du 10/10 autorisant le cycle complet sous gates ; aucun commit concurrent trouvé. Eclipsia/Story, économie, RNG et identités hors modification.

**Publication et revue initiale :** `068ca64ca0bf9e9325217363ed0e35b159abbf5c` publié sur review, métadonnées/diff/blobs GitHub inspectés indépendamment ; verdict **CHANGES_REQUESTED**, deux P2 reproduits. Ce correctif dédié rétablit le retry après échec d'envoi de nonce et propose un renvoi indépendant du formulaire ; il conserve le découpage Unicode historique des strings internes longues avant composition avec les Missions. Tests de reproduction ajoutés, dont la vraie validation `publishGameResult` sans DB. Le retour d'erreur/rejet de fermeture recovery est aussi filtré et distingué du mot de passe déjà modifié ; le SDK retire déjà la session locale sur les erreurs réseau/API ordinaires, aucune faille de conservation n'est prétendue. Re-review requise sur le nouveau SHA publié, sans prendre les tests acquis pour une approbation indépendante.

**Candidat physique :** Compte → Sécurité (indépendant du statut Twitch), mot de passe oublié avec confirmation neutre et récupération native Supabase sur `/auth/recovery`. Client de récupération isolé avant AuthProvider/AppBootstrap, vérification native puis `getUser`, aucune création/restauration Player ou application R1055. Confirmation/longueur, verrou anti-double appel, erreurs filtrées, réauthentification native et champs effacés. SDK 2.115.0 inspecté ; attribut physique `current_password`. [Contrat Auth](../architecture/backend-architecture-v1.md#password-recovery-r1058).

Codes/Missions : assembler commun Twitch/chat interne, ` | ` entre annonces et 🎯 devant chaque Mission ; continuation intacte dans le budget effectif, résultats anciens figés et gains inchangés. Event : fan-out SQL transactionnel à tous les ACTIVE sauf gagnant, déduplication édition/Player, notifications personnelles et ADMIN conservées ; Historique après Top 10, nom scellé ou « Progression archivée », états sans gagnant fidèles et DTO sans données privées. Pas de migration supplémentaire ni reprise économique de COMPLETED. [Contrat Event](../architecture/event-monthly-draw-r1053.md#compléments-de-restitution--mandat-du-10102026), [commandes](../commands/command-reference.md#code).

**Contrôles acquis :** verify:full initial 8/8 (frontend 1 425, backend 2 262), puis delta Auth et SDK natif/Historiques/Notifications **58/58** et verify:quick 5/5. Après corrections de revue : **verify:full renouvelé 8/8, frontend 1 435/1 435 et backend 2 264/2 264**, builds/typages/lint PASS ; logs complets dans `C:\Users\axeld\AppData\Local\Temp\gachaimpact-verify-full-Cwg6tm`. Les tests natifs du SDK simulent le HTTP fournisseur : événement PASSWORD_RECOVERY et session isolée, jamais d'e-mail réel. PostgreSQL privé, fichiers séquentiels : tirage **15/15**, Historique **4/4**, Codes enrichis **24/24**, pipeline Twitch signé/replays **31/31**. Fixtures nettoyées, aucune donnée métier publique de test. Captures du vrai GameShell/CSS compilé et formulaires d'entrée : **15 états/captures**, dont le renvoi de nonce sur 390×844, 1366×768 et 1920×1080, inspectés ; aucun débordement horizontal, erreur navigateur ou appel externe. Avertissement de chunk >500 kB et dépréciation pg préexistants. Les premiers échecs d'environnement de fixtures, syntaxe TypeScript, invocation npm PowerShell et chemins d'un script privé restent des échecs initiaux corrigés, pas des PASS ; logs privés conservés sous `local-data/identity-resolutions/r1058-20261010/` et les dossiers verify temporaires référencés.

**Gates réellement ouvertes :** aucun accès navigateur opérateur disponible (inventaire vide, navigateur iab indisponible), aucun accès Management Auth configuré. L'allowlist exacte `/auth/recovery`, le template, l'expiration, SMTP/expéditeur, la politique effective et les quotas ne sont donc pas vérifiés. Une boîte contrôlée explicitement autorisée a été demandée ; aucun e-mail n'a été envoyé ni reçu dans cette mission, aucun mot de passe public modifié. La réception et le parcours public ne sont pas prêts à être déclarés validés. [Configuration requise et limites](../deployment/free-first-v1.md#r1058--configuration-et-preuves-requises).

Preflight public RO du 10/10 à 11:19 UTC : `/` et `/auth/recovery` HTTP 200, même SPA actuelle ; health 200/status ok. Auth settings publics : fournisseur e-mail activé, signup autorisé, autoconfirm false ; ces settings ne prouvent pas les redirects privés ou SMTP. PostgreSQL public : 69 migrations appliquées, **0 tirage / 0 opération récompense R1053**. Aucun tirage, claim rare ou paiement public provoqué. Ces contrôles portent le déploiement de base, pas le candidat.

**Reprise exacte :** reviewer indépendamment le SHA réel du correctif publié ; acquérir les gates configuration/e-mail avant fast-forward main et déploiements/postflight. Ne pas promouvoir le candidat global avec ces gates manquantes. Aucune recette humaine nouvelle présumée. Après clôture de ce mandat seulement : **R1051 — Catalogue Character**.

**À tester en public après livraison :** compte Web contrôlé (modifier, déconnecter/reconnecter, demander/réceptionner un lien, réinitialiser, progression/Twitch intacts) ; observer une Mission naturelle sans nouveau claim rare ; Historique et notices après le premier vrai tirage du **1er novembre 2026 à 00:00 Europe/Paris**, sans faux gagnant en septembre.

## Historique acquis — R1053 et messages Event, mandat complet du 10/10/2026

Base distante vérifiée `17ed0397c59c57e8683334b4c725925bb3cac71b`, main/review communs, divergence 0/0 et worktree initial propre. Le mandat autorise développement, tests, review indépendante du SHA publié, fast-forward, migration normale, déploiements et postflight, sans nouveau GO entre gates. Aucun Eclipsia/Story ni R1058. La production vivante suit le workflow existant : contrôles économiques ciblés, aucune comparaison globale d'activité naturelle.

Implémentation livrée : persistance privée activation/résultat par édition (migration additive 069), graine réservée et poids/position scellés, calcul exact BigInt et HMAC/rejet, verrou d'édition et garde des points tardifs, attribution unique de +1 Stella via le propriétaire Codes, notifications gagnant/ADMIN atomiques. Scheduler au démarrage, clôture Paris, rattrapage et arrêt. Aucun paiement historique ; première édition éligible déterminée durablement lors de migration. `Tirage.txt` retrouvé dans les archives autorisées, deux copies identiques et lues, sans réutilisation du moteur manuel legacy. [Architecture, invariants et sources](../architecture/event-monthly-draw-r1053.md).

Messages : IDs/indices durables entre présence, activité et receipt Twitch ; `viewedAt` et agrégat actualisés avec l'accusé SENT de tous les segments concernés seulement. Échecs, ambiguïtés et SENDING interrompu conservés ; consultation standalone et nouveau message cohérents, aucun compteur expéditeur. Réconciliation historique du jour limitée aux preuves précises complètes, sans suppression/renvoi ni déduction à partir d'une BusinessOperation préparée.

Contrôles non-DB acquis : verify:full initial 8/8, puis suites complètes renouvelées frontend **1 392/1 392** et backend **2 250/2 250** ; derniers deltas couverts par 129 tests ciblés, build backend et verify:quick 5/5. Build frontend réussi, avertissement de chunk >500 kB préexistant. Notifications synthétiques dans le vrai GameShell/CSS sur quatre viewports 390/1366/1920/2560 : mesures et captures inspectées, aucun débordement ni appel externe. Aucune fixture ne vaut recette humaine.

PostgreSQL privé acquis : **149 cas distincts sur plusieurs passages**, tirage 13, messages 18 après durcissement historique, Codes enrichis 24, six suites Event 45, pipeline signé 31 et GLOBAL 18. Pilote : 30 PASS puis trois cas ciblés après correction de l'assertion de reprise FAILED (28 déjà acquis non relancés dans ce passage). GLOBAL : 17 cas PASS puis charge ciblée PASS avec délai de campagne 600 s ; huit clients/pool3/48 nouveaux privés, 44 conservés, toutes les assertions maintenues, 289 requêtes/245 réponses, zéro erreur/perte/doublon/verrou en attente et cleanup/pool fermé. P95 **23 767,78 ms**, moyenne 9 418,09 ms, durée 440,34 s setup compris ; aucune garantie de latence publique déduite. Le passage précédent à délai 360 s reste marqué timeout, même si ses assertions finissaient ensuite. Migration 069 réellement appliquée et enregistrée en privé, checksums/status, RLS/droits et triggers contrôlés. Les échecs de compilation/mocks, assertion Codes obsolète, timeout d'acquisition et délais restent dans les logs avec corrections explicites, sans être présentés comme PASS. Preuves privées sous `local-data/identity-resolutions/r1053-20261010/`.

Publication et review : **b228e38989e7ca8e1e6f0709540c27e2d17d3a75 APPROVED**, diff/36 blobs GitHub vérifiés par auteur et reviewer distinct, 172 tests indépendants PASS (160 backend/12 frontend), aucun finding établi. Rapport privé `review-independent.md`, SHA-256 `7ec72f3a2e62b1fbc82ab0e04330742390dd543d2bc8bb09d8dd9508e6529168`. Fast-forward strict réalisé après gates ; main/review distants communs b228e38, divergence 0/0 et worktree propre contrôlés avant cette clôture documentaire. Celle-ci ne change pas le code approuvé ; ses éventuels builds sont contrôlés séparément au rapport final, sans commit recopiant son propre SHA.

Déploiement applicatif : Railway **10bb5ae1-7f21-46e6-80fc-2e93b31a46bd SUCCESS** à 10:38:00 UTC ; Cloudflare **856ca732-0777-405d-b8dc-a15dc5aed95c SUCCESS**, SHA exact b228e38, HTTP 200 et assets JS/CSS production/preview identiques octet par octet. Health 200/status ok à 10:38:21 UTC. Runtime Online 1/1, aucun crash/incident ou pending work. `EVENT_MONTHLY_DRAW_SCHEDULER_ACTIVE`, processed 0, journalisé par ce déploiement à 10:37:54 UTC. Entrées stderr Prisma de configuration et avertissement pg `client.query()` classés comme informations/dépréciation, sans erreur applicative établie.

Migration publique normale **069** appliquée le 10/10 à 10:37:36 UTC : registre 69 terminé, checksums Git des 69 conformes, `prisma migrate status` à jour, nouvelles tables privées/RLS/droits/contraintes/triggers actifs vérifiés. Checksum 069 `5dca6f8f95ef8da7812e7c0f10e4189e37ab76c70990f48e79860b1b39060829`. Activation durable au début d'octobre Paris, 30/09 22:00 UTC ; **première clôture naturelle le 01/11/2026 à 00:00 Europe/Paris (31/10 23:00 UTC)**. Aucun vrai tirage, gagnant ou crédit R1053 encore exécuté. Premier script RO de postflight corrigé pour caster la métadonnée PostgreSQL `char` en texte ; son échec conservé, relance complète PASS, aucune mutation provoquée par ce diagnostic.

Intégrité ciblée : backups cohérents RO avant 10:34:36/après 10:38:57 UTC, SHA-256 `38edf17472c56d4d39c880146c37cd3b2d226100ae898395bc0a0cd2061e0bf6` / `7fbc91d5a35a816d86d4906eb8410f5a3a3da0ab516f38242771546eace5c96e`. Deux éditions, **22 participations et 47 stocks Stella strictement identiques**, zéro draw/opération récompense/acquisition R1053. Aucun audit global d'activité naturelle. Cas signalé Plumereveuse66 : backup privé fsync avant correction, un message du jour confirmé lu par les preuves complètes, historique et opérations inchangés ; vérification RO à 10:40:51 : zéro non-lu du jour, zéro agrégat actif, deux anciens agrégats RESOLVED. Backup/proof SHA-256 `50b29b6854598f2408c913cff76dc4518226fa463cfa4111edc09eb2a34788be` / `b644b0253e03448289fad8a054797ca313bfc1fdc3dee66695120b557378029c`. Aucun renvoi, receipt SENT fabriqué ou récompense de recette.

Transport à 10:40:03 UTC : contrôle SQL/configuration Railway/Helix RO par propriétaires canoniques, **GLOBAL révision 19, 44 cibles persistées et Chat ACTIVE**. Aucun GET authentifié du processus ni session navigateur de joueur ou recette humaine inventés.

**À tester en public :** sur réception naturelle, mention 📬 avant consultation, disparition après tous les segments Twitch confirmés, retour avec un nouveau message et cohérence du standalone. Pour R1053, consulter seulement un résultat réel après la clôture naturelle ; aucun faux participant, changement de points ou gain artificiel. Après ce mandat : **R1058 — mots de passe**, non commencée ; Eclipsia/Story intouchés.

## Historique acquis — six correctifs post-recette du 10/10/2026

Le propriétaire juge le fonctionnement général du lot A–J satisfaisant après recette Twitch/standalone et valide six retouches : cadre Box et filtres compacts du picker Team, !banner, avertissement Jeu C non envoyé, résumé Event ordonné, groupes Code/Paliers, résultat Ticket modernisé. Base distante vérifiée d564e4ba1493686715fb295b45ec63d4c0203d5e commune main/review, divergence 0/0, worktree initial propre ; le seul commit depuis 1fe3008 précise la production vivante et reste conservé. [Contrats courants](../commands/command-reference.md), [suivi et preuves](../architecture/command-fixes-20261010.md#suivi-post-recette-af-du-10102026).

Périmètre : présentation commune Chat/Twitch et CSS, avec seul ajout facultatif rewardResourceBalanceAfter au résultat transactionnel Ticket. Pas de migration, changement d'économie/RNG/règles/permissions, import, réparation, transport ou auth. Les anciens messages gelés et reçus dépourvus de total secondaire sont préservés. Production vivante appliquée selon d564e4b : aucun snapshot économique global ni enquête sur les activités naturelles hors lot.

Contrôles acquis : verify:quick 5/5, verify:full 8/8 (1 390 frontend, 2 220 backend non-DB), 11 tests Shop PostgreSQL en schéma privé, quatre viewports GameShell/CSS et 12 captures. Dernier ajustement singulier Mora/Primogemme réutilisant le formatter : 195 tests ciblés PASS et build backend réussi après ce passage complet. Review indépendante **APPROVED de 7a5e59990748ec344bc6adce856b6f6107a2303a** : diff/23 blobs GitHub vérifiés, snapshot/replays relus, 138 tests indépendants PASS et quatre viewports recontrôlés ; aucun finding établi. Rapport privé review-independent.md, SHA-256 f2d954d2b69938082f5d132ff0ea5e69c23d3a69af804acaf162f16be943c178.

Fast-forward strict du candidat approuvé effectué ; main/review distants communs, divergence 0/0 et worktree propre vérifiés. Railway **76c52786-e4d6-48a1-896c-074d1e12b797 SUCCESS** à 08:33:41 UTC ; Cloudflare **e4a05acc-1f89-4041-a61f-48871651031e SUCCESS**, SHA exact 7a5e599, assets JS/CSS publics strictement identiques au build et HTTP 200. Health 200/status ok à 08:34:22 UTC. Une réplique saine, aucun crash/incident actif ; les trois entrées stderr Prisma de chargement de configuration/schéma ne sont pas des erreurs applicatives. Transport à 08:34:51 UTC : SQL/configuration Railway/Helix en lecture seule, GLOBAL révision 19, 44 cibles persistées, Chat ACTIVE ; aucun statut HTTP authentifié du processus ni nouvelle commande publique revendiqués. [Preuves et limites](../architecture/command-fixes-20261010.md#suivi-post-recette-af-du-10102026). Cette clôture documentaire ne change pas le code approuvé ; ses éventuels nouveaux builds sont contrôlés séparément dans le rapport final.

Prochaine mission métier : **R1053**, non commencée. R1058, Catalogue et suite restent dans l'ordre existant. Recette humaine minimale encore attendue : banner/event/erreur syntaxe Jeu C/sélecteur Team ; Codes et Ticket seulement si observés naturellement, aucun achat ni claim rare demandé. Eclipsia/Story intouchés.

## Historique — mission consolidée A–J du 10/10/2026

Le mandat remplace l’attente de passation : Ticket Moras, résolution personnelle/tierce exacte des Légendes, création/réutilisation atomique Team, modale à grille seule scrollable, description conversion, missions permanentes/résumé distinct, horaires Event, Quotidiennes et composition Combat sont implémentés. Le cycle permanent review → review indépendante du SHA → main ff-only → déploiements → postflight s’applique sans nouveau GO lorsque les gates passent. [Contrats et preuves du lot](../architecture/command-fixes-20261010.md), [workflow permanent](../process/implementation-workflow.md).

Bootstrap : review f10d335a066ee2ab68267f29b4915b4a262a6824, main 2aa7dd584effa421ff804dcd850ab3bbcdc9d8ff, divergence review +2/−0 ; commits documentaires 5317c38/f10d335 conservés. Aucun import, réparation économique, changement d’autorité, migration Prisma, nouvelle infrastructure ni mécanisme d’authentification. Les contrôles existants Railway/Cloudflare/health/SQL/Helix sont réutilisés ; leur niveau de preuve reste explicite.

Contrôles : verify:full 8/8 (1 390 frontend, 2 176 backend non-DB), verify:quick 5/5, PostgreSQL privé 78 PASS sans exclusion ; GameShell/CSS aux quatre viewports. La review indépendante de 9b23ed9 a détecté le filtre Élément mobile tronqué ; correction responsive et bornes de chaque contrôle revérifiées. Verdict indépendant **APPROVED de 81223a9c5fc8ef7432267a0353b879b9c67289c6** : 35 puis 7 blobs GitHub, 157 tests ciblés indépendants et quatre viewports recontrôlés. Rapport privé review-independent-delta.md, SHA-256 7457c500dd0de055f8386f18e2f9a0cefbba8fc1a80280f3e1e6f8ee244943fe. Fast-forward strict effectué, refs distantes communes et divergence 0/0 vérifiées avant cette clôture documentaire ; les refs GitHub portent le SHA du checkpoint documentaire final sans recopier son propre hash.

**Déploiement applicatif du 10/10 :** Railway 365541dd-0fbb-4488-9f19-cdac9423be4d SUCCESS au SHA applicatif 81223a9, Online 1/1, zéro crash/pending work ; Cloudflare 61dca8e1-9b54-4945-be52-a9fa028a5acc SUCCESS au même SHA, assets production/preview identiques octet par octet. Backend health 200 à 07:05:55 UTC. Logs pertinents : messages informatifs de chargement Prisma classés stderr, aucun échec opérationnel observé dans cette fenêtre. Les déploiements R1065 conservés ci-dessous ne sont pas utilisés comme preuve A–J.

**Intégrité fraîche :** captures RO cohérentes de 144 tables à 06:51:17 et 07:06:32 UTC, 12 339 contrôles PASS, 143 tables exactes ; seule variation : last_heartbeat_at d’une session, tous ses autres champs identiques. 54 Players conservés, 44 historiques/targets/imports intacts, Céo ARCHIVED/Ceotryd ACTIVE/NATIVE, StreamElements et exclusions/quarantaines inchangés. Zéro nouvelle opération et mouvement économique, zéro PENDING/receipt bloquant/annonce incertaine ; 68 checksums et statut Prisma conformes, backup complet validé conservé. [Détails et limites](../architecture/command-fixes-20261010.md#déploiement-et-postflight-du-candidat-approuvé).

**Niveaux runtime :** configuration Railway activée, DB GLOBAL révision 19 et Chat ACTIVE inspecté réellement via Helix/callback canoniques. Processus servi attesté par déploiement exact, replica et HTTP ; aucun GET authentifié du statut opérateur ni fausse session. Zéro nouveau receipt de commande entre démarrage réussi et capture postflight : l’exécution utilisateur des nouveaux textes après restart n’est pas confirmée. Aucun achat Ticket, Combat, claim ou ressource rare consommé pour une recette ; le rapport fournit seulement la courte recette humaine de présentation restante.

Les recettes de nouveaux comptes R1064 restent différées. R1053 sera la prochaine mission fonctionnelle après clôture de ce lot, non commencée ; R1058, Catalogue, UX et bêta restent ensuite dans l’ordre durable. Eclipsia et Story hors périmètre.

## Historique — passation officielle du 10/10/2026 (supersédée par le mandat A–J)

**Git :** main/origin/main = 2aa7dd584effa421ff804dcd850ab3bbcdc9d8ff ; base review vérifiée = 5317c38eb27af6f08a72f41c2500a0bc65dc177b (clôture R1065, ahead 1). Cette passation ajoute un seul commit documentaire au-dessus de cette base, publié uniquement sur review ; divergence finale attendue et contrôlée : main behind 2/review ahead 2. Le SHA du nouveau checkpoint est fourni par le rapport et les références GitHub, sans commit supplémentaire pour recopier son propre hash. Les commits 5914d9c/706bcfd/2aa7dd5/5317c38 et leurs preuves restent conservés.

**État connu, sans nouvelle capture économique :** Railway ca2ae190-c788-4e22-bc55-8f28d472b1f6 SUCCESS, Online 1/1, aucun pending work, recontrôlé en lecture seule lors de cette passation ; Cloudflare 80ff253d-44a0-4c93-bfb5-86807ec2c905 SUCCESS au SHA main, assets live/preview identiques et HTTP 200 recontrôlés. Prisma 68/checksums/status, autorité GLOBAL 19/Chat ACTIVE et gate humaine restent les derniers contrôles acquis du postflight R1065 du 09/10, non une nouvelle preuve SQL/runtime du 10/10. Aucun SQL public exécuté pour ce checkpoint. Le dernier audit conserve les 44 historiques et constate 54 Players ; le total peut évoluer naturellement sous GLOBAL. Céo A ARCHIVED/Céotryd B ACTIVE/NATIVE et StreamElements restent protégés.

**R1065 clos, ne pas rouvrir sans nouvelle preuve :** alias !votes, Banque française, Stella positive dans !sac, Quotidiennes Terminé ✅, présentation XP, CADEAU_PHASE1/paliers, optimisation des notifications et miroir Docker officiel acquis. Détail et limites dans l'historique ci-dessous et l'[audit R1065](../architecture/supabase-stabilization-r1065.md). Le complément indépendant final postsmoke est PASS_WITH_OBSERVATION, 284/284 contrôles, neuf écarts attribués, aucun gain/perte inexpliqué ; preuve privée review-smoke-postflight-independent.md, SHA-256 896115b5c64ed04384594a71c1a26bea36685d6df5788a704688cadcbf8e8f40. Clôture documentaire 5317c38 APPROVED indépendamment ; historique Master préservé. Les trois recettes de nouveaux comptes R1064 restent différées par arbitrage propriétaire, sans les redemander.

**Deux défauts ouverts, corrections décidées mais non réalisées :** !shop ticket affiche le gain Moras sans « remboursement » ; le prochain lot explicitera ce seul type de résultat avec prix/solde/gains persistés intacts, sans achat payant public de recette. !legende skirk cherche actuellement un joueur et échoue ; les formes personnelles à un ou plusieurs mots doivent être prises en charge avec les formes tierces/moi/@ existantes, résolution déterministe d'ambiguïtés et confidentialité BOX/GENERAL_STATISTICS préservées. Cinq caractéristiques avec emojis, Concours/victoires/titres/thèmes conservés. [Contrats cibles et critères, distincts du code actuel](../commands/command-reference.md#correction-décidée-le-10102026--cible-à-implémenter-défaut-encore-ouvert), [Ticket](../commands/command-reference.md#correction-ticket-décidée-le-10102026--cible-à-implémenter-défaut-encore-ouvert). Sources et propriétaire moderne y sont référencés ; aucune modification du resolver ni des scripts.

**Directives permanentes :** le jeu reste actif ; expliquer les écarts BEFORE/AFTER par fenêtres exactes, opérations, receipts, owners, IDs, montants et unicité. Une activité légitime n'est pas une régression ; un écart inexpliqué n'est jamais ignoré. Privilégier les preuves automatiques authentiques en lecture seule, sans confondre SQL/configuration et processus effectif ; pas de F5 répétitif pour un document ou une preuve équivalente déjà acquise. Un diagnostic opérateur sûr reste à étudier/développer sous mandat futur avec tests/review indépendante, sans secret partagé ni endpoint public non sécurisé. [Source opérationnelle unique](../process/implementation-workflow.md#production-vivante-et-comparaisons-beforeafter--directive-propriétaire-du-10102026), [contrôle autonome](../process/implementation-workflow.md#vérifications-autonomes-après-déploiement--directive-propriétaire-du-10102026). Aucun nouveau mécanisme d'authentification livré ou autorisé ici.

**Prochaine reprise exacte :** attendre l'ouverture des deux nouvelles conversations ChatGPT et Codex. Appliquer le [bootstrap de passation](../process/conversation-handoff.md), vérifier le vrai GitHub et reformuler le contexte en lecture seule avant confirmation du propriétaire. Le prochain mandat pourra regrouper les deux correctifs et le contrôle autonome sûr ; ensuite seulement **R1053 — tirage mensuel Event**, contrat inchangé : clôture d'édition, points > 0, un point = un ticket, un gagnant, +1 Stella, scheduler/catch-up exactly-once, aucun reroll/double gain/historique inventé. [Contrat Event](../legacy/16-event-monthly-audit.md#tirage-de-clôture-mensuelle-event--r1053-à-implémenter), [séquence durable](../roadmap/implementation-order-v1.md). Puis R1058 mots de passe, Catalogue R1051, UX R1052, finitions/mobile, bêta et validation finale. Ne commencer aucun de ces travaux dans cette conversation de passation.

## Historique acquis — clôture R1065 du 09/10/2026

Correctifs livrés : alias !votes partagé avec vote et Help, montants Banque français sans conversion BigInt, synthèse Quotidiennes « Terminé ✅ » lorsque toutes les activités applicables sont terminées, Stella positive en dernier dans le Sac, présentation française 🎉 des récompenses XP normales/max avec soldes capturés dans la transaction et réponses Twitch gelées. Aucun changement de règles XP/RNG/cooldown, réimport ou réparation économique.

**Recette réelle R1057 désormais acquise :** le propriétaire a créé/publié puis réclamé CADEAU_PHASE1 sur Twitch. Lecture seule : un claim Kichnifou le 09/10 à 20:15:20 UTC, +30 000 primos, +1 000 000 Moras, une acquisition Stella, +30 points et +30 monnaies Event directs ; nouveaux paliers 20/30/40, +1/+2 Bonbons et +500 Cryo. Total monnaie +33 conforme, opérations COMPLETED et mouvements justifiés. Le Code et ses claims restent intacts. Après déploiement, le propriétaire confirme la distinction directe/bonus et l'aperçu sans anomalie. [Contrat R1057](../architecture/gift-code-enriched-r1057.md).

**Stabilisation Supabase :** plan Free vérifié, base 77,75 MB, instantané 18 connexions/max 60, fenêtres logs réelles 24 h/sept jours. Mesures cumulatives PostgreSQL depuis le 07/10 distinguées des fenêtres. Réconciliation Codes : même lecture étendue, UPDATE identique évité ; réactivation RESOLVED, créations, modifications et contrôles de résolution conservés. Mesure publique naturelle du 09/10 21:31:34–21:32:59 UTC : **168 nouveaux lookups, zéro UPDATE payload/actions**, autres signatures observées inchangées. Aucun gain financier, egress ou P95 globale attribué. Aucune purge/nouvelle infrastructure. [Audit et limites](../architecture/supabase-stabilization-r1065.md).

**Tests et review :** verify:full 8/8, 1 389 tests frontend / 2 136 backend non-DB ; PostgreSQL privé 106 PASS et un test de métadonnées explicitement exclu après cause CRLF prouvée. Les 68 checksums LF publics et Prisma status sont conformes séparément. Vingt-quatre états visuels synthétiques du vrai GameShell/CSS sur quatre viewports, F5 et captures desktop/mobile inspectées. Backup applicatif RO complet, listé/décodé/fsync conservé. Review indépendante APPROVED de 706bcfd : 32 blobs GitHub, 37 tests serveur/112 frontend distincts ; review distincte APPROVED de 2aa7dd5 : quatre blobs GitHub et équivalence de l'image revérifiée. verify:quick final du correctif build 5/5.

**Incident de build résolu :** quatre tentatives depuis main ont échoué avant compilation sur Docker Hub node:24-alpine HTTP 429, dont le retry explicitement demandé par le propriétaire. L'image existait et répondait 200 localement ; quota exact/reset du builder Railway non accessibles. Les deux FROM passent au miroir officiel Docker ECR Public, épinglé au digest ebfe2f90… ; index et manifeste linux/amd64 téléchargés depuis les deux registres, hashes recalculés et octets identiques, mêmes configuration/layers référencés. Aucun compte, région, service ou plan provisionné. Le nouveau build a compilé et démarré normalement ; les quatre échecs historiques ne constituent pas un incident actif. [Diagnostic et provenance](../architecture/supabase-stabilization-r1065.md#résolution-du-build-docker-hub).

**Déploiements exacts :** main est 2aa7dd584effa421ff804dcd850ab3bbcdc9d8ff, Railway ca2ae190-c788-4e22-bc55-8f28d472b1f6 SUCCESS/Online 1/1, aucun pending work/replica crash ; Cloudflare 80ff253d-44a0-4c93-bfb5-86807ec2c905 SUCCESS, assets live/preview identiques. Health 200, Prisma 68/checksums/status et transport canonique GLOBAL 19/Chat ACTIVE frais conformes. Aucun GET authentifié du processus ni session navigateur inventés. Le propriétaire confirme après F5 les autorités GLOBAL et les quatre indications runtime ON.

**Intégrité après déploiement :** comparaison cohérente RO de 144 tables, 54 Players dont 44 historiques conservés ; 139 tables exactes, un message réel explique trois opérations COMPLETED, +1 XP et compteur, un receipt PROCESSED ; deux heartbeats seuls. Zéro mouvement économique, claims/Event/Boss/Giveaway/social exacts, identités/targets/imports conservés. Audit indépendant **175/175 PASS**, Céo A ARCHIVED/Céotryd B ACTIVE Web+Twitch/NATIVE et choix R1055 préservés. Rapport privé review-final-postflight-independent.md, SHA-256 e2202a4f58422d1963eb9a42bde0a9f381bd22063c83355d420c95d1b9a33e58. StreamElements intact.

**Recette publique acquise :** le propriétaire confirme Codes et les trois nouveaux messages !votes, !banque, !sac. Leurs hashes correspondent exactement aux textes demandés, trois IDs distincts, args vides, trois receipts PROCESSED et réponses SENT avec IDs Twitch ; 47/156/190 caractères maximum mention réservée comprise, aucune entrée de secours tronquée. Banque française et Stella positive en dernier vérifiées. Aucun vote avec argument, claim, tirage, achat ou montée de niveau provoqué. Quotidiennes complètes/reset et messages XP restent validés techniquement en privé ; aucun franchissement public artificiel ni validation visuelle humaine non réalisée n'est revendiqué.

**Capture après la recette :** snapshot RO 1791581793070 (SHA-256 7c5f3ad9b4a50bd6072db5f00b4664bfa3d49c03f5d5359f539bb386c4ab37a0), 9 882 contrôles primaires PASS, 135 tables exactes/9 écarts ; 75 opérations COMPLETED et 34 receipts, zéro mouvement de ressource. Une commande Stella volontaire d’un autre joueur, distincte des trois consultations, consomme une Stella (1→0), augmente une copie (18→19) et Intelligence C6 (2→3), conformément à son unique opération/resultSummary/receipt SENT. Le stock Kichnifou reste deux Stella. Les autres écarts relèvent de présence/XP, sessions et refresh automatique du credential Twitch existant (identité/scopes/reward inchangés). Aucune absence globale de mutation économique n’est déduite du seul zéro mouvement de ressource.

**Reprise historique du 09/10 :** R1065 se clôt après les preuves ci-dessus ; R1053 était le prochain domaine fonctionnel annoncé, sans lancement automatique. L'intercalaire correctifs/contrôle autonome décidé le 10/10 est porté par le point courant, sans rouvrir R1065. Les trois recettes neuves R1064 restent différées par arbitrage propriétaire, sans les redemander. Runbook inchangé. Preuves privées et backups préservés sous local-data/identity-resolutions/r1065-20261009/.

## Historique acquis — R1057 après activation GLOBAL R1064

GLOBAL désiré/effectif et Chat ACTIVE sont vérifiés fraîchement par PostgreSQL/configuration/Helix, health 200 et service Online. Le propriétaire confirme après F5 l'affichage GLOBAL et les quatre indications runtime. Le contrôle canonique ne prétend pas être un GET authentifié du processus. Aucun volontaire neuf disponible pour Twitch-only, Web-first puis Twitch et Twitch-first puis Web : le propriétaire accepte de poursuivre sur les preuves techniques et signalera une anomalie lors de nouveaux arrivants. Ces trois recettes humaines sont différées, jamais présentées comme exécutées ; elles ne bloquent pas R1057.

Postflight complet avant/après bascule : 144 tables, 141 strictement identiques ; seules la ligne d'autorité, son unique audit GLOBAL 19 et un heartbeat changent. Aucun nouveau Player/opération économique/mouvement/receipt dans cette fenêtre. Vérification indépendante favorable sur 162 contrôles locaux ; mêmes 44 targets/imports/identités et tous les domaines conservés. Les mutations natives précédentes pendant le développement sont attribuées séparément : 40 opérations COMPLETED, 22 mouvements et 23 receipts, sans delta inexpliqué ni double gain. Backup applicatif complet, décodé/hashé/fsync, sources et captures préservés ; aucune restauration effectuée.

R1064 corrige l'admission atomique après OAuth vérifié, les échos, le drainage concurrent et les réglages sous charge. R1055, le nouveau départ zéro, les 171 exclusions/deux quarantaines et l'absence d'import par pseudo sont préservés. OFF/reprise GLOBAL explicite et retour CANARY sont testés en privé ; aucun arrêt public de recette ajouté. Boss restitue ses quatre membres réellement exécutés et ses gains gelés. [Décision](../specifications/decisions-log.md), [mécanismes et corrections de review](../architecture/twitch-global-r1064.md), [runbook](../process/legacy-cutover-runbook.md#r1064-global).

**Contrôles R1064 acquis :** 48 contenus/blobs GitHub vérifiés par auteur et reviewer distinct ; APPROVED final. Prisma validate, verify:full 8/8, 1 381 tests frontend et 2 115 serveur ; campagne PostgreSQL réelle 67 migrations 47/47, charge 289 requêtes/245 réponses/pool3 sans erreur finale/perte/doublon, P95 1 010 ms local. Douze cas visuels synthétiques du vrai GameShell/CSS PASS. Les journaux d'échecs antérieurs et corrections restent conservés ; aucune fixture ne vaut recette humaine.

**R1057 déployé :** GiftCodeService/Admin/claim/Chat/historique étendus avec Stella, points et monnaie Event configurables. Même inventaire Stella et propriétaires Event ; édition existante ACTIVE/inscription requises, aucun auto-enrollment, tous les nouveaux paliers atomiques/uniques, gains réels persistés. Migration additive 068 avec défauts zéro, sans crédit public. Les claims et dates inconnues historiques restent conservés. Une course annuelle P2002 reproduite avant claim est corrigée par INSERT ON CONFLICT, sans réécriture des éditions existantes. Review P2 corrigé : claim confirmé restitué sans attendre les lectures secondaires ; P3 corrigé : cartes adaptées et vrai bouton de récupération contrôlé. Reviewer indépendant final APPROVED, 37 contenus/blobs/stats GitHub vérifiés. [Contrat et preuves R1057](../architecture/gift-code-enriched-r1057.md).

**Contrôles R1057 acquis :** PostgreSQL privé 68 migrations réellement appliquées/enregistrées et status à jour ; campagne 69/69, puis suite enrichie finale 22/22 avec conservation d'une date Stella inconnue (70 cas distincts au total). EventSub signé/claim réel/retry des réponses gelées après changement de mois, conservation des 44 privés, concurrence, rollback et anciens claims couverts. verify:full 8/8, 1 383 tests frontend / 2 117 serveur ; dernier delta borné Stella/libellé Sac vérifié par PostgreSQL et 11 tests Sac, contrôle statique final verify:quick 5/5 acquis avant commit. Seize états visuels GameShell/CSS réels sur quatre viewports PASS, aucun appel externe ; trois captures inspectées puis restitution joueur relue après ajustement de largeur du texte conditionnel. Après corrections de review : 27/27 tests ciblés, frontend complet 1 385/1 385, build et verify:quick 5/5 ; backend/PG inchangés. Seize états visuels renouvelés avec huit contrôles de cartes, bouton Récupérer focalisé/accessible, zéro récompense débordante. Aucun test synthétique ne vaut recette publique.

**Postflight R1057 :** Railway `4e496c4f-11b2-44d5-9f46-02b747f87f13` et Cloudflare `fb52efb7-59ab-430b-9a8c-dc2c0a957171` SUCCESS, assets publics identiques au déploiement exact, health 200 et service Online sans pending work. Prisma 68 enregistré/checksums Git conformes/status à jour ; colonnes nouvelles à zéro sur les 15 codes existants, CHECK exact validé, RLS/droits privés conservés. Backup applicatif public intégralement décodé/hashé/fsync préservé, aucune restauration. Le transport canonique frais reste GLOBAL 19/Chat ACTIVE avec 44 historiques ; zéro PENDING, receipt bloquant ou annonce Giveaway incertaine. Deux messages réels avant le nouveau déploiement expliquent quatre opérations de comptage, un total de messages augmenté chez un historique et un nouveau profil automatisé StreamElements hors des 44, initialisé sans solde économique. Ce profil et son XP ne valent pas une recette humaine neuve. Audit indépendant final : PASS avec observation, 660/660 contrôles, 17/17 écarts attribués, aucun résidu économique ou d’identité inexpliqué ; 79 claims historiques et anciens graphes conservés. Preuve détaillée et limites au contrat R1057.

**Recette et reprise :** après le redémarrage R1057, le propriétaire confirme F5, autorités GLOBAL, les quatre indications ON et la présence/lisibilité des trois quantités Codes. Les trois parcours de nouveaux comptes R1064 restent différés par son arbitrage ; ne pas les redemander ni les annoncer réussis. Aucun code ni claim enrichi public de recette, aucun import/reimport/OAuth historique rejoué. R1057 disponible techniquement et formulaire validé ; création éventuelle d'un vrai code par décision propriétaire, puis prochaine mission pré-release distincte selon roadmap. Aucun chantier suivant commencé. Preuves R1057 privées sous `local-data/identity-resolutions/r1057-20261009/` et `local-data/r1057-code-visual/` ; preuves R1064 conservées.


<a id="community-complements-20261008"></a>

## Historique acquis — R1063 consolidé

Mandat : terminer Event, Boss, Giveaway et les faits sociaux prouvés, corriger les réponses Twitch dans le même cycle review indépendante → main → déploiement → application contrôlée. [Contrat et diagnostic R1063](../architecture/legacy-domains-r1063.md), [procédure](../process/legacy-cutover-runbook.md#r1063-restauration-domaines).

**Validations R1062 acquises :** F5 Kichnifou, quatre indications runtime confirmées ; consultations de Plumereveuse66 et sélection réelle Yae Miko depuis Twitch, puis Chiori depuis le standalone avec retour correct sur Twitch. Les receipts du 09/10 relus techniquement montrent dix commandes plus une activité, onze terminées et 36 réponses SENT. Une erreur de syntaxe bannière contient un argument invisible U+034F ; aucune troncature serveur prouvée dans la Box de 74 entrées, Yoimiya entière. Nouveau contrat de présentation : 450 caractères Unicode, éléments complets, anciens replays gelés.

**Application publique acquise :** 120 opérations de domaine, soit **40 EVENT + 40 BOSS + 40 GIVEAWAY**, sans blocage ni replay. Neuf participations Event restaurées : **80 points, 128 monnaies restantes et quatre claims de palier sans paiement**. L'édition courante possède douze participants non archivés ; la projection existante affiche un top dix. Les 31 non-participants restent libres de s'inscrire normalement, sans inscription artificielle. Trois instances Boss et leurs 27 contributions sont conservées en preuve distincte des combats natifs ; neuf nouveaux cumuls non nuls, aucun combat recréé ni paiement historique. Une session Giveaway close du 1er octobre est archivée : cinq inscrits, 22 compteurs, un gagnant prouvé, sans nouveau tirage, annonce ou paiement. Un message Event historique non lu est remis en file après ouverture des deux endpoints, sans livraison fictive.

**Social :** quinze des dix-sept faits différés sont matérialisés par l'owner R1056, avec niveaux, dates et états directionnels prouvés : **86 faits matérialisés, deux différés**. Les deux restants concernent des endpoints exclus de la population autorisée, pas des identités à inventer ; ils restent conservés. Aucun transfert automatique de Céo A vers Céotryd B.

**Incident préalable et correction ciblée :** les deux tentatives sous OFF 15 ont échoué avant création de plan, backup ciblé ou journal R1063. La première connexion a été interrompue ; la deuxième prouve un dépassement Prisma de 30 s (38,894 s écoulées) pendant la lecture de sécurité. Le chargement complet des 210 receipts transporte environ 3 Mo, dont plus de 99 % dans les historiques terminés. Le correctif sélectionne en PostgreSQL un sur-ensemble de tous les blocages possibles, puis conserve la décision `receiptSafety` et le contrôle PENDING inchangés. Il s'applique aux gates communautaires et sociales, sans modifier les traitements Gift ni l'autorité. Une mesure publique strictement en lecture seule ramène 41 candidats / 22 592 octets en 350 ms. Équivalence PostgreSQL privée PASS sur 153 cas (58 bloquants / 95 sûrs), corpus synthétique de 3 Mo et les 210 receipts de la capture réelle ; gate privée réelle en 19 ms. Trois suites ciblées, 50 tests PASS, typecheck et lint PASS ; les contrôles complets du lot initial restent acquis.

**Déploiement et exécution :** le correctif `7769be0` a reçu son propre APPROVED indépendant sur les sept vrais contenus/blobs GitHub, après le candidat initial `caaab7c`. Fast-forward strict de main, Railway et Cloudflare SUCCESS au SHA exact, health 200 et assets publics exacts. Les 67 migrations sont suivies par Prisma, noms/checksums Git et contrôles physiques conformes ; aucune écriture manuelle du registre. Backup applicatif complet avant DDL vérifié, 17 sources/manifests et backups ciblés conservés. Une capture fraîche précède OFF 17 à 14:55 UTC ; capacité false réellement déployée, drainage et plans frais avant application. Capacité true redéployée avant reprise des **mêmes 44 targets** en CANARY 18 : aucun transfert, extension, réimport personnel ou GLOBAL. La preuve PostgreSQL/configuration/Helix ne prétend pas être un GET authentifié du processus.

**Postflight public du 09/10 à 15:12 UTC et audit indépendant PASS :** capture complète de 144 tables en lecture seule cohérente ; **1 079 contrôles, zéro échec**, 127 tables strictement identiques et 17 écarts contrôlés exhaustivement. Les 44 targets/imports, deux archives, quatre anciens graphes personnels, 114 opérations de tirage/1 059 résultats et quatre votes sont conservés. Les 120 ouvertures, 138 backups/journaux et 140 audits, comprenant OFF/reprise, sont vérifiés. Aucun paiement, mouvement de ressource ou opération économique hors restauration, aucune double récompense ; le seul écart supplémentaire est le heartbeat d'une session existante, tous ses autres champs identiques. Zéro PENDING ou outbound incertain et aucun nouveau message de recette observé. Preuves privées : `postflight-before-1791557672161.json`, `postflight-after-1791558723556.json`, `audit-postflight-independent-final-20261009.json` sous le dossier R1063 ; SHA-256 du rapport indépendant `304e2801b3ca91dfa647aa0603c8503f43fe8429a59a04187da622e7443bda27`.

**Contrôles et limites :** verify:full 8/8 acquis (1 378 tests frontend, 2 075 backend non-DB), Prisma validate, suites ciblées et répétition PostgreSQL privée complète sous 67 migrations PASS. Interruption/reprise, replay exact, concurrence et conservation économique privée couverts ; les 50 tests du correctif complètent ces preuves sans rejouer les campagnes acquises. Les échecs de capture publique ont conduit à paginer les 144 tables dans le même snapshot, sans limite totale ni champ supprimé ; une comparaison Date/chaîne ISO du helper a ensuite été corrigée et revue. Le premier audit indépendant était INCONCLUSIVE à cause du lecteur CRLF du schéma Prisma : projection corrigée et vérifiée sur dix champs annotés avant le run PASS. Ces outils sont en lecture seule. Toutes les erreurs et preuves sont conservées.

**Recette humaine et correction Boss :** après F5 de `dc02072`, le propriétaire confirme les quatre indications du pilote et les autres écrans demandés. Il signale le détail historique hors écran et seulement deux contributeurs au combat actuel. La première anomalie est reproduite : un sélecteur CSS de liste s'appliquait à la modale imbriquée ; les cartes mobiles pouvaient aussi se chevaucher. Le correctif isole la modale dans un portail, borne sa hauteur et conserve en-tête/fermeture/pagination hors du défilement. Le second constat est exact : le combat natif courant compte Kichnifou et Céotryd ; les trois combats Twitch distincts, déjà archivés par R1063, portent **10/9/8 contributions, soit 27**. Le candidat les expose en lecture seule dans Historique, avec origine « Archive Twitch », état d'octobre « Combat interrompu », identités canoniques et pagination. Aucun rattachement au combat natif, nouveau paiement, import ou restauration supplémentaire. [Contrat de projection et contrôles](../architecture/legacy-domains-r1063.md#recette-boss-du-09102026).

**Validation du correctif de recette :** verify:full 8/8 PASS : 1 380 tests frontend, 2 087 backend non-DB, builds/types/lint/diff-check ; les avertissements lint existants restent présents. Contrôle visuel privé du GameShell/CSS réels sur 1920×1080, 1366×768, 2560×1440 et 390×844 : 14 cas PASS, 54 captures, fenêtres accessibles, pagination et focus/Escape conservés, état d'archives indisponibles explicite. Ce contrôle synthétique n'est pas une recette authentifiée. Preuve privée `local-data/r1063-boss-visual/corrected-v2/report.json`, SHA-256 `c22cbc4a59de19c58d4578bc80d5e683dda26a9fdbc574d14aa6e23de1d9510f`.

**Recette `87ff4ba` acquise :** correction approuvée indépendamment sur les 18 contenus GitHub, main/review synchronisés, Railway/Cloudflare SUCCESS au SHA exact, Prisma 67 et CANARY 18/44 vérifiés. L'API affiche trois archives et 27 contributions exactes, historique/classement natifs conservés. Le propriétaire confirme les quatre indications runtime après F5 puis la fenêtre Détail, sa fermeture accessible et octobre Twitch avec huit contributions/« Combat interrompu ». Le signalement du curseur interdit concernait le bouton de calcul près de « Dégâts prévus » ; distinction comprise, investigation close sans modification.

**Demande complémentaire bornée :** retirer du Bilan l'entrée native septembre 2026 « Non vaincu », en conservant septembre Twitch vaincu. Le candidat masque uniquement l'instance exacte identifiée en lecture publique, avant comptage/pagination et même sans archive disponible ; toutes ses données, attaques, références et conséquences de scaling sont conservées. Aucune nouvelle restauration, migration ou écriture économique. [Décision R1063](../specifications/decisions-log.md), [prédicat et portée](../architecture/legacy-domains-r1063.md#retrait-ciblé-de-septembre-après-recette).

**Retrait de septembre acquis à `9c23778` :** six fichiers approuvés indépendamment, main/review synchronisés et déploiements exacts Railway/Cloudflare, Prisma 67 et CANARY 18/44 conformes. Lecture publique après déploiement : historique réduit de quatre à trois lignes, seul septembre Twitch vaincu reste affiché ; ses trois archives/27 contributions sont exactes, classement direct du combat masqué et classement courant conservés. Les six tests PostgreSQL de ciblage/count/pagination/conservation, 22 tests unitaires/HTTP et contrôles serveur passent. Le propriétaire confirme les quatre indications runtime après F5 ; aucune recette Boss à refaire.

**Recette Twitch observée, écart de budget restant :** le propriétaire confirme les quatre nouveaux messages de consultation. L'audit borné identifie Kichnifou, quatre IDs distincts, trois bannières et une Box, sept réponses SENT, 96 personnages intacts dans l'ordre ; zéro mouvement/consommation/récompense de consultation. Les corps Box font 450/444/446/244 caractères, mais les hashes d'écho correspondent à ces corps précédés de `@Kichnifou ` : **461/455/457/255**, donc trois dépassent le contrat « préfixes compris ». La review indépendante demande une correction de cette réserve ; la réussite visuelle n'est pas présentée comme validation de la limite. [Diagnostic, limites et contrat corrigé](../architecture/legacy-domains-r1063.md#mention-automatique-twitch--écart-découvert-pendant-la-recette-finale).

**Correctif de mention développé :** budget figé avant préparation à partir des noms Twitch authentifiés, transmis aux producteurs communs et repris depuis le receipt canonique en cas de concurrence. Anciens contenus gelés et annonces sans reply conservés. Les 123 tests ciblés et 21 tests PostgreSQL privés passent ; verify:full final **8/8**, **1 380 tests frontend et 2 108 backend non-DB**, builds/types/lint/diff-check PASS. La Box capturée conserve ses 96 noms dans l'ordre et tient à **440/445/437/306** caractères, mention comprise, en présentation locale pure. Cette preuve ne vaut pas une nouvelle recette publique. Une réserve préexistante de reconnaissance d'écho avant persistance du messageId reste explicitement [documentée](../architecture/legacy-domains-r1063.md#mention-automatique-twitch--écart-découvert-pendant-la-recette-finale), sans effet économique démontré dans la recette.

**Sortie du checkpoint et prochaine recette :** review indépendante du SHA publié, promotion stricte puis preuves de déploiement exactes requises pour ce correctif. Aucun OFF ni restauration économique pour cette présentation. Après le redémarrage final vérifié, gate runtime puis un unique nouveau `!box` pour contrôler le corps, la mention et l'intégrité des noms ; les quatre commandes déjà acquises ne sont pas rejouées. Aucune session navigateur authentifiée n'est accessible ; aucun rendu client n'est inventé. La sélection `!select` et la recette de la modale restent validées. GLOBAL reste désactivé ; sa [readiness](../architecture/legacy-domains-r1063.md) identifie encore la politique des 171 exclus/deux quarantaines et la recette de charge R942 à traiter dans une mission dédiée. Les preuves privées `reply-budget-final-<SHA>.json` et de recette porteront les états effectivement atteints, sans commit documentaire supplémentaire pour recopier son propre hash.

<a id="point-courant--reprise-p0-appliquée-le-09102026"></a>

## Point R1062 — reprise P0 appliquée le 09/10/2026 (historique)

**Publication et déploiement acquis :** review indépendante du SHA `c60873afd038134491d46b5ec0d2df1adfce9f08` et du diff cumulé depuis `212da08` approuvée après corrections. Les 81 contenus/blobs GitHub ont été comparés aux fichiers publiés avant promotion strictement fast-forward. Railway et Cloudflare SUCCESS sur ce SHA exact, health 200 et assets publics exacts. Le preDeploy Prisma normal a appliqué 065/066 : 66 migrations terminées, noms/checksums des blobs Git exacts, migrate status à jour, contraintes/indexes/trigger/RLS/grants physiques contrôlés en lecture seule. Une différence CRLF du fichier local 005 a été corrigée dans le contrôle du helper en utilisant le blob Git canonique ; aucune migration acquise n'a été modifiée. Sauvegarde applicative publique complète, décodage, hash et fsync vérifiés avant DDL ; backups ciblés durables avant les écritures métier.

**Application terminée :** OFF canonique révision 13, capacité false réellement déployée, remplacement de bannière et votes ; puis 40 imports personnels atomiques, avec conservation des trois historiques déjà NATIVE et de Kichni_Test séparément. Le wrapper borné à 600 s s'est interrompu après 30 imports ; arrêt de l'arbre de processus vérifié, puis journal relu : 30 IMPORTED, 10 READY, trois NATIVE. Les dix restants ont été repris avec le même operationId, sans réimport des trente ni augmentation de timeout. Event Céotryd a ensuite été recalculé et appliqué sur une préimage fraîche. Capacité true réellement redéployée en maintenant OFF, nouveau contrôle Helix des 43 IDs puis une seule extension canonique : **CANARY 14, 44 cibles**. Aucun droit Faveur/Gift différé à reprendre, aucun PENDING ou envoi incertain. Aucun OAuth, choix R1055, replay historique, purge ou GLOBAL.

**Conservation vérifiée après activation :** 40 markers/journaux/backups cohérents, 69 claims Codes sans paiement et onze cibles de bannière conservées. Les 40 graphes personnels complets, soit 5 593 lignes, ont été relus après activation et leurs SHA-256 recomputés indépendamment depuis les fichiers : **40/40 identiques aux journaux d'import**. Les quatre anciennes targets et les deux archives sont exactes ; les **114 opérations de tirage et 1 059 résultats** acquis sont conservés intégralement. Les anciens graphes personnels ne diffèrent que par trois cibles de bannière incompatibles normalement effacées. Céo A reste ARCHIVED sans accès ; aucun transfert économique de A vers Céotryd B.

**État communautaire effectif :** une seule bannière ACTIVE, composition source exacte : 5★ Chiori, Durin, Varesa, Yae Miko ; 4★ Aino, Collei, Fréminet, Kaeya, Sayu, Yaoyao. La rotation native remplacée conserve ses 29 opérations de tirage et ses références ; les autres rotations historiques restent intactes. Fin normale lundi **12/10/2026 à 00:00 Europe/Paris, soit 11/10 à 22:00 UTC**. Quatre bulletins externes rattachés aux vrais Players, dont un recouvrement natif dédoublonné : **quatre contributions Raiden**, aucun vote double. Event Céotryd : préimage fraîche 2 points/5 monnaies, delta prouvé 14/20, résultat **16 points/25 monnaies** ; 22 opérations natives conservées, inscription déjà acquise dédoublonnée, palier 10 marqué sans second paiement. Les owners sociaux ont conservé 88 faits source : 71 relations matérialisées, 17 faits différés et 142 dates protégeant des doubles gains.

**Postflight et limites :** lecture du 09/10 à 10:18 UTC : sélection exacte des 44 cibles, zéro profil bloqué, zéro opération/livraison incertaine et aucune nouvelle commande de recette observée. Audit indépendant des artifacts privés : **17 contrôles PASS**, dont sauvegardes, sources, votes, Event, relations et graphes complets. La conservation des tables partagées est comparée au backup complet de 09:21 UTC, car le préflight ciblé de 09:57 ne les contenait pas ; Event possède sa propre préimage fraîche de 10:15. Le socle profil/Box/ressources/banque, Gacha/pity/sélection, quotidien, missions et expéditions est ouvert. **Event/Boss/Giveaway des 40 nouveaux profils restent restreints côté serveur, y compris les chemins indirects : état PARTIAL, pas RESTORED.** Les 17 faits sociaux différés ne doivent pas être inventés ni écrasés.

**Gate R1062 close :** le propriétaire a confirmé F5/capacité/armement/effectif/réception, puis les réponses réelles et la synchronisation de sélection. Le contrôle indépendant des receipts est décrit dans R1063 ci-dessus. Les preuves R1062 restent conservées sous `local-data/identity-resolutions/p0-20261009/` ; aucune ancienne commande à rejouer. Un nouveau redémarrage demandera une nouvelle validation effective du transport avant tout smoke.

## Validation et préparation du candidat P0 R1062 — historique avant application

Le mandat du 09/10 remplace les anciens STOP exigeant un prompt séparé entre revue, promotion, déploiement et application. Il ne dispense d'aucun contrôle : reviewer distinct sur SHA publié, Prisma normal, sauvegardes, opérateur, sources, révision, drainage, capacité réelle et validation effective du transport avant smoke. [Décision R1062](../specifications/decisions-log.md), [runbook courant](../process/legacy-cutover-runbook.md#reprise-p0-r1062). Les quatre canaries restent actives pendant développement et répétitions privées.

L'inventaire courant a revérifié les manifests des deux captures récentes/historiques et les 43 IDs via Helix : **3 NATIVE + 40 plans personnels prêts**, Kichni_Test hors population, 171 discarded et deux quarantaines exclus. Les états partagés n'en deviennent pas automatiquement restaurés. Le mécanisme candidat ajoute des claims Codes sans paiement, une cible conservée seulement sur la bannière source exacte, un confinement avant transfert et une restriction Event/Boss/Giveaway par profil. Aucun réimport des NATIVE, aucune fusion Web, purge globale, compensation d'indisponibilité ou ouverture GLOBAL.

Le correctif R1061 `8a14d6c` est publié sur review et approuvé par le reviewer distinct : votes acquis des comptes suspendus/archivés conservés et résolution TWITCH R1055 rapprochée sans double poids. Six scénarios ciblés, dont cinq reproduisaient les défauts avant correction ; **45 tests PostgreSQL privés PASS** après correction. Cette approbation porte uniquement sur R1061, pas sur le nouveau mécanisme groupé. Le candidat P0 ajoute **066** (marker Player, nullable/backend-only) ; 065/066 ne sont pas encore publiques.

**Répétition réelle privée PASS :** capture publique strictement en lecture (143 tables/12 556 lignes), clone privé sous 66 migrations réelles, 40 imports avec interruption après sept puis reprise, 40 backups durables, 69 claims Codes sans paiement, onze cibles conservées, quatre votes rattachés sans doublon. Extension à 44 NATIVE en une révision, replay sans nouvel audit ; imports 25 s, activation/replay 4,34 s. Huit contrôles métier, deux archives et 114 opérations/1 059 résultats acquis protégés ; anciens profils inchangés hors trois cibles incompatibles normalement effacées et delta Event autorisé. Event recalculé sur cette capture : 16 points/25 monnaies, palier10 non repayé, replay/compensation/réapplication exacts ; **ces valeurs ne sont pas un montant public à imposer**. Restauration intégrale du clone exacte, 17 connexions ouvertes/fermées, aucune restante. Les cas sans élément, dérives, concurrence, refus indirects et droits Faveur/Gift différés sont couverts séparément par les fixtures privées.

Les régressions affectées comprennent 226 tests DB des neuf domaines/autorité, 33 identité/R1055, 204 Faveur/Gift acquis cumulativement (196 des sept suites puis huit lifecycle après correction de fixture), 17 reprise/readiness et les 45 R1061. Les deux suites finales reprise/extension passent **82/82** ; rollback Gift isolé refusé sans aucune mutation. La récupération Gift bornée est aussi revue et testée **20/20**, dont ajouts/manquants/doublons avant effet et liste exacte/replay ; elle vérifie sa propre liste Helix pour fermer la course entre contrôle et traitement. Faveur/Gift conservent leurs preuves pendant le confinement sans paiement : seuls ces reçus strictement prouvés permettent l'activation, puis reprise par les owners originaux ; un cadeau d'un gifter extérieur protège aussi le rollback du bénéficiaire. Aucune commande historique n'est rejouée.

**verify:full final 8/8 PASS :** 1 378 tests frontend et 1 998 backend non-DB, builds, types, lint et diff-check. Prisma validate et typecheck des helpers privés PASS. Le précontrôle avait échoué sur les fixtures Player/Faveur à adapter et le TTL d'indicateur de saisie dépendant de la charge ; fixtures corrigées, horloge de test déterministe, aucun changement UI produit. Les findings indépendants du pré-audit ont été corrigés/testés ; la review finale porte encore sur le SHA à publier, pas sur ces seuls résultats.

Prochaine opération : clore les contrôles finaux, publier/reviewer le candidat complet, corriger tout finding bloquant, puis promouvoir/déployer/appliquer le sous-ensemble sûr dans cette mission. Les sauvegardes et matrices nominatives restent privées sous `local-data/identity-resolutions/p0-20261009/`. Après toute activation, distinguer profil couvert, commande observée et recette humaine. Le propriétaire cite Plumereveuse66 et Kadraw comme possibles participants sans confirmer leur présence ; leur absence n'empêche pas la progression technique et ne vaut jamais recette. Les domaines secondaires restreints impliquent un état PARTIAL.

## Historique R1061 — candidat de votes avant le mandat P0 consolidé

La mission propriétaire du 09/10 autorise le registre durable des quatre votes legacy par ID Twitch immuable, sans contraindre les trois votants à migrer. **Gate F5 de 212da08 acquise**, capacité/armement/effectif ON et Chat activé confirmés ; aucun nouveau déploiement dans ce lot, aucune confirmation redemandée. [Décision R1061](../specifications/decisions-log.md), [contrat, prévisualisation et procédure complète](../architecture/legacy-banner-votes-r1061.md).

Le candidat ajoute `ExternalBannerVote` et **065**, uniquement préparée/testée en PostgreSQL local privé. Un seul comptage natif/externe par identité ; collisions bloquantes, rattachement canonique après R1055, clôture durable et scheduler normal. R1060 v2 conserve tous les tirages et journal/backup/compensation exacts ; les anciennes preuves v1 restent intactes. Aucune restauration Event/social/personnelle et aucun batch43/GLOBAL. La classification de purge bloque la destruction des preuves externes et conserve CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT.

Prévisualisation READ ONLY du 09/10 : source récente/manifests/43+171+2 et Helix ciblé par IDs vérifiés, Céotryd B **IMPORT**, fred_night0wl/plumereveuse66/kadraw18 **EXTERNAL_PROVEN**. Quatre poids Raiden calculables, zéro collision détectée, composition exacte R1060. Aucun vote effectivement intégré en public. Les 16 opérations/115 résultats d'origine sont exacts ; la rotation native active porte désormais **28 opérations/226 résultats**, tous à préserver lors d'un éventuel apply frais. Ne pas traiter ce gameplay postérieur comme une dérive à annuler.

**Validation : 151 tests PostgreSQL privés PASS sur huit suites, dont 39 de remplacement/conservation/identités/votes ; Prisma validate et deploy/status privés 65 PASS. verify:full 8/8 PASS : frontend 1 378, backend non-DB 1 985, builds/typechecks/lint/diff-check.** [Détail, échecs intermédiaires et limites](../architecture/legacy-banner-votes-r1061.md#validation-du-candidat). Review indépendante en attente ; aucun déploiement, migration publique, désarmement ou apply métier. Production reste au SHA `212da08e6b601d0bf5d83e550a5629ed90d21376`, registre 64. A ARCHIVED sans accès/B ACTIVE/NATIVE, quatre canaries persistées, Event proposé 15/23 à réévaluer (source14/21/palier10 sans double gain), onze faits sociaux DEFERRED et population fixe conservés.

**Prochaine opération exacte : review indépendante ChatGPT du SHA review et de son vrai diff depuis main, incluant migration/owners/tests. STOP avant main.** Une mission ultérieure distincte devra promouvoir/déployer 065, valider CANARY/transport après redémarrage, puis obtenir une autorisation métier et refaire OFF/capacité false/backup/fingerprint/gates avant apply. Échéance stricte : lundi **12/10/2026 00:00 Europe/Paris = 11/10 22:00 UTC** ; passé ce point, STOP pour arbitrage, aucun résultat figé ou temps réel réécrit. Roadmap inchangée.

## État historique au checkpoint 212da08 — avant la décision R1061

Review indépendante du diff cumulé approuvée pour **code et migration uniquement**. Promotion stricte du candidat 15a16a192b0f2a5a3ceb93b8090e7b4429c35041 le 09/10/2026, main/review alors identiques et divergence 0/0, sans commit préalable artificiel. Railway et Cloudflare SUCCESS exacts, backend Online/health 200 ; preDeploy Prisma seul a appliqué 064. Registre 64/noms/checksums et migrate status conformes, colonne/indexes/CHECK physiques validés. [Preuves et limites de promotion](../architecture/community-complements-20261008.md#promotion-code-20261009).

Comparaison READ ONLY avant/après : quatre canaries NATIVE, identités/imports/autorité exacts ; **Céo A ARCHIVED sans accès, Céotryd B ACTIVE/NATIVE**. Une seule rotation ACTIVE native, composition/votes/rotations inchangés, 16 opérations/115 résultats acquis conservés. États personnels, possessions, ressources, pity/garanties/Capture et Event identiques. Zéro PENDING/outbound incertain, onze faits sociaux DEFERRED. Transport canonique après redémarrage : capacité/armement/effectif CANARY, Chat ACTIVE et couverture exacte des quatre IDs, GLOBAL false ; ce contrôle PostgreSQL/configuration/Helix ne constitue pas un GET authentifié du processus. La gate de session existante après le dernier redémarrage reste celle du runbook, sans commande Twitch.

Les preuves des 80 tests PostgreSQL privés et de verify:full 8/8 (1 378 frontend/1 984 backend non-DB) sont intactes ; campagne non rejouée sur ce code inchangé. Sauvegarde fraîche du schéma applicatif public et de toutes ses données avant 064, archive/hash/décodage complet/fsync vérifiés ; sources, anciens backups et preuves conservés. Migration 064 déployée **ne signifie pas R1060 appliqué**. Event : source 14/21, dernière proposition 15/23 à réévaluer fraîchement, palier 10 déjà payé ; aucun crédit ou raccordement social public. Le garde CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT reste obligatoire, population 43/exclusions fixes, Kichni_Test hors 43.

Lecture fraîche du 09/10 : quatre votes source 05/10 pour Raiden, identités historiques prouvées et vérifiées par ID Twitch avec Helix. Céotryd : IMPORT 1/RETAIN 0 ; fred_night0wl, plumereveuse66 et kadraw18 : **DEFERRED 3**, aucun Player lié/import/target NATIVE pour ces IDs. Plan réel BLOCKED_VOTES / LEGACY_VOTES_REQUIRE_DECISION. Aucun vote importé par cette mission. [Options soumises à arbitrage](../architecture/community-complements-20261008.md#arbitrage-votes-20261009) : registre de votes externes prouvés sans Player, ou missions individuelles de migration séparément autorisées ; rien de cela n'est décidé ni codé.

**Prochaine action : arbitrage propriétaire sur les trois votes, puis éventuelle mission sensible de mécanisme/tests privés/review et application distincte avec gates fraîches.** La fenêtre R1060 expire lundi 12/10 à 00:00 Europe/Paris (11/10 22:00 UTC). Dans sa forme actuelle, elle est bloquée ; après cette échéance aucun remplacement courant ni contribution rétroactive au tirage du lundi n'est possible. Aucun input.now antidaté, résultat figé réécrit, réimport NATIVE, batch 43 ou GLOBAL. La recette R1059 et CEO_NATIVE_COMPLETE restent acquises ; les checkpoints précédents sont détaillés dans l'audit.

<a id="ceo-native-operation-20261008"></a>

## Point courant — Ceo NATIVE transférée et recettée ; 31A finalisée

**Autorisation et baseline :** mission 31A propriétaire GO, puis confirmation fraîche des chemins Streamer.bot remplacés désactivés pour Ceo, Kichni_Test, Mynonyme et Kichnifou pendant l'opération. Fetch : HEAD/main/review/origin-main/origin-review **f5618502a68797e2202b54902b21e30fb65d98bf**, divergence0/0, worktree/index propres. Les contrôles du bootstrap : 179 DB / 20 non-DB / verify:quick 5/5 sont réutilisés ; aucun code produit ni mécanisme sensible nouveau. Le premier préflight de cette mission avait laissé OFF 11/flag false avant la confirmation externe ; aucune extension n'avait été tentée.

**Remise en capacité distincte de Git :** patch Railway production inspecté, un seul changement sur le service GachaImpact : **TWITCH_COMMAND_PILOT_ENABLED=true**, GLOBAL false conservé, aucun changement partagé ou staged concurrent. Déploiement **5299a4c9-727b-4b16-93c8-b3c1e3d26feb SUCCESS** à18:51:53UTC, même SHA f561850, Online 1 sans issue/failure/pending. Logs startup :63 migrations, aucune pending, serveur démarré ; health 200 à18:53:59UTC. Cloudflare **3cc7d818-c11a-4223-a343-57fcc3e1e2d5 SUCCESS** f561850, production/preview 200 et assets exacts au contrôle de continuité. Ce checkpoint documentaire possède ensuite ses propres SHA/déploiements, à contrôler après publication, sans commit supplémentaire pour recopier son SHA.

**Gate OFF acquise :** PostgreSQL/configuration canonique et code réellement déployé suffisent à établir l'effectif OFF avant transfert : validateTransport invalide explicitement desiredOFF, puis status retourne effectiveOFF/commandPilotEnabledfalse. Accord propriétaire explicite pour cette preuve sans session fabriquée ni preuve navigateur. Sonde canonique READ ONLY 18:53:36UTC : capacitétrue/OFF 11/effectiveOFF/transportValidfalse ; subscription Chat ACTIVE, broadcaster/receiver/callback exacts vérifiés par Helix. Prisma 63/noms/checksums exacts, opérateur ACTIVE/ADMIN/allowlist, B ACTIVE/Web+Twitch/LEGACY/non-canary, A ARCHIVED sans accès, backupv3/hash et dernier DATA_IMPORTED exacts. Helix des quatre IDs frais 18:55:03UTC ; ultime gate 18:55:05–18:55:08UTC : zéroPENDING/receipt engagé/EXECUTING/réservation/outbound PENDING / SENDING / AMBIGUOUS/verrou/transaction inactive ou longue. Connexions fermées.

**Exécution et postflight :** CLI canonique `migration:legacy:canary:extend` exécutée **une fois**, sortie AUTHORITY_TRANSFERRED/CANARY/révision12, sans timeout ni retour ambigu. Aucun appel d'arm/configure pour reconstruire les targets. READ ONLY RepeatableRead/statement 5 s / transaction 30 s 18:55:29–18:55:35UTC : quatre targets NATIVE/canary ; trois anciennes targets exactes, dont updatedAt, identités/imports/backups/deux réparations inchangés. B conserve le même Player/WebIdentity/TwitchIdentity et dernier import ; A reste ARCHIVED sans accès. Comparaison exacte de la préimage immédiate de B : **734 lignes personnelles, aucune table modifiée**. Un seul nouvel AUTHORITY_TRANSFERRED pour B et un seul DESIRED_AUTHORITY_CHANGED CANARY 12 ; anciens audits conservés, aucun nouveau choix/plan/import ni opération ou livraison incertaine.

**Transport et humain, preuves distinctes :** sonde canonique avec configuration Railway et inspection Helix réelle18:55:29UTC : commandPilotCapabilityEnabled=true, desiredAuthority=CANARY, effectiveAuthority=CANARY, transportValid=true, commandPilotEnabled=true ; subscription ACTIVE et identité/callback exacts. **Cette sonde n'est pas une lecture HTTP de l'instance déployée.** Aucun navigateur connecté exposé ; helper Windows indisponible après récupération. Le propriétaire confirme depuis sa session Kichnifou existante après F5/Configuration→Compte les quatre indications : capacité disponible, armement ON / effectif ON et réception Chat Activée, sans cliquer sur les contrôles. Cette lecture humaine de l'UI issue du GET authentifié existant, rapprochée de CANARY 12 et de la sélection exacte en PostgreSQL, valide la gate runtime ; ce n'est pas une capture HTTP autonome par Codex. **Le propriétaire confirme ensuite les trois nouveaux messages/réponses cohérentes et F5/reconnexion avec même progression niveau 100, ressources et Box attendues.** Cette recette post-NATIVE est distincte de celle pré-NATIVE ; aucun nouvel OAuth ni choix de progression.

**Smoke technique réel19:02:14–19:03:56UTC :** trois nouveaux receipts du vrai chatter Ceo vers le même B, un par commande, distincts de la préimage/historique ; terminaux PROCESSED / RESPONSES. !pity une réponseSENT et valeurs gelées conformes au Gacha B ; !quotis une réponseSENT, état quotidien réel déjà réclamé affiché cohérent, **zéro nouveau claim/crédit** ; !box trois segments SENT, vraie collection non vide/IDs/constellations conformes à B. Cinq IDs de réponses nouveaux, aucune réponse incertaine ou receipt doublé. Intentions de lecture sans mutation gameplay. Six opérations COMPLETED natives de présence, une twitch.message et une twitch.message.complete par message, normal false ; totalMessages +3 seulement, XP/autres compteurs inchangés. Gacha/personnages/banque/inventaire/équipes/ressources/daily et graphes personnels conservés ; écarts expliqués uniquement business_operations/player_activity_state/player_progression, horodatages légitimes distingués de la migration. Aucune relance de commande ou receipt. Recette humaine propriétaire confirmée après ces nouveaux messages ; les trois autres canaries restent cohérentes sans replay de leurs anciens gains.

**Publication et reprise :** lot de quatre documents sur review, vrai diff/blobs GitHub et ancestry à vérifier avant fast-forward strict main autorisé. Le redéploiement automatique exige une gate immédiate de receipts terminaux/absence de PENDING/outbound incertain et transport valide, puis contrôle du nouveau SHA Railway/Cloudflare/health/Prisma 63 et revalidation après redémarrage ; ses résultats réellement observés sont au rapport et dans les preuves privées, sans commit en boucle pour citer son propre SHA. Un échec tardif impose kill switch OFF canonique et nouvelle constatation documentaire, avec conservation des quatre NATIVE/audits/imports ; reprise future de l'ensemble persisté, **jamais seconde extension Ceo ni rollbackLegacyCanary du backup pré-liaison**. [Runbook](../process/legacy-cutover-runbook.md#ceo-native-operation-runbook-20261008). Onze faits Ceo DEFERRED ; population 43 fixe, Kichni_Test hors 43,171 owner-discarded/deux quarantaines exclus. CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT conserve son blocage ; adaptation sensible/compensation reviewée avant 31B. Prochaine mission distincte : raccordement R1056 et audits partagés/préparation31B ; aucune restauration sociale, batch43/GLOBAL ou feature pré-release exécutée. Ordre R1057/R1058 inchangé, aucune nouvelle décision. Preuves/graphes/arguments privés ignorés, aucun identifiant individuel publié. STOP après publication/contrôles de ce lot ; aucune suite automatique.

<a id="bootstrap-ceo-native-20261008"></a>

## Bootstrap du08/10/2026 — extension existante contrôlée, transfert non exécuté

**Git et déploiements observés :** ouverture propre sur review ; HEAD/main/review/origin-main/origin-review = **50d07004ebd80023b43d26bafcc7fbfd3e9a3a7a**, divergence0/0 après fetch et vérification GitHub. Aucun commit supplémentaire depuis la passation. Railway **a0780204-7d02-47da-a423-1879ff1f20ac SUCCESS**, SHA exact, Online1, zéro issue/failure/pending. Cloudflare **95f04b6f-a5a1-460c-aacd-7ed453eff502 SUCCESS** du même SHA, production/preview200 et assets identiques octet pour octet. Health200 à18:08:57UTC. Le statut de promotion en attente du précédent en-tête est donc clos ; les paragraphes de passation ci-dessous restent historiques. Ce lot actualise uniquement les preuves et la préparation ; les déploiements de son futur SHA documentaire sont contrôlés après publication et rapportés séparément.

**Sonde publique fraîche18:07:19–18:07:23UTC :** RepeatableRead READ ONLY, statement5s/transaction30s, connexion fermée ; Prisma63 terminées, noms et checksums des blobs Git exacts, dernière **20261008120000_063_add_operator_progression_resolution**. `prisma migrate status` public à jour. OFF/révision11, **TWITCH_COMMAND_PILOT_ENABLED=false**, **TWITCH_NATIVE_GLOBAL_ENABLED=false** ; l'effectif est donc OFF selon le contrat runtime. Statut runtime authentifié/transportValid non lu : aucune preuve de transport CANARY. Opérateur ACTIVE/ADMIN/allowlist/identité conforme ; zéroPENDING/receipt engagé/EXECUTING/réservation native/outbound PENDING-SENDING-AMBIGUOUS, zéro verrou bloquant/idletransaction/transactionlongue. B ACTIVE Web+Twitch, target/provenance et dernier DATA_IMPORTED exacts, backupv3 brut/hash valide ; A ARCHIVED sans identité d'accès ni session. Une résolution TWITCH terminée/un plan consommé, aucun plan actif contradictoire. Trois NATIVE/targets/identités/imports/backups/deux réparations exacts. Helix `/users?id=` revalide les quatre IDs immuables à18:10:32UTC ; aucun OAuth joueur, pseudo utilisé comme clé ou import. Cette sonde légère ne répète pas l'audit économique exhaustif ni la recette humaine niveau100/F5/reconnexion déjà acquise.

**Audit technique et tests locaux :** `extendImportedCanary` conforme au contrat existant : ajout unique sans recréer les targets, dernier import et backup exacts, locks/Serializable30s/révision, refus des opérations et du replay, deux audits atomiques ; transport séparé. Aucun défaut de code nécessaire identifié, aucun changement de mécanisme. PostgreSQL17.11 local, fixtures synthétiques en schémas privés : **179 tests DB PASS** (extension46, fondations25, opérateur22, réconciliation sociale17, paire sociale13, barrière ARCHIVED6, activités ARCHIVED6, canary/rollback12, liaison32). CLI/isolation : **20 tests non-DB PASS**. Prisma validate/status local et verify:quick **5/5 PASS**. Clôture locale : zéro autre connexion/schéma privé/verrou en attente/Player dans le public local de référence ; PostgreSQL arrêté. Les extensions1→2 et2→3, préservation exhaustive des tables, rollback forcé/verrous/concurrence et rejets sensibles sont couverts par les suites existantes ; aucune extension publique3→4 ni recette Twitch exécutée. verify:full non répété pour ce lot documentaire sans changement de code.

**Communautaire et31B :** onze faits Ceo DEFERRED, chacun avec au moins une preuve et un endpoint manquants, zéro version matérialisée ; aucune collision devenue applicable démontrée. Réconciliation ciblée possible seulement après preuves fraîches et import des endpoints, avec refus des collisions/blocages/révocations. `buildCutoverPurgePlan` refuse **CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT** dès qu'un plan opérateur existe (même consommé/expiré) ou qu'une relation porte legacyFactId : adaptation sensible et compensation à spécifier/tester/reviewer avant31B, jamais suppression de cette garde. Population43 immuable, Kichni_Test hors43,171discarded/deuxquarantaines exclus. Ceo NATIVE/smoke, raccordement social autorisé, audit Boss/Event/Giveaway/Concours/votes/Codes, capture/Helix/rehearsal/backups/FK et compensation GLOBAL restent à accomplir ; aucun batch commencé ni nouvel owner partagé inventé.

**Observations et gate suivante :** filtre runtime17:39–18:09UTC : zéroP1001/P2024/57014/pooltimeout/too-many-connections. Les marqueurs Concours `current.reconciliation.shared`/503 observés correspondent au refus existant **CONTEST_TEMPORARILY_UNAVAILABLE** pendant une réconciliation déjà engagée (fenêtre18:01:26–18:01:29UTC), pas à une cause DB nouvelle démontrée ; warning pg@8 de séquencement également observé. Cause historique PostgreSQL/Concours toujours inconnue. Streamer.botOFF reste une confirmation propriétaire antérieure, sans inspection locale nouvelle. **Exécution NATIVE bloquée maintenant par la capacité commandesOFF** : la mission distincte doit autoriser sa remise en capacité en conservant desiredOFF/GLOBALfalse avant les gates et l'extension. [Checklist, confinement/rollback et postflight](../process/legacy-cutover-runbook.md#ceo-native-preparation-20261008). Aucun transfert, restauration sociale, OAuth joueur, replay, rollback, activation, batch ou changement d'infrastructure dans ce bootstrap. Preuves privées ignorées ; aucun identifiant personnel publié. Ordre pré-release/R1057/R1058 inchangé, aucune nouvelle décision.

<a id="ceo-link-postflight-20261008"></a>

## Historique — liaison Ceo et recette humaine validées ; NATIVE alors non autorisé

Le propriétaire confirme la liaison et le choix « Utiliser ma progression Twitch » effectués personnellement par Ceo ; sa capture affiche le profil niveau100. Baseline publique vérifiée à l'ouverture du postflight : **main = review = edb3b2b1257f3c2e9353f935927c0385a20da5ce**, divergence0/0, worktree initial propre. Les refs du checkpoint documentaire et de la présente passation sont distingués ci-dessous. Plan frais préparé par le mécanisme canonique avec backup exclusif/durable, autorité OFF11 et acknowledgement STREAMERBOT_PATH_DISABLED ; validé par le vrai currentOperatorPlans. Expiration18:49:48 Paris, choix enregistré **18:38:17.739 Paris** le08/10/2026, consommation dans la même résolution avant expiration. Le premier plan historique reste expiré/non consommé ; une seule résolution TWITCH terminée et un seul plan consommé, aucune autorisation active contradictoire.

**CEO_LINK_CONFIRMED :** postflight PostgreSQL READ ONLY16:53:05–16:53:13UTC, RepeatableRead/statement5s/transaction30s, connexion fermée. Identités vérifiées par UUID/WebIdentity/Auth et TwitchUserId immuable, jamais par pseudo. B ACTIVE, même TwitchIdentity et WebIdentity transférée depuis A, Auth conservée ; A ARCHIVED sans WebIdentity, TwitchIdentity ni PlayerSession, état social actif clôturé conformément à R1055. B toujours DATA_IMPORTED/LEGACY/non-canary, target et provenance/import exacts, backupv3 et backup opérateur bruts/hash exacts. Trois canaries NATIVE/identités/imports/backups/deux réparations cosmétiques inchangés ; **11 faits d'amitié Ceo DEFERRED exacts**. OFF11/flagRailwayfalse, zéroPENDING/outbound incertain/verrou bloquant/idletransaction/transactionlongue ; registre Prisma63 complet et sans migration inachevée. Aucun write de cet audit, réimport, replay, nouveau choix, restauration ou activation.

**Conservation, sans confondre jeu ultérieur et fusion :** 282FK inchangées, 12495 occurrences de lignes comparées dans les projections personnelles, partagées et parentes du backup exact. XP/personnages/inventaire/Gacha/banque/cosmétiques/stats combat-Boss-Roue originaux de B sont identiques. Les lignes et historiques de A restent présents ; seuls statut/horodatage d'archivage et clôtures sociales prévues changent, avec maintien des tiers, messages et preuves de cœurs. Après le choix humain, B possède **8 opérations nouvelles COMPLETED :7UI et1ADMIN**, neuf mouvements de ressources. Rapprochement local exact de chaque chaîne before/delta/after avec les soldes et incréments des statistiques économiques ; daily/code/expédition/deux paliers de missions et inscription Event expliqués par leurs reçus, aucune double attribution ou transfert économique depuis A. L'inscription Event est une opération UI distincte ; aucun auto-enrollment de l'audit. Les préférences tutoriel, notifications et activité Web sont également distinguées des changements de liaison. Le hash économique du pré-plan n'est donc plus identique et n'est pas annoncé comme tel.

Le premier helper postflight a correctement signalé les écarts au pré-plan mais ses attentes locales de niveau stocké et updated_at exactement égal au début de transaction étaient incorrectes : le niveau est dérivé de XP et Prisma date ses écritures successives. Diagnostic/reconciliation hors base sur les images conservées, avec bornes et colonnes explicitement vérifiées, sans assouplir le produit ni répéter la campagne Supabase. Les premières preuves et échecs locaux sont conservés.

**Services :** Railway508bb9cb-27de-4e39-8bf8-7ed642372e7c SUCCESS/Online1, zéro issue/pending ; Cloudflareee0902dd-2730-4231-8219-dc1a6b93d7b4 SUCCESS du même SHA, production/preview200 et assets identiques octet pour octet ; health 200. Logs runtime consultés en fenêtres bornées ; aucune nouvelle erreur DB/pool observée, recherche P1001/P2024/57014 vide. Les fenêtres générales atteignent la limite500 : ce n'est pas une preuve de lecture exhaustive des logs. Erreur DNS GitHub locale initiale, connecteur GitHub disponible, puis fetch normal réussi ; aucune configuration modifiée. Cause historique PostgreSQL/Concours toujours non démontrée, distincte de la stabilité actuelle et de la validation métier.

**Recette humaine confirmée par le propriétaire le08/10/2026 : « Oui, F5 et reconnexion vérifiés ».** La demande incluait profil, ressources et même progression Twitch niveau100 après F5 puis déconnexion/reconnexion. Cette validation humaine est distincte du postflight Codex et ne constitue pas un contrôle visuel autonome de son navigateur. **Gate suivante : STOP avant une mission distincte explicitement autorisée pour le transfert NATIVE de Ceo et ses recettes.** Aucun nouveau plan/OAuth/choix nécessaire. Aucun transfert NATIVE Ceo, batch43, GLOBAL, activation Twitch ou mutation corrective dans cette mission ; Streamer.botOFF. Le raccordement communautaire des éligibles et les faits différés des autres domaines restent à auditer avant batch, sans prétendre que R1056 les a achevés.

**Décisions futures, précisées par le propriétaire pour cette passation :** stabilisation silencieuse → Codes enrichis R1057 → optimisation Supabase → tirage Event R1053 → gestion des mots de passe R1058 → Catalogue Character R1051 → UX cosmétiques R1052 → passe graphique/ergonomique/mobile → vraie bêta/corrections → validation finale V1 → révélation/ouverture officielle. [Ordre durable complet](../roadmap/implementation-order-v1.md#complements-prerelease-20261008). Toutes les étapes de migration précédentes et les autres gates R1054 sont conservées. Documentation uniquement ; aucun code, service, infrastructure, abonnement ou donnée publique modifiés.

Preuves privées ignorées : local-data/identity-resolutions/ceo-second-link-2026-10-08T16-33-10-162Z et ceo-link-postflight-20261008. Aucun UUID, fingerprint, token ou backup publié. À sa publication initiale, le checkpoint documentaire du postflight aff3e17 était sur review uniquement, avec main et les déploiements au SHA edb3b2b ; sa promotion fait désormais partie de la mission de passation approuvée ci-dessous. [Runbook](../process/legacy-cutover-runbook.md#ceo-link-postflight-runbook-20261008).

<a id="handoff-chatgpt-codex-20261008"></a>

### Reprise autonome des deux conversations — checkpoint de passation

**Git vérifié à l'ouverture de la promotion finale :** main/origin-main **edb3b2b1257f3c2e9353f935927c0385a20da5ce** ; review/origin-review/HEAD **a42c2ccda3bd39d5da2c583fd7cbb83def5dd7bd**, divergence main…review **0/2**, worktree et index propres. Chaîne approuvée : edb3b2b → **aff3e176f598fb2d22f9ea8886b8477e47062e1b** (postflight et recette humaine) → a42c2cc (passation) ; dix fichiers exclusivement documentaires. Review indépendante ChatGPT **APPROUVÉE**, aucun finding bloquant. La présente finition de statut est publiée sur review avant fast-forward strict de l'ensemble vers main ; aucune modification produit. L'état final attendu est main = review, divergence **0/0**, worktree propre. Les SHA et résultats de déploiement réellement observés restent au rapport final et au TASK_STATE local ; pas de commit supplémentaire pour recopier son propre SHA. Toute évolution concurrente impose STOP et contrôle, pas l'imposition de cette baseline.

**Dernier état public prouvé avant cette promotion :** code R1055 f96d5a3 déployé avec checkpoint main edb3b2b, Railway **508bb9cb-27de-4e39-8bf8-7ed642372e7c** et Cloudflare **ee0902dd-2730-4231-8219-dc1a6b93d7b4 SUCCESS** du SHA exact, health 200. Dernière migration : **20261008120000_063_add_operator_progression_resolution**, 63 migrations appliquées ; DDL additive 063 contrôlée avant liaison, registre 63 et FK au postflight du 08/10 à 18:53 Paris. OFF révision 11 et flag false constatés, zéro PENDING/outbound incertain/verrou/transaction longue ; trois NATIVE Kichni_Test, Mynonyme, Kichnifou et leurs imports/backups/réparations préservés. La promotion documentaire impose des contrôles ciblés : Railway et Cloudflare SUCCESS au même SHA final, health et frontend publics 200, registre 63 à jour et aucune nouvelle migration/DDL ou anomalie visible ; aucune campagne DB lourde ni test mutatif. Un échec impose STOP sans redéploiement aveugle. Ces résultats ne sont pas annoncés avant observation. Les preuves détaillées de Ceo et de sa recette restent au point courant ci-dessus : B ACTIVE Web+Twitch, A ARCHIVED, choix/plan consommés une fois, niveau 100, aucune fusion ; **F5 et déconnexion/reconnexion confirmés humainement**. Ne pas reprendre OAuth, un plan de quinze minutes, l'import B ou l'archivage A.

**Contrôle ciblé avant promotion, 08/10/2026 à 19:36:55–19:36:59 Paris :** PostgreSQL/Prisma READ ONLY, connexion fermée ; 63 migrations terminées, noms et checksums des blobs Git exacts, dernière 063. OFF11/flag false, zéro PENDING/livraison incertaine/transaction longue ou bloquée. B ACTIVE Web+Twitch toujours DATA_IMPORTED/LEGACY/non-canary, A ARCHIVED sans accès, une résolution TWITCH terminée et un plan consommé, aucun plan actif contradictoire ; 11 faits Ceo DEFERRED. Trois canaries/identités/imports/réparations et backups locaux exacts. Cette sonde légère confirme les protections, sans répéter l'audit intégral des graphes ni la recette humaine. Le premier helper a rencontré les fins de ligne CRLF d'une migration locale ; comparaison corrigée vers le blob Git LF exact enregistré en base, aucune migration ni donnée modifiée. Railway en ligne, aucune configuration staged/applying avant promotion ; les nouveaux déploiements restent à observer.

| Étape | Clôture réelle ou travail restant |
| --- | --- |
| 26 | VALIDÉE / CLÔTURÉE : recette fonctionnelle et économie/progression acquises ; observations rares conservées selon R1034, pas déclarées exécutées. |
| 27 | CLÔTURÉE par décision de périmètre R1034 ; maintenance/rétention/charge non implémentées restent reportées, sans test inventé. |
| 28 | VALIDÉE / CLÔTURÉE par le propriétaire, recettes Arcade acquises. |
| 29 | CLÔTURÉE R1039 : adaptation Chat et recette représentative ; aucune reprise de l'exception de promotion directe. |
| 30 | Foundation/rehearsal privée R1041 TERMINÉE : 43 identités vérifiées, deux quarantaines exactes, comparaison/rollback/second import privé PASS ; ce n'est pas un batch public. |
| 31A | Trois canaries déjà NATIVE et préservées ; liaison Ceo et recette humaine validées, **B encore LEGACY/non-canary**. Transfert NATIVE Ceo et smoke restent à autoriser/exécuter. |
| Relations communautaires | R1056 déployé ne signifie pas raccordement achevé : restaurer les amitiés historiques des quatre canaries et autres éligibles via Twitch User IDs vérifiés ; **11 faits Ceo DEFERRED**. Préserver niveaux/cœurs/dates/anti-double-claim, différer les amis non migrés, traiter les collisions explicitement ; aucun merge économique. |
| 31B | Toujours non exécutée : exactement les **43 identités historiques** autorisées, déjà NATIVE conservés sans réimport personnel ; Kichni_Test **hors des 43**, **171 owner-discarded** et **deux quarantaines** non importés. Avant batch : audit/restauration des faits partagés Boss, Event, Giveaway, Concours, votes, Codes et autres domaines selon les contrats. Aucun nouveau Player déduit des seuls compteurs d'inventaire. |
| GLOBAL / 32 | Bascule GLOBAL future explicitement autorisée et chemins doubles interdits ; Streamer.bot reste OFF. Puis stabilisation silencieuse et pré-release selon l'ordre propriétaire, avant toute révélation. |

**Validation publique acquise / restante :** Kichni_Test et Mynonyme liaison/F5/reconnexion/smoke acquis ; Kichnifou recovery puis Ctrl+F5/Concours réel/reconnexion acquis ; Ceo choix TWITCH et F5/reconnexion acquis. Ceo **NATIVE et !pity/!quotis/!box non testés**, raccordement communautaire/batch/GLOBAL/stabilisation et futurs lots pré-release non validés. Pas de blocker actif de liaison Ceo au postflight ; cause racine historique PostgreSQL/Concours toujours inconnue, stabilité observée datée, lenteur de réconciliation à surveiller. La performance SQL du moteur R1055 a été corrigée : ne pas rouvrir une optimisation PostgreSQL pour l'ancien OPERATOR_REQUIRED désormais résolu par le choix humain. Dette quotas/egress/logs Supabase conservée, chantier futur à la place décidée après Codes enrichis, jamais avant migration.

**Review indépendante acquise ; promotion finale explicitement autorisée dans cette mission.** Après fast-forward et contrôles de déploiement PASS, **HANDOFF_READY_FOR_BOOTSTRAP**, puis STOP : première reprise des deux nouvelles conversations en lecture seule selon la chaîne ci-dessous, sans nouvelle review du checkpoint déjà approuvé. La prochaine mission métier autorisable est le transfert ciblé de B Ceo vers NATIVE par l'extension multi-canary canonique déjà validée, après gates fraîches OFF/révision réelle/flag/identités/backups/absence d'opérations ou livraisons incertaines ; préserver les trois NATIVE, puis autorité CANARY/smoke seulement selon autorisation et chemins normaux. Ce transfert n'est pas autorisé par la passation. Ne rien exécuter à partir de ce seul paragraphe. Aucun réimport/recovery/réparation des trois canaries, plan/OAuth/choix automatique, batch43/GLOBAL, SQL métier manuel, mutation corrective, abonnement ou reconfiguration d'infrastructure pendant la passation.

**Chaîne de reprise, première lecture sans modification :** [AGENTS](../../AGENTS.md) → [Guide ChatGPT](../../.chatgpt/CHATGPT_GUIDE.md) → ce Master → [workflow](../process/implementation-workflow.md) → [handoff](../process/conversation-handoff.md) → [ordre V1](../roadmap/implementation-order-v1.md) et [macro](../roadmap/development-roadmap.md) → [R1055/R1056](../architecture/r1055-operator-resolution.md), [migration](../architecture/legacy-migration-v1.md), [runbook](../process/legacy-cutover-runbook.md#ceo-link-postflight-runbook-20261008), [fondations/extension multi-canary](../process/twitch-native-foundations.md#extension-locale-dun-ensemble-canary-importé) et sources spécialisées → code/Prisma réels. Sources futures : [Codes](../legacy/19-codes-cadeaux-audit.md#extension-codes-r1057), [Event](../legacy/16-event-monthly-audit.md), [Auth](../architecture/backend-architecture-v1.md#password-recovery-r1058), [décisions](../specifications/decisions-log.md). Vérifier les vrais refs/diffs GitHub, signaler toute incohérence, distinguer preuve datée/candidat/public, puis attendre l'instruction propriétaire. Les UUID, preuves Helix, graphes et backups restent privés : aucune nouvelle action publique n'est autorisée sans les sources canoniques et gates fraîches ; le dossier local ignoré n'est pas un tracker global requis pour comprendre cette reprise.

AGENTS, Guide, workflow et handoff ont été relus : leurs règles permanentes restent pertinentes, sans modification. Aucun nouveau tracker global, bootstrap historique indépendant ni implémentation anticipée.

<a id="r1055-consent-promotion-20261008"></a>

## Historique — promotion R1055 contrôlée ; seconde tentative humaine alors différée

Review indépendante propriétaire **APPROUVÉE**, aucun finding bloquant, pour **f96d5a3330f2976eb7dbed392b4758b20bf2479e**. Préflight GitHub réel : main f633760/review f96d5a3, parent exact, divergence0/1, 12 patches/blobs conformes, worktree propre et aucun concurrent. Promotion strictement fast-forward du même candidat, sans force-push ; main/review/origin égaux, divergence0/0. Aucun changement de code sensible supplémentaire. Le checkpoint documentaire qui conserve ces résultats est publié sur review/main dans cette mission ; son propre SHA et ses déploiements exacts sont consignés au TASK_STATE et au rapport final, sans commit en boucle pour citer son SHA.

**Déploiement du code approuvé :** Railway **bb988480-e707-4b15-ace1-ec7c85331fce SUCCESS15:20:24UTC**, SHA f96d5a3 exact, Online1/zéroissue/pending/staged. Cloudflare **be71c398-f281-4080-85f2-14b9c7324c47 SUCCESS15:19:56UTC**, SHA exact ; production/preview200, JS/CSS identiques octet pour octet. Bundle public vérifié : chargement et réessai de comparaison et erreur compte distincte effectivement servis. Backend : déploiement actif du SHA exact, compilation TypeScript et nouveau conteneur écoutant à15:20:13UTC, health 200. L'essai de lecture directe des fichiers runtime par SSH s'est arrêté faute de clé existante ; aucune clé/configuration créée, aucun hash runtime revendiqué. La preuve backend est la provenance du déploiement actif, ses build/startup logs et sa réponse health, distincte d'une recette OAuth humaine.

**Gates publiques READ ONLY bornées :** revalidation avant15:16:57–15:16:59UTC et après15:21:02–15:21:04UTC PASS, Repeatable Read/statement5s/transaction30s, déconnexion acquise. Prisma migrate status **63 migrations à jour**, registre exact/checksums et DDL063 conformes :12index/9contraintes/73triggers, RLS/grants inchangés. Aucun nouveau fichier de migration ni DDL métier. Logs du déploiement code :66build/126runtime, fenêtres non tronquées, zéro erreur DB/pool/P1001/57014/PinoERROR. OFF réel révision11 et flagRailwayfalse ; zéroPENDING/outbound incertain/verrou/idletransaction/transactionlongue. Trois NATIVE/canaries/identités/imports/backups/deux réparations exacts ; backups locaux bruts/hash canoniques et backup Ceo v3 vérifiés avant/après. A ACTIVE/Auth-Web seul/significatif, B ACTIVE/Twitch-only/DATA_IMPORTED/LEGACY/non-canary, graphes économiques personnels contrôlés identiques avant/après, identités/target/provenance/import exacts. Ancien plan expiré non consommé, six résolutions expirées sans choix confirmé ; **11faits d'amitié Ceo DEFERRED exacts**.

Les incidents de helpers locaux sont conservés : première sérialisation BigInt privée échouée après lecture et déconnexion ; corrigée sans changement SQL/produit. Une lecture suivante s'est arrêtée sur une garde d'activité agrégée non nulle sans détail persisté ; diagnostic ciblé ensuite sans ligne anormale, puis revalidation complète PASS sans affaiblir la garde. Ne pas inventer la cause de cette observation ni de l'ancien incident PostgreSQL/Concours. Aucun redéploiement de récupération, aucune configuration expérimentale, aucune campagne DB lourde Supabase ; tests du candidat **67 DB locaux + verify:full8/8** conservés sans répétition inutile.

**STOP humain après déploiement vérifié : attendre la confirmation propriétaire que Ceo est disponible.** Aucune autorisation de quinze minutes préparée ici. Mission suivante seulement : gates fraîches/backup neuf/plan TWITCH via owner, autorisation réellement visible dans la comparaison, OAuth et choix «Utiliser ma progression Twitch» strictement humains. Vérifier B Web+Twitch ACTIVE, A ARCHIVED sans accès, sauvegarde/provenance/historiques tiers sans fusion, puis F5/logout-login. NATIVE et raccordement communautaire sont des étapes distinctes ultérieures ; onze amitiés et restauration communautaire de tous les éligibles restent suivies. Streamer.botOFF, aucun réimport B/canary, OAuth automatique, batch/GLOBAL, infra/abonnement. DetteSupabase prioritaire après migration des joueurs.

Artefacts privés ignorés : local-data/identity-resolutions/ceo-consent-promotion-20261008. Aucun identifiant personnel, fingerprint, token ou backup publié. [Contrat](../architecture/r1055-operator-resolution.md), [runbook](../process/legacy-cutover-runbook.md#r1055-consent-fix-runbook-20261008).

<a id="r1055-consent-fix-20261008"></a>

## Historique — candidat correctif ciblé du consentement et du chargement de comparaison

**Diagnostic démontré, sans mutation publique :** le plan TWITCH préparé à 15:15:01 (Paris) expirait à **15:30:01**, sans consommation. Six résolutions OAuth ont été créées entre 15:21 et 15:27, aucune avec choix/confirmation exécuté. L'empreinte du plan était modifiée uniquement par `player_activity_state.last_app_activity_at` et `updated_at` de A, présents dans deux projections du graphe. La restauration de ces seules valeurs **en mémoire locale** reproduit exactement l'empreinte initiale. Aucun changement de gameplay, identité ou relation n'est nécessaire pour reproduire le défaut. Le délai UI commun de huit secondes annulait aussi la comparaison : 499 à 7,819 s, autre lecture réussie à 7,054 s ; lecture du compte autour de 31 ms. Les renouvellements OAuth remplacent la résolution précédente ; aucune liaison n'était confirmée malgré les comparaisons affichées.

**Correctif réalisé :** projection de consentement version 2, partagée entre empreinte de comparaison et plan opérateur. Seule la table d'activité connue est normalisée : dates APPLICATION et `updated_at` redondant sont écartées lorsque les six colonnes exactes et l'invariant `updated_at = GREATEST(dates d'activité)` sont vérifiés, à la microseconde. La première ligne exclusivement APPLICATION et son seul comptage FK personnel connu sont équivalents à l'absence de cette ligne. GAMEPLAY, chat interne et activité Twitch restent significatifs. Colonne inconnue, date anormale ou `updated_at` inexpliqué restent bruts et invalidants. Aucun autre `updated_at`, état métier, identité, relation, opération ou preuve de tiers n'est neutralisé. Graphes, classifications de sûreté et backups bruts restent exhaustifs ; la projection ne transforme jamais un refus en SAFE. Les anciennes empreintes ne sont pas réutilisées sous la nouvelle version.

**UI réalisée :** lecture compte, comparaison et vérification runtime/chat ont des annulations et erreurs distinctes. Compte/runtime conservent huit secondes ; comparaison dispose d'une borne propre de 35 s, issue de la transaction backend existante de 30 s et de cinq secondes de transport. Aucun délai SQL, garde serveur ou pool modifié. Chargement explicite de comparaison, absence de « Non connecté » pendant ce chargement, bouton OAuth bloqué jusqu'à son résultat ; erreurs/réessais dédiés, annulation à la sortie et réponses périmées ignorées.

**Tests effectivement exécutés, uniquement locaux :** PostgreSQL 17.11, suites opérateur et liaison **54 PASS** (22 + 32), dont WEB/TWITCH symétriques, création/actualisation APPLICATION après plan et comparaison, activité métier et modification de tiers à comptage constant, révocation/expiration/concurrence, idempotence, rollback et conservation des sauvegardes sans fusion économique. `verify:full` **8/8 PASS**, **1 378 tests frontend + 1 981 backend non-DB**, types/builds/lint/diff-check. Contrôle visuel Codex Playwright du GameShell réel sur fixtures synthétiques : chargement/erreur/autorisation WEB/autorisation TWITCH, **huit états à 1366×768 et 390×844**, aucun accès externe ni débordement horizontal. Cette recette locale n'est pas une validation humaine publique de Ceo.

**État public conservé, observations datées :** main/review baseline **f633760b7387d1c08307b161605a78637c4546bc**, Railway/Cloudflare SUCCESS SHA exact au contrôle 12:42 UTC, Prisma 63 et DDL 063 déjà vérifiés. Diagnostic vers 15:58 Paris : A ACTIVE/Web-only, WebIdentity/Auth et gameplay intacts ; B ACTIVE/Twitch-only/DATA_IMPORTED/LEGACY/non-canary et backup v3 exact. Ancien plan expiré non consommé, résolutions expirées sans choix ; **11 amitiés legacy DEFERRED**, aucune restauration globale achevée. OFF11/flag false, trois NATIVE/imports/backups/deux réparations cosmétiques inchangés, aucune opération PENDING/outbound incertain/transaction ou verrou bloquant au contrôle daté. Aucun nouveau contrôle général Supabase, import, OAuth, archivage, activation, DDL ou configuration pendant ce lot. Cause historique PostgreSQL/Concours non démontrée conservée ; dette Supabase prioritaire après migration des joueurs.

**Gate exacte : publier ce candidat uniquement sur review et obtenir une review indépendante de son SHA.** Ensuite seulement, mission autorisée de promotion/déploiement contrôlés et recette ; disponibilité Ceo confirmée, gates fraîches, nouveau plan TWITCH de quinze minutes, puis liaison et choix personnel. Aucun plan maintenant, aucune promotion main implicite. F5/reconnexion et état gagnant vérifiés avant toute étape NATIVE distincte. Streamer.bot OFF ; aucun batch/GLOBAL ni replay des canaries. [Contrat et limites](../architecture/r1055-operator-resolution.md#consentement-technique-20261008), [runbook](../process/legacy-cutover-runbook.md#r1055-consent-fix-runbook-20261008). Aucun nouvel arbitrage produit/Rxxx.

**Complément final de sûreté :** 13 tests PostgreSQL locaux supplémentaires PASS (6 sûreté + 7 équivalence/volumétrie), soit **67 tests DB distincts**. Graphes/classifications/fingerprint complets comparés aux moteurs de référence, FK futures/composites/cycles, écriture concurrente à comptage constant, snapshot READ ONLY, annulation 57014 et connexion libérée. Une première passe a échoué dans neuf cas d'équivalence : l'oracle matérialisé antérieur incluait encore les FK de la table technique de plans ajoutée par 063, déjà exclue par le contrat déployé. Oracle aligné sur cette exclusion et la version de consentement, moteur SQL indépendant conservé ; échecs et passe finale conservés dans les logs privés. Aucune nouvelle optimisation SQL. Clôture locale : zéro connexion/transaction/verrou/schéma de test/Player de référence ; PG et serveur visuel privés arrêtés. Dernier verify:full 8/8, mêmes comptes 1 378/1 981, après finalisation du code et des oracles.

<a id="r1055-operator-audit-20261008"></a>

## Historique — R1055/R1056 déployé ; import B avant la fenêtre humaine

Review indépendante **APPROUVÉE**, aucun finding bloquant, pour **8928f7b5dc8109d9aaffd254904e7751b116d720**. Avant promotion : main32af8b7/review8928f7b, parent et72patches/blobs GitHub exacts, worktree propre. Fast-forward strict, sans force-push/rebase/squash ; refs locales/distantes alignées, divergence0/0. Le checkpoint documentaire de cette mission conserve ce code ; SHA final et pipelines finaux dans le rapport de publication, sans boucle pour inscrire son propre SHA.

**Code approuvé déployé :** Railway **f8c78682-8e52-4c5f-9315-49802f5bc757 SUCCESS12:15:00UTC**, Online1/zéroissue/pending/staged ; Cloudflare **f916223a-f988-4d4d-aa05-9c3a8caf56f6 SUCCESS**, SHA exact, production/preview200 et octets JS/CSS identiques. Health200. Prisma **63 migrations appliquées**, noms/checksums exacts avec fins de ligne prises en compte, zéroincomplète ;063 appliquée uniquement par le pre-deploy Prisma normal. DDL : **12index,9contraintes validées,2tables RLS sans grants/policies navigateur,73triggers actifs**, fonction FOR SHARE/FOR UPDATE. Deux écritures Prisma ACTIVE acceptées puis entièrement rollbackées ; aucune mutation durable de test. L'ancienne012 terminée a applied_steps_count=0, ce qui ne signifie pas une migration en attente.

**Préflight réel12:17:41–12:18:02UTC :** sources17/17 fraîches/hash exacts/couverture inconnue0, Helix et Auth→WebIdentity immuables vérifiés, jamais displayName. A ACTIVE/Web-only significatif et legacy significatif ; **IMPORT_B_READY/TWITCH_ONLY**, aucune collision/opération/provenance bloquante ; **ARCHIVE_A_OPERATOR_REQUIRED**,23catégoriesSHARED_ACTIVE. Moteur complet288FK/4896lignes/55tables/104classifications/fingerprint : total1229ms, projectionSQL570ms/références458ms/hash56ms ; aucun57014, aucune nouvelle optimisation PostgreSQL.

**Répétition PostgreSQL17.11 locale PASS :** chaîne63 réelle, sources Ceo réelles, A/tiers synthétiques significatifs avec amitié/MP/opération terminale,11faits sociaux différés. Correspondance de74UUID de catalogues par clés immuables ; tous les champs du mapping identiques à cette correspondance près, comparaison persistée par l'owner canonique. Backupv3 création exclusive/fsync, rollback **EXACT_PREIMAGE** : B/identité/target/import/faits absents comme avant, graphes A/tiers et historiques exacts. Essais de fixture échoués conservés (doublons des catalogues seedés, UUID locaux différents), aucun essai mutatif public. Pools4ouverts/4fermés ; clôture locale0connexion/transaction/verrou/schéma privé/Player de référence, PG local arrêté. Suites du candidat et verify:full8/8 conservées, sans nouvelle campagne complète/distante pour la promotion/documentation.

**Import public B acquis12:29:54–12:30:48UTC :** revalidation fraîche puis appel unique de l'owner applyLegacyCanary, backupv3 durable vérifié et comparaison personnelle exacte. B **ACTIVE/Twitch-only/DATA_IMPORTED/LEGACY/non-canary**, identité immuable/provenance/import/target cohérents, aucune WebIdentity ni NATIVE. A **ACTIVE/Auth-Web intact**, distinct et significatif ; graphes personnel/partagé et fingerprint exacts avant/après application, aucune fusion/archivage/OAuth. Première revalidation arrêtée AVANT écriture : expédition A passée normalement RUNNING→READY par l'owner existant12:24:27UTC, seuls state/updated_at, aucun gain. Nouvelle préimage réelle vérifiée avant application ; aucune garde d'archivage affaiblie. **Aucun plan opérateur créé** : son expiration15min attend la disponibilité humaine.

**Protections et stabilité :** OFF11/flagRailwayfalse ; trois NATIVE/canaries/imports/identités/backups/deux réparations cosmétiques inchangés. Clôture12:31:39UTC :0PENDING/connexionhelper/idletransaction/transactionlongue/verrou,63appliquées/0incomplète ; quatre targets, trois NATIVE/canary et B LEGACY/non-canary. Logs12:15–12:33UTC en fenêtres non tronquées :0codeDB/pool/P1001/57014/PinoERROR/diagnosticConcoursERROR. Concours reconciliation.candidate a émis WAITING2000ms puis DONE15224ms pendant la fenêtre ; stderr classé «error» par Railway n'est pas un échecSQL. Une détection brute de57014 dans un horodatage a été qualifiée comme fausse alerte, sans configuration/redeploy. Cette lecture lente reste un fait à surveiller ; cause historique PostgreSQL/Concours inconnue, pas artificiellement résolue. P0 Kichnifou validé humainement antérieurement ; aucune nouvelle validation humaine Ceo revendiquée.

**Communauté restant à raccorder :** B conserve11faits d'amitié JSON exacts (niveaux/cœurs/dates/provenance), tousDEFERRED faute de preuve immuable de l'autre endpoint ;0amitié active créée,0récompense ajoutée. Le déploiement R1056 n'achève pas la restauration de Ceo/Kichnifou/Mynonyme/Kichni_Test et des autres éligibles. Inventaire local217profils source (pas une population éligible présumée),88paires/176endpoints/443faits différés classifiés :Social285/Boss29/Event12/Giveaway31/Votes4/Codes82. Avant le futur batch43 : preuves des amis déjà/futurs importés, collisions explicites, anti-double-claim, audit Boss/historiques/finalblow/agrégats, Event/messages/collections, Giveaway, Concours/historiques/participants/récompenses/locks, votes et autres références. Zéro lockConcours du jour dans cet inventaire ne prouve pas l'audit historique. Aucune exécution communautaire globale ni réimport/réparation des trois canaries.

**Prochaine gate humaine : confirmer que Ceo est prête à effectuer la liaison.** Préparer alors seulement le plan TWITCH frais via l'owner et vérifier ses gates ; puis Ceo se connecte au standalone → Configuration > Compte > Lier Twitch → comparaison des deux vraies progressions → choix strictement humain «Utiliser ma progression Twitch». Activité incompatible/tiers/collision/preuve modifiée/plan expiré : STOP, aucun choix automatique. Aucune liaison maintenant sans cette préparation. NATIVE/extension/smoke seulement après validation réelle du choix et F5/reconnexion. Streamer.botOFF ; aucun batch/GLOBAL/SQL métier manuel/infra/abonnement. DetteSupabase après migration des joueurs maintenue.

Preuves privées ignorées : local-data/r1055-operator-promotion-20261008 et local-data/identity-resolutions/ceo-separated-operator-20261008. Aucun token, identifiant personnel, graphe ou SQL sensible publié.

## Historique — candidat opérateur R1055/R1056 avant approbation

Mission propriétaire et clarifications intégrées : **aucune priorité générale Twitch/Web**. Les JSON figés font autorité pour la sauvegarde legacy ; seul le choix explicite détermine le gameplay jouable. WEB conserve son gameplay entier face au Twitch minimal ; TWITCH conserve le sien face au standalone abandonné. Le perdant peut être archivé et perdre ses gains futurs/accès, sans fusion ni perte d'historique pour les tiers. [R1055/R1056](../specifications/decisions-log.md), [audit complet des 23 catégories et contrat implémenté](../architecture/r1055-operator-resolution.md).

Le candidat ajoute le plan opérateur privé, backup et fingerprint complet, consentement nominatif/révision/expiration, clôtures atomiques des relations du perdant et archive inerte. Les états actifs incompatibles, inconnus, outbounds incertains et collisions restent bloquants. La migration **063 n'est appliquée qu'en PostgreSQL local** : plans, faits d'amitié, versions de relation et barrière d'écriture de l'archive. Restauration des amitiés prouvées par IDs immuables, différé si ami non importé, raccord au Player définitif sans récompense/statistique additionnée. Backup canary v3 avec préimage social et compensation exacte contrôlée ; outil social ciblé distinct pour les imports déjà acquis. Aucun réimport des trois canaries.

**Deux gates démontrées séparément :** importer B TWITCH_ONLY peut préserver exactement A et ses tiers tout en laissant son archivage OPERATOR_REQUIRED. Ce découplage ne vaut pas autorisation publique dans ce lot. A reste ACTIVE/Auth-Web seul, B absent selon la dernière observation ; aucun import/OAuth/choix/NATIVE Ceo. Le préflight SQL public antérieur est complet (282 FK, 4 895 lignes/55 tables, 1 295 ms, 23 catégories SHARED_ACTIVE). Aucune nouvelle optimisation ou préflight public. Une seule lecture agrégée complémentaire à 10:21:31 UTC a précisé les états métier, sans contenu de message ni secret (SQL 872 ms ; transaction/déconnexion 1 623 ms).

**Validation locale :** voir la matrice finale ci-dessous et les artefacts ignorés local-data/identity-resolutions/r1055-operator-audit-20261008. Tests sur graphes synthétiques, aucune copie de données publiques. Contrôle visuel Codex via Playwright du GameShell réel/styling production à 1366×768 et 390×844 : deux choix autorisés séparément et deux choix bloqués, confirmations, scroll, absence de débordement horizontal ; aucune requête externe/session fabriquée. Cette observation n'est pas une recette humaine Ceo. Une course de propriétaire indirect détectée en relecture a été corrigée par verrou du parent et reproduite en test PostgreSQL concurrent.

**Production inchangée, preuves datées :** dernière promotion 32af8b7, Railway 7822d069-be2b-4f0b-8d9f-98b7cd00d2d7 SUCCESS/Online, Cloudflare 3821ab1d-860e-4671-aa9e-0bd6fe726a9b SUCCESS, health 200 et 62 migrations au contrôle précédent (10:04–10:05 UTC). OFF11/flag false et les trois NATIVE/imports/backups/cosmétiques préservés au contrôle de clôture 10:05:57 ; la lecture 10:21 confirme OFF/flag/A sans B. Aucun nouveau contrôle de déploiement ou sondage général répété dans cette mission. P0 déjà validé humainement ; cause historique PostgreSQL/Concours non démontrée, pas artificiellement déclarée résolue.

### Matrice finale réellement exécutée — PostgreSQL local uniquement

| Périmètre | Résultat final |
| --- | --- |
| Opérateur R1055 WEB/TWITCH ; liaison existante | 15 + 32 PASS |
| Import B indépendant ; canary v3/préflight social/rollback | 2 + 12 PASS |
| Registre/réconciliation sociale ; CLI d'une paire | 17 + 13 PASS |
| Barrière physique et course de propriétaire indirect | 6 PASS |
| Boss, Event B/C/lifecycle/milestones, Expédition, Banque, Codes et archives | 80 cas distincts PASS après corrections ciblées |
| Social/MP/Faveur | 40 PASS |
| Extension/transfert canary, réparation cosmétique et cosmétiques dérivés | 79 cas distincts PASS après correction des identités synthétiques des fixtures |
| DDL | 63 migrations rejouées et migrate status dans les fixtures ; 23 tables privées/RLS/grants, parité 1 215 colonnes PASS |
| GameShell réel, styles de production | Contrôle visuel Codex PC/mobile, choix WEB/TWITCH/bloqués ; aucune requête externe |
| verify:full | **8/8 PASS**, 1 373 frontend + 1 981 backend non-DB ; builds/typechecks/lint/diff-check PASS |

Les passes intermédiaires échouées restent conservées : mocks Event/purge actualisés, fixtures qui réutilisaient un même login pour plusieurs IDs corrigées, course indirecte réellement corrigée. Le test de scan historique lisait les artefacts opérateur accumulés : découverte désormais synthétique avec vrai loader/contrôles de chemin, sans modifier le code produit. Deux timeouts du test Chat inchangé passent avec `VITEST_MAX_WORKERS=2` pour le processus de vérification complet ; aucune hausse de timeout ni configuration produit persistante. Les reruns ne sont pas additionnés aux comptes. Logs finaux verify-full-workers2, canary-social-final, operator-15 et owners dans les répertoires privés indiqués ; warning de bundle et dépréciation pg de suites existantes conservés.

Clôture locale vérifiée : zéro autre connexion/transaction/verrou en attente, zéro schéma de test restant, zéro Player dans la référence synthétique. Pools des fixtures fermés et opened=closed ; Vite de capture et PostgreSQL local arrêtés. Aucune lecture publique supplémentaire pour cette clôture. Git avant publication : HEAD/origin main/review 32af8b7, divergence0/0 ; le candidat est un commit review dédié, sans rebase/squash/force-push. Son SHA et la confrontation finale GitHub figurent dans le rapport de publication, sans boucle de commit pour inscrire son propre SHA.

**Prochaine action exacte : review indépendante du SHA candidat**, avant main, déploiement, application publique de 063 ou opération Ceo. Après approbation seulement : promotion/déploiements contrôlés puis preuves fraîches A/17 JSON/Helix, préflight B complet, rehearsal représentative/backup/comparaison/rollback exact et import ciblé autorisé B DATA_IMPORTED/LEGACY/non-canary. Vérifier les deux progressions significatives ; plan opérateur frais puis liaison et choix strictement humains. Aucun OAuth anticipé, batch/GLOBAL, SQL métier manuel, replay/réparation/recovery canary, commande Twitch ou chantier infrastructure. Streamer.bot OFF ; audit coûts Supabase après migration des joueurs conservé.

<a id="r1055-astra-promotion-20261008"></a>

## Historique — R1055 déployé ; Ceo STOP sur les relations partagées

Review indépendante Astra **APPROUVÉE**, aucun finding bloquant, pour **524e9f992bc03f788beea0fa72eb246e8d65c965**. Le code reste strictement celui approuvé ; aucune nouvelle décision Rxxx. Avant publication : GitHub main 52b5631/review 524e9f9, ancestry exacte et divergence 0/1, worktree propre ; treize patches et blobs GitHub confrontés au commit local, PASS.

Gates publiques avant promotion PASS : connexion/configuration canonique Railway, Prisma **62 migrations à jour**, READ ONLY Repeatable Read/statement 5 s/transaction 60 s, déconnexion effective. OFF révision **11**, flag **false**, zéro opération PENDING/outbound incertain/verrou bloquant/transaction longue ; trois NATIVE, imports/identités/backups exacts, cosmétiques cohérents et deux audits de réparation inchangés. Ceo A Auth/Web ACTIVE intact, sans Twitch ; B/target/import absents. Railway baseline 52b5631 **SUCCESS/Online1**, zéro issue/pending/staged ; aucune modification de configuration ni redéploiement manuel.

Documentation d'approbation **d8ba1375db12fba1a7c1845ca9b085dc483cc410** publiée review, trois patches/blobs GitHub exacts, puis promotion fast-forward strict/push/fetch : main/review/origin alignés, divergence **0/0**, worktree/index propres. Code Astra approuvé inchangé. Railway **4c943080-dfe7-4dfb-841c-a3f3ba01f31a SUCCESS 09:55:01 UTC**, SHA exact/Online1/zéro issue/pending ; build/pre-deploy62/no pending. Cloudflare **a06c7b20-b8ba-43e0-8ce9-333ae1268ec5 SUCCESS**, SHA exact/production-preview200/octets JS-CSS exacts. Health200 **09:56:07 UTC**, Prisma canonique avant/après62 à jour. Logs non capés65build/48runtime/16HTTP sans erreur DB/pool/P1001/HTTP ; après préflight92runtime/46HTTP sans erreur. Aucun retry de déploiement ou reconfiguration. Les déploiements du checkpoint documentaire qui porte ces résultats sont contrôlés séparément, sans boucle de commits pour inscrire son propre SHA.

**UN préflight public Ceo exécuté, 09:56:21–09:56:35 UTC, READ ONLY :** sources fraîches 17/17/copies et hashes exacts/couverture inconnue 0, Helix frais un compte/zéro anomalie ; A identifié par Auth confirmé/session existante/WebIdentity immuable, ACTIVE/Web-only/significatif. Le moteur termine le point fixe **4 895 lignes/55 tables**, inventorie **282 FK**, exécute **241 branches de références en quatre lots 64/64/64/49**, fournit 104 classifications stables et le fingerprint complet validé. Projection SQL **534 ms**, références SQL **574 ms**, fingerprint **45 ms**, moteur de bout en bout **1 295 ms** ; helper complet **15 143 ms**. Deux projections 64 puis 6 branches (445/89 ms), quatre lots de références 180/129/87/178 ms ; aucun statement au-delà de 5 s, aucun 57014. Ces durées sont publiques réelles, distinctes des campagnes synthétiques ci-dessous.

**Résultat métier : OPERATOR_REQUIRED / TWITCH_PROGRESSION_SHARED_STATE_REQUIRES_OPERATOR.** Vingt-trois catégories de références classées SHARED_ACTIVE, sans déduction SAFE à partir de la vitesse. Exemples de preuves complètes : invitations Arcade (4 entrantes/1 sortante), références externes de receipts Arcade 29/meilleure session 1, attaques Boss 18 et participations 2, une conversation/participation DM et 97 messages/références d'opérations, deux états Event Game B/un participant Event/18 messages sociaux dans chaque sens, cœurs 16 émis/13 reçus, deux demandes d'amis/une amitié, deux mentions globales, une expédition non admissible et 13 mouvements liés à des opérations externes. Ces comptages par FK ne sont pas des nombres de relations distinctes ; aucune donnée, identité ou SQL sensible publié. Ce sont les règles conservatrices existantes R1055, pas une nouvelle erreur de performances. Le helper s'arrête sur **CEO_R1055_OPERATOR_REQUIRED après le fingerprint** ; failedStage CANONICALIZATION_EVIDENCE dans l'artefact indique la dernière requête observée, déjà terminée, et non un timeout.

**STOP exécuté, sans deuxième préflight ni mutation :** plan legacy complet/signification legacy/rehearsal/backup B/comparaison/rollback/apply **non exécutés**. B/TwitchIdentity/target/import/OAuth absents ; A gameplay/Auth/Web préservés, aucun rapprochement par pseudo, aucune fusion. Le fingerprint obtenu ne vaut pas autorisation d'import. Fermeture READ ONLY **09:57:49 UTC PASS** : zéro connexion Ceo/verrou/idle-in-transaction/transaction longue, 62 appliquées/zéro incomplète, zéro PENDING, OFF11/flag false, trois targets/imports/identités et deux réparations exacts ; A ACTIVE/Web-only et B/OAuth absents. Graphes des trois canaries identiques avant/après déploiement, backups et cosmétiques vérifiés. Les causes historiques 57014/pool restent non démontrées ; le présent parcours complet sans timeout démontre sa performance actuelle, pas une réparation historique inventée.

**Prochaine mission : diagnostic/résolution opérateur canonique R1055 pour ces références, sous autorisation propriétaire distincte.** Ne supprimer/contourner aucune relation et ne modifier aucune garde. Si le mécanisme réel manque, candidat sensible sur review puis review indépendante avant promotion. Aucun import ou lien Ceo maintenant ; la gate humaine Configuration > Compte > Lier Twitch attend B séparé importé et vérifié. Streamer.bot OFF, aucun batch/GLOBAL/commande Twitch ni replay/réparation/recovery des trois canaries. Dette Supabase après migration inchangée. Preuves privées ignorées : local-data/r1055-astra-promotion-20261008 et local-data/identity-resolutions/ceo-separated-astra-20261008 ; publication documentaire seulement, aucune suite DB/full répétée pour le code approuvé inchangé.

<a id="r1055-astra-20261008"></a>

## Historique — candidat R1055 structurel ; gate de review indépendante acquise

Mission Astra sur baseline **main = review = 52b5631c1988a895b90046347a8db320f810432f**, worktree propre au départ. Le présent candidat est autorisé uniquement sur **review**, sans promotion ni déploiement. Le [dossier d’architecture et de preuves](../architecture/r1055-canonicalization-performance.md) compare les stratégies et explique les invariants. Aucune nouvelle décision produit/Rxxx, migration ou configuration fournisseur.

**Correction complète :** fermeture incrémentale jusqu’au point fixe, suppression des chemins redondants déjà couverts depuis Player, déduplication par ensemble d’images complètes, clés FK JSONB typées sans perte bigint pour les jointures, branches groupées par parent et bornées à **64**. Les images complètes restent la source du fingerprint version 1. Isolation Repeatable Read/Serializable explicitement exigée ; transactions Serializable de 30 s du owner, préflight READ ONLY/statement 5 s, retries/verrous et consentement inchangés. Références inconnues/partagées/états actifs conservés fail-closed. Aucun calcul partiel, staging, Promise.race ou requête détachée.

**Cause mesurée et portée :** ancien moteur 52b5631 testé contre le candidat sur les mêmes données synthétiques, 62 migrations/282 FK/55 tables. Le graphe complet était renvoyé trois fois, les images complètes réexpansées/comparées et le plan non borné. La déduplication Array.includes atteint aussi 7,65 s sur le cas 10×, contre 24 ms pour la fusion du candidat. Le cas 4 895 lignes/5,63 Mo produit 244 branches (241 publiquement : distribution différente). EXPLAIN sépare les temps locaux ; aucune nouvelle lecture Supabase ou configuration, et aucune cause précise du 57014 public ou de l’incident pool/PostgreSQL déclarée résolue.

**Dernière campagne locale, 08/10 :** comparaison exacte des graphes, classifications/comptages, sûreté et fingerprint PASS. L’ancien total ci-dessous est la **somme de ses étapes instrumentées** ; celui du candidat est chronométré de bout en bout. EXPLAIN est mesuré séparément. [Mesures numériques bornées](../architecture/r1055-performance-evidence.json).

| Graphe synthétique | Octets du graphe | Ancien, somme des étapes | Candidat, total | Paramètres SQL ancien → candidat |
| --- | ---: | ---: | ---: | ---: |
| 1× : 4 895 lignes / 55 tables | 5 630 745 | 1 507 ms | **270 ms** | 16,89 → 1,29 Mo |
| 4× : 19 313 lignes / 55 tables | 22 430 462 | 6 782 ms | **862 ms** | 67,29 → 5,10 Mo |
| 10× : 48 149 lignes / 55 tables | 55 998 058 | 23 261 ms | **2 051 ms** | 167,99 → 12,72 Mo |

À 10×, références anciennes : **plan 36,5 ms / exécution 8 049 ms**, donc exécution au-delà de la borne de cinq secondes. Candidat : quatre lots de références, plan maximum **7,4 ms**, exécution maximum **498 ms**, sans JIT ; six requêtes projection/références quelle que soit cette taille. Le hash reste linéaire : 20/95/182 ms. Ce résultat local ne garantit pas la latence sur Shared Pooler.

Population supplémentaire **250 Players / 25 000 opérations** : résultat identique, total 277 → 288 ms. Parcours réels avec deux progressions 1×/4× dans les transactions Serializable originales : verified/pending/resolve **1 260/1 173/1 218 ms (WEB)** et **1 230/1 219/1 252 ms (TWITCH)**. Deux identités sur le gagnant, perdant ARCHIVED, gameplay intégral des deux conservé ; aucune addition ni perte. Rollback après écritures d’identités, choix simultanés et idempotence vérifiés séparément.

**Tests DB locaux : 45/45 PASS** — sûreté 6, liaison 32, performances 7. Oracles indépendants figés 0af5827 et 52b5631 ; ce dernier confronté exactement à git show (imports/nom exporté seuls adaptés). Bigint adjacent au-delà de 2^53, FK composites/nulles/cycliques, multiplicité, tiers, 96 futures FK, 65 colonnes FK, référence inverse de Players, changement concurrent de payload, READ ONLY, révision du consentement, états actifs, timeout SQL sans résultat partiel/orphelin, réutilisation et fermeture complète du pool couverts. Les erreurs de préparation des premières fixtures ont été corrigées ; seuls les derniers runs complets font foi. Le warning de dépréciation pg@8 relatif au séquencement du client apparaît sur le gros oracle ; aucun échec, transaction orpheline ou connexion résiduelle constaté dans ces suites. La borne étendue de l’oracle de diagnostic privé n’est pas une modification des délais du produit.

**Vérification finale :** `verify:full` **8/8 PASS** : frontend 126 fichiers/1 370 tests, backend non-DB 135 fichiers/1 978 tests, deux builds, types et lint ; diff-check worktree/index PASS. Prisma local migrate status **62 à jour** ; clôture : zéro schéma privé restant, autre client, idle-in-transaction, verrou bloquant ou Player dans le schéma public local de référence. Les pools des trois suites sont fermés avec autant de connexions ouvertes que fermées. Aucun test visuel/public requis ou revendiqué pour ce changement backend. Préflight Ceo, promotion et déploiement **non exécutés**, conformément à la gate de review indépendante.

**État public conservé, non recontrôlé dans ce lot local :** dernier checkpoint 52b5631 ; Railway 5f86e0b9-b48e-4466-8e8c-80f56fc48112 et Cloudflare cecb9ca2-d677-435e-9432-8d675b31b59c SUCCESS exacts le 08/10, health 200 à 08:09:47 UTC/Prisma 62. Dernière clôture READ ONLY : OFF11, flag Railway false, trois NATIVE/imports/backups et réparations exacts, A Web/Auth intact, B absent. Les erreurs et observations historiques ci-dessous restent conservées. Aucun résultat humain ni déploiement nouveau ne découle des tests locaux.

**Prochaine action unique : review indépendante ChatGPT du SHA review publié.** Après approbation seulement, mission de promotion stricte et contrôle des déploiements/protections, puis UN préflight Ceo complet borné avec projection/références/fingerprint/total. Tout 57014/instabilité/SHARED_ACTIVE/OPERATOR_REQUIRED impose STOP précis. Rehearsal privée/backup/comparaison/rollback exact et import Twitch B séparé seulement après toutes les gates ; liaison humaine uniquement après B vérifié. Aucun OAuth/import/liaison Ceo, batch/GLOBAL, replay/réparation/recovery des trois canaries ni commande Twitch maintenant. Streamer.bot OFF. Dette Supabase prioritaire après migration des joueurs, sans optimisation infrastructure dans ce lot.


<a id="r1055-promotion-ceo-20261008"></a>

## Historique — R1055 déployé ; Ceo STOP à CANONICALIZATION_EVIDENCE

Review indépendante ChatGPT **APPROUVÉE**, aucun finding bloquant, pour fccd0d6aa1814fe1c6e645c7aa6266f21f23ae5b. Documentation d’approbation 92d638963db9f9d59d5f3052690fc93068138341 publiée review et vrais diff/blobs GitHub vérifiés, puis fast-forward strict main/push/fetch : quatre refs alignées, divergence 0/0, worktree propre. Le code approuvé reste inchangé ; aucune nouvelle règle Rxxx, suite DB ou verify:full répétés. Le présent checkpoint ajoute seulement les résultats réels ; publier review, contrôler le vrai diff, promouvoir strictement et contrôler ses deux pipelines exacts si les gates de stabilité restent satisfaites, sans redéploiement manuel ni boucle de commits pour inscrire son SHA.

**Déploiements du produit, 07:56–07:57 UTC :** Railway 9cc159c7-4e27-44b4-9d09-9ce434f3b8d4 SUCCESS/Online/une replica, SHA exact 92d6389, zéro issue ou pending ; build/pre-deploy/runtime contrôlés séparément, 62 migrations et aucune pending, aucune erreur DB/pool/P1001 dans les logs bornés non capés. Cloudflare cc6b91c9-0b55-4e08-bedb-87cbfc87cc90 SUCCESS du même SHA, preview/production 200, chemins et octets JS/CSS identiques au build exact. Health backend 200. Prisma migrate status canonique avant/après PASS/62 à jour. Gates READ ONLY avant/après PASS/connexions fermées : OFF11/flag false, zéro opération/outbound incertain ; trois NATIVE/targets/imports/identités/backups exacts, cosmétiques 0/0, 96/5, 2/1 sans écart et deux audits inchangés. A Web/Auth intact, B absent.

**Unique préflight Ceo réel, 07:58 UTC, READ ONLY :** copie fraîche exacte des 17 sources, couverture inconnue zéro et preuve Helix fraîche sans conflit. Auth → WebIdentity → A ACTIVE/Web-only/session valide et progression significative réutilisés par IDs immuables, sans displayName ; graphe A capturé. Transaction RepeatableRead 60 s et statement_timeout 5000 ms conservés, processus borné terminé en 31,3 s, aucune hausse de limite. Mesures sans données personnelles : métadonnées 282 FK/70,6 ms ; racine 26,2 ms ; projections 1/2/3 : 1658/2582/2391 ms. Fermeture stabilisée à 4895 lignes sur 55 tables ; construction des références 241 branches/17,6 ms, entrée JSON 5 566 868 octets. La requête de références est annulée par P2010/PostgreSQL **57014** à **CANONICALIZATION_EVIDENCE**. Aucun résultat evidence/fingerprint complet ; le coût de planification versus exécution à l’intérieur de cette requête n’est pas départagé dans cette mission. Les projections sont désormais terminées, sans déclarer le préflight corrigé entièrement ni présumer une classification SAFE/SHARED_ACTIVE.

**STOP appliqué :** aucun second préflight, EXPLAIN public supplémentaire, nouveau test distant ou changement moteur/configuration. Plan canary complet/TWITCH_ONLY, signification legacy, rehearsal/backup/comparaison/rollback et import B non exécutés, la gate préalable n’étant pas PASS. A/Auth/Web/gameplay conservés par parcours entièrement READ ONLY ; B/TwitchIdentity/target/import/OAuth Ceo absents. Aucune demande de liaison humaine, aucun Ceo NATIVE.

**Fermeture finale 08:02 UTC PASS :** zéro connexion ceo-separated-preflight, transaction longue, idle-in-transaction ou verrou bloquant ; 62 migrations/zéro incomplète, aucun businessOperation PENDING, OFF11/flag false et trois targets/imports/identités/deux audits strictement identiques au postflight. await disconnect terminé. Première sonde de fermeture interrompue par une validation du helper local (EXECUTING n’est pas un statut BusinessOperation), corrigée sans écriture ; sonde suivante : deux idle-in-transaction, zéro connexion Ceo/bloquage/transaction longue ; aucune transaction idle à la sonde finale. Ces observations intermédiaires sont conservées, sans attribuer une origine non démontrée. Fenêtre runtime/HTTP 07:56:53–07:59:30 non capée : 118 logs runtime/59 HTTP, zéro erreur DB/pool/P1001/HTTP. Aucun mutatif public, replay ou réparation ; backups déjà revalidés avant/après produit.

**Reprise exacte :** mission ciblée de diagnostic privé des 241 evidenceQueries sur un graphe représentatif des 55 tables/5,6 Mo, avant tout nouveau préflight Ceo. Préserver exhaustivité FK/tiers/fingerprint/consentement/bigint et borne existante ; aucun contournement de sûreté ou hausse arbitraire. Une nouvelle modification sensible repasse par tests et review indépendante. Le prochain import reste exclusivement B distinct DATA_IMPORTED/LEGACY/non-canary après préflight entièrement PASS et rehearsal/backup/comparaison/rollback exact ; la liaison humaine attend B vérifié. Cause historique PostgreSQL/Concours inconnue, P0 clos, dette Supabase prioritaire après migration des joueurs, aucun changement infrastructure/abonnement. Streamer.bot OFF ; aucun GLOBAL/batch/commande Twitch/reimport des trois canaries. Preuves privées ignorées : local-data/r1055-promotion-20261008 et local-data/identity-resolutions/ceo-separated-r1055-20261008.

<a id="r1055-query-candidate-20261008"></a>

## Historique — planification R1055 optimisée en privé ; gate de review indépendante

**Baseline :** main=review=0af58272966c1c97094458c2029e7375ba9a34a7, divergence 0/0 avant ce lot. Le P0 public et la hauteur Concours restent livrés/validés, sans nouvelle recette ou modification UI. La présente mission modifie la construction des requêtes du moteur de sûreté : publier le candidat uniquement sur review, vérifier le vrai diff GitHub, puis STOP pour review indépendante ChatGPT. Aucune promotion, aucun déploiement ou préflight optimisé public avant approbation ; aucune nouvelle règle produit/Rxxx.

**Diagnostic public unique READ ONLY, 07:08 UTC :** 282 FK lues (128 ayant directement players pour parent), métadonnées 117 ms dont FK 89 ms ; racine 30 ms. Projection 1 : 64 branches, plan EXPLAIN 260 ms, exécution 1803 ms, 3795 lignes capturées ; fusion 5 ms, 49 tables avec la racine. Construction projection 2 : 98 branches/0,2 ms. Son EXPLAIN seul est annulé à cinq secondes par PostgreSQL 57014/P2010, avant exécution de la projection. Les références et le fingerprint publics ne sont donc pas atteints : aucun conflit partagé ni état SAFE public démontré. Le plan disponible utilise 64 Hash Join/Seq Scan/Function Scan, sans JIT ; les index Player/opération/session existent sur les grands domaines concernés. Aucun besoin de nouvel index démontré, aucun DDL/configuration changé. Transaction et connexion fermées.

**Correction :** matérialiser le paramètre JSONB une fois et chaque recordset typé une fois par statement, puis réutiliser ces CTE dans les UNION, classifications et contrôles sortants. La répétition du même gros paramètre dans l’ancien plan est supprimée ; pas de hausse de timeout, changement de pool, annulation concurrente ou opération détachée. Métadonnées/FK, fermeture descendante, protection des tiers, égalités de lignes JSONB complètes, classifications fail-closed, format/version du fingerprint, tri et précision bigint restent identiques. Mesures facultatives par étapes, uniquement nombres/temps, sans identifiant, SQL, graphe ou credential ; une exception de l’observateur ne change pas le résultat métier. [Owner](../architecture/backend-architecture-v1.md#optimisation-de-la-planification-r1055--candidat-review).

**Preuve privée synthétique, migrations 62 :** 1415 opérations terminales, 1205 mouvements, 646 receipts et 26 sessions Arcade abandonnées ; fermeture de 3340 lignes/14 tables, JSON de 4 396 671 octets, mêmes 282 FK. L’ancien EXPLAIN de projection 2 reproduit exactement 57014 à cinq secondes. Le candidat termine les deux projections et les preuves sous la même borne par statement ; aucun JIT observé. Mesures du dernier test :

| Étape | Construction | Plan EXPLAIN | Appel mesuré, EXPLAIN inclus |
| --- | ---: | ---: | ---: |
| Métadonnées / racine | — | — | 195 / 30 ms |
| Projection 1, 64 branches | 0,9 ms | 183 ms | 1683 ms |
| Projection 2, 91 branches | 7,6 ms | 447 ms | 2225 ms |
| Références, 182 branches / 17 résultats | 6,9 ms | 735 ms | 1988 ms |
| Fingerprint, 3340 lignes | — | — | 33 ms |

**Tests réellement exécutés :** les 30 tests métier R1055 passent dans une seule fixture privée : choix WEB/TWITCH, archive sans fusion, idempotence, tiers/états partagés, reconfirmation périmée, relations futures inconnues et bigint au-delà de 2⁵³. Un oracle figé de 0af5827 vérifie l’égalité complète safety/classifications/fingerprint sur les cas ciblés. Le test volumineux passe séparément après correction de sa fixture (un receipt exige session/invitation) ; son assertion 57014 utilise le code PostgreSQL imbriqué de l’adapter Prisma. Les exécutions intermédiaires échouées sont conservées, sans les présenter comme PASS ; aucune répétition de toute la suite distante. Cleanup privé terminé, pool total/idle/waiting=0 et opened=closed. verify:full 8/8 : 1370 tests frontend, 1978 backend non-DB, builds/typechecks/lint/diff-check PASS ; warning de bundle existant. Preuves ignorées : local-data/identity-resolutions/r1055-diagnostic-20261008, logs verify-full-xa9jnw.

**État réel relu, 07:28–07:29 UTC :** Railway c7e4f687-befd-4502-8e11-90dec0df9d75 SUCCESS/Online/une replica, zéro issue ou travail pending ; aucun nouveau déploiement. PostgreSQL/Prisma accessibles, 62 migrations terminées/zéro incomplète, zéro connexion de diagnostic Ceo, transaction longue, idle-in-transaction ou verrou bloquant, disconnect terminé. Flag canonique false et OFF11 ; trois targets/imports/identités strictement identiques au checkpoint avant lot. Backups locaux : trois fichiers, octets/hash/provenance exacts. Aucun mutatif public ni replay/réparation/import/recovery/commande Twitch ; les réparations cosmétiques restent celles du checkpoint déployé, sans nouveau recalcul métier. A Auth/Web ACTIVE et sans Twitch conservé, B/TwitchIdentity/target/import Ceo absents, zéro OAuth Ceo.

**Limite et prochaine action :** review indépendante du SHA candidat avant promotion. Le coût réel des références/fingerprint sur les 49 tables Ceo reste à mesurer après approbation ; la preuve privée ne vaut pas réussite du préflight réel. Après promotion/déploiements exacts contrôlés seulement : rafraîchir sources/Helix, préflight complet TWITCH_ONLY vers B distinct, rehearsal/backup/comparaison/rollback exact, puis import B DATA_IMPORTED/LEGACY/non-canary si toutes les gates passent. La demande humaine de liaison attend B vérifié ; A intact, aucun choix automatique. Streamer.bot OFF, aucun GLOBAL/batch ou reimport des trois canaries. Le coût de planification R1055 identifié ne démontre pas la cause historique de l’incident PostgreSQL/Concours, toujours inconnue.

**Dette d’infrastructure décidée par le propriétaire — après Ceo et migration des joueurs :** audit/optimisation Supabase prioritaires ensuite. Chiffres signalés, non re-mesurés dans ce lot : Egress 8,41/5 Go ; Shared Pooler 4,485 Go le 05/10 ; Log Ingestion 6,99/1 Go ; forte activité de tests DB privés sur l’instance publique ; fin de grâce signalée au 07/11/2026. Aucun abonnement/infrastructure/historique changé, aucune garantie de test réduite. Limiter maintenant les tests distants aux preuves indispensables ; prochaine mission coûts : PostgreSQL local/éphémère et optimisation du trafic après migration.

<a id="contest-height-ceo-20261008"></a>

## Historique — hauteur Concours déployée ; Ceo STOP sans import

**Périmètre autorisé :** baseline main=review a8f14ac68afc9a9104a92f7e953bc5d9b0f58fd4, divergence 0/0, worktree propre. Le [P0 public validé](#p0-deploye-recette-humaine-20261007) reste clôturé : Ctrl+F5/Concours réel/reconnexion et 23 GET Concours 200 ; cause SQL historique inconnue. Aucun nouvel incident démontré. Correction visuelle bornée, promotion review/main dans la même mission autorisée, puis préparation Ceo seulement après déploiement stable ; aucune nouvelle décision Rxxx ni mécanique produit.

**Défaut et correction démontrés localement :** dans le vrai GameShell avec src/index.css et src/App.css chargés, le body dispose de 627 px à 1920×1080 et 987 px à 2560×1440, mais sa ligne de grille alignée en début conserve le panneau vide à 330 px. Une règle desktop ciblant uniquement le body contenant contest-empty étire cette ligne flexible : panneau 627/987 px, contenu centré, minimum 330 px conservé à 1366×768. Mobile 390×844 : hauteur naturelle 330 px et scroll document inchangés. Lobby/partie/résultat restent hors du sélecteur ; leurs dimensions calculées avant/après sont identiques. Aucun changement backend/gameplay/transactions.

**Vérification Codex exécutée :** Playwright local autonome, fixtures synthétiques et API/Auth publiques désactivées ; quatre viewports 1366×768, 1920×1080, 2560×1440, 390×844. Seize captures P0 (normal/indisponible/focus/retry/chargement/pending) plus seize captures et mesures des quatre états métier ; zéro erreur navigateur/requête externe/overflow horizontal. Captures vide et indisponible inspectées par Codex, distinctes de toute nouvelle recette publique humaine. 41 tests ciblés ContestScreen/coordinator/indisponible PASS ; verify:quick 5/5 PASS ; build frontend PASS, avertissement existant de taille de bundle. Aucun test DB nécessaire à ces trois lignes CSS ; répétition DB Ceo reste obligatoire avant import.

**Préflight public READ ONLY, 08/10 06:41–06:42 UTC :** Railway réellement actif a8f14ac SUCCESS/Online/une replica, zéro issue/pending ; FAILED ancien 82d8d14/pre-deploy P1001 conservé dans l’historique, non rejoué. Prisma canonique 62 migrations à jour, flag TWITCH_COMMAND_PILOT_ENABLED=false. Gate complète PASS/disconnect terminé : OFF11, trois NATIVE/targets/imports/identités/backups exacts, cosmétiques 0/0, 96/5, 2/1 et deux audits inchangés ; zéro opération/outbound incertain, transaction longue/idle-in-transaction/verrou bloquant. Ceo A réel Auth/Web ACTIVE sans Twitch/import/target intact. Logs runtime/HTTP 06:41–06:42 UTC sans cap : zéro erreur HTTP/DB/pool/P1001/stage Concours lent ; aucune requête Concours authentifiée dans cette fenêtre, aucune nouvelle validation métier déduite.

**Publication acquise :** ec5cd9a5a20a571fbed3021efaed656d53e91fea publié review, quatre diff/blobs GitHub exacts, puis fast-forward main ; refs alignées/divergence 0/0. Railway SUCCESS e091a829-cb49-4079-b368-7d7c01e163a1 à 06:44:47 UTC, Online/une replica/zéro issue ou pending ; pre-deploy 62 migrations/aucune pending. Cloudflare SUCCESS fbcf6ba4-b36b-4e77-8439-59b03eff698e du même SHA, preview/production 200 et octets JS/CSS exactement identiques. Health backend 200/status ok. Postflight Prisma 62/flag false/gate complète préservation PASS/disconnect terminé ; contrôle/imports/targets/identités/audits/WebIdentity strictement identiques au préflight. Aucun nouveau P1001/pool. Contrôle visuel local acquis ; aucune nouvelle validation visuelle humaine publique prétendue. Le checkpoint documentaire des résultats conserve strictement ce code ; contrôler ses pipelines exacts sans boucle de commits pour inscrire son propre SHA.

**Préflight Ceo READ ONLY interrompu :** sources fraîches 17/17, hashes source/copie exacts, couverture inconnue zéro ; preuve Helix fraîche privée. Auth → WebIdentity → A ACTIVE sans Twitch relu par identifiants immuables, session Auth valide et progression Web significative confirmées, graphe personnel lu. Aucun rapprochement Web par displayName. À CANONICALIZATION_SAFETY, la requête canonique assessPlayerCanonicalizationSafety/Prisma $queryRawUnsafe est annulée par statement_timeout=5000ms, PostgreSQL 57014 « canceling statement due to statement timeout ». Ce n’est ni P1001/pool, ni la preuve d’une relation conflictuelle : classification non terminée. Aucune seconde tentative DB ni hausse de borne. L’adaptation locale du helper de copie au format de la nouvelle preuve gate a été corrigée avant accès DB, sans mutation publique.

**STOP Ceo / fermeture prouvée :** plan TWITCH_ONLY complet, signification legacy, répétition DB privée/backup/comparaison/rollback et import B non exécutés, faute de gate des références passée. B absent ; A/WebIdentity intacts, zéro OAuth/lien/choix/transfert/NATIVE Ceo. Transaction READ ONLY annulée, await disconnect terminé et processus terminé normalement, sans timeout de l’arbre. Sonde finale bornée 06:50 UTC PASS/disconnect terminé : zéro connexion ceo-separated-preflight/verrou/transaction longue/idle-in-transaction ; 62 migrations terminées/zéro incomplète, OFF11, trois targets/imports/identités exacts, A ACTIVE/Web-only et zéro TwitchIdentity/target/import/OAuth Ceo. Logs runtime/HTTP 06:47:30–06:48:30 sans cap : zéro erreur HTTP/DB/pool/P1001/stage Concours lent. Ce contrôle local échoué ne rouvre pas le P0 public.

**Prochaine action :** diagnostic DB privé ciblé du coût de la requête canonique de classification des références/fingerprint, puis contrôle complet borné avant toute nouvelle tentative Ceo. Aucun contournement, suppression de relation, hausse arbitraire de timeout ou import B. Si un changement sensible de transactions/concurrence devient nécessaire : tests/publication review puis review indépendante avant promotion. Aucune liaison Twitch humaine à ce point ; la demande Configuration > Compte > Lier Twitch attend B importé/vérifié. OFF11/flag false et Streamer.bot OFF conservés ; aucun batch/GLOBAL/replay/réparation/recovery/commande Twitch. Aucune nouvelle décision Rxxx.

<a id="p0-deploye-recette-humaine-20261007"></a>

## Historique — P0 rétabli et validé publiquement ; clôture documentaire

**Promotion exécutée :** code a6dceebe10772a6ad262c07b85e63a2a4f1a7575 approuvé indépendamment, finalisation documentaire 7e900df39fa19939b03cec9b66961f74ae2134e8 publiée sur review puis ensemble promu vers main par fast-forward strict. Push/fetch du 07/10 à 20:44 UTC : main/review/origin main/origin review tous 7e900df, divergence 0/0, worktree/index propres. Diffs GitHub exacts des 25 fichiers du candidat et quatre fichiers d’approbation ; aucune source produit changée après a6dceeb. Les checkpoints documentaires 0aba64c puis b4932a31b97b115e8c25c610afa36e4e90d98f58 ont ensuite consigné les résultats et la recette validée ; b4932a3 est aligné main/review et déployé SUCCESS sur Railway et Cloudflare. Le présent ajustement documentaire clôt les formulations de reprise, sans nouveau code, reconfiguration ou redéploiement manuel ; son SHA exact est contrôlé à la fin de la mission.

**Déploiement produit vérifié sur 7e900df, 07/10/2026 :** Railway SUCCESS à 20:46:47 UTC, déploiement 10f71959-3ed8-4027-84c1-f815332679c9, Online/une replica, zéro warning/critical actif, aucun staged/applying. Pre-deploy : 62 migrations trouvées, aucune pending, pas de P1001 ; application démarrée et healthcheck réussi. Health public 200/status ok (12 ms proxy). Cloudflare Pages check GitHub completed/success pour le SHA complet 7e900df, déploiement 48823cf2-ca53-4937-b8a1-072b7cd9593f ; preview 48823cf2.gachaimpact.pages.dev et production 200, chemins et octets JS/CSS de production strictement identiques à ce build exact. Backend et frontend contrôlés séparément. L’ancien FAILED 82d8d14/pre-deploy P1001 reste historique et n’a pas été rejoué.

**Contrôles après déploiement, 20:47–20:48 UTC :** migrate status canonique Railway PASS/62 à jour/code 0 ; flag canonique false conservé. PostgreSQL : 62 migrations terminées/zéro incomplète, zéro connexion bloquée/transaction longue/idle-in-transaction. Gate READ ONLY PASS et disconnect terminé : OFF révision 11, exactement trois NATIVE, graphes/imports/targets/identités/audits strictement identiques au préflight, trois backups byte/hash/provenance exacts, cosmétiques 0/0, 2/1, 96/5 et deux réparations inchangées, zéro opération/outbound incertain ; Ceo A Auth/Web sans Twitch/B/import intact. Aucun apply/extend/recovery/réparation/canary/commande Twitch exécuté. Logs du nouveau runtime dans la fenêtre bornée depuis 20:46:34 : zéro erreur DB/pool/P1001 et zéro contest-stage lent/erreur ; seul health HTTP observé à ce contrôle, donc aucune corrélation authentifiée Concours ni preuve de validation métier.

**Validation humaine Kichnifou ACQUISE, 07/10/2026 :** le propriétaire répond « Tout passe, Concours affiche son vrai état » au test demandé sur le standalone public : Ctrl+F5, chargement complet, ouverture Concours et déconnexion/reconnexion. Validation rapportée par le propriétaire, distincte du contrôle visuel local Codex ; aucun navigateur public automatisé ni session/JWT fabriqués. Recette sur 0aba64c980e5fde1e74718a263372df0cae5c195 : checkpoint des résultats promu par fast-forward, origin/main=origin/review/divergence 0/0, Railway a1eab24a SUCCESS/Online à 20:52:27 UTC, Cloudflare 7fa047e5 SUCCESS du même SHA et JS/CSS production identiques au build exact. Health 200, historique public 200/2 résultats, Prisma-final 62 à jour et flag false ; preserve READ ONLY OFF11/trois NATIVE/Ceo A intact/disconnect terminé, zéro transaction longue/incomplète/verrou bloquant.

**Corrélation technique de cette recette :** fenêtres HTTP/runtime 20:54:30–20:56:43 UTC découpées en cinq lectures bornées sans cap ni erreur outil ; trois clusters de GET /api/v1/me 200 à 20:54:32, 20:55:07 et 20:55:41 avec lectures essentielles 200 ; 23 GET /api/v1/contest tous 200 en 82–144 ms. Zéro erreur HTTP/DB/pool/P1001 et zéro contest-stage WAITING/ERROR observé dans ces fenêtres. L’attribution à Kichnifou vient du test explicitement rapporté par le propriétaire, pas d’un displayName ou de la seule identité d’un log proxy. Le blocage global du standalone est levé et Concours fonctionne à cette recette ; la cause SQL historique exacte reste inconnue. Les traces restent disponibles pour toute récidive : nommer l’étape réellement attendue et traiter une correction ciblée ultérieure, sans déclaration artificielle de cause résolue.

**Clôture P0 / prochaine étape :** publier ces seules preuves documentaires sur review puis fast-forward main et contrôler les pipelines du SHA de clôture, sans changement produit ni redéploiement manuel. La validation humaine porte sur le code approuvé inchangé, pas sur une nouvelle mécanique. Aucun autre test humain nécessaire au périmètre réalisé. Ceo reste STOP dans cette mission ; aucune préparation/import/OAuth/lien automatique. Une future reprise explicitement consacrée à Ceo suit le parcours canonique A Web authentifié intact, sources/Helix fraîches, B Twitch TWITCH_ONLY séparé, répétition privée/backup/rollback exact, import DATA_IMPORTED/LEGACY/non-canary puis seulement gate humain liaison/comparaison/choix Twitch. Aucun batch/GLOBAL ou replay/réparation/recovery des trois canaries.

**STOP Ceo conservé :** aucun import/OAuth/lien, batch/GLOBAL, replay des trois imports/backups/réparations ou recovery Kichnifou ; Streamer.bot OFF. Autorité commandes OFF11 et flag false conservés. Aucune nouvelle décision Rxxx. Le Master conserve les anciens incidents et distingue code/local/DB, déploiement technique et validation publique Kichnifou acquise, rapportée par le propriétaire.

<a id="p0-promotion-approuvee-20261007"></a>

## Historique — approbation P0 et préflight acquis avant promotion

**Review indépendante ChatGPT approuvée par le propriétaire :** a6dceebe10772a6ad262c07b85e63a2a4f1a7575, aucun finding bloquant. Promotion/déploiements contrôlés autorisés dans cette mission ; aucun nouveau changement produit ni décision Rxxx. Les preuves/tests/limites du [candidat](#p0-bootstrap-contest-candidat-20261007) sont conservés. Le diff réel GitHub des 25 fichiers correspond exactement au commit local ; HEAD/origin review exacts, main/origin main 82d8d145a0507b4321132aebf885bce1221017fa, ancestry stricte 0/4 et worktree/index propres au préflight.

**Préflight actuel, 07/10/2026 20:39–20:42 UTC :** PostgreSQL 62 migrations terminées, zéro migration incomplète, zéro transaction longue/idle-in-transaction/connexion bloquée ; 7 connexions sur max 60. Prisma migrate status canonique Railway PASS, 62 dossiers/migrations à jour, code 0, aucun P1001. Gate READ ONLY canonique PASS, disconnect terminé : OFF11 ; trois NATIVE et graphes/imports/targets/identités/audits strictement inchangés depuis la preuve P0 ; trois backups vérifiés byte/hash et provenance ; cosmétiques 0/0, 2/1, 96/5, deux réparations inchangées, zéro opération/outbound incertain. Ceo A Auth/Web sans Twitch ni B/import reste intact. Flag canonique TWITCH_COMMAND_PILOT_ENABLED=false relu ; aucune réactivation ni configuration changée.

**Railway/Cloudflare avant publication :** Railway Online/une replica, SUCCESS actif du SHA 82d8d14 ; FAILED historique du même SHA, pre-deploy P1001 à 18:22:15 revérifié, aucune opération staged/applying. Aucun nouveau déploiement ni tentative de correction d’infrastructure. Logs runtime bornés sur les cinq dernières minutes : aucune entrée, donc aucune nouvelle erreur observée dans cette seule fenêtre, pas une preuve de bootstrap. Cloudflare Pages check GitHub SUCCESS du SHA 82d8d14, avant ce candidat. La publication main du présent checkpoint déclenchera les pipelines existants ; leurs résultats restent à contrôler sur le SHA exact.

**Prochaine action :** contrôle du diff documentaire publié sur review puis fast-forward strict de main, push/fetch et égalité origin/main=origin/review/divergence 0/0. Vérifier séparément Railway SUCCESS, Cloudflare SUCCESS et livraison frontend, health 200, Prisma/flag OFF et logs. Nouvel échec P1001/pool/pre-deploy/déploiement → STOP sans nouvelle tentative ni reconfiguration expérimentale. Après déploiements vérifiés seulement, demander Ctrl+F5 authentifié Kichnifou, ouverture Concours et déconnexion/reconnexion ; aucune validation humaine anticipée. Les nouvelles traces contest-stage localiseront une éventuelle attente réelle ; elles ne résolvent pas artificiellement la cause SQL historique inconnue. Ceo reste STOP ; trois canaries/backups intacts, Streamer.bot OFF, aucune commande Twitch, import/OAuth/lien Ceo, batch/GLOBAL/replay/réparation/recovery.

<a id="p0-bootstrap-contest-candidat-20261007"></a>

## Historique — candidat P0 testé et contrôlé visuellement ; review indépendante approuvée depuis

**Correctif préparé sur review ; public non rétabli par cette mission.** Le socle authentifié charge sans attendre Concours : cette lecture ne fait plus partie de loadBootstrapGameState ni des conditions de readiness d’AppBootstrap. GameShell reçoit un vrai ContestDto ou null. La surface null affiche Chargement/Concours indisponible et un Réessayer avec le bouton partagé ; aucun thème, résultat, permission ou historique fictif. Après huit secondes, l’affichage devient indisponible ; cette borne est une borne UI, pas une annulation SQL. La requête reste suivie/coalescée jusqu’à règlement, réessai désactivé pendant l’attente, puis activable après erreur. Aucun Promise.race, reset de la réconciliation, nouveau pool produit ou annulation PostgreSQL. Génération/révision protègent données, statut, erreur et timer contre les anciennes sessions ; déconnexion/reconnexion du même compte et changement de compte testés. Pull/Stella confirmés et rafraîchissements Chat ne dépendent plus de la projection secondaire Concours ; mutations Concours et idempotence restent existantes.

**Cause démontrée et limite publique :** le couplage frontend obligatoire transforme une seule lecture suspendue en indisponibilité globale. En DB privée, un verrou contrôlé sur la table Concours suspend exactement reconciliation.candidate ; le code reproduisant l’ancien await de la Promise partagée reste suspendu tandis que quatorze lectures des tables du bootstrap finissent. Le GET corrigé refuse de s’abonner à une réconciliation déjà possédée et retourne CONTEST_TEMPORARILY_UNAVAILABLE/503 sans lancer le DTO. Après rollback du verrou privé, la réconciliation termine, le GET rend le même vrai DTO et aucune opération économique n’est créée. Ce refus utilise la coalescence existante ; aucun changement des transactions, isolation, advisory locks, retries ou scheduler. Il ne prétend pas borner une nouvelle lecture SQL possédée par le premier GET. La cause historique de l’attente du processus Railway ancien et son étape SQL exacte restent non démontrées ; le verrou privé est une injection de panne, pas une preuve d’un verrou public. L’instrumentation candidate observe current.player, réconciliation partagée/nouvelle, candidate/transaction, thème read/create/winner, les six lectures du DTO et ses lectures conditionnelles. Une alerte WAITING après deux secondes par étape, puis fin/erreur ; scope local numérique, durée et code borné, aucune identité, SQL, token, DTO ou message d’erreur brut. Elle n’a pas encore tourné sur le public.

**Validation exécutée :** suite DB Concours complète 26/26 (203 s), puis reproduction ciblée avec l’ancien await 1/1. Fixtures entièrement privées, catalogues seulement lus sur public ; sockets du pool de test réellement ouverts/fermés comptés, total/idle/waiting à zéro, aucun travail actif/idle-in-transaction restant pour les PIDs concernés. Le helper privé expose ces compteurs et dispose explicitement de son pool externe ; configuration et pool produit inchangés. Premier wrapper DB limité à 180 s trop court : échec exclu des PASS, arbre arrêté, aucune requête active ensuite ; sa propre fixture vide résiduelle a été supprimée avec guards de forme/vacuité, fixture préexistante conservée. Deux assertions de diagnostic privées ont été corrigées (observation du verrou par relation exacte ; sockets clients distingués des PIDs serveur retenus). Des timeouts de tests existants sont survenus en runs complets ; test ChatPanel isolé réussi, aucun correctif produit hors périmètre. Une assertion statique exigeant l’ancien await Concours a été remplacée par les tests comportementaux de Pull/Stella/Chat. Dernier verify:full PASS 8/8 : 1370 frontend / 1978 backend non-DB, builds/typechecks/lint/diff-check. Aucun test local ne vaut recette authentifiée publique.

**État réel, 07/10/2026 vers 20:04–20:07 UTC :** relecture canonique READ ONLY gate/preserve, disconnect terminé : OFF révision 11 ; exactement trois NATIVE Kichni_Test/Mynonyme/Kichnifou, imports/provenances/identités/graphes et trois backups exacts ; cosmétiques 0/0, 2/1, 96/5, deux audits de réparation inchangés ; aucune opération/outbound incertain. Ceo A Auth/Web ACTIVE intact, sans Twitch ni B/import. Flag Railway canonique TWITCH_COMMAND_PILOT_ENABLED=false relu, aucune réactivation. Railway Online, ancienne instance SUCCESS 82d8d14, ancien FAILED hard-off au pre-deploy P1001, aucun changement en attente. Aucun restart/redeploy/configuration/push main réalisé. La dernière vraie recette propriétaire demeure l’échec GET Concours 499/163614 ms avec quatorze autres GET 200 ; ne pas le transformer en succès. Les 62 migrations à jour proviennent du contrôle précédent, aucune migration ajoutée dans ce lot.

**Contrôle visuel Codex exécuté :** Playwright/Chromium local, vrai GameShell avec src/index.css et src/App.css réellement chargés, fixtures synthétiques uniquement, API/Auth publiques désactivées. Seize captures et interactions aux viewports 1920×1080, 1366×768, 2560×1440 et 390×844 : Concours normal sans actif, chargement, erreur, indisponibilité après huit secondes avec requête encore pending, réessai désactivé puis retour au vrai composant Concours après retry. Captures inspectées par Codex : texte/bouton/focus lisibles, aucun recouvrement de cette surface ni overflow horizontal document ; scroll document mobile et panneau commun conservés. Script terminé code 0, zéro pageerror et zéro requête externe ; navigateur fermé après capture. La capture VS Code fournie par le propriétaire confirme séparément le chargement local du shell ; elle ne constitue ni cette matrice Codex ni un bootstrap public authentifié. Les preuves locales restent ignorées sous local-data/p0-contest/captures. Aucun test local ne vaut validation métier de Kichnifou.

**Gate restante / reprise :** instruction propriétaire explicite : publier le candidat testé sur review, puis **STOP pour review indépendante ChatGPT avant toute promotion main**, même après le contrôle visuel local acquis. Main reste 82d8d145a0507b4321132aebf885bce1221017fa ; aucun déploiement produit du candidat ni nouvelle recette authentifiée publique. Après approbation indépendante seulement, suivre la [reprise P0 du runbook](../process/legacy-cutover-runbook.md#p0-standalone-contest-20261007) : diff GitHub/ancestry stricte, contrôle canonique migrations/OFF/flag false, promotion et déploiements exacts contrôlés, Ctrl+F5 authentifié Kichnifou et reconnexion, inspection bornée des nouveaux logs d’étapes. Si l’attente persiste, nommer l’étape réellement observée ; aucun nouveau mécanisme sensible sans tests privés et review indépendante. Ceo STOP, aucun import/lien/OAuth, batch/GLOBAL/replay/réparation/recovery/commande Twitch ; Streamer.bot OFF. Cause racine inconnue, correction et visuel locaux démontrés, disponibilité publique et validation métier restent séparées. Aucune nouvelle décision produit, DDL ou règle économique.

<a id="reprise-controlee-stop-bootstrap-contest-20261007"></a>

## Historique — reprise contrôlée ; STOP bootstrap Concours authentifié, 07/10/2026

**Gate échouée, aucun import Ceo.** Après le checkpoint 2166e1c, trois sondes Prisma bornées/successives avec configuration Railway canonique réussissent (568/561/652 ms environ), chacune avec disconnect terminé ; trois migrate status successifs confirment 62 migrations à jour. Lecture admin pendant la tentative réelle : OFF révision 11, quatorze connexions idle, zéro transaction active/idle-in-transaction/verrou bloquant. PostgreSQL a toujours la même date de démarrage 18:25:17 UTC, max_connections=60 ; aucune nouvelle erreur de pool/P1001 dans les fenêtres runtime bornées. Cela prouve les accès contrôlés actuels, sans clore l’incident applicatif ni établir sa cause historique.

**Bootstrap réellement authentifié ÉCHEC :** aucun navigateur n’est connecté au canal d’automatisation ; le propriétaire a donc testé lui-même son standalone Kichnifou par le parcours normal, sans session/JWT fabriqués ni token exposé, et rapporte le blocage « Connexion aux astres… », capture à l’appui. Corrélation proxy 18:59:00–19:03:16 UTC, sans troncature : à 19:00:04, GET /api/v1/me puis treize autres lectures métier authentifiées retournent 200 ; OPTIONS /api/v1/contest retourne 204, ce qui ne valide pas son GET. À 19:02:48, **GET /api/v1/contest termine 499 après 163 614 ms**. Le bootstrap attend cette lecture dans Promise.all. Le compte et les lectures principales sont accessibles ; la restauration complète reste bloquée sur Concours. Le service attend sa Promise de réconciliation partagée jusqu’à règlement : chemin compatible avec un blocage après incident DB, sans preuve de l’état interne de cette Promise dans le processus actif. Aucune cause racine pool/coalescence/fournisseur déclarée résolue.

**Railway et protection :** l’instance réellement active reste SUCCESS du SHA 82d8d145a0507b4321132aebf885bce1221017fa, une replica Online ; le rouge présenté par le propriétaire appartient au hard-off FAILED de l’historique. Logs de cet échec revérifiés : build réussi, pre-deploy Prisma P1001 à 18:22:15, pas de nouveau runtime hard-off. Aucune opération staged/applying en attente. Configuration canonique lue par railway run --no-local : TWITCH_COMMAND_PILOT_ENABLED=false ; valeur conservée, jamais réactivée. Cette configuration souhaitée ne prouve pas à elle seule le flag du processus de l’ancien déploiement ; OFF persistant 11, relu indépendamment, reste la protection acquise. Aucun redémarrage/redeploy/push main ni changement de configuration effectué dans cette reprise.

**Préservation acquise :** exactement trois NATIVE/canaries, targets/imports/identités et trois backups originaux exacts, deux audits de réparation inchangés ; Kichnifou 96 avatars/5 titres, Mynonyme 2/1, Kichni_Test 0/0. Garde canonique : zéro PENDING/EXECUTING protégé ou réponse SENDING/AMBIGUOUS. Ceo A reste ACTIVE, associé à l’Auth confirmé et à la même WebIdentity immuable, sans Twitch ; aucune target/identité/import Ceo. Aucun rafraîchissement source/Helix, préflight/rehearsal/apply Ceo de cette reprise. Aucun replay/import/recovery/réparation des trois canaries. Helpers/proofs locaux ignorés uniquement ; aucun code produit, DDL ou fixture DB publique. Streamer.bot OFF ; aucune nouvelle commande, GLOBAL/batch interdits.

**STOP demandé lorsque le bootstrap échoue.** Publier ce constat sur review uniquement ; main reste 82d8d14. Prochain travail : diagnostiquer/restaurer le GET Concours du processus actif et réussir un vrai bootstrap authentifié, puis renouveler les sondes DB/runtime. Ne pas attendre une cause historique impossible comme condition autonome : elle peut rester non démontrée après stabilité actuelle réellement prouvée. Tout nouveau mécanisme produit/pool exige tests et review indépendante avant promotion. Seulement si ces gates passent : snapshot 17/17/Helix frais, préflight borné terminé, deux progressions significatives et TWITCH_ONLY B distinct, rehearsal privée/backup/comparaison/rollback exact ; importer B DATA_IMPORTED/LEGACY/non-canary sans toucher A ou les trois NATIVE. Le seul gate humain OAuth/lien vient après import vérifié. Aucun gate humain Ceo proposé aujourd’hui.

<a id="pool-incident-off-canonique-20261007"></a>

## Historique — OFF canonique acquis ; cause pool non démontrée, 07/10/2026

**Protection acquise : OFF révision 11**, par `TwitchNativeAuthority.configure` avec opérateur réel et `expectedRevision=10`, le 07/10 à 18:42:49 UTC. Relecture Prisma puis canal admin indépendante : OFF/11, exactement Kichni_Test, Mynonyme et Kichnifou NATIVE/canary, targets byte-identiques. Zéro PENDING, aucun EXECUTING ou outbound SENDING/AMBIGUOUS protégé ; les RECEIVED passifs sont distingués par le garde canonique. Receipts de commandes récents PROCESSED/RESPONSES/toutes SENT ; aucune nouvelle commande envoyée. Imports DATA_IMPORTED, identités ACTIVE, trois backups originaux byte-exact et deux audits DERIVED_COSMETICS_REPAIRED inchangés. Possessions exactes : Kichnifou 96 avatars/5 titres, Mynonyme 2/1, Kichni_Test 0/0. Le graphe personnel est identique avant/après OFF ; par rapport au checkpoint de réparation, seuls last_app_activity_at/updated_at d’activité et updated_at d’un Player ont évolué. Aucun gain, mélange ou réparation de progression.

**Diagnostic borné, sans reconfiguration :** Railway conserve l’instance SUCCESS du code approuvé `82d8d145a0507b4321132aebf885bce1221017fa`, une replica Online. Le hard-off demandé auparavant a réussi son build puis échoué à 18:22:15 UTC au pre-deploy Prisma P1001 ; aucune nouvelle instance hard-off n’est prouvée. Logs service découpés sous la limite, dédupliqués, de 17:46:47 à 18:38:11 UTC : premier ECHECKOUTTIMEOUT à 18:02:50. Depuis cette première erreur : six lignes ECHECKOUTTIMEOUT pour trois épisodes, quatre épisodes P2039 (dont un timeout de connexion 08006), zéro ligne runtime EAUTHQUERY, un P1001 pre-deploy, onze HTTP 499 et un HTTP 500. La fenêtre de contexte précédente contient cinq 499 et six 500 supplémentaires. L’EAUTHQUERY est prouvé séparément par la tentative locale OFF échouée à 18:19:50, sans le compter comme une ligne Railway. Fenêtre complémentaire 18:38:11–18:49:22 : quatre HTTP 200, zéro 499/500 et aucune nouvelle erreur nommée ; ne pas extrapoler cette fenêtre à une recette complète.

| PREUVE | UTC LE 07/10 |
| --- | --- |
| Premier préflight Ceo READ ONLY, puis timeout externe 180 s | 17:58:39 → 18:01:39 |
| Premier ECHECKOUTTIMEOUT runtime | 18:02:50 |
| Redémarrage backend antérieur, puis application ready | 18:08:11 → 18:08:19 |
| Sonde SQL temporairement rétablie, CANARY/10 | 18:08:41 |
| Second préflight Ceo READ ONLY, puis timeout externe | 18:09:27 → 18:12:27 |
| OFF antérieur échoué EAUTHQUERY | 18:19:50 |
| Hard-off FAILED, stage pre-deploy P1001 | 18:22:15 |
| Démarrage PostgreSQL observé via pg_postmaster_start_time | 18:25:17 |
| Trois sondes Prisma/configuration Railway réelle, clients fermés | 18:41:02, 18:41:19, 18:41:44 |
| Gate exact, OFF canonique, relecture complète, admin OFF/11 | 18:42:26 → 18:46:03 |

PostgreSQL répond de manière répétée : première sonde six sessions idle et un scheduler de fond, aucun active long/idle-in-transaction/verrou bloquant ; limite max_connections=60, trois réservées, rôle postgres sans limite spécifique. Sonde ultérieure : dix sessions observées ; pas de saturation démontrée. PostgreSQL et pg_stat_statements ont redémarré à 18:25:17, sans action de redémarrage DB par Codex dans cette mission ; l’origine de ce redémarrage n’est pas connue. Les statistiques actuelles ne permettent donc pas d’identifier la requête de 125 s observée avant ce redémarrage. Causes d’une fuite, d’une saturation globale, d’une requête SQL particulière ou d’une panne fournisseur **non démontrées** ; P1001 reste une indisponibilité de connexion constatée, sans cause racine attribuée.

**Défaut de helper prouvé, produit inchangé :** chaque préflight crée un seul PrismaClient/un seul pool paresseux, les diagnostics un seul pg.Client ; finally appelle disconnect/end. Helix, snapshot et rapport sont hors transaction ; la capture de graphe et l’évaluation de canonicalisation SQL restent dans une transaction READ ONLY jusqu’à 120 s. Le wrapper spawnSync expirait en tuant seulement Railway et laissait un enfant Node vivant ; deux propres orphelins avaient été arrêtés. Une sonde de diagnostic était aussi simultanée au premier préflight. Reproduction privée sans base publique : enfant détaché et socket encore vivants après l’ancien timeout ; wrapper corrigé tue tout son arbre, zéro orphelin/socket restante, deux ouvertures/deux fermetures. Premier montage sans enfant détaché ne reproduisait pas le défaut ; il n’est pas compté comme PASS. Préflight local instrumenté par étapes et statement_timeout transactionnel de 5 s ; **aucun nouveau préflight Ceo exécuté**, annulation SQL du cas Ceo réel non revendiquée. Les fichiers/proofs restent ignorés. La fermeture de finally seule ne garantit rien si la requête ou la fermeture ne revient pas ; query_timeout du driver pg ne constitue pas une annulation serveur. Le serveur partage un seul pool fermé à onClose ; Concours coalesce sa réconciliation jusqu’à règlement de sa Promise, chemin compatible avec un GET bloqué mais cause publique non prouvée. Ne pas confondre cette observation avec l’ancien incident Kichnifou déjà récupéré.

**Contrôles runtime bornés :** trois lectures publiques successives de /health et /api/v1/contest/history répondent 200 (132–408 ms pour la lecture DB), Prisma migrate status confirme 62 migrations à jour. Aucun nouveau restart, déploiement, changement de variables/pool, SQL métier manuel, fixture DB publique ou kill de backend PostgreSQL. La requête authentifiée /api/v1/contest avait encore produit un 499 à 18:31:45 dans les logs ; le bootstrap authentifié complet n’a pas été retesté, donc aucune clôture de cet incident ni validation publique Ceo annoncée. Le garde persistant OFF est prouvé indépendamment du flag Railway et ne dépend pas du hard-off FAILED.

**STOP Ceo / promotion main.** A Web reste identifié par Auth/WebIdentity immuables, ACTIVE, sans Twitch ; aucune identité/target/import Ceo. Ne réarmer CANARY, ne relancer aucune commande, import/recovery/repair/extend. Ne pas relancer le hard-off ni pousser main : le déploiement déclenché reprendrait le flag false déjà demandé alors que la cause du P1001 et le bootstrap authentifié restent non élucidés. Checkpoint documentaire sur review uniquement, main conserve 82d8d14. Prochaine gate : résoudre ce reliquat DB/runtime sans essai de configuration ; seulement ensuite snapshot 17/17 et Helix frais, préflight borné terminé, TWITCH_ONLY B distinct de A, rehearsal privée et rollback exact, deux progressions significatives ; import B DATA_IMPORTED/LEGACY/non-canary avant tout gate humain OAuth. Tout correctif produit/pool nécessaire va sur review, avec tests et review indépendante avant promotion. GLOBAL/batch interdits ; Streamer.bot OFF.

<a id="point-courant--réparation-cosmétiques-acquise--stop-ceo-pool-postgresql-07102026"></a>

## Historique — réparation cosmétiques acquise ; premier STOP Ceo/pool PostgreSQL, 07/10/2026

Review indépendante ChatGPT approuvée sans finding bloquant ; SHA `82d8d145a0507b4321132aebf885bce1221017fa` promu par fast-forward strict, refs locales/distantes communes et vrai diff GitHub exact. Railway et Cloudflare ont déployé ce SHA SUCCESS, health/frontend 200 et Prisma 62 à jour avant les opérations. OFF normal révision 9, dry-runs frais strictement sans écriture, puis réparateur canonique : Kichnifou +2 avatars (Aloy/Vodyanitsa) et +5 titres ; Mynonyme +0/+1 ; Kichni_Test ALREADY_EXACT +0/+0. Postimage : 96 avatars/5 titres, 2/1 et 0/0 respectivement, aucune possession dérivée manquante ou surnuméraire. Graphe personnel hors cosmétiques, possessions préexistantes, notifications, accès, targets/imports/provenances et trois backups exacts ; deux audits de réparation seulement. Dry-runs postérieurs exacts et trois replays ALREADY_EXACT : zéro écriture, backup ou audit supplémentaire. Reprise canonique des trois mêmes NATIVE/canaries en CANARY révision 10, aucun nouveau transfert. Sonde canonique READ ONLY avec configuration Railway/inspection EventSub réelle : CANARY/CANARY/transportValid=true ; ce contrôle ne constitue pas une lecture HTTP authentifiée du processus déployé.

Après ces preuves, reprise Ceo limitée à un snapshot frais 17/17 byte-exact, couverture sans inconnu et deux résolutions Helix fraîches. Deux préflights publics READ ONLY expirent sans preuve complète : aucun préflight validé ni rehearsal/apply Ceo, aucun OAuth/lien/target/import/NATIVE Ceo. Sa preuve Web authentifiée immuable antérieure reste conservée ; deux progressions significatives ne sont PAS encore vérifiées. Nouveau blocker opérationnel : logs Railway ECHECKOUTTIMEOUT en Session mode, erreurs HTTP 499/500 ; lectures SQL locales/admin expirées. Un redémarrage borné du backend rétablit temporairement la lecture SQL (CANARY révision 10, huit connexions idle, aucune transaction longue à cette sonde), puis nouvelle lecture observe une transaction active de 125 s et le blocage revient. Helpers Ceo propres arrêtés ; aucun backend PostgreSQL tiers annulé ni donnée réparée manuellement. Cause racine NON DÉMONTRÉE, ne pas attribuer cet incident à une corruption cosmétique.

Tentative unique de OFF normal par owner/révision 10 : échec P2039/EAUTHQUERY pendant authentification DB, aucune écriture métier exécutée. Hard-off existant demandé sur Railway (`TWITCH_COMMAND_PILOT_ENABLED=false`), mais son redéploiement échoue au pre-deploy Prisma P1001 ; ancienne instance du SHA approuvé conservée Online/une replica, un warning/échec récent. **Hard-off effectif NON prouvé ; dernière autorité persistante lue CANARY révision 10.** Aucun changement OAuth/EventSub, GLOBAL, batch ou commande Twitch envoyée. Ne pas réactiver ce flag ni annoncer le runtime sain sur la seule base de health 200.

**STOP Ceo et nouvelle commande Twitch.** Rétablir/diagnostiquer PostgreSQL/auth/pool, contrôler frais les opérations/receipts/outbound sans rejouer le recovery terminal Kichnifou, les imports, extend ou réparations cosmétiques. Vérifier le déploiement hard-off, puis OFF normal/état exact des trois canaries et backups avant toute reprise. Rafraîchir snapshot/Helix/préflight Ceo ; A est identifié uniquement par Auth/WebIdentity, B doit être TWITCH_ONLY distinct, DATA_IMPORTED/LEGACY/non-canary, sans rattachement Web ni NATIVE. Rehearsal privée/rollback exact et deux vraies progressions significatives avant le seul gate humain OAuth/comparaison/choix Twitch. Aucun mécanisme sensible nouveau, reconfiguration de pool, achat ou réparation de données implicite autorisé par ce constat. Main reste le code approuvé 82d8d145a0507b4321132aebf885bce1221017fa ; checkpoint de continuité sur review uniquement tant que le blocker est ouvert. Preuves brutes et identifiants restent locaux ignorés.

<a id="point-courant--blocker-cosmétiques-avant-ceo--stop-review-indépendante-07102026"></a>

## Historique — blocker cosmétiques avant Ceo ; review approuvée depuis, 07/10/2026

**Incident et lecture publique :** Kichnifou reste COMPLETE pour liaison, commandes et F5/reconnexion. Avant tout import Ceo, l'audit indépendant puis la lecture PostgreSQL READ ONLY confirment : XP 5 189, 96 personnages 4★/5★, 94 avatars et aucun des cinq titres de niveau attendus ; avatars manquants Aloy/Vodyanitsa. Mynonyme : XP 301, deux avatars cohérents, un titre manquant. Kichni_Test : XP 32, aucun titre attendu, état cohérent. Les trois canaries/imports/backups restent conservés ; contrôle de 25 tables personnelles : singletons présents, neuf ressources, dix Teams et 31 Missions par Player. Aucun autre écart dérivé établi ; [matrice et exclusions](../architecture/legacy-migration-v1.md#cosmétiques-dérivés-et-audit-des-remplacements--candidat-review-07102026).

**Cause et candidat :** le remplacement supprimait toutes les possessions cosmétiques puis ne recréait que les avatars dont la définition existait déjà. L'XP importée ne rejouait pas les seuils de titres, notamment au niveau maximum. L'ancien import pilote présente aussi ce défaut de titres : les deux entrées réutilisent désormais le même owner. Avatar 4★/5★ et titres PLAYER_LEVEL sont reconstruits depuis l'XP/Box réellement persistés, avec définitions manquantes, provenance SILENT_BACKFILL, zéro notification/équipement/gain. Famille inconnue : refus avant suppression, y compris dans le graphe ciblé et la purge privée. Nouveau réparateur local : un Player immuable importé par appel, ensemble de trois canaries NATIVE vérifié, opérateur/OFF/révision/import/backup/idle, plan confirmé et préimage durable ; attribution additive des seuls cosmétiques manquants, audit unique si changement, replay exact sans écriture. Aucune DDL ni modification des migrations 048/059.

**Contrôles :** DB privées fichier par fichier **15 suites / 172/172 PASS**, dont import dérivé **8/8**, réparation **12/12**, ancien pilote **8/8** et rétention historique **32/32**. Extension **46/46 PASS** avec budget de test CLI 60 s : le premier passage avait un timeout 30 s (45/46), le cas isolé passe avec le délai normal (20,35 s), assertions et transactions inchangées ; logs initiaux conservés. Rehearsal Prisma des **62 migrations** et registre public/migrate status à jour, aucun nouveau DDL. verify:full **8/8 PASS**, frontend **1361/1361**, backend non-DB **1975/1975**, builds/typechecks/lint/diff-check PASS ; 35 avertissements lint sur des fichiers hors périmètre, aucune erreur. Les deux timeouts initiaux non-DB passent isolément puis dans le full final ; aucune cause historique inventée. Lecture publique finale strictement inchangée sur autorité, trois targets/imports, XP/Box/cosmétiques et trois backups byte-exact ; zéro audit de réparation publique. Inventaire de schémas privés revenu exactement à la baseline, schéma préexistant conservé. Ceo identifié uniquement en lecture, sans Twitch/import. Les échecs initiaux restent consignés dans les preuves privées, sans les requalifier en succès. Tests mutatifs exclusivement dans leurs schémas privés ; aucune réparation ni écriture gameplay publique.

**Ceo et prochaine gate :** propriétaire confirme sa connexion avec le vrai compte Web et l'absence de liaison Twitch. Identification standalone Ceo terminée en READ ONLY : compte Web confirmé par le propriétaire, ID Auth immuable/session canonique non expirée, WebIdentity exacte et présence applicative authentifiée sur le même Player ACTIVE. Zéro identité Twitch/target/import sur ce Player ; aucun rapprochement par displayName ni session/JWT fabriqués. Identifiants et preuve restent locaux ignorés. Pas d'import, OAuth/lien, préparation Twitch-only ou extension Ceo. Publication dédiée sur review, vrai diff GitHub, puis **STOP review indépendante ChatGPT**. Main reste `dae85464c0cf1ef827681f448b942b1acd0ca4ea`. La réparation publique n'est pas exécutée avant cette review ; promotion/déploiement, OFF normal, dry-run frais/réparation bornée et preuves exactes appartiennent à la mission suivante. Le parcours à deux progressions Ceo reste ensuite obligatoire. GLOBAL/batch interdits, Streamer.bot OFF ; identités et preuves brutes locales ignorées.

<a id="point-courant--recovery-kichnifou-terminal--smoke-en-attente-07102026"></a>

## Historique — Kichnifou COMPLETE ; ancien gate identité Web Ceo, 07/10/2026

**Kichnifou COMPLETE, recovery terminal :** review indépendante de `cf43ddf52e061314c2e8330e9390f39a048b1016` approuvée, promotion par fast-forward strict et déploiements Railway/Cloudflare du SHA exact SUCCESS ; une replica Online, aucun warning/critical/pending, health 200, Prisma 62 à jour. Autorité **CANARY révision 8**, exactement **Kichni_Test, Mynonyme, Kichnifou NATIVE/canary** ; imports, accès et trois backups préservés. Streamer.bot OFF, GLOBAL et batch interdits.

**Ancien pity terminal — ne jamais rejouer le recovery :** préflight frais READ ONLY, puis CLI canonique via `railway run --no-local` avec les variables existantes injectées en mémoire, sans copie de secret ni modification Railway/OAuth/EventSub. Dry-run **PASS / strict zéro écriture** sur receipt/audits/graphe complet/autorité/targets/imports/backups. Un seul apply du recovery : même receipt, externalEventId, receivedAt, commandKey et businessAt ; intent pity read-only, un audit EXECUTING_PITY_RECOVERY_PREPARED, **PROCESSED / RESPONSES / exactement une SENT** et processedAt renseigné. Réponse comparée au Gacha PostgreSQL actuel. Zéro BusinessOperation de pity, PENDING incompatible ou SENDING/AMBIGUOUS ; graphe personnel complet exact, dont ressources/XP/Gacha/Banque/Box/Teams/Quotis/historiques et totalMessages, observation d'origine non rejouée. Aucun réimport/extend/rollback Kichnifou ni nouvelle commande Twitch humaine.

**Runtime et limites :** Railway Online et health/standalone publics 200 ; fenêtre contrôlée sans erreur EventSub 499/500 ni erreur runtime, aucun verrou bloquant ou transaction client longue observé. Lecture canonique Concours sur les vraies données en READ ONLY terminée ; aucune session Web du propriétaire fabriquée. F5 et déconnexion/reconnexion sont désormais confirmés par le propriétaire ; WebIdentity/TwitchIdentity conservent le même Player importé ACTIVE. **Contention de pool reproduite et corrigée ; cause exacte de l'incident public historique non démontrée.** L'observation actuelle ne prétend pas reconstituer l'état ancien du pool.

**Recette propriétaire acquise :** réponse « Validé ». Cinq nouveaux messages Twitch distincts contrôlés : trois pity, un quotis et un box ; tous **PROCESSED / RESPONSES / toutes SENT**, commandes/IDs de message/commandKeys uniques, zéro double traitement. Les trois handlers attendus sont présents ; les répétitions pity sont des messages distincts, pas des redeliveries doubles. Même Player Web/Twitch ACTIVE, F5 et déconnexion/reconnexion confirmés ; aucun EXECUTING ou outbound PENDING/SENDING/AMBIGUOUS, aucune opération engagée incompatible. Les fenêtres HTTP exactes non tronquées autour des commandes ne montrent que des EventSub 204, aucun 499/500 ; bootstrap Concours 200 observé. Imports/provenances et trois backups exacts, ancien receipt récupéré inchangé/terminal. **Kichnifou COMPLETE : ne plus toucher son import.**

**Prochaine action exacte : STOP humain identité Web Ceo** — « Connecte-toi au standalone avec Ceo, sans lier Twitch, puis réponds “fait”. » Aucun Player Ceo n'est sélectionné : établir d'abord la véritable WebIdentity/session authentifiée et l'ID immuable, jamais le displayName. Préimage d'observation privée en lecture seule capturée avant ce gate ; aucun import, liaison OAuth ou NATIVE Ceo effectué. Après preuve exacte seulement : Player A standalone, import legacy distinct Player B TWITCH_ONLY/DATA_IMPORTED/LEGACY/non-canary, deux progressions significatives, gate OAuth/comparaison obligatoire/choix Twitch, contrôles R1055, OFF normal puis extension multi-canary. Aucun rapprochement par pseudo ni fusion additive. Streamer.bot OFF, GLOBAL/batch interdits ; toutes les preuves brutes restent locales ignorées.

<a id="point-courant--incident-kichnifou--stop-ceo-07102026"></a>

## Historique — incident et candidat Kichnifou avant promotion, 07/10/2026

Les mentions « candidat », « review uniquement » et « receipt bloqué » ci-dessous décrivent les checkpoints antérieurs ; elles sont supplantées par le point courant.

**État acquis avant incident :** la review indépendante propriétaire de `60f0c5f4c7929ee001eba942de0e98c3616befb0` a été approuvée, puis le candidat a été promu par fast-forward strict. Main/review locales et distantes communes à ce SHA, divergence 0/0 ; Railway et Cloudflare du SHA exact réussis, health 200, 62 migrations Prisma à jour. Le point de rétention historique ci-dessous est désormais un historique de cette livraison, et non une gate de promotion encore ouverte.

**Population réelle :** exactement **Kichni_Test, Mynonyme et Kichnifou NATIVE/canary**, CANARY **révision 8**. Mynonyme : import `EXISTING_VERIFIED_TWITCH` sur le même Player Web/Twitch, compare et rollback privé exacts ; les trois receipts `pity`/`quotis`/`box` sont `PROCESSED`/`RESPONSES`/`SENT`, F5 et déconnexion/reconnexion confirmés par le propriétaire. Kichnifou : même mapping et même Player Web/Twitch opérateur ACTIVE/ADMIN ; rehearsal privée sur les 62 migrations, backup v2 durable, apply/compare et extension existants exécutés une seule fois. Les 1 150 opérations retenues, 1 176 références historiques et 63 mouvements d'autres Players ont été vérifiés exacts lors de cette préparation. Ceo n'a été ni préparé, ni importé, ni lié dans cette mission.

**Défaut public initial confirmé :** Kichnifou ne recevait pas de réponse à `!pity` et son standalone restait sur « Connexion aux astres… » après Ctrl+F5. Le receipt reste `RECEIVED`, `commandPilot.stage=EXECUTING`, handler `pity`, sans intention enregistrée ni réponse. Les redeliveries EventSub observées donnent 499/500. Les autres lectures principales de bootstrap répondaient 200 ; deux `GET /api/v1/contest` ont expiré après environ **300 000 ms**. La validation Twitch Kichnifou n'est donc pas acquise ; aucun état final de quatre canaries ou de clôture ne peut être annoncé.

**Rétablissement standalone confirmé :** après le redémarrage et un Ctrl+F5, le propriétaire confirme « ça s'ouvre maintenant ». Railway montre le **07/10 à 13:07:18 UTC** le `GET /api/v1/contest` terminé en **200 / 162 ms** ; les autres lectures du bootstrap répondent également 200 et les requêtes de session/presence suivent. Cette preuve valide l'ouverture après rafraîchissement ; elle ne valide ni une nouvelle déconnexion/reconnexion, ni Twitch, ni la cause interne initiale. Le contrôle PostgreSQL frais confirme encore CANARY révision 8, trois NATIVE/canaries, zéro opération métier Twitch PENDING et le receipt `pity` inchangé, sans intent ni réponse. Aucune commande Twitch n'a été envoyée par Codex.

**Diagnostic exécuté :** probes publiques strictement READ ONLY : lectures gacha/concours terminées, vue canonique `ContestService.getCurrent` sur les vraies données en **603 ms**, préparation canonique `pity` en **115 ms**, sans commande envoyée ni exécution métier publique. Aucun concours actif ni verrou PostgreSQL en attente observé. L'instance répond au healthcheck et à l'historique concours ; CPU/mémoire sans saturation observée. Une attente dans le runtime ou ses connexions reste une hypothèse, pas une cause démontrée. Le log EventSub est volontairement `silent` : l'absence de stack runtime n'exclut pas une erreur du handler. La reprise opérateur existante ne reprend que le stade `RESPONSES` ; elle refuse ce stade `EXECUTING`.

**Opération bornée exécutée :** après contrôle de zéro opération métier Twitch `PENDING` et zéro outbound `SENDING`/`AMBIGUOUS`, redémarrage normal du seul backend Railway existant, sans rebuild, changement de SHA, variables, OAuth ou EventSub. `Application ready` et health 200 constatés. L'audit READ ONLY après redémarrage confirme autorité/targets exactes, trois Players ACTIVE partageant chacun leurs accès Web/Twitch, import/provenance Kichnifou identiques, receipt inchangé et les **trois backups originaux identiques en taille/SHA-256**. Aucun replay, retry, réimport, extension, rollback, réparation de données ou nouveau message Twitch n'a été exécuté. Les fixtures privées de cette intervention sont nettoyées ; le schéma privé préexistant reste préservé.

**Contrôles de l'incident :** six fichiers runtime non-DB, **129/129 PASS**. Première passe DB privée concours + pilote Twitch : **35 PASS / 8 FAIL sur 43**, les huit échecs concours étant des expirations/attentes de transactions ou timeouts ; la suite pilote Twitch passe. Premier échec concours rejoué seul : **1 PASS / 24 exclus**. Rejeu concours complet avec traces locales du driver, sans SQL/valeurs/identités dans la trace : **25/25 PASS**, aucune requête/acquisition pool supérieure à une seconde. Ces rejeux ne suppriment pas les huit échecs initiaux ni ne les qualifient automatiquement de flaky. `prisma migrate status` : **62 à jour**. Aucun correctif produit n'a été validé ou promu dans cet incident.

**Preuve fraîche du receipt et des effets :** lecture publique strictement READ ONLY du receipt exact : RECEIVED/EXECUTING, `pity`, args `[]`, Player/clé/businessAt persistés, sans intent ni réponse ; égalité complète avec la préimage de l'incident. **Zéro BusinessOperation portant cette clé exacte ou son suffixe, tous Players/canaux/status confondus.** Comparaison au graphe sauvegardé après import : Gacha, ressources, personnages, Banque, Quotis et mouvements **exacts** ; XP et countedMessages inchangés. Seuls totalMessages (+1) et updatedAt de Progression diffèrent, conformément à l'observation du message. Le parcours canonique pity ne contient que les lectures Gacha/acteur et le feedback de missions en lecture : aucun effet explicite de commande engagé. Son observation séparée `twitch.message`/`twitch.message.complete` est COMPLETED, normal=false, zéro XP/réponse ; elle compte le message et son activité selon le contrat existant, et ne doit pas être rejouée par la récupération.

**Défaut de concurrence démontré en privé, cause historique non démontrée :** dernier checkpoint durable public = réservation EXECUTING ; prochain checkpoint absent = intent. Cet état seul ne distingue pas une attente avant/dans prepare, une exception ou un rollback de sa sauvegarde. `prepare` et `execute` attendaient les services Prisma racines pendant qu'une transaction gardait la connexion et le verrou du receipt ; la revalidation d'autorité sous ce verrou reprenait également une connexion racine. Test RED avec pool de trois, trois receipts existants EXECUTING/no-intent/no-response/no-operation, reprises et vraies lectures bootstrap Gacha/Concours : trois reprises rejetées ; reprise isolée après interruption PASS. Le candidat sort préparation/exécution des transactions du receipt, conserve la première intent committée et le résultat par comparaison atomique, et lit l'autorité sur la même transaction lors des sauvegardes/envois. Le plan messageActivity suit cette même frontière. Coalescence par receipt dans l'instance ; entre instances/restarts, les owners conservent l'idempotence métier et l'envoi garde SENDING avant HTTP, sans promesse exactly-once réseau. Aucun changement de taille de pool, timeout, schéma, scheduler, OAuth ou variables. Le pool historique Railway n'a pas été capturé saturé : ce test ne prouve pas la cause du blocage public initial ; le restart a rétabli le Web, sans constituer un correctif.

**Nouveau mécanisme sensible candidat, LOCAL-ONLY :** `recoverExecutingPity` et CLI `twitch:recover-executing-pity`, dry-run par défaut. Opérateur ACTIVE/ADMIN allowlisté et lié vérifié ; Player/TwitchIdentity/cible NATIVE/canary exacts, transport valide, CANARY et révision exactes, receipt/key/businessAt/args exacts, RECEIVED/EXECUTING/no-intent/no-response. Zéro opération engagée par la clé/suffixe (même COMPLETED/FAILED ou autre canal), zéro PENDING pertinent et zéro SENDING/AMBIGUOUS sur les canaries. **Seul `pity` sans arguments est admis** ; mutation avant intent, mutation déjà engagée, intent présente, RESPONSES ou état inconnu refusent, sans reconstruire une cible/quantité/jour. Le vrai prepare/execute conserve clé/date, et seuls les reads Gacha/acteur sans mutation/cible sont admis ; audit existant et intent committés atomiquement, réponses/envoi par le pipeline canonique. Aucun faux EventSub/HMAC, SQL de réparation, nouvel ID/date de réservation, route HTTP ou outil générique de mutation. Après interruption post-intent, ce CLI refuse : utiliser seulement une vraie redelivery ou la reprise response-only si RESPONSES est réellement atteint ; sinon STOP, pas de boucle de replay.

**Validations du candidat :** RED initial **1 PASS / 1 FAIL** (trois reprises concurrentes rejetées), GREEN **2/2** après déplacement des lectures hors verrou. Suite dédiée finale **38/38 PASS**, incluant refus des mutants avant intent/BO terminal/PENDING, mauvais Player/identité/autorité, intent/RESPONSES/outbound incertain, une seule récupération locale gagnante entre deux instances, et un vrai Pull concurrent récupéré sans second spend/récompense. Son cas enrichi avec les vrais owners messageActivity COMPLETED et totalMessages +1 est rejoué : **1 PASS / 37 exclus**, aucun compteur/XP/claim rejoué. Dix suites DB privées de non-régression, fichier par fichier : **179/179 PASS** (pilote 18, webhook 9, executor/intents/messageActivity 9, inflight 11, extension 46, fondations 25, reprise canary 22, transfert 13, unlink 1, Concours 25). **verify:full 8/8 PASS** : backend non-DB **1 958/1 958**, frontend **1 361/1 361**, builds/typechecks/diff-check ; typecheck après enrichissement de fixture PASS, lint 35 warnings sur les sources frontend inchangées. Prisma **62 à jour**, aucun DDL candidat.

**Échecs conservés et limites de preuve :** première suite opérateur **34 PASS / 3 FAIL**, corrigés par comparaison d'objets indépendante de l'ordre des clés JSON PostgreSQL et correction de la fixture SourceChannel ; passe suivante **36 PASS / 2 FAIL par timeout**. Les deux cas passent isolément (**2 PASS / 36 exclus**) puis la suite entière **38/38** avec traces locales du driver sans SQL/valeurs/identités. Aucune acquisition pool >250 ms dans cette dernière trace ; collision SERIALIZABLE reprise par l'owner Pull existant. La cause des deux timeouts intermédiaires n'est pas établie : ils ne sont ni effacés ni qualifiés automatiquement de flaky. Les huit échecs Concours du diagnostic initial restent également consignés ci-dessus. Les logs/proofs bruts restent locaux ignorés ; aucun test automatique ne valide Twitch publiquement.

**Conservation publique finale READ ONLY :** autorité/révision, trois targets NATIVE/canaries, accès Web/Twitch, imports et receipt **exacts** par rapport au début de cette mission ; trois backups byte-for-byte en taille/hash, zéro BO PENDING/outbound SENDING/AMBIGUOUS. Streamer.bot processus OFF ; aucune récupération/commande Twitch, écriture métier publique, apply/extend/rollback ou modification d'OAuth/env. Schémas privés des tests nettoyés, schéma préexistant préservé. Contrôle de confidentialité du candidat sur les valeurs privées de preuve ; pas de nouvelle décision produit, ni modification du contrat de migration/gameplay, de roadmap ou des autres propriétaires.

**Reprise et gate actuelle :** publication **review uniquement**, puis **review indépendante ChatGPT du vrai commit/diff** de ce nouveau mécanisme. Main reste `60f0c5f4c7929ee001eba942de0e98c3616befb0` ; aucun déploiement ni récupération publique dans cette mission. Après approbation : promotion/déploiement du même candidat, préflight frais du receipt exact, dry-run puis récupération explicitement autorisée ; vérifier PROCESSED/RESPONSES/SENT une fois avant d'autoriser le smoke Kichnifou. **STOP Ceo tant que Kichnifou n'est pas complètement validé.** Trois imports/backups/identités préservés, aucun apply/extend/rollback, GLOBAL interdit, Streamer.bot OFF. Les preuves brutes et identités restent locales ignorées.

<a id="point-courant--candidat-rétention-historique--stop-review-indépendante-07102026"></a>

## Historique — candidat rétention historique ; STOP review indépendante, 07/10/2026

**Base et périmètre :** au départ, fetch, main/review locales/distantes propres et communes à `fcbca95fd9d14f7484e1fb9c0ddb182d52ac21a4`, divergence 0/0. Cette mission est un nouveau mécanisme sensible : publication sur review uniquement, puis review indépendante obligatoire ; aucun fast-forward main ni déploiement anticipé. Aucun import Mynonyme, changement d’autorité OFF, extension, Kichnifou, Ceo ou batch public. Kichni_Test reste seule NATIVE/canary ; CANARY révision 4, Streamer.bot OFF, GLOBAL interdit.

**Cause et contrat candidat :** l’ancien garde bloque correctement la suppression de toutes les BusinessOperation du standalone lorsque dix FK conservées les référencent. Inventaire PostgreSQL READ ONLY : **30 FK classifiées explicitement, 12 personnelles remplacées / 18 conservées ; 126 références historiques nécessitent 125 parents distincts, tous COMPLETED**. `planTargetedRetention` calcule un plan déterministe avant la première écriture ; seuls les parents réellement nécessaires, appartenant au Player ciblé et COMPLETED/FAILED sont retenus byte-for-byte. FK ajoutée/manquante/dupliquée, table/colonne inconnue ou référence interschéma → fail closed, même sans ligne ; PENDING/non terminal → blocker. Toute autre référence hors graphe continue à bloquer. Le chemin sans plan de rétention conserve son garde strict.

**Périmètre des lignes :** le graphe descendant ne capture plus les lignes personnelles d’un autre Player via une opération du Player ciblé. Neuf mouvements de ressources d’autres joueurs, liés à trades.accept/friendship.heart, sont présents dans la preuve réelle : ils restent exacts uniquement parce que leur parent est déjà explicitement retenu pour un fait conservé connu. Ils ne peuvent jamais créer une rétention à eux seuls. Les effets personnels anciens du Player ciblé sont supprimés/remplacés ; ressources, XP, Gacha, Banque, Box, Teams, Missions, Wheel/Daily et autres domaines restent exactement legacy, sans synthèse d’opération/mouvement/historique et sans addition.

**Backup, rollback et replay :** nouveau backup canary strict version 2 avec préimage complet et plan de rétention hashé ; le format version 1 reste lisible et garde sa restauration stricte. Un parent retenu doit encore être exactement identique au backup : absence/modification → refus transactionnel, aucun INSERT en conflit ni réparation silencieuse. Références conservées ou DDL devenus différents → refus ; rollback final exige le hash exact du préimage. Le backup réel Kichni_Test v1 a été relu et ses deux hashes contrôlés, sans rollback public. Un test réel du service Chat a révélé un double gain quotidien possible sur replay historique le jour de l’import avec élément inchangé : le candidat consigne les IDs retenus dans la provenance du batch v2, liée au run, au backupHash et au DATA_IMPORTED terminé. Le replay exact de ces opérations restitue le résultat historique sans rejouer la récompense secondaire ; une nouvelle clé fonctionne normalement. Aucun classement par date ni modification de la clé/status/resultSummary historique. Une ancienne commande Chat retenue restitue sa réponse déjà publiée ; si cette réponse manque après remplacement de son opération personnelle, le replay est refusé sans mutation (`CHAT_HISTORICAL_REPLAY_REQUIRES_NEW_KEY`). Le propriétaire envoie alors une nouvelle commande avec une nouvelle clé. La récupération normale des commandes sans import reste inchangée.

**Contrôles exécutés :** suite PostgreSQL dédiée **32/32 PASS**, 13 suites DB de non-régression **248/248 PASS** (canary/rollback, opérations en vol, protections migration, canonicalization safety, liaison/récupération Twitch, transfert/extension canary, fondations, Quotis, Chat/Codes), puis **6/6** cas Chat ciblés après le dernier garde de replay. Rehearsal global privé synthétique **ISOLATED_FIXTURE PASS** : rollback transactionnel, backup/restauration exacts et second import idempotent ; aucune certification de population réelle ni autorité GLOBAL. Les fixtures incomplètes ont été refusées au préflight/application (Concours/Bannière, chemins source et statut Giveaway), puis complétées selon le format existant sans changer les gardes. verify:full **8/8 PASS**, frontend **1 361/1 361**, backend non-DB **1 936/1 936**, builds/typechecks/diff-check PASS ; lint 35 warnings identiques aux sources/règles préexistantes. Le double gain quotidien et la réexécution Banque sans réponse historique ont été reproduits en RED puis corrigés et contrôlés en GREEN.

**Reproduction Mynonyme privée :** copie du vrai graphe établie avec les **62 migrations versionnées**, préimage identique vérifié avant apply, mapping **EXISTING_VERIFIED_TWITCH**, blockers **[]**. Sur 255 parents initiaux, **125 retenus exactement / 130 remplacés** ; **126 références historiques et neuf mouvements personnels d’autres Players intacts**. Rehearsal et compare **PASS**, identités Web/Auth/Twitch et rôles/privacy préservés ; rollback **EXACT_PREIMAGE**, aucune duplication ni fusion gameplay. Les préparations de copie par schema diff et avec UUID aléatoires de seeds ont été refusées avant apply ; la fixture finale copie les UUID exacts après retrait des seuls seeds d’un schéma privé neuf sans Player, sans modifier les FK. Backups/proofs locaux ignorés, schémas de test nettoyés.

**Contrôle public final READ ONLY :** Mynonyme toujours **non importé**, gameplay et identités inchangés, zéro target/import, 126 références exactes ; Kichni_Test et son ancien Player Web ARCHIVED intacts. Autorité **CANARY révision 4**, **une seule canary NATIVE**, zéro opération en vol/outbound incertain ; Streamer.bot OFF, sources 17/17 toujours exactes, aucune écriture source. Prisma : **62 migrations versionnées/appliquées, migrate status à jour**. Aucune écriture métier publique, OFF, extension, Kichnifou/Ceo ou batch.

**Publication et reprise :** lot limité à **13 fichiers**, aucun ID Twitch/Player/opération, payload ou secret privé dans le diff ; contrôle de confidentialité sur 5 244 valeurs privées PASS. Candidat destiné exclusivement à review ; main reste `fcbca95fd9d14f7484e1fb9c0ddb182d52ac21a4`. Le bilan final porte le contrôle du SHA distant et du vrai diff GitHub après push, sans anticiper une review indépendante ou un déploiement. Voir le [contrat de rétention](../architecture/legacy-migration-v1.md#rétention-historique-ciblée--candidat-review-du-07102026) et le [runbook](../process/legacy-cutover-runbook.md). **STOP review indépendante avant toute promotion ou migration publique.**

## Historique — STOP préflight Mynonyme ; références aux opérations conservées, 07/10/2026

**Publication et déploiements acquis :** petit texte exact « quelle que soit » et correction documentaire du parcours Ceo publiés à `d66a4f568a8360b16cc45c0ddfa281b74c2b560e`, main/review locales/distantes communs, divergence 0/0 et dépôt propre après push/fetch. Diff GitHub réellement téléchargé et égal au diff du commit, 7 fichiers. Tests UI ciblés 140/140 PASS, build/typecheck frontend PASS, lint PASS/34 warnings aux mêmes sources/règles que la baseline. Railway du SHA exact SUCCESS/Online/une replica/zéro warning/critical/pending ; Cloudflare check du même SHA completed/success, page/bundle 200 avec le texte exact ; health 200/status ok, Prisma 62 à jour. Aucun mécanisme identité/import/autorité modifié. Vérification visuelle GameShell non exécutée, navigateur de contrôle indisponible. Ce checkpoint d’arrêt est documentaire seulement, promu selon la même méthode bornée ; ses déploiements exacts restent à contrôler après push, jamais anticipés.

**Capture et identité :** nouvelle capture dans le dossier local ignoré `controlled-canaries-2026-10-07`, sources figées et processus Streamer.bot zéro. Les 17 JSON/manifest/hashes source-copie sont vérifiés ; archive adjacente package.zip laissée intacte, hors sources JSON. Coverage 29 918/29 918, unknown=0, hash `d3ee8d88…` identique au contenu antérieur car sources toujours figées ; nouvelle preuve de fenêtre, distincte de l’ancien dossier Kichni_Test et du futur GLOBAL. Helix frais ciblé par ID OAuth immuable, cohérent avec les preuves historiques ; un utilisateur vérifié, zéro manque/conflit/doublon. Plan public RepeatableRead explicitement READ ONLY : same expected Player, EXISTING_VERIFIED_TWITCH, 15 domaines personnels mappés, shared facts legacy différés 0 et un blocker réel.

**Diagnostic exact du blocker :** `personalReplacementTables` inclut `business_operations`. Le garde FK `assertTargetedDeletionSafe` refuse de supprimer leurs parents lorsqu’une référence conservée est hors du graphe personnel remplaçable. Dix FK/126 références : admin_audit_entries 10, arcade_receipts 16, arcade_sessions.finish_operation_id 1, boss_attacks 2, contest_rewards 1, direct_messages 11, friend_hearts 3, gift_code_claims 1, global_chat_messages 78, trade_executions 3 ; toutes vers business_operations.id. Il ne s’agit pas de 126 opérations distinctes ni d’un défaut de résolution Twitch. Retirer ces références ou ignorer le garde détruirait l’intégrité du contrat. Aucune suppression de relation, SQL métier, import, backup CLI d’apply, DATA_IMPORTED, extension, changement d’autorité ou schéma privé créé. Rehearsal non exécutée puisque le préflight public est bloqué ; ne pas demander le gate OFF/smoke.

**Conservation après diagnostic et prochaine action :** nouvelle lecture publique READ ONLY contre la préimage : Mynonyme même Player/WebIdentity/Auth/TwitchIdentity, gameplay personnel et références directes partagées exacts (XP 52/messages 78), zéro target/import/comparaison. Seules sessions/activité technique et identité Twitch diffèrent de l’avant-OAuth. Kichni_Test et l’ancien Web archivé exacts sur les 55 tables capturées, targets/imports/contrôle inchangés ; une canary/CANARY révision 4, aucune BusinessOperation TWITCH PENDING ni réponse PENDING/SENDING/AMBIGUOUS sur les IDs concernés. Inventaire de schémas privés inchangé. Preuves ignorées `linked.json`, `preflight.json`, `blocked-final.json`, `blocked-idle.json`, rapport Helix local ; aucun ID privé dans Git. **STOP migration** : le mécanisme actuel n’autorise pas ce remplacement tout en conservant ces références. Une évolution canonique de conservation/restauration des historiques liés doit être cadrée, implémentée/testée sur review puis approuvée indépendamment avant toute promotion/import ; aucun contournement SQL ni allègement silencieux du garde. Ensuite seulement reprendre Mynonyme → Kichnifou → Ceo corrigé → rehearsal finale/batch, avec leurs gates ; aucune étape future présumée exécutée. Streamer.bot reste OFF et GLOBAL interdit.

## Historique — Mynonyme lié ; préflight puis trois canaries contrôlées, 07/10/2026

**Base et conservation :** fetch, refs main/review locales/distantes `62eee0f8823fa43dd400ea22f2d052f53a86da82`, divergence 0/0 et dépôt propre. Le double-clic OAuth est promu/déployé, Railway/Cloudflare SHA exacts, Online/une replica/zéro warning/critical/pending, health 200, Prisma 62 à jour. Le propriétaire confirme la liaison Mynonyme. Contrôle frais RepeatableRead explicitement READ ONLY contre la préimage avant OAuth : même Player ACTIVE/PYRO, même WebIdentity/Auth, une vraie TwitchIdentity unique, XP 52/messages 78 et gameplay personnel strictement inchangés, relations conservées parmi les 106 tables FK directes capturées ; seules identité Twitch, sessions et activité technique changent. Aucune comparaison, seconde identité/Player Twitch, target ou import. Kichni_Test et son ancien Web archivé identiques sur les 55 tables capturées ; targets/imports et contrôle CANARY révision 4 identiques. Preuves privées ignorées, aucun ID dans Git.

**Petit correctif de texte :** succès OAuth connecté/récupéré et succès après comparaison utilisent exactement « Compte Twitch lié. Tu peux maintenant jouer ici ou sur Twitch, ta progression sera conservée quelle que soit la plateforme ! ». Tests ciblés Compte/Bootstrap/API **140/140 PASS**, y compris callbacks et les deux choix définitifs ; build/typecheck et lint frontend PASS (34 avertissements aux mêmes sources/règles que la baseline, aucune erreur). Vérification visuelle GameShell non exécutée, navigateur de contrôle indisponible. Aucun changement de mécanisme d’identité/import/autorité, backend ou DDL. Review → vrai diff GitHub → fast-forward strict main → déploiements exacts dans cette même mission, selon le workflow borné ; leurs preuves ne sont pas anticipées ici.

**Prochaine étape exacte :** après déploiements du texte, snapshot frais 17/17/manifest/hash/unknown=0 des JSON figés, réutilisable dans la même fenêtre pour les trois comptes tant que les sources et Streamer.bot OFF restent vérifiés ; jamais automatiquement le snapshot GLOBAL. Mynonyme : Helix frais de son ID OAuth, expected Player original et EXISTING_VERIFIED_TWITCH obligatoire ; plan sans blocker, FK/relations, rehearsal privée représentative/backup/apply/comparaison/rollback exact sans résidu. Nouveau mécanisme sensible ou invariant bloquant → STOP, aucune SQL de contournement. OFF par le chemin normal, backup durable fsync avant apply public, même Player/identités/rôles/privacy/préférences hors gameplay/relations, remplacement personnel exact sans fusion ; DATA_IMPORTED/LEGACY/non-canary, puis extension existante à deux canaries et transport effectif valide. Smoke propriétaire !pity / !quotis / !box et F5 standalone, receipts PROCESSED/RESPONSES/SENT sur le même Player. Kichnifou suit ensuite sur son Player déjà lié, en conservant son rôle opérateur/ADMIN, extension à trois puis même smoke. Relire les préconditions avant chaque mutation, préserver intégralement Kichni_Test.

**Ceo — correction propriétaire prioritaire :** le [parcours canonique de validation R1055](../specifications/decisions-log.md#r1055--liaison-twitch-unifiée-et-progression-définitive-2026-10-06) supplante l’ancien OAuth-before-import pour Ceo uniquement. Identifier le standalone via sa vraie identité Web authentifiée, jamais le displayName ; avant toute liaison, Helix frais/snapshot exact/import Twitch distinct TWITCH_ONLY avec backup/provenance DATA_IMPORTED et target LEGACY/non-canary, sans WebIdentity ni transfert NATIVE. Vérifier les deux Players significatifs distincts, puis gate humain OAuth, comparaison attendue et choix « Utiliser ma progression Twitch ». Vérifier gagnant Twitch ACTIVE avec WebIdentity/Auth et TwitchIdentity, perdant standalone ARCHIVED sans identité d’accès, gameplay gagnant sans fusion, provenance/target/backup cohérents et F5/reconnexion. Références partagées bloquant le choix → STOP ; uniquement résolution opérateur canonique R1055, nouveau mécanisme éventuel sur review avec review indépendante avant promotion. Seulement après validation du choix : OFF normal/zéro inflight/outbound, extension à quatre canaries puis vrai smoke Ceo. [Gates détaillés](../process/legacy-cutover-runbook.md). Aucun Ceo identifié/importé/validé par ce checkpoint. Batch historique seulement après les quatre validations, non exécuté dans cette mission ; viewers ordinaires Twitch-only avant révélation, récupération Web neuf R1046 ultérieure sans nouvel import gameplay. Streamer.bot reste OFF ; GLOBAL interdit.

## Historique — Kichni_Test complet ; liaison Mynonyme avant import, 07/10/2026

**Validation acquise :** le propriétaire confirme le parcours réel MynonymeTest6 → Configuration > Compte → OAuth Kichni_Test, récupération automatique sans comparaison, arrivée sur le vrai profil, F5 puis déconnexion/reconnexion avec la même progression. Lecture publique fraîche RepeatableRead explicitement READ ONLY : Kichni_Test ACTIVE/GEO, même Player, une WebIdentity (celle du temporaire) et une TwitchIdentity, NATIVE/canary/DATA_IMPORTED, XP 32/messages 93. Ancien MynonymeTest6 ARCHIVED, sans WebIdentity/TwitchIdentity/target ; aucune comparaison terminée inventée ni résolution active. Autorité CANARY révision 4, seule canary ; aucun traitement Twitch engagé/incertain ni réponse PENDING/SENDING/AMBIGUOUS. Ne pas refaire son import/transfert/recette. Le checkpoint précédent `52528ad` a été vérifié sur main/review communs, Railway/Cloudflare exacts et health/Prisma ; ce déploiement ne remplace pas la validation propriétaire maintenant acquise.

**Correction UI et publication :** le verrou synchrone existant empêche déjà deux appels dans le même tick ; conserver ce verrou/pending après le succès de `location.assign`, ajouter `aria-busy` au bouton partagé existant, le libérer sur erreur avant redirection avec le message/retry existants. Aucun changement OAuth/nonce/state/callback/backend. Six cas RED avant correction ; tests ciblés Compte/Bootstrap/API **139/139 PASS**, dont clic simple, double clic même tick, clics rapprochés, un seul POST authentifié, pending accessible maintenu et retries après erreur réseau/URL/navigation. `verify:full` **8/8 PASS** : tests frontend/backend non-DB, build/typecheck frontend, typecheck/build backend, lint et diff-check worktree/index ; logs complets TEMP `gachaimpact-verify-full-PP7fyk`. Vérification visuelle du GameShell non exécutée : navigateur de contrôle indisponible ; aucun style/géométrie modifié. Le propriétaire autorise review → push → contrôle du vrai diff GitHub → fast-forward strict main → push/fetch dans cette même mission, sans review indépendante supplémentaire pour ce lot borné. [Méthode durable](../process/implementation-workflow.md#4-publier-le-candidat-sur-review).

**Préimage Mynonyme avant OAuth :** lecture publique READ ONLY, localisation initiale unique du standalone puis sauvegarde locale ignorée des IDs immuables/WebIdentity/Auth et des lignes exactes. ACTIVE/PYRO, XP/messages significatifs, 7 personnages, 255 opérations, 45 lignes dans les tables sociales référencées ; une WebIdentity ACTIVE, zéro TwitchIdentity/target/import. Capture personnelle/technique de 55 tables et inventaire de 106 tables FK directes vers Player ; aucun rapprochement Twitch par pseudo. Registre Prisma confronté aux 62 dossiers et finishedAt ; aucune migration nouvelle. Preuves privées hors Git. Ce constat ne certifie pas encore le futur préflight/rehearsal.

**Prochaine étape exacte et gates de cette même mission :** attendre Railway du SHA commun exact SUCCESS/Online/une replica, zéro warning/critical/pending, health 200/status ok, Prisma 62 à jour et Cloudflare du même SHA. Comparaison publique READ ONLY aux préimages, puis **STOP pour la seule liaison OAuth Mynonyme** selon le [runbook](../process/legacy-cutover-runbook.md#gate-1--liaison-mynonyme-après-déploiement). Après `fait`, vérifier même Player/WebIdentity/Auth, vraie TwitchIdentity unique, gameplay et relations inchangés, aucun import/target/deuxième Player. Ensuite seulement snapshot frais ciblé 17/17/manifest/hashes/unknown=0 distinct de Kichni_Test et GLOBAL, Helix frais de l’ID OAuth exact, plan obligatoirement EXISTING_VERIFIED_TWITCH, blockers=0 et rehearsal privée/backup/restauration/comparaison complète PASS. Relation partagée réellement bloquante/inconnue → STOP, aucun contournement SQL. Gate OFF humain ensuite ; apply existant au même Player avec backup durable fsync, identité/rôles/privacy/préférences hors gameplay/relations conservés, gameplay remplacé volontairement sans fusion ; DATA_IMPORTED/LEGACY/non-canary et comparaison complète PASS. Extension CLI existante réarme CANARY, ensemble exact {Kichni_Test, Mynonyme}, transport à revalider, puis smoke propriétaire F5/identité/données et !pity / !quotis / !box. Aucune étape future ni recette Mynonyme présumée exécutée. Kichnifou → Ceo → batch attendent Mynonyme ; GLOBAL interdit et Streamer.bot reste OFF.

## Historique — promotion approuvée ; déploiements puis recette propriétaire, 07/10/2026

**Base de la mission et approbation :** fetch exécuté, index/worktree propres ; main/origin/main `2b30812644578eeb62e4bcfb839d6034a54cfb78`, review/origin/review `dadcb3afb189467b35e29630cab43c81bdfe1817`, ahead 2/behind 0, ancestry exacte et connecteur GitHub contrôlés. Chaîne `2b308126` → extension locale multi-canary `1ec810ac32eef90544b02f7d27448ea9cffbc68f` → récupération Web/Twitch `dadcb3afb189467b35e29630cab43c81bdfe1817` : les deux reviews indépendantes ChatGPT sont APPROUVÉES, selon la mission explicite du propriétaire. Chaîne prête pour le fast-forward strict avec ce checkpoint documentaire dédié ; aucun nouveau code ni migration. Ce checkpoint est publié sur review avant d’avancer toute la chaîne sur main, sans merge commit/squash/rebase/force-push.

**État de référence et contrôles :** préimage publique fraîche en transaction RepeatableRead explicitement READ ONLY avant promotion : Kichni_Test ACTIVE, identité/Player exacts, seule target NATIVE/canary et DATA_IMPORTED ; autorité CANARY révision 4 ; aucun traitement Twitch engagé/incertain, réponse PENDING/SENDING/AMBIGUOUS ou BusinessOperation TWITCH PENDING. MynonymeTest6 demeure ACTIVE/sans élément, même WebIdentity non rattachée ; 55 tables personnelles/techniques capturées sur les deux Players, contrôle/targets/imports/audits et inventaire des schémas privés sauvegardés hors Git pour comparaison après déploiement. Registre Prisma : 62 noms exacts/finishedAt confrontés aux dossiers versionnés ; aucune migration nouvelle. Les preuves de tests des deux lots approuvés restent dans les historiques ci-dessous ; leurs suites ne sont pas relancées pour ce checkpoint de statut. Aucun déploiement, healthcheck ou test utilisateur n’est déduit de ces contrôles préalables.

**État post-promotion de ce checkpoint :** main et review doivent porter le même SHA final commun, divergence 0/0, contenant les deux correctifs approuvés et ce seul lot Markdown. Vérifier Railway sur ce SHA exact (SUCCESS, Online/une replica, zéro warning/critical/pending work), Cloudflare autant que les outils le permettent, /health 200/status ok et Prisma 62 à jour. Contrôle public après déploiement uniquement READ ONLY, confronté à la préimage ; aucun pending/status applicatif mutatif. Les résultats de déploiement appartiennent au rapport de mission et ne sont pas anticipés ici. Kichni_Test garde son import, sa progression et sa target ; aucun appel de liaison, import, extension canary publique, cutover, changement d’autorité, Railway/env/OAuth/EventSub ou redémarrage Streamer.bot autorisé par cette promotion.

**Prochaine étape exacte :** après ces gates verts, STOP pour la [recette propriétaire](../process/legacy-cutover-runbook.md#recette-propriétaire-après-déploiements-vérifiés) avec **MynonymeTest6 et Kichni_Test existants**. Aucun nouveau compte ni choix d’élément préalable : Configuration > Compte → Lier mon compte Twitch → récupération automatique sans comparatif, mêmes données Kichni_Test ; F5 puis déconnexion/reconnexion doivent retrouver le même Player Twitch. Cette récupération standalone n’est pas encore validée publiquement. Après ce test seulement, ChatGPT contrôle la DB/receipts et décide de sa validation ; ensuite Kichnifou → Ceo → rehearsal finale → batch historique, dans leurs missions dédiées. Extension approuvée/promue dans la chaîne, mais non exécutée publiquement ; Kichnifou non importé, Ceo/batch/GLOBAL non commencés et Streamer.bot OFF.

## Historique — récupération Twitch du Web neuf ; candidat review, 07/10/2026

**Base vérifiée :** fetch, index/worktree propres au départ ; main/origin/main `2b30812644578eeb62e4bcfb839d6034a54cfb78`, review/origin/review `1ec810ac32eef90544b02f7d27448ea9cffbc68f`, ahead 1/behind 0 confirmé par le connecteur GitHub. Le candidat d’extension multi-canary `1ec810a` a reçu la review ChatGPT favorable transmise par le propriétaire, sans finding bloquant ; il reste préservé sur review et non promu.

**Défaut réel et causes :** le propriétaire signale le comparatif injustifié entre MynonymeTest6 et Kichni_Test. Diagnostic public minimal dans une transaction RepeatableRead explicitement READ ONLY : Web ACTIVE/sans élément, XP/messages/zéro solde non nul, aucune opération/cosmétique/TwitchIdentity, privacy initiale, une WebIdentity ; deux states OAuth et désormais neuf comparaisons non finalisées (contre quatre lors du diagnostic transmis). Ownership exact des traces vérifié ; noms utilisés uniquement pour localiser le cas, identités immuables pour les lectures suivantes. Les FK de ces traces empêchaient isDisposableWebPlayer de reconnaître le Web vide ; celles RESTRICT des comparaisons interdisaient ensuite sa suppression. Le contrôle du candidat a aussi révélé une notification de code cadeau disponible non récupéré et un compte bancaire à zéro/sans historique : deux écritures de maintenance normales, sans gain ni action de gameplay. Les tests privés du vrai provisioning → Compte → start OAuth → callback OIDC/Helix signé, avec les vrais producteurs de maintenance, reproduisent ces blocages. Un test frontend reproduit aussi la sélection d’élément et le dialogue du Player temporaire conservés quand le Twitch récupéré est lui-même sans élément.

**Correctif candidat :** classification technique strictement liée au Player source et à sa WebIdentity ACTIVE, hashes/structure/FK/ownership vérifiés ; aucune permission globale de suppression. Comparaison achevée, référence Twitch-side/étrangère, domaine/colonne/dépendance inconnus ou gameplay/ressources/rôle/relation demeurent protégés. Notification admise seulement si elle correspond exactement à l’édition, au propriétaire et au payload du producteur, sans claim ; banque admise seulement à zéro, date passée, sans transaction ni dépendance inconnue. Même transaction Serializable à verrous : states source invalidés, comparaisons inachevées expirées sans faux choix/completedAt, snapshots/IDs/FK conservés ; source vide ARCHIVED si un audit ou une notification informative la référence, supprimée sinon. Sans comparaison antérieure, une preuve technique déjà expirée protège l’archive de notification au futur purge ; aucun consentement inventé. Même WebIdentity déplacée vers le même Player Twitch ; sessions source supprimées, aucune fusion/import/transfert/désactivation canary. Motif d’autorité native active distinct des relations partagées, sans autoriser son abandon ; le rattachement vers le Twitch conservé reste possible CANARY active. L’écran pré-élément est réinitialisé par Player ID ; bootstrap complet et session de jeu reconstruits vers le bon Player sans logout. [Contrat propriétaire](../process/twitch-native-foundations.md#récupération-du-web-neuf--correction-des-traces-techniques).

**Contrôles PostgreSQL acquis :** suites privées exécutées fichier par fichier, **102/102 PASS** : twitch-web-recovery **37**, twitch-account-link **30**, twitch-native-foundations **25**, twitch-native-unlink **1**, twitch-native-bridge **9**. RED initial : trois défauts backend reproduits, puis GREEN ; reproduction supplémentaire de la notification réelle et du refus bancaire après minuit Paris/avant minuit UTC, puis GREEN. Concurrence/replay, invalides, conflits, audit/FK, rollback et retry, conservation exacte du gameplay/imports/targets/contrôle/audits NATIVE/CANARY et purge privée couverts. Banque vide admise selon la date métier Europe/Paris ; solde/historique/date future/dépendance inconnue protégés. Premier fixture GiftCodeClaim incomplet corrigé avec sa BusinessOperation obligatoire ; protections SQL inchangées. Warning pg déjà présent dans bridge, aucune dépendance modifiée. Logs complets TEMP gacha-recovery-*.

**Contrôles frontend et non-DB acquis :** frontend ciblé **105/105 PASS**, backend ciblé **106/106 PASS** ; RED frontend du dialogue/sélection pré-élément, puis GREEN. Première verify:full : lint du nouveau mock React anonyme refusé ; mock nommé corrigé. Passe complète finale après stabilisation bancaire **8/8 PASS** : frontend **1 353/1 353**, backend hors DB **1 927/1 927**, builds/typechecks/lint/diff-checks verts ; logs TEMP gachaimpact-verify-full-gy0l1K. Aucun contrôle visuel réel revendiqué : tentative de fixture GameShell avec les CSS du produit, mais IAB indisponible et inventaire navigateurs vide ; fixture/serveur supprimés/arrêtés. Tests DOM réussis, recette visuelle/publique toujours distincte.

**Contrôle public final et isolement :** transaction RepeatableRead explicitement READ ONLY, même préimage exacte Web/identités/states/comparaisons/ressources/progression/Gacha/privacy, contrôle/target/imports et empreintes gameplay Twitch ; banque et notification confrontées aussi à leur diagnostic privé complémentaire, inchangées. Le garde du candidat retourne disposable=true pour MynonymeTest6 existant ; aucune liaison ni écriture publique exécutée. CANARY révision 4, même target NATIVE/canary. Inventaire des schémas privés strictement identique avant/après : aucun nouveau résidu ; schéma historique conservé, sans prétendre à zéro schéma privé global. Registre Prisma confronté aux 62 dossiers versionnés, noms exacts/finishedAt présents, puis migrate status sous default_transaction_read_only=on : schéma à jour, aucune migration ajoutée/appliquée. Preuves ignorées local-data/identity-resolutions/recovery-2026-10-07 ; diff confronté aux valeurs privées et secrets de configuration sans correspondance. Streamer.bot OFF confirmé par le propriétaire, zéro processus local correspondant observé.

**Prochaine étape exacte :** review indépendante du nouveau correctif d’identité sur review. Main inchangé, aucune promotion/déploiement dans cette mission. Après approbation et déploiement distincts, le propriétaire pourra reprendre « Lier mon compte Twitch » avec **MynonymeTest6 et Kichni_Test existants**, sans nouveau compte/reset/import : récupération automatique puis persistance après reconnexion à vérifier réellement. Cette recette n’est pas acquise. Kichnifou attend sa réussite ; Ceo puis batch gardent leurs gates. Streamer.bot OFF, aucun GLOBAL ni changement Railway/env/OAuth/EventSub ; aucune liaison publique exécutée par Codex.

## Historique — extension multi-canary locale candidate, 06/10/2026

**Baseline et checkpoint documentaire :** départ `83eee14a1167019beb08664462807e6d3e9408d2`, fetch/main/review/distants exacts, divergence 0/0, worktree/index propres. Rattrapage Kichni_Test limité aux trois propriétaires de statut : `2b30812644578eeb62e4bcfb839d6034a54cfb78`, push review, vrai diff GitHub contrôlé (un commit/trois Markdown), fast-forward strict/push main autorisés pour ce seul micro-checkpoint, retour review. Railway du SHA exact : déploiement `cdd6c408-4854-48f7-bd15-5e36a9e5b1dd` SUCCESS ; GET /health HTTP 200/status ok ; Prisma public sous READ ONLY : 62 migrations à jour. Aucun changement Railway/env/OAuth/EventSub ni migration appliquée.

**Besoin démontré dans le code :** transferImportedCanary exige OFF et zéro canary ; configure avec IDs remet les flags de toutes les targets et ajoute AUTHORITY_TRANSFERRED pour chaque membre ; resumePersistedCanary reprend uniquement l’ensemble existant. Aucune surface locale durable existante ne réalise l’ajout d’un seul import avec préservation exacte des anciennes targets et audits. Ne pas détourner ces chemins ni forcer les tables en SQL.

**Correctif borné :** CLI `migration:legacy:canary:extend` → TwitchNativeAuthority.extendImportedCanary, LOCAL-ONLY et sans nouvelle route, DDL, capability/env ou GLOBAL. requireOperator/ACK/capacité, contrôle OFF/révision stricte, verrous contrôle/targets/Players/identités/imports et Serializable ; nouvelle target LEGACY/non-canary/Player ACTIVE exact/dernière provenance DATA_IMPORTED et backupHash exacts. Chaque canary existante doit rester NATIVE avec identité/Player/provenance cohérents et ACK/date valides ; opérations engagées et réponses PENDING/SENDING/AMBIGUOUS bloquent tous les membres. Une seule target et un seul audit de transfert ajoutés, contrôle CANARY/révision +1, anciens targets/imports/gameplay intégralement conservés. [Contrat et CLI](../process/twitch-native-foundations.md#extension-locale-dun-ensemble-canary-importé).

**Contrôles PostgreSQL exécutés :** test RED sur l’opération locale absente puis GREEN ; **153/153 PASS sur huit fichiers privés exécutés séquentiellement** : imported-canary-extension 46, imported-canary-transfer 13, twitch-canary-resume 22, twitch-native-foundations 25, legacy-canary 9, twitch-command-pilot 18, twitch-operations-in-flight 11 et twitch-native-bridge 9. Extension 1→2 et 2→3 ; anciennes targets strictement identiques, imports et toutes les autres tables privées inchangés, dont gameplay significatif/WebIdentity/préférences. Refus vérifiés avec codes exacts : revision/OFF/ACK/opérateur/capacité, identité/Player/statut/provenance/hash, membres incohérents, opérations PENDING/EXECUTING et réponses PENDING/SENDING/AMBIGUOUS sur ancien et nouveau membre. Verrous réels observés pour contrôle/deux targets/deux Players ; deux extensions concurrentes à la même révision produisent un seul succès sans transfert partiel. Injection d’échec du dernier audit : rollback exact de toutes les tables ; répétition refusée proprement.

**Validation non-DB :** CLI/parser 14/14 PASS, typecheck dédié .mts PASS (TypeScript 6 avec --ignoreConfig), verify:full standard **8/8 PASS**, frontend **1 349/1 349**, backend hors DB **1 927/1 927**, builds/typechecks/lint/diff-checks verts. Logs complets TEMP gacha-extension-* et gachaimpact-verify-full-giTseU. Premières passes : colonne id erronée du lock TwitchIdentity corrigée vers twitch_user_id, fixtures préférence/association et cas CLI vide corrigés ; assertions de refus renforcées pour ne pas accepter une erreur SQL comme refus métier. Une erreur FK isolée au bootstrap d’une fixture n’est pas reproduite par les contrôles ciblés puis les 46 tests finaux ; log conservé, aucune protection/timeout affaibli. Une sélection initiale de fichier receipts inexistant n’a exécuté aucun test ; le vrai fichier twitch-operations-in-flight passe ensuite 11/11. Warning pg de requêtes concurrentes déjà présent dans pilote/bridge, sans changement de dépendance.

**Contrôle public final et isolement :** transaction explicitement READ ONLY après les huit suites : contrôle/target/trois receipts strictement identiques à la préimage de reprise, CANARY révision 4, Kichni_Test ACTIVE/identité exacte/WebIdentity 0/DATA_IMPORTED et unique NATIVE/canary ; aucun import opérateur, blocked=false/unresolvedOutbound=false. Roue quotidienne/statistiques strictement inchangées. Registre Prisma confronté aux 62 dossiers versionnés, noms exacts/finishedAt présents, puis migrate status à jour ; aucune migration appliquée. Inventaire des schémas privés strictement identique avant/après : seul schéma historique conservé, aucun nouveau résidu, sans prétendre à zéro schéma privé global. Preuves public-before/public-final ignorées dans local-data/identity-resolutions/multi-canary-2026-10-06 ; aucun ID privé publié. Streamer.bot OFF confirmé par le propriétaire, zéro processus local correspondant observé.

**Prochaine étape : review indépendante ChatGPT du vrai candidat GitHub ; aucune promotion main du code ni apply Kichnifou dans cette mission.** Aucun import Kichnifou, transfert public, kill switch ou réarmement exécuté dans le correctif ; Ceo/batch/GLOBAL intacts, aucune nouvelle capture legacy. Après approbation et promotion/déploiement distincts : préflight complet Kichnifou depuis une nouvelle capture ciblée du legacy figé, puis import/extension gardés et vrai smoke Twitch. Ceo seulement après cette validation, 31B seulement après validation Ceo.

## Historique — Kichni_Test validé ; préparation Kichnifou, 06/10/2026

**Validation propriétaire acquise :** après le checkpoint `83eee14a1167019beb08664462807e6d3e9408d2`, le propriétaire a réarmé le pilote et exécuté le smoke final Twitch `!quotis / !quoti / !roue` avec succès. Kichni_Test est validé de bout en bout ; ne pas refaire son cutover ni son import. Le propriétaire confirme la réception Chat Twitch active et Streamer.bot toujours OFF depuis la capture.

**Contrôle public de reprise exécuté :** transaction PostgreSQL explicitement READ ONLY, contrôle CANARY révision 4/ACK STREAMERBOT_PATH_DISABLED, Kichni_Test ACTIVE avec identité Twitch exacte, WebIdentity 0, DATA_IMPORTED et seule target NATIVE/canary. Les trois derniers receipts sont PROCESSED/RESPONSES avec une réponse SENT chacun (deux handler quotis et un roue). Aucune opération engagée ni outbound incertain ; aucune importation Kichnifou pour le réarmement. Empreintes complètes des tables Roue quotidienne/statistiques strictement identiques à la préimage du hotfix : aucun nouveau résultat/récompense Roue. Preuves privées ignorées dans local-data/identity-resolutions/multi-canary-2026-10-06/public-before.json ; aucun ID Twitch publié.

**Prochaine étape autorisée :** Kichnifou, puis Ceo seulement après validation Twitch réelle Kichnifou, puis 31B seulement après validation réelle Ceo. Vérifier d’abord le code et une surface locale durable permettant d’ajouter exactement une target DATA_IMPORTED tout en préservant Kichni_Test. Si un correctif d’autorité est nécessaire : tests PostgreSQL privés et contrôles pertinents, publication review puis STOP pour review indépendante, sans promotion main ni import Kichnifou dans ce lot. GLOBAL reste non activé ; aucun autre joueur migré, aucun changement Railway/env/OAuth/EventSub.

## Historique — réarmement canary NATIVE après OFF, 06/10/2026

**Mission et baseline :** main/review/origin main/origin review `db069882ef3108388a3ab9a22a4e2c71be852922`, fetch exécuté, divergence 0/0, index/worktree initialement propres. Promotion directe par fast-forward strict autorisée dans cette mission si tous les gates sont verts. Aucun réarmement public par Codex, transfert supplémentaire, import Kichnifou, rollback, GLOBAL ou changement Railway/env/OAuth/EventSub.

**Défaut et correction :** le vrai client API du bouton envoie seulement l’ACK ; avant correction, ce POST tente de transférer l’identité de l’opérateur Kichnifou et refuse correctement faute de DATA_IMPORTED. Test PostgreSQL privé RED reproduit ce refus, puis GREEN. Sans IDs explicites, arm reprend désormais exactement l’ensemble canary persisté via un owner dédié : contrôle OFF/révision exacte, opérateur/capacité/ACK, targets NATIVE cohérentes sans migration pending ni opération engagée. Seuls le contrôle et son audit DESIRED_AUTHORITY_CHANGED changent ; aucune target/import/Player/gameplay, aucun nouvel AUTHORITY_TRANSFERRED. Ensemble multiple accepté intégralement, membre invalide refusé atomiquement. Chemin explicite et fallback sans canary gardent leurs protections existantes, dont DATA_IMPORTED. [Contrat opérateur](../process/twitch-native-foundations.md#autorité-et-mise-en-service-future).

**Contrôles ciblés et PostgreSQL exécutés :** 22/22 nouveaux tests PostgreSQL privés PASS, 54/54 régressions privées fondations/pilote/sécurité receipts PASS, soit **76/76 sur quatre fichiers exécutés séquentiellement** ; 173/173 tests backend ciblés pilote/routes/service et 118/118 tests UI/API PASS. Le test intégré utilise le véritable client API, la route et les owners PostgreSQL avec payload ACK seulement. Il vérifie targets inchangées, audit unique, aucune nouvelle provenance de transfert ni exécution/envoi. Refus atomiques : révision stale, OFF/capacité/ACK/opérateur/transport invalides, LEGACY/MIGRATION_PENDING, incohérence d’identité/Player, opérations engagées et outbound incertain. Le scénario existant de réponse PENDING vérifie désormais le refus de reprise implicite, puis la récupération par réarmement explicitement ciblé inchangé, sans rejouer le Pull.

**Isolement et migrations :** seules les fixtures privées ont écrit ; leur cleanup est exécuté et l’inventaire read-only confirme aucun nouveau schéma résiduel. Unique schéma historique vide conservé, 123 tables/zéro ligne. Prisma migrate status public : **62 migrations, schéma à jour**, aucune migration ajoutée ou appliquée. Logs complets TEMP kichni-canary-resume-* ; valeurs publiques privées/provenance conservées dans local-data ignoré.

**Validation complète :** verify:full standard **8/8 PASS**, frontend **1 349/1 349**, backend hors DB **1 922/1 922**, builds/typechecks/lint/diff-checks verts, logs gachaimpact-verify-full-QFcLRD. Première passe sous charge simultanée avec PostgreSQL : deux timeouts hors périmètre (historical-twitch-evidence et ChatPanel) et une assertion TTL DirectMessagePanel ; les 34 tests de preuves historiques et 156 Chat/MP repassent isolément, puis la suite complète standard seule passe sans aucune modification de code, fixture ou timeout pour ces échecs.

**État public de référence :** lecture en transaction explicitement READ ONLY : OFF révision 3, commandPilotArmed=false/commandPilotEnabled=false, Kichni_Test ACTIVE unique NATIVE/canary, DATA_IMPORTED présent, aucun import pour l’opérateur, blocked=false/unresolvedOutbound=false. Préimage et empreintes de 54 tables publiques sauvegardées localement hors Git pour comparaison après déploiement. Aucune écriture publique exécutée dans cette mission.

**Promotion et déploiement exécutés :** commit technique `b1daf533f153c6b9d6c77ba2f8f53b4b3a060b72`, push review puis vrai diff GitHub vérifié depuis db06988 : un commit, huit fichiers, +248/−13, uniquement autorité/pilote/tests et trois documents. Fast-forward strict review → main/push normal, fetch des refs communes/divergence 0/0 et retour sur review propre. Railway déploiement `6201d832-ebaa-470d-b8ec-4166ec2c80ba` du SHA exact **SUCCESS**, Application ready/serveur en écoute ; GET /health HTTP 200/status ok. Logs : 62 migrations/aucune pending à appliquer ; Prisma migrate status public relancé après déploiement, schéma à jour. Aucun changement infra/env/OAuth/EventSub. Le checkpoint documentaire final, autorisé dans la même mission, consigne ce changement d’état réel ; son push ne modifie pas le code du hotfix.

**Contrôle public après déploiement :** transaction explicitement READ ONLY, contrôle toujours OFF révision 3, commandPilotArmed=false/commandPilotEnabled=false, Kichni_Test seule target NATIVE/canary, même Player ACTIVE et DATA_IMPORTED ; aucun import opérateur, blocked=false/unresolvedOutbound=false. Comparaison des 54 tables : **53 strictement identiques**, dont autorité/targets/imports/Players/identités/receipts/audits et données métier. Seule player_activity_state diffère, même nombre de lignes : activité applicative récente d’un autre Player (updatedAt=lastAppActivityAt), ses dates gameplay/chat/Twitch restant antérieures à la préimage ; activité des deux Players du périmètre également antérieure. Les empreintes initiales ne permettent pas un diff champ par champ de cette seule table : ne pas annoncer 54/54 identiques. L’owner présence enregistre normalement cette activité APPLICATION ; les processus Codex publics ont uniquement lu sous READ ONLY. Preuves ignorées canary-resume-2026-10-06/before, diagnostic et final ; aucun transfert, écriture d’autorité/import/gameplay ou envoi Twitch exécuté par Codex.

**STOP propriétaire :** cliquer soi-même « Activer le pilote commandes » dans Configuration → Compte. ChatGPT vérifie desired CANARY/effective CANARY/transportValid=true et Kichni_Test toujours seule target NATIVE/canary avant smoke !quotis / !quoti / !roue. Transport invalide → STOP sans changer OAuth/EventSub. Aucun arm/configure public automatique, aucune recette publique corrigée revendiquée avant ce test.

## Historique — hotfix Roue inconnue / Quotis, 06/10/2026

**Mission :** baseline main/review `c357fe8fa78ad9eb8a2e43df4d1434ed84c06b50`, fetch exact, divergence 0/0 et worktree/index initialement propres. Correctif borné, CLI local-only et promotion directe review → main autorisés dans la même mission si tous les gates sont verts. Pas de nouvel import, rollback, GLOBAL ou changement infra/env/OAuth/EventSub.

**Défaut reproduit :** la vraie fixture PostgreSQL privée ACTIVE avec Roue du 06/10 `resultKnown=false` reproduit « The persisted native Wheel result is incomplete. » dans GetTodayWheelState → findByDate → toResult. La représentation importée est correcte : tentative consommée, résultat NULL, provenance du snapshot final conservée. Deux receipts live reconnus `quotis`, args vides, restent RECEIVED/EXECUTING sans intent ni réponses ni BusinessOperation liée ; les lectures publiques ne les ont pas modifiés. Le propriétaire rapporte PASS pour banniere, box, team, mission, expedition, combat, event, faveur, concours, ami et combat boss.

**Correctif :** [source Roue](../legacy/17-roue-quotidien-audit.md#correctif-post-cutover--résultat-historique-inconnu-06102026), lecture quotidienne distincte du résultat strict ; consommée/inconnue = spun true/result null. Quotis/Quoti/Daily répondent normalement avec Roue ✅. Roue répond avant spin ; appels directs refusés par BusinessError contrôlée, aucun RNG/gain/effet ni réécriture historique. Native connue, absence de ligne et lendemain restent valides ; aucune migration ni changement économie/probabilités.

**Désarmement réel :** le bouton Compte actuel appelle disarm qui persiste OFF, et non un flag runtime indépendant. Lecture après action du propriétaire : OFF révision 3, target toujours NATIVE/canary, une seule canary. Le propriétaire a explicitement confirmé de conserver cette référence sans écriture d’autorité. La réconciliation exige cet état OFF et sa révision exacte ; elle ne réarme ni ne configure aucune autorité.

**Contrôles techniques exécutés :** 284 tests backend ciblés sur neuf fichiers PASS ; verify:full standard 8/8 PASS, frontend 1 349 et backend hors DB 1 922, builds/typechecks/lint/diff-checks verts. Typecheck dédié du CLI .mts PASS puis typecheck backend final PASS. PostgreSQL privé : Roue inconnue 10/10, réconciliation 20/20, bridge natif 9/9, pilote commandes 18/18, sécurité receipts 11/11 et legacy-canary 9/9 PASS, soit 77/77 sur six fichiers. Cleanup exécuté et inventaire READ ONLY contrôlé : aucun nouveau schéma résiduel, unique schéma vide historique conservé. Première passe attendue RED sur le bug réel ; ensuite omissions de fixtures corrigées (enveloppe Twitch/send mock, résultat natif des reminders, ACK/date de l’état armé et rôle ADMIN/ACK du bridge), sans affaiblir les protections produit ni modifier les timeouts. Prisma public READ ONLY : 62 migrations, schéma à jour, aucune migration appliquée. Logs complets TEMP kichni-wheel-hotfix-*, kichni-quotis-*, kichni-hotfix-db-* et gachaimpact-verify-full-0E41pY.

**Promotion et production exécutées :** commit technique `cb9ae09c0191862cef250964871a966ae4f20eaa`, push review puis vrai diff GitHub vérifié : un commit, 20 fichiers, +444/−25, périmètre Roue/Quotis/CLI/tests/docs uniquement. Fast-forward strict review → main et push normal, refs communes/divergence 0/0, retour sur review propre. Railway déploiement `2f9ab632-ea84-490c-9e34-ef531f8ce953` du SHA exact SUCCESS, Application ready/serveur en écoute ; GET /health HTTP 200/status ok. Logs : 62 migrations, aucune pending à appliquer ; migrate status public relancé, schéma à jour. Aucun changement Railway/env/OAuth/EventSub ni migration appliquée. Le checkpoint suivant est documentaire uniquement, autorisé dans la même mission.

**Réconciliation publique exécutée :** [CLI local borné](../process/legacy-cutover-runbook.md#réconciliation-locale-quotis--échec-de-prepare-read-only) lancé depuis cb9ae09 pour les seuls receipts `c7b9def3-c553-4723-a02d-cb827414dda0` et `a346c4bf-6318-48c6-b8c4-fde76a0a0344`, avec opérateur/Player/ID immuable privés vérifiés et révision explicite 3. Préimage fraîche après le désarmement propriétaire, puis contrôles avant/après dans des transactions explicitement READ ONLY : runtime owner commandPilotArmed=false/commandPilotEnabled=false, Player ACTIVE, DATA_IMPORTED, WebIdentity 0, target NATIVE/canary unique, OFF/révision 3. Avant : RECEIVED/EXECUTING, intent absent, args vides, responses vides, aucun PENDING/opération liée. Après : **FAILED/RESPONSES**, processedAt présent, raison fixe QUOTIS_READ_ONLY_PREPARATION_FAILED_RECONCILED et audit opérateur ; réponses toujours vides, aucun resolver ou envoi Twitch. Source/historique des deux receipts préservés et précédent état/stage audités, aucun receipt supprimé.

**Absence d’effets vérifiée :** empreintes et nombres de lignes de **52 tables publiques strictement identiques** avant/après, dont ressources/mouvements/opérations, pity/totalPulls, Roue/stats/quotidiennes, Player/identités/import/target/autorité. Tous les autres receipts et audits antérieurs intacts ; exactement un audit de réconciliation ajouté. assessTwitchOperationsInFlight = **blocked=false/unresolvedOutbound=false** après, contre true/false avant. Les preuves détaillées restent ignorées dans local-data/identity-resolutions/wheel-hotfix-kichni-test-2026-10-06 ; valeurs opérateur uniquement dans les processus locaux, aucun .env modifié. Aucun rollback, réarmement, autre joueur migré, GLOBAL, nouveau gain Roue, infra ou OAuth/EventSub modifié. Streamer.bot toujours OFF selon confirmation propriétaire. STOP : prochain gate = réarmement manuel puis smoke !quotis / !quoti par le propriétaire/ChatGPT.

## Historique — premier cutover Kichni_Test, fenêtre du 06/10/2026

**Mission et baseline :** autorisation explicite de cutover Kichni_Test uniquement, avec promotion review → main dans la même mission sans review ChatGPT intermédiaire, sous réserve de tous les gates verts. Fetch initial : main/review/origin main/origin review = `281d355922099926da072666de8d984477e0117a`, divergence 0/0, worktree/index propres. Aucun batch, autre joueur, GLOBAL, nouvelle migration ou changement OAuth/EventSub autorisé.

**Snapshot final ciblé :** le propriétaire confirme que Streamer.bot n’a jamais été redémarré depuis la capture. Le dossier ignoré `local-data/streamerbot-snapshots/preflight-kichni-test-2026-10-06` est donc la capture finale autorisée pour ce seul cutover, sans nouvelle copie ; il ne devient pas le snapshot final du batch global. Owner de lecture : 17/17 JSON + manifest, tailles et SHA-256 valides ; hash recalculé identique `d3ee8d88582300ca6006fb85afe0801bea7c866bcce7b05ff444edd39590baf0`. Aucune lecture du dossier live. Coverage fraîche : **29 918/29 918, unknown=0** ; six enfants tradeRequests connus dropped, future propriété toujours bloquante. Analyze avec --fixture-identities reste un diagnostic global synthétique, jamais une sélection/import de population.

**Gates avant apply :** nouvelle preuve Helix privée de reprise `cutover-kichni-test-2026-10-06-resume-helix.json`, scope CANARY Kichni_Test seulement, VERIFIED, un utilisateur et zéro missing/conflit/doublon, liée au même snapshot. Lecture PostgreSQL public imposée READ ONLY par l’ID numérique vérifié avant apply : identité/target/import absents, aucun Player/WebIdentity rattaché, couverture native false, mode OFF et aucune autre canary. Plan CLI réel relancé avec le cutoverAt de cette fenêtre : **TWITCH_ONLY / expected ABSENT / blockers=[] / shared=0**. Les 71 observations passives restent non bloquantes ; les opérations natives engagées gardent leurs protections. CLI de rehearsal final relancé sur cette preuve : **TWITCH_ONLY PASS, EXISTING_VERIFIED_TWITCH PASS, rollback EXACT_PREIMAGE** ; mutations limitées aux schémas privés. Coverage et inventaire de nettoyage également recontrôlés à la reprise ; même unique schéma vide historique, aucun nouveau résidu.

**Code préparé :** actions Notifications de 18 px, police 9 px, gap vertical 1 px, bloc de 37 px aligné au bas/gauche de sa zone droite, panneau inchangé. EMPTY : deux disabled ; READ : lecture disabled/suppression active ; UNREAD : deux actifs. Nouveau CLI local-only `migration:legacy:canary:transfer`, via TwitchNativeAuthority et ses invariants existants : opérateur ADMIN allowlisté, un ID numérique exact, expected Player exact, DATA_IMPORTED/backupHash, ACK et révision explicites, autorité OFF sans autre canary, aucune opération engagée. Aucun nouvel endpoint HTTP, mode GLOBAL ou SQL métier manuel. Contrat et procédure au [guide opérateur](../process/twitch-native-foundations.md#transfert-local-dun-import-canary-exact).

**Contrôles techniques :** verify:full standard **8/8 PASS**, frontend **1 349/1 349** et backend hors DB **1 913/1 913**, builds/typechecks/lint/diff checks verts. Test UI ajouté reproduisant d’abord le défaut sur la CSS initiale, puis GameHeader **20/20 PASS**. Rendu du vrai GameShell avec CSS de production et données synthétiques, réseau distant bloqué : 1920×1080, 1366×768, 2560×1440 et 390×844, trois états chacun ; 12 scénarios PASS, focus/hover et lecture/suppression contrôlés, aucun overflow du panneau. Captures des douze panneaux et vues GameShell desktop/mobile inspectées ; cela ne vaut pas recette publique du propriétaire. **13/13 tests PostgreSQL privés PASS**, dont refus de Player/ID/backup/opérateur/ACK/révision incorrects, import absent, opérations engagées, autorité non OFF, autre canary et capacité inactive. Le cas ajouté d’autorité non OFF a d’abord échoué sur sa fixture sans ACK/date ; fixture corrigée selon la contrainte physique, puis 13/13 PASS sans modifier les protections produit ni les timeouts.

**Isolement et nettoyage avant apply :** 71 receipts strictement identiques (lignes complètes/SHA-256), zéro identité/target/import ciblés et toutes les lignes Players/TwitchIdentity/TwitchNativeTarget identiques à la préimage avant mutation. Les fixtures de rehearsal et tests du lot ont exécuté leur cleanup. Inventaire réel batch_test_* : un seul schéma vide historique, déjà présent dans les audits des lots 11/12 du 29/09, conservé hors périmètre ; aucun nouveau schéma résiduel du lot. Ne pas présenter cet inventaire comme zéro schéma privé global ni supprimer ce schéma ancien. Prisma migrate status public READ ONLY fraîchement exécuté : **62 migrations, schéma à jour** ; aucun SQL de migration appliqué. Plan CLI réel relancé sous READ ONLY : mêmes hashes, TWITCH_ONLY/ABSENT, blockers=[], shared=0.

**Gate opérateur désormais satisfait :** la configuration locale initiale n’avait ni allowlist ni capacité active ; l’opération avait été arrêtée avant toute mutation. Le propriétaire a ensuite fourni la valeur exacte existante de TWITCH_PILOT_PLAYER_IDS et confirmé TWITCH_COMMAND_PILOT_ENABLED=true après vérification Railway sans modification. Ces deux valeurs sont injectées seulement dans les processus locaux ; aucun fichier .env/Railway modifié, aucun UUID opérateur publié. requireOperator accepte l’unique opérateur existant : Player ACTIVE, ADMIN actif et identité opérateur conforme ; capacité active, autorité OFF/zéro canary. Aucune allowlist inventée ni invariant affaibli.

**Promotion et déploiement contrôlés :** chaîne 281d355 → `3ef89c6fa0f2de6c086ca57bbb63fdbd120690da` → `081ab57a03f1d86a78e3c6d90bf427f8949474a4`, diff GitHub exact limité UI/CLI/tests/docs, main avancé par fast-forward strict/push normal, refs distantes communes et divergence 0/0, retour sur review. Railway : SHA 081ab57, déploiement `5da4ee3c-d426-4213-b994-0ca33585c31e` SUCCESS, healthcheck Railway réussi puis GET /health public HTTP 200/status ok avant apply. Aucun statut Cloudflare renvoyé par le combined status GitHub ; déploiement frontend/public UI non revendiqué. Le CLI local est exécuté depuis ce SHA technique exact ; le checkpoint suivant modifie uniquement les trois sources de statut et peut être promu dans cette même mission.

**Apply public réel :** CLI existant migration:legacy:canary:apply exécuté pour le seul ID Helix privé Kichni_Test, expected ABSENT, hashes exacts et ACK STREAMERBOT_PATH_DISABLED, opérateur ADMIN vérifié. Résultat **DATA_IMPORTED**, backup local durable fsync avant première écriture métier ; hash **`3dbfc6782a4c0a8fac5fd20132eab85fc7fe2084527ace463d94bec9c15a5227`**. Checksum complet, graphe/préimage vide/public, target initiale absente, identité et hashes snapshot/rapport reliés au journal vérifiés. Le fichier réel reste dans local-data/identity-resolutions, ignoré, aucun contenu privé publié.

**Vérification avant transfert puis après :** comparaison READ ONLY via compareLegacyPersonalState de l’ensemble du mapping personnel PASS ; GEO (clé canonique geo), XP 32/niveau dérivé 1, Primogemmes 2 240, Moras 16 863, particules 0, Box/Team vides, pity 5★/4★ 1/1 et garantie false. Player ACTIVE, exactement une identité numérique conforme, WebIdentity 0 ; journal DATA_IMPORTED avec provenance exacte. Avant transfert target LEGACY/non-canary et contrôle OFF ; après transfert même Player/ID, target NATIVE/canary, ACK/date présents, desired CANARY/révision 2 et exactement un audit AUTHORITY_TRANSFERRED. CLI local validé utilisé, pas de SQL métier manuel. **Un Player, une TwitchIdentity et une target créés** ; toutes les autres lignes de ces tables strictement identiques aux empreintes préapply, aucune autre dataAuthority changée, aucune autre canary. Les 71 receipts restent strictement identiques après transfert. Aucun autre joueur, 43/batch, 171/quarantaine, compte Web ou GLOBAL traité.

**Transport et STOP :** statut de l’owner runtime local : desiredAuthority CANARY, effectiveAuthority OFF, transportValid=false. La configuration EventSub locale n’a ni activation, secret ni callback ; ce résultat local ne prouve pas effective OFF sur Railway. Lecture Helix des subscriptions existantes uniquement : une channel.chat.message enabled, version/receiver/broadcaster exacts pour l’opérateur et callback de production conforme, aucun conflit live. Cela prouve le transport externe existant actif, sans lire le statut effectif du runtime Railway. Pas de session opérateur authentifiée/navigateur connecté disponible pour GET /api/v1/me/twitch ; aucun accès/secret inventé ni configuration de substitution. **Gate restant : lecture du statut runtime déployé ; idéal CANARY/CANARY/true avant smoke test propriétaire.** Si son transport est invalide, conserver effective OFF et STOP sans changer OAuth/EventSub. Aucune vraie commande Twitch envoyée par Codex, aucun test R1055/R1046 ni annonce standalone.

**Rollback disponible, non exécuté :** backup durable/provenance vérifiés, chemin privé conservé dans les preuves locales ; procédure et CLI au [guide](../process/twitch-native-foundations.md#rollback-ciblé). Exige autorité OFF, retour explicite LEGACY par l’owner, backupHash et Player exacts, absence d’opérations/outbound incertains. Aucun rollback d’un import conforme. Streamer.bot reste OFF ; ne pas le relancer ni reprendre une population globale. Après statut runtime valide seulement, STOP pour le smoke test manuel du propriétaire.

## Historique — promotion pré-cutover Kichni_Test, 06/10/2026

**Approbation et chaîne :** review indépendante ChatGPT APPROUVÉE, aucun finding bloquant restant. Baseline fetch vérifiée : main/origin main = `0de60e9ee3db2022ac5aeea0e61087ca0cd32ac7`, review/origin review/HEAD = `a3eb8c254896c3619728e4495282bb6e0ec7170b`, ahead 3/behind 0, index/worktree propres. Chaîne exacte : 0de60e9 → `47c08a518347c16cffc3a82142f44a7a7fc064ce` → `7a315ed786ac5caa41ae8484dc9e5f09bb694789` → a3eb8c2. Ces trois commits constituent ensemble le candidat approuvé ; un seul checkpoint Markdown de statut les accompagne, sans modification de code/migration ni nouvelle Rxxx. Promotion par fast-forward strict et push normal, sans squash/rebase/force-push ; mêmes contenus fonctionnels sur main et review, reprise sur review.

**État acquis :** Notifications avec deux actions empilées toujours visibles/disabled, CTA élément cursor not-allowed et phrase rename retirée ; owner commun des opérations en cours, observations passives non bloquantes et véritables opérations natives toujours protégées ; six champs tradeRequests explicitement dropped et futur champ inconnu bloquant. Préflight Kichni_Test **PASS approuvé**, TWITCH_ONLY/ABSENT, blockers=[], shared facts=0, Helix VERIFIED lors du préflight, deux rehearsals privés PASS et rollback exact. `!concours` avec ou sans arguments répond exactement **🏆 Concours : prochainement disponible.**, sans ContestService ; aide neutre et deux directives Event neutralisées. Aucun Player public migré, apply public, target ou autorité CANARY/NATIVE/GLOBAL activée ; aucun receipt public modifié, snapshot/rapports de préflight conservés et non relancés. Streamer.bot reste ON/autoritatif.

**Contrôles de promotion :** preuves approuvées conservées : 20 tests PostgreSQL privés receipts/canary, backend 1 900 PASS sur 7a315ed puis 1 904 PASS sur a3eb8c2, 282 tests ciblés anti-spoiler, verify:quick 5/5 et build/typecheck/lint PASS. Timeouts sous charge et reprises PASS documentés dans les historiques ci-dessous, non bloquants selon la review. Aucun code ne change : pas de nouvelle campagne de tests/DB/Helix ; contrôles limités au diff Markdown, destinations documentaires, fichiers indexés, chaîne/ancestry et refs Git. Aucune nouvelle migration DB ajoutée par le candidat. Le push main déclenche seulement le déploiement normal ; aucune action manuelle Railway/env/OAuth/EventSub/DB/Players/autorité/Streamer.bot, aucune preuve de déploiement ou healthcheck présumée.

**Prochaine action :** STOP après promotion technique et retour sur review. ChatGPT vérifie Railway/Cloudflare et le healthcheck du SHA promu, puis fournit la courte recette publique du micro-polish/anti-spoiler. Après ces contrôles, mission distincte pour guider la fenêtre de cutover réel Kichni_Test avec **NOUVEAU snapshot frais**, Helix/plan et autorisation propriétaire avant tout apply ciblé puis transfert séparé. Kichni_Test reste non migré ; la capture actuelle est uniquement celle du préflight, jamais la capture finale de cutover. Aucun batch ni révélation publique du standalone autorisé ici.

## Historique — anti-spoiler Concours approuvé avant cutover Kichni_Test, 06/10/2026

**Approbation et baseline :** review indépendante ChatGPT de `7a315ed786ac5caa41ae8484dc9e5f09bb694789` APPROUVÉE ; préflight Kichni_Test PASS (TWITCH_ONLY/ABSENT, zéro blocker/fait partagé, Helix VERIFIED, répétitions privées et rollback exact). Fetch : HEAD/review/origin review = 7a315ed, main/origin main = `0de60e9ee3db2022ac5aeea0e61087ca0cd32ac7`, review ahead 2/behind 0, index/worktree propres. Mission limitée à un correctif anti-spoiler séparé ; aucune promotion ni nouvelle Rxxx.

**Réponse temporaire :** toute invocation de `!concours`, active/absente ou avec arguments, retourne exactement **🏆 Concours : prochainement disponible.** Aucun appel ContestService, thème, participation, interface, emplacement ou URL révélé. L’aide `!help concours` est neutralisée aussi. Audit court des sorties de commandes/chat et transports Twitch : deux autres directives d’interface dans le résumé `!event` neutralisées sans modifier ses actions ni données (calendrier non réclamable « indisponible actuellement », « N message(s) à lire »). Aucun autre lien/directive de commande joueur vers le standalone trouvé ; occurrences internes de transport, déploiement, OAuth, CORS et infrastructure conservées. [Contrat de commande](../commands/command-reference.md#concours) : vrai accès à réintroduire uniquement à la révélation publique explicitement autorisée.

**Validation du correctif :** tests ajoutés d’abord sur le code initial : fuites reproduites. **282 tests ciblés PASS / cinq fichiers** (owner recipe, dispatcher, registry/Help, post-recette Event, couverture Twitch) : actif/absent et arguments neutres, zéro appel ContestService, aucune mutation préparée, aide et Event sans URL/directive d’interface. **3 tests Help frontend PASS**, **verify:quick 5/5 PASS** (typechecks frontend/backend, lint et diff checks), **build backend PASS**, **suite backend hors DB 1 904/1 904 PASS / 127 fichiers**. Le premier run backend, en parallèle du build, avait 1 903 PASS et un timeout 5 s du scan de rapports historiques ; ce fichier passe ensuite isolément 34/34, puis la suite entière passe sans compilation concurrente, sans changement de code ni timeout. 147 destinations de liens locaux vérifiées dans les deux documents, aucune manquante. verify:full/frontend complet et contrôles DB/visuels non relancés pour ce correctif textuel ; aucun changement de layout ni des timeouts Chat/MP. Préflight et PostgreSQL non relancés : aucun fichier migration/tooling, snapshot, rapport Helix, receipt, cible ou autorité modifié ; les preuves approuvées de 7a315ed sont conservées, sans les présenter comme une nouvelle vérification publique.

**Prochaine action :** STOP pour review indépendante ChatGPT du vrai commit publié, push review uniquement, main inchangé. Kichni_Test toujours non migré ; préflight PASS approuvé, aucun apply public ni autorité activée, Streamer.bot reste ON/autoritatif. Après approbation et gates de promotion/déploiement requis : mission distincte de cutover réel dans une fenêtre contrôlée avec **NOUVEAU snapshot frais**, Helix/plan et autorisation propriétaire ; jamais le snapshot actuel de préflight comme capture finale. Aucune modification infra/env/OAuth/EventSub/donnée publique dans ce mini-correctif.

## Historique — correction approuvée des deux faux blockers et préflight Kichni_Test PASS, 06/10/2026

**Approbation et baseline :** review indépendante ChatGPT de `47c08a518347c16cffc3a82142f44a7a7fc064ce` terminée : micro-polish UI, données Kichni_Test, Helix et répétitions privées approuvés ; aucun problème Player identifié. Les deux blockers provenaient du tooling, sans valider un cutover. Fetch initial : HEAD/review/origin review = 47c08a5, main/origin main = `0de60e9ee3db2022ac5aeea0e61087ca0cd32ac7`, review ahead 1/behind 0, worktree/index propres. Correction dédiée directement au-dessus de 47c08a5, push review seulement ; aucune promotion, nouvelle Rxxx ou réouverture UI.

**Receipts :** assessTwitchOperationsInFlight est l'owner de lecture commun à assertCanaryIdle (plan, revalidation apply, restauration canary) et relinquishForRollback. Chat brut RECEIVED, processedAt null, externalReference null, sans commandPilot/messageActivity ni outbound incertain → observation passive non bloquante. CommandPilot présent avec RECEIVED ou stage EXECUTING, réservation message-native non terminale, réponse SENDING/AMBIGUOUS et BusinessOperation PENDING du Player restent bloquants. Autres événements/références RECEIVED restent protégés, marqueur natif malformé non exempté ; FAILED/PROCESSED sains restent terminaux, sans lever EXECUTING/outbound incertain. OFF, provenance DATA_IMPORTED/backupHash et verrous existants conservés. Aucune purge, clôture ou modification de receipt public. Le précédent garde interprétait trop largement 71 observations passives comme opérations en cours ; ce n'étaient pas 71 opérations engagées.

**Couverture :** six enfants explicites de tradeRequests (amount, createdAt, myElement, otherElement, otherUser, type) ajoutés INTENTIONALLY_DROPPED, conformément à Echanger.txt et au [contrat legacy existant](../legacy/02-current-player-model.md#traderequests). Demandes ouvertes et réservations temporaires ne sont pas migrées ; seuls les soldes réels suivent leurs owners. Aucun wildcard supplémentaire : futureUnexpectedField reste UNKNOWN et UNKNOWN_SOURCE_PATH/BLOCKER dans le plan global.

**Préflight réel relancé :** même dossier ignoré `local-data/streamerbot-snapshots/preflight-kichni-test-2026-10-06`, 17/17 + manifest/tailles/SHA-256 validés par les owners ; hash inchangé `d3ee8d88582300ca6006fb85afe0801bea7c866bcce7b05ff444edd39590baf0`, aucune lecture live ni modification du snapshot. Couverture **29 918/29 918, unknown = 0**. migration:legacy:analyze en mode existant --fixture-identities : code 0, diagnostic ISOLATED_FIXTURE seulement, aucune identité réelle globale vérifiée ou population autorisée par ce flag. Le mode sans identités conserve son code 2 attendu pour 46 TWITCH_IDENTITY_UNRESOLVED du plan global diagnostique ; ses deux autres classes restent une quarantaine C6 spécialisée et un warning de réparation Box C6. Cela ne bloque pas le canary à identité réelle ni ne certifie les 43/futur batch. Script analyze et sémantique de sortie inchangés, aucun blocker masqué.

**Cible réelle :** nouvelle résolution Helix CANARY --canary-login Kichni_Test uniquement : VERIFIED, un utilisateur, zéro missing/conflit/doublon, rapport frais lié au même snapshot et protection historique d'ID conservée ; ID privé non publié. Lecture publique imposée READ ONLY par ID vérifié : aucune TwitchIdentity/target/Player rattaché/WebIdentity. Les **71 receipts** sont tous channel.chat.message/RECEIVED/processedAt null/externalReference null, sans commandPilot ni réservation native ; assessment blocked=false/unresolvedOutbound=false. Plan public local READ ONLY : **TWITCH_ONLY, expected Player ABSENT, blockers=[], shared/deferred facts=0**. Faits personnels et audit des 17 sources approuvés au checkpoint précédent conservés : GEO, XP 32/niveau 1, 2 240 Primogemmes/16 863 Moras, Box/équipe vides, pity 1/1, quinze domaines personnels. Aucun autre compte résolu/importé, aucun auto-ajout aux 43. Prisma migrate status public READ ONLY PASS : 62 migrations appliquées ; aucune application SQL publique ni preuve de déploiement/healthcheck déduite.

**Rehearsal :** nouveau rapport réel frais et même snapshot, CLI migration:legacy:canary:rehearse exclusivement privé : **TWITCH_ONLY PASS et EXISTING_VERIFIED_TWITCH PASS**, zéro blocker privé, comparaison des faits personnels par l'owner, préimage privée et rollback EXACT_PREIMAGE. Aucune mutation/backup public. Les backups persistés du précédent préflight restent preuves privées historiques, jamais sauvegarde d'un futur cutover ; la nouvelle fenêtre exigera sa propre préimage fraîche.

**Validation :** 93 tests ciblés hors DB PASS / quatre fichiers (couverture, isolation, command pilot, rétention). 11 nouveaux tests PostgreSQL privés PASS : 71 observations traversent plan/import/retour d'autorité/restauration sans modification, commandes EXECUTING et RESPONSES/PENDING, réservation native, SENDING/AMBIGUOUS même terminal, non-chat reçu, états terminal sains, revalidation apply d'un plan devenu obsolète sans backup/mutation, BusinessOperation PENDING, OFF/provenance et rollback partagé. Régression canary existante : 9 PASS, soit **20 tests PostgreSQL privés PASS**, exécutés fichier par fichier ; schémas créés puis nettoyés. **verify:full standard : 7/8**, seul le timeout historique ChatPanel « keeps a new older page visible when the bounded history window is full » (15 000 ms) réapparaît sous charge : frontend 1 347 PASS / 1 timeout, MP PASS. ChatPanel isolé sur le même candidat : **65/65 PASS**. Backend hors DB **1 900/1 900 PASS** ; builds frontend/backend, typechecks frontend/backend, lint et diff checks PASS. Aucun code/style/test Chat/MP/UI ni timeout modifié, aucune nouvelle validation visuelle revendiquée. Vérification finale publique READ ONLY : **71 lignes de receipts strictement identiques avant/après** (comparaison complète et SHA-256), zéro identité/target ; snapshot inchangé et rapport Helix encore frais. 163 destinations de liens locaux contrôlées dans les quatre documents modifiés, aucune manquante.

**Prochaine action :** STOP pour nouvelle review indépendante ChatGPT du vrai commit publié. Après approbation et les contrôles de promotion/déploiement requis, mission propriétaire distincte de cutover réel Kichni_Test : arrêt Streamer.bot dans sa fenêtre contrôlée → **nouveau snapshot frais** → Helix/revalidation ID → plan → autorisation propriétaire → apply public ciblé LEGACY/DATA_IMPORTED → vérification → transfert canary séparé → recette Twitch réelle, rollback disponible. Aucun apply/rollback public, Player/target public créé, authority CANARY/NATIVE/GLOBAL activée, receipt public modifié, changement Streamer.bot/Railway/env/OAuth/EventSub dans cette correction. Streamer.bot reste ON/autoritatif et la photo présente est uniquement un snapshot de préflight, non final pour cutover ou batch global.

## Historique — préflight initial bloqué par le tooling et micro-polish UI, 06/10/2026

**Baseline et périmètre :** fetch exécuté ; HEAD/local review/origin review/main/origin main = `0de60e9ee3db2022ac5aeea0e61087ca0cd32ac7`, divergence 0/0 et worktree/index propres. Mission explicitement limitée au préflight et à trois retours UI validés ; un commit dédié review, main inchangé, aucune nouvelle décision Rxxx ni modification de migration/backend opérateur. STOP pour review indépendante du vrai commit publié.

**Snapshot réellement contrôlé :** dossier ignoré `local-data/streamerbot-snapshots/preflight-kichni-test-2026-10-06`, fourni par le propriétaire après arrêt/copie/reprise Streamer.bot. Photo globale figée de préflight, jamais snapshot final global. Owners loadLocalOperatorSnapshot → loadLegacySnapshotDirectory → parseStreamerbotSnapshot : exactement 17/17 JSON + manifest, tailles/SHA-256 valides, fichiers ignorés sans liens, hash `d3ee8d88582300ca6006fb85afe0801bea7c866bcce7b05ff444edd39590baf0`. Aucun fichier source modifié ni dossier live lu. migration:legacy:analyze exécuté, code 2 : 29 882/29 918 observations classées ; six chemins inconnus `*.tradeRequests[].{amount,createdAt,myElement,otherElement,otherUser,type}` sur 36 observations. 217 profils/46 avec élément/171 sans élément sont des compteurs diagnostiques, aucune population sélectionnée/importée et aucun changement aux 43 historiques/deux quarantaines. Les 46 identités non résolues du diagnostic global ne sont pas un échec de la résolution canary.

**Cible et identité :** Kichni_Test trouvé exactement sous la clé source `kichni_test` ; normalisation existante, canary séparé des 43. Résolution Helix réelle fraîche, scope explicite --canary-login Kichni_Test : VERIFIED, un utilisateur, zéro missing/conflit/doublon ; rapport validé frais et lié au même hash, protections historiques rename/login recyclé conservées. ID immuable utilisé uniquement dans les preuves locales privées et requêtes numériques, jamais publié. Lecture publique imposée READ ONLY : aucune TwitchIdentity, TwitchNativeTarget, aucun Player rattaché ni WebIdentity pour cet ID ; aucun rattachement par pseudo. Autorité effective legacy/Streamer.bot, aucune ligne target à interpréter comme NATIVE. Prisma migrate status public READ ONLY PASS : 62/62 appliquées, aucune application manuelle ; cela ne prouve ni SHA Railway/Cloudflare ni healthcheck.

**Faits personnels et audit global :** niveau legacy 1, XP 32, GEO ; 2 240 Primogemmes, 16 863 Moras, sept soldes de particules à zéro ; Box et équipe source vides, pity 4★/5★ = 1/1, garantie vedette false. Stats : 71 messages, 32 comptés, un pull, un spin/jackpot ; zéro demande trade et code utilisé. Les 17 sources ont été parcourues pour clés/valeurs normalisées, y compris identifiants composites : seulement la clé viewer et son username, aucune autre référence à ce canary dans friendships/demandes, C6 spécialisé, Concours, combat/boss, Event, Giveaway, Gift/Codes, votes ou autres sources supportées. Plan : 15 domaines personnels reconnus (Progression, Ressources, Banque, Gacha/pity, Personnages/constellations, Teams, Missions, Roue/Quotidiennes, Expédition, Combat, Collection/objets, stats économie/social, Faveur, Concours/C6 personnel, cosmétiques). Domaines partagés restent différés par contrat ; aucun fait partagé détecté pour cette cible, deferred total 0. Aucun lien global inventé.

**Plan public :** migration:legacy:canary:plan exécuté sur snapshot/rapport exacts, connexion default_transaction_read_only=on, mode TWITCH_ONLY, expected Player ABSENT. Retour CLI 0 mais blocker métier **CANARY_OPERATIONS_IN_FLIGHT** : 71 TwitchEventReceipts de cet ID en RECEIVED, aucun stage EXECUTING, aucune réponse SENDING/AMBIGUOUS. Leur présence ne prouve pas à elle seule 71 opérations réellement exécutées ; le garde existant les bloque. Aucun receipt modifié/clos/rejoué et aucun contournement. Le préflight global reste **BLOQUÉ**, par ce garde public et la couverture inconnue ; aucune sûreté d'apply public proclamée. Un simple futur import conserverait dataAuthority LEGACY et journal DATA_IMPORTED, transfert d'autorité séparé.

**Répétitions privées :** migration:legacy:canary:rehearse sur les mêmes preuves : TWITCH_ONLY PASS (scénario pertinent) et EXISTING_VERIFIED_TWITCH PASS (robustesse), zéro blocker privé. Import/compareLegacyPersonalState exact des faits sûrs, y compris XP 32/niveau dérivé 1/élément GEO/ressources/Box/pity/Teams/stats et domaines applicables ; 14 WARNING PERSONAL_MAPPING_ANOMALY documentés : 13 chaînes/missions Z absentes restent verrouillées, une absence de Saved Teams donne les positions initiales vides, aucun fait de complétion inventé ; TwitchIdentity sur le bon Player privé, zéro WebIdentity créée en TWITCH_ONLY, WebIdentity synthétique préexistante conservée dans l'autre scénario. Le CLI standard garde la préimage en mémoire ; une instrumentation locale ignorée du même CLI/owners a également écrit deux backups privés sur disque avant la première mutation privée d’import, capturé l'import puis vérifié hash préimage = hash après rollback exact. Schémas batch_test privés créés puis supprimés ; contrôle final zéro des deux schémas instrumentés restants. Rapports détaillés/identités/receipts/backups exclusivement dans local-data ignoré (preuves non identitaires regroupées dans identity-resolutions/preflight-kichni-test-2026-10-06/). Aucune mutation ni backup public.

**Micro-polish :** Notifications : colonne droite, « Tout marquer comme lu » puis « Tout supprimer », mêmes dimensions/style AppButton, toujours visibles ; vide = deux disabled, READ seulement = lecture disabled/suppression active, UNREAD = deux actifs. Archive bulk serveur et neutralisation du polling périmé conservées. Sans choix élément, CTA disabled avec cursor not-allowed ; cursor wait réservé à la soumission effective, comportement métier intact. Compte lié : phrase « Un changement de pseudo Twitch conserve cette liaison. » supprimée sans remplacement ; ID numérique et absence d'unlink self-service inchangés.

**Contrôles locaux :** 111 tests UI ciblés PASS ; 24 captures inspectées, 20 scénarios et interactions dans vrai GameShell/CSS globaux et écran élément à 1920×1080, 1366×768, 2560×1440 et 390×844, états bulk/hover/focus/disabled, lecture puis archive, sélection élément et compte lié : zéro erreur JavaScript/débordement horizontal. Validation technique locale uniquement, aucune recette propriétaire/OAuth réel présumée. verify:full standard final **7/8** : 1 899 tests backend non-DB PASS / 127 fichiers, builds/typechecks/lint et diff-checks PASS, frontend en échec sur timeout ChatPanel historique plein et TTL réel 120 ms DirectMessagePanel. Les suites ChatPanel/Expedition et scan historique passent isolément ; suite frontend complète relancée avec --maxWorkers=2 : **1 348 tests / 125 fichiers PASS**, sans changer code/tests Chat/MP ni augmenter les délais. La différence de charge/concurrence explique plausiblement la sensibilité observée, sans annoncer la commande standard PASS. Premier passage : trois timeouts et fixture UI incomplète au typecheck ; fixture corrigée. Après classement des preuves non identitaires hors racine du scanner historique, ce test backend de scan passe aussi dans la suite complète. 150 destinations documentaires locales valides (sans contrôle des ancres). Logs TEMP kichni-preflight-* et dossiers verify:full, preuves privées local-data ignorées.

**Prochaine action :** STOP pour review indépendante ChatGPT du candidat et des deux findings préflight ; analyser le traitement autorisé des receipts RECEIVED et les six chemins de trade, sans les corriger ni les ignorer dans cette mission. Aucun apply/rollback public, Player réel migré, target réelle créée, mode CANARY/GLOBAL/NATIVE activé, changement Streamer.bot/Railway/env/OAuth/EventSub. Streamer.bot reste ON et autoritatif. Seulement après correction/revalidation et préflight PASS, mission propriétaire distincte : arrêt Streamer.bot → nouveau snapshot frais → résolution/revalidation numérique → nouveau plan → autorisation propriétaire → apply public ciblé → contrôle LEGACY/DATA_IMPORTED → transfert canary séparé → recette Twitch réelle, rollback prêt. Rien de cette fenêtre n'est exécuté ici.

## Historique — promotion approuvée R1055 et correction, 06/10/2026

**Approbation et baseline :** review indépendante ChatGPT du vrai GitHub terminée, verdict APPROUVÉ sans finding bloquant. Fetch exécuté, main/origin main initial = `0fd241310f09758d1d7e6dcafbf71c1376f0bdd3`, HEAD/local review/origin review initial = `897db93c6f6331d55ddbbf5f76053e2400e10a7e`. Chaîne exacte 0fd2413 → 0c865b4 → 897db93, review ahead 2/behind 0, worktree/index propres. Les deux commits constituent ensemble le candidat approuvé.

**Promotion :** un seul petit checkpoint Markdown de statut sur review, puis fast-forward strict de main vers ce même HEAD et push normal, sans squash/rebase/force-push. Le rapport final porte le SHA promu et la vérification distante origin/main == origin/review, divergence 0/0, ancestry conservée et worktree/index propres ; branche de travail revenue sur review. Code de 0c865b4 + 897db93, schéma Prisma, 062 et migrations antérieures inchangés ; aucune nouvelle décision Rxxx.

**Contrôles :** preuves du candidat ci-dessous conservées : verify:full 8/8, 1 345 tests frontend, 1 899 backend hors DB, 31 PostgreSQL privés, Prisma/RLS et captures desktop/mobile. Seul le Markdown est modifié pour cette promotion : contrôles du diff/index, destinations documentaires locales et périmètre exact ; aucune nouvelle campagne produit ni réussite de déploiement prétendue.

**Infrastructure et données :** le push main déclenche uniquement le déploiement normal et son mécanisme habituel de migration. 062 était non appliquée lors du dernier contrôle public du candidat ; son application reste à vérifier après déploiement via le registre Prisma et migrate status. Aucune application DB manuelle, aucun Player réel migré, aucune autorité CANARY/GLOBAL activée, aucun changement manuel Railway/env/OAuth/EventSub/Streamer.bot. Streamer.bot reste autoritatif. Kichni_Test n'est pas encore préparé par Codex ; aucun préflight, snapshot, import ou test canary exécuté.

**Prochaine action :** STOP pour ChatGPT : vérifier Railway et Cloudflare, le SHA déployé, l'application de 062 et le healthcheck ; fournir ensuite la courte recette publique UX R1055. Après ces vérifications et cette recette seulement, préparer le préflight Kichni_Test selon le [guide](../process/twitch-native-foundations.md) et le [runbook](../process/legacy-cutover-runbook.md), dans une mission distincte. Aucune préparation canary automatique à la suite de cette promotion.

## Historique — correction de review de 0c865b4, 06/10/2026

**Baseline :** fetch et état propre initiaux vérifiés ; HEAD/local review/origin review = `0c865b468c770bdc7bd2bd074d0b26c6998da7f6`, main/origin main = `0fd241310f09758d1d7e6dcafbf71c1376f0bdd3`, review ahead 1/behind 0. Correction dédiée directement au-dessus de 0c865b4 ; aucune promotion ni réécriture du lot approuvé.

**Sûreté relationnelle :** primitive assessPlayerCanonicalizationSafety réutilisant metadata FK/identifiants/domaines personnels de targeted-player-rows ; graphe personnel exhaustif et références entrantes/sortantes, sans capture des autres Players. OWNED_PERSONAL / SAFE_HISTORICAL / SHARED_ACTIVE ; relation active/ambiguë/inconnue → OPERATOR_REQUIRED. WEB inspecte le futur perdant Twitch, TWITCH le perdant Web. Amitiés/demandes/cœurs/blocages, MP, social Event, trade/invitations, activités/classements vivants et opérateurs/credentials bloquent le choix concerné ; l’autre choix SAFE reste possible. Les deux unsafe exigent un opérateur. Aucune identité/statut/relation déplacés sur refus, aucun merge relationnel ; archive personnelle/audit conservés sur succès. UI : boutons disabled et raisons privées, mêmes libellés et comparatif.

**Preuve exhaustive :** compared_state existant contient version 1, presentation, fingerprints SHA-256 serveur, safety par choix et revision opaque. Projection canonique de tous les domaines personnels, descendant FK, int8 conservés sans arrondi JS, tables/lignes/signatures/evidence triées ; ni graphe brut ni secret persisté/exposé. Résumé UI distinct, sessions/OAuth/lectures techniques exclus. pending et resolve recalculent sous les verrous ; changement visible ou invisible → nouveau snapshot, resolutionRequired=true, aucune canonicalisation. Checkbox false et decisionRevision obligatoire lient le consentement à la comparaison affichée, y compris entre onglets. Replay terminal identique/opposé et contrôles identité/autorité existants conservés. 062 et schéma Prisma inchangés.

**Contrôles :** verify:full final PASS 8/8, 1 345 tests frontend / 124 fichiers et 1 899 backend hors DB / 127 fichiers ; builds, typechecks, lint et diff-checks. Ciblés frontend 118 et routes backend 20 PASS ; Prisma generate/validate et scripts opérateur typecheck PASS. 31 tests PostgreSQL privés PASS / deux fichiers : 30 liaison/shared-state/fingerprint/concurrence/provenance/purge, plus le test DDL/RLS. Amitiés des deux perdants et deux unsafe, conversation/demande MP, social/trade/Arcade pending, Teams/Missions/pity invisibles, résumé visible, consentement périmé entre onglets, bigint sans changement de timestamp, FK futures directes/descendantes/nouvelle colonne cross-player, Boss actif/historique terminé, Native winner/provenance reconnus par la projection du futur batch. Fixtures trade/session/Boss corrigées après violations CHECK lors des premiers essais ; résultats finaux verts. Logs TEMP twitch-canonical-* et gachaimpact-verify-full-VayU9q. Test DDL privé PASS : 62 migrations réellement déployées et enregistrées, migrate status à jour, RLS sur 062/no browser grants, aucune autorité configurée. 20 captures inspectées avec CSS de production/GameShell sur 1920×1080, 1366×768, 2560×1440 et 390×844, choix SAFE/asymétriques/deux unsafe/reconfirmation ; interactions et checkbox reset vérifiés, zéro erreur JS/débordement horizontal. Harness local arrêté ; aucun OAuth réel ni recette propriétaire prétendus.

**Sources et données :** R1055 précisée, aucune nouvelle Rxxx. Architecture backend/migration/schéma, modèle V1, navigation, administration, guide native et ce Master actualisés ; autres domaines du lot approuvé inchangés. Lecture seule Prisma publique exécutée : 62 dossiers, seule 062 pending. Aucune application publique, donnée/Player réel/Kichni_Test, activation native, Railway/env/OAuth/EventSub ni main modifiés. Fixtures PostgreSQL exclusivement privées/synthétiques, nettoyées après contrôle.

**Sortie et reprise :** commit correction review uniquement, SHA exact dans le rapport Git ; état de sortie contrôlé après push : review ahead 2/behind 0, main inchangé et worktree/index propres. STOP pour nouvelle review indépendante ChatGPT. Promotion/application publique 062/déploiement et canary exigent une mission ultérieure explicitement autorisée.

## Historique — UI/UX avant canary et liaison unifiée R1055, 06/10/2026

**Baseline vérifiée :** fetch initial, HEAD/local review/origin review/origin main = `0fd241310f09758d1d7e6dcafbf71c1376f0bdd3`, ahead 0/behind 0, worktree/index propres. Mission bornée A–E : notifications, Configuration, écran élément, liaison Twitch et sources canoniques ; publication d’un seul commit review, sans promotion main.

**Produit livré en candidat :** Notifications affiche « Tout supprimer » seulement si la liste est non vide ; archive bulk serveur des UNREAD/READ du Player, payload métier conservé, liste/badge actualisés et polling périmé ignoré. Configuration conserve Menu/Confidentialité/Compte et retire Apparence. Avant le choix permanent d’élément : aide espacée, récupération via Compte et Déconnexion pour l’authentifié ; visiteurs inchangés. [R1055](../specifications/decisions-log.md) : « Lier mon compte Twitch », quatre issues après preuve OAuth serveur ; aucun Twitch connu → web conservé, web disposable → même Player Twitch via R1046, même Player → idempotent, deux Players significatifs compatibles → résumé et choix explicite Web/Twitch. Gagnant entier + identité déplacée ; perdant ARCHIVED conservé uniquement en interne, sans fusion/bascule/unlink UI. Protections opérateur, identités tierces, migration/activités en cours maintenues.

**Persistance et limites :** nouvelle migration additive `20261006180000_062_add_twitch_link_resolutions`, anciennes 001–061 inchangées. Preuves/comparaison/choix dans table privée, RLS/no browser grants ; transactions SERIALIZABLE, verrou commun Twitch et Players triés, revalidation du consentement et idempotence. Purge future protège les deux graphes audités ; projection opérateur conserve la provenance d’un choix Web native. Lecture seule Prisma publique du lot : 62 dossiers, seule 062 non appliquée, 061 désormais enregistrée appliquée ; aucun contrôle de déploiement Railway/Cloudflare ni healthcheck réalisé ici. **062 doit être appliquée dans une future mission autorisée avant usage de ce nouveau code** ; aucune application publique dans cette mission.

**Contrôles du candidat :** **verify:full PASS 8/8**, 1 340 tests frontend / 124 fichiers et 1 899 backend hors DB / 127 fichiers, builds/typechecks/lint/diff-checks. **16 tests PostgreSQL privés PASS / deux fichiers** : 15 liaison/notifications/concurrence/archives/guards/contraintes d’audit sur les 62 migrations réellement déployées, plus un registre/migrate status et RLS des 62 migrations. DDL isolé PASS : 21 tables foundation, 29 colonnes provenance, sécurité vérifiée et 1 178 colonnes de parité. Prisma generate/validate et typecheck des scripts opérateur PASS ; typecheck backend recontrôlé après adaptation de la fixture. Deux anciennes attentes Apparence et deux défauts de whitespace corrigés après une première vérification complète échouée ; test CHECK initialement sans 062 physique échoué, fixture passée au véritable déploiement privé et 15 scénarios ensuite verts. 361 liens documentaires locaux valides. Logs TEMP twitch-ux-* et gachaimpact-verify-full-88EuSf ; fixtures PostgreSQL synthétiques privées créées/nettoyées, aucune fixture métier publique. 20 captures inspectées et interactions locales vérifiées, sans erreur JavaScript ni débordement horizontal, dans le vrai GameShell et des CSS globaux, écran élément et états compte/notifications sur 1920×1080, 1366×768, 2560×1440 et 390×844 ; cela ne vaut pas recette visuelle/gameplay propriétaire ni OAuth réel.

**Documentation et sortie :** décision R1055 ; Master, ordre, migration legacy, guide native, navigation, administration, architecture backend, modèle V1, schéma PostgreSQL et Notifications actualisés. Audits legacy, workflow/Guide/AGENTS, Story, roadmap macro et runbook inchangés : cette mission ne modifie ni la population ni la procédure de cutover. Le rapport Git porte le SHA exact ; main inchangé, review ahead 1/behind 0, worktree/index propres.

**Prochaine action :** STOP pour review indépendante ChatGPT du commit publié. Promotion/déploiement/application 062 et test propriétaire exigent une mission ultérieure. Ensuite seulement reprise des contrôles préalables et préparation canary Kichni_Test selon R1050 ; aucune préparation, import, recette ou autorité native réelle exécutés ici. L’historique de promotion ci-dessous ne commande plus la prochaine action.

## Historique — promotion approuvée R1048 et correction, 06/10/2026

**Approbation et baseline :** verdict indépendant ChatGPT du vrai GitHub reçu : APPROUVÉ, aucun finding bloquant restant sur les deux commits. Fetch exécuté, main initial = `908403bf59b7d39cf7b72be32dd6c84da659db36`, review initial = `b728d13b1ada93e127940a205803e2956c1daa00`, chaîne exacte 908403b → 97e05f4 → b728d13, ahead 2/behind 0 et worktree/index propres. Un seul checkpoint Markdown actualise le statut avant promotion ; aucun changement du code approuvé, de 061 ou des anciennes migrations, aucune nouvelle décision Rxxx.

**État de sortie :** R1048 et sa correction présents sur main par fast-forward strict du HEAD review incluant ce checkpoint documentaire, sans squash/rebase/force-push. Le rapport final porte le SHA commun et le contrôle distant main == review/divergence 0/0/worktree-index propres ; branche de travail revenue sur review. Les preuves automatisées de b728d13 ci-dessous restent acquises ; contrôles proportionnés du seul Markdown : diff-check, périmètre exact et liens locaux, sans relancer la campagne produit.

**Production et données :** le push main déclenche seulement les mécanismes normaux de déploiement du dépôt. Railway/Cloudflare, healthcheck et registre Prisma 061 restent à contrôler après déploiement par ChatGPT ; aucune réussite de déploiement ni application de 061 présumée. Aucune application manuelle DB, donnée publique modifiée, identité/OAuth/EventSub/bridge/autorité activés, changement manuel Railway/env/service ou chemin Streamer.bot touché. Aucun Player réel migré par ces lots ; Streamer.bot reste autoritatif.

**Prochaine action :** STOP pour les contrôles ChatGPT de déploiement, statut Prisma 061 et healthcheck. Après leur validation seulement, préparer le canary réel Kichni_Test, créé côté propriétaire mais non importé : snapshot frais des 17 fichiers, identité Twitch fraîchement vérifiée avec scope canary explicite, plan read-only puis rehearsal privée ; apply public ciblé uniquement après review/autorisation distinctes. Kichnifou puis Ceo viennent après validation de Kichni_Test, aucun batch global avant ces canaries. [Guide](../process/twitch-native-foundations.md), [runbook](../process/legacy-cutover-runbook.md). Cette séquence n'est pas exécutée dans la promotion.

## Historique — correction R1048 et fin de projet décidée, 06/10/2026

**Baseline vérifiée :** fetch initial exécuté ; HEAD/local review/origin review = `97e05f4f2cd107a5e025e920477189a826e3fbf5`, main = `908403bf59b7d39cf7b72be32dd6c84da659db36`, review ahead 1/behind 0, worktree/index propres. La review indépendante du vrai GitHub reçue dans la mission approuve conceptuellement l'architecture R1048 et exige deux corrections. Aucun travail parallèle Story n'est écrasé. Le présent lot reste un commit séparé directement au-dessus du candidat, review uniquement ; aucune promotion.

**Corrections réalisées :** un parser personnel strict distingue ABSENT_ELEMENT (propriété absente/null/chaîne vide) et LEGACY_ELEMENT_INVALID (valeur inconnue/typo), sans sentinel inventé. Lecture agrégée de la capture locale ignorée historique : les 171 absences sont des chaînes vides, aucune autre équivalence non choisie observée, aucun détail de Player publié. PlannedPlayer.elementKey/faits personnels sont ElementKey | null ; import/création/remplacement/comparaison conservent XP/messages/ressources/domaines certains à tout niveau, sans fabriquer de récompense exigeant un élément. Résolution canary par login explicite, résolution finale par document validé des 43 historiques ; filtre ancien renommé HISTORICAL_ELEMENT_REHEARSAL. Aucun 171/additionnel auto-résolu/importé. R1046 déplace toujours WebIdentity vers le même Player Twitch sans gate de niveau/élément ; un null ouvre ensuite le choix normal sans reset, un élément déjà choisi reste acquis. Unlink lit l'autorité DB avant consumer/subscription/identité et bloque l'opérateur/transport si désir différent de OFF ; kill séparé/auditable, erreur DB fail-closed. Aucune restriction ordinaire de déliaison élargie.

**R1048 conservé :** mêmes tables/DDL 061, autorité durable/kill/transport fail-closed, provisioning commun, receipts, OAuth CLAIM conservateur, backup/rollback, DATA_IMPORTED séparé du transfert NATIVE, protection des Native au futur batch. Les 60 anciennes migrations et 061 sont inchangées ; aucune application publique de 061, aucun nouveau schéma produit.

**Décisions durables [R1049–R1054](../specifications/decisions-log.md) :** Kichni_Test est déjà créé selon le propriétaire, Twitch-only niveau 1/élément choisi/petite activité legacy/aucun web, aucun ID privé consigné. Snapshot frais/vérification d'ID/import/recette restent à faire ; il n'entre pas automatiquement dans les 43, conservation après test à décider. Ordre 31A ciblé : Kichni_Test → Kichnifou refresh tant que LEGACY puis NATIVE/barrière → Ceo vraie standalone, OAuth vérifié/même Player-WebIdentity/remplacement volontaire sans fusion puis NATIVE. Puis rehearsal finale, 31B des membres encore LEGACY des 43 avec Native préservés, deux quarantaines et 171 discarded non migrés, transfert GLOBAL contrôlé. Les standalone hors population restent intacts.

**Cutover invisible puis révélation :** après transfert réel, le Player PostgreSQL Twitch-only est le compte de jeu NATIVE ; messages/commandes/Faveur/Gift/Giveaway natifs alimentent son état sans Streamer.bot autoritaire pour les domaines remplacés, sans OAuth individuel ni compte web imposé et sans annonce. Stabilisation SILENCIEUSE puis pré-release. Plus tard, web disposable → OAuth/R1046 → tout l'état du même Player, sans autre migration ; web significatif/conflit → opérateur, même Player → idempotent, aucun Player Twitch → liaison normale. [Runbook](../process/legacy-cutover-runbook.md), [guide](../process/twitch-native-foundations.md).

**Travaux pré-release décidés, non codés ici :** Character officiel annoncé à sortie ≤7 jours ou déjà sorti, job quotidien vers 00:00 Europe/Paris/catch-up, multi-source/configuration auditable/Réauditer les sources, données internes jamais inventées ; Mitya test exceptionnel hors fenêtre seulement sur autorisation/override ADMIN audité, aucun hardcode. Owner/catalogue commun automatique/upload ADMIN, Modération > Personnages Ajouter/Modifier en modale, audit DB/asset/fallbacks réel/filtre Assets manquants, notification ADMIN persistante avec ouverture directe de la fiche et champs à compléter. Profil Personnalisation : unlockedAt DTO futur, Nouveau temporaire/badge jaune superposé/ordre retrouvé à la revisite, date asc-desc/nom/recherche personnage Avatar. Configuration Apparence encore désactivée à retirer dans le futur lot UI. Tirage Event mensuel pondéré points>0/1 point=1 ticket/un gagnant/+1 Masterless Stella Fortuna, clôture à 00:00 Paris/catch-up/exactly-once/résultat par édition et notifications gagnant+ADMIN transactionnelles ; ancien manuel cinq derniers jours et report monthlyDraw supersédés, aucun historique inventé. Passe graphique/ergonomie/mobile sans dégradation desktop, vraie bêta/corrections et sweep documentation/backlog avant révélation selon [gate R1054](../roadmap/implementation-order-v1.md).

**Contrôles exécutés :** **146 tests backend ciblés / cinq fichiers et 119 frontend/API / trois fichiers PASS**, incluant routes R1046, population fixe, nullable et unlink. **36 tests DB privés PASS / quatre fichiers : 25 Native/R1046 + neuf canary + un unlink + un registre/migrate status privé des 61 migrations**. Le premier canary enrichi avait quatre échecs de fixture après un état CANARY laissé par le test précédent : séquence OFF et IDs synthétiques indépendants corrigés, passe finale neuf canary/unlink verte. Deux erreurs de mock/libellé frontend corrigées ; aucun changement UI produit. Prisma generate/validate et typecheck dédié des cinq scripts opérateur PASS. **DDL isolé PASS : 20 tables foundation, 29 colonnes provenance, sécurité RLS/no browser grants vérifiée, 1 166 colonnes de parité**. **verify:full final PASS 8/8 : 1 334 tests frontend / 124 fichiers, 1 897 backend hors DB / 127 fichiers**, builds/typechecks/lint/diff-checks ; deux workers limités à la commande. Le test de protection du Player déjà NATIVE garde son élément DB et ignore même un élément personnel legacy invalide. Statut Prisma public contrôlé en lecture seule : seule 061 pending, code retour 1 attendu pour migration non appliquée ; aucune application publique. Les écritures/activations simulées DB restent dans les fixtures privées, nettoyées. Les preuves du candidat initial restent historiques ci-dessous ; aucune recette Twitch/OAuth/gameplay réelle revendiquée. Logs TEMP r1048-correction-*, détail final gachaimpact-verify-full-hO0UCI.

**Sources et sortie :** sweep des seize sources canoniques demandées, **392 liens locaux contrôlés, aucune cible absente**, aucun nouvel artefact d'encodage ; anciennes décisions conservées/supersédées. Arcade solo déjà réalisé remplace les formulations de mode XP standalone futur ; sélection dynamique et ordre terminal des anciennes consignes courantes corrigés. Checkpoint dédié directement au-dessus de 97e05f4, review uniquement, après vérification exacte du diff/index ; le rapport de publication porte le SHA distant, main inchangé et divergence attendue ahead 2/behind 0 avec worktree/index propres. Aucun Player public migré, autorité publique activée, cutover/31A/31B réel, changement Railway/env/Streamer.bot ou nouvelle table/scheduler/UI futur. Streamer.bot reste autoritatif ; STOP pour nouvelle review indépendante ChatGPT.

## Historique — fondations pré-cutover Twitch R1048/R1046, 06/10/2026

**Baseline :** fetch initial exécuté ; HEAD/local review/origin review/origin main = `908403bf59b7d39cf7b72be32dd6c84da659db36`, divergence 0/0 et worktree/index propres avant ce lot. Le déploiement exact Railway SUCCESS/Online/une replica/sans issue de ce checkpoint est une preuve fournie dans le prompt propriétaire, pas un nouveau contrôle Railway exécuté par Codex. Le [contrat R1048](../specifications/decisions-log.md#fondations-pré-cutover-twitch-et-population-finale--r1048-2026-10-06) porte les nouvelles décisions ; le [guide opérateur](../process/twitch-native-foundations.md) porte les procédures et garde-fous.

**Autorité et onboarding :** singleton PostgreSQL OFF/CANARY/GLOBAL, targets numériques pré-Player, audit opérateur et ACK durable `STREAMERBOT_PATH_DISABLED` ; hard-off de déploiement prioritaire et capability GLOBAL false par défaut. Le kill DB rend le prochain EventSub reçu après son commit inéligible avant parser/métier/outbound dans toutes les instances. Le désir survit au restart, mais l'effectif reste OFF jusqu'à revalidation ACTIVE broadcaster/receiver/subscription/callback ; App Access Token dynamique, aucun token utilisateur Runtime persisté. L'ACK est une déclaration externe de l'opérateur, pas une preuve d'arrêt de Streamer.bot. Provisioning Twitch-only atomique sous couverture NATIVE, même propriétaire de defaults que le web, sans WebIdentity ; premier message traité, receipts/concurrence, XP sans élément jusqu'au niveau 2, rappel !element idempotent et owner Element partagé. Les autres prérequis métier restent effectifs.

**R1046 :** action Configuration > Compte, accessible aussi avant le choix permanent d'élément. OAuth CLAIM distinct/authentifié, WebIdentity capturée et Twitch User ID vérifié cryptographiquement ; fonction centrale conservatrice disposable avec inspection des domaines/FK/colonnes physiques. Transaction à verrous Player triés : même WebIdentity déplacée, Player Twitch entier/ID préservés, seul temporaire vide supprimé. Compte significatif ou conflit bloque sans fusion ; token Supabase conservé et refresh frontend complet du vrai Player. Ceo significative exige un remplacement opérateur volontaire, pas R1046.

**Canary et batch :** CLI plan/rehearse/apply/rollback, fichiers opérateur ignorés stricts, cible ID/Player exacte, snapshot/report hashes, sauvegarde ciblée fsync avant écriture, analyse FK, mapper personnel commun et comparaison avant DATA_IMPORTED. Twitch-only sans WebIdentity ; web vérifié conserve identités/Auth/ID/nom/rôles/préférences hors gameplay/privacy. Globaux intacts et faits partagés agrégés différés, aucun ghost. DATA_IMPORTED ne transfère pas l'autorité ; LEGACY peut être rafraîchi, NATIVE ne peut plus être réimporté. Rollback exige OFF/retour explicite LEGACY/backup exact, sans effacer l'audit. Le futur batch protège les lignes personnelles NATIVE et les standalone hors population ; les relations nouvelles peuvent utiliser ces IDs. Une collision sur un référentiel/global nécessaire au préimage protégé bloque la transaction : le futur snapshot batch exact reste à recetter.

**Population et suite :** historique R1041 strict : 216 sources = 43 autorisés + 171 OWNER_DISCARDED_LEGACY_PROFILE + deux quarantaines séparées. Décision locale ignorée liée aux preuves historiques existantes ; mêmes 43 IDs fraîchement revalidés exigés avant le batch. Aucun 44e auto-ajout par élément, aucun fait différé pour les 171 ni suppression des standalone hors population. Quarantaines récupérables dans les captures locales ignorées, jamais raw en Git/DB. Ordre futur : compte test Twitch-only inexistant (conservation décidée après recette), refresh Kichnifou encore LEGACY puis transfert/barrière NATIVE, Ceo standalone liée par OAuth vérifié et remplacement explicitement approuvé, batch strict, puis 32. Aucun de ces canaries n'est migré ici.

**DDL et contrôles :** migration additive `20261006120000_061_add_twitch_native_foundations`, quatre tables `twitch_native_authorities`, `twitch_native_targets`, `twitch_native_audit`, `twitch_canary_imports` et FK WebIdentity nullable sur TwitchLinkState ; RLS backend-only, aucun grant/policy navigateur, contraintes/indexes/provenance. Les 60 anciennes migrations sont inchangées ; public reste à 60, status Prisma lecture seule annonce seulement 061 pending. Generate/validate PASS ; DDL isolé PASS (20 tables foundation/29 colonnes provenance/1 166 colonnes de parité), déploiement Prisma privé des 61 migrations et registre/status PASS, aucun contrôle/target/import activé par la DDL. **verify:full final PASS 8/8** : frontend **1 332 tests / 124 fichiers**, backend hors DB **1 875 / 126**, builds/typechecks/lint/diff-checks avec deux workers limités à la commande ; scripts opérateur typecheck dédié PASS. Quatre suites DB de régression : **26 PASS**. Suites privées finales : **23 Native/R1046 + quatre canary PASS**, avec fixture C6/Box/Team/Faveur/Combat/Roue non vide et restauration exacte ; un test DDL Prisma PASS, soit **54 tests DB / sept fichiers** avec les régressions. Les premières passes ont révélé des attentes/mocks anciens et deux appels de test à timeout Prisma 5 s ; fixtures/attentes corrigées et timeouts explicites alignés sur le parcours réel 30 s, aucun contournement produit. Répétition globale privée ISOLATED_FIXTURE PASS : 45 identités synthétiques, rollback global/restauration backup/idempotence vérifiés ; `exit30Certified=false`, aucune revalidation finale réelle ni certification des 43. QA Playwright sur CSS production/GameShell/panneau Compte : huit captures et quatre pré-élément aux quatre tailles 1920×1080, 1366×768, 2560×1440, 390×844 ; géométrie/overflow/erreurs et fermeture modale contrôlés, captures inspectées, aucune recette OAuth/Twitch réelle revendiquée. Logs TEMP `native-foundations-*`, full détaillé `gachaimpact-verify-full-Kr1kgC`.

**Contrôle documentaire :** 335 liens locaux dans les douze documents affectés contrôlés, aucune cible absente.

**Publication et arrêt :** checkpoint dédié sur review uniquement, push normal puis contrôle du SHA distant/main/divergence/worktree. Le rapport de sortie porte le SHA exact après publication ; la revue indépendante reste à effectuer sur GitHub. Aucun squash/rebase/force-push, Player public migré, DDL publique appliquée, commande Twitch réelle, activation, bridge public changé, modification Railway/env/Streamer.bot, 31A/31B/cutover ou promotion main. La mise en service de 061 et les recettes exigent des missions distinctes après review indépendante. STOP sur review pour ChatGPT ; Streamer.bot reste autoritatif.

## Historique — micro-polish final R1047 et promotion directe, 06/10/2026

**Baseline et validation reçue :** fetch exécuté ; HEAD/local review/origin review/origin main = `c807a93d7b25e63cfd50417d7c7c18b0848c099b`, divergence 0/0, worktree/index propres avant écriture. Le propriétaire valide publiquement R1047 et ses correctifs : tout le reste fonctionne. Seuls les cinq micro-polish ci-dessous sont demandés ; promotion directe explicitement autorisée après contrôles verts, sans nouvelle décision Rxxx ni gate de review indépendante.

**Lot borné :** Quotis conserve les neuf libellés, leur ordre et leurs états, avec le seul 📅 initial et sans emoji de domaine. Combat affiche ⏳ TODO/IN_PROGRESS, ✅ COMPLETED, ➖ BLOCKED ; ses quatre ennemis avec glyphes sont séparés par ` - `, multipart seulement si nécessaire. Boss vivant/vaincu affiche `🛡️ RES : 🔥 Pyro` selon son élément réel. Roue reprend le ton de BuildRewardMessage avec les montants/ressources/éléments modernes : nothing, particules, moras et jackpot ; nom Player figé avant mutation dans la mémoire existante, résultat déjà utilisé rappelé avec prochaine Roue demain, replay sans second spin. Giveaway spécialisé : racines exactes ga/giveaway seules ou invalides → aide compacte, aliases valides conservés, commandes étrangères ignorées, reroll toujours absent. Ouverture/stats/résultat de tirage alignés sur le ton historique avec 1 600 primos modernes ; annonces persistées sans RNG de texte au replay. Wish acquis inchangé.

**Permissions Giveaway :** aucun changement d’autorisation : Player ACTIVE avec rôle ADMIN ou MODERATOR actif exclusivement pour open/close. PostgreSQL privé prouve les deux rôles positifs et le refus d’un Player normal sans modification de session/reward/reçu ; stats accessibles et Wish soumis aux prérequis normaux. Badges Twitch ne créent aucun droit.

**Contrôles :** 345 tests ciblés / 7 fichiers PASS ; 24 tests PostgreSQL privés / 2 fichiers PASS (Giveaway 15, bridge natif 9), dont nom Roue figé, replay après renommage/changement de jour avec un seul tirage, aide Giveaway et absence de renvoi SENT. **verify:full final PASS 8/8**, frontend **1 328 / 124 fichiers**, backend hors DB **1 854 / 124 fichiers**, builds/typechecks/lint/diff-checks ; `VITEST_MAX_WORKERS=2` limité à la commande. Première passe 7/8 : trois erreurs de types dans les nouveaux tests, corrigées sans changement produit supplémentaire. **275 liens locaux / 8 documents contrôlés**, aucune cible absente. Relecture intégrale des sources legacy Roue/Giveaway/Wish, utilisées uniquement pour la présentation. Aucun schéma/migration ou moteur WheelStore/Economy/Combat modifié ; les **60 migrations**, dernière `20261003180000_060_add_arcade_multiplayer`, restent inchangées. Les tests PostgreSQL reconstruisent uniquement le schéma existant dans leurs fixtures privées, nettoyées en fin de suite ; avertissement de dépréciation pg préexistant sans échec. Logs TEMP : `r1047-polish-repro.log`, `r1047-polish-target-final.log`, `r1047-polish-db-final.log`, `r1047-polish-full-final.log` ; détail final `gachaimpact-verify-full-J9xVJf`.

**Publication et reprise :** commit dédié sur review, push normal et contrôle du SHA distant, puis main fast-forward strict vers le même SHA, push normal et fetch final : main == review, divergence 0/0, worktree/index propres. Aucun squash/rebase/force-push. Aucun changement Railway/env/DB publique/EventSub/OAuth/flags ni commande Twitch réelle ; aucune migration/DDL publique, aucune activation/désactivation de bridge. Les activations opérateur sont hors périmètre et ne sont pas présumées OFF. Streamer.bot reste autoritatif sans cutover. Déploiement exact du nouveau checkpoint encore à vérifier : STOP pour contrôle ChatGPT, sans R1046/31A/31B/32.

## Historique — promotion approuvée du correctif post-recette R1047, 06/10/2026

**Baseline et autorisation :** fetch exécuté ; main initial `4403eed38ce4a62954d2d1e09b724d887f864c71`, HEAD/local review/origin review `c43a98a91b6c6349ef88b74ff9f145b9d3bdb977`, review ahead 3 / behind 0 ; worktree/index propres avant écriture. Ancestry et parents exacts vérifiés : `4403eed → b5256f083722ee5a397883bac58a54919e32a9c7 → fcde95097abec1f31afc9fd8ab3f0abb6c37ad2a → c43a98a91b6c6349ef88b74ff9f145b9d3bdb977`. Review indépendante ChatGPT du vrai GitHub terminée : APPROUVÉ, aucun finding bloquant restant ; promotion des trois commits explicitement autorisée par le propriétaire.

**Promotion technique :** checkpoint uniquement documentaire sur review, push normal, puis main fast-forward strict jusqu'au HEAD exact de review et push normal. Le correctif post-recette R1047 est ainsi présent sur main, sans squash/rebase/force-push ni modification de code : présentation/Quotis et annonces Wish figées, DailyReward standalone après commit avec clés durables et renderer partagé, correction fresh/replay du rollover. Un message fraîchement accepté avant minuit garde sa vraie journée ; aucun rattrapage historique. Les preuves du candidat restent conservées ci-dessous, dont PostgreSQL privé et verify:full final 8/8 avec deux workers. Diff-checks et contrôles documentaires suffisent pour ce checkpoint ; suites non relancées, aucun résultat nouveau de code revendiqué.

**Déploiement et recette :** le push main déclenche uniquement les déploiements normaux ; déploiement du SHA final encore à vérifier après push, aucun Railway SUCCESS ni recette réussie présumé. Nouvelle courte recette publique nécessaire. Giveaway/Wish restent spécialisés et à tester avec leur bridge activé dans la fenêtre autorisée : Modération > Giveaway → Autoriser Twitch si nécessaire → Activer le bridge → vérifier ACTIVE → recette → Désactiver ensuite. Diagnostic antérieur autorisé mais `enabled=false` conservé ; aucune activation dans cette mission. Streamer.bot reste autoritatif, pilote natif désarmé hors fenêtre de recette, aucune bascule globale.

**Contrôles documentaires :** six propriétaires de suivi actualisés ; 244 liens locaux contrôlés, aucune cible absente. Diff-checks verts et périmètre exclusivement documentaire vérifié par les chemins modifiés/indexés avant commit ; aucun fichier de code produit, test, schéma, migration, configuration ou Story changé dans ce checkpoint.

**Sortie et reprise :** refs distantes main/review du même checkpoint à contrôler après fetch, divergence 0/0, ancestry et worktree/index propres. Aucun changement Railway/service/env, DB, OAuth/EventSub ou flag ; aucune migration/DDL, commande Twitch réelle ni arrêt Streamer.bot. Aucune nouvelle Rxxx. STOP après promotion pour contrôle ChatGPT du déploiement et courte recette propriétaire ; aucun R1046/31A/31B/32 commencé. R1046 ne s'ouvre qu'après validation publique finale de ce correctif.

## Historique — dernier correctif rollover après review de fcde9509, 06/10/2026

**Baseline vérifiée :** fetch exécuté ; HEAD/local review/origin review = `fcde95097abec1f31afc9fd8ab3f0abb6c37ad2a`, origin main = `4403eed38ce4a62954d2d1e09b724d887f864c71`, review ahead 2 / behind 0 ; worktree/index propres avant écriture. Review indépendante : raccord standalone validé, sauf le traitement frais franchissant minuit avant son claim secondaire.

**Correction bornée :** le garde-fou historique exige désormais `result.replayed && businessDate(acceptedAt) !== businessDate(clock.now())`. Un PLAYER fraîchement accepté avant minuit garde sa vraie journée dans `withPlayerCommandExecution({ now: acceptedAt, source: 'INTERNAL_CHAT' })`, même si le traitement secondaire commence après minuit. Un ancien POST non payé reste sans claim rétroactif ; un ancien POST déjà payé par le même trigger peut récupérer son feedback manquant sans second crédit. Aucun rattrapage historique. Clés, renderer partagé, scope `resources`, AppBootstrap et autres propriétaires/transport inchangés ; seul le service Chat, ses tests et ce Master changent.

**Contrôles exécutés :** reproduction PostgreSQL avant correction : message frais commité à `2097-03-01T22:59:59.999Z` (Paris J), horloge avancée à `23:00:00.001Z` après le vrai commit et avant le secondaire, claim absent. Interception limitée au test, aucun délai réel ni hook produit. Après correction, **3 cas temporels ciblés PASS** : frais à minuit, ancien replay non payé + nouveau message J+1, feedback payé J récupéré J+1 sans second paiement ; crédits exacts, date/source/trigger, renderer et scope vérifiés. **50 tests serveur ciblés / 2 fichiers PASS** (DailyReward, renderer post-recette). PostgreSQL privé final séquentiel : **55 tests / 3 fichiers PASS**, Chat **46**, bridge natif **8**, DailyReward **1**, fixtures nettoyées. **verify:full final PASS 8/8 avec `VITEST_MAX_WORKERS=2` limité à la commande**, frontend **1 328 / 124 fichiers**, backend hors DB **1 834 / 123 fichiers**, builds/typechecks/lint/diff-checks. Deux passes standard antérieures à 7/8 : timeout de pagination ChatPanel, plus une assertion de statut de saisie DirectMessagePanel dans la première ; ces deux fichiers inchangés passent isolément (**156 tests**). Aucun test, délai ou réglage du dépôt modifié pour ces échecs. Les 60 migrations restent inchangées, dernière `20261003180000_060_add_arcade_multiplayer` ; pas de nouveau DDL, seuls les schémas privés de test sont reconstruits. Logs TEMP : `r1047-rollover-repro.log`, `r1047-rollover-target.log`, `r1047-rollover-unit.log`, `r1047-rollover-db-final.log`, `r1047-rollover-front-recheck.log`, `r1047-rollover-full.log`, `r1047-rollover-full-final.log`, `r1047-rollover-full-workers2.log` ; vérification finale détaillée dans `gachaimpact-verify-full-U4CURI`.

**Reprise :** commit séparé directement au-dessus de fcde9509, push normal review uniquement ; main reste `4403eed`. Candidat review seulement, aucune promotion. Giveaway/Wish encore à recetter publiquement ; Streamer.bot autoritatif. Aucun changement Twitch réel/Railway/OAuth/EventSub, aucune migration/DDL nouvelle, aucune nouvelle Rxxx ni chantier suivant. STOP après publication, prochaine action : review indépendante ChatGPT du commit correction.

## Historique — correction unique après review de b5256f0, 06/10/2026

**Baseline vérifiée :** fetch exécuté, HEAD/local review/origin review = `b5256f083722ee5a397883bac58a54919e32a9c7`, origin main = `4403eed38ce4a62954d2d1e09b724d887f864c71`, review ahead 1 / behind 0 ; worktree/index propres avant ce lot séquentiel. La review indépendante valide le lot précédent sauf l'absence du déclenchement quotidien dans le Chat standalone. Aucun autre chantier ouvert.

**Correction :** le premier message PLAYER normal réellement accepté, d'un Player ACTIVE avec élément permanent, appelle `ClaimDailyReward` après le commit Chat, jamais sous son verrou. UI, Chat standalone et Twitch utilisent réellement le même owner Player/jour avec leurs déclencheurs respectifs. Source `INTERNAL_CHAT`, clé `chat-message:<messageId>` ; montants modernes rendus depuis le résultat par `firstDailyMessageResult`, déjà utilisé par Twitch. Commandes/système et absence d'élément exclus ; un claim préalable UI/Twitch ne produit pas d'annonce standalone.

**Reprise et retour UI :** éligibilité et instant du message conservés dans le reçu Chat ; un ancien POST ne réclame ni un nouveau jour ni un rattrapage. Le trigger du claim permet de reprendre un feedback manquant après paiement sans nouveau crédit. Publication privée SYSTEM/GAME_RESULT liée au PLAYER et à sa génération ; unicité existante `(sourceChannel, externalMessageId)` avec `daily-reward:<messageId>` et lecture du résultat existant sur P2002. Un échec secondaire conserve le Chat accepté, sans gain fictif ni erreur d'envoi ; replay ou prochain message éligible peuvent reprendre. Scope existant `resources` : soldes et carte Récompense rechargés sans F5, aucun scope ajouté.

**Contrôles exécutés PASS :** défaut reproduit avant correction (claim absent). Ciblés hors DB : **77 tests frontend / 3 fichiers** (pipeline AppBootstrap, refresh-scopes, ChatPanel), **50 tests serveur / 2 fichiers** (daily-reward, chat-post-recipe). PostgreSQL privé final, séquentiel : **54 tests / 3 fichiers**, Chat **45**, bridge natif **8**, DailyReward **1** ; dix nouveaux cas Chat couvrent crédits exacts, source/trigger/renderer, deuxième message, replays, exclusions, claims UI/Twitch préalables, courses, échecs secondaires, absence de rattrapage et égalité réelle standalone/Twitch. Trois attentes antérieures adaptées au nouveau feedback et au crédit quotidien ; aucune erreur finale. Fixtures privées nettoyées ; avertissement pg de dépréciation préexistant. **verify:full PASS 8/8** : frontend **1 328 / 124 fichiers**, backend hors DB **1 834 / 123 fichiers**, builds/typechecks/lint/diff-checks. **138 liens locaux** des trois documents contrôlés ; aucune cible absente. Schéma et migrations inchangés : **60 migrations**, dernière `20261003180000_060_add_arcade_multiplayer`. Logs TEMP : `r1047-daily-repro.log`, `r1047-chat-db.log` (première passe), `r1047-chat-front.log`, `r1047-daily-unit.log`, `r1047-daily-db-final.log`, `r1047-correction-full.log` et `gachaimpact-verify-full-6v3KGh`.

**Sortie et reprise :** commit dédié au-dessus de b5256f0, push normal review uniquement. Main reste `4403eed` ; aucune migration ni changement Twitch réel, Railway, OAuth/EventSub, gate ou donnée joueur publique. Les seuls DDL de tests reconstruisent le schéma existant dans les fixtures PostgreSQL privées. Giveaway/Wish toujours non validés publiquement ; Streamer.bot autoritatif. Nouvelle review indépendante ChatGPT du commit correction, puis seulement promotion dédiée si approuvée. STOP après publication review, sans nouvelle Rxxx.

## Historique — correctif post-recette R1047 sur review, 06/10/2026

**Baseline vérifiée :** fetch exécuté ; HEAD/local review/origin review/origin main = `4403eed38ce4a62954d2d1e09b724d887f864c71`, divergence 0/0, worktree/index propres avant écriture. Lot dédié séquentiel sur review, sans branche/worktree parallèle. Main reste cette baseline ; aucun changement du transport, des gates génériques ou de l’autorité.

**Recette propriétaire reçue :** le générique R1047 déployé fonctionne ; « Tout le reste fonctionne » couvre commandes, Expédition réelle, Combat/jeux Event, messages ordinaires et synchronisation des aliases. Les corrections demandées concernent le ton/emojis historiques, Quotidiennes et le diagnostic Giveaway/Wish. Cette recette acquise ne vaut pas validation publique du présent correctif ni de Giveaway/Wish.

**Correctif produit :** résolveur partagé standalone/Twitch ; neuf rubriques Quotis dans l’ordre Récompense, Roue, Shop, Combat, Boss, Expédition, Amitié, Event, Faveur. Boss lu chez MonthlyBoss ; Expédition et Event utilisent les prédicats purs communs à l’interface (départ du jour, READY, A/B/C, calendrier, bonus et messages non lus), sans modifier l’UI. Premier quotidien, Expédition, Combat/Boss, mission/switch Shop, Convertir et les douze thèmes Event retrouvent leurs formulations/emojis avec les montants, chances, durées, récompenses et soldes des owners modernes. Combat expose ses membres réellement utilisés et leurs constellations de tentative, y compris en replay ; aucun RNG/règle modifié. Petit complément des résumés Concours, Missions et statistiques Combat. Aucun script/JSON historique lu à l’exécution, aucune mécanique historique réintroduite.

**Giveaway/Wish :** lecture publique strictement read-only du gate lié à Kichnifou : autorisation spécialisée présente, `enabled=false`. Le consumer est silencieux dans cet état indépendamment de l’armement générique ; aucune activation exécutée. Parcours futur : **Modération > Giveaway > Autoriser Twitch** si absent, ou **Activer le bridge** si déjà autorisé ; vérifier ACTIVE avant recette, puis **Désactiver** après la fenêtre autorisée. Aliases giveaway/ga + stat/stats/open/ouvrir/close/fermer existants conservés, racines seules silencieuses, reroll absent R950. `!wish` fige désormais dans sa transaction le texte 🌠 nom / Célestia / 🎁 nombre dans l’annonce existante ; replay après renommage/nouvelle participation sans recalcul ni second envoi. Aucun second consumer, route générique ou bypass OAuth/EventSub.

**Contrôles exécutés et réussis :** reproduction des écarts Quotis/Combat avant correctif ; **360 tests ciblés / 8 fichiers** (post-recette, owner-recipe, familles, dispatcher, remaining-commands, twitch-command-coverage, giveaway-native, twitch-giveaway-shutdown), dont cinq intentions R1047 antérieures sans nouvelle lecture d’acteur. L’habillage utilise le Player déjà vérifié par le transport ; aucun élargissement du protocole. **29 tests PostgreSQL / 3 fichiers privés** : Giveaway 12, Combat 9 (constellations de tentative après évolution du personnage), bridge natif 8 (quotidien exact et replay). **verify:full PASS 8/8**, frontend **1 327 tests / 124 fichiers**, backend **1 834 tests / 123 fichiers**, builds/typechecks/lint/diff-checks verts. Les 268 liens locaux des sept documents modifiés pointent vers des fichiers présents. Aucune migration créée ni DDL public ; les tests rejouent le schéma existant dans leurs schémas privés supprimés en fin de suite. Les fixtures Combat/bridge émettent l’avertissement de dépréciation pg pour une future version 9, sans échec de test. La seule lecture publique du gate n’expose aucun token. Aucun env Railway, service, flag, OAuth/EventSub public, donnée joueur publique ou commande Twitch réelle modifié.

**Sortie et reprise :** commit dédié/push normal review ; SHA distant et propreté Git contrôlés en fin de mission. **Main reste `4403eed` ; aucune validation publique du correctif anticipée. Streamer.bot reste autoritatif, sans cutover.** Attendre la review indépendante ChatGPT, puis promotion explicitement approuvée et courte recette messages corrigés + Giveaway/Wish. Aucun R1046/31A/31B/32 commencé, aucune nouvelle décision Rxxx. STOP après publication review.

## Historique — promotion approuvée R1047 sur main, 05/10/2026

**Baseline de promotion vérifiée avant écriture :** fetch exécuté ; branche locale review, worktree/index propres ; origin main = `7118740130063d9e42411fba3d7a58c95ef251d6`, origin review/HEAD = `9703811e4722fe43ba8db9936960b33862109ddc`, review ahead 2 / behind 0. Chaîne exacte et ancestry : `7118740 → d1760bccd5597190f660d7e58964cbc946fec9bc → 9703811e4722fe43ba8db9936960b33862109ddc` ; aucun commit inattendu, aucune modification Story.

**Approbation indépendante acquise :** le propriétaire transmet le verdict ChatGPT **R1047 APPROUVÉ, aucun finding bloquant restant**, sur le vrai GitHub. Les **deux commits d1760bcc + 9703811e constituent ensemble le candidat approuvé** ; le blocker broadcaster-only est corrigé. Promotion explicitement autorisée, aucun code supplémentaire demandé. Les contrôles du candidat conservés ci-dessous ne sont pas présentés comme relancés ni comme recette publique.

**État Git de sortie de cette promotion :** checkpoint documentaire publié sur review, puis chaîne entière avancée par fast-forward strict vers main : **main == review, divergence 0/0**. R1047 est présent sur main avec exactement le contenu produit approuvé ; aucun rebase/squash/force-push ni micro-commit pour inscrire le propre SHA du checkpoint. Les statuts de Master, command-reference, architecture, runbook et les deux mentions d’état roadmap/decisions-log sont actualisés ; aucune nouvelle décision Rxxx.

**Contrat approuvé conservé :** 34 Player Twitch = 32 génériques + wish/giveaway spécialisés ; résolveur commun, source TWITCH, intents et cibles/quantités/MAX/jour/édition/Team/Combat/Expédition figés, replay/multipart et messages ordinaires via les owners XP/Défis/Missions/quotidienne/Event. Broadcaster = chaîne, receiver = sender autorisé par la subscription, chatter = auteur métier ; `chatter_user_id → TwitchIdentity → Player ACTIVE allowlisté`, sans exigence d’être broadcaster/receiver. Réponses du receiver, receipt du chatter. Deux !pull de même texte avec IDs distincts restent deux opérations, redelivery un seul effet ; diagnostic live amont/non démontré inchangé.

**Contrôles de promotion :** diff complet main → review et chaîne approuvée contrôlés ; le checkpoint ne modifie que la documentation. Diff-checks, liens locaux, fichiers indexés exacts et identité du contenu produit avec 9703811e contrôlés avant fast-forward. Aucun code modifié, donc verify:full et tests DB du candidat non relancés dans cette mission. **Aucune migration/DDL ni action DB**, aucune modification Railway/env/service/flag/EventSub/OAuth, aucun armement ou commande Twitch réelle. Le push main déclenche uniquement les déploiements normaux.

**Validation publique et prochaine action exacte :** R1044/R1045 restent publiquement validés selon le propriétaire. **R1047 promu techniquement, déploiements Railway/Cloudflare et healthcheck encore à vérifier après push ; recette propriétaire R1047 NON acquise, parité finale NON validée.** Ne revendiquer aucun SUCCESS/déploiement sans preuve dédiée. **Streamer.bot reste autoritatif ; pilote natif désarmé hors future recette autorisée, aucun cutover global.** Prochaine action : **CONTRÔLE CHATGPT DU SHA/DÉPLOIEMENTS/HEALTHCHECK, PUIS RECETTE PROPRIÉTAIRE KICHNIFOU R1047** par familles et messages ordinaires. R1046 seulement après validation publique R1047 ; aucun R1046/31A/31B/32 commencé. STOP après promotion et vérification Git.

## Historique — correction R1047 après review indépendante, 05/10/2026

**Baseline de correction vérifiée avant modification :** fetch exécuté ; HEAD/local review/origin review = `d1760bccd5597190f660d7e58964cbc946fec9bc`, origin main = `7118740130063d9e42411fba3d7a58c95ef251d6`, review ahead 1 / behind 0 ; worktree/index propres. Aucun nouveau commit ni travail parallèle à réconcilier. Correction dédiée au-dessus de ce parent, aucune promotion/main/env/Twitch réel autorisée.

**Review indépendante transmise par le propriétaire :** architecture générale R1047 acceptée, mais **un blocker transport/identité** : le gate conservait chatter=broadcaster et receiver=chatter du canary R1042. Les preuves du premier candidat portaient sur le broadcaster ; elles ne prouvaient donc pas encore l’exécution d’un viewer distinct. Aucun diagnostic !pull ni moteur métier remis en cause ; aucune nouvelle décision Rxxx.

**Correction physique :** le manager expose le contrat Chat ACTIVE déjà validé côté serveur. Arm mémorise subscription ID, broadcaster, receiver et callback exact ; disarm efface ce contrat et reste un arrêt immédiat contrôlé par le Player opérateur validé, sans lookup réseau/DB supplémentaire. L’enveloppe est validée contre lui avant lookup de l’auteur. Le Player est exclusivement `chatter_user_id → TwitchIdentity.twitchUserId → Player ACTIVE allowlisté`, sans égalité exigée avec chaîne/receiver. Le contrat actuel du manager continue d’utiliser l’identité liée opérateur pour broadcaster et receiver ; les fixtures distinctes ne configurent aucun nouveau bot public. Sender outbound = receiver ; receipt/commandPilot.chatterId = auteur Player. Lecture des anciens receipts conservée. Reprise opérateur des réponses viewer vérifie son identité métier active/allowlistée et le même transport, sans métier supplémentaire ; un nouveau receiver ne remplace jamais celui de la réponse réservée. L’exclusion des échos reconnaît le receiver même lorsque le receipt métier appartient au viewer. Messages ordinaires derrière ce gate corrigé, propriétaires et frozen intents inchangés.

**Contrôles finaux de correction PASS :** deux tests de reproduction lecture/Pull non-broadcaster ont échoué sur `d1760bcc` (aucun appel métier), puis sont verts. **395 tests ciblés / 12 fichiers**, dont contrats du manager/transport, trois IDs distincts, refus auteur/receiver/chaîne/callback/shared chat, contrôle opérateur, refus d’un receiver remplacé, matrice 34=32+2, Chat, Faveur, Gift et Giveaway. PostgreSQL privé, fichiers exécutés séquentiellement : **35 tests / 3 fichiers** — pilote **18** (dont six nouveaux cas viewer non-broadcaster), bridge **8**, webhook spécialisé **9**. Les nouveaux cas prouvent lecture, vraie mutation source TWITCH, compteurs/XP/cooldown/quotidienne/Event, zéro WebIdentity/GlobalChatMessage, deux !pull identiques à IDs distincts, redelivery sans double effet et échos du receiver séparés du receipt auteur. **verify:full final PASS 8/8** : frontend **1 327 tests / 124 fichiers**, backend hors DB **1 784 tests / 122 fichiers**, builds/typechecks, lint et diff-checks. Aucun DDL/migration ajouté ; aucun effet sur les Players publics et cleanup des fixtures privées. Dix fichiers concernés, dont les quatre propriétaires documentaires demandés ; liens locaux et périmètre contrôlés, aucun Story.

**Contrôles intermédiaires et limites :** fixtures privées corrigées pour respecter le format du login Twitch et fournir les dépendances webhook requises ; typage et enveloppe du mock outbound complétés avant les preuves finales. Warnings préexistants lint/chunk frontend >500 kB et dépréciation pg conservés ; aucun échec final. Logs locaux TEMP : `gacha1047-fix-repro.log`, `gacha1047-fix-targeted-final.log`, `gacha1047-fix-db-final-*.log`, `gacha1047-fix-verify-full-final.log` et `gachaimpact-verify-full-IRcZHx`. Aucune preuve locale ne vaut recette publique ; diagnostic live !pull inchangé, amont probable/non démontré et non bloquant.

**Sortie et prochaine action :** R1044/R1045 restent publiquement validés ; R1047 demeure candidat sur review uniquement. **Nouvelle review indépendante ChatGPT du vrai commit correction**, puis après approbation promotion dédiée/déploiement vérifié et recette propriétaire par familles/ordinaire. Streamer.bot reste autoritatif, aucun cutover/R1046/31A/31B/32. STOP après push et vérification Git.

## Historique — candidat initial R1047 sur review, 05/10/2026

**Baseline réelle avant modification :** fetch exécuté, branche locale review, worktree/index propres ; main == review == `7118740130063d9e42411fba3d7a58c95ef251d6`, divergence 0/0. Aucun travail parallèle écrasé. Un commit dédié sera publié sur review ; aucune promotion, modification Railway/env ou recette Twitch réelle autorisée dans ce lot.

**Preuve propriétaire R1044/R1045 acquise :** le propriétaire confirme dans cette mission leur déploiement et leur recette publique réussis. Une mutation Twitch est reflétée au retour d’onglet standalone sans F5 ; R1045 fonctionne, avec l’entrée hard pity 80 observée sur un résultat non-5★ : `💀 Outch la hard...`. Cette preuve transmise complète le checkpoint de promotion ci-dessous ; aucune nouvelle décision, réimplémentation ou inspection de production revendiquée.

**R1047 physique :** `PlayerCommandResolver` extrait du dispatcher et utilisé par les deux transports ; parser/aliases, helpers, erreurs et propriétaires métier communs. Matrice automatique depuis le registre : **34 entrées Player Twitch, 32 GENERIC_NATIVE et 2 SPECIALIZED_NATIVE (wish/giveaway)**. Faveur acquisition/présence et Gift gardent leurs consumers ; `!faveur` est une lecture générique. `!clear` reste interne. Les familles et syntaxes viennent du registre, sans liste documentaire concurrente. Identité immuable → TwitchIdentity → Player ACTIVE ; aucune WebIdentity/GlobalChatMessage/GAME_RESULT fabriquée.

**Intent/replay :** réservation durable avant métier, instant initial sauvegardé puis invocation résolue sérialisée avant l’effet explicite : cible/quantité/slot/branche, banner/édition, contexte Team/Combat/Expédition et groupes d’IDs. Horloge/source internes à l’exécution, source TWITCH ; les lectures originales nécessaires à la restitution sont conservées. MAX figé, settings idempotents et recovery des owners existants. Un contexte changé avant engagement est refusé, sans nouvelle cible implicite. Clés réelles channel/message ID, verrou receipt + advisory ; redelivery sous un autre ID de transport ne crée pas une autre commande. Multiparties, SENT conservés, refus certain response-only et SENDING/AMBIGUOUS sans résend automatique. Anciens receipts R1042/R1043 : réponses déjà sauvegardées inchangées ; ancien Pull engagé récupérable par sa clé, absence d’intention/opération engagée requiert contrôle opérateur.

**Messages ordinaires :** progression commune avec le Chat (XP 1/2/3 selon longueur, cooldown Player de 2 s partagé, totalMessages/countées, Défis/Missions/level-up), activité et premier-message quotidien via le propriétaire existant. Event réutilise l’édition préparée, bonus quotidien, notices dédupliquées entre canaux et livraison des messages sociaux encore en attente, même anciens/vus dans l’UI. Receipts/plans et sorties idempotents par vrai message ID ; les échos natifs prouvés sont exclus avant Giveaway/Faveur/progression. Les classifications ALREADY_NATIVE / OBSOLETE_V1 / TO_IMPLEMENT implémenté sont consignées dans la [matrice](../commands/step-29-command-coverage.md#parité-des-messages-ordinaires-twitch-r1047).

**Diagnostic borné des deux !pull identiques :** preuve PostgreSQL sur les classes originales `7118740`, puis sur R1047 : deux textes identiques et deux IDs = deux receipts, deux clés/opérations et deux réponses ; replay du même événement = aucun effet/envoi supplémentaire. R1047 teste aussi un autre ID de delivery pour le même message et le conflit de contenu. Aucune déduplication par texte ni espace ajouté. La chaîne HMAC → webhook → observer → exécuteur est couverte localement ; aucune inspection d’une delivery live manquante. Cause amont probable, non démontrée en live ; observation non bloquante. Twitch documente notamment `msg_duplicate` dans sa [référence Chat IRC](https://dev.twitch.tv/docs/chat/irc), ce qui constitue une piste, pas une preuve de cet incident.

**Contrôles finaux PASS :** suites ciblées **367 tests / 9 fichiers**, puis contrôle complémentaire des signatures UI/owners **191 tests / 3 fichiers** (ensembles partiellement communs, non additionnés). PostgreSQL privé : **115 tests / 10 fichiers**, exécutés séquentiellement, dont pilote **12**, bridge/messages ordinaires **8**, Chat **35**, quotidienne **1**, Box **2**, Team **15**, Combat **9**, Event **8**, webhook spécialisé **9** et Gift **16**. Diagnostic distinct sur les classes originales `7118740` : **1 test PASS**, avant les assertions supplémentaires R1047. **verify:full final PASS 8/8** : frontend **1 327 tests / 124 fichiers**, backend hors DB **1 766 tests / 122 fichiers**, builds/typechecks, lint et diff-checks. Les tests DB restent séparés de verify:full ; aucun résultat local ne vaut recette publique. Migrate status read-only PASS : **60 migrations à jour**, dernière `20261003180000_060_add_arcade_multiplayer` ; aucune migration/DDL nouvelle. Aucun Player/solde public modifié ; cleanup des fixtures privées. Sept propriétaires documentaires actualisés, liens locaux contrôlés ; aucun changement Story.

**Contrôles intermédiaires et limites :** signature UI corrigée pour ne pas transmettre un argument optionnel `undefined` supplémentaire ; cast du verrou advisory corrigé pour éviter la désérialisation PostgreSQL `void`. Un contrôle Gift concurrent a retourné `P2010`/500 ; la cause SQL précise n’a pas été établie. Le texte d’annonce ajouté pour identifier les échos a ensuite été intégré à la réservation existante, sans transaction supplémentaire ; les **16 tests Gift** puis verify:full ont été revalidés. Aucun changement du moteur Gift, de ses gates ni de ses règles économiques. Warnings préexistants lint/chunk frontend >500 kB et dépréciation pg conservés ; aucun contrôle final en échec. Logs locaux dans TEMP : `gacha1047-db-pilot-final.log`, `gacha1047-db-regression-*.log`, `gacha1047-db-gift-final.log` et `gachaimpact-verify-full-bxHCpE`.

**État de sortie et prochaine action :** candidat sur review seulement, main conservée. R1047 n’est ni approuvé indépendamment, ni promu/déployé/validé publiquement dans ce lot. **Streamer.bot reste autoritatif, aucun cutover.** Review indépendante ChatGPT du vrai diff GitHub, puis après approbation mission de promotion et recette Kichnifou par familles/ordinaire. Aucun R1046, 31A, 31B ou 32 commencé ; autorité durable du batch toujours à définir avant 31B. STOP après publication du candidat.

## Historique — promotion approuvée R1044/R1045 sur main, 05/10/2026

**Baseline de promotion vérifiée après fetch :** `origin/main = d475fd3bcc5ea948bd18fbcbcaf2b5c1522b4d7a`, `origin/review = 1ee86eff7f06b3da56942b4785277215cc3732db`, review ahead 3 / behind 0 ; branche locale review et worktree/index propres. Parent du candidat : `7e2dab4a88967ded8bea7506028ee9e60f9faee9`. Les deux commits précédents sont la passation documentaire. **Review indépendante ChatGPT du vrai candidat `1ee86eff` APPROUVÉE sans finding bloquant**, selon la validation transmise par le propriétaire ; promotion explicitement autorisée. Ce checkpoint documentaire est publié sur review puis la chaîne entière est promue par fast-forward strict : état de sortie **main == review, divergence 0/0**, sans inscrire ici son propre SHA. Le contenu produit reste exactement celui du candidat approuvé.

**État Git et validation publique :** R1044/R1045 sont implémentés, testés, approuvés en review indépendante et présents sur main après cette promotion. **Leurs déploiements Railway/Cloudflare, le healthcheck et leur recette publique restent à vérifier après le push par ChatGPT ; aucun SUCCESS ni validation publique anticipé.** La dernière preuve Railway acquise lors de la reprise concerne uniquement `d475fd3` (R1043) ; la recette publique R1042/R1043 demeure acquise dans son périmètre consigné ci-dessous. Le pilote reste désarmé et **Streamer.bot autoritatif** ; aucun appel/armement Twitch réel, arrêt Streamer.bot, changement Railway/env/EventSub/OAuth ou action DB dans cette mission. Le push main déclenche uniquement les déploiements normaux.

**R1044 — état physique promu :** le retour focus/visibilité du GameShell prêt réutilise la paire de listeners existante de revalidation et `refreshPlayerState → loadBootstrapGameState`, avec les loaders autoritatifs existants. Ressources, progression, Gacha/catalogue, Teams, quotidiennes/combat/Boss, Event, Concours, Expédition, notifications et permissions sont relus ; Faveur utilise sa lecture quotidienne existante. Aucun endpoint ni Realtime ajouté. Coalescence des événements proches (750 ms), une seule relecture globale en vol par session ; les retours ultérieurs pendant ce vol demandent au plus une relecture différée. Les lectures d'une ancienne session sont écartées. La relecture attend une présentation Gacha locale en cours, puis reprend sans la rejouer. Les caches Box/Sac/Banque/Shop/votes sont invalidés, les écrans montés concernés relisent via leurs tokens existants ; Missions et Profil reçoivent ce même token sans remontage ni perte de rang/onglet/recherche. Une révision de relecture évite le faux feedback Défi ; la progression est publiée sans animation de gain. Un échec reste une erreur de relecture, avec nouvel essai possible au prochain retour, jamais un rollback de l'action serveur.

**R1045 — état physique promu :** renderer `pullChatResult` partagé Chat/Twitch, depuis les faits enregistrés, sans moteur/RNG modifié. Préfixes exacts : soft 74 `⚠️ Tu entres en soft pity...`, hard 80 `💀 Outch la hard...`, y compris sans 5★ ; Early 2..35 `🔥 WOW EARLY !!`, B2B `💥 INCROYABLE BACK-TO-BACK !!!`, Capture `✨ CAPTURE DE BRILLANCE !`. Ordre zone puis Early/B2B/Capture puis résultat ; labels courts redondants retirés, pity/garantie/50-50 distincts conservés. Un résultat par tirage, marqueurs [i/N], faits/gains/passifs et replay conservés. Pour les rares sorties longues, la forme compacte resserre les séparateurs et le libellé remboursement C6, sans raccourcir les phrases exactes, les noms ou les montants. Limite 500 caractères Unicode vérifiée avec noms longs, soldes int8 maximaux, C6 et quatre procs ; R1040 inchangée.

**Contrôles du candidat approuvé exécutés PASS :** ciblés frontend **93 tests / 7 fichiers**, backend **136 tests / 3 fichiers**. Cas focus/visibilité, vol et reprise coalescés, hidden, cleanup/remount/StrictMode, session/Player non prêts, ancienne session et erreur de relecture ; projections de fixture actualisées via le pipeline bootstrap réel, Box montée actualisée et état local conservé. Textes rares déterministes, bornes et absences, combinaisons/ordre, replay, x1/x3/x10, R1040 et limite Unicode. **verify:full PASS 8/8** : frontend **1 327 tests / 124 fichiers**, backend hors DB **1 740 tests / 121 fichiers**, builds/typechecks frontend/backend, lint et diff-checks. Les tests de reproduction ont d'abord échoué sur les besoins absents ; borne 500 et saisie de fixture corrigées, puis une alerte lint nouvelle de cleanup session corrigée et contrôles relancés. Warnings préexistants lint et chunk frontend >500 kB conservés. Logs complets locaux dans TEMP, dont `gacha1044-owner-final.log`, `gacha1045-final-targeted.log` et `gachaimpact-verify-full-RIk2Io`.

**Non exécuté / hors périmètre :** aucun test PostgreSQL mutatif, aucun contrôle DB direct, aucune recette Twitch publique ni inspection visuelle de production ; aucun changement de schéma, persistance, économie, coût, probabilité ou DDL. Chaîne versionnée inchangée : **60 migrations**, dernière `20261003180000_060_add_arcade_multiplayer`. Les comportements DOM testés localement ne valent pas recette propriétaire. Aucune nouvelle décision Rxxx ; R1044/R1045 déjà validées. Command-reference actualisée ; decisions-log, runbook et roadmap conservés car décisions, ordre et gates restent valides.

**Contrôles de promotion :** seuls Master et command-reference changent de statut ; contrôles documentaires/diff-checks, chaîne exacte, ancestry et identité du contenu produit avant fast-forward. Aucun code modifié, donc les suites du candidat ci-dessus ne sont pas relancées. Aucune nouvelle migration/DDL, aucune action DB ni Twitch réelle. Decisions-log, runbook et roadmap restent inchangés : décisions, ordre et gates toujours valides.

**Prochaine action exacte : CONTRÔLE EXTERNE CHATGPT DU SHA MAIN, DES DÉPLOIEMENTS RAILWAY/CLOUDFLARE ET DU HEALTHCHECK**, puis recette propriétaire ciblée R1044/R1045 : mutation Twitch → retour onglet sans F5, soft 74/hard 80 si préparables proprement ; Early/B2B/Capture couverts automatiquement et observations naturelles possibles. La préparation/activation nécessaire à cette recette reste une mission séparée ; aucune action Twitch réelle pendant la promotion. **R1047 bridge Twitch complet ne devient actif qu’après validation publique R1044/R1045**, puis R1046 récupération standalone Twitch-only → recette Kichnifou de parité/autorité → 31A Ceo → 31B batch → 32. Aucun de ces lots commencé ici. STOP après promotion et rapport.

## Historique — passation après recette réelle Twitch, 05/10/2026

**Checkpoint code/public vérifié avant le commit de passation :** `origin/main == origin/review == d475fd3bcc5ea948bd18fbcbcaf2b5c1522b4d7a`, divergence 0/0 ; Railway a déployé ce SHA exact en **SUCCESS**. La passation documentaire est ensuite publiée **sur `review` uniquement** selon le workflow normal ; la nouvelle conversation doit donc vérifier le SHA `review` réellement courant et sa divergence avant toute action. `TWITCH_COMMAND_PILOT_ENABLED` est présente/capability ON. Le propriétaire a terminé la recette, **désarmé le pilote commandes et réactivé Streamer.bot** ; le runtime natif n’est donc plus l’autorité courante. Prisma reste à **60 migrations** ; R1043 n’ajoute aucun DDL.

**Recette propriétaire réellement acquise :** réception EventSub réelle, réponse native Twitch, kill switch et UI arm/disarm validés ; `!pity`, `!ban`/`!banniere`, `!team`, `!sac`, `!quotis`, `!exp`, `!pull` et `!pull 1` fonctionnent. Après R1043, `!pull 3` a été validé visuellement sur Twitch avec **trois réponses distinctes [1/3] [2/3] [3/3]** et dans le Chat standalone avec la même granularité. Contrôle DB ChatGPT : une opération Twitch x3, coût 480, trois PullResult ; des essais x5/x10 ont aussi produit respectivement cinq/dix résultats avec leurs coûts moteur. Les garde-fous testés restent silencieux pour les commandes hors petite allowlist actuelle et pour les quantités Pull invalides.

**Findings ouverts issus de la recette :**
1. **R1044 — synchronisation UI externe :** une mutation Twitch modifie bien PostgreSQL, mais un onglet GachaImpact déjà ouvert garde son état React ancien jusqu’au F5. Cible : au retour focus/visibilité de l’onglet, recharger de façon autoritative et dédupliquée l’état joueur partagé, sans Realtime obligatoire ni rejeu métier.
2. **R1045 — présentation Pull rare :** restaurer les phrases historiques du legacy sur le renderer partagé Chat/Twitch : pity 74 = `⚠️ Tu entres en soft pity...` même sans 5★ ; Early 5★ pity 2..35 = `🔥 WOW EARLY !!` ; B2B = `💥 INCROYABLE BACK-TO-BACK !!!` ; Capture = `✨ CAPTURE DE BRILLANCE !`. Nouvelle entrée Hard décidée : **à pity 80, quel que soit le résultat, préfixer `💀 Outch la hard...`**, comme l’entrée en soft pity. Éviter de dupliquer ensuite les labels Early/B2B/Hard/Capture en suffixe ; conserver les faits utiles pity/garantie/50-50 et R1040.
3. **R1047 — bridge Twitch complet :** la petite allowlist R1042 était uniquement un canary de transport. Avant 31A, toutes les commandes Player du registre marquées Twitch doivent appeler nativement les mêmes propriétaires que le standalone, aliases/sous-commandes compris ; `!wish`/`!giveaway` restent sur leurs consumers spécialisés et `!clear` reste hors commandes viewer. Les mutations Twitch utilisent SourceChannel.TWITCH, intent figé/replay sûr et aucun GlobalChat mirroring. La parité de remplacement doit aussi auditer les comportements Streamer.bot déclenchés par les messages ordinaires (notamment XP/classification/cooldowns et tout trigger encore vivant), pas seulement les commandes.
4. **R1046 — cutover transparent + récupération web future :** les viewers migrés restent sur Twitch et ne doivent pas être informés du standalone pour le cutover. Leur Twitch User ID résout directement TwitchIdentity → Player migré ; aucun login web ni OAuth individuel n’est requis pour jouer sur Twitch. **Avant 31B**, le standalone doit néanmoins posséder un chemin opérationnel dans `Configuration > Compte` permettant, si un joueur visite le site plus tard, de prouver son Twitch User ID par OAuth et de rattacher sa WebIdentity au Player Twitch-only déjà migré afin de retrouver toutes ses ressources/progression. Aucun matching par pseudo ni fusion aveugle ; un Player web temporaire non significatif peut être transféré/retiré de façon contrôlée, mais un Player web ayant déjà du gameplay bloque et demande résolution explicite.

**Ordre de reprise obligatoire après cette passation :**
A. **Lot polish R1044 + R1045** : refresh au focus/visibilité + phrases Pull exactes. Review indépendante → promotion → recette propriétaire ciblée : mutation Twitch puis retour onglet sans F5 ; soft pity 74 / hard 80 vérifiées par tests déterministes et, si raisonnable, par état propriétaire contrôlé ; Early/B2B/Capture couverts automatiquement et observés naturellement si non déterministes.
B. **Bridge Twitch complet R1047** : remplacer l’allowlist canary par une couverture explicite de toutes les commandes Twitch du registre, mutualiser le cœur du dispatcher sans copier la logique, figer les intentions mutationnelles dans le receipt, conserver les consumers spécialisés, ajouter une matrice qui interdit toute commande `twitch: true` non couverte. Auditer aussi les triggers de messages ordinaires nécessaires au remplacement total de Streamer.bot. Recette propriétaire ensuite par familles, d’abord lectures puis mutations à faible risque, puis économie/social/Event/Combat.
C. **Récupération standalone Twitch-only R1046** : implémenter et tester le claim OAuth contrôlé dans Configuration > Compte, sans annoncer le standalone aux viewers Twitch. Le flux doit être opérationnel avant le batch global.
D. **Recette Kichnifou de parité finale / autorité** : prouver toutes les familles de commandes, les messages ordinaires nécessaires, absence de double effets, et préparer une autorité native durable qui survit aux restart pour 31B tout en gardant un kill switch immédiat. L’armement mémoire OFF-au-boot de R1042 reste un mécanisme de pilote, pas l’autorité permanente du batch.
E. **31A Ceo** : migration réelle d’un seul autre viewer, qui reste uniquement sur Twitch ; aucune révélation/inscription standalone. Streamer.bot reste autoritatif pour les autres. Comparaison/rollback/gate par User ID.
F. **31B batch** : snapshot final, résolution Helix fraîche, rehearsal finale, population vérifiée + quarantaines explicites, migration, puis transfert d’autorité unique Streamer.bot → natif. Les viewers continuent à utiliser les mêmes commandes Twitch sans changement visible.
G. **32** : validation finale V1.

**Bootstrap nouvelle conversation :** lire AGENTS.md, .chatgpt/CHATGPT_GUIDE.md, ce Master, docs/process/implementation-workflow.md, docs/process/conversation-handoff.md, docs/roadmap/implementation-order-v1.md, docs/commands/command-reference.md, docs/process/legacy-cutover-runbook.md, docs/specifications/decisions-log.md, puis vérifier GitHub/infrastructure. Ne rien modifier lors de la première reprise ; reformuler le checkpoint et attendre confirmation propriétaire. Nouvelle conversation Codex : **BOOTSTRAP**, pas CONTINUITÉ implicite.

## Historique — mini lot UI arm/disarm R1042, 05/10/2026

**Baseline après fetch :** HEAD/review/main/origin/review/origin/main = **61c4eef63907292ca076ebb67945fd1a4201c809**, divergence 0/0 et worktree/index propres. Promotion backend et déploiement Railway SUCCESS rapportés par le propriétaire ; variable de capacité absente (OFF), sans nouvelle inspection de production dans ce lot.

**UI opérateur candidate :** Configuration / Compte Twitch, bloc « Pilote commandes Twitch » sous la réception Chat. Capacité OFF : bloc caché hors état encore armé à désarmer ; Chat inactif : préparation requise et armement interdit ; Chat ACTIVE : armement explicite ; état effectif actif : désarmement explicite, disponible même si le statut Twitch se dégrade. POST/DELETE authentifiés existants, corps vide et aucune identité client, puis GET du statut autoritatif. Verrou pending commun et protection contre une lecture de polling obsolète ; erreurs assainies. Aucun auto-arm au chargement, retour OAuth, polling ou remontage ; aucune UI de retry des réponses. Faveur/Gift/Snapshot préservés.

**Contrôles PASS :** AccountSettingsPanel et game-api, 106 tests ; typecheck frontend ; verify:full 8/8 (tests frontend/backend hors DB, builds/types/lint/diff-check). Rendu local headless isolé dans le GameShell complet avec CSS de production, desktop 1440×1000 et mobile 390×844 ; capacité OFF, Chat OFF, désarmé et armé contrôlés, sans appels publics. Aucune recette Twitch réelle ni DB requise/exécutée pour ce lot frontend ; aucun calcul/backend, schéma ou migration modifié.

**Publication / suite :** un commit review uniquement, main **61c4eef** inchangé, review attendu ahead 1/behind 0 ; STOP pour review ChatGPT. Aucun changement Railway, variable de capacité, OAuth réel ou armement réel. Pilote toujours NON ACTIVÉ ; Streamer.bot autoritatif. R1042 matérialisée, aucune nouvelle décision.

## Historique — correctif review R1042 du kill switch, 05/10/2026

**Baseline après fetch :** HEAD/review/origin/review = **96559356ddedca52fb9b5a2fea6c4d6694e4709a** ; main/origin/main = **db6d542604b91c15cffdb2dcea5dcd971d9af02a**, review ahead 1/behind 0, index/worktree propres. Review indépendante ChatGPT rapportée par le propriétaire : architecture validée, seul finding bloquant = arrêt statique nécessitant redeploy.

**Correction bornée :** env TWITCH_COMMAND_PILOT_ENABLED = capacité seulement, false interdit d'armer ; true laisse runtime OFF. Armement mémoire non persistant, false à chaque boot/restart/redeploy/crash, gate effectif capacité AND armed. POST authentifié /api/v1/me/twitch/commands/pilot exige requirePilot, Player actif lié Kichnifou et manager inspectant une subscription Chat ACTIVE, sans OAuth/create ni outbound. DELETE désarme sans appel Twitch/redeploy et empêche un arm en attente de réactiver le pilote. Status distingue available/capability/armed/enabled et EventSub. [R1042 précisée](../specifications/decisions-log.md), [architecture](../architecture/backend-architecture-v1.md).

**Opérations engagées :** contrôle avant parser/métier et chaque nouvel HTTP, aussi après acquisition différée du token. Un métier commencé finit idempotemment ; si désarmé après commit, résultat sauvegardé sans envoi. A SENT puis disarm laisse B/C PENDING ; réarmement + response-only retry sans nouveau Pull. HTTP déjà parti non annulable ; SENDING/AMBIGUOUS toujours bloqué. Aucun AppConfig muté, token persistant, calcul métier ou DDL changé, aucun impact Faveur/Giveaway/Gift. Mémoire **strictement pilote à une seule réplique**, état partagé à revoir avant multi-réplique/batch.

**Contrôles du complément PASS :** 385 tests ciblés / huit fichiers ; arm/disarm réel sans mutation du flag, OFF au boot/restart, env OFF interdit, refus d'identité/Player/manager/subscription inactive ou pending, auth 401/403 et paramètres stricts, status vivant, arm en attente invalidé, arrêt avant parser/métier/HTTP et pendant acquisition de token, multipart A SENT puis B/C repris sans moteur. PostgreSQL privé, trois fichiers séquentiels : pilote six tests (dont disarm après vrai commit Pull), webhook neuf, Faveur quinze ; 30 PASS. Duplicate/concurrence, TWITCH, une dépense/un résultat, aucune WebIdentity/GlobalChatMessage conservés. verify:full 8/8 : 1 296 tests frontend / 122 fichiers, 1 697 backend / 121 fichiers, builds/types/lint et diff-check. Prisma validate/status PASS, 60 migrations inchangées ; aucun DDL appliqué. Fixtures écrites uniquement dans les schémas privés du lot, tous nettoyés ; schéma privé préexistant conservé, inventaire/empreinte identiques. Huit tables publiques contrôlées par count/empreinte JSONB avant-après inchangées ; aucune donnée privée/token ajouté.

**Publication / suite :** commit complémentaire review uniquement, main db6d542 inchangé, review attendu ahead 2/behind 0 ; STOP pour nouvelle review indépendante ChatGPT. Pilote NON ACTIVÉ, aucun changement Railway/OAuth/Streamer.bot ni migration publique/31A. Future recette propriétaire : OAuth → subscription ACTIVE → Streamer.bot OFF → arm runtime → tests → disarm runtime → vérification → Streamer.bot réactivé.

## Historique — candidat initial transport Twitch R1042, 05/10/2026

**Baseline certifiée après fetch :** HEAD/review/main/origin/main/origin/review = **db6d542604b91c15cffdb2dcea5dcd971d9af02a**, divergence 0/0, worktree/index propres. Déploiement Railway SUCCESS rapporté par le propriétaire, non revérifié en direct dans ce lot. Étape 30 clôturée R1041 ; aucune réouverture de la rehearsal ni de 29.

**CANDIDAT TECHNIQUE À REVIEW — NON ACTIVÉ.** Mission [R1042](../specifications/decisions-log.md) : transport générique temporaire, uniquement le Player actif réellement lié à Kichnifou et allowlisté. `TWITCH_COMMAND_PILOT_ENABLED` OFF par défaut, distinct de l'observation EventSub. HMAC puis consumers existants, gate auteur par User ID avant parser ; broadcaster/receiver identiques, pas de matching par nom d'affichage. Six lectures sans arguments !pity/!banniere/!team/!sac/!quotis/!exp, aliases canoniques et !pull/!pull 1 seulement ; toute autre commande/argument silencieusement ignoré. Giveaway exclusif écarte le chemin générique ; Faveur/Giveaway/Gift préservés.

**Architecture :** noyau de présentation partagé avec le Chat, acteur Player serveur opaque sans faux subject ni WebIdentity, mêmes services et moteur Pull avec SourceChannel.TWITCH. R1040 et calculs inchangés ; aucun message Twitch/résultat copié dans GlobalChat. Scope runtime user:write:chat ajouté, réautorisation propriétaire future nécessaire ; aucun token utilisateur persistant. App token à la demande, envoi Helix au message parent avec segments ≤500 caractères Unicode et validation de l'ack, sans secrets. [Architecture](../architecture/backend-architecture-v1.md), [commandes](../commands/command-reference.md).

**Preuve durable / limites :** receipt exempté de la rétention avant métier, verrou de ligne et clé stable du moteur commun pour éviter tout double Pull/dépense/récompense. Réponses sauvegardées séparément ; retry opérateur authentifié limité à la réponse, sans parser/métier. Refus certain récupérable ; SENDING/AMBIGUOUS bloque le résend automatique. Crash après succès Twitch avant stockage local reste incertain, aucune prétention exactly-once externe. Status minimal, aucune certification outboundReady inventée. Aucun DDL/migration ajouté.

**Contrôles du candidat PASS :** 365 tests ciblés / 8 fichiers ; verify:full 8/8 (1 296 tests frontend / 122 fichiers, 1 677 tests backend / 121 fichiers, builds, typechecks, lint et diff-check). PostgreSQL privé, sept fichiers exécutés séquentiellement : nouveau pilote 5, webhook 9, observer 4, runtime 3, Faveur présence 15, Giveaway 9, Gacha 30 cas distincts validés. Nouveau pilote via vrai webhook signé, vrai Player Twitch-only et moteur Pull : concurrence, replay final, réponse-only, reprise après commit, source TWITCH, aucune WebIdentity/GlobalChatMessage créé. Assertion Giveaway périmée 56 remplacée par la comparaison exacte du registre aux dossiers versionnés ; contrôle RLS/grants maintenu. Gacha : 29/30 au premier run, un timeout d'historique à 25 s, puis cas isolé PASS 1/1 (29 skipped), sans modifier timeout/code jeu ; aucune panne fonctionnelle restante. Avertissement existant pg de requêtes concurrentes observé dans les tests privés, non corrigé dans ce périmètre.

**DB / confidentialité :** Prisma validate PASS, migrate status à jour, 60 migrations inchangées. Aucun DDL/migration appliqué. Écritures de fixtures uniquement dans les schémas privés du lot, tous nettoyés ; le schéma privé préexistant conservé. Comptages et empreintes JSONB avant/après identiques sur huit tables publiques (Players, WebIdentity, TwitchIdentity, MigrationBatch/Run, ResourceMovement, BusinessOperation, GlobalChatMessage) ; inventaire/empreinte des schémas privés identiques. Aucun token, JSON privé ou ID réel ajouté au diff.

**Publication / reprise :** un commit dédié sur review uniquement ; main doit rester db6d542604b91c15cffdb2dcea5dcd971d9af02a, review ahead 1/behind 0. Prochaine action : **review indépendante ChatGPT**, puis promotion/déploiement/recette propriétaire dans des missions séparées. Aucun flag Railway ON, aucun consentement ni appel Twitch réel, aucun arrêt Streamer.bot, aucun Pull public, aucune migration Ceo/43 Players ni 31A. Streamer.bot reste autoritatif. [Runbook futur](../process/legacy-cutover-runbook.md#gate-distinct--futur-pilote-réel-kichnifou-only-r1040-non-exécuté).

## Historique — arbitrage final étape 30 du 05/10/2026

**Baseline réelle :** fetch ; HEAD/review/origin/review = **d4e2b666d2859c11566b5c73d7d850175466c5a2**, main/origin/main = **32bf76dbef8eebfecc790f4e407514c25f56b937**, review ahead 3/behind 0, index/worktree propres. Les trois commits antérieurs ont reçu les reviews indépendantes ChatGPT rapportées par le propriétaire.

**Décision propriétaire [R1041](../specifications/decisions-log.md) :** 43 identités vérifiées restent incluses ; deux NOT_FOUND passent en **QUARANTINED / DEFERRED**, sans PlannedPlayer, Player, TwitchIdentity, MigrationRun ni gameplay importé. Fichier opérateur local ignoré strict, lié au hash du snapshot, avec exactement l'ensemble missing ; aucun conflit/doublon admis. Sans ce fichier, le gate missing reste bloquant, confirmé par le CLI réel avant création de schéma. Aucun rapprochement par pseudo. Une migration complémentaire dédiée reste possible après vérification future d'un ID.

**Population réelle confirmée :** nouveau rapport Helix courant, **43 résolus / 2 missing / 0 renamed / 0 conflicts / 0 duplicates**. Capture **20261004T200232514Z**, hash **d0cf57becc4645a97c6b634e78ca4e075222aac7ea77f97d234ab83f7be7d486**, **216 profils / 45 éligibles / 43 inclus / 2 quarantainés / 171 exclus**, 17 sources/0 inconnu/0 autre blocker. **Un compte web réutilisé par User ID, 42 futurs Twitch-only, neuf comptes web non rattachés.** Faits interjoueurs différés pour cette capture : **0, aucun domaine** ; fixtures de régression avec faits différés explicites. Le snapshot conserve intégralement les deux profils et leurs preuves ; aucun login/ID ni JSON privé versionné.

**Rehearsal réelle complète PASS — VERIFIED_TWITCH_IDENTITIES_WITH_QUARANTINE :** plan avant purge, **117 tables / 117 lignes / 14 tables non vides** ; comptes/rôles/prefs/privacy conservés. **43 mappings et runs, 43 TwitchIdentity, 52 Players privés dont dix comptes web préexistants** ; deux dispositions TWITCH_IDENTITY_QUARANTINED, aucun mapping/run/gameplay importé pour les différés. Rollback injecté après tous les domaines avec image intégrale inchangée, restauration de l'état initial puis second import logiquement identique, sauvegarde/restauration exactes. Empreinte numérique réelle **ebf0fa5355d25ff44e893967bde9d675e82021dbd96118ff04de11b8e0acc761**. Backup importé vérifié séparément : 43 mappings conformes au rapport actuel, PV de chaque Boss identiques au snapshot, dont **1 360 000 PV max** pour le courant, base 1 500 000 et variation dérivée ; aucune règle native Boss ni présentation Pull changée.

**Domaines réels contrôlés :** Social 86 amitiés/19 demandes/172 carryovers ; Boss 3/27 contributions/19 preuves de distribution sans montants inventés, sept divergences cumulatives consignées ; Codes 12/82 claims/deux archivés ; Event actif 11 participants/quatre milestones/sept états quotidiens/GameB et message conservés ; Banner une rotation/sept votes/13 cibles valides/30 invalides ; Combat courant une rencontre/sept victoires/12 KO ; Faveur 43 états/18 claims sources ; Giveaway une session/un résultat/cinq participants/22 stats/aucune récompense ; Contest sans actif/un verrou périmé écarté. Progression/date XP 43, domaines personnels importés uniquement pour les inclus. **Zéro BusinessOperation, ResourceMovement, PullOperation, BankTransaction, BossAttack, FriendHeart ou historique/récompense fictifs.** 524 issues agrégées sans blocker, dont 481 anomalies personnelles connues (448 Missions, 31 Teams, une Box, une C6), et deux quarantaines d'identité ; aucune perte source silencieuse.

**Contrôles finaux PASS :** 171 tests ciblés / 11 fichiers, 18 tests PostgreSQL privés / 7 fichiers séquentiels, typechecks backend et scripts. Rehearsal complète ISOLATED_FIXTURE : 45 importés, rollback/idempotence/sauvegarde-restauration exacts, empreinte numérique **386537672626efabddd1b31663477a75275ab73b3790bf4f7151d6a10d3c7f32** inchangée. Verify-ddl : **1 134 colonnes / 16 tables foundation / 29 provenance-sécurité**, Prisma migrate status **READ ONLY : 60 migrations à jour**, aucune nouvelle migration/application publique. **Verify:full PASS 8/8 dès la première passe : frontend 1 296 tests / 122 fichiers, backend hors DB 1 596 tests / 118 fichiers**, types/builds/lint/diff-checks. Logs complets sous TEMP : `gacha30-close-*.log` et `gachaimpact-verify-full-eSxxpz`.

**Audit public et source PASS :** empreintes exactes inchangées pour Players, WebIdentity, TwitchIdentity, MigrationBatch/Run, ResourceMovement et BusinessOperation ; tous les schémas créés par ce lot nettoyés, un schéma privé préexistant conservé. Snapshot/hash inchangés, les deux profils différés toujours présents ; rapports/quarantaine/backups conservés localement, ignorés Git. Aucune écriture publique, migration de schéma ou activation Twitch.

**Clôture 30 acquise selon R1041 :** 43 VERIFIED + deux OWNER_APPROVED_IDENTITY_QUARANTINE, zéro autre blocker, rehearsal réelle/rollback/idempotence/backup-restauration et contrôles complets verts. La chaîne complète depuis main est conservée sans réécriture ; SHA commun et contrôle distant main == review/divergence 0/0/worktree propre au rapport final. Cette clôture de foundation/rehearsal ne constitue ni un cutover ni une validation publique des déploiements.

**Prochaine mission : pilote réel Kichnifou-only, NON COMMENCÉ.** Aucun parser/outbound/EventSub supplémentaire, rattachement, migration publique/Ceo/31B ni arrêt Streamer.bot dans ce lot. Twitch natif OFF ; Streamer.bot reste autoritatif. Pour 31B, les deux quarantaines restent visibles au plan et non migrées tant qu'aucun ID n'est vérifié.

## Historique — sécurisation étape 30 du 05/10/2026

**Baseline réelle :** fetch ; HEAD/review/origin/review = **f6ae4a8b016cb4509d50dfee135648bbc34cedf9**, main/origin/main = **32bf76dbef8eebfecc790f4e407514c25f56b937**, review ahead 2/behind 0 et index/worktree propres. Review indépendante ChatGPT de f6ae4a8 rapportée par le propriétaire ; complément sur review uniquement.

**Finding corrigé :** le rapport antérieur facultatif ne fournit plus un mapping depuis un JSON libre. Loader historique dédié et strict : version/marqueur, hash/date, lignes complètes, identités uniques, renommages cohérents, chemin ignoré sans traversée ni lien. Scan automatique par ancien login exact ; receipts complémentaires publics READ ONLY avec contrat observer/transport contrôlé. Concordance des sources obligatoire et nouvelle vérification Helix par ID de chaque candidat utilisé, y compris protection contre un login réattribué. Le rapport courant garde ses exigences de fraîcheur/hash/population. Contrat durable dans l'architecture et procédure dans le runbook ; aucune nouvelle décision produit ni entrée decisions-log.

**Recherche réelle agrégée :** un rapport historique préexistant valide, zéro receipt utile, zéro candidat supplémentaire pour les deux absents. Nouveau rapport courant local ignoré : **Helix direct 43, récupérés par historique 0, résolus 43/45, renommés 0, missing 2, conflicts 0, duplicates 0**. Même snapshot/hash du 04/10, 17 sources/0 inconnu et 45 éligibles. Aucun login/ID personnel versionné ou affiché. Credentials présents seulement, valeurs non exposées.

**Contrôles du complément PASS :** **174 tests ciblés / 10 fichiers**, dont webhook signé/rétention, **17 tests PostgreSQL privés / 6 fichiers séquentiels**, typechecks backend et scripts. Rehearsal complète **ISOLATED_FIXTURE** : 45 importés, 17 sources/0 inconnu, plan avant purge de 117 tables/117 lignes privées, rollback avec hash intégral inchangé, second import logiquement identique et sauvegarde/restauration exactes. Empreinte numérique **386537672626efabddd1b31663477a75275ab73b3790bf4f7151d6a10d3c7f32**, identique à la baseline ; aucun calcul Boss ni rendu Pull modifié, aucune opération/reward fictive. Le préflight **VERIFIED_TWITCH_IDENTITIES** confirme deux blockers avant création du schéma. Verify-ddl : 1 134 colonnes/16 tables foundation/29 provenance/sécurité ; migrate status READ ONLY : 60 migrations à jour, aucune nouvelle migration/application publique.

**Verify:full final PASS 8/8 :** frontend **1 296 tests / 122 fichiers**, backend hors DB **1 575 tests / 116 fichiers**, types/builds/lint/diff-checks. Première passe 7/8 : assertion frontend MP « saisie » après expiration de sa fenêtre réelle de 120 ms ; test isolé PASS puis suite complète PASS, sans modification frontend ni délai. Cette observation de stabilité du test reste distincte du correctif d'identité. Logs complets locaux : `gacha30-proof-*.log`, premières étapes dans `gachaimpact-verify-full-CTR2zN`, passe finale dans `gachaimpact-verify-full-jKMD0V`, sous TEMP.

**Audit public/nettoyage :** empreintes exactes inchangées pour Players, WebIdentity, TwitchIdentity, MigrationBatch/Run, ResourceMovement et BusinessOperation ; aucun schéma créé par ce lot restant, un schéma privé préexistant conservé. Rapports/backups locaux ignorés, aucune exportation de receipts ni valeur de credential dans Git/logs partagés.

**Sortie toujours bloquée :** deux identités non retrouvées, **décision propriétaire nécessaire**. Rehearsal complète réelle **NON EXÉCUTÉE** ; aucun import partiel ni exclusion silencieuse ni mapping inventé. Rapprochement par User ID des résolus : **un compte web réutilisable, 42 futurs Twitch-only, neuf comptes web non rattachés**. Étape 30 reste **ACTIVE** ; aucune certification réelle issue des fixtures. Prochaine action : review indépendante ChatGPT du complément review et arbitrage propriétaire sur les preuves manquantes. Pilote Kichnifou non commencé, main inchangé, Twitch natif OFF et Streamer.bot toujours autoritatif.

## Historique — continuation étape 30 après review de eeca318, 05/10/2026

**Baseline réelle :** fetch ; HEAD/review/origin/review = **eeca31867444074c71e7dccaf43b57276e62ad1a**, main/origin/main = **32bf76dbef8eebfecc790f4e407514c25f56b937**, review ahead 1/behind 0 et worktree/index propres. Review indépendante ChatGPT de eeca318 rapportée par le propriétaire : Pull, Boss legacy 1 360 000 PV et preuves privées acceptés. Continuer sur review, aucune promotion main autorisée.

**Snapshot inchangé vérifié :** capture du 04/10/2026 à 20:02 UTC, hash **d0cf57becc4645a97c6b634e78ca4e075222aac7ea77f97d234ab83f7be7d486** ; 17 sources, 29 463 chemins classifiés/0 inconnu, 216 profils/45 éligibles/171 exclus. Manifest et tailles/hashes validés par le loader avant résolution Helix.

**Identités réelles :** credentials présents/non vides dans server/.env ignoré, valeurs jamais exposées. Helix : **43/45 RESOLVED, 0 renommage, 2 NOT_FOUND, 0 CONFLICT, 0 DUPLICATE**. Rapport détaillé local ignoré seulement. Rapprochement public en transaction READ ONLY : 10 Players/comptes web, une TwitchIdentity, **1 compte web réutilisable, 42 futurs Twitch-only parmi les résolus, 9 comptes web non rattachés**. Aucune liaison par pseudo ; aucun Player/identité/session/batch public muté.

**Chemin réel :** option explicite --identities, rapport versionné TWITCH_HELIX/local ignoré, hash/population exacts, âge maximal 24 h et date non future, IDs/logins uniques et renommage cohérent ; erreurs et stdout expurgés. Même buildLegacyGlobalPlan dans les deux modes. Mode réel VERIFIED_TWITCH_IDENTITIES : projection publique read-only des comptes/rôles/prefs/privacy ; copie privée sans emails, subjects Auth ni credentials. Mode ISOLATED_FIXTURE conservé. Comptes/rôles/prefs non gameplay/privacy contrôlés ; le tri Box conserve son remplacement legacy déjà prévu au contrat.

**BLOCKER sortie 30 :** deux profils éligibles non retrouvés par Helix, aucun ancien rapport vérifié disponible localement au début de cette continuation. Le préflight réel est exécuté et bloque **avant création du schéma/purge/import** sur deux TWITCH_IDENTITY_UNRESOLVED. Rehearsal complète de la population réelle **NON EXÉCUTÉE** ; aucune exclusion ou correspondance inventée. Une reprise par User ID préalablement vérifié doit être revalidée par Helix. Étape 30 reste ACTIVE, non certifiée techniquement terminée.

**Contrôles de continuation PASS :** **106 tests ciblés / 7 fichiers**, **16 tests PostgreSQL / 5 fichiers**, typechecks backend et scripts. Rehearsal complète ISOLATED_FIXTURE : 45 importés, 17 sources/0 inconnu, rollback intégral, imports sur état restauré identiques, sauvegarde/restauration exactes ; trois Boss/19 preuves legacy, 82 claims Codes, 19 claims Faveur, GiveawayWin sans reward, zéro opération/mouvement/historique fictif. Empreinte numérique identique au candidat précédent. Tests privés du nouveau chemin : rapport vérifié de fixture, renommage/Player existant et Twitch-only sans liaison par pseudo, lecture des comptes en READ ONLY, rollback/restore/idempotence et conservation des prefs non gameplay/privacy/rôles. Verify-ddl PASS : 1 134 colonnes, 16 tables foundation, 29 colonnes de provenance et sécurité vérifiée ; migrate status public READ ONLY : **60 migrations à jour**, aucune migration ajoutée/appliquée. **verify:full final PASS 8/8**, frontend **1 296 tests / 122 fichiers**, backend hors DB **1 535 tests / 115 fichiers**, builds/types/lint/diff-checks. Logs complets locaux : gacha30-real-*.log et gachaimpact-verify-full-DksJtS dans TEMP. Aucun PASS fixture n'est une preuve d'identité réelle.

**Échecs intermédiaires :** fixture DB complétée pour ses champs obligatoires ; vérification de préservation corrigée pour distinguer le tri Box gameplay déjà prévu. Première passe verify:full 7/8 : test frontend de pagination Chat au plafond de 200 lignes dépassant 15 s ; non reproduit isolément (1 test passé / 64 filtrés, 1,92 s), puis suite complète verte sans modification frontend ni timeout. Warnings non bloquants habituels : lint frontend hors périmètre, chunk >500 kB et dépréciation pg. Aucun défaut final restant hors des deux identités manquantes.

**Contrôle public/nettoyage :** 10 Players/comptes web, une TwitchIdentity, zéro batch et deux runs historiques inchangés ; empreintes exactes inchangées pour Players, WebIdentity, TwitchIdentity, MigrationBatch/Run, ResourceMovement et BusinessOperation. Sessions : 304 lignes, aucune créée/clôturée pendant l'audit ; empreinte évolutive et deux heartbeats récents, compatibles avec la présence du site actif, sans mutation par cette mission. Aucun schéma créé par le lot restant ; schéma privé préexistant conservé. Backups/rapports ignorés, répertoire backups sans droit de lecture large. Pull et Boss natif inchangés dans cette continuation.

**Prochaine action exacte : REVIEW INDÉPENDANTE CHATGPT DU NOUVEAU SHA REVIEW.** Publier le complément review uniquement, main inchangé. Les deux identités manquantes empêchent la sortie 30 ; le gate Kichnifou-only reste futur, non commencé. Aucune migration ni activation Twitch/arrêt Streamer.bot. STOP après publication.

## Historique — candidat foundation étape 30, R1040 du 04/10/2026

**Baseline réelle :** fetch ; HEAD/main/review/origin/main/origin/review = **32bf76dbef8eebfecc790f4e407514c25f56b937**, divergence 0/0, index/worktree propres. Mission sur review uniquement ; exception de promotion 29 terminée. Le propriétaire déclare R1039 déployé ; aucun nouveau déploiement vérifié par Codex.

**Capture récente :** copie locale ignorée du 04/10/2026 à 20:02 UTC, hash **d0cf57becc4645a97c6b634e78ca4e075222aac7ea77f97d234ab83f7be7d486** ; dossier vivant read-only, copies/manifest vérifiés. **17 sources, 29 463 chemins classifiés, 0 inconnu, 216 profils / 45 éligibles / 171 exclus**. Aucune donnée individuelle dans Git. Détails et commandes au [runbook](../process/legacy-cutover-runbook.md#historique--capture-et-contrôle-du-candidat-du-04102026).

**Fondation :** plan de purge exhaustif actualisé pour Arcade/Giveaway, credentials opérationnels préservés sans activation ; préflight des nouveaux Players sans création, plan/ordre FK et volumes avant mutation. Rehearsal globale atomique, erreur injectée après les domaines partagés, sauvegarde/restauration privée et second import sur état restauré. Boss legacy conserve les PV exacts, base 1 500 000 et pourcentage dérivé tracé en provenance R435/R436/R1040 ; Boss vivant à defeatedAt vide accepté, règles natives R449 inchangées. Aucune migration/schema/calcul natif ajouté.

**Pull :** suffixes constants Hydro et Pyro/Geo supprimés uniquement du renderer ; effets moteur/snapshots conservés. Procs Cryo/Electro/Anemo/Dendro uniquement sur leurs tirages ; gains réels et stocks séquentiels, N messages, replay sans nouvelle résolution. Régression explicite Hydro RNG et montants Pyro/Geo dans la suite Gacha privée.

**Contrôles techniques :** scanner, Prisma generate/validate/status et verify-ddl PASS : **60 migrations à jour, 1 134 colonnes comparées**, catalogue 120 distinct, RLS/absence de droits navigateur sur les 135 tables métier lues. **280 tests ciblés / 18 fichiers PASS** ; **44 tests PostgreSQL / 5 fichiers PASS** (Gacha 30, snapshot personnel 6, contraintes 052 : 5, sauvegarde/Boss 2, confirmation 053 : 1), invocations séquentielles et schémas privés. **verify:full PASS 8/8** : frontend **1 296 tests / 122 fichiers**, backend hors DB **1 520 tests / 114 fichiers**, builds/typechecks, lint et diff-checks ; scripts de rehearsal/DDL également typecheckés explicitement. Warnings non bloquants : lint frontend hors périmètre, chunk frontend >500 kB et dépréciation pg des suites DB. Logs complets locaux : gacha30-*.log et gachaimpact-verify-full-gb8ejU dans TEMP.

**Preuves privées récentes PASS :** 45 profils importés, trois Boss dont le vivant à PV exacts, 82 claims Codes, 45 états Faveur/19 claims et un GiveawayWin legacy sans reward. Rollback injecté après tous les domaines : hash intégral cible identique ; deux imports sur état initial restauré : agrégats et sommes numériques exactes identiques ; sauvegarde/restauration intégrale privée vérifiée. Zéro opération/mouvement/historique/reward fictif ; comptes/rôles/prefs/privacy préservés et sessions invalidées dans la fixture. Schémas de cette mission nettoyés, aucun Player/batch public créé ; un autre schéma privé reste hors périmètre. [Agrégats complets, dispositions et corrections intermédiaires](../process/legacy-cutover-runbook.md#historique--capture-et-contrôle-du-candidat-du-04102026).

**BLOCKER sortie 30 :** credentials applicatifs TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET absents ; résolveur réel sorti 1 sans requête Twitch, **0/45 résolu par cette mission**. Réconciliation réelle avec l'identité immuable des comptes web et rehearsal sur ces correspondances **NON EXÉCUTÉES**. Lecture public seulement : 10 Players/comptes web, une TwitchIdentity, zéro batch. Les fixtures numériques privées ne sont pas des preuves d'identité ; le script de rehearsal actuel reste fixture-only et devra recevoir l'entrée vérifiée lors de la levée du blocker. Étape 30 **non certifiée terminée**, même avec tous les contrôles techniques verts.

**Prochaine action exacte : CHATGPT REVIEW DU SHA REVIEW DE L'ÉTAPE 30.** Candidat review uniquement, main inchangé et worktree propre à vérifier au rapport final. Gate futur Kichnifou-only documenté [R1040](../specifications/decisions-log.md) et runbook, **NON EXÉCUTÉ** ; aucun parser/outbound/EventSub supplémentaire, arrêt Streamer.bot, migration publique, Ceo/31A/31B ou cutover. STOP après publication.

## Historique — correctif final et clôture étape 29, R1039 du 04/10/2026

**Baseline contrôlée :** fetch exécuté ; HEAD/main/review/origin/main/origin/review = **36a068cf54afc359c140392826378590a6c9d0c7**, divergence 0/0, index/worktree propres, aucun descendant inattendu. Le propriétaire confirme publiquement que ce hotfix a rétabli le chargement normal de GachaImpact. Recette publique représentative R1038 terminée : tout ce qui n’est pas listé dans la mission finale est acquis dans ce périmètre, sans audit général rouvert.

**Correctifs R1039 :** Quotis visuels depuis vrais états/claims ; Échanges via projection sûre TradeService read-only (notamment Mynonyme sans particules Cryo), create inchangé ; Expédition active avec nom/remaining et aide READY ; alias passif et Help Liste explicite/helper ; Team/Shop/Sac compacts avec paramètres/prix/bundle modernes, sans objets spéciaux Sac Chat ; Concours avec lien standalone ; Event racine avec heure Europe/Paris, essais restants/maximum métier et statuts demandés. Pull : N tirages = N résultats principaux distincts, ordonnés et atomiques ; textes personnages/ressources, faits 5★/C6/gains/passifs modernes, soldes exacts par étape persistés en strings dans le snapshot existant puis rejoués sans portefeuille live. Nom acteur figé dans l’intention Chat. Pipeline Mission/Défi et calculs/économie inchangés.

**Validation automatique finale :** tests ciblés Chat/route Gacha **286 tests / 7 fichiers PASS** et typecheck backend PASS. PostgreSQL **90 tests / 3 fichiers PASS** : Gacha **30**, Échanges **25**, GlobalChat **35**. Soldes séquentiels exacts, refunds C6/compensation/particules et historique, rollback des parties x1/x3/x10, reprise après échec de publication puis changement de portefeuille/nom joueur, IDs stables et aucun second mouvement. **verify:full PASS 8/8** : frontend **1296 tests / 122 fichiers**, backend hors DB **1509 tests / 112 fichiers**, builds/typechecks frontend/backend, lint et diff-checks worktree/index. Logs complets locaux : gachaimpact-verify-full-qeGBoH et gacha-final29-*.log dans le dossier temporaire de cette session. Warnings non bloquants : lint hors périmètre, chunk frontend >500 kB et dépréciation pg des suites DB. Aucune erreur finale restante. Schémas exclusivement privés, une invocation par fichier, séquentielles. Aucune fixture métier dans public ; aucune migration/table/schéma Prisma ni configuration de déploiement/Twitch modifiés. Échecs intermédiaires : attentes des anciens rendus/fixtures ajustées ; test MAX Échanges corrigé pour appeler le propriétaire avec undefined au lieu du défaut 300 de sa fixture. Aucun assouplissement des validations de création ni des timeouts.

**Documentation et décision :** [R1039](../specifications/decisions-log.md), [contrats des onze retours](../commands/command-reference.md#restitution-finale-propriétaire--r1039), couverture des 37 sources et protocole 29 actualisés ; seule contradiction spécialisée Sac/Shop corrigée. **29 CLÔTURÉE PAR DÉCISION PROPRIÉTAIRE**, après corrections/tests et publication explicitement autorisées sans nouveau gate manuel ni review ChatGPT intermédiaire. Dernières corrections testées automatiquement : aucune recette publique individuelle post-correctif présumée.

**Publication :** un candidat dédié review puis CE MÊME commit main par fast-forward strict, pushes normaux, SHA distant commun/divergence 0/0 et propreté contrôlés au rapport final ; aucun commit supplémentaire pour inscrire son propre SHA. Déploiement du nouveau SHA non vérifié par Codex, à contrôler séparément par ChatGPT. L’autorisation de clôture n’est pas une preuve de déploiement.

**Prochaine étape globale : 30 — FOUNDATION / REHEARSAL PRIVÉE, NON COMMENCÉE.** STOP après publication et rapport. Streamer.bot reste autoritatif ; aucun parser natif global/outbound/nouvelle EventSub/cutover/pilote 31A/31B ni migration exécutés. L’exception de promotion 29 ne s’étend pas aux missions suivantes ; aucune poursuite automatique.

## Historique — étape 29, hotfix production après R1038 du 04/10/2026

**Baseline contrôlée :** fetch réussi ; HEAD = origin/main = origin/review = **9158b9a5df432762ea5ab71e86ce202568a41c67**, review et index/worktree propres. Aucun descendant distant inattendu. Promotion du même correctif review → main par fast-forward strict explicitement autorisée dans la mission.

**Incident post-déploiement R1038 signalé et vérifié par le propriétaire :** Railway UP, autres endpoints de bootstrap 200, mais GET `/api/v1/me/combat/boss` 500 avec `TypeError: Do not know how to serialize a BigInt`. L'ajout de `publicSummary` dans la vue métier R1038 traversait le spread du serializer HTTP sans conversion des BigInt imbriqués. Le défaut est reproduit localement par injection HTTP avec Boss vivant et défait, pas par appel en production.

**Correctif :** helper commun de sérialisation de MonthlyBossSummary, réutilisé par `defeatedSummary` et `publicSummary` ; BigInt exacts en strings, Date en ISO. Le résumé métier reste disponible pour `!combat stat/stats`, sans mutation ni changement du service, calculs, DB ou schéma. Correction minimale du bootstrap : l'erreur fatale de la session authentifiée passe avant l'écran loading ; après les retries existants, un échec définitif affiche « Connexion impossible ». Aucun nouveau retry, timeout ou refactor.

**Validation :** régressions en échec avant correction, puis 202 tests ciblés backend / 5 fichiers et 12 tests frontend / 3 fichiers PASS, dont injection HTTP Boss vivant/défait, précision au-delà de Number.MAX_SAFE_INTEGER, dates ISO, domaine inchangé, Chat stat/stats et rendu réel du bootstrap après deux échecs Boss. `verify:full` PASS **8/8** : **1296 tests frontend / 122 fichiers**, **1458 tests backend hors DB / 111 fichiers**, builds/typechecks frontend et backend, lint et diff-checks. Logs complets locaux : `gachaimpact-verify-full-NA8TaY`. Warnings préexistants non bloquants de lint et chunk frontend >500 kB. Tests DB non exécutés pour ce hotfix : sérialisation/rendu uniquement, services métier et DB inchangés.

**Publication et reprise :** hotfix dédié publié sur review puis même commit promu sur main par fast-forward strict, refs finales/chaîne/divergence 0/0 et propreté contrôlées au rapport de publication. Aucune migration, écriture DB, activation Twitch, nouvelle décision durable ou réouverture de l'audit 29. **Déploiement du hotfix et recette publique restent à vérifier par ChatGPT au SHA exact**, notamment GET Boss 200 et fin normale du bootstrap. Le constat propriétaire de l'incident n'est pas une vérification du déploiement correctif par Codex. Étape 29 toujours ACTIVE. STOP après publication et rapport.

## Historique — étape 29, 31 sources restantes, lot R1038 du 04/10/2026

**Gate initial exécuté :** fetch réussi, review propre ; HEAD = origin/main = origin/review = **f3c17fe326b8ee485a67db9fa3da6f332f3240da**, divergence 0/0. Le précédent lot Banque/Box/Code/Coffre R1037 est bien publié sur les deux branches ; son diff depuis 6a4bea61bb3649a87e607f3ac1c20547078526bb a été contrôlé. Ses preuves techniques sont historiques ; son déploiement et sa recette ne sont pas déduits de Git.

**29 ACTIVE — délégation et livraison regroupée R1038 :** les 31 sources restantes sont lues intégralement, helpers compris, Event sur les douze mois et XP/Gift/Subscription sur tous leurs traitements. La [couverture des 37 sources](../commands/step-29-command-coverage.md) sépare les six premières livraisons conservées et la présente adaptation Chat. Mutations Team et Shop mission/switch raccordées aux propriétaires existants ; aliases demandés, réponses complètes/glyphes/durées françaises, Pull/C6/passifs/XP, lectures privées Social, actions groupées Échanges, Combat/Boss/Expédition et jeux Event alignés sur les contrats modernes. Concours et Faveur restent en lecture ; Wish/Giveaway et les triggers restent derrière leurs gates Twitch. Aucun moteur économique legacy restauré.

**Intégrité :** intentions cibles/quantités/actions figées ; reçus et résultats stables réutilisant BusinessOperation et les schémas existants, multiparties atomiques R1037 et refresh UI ciblé conservés. Pas de double coût, gain, réservation, toggle ou cooldown via retries/aliases. Aucun fichier legacy, frontend, configuration de déploiement, scheduler, schéma Prisma ou migration modifié ; aucune fixture métier écrite dans public.

**Validation technique finale : PASS.** 249 tests ciblés / 7 fichiers réussis. `verify:full` réussi **8/8** : frontend **1295 tests / 121 fichiers**, backend hors DB **1454 tests / 111 fichiers** ; builds frontend/backend, typechecks, lint et diff-checks worktree/index réussis. Logs complets locaux : `gachaimpact-verify-full-jvyse9` dans le dossier temporaire de cette session. Warnings non bloquants constatés : lint préexistant hors périmètre, chunk frontend >500 kB et dépréciation pg des suites DB. Aucune erreur finale restante.

**PostgreSQL : 255 tests / 24 fichiers PASS**, chacun dans les schémas privés prévus, une invocation par fichier, séquentiellement : Team 15 ; DailyChallenge 10 ; Shop 10 ; Event/Shop 8 ; GlobalChat 35 ; Gacha 25 ; Échanges 23 ; Roue vertical slice 2 ; Box 2 ; BannerVote 3 ; Expédition 15 ; Combat quotidien 9 ; Boss 10 ; Social 10 ; Social/Faveur 4 ; Ranking 5 ; Missions permanentes 21 ; Event replay Chat 4 ; Event socle/Jeu A 8 ; Jeu B 7 ; Jeu C 8 ; calendrier 5 ; classement Event 1 ; paliers Event 15. Le replay après commit et échec de publication conserve gains/IDs, aucun double mouvement ; snapshots après autre action, concurrence UI, ensemble initial des échanges et changement de mois sont couverts. Les dates legacy inconnues du classement restent compatibles. Ces fixtures ne constituent pas une recette publique, aucune écriture de fixture métier dans public.

**Échecs intermédiaires et relances :** assertions de présentation adaptées aux contrats livrés, fixture Échanges départagée par dates/ID, nouvelle assertion pity 4★ corrigée (un 5★ ne la remet pas à zéro), assertions Roue complétées avec le champ de propre replay et erreur de typage du mock MAX corrigée. Une première passe backend chargée a dépassé le timeout existant d'un test Arcade HARD ; aucune modification Arcade ni des timeouts/assertions pour masquer cet échec. La passe complète finale sans suite lourde parallèle passe. Tous les fichiers concernés ont été relancés avec succès.

**Publication du lot :** un seul candidat global complet publié sur review, puis exactement le même candidat promu sur main par fast-forward strict selon l’autorisation R1038, sans review ChatGPT intermédiaire. Les SHA et refs distantes, la chaîne de commits, la divergence finale 0/0 et la propreté de l’index/worktree sont contrôlés dans la mission et portés au rapport final ; aucun commit supplémentaire pour inscrire son propre SHA.

**Déploiement et recette propriétaire : NON VÉRIFIÉS / RESTANTS.** Textes choisis sous délégation, sans prétendre à une validation publique individuelle. Streamer.bot reste autoritatif ; aucun outbound/activation EventSub/pilote Ceo/cutover, aucune migration ni répétition 30 exécutée. 26/28 CLOSED et 27 CLOSED BY OWNER / SCOPE DECISION conservés ; 29 ACTIVE, 30/31A/31B/32 TODO selon leurs gates.

**Prochaine action exacte : ChatGPT vérifie le SHA et le déploiement exacts, puis fournit uniquement la courte recette essentielle du Chat standalone par famille** ([annexe](../commands/step-29-command-coverage.md#recette-propriétaire-essentielle-après-contrôle-du-sha-et-du-déploiement)). Pas de tableau d’erreurs purement système ni de répétition manuelle de tous les aliases. Tests Twitch séparés et non activés. STOP après publication et rapport ; aucune poursuite automatique ni clôture implicite de 29.

## Historique — étape 29, Banque / Box / Code / Coffre, lot R1037 du 04/10/2026

**Gate initial exécuté :** fetch réussi ; HEAD = origin/main = origin/review = **6a4bea61bb3649a87e607f3ac1c20547078526bb**, divergence 0/0, branche review et index/worktree propres. Lot dédié publié sur review, puis même candidat promu sur main par fast-forward strict selon la mission propriétaire et R1036 ; les refs finales contrôlées figurent au rapport de publication.

**29 ACTIVE ; les quatre contrats ont été VALIDÉS PAR LE PROPRIÉTAIRE AVANT CODE, puis IMPLÉMENTÉS / TESTÉS AUTOMATIQUEMENT / PROMUS.** [Décision R1037](../specifications/decisions-log.md). Banque : aliases historiques, textes alignés, MAX autoritatif et montant résolu stable au replay ; fonctionnement économique inchangé. Box : liste complète, filtres, C6 exact, pagination legacy, favoris possédés par nom exact normalisé et tris persistants via les services Box ; UI moderne inchangée. Code : découverte moderne complète conservée, succès avec gains positifs et nouveaux totaux autoritatifs, description moderne ; moteur Codes inchangé. Coffre : Collection positive complète, glyphes des douze clés historiques et fallback ❔, quantités (xN), tri alphabétique moderne. [Contrats détaillés](../commands/command-reference.md).

**Publication Chat :** extension interne opt-in de parties logiques pour les listes Box/Coffre/Code, coupure entre entrées, jamais au milieu d'un nom ou token ; publication transactionnelle atomique, IDs stables et replay sans doublon. Les commandes à résultat string conservent leur comportement existant. Aucun runtime JSON legacy ni nouvelle règle économique.

**Contrôles exécutés :** verify:full **8/8 réussi**, frontend **1295 tests / 121 fichiers**, backend hors DB **1359 tests / 107 fichiers**, builds, typechecks, lint et diff-checks. Suites PostgreSQL privées Banque **10**, Chat **34**, Box **2**, Codes **6** : **52 tests réussis**, incluant MAX rejoué après changement de solde, concurrence de publication et rollback de toutes les parties si la seconde échoue. Aucune écriture métier publique ni migration ; schéma Prisma inchangé. Warnings non bloquants : lint frontend hors périmètre, chunk frontend >500 kB et avertissement pg des suites DB. Contrôle du diff et de l'index avant commit, puis publication vérifiée au rapport final.

**Déploiement et recette : NON VÉRIFIÉS / RESTANTS pour ce lot.** Aucune validation publique des quatre commandes déduite des tests automatiques. Le lot Banniere / retrait Ami liste précédent reste historique avec ses limites de validation documentées. Statuts conservés : 26/28 CLOSED, 27 CLOSED BY OWNER / SCOPE DECISION, 29 ACTIVE ; 30, 31A, 31B et 32 restent TODO selon leurs gates. Streamer.bot reste autoritatif Twitch ; aucun parser/outbound/EventSub Chat/cutover/gate Ceo ni activation 31A/31B.

**Prochaine action exacte : ChatGPT vérifie SHA + déploiement puis fournit la checklist MANUELLE ESSENTIELLE de ces quatre commandes. STOP après ce lot ; aucun Combat.txt ni autre fichier legacy suivant commencé.** La recette propriétaire intervient après déploiement ; aucune poursuite automatique.

## Historique — étape 29, Banniere.txt et retrait Ami liste, lot du 04/10/2026

**Gate :** fetch exécuté ; baseline réelle origin/main = origin/review = 2e075dfba60e78ee479784037fa523218b44eb4e, divergence 0/0, review locale/index/worktree propres avant le lot. Un commit dédié publié sur review puis même candidat promu directement sur main par fast-forward strict dans cette mission selon R1036. Le rapport de publication porte les refs finales vérifiées ; aucun commit supplémentaire uniquement pour inscrire son propre SHA.

**29 ACTIVE ; Banniere.txt IMPLÉMENTÉ / TESTÉ AUTOMATIQUEMENT / PROMU, RECETTE RESTANTE.** !banniere canonique, !bannière et nouvel alias !ban, casse tolérée, !banner absent, erreurs de syntaxe canoniques. Présentation 🎯 Bannières, période inclusive Europe/Paris depuis startsAt/endsAt exclusive, emojis élémentaires et ordre autoritatif 4×5★ + 6×4★. Cible valide affichée ; cible absente/périmée = conseil !select. Absence de rotation = message français moderne. Consultation sans mutation ni auto-sélection ni runtime JSON legacy. Bannière normale unique ; borne conservatrice des plus longs noms du catalogue versionné sans cible : 237/500 caractères, aucun split nécessaire. [Contrat](../commands/command-reference.md#banniere).

**Ami : recette publique du lot R1035 confirmée par le propriétaire, sauf retrait demandé de la sous-commande liste.** Retrait complet implémenté/testé/promu (R1036) : sortie, résumé, Help/métadonnées, tests et exemples corrigés ; aucune dépréciation. Les services/listes Social restent disponibles ailleurs. !ami résumé/pseudo polyvalent, voir pur, demandes, ajouter/accepter/refuser/annuler/retirer, coeur/cœur/coeurs/cœurs et all/@all conservés. Le mot liste suit la résolution ordinaire d'un pseudo, sans sous-commande de liste. Nouvelle correction à recetter après déploiement.

**Méthode R1036 :** aliases systématiquement recherchés, split pertinent étudié individuellement, tableau seul avant prompt Codex et validation propriétaire avant code. Promotion review → main du même candidat dans la même mission pour tous les petits lots validés de 29 ; R1036 supersède la restriction R1035 au seul lot Ami. Exception bornée à 29, workflow normal conservé ailleurs. [Protocole canonique](../process/implementation-workflow.md#protocole-propriétaire--étape-29-uniquement-r1036).

**Validation technique :** 199 tests ciblés Chat dispatcher/registry/Ami réussis ; typecheck backend réussi. verify:full réussi 8/8 : frontend 1295 tests/121 fichiers, backend hors DB 1293 tests/106 fichiers ; builds frontend/backend, typechecks et lint réussis, diff-check worktree/index réussi. Warnings non bloquants : lint hors périmètre et chunk frontend >500 kB. Aucune migration ni modification Prisma/DB ; tests DB non exécutés, services métier inchangés. Contrôles Git du diff/index et publication exécutés avant le rapport final. Aucun test public du nouveau rendu Banniere/!ban présumé.

**Statuts conservés :** 26/28 CLOSED, 27 CLOSED BY OWNER / SCOPE DECISION, 29 ACTIVE ; 30 foundation/rehearsal privée TODO, 31A Ceo TODO, 31B batch après validation Ceo TODO, 32 smoke final TODO. Rotation, votes, cible, Pull, économie et Friendship métier inchangés. Streamer.bot reste autoritatif sur Twitch ; aucun parser natif global, réponse Twitch, EventSub Chat, cutover ou gate Ceo modifié. Aucun déploiement du présent lot vérifié, aucune recette publique Banniere/!ban ou retrait Ami liste acquise.

**Prochaine action exacte : vérifier le déploiement du SHA promu, puis recette propriétaire dans le Chat standalone de !banniere / !bannière / !ban / !BAN, syntaxe canonique, rendu et cible, résumé/Aide Ami sans liste. STOP après ce lot.** Aucun Banque.txt ni autre fichier legacy commencé ; fichier suivant uniquement après validation propriétaire et nouvelle mission.

## Historique — checkpoint documentaire R1034 du 04/10/2026

**Gate exécuté :** fetch réussi, branche review et index/worktree propres ; HEAD = origin/main = origin/review = **6d61a9b1954165c78dfe56e025983fe2c90f6006**, divergence 0/0. Baseline et parent exact du checkpoint documentaire ; publication sur review uniquement, main inchangée, ahead 1/behind 0 et worktree propre vérifiés au rapport. Aucun code/test/package/migration modifié, aucun cutover ou activation Twitch, aucune mutation publique.

**Preuves post-promotion reçues de ChatGPT, non réexécutées ici :** GitHub main==review au SHA exact 6d61a9b ; Railway production deployment **756f9dfd-0e81-46d1-ac42-d5b603c889b2**, commit exact **6d61a9b1954165c78dfe56e025983fe2c90f6006**, **SUCCESS / Online**, région **europe-west4-drams3a / EU West Amsterdam**, 1/1 running, 0 crashed/warning/critical. Predeploy : 60 migrations found / No pending migrations to apply, puis Application ready. Healthcheck Railway réel GET /health **HTTP 200**, environ **2,9 ms au contrôle de déploiement reçu**, pas un benchmark général. Dernière migration 20261003180000_060_add_arcade_multiplayer ; aucune 061. Aucune preuve Cloudflare distincte inventée.

**Recette publique finale 28 VALIDÉE PAR LE PROPRIÉTAIRE :** les cinq contrôles reçus ferment la recette : (1) Terminé ✅ + Réinitialisation dans… sans readyAt Expédition déjà satisfaite présenté comme reset ; (2) refus résolu sans nouvelle notification hôte, invitation initiale seule Notification Arcade ; (3) Rejouer FINISHED MULTIPLAYER → nouvelle SOLO/IA même jeu/difficulté ; (4) nouveau PvP uniquement liste/sélection/Prêt, aucune revanche automatique ; (5) overflow niveau 100 affiche explicitement Récompenses : et toutes les rewards réelles visibles sans troncature. **28 VALIDÉE / CLÔTURÉE PAR LE PROPRIÉTAIRE**, plus aucune recette 28 ACTIVE dans l'état courant.

**Acquis conservés :** trois jeux/trois difficultés, présence/opponents/invitations, Prêt/Annuler/Refuser/start hors écran, sessions partagées/navigation/rejoin, Memory/Puissance 4/Morpion PvP, score des deux/0 XP, Quitter partagé/polling optimisé, Amsterdam, notification invitation-only, Rejouer SOLO/PvP manuel, ancien contrat replay supprimé, reset Quotidiennes, LevelUpFeedback overflow, autostart Tutoriel, Titres, présence Social/MP et self mention. Les anciennes preuves restent acquises dans leur périmètre ; clôture n'invente aucun test rare supplémentaire.

**27 CLÔTURÉE PAR DÉCISION DE PÉRIMÈTRE PROPRIÉTAIRE :** fonctionnement jugé suffisamment stable ; le propriétaire préfère les bêtas et l'utilisation réelle pour détecter les anomalies rares. Cela ne signifie pas que tous les travaux envisagés ont été implémentés/exécutés. Aucune campagne supplémentaire de charge/responsive exhaustive/scénarios temporels artificiels obligatoire avant migration ; aucune optimisation coût, modification ContestScheduler/GiftCodeScheduler/cadences Chat/MP ou Serverless. La politique de rétention reste valide, ses protections conservées ; ce qui est implémenté reste actif selon ses gates, le non-implémenté devient backlog maintenance post-V1/besoin réel, sans obligation préalable au cutover.

### Observations bêta / situations réelles — acceptées, non bloquantes (R1034)

Les éléments suivants ne sont pas déclarés individuellement testés. Statut commun : **ACCEPTÉ — observation bêta / situation réelle, non bloquante** ; anomalie réellement observée → correctif borné, sans fabrication publique de progression/récompense/état pour obtenir une preuve.

- Prochain snapshot naturel R911 ; polish visuel R912.
- Variantes Apparence non spécifiquement observées.
- Notifications naturelles de Missions et autres producteurs Notifications rares.
- Calendrier de Noël naturel.
- Transitions naturelles Event, Concours, Boss et Faveur.
- Aliases techniques Tutoriel non testés manuellement.
- Cas limites nécessitant de fabriquer artificiellement un état public.
- Charge/performance Twitch.
- Maintenance/rétention non indispensable au fonctionnement actuel ; travaux non implémentés en backlog post-V1, sans implémentation présumée.

### Suite opérationnelle R1034 — numéros conservés

**29 ACTIVE / PROCHAINE** : passe exhaustive de TOUTES les commandes !, aliases/sous-commandes ; syntaxe, préconditions/permissions, coûts/cooldowns, domaine propriétaire, données lues/écrites, succès/erreurs, idempotence, sorties exactes, différences legacy, Chat standalone et compatibilité Twitch future. Comparer systématiquement legacy/streamerbot/commands/*.txt et [command-reference](../commands/command-reference.md), tester d'abord dans le Chat standalone avec Kichnifou puis validation propriétaire des textes/comportements. Ce checkpoint cadre 29 ; aucun sweep ni code exécuté ici.

29 prépare le futur remplacement transparent de Streamer.bot : syntaxes pertinentes/aliases conservés ou migration explicitement approuvée, réponses partagées lorsque pertinent, mêmes services PostgreSQL/économie/cooldowns, Twitch User ID immuable, état migré conservé sans réinscription manuelle due au backend. **Streamer.bot reste autoritatif aujourd'hui.** Préparer un gate natif OFF par défaut avec un seul propriétaire d'exécution par Player/message/commande, aucun double traitement/réponse/récompense, pilote Ceo/rollback puis batch après validation ; design/code exacts à décider dans les futurs lots 29 après lecture du runtime et des contraintes Streamer.bot. Aucun cutover Twitch en 29 ni activation dans ce checkpoint.

**30 À FAIRE = FOUNDATION / REHEARSAL, pas cutover :** snapshot récent, 17 sources/0 chemin inconnu, résolution Twitch/mappings, plan purge/import, FK/catalogues, import privé/idempotence/rollback/absence de double reward/claim, sauvegarde/restauration et plan exact de 31. Aucune écriture publique de migration ; Streamer.bot reste autoritatif. **31 À FAIRE**, numéro unique en deux phases : **31A CANARY CEO**, premier autre joueur réel ciblé, migration Ceo uniquement et domaines partagés explicitement bornés, comparaison données personnelles/ressources/progression/Box/Team/statistiques/Faveur, commandes natives ciblées et aucun double traitement, gate/rollback propre ; autres Players Streamer.bot. **31B BATCH** seulement après validation propriétaire Ceo, nouvelle capture si nécessaire/rehearsal correspondante, population résolue/blockers=0, import/agrégats/bascule d'autorité/désactivation des chemins remplacés. Jamais de bascule globale automatique après 31A. [Contrat migration](../architecture/legacy-migration-v1.md) et [runbook](../process/legacy-cutover-runbook.md).

**32 À FAIRE** : smoke final après batch/cutover, parcours principaux, anomalies réellement observées en bêta et stabilité V1. Les situations rares non survenues ne bloquent pas artificiellement la clôture. R1034 supersède R1032 sur l'ordre après 28, sans renumérotation ni suppression des protections de migration/rétention. Les sections anciennes ci-dessous sont historiques et ne redéclarent pas 27 différée, 28 ACTIVE ou les observations rares comme blockers courants.

### Autorisations d'infrastructure payante — périmètre

Railway Hobby / hébergement payant reste approuvé et confirmé payé par le propriétaire, sans vérification directe de facturation Codex/ChatGPT. Autorisation limitée au service Railway existant ; toute nouvelle dépense/fournisseur/environnement/Redis/Realtime/service tiers exige un accord explicite. Amsterdam europe-west4-drams3a/1 replica acquis ; Supabase Europe centrale, schedulers inchangés, aucune optimisation infra dans ce lot. Ce registre courant conserve le périmètre précédemment confirmé.

**Contrôles documentaires exécutés :** IDs vérifiés au gate, **R1034 libre créé** avec une seule définition canonique, R1032 explicitement supersédée après 28 ; sources courantes de statut/commandes/migration/runbook/rétention alignées, recherche de contradictions effectuée et états passés conservés comme historiques. 229 liens locaux/ancres contrôlés dans les 12 documents modifiés, dont 7 nouveaux liens valides ; aucune nouvelle cible/ancre introuvable. Cinq anciennes ancres introuvables également présentes au parent restent signalées hors périmètre (Gift Lot 12 et ancienne reprise Master depuis l'architecture, Giveaway depuis le Master, R671/R672 depuis le journal). git diff --check réussi. Aucun test code requis ni relancé, aucun lot DB/Prisma modifié : pas de nouvelle commande Prisma ni mutation publique ; les preuves de déploiement/60 migrations/health sont celles reçues ci-dessus.

**Prochaine action exacte : REVIEW INDÉPENDANTE CHATGPT DU CHECKPOINT DOCUMENTAIRE, PUIS OUVERTURE DE L'ÉTAPE 29 — PASSE EXHAUSTIVE DE TOUTES LES COMMANDES !. STOP.** Aucune promotion main, activation Twitch, migration publique ou cutover dans cette mission.

## Historique — promotion finale approuvée étape 28 du 04/10/2026 (6d61a9b)

**Gate initial exécuté :** fetch réussi, branche review, index/worktree propres ; origin/main = **e3a54e441b385554de211122602f3e8ae154b7f1**, HEAD = origin/review = **8696c1a3eab6b8db571cae9f92ea2e0312eebdfe**, ahead 2/behind 0. Chaîne exacte e3a54e4 → **6d2ac468e7feb11e8158c6be5bd838ee9ab69309** → 8696c1a3 ; parent du micro-correctif 6d2ac46. Aucun commit inattendu. Ce checkpoint exclusivement documentaire a pour parent exact 8696c1a3 ; publié normalement sur review puis main avancée par fast-forward strict, sans merge commit/rebase/squash/force-push. SHA commun et divergence 0/0 contrôlés au rapport après publication, worktree review propre.

**Review indépendante acquise :** ChatGPT FAVORABLE sur le lot 6d2ac46 et le micro-correctif 8696c1a3, relus directement sur GitHub selon la mission. Aucun correctif code supplémentaire requis. Le code approuvé conserve Terminé ✅ et le reset Europe/Paris/CET/CEST/DST sans fausse deadline Expédition ni état quotidien simulé ; notification initiale ARCADE_INVITE seule et résolutions silencieuses ; Rejouer FINISHED MULTIPLAYER → START SOLO même jeu/difficulté/IA/XP/grant/scoring usuels, résultat PvP score/0 XP intact, nouveau PvP manuel sélection + Prêt. Ancien contrat de revanche supprimé, champ retiré rejeté 400 VALIDATION_ERROR. Rewards niveau normal/multiple/overflow 100 autoritatives, explicites et wrap sans ellipsis, raccords Arcade/Gacha/Cryo, durée 5,4 s/verrou 1 s conservés. Aucun code/test/migration/package/dépendance modifié dans cette promotion, aucun Rxxx nouveau.

**État post-promotion :** dernier lot fonctionnel et micro-correctif présents sur main, étape **28 ACTIVE**, jamais clôturée par ce seul checkpoint. **Nouveau SHA déployé, Railway SUCCESS, Application ready, healthcheck, bundle frontend public et validation propriétaire du dernier lot NON vérifiés ici.** Le push main déclenche les déploiements automatiques usuels ; aucun redeploy/migrate deploy manuel ni recette publique artificielle. Les acquis publics e3a54e4/060/60 migrations, titres/sticky, synthèse Terminé ✅, fluidité/réactivité et autostart sont conservés dans leur périmètre, sans être étendus aux derniers correctifs.

**Infrastructure reçue/acquise :** ChatGPT a officiellement vérifié Railway GachaImpact **EU West / Amsterdam**, région **europe-west4-drams3a**, 1 replica/1 sur 1 running, zéro crashed, aucun volume, warning ou critical ; ancien déploiement Virginia/iad supprimé. Le propriétaire confirme une amélioration majeure de réactivité, sans benchmark chiffré inventé. Supabase reste Europe centrale. Ces preuves concernent le service déjà public ; la région et le déploiement du nouveau checkpoint restent à contrôler après promotion.

### Autorisations d'infrastructure payante — périmètre historique de la promotion 6d61a9b

**Railway Hobby / hébergement payant : approuvé et confirmé payé par le propriétaire.** Confirmation propriétaire reçue dans cette mission ; ni Codex ni ChatGPT ne revendiquent une vérification directe de facturation. Autorisation limitée au service Railway existant, sans autorisation générale pour autre fournisseur, nouvelle infrastructure/environnement, Redis, Realtime ou service tiers payant. Toute nouvelle dépense nécessite un accord explicite du propriétaire sur son périmètre. Ce registre remplace le booléen global ambigu ; les mentions historiques PAID_INFRA_APPROVED=false ci-dessous décrivent uniquement leur état à l'époque et ne font plus autorité pour l'état courant. AGENTS/README et le propriétaire déploiement renvoient à ce registre.

**Schedulers et coût : NE RIEN CHANGER.** ContestScheduler reste à 2 s, nécessaire au Concours autonome (tours auto/bots/timeouts/remplacements/soutien) ; GiftCodeScheduler reste à 60 s. Railway payé et fonctionnement stable/rapide ; aucun lazy reconciliation, Serverless ou changement des cadences Chat/MP/infrastructure. Une éventuelle optimisation relève uniquement de 27 après audit dédié, après 29.

**Contrôles propres à cette promotion :** Prisma validate et migrate status public READ ONLY réussis, **60 migrations à jour, aucune pending** ; registre en transaction READ ONLY : **60 terminées, zéro inachevée, dernière 20261003180000_060_add_arcade_multiplayer**. Aucun fichier Prisma modifié ni 061, aucune mutation/fixture publique, aucune suite DB mutative. Périmètre/index/documentation et diff-check contrôlés avant commit. Les grosses suites ne sont pas relancées : 6d2ac46 conserve frontend 1292/1292, backend hors DB 1221/1221, 37 scénarios DB privés réussis au cours des exécutions consignées, quick 5/5, full 8/8 ; 8696c1a3 conserve ciblés 127 frontend/42 backend, frontend 1295/1295, backend hors DB 1222/1222, Arcade privé 25/25, quick 5/5, full 8/8, typechecks/builds/lint et Chromium 1920×1080/390×844. Preuves locales antérieures, non réexécutées ici ; absence de CI/status GitHub sur ces SHA selon la review reçue. Warnings historiques conservés, aucune dépendance mise à jour.

**Séquence : 26 VALIDÉE PAR LE PROPRIÉTAIRE → 28 ACTIVE, promotion finale acquise et déploiement/smoke final attendus → 29 NON COMMENCÉE → 27 différée après 29 → 30 → 31 → 32.** 27 n'est pas abandonnée ; le propriétaire termine Arcade et la passe commandes avant la finition transverse. Aucun lancement de 29 ou 27 dans cette mission.

**Prochaine action exacte : CHATGPT VÉRIFIE GITHUB + RAILWAY + HEALTH, PUIS FOURNIT A. RECETTE FINALE COURTE ÉTAPE 28 ; B. INVENTAIRE EXHAUSTIF DE TOUT CE QUI N'A PAS ENCORE ÉTÉ VALIDÉ PUBLIQUEMENT DANS GACHAIMPACT.** Après validation propriétaire : clôturer 28 puis ouvrir 29 dans une mission suivante. STOP.

## Historique — micro-correctif final étape 28 du 04/10/2026 (8696c1a3)

**Gate exécuté :** fetch réussi, review/index/worktree propres à l'entrée ; origin/main = **e3a54e441b385554de211122602f3e8ae154b7f1**, HEAD = origin/review = **6d2ac468e7feb11e8158c6be5bd838ee9ab69309**, ahead 1/behind 0. Parent exact attendu du micro-correctif : 6d2ac46. Un seul commit dédié/push normal sur review, main inchangée ; cible finale ahead 2/behind 0 et worktree propre, refs/parent GitHub vérifiés au rapport.

**Review indépendante reçue :** ChatGPT a vérifié sur 6d2ac46 le reset Quotidiennes Europe/Paris/CET/CEST/DST, l'invitation initiale seule notification Arcade, le refus silencieux et Rejouer PvP vers SOLO même jeu/difficulté. Ces changements sont APPROUVÉS dans leur principe et conservés. Nouvelle invitation humaine toujours par sélection manuelle + Prêt. Aucune réécriture du solo, polling, Memory, scoring, 0 XP PvP ou Tutoriel.

**Ancien contrat de revanche supprimé, candidat :** type frontend ArcadeInvite et input/fingerprint backend ne contiennent plus de champ d'ancienne session ; aucune validation spéciale de revanche/adversaire. Schéma Zod strict : seulement opponentPlayerId/game/difficulty/friendsOnly/idempotencyKey. Le test API construit uniquement pour la requête rejetée l'ancien nom de champ et confirme **400 VALIDATION_ERROR**, sans appel métier ; l'invitation normale suivante est acceptée. Aucune occurrence du nom retiré dans runtime/types/tests courants ; les mentions ci-dessous sont uniquement l'historique du candidat précédent. Aucun nouveau endpoint.

**LevelUpFeedback candidat :** rewards serveur conservées intégralement par Arcade SOLO et Gacha/passif Cryo ; affichage commun **Récompenses :** suivi de levelUpRewardLabel, normal 11→12, niveaux multiples et overflow 100. Payload analogue au receipt réel : **1 palier au niveau 100**, +800 Primos / +10 000 Moras / +80 Cryo / +40 Géo (libellé élémentaire partagé conservé). Deux paliers affichent une seule modale et les totaux effectivement reçus, y compris des éléments secondaires différents. Classe CSS locale rewards avec wrap, sans ellipsis/overflow horizontal. Aucun calcul économique/élément aléatoire/fallback frontend, aucune nouvelle reward, balance ou mutation publique. Durée/fade 5,4 s, fermeture verrouillée 1 s et accessibilité/focus inchangés. Les autres small et feedbacks à rewardLabel personnalisé restent inchangés.

**Preuve économique publique reçue, non réexécutée :** ChatGPT a relu en READ ONLY un vrai overflow propriétaire operation_type arcade.finish / cause_key player.xp.level-reward : +800 primogems, +10000 moras, +80 particles_cryo et +40 particles_geo, présents aussi dans le receipt. Aucune perte à réparer ; ce lot corrige uniquement la présentation, sans balance publique modifiée. Contrat serveur planPlayerXpGrant : affichage plafonné à 100, chaque tranche supplémentaire de 30 XP conserve sa récompense existante.

**Infrastructure publique reçue :** ChatGPT a vérifié officiellement Railway GachaImpact **europe-west4-drams3a / EU West Amsterdam**, 1/1 running, crashed 0, aucun volume, warning 0, critical 0 ; ancien déploiement iad/Virginia REMOVED. Amélioration majeure et immédiate de réactivité confirmée par le propriétaire, sans benchmark chiffré inventé. Supabase reste Europe centrale. Passage Trial→Hobby traité séparément par le propriétaire ; Codex ne modifie aucun service/plan/URL/variable/domaine/infrastructure, PAID_INFRA_APPROVED reste false.

**Contrôles du micro-correctif :** ciblés frontend **127/127**, backend **42/42** ; complet frontend **1295/1295**, backend hors DB **1222/1222** ; typechecks/builds/lint, verify:quick **5/5** et verify:full **8/8** réussis. Les tests initiaux ont reproduit l'acceptation de l'ancien champ et l'absence du préfixe explicite ; les attentes « Geo » des nouveaux tests ont été alignées au libellé partagé existant « Géo ». Suite PostgreSQL privée Arcade multijoueur **25/25**, en une exécution complète : invitations normales/idempotence/concurrence/notification unique/résolutions silencieuses, score/0 XP et Rejouer hôte/invité solo avec ancien adversaire offline/occupé ; nettoyage par le fixture isolé réussi. Prisma validate et migrate status public READ ONLY réussis : **60 migrations à jour, aucune pending**, dernière 060. Aucun fichier Prisma/migration modifié, aucune 061 ni fixture/mutation publique.

**Chromium du micro-correctif :** GameShell réel/CSS production, fixtures synthétiques locales et réseau externe bloqué, **1920×1080 et 390×844** ; modales normale, un palier et deux paliers. Six captures inspectées à la phase visible du fade existant : toutes les rewards visibles, wrap naturel/centrage, aucun ellipsis ni overflow horizontal ; range de texte contenu dans la modale. Assertions interactives : aucun dismiss avant 1 s, Escape après 1 s, expiration à 5,4 s, focus conservé et attributs dialog/modal/live existants. Les snapshots synthétiques n'impliquent aucune validation économique publique ; la preuve production est celle transmise plus haut. Warnings non bloquants : pg concurrent déprécié, React et traces mocks localhost historiques, chunk Vite >500 kB et proposition de mise à jour Prisma ; aucune dépendance mise à jour.

**Documentation/roadmap :** contrat API Arcade final sans revanche, affichage feedback documenté et phrase obsolete « deux types » Notifications corrigée : seul ARCADE_INVITE produit une notification. Aucun nouvel ID Rxxx/règle économique. **26 VALIDÉE PAR LE PROPRIÉTAIRE ; 28 ACTIVE**, clôture après promotion/déploiement/recette finale seulement ; **29 NON COMMENCÉE ; 27 différée après 29**, sans abandon, puis 30→31→32.

**Prochaine action exacte : REVIEW INDÉPENDANTE CHATGPT DU VRAI MICRO-CORRECTIF. STOP.** Aucune promotion, aucune étape 29 ni 27.

## Historique — dernier correctif fonctionnel étape 28 du 04/10/2026 (6d2ac46)

**Gate exécuté :** fetch réussi, branche review, index/worktree propres à l'entrée ; HEAD = origin/main = origin/review = **e3a54e441b385554de211122602f3e8ae154b7f1**, divergence 0/0. Ce SHA est le baseline et parent attendu du candidat consolidé. Aucun commit distant inattendu. Un commit sur review uniquement, push normal, main inchangée, ahead 1/behind 0 et worktree propre ; SHA exact remis au rapport après vérification GitHub.

**Déploiement public reçu, non réexécuté :** ChatGPT confirme GitHub main == review == e3a54e4, Railway deployment exact **6a83d720-db83-48a9-8ffc-e8ce61ab9afc**, **SUCCESS**, predeploy « 60 migrations found / No pending migrations to apply », puis Application ready. Railway conserve /health et le predeploy npx prisma migrate deploy. Aucun résultat HTTP /health nouveau n'est inventé ici. Aucun redeploy/migrate deploy manuel ni changement d'infrastructure par Codex.

**Recette publique propriétaire acquise :** Titres de niveaux (heading/ordre décroissant/gradients/onglets sticky), synthèse **Terminé ✅**, réactivité fonctionnelle Prêt/Annuler/Refuser et fluidité PvP/Memory améliorées, autostart Tutoriel unique rétroactif R1033 **VALIDÉS** dans le périmètre reçu. Self-mention, présence, invitations/start hors écran, score PvP/0 XP et Quitter antérieurs restent acquis. **Rejouer PvP actuel REFUSÉ**, remplacé ci-dessous ; heure d'Expédition completed trompeuse après Terminé ✅ également corrigée. Étape 28 ne peut pas être clôturée avant promotion, déploiement et recette finale de ce dernier lot.

**Quotidiennes candidat :** après synthèse complète, seconde ligne **Réinitialisation dans X min / X h Y min**, sans secondes ni deadline d'Expédition satisfaisant déjà le départ du jour. Réutilise la primitive pure nextParisMidnight : calendrier **Europe/Paris**, CET/CEST et frontières DST de 23/25 h ; ancrage à la date métier confirmée, rafraîchissement local environ une fois par minute, aucun GET par minute. À zéro, aucune nouvelle activité/reward simulée ; revalidation quotidienne normale et nouvelle date serveur reprennent l'autorité. Deadlines waiting/in_progress/actionables, masquages et textes non complets conservés. Test 23:33 Paris → 27 min, Expédition readyAt demain midi exclue, minute suivante/arrêt zéro/nouvelle date serveur et Expédition réellement en cours couverts.

**R1029 révisée, invitation-only candidate :** seul le producteur **ARCADE_INVITE / OPEN_ARCADE_INVITE** à la création de l'invitation initiale est conservé. Producteur ARCADE_INVITE_REFUSED supprimé : Refuser résout silencieusement, libère les deux et l'hôte découvre la résolution via overview/poll. READY/START/REFUSE/CANCEL/EXPIRE/INVALIDATED/QUIT et Rejouer ne créent aucune nouvelle Notification Arcade, toast global ni message Chat. L'invitation initiale est résolue selon le cycle existant ; lien stale ouvre Arcade normalement. Les anciennes notifications informationnelles peuvent encore être lues/archivées, sans purge publique ni nouveau producteur.

**R1030 révisée, Rejouer candidat :** après FINISHED MULTIPLAYER, **Rejouer → nouvelle session SOLO/IA**, même jeu/difficulté, start existant/previousSessionId/nouvelle clé ; opponentPlayerId null, firstSide aléatoire/banter/IA et timings/barèmes/scoring/quota/XP/grant solo normaux. L'ancien adversaire peut être offline, away ou occupé ; pas d'invitation automatique, notification ou dépendance à sa présence. Résultat/score/0 XP du PvP conservés, sans XP rétroactive. Nouveau PvP uniquement par sélection manuelle d'un candidat ONLINE, Amis seulement éventuel, puis Prêt ; zone Jouer contre reste disponible au résultat, aucun ancien adversaire présélectionné automatiquement. Le champ replaySessionId reste compatible côté API, absent des chemins Rejouer et nouvelle invitation manuelle UI.

**Non-régressions :** overview/opponents découplés, publication immédiate des réponses serveur, revalidation background, ambiguïté/409 autoritaires, polling **600/900/2500 ms**, coalescing/backoff/hidden/offscreen, Memory **500 ms PvP / 700 ms solo, minimum client 750 ms solo**, faces cachées sûres et R1033/116 étapes conservés. Aucun nouveau score/XP PvP, endpoint, ScreenId, infrastructure, migration ou économie. Aucun fichier Prisma/migration modifié, aucune 061 ; public demeure à 60/060.

**Contrôles exécutés :** ciblés frontend **157/157** ; frontend complet **1292/1292**, backend hors DB **1221/1221**, builds/typechecks des deux applications et lint verts ; verify:quick **5/5**, verify:full **8/8**, diff-check. PostgreSQL mutatif **en schémas privés uniquement : 37 scénarios réussis**, dont 23 PvP existants (notifications/déduplication/résolutions/Ready/expiry/quit/concurrence/0 XP) puis deux nouveaux Rejouer hôte/invité réussis en relance ciblée, et solo **12/12**. Le premier passage privé a échoué sur les deux nouvelles assertions comptant aussi une notification normale de progression après la fin du nouveau solo ; corrigées pour distinguer clic Rejouer sans notification et producteur Arcade absent, sans changer le code métier solo. Les 23 cas skipped de la relance ciblée sont les 23 déjà exécutés avec succès, pas une seconde exécution revendiquée. Fixtures/schémas des suites nettoyés ; contrôle final en lecture seule : un schéma privé préexistant conservé, comme à l'entrée. Prisma validate/status public en lecture seule réussis : 60 migrations à jour, aucune pending ; registre READ ONLY : 60 terminées, zéro inachevée, dernière 20261003180000_060_add_arcade_multiplayer. Aucune mutation/fixture publique.

**Chromium exécuté :** vrai GameShell et CSS production, harnais/API synthétiques locaux, réseau externe bloqué ; **1920×1080 et 390×844**. Journée complète avec Expédition RUNNING du jour et échéance demain midi : Terminé ✅ + Réinitialisation dans 27 min, aucune fausse Prochaine échéance. Résultat PvP/Rejouer visibles, hôte et invité → Memory/Moyen SOLO/opponent null, ADVANCE IA normal observé, banter solo restauré. Zone Jouer contre indépendante, sélection seule sans mutation puis Prêt → INVITE manuel sans replaySessionId ; Refuser réinitialise l'UI. Captures inspectées et largeur document ≤ viewport. L'absence de nouvelle notification persistante est prouvée séparément en DB privée, pas par ces mocks Chromium. Ces contrôles techniques ne remplacent pas la recette publique de ce candidat. Warnings non bloquants historiques : pg client.query concurrent déprécié, traces localhost/mocks frontend, avertissement Vite de chunk >500 kB et warnings React existants.

**Infrastructure propriétaire séparée :** migration de région Railway US East/Virginia → EU West/Amsterdam **prévue/à vérifier par ChatGPT**, un replica demandé. Aucune preuve de région réalisée reçue : Amsterdam n'est pas déclaré acquis. Supabase reste Europe centrale ; aucun URL, domaine, variable, Cloudflare, DB ou service modifié par Codex dans ce lot.

**Documentation et séquence :** R1029/R1030 révisées après recette propriétaire, sans nouvel ID ; sources Arcade/Notifications/Quotidiennes et roadmap mises à jour. 26 VALIDÉE PAR LE PROPRIÉTAIRE ; **28 ACTIVE**, dernier correctif candidat review, clôture seulement après sa recette finale ; **29 NON COMMENCÉE**, suivante après clôture 28 ; **27 différée après 29**, sans abandon ; puis 30→31→32. Aucune autre étape lancée.

**Prochaine action exacte : REVIEW INDÉPENDANTE CHATGPT DU VRAI COMMIT GITHUB SUR review. STOP.** Aucune promotion main, aucune étape 29 ni 27. Après review favorable : promotion dédiée, vérification déploiement et recette finale reset Quotidiennes/refus silencieux/Rejouer solo/nouveau PvP manuel avant clôture 28.

## Historique — promotion approuvée du correctif post-recette étape 28 du 03/10/2026

**Gate initial exécuté :** fetch réussi, branche review, index/worktree propres ; origin/main = **8fedb6c66a2a60d33f30820c4a798c2948a30f84**, HEAD = origin/review = **178423a1a514b8aef0293bedad537e572d15c4b6**, ahead 1/behind 0. Parent unique du candidat : 8fedb6c ; aucun commit inattendu. La chaîne de cette promotion est 8fedb6c → 178423a → checkpoint documentaire courant, de parent exact 178423a.

**Review indépendante reçue :** ChatGPT **FAVORABLE** sur le vrai candidat 178423a, aucun correctif code requis. Unique réserve traitée : formulations courantes de roadmap, navigation et Aide incompatibles avec R1033. Tutoriel conserve 116 étapes, reprise/replay manuels Menu/Aide ; R1033 ajoute en parallèle un seul autostart rétroactif par Player, sans nouveau ScreenId/route écran ni lancement récurrent. Consulter l'Aide ne déclenche pas elle-même cet autostart. Clauses historiques R1015/R1023 préservées, supersession explicite ; aucun R1034 ni nouvelle décision.

**État post-promotion :** le correctif performance/autostart est approuvé et présent sur main avec ce checkpoint exclusivement documentaire. Titres kind/levelRequirement/heading/ordre/gradients/sticky, synthèse Terminé ✅, réponses invitation immédiates, overview/opponents découplés, polling 600/900/2500 ms, Memory PvP 500 ms et autostart transactionnel R1033 sont conservés tels qu'approuvés. Aucun code/test/migration modifié par la mission ; aucune 061. **Déploiement du nouveau SHA, Railway SUCCESS, Application ready, healthcheck, bundle frontend public et autostart public fonctionnel NON vérifiés ici.** Aucun redeploy manuel ; le push main déclenche les déploiements automatiques habituels, à contrôler ensuite par ChatGPT.

**Preuves publiques antérieures conservées :** Railway SUCCESS sur 8fedb6c, deployment 9889dff9-8f26-4d68-9402-5803df02fd3b, 060 appliquée, Application ready et 60 migrations publiques. Recette propriétaire partielle : self-mention, présence Social/MP, invitation, start hors écran, score/0 XP, Quitter, fonctionnement global PvP acquis ; Prêt/Annuler/Refuser fonctionnels, latence corrigée par le candidat. **Validation publique des nouveaux correctifs et de l'autostart NON acquise ; Rejouer PvP toujours à recetter.** Ne pas étendre les validations anciennes à ce nouveau lot.

**Contrôles propres à cette promotion :** Prisma validate réussi ; migrate status public en lecture seule : **60 migrations trouvées, base à jour, aucune pending**. Registre READ ONLY : **60 terminées, zéro inachevée, dernière 20261003180000_060_add_arcade_multiplayer**. Diff documentaire et diff-check worktree/index inspectés ; schéma et migrations inchangés, aucun test DB mutatif, aucune mutation/fixture publique, aucun migrate deploy manuel. Les mentions PowerShell NativeCommandError du stderr Prisma sont de la capture de logs : les deux commandes ont terminé avec exit 0, aucun échec Prisma.

**Preuves du candidat conservées, non réexécutées :** frontend 1278/1278, backend hors DB 1221/1221, PostgreSQL privé 42/42, quick 5/5, full 8/8, builds/typechecks/lint, Chromium desktop/mobile et mesures du harnais performance décrits dans l'historique immédiatement ci-dessous. Aucun nouveau contrôle visuel/gameplay ni relance des grosses suites dans cette mission documentaire.

**Publication et promotion :** un seul commit documentaire de parent 178423a, push normal sur review ; second gate avec main inchangée et chaîne stricte, puis main avancée uniquement par **git merge --ff-only review** et push normal. État final requis et contrôlé au rapport : origin/main = origin/review = checkpoint documentaire, divergence **0/0**, worktree local review propre. Aucun rebase/squash/merge commit/force-push ; SHA exact remis au rapport après contrôle GitHub.

**Roadmap :** 26 VALIDÉE PAR LE PROPRIÉTAIRE ; **28 reste ACTIVE jusqu'au smoke post-déploiement** ; 29 NON COMMENCÉE, suivante seulement après validation/clôture 28 ; 27 volontairement différée après 29, car le propriétaire veut terminer Arcade et la passe commandes avant la finition transverse, sans abandon de 27 ; puis 30→31→32. Aucune étape 29 ni 27 engagée.

**Prochaine action exacte : CHATGPT VÉRIFIE GITHUB, RAILWAY ET /HEALTH, PUIS FOURNIT UNE RECETTE PUBLIQUE COURTE : TITRES (HEADING/ORDRE/GRADIENTS/STICKY), QUOTIDIENNES (Terminé ✅), PRÊT/ANNULER/REFUSER RÉACTIFS, FLUIDITÉ PVP/MEMORY, AUTOSTART TUTORIEL UNIQUE RÉTROACTIF ET REJOUER PVP. STOP.** Si validé, clôturer 28 puis ouvrir 29 dans une mission distincte. Aucune validation de déploiement ou recette anticipée dans ce checkpoint.

## Historique — correctif consolidé post-recette publique étape 28 du 03/10/2026

**Gate exécuté :** fetch réussi, branche review, index/worktree propres à l'entrée ; HEAD = origin/main = origin/review = **8fedb6c66a2a60d33f30820c4a798c2948a30f84**, divergence 0/0. Ce SHA est le baseline et parent exact du candidat consolidé. Aucun commit distant inattendu. Publication prévue : un commit sur review, push normal, main inchangée, ahead 1/behind 0 et worktree propre ; SHA exact et contrôle GitHub remis au rapport final.

**Déploiement public reçu, non réexécuté :** ChatGPT a vérifié Railway **SUCCESS**, déploiement **9889dff9-8f26-4d68-9402-5803df02fd3b**, commit exact 8fedb6c, predeploy « 60 migrations found », application de **20261003180000_060_add_arcade_multiplayer**, « All migrations have been successfully applied », puis Application ready. Le registre public relu confirme 60 appliquées, dernière 060, zéro migration incomplète/rollbackée. La lecture READ ONLY de cette mission confirme à nouveau 60 terminées/zéro inachevée/dernière 060 ; migrate status indique aucune pending. Les preuves /health antérieures restent historiques dans leur périmètre ; aucun nouveau healthcheck public n'est revendiqué ici.

**Recette propriétaire reçue :** self-mention Chat et points de présence Social/MP **validés** ; invitation Arcade, démarrage hors écran, score PvP/**0 XP**, Quitter et fonctionnement global PvP **validés**. Prêt/Annuler/Refuser sont fonctionnellement validés mais leur latence doit être corrigée. Titres (heading/ordre/gradients), synthèse Quotidiennes et réactivité PvP/Memory demandent les correctifs ci-dessous. **Rejouer PvP : validation publique encore à acquérir.** Cette recette est partielle ; elle ne valide ni tout le produit ni les nouveaux correctifs.

**Correctifs candidats :** Apparence lit le contrat physique canonique **unlockRule.kind = PLAYER_LEVEL** de 059, au lieu de type : les cinq levelRequirement 10/25/50/75/100 réactivent heading, ordre décroissant et gradients bronze/argent/or/platine/améthyste existants. Onglets sticky et familles futures conservés. Quotidiennes affiche exactement **Terminé ✅** pour la synthèse entièrement terminée ; les véritables noms d'activités restent uppercase. Aucun changement métier Expédition ou catalogue 059.

**Arcade candidat :** overview autoritatif et liste opponents indépendants/coalescés ; une réponse confirmée INVITE/CANCEL/REFUSE/READY est publiée immédiatement et libère pending sans attendre un GET. READY renvoie la session projetée du viewer dans son receipt durable. Revalidation en arrière-plan ; ambiguïté/409 gardent la relecture autoritative. Polling visible : **PvP actif 600 ms, invitation 900 ms, idle 2500 ms**, opponents indépendants 2500 ms seulement idle ; hidden/offscreen sans polling, focus immédiat, backoff plafonné à 16 s. Memory REVEAL **PvP 500 ms**, client nextActionAt + 80 ms/minimum 60 ms ; **solo 700 ms et minimum client 750 ms inchangés**. Faces cachées non anticipées, aucune IA PvP, score/0 XP/Quitter/replay par invitation inchangés.

**R1033 — nouvelle décision propriétaire :** un unique autostart Tutoriel pour chaque Player nouveau ou existant, rétroactif. POST authentifié **/api/v1/me/tutorial/autostart**, sans PlayerId client ; marqueur séparé **tutorial_v1_autostart** dans PlayerPreference existant. Insertion unique et préférence IN_PROGRESS canonique dans une transaction : deux claims concurrents donnent exactement un shouldLaunch true. IN_PROGRESS reprend son étape/alias canonique ; NOT_STARTED/COMPLETED/état invalide repart au Profil pour cet unique autostart. Une fois claimé, aucun reset ni relancement automatique après Pause/Terminer/refresh/relogin/autre appareil/jour. GameShell attend le même gate métier que le manuel avant claim ; startConfirmed présente sans GET/PUT supplémentaire. Menu/Aide et les 116 étapes sont conservés. R1033 supersède seulement la clause « aucun autostart » de R1015/R1023, dont l'historique est préservé.

**Contrôles exécutés :** frontend complet **1278/1278**, backend hors DB **1221/1221**, typechecks/builds des deux applications et lint verts ; verify:quick **5/5**, verify:full **8/8**, diff-check. Tests PostgreSQL **privés uniquement : 42/42**, dont Tutoriel 7/7 (états, concurrence et indépendance), PvP 23/23 (receipt READY/projection et délai Memory inclus), solo 12/12. Prisma validate réussi, migrate status public en lecture seule à 60/aucune pending. Aucun changement Prisma/migration, aucune 061, aucune mutation/fixture publique, aucun deploy public manuel. Schémas privés des suites nettoyés ; compteur final revenu à **un schéma privé préexistant**, conservé.

**Chromium exécuté :** vrai GameShell/CSS de production, fixtures locales synthétiques, réseau externe bloqué ; titres/ordre/cinq gradients/onglets réellement sticky aux **1920×1080 et 390×844**, aucune largeur document/body supérieure au viewport. Synthèse exacte et activité uppercase contrôlées ; overlay autostart puis Pause/reload sans répétition. Deux clients locaux PvP et opponents artificiellement retardés de deux secondes : INVITE **124 ms**, CANCEL **280 ms**, REFUSE **66 ms**, READY plateau invité **58 ms**, détection host **249 ms**, carte adverse **396 ms**, mismatch reveal→hide **583 ms** dans ce harnais. Ces mesures locales et captures inspectées ne promettent aucun SLA Internet ni recette publique ; la persistance/concurrence réelle de l'autostart est couverte séparément en DB privée. Warnings historiques non bloquants : pg client.query concurrent déprécié dans les suites privées, tests frontend avec traces localhost/mocks et avertissement Vite de chunk > 500 kB.

**Documentation :** sources Tutoriel, Arcade, Quotidiennes, Apparence/data model, UI, backend, schéma PostgreSQL et roadmap actualisées ; seul nouveau numéro **R1033**, vérifié libre après R1032. Aucun changement économique, infrastructure ou migration. Étape **26 VALIDÉE PAR LE PROPRIÉTAIRE** ; **28 reste ACTIVE jusqu'à correction + nouvelle recette**, état du lot **CORRECTIF PERFORMANCE/AUTOSTART CANDIDATE REVIEW** ; **29 NON COMMENCÉE**, prochaine après 28 ; **27 différée après 29**, car le propriétaire veut terminer Arcade et la passe commandes avant la finition transverse, sans abandon de 27 ; puis 30→31→32. PAID_INFRA_APPROVED = false, Twitch générique en pause, bridges OFF.

**Prochaine action exacte : REVIEW INDÉPENDANTE CHATGPT DU VRAI COMMIT GITHUB SUR review. STOP.** Aucune promotion main, aucune étape 29 ni 27. Après review favorable, une mission dédiée devra promouvoir puis recetter titres/sticky, synthèse, latence invitation/PvP/Memory, autostart et Rejouer.

## Historique — promotion approuvée de l’étape 28 du 03/10/2026

**Gate initial exécuté :** fetch réussi, branche review et worktree/index propres ; origin/main = **9ec8c98e75d586072d45f2e27efa6c4cdbcbaa37**, origin/review = **a5fd8c29db89852d78c0c0b40f2bd23454d4d915**, ahead 2 / behind 0. Chaîne exacte : 9ec8c98 → **177f242789c1aba64bdca37f578a2c5087ac53b0** → a5fd8c2 ; parent exact du micro-correctif : 177f242. Aucun commit inattendu.

**Review indépendante acquise :** ChatGPT FAVORABLE sur le candidat fonctionnel 177f242 et le micro-correctif a5fd8c2, selon la mission explicite. Aucun correctif code supplémentaire requis. Le micro-correctif couvre l’ARIA Memory relatif à viewerSide, la copie mémoire de l’IA en solo et la présence Profil → nouveau MP. Ce checkpoint est exclusivement documentaire, de parent exact a5fd8c2 ; aucun code/test/migration modifié, aucun nouveau Rxxx. La migration 060 est conservée byte-for-byte.

**État après fast-forward strict :** étape **28 implémentée et approuvée, présente sur main** avec les retouches post-smoke R1027 des étapes 1–25. **Étape 26 VALIDÉE PAR LE PROPRIÉTAIRE.** La validation publique propriétaire du PvP et la recette publique des retouches de ce lot restent **NON acquises**. Présence sur main ne prouve ni déploiement Railway/Cloudflare, ni Application ready, ni healthcheck, ni application publique de 060. Les validations publiques antérieures sont conservées uniquement dans leur périmètre.

**DB avant déploiement :** Prisma validate réussi ; migrate status public en lecture seule trouve 60 migrations versionnées, seulement **20261003180000_060_add_arcade_multiplayer pending** (exit 1 attendu). Registre public en READ ONLY : **59 appliquées, zéro inachevée, dernière 20261003160000_059_add_profile_level_titles**. Aucune mutation/fixture publique, aucun migrate deploy public manuel, aucun redeploy manuel. **060 reste non appliquée tant que Railway n’a pas déployé : le predeploy automatique npx prisma migrate deploy l’appliquera après le push main ; résultat à vérifier par ChatGPT.** Aucun résultat de déploiement de ce lot n’est revendiqué ici.

**Preuves antérieures conservées, non réexécutées :** candidat principal : frontend 1256/1256, backend hors DB 1219/1219, PostgreSQL privé 95/95 dont PvP 23/23, quick 5/5, full 8/8 et Chromium aux quatre résolutions. Micro-correctif : ciblés 145/145, frontend 1262/1262, backend hors DB 1219/1219, quick 5/5, full 8/8 ; règles Memory inspectées desktop/mobile, parcours MP vérifié par intégration, contrôle navigateur de ce parcours non abouti. GitHub n’expose aucune CI/status selon la review reçue ; ces preuves sont locales. Contrôles propres à cette promotion : gates Git, périmètre documentaire, diff-check, Prisma validate/status et registre public en lecture seule ; aucune grosse suite relancée.

**Publication :** checkpoint documentaire poussé normalement sur review, puis main avancée uniquement par git merge --ff-only review et push normal. État final requis et contrôlé au rapport : origin/main = origin/review au SHA documentaire, divergence 0/0, worktree review propre. Aucun rebase, squash, merge commit ou force-push.

**Séquence R1032 conservée :** **26 validée → 28 implémentation approuvée, promotion courante et recette publique attendue → 29 prochaine après recette 28 → 27 finition transverse différée après 29 → 30 migration foundation/rehearsal → 31 cutover → 32 validation finale**. Le propriétaire veut terminer Arcade et la passe commandes avant la finition transverse ; 27 n’est pas abandonnée. Aucune étape 29 ou 27 commencée. Twitch générique R942 en pause, bridges Gift/Giveaway OFF, Streamer.bot autoritatif, PAID_INFRA_APPROVED = false.

**Prochaine action exacte : CHATGPT VÉRIFIE GITHUB, RAILWAY, L’APPLICATION PUBLIQUE DE 060, LES 60 MIGRATIONS À JOUR ET /HEALTH, PUIS FOURNIT UNE RECETTE PUBLIQUE CIBLÉE DE L’ÉTAPE 28 : TITRES/STICKY, SELF-MENTION, EXPÉDITION QUOTIDIENNE, PRÉSENCE SOCIAL/MP, INVITATION ARCADE, ANNULER/REFUSER/EXPIRATION, START HORS ÉCRAN, MEMORY/PUISSANCE 4/MORPION, SCORE PVP, 0 XP, QUITTER ET REJOUER. STOP.** Aucune étape 29 ni 27.

## Historique — correctifs post-recette et candidat étape 28 du 03/10/2026

**Gate exécuté :** fetch réussi, branche review et worktree/index propres à l'entrée ; HEAD = origin/main = origin/review = **9ec8c98e75d586072d45f2e27efa6c4cdbcbaa37**, divergence 0/0. GitHub refs vérifiées au même SHA ; aucun commit inattendu. Ce SHA reste le baseline et parent prévu du candidat consolidé ; main n'est pas promue dans cette mission.

**Preuves publiques reçues, périmètre exact :** ChatGPT a vérifié Railway production SUCCESS pour 9ec8c98, déploiement **c1f59cbd-d091-432e-b58d-4dff07bd443c**, 059 appliquée, 59 migrations, « All migrations successfully applied », Application ready et /health **200**. Le propriétaire a validé Menu/icône Catalogue/Aide, tracker Quotidiennes et les cinq titres Profil. Ces preuves reçues sont conservées ; elles ne sont pas des tests publics réexécutés ici et n'étendent pas la validation à tout Help/!legende/état naturel. Le registre public consulté ici en READ ONLY confirme 59 terminées/zéro inachevée/dernière 059.

**Étape 26 : VALIDÉE PAR LE PROPRIÉTAIRE.** Le propriétaire accepte l'économie et la progression courantes, clôt la recette globale et ne demande pas une nouvelle campagne. Aucun gap d'implémentation identifié dans 1–25 ; observations naturelles rares/impossibles conservées à 32, sans blocage ni preuve inventée pour R911/R912/Calendrier/Missions/Notifications/Faveur. Les acquis publics antérieurs restent valides dans leur périmètre.

**Lot courant :** retouches post-smoke candidates review sous R1027 : Titres de niveaux dérivés PLAYER_LEVEL, ordre 100→75→50→25→10, gradients sombres, états lisibles et seuls onglets Avatars/Titres sticky ; self mention recherchée/envoyée, sans notification ; RUNNING Expédition commencée aujourd'hui = completed/✅ Terminé, ancienne en cours et READY actionnable conservés ; pastilles Social/MP autorisées, texte Social maintenu et MP sans nouveau texte visible, batch Presence/Privacy commun.

**Étape active = 28 Multijoueur Arcade**, cadrée R1028–R1031, IMPLEMENTATION_CLOSED CANDIDATE REVIEW : trois jeux/trois difficultés, invitation persistée deux minutes et ready hôte/invité, session partagée serveur, démarrage hors écran, deux pseudos/côtés stables, tours humains sans IA, résultats/points propres des deux dans les agrégats existants, **0 XP/grant/quota/récompense/économie/Mission**, abandon partagé sans stats et replay par invitation. Polling visible coalescé, backoff ; pas de WebSocket/Realtime/service payant/Twitch. [Contrat canonique](../specifications/arcade-v1.md#multijoueur-arcade--étape-28).

**DB :** migration additive **060** candidate uniquement. 057/058/059 inchangées. Chaînes privées complètes de 60 migrations deploy/status réussies ; multijoueur 23/23, solo 12/12 après adaptation du seul compteur à 60, Global Chat 31/31, MP 16/16, Social 10/10 et Apparence 3/3 : **95/95 tests PostgreSQL privés**. Aucune migration/mutation/fixture métier publique, aucune préférence/équipement public ni activation externe. Public migrate status trouve seulement 060 pending (exit 1 attendu). Schémas privés créés/nettoyés par chaque suite ; contrôles finaux consignés avant publication.

**Contrôles exécutés du candidat :** frontend complet **1256/1256**, backend hors DB complet **1219/1219** ; typechecks/builds frontend et backend, lint, verify:quick **5/5**, verify:full **8/8**, Prisma validate, diff-check worktree/index. Chromium local sur le vrai GameShell et ses CSS, fixtures synthétiques, réseau externe bloqué : **104 captures** et assertions aux **2560×1440 / 1920×1080 / 1366×768 / 390×844**. Ordre/gradients/équipement et sticky réel desktop/mobile ; Social Joueurs/Amis/Demandes ; MP Conversations/Archives/recherche/header ; Home/Sidebar/Aperçu Expédition aujourd’hui/ancienne/READY ; Arcade idle/incoming/outgoing/trois jeux PvP et clic notification valide/stale. Mesures du plateau identiques solo/PvP et avec/sans panneau desktop ; aucun chevauchement ni overflow horizontal, Prêt/Annuler de largeur stable. Captures inspectées : ce contrôle technique ne remplace pas la recette visuelle/gameplay propriétaire du PvP. Solo régressé : IA/premier côté/difficulté/banter/observations Memory/alpha-bêta/timer/score/XP daily/LevelUpFeedback/reprise/Quitter/Rejouer/Records/Règles/barèmes. Tests de concurrence/version/idempotence et zéro XP/grant/économie documentés dans la suite privée. Warnings non bloquants : dépréciation pg client.query concurrent déjà présente dans les suites historiques, traces ECONNREFUSED localhost:3000 de tests frontend avec mocks incomplets ; suites vertes ; avertissement Vite de chunk supérieur à 500 kB. Aucune optimisation transverse de 27 engagée.

**Ordre réel R1032, numéros conservés :** **26 validée → 28 active → 29 suivante → 27 finition transverse volontairement différée après 29 → 30 foundation/rehearsal → 31 cutover distinct → 32 validation finale**. Le propriétaire veut finir Arcade et les commandes avant la finition transverse. 27 n'est pas abandonnée ; aucune de ces autres étapes n'est commencée par ce lot. Twitch générique R942 reste en pause, bridges Gift/Giveaway OFF, Streamer.bot autoritatif, **PAID_INFRA_APPROVED = false**.

**État du candidat à publier :** 1–25 implémentation acquise, retouches post-recette candidates ; 26 VALIDÉE PAR LE PROPRIÉTAIRE ; 28 IMPLEMENTATION_CLOSED CANDIDATE REVIEW, non publique et sans recette propriétaire PvP. Un commit consolidé de parent 9ec8c98 sur review ; origin/main inchangée, review ahead 1/behind 0, SHA exact remis au rapport après contrôle GitHub.

**Prochaine action exacte : REVIEW INDÉPENDANTE CHATGPT DU VRAI COMMIT GITHUB SUR review. STOP.** Aucune promotion main, étape 29 ou étape 27.

## Historique — promotion de la clôture pré-stabilisation V1 du 03/10/2026

**Gate initial exécuté :** fetch réussi, branche review, index/worktree propres ; HEAD = origin/review = **adb1f5102eedb83a6856ac983e4d70908585c6cd**, origin/main = **1e5a5d7dcd71c7b804b8db9fb39acb06217f7dbe**, ahead 1 / behind 0. Parent exact du candidat : 1e5a5d7dcd71c7b804b8db9fb39acb06217f7dbe ; aucun commit distant inattendu.

**Review indépendante acquise :** ChatGPT FAVORABLE sur le vrai commit GitHub **adb1f5102eedb83a6856ac983e4d70908585c6cd**, selon la mission de promotion explicite. Aucun correctif code/test/migration requis ni réalisé ; aucun nouveau Rxxx ni changement produit. Le checkpoint est exclusivement documentaire, de parent exact adb1f510, publié sur review avant fast-forward strict vers main.

**État après promotion technique :** étapes **1–24 IMPLEMENTATION_CLOSED**, y compris les raccordements !legende/Profil C6 et le catalogue de titres R1025. Étape **25 implémentée sur main** : Tutoriel existant, Help partagé (34 racines/dix catégories) et Aide standalone R1026 ; Menu à 23 IDs dans navigation_menu_v1/version 1. Permissions C6 Box pour liste, Box + GENERAL_STATISTICS pour détail, accès propriétaire conservé. Catalogue ▥ et tracker bleuté/uppercase présents. La matrice, les fonctionnalités et les preuves techniques du candidat sont conservées dans l’historique ci-dessous.

**Public :** le Tutoriel de 116 étapes/24 chapitres/21 écrans et les six groupes précédents restent validés sur 1e5a5d7 dans le périmètre rapporté ; aliases seulement prouvés techniquement. **Aide, Help et !legende, titres Profil, nouvelle icône Catalogue et polish tracker attendent leur recette publique.** Présence sur main ne certifie ni Railway/Cloudflare, ni Application ready, ni healthcheck, ni l’application publique de 059. Les attentes naturelles R911/R912/Calendrier/Missions/Notifications/Faveur restent en recette globale 26/32 ; aucune preuve nouvelle inventée.

**DB avant fast-forward :** Prisma validate réussi (exit 0). Prisma migrate status en lecture seule trouve 59 migrations versionnées et **seulement 20261003160000_059_add_profile_level_titles pending** (exit 1 normal). Le registre public consulté en transaction READ ONLY confirme **58 terminées, zéro inachevée**, dernière 058. Aucun deploy SQL/Prisma public manuel, mutation de test, Player/cosmétique/équipement ou préférence public. **Railway appliquera 059 au prochain déploiement automatique de main via son predeploy npx prisma migrate deploy ; résultat à vérifier ensuite par ChatGPT.** Aucun redeploy manuel ni 060.

**Contrôles de cette promotion :** périmètre documentaire inspecté, diff-check worktree/index ; chaîne exacte baseline → adb1f510 → checkpoint documentaire, refs distantes et worktree contrôlés pour la publication. **Sans relance** des preuves du candidat : chaîne privée de 59 migrations, titres/backfill/rollback/replay, 84 tests PostgreSQL privés, frontend 1236/1236, backend hors DB 1218/1218, quick 5/5, full 8/8 et Chromium. Ces chiffres restent des preuves historiques du candidat, pas des contrôles réexécutés ici.

**Git après publication/promotion :** un seul checkpoint documentaire de parent adb1f510 ; review poussée normalement, puis main avancée uniquement par git merge --ff-only review et push normal. origin/main = origin/review au SHA du checkpoint, divergence 0/0, branche locale review propre. SHA exact remis au rapport après vérification GitHub ; aucun rebase, squash, merge commit ou force-push.

**Roadmap conservée :** 26 recette fonctionnelle globale → 27 finition/rétention/Twitch technique → 28 Multijoueur Arcade futur à cadrer → 29 sweep exhaustif commandes → 30 migration foundation/rehearsal → 31 cutover distinct → 32 validation finale. La prochaine phase après les contrôles et la recette de ce candidat est **26**, sans la commencer dans cette mission.

**Prochaine action exacte : CHATGPT VÉRIFIE GITHUB, LE DÉPLOIEMENT RAILWAY EXACT, L’APPLICATION PUBLIQUE DE 059, LES 59 MIGRATIONS À JOUR ET /HEALTH, PUIS FOURNIT UNE RECETTE PUBLIQUE COURTE DE CLÔTURE DE L’ÉTAPE 25 : MENU / ICÔNE CATALOGUE / AIDE ; TRACKER QUOTIDIENNES ; TITRES PROFIL ; HELP ET !LEGENDE. STOP.**

## Historique — candidat consolidé de clôture V1 du 03/10/2026

**Gate exécuté avant modification :** fetch réussi, review, index/worktree propres ; HEAD = origin/main = origin/review = **1e5a5d7dcd71c7b804b8db9fb39acb06217f7dbe**, divergence 0/0. Parent du candidat unique : ce SHA exact ; code fonctionnel antérieur 468dbaae061d363be2a8506da22b52dbfd5bada0. Aucun changement distant inattendu constaté au gate.

**Preuves publiques reçues de la mission, non réexécutées par Codex :** Railway SUCCESS sur **1e5a5d7 exact**, 58 migrations, zéro pending, Application ready, GET /health HTTP 200. Le propriétaire confirme six groupes : Menu destinations/retrait Activités/Profil/Arcade/sauvegarde ; 116 étapes et transitions ; Missions B/B/B et Z limité à son onglet ; fenêtre complète des Passifs ; Event Shop complet ; modal Faveur et libellés. Tutoriel et correctif publics validés dans ce périmètre. Les deux aliases menu-pagination et event-calendar restent **techniquement prouvés sans recette manuelle publique rapportée**. Les nouvelles modifications ci-dessous ne sont pas publiques.

### Audit des étapes 1–24

La numérotation désigne la **Trajectoire V1 de référence après Boss** de [la roadmap](../roadmap/implementation-order-v1.md), pas ses huit prérequis initiaux. Ces prérequis réels (reward/XP/catalogue/Gacha/Box/Team/économie/daily) ont leurs stores/services/UI et tests existants ; le propriétaire XP commun et ses consommateurs sont régressés ici, sans dé-mock ni reconstruction supplémentaire. Audit : propriétaires, points d’entrée physiques et tests, raccordements dans app.ts/runtime, sources de données et dettes déjà consignées ; la passe exhaustive de toutes les sorties ! appartient à 29.

Classes **à l’entrée du lot** : 15 IMPLEMENTATION_CLOSED, 1 DOC_STALE_ONLY, 6 EXTERNAL_VALIDATION_ONLY, 2 IMPLEMENTATION_GAP. **Les deux gaps sont fermés dans ce candidat** : consultation C6 raccordée après arbitrage de permission auteur et titres de niveau explicitement cadrés. Aucun gap d’implémentation identifié encore ouvert dans 1–24 ; les demandes futures 27/28/29 ne sont pas présentées comme déjà codées. Les noms de tests ci-dessous identifient leur couverture physique ; leur présence ne signifie pas que toute la suite DB historique a été relancée.

| # | Domaine | Classe à l’entrée | Source / code / couverture physique | Conclusion du lot |
| --- | --- | --- | --- | --- |
| 1 | Concours / C6 | IMPLEMENTATION_GAP | [Source](../legacy/15-concours-c6-audit.md) ; `contest/contest-service.ts` / `contest.test.ts` | !legende déclaré NOT_PHYSICAL malgré le domaine livré : raccord Chat/Profil et R565 clarifiée avec l’auteur ; partagé, read-only, privacy avant lecture. |
| 2 | Collection / Sac | IMPLEMENTATION_CLOSED | [Source](../legacy/10-sac-coffre-shop-audit.md) ; `inventory/inventory-services.ts` / `inventory.test.ts` | Stocks/objets/Collection et conversions réels ; aucune reconstruction. |
| 3 | Codes cadeaux | IMPLEMENTATION_CLOSED | [Source](../legacy/19-codes-cadeaux-audit.md) ; `gift-code/gift-code-service.ts` / `gift-code.integration.test.ts` | Consultation/claim et outils autorisés déjà physiques. |
| 4 | Événements mensuels | EXTERNAL_VALIDATION_ONLY | [Source](../legacy/16-event-monthly-audit.md) ; `event/event-service.ts` / `event-calendar.integration.test.ts` | Jeux A/B/C, Shop/Collection/Top et lifecycle physiques ; calendrier de Noël naturel à observer en 26/32. |
| 5 | Votes bannière | IMPLEMENTATION_CLOSED | [Source](../legacy/06-gacha-invocation-audit.md) ; `gacha/banner-vote-service.ts` / `banner-votes.integration.test.ts` | Votes UI/Chat et source de génération réelle ; observation R911 rattachée à 14. |
| 6 | Profils / annuaire / présence | IMPLEMENTATION_CLOSED | [Source](../legacy/14-ami-social-audit.md) ; `social/social-service.ts` / `social.integration.test.ts` | Identités, projections et présence serveur réelles ; raccord C6 de 1 partagé. |
| 7 | Confidentialité | IMPLEMENTATION_CLOSED | [Source](../legacy/14-ami-social-audit.md) ; `social/privacy-service.ts` / `social.integration.test.ts` | Rubriques/overrides et filtres serveur déjà physiques, mapping C6 confirmé sans nouvelle catégorie. |
| 8 | Amitié | IMPLEMENTATION_CLOSED | [Source](../legacy/14-ami-social-audit.md) ; `social/friendship-service.ts` / `friendship.integration.test.ts` | Relations/demandes/cœurs, idempotence, notifications et projections présentes. |
| 9 | Échanges | IMPLEMENTATION_CLOSED | [Source](../legacy/05-element-resources-audit.md) ; `trades/trade-service.ts` / `trades.integration.test.ts` | Réserves/transitions/history/expiry et intentions communes présentes. |
| 10 | Chat / MP | IMPLEMENTATION_CLOSED | [Source](../specifications/global-chat-v1.md) ; `chat/global-chat-service.ts` / `direct-messages.integration.test.ts` | Flux réels, non-lus/mentions/modération et domaine MP présents ; passe exhaustive de textes à 29. |
| 11 | Missions B/A/S/Z | EXTERNAL_VALIDATION_ONLY | [Source](../legacy/11-missions-daily-audit.md) ; `missions/permanent-mission-service.ts` / `permanent-missions.test.ts` | Définitions/metrics/secret Z/récompenses déjà physiques ; nouvelles notifications naturelles restent en recette 26/32, pas de progression publique forcée. |
| 12 | Statistiques générales | IMPLEMENTATION_CLOSED | [Source](../specifications/v1-data-model.md) ; `statistics/general-statistics-projection.ts` / `social.integration.test.ts` | Projection des propriétaires réels, distinction null/zéro et privacy, sans compteur concurrent. |
| 13 | Classements | EXTERNAL_VALIDATION_ONLY | [Source](../legacy/22-top-classements-audit.md) ; `ranking/ranking-service.ts` / `ranking.integration.test.ts` | Métier validé ; revalidation visuelle publique R912 à 26/32. |
| 14 | Historique global | EXTERNAL_VALIDATION_ONLY | [Source](../specifications/v1-data-model.md) ; `history/history-service.ts` / `history.integration.test.ts` | Historique physique et snapshot R911, pas de reconstruction historique ; prochain snapshot naturel/R912 à 26/32. |
| 15 | Apparence / titres | IMPLEMENTATION_GAP | [Source](../specifications/v1-data-model.md) ; `appearance/appearance-service.ts` / `appearance.integration.test.ts` | Catalogue produit de titres absent : cinq définitions R1025/059, XP live et backfill silencieux ajoutés ; recette publique exhaustive à 26/32. |
| 16 | TwitchIdentity | IMPLEMENTATION_CLOSED | [Source](../architecture/twitch-pilot-mapping.md) ; `twitch/twitch-pilot-service.ts` / `snapshot-pilot.test.ts` | Liaison/pilote/refresh déjà physiques et preuves antérieures conservées ; cutover global demeure 30/31. |
| 17 | Transport Twitch / pause R942 | DOC_STALE_ONLY | [Source](../architecture/backend-architecture-v1.md) ; `twitch/twitch-pilot-service.ts` / `twitch-runtime-state.test.ts` | Transport pilote validé puis pause explicite ; texte commandes obsolète corrigé. XP/parser/outbound génériques différés par décision à 27/29, sans activation nouvelle. |
| 18 | Faveur | EXTERNAL_VALIDATION_ONLY | [Source](../legacy/18-faveur-subscription-audit.md) ; `favor/favor-service.ts` / `twitch-favor-resub-consumer.test.ts` | Core/consumers/lifecycle/présence/Profil/Chat physiques ; six groupes publics actualisés ; scénarios temporels naturels conservés en recette globale. |
| 19 | Gift Suprême | IMPLEMENTATION_CLOSED | [Source](../legacy/20-gift-twitch-audit.md) ; `gift-supreme/gift-supreme-service.ts` / `gift-supreme.test.ts` | Core/bridge spécialisé et pilote réel déjà validés, bridge OFF hors cutover. |
| 20 | Giveaway / Wish | IMPLEMENTATION_CLOSED | [Source](../legacy/21-giveaway-wish-audit.md) ; `giveaway/giveaway-service.ts` / `giveaway-native.test.ts` | Session native, settlement/notifications/annonces et pilote validés ; bridge OFF, aucune ouverture supplémentaire. |
| 21 | Notifications | EXTERNAL_VALIDATION_ONLY | [Source](../specifications/notifications-v1.md) ; `notification/notification-service.ts` / `permanent-missions.test.ts` | Producteurs/deep-links/transitions physiques ; observation de nouvelles causes naturelles à 26/32. Titles utilisent la primitive existante. |
| 22 | Administration / Modération | IMPLEMENTATION_CLOSED | [Source](../specifications/administration-moderation-v1.md) ; `moderation/role-admin-service.ts` / `administration.test.ts` | Permissions/routes/outils/journal existants, validations propriétaire conservées. |
| 23 | Arcade XP | IMPLEMENTATION_CLOSED | [Source](../specifications/arcade-v1.md) ; `arcade/arcade-service.ts` / `arcade.test.ts` | Memory/Morpion/Puissance 4, records/XP et lifecycle existants. Multijoueur futur non cadré déplacé en nouvelle étape 28. |
| 24 | Accueil / tracker | IMPLEMENTATION_CLOSED | [Source](../specifications/home-daily-tracker-v1.md) ; DailyTrackerCard / daily-summary tests | Projection daily réelle et masques/claim/LIFO déjà validés ; seul polish CSS explicitement demandé, aucun changement métier. |

### Livraison du candidat

**Titres R1025 :** cinq titres réels niveaux 10/25/50/75/100, sans asset ni auto-équipement, conditions visibles verrouillées, équipement/retrait manuel, preview sans doublon, rendu Profil uniquement. XP Gacha/Chat/Arcade appelle le même unlock dans sa transaction ; tous seuils franchis, notification seulement à nouvelle possession et rollback atomique. 059 ajoute uniquement catalogue et backfill silencieux à l’XP actuelle avec provenance, sans modifier 045–058 ni schéma. Catalogue jamais créé au GET/runtime.

**Help R728–R731 et Aide R1026 :** 34 racines, dix catégories, syntaxe+résumé, commande/alias prioritaire aux aliases de catégorie, inconnue honnête, !top taux5 recommandé. 32 commandes Chat interne séparées de !wish/!giveaway stats Twitch ; Admin et fausses commandes exclus. Registre pur partagé serveur/Vite, aucune API Help. Action Menu help après Tutoriel avant Configuration ; 23 IDs, version 1, placement/hidden existants conservés, Configuration hide/show/reorder. Fenêtre flottante à corps seul défilant, recherche casse/accents, Démarrage, huit systèmes, commandes et Twitch, focus/×/Escape/mobile. Même lanceur Tutoriel et garde pending avant GET/PUT. [Contrat Guide](../specifications/help-guide-v1.md). Tutoriel conserve **116/24/21**, sans nouveau chapitre, autostart ou ID.

**Polish et gap C6 :** Catalogue ▥ distinct de Profil ♙ ; autres glyphes inchangés. Dégradé bleu subtil du tracker et titre central légèrement agrandi/affirmé en uppercase CSS ; header/hauteurs/priorités/masques/LIFO/claim/compteurs/Navigation métier inchangés. !legende et Profil > Box consultent la même projection C6, Box pour liste et Box + Statistiques générales pour détail, selon confirmation auteur consignée R565 ; pas de nouvelle rubrique, mutation ni fuite privée.

### Recette globale conservée pour 26/32

- Prochain snapshot naturel de génération R911 et revalidation visuelle publique R912 ; aucune bannière/snapshot forcé ou inventé.
- Apparence : recette publique exhaustive des parcours encore non rapportés, dont les nouveaux titres après future promotion/application contrôlée de 059. Les parcours avatar déjà validés restent acquis.
- Notifications naturelles de nouvelles Missions et autres producteurs sans progression/récompense artificielle publique ; six groupes Tutoriel acquis, aliases techniques distingués d’un test manuel.
- Calendrier de Noël naturel et autres scénarios temporels des propriétaires non encore observés (fin/réinitialisation naturelle d’Event/Concours/Boss/Faveur selon leur source). Les preuves passées restent limitées à leur périmètre.
- Twitch : scénarios naturels et charge/performance à 27 avant décision de conservation ; inventaire/permissions/outputs/aliases ! et parité .txt, recette Kichnifou puis validation propriétaire à 29. QA Faveur et bridges OFF conservés. Aucun besoin de nouvelle activation dans ce lot.

Ces attentes sont des preuves externes ou étapes futures, **pas des étapes 1–24 en développement**. Une anomalie réellement trouvée en recette déclenchera un correctif borné et tracé.

### Contrôles et Git du candidat

- Dernier **verify:full 8/8** : frontend **1236/1236** (118 fichiers), backend hors DB **1218/1218** (104 fichiers), builds et typechecks des deux côtés, lint et diff-check worktree/index. **verify:quick 5/5**. Ciblés registre/raccord Help **10/10**, Aide **3/3**, précédents dispatcher/privacy/navigation et shell conservés. Le garde de raccordement exige un case physique pour chaque racine PLAYER/READY ; il ne prétend pas exercer toutes les sorties de l’étape 29.
- Régressions PostgreSQL privées : **84/84, sept fichiers** (titres/Appearance 7, Social/Arcade 22, navigation/Gacha/Chat 55). Tous les seuils/conditions, backfill/replay silencieux, XP/rollback/idempotence/notifications, changement/retrait/absence d’auto-équipement et permanence contrôlés ; Profil porte le titre, projections annuaire/classements/mentions/destinataires MP sans titre. Privacy C6 Public/Amis/Privé et accès propriétaire prouvés, progression privée non lue. Attentes anciennes Arcade 58/missions-only et fixture Social sans privacy explicite corrigées pour le comportement autorisé, puis relancées avec succès. Ce lot ne relance pas toute la suite DB historique.
- **Prisma validate réussi.** Public contrôlé en transaction READ ONLY : **58 terminées, zéro inachevée**, dernière 058 ; migrate status annonce **59 migrations versionnées et seulement 059 pending**, exit 1 attendu, pas de deploy public. Répétition réelle Prisma deploy/status de **59 migrations** en schéma privé à jour, cinq titres présents. Fixtures du lot nettoyées ; aucun Player, gameplay ou préférence public modifié.
- Chromium privé, vrai GameShell et CSS production : **2560×1440, 1920×1080, 1366×768, 390×844**, quatre parcours réussis, vingt captures. Menu/glyphes, Aide/recherche accent-casse/état vide, huit systèmes, 32 commandes internes/deux Twitch, scroll/focus/Escape ; mêmes GET/PUT Tutoriel et refus pending sans GET/PUT. Sauvegarde mobile hide/show/reorder Aide et reload version 1. Titres possédés/verrouillés, preview/équipement/retrait/Aperçu, C6 et cinq stats. Huit activités et six états complémentaires du tracker à chaque format, équipe 4/4, LIFO, contrôles/bord inférieur et absence d’overflow document. Captures Menu, Aide, tracker et titres desktop/mobile inspectées ; aucune erreur JS. Harness/API synthétiques et réseau externe bloqué, donc aucune recette publique nouvelle.
- Premier full : timeout isolé ChatPanel sous concurrence, fichier seul réussi puis deux full complets réussis ; aucun changement métier pour contourner le contrôle. Sélecteurs du harness et typage de fixture corrigés avant réussite finale. Warnings non bloquants : conseils React de lint déjà présents, localhost:3000 ECONNREFUSED des tests, bundle >500 kB, dépréciation pg de requêtes concurrentes ; zéro erreur de build/typecheck/lint final. Logs/harness/captures hors Git.
- Contrôle documentaire final : 24 lignes 1–24 dans l’ordre, classes 15/1/6/2 à l’entrée, 66 liens locaux des lignes ajoutées résolus, 59 migrations versionnées et aucun changement de schema.prisma ou de migration existante ; aucun harness/asset de démonstration dans Git.
- Sources affectées actualisées : Master/matrice, roadmaps, R565/R1025/R1026, commandes, audits Concours/Help, navigation/UI, Tutoriel, tracker, Apparence/modèle et architectures. Preuves publiques de 1e5a5d7 reçues distinguées des contrôles locaux et des futures observations 26/32.

**Git :** un seul commit cohérent sur review, parent exact 1e5a5d7 ; main reste **1e5a5d7dcd71c7b804b8db9fb39acb06217f7dbe**. SHA candidat et refs distantes vérifiés après push et remis au rapport ; ahead 1 / behind 0, worktree propre attendu. Aucun force-push, rebase, squash, promotion main, deploy public ou mutation de gameplay publique.

**Prochaine action exacte : REVIEW INDÉPENDANTE CHATGPT DU VRAI COMMIT GITHUB SUR review. STOP.** Une mission dédiée pourra ensuite promouvoir après approbation. Roadmap durable : **26 recette globale → 27 finitions/rétention/décision Twitch → 28 Multijoueur Arcade futur non cadré → 29 passe exhaustive commandes → 30 foundation/rehearsal → 31 cutover distinct → 32 validation finale**. Aucune de ces étapes n’est commencée implicitement.

## Historique — promotion du correctif post-25B du 03/10/2026

**Gate initial exécuté :** fetch réussi, branche review, index/worktree propres ; HEAD = origin/review = **468dbaae061d363be2a8506da22b52dbfd5bada0**, origin/main = **81d7234e46167d4a304065ce8e6b7b5d1d647d89** ; ahead 1 / behind 0, parent exact 81d7234, aucun commit distant inattendu.

**Review indépendante acquise :** ChatGPT favorable sur le vrai candidat GitHub **468dbaae061d363be2a8506da22b52dbfd5bada0**, selon la mission de promotion explicite ; aucun correctif code requis. Unique réserve documentaire : préciser l’historique Arcade de l’étape 23, sans retirer la destination Menu actuelle. La navigation principale garde ses sept destinations, dont Activités, et les six sous-onglets Activités restent intacts. Aucun nouvel ID Rxxx.

**Correctif promu :** 116 étapes uniques / 24 chapitres / 21 écrans ; copies et parité des IDs conservées. Aliases menu-pagination → notifications-entry et event-calendar → arcade-memory : GET sans réparation, PUT canonique. R1024 approuvé : Profil personnel après Accueil, Arcade après Événement, Activités retiré seulement du Menu ; navigation_menu_v1 compatible, ordres/masquages survivants conservés. Missions B/B/B, Z éclairé seulement sur son onglet sans contenu ; Vider exact, Passifs fenêtre complète, Event Shop section complète. Faveur : kicker Récompense quotidienne, titre Faveur de l’Astre, +800 Primogemmes ; aucun changement métier. [Contrat Tutoriel](../specifications/tutorial-v1.md) et [Navigation](../specifications/navigation-shell-v1.md) font autorité.

**Checkpoint :** diff de cette mission exclusivement documentaire dans huit propriétaires du lot ; aucun fichier code/test de 468dbaa modifié, aucun nouveau Rxxx. Historique et preuves locales de 468dbaa conservés ci-dessous, sans relance des grandes suites, quick/full ou Chromium. git diff --check réussi ; Prisma validate et migrate status réussis en lecture seule : **58 migrations à jour**, dernière **20261001120000_058_harden_arcade_session_lifecycle**, aucune 059. Aucun test DB mutatif, préférence publique, test public ni activation Twitch/Gift/Giveaway.

**État Git après promotion :** checkpoint documentaire de parent exact 468dbaa, publié d’abord sur review puis main avancée uniquement par git merge --ff-only review et push normal. Chaîne stricte **81d7234 → 468dbaa → checkpoint documentaire** ; origin/main = origin/review au checkpoint, divergence 0/0, branche locale review propre. Aucun rebase, squash, merge commit ni force-push.

**Public restant :** déploiement Railway et healthcheck du nouveau SHA à vérifier ensuite par ChatGPT ; frontend public et recette propriétaire du correctif non acquis. Les preuves Railway/health de 81d7234 restent historiques et ne certifient pas ce checkpoint. Aucune annonce SUCCESS/health OK ni validation Axel dans cette mission.

**Prochaine action exacte : CHATGPT VÉRIFIE GITHUB, RAILWAY ET LE HEALTHCHECK DU SHA PROMU, PUIS FOURNIT UNE RECETTE PUBLIQUE CIBLÉE DU CORRECTIF : MENU, 116 ÉTAPES/ALIASES, MISSIONS B/Z, PASSIFS, EVENT SHOP ET FAVEUR.** STOP ; aucune suite fonctionnelle lancée.

## Historique — candidat du correctif consolidé post-promotion 25B du 03/10/2026

**Gate exécuté :** fetch réussi, branche review, index/worktree propres ; HEAD = origin/main = origin/review = **81d7234e46167d4a304065ce8e6b7b5d1d647d89**, parent fonctionnel 5fc9be619434c73ec325482ac028b0edf0197bba ; divergence 0/0, aucun commit distant inattendu.

**État public conservé :** 25B de 118 étapes implémentée sur 5fc9be6, approuvée indépendamment, promue par fast-forward via 81d7234. Selon les preuves ChatGPT transmises par la mission : GitHub sur ce SHA commun, Railway production SUCCESS sur 81d7234 exact, healthcheck public /health = {"status":"ok"}. Ces contrôles ne sont pas réexécutés ici. Cloudflare Pages répond, mais son inspection anonyme ne prouve pas suffisamment le bundle frontend authentifié 25B. **Recette propriétaire complète 25B non acquise**. La validation publique 25A sur a23a423 et son périmètre Sidebar/Home sont conservés.

**Correctif livré :** 116 titres/descriptions propriétaire exacts, suppression des seules étapes menu-pagination/event-calendar, alias GET/PUT compatibles sans réparation au GET, 24 chapitres et 21 écrans conservés. Missions toujours B pendant les trois étapes, Z uniquement sur son onglet même débloqué, restauration du rang normal. Passifs fenêtre complète et formation réelle mise en évidence ; Event Shop section complète ; Vider bouton réel ; Invocation 4★ zone dédiée contrôlée. [Matrice et contrat canonique](../specifications/tutorial-v1.md), R1023 révisée.

**Menu et Faveur :** R1024 ajoute Profil personnel après Accueil et Arcade après Événement, retire uniquement le doublon Menu Activités ; navigation principale, sous-onglets et routes Activités préservés. navigation_menu_v1/version 1 conserve ordre relatif et masquages survivants, insère seulement les nouveaux IDs absents après leurs ancres et reste idempotent ; Configuration non masquable. Profil remet explicitement la cible sur player.id. Faveur : petit kicker Récompense quotidienne, grand titre Faveur de l’Astre, +800 Primogemmes et aria-label cohérent ; délais, déclenchement, queue et déduplication inchangés.

**Contrôles exécutés et limites :** Ciblés frontend **218/218** (19 fichiers), backend **143/143** (2 fichiers), comparaison indépendante des 116 copies et contrôle catalogue/matrice/whitelist/ordre réussis. Dernier **verify:full 8/8** : frontend **1232/1232** (117 fichiers), backend hors DB **1211/1211** (102 fichiers), builds/typechecks/lint/diff-check ; **verify:quick 5/5**. Chromium privé sur le vrai GameShell et CSS production : parcours des 116 étapes à **1920×1080** et **390×844**, compteurs, limites aux deux suppressions, Terminer/replay, Menu et Faveur ; Missions Z débloqué sur B à **390×844** et **1366×768**, Passifs/Shop également contrôlés à 1366×768. Contrôle complémentaire de reprise Passifs aux trois tailles : panneau complet stable ; sur mobile, bulle sous le panneau et défilement interne réel. Captures Passifs, Faveur, Z et Menu/Shop inspectées. Aucune mutation métier ; API/fixtures privées, aucun accès public de préférence. Les échecs intermédiaires de sélecteurs Faveur et de typage du payload de test ont été corrigés, puis la suite complète a réussi. Warnings React de lint, ECONNREFUSED localhost:3000 des tests, bundle >500 kB et annonce de mise à jour Prisma restent non bloquants. Logs/harness/captures hors Git ; ces preuves techniques ne valent ni review indépendante ni recette publique propriétaire.

**DB :** Prisma validate et migrate status réussis en lecture seule, 58 migrations à jour ; dernière **20261001120000_058_harden_arcade_session_lifecycle**, aucune 059. Même PlayerPreference, tutorial_v1 et navigation_menu_v1, version 1, mêmes routes/stores/schéma ; 116 IDs Tutoriel actifs et deux alias backend. Aucun tutorial_v2/navigation_menu_v2, migration ou test DB mutatif ; aucune préférence Tutoriel ni mutation gameplay publique.

**Documentation :** Master, Tutoriel, R1023/R1024, navigation, UI, modèle de données, architecture backend et PostgreSQL actualisés ; comptes rendus historiques à 118 conservés. Roadmap durable sans nouvelle étape, propriétaire Faveur sans libellé modal explicite : inchangés. AGENTS, Guide, workflow, handoff, Story, audits et contrats gameplay/économie inchangés.

**Git attendu après publication :** un seul commit consolidé sur review, parent exact 81d7234, main reste 81d7234 ; ahead 1 / behind 0, SHA distant vérifié après push, branche locale review propre. Candidat uniquement, aucune promotion main, aucun redeploy/activation Twitch/Gift/Giveaway/Faveur.

**Prochaine action exacte : REVIEW INDÉPENDANTE CHATGPT DU VRAI COMMIT GITHUB SUR review.** STOP après publication et rapport ; Help/Aide, autostart et étape 26 non lancés.

## Historique — promotion du Tutoriel joueurs 25B du 03/10/2026

Le propriétaire confirme la recette publique finale du correctif 25A sur **a23a42304da7396da2ceeaa5a1e245a79310cec1** : Précédent, ordre des contrôles et Suivant stable ; carte sidebar entière cliquable avec ses contrôles indépendants ; titre Home simple, hauteur Quotidiennes/BannerHero et splash recentré. Les validations publiques Pause/reprise/persistance, Terminer/replay, responsive et Invocation normale acquises sur 9aef02c sont conservées. **25A est clôturée dans son périmètre réel de prototype**. Cette preuve propriétaire est transmise par la mission, sans nouvelle vérification de déploiement Railway/Cloudflare ni mutation publique ici.

**Gate initial de promotion exécuté :** fetch réussi, branche review et worktree/index propres ; HEAD = origin/review = **5fc9be619434c73ec325482ac028b0edf0197bba**, origin/main = **a23a42304da7396da2ceeaa5a1e245a79310cec1**, ahead 1 / behind 0. Parent exact a23a423, chaîne stricte a23a423 → 5fc9be6, aucun commit distant inattendu. Mission de promotion dédiée explicitement autorisée.

**Implémentation approuvée :** 118 étapes, 24 chapitres et les 21 ScreenId joueurs, sans alias compté deux fois ni Modération, même ADMIN. Les huit IDs 25A et leur ordre forment l'introduction ; community mène maintenant à l'extension et conclusion revient à Home. Menu/Notifications, Invocation, Box/Expédition, Team, Catalogue, Quotidiennes, Missions, Combat/Boss, Event, Arcade, Concours, Sac/conversion, Banque, Boutique, Codes, Social, Échanges, Profil/Personnalisation, Classements, Historique, Chat/MP et Configuration sont traités. [Matrice canonique](../specifications/tutorial-v1.md), R1023.

**Architecture :** progression confirmée par PUT, puis préparation annulable de l'écran/vue/panneau/ancre réelle avant sa bulle. Navigation par replaceState, attente bornée sans polling ; vues de présentation temporaires distinctes des choix normaux. PlayerPreference/tutorial_v1 conserve version 1, statuts et forme JSON ; seule la whitelist étend les huit IDs à 118, sans reset ni migration. Reprise manuelle d'un ancien ID, reprise de sous-vue et replay restent compatibles.

**Frontière métier :** interactions et portals inert ; gardes locales Chat/MP read/seen/typing, consultation Event et timers IA/REVEAL Arcade. Brouillons et états normaux conservés ; possession réelle seulement, session Arcade active prioritaire, verrouillages et confidentialité inchangés, outils opérateur Compte exclus. Une action ou présentation métier en cours empêche le lancement avec un message concret, sans GET/PUT Tutoriel. Aucune copie d'interface ni donnée de démonstration en production.

**Preuves locales du candidat 5fc9be6, conservées sans nouvelle exécution :** Tests ciblés Tutoriel/MP/Event/Arcade/Chat/Historique **303/303** ; dernier verify:full **8/8**, frontend **1221/1221**, backend hors DB **1209/1209**, builds/typechecks/lint et diff-check réussis ; verify:quick **5/5**. Chromium privé sur GameShell et CSS production : parcours complet **118 étapes** à **1920×1080** et **390×844**, sept étapes représentatives chacune à **2560×1440** et **1366×768**, parcours vide/verrouillé complet sur mobile ; calendrier hivernal réel de fixture, Concours RUNNING, session Arcade ACTIVE/IA sans avance, retry arrière, Pause/reload/reprise manuelle, Terminer/replay et clic tactile du fond. Écran et cible primaire exigés pour les sous-vues disponibles (dont historique MP), quatre contrôles bornés, aucun overflow horizontal, aucune écriture métier provoquée par la visite, conclusion Home et historique browser non empilé. Captures Box/Expédition, MP/Historique, Records et Compte inspectées ; brouillon Chat conservé en Chromium, brouillon MP et absence de replay d'anciens intents MP/Event vérifiés par tests de régression. Un test statique de conversion et une ancienne attente de header Box ont été adaptés aux ancres/raccordements réels ; l'ancre manquante de la branche Historique MP détectée à l'inspection a été corrigée et contrôlée à nouveau. Aucun échec final ; warnings React de lint, ECONNREFUSED localhost:3000 de tests et avertissement de bundle >500 kB restent non bloquants. Ces preuves locales/synthétiques ne constituent pas une validation publique 25B. La review indépendante est acquise séparément sur le vrai commit GitHub 5fc9be6 ; aucun correctif code requis.

**Contrôles de cette mission :** diff exclusivement documentaire, aucun code de 5fc9be6 ni aucune des 118 étapes modifiés ; git diff --check réussi. Prisma validate et migrate status réussis en lecture seule : 58 migrations à jour, dernière **20261001120000_058_harden_arcade_session_lifecycle**, aucune 059. PlayerPreference/tutorial_v1/version 1 et ses 118 IDs conservés, sans tutorial_v2, nouvelle table/colonne/index/migration. Aucun test DB mutatif, aucune préférence Tutoriel ni mutation gameplay publique ; preuve d’isolation privée 25A conservée historiquement.

**Documentation de promotion :** seuls les statuts courants du Master, Tutoriel, décisions R1023, navigation, contrat UI, modèle, architecture backend/PostgreSQL et renvoi Home sont actualisés ; la ligne 25 de la roadmap reste durable et renvoie l’état vivant au Master. Aucun nouvel ID Rxxx ni changement fonctionnel. AGENTS, Guide, workflow, handoff, audits/commandes, Story et contrats gameplay/économie inchangés.

**Review indépendante et promotion :** ChatGPT a contrôlé directement sur GitHub **5fc9be619434c73ec325482ac028b0edf0197bba**, parent a23a423 et 69 fichiers : **FAVORABLE, aucun correctif code requis**. Un seul checkpoint documentaire sur review, de parent exact 5fc9be6, est publié puis toute la chaîne a23a423 → 5fc9be6 → HEAD du présent checkpoint de promotion est avancée sur main par fast-forward strict. État post-promotion : origin/main = origin/review = HEAD du présent checkpoint, divergence 0/0 ; SHA exact vérifié après push et donné au rapport. Aucun merge commit, rebase, squash ou force-push ; branche locale review propre.

**Déploiement et recette encore à acquérir :** la présence sur main ne prouve ni Railway SUCCESS, ni Cloudflare Pages à jour, ni healthcheck OK. ChatGPT vérifiera le SHA public et ces déploiements après le push main. **Aucune validation publique 25B ni validation visuelle des 118 étapes par Axel encore acquise.** Validation publique 25A conservée. Aucun redeploy manuel, activation Twitch/Gift/Giveaway/Faveur ou test public provoqué ici.

**Prochaine action exacte : CHATGPT VÉRIFIE LE SHA PUBLIC, RAILWAY, CLOUDFLARE PAGES ET LE HEALTHCHECK, PUIS FOURNIT LA RECETTE PUBLIQUE 25B GROUPÉE PAR PARCOURS/CHAPITRES, SANS FAIRE TESTER 118 ÉTAPES COMME UNE LISTE TECHNIQUE BRUTE.** Help/Aide, autostart et étape 26 restent différés. STOP après promotion et rapport.

## Historique — checkpoint de promotion du correctif 25A + Sidebar/Home du 02/10/2026

**Approbation indépendante acquise :** review ChatGPT favorable du vrai commit GitHub **342aab1297a2592479d4b14b2de878b30207e03f**, parent exact **9aef02c13b3357cdc871fac975f0707e49cf749c** ; les 17 fichiers du correctif ont été contrôlés, aucun correctif supplémentaire requis. Mission dédiée de promotion explicitement autorisée, sans changement du code approuvé ni nouvelle décision produit.

**Gate initial exécuté :** fetch réussi, branche `review`, index/worktree propres ; HEAD = origin/review = **342aab1297a2592479d4b14b2de878b30207e03f**, origin/main = **9aef02c13b3357cdc871fac975f0707e49cf749c**, ahead 1 / behind 0. Chaîne exacte 9aef02c → 342aab1, aucun commit distant inattendu.

**État post-fast-forward porté par ce checkpoint :** correctif 342aab1 approuvé, présent sur `main` après promotion stricte de la chaîne et de ce seul checkpoint documentaire. origin/main = origin/review = SHA du présent checkpoint, divergence 0/0 ; SHA exact contrôlé après push et donné au rapport. Aucun merge commit, rebase, squash ou force-push ; retour local sur `review` propre.

**Contrôles de cette mission :** diff exclusivement documentaire, code inchangé depuis 342aab1 et diff-check réussi. Prisma validate et migrate status réussis en lecture seule : 58 migrations à jour, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059. Tests et inspections locales du correctif conservés ci-dessous, non relancés ; aucun test DB mutatif ni mutation publique.

**Base publique précédente et validation conservée :** 9aef02c, dont le déploiement avait été vérifié par ChatGPT. Pause/reprise/persistance, Terminer/replay, responsive Tutoriel et Invocation normale restent validés publiquement sur cette base ; ils ne sont pas remis en attente. La promotion Git du correctif ne prouve ni Railway, ni Cloudflare Pages, ni healthcheck, ni validation publique Axel : ces preuves restent à acquérir après push.

**Recette future limitée aux corrections :** Précédent et ordre des contrôles ; Suivant stable pendant pending sans « Enregistrement… » ; carte sidebar entière cliquable sans collision ; titre Home simple ; hauteur Quotidiennes réduite et BannerHero plus haut ; splash Home recentré. Validation publique Axel du correctif toujours **NON acquise**.

**Prochaine action exacte : CHATGPT VÉRIFIE LE SHA PUBLIC, RAILWAY, CLOUDFLARE PAGES ET LE HEALTHCHECK, PUIS FOURNIT UNE RECETTE PUBLIQUE COURTE LIMITÉE AUX CORRECTIONS 342aab1.** Help final/autostart/extension restent différés ; aucune action Twitch/Gift/Giveaway/Faveur. STOP après promotion contrôlée et rapport.

## Historique — correctif de recette partielle 25A + Sidebar/Home du 02/10/2026

**Gate initial exécuté :** fetch réussi, branche `review`, worktree propre ; HEAD = origin/main = origin/review = **9aef02c13b3357cdc871fac975f0707e49cf749c**, divergence 0/0. Parent exact a30e7e9, candidat fonctionnel précédemment approuvé ; aucun changement distant inattendu.

**Déploiement public de référence :** contrôles transmis par ChatGPT dans la mission, non réexécutés ici : GitHub main/review sur 9aef02c, Railway production SUCCESS sur ce SHA exact, healthcheck public `{"status":"ok"}`, Cloudflare Pages servant le frontend avec tutorial_v1 et `/api/v1/me/tutorial` ; 58 migrations, dernière 058, aucune 059.

**Recette publique propriétaire PARTIELLE sur 9aef02c :** lancement et séquence fonctionnels ; Pause/reprise/persistance, Terminer puis replay, responsive Tutoriel et Invocation normale inchangée validés. Le prototype n'est pas intégralement validé publiquement. Corrections demandées : Précédent et ordre des contrôles, Suivant stable pendant pending, collision Accéder/Tout voir sidebar, suppression de la plage Home, réserve verticale sous Expédition et splash trop à droite.

**Correctif candidat réellement produit :** ordre Précédent / Suivant / Pause / Terminer ; retour arrière persisté puis affiché après confirmation, sans boucle avant profile. Pending désactive les trois mutations avec libellé Suivant constant ; retry typé et déclenché uniquement par le contrôle correspondant à l'intention échouée, démarrage/replay via Suivant. Overlay/inert/géométrie/ancres/API/store et sémantique Pause préservés. Sidebar : bouton couvrant la carte réutilisant run(), sans action centrale visible ni boutons imbriqués ; cinq contrôles indépendants, compteur sidebar conservé. Home : titre Quotidiennes simple, cartes toujours gelées pendant claim, footer seulement utile, hauteur rendue à BannerHero et artwork compact recentré. R1017/R1021/R1022 révisées dans leurs sources, aucun nouvel ID ni changement métier.

**Contrôles locaux du correctif :** ciblés frontend PASS 155/155 ; dernier verify:full PASS 8/8, frontend 1192/1192 et backend hors DB 1099/1099, typechecks/builds/lint et diff-check ; verify:quick PASS 5/5. Inspections Chromium aux quatre formats ; preuves détaillées dans [Tutoriel](../specifications/tutorial-v1.md) et [Accueil/Quotidiennes](../specifications/home-daily-tracker-v1.md). Messages localhost:3000 ECONNREFUSED et warning de bundle > 500 kB déjà présents, aucun test final en échec. Prisma validate et migrate status en lecture seule réussis : 58 migrations à jour, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059. Aucun test DB mutatif nécessaire, backend fonctionnel inchangé et aucune mutation publique.

**Git et prochaine action :** main reste **9aef02c13b3357cdc871fac975f0707e49cf749c** ; review = HEAD du présent commit de correction, SHA distant à contrôler après push normal, ahead 1 / behind 0 attendu. Un seul lot cohérent, correctif review non public et non validé par Axel. **REVIEW INDÉPENDANTE CHATGPT DU VRAI COMMIT GITHUB.** Aucune promotion main ni activation Twitch/Gift/Giveaway/Faveur ; Help final, autostart et extension restent différés. STOP après publication et rapport.

## Historique — checkpoint de promotion 25A + UX A–E du 02/10/2026

**Approbation indépendante acquise :** review ChatGPT du vrai commit GitHub **a30e7e9b22cbc7305229c7d574e417f144f658fc**, parent exact **e941c9ade841ad3ca73f87c29566cf4b7f1a344e**, favorable ; aucun correctif code requis. Cette mission est le checkpoint de promotion dédié explicitement autorisé, sans nouvelle décision produit ni modification du code approuvé.

**Gate initial exécuté :** fetch réussi, branche `review`, worktree propre ; HEAD = origin/review = **a30e7e9b22cbc7305229c7d574e417f144f658fc**, origin/main = **268c68750f5fcb939e6d17b94b18699eb262577b**, ahead 2 / behind 0. Chaîne stricte vérifiée : 268c687 → e941c9a → a30e7e9 ; aucun commit distant inattendu.

**État post-fast-forward porté par ce checkpoint :** code 25A et retouches A–E approuvés, présents sur `main` après promotion stricte de toute la chaîne et de ce seul checkpoint documentaire. `origin/main == origin/review == HEAD du présent checkpoint de promotion`, divergence 0/0 ; SHA exact contrôlé après push et donné au rapport. Aucun merge commit, rebase, squash ou force-push ; retour local `review` propre.

**Contrôles de cette mission :** diff exclusivement documentaire et code inchangé depuis a30e7e9 ; diff-check réussi. Prisma validate et migrate status en lecture seule réussis, 58 migrations à jour, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059. Les suites et inspections locales du candidat ci-dessous restent des preuves acquises, non relancées ici ; aucun test DB mutatif ni mutation publique.

**Validation restant à acquérir :** la promotion Git ne prouve ni Railway, ni Cloudflare Pages, ni le healthcheck, ni la validation publique Axel. Ces contrôles n'ont pas été exécutés dans cette mission. Le smoke antérieur sur 268c687 conserve uniquement son périmètre ; Tutoriel 25A et A–E attendent leur recette publique. Help final, autostart et extension Tutoriel restent différés ; aucune nouvelle table/migration, aucune activation Twitch/Gift/Giveaway, Faveur QA conservée.

**Prochaine action exacte :** vérification technique du déploiement par ChatGPT, puis recette publique propriétaire du Tutoriel 25A et des retouches A–E. **CHATGPT VÉRIFIE LE SHA PUBLIC, RAILWAY, CLOUDFLARE PAGES ET LE HEALTHCHECK, PUIS FOURNIT LA CHECKLIST « À TESTER EN PUBLIC ».** STOP après fast-forward contrôlé et rapport.

## Historique — candidat 25A + UX A–E du 02/10/2026

**Gate exécuté avant modification :** fetch réussi, branche `review`, worktree propre ; HEAD = origin/review = **e941c9ade841ad3ca73f87c29566cf4b7f1a344e**, parent exact et origin/main = **268c68750f5fcb939e6d17b94b18699eb262577b**, ahead 1 / behind 0. Aucun commit distant supplémentaire ni changement inattendu.

**Candidat réellement implémenté :** lancement uniquement Menu > Tutoriel, retour Accueil et huit étapes figées ; contrôleur à écritures confirmées, overlay portal hors de l'interface inert, ancres réelles dont union Ressources/Particules, focus/resize/scroll et présentation mobile temporaire. API dédiée authentifiée GET/PUT `/api/v1/me/tutorial`, service et store `PlayerPreference/tutorial_v1` ; aucune migration. [Architecture et progression](../specifications/tutorial-v1.md).

**Retouches A–E candidates :** titres sidebar position/total et Home plage des cartes actionnables, suppression des secondes lignes, centre sidebar distribué selon l'espace disponible, Quotidiennes intrinsèques en bas et splash compact plus présent/cadré. [Contrat, mesures et preuves locales](../specifications/home-daily-tracker-v1.md). Aucun changement métier quotidien ou Invocation.

**Validation technique locale :** PASS ciblés frontend 138/138 et backend Tutoriel/navigation 31/31 ; DB Tutoriel 1/1 en schéma privé créé puis supprimé. Dernier verify:full PASS 8/8 : frontend 1175/1175, backend hors DB 1099/1099, typechecks/builds/lint et diff-check ; verify:quick PASS 5/5. Un passage intermédiaire a échoué sur le test MP inchangé dont le TTL de saisie de 120 ms avait expiré avant assertion ; fichier isolé PASS 81/81, puis suites complètes réussies. Les messages localhost:3000 ECONNREFUSED et le warning de taille du bundle étaient déjà présents dans les logs antérieurs ; aucun test final en échec. Chromium réel GameShell/CSS production aux quatre formats 2560×1440, 1920×1080, 1366×768 et 390×844 : 32 états UX et 32 étapes Tutoriel, interactions/focus, reprise/replay/retry, double clic/tactile, resize et restauration Communauté contrôlés. Cette validation locale ne constitue ni une review indépendante ni une validation publique Axel.

**DB reconfirmée en lecture seule :** Prisma validate et migrate status réussis ; 58 dossiers et 58 migrations enregistrées terminées, zéro inachevée, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059. Le test mutatif utilise exclusivement son schéma privé ; aucune mutation publique, aucun déploiement volontaire, aucune activation Twitch/Gift/Giveaway.

**Git du candidat :** main demeure **268c68750f5fcb939e6d17b94b18699eb262577b** ; review = HEAD du présent commit candidat, SHA à vérifier sur GitHub après publication, ahead 2 / behind 0 attendu. Le commit ne contient pas son propre SHA. Un seul lot au-dessus du checkpoint e941c9a ; aucune promotion autorisée.

**État exact et prochaine action :** 25A et A–E implémentés/testés localement, candidats review uniquement, **non publics et non validés par Axel**. **REVIEW INDÉPENDANTE CHATGPT DU VRAI COMMIT GITHUB SUR review.** Aucune préparation de promotion ; Help final, autostart et extension du Tutoriel restent différés. STOP après publication review et rapport.

## Historique — checkpoint de passation documentaire du 02/10/2026

**Gate initial exécuté :** fetch réussi, branche locale `review`, worktree propre ; HEAD = origin/main = origin/review = **268c68750f5fcb939e6d17b94b18699eb262577b**, divergence 0/0, aucun commit inattendu. Un seul commit documentaire, parent exact 268c687 ; aucune promotion main autorisée dans cette mission.

**Git après publication de ce checkpoint :** main = **268c68750f5fcb939e6d17b94b18699eb262577b** ; review = **HEAD du présent checkpoint documentaire, SHA exact à vérifier via GitHub**, ahead **1** / behind **0**. Le commit ne peut contenir son propre SHA ; ne pas réutiliser le SHA de base comme nouveau SHA review. Retour local review propre.

**Public acquis :** dernier micro-polish b35f988 promu via 268c687. Le smoke propriétaire reçu sur ce déploiement valide projection quotidienne commune, navigation, masques/reload, restoreLast/LIFO, Accueil dynamique, cartes cliquables, BannerHero compact, Expédition compacte, claim partagé, Sidebar/Home et 2560×1440 dans le périmètre des recettes documentées. Validations Administration/Journal/Arcade antérieures conservées ; aucun défaut métier restant signalé.

**Retouches UX non bloquantes ouvertes et non implémentées :** A titre sidebar `Quotidiennes [position/total]` sans deuxième ligne ; B même principe de titre Home, position cohérente avec sa présentation à préciser ; C espacement central sidebar dynamique ; D Quotidiennes Home encore plus basses/intrinsèques ; E splash BannerHero plus imposant et cadré. Contrat exact et limites dans [Accueil/Quotidiennes, A–E](../specifications/home-daily-tracker-v1.md). Ces cinq points sont à transmettre au premier lot de la prochaine conversation ; aucune correction dans ce checkpoint.

**Domaine actif : 25A, prototype Tutoriel interactif cadré uniquement.** [Tutoriel V1, source canonique](../specifications/tutorial-v1.md) fixe R1015–R1020 : lancement Menu manuel sans autostart/header, overlay sur vraie interface, interactions bloquées, Pause/Terminer/Suivant, persistance PlayerPreference existant sans migration, reprise/replay, huit étapes Accueil/sidebar/chat. R822 reste historique, révisé explicitement. Aucun moteur/API ni activation Menu implémentés. Help final et extension du Tutoriel sont différés après validation propriétaire du prototype ; R728–R731 restent acquis.

**Infrastructure conservée :** preuves antérieures de la promotion et état fourni par la mission, non recontrôlés sur les services dans ce lot documentaire : Railway **54ca273d-0584-4f17-8a8b-8240be882434**, SUCCESS, déploiement exact 268c687 ; PostgreSQL public **58 migrations terminées, 0 inachevée**, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059. Twitch générique toujours pause R942 ; Gift/Giveaway bridges OFF ; Faveur QA conservée ; PAID_INFRA_APPROVED=false. Aucun changement public, gameplay, DB, code ou Prisma.

**Méthode de reprise :** préférence révisable **GPT-6.1 Sol**, niveaux et règles de questions/prompts consolidés dans le [Guide ChatGPT](../../.chatgpt/CHATGPT_GUIDE.md) et le [workflow](../process/implementation-workflow.md). [Procédure de passation](../process/conversation-handoff.md) appliquée : état réel et sources consolidés, checkpoint documentaire publié sur review. Pas de TASK_STATE.

**Prochaine action :** review indépendante ChatGPT du checkpoint publié, puis seulement ChatGPT rédige le prompt de reprise. Changement explicitement prévu de conversation **ChatGPT ET Codex** : fermer les conversations actuelles après cette review, reprendre selon la procédure et valider le contexte avant tout développement. Codex ne prépare pas ce prompt et n’entame ni retouches UX ni prototype dans cette mission. **STOP.**

## Historique — promotion du dernier micro-polish étape 24 du 02/10/2026

**Approbation indépendante ChatGPT transmise par le propriétaire :** acquise sur **b35f98819e9402f8f8fe3b333ceab30e1807db38**, parent exact **e848ea6f0eaaab021b6baba2400d1ddea84c565b**. R1014 approuvée techniquement ; dernier micro-polish prêt à la promotion dédiée explicitement autorisée. Aucun correctif code supplémentaire ni nouvelle décision produit.

**Gate initial exécuté :** fetch, review propre ; HEAD = origin/review = b35f988, origin/main = e848ea6, ahead 1 / behind 0, aucun commit inconnu. Avant promotion, registre public en lecture seule reconfirmé : **58 migrations terminées, 0 inachevée, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059**. Prisma migrate status : code 0, 58 migrations à jour. Aucun code/backend/migration ajouté après le candidat ; un seul checkpoint documentaire sur review.

**État post-fast-forward visé par ce checkpoint :** chaîne stricte e848ea6 → b35f988 → ce checkpoint docs-only sur main/review, divergence 0/0, retour local review propre. Les contrôles du SHA final Railway, du registre Supabase et du bundle public suivent le push main ; aucun résultat de déploiement n'est anticipé ici. Les suites et 60 inspections du candidat ci-dessous restent des preuves antérieures, non relancées dans cette mission documentaire.

**Prochaine étape après vérifications techniques :** dernier smoke propriétaire Sidebar / Accueil / Aperçu, notamment densité à 1920×1080, ↺ après reload, Expédition compacte et allocation Bannières/Quotidiennes. Le métier étape 24 et les validations 22/23 restent acquis dans leur périmètre ; la finition nouvellement promue attend cette recette. Zéro gameplay, masque réel, mutation publique ou action Twitch par Codex. **STOP ; étape 25 non commencée.**

## Historique — dernier micro-polish UX étape 24 du 02/10/2026

**Gate initial exécuté :** fetch réussi, branche locale review et worktree propres ; HEAD = origin/main = origin/review = **e848ea6f0eaaab021b6baba2400d1ddea84c565b**, divergence 0/0, aucun commit inconnu. Ce checkpoint public a reçu le dernier smoke propriétaire ; le métier de l'étape 24 est validé. Le défaut restant signalé à 1920×1080 équipe 4/4 est le chevauchement action/navigation, accompagné de demandes de densité et d'allocation verticale.

**Candidat :** tracker réduit au titre, une zone d'état utile et l'action, sans refresh visuel, détail secondaire ni ligne feedback permanente. Pending/succès/erreur remplacent l'état ; refresh/revalidation restent actifs et aria-busy les expose. Expédition RUNNING affiche le personnage réel et le countdown, sans « En cours », sur sidebar et Accueil. Header/centre/footer restent distincts ; footer ancré en bas. Accueil desktop en deux lignes minmax(0,1fr) auto : bannière flexible, artwork contenu dans sa région, résumé intrinsèque en bas ; cartes Home validées inchangées, mobile en flux naturel.

**R1014, contrat UX durable demandé :** ↺ annule le dernier masque (LIFO), sélectionne l'activité restaurée encore pertinente et place le focus sur son titre ; ARIA nomme le dernier masque. La lecture localStorage filtre/déduplique sans réordonner, même après reload. L'action plurielle Accueil utilise restoreAll ; clés/env/Player/date inchangés. R1011–R1013 précisés uniquement pour la présentation. [Contrat et preuves](../specifications/home-daily-tracker-v1.md), [décisions](../specifications/decisions-log.md).

**Contrôles du candidat :** voir le bilan dédié du contrat Accueil/Quotidiennes. Chromium complet/CSS réels, équipe 4/4, objectif et Chat ouvert, scénario six activités disponibles/Roue sélectionnée/Expédition RUNNING/un masque : gap action→navigation **101,375 px à 1920×1080**, sans intersection ; cadre tracker et cartes supérieures inchangés. Bannière **280,797 → 525,063 px**, Quotidiennes **341,938 px**, bord inférieur aligné au centre et aucun scroll. Les quatre formats et états claim, reload/LIFO/focus, restauration globale et refresh ont été contrôlés localement. Ces preuves synthétiques ne valident pas publiquement le nouveau candidat.

**Validations exécutées :** ciblés **101/101**, frontend **1 142/1 142**, backend hors DB **1 073/1 073** ; `verify:quick` **5/5**, `verify:full` **8/8**, typechecks/builds/lint/diff-check réussis. Prisma validate/statut **0/0**, schéma valide et **58 migrations à jour**, lecture seule, aucune 059. Warnings React/bundle antérieurs conservés ; aucun test DB mutatif. Détails et mesures des quatre formats dans le contrat.

**Publication attendue :** un seul commit parent exact e848ea6 sur review ; origin/main reste e848ea6, ahead 1 / behind 0, retour review propre. Aucun backend, migration, DB mutative, domaine, priorité, claim, date ou synchronisation modifié ; zéro mutation publique. **Prochaine étape : review indépendante ChatGPT du commit poussé, sans promotion main. STOP ; étape 25 non commencée.**

## Historique — promotion du polish UX étape 24 du 02/10/2026

**Approbation indépendante transmise par ChatGPT :** acquise sur **865c303a9931acb4cdfba4cebd5dcf80b554e6ff**, parent exact **51e0710087a7b807cea5557f5e9db4edd2315892**. R1011–R1013 acquises techniquement ; étape 24 prête pour la promotion strictement autorisée ici, aucun correctif code supplémentaire ni nouvelle décision produit.

**Gate initial de promotion exécuté :** fetch, branche review propre ; HEAD = origin/review = 865c303, origin/main = 51e0710, ahead 1 / behind 0. Chaîne autorisée : 51e0710 → 865c303 → un seul checkpoint docs-only. Prisma migrate status en lecture seule : code 0, 58 migrations à jour ; registre public reconfirmé : **58 terminées, 0 inachevée, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059**. Aucune migration dans le candidat approuvé.

**État post-fast-forward visé :** toute cette chaîne sur main/review, divergence 0/0, retour local review propre. Les vérifications dédiées du SHA final Railway, Supabase et du bundle public suivent le push main ; aucun déploiement réussi n'est anticipé par ce checkpoint. Les suites/inspections du polish ci-dessous sont des preuves antérieures, non relancées pour cette mission documentaire.

**Prochaine action après contrôles techniques :** smoke UX final propriétaire de Sidebar / Accueil / Aperçu. Les validations métier du premier smoke et celles de 22/23 restent acquises dans leur périmètre réel ; la finition UX n'est pas encore publiquement validée. Zéro gameplay, masque utilisateur, mutation publique ou action Twitch par Codex. **STOP ; étape 25 non commencée.**

## Historique — polish UX étape 24 du 02/10/2026

**Gate initial exécuté :** fetch, branche locale review, worktree propre ; HEAD = origin/main = origin/review = **51e0710087a7b807cea5557f5e9db4edd2315892**, divergence 0/0, aucun commit inattendu. Un seul commit cohérent de correction, parent exact 51e0710, publication normale review uniquement puis STOP.

**Retour public propriétaire reçu :** projection commune, masquage/reload, principe Accueil dynamique, séparation actions/états, navigation quotidienne, Expédition, micro-polish Administration/Journal/Arcade validés. Le défaut restant porte sur la densité, notamment 1920×1080 avec équipe complète. Cette validation du fonctionnement ne clôture pas la finition visuelle de l'étape 24.

**Livraison UX R1011–R1013 :** tracker sans icône/fallback/statut générique, restauration accessible dans une cellule réservée d'en-tête, action dans le centre flexible et chevrons/Tout voir au bas. Accueil sans cinq raccourcis redondants ; BannerHero compact sans DOM Invocation-footer, mode normal conservé. Panneau Quotidiennes avec trois cartes-boutons maximum, micro-libellés et lien Aperçu ; deux lignes secondaires maximum, Expédition non-actionnable prioritaire et état terminé confirmé présentable. Masques communs, séparation logique, priorités, claim partagé, revalidation, dates et sources métier inchangés. [Contrat et contrôles](../specifications/home-daily-tracker-v1.md), [décisions](../specifications/decisions-log.md).

**Contrôles de ce candidat :** défauts reproduits (13 échecs avant correction), ciblés 96/96 sur sept fichiers ; frontend complet **1 137/1 137 sur 109 fichiers**, backend hors DB **1 073/1 073 sur 101 fichiers**. Typechecks/builds frontend/backend, lint sans erreur, `verify:full` 8/8, `verify:quick` 5/5, diff-check réussis. Prisma validate/statut : codes 0, **58 migrations, base à jour**, lecture seule. Aucun test DB mutatif, backend, migration, dépendance ou domaine Admin/Arcade modifié ; warnings React/bundle antérieurs conservés.

**Inspection locale réelle :** Chromium, GameShell et CSS de production, équipe 4/4, objectif, Chat ouvert, sept activités disponibles et Expédition RUNNING. Quatre formats 2560×1440, 1920×1080, 1366×768, 390×844 ; onze états par format, cadres tracker/supérieurs comparés avant/après, écart maximal **0 px** sur desktop et largeur/hauteur mobile. L'apparition de Réafficher seule ne déplace aucun descendant (0 px). Aucun chevauchement, scroll tracker ou overflow horizontal ; cartes/actions/navigation lisibles, masques/reload/restauration vérifiés. Mobile en flux naturel : sa position verticale peut évoluer avec le contenu Accueil. Preuves synthétiques locales, sans recette publique de ce polish.

**Prochaine étape :** review indépendante ChatGPT du commit effectivement poussé sur review, puis éventuelle mission dédiée de promotion/recette propriétaire de finition. **Aucune promotion main ici ; STOP, étape 25 non commencée.** Zéro mutation publique/gameplay/Twitch par Codex, données historiques et Faveur QA conservées.

## Historique — checkpoint de promotion du 02/10/2026

**Approbation indépendante transmise par ChatGPT :** acquise sur **2df4fa154e40fbc4bf6d040f126069e98c9a1901** et **52e7a2bbe9ff00e44cb109c1f423f6d8775b05e8**, parent exact du correctif : 2df4fa1. R1004–R1010 acquises techniquement, y compris la séparation Accueil **À faire maintenant** (trois actions maximum) / **En cours** (deux états maximum), masques communs et absence de duplication. La validation publique 22/23 reste limitée aux parcours déjà acquis ; aucune nouvelle décision produit.

**Gate initial de cette mission :** fetch, review propre sur 52e7a2b, origin/main sur **2aa086edddcde8de8325f4e999c1e41d7d9e3976**, ahead 2 / behind 0. Chaîne autorisée : 2aa086e → 2df4fa1 → 52e7a2b → un unique checkpoint docs-only. Avant promotion, Prisma migrate status en lecture seule réussi (code 0, 58 migrations à jour) et registre public reconfirmé : **58 terminées, 0 inachevée, dernière `20261001120000_058_harden_arcade_session_lifecycle`, aucune 059**. Aucune migration dans les deux commits approuvés.

**État visé par ce checkpoint après fast-forward strict :** toute la chaîne approuvée et ce seul checkpoint sur main/review, divergence 0/0 ; retour local review propre. La promotion précède les vérifications dédiées du SHA final Railway, du registre Supabase et du bundle public. Ces preuves de déploiement ne sont pas anticipées ici. Les suites et inspections ci-dessous restent les preuves des lots d'implémentation, non relancées pour ce checkpoint documentaire.

**Prochaine action après les contrôles techniques de cette mission :** recette publique propriétaire de Sidebar / Accueil / Aperçu et du micro-polish Admin/Arcade. Zéro recette gameplay par Codex, aucune mutation publique ni action Twitch ; données historiques et Faveur QA conservées. **STOP ; étape 25 non ouverte.**

## Historique — implémentation du lot groupé du 02/10/2026

**Gate réellement exécuté avant travail :** fetch, branche locale review, worktree propre ; HEAD = origin/review = origin/main = **2aa086edddcde8de8325f4e999c1e41d7d9e3976**, divergence 0/0. Un lot séquentiel, sans branche/worktree parallèle, publication review uniquement puis STOP et review indépendante ChatGPT. Aucune promotion/déploiement ou mutation publique dans cette mission.

**Validation propriétaire explicitement reçue :** Rôles, Journal/filtres/détail, layout Arcade, Quitter, Règles, Puissance 4, Records. Elle couvre ces parcours de 22/23, sans généralisation à chaque mutation Admin. Le propriétaire confirme les ajustements résiduels et autorise l'étape 24 avec délégation des détails. Décisions [R1004–R1010](../specifications/decisions-log.md), [Administration](../specifications/administration-moderation-v1.md), [Arcade](../specifications/arcade-v1.md).

**État technique antérieur, daté et conservé :** promotion 2aa086e contrôlée, Railway f9cd6801-6dc5-4137-ad16-43329407c1eb SUCCESS sur ce SHA, frontend public contrôlé ; 58 migrations terminées et dernière 058, aucune 059. Les anciens relevés 6 FINISHED, 7 ABANDONED, 213 receipts, 3 grants, score 22 et XP 5024 sont des preuves historiques de recette, jamais des constantes à restaurer ou des valeurs supposées de la journée actuelle.

**Livraison candidate :** [contrat canonique Accueil / Quotidiennes](../specifications/home-daily-tracker-v1.md). Projection pure commune des neuf sources existantes, états/actionnabilité/dates distincts, pas de faux terminé ni compteur de complétion ; Aperçu neuf cartes et trois onglets conservés. Suivi une activité dans le cadre bas existant, chevrons manuels, sélection stable, masque local et restauration, Tout voir explicite. Accueil bannière compacte, cinq destinations et Aujourd'hui avec au plus trois suggestions. Claim existant partagé et gel d'intention ; autres raccourcis uniquement consultatifs. Revalidation commune focus/visible/minuit Paris et échéances propriétaires, snapshots confirmés conservés après erreur, réponses antérieures invalidées et sessions isolées. Aucun nouveau backend, schéma, table, migration, dépendance, Tutoriel ou équilibrage.

**Micro-polish intégré :** titre Rôles ciblé, état coche/rond et alignements, actions Progression/Objets en bas ; Journal trois colonnes sans JSON en liste, détail hiérarchisé et traductions ; citation Arcade élargie et hover sans translation locale. Les contrôles de ce lot et leurs limites sont consignés dans le contrat canonique ; les preuves ci-dessous restent celles des lots antérieurs.

**Contrôles du nouveau candidat :** frontend 1 119/1 119 (109 fichiers), backend hors DB 1 073/1 073 (101), dont 58 nouveaux tests quotidiens ; typechecks/builds frontend/backend, lint sans erreur, `verify:quick` 5/5, `verify:full` 8/8, diff-check et Prisma validate/statut migrations en lecture seule réussis (58, à jour). Chromium local GameShell/CSS réels aux quatre formats : 80 mesures du suivi sur dix états et deux équipes, écart maximal 0 px ; Accueil/Aperçu, Admin avec textes longs et Arcade trois jeux/citations courtes-longues inspectés. Limites et budgets dans la source canonique. Aucun test DB privé mutatif, backend inchangé. Publication normale `review` puis STOP pour review indépendante ; main reste 2aa086e, aucune validation publique de ce candidat anticipée.

**Correction unique après review indépendante de 2df4fa1 :** la liste mixte du tracker plaçait l'Expédition RUNNING dans les cartes Accueil et dans le footer, lequel ignorait son masque. Correctif de conformité R1007–R1010 : deux helpers purs séparent jusqu'à trois actions immédiates et deux états En cours sans duplication, avec masques partagés et cartes stables pendant le claim/feedback. Sidebar, Aperçu et règles métier inchangés ; aucun nouvel ID R, backend, migration ou mutation publique. Commit distinct 52e7a2b publié sur review au-dessus de 2df4fa1, main encore 2aa086e lors de cette implémentation. Review indépendante désormais acquise selon le point courant ; étape 25 non ouverte. [Contrat et contrôles du correctif](../specifications/home-daily-tracker-v1.md).

**Contrôles du correctif :** dix tests ajoutés et gel des cartes renforcé, ciblé Home/Quotidiennes/GameShell 85/85 ; frontend complet 1 129/1 129, backend hors DB 1 073/1 073, typechecks/builds/lint, `verify:quick` 5/5 et `verify:full` 8/8, diff-check réussis. Prisma valide et 58 migrations à jour en lecture seule ; aucun test DB mutatif. Inspection locale GameShell réel : 32 cas sur quatre formats, séparation et masquage conformes, En cours accessible dans le scroll mobile/petit desktop. Les preuves du paragraphe précédent restent celles du candidat initial.

## Historique 22/23 — deuxième recette publique et dernier polish UX

**Gate initial du lot UX :** fetch exécuté, `HEAD = origin/main = origin/review = f13f90dea5c661015c0c2fac41c660f89716d227`, branche locale `review`, divergence 0/0, worktree propre. Chaîne déjà approuvée et promue : `81066badca66ac054d7dc515005eda6d10a8b913` → `cb7b2a45679985a867ae6ef29b092a63f512449f` → `f13f90dea5c661015c0c2fac41c660f89716d227`.

**Review et gate de promotion du 02/10/2026 :** review indépendante ChatGPT acquise sur `b373aa2aa058ddf6095a1ec442b30dc7549765af`, parent exact `f13f90dea5c661015c0c2fac41c660f89716d227`. Fetch initial conforme : main sur ce parent, review sur le candidat, ahead 1 / behind 0, branche review et worktree propre. Ce checkpoint modifie seulement Master, Arcade et Administration ; aucun code, décision produit, schéma ou migration après le candidat approuvé. Les suites du polish ci-dessous sont conservées comme preuves antérieures, sans nouvelle exécution pour ce checkpoint documentaire. Promotion explicitement autorisée, sans recette utilisateur par Codex ; public toujours sur 058, aucune 059.

### Preuves publiques conservées

Le propriétaire a validé le fonctionnement général et joué exactement trois parties Moyen :

| Jeu | Résultat | Points / XP | Version finale | Particularité |
| --- | --- | ---: | ---: | --- |
| Morpion | DRAW | 5 / 5 | 9 | Rules/Scoring V1 |
| Puissance 4 | LOSS | 3 / 3 | 15 | Rules/Scoring V1 |
| Memory | LOSS | 1 / 1 | 90 | 2 paires sur 18, Rules/Scoring V1 |

Scores 5+3+1 = **9** ; **3 DailyGrant**, **3 ArcadeStat**, **117 ArcadeReceipt** = 3 START + 9 + 15 + 90 transitions. XP **5015 → 5024**, soit +9 ; niveau 100, overflow **14/30**, récompenses overflow déjà revendiquées **67**, sans nouveau palier attendu. Lecture publique de contrôle pendant le correctif : ces trois sessions, versions/résultats/points/XP, agrégats, receipts, XP 5024 et compteur 67 sont retrouvés sans modification. Aucune session, preuve, grant ou statistique V1 nettoyée/recalculée.

Les huit onglets ADMIN ont chargé pendant le test public. Le retrait de TESTER puis sa réattribution ont produit `roles/revoke-tester` puis `roles/grant-tester` selon la preuve propriétaire. Les rôles finaux **ADMIN + MODERATOR + TESTER** sont retrouvés en lecture seule et conservés. Les autres mutations Administration ne sont pas déclarées testées publiquement par ce smoke test.

**Deuxième recette propriétaire sur f13f90d :** les éléments R991–R998 sont validés dans le périmètre indiqué par la mission : Système/Rôles, Festivals, Journal dix/page, Historique Bannières, suppression des signalements, modale Règles, Memory V2, reprise et onglets verrouillés, marqueurs d'alignement, principe des sous-onglets Records, score/XP, abandon et compatibilité V1/V2. L'état lu ensuite et transmis par le propriétaire est **6 FINISHED, 7 ABANDONED, 0 ACTIVE, 213 receipts, toujours 3 grants et XP 5024**. Stats : Puissance 4 Moyen score 3/played 1/losses 1 ; Difficile 4/1/1 ; Memory Moyen score 3/played 2/losses 2/bestPoints 2 ; Morpion Moyen score 5/played 1/draws 1 ; Difficile 7/1/1. Total **22**, contre 9 avant recette : **+2 Memory, +4 Puissance 4, +7 Morpion = +13 score et +0 XP**. Le contrat des parties libres et l'abandon sans XP supplémentaire sont validés publiquement. Ces preuves sont conservées ; aucune donnée publique n'est modifiée par ce lot.

### Dernier polish UX approuvé — R999–R1003

Rôles compacts avec boutons proches de leurs libellés ; Journal en listes Domaine/Action alimentées par les couples distincts ADMIN-only de l'historique, filtre serveur et remise à page 1. Arcade supprime son header visible : Quitter reste en haut à gauche pendant ACTIVE, Règles/Records en haut à droite, Commencer/Rejouer en bas. Une confirmation Quitter cible la session, attend la requête en vol, relit la version courante et conserve une fin naturelle. Une erreur ambiguë retente automatiquement une seule fois l'intention exacte, puis réconcilie par GET ; erreur discrète si l'état reste incertain, sans bouton de retry technique ni gain reconstruit depuis un GET.

Textes Général simplifiés, pourcentages IA retirés de l'affichage seulement, labels versus/chiffres de colonnes/ligne Partie libre supprimés, footer XP compact, citation centrée verticalement, plateaux adaptés à la hauteur disponible et sous-onglets Score de style secondaire. Les règles métier, tailles Memory, IA, grants, stats, classements et privacy restent ceux publiquement validés. **Aucune migration 059, aucun test gameplay public par Codex.** La publication initiale du polish était limitée à review ; sa promotion technique a été réalisée au checkpoint 2aa086e ; R1004 consigne le smoke propriétaire suivant.

**Contrôles du dernier polish :** défauts reproduits avant correction par trois échecs ciblés (Quitter en vol ACTIVE/FINISHED et listes du Journal), puis frontend ciblé **62/62** : Arcade 24, ModerationScreen 15, AdminPanels 23. Routes Administration **4/4** et PostgreSQL Administration **6/6**, exclusivement dans un schéma privé isolé avec nettoyage. Les tests couvrent les facettes réelles indépendantes des pages/filtres, les valeurs techniques, la garde ADMIN, les résultats vides, le retry exact borné sans double action ni récompense inventée, les timers et l'identité de la session quittée. History n'a pas nécessité de ciblage séparé ; sa suite reste incluse dans les tests complets.

**Suite complète du dernier polish :** frontend **1 061/1 061 sur 106 fichiers**, backend hors DB **1 073/1 073 sur 101 fichiers** ; typechecks et builds frontend/backend, lint, `verify:quick` **5/5**, `verify:full` **8/8**, Prisma validate et diff-check réussis. `prisma migrate status` public exécuté en lecture seule : **58 migrations, base à jour**, aucune candidate. Avertissements non bloquants : recommandations lint React et bundle Vite >500 kB. Aucun changement de dépendance, schéma ou migration ; zéro mutation publique. Logs et captures conservés hors dépôt.

**Inspection du dernier polish :** Chromium local, données synthétiques, GameShell complet et CSS de production, réseau externe bloqué. Memory trois tailles et fini, Morpion/Puissance 4 ACTIVE, Règles Général/Memory, Records Score, confirmation Quitter, Système et Journal inspectés à **1920×1080, 2560×1440, 1366×768 et 390×844**. Body Arcade **737/737** et **1097/1097 px** (scrollHeight/clientHeight) aux deux grands formats : cinq plateaux entiers, actions supérieures et footer visibles, Rejouer conservé en bas. Memory Moyen grandit de **555×555 à 620×620 px** ; ouverture des règles sans déplacement du plateau. Petit desktop : scroll borné **500/425 px** ; mobile : flux vertical. Sous-onglets Score neutres **30 px**, principaux **36 px**. Rôles : boutons à **10 px** du texte, trois groupes horizontaux desktop puis verticaux mobile ; huit onglets ADMIN sur une ligne aux grands formats. Aucune erreur JavaScript dans le parcours final. Ces contrôles locaux ne valent pas dernier smoke public propriétaire.

### Correctif cb7b2a4 déjà approuvé, promu et recetté

[R991–R998](../specifications/decisions-log.md) : Memory V2 4×4/8 paires, 5×5/12 avec centre neutre, 6×6/18 ; interpolation versionnée et mémoire IA adaptée sans faces cachées. Une ACTIVE globale par Player, reprise automatique, suppression Pause/Reprendre, Quitter/ABANDONED sans gain/compteur/effet secondaire et avec receipt durable. V1 reste lisible ; Global classe les points uniquement, avec dénominateur de la meilleure session et UUID stable entre ex aequo. Règles en modale, Records simplifié, cercle creux et pions CSS centrés, réplique côté adversaire et desktop sans scroll. [Contrat Arcade](../specifications/arcade-v1.md).

Administration : Système, Rôles pleine largeur avant les outils, huit onglets sur une ligne à 1920 minimum, Festivals occupant la hauteur restante avec son propre scroll. Journal dix/page sous autorité serveur, titres humains, filtres sans titre interne. Suppression explicite des signalements Chat depuis liste/détail avec confirmation et page ajustée, message source conservé. Historique Bannières masque snapshot absent/suffixes/votes zéro, sans modifier les snapshots ni les autres catégories. Les permissions R959–R969 et le métier Event sont inchangés. [Contrat Administration](../specifications/administration-moderation-v1.md).

### Base et contrôles du correctif cb7b2a4

Migration exacte **`20261001120000_058_harden_arcade_session_lifecycle`** : DDL transactionnel uniquement, CHECK ACTIVE/FINISHED/ABANDONED et versions 1/2, index partiel global par Player. Plusieurs ACTIVE font échouer la migration, sans choix arbitraire ni réécriture. Validée initialement parmi les 58 migrations privées, puis appliquée par Railway pendant la promotion f13f90d ; lecture publique des CHECK et de l'index global conforme. Le statut Prisma public relu pendant le présent polish est **à jour : 58 migrations**, sans migration candidate. Aucun resolve ni écriture manuelle du registre.

Les tests mutatifs utilisent exclusivement des schémas privés avec nettoyage. Contrôles finaux du candidat : frontend ciblé **61/61** (Arcade 18, HistoryScreen 6, ModerationScreen 15, AdminPanels 22) ; backend ciblé **92/92 sur 14 fichiers**, dont Arcade domaine 31/routes 4 et Administration routes 3, avec régressions XP/Missions/Notifications/Gacha/Social. PostgreSQL privé **69/69 sur 4 fichiers** : Arcade 12, Administration 6, Missions 21, Chat/XP/économie/notifications 30. Le cas de plusieurs ACTIVE provoque l'échec atomique attendu de 058 ; concurrence inter-jeux, abandon sans effet métier, replay durable et records V1/V2 sont couverts.

Suite complète : frontend **1 054/1 054 sur 106 fichiers**, backend hors DB **1 072/1 072 sur 101 fichiers** ; typechecks et builds frontend/backend, lint, Prisma validate, `verify:quick` **5/5**, `verify:full` **8/8** et diff-check réussis. Les premiers contrôles ont nécessité l'adaptation de fixtures V1 et de mocks du harness visuel ; dernières exécutions réussies. Avertissements restants : recommandations lint React (dont synchronisation de l'écran Arcade avec l'état serveur), bundle Vite >500 kB, dépréciation pg des requêtes concurrentes en tests. Aucune mise à jour de dépendance dans ce lot.

Inspection Chromium locale avec GameShell complet, sidebar/chat et CSS de production, réseau externe bloqué : **1920×1080, 2560×1440, 1366×768, 390×844**. Memory trois tailles, Morpion/Puissance 4, Rules, Records Score, Quitter, Système et Festivals avec/sans éditeur. Body Arcade **scrollHeight/clientHeight 678/678 à 1920 et 1038/1038 à 2560**, sur les cinq plateaux ; plateau stable sous Rules. Sous-onglets Score **30 px** contre **36 px** principaux ; huit onglets ADMIN non tronqués à 1920/2560. Liste Festivals utile **714/1074/402 px** aux trois desktops, bas aligné au panneau moins ses 17 px de bord/padding, scroll interne lorsque nécessaire. Captures des formes CSS inspectées ; petit desktop avec scroll borné, mobile en flux vertical. Ces preuves locales ne valent pas recette publique du correctif.

Inspection complémentaire à 1920×1080 et 390×844 : Journal dix lignes et détail, signalements Chat liste/détail/confirmation annulée, Historique Bannières avec snapshot absent et votes 2/1/0. Aucun vote zéro affiché, aucune exception de page après correction du mock MP du harness ; aucune requête externe autorisée.

Le polish a actualisé Master, Arcade, Administration, navigation et décisions ; son checkpoint d'approbation touche uniquement les trois premiers documents. Roadmap et ordre macro restent inchangés : aucune étape 24, aucun nouveau domaine. Import autonome Personnages + Assets reste une dette volontaire. Review indépendante du polish acquise ; après la promotion technique et ses contrôles dans cette mission, **ce dernier smoke est désormais acquis dans le périmètre R1004, sans validation publique de toutes les mutations Administration**.


## Étape 21 — Compléments Notifications transversaux, validés publiquement sur les surfaces

Le candidat ajoute `missions / PERMANENT_MISSION_COMPLETED` et `OPEN_MISSIONS` : une notification par nouvelle Mission terminée par `UI` ou `SYSTEM` courant, dans la transaction récompense/progression, sans claim, modale ni backfill R301. Chat interne restitue immédiatement ses complétions sans notification standalone ; Twitch générique, Admin et migration n'en créent aucune. R956 exclut une Notification persistante pour le spectateur Concours. Le cycle Event respecte l'archive manuelle d'un agrégat jusqu'à un nouveau message et résout les annonces devenues inactionnables. Présentation et navigation des types physiques passent par le registre typé frontend, avec curseur R957. Aucune migration 057, notification publique de test ni activation Twitch. Voir [Notifications V1](../specifications/notifications-v1.md), [décisions R954–R958](../specifications/decisions-log.md) et [architecture](../architecture/backend-architecture-v1.md).

État : le candidat fonctionnel `c11c6f5eeb9a9a9fa96fbc83f504ffcd9a7e3811` a été approuvé par la review indépendante ChatGPT du vrai commit GitHub, puis promu par fast-forward strict au checkpoint `c5f4412a9b07832916a288905cf9a9499cbf8e30`. Railway a déployé exactement ce SHA (`5e1d4990-c7a0-4fe5-b7c7-41d6b575ca24`) en `SUCCESS` : build réussi, 56 migrations sans attente, Application ready et healthcheck `/health` réussi ; le frontend public sert le bundle Notifications. Aucune migration 057.

**Validation publique propriétaire acquise dans son périmètre réel :** « C’est bon, Notifications et Missions s’affichent normalement. » Après déploiement, le standalone a chargé, le panneau Notifications s'est ouvert et son rendu général n'a présenté aucune erreur visible ; `Activités > Missions` s'est affiché et la navigation générale vers cet écran a fonctionné sans problème évident de layout ou de fonctionnement. Ce smoke test ne prouve pas les transitions d'une nouvelle notification Mission. Kichnifou avait déjà terminé toutes les Missions B/A/S ; seules `perfect_friendship_z` (« Amitié parfaite », 0/1, 160 000 Primogemmes) et `manual_combat_wins_z` (« Maître du combat », 30/50, 160 000 Primogemmes) restaient incomplètes. Aucune Mission ni notification n'a été forcée, aucune progression ou récompense publique n'a été modifiée artificiellement. La création player-facing de `PERMANENT_MISSION_COMPLETED`, son atomicité, ses sources, ses deep-links et ses replays demeurent validés techniquement par la review indépendante et les tests PostgreSQL privés, sans essai public réel de ce chemin. La rétention historique définitive reste à l'étape 27. Cette clôture a permis d’ouvrir les étapes 22/23 ; leur état courant et la prochaine action figurent en tête du Master.

## Giveaway / Wish natif spécialisé — clôture publique R947

**Décision propriétaire :** R946–R953 dans le [journal](../specifications/decisions-log.md). R950 supprime le reroll natif V1 et supersède R708 ; la preuve de reroll legacy reste conservée. Le propriétaire clôture R947 comme **VALIDÉ PUBLIQUEMENT** sur le parcours Twitch Open → Standalone Close et le cœur Wish/comptage/récompenses/shutdown. La session B prévue (Standalone Open → Twitch Close) n'a pas été exécutée : ces deux points d'entrée sont implémentés et couverts par les suites automatisées, mais ne sont pas validés publiquement par ce pilote.

**Physiquement implémenté :** migration additive 056, core transactionnel et idempotent, `!wish` et `!giveaway stats/open/close` dans le consumer spécialisé du webhook partagé, commandes et sorties GachaImpact exclues du compteur, credential OAuth/refresh chiffré, preuve distante de subscription avant ouverture, envoi Helix avec états/retries indépendants, panneau Modération privé, crédits 1 600 Primogemmes et rangs chat 2 000/1 500/1 000/500 particules, statistiques Economy et notification informationnelle agrégée. Aucun écran joueur, parser Twitch global, XP Twitch, mirroring ou reroll natif. Sources : [audit actualisé](../legacy/21-giveaway-wish-audit.md), [architecture backend](../architecture/backend-architecture-v1.md#giveaway--wish-natif--pilote-r947-valide-publiquement), [schéma](../architecture/postgresql-schema-v1.md#giveaway-natif--migration-additive-056-candidat-review) et [commandes](../commands/command-reference.md#giveaway).

**Lifecycle inclus :** les correctifs `3751ebb2ed50ffd802eeb71198bdab6768993aa2` puis `b081bb9e19987c0fb345782f995f375b93f8121c` sérialisent AUTHORIZE, ENABLE et DISABLE Giveaway dans la même file Player avec la subscription exacte `channel.chat.message`. Une désactivation réussie refuse une session native OPEN, confirme `INACTIVE`, puis seulement passe le credential OFF ; échec distant ou conflit conserve le retry. Le premier OAuth reste désactivé et récupérable si la création EventSub échoue. Le runtime Chat générique reste en pause R942 ; son activation simultanée exigerait une coordination explicite de la subscription partagée.

**Pilote réel du 30/09/2026 :** le checkpoint `af52294640ee30feb0e42981fe407361a1b230e7` était sur `main` et `review`, déployé sur Railway avec la migration 056. Après suspension temporaire de Giveaway/Wish dans Streamer.bot, OAuth réel et preuve serveur `channel.chat.message` ACTIVE, Kichnifou a ouvert depuis Twitch, testé `!giveaway stat/stats`, rejoint par `!wish` une fois puis reçu « déjà participant » au nouvel essai. Une tentative intermédiaire de `!wish` visible dans Twitch n'a pas produit de réponse ; le nouvel essai après un message normal a prouvé le refus de double inscription. Le standalone a fermé l'unique session native : un `GiveawayWin`, `DRAW` +1 600 Primogemmes, `CHAT` rang 1 +2 000 particules Cryo, statistiques Economy correspondantes, une notification agrégée sans claim et deux annonces distinctes `RESULT`/`RANKING` `SENT` visibles. Soldes Kichnifou : 552 256 → 553 856 Primogemmes et 87 450 → 89 450 particules Cryo. La Faveur du 30/09 était déjà consommée avant le pilote ; aucun gain Faveur supplémentaire n'est attribué à ce test. Aucun traitement Giveaway legacy concurrent n'a été constaté.

**Comptage accepté R953 :** le classement final indique 7 messages sous Kichnifou : 4 messages humains et 3 réponses automatiques Streamer.bot publiées sous le même Twitch User ID. EventSub ne fournit pas de preuve permettant de distinguer ces sorties tierces des messages humains du broadcaster ; les commandes et annonces sortantes GachaImpact sont restées exclues. Le propriétaire accepte ce comportement dans la coexistence actuelle, sans filtrage heuristique ni dette de correction bloquante. Une identité bot distincte ou une preuve d'outbound lors d'un futur cutover pourrait motiver une réévaluation.

**État final :** une session native `CLOSED`, aucune `OPEN` ; credential Giveaway conservée avec `enabled=false`. Le `DELETE` de shutdown a répondu 200 ; son contrat confirme l'absence de la subscription exacte avant de désactiver la credential. Le standalone affiche le bridge Inactif. Le propriétaire a réactivé Giveaway et Wish dans Streamer.bot, qui redevient autoritatif. Gift Suprême n'a pas été réactivé, la QA Faveur n'a pas été modifiée et aucun cutover Twitch global n'a eu lieu. Le domaine Giveaway / Wish n'est plus le domaine actif ; la reprise passe aux **Compléments Notifications transversaux** (étape 21 de la roadmap).

---

## Historique — checkpoint changement de conversation — 2026-09-30

Le checkpoint documentaire `d351d70` et son correctif PostgreSQL `2a8fce3` ont été approuvés en review indépendante ChatGPT et promus sur `main` par fast-forward strict avec ce statut final. Vérifier les HEAD distants au début de la prochaine conversation ; le dépôt est la mémoire externe officielle. Lire [AGENTS.md](../../AGENTS.md), le [guide ChatGPT](../../.chatgpt/CHATGPT_GUIDE.md), ce Master, la [roadmap](../roadmap/implementation-order-v1.md), le [workflow](../process/implementation-workflow.md), la [passation des conversations](../process/conversation-handoff.md), puis les documents propriétaires du domaine choisi. Le domaine Faveur / Gift / Twitch pilote est clôturé pour l'instant : Gift Suprême est validé publiquement mais son bridge GachaImpact est désactivé ; Streamer.bot demeure autoritatif jusqu'au cutover. Ne pas réactiver Gift ni Twitch avancé par défaut. La nouvelle conversation ChatGPT choisit le prochain domaine depuis roadmap/Pilotage ; la nouvelle conversation Codex démarre en BOOTSTRAP pour ce nouveau domaine.

## Historique — état du domaine Twitch/Faveur/Gift au 30/09/2026

- **Déploiement acquis :** `main = review = e705ebda4a0c9e47837c1ac95dca93658bc370c7` avant ce checkpoint ; Railway a déployé ce SHA exact avec `SUCCESS` et `/health` réussi. Pipeline `main` → image → pre-deploy `npx prisma migrate deploy` → application → health opérationnel ; 55 migrations appliquées, dernière `20260929151500_055_add_twitch_gift_supreme_credential`. Faits de déploiement transmis dans la mission ; Codex n'a pas réinterrogé Railway ni DEV dans ce checkpoint documentaire.
- **Faveur :** standalone et Lots 7/8 validés publiquement ; Lots 9/10, lien Twitch Profil, présentation Profil Faveur, correctifs Profil/Event, navigation Quotidiennes/Event, Jeu A incomplet prioritaire hors fenêtre et intent one-shot validés publiquement. QA Kichnifou 2026-09-29 → 2026-10-28 maintenue volontairement active, claim initial déjà consommé, wallet connu 545 851 Primogemmes : ne pas la nettoyer. Le daily claim par message Twitch normal est techniquement implémenté ; sa validation publique attend le transport Chat générique toujours en pause.
- **Gift Suprême :** core, bridge app-owned, shutdown et récupération Helix implémentés ; premier vrai Gift récupéré avec FULFILLED, +1600 Cryo, notification et annonce Twitch GachaImpact visibles. Après cette validation, le propriétaire a désactivé le nouveau bridge sans supprimer TwitchIdentity ni l'historique économique. Streamer.bot / legacy reste l'autorité opérationnelle jusqu'au cutover ; état ON/OFF actuel de l'ancienne Reward manuelle non vérifié indépendamment. Aucune bascule globale, XP/parser/commandes Twitch génériques ni outbound générique activés.

**Cutover Gift futur, mission distincte :** désactiver l'ancienne Reward manuelle et arrêter le chemin Gift Streamer.bot ; vérifier TwitchIdentity ; autoriser/activer Gift GachaImpact, retrouver/réactiver ou recréer proprement la Reward app-owned selon le contrat, puis confirmer EventSub exact `enabled`. Effectuer un smoke test Gift et vérifier crédit unique, FULFILLED, notification et annonce avant de considérer Gift natif autoritatif. Aucun de ces gestes n'est effectué dans ce checkpoint. Le prochain domaine de développement n'est pas choisi ici.

## Historique — reprise rapide Twitch/Faveur/Gift (septembre 2026)

**Gate Git historique de la promotion Lots 5–8 vérifié le 2026-09-29 :** `origin/main = 57f06504cc29172ef90b60fd41eba34f114287c2`, `origin/review = 54e649197d604fc03830ed8cd83651990f8da015`, review ahead 4 / behind 0, branche locale `review`, worktree propre. Les commits existants sont conservés. La Phase 2B-2 reste **VALIDÉE PUBLIQUEMENT pour le transport observation-only**, selon les vérifications indépendantes ChatGPT fournies par le propriétaire le 2026-09-28. Streamer.bot reste autoritatif, sans cutover.

**Checkpoint de promotion Lots 5–8 :** les quatre commits sont approuvés indépendamment par ChatGPT, y compris le vrai SHA Lot 8 54e649197d604fc03830ed8cd83651990f8da015 (29 fichiers, exactement un commit au-dessus du Lot 7). Ce checkpoint documentaire est publié sur review puis promu avec toute la chaîne par fast-forward strict vers main, sans merge/squash/rebase/cherry-pick/force-push ; code/test identique au SHA Lot 8. Aucun workflow/status GitHub externe attaché au candidat selon la mission. Le contrôle final Git doit donner main = review, divergence 0/0, worktree propre et branche locale review.

**Checkpoint public Lots 7/8 acquis, fourni par ChatGPT et le propriétaire dans la mission Lot 9 :** main = review = `7fdcb16ceba7478dbde14b5282709310862654f0`, divergence 0/0 après promotion. Railway a déployé ce SHA exact, statut SUCCESS, logs `Application ready`, healthcheck `/health` : `[1/1] Healthcheck succeeded!`. Le propriétaire a chargé l’alpha publique par Ctrl+F5 : frontend Lot 8 effectivement servi, grille Quotidiennes 3×3, Faveur première et lignes jaunes Boss/Expédition/Amitié visibles. Ces preuves sont transmises ; aucun contrôle Railway ou test public nouveau exécuté par Codex dans le Lot 9.

**Validation standalone contrôlée :** fenêtre QA temporaire de 30 jours, sans FavorGrant, Twitch/EventSub ou bonus Tier. Wallet avant 545 051 ; premier Ctrl+F5 : une modale +800 Primogemmes, wallet 545 851, carte `✅ Terminé`, `30 jours restants`, `Obtenu : +800 Primogemmes`. Second Ctrl+F5 : aucune seconde modale et aucun second +800. Vérification DB indépendante fournie : un seul FavorDailyClaim du jour, une seule BusinessOperation `favor.daily-claim` COMPLETED, somme des mouvements quotidiens Faveur +800, wallet 545 851. QA ensuite retirée : PlayerFavorState à bornes nulles, inactive ; claim NATIVE et +800 conservés comme preuve, aucune attribution Twitch fictive. Lots 7/8 standalone **VALIDÉS PUBLIQUEMENT**. Gift/Resub/EventSub Twitch restent seulement techniques, sans validation publique réelle ni activation Faveur.

**DEV indépendant fourni avant promotion par ChatGPT :** zéro TwitchIdentity, receipt Subscribe/Gift/Resub, FavorGrant, FavorDailyClaim NATIVE et BusinessOperation Faveur ; 54 migrations, dernière 054, zéro migration inachevée. Preuves transmises dans la mission, sans nouveau contrôle DB exécuté par Codex pendant cette promotion.

**État au checkpoint transport observation-only, avant Gift :** DEV conservait alors 54 migrations, dernière 054, 120 Characters, dix Players, deux MigrationRun pilotes `COMPLETED` et zéro MigrationBatch. Après unlink, `twitch_identities = 0` à ce checkpoint historique. Les receipts sont restés `RECEIVED`, non traités, sans effet gameplay ; aucun nouveau receipt après désactivation. Leur quantité résiduelle peut évoluer avec la [rétention observation-only 24 h R943–R945](../specifications/data-retention-v1.md). Faveur Kichnifou : le retrait de la première QA et le claim NATIVE de preuve ci-dessus sont historiques. Le propriétaire a volontairement réactivé ensuite la fenêtre 2026-09-29 → 2026-10-28 pour comparer les profils ; claim du 29/09 déjà consommé une fois, wallet 545 851 au checkpoint fourni, zéro FavorGrant Twitch. Cette QA doit rester active : aucune modification ou nettoyage par Codex.

Commit fonctionnel du complément : `cad087806e09f658713c79615f43e9d0b51067ed`, dont le parent direct est la Phase 2B-2 `1d94c094ea897f6c626374eadeea4eef43583533`. Le checkpoint documentaire `cea85b4da88b72334f3ab37b6bbcc165b94ea8eb` et le correctif de cadence `668e6bfa91913880e7839f0da272c07b5c6f0eb3` sont également promus techniquement sur `main`, avant le test public désormais acquis ci-dessous.

### Validation publique transport Twitch 2B-2 — 2026-09-28

Preuves indépendantes ChatGPT transmises dans la mission : variables EventSub configurées sur Railway production ; callback `https://gachaimpact-production.up.railway.app/api/v1/twitch/eventsub` ; redéploiement du SHA main exact `01d8cea6129394f80fa3e738ee0c8ffe3027be0b`, statut `SUCCESS`, logs `Application ready`. OAuth runtime pilote exécuté, challenge reçu et répondu 200, UI Compte « Activée ».

Trois messages Kichnifou ont créé trois receipts observation-only. Le message de Mynonyme a été reçu sous un Twitch User ID distinct, sans TwitchIdentity correspondante ni création de Player. La réponse Streamer.bot/Kichnifou a aussi été observée : la souscription écoute tous les chatters du canal. Tous les receipts sont restés `RECEIVED`, non traités, sans effet gameplay.

`DELETE /api/v1/me/twitch/runtime/subscription` a répondu 200, UI « Non activée » ; un message envoyé ensuite n’a créé aucun receipt. `DELETE /api/v1/me/twitch` a répondu 200, UI « Non connecté », zéro TwitchIdentity après unlink. Player Kichnifou toujours ACTIVE, progression et neuf soldes de ressources conservés. Aucun receipt nouveau après désactivation ; le dernier est antérieur à celle-ci.

**Infrastructure au checkpoint transport observation-only :** webhook Railway configuré/activé, souscription Chat pilote supprimée et identité Kichnifou alors déliée ; aucune réception Chat active à cette date. Streamer.bot restait autoritatif. Aucun XP, parser, réponse Twitch, mirroring ou outbound GachaImpact générique actif. Gate transport 17 acquis, Twitch avancé en pause R942 ; Gift Suprême et les correctifs Faveur/Event étaient ensuite le domaine actif. Preuves fournies par le propriétaire ; aucun nouveau test public exécuté par Codex à ce checkpoint. L'identité Kichnifou a été reliée depuis pour Gift et reste présente après sa désactivation.

### Faveur Lot 1 — core serveur promu et déployé techniquement

**Promotion et déploiement technique :** review indépendante ChatGPT du candidat `f0823276feb5717de4115bbd9ca5db08752a0cac` approuvée, puis checkpoint documentaire `6c3e88642f4df4ad4e3a357bac8451a46e97e1a8` promu par fast-forward strict. Vérifications indépendantes ChatGPT transmises par le propriétaire pour ce Lot 2 : `main == review == 6c3e886`, divergence 0/0 ; Railway a déployé ce SHA exact, statut `SUCCESS`, logs `Application ready`, GET `/health` → 200. DEV après déploiement : zéro FavorGrant, zéro FavorDailyClaim NATIVE, zéro opération `favor.grant` / `favor.daily-claim`, zéro TwitchIdentity et zéro migration Prisma inachevée. Ces preuves sont fournies dans la mission, sans nouveau contrôle infrastructure exécuté par Codex. Lot 1 **PROMU ET DÉPLOYÉ TECHNIQUEMENT**, sans surface utilisateur ni validation publique fonctionnelle Faveur requise ou revendiquée.

Le core Lot 1 expose une projection personnelle interne, une attribution bénéficiaire prouvée et un claim de la journée serveur. Calendrier inclusif Europe/Paris partagé avec la migration, cap 180, nouvelles journées à J+1 ou à la suite de l’intervalle actif/futur. Tiers 1/2/3 : 1 600/9 600/20 800 (table révisée au Lot 5) immédiates, plus compensation arrondie des jours bloqués ; un crédit/opération logique pour bonus + compensation. Claim actif : +800 une fois par Player/business date tous canaux confondus, sans paiement à la lecture ni rattrapage d’absence. Grants et claims durables, verrous Player, transactions SERIALIZABLE et retries bornés assurent atomicité/idempotence. Economy possède ledger et statistiques ; l’attribution reçue passivement ne déclenche pas le catch-up standalone Missions. [Architecture physique](../architecture/backend-architecture-v1.md#faveur-de-lastre--core-lot-1-promu-techniquement-sur-main).

**Contrôles exécutés :** ciblés calendrier/legacy/Paris/isolation **56/56**, backend complet **632/632 sur 81 fichiers**, DB privées Faveur/052/rétention/Missions **53/53 sur 4 fichiers** (dont 31 scénarios core Faveur). Builds frontend/backend, typechecks, lint, `verify:quick` **5/5**, validation/statut Prisma et diff-check passent. Les 54 dossiers et migrations appliquées sont alignés, checksums identiques ou équivalents LF/CRLF, dernière `20260927230000_054_add_direct_message_typing_state`, aucune 055, aucun registre incomplet. Le premier passage DB a échoué sur des fixtures sans marqueur Missions : corrigé puis relancé, pas un flaky ; le premier quick a signalé une ligne vide finale, corrigée puis contrôlée.

**DB / limites du Lot 1 :** fixtures créées uniquement dans les schémas privés, cleanup des suites exécuté ; la suite Faveur vérifie en plus dans pg_namespace la disparition de son schéma UUID exact. Lecture publique finale : une Faveur inactive à bornes nulles, zéro grant, claim ou opération Faveur, zéro TwitchIdentity. Aucune fixture ni écriture métier publique. Un autre schéma `batch_test_*` intégralement vide, d’origine non établie, est conservé : aucun nettoyage arbitraire d’un schéma non suivi par ce lot. Warnings : taille du bundle Vite, dépréciation pg lors des suites de concurrence. La preuve de déploiement technique fournie ensuite est enregistrée ci-dessus ; elle ne vaut pas test public fonctionnel Faveur.

**Périmètre conservé :** schéma 050/052 réutilisé sans migration ; aucune Subscription EventSub, scope OAuth supplémentaire, identité reconnectée, gifter/gift multiple/resub, création de Player, UI, Profil, Quotidiennes, animation, notification, dispatcher `!faveur`, route publique/admin artificielle, XP/parser/outbound/mirroring. Ancienne orientation Faveur contradictoire explicitement historique dans decisions-log, R657–R672 intactes, aucune nouvelle Rxxx. Roadmap corrigée au minimum ; modèle V1, schéma PostgreSQL, audit clôturé et command-reference inchangés, car leur cible reste valable.

### Faveur Lot 2 — bénéficiaire channel.subscribe, promu et déployé techniquement

**Promotion et déploiement technique :** review indépendante ChatGPT du candidat exact `3abebcddd3b8516040d22f0908f72971cd924965` acquise, puis checkpoint documentaire `f652a8d1275023badbed274e3f56da7d075b8105` promu par fast-forward strict. Preuves post-promotion ChatGPT transmises par le propriétaire pour le Lot 3 : `main == review == f652a8d`, divergence 0/0 ; Railway a déployé ce SHA exact, `SUCCESS`, logs `Application ready`, healthcheck Path `/health`, `[1/1] Healthcheck succeeded!`. DEV : zéro FavorGrant, zéro claim NATIVE, zéro opération Faveur, zéro TwitchIdentity, zéro TwitchEventReceipt `channel.subscribe`, 54 migrations appliquées, dernière 054 et zéro migration inachevée. Lots 1 et 2 **PROMUS ET DÉPLOYÉS TECHNIQUEMENT** ; aucun transport Subscription réel actif. Ces preuves sont fournies dans la mission, sans contrôle infrastructure ni test public Subscription exécuté par Codex.

Le webhook signé existant accepte aussi `channel.subscribe` v1 après validation stricte du payload et cohérence broadcaster condition/événement, sans modifier HMAC, fraîcheur, raw body, challenge ni le chemin Chat v1. L'Observer persiste le Message ID, l'identité Twitch du bénéficiaire, les noms utiles, timestamp et hash du transport, ainsi qu'une preuve minimale `{ broadcasterTwitchId, tier, isGift }`. `TwitchFavorSubscriptionConsumer` relit le reçu durable et résout exclusivement TwitchIdentity → Player ACTIVE avec élément valide, puis appelle le même `FavorService.grant` : tiers 1000/2000/3000 → 1/2/3, clé issue du Message ID et receipt obligatoire. Un bénéficiaire gift reçoit sa Faveur normale ; aucun bonus gifter.

Le consumer possède une transaction SERIALIZABLE partagée avec `grant`, verrouille le reçu et finalise atomiquement `PROCESSED`, `processedAt` et `favor:grant:<grantId>`. Identité non résolue, Player absent/inactif ou élément absent : `PROCESSED` avec référence technique `favor:ignored:<raison>`, sans création, paiement, entitlement différé ni message d'erreur normal. Replay terminal reste no-op même après compte/liaison/activation ultérieurs. Un grant déjà committé et lié est reconnu avant toute nouvelle résolution : finalisation sans recrédit, même après unlink. Une panne infrastructure laisse le reçu `RECEIVED` rejouable et peut retourner 500 ; les ignorés durables sont ACK 204. [Architecture du chemin Lot 2](../architecture/backend-architecture-v1.md#faveur-lot-2--consumer-bénéficiaire-channelsubscribe-promu-techniquement-sur-main).

**Contrôles Lot 2 exécutés :** unitaires ciblés **81/81**, backend complet **654/654 sur 83 fichiers** ; PostgreSQL privé final **62/62 sur 5 fichiers** : consumer **16**, core Lot 1 **31**, webhook Chat **9**, Observer **4**, rétention **2**. HMAC/challenge, schéma/broadcaster, tiers, bénéficiaire direct/gift sans bonus gifter, ignorés et activation ultérieure, concurrence, enveloppe contradictoire, grant committé + panne de finalisation + retry sans recrédit, rollback de grant si finalisation échoue et panne avant effet sont couverts. Player absent est testé unitairement : la FK empêche normalement cet état en DB. Les premiers passages ont identifié l'exigence excessive de preuve dans l'Observer générique et une fixture sans statistiques Economy ; corrections puis relances réussies, aucune panne masquée. Builds/typechecks frontend/backend, lint, `verify:quick` **5/5**, Prisma validate/status et diff-check passent. Lint : cinq avertissements préexistants hors diff ; bundle Vite >500 kB ; avis de mise à jour Prisma sans upgrade.

**DB / migration Lot 2 :** écritures de fixtures uniquement en schémas privés UUID, CHECK/index/RLS répliqués, cleanup exécuté ; suites core/consumer vérifient dans pg_namespace la disparition de leur schéma exact. Lecture publique seule après tests : zéro FavorGrant, claim NATIVE, opération Faveur et TwitchIdentity. Les 54 dossiers et entrées Prisma sont alignés, dernière `20260927230000_054_add_direct_message_typing_state`, zéro registre incomplet, checksums identiques ou équivalents LF/CRLF ; aucune 055 ni écriture métier publique. Le schéma vide antérieur d'origine non établie reste préservé.

**État et périmètre du Lot 2 :** consumer promu et déployé techniquement sur `main`. Aucun test public Faveur Subscription acquis ou requis à ce stade, puisque le lifecycle réel n’est pas activé. Subscription EventSub réelle **NON ACTIVÉE**, aucun lifecycle Subscribe ni scope `channel:read:subscriptions` ajouté dans le Lot 2 ; zéro TwitchIdentity au dernier état DEV communiqué. Schéma existant, aucune migration 055. Rétention évaluée et inchangée : R945 reste strictement Chat observation-only ; tous les receipts Subscription, y compris ignorés/rejouables, sont exclus, sans nouveau TTL. Aucune nouvelle Rxxx ni modification de l'audit clôturé, modèle V1, schéma PostgreSQL, command-reference, roadmap ou UI. Aucun cutover, resub, gift global/gifter, création Twitch-only, claim par message, `!faveur`, notification, XP/parser/réponse/mirroring/outbound.

### Faveur Lot 3 — lifecycle/OAuth pilote, promu et déployé techniquement

**Promotion et déploiement technique :** review indépendante ChatGPT du candidat `06a32b2f80e4e183e3e479f898818f88653a14c6` acquise, puis checkpoint `dc60027079449f4a152b733e92e9ad51673ce2bf` promu par fast-forward strict. Preuves post-promotion indépendantes ChatGPT transmises par le propriétaire : main == review == ce SHA exact, divergence 0/0 ; Railway SUCCESS, logs `Application ready`, healthcheck Path `/health`, `[1/1] Healthcheck succeeded!`. DEV : zéro TwitchIdentity, receipt `channel.subscribe`, FavorGrant, FavorDailyClaim NATIVE et opération Faveur ; 54 migrations, dernière 054, zéro migration inachevée. Lot 3 **PROMU ET DÉPLOYÉ TECHNIQUEMENT**, toujours inactif publiquement. Ces preuves sont fournies dans la mission, sans nouveau contrôle infrastructure ni activation réelle par Codex.

Le purpose distinct `AUTHORIZE_FAVOR_SUBSCRIPTIONS` utilise `favor_` + 256 bits, hash complet du state et nonce OIDC séparé, expiration dix minutes et consommation one-shot dans la table existante. POST authentifié `/api/v1/me/twitch/favor/start` accepte uniquement un corps vide JSON (ou absent) sans query, pour un Player allowlist déjà Twitch-lié et serveur OAuth/EventSub prêt ; il retourne seulement l’URL. Scopes exacts : `openid channel:read:subscriptions`. LINK reste `openid`, Chat reste `openid user:read:chat user:bot channel:bot`. Callback commun : RS256/issuer/audience/nonce/subject, `/validate` Client ID/User ID/login/scopes, `/helix/users`, identité liée actuelle et allowlist, puis ensure Faveur uniquement. Aucun token ni consentement/active/pending local persisté. Outcomes distincts `favor-runtime-activated` / `favor-runtime-error` ; le service retourne le booléen pending, sans raccord frontend.

Le client réutilise App Access Token mémoire et protège GET paginé, POST exact `channel.subscribe` v1 avec seule condition broadcaster, DELETE par ID, timeout et refresh unique sur 401. Le manager expose inspect/ensure/disable Faveur et conserve les contrats Chat. Une seule file Player sérialise les deux types et unlink ; coalescence séparée par type/preuve validée. L’unlink garantit Chat absente, puis Faveur absente, puis supprime TwitchIdentity ; panne/conflit conserve l’identité, un arrêt partiel peut être terminé par retry. Au Lot 3, inspection Faveur au manager uniquement : DTO status, route disable dédiée et UI étaient reportés. Le Lot 4 ci-dessous ajoute cette projection et ces entrées sans changer le lifecycle. [Architecture lifecycle Lot 3](../architecture/backend-architecture-v1.md#faveur-lot-3--lifecycleoauth-pilote-promu-techniquement-sur-main).

**Contrôles Lot 3 exécutés :** backend complet **717/717 sur 84 fichiers**, dont contrats OAuth/client/manager/routes et régressions core/consumer/webhook ; PostgreSQL privé **64/64 sur 5 fichiers** : nouveau lifecycle **5**, state/unlink Chat **3**, consumer Lot 2 **16**, webhook **9**, core Lot 1 **31**. Purposes/scopes non interchangeables, refus OIDC/identité, one-shot concurrent/expiration, enabled/pending, pagination, réponse invalide, refresh 401 borné, signal timeout dix secondes, conflits/409/404, file commune et unlink partiel/retry sont couverts. Builds/typechecks frontend/backend, lint, `verify:quick` **5/5**, Prisma validate/status et diff-check passent. Premier passage ciblé : fixture de payload texte envoyée avec mauvais Content-Type, corrigée en JSON puis suite verte ; aucune panne masquée. Cinq warnings lint préexistants hors diff et taille du bundle Vite >500 kB restent sans changement.

**DB / migrations Lot 3 :** fixtures uniquement en schémas privés UUID avec CHECK/index/RLS répliqués, cleanup exécuté ; la nouvelle suite vérifie la disparition de son schéma exact dans pg_namespace. Lecture publique seule après les tests : zéro FavorGrant, claim NATIVE, opération Faveur, TwitchIdentity et receipt `channel.subscribe`. 54 dossiers/entrées Prisma alignés, dernière `20260927230000_054_add_direct_message_typing_state`, zéro migration inachevée, checksums identiques ou équivalents LF/CRLF. Aucune 055 ni écriture métier publique ; seul le schéma privé résiduel antérieur, d'origine non établie, reste conservé.

**État et périmètre Lot 3 :** promu et déployé techniquement sur `main`, sans activation OAuth/EventSub Subscription réelle ni test public Subscription acquis. Aucune reconnexion, consentement OAuth réel, EventSub réel, variable Railway modifiée, faux receipt public ni Faveur publique. Webhook production configuré, zéro TwitchIdentity/receipt Subscription au checkpoint communiqué ; transport Subscription toujours inactif. Core Lots 1/2, consumer et webhook inchangés. Aucune UI, gifter/gift global/quantité/resub, claim par message, `!faveur`, notification, XP/parser/réponse/mirroring/outbound ou cutover. Aucun nouveau schéma ni migration 055, aucune nouvelle Rxxx ; autres propriétaires inchangés.

### Faveur Lot 4 — Configuration Compte et projection, promu et déployé techniquement

**Promotion et déploiement technique Lot 4 :** review indépendante ChatGPT du candidat exact 2bdfac7b17f14a0d022ceb18a4c92732b39401e8 acquise, puis checkpoint documentaire 57f06504cc29172ef90b60fd41eba34f114287c2 promu par fast-forward strict. Le propriétaire indique dans la mission Lot 5 que le Lot 4 est déployé techniquement ; cette confirmation ne vaut ni contrôle Railway/health nouveau par Codex ni test public Subscription. Contrôle DEV indépendant fourni avant promotion : zéro TwitchIdentity, receipt Subscribe, FavorGrant, claim NATIVE ou BusinessOperation Faveur, 54 migrations, zéro migration inachevée. Aucun OAuth/consentement/EventSub réel ni activation publique acquis.

GET Twitch status ajoute favorSubscriptionAvailable/Active/Pending/Error, séparés des champs Chat inchangés. Seuls pilote lié et OAuth/EventSub activés/configurés inspectent ; les deux lectures partagent le même signal et une échéance totale de trois secondes, malgré la file Player commune. Chaque erreur reste propre au type (CONFLICT/UNAVAILABLE) et conserve la liaison. Aucun flag DB ni token ; vérité ACTIVE uniquement depuis EventSub enabled.

Client API : startTwitchFavor et disableTwitchFavor, POST start existant et nouveau DELETE authentifié /api/v1/me/twitch/favor/subscription, corps vide strict/query vide sans ID configurable, réservé au pilote. Disable Faveur ne touche pas Chat ; disable Chat ne touche pas Faveur ; unlink coupe toujours les deux avant l’identité. Configuration > Compte ajoute Faveur de l’Astre entre Chat et Délier Twitch, avec styles/boutons partagés, descriptions produit, actif/inactif/vérification. Bloc caché non lié/non disponible ; erreurs dans la zone existante. URL OAuth authorize vérifiée avant navigation ; retours favor-runtime-activated/error traités séparément de la liaison et nettoyés de l’URL. Confirmation commune : au plus quatre lectures supplémentaires espacées d’une seconde, échéance globale huit secondes, annulation/nettoyage au démontage ; aucune activation affichée avant preuve enabled. Snapshot/import conservés.

**Contrôles Lot 4 :** frontend Compte/API **76/76**, backend complet **728/728 sur 84 fichiers**, ciblé OAuth/routes/manager/lifecycle/consumer **160/160**, PostgreSQL privé **64/64 sur 5 fichiers** (lifecycle 5, state/unlink 3, consumer 16, webhook 9, core 31). Statuts indépendants, conflits/pannes/échéance commune, route disable stricte, redirection sûre, callbacks, doubles clics, pending borné/annulation et unlink/snapshot sont couverts. Builds/typechecks, lint, verify:quick 5/5, Prisma validate/status et diff-check passent. Premier build : typage du nouveau mock fetch corrigé, puis build vert. Cinq warnings lint préexistants (dont celui de Compte) et bundle Vite >500 kB inchangés.

**Visuel / DB :** Edge local, vrai GameShell et CSS de production à 1920×1080 et 390×844, quatre combinaisons Chat/Faveur ; aucun overflow horizontal, boutons stables pendant l’action, unlink accessible au scroll, zéro exception de page. Harness/données synthétiques et captures hors commit, aucun OAuth réel. Fixtures DB uniquement privées, cleanup vérifié ; lecture publique finale seule : zéro identité, receipt Subscription, grant, claim NATIVE et opération Faveur. 54 dossiers/entrées Prisma alignés, dernière 054, zéro registre inachevé, checksums identiques ou équivalents LF/CRLF ; seul le schéma privé résiduel antérieur est conservé.

**État et périmètre Lot 4 :** promu et déployé techniquement selon la confirmation propriétaire de la mission Lot 5 ; aucun test public Subscription acquis. Aucun OAuth/consentement/EventSub réel, reconnexion, variable Railway, receipt ou Faveur publique. Core/consumer/webhook et lifecycle Lot 3 inchangés ; aucune migration 055 ni nouvelle Rxxx. Gift/gifter/resub, Profil/Quotidiennes, claim/message, !faveur, notifications, XP/parser/outbound/mirroring et cutover restent hors scope.

**Cible future R939–R942 :** Twitch et Chat standalone peuvent rester deux flux distincts, sans mirroring obligatoire. Tous les messages Twitch restent nécessaires en mémoire pour XP/classification/parser ; règles XP et cooldown global entre canaux, parser, services et économie seront partagés, avec traitement léger des messages ordinaires. La passe finale évaluera l'absence d'historique persistant ordinaire lorsqu'inutile. La [dette de parité des réponses](../commands/command-reference.md#passe-finale-twitch--commandes-r939r942) référence les `.txt` réellement versionnés : comparer/corriger, tester d'abord dans le Chat standalone avec Kichnifou, puis validation propriétaire avant éventuel outbound. Rien de ce pipeline avancé n'est actif ici.

### Faveur Lot 5 — Gift, nouvelles récompenses et lifecycle groupe, promu techniquement sur main

**État Git initial du Lot 5 :** départ main = review = 57f06504cc29172ef90b60fd41eba34f114287c2, clean 0/0. Ce lot est publié uniquement sur review, commit dédié ; main reste ce checkpoint Lot 4. Divergence attendue après publication : review ahead 1 / behind 0. Review indépendante ChatGPT du SHA 005a0333cbf589f4f2606dfacad843780a037e70 acquise, transmise par le propriétaire dans la mission Lot 6. Lot 5 désormais promu techniquement dans le checkpoint Lots 5–8 ci-dessus ; aucun test public Gift acquis.

**Produit R666–R668 révisé par le propriétaire :** table centrale bénéficiaire ET bonus gifter par gift : T1 1 600 / T2 9 600 / T3 20 800. Bénéficiaire conserve +30 jours, cap 180, +800 quotidien, J+1 et overflow round(1600 × jours bloqués / 30), tous tiers. Gifter éligible non anonyme : total Twitch × récompense du tier, sans jours ; anonyme/non éligible = zéro terminal. Aucun comptage/attente/corrélation des bénéficiaires : 10 gifts Tier 2 = 96 000 même avec sept, dix ou zéro bénéficiaire éligible. Subscribe is_gift=true ne paie jamais le gifter.

**Implémentation :** webhook Gift v1 signé/strict, preuve minimale sans cumulative_total, Observer ID nullable limité aux gifts anonymes. TwitchFavorGiftConsumer + FavorService.creditGifterBonus : BusinessOperation dédiée, économie/stats/receipt atomiques, replay durable reconnu avant nouvelle éligibilité, verrous receipt/Player et retry SERIALIZABLE borné. Aucun FavorGrant ni catch-up Missions pour le gifter. [Architecture du Lot 5](../architecture/backend-architecture-v1.md#faveur-lot-5--gift-global-et-groupe-eventsub-promu-techniquement-sur-main).

**Lifecycle/UI :** groupe Subscribe + Gift dans la même file Player ; ACTIVE seulement si les deux enabled, pending si l'un en vérification, groupe partiel jamais actif et ensure ne crée que le manquant. CONFLICT/UNAVAILABLE d'un membre propagé. Le bloc Compte garde son visuel, flags indépendants Chat/Faveur et deadline status totale trois secondes/polling borné. Disable Faveur retire ses deux membres ; Chat reste indépendant. Unlink Chat → Subscribe → Gift → identité, conservation de la liaison sur panne/conflit et reprise possible.

**Contrôles Lot 5 exécutés :** backend complet **769/769 sur 85 fichiers**, frontend Compte/API **76/76 sur 2 fichiers**, PostgreSQL privé **116 scénarios réussis sur 6 fichiers** : Gift 50, OAuth/groupe 7, state/unlink 3, bénéficiaire 16, webhook Chat 9, core 31. Les cinq premières suites ont passé ; deux attentes overflow du core utilisaient encore les anciens montants, corrigées puis suite core relancée **31/31**. Un mock de collision Prisma initial utilisait un objet brut non reconnu : remplacé par une vraie erreur Prisma, puis backend complet relancé avec succès. HMAC strict, anonymat/inéligibilité terminale, BigInt, économie/stats, absence de jours/catch-up Missions, total indépendant des bénéficiaires, replay/concurrence, recovery et rollback après crédit/finalisation sont vérifiés. Groupe active/pending/partiel, 409/404, créations manquantes, disable/unlink/retry et OAuth pending mixte sont couverts. Builds frontend/backend, typechecks, lint, verify:quick **5/5**, Prisma validate/status et diff-check passent. Cinq warnings lint préexistants hors diff et bundle Vite >500 kB ; aucun visuel/frontend modifié, aucune nouvelle recette visuelle requise ou revendiquée.

**DB/schéma/périmètre :** tables et index existants réutilisés ; index unique global BusinessOperation vérifié en lecture seule, aucune migration 055. 54 dossiers et migrations appliquées, dernière 054, zéro registre incomplet et checksums identiques ou équivalents LF/CRLF. Cleanup privé exécuté, disparition des schémas UUID contrôlée ; seul le schéma résiduel antérieur non suivi reste conservé. Lecture publique finale seule : zéro TwitchIdentity, receipt Subscribe/Gift, FavorGrant, claim Faveur NATIVE et opération Faveur. Tests mutatifs uniquement schémas privés et mocks, aucune donnée métier publique, liaison réelle, OAuth/EventSub réel, changement Railway ou cutover. Resub/message/end/notification, claim par chat, !faveur, Profil/Quotidiennes, notifications, XP/parser/outbound/mirroring restent exclus. Audit Faveur, décisions existantes R666–R668, références commandes/guide, architecture et workflow réconciliés ; aucune nouvelle Rxxx.

### Faveur Lot 6 — Resub fiable, promu techniquement sur main

**État Git initial du Lot 6 :** Lot 5 005a0333cbf589f4f2606dfacad843780a037e70 approuvé indépendamment par ChatGPT. Lot 6 part directement de ce HEAD review ; main reste 57f06504cc29172ef90b60fd41eba34f114287c2. Le commit Lot 6 3483bb86156aa2d5059681310c0b509aab28ccba est publié uniquement sur review, divergence ahead 2 / behind 0 à ce checkpoint. Review indépendante ChatGPT acquise selon la mission Lot 7. Lot 6 désormais promu techniquement dans le checkpoint Lots 5–8 ; aucun test public Resub acquis.

**Produit R669 précisé :** seul channel.subscription.message v1 prouve les resubs dont Twitch émet le message partagé. Aucun renouvellement silencieux, date théorique ou attribution inventée en l'absence de preuve. Bénéficiaire ACTIVE/élément valide déjà lié : table T1 1 600 / T2 9 600 / T3 20 800 +30 jours ; cap 180, daily 800, J+1 et overflow base 1600/30 conservés. Aucun multiplicateur cumulative/streak/duration, bonus gifter ou corrélation Subscribe/Resub.

**Implémentation :** webhook signé Resub strict, preuve typée minimale broadcaster/tier et User ID obligatoire. Aucun texte, emote ou compteur mensuel persisté. TwitchFavorResubConsumer partage la transaction bénéficiaire avec Subscribe : grant, calendrier, Economy, opération et receipt atomiques ; recovery du grant durable avant nouvelle éligibilité, ignorés terminaux, infrastructure RECEIVED rejouable, verrous/retries SERIALIZABLE. [Architecture du Lot 6](../architecture/backend-architecture-v1.md#faveur-lot-6--resub-fiable-et-groupe-à-trois-subscriptions-promu-techniquement-sur-main).

**Lifecycle/UI :** Faveur = Subscribe + Gift + Message ; active seulement si trois enabled, pending si une exacte en vérification, état partiel jamais actif. Ensure complète uniquement les membres absents ; panne du troisième conserve les deux premiers pour retry. Disable arrête les trois, Chat indépendant. Unlink Chat → Subscribe → Gift → Message → identité ; identité conservée sur panne/conflit. Bloc Compte/DTO/polling inchangés, deadline totale status trois secondes conservée ; aucune nouvelle recette visuelle revendiquée.

**Contrôles Lot 6 exécutés :** backend complet **814/814 sur 86 fichiers**, frontend Compte/API **76/76 sur 2 fichiers**, ciblés client/manager/lifecycle/webhook/consumers **247/247 sur 6 fichiers**. PostgreSQL privé **161/161 sur 7 fichiers** : Resub 44, bénéficiaire 16, Gift 50, OAuth/groupe 8, state/unlink 3, webhook Chat 9, core 31. Tiers, overflow, compteurs sans multiplicateur, confidentialité, ignorés terminaux, replay/concurrence, rollback et récupération d'un grant durable sont vérifiés ; aucun bonus gifter depuis Resub. Groupe vide/tous états partiels, pending de chaque membre, créations manquantes, panne du troisième/retry, disable/unlink et OAuth sont couverts. Le premier passage Resub privé a signalé trois assertions sérialisant des BigInt sans conversion : assertions corrigées, puis sept suites privées intégralement relancées avec succès. Builds frontend/backend, typechecks, lint, verify:quick **5/5**, Prisma validate/status et diff-check passent. Cinq warnings lint préexistants hors diff et bundle Vite >500 kB ; aucun fichier frontend/UI modifié, aucune nouvelle recette visuelle revendiquée.

**DB finale en lecture seule :** zéro TwitchIdentity, receipt Subscribe/Gift/Resub, FavorGrant, claim Faveur NATIVE et opération Faveur publique. 54 dossiers et entrées Prisma alignés, dernière 20260927230000_054_add_direct_message_typing_state, zéro registre incomplet, checksums identiques ou équivalents LF/CRLF, aucune 055. Cleanup privé exécuté et absence des schémas créés contrôlée ; seul le schéma résiduel antérieur non suivi est conservé, sans nettoyage arbitraire.

**Périmètre :** aucune activation réelle, liaison/OAuth/EventSub réel, donnée métier publique, modification Railway, cutover ou promotion. Schéma réutilisé, aucune 055, 54 migrations dernière 054. Audit/decisions-log R669, architecture et Master actualisés ; aucune nouvelle Rxxx, workflow Lot 5 inchangé. End/chat.notification, claim/message, !faveur, Profil/Quotidiennes, notifications, XP/parser/outbound/mirroring restent exclus.

### Faveur Lot 7 — API personnelle et présence standalone, promu sur main et validé publiquement

**État Git initial du Lot 7 :** Lots 5 Gift/gifter et 6 Resub approuvés indépendamment par ChatGPT. Départ review 3483bb86156aa2d5059681310c0b509aab28ccba, main 57f06504cc29172ef90b60fd41eba34f114287c2, ahead 2 / behind 0, worktree propre. Commit Lot 7 8a875fb4a967fb67fddcfd17cb78a3a70c2fc887 publié sur review uniquement, ahead 3 / behind 0 à ce checkpoint. Review indépendante ChatGPT acquise selon la mission Lot 8. Lot 7 promu dans le checkpoint Lots 5–8 et standalone validé publiquement selon les preuves ci-dessus.

**Backend/API :** CurrentPlayerFavorService compose GetCurrentPlayer et FavorService, sans provisionnement ni Player/date/canal/clé fournis par le navigateur. GET /api/v1/me/favor est strictement read-only ; projection personnelle compacte businessDate/active/daysRemaining/maxDays/dailyPrimogems/claimedToday/claimStatus, sans détails Twitch ni operationId. POST /api/v1/me/favor/presence accepte seulement corps absent ou objet vide et query vide, appelle claimToday(playerId, UI), puis relit la projection. Les deux routes sont authentifiées et Cache-Control: no-store.

**Contrat de présence :** CLAIMED signifie que CET appel a payé +800, et permettra seul une animation future ; ALREADY_CLAIMED ou INACTIVE donnent crédit "0" et aucune animation de gain. La journée du résultat appartient au claim serveur ; favor est une projection relue ensuite. Unicité durable Player/businessDate commune UI/INTERNAL_CHAT/TWITCH, calendrier Europe/Paris, J+1, cap, économie/statistiques/Missions et perte des journées absentes restent intégralement ceux du core existant. Aucun bouton Réclamer ni raccord automatique frontend dans ce lot ; la cible produit reste automatique à une présence standalone pertinente.

**Contrôles Lot 7 exécutés :** unitaires/routes **23/23**, backend complet **837/837 sur 87 fichiers**. PostgreSQL privé **158/158 sur 5 fichiers exécutés séparément** : présence personnelle 17, core Faveur 31, Subscribe 16, Gift 50, Resub 44. Auth obligatoire, projection exacte/read-only, corps/query stricts, absence de provisionnement et de paramètres Player/date/canal/clé, paiement unique +800, replay, UI/Twitch dans les deux ordres et en concurrence, LEGACY, J+1, minuit Europe/Paris, journées absentes, expiration, comptes séparés et Players inactifs sont vérifiés. Premier passage privé : fixture avec nom de relation Prisma incorrect, corrigée puis suite présence relancée **17/17** ; aucun échec attribué à un flaky. Builds frontend/backend, typechecks, lint, verify:quick **5/5**, Prisma validate/status et diff-check passent. Cinq warnings lint préexistants hors diff et bundle Vite >500 kB ; tests/visuel frontend non requis ni revendiqués, aucun fichier frontend modifié.

**DB finale en lecture seule :** zéro identité Twitch, receipt Subscribe/Gift/Resub, FavorGrant, claim Faveur NATIVE et opération Faveur publique. 54 dossiers/entrées Prisma alignés, dernière 20260927230000_054_add_direct_message_typing_state, zéro registre incomplet, checksums identiques ou équivalents LF/CRLF, aucune 055. Fixtures uniquement privées, cleanup exécuté ; absence des schémas créés contrôlée, seul le schéma résiduel antérieur non suivi reste conservé sans nettoyage arbitraire.

**Périmètre/documentation :** backend/API uniquement, zéro frontend/CSS/animation. Core Faveur, Economy, Missions, calendrier, webhook Subscribe/Gift/Resub et lifecycle OAuth/EventSub inchangés. Master et architecture actualisés ; audit/decisions-log R658/R672 conservés, aucune nouvelle Rxxx, workflow Lot 5 inchangé. Schéma réutilisé : 54 migrations dernière 054, aucune 055. Tests mutatifs uniquement en schémas privés, aucun OAuth/EventSub réel, liaison Twitch, donnée métier publique, changement Railway ou cutover.

### Faveur Lot 8 — présence frontend, modale et restitutions Quotidiennes, promu sur main et validé publiquement

**État Git initial du Lot 8 :** Lots 5/6/7 approuvés indépendamment par ChatGPT. Départ review 8a875fb4a967fb67fddcfd17cb78a3a70c2fc887, main 57f06504cc29172ef90b60fd41eba34f114287c2, ahead 3 / behind 0, worktree propre. Un commit Lot 8 dédié sur review uniquement ; divergence attendue ahead 4 / behind 0. Cette implémentation était limitée à review. Review indépendante ChatGPT du SHA 54e649197d604fc03830ed8cd83651990f8da015 désormais acquise ; Lot 8 promu techniquement avec les Lots 5–7 dans ce checkpoint documentaire, sans modification code/test.

**Présence et modale :** client GET Favor et POST presence sans Player/date/canal navigateur. Le GameShell authentifié envoie la présence au démarrage visible et après un vrai retour depuis un onglet masqué, avec garde in-flight et déduplication visibility/pageshow, sans polling/timer Faveur ni claim à la navigation interne. Projection immédiatement conservée. Seulement CLAIMED + crédit "800" déclenche refresh Ressources serveur et une modale globale ; ALREADY_CLAIMED/INACTIVE/erreur n’inventent aucun gain. File derrière Gacha/Level-up puis Défi, sans superposition à la conversion ni aux feedbacks Event globaux. Modale accessible de la famille existante, focus, verrou 1 s puis Escape/backdrop et durée 5,4 s ; largeur adaptée à l’espace mobile, animations existantes sans déplacement.

**Quotidiennes :** neuf cartes dans l’ordre Faveur/Récompense quotidienne/Roue ; Défi/Combat/Boss ; Expédition/Amitié/Événement. Dimensions/styles préservés, Faveur toujours première et passive : inactive sans bouton/lien/faux Terminé, active avec jours restants, obtenue seulement si claimedToday confirmé. Lignes jaunes persistantes serveur : Expédition reward exact depuis opération native et lastCompletedAt du jour ; Amitié somme des crédits sender prouvés par les cœurs natifs du jour, même si partiels ; Boss hit natif exact du jour avec Dégâts : X PV retirés, sans Obtenu. Aucun gain legacy inventé, aucun total mensuel/bestHit/preview, aucune nouvelle économie. Actualisations existantes après actions et relecture F5 ; projection Amitié chargée directement dans Quotidiennes.

**Contrôles Lot 8 exécutés :** frontend complet **950/950 sur 102 fichiers**, puis ciblés frontend finaux **92/92 sur 6 fichiers** après ajustement de la garde de session ; backend complet **837/837 sur 87 fichiers**. PostgreSQL privé **210/210 sur 9 fichiers exécutés séparément** : Expédition 15, Amitié 19, Boss 10, présence Faveur 17, core 31, Subscribe 16, Gift 50, Resub 44, lifecycle 8. Paiement unique, projection et rafraîchissement, ALREADY/INACTIVE/erreur, coalescence, visibilité/pageshow, StrictMode/navigation/session, contenu/focus/verrou/Escape/backdrop/auto, coordination/file et neuf cartes sont couverts. Les nouvelles projections sont contrôlées par les preuves natives, replay, autre jour, legacy et lectures sans effet ajouté. Premiers passages : fixture Expédition corrigée au minuit Paris d’hiver, fixtures Boss déplacées d’un mois déjà vaincu et intégrées au nettoyage, assertion de conversion corrigée pour son bouton existant, assertion de chargement Amitié actualisée et import de test inutilisé retiré ; aucun échec attribué à un flaky. Builds frontend/backend, typechecks, lint, verify:quick **5/5**, Prisma validate et diff-check passent ; cinq warnings lint préexistants hors diff et bundle Vite >500 kB.

**Contrôle visuel local :** vrai GameShell et CSS de production sous Edge, API simulée sans donnée publique, à **2560×1440, 1920×1080, 1366×768 et 390×844**. Neuf cartes de 136 px, ordre exact, trois colonnes desktop/une mobile, lignes jaunes, modale centrée et lisible, aucun overflow horizontal. À 1366×768, body Quotidiennes 317/432 px avec scroll interne ; sur mobile, document en flux naturel 844/2730 px, dernier contenu accessible. CLAIMED simulé donne une modale ; rechargement ALREADY ne la rejoue pas, INACTIVE reste passif. Harness/captures temporaires exclus du commit. Ce contrôle technique local ne vaut pas validation publique du propriétaire.

**DB finale en lecture seule :** zéro TwitchIdentity, receipt Subscribe/Gift/Resub, FavorGrant, claim Faveur NATIVE et opération Faveur publique. 54 dossiers/entrées Prisma, dernière 20260927230000_054_add_direct_message_typing_state, zéro registre incomplet, checksums alignés ; aucune 055. Tests mutatifs privés uniquement, fixtures créées nettoyées et absence vérifiée ; résidu Boss du passage au nettoyage incomplet supprimé après vérification précise de son appartenance à ce run. Le résidu antérieur non suivi reste conservé.

**Périmètre/docs :** aucune mutation métier publique, Faveur QA, activation Twitch réelle, liaison/OAuth/EventSub, vrai sub/gift, changement Railway ou cutover. Core Faveur, Economy, Missions, calendrier et contrats Lots 5/6/7 inchangés. Master/architecture et précisions propriétaire R671/R672 de l’audit/decisions-log actualisés ; aucune nouvelle Rxxx, workflow inchangé.

### Faveur Lot 9 — Profil, confidentialité dédiée et commande, promu et validé fonctionnellement publiquement

**Gate initial d’implémentation vérifié par Codex :** branche review, worktree propre, origin/main = origin/review = `7fdcb16ceba7478dbde14b5282709310862654f0`, divergence 0/0. Le commit dédié `e8542189a567e62cd766c3027518f2054706a865` a été publié sur review uniquement, ahead 1 / behind 0 avant la promotion.

**Promotion technique Lot 9 :** review indépendante ChatGPT du candidat exact `e8542189a567e62cd766c3027518f2054706a865` acquise selon la mission propriétaire. Gate de promotion vérifié : origin/main = `7fdcb16ceba7478dbde14b5282709310862654f0`, origin/review = candidat, ahead 1 / behind 0, worktree propre. Checkpoint documentaire dédié publié sur review, puis chaîne promue sur main par fast-forward strict ; aucun merge/squash/rebase/cherry-pick/force-push, code/test identique au candidat approuvé. Aucun workflow/status GitHub externe attaché au SHA selon la mission. Checkpoint de promotion `fa38818b2b0cbe510f4bc5c3a76c82acc50eab8c` sur main. Preuves ChatGPT/propriétaire fournies dans la mission Lot 10 : Railway SHA exact SUCCESS, logs Application ready, healthcheck 1/1, frontend public joignable. Le propriétaire indique tout le Lot 9 **VALIDÉ FONCTIONNELLEMENT PUBLIQUEMENT**, avec le seul polish visuel du lien Twitch porté au Lot 10. Aucun nouveau contrôle Railway ou test public exécuté par Codex. Lots 7/8 standalone restent validés publiquement ; Gift/Resub/EventSub Twitch restent techniques uniquement.

**Projection commune autoritative :** SocialService.favor compose PrivacyService et FavorService.getCurrent, avant toute lecture Faveur si accès refusé. Profil et !faveur utilisent exactement cette primitive ; Chat ne charge pas tout le Profil. Propriétaire : active/daysRemaining/maxDays/dailyPrimogems/claimedToday/claimStatus. Tiers autorisé : seulement active/daysRemaining/maxDays ; refus : `{ access: 'PRIVATE' }` sans indice. Aucun détail Twitch, Grant, origine du claim ou opération exposé. Consultation Faveur sans claimToday, opération Faveur, mouvement Economy, refresh Ressources, activité spécifique, catch-up Missions ni provisionnement ; messages COMMAND/GAME_RESULT dans le pipeline Chat normal.

**R670 / confidentialité :** FAVOR dédié, PUBLIC par défaut, Public/Amis uniquement/Privé ; propriétaire toujours autorisé, FRIENDS exige Friendship ACTIVE. Indépendant de GENERAL_STATISTICS, MISSIONS, PRESENCE et des autres catégories. Politique de confidentialité version 3 (19 catégories), ligne absente = PUBLIC ; overrides persistés par l’API existante, sans backfill ni migration. Configuration conserve un select par catégorie et le feedback de sauvegarde.

**R671 / UI et Chat :** carte compacte dans Profil > Aperçu, sans onglet dédié. Propriétaire actif : jours /180, +800/jour, disponibilité ou réception du jour ; CTA initial pour le propriétaire inactif : lien Voir la chaîne Twitch vers https://www.twitch.tv/kichnifou, nouvel onglet noopener/noreferrer, sans OAuth/paiement. Le Lot 10 ci-dessous étend et polit ce CTA propriétaire. Tiers : actif/jours ou inactive, aucun état du claim ni CTA personnel ; privé : Cette information est privée. !faveur READY et présente dans l’aide progression ; soi, pseudo, @pseudo et pseudo multi-mots utilisent la résolution Chat existante et la même confidentialité. Commande physique dans le Chat GachaImpact uniquement ; transport de commandes Twitch futur inchangé.

**Contrôles Lot 9 exécutés :** frontend complet **957/957 sur 102 fichiers**, backend complet **844/844 sur 87 fichiers**, ciblé dispatcher/registry **122/122**, PostgreSQL privé **219/219 sur 9 fichiers exécutés séparément** (Social Faveur 4, Social 10, Chat 28, Amitié 19, core Faveur 31, Subscribe 16, Gift 50, Resub 44, présence personnelle 17). Builds frontend/backend, typechecks, lint, verify:quick **5/5**, Prisma validate/status et diff-check passent. Premières attentes des anciennes catégories/version 2 actualisées ; test MP existant avec TTL réel de 120 ms expiré pendant le premier frontend complet, puis MP isolé **81/81** et frontend complet relancé **957/957**, sans modification MP. Fixture Chat supplémentaire préparée avec le marqueur Missions déjà traité et une horloge respectant le pacing, puis **4/4** ; aucune modification du pipeline Chat. Cinq warnings lint préexistants hors diff, bundle Vite >500 kB et dépréciation pg inchangés. Vrai GameShell/CSS de production sous Edge à 1920×1080 et 390×844 : six états Profil, confidentialité avec 19 selects et sauvegarde FAVOR, aucun overflow horizontal ni erreur de page. Harness et captures temporaires hors commit. Mocks et schémas PostgreSQL privés uniquement pour les tests mutatifs ; aucun OAuth/EventSub, sub/gift, receipt ou grant public créé, aucune modification Railway. Core Faveur, économie, présence Lots 7/8 et consumers Lots 5/6 inchangés ; 54 migrations, dernière 054, aucune 055. R670/R671 réconciliées sans nouvelle Rxxx ; workflow et roadmap inchangés.

**Lecture DB finale Codex, transaction READ ONLY :** zéro TwitchIdentity, receipt Subscribe/Gift/Resub et FavorGrant ; un claim NATIVE, une opération Faveur et mouvements quotidiens +800 de preuve ; aucune borne Faveur active/future. 54 dossiers/entrées Prisma, dernière 20260927230000_054_add_direct_message_typing_state, zéro registre incomplet, checksums alignés LF/CRLF. Cleanup des schémas privés des suites confirmé : seul le résidu antérieur non suivi reste, conservé sans nettoyage arbitraire. Aucune mutation métier publique.

### Faveur Lot 10 — CTA Profil, destination Event et présence quotidienne Twitch, promu techniquement sur main

**Implémentation et promotion Lot 10 :** gate initial d’implémentation vérifié sur review propre, main = review = `fa38818b2b0cbe510f4bc5c3a76c82acc50eab8c`, divergence 0/0. Candidat `2117f672417d093fa549bdfceb78cacea94edb94` (`feat(favor): complete Twitch daily presence and UI navigation`), descendant direct publié sur review et approuvé en review indépendante ChatGPT selon la mission propriétaire. Gate de promotion vérifié : origin/main = fa38818, origin/review = candidat, ahead 1 / behind 0, worktree propre. Checkpoint documentaire dédié publié sur review, puis chaîne promue sur main par fast-forward strict, sans merge commit/squash/rebase/cherry-pick/force-push ; code/test exactement identique au candidat approuvé. Aucun workflow GitHub externe attaché au SHA selon la mission. Lot 10 **PROMU TECHNIQUEMENT** ; GitHub/Railway/health/frontend **À VÉRIFIER par ChatGPT après push**.

**QA publique volontairement conservée :** selon la preuve indépendante ChatGPT transmise, Kichnifou actif du 2026-09-29 au 2026-10-28, claim du 29/09 déjà consommé exactement une fois, wallet 545 851, second Ctrl+F5 sans second crédit, zéro FavorGrant Twitch fictif. Le propriétaire veut conserver cette fenêtre pour comparer les comptes. Codex ne la modifie ni ne la nettoie.

**CTA Profil :** Voir la chaîne Twitch →, lien transparent cyan/petite typographie, focus-visible accessible, en bas à droite dans le panel via flux flex sans chevauchement. Propriétaire actif/inactif/reçu/disponible : toujours présent ; tiers : aucun lien. Destination exacte https://www.twitch.tv/kichnifou, target _blank et rel noopener noreferrer. Privacy version 3 et projection Lot 9 inchangées.

**Quotidiennes → Event :** eventNextDailyDestination pur dans le propriétaire Event, priorité Général (canJoin / calendar.canClaimToday / dailyBonus.canClaim), puis Jeu A (inscrit, non terminé, fenêtre ACTIVE/FUTURE), Jeu B (inscrit, non résolu, canAttempt), Jeu C (canSend ou unviewedCount). Sinon null, carte terminée sans Accéder. Disponibilité et texte dérivent du même calcul, labels du Festival dynamiques. Intent typé one-shot consommé par EventScreen ; un retour Event normal ouvre Général. Dernier clic du shell remplace les intents précédents ; notifications Messages/Shop et historique/refresh conservés. [Navigation](../specifications/navigation-shell-v1.md#activités-et-quotidiennes).

**R658 / daily Twitch spécialisé :** après HMAC/envelope channel.chat.message v1, texte non vide et ne commençant pas par ! après trimStart, classification en mémoire. Observer persiste ses hashes uniquement ; TwitchFavorChatPresenceConsumer relit le receipt, résout TwitchIdentity existante avec linkedAt ≤ receivedAt et Player ACTIVE, puis FavorService.claimToday(..., TWITCH). Aucun provisionnement, recalcul d’élément/niveau, parser, XP, Missions Chat, réponse/outbound/mirroring ou cutover. Le core reste unique pour +800, date Paris, concurrence et unicité UI/Twitch. Panne infrastructure → 500 pour retry ; conflit d’observation → 409. Identité absente/postérieure au receipt ou Player inactif → no-op.

**Rétention / indépendance :** même après paiement, receipt Chat RECEIVED, processedAt/externalReference null, aucun FavorGrant/FK claim : TTL 24 h R943–R945 préservé ; durable = claim/opération/ledger/stats. Aucun ajout au groupe OAuth Faveur Subscribe/Gift/Resub, aucun changement de lifecycle. Chat Twitch inactif → aucune présence Chat quotidienne, standalone toujours disponible. Exception Faveur spécialisée à R942 ; le reste du pipeline Twitch avancé reste en pause.

**Contrôles Lot 10 exécutés :** frontend complet **964/964 sur 102 fichiers**, backend complet **857/857 sur 88 fichiers**, PostgreSQL privé **213/213 sur 13 fichiers exécutés séparément** : nouveau webhook/consumer daily Twitch 15, core Faveur 31, présence personnelle 17, Social Faveur 4, Social 10, Subscribe 16, Gift 50, Resub 44, lifecycle 8, runtime Chat 3, Observer 4, webhook signé 9, rétention 2. Les 15 nouveaux cas prouvent sources TWITCH, absence d’XP/Missions Chat, unicité/concurrence UI-Twitch, retries avant/après crédit, refus liaison/re-liaison tardive, journée suivante et purge du receipt sans perte économique. Fixtures privées corrigées (login valide et marqueur Missions déjà initialisé) avant réussite ; aucun changement du core/pipeline Chat. Dernière vérification ciblée Shell/Event **63/63** après correction des dépendances de callback. Builds frontend/backend, typechecks, lint, verify:quick **5/5**, Prisma validate/status et diff-check passent. Cinq warnings lint préexistants hors diff, bundle Vite >500 kB et dépréciation pg inchangés. Vrai GameShell/CSS de production sous Edge à **1920×1080 et 390×844** : cinq états Profil (owner inactive/active/claimed, tiers public/privé), lien bottom-right sans chevauchement, quatre destinations Quotidiennes/Event et carte terminée sans CTA, aucun overflow horizontal ni erreur de page. Harness/captures temporaires hors commit, API simulée sans mutation publique. R658/R671 et propriétaires architecture/navigation actualisés sans nouvelle Rxxx ; workflow/roadmap inchangés.

**Lecture DB finale Lot 10, transactions READ ONLY :** QA Kichnifou intacte, bornes **2026-09-29 → 2026-10-28**, wallet **545 851**, exactement un claim NATIVE du 29/09 et une opération Faveur ; zéro TwitchIdentity/FavorGrant, zéro receipt Subscribe/Gift/Resub. Cinq observations Chat résiduelles RECEIVED/non traitées/sans référence externe. **54 migrations**, dernière 054, zéro migration inachevée, checksums LF/CRLF alignés, aucune 055. Schémas privés des suites nettoyés ; seul le résidu antérieur `batch_test_5bfa43862252462fbefb2c03dd30ca2f` reste, préservé. Tests mutatifs seulement mocks/schémas privés ; aucune donnée Supabase publique modifiée, nouvelle QA, liaison/OAuth/EventSub, message Twitch réel, vrai sub/gift/resub, variable Railway ou cutover.

**Validation publique post-Lot 10, communiquée par le propriétaire :** Lot 10 promu au checkpoint `4424b43f5b70647c7d449c6a05bb294ce5619afd`, globalement validé publiquement. Quatre défauts restants sont traités dans Lot 11 : priorité Event assimilant « incomplet » à « actionnable maintenant » pour A ; détail de destination non souhaité dans Quotidiennes ; lien Twitch Profil actif invisible/rogné ; présentation Faveur Profil à polir. Le claim Twitch demeure seulement technique, transport Chat réel inactif. Aucun contrôle Railway/health/frontend ni activation réelle exécuté par Codex dans Lot 11. Lots 7/8/9 et QA volontairement active conservés. Reprise exacte : voir Lot 11 ci-dessous.

### Gift Suprême Lot 11 — core métier, frontière redemption inerte et correctifs post-Lot 10, promu techniquement sur main

**Statut actualisé : APPROUVÉ indépendamment par ChatGPT au commit 88f841b1088ba05dd51079c55b3158e160b27e1f.** Conservé sur review, sans promotion intermédiaire. La frontière inerte décrite ci-dessous correspond au checkpoint Lot 11 ; le bridge préparé au Lot 12 est décrit dans la section suivante.

**Gate vérifié :** review propre, origin/main = origin/review = `4424b43f5b70647c7d449c6a05bb294ce5619afd`, divergence 0/0. Un commit dédié sur review seulement ; main conservé, aucune promotion intermédiaire. Domaine Gift Suprême core ouvert selon l’audit 20 ; correctifs Faveur/Event associés explicitement autorisés. QA Kichnifou 2026-09-29 → 2026-10-28 conservée, claim du 29/09 déjà consommé et wallet 545 851 au dernier checkpoint ; aucune modification/nettoyage public.

**Correctifs Profil/Event :** Faveur active mise en évidence, Reste : X jour(s), rouge seulement à 3/2/1, Récompense : +800 Primos par jour, ✅ Récupérée aujourd'hui en vert ou disponibilité neutre. Lien propriétaire sûr toujours visible, position absolute right/bottom 16px, carte relative avec espace réservé ; aucun lien tiers ni changement privacy. Quotidiennes affiche Festival + solde seulement, aucune destination. Priorité Général → A incomplet pour un inscrit même fenêtres PAST ou vides, sans canAttempt/fenêtre ACTIVE/FUTURE exigée → B non résolu et canAttempt autoritatif → C envoi/messages non lus. Intent one-shot, retour normal Général et notifications Shop/Messages conservés.

**GiftSupremeService :** primitive interne serveur uniquement, jamais appelée depuis une route standalone. Reward ID configuré par constructeur, aucun ID réel ; autres rewards ignorées, titre descriptif sans rôle d’identification. Gifter Twitch sans Player et self-gift autorisés. Normalisation casse/accents Social et @ ; exact, plus long pseudo contenu dans la phrase, puis Levenshtein seuils legacy 1/2/3. Égalités ambiguës refusées ; une cible explicitement nommée mais inactive/sans élément produit CANCEL sans fallback vers un voisin. Fuzzy sur Players ACTIVE à élément valide seulement ; verrou/relecture cible avant crédit.

**Atomicité/journal :** transaction Serializable bornée et retries de collisions ; receipt redemption unique externalEventId = `gift-supreme:<redemptionId>`, fingerprint reward/gifter/input hash/redeemedAt. Receipt durable PROCESSED avec preuve minimale R701, résultat local SUCCESS/INVALID, motif et référence opération ; aucun raw input nécessaire. SUCCESS : BusinessOperation gift-supreme.redeem / TWITCH / même clé, mouvement +1600 `particles_<élément>` via PrismaEconomyService cause/domain gift-supreme, totalMainElementParticlesEarned +1600. Aucun primos/moras/XP/Faveur/provisionnement de Player ni catch-up/récompense Missions supplémentaire. Notification GIFT_SUPREME_RECEIVED / gift-supreme, dédupliquée par redemption, sans action économique, dans la même transaction ; reste visible après paiement. Retour interne FULFILL avec cible/élément/montant/opération/notification, ou CANCEL avec raison stable. Replay succès/invalide durable avant nouvelle éligibilité, contradictions rejetées, concurrence sans double effet, rollback total et récupération post-commit. Aucun TTL Chat appliqué à ce journal durable. [Architecture](../architecture/backend-architecture-v1.md#gift-suprême-lot-11--core-métier-et-frontière-redemption-inerte-promu-techniquement-sur-main).

**Frontière future Twitch :** parser strict des champs officiels channel.channel_points_custom_reward_redemption.add v1, consumer consumeAuthenticated réservé à une future vérification HMAC ; broadcaster configuré et status unfulfilled exigés. Classes testées directement, absentes du webhook/runtime public. Pas de subscription, Custom Reward, OAuth/credential/token persistant, Update Redemption Status ou outbound. Le résultat local prépare la décision du bridge Lot 12 sans prétendre à un statut Twitch FULFILLED/CANCELED déjà appliqué. Schéma existant suffisant : aucune table GiftSupremeRedemption dédiée, aucune migration 055 ; cible logique/physique documentaire réconciliée. R692–R701 inchangées, aucune nouvelle Rxxx.

**Contrôles Lot 11 acquis :** frontend complet **974/974** (102 fichiers), backend complet **894/894** (90 fichiers, dont matching/parser Gift **37/37**). DB privés **187/187** dans onze suites : Gift **23**, Faveur **31**, projection Player/Faveur **17**, Social/Faveur **4**, Social **10**, Chat **28**, Missions permanentes **15**, Trades/économie **21**, Event **8**, présence Chat/Faveur **15**, Expéditions **15**. Une première exécution Social/Faveur a dépassé 30 s ; relance isolée **4/4** acquise. Fixtures Calendrier alignées sur A déjà terminé pour les cas calendrier seul ; assertions Quotidiennes sans détail de destination et privacy Profil renforcées, recontrôlées **42/42** et **20/20**. Injection d’échec notification au niveau d’une contrainte du schéma privé, après crédit : rollback Economy/receipt/notification et retry acquis. Typechecks frontend/backend, deux builds et **verify:quick 5/5** passent ; lint sans erreur avec cinq avertissements préexistants, build frontend avec avertissement taille du chunk existant, avertissement pg sur appels concurrents dans les fixtures. Prisma validate/status valides. Vrai GameShell et CSS de production sous Edge/API simulée en **1920×1080** et **390×844** : propriétaire actif/inactif/reçu/disponible et tiers, jours 30/4/3/2/1, CTA absolute visible avec marge droite/basse 17px et sans chevauchement, focus-visible, destinations Général/A/A PAST avec C non lu/B/C/terminé et notification Gift ; aucun overflow horizontal ni erreur page, captures inspectées. Tests mutatifs exclusivement mocks/schémas privés, aucune donnée Supabase publique modifiée.

**Lecture DB Lot 11, transaction READ ONLY :** QA Kichnifou intacte, bornes 2026-09-29 → 2026-10-28, wallet 545 851, un claim NATIVE du 29/09 et une opération Faveur. Zéro TwitchIdentity/FavorGrant, zéro opération/mouvement/notification/receipt Gift Suprême ; seulement les cinq observations Chat historiques RECEIVED. 54 migrations, dernière 054, zéro inachevée et checksums LF/CRLF alignés ; aucune 055. Schémas privés de ces suites nettoyés ; seul le résidu antérieur batch_test_5bfa43862252462fbefb2c03dd30ca2f reste, préservé. Aucun nettoyage ni mutation Supabase publique, changement Railway ou Twitch réel.

**Suite Lot 11 :** approbation indépendante acquise ; Lot 12 réalisé directement sur review. Aucune promotion entre les deux. Correctifs Profil/Event conservés ; claim quotidien Twitch seulement technique, QA publique Faveur intacte.

### Gift Suprême Lot 12 — OAuth durable, reward, EventSub et bridge spécialisé, promu techniquement sur main

**Gate initial Lot 12, avant promotion :** main était `4424b43f5b70647c7d449c6a05bb294ce5619afd`. Base review `88f841b1088ba05dd51079c55b3158e160b27e1f`, Lot 11 approuvé indépendamment. Candidat Lot 12 `38932b4e1ebede7a9b4c2e2eb405e7a567c20303`, ahead 2 / behind 0. Review indépendante ChatGPT : Lot 11 reste APPROUVÉ ; Lot 12 approuvé sauf shutdown pouvant bloquer un settlement après crédit/CANCEL local. Correctif dédié descendant de 38932b4 sur review : ahead 3 / behind 0 après publication, main inchangé, aucune promotion intermédiaire.

**Périmètre physique :** purpose AUTHORIZE_GIFT_SUPREME / state gift_ ; scopes exacts openid, channel:manage:redemptions, user:write:chat. Refresh token seul persisté sous AES-256-GCM avec AAD purpose/Player/Twitch, access token validé/cache mémoire, rotation optimiste revision. Reward app-owned exacte 10 000 Points, input requis/file backend ; recovery manageable, refus de doublon manuel actif, correction de drift seulement app-owned. EventSub redemption.add v1 filtré par broadcaster/reward ID. Webhook signé existant réutilisé, core Lot 11 intact, settlement FULFILLED/CANCELED après commit local et retry distant ; annonce spécialisée réservée durablement, jamais avant FULFILLED confirmé. Chat/Faveur/Gift/unlink partagent une seule file Player, locale au processus. Shutdown corrigé en deux phases : Reward OFF d’abord, relâche/reprise du même coordinator pour drain et guards Twitch UNFULFILLED / settlement local, EventSub OFF confirmé puis credential/cache supprimés. Identité supprimée uniquement après cleanup Gift puis Chat/Faveur ; pending garde EventSub/credential/identité et permet le retry signé malgré Reward OFF. Statut remote de désactivation et retry Compte ne réactivent pas silencieusement. Compte pilote distinct, statut remote, retour OAuth, retry et polling borné. [Architecture](../architecture/backend-architecture-v1.md#gift-suprême-lot-12--bridge-twitch-durable-promu-techniquement-sur-main).

**Migration 055 :** `20260929151500_055_add_twitch_gift_supreme_credential` ajoute uniquement la table credential, FK RESTRICT, contraintes, RLS et zéro droit navigateur. Chaîne complète 55 migrations appliquée/enregistrée par Prisma en schéma privé, 055 inchangée ; hardenings historiques 030/047 redirigés vers les seules fonctions privées pour cette répétition. Dernière lecture DEV avant promotion : 54/054 ; 055 en attente de vérification/application DEV post-promotion, aucun SQL public appliqué par Codex dans cette mission. Tests mutatifs uniquement mocks et schémas privés nettoyés ; QA Faveur publique non touchée.

**Contrôles initiaux Lot 12 (avant correction shutdown) :** frontend complet **984/984** (102 fichiers), backend complet **974/974** (95 fichiers). DB privés **220/220** en treize suites : chaîne Prisma/DDL 055 **3**, webhook Gift runtime **12**, core Gift Lot 11 **23**, Observer **4**, webhook existant **9**, runtime state **3**, retention **2**, Subscribe Faveur **16**, Resub **44**, Gift Faveur **50**, lifecycle Faveur **8**, présence Chat/Faveur **15**, core Faveur **31**. Typechecks, builds frontend/backend, lint sans erreur (cinq avertissements préexistants), verify:quick **5/5**, Prisma validate passent ; migrate status privé à jour, public seulement 055 pending comme attendu. Avertissements existants : chunk frontend >500 kB et pg sur appels concurrents des fixtures. GameShell complet/CSS de production avec API simulée, **1920×1080** et **390×844** : inactif, actif, pending, conflit manuel, indisponible, OFF/non-pilote/non-lié, focus visible, zéro débordement horizontal/erreur page ; captures inspectées. Tests mutatifs exclusivement mocks/schémas privés, nettoyés. Aucun OAuth, Custom Reward, EventSub Gift, redemption, annonce ou effet Gift public exécuté ; aucune variable Railway modifiée. Flag Gift par défaut OFF, aucune clé réelle dans Git ; construction et health sans effet Twitch. R692–R701 et économie Lot 11 inchangées, aucune nouvelle Rxxx.

**Lecture publique READ ONLY Lot 12 :** QA Kichnifou inchangée (2026-09-29 → 2026-10-28, 545 851 Primos, un claim NATIVE et une opération Faveur). Zéro TwitchIdentity, FavorGrant, opération/mouvement/notification/receipt Gift ; cinq receipts Chat historiques RECEIVED. 54 migrations, dernière 054, zéro inachevée, checksums alignés ; table credential 055 absente en public. Tous les schémas créés par ces tests sont supprimés ; seul le résidu antérieur batch_test_5bfa43862252462fbefb2c03dd30ca2f est préservé.

**Correction shutdown Lot 12 :** deux phases sans deadlock ni seconde queue ; aucune modification économique, de la politique d’annonce R696 ou de R692–R701 ; migration 055 inchangée, 55 dossiers review, aucune 056. Tous les scénarios mutatifs restent mocks/schémas privés ; QA Faveur publique intacte, aucune activation OAuth/Reward/EventSub/redemption/annonce réelle ni modification Railway. Contrôles finaux du correctif : frontend complet **988/988** (102 fichiers) et Compte **66/66** ; backend complet **992/992** (96 fichiers). PostgreSQL privé **233/233** (14 suites), dont shutdown signé **13/13** couvrant FULFILL/CANCEL commit + panne settlement + retry Reward OFF, remote pending sans preuve, guard local même si remote vide et preuve ancienne reward, webhook en queue entre A/B, unlink bloqué/retry, panne Reward/EventSub et annonces SENT/FAILED/AMBIGUOUS/RESERVED non bloquantes. Régressions : core Gift **23**, runtime Gift **12**, DDL/chaîne Prisma 055 **3**, Faveur/Chat **182**. Typechecks, builds frontend/backend, lint sans erreur (cinq avertissements préexistants), verify:quick **5/5** et Prisma validate passent ; migrate status privé 55 à jour. Une assertion temporisée Messages privés a échoué au premier frontend complet sous concurrence, puis fichier **81/81** et complet avec deux workers passent, sans modification Messages privés. Vrai GameShell/CSS production, API simulée, neuf états en **1920×1080** et **390×844**, dont désactivation partielle et retry : focus visible, aucune fausse activation, zéro overflow/erreur page ; captures inspectées. Warnings existants Vite chunk/pg conservés. Lecture publique READ ONLY : QA 2026-09-29 → 2026-10-28, 545 851 Primos, un claim NATIVE/un Favor BusinessOperation ; zéro TwitchIdentity/FavorGrant/effet Gift, cinq receipts Chat historiques ; 54/054, zéro inachevée, checksums alignés, table 055 absente. Tous les schémas de ces tests sont nettoyés, seul le résidu antérieur batch_test_5bfa43862252462fbefb2c03dd30ca2f est préservé.

**Checkpoint de promotion :** review indépendante ChatGPT des commits Lot 11 `88f841b`, Lot 12 `38932b4` et shutdown `a6fcfc1` acquise ; les trois commits et ce checkpoint documentaire sont promus en une seule avance fast-forward de `review` vers `main`, sans changement code/test/migration depuis `a6fcfc1`. Le propriétaire a depuis validé publiquement les cinq correctifs UI Profil/Faveur/Quotidiennes/Event : présentation Profil Faveur, lien Twitch actif/inactif, carte Quotidiennes Event sans détail de destination, Jeu A incomplet prioritaire hors fenêtre et intent Event one-shot. Gift Suprême est techniquement complet sur main ; le flag logiciel reste OFF par défaut, sans OAuth/Reward/EventSub/redemption Gift réels. Railway a déployé `61c04bd` avec succès et son `preDeployCommand` est désormais `npx prisma migrate deploy`. Pourtant, la lecture DEV après déploiement donne toujours 54 migrations, dernière 054, table credential 055 absente : l'image runtime ne contenait ni Prisma CLI, ni `prisma.config.ts`, ni le dossier des migrations. QA Faveur publique reste active du 2026-09-29 au 2026-10-28, avec claim du 29/09 consommé et 545 851 Primogemmes au checkpoint propriétaire.

**Correctif image Railway promu techniquement sur `main` :** le paquet de production inclut la CLI Prisma 7.10.0 ; le runtime Docker copie `prisma.config.ts`, `prisma/schema.prisma` et les 55 migrations sans source, tests ni fixtures. Le build applicatif et le démarrage ne lancent aucune migration ; Railway conserve le déclenchement en pre-deploy avec `npx prisma migrate deploy` déjà configuré. Le SQL 055 et le code métier restent inchangés depuis `c4566aa`. `npm ci --omit=dev` dans une copie temporaire des fichiers runtime, `npx prisma --version` (7.10.0) et `npx prisma migrate deploy` sur un schéma PostgreSQL privé passent : 55 migrations terminées, dernière 055, table credential vide avec RLS, zéro policy/droit navigateur et FK restrictive. Les tests ciblés environnement/credential/OAuth/provider passent **51/51**, la DDL privée **3/3**, le typecheck et le build backend ainsi que `verify:quick` **5/5** passent. Aucun moteur Docker n'est disponible sur ce poste : le build et l'inspection de l'image réelle restent à prouver sur Railway au prochain redeploy. La dernière lecture publique reste à 54/054, table 055 absente, QA Faveur au checkpoint propriétaire ; aucun schéma de test créé par ce correctif n'est conservé. Aucune variable Gift n'est encore configurée et Gift Suprême réel reste OFF et inactif.

**Suite historique après correction de l'image :** le redeploy et l'activation pilote Gift ont ensuite eu lieu ; le statut préactivation ci-dessus ne décrit plus l'état public courant. L'incident, son correctif et sa récupération sont détaillés ci-dessous ; le statut courant et la désactivation figurent en tête du Master.

**Incident public Gift Suprême historique, résolu par récupération :** TwitchIdentity Kichnifou liée, OAuth Gift réussi, credential refresh chiffré et reward ID app-owned stockés ; ancienne Reward manuelle détectée comme conflit puis renommée « Gift Suprême test » par le propriétaire, nouvelle Reward « Gift Suprême » créée par GachaImpact. Vérification du callback EventSub HTTP 200 le 2026-09-29 à 20:06:18Z. Première redemption réelle de Kichnifou pour `user_input=Kichnifou`, visible dans Twitch ; ancien runtime `/api/v1/twitch/eventsub` a renvoyé 409 quatre fois (20:11:30Z, 20:11:40Z, 20:12:01Z, 20:12:42Z). Aucun receipt transport/core Gift, opération Gift ni notification à cet instant ; Cryo Kichnifou est resté à 85 850, sans +1600. Après les retries, l'UI affichait « Non activé » et « Gift Suprême nécessite un contrôle opérateur. » La redemption déjà dépensée a ensuite été récupérée sans nouvelle redemption ni compensation. Ces faits publics viennent du propriétaire ; Codex n'a exécuté aucune action Twitch, Railway ou écriture DEV.

**Contrôle DEV en lecture seule pendant le correctif :** Prisma migrate status à jour, 55 migrations, dernière 055 ; une TwitchIdentity, un credential Gift avec reward ID enregistré, Cryo Kichnifou 85 850, zéro receipt Gift, zéro BusinessOperation `gift-supreme.redeem`, zéro notification Gift. Transaction READ ONLY terminée par ROLLBACK, sans lecture du ciphertext ni écriture publique ; ce contrôle ne vérifie pas l'état Twitch de la redemption.

**Correctif incident promu, déployé et validé publiquement :** candidat approuvé `ad826c732c73a60a909cdc9ee7146d7ea6b1a62d`, déployé via le SHA `e705ebd`, sans changement de code/test lors de la promotion. Notification EventSub signée → identité pilote et credential/reward ID locaux → reçu transport durable → token Gift → même core/settlement/annonce. Aucun GET Reward/EventSub live en preflight ; une ancienne subscription `notification_failures_exceeded` ou autre terminale n'est plus active et « Réessayer » peut en créer une nouvelle, tandis qu'un statut inconnu reste conflictuel. Ce même clic lit de façon bornée les redemptions Helix UNFULFILLED de la Reward app-owned et les traite via le core existant, sans faux Message ID EventSub ni second crédit. Le résultat FULFILL conserve la balance de particules post-crédit, pour le message legacy R696 exact et déterministe au replay ; la notification standalone et l'annonce at-most-once restent inchangées. Aucune migration 056, aucun ID de redemption réel codé en dur, aucune mutation publique par Codex. [Architecture](../architecture/backend-architecture-v1.md#gift-suprême--bridge-complet-validé-publiquement-désactivé-hors-cutover).

**Contrôles du candidat :** backend complet **1011/1011**, frontend complet **988/988**, PostgreSQL privé ciblé **187/187** sur dix suites Gift/Faveur/Chat/EventSub, dont une récupération de 85 850 → 87 450 Cryo avec une seule opération, une notification, un settlement FULFILLED et une annonce exacte ; invalides CANCELED sans crédit. La suite runtime privée finale repasse **16/16** avec l'exemple public exact simulé. Builds backend/frontend, Prisma validate/status, typechecks, lint et `verify:quick` **5/5** réussis ; avertissement existant de taille du bundle frontend. Les tests mutatifs sont confinés aux schémas privés et mocks, nettoyés après exécution.

**Validation publique de la récupération acquise :** Railway `e705ebd` SUCCESS et `/health` réussi ; le propriétaire a cliqué uniquement « Réessayer », sans seconde redemption. La redemption existante est récupérée : receipt core `PROCESSED`, `localOutcome=SUCCESS`, `settlementState=FULFILLED`, `announcementState=SENT` durable ; exactement une BusinessOperation `gift-supreme.redeem`, un ResourceMovement Gift +1600 Cryo et une Notification Gift. Cryo Kichnifou 85 850 → 87 450 (`balanceAfterParticles` durable). Le propriétaire confirme le message Twitch envoyé par le nouveau backend GachaImpact, et non Streamer.bot : « 🎁 Kichnifou offre un Gift Suprême à Kichnifou ! +1600 particules Cryo (87450) ». Après la preuve, le bridge Gift GachaImpact a été désactivé volontairement : TwitchIdentity Kichnifou présente (1), credentials Gift et reward ID local actif (0), historique conservé (une opération, un mouvement, une notification), Cryo 87 450. L'état ON/OFF de l'ancienne Reward manuelle n'a pas été vérifié indépendamment. Preuves publiques transmises par le propriétaire et ChatGPT ; Codex n'a pas refait ces contrôles externes.

- **Premier import pilote Kichnifou exécuté publiquement avec succès sur le moteur aligné promu sur `main`.** OAuth, unlink/relink et premier preview des 17 JSON avaient été validés ; le propriétaire confirme ensuite le premier apply du snapshot `1852d7141a121c335c5928a8265c20e840e5c5dd20ccee12b054b99f780806ba`. DEV avait **53 migrations** avec 053 appliquée, 120 Characters, dix Players, une TwitchIdentity, exactement **un MigrationRun pilote `COMPLETED`** et zéro MigrationBatch. Le run rapporte **15 domaines personnels importés**, **10 globaux différés** et zéro anomalie. L'audit DB ne trouve aucune BusinessOperation de migration, aucun ResourceMovement de migration, aucun FavorGrant ni notification créée pendant l'import. **Lot UX précédent promu et validé publiquement par le propriétaire :** pending et refresh automatique sans Ctrl+F5 ; Box cadre, scroll, filtres et focus ; Catalogue cadre, scroll et filtres ; Configuration > Menu et Stella Fortuna, avec cartes non compressées. **Micro-polish promu techniquement sur `main` :** résumés Box/Catalogue sous les cadres, alignés à droite et hors scroll, espace Box réduit ; le propriétaire valide publiquement ces deux micro-retouches, leur alignement et leur scroll. **Twitch runtime phase 1 promu :** observation-only interne, sans transport, commande, réponse Twitch ni effet métier ; DEV comptait zéro `TwitchEventReceipt` public au checkpoint préalable. Streamer.bot reste live et autoritatif. La migration finale et le cutover global n'ont pas commencé et restent une mission distincte. Ce checkpoint est historique ; domaine actif et état du transport : voir la reprise ci-dessus.

- **Complément MP promu techniquement sur `main` :** l'indicateur de frappe utilise `direct_conversation_participants.typing_until` (migration additive 054) et un TTL serveur de quatre secondes ; seul l'autre participant autorisé est projeté. Une frappe réelle renouvelle au plus toutes les deux secondes, sans heartbeat périodique de brouillon. Dans le fil ouvert, « est en train d’écrire… » remplace provisoirement l'accusé dans la zone stable `.dm-latest-status`, puis celui-ci revient à expiration. Le total MP non lu déjà porté par ChatPanel alterne `document.title` avec le titre normal ; lorsque l'onglet est masqué, seul le GET non-lus léger reste sondé environ toutes les cinq secondes. Aucune Browser Notification, donnée d'historique, opération métier ou action Twitch n'est créée. **DEV suit désormais 54 migrations**, avec 054 appliquée et vérifiée : RLS active, aucun droit navigateur direct, six participants MP historiques inchangés et aucun typing actif initial. Deux `MigrationRun` pilotes `COMPLETED` sont présents et conservés : le second, confirmé par le propriétaire, concerne le même Player et le même snapshot et possède le même résumé ; les deux runs sont intacts, zéro `MigrationBatch` et zéro `TwitchEventReceipt` public. Le propriétaire valide publiquement le typing et le retour à Lu/Envoyé après arrêt, le typing depuis Archives sans désarchivage et la réactivation après un vrai envoi, ainsi que les titres singulier/pluriel, leur alternance avec GachaImpact et le retour au titre normal après lecture. Aucun de ces points ne reste en attente de validation publique ; l'absence de cutover reste inchangée.

  **Correctif archive/typing promu techniquement sur `main` :** l'archive MP est un rangement personnel. Une conversation archivée envoyable conserve le typing selon les permissions réelles et `canSend` ; l'archive de l'autre participant ne masque pas son typing autorisé. Le typing seul ne désarchive jamais ; seul l'envoi réel conserve la réactivation historique. Tests DB typing privés **4/4**, panneau MP/titre **82/82**, routes MP **4/4** et `verify:quick` **5/5** passent. Sous Edge, le vrai GameShell, les CSS de production et une API simulée à 1920×1080 et 390×844 montrent le typing depuis Archives sans déplacement du composer ni désarchivage automatique. Le micro-polish Box/Catalogue, le webhook Twitch Phase 2A OFF et le complément MP/titre sont approuvés en review indépendante et promus techniquement sur `main`. Les retouches UI et les MP, y compris le typing depuis Archives, sont maintenant validés publiquement par le propriétaire ; aucune validation publique EventSub n’est attendue puisque le transport est inactif. Aucune migration supplémentaire ; le contrôle DEV en lecture seule confirme 54 migrations, deux runs pilotes `COMPLETED`, zéro batch et zéro reçu Twitch public.

- **Twitch Phase 2B-1 approuvée en review indépendante et promue techniquement sur `main`, sans activation :** OAuth runtime backend séparé (`POST /api/v1/me/twitch/runtime/start`), réservé au pilote déjà lié, avec exactement `openid user:read:chat user:bot channel:bot`. Le link existant conserve seulement `openid`. Le préfixe `runtime_` appartient au hash complet du state one-shot ; aucune migration du purpose. OIDC, nonce, Client ID, `/validate`, scopes et `/helix/users` doivent confirmer le même Twitch User ID et le login lié, sans écraser l’identité ni persister de token user. Le provider Client Credentials conserve son App Access Token en mémoire, avec marge d’expiration et refresh concurrents sérialisés ; Helix invalide le cache sur 401 et retente une seule fois. Le manager EventSub GET/POST vérifie type/version/condition/transport/callback/status, parcourt les pages et retrouve l’exacte après 409 ; tout conflit exige un contrôle opérateur, sans delete. La configuration callback HTTPS est préparée, sans variable Railway ajoutée. Au checkpoint 2B-1, le manager n’était appelé ni au boot, ni au callback OAuth, ni dans status/health, ni par scheduler ou frontend ; la Phase 2B-2 promue ci-dessous ajoute uniquement les parcours pilote explicites. Au checkpoint 2B-1, `runtimeSubscriptionAvailable=false` ; aucun consentement n’est mémorisé. Le checkpoint 2B-1 n’ajoutait aucun bouton ou message visible. EventSub Phase 2A reste OFF ; aucun runtime OAuth réel encore exécuté, zéro souscription réelle créée, zéro reçu Twitch public, aucun gameplay ou outbound Twitch. DEV vérifié en lecture seule : 54 migrations (054 inchangée), 120 Characters, dix Players, une TwitchIdentity Kichnifou, deux runs pilotes `COMPLETED` et zéro batch.

  **Contrôles Phase 2B-1 acquis :** backend OAuth/provider/manager/routes/config/application **66/66**, Compte frontend **12/12**, DB privés state OAuth/webhook Phase 2A/observer **12/12**, typechecks, build backend, lint et `verify:quick` **5/5**. Les fixtures DB ont été créées et nettoyées uniquement dans des schémas privés ; aucun consentement Twitch ni appel EventSub réel.

  **Suite historique supersédée :** activation, réception de plusieurs chatters, désactivation et unlink désormais validés publiquement ; la reprise ci-dessus porte le domaine 18 et la pause R942.

- **Micro-correctif Event approuvé en review indépendante et promu techniquement sur `main` :** la régression de largeur du badge « Inscrit » dans Général > Festival des Récoltes est corrigée techniquement par une capsule à largeur intrinsèque, en colonne 3 / ligne 1 en haut à droite sur desktop. Couleurs, bordure, rayon et padding restent identiques ; le placement mobile colonne 1 / ligne 2 à gauche est conservé. « Non inscrit » utilise la même largeur naturelle selon son texte. Tests Event **56/56**, typecheck frontend, build, lint et `verify:quick` **5/5** passent. Sous Edge, le vrai EventScreen dans le GameShell complet et les CSS de production sont contrôlés à 2560×1440, 1920×1080, 1366×768 et 390×844, pour les deux états : badge non rogné, aucun débordement horizontal du document et géométrie des éléments voisins inchangée par le correctif. **Réserve préexistante du contrôle local :** à 1366×768, le texte long et le lien Historique de la fixture « Non inscrit » dépassent la hauteur de la carte et sont rognés ; ce micro-correctif ne modifie pas leur placement. **Validation publique du badge acquise :** le propriétaire confirme « Inscrit » ajusté à son contenu, en haut à droite et sans largeur excédentaire ; aucune validation publique de ce micro-correctif ne reste ouverte. Le commit Twitch Phase 2B-1 reste intact, approuvé et promu techniquement, EventSub reste OFF, DEV reste au checkpoint de 54 migrations ; aucune mutation DB, migration ou activation Twitch dans ce lot.

- **Twitch Phase 2B-2 transport désormais validé publiquement (implémentation et contrôles locaux historiques ci-dessous) :** l’UI pilote approuvée « Réception du chat Twitch » s’insère entre les informations de liaison et « Délier Twitch » dans Configuration > Compte. Elle reste absente pour un non-pilote, un pilote non lié ou un runtime serveur indisponible. « Autoriser et activer » appelle le start OAuth runtime distinct ; après state/nonce/OIDC/identité/scopes/profil validés, seul `AUTHORIZE_RUNTIME` appelle ensure si le serveur est correctement configuré et activé. Le statut réel vient d’un GET EventSub, sans flag local ni DB ; `enabled` donne Activée, pending entraîne au plus quatre relectures espacées d’une seconde et une confirmation bornée à huit secondes, jamais une fausse activation. Une panne ou un conflit conserve les informations de liaison et utilise la zone d’erreur existante. « Désactiver » supprime uniquement la souscription exacte ; un DELETE 404 exige une relecture prouvant son absence, 401 conserve un seul refresh/retry. L’unlink supprime d’abord la souscription sous la même file pilote que ensure/disable, y compris si le drapeau de réception est repassé OFF mais la gestion reste configurée ; en cas de panne, conflit ou configuration partielle empêchant ce contrôle, TwitchIdentity est conservée. Player, compte web, progression, préférences et reçus historiques restent intacts.

  **Contrat de réception :** `channel.chat.message` v1, `broadcaster_user_id=Kichnifou` et `user_id=Kichnifou`, écoute les messages de **tous les auteurs dans le chat Kichnifou**. `user_id` porte l’autorisation de lecture, jamais un filtre sur `chatter_user_id`. Un message de Céo sur cette chaîne est reçu ; sur une autre chaîne il n’appartient pas à cette souscription. Le reçu utilise le Twitch User ID du chatter ; un viewer inconnu reste non résolu et ne crée aucun Player. Webhook signé → Observer → Receipt uniquement : déduplication par ID EventSub, hash SHA-256 du texte, aucun texte brut persisté, aucune commande, message Global Chat, XP, ressource, récompense ou notification gameplay.

  **Contrôles Phase 2B-2 acquis :** Compte **30/30** et client API **23/23** ; backend OAuth/routes/provider/client/manager/config **98/98** ; DB privées state/unlink **3/3**, webhook/tous chatters **7/7** et observer **4/4**, soit **14/14**. Typechecks frontend/backend, builds, lint et `verify:quick` **5/5** passent. Sous Edge, GameShell complet et CSS de production à 2560×1440, 1920×1080, 1366×768 et 390×844 : états inactive/active, bloc absent OFF/non-pilote, commandes stables pendant les requêtes, aucun overflow horizontal document, unlink accessible par le scroll prévu. Aucun contrôle local ne vaut validation publique.

  **État réel pendant ce lot :** Phase 2B-1 promue ; EventSub production toujours OFF, aucune variable Railway modifiée, aucun consentement OAuth réel, aucune souscription réelle créée/supprimée, aucun message Twitch envoyé. DEV revérifié en lecture seule : 54 migrations, dernière 054, 120 Characters, dix Players, une TwitchIdentity, deux MigrationRun pilotes COMPLETED, zéro MigrationBatch et zéro TwitchEventReceipt public. Les tests DB utilisent uniquement des schémas privés créés puis nettoyés. Streamer.bot reste autoritatif ; aucun cutover. La Phase 2B-2 est promue techniquement ; les contrôles Railway/health/DEV/EventSub OFF sont confirmés par ChatGPT, puis transport validé publiquement selon le nouveau checkpoint ci-dessus.

  **Complément rétention/documentation promu techniquement :** rétention Twitch 24 h codée, sans migration ni activation ; le filtre et les limites sont possédés par [data-retention-v1.md](../specifications/data-retention-v1.md). Décisions durables [R939–R945](../specifications/decisions-log.md#r939r945--transports-twitch-et-rétention-2026-09-28), parité `.txt`, chats distincts et passe finale documentés. Les statuts R913–R915 et avatars possédés sont réconciliés avec les commits déjà sur main et les seules validations publiques rapportées ; le bloc architecture 2B-1 obsolète est condensé et explicitement supersédé pour les points d'entrée. La reprise Guide → Master → roadmap → propriétaires est contrôlée avant publication ; aucune purge Banque/Boutique/Event/Boss/Concours/Combat/Échanges/Codes/Chat/Notifications n'est codée dans ce lot.

  **Contrôles du complément initial acquis :** backend ciblé Phase 2B-2/provider/client/manager/config/isolation/rétention **107/107**, dont rétention **8/8** ; frontend Compte/API **53/53**. PostgreSQL en schémas privés : rétention **2/2**, Observer **4/4**, webhook **8/8** (ACK 204 et replay malgré échec maintenance), state/unlink **3/3**, soit **17/17**. Protection FavorGrant et consommation entre sélection/DELETE, borne horaire/concurrence, absence d'attente de la maintenance et déduplication sont couvertes. Typechecks frontend/backend, builds, lint et `verify:quick` **5/5** passent ; seul l'avertissement de taille du bundle Vite subsiste. `prisma migrate status` confirme les 54 migrations appliquées ; lecture seule publique conforme aux compteurs du checkpoint, aucune mutation publique. Les schémas privés sont créés puis nettoyés. Liens/ancres ajoutés et définitions R939–R945 contrôlés ; aucun nouveau contrôle visuel (aucun diff UI), la preuve locale du candidat 2B-2 reste distincte du test public ultérieur désormais acquis. Aucune activation Twitch ni infrastructure modifiée.

  **Correctif final de cadence promu techniquement :** rétention 24 h inchangée, normale 1 h / rattrapage 1 min après sélection pleine de 1 000, délai depuis la fin, un lot sans boucle ; partiel/échec → 1 h. Tests rétention **14/14**, backend ciblé **113/113**, DB privées **18/18** (dont webhook **9/9**, ACK 204 pendant blocage/échec), build serveur et `verify:quick` **5/5** passent. DEV revérifié en lecture seule : 54 migrations, dernière 054, deux runs COMPLETED, zéro batch et reçu public. Aucune migration, activation réelle ou infrastructure modifiée.

  **Gate final de promotion exécuté :** rétention ciblée **14/14**, rétention PostgreSQL privée **2/2**, webhook EventSub privé **9/9**, `verify:quick` **5/5** et `git diff --check` réussis. Schémas de test privés créés puis nettoyés ; lecture seule publique conforme : 54 migrations, dernière 054, deux runs COMPLETED, zéro batch et reçu Twitch. Aucune mutation publique, migration 055 ou activation réelle.

  Historique des contrôles avant promotion du pilote snapshot aligné : pilote DB privé **5/5**, migration non DB **46/46**, `verify:quick` **5/5**, `verify:full` **8/8** avec `VITEST_MAX_WORKERS=2`, typecheck et builds réussis. Deux passes `verify:full` à workers par défaut avaient expiré sur Chat frontend hors périmètre ; le fichier Chat seul passe **63/63** et la suite frontend complète **98/98 fichiers, 876/876 tests** avec deux workers. La suite PostgreSQL complète a été tentée deux fois : **40/41 fichiers, 348/350 tests**, puis **38/41 fichiers, 344 réussis, 4 échoués et 2 ignorés**, chaque échec/skip final étant lié à la saturation intermittente des connexions DEV (`53300`). Les fichiers concernés repassent seuls : Box **2/2**, Historique/Navigation/DDL 053 **6/6**. Aucun échec fonctionnel du pilote n'a été observé avant l'import public ; les compteurs DEV étaient alors inchangés. Aucune passe PostgreSQL complète verte n'est revendiquée.

- **Checkpoint TwitchIdentity / socle migration legacy global R927–R938 approuvé en review indépendante et promu sur `main`, sans cutover.** Le [contrat canonique](../architecture/legacy-migration-v1.md) remplace la matrice du pilote pour le futur cutover. Le snapshot local figé (17 JSON, hash `1852d7141a121c335c5928a8265c20e840e5c5dd20ccee12b054b99f780806ba`) sert à une répétition privée des 45 profils éligibles et des domaines partagés, avec plan de purge et identité Twitch synthétique explicitement limitée au test. Les migrations physiques additives 049–052 ont porté DEV à 52 migrations au checkpoint précédent, avec 120 personnages catalogue et dix Players publics ; 049–052 demeurent inchangées par le présent correctif. La correction 052 aligne calendrier Faveur, preuve `GiveawayWin`, purge des sessions web de test et provenance de la date XP ; la répétition privée a passé ces contrôles. Aucun cutover ni import global des autres Players publics n'a eu lieu : Streamer.bot reste la source autoritative vivante ; le premier import pilote Kichnifou est décrit ci-dessus. La résolution réelle des Twitch User IDs demeure nécessaire avant une future mission de cutover sur un nouveau snapshot. Les décisions et gates sont dans le [journal](../specifications/decisions-log.md) et le [runbook](../process/legacy-cutover-runbook.md).

  Axel a validé publiquement l'écran Invocation fonctionnel après le déploiement précédent : la barre « Historique des invocations » a disparu sous la bannière et le bouton « Détail » conserve son onglet Historique. Le parcours OAuth Twitch Kichnifou, unlink/relink et la prévisualisation des 17 JSON ont été validés avant le premier import pilote décrit ci-dessus. Le socle de migration n'a pas de validation publique de cutover à effectuer puisque le cutover n'a pas eu lieu.

  Gates acquis avant promotion : les champs legacy optionnels `previousWinner` et `rerolledAt` sont couverts et projetés sans inventer de séquence de rerolls ; la répétition privée du snapshot figé, `verify:quick` et `verify:full` passent. La suite PostgreSQL complète était verte en une passe (**40/40 fichiers, 348/348 tests**) ; DEV était alors à 52 migrations sans import public. Le correctif Invocation a passé ses 19 tests ciblés, typecheck, build, lint et `verify:quick` ; aucun contrôle visuel local à 1920×1080 n'a été exécuté pour ce correctif.

  **Convention globale du curseur interactif approuvée en review indépendante et promue sur `main`.** Les contrôles cliquables reçoivent `pointer`, les contrôles désactivés un curseur non interactif, sans changement de structure, couleur ou espacement. Le propriétaire a validé publiquement le curseur dans Configuration. **Checkpoint pilote promu et testé publiquement :** dernier alignement du pilote sur le contrat global, puis premier import Kichnifou réussi ; son polish UX post-import est validé publiquement comme décrit ci-dessus. R911 (observation d'une rotation naturelle), R912 (revalidation visuelle) et la validation publique distincte du Menu restent ouverts séparément.

- **Socle Apparence promu sur `main`.** Les migrations 045 à 047 ont établi catalogue, possession, équipement, fallback élémentaire et trigger de désactivation avec `search_path` fixe ; 045–047 sont inchangées. `unlockCosmetic` conserve ses modes explicites `PLAYER_FACING` et `SILENT_BACKFILL`. `GET/PATCH /api/v1/me/appearance`, Profil propriétaire > Personnalisation et avatars des surfaces d'identité/sélection standalone sont promus ; titre uniquement Profil. Le test public valide la notification de backfill et sa navigation vers Personnalisation, les avatars personnages possédés dans Personnalisation et le fonctionnement de l'avatar élémentaire.
- **Isolation DB et avatars personnages approuvés en review indépendante et promus ; parcours Apparence cités ci-dessus validés publiquement.** La migration additive 048 est appliquée sur DEV : **48 migrations terminées**, zéro rollback. Elle lie un avatar cosmétique à un Character réellement possédé, réutilise `Character.iconPath` et crée 28 définitions, 60 possessions et cinq notifications de backfill agrégées (25, 24, 7, 2, 2). Un premier personnage obtenu par Gacha débloque son avatar dans la même transaction ; les doublons et replays sont neutres. Une seule notification vivante additionne les nouveaux avatars jusqu'à consultation, puis le clic ouvre Profil > Personnalisation > Avatars avant archivage. L'icône élémentaire simple remplace le badge lumineux sans nouvel asset. Les tests DB mutatifs sont isolés du schéma public DEV ; les 14 Shop Fixture et deux Character d'expédition orphelins ont été supprimés après audit, sans toucher aux dix vrais Players. La suite PostgreSQL complète passe sur 38 fichiers et 339 tests.
- **Event et Échanges validés publiquement ; correctifs visuels Modération, Sidebar et Chat approuvés en review indépendante, promus sur `main` et validés publiquement par Axel.** Les sélecteurs Event et Échanges conservent avatar et pseudo groupés à gauche ; le test public les valide. Dans la recherche rapide Modération, l'avatar et le texte étaient deux enfants flex distincts et `justify-content: space-between` écartait le pseudo au milieu. Le correctif regroupe l'identité avec `PlayerIdentityInline` et laisse le badge TESTEUR à droite. Il corrige aussi le cadrage des avatars Sidebar Character/élément et Chat Character/élément en supprimant le padding natif des boutons et les lueurs des avatars, sans toucher aux dimensions extérieures ni aux assets. Axel a validé publiquement ces retouches visuelles. La revalidation R912 reste distincte et en attente comme indiqué ci-dessous.

- **Validation publique et R912.** Le propriétaire confirme les parcours fonctionnels Classements (34 métriques, confidentialité, pagination, raccourci Profil, notification Trade) et Historique global (cinq catégories, filtres, deep-links, pagination et responsive). L'alignement des onglets sur `activity-inner-tabs` est approuvé par la review indépendante et promu ; sa revalidation visuelle publique reste à faire. La rotation naturelle future doit encore confirmer qu'un nouveau snapshot complet R911 apparaît en production ; la logique R911 est techniquement validée.
- **Retouches UX Menu/Event du 2026-09-26 : approuvées en review indépendante et promues.** Le Menu n'expose plus la destination redondante Social : Amis ouvre toujours l'écran `social`, `#social` reste compatible et les anciennes préférences `social` sont nettoyées sans perdre les autres choix. Event présente l'onglet Général, un bandeau rétracté ouvrable depuis toute sa surface et au clavier, et un seul accès Historique discret dans sa carte Festival compactée. Aucune règle métier Event n'est modifiée. Le parcours Event testé publiquement est validé ; une validation publique distincte du Menu n'est pas rapportée ici.

- **Statistiques générales et R907 validées publiquement par le propriétaire.** `Profil > Statistiques` présente quatre groupes et 23 métriques en lecture seule. Le test public confirme `!infos Pseudo`, `!infos @Pseudo`, les références Player avec `@` dans le Chat et `!echanger @Pseudo`. Le correctif Notifications Trade ci-dessous est distinct de R907. Les Lots Missions 1 à 5 et le cycle Messages privés restent validés publiquement ; à ce checkpoint historique, les notifications de complétion Missions player-facing étaient reportées. Elles sont maintenant couvertes par le candidat de l'étape 21 ci-dessus ; Twitch générique et migration legacy R328 restent reportés.
- **Classements et correctifs validés publiquement sur le plan fonctionnel ; R912 approuvé en review, validation publique visuelle en attente.** Le propriétaire confirme écran, données, égalités, confidentialité Public, navigation et métriques avant ces correctifs. La version promue porte 34 métriques en cinq catégories, dont C6 5★/4★/total ; les rangs sont calculés globalement avant pagination de cinq. Le service charge seulement les relations nécessaires à la métrique ; `GET /api/v1/rankings` et `!top` partagent ce calcul. Les Tops globaux restent strictement Public. `CURRENCY_BALANCES` et `BANK` deviennent Public par défaut, les six autres anciens défauts Privé deviennent Amis uniquement ; les overrides explicites restent inchangés. Le raccourci `Profil > Statistiques → Classements` ouvre `#rankings`. Le clic Trade accepté navigue puis archive, tandis que l'agrégat Reçues reste dynamique. Le seul micro-polish des onglets R912 attend sa validation visuelle publique.
- **Historique global validé publiquement sur le plan fonctionnel ; R912 approuvé en review, validation publique visuelle en attente.** La chaîne approuvée comprend `e98374e` (correctifs Classements), `1687cbd` (Historique) et `739607d` (fermeture durable). L'écran unique `#history` comporte Invocations, Bannières, Banque filtrable, Boutique et Event. `GET /api/v1/me/history` ne lit que Bannières et Event ; les trois autres onglets réutilisent leurs routes métier. La migration additive `20260925160000_044_add_banner_generation_vote_snapshot` est présente et déjà appliquée sur DEV : **44 migrations**. Le JSONB nullable conserve d'abord, sur la rotation source, la fermeture durable du pool 5★ et des votes y compris zéro ; une seconde transaction relit ce pool pour générer la suivante et publier son snapshot final. Un échec reprend ce même état fermé. La première rotation sans source et les anciennes sans capture restent à `null` dans l'Historique, sans reconstruction. Les éditions Event terminées sont lues depuis leurs tables métier et exposent le Top final public et le détail personnel du propriétaire. Un prochain snapshot complet R911 reste à observer lors de la rotation naturelle.
- **Contrôles techniques du lot Classements approuvé.** Backend non DB **423/423**, frontend non DB **849/849** avec un worker, tests PostgreSQL isolés Ranking **5/5**, ciblés Ranking/Chat **119/119** et écran Ranking **5/5**, builds frontend/backend, lint réussi avec deux avertissements préexistants dans ContestScreen et `verify:quick` **5/5**. La suite frontend parallèle du lot précédent avait reproduit le timeout intermittent de ChatPanel ; ChatPanel isolé **63/63**, puis suite complète avec un worker **849/849**. Le contrôle visuel local antérieur tenté avec un harnais Edge incomplet ne permet pas de conclure sur le `GameShell` réel ; la validation visuelle/mobile publique reste à faire. Aucun déploiement Railway/Cloudflare ni healthcheck n'est revendiqué à ce stade.
- **Contrôles du lot Statistiques avant promotion.** Tests ciblés frontend **8/8** et backend **110/110**, suites complètes non-DB frontend **843/843** et backend **410/410**, suite PostgreSQL Social/Profil **9/9**, builds frontend/backend et `verify:quick` **5/5** exécutés localement sur le candidat approuvé `631da2827f69fdf7f059edc01b4031387f92f008`. Un harnais temporaire avec le vrai `ProfileScreen`, les CSS de production et la géométrie du shell a été vérifié sous Edge à **1920×1080, 1366×768 et 390×844** : quatre groupes présents, `Non disponible` visible dans le DOM, aucune valeur coupée ni débordement horizontal mesuré. La validation publique fonctionnelle d'Axel est désormais rapportée ; ce lot n'a pas revérifié séparément Railway, Cloudflare Pages ni le healthcheck.
- **R898 MP promue et validée publiquement.** Le propriétaire confirme réponse à autrui, réponse à soi, aperçus dynamiques et contexte dans l'Historique et le signalement. La migration additive 043, présente sur `main` et appliquée sur DEV, porte les réponses persistantes dans une même conversation ; liste, fil récent, historique, recherche et preuves de signalement projettent leur contexte selon le contrat dynamique/figé.
- **Sécurisation frontend des fins d'envoi MP promue et validée publiquement.** Une génération de session invalide les effets tardifs sur brouillon, réponse, navigation et focus après changement de conversation, de vue, d'onglet ou de Player, y compris lors d'un aller-retour. Un échec tardif reste récupérable explicitement dans sa conversation d'origine avec sa clé de retry ; une initiation tardive ne sélectionne plus son résultat après sortie du parcours. Aucun changement backend ni migration supplémentaire.
- **Polish MP et derniers correctifs promus et validés publiquement ; cycle complet clos.** Dans une conversation existante, l'envoi actif libère immédiatement le composer et son focus. Une seule intention suivante peut attendre, texte et réponse visibles dans un composer grisé ; elle garde sa clé UUID et ne démarre qu'après succès du précédent. Pendant cette attente, les actions Répondre sont désactivées et la cible capturée ne peut pas changer. Un échec libère cette intention comme brouillon éditable, garde l'envoi échoué récupérable avec sa clé et ne lance aucun envoi automatique. La navigation invalide la queue et la rend récupérable uniquement à l'origine. Le propriétaire confirme sur téléphone réel le vertical MP, l'ouverture sur les messages récents, le scroll tactile haut/bas et le composer visible ; il confirme aussi M1→M2 queued→M3, la réponse et sa cible gelée, les actions sur messages longs, la confirmation Supprimer auto-scrollée et le comportement général desktop/mobile. Le dernier test public confirme le focus immédiat après réactivation du composer lors de queued→active pendant que M2 reste réseau-pending, ainsi que la géométrie naturelle des bulles sans réserve permanente pour les actions. Aucun défaut MP connu ne reste ouvert dans ce cycle.
- **Contrôles locaux du polish MP promu.** Après correction queue/reply et vertical mobile, `DirectMessagePanel` 73/73 et frontend complet 840/840 sur 91 fichiers, build (incluant typecheck) et lint réussissent ; seuls deux avertissements lint préexistants dans `ContestScreen`, l'avertissement de taille du bundle et les journaux `ECONNREFUSED` non bloquants de la suite frontend subsistent. Le premier lancement de la suite complète du lot initial en parallèle du build avait eu un timeout Chat inchangé ; `ChatPanel` isolé 63/63 puis suite complète seule 837/837 avaient été verts. Le harness temporaire du lot initial avec vrai composant React et CSS de production avait vérifié sous Edge/Chromium à 2560×1440, 1920×1080, 1366×768 et 390×844 les actions internes, l'absence de débordement horizontal, la confirmation visible, le composer queued avec réponse et le focus après promotion. Le correctif mobile a ensuite été vérifié sous Edge avec le vrai GameShell et les composants Chat/MP, API simulée et CSS de production à 390×844, 360×800 et 1920×1080 : ouverture au bas, scroll du fil dans les deux sens, composer et confirmation de suppression visibles, M1/M2 queued visible ; un viewport réduit à 390×500 conserve le composer. Ce contrôle local précédait le test tactile réel désormais rapporté par le propriétaire. Harness et captures exclus du commit. Aucun test DB n'a été exécuté pour ce diff frontend seul.
- **Contrôles locaux des deux derniers correctifs MP.** Régression focus reproduite rouge puis corrigée ; tests `DirectMessagePanel` et helper reply **76/76**, `verify:quick` **5/5** (typechecks frontend/backend, lint, diff-checks). Sous Edge avec vrai GameShell, composants Chat/MP, CSS de production et API simulée à 1920×1080 et 390×844, les bulles `t` restent naturelles avec overlay ouvert ou fermé ; l'overlay reste dans le panneau et le tap tactile révèle puis active l'action. Après succès de M1, M2 reste réseau-pending pendant que le composer est déjà focus et accepte M3. La review indépendante du commit `88e2b5c` est approuvée ; ce contrôle technique ne vaut pas test public des deux corrections. Aucun test DB ni migration.
- **Outillage Codex approuvé, promu et actif.** Guide actualisé alors pour GPT-6 Sol (préférence actuelle : voir Guide) et niveaux de réflexion ; lectures et sorties terminal ciblées ; validations proportionnées ; trois Skills repo ; scripts `verify:quick`/`verify:full` non-DB ; note locale `TASK_STATE.md` ignorée et template suivi ; sessions Codex bornées par tâche. `verify:quick` passe 5/5 étapes et `verify:full` 8/8, avec frontend 837/837 et backend non-DB 408/408. RTK 0.48.0 a été évalué sur Windows : sorties brutes/filtrées en octets `git status` 30/461 (avertissement sans hook), `git diff` 381/380, `rg` 1 318/1 318, test verbose via `rtk npx` 11 280/11 273 ; `rtk test` réduit ce test vert à 190 octets mais omet le message essentiel d'un échec « aucun fichier de test ». Le binaire d'essai a donc été désinstallé et aucune intégration Codex globale/projet n'a été activée ; QMD et Caveman ne sont pas installés par ce lot. Le validateur Python des Skills n'est pas disponible localement ; leurs trois fichiers et frontmatters sont contrôlés directement.
- **Contrôles de cette sécurisation.** Le test de régression a d'abord reproduit la fuite du brouillon A vers B. Après correction, `DirectMessagePanel` et le helper de preview passent ensemble **65/65** ; A→B, A→B→A, succès et échecs tardifs, initiation tardive, intention plus récente, retry exact et focus sont couverts. Typecheck frontend, build et lint passent ; les deux avertissements lint historiques de `ContestScreen` et l'avertissement de taille du bundle restent. Aucune campagne DB n'était nécessaire à ce diff frontend ; la validation publique du cycle MP est désormais acquise.
- **Contrôles du correctif MP R898.** Frontend complet 824/824 sur 91 fichiers et backend complet 408/408 sur 57 fichiers ; ciblés frontend API/composant/projections 80/80, routes MP/report 5/5, PostgreSQL MP 15/15 et rapports MP 7/7. Builds frontend/backend, typecheck serveur, lint, validation/statut Prisma et `git diff --check` réussissent ; le lint conserve uniquement les deux avertissements préexistants de `ContestScreen` et la suite frontend journalise ses ECONNREFUSED localhost:3000 connus sans échec. Un premier lancement frontend complet en parallèle du backend a dépassé le timeout de deux tests Chat inchangés ; le fichier Chat isolé 63/63 puis la suite frontend complète seule 824/824 les ont confirmés. DEV est à 43 migrations appliquées et les schémas/Players fixtures résiduels du lot sont nuls. Le responsive des nouveaux accessoires est borné par le CSS de production et ses contrats composant desktop/mobile ; la validation publique R898 et MP est désormais acquise.
- **Lot 1 validé publiquement.** Le checkpoint `a46f23f8351e8df09fdffdca9851f2d15bc8523b` était identique sur `main` et `review` ; Cloudflare Pages et Railway étaient `SUCCESS`, Railway journalisait `Application ready`, `/health` répondait HTTP 200 et du trafic réel répondait 200. Le propriétaire a confirmé compte existant, navigation/rechargement, nouveau Player, absence de crédit/notification prématurés, Missions indisponibles et `!mission` indisponible.
- **Lot 2 validé publiquement.** Le premier message du compte de test public a exécuté R301 avec marqueur renseigné, 19 progressions `COMPLETED`, 19 opérations `permanent-mission.reward`, une seule opération `permanent-mission.standalone-catchup` et les récompenses historiques en `SYSTEM / STANDALONE_CATCHUP` ; le wallet observé après rattrapage était de 809 655 Primogemmes. Après le second message, `countedMessages = 212` sans second catch-up ni second paiement historique. Le propriétaire confirme le premier rattrapage, l’exactly-once du second message, l’absence de régression Banque/navigation, l’invisibilité attendue de Missions et l’indisponibilité attendue de `!mission`.
- **Pagination/loaders validés publiquement ; bootstrap stable et publiquement acceptable.** Le propriétaire confirme la stabilité des historiques Banque/Gacha, l’absence de clignotement des boutons et un chargement fonctionnel sans blocage majeur. Une latence résiduelle reste connue mais non bloquante : le bootstrap n’est ni déclaré instantané ni entièrement optimisé. Aucun nouveau P2028 de bootstrap utilisateur n’a été observé sur le nouveau conteneur ; le P2028 vu pendant le déploiement appartenait à l’ancien conteneur en SIGTERM.
- **Optimisation bootstrap promue et publiquement acceptable.** Notifications retourne aussi la projection Expedition qu’il vient de réconcilier ; le frontend conserve un fallback vers le GET autonome pendant un déploiement roulant. Après Notifications, la voie à verrou Player reste ordonnée `Expedition` de fallback → Teams → Event, tandis que Défi quotidien, Combat quotidien, Boss mensuel et Concours s’exécutent en parallèle. Dans Notifications, Expedition précède toujours les réconciliations ; Codes cadeaux peut ensuite progresser en parallèle d’une voie Event où messages puis cycle de vie restent séquentiels. Le timer Expedition READY recharge seulement Notifications. Aucun timeout n’est augmenté et les endpoints individuels restent autonomes.
- **Mesures locales comparables du bootstrap promu.** Sur le même processus local et la même base DEV, quatre lectures Notifications avant modification donnaient 869–934 ms et après modification 557–723 ms ; ce profil exclut HTTP/auth/réseau. Un harnais déterministe utilisant les mêmes délais par reader donne 1 688–1 718 ms avec l’ancien ordonnanceur contre 964–975 ms avec le nouveau. Ces mesures restent des repères techniques et ne contredisent pas la latence résiduelle observée publiquement.
- **Lot 3 Missions promu et validé publiquement.** Expedition a fait passer `totalCompleted` de 11 à 12 sur un claim UI de 30 000 Moras, avec une seule opération/mouvement et sans récompense Mission parasite ; la progression S observée est 12/30. Combat AUTO a fait passer `totalWins` de 13 à 14 sans modifier `totalManualWins = 6`. Social UI a fait passer `totalFriendHeartsSent` de 28 à 29 ; le destinataire a reçu +5 Primogemmes sans catch-up R301 passif. Les canaux et opérations déclenchantes réels ont été vérifiés en base.
- **Lot 4 Missions promu et validé publiquement.** Le propriétaire confirme l’écran `Activités > Missions`, les rangs B/A/S, les progressions/récompenses, le secret Z verrouillé, le changement de rang et le responsive. Après cette consultation, la base conservait exactement une opération `permanent-mission.standalone-catchup`, 19 opérations historiques `permanent-mission.reward` et le marqueur R301 inchangé : l’ouverture n’a rejoué aucun rattrapage.
- **Lot 5 Missions promu et validé publiquement.** À chaque nouvelle entrée, Activités et Profil choisissent B, A, S puis Z selon le premier rang dont un statut serveur n’est pas `COMPLETED`; un clic manuel reste local au montage. Les cartes sont partitionnées stablement non terminées puis terminées. `!mission [B|A|S|Z]` et l’alias non documenté `resume` consomment la projection personnelle canonique ; le résumé agrège le Défi propriétaire et B/A/S/Z, tandis que le pipeline `GAME_RESULT` existant découpe les longues réponses. Le Profil charge paresseusement sa rubrique Missions : le propriétaire utilise `/me/missions`, un tiers utilise `/players/:playerId/missions`, contrôlé par Privacy `MISSIONS` et strictement projectif, sans R301 passif.
- **Contrôles du Lot 5 avant promotion.** Backend complet 408/408 sur 57 fichiers et frontend complet 819/819 sur 90 fichiers ; ciblés PostgreSQL Missions 15/15, Social/Privacy 17/17 et Global Chat 28/28. Typechecks, builds frontend/backend, lint, `git diff --check`, validation/statut Prisma réussissent ; le lint conserve uniquement les deux avertissements préexistants de `ContestScreen`. Les composants réels et leur CSS de production sont contrôlés sous Chromium à 2560×1440, 1920×1080, 1366×768 et 390×844 pour Activités, Profil propriétaire, tiers public/privé et Z verrouillé, sans overflow horizontal du document. Les fixtures Missions et schémas `batch_test_*` résiduels sont nuls. À ce checkpoint initial, Prisma comptait 42 migrations sans 043 ; le correctif MP distinct porte désormais le dépôt et DEV à 43.
- **Correctif responsive Boutique `7106f39` validé publiquement.** Cloudflare Pages et Railway sont `SUCCESS`. Le propriétaire confirme le résultat réel à 2560×1440 et 1920×1080 : bouton Ticket entièrement visible, cartes harmonieuses, prix et boutons correctement positionnés. Quantité, probabilités, prix et logique d’achat restent inchangés.
- **Contrôles et review indépendante du Lot 4 approuvés.** Frontend complet 807/807 sur 89 fichiers et backend complet 400/400 sur 57 fichiers ; ciblés Missions frontend, routes 4/4 et PostgreSQL Missions 13/13 réussissent. Builds frontend/backend, typecheck serveur, validation/statut Prisma et lint réussissent ; le lint conserve uniquement les deux avertissements préexistants de `ContestScreen`. Le vrai composant avec CSS de production est contrôlé sous Chromium à 2560×1440, 1920×1080, 1366×768 et au contrat mobile 390×844, avec B/A, Z verrouillé/déverrouillé, grands nombres et scroll. Les fixtures Missions et schémas `batch_test_*` résiduels sont nuls. Prisma reste à 42 migrations suivies et appliquées, sans 043.
- **Migrations 041–042 appliquées et suivies sur DEV.** La 041 conserve le catalogue et les progressions sans crédit SQL. `20260924213000_042_add_permanent_mission_catchup_marker` ajoute seulement `standalone_catchup_completed_at` et sa contrainte chronologique : aucun wallet, mouvement, état `COMPLETED`, import legacy ou rattrapage n’est écrit par SQL. Les 42 dossiers Prisma et le registre sont alignés.
- **Moteur Lot 2 borné et transactionnel.** `reconcileMetrics` ne relit que les agrégats autoritatifs demandés par le producteur, tout en conservant la cascade B→A→S et le déblocage Z cohérent. Economy ne raccorde que Moras et particules principales ; Gacha regroupe sa réconciliation après l’état final du Pull. Les récompenses Missions passent par Economy avec une garde interne explicite qui interdit la récursion Economy → Missions → Economy.
- **Rattrapage R301 prêt, jamais lancé en bulk pendant le développement ou la promotion.** À la première activation normale ou première ouverture personnelle des Missions d’un standalone préexistant, une opération SYSTEM dédiée exécute le vrai moteur, lie les récompenses historiques à cette opération, puis écrit le marqueur dans la même transaction. Verrou Player, marqueur durable et opérations stables assurent l’exactly-once ; rollback annule ensemble marqueur et récompenses. Le scheduler Banque ne déclenche ce rattrapage qu’avant un premier intérêt strictement positif : son démarrage, l’absence de jour à traiter et les journées à intérêt nul restent neutres pour les Missions. Les nouveaux Players sont marqués dès leur provisionnement. Aucun UUID réel n’a été réconcilié manuellement ni crédité par un script.
- **Contrôles du Lot 2 approuvé, promu puis validé publiquement.** La review indépendante a approuvé les commits fonctionnels et leur correctif Banque. Backend 394/394, PostgreSQL Missions 11/11, Chat 27/27, Gacha 23/23, Stella 6/6 et Banque 9/9 ; typecheck, build serveur, lint et statut Prisma réussissent. Le lint conserve uniquement les deux avertissements préexistants de `ContestScreen`. L’état DEV pré-promotion était neutre ; le seul rattrapage réel désormais consigné est celui du test public ci-dessus, déclenché par l’action normale du propriétaire et vérifié en base après le test.
- **Lot A promu et validé publiquement.** R894 fixe le verrou long à exactement trois secondes après M3, frontend et backend ; R897 sépare ce verrou visuel de la sécurité transport, réactive automatiquement le composer et restaure focus/caret sans voler un focus volontaire. R891, R894 révisée, R895, R896 et R897 révisée sont **VALIDÉES PUBLIQUEMENT**.
- **Backend/DB MP 036–040 et 043 sur main.** Les migrations 036–039 portent conversations, participants, demandes, messages, lecture partagée et ordre serveur ; la 040 ajoute uniquement le dossier privé `direct_message_reports`. La 043 ajoute l'auto-référence nullable des réponses MP, sans backfill ni copie de contenu ; elle a été appliquée sur DEV au checkpoint MP, alors à 43 migrations Prisma suivies. `DirectMessageService` projette `canSend` et `blockedByMe` depuis les mêmes règles PUBLIC/FRIENDS/PRIVATE/blocages que l'envoi. Le blocage archive physiquement les deux participants ; le déblocage partagé retire seulement le blocage de l'acteur, ne restaure ni amitié ni archives. Un nouvel envoi autorisé désarchive les deux côtés. Le socle Missions 041 est également présent sur `main`, sans modifier ces comportements Chat/MP.
- **Chat global — état public réconcilié.** R890 à R897, dans leur état courant révisé, sont validées publiquement. Les protections 750 ms, fenêtre de détection `< 4 000 ms`, verrou visible de trois secondes, garde 10/10 secondes, timestamp après verrou Player, sécurité transport distincte et restauration focus/caret sont acquises.
- **MP — R896 validée publiquement.** Recherche destinataire, sélection Player, deep-link, hint exact, tabs centrés, optimistic et navigation sont acquis.
- **MP avancés — R504/R513/R514 validés publiquement.** Actions hover/tactile, édition Enter/Ctrl/Meta+Enter/IME/outside/Escape, suppression avec fermeture immédiate de sa confirmation, restauration, statuts, accusés Lu, scroll éditeur et fermeture instantanée de l'éditeur après Entrée/Sauvegarder sont acquis. La fenêtre/purge R504 reste strictement inchangée.
- **R515 — VALIDÉE PUBLIQUEMENT.** `Historique complet` est une vue interne séparée du fil live borné à 500 : cache éphémère isolé, scroll keyset `submissionOrder` ancien/récent/autour, recherche PostgreSQL case-insensitive excluant tous les tombstones, date locale vers ancre serveur, highlight et actions auteur partagées avec `canRestore`. Les GET participant-only ne marquent rien lu et restent accessibles en lecture seule/blocage.
- **R509/R510/R517 — VALIDÉES PUBLIQUEMENT dans leur contrat final.** Le signalement depuis le fil live ou R515 crée un dossier privé sans notification immédiate ni free-browse. Le reporter voit exactement précédent/cible/suivant, la cible jaune/or et l'information qu'un contexte plus large est transmis ; la modération conserve la preuve complète 10/1/10, son fingerprint et le contrôle stale. Le footer reste visible. MODERATOR/ADMIN peuvent supprimer après confirmation le seul dossier `direct_message_reports`, avec audit sans contenu privé et sans effet sur MP, conversation, notifications, blocages ou amitiés.
- **Dernier polish Chat/MP — VALIDÉ PUBLIQUEMENT.** La liste Conversations/Archives réutilise le menu `⋯` du header sans lecture implicite ; le feedback succès/doublon dure exactement trois secondes ; les états enabled/disabled de Communauté sont explicites. Le menu partagé, la confirmation et la suppression du dossier ont été validés dans la liste et le détail. Aucun défaut Chat/MP ne reste ouvert.
- **Checkpoint public fonctionnel.** `dfe434b225c4e20a2cc649870e81a3a94b8c8685` est le HEAD public fonctionnel avant le présent commit documentaire ; le polish fonctionnel est `a30ce31595dcb0bc9527943d89c028c465d27b8c` (`fix: finalize private message reporting polish`). Railway est `SUCCESS`, le log contient `Application ready`, `/health` réussit et le propriétaire a validé publiquement le résultat réel.
- Référence PRODUIT publiquement testée : `c90d7aeb7ad8f1f4f7349644eeeaf33d86021191`. Ce checkpoint contient le dernier micro-polish Event réel et a été validé publiquement par le propriétaire.
- Le checkpoint documentaire Chat global R872–R883, incluant la correction R460, part de `e662ac7b62f71abc2be6096705804de2cd08456c`. La chaîne Lot 1 `f334be4` puis `4d2a473` a été reviewée indépendamment, promue sur `main` et déployée. ChatGPT a vérifié sur `2b8c50c` Cloudflare Pages `SUCCESS`, Railway `SUCCESS`, `Application ready` et `/health` réussi. Les migrations 032 + 033 et `GlobalChatService` forment le socle serveur/DB. Le lot est invisible au joueur, donc aucune validation publique fonctionnelle n'est requise. Batch C / Social demeure validé ; Noël naturel reste à observer en décembre.
- Échanges de particules et leurs corrections/polish sont **CLÔTURÉS PUBLIQUEMENT**. Création, réception, envoi, historique, stocks Total/Réservé/Disponible, recherche partenaires et fraîcheur après mutation, acceptation/refus/annulation/actions groupées, notifications PENDING et TRADE_ACCEPTED, accès depuis Conversion/Profil, performances et correction des faux échecs sont acquis et validés publiquement par le propriétaire. Les corrections Social, sidebar et Panier réalisées dans ce cycle sont également acquises. Le commit parallèle Story `1a0fca5` reste intact dans l'historique.
- Le micro-polish Event final promu dans `c90d7ae` est **VALIDÉ PUBLIQUEMENT** : Récolte, Grenier et Panier ne répètent plus leur nom en grand titre ; la frise des paliers se rétracte et se rouvre, conserve le total de points visible, remonte le contenu inférieur et mémorise une préférence indépendante par Player après navigation et rechargement. Aucun blocker ne reste dans ce cycle.
- Base DEV : migrations 036–044 appliquées via `prisma migrate deploy` ; **44 migrations Prisma** suivies. La 044 ajoute uniquement le snapshot JSONB nullable de génération Bannières. `prisma migrate dev --create-only` échoue historiquement sur la migration 010 dans la base shadow (fixture Boutique avant le seed Moras) ; la 044 a été rédigée comme migration additive ciblée, puis appliquée avec `migrate deploy`. `prisma validate`, `migrate status` et la comparaison du checksum local avec `_prisma_migrations` sont verts ; une ligne terminée, aucune annulation.
- **Contrôles pré-promotion Historique / R911.** Après les correctifs de fermeture durable, backend complet **429/429**, frontend complet **854/854** avec `--testTimeout 15000`, PostgreSQL isolé History/Banner votes **7/7**. Le délai par défaut de 5 s a expiré sur un test `ChatPanel` hors périmètre ; ce test isolé et la suite complète passent avec 15 s. Les contrôles antérieurs Banque **9/9** et Boutique **9/9** restent consignés. Builds frontend/backend, lint racine (seuls les avertissements déjà connus de ContestScreen et RankingsScreen), lint serveur, `prisma validate`, `migrate status` (**44 migrations**) et `verify:quick` **5/5** réussis. Le contrôle visuel antérieur du vrai `HistoryScreen` avec les CSS de production documentait les cinq onglets, les snapshots présent/indisponible et le Top Event, sans débordement horizontal à **390×844, 1366×768, 1920×1080 et 2560×1440** ; il n'a pas été répété dans ce correctif. Ce contrôle n'est pas une validation dans une session authentifiée du vrai `GameShell` ; aucune validation publique n'est revendiquée.
- Validation technique du socle et du dernier polish : frontend **784/784 sur 85 fichiers**, dont `ChatPanel` **63/63**, `DirectMessagePanel` **54/54** et `ModerationScreen` **13/13** ; backend **392/392 sur 55 fichiers** ; routes report **2/2** ; PostgreSQL report **7/7** et PostgreSQL Chat **26/26** isolés. Builds frontend/backend et typecheck serveur réussissent ; le lint conserve seulement deux avertissements préexistants dans `ContestScreen`, et le diff-check est propre. La campagne PostgreSQL générale parallèle n'est pas relancée dans ce polish ; son dernier résultat reste **262/289** avec 27 échecs dus au client `pg` partagé et à la dette historique du smoke exhaustif : cette dette historique n'est pas un gate vert et reste distincte des suites Chat/MP ciblées réussies. Le vrai `GameShell`, les panneaux réels et les CSS de production ont été contrôlés à **2560×1440, 1920×1080, 1366×768 et 390×844** : preview de trois cartes, cible jaune, footer visible, feedback, menu de liste, liste/confirmation/détail Communauté. Les mesures Chromium donnent `scrollWidth = innerWidth` aux quatre tailles ; le footer mobile finit à 618,5 px dans un viewport de 844 px. Ces preuves techniques sont désormais complétées par la validation publique du propriétaire.
- `PAID_INFRA_APPROVED = false`.
- Activité transverse : `PlayerActivityRecorder` écrit atomiquement l'activité réelle de présence, les actions Amitié effectives et Game C réussi. Aucun GET, heartbeat technique, replay, scheduler ou destinataire passif ne produit d'activité. Les futurs domaines disposent de ce propriétaire réutilisable ; les autres domaines gameplay ne sont pas tous nouvellement branchés dans ce lot.
- Nettoyage DEV terminé : uniquement `Codex Event 2f5fb3ad` et `Sender5 090faef4`, après inspection des FK et dépendances ; détail et UUID au checkpoint ci-dessous. Comptes protégés intacts, aucun import/reset.
- Historique Chat global — le cadrage produit reste validé dans [R872–R888](../specifications/global-chat-v1.md) et le [journal](../specifications/decisions-log.md). Le Lot 1 promu matérialise les tables Chat global/read state et `GlobalChatService` : envoi joueur idempotent, totalMessages, XP/countedMessages selon élément standalone valide et cooldown, activité, anti-rafale, réponses relationnelles, lecture cursorisée, non-lus, marquage monotone et suppression auteur. La correction garantit qu’un Player valide à 0 XP reçoit son premier gain ; le cas défensif sans élément ne reçoit pas d’XP. L'orchestrateur serveur de commandes a été reviewé indépendamment et approuvé : il persiste les réponses publiques `GAME_RESULT` (en plusieurs parties atomiques au-delà de 500 caractères), réutilise les services métier et leur idempotence, et expose le registre à `!help`.
- Commandes physiquement branchées : `help`, `element` (choix défensif), `banniere`, `select`, `vote`, `pity`, `pull` (1..10), `obtention`, `stella`, `passifs`, `roue`, `ami`, `echanger`, `infos`, `liste`, `banque`, `convertir`, `sac`, `coffre`, `shop`, `code`, `event` complet (inscription, état, boutique, classement, conversions, Collection, calendrier, jeux A/B/C), `expedition` (état, départ, retour), `combat` (quotidien, Auto, matrice, statistiques, Boss et attaques), `quotis`. Révision R884 : `!concours` consulte seulement la projection du Concours standalone ; toutes ses actions Chat sont retirées, sans changer le domaine Concours. `echanger`, `combat`, `expedition`, `ami` et les autres commandes KEEP restent sur leurs services et états standalone. `box` expose désormais les listes/filtres/pages/favoris/tris textuels R1037 ; `team` reste une consultation synthétique sans sous-commandes historiques ; `!echanger annuler` sans pseudo exige une demande unique car `TradeService` ne propose pas d'annulation globale. `top` lit le classement global physique ; `legende` attend un service adapté ; `mission` et `faveur` attendent leur domaine. `giveaway` et `wish` restent Twitch uniquement. Le Chat global navigateur et son API sont physiques et validés publiquement ; les fondations et l'UI MP player-facing sont sur main, tandis que Twitch et Realtime restent absents. Aucun `!mp` n'est ajouté. Les réponses privées de commandes, annonces globales automatiques et extension générale UI → Chat restent reportées au polish final ; R633/R634 sont matérialisées dans le lot Historique global promu sur main.
- Validation automatisée de la révision R884 : 378 tests backend sur 51 fichiers, typecheck, build et lint ciblé réussis. Suites PostgreSQL exécutées séparément et réussies : Chat (13), Gacha (23), Roue (1), Combat quotidien (8), Boss (8), Social (8), Échanges (21), Expédition (9), Event de base (8), Boutique Event (6), Classement Event (1), Jeu B (7), Jeu C (7, dont le passage réel Chat → EventService), Calendrier Event (5). La suite PostgreSQL Concours complète n'a pas été relancée dans ce lot : au checkpoint précédent sur DEV partagée, elle ne passait pas (11/25), avec un scénario de salon reproduit seul et deux Concours terminés préexistants contrariant l'attente d'historique isolé. Seule la frontière de lecture `!concours` est vérifiée ici ; le domaine Concours n'est pas déclaré validé. **Historique R884 :** aucune migration nouvelle n'était alors ajoutée et DEV comptait 33 migrations. **État courant :** la migration Gacha 044 est également appliquée sur DEV, avec 44 migrations suivies.
- Le cycle Chat/MP complet est **PROMU ET VALIDÉ PUBLIQUEMENT** : R890–R898 et R504–R517 sont acquis, avec réponses persistantes, Historique, signalement, sécurisation des fins d'envoi, queue séquentielle, focus et responsive MP. Le propriétaire a confirmé le dernier correctif `88e2b5c` sur le focus queued→active et la géométrie des bulles. Aucun défaut MP connu ne reste ouvert dans ce cycle.
- Lire [le workflow](../process/implementation-workflow.md), [le contrat Chat global](../specifications/global-chat-v1.md), [l'audit Social pour les MP](../legacy/14-ami-social-audit.md), [la navigation](../specifications/navigation-shell-v1.md) et le checkpoint ci-dessous. Les checkpoints antérieurs sont historiques et ne constituent pas une prochaine étape encore active.
- Historique de reprise du pilote avant la promotion actuelle : **TwitchIdentity / pilote Kichnifou était candidat `review`, sans validation publique**. Axel a confirmé publiquement les derniers correctifs Modération, Sidebar et Chat (alignement/cadrage et disparition des lueurs). La validation visuelle R912 et Menu reste distincte, et R911 doit encore être observé lors d'une rotation naturelle. La vérification DEV de ce checkpoint antérieur comptait **49 migrations Prisma appliquées** ; 049 est enregistrée et ses quatre tables backend ont RLS active, sans lecture `anon` ou `authenticated`.
- Historique du pilote : le code du pilote lie une identité Twitch par OIDC vérifié et permet la prévisualisation de la copie ignorée des 17 JSON. Son dry-run Kichnifou en lecture seule sur le hash `1852d7141a121c335c5928a8265c20e840e5c5dd20ccee12b054b99f780806ba` trouvait **14 domaines personnels physiques importables, 9 domaines globaux ou interjoueurs différés, 2 domaines sans cible et 0 ambiguïté bloquante** ; [la matrice historique](../architecture/twitch-pilot-mapping.md) en donne les sources et règles. **Aucun import du Player public n'a été lancé**, aucune liaison Twitch publique n'a été créée, et la validation publique du pilote reste à faire. La source Streamer.bot vivante demeure autoritaire jusqu'au cutover, même si ses fichiers changent après la copie figée. Le socle global courant est décrit au début de cette reprise. `PAID_INFRA_APPROVED = false`.

---

# 0. RÈGLE D'OR DU PROJET

## Candidat — correctifs après second test public, 2026-09-21

- Départ vérifié : branche review, main = review = `661f87acc958046e60257382ec19256767c16a96`, divergence 0/0, worktree propre. Le propriétaire confirme ce SHA promu, Cloudflare SUCCESS, Railway SUCCESS et healthcheck 200. Ces déploiements sont rapportés par lui, pas revérifiés dans ce lot.
- Commits du candidat : `e6e5858703138a357e41d27f4427605cffb19e0c` (interface, parent 661f87a) → `268a46db280bd6691ebe06ce1e87555100cda8ae` (notification d'acceptation) → `fafb7b254e6edc186300a1d923b8745ce4342303` (checkpoint) → `9716cbcd7bcef0cf0462c7a7b3c0ed4fd5a30a52` (fraîcheur Partenaires). La review indépendante ChatGPT est **APPROUVÉE** et la promotion dédiée est autorisée dans cette mission ; la version corrigée reste à tester publiquement après déploiement.
- **Validé publiquement dans cette passe** : ouverture Échanges améliorée, envoi de demande, accès depuis Conversion/Profil, envoi global des cœurs, Joueurs connectés, notification Trade vers Reçues et notifications globales sans nouveau défaut remonté.
- **Retours encore ouverts à validation publique** : composition Partenaires, nouvelle notification d'acceptation, boutons Conversion, Panier/sélection Player, Convertir en sidebar, clic intégral Profil/Objectif, viewport et ligne filtres/cœurs Social, libellé pending Expédition. Les correctifs locaux ci-dessous ne clôturent pas le vertical. Chat global + MP attend cette clôture.
- Expédition : l'action start/claim déclenchée est transmise à la modale ; READY → clic Récupérer → publication IDLE → refresh Notifications encore pending conserve `Récupération…`, jamais `Départ…`.
- Partenaires : recherche, quantité, MAX et Envoyer sur une ligne desktop, wrap mobile ; largeur visuelle quantité d'environ dix chiffres, sans plafond métier ajouté. Suggestions et liste remplissent le champ avec le displayName, sans caption ni ancien texte d'aide. Retaper invalide la sélection. Debounce 120 ms, annulation dès nouvelle saisie, latest-wins, erreurs d'annulation silencieuses, aucun fetch hors onglet ; polling/focus ne concurrence ni debounce ni requête. Une mutation confirmée annule/invalide une lecture antérieure et déclenche une projection fraîche seulement sur Partenaires.
- Coût serveur partenaires inspecté : lectures déjà groupées (acteur, joueurs, paires pending, soldes, réservations), sans requête par candidat ; verrou/expiration transactionnels conservés. La normalisation de la requête est calculée une fois par lecture. Aucun gain de latence publique chiffré ni refonte de pagination/stock/concurrence revendiqué.
- **R24 révisée explicitement, puis cycle de clic R909** : acceptation commitée = une TRADE_ACCEPTED à l'expéditeur, clé `trade-accepted:<requestId>`, destination Historique et archive après navigation. Aucune pour l'accepteur, les replays ou autres résolutions. Transfert/exécution/notification atomiques ; Accept All notifie chaque acceptation réelle seulement. R19 reste l'agrégat PENDING, diminué/résolu immédiatement après annulation par l'expéditeur et non archivé automatiquement.
- Panier : recherche rapide inline à 120 ms protégée des réponses obsolètes ; destinataire stable ; navigateur Player partagé intégral, filtres Event publics et pagination, sans Testeur ni mode searchOnly. Conversion : CTA principal/secondaire de même géométrie. Sidebar : collision CSS de Convertir supprimée ; Profil/Objectif utilisent le parent accessible, les contrôles internes ne doublent pas l'action.
- Social : recherche/tri/cœurs alignés à 39 px desktop ; listes Amis/Demandes/Joueurs dans le body bordé, arrondi, rembourré et propriétaire du scroll. Marge de focus préserve la première carte. Mobile conserve le flux naturel prévu par le contrat UI, sans scrollbar imbriquée.
- Validation : **652 tests frontend / 82 fichiers**, **274 tests backend / 49 fichiers**, **21 scénarios PostgreSQL Échanges** réussis sur schéma isolé (dont rollback après création de notification, cancel, accept, replays et Accept All). Ciblés frontend 152 et backend Notifications/scheduler 6 réussis ; le métier Trade est exercé par la suite DB réelle. Builds frontend/backend, typecheck backend, lint et diff-check contrôlés. Les deux warnings ContestScreen et les bruits mocks localhost:3000 restent préexistants.
- Contrôle Edge/Chromium local dans le vrai GameShell avec CSS de production et données synthétiques : surfaces modifiées parcourues à **1920×1080, 1366×768, 390×844**, sans overflow horizontal ni erreur de page. Contrôles alignés, CTA égaux, navigateur 850 px desktop/370 px mobile, textarea sans déplacement, focus et scroll Social, claim IDLE encore pending vérifiés. **60 clics/claviers** Profil/Objectif couvrent centre, bords, espace vide, texte, watermark, avatar/portrait, titre, Enter et Space. Captures/harness temporaires exclus des commits ; validation publique propriétaire toujours requise.
- Documents : Master, audit R24, decisions-log, navigation, architecture, Guide et workflow alignés. Nouvelle règle durable : après chaque main et vérification Git/déploiements/healthcheck, ChatGPT fournit spontanément **À tester en public**, fondé sur le diff promu, avant validation propriétaire. Contrat UI évalué et inchangé : patterns existants réutilisés. Roadmap, passation, Story, modèle DB et migrations inchangés. Publication uniquement review, sans force-push/rebase/squash.

## Historique — corrections après premier test public, promues dans 661f87a

- Baseline vérifiée : main = review = `41522d5faf63b176647df3f101b8e14593805cf0`, 0/0, worktree propre. Ce lot a depuis été promu dans 661f87a et soumis au second test public décrit au checkpoint courant.
- Chaîne complète du candidat approuvée par la review indépendante ChatGPT jusqu'à `b97929693e59d8abb430efef712de6e7d47e4cd4` : `7757d4b62af76702ad9e097c5ab6fb1f22d2e18d` (serveur, parent baseline) → `a4e3dbdab9c42d90771a0371818883a6f9d95e3c` (frontend) → `ddc86d2eab9da7fe3826a56f705357546b65449f` (checkpoint) → `4b371a53ae2d813536c7dfedf9543473194988dd` (réactivité) → `b97929693e59d8abb430efef712de6e7d47e4cd4` (documentation). Le checkpoint documentaire 661f87a a ensuite été promu et déployé ; le second test public a confirmé les parcours fonctionnels et demandé les nouveaux correctifs décrits ci-dessus.
- Diagnostic : les wrappers Trade/cœurs attendaient Resources après succès ; une erreur de cette lecture pouvait requalifier la mutation en échec. Le résultat confirmé est désormais indépendant des lectures secondaires. Trade publie ses stocks via son snapshot ; les cœurs synchronisent Resources en arrière-plan.
- Inspection serveur : l'envoi global conserve environ treize requêtes par cœur effectivement envoyé (opération, cœur, relation et deux crédits Economy de cinq requêtes), en plus des lectures/verrous communs ; aucun batching risqué des écritures n'est introduit. Le pending n'attend plus les GET Resources/Amitié. Notifications relit Expédition et réconcilie Codes/Event à chaque liste : réduire les lectures fermées de 3 à 15 secondes divise par cinq leur fréquence programmée, sans toucher aux invariants de réconciliation. Les presque dix secondes publiques et les P2028 Railway ne sont pas reproduits ni chronométrés ici ; le gain vérifié porte sur les opérations supprimées, pas sur une promesse de latence réseau.
- Lectures : snapshot Trade indépendant des partenaires, recherche temporisée 250 ms, latest-wins et annulable, ignorée hors Partenaires ; treize requêtes SQL retirées du snapshot à sept éléments grâce à l'agrégation des réservations. Le polling partenaire ne concurrence pas une recherche active. Notifications : polling fermé 15 s, ouvert 3 s, focus/visibilité conservés et GET simultanés mutualisés. Pas de changement des transactions cœur ni des délais serveur.
- UI : notification → Reçues avec refresh, feedback par onglet, stocks repliés, sélection partenaire par recherche/liste ; conversion et profil → Échanges. Panneaux sidebar accessibles, footer Joueurs connectés, destinataire Panier stable avec recherche partagée, paliers récompensés issus des réponses de mutation en séquence via la présentation Level-up.
- Documentation : état public réconcilié, passation ChatGPT déclenchée par annonce explicite, directives durables vérifiées avant publication, économie de contexte sans réduction des preuves. Aucune nouvelle Rxxx ; audits, Story, roadmap et modèle DB inchangés.
- Validation finale : **646 tests frontend / 82 fichiers**, **274 tests backend / 49 fichiers**, **19 scénarios PostgreSQL Échanges** réussis sur schéma isolé. Build frontend, build/typecheck backend, lint et diff-check réussis. Le lint conserve seulement les deux warnings ContestScreen préexistants ; Vite signale toujours la taille du bundle. Certains mocks frontend produisent les `ECONNREFUSED localhost:3000` déjà connus, sans échec de test. Aucune suite DB Amitié/Event ajoutée : leurs services et persistances ne changent pas.
- Preuves comportementales : succès cœur/Trade conservé malgré échec du GET secondaire, pending libéré, aucun replay proposé pour une mutation confirmée ; retry exact ambigu conservé. Partenaires debounced, latest-wins et annulables, absents des lectures hors onglet, frais au focus/retour visible et toutes les 15 secondes sur leur onglet seulement, sans concurrence avec une recherche. Snapshot à trois secondes ; sélection Profil vérifiée sur la réponse serveur. Tests du footer, de la navigation, des notifications et des paliers confirmés sans GET/replay.
- Contrôle local Edge/Chromium dans le vrai GameShell et ses CSS : **24 contrôles, huit surfaces × 1920×1080 / 1366×768 / 390×844**, sans erreur de page ni overflow horizontal. Alignement avatar/boutons, hauteur destinataire Panier (48 px avant/après), focus partenaire visible et scrolls vérifiés : body Échanges 206/742 px à 1366, 517/742 px à 1920 ; Panier 210/440 px à 1366. Les huit surfaces demandées ont été parcourues, sans galerie exhaustive. Harness/captures non committés. Cette preuve technique ne clôture pas la validation publique.
- Documents évalués : navigation et architecture actualisées pour les accès et mécanismes de lecture ; contrat UI inchangé (réutilisation des primitives), decisions-log sans nouvelle décision produit. La chaîne candidate ne contient ni déploiement, migration, force-push, rebase, squash ni modification Story. La promotion et le second test public ont depuis eu lieu sur 661f87a ; ces contrôles historiques ne valident pas les nouveaux correctifs.

## Historique — candidat Échanges de particules V1, désormais promu

- Commits fonctionnels : `f0436ac16455e50ab09ebc2502e8226d9581ec96` (microfix Nouvel ami), puis `5bb29921b5b2d6cbb4c74d602eaa7ee8c2aab209` (Échanges). Chaîne linéaire construite sur le checkpoint public ci-dessous, sans promotion main ni réécriture.
- Vérification interactive dans le GameShell : un changement distant synthétique de stock de 500 à 777 est repris au polling dans la sidebar, puis dans le Sac ; le clic Échanger et le clic de l'agrégat ouvrent Échanges. Serveur visuel temporaire arrêté et harness retiré avant le checkpoint.
- Base fetchée conforme : main = review = `1080ad6ab68d48468dd877e094c82bc3c0b3da25`, divergence 0/0, branche locale review propre. Ce checkpoint public et son polish Social/Profil sont validés par le propriétaire. Le microfix `social / FRIEND_REQUEST_ACCEPTED / OPEN_SOCIAL_FRIENDS` ouvre Amis, conserve son refresh et archive via Notifications ; sa validation publique reste à effectuer après promotion.
- Modèle : TradeRequest / TradeExecution, enum cinq états, CHECK montants/ressources/résolution, paire PENDING non orientée unique, FK restrictives, historique borné à 25 côté UI. Réservé = somme des currentAmount PENDING envoyés ; MAX = minimum des deux disponibilités. Pas de condition d'amitié. Réduction immédiate sans remontée automatique, zéro CANCELLED, expiration au prochain minuit Paris.
- Économie : transactions SERIALIZABLE, retry collisions/deadlocks, verrous Player/solde déterministes et BusinessOperation. Quatre mouvements par transfert, Earned/Spent inchangés. Consommation et ajustement Modération passent par le moteur central et respectent les réservations. Accepter/refuser tout mémorise le périmètre initial, chaque demande a sa transaction et sa clé stable ; les succès antérieurs survivent à un échec ultérieur. Activité de l'acteur seulement.
- Notifications : un agrégat par destinataire, compteur courant, nouvelle demande réactivant UNREAD après READ/archive, zéro RESOLVED. Aucune notification individuelle de résolution. Scheduler au démarrage et à minuit Paris, DST 23/25 h, fallback au premier accès et retry après échec.
- UI : destination Menu `trades` / `#trades`, anciennes préférences enrichies avant Configuration, aucune huitième tuile. Sac conserve Convertir et ajoute Échanger sur les particules étrangères possédées. Stocks, recherche/pagination, MAX, reçues/envoyées/actions groupées, historique récent. Polling visible 3 s sans chevauchement ; focus/visibilité/mutation autoritatifs ; particules globales et cache Sac synchronisés, y compris après acceptation distante. Intention ambiguë rejouable sans double clic ni duplication.
- Migration DEV : `20260921100000_031_add_particle_trades`, SHA-256 `8fb071fbfb900354edbf5d70ec706380c3e52dc10f5e82dfbbb720492a19c4b8`. Prisma generate/deploy/status réussis ; 31 registres appliqués, checksums concordants après normalisation des fins de ligne historiques ; tables publiques Trade vides, RLS activée, zéro grant PUBLIC/anon/authenticated. Aucun fichier historique de migration réécrit.
- Validations : **635 tests frontend / 81 fichiers**, **274 tests backend / 49 fichiers**, **18 scénarios PostgreSQL Échanges isolés** réussis. La suite DB couvre aussi débit/crédit et ajustement central Ressources ; les anciennes suites DB écrivant des fixtures publiques n'ont pas été relancées. Builds frontend/backend, typecheck backend, lint et diff-check contrôlés. Les échecs initiaux de fixture/validation décimale et des attentes du Menu ont été corrigés puis retestés.
- Visuel : GameShell complet + CSS réelles, fixtures locales synthétiques à **1920×1080, 1366×768, 390×844** : vide, partenaires, demandes nombreuses/réduites, historique, montants longs, pseudos longs, agrégat et Sac. Aucun overflow horizontal du document ni erreur de page. Scrolls desktop bornés, historique sans second scroll parent, flux mobile ; correction de l'enveloppement des grands soldes dans la sidebar. Harness et captures non committés. Ceci ne remplace pas le test public.
- Isolation : les schémas UUID des tests de ce lot ont été nettoyés. Un ancien schéma Amitié `batch_test_52dd528d05e34d48b687e133bf550040` du 20 septembre a également été retiré après vérification de ses deux seules identités `Ami <UUID>`, de l'absence de session et de FK externe. Aucun compte protégé utilisé, aucun reset/import.
- Warnings : deux warnings lint ContestScreen préexistants et taille du bundle Vite ; logs ECONNREFUSED localhost:3000 dans les mocks frontend sans échec. Advisor sécurité : 89 informations RLS sans politique correspondant au backend-only, dont les deux nouvelles tables ; avertissements existants sur `rls_auto_enable` et protection contre mots de passe compromis inchangés. Pas de service payant ni Realtime.
- Documentation : Master, navigation, modèle V1, schéma PostgreSQL et architecture actualisés. Audit Ressources/Social, decisions-log, roadmap, workflow, Guide, AGENTS et Story inchangés : implémentation de décisions déjà validées. Prochaine étape : review GitHub de ce candidat, puis promotion/test public dédiés ; Chat + MP seulement après validation publique des échanges.

## Historique — candidat Correctifs post-test public Batch C, 2026-09-20 (désormais promu)

- Commits fonctionnels `f3f7624669f14582939cb42dad7f90e4c17f6dbf`, `42a137b`, `d9d84bd` puis `c7b38d3`, parents `ebb4c2e7f8f76053a7f2a8cb8f7f57e2af055660`, `f3f7624669f14582939cb42dad7f90e4c17f6dbf`, `d8905e5` puis `acf29ac`. Le lot part du checkpoint promu et testé publiquement où `origin/main == origin/review`, sans rebase, migration, action DB publique, déploiement ni push `main`.
- Social stabilise ses lignes avec des zones identité, présence et action contraintes. Joueurs expose `Toi`, `Envoyée`, `Ami`, `Accepter` ou `Ajouter`, filtre côté serveur par relation et place les demandes reçues avant les autres résultats. Demandes possède son filtre reçu/envoyé et une mise en avant complète discrète ; Amis intègre le palier, le niveau et les cœurs dans le bloc bleu et sépare `Envoyer un cœur à tous` des filtres.
- Le contrôleur Amitié du GameShell est partagé par Social, Profil, Joueurs connectés et Quotidiennes. Chaque mutation attend sa réponse puis recharge immédiatement le snapshot commun ; les surfaces Social visibles déclenchent aussi ce refresh à l'ouverture, au focus et au retour visible, avec une cadence courte sans requêtes superposées. Le drain autoritatif sérialise les lectures et groupe les demandes apparues pendant la lecture autoritative courante en une unique lecture trailing : aucune réponse obsolète ne peut donc absorber une mutation ou `OPEN_SOCIAL_REQUESTS`. Les succès sont associés à leur surface, effacés après quatre secondes et lors d'un changement d'onglet, d'action, de tri, de filtre ou de sortie. Le message individuel conserve la phrase Ami et seulement les gains `+5 Primos` ; l'envoi global conserve son décompte compact.
- Profil place la présence entre le nom et le niveau, affiche l'icône Élément accessible sans texte redondant et propose ses actions sociales seulement dans Aperçu, avec un contrôle neutre tant que le snapshot Amitié est inconnu. Aucune action vers soi n'est affichée. Joueurs connectés conserve l'ouverture du profil et `Voir tous les joueurs →`, une colonne d'action compacte du même état relationnel et la pastille verte commune dans son résumé quand les données sont réelles.
- La création d'une nouvelle demande matérialise dans la transaction Amitié une notification `social / FRIEND_REQUEST_RECEIVED`, dédupliquée par l'UUID de demande, pour le destinataire seulement. `OPEN_SOCIAL_REQUESTS` ouvre Social > Demandes. Acceptation, refus, annulation ou acceptation réciproque résolvent la notification ; replay et demande déjà en attente n'en créent pas une seconde. L'envoi de cœur ne crée aucune notification. Le modèle et les routes de notification existants sont réutilisés, sans migration ni architecture parallèle.
- Validation du complément frontend : **624 tests frontend / 80 fichiers** réussis ; build, lint et diff-check réussis. Les contrôles backend précédents restent à **270 tests / 48 fichiers** et les **13 scénarios PostgreSQL Amitié** précédents restent inchangés : ce complément ne modifie ni serveur, ni migration, ni base. Le lint conserve uniquement les deux warnings ContestScreen préexistants et Vite son warning de taille de bundle. Les erreurs `ECONNREFUSED localhost:3000` attendues de certains mocks frontend restent non bloquantes.
- Validation Chromium locale sur un écran de shell complet composé avec les vrais Header, Navigation, Chat, composants Social et CSS du projet, données synthétiques et aucune API publique : Amis, Demandes, Joueurs, profil d'un autre joueur et modal Joueurs connectés contrôlés à **1920×1080** et **1366×768** ; Joueurs, Profil et modal aussi contrôlés à **500×900**. Alignements, colonnes d'action, surbrillance, scroll interne, icône Élément et absence de débordement observés. Harness et captures exclus du commit. Cette vérification technique ne remplace pas le nouveau test public d'Axel après promotion.
- Documentation : la navigation est actualisée car ses anciens contrats interdisaient encore les actions dans Joueurs connectés et nommaient l'ancien bouton global. Le contrat de layout décrit déjà les régions fixes, le scroll propriétaire et le flux responsive ; il reste inchangé. Audit Social, architecture, roadmap, workflow, Guide, AGENTS, README et Story restent intacts : aucune nouvelle décision produit Amitié ni Rxxx.
- Prochaine étape : review indépendante de ce candidat, puis seulement une mission dédiée de promotion `main`, déploiement et contrôle public des cinq surfaces. Les échanges de particules ne deviennent actifs qu'après cette clôture.

## Historique — candidat Batch C Amitié / polish public, 2026-09-20 (désormais promu)

- Commit fonctionnel et tests : `f2d738c5ffde21e20ee5988ee026a79d6cf97307`, parent `4443a37b3f6da3cb119935bd77ffe324c97e3992`. La documentation forme le commit suivant, sans changement supplémentaire de code.
- Correction de review : la migration additive `20260920220000_030_harden_friend_heart_trigger_search_path` (checksum `709983feeae94239f01eb4f20c32febc25c9876b2479d378efcea790464f623f`) fige `search_path = pg_catalog, public` pour `public.check_friend_heart_pair()`. Elle conserve la fonction SECURITY INVOKER, le trigger et les révocations EXECUTE existantes ; elle ne modifie aucune logique Amitié. Après application Prisma, l'Advisor ne retourne plus `function_search_path_mutable` pour cette fonction. Batch C reste **CANDIDAT REVIEW, NON PROMU** et attend une nouvelle review indépendante du vrai commit GitHub.
- Base contrôlée après fetch : `origin/main = d66576de952893b17851721fa0d5e9eb6aac85d8`, `origin/review = 4443a37b3f6da3cb119935bd77ffe324c97e3992`, divergence main/review `0 / 3`, worktree propre. Le candidat s'ajoute normalement sur review sans réécrire les checkpoints documentaires ni Story ; aucune promotion dans cette intervention.
- `FriendshipService` possède transitions et envois pour UI et futurs transports INTERNAL_CHAT/TWITCH, sans activer de commandes. Demande unique par paire non orientée, sans expiration ; réciproque acceptée ; autorisation destinataire/émetteur et identifiant de demande contre une action obsolète ; retrait archive, réajout conserve UUID/niveau/historique. Réponses idempotentes persistées dans BusinessOperation avec contrôle Player/type/cible/canal. Transactions sérialisables, retry borné, verrou advisory Social et verrous Player dans l'ordre UUID ; blocages bidirectionnels et statut ACTIVE contrôlés serveur.
- Un cœur par relation/émetteur/business date Europe/Paris : +1 niveau commun plafonné à 1000 et total partagé, +5 Primogemmes pour chaque participant par Economy, ledger et agrégats existants. Envoi global et individuel partagent la même primitive transactionnelle ; aucun double crédit et rollback intégral sur erreur. `PlayerSocialStats.totalFriendHeartsSent` est un cumul individuel autoritaire indépendant des lignes d'historique, incrémenté seulement pour les vrais envois. Les 50 phrases Ami auditées sont réutilisées pour le feedback individuel, persisté pour le replay. Aucune notification de cœur ni progression du destinataire dans l'activité.
- Migration exacte : `20260920210000_029_add_friendship_workflows`, checksum `73209f24b81bf0cd7f8736ec6dcfb5fb1ce9b5fcebd8d1955ded7555ea809724`. Ajoute FriendRequestState, `friend_requests`, `friend_hearts`, `player_social_stats`, FK restrictives, CHECK distinct/résolution/cumul, index de lecture, unicité partielle des demandes PENDING et cœur quotidien/opération unique. Trigger invoker `check_friend_heart_pair` vérifie l'appartenance à la paire. RLS active et droits PUBLIC/anon/authenticated révoqués sur les trois tables et la fonction. Aucune relation existante au préflight ; le default/CHECK niveau passe de 0 à 1..1000, sans réécriture de données. Cette contradiction du schéma préparatoire avec R457 et les invariants Ami est explicitement corrigée selon l'audit, sans nouvelle règle.
- Prisma deploy/status réussis : **30 migrations à jour**, 30 checksums compatibles, aucun registre modifié manuellement. La migration 029 reste intacte ; 030 est enregistrée normalement par Prisma. Contrôle final : trois nouvelles tables publiques vides, aucun schéma `batch_test_*` résiduel, contraintes/index/FK/RLS/grants relus. Les tests écrivent réellement des fixtures synthétiques dans des schémas privés UUID puis les suppriment exactement ; aucune suite DB publique partagée relancée.
- Routes authentifiées/no-store : GET `/api/v1/me/friends`, PATCH `/api/v1/me/friends/sort`, POST `/api/v1/me/friends/actions`, POST `/api/v1/me/friends/hearts`. L'annuaire GET `/api/v1/players` ajoute état relationnel et filtre de présence **avant** pagination de vingt ; présence privée exclue d'un statut précis. Player/canal ne sont pas acceptés comme propriétaire arbitraire du payload.
- `PlayerActivityRecorder` est le propriétaire transverse de `player_activity_state` : timestamps monotones, écriture dans la transaction réussie pour interactions de présence réelles, transitions Amitié effectives, cœurs envoyés et Game C. GAMEPLAY nourrit aussi application ; TWITCH reste distinct. GET/polling, heartbeat sans interaction, replay, action refusée, scheduler, notification reçue, réponse automatique, fin automatique d'Expédition ne sont pas producteurs. Aucun changement aux règles Game C.
- UI : Social ouvre Amis par défaut ; recherche et tri serveur persisté (présence/alpha/niveau/cœur), Demandes reçues/envoyées et Joueurs contextuels. Identité et actions séparées, pending synchrone, clé conservée après erreur ambiguë, dernier état confirmé maintenu ; refresh partagé entre Social et Quotidiennes sans F5 et ressources rechargées après cœur. Aucun onglet Messages. Quotidiennes expose nombre réel de cœurs disponibles, Terminé, aucun ami ou indisponibilité, avec accès Amis seulement si action disponible.
- Polish : `Voté ✓` doré et footer votes réduit/stable ; Expédition garde `Récupération…` au claim et `Départ…` au départ (implémentation déjà correcte, preuve de test ajoutée) ; filtre Tous/En ligne/Absent/Hors ligne réel et bordure première ligne complète ; Profil identité agrandie, statut sous avatar/pastille autorisée, activité séparée et fallback exact « Aucune activité récente. », Team uniquement dans son onglet ; panneau connecté aéré, liste scrollable et bouton inférieur vers Joueurs même depuis Amis ; Confidentialité en lignes séparées, labels lisibles/selects alignés.
- Validation : **613 tests frontend / 80 fichiers**, **270 tests backend / 48 fichiers**, **13 tests PostgreSQL Amitié/concurrence/activité + 8 tests DB Social existants** réussis. Typecheck/build backend, build frontend, lint et diff-check réalisés. Les scénarios couvrent notamment courses opposées, transitions concurrentes, retry, all/individuel, double all, rollback économique injecté, plafond/réactivation, changement de jour Paris, compteur cumulé préexistant, permissions ACTIVE/ARCHIVED, filtre avant pagination et Game C. Aucune exclusion silencieuse ; les échecs initiaux de fixtures/assertions/harness ont été corrigés puis relancés, pas qualifiés de flaky. Les autres suites DB et les déploiements ne sont pas exécutés dans ce lot.
- Chromium : GameShell complet et CSS réelles, données synthétiques locales à **1920×1080, 1366×768, 2560×1440, 390×844**. Trois onglets, listes longues/courtes/vides, première ligne hover/focus, pagination 20+5, filtre réel, actions, Profil/Team, Confidentialité, navigation panneau et Quotidiennes contrôlés. Aucun overflow horizontal ni erreur de page ; scroll interne desktop et flux mobile. Catalogue : hauteur identique avant réponse Votes retardée de 2 s et après vote, cartes alignées. Captures/harness temporaires exclus des commits ; ceci ne remplace pas la validation visuelle publique d'Axel.
- Nettoyage DEV transactionnel ciblé : `e887565c-bca9-4292-a3e6-19e3eef2e9db` (Codex Event 2f5fb3ad) et `0f6326d9-4021-4b47-92c1-c87abb6cd5c1` (Sender5 090faef4). Toutes les FK Player inspectées, ainsi que les dépendances BusinessOperation et comptes Banque ; noms/UUID et comptes de lignes vérifiés sous verrou avant suppression. Aucune Friendship, session ni compte Auth réel associé ; WebIdentity du second strictement synthétique. Suppressions : event_participants 1, business_operations 1, notifications 3, web_identities 1, privacy_settings 2, player_event_currency_balances 1, player_bank_accounts 2, player_daily_reward_state 2, player_economy_stats 2, player_gacha_states 2, player_progression 2, player_resource_balances 18, player_wheel_stats 2, players 2. Édition Event conservée. Contrôle final UUID/noms : zéro ligne, zéro FK résiduelle. Kichnifou, Mynonyme, MynonymeTest1/2/3, Céo, Mika et Jean Julien intacts.
- Warnings connus : deux warnings lint préexistants ContestScreen et taille du bundle Vite ; journaux frontend ECONNREFUSED localhost:3000 sans échec de test ; dépréciation pg observée lors des DB tests. La correction de review 030 retire `function_search_path_mutable` pour le trigger Amitié. Avertissements Supabase préexistants : 87 informations `rls_enabled_no_policy` du modèle backend-only, `rls_auto_enable` SECURITY DEFINER exécutable par anon/authenticated et protection Auth contre mots de passe compromis désactivée ; aucun correctif hors scope effectué.
- Documentation : Master = état/prochain contrôle ; architecture = service/routes/activité/transactions ; schéma et modèle = tables réelles/compteur individuel/niveau initial ; navigation = trois onglets/destinations/Quotidiennes/polish. Audit Social, decisions-log, roadmap, workflow, passation, Guide, AGENTS, README et Story laissés intacts : aucune nouvelle décision Rxxx ni modification du processus/ordre durable.
- Hors scope préservé : échanges de particules, Chat/MP/Twitch réels, avatars/titres/Personnalisation, Historique global/R633/R634, Missions B/A/S/Z, import legacy (88 relations/21 demandes), objectifs personnels, Realtime Social, services payants, images et Story. La review indépendante du vrai commit GitHub précède toute promotion, déploiement et validation publique.

## Checkpoint public — Batch B Social Foundations, 2026-09-20

- Commits fonctionnels : `6ee9ade5ae8f3102d3c114478fdc7ee2571f53dc`, puis `d55af01386b81458761521825445b5a55cf0a2c8`, sans réécriture depuis `0da73d1d5391bdb67e1f23267994553e12cfb1af`. Les sous-lots Profil/Présence et Confidentialité sont réunis : toutes les projections dépendent de la permission serveur centrale. La documentation possède son commit distinct.
- Le commit A `6ee9ade` ajoute `activities` dans Menu, avec dernier sous-écran de session et fallback Quotidiennes. Social ajoute ensuite `social`. Les anciennes préférences conservent ordre/masquages ; nouveaux IDs insérés avant Configuration. Aucune migration de préférences, toujours sept tuiles principales.
- Catalogue : bandeau retiré dans tous les états ; compteurs `0 vote / 1 vote / N votes`, badge exact `Voté`, choix définitif dans l'aria-label. Cache RAM par Player/instance GameShell, reset logout/changement de Player, protection contre les anciennes réponses après mutation. Snapshot immédiat au retour, revalidation/polling serveur existant. Tri Votes décroissant au choix, égalités alphabétiques, zéro classé normalement, non-candidats après les candidats même en sens inverse. Footer réservé et filtres partagés capables de revenir à la ligne.
- Social : annuaire ACTIVE, recherche sous-chaîne normalisée accents/casse, filtre Élément, pages serveur de vingt, ordre alphabétique. Profil depuis annuaire, panneau connecté et avatar/pseudo personnel. Aperçu, Team active, Box, Collection et Statistiques réels, sans mutation. Team sans provisioning/nettoyage ; Box par projection dédiée sans favoris/Stella ni lecture des données Concours/C6 détaillées ; Collection sans lecture du Sac/monnaies. XP, pulls/raretés, victoires Combat et expéditions terminées viennent des agrégats physiques ; donnée absente = indisponible, jamais une statistique inventée.
- Présence : UUID distinct par montage d'onglet, sessionStorage et hash lié au Player côté serveur. Heartbeat 45 s, interactions coalescées 15 s ; En ligne <10 min, Absent ensuite, Hors ligne à 2 h sans activité ou 3 min sans heartbeat. Fermeture best-effort/pagehide et avant logout ; tombstone contre un start réseau tardif. Sessions multiples agrégées, activités application/chat/Twitch/gameplay séparées. Compteur et panneau partagent le polling 30 s visible-only sans chevauchement.
- Confidentialité : service central, 18 catégories R518/R519, défauts version 1 et overrides prioritaires. Propriétaire toujours autorisé ; FRIENDS exige Friendship ACTIVE ; blocage bidirectionnel masque présence/dernière activité. Permission avant lecture de chaque domaine, `PRIVATE` sans données. Configuration : Menu et Confidentialité actifs, Apparence disabled. Catégories non encore consommées persistées pour les futurs domaines, sans écran fictif ; PRIVATE_MESSAGES/Event Game C préservé.
- DB : 028 appliquée exclusivement via Prisma ; checksum `8ab4ce077743dd8c759e7b5249df0d3b9939aca8adc873f87e4337ddea12753e`. Registre, migrate status, PK/FK/CHECK/index, RLS et absence de grants PUBLIC/anon/authenticated vérifiés. Les 28 checksums correspondent : cinq exacts dans le checkout, 23 anciennes migrations équivalentes après normalisation LF/CRLF Windows. Aucun registre modifié à la main.
- Huit scénarios DB Social passent dans des schémas privés UUID, fixtures effectivement écrites puis schémas supprimés exactement. Aucun Player réel ou compte protégé utilisé. Contrôle final : aucun schéma `batch_test_*` résiduel, zéro ligne dans les deux nouvelles tables publiques. Les premières erreurs de fixtures/tests ont été corrigées puis relancées ; elles ne sont pas qualifiées de flaky.
- Validation finale : **605 tests frontend / 79 fichiers**, **270 tests backend / 48 fichiers**, typecheck/build backend, build frontend, lint et diff-check réussis. Le lint conserve seulement deux warnings préexistants ContestScreen ; Vite signale la taille du bundle. Trois tests UI supplémentaires couvrent notamment refus de sauvegarde puis confirmation, distinction privé/vide et navigation du panneau connecté ; les tests existants couvrent aussi heartbeat sans activité et isolation de compte. Aucune suite DB publique partagée n'est relancée. Les liens documentaires locaux ajoutés sont valides.
- Browser Chromium : GameShell réel/CSS réelles avec réponses synthétiques locales. 1920×1080, 1774×864, 1366×768 et 390×844 : déplacement filtres/grille **0 px** à la résolution Vote lente, après stabilisation de l'animation d'entrée du shell. Retour avec revalidation bloquée et Voté immédiat, tri/filtres, Menu Activités/fallback/dernier sous-écran, Social/pagination/profils/confidentialité et panneau connecté desktop contrôlés. Clic réel → activité transmise, deux onglets → clés distinctes. Tous les contrôles de filtres sont contenus à 1366 et 390 ; aucun overflow horizontal du document. Scroll interne desktop et flux naturel mobile observés. Captures et harness exclus du candidat.
- Batch B est promu par fast-forward sur `d66576de952893b17851721fa0d5e9eb6aac85d8`, déployé automatiquement, vérifié Railway et validé publiquement dans son fonctionnement général. Aucun Ami/cœur/demande, MP, Chat réel, Twitch, avatar/titre déblocable, historique global, échange de particules, migration legacy, Story, image générée ou service payant n'est toutefois développé ; le polish restant est porté par le pointeur vivant ci-dessus.
- Roadmap durable réexaminée : l'ordre d'implémentation reste valable, sans nouvelle décision de conception ni modification de l'audit Social. Le pointeur vivant de reprise ci-dessus porte le prochain contrôle indépendant.

## Checkpoint candidat — Batch A Event / Votes, 2026-09-19

- Commits fonctionnels : `0d626220eb8e3cc2fc171fb7b72300f6cdf3a068` (lifecycle Event) puis `ce1ff235da03391765ed1cdc4a4a945948507ebb` (Votes et migration de sécurité autorisée), construits sans réécriture sur `b976595b60c2871d49ace061160d383713359e46`. Les corrections de review sont intégrées par `08a21ba8fa5dd78fa1a454e940bb8513d1116b2c` puis documentées par `702d1aa57a8231501533d34d52d746eea8c22728`, toujours sur `review`.
- R641 : `EventLifecycleNotificationReconciler`, appelé par le GET Notifications habituel, délivre l'annonce à la première présence de l'édition, même en milieu de mois. La clé durable `event-delivery:type:Player:édition` est une preuve commune réutilisable par les futurs canaux ; elle reste conservée après lecture/archivage. Deep-link `OPEN_EVENT`.
- R643 : même réconciliateur, uniquement lorsque la business date serveur Europe/Paris égale celle de `endsAt - 1 ms`, un rappel court par Player/édition vers `OPEN_EVENT_SHOP`. Pas de création tardive pour l'ancienne édition au mois suivant, pas de solde dans le message.
- R642 : `GiftCodeService.festivalAvailability` matérialise les éditions annuelles des seules définitions Festival système (`createdById IS NULL`) selon le moteur Codes existant et vérifie statut, mois, fenêtre courante et absence de claim personnel. Un ANNUAL Admin du même mois reste exclusivement un Code, jamais un signal Event. Token/titre ne définissent pas cette association. Event ne reçoit que `giftCode.available`, jamais token/récompenses. « Voir les Codes » ouvre Codes ; le claim reste dans Codes et rafraîchit Event. Aucune activité Quotidiennes artificielle.
- Configuration : seule la phrase « Neuf destinations maximum sont affichées par page. » est retirée ; titre, reset, onglets, préférences et layout sont conservés.
- Votes : `BannerVoteService`, GET/POST authentifiés `/api/v1/gacha/vote`, modèles existants `BannerRotation`/`BannerVote`. POST accepte seulement `characterId` et `bannerRotationId` (garde contre un écran ancien au rollover). Player résolu depuis l'identité ; canal UI imposé côté backend. 5★ actif hors bannière courante, un choix définitif par Player/rotation, retry identique reconnu même après rollover, autre choix refusé. Aucun coût ni gain.
- Concurrence : transaction sérialisable, retry borné et verrou advisory identique à `ensureRotation`. Compteurs dérivés des lignes individuelles. Lundi 00:00 Paris, le scheduler existant consomme réellement les votes : trois 5★ aléatoires puis un pondéré parmi les restants, fallback aléatoire, exclusion des featured précédents 5★/4★. Échec = rollback, ancienne ACTIVE et votes conservés mais vote fermé après `endsAt` ; le scheduler réessaie automatiquement toutes les 60 secondes avec les mêmes votes, y compris après un échec de démarrage, jusqu'au succès. Un seul timer est actif ; `stop()` annule le retry. Après succès, nouveau cycle et planning hebdomadaire normal, ancienne cible vidée. Les votes historiques et `selectionSource` restent durables, sans nouvel écran Historique.
- Catalogue : compteurs et CTA uniquement sur candidats éligibles, badge personnel, suppression des autres CTA après vote, échéance serveur et caractère définitif affichés. Recherche/filtres/tris conservés. Polling léger à 3 secondes après réponse, visible-only, focus/visibility, anti-overlap et cleanup ; version de catalogue déclenchant un rechargement ponctuel, pas de full snapshot Gacha périodique.
- Validation : 267 tests backend, 594 tests frontend ; typecheck/build backend, build frontend et diff-check réussis. Dix tests PostgreSQL Event/lifecycle/votes/Noël passent dans des schémas privés UUID ; DDL et fixtures synthétiques effectivement écrits puis supprimés exactement. Aucun compte DEV protégé utilisé, aucun vote réel ni état économique public modifié. La seule modification publique DB est la révocation de grants autorisée via 027, terminée et suivie dans Prisma ; zéro droit navigateur résiduel sur `banner_votes`. Avertissements non bloquants : deux warnings lint préexistants ContestScreen, taille du bundle Vite et dépréciation `pg` observée pendant les tests DB. Aucune suite DB Concours publique n'est relancée.
- Browser : GameShell complet avec CSS du projet, 1920×1080, 1774×864, 1366×768 et 390×844 ; filtre 5★, compteurs, vote et état après vote, signal Code, deep-link Shop et onglets Configuration contrôlés sans débordement horizontal. Aucun harness ni capture dans les commits.
- Aucun nouveau Rxxx, Story, Social/Profils, Chat/Twitch réel, Historique global, migration legacy ou service payant. Le contrat UI et la roadmap durable ne changent pas ; seules leurs fonctionnalités existantes sont appliquées.

## Checkpoint candidat — Calendrier de Noël / Configuration, 2026-09-19

- Le calendrier est intégré à Inscription sous Participation/Bonus, sans cinquième onglet : 25 cases, jours 1–24 = tirage uniforme serveur 1–5 Étoiles de Noël, jour 25 = 50 sans RNG. Aucun point Event, classement ou palier n'est attribué par cette opération. Les Jeux A/B/C, le Shop et leurs règles restent inchangés.
- `POST /api/v1/me/event/calendar/claim` accepte seulement une clé UUID. L'horloge injectée et `Europe/Paris` déterminent la case ; aucun rattrapage, aucune inscription implicite. Transaction sérialisable, verrou Player/édition, unicité édition/Player/jour et opération : claim, solde saisonnier et journal sont atomiques. Le replay restitue le gain persisté sans reroll, même après la journée/fin décembre.
- Le snapshot Event porte `calendar` (`null` hors décembre), ses 25 états et les seuls montants révélables. Du 26 au 31, bilan sans action ; disparition au changement de mois. Le coordinateur Event existant publie le snapshot après mutation sans F5. La garde client bloque le double clic et conserve l'UUID après une erreur ambiguë. Quotidiennes consomme le même agrégateur de disponibilité ; le bilan ne maintient pas le CTA.
- Migration 026 : `EventCalendarClaim` / `event_calendar_claims`, récompense persistée, FK, CHECK jour/récompense, index, RLS et révocation des droits navigateur. Prisma indique 26 migrations à jour ; structure réelle et checksum vérifiés. Aucune claim dans la table publique après les tests.
- Tests DB : cinq tests passent dans un schéma privé à UUID propre à l'exécution, avec fixtures synthétiques et suppression exacte de ce schéma ; aucune donnée économique réelle ni compte protégé modifié. Les essais ont temporairement écrit des fixtures/DDL DEV isolés. Aucun schéma de test résiduel au contrôle final.
- Configuration : la règle générique `.long-screen-layout:has(> .screen-header)` à deux lignes gagnait par spécificité contre `.configuration-screen`. Le sélecteur ciblé `.configuration-screen.long-screen-layout:has(> .screen-header)` rétablit `auto auto minmax(0, 1fr)` : header, onglets, frame. Menu reste actif ; Confidentialité/Apparence restent visibles et disabled. Aucun nouveau masquage ni texte ajouté.
- Validation Chromium, GameShell complet et CSS réelles : Configuration 1920×1080, 1366×768, 390×844 et équivalents zoom desktop 80/100/125 % ; onglets hauts de 46 px, boutons de 37 px, espacements de 12 px entre régions. `header.bottom <= tabs.top` et `tabs.bottom <= frame.top` vérifiés. Body Menu propriétaire du scroll desktop ; flux naturel mobile conservé. Event testé à 1920×1080, 1774×864, 1366×768, 390×844 : 25 cases, cinq colonnes desktop/trois mobile, aucun débordement horizontal, ouverture et feedback vert observés avec réponses synthétiques locales, pas sur un Festival public artificiel.
- Validations : suites backend 262 tests et frontend 589 tests réussies ; cinq tests DB Calendrier réussis ; typecheck/build backend, build frontend et contrôle diff validés. Lint : deux avertissements préexistants dans ContestScreen ; build frontend : avertissement de taille du bundle. Aucun test silencieusement exclu ; les autres suites DB ne sont pas relancées sur les données partagées.
- R641/R642/R643 ne sont pas ajoutées : l'orchestration Event inspectée ne possède pas encore ces annonces/rappels/signalements. Le moteur Codes et ses notifications existants ne valent pas implémentation du signalement Event R642. R633/R634 restent reportées à l'Historique transversal. Aucun nouveau Rxxx, migration legacy, Story ou service payant.

Ce checkpoint décrit un candidat, pas une validation publique. L'architecture backend ne change pas de propriétaire : `EventService`, coordinateur Event et timer serveur existants sont réutilisés. Le contrat UI couvre déjà les régions fixes et le propriétaire du scroll ; aucune nouvelle règle transverse n'est nécessaire.

Ce document doit être considéré comme une **mémoire externe centrale** du projet.

Il ne remplace pas les autres documents spécialisés dans `docs/`, mais il sert de :
- résumé global ;
- carte de navigation ;
- feuille de route ;
- historique des décisions majeures ;
- point de reprise rapide après une longue pause ;
- guide de contexte pour ChatGPT/Codex.

Quand une décision structurante change :
1. mettre à jour le document spécialisé concerné ;
2. mettre à jour ce document maître si la décision impacte la vision globale, l'architecture, les étapes, la migration ou l'organisation du projet.

Le projet ne doit pas dépendre de la mémoire d'une conversation.

## Responsabilité de suivi global

Ce Master est le **seul document autorisé à porter le pointeur global vivant du projet** :
- phase actuellement active ;
- domaine d'audit actuellement actif ;
- état global d'avancement ;
- prochaine étape exacte de reprise.

Les documents spécialisés peuvent indiquer leur propre état (`EN COURS`, `CLÔTURÉ`, dépendances restantes, etc.), mais ne doivent pas annoncer ou maintenir le prochain domaine global.

Le journal des décisions conserve l'historique validé et la roadmap conserve la trajectoire macro ; aucun des deux ne doit devenir un second tracker de reprise.

Cette séparation vise notamment à fournir plus tard à Codex une documentation non contradictoire avant chaque lot d'implémentation.

---

# 1. VISION GLOBALE

## 1.1 Concept

GachaImpact est la transformation d'un ancien jeu Twitch/Streamer.bot inspiré de Genshin Impact en un vrai jeu web standalone.

Le jeu doit :
- fonctionner indépendamment de Twitch ;
- avoir sa propre interface graphique ;
- avoir de vrais comptes joueurs ;
- stocker les données dans une base de données serveur ;
- permettre d'utiliser les mécaniques par boutons/UI ;
- permettre aussi d'utiliser certaines mécaniques via un chat global interne ;
- permettre plus tard de lier un compte Twitch ;
- permettre à Twitch de devenir un canal d'entrée supplémentaire vers les mêmes mécaniques ;
- ne jamais obliger un joueur à avoir Twitch pour profiter du jeu.

Le but n'est donc PAS de faire une interface graphique au-dessus de Streamer.bot.

Le but est de créer un jeu complet, maintenable et centralisé, dont Twitch deviendra seulement une intégration optionnelle.

## 1.2 Projet futur original séparé — DIRECTION À CONSERVER

Un second jeu original est envisagé à plus long terme.

### Rôle de GachaImpact

GachaImpact doit aussi servir de **laboratoire fonctionnel grandeur nature** pour ce futur jeu.

L'objectif est d'utiliser GachaImpact pour :

- construire une première architecture complète de jeu standalone ;
- expérimenter les boucles de progression ;
- expérimenter le Gacha ;
- tester l'économie ;
- tester les événements ;
- tester les systèmes sociaux ;
- tester les interfaces ;
- identifier ce qui est amusant, inutile, trop complexe ou mal équilibré ;
- apprendre des usages réels avant de concevoir la version originale commerciale.

Le futur jeu ne sera donc pas une simple copie renommée de GachaImpact.

Il pourra reprendre ou adapter les **principes techniques et mécaniques qui auront fait leurs preuves**, tout en abandonnant ceux qui ne fonctionnent pas.

### Séparation avec GachaImpact

Direction actuelle :

- il s'agira d'un **jeu séparé** de GachaImpact, et non d'une simple section interne ;
- GachaImpact pourra proposer un lien vers ce futur jeu ;
- une grande partie des services, patterns d'architecture et mécaniques développés ici pourra être réutilisée/adaptée ;
- le futur jeu devra se détacher réellement de Genshin : noms, personnages, univers, terminologie, identité visuelle, assets, scénario et concepts player-facing devront être originaux ;
- GachaImpact inspiré de Genshin n'est pas le produit destiné à devenir le jeu commercial original.

Conséquence d'architecture :

quand plusieurs solutions techniques sont équivalentes pour GachaImpact, préférer les concepts génériques et réutilisables plutôt que des hardcodes inutilement dépendants de Genshin, **sans modifier pour autant les règles produit GachaImpact déjà validées**.

### Ambition commerciale future

Objectif possible à long terme :

- créer un véritable gacha original appartenant au projet ;
- permettre une diffusion à une audience nettement plus large ;
- étudier une distribution Web / PC / plateformes mobiles ou stores appropriés ;
- permettre potentiellement des transactions financières réelles ;
- permettre une vraie monétisation si le jeu atteint le niveau de qualité nécessaire ;
- faire évoluer l'infrastructure selon la taille réelle de la communauté.

Cette ambition commerciale appartient au futur jeu original et ne constitue pas une instruction de monétiser GachaImpact avec ses éléments inspirés de Genshin.

Avant toute commercialisation réelle, prévoir un chantier spécifique séparé portant notamment sur :

- paiements ;
- stores / plateformes ;
- commissions ;
- backend et montée en charge ;
- sécurité financière ;
- fiscalité ;
- CGU / CGV ;
- protection des données ;
- mineurs ;
- règles de consommation ;
- affichage des probabilités du gacha ;
- réglementation applicable aux mécaniques aléatoires ;
- propriété intellectuelle ;
- validation juridique adaptée aux pays de distribution.

Aucune architecture de paiement ni règle juridique détaillée ne doit être figée aujourd'hui : ce chantier sera étudié au moment du développement réel du jeu original avec des informations à jour.

### Univers / narration

Différences importantes déjà envisagées :

- personnages entièrement originaux ;
- lore original ;
- véritable catégorie `Histoire` ;
- narration pouvant prendre la forme d'un visual novel ;
- possibilité de scènes plus poussées avec animations et cinématiques ;
- protagoniste et scénario originaux déjà explorés séparément dans le projet créatif.

### Direction artistique envisagée

- personnages et assets pouvant être produits avec l'aide de l'IA ;
- possibilité de commander des croquis/model sheets à des artistes humains puis de les utiliser comme références canoniques ;
- forte exigence de cohérence du même personnage entre poses, angles, émotions et scènes ;
- benchmark futur des outils de génération d'images avant de choisir le pipeline ;
- pour les cinématiques, privilégier une production pré-générée/hybride plutôt qu'une génération vidéo coûteuse en temps réel.

Ce projet futur reste séparé du périmètre métier actuel de GachaImpact.

Ne pas modifier arbitrairement les règles produit de GachaImpact pour anticiper ce futur jeu ; construire toutefois une base technique propre, modulaire et instructive afin que les apprentissages puissent être réutilisés plus tard.

---

# 2. PROBLÈME PRINCIPAL DU SYSTÈME LEGACY

Le jeu actuel fonctionne via Streamer.bot.

Chaque commande est essentiellement un script indépendant.

Conséquences :
- beaucoup de logique dupliquée ;
- scripts difficiles à faire communiquer ;
- données parfois réparties dans plusieurs JSON ;
- certains scripts reconstruisent des infos qu'un autre script connaît déjà ;
- certaines données dérivables sont sauvegardées uniquement parce qu'un script avait besoin de les afficher ;
- maintenance fragile ;
- migrations de structure JSON progressives ;
- anciens joueurs pouvant avoir des sections absentes ;
- dépendance forte à Twitch et au modèle "un message déclenche une commande".

Le nouveau GachaImpact doit résoudre cela avec :
- fonctions centrales réutilisables ;
- logique métier serveur commune ;
- source de vérité unique ;
- base de données structurée ;
- services partagés ;
- même action métier appelée depuis plusieurs interfaces.

Exemple cible :

UI Invocation
        \
Chat GachaImpact !pull
          \
Twitch !pull
            \
             -> même service serveur Invocation
                         ->
                    mise à jour joueur
                         ->
                      résultat

Il ne doit jamais exister trois versions différentes de la logique du pull.

---

# 3. ÉTAT ACTUEL DU FRONTEND

## 3.0 Convention V0 / V1

Convention actuelle du projet :

### V0 — prototype visuel existant

La V0 désigne la coque frontend déjà construite dans le repository.

Elle sert à :
- matérialiser la direction générale de l'interface ;
- disposer d'une navigation et d'écrans existants ;
- tester progressivement les futurs branchements métier ;
- éviter de repartir d'une page blanche lors de la construction de la vraie application.

Elle utilise encore des données fictives / mocks.

La V0 :
- n'est pas la source de vérité métier ;
- ne possède pas encore le vrai backend du jeu ;
- ne doit pas imposer son modèle de données fictif à la future architecture ;
- peut contenir des noms, valeurs, textes ou comportements de démonstration devenus obsolètes.

### V1 — première vraie version métier standalone

La V1 désigne la première implémentation réelle du jeu standalone construite progressivement à partir des audits validés.

Elle doit remplacer progressivement les mocks par :
- les vraies entités métier ;
- des services centralisés ;
- un backend autoritaire ;
- une persistance serveur ;
- les données migrées du legacy ;
- les vraies règles validées dans la documentation.

La V1 sera construite par lots avec Codex. Il ne s'agit pas d'un remplacement complet du frontend en une seule opération.

Cette convention V0 / V1 prévaut sur d'anciennes formulations du repository qui pourraient utiliser ces termes différemment.

## 3.1 Stack actuelle

Frontend :
- React
- TypeScript
- Vite

Projet local :
`C:\Users\axeld\Documents\GachaImpact`

Dépôt GitHub public :
`https://github.com/Kichnifou/GachaImpact`

Branche principale :
`main`

Le dépôt est versionné avec Git.

---

## 3.2 Interface réalisée

Une coque frontend responsive a été créée avec :

Navigation :
- Accueil
- Invocation
- Box
- Personnages
- Équipe
- Sac
- Boutique

Éléments globaux :
- sidebar joueur à gauche ;
- zone centrale dynamique ;
- chat global à droite ;
- notifications ;
- joueurs connectés ;
- navigation responsive ;
- panneau mobile ;
- chat repliable ;
- scroll interne plutôt que scroll global.

---

## 3.3 Direction UX validée

### Desktop
Objectif :
- pas de scroll global à 1920×1080 si évitable ;
- chaque grande zone doit tenir dans l'écran ;
- si du contenu est long, utiliser un scroll interne dans le panneau concerné ;
- gauche / centre / chat doivent paraître alignés et équilibrés verticalement.

### Mobile
Priorité :
- ordre validé : Header → Profil → Primogemmes / Moras → Navigation → Contenu principal → Particules → Équipe → Objectif → Daily Reward → Chat ;
- les informations secondaires restent après le contenu principal et ne sont pas remontées intégralement avant le jeu ;
- sur téléphone paysage, les panneaux secondaires joueur restent eux aussi empilés verticalement avec un scroll naturel ;
- aucun overflow horizontal.

---

## 3.4 Sidebar gauche

Contient actuellement :
- pseudo joueur ;
- niveau / XP ;
- ressources principales ;
- primogemmes ;
- moras ;
- particules élémentaires ;
- équipe active ;
- objectif actuel / cible de bannière ;
- pity 5★ ;
- pity 4★ ;
- garantie ;
- brillance ;
- suivi des activités quotidiennes (actuellement présenté comme récompense quotidienne).

Décisions :
- le label "Voyageur" a été supprimé ;
- l'ancienne ligne de voeux possibles a été retirée ;
- les étoiles d'un personnage doivent être placées sous son nom ;
- la Capture de brillance doit être représentée par un compteur `X / 3` ;
- le compteur de brillance doit être placé avec les informations de garantie/pity ;
- la sidebar ne doit pas afficher une scrollbar au chargement normal 1920×1080 ;
- les headings navigables conservent leur surface de clic/touch mais n'affichent plus de chevron ;
- le bloc du bas évolue vers un **suivi quotidien général** : la récompense quotidienne n'est qu'une activité parmi d'autres (combat, roue, etc.) ;
- navigation de ce petit bloc par chevrons compacts `‹` / `›` plutôt que par boutons texte « Précédent / Suivant » ;
- possibilité de masquer une proposition pour la journée ;
- préférences futures permettant de choisir les types de quotidiennes à afficher ;
- quand toutes les propositions pertinentes sont terminées ou masquées, le bloc reste visible avec un état du type « Tout est bon, tu es à jour ».

---

## 3.5 Chat global

Le [contrat Chat global V1](../specifications/global-chat-v1.md) porte les décisions validées R872–R887. Le panneau desktop repliable accueille le Chat global réel ; l’onglet MP reste non physique. Les fondations serveur/DB, les commandes et leurs réponses publiques, puis le `ChatPanel` connecté et son transport HTTP incrémental sont implémentés. Le cycle Chat global est **validé publiquement et clôturé** sur le HEAD `68b8adc3bece298fe3f1e4be10a358860c563eba` : Cloudflare Pages et Railway sont `SUCCESS`, `Application ready` est confirmé et `/health` répond HTTP 200. Twitch et son pont optionnel restent reportés ; Realtime est absent.

Présence joueurs :
- le nombre de joueurs en ligne est affiché dans le chat ;
- cliquer dessus ouvre un petit panneau ;
- futur : ajouter/enlever un ami ;
- futur : aller vers espace social ;
- futur : cliquer sur un joueur pour voir sa fiche.

---

## 3.6 Notifications

Décision :
- cloche en haut ;
- pastille si notifications non lues ;
- clic -> panneau overlay ;
- fermeture possible par clic extérieur ;
- possibilité future de marquer lu / archiver ;
- clic sur notification -> écran concerné ;
- possibilité future d'un écran Notifications dédié ;
- distinguer trois formes : `actionnable`, `informationnelle` et `feedback éphémère` ;
- une notification actionnable correspond à une action encore réellement disponible pour le joueur ;
- une notification actionnable est automatiquement retirée de la liste active dès que l'action est accomplie, expire ou devient impossible, même si la notification n'a jamais été ouverte ;
- cette résolution est transversale : effectuer l'action depuis l'écran métier, le chat interne, Twitch ou un autre canal met à jour la notification correspondante ;
- une notification informationnelle signale au contraire un événement déjà accompli et reste visible jusqu'à lecture/suppression selon les règles générales ;
- un feedback éphémère est une animation/toast immédiat qui n'a pas nécessairement besoin d'être persisté dans Notifications ;
- pendant le sweep final, classer explicitement toutes les notifications prévues dans les audits et corriger les éventuelles ambiguïtés.

Exemples :
- `Un code cadeau est disponible` → actionnable ; si le code est réclamé directement depuis Codes, la notification disparaît ;
- `Gift Suprême reçu : +1 600 particules Hydro` → informationnelle ; la récompense est déjà appliquée mais la notification reste pour que le joueur puisse la découvrir plus tard.

État frontend actuel :
- la coque React possède déjà le panneau Notifications dans `GameHeader.tsx` ;
- la liste est actuellement alimentée par des données fictives de `src/data/mockData.ts` ;
- le compteur visible est encore statique dans le prototype ;
- le type actuel de notification est minimal et ne contient pas encore toute la navigation métier future ;
- ces mocks devront être remplacés plus tard par de vraies notifications provenant du backend.

Décision progression :
- lorsqu'un gain d'XP obtenu via le futur mode interface fait franchir plusieurs niveaux, les notifications de level-up s'ajoutent à cette liste ;
- plusieurs niveaux franchis peuvent produire plusieurs notifications afin que chaque progression reste visible ;
- les paliers d'overflow multiples au niveau 100 doivent également être présentés clairement.
Décisions générales notifications :
- toute notification peut être supprimée manuellement via une petite croix apparaissant au survol ;
- une notification consultée peut être marquée comme lue sans nécessairement disparaître immédiatement ;
- les notifications lues encore présentes sont nettoyées automatiquement au reset serveur quotidien ;
- une notification dynamique supprimée/lue peut réapparaître en non-lue si un nouvel événement pertinent survient.

Missions :
- une mission terminée via une action UI génère une notification cliquable menant vers l'écran Missions ;
- l'écran Missions conserve également un indicateur visuel clair pour les permanentes terminées ;
- une réussite provoquée depuis le chat interne est restituée dans ce chat ;
- une réussite provoquée depuis Twitch est restituée immédiatement dans la réponse Twitch correspondante ;
- ne pas dupliquer automatiquement une réussite vers les autres canaux ;
- ne jamais envoyer sur Twitch une notification asynchrone à un joueur potentiellement absent.

Échanges :
- une seule notification agrégée représente les demandes d'échange reçues en attente ;
- elle affiche le nombre total courant ;
- clic -> futur écran Échanges ;
- si une nouvelle demande arrive, la notification réapparaît/redevient non lue avec le nouveau total ;
- les demandes expirant au reset quotidien, cette notification disparaît également lorsqu'il ne reste plus de demande.
- acceptation, refus, annulation, réduction automatique ou expiration d'une demande ne génèrent pas de notification individuelle ;
- le détail des échanges récemment réalisés est consultable directement dans l'écran Échanges.

## 3.7 Écran Historique global — DIRECTION VALIDÉE

Prévoir un futur écran transversal `Historique`.

Onglets / catégories actuellement validés :
- `Invocations` ;
- `Bannières` ;
- `Banque` ;
- `Boutique / Achats` ;
- `Event`.

Principe transversal :
- il existe un seul écran complet `Historique` ;
- ne pas développer un écran d'historique complet différent pour chaque domaine ;
- chaque écran métier peut afficher quelques entrées récentes seulement lorsqu'elles apportent une vraie valeur ;
- un bouton `Voir l'historique` / `Voir tout` navigue vers l'écran global directement ouvert sur la catégorie correspondant au contexte d'origine.

Exemples :
- Banque → Historique / Banque ;
- Boutique → Historique / Boutique ;
- Invocation → Historique / Invocations ;
- Event → Historique / Event.

Event :
- l'écran Event courant ne contient pas directement la liste des anciennes éditions ;
- un bouton dédié ouvre Historique / Event ;
- le palmarès public d'une édition contient notamment son Top 10 final ;
- le propriétaire retrouve également son rang exact, ses points, ses paliers et son acquisition Collection dans son détail personnel.

D'autres domaines pourront ajouter une catégorie plus tard uniquement si leur historique apporte une réelle utilité.

### Invocations
- historique détaillé depuis le lancement standalone ;
- 10 résultats par page ;
- pagination serveur ;
- pas de purge annuelle par défaut.

### Bannières
- historique depuis le lancement standalone ;
- la bannière active au cutover peut devenir la première entrée avec origine `import legacy` ;
- composition 4×5★ + 6×4★ ;
- distinction des trois 5★ aléatoires et du 5★ communautaire ;
- snapshot des votes ;
- possibilité future d'afficher qui avait voté pour quel personnage ;
- dates/statut de rotation.

---

# 4. ÉCRAN INVOCATION — DIRECTION VISUELLE VALIDÉE

Le prototype visuel constitue une base UX, mais n'est jamais une source de vérité métier.

Direction principale :
- un seul type de bannière active ;
- rotation hebdomadaire ;
- 4 personnages 5★ ;
- 6 personnages 4★ ;
- cible 5★ personnelle obligatoire avant Invocation.

## 4.1 État sans cible

Après une nouvelle rotation :
- l'ancienne cible est vidée ;
- présenter les 4 personnages 5★ disponibles ;
- le joueur choisit celui qu'il souhaite cibler ;
- aucune sélection automatique à sa place.

Direction UX :
- présentation visuelle des quatre choix ;
- inspiration possible des écrans de sélection des bannières nostalgiques de Genshin ;
- ne pas copier aveuglément le jeu d'origine.

## 4.2 État avec cible

Après sélection :
- grande bannière visuelle ;
- artwork très grand du personnage ciblé ;
- artwork intégré comme fond/composition ;
- texte et gradient adaptés à la lisibilité ;
- nom et rareté du personnage ciblé ;
- bouton `Changer` permettant de rouvrir la sélection à tout moment ;
- les 6 personnages 4★ actifs restent visibles, par exemple via de petites vignettes/portraits en bas ;
- pity 5★ ;
- pity 4★ ;
- garantie 5★ ;
- Capture de brillance ;
- Invocation x1 ;
- Invocation x10.

Décisions :
- aucun sélecteur Permanent / Temporaire ;
- aucune « Bannière permanente » ;
- coût : 160 Primogemmes par Pull ;
- x10 = 1 600 Primogemmes, sans remise.

## 4.3 Animation d'Invocation

Standalone :
- le serveur calcule et persiste le Pull avant toute animation ;
- un x10 calcule séquentiellement les dix Pulls puis persiste l'ensemble atomiquement ;
- l'animation ne décide jamais du résultat ;
- crash/fermeture pendant l'animation n'annule aucune récompense déjà validée ;
- à la reconnexion, l'état joueur reflète immédiatement les résultats acquis ;
- séquence de lancement ;
- signal visuel de rareté ;
- doré si le résultat/x10 contient au moins un 5★ ;
- révélation résultat par résultat ;
- 5★ avec présentation plus spectaculaire ;
- skip possible ;
- récapitulatif final.

Early / Back-to-back / Hard :
- principalement conservés comme mentions chat ;
- aucune information permanente supplémentaire requise dans l'UI ;
- possibilité future d'une petite mention/animation temporaire si souhaité.

Twitch/chat :
- aucune animation ;
- restitution textuelle rapide résultat par résultat ;
- même résultat métier serveur.

## 4.4 Historique d'Invocation

Prévoir un bouton `Historique` sur l'écran Invocation.

Ouverture :
- fenêtre/panneau superposé ;
- 10 résultats par page ;
- page 1 = les 10 Pulls les plus récents ;
- pagination vers les Pulls plus anciens.

Stockage :
- conserver tout l'historique détaillé depuis le lancement de GachaImpact ;
- pas de purge automatique annuelle par défaut ;
- pagination côté serveur ;
- si la volumétrie l'exige un jour, possibilité d'archivage technique sans retirer l'accès aux anciennes données.

Le legacy ne permet pas de reconstruire précisément chaque ancien Pull.

Référence d'intention visuelle :
`https://www.youtube.com/watch?v=Zea_pd2AXEY`

---

# 5. ÉCRAN ACCUEIL

L'écran Accueil contient :
- une version compacte de la bannière Invocation ;
- des raccourcis :
  - Box
  - Personnages
  - Équipe
  - Sac
  - Boutique

Décisions :
- ordre `Box` avant `Personnages` ;
- bannière d'accueil cohérente avec l'écran Invocation ;
- mêmes données de pity / garantie / brillance ;
- mêmes personnage et artwork ;
- les raccourcis doivent exploiter la hauteur sans scroll global.

---

# 6. BOX / PERSONNAGES / ÉQUIPE / SAC / BOUTIQUE

## 6.1 Box
But :
- montrer uniquement les personnages possédés et actuellement actifs côté jeu ;
- utiliser le même catalogue personnage que l'écran `Personnages`, mais enrichi par la possession propre au joueur ;
- grille de cartes ;
- recherche ;
- filtres ;
- tri ;
- constellation ;
- informations personnelles de possession.

Source métier :
- le catalogue porte les informations du personnage : nom, élément, rareté, assets, etc. ;
- la possession joueur/personnage porte notamment constellation, copies, première obtention et favori ;
- un seul enregistrement de possession par couple joueur/personnage.

Onglets UI :
- `Tous` ;
- `5★` ;
- `4★`.

Persistance UI :
- le tri choisi est mémorisé entre sessions ;
- les filtres et l'onglet courant ne sont pas mémorisés ;
- au retour dans Box, l'onglet revient sur `Tous`.

Tris actuellement validés :
- alphabétique ;
- date de première obtention ;
- constellation ;
- élément.

Pas de tri `copies` prévu actuellement.

Ordre :
- les favoris sont toujours remontés avant les non-favoris ;
- un 4★ favori peut donc apparaître avant un 5★ non favori ;
- dans chaque groupe favoris/non-favoris, les 5★ restent avant les 4★ ;
- le tri actif s'applique à l'intérieur de chaque groupe/rareté.

État par défaut :
- onglet `Tous` ;
- tri alphabétique ascendant.

Fiche d'un personnage possédé :
- première date d'obtention ;
- constellation ;
- copies ;
- favori ;
- futures statistiques propres au personnage ajoutées par leurs domaines respectifs, par exemple plus gros dégâts, victoires ou défaites lorsque Combat sera audité.

Twitch/chat :
- les présentations historiques de `!box`, pages, tris et `!box favoris` peuvent rester différentes de l'UI standalone ;
- la source métier de possession/favoris reste commune.

Filtres UI Box :
- onglets `Tous` / `5★` / `4★` ;
- filtre élément ;
- filtre constellation complet C0 à C6 ;
- recherche ;
- filtres combinables ;
- tri.

Cartes :
- ne pas afficher le nombre de copies ;
- constellation visible ;
- favori directement modifiable dans la Box personnelle.

Fiche personnage :
- fiche commune avec l'écran `Personnages` ;
- constellation ;
- copies ;
- première obtention ;
- `Favoris : Oui/Non` ;
- futures statistiques propres au personnage ajoutées par leurs domaines.

Résumé Box :
- total de personnages actifs/visibles ;
- nombre de 5★ ;
- nombre de 4★ ;
- nombre de C6 ;
- pas de total copies dans ce résumé.

Box publique :
- consultable depuis le profil d'un autre joueur si les permissions le permettent ;
- consultable même lorsque le propriétaire est hors ligne ;
- structure quasi identique à la Box personnelle ;
- mêmes onglets / recherche / filtres / tris ;
- aucune action modifiant les données du propriétaire ;
- pas d'étoile favorite sur les cartes publiques ;
- `Favoris : Oui/Non` peut apparaître dans la fiche ;
- les favoris du propriétaire ne changent pas l'ordre public.

À chaque ouverture d'une Box publique :
- `Tous` ;
- `Alphabétique ↑` ;
- aucun filtre ;
- les réglages de consultation sont temporaires.

Une Box vide conserve sa section avec un état vide graphique propre.

## 6.2 Personnages
But :
- montrer tous les personnages obtenables ;
- coloré si possédé ;
- grisé si non possédé ;
- grille + filtres + tri ;
- inutile d'avoir un bandeau séparé "possédé / non possédé" si le visuel suffit.

Vote Gacha :
- les personnages 5★ éligibles au vote hebdomadaire peuvent afficher leur nombre de votes courant ;
- permettre de voter directement depuis cet écran ;
- réutiliser les filtres / tris / recherche existants plutôt que recréer inutilement une seconde liste complète ;
- une fois le vote utilisé, afficher clairement le choix du joueur pour la semaine.

## 6.3 Équipe

### Modèle général

Chaque joueur possède plusieurs Teams.

Une seule Team est sélectionnée comme active.

Il n'existe pas dans la cible standalone une composition active indépendante copiée depuis un preset :
- la Team sélectionnée est elle-même l'équipe active ;
- l'UI, Twitch et les systèmes métier utilisent cette même Team.

Équipe active :
- 0 à 4 personnages ;
- aucun doublon ;
- une Team vide/incomplète peut rester active ;
- Team 1 active par défaut pour un nouveau joueur ;
- sélection active persistante entre sessions ;
- les domaines consommateurs peuvent imposer leurs propres préconditions.

### Sidebar

La sidebar/colonne gauche :
- affiche la Team active ;
- affiche discrètement son numéro et son nom éventuel ;
- se met à jour immédiatement ;
- est en lecture seule dans la V1.

Préserver une architecture permettant éventuellement son édition future.

### Gestion des Teams

- 10 positions permanentes de base ;
- positions actuelles 1..10 non supprimables ;
- positions 11+ supprimables depuis l'UI ;
- extensions illimitées ;
- contrôle `+` après la dernière Team ;
- créer une Team supplémentaire ne l'active pas ;
- plusieurs Teams supplémentaires peuvent rester vides ;
- une Team supplémentaire active doit être désactivée avant suppression.

Vider ≠ supprimer :
- vider conserve emplacement et nom ;
- supprimer retire l'entité supplémentaire ;
- Twitch/chat ne supprime jamais physiquement une Team.

### Réorganisation des Teams

Drag & drop horizontal dans le bandeau :
- effectué depuis la carte hors de la zone personnages ;
- drop sur une Team = swap ;
- drop entre deux Teams = insertion ;
- les chevrons permettent le déplacement cross-page ;
- renumérotation automatique ;
- sauvegarde immédiate ;
- l'identité UUID reste stable ;
- une Team active déplacée reste active.

La suppression dépend de la position actuelle :
- 1..10 protégées ;
- 11+ supprimables.

L'identité interne ne dépend jamais du numéro affiché.

### Composition

- quatre slots maximum ;
- une Team peut être temporairement 0..4 ;
- ajout, retrait et remplacement direct ;
- sauvegarde immédiate après chaque action valide ;
- aucune composition complète dupliquée entre Teams ;
- l'ordre des personnages n'entre pas dans la détection de doublon.

Drag & drop personnage :
- uniquement horizontalement à l'intérieur de sa Team ;
- ne doit jamais déclencher le déplacement vertical de la Team ;
- ordre uniquement visuel, sans effet gameplay actuel.

### Sélecteur personnage

Ajouter/Changer utilise un sélecteur inspiré de la Box :
- personnages possédés ;
- personnages actifs ;
- recherche temps réel ;
- filtres ;
- personnage déjà présent dans cette Team non sélectionnable.

### Recherche transversale

Pour les listes pertinentes du projet :
- filtrage instantané à chaque caractère ;
- sous-chaîne contiguë uniquement ;
- normalisation casse/accents ;
- pas de fuzzy implicite par lettres dispersées.

Exemple :
`Ya` trouve Yanfei/Yaoyao mais pas Yelan.

Cette direction vaut aussi pour :
- Personnages ;
- Box ;
- joueurs ;
- objets ;
- autres listes de recherche adaptées.

### Noms

- facultatifs ;
- espaces et accents autorisés ;
- maximum cible 20 caractères ;
- noms identiques autorisés.

### Passifs

- uniquement dérivés de la Team active pour le gameplay ;
- jusqu'à deux stacks par élément ;
- Team partielle comprise ;
- recalcul immédiat lors d'une modification ;
- aperçu des passifs également visible sur les autres Teams dans l'écran de gestion ;
- valeurs déjà définies dans le Domaine Gacha.

### Présentation des cartes Team

Cartes/lignes horizontales :
- quatre personnages utilisent la largeur horizontale utile ;
- nom/passifs/informations complémentaires au-dessus ou en dessous ;
- activation séparée de l'édition ;
- contrôle d'activation compact en haut à droite, préférence actuelle pour un interrupteur gauche/droite ;
- Team active visuellement mise en évidence sans changer automatiquement de position.

### Twitch/chat

Commandes cibles principales :
- `!team`
- `!team <N>`
- `!team <N> apply`
- `!team add <nom>`
- `!team remove <nom>`
- `!team remove all`
- `!team <N> remove`
- `!team <N> rename "Nom"`
- `!team rename "Nom"`
- `!team list`
- `!team list <page>`
- `!team new`

Règles :
- `apply` sélectionne une Team comme active ;
- `add/remove` modifient la Team active ;
- `add` utilise le premier slot vide ;
- `remove` d'une Team vide sa composition, ne détruit pas son emplacement ;
- `new` crée la prochaine Team à la fin sans l'activer ;
- `list` pagine 10 Teams ;
- alias `liste` accepté mais non mis en avant ;
- `save` / `save N` ne modifient plus les données et renvoient un helper de syntaxe ;
- helpers courts, une seule syntaxe recommandée ;
- aucune formulation donnant l'impression d'une migration ;
- réponses Twitch sur une seule ligne ;
- aucune confirmation en plusieurs étapes sur Twitch.

### Visibilité

- équipe active potentiellement publique selon confidentialité ;
- visible même hors ligne ;
- Team vide/incomplète affichée telle quelle ;
- numéro visible avec la Team ;
- nom soumis à la granularité future de confidentialité ;
- passifs visibles uniquement si la Team elle-même est visible ;
- Saved Teams privées par défaut, configurables Public/Amis/Privé et consultables uniquement en lecture seule par un tiers autorisé ;
- personnages de la Team publique ouvrables via la fiche publique commune.

### Désactivation personnage

- Team active → retirer uniquement le personnage ;
- position 1..10 contenant ce personnage → vider la composition complète ;
- position 11+ contenant ce personnage → supprimer la Team supplémentaire ;
- aucune restauration automatique à la réactivation.

### Migration

Le legacy possède encore `team` + `savedTeams`.

La cible devra convertir ces deux états vers :
- collection de Teams ;
- identité de la Team active.

Stratégie détaillée à finaliser pendant la dernière passe de migration Team.

## 6.4 Sac

Le Sac est la vue complète des possessions pertinentes du propriétaire.

La sidebar reste un résumé compact.

Le Sac complet est privé :
- aucun autre joueur ne peut ouvrir le véritable écran Sac ;
- les informations publiques passent par les sections dédiées du profil et leurs règles de confidentialité.

### Catégories V1

- `Tout`
- `Ressources`
- `Objets`
- `Collection`

### Ressources

Inclure notamment :
- Primogemmes ;
- Moras ;
- particules des sept éléments.

Dans le Sac réel 0.74, la catégorie historiquement nommée `Monnaies` utilise le libellé `Ressources`. Sa carte Moras est une surface accessible menant à l'écran Banque et porte le texte discret `Accéder à la Banque`.

Les ressources à quantité `0` restent visibles, y compris dans `Tout`.

Le nombre d'invocations possibles :
- reste dérivé de `Primogemmes / 160` ;
- peut être affiché dans le Sac ;
- n'est jamais persisté ;
- reste hors sidebar.

### Objets

Contient les objets spéciaux persistants.

Premier objet confirmé :
- Masterless Stella Fortuna.

Stella :
- quantité visible ;
- utilisable depuis sa fiche dans le Sac ;
- ouvre un picker des 5★ éligibles ;
- réutilise strictement le service métier Stella déjà validé.

### Collection

L'ancien Coffre legacy devient la Collection.

Ordre :
1. objets possédés ;
2. objets non possédés ;
3. alphabétique dans chacun des groupes.

Cartes :
- quantité visible, y compris `x1` ;
- non possédés visibles ;
- hover = méthode d'obtention courte ;
- clic = fiche détaillée.

Compteur :
- objets distincts connus possédés / total connu ;
- aucun compteur global d'exemplaires ;
- les IDs inconnus ne faussent pas le compteur.

Fiche :
- description ;
- quantité ;
- origine ;
- méthode d'obtention ;
- historique d'obtention.

Legacy sans dates :
- fallback à la date de migration ;
- provenance interne traçable ;
- ne jamais inventer d'ancienne date.

ID legacy inconnu :
- possession conservée ;
- placeholder joueur ;
- ID original conservé en interne ;
- rattachement futur si correspondance certaine.

Confidentialité :
- Collection potentiellement Public / Amis / Privé ;
- quantité et méthode d'obtention visibles lorsque la Collection l'est ;
- historique d'obtention prévu comme sous-information contrôlable par confidentialité granulaire.

Twitch/chat :
- `!sac` = consultation personnelle ;
- pas de `!sac <pseudo>` ;
- Primogemmes + invocations possibles ;
- Moras ;
- élément principal en premier dans les particules ;
- six autres éléments ensuite ;
- objets spéciaux persistants possédés ;
- Collection conservée séparément via `!coffre`.

`!coffre` :
- objets possédés uniquement ;
- ordre alphabétique.

## 6.5 Boutique

La Boutique standalone est pilotée par un catalogue serveur dynamique.

### Catalogue

Un article peut notamment définir :
- ID ;
- nom ;
- description ;
- visuel ;
- prix ;
- monnaie ;
- `displayOrder` ;
- visibilité ;
- disponibilité ;
- type d'effet ;
- règles de quantité ;
- limite d'achat éventuelle.

Ordre initial :
1. Mission ;
2. Primos ;
3. Ticket.

Trois états :
- visible + achetable ;
- visible + indisponible ;
- masqué.

Un article indisponible affiche une raison utile lorsque connue.

Le catalogue peut supporter des limites par joueur/période.

Aucune nouvelle limite n'est imposée aux articles actuels par défaut.

Pas de stock mondial partagé en V1.

L'architecture peut permettre cette évolution plus tard si une vraie mécanique le justifie.

### Primos

Un lot :
- 50 000 Moras ;
- +160 Primogemmes.

Quantité multiple autorisée.

UI :
- quantité ;
- coût total ;
- gain total ;
- `MAX`.

Twitch/chat :
- `!shop primos <quantité>`
- `!shop primos max`

### Ticket

Prix legacy courant :
- 150 000 Moras.

V1 :
- achat immédiat ;
- consommation immédiate ;
- un Ticket à la fois ;
- aucune confirmation préalable ;
- résultat visuel immédiatement après achat ;
- probabilités affichées depuis les poids du catalogue.

Récompenses actuelles :
- +1 600 Primogemmes ;
- +1 000 particules principales ;
- +800 particules d'un autre élément ;
- +10 pity 5★ ;
- +50 000 Moras.

Le `+10 pity` passe exclusivement par le moteur Gacha et reste plafonné à 90.

### Mission quotidienne

Achat initial accessible depuis :
- Boutique ;
- écran Missions.

Même action métier.

V1 :
- coût : 10 000 Moras ;
- récompense : 800 Primogemmes auto-claim ;
- pool initial : 10 messages éligibles / 5 Pulls / 320 particules converties ;
- progression uniquement à partir de l'attribution ;
- mission exacte inconnue avant paiement/tirage ;
- ne pas afficher les pourcentages/chances de tirage au joueur ;
- une mission terminée reste visible avec `✅ Terminée` jusqu'au reset.

Après achat du jour :
- carte toujours visible ;
- état indisponible explicite côté Boutique.

Switch :
- principalement depuis Missions ;
- 20k Moras puis coût doublé ;
- mission obligatoirement différente ;
- progression remise à zéro ;
- confirmation UI uniquement lorsqu'une progression >0 sera perdue.

Twitch/chat conserve :
- `!shop mission`
- `!shop switch`

Les règles détaillées B/A/S/Z et de progression sont documentées dans `docs/legacy/11-missions-daily-audit.md`.

### Twitch/chat

`!shop` utilise `displayOrder`.

Si plus de 5 articles visibles :
- `!shop` = page 1 ;
- `!shop <page>` ;
- 5 articles maximum par page.

Les articles visibles mais indisponibles restent affichés avec leur état.

Les articles masqués sont absents.

Toujours une seule ligne par réponse Twitch.

### Historique

La Boutique affiche quelques achats récents.

`Voir tout` ouvre :
- écran global `Historique` ;
- catégorie `Boutique / Achats`.

L'historique détaillé Shop est Amis uniquement par défaut (R908), configurable Public/Amis/Privé.

Ne jamais fabriquer d'historique legacy absent.

### Sécurité

Tout achat est atomique/idempotent.

Débit + effet + récompense + journalisation :
- réussissent ensemble ;
- ou aucun effet n'est conservé.

Les effets sensibles sont délégués au service métier propriétaire.

## 6.6 Objectifs personnels — FUTUR / DIRECTION VALIDÉE

Prévoir plus tard un système transversal `Objectifs`.

Exemples de catégories :
- obtenir un personnage précis ;
- atteindre un montant de Primogemmes ;
- atteindre un montant de Moras ;
- pour les Moras, possibilité future de choisir si la Banque est incluse ;
- autres types à définir dans un audit dédié.

UX envisagée :
- écran `Objectifs` dédié ;
- possibilité de définir un personnage comme objectif depuis l'écran `Personnages` ;
- si ce personnage apparaît dans une bannière, afficher une indication discrète comme `🎯` ;
- lorsqu'un objectif est atteint, il est automatiquement considéré comme terminé/retiré ;
- possibilité d'une notification d'accomplissement.

Architecture :
- ne pas coder séparément une logique d'objectif dans chaque domaine ;
- les systèmes métier produisent leurs changements/événements autoritatifs ;
- un futur service Objectifs évalue les objectifs concernés.

La liste exacte des catégories, limites et historiques sera définie plus tard.

## 6.7 Confidentialité joueur — VALIDÉE R463–R521

Prévoir dans l'écran `Paramètres` un onglet `Confidentialité`.

Valeurs possibles pour chaque rubrique configurable :
- `Public` ;
- `Amis uniquement` ;
- `Privé`.

Identité toujours visible :
- pseudo ;
- avatar ;
- niveau ;
- élément.

Valeurs initiales communes aux comptes migrés et nouveaux :

| Rubrique | Valeur initiale |
|---|---|
| Pseudo, avatar, niveau, élément | Toujours visible |
| Team active | Public |
| Box | Public |
| Collection | Public |
| Statistiques générales | Public |
| Missions | Public |
| Dernière activité | Public |
| Pity et garantie | Public |
| Liste d'amis | Amis uniquement |
| Autorisation de recevoir des MP | Public |
| Soldes de monnaies | Privé |
| Banque | Privé |
| Sac | Privé |
| Saved Teams | Privé |
| Expedition active | Privé |
| État Combat quotidien | Privé |
| Slots, KO et composition Boss | Privé |
| Historiques détaillés | Privé |

Toutes les rubriques non marquées `Toujours visible` restent configurables Public/Amis/Privé.

La granularité cible est une rubrique métier cohérente, avec sous-rubrique seulement lorsqu'elle apporte une vraie valeur. Elle ne descend pas par défaut jusqu'à chaque champ ou slot atomique.

Clarifications :
- Sac exact, Saved Teams, états tactiques et historiques détaillés sont Amis uniquement par défaut depuis R908 et peuvent être configurés Public/Amis/Privé ;
- Missions, statistiques, Box, Collection, Team active et pity/garantie sont publiques par défaut ;
- les règles de secret Z restent prioritaires même si Missions est public ;
- la liste d'amis est Amis uniquement par défaut ;
- la visibilité de la présence possède son propre réglage Public/Amis/Privé, Public par défaut ;
- le réglage MP contrôle qui peut écrire, jamais qui peut lire le contenu ;
- le contenu des MP reste toujours limité aux participants, sauf contexte volontairement joint à un signalement.

Consultation :
- une rubrique autorisée réutilise la vraie vue du domaine en lecture seule ;
- les actions de mutation sont absentes pour le visiteur ;
- une section inaccessible reste visible avec un état de confidentialité ;
- distinguer clairement contenu vide et contenu privé ;
- ne jamais afficher une fausse valeur zéro à la place d'une donnée privée.

Sécurité :
- appliquer les permissions côté serveur avant de récupérer ou retourner les données ;
- ne jamais dépendre uniquement du masquage frontend ;
- ne jamais envoyer au client une donnée privée pour ensuite seulement la cacher ;
- empêcher les déductions indirectes permettant de reconstruire une donnée privée.

---

# 7. ASSETS INTÉGRÉS

Structure publique créée :

`public/assets/genshin/`

Sous-dossiers :
- `characters/icons`
- `characters/splash`
- `characters/wish`
- `characters/fullbody`
- `elements`
- `currencies`
- `items`
- `ui`
- `metadata`

Volumes actuels :
- icons : 98
- splash : 98
- wish : 98
- fullbody : 118

Éléments :
- anemo
- cryo
- dendro
- electro
- geo
- hydro
- pyro
- variantes badge

Monnaies :
- primogem
- mora
- acquaint-fate
- intertwined-fate

Mapping :
- `gi_characters.json`
- `gachaimpact_characters.json`
- `asset_mapping_report.json`

Résultat du mapping :
- 118 / 118 fullbody correctement mappés ;
- 96 personnages ont aussi icon/splash/wish historiques ;
- 22 plus récents utilisent notamment fullbody ;
- aucun doublon de chemin ;
- aucun ambiguous pour fullbody.

---

# 8. SOURCES LEGACY INTÉGRÉES AU PROJET

Chemin :
`legacy/streamerbot/`

## 8.1 Commandes
`legacy/streamerbot/commands/`

37 fichiers :
- Ami
- Banniere
- Banque
- Box
- Code
- Coffre
- Combat
- Concours
- Convertir
- Daily
- Echanger
- Element
- Event
- Expedition
- Faveur
- Gift
- Giveaway
- Help
- Infos
- Legende
- Liste
- Missions
- Obtention
- Passif
- Pity
- Pull
- Roue
- Sac
- Select
- Shop
- Stella
- Subscription
- Team
- Top
- Vote
- Wish
- XP

Règle d'analyse :
- lire le commentaire d'en-tête ;
- NE JAMAIS supposer qu'il est complet ;
- toujours inspecter le code réel ;
- relever les ajouts non documentés ;
- relever les données lues/écrites ;
- relever les duplications de logique ;
- relever les dépendances.

---

## 8.2 Data
`legacy/streamerbot/data/`

17 JSON :
- banner_votes.json
- c6_characters.json
- combat_config.json
- combat_data.json
- contests_data.json
- element_passives.json
- friendships_data.json
- genshin_characters.json
- gift_codes.json
- giveaway.json
- long_missions.json
- missions_pool.json
- monthly_boss.json
- monthly_events.json
- monthly_events_data.json
- shop_items.json
- viewers_data.json

Décision importante :
- le modèle joueur complet ne vit PAS uniquement dans `viewers_data.json` ;
- certaines données sont réparties entre plusieurs JSON ;
- il faut reconstruire le profil agrégé complet.

---

# 9. PROFIL CANONIQUE LEGACY : KICHNIFOU

Décision :
- `Kichnifou` est la référence principale pour comprendre le modèle joueur actuel ;
- raison : profil très actif, passé par les versions les plus récentes, contenant le maximum de sections ;
- les autres profils servent à détecter :
  - anciennes structures ;
  - champs manquants ;
  - null ;
  - sections ajoutées plus tard ;
  - cas limites de migration.

Important :
- ne pas copier aveuglément Kichnifou en schéma SQL ;
- utiliser Kichnifou comme photographie la plus complète du modèle métier actuel ;
- vérifier chaque champ avec le script qui le manipule avant de figer la cible.

---

# 10. IDENTITÉ JOUEUR — DÉCISIONS VALIDÉES

Le futur compte GachaImpact doit avoir :
- ID interne immuable ;
- pseudo GachaImpact choisi par le joueur ;
- pseudo GachaImpact affiché dans le jeu ;
- liaison Twitch optionnelle ;
- conservation du pseudo / identifiant Twitch pour correspondance legacy.

Le pseudo Twitch ne devient PAS automatiquement le pseudo GachaImpact.

Un joueur peut jouer sans Twitch.

Pour récupérer son ancien profil Streamer.bot :
- il crée/se connecte à un compte GachaImpact ;
- il lie son Twitch ;
- le système retrouve le profil legacy correspondant ;
- les données sont importées.

Bots connus :
- StreamElements
- WizeBot
- autres bots identifiés
=> exclus de la migration.

### Entrée Twitch sans compte standalone

Décision :
- un joueur peut commencer et continuer à jouer depuis Twitch sans avoir créé de compte web GachaImpact ;
- le backend lui associe un joueur interne Twitch-only ;
- la liaison autoritative repose sur le Twitch User ID stable, jamais sur le pseudo comme clé métier ;
- elle peut progresser via ses messages jusqu'au seuil d'onboarding Twitch ; direction validée : niveau 2 ;
- si elle n'a pas choisi d'élément à ce stade, le jeu lui demande de le faire puis bloque les mécaniques actives tant que l'élément n'est pas choisi ;
- `!element <élément>` reste la porte d'activation naturelle du profil Twitch.

Si ce joueur crée plus tard un compte web :
- il choisit `Connecter Twitch` ;
- l'identité Twitch est vérifiée ;
- si le Twitch User ID possède déjà un profil Twitch-only, le compte web est rattaché à ce même joueur interne ;
- ne pas créer un second profil ;
- ne pas recommencer sa progression ;
- ne pas copier les données : elles appartenaient déjà au même joueur interne.

Règle centrale d'activation Twitch :
- un profil Twitch-only peut exister avant d'être pleinement activé ;
- `élément choisi` est le verrou canonique indiquant que ce joueur participe réellement au jeu ;
- lorsqu'un ancien script utilise un niveau minimum uniquement comme filtre d'onboarding / activité réelle, la V1 doit préférer cette règle centrale plutôt qu'un seuil de niveau spécifique ;
- les vraies préconditions métier propres aux systèmes restent évidemment inchangées ;
- le standalone impose l'élément dans son onboarding et satisfait donc naturellement cette règle.

Anciens joueurs Streamer.bot :
- leurs données historiques suivent la stratégie de migration legacy déjà prévue ;
- la liaison Twitch ultérieure permet de retrouver leur identité migrée.

Direction intégration Twitch :
- prévoir un service serveur de pont Twitch, conceptuellement `TwitchBridge` ;
- réception des messages Twitch via les mécanismes Twitch prévus pour les chatbots ;
- résolution Twitch User ID → joueur interne ;
- appel des mêmes services métier que l'UI/chat interne ;
- réponse sur Twitch via le compte bot ;
- Streamer.bot ne fait pas partie de l'architecture finale.

L'implémentation technique exacte OAuth/EventSub/bot sera définie avec le backend et le domaine Twitch.

---

# 11. PROGRESSION JOUEUR

## 11.1 Niveau
- niveau max : 100 ;
- 30 XP par palier ;
- gain par message éligible selon longueur : +1 XP jusqu'à 100 caractères, +2 XP de 101 à 200, +3 XP au-delà ;
- au niveau 100 :
  - le niveau reste 100 ;
  - la progression continue ;
  - une récompense d'overflow est redonnée tous les 30 XP supplémentaires.

Récompense de level-up V1 validée :
- +800 primogemmes ;
- +10 000 moras ;
- à partir du niveau 5 : +80 particules de l'élément personnel ;
- à partir du niveau 10 : +40 particules d'un autre élément aléatoire.

Ces montants sont conservés pour la V1 ; l'équilibrage global de l'économie sera traité plus tard.

Direction standalone validée :
- le gain d'XP par messages est conservé avec les règles legacy actuelles : +1/+2/+3 XP selon la longueur du message éligible et cooldown de 2 secondes ;
- les commandes et les actions ordinaires du jeu ne donnent pas directement d'XP ;
- cette règle reste identique quel que soit le canal utilisé pour déclencher une mécanique : UI, chat interne ou Twitch ;
- le standalone disposera d'un mode/activité dédié permettant aux joueurs utilisant principalement l'interface de gagner de l'XP, probablement sous forme de mini-jeux ou d'épreuves rapides ;
- ce mode disposera d'un plafond quotidien d'XP à définir ;
- XP chat et XP du mode dédié sont cumulables ;
- nom, contenu, plafond et équilibrage de ce mode seront conçus plus tard.

Compteurs de messages validés :
- conserver les valeurs legacy `totalMessages` et `countedMessages` à la migration sans recalcul ;
- `totalMessages` = vrais messages envoyés par le joueur sur Twitch ou dans le chat interne, commandes comprises, hors réponses bot/système ;
- `countedMessages` = messages ayant réellement donné de l'XP ;
- l'XP du futur mode interface n'incrémente pas `countedMessages` ;
- cooldown XP de 2 secondes global au joueur entre Twitch et chat interne.

Tutoriels de niveau validés :
- conserver la découverte progressive historique associée aux montées de niveau ;
- montée provoquée par XP de chat → tutoriel dans le canal de chat concerné ;
- montée provoquée par le futur mode XP de l'interface → notification dans la zone Notifications avec orientation vers la fonctionnalité concernée ;
- les messages tutoriels legacy ne sont pas considérés comme preuve d'un verrou métier : les prérequis exacts seront confirmés dans les audits dédiés.
Source de vérité progression validée :
- l'XP cumulée est la source de vérité métier du niveau ;
- formule V1 : `niveau = min(floor(xp / 30), 100)` ;
- le niveau ne doit pas évoluer indépendamment de l'XP ;
- pendant la migration, une incohérence XP/niveau doit être signalée plutôt que corrigée silencieusement.

Gains multi-paliers validés :
- une attribution d'XP peut faire franchir plusieurs niveaux ;
- toutes les récompenses de chaque niveau intermédiaire doivent être attribuées ;
- toutes les découvertes/tutoriels concernés restent traités ;
- une montée multiple via le futur mode XP interface doit être clairement visible dans la liste Notifications.

Niveau 100 :
- conserver `level100OverflowRewardsClaimed` legacy ou un état futur strictement équivalent ;
- plusieurs paliers d'overflow gagnés en une fois donnent toutes les récompenses correspondantes ;
- leur multiplicité doit être clairement visible pour le joueur.

XP V1 :
- cumulative ;
- non dépensable ;
- aucun reset.

Idées futures uniquement :
- niveau réel supérieur à 100 ;
- prestige / rebirth.

## 11.2 Niveau des personnages
Actuellement :
- les personnages NE MONTENT PAS DE NIVEAU.

Idée future :
- ajouter un système de niveaux/progression des personnages.
Statut :
- FUTUR / À CONCEVOIR
- ne pas inventer de modèle maintenant.

---

# 12. ÉLÉMENT DU JOUEUR

Le joueur choisit un élément au début via `!element`.

Valeurs :
- Pyro
- Hydro
- Cryo
- Electro
- Anemo
- Geo
- Dendro

Règles validées :
- choix unique ;
- non modifiable ensuite ;
- donnée métier permanente ;
- détermine les particules attitrées du joueur ;
- dans l'application standalone, le choix de l'élément est obligatoire pendant l'inscription/onboarding ;
- le joueur possède donc déjà un élément lorsqu'il se trouve au niveau 1 ; le verrou legacy « niveau 1 sans élément » ne s'applique pas au parcours standalone ;
- côté Twitch, un nouveau chatter peut être enregistré et progresser jusqu'au seuil d'onboarding (direction validée : niveau 2), puis les mécaniques actives sont bloquées tant que `!element` n'a pas été utilisé.

Exemple :
joueur Cryo
=> particules Cryo = particules personnelles.

Particules personnelles :
- convertibles manuellement en Primogemmes ;
- taux V1 validé : 1:1 ;
- toute quantité entière >= 1 dans la limite du stock ;
- logique métier unique accessible depuis UI / chat interne / Twitch.

Particules des autres éléments :
- échangeables avec des joueurs d'un élément différent ;
- échange symétrique X contre X ;
- stock disponible = total - réservé ;
- une seule demande active entre une même paire ;
- règles détaillées documentées dans `docs/legacy/05-element-resources-audit.md`.

---

# 13. RESSOURCES

## 13.1 Primogemmes
Usage actuel validé :
- uniquement pour les pulls / invocations.

## 13.2 Moras
### Intérêt bancaire V1 — décision validée
- taux quotidien conservé : **3 %** ;
- calcul automatique côté serveur au reset global de **00:00 `Europe/Paris`** ;
- aucune activité du joueur n'est nécessaire ;
- base de calcul : solde bancaire présent exactement au moment du reset ;
- arrondi à l'entier inférieur ;
- les gains alimentent également l'équivalent futur de `stats.totalMorasEarned` ;
- les intérêts continuent donc à être appliqués quotidiennement même lorsque le joueur est absent.

Principe architectural associé :
une mécanique dépendant uniquement du temps serveur ne doit plus être artificiellement déclenchée par un message ou une autre action joueur lorsque le backend peut l'exécuter lui-même.

## 13.3 Particules
7 types élémentaires :
- Pyro
- Hydro
- Cryo
- Electro
- Anemo
- Geo
- Dendro

Conversion V1 validée :
- le joueur peut posséder les sept types ;
- seules les particules correspondant à son élément personnel sont directement convertibles ;
- taux : 1 particule = 1 Primogemme ;
- conversion volontaire/manuelle ;
- toute quantité entière >= 1 dans la limite du stock.

Échanges V1 — décisions déjà validées :
- uniquement entre joueurs d'éléments différents ;
- chacun donne des particules de l'élément de l'autre ;
- chacun reçoit donc des particules de son propre élément ;
- échange symétrique X contre X ;
- auto-échange interdit ;
- une seule demande active entre une même paire ;
- seul le stock engagé par l'expéditeur est réservé ;
- le stock du destinataire est vérifié à la création mais reste libre jusqu'à acceptation ;
- stock disponible expéditeur = stock total - réservations de ses demandes envoyées ;
- si la disponibilité du destinataire baisse, la demande diminue automatiquement ;
- une demande réduite ne remonte jamais automatiquement ;
- à montant 0, elle disparaît silencieusement ;
- toute réduction libère immédiatement la réservation correspondante de l'expéditeur ;
- annulation/refus libère le stock réservé ;
- expiration des demandes au reset serveur de 00:00 `Europe/Paris` ;
- expiration automatique, indépendante de l'activité joueur.
- toute transaction modifiant un stock de particules réconcilie immédiatement les demandes concernées ;
- `Refuser tout` disponible pour les demandes reçues ;
- participants référencés côté métier par IDs internes immuables, jamais par pseudo ;

UI cible :
- écran dédié avec demandes reçues et envoyées ;
- possibilité de traiter plusieurs demandes ;
- affichage clair du stock réellement échangeable ;
- notification agrégée indiquant le nombre de demandes reçues en attente et menant vers cet écran.
- bouton `MAX` remplissant le champ quantité ;
- `Accepter tout` traite les demandes de la plus ancienne à la plus récente ;
- pas d'acceptation partielle manuelle ;
- liste normale limitée aux partenaires réellement échangeables.
- historique récent des transactions dans l'écran Échanges : environ 3 visibles, scroll jusqu'à environ 20–30 dernières.

Important :
- le legacy duplique chaque demande en `sent` / `received` dans les deux profils ;
- ne pas reproduire automatiquement cette duplication dans la future DB ;
- le modèle cible devra avoir une source de vérité unique pour chaque demande.

Historique futur :
- ne pas inventer d'historique d'échanges legacy absent ;
- à partir de GachaImpact, journaliser les opérations importantes d'échange côté serveur ;
- historique complet conservé côté serveur pour audit, diagnostic et statistiques futures ;
- seule une fenêtre récente d'environ 20–30 transactions est affichée dans l'écran Échanges.
- idée future : écran de statistiques joueur / globales du jeu.

Migration :
- les demandes legacy encore en attente ne sont pas migrées ;
- aucune réservation temporaire associée n'est conservée au cutover ;
- les soldes réels de particules restent évidemment migrés.

Balayage global des particules :
- les usages métier fondamentaux actuels identifiés sont Conversion et Échange ;
- de nombreuses mécaniques peuvent générer des particules ;
- ne pas inventer de nouvelle dépense en particules pendant la migration ;
- les incohérences legacy de statistiques sont corrigées à partir de GachaImpact sans reconstruction rétroactive incertaine.

## 13.4 Principes globaux de ressources

Source de vérité :
- les soldes courants sont les sources de vérité financières ;
- les compteurs cumulés `Earned/Spent` servent aux statistiques ;
- le futur journal des mutations sert à la traçabilité.

Mutations :
- toute mutation de ressource passe par une logique métier centrale ;
- chaque mutation possède une cause/source métier ;
- aucune ressource ne peut devenir négative ;
- aucun plafond artificiel n'est imposé en V1.

Statistiques :
- `totalPrimosEarned` = Primogemmes générées/créditées par le jeu ;
- `totalPrimosSpent` = Primogemmes définitivement consommées ;
- `totalMorasEarned` / `totalMorasSpent` suivent la même logique ;
- `totalMainElementParticlesEarned` = particules de l'élément personnel générées comme récompense ;
- un transfert joueur↔joueur n'est pas un gain généré ;
- les compteurs legacy sont migrés tels quels sans reconstruction incertaine.

Sécurité :
- opérations économiques multi-étapes atomiques/transactionnelles ;
- protection contre double clic / retry / double exécution ;
- journalisation des mutations importantes ;
- stocks/réservations vérifiés côté serveur.

Automatisation :
- une mécanique dépendant du temps ou d'un état serveur fonctionne même joueur hors ligne ;
- l'activité/message joueur ne sert plus artificiellement de scheduler.

UI :
- toute modification autoritative est répercutée sans F5 dans toutes les vues concernées ;
- une même ressource ne doit pas présenter plusieurs valeurs divergentes dans différents écrans.

Moras :
- portefeuille et banque restent deux soldes distincts ;
- richesse totale = somme dérivable ;
- les dépenses ordinaires utilisent le portefeuille uniquement.

Données dérivées :
- ne pas persister des valeurs comme le nombre d'invocations possibles si elles peuvent être calculées depuis le solde et le coût courant.

Catégories conceptuelles :
- ressources cœur : Primogemmes, Moras portefeuille, sept particules ;
- solde spécifique : Banque ;
- ressources/objets spéciaux : ex. Masterless Stella Fortuna ;
- ressources temporaires/scopées : monnaies d'Events ;
- collections/inventaire : Coffre et autres objets.

Frontières de responsabilité :
- tous les domaines utilisent la logique centrale Ressources pour modifier un solde ;
- chaque domaine reste propriétaire de ses propres montants, probabilités et conditions ;
- le moteur Ressources ne doit pas devenir un monolithe connaissant toutes les règles du jeu.

## 13.5 Récompense quotidienne
Décision V1 validée :
- +160 primogemmes ;
- +160 particules de l'élément du joueur ;
- +10 000 moras ;
- reset global à 00:00 `Europe/Paris` ;
- jour non réclamé = perdu ;
- aucune accumulation des jours manqués.

Une seule opération métier idempotente doit gérer le claim, qu'il soit déclenché par :
- le bouton `Réclamer` de l'interface ;
- le premier message éligible du chat GachaImpact ;
- le premier message Twitch éligible d'un profil ayant déjà choisi son élément.

Le bloc UI correspondant doit évoluer vers un suivi quotidien plus général avec chevrons `‹` / `›`, masquage pour la journée et préférences futures.

Idées futures non V1 :
- streak de connexion avec bonus au 7e jour consécutif ;
- calendriers de connexion événementiels.

---

# 14. PERSONNAGES / BOX / CONSTELLATIONS — AUDIT CLÔTURÉ

Document spécialisé :
`docs/legacy/07-box-possession-obtention-audit.md`

## 14.1 Catalogue et possession

Séparer conceptuellement :
- le personnage du catalogue ;
- la possession de ce personnage par un joueur.

Une seule possession par couple joueur/personnage.

La possession porte notamment :
- `constellation` ;
- `copies` ;
- `firstObtainedAt` ;
- statut favori ;
- futures données personnelles du personnage si nécessaire.

## 14.2 Première obtention

Première copie :
- `copies = 1` ;
- `constellation = 0` ;
- `firstObtainedAt` initialisé.

`firstObtainedAt` reste ensuite immuable.

Dans l'UI, cette date est consultable depuis la fiche Box du personnage.

## 14.3 Doublons

Deuxième copie :
- C1.

Troisième :
- C2.

...

Septième :
- C6.

À partir de la huitième :
- constellation reste C6 ;
- `copies` continue à augmenter.

## 14.4 Masterless Stella Fortuna

Dans GachaImpact, une Stella utilisée sur un personnage 5★ compte comme une copie synthétique :
- `copies +1` ;
- si le personnage est inférieur à C6 : `constellation +1` ;
- si le passage atteint C6 : initialisation normale du système Concours ;
- si le 5★ est déjà C6 : progression Concours correspondante.

Règles supplémentaires :
- Stella interdite sur tous les personnages 4★ ;
- Stella ne donne jamais le remboursement Primogemmes d'un doublon C6+ obtenu via Pull ;
- si un 5★ C6 possède déjà toutes ses statistiques Concours au maximum, l'utilisation est refusée avant consommation ;
- aucune compensation +100 000 Moras via Stella dans ce cas ;
- validation, consommation et mise à jour doivent être transactionnelles ;
- `!stella` côté texte exige le nom exact après normalisation casse/accents ;
- ne pas accepter de nom partiel, fuzzy matching ou ID technique ;
- l'UI demande confirmation avant consommation.

Correction legacy :
`Stella.txt` augmente actuellement la constellation sans augmenter `copies` et autorise certains 4★ ; ces comportements ne sont pas conservés.

## 14.5 Favoris

- favoris uniquement pour les personnages possédés ;
- aucune limite ;
- favoris visibles dans Box, pas comme favoris dans l'écran catalogue Personnages ;
- favoris toujours remontés en haut de la Box ;
- ordre interne dépend du tri actif ;
- Twitch `!box favoris` conserve son affichage legacy propre.

## 14.6 Données dérivées

Ne pas stocker inutilement :
- nombre de personnages possédés ;
- nombre de C6 ;
- total de copies.

Ces valeurs sont dérivées depuis les possessions actives/visibles.

## 14.7 Personnage désactivé

Un personnage désactivé est entièrement invisible et inutilisable côté joueur :
- Personnages ;
- Box ;
- Team ;
- passifs ;
- Expedition ;
- Combat ;
- votes ;
- bannières ;
- autres usages player-facing.

Ses données et anciennes relations restent conservées côté serveur/Admin.

Conséquences Team conformément à R185 :
- dans la Team active, quelle que soit sa position, retirer uniquement les slots du personnage désactivé et conserver Team, nom, état actif et autres membres ;
- dans une Team non active en position courante 1..10, vider toute la composition et conserver Team, UUID, nom et position ;
- dans une Team non active en position courante 11+, supprimer la Team et compacter une seule fois les positions suivantes sans modifier les UUID survivants ;
- une réactivation ultérieure ne restaure aucun slot ni aucune Team supprimée ;
- annuler une Expedition active sans consommer la tentative quotidienne ;
- historiques player-facing : afficher un placeholder `Personnage indisponible` ;
- statistiques visibles de collection excluent le personnage tant qu'il est désactivé.

## 14.8 Migration Box

Correction certaine de `copies` :

`copiesCible = max(copiesLegacy, constellation + 1)`

Objectif :
- réparer le minimum mathématiquement certain causé notamment par l'ancien comportement Stella ;
- ne jamais inventer davantage de copies.

Favoris orphelins :
- ne créent jamais de possession.

Possession dont le personnage catalogue est introuvable :
- conserver les données ;
- masquer côté joueur ;
- signaler dans le rapport d'import ;
- permettre un rattachement futur après correction du catalogue.

---

# 15. C6 ET STATISTIQUES DE CONCOURS

Source actuelle :
`c6_characters.json`

Pour chaque joueur, certains personnages C6 ont une structure dédiée.

Exemples de données :
- owner
- characterId
- name
- rarity
- element
- weapon
- region
- class
- createdAt

Stats :
- strength
- intelligence
- beauty
- charisma
- popularity

ContestStats :
- totalContests
- totalWins
- victoires par catégorie
- participations par catégorie

Titles :
- titres par statistique

Règles Gacha déjà validées :
- lorsqu'un personnage 5★ atteint C6, ses cinq statistiques Concours sont initialisées à 1 ;
- à partir de la copie suivante, un doublon 5★ C6+ augmente aléatoirement de +1 une statistique encore inférieure à 20 ;
- si toutes les statistiques sont à 20, compensation actuelle : +100 000 Moras ;
- doublon 4★ C6+ : +80 Primogemmes ;
- doublon 5★ C6+ : +160 Primogemmes ;
- `copies` continue d'augmenter après C6 ;
- la future section Concours apparaît seulement aux joueurs possédant au moins un 5★ C6.

À approfondir dans :
- Concours ;
- éventuellement Obtention / autres scripts liés.

Le domaine Gacha ne doit pas absorber toute la logique Concours : il déclenche seulement les hooks appropriés.

---

# 16. DATE DE PREMIÈRE OBTENTION

Pour un personnage possédé :
- conserver la date de la toute première obtention ;
- les copies suivantes ne remplacent pas cette date ;
- une Stella ne remplace pas cette date ;
- l'information est consultable depuis la Box/fiche personnage ;
- il n'existe pas, à ce stade, de besoin validé de stocker l'historique de chaque copie.

Migration :
- date legacy valide → conserver la date réelle ;
- date absente/invalide → utiliser le timestamp du cutover/import comme date fallback ;
- conserver intérieurement la provenance `legacy` ou `migration_fallback` afin de ne pas confondre une date artificielle avec une vérité historique.

---

# 17. SYSTÈME DE BANNIÈRE / GACHA — AUDIT CLÔTURÉ

Document spécialisé :
`docs/legacy/06-gacha-invocation-audit.md`

Sources principales :
- `Banniere.txt`
- `Select.txt`
- `Pull.txt`
- `Pity.txt`
- `Vote.txt`
- génération hebdomadaire présente dans `XP.txt`
- `banner_votes.json`
- `genshin_characters.json`
- `viewers_data.json`

Correction importante :
- `Wish.txt` ne fait pas partie du Gacha ;
- il appartient au Giveaway Twitch ;
- il reste dans le legacy et sera audité plus tard avec les commandes Twitch de giveaway.

## Bannière

Décisions R54–R59 :
- rotation automatique chaque lundi à 00:00 `Europe/Paris` ;
- 4 personnages 5★ + 6 personnages 4★ ;
- aucun personnage 5★ ou 4★ deux semaines consécutives ;
- 3 des 5★ sont tirés aléatoirement ;
- le 4e dépend du vote communautaire pondéré ;
- fallback aléatoire si aucun vote exploitable ;
- un vote définitif par joueur/semaine ;
- cible personnelle obligatoire parmi les quatre 5★ ;
- changement de cible libre ;
- ancienne cible vidée à chaque rotation.

## Pull / Pity

Décisions R60–R65 :
- 160 Primogemmes par Pull ;
- UI x1/x10, aucune remise ;
- chat/Twitch 1 à 10 pulls ;
- pity 5★ : 0,6 % jusqu'à 73, soft pity +6 points/pull à partir de 74, garantie à 90 ;
- pity 4★ : 1,5 % jusqu'à 8, 19,5 % au 9e, garantie à 10 ;
- priorité du 5★ lorsque les deux jets réussissent ;
- obtenir un 5★ ne reset pas la pity 4★ ;
- pity/garantie/Capture traversent les rotations et changements de cible ;
- sans personnage : 50 % Moras 5k–15k ou 50 % particules 20–80 d'un élément aléatoire.

## Catalogue personnages automatique

Direction validée :
- synchronisation externe périodique automatique ;
- pas de validation manuelle obligatoire à chaque nouveau personnage ;
- job séparé des resets critiques du jeu ;
- ne pas importer un personnage incomplet ou non encore réellement sorti ;
- vérifier la date de release ;
- rareté et élément notamment obligatoires ;
- croiser plusieurs sources avec priorité à la confirmation officielle ;
- rechercher les équivalents/localisations françaises ;
- personnage importé correctement -> apparaît naturellement dans l'écran Personnages ;
- ne jamais inventer les champs propres à GachaImpact à partir d'une source externe.

Sources actuelles à revalider lors de l'implémentation :
1. annonces officielles / archives fiables d'annonces officielles pour confirmer la sortie ;
2. Honey Hunter live / autres bases structurées récentes pour les détails ;
3. Gachabase en excluant strictement les données bêta pour confirmer une sortie ;
4. `genshin-db` / API pour données structurées et multilingues lorsqu'il est à jour sur la version courante.

## Administration

Prévoir une vue Admin/Modérateur permettant notamment :
- gestion/correction du catalogue personnages ;
- désactivation/archivage rapide d'un import incorrect ;
- éviter la suppression destructive des personnages déjà référencés ;
- remplacement d'urgence de bannière via action spécifique et journalisée si nécessaire ;
- ajout manuel exceptionnel ;
- corrections de ressources ;
- corrections de possessions/personnages ;
- actions sur un ou plusieurs joueurs ;
- permissions fortes ;
- journalisation des actions sensibles.

Administration initiale :
- Kichnifou = administrateur initial ;
- prévoir plus tard un système de rôles permettant de promouvoir d'autres comptes administrateurs ;
- gestion/révocation des permissions à concevoir dans le futur domaine Admin/Modération.

## 50/50 / Garantie / Capture — R66 à R74 validées

- perte 50/50 → un des trois autres 5★ actifs ;
- garantie normale → cible actuelle au prochain 5★ ;
- garantie prioritaire sur Capture si les deux états coexistent ;
- `captureProgress` séparé du streak ;
- perte 50/50 → Capture +1 ;
- victoire 50/50 → Capture -1 ;
- Capture à 3/3 → cible garantie puis reset 0 ;
- `fiftyFiftyLostStreak` mesure uniquement les vraies pertes consécutives et peut dépasser 3 ;
- vraie victoire 50/50 → streak 0 ;
- garantie/Capture suivent toujours la cible actuelle ;
- `fiftyFiftyWon/Lost` ne comptent que de vrais 50/50 ;
- nouvelle statistique `capturesTriggered`.

## Passifs Pull — R75 à R84 validées

- passifs uniquement depuis la team active ;
- maximum deux stacks par élément ;
- plusieurs éléments et plusieurs procs simultanés possibles ;
- Pyro ×1,25/×1,5 particules secondaires ;
- Geo ×1,25/×1,5 Moras secondaires ;
- Hydro +0,3/+0,6 point de chance 5★ ;
- Cryo 1/20 ou 1/10 pour +1 XP via moteur XP ;
- Electro 1/30 ou 1/20 pour +2 pity appliqué après résolution ;
- Anemo 1/12 ou 1/8 pour +80 Primogemmes ;
- Dendro 1/25 ou 1/15 pour +40 Primogemmes, +1 000 Moras et +5 particules de chacun des sept éléments ;
- chaque Pull individuel d'un x10 effectue ses propres tests.

## Copies / C6 — R85 à R88 validées

- C0 première copie, C6 septième copie ;
- `copies` continue ensuite ;
- C6+ 4★ : +80 Primogemmes ;
- C6+ 5★ : +160 Primogemmes + progression Concours ;
- accès UI Concours uniquement avec au moins un 5★ C6.

## Exécution / historique — R89 à R95 validées

- x10 calculé séquentiellement puis persisté atomiquement avant animation ;
- crash UI après validation serveur = aucune perte de résultat ;
- 4★ uniforme parmi les six actifs ;
- historique complet des Pulls depuis GachaImpact ;
- 10 résultats par page dans l'UI ;
- aucune purge annuelle par défaut ;
- statistiques legacy migrées telles quelles ;
- `lastPullWasFiveStar` devient dérivable ;
- Early / Back-to-back conservés ;
- Hard = 5★ obtenu à partir de pity 80 ;
- stats correspondantes dérivables de l'historique ;
- arrondi Pyro/Geo `.5` vers le haut.

## Finalisation Gacha — R96 à R116 validées

Derniers edge cases :
- votes publics et vote intégré à l'écran Personnages ;
- personnage voté déjà présent parmi les trois 5★ aléatoires correctement géré ;
- aucune bannière invalide/incomplète publiée ;
- nouveau personnage importé en cours de semaine sans modification de la bannière active ;
- `!vote` conserve son fuzzy matching legacy sans confirmation ;
- `!banniere` reste un message Twitch unique ;
- `!pity` n'affiche pas le streak statistique.

Historique :
- écran Historique global ;
- onglets Invocations / Bannières au minimum ;
- snapshots des votes ;
- votes individuels conservés via IDs internes ;
- origine exacte du 5★ communautaire ;
- possibilité future de consulter qui avait voté pour quoi.

Robustesse :
- votes figés avant génération ;
- échec de rotation = ancien cycle conservé + snapshot intact ;
- bannière séparée conceptuellement du catalogue ;
- désactivation/archivage préférée à suppression destructive ;
- cible devenue invalide vidée sans perte de progression ;
- coût complet requis avant x10.

Cutover :
- conserver la bannière legacy active jusqu'à sa rotation normale ;
- migrer les votes actifs ;
- conserver les cibles valides ;
- bannière legacy active = première entrée Historique avec origine `import legacy` ;
- ne jamais inventer les informations historiques inconnues.

Vérification croisée finale effectuée sur :
- `Pull.txt` ;
- `Banniere.txt` ;
- `Vote.txt` ;
- `Select.txt` ;
- `Pity.txt` ;
- génération hebdomadaire de `XP.txt` ;
- JSON liés.

**Domaine Gacha / Invocation : CLÔTURÉ après R116.**

---

# 18. MIGRATION — PRINCIPE CRITIQUE

La migration ne doit PAS être un import jetable exécuté une seule fois.

Pendant le développement :
- les joueurs continuent de jouer via Streamer.bot ;
- leurs JSON continuent d'évoluer.

Il faut donc prévoir une migration / synchronisation réexécutable.

Scénario :

Snapshot JSON A
-> import initial

joueurs continuent à jouer

Snapshot JSON B plus récent
-> update/synchronisation

Snapshot JSON final
-> dernière synchro
-> bascule définitive

Exigences :
- pas de duplication ;
- pas de corruption ;
- import idempotent ;
- reconnaître les joueurs déjà migrés ;
- mettre à jour les données legacy pertinentes ;
- ne pas écraser des données natives créées uniquement dans GachaImpact ;
- tracer si nécessaire la source et la date d'import.

Cette partie devra faire l'objet d'une spécification dédiée.

---

# 19. DONNÉES HISTORIQUES

Décisions validées :
- migrer toutes les statistiques historiques ;
- migrer les dates historiques ;
- conserver premières obtentions ;
- conserver historiques de combats/missions/events si existants ;
- conserver les données même si la fonctionnalité ne sera développée que plus tard.

Précisions dates legacy :
- conserver toutes les dates réellement connues sans recalcul ni invention ;
- interpréter les timestamps Streamer.bot sans timezone comme `Europe/Paris` ;
- conserver séparément la première présence Twitch/legacy et la future date de création du compte GachaImpact ;
- ne pas figer maintenant une unique notion future de `lastSeen` : connexion, présence, activité de jeu et activité chat seront distinguées lors de la conception des domaines concernés.

Champ supposé obsolète :
- marquer `LEGACY / OBSOLÈTE À VÉRIFIER`
- ne pas supprimer tant que la suppression n'a pas été explicitement validée.

---

# 20. DOCUMENTATION DES COMMANDES

Une documentation complète doit être construite au fil de l'audit.

But :
- servir à l'équipe de dev ;
- servir à Codex ;
- servir plus tard de base à la section Aide / Commandes du jeu.

Pour chaque commande documenter :
- nom ;
- syntaxe ;
- alias ;
- arguments ;
- sous-commandes ;
- préconditions ;
- coûts ;
- cooldown ;
- permissions ;
- données lues ;
- données écrites ;
- erreurs ;
- edge cases ;
- interaction avec autres systèmes ;
- comportement Twitch actuel ;
- comportement futur GachaImpact ;
- disponibilité future :
  - UI
  - chat GachaImpact
  - Twitch

Document existant :
`docs/commands/command-reference.md`

---

# 21. DOCS ACTUELLES

Sous `docs/` :

- `README.md`
- `legacy/01-data-sources-inventory.md`
- `legacy/02-current-player-model.md`
- `legacy/03-command-data-matrix.md`
- `legacy/04-xp-audit.md`
- `legacy/05-element-resources-audit.md`
- `legacy/06-gacha-invocation-audit.md`
- `legacy/07-box-possession-obtention-audit.md`
- `legacy/08-team-audit.md`
- `specifications/decisions-log.md`
- `specifications/navigation-shell-v1.md`
- `commands/command-reference.md`
- `roadmap/development-roadmap.md`

Ce document maître vient s'ajouter à cette structure.

---

# 22. ORGANISATION DOCUMENTAIRE RECOMMANDÉE

Structure cible :

docs/
├── README.md
├── master/
│   └── PROJECT_MASTER_PLAN.md
├── legacy/
│   ├── 01-data-sources-inventory.md
│   ├── 02-current-player-model.md
│   ├── 03-command-data-matrix.md
│   └── ...
├── specifications/
│   ├── decisions-log.md
│   ├── target-data-model.md
│   ├── authentication.md
│   ├── migration-strategy.md
│   ├── invocation.md
│   ├── box.md
│   ├── team.md
│   └── ...
├── commands/
│   └── command-reference.md
└── roadmap/
    └── development-roadmap.md

---

# 23. FEUILLE DE ROUTE HISTORIQUE — PLAN INITIAL

Cette section conserve la trajectoire initiale et ses statuts d'époque. Elle n'est plus le tracker courant : l'état physique, le domaine actif et la prochaine étape se trouvent dans le bloc **Point courant** au début du Master, et l'ordre statique V1 dans `docs/roadmap/implementation-order-v1.md`.

## PHASE 0 — Prototype visuel
Statut : TRÈS AVANCÉ / QUASI VALIDÉ

Fait :
- React/Vite ;
- navigation ;
- sidebar ;
- chat ;
- responsive ;
- écrans ;
- assets ;
- Invocation visuelle ;
- Box ;
- Personnages ;
- Équipe ;
- Sac ;
- Boutique.

À garder :
- petites retouches possibles plus tard ;
- ne pas bloquer l'architecture backend dessus.

---

## PHASE 1 — Audit legacy complet
Statut : EN COURS

### 1A — Inventaire des JSON
Fait.

### 1B — Profil canonique Kichnifou
Statut : CARTOGRAPHIE INITIALE RÉALISÉE / ENRICHISSEMENT CONTINU.

Document : `docs/legacy/02-current-player-model.md`.

La première cartographie conceptuelle du profil canonique existe déjà.

Elle continue à être enrichie pendant les audits lorsqu'un domaine :
- précise le rôle d'une propriété ;
- révèle une donnée externe au profil principal ;
- définit une règle de migration ;
- distingue une donnée persistée d'une donnée dérivée ;
- révèle une ancienne structure ou un cas limite joueur.

Cette étape n'est donc pas une tâche non commencée à refaire après les audits : le modèle joueur évolue en parallèle de ceux-ci puis sera consolidé avant le modèle de données cible.

### 1C — Matrice commandes ↔ données
Fait.

Document : `docs/legacy/03-command-data-matrix.md`.

Objectif :
pour chaque script :
- JSON lus ;
- JSON écrits ;
- sections joueur ;
- dépendances ;
- mécaniques dupliquées ;
- triggers ;
- logique réellement métier ;
- logique spécifique Streamer.bot.

### 1D — Audit domaine par domaine
EN COURS.

Premier domaine : `XP.txt` / cycle de vie joueur.
Document : `docs/legacy/04-xp-audit.md`.
Statut : **CLÔTURÉ le 2026-08-27**.

État de validation XP au 2026-08-27 :
- Q1 récompenses de level-up : VALIDÉ ;
- Q2 récompense quotidienne : VALIDÉ ;
- Q3 intérêt bancaire : VALIDÉ — 3 % automatiques au reset serveur de 00:00 `Europe/Paris`, sur le solde présent au reset, sans activité joueur ;
- Q4 modèle de gain d'XP standalone : VALIDÉ — messages +1/+2/+3 avec cooldown 2 secondes conservés, pas d'XP directe sur les actions ordinaires, futur mode XP dédié dans l'interface avec plafond quotidien à concevoir, cumul chat + mode autorisé ;
- principe Q5 onboarding élément standalone : VALIDÉ — choix obligatoire pendant l'onboarding, donc pas de verrou legacy « niveau 1 sans élément » dans le standalone ;
- Q6 tutoriels de montée de niveau : VALIDÉ — rendu dans le chat si le niveau provient d'XP chat, notification UI si le niveau provient du futur mode XP de l'interface ;
- Q7 compteurs/messages/cooldown : VALIDÉ — historique conservé sans recalcul, `totalMessages` et `countedMessages` clairement séparés, cooldown 2 secondes global Twitch + chat interne ;
- Q8 dates/activité : VALIDÉ — dates legacy conservées sans invention, timestamps legacy interprétés en `Europe/Paris`, `firstSeen` Twitch distinct de la création du compte, futurs concepts de dernière activité séparés ;
- Q9 source de vérité XP / multi-level : VALIDÉ — XP source de vérité du niveau, état overflow conservé, toutes les récompenses intermédiaires accordées, XP cumulative/non dépensable, retours UI adaptés aux montées multiples ;
- domaine XP clôturé ; les responsabilités hors XP découvertes dans le script sont reportées vers leurs audits dédiés.

Deuxième domaine : Élément / ressources / conversion / échanges.
Document : `docs/legacy/05-element-resources-audit.md`.
Statut : **CLÔTURÉ le 2026-08-28**.

Décisions validées :
- R1 conversion 1:1 ;
- R2 seules les particules personnelles sont directement convertibles ;
- R3 conversion manuelle ;
- R4 toute quantité entière >= 1 dans la limite du stock ;
- R5 troc élémentaire bilatéral conservé ;
- R6 joueurs d'éléments différents uniquement ;
- R7 échange X contre X ;
- R8 réservation des stocks ;
- R9 une seule demande active par paire ;
- R10 réservation uniquement côté expéditeur ;
- R11 raccourci MAX ;
- R12 Accepter tout ;
- R13 historique serveur futur des échanges ;
- R14 partenaires réellement échangeables uniquement ;
- R15 vérification initiale du stock destinataire ;
- R16 réduction dynamique des demandes ;
- R17 traitement Accepter tout de la plus ancienne à la plus récente ;
- R18 quantité échangeable affichée dans le chat ;
- R19 notification agrégée dynamique ;
- R20 une demande réduite ne remonte pas ;
- R21 libération immédiate des réservations après réduction ;
- R22 plusieurs demandes reçues peuvent viser le même stock non réservé ;
- R23 pas d'acceptation partielle manuelle ;
- R24 historique récent dans l'écran Échanges plutôt que notifications de résolution ;
- R25 Refuser tout ;
- R26 demandes legacy en attente non migrées ;
- R27 IDs internes immuables pour les participants ;
- R28 à R31 usages des particules / définition Main / migration des statistiques : validés ;
- R32 mutation centralisée des ressources avec cause/source : validé ;
- R33 à R38 définitions statistiques économiques / journalisation / soldes sources de vérité : validés ;
- R39 à R44 invariants économiques / atomicité / idempotence / automatisation serveur / stats dérivées : validés ;
- R45 à R50 visibilité joueur / données dérivées / portefeuille-banque / synchronisation UI : validés ;
- R51 à R53 catégorisation des ressources / moteur central partagé / responsabilités des domaines : validés ;
- réconciliation immédiate des demandes après toute modification de stock ;
- expiration des demandes au reset serveur 00:00 `Europe/Paris` ;
- annulation/refus des demandes ;
- écran UI reçues/envoyées ;
- notification agrégée pour les demandes reçues.

Domaine Élément / Ressources / Conversion / Échanges : **CLÔTURÉ**.

Troisième domaine : Gacha / Invocation.
Document : `docs/legacy/06-gacha-invocation-audit.md`.
Statut : **CLÔTURÉ le 2026-08-28**.
Décisions validées :
- R54 à R59 : bannière / rotation / vote / sélection ;
- R60 à R65 : coût / pity / priorité / récompenses secondaires ;
- R66 à R74 : 50/50 / garantie / Capture / statistiques associées ;
- R75 à R84 : passifs élémentaires du Pull ;
- R85 à R88 : copies / C6 / hook Concours ;
- R89 à R95 : atomicité x10 / historique / statistiques / Early-Back-to-back-Hard / arrondis ;
- R96 à R102 : derniers edge cases Bannière / Vote / Pity ;
- R103 à R112 : historique global / historique bannière-votes / robustesse / Admin ;
- R113 à R116 : cutover legacy Gacha ;
- direction animation UI validée ;
- historique Invocation complet avec pagination 10/page validé ;
- historique des bannières et votes validé ;
- direction synchronisation automatique catalogue validée ;
- direction vue Admin/Modérateur validée.

Domaine Gacha / Invocation : **CLÔTURÉ**.

Quatrième domaine :
**Box / Possessions / Obtention**

Document :
`docs/legacy/07-box-possession-obtention-audit.md`

Statut :
**CLÔTURÉ le 2026-08-28 — R117 À R176 VALIDÉS**

Correction de périmètre :
- `Liste.txt` ne concerne pas la Box ;
- `!liste <élément>` liste des joueurs selon leur élément ;
- ce script est reporté à un futur domaine utilitaire/social/joueurs.

Sources principales actuelles :
- `Box.txt` ;
- `Obtention.txt` ;
- `Stella.txt` ;
- possessions `box` dans `viewers_data.json` ;
- `boxFavorites` ;
- options de tri Box ;
- dépendances Team / Expedition / Concours / Gacha.

Décisions déjà validées :
- R117/R118 : catalogue et possession séparés, une possession unique joueur/personnage ;
- R119/R127–R129 : Stella = copie synthétique 5★ avec règles corrigées ;
- R120/R135/R138 : première date d'obtention + fallback migration traçable ;
- R121–R123/R130/R131/R133/R136/R137 : favoris, tris et onglets Box ;
- R124 : présentation paginée Twitch distincte de l'UI ;
- R125 : `!obtention` côté chat, information intégrée à la fiche UI ;
- R126 : statistiques collection dérivées ;
- R132 : correction minimale certaine de `copies` au cutover ;
- R134/R139–R142 : comportement des personnages désactivés ;
- R143 : possessions orphelines conservées et signalées ;
- R144 à R149 : règles de réparation/quarantaine des anomalies Box legacy ;
- R150 : service central de possession personnage ;
- R151 à R156 : tris legacy, désactivation/réactivation, C6 et permanence des possessions ;
- R157 à R159 : filtres constellation, cartes Box et favori UI ;
- R160 à R169 : Box publique, fiche commune, consultation, filtres et résumé collection ;
- R170/R172/R173/R174 : système de confidentialité public/amis/privé et granularité future ;
- R171 : copies visibles dans la fiche détaillée mais pas sur les cartes ;
- R175 : `!stella` sécurisé par nom exact, sans ID ni correspondance partielle ;
- R176 : confirmation UI obligatoire avant consommation d'une Stella.

**Domaine Box / Possessions / Obtention : CLÔTURÉ.**

Idées transverses découvertes :
- futur système `Objectifs` personnels, à spécifier dans un domaine dédié ;
- confidentialité joueur transversale à spécifier avec Paramètres / Social / Permissions ;
- profil Twitch-only rattachable ultérieurement au compte web via Twitch User ID.

Cinquième domaine :
**Team**

Document :
`docs/legacy/08-team-audit.md`

Statut :
**CLÔTURÉ le 2026-08-30 — R177 À R236 VALIDÉS**

Décisions principales :
- équipe active = une Team directement sélectionnée ;
- Team 1 active par défaut ;
- 0 à 4 personnages ;
- aucune duplication d'un personnage ;
- 10 positions protégées selon l'ordre courant ;
- extensions illimitées ;
- Teams >10 supprimables depuis l'UI si non actives ;
- drag horizontal des Teams dans le bandeau avec swap/insertion et renumérotation ;
- drag horizontal des personnages au sein d'une Team ;
- autosave ;
- ajout / retrait / remplacement direct ;
- compositions complètes dupliquées interdites ;
- noms facultatifs jusqu'à 20 caractères avec espaces/accents ;
- passifs dérivés et recalculés immédiatement ;
- passifs actifs même avec Team partielle ;
- Team active potentiellement publique selon confidentialité ;
- Saved Teams privées ;
- sidebar en lecture seule dans la V1 ;
- `!team new` pour créer une Team supplémentaire ;
- `!team list` paginé par 10 ;
- `apply` sélectionne la Team active ;
- `save` ne réalise plus de mutation métier et renvoie un helper ;
- réponses Twitch en une seule ligne ;
- recherche temps réel transversale par sous-chaîne contiguë ;
- `!passifs` conservé comme référentiel général.

Consommateurs confirmés :
- Gacha/Pull → passifs ;
- Combat → composition active ;
- Profil/Infos → consultation ;
- Expedition → aucune dépendance métier Team ;
- Passif → référentiel général sans état joueur.

Migration :
- conversion de `team` + `savedTeams` vers collection de Teams + Team active ;
- conservation des positions/presets historiques autant que possible ;
- détection des compositions identiques ;
- préservation d'une ancienne équipe active distincte sans écraser les presets ;
- importer rerunnable/idempotent.

**Domaine Team : CLÔTURÉ.**

Sixième domaine :
**Banque**

Document :
`docs/legacy/09-banque-audit.md`

Statut :
**CLÔTURÉ le 2026-08-31 — R237 À R255 VALIDÉS**

Décisions principales :
- portefeuille et Banque = soldes distincts ;
- dépôt/retrait = transferts internes ;
- aucun frais/cooldown/plafond V1 ;
- MAX UI et `max` Twitch/chat ;
- écran Banque dédié ;
- patrimoine total dérivé ;
- intérêt 3 % automatique au reset serveur ;
- joueur hors ligne inclus ;
- estimation dynamique de l'intérêt ;
- compte à rebours uniquement UI ;
- pas de notification quotidienne d'intérêt ;
- historique récent Banque + Historique global complet ;
- historique bancaire détaillé Amis uniquement par défaut (R908), configurable Public/Amis/Privé ;
- solde Banque soumis à Public / Amis / Privé ;
- protection contre fuite via données dérivées ;
- sidebar = portefeuille uniquement ;
- message `!banque` complet sur une ligne avec emojis et helpers ;
- montants texte = entier ou `max`.

Migration :
- importer portefeuille / Banque / stats exacts ;
- ne pas reconstruire d'intérêts passés ;
- ne pas fabriquer d'historique Banque legacy ;
- `lastInterestDate` legacy ne pilote pas le scheduler cible ;
- premier intérêt standalone au prochain reset normal.

Dépendance reportée :
- `Top / Classements` devra décider la définition d'un classement Moras ;
- le legacy `!top moras` utilise actuellement le portefeuille uniquement ;
- aucun classement ne devra permettre de déduire une Banque privée.

**Domaine Banque : CLÔTURÉ.**

Septième domaine :
**Sac / Coffre / Shop**

Document :
`docs/legacy/10-sac-coffre-shop-audit.md`

Statut :
**CLÔTURÉ le 2026-08-31 — R256 À R298 VALIDÉS / DÉRIVÉS**

Décisions principales :
- Sac complet privé au propriétaire ;
- catégories Tout / Ressources / Objets / Collection ;
- ressources à zéro visibles ;
- invocations possibles dérivées dans le Sac ;
- Masterless Stella Fortuna dans Objets et utilisable depuis le Sac ;
- Collection = ancien Coffre ;
- possédés puis non possédés, tri alphabétique ;
- quantités + compteur de complétion ;
- hover / fiche / méthode d'obtention / historique ;
- IDs inconnus préservés sous placeholder ;
- Collection publique selon confidentialité ;
- historique détaillé d'acquisition compatible avec confidentialité granulaire ;
- catalogue Shop serveur dynamique ;
- `displayOrder` explicite ;
- article visible / indisponible / masqué ;
- limites d'achat extensibles ;
- aucun stock mondial en V1 ;
- Primos multi-lots + MAX ;
- Ticket immédiat/unitaire/probabilités visibles ;
- pity Ticket via moteur Gacha ;
- Mission achetable depuis Shop ou Missions ;
- `!shop` paginé au-delà de 5 articles ;
- historique Shop Amis uniquement par défaut (R908) via l'écran Historique global, configurable Public/Amis/Privé ;
- achats atomiques/idempotents.

Frontières reportées :
- détail des missions quotidiennes et permanentes B/A/S/Z → Domaine Missions ;
- switch/reroll final → Domaine Missions ;
- acquisition réelle des objets Collection et événements mensuels → Domaine Event.

Migration :
- ressources par leurs domaines propriétaires ;
- quantité Stella conservée ;
- Collection legacy conservée par ID + quantité ;
- IDs inconnus préservés ;
- date migration comme fallback uniquement lorsque l'historique réel manque ;
- aucun faux historique Shop rétroactif.

**Domaine Sac / Coffre / Shop : CLÔTURÉ.**

Huitième domaine :
**Missions / Daily**

Document spécialisé :
`docs/legacy/11-missions-daily-audit.md`

Statut :
**CLÔTURÉ — R299 À R339**

Sont cadrés :
- mission quotidienne ;
- achat / récompense / reset ;
- switch ;
- catalogue initial ;
- progression quotidienne ;
- B / A / S ;
- rang Z ;
- UI ;
- Twitch / chat ;
- visibilité publique ;
- migration ;
- architecture MissionService.

Recroisements propriétaires résolus : Expedition, Combat et Ami / Social. Roue / Event restent à recroiser uniquement pour leur contribution au suivi quotidien.

Ces dépendances ne maintiennent pas le Domaine Missions ouvert.

Ordre recommandé :

1. XP / cycle de vie joueur
2. Élément / ressources / conversion
3. Gacha :
   - Banniere
   - Select
   - Pull
   - Pity
   - Vote
4. Box / Possessions / Obtention
5. Team
6. Banque
7. Sac / Coffre / Shop
8. Missions / Daily
9. Expedition
10. Combat
11. Ami / social
12. Concours / C6
13. Event / monthly
14. autres utilitaires
15. Twitch / Giveaway :
   - `Wish.txt`
   - `giveaway.json`
   - autres commandes/triggers Twitch de giveaway à identifier ;
   - non prioritaire pour le cœur standalone mais à ne pas oublier avant la fin de l'audit.

---

# 24. PHASE 2 — MODÈLE DE DONNÉES CIBLE

Statut : FUTUR

Après audit :
- définir les vraies entités ;
- séparer données fondamentales et dérivables ;
- séparer joueur / possession / catalogue / historique / état global ;
- normaliser null / dates / listes ;
- définir contraintes ;
- définir relations ;
- définir données temporaires ;
- définir données globales.

Ne pas simplement reproduire les JSON en SQL.

---

# 25. PHASE 3 — CHOIX DU BACKEND

Statut : FUTUR

Solutions à comparer :
- Supabase / PostgreSQL ;
- backend Node personnalisé ;
- autres solutions si besoin.

Critères :
- auth ;
- DB relationnelle ;
- temps réel ;
- coûts ;
- simplicité ;
- migration ;
- sécurité ;
- déploiement ;
- chat ;
- présence ;
- Twitch OAuth.

Supabase paraît prometteur mais décision non figée.

---

# 26. PHASE 4 — AUTHENTIFICATION / COMPTE

Premier vrai prototype backend attendu :

- inscription ;
- connexion ;
- création profil ;
- pseudo GachaImpact ;
- ID interne ;
- initialization de données ;
- liaison Twitch optionnelle ;
- récupération du profil legacy ;
- affichage des vraies données dans l'UI.

Premier pilote :
- compte du créateur / profil Kichnifou.

But :
remplacer progressivement les mocks par les données serveur.

---

# 27. PHASE 5 — MIGRATION PILOTE

Objectif :
- importer Kichnifou ;
- vérifier :
  - niveau ;
  - XP ;
  - élément ;
  - primos ;
  - moras ;
  - particules ;
  - box / possessions ;
  - constellation ;
  - copies ;
  - `firstObtainedAt` + provenance fallback éventuelle ;
  - favoris ;
  - possessions orphelines/non résolues ;
  - équipe ;
  - pity ;
  - garantie ;
  - `fiftyFiftyLostStreak` ;
  - `captureProgress` / brillance ;
  - stats Gacha historiques ;
  - stats C6 ;
  - dates ;
  - autres historiques.

Ensuite tester quelques profils anciens/incomplets.

---

# 28. PHASE 6 — FONCTIONNALITÉS RÉELLES

Ordre recommandé initial :

1. Ressources
2. Box
3. Équipe
4. Invocation

Pourquoi :
- ensemble cohérent ;
- donne rapidement un mini-jeu jouable complet ;
- permet de tester transactions et sauvegarde serveur.

Ensuite :
- Boutique
- Banque
- Missions
- Combat
- Expédition
- Social
- Events
- Concours
- etc.

---

# 29. PHASE 7 — CHAT INTERNE

Créer un vrai chat GachaImpact :
- messages globaux ;
- identité GachaImpact ;
- présence ;
- commandes ;
- réponses système ;
- historique ;
- non lus ;
- modération.

Les commandes internes doivent appeler les mêmes services que les boutons.

---

# 30. PHASE 8 — SOCIAL — AUDIT CLÔTURÉ R451–R525

Document spécialisé :
`docs/legacy/14-ami-social-audit.md`

Espace Social unique :
- onglets Amis, Demandes, Joueurs et Messages ;
- recherche temps réel ;
- tris mémorisés ;
- profils ouvrables depuis les identités standalone ;
- vues partagées en lecture seule selon permissions serveur.

Amis :
- demandes persistantes avec ajouter/accepter/refuser/annuler ;
- paire unique par IDs joueur ;
- retrait archivant la relation et restauration de la progression après réajout ;
- aucun plafond d'amis ;
- un cœur par relation, sens et journée Europe/Paris ;
- +5 Primogemmes pour chacun ;
- niveau partagé plafonné à 1000 ;
- total historique des cœurs non plafonné ;
- envoi individuel/global atomique et idempotent ;
- aucune notification dédiée au cœur.

Présence :
- En ligne jusqu'à dix minutes d'inactivité ;
- Absent après dix minutes ;
- Hors ligne après fermeture de toutes les sessions ou deux heures d'inactivité ;
- visibilité Public/Amis/Privé ;
- dernière activité relative avec détail exact ;
- `lastSeen` legacy conservé séparément comme activité Twitch historique.

Messages privés :
- strictement internes au standalone, jamais reliés à Twitch ;
- onglet MP unique, aucun `!mp` ;
- 1 000 caractères, texte/emojis, retours à la ligne ;
- 500 derniers messages dans la vue courante ;
- Historique complet avec scroll, recherche et navigation par date ;
- modification/suppression synchronisée chez les deux participants ;
- restauration d'un message supprimé tant qu'il reste parmi les 500 derniers ;
- archivage individuel et désarchivage automatique au prochain message ;
- badges non lus dans les onglets et conversations ;
- accusés de lecture configurables, activés par défaut ;
- demandes de conversation, blocage et signalement cadrés ;
- aucun administrateur ne peut parcourir librement les MP.

Confidentialité :
- matrice initiale exacte définie par R518 ;
- pity/garantie publiques par défaut ;
- liste d'amis Amis uniquement par défaut ;
- données économiques, tactiques et historiques privées par défaut mais configurables ;
- contenu MP toujours privé aux participants.

Commandes :
- famille `!ami` explicite ;
- `!ami <pseudo>` alias de `!ami voir <pseudo>` ;
- `!infos`/`!info` compact ;
- `!liste <élément> [page]` alphabétique ;
- `!liste online [page]` En ligne puis Absents ;
- vingt joueurs par page pour `!liste`.

Cosmétiques :
- avatars officiels ;
- sept avatars élémentaires et fallback neutre ;
- premier catalogue lié aux données auditées ;
- titres visibles uniquement sur le Profil ;
- déblocages permanents et rétroactifs lorsqu'ils sont prouvables ;
- catalogue piloté par données et administrable.

Migration :
- 88 relations et 21 demandes observées conservées ;
- compteurs relationnels et individuels préservés séparément ;
- écart historique de 612 cœurs documenté sans réattribution inventée ;
- aucun MP legacy à migrer ;
- migration réexécutable et idempotente ;
- aucune récompense déclenchée par l'import.

**Domaine Ami / Social clôturé après R525.**

---

# 31. PHASE 9 — TWITCH

Seulement après que le jeu standalone fonctionne.

Objectifs :
- OAuth Twitch ;
- liaison compte ;
- reconnaître l'identité Twitch ;
- messages Twitch dans GachaImpact ;
- éventuellement messages GachaImpact -> Twitch selon règles ;
- commandes Twitch déclenchant la même logique serveur.

Streamer.bot ne doit plus être requis.

---

# 32. SÉCURITÉ / ARCHITECTURE SERVEUR

Principes :
- jamais faire confiance au navigateur pour une transaction ;
- ressources modifiées côté serveur ;
- toute mutation de ressource passe par une logique centrale avec cause/source métier ;
- pull calculé côté serveur ;
- pity calculée côté serveur ;
- shop côté serveur ;
- banque côté serveur ;
- échanges validés côté serveur ;
- stocks disponibles = stock total - stock réservé si système de réservation ;
- aucun solde ne peut devenir négatif ;
- opérations sensibles transactionnelles et atomiques ;
- protection idempotente contre double clic, retry réseau et double exécution ;
- timestamps serveur ;
- journalisation des transactions importantes ;
- mécaniques temporelles exécutables même si le joueur est hors ligne ;
- changements autoritatifs répercutés immédiatement dans les clients/UI concernés.

---

# 33. DONNÉES DÉRIVABLES

Principe :
ne pas sauvegarder inutilement ce qui peut être calculé depuis une source centrale.

Exemples :
- nombre d'invocations possibles = solde Primogemmes / coût courant ;
- richesse Moras totale = portefeuille + banque ;
- statistiques calculables depuis des transactions fiables lorsque le coût de calcul reste raisonnable.

Exemple legacy :
une expédition peut stocker :
- characterId
- characterName
- element

Dans le futur :
- `characterId` peut suffire si `name` et `element` viennent du catalogue.

Exception :
si une donnée doit représenter un snapshot historique, elle peut être volontairement copiée.

À décider au cas par cas.

---

# 34. SOURCE DE VÉRITÉ PERSONNAGES

Le catalogue personnage doit devenir central.

Il doit fournir au minimum :
- ID ;
- nom ;
- rareté ;
- élément ;
- arme ;
- région ;
- classe ;
- assets ;
- autres données nécessaires.

Les systèmes ne doivent pas redéfinir chacun le nom/élément du personnage.

---

# 35. RÈGLES DE TRAVAIL AVEC CODEX — ARCHIVE

Cette liste décrit l'ancien mode de travail. Pour une intervention actuelle, appliquer [AGENTS.md](../../AGENTS.md) et [le workflow](../process/implementation-workflow.md), notamment le commit et le push ciblé sur `review` après modification.

Rappel historique avant un développement important :
1. lire `AGENTS.md` ;
2. lire les docs concernées ;
3. inspecter les sources legacy si la fonctionnalité vient de Streamer.bot ;
4. ne pas inventer une mécanique non validée ;
5. ne pas faire de gros refactor sans nécessité ;
6. tester lint/build ;
7. tester desktop/mobile si UI ;
8. lister les fichiers modifiés ;
9. ancienne règle « ne pas créer de commit sauf demande », remplacée par le workflow permanent.

---

# 36. RÈGLES DE TRAVAIL CHATGPT / DOCUMENTATION

ChatGPT doit :
- consulter la documentation avant de prendre une décision structurante ;
- mettre à jour les docs à intervalles réguliers ;
- préciser exactement quel fichier créer/modifier ;
- ne pas dépendre uniquement de la mémoire de conversation ;
- lire le code réel des scripts legacy ;
- conserver les incertitudes sous statut explicite ;
- distinguer :
  - comportement actuel ;
  - décision validée ;
  - recommandation ;
  - idée future.

---

# 37. GIT / GITHUB — ARCHIVE

Dépôt public :
`https://github.com/Kichnifou/GachaImpact`

L'ancien conseil `git add .` / `git push` sans branche explicite est obsolète. Le [workflow actuel](../process/implementation-workflow.md) demande de vérifier le périmètre, d'indexer seulement les fichiers du lot, de pousser normalement sur `review` et de reviewer ensuite le vrai commit GitHub. Aucun push `main` ou force-push ne découle de cette archive.

---

# 38. HISTORIQUE DES AUDITS ET REPRISES PASSÉES — ARCHIVE

Les formulations de reprise de cette section sont conservées comme checkpoints historiques et ne déterminent plus le domaine actif. Le pointeur vivant est le bloc **Point courant** au début du Master.

Domaines clôturés :
- `docs/legacy/04-xp-audit.md` — XP / cycle de vie joueur ;
- `docs/legacy/05-element-resources-audit.md` — Élément / Ressources / Conversion / Échanges ;
- `docs/legacy/06-gacha-invocation-audit.md` — Gacha / Invocation ;
- `docs/legacy/07-box-possession-obtention-audit.md` — Box / Possessions / Obtention ;
- `docs/legacy/08-team-audit.md` — Team ;
- `docs/legacy/09-banque-audit.md` — Banque — **R237 À R255**.

Domaine Banque :
- code legacy lu ;
- dépôt/retrait cadrés ;
- intérêt automatique cadré ;
- UI cadrée ;
- Twitch/chat cadré ;
- historique cadré ;
- confidentialité cadrée ;
- migration cadrée ;
- dépendance Top/Classements explicitement reportée.

Domaine clôturé :
- `docs/legacy/10-sac-coffre-shop-audit.md` — Sac / Coffre / Shop : **CLÔTURÉ — R256 À R298**.

Sac / Shop désormais cadrés :
- catégories du Sac ;
- objets spéciaux ;
- Stella ;
- Collection ;
- confidentialité ;
- migration Collection ;
- catalogue Boutique ;
- quantités / MAX ;
- Ticket ;
- Mission initiale ;
- états disponibilité ;
- limites extensibles ;
- pagination Twitch ;
- historique Shop ;
- atomicité.

Frontières :
- Missions / switch / missions permanentes → résolus dans le Domaine Missions, clôturé après R339 ;
- acquisition Collection / événements mensuels → Domaine Event ;
- classement Moras → Domaine Top / Classements.

**Domaine 8 — Missions / Daily : CLÔTURÉ — R299 À R339.**

Document spécialisé :
`docs/legacy/11-missions-daily-audit.md`

Missions / Daily désormais cadrés :
- écran Missions séparé en Quotidienne / Permanentes ;
- l'onglet Quotidienne de Missions est réservé à la mission quotidienne payante ;
- le suivi général des activités quotidiennes a été déplacé par R355 vers l'écran transversal distinct `Quotidiennes` ;
- mission quotidienne achetée 10 000 Moras ;
- récompense quotidienne de mission : 800 Primogemmes ;
- pool initial : 10 messages éligibles / 5 Pulls / 320 particules converties ;
- progression uniquement après attribution ;
- mission exacte inconnue avant achat ;
- probabilités de tirage non affichées ;
- reset quotidien 00:00 Europe/Paris ;
- switch 20k puis coût doublé, mission obligatoirement différente ;
- confirmation UI du switch uniquement si progression à perdre ;
- B→A→S cumulatifs ;
- missions permanentes automatiques dès le provisionnement du joueur ;
- aucune acceptation ni abandon ;
- récompenses automatiques ;
- objectifs B/A/S legacy conservés ;
- Messages basés sur `countedMessages` ;
- personnages 4★/5★ comptés distinctement ;
- Moras basées sur les gains réellement générés ;
- Z débloqué après toutes les B/A/S puis activé automatiquement ;
- Z évalué immédiatement depuis l'état/statistiques déjà acquis ;
- contenu Z secret avant déblocage ;
- `!mission` devient consultation personnelle uniquement ;
- pas de `!mission <pseudo>` ;
- `!mission resume` peut survivre comme alias non recommandé ;
- `!quotis` devient dynamique ;
- aucune notification Twitch asynchrone ;
- missions/progressions publiques par défaut depuis le profil standalone, avec rubrique configurable Public/Amis/Privé ;
- aucune catégorie Historique Missions player-facing ;
- migration conservatrice des permanentes ;
- quotidienne du jour du cutover conservée lorsqu'elle est certaine ;
- aucun double paiement pendant migration.

Recroisements après clôture Missions :
- Expedition → résolu : une expédition est comptabilisée uniquement lors d'une récupération réussie ; cette mutation produit `totalExpeditionsCompleted +1` et l'événement Mission ;
- Combat → résolu R387/R388 : B/A/S utilisent `totalCombatWins` ; Z `Maître du combat` utilise 50 `totalManualCombatWins` sans Auto ;
- Ami / Social → résolu R458/R525 : B/A/S utilisent les cœurs sortants réellement validés ; Z se termine lorsqu'une relation atteint le niveau plafonné 1000 ;
- Roue / Ami / Event → leurs états continueront à enrichir le hub `Quotidiennes` / `!quotis`.

**Domaine 9 — Expedition : CLÔTURÉ — R340 À R369.**

Document spécialisé :
`docs/legacy/12-expedition-audit.md`

Expedition désormais cadré notamment sur :
- durée 20 h ;
- un départ par journée serveur ;
- récupération manuelle ;
- récompenses 10 % / 30 % / 60 % conservées ;
- 800 particules de l'élément personnel du joueur ;
- personnage toujours utilisable pendant l'Expedition ;
- workflow principal directement dans la Box ;
- aucune vue Expedition dédiée ;
- personnage prêt temporairement placé avant les favoris ;
- état Expedition Amis uniquement par défaut (R908), configurable par sa rubrique dédiée et jamais révélé implicitement par la seule visibilité de la Box ;
- badges `En expédition` / `À récupérer` ;
- Expedition considérée faite dans les Quotidiennes dès le départ ;
- Expedition prête bloquant un nouveau départ ;
- tirage serveur au moment de la récupération ;
- `totalExpeditionsCompleted +1` au claim réussi uniquement ;
- aucun historique player-facing V1 ;
- migration d'une Expedition active conservée ;
- notification UI lorsque le personnage est prêt ;
- aucune notification Twitch asynchrone ;
- tout personnage possédé et actif est éligible.

Direction transverse nouvellement validée :
- créer un écran `Quotidiennes` distinct de Missions ;
- Roue → écran Roue ;
- Combat → écran Combat ;
- Expedition → Box ;
- Ami cœur → liste d'amis ;
- Event → écran Event ;
- Shop → Boutique ;
- chaque carte possède un bouton `Accéder` ;
- le hub agrège les états mais ne duplique jamais les mécaniques métier ;
- `!quotis` est son équivalent texte compact.

Dernières règles de clôture :
- hub Quotidiennes : `À faire` / `En cours` / `À récupérer` / `Fait aujourd'hui` ;
- une Expedition d'un jour précédent peut bloquer le nouveau départ sans compter comme départ du jour actuel ;
- bouton `Accéder` toujours disponible et redirige vers la vraie Box ;
- passage à `readyAt` répercuté en temps réel dans la Box sans popup forcée ;
- reset quotidien sans annulation ni modification de l'Expedition en cours ;
- edge cases de migration conservateurs et sans récompense/statistique déclenchée par une réparation ;
- `totalExpeditionsCompleted` intégré aux statistiques publiques par défaut et configurables par Social.

**Domaine Expedition : CLÔTURÉ.**

**Domaine 10 — Combat : CLÔTURÉ — R370 À R450.**

Document spécialisé :
`docs/legacy/13-combat-audit.md`

Combat quotidien désormais cadré notamment sur :
- équipe ennemie globale de 4 personnages actifs, renouvelée chaque jour ;
- quatre slots Combat persistants indépendants du système Team ;
- première utilisation avec quatre slots vides ;
- `Sélectionner l'équipe active` effectue uniquement une copie volontaire ;
- les slots ne modifient jamais la Team active ;
- plusieurs tentatives possibles après défaite ;
- personnages perdants KO uniquement pour le combat quotidien ;
- KO reset à 00:00 Europe/Paris ;
- victoire quotidienne unique ;
- récompense V1 +800 Primogemmes / +20 000 Moras ;
- chance finale visible directement, détail du calcul dans un panneau déroulant ;
- matrice élémentaire legacy conservée ;
- nouvelle formule V1 : base 50, 4★ +3, 5★ +6, C4★ +0,5/C, C5★ +1/C, élément ±4 ;
- clamp 5–95 % ;
- un 4★ C6 rejoint approximativement un 5★ C0 en puissance brute ;
- Auto utilise strictement la même formule autoritative que le Combat ;
- UI Auto remplit et mémorise les slots puis laisse confirmer `Combattre` ;
- une tentative immédiatement issue d'Auto est `AUTO` ;
- une composition Auto mémorisée puis réutilisée sans relancer Auto devient `MANUAL` ;
- Twitch `!combat auto` reste direct ;
- états Quotidiennes : À faire / En cours / Terminé / Bloqué aujourd'hui ;
- `totalCombatWins` = manuel + Auto ;
- `totalManualCombatWins` = victoires dont la tentative autoritative est `MANUAL` ;
- missions B/A/S = totalCombatWins ;
- Z `Maître du combat` = 50 totalManualCombatWins.

Boss mensuel communautaire désormais cadré / révisé R390-R429 :
- un Boss par mois civil, nouvelle instance le 1er à 00:00 Europe/Paris ;
- aucun respawn si vaincu tôt ;
- `baseHp` initial 1 500 000 puis difficulté adaptative ;
- victoire : +75k `baseHp` par journée restante, hausse mensuelle max +1,5M ;
- échec : soustraction des PV restants ; plancher 500k ;
- `maxHp` réel = `baseHp` avec variation mensuelle ±15 % ;
- une attaque par joueur/jour ;
- attaque indépendante du KO et du combat quotidien ;
- quatre slots Boss indépendants du système Team ;
- bouton `Sélectionner l'équipe active` = copie ponctuelle ;
- composition Boss persistante indéfiniment, y compris après mort du Boss et changement de mois ;
- aucun Auto Boss ;
- résistance élémentaire mensuelle : ×0,5 sur l'élément concerné ;
- dégâts Boss : 4★ 500+150/C ; 5★ 1000+650/C ;
- preview des dégâts en temps réel ;
- récompense égalitaire : 16 000 Primogemmes + 500 000 Moras ;
- une attaque valide >0 suffit à devenir participant ;
- distribution automatique aux participants lorsque le Boss meurt, offline compris ;
- notification UI ; aucune notification Twitch asynchrone ;
- coup final honorifique ;
- classements mensuels publics ;
- écran de bilan enrichi après la mort ;
- historique Boss player-facing ;
- sous-indicateur Boss dans la carte Combat de Quotidiennes ;
- chaque attaque snapshotte les personnages/constellations utilisés.

Direction UI Combat révisée R423-R429 :
- écran Combat avec deux onglets distincts : `Combat quotidien` ouvert par défaut / `Boss mensuel` ;
- chaque onglet possède une interface et une mémoire de quatre slots indépendantes ;
- les compositions ne sont jamais des Teams et ne modifient jamais la Team active ;
- première utilisation de chaque mode : quatre slots vides ;
- `Sélectionner l'équipe active` effectue seulement une copie volontaire ;
- les compositions quotidien/Boss persistent indéfiniment et ne sont pas vidées par les resets ou le changement de Boss ;
- le quotidien possède `Équipe automatique` ; le Boss n'en possède jamais ;
- une tentative quotidienne est manuelle si Auto n'a pas été utilisé pour cette tentative ;
- une composition issue d'Auto peut être réutilisée plus tard comme composition manuelle ;
- vue normale quotidien : chance finale uniquement, calcul détaillé déroulant ;
- vue normale Boss : dégâts totaux uniquement, détail par personnage/résistance déroulant.

Commandes, migration et sécurité finalisées R430-R450 :
- `!combat go` copie volontairement la Team active dans les slots quotidiens puis combat en mode manuel ;
- `!combat info` prévisualise la Team active sans mutation ;
- `!combat boss go` copie volontairement la Team active dans les slots Boss puis attaque ;
- `!combat boss` affiche l'état et les dégâts prévus de la Team active ;
- `!combat stat` reste compact dans un seul message normal ;
- le Boss vaincu produit également un bilan chat compact dans un seul message normal ;
- compteurs quotidiens globaux et par personnage migrés sans reconstruire les anciennes victoires manuelles ;
- données journalières conservées uniquement si elles correspondent au jour du cutover ;
- Boss actif conservé uniquement s'il correspond au mois du cutover ;
- `monthly_boss.json` autoritatif par Boss, statistiques joueur utilisées comme minimum historique ;
- anomalies financières mises en quarantaine ;
- attaque, coup final et récompenses Boss atomiques/idempotents ;
- attaque visant une ancienne instance refusée sans redirection ;
- historique legacy partiel conservé sans inventer les attaques/compositions absentes ;
- aucun historique player-facing du Combat quotidien en V1 ;
- statistiques quotidiennes par personnage affichées dans sa fiche personnelle et consultables selon les réglages de confidentialité ;
- douze noms de Boss conservés selon les mois de l'année ;
- variation `maxHp` uniforme ±15 %, arrondie aux 10 000 PV ;
- résistance mensuelle aléatoire avec répétition autorisée.

Règle Notifications précisée :
- les notifications non lues ne sont jamais expirées automatiquement par ancienneté ;
- les notifications lues sont nettoyées au reset suivant ;
- toute notification, lue ou non, reste supprimable manuellement ;
- supprimer la notification ne modifie jamais l'état métier associé.

**Domaine Combat clôturé après R450.**

**Domaine 11 — Ami / Social clôturé après R525.**

Document spécialisé :
`docs/legacy/14-ami-social-audit.md`

Sont finalisés :
- demandes et relations archivables ;
- cœurs +5/+5, niveau 1000 et compteurs Missions ;
- espace Social, profils et confidentialité ;
- présence En ligne/Absent/Hors ligne ;
- MP internes, historique, édition, suppression, restauration et archivage ;
- badges non lus et accusés de lecture ;
- blocage, signalement et modération respectueuse de la confidentialité ;
- commandes `!ami`, `!infos`/`!info` et `!liste` ;
- avatars, titres et déblocages rétroactifs ;
- concurrence, idempotence et migration ;
- producteurs et consommateurs.

La reprise globale et le domaine actuellement actif sont indiqués uniquement dans le bloc **Point courant** au début du Master.

Dépendance future à conserver :
- lors de l'audit `Top / Classements`, décider explicitement portefeuille vs patrimoine total pour les Moras ;
- respecter les réglages de confidentialité et empêcher toute déduction indirecte d'une donnée privée.

---

# 39. PRINCIPE DE VALIDATION DES DÉCISIONS

Une décision n'est considérée définitive que si elle est :
- explicitement validée par le propriétaire du projet ;
- écrite dans la documentation.

Une hypothèse trouvée dans un script n'est pas automatiquement une règle à conserver.

Pour chaque mécanique legacy :
- comprendre ;
- expliquer ;
- décider :
  - garder ;
  - adapter ;
  - supprimer ;
  - repousser ;
  - centraliser ;
  - refondre.

---

# 40. OBJECTIF FINAL

Obtenir un projet où :

- l'interface actuelle devient un vrai jeu ;
- toutes les données sont centralisées ;
- la logique métier est maintenable ;
- un joueur peut jouer entièrement sans Twitch ;
- Twitch peut être lié en bonus ;
- les données historiques Streamer.bot ne sont pas perdues ;
- les anciens joueurs peuvent récupérer leur progression ;
- les nouveaux joueurs ont un modèle propre dès la création ;
- toutes les commandes sont documentées ;
- UI et chat utilisent les mêmes services ;
- les systèmes futurs peuvent être ajoutés sans reproduire les défauts de Streamer.bot.

---

# 41. RÉSUMÉ ULTRA COURT POUR REPRISE RAPIDE

Projet :
GachaImpact = migration d'un jeu Twitch/Streamer.bot vers un jeu web standalone React avec backend autoritaire déjà déployé.

Frontend :
alpha publique React/TypeScript/Vite ; coque UI et fondations Gacha visuelles validées, avec dé-mock progressif par domaines V1.

Legacy :
37 scripts + 17 JSON intégrés sous `legacy/streamerbot/`.

Docs :
déjà présentes sous `docs/`.

Profil canonique :
Kichnifou.

Décisions clés :
- compte GachaImpact distinct de Twitch ;
- Twitch optionnel ;
- migration complète ;
- niveau max 100 ;
- XP continue après 100 ;
- élément joueur permanent ;
- primos = pulls ;
- moras = shop/banque ;
- particules personnelles -> Primogemmes 1:1, conversion manuelle ;
- échanges de particules : X contre X entre éléments différents, une demande par paire, réservation uniquement côté expéditeur, montant dynamique si le stock destinataire baisse, expiration au reset serveur ;
- UI échange future : reçues/envoyées, annulation/refus, MAX, Accepter tout, partenaires réellement échangeables uniquement, notification agrégée dynamique ;
- échanges résolus : pas de notification individuelle ; historique récent directement dans l'écran Échanges ;
- demandes legacy ouvertes non migrées ; nouvelles relations basées sur IDs internes immuables ;
- historique des échanges conservé côté serveur à partir de GachaImpact pour audit/statistiques, sans affichage V1 ;
- copies continuent après C6 ;
- C6 ouvre stats/concours ;
- Gacha : rotation automatique lundi 00:00 Europe/Paris, 4×5★ + 6×4★, pas de personnage deux semaines consécutives ;
- vote hebdo définitif, tirage pondéré pour le quatrième 5★ ;
- cible 5★ obligatoire parmi les quatre actifs, vidée à chaque rotation et modifiable librement ;
- coût 160 primos ; UI x1/x10 ; pity 5★ 90 / pity 4★ 10 selon courbes validées ;
- 50/50 perdu = un des trois autres 5★ ; garantie normale + Capture séparées ;
- `fiftyFiftyLostStreak` = streak statistique ; `captureProgress` = mécanique 0..3 ;
- Capture : perte +1, victoire -1, déclenchement à 3 puis reset ;
- passifs Pyro/Hydro/Cryo/Electro/Anemo/Geo/Dendro du Pull spécifiés ;
- copies continuent après C6 ; remboursements C6+ 80 primos 4★ / 160 primos 5★ ;
- C6 5★ ouvre la future section Concours ;
- x10 entièrement persisté avant animation ; un crash UI ne change jamais les résultats ;
- historique complet des Pulls depuis GachaImpact avec 10 résultats/page ;
- historique des bannières/votes depuis le standalone, avec snapshot et votes individuels ;
- écran Historique global prévu avec onglets Invocations / Bannières et futurs onglets pertinents ;
- Early / Back-to-back / Hard conservés et statistiques dérivables ;
- animation UI de Pull avec révélation progressive et anticipation dorée du 5★ ; Twitch reste textuel ;
- futur catalogue personnages automatiquement synchronisé avec vérification de sortie/complet + français ;
- nouveaux 5★ importés en cours de semaine immédiatement votables sans modifier la bannière active ;
- vote possible directement depuis l'écran Personnages ;
- future vue Admin/Modérateur pour corrections catalogue/joueurs ; Kichnifou admin initial, autres admins promouvables plus tard ;
- cutover Gacha : bannière/votes/cible actifs conservés si valides ;
- domaine Gacha / Invocation clôturé après R116 ;
- `Wish.txt` = Giveaway Twitch, pas Gacha ;
- une seule logique serveur partagée par UI/chat/Twitch ;
- récompenses de level-up V1 conservées selon le code legacy réel ;
- récompense quotidienne V1 conservée avec reset global à minuit Europe/Paris ;
- intérêt bancaire V1 : +3 % automatiques chaque jour à 00:00 Europe/Paris sur le solde bancaire présent au reset, même sans activité du joueur ;
- standalone : élément obligatoire pendant l'onboarding ;
- standalone : XP chat conservée (+1/+2/+3, cooldown 2 s), pas d'XP directe sur les actions ordinaires, futur mode XP dédié dans l'interface avec plafond quotidien à concevoir, cumul chat + mode autorisé ;
- XP multi-canaux : cooldown 2 s global entre Twitch/chat interne ; `totalMessages` conserve tous les vrais messages joueur, `countedMessages` uniquement ceux ayant réellement donné de l'XP ;
- tutoriels de niveau : chat si montée via XP chat, notification UI si montée via le futur mode XP interface ;
- XP = source de vérité du niveau ; gains multi-level récompensent chaque niveau traversé et sont clairement affichés dans les notifications ;
- niveau 100 : état d'overflow historique conservé, récompenses multiples prises en charge ;
- dates legacy valides conservées et timestamps historiques interprétés comme Europe/Paris ; exception explicitement validée pour `firstObtainedAt` manquant/invalide : utiliser la date de migration comme fallback traçable ;
- Twitch : nouveau chatter enregistré passivement, progression jusqu'au seuil d'onboarding puis blocage des mécaniques actives tant que l'élément n'est pas choisi ;
- écran transversal `Quotidiennes` dédié, distinct de Missions, servant de hub vers Roue / Combat / Box-Expedition / Amis / Event / Shop ; `!quotis` en est l'équivalent texte compact ;
- Expedition clôturé après R369 : 20 h, un départ/jour, récupération manuelle, personnage toujours utilisable, workflow Box, états Quotidiennes détaillés, récompense tirée au claim, personnage prêt temporairement remonté avant les favoris, reset sans annulation ;
- Combat clôturé après R450 : rencontre quotidienne globale, tentatives multiples, KO limités au quotidien, slots persistants indépendants, copie volontaire de la Team active, Auto temporaire, formule 5–95 %, récompense 800 Primogemmes + 20 000 Moras ;
- Boss mensuel clôturé après R450 : cycle mensuel, noms calendaires, difficulté adaptative, variation ±15 %, résistance, attaque quotidienne, slots indépendants, récompense communautaire, coup final, classements, historique et bilan ;
- commandes Combat/Boss finalisées pour UI, chat interne et Twitch ;
- migration Combat/Boss conservatrice avec réconciliation des deux JSON legacy, quarantaine des ambiguïtés et aucune donnée historique inventée ;
- coup final, distribution communautaire et changement de mois conçus de manière atomique/idempotente ;
- aucun historique player-facing du Combat quotidien en V1 ; statistiques par personnage affichées dans sa fiche personnelle selon confidentialité ;
- notifications non lues persistantes jusqu'à lecture/suppression ; notifications lues nettoyées au reset suivant ;
- Ami / Social clôturé après R525 : demandes, relations, cœurs, présence, profil, confidentialité, MP, blocage, signalement, avatars et titres ;
- MP strictement internes au standalone, avec 500 derniers messages dans la vue courante et Historique complet séparé ;
- toutes les rubriques de gameplay sont configurables Public/Amis/Privé ; les défauts de confidentialité suivent R908 (soldes et Banque Public, six rubriques sensibles et Historique détaillé Amis uniquement) ;
- pity et garantie sont publiques par défaut ;
- `!ami`, `!infos`/`!info` et `!liste` sont finalisées pour les chats ;
- migration sociale conservatrice, réexécutable et sans attribution historique inventée.

Domaine Concours / C6 :
- **CLÔTURÉ après R593** ;
- cycle de vie complet du Concours défini ;
- lobby, Ready, bots, spectateurs, présence passive, timeouts, soutien et annulations cadrés ;
- économie et classement final définis ;
- progression C6 et titres définis ;
- modèle/migration C6 cadrés ;
- historique public cible défini ;
- `!concours` et `!legende` finalisés ;
- garanties de reprise, atomicité, concurrence et permissions administratives documentées.

Dernier domaine clôturé :
`docs/legacy/17-roue-quotidien-audit.md` — Roue / quotidien — **CLÔTURÉ après R656**.

État du domaine clôturé :
- une Roue maximum par joueur et par journée `Europe/Paris` ;
- distribution réelle 2 % rien / 70 % particules / 20 % Moras / 8 % Primogemmes conservée ;
- +500 particules par résultat élémentaire ;
- +50 000 Moras ;
- jackpot +1 600 Primogemmes ;
- vraie roue graphique animée côté standalone ;
- probabilités exactes consultables ;
- résultat quotidien conservé jusqu'au reset ;
- animation courte et skippable ;
- `totalWheelSpins` / `totalWheelJackpots` conservés et affichables ;
- `!roue` finalisé ;
- intégration `Quotidiennes` / `!quotis` finalisée pour la Roue ;
- tirage, récompense et verrou quotidien serveur atomiques/idempotents ;
- migration conservatrice documentée ;
- bug legacy `totalMainElementParticlesEarned` corrigé pour les nouveaux gains via les mutations Ressources centrales.

Dernier domaine clôturé :
`docs/legacy/18-faveur-subscription-audit.md` — Faveur / Subscription — **CLÔTURÉ après R672**.

État du domaine clôturé :
- 30 jours par attribution, plafond 180 ;
- jours écoulés automatiquement selon `Europe/Paris` même en cas d'absence ;
- +800 Primogemmes quotidiennes uniquement les jours où le joueur se manifeste ;
- claim quotidien commun Twitch / standalone ;
- Tier 1 +1 600, Tier 2 +9 600, Tier 3 +20 800 immédiates ;
- compensation supplémentaire des jours bloqués par le plafond ;
- Twitch-only : `élément choisi` utilisé comme verrou central d'activation, sans seuil de niveau spécifique ;
- standalone onboardé : élément déjà obligatoire ;
- gift au bénéficiaire + bonus gifter indépendant = total Twitch × récompense Tier, gifter anonyme/non éligible = 0 ;
- resubs seulement lorsqu'un événement Twitch fiable les prouve ;
- informations Faveur dans Profil / Quotidiennes, sans écran dédié ;
- `!faveur` finalisé ;
- migration conservatrice et critères d'acceptation documentés.

Dernier domaine clôturé :
`docs/legacy/19-codes-cadeaux-audit.md` — Codes cadeaux — **CLÔTURÉ après R691**.

État du domaine clôturé :
- codes ponctuels et codes annuels conservés ;
- workflow Admin Brouillon → Publié ;
- token manuel avec génération optionnelle ;
- titre d'affichage séparé du code ;
- disponibilité immédiate, programmée, sans expiration ou annuelle ;
- douze codes Festivals conservés à +1 600 Primogemmes +200 000 Moras ;
- récompenses Admin V1 : Primogemmes, Moras et sept types de particules ;
- écran joueur `Disponibles` / `Récupérés` ;
- récompenses visibles avant claim ;
- nouveau joueur éligible tant que le code reste actif ;
- rappel Twitch compact et dédupliqué ;
- Codes accessibles à un profil Twitch-only existant même sans élément choisi ;
- désactivation Admin ;
- récompenses/token/type verrouillés après le premier claim ;
- statistiques Admin simples ;
- `!code` finalisé ;
- réactivation/notifi­cation annuelle finalisée ;
- Event reste uniquement consommateur de la disponibilité d'un code Festival ;
- claims, récompenses et notifications transactionnels/idempotents ;
- migration de `gift_codes.json` et `usedCodes` cadrée ;
- critères d'acceptation documentés.

Dernier domaine clôturé :
`docs/legacy/23-help-command-coherence-audit.md` — Help / cohérence finale des commandes — **CLÔTURÉ après R731**.

État du domaine clôturé :
- Help reste entièrement read-only, sans JSON, persistance ou dépendance à l'état joueur ;
- `!help` cible utilise catégories, résumé de catégorie et aide directe par commande ;
- catégories Help : Progression / Gacha / Ressources / Collection / Équipe / Activités / Social / Events / Classements / Twitch ;
- lorsqu'un token correspond à une vraie commande, l'aide directe de cette commande est prioritaire sur un ancien alias de catégorie ;
- l'aide est filtrée selon le canal courant et les permissions ;
- l'administration Giveaway reste séparée de l'aide joueur publique ;
- aucun `!xp`, `!gift` ou `!subscription` canonique n'est inventé ;
- `!top taux5` est la syntaxe canonique du Taux de 5★ ; `!top luck` reste alias historique ;
- le futur écran standalone `Aide / Guide` reste plus riche et distinct du Help textuel ;
- le domaine reste susceptible de recevoir uniquement des corrections factuelles découvertes pendant le sweep exhaustif final.

Dernières vérifications de couverture clôturées :
- `docs/legacy/24-final-script-sweep.md` — Sweep final des 37 scripts legacy — **CLÔTURÉ : 37/37 scripts couverts** ;
- `docs/legacy/25-final-json-sweep.md` — Sweep final des 17 JSON legacy — **CLÔTURÉ : 17/17 JSON vérifiés ; `monthly_events.json` confirmé comme résidu vide non migré**.

Couverture legacy globale :
- scripts `.txt` : **37/37 vérifiés** ;
- JSON : **17/17 vérifiés** ;
- source legacy sans propriétaire documentaire : **0** ;
- nouvelle décision produit issue des sweeps : **0**.

Dernière consolidation clôturée :
`docs/specifications/v1-data-model.md` — Modèle de données V1 — **CONSOLIDÉ : entités métier, sources de vérité, états temporels, cardinalités, contraintes, mapping exhaustif des 17 JSON, provenance, idempotence et ordre de migration cadrés ; aucune nouvelle décision produit.**

Documentations Twitch externes finalisées :
- `docs/notion/guide-demarrage-twitch.md` — Guide de démarrage Twitch — **TERMINÉ / NOTION READY** ;
- `docs/notion/guide-technique-twitch.md` — Documentation Technique Twitch — **TERMINÉ / NOTION READY**.

Architecture backend consolidée :
- `docs/architecture/backend-architecture-v1.md` — **socle V1 retenu : PostgreSQL/Supabase, Supabase Auth, Node.js/TypeScript/Fastify, Prisma ORM 7.10.0 stable, Railway et Cloudflare Pages ; Realtime reste une capacité future à n'activer que sur besoin explicite ; trajectoire Free-first puis montée en gamme sans refonte** ;
- `docs/architecture/postgresql-schema-v1.md` — **schéma relationnel V1 consolidé : tables, types, clés, contraintes, index, transactions, idempotence, RLS, ordre des migrations et sous-ensemble du premier vertical slice définis**.

Domaine actif :
**Événements mensuels — Lots 1 à 6 clôturés publiquement ; Calendrier de Noël et correctif Configuration candidats sur review, à soumettre à la review indépendante ChatGPT. Les votes de bannière communautaires ne sont pas commencés.**

Ordre d’implémentation V1 détaillé : [implementation-order-v1.md](../roadmap/implementation-order-v1.md). Le Master reste le seul tracker vivant.

État d'autorisation infrastructure :
`PAID_INFRA_APPROVED = false`

- développement et première alpha : approche Free-first ;
- aucun service payant n'est actuellement autorisé ;
- un accord explicite du propriétaire mettra à jour ce Master avant tout upgrade ;
- lorsqu'un fournisseur le permet, un changement Free → payant doit éviter toute refonte d'architecture.

État du backend et de Supabase DEV :

- squelette Fastify / TypeScript checkpointé ;
- Prisma ORM 7.10.0 stable ;
- Supabase DEV provisionné et connexion PostgreSQL fonctionnelle ;
- vingt-six migrations applicatives versionnées et suivies par Prisma, dont les migrations additives 020–026 des fondations Event, Jeux A/B/C, paliers, Shop/Collection et Calendrier de Noël appliquées sur Supabase DEV ;
- les tables privées couvrent notamment possessions/C6, Gacha, préférences, Sac, Teams, Banque, Boutique, Défi, Combat, Expedition/Notifications, Boss, Concours, Codes, les fondations Event et l’état quotidien Event ;
- référentiels seedés avec 7 éléments et 9 ressources ;
- RLS activée sur les tables de fondation, sans policy client permissive ;
- Auth Supabase réel checkpointé au commit `027d230f7d047e0469076418d3d5122e831bdce6` ;
- vérification JWT Supabase via JWKS, contexte Auth Fastify, provisioning initial transactionnel et routes `/api/v1/me` / `/api/v1/onboarding/player` opérationnels ;
- flux réel validé manuellement avec un véritable utilisateur Supabase Auth et un véritable access token ;
- premier Player réel `Kichnifou` provisionné avec succès ;
- `GET /api/v1/me` retrouve correctement le Player existant ;
- un second appel d'onboarding avec un autre displayName ne recrée pas le Player et ne renomme pas silencieusement `Kichnifou` ;
- premier vertical slice métier backend terminé et validé sur Supabase DEV ;
- choix permanent et idempotent de l'élément via `POST /api/v1/me/element` ;
- lecture lossless des neuf soldes via `GET /api/v1/me/resources` ;
- Roue quotidienne réelle via `POST /api/v1/wheel/spin`, avec RNG serveur, journée `Europe/Paris`, résultat mémorisé, mouvement économique, statistiques et protection transactionnelle contre les doubles gains ;
- tests unitaires, tests DB réels et scénario concurrent de la Roue validés.
- récompense quotidienne réelle implémentée par Codex : état serveur par Player, reset `Europe/Paris`, claim atomique/idempotent et trois crédits via le moteur économique central ;
- routes Auth `GET /api/v1/daily-reward/today` et `POST /api/v1/daily-reward/claim` couvertes par les tests ;
- migration additive `002_add_player_daily_reward_state` appliquée et tests DB/concurrence validés ;
- récompense quotidienne réelle : **VALIDÉE PUBLIQUEMENT PAR LE PROPRIÉTAIRE** sur [https://gachaimpact.pages.dev](https://gachaimpact.pages.dev) ; disponibilité, claim, +160 Primogemmes, +160 particules principales, +10 000 Moras, mise à jour immédiate des soldes, F5, logout/login et absence de second gain validés ;
- domaine Récompense quotidienne réelle : **CLÔTURÉ comme checkpoint fonctionnel**.
- Progression Player réelle / dé-mock Niveau-XP : **VALIDÉE PUBLIQUEMENT PAR LE PROPRIÉTAIRE / CLÔTURÉE** sur [https://gachaimpact.pages.dev](https://gachaimpact.pages.dev) ; vrai Niveau 0, `0 / 30 XP`, barre réelle, F5, logout/login, second compte et non-régression Ressources / Daily Reward / Roue validés ;
- `GET /api/v1/me/progression` expose les compteurs `bigint` lossless et le niveau dérivé de l'XP cumulative selon `min(floor(xp / 30), 100)` ; une primitive serveur centrale transactionnelle de gain d'XP existe désormais pour les sources métier légitimes, sans nouvel endpoint public ;
- la sidebar charge niveau, XP du palier et barre depuis l'état serveur au bootstrap authentifié ; l'objectif Gacha, Pity, Garantie et Capture sont reliés à l'état Gacha réel, et le panneau Équipe active lit désormais la Team serveur autoritative ;
- premier lot Team réel : **DÉPLOYÉ ET VALIDÉ PUBLIQUEMENT PAR LE PROPRIÉTAIRE** ; Teams 1 à 10, activation, compositions 0..4, sidebar, passifs dérivés et persistance après refresh/reconnexion validés ;
- lot Team Management 0.70 : **DÉPLOYÉ** ; le panneau à quatre passifs et son bouton `Voir les passifs` sur desktop 1920×1080 sont désormais **VALIDÉS PUBLIQUEMENT PAR LE PROPRIÉTAIRE**, sans régression constatée en 2560×1440 ni sur mobile ;
- lot Team / Gacha 0.71 : **DÉPLOYÉ ET VALIDÉ PUBLIQUEMENT** pour son fonctionnement métier, son anti-spoil et ses présentations déjà livrées. Le candidat 0.74 ne change aucune règle métier : seul le micro-polish typographique du remboursement C6 compact reste à reviewer puis à revalider ;
- Gacha — catalogue / bannière / cible / état joueur et présentation UI associée : **FONDATIONS PUBLIQUEMENT VALIDÉES SANS RÉSERVE PAR LE PROPRIÉTAIRE — DOMAINE CLÔTURÉ** ; catalogue réel, rotation réelle, quatre 5★, six 4★, sélection/changement/persistance de cible, état joueur Gacha et présentation Pity/Garantie/Capture sont validés ;
- UI Gacha : **PUBLIQUEMENT VALIDÉE ET CLÔTURÉE** pour Hero splash, picker 5★ 2×2, primitive responsive commune des portraits, variantes Team/Équipe active/Box/Personnages/4★ Invocation, desktop, mobile portrait et paysage, sidebar Objectif, aperçu Invocation de l'Accueil, navigation et Particules agrandies ;
- Personnages reste validé ici pour sa présentation actuelle. La Box personnelle et l'écran Team consomment désormais leurs données serveur réelles ;
- moteur Pull x1/x10 serveur implémenté et testé : coût complet de 160/1 600 Primogemmes, résolution séquentielle, Pity 5★/4★, 50/50, Garantie, Capture, récompenses secondaires, possessions/copies/constellations, remboursements C6+ et progression C6 minimale ; la statistique augmentée et sa valeur finale, ou l'état maxé, sont conservés dans le snapshot individuel du PullResult ;
- le débit économique centralisé alimente `ResourceMovement` et `PlayerEconomyStats.totalPrimosSpent` ; les récompenses et remboursements réutilisent le crédit commun ;
- chaque intention crée une `BusinessOperation` et une `PullOperation`, puis 1 ou 10 `PullResult` ordonnés dans une transaction `SERIALIZABLE` avec verrouillage des états joueur ; les retries d'une même clé sont idempotents, restituent la progression C6, les passifs, bonus et l'état Gacha final du Pull d'origine depuis les snapshots sans nouveau RNG ni second crédit, même si un Pull ultérieur a modifié l'état courant ; les dépenses concurrentes ne peuvent pas produire de solde négatif ;
- route authentifiée `POST /api/v1/gacha/pull` ajoutée avec payload `{ count: 1 | 10, idempotencyKey: UUID }` et DTO lossless ;
- les boutons x1/x10 sont actifs uniquement dans l'écran Invocation ; l'Accueil reste passif. Dès que le POST autoritatif réussit, le frontend libère l'intention et révèle le résultat persistant ; les refreshs Ressources/Gacha deviennent secondaires, avec conservation du résultat et fallback sur son `playerState` si un GET échoue ;
- les passifs Team sont dérivés côté serveur depuis les personnages actifs de la seule Team active et appliqués ensemble à chaque vœu : Hydro modifie le taux 5★ en points de base, Pyro/Géo multiplient exactement et avec floor la récompense secondaire concernée, puis Cryo/Électro/Anémo/Dendro s'exécutent dans cet ordre après le résultat normal ; un x10 conserve le même snapshot Team mais effectue dix tests individuels ;
- le premier test public du Pull a validé le backend, le débit économique, la Pity et la persistance après F5 : Arlecchino 5★ a été obtenue sur un vrai 50/50 gagné, puis 6 614 Moras au Pull suivant ; ces deux résultats réels de `Kichnifou` sont conservés ;
- ce même test public n’a **pas** validé l’UX initiale : résultat ajouté sous la bannière, scroll nécessaire, absence de vraie séquence et symbole générique pour les Moras ;
- le test public de la V2 Invocation, promu au commit `b06948827d89f8b2cd4f69c6365066d891ca48ce`, a validé l’animation, le flow x1/x10, les ressources, le clic de surface, l’Historique, le récapitulatif x10 et l’immersion générale ;
- l’expérience Invocation actuelle est **DÉPLOYÉE, VALIDÉE PUBLIQUEMENT PAR LE PROPRIÉTAIRE ET CLÔTURÉE** au checkpoint `2d2e1e73867e2e6324fdd00b8b3457a932c9495e` : Hero/Détail, `Nouveau`/`Cx`, révélations 4★/5★, Focus 2 s, suspense 5★, Historique, récapitulatif x10, anti-spoil, navigation hors Invocation, logout/login même compte pendant Pull, persistance et masquage du remboursement jusqu’au disclosure ont été validés ;
- backlog UX Invocation non bloquant : rendre plus tard le débit `-160` / `-1 600` Primogemmes visuellement optimiste exactement au clic, avec rollback si le POST échoue. Ce micro-polish ne maintient pas Invocation comme domaine actif ;
- Ressources, XP, Daily Reward et Roue restent sans régression publique constatée.

## État du lot 0.76 — finalisation Sac, progression globale, C6 et outils Super/Testeur

- Gacha x1/x10, y compris verrou de récapitulatif et feedback C6 compact, est publiquement validé ; les filtres, tris et états vides de Personnages le sont également. Ces domaines ne sont pas reconstruits par ce lot.
- Toute vraie progression autoritaire est désormais publiée par une primitive frontend globale, indépendante de l'écran actif ; les mutations administratives peuvent explicitement rester silencieuses. La modale Level-up, la sidebar et l'anti-spoil Gacha sont publiquement validés.
- La fiche commune Box/Team/Sac expose les cinq statistiques Concours réelles d'un personnage 5★ C6, initialisées à 1 et plafonnées par la constante métier à 20 ; une progression manquante reste une anomalie explicite pour ce seul cas. Les 4★ C6 restent valides sans ligne ni section Concours. La mécanique Stella est validée, tandis que ce nouveau wording et cette section restent à revalider publiquement.
- Modération est un outil transverse à deux rangs player-facing : `ADMIN` est affiché Super et peut cibler tout Player ACTIVE, tandis que `TESTER` est affiché Testeur et dispose des outils Ressources, XP, Gacha et Stella uniquement sur son propre compte. `MODERATOR` communautaire reste sans accès. Les mutations distinguent acteur/cible, sont auditées et idempotentes ; une intention frontend inclut aussi la cible, l'action et son payload, y compris l'attribution ou le retrait Testeur, et bloque toute autre cible ou action tant qu'elle reste ambiguë. La recherche et le navigateur Super appliquent côté serveur normalisation casse/accents, filtres, tris et pagination fixe de dix sans extension PostgreSQL.
- Après safety gate DEV, Kichnifou cumule `ADMIN`, `MODERATOR` et `TESTER`, l'attribution ADMIN portant la provenance `owner-authorized-dev-super`; le lot 0.76 avait relevé 209 XP au moment de son contrôle — snapshot historique désormais supersédé par le dernier état communiqué à 211 XP — sans récompense ni montée de niveau produite par ce contrôle.
- Sac conserve les seuls micro-polish candidats à revalidation publique : respiration du premier groupe dans Tout, alignement centre Y Primos/Moras et titre Monnaie dans Ressources. Modération reste transverse et Personnages ne devient pas un nouveau domaine de roadmap.

## État du candidat 0.77 — corrections de validation Modération, Sac et Stella

- La régression de ciblage Modération provenait du chargement initial `onLoad()` relancé par des identités de callbacks recréées entre `AppBootstrap`, `GameShell` et `ModerationScreen`. Cette réhydratation revenait sur l'acteur connecté et écrasait dans le même mouvement les brouillons locaux, dont Masterless Stella Fortuna. Les handlers sont désormais stables, la cible sélectionnée est distincte du snapshot serveur, et les réponses async obsolètes sont ignorées. Une hydratation ne survient plus qu'au chargement initial, après un changement explicite de cible ou après une mutation confirmée.
- Le picker Super est un panneau sombre accessible : cible courante explicite, action `Moi`, recherche à résultats verticaux, niveau et badge Testeur. Après sélection ou attribution/retrait du rôle Testeur, la cible externe reste sélectionnée. Les résultats visant un tiers restent confinés à Modération ; seuls les résultats visant l'acteur synchronisent sa sidebar et ses caches.
- Le propriétaire a confirmé que `Kichnifou`, `Mynonyme`, `MynonymeTest1`, `MynonymeTest2`, `MynonymeTest3`, `Céo`, `Mika` et `Jean Julien` sont des comptes DEV légitimes à conserver. Aucun audit de provenance, nettoyage, changement d'identité, désactivation ou suppression n'a été effectué. Le dernier XP communiqué pour Kichnifou est 211 ; ce lot ne le modifie pas.
- Tous les premiers groupes du Sac reçoivent la même respiration sous le header. La navigation conserve `Tout`, `Ressources`, `Objets`, `Collection`, tandis que les groupes d'objets affichent `Progression` et `Objets rares` sans changement des identifiants persistés `objects` et `collection`. L'alignement validé de Mora/Primogemmes est conservé.
- La fiche personnage personnelle partagée Box/Team/Sac remplace la ligne Favori et le grand bouton par une étoile accessible près du nom. Sa zone Stella ne réserve plus de ligne vide au repos et le layout principal épouse la hauteur utile de ses colonnes. Après une Stella confirmée, un `+1` temporaire cible la constellation réellement augmentée ou la seule statistique C6 retournée par le DTO structuré ; C5 → C6 affiche le `+1` de constellation et initialise la section Concours sans faux gain de statistique.
- Les cinq statistiques Concours emploient partout leurs libellés français centralisés. La garde explicite 5★ C6 est conservée. Les régressions sont couvertes par les tests frontend ciblés de sélection/rerender, drafts, rôles, isolation acteur, catégories Sac, favori partagé et feedback Stella. Aucun changement backend ni aucune migration ne sont requis par ce candidat. Les validations PostgreSQL DEV ont uniquement créé, muté puis nettoyé leurs fixtures éphémères identifiées par UUID ; aucun compte DEV confirmé n'a été ciblé.
- Le candidat 0.77 a été approuvé, promu sur `main` et déployé automatiquement. Sa validation publique a confirmé la stabilité de la cible Modération, l'isolation acteur/cible, la conservation du brouillon Stella, l'attribution/retrait Testeur, les catégories et espacements du Sac, l'étoile Favori, les animations `+1`, les libellés Concours français et les contraintes C6. Les réserves d'ergonomie relevées ensuite sont traitées par le candidat 0.78 ; Sac n'est pas encore clôturé publiquement.

## État du candidat 0.78 — navigateur joueurs, outils Testeur et polish des écrans longs/Stella

- Modération commence directement par le panneau `Joueur ciblé`, sans ancien header supérieur. Super conserve `Moi` et la recherche rapide, et dispose de `Choisir`, qui ouvre un navigateur de Players ACTIVE : liste initiale A→Z, sélection temporaire confirmée explicitement, fermeture/cancel/Escape sans mutation, filtres élément/Testeur, tris nom/niveau dans les deux directions et pagination serveur fixe de dix.
- La recherche de Players est désormais insensible à la casse **et aux accents** par sous-chaîne contiguë. Le backend normalise puis applique recherche, filtres et tri avant la pagination ; le navigateur ne charge jamais toute la liste. La réponse structurée expose `players`, `page`, `pageSize`, `total` et `totalPages`, et une page hors bornes est rabattue sur la dernière page valide. Aucune extension PostgreSQL ni migration n'est nécessaire au volume V1 attendu.
- `TESTER` dispose maintenant de tous les outils de préparation de gameplay sur son propre compte : Ressources, XP, Gacha et Stella. Il ne reçoit ni recherche, ni navigateur, ni ciblage tiers, ni gestion de rôle. `ADMIN`/Super conserve les capacités antérieures et `MODERATOR` seul reste sans accès. Les routes backend revalident acteur/cible ; les mutations restent transactionnelles, auditées et idempotentes.
- Modération, Box et Personnages réutilisent un même grand panneau encadré occupant la hauteur utile de la colonne centrale sur desktop, avec défilement interne et bord inférieur visible. Sous 1121 px, le flux redevient naturel et conserve l'absence de débordement horizontal.
- Les cadres d'icônes de ressources élémentaires utilisent une palette explicite et cohérente pour les sept éléments, y compris Géo et Dendro. La fiche personnage partagée conserve une base de hauteur harmonisée entre 4★ et 5★ et un portrait couvrant mieux sa zone sans déformation ; les 4★ restent sans Stella ni statistiques Concours.
- La zone Stella réserve une seule ligne stable au feedback et centre verticalement son bouton sur l'ensemble du bloc. Le texte de résultat persiste tant que la fiche reste ouverte ; seul le `+1` visuel disparaît après son animation. C5 → C6 affiche le message générique `Stella utilisée avec succès.` et le `+1` de constellation, tandis qu'un 5★ déjà C6 affiche durablement le libellé français et la nouvelle valeur de l'unique statistique augmentée.
- Le propriétaire confirme à nouveau que `Kichnifou`, `Mynonyme`, `MynonymeTest1`, `MynonymeTest2`, `MynonymeTest3`, `Céo`, `Mika` et `Jean Julien` sont des comptes DEV légitimes. Aucun nettoyage, changement d'identité, désactivation, suppression, migration ou mutation de leurs données n'a été effectué par ce lot.
- Le candidat 0.78 a été reviewé, promu sur `main`, déployé automatiquement et testé publiquement par le propriétaire. Le navigateur et son ciblage, le rôle et les outils Testeur, la recherche insensible aux accents, les couleurs Géo/Dendro et le feedback Stella sont validés. La fiche 4★ et le nouveau grand panneau scrollable sont validés dans leur principe ; trois dernières réserves visuelles — contrôles fixes, hauteur stable du navigateur et contact exact du portrait avec son bord bas — sont intégrées au candidat 0.79.

## État du candidat 0.79 — contrôles stables et premier vertical Boutique réel

- Box et Personnages séparent désormais structurellement leurs résumé/recherche/filtres/tris fixes du body scrollable contenant les cartes ou l'état vide. Modération conserve de la même manière le panneau `Joueur ciblé` et sa recherche rapide hors du body des outils ; les résultats rapides sont un overlay ancré qui ne pousse plus la grille.
- Le navigateur de Players desktop possède une hauteur bornée stable correspondant à sa capacité d'une page de dix lignes : header, filtres et footer gardent leur position pour 0, 1, 8 ou 10 résultats, tandis que seule la zone centrale peut défiler. Mobile reste borné au viewport.
- La primitive partagée de portrait supprime le reliquat subpixel sous l'image avec un wrapper sans hauteur de ligne et un débordement inférieur contrôlé d'un pixel, sans zoom spécifique à Kaeya ni distinction 4★/5★.
- La migration additive `010_add_shop` crée `shop_item_definitions` et `shop_purchases`, active leur RLS, retire les droits directs `anon`/`authenticated` et sème le catalogue canonique Mission → Primos → Ticket. Elle a été appliquée uniquement au projet Supabase DEV `rmkpjudimoibyjsjtubh` et ne modifie aucun Player ni aucun solde.
- `GET /api/v1/me/shop` sert le catalogue visible ordonné, les règles de quantité, les probabilités Ticket dérivées des poids, l'état personnel et les cinq achats récents. `POST /api/v1/me/shop/:itemId/purchase` recalcule prix, disponibilité, quantité et effet côté serveur ; les `bigint` traversent l'API sous forme de chaînes décimales.
- Un achat verrouille le Player dans une transaction `SERIALIZABLE`, débite uniquement le portefeuille Moras via l'économie centrale, persiste exactement un `ShopPurchase` et son `effectSnapshot`, puis complète la `BusinessOperation`. Une même intention restitue le même résultat sans second débit ni RNG ; un payload différent est refusé et les achats concurrents ne peuvent pas rendre le wallet négatif.
- `primogem-bundle` accepte tout entier positif : 50 000 Moras et +160 Primogemmes par lot. Le bouton `MAX` remplit uniquement la quantité affichée ; la mutation retourne un snapshot autoritatif qui synchronise la Boutique et la sidebar sans bootstrap complet.
- `reward-ticket` est strictement unitaire et immédiatement consommé, sans objet Sac ni confirmation préalable. Ses cinq branches de poids 1 sont affichées à 20 % calculés : +1 600 Primogemmes, +1 000 particules principales, +800 particules d'un autre élément persisté, +10 Pity 5★ plafonnée à 90 par une primitive Gacha centrale, ou +50 000 Moras. Le résultat structuré est persisté avant sa révélation en overlay.
- Au seul état candidat 0.79, `daily-mission` était servi en premier, visible à 10 000 Moras et temporairement indisponible. Cette présentation n’a pas été promue seule et est révisée par le candidat 0.80 : la clé technique demeure, sous le nom player-facing `Défi`, mais sort de la projection Boutique tant que son service complet n’existe pas.
- L'écran Boutique ne dépend plus de `mockData`, réserve ses zones de feedback et d'action pour éviter les déplacements, affiche le wallet autoritatif et au plus cinq achats récents. Le stockage est exhaustif ; le futur `Voir tout` reste propriétaire de l'écran Historique transversal, qui n'est pas créé dans ce lot.
- Cache et intentions Boutique sont éphémères, isolés par Player, protégés contre les réponses obsolètes, réutilisent la même clé après erreur ambiguë et sont vidés au logout. Les snapshots de mutation synchronisent Moras, Primogemmes, particules et état Gacha global.
- Boutique est **COMMENCÉE MAIS NON PUBLIQUEMENT CLÔTURÉE**. `PAID_INFRA_APPROVED = false` reste inchangé ; aucun service payant, aucune configuration Railway et aucun déploiement manuel ne font partie de ce candidat.

## État public 0.80 — navigation V1, Menu, Configuration et Quotidiennes

- Le candidat 0.80 contient le commit 0.79 comme ancêtre technique ; 0.79 n’est pas promu seul. Les micro-polish des panneaux longs et le premier vertical Boutique réel Primos/Ticket sont conservés sans régression.
- La navigation principale contient exactement sept tuiles : Accueil, Invocation, Personnages, Activités, Sac, Boutique, Configuration. Personnages réutilise Box/Équipe/Catalogue ; Activités expose Quotidiennes/Missions/Combat/Événement/Concours avec des coques honnêtes pour les domaines non implémentés. Les anciens hashes restent compatibles et les deep links groupés sont canoniques.
- Quotidiennes possède Aperçu/Roue/Défi. Aperçu liste dans l’ordre Récompense quotidienne, Roue, Défi, Combat, Expédition, Amitié et Événement : les deux systèmes déjà réels gardent leur état serveur, les autres restent explicitement indisponibles sans progression fictive et leurs accès conduisent vers leurs propriétaires existants ou futurs. La Roue jouable a quitté Accueil.
- Menu est toujours accessible au clic depuis le header, pagine au plus neuf destinations dans une grille stable et désactive les destinations futures. `Configuration > Menu` réordonne, masque/réaffiche et réinitialise avec des boutons accessibles. La préférence personnelle `navigation_menu_v1` est servie par une API authentifiée et persiste dans `player_preferences`, sans nouvelle table.
- Le rang affiché par Modération appartient désormais à la cible et suit ses rôles actifs : Super, Modérateur, Testeur ou Joueur. Les permissions restent celles de l’acteur et aucun DTO Player public n’expose les rôles.
- La migration additive 011 conserve `daily-mission`, la renomme `Défi`, la masque et la désactive. Elle est appliquée uniquement sur Supabase DEV `rmkpjudimoibyjsjtubh`; la migration 010 est inchangée et aucun Player, solde ou achat n’est modifié par cette migration.
- Le futur Tutoriel est entièrement documenté mais non implémenté. Le hero Accueil et la carte Récompense quotidienne de sidebar restent en place ; les évolutions dashboard/sidebar attendent des activités réelles.
- L’index documentaire renvoie correctement vers l’audit Boutique/Sac/Coffre existant `10-sac-coffre-shop-audit.md` ; aucun audit n’est renommé.
- Le propriétaire a validé publiquement 0.80. Navigation, Menu/Configuration, coques Activités, Quotidiennes/Roue, rang cible Modération et régressions Boutique constituent le dernier checkpoint public. Boutique reste le domaine actif et n’est pas encore publiquement clôturée ; Quotidiennes n’est pas déclarée domaine métier commencé au-delà de son shell et de la Roue déjà réelle. `PAID_INFRA_APPROVED = false` reste inchangé.

## État du candidat 0.81 — consolidation shell et historique Boutique

- Team place le sélecteur avant un header sélectionné plus compact. Seules les icônes sont réduites dans le cas exact de quatre passifs ; tous les comportements existants de composition restent inchangés.
- Les sous-navigations desktop sont fixes, entièrement visibles et sans scrollbar ; mobile conserve le défilement horizontal tactile sans barre native. Quotidiennes et Configuration utilisent un cadre fermé pleine hauteur avec contrôles fixes et body interne défilant.
- La page du Menu global vit dans `GameShell`, survit aux fermetures et navigations de la session, revient à 1 au nouveau montage/logout et se rabat si le masquage réduit le nombre de pages. Le registre reste exactement celui des seize destinations 0.80.
- Configuration expose Menu actif, Confidentialité/Apparence désactivés, les flèches accessibles et un drag-and-drop à aperçu local, sauvegarde unique au drop et rollback sur erreur.
- Boutique ouvre Banque depuis son portefeuille, affiche seulement le dernier achat dans son aperçu et charge un historique personnel paginé à la demande. Banque et Boutique partagent la coque de modale, pas leurs données ni leurs services.
- Le backend ajoute `GET /api/v1/me/shop/history?page=N`, dix lignes par page, tri stable date puis id décroissants et code 400 `SHOP_HISTORY_PAGE_INVALID`. Aucune migration n’est créée ; 010/011 restent immuables et `ShopMemoryCache` reste inchangé.
- Le candidat 0.81 a été promu puis validé publiquement par le propriétaire. Ses consolidations shell, Team, Quotidiennes, Menu/Configuration et historique Boutique constituent le checkpoint public courant. Les comptes DEV légitimes confirmés restent intacts ; aucun nettoyage de Player n’appartient à ce lot.

## État du candidat 0.82 — Défi quotidien réel, conversion et contrat UI

- `Quotidiennes > Défi` repose sur un état serveur réel. Avant achat, l’objectif reste caché ; l’achat coûte 10 000 Moras. Le catalogue contient messages 10, Pulls 5 et conversion 320 à poids égaux, mais messages reste physiquement inéligible jusqu’au vrai producteur chat. Aucune probabilité ni composition du pool n’est exposée.
- Une attribution unique par Player/journée `Europe/Paris` est snapshotée dans `player_daily_challenges`. Un Défi actif ancien expire au reset sans attribution automatique. Un Défi terminé crédite automatiquement 800 Primos une seule fois et reste visible terminé pour sa journée.
- Pull x1/x10 et conversion personnelle progressent dans la transaction de leur action réelle. La conversion Sac consomme uniquement les particules de l’élément principal et crédite les Primos 1:1. Achat, changement et conversion sont idempotents ; le premier changement coûte 20 000 Moras puis double et remet la progression à zéro.
- La migration additive 012 crée les deux tables privées avec contraintes, index, RLS et révocation `anon`/`authenticated`. Les migrations 010/011 restent inchangées. Les tests DB utilisent exclusivement des Players fixtures UUID et les nettoient précisément.
- Le contrat `ui-layout-contract-v1.md` devient la référence transverse. Team compacte ses passifs sur une ligne, les headers Activités sont modérément resserrés, le drag-and-drop Configuration distingue insertion et échange, Boutique remplit la hauteur utile, et les historiques Banque/Boutique gardent dix emplacements et un footer stable.
- Le gameplay 0.82 a été promu et fonctionne publiquement. Sa validation visuelle a toutefois été refusée : les invariants de dimensions, de scroll et d’actions contextuelles sont repris par le candidat correctif 0.83. Les huit comptes DEV légitimes confirmés et tous leurs achats/soldes restent protégés.

## État public 0.83 — stabilisation partiellement validée et retours publics

- Team réserve un panneau de passifs aux dimensions extérieures invariantes pour un à quatre passifs : plein format, deux lignes, deux cartes puis une demi-carte centrée, ou grille 2 × 2. L’action de référence occupe une colonne `max-content` distincte et la modale détaillée reste inchangée.
- Les headers Activités sont ramenés à une hauteur desktop bornée de 92 à 104 px avec titre 29 px. Le Défi utilise une carte pleine largeur et de hauteur stable, des zones internes réservées, une confirmation compacte et un état terminé standardisé avec progression contextualisée.
- Configuration remplace les seuils de pointeur par de vraies zones d’insertion entre les lignes ; déposer sur le corps d’une ligne conserve l’échange. Tous les targets annoncent `move`, les previews restent distinctes et un drop produit une seule sauvegarde.
- Boutique ancre la dernière transaction au bas de son body, étire uniformément les cartes disponibles et conserve ses contrôles en pied. Les historiques Banque/Boutique matérialisent toujours dix lignes sur desktop, sans scroll vertical à 1920 × 1080 ou 1366 × 768 ; mobile garde son scroll interne.
- Sac homogénéise les cartes Ressources avec un emplacement d’action réservé : Primos ouvre Boutique, Moras ouvre Banque et seules les particules personnelles ouvrent la conversion partagée. La sidebar expose les mêmes entrées contextuelles et réutilise exactement la même modale/idempotence sans navigation forcée.
- Une transition réelle `ACTIVE → COMPLETED` survenue pendant la session produit un feedback global séquencé dans la famille Level-up, jamais au chargement initial : verrou d’une seconde, fermeture backdrop/`Escape` puis disparition automatique vers 5,4 s. Aperçu standardise les états terminés Récompense, Roue et Défi sans inventer ceux des domaines futurs.
- La migration additive Prisma 013, ASCII-only via littéraux PostgreSQL `U&`, répare uniquement les trois colonnes textuelles des définitions de Défi et de leurs snapshots existants. Elle est appliquée et suivie sur Supabase DEV ; 012 reste immuable. Les huit comptes DEV confirmés, leurs identités, soldes, achats et états métier n’ont subi aucun nettoyage ni mutation.
- Le candidat 0.83 a été reviewé, promu et testé publiquement. Le propriétaire valide la géométrie générale Team et son bouton, les headers Activités, Boutique, History, l’UTF-8 Défi, le lien Primogemmes, ainsi que le standard général `✅ Terminé`.
- Le même test public refuse encore le statut secondaire du panneau Passifs, la présentation Daily Reward d’Aperçu, le DnD Configuration, la carte Défi 350 px, l’allongement universel des cartes Ressources et la position bas gauche de Conversion dans la sidebar. Ces points deviennent le correctif candidat 0.84 ; le métier Défi, la conversion 1:1 et le feedback de complétion restent inchangés.

## État public 0.84 — simplification Défi et restauration des layouts Ressources

- Team conserve intégralement le panneau 126 px, la grille 1/2/3/4, la colonne d’action et la modale détaillée validés ; seul le statut secondaire `Aperçu`/`Team active` est retiré.
- `Quotidiennes > Aperçu` présente la Récompense quotidienne avec la même carte, le même pied d’action et le même bouton que Roue/Défi, sans losange. Les états sont `Disponible aujourd’hui.` avec `Récupérer`, ou `✅ Terminé` avec `Récompense récupérée aujourd’hui.`, sans layout shift de mutation. La carte Daily Reward de sidebar n’est pas reconstruite.
- `Configuration > Menu` abandonne définitivement le drag-and-drop et retrouve la densité compacte pré-0.83 : seules les flèches `↑`/`↓`, Masquer/Afficher, Réinitialiser, la persistance et le rollback restent. Le DnD Team ne change pas.
- La carte Défi est entièrement recomposée en quatre zones stables — header, contenu, progression et actions — sur toute la largeur et sous 280 px desktop. Disponible, Actif, confirmation et Terminé partagent le même cadre ; progression et phrase sont séparées. Conversion ouvre la modale transverse sans navigation, Pulls va vers Invocation sans tirer, Messages n’expose aucune action factice. Changer reste secondaire et sa confirmation remplace le pied sans agrandir la carte.
- Le feedback `Défi terminé !` reste déclenché uniquement sur `ACTIVE → COMPLETED`, jamais au chargement, avec verrou, backdrop/`Escape` et auto-dismiss inchangés. Il reste à revalider publiquement sur une transition réelle.
- Le Sac reprend la géométrie compacte de la carte Moras au checkpoint `fc3ee53d7507e878e793bc75ef136a4f7fb3f59f`. Primos, Moras et les particules personnelles intègrent leur lien sans `min-height: 112px` ni footer universel ; les autres particules ne réservent rien. Dans la sidebar, `Convertir →` occupe l’espace interne bas droite sans modifier le cadre Particules.
- Boutique, History, migration 013, schéma Prisma et Supabase restent inchangés. Les huit comptes DEV légitimes confirmés et toutes leurs données restent intacts.
- Le propriétaire a validé publiquement le 0.84 : Team et ses passifs, la direction générale Daily Reward, Configuration arrow-only, le redesign Défi, ses actions Conversion/Invocation, la confirmation de changement, le contenu et les liens Ressources, la Conversion de sidebar et le standard `✅ Terminé` constituent le checkpoint public courant. Quotidiennes / Défi demeure le domaine actif.

## État public 0.85 — complétion des Quotidiennes et scroll interne du Sac

- Dans `Quotidiennes > Aperçu`, une activité réelle terminée affiche désormais trois lignes stables : `✅ Terminé`, son détail contextuel et `Obtenu : <résultat réel>`. Daily Reward lit les gains de son DTO, Roue utilise une restitution compacte incluant `Obtenu : Rien`, et Défi lit `rewardPrimogems`.
- Une Daily Reward, une Roue ou un Défi terminé ne rend plus aucun bouton d’action dans Aperçu ; les dimensions externes 0.84 restent inchangées et les tabs permettent toujours la consultation directe.
- Les six codes métier DailyChallenge connus possèdent une restitution française explicite. L’insuffisance de wallet distingue l’achat du changement et mentionne directement le manque de Moras ; aucun code backend ni comportement serveur n’est modifié.
- La hauteur externe mesurée de Masterless Stella Fortuna, 73 px à 1920 × 1080 comme à 1366 × 768, devient l’étalon des neuf cartes Ressources. Leur structure, leur contenu, leurs icônes et leurs liens validés restent inchangés ; Stella n’est pas leur modèle interne.
- Dans Sac desktop, le header fonctionnel reste fixe et tout ce qui le suit appartient à un body `minmax(0, 1fr)` en `overflow-y: auto`. Les catégories gauches restent immobiles ; mobile conserve son flux naturel sans second scroll interne.
- Aucun backend, schéma, migration, service Supabase, donnée DEV ou déploiement manuel n’appartient à ce lot. Le candidat 0.85 a été reviewé, promu puis validé publiquement par le propriétaire.

## État public 0.86 — Combat quotidien / Entraînement

- Le cadre bas de la sidebar devient un raccourci plein-clic `Quotidiennes > Aperçu`, sans claim ni faux compteur. Une intention éphémère force Aperçu depuis n'importe quel écran, y compris Roue ou Défi déjà monté.
- Les cartes Sac de 73 px conservent leurs axes communs. Primos, Moras, particules personnelles et Masterless Stella Fortuna utilisent toute leur surface comme action accessible, avec affordance et accent hover/focus contextuels ; les autres entrées restent non interactives et Stella ouvre directement son picker existant.
- La migration additive Prisma `20260912120000_014_add_daily_combat` matérialise `combat_attempt_mode`, la matrice normalisée de 28 matchups, la rencontre globale quotidienne et ses quatre snapshots ennemis, la composition persistante, ses slots, l'état journalier, les KO, les tentatives et membres snapshotés ainsi que les statistiques Player/personnage. RLS est active et les accès directs navigateur sont révoqués.
- `CombatService` et son store Prisma sont propriétaires de la journée `Europe/Paris`, de la génération race-safe, de la sélection manuelle, de la copie volontaire de Team, de l'Auto top 4 déterministe, du mode pending, de la formule unique en demi-points, du RNG serveur et de la résolution transactionnelle/idempotente.
- Une défaite incrémente les statistiques, rend les quatre membres KO pour la rencontre et permet une nouvelle tentative avec d'autres personnages. Une première victoire crédite exactement +800 Primogemmes et +20 000 Moras via l'économie centrale, une seule fois, puis clôt le quotidien. Box et Team ne sont que lues ; aucune composition active n'est modifiée.
- `Activités > Combat > Entraînement` affiche la rencontre, les slots, le picker Box, le preview détaillé, les modes, KO, résultats et statistiques partagées dans la fiche personnage. `Quotidiennes > Aperçu` projette À faire / En cours / Bloqué / Terminé et retire `Accéder` après victoire.
- `Boss` reste une coque honnête `Bientôt disponible` sans gameplay, schéma, statistique ou donnée fictive. Expedition, Missions permanentes et commandes chat/Twitch ne commencent pas dans ce lot.
- Le domaine fonctionnel actif est désormais Combat quotidien / Entraînement. Le moteur, la persistance, l'Auto, la récompense, la fiche et les erreurs explicites du lot 0.86 sont techniquement validés. Les parcours publics effectivement vérifiés couvrent la préparation, la composition, l'Auto, le lancement et une victoire ; les parcours de défaite, de KO et d'après-défaite restent à revalider publiquement avec le candidat 0.87.

## État public 0.87 — présentation compacte du Combat quotidien

- `Activités > Combat > Entraînement` remplace ses grands panneaux verticaux par une barre compacte stable : titre de rencontre à gauche, chance serveur et accès à une modale de calcul au centre, bouton Combattre toujours présent à droite et désactivé lorsque l'action n'est pas disponible.
- Les ennemis, personnages sélectionnés et slots vides partagent une carte horizontale de géométrie identique. Chaque ennemi reçoit du backend les éléments attaquants faibles/résistants dérivés de la matrice 014, dans l'ordre canonique ; aucune matrice n'est dupliquée dans React.
- Les actions Fiche/Changer/Retirer occupent un overlay sans effet sur les dimensions. Le bouton Fiche réutilise le cache et le vrai DTO Box ainsi que le modal complet avec favori, Stella et statistiques C6.
- L'état Combat quitte le contenu principal de la fiche Box : un libellé discret ouvre une petite modale dédiée aux statistiques. La géométrie principale historique reste inchangée et l'information disparaît lorsque la projection Combat n'est pas chargée.
- Les détails de chance n'affichent plus les notions techniques Brut/Final. Le feedback victoire, défaite, blocage ou erreur occupe une zone compacte réservée et ne déplace ni les équipes ni l'action Combattre.
- Aucun gameplay, formule, RNG, Auto, KO, économie, récompense, idempotence, schéma ou migration n'est modifié. Boss reste la coque indisponible validée. Le lot 0.87 est déployé ; son moteur et la majorité de sa présentation ont été validés publiquement, les derniers ajustements UX étant repris dans le candidat 0.88.

## État du candidat 0.88 — finalisation UX Combat et sidebar

- La hiérarchie physique de `Combat > Entraînement` devient `Ennemis` puis quatre cartes ennemies, command bar intermédiaire, `Votre formation` et quatre cartes joueur. La command bar réserve une ligne de feedback et répartit `Rencontre du jour`, le bouton Combattre stable au centre, puis chance, détails et `Mode : Manuel/Auto` à droite ; la date métier n'est plus présentée.
- Le bouton Combattre indisponible reste présent mais devient explicitement gris, neutre, sans glow et avec curseur interdit. Les textes ready/incomplet/bloqué/défaite sont simplifiés et l'aperçu TODO devient `Prêt à combattre` sans seconde ligne.
- La modale de calcul groupe Base, Bonus, Malus et Résultat final, signale discrètement une éventuelle limite et n'expose pas la valeur brute. La fiche Box emploie toujours `Statistiques →`, garde OK/💀 KO dans la seule modale statistique et étire structurellement l'artwork jusqu'au bas utile sans bande morte.
- La sidebar desktop reste strictement bornée à la hauteur disponible du shell, sans scroll ; sa densité s'adapte à la hauteur, Pity 4★ reste entièrement visible à 1920 × 1080 et Quotidiennes centre volontairement son contenu dans le surplus des écrans hauts.
- Les outils Ressources, Progression, Gacha et Objets de Modération affichent le snapshot autoritatif courant de la cible dans leur en-tête sans modifier leur hauteur externe ; sélection de ressource, changement de cible et mutations adoptent immédiatement le `ModerationStateDto` retourné.
- Aucun moteur, formule, backend, schéma, migration, donnée DEV ou service externe n'est modifié. Boss et Expedition restent non commencés. Le candidat 0.88 doit être reviewé indépendamment sur `review` avant toute promotion.

## État du candidat 0.89 — lancement Expedition et finitions publiques

- Le lot public 0.88 est validé par le propriétaire avec un bilan très positif. Sa sidebar, son Combat, ses modales, sa fiche personnage et sa Modération forment le checkpoint public courant ; 0.89 ne leur apporte que les finitions ciblées demandées.
- La carte basse Quotidiennes conserve son enveloppe 0.88 et adopte une composition interne en trois zones. Combat rapproche légèrement Ennemis des onglets et égalise Base/Résultat. La fiche affiche les données catalogue existantes Arme/Région. Modération retire `Actuel :` et son navigateur desktop matérialise dix slots fixes sans scroll vertical.
- Expedition devient le domaine fonctionnel actif : état personnel `IDLE/RUNNING/READY`, départ quotidien Europe/Paris, durée 20 h, récupération manuelle, reward au claim uniquement, économie et statistique atomiques, idempotence et concurrence sérialisée.
- Le workflow reste strictement dans `Personnages > Box`, `Activités > Quotidiennes` et le header Notifications. La Box porte actions, timer, badges et priorité READY respectant les filtres ; Quotidiennes projette les états autoritatifs et ouvre la fiche concernée.
- La migration additive 015 matérialise `player_expeditions`, `notifications` et leurs enums, contraintes, index, RLS et révocations navigateur. `totalCompleted` constitue la statistique durable minimale et la frontière `expedition.completed` prépare le futur consommateur Missions sans commencer ce domaine.
- Le header abandonne ses notifications fictives au profit du socle physique minimal : READY unique, lecture, lecture globale, archivage des lues, résolution au claim ou à l'annulation administrative, et deep link vers la fiche Box.
- Boss, Social, Event, Missions permanentes UI, chat/Twitch et tout domaine suivant restent hors périmètre. `PAID_INFRA_APPROVED = false` demeure inchangé ; aucun déploiement manuel n'appartient à ce candidat.

## État du candidat 0.90 — continuité Expedition et report de la migration legacy

- Le lot 0.89 déployé est largement validé publiquement : départ réel, état RUNNING, badge et fiche, timer initial, projection Quotidiennes, absence de second départ, Notifications vides réelles, Arme/Région, Modération et frontend général. Deux défauts frontend ont été observés : le countdown se réinitialisait au remount de la fiche et le callback `Accéder` se perdait dans `ActivitiesScreen` avant d'atteindre Quotidiennes.
- READY réel après 20 h, notification READY, priorité READY, claim, récompense, résolution de notification et nouveau départ post-claim restent à valider publiquement sur l'Expedition réelle en cours. Ils ne sont pas déclarés validés par 0.90.
- Le candidat 0.90 publie chaque nouvelle projection serveur Expedition une seule fois avec une ancre monotone centrale. Box et Quotidiennes consomment cette même ancre ; fermer/réouvrir ou changer d'écran ne remonte plus le timer. Le zéro visuel ne transforme jamais RUNNING en READY : les revalidations serveur existantes restent autoritatives.
- Le chaînage `GameShell → ActivitiesScreen → DailiesScreen → ExpeditionOverviewCard` transmet désormais l'intention. RUNNING/READY ouvre la fiche Box one-shot du personnage ; IDLE ouvre la Box normale et nettoie toute ancienne intention.
- Le propriétaire reporte désormais la migration legacy jusqu'à ce que beaucoup plus de domaines standalone soient physiques et stabilisés, notamment Boss, Concours, Event, Amitié/Social, Historique, Tutoriel, Chat, Twitch et les autres systèmes nécessaires au cutover. Cette séquence évite de maintenir puis recommencer un mapping partiel devenu obsolète.
- Le candidat 0.90 ne conserve donc aucune préparation physique de migration, aucun CLI dry-run, aucun parser, fingerprint ou rapport. Aucune migration réelle n'avait été exécutée ; aucun Player réel, compte protégé, donnée Supabase, migration Prisma, DDL ou service Railway n'est touché. `PAID_INFRA_APPROVED = false` demeure inchangé.

## État du candidat 0.91 — Boss mensuel physique et états Quotidiennes Expedition

- Le checkpoint public 0.90 confirme la stabilité du timer monotone et du deep link Expedition. READY/claim, récompense et nouveau départ après claim restent à revalider publiquement sur l’Expedition réelle ; Combat défaite/KO et après-défaite restent également en attente de validation publique.
- Quotidiennes applique désormais la convention transversale de complétion d’action : RUNNING et READY affichent `✅ Terminé` sans récompense fictive ; RUNNING conserve seulement personnage + timer et aucune action ; READY indique la récompense à récupérer et propose `Récupérer`, qui ouvre une seule fois la fiche Box concernée sans réclamer à la place du joueur. Après claim, un départ d’un jour précédent redevient `À faire`, tandis qu’un départ du jour reste `✅ Terminé` sans action. Les mentions `Départ précédent` sont retirées de cette surface.
- Le Boss mensuel est matérialisé comme second mode distinct dans `Activités > Combat`. Une instance globale est créée au premier accès et par scheduler au changement de mois Europe/Paris, sous verrou transactionnel, avec nom calendaire, `baseHp` adaptatif, variation entière uniforme ±15 % arrondie aux 10 000 PV, résistance parmi sept éléments et aucun seed SQL d’instance courante.
- Chaque Player possède 0..4 slots Boss persistants, indépendants de Team, du Combat quotidien, des KO et des mois. Copier la Team active est une action volontaire et partielle ; aucun Auto n’existe. Une attaque exige quatre possessions actives distinctes, recalcule puis snapshotte les dégâts autoritatifs, est limitée à une par jour et vise explicitement l’instance consultée.
- Attaque, diminution des PV, participation, statistiques lifetime, coup final, récompenses et notifications sont atomiques et idempotents. Une victoire crédite automatiquement chaque participant de 16 000 Primogemmes et 500 000 Moras via l’EconomyService, sans claim et sans bonus de coup final. La contrainte unique Boss/Player et le verrou du Boss garantissent un seul létal ; une intention concurrente perdante est refusée sans consommer son attaque quotidienne.
- L’UI live conserve identité, mois, résistance, statut, barre PV, preview totale, détails par personnage, bouton Attaquer toujours présent, formation, Top 3, place/contribution personnelle et statistiques lifetime. Lorsque le Boss courant est vaincu, elle devient le bilan mensuel R404 structuré en quatre groupes Boss, Communauté, Records et Votre contribution, avec durée calendaire Europe/Paris, scaling suivant, agrégats communautaires, records déterministes, Top 3 et état participant/non-participant.
- Seuls les mois antérieurs sont archivés. L’Historique R408 reste paginé à dix Boss par page et ses lignes compactes ouvrent un détail complet : base/max/PV restants, résistance, état/date, agrégats, records, coup final et adjustment réel dérivé. Quotidiennes conserve son sous-indicateur Boss discret sans modifier l’état du Combat quotidien.
- La migration additive unique `20260913160000_016_add_monthly_boss` est versionnée et appliquée sur Supabase DEV. Elle crée les instances, loadouts, attaques/membres, participations, statistiques et récompenses Boss avec contraintes, index, RLS et révocation de `anon`/`authenticated`. Les migrations 001 à 015 restent inchangées.
- Les actions ordinaires Pull, Combat quotidien, Boss, Expedition, Banque, Boutique et Quotidiennes donnent 0 XP direct quel que soit leur canal. Le futur gain XP standalone reste réservé à de vrais mini-jeux/épreuves dédiés, à tentatives quotidiennes limitées, avec valeur exacte à cadrer et une cible de bonne performance d’environ 30 XP/jour ; cette source se cumulera avec chat/Twitch. Aucun code, endpoint, schéma ni migration XP n’est ajouté au candidat.
- Les validations automatisées utilisent seulement des Players fixtures UUID et des mois 2098, puis les nettoient. Les comptes DEV confirmés `Kichnifou`, `Mynonyme`, `MynonymeTest1`, `MynonymeTest2`, `MynonymeTest3`, `Céo`, `Mika` et `Jean Julien`, ainsi que leur Expedition réelle, n’ont été ni ciblés ni modifiés. `PAID_INFRA_APPROVED = false` reste inchangé ; aucun service payant ni déploiement Railway manuel ne fait partie du candidat.
- Le domaine actif reste Combat, centré sur le candidat Boss 0.91 final corrigé. Sa validation publique n’a pas encore eu lieu ; aucun domaine suivant n’est commencé. Après franchissement des gates publiques listées ci-dessous, le prochain domaine exact est **Concours / personnages C6**, selon [implementation-order-v1.md](../roadmap/implementation-order-v1.md).

## État public 0.93 — stabilisation Concours et alignement Activités

- La stabilisation 0.93 est déployée et nettement améliorée publiquement : le nouveau parcours multi-compte n’a montré aucun `P2028`, aucun 5xx et aucun redémarrage serveur. Le lobby global, le rôle spectateur, le soutien et une partie complète sont jouables ; quelques finitions de réactivité et de présentation restent regroupées dans 0.94.
- Le candidat 0.93 est exclusivement un lot correctif. La réconciliation Concours devient mono-vol dans un processus, préfiltre les transitions dues par une lecture légère, tente le verrou inter-processus puis revalide sous verrou avant mutation. Le scheduler attend chaque exécution, gère localement ses erreurs transitoires, repart sur un délai maîtrisé et s’arrête avant la déconnexion Prisma. Les mutations ne patientent plus derrière un rattrapage complet et les projections live n’embarquent plus systématiquement événements, récompenses et dernier résultat historique.
- Le frontend stabilise les callbacks de préférences de navigation, déduplique les lectures Concours simultanées, sépare lecture et mutation par révision et applique un polling séquentiel avec pause cachée, reprise visible et backoff borné. Toute mutation Concours possède un état pending immédiat, une garde synchrone contre le double clic et conserve sa clé d’idempotence après un résultat réseau ambigu.
- Le layout Activités restaure des headers naturels et des bodies `minmax(0, 1fr)`. Concours réserve quatre slots de lobby, dix emplacements spectateurs et une zone d’action stable ; Mes Légendes affiche trois entrées par page après filtre/tri personnel et l’Historique dix résultats par page. Le Bilan Boss garde ses trois onglets dans une enveloppe compacte stable et les huit cartes Quotidiennes partagent une hauteur desktop de 136 px.
- Aucune règle R526–R593, formule, récompense, donnée, migration ou schéma n’est modifié. Les validations PostgreSQL et le parcours navigateur multi-session restent conditionnés à une base réellement isolée ; ils ne doivent jamais être improvisés sur les données DEV réelles.
- Le domaine actif reste **Concours / personnages C6**. La stabilité runtime 0.93 est acquise sur le parcours public observé et ne doit pas être reconstruite ; les dernières corrections player-facing appartiennent au candidat 0.94 ci-dessous.

## État public 0.94 — réactivité et feedback du Concours

- L’entrée réelle dans `Activités > Concours` revalide immédiatement la projection. Tant que l’écran est visible, le polling mono-vol reste à environ deux secondes avec un Concours actif et découvre aussi un lobby distant en environ trois secondes lorsqu’aucun Concours n’est actif ; onglet caché, focus et retour visible conservent les garde-fous 0.93.
- Une Stella réussie et chaque Pull x1/x10 réussi invalident puis rechargent une seule projection Concours fraîche via le coordinateur partagé. Une nouvelle possession 5★ C6 devient donc disponible sans rechargement manuel, que l’écran soit déjà ouvert ou visité ensuite.
- La projection live 0.94 ajoutait uniquement le dernier événement de score pertinent (`TURN_PLAYED`, `BOT_TURN_PLAYED`, `TURN_AUTO_BASIC` ou `SUPPORT_PLAYED`) par un `select` minimal limité à une ligne. Le frontend suivait son `eventId`, ignorait l’événement déjà présent au premier rendu et affichait une animation absolue `+0`/`+N` sur le slot bénéficiaire ; les tests publics multi-viewer ont ensuite montré que cette projection pouvait perdre un événement entre deux polls, corrigé en 0.95.
- Les portraits humains retombent sur la découverte standard par nom de Légende lorsqu’un snapshot explicite est vide ou invalide. Les quatre cartes gardent une hauteur fixe par breakpoint, y compris à 1366 × 768 avec portrait compact ; noms, scores et rangs restent accessibles et le body devient propriétaire du scroll si la hauteur manque. Les actions du lobby ne sont plus coupées, les dix slots spectateurs restent stables et `Retirer` possède sa colonne propre.
- Le statut `Boss actif` occupe le véritable coin supérieur droit de la carte desktop et `Res :` reste quasi collé à son icône. Aucun moteur Boss/Concours, formule, verrou, retry, schéma, migration, donnée réelle, service payant ou fichier `docs/Story/**` n’est modifié.
- Le parcours public Combat en défaite est désormais validé par le propriétaire : les quatre membres deviennent KO, leurs cartes sont assombries, le picker les désactive et l’indisponibilité de la nouvelle tentative est correcte. Le micro-correctif final conserve ce métier intact, simplifie le badge de formation en `💀 KO` et réserve `💀 KO · Disponible demain` au picker avec le même traitement rouge ; `Déjà sélectionné` reste neutre.
- Le feedback `Défi terminé !` conserve son auto-fermeture d’environ 5,4 secondes mais accepte désormais immédiatement un clic réel sur son backdrop ou `Escape`, sans modifier le verrou propre au feedback de montée de niveau et sans double appel de fin.
- La validation publique 0.94 confirme la détection dynamique d’un nouveau C6 et d’un lobby distant, les portraits humains, les noms et la géométrie principale du Concours, le Boss principal, Quotidiennes, le parcours Combat KO, la fermeture du feedback Défi terminé et la stabilité de performance issue de 0.93/0.94.
- La notification Expedition READY réelle est également validée publiquement : apparition dans le header, lecture au clic et deep-link vers la fiche du personnage revenu. La récupération et la récompense Expedition restent à valider publiquement.

## État du candidat 0.95 — interactions finales Concours, Notifications et picker Boss

- Notifications conserve sa logique autoritative et son deep-link Expedition, mais adopte une présentation bleu nuit lisible. Seules les entrées dont `actionKey` est non nul portent l’affordance cyan hover/focus et le curseur de navigation ; une entrée informationnelle reste lisible et peut être marquée lue sans simuler un lien.
- Le libellé visible devient `Spectateurs`. Pour l’organisateur, chaque pastille réserve une colonne fixe de 18 px à une croix accessible `×`, révélée au hover/focus et toujours disponible sur interface tactile ; le pseudo reste dans sa colonne avec ellipsis sans recouvrement.
- En RUNNING, la grande région d’action inférieure disparaît. Les actions Basic/Risque sont un overlay absolu sur la seule carte du participant autorisé et Soutenir apparaît sur chacune des quatre cartes, bots compris, pour le spectateur sélectionné. Un statut compact de hauteur stable dans le bandeau distingue jeu, soutien et attente ; mobile et clavier ne dépendent pas d’un hover inexistant.
- La projection live `recentScoreChanges` interroge au plus huit petits événements de score par `select` minimal, newest-first puis les restitue dans l’ordre chronologique. Chaque client amorce les identifiants présents, met tous les nouveaux événements en file séquentielle et conserve `+0`, bots et soutien pour l’acteur comme pour les autres viewers ; la première fenêtre fraîche après reprise d’un onglet caché devient un nouveau baseline.
- Le picker Boss réutilise désormais `BoxCharacterCard`, la grille et l’enveloppe du picker Entraînement : portraits, élément, rareté, constellation et état neutre `Déjà sélectionné` sont identiques. Un KO du Combat quotidien ne désactive toujours jamais un personnage contre le Boss.
- Aucun moteur de score, règle Concours/Boss, schéma, migration, donnée réelle, service payant ou fichier `docs/Story/**` n’est modifié. Le domaine actif reste **Concours / personnages C6**, candidat correctif 0.95. Après review indépendante, promotion, déploiements automatiques et validation publique du propriétaire, la prochaine étape reste **Collection / Sac à compléter**.

Le commit 0.95 `3e510307f49ffa389df902d35c83287ea0ebe96e` est désormais sur `main`, auto-déployé avec succès par Railway (`/health` HTTP 200). Les actions RUNNING sur cartes, le feedback `+N` cross-viewer et le picker Boss aligné sur Entraînement sont validés publiquement. La revalidation visuelle finale Notifications attend un retour Expedition naturel ; READY et son deep-link avaient déjà été validés.

## État du candidat 0.96 publié sur `review` — Collection / Sac et micro-corrections Concours

- Le domaine actif devient **Collection / Sac à compléter**. Les douze objets mensuels connus sont des définitions permanentes visibles à quantité zéro sans créer de possession ; `PlayerItem.quantity` reste le stock autoritatif.
- La migration additive 018 ajoute uniquement un ledger `ItemAcquisition`, sans backfill, et les douze définitions Collection. Le détail personnel est chargé à la demande et paginé ; il expose origine, méthode, première obtention connue et acquisitions réellement enregistrées.
- Concours projette le dernier résultat strictement moins de cinq minutes après son `finishedAt` serveur, sans supprimer l’historique ni bloquer un nouveau lobby. Un viewer ayant consommé sa participation voit le sélecteur et Participer désactivés avec une raison explicite, mais peut toujours devenir spectateur si le serveur l’autorise. Le scroll desktop n’apparaît que si le contenu déborde réellement.
- Le commit fonctionnel 0.96 `ea046f421a2199d3b4b7fee56dff3ade795233c6` et son checkpoint documentaire ont été approuvés, promus puis validés publiquement. Le résultat Concours reste visible cinq minutes, l’état `dailyUsed` conserve le lobby consultable avec participation désactivée, et le catalogue Collection, les quantités zéro, les compteurs et le détail ont été validés.
- R863 devient validé publiquement. R864 reste une garantie technique du ledger : aucune validation réelle d’acquisitions multiples produites par Event n’est revendiquée avant l’implémentation de ce domaine. Les images Collection restent volontairement reportées. Le retour naturel Expedition READY/notification/claim reste une validation publique ouverte.

## État public 0.97 — Codes cadeaux V1 et finalisation visuelle Concours

- Le domaine actif devient **Codes cadeaux**. La migration additive 019 crée les définitions, éditions, récompenses et claims privés, avec RLS active et droits navigateur révoqués. Elle publie les douze codes Festival annuels connus, chacun à +1 600 Primogemmes et +200 000 Moras, sans créer de claim ni crédit joueur.
- Le claim est serveur-authoritative, transactionnel et idempotent : unicité Player/édition, `BusinessOperation`, crédits par `PrismaEconomyService`, `ResourceMovement`, statistiques économiques et résolution de notification partagent la même transaction sérialisable. Une nouvelle édition annuelle est matérialisée au mois concerné et réactive sa propre notification.
- `#codes` expose l’écran personnel `Disponibles | Récupérés`, les récompenses exactes avant action et la synchronisation immédiate des ressources globales. La destination `Codes` rejoint le registre Menu près de Boutique/Banque sans modifier les sept tuiles principales. `OPEN_GIFT_CODE` ouvre cet écran.
- L’administration Codes est intégrée à Modération mais rendue et autorisée uniquement pour ADMIN : brouillon, token manuel ou généré, titre/description, ponctuel ou annuel, période, neuf ressources sûres, aperçu, publication explicite, modification contrôlée, désactivation/réactivation, compteurs et détail des claimants. Avant le premier claim, token, type, récurrence/période et récompenses restent modifiables selon R687 ; après le premier claim, identité/token/type/récompenses sont verrouillés et seuls les champs expressément autorisés par R687 restent éditables. Chaque mutation est auditée et idempotente.
- Concours recharge immédiatement à l’entrée et continue son polling même sans session active. Son bandeau RUNNING emploie trois zones stables, le spectateur lit exactement `En attente des joueurs...`, les confirmations expliquent les conséquences de Lancer/Quitter/Annuler/Retirer, et le footer est compact sans toucher aux boutons globaux. Le propriétaire du scroll desktop est le body fonctionnel ; le `screen-stage` ne crée plus une seconde scrollbar pour un écran long, tandis que mobile conserve son flux naturel.
- Le checkpoint 0.97 `b7438d276ab75e9ce89fba0a0b56481565842611` est promu sur `main` et déployé. La validation publique confirme la sidebar, l’accès Codes, les récompenses affichées et une récupération réelle. La récupération Expedition réelle a également réussi, mais sa notification a révélé une présentation erronée : le header assimilait par défaut un type non-Boss à une Expédition. Les défauts de confirmations/scroll Concours et de latence/présentation Admin Codes restent ouverts dans cet état public et motivent le correctif 0.98.

## État public 0.98 clôturé — déployé et validé publiquement

- Le header résout désormais explicitement Expedition READY, Code cadeau disponible et Boss vaincu ; un type inconnu reste neutre et sans fausse navigation. Aucune notification existante n’est purgée ou réécrite.
- Les confirmations Concours sont liées au contexte autoritatif de leur ouverture et se ferment sans mutation à l’échéance ou lors d’un changement de partie, statut, phase, manche, tour, viewer, permission ou cible. Le bandeau conserve ses trois zones et affiche exactement `À votre tour !` lorsque `canPlay` est vrai. Le body `contest-scroll-body` est le propriétaire réel du scroll, les anciennes rangées fixes contradictoires sont retirées et aucun emplacement de feedback vide n’est réservé.
- Les surfaces touchées partagent une primitive de bouton sombre à variantes explicites. Modération sépare `Système de jeu` et `Codes`, garde le sélecteur Player dans le seul premier onglet et expose Bannières, Événements et Communauté uniquement comme repères désactivés. Codes reste strictement ADMIN/Super.
- Création Codes et Liste sont séparées. La liste vit dans une modale bornée, conserve son état lorsqu’une fiche Modifier ou Récupérations est ouverte, et applique côté serveur recherche, filtres, tri et pagination de vingt. Les récupérations sont elles aussi filtrées et paginées par vingt sans projection privée inutile.
- Publication, désactivation et réactivation ne bloquent plus sur une diffusion à tous les Players ni sur le rechargement intégral du catalogue. La transaction cible le code, la désactivation résout en groupe ses notifications, l’édition annuelle concernée seule est matérialisée, puis le scheduler séquentiel et les lectures Player assurent le rattrapage. Les tests Codes bornent diffusion et matérialisation aux UUID exacts des fixtures et ne nettoient jamais par préfixe.
- Le commit fonctionnel 0.98 `6d9eaf27d963fde0aac0ca7644d3d2290aab58b7` stabilise l’UX Concours et l’administration Codes.
- Le correctif de review `7e1d65737d1d9c0584279fa4032a73b4144be9a1` retire les anciennes peintures parentales des boutons partagés et remplace le verrou `FOR KEY SHARE` par le verrou minimal suffisant `FOR SHARE` sur les définitions publiées. La cascade `AppButton`, la sérialisation réconciliation/désactivation et leurs tests déterministes sont revalidés.
- Le polish `3d39a5008da706c3683f048c7921ef27d2f0f8f5` ajoute aux Notifications une croix d’archivage individuelle distincte de la surface principale, visible au survol/focus et directement disponible sur tactile. Une entrée READ reste visible pendant la journée puis est archivée paresseusement au reset Europe/Paris ; une entrée UNREAD n’est jamais purgée pour son âge. La victoire Boss fournit à chaque participant récompensé un payload structuré dérivé de `MONTHLY_BOSS_REWARD` ; le header affiche le nom et les gains exacts, tout en conservant le fallback des anciennes notifications textuelles.
- La règle permanente de travail est désormais explicite dans `AGENTS.md`, le guide ChatGPT et le workflow : toute intervention Codex qui modifie les fichiers du projet doit contrôler, créer un commit normal et le pousser sur la branche permanente `review` dans la même intervention, sauf demande locale-only explicite. Les corrections issues d’une review restent des commits séparés ; aucun passage implicite sur `main` ni force-push n’est autorisé.
- La review indépendante ChatGPT du vrai diff GitHub des trois commits Développement 0.98 est terminée favorablement. Aucun bloqueur technique connu ne subsiste avant promotion.
- La validation locale du layout reste acquise : les cinq états RUNNING standards tiennent à 1774×864 sans scroll inutile (`425 / 425`) ; à 1366×768, les cartes longues conservent le scroll réel nécessaire (`329 / 403`, soit 74 px), avec bandeau sticky et footer accessible.
- Le commit Story `b097e0400eb3b60a46c100adb5775a8ff912f444` (`Update story source with v1.4 narrative foundations`) reste la base intacte du candidat, après `65169df5b10d17699520833b74bbd9366260347e`. Aucun fichier `docs/Story/**`, aucune migration 001–019, aucune donnée réelle, aucun compte DEV protégé et aucun service externe ne sont modifiés. `PAID_INFRA_APPROVED = false` reste inchangé.
- Le checkpoint documentaire `a0f0950510e847df6262513594442438349b6a4b` puis le polish `9766b4cb52b3543eb41db87f002409e9f7490958` restent dans l’historique utile. Le SHA public final 0.98 est `0e04b19b7ebda92370d4d08da064f37ef4b408f1` (`fix: harden character portrait fallbacks and portal scrollbars`) sur `main`. Son déploiement automatique Railway est `SUCCESS` et `/health` répond HTTP 200.
- Validation publique Notifications : types corrects, lecture, archivage individuel par ×, archivage global, suppression rapide et notification Boss structurée avec ses gains sont validés. Les mutations utilisent leur projection personnelle légère ; le GET reste responsable des réconciliations métier.
- Validation publique Concours : scrollbar fantôme supprimée, bandeau en trois zones, `À votre tour !`, confirmations contextuelles et fermeture automatique lorsqu’elles deviennent caduques sont validés. `Action de base` reste bleue, `Prendre un risque` est rouge, les portraits de personnages chargent sans grosse initiale Player/personnage de fallback.
- Validation publique navigation et Codes : Configuration reste en dernière position ; les vues joueur Disponibles/Récupérés, la récupération et son verrouillage sont validés. Modération/Codes valide les onglets, Création, Liste séparée, filtres, tri, pagination, récupérations, boutons et mutations accélérées.
- Validation publique UI transverse : les scrollbars sombres communes couvrent le shell et les modales React portalisées hors de `#root` ; le fallback neutre des personnages connus est validé. Le dernier spot-check portrait et scrollbar est favorable.
- Validation technique : le scheduler Codes reste limité à quatre réconciliations simultanées et aucun nouvel `EMAXCONNSESSION` n’a été observé au démarrage suivant.
- Le workflow permanent appliqué reste `modification Codex → tests → commit/push review → review GitHub ChatGPT → corrections éventuelles sur review → promotion main après approbation`.
- La version 0.98 est clôturée : elle est promue, déployée, saine et validée publiquement avec toutes les finitions demandées. Aucun correctif 0.98 n’attend encore review, promotion, déploiement ou validation.

## Event Lot 1 — Fondations clôturé, déployé et validé publiquement

- Les commits fonctionnels du lot sont `105aecce99453c3997d89604d67060d29bf17d5b` (`feat: establish monthly event foundations`), `849158854c2ae1fed532deb366fb964323257de6` (`fix: freeze event editions and period presentation`) et `03d9087e8939c5c93db4eb07c85943bb570c3364` (`fix: polish monthly event foundation UX`). Le checkpoint public actuel `6e615df44c6c0e652da4017b30dd021ea2606b3b` clôt cette validation ; le commit Story v1.5 intermédiaire reste intact et ne change pas le contenu fonctionnel Event.
- La migration additive `20260915120000_020_add_monthly_event_foundations` est appliquée sur Supabase DEV et suivie par Prisma. Elle matérialise exactement quatre tables Event Lot 1 — `event_definitions`, `event_editions`, `player_event_currency_balances` et `event_participants` — avec contraintes métier, index, RLS active et droits navigateur révoqués.
- Le seed déterministe contient exactement les douze Festivals fixes de janvier à décembre avec leur nom, monnaie, emoji et métadonnée Collection. Il ne crée aucune édition, participation, balance Player, acquisition ou donnée legacy ; après les tests à fixtures UUID et leur cleanup exact, les compteurs Player Event restent à zéro.
- `EventService` résout la date et les bornes de mois en `Europe/Paris`, récupère ou matérialise paresseusement l’édition annuelle unique et projette uniquement le Player authentifié. La monnaie saisonnière est portée par Player + définition stable : elle reste séparée des neuf `ResourceKey`, survit entre les années et ne peut pas être partagée avec un autre Festival.
- `GET /api/v1/me/event` reste consultable avant inscription. `POST /api/v1/me/event/join` exige une clé UUID, verrouille le Player et l’édition dans une transaction `SERIALIZABLE`, crée au plus une participation à zéro point et crédite exactement +1 monnaie lors de la seule première inscription. `BusinessOperation`, le verrou et les contraintes couvrent concurrence, idempotence, replay et double clic sans double crédit.
- La validation publique confirme le Festival des Récoltes réel du 1er au 30 septembre 2026, ses Jetons de Récolte 🌾, la Collection descriptive Gerbe de Récolte et sa consultation avant inscription. Le join volontaire crédite exactement +1 Jeton la première fois, initialise les points à 0, restaure le statut Inscrit et la balance saisonnière après reload ou retour écran, sans recrédit.
- `EventEdition.snapshot` est autoritatif pour l’identité et la configuration figées de l’édition ; `EventDefinition.id` reste l’identité durable de la balance saisonnière. La période technique semi-ouverte `[startsAt, endsAt[` est présentée au joueur jusqu’au dernier jour inclus.
- La validation visuelle publique confirme l’absence de chevauchement entre `ScreenHeader` et panneau grâce à leurs lignes structurelles distinctes, les onglets `Jeux | Shop | Classement` présents mais simplement désactivés, l’absence de badge futur ou de faux contenu, les cartes Points/Monnaie/Collection épurées et l’état « Événement rejoint » non interactif. Dans l’état Lot 1, le CTA Event des Quotidiennes est présent avant join puis absent après join, tandis que la carte conserve le Festival et le solde réels.
- Event Lot 1 est sur `main`, déployé automatiquement avec Railway `SUCCESS`, `/health` HTTP 200, et validé publiquement sur les plans fonctionnel et visuel. Il est **CLÔTURÉ — DÉPLOYÉ ET VALIDÉ PUBLIQUEMENT**. Restent hors de ce lot Jeu A/B/C, bonus quotidien, paliers, Boutique Event, conversions, acquisition Collection, Classement, Calendrier, notifications Event, commandes/chat/Twitch et migration legacy ; `PAID_INFRA_APPROVED = false` reste inchangé.
- Event Lot 2 construit son candidat au-dessus de cette fondation sans rouvrir la validation publique du Lot 1.

## Event Lot 2 — Jeu A fonctionnel, validations publiques effectuées

- Le moteur Jeu A est commun et data-driven pour les douze Festivals. Une configuration immutable versionnée en code associe la clé de Festival figée dans `EventEdition.snapshot` à son habillage Jeu A (`feu`, `coeur`, `pousse`, `oeuf`, `fleur`, `peche`, `etoile`, `expedition`, `recolte`, `fantome`, `feuille`, `cadeau`) ; aucune édition matérialisée ne relit une définition mutable pour changer de thème.
- La migration additive `20260915180000_021_add_event_game_a` est appliquée sur Supabase DEV et suivie par Prisma. Elle matérialise `event_daily_player_states` avec la clé `(event_edition_id, player_id, business_date)`, les champs communs prévus par 28.5 et `game_a_last_attempt_at` pour un cooldown atomiquement comparable. RLS est active et aucun droit direct `anon`/`authenticated` n’est accordé.
- Après inscription volontaire, l’état quotidien est matérialisé paresseusement sous verrou Player. Son `state` JSON versionné persiste exactement trois fenêtres personnelles de 60 minutes, générées à la minute près dans les plages `07:00–12:00`, `12:00–18:00` et `18:00–23:00` en `Europe/Paris`. Une même journée ne reroll jamais au GET ; le changement de business date produit naturellement un nouvel état.
- `POST /api/v1/me/event/game-a/attempt` reçoit seulement une clé d’idempotence UUID. Sous transaction `SERIALIZABLE`, verrou Player puis état quotidien, il refuse les non-inscrits, les bornes hors `[start, end[`, le cooldown serveur de trois secondes et les jours déjà réussis. Une tentative valide consomme un unique tirage serveur injectable à 20 % ; son replay `BusinessOperation` ne reroll ni ne réapplique les effets.
- Un échec incrémente les tentatives et pose le cooldown sans gain. La première réussite du jour incrémente atomiquement les tentatives, `game_a_success`, les points de la participation et la balance saisonnière de un, puis interdit toute nouvelle tentative Jeu A ce jour. Les futurs paliers pourront constater ces points, mais aucun palier ni récompense de seuil n’est payé dans ce lot.
- L’onglet `Jeux` affiche le thème, les trois fenêtres et leurs états temporels, les tentatives, le cooldown et la réussite ; `Shop` et `Classement` restent visibles et désactivés. La carte Quotidiennes conserve un accès avant inscription et après inscription tant que Jeu A reste à réussir, puis masque son CTA après la réussite du jour.
- Chaque projection Event expose `refreshAfterMs`, délai autoritatif calculé depuis le temps serveur jusqu’à la prochaine fin de cooldown, ouverture/fermeture de fenêtre ou remise à zéro `Europe/Paris`. `AppBootstrap` possède l’unique timer temporel Event, recharge le snapshot avec une petite marge et le republie pour Event comme pour Quotidiennes ; il remplace ou annule ce timer au changement de projection/session. `EventScreen` ne possède plus de timer cooldown concurrent et l’horloge murale du navigateur ne décide jamais de `canAttempt`.
- Le polish UI/UX public sépare désormais `Inscription | Jeux | Shop | Classement`, ouvre Inscription par défaut et place sous Jeux les trois identités thématiques data-driven du Festival, dont seule la première est active. La présentation commune porte aussi les douze singuliers de monnaie et les copies d’échec inspirées du legacy sans jargon Twitch. Le cooldown conserve l’autorité serveur et ajoute seulement un décompte monotone local `3/2/1`; les feedbacks réussite/échec et l’état neutre `Délai dépassé...` sont visuellement distincts.
- Quotidiennes s’appuie sur un agrégateur Event unique : le CTA n’apparaît que pour une inscription encore possible ou un Jeu A non réussi possédant une fenêtre active/future. Il disparaît après réussite ou expiration des trois fenêtres et réapparaît naturellement lorsque le snapshot autoritatif du lendemain est publié.
- Les fixtures DB sont exclusivement dédiées et nettoyées exactement. Aucun compte DEV protégé, donnée Story ou participation réelle n’a été modifié. Restent exclus : R602/bonus quotidien Event, Jeu B, Jeu C, paliers/récompenses, Boutique Event, acquisition Collection, Classement, Calendrier, notifications Event, chat/Twitch et migration legacy.
- Les commits Jeu A fonctionnels `a3d48716efd772bd854ec1ce199739aee31b39a8` et `970a0854852eefa158bc911ec5bca0e229f902d6`, puis le polish `6ea3f1fc0ab9007af25b218692c33aeb3fa9ccea` et le garde-fou navigation `d60d1e0f9105b294c68c767d561ac5b2284e4c8f`, sont sur `main` et déployés. Le propriétaire a effectué des validations publiques suffisantes pour poursuivre le Lot 3 ; le passage automatique FUTURE → ACTIVE sans F5 reste un spot-check différé, non déclaré observé. Le mini-polish visuel des fenêtres déjà réussies constitue le commit A séparé du candidat Lot 3 ; il ne modifie aucun état serveur.

## Event Lot 3 — Jeu B sur main, validation publique suffisante

- Le commit A `d1cf6b8` projette les trois fenêtres de Jeu A comme terminées après réussite quotidienne, sans changer les fenêtres ni leurs timestamps persistés. Le commit B porte exclusivement le Jeu B coopératif.
- La migration additive `20260916120000_022_add_event_game_b` est appliquée sur Supabase DEV et suivie par Prisma (checksum `49320ae9187eb13436b7e1624e1afab15b38c559b36f4cd187e16fb66818d3ec`). Elle matérialise seulement `event_game_b_daily_states` ; `event_daily_player_states.game_b_attempts_used` préexistait depuis 021. RLS est active, les droits directs `anon`/`authenticated` sont révoqués, et les fixtures de validation sont nettoyées.
- Une seule solution de cinq bits est créée paresseusement par édition et business date `Europe/Paris`, avec RNG serveur injectable. Les 32 codes sont projetés en testés/restants sans exposer le secret. Chaque inscrit dispose de trois essais consommables ; un code déjà testé globalement ne coûte rien. Les tentatives utilisent `BusinessOperation` et une transaction sérialisable avec verrou global avant verrou Player.
- La première découverte marque le Jeu B résolu et crédite atomiquement chaque participant inscrit de +1 point et +1 monnaie saisonnière, sans bonus économique du découvreur. Le join tardif du même jour ajoute ce rattrapage au bonus normal d'inscription, une seule fois. La route `POST /api/v1/me/event/game-b/attempt` accepte uniquement un code `^[01]{5}$` et une clé UUID.
- Sous `Jeux`, le deuxième sous-onglet thématique (Grenier en septembre) devient fonctionnel : 32 combinaisons lisibles, testées distinctes, essais restants, choix, résultat et découvreur. Jeu C reste désactivé. Quotidiennes conserve le CTA tant que Jeu A ou B offre une action réelle ; un refresh d'entrée, de focus/visibilité et un polling léger de 30 secondes sur la surface Jeux révèlent les résolutions d'autres Players sans Realtime.
- Correction de review frontend : l'intention ambiguë, la sélection et le feedback Jeu B sont invalidés à chaque changement de business date ou d'édition ; une nouvelle édition revient sur Inscription. Les GET Event d'entrée, de focus, de visibilité, de polling et de timer partagent une frontière de coordination ; un refresh plus récent, une mutation réussie ou un changement de session empêche une ancienne réponse de republier un snapshot obsolète. Aucun changement backend ou DB n'en résulte. La vérification visuelle navigateur aux quatre viewports demandés reste à réaliser tant qu'elle n'est pas effectivement observée.
- Les commits Jeu B `d1cf6b80f8486877957720f85b971d1233a8af15`, `b2b822368d00b424716afc383adf17191c19d614` et `5eff4c96a229f7d5e14cfb9d612114a1f3515222` sont sur `main`. Le propriétaire a validé publiquement le Jeu B suffisamment pour ouvrir le Lot 4 ; le polish de sa combinaison résolue appartient au commit A séparé du nouveau candidat. `PAID_INFRA_APPROVED = false` reste inchangé.

## Event Lot 4 — Jeu C / Panier sur main, validation publique suffisante

- Commit A `fix: clarify resolved event game b` : `resolvedCode` reste nul avant la résolution du Grenier, puis projette la combinaison gagnante sans fuite préalable ; elle est verte, bordée, cochée et non barrée, avec feedback collectif success. Aucun changement économique.
- Commit B `feat: implement monthly event game c` : Panier est le troisième archétype commun aux douze thèmes. La recherche bornée résout un Player ID autoritatif, exclut soi-même et applique le statut ACTIVE, les blocages dans les deux sens et la confidentialité MP Public/Amis/Privé via les primitives Social validées, sans blocage Event parallèle. Un destinataire non inscrit peut recevoir et consulter, sans envoyer. Un inscrit actif peut envoyer un seul message valide par business date, en transaction idempotente : +1 point et +1 monnaie à l'expéditeur seul. L'inbox privée filtre la date `Europe/Paris`, conserve les anciens messages en base et marque `viewed_at` uniquement lors de l'ouverture effective de Panier. L'agrégateur Quotidiennes expose `Accéder` tant qu'un message reste à consulter.
- Le gate physique Social a constaté l'absence de `friendships`, `player_blocks` et `privacy_settings`. La migration additive 023 matérialise uniquement ce sous-ensemble Social déjà validé et `event_social_messages`, avec RLS, révocation des accès directs, index FK et consultation persistante. Le réglage MP est Public par défaut, y compris pour les Players préexistants. Aucun système Social complet, écran de réglages, chat ni Twitch n'est ajouté. Migration 023 appliquée et suivie par Prisma sur Supabase DEV ; ne pas la réappliquer manuellement.
- Commit C `feat: aggregate event message notifications` : clarification propriétaire du 16/09/2026 — tant qu'au moins un message Event courant reste à consulter, une seule notification agrégée par destinataire et business date est active, jamais une notification par message. Les nouveaux messages mettent à jour le compteur ; Panier marque les messages consultés et résout l'agrégat ; un message ultérieur le réactive. READ seule n'est pas une consultation. La réconciliation NotificationService s'appuie sur `viewed_at IS NULL`, et l'action explicite `OPEN_EVENT_MESSAGES` ouvre Activités → Événement → Jeux → Panier. Le refresh Notifications existant suffit, sans Realtime ni polling additionnel.
- Le lot est sur `main` au checkpoint `1153b6ed20932b2ad61933a0a431042a06075ecc` et le propriétaire en a suffisamment validé publiquement Grenier résolu, Panier, destinataire non inscrit, agrégation Notification, deep-link, réactivation et Quotidiennes pour ouvrir le Lot 5. La recherche inline Panier et la latence de notification sont les deux polishes du candidat suivant ; elles ne rouvrent pas la logique métier Jeu C. Restent exclus Boutique Event, acquisition Collection, Classement, Calendrier, chat/Twitch, Social complet et migration legacy.

## Event Lot 5 — bonus quotidien et paliers sur main, validation publique suffisante

- Polish A `7dc4dc5` (`refactor: reuse player browser for event recipients`) : Panier réutilise la primitive de modale du sélecteur Modération, qui conserve ses filtres et son badge Testeur. Event utilise son propre endpoint Social, paginé à dix, recherche dès zéro ou un caractère, filtres Élément et tri Nom/Niveau ascendant/descendant ; sa projection n'expose que pseudo, niveau et élément. La règle durable reuse-first UI est dans `AGENTS.md` et le contrat UI.
- Polish B `1fc5ad6` (`fix: reduce notification refresh latency`) : le header charge uniquement `GET Notifications` toutes les trois secondes visibles, immédiatement au focus/retour visible et sans requêtes superposées. Le GET conserve les réconciliations serveur ; les snapshots UI Boss et Expédition ne sont plus rechargés par chaque tick. C'est le compromis alpha/V1 actuel sans Realtime/SSE/WebSocket.
- Lot métier C `feat: implement event daily bonus and milestones` : R602 réclame +1 monnaie saisonnière une fois par business date via `POST /api/v1/me/event/daily-bonus/claim`, la clé idempotente `event.daily-bonus.claim` et l'état physique existant `event_daily_player_states.daily_bonus_claimed`. Quotidiennes maintient son accès Event tant que ce bonus ou une autre action réelle reste disponible. Chat interne et Twitch ne sont pas implémentés.
- R614–R617 : les huit seuils 10–80 sont automatiques, sans bouton, et le score continue au-delà de 80. Les points Jeu A/B/C et rattrapage Jeu B au join passent par une attribution commune ; chaque palier manquant franchi crée une claim et une opération système uniques dans la transaction du gain de points. Les récompenses exactes restent celles de l'audit : particules aléatoires/personnelles avec fallback, monnaie saisonnière, Moras et Primogemmes. Les ressources standard passent par `PrismaEconomyService` et la projection Event republie les ressources globales.
- Le gate Supabase DEV en lecture seule juste avant migration constatait 6 participants, maximum 2 points et aucun à 10+. La migration additive `20260917120000_024_add_event_milestones` ne matérialise que `event_milestone_claims` avec PK édition/Player/palier, opération unique, contraintes, index FK, RLS et droits navigateur révoqués. Elle est appliquée et suivie par Prisma (`24` migrations à jour). Aucun backfill économique réel ni modification des migrations 001–023.
- La barre de progression et les huit repères restent en haut de l'écran Event sur ses sections actives ; le nombre de points réel, même supérieur à 80, reste visible. Le bouton bonus n'existe que si l'action est disponible et l'état réclamé ne simule pas de CTA. Le Lot 5 a été promu sur `main`, déployé et suffisamment validé publiquement par le propriétaire sur ses principaux parcours ; ses derniers défauts de finition ont ensuite été traités et validés dans le Lot 6. Aucun `docs/Story/**` n'est modifié ; `PAID_INFRA_APPROVED = false` demeure inchangé.

## Event Lot 6 — finitions, Boutique, Collection et Classement clôturés publiquement

- Commit A `061c43a` (`fix: polish event progression and daily completion`) : Quotidiennes réutilise exactement `eventHasActionableContentToday` pour afficher soit le CTA, soit `✅ Terminé` en vert ; Shop et Classement ne sont jamais des daily. Après inscription, Bonus quotidien précède le statut Participation. Les douze monnaies ont un singulier explicite partagé par les feedbacks et les libellés de palier ; la barre affiche « Votre progression » et son conteneur horizontal interdit le scroll vertical parasite.
- Commit B `ed288e9` (`feat: implement monthly event shop`) : Shop est consultable sans inscription ; acheter exige une participation. Une monnaie saisonnière vaut exactement 160 Primogemmes ou 20 000 Moras, par quantité entière positive avec MAX côté interface. La balance durable Player + définition de Festival est débitée sous verrou dans une transaction sérialisable et idempotente ; les crédits standard créent les `ResourceMovement` via le moteur économique commun et sont republiés dans la sidebar. La carte Collection coûte 80 monnaies pour un exemplaire réel : `PlayerItem.quantity`, `ItemAcquisition` et le garde annuel `EventCollectionAcquisition` sont écrits atomiquement. Le Sac recharge son inventaire autoritatif après acquisition, sans F5. La migration additive 025 ne crée que la garde annuelle, avec RLS, droits directs révoqués, FK et index ; elle est appliquée et suivie par Prisma sur DEV, sans backfill ni modification des migrations 001–024.
- Commit C `0dbfa09` (`feat: implement monthly event ranking`) : le Classement public de l'édition active lit les points `EventParticipant`, limite à dix et trie points décroissants, puis inscription et ID croissants en cas d'égalité. Un endpoint léger dédié est rafraîchi environ toutes les trois secondes uniquement pendant l'affichage visible du Classement, immédiatement au focus/retour visible et sans requêtes superposées ; il ne poll pas le snapshot Event complet. Le rang reste honorifique sans versement, claim ou notification.
- Consolidation `68febb6` : l'intention Shop (cible, quantité, UUID) survit aux changements d'onglet dans `EventScreen`, bloque synchroniquement le double clic, reprend le même retry ambigu et se réinitialise au changement de Player ou d'édition ; feedback exact en `BigInt` et libellé Collection neutre. Consolidation `4707a87` : curseurs d'actions ciblés et scénario d'historique Boss réparé sur le bouton accessible `Fermer`, sans exclusion de test. Le commit Story `1a0fca5` est conservé comme travail narratif parallèle et ne relève pas du domaine Event.
- Micro-polish `4ac7ee1` : géométrie MAX et grille adaptative ; feedback de conversion vert détaillant ressource reçue et monnaie dépensée, avec singulier/pluriel Event et calcul exact en `BigInt`. Ce commit est sur `main`, déployé automatiquement et validé publiquement par le propriétaire ; Railway l'a déployé en `SUCCESS`.
- Les quatre sections Inscription, Jeux, Shop et Classement sont réelles ; aucune section factice ne reste. Le propriétaire a validé publiquement Quotidiennes `✅ Terminé`, l'ordre Bonus/Participation, la progression, les conversions et MAX, le feedback Shop, Collection, le Classement, le curseur Boss `Bilan →` et le responsive observé : le Lot 6 et les Lots 1 à 5 sont clôturés. Le domaine Event reste actif pour les cas spéciaux de décembre / Noël déjà décidés ; l'historique transversal R633/R634 relève du futur Historique global, tandis que chat, Twitch, Realtime et migration legacy restent dans leurs domaines futurs. Aucun `docs/Story/**` n'est modifié par ce checkpoint.

## État déployé 0.92 — Concours / C6 et densité Boss

- Le propriétaire a validé publiquement en 0.91 l’affichage général du Boss, une attaque réelle et son quota quotidien, ainsi que l’état Expedition RUNNING dans Quotidiennes. Restent à tester publiquement Expedition READY/notification/claim, Combat défaite/KO, Boss vaincu/notification, rollover/historique Boss réel et tout le vertical Concours.
- L’écran Boss conserve strictement le moteur 0.91 mais devient compact : mois et `Bilan →`, identité/statut/résistance iconique, PV remontés, barre d’attaque en trois régions et formation `Votre formation`. Contribution, statistiques lifetime et historique paginé vivent dans une seule modale Bilan à trois onglets ; tant que le Boss vit, Contribution affiche aussi rang, dégâts, attaques, meilleur coup et part personnelle des PV max avec le Top 3. Les cartes joueur et la fiche Box sont partagées avec Entraînement ; aucun Auto Boss ni interaction avec les KO quotidiens n’est ajouté.
- Quotidiennes liste désormais huit cartes dans l’ordre Récompense, Roue, Défi, Combat, Boss, Expédition, Amitié, Événement. Combat ne porte plus d’état Boss. La carte Boss projette `AVAILABLE`, `USED` ou `DEFEATED` et deep-link vers le bon onglet sans claim ni faux `Obtenu`. Les formulations temporelles redondantes sont retirées uniquement de l’Aperçu Quotidiennes.
- Le domaine `Activités > Concours` matérialise R526–R593 : thème journalier global Europe/Paris, lobby public unique expirant après dix minutes d’inactivité des participants, quatre slots avec bots de remplissage, Ready individuel, snapshot au lancement, ordre mélangé, actions Basic/Risque, IA serveur, tours de 60 s, remplacement au troisième timeout, spectateurs actifs, soutien de 30 s et victoire immédiate à 50 points. GET, polling, retry idempotent et membership spectateur ne prolongent pas le lobby.
- La participation quotidienne n’est consommée qu’au lancement. Départs, transfert d’organisateur, annulations/refunds, zéro humain, concurrence et reprises sont arbitrés côté serveur sous verrou transactionnel. Le classement global conserve les bots ; seuls les humains encore présents reçoivent 800/400/200/0 selon leur rang exact, puis statistiques et titres thématiques aux seuils 1/3/7/15.
- `Mes Légendes`, le dernier résultat et l’historique public FINISHED paginé à dix avec détail sont réels. Les pickers personnels affichent la statistique exacte du thème `/20` et se calent sur la sélection persistée ; résultat et détail exposent les promotions de titre durables ainsi que classement, scores, récompenses et événements métier interprétés. Les statistiques exactes `/20` restent personnelles ; l’écran public n’expose que les snapshots utiles au match. Le polling actif est complété par focus/retour visible sans Realtime. Aucun Social, Realtime, chat, Twitch, présence passive, migration legacy ou image générée n’est commencé.
- La migration additive `20260913170000_017_add_contests` étend la table C6 existante avec compteurs/titres initialisés à zéro et crée uniquement thèmes, concours, participants, spectateurs, consommations quotidiennes, retraits lobby, événements et récompenses. Les cinq statistiques existantes sont conservées. RLS est active, les accès `anon`/`authenticated` sont révoqués et Prisma suit 17 migrations à jour.
- Les tests DB utilisent uniquement des Players UUID, des dates dédiées 2097/2098 et un cleanup exact. Les huit comptes DEV confirmés, l’attaque/PV/états/statistiques du Boss réel de septembre 2026 et l’Expedition réelle restent intacts. `PAID_INFRA_APPROVED = false` demeure inchangé ; aucun service payant ni déploiement Railway manuel n’appartient au candidat.
- Le domaine 0.92 est déployé, mais sa validation publique Concours est bloquée par l’incident de disponibilité et les défauts UI traités dans le candidat correctif 0.93. **Collection / Sac à compléter** reste conditionnée à la validation publique de cette stabilisation.

## État du lot — Invocation x1/x10

Le vertical slice Pull réel est physiquement implémenté. Le **target design** (`docs/architecture/postgresql-schema-v1.md`, `docs/specifications/v1-data-model.md`) et les audits 06/07/15 restent les autorités de conception ; ce Master porte l'état vivant.

État physique après implémentation locale du lot :

- migration additive `005_add_gacha_pull` versionnée et appliquée sur Supabase DEV ;
- `player_characters` porte la possession unique `(player_id, character_id)`, copies, constellation et date de première obtention immuable ;
- `c6_competition_progress` porte uniquement la progression minimale des cinq statistiques C6, sans dupliquer le catalogue `Character` ni implémenter le gameplay Concours ;
- `pull_operations` et `pull_results` alimentent désormais l’Historique authentifié, paginé côté serveur par 10 résultats et newest-first résultat par résultat : opérations les plus récentes d’abord, puis `resultIndex` décroissant au sein d’un x10 ; chaque résultat reste une ligne persistée distincte et le tri possède des clés stables ;
- RLS active et droits `anon`/`authenticated` révoqués sur ces quatre tables privées ;
- API, moteur de domaine déterministe, services Prisma et présentation frontend raccordés ; `GET /api/v1/gacha/history?page=1` ne lit que le Player authentifié courant et dérive la Pity affichée depuis `stateBefore + 1` ;
- la bannière, l’attente immersive, l’intro colorée selon la meilleure rareté, les révélations manuelles et le récapitulatif x10 se remplacent dans le même cadre Invocation stable, sans résultat ajouté sous la bannière ;
- `Date` et `Changer` restent côte à côte dans les métadonnées du hero ; `Détail` occupe exactement la largeur de la première colonne définie par `Date`, directement sous elle, sans dépasser sous `Changer`, et ouvre dans ce cadre une modale à onglets Historique / Probabilités / Passifs ; sa typographie reste lisible et l’Historique textuel affiche `Date` avec date et heure, `Événement`, et la Pity 5★ sous sa valeur numérique seule ;
- toutes les surfaces Gacha player-facing normales utilisent une règle unique de progression : première obtention = `Nouveau`, sinon constellation résultante `C1`…`C6`, bornée à `C6`. Elles n’affichent ni `Nouveau · C0` ni `Copie X` ; `copies` demeure une donnée métier disponible pour la logique, les statistiques et les vues explicitement dédiées ;
- les révélations individuelles de personnage utilisent une scène splash réellement full-bleed à opacité normale, sans doublon flouté ni panneau d’information ; seuls le badge doré `Nouveau` ou `C1`…`C6`, le nom et les étoiles restent en bas à droite pendant une phase Focus de 2 secondes. Compteur, hint et `Passer`/croix apparaissent ensuite en overlay sans réduire le splash, et les interactions de progression sont verrouillées pendant Focus. Le 5★ conserve sa présence dorée et son suspense séparé de 1,4 seconde avant l’apparition. Le récapitulatif x10 conserve les portraits/icônes et affiche aussi, lorsqu’ils existent, les bonus persistés comme `+80 Primogemmes` ;
- le Pull reste persisté immédiatement et autoritairement côté serveur, mais son état Resources/Gacha post-Pull est conservé dans un buffer frontend temporaire tant que la présentation volontaire reste active. Après confirmation réussie du POST, la sidebar affiche uniquement `primogemsAvant - primogemCost` depuis le snapshot pré-Pull et le coût autoritatif : Pity, Garantie, Capture, Moras, Particules, remboursements et autres gains restent figés. La fermeture du x1 ou l’ouverture du récapitulatif x10, y compris via `Passer`, publie ensuite l’état final complet ;
- quitter Invocation abandonne la présentation : si la réponse est prête, son état est publié immédiatement ; si elle est encore en cours, la requête et son intention idempotente restent protégées au-dessus de l’écran, puis l’état est publié à son arrivée sans replay ni navigation forcée. Un retour sur Invocation avant la réponse ne permet ni second Pull ni changement de cible. Lors d’un logout, la présentation visible est détachée mais un registre frontend éphémère conserve par `userId` la seule connaissance d’une requête réellement en vol : le même joueur reconnecté dans la même vie de page retrouve le verrou jusqu’à résolution, tandis qu’un autre joueur n’est jamais bloqué et ne reçoit aucune publication tardive. Si la requête s’est terminée pendant l’absence, le bootstrap recharge l’état serveur sans replay. Ce verrou mémoire ne survit volontairement ni au F5, ni à la fermeture du navigateur, ni au changement d’appareil ;
- toute la surface libre du cadre permet d’avancer pendant un x10 ou de fermer un résultat x1 et le récapitulatif, sans propagation depuis les vrais contrôles ; les textes player-facing restent immersifs et n’exposent aucun vocabulaire serveur, backend, API, sauvegarde ou idempotence ;
- les passifs Team sont documentés dans la modale et réellement appliqués par le serveur. Chaque `PullResult.snapshot` conserve le snapshot de Team et ses `passiveEffects` machine-readable ; l'API et le retry relisent ces effets, tandis que l'UI les présente uniquement en phase Ready et dans le récapitulatif x10, jamais dans l'Historique et jamais en les attribuant causalement à Hydro. L'onglet Passifs réutilise le snapshot `PlayerTeamsDto` déjà chargé pour mettre en évidence le seul niveau I ou II réellement actif de chaque élément ;
- la primitive centrale XP met à jour XP, `lastXpAt`, tous les niveaux traversés, les récompenses et l'overflow niveau 100 dans la transaction appelante. La source Cryo ne modifie jamais `totalMessages`, `countedMessages` ni `lastXpMessageAt` ;
- le refresh Progression rejoint Resources/Gacha après un Pull, mais son snapshot final reste bufferisé pendant Focus/reveal et n'est publié qu'au disclosure existant, comme les ressources, la Pity et les autres bonus ;
- le candidat 0.74 présente le feedback global de montée de niveau dans une vraie modale centrée avec backdrop sombre/flouté. Elle conserve un événement agrégé et sa ligne de récompenses, intercepte tous les clics, ne peut être fermée durant la première seconde, puis accepte un clic n'importe où ou `Escape`, et se ferme automatiquement après environ 5,4 secondes. Le `+N` et le glow Profil d'environ deux secondes ne commencent qu'après sa fermeture ; les événements restent séquentiels et Cryo/Gacha conserve le disclosure anti-spoil. Cette présentation est **IMPLÉMENTÉE TECHNIQUEMENT, À VALIDATION PUBLIQUE** ;
- Backlog durable — **Asset cleanup personnages** : recenser les personnages sans portrait/icon canonique et retrouver/renseigner leurs vrais portraits afin d’éviter le fallback splash dans les composants compacts ;
- un crédit de test idempotent de +1 000 000 Primogemmes a été appliqué au seul Player ACTIVE `Kichnifou` via le moteur économique central, sous la clé `manual-test-credit:kichnifou:2026-09-06:1000000` et la cause `admin.manual-test-credit`, sans endpoint ni script permanent ;
- tests unitaires, API, frontend et DB couvrent les règles critiques, l’idempotence, la concurrence, le rollback, la state machine d’affichage, le mapping d’assets, l’Historique, sa pagination, son ordre et son isolation par Player.

La Team autoritative et ses sept passifs modifient désormais le moteur Pull dans une seule passe cohérente, transactionnelle, snapshotée et auditable. Ce fonctionnement est validé publiquement. Le candidat 0.74 réduit uniquement de 8 px à 6 px la typographie du remboursement C6 dans les cartes compactes x10, sans toucher aux autres libellés ni à la logique métier ; ce micro-polish reste à revalider.

Ordre de reprise après validation propriétaire : Pull réel validé → Box/possessions réelles → Team réelle → suite de `docs/roadmap/implementation-order-v1.md`.

## État du lot — Box / Possessions / Obtention

Box personnelle et sous-lot tri persistant/Stella déployés et publiquement testés ; micro-polish final intégré au candidat Team :

- source autoritative unique : `player_characters`, jointe au catalogue `characters` sans duplication de données ; aucune migration ajoutée ;
- `GET /api/v1/me/box` authentifié retourne uniquement les possessions du Player courant dont le personnage catalogue est actif, avec constellation bornée C0..C6, copies, première obtention immuable, favori et assets catalogue ; les possessions orphelines ou invisibles restent conservées en base mais ne sont pas exposées ;
- résumé dérivé sur les seules possessions visibles : total obtenu, 5★, 4★ et C6, sans compteur stocké ni total de copies affiché ;
- `PATCH /api/v1/me/box/:characterId/favorite` n’accepte que `{ favorite: boolean }`, refuse une possession absente ou inactive et ne permet aucune mutation de constellation, copies ou première obtention ;
- écran Box alimenté par l’API réelle à chaque ouverture, afin qu’un nouveau personnage ou doublon issu d’un Pull soit reflété sans seconde source globale ; aucun fallback vers `mockData` si la Box est vide ou indisponible ;
- cartes personnelles avec portrait/fallback canonique, nom, rareté, élément, C0..C6 et favori direct ; `copies` reste absent des cartes et apparaît uniquement dans la fiche détaillée avec la première obtention et l’état favori ;
- onglets temporaires `Tous` / `5★` / `4★`, recherche normalisée, sept filtres élémentaires incluant Dendro, filtres C0..C6 et tris alphabétique/date d’obtention/constellation/élément ascendant ou descendant ;
- favoris réordonnés immédiatement et de façon optimiste, avec rollback sur erreur : dans `Tous`, favoris 5★ puis favoris 4★ puis non-favoris 5★ puis non-favoris 4★ ; le tri actif s’applique à l’intérieur de chaque groupe ;
- loading, erreur avec retry, Box vide et aucun résultat de filtres possèdent des états dédiés ;
- validation publique propriétaire réussie pour le chargement des possessions réelles, le résumé, les cartes, les favoris et leur ordre, la recherche, les onglets, les filtres, les tris, le lien Invocation → Box, la fiche resserrée, l'identité élémentaire, le cache et les non-régressions ;
- la fiche conserve son dialog, son crop sûr et la priorité `iconPath`, avec une hauteur utile encore légèrement resserrée sans étirement ; le symbole asset de l'élément reste aligné à droite du nom, sans ligne texte ni badge sur le portrait ;
- un cache mémoire Box strictement associé au Player courant applique R771 : retour immédiat depuis le snapshot connu, GET autoritatif systématique à chaque ouverture, remplacement silencieux après succès, erreur inline sans masquer le cache, synchronisation après favori confirmé et protection du cache comme de l’UI contre une réponse de revalidation devenue stale après cette mutation, puis vidage avant sign-out ; aucun `localStorage` ni cache durable ;
- la typographie des noms de révélations individuelles Invocation conserve sa protection des descendantes (`g`, `p`, `q`, `y`, `j`) et rapproche uniquement les étoiles du nom ; cette correction reste une non-régression ciblée et ne rouvre pas le domaine Invocation ;
- la migration additive `006_add_box_preferences_and_items` est versionnée et appliquée uniquement sur Supabase DEV : `player_preferences`, `item_definitions` et `player_items` sont privées, RLS activée, sans policy client ; la définition canonique active `masterless-stella-fortuna` est seedée une seule fois et aucun solde joueur n’est créé automatiquement ;
- le tri Box persiste côté serveur uniquement `{ sortKey, direction }` sous la préférence `box.sort`, avec fallback alphabétique ascendant ; onglet, recherche, élément et constellation restent temporaires et reviennent à leur état neutre à chaque ouverture ;
- `GET /api/v1/me/box` expose la préférence de tri et le solde Stella autoritatifs ; `PATCH /api/v1/me/box/preference` valide strictement les quatre tris et les deux directions ; aucun `localStorage` n’est source durable ;
- `POST /api/v1/me/box/:characterId/stella` consomme une Stella dans une transaction `SERIALIZABLE` idempotente : cible possédée, active et 5★ seulement, acquisition via le service central de possession, transition C6 et progression via le service partagé du Gacha, refus avant consommation si C6 totalement maxé, sans remboursement Primogemmes ni compensation Moras ;
- la fiche 5★ montre le solde, désactive l'action à zéro et exige une confirmation unique détaillant constellation/copies ; le succès met immédiatement à jour fiche, grille et cache, puis déclenche une revalidation autoritative protégée contre les réponses obsolètes ; les 4★ ne proposent aucune action Stella ; l'intention frontend est éphémère, isolée par Player et conserve sa même clé d'idempotence après une erreur réseau/serveur ambiguë, y compris après un aller-retour hors de la Box dans la même vie d'application, tandis qu'un succès ou une erreur définitive la libère ; l'affichage Stella à zéro est publiquement validé, tandis que la consommation runtime et les cas C5→C6/C6+ seront revalidés avec le domaine Concours/C6, sans crédit de test dans ce lot ;
- Box publique/confidentialité dépend de Profil/Social, Box + Expedition dépend du domaine Expedition et les assets manquants restent au backlog transverse. Ces dépendances ne rouvrent pas la Box personnelle, désormais clôturée comme checkpoint fonctionnel.

## État du lot — Team / Équipe / Passifs

Premier lot Team réel déployé et validé publiquement ; Team Management et son raccord Gacha 0.71 sont déployés, et les comportements métier critiques des sept passifs sont validés publiquement. Le panneau Team à quatre passifs, l’Historique sans feedback passif et sa pagination, le feedback C6 individuel ainsi que la mise en évidence fonctionnelle du Niveau I/II actif sont eux aussi validés publiquement. Le candidat correctif final reste local sur `review` :

- migration additive `007_add_teams` : tables privées `teams` et `team_members`, identifiants techniques UUID, position Team unique par Player, index unique partiel garantissant au plus une Team active, quatre positions de membre contraintes, personnage unique par Team, RLS activée et droits `anon`/`authenticated` révoqués ;
- backfill idempotent des 10 Teams de base pour les Players DEV existants et provisioning transactionnel paresseux au premier `GET /api/v1/me/teams` pour tout Player nouveau ou incomplet ; Team 1 devient active uniquement lorsqu'aucune Team active n'existe ;
- une Team vide, partielle ou complète peut être activée explicitement ; l'activation désactive l'ancienne sans toucher aux compositions ; créer ou éditer une composition ne déclenche aucune activation implicite ;
- API authentifiée : lecture des Teams, activation, ajout/remplacement direct d'un slot, retrait, vidage, renommage, création de la prochaine Team, suppression d'une Team supplémentaire et réordres complets des Teams ou des quatre slots ; chaque mutation relit l'état autoritatif et valide côté serveur la propriété, l'activité catalogue, les ensembles complets d'IDs, la position 1..4 et l'absence de doublon ;
- l'écran Team ne lit plus `mockData` : sélecteur alimenté par les possessions actives réelles, recherche contiguë normalisée accents/casse, filtre élémentaire, personnages déjà présents visibles mais désactivés, quatre slots ordonnés et actions persistantes ; les cartes occupées utilisent un portrait carré générique en `contain` immédiatement suivi de l'identité, sans crop destructeur ni bande vide structurelle. Les quatre wrappers gardent une largeur et une hauteur identiques en 1/4, 3/4 ou 4/4 ; une Team 0/4 conserve un gabarit proportionnel commun sans imposer de grande hauteur arbitraire. La surface entière d'un emplacement vide ouvre le sélecteur et `Ajouter` n'apparaît qu'au survol/focus ;
- la sidebar lit exactement la même Team active et affiche son numéro, son nom éventuel, 0..4 personnages, constellations réelles et emplacements vides ; son panneau entier est une surface accessible qui navigue vers l'écran Team, sans rendre les mini-cartes concurrentiellement interactives ;
- les passifs sont calculés par la primitive serveur partagée `deriveTeamPassives`, de 0 à 2 stacks par élément, y compris pour une Team partielle et plusieurs éléments simultanés ; aucune valeur de passif n'est persistée par Player. `TEAM_GACHA_PASSIVE_PARAMETERS` et `deriveActiveTeamGachaEffects` centralisent les paramètres exacts des sept effets sous une forme typée et pure ; le Pull consomme cette dérivation depuis un snapshot de la Team active ;
- le bouton intrinsèque et aligné à gauche `Voir les passifs` ouvre le référentiel des sept passifs dans une modale fermable par croix, backdrop ou Escape, sans allonger l'écran Team ; un à trois passifs conservent leur disposition compacte, exactement quatre utilisent une grille desktop 2×2, et le mobile revient à une colonne. Le panneau conserve `Aucun passif actif` lorsqu'aucun effet n'est dérivé. En hauteur desktop contrainte, la zone des passifs absorbe le compactage tandis que le bouton reste non compressible et entièrement contenu ;
- l'action `Fiche` réutilise le composant détaillé Box et la même couche d'état : favori, Stella, confirmation, retry et protections du cache restent uniques ; une Stella confirmée revalide la Box puis recharge l'état Team autoritatif afin de synchroniser fiche, composition et sidebar ;
- le nom facultatif d'une Team se modifie inline, accepte espaces et accents jusqu'à 20 caractères et revient au fallback `Équipe N` lorsqu'il est vide ;
- les Teams sont paginées horizontalement par tranches de dix. La création est strictement séquentielle, retry-safe à partir de la position attendue et sans activation implicite ; le chevron vers la tranche suivante n'existe que lorsque la tranche courante est complète, sauf pour la tranche initiale 1..10 ;
- seules les positions courantes 11+ peuvent être supprimées, jamais la Team active ; les Teams suivantes sont compactées en conservant leurs UUID. `isBaseSlot` reste une provenance historique et n'est jamais l'autorité de suppression ;
- les quatre personnages peuvent être permutés horizontalement, y compris vers un emplacement vide ; la cible affiche une bordure/glow renforcés, un léger voile/relief et `Échanger`, sans introduire d'insertion de personnage. Les Teams peuvent être réordonnées horizontalement : drop sur une carte = swap, drop entre deux cartes = insertion, maintien sur un chevron pendant environ 550 ms = navigation inter-tranches ; les cibles swap, insertion et slot restent visuellement distinctes. Une seule mutation Team peut être en vol à la fois ; un réordre affiche immédiatement un aperçu local éphémère attaché à son intention et, pour les slots, à l'UUID de la Team concernée, sans fuite vers une autre Team sélectionnée. Le succès adopte le snapshot serveur et l'échec revient à l'ordre précédent avec une erreur ; l'identité active reste attachée à l'UUID de la Team ;
- un personnage catalogue désactivé n'est ni sélectionnable ni exposé et ne contribue à aucun passif ; chaque lecture/mutation Team applique transactionnellement R185 pour le Player courant : la Team active perd uniquement ses slots concernés, une Team non active en position 1..10 est entièrement vidée, et une Team non active en position 11+ est supprimée avec compaction unique de l'ordre ; aucune réactivation ultérieure ne restaure un slot ou une Team ;
- aucun cache Team supplémentaire n'est introduit : le bootstrap garde le snapshot courant en mémoire et chaque lecture/mutation retourne immédiatement l'état autoritatif, sans bénéfice actuel justifiant une abstraction SWR concurrente à celle de la Box ;
- sur desktop standard, Team tient sans scroll vertical normal et les trois colonnes utilisent la hauteur disponible ; la sidebar conserve ses panneaux naturels et son dernier panneau Récompense quotidienne absorbe seul l'espace restant sans étirer son contenu. Le bouton crayon de 29 px reste centré sur le titre. À hauteur desktop contrainte, les quatre cartes passifs se compactent légèrement et le bouton `Voir les passifs` ne rétrécit pas, afin de rester entièrement dans son panneau. Mobile et petits viewports conservent leur scroll naturel, une hauteur raisonnable pour les slots vides et leurs contrôles de réorganisation de secours ;
- le Pull verrouille le Player, fige la seule Team active et ses personnages catalogue actifs pour toute l'opération, puis applique les sept passifs ensemble. Hydro agit avant le roll 5★ ; la récompense normale précède Cryo, Électro, Anémo puis Dendro. Les multiplicateurs Pyro/Géo utilisent des ratios entiers exacts et un floor déterministe ; Électro est plafonné au plus grand état pré-hard-pity. Chaque vœu d'un x10 possède ses tests propres sur le snapshot commun ;
- Cryo réutilise exclusivement la primitive XP centrale dans la transaction Gacha. Les gains et récompenses de niveaux/overflow, crédits Anémo/Dendro et états Électro sont idempotents avec l'opération. `PullResult.snapshot` conserve `activeTeam`, `passiveEffects`, bonus et état final ; un retry relit ces données sans aucun nouveau RNG ;
- l'UI affiche les effets réellement déclenchés seulement après Focus et dans le récapitulatif x10 ; l'Historique conserve sa progression traditionnelle sans feedback passif. Un reveal ressource et toute carte compacte centrent géométriquement le texte seul sur la carte, l'icône étant positionnée à gauche sans participer à cette mesure ; un reveal personnage conserve le bloc rattaché à droite sous son identité. Le récapitulatif compact déduplique les crédits Anémo et le bundle Dendro déjà représentés par leur feedback passif, tout en conservant les remboursements C6 et récompenses de niveau XP ; un proc Électro plafonné sans gain réel reste masqué. Une progression C6 de type statistique apparaît aussi au centre de la révélation individuelle uniquement en phase Ready, remontée au-dessus du hint et animée par un glow fixe sans déplacement, sans régresser son rendu x10 ; `prefers-reduced-motion` désactive cette animation. Hydro demeure un modificateur enregistré mais n'est jamais présenté comme cause d'un 5★. Dans Détail > Passifs, les sept titres restent textuels, sans asset décoratif, et la grille tient sans scrollbar desktop. Progression, ressources et Pity finales suivent le disclosure anti-spoil existant. Aucune migration supplémentaire n'a été nécessaire ;
- le libellé court player-facing de la monnaie d'Invocation est `Primos` dans l'interface normale et dans les descriptions destinées à l’UI servies par le backend ; les contrats techniques, clés API/JSON et champs de données conservent `primogems`.

## État du lot — Banque

Premier vertical Banque réel **DÉPLOYÉ ET VALIDÉ PUBLIQUEMENT POUR LE PARCOURS INITIAL ; DERNIER MICRO-POLISH 0.74 IMPLÉMENTÉ TECHNIQUEMENT ET EN ATTENTE DE REVIEW/REVALIDATION** :

- migration additive `008_add_banking` versionnée et appliquée uniquement sur Supabase DEV : `player_bank_accounts` porte le solde bancaire et la dernière date d'intérêt ; `bank_transactions` journalise dépôt, retrait et intérêt avec soldes résultants, opération métier et date métier ; les comptes DEV existants sont initialisés à zéro, la RLS est active et aucun accès direct `anon`/`authenticated` n'est accordé ;
- portefeuille Moras et Banque restent deux soldes autoritatifs distincts ; le patrimoine est dérivé par addition et aucune troisième ressource n'est créée ;
- dépôts et retraits, y compris `MAX` résolu dans la transaction serveur, sont atomiques, idempotents et sérialisés avec les autres mutations du Player ; une erreur réseau ambiguë conserve l'intention frontend et sa clé pour le même joueur/direction/montant, tandis que le backend lie cette clé au montant demandé et refuse tout payload différent. Les transferts produisent un mouvement de ressource auditable mais ne modifient jamais `totalMorasEarned` ni `totalMorasSpent` ;
- l'intérêt journalier vaut `floor(solde Banque × 3 / 100)`, est crédité directement en Banque, compose jour après jour et incrémente uniquement `totalMorasEarned`. Une journée à intérêt positif est protégée par l'unicité persistante Player/date ; une journée à intérêt nul avance seulement `lastInterestDate`, sans opération, transaction ni ligne d'historique `+0` ;
- le processus backend exécute une régularisation séquentielle des intérêts au démarrage puis planifie le prochain minuit Paris sans supposer des journées de 24 heures. Cette traversée ne déclenche le rattrapage Missions R301 que pour un Player auquel un intérêt strictement positif va réellement être crédité ; les redémarrages et traitements concurrents restent protégés par transaction, verrou Player, idempotence et contraintes DB ;
- API authentifiée personnelle : `GET /api/v1/me/bank`, `GET /api/v1/me/bank/history?page=N`, `POST /api/v1/me/bank/deposit` et `POST /api/v1/me/bank/withdraw`. L'historique personnel est newest-first, paginé côté serveur par dix opérations et sérialise tous les `bigint` en chaînes décimales ; aucune route ne permet de consulter la Banque d'un tiers ;
- le parcours initial — état zéro, dépôt/retrait normal, validations montant/solde, pending/double clic, intérêt estimé, patrimoine, sortie/réentrée et fonctionnement général — est **VALIDÉ PUBLIQUEMENT PAR LE PROPRIÉTAIRE** ;
- l'écran affiche au plus cinq opérations récentes sans scrollbar, puis une modale d'historique complet dont la hauteur épouse son tableau et son footer, sans espace artificiel même sous dix lignes. La modale reste bornée au viewport ; seule la table scrolle si nécessaire et la pagination demeure visible. Sur desktop, Transferts et Activité s'étirent ensemble jusqu'au bas disponible. Le résultat confirmé met immédiatement à jour écran, cache mémoire par Player et wallet sidebar, sans faux solde optimiste ni second GET ; une revalidation antérieure devenue stale ne peut écraser ce résultat ;
- `MAX` remplit désormais seulement l'input avec le solde affiché et ne crée aucune intention ni requête ; la confirmation web envoie ensuite la valeur numérique. Le support serveur `amount: "max"` demeure inchangé pour les futurs canaux chat/Twitch ;
- la sidebar continue d'afficher uniquement le portefeuille : toute la zone Moras est maintenant une surface bouton accessible menant à Banque, sans petit bouton débordant. Banque n'est pas ajoutée à la navigation principale ;
- le parcours Banque reste fonctionnellement validé publiquement ; seul le dernier micro-polish de hauteur de modale et de pagination est **À REVALIDATION PUBLIQUE** ;
- tests frontend, backend et DB réels couvrent les contrats, états, erreurs, cache/stale response, `MAX`, gros `bigint`, neutralité statistique, intérêt composé, catch-up, idempotence, concurrence et pagination.

## État du lot — Sac

Premier vertical Sac réel **TECHNIQUEMENT IMPLÉMENTÉ DANS LE CANDIDAT 0.74 ; EN ATTENTE DE REVIEW ET DE VALIDATION PUBLIQUE PROPRIÉTAIRE** :

- `GET /api/v1/me/inventory` est une lecture personnelle authentifiée qui agrège les neuf définitions de ressources, leurs soldes pour le Player courant, les définitions d'objets actives et les quantités `player_items` correspondantes. Tous les `bigint` sont sérialisés en chaînes décimales ; aucune mutation économique générique n'est ajoutée au Sac ;
- les structures initiales restent le socle ; la migration additive 018 matérialise le catalogue permanent de douze définitions Collection et un historique d’acquisition distinct du stock, sans aucun crédit de possession ni backfill joueur ;
- l'écran réel utilise uniquement `Tout`, `Ressources`, `Objets` et `Collection`. Les neuf ressources structurelles restent visibles à zéro ; `Tout` les agrège avec objets et collection ; le compteur de Collection mesure les définitions connues possédées ;
- les montants affichés viennent du snapshot Resources/Economy global déjà autoritatif dans `AppBootstrap`, et non d'un second wallet client. Les vœux possibles sont dérivés par `floor(Primos / 160)` ; toute la carte Moras est une surface accessible vers Banque avec `Accéder à la Banque` ;
- les mocks historiques du Sac et leurs types ont été supprimés. Recherche temps réel, insensible à la casse et aux accents, par sous-chaîne contiguë ; états vides dédiés pour Objets, Collection et recherche ;
- Masterless Stella Fortuna apparaît dans Objets avec sa quantité réelle. Son utilisation charge les 5★ réellement possédés via la Box, réutilise `BoxCharacterCard`, la fiche/confirmation finale existante, le même endpoint Stella et le même `StellaIntentCoordinator`. Un résultat confirmé synchronise les caches Sac et Box ainsi que la Team/sidebar ; un retry ambigu conserve la même intention ;
- le cache Sac est éphémère, isolé par Player et vidé avant logout. Une réouverture affiche immédiatement le snapshot connu puis revalide silencieusement ; une réponse commencée avant une Stella confirmée ou avant le changement de cycle ne peut écraser l'état plus récent ;
- la Collection montre les définitions actives connues, possédées puis non possédées, avec tri alphabétique dans chaque groupe, quantité visible y compris `× 1`, fiche détaillée et indication d'obtention si le catalogue la fournit. En l'absence de catalogue réel, elle affiche un état vide sans inventer de données ;
- contrôles automatisés frontend, backend et PostgreSQL réel couvrent API/Auth, isolation Player, gros `bigint`, ressources à zéro, définitions actives/inactives, cache/anti-stale/logout, catégories, recherche, navigation Banque, Collection et flux Stella. Les fixtures DB sont nettoyées ;
- inspection Chromium effectuée en 1920×1080, 2560×1440 et petit viewport : rail catégories desktop, densité, recherche, cartes et sélecteur Stella cohérents ; catégories et cartes restent utilisables sans overflow horizontal sur petit écran.

État du premier parcours frontend standalone :

- frontend Supabase Auth branché pour Login / Register et restauration de session ;
- onboarding du displayName relié aux routes backend existantes ;
- choix permanent de l’élément relié au backend avant l’entrée dans le jeu ;
- shell V0 conservé et alimenté avec le Player et les ressources réels du vertical slice ;
- Roue quotidienne accessible graphiquement, sans RNG client, avec rafraîchissement des soldes après le résultat serveur ;
- test manuel propriétaire complet : **VALIDÉ**, au checkpoint `27e3a96d64f77dd3e85f1c3f475c5296836e9ed2` ;
- connexion existante, inscription et confirmation e-mail : **VALIDÉ** ;
- onboarding pseudo et choix permanent de l’élément : **VALIDÉ** ;
- ressources réelles, premier spin Roue et solde actualisé : **VALIDÉ** ;
- reload/persistance, absence de second gain et logout/login : **VALIDÉ** ;
- Accueil : carte Roue compacte avec action rapide ; feedback de récompense fraîche éphémère, état historique au retour/reload ;
- futur écran Quotidiens : `WheelGraphic` réutilisable, même état backend et même spin quotidien ; écran non implémenté.

État du premier déploiement public Free-first :

- préparation Railway : **VALIDÉE** ; Docker Linux/Railway, variables runtime, arrêt propre et healthcheck : **VALIDÉS** ;
- backend Railway public : **DÉPLOYÉ ET ACTIF** ; projet `precious-nourishment`, service `GachaImpact`, environnement `production`, dépôt `Kichnifou/GachaImpact`, branche `main`, racine `/server` ;
- domaine backend : [https://gachaimpact-production.up.railway.app](https://gachaimpact-production.up.railway.app) ; `GET /health` retourne `{"status":"ok"}` ;
- frontend Cloudflare Pages : **DÉPLOYÉ ET ACTIF** ; dépôt/branche `main`, racine du dépôt, build `npm run build`, sortie `dist`, Node 24 et variables Vite de production configurés ;
- domaine frontend et premier lien alpha partageable : [https://gachaimpact.pages.dev](https://gachaimpact.pages.dev) ;
- CORS de production : `FRONTEND_ORIGIN` pointe vers l’origine Pages exacte ;
- Supabase Auth : Site URL et redirects de production configurés ; le redirect local `http://localhost:5173` reste autorisé ;
- test public sans frontend/backend local : **VALIDÉ** — connexion, Player réel, élément et ressources persistants, état quotidien de la Roue restauré, logout/login et chaîne Cloudflare → Railway → Supabase ;
- `PAID_INFRA_APPROVED = false` reste inchangé. Railway est actuellement en Trial Free (30 jours ou 5 USD de crédits) ; Railway Hobby n’est pas activé et aucune disponibilité 24/7 après expiration du Trial n’est garantie. Cloudflare Pages et Supabase restent sur leurs offres Free actuelles.

Pour la prochaine étape exacte, consulter le bloc **Point courant** au début du Master. Batch A, Batch B et le cycle MP sont historiques et validés publiquement ; le Calendrier de Noël naturel reste à observer en décembre. L'historique Event transversal, Twitch/chat et la migration legacy ne sont pas développés dans ce checkpoint documentaire.

L’ordre complet restant appartient à [implementation-order-v1.md](../roadmap/implementation-order-v1.md). La migration legacy reste reportée ; `PAID_INFRA_APPROVED = false` reste inchangé.

Le premier lot ne doit pas implémenter tous les domaines V1 d'un coup.

Codex doit lire :
- `AGENTS.md` ;
- `docs/master/PROJECT_MASTER_PLAN.md` ;
- `docs/process/implementation-workflow.md` ;
- `docs/roadmap/implementation-order-v1.md` ;
- `docs/legacy/06-gacha-invocation-audit.md` ;
- `docs/legacy/07-box-possession-obtention-audit.md` ;
- `docs/architecture/backend-architecture-v1.md` ;
- `docs/architecture/postgresql-schema-v1.md` ;
- `docs/specifications/v1-data-model.md` ;
- `server/prisma/schema.prisma`, les migrations, le code Gacha et les patterns Ressources/Daily/Roue réellement présents ;
- `src/api/types.ts`, `src/api/game-api.ts`, `src/components/BannerHero.tsx` et `src/screens/InvocationScreen.tsx`.

Aucune nouvelle règle produit ne doit être devinée pendant ce lot.

## Vérification legacy

La vérification exhaustive des sources legacy est désormais terminée.

Les 37 scripts et les 17 JSON ont tous un traitement documentaire explicite.

`monthly_events.json` est le seul fichier sans rôle métier actif : il est strictement vide, aucun producteur ou consommateur runtime n'a été trouvé, et il ne doit pas être migré ni servir à inventer une fonctionnalité V1.

Les audits spécialisés restent les propriétaires des décisions métier. Les sweeps finaux servent uniquement de garantie de couverture et de cohérence.
