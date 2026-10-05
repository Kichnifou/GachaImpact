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

Avant d'ouvrir une étape suivante, vérifier dans le Master que le lot précédent a atteint le niveau de review, de déploiement et de validation publique requis. Une étape close côté implémentation peut conserver des scénarios naturels à observer : les classer selon R1034 comme observations bêta/situation réelle non bloquantes, sans les déclarer testés ni les reclasser comme dette de code.

La clôture de l’étape 25 passe par la review indépendante, la promotion technique, le contrôle du déploiement exact (dont 059 via le predeploy Railway) et une recette publique ciblée Aide/Help/!legende, Menu/icône Catalogue, tracker et titres Profil. Le Master porte la validation explicite propriétaire de 26 ; une présence sur main ne remplace pas les preuves de recette. R1034 supersède R1032 après 28 : 26 et 28 validées/clôturées, 27 clôturée par décision de périmètre, puis 29 clôturée R1039 → 30 clôturée R1041 → pilote Kichnifou R1042/R1043 validé → polish R1044/R1045 → bridge Twitch complet R1047 → récupération standalone Twitch-only R1046 → recette de parité/autorité → 31A Ceo → 31B batch → 32 ; numéros conservés.

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
13. **Top / classements globaux** — fonctionnellement validés publiquement ; micro-polish R912 approuvé en review indépendante, observation visuelle restante acceptée en bêta/non bloquante (R1034), sans test public inventé.
14. **Historique global** — fonctionnellement validé publiquement ; R912 approuvé en review indépendante ; polish et prochain snapshot naturel R911 acceptés en bêta/situation réelle, non bloquants (R1034), sans test public inventé.
15. **Apparence / avatars / titres** — socle et correctifs R913–R915 promus, titres de niveau cadrés R1025 ; les parcours publics explicitement rapportés (Personnalisation/avatars possédés, backfill, avatar élémentaire et sélecteurs Event/Échanges/Modération) sont consignés dans le [Master](../master/PROJECT_MASTER_PLAN.md), sans validation exhaustive publique présumée ; le catalogue de titres validé relève de R1025.
16. **Liaison TwitchIdentity** — identité stable et pilote unlink/relink/preview/import promus et validés publiquement selon le [Master](../master/PROJECT_MASTER_PLAN.md) ; le cutover global reste distinct.
17. **Commandes et événements Twitch — gate transport avant Faveur, puis pause R942** — les phases observation-only/transport et leur validation publique sont décrites dans le [Master](../master/PROJECT_MASTER_PLAN.md). Le gate réception, plusieurs chatters et disable/unlink précède le domaine 18 ; Twitch avancé reste différé. Aucun enchaînement immédiat XP/commandes/réponses/mirroring/outbound. Deux chats distincts possibles, services/XP/cooldown/parser partagés en cible ; parité des réponses `.txt` à valider dans le standalone avec Kichnifou puis par le propriétaire avant éventuel outbound. Charge/performance relève désormais des observations bêta non bloquantes R1034, 27 étant clôturée par périmètre ; la passe exhaustive commandes/sorties et préparation de bascule transparente relèvent de 29 ACTIVE, sans activation Twitch. Voir [la dette commandes](../commands/command-reference.md#passe-finale-twitch--commandes-r939r942). Streamer.bot reste autoritatif, sans cutover.
18. **Faveur de l’Astre** — implémenter [18-faveur-subscription-audit.md](../legacy/18-faveur-subscription-audit.md).
19. **Gift Suprême** — implémenter [20-gift-twitch-audit.md](../legacy/20-gift-twitch-audit.md).
20. **Giveaway / Wish** — implémenter [21-giveaway-wish-audit.md](../legacy/21-giveaway-wish-audit.md).
21. **Compléments Notifications transversaux** — finaliser les producteurs, résolutions et deep-links inter-domaines.
22. **Administration / Modération complète** — achever les outils privés nécessaires aux domaines physiques.
23. **Mini-jeux XP interface** — concevoir les vrais mini-jeux cadrés dans [04-xp-audit.md](../legacy/04-xp-audit.md), sans transformer les activités ordinaires en source XP.
24. **Accueil dynamique et résumé Quotidiennes/sidebar final** — consolider [11-missions-daily-audit.md](../legacy/11-missions-daily-audit.md) et [navigation-shell-v1.md](../specifications/navigation-shell-v1.md).
25. **Tutoriel interactif, Help textuel et Aide standalone distincts** — Tutoriel de 116 étapes/24 chapitres/21 écrans avec reprise/replay manuels depuis Menu/Aide selon [tutorial-v1.md](../specifications/tutorial-v1.md) ; R1033 ajoute un unique autostart rétroactif par Player via PlayerPreference, sans nouveau ScreenId/route écran ni autostart récurrent. Help R728–R731 selon [l’audit](../legacy/23-help-command-coherence-audit.md), Guide R1026 selon [help-guide-v1.md](../specifications/help-guide-v1.md). Aucune nouvelle étape Tutoriel ; statut technique/public au Master.

### Séquence d'exécution finale — numéros conservés (R1034)

R1034 supersède R1032 après 28 : 26 VALIDÉE / CLÔTURÉE, 28 VALIDÉE / CLÔTURÉE PAR LE PROPRIÉTAIRE après recette finale, 27 CLÔTURÉE PAR DÉCISION DE PÉRIMÈTRE PROPRIÉTAIRE. Cette dernière clôture ne prouve aucune exécution des travaux historiquement envisagés. Les observations rares/profondes restent acceptées en bêta/situation réelle, non bloquantes ; maintenance non implémentée en backlog post-V1. Un défaut réellement observé ouvre un correctif borné. Ordre opérationnel après la recette R1042/R1043 : **polish R1044/R1045 → bridge Twitch complet R1047 → claim standalone R1046 → recette Kichnifou de parité/autorité → 31A Ceo → 31B batch → 32**. Les numéros restent stables, 31 conserve deux sous-phases ; ces lots sont des gates avant 31A, pas de nouveaux numéros de roadmap.

| Étape | État / périmètre courant |
| --- | --- |
| 26 | **VALIDÉE / CLÔTURÉE** — recette fonctionnelle et économie/progression acquises ; observations rares reclassées selon R1034, sans preuve inventée. |
| 28 | **VALIDÉE / CLÔTURÉE PAR LE PROPRIÉTAIRE** — trois jeux/trois difficultés, invitations/sessions partagées, score des deux/0 XP, Quitter et optimisations, notification initiale seule, Rejouer SOLO et PvP manuel ; cinq contrôles finaux reçus au Master. |
| 27 | **CLÔTURÉE PAR DÉCISION DE PÉRIMÈTRE PROPRIÉTAIRE** — fonctionnement jugé stable, sans prétendre que toute la finition/rétention/charge a été implémentée ou exécutée. Aucun nouveau scheduler/cadence/Serverless/optimisation coût/campagne exhaustive imposé. Politique de rétention valide ; non implémenté = maintenance post-V1/besoin réel. |
| 29 | **CLÔTURÉE PAR DÉCISION PROPRIÉTAIRE R1039** — adaptation Chat des 37 sources et recette représentative acquises ; exception de promotion directe terminée. Correctif de présentation Pull R1040 intégré au candidat 30, sans rouvrir 29. |
| 30 | **TERMINÉE — FOUNDATION / REHEARSAL PRIVÉE R1041**. 43 identités Helix vérifiées + deux quarantaines propriétaires exactes, zéro autre blocker ; rehearsal réelle, rollback, second import identique, backup/restauration, fixtures et contrôles complets PASS. 17 sources/0 inconnu, plan avant purge de 117 tables ; source des deux différés conservée, aucune création fantôme. Gate missing toujours bloquant sans autorisation explicite. Aucune écriture publique ni activation Twitch. État/preuves au Master et [contrat](../architecture/legacy-migration-v1.md). |
| Gate avant 31A | **R1042/R1043 VALIDÉ PUBLIQUEMENT ; POST-PILOTE ACTIF.** EventSub/outbound/kill switch et Pull 1..10 prouvés avec Kichnifou ; Streamer.bot rétabli après recette. Restent obligatoires avant 31A : R1044 refresh externe, R1045 phrases Pull, R1047 toutes commandes + triggers messages ordinaires, R1046 claim web d’un Twitch-only, puis recette finale de parité et autorité durable. [Master](../master/PROJECT_MASTER_PLAN.md) et [runbook](../process/legacy-cutover-runbook.md). |
| 31 | **À FAIRE — 31A CANARY CEO puis 31B BATCH** — import réel Ceo uniquement/périmètre explicitement borné, comparaison données personnelles et partagées pertinentes, commandes natives ciblées, autorité unique et rollback propre ; autres Players Streamer.bot. Batch seulement après validation propriétaire Ceo, capture/rehearsal adaptée, identités vérifiées ou quarantaines explicites R1041 visibles au plan, zéro autre blocker, agrégats et transfert d'autorité/désactivation des chemins remplacés. Les profils quarantainés ne sont pas importés tant qu'aucun ID n'est vérifié ; ils ne bloquent ni le pilote Kichnifou-only ni 31A. Aucune bascule globale automatique. [Runbook](../process/legacy-cutover-runbook.md). |
| 32 | **À FAIRE — validation finale V1** — smoke après batch/cutover, parcours principaux/anomalies bêta réellement observées/stabilité. Aucune obligation de fabriquer les situations rares non survenues. |

## Sujet hors séquence obligatoire

**Objectifs personnels** reste `FUTUR / PÉRIMÈTRE V1 À TRANCHER`. Aucune position obligatoire dans la trajectoire ci-dessus ne lui est attribuée tant que le propriétaire n’a pas statué.

## Vérité UI et dé-mock progressif

La V0 peut conserver temporairement des mocks pour les domaines non implémentés. Dès qu’un domaine V1 devient réel, toute zone UI correspondante doit consommer les données serveur réelles. Une valeur fictive ne doit jamais être présentée comme l’état réel du joueur.

Le remplacement se fait domaine par domaine, en adaptant l’interface existante sans reconstruire inutilement toute la V0.
