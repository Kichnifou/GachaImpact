# Retraits indépendants R1087

Chaque patch retire un seul lot depuis le candidat runtime indiqué dans `manifest.json`, en conservant les onze autres lots et les corrections R1086. Les patches sont des recettes complètes de retrait : **ne pas les cumuler avec un `git revert` des mêmes commits**. La combinaison de plusieurs retraits nécessite une nouvelle qualification.

Base finale : `25a98ccf95facbb18592a8e90aaf875bf110b061`. Les douze retraits ont été compilés et testés depuis `09cd274bc12442220380a3842ef190097a4dc77c`. Après l'ajout du seul correctif CSS Sidebar, son retrait complet a été recompilé et retesté depuis la base finale ; les onze autres patches restent identiques, avec nouvelle vérification de types et d'application, des chemins touchés et de la conservation exacte de la Sidebar finale. Le registre distingue `priorGatesBase` et les gates de requalification finale.

Depuis une copie propre du dépôt au candidat ou à un checkpoint documentaire ultérieur :

```sh
node docs/architecture/evidence/r1087-rollback/apply-r1087-rollback.mjs Statistics
```

Le script contrôle la propreté des fichiers suivis, l'absence de changement runtime depuis la qualification, le SHA-256 du patch et son application à l'index. Il ne commite et ne publie rien. Inspecter ensuite le diff, réexécuter la compilation et les tests listés pour le lot, puis suivre le workflow normal de livraison sur review et main.

Commandes de qualification exécutées pour chaque retrait initial, puis à nouveau pour Sidebar à la base finale :

```sh
node node_modules/typescript/bin/tsc -p tsconfig.app.json --incremental false
node node_modules/typescript/bin/tsc -p tsconfig.node.json --incremental false
node node_modules/vite/bin/vite.js build
node node_modules/vitest/vitest.mjs run <fichiers du tableau tests du lot>
```

Les onze autres retraits ont ensuite repassé la première commande sur la base finale. Les codes de sortie nuls consignés dans `gates` représentent les contrôles réussis.

`manifest.json` consigne les commits retirés (ordre historique), fichiers concernés, adaptations de contexte, contrôles et empreintes. Les octets des patches sont protégés de la conversion LF/CRLF par `.gitattributes`.

Le retrait Statistiques conserve explicitement le hook `data-profile-view`, le `data-fit-screen` de Personnalisation et les huit règles de navigation compacte partagées qui sont nécessaires à ce dernier lot. Il retire les règles propres aux statistiques. Le retrait Personnalisation peut conserver les hooks neutres du profil apportés par le lot Statistiques.

Limites : compilation et tests locaux, sans mutation publique ni base de données. Les captures de recette du candidat complet ne constituent pas des captures de chacun des retraits. Toute évolution runtime après cette base impose une requalification.
