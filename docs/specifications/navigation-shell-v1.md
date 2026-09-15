# Navigation et shell V1

Statut : cible validée ; navigation physique publique, polish Event Lot 2 — Jeu A candidat sur `review`.

Ce document est la source de vérité de la navigation principale, du Menu global, de la Configuration du Menu et de l’architecture future du Tutoriel. Les audits métier restent propriétaires de leurs règles ; ce document fixe uniquement leurs points d’entrée dans le shell.

Les règles transverses de hauteur, scroll, stabilité, pagination, drag-and-drop et responsive appartiennent au [contrat de layout UI V1](ui-layout-contract-v1.md).

## Navigation principale

La barre principale contient exactement sept tuiles, dans cet ordre :

`Accueil | Invocation | Personnages | Activités | Sac | Boutique | Configuration`

`Personnages` regroupe, dans cet ordre, `Box | Équipe | Catalogue`. Une nouvelle session ouvre Box par défaut. `Activités` regroupe `Quotidiennes | Missions | Combat | Événement | Concours` et ouvre Quotidiennes par défaut. Le dernier sous-onglet consulté dans chacun de ces deux groupes est retenu seulement en mémoire pour la session courante ; il n’est écrit ni en base ni dans `localStorage`. Un deep link explicite reste prioritaire au chargement.

Les anciennes routes restent compatibles : `#box`, `#team`, `#characters`, `#inventory`, `#shop`, `#bank` et `#moderation`. Les formes canoniques groupées utilisent notamment `#characters/box`, `#characters/team`, `#characters/catalog` et `#activities/dailies`.

Les contrôles secondaires restent fixes au-dessus du contenu concerné. Sur desktop, tous leurs onglets sont visibles dans une barre stable sans défilement vertical ni superposition avec le contenu. Sur mobile, la barre accepte le défilement horizontal tactile mais masque sa barre native et n’accepte aucun défilement vertical. Box, Équipe et Catalogue réutilisent leurs véritables écrans ; aucune logique métier n’est dupliquée dans le shell.

Le standard des écrans longs est un grand cadre fermé jusqu’au bord inférieur utile du shell : en-tête fonctionnel, contrôles et onglets restent fixes ; seul le body interne défile. Le bord inférieur demeure visible sur desktop et le document revient à un flux responsive naturel sur mobile. Ce standard s’applique notamment à Quotidiennes, Configuration et Boutique ; ses critères détaillés sont centralisés dans le contrat de layout UI V1.

## Activités et Quotidiennes

Les sous-onglets Activités sont exactement `Quotidiennes | Missions | Combat | Événement | Concours`.

- Missions expose une coque honnête avec les rangs `B | A | S | Z` ; l’ancienne quotidienne payante est désormais appelée `Défi` et n’est plus assimilée à l’écran Missions.
- Combat réserve les entrées internes `Entraînement | Boss`.
- Événement est une surface réelle organisée dans l’ordre `Inscription | Jeux | Shop | Classement`. Inscription, ouvert par défaut, porte le hero Festival, le statut et le résumé personnel de l’édition. Jeux reste visible mais désactivé avant l’inscription, puis devient interactif sans navigation automatique après le join serveur. Si un changement d’édition rend le Player non inscrit alors que Jeux est sélectionné, la vue revient automatiquement sur Inscription. Jeux possède une seconde barre de trois sous-onglets aux identités thématiques du Festival : seul Jeu A est actif et fonctionnel, tandis que Jeu B/C, Shop et Classement restent des repères désactivés sans badge de roadmap ni faux contenu.
- Concours est une surface réelle ; son contrat métier reste propriétaire de son contenu.

Quotidiennes possède `Aperçu | Roue | Défi`. Aperçu liste toujours, dans cet ordre, le catalogue quotidien décidé : `Récompense quotidienne | Roue | Défi | Combat | Boss | Expédition | Amitié | Événement`. Les domaines implémentés, dont Event Lot 2 — Jeu A, utilisent leur état serveur réel ; les autres restent visibles avec un état neutre et honnête, sans progression, compteur ni donnée fictive. Le hub ne réimplémente jamais leur logique métier. La carte Event délègue sa disponibilité à un agrégateur de présentation central : son CTA est visible seulement si l’inscription reste possible ou, après inscription, si Jeu A n’est pas réussi et possède encore une fenêtre active/future. Réussite et expiration des trois fenêtres masquent le CTA ; le refresh autoritatif de la nouvelle business date le fait réapparaître dès qu’une nouvelle opportunité existe. Ce principe accueillera les actions réelles des futurs Jeux B/C sans transformer le CTA en simple lien de visite.

Les boutons `Accéder` conduisent vers leurs propriétaires : Roue → sous-onglet Roue ; Défi → sous-onglet Défi ; Combat → `Activités > Combat` ; Expédition → `Personnages > Box` ; Amitié → futur Social/Amis, avec contrôle désactivé tant que cette destination n’existe pas ; Événement → `Activités > Événement`. Roue réutilise le composant et le service existants et n’est plus jouable depuis Accueil. Défi remplace l’ancienne mission quotidienne player-facing et utilise exclusivement son état serveur réel ; Missions B/A/S/Z reste un domaine séparé et indisponible. Dans la carte Défi active, Conversion ouvre la modale transverse sans navigation et Pulls conduit à Invocation sans lancer de Pull ; aucun raccourci Chat factice n’est exposé pour Messages.

Le hero Accueil est conservé. Le futur tableau de bord inférieur attend que davantage d’activités soient réelles. La carte Récompense quotidienne peut rester dans la sidebar au lot 0.80 ; une future synthèse compacte Quotidiennes ne devra jamais inventer de compteur `X/Y`.

