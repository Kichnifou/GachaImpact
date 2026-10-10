# Rôle de ce document

Ce document est la source de vérité du déroulement opérationnel d’un lot de développement GachaImpact, de sa conception jusqu’à sa validation publique et à son checkpoint Git. Le propriétaire, ChatGPT et Codex doivent le lire lorsqu’ils préparent, implémentent, reviewent ou valident un lot.

Il possède la méthode de travail et la répartition des responsabilités entre ces étapes. Il n’est ni un tracker d’avancement, ni une roadmap, ni un journal de décisions produit, ni un remplacement du Master.

Documents liés :

- [Guide opératoire ChatGPT](../../.chatgpt/CHATGPT_GUIDE.md) : reprise d’une conversation et règles propres à ChatGPT ;
- [Conversation handoff](conversation-handoff.md) : procédure de fermeture/reprise lors d'un changement de conversation ChatGPT ;
- [AGENTS.md](../../AGENTS.md) : garde-fous permanents applicables aux agents ;
- [Master](../master/PROJECT_MASTER_PLAN.md) : état global vivant, domaine actif et prochaine étape exacte ;
- [Ordre d’implémentation V1](../roadmap/implementation-order-v1.md) : séquence de développement prévue ;
- [Journal des décisions](../specifications/decisions-log.md) : décisions produit et techniques durables ;
- [Déploiement Free-first](../deployment/free-first-v1.md) : particularités Railway, Cloudflare Pages et validation de l’alpha publique.

Les règles produit restent dans les documents spécialisés et le journal des décisions. L’état courant reste dans le Master. Les commandes, valeurs et contrôles propres au déploiement restent dans le document de déploiement.

## Cycle permanent review → main — décision propriétaire du 10/10/2026

Toute mission de développement autorisée accomplit par défaut **développement → tests → publication review → review → main → déploiements → postflight**, dans une seule mission. Cette décision étend les méthodes du 07/10 et du 09/10 ; les historiques datés restent des preuves de leurs anciens périmètres. `review` est une gate obligatoire, pas la destination finale habituelle d'un lot approuvé. Ne pas demander un nouveau prompt ni un GO générique entre gates réussies, y compris après la review indépendante.

Le propriétaire ou ChatGPT dans son rôle de pilotage peuvent imposer une exception explicite et motivée : local uniquement, rester sur review, promotion différée, validation humaine spécifique ou fractionnement pour un risque/dépendance réel. Une reprise documentaire seule n'autorise aucun développement. Le cycle permanent ne donne aucune autorisation d'ajouter un lot, de changer l'économie ou le transport Twitch, d'importer/migrer des joueurs, de dépenser ou d'appliquer une opération métier hors mandat.

Un test critique échoué, finding non résolu, reviewer indépendant obligatoire indisponible, divergence inexpliquée, accès/preuve indispensable manquant, risque de corruption/double gain ou arbitrage humain indispensable suspend l'action risquée correspondante. Poursuivre les sous-ensembles indépendants sûrs, sans promouvoir un candidat global contenant un risque critique.

Pour les mécanismes sensibles (notamment concurrence Team ou nouvelle surface de diagnostic authentifiée), la revue indépendante reste obligatoire : agent réellement distinct, contexte séparé, lecture seule sur le **vrai SHA publié**, inspection des blobs/diff GitHub et tests, findings précis et verdict attaché au SHA. Le résumé de l'implémenteur ne vaut pas approbation. Corriger dans un commit séparé sur review, retester, vérifier le nouveau diff distant et faire revoir le delta avant main.

Le parcours opérationnel est détaillé aux sections 4–6. Le Master distingue toujours candidat, main, déployé, application métier et recette publique ; aucune de ces preuves ne remplace les autres.

<a id="missions-consolidées-préautorisées--règle-du-09102026"></a>

La règle consolidée du 09/10 est désormais incluse dans ce cycle permanent. Son ancien lien est conservé pour les références historiques.

