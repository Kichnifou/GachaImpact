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

## Missions consolidées préautorisées — règle du 09/10/2026

Lorsqu'une mission autorise explicitement revue, corrections, promotion, déploiement et application métier, Codex poursuit ces étapes dans la même exécution après leurs contrôles, sans redemander un GO générique. Pour un mécanisme sensible, la revue indépendante reste obligatoire : reviewer distinct, contexte séparé, lecture seule du vrai diff/SHA publié et des tests, findings précis, verdict attaché au SHA. Corriger les blocages dans un commit séparé sur review puis faire revoir le delta avant main. Un simple résumé de tests ne constitue pas une approbation.

Le parcours conserve publication review → vérification des vrais diff/blobs GitHub → ancestry et absence de concurrent inattendu → fast-forward strict main → SHA distants → déploiements exacts et migrations normales → gates métier → application préautorisée → postflight et recette. L'autorisation ne dépasse jamais la population, l'économie ni les actions nommées dans le mandat. Aucun arrêt cérémoniel après un succès ; arrêter devant une preuve/accès indispensable manquant, un risque non résolu, une ambiguïté humaine ou un reviewer indisponible. Ne pas immobiliser les sous-ensembles indépendants sûrs. Le Master distingue toujours candidat, déployé, appliqué et recette humaine.

Cette règle prime, pour ces missions, sur les passages historiques exigeant systématiquement un prompt de promotion ou d'application séparé. Hors préautorisation explicite, leurs limites restent applicables. [R1062](../specifications/decisions-log.md) est le mandat P0 courant.

## Protocole propriétaire — étape 29 uniquement (R1036)

**Clôture R1039 :** protocole historique ci-dessous conservé. Recette publique représentative R1038 acquise selon le propriétaire hors des derniers retours listés ; corrections/test automatiques puis promotion immédiate du même candidat et clôture 29 explicitement autorisées sans review intermédiaire ni nouveau gate manuel. Corrections finales non présumées individuellement retestées publiquement. STOP après publication ; 30 foundation/rehearsal privée prochaine, non commencée. Hors de 29, workflow normal et promotion dédiée inchangés. État/preuves au Master.

R1036 supersède la restriction de promotion directe au seul lot Ami de R1035. **Amendement R1038 : le propriétaire regroupe les 31 sources restantes dans une mission et délègue leur adaptation.** Les tableaux et validations fichier par fichier ne sont plus requis pour ce périmètre. L'analyse exhaustive reste obligatoire en interne ; les contrats durables et la matrice 37 sources se trouvent dans [la référence des commandes](../commands/command-reference.md) et [son annexe](../commands/step-29-command-coverage.md). Les six premières livraisons ne sont pas rouvertes.

Lire intégralement chaque source et ses helpers, confronter aux services et décisions modernes, relever racines/aliases/sous-commandes, casse/accents/ligatures, noms composés, quantités/MAX/all, consultations/mutations, gains/états utiles, abandons et gates. Examiner les douze mois d'Event et les triggers XP/Gift/Subscription. Conserver par défaut les mécaniques modernes ; raccorder une fonctionnalité textuelle déjà décidée lorsqu'elle manque réellement. Une extension minimale de résultat/receipt est autorisée pour afficher le résultat correspondant sans créer un autre moteur métier.

Choisir les formulations sous cette délégation, préserver les emojis utiles, noms, gains/coûts/soldes réels et durées lisibles. Ne pas présenter de tableaux d'erreurs purement système au propriétaire ; conserver les erreurs métier, tests d'identité et de sécurité. Les textes délégués ne sont pas individuellement validés publiquement.

Examiner chaque sortie longue ; réutiliser R1037 pour des parties monolignes de 500 caractères maximum, séparées entre entrées entières, ordre conservé sans perte/doublon/troncature. Conserver les limites/paginations voulues ; bannière normale unique. Intentions/cibles figées, mutations autoritatives et publication de toutes les parties atomique, reprise du résultat enregistré. Les aliases gardent propriétaire, permissions, canal, cooldown et Help canonique communs.

