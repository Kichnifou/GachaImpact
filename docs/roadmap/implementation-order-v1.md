# Ordre d’implémentation V1

## Rôle de ce document

Ce document est le propriétaire de la **séquence de développement V1 actuellement retenue** et de ses dépendances principales.

- [development-roadmap.md](development-roadmap.md) décrit la trajectoire macro du projet.
- Ce fichier décrit l’ordre d’implémentation V1 à suivre progressivement.
- [PROJECT_MASTER_PLAN.md](../master/PROJECT_MASTER_PLAN.md) est le seul document indiquant l’état actuel, le domaine actif et la prochaine étape exacte.

Ce fichier n’est pas un tracker vivant et ne doit pas être modifié pour enregistrer chaque checkpoint. Le Master prévaut lorsqu’un état ou une priorité immédiate change.

## Séquence retenue

1. **Récompense quotidienne réelle**
   - Implémentée et validée publiquement par le propriétaire ; checkpoint fonctionnel clôturé.

2. **Progression Player réelle et dé-mock du profil**
   - XP réelle, niveau réel, état de progression serveur.
   - Remplacer le faux Niveau 42 et l’XP mock de la sidebar.

3. **Catalogue personnages, bannière réelle, sélection de cible et état Gacha**
   - Personnages, rotation/bannière, cible 5★, pity, garantie et Capture de brillance.
   - Remplacer les informations Furina/Gacha mockées visibles dans l’interface.

4. **Invocation x1/x10 réelle**
   - Dépenses réelles de Primogemmes, calcul serveur, pity/garantie/Capture et transaction atomique.
   - L’animation UI intervient seulement après validation serveur.

5. **Collection / Box réelle**
   - Possessions, constellations/copies, favoris et historique nécessaire.

6. **Équipe réelle et passifs**
   - Remplacer l’équipe mock de la sidebar, ajouter l’état Team serveur et les passifs spécifiés.

7. **Banque, Sac, Boutique et économie secondaire**.

8. **Boucle Quotidiennes plus complète**
   - Récompense quotidienne, Roue, missions quotidiennes, Combat, Expédition et écran Quotidiennes.
   - La présentation Accueil/sidebar des Quotidiennes suit le contrat canonique [home-daily-tracker-v1.md](../specifications/home-daily-tracker-v1.md).

## Gates transverses avant une étape suivante

Avant d'ouvrir une étape suivante, vérifier dans le Master que le lot précédent a atteint le niveau de review, de déploiement et de validation publique requis. Une étape close côté implémentation peut conserver des scénarios naturels à observer : les regrouper dans la recette globale 26/32 au Master, sans les reclasser comme dette de code.

La clôture de l’étape 25 passe par la review indépendante, la promotion technique, le contrôle du déploiement exact (dont 059 via le predeploy Railway) et une recette publique ciblée Aide/Help/!legende, Menu/icône Catalogue, tracker et titres Profil. Le Master porte la validation explicite propriétaire de 26 ; une présence sur main ne remplace pas les preuves de recette. La séquence réelle 26→28→29→27→30→31→32 est révisée sous R1032 ; numéros conservés.

## Trajectoire V1 de référence après Boss

Cette séquence inclut les domaines déjà traversés ; elle ne les déclare pas encore candidats ou restants. Seul le Master indique le point atteint.

