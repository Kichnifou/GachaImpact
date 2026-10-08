# Roadmap de préparation et de développement GachaImpact

## Fin du projet : exploitation silencieuse puis pré-release

[R1050/R1054](../specifications/decisions-log.md) rendent distincts le cutover technique et la révélation du standalone. Les comptes Twitch-only NATIVE PostgreSQL continuent d'accumuler leur vrai état par messages/commandes sans OAuth individuel ni création web imposée, avec Faveur/Gift/Giveaway selon leurs owners et sans Streamer.bot autoritaire pour les domaines remplacés. La stabilisation demeure silencieuse. Kichni_Test, créé par le propriétaire, ouvre les futurs canaries ; ses snapshot/import/recette ne sont pas réalisés ici et il n'entre pas automatiquement dans les 43.

Après stabilisation silencieuse, la pré-release suit les compléments propriétaire R1057/R1058 : Codes cadeaux enrichis, tirage mensuel Event R1053, gestion standard SupabaseAuth des mots de passe, puis Character/catalogue/assets/import officiel à sept jours et outils ADMIN R1051. Cosmétiques et suppression Configuration Apparence R1052, passe graphique/ergonomie/mobile, vraie bêta/corrections et sweep des sources/backlog restent requis ; audit/optimisation Supabase prioritaire après migration des joueurs, aucun chantier anticipé. La [séquence détaillée](implementation-order-v1.md) conserve 31A/31B/32 et la gate complète ; aucune de ces décisions ne vaut mission d'implémentation automatique. R1046 permettra ensuite de retrouver tout l'état du même Player, sans migration supplémentaire ; les conflits web significatifs restent opérateur. Le [Master](../master/PROJECT_MASTER_PLAN.md) seul consigne les preuves et la prochaine action.

## Rôle de ce document

Ce fichier décrit la **trajectoire macro** du projet.

Il ne doit pas servir de tracker détaillé d'avancement et ne doit pas indiquer le domaine actuellement actif ou la prochaine reprise exacte.

Pour connaître :
- la phase active ;
- le domaine d'audit actif ;
- l'état actuel du projet ;
- la prochaine étape exacte ;

consulter uniquement :

`docs/master/PROJECT_MASTER_PLAN.md`

Cette séparation évite qu'une roadmap secondaire devienne obsolète et fournisse plus tard de mauvaises instructions à ChatGPT, Codex ou un autre agent.

---

## Phase A — Compréhension et audit du legacy

Objectifs :
- inventorier les sources Streamer.bot ;
- comprendre le modèle joueur existant ;
- auditer les scripts système par système ;
- distinguer règles voulues, bugs, contraintes historiques et données à migrer ;
- valider avec l'utilisateur les règles cible du standalone ;
- documenter les producteurs, consommateurs et dépendances transversales.

Produits documentaires principaux :
- `docs/legacy/`
- `docs/specifications/decisions-log.md`
- `docs/commands/command-reference.md`
- `docs/master/PROJECT_MASTER_PLAN.md`

---

## Phase B — Consolidation du modèle cible

Après clôture suffisante des audits legacy :
- consolider le modèle de données cible ;
- identifier les agrégats et sources de vérité ;
- définir les frontières entre logique métier, données, UI et intégrations ;
- préparer la stratégie de migration ;
- résoudre les dernières dépendances transversales nécessaires au backend.

Ne pas figer prématurément un schéma à partir des seules structures JSON legacy.

---

## Phase C — Architecture backend / authentification / base

Objectifs :
- choisir et valider le socle backend ;
- mettre en place l'authentification ;
- créer la base de données cible ;
- centraliser les services métier ;
- garantir les transactions économiques ;
- mettre en place les traitements serveur et temporels ;
- préparer les mécanismes de migration et d'observabilité.

Le navigateur ne devient jamais la source autoritative des données sensibles.

---

## Phase D — Migration pilote

Objectifs :
- tester l'import sur un profil legacy représentatif ;
- vérifier l'idempotence ;
- produire un rapport d'anomalies ;
- vérifier ressources, progression, personnages, historiques et relations ;
- comparer les données sources et les données importées.

La migration générale ne commence qu'après validation suffisante du pilote.

---

## Phase E — Implémentation progressive du standalone

Codex doit travailler par **lots bornés**.

Le déroulement opérationnel détaillé de chaque lot appartient à [implementation-workflow.md](../process/implementation-workflow.md). Cette roadmap conserve uniquement la trajectoire macro.

