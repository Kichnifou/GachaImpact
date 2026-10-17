# Maintenance post-V1 — Concours, fiche personnage et Légendes

Mandat [consolidé](post-v1-maintenance-20261017.md), sous-lots B/C/D et complément propriétaire du 17/10 sur l'alignement des récompenses. Décision R1103 ; l'état de livraison appartient au Master.

## Résultat et titres historiques

La projection des participants terminés utilise le rang de la promotion persistée dans ce Concours, lié au slot et au Player. Sans promotion, elle conserve le snapshot de lancement. Aucun score, rang final, récompense ou snapshot utilisé pour les calculs n'est modifié. Une progression acquise dans un Concours ultérieur ne réécrit jamais l'ancien résultat. Le même présentateur couvre dernier résultat, relecture et historique depuis un autre joueur.

Les cartes terminées affichent la récompense de classement avant le titre. Un footer commun réserve la ligne de titre, y compris sans titre ; les récompenses restent sur le même axe dans chaque rangée. Les cartes actives et lobby gardent leurs contrôles. Le scroll du résultat reste porté par `contest-scroll-body`, préexistant ; aucun scroll n'est déplacé vers le parent.

## Fiche d'un personnage possédé

La projection Box existante lit les cinq planchers de titre avec les statistiques C6 dans son unique lecture groupée. `c6CompetitionStats.titles` contient seulement les titres obtenus, par thème/rang. La lecture d'un personnage après Stella/favori utilise la même projection. La projection Box publique du Profil continue d'omettre tout ce bloc : aucune fuite de progression par cette voie.

R1108 a retiré le disclosure sous la constellation. R1109 restaure les cadres statistiques de référence3bd16ae7 (dimensions, padding8px, gaps8px, typographies), et place chaque badge sous son propre cadre dans une colonne en flux normal, sans badge vide ni nouvelle section. Le badge ne change jamais la hauteur du cadre. La marge inférieure existante est réutilisée sur desktop ; sur mobile les badges suivent les colonnes de la grille existante. Dimensions de la modale et du portrait conservées pour0/1/5titres ; animations Stella +1 ancrées au cadre correspondant. Une nouvelle ouverture de la Box charge sa projection autoritaire existante ; aucune requête par carte/rendu ni F5 nécessaire. Le scrollbar mobile de la modale reste celui déjà prévu par le contrat UI.

## Profil : onglet Légendes

**R1111 :** toute compaction du haut de page est retirée. Header, commandes et onglets gardent exactement le cadre Box. Desktop : panneau extérieur identique ; mobile : propriétaire confirme le flux existant, haut/largeur identiques et hauteur totale selon contenu. Seul le body reçoit la pagination. Aucun changement Box ou autres onglets. [Comparaison](evidence/r1111-combat-maintenance.json).

L’onglet suit Box et garde sa destination persistable propre. R1110 supersède la composition R1109 : portrait/nom/C6, totaux puis cinq cellules thématiques réunissant score, titre coloré obtenu ou Sans titre neutre et compteurs. Aucun nombre métier modifié.

BOX contrôle la liste, GENERAL_STATISTICS ses détails, sans élargissement de droits ni portrait déduit de données interdites. Mesure des mêmes cartes/styles à trois largeurs, maximum de tous les contenus, footer réel et sécurité2px. Aucun héritage de densité : priorité3cartes puis2puis1 ; si une carte complète ne tient pas, pages de thèmes mesurées sur toutes les partitions. Footer séparé, page partielle de même largeur, aucun overflow masquant du contenu réel. ResizeObserver, resize, chargements images/fonts requalifient la capacité. Ancre conservée au resize, page stable au refresh, reset au changement de joueur/liste/confidentialité. Mobile : région bornée et pages de thèmes si nécessaire, flux de document préexistant pour atteindre le Profil, aucun scroll interne Légendes.

**Erratum R1110 : Profil → Box totalement hors périmètre et strictement inchangé**, y compris sa scrollbar. Les autres onglets et conteneurs partagés ne changent pas. [Preuves R1110](evidence/r1110-profile-legends.json), dont1920×980 et comparaison stricte Box aux septformats/Chat ouvert-replié.

## R1108 — présentation des scores et titres

Les nombres visibles soustraient uniquement les gains serveur en attente. Le score change au keyframe d’impact18% de sa propre animation, jamais avant celle d’un bot futur. Événements ordonnés/dédupliqués ; donnée manquante, reconnexion, onglet masqué, mouvement réduit ou échéance proche convergent immédiatement. Aucun résultat d’action recalculé, score serveur inchangé et aucune permission bloquée pour une animation.

Un badge commun distingue Bronze/cuivre, Argent, Or et Platine sur Mes Légendes, fiche et Profil. Aucun titre non acquis coloré. Profil Box : footer Cn compact, portraits conservés, ouverture clavier/clic. Propriétaire : vraie Box et mêmes caches/actions/intents ; tiers : projection Profil déjà autorisée uniquement, aucun appel Box privée, favori/Stella/expédition ou mutation. BOX privée ferme la fiche ; GENERAL_STATISTICS privée masque titres et statistiques. Focus/Échap/restauration utilisent le dialogue commun.

## Qualification historique R1103

- PostgreSQL, schémas privés créés/nettoyés : Concours 26/26, Box 2/2, confidentialité Social ciblée 1/1 (9 scénarios hors cible exclus, pas réussis). Le test de seuil parcourt Bronze/Argent/Or/Platine, relit le résultat et l'historique après évolution ultérieure ; les snapshots restent inchangés.
- UI ciblée : 82/82. Full initial 7/8 : timeout du test Arcade HARD sous forte concurrence locale. Suite Arcade isolée 31/31 ; full rejouée avec `VITEST_MAX_WORKERS=4` : 8/8, aucun timeout augmenté ni assertion affaiblie. Ce réglage concerne seulement la commande de vérification locale.
- GameShell synthétique compilé/CSS production sous Edge local : 1920×1080, 1366×768, 390×844 et 390×600. Cinq titres, disclosure de taille stable, onglet séparé, droits privés et état vide, alignement des récompenses avec titre absent vérifiés. Captures sous `local-data/shop-feedback-qa/`, non commitées ; preuve agrégée versionnée.
- Aucun compte public muté, aucune récompense/participation publique de QA, aucune migration. Recette propriétaire non acquise. Review GitHub, promotion et déploiements ne sont acquis que selon le Master et le bilan réel.
