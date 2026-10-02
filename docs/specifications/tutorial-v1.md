# Tutoriel interactif V1 — source canonique

Statut au checkpoint du 02/10/2026 : **25A implémentée et testée localement, candidate review uniquement, non publique et non validée par Axel**. Décisions [R1015–R1020](decisions-log.md) ; reprise globale et prochaine action au [Master](../master/PROJECT_MASTER_PLAN.md).

## Phase 25A — prototype manuel

Le prototype valide d’abord le moteur overlay/spotlight, la progression, le placement des bulles, la pause/reprise persistante et le Menu sur la vraie interface Accueil/sidebar/chat.

- Démarrage uniquement par `Menu > Tutoriel` ; aucun autostart de première arrivée, aucun bouton Tutoriel supplémentaire dans le header (R1015).
- Si le lancement vient d’un autre écran, rejoindre Accueil avant d’ouvrir l’étape. La séquence reste sur Accueil.
- Assombrissement global, **une seule zone réelle montée mise en lumière**, courte bulle à proximité ; aucun screenshot ni copie de composants (R1016).
- Toutes les interactions sous-jacentes sont bloquées, y compris dans le spotlight et au clavier : aucun Pull, claim, changement d’équipe, navigation involontaire ou envoi de message.

### Contrôles et progression — R1017

| Contrôle | Effet |
| --- | --- |
| `Suivant` | Étape suivante ; à la fin de la séquence, clôture normale en `COMPLETED`. |
| Clic ailleurs sur l’overlay | Même effet que Suivant, sans action métier sous-jacente. |
| `Pause` | Ferme l’overlay en conservant l’étape courante. |
| `Escape` | Même effet que Pause. |
| `Terminer` | Saute le reste, ferme l’overlay et marque `COMPLETED`. |

Les clics des contrôles sont interceptés : Pause/Terminer ne déclenchent jamais un Suivant supplémentaire. Les trois contrôles remplacent le détail ancien à quatre contrôles de R822.

### Persistance et Menu — R1018/R1019

Réutiliser le modèle physique `PlayerPreference`, **sans nouvelle table ni migration**, avec la clé stable retenue `tutorial_v1` :

```ts
{
  version: 1,
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
  stepId: string | null
}
```

`IN_PROGRESS` conserve un identifiant connu de l’étape affichée ; `NOT_STARTED` et `COMPLETED` utilisent `stepId: null`. Enregistrer l’étape courante pour que Pause, reload, sortie puis reconnexion reprennent exactement cette étape, sans dépendre d’une écriture à la fermeture du navigateur.

Le service/API Tutoriel candidat est dédié et authentifié : Player dérivé de la session, aucun PlayerId arbitraire client ni route JSON générique de préférences. Le serveur valide strictement version, statut et identifiants connus. Une valeur absente/invalide ou une étape disparue se lit comme `{ version: 1, status: "NOT_STARTED", stepId: null }`, sans écriture de réparation implicite. PUT refuse un stepId non nul pour NOT_STARTED/COMPLETED, un IN_PROGRESS sans étape connue et toute propriété supplémentaire.

| État enregistré | `Menu > Tutoriel` |
| --- | --- |
| `NOT_STARTED` | Commence au début. |
| `IN_PROGRESS` | Reprend le `stepId` enregistré. |
| `COMPLETED` | Rejoue volontairement depuis le début, jamais depuis un ancien stepId terminé. |

La destination Tutoriel reste disponible dans le Menu après complétion ; la complétion ne la masque pas. Le prototype n’ajoute pas de raccourci au header.

### Séquence figée sous délégation — R1020

Les identifiants ci-dessous sont stables. Les textes sont une base courte de prototype, ajustable sans changer le sens ; ils ne constituent pas la Help finale.

| Ordre / stepId | Zone réelle | Texte de base |
| --- | --- | --- |
| 1 — `profile` | Profil de la sidebar | Avatar, pseudo, niveau et élément. Un clic normal ouvre les détails du Profil. |
| 2 — `resources` | Ressources + Particules de la sidebar | Vos Primos, Moras et particules, avec des raccourcis contextuels. |
| 3 — `active-team` | Équipe active | Voici la Team actuellement utilisée. |
| 4 — `objective` | Objectif actuel | Retrouvez votre cible Invocation et ses principales informations. |
| 5 — `daily-tracker` | Quotidiennes sidebar | Parcourez les rappels et accédez aux activités du jour. |
| 6 — `main-navigation` | Barre centrale | Accueil, Invocation, Personnages, Activités, Sac, Boutique et Configuration : vos destinations principales. |
| 7 — `home` | BannerHero + résumé Quotidiennes | La bannière mène à Invocation. Quotidiennes résume ce qu’il reste à faire. |
| 8 — `community` | Panneau de droite | Retrouvez ici le Chat global et les Messages privés. |

## Contrat technique du moteur