Pour chaque lot :
1. lire le Master et les documents spécialisés concernés ;
2. auditer le code déjà présent ;
3. définir le périmètre exact ;
4. implémenter uniquement ce périmètre ;
5. ajouter ou adapter les tests ;
6. vérifier les critères d'acceptation ;
7. signaler les fichiers modifiés et les dépendances restantes.

Les systèmes sont implémentés progressivement en fonction des dépendances validées, et non en recopiant l'ordre des anciens scripts Streamer.bot.

---

## Phase F — Social, temps réel et systèmes communautaires

Selon les besoins déjà spécifiés :
- chat global ;
- présence ;
- amis et confidentialité ;
- notifications ;
- interactions communautaires ;
- systèmes temps réel nécessaires aux mécaniques concernées.

Les services métier restent indépendants du canal qui les appelle.

---

## Phase G — Intégration Twitch

Twitch devient un canal optionnel supplémentaire vers les mêmes services métier que l'UI et le chat GachaImpact.

Selon R939–R942, les chats peuvent rester deux flux distincts sans mirroring obligatoire. La cible reçoit tous les messages Twitch en mémoire pour classification légère et XP/cooldown global partagé, puis parser/services seulement si nécessaires. Après validation du transport pilote 2B-2, mettre en pause l'intégration avancée et poursuivre les domaines V1 suivants, dont Faveur. La passe finale Twitch intervient après les domaines prioritaires, selon [la séquence V1](implementation-order-v1.md).

Objectifs :
- liaison d'identité Twitch ;
- réception éventuelle des messages ;
- commandes Twitch ;
- restitution adaptée au canal ;
- aucune dépendance à Streamer.bot.

Le jeu doit rester entièrement utilisable sans Twitch.

Avant éventuel outbound, inventorier/comparer les réponses aux `.txt` legacy, tester les textes d'abord dans le Chat standalone avec Kichnifou et obtenir la validation propriétaire. R1034 clôture 27 par périmètre et reclasse charge/performance en observation bêta non bloquante ; 29 est clôturée R1039 ; R1048 prépare les fondations durables de la bascule transparente. Aucune activation Twitch en 29 ; voir [la dette commandes](../commands/command-reference.md#passe-finale-twitch--commandes-r939r942) et [l'architecture](../architecture/backend-architecture-v1.md).

---

## Phase H — Stabilisation et équilibrage

Après implémentation fonctionnelle suffisante :
- playtests ;
- équilibrage économie et progression ;
- tests de concurrence ;
- tests de migration ;
- performances ;
- sécurité ;
- responsive PC/mobile ;
- résilience ;
- nettoyage des dettes techniques justifiées.

R1034 clôture le lot transverse 27 par décision de périmètre propriétaire, sans affirmer que tous ses travaux ont été exécutés. La [politique canonique de rétention](../specifications/data-retention-v1.md) et ses protections restent valables : ce qui est implémenté reste actif selon ses gates ; purges et maintenance non implémentées deviennent backlog post-V1/besoin réel, non obligatoires avant cutover. Charge/performance Twitch et validations rares deviennent observations bêta/situation réelle non bloquantes, sans nouvelle campagne artificielle imposée ni test inventé. Une anomalie observée ouvre un correctif borné ; les protections contre doubles effets restent obligatoires pour la migration et la bascule d'autorité.

---

## Séquence de clôture avant migration globale

Suivre [implementation-order-v1.md](implementation-order-v1.md) : 26 et 28 VALIDÉES / CLÔTURÉES, 27 CLÔTURÉE PAR DÉCISION DE PÉRIMÈTRE PROPRIÉTAIRE, 29 et 30 clôturées selon le Master. La suite courante R1050/R1054 est **fondations R1048 corrigées → 31A Kichni_Test → Kichnifou refresh LEGACY puis NATIVE → Ceo standalone → rehearsal finale → 31B membres encore LEGACY des 43 → transfert GLOBAL explicite → stabilisation silencieuse → pré-release 32 → révélation autorisée**. Tous les numéros sont conservés. Les Players déjà NATIVE sont préservés, les 171 discarded et deux quarantaines non migrés ; 31B exige la validation propriétaire des canaries, sans bascule globale automatique. Streamer.bot reste autoritatif jusqu'au transfert effectif de chaque périmètre. Les contrats spécialisés définissent la cible ; le Master porte les preuves et prochaines actions.

## Principe final

Cette roadmap indique **où le projet va**.

Le Master indique **où le projet en est maintenant**.
