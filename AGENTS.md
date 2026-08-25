# GachaImpact — contexte et règles de développement

Ce document est la référence permanente destinée aux agents qui interviennent sur GachaImpact. Il décrit la vision fondatrice, les contraintes d'architecture et les règles de travail à respecter. Il ne s'agit pas d'une documentation destinée aux joueurs.

## Vision du projet

GachaImpact est un nouveau jeu web standalone, développé progressivement à partir de zéro. Il reprend et fait évoluer le concept d'un ancien jeu communautaire inspiré de Genshin Impact, auparavant piloté avec Twitch et Streamer.bot.

Le jeu doit à terme être :

- accessible en ligne 24 h/24, même lorsque Twitch est hors ligne ;
- entièrement jouable sans compte Twitch ;
- utilisable sur PC et mobile avec une interface responsive ;
- mis à jour côté web/serveur, sans programme à redistribuer aux joueurs ;
- éventuellement installable comme PWA dans une phase ultérieure.

Streamer.bot ne fait pas partie de la nouvelle architecture et aucune dépendance envers lui ne doit être réintroduite. Twitch restera facultatif.

Le projet compte actuellement environ 10 joueurs. Il doit pouvoir accueillir raisonnablement 50 à 100 joueurs et rester capable d'évoluer davantage si le besoin devient réel.

## Socle technique et backend futur

Le frontend utilise React, TypeScript et Vite.

Supabase est envisagé pour une phase ultérieure, notamment pour PostgreSQL, l'authentification, les données des joueurs, le Realtime, la présence, le chat, les fonctions serveur et les tâches planifiées. Ne pas installer ni configurer Supabase avant qu'une étape le demande explicitement.

La sauvegarde autoritaire d'un joueur et toute logique sensible doivent résider côté serveur. Le navigateur ne doit jamais être considéré comme une source fiable pour les primogemmes, personnages, constellations, pity, garanties, inventaire, récompenses, progression ou autres données ayant une valeur en jeu. Le client affiche les données et formule des demandes d'action ; le serveur valide, exécute et persiste les résultats.

Privilégier les solutions gratuites ou disposant d'un free tier véritablement exploitable et durable. Ne jamais introduire un service payant sans en informer le propriétaire du projet et obtenir son accord préalable.

## Direction de l'interface

L'interface principale suit une structure générale en trois zones :

- à gauche, une colonne persistante regroupant les informations du joueur : profil, niveau et XP, ressources, particules, équipe active, objectif ou bannière en cours, récompense quotidienne et autres informations immédiatement utiles ;
- au centre, la grande zone fonctionnelle navigable, dont le contenu change selon le système ouvert : Invocation, Personnages/Box, Équipe, Sac, Missions, Combat, Expéditions, Boutique, Événements, etc. ;
- à droite, le chat global GachaImpact, généralement disponible pendant le jeu mais repliable ou masquable.

La navigation doit permettre d'accéder clairement aux différentes parties du jeu. De grandes tuiles ou de grands boutons aux coins arrondis peuvent fournir des accès rapides aux systèmes principaux.

La maquette `Concept1.png` fournie par le propriétaire constitue la référence visuelle principale pour la direction future : interface sombre et moderne inspirée des jeux/gachas, cartes et panneaux arrondis, contrastes lisibles, informations importantes visibles rapidement et hiérarchie nette entre contenus principaux et secondaires. Elle n'est pas une spécification pixel-perfect. Ses personnages, illustrations, icônes, couleurs, textes, valeurs, dimensions et menus sont indicatifs et peuvent évoluer.

Toute décision d'interface doit préserver la compatibilité PC/mobile. Ne pas commencer ou étendre l'interface sans demande explicite.

## Logique métier et points d'entrée

Une même action de jeu doit toujours appeler une seule logique métier commune, quelle que soit son origine : bouton graphique, commande `!` dans le chat ou intégration Twitch future.

Exemple conceptuel :

- `Pull x10` dans l'interface appelle le système de pull ;
- `!pull 10` est interprété par le parseur de commandes, puis appelle exactement le même système de pull ;
- une commande Twitch future appellera ce même système côté serveur.

Il ne doit jamais exister plusieurs implémentations indépendantes d'une même mécanique. Seule la présentation du résultat peut varier selon le point d'entrée : une action graphique privilégie une restitution graphique, tandis qu'une commande de chat peut également recevoir une réponse textuelle dans le chat.

## Chat global et Twitch futur

Le chat global GachaImpact est un élément important du jeu. Il devra pouvoir accueillir les messages des joueurs, les commandes commençant par `!`, les réponses du jeu et les résultats de certaines actions.

