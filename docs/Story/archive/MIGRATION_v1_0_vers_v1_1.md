# Migration de la bible v1.0 vers le dossier v1.1

Document de migration historique, non source de lore active. La source actuelle est `../STORY_SOURCE.md`.

## Ce qui a été utilisé

L’exemplaire v1.0 est celui joint à la conversation. La recherche du dépôt GachaImpact dans les dépôts accessibles au connecteur n’a pas retrouvé ce projet. Cette livraison ne résulte donc pas d’une lecture de son commit courant. Aucun fichier du disque Windows ni aucun commit distant n’a été modifié.

L’ancienne version est conservée ici, sans modification, sous son nom d’origine. Son empreinte SHA-256 est :

`6c310616d4af011e4e61237ff7c20a1932dd5ab61aa18e9002a457175b6c0009`

Avant d’installer ce dossier, conserver une éventuelle version locale plus récente : l’archive fournie ne peut pas préserver des modifications jamais transmises dans la conversation.

## Remplacement conseillé

Ne pas conserver deux bibles actives. Le changement affecte les règles, les origines, les chronologies et les chapitres ; appliquer quelques remplacements isolés au Word de 33 pages laisserait des contradictions ailleurs.

La v1.1 est déjà réécrite. Copier le dossier fourni à la racine du projet, puis lire `lecture/00_LIRE_DABORD.md`. Éditer seulement `STORY_SOURCE.md`. L’ancien Word devient une archive ; le nouveau Word reste un export de lecture.

## Où sont passées les anciennes sections ?

Les titres de la première colonne ont été relevés dans le Word v1.0 joint. Ils peuvent être copiés dans la recherche du document. Les identifiants de droite se recherchent dans la source v1.1.

| Section exacte à chercher dans la v1.0 | Emplacement de remplacement dans la v1.1 |
|---|---|
| 01 — Vue d’ensemble | NOMS-001, MONDE-001, TEMPS-001 ; vue 01_RESUME.md |
| 02 — Bases conservées et changements | CADRE-001 ; vues 02_DECISIONS_CONFIRMEES.md et 03_PROPOSITIONS_ET_QUESTIONS.md |
| 03 — Le monde avant le héros | MONDE-001, MONDE-002, HIST-001 à HIST-003 |
| 04 — Pouvoirs, graine et restitution | GRAINE-001, GRAINE-002, NOYAU-001 à NOYAU-004 |
| 05 — La règle temporelle centrale | TEMPS-001 à TEMPS-003 |
| 06 — Temps : limites et exemple | TEMPS-003 à TEMPS-005, IA-003, IA-004 |
| 07 — Chronologie : les origines à A | EVT-001 à EVT-010 |
| 08 — Chronologie : l’histoire-source | EVT-010 à EVT-016 |
| 09 — Chronologie : le parcours joué | EVT-017 à EVT-022 |
| 10 — Le protagoniste et son autre vie | NOMS-001, EVT-012 à EVT-016, FIN-002 |
| 11 — Séveran et le Concordat | HIST-001 à HIST-003, SEVERAN-001 à SEVERAN-003 |
| 12 — Le partenaire : une personne entière | COUPLE-001, COUPLE-002, GRAINE-002, FIN-001 |
| 13 — Nacre, le compagnon IA | IA-001 à IA-005 |
| 14 — Personnages structurants | PERS-001, REDEMPTION-001 |
| 15 — Les régions et leurs enjeux | REG-001 à REG-006 |
| 16 — Régions : accueil et mémoire | REG-001, REG-002 |
| 17 — Régions : travail et deuil | REG-003, REG-004 |
| 18 — Régions : identité et avenir | REG-005, REG-006 |
| 19 — Le gacha dans l’univers | GACHA-001, GACHA-002 |
| 20 — Gacha : règles à ne pas contourner | GACHA-001, GACHA-002, REDEMPTION-001, AUDIT-003 |
| 21 — Chapitres 0 à 4 | CH-00 à CH-04 |
| 22 — Chapitres 5 à 8 | CH-05 à CH-08 |
| 23 — Chapitres 9 à 12 | CH-09 à CH-12 |
| 24 — Chapitres 13 à 17 | CH-13 à CH-17 |
| 25 — Révélations et préparation | CH-00 à CH-17 : résumés et garde-fous de révélation |
| 26 — Audit des paradoxes temporels | AUDIT-001 |
| 27 — Audit des paradoxes temporels | AUDIT-001, AUDIT-002 |
| 28 — Motivations et crédibilité | AUDIT-002, AUDIT-003 |
| 29 — Fin, après-histoire et garde-fous | FIN-001, FIN-002, CH-14 à CH-17 |
| 30 — Ce qui reste modifiable | Q-001 à Q-007, plus tous les blocs PROPOSE |
| 31 — Glossaire et mémoire courte | NOMS-001 et règles du monde ; vue 01_RESUME.md |

## Changements qui ne doivent pas rester contradictoires