Travailler par groupes avec contrôles ciblés, puis validations complètes. Les mutations/idempotence/publication exigent les suites PostgreSQL pertinentes, **schémas privés et fichier par fichier** ; aucune fixture métier publique. Conserver PASS/FAIL/non exécuté séparés et ne jamais transformer un test automatique en recette propriétaire.

Quand le candidat global est complet : contrôles verts → diff/index/documents exacts → fetch/chaîne distante sans commit inattendu → commit/push normal review → vérification SHA distant → fast-forward strict du **même candidat** vers main → push/fetch final, origin/main == origin/review, divergence 0/0 et worktree propre. Tout est autorisé dans cette mission, **sans review ChatGPT intermédiaire**. Aucun force-push/reset destructif ni commit documentaire uniquement pour inscrire son propre SHA.

Après publication, ChatGPT vérifie le SHA et le déploiement exacts puis donne uniquement la courte [recette essentielle par famille](../commands/step-29-command-coverage.md#recette-propriétaire-essentielle-après-contrôle-du-sha-et-du-déploiement), sauf problème bloquant. Implémenté/testé/promu, déployé et validé publiquement restent distincts. Étape 29 reste active tant que sa recette et ses autres responsabilités ne sont pas closes. STOP après publication et rapport ; aucune activation Twitch, réponse réelle, EventSub, cutover, migration 30/31A/31B/32 ni modification d'infrastructure. Streamer.bot reste autoritatif Twitch. Hors de ce périmètre, workflow normal avec review indépendante et promotion dédiée inchangé.

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

**Méthode propriétaire actualisée le 07/10/2026 :** pour un changement borné, testé et sans blocker utilisant les mécanismes déjà validés, la mission accomplit `review → commit/push → contrôle du vrai diff GitHub → ancestry stricte → fast-forward main → push/fetch → déploiements exacts/health` dans la même conversation, sans nouvelle review indépendante ni prompt de promotion séparé. Cette autorisation permanente reste limitée au périmètre demandé ; elle n’autorise aucune activation, migration, dépense ou autre lot implicite. STOP intermédiaire seulement pour une action humaine indispensable, un vrai blocker ou un nouveau mécanisme sensible non prévu. Dans ce dernier cas, implémentation/tests/publication sur review puis review indépendante avant promotion restent obligatoires ; aucun contournement d’intégrité. Les étapes de review/promotion dédiée ci-dessous s’appliquent à ces périmètres sensibles et aux missions qui l’exigent explicitement. Vérification GitHub réelle avant main, documentation exacte, absence de force-push/rebase destructif, contrôles de déploiement et distinction technique/validation propriétaire restent obligatoires dans les deux parcours.

Le workflow Git permanent est le suivant :

1. `main` reste le dernier checkpoint promu ; plusieurs petits lots indépendamment reviewés peuvent s'accumuler sur `review` ;
2. Codex travaille sur un lot borné, exécute les tests pertinents et contrôle son périmètre ;
3. dans la même intervention, le candidat est committé puis poussé normalement sur la branche permanente `review` ;
4. ChatGPT inspecte sur GitHub le vrai commit et son diff par rapport à `main` avant de valider ou de demander une correction technique ;
5. chaque correction éventuelle suit à son tour `modification → tests → commit séparé → push review` ;
6. ChatGPT re-review le vrai nouveau commit ;
7. une review approuvée n'impose pas de promotion immédiate : le lot suivant peut partir du HEAD `review` approuvé. Une promotion dédiée intervient pour un test/une activation publique, un changement infrastructure/migration, un checkpoint fonctionnel cohérent ou une décision explicite du propriétaire. ChatGPT fournit alors le modèle/niveau et le prompt de promotion ; son exécution volontaire constitue l'autorisation. La mission finalise les statuts exacts après promotion, pousse le commit documentaire sur `review`, revalide le gate puis avance toute `review` vers `main` par fast-forward strict, sans force-push ;
8. l’arrivée du commit sur `main` déclenche les déploiements de production ;
9. ChatGPT vérifie `main == review`, Railway, Cloudflare Pages et le healthcheck ;
10. ChatGPT fournit immédiatement **À tester en public**, sans attendre une demande : checklist concise basée sur le diff réellement promu, regroupée par parcours utilisateur, limitée aux ajouts/modifications et interactions à risque, sans recopier les tests automatisés ni lister tout le jeu ;
11. le propriétaire réalise ce test public ;
12. le checkpoint n’est marqué comme publiquement validé dans le Master qu’après la réussite de ce test.

`review` est uniquement une branche de pré-review Git. Elle ne constitue pas un environnement staging, ne possède ni backend ni base séparés et ne permet de prétendre à aucun test public. Un push sur `main` ne doit jamais servir de moyen de review : `main` reste conceptuellement protégée comme branche de production.

Les commits parallèles légitimes limités à `docs/Story/**` restent dans l'historique sans réécriture ni modification par un lot produit. Un changement distant inattendu hors de ce périmètre impose une nouvelle vérification avant tout push ou promotion ; un lot ne rebase, squash ou force-push jamais ces commits.

Lorsqu’un candidat est publié par Codex ou par le propriétaire, seuls les fichiers vérifiés du lot sont indexés :

```powershell
git status
git add -- <fichiers-du-lot>
git commit -m "message adapté"
git push -u origin review
git status
```

## 5. Review GitHub du candidat

ChatGPT vérifie le HEAD de `review`, le compare au dernier état de `main`, contrôle la liste des fichiers, la documentation et les fichiers critiques. Cette review de référence porte sur le vrai commit GitHub, jamais uniquement sur le résumé d’un worktree local non publié. Il distingue les validations automatisées déjà acquises des validations publiques encore impossibles à ce stade.

Si le lot n’est pas acceptable, les corrections restent sur `review`. S'il est acceptable, ChatGPT peut préparer le petit lot suivant depuis ce HEAD approuvé, après vérification des deux HEAD et de la divergence attendue. Il fournit un prompt de promotion dédié uniquement lorsque l'un des critères de l'étape 7 le nécessite. Ce prompt ne déclenche rien seul : son exécution volontaire par le propriétaire est l'autorisation explicite requise. ChatGPT ne promeut jamais silencieusement un candidat et ne demande pas une seconde confirmation conversationnelle après avoir fourni ce prompt.

## 6. Promouvoir vers `main`, déployer et valider publiquement

Lorsqu'une promotion dédiée est nécessaire et explicitement demandée, le passage contrôlé de la `review` approuvée vers `main` constitue le checkpoint de production. L’équipe vérifie ensuite les déploiements Railway et Cloudflare Pages avant le test public requis sur [gachaimpact.pages.dev](https://gachaimpact.pages.dev). Une review indépendante réussie seule n'autorise ni n'impose cette promotion.

La mission de promotion ne laisse pas dans le commit promu une prochaine étape devenue fausse par son propre fast-forward, telle que « promouvoir ce candidat » ou « attendre la promotion ». Elle décrit l’état post-promotion réellement attendu, sans anticiper Cloudflare, Railway, le healthcheck ou une validation publique : ces preuves sont contrôlées après le push `main` par ChatGPT. Aucun commit documentaire supplémentaire n’est créé uniquement pour constater la promotion ; il faut un changement d’état réel, par exemple un déploiement vérifié, une validation publique, un défaut, une clôture de lot, un changement de domaine ou une décision produit ou technique.

Le Master distingue toujours le commit candidat poussé sur `review`, le commit réellement présent sur `main`, le déploiement réussi et la validation publique du propriétaire. Aucun lot n’est déclaré publiquement validé avant la dernière étape.

## 7. Boucle de feedback suivante

Après un test public, ne pas envoyer immédiatement un correctif Codex au premier défaut visuel. Préférer :

`test → remarques/captures → inspection ChatGPT → questions → synthèse → prompt consolidé`

Lorsque plusieurs défauts appartiennent au même sujet, les grouper dans un lot cohérent.

## 8. Rollback

`main` est l’alpha auto-déployée. Les checkpoints Git constituent le filet de sécurité du projet. Pour annuler un lot public, préférer `git revert`. Ne jamais utiliser de force-push ou de reset destructif de `main`.

## 9. Changer de conversation

Suivre [Conversation handoff](conversation-handoff.md), effectuer le checkpoint documentaire avant de quitter la conversation et ne reprendre le développement qu'après validation du contexte dans la nouvelle conversation.
