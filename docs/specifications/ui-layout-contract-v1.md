# Contrat de layout UI V1

## Anniversaire dans Aperçu — R1106

Bloc compact dans le scroll existant du Profil Aperçu ; AppButton partagés, sélecteurs jour/mois, avertissement définitif et confirmation séparée. Pending désactive la soumission/annulation, erreur accessible et retry de la même date ; date enregistrée en lecture seule, aucun âge/année. Profil tiers privé ou non renseigné : aucun bloc ; public : date sans action. Quatre viewports GameShell compilé/CSS production vérifiés, conteneur profile-frame inchangé. [Contrat](../architecture/post-v1-birthdays-20261017.md).

## Compteur Invocation Voir — R1104

Pastille bleue de10px dans le coin supérieur droit du bouton Voir, position absolue sans modification de taille/position, sans interception des clics ni du focus. Nom accessible avec nombre confirmé ; zéro/1/plusieurs testés en desktop/mobile, aucune valeur affichée en cas de chargement initial ou erreur, pas de pastille sur Arrêter. [Contrat partagé](../architecture/shared-invocations-v1.md). Ce compteur ne déclenche aucune réconciliation fréquente de la liste.

## Maintenance post-V1 — Concours et Légendes (17/10/2026)

Les cartes de résultat Concours affichent la récompense avant une ligne de titre réservée à toutes les cartes ; même axe par rangée, titres compacts, aucune mutation des scores. La fiche d'un personnage présente ses titres réels dans un disclosure compact sans agrandir la modale à l'ouverture. Le Profil possède un onglet Légendes après Box, avec droits BOX/GENERAL_STATISTICS conservés ; `ScrollableScreenPanel` garde son scroll. [Contrat B/C/D](../architecture/post-v1-contest-legends-20261017.md) supersédant uniquement l'emplacement des Légendes de l'ancien R1090 et l'affichage du snapshot de titre dans le résultat terminé.

## Maintenance post-V1 — retours du Shop Événement (17/10/2026)

Dans Activités → Événement → Shop, succès et erreurs utilisent le slot de résumé de la carte concernée. Les conversions remplacent « Vous recevez » ; Collection conserve « Obtenu — édition YYYY » et ajoute sa confirmation dans le même slot. Hauteur réservée constante, même police pour ces résumés, vert discret, retours à la ligne sans troncature des quantités. Aucun bandeau supplémentaire sous la grille. Pending et retry ne doivent jamais montrer un succès antérieur ; les contrôles et clés économiques restent inchangés. [Mandat consolidé](../architecture/post-v1-maintenance-20261017.md).

## Entrée Twitch et indicateur — R1096

Le bouton de diffusion active garde ses dimensions/styles existants, avec un petit disque rouge aria-hidden devant « Arrêter la diffusion ». Diffuser inactif, hover/focus/disabled et autorité conservés. Retouche indépendante de la liaison.

Écran de choix d’élément : récupération Twitch lisible, bouton centré légèrement agrandi (44px minimum), OU distinct et discret ; sept cartes et confirmation inchangées. Déconnexion dans le footer inférieur droit du cadre, couleur bleue, focus visible, sans gros bouton central. Modale Compte réutilisée avec son propre corps de scroll ; résumés, erreurs et contrôles accessibles aux quatre formats1920×1080/2560×1440/1366×768/390×844. Les preuves mesurées et limites appartiennent à la qualification et au Master ; aucun nouveau contrat mobile général.

## Retours de bêta — R1095

Historique (six onglets), Échanges (quatre vues) et sélecteurs Avatars/Titres utilisent un cadre intérieur scroll-content-frame autour des résultats. Le conteneur remplit la hauteur utile desktop, y compris vide ; entrées de hauteur naturelle, commandes/filtres/pagination séparés. Le corps ScrollableScreenPanel reste seul propriétaire de scroll ; suppression du second scroll/max-height252 d’Échanges Historique. Les suggestions du formulaire restent hors cadre. Mobile conserve son défilement naturel, sans plafond de liste artificiel.

Banque reprend proportions, fond discret et sélection soulignée des sous-onglets Jeux, avec ancêtres et focus non rognés. Bannières/Historique Event : JJ/MM/AAAA Paris sans heure, timestamps et fin inchangés. Bannières : statut autoritaire supérieur droit En cours/Terminé, raretés/noms conservés, origines et compteur de sélection retirés uniquement du rendu ; candidats ayant des votes triés décroissants puis UUID stable, DTO non muté et Choix communauté conservé.

Équipe : gabarit identique de 0 à4 personnages à même viewport/chat, portrait carré inchangé et pied de carte partagé comme réserve invisible des cases vides ; quatre effets réels du référentiel dimensionnent la réserve Passifs sans produire de faux effet actif. Message vide conservé. Composition rapide réutilise le sélecteur et ses cartes, brouillon à quatre places, membres initiaux épinglés sans déplacement sous filtre et numéros de position ; sauvegarde et conflit appartiennent au contrat Team.

Avatars/Titres : titre/fermeture, recherche et tris fixes ; seul catalogue encadré défile. Suppression visuelle de Possédé et de sa colonne pour ces deux familles seulement ; Équipé/Indisponible/Verrouillé et droits conservés. Grille donnant place aux noms longs. Concours : Devenir spectateur ; bouton de diffusion propre actif : Arrêter la diffusion, inactif Diffuser. Fantôme : fenêtres en heures locales depuis les instants serveur, dates si minuit local traversé, secours UTC explicite ; aucune éligibilité recalculée dans le navigateur.

## R1092 — proportions hover, gabarit Passifs et Shop

Équipe : seules les commandes des conteneurs ≤260 px gagnent hauteur, largeur intrinsèque et typo selon cqw ; Changer/Retirer puis flèches, hover/focus/disabled/reduced-motion conservés. Les cartes, portraits et régions restent ceux de R1091. La variante large validée est inchangée.

Le panneau Passifs réserve le gabarit naturel des quatre effets de la référence propriétaire, depuis le référentiel DTO réel Pyro/Anémo/Géo/Dendro, sans texte métier figé. Réserve invisible et inert/aria-hidden, sans commande ni faux effet présenté ; active uniquement desktop. La grille des vrais effets occupe cette enveloppe sans agrandir un effet unique. Entre 1, 2, 3 et 4 : cadre, titre/lien et rectangles des personnages restent stables au même viewport, chat ouvert/replié. Quatre effets de référence conservent leur rendu ; aucun effet garde son état vide fonctionnel. Textes complets, aucune dissimulation de débordement.

Shop : montant/devise du bandeau à 18 px desktop, données et formatage communs conservés. Quand les deux feedbacks sont vides, leurs réserves et gaps sont retirés localement ; les cartes atteignent le bord bas du corps de contenu, en conservant le padding normal du grand panneau. Les vrais messages restent entièrement visibles dans leur région et réduisent le groupe de cartes. Trois bords de cartes et trois actions inférieures alignés ; offre unique compacte conservée. Grande hauteur : quantités centrées selon R1091. Vérification par distances au bord intérieur, rectangles et textes, pas par simple absence de scrollbar.

<a id="ajustements-desktop-restants-après-r1090--non-implémentés-14102026"></a>
## Finitions desktop finales — R1091

Équipe : largeur répartie entre les quatre slots et plafonnée par la hauteur restante pour garder les portraits carrés, contain et non déformés. Le budget intrinsèque des passifs est réduit pour restituer l'espace aux personnages ; 0–4 effets entiers, bas aligné. « Voir les passifs → » est un bouton textuel dans la ligne de titre, avec focus visible, même modale et ancre Tutoriel. Chaque carte est un article contenant une surface native de fiche et des commandes sœurs superposées ; le voile laisse passer les clics hors commandes. Changer/Retirer sur une ligne, flèches dessous, états disabled, hover individuel sans déplacement et reduced-motion. Le clic suivant un drag est ignoré ; une nouvelle activation pointer/clavier réautorise la fiche. Aucun changement aux autres variantes de portraits.

