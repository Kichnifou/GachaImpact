# R1064 — Autorité GLOBAL et progression unique Twitch/Web

La [décision R1064](../specifications/decisions-log.md) fait autorité métier ; ce document décrit son mécanisme. Le [Master](../master/PROJECT_MASTER_PLAN.md) porte l'état public réellement exécuté. Baseline : `716ebd5b4c19e1f0827b1f190a165c15804e4a23`, 67 migrations, CANARY 18, 43 historiques + Kichni_Test NATIVE. Aucun nouveau schéma ni nouvel import n'est nécessaire à R1064.

## Admission et preuves d'identité

Le webhook vérifie signature, subscription/broadcaster/receiver/callback et Shared Chat avant le propriétaire de commandes. Une enveloppe système ou portant le badge bot n'atteint aucun consumer de gameplay. L'auteur est exclusivement l'ID immuable Twitch ; login et displayName sont des libellés. `covers` lit autorité, target, identité, statut Player et résolution R1055 non terminée dans **un seul snapshot PostgreSQL**. Cela ferme une course réelle entre lecture de l'ancienne target et lecture de l'identité nouvellement créée.

Un ID sans target ni identité n'est couvert que sous GLOBAL effectif. Le provisioning prend identité→autorité SHARE, revalide dans la même transaction puis utilise le bootstrap commun : neuf ressources à zéro, XP initiale, Box vide, élément null et missions normales. Ni ancien pseudo, ni contenu JSON legacy ne rentre dans cette décision. Une target LEGACY/MIGRATION_PENDING, une identité contradictoire, un Player ARCHIVED/SUSPENDED ou une résolution R1055 en attente restent refusés.

Après OAuth vérifié, la liaison terminale crée/bind la target NATIVE dans la même transaction que TwitchIdentity/WebIdentity. Une target existante doit être compatible et conserve ses flags CANARY. Une nouvelle target ne promeut aucun profil importé non transféré. La création de target est auditée et idempotente. Les retries ne recréent ni Player ni économie.

Web-first conserve son Player ; un Web jetable rejoint le Player Twitch existant. Deux progressions significatives continuent par comparaison/choix R1055, sans addition. Le garde opérateur existant qui interdit d'archiver un Twitch NATIVE actif pendant l'autorité ON est conservé : OFF contrôlé et procédure R1055 si ce cas exige de garder le Web. Dépendances partagées non résolues : aucune clôture automatique.

Les 171 owner-discarded et deux quarantaines restent des preuves historiques non importées. Leur ancien pseudo n'est ni denylist ni autorisation de restauration. Un ID actuellement inconnu/non réservé commence à zéro. `reconcileExternalBannerVotes` R1061 ne rattache que les faits externes déjà prouvés par le même ID Twitch, avec sa clé unique et la politique de collision existante ; aucun vote par pseudo. La réconciliation sociale conserve son garde de progression effectivement importée : aucun ancien réseau ajouté au nouveau départ.

## Échos et idempotence

Le filtre natif précède provisioning, Giveaway, Faveur et activité/commandes. Une requête cohérente recherche l'ID sortant exact **ou** le même sender/channel/parent avec réponse SENDING/AMBIGUOUS et texte exact, éventuellement précédé de la mention d'un nom de parent/thread vérifié dans l'enveloppe. Aucun strip générique, blacklist du compte opérateur ou limite arbitraire des cent derniers receipts. Les commandes manuelles véritables de l'opérateur restent éligibles.

Cette requête unique ferme la course SENDING→SENT entre deux SELECT. Giveaway ferme la même fenêtre pour ses annonces RESERVED/AMBIGUOUS→SENT ; le fallback textuel exige toujours son credential sender. Gift recherche l'ID exact ou son texte incertain sur le broadcaster exact. Les issues incertaines ne sont jamais renvoyées aveuglément. Les anciens intents/réponses gelés restent inchangés ; nouveau message ID et redelivery restent distincts, sans nouvelle clé fondée sur le texte.

## Bascule et ordre de verrous

