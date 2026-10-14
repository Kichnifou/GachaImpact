# Retraits indépendants R1090

Les sept recettes retirent chacune un lot depuis la base exacte de `manifest.json`, en conservant les six autres. La baseline est R1089 `0ae5e4d0959b413bc1b922c4baaf460def7c9651`. Les blobs R1088 et les fichiers R1089 non concernés sont vérifiés ; les changements autorisés R1090 sont retirés sans restaurer une version antérieure à R1089.

Depuis une copie propre à la base qualifiée ou à un checkpoint documentaire ultérieur :

```sh
node docs/architecture/evidence/r1090-rollback/apply-r1090-rollback.mjs ProfileBox
```

Lots : `ProfileBox`, `ProfileCollection`, `Appearance`, `Home`, `Team`, `EventShop`, `Inventory`. Le script vérifie la propreté des fichiers suivis, l'absence de nouveau delta runtime, le SHA256 du patch et son application à l'index. Il ne commite, ne pousse et ne déploie rien. Ne pas cumuler un patch avec le revert de ses commits.

Chaque retrait est effectué séparément dans un worktree privé : commits du lot retirés du plus récent au plus ancien, contrôle du périmètre, types frontend et configuration Node, build Vite, tests ciblés du registre. Les retraits Box et Collection conservent explicitement l'autre modification dans `ProfileScreen`. Les sept recettes portables sont ensuite appliquées séparément ; les bases et résultats exacts figurent au registre.

Qualification initiale : `f6749acb055d7201dbf000979e90e765b4185619`. Après les correctifs visuels, les retraits Box, Collection, Team et Inventory sont recompilés et retestés sur `a98168add627e5b20ef4b0a83a29b8047a6fef4b`. Les patches Appearance, Home et EventShop restent identiques octet pour octet ; leurs gates de compilation et tests restent rattachés à la base initiale, puis leur application et la conservation des autres lots sont vérifiées sur la base finale.

Le retrait Collection nécessite une résolution explicite de contexte dans la ligne partagée `data-fit-screen` : retirer uniquement la condition Collection et conserver la nouvelle condition Box, ainsi que son cadre. Le patch versionné inclut cette résolution déterministe ; aucune restauration globale de `ProfileScreen` n'est effectuée. Les imports et la classe de grille propres à Collection sont retirés avec son fichier CSS.

```sh
node node_modules/typescript/bin/tsc -p tsconfig.app.json --incremental false
node node_modules/typescript/bin/tsc -p tsconfig.node.json --incremental false
node node_modules/vite/bin/vite.js build
node node_modules/vitest/vitest.mjs run <fichiers tests du lot>
```

Inspecter le diff puis répéter ces contrôles avant le workflow review/main. Les combinaisons de retraits et toute évolution runtime nécessitent une nouvelle qualification. `.gitattributes` protège les octets des patches contre la conversion LF/CRLF.

Limites : tests locaux, aucune mutation publique ou de base de données, pas de captures visuelles de chaque retrait. L'avertissement de taille du bundle Vite est conservé dans les logs. Le harnais peut également imprimer une erreur asynchrone `ECONNREFUSED localhost:3000`, déjà observée en R1089 ; toute occurrence et le code de sortie réel sont consignés par lot, sans supprimer ni masquer l'erreur.