Une intégration Twitch pourra être ajoutée ultérieurement afin de permettre, selon la configuration :

- l'association vérifiée d'un compte Twitch à un compte GachaImpact ;
- l'affichage de messages Twitch dans le chat GachaImpact ;
- l'envoi de messages GachaImpact vers Twitch lorsque l'administrateur l'autorise ;
- l'exécution de commandes Twitch par les systèmes serveur GachaImpact, même si le site n'est pas ouvert par le joueur.

Cette intégration ne doit jamais être nécessaire au fonctionnement normal du jeu. Ne pas implémenter Twitch avant une demande explicite.

## Migration des anciens joueurs

L'ancien jeu contient déjà des profils et de nombreuses données dans des fichiers JSON, notamment `viewers_data.json`. Une migration sera obligatoire dans une phase future.

Elle devra récupérer autant que possible les ressources, personnages, constellations, niveaux, XP, pity, inventaires, statistiques, équipes et progression existants. L'identité Twitch vérifiée pourra notamment servir à associer un ancien profil à un compte GachaImpact.

Ne pas effectuer de migration avant une demande explicite. Lors de sa conception, conserver les données sources, rendre les transformations vérifiables et éviter toute perte silencieuse.

## Temps, présence et traitements serveur

Les mécaniques temporelles doivent fonctionner indépendamment du navigateur : expéditions qui continuent après fermeture du jeu, changements de journée, bonus quotidiens, début et fin des événements et autres échéances doivent être calculés à partir du temps serveur.

La connexion, l'activité, la présence, le chat, les tâches temporelles et les mécaniques de jeu sont des responsabilités distinctes. Ne pas reproduire l'ancien fonctionnement dans lequel le premier message quotidien d'un joueur déclenchait artificiellement des traitements sans rapport avec le chat.

## Administration future

Un panneau administrateur privé sera créé ultérieurement pour gérer notamment les joueurs, ressources, bannières, événements, chat et modération, boss, récompenses et configuration du pont Twitch. Ne pas le créer avant qu'il soit explicitement demandé.

## Périmètre prévu pour la première V0

La première V0 doit être construite progressivement et devrait inclure :

- compte et profil joueur ;
- niveau, XP et ressources ;
- bonus de connexion quotidien avec action « Récupérer » ;
- bannière permanente de développement ;
- Pull x1 et Pull x10 ;
- pity et garantie ;
- box de personnages ;
- équipe active et modification de l'équipe ;
- sac ou inventaire ;
- chat global et commandes `!` ;
- joueurs en ligne ou récemment connectés ;
- interface responsive PC/mobile.

Cette liste décrit une trajectoire, pas l'autorisation de tout implémenter immédiatement. Les bannières temporaires, la boutique complète, les missions, combats, expéditions, événements, banque, amis, échanges, concours, giveaways, boss communautaires, Twitch et l'administration avancée viendront uniquement lorsque leurs étapes seront demandées.

## Principes d'architecture

Le code doit rester fortement typé, modulaire, évolutif, compréhensible, facile à tester et facile à modifier progressivement avec des agents. Éviter la duplication de logique et conserver des frontières claires entre interface, logique métier, accès aux données et services externes.

Ne pas sur-concevoir le projet pour des besoins hypothétiques à très long terme. Choisir la solution la plus simple qui répond proprement aux besoins actuels, tout en évitant les impasses manifestes pour la trajectoire déjà définie.

## Règles de travail obligatoires pour les agents

1. Ne jamais développer une fonctionnalité qui n'a pas été demandée explicitement.
2. Ne jamais remplacer, réécrire ou reconstruire inutilement un système fonctionnel. Comprendre et étendre l'existant lorsque cela suffit.
3. Réutiliser une logique métier unique quelle que soit l'origine d'une action : bouton, commande de chat ou Twitch futur.
4. Ne jamais faire confiance au client pour les données sensibles du joueur ni pour la validation autoritaire des actions.
5. Garder les composants et systèmes modulaires, fortement typés et séparés selon leurs responsabilités.
6. Privilégier la simplicité tant que les besoins actuels ne justifient pas davantage de complexité.
7. Après toute modification, exécuter les vérifications pertinentes disponibles : compilation, lint et tests concernés.
8. À la fin d'une intervention, signaler clairement les fichiers modifiés et les vérifications effectuées, ainsi que tout avertissement restant.
9. Ne jamais introduire un service payant sans prévenir le propriétaire du projet et obtenir son accord.
10. Préserver la compatibilité PC/mobile dans toutes les décisions d'interface.

Toujours respecter le périmètre exact de l'étape demandée. Une orientation future documentée dans ce fichier n'est pas, à elle seule, une autorisation d'implémentation.
