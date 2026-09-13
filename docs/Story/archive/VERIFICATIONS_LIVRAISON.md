# Vérifications de la livraison v1.1

Ce rapport décrit uniquement la livraison du 13 septembre 2026. Il ne se met pas à jour avec les modifications ultérieures de l’histoire.

## Contenu

90 blocs identifiés, 22 événements de chronologie, 18 chapitres (0 à 17), 6 régions et 7 arbitrages ouverts. Les orientations explicitement posées, les propositions et leur provenance restent distinguées.

## Contrôles exécutés

Le générateur a été exécuté sur Node.js 22.16.0, sous Linux. Les commandes Windows figurent dans le README ; elles n’ont pas été exécutées sur le poste de l’utilisateur. Les scénarios ci-dessous ont été exécutés sur une copie temporaire, sans altérer la source de livraison.

| Cas | Résultat |
|---|---|
| Génération nominale et source inchangée | OK |
| Dépendances directes et indirectes | OK |
| Bloc complet à copier | OK |
| Modification : vues périmées détectées puis régénérées ; Word signalé ancien | OK |
| JSON invalide : arrêt sans altération des vues | OK |
| Identifiant dupliqué : arrêt sans altération des vues | OK |
| Référence inexistante : arrêt sans altération des vues | OK |
| Balise de fin manquante : arrêt sans altération des vues | OK |
| Statut inconnu : arrêt sans altération des vues | OK |
| Fins de ligne Windows CRLF | OK |
| Identifiant inconnu en lecture seule | OK |
| Modification manuelle d’une vue détectée et réparée | OK |

L’export Word a été produit depuis la même source et son empreinte est enregistrée dans `exports/EXPORT.json`. Le document a été rendu en 27 pages puis toutes ses pages ont été inspectées visuellement. Les tableaux répètent leur en-tête lorsqu’ils se prolongent sur la page suivante. Les fichiers de rendu utilisés pour le contrôle ne sont pas inclus dans le dossier livré.

## Ce qui n’est pas automatisé

Les tests contrôlent la structure des blocs, les références, les sorties et les erreurs de format. Ils ne prouvent pas la cohérence philosophique d’un voyage temporel ni la qualité des motivations. Les audits narratifs identifient les cas à relire et les réponses de fiction retenues.

Une modification des règles exige encore de relire ses conséquences. Un export Word ultérieur demande un nouveau contrôle de mise en page.

## Périmètre des modifications

La livraison contient uniquement des fichiers de documentation et les outils de génération associés. Aucun script du jeu, JSON de sauvegarde, service en ligne, dépôt GitHub, branche ou commit n’a été modifié. L’original v1.0 archivé provient de la pièce jointe de la conversation.
