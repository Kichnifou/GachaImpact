# Retraits indépendants R1089

Les neuf recettes retirent chacune un lot depuis la base exacte de `manifest.json`, en préservant les huit autres lots et les blobs runtime/tests R1088. Les patches représentent des retraits complets : ne pas les cumuler avec un `git revert` des mêmes commits. Les combinaisons de plusieurs retraits doivent être requalifiées.

Base finale qualifiée : `6eb801f0b8111232ea0619e6a5d7fb03ff84c59f`. Baseline R1088 conservée : `0b5527243af070cb5333426d64246a2474d1d62f`. Les étapes initiales `24f67188`, `8e2e44e8`, `bb27c11f` et `2d0dda17` restent identifiées dans les champs de provenance du registre.

Depuis une copie propre au candidat ou à un checkpoint documentaire ultérieur :

```sh
node docs/architecture/evidence/r1089-rollback/apply-r1089-rollback.mjs ProfileMissions
```

Le script vérifie l'absence de changement runtime depuis la base, la propreté des fichiers suivis, le SHA-256 du patch et son application à l'index. Il ne commite, ne pousse et ne déploie rien. Inspecter le diff et répéter les contrôles du lot avant le workflow review/main.

```sh
node node_modules/typescript/bin/tsc -p tsconfig.app.json --incremental false
node node_modules/typescript/bin/tsc -p tsconfig.node.json --incremental false
node node_modules/vite/bin/vite.js build
node node_modules/vitest/vitest.mjs run <fichiers du tableau tests du lot>
```

Le registre distingue les contrôles initiaux et leur requalification. Les erreurs initiales TS2322 de fixtures Box ont été corrigées par le commit de typage appartenant au lot Box ; chaque retrait a ensuite repassé le contrôle TypeScript sur la base corrigée. Les builds et tests non affectés par ce changement de typage restent rattachés à leur base initiale. Le retrait Box inclut ce correctif et a été recompilé et retesté.

Les correctifs CSS Statistiques et le libellé de recherche Box ultérieurs appartiennent à leurs lots respectifs. Leurs deux retraits complets sont recompilés et retestés depuis `bb27c11f` ; les sept autres recettes sont réappliquées en vérifiant les fichiers des autres lots, les chemins modifiés et tous les blobs R1088. Le retrait Missions préserve explicitement le libellé Box ajouté dans leur composant partagé. Les bases des vérifications de types, builds et tests restent explicites dans le registre ; aucun contrôle historique n'est présenté comme une nouvelle exécution.

Après le premier correctif de largeur du champ Shop, ce seul lot est à nouveau retiré intégralement, compilé et testé depuis `2d0dda17`. Les huit autres patches sont conservés octet pour octet et réappliqués en contrôlant le nouveau blob CSS Shop et les blobs R1088. Leurs builds/typechecks historiques ne sont pas répétés pour ce changement CSS isolé.

La dernière passe CSS `6eb801f0` inclut les corrections de largeur Shop et de priorité des sélecteurs Box : ces deux lots sont retirés intégralement, recompilés et retestés sur cette base. Les sept autres patches restent octet pour octet identiques à la passe précédente et sont réappliqués avec contrôle des CSS Shop/Box finaux et de R1088. Leurs builds/typechecks antérieurs ne sont pas répétés.

Les retraits Profil Missions et Profil Box contrôlent explicitement la conservation de l'autre lot dans `ProfileScreen`. Les règles partagées de navigation compacte Statistiques/Personnalisation appartiennent à la baseline et sont conservées. Les octets des patches sont protégés contre la conversion LF/CRLF par `.gitattributes`.

Limites : qualification locale, sans mutation publique ou de base de données ; les captures du candidat complet ne sont pas des captures de chaque retrait. Toute évolution runtime exige une requalification, même si un checkpoint purement documentaire reste applicable.
