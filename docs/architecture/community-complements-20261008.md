# R1056 / 31B — compléments communautaires, 08/10/2026

## Périmètre et état

Continuation depuis e9967ae, rectifications propriétaire intégrées. Quatre canaries NATIVE/CANARY révision 12, GLOBAL false ; aucun import, OAuth, choix R1055, transfert de progression, restauration publique ou batch43 exécuté dans ce lot. Les preuves brutes, UUID, identités Twitch, manifests, hashes individuels et backups restent dans les dossiers locaux ignorés, préservés.

<a id="visibilite-archive"></a>

## Visibilité des archives — lot A

[R1059](../specifications/decisions-log.md) précise R1055. Lecture PostgreSQL READ ONLY : A « Céo » ARCHIVED sans WebIdentity/TwitchIdentity ; B enregistré « Ceotryd », désigné Céotryd par le propriétaire, ACTIVE. WebIdentity initiale sur B, TwitchIdentity immuable conservée, résolution terminée TWITCH avec A perdant et B gagnant, import DATA_IMPORTED et target NATIVE vérifiés. Aucun changement de nom nécessaire, aucun matching par seul pseudonyme.

| Owner / projection | Traitement |
| --- | --- |
| Event actuel | Exclusion ARCHIVED dans la requête avant Top 10 ; même filtre pour participation propre et comptage du rang. |
| Historique Event | Exclusion dans la lecture des participants avant tri/rang/Top 10 ; compte visible et détail personnel cohérents. Éditions, inscriptions, claims et acquisitions conservés. |
| Boss actuel / histoire / classement | Exclusion ARCHIVED des rangs ; coups, dégâts globaux et preuves conservés. Coup final et record de coup attribués à une archive : texte neutre, sans lien de profil. |
| Giveaway état / classement | Participants et chatteurs visibles filtrés en base avant classement ; gagnant et organisateur archivés présentés neutralement. Récompenses et annonces figées conservées. |
| Concours | Classement de résultat figé, scores, slots et récompenses conservés ; identité archivée neutralisée dans résultat, liste et détail historique. Aucun lien de profil dans ces surfaces. |
| Arcade | Classements déjà limités aux ACTIVE ; résultat personnel partagé conservé, adversaire archivé neutralisé. |
| Classements globaux, recherche / profils publics, contacts / présence | Owners existants limités aux ACTIVE : pas de nouveau filtre ni changement des SUSPENDED. |
| Bannières / votes | Historique public constitué de personnages et snapshots agrégés, sans profils de votants. Préserver les votes et les snapshots figés ; aucune réécriture d'un résultat de rotation. |
| Chats, MP, récompenses, claims et opérations historiques | Preuves/auteurs conservés, aucun déplacement A→B. Les accès au profil public restent refusés par l'owner aux comptes non ACTIVE. |

Tests PostgreSQL locaux en schémas privés : défaut de classement Event et Giveaway reproduit, scénarios A ARCHIVED / B ACTIVE, pseudonymes inversés, Top 10 rempli, rang personnel hors Top 10, tout ARCHIVED, SUSPENDED inchangé, historique Event sans suppression de claims, Boss sans réattribution du coup final, Giveaway sans création de récompense. Résultats Concours/Arcade vérifient neutralisation et conservation physique des résultats/événements et ressources des tiers. Deux fixtures préexistantes corrigées : initialiser le gameplay avant archivage ; comparer le registre Prisma à tous les dossiers actuels plutôt qu'à 60 migrations. Aucun garde-fou métier affaibli.

Validation : 90 tests PostgreSQL pertinents PASS ; `verify:full` 8/8 PASS (tests non-DB, builds, typechecks, lint et diff-check). La recette visuelle locale utilise le GameShell complet et les CSS de production, données synthétiques et aucune session publique : classement Event et historique Event, Top 10 rempli et tout ARCHIVED/vide, desktop 1366×768 et mobile 390×844, huit états capturés, zéro erreur JS/requête externe/débordement horizontal. Les images sont inspectées séparément des assertions. Les contrôles de déploiement restent séparés ; une réussite locale ne constitue pas une validation publique.

## Sources récentes et restauration — analyse en cours

Le ZIP propriétaire et les snapshots récents sont accessibles et préservés. La comparaison fichier par fichier et les sources exactes des quatre imports feront l'objet du lot B ; aucune conclusion de fraîcheur fondée seulement sur les copies Git d'août. Les gates de restauration économique, conflit de bannière native et préservation des plans opérateur restent obligatoires.
