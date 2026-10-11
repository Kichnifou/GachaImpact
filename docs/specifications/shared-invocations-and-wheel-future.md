# Invocations partagées et Roue animée — demandes du 11/10/2026

**À FAIRE, NON IMPLÉMENTÉES.** Deux missions dédiées après clôture R1051 ; aucune dépendance bloquante pour l'import. Les demandes ci-dessous sont celles du propriétaire. Les directions techniques sont des propositions, sans choix de transport, bibliothèque ni dépense.

## Invocations partagées

Sous Détail, deux boutons côte à côte et de taille stable : Diffuser et Voir. Diffuser inscrit volontairement la session dans la liste de la modale Voir, devient En diffusion en rouge ; Voir permet de choisir un diffuseur et remplace uniquement la scène centrale Invocation. En spectateur, les commandes de tirage sont désactivées, Voir devient Arrêter en rouge et un indicateur rouge discret marque le direct. Quitter rend ses propres invocations dans leur état frais ; sidebar et compte personnel restent les siens.

Proposition : événements autoritaires serveur, sans vidéo, copie du DOM ni réplication d'une session authentifiée. Résultats committés avant émission ; aucun RNG spectateur, nouveau tirage ou double gain. Payload minimal consenti : pseudo/avatar autorisés, bannière/cible, étapes d'animation et résultats ; soldes, inventaires, messages, identités Auth restent privés. Pity/garantie seulement si explicitement inclus dans le consentement. Liste réservée aux utilisateurs autorisés, aucune mutation au nom du diffuseur.

À cadrer avant développement : une diffusion autoritaire par Player/multi-onglets ; règle lorsqu'un diffuseur commence à regarder ; fermeture/déconnexion/inactivité/expiration ; arrivée pendant l'animation ou entre tirages ; ordre x1/x10, skip, doublons, reconnexions, politique des retardataires et transport ; limitation des rafales/coûts ; arrêt spectateur indépendant, arrêt diffuseur signalé ; retour personnel sans transfert ; inclusion éventuelle des pulls Twitch du même Player. Aucun historique/replay permanent imposé en V1, aucune dépendance payante anticipée.

## Roue animée

Demande propriétaire : vraie roue visuellement soignée dans la direction GachaImpact, adaptée automatiquement à l'espace disponible, sans scrollbar propre à l'écran ; carte blanche visuelle.

Propositions : vectoriel responsive ou équivalent, pointeur fixe, segments/récompenses lisibles, accélération/décélération, mise en valeur du gain, lumière/particules mesurées, réglages sonores existants, animations réduites et alternative accessible.

Réutiliser le moteur métier existant : résultat serveur puis animation vers ce résultat, aucun tirage final, double gain après F5/reconnexion/skip, changement de probabilités/récompenses/fréquence. La géométrie ne doit pas suggérer de fausses probabilités. Calculer le diamètre après titres et commandes, sans les masquer ni déformer la roue. Recette PC, mobile portrait/paysage et petites hauteurs. Aucun code avant clôture R1051 et mandat dédié.
