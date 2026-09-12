# Contrat de layout UI V1

Statut : contrat transverse validé — extension physique candidate 0.88.

Ce document est la source de vérité des règles de composition et de stabilité visuelle communes. Les documents métier restent propriétaires du contenu et des actions de chaque écran ; le shell de navigation reste propriétaire des destinations.

## Écrans desktop longs

À partir du breakpoint desktop, un écran long occupe toute la hauteur utile de `screen-stage`, jusqu’au même bord inférieur que le chat. Son cadre reste fermé et visible. Il est structuré en zones fixes (header, navigation locale, recherche, filtres, tris ou actions nécessaires) puis en un body `minmax(0, 1fr)` dont le défilement est interne.

Le document, le shell et les contrôles fixes ne doivent pas défiler pour parcourir les données. Un body vide conserve la hauteur disponible : il ne raccourcit pas le cadre. Boutique, Quotidiennes, Configuration, Box, Catalogue et Modération suivent cette règle lorsqu’ils utilisent le pattern d’écran long.

Lorsqu’un panneau fonctionnel associe un header local (titre, recherche ou filtres) à un contenu susceptible de dépasser, ce header reste hors du conteneur de défilement. Tout ce qui le suit — erreurs, résumés, groupes, listes et états vides — appartient à un body `minmax(0, 1fr)` dont `overflow-y: auto` n’affiche une barre que si nécessaire. Les contrôles ou catégories placés dans une colonne sœur restent eux aussi immobiles.

## Défilement et responsive

- Le propriétaire du scroll doit être explicite ; deux scrolls verticaux imbriqués pour le même contenu sont interdits.
- Les sous-navigations ne défilent jamais verticalement. Sur desktop, leurs onglets tiennent dans la largeur disponible ; sur mobile, elles autorisent un pan horizontal interne sans imposer de largeur minimale au document.
- Sous le breakpoint desktop, les écrans reviennent à un flux naturel. Les tableaux, barres d’onglets ou contenus réellement larges défilent dans leur propre conteneur horizontal ; ils ne créent pas d’overflow horizontal du document.
- Les modales sont bornées par `100dvh`, restent fermables et conservent leurs actions dans le viewport.

## Stabilité et layout shift

Recherche, filtre, tri, pagination, mutation, chargement, état vide et feedback ne déplacent pas inutilement le contrôle qui vient d’être utilisé. Les résultats rapides utilisent un overlay ancré. Les feedbacks réservent leur emplacement ou utilisent un overlay. Les conteneurs paginés gardent une taille correspondant à leur capacité, même sur une page partielle ou vide.

Les modales d’historique Banque et Boutique ont une capacité visuelle exacte de dix lignes : dix lignes remplissent le body jusqu’au footer, quatre lignes matérialisent six emplacements vides, et zéro ligne conserve le footer à la même position. Sur desktop, la hauteur des onze rangées (header de table + dix slots) est calculée depuis le body disponible et ce body n’a aucun scroll vertical ; `scrollHeight` reste au plus égal à `clientHeight + 1 px` à 1920 × 1080 comme à 1366 × 768. Mobile peut conserver un scroll interne, notamment horizontal.

Une carte à états conserve ses dimensions extérieures et réserve ses zones internes avant l'interaction : contenu principal, état/feedback, action et confirmation ne se repoussent pas mutuellement. Ajouter une action à une carte existante ne conduit jamais à agrandir artificiellement toutes les cartes de sa grille. Lorsque le langage visuel existant offre déjà l'espace nécessaire, l'action s'intègre dans cette géométrie ; une carte sans action ne réserve aucun footer vide universel.

Une information secondaire ajoutée à un panneau compact — valeur actuelle, résumé ou statut — s'intègre dans une zone déjà dimensionnée. Elle peut se répartir sur deux lignes internes à largeur contrainte, mais ne modifie pas la bounding box externe du panneau ni la position de ses contrôles.

Une zone d'artwork conçue comme colonne plein-hauteur dans une fiche étire son enveloppe et son média jusqu'à la borne basse de la région qu'elle représente. Elle ne laisse aucune bande morte sous l'image ; le crop est assuré par le média dans cette enveloppe, sans scale arbitraire destiné à masquer un défaut de grille.

La sidebar desktop occupe exactement la hauteur utile que lui attribue le shell et ne devient pas un propriétaire de scroll. Sa densité interne peut varier selon la hauteur du viewport, sans masquer d'information essentielle ; les régions flexibles absorbent le surplus et distribuent leur contenu de façon volontaire, tandis que son bord inférieur reste aligné avec ceux du contenu principal et du chat.

## Grilles de cartes homogènes

Les cartes d'une même grille partagent leur géométrie extérieure, leurs axes visuels et les lignes de titre, description, quantité et action. L'ajout d'une action contextuelle ne déplace pas l'icône ni les lignes communes. À géométrie égale, les centres verticaux des icônes restent cohérents ; les contrôles desktop vérifient un écart maximal de 1 px entre le centre de la carte et celui de l'icône.

Lorsque deux groupes opposés représentent des objets directement comparables — par exemple adversaires et formation — leurs cartes pleines, vides ou enrichies d'informations contextuelles conservent la même géométrie extérieure au même viewport. Les informations ou actions propres à un groupe s'intègrent dans cette enveloppe sans l'agrandir.

Lorsqu'une carte représente une seule action, toute sa surface est un unique hit target accessible au clavier. Le libellé d'affordance reste visible mais n'est pas un contrôle imbriqué ni la seule zone cliquable. Hover et `focus-visible` réagissent sur le cadre entier avec l'accent contextuel de la ressource. Une carte sans action ne simule ni curseur, ni hover interactif. Une variante visuelle arbitraire n'est admise que pour une raison métier explicite.

## Drag-and-drop

Le drag-and-drop n’est utilisé que lorsqu’une spécification métier le demande explicitement. Une liste réellement prévue pour ce mode distingue deux intentions par des surfaces explicites : des zones de drop autonomes entre les lignes insèrent l’élément à cet emplacement ; le corps complet d’une ligne échange les deux éléments. Aucun seuil ou ratio calculé depuis la position du pointeur dans une ligne ne décide de l’intention. Chaque target accepte `dragover`, annonce `dropEffect = move`, et l’aperçu local rend insertion et échange nettement différents sans découper ni masquer les lignes. `Configuration > Menu` est explicitement arrow-only et n’applique pas ce contrat DnD ; Team continue de l’utiliser selon sa propre spécification.

Lorsqu’un panneau associe un contenu extensible et une action latérale stable, sa grille utilise `minmax(0, 1fr) max-content` : le contenu absorbe la largeur variable et l’action ne modifie ni sa position ni sa largeur selon l’état affiché.

Aucune requête n’est envoyée pendant le mouvement. Un drop valide produit exactement une sauvegarde. Un abandon ne sauvegarde rien. Un échec restaure le dernier état confirmé complet, y compris les éléments masqués. Une alternative accessible par boutons ou clavier reste disponible.

## Validation minimale

Chaque modification de layout transverse se vérifie au minimum à 1920×1080, 1366×768, 2560×1440 et 390×844, sur contenu plein, partiel et vide lorsque ces états existent. Les critères portent sur le bord inférieur, les contrôles fixes, le propriétaire du scroll, l’absence de recouvrement, l’absence d’overflow document et la stabilité avant/après interaction.
