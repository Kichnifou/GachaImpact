# Rôle de ce document

Ce document est la source de vérité du déroulement opérationnel d’un lot de développement GachaImpact, de sa conception jusqu’à sa validation publique et à son checkpoint Git. Le propriétaire, ChatGPT et Codex doivent le lire lorsqu’ils préparent, implémentent, reviewent ou valident un lot.

Il possède la méthode de travail et la répartition des responsabilités entre ces étapes. Il n’est ni un tracker d’avancement, ni une roadmap, ni un journal de décisions produit, ni un remplacement du Master.

Documents liés :

- [Guide opératoire ChatGPT](../../.chatgpt/CHATGPT_GUIDE.md) : reprise d’une conversation et règles propres à ChatGPT ;
- [AGENTS.md](../../AGENTS.md) : garde-fous permanents applicables aux agents ;
- [Master](../master/PROJECT_MASTER_PLAN.md) : état global vivant, domaine actif et prochaine étape exacte ;
- [Ordre d’implémentation V1](../roadmap/implementation-order-v1.md) : séquence de développement prévue ;
- [Journal des décisions](../specifications/decisions-log.md) : décisions produit et techniques durables ;
- [Déploiement Free-first](../deployment/free-first-v1.md) : particularités Railway, Cloudflare Pages et validation de l’alpha publique.

Les règles produit restent dans les documents spécialisés et le journal des décisions. L’état courant reste dans le Master. Les commandes, valeurs et contrôles propres au déploiement restent dans le document de déploiement.

## 1. Concevoir le lot avant le prompt Codex

Pour un lot visible ou produit :

1. Le propriétaire teste l’état actuel et transmet ses remarques, captures et problèmes.
2. ChatGPT inspecte les captures, les remarques, le vrai code concerné et les documents utiles.
3. ChatGPT relève aussi les défauts évidents liés au sujet qui n’ont pas été mentionnés et propose les améliorations utiles.
4. ChatGPT pose uniquement les questions nécessaires pour verrouiller le résultat attendu.
5. Plusieurs échanges peuvent accumuler les choix et décisions.
6. ChatGPT produit une synthèse consolidée avant l’implémentation.

Tant que le propriétaire demande encore de l’analyse ou des questions, ChatGPT ne rédige pas prématurément un prompt Codex. Le prompt est produit lorsque les choix sont suffisamment mûrs ou lorsque le propriétaire le demande explicitement. Cette phase évite les itérations inutiles et les interprétations visuelles non souhaitées.

## 2. Démarrer un lot Codex

Chaque gros prompt Codex doit demander de :

- vérifier le HEAD exact de départ ;
- lire `AGENTS.md`, le Master et les sources spécialisées utiles ;
- persister, si nécessaire, la validation du lot précédent ;
- persister les nouvelles décisions durables réellement prises ;
- respecter un périmètre exact et borné ;
- ne pas commit ni push par défaut.

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

Avant la publication du candidat sur `review`, ChatGPT peut effectuer un contrôle local du code et de la cohérence documentaire. La review de référence porte ensuite sur le commit et son diff réellement poussés sur GitHub. Elle vérifie notamment le Master, la prochaine étape, la distinction validation technique/publique, les Rxxx, l'absence de cible présentée comme déjà physique et l'absence d'ancienne prochaine étape encore active.

## 3. Terminer et valider localement le travail Codex

Codex termine l’implémentation, exécute les tests automatisés pertinents et réalise une inspection visuelle locale réelle lorsqu’elle est utile. Il fournit ensuite un rapport structuré. Pendant l’implémentation, il ne committe et ne pousse pas par défaut ; la publication du candidat sur `review` fait l’objet d’une instruction explicite après la validation locale.

Les tests PostgreSQL qui utilisent la base Supabase DEV partagée s’exécutent fichier par fichier (`fileParallelism: false` dans la configuration Vitest DB) afin qu’une fixture temporaire d’un domaine ne puisse pas être observée par les invariants d’un autre fichier. Chaque fichier reste responsable du suivi et du nettoyage transactionnel de ses propres fixtures, y compris après un échec ; les scénarios de concurrence métier explicites au sein d’un même fichier restent autorisés.

## 4. Publier le candidat sur `review`

Le workflow Git permanent est le suivant :

1. `main` représente le dernier état public et la production ;
2. Codex travaille d’abord localement sur un lot borné ;
3. les tests automatisés pertinents sont exécutés localement ;
4. le candidat est committé puis poussé sur la branche permanente `review` ;
5. ChatGPT et le propriétaire inspectent sur GitHub le commit et son diff par rapport à `main` ;
6. les corrections éventuelles sont apportées, testées et poussées sur `review` ;
7. une fois la review approuvée, `review` est mergée ou avancée proprement vers `main` selon l’historique réel ;
8. l’arrivée du commit sur `main` déclenche les déploiements de production ;
9. Railway et Cloudflare Pages sont vérifiés ;
10. le propriétaire réalise le test public ;
11. le checkpoint n’est marqué comme publiquement validé dans le Master qu’après la réussite de ce test.

`review` est uniquement une branche de pré-review Git. Elle ne constitue pas un environnement staging, ne possède ni backend ni base séparés et ne permet de prétendre à aucun test public. Un push sur `main` ne doit jamais servir de moyen de review : `main` reste conceptuellement protégée comme branche de production.

Lorsqu’un candidat doit être publié par Codex ou par le propriétaire :

```powershell
git status
git add .
git commit -m "message adapté"
git push -u origin review
git status
```

## 5. Review GitHub du candidat

ChatGPT vérifie le HEAD de `review`, le compare au dernier état de `main`, contrôle la liste des fichiers, la documentation et les fichiers critiques. Il distingue les validations automatisées déjà acquises des validations publiques encore impossibles à ce stade.

Si le lot n’est pas acceptable, les corrections restent sur `review`. S’il est acceptable, ChatGPT et le propriétaire autorisent explicitement seulement alors son passage vers `main`.

## 6. Promouvoir vers `main`, déployer et valider publiquement

Après approbation de la review, le passage contrôlé de `review` vers `main` constitue le checkpoint de production. L’équipe vérifie ensuite les déploiements Railway et Cloudflare Pages avant d’effectuer le test public sur [gachaimpact.pages.dev](https://gachaimpact.pages.dev).

Le Master distingue toujours le commit candidat poussé sur `review`, le commit réellement présent sur `main`, le déploiement réussi et la validation publique du propriétaire. Aucun lot n’est déclaré publiquement validé avant la dernière étape.

## 7. Boucle de feedback suivante

Après un test public, ne pas envoyer immédiatement un correctif Codex au premier défaut visuel. Préférer :

`test → remarques/captures → inspection ChatGPT → questions → synthèse → prompt consolidé`

Lorsque plusieurs défauts appartiennent au même sujet, les grouper dans un lot cohérent.

## 8. Rollback

`main` est l’alpha auto-déployée. Les checkpoints Git constituent le filet de sécurité du projet. Pour annuler un lot public, préférer `git revert`. Ne jamais utiliser de force-push ou de reset destructif de `main`.
