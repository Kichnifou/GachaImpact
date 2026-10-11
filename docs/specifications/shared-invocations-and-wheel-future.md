# Invocations partagées et Roue animée — demandes du 11/10/2026

Le lot C Invocations partagées est implémenté localement dans le mandat consolidé R1067–R1075 ; sa livraison reste distincte et suit A/B. Le [contrat V1](../architecture/shared-invocations-v1.md) décrit les décisions validées, le transport, la projection, les gardes transactionnelles, la reprise et les limites. Le lot D Roue est lui aussi implémenté et vérifié localement dans sa mission distincte ; son [contrat spécialisé](wheel-graphic-v1.md) supersède la proposition initiale ci-dessous. Ce document ne déclare aucun déploiement ni recette humaine de D.

## Invocations partagées

Sous Détail, deux boutons côte à côte et de taille stable : Diffuser et Voir. Diffuser inscrit volontairement la session dans la liste de la modale Voir, devient En diffusion en rouge ; Voir permet de choisir un diffuseur et remplace uniquement la scène centrale Invocation. En spectateur, les commandes de tirage sont désactivées, Voir devient Arrêter en rouge et un indicateur rouge discret marque le direct. Quitter rend ses propres invocations dans leur état frais ; sidebar et compte personnel restent les siens.

Contrat validé : événements autoritaires serveur, résultats committés avant présentation, aucun RNG spectateur ni double gain. Payload consenti : pseudo/avatar, bannière/cible, phases/résultats, pity 4/5, garantie et Capture ; soldes, inventaires, messages et identités Auth restent privés. Liste réservée à tous les joueurs standalone connectés et actifs, aucune mutation au nom du diffuseur.

Règles implémentées : une diffusion et un onglet autoritaires par Player ; diffuser/regarder exclusifs ; pause hors écran ; expiration 45 minutes depuis un vrai geste authentifié du diffuseur, grâce technique de 60 secondes ; x10 rejoint à l'étape courante et résumé complet ; seul le diffuseur avance/passe/ferme ; arrêt immédiat et retour personnel frais. Réactions emoji fermées avec cooldown trois secondes par Player et effets éphémères bornés. Transport fetch/poll avec curseur et fréquences bornées. Twitch entièrement exclu. Aucune infrastructure payante ni historique public de relecture.

## Roue animée — cadrage initial historique, supersédé par le lot D

Demande propriétaire : vraie roue visuellement soignée dans la direction GachaImpact, adaptée automatiquement à l'espace disponible, sans scrollbar propre à l'écran ; carte blanche visuelle.

Propositions initiales conservées comme historique : vectoriel responsive ou équivalent, pointeur fixe, segments/récompenses lisibles, accélération/décélération, mise en valeur du gain, lumière/particules mesurées, réglages sonores existants, animations réduites et alternative accessible. Le choix effectivement implémenté, ses limites et les contrôles locaux sont décrits dans [Roue graphique V1](wheel-graphic-v1.md) et la [preuve intégrée D](../architecture/evidence/consolidated-d-20261011.json).

Réutiliser le moteur métier existant : résultat serveur puis animation vers ce résultat, aucun tirage final, double gain après F5/reconnexion/skip, changement de probabilités/récompenses/fréquence. La géométrie ne doit pas suggérer de fausses probabilités. Calculer le diamètre après titres et commandes, sans les masquer ni déformer la roue. Recette PC, mobile portrait/paysage et petites hauteurs. La condition initiale « Aucun code avant clôture R1051 et mandat dédié » appartient à ce cadrage historique ; le mandat consolidé du 11/10 autorise explicitement D. Revue, promotion et recette humaine restent suivies au Master.
