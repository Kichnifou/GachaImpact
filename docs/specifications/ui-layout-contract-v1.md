# Contrat de layout UI V1

Statut : contrat transverse validé. L'état physique courant des lots appartient au Master.

Ce document est la source de vérité des règles de composition et de stabilité visuelle communes. Les documents métier restent propriétaires du contenu et des actions de chaque écran ; le shell de navigation reste propriétaire des destinations.

## Écrans desktop longs

À partir du breakpoint desktop, un écran long occupe toute la hauteur utile de `screen-stage`, jusqu’au même bord inférieur que le chat. Son cadre reste fermé et visible. Il est structuré en zones fixes (header, navigation locale, recherche, filtres, tris ou actions nécessaires) puis en un body `minmax(0, 1fr)` dont le défilement est interne.

Le document, le shell et les contrôles fixes ne doivent pas défiler pour parcourir les données. Un body vide conserve la hauteur disponible : il ne raccourcit pas le cadre. Boutique, Quotidiennes, Configuration, Box, Catalogue et Modération suivent cette règle lorsqu’ils utilisent le pattern d’écran long.

Le `screen-stage` desktop ne devient pas un second propriétaire de scroll lorsqu’il contient un `.long-screen-layout` : il borne l’écran, puis le body fonctionnel explicitement désigné porte `overflow-y: auto`. Cette règle supprime la scrollbar fantôme du shell tout en conservant une barre réelle dès que `scrollHeight > clientHeight`. Sous le breakpoint desktop, le `screen-stage` et l’écran reviennent au flux naturel.

Lorsqu’un panneau fonctionnel associe un header local (titre, recherche ou filtres) à un contenu susceptible de dépasser, ce header reste hors du conteneur de défilement. Tout ce qui le suit — erreurs, résumés, groupes, listes et états vides — appartient à un body `minmax(0, 1fr)` dont `overflow-y: auto` n’affiche une barre que si nécessaire. Les contrôles ou catégories placés dans une colonne sœur restent eux aussi immobiles.

Un `ScreenHeader` structurel et les contrôles ou panneaux qui le suivent occupent toujours des zones de layout distinctes. Le layout réserve la hauteur intrinsèque non compressible du header avant d’attribuer le reste au panneau fonctionnel ; aucun contrôle sticky ou fixe interne ne peut recouvrir son titre ou sa description. Un `z-index`, un masque, une translation ou un `overflow` coupant le contenu ne constitue jamais une correction acceptable d’un chevauchement.

Une fonctionnalité future peut conserver un onglet ou contrôle structurel désactivé et visuellement grisé lorsque celui-ci représente la composition finale connue. Elle n’ajoute pas par défaut de badge « À venir », de carte « Bientôt disponible », de texte de roadmap, de faux résultat ou de contenu fictif simplement pour combler l’espace. Cette règle s’applique aux surfaces touchées à mesure de leur évolution, sans imposer une refonte globale des placeholders historiques.

## Défilement et responsive

- Le propriétaire du scroll doit être explicite ; deux scrolls verticaux imbriqués pour le même contenu sont interdits.
- Toute zone de scroll visible appartenant à une surface sombre GachaImpact utilise le thème scrollbar commun, sous Firefox comme sous Chromium/WebKit. Sa portée couvre les descendants du shell comme les couches de modales React portalisées dans `document.body` hors de `#root`. Une nouvelle zone scrollable ne doit jamais retomber sur la scrollbar native claire du navigateur. Ce thème porte la couleur et la cohérence visuelle ; il ne sert jamais à masquer un overflow, supprimer une barre nécessaire ou modifier artificiellement la géométrie du conteneur.
- Les sous-navigations ne défilent jamais verticalement. Sur desktop, leurs onglets tiennent dans la largeur disponible ; sur mobile, elles autorisent un pan horizontal interne sans imposer de largeur minimale au document.
- Sous le breakpoint desktop, les écrans reviennent à un flux naturel. Les tableaux, barres d’onglets ou contenus réellement larges défilent dans leur propre conteneur horizontal ; ils ne créent pas d’overflow horizontal du document.
- La barre de paliers Event est une région fixe du panneau Event, hors du body vertical qui défile. Ses huit repères peuvent défiler horizontalement dans leur propre conteneur sur mobile ; ils ne provoquent jamais un débordement horizontal du document. Le score réel reste lisible au-delà du dernier repère.
- Les modales sont bornées par `100dvh`, restent fermables et conservent leurs actions dans le viewport.
- Une modale de liste potentiellement longue utilise quatre régions explicites : header, recherche/filtres/tri, body `minmax(0, 1fr)` seul propriétaire du scroll, puis footer/pagination. La pagination serveur borne la projection à sa capacité métier ; une pagination frontend placée devant un chargement intégral ne satisfait pas ce contrat. Une modale imbriquée conserve la liste parente montée, son état et sa position de scroll ; seule la modale supérieure traite Escape et le focus revient au contrôle qui l’a ouverte.