Ordre partagé : identités triées→autorité→verrous de domaine→Players triés→lignes métier. OAuth, canonicalisation opérateur et anciens owners de réparation suivent cet ordre ; les réparations ne sont pas exécutées par GLOBAL. Les transactions courtes du pilote prennent autorité SHARE avant receipt ; premières réservations et activité revalident l'autorité dans leur transaction. Les réservations réseau Giveaway/Gift passent également la barrière SHARE, sans garder de transaction pendant HTTP.

GLOBAL exige capacité serveur, opérateur ADMIN actif autorisé, ACK Streamer.bot et révision explicite. La transition tient autorité UPDATE ; ses lectures de readiness sont ReadCommitted **après** attente de la barrière pour voir les réservations commitées. Cohérence targets/identités, PENDING économique, receipts engagés, réponses PENDING/SENDING/AMBIGUOUS, Gift remote et Giveaway RESERVED/AMBIGUOUS bloquent la bascule sans changement de révision. La barrière sérialise les admissions/réservations, elle ne suspend pas les actions Web indépendantes ni les subscriptions spécialisées.

OFF ne supprime aucun Player/target/claim. La dernière décision non-OFF auditée fixe le périmètre proposé à la reprise. L'UI annonce explicitement GLOBAL ; CANARY reprend l'ensemble persisté sans le reconstruire. L'armement initial ne peut pas demander GLOBAL par défaut. Un échec Helix laisse le désir connu affiché, effectif OFF, et Désactiver accessible ; une autorité DB réellement illisible est signalée séparément. Faveur/Gift/Giveaway ne sont pas réinitialisés.

## Corrections après review indépendante du premier candidat

Le SHA publié `0b43bd44be88c7c648f0a1d66971b5c17f47c78f` a reçu CHANGES_REQUIRED : une activité engagée refusée après OFF pouvait être marquée PROCESSED par le chemin message ordinaire. Les deux refus, avant réservation et avant consommation après préparation, retournent désormais une suspension distincte d'une activité terminée sans réponse. Le receipt reste RECEIVED avec sa référence et bloque toujours le drainage. Deux tests PostgreSQL imposent ces fenêtres ; aucun receipt public n'est modifié pour cette correction.

Une campagne finale a également observé HTTP 500/P2034 après épuisement des retries du choix d'élément sous huit clients/pool3. Le propriétaire partagé des réglages élément/favori/tri utilise désormais ReadCommitted avec son verrou Player FOR UPDATE déjà existant ; la clé unique d'opération et les refus de fingerprint/Player restent inchangés. Ces réglages appartiennent à un seul Player ; les propriétaires économiques conservent leur isolation. Trois tests réels couvrent 32 joueurs concurrents, même intention simultanée/replay après modification UI et collision de clé entre deux Players avec rollback intégral du perdant.

Campagne finale corrigée `private-concurrency-final.log` : **47/47**, 67 migrations réelles, 289 requêtes/245 réponses, zéro erreur finale/perte/doublon, pool3 fermé et aucun verrou en attente. Moyenne 370 ms, P95 1 010 ms, P95 provisioning 111 ms local. La campagne échouée est conservée dans `private-activity-final.log` ; son échec de charge a laissé des requêtes en vol, ce qui a aussi invalidé le comptage d'envois du test Boss suivant. Les suites corrigées repassent entièrement, sans réduire la charge ni augmenter les timeouts.

Le timeout préexistant de pagination ChatPanel s'est reproduit lors du contrôle complet, même sans charge DB concurrente. Le test de fenêtre de 200 lignes contrôle désormais les timers de polling comme le cas voisin ; son assertion, son timeout et le composant produit restent identiques. Suite ChatPanel entière : 65/65. La cause exacte du délai React n'est pas prétendue démontrée par cette stabilisation du test.

## Réponse Boss