## Production vivante et comparaisons BEFORE/AFTER — directive propriétaire du 10/10/2026

### Activité normale des joueurs — norme permanente précisée le 10/10/2026

GachaImpact est joué normalement sur Twitch et le standalone pendant les audits, modifications, tests, reviews et déploiements. Messages, commandes, nouveaux Players et sessions, XP, achats, invocations, combats, Missions, Quotidiennes, Event, Boss et variations de ressources sont des événements attendus. Les valeurs observées dans un snapshot (joueurs, soldes, receipts, inventaires, progression) ne sont pas figées pendant une mission.

**Par défaut, ignorer opérationnellement ces changements naturels lorsqu'ils sont sans rapport avec le lot.** Ne pas interrompre les travaux, relancer des tests, modifier le code ni consacrer du temps à enquêter sur chaque commande ou chaque mutation de vrai joueur uniquement parce que deux captures diffèrent. Pour un simple correctif d'affichage, ne pas déclencher par réflexe des audits exhaustifs des tables, compteurs ou opérations. Cette activité est du bruit de fond, pas une régression présumée ; poursuivre la mission et limiter les contrôles aux invariants réellement touchés.

**N'investiguer que si nécessaire** : lien direct avec le service ou comportement modifié ; preuve requise par le test ou le gate de sécurité ; indice crédible de perte/corruption, double gain/débit, atteinte aux identités/permissions, incident de sécurité ou régression sérieuse. Ne pas classer sans preuve un échec de test, un invariant violé ou un écart potentiellement dangereux comme « simple activité joueur ». Suspendre seulement l'action risquée dépendante et poursuivre les travaux indépendants sûrs.

Si un contrôle BEFORE/AFTER est nécessaire et proportionné au risque, borner la fenêtre et les domaines, puis expliquer uniquement les écarts pertinents avec les opérations, receipts, transactions, identités, montants et règles d'unicité. Ne jamais attribuer arbitrairement une différence à l'activité des joueurs ni présenter une intégrité non vérifiée comme prouvée. Un audit global reste légitime lorsqu'un mécanisme sensible ou un gate explicite l'exige, mais ne doit pas devenir une routine coûteuse à chaque livraison.

Pas de gel général, de rejeu des actions des joueurs, de réimport ou de réparation/purge implicite. Préserver les sauvegardes et protections économiques. Cette norme remplace les anciennes formulations qui imposaient de justifier systématiquement chaque variation mineure.

## Vérifications autonomes après déploiement — directive propriétaire du 10/10/2026

Privilégier les contrôles authentiques, automatiques et en lecture seule déjà accessibles : SHA et processus effectivement déployés, health, autorité PostgreSQL, capacité effective, EventSub/Helix et logs pertinents. Qualifier chaque preuve : un health public ne prouve pas l'armement ou l'autorité effective du pilote ; SQL et configuration démontrent l'état persistant/configuré, pas à eux seuls l'état du processus servi ; une souscription EventSub active ne prouve pas seule l'exécution correcte des commandes. Ne pas inventer une session, un GET authentifié, une valeur runtime ni une équivalence entre ces niveaux.

Ne pas redemander F5 → Configuration → Compte après un simple déploiement documentaire ni pour répéter une vérification déjà acquise dont les conditions restent valables. Lors d'un véritable changement runtime, réévaluer les preuves fraîches nécessaires avant le smoke. Une équivalence technique démontrée peut remplacer l'intervention répétitive ; tant qu'elle ne l'est pas, conserver la gate humaine indispensable. Demander au propriétaire seulement une preuve manquante non accessible automatiquement, une recette visuelle nécessaire ou un arbitrage sensible, en expliquant le manque précis.