Shop : distribution 1920×1080 conservée ; au-delà de 1080 px de hauteur desktop, une région centrale flexible centre la quantité entre descriptif et footer. Titres, descriptions, montants et actions inférieures restent alignés. À 651–820 px, header produit pleine largeur et Collection à quatre régions intrinsèques, pour ne pas laisser l'icône imposer une colonne de 24 px au titre. Intentions, MAX, confirmations et prix inchangés.

Sidebar : croix de masquage absente du DOM si et seulement si le statut terminé existant est actif (aucune sélection, message projeté Terminé ✅). Masquage ne vaut pas complétion ; attente/unknown/error restent distincts. Cellules de restauration et footer/navigation conservées, pas de faux bouton de remplacement.

Event : deux rangées explicites, principale au-dessus des jeux, y compris aux breakpoints desktop compacts ; noms thématiques dynamiques, typo des jeux réduite et focus conservé. Header sans « Activités · Événement », période « Édition du J/M/AAAA au J/M/AAAA » depuis les dates DTO, Europe/Paris et dernier jour inclus. Titre, huit paliers et récompenses conservés. La grille des 32 codes Crypte et sa confirmation tiennent avec les dimensions existantes ; aucun nouveau scroll ou clipping. Contrôle des trois jeux, dimensions CSS/DPR, rectangles et descendants dans le GameShell compilé ; preuves et limites au Master.

## Finitions desktop — R1090, 14/10/2026

Équipe : groupe centré avec vrais gaps entre cartes dont la largeur reste bornée par la hauteur ; cinq commandes entièrement contenues au hover et focus clavier, repli compact Fiche/Changer puis Retirer puis flèches. Portraits carrés et passifs au bord inférieur conservés.

Profil : Box utilise le corps existant avec le cadre partagé de la Box principale, filtres/navigation fixes et dernière carte accessible. La compaction de faible hauteur inclut cette rubrique. Collection répartit ses douze cartes en quatre colonnes, descriptions complètes et quantités simultanées, sans pagination ni scroll. Personnalisation agrandit portrait, pseudo, titre, statut et Choisir proportionnellement ; petit viewport conserve son budget compact, modales et Badges inchangés.

Shop : en-tête interne icône/titre à colonnes distinctes ; Conversion/Objet Collection retirés du rendu à toutes les résolutions. Solde plus compact, monnaie à droite, contrôles et intentions conservés. Accueil : Event exclu explicitement des lignes secondaires avant limite, avec réserve exacte de la ligne déjà allouée pour conserver la hauteur ; aucune chaîne Event cachée par CSS. Actions Event et Expédition restent disponibles.

Sac : cadre sur le seul inventory-scroll-body existant dans Tout/Ressources/Objets/Collection. Tout conserve seul son défilement ; les autres catégories réorganisent cartes et espacements pour tenir entièrement. Ressources se compacte aux faibles hauteurs (monnaies en deux colonnes, particules en quatre à hauteur ≤650), sans altérer montants ni destinations. Un cadre n’implique pas une scrollbar. Qualification des descendants et des textes, pas seulement du rectangle parent ; preuves et limites au Master.

## Retouches ciblées — R1089

Classement Event : en-tête sans Édition en cours, liste de cinq lignes et footer dans trois régions distinctes ; le feedback du panneau parent entre aussi dans le budget. Vérifier les rectangles des cinq li, pas seulement celui de la liste, et les hit-tests du footer. Équipe : budget nav/gestion/cartes/passifs, portraits carrés bornés par la hauteur restante, passifs au bord bas ; mesurer les parents et tester le chat replié qui élargit les cartes. Ni scroll masqué ni description coupée.

Profil Missions utilise la même pagination adaptative que Missions principales, six cartes maximum sur les grands formats, rangs et pages partielles conservés. Statistiques répartit sa première colonne selon les trois/cinq métriques Progression/Économie, étire Gacha/Activités et répartit leurs lignes ; les trois bords bas concordent sans réserve vide sous le contenu. Les 23 mesures, montants longs et null restent lisibles. La réorganisation en quatre colonnes à très faible hauteur reste le repli R1087.

Shop retire le seul libellé visible de quantité et conserve un nom accessible propre à chaque ressource ; intertitres et descriptions légèrement réduits. Gains jaunes de l’Aperçu seulement à 10 px, ligne 1,4 et retour naturel, aucune ellipse. Croix du tracker dans le dernier emplacement droit, restauration avant elle ; attente Event omise uniquement dans la carte Sidebar. Exceptions de scroll antérieures des listes Box et du mobile conservées. Qualification et limites au Master.

## Concours transparent et tours présentés — R1088

Ce complément supersède les seuls messages transitoires R1086 ci-dessous. Sans projection, le cadre Concours normal reste neutre, sans score, participant ou action fictifs ; l'attente est annoncée aux technologies d'assistance uniquement. Avec projection, cartes, modales, choix et gains restent montés. Aucun texte de chargement/synchronisation ni grand panneau d'erreur transitoire. Après 60 secondes, un diagnostic compact et une vérification facultative apparaissent ; hors ligne et refus d'accès sont distingués immédiatement. La reprise sûre reste automatique.

Les boutons Basic/Risque/Soutenir, leurs handlers et l'annonce du tour utilisent la même disponibilité effective. L'animation des événements précédents précède l'annonce humaine ; pendant la file, la carte concernée par le gain est mise en évidence. Les événements déjà présentés ne sont pas rejoués. La file accélère si elle s'accumule et rejoint directement l'état autoritaire près de l'échéance, après absence et avec mouvement réduit. Aucune horloge métier ni score extrapolé. Les overlays d'action gardent leurs coins bas arrondis à l'intérieur de la bordure, sans clipping du focus ou des gains. Les dimensions et replis R1087 restent conservés. [Qualification](../architecture/evidence/r1088-contest-presentation.json).

## Finitions sur baseline R1086 — R1087

Les retouches restent propres à chaque écran. Les règles R1085 non supersédées et la continuité R1086 ci-dessous restent acquises. Les cas desktop bas se réorganisent selon la place utile ; aucune scrollbar cachée ou suppression d’action pour faire tenir.

- Sidebar : tracker compact dans tous les états, hauteur redistribuée entre les cinq autres sections, sept éléments présents. Home : six raccourcis plus hauts, résumé de hauteur inchangée à état/viewport identiques, échelle du splash conservée ; seul le cadre d’aperçu est recadré en bas. Invocation normale inchangée.
- Quotidiennes : gains jaunes légèrement réduits, texte et montants complets avec retour à la ligne. Équipe : passifs alignés au bord inférieur, 0–4 passifs et commandes conservés ; portraits proportionnels sans nouveau recadrage. Les faibles hauteurs compactent les cartes et leurs commandes.
- Event : Général/Jeux occupent la région utile, Classement réserve réellement la pagination/rang/feedback. Les cinq lignes et la lecture complète du classement serveur restent inchangées. Shop conserve ses trois offres en desktop normal et le repli R1085 aux faibles hauteurs ; ses formulaires restent montés et leurs quantités/intention/erreurs survivent au resize. La phrase sur la conservation annuelle de monnaie disparaît de l’écran, pas de la règle métier.
- Crypte : une ligne au-dessus des codes donne les essais/combinaisons ou la victoire et son vrai découvreur. Instruction longue, légende et retour ordinaire redondants ne prennent plus de place. Les 32 codes, sélection puis confirmation, état désactivé, erreurs visibles et réessai d’intention ambiguë sont conservés ; annonces accessibles maintenues. Jeu C conserve ses messages entiers et la consultation des seuls messages présentés ; les vues Envoyer/Reçus s’appliquent désormais à hauteur desktop ≤820 px pour garder les longs messages lisibles.
- Sac : contenu aligné et contenu dans les cartes ; Collection garde les douze objets, sans pagination ni scroll. Tout conserve son défilement autorisé ; fiches détaillées et mécanique des objets inchangées.
- Profil : Choisir Avatars/Titres selon le contrat dédié, Badges simultanés ; Statistiques affiche quatre groupes et 23 mesures, y compris grands montants et null distinct de zéro. Les autres onglets gardent leur contrat. Lobby : Quitter/Annuler remontent près de l’en-tête aux faibles hauteurs, participants/spectateurs/sélection/prêt/lancement restent dans le cadre.