- Ancres stables `data-tutorial-anchor` correspondant aux stepIds, ou registre de refs typé équivalent ; aucun sélecteur CSS fragile. Une zone composée utilise les références de ses composants réels pour une seule région de spotlight.
- Overlay viewport fixe, au-dessus du Chat et des modales ordinaires. Spotlight calculé à partir des vrais `getBoundingClientRect`, actualisé sur resize/layout, sans polling rapide inutile.
- Bulle à droite/gauche/bas/haut selon l’espace, bornée au viewport ; ne pas couvrir la cible lorsqu’une autre position sûre existe. Scroll et mobile sûrs, cible réelle rendue visible si nécessaire.
- Intercepter les événements sous l’overlay et la propagation des contrôles ; préserver focus clavier, Escape, reduced-motion et lecteur d’écran.
- Le contrat doit être testé sur la vraie interface et ses changements de dimensions ; validation technique distincte de la validation visuelle/expérience du propriétaire.

## Phase suivante — après validation propriétaire du prototype

Une mission ultérieure pourra étendre la séquence et les domaines, décider puis raccorder l’autostart de première arrivée, finaliser Help/Aide et éventuellement introduire des étapes exigeant une vraie action. La navigation multi-écrans pendant la séquence et la découverte progressive par niveau ne font pas partie de 25A.

**Help textuel/commandes, Tutoriel interactif et Aide/Guide standalone sont des présentations distinctes.** Les décisions R728–R731 de l’[audit Help](../legacy/23-help-command-coherence-audit.md) restent acquises. Le Help final de l’étape 25 est différé après validation du prototype ; il n’est pas implémenté par 25A.

## État physique candidat 25A

Le registre `src/navigation/navigation.ts` contient `tutorial`, `screen: null`, `available: true` et une action dédiée ; GlobalMenu la déclenche sans ScreenId ni route écran. Toujours ordonnable/masquable par Configuration > Menu, disponible avant/après complétion. Aucun bouton Tutoriel au header.

`src/tutorial/tutorial-controller.ts` porte la progression confirmée et une garde synchrone : lecture à chaque lancement manuel, IN_PROGRESS repris sans nouvelle écriture, démarrage/replay écrit profile, transitions écrites avant présentation, dernière étape/Terminer écrivent COMPLETED/null. Une panne conserve l'étape et l'intention exacte ; Suivant réessaie cette intention, Terminer est neutralisé jusqu'à résolution ou Pause. Pause/Escape n'écrivent rien ; pendant une écriture déjà partie, leur fermeture est différée jusqu'à son résultat afin de conserver la dernière étape confirmée. Aucun beforeunload/pagehide. Le contrôleur est propre au Player, sans autostart ni lecture quotidienne supplémentaire.

`TutorialOverlay.tsx` utilise un portal document.body hors du root inert ; capture des interactions extérieures, focus initial Pause, Tab borné et événements clavier du dialogue arrêtés avant les raccourcis sous-jacents. Les nouveaux portals ordinaires sont neutralisés ; inert/aria-hidden préexistants et focus sont restaurés au cleanup. Le spotlight n'a aucun filtre floutant : la vraie cible reste nette et non interactive. ResizeObserver, événements resize/scroll et mutations de layout déclenchent une mesure coalescée par requestAnimationFrame ; aucun polling. `tutorial-geometry.ts` unionne les rectangles et choisit le placement borné avec le moindre recouvrement. Sur mobile, les cartes réelles de sidebar se regroupent temporairement pour les étapes 1–5 ; la Communauté repliée est révélée seulement pour community, puis son état précédent revient. Pause/Terminer laissent Accueil. Si la cible Home est plus haute que le viewport mobile, la région réelle est découpée aux limites visibles ; le défilement reste possible et la bulle reste accessible.

Backend : routes `server/src/api/routes/tutorial.ts` GET/PUT `/api/v1/me/tutorial` → `TutorialPreferencesService` → `PrismaTutorialPreferenceStore`, lookup/upsert sur la PK composée existante avec la seule clé `tutorial_v1`. Le schéma Prisma reste inchangé ; dernière migration 058, aucune 059.

Tests contrôleur, overlay, géométrie, raccordement shell, validation API et isolation PostgreSQL privée ajoutés, dont le retrait d'une ancre d'un spotlight composé. Ciblés frontend Tutoriel/Quotidiennes/BannerHero/Menu/navigation PASS 138/138 ; backend Tutoriel/navigation PASS 31/31 ; DB privé PASS 1/1. Suites finales frontend 1175/1175 et backend hors DB 1099/1099, verify:quick 5/5 et verify:full 8/8. Chromium réel avec GameShell et CSS production : huit étapes aux quatre formats 2560×1440, 1920×1080, 1366×768 et 390×844 ; focus, clic extérieur/boutons, Escape, double clic/tactile, retry, reprise après reload, replay, resize et Communauté repliée/restaurée contrôlés. Captures et logs d'inspection restent locaux, hors Git ; ces preuves techniques ne remplacent pas la validation propriétaire. La phase suivante et Help final restent hors périmètre.
