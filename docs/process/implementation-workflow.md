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

Après le rapport, ChatGPT review le code **et** cette cohérence documentaire avant de proposer le commit/push. Il vérifie notamment le Master, la prochaine étape, la distinction validation technique/publique, les Rxxx, l'absence de cible présentée comme déjà physique et l'absence d'ancienne prochaine étape encore active. Après le push, ChatGPT contrôle ces fichiers sur GitHub.

## 3. Terminer le travail Codex

Codex termine l’implémentation, exécute les tests automatisés pertinents et réalise une inspection visuelle locale réelle lorsqu’elle est utile. Il fournit ensuite un rapport structuré. Il ne committe pas et ne pousse pas.

## 4. Review par ChatGPT

Le propriétaire transmet le rapport Codex à ChatGPT. ChatGPT :

1. review le rapport et vérifie les points suspects si nécessaire ;
2. demande une correction Codex si le lot n’est pas acceptable ;
3. si le lot est acceptable, fournit les commandes Git au propriétaire ;
4. place les commandes de push avant la checklist des tests manuels ;
5. fournit une checklist concise couvrant toute l’implémentation, y compris les changements que le propriétaire n’a pas à manipuler directement ;
6. distingue clairement les tests automatisés réalisés par Codex des validations visuelles ou fonctionnelles encore attendues du propriétaire.

## 5. Commit et push par le propriétaire

Le propriétaire exécute lui-même :

```powershell
git status
git add .
git commit -m "message adapté"
git push
git status
```

Codex n’est pas rappelé uniquement pour commit ou push, afin de ne pas consommer inutilement des tokens.

## 6. Contrôler après le push

ChatGPT vérifie le nouveau HEAD GitHub, le compare au checkpoint précédent, contrôle les fichiers attendus et, si nécessaire, les fichiers critiques. L’équipe attend ensuite les déploiements utiles avant d’effectuer le test public sur [gachaimpact.pages.dev](https://gachaimpact.pages.dev).

## 7. Boucle de feedback suivante

Après un test public, ne pas envoyer immédiatement un correctif Codex au premier défaut visuel. Préférer :

`test → remarques/captures → inspection ChatGPT → questions → synthèse → prompt consolidé`

Lorsque plusieurs défauts appartiennent au même sujet, les grouper dans un lot cohérent.

## 8. Rollback

`main` est l’alpha auto-déployée. Les checkpoints Git constituent le filet de sécurité du projet. Pour annuler un lot public, préférer `git revert`. Ne jamais utiliser de force-push ou de reset destructif de `main`.