Si les outils existants ne suffisent pas, une mission ultérieure explicitement autorisée pourra étudier puis développer un diagnostic opérateur sécurisé, automatiquement accessible et strictement en lecture seule, avec tests et review indépendante. Aucun endpoint public non sécurisé, contournement d'authentification ou mécanisme parallèle ; ne demander ni mot de passe, compte ADMIN partagé ni token dans un prompt, Git ou des logs. Secrets et credentials restent dans les mécanismes sécurisés existants ; preuves et réponses doivent être minimisées et expurgées. La présente directive est une orientation documentaire : elle n'implémente ni n'autorise à elle seule un nouvel accès, et ne déclare aucune équivalence runtime déjà obtenue.

## Protocole propriétaire — étape 29 uniquement (R1036)

**Clôture R1039 :** protocole historique ci-dessous conservé. Recette publique représentative R1038 acquise selon le propriétaire hors des derniers retours listés ; corrections/test automatiques puis promotion immédiate du même candidat et clôture 29 explicitement autorisées sans review intermédiaire ni nouveau gate manuel. Corrections finales non présumées individuellement retestées publiquement. STOP après publication ; 30 foundation/rehearsal privée prochaine, non commencée. Historique : la séparation alors en vigueur hors de 29 est supersédée par le cycle permanent du 10/10/2026. État/preuves au Master.

R1036 supersède la restriction de promotion directe au seul lot Ami de R1035. **Amendement R1038 : le propriétaire regroupe les 31 sources restantes dans une mission et délègue leur adaptation.** Les tableaux et validations fichier par fichier ne sont plus requis pour ce périmètre. L'analyse exhaustive reste obligatoire en interne ; les contrats durables et la matrice 37 sources se trouvent dans [la référence des commandes](../commands/command-reference.md) et [son annexe](../commands/step-29-command-coverage.md). Les six premières livraisons ne sont pas rouvertes.

Lire intégralement chaque source et ses helpers, confronter aux services et décisions modernes, relever racines/aliases/sous-commandes, casse/accents/ligatures, noms composés, quantités/MAX/all, consultations/mutations, gains/états utiles, abandons et gates. Examiner les douze mois d'Event et les triggers XP/Gift/Subscription. Conserver par défaut les mécaniques modernes ; raccorder une fonctionnalité textuelle déjà décidée lorsqu'elle manque réellement. Une extension minimale de résultat/receipt est autorisée pour afficher le résultat correspondant sans créer un autre moteur métier.

Choisir les formulations sous cette délégation, préserver les emojis utiles, noms, gains/coûts/soldes réels et durées lisibles. Ne pas présenter de tableaux d'erreurs purement système au propriétaire ; conserver les erreurs métier, tests d'identité et de sécurité. Les textes délégués ne sont pas individuellement validés publiquement.

Examiner chaque sortie longue ; réutiliser R1037 pour des parties monolignes de 500 caractères maximum, séparées entre entrées entières, ordre conservé sans perte/doublon/troncature. Conserver les limites/paginations voulues ; bannière normale unique. Intentions/cibles figées, mutations autoritatives et publication de toutes les parties atomique, reprise du résultat enregistré. Les aliases gardent propriétaire, permissions, canal, cooldown et Help canonique communs.

Travailler par groupes avec contrôles ciblés, puis validations complètes. Les mutations/idempotence/publication exigent les suites PostgreSQL pertinentes, **schémas privés et fichier par fichier** ; aucune fixture métier publique. Conserver PASS/FAIL/non exécuté séparés et ne jamais transformer un test automatique en recette propriétaire.

Quand le candidat global est complet : contrôles verts → diff/index/documents exacts → fetch/chaîne distante sans commit inattendu → commit/push normal review → vérification SHA distant → fast-forward strict du **même candidat** vers main → push/fetch final, origin/main == origin/review, divergence 0/0 et worktree propre. Tout est autorisé dans cette mission, **sans review ChatGPT intermédiaire**. Aucun force-push/reset destructif ni commit documentaire uniquement pour inscrire son propre SHA.

