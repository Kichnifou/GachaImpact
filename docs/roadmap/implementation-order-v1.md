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
   - Récompense quotidienne, Roue, missions quotidiennes, Combat, Expédition et futur écran Quotidiennes.
   - Le choix UX du raccourci/carrousel de quotidiennes sur l’Accueil reste reporté à une décision du propriétaire.

## Gates du checkpoint courant

Concours / personnages C6 et Collection / Sac ont franchi leur checkpoint public, avec les réserves techniques conservées dans le Master. Le candidat local 0.97 matérialise désormais Codes cadeaux ; sa review indépendante, sa promotion et sa validation publique restent requises avant d’ouvrir Événements mensuels. Expedition READY/notification/claim naturel reste une validation publique transverse ouverte ; son état vivant appartient uniquement au Master.

## Trajectoire V1 restante après Boss

1. **Concours / personnages C6** — implémenté et validé publiquement, avec le polish de scrollbar/confirmations inclus au candidat 0.97.
2. **Collection / Sac à compléter** — implémenté et validé publiquement en 0.96 ; R864 reste technique jusqu’à un producteur Event réel et les images Collection sont reportées.
3. **Codes cadeaux** — candidat local 0.97 physiquement implémenté selon [19-codes-cadeaux-audit.md](../legacy/19-codes-cadeaux-audit.md), en attente de review indépendante puis validation publique.
4. **Événements mensuels** — implémenter [16-event-monthly-audit.md](../legacy/16-event-monthly-audit.md).
5. **Votes de bannière communautaires** — compléter le domaine cadré dans [06-gacha-invocation-audit.md](../legacy/06-gacha-invocation-audit.md).
6. **Profils joueurs / annuaire / présence** — suivre [14-ami-social-audit.md](../legacy/14-ami-social-audit.md).
7. **Confidentialité et consultations publiques autorisées** — appliquer les règles de [14-ami-social-audit.md](../legacy/14-ami-social-audit.md).
8. **Amitié** — implémenter le sous-domaine de [14-ami-social-audit.md](../legacy/14-ami-social-audit.md).
9. **Échanges de particules** — croiser [05-element-resources-audit.md](../legacy/05-element-resources-audit.md) et les relations sociales autorisées.
10. **Chat global et messages privés** — suivre [14-ami-social-audit.md](../legacy/14-ami-social-audit.md), avec logique métier serveur partagée.
11. **Missions permanentes B / A / S / Z** — implémenter [11-missions-daily-audit.md](../legacy/11-missions-daily-audit.md).
12. **Statistiques générales** — consolider les projections transversales avant les classements.
13. **Top / classements globaux** — implémenter [22-top-classements-audit.md](../legacy/22-top-classements-audit.md).
14. **Historique global** — créer la surface transverse unique prévue, sans dupliquer les historiques métier locaux utiles.
15. **Apparence / avatars / titres** — intégrer ces choix aux profils selon [14-ami-social-audit.md](../legacy/14-ami-social-audit.md).
16. **Liaison TwitchIdentity** — préparer l’identité stable selon [14-ami-social-audit.md](../legacy/14-ami-social-audit.md) et [03-command-data-matrix.md](../legacy/03-command-data-matrix.md).
17. **Commandes et événements Twitch** — brancher les contrats de [command-reference.md](../commands/command-reference.md) sur les services métier communs ; Streamer.bot reste absent.
18. **Faveur de l’Astre** — implémenter [18-faveur-subscription-audit.md](../legacy/18-faveur-subscription-audit.md).
19. **Gift Suprême** — implémenter [20-gift-twitch-audit.md](../legacy/20-gift-twitch-audit.md).
20. **Giveaway / Wish** — implémenter [21-giveaway-wish-audit.md](../legacy/21-giveaway-wish-audit.md).
21. **Compléments Notifications transversaux** — finaliser les producteurs, résolutions et deep-links inter-domaines.
22. **Administration / Modération complète** — achever les outils privés nécessaires aux domaines physiques.
23. **Mini-jeux XP interface** — concevoir les vrais mini-jeux cadrés dans [04-xp-audit.md](../legacy/04-xp-audit.md), sans transformer les activités ordinaires en source XP.
24. **Accueil dynamique et résumé Quotidiennes/sidebar final** — consolider [11-missions-daily-audit.md](../legacy/11-missions-daily-audit.md) et [navigation-shell-v1.md](../specifications/navigation-shell-v1.md).
25. **Tutoriel interactif et Help final** — suivre [23-help-command-coherence-audit.md](../legacy/23-help-command-coherence-audit.md) et la navigation propriétaire.
26. **Recette fonctionnelle complète et équilibrage économie/progression** — vérifier ensemble les domaines physiques et leurs interactions.
27. **Finition technique et visuelle** — responsive/mobile, accessibilité, sécurité, concurrence, performances et cohérence avec [ui-layout-contract-v1.md](../specifications/ui-layout-contract-v1.md).
28. **Migration pilote legacy** — reprendre les preuves de [01-data-sources-inventory.md](../legacy/01-data-sources-inventory.md), [02-current-player-model.md](../legacy/02-current-player-model.md) et [03-command-data-matrix.md](../legacy/03-command-data-matrix.md) sur un petit ensemble contrôlé.
29. **Migration générale / cutover** — migrer uniquement après validation du pilote et stabilisation des domaines requis.
30. **Validation finale V1** — exécuter la recette publique finale et clôturer les écarts restants.

## Sujet hors séquence obligatoire

**Objectifs personnels** reste `FUTUR / PÉRIMÈTRE V1 À TRANCHER`. Aucune position obligatoire dans la trajectoire ci-dessus ne lui est attribuée tant que le propriétaire n’a pas statué.

## Vérité UI et dé-mock progressif

La V0 peut conserver temporairement des mocks pour les domaines non implémentés. Dès qu’un domaine V1 devient réel, toute zone UI correspondante doit consommer les données serveur réelles. Une valeur fictive ne doit jamais être présentée comme l’état réel du joueur.

Le remplacement se fait domaine par domaine, en adaptant l’interface existante sans reconstruire inutilement toute la V0.
