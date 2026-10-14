# Retraits indépendants R1092

Base runtime qualifiée : `d0dbba59483ddbf83b61d9e426e0ba709e8ba108`. Baseline R1091 conservée : `42ffecc0a219e8bd9d374b073c92ac873fe91bec`.

| Lot | Retrait ciblé |
| --- | --- |
| Équipe — boutons et gabarit Passifs | `git revert f426a409` |
| Shop — solde et hauteur utile | `git revert d0dbba59` |

Deux recettes exécutées séparément dans des worktrees privés depuis la base runtime : `git revert --no-commit`, comparaison exacte des fichiers indexés avec le commit retiré, types frontend, build Vite et tests du propriétaire. Deux PASS, chaque étape sortie 0. Le diff de chaque retrait ne concerne que ses propres fichiers et conserve donc l'autre lot, le backend et tous les autres acquis R1091. Les tests ciblés incluent les garanties R1091 déjà présentes dans ces propriétaires.

Avant un retrait réel sur un HEAD ultérieur : refaire fetch et contrôle du delta, appliquer uniquement le revert choisi, réconcilier ses mentions dans Master/spécifications, inspecter puis retester. Suivre review, revue indépendante, main FF, déploiements et postflight ; ne pas cumuler des retraits sans nouvelle qualification. Aucun reset ni réécriture d'historique.

Preuves et empreintes dans [le registre R1092](../r1092-visual-qualification.json). Logs complets locaux `local-data/r1092/rollback-<lot>-<outil>.log`. Avertissement Vite et bruits localhost du harnais conservés avec leurs sorties réelles. Les retraits n'ont pas été déployés ni chacun requalifiés visuellement ; aucun résultat public ou DB n'est prétendu.
