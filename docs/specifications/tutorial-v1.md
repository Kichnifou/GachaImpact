# Tutoriel interactif V1 — source canonique

Statut au checkpoint du 02/10/2026 : **25A cadrée, prototype prévu, aucun runtime implémenté**. Décisions [R1015–R1020](decisions-log.md) ; reprise globale et prochaine action au [Master](../master/PROJECT_MASTER_PLAN.md). Cette spécification ne vaut pas mission de développement.

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

Le futur service/API Tutoriel est dédié et authentifié : Player dérivé de la session, aucun PlayerId arbitraire client ni route JSON générique de préférences. Le serveur valide version, statut et identifiants connus. Une valeur invalide ou une étape disparue entraîne un retour sûr au début du prototype.

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

## Contrat technique du futur moteur

- Ancres stables `data-tutorial-anchor` correspondant aux stepIds, ou registre de refs typé équivalent ; aucun sélecteur CSS fragile. Une zone composée utilise les références de ses composants réels pour une seule région de spotlight.
- Overlay viewport fixe, au-dessus du Chat et des modales ordinaires. Spotlight calculé à partir des vrais `getBoundingClientRect`, actualisé sur resize/layout, sans polling rapide inutile.
- Bulle à droite/gauche/bas/haut selon l’espace, bornée au viewport ; ne pas couvrir la cible lorsqu’une autre position sûre existe. Scroll et mobile sûrs, cible réelle rendue visible si nécessaire.
- Intercepter les événements sous l’overlay et la propagation des contrôles ; préserver focus clavier, Escape, reduced-motion et lecteur d’écran.
- Le contrat doit être testé sur la vraie interface et ses changements de dimensions ; validation technique distincte de la validation visuelle/expérience du propriétaire.

## Phase suivante — après validation propriétaire du prototype

Une mission ultérieure pourra étendre la séquence et les domaines, décider puis raccorder l’autostart de première arrivée, finaliser Help/Aide et éventuellement introduire des étapes exigeant une vraie action. La navigation multi-écrans pendant la séquence et la découverte progressive par niveau ne font pas partie de 25A.

**Help textuel/commandes, Tutoriel interactif et Aide/Guide standalone sont des présentations distinctes.** Les décisions R728–R731 de l’[audit Help](../legacy/23-help-command-coherence-audit.md) restent acquises. Le Help final de l’étape 25 est différé après validation du prototype ; il n’est pas implémenté par 25A.

## État physique avant implémentation

Contrôle du code du checkpoint de base `268c687` : le registre `src/navigation/navigation.ts` contient `tutorial`, avec `screen: null` et `available: false`. Le backend connaît cet identifiant pour les préférences de navigation, ce qui ne constitue pas une API Tutoriel.

Aucun moteur ni route/API Tutoriel, aucune préférence `tutorial_v1` produite par le code courant. Le modèle physique `PlayerPreference` existe déjà dans `server/prisma/schema.prisma`, avec clé composée Player/préférence et valeur JSON. Aucune migration requise à ce stade. La mission présente modifie uniquement la documentation : ni activation du Menu, ni persistance/runtime.