## Stabilité et layout shift

Recherche, filtre, tri, pagination, mutation, chargement, état vide et feedback ne déplacent pas inutilement le contrôle qui vient d’être utilisé. Les résultats rapides utilisent un overlay ancré. Les feedbacks réservent leur emplacement ou utilisent un overlay. Les conteneurs paginés gardent une taille correspondant à leur capacité, même sur une page partielle ou vide.

Les modales d'historique Banque et Boutique ont une capacité visuelle exacte de dix lignes : dix lignes remplissent le body jusqu'au footer, quatre lignes matérialisent six emplacements vides, et zéro ligne conserve le footer à la même position. Sur desktop, la hauteur des onze rangées (header de table + dix slots) est calculée depuis le body disponible et ce body n'a aucun scroll vertical ; `scrollHeight` reste au plus égal à `clientHeight + 1 px` à 1920 × 1080 comme à 1366 × 768. Mobile peut conserver un scroll interne, notamment horizontal.

Un navigateur paginé dont la capacité métier est de dix résultats applique le même invariant sur desktop : header, filtres et footer restent fixes, le body matérialise exactement dix slots, une page partielle complète les emplacements structurels et ne déplace pas le footer. Sa capacité normale n'utilise aucun scroll vertical ; mobile peut retrouver un scroll interne lorsque le viewport l'exige.

Une carte à états conserve ses dimensions extérieures et réserve ses zones internes avant l'interaction : contenu principal, état/feedback, action et confirmation ne se repoussent pas mutuellement. Ajouter une action à une carte existante ne conduit jamais à agrandir artificiellement toutes les cartes de sa grille. Lorsque le langage visuel existant offre déjà l'espace nécessaire, l'action s'intègre dans cette géométrie ; une carte sans action ne réserve aucun footer vide universel.

Une information secondaire ajoutée à un panneau compact — valeur actuelle, résumé ou statut — s'intègre dans une zone déjà dimensionnée. Elle peut se répartir sur deux lignes internes à largeur contrainte, mais ne modifie pas la bounding box externe du panneau ni la position de ses contrôles.

Une zone d'artwork conçue comme colonne plein-hauteur dans une fiche étire son enveloppe et son média jusqu'à la borne basse de la région qu'elle représente. Elle ne laisse aucune bande morte sous l'image ; le crop est assuré par le média dans cette enveloppe, sans scale arbitraire destiné à masquer un défaut de grille.

Dans une grille dont les cartes changent d’état en direct, toutes les cartes conservent la même hauteur extérieure au viewport courant : score, tour, soutien, titre, rang, remplacement ou feedback s’insèrent dans cette enveloppe sans modifier la rangée. Si la hauteur utile ne suffit plus à présenter le contenu et les commandes, le body fonctionnel devient propriétaire du scroll interne ; aucun `overflow: hidden` ne coupe un contrôle interactif ou une information principale pour simuler un écran sans scroll.

La sidebar desktop occupe exactement la hauteur utile que lui attribue le shell et ne devient pas un propriétaire de scroll. Sa densité interne peut varier selon la hauteur du viewport, sans masquer d'information essentielle ; les régions flexibles absorbent le surplus et distribuent leur contenu de façon volontaire, tandis que son bord inférieur reste aligné avec ceux du contenu principal et du chat.

Le panneau Communauté garde un seul body actif. Dans MP, la liste de conversations est l'unique propriétaire de son scroll ; dans une conversation, le header, l'unique statut de livraison et le composer restent hors du body messages `minmax(0, 1fr)`. La scrollbar du fil devient transparente lorsqu'il est réellement au bas et réapparaît dès que le lecteur remonte, sans `overflow: hidden`. Le passage `Chat | MP` masque explicitement la pane inactive sans la démonter. Sur mobile, Communauté reste dans le flux du `GameShell` et ne crée aucun overflow horizontal du document ; le fil et le textarea peuvent défiler verticalement dans leurs propres limites sans couper le footer.

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
