# Navigation et shell V1

Statut : cible validée et premier lot physique candidat 0.80.

Ce document est la source de vérité de la navigation principale, du Menu global, de la Configuration du Menu et de l’architecture future du Tutoriel. Les audits métier restent propriétaires de leurs règles ; ce document fixe uniquement leurs points d’entrée dans le shell.

## Navigation principale

La barre principale contient exactement sept tuiles, dans cet ordre :

`Accueil | Invocation | Personnages | Activités | Sac | Boutique | Configuration`

`Personnages` regroupe, dans cet ordre, `Box | Équipe | Catalogue`. Une nouvelle session ouvre Box par défaut. `Activités` regroupe `Quotidiennes | Missions | Combat | Événement | Concours` et ouvre Quotidiennes par défaut. Le dernier sous-onglet consulté dans chacun de ces deux groupes est retenu seulement en mémoire pour la session courante ; il n’est écrit ni en base ni dans `localStorage`. Un deep link explicite reste prioritaire au chargement.

Les anciennes routes restent compatibles : `#box`, `#team`, `#characters`, `#inventory`, `#shop`, `#bank` et `#moderation`. Les formes canoniques groupées utilisent notamment `#characters/box`, `#characters/team`, `#characters/catalog` et `#activities/dailies`.

Les contrôles secondaires restent fixes au-dessus du contenu concerné. Box, Équipe et Catalogue réutilisent leurs véritables écrans ; aucune logique métier n’est dupliquée dans le shell.

## Activités et Quotidiennes

Les sous-onglets Activités sont exactement `Quotidiennes | Missions | Combat | Événement | Concours`.

- Missions expose une coque honnête avec les rangs `B | A | S | Z` ; l’ancienne quotidienne payante est désormais appelée `Défi` et n’est plus assimilée à l’écran Missions.
- Combat réserve les entrées internes `Entraînement | Boss`.
- Événement réserve `Jeux | Shop | Classement`.
- Concours reste une coque indisponible tant que le domaine n’est pas implémenté.

Quotidiennes possède `Aperçu | Roue | Défi`. Aperçu liste toujours, dans cet ordre, le catalogue quotidien décidé : `Récompense quotidienne | Roue | Défi | Combat | Expédition | Amitié | Événement`. Récompense quotidienne et Roue utilisent leurs états serveur réels ; les domaines non implémentés restent visibles avec un état neutre et honnête, sans progression, compteur ni donnée fictive. Le hub ne réimplémente jamais leur logique métier.

Les boutons `Accéder` conduisent vers leurs propriétaires : Roue → sous-onglet Roue ; Défi → sous-onglet Défi ; Combat → `Activités > Combat` ; Expédition → `Personnages > Box` ; Amitié → futur Social/Amis, avec contrôle désactivé tant que cette destination n’existe pas ; Événement → `Activités > Événement`. Roue réutilise le composant et le service existants et n’est plus jouable depuis Accueil. Défi remplace l’ancienne mission quotidienne player-facing, demeure indisponible sans service complet et n’affiche aucune fausse progression.

Le hero Accueil est conservé. Le futur tableau de bord inférieur attend que davantage d’activités soient réelles. La carte Récompense quotidienne peut rester dans la sidebar au lot 0.80 ; une future synthèse compacte Quotidiennes ne devra jamais inventer de compteur `X/Y`.

## Menu global et Configuration

Le bouton `Menu` est toujours affiché dans le header et ouvre une modale au clic, jamais au survol. Sur desktop, la grille est 3 × 3, soit neuf destinations maximum par page, avec `Précédent`, `Suivant` et l’indicateur de page. Sa taille reste stable. Mobile adapte la grille sans débordement horizontal tout en conservant le concept de neuf emplacements.

Le registre commun du shell porte les identifiants, libellés, icônes, routes et disponibilités. Le catalogue initial est : Accueil, Invocation, Box, Équipe, Catalogue, Quotidiennes, Missions, Combat, Événement, Concours, Sac, Boutique, Banque, Historique, Tutoriel et Configuration. Les destinations réelles ou les coques honnêtes sont accessibles ; Historique et Tutoriel restent indisponibles tant que leurs systèmes n’existent pas. Statistiques et Social sont de futures destinations Menu/Communauté, pas des tuiles principales.

`Configuration > Menu` est le seul réglage livré en 0.80. Il permet, sans dépendre du glisser-déposer, de monter/descendre une destination, la masquer/réafficher et réinitialiser l’ordre. Configuration ne peut jamais être masquée. Les futures préférences d’apparence/interface et de confidentialité appartiendront aussi à Configuration, mais aucune commande factice n’est affichée avant leurs services réels.

La préférence personnelle utilise la clé stable `navigation_menu_v1` dans `player_preferences` et la forme `{ version: 1, order: string[], hidden: string[] }`. Seuls des identifiants y sont stockés. Le serveur conserve l’ordre connu, ajoute les nouvelles destinations déterministement, ignore les identifiants inconnus, déduplique, restaure Configuration et revient au défaut en cas de valeur illisible. L’API authentifiée `GET/PUT /api/v1/me/navigation-preferences` isole strictement chaque Player. Le navigateur n’accède jamais directement à Supabase.

Banque conserve ses accès contextuels et Menu. Le futur Historique restera aussi accessible par les actions contextuelles `Voir tout` de Banque, Boutique, Invocation et des domaines concernés. Statistiques et Social n’obtiennent pas de nouvelle tuile principale ; la zone Communauté/Chat demeure le point d’entrée naturel futur vers Chat, Amis, messages privés, joueurs et profils.

## Header et Tutoriel futur

La cible du header droit est `Menu | Tutoriel* | Modération* | Déconnexion | Notifications`, où les astérisques indiquent un affichage conditionnel. En 0.80, Menu est toujours visible, Modération dépend des permissions serveur et Tutoriel est absent car aucun moteur réel n’existe.

Le futur Tutoriel sera un overlay/spotlight capable de changer automatiquement de route et de distinguer une étape explicative d’une interaction réellement attendue. Ses contrôles exacts seront `[Quitter] [Interrompre] [Terminer] [Suivant]` : Quitter remet au début, Interrompre garde le `stepId`, Terminer marque `COMPLETED` et masque l’entrée du header, Suivant avance. Un replay volontaire depuis Menu repart du début. La préférence future conserve un statut `NOT_STARTED | IN_PROGRESS | COMPLETED` et un `stepId` stable ; aucune séquence factice n’est créée en 0.80.

## Responsive et validation

Le shell doit rester exploitable à 1920×1080, 2560×1440, environ 390×844 et en paysage mobile raisonnable. Les modales ferment par bouton, backdrop et `Escape`. Aucune barre, sous-navigation, grille Menu ou écran Configuration ne doit imposer de largeur minimale provoquant un overflow horizontal.