Les tests utilisent le GameShell compilé et ses vrais styles/assets, avec dimensions CSS, DPR et zoom relevés ; les fixtures extrêmes ne décrivent pas le volume des vrais joueurs. Une qualification technique ne vaut pas validation esthétique propriétaire. Lots retirables et preuves exactes au Master.

## Continuité du Concours — R1086

Une erreur de synchronisation conserve le dernier état autoritaire de la session et le même composant Concours, ses modales, filtres, sélections et intentions. La toolbar fixe remplace temporairement son petit libellé de thème par « Synchronisation… » ; le thème reste affiché, le détail est disponible dans title et le nom accessible. Un refus d'accès affiche « Session invalide ». Aucun overlay ni écran d'erreur ne masque une partie déjà chargée ; aucun résultat ou état métier n'est extrapolé côté client.

Sans DTO initial, l'écran dédié propose chargement/récupération automatique et Réessayer ; une requête lente reste possédée et le bouton est désactivé pendant son attente. Délais progressifs plafonnés à quinze secondes, suspension cachée et revalidation visible/focus, sans deux pollers ni répétition automatique d'action. Les replis/scrolls Concours existants et les lots R1085 sont conservés. [Qualification et limites](../architecture/evidence/r1086-contest-continuity.json).

## Adaptation dynamique avant scroll — R1085, décision propriétaire du 13/10/2026

Une demande « sans scroll », « faire tenir » ou d'adaptation d'écran impose une réorganisation selon largeur **et** hauteur utiles : répartition des régions, cartes, espacements, illustrations et contrôles. Conserver les textes et les actions lisibles, sans scale global, clipping, scrollbar cachée ou défilement déplacé. Ne pas étirer une page partielle pour remplir le cadre. Un fallback scroll exige un arbitrage explicite et précis, après mesures et tentative de réorganisation.

Périmètre sans scroll de cette mission : Accueil, Aperçu des Quotidiennes, Entraînement, présentation Event (dont classement paginé par cinq), Sac Ressources/Objets/Collection, Boutique. Missions : six cartes en 3×2 aux grands desktops, capacité adaptée aux petites régions, ordre canonique intégral et dimensions conservées sur page partielle. Les cartes Collection non possédées restent présentes. Jeux C : messages complets, aucune pagination silencieuse autorisée. Paliers Event permanents dans le titre, huit seuils et période visibles.

Exceptions conservées : Sac Tout, listes Box/Catalogue, Configuration Menu/Confidentialité/Compte avec scroll intérieur encadré, modales et historiques hors mandat. Profil conserve ses filtres et sa présentation Missions. Les replis R1084 contraires à ce mandat sont supersédés ; ses captures et résultats restent des preuves historiques, sans valoir validation de R1085.

Les barres de navigation et les titres/espacements se compactent aux faibles hauteurs, uniquement lorsque l'écran concerné active cette adaptation. Les contrôles restent présents. La qualification utilise le GameShell compilé et les styles de production, relève les dimensions CSS réelles et inspecte aussi les chevauchements, pas seulement les scrollbars. État d'implémentation, limites et livraison au Master.

L'arbitrage complémentaire du propriétaire autorise des vues et paginations **explicites**, sans changer les mécaniques : Aperçu en pages de trois cartes, Entraînement Ennemis/Formation et Shop Event par offre à hauteur desktop ≤650 px ; messages Jeu C complets un par page, vues Envoyer/Reçus aux faibles hauteurs. Général Event présente Résumé/Calendrier/Code cadeau lorsque ces contenus existent ; calendrier dix jours par page à hauteur ≤820 px, vingt-cinq au-delà, ouverture sur le jour courant. Les tutoriels et intentions Quotidiennes ouvrent la vue concernée. Collection conserve les douze objets et leurs fiches complètes. Aucun de ces replis ne réintroduit du scroll ; les exceptions existantes ci-dessus restent distinctes.

## Passe graphique desktop — R1084

R1084 supersède uniquement les anciennes clauses d’Accueil sans raccourcis/à deux rangées et la réservation du feedback Catalogue vide. Les réservations de feedback sur les cartes de vote restent valides.

Filtres Catalogue/Box : primitive opt-in de deux étoiles et sept éléments, état actif aria-pressed et re-clic désactivant la catégorie ; nom accessible explicite, focus visible, catégories cumulables. Box conserve constellation/tri et tient sur une ligne à 1920/2560 ; retour à la ligne autorisé plus étroit. Le filtre partagé historique du Profil conserve sa présentation par défaut. Catalogue n’alloue plus 20 px au feedback vide ; les erreurs restent visibles et les zones de vote sur cartes restent stables.

Concours vide : deux groupes (intro ; sélection+action) répartis selon hauteur disponible, aucune modification des états actifs. Accueil : six tuiles 3×2 desktop puis 2/1 colonnes, même cadre entier cliquable/focus ; la région centrale scrolle à faible hauteur, bannière avec minimum lisible et Quotidiennes accessibles. MP : classe dm-new-conversation-action seulement, 34 px/texte 13 px/padding 6 px vertical ; présence et autres contrôles inchangés.

Missions Activités utilise la variante missions-paged : header sans description/hauteur fantôme, rangs compacts, capacité mesurée par ResizeObserver,3 colonnes × 3 lignes à 1920 suffisant. Ordre canonique avant partition, pages entières sans perte/doublon, index remis à zéro au rang/longueur, boutons discrets aux limites et reduced-motion. Des descriptions longues réduisent le nombre de rangées ; une carte exceptionnellement haute reste entièrement accessible par le seul mission-page-window scrollable. Profil garde la grille initiale. Aucun masquage des descriptions/récompenses pour tenir neuf cartes. [Preuves](../architecture/evidence/desktop-v1-qualification-20261013.json).

## Finitions MP et récapitulatif×10 — R1083

MP seulement : point avant le pseudo dans un flex min-width0, espace droit 6 px, point 8 px non rétrécissable et nom tronqué dans son propre span ; structure liste/heure/actions préservée. Social conserve son placement antérieur. Présence privée sans point, mêmes couleurs et accessible title/aria.

