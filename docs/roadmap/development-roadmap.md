# Roadmap de préparation et de développement GachaImpact

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

Avant éventuel outbound, inventorier/comparer les réponses aux `.txt` legacy, tester les textes d'abord dans le Chat standalone avec Kichnifou et obtenir la validation propriétaire. La conservation définitive de l’intégration dépend de la recette technique 27 ; la passe exhaustive commandes/sorties et leur validation propriétaire appartient à 29 avant migration ; voir [la dette commandes](../commands/command-reference.md#passe-finale-twitch--commandes-r939r942) et [l'architecture](../architecture/backend-architecture-v1.md).

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

Le lot transverse de finition implémente la [politique canonique de rétention](../specifications/data-retention-v1.md) après audit des statistiques, états, FK, claims, idempotence et preuves de chaque domaine, avec maintenance DB. La recette finale Twitch couvre trafic ordinaire/spam/multi-auteurs/commandes, latence webhook/API, pool PostgreSQL, UI, Chat/MP, retries et doubles effets. La cible des messages ordinaires en mémoire sans persistance inutile sera évaluée à cette passe ; les durées décidées ne prouvent pas que ces purges sont déjà physiques.

---

## Séquence de clôture avant migration globale

Suivre [implementation-order-v1.md](implementation-order-v1.md), R1032 : 25 Tutoriel/Help/Aide → 26 recette globale validée par le propriétaire → 28 Multijoueur Arcade → 29 passe exhaustive commandes ! → 27 finition technique/visuelle, rétention et décision Twitch → 30 foundation/rehearsal → 31 cutover distinct → 32 validation finale. Tous les numéros sont conservés. Le propriétaire veut achever Arcade et les commandes avant la finition transverse : 27 est différée après 29, pas abandonnée. Les contrats spécialisés définissent la cible ; le Master seul porte les statuts et prochaines actions.

## Principe final

Cette roadmap indique **où le projet va**.

Le Master indique **où le projet en est maintenant**.
