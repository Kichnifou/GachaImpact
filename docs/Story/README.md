# Les Origines — organisation du dossier Story

## Le principe

**Un seul fichier narratif à éditer : `STORY_SOURCE.md`.** Les fichiers du dossier `lecture` sont générés à partir de cette source. Le Word est un export daté, pas une deuxième bible active.

Une décision peut avoir plusieurs conséquences narratives. Elles sont suivies par les identifiants et les liens entre blocs ; les fichiers de lecture n’ont jamais à être corrigés un par un. La synchronisation n’est cependant pas une vérification automatique des motivations ou des paradoxes.

## Où placer ce dossier

Le ZIP contient déjà le chemin `docs/Story`. Son contenu est destiné à la racine locale du projet :

```text
C:\Users\axeld\Documents\GachaImpact
```

Avant la copie, conserver toute modification locale de l’ancienne bible. L’exemplaire v1.0 placé dans `archive` est celui fourni dans la conversation, pas une récupération d’un commit GitHub. Aucun accès au disque Windows ni aucune modification du dépôt distant n’a été effectué pour cette livraison.

Le document Word historique peut être retiré de la racine de `docs/Story` après archivage afin de ne pas le confondre avec la source actuelle. Ne pas supprimer un exemplaire local différent sans le comparer.

## Organisation

```text
docs/Story/
  STORY_SOURCE.md             <- seule source narrative modifiable
  README.md                  <- mode d'emploi, pas de lore à recopier
  tools/
    generer-story.mjs         <- génère et vérifie les vues
    exporter-word.py          <- export Word facultatif
  lecture/
    00_LIRE_DABORD.md
    01_RESUME.md
    02_DECISIONS_CONFIRMEES.md
    03_PROPOSITIONS_ET_QUESTIONS.md
    04_CHRONOLOGIE.md
    05_CHAPITRES.md
    06_INDEX_ET_IMPACTS.md
  exports/
    Jeu_original_Bible_narrative_v1_1_Monde_des_Origines.docx
    EXPORT.json                <- version et empreinte de l'export
  archive/
    Jeu_original_Bible_narrative_v1_0_Monde_des_Origines.docx
    MIGRATION_v1_0_vers_v1_1.md
    VERIFICATIONS_LIVRAISON.md
```

## Utilisation habituelle

Depuis le terminal du dossier `docs/Story`, après une décision et une modification de la source :

```powershell
node .\tools\generer-story.mjs
```

Le script fonctionne aussi depuis la racine du projet :

```powershell
node .\docs\Story\tools\generer-story.mjs
```

Il demande Node.js 18 ou plus récent, sans installation npm. Les fichiers de lecture sont déjà fournis et peuvent être lus sans exécuter quoi que ce soit. Le diagramme de chronologie est accompagné d’un tableau et d’un parcours textuel pour les lecteurs qui n’affichent pas Mermaid.

## Modifier un bloc sans chercher toutes ses copies

Chaque entrée utilise des repères stables, par exemple :

```text
<!-- BEGIN:SEVERAN-002 -->
...
<!-- END:SEVERAN-002 -->
```

Une future correction doit annoncer le fichier, la balise de début à chercher, la balise de fin, puis le bloc complet à remplacer. Ne pas modifier le titre d’un bloc pour en changer l’identifiant. Ne pas remplacer globalement une lettre isolée comme H ou C dans un document.

Pour voir quelles entrées relire après un changement :

```powershell
node .\tools\generer-story.mjs --impact SEVERAN-002
```

Pour obtenir le bloc exact actuel à copier :

```powershell
node .\tools\generer-story.mjs --bloc SEVERAN-002
```

Pour vérifier que toutes les vues correspondent à la source sans rien écrire :

```powershell
node .\tools\generer-story.mjs --check
```

Les liens déclarés restent une aide : ils ne peuvent pas repérer une conséquence narrative qui n’a pas été renseignée. Après un changement de causalité, relire les événements, chapitres et audits concernés dans **le même fichier source**.

## Statuts et provenance

`CONFIRME` signifie que l’orientation a été explicitement posée par l’auteur. `PROPOSE` signifie qu’elle est encore une solution de travail. `OUVERT` désigne un arbitrage restant. Le champ `origin` précise `utilisateur`, `assistant` ou `v1`.

La vue des décisions confirmées ne reprend que l’énoncé principal du bloc. Une proposition détaillée ne devient pas canon par simple proximité avec une orientation confirmée. Pour des décisions importantes, séparer les règles plutôt que mélanger des niveaux de certitude.

Les métadonnées sont écrites en JSON sur une ligne. Le générateur vérifie leur syntaxe, les doublons d’identifiants, les références et l’ordre des événements/chapitres. Il s’arrête avant la génération en cas d’erreur de structure.

## Word : facultatif, au moment utile

Le Word fourni correspond à la source de la livraison. Après une modification, le dossier de lecture signale s’il est devenu ancien. Il n’est pas nécessaire de l’éditer ou de le régénérer à chaque petite décision.

Pour régénérer aussi un export Word, Python 3 et le paquet `python-docx` sont nécessaires. Ils ne sont pas requis pour les vues Markdown.

Après installation de ces prérequis dans l’environnement utilisé :

```powershell
node .\tools\generer-story.mjs --word
```

Cette commande produit Word, met à jour son empreinte et régénère les vues. Le script d’export utilise uniquement `STORY_SOURCE.md`. Pour installer sa dépendance sur un poste où le lanceur Python Windows est présent :

```powershell
py -3 -m pip install python-docx
```

Un nouvel export Word doit être relu visuellement : un test de références ne contrôle pas sa pagination. La livraison actuelle a fait l’objet d’un rendu et d’une vérification spécifiques.

## Ce qui est concerné et ce qui ne l’est pas

Concerné : documentation de l’histoire du jeu original, dans `docs/Story` uniquement.

Non concerné : code GachaImpact, données des viewers, JSON de sauvegarde, scripts Streamer.bot, économie effective du jeu, bases de données, branches et commits GitHub. Le générateur ne lit ni ne modifie ces éléments.

La version de référence est complète, mais les décisions encore proposées restent adaptables. Les identifiants existent pour rendre ces adaptations précises, pas pour figer la créativité.
