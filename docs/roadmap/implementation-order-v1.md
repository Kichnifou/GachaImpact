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

9. **Migration pilote legacy**
   - Kichnifou d’abord, puis quelques profils représentatifs ; migration générale seulement après validation.

10. **Social standalone**
    - Chat interne, présence, amis, notifications et confidentialité.

11. **Twitch**
    - Liaison `TwitchIdentity`, commandes et logique métier partagée UI/chat/Twitch.
    - Streamer.bot reste absent de la nouvelle architecture.

12. **Stabilisation**
    - Responsive/mobile, sécurité, concurrence, performance, équilibrage et migration générale lorsqu’elle est prête.

## Vérité UI et dé-mock progressif

La V0 peut conserver temporairement des mocks pour les domaines non implémentés. Dès qu’un domaine V1 devient réel, toute zone UI correspondante doit consommer les données serveur réelles. Une valeur fictive ne doit jamais être présentée comme l’état réel du joueur.

Le remplacement se fait domaine par domaine, en adaptant l’interface existante sans reconstruire inutilement toute la V0.