1. **Concours / personnages C6** — suivre [15-concours-c6-audit.md](../legacy/15-concours-c6-audit.md).
2. **Collection / Sac à compléter** — selon [10-sac-coffre-shop-audit.md](../legacy/10-sac-coffre-shop-audit.md), avec les possessions de [07-box-possession-obtention-audit.md](../legacy/07-box-possession-obtention-audit.md).
3. **Codes cadeaux** — selon [19-codes-cadeaux-audit.md](../legacy/19-codes-cadeaux-audit.md).
4. **Événements mensuels** — selon [16-event-monthly-audit.md](../legacy/16-event-monthly-audit.md).
5. **Votes de bannière communautaires** — compléter le domaine cadré dans [06-gacha-invocation-audit.md](../legacy/06-gacha-invocation-audit.md).
6. **Profils joueurs / annuaire / présence** — suivre [14-ami-social-audit.md](../legacy/14-ami-social-audit.md).
7. **Confidentialité et consultations publiques autorisées** — appliquer les règles de [14-ami-social-audit.md](../legacy/14-ami-social-audit.md).
8. **Amitié** — implémenter le sous-domaine de [14-ami-social-audit.md](../legacy/14-ami-social-audit.md).
9. **Échanges de particules** — croiser [05-element-resources-audit.md](../legacy/05-element-resources-audit.md) et les relations sociales autorisées.
10. **Chat global et messages privés** — suivre [14-ami-social-audit.md](../legacy/14-ami-social-audit.md), avec logique métier serveur partagée.
11. **Missions permanentes B / A / S / Z** — implémenter [11-missions-daily-audit.md](../legacy/11-missions-daily-audit.md).
12. **Statistiques générales** — consolider les projections transversales avant les classements.
13. **Top / classements globaux** — fonctionnellement validés publiquement ; micro-polish R912 approuvé en review indépendante, validation publique visuelle en attente.
14. **Historique global** — fonctionnellement validé publiquement ; R912 approuvé en review indépendante mais validation publique visuelle en attente, prochain snapshot naturel R911 à observer.
15. **Apparence / avatars / titres** — socle et correctifs R913–R915 promus, titres de niveau cadrés R1025 ; les parcours publics explicitement rapportés (Personnalisation/avatars possédés, backfill, avatar élémentaire et sélecteurs Event/Échanges/Modération) sont consignés dans le [Master](../master/PROJECT_MASTER_PLAN.md), sans validation exhaustive publique présumée ; le catalogue de titres validé relève de R1025.
16. **Liaison TwitchIdentity** — identité stable et pilote unlink/relink/preview/import promus et validés publiquement selon le [Master](../master/PROJECT_MASTER_PLAN.md) ; le cutover global reste distinct.
17. **Commandes et événements Twitch — gate transport avant Faveur, puis pause R942** — les phases observation-only/transport et leur validation publique sont décrites dans le [Master](../master/PROJECT_MASTER_PLAN.md). Le gate réception, plusieurs chatters et disable/unlink précède le domaine 18 ; Twitch avancé reste différé. Aucun enchaînement immédiat XP/commandes/réponses/mirroring/outbound. Deux chats distincts possibles, services/XP/cooldown/parser partagés en cible ; parité des réponses `.txt` à valider dans le standalone avec Kichnifou puis par le propriétaire avant éventuel outbound. La recette charge/performance relève de l’étape 27 ; la passe exhaustive commandes/sorties et sa validation propriétaire relève de l’étape 29. Voir [la dette commandes](../commands/command-reference.md#passe-finale-twitch--commandes-r939r942). Streamer.bot reste autoritatif, sans cutover.
18. **Faveur de l’Astre** — implémenter [18-faveur-subscription-audit.md](../legacy/18-faveur-subscription-audit.md).
19. **Gift Suprême** — implémenter [20-gift-twitch-audit.md](../legacy/20-gift-twitch-audit.md).
20. **Giveaway / Wish** — implémenter [21-giveaway-wish-audit.md](../legacy/21-giveaway-wish-audit.md).
21. **Compléments Notifications transversaux** — finaliser les producteurs, résolutions et deep-links inter-domaines.
22. **Administration / Modération complète** — achever les outils privés nécessaires aux domaines physiques.
23. **Mini-jeux XP interface** — concevoir les vrais mini-jeux cadrés dans [04-xp-audit.md](../legacy/04-xp-audit.md), sans transformer les activités ordinaires en source XP.
24. **Accueil dynamique et résumé Quotidiennes/sidebar final** — consolider [11-missions-daily-audit.md](../legacy/11-missions-daily-audit.md) et [navigation-shell-v1.md](../specifications/navigation-shell-v1.md).
25. **Tutoriel interactif, Help textuel et Aide standalone distincts** — Tutoriel de 116 étapes/24 chapitres/21 écrans avec reprise/replay manuels depuis Menu/Aide selon [tutorial-v1.md](../specifications/tutorial-v1.md) ; R1033 ajoute un unique autostart rétroactif par Player via PlayerPreference, sans nouveau ScreenId/route écran ni autostart récurrent. Help R728–R731 selon [l’audit](../legacy/23-help-command-coherence-audit.md), Guide R1026 selon [help-guide-v1.md](../specifications/help-guide-v1.md). Aucune nouvelle étape Tutoriel ; statut technique/public au Master.

### Séquence d'exécution finale — numéros conservés (R1032)

Le propriétaire choisit de terminer Arcade puis la passe commandes avant la finition transverse. L'étape 27 est différée après 29, jamais abandonnée. Étape 26 validée ; 28 déployée et partiellement recettée, reste ACTIVE jusqu'au smoke post-déploiement des correctifs performance/autostart approuvés indépendamment et promus sur main par cette mission. Leur déploiement et nouvelle recette restent à vérifier. 29 reste NON commencée, suivante après recette 28 selon le Master. Les numéros ci-dessous sont des IDs stables, pas des positions ordinales.

| Étape | Périmètre dans l'ordre réel |
| --- | --- |
| 26 | **Recette fonctionnelle complète et économie/progression** — validation explicite du propriétaire ; observations naturelles impossibles reportées à 32 selon le Master, sans gap ni nouvelle campagne. |
| 28 | **Multijoueur Arcade** — extension des trois jeux/trois difficultés selon [arcade-v1.md](../specifications/arcade-v1.md#multijoueur-arcade--étape-28), avec invitations, sessions partagées, scores des deux et zéro XP. Statut technique/public au Master. |
| 29 | **Passe exhaustive de toutes les commandes !** — inventorier racines et aliases, exercer toutes les syntaxes/sous-commandes réellement disponibles, préconditions/permissions/canaux, erreurs et sorties exactes ; comparer les .txt, tester d’abord dans le Chat standalone avec Kichnifou puis obtenir la validation propriétaire. Décider ensuite de l’outbound/documentation définitive Twitch, jamais avant. Cette passe précède toute migration globale. |
| 27 | **Finition technique et visuelle / rétention / maintenance** — responsive/mobile, accessibilité, sécurité, concurrence, performances et cohérence avec [ui-layout-contract-v1.md](../specifications/ui-layout-contract-v1.md). Implémenter la [politique canonique de rétention](../specifications/data-retention-v1.md) après vérification domaine par domaine (statistiques, FK, états, claims, idempotence, audit/provenance) et prévoir la maintenance DB ; les autres purges ne sont pas déjà codées. Passe finale Twitch : recette de charge/performance, cible messages ordinaires en mémoire sans historique inutile, validation de charge XP/parser et décision de conservation Twitch ; la parité `.txt`, les tests des commandes et textes standalone Kichnifou puis leur validation propriétaire relèvent de 29 avant éventuel outbound. La conservation définitive de Twitch reste conditionnée à cette recette et à la décision propriétaire. |
| 30 | **Migration foundation / rehearsal** — bâtir les modèles et mappings globaux, couvrir les 17 sources, résoudre les identités Twitch, produire un plan de purge et répéter le snapshot complet en schéma privé selon [le contrat canonique](../architecture/legacy-migration-v1.md). Le premier import public du seul pilote Kichnifou a réussi ; il ne constitue pas le cutover global. |
| 31 | **Migration finale / cutover — mission distincte** — capturer le snapshot final, refaire couverture/résolution/répétition, valider le plan et suivre le [runbook](../process/legacy-cutover-runbook.md) avant toute purge/import de Players publics. Streamer.bot reste autoritatif jusque-là. |
| 32 | **Validation finale V1** — exécuter la recette publique finale et clôturer les écarts restants. |

## Sujet hors séquence obligatoire

**Objectifs personnels** reste `FUTUR / PÉRIMÈTRE V1 À TRANCHER`. Aucune position obligatoire dans la trajectoire ci-dessus ne lui est attribuée tant que le propriétaire n’a pas statué.

## Vérité UI et dé-mock progressif

La V0 peut conserver temporairement des mocks pour les domaines non implémentés. Dès qu’un domaine V1 devient réel, toute zone UI correspondante doit consommer les données serveur réelles. Une valeur fictive ne doit jamais être présentée comme l’état réel du joueur.

Le remplacement se fait domaine par domaine, en adaptant l’interface existante sans reconstruire inutilement toute la V0.
