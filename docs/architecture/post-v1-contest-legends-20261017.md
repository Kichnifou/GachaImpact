# Maintenance post-V1 — Concours, fiche personnage et Légendes

Mandat [consolidé](post-v1-maintenance-20261017.md), sous-lots B/C/D et complément propriétaire du 17/10 sur l'alignement des récompenses. Décision R1103 ; l'état de livraison appartient au Master.

## Résultat et titres historiques

La projection des participants terminés utilise le rang de la promotion persistée dans ce Concours, lié au slot et au Player. Sans promotion, elle conserve le snapshot de lancement. Aucun score, rang final, récompense ou snapshot utilisé pour les calculs n'est modifié. Une progression acquise dans un Concours ultérieur ne réécrit jamais l'ancien résultat. Le même présentateur couvre dernier résultat, relecture et historique depuis un autre joueur.

Les cartes terminées affichent la récompense de classement avant le titre. Un footer commun réserve la ligne de titre, y compris sans titre ; les récompenses restent sur le même axe dans chaque rangée. Les cartes actives et lobby gardent leurs contrôles. Le scroll du résultat reste porté par `contest-scroll-body`, préexistant ; aucun scroll n'est déplacé vers le parent.

## Fiche d'un personnage possédé

La projection Box existante lit les cinq planchers de titre avec les statistiques C6 dans son unique lecture groupée. `c6CompetitionStats.titles` contient seulement les titres obtenus, par thème/rang. La lecture d'un personnage après Stella/favori utilise la même projection. La projection Box publique du Profil continue d'omettre tout ce bloc : aucune fuite de progression par cette voie.

R1108 a retiré le disclosure sous la constellation. R1109 restaure les cadres statistiques de référence3bd16ae7 (dimensions, padding8px, gaps8px, typographies), et place chaque badge sous son propre cadre dans une colonne en flux normal, sans badge vide ni nouvelle section. Le badge ne change jamais la hauteur du cadre. La marge inférieure existante est réutilisée sur desktop ; sur mobile les badges suivent les colonnes de la grille existante. Dimensions de la modale et du portrait conservées pour0/1/5titres ; animations Stella +1 ancrées au cadre correspondant. Une nouvelle ouverture de la Box charge sa projection autoritaire existante ; aucune requête par carte/rendu ni F5 nécessaire. Le scrollbar mobile de la modale reste celui déjà prévu par le contrat UI.

## Profil : onglet Légendes

L'onglet « Légendes » suit « Box » et possède sa destination persistable propre. La liste brute est retirée de Box, ses filtres et ancres sont conservés. R1109 revient aux cartes verticales R1103 : portrait/nom/C6, cinq petits blocs de statistiques sur plusieurs lignes, totaux, puis cinq thèmes verticaux avec badge obtenu coloré ou Sans titre neutre et compteurs ; états vides/privés explicites.

La liste reste soumise à BOX et les détails à GENERAL_STATISTICS, côté service existant. L'onglet n'élargit aucun droit. BOX privé masque toute Légende ; BOX autorisé/statistiques privées autorise seulement les noms/portraits déjà publics, jamais les titres ni statistiques. Les portraits ne sont pas déduits depuis des données interdites. La pagination R1108 est conservée et adaptée en R1109 : priorité3cartes côte à côte, puis2ou1 selon largeur et hauteur utiles, footer mesuré et hauteurs maximales des contenus complets. Mesure des trois largeurs candidates, densité normale avant compaction lisible ; aucun overflow masqué sur les cartes réelles. À1366×768, seuls le titre et les commandes propres à cet onglet se resserrent pour libérer la place nécessaire. Le mobile garde le flux de page existant, une carte par page et aucun scroll interne de carte. Ancre de Légende conservée au resize, page stable au refresh ordinaire, reset sur changement de joueur/liste/confidentialité. Les autres onglets restent inchangés.

## R1108 — présentation des scores et titres

Les nombres visibles soustraient uniquement les gains serveur en attente. Le score change au keyframe d’impact18% de sa propre animation, jamais avant celle d’un bot futur. Événements ordonnés/dédupliqués ; donnée manquante, reconnexion, onglet masqué, mouvement réduit ou échéance proche convergent immédiatement. Aucun résultat d’action recalculé, score serveur inchangé et aucune permission bloquée pour une animation.

Un badge commun distingue Bronze/cuivre, Argent, Or et Platine sur Mes Légendes, fiche et Profil. Aucun titre non acquis coloré. Profil Box : footer Cn compact, portraits conservés, ouverture clavier/clic. Propriétaire : vraie Box et mêmes caches/actions/intents ; tiers : projection Profil déjà autorisée uniquement, aucun appel Box privée, favori/Stella/expédition ou mutation. BOX privée ferme la fiche ; GENERAL_STATISTICS privée masque titres et statistiques. Focus/Échap/restauration utilisent le dialogue commun.

## Qualification historique R1103

- PostgreSQL, schémas privés créés/nettoyés : Concours 26/26, Box 2/2, confidentialité Social ciblée 1/1 (9 scénarios hors cible exclus, pas réussis). Le test de seuil parcourt Bronze/Argent/Or/Platine, relit le résultat et l'historique après évolution ultérieure ; les snapshots restent inchangés.
- UI ciblée : 82/82. Full initial 7/8 : timeout du test Arcade HARD sous forte concurrence locale. Suite Arcade isolée 31/31 ; full rejouée avec `VITEST_MAX_WORKERS=4` : 8/8, aucun timeout augmenté ni assertion affaiblie. Ce réglage concerne seulement la commande de vérification locale.
- GameShell synthétique compilé/CSS production sous Edge local : 1920×1080, 1366×768, 390×844 et 390×600. Cinq titres, disclosure de taille stable, onglet séparé, droits privés et état vide, alignement des récompenses avec titre absent vérifiés. Captures sous `local-data/shop-feedback-qa/`, non commitées ; preuve agrégée versionnée.
- Aucun compte public muté, aucune récompense/participation publique de QA, aucune migration. Recette propriétaire non acquise. Review GitHub, promotion et déploiements ne sont acquis que selon le Master et le bilan réel.