Après publication, ChatGPT vérifie le SHA et le déploiement exacts puis donne uniquement la courte [recette essentielle par famille](../commands/step-29-command-coverage.md#recette-propriétaire-essentielle-après-contrôle-du-sha-et-du-déploiement), sauf problème bloquant. Implémenté/testé/promu, déployé et validé publiquement restent distincts. Étape 29 reste active tant que sa recette et ses autres responsabilités ne sont pas closes. STOP après publication et rapport ; aucune activation Twitch, réponse réelle, EventSub, cutover, migration 30/31A/31B/32 ni modification d'infrastructure. Streamer.bot reste autoritatif Twitch. Historique : hors de ce périmètre, appliquer désormais le cycle permanent du 10/10/2026 et ses gates de review.

## 1. Concevoir le lot avant le prompt Codex

Pour un lot visible ou produit :

1. Le propriétaire teste l’état actuel et transmet ses remarques, captures et problèmes.
2. ChatGPT inspecte les captures, les remarques, le vrai code concerné et les documents utiles.
3. ChatGPT relève aussi les défauts évidents liés au sujet qui n’ont pas été mentionnés et propose les améliorations utiles.
   Si une amélioration non demandée modifierait visiblement un écran existant (bouton, barre, section, navigation, disposition, hiérarchie ou espacement), ChatGPT la propose au propriétaire et attend son accord avant de l’inclure dans un prompt Codex. Codex n’ajoute pas spontanément de contrôle ni de changement visible à un écran existant. Cette règle ne retarde pas un changement explicitement demandé, une correction purement technique sans effet visible pour le joueur ou la restauration d’un rendu déjà validé.
4. Après vérification des docs et du code pour retrouver les décisions acquises, ChatGPT regroupe toutes les questions connues en une seule salve autant que possible. Il pose uniquement celles nécessaires au résultat attendu ; aucune clarification artificielle si rien ne manque ou si les petits arbitrages sont explicitement délégués. Une vraie dépendance découverte peut nécessiter une question complémentaire.
5. Plusieurs échanges peuvent accumuler les choix et décisions.
6. ChatGPT produit une synthèse consolidée avant l’implémentation.

Tant que le propriétaire demande encore de l’analyse ou des questions, ChatGPT ne rédige pas prématurément un prompt Codex. Le prompt est produit lorsque les choix sont suffisamment mûrs ou lorsque le propriétaire le demande explicitement. Cette phase évite les itérations inutiles et les interprétations visuelles non souhaitées.

Préférer un lot et un prompt cohérents aussi complets que raisonnablement possible. Un test propriétaire, un gate irréversible, une migration dangereuse, un cutover ou une vraie dépendance peuvent justifier une coupure ; conserver ces frontières de risque.

## 2. Démarrer un lot Codex

Chaque gros prompt Codex doit demander de :

- vérifier les HEAD exacts de `origin/main` et `origin/review`, la base `review` approuvée et documenter la divergence attendue avant tout nouveau lot ;
- lire `AGENTS.md`, le Master et les sources spécialisées utiles ;
- persister, si nécessaire, la validation du lot précédent ;
- persister les nouvelles décisions durables réellement prises ;
- respecter un périmètre exact et borné ;
- terminer toute intervention qui modifie des fichiers par les validations pertinentes, un commit propre et un push normal sur `review`, sauf instruction explicite `local uniquement`.

Cette lecture documentaire exhaustive est le **Bootstrap** d'une nouvelle conversation Codex ou d'un nouveau domaine important. Une correction du même lot dans la même conversation peut être explicitement placée en mode **`CONTINUITÉ`** : Codex réutilise alors le contexte déjà acquis et inspecte les fichiers directement concernés, puis ne rouvre que les propriétaires nécessaires. En cas de compaction, ambiguïté ou contradiction sur une règle utile, il relit cette source avant de modifier. Le checkpoint Git reste obligatoire dans les deux modes ; le détail et la recommandation ChatGPT du modèle/niveau de réflexion figurent dans le [Guide opératoire ChatGPT](../../.chatgpt/CHATGPT_GUIDE.md#bootstrap-et-continuité-codex).

Avant chaque prompt, ChatGPT recommande hors bloc le modèle suffisamment capable selon la préférence actuelle du Guide, puis le niveau de réflexion adapté. La priorité d'économie est : modèle adapté, Continuité plutôt qu'un Bootstrap inutile, lectures/logs/comptes rendus ciblés, tests proportionnés au risque, puis niveau de réflexion. Cette économie ne réduit jamais la review indépendante, les tests nécessaires, les contrôles DB/concurrence pertinents, le checkpoint Git ou la qualité attendue.

## 2A. Documentation / état du projet à mettre à jour

Chaque prompt d'implémentation Codex doit contenir une section intitulée exactement **`DOCUMENTATION / ÉTAT DU PROJET À METTRE À JOUR`**. Le code et la documentation appartiennent au même lot : avant d'écrire le prompt, ChatGPT choisit les documents concernés et ne reporte pas leur maintenance à plus tard.

La section du prompt doit préciser :

- les fichiers documentaires à relire avant modification ;
- les documents à mettre à jour dans le lot et ceux à laisser inchangés ;
- la distinction entre modèle cible, état physique réel et validation publique ;
- l'état attendu du Master à la fin du lot et sa prochaine étape exacte ;
- les décisions Rxxx à créer ou amender, ou la mention explicite `aucune nouvelle décision`.

ChatGPT évalue au minimum les propriétaires suivants :

- le **Master** si l'état réel, le domaine actif, une validation, une dépendance importante, l'état physique significatif ou la prochaine étape change ;
- le **decisions-log** uniquement pour une décision durable produit, gameplay, UX ou architecture, jamais pour un simple avancement, correctif technique ou refactor ;
- les documents d'**architecture** si les responsabilités, transactions, sécurité, API structurelle ou persistance cible changent ;
- le **modèle V1** ou le **schéma PostgreSQL cible** si le modèle cible change, sans les transformer en tracker de migrations ;
- les **audits legacy** uniquement si une erreur de l'audit est démontrée et validée, jamais parce que l'implémentation avance ;
- la **roadmap macro** ou l'**ordre d'implémentation** uniquement si leur trajectoire ou leur ordre de référence change réellement ;
- le **workflow**, le **Guide ChatGPT** et les **README** uniquement si la méthode durable, la reprise ou la navigation générale devient obsolète.

Avant de terminer, Codex confronte les documents modifiés au code réellement produit. Son rapport précise les documents modifiés et pourquoi, ceux laissés inchangés, la version du Master avant/après, l'état du domaine, la validation acquise ou restante, la prochaine étape et toute différence entre cible et état physique.

Codex contrôle localement le code et la cohérence documentaire avant de publier le candidat sur `review` dans la même intervention. La review de référence porte ensuite sur le commit et son diff réellement poussés sur GitHub. Elle vérifie notamment le Master, la prochaine étape, la distinction validation technique/publique, les Rxxx, l'absence de cible présentée comme déjà physique et l'absence d'ancienne prochaine étape encore active.

## 3. Terminer et valider localement le travail Codex

Codex termine l’implémentation, exécute les tests automatisés pertinents, réalise une inspection visuelle locale réelle lorsqu’elle est utile et vérifie précisément le périmètre. Dès que l’intervention a modifié au moins un fichier, il crée ensuite un commit propre et le pousse normalement sur `review` dans cette même intervention, puis vérifie le SHA distant et laisse un worktree propre. Seules une intervention strictement read-only ou une instruction explicite `local uniquement` dispensent de commit/push.

Le rapport de validation distingue explicitement ce qui a été **exécuté et réussi**, **exécuté et échoué**, **exclu**, **non exécuté** ou **reporté**. Un test exclu n'est pas un test réussi ; un échec préexistant n'est pas automatiquement « flaky ». Avant ce qualificatif, reproduire le test isolément et rechercher sa cause. Une capture statique vérifie un état visuel, pas un timer, une transition, une concurrence ou un retry : ces comportements exigent des interactions ou des tests dédiés. Une fixture créée puis nettoyée sur une base réelle reste une action DB à déclarer, même si aucune donnée durable n'est conservée.

La validation est proportionnée : test reproduisant/ciblé d'abord, puis sous-système concerné, puis suite complète une fois le candidat stabilisé si le risque le justifie. `npm run verify:quick` et `npm run verify:full` regroupent seulement des contrôles non-DB ; ils ne remplacent jamais les tests DB nécessaires, les contrôles de concurrence, le statut des migrations, la review GitHub ou le test public. Les trois Skills repo `.agents/skills/verification`, `.agents/skills/database-change` et `.agents/skills/promotion` renvoient aux propriétaires de ces workflows sans les dupliquer. Les tests PostgreSQL DEV partagée restent des commandes explicites fichier par fichier. Un log complet utile reste hors contexte dans un fichier temporaire ; le bilan indique chaque étape PASS/FAIL et le code de retour, avec les erreurs nécessaires au diagnostic.

Dans l'UI player-facing, tout contrôle réellement cliquable affiche le curseur `pointer` et tout contrôle désactivé un curseur non interactif. Cette finition fait partie du niveau normal d'une UI, sans attendre un retour public pour chaque écran ; une interaction particulière peut garder son curseur adapté (`grab`, redimensionnement, texte). La règle ci-dessus sur l'accord préalable reste applicable aux autres changements visibles non demandés sur un écran existant.

Une tâche longue ou multi-session peut utiliser `docs/work/TASK_STATE.md`, ignoré par Git, à partir de son [template](../work/TASK_STATE.example.md). Mettre cette note à jour seulement aux étapes significatives, la relire au début d'une nouvelle session Codex et la supprimer localement à la fin. Une petite tâche n'en a pas besoin ; le Master reste l'unique état global officiel. Pour une même tâche ou ses corrections, poursuivre en CONTINUITÉ ; après checkpoint, préférer une nouvelle session Codex pour un lot ou domaine sans lien.

Les étapes ne se substituent pas les unes aux autres : validation locale ≠ candidat poussé sur `review` ≠ promotion sur `main` ≠ backend Railway déployé ≠ frontend Cloudflare déployé ≠ validation publique du propriétaire. Un Railway `SUCCESS` ne prouve pas le build ni l'affichage Cloudflare.

Les tests PostgreSQL qui utilisent la base Supabase DEV partagée s’exécutent fichier par fichier (`fileParallelism: false` dans la configuration Vitest DB) pour ménager DEV et garder les scénarios de concurrence reproductibles. Chaque suite mutative possède un schéma privé ; `isolatedBatchDatabase` vérifie `current_schema()`, copie seulement les catalogues de référence et réplique les contraintes CHECK, index et drapeaux RLS de DEV. Les lectures de métadonnées sur `public` restent autorisées ; aucune fixture métier n'y est écrite. Chaque fichier nettoie ses propres fixtures, et un arrêt brutal peut laisser un schéma privé à supprimer sans créer de Player public. `server/tests/db-test-isolation.test.ts` bloque le retour à `createDatabase` direct dans ces suites.

L’isolation ne se limite jamais à créer un Player fixture. Avant d’exécuter un test qui publie, réconcilie, diffuse ou matérialise globalement, ses dépendances doivent être bornées aux UUID exacts du test : Players, définitions, éditions et notifications. Aucun paramètre d’audience de test n’est exposé par une route publique. Le cleanup ne cible que les identifiants suivis par l’exécution courante, jamais un préfixe partagé ; un test ne matérialise aucune édition fictive d’une définition réelle et ne publie aucune notification de test vers les comptes existants.

Pour tout lot DB, la validation confronte le dossier versionné `server/prisma/migrations` au registre `_prisma_migrations`, puis exécute `prisma migrate status`. L’existence des tables ne suffit jamais à déclarer une migration appliquée. Si le SQL d’une migration Prisma a exceptionnellement été exécuté hors Prisma, son enregistrement se fait seulement après vérification structurelle avec `prisma migrate resolve --applied`, jamais par modification manuelle de `_prisma_migrations`.

## 4. Publier le candidat sur `review`

Après les contrôles locaux adaptés, vérifier les fichiers modifiés et indexés **exactement**, créer un commit propre et pousser normalement sur la branche permanente review dans la même intervention. Toute correction de review suit le même parcours dans un commit séparé. Seuls le read-only, une instruction local uniquement ou un vrai blocker dispensent de publication ; documenter la limite réelle.

Faire fetch avant publication et promotion : SHA exacts main/review, divergence, chaîne de commits, ascendance et état de l'index/worktree. Préserver les commits parallèles légitimes `docs/Story/**` sans les modifier ni les réécrire. Examiner tout changement distant inattendu avant écriture. Jamais de force-push, rebase destructif, squash ni reset de production.

`review` n'est pas un staging et ne possède aucun backend/base séparés. Un push main ne sert jamais de moyen de review. Après le push review, fetcher et confirmer le vrai SHA distant ; inspecter les vrais blobs/diffs GitHub, le périmètre et l'ascendance. Le rapport local seul ne remplace pas ce contrôle.

## 5. Review GitHub du candidat

Revoir le candidat réellement publié, sa documentation et les fichiers critiques. Pour un mécanisme sensible, appliquer la review indépendante définie par le cycle permanent. Chaque finding bloquant est corrigé, testé, publié et revu sur son nouveau SHA. Aucune approbation inventée, aucune promotion d'un candidat contenant un risque critique non résolu.

Une review approuvée et toutes les gates satisfaites entraînent la suite de la **même mission**, sans solliciter de second GO. Seule une exception explicitement décidée ou un vrai blocker justifie de rester sur review. Le propriétaire complète ensuite la recette publique requise ; sa validation n'est jamais présumée.

## 6. Promouvoir vers `main`, déployer et valider publiquement

Finaliser avant promotion les documents dans un état cohérent avec la livraison attendue, sans annoncer comme acquis un déploiement, une application métier ou une recette non exécutés. Ne pas laisser une prochaine étape que le fast-forward rendra fausse.

Refaire fetch main/review, confirmer le candidat approuvé, l'absence de concurrent inattendu et que main en est strictement ancêtre. Avancer main uniquement par `git merge --ff-only review`, puis push normal, fetch et vérification des SHA distants. Objectif : `origin/main == origin/review`, divergence 0/0, index/worktree propres. Aucun push simultané aveugle des deux branches.

Contrôler séparément Railway et Cloudflare Pages au **SHA exact**, health, migrations normales si concernées, puis postflight adapté à la production vivante. Le succès Railway ne prouve ni Cloudflare ni l'exécution Twitch. Consigner les preuves authentiques et limites dans le propriétaire documentaire si elles changent réellement l'état ; aucun micro-commit pour recopier son propre hash ou répéter une promotion déjà faite.

Fournir immédiatement une courte recette publique représentative du diff réellement livré, seulement pour les preuves humaines/visuelles nécessaires. Pas de F5 répétitif si une équivalence technique est réellement obtenue ; pas d'achat ou consommation rare pour contrôler une formulation. Le Master ne déclare validé publiquement que ce que le propriétaire a effectivement testé.

## 7. Boucle de feedback suivante

Après un test public, ne pas envoyer immédiatement un correctif Codex au premier défaut visuel. Préférer :

`test → remarques/captures → inspection ChatGPT → questions → synthèse → prompt consolidé`

Lorsque plusieurs défauts appartiennent au même sujet, les grouper dans un lot cohérent.

## 8. Rollback

`main` est l’alpha auto-déployée. Les checkpoints Git constituent le filet de sécurité du projet. Pour annuler un lot public, préférer `git revert`. Ne jamais utiliser de force-push ou de reset destructif de `main`.

## 9. Changer de conversation

Suivre [Conversation handoff](conversation-handoff.md), effectuer le checkpoint documentaire avant de quitter la conversation et ne reprendre le développement qu'après validation du contexte dans la nouvelle conversation.