Le propriétaire d'attaque retourne les quatre lignes `BossAttackMember` enregistrées par l'opération, ordonnées par position : nom, élément et constellation exécutés. Le résolveur utilise ces snapshots pour le format legacy `DMG`, `grâce à sa team […]`, puis PV. Une modification/suppression de la Team actuelle ou une constellation ultérieure n'affecte pas le replay. Découpage entre membres complets, préfixe `⚔️ Boss (suite) :`, budget 450 Unicode mention comprise. Le propriétaire existant conserve dégâts, victoire, récompenses et idempotence ; aucun paiement supplémentaire ni modification d'archive.

## Preuves et limites de validation

Reproduction privée de la baseline sous 67 migrations réelles : Web-first lié mais non couvert/target absente ; écho mentionné non reconnu avant persistance d'ID. Scripts et logs privés sous `local-data/identity-resolutions/r1064-20261009/`, aucun appel de mutation publique.

Campagnes PostgreSQL : parcours GLOBAL/Web/Twitch/R1055, 44 canaries préservés, 173 nouveaux IDs avec pseudos source sans restauration, statuts/réservations refusés, premières actions natives et redelivery, OFF/restart/reprise, courses déterministes d'admission et de drainage, échos SENDING→SENT et Giveaway, Boss réel/victoire/quatre membres/replay, anciens owners de réparation. Les schémas privés appliquent les migrations réelles ; catalogues de référence seulement, aucune copie de joueur public. Les contrôles exacts PASS/FAIL et suites exécutées sont conservés au rapport du checkpoint, sans transformer une fixture en recette humaine.

Charge privée finale après les corrections de review : 44 acquis + 48 chatters neufs, huit clients, pool limité à trois ; 289 requêtes, 245 réponses, une erreur 429 récupérée par reprise ciblée. Zéro erreur HTTP/DB finale, perte/doublon ou verrou en attente ; moyenne 370 ms, P95 1 010 ms, P95 provisioning 111 ms. Ces valeurs locales ne mesurent pas Railway. Pool fermé à la fin. Comparaison du graphe économique des 44 fixtures inchangée ; conservation des vrais 44 à vérifier séparément au postflight public.

`verify:full` 8/8 : 1 381 tests frontend et 2 115 backend non-DB, builds/types/lint/diff-check. Contrôle visuel local du GameShell et CSS réels : douze états (GLOBAL/OFF/dégradé) sur 1920×1080, 1366×768, 2560×1440 et 390×844 ; boutons dans le viewport après défilement, reprise explicitement GLOBAL, OFF accessible en dégradé, aucune erreur JS/requête externe. Captures réellement inspectées ; fixture synthétique, aucune session publique authentifiée. Les avertissements pg de requêtes concurrentes sur une transaction et lint préexistants restent distincts des échecs.

Review finale du SHA GitHub cumulé, déploiements exacts, capacité GLOBAL, activation, preuve process authentifiée et recette des volontaires : **gates encore à acquérir au stade candidat**. R1057 ne commence pas avant stabilisation suffisante de GLOBAL.

Contrôles finaux du candidat : 17 tests de `twitch-global` PASS dans `private-global-green.log` (dont première invocation réelle/résultat conservé et redelivery sans double gain), Prisma validate PASS, `verify-full-quiet-final.log` 8/8. Campagnes complémentaires des owners : compte/identité, fondations migrées, pilote/échos, reprise CANARY, Giveaway, Gift, Boss, banner replacement, compléments Event/social et recovery domains. Deux campagnes élargies ont été complétées par les reprises ciblées nécessaires : assertion ancienne de 66 migrations corrigée à 67 ; fixture de tirage corrigée pour utiliser le coût unitaire et accepter le résultat ressource normal. Un timeout du test ChatPanel préexistant pendant les charges simultanées a disparu lors de la vérification finale sans charge DB concurrente. Aucun test produit retiré ni timeout augmenté ; logs d'échec conservés.

Contrôle complet du correctif : `verify-full-corrected-green.log` **8/8 PASS**, 1 381 tests frontend et 2 115 serveur ; builds, types, lint et diff-check PASS. Les journaux antérieurs échoués restent conservés.