Récapitulatif Invocation×10 seulement (.sequence-summary .pull-result-card.compact) : progression C6 et remboursement 9 px, marge supérieure remboursement 3 px, or/centrage conservés ; autres bonus 8 px bornés et overflow-wrap pour conserver la mention C6 maxée/ressources visibles. Largeurs, minima et colonnes de cartes/grille conservés ; la rangée auparavant étirée par les bonus se contracte sur petit format, sans agrandissement. Dix résultats ordonnés, portraits/noms/étoiles, révélations individuelles et cartes Chat conservés. Contrôle compilé GameShell aux formats 390×844, 1366×768, 1920×1080, 2560×1440 et largeur réduite. Titre navigateur selon [le contrat MP](global-chat-v1.md#finitions-de-présence-et-pull--r1083).

## Retouches post-recette — R1082

La couleur décorative Hydro est limitée à la primitive d'icône bonus ; aucune classe élémentaire générique ne colore l'identité textuelle des cartes. Noms uniformes Box/Profil/sélecteurs et autres surfaces partagées, bordures/fonds/icônes/raretés et couleurs des auteurs Player du Chat préservés. Vérifier styles calculés sur sept éléments et hover/focus/sélection.

Modale Statistiques : zone graphique de hauteur responsive stable pendant données/pending/erreur, padding supérieur8px, neuf plages et exploration du point exact, sans tableau. Hauteur totale viewport-bornée et scroll interne ; aucune ancienne série présentée comme nouvelle. Boss vaincu : GameAssetIcon/currencyAssetPaths officiels 22×22, noms accessibles via texte Primos/Moras et fallback existant, mêmes montants et états de reçu.

Cartes Chat Team/Pull/Vote suivent [R1082](global-chat-v1.md#corrections-post-recette--r1082) ; wrappers et noms/faits longs se replient dans les panneaux étroit/agrandi. Aucun changement du défilement au bas R1080, des séparateurs ou du thème. [Preuves au Master](../master/PROJECT_MASTER_PLAN.md).

## Finitions ciblées — R1081

Historique Activité : dates couvertes seulement, compteurs dépliables indépendants sans décaler les axes des autres cartes ; pseudos longs/Unicode reviennent à la ligne. Introduction et petit lien Statistiques alignés avec retour mobile propre. Modale viewport-bornée/scroll interne, focus/Escape/retour déclencheur, graphe SVG lisible à un seul point comme sur cinq ans ; tableau exact retiré par R1082, labels X clairsemés et Y entiers. Aucune animation de dépliage nécessaire ; reduced-motion conservé.

Chat : portraits contain, icône élémentaire officielle en bas à droite distincte de Nouveau en haut à gauche, étoiles/constellations et labels compacts ; flex-wrap en Chat étroit comme agrandi et réponses. compact facultatif masque le titre répété uniquement sur les nouvelles projections. Vote peut présenter son catalogue borné complet ; Pull1–10 reste un seul résultat durable. Ne pas toucher au scrolling Agrandir/Réduire R1080 ni aux MP. [Contrat Chat](global-chat-v1.md#présentation-compacte--r1081).

Sidebar : seule carte Objectif actuel recomposée ; petite carte portrait carré contain puis nom et cinq étoiles contigus à gauche, garantie5★/Capture/pity5★+barre/pity4★+barre à droite. Couleur élémentaire, watermark, vrai contenu et cadre entier navigable conservés. Les variantes Équipe/Invocation restent indépendantes. À desktop<=640px de hauteur, player-secondary possède un défilement interne et les lignes intrinsèques empêchent de réduire l'Objectif à une bande illisible ; géométrie des formats usuels conservée. Pas de refonte générale CSS.

Boss vaincu : bloc Récompenses reçues depuis reçu personnel (ou barème des participants clairement identifié), pas de bouton claim ; notification archivée au clic via serveur. Bilan remplace le terme technique baseHp par HP. Les preuves et limites visuelles réelles appartiennent au Master.

## Corrections Chat/Équipe — R1080

Chat : aperçu de réponse au-dessus du flux inline complet, sans séparateurs globaux. Agrandir/Réduire est une demande explicite de retour au bas, après layout ; brouillon, conversation et jeu monté conservés, aucun acquittement caché. Cette règle supersède le point de lecture R1079 seulement pour ces clics.

Équipe : min-width:0 sur propriétaire/enfants, colonnes minmax(0,1fr), aucune largeur issue du ratio de la grille vide. À desktop, lignes intrinsèques et scroll de team-screen permettent d'atteindre les quatre slots/passifs/actions à faible hauteur. Variante portrait Équipe carrée, image contain non déformée au contact direct du nom, hauteur de carte intrinsèque ; Sidebar/Invocation restent indépendantes. Les bandes sous image et débordements ne sont pas cachés par clipping. Formats, mesures et limites de la qualification restent au Master.


## Chat standalone et Communauté agrandie — R1079

Les flèches de destination conservent X,32×32px, gap, cadres et comportements ; seul align-self:end descend le groupe dans sa cellule du header, juste au-dessus d'Accueil. Aucun changement de hauteur/header/logo/actions.

Chat global : Heure / Badge courant / Pseudo : Message sur un flux inline compact, sans avatars répétés ; retours naturels et actions en overlays existants. Résultats en petites cartes à lignes flexibles, portraits officiels, rareté/constellation/Nouveau et faits bornés. Aucun scroll horizontal ; gains et missions restent dans le texte complet. Styles internes des MP séparés et inchangés.

À largeur>=1000px, Agrandir masque visuellement la colonne centrale/navigation et étend toute la Communauté ; sidebar/header et instances du jeu/Chat/MP conservés. Réduire restaure le jeu sans action. Préférence par Player, neutralisation sous1000px et pendant tutoriel. Scroll propriétaire message-list ou dm-message-list ; retour au bas lors du clic Agrandir/Réduire selon R1080, sans acquittement d'un fil caché. Le maintien historique du point de lecture R1079 est supersédé pour ces seuls clics. Labels et focus accessibles. Qualification vrai GameShell/CSS compilée en390×844,844×390,1366×768,1920×1080,2560×1440 ; preuves et limites au Master. [Contrat détaillé](global-chat-v1.md#présentation-standalone--r1079).

## Complément borné R1052/R1078 — 12/10/2026

Deux boutons ‹ et › distincts de32×32px, sombre/bleu, cadres identiques et gap5px occupent l'espace libre à droite du bouton logo/nom. Ils restent extérieurs à ce bouton et précèdent les actions existantes, sans deuxième barre ni mots visibles. Aria Précédent/Suivant, focus-visible contrasté, hover discret, disabled lisible ; compactage du grid header sous760px, aucun chevauchement/débordement. Logo, Menu, Modération, Déconnexion et Notifications gardent leurs styles existants.

Dans Profil > Personnalisation, badge jaune Nouveau en position absolue en haut à gauche de la carte, sans modifier son flux/dimensions ; nom, illustration, condition et Équiper restent présents. Recherche normalisée et sélecteurs compacts Nom/Date et direction coexistent avec les regroupements existants. La nouveauté des cartes affichées reste visible durant la visite puis disparaît au retour, sans consommer les cartes masquées ni l'autre type.

Invocation : retrait intégral du bandeau noir central de pause. L'unique statut PAUSED demeure le groupe blanc déjà validé en haut à droite, sans déplacement. Réactions : départ20% au lieu de14%, taille2rem, durée2s, voies ID/oscillation/fade/reduced-motion inchangés. Le compteur confirmé reste pendant les lectures de la même diffusion, y compris remount du reçu ; après15s sans donnée valide il redevient indisponible, sans zéro inventé. Les preuves visuelles locales et la recette publique restent distinctes au Master.

## Correctifs après recette publique — 12/10/2026

La disposition générale restaurée au checkpoint6d8534a est acceptée par le propriétaire après recette à deux comptes ; cette validation ne couvre pas les corrections suivantes. La scène personnelle au repos conserve le même splash DOM chargé pendant Diffuser/arrêter ; les frontières d'identité et de reçu partagé restent distinctes. Détails remplace seulement le libellé Invocation Détail et s'ouvre dès la sortie de visionnage confirmée, même pendant le refresh personnel ; les mutations attendent toujours ce refresh et l'historique reste interdit en visionnage/onglet non autoritaire.

Diffuser/Voir/En diffusion légèrement plus bas au repos : écart mesuré comparable à Fin le→Détails, sans déplacement du panneau, splash, cartes, pity ou footer, ni changement des32px desktop/44px mobile. Statut compact intérieur conservé : groupe SVG blanc pour les spectateurs, point rouge en direct, deux barres et libellé/pseudo blancs en pause. Réactions2rem pendant2s, départ14%/montée50cqh, oscillation±.45rem ; voie et phase attachées à l'ID, disparition avant le statut, aucune hit target, reduced-motion conservé. Les règles antérieures de durée/taille sont supersédées par cet amendement.

Dans Quotidiennes→Défi, le bouton Changer de Défi actif est bleu franc/texte blanc, avec hover et focus visibles. Désactivé/pending : gris atténué sans faux hover ; mêmes dimensions, coût dynamique, confirmation, canSwitch et garde anti-double-clic. Aucun changement métier. Qualification sous GameShell réel et CSS compilée sur390×844,844×390,1366×520,1366×768,1920×1080,2560×1440, avec frames de transition ; preuves et état au Master.

## Finition Invocations partagées — 12/10/2026

Correction propriétaire du 12/10 : le compteur/statut/pseudo est un overlay absolu **dans le panneau Invocation**, en haut à droite, sans réduction de hauteur ni déplacement du cadre, splash, pity ou footer. Une seule ligne, compteur sans réduction ; pseudo et éventuel contrôle d'un autre onglet tronqués visuellement si nécessaire, texte complet accessible. Top6px jusqu'à600px,8px au-delà : le statut ne recouvre pas le titre. Aucun bandeau extérieur ni règle réservant sa hauteur dans le flux. Un seul statut par session, zéro après arrêt confirmé, cleanup des portals et timers ; clés React non concurrentes. Passer/fermer restent dessous via la hauteur mesurée du statut, uniquement pendant le partage. Leurs positions personnelles restent inchangées.

Diffuser/Voir et aide seulement au repos avec cible sélectionnée ; absents du choix de cible et des présentations personnelles. Diffuseur : En diffusion, spectateur : Arrêter/réactions. Démarrage/arrêt en un clic, sans modale ajoutée. Hauteur réelle compilée : 32px desktop, 44px mobile/tactile ; le bloc de commandes mobile conserve l'encombrement de son aide au démarrage. Le résumé x10 se centre dans la place disponible ; sa région interne est seule propriétaire du scroll, focalisable Home/End/PageUp/PageDown, sans fermer la séquence. Sur desktop bas, stop et réactions se rangent sur une ligne. Aperçu spectateurs en portal borné au viewport et modale suivant les primitives existantes ; exact Player au clic. Réactions : seul le départ légèrement plus haut/trajet raccourci et l'oscillation ±.45rem changent ; taille, durée, position à droite, absence de hit target et reduced-motion conservées. Six formats contractuels, comparaison ciblée79832fc et inspection PNG dans le GameShell compilé requis ; résultats et limites dans le Master.

## Application bornée R1051 — Catalogue et Imports

Dans Modération > Personnages > Catalogue/Imports, liste seule défilante, filtres/actions et pagination fixes. CiblePlayer inutile masquée dans ces deux sous-contextes, Possessions inchangé. Sur mobile le cadre métier utilise la hauteur viewport disponible après défilement normal du document ; la pile/navigation du shell n’est pas redimensionnée. Actualiser circulaire32px/40px tactile, infobulle hover/focus-visible, état occupé et réduction des animations. Notifications : actions à droite dans les états vide/lu/non lu/suppression. Aperçu candidat uniquement depuis objets stockés ; preuve locale sous GameShell/CSS compilés et recette humaine distinguées au Master.

Statut : contrat transverse validé. L'état physique courant des lots appartient au Master.

Ce document est la source de vérité des règles de composition et de stabilité visuelle communes. Les documents métier restent propriétaires du contenu et des actions de chaque écran ; le shell de navigation reste propriétaire des destinations.

## Application bornée lot D — Roue graphique

Dans `Activités > Quotidiennes > Roue`, la carte réserve titre, statut et commandes avant de dimensionner son SVG circulaire dans la largeur et la hauteur restantes. Ses dix secteurs sont pondérés par la projection du moteur serveur unique : rien, sept éléments, Moras et Primogemmes. Diamètre adaptatif sans déformation ; pointeur fixe et arrêt sur le résultat autoritatif. La carte et son body métier n’ont aucun défilement propre ; titre et actions ne sont ni rognés ni recouverts. Cette règle concerne uniquement le body Roue, sans changer les autres onglets Quotidiennes, le scroll naturel mobile ou le shell global.

Passer termine seulement la présentation et restaure le focus vers Probabilités s’il détenait le focus. Le détail Probabilités utilise une modale bornée, navigation clavier/Escape et retour du focus au déclencheur. La réduction des animations restitue immédiatement le résultat, sans rotation ni éclat. Les états disponible, attente, animation, résultat, déjà utilisé, historique inconnu, projection absente et erreur gardent les commandes visibles ; aucune distribution fictive n’est dessinée en l’absence de projection valide.

[Recette privée intégrée](../architecture/evidence/consolidated-d-20261011.json) sous GameShell complet/CSS compilé : 390×844, 1366×768, 1920×1080, 2560×1440, 1280×600 et 844×390 ; 54 états Roue, six captures de modale, contrôles de géométrie, clavier/focus et réduction des mouvements. Le [contrat Roue graphique V1](wheel-graphic-v1.md) porte le comportement spécialisé. Ces preuves locales ne déclarent ni déploiement ni validation humaine ; le contrôle complet associé reste explicitement FAIL dans la preuve.

## Écrans desktop longs

À partir du breakpoint desktop, un écran long occupe toute la hauteur utile de `screen-stage`, jusqu’au même bord inférieur que le chat. Son cadre reste fermé et visible. Il est structuré en zones fixes (header, navigation locale, recherche, filtres, tris ou actions nécessaires) puis en un body `minmax(0, 1fr)` dont le défilement est interne.

Le document, le shell et les contrôles fixes ne doivent pas défiler pour parcourir les données. Un body vide conserve la hauteur disponible : il ne raccourcit pas le cadre. Boutique, Quotidiennes, Configuration, Box, Catalogue et Modération suivent cette règle lorsqu’ils utilisent le pattern d’écran long.

Le `screen-stage` desktop ne devient pas un second propriétaire de scroll lorsqu’il contient un `.long-screen-layout` : il borne l’écran, puis le body fonctionnel explicitement désigné porte `overflow-y: auto`. Cette règle supprime la scrollbar fantôme du shell tout en conservant une barre réelle dès que `scrollHeight > clientHeight`. Sous le breakpoint desktop, le `screen-stage` et l’écran reviennent au flux naturel.

Lorsqu’un panneau fonctionnel associe un header local (titre, recherche ou filtres) à un contenu susceptible de dépasser, ce header reste hors du conteneur de défilement. Tout ce qui le suit — erreurs, résumés, groupes, listes et états vides — appartient à un body `minmax(0, 1fr)` dont `overflow-y: auto` n’affiche une barre que si nécessaire. Les contrôles ou catégories placés dans une colonne sœur restent eux aussi immobiles.

Un `ScreenHeader` structurel et les contrôles ou panneaux qui le suivent occupent toujours des zones de layout distinctes. Le layout réserve la hauteur intrinsèque non compressible du header avant d’attribuer le reste au panneau fonctionnel ; aucun contrôle sticky ou fixe interne ne peut recouvrir son titre ou sa description. Un `z-index`, un masque, une translation ou un `overflow` coupant le contenu ne constitue jamais une correction acceptable d’un chevauchement.

Une fonctionnalité future peut conserver un onglet ou contrôle structurel désactivé et visuellement grisé lorsque celui-ci représente la composition finale connue. Elle n’ajoute pas par défaut de badge « À venir », de carte « Bientôt disponible », de texte de roadmap, de faux résultat ou de contenu fictif simplement pour combler l’espace. Cette règle s’applique aux surfaces touchées à mesure de leur évolution, sans imposer une refonte globale des placeholders historiques.

## Défilement et responsive

- Une longue liste interne propriétaire de son scroll est contenue dans un cadre visuel stable : bordure visible, rayon cohérent, fond légèrement distinct, padding intérieur et `min-height: 0`. Son header, sa recherche et ses filtres restent hors du cadre lorsque leur usage doit rester fixe. Le cadre occupe la hauteur disponible sans hauteur pixel rigide et garde ses quatre bords visibles pendant le scroll. Les cartes gardent leur géométrie normale ; on ne les comprime pas pour faire tenir toute la liste. Éviter une seconde bordure lorsque le panneau parent fournit déjà clairement cette limite.
- Dans Box et Catalogue, le résumé est un footer fixe aligné à droite sous le cadre des personnages. Il reste hors du scroll, peut revenir à la ligne sur petit écran et ne recouvre pas la scrollbar.
- Le focus clavier d'un contrôle placé près d'une zone `overflow` doit rester visible sur ses quatre côtés. Les recherches Box, Catalogue, Sac et Profil utilisent un contour intérieur ou un espace de sécurité équivalent ; un effet lumineux rogné par le scroll n'est pas acceptable.
- Le propriétaire du scroll doit être explicite ; deux scrolls verticaux imbriqués pour le même contenu sont interdits.
- Toute zone de scroll visible appartenant à une surface sombre GachaImpact utilise le thème scrollbar commun, sous Firefox comme sous Chromium/WebKit. Sa portée couvre les descendants du shell comme les couches de modales React portalisées dans `document.body` hors de `#root`. Une nouvelle zone scrollable ne doit jamais retomber sur la scrollbar native claire du navigateur. Ce thème porte la couleur et la cohérence visuelle ; il ne sert jamais à masquer un overflow, supprimer une barre nécessaire ou modifier artificiellement la géométrie du conteneur.
- Les sous-navigations ne défilent jamais verticalement. Sur desktop, leurs onglets tiennent dans la largeur disponible ; sur mobile, elles autorisent un pan horizontal interne sans imposer de largeur minimale au document.
- Sous le breakpoint desktop, les écrans reviennent à un flux naturel. Les tableaux, barres d’onglets ou contenus réellement larges défilent dans leur propre conteneur horizontal ; ils ne créent pas d’overflow horizontal du document.
- La barre de paliers Event est une région fixe du panneau Event, hors du body vertical qui défile. Ses huit repères peuvent défiler horizontalement dans leur propre conteneur sur mobile ; ils ne provoquent jamais un débordement horizontal du document. Le score réel reste lisible au-delà du dernier repère.
- Les modales sont bornées par `100dvh`, restent fermables et conservent leurs actions dans le viewport.
- Une modale de liste potentiellement longue utilise quatre régions explicites : header, recherche/filtres/tri, body `minmax(0, 1fr)` seul propriétaire du scroll, puis footer/pagination. La pagination serveur borne la projection à sa capacité métier ; une pagination frontend placée devant un chargement intégral ne satisfait pas ce contrat. Une modale imbriquée conserve la liste parente montée, son état et sa position de scroll ; seule la modale supérieure traite Escape et le focus revient au contrôle qui l’a ouverte.

## Stabilité et layout shift

Recherche, filtre, tri, pagination, mutation, chargement, état vide et feedback ne déplacent pas inutilement le contrôle qui vient d’être utilisé. Les résultats rapides utilisent un overlay ancré. Les feedbacks réservent leur emplacement ou utilisent un overlay. Les conteneurs paginés gardent une taille correspondant à leur capacité, même sur une page partielle ou vide.

Un rerender parent sans changement métier ne relance jamais une page déjà chargée et ne modifie pas à lui seul l’état `disabled` des contrôles paginés. L’identité d’une fonction prop n’est pas un signal de rechargement : ouverture réelle, changement de page, `refreshToken` métier ou autre déclencheur fonctionnel explicite le sont. Une navigation de page produit une seule requête effective ; durant cette requête seulement, les contrôles concernés peuvent être bloqués tandis que les données confirmées précédentes restent affichées. Une réponse obsolète ne remplace jamais une réponse plus récente.

Les modales d'historique Banque et Boutique ont une capacité visuelle exacte de dix lignes : dix lignes remplissent le body jusqu'au footer, quatre lignes matérialisent six emplacements vides, et zéro ligne conserve le footer à la même position. Sur desktop, la hauteur des onze rangées (header de table + dix slots) est calculée depuis le body disponible et ce body n'a aucun scroll vertical ; `scrollHeight` reste au plus égal à `clientHeight + 1 px` à 1920 × 1080 comme à 1366 × 768. Mobile peut conserver un scroll interne, notamment horizontal.

Un navigateur paginé dont la capacité métier est de dix résultats applique le même invariant sur desktop : header, filtres et footer restent fixes, le body matérialise exactement dix slots, une page partielle complète les emplacements structurels et ne déplace pas le footer. Sa capacité normale n'utilise aucun scroll vertical ; mobile peut retrouver un scroll interne lorsque le viewport l'exige.

Une carte à états conserve ses dimensions extérieures et réserve ses zones internes avant l'interaction : contenu principal, état/feedback, action et confirmation ne se repoussent pas mutuellement. Ajouter une action à une carte existante ne conduit jamais à agrandir artificiellement toutes les cartes de sa grille. Lorsque le langage visuel existant offre déjà l'espace nécessaire, l'action s'intègre dans cette géométrie ; une carte sans action ne réserve aucun footer vide universel.

Une information secondaire ajoutée à un panneau compact — valeur actuelle, résumé ou statut — s'intègre dans une zone déjà dimensionnée. Elle peut se répartir sur deux lignes internes à largeur contrainte, mais ne modifie pas la bounding box externe du panneau ni la position de ses contrôles.

Une zone d'artwork conçue comme colonne plein-hauteur dans une fiche étire son enveloppe et son média jusqu'à la borne basse de la région qu'elle représente. Elle ne laisse aucune bande morte sous l'image ; le crop est assuré par le média dans cette enveloppe, sans scale arbitraire destiné à masquer un défaut de grille.

Dans une grille dont les cartes changent d’état en direct, toutes les cartes conservent la même hauteur extérieure au viewport courant : score, tour, soutien, titre, rang, remplacement ou feedback s’insèrent dans cette enveloppe sans modifier la rangée. Si la hauteur utile ne suffit plus à présenter le contenu et les commandes, le body fonctionnel devient propriétaire du scroll interne ; aucun `overflow: hidden` ne coupe un contrôle interactif ou une information principale pour simuler un écran sans scroll.

La sidebar desktop occupe exactement la hauteur utile que lui attribue le shell et ne devient pas un propriétaire de scroll. Sa densité interne peut varier selon la hauteur du viewport, sans masquer d'information essentielle ; les régions flexibles absorbent le surplus et distribuent leur contenu de façon volontaire, tandis que son bord inférieur reste aligné avec ceux du contenu principal et du chat.

Étape 24 : le [suivi Quotidiennes](home-daily-tracker-v1.md) occupe l'enveloppe basse existante, indépendamment de disponible/terminé/attente/inconnu/erreur/pending/feedback/masquage. Header avec restauration toujours réservée, centre flexible sans bouton visible et footer de navigation ancré en bas gardent leurs limites ; dimensions locales, sans changement global AppButton ni bouton imbriqué. Le tracker compact ne rend aucun détail secondaire ni refresh visuel et utilise une seule zone d'état, remplacée pendant pending/succès/erreur claim ; aucune ligne feedback permanente. La carte tracker porte un bouton sibling couvrant sa surface, sous les couches des contrôles indépendants ×/↺/‹/Tout voir/› ; aucun bouton imbriqué ni action centrale visible, aucun faux hover en état inactif. Accueil desktop utilise deux lignes minmax(0,1fr) auto : bannière sans footer Invocation remplissant l'espace restant (height:100%, min-height:0, aucun clamp), puis Quotidiennes de hauteur intrinsèque ancrées en bas. Le média et son fallback partagent une région bornée ; artwork sans déformation. Sans rangée de raccourcis ni vide flexible sous les cartes, le résumé possède seulement le scroll exceptionnel borné. Les cartes à action unique sont entièrement cliquables, leurs micro-libellés restent des textes. Sur mobile, le shell conserve le flux Profil→contenu→cartes secondaires→Chat ; aucun nouveau drawer. L'Accueil suit ce flux naturel, tandis que la carte tracker garde sa largeur/hauteur indépendantes de son état. L'Aperçu conserve son body scrollable et ses contrôles fixes. Présentation amendée par R1011–R1013, annulation LIFO dans la cellule de restauration réservée selon R1014.

Le panneau Communauté garde un seul body actif. Dans MP, la liste de conversations est l'unique propriétaire de son scroll ; dans une conversation, le header, l'unique statut de livraison et le composer restent hors du body messages `minmax(0, 1fr)`. La scrollbar du fil devient transparente lorsqu'il est réellement au bas et réapparaît dès que le lecteur remonte, sans `overflow: hidden`. Le passage `Chat | MP` masque explicitement la pane inactive sans la démonter. Sur mobile, Communauté reste dans le flux du `GameShell` et ne crée aucun overflow horizontal du document ; le fil et le textarea peuvent défiler verticalement dans leurs propres limites sans couper le footer.

L'aperçu de signalement MP est un petit overlay interne stable qui ne déplace pas le fil : il reste monté pendant le chargement, montre au plus voisin précédent/cible/voisin suivant, distingue la cible en jaune/or et garde son footer toujours visible. Seul son corps central borné peut scroller pour un texte exceptionnellement long. La liste MP expose sous la date un menu `⋯` réutilisant exactement les actions du header sans ouvrir ni marquer lu implicitement la conversation. Dans Modération > Communauté, la liste paginée puis le contexte gelé 10/1/10 sont les seuls propriétaires de scroll de leur zone, sans action permettant d'ouvrir, rechercher ou étendre la conversation réelle ; la suppression confirmée retire uniquement le dossier.

Lorsqu'une carte de sidebar sert de raccourci synthétique dans une enveloppe de hauteur imposée, son contenu se répartit en trois zones : identité en haut, résumé extensible au centre et action/affordance en bas. La zone centrale absorbe la hauteur supplémentaire et reste prête à recevoir une future projection réelle sans modifier le cadre extérieur.

## Grilles de cartes homogènes

Une surface représentant un personnage connu n’utilise jamais une initiale textuelle de Player ou de personnage comme fallback d’image. Pendant le chargement et après l’échec de tous les assets, elle conserve le cadre et la géométrie du portrait avec un fallback nul ou un placeholder neutre non textuel. Une initiale reste permise sur une surface qui représente effectivement l’avatar générique d’un Player.

Les cartes d'une même grille partagent leur géométrie extérieure, leurs axes visuels et les lignes de titre, description, quantité et action. L'ajout d'une action contextuelle ne déplace pas l'icône ni les lignes communes. À géométrie égale, les centres verticaux des icônes restent cohérents ; les contrôles desktop vérifient un écart maximal de 1 px entre le centre de la carte et celui de l'icône.

Lorsque deux groupes opposés représentent des objets directement comparables — par exemple adversaires et formation — leurs cartes pleines, vides ou enrichies d'informations contextuelles conservent la même géométrie extérieure au même viewport. Les informations ou actions propres à un groupe s'intègrent dans cette enveloppe sans l'agrandir.

Lorsqu'une carte représente une seule action, toute sa surface est un unique hit target accessible au clavier. Le libellé d'affordance reste visible mais n'est pas un contrôle imbriqué ni la seule zone cliquable. Hover et `focus-visible` réagissent sur le cadre entier avec l'accent contextuel de la ressource. Une carte sans action ne simule ni curseur, ni hover interactif. Une variante visuelle arbitraire n'est admise que pour une raison métier explicite.

## Filtres et pagination des grilles

Les filtres partagés des grilles conservent recherche, filtres, tri et direction dans leur région de contrôle. Ils reviennent à la ligne selon la largeur disponible ; un contrôle ne doit pas être coupé à 1366 px desktop ou 390 px mobile. Dans Catalogue, la zone de vote reste réservée même avant la première réponse et sur les cartes non candidates : compteurs, attente et confirmation ne déplacent ni les filtres ni la grille.

Un écran long peut utiliser trois régions : contrôles fixes, body scrollable et footer fixe de pagination. Annuaire et Profil réutilisent `ScrollableScreenPanel` ; leurs grilles publiques réutilisent les cartes métier en lecture seule. Une carte sans action n'acquiert ni bouton ni hover interactif. Le responsive mobile conserve le flux naturel du shell.

## Drag-and-drop

Le drag-and-drop n’est utilisé que lorsqu’une spécification métier le demande explicitement. Une liste réellement prévue pour ce mode distingue deux intentions par des surfaces explicites : des zones de drop autonomes entre les lignes insèrent l’élément à cet emplacement ; le corps complet d’une ligne échange les deux éléments. Aucun seuil ou ratio calculé depuis la position du pointeur dans une ligne ne décide de l’intention. Chaque target accepte `dragover`, annonce `dropEffect = move`, et l’aperçu local rend insertion et échange nettement différents sans découper ni masquer les lignes. `Configuration > Menu` est explicitement arrow-only et n’applique pas ce contrat DnD ; Team continue de l’utiliser selon sa propre spécification.

Lorsqu’un panneau associe un contenu extensible et une action latérale stable, sa grille utilise `minmax(0, 1fr) max-content` : le contenu absorbe la largeur variable et l’action ne modifie ni sa position ni sa largeur selon l’état affiché.

Aucune requête n’est envoyée pendant le mouvement. Un drop valide produit exactement une sauvegarde. Un abandon ne sauvegarde rien. Un échec restaure le dernier état confirmé complet, y compris les éléments masqués. Une alternative accessible par boutons ou clavier reste disponible.

## Interactions, modales et régions dynamiques

Un overlay d'explication sur la vraie interface utilise une région réelle mesurée, jamais une copie de composant. Son spotlight reste net et visuel uniquement : toutes les interactions métier sont neutralisées, y compris au clavier. Le dialogue viewport fixe est au-dessus des modales ordinaires, hors des sous-arbres inert ; focus initial sûr, Tab borné, Escape et nettoyage exact de l'état précédent sont requis. La géométrie réagit aux resize/scroll/layout sans polling rapide ; bulle bornée au viewport, position évitant la cible lorsque possible, cible réelle rendue visible sur mobile et reduced-motion respecté. Le contrat produit, les contrôles et les étapes appartiennent exclusivement au [Tutoriel V1](tutorial-v1.md) ; 25A publiquement validée dans son périmètre réel sur a23a423 ; Tutoriel 25B de 116 étapes / 24 chapitres / 21 écrans validé publiquement par le propriétaire sur 1e5a5d7 ; Menu, transitions, Missions B/Z, Passifs, Event Shop et Faveur validés dans les six groupes rapportés. Compatibilité des deux anciens IDs prouvée techniquement, sans recette manuelle publique rapportée, selon le Master.

25B réutilise cette famille visuelle sur tous les propriétaires joueurs : écran/vue/panneau réellement montés et chargés, puis une ancre primaire ou entrée réelle conditionnelle avant la bulle. Les ancres se mesurent après le rendu, jamais depuis une cible DOM de l'ancien écran. Les portals ordinaires restent inert et ne capturent pas le focus du dialogue Tutoriel ; attente DOM bornée/annulable, cleanup des observers/frames/timers et restauration exacte. Scroll du propriétaire puis du viewport si nécessaire, bulle et quatre contrôles accessibles sans overflow horizontal, même avec états vides/verrouillés. Les sous-vues temporaires ne redimensionnent pas le shell normal ni ne modifient sa navigation/gestion des préférences. Dans le correctif propriétaire, Passifs vise le panneau complet hors backdrop ; sur mobile sa présentation guidée garde la bulle en dessous et le référentiel défile dans son body. Shop vise sa section entière, Vider son contrôle réel et Invocation 4★ sa zone dédiée. Les trois étapes Missions présentent B ; Z est éclairé uniquement sur son onglet, sans monter son contenu même débloqué. La matrice, les replis et la distinction tests locaux/recette propriétaire restent dans la source Tutoriel.

Avant de créer une nouvelle interaction ou un nouveau composant UI, rechercher les patterns existants et les réutiliser ou en extraire une primitive commune. Une UX distincte ne se justifie que si les interactions existantes ne répondent pas au besoin. Les spécialisations d’une primitive commune conservent leurs permissions et données propres à chaque domaine.

- Les boutons d’action réutilisent une primitive partagée dont la variante secondaire sombre, primaire, danger ou iconique définit elle-même fond, couleur, bordure, rayon, dimensions et états hover, `focus-visible`, disabled et pending. Le type par défaut est `button`. Aucun contrôle de ces familles ne dépend du fond natif clair du navigateur ou d’un héritage de couleur isolé ; les variantes métier déjà établies hors de la surface touchée ne sont pas repeintes implicitement.
- Tout contrôle interactif activé annonce son affordance avec un curseur cohérent et un état `focus-visible`. Un contrôle désactivé conserve son rendu de feedback, utilise un style grisé et `cursor: not-allowed` ; une surface non interactive ne simule pas un clic.
- Une mutation affiche son état pending dès le rendu suivant le clic, avant la réponse réseau. Son libellé et son éventuel indicateur `aria-busy` restent dans une enveloppe de dimensions stables afin de ne pas déplacer les contrôles voisins. Une garde synchrone protège le double clic lorsque le state React n’a pas encore été rendu.
- Les modales d’un même shell réutilisent le contrôle de fermeture sombre standard avec le label accessible `Fermer`. Elles se ferment à la souris et avec Escape, enferment Tab dans le dialogue et rendent le focus au contrôle d’ouverture. Leur fermeture et leur navigation ne sont pas bloquées par une mutation de fond sans nécessité métier.
- Toute pagination déclare une capacité visuelle explicite. Header, filtres, body et footer conservent leur position pour une page pleine, partielle, vide ou en chargement ; les emplacements structurels vides n’inventent aucune donnée et sont ignorés par les technologies d’assistance.
- Un contenu dynamique attendu réserve sa région avant apparition : spectateurs, feedback, pending, actions alternantes, état vide et erreur courte ne doivent pas pousser brutalement les commandes suivantes ni modifier le bord inférieur du panneau.
- Un header possède une hauteur naturelle non compressible. Il ne peut être recouvert par le panneau suivant, ni réduit par une ligne de grille `minmax(0, 1fr)` qui appartient au body extensible. Supprimer une description supprime aussi sa hauteur réservée.
- Toute validation de layout utilise le GameShell complet et les feuilles de style de production réellement chargées. Un composant isolé sans la cascade globale ne suffit pas à conclure à l’absence de recouvrement, de contenu masqué ou d’overflow du document. Lorsqu’un lot vérifie précisément le scroll, il est interdit de masquer les barres par option navigateur, `scrollbar-width: none`, suppression des pseudo-éléments ou `overflow: hidden` coupant le contenu ; la validation relève `clientHeight` et `scrollHeight` du véritable propriétaire.

## Validation minimale

Chaque modification de layout transverse se vérifie au minimum à 1920×1080, 1366×768, 2560×1440 et 390×844, sur contenu plein, partiel et vide lorsque ces états existent. Les critères portent sur le bord inférieur, les contrôles fixes, le propriétaire du scroll, l’absence de recouvrement, l’absence d’overflow document et la stabilité avant/après interaction.

## Fenêtre Aide standalone R1026

Réutiliser le pattern floating-panel et useModalDialog : backdrop, fermeture sombre, Escape, trap/retour de focus. Header/recherche/navigation/footer fixes ; seul .help-guide-body est propriétaire du scroll. Sur mobile, navigation horizontale compacte et fenêtre bornée à la hauteur disponible ; aucun scroll masqué ni contrôle recouvert. Le contrat de contenu appartient à [help-guide-v1.md](help-guide-v1.md), distinct du Tutoriel et du Help textuel.

## Retouches post-recette et Arcade multijoueur — R1027–R1031

Profil > Personnalisation : seule la sous-navigation Avatars/Titres est sticky dans le body scroll réel du profil, fond opaque et z-index local ; ni la navigation Profil ni les autres onglets ne deviennent sticky. Titres de niveaux = famille dérivée PLAYER_LEVEL, ordre 100/75/50/25/10 ; gradients sombres améthyste/platine/or/argent/bronze, noms/conditions/locked/owned/equipped lisibles. Les autres familles ne rejoignent pas cette section.

Social : pastille accessible à droite du pseudo sans retirer les textes existants. MP : même pastille à gauche depuis R1083, sans nouveau texte visible. PRIVATE : aucun point ; [règles et projection groupée](global-chat-v1.md#self-mention-et-présence-des-mp--r1027).

Arcade : [contrat étape 28](arcade-v1.md#multijoueur-arcade--étape-28). Bloc compact dans la colonne gauche existante, plateau central de dimensions inchangées ; boutons Prêt/Annuler et Refuser présents avec largeur réservée. Petit desktop/mobile : bloc avant plateau dans le flux, aucun overflow horizontal ; Règles/Records restent accessibles. Deux vrais pseudos/couleurs fixes et indication accessible de soi en partie partagée ; aucune citation IA, droite structurellement vide. Les états pending/active/quit/replay utilisent les mêmes cadres ; aucune nouvelle ScreenId ni destination.

## Correctif post-recette 28 — candidat

Titres : contrat R1027 conservé ; la projection backend utilise le kind canonique de 059 pour les cinq levelRequirement, alimentant réellement heading/ordre descendant/gradients et onglets sticky existants. Quotidiennes : la classe daily-tracker-summary retire uniquement l’uppercase des messages de synthèse (Terminé ✅) ; titres d’activités uppercase conservés. Arcade : réponses serveur appliquées immédiatement, opponents secondaires et cadence adaptative ; aucune modification de géométrie des plateaux. Autostart R1033 réutilise le même gate métier et toute la présentation Tutoriel existante. Sources : [Arcade](arcade-v1.md), [Tutoriel](tutorial-v1.md), [Quotidiennes](home-daily-tracker-v1.md).

## Sélecteur de personnage Team — amendement du 10/10/2026

La modale bornée au viewport utilise quatre lignes : titre/fermeture, recherche/élément, grille flexible, sélection/Confirmer. Seule `.selector-character-scroll` défile ; header, filtres et footer restent fixes, même à 390×844. Réutiliser `useModalDialog` (Tab, Escape, focus rendu) ; durant l’enregistrement, fermeture et contrôles sont désactivés pour préserver la mutation. Aucun changement des règles Team ou de la création UI explicite. Contrôle GameShell/CSS réels et contenu plein/filtré/vide aux quatre viewports du contrat : [preuves](../architecture/command-fixes-20261010.md).

Polish post-recette validé le 10/10 : le scroll est délimité par le cadre Box (bordure, fond sombre, rayon 10 px et padding intérieur 12 px), espacé des filtres. Recherche et Élément compacts à 32 px, libellé Élément aligné au contrôle ; empilement mobile conservé. Vérifier les bornes réelles du cadre, des cartes et de chaque contrôle au repos et en scroll, pas seulement l'absence d'overflow du document. Aucun nouveau composant de modale ni changement des règles Team.