| Ancienne formulation ou règle | Traitement de la v1.1 |
|---|---|
| H / C et leurs indices opaques | Elio / Lyra, assortis de « joué », « du prologue » ou « de l’histoire-source ». Les rôles s’inversent si Lyra est jouée. |
| « La capsule et l’enfance » : famille adoptive, enfance suivie | Réveil adulte proposé ; vie autonome, amis, mentors et collègues sur Sélis. Les âges restent à valider. |
| Migrations pouvant inclure des lignées de Porteurs | Migrations humaines uniquement. Capsules et missions sont les exceptions ultérieures. |
| Séveran revenu de colonies extérieures | Régulateur d’Orthe dont la faction naît de la guerre locale. |
| Pouvoirs impériaux potentiellement intacts | Perte active commune, puis réveils forcés rares et dangereux. |
| Noyau présenté surtout comme une clé abstraite | Référence vivante pour la Matrice de tutelle : restaurer une élite et contrôler ses régulateurs. |
| Source scientifique cherchant seulement des extractions | Ambition initiale de réparer son passé, mais prototype incapable de réécrire l’histoire réalisée. |
| Nacre rattache le héros au retour automatique de l’assaillant | Nacre suit Séveran, extrait physiquement Elio pendant la diversion et revient avant l’ennemi. |
| Suspension au moment de l’extraction du héros | Suspension uniquement après la sortie de Séveran. |
| Extraction à la seconde 146 | Dans le minutage proposé : blessure 112, extraction 118, sortie de Séveran et suspension 146 ; reste 34 sur 180. |
| Fenêtre initiale au Méridien, sur Orthe | Laboratoire Z proposé sur Sélis ; trajet temporel jusqu’à Z puis relais spatial vers Orthe. Le Méridien reste la capitale finale. |
| Anneau repris seulement lors du final | Anneau original récupéré aux Chantiers puis protégé ; l’appareil de reprise est reconstruit plus tard. |
| Diagnostic certain de survie avant le final | Possibilité étayée mais incertaine ; confirmation directe lors de la reprise de la fenêtre. |
| Guérison d’un adversaire assimilée à un changement moral | Soins, responsabilité, choix de rompre et coopération sont des étapes distinctes. |

## Format précis des futures corrections

Fichier unique : `docs/Story/STORY_SOURCE.md`.

Chercher la balise de début de l’identifiant concerné. Sélectionner jusqu’à sa balise de fin comprise. Remplacer l’ensemble par le nouveau bloc fourni. Ne pas ajouter une seconde copie et ne pas modifier globalement des lettres isolées.

Exemple réel déjà intégré à la v1.1 :

**À chercher :**

```text
<!-- BEGIN:SEVERAN-002 -->
```

**Fin du bloc à inclure dans la sélection :**

```text
<!-- END:SEVERAN-002 -->
```

**Bloc complet de référence à utiliser comme remplacement :**

```markdown
<!-- BEGIN:SEVERAN-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002,NOYAU-003,SEVERAN-001"} -->
<a id="severan-002"></a>
## À quoi servirait exactement le noyau volé

Séveran veut installer le noyau intact dans une Matrice de tutelle : une infrastructure capable de stabiliser les réveils de ses alliés, tout en conservant sur eux un contrôle matériel.

| Besoin | Utilisation proposée du noyau |
|---|---|
| Éviter les réveils destructeurs | L’organe vivant fournit une référence active stable que les méthodes actuelles ne savent pas fabriquer. |
| Restaurer les troupes d’élite | La Matrice calibre successivement des noyaux sélectionnés ; elle ne crée ni personnes ni spécialités nouvelles. |
| Garder le commandement | Les réactivations passent par des régulateurs impériaux, au lieu de rendre à chacun une autonomie complète. |
| Consolider l’empire | Les unités ainsi stabilisées reprennent les villes, sécurisent les relais et rendent les révoltes beaucoup plus difficiles. |

Séveran ne veut ni manger le noyau, ni obtenir tous les pouvoirs en l’avalant. Il lui faut le maintenir vivant après une extraction létale pour Elio, dans un dispositif que ses laboratoires ont préparé. Même en cas de réussite, la restauration d’une armée demande des moyens, du temps et l’adaptation de chaque bénéficiaire.

Une simple mesure ancienne du noyau ne suffit pas : le processus nécessite sa réponse vivante aux instabilités. La distinction avec le réaccord libre est donc à la fois technique et politique : une référence capturée pour administrer les autres, contre une aide temporaire destinée à leur autonomie.
<!-- END:SEVERAN-002 -->
```

Ce texte est déjà présent dans la source livrée : ne pas l’ajouter une seconde fois. Il démontre le format exact utilisé pour les prochaines corrections, et permet aussi de rétablir ce bloc si une modification locale le dégrade.

Après remplacement, depuis la racine du projet :

```powershell
node .\docs\Story\tools\generer-story.mjs
```

Pour obtenir les conséquences déclarées avant de modifier la règle :

```powershell
node .\docs\Story\tools\generer-story.mjs --impact SEVERAN-002
```

La génération synchronise les vues ; elle ne réécrit pas automatiquement les autres paragraphes narratifs. Lorsqu’une règle change réellement la causalité, les blocs concernés se mettent à jour dans la même source. Les identifiants permettent de les désigner exactement.