## Menu global et Configuration

Le bouton `Menu` est toujours affiché dans le header, dans la même famille visuelle que Modération et Déconnexion, et ouvre une modale au clic, jamais au survol. Sur desktop, la grille est 3 × 3, soit neuf destinations maximum par page, avec `Précédent`, `Suivant` et l’indicateur de page. Sa taille reste stable. Mobile adapte la grille sans débordement horizontal tout en conservant le concept de neuf emplacements. La page courante du Menu est un état éphémère de `GameShell` : elle survit aux fermetures par bouton, backdrop, `Escape` et navigation pendant la session montée, puis revient à 1 au rechargement, nouveau montage ou logout. Elle est rabattue sur la dernière page encore valide lorsqu’un masquage réduit la pagination.

Le registre commun du shell porte les identifiants, libellés, icônes, routes et disponibilités. Le catalogue physique 0.97 est : Accueil, Invocation, Box, Équipe, Catalogue, Quotidiennes, Missions, Combat, Événement, Concours, Sac, Boutique, Banque, Codes, Historique, Tutoriel et Configuration. `Codes` est une destination globale réelle au hash canonique `#codes`, placée près des destinations économiques ; elle ne devient pas une huitième tuile principale. Historique et Tutoriel restent indisponibles tant que leurs systèmes n’existent pas. Statistiques et Social sont de futures destinations Menu/Communauté, pas des tuiles principales.

`Configuration > Menu` est le seul réglage actif. Les onglets Confidentialité et Apparence sont visibles mais désactivés. Menu permet uniquement de monter/descendre une destination avec les flèches `↑`/`↓`, de la masquer/réafficher et de réinitialiser l’ordre. Chaque action sauvegarde immédiatement et revient à la valeur précédente en cas d’échec, sans perdre les destinations masquées. Le glisser-déposer Configuration est abandonné et ne constitue plus une direction future. Configuration ne peut jamais être masquée. Les futures préférences d’apparence/interface et de confidentialité appartiendront aussi à Configuration, sans commande factice active avant leurs services réels.

La préférence personnelle utilise la clé stable `navigation_menu_v1` dans `player_preferences` et la forme `{ version: 1, order: string[], hidden: string[] }`. Seuls des identifiants y sont stockés. Le serveur conserve l’ordre connu, ajoute les nouvelles destinations déterministement immédiatement avant Configuration, ignore les identifiants inconnus, déduplique, restaure Configuration et revient au défaut en cas de valeur illisible. L’ordre personnalisé et les masquages connus sont préservés ; Configuration reste disponible, non masquable et dernière lors d’un enrichissement automatique. L’API authentifiée `GET/PUT /api/v1/me/navigation-preferences` isole strictement chaque Player. Le navigateur n’accède jamais directement à Supabase.

Banque conserve ses accès contextuels et Menu. Le futur Historique restera aussi accessible par les actions contextuelles `Voir tout` de Banque, Boutique, Invocation et des domaines concernés. Statistiques et Social n’obtiennent pas de nouvelle tuile principale ; la zone Communauté/Chat demeure le point d’entrée naturel futur vers Chat, Amis, messages privés, joueurs et profils.

Les ressources possèdent aussi des raccourcis contextuels cohérents sans dupliquer leur logique : Primos ouvre Boutique, Moras ouvre Banque et les particules de l’élément personnel ouvrent la modale de conversion partagée. Ces entrées existent dans Sac (`Tout` et `Ressources`) et dans la sidebar. Ouvrir la conversion depuis la sidebar superpose la modale à l’écran courant sans changer de route ; toutes les entrées utilisent le même composant et la même intention idempotente.

## Navigation interne de Modération

Modération expose les onglets `Système de jeu | Codes | Bannières | Événements | Communauté`. `Système de jeu` conserve les outils et le sélecteur de Player existants. `Codes` porte l’administration globale des Codes cadeaux sans afficher ni réserver la cible Player, et reste disponible uniquement lorsque les permissions ADMIN/Super et les services correspondants sont présents. Bannières, Événements et Communauté sont des repères désactivés : ils ne créent aucune route ni permission. L’onglet actif est éphémère ; la barre est responsive et les flèches clavier ne parcourent que les onglets activés.

## Header et Tutoriel futur

La cible du header droit est `Menu | Tutoriel* | Modération* | Déconnexion | Notifications`, où les astérisques indiquent un affichage conditionnel. En 0.80, Menu est toujours visible, Modération dépend des permissions serveur et Tutoriel est absent car aucun moteur réel n’existe.

Le futur Tutoriel sera un overlay/spotlight capable de changer automatiquement de route et de distinguer une étape explicative d’une interaction réellement attendue. Ses contrôles exacts seront `[Quitter] [Interrompre] [Terminer] [Suivant]` : Quitter remet au début, Interrompre garde le `stepId`, Terminer marque `COMPLETED` et masque l’entrée du header, Suivant avance. Un replay volontaire depuis Menu repart du début. La préférence future conserve un statut `NOT_STARTED | IN_PROGRESS | COMPLETED` et un `stepId` stable ; aucune séquence factice n’est créée en 0.80.

## Responsive et validation

Le shell doit rester exploitable à 1920×1080, 2560×1440, environ 390×844 et en paysage mobile raisonnable. Les modales ferment par bouton, backdrop et `Escape`. Aucune barre, sous-navigation, grille Menu ou écran Configuration ne doit imposer de largeur minimale provoquant un overflow horizontal.
