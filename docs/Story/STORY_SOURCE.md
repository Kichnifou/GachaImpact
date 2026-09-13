# Les Origines — Source narrative unique

Version : 1.1 — 13 septembre 2026

Ce fichier remplace la bible narrative v1.0 comme source éditable. Divulgâchage intégral. Les décisions confirmées, les propositions et les questions sont distinguées au niveau de chaque bloc.

Pour une modification ciblée, chercher la balise `<!-- BEGIN:IDENTIFIANT -->` et remplacer le bloc jusqu’à `<!-- END:IDENTIFIANT -->` inclus. Ne pas changer les identifiants pour un simple renommage. Les relations entre blocs sont déclarées dans `refs`.

Le script `node tools/generer-story.mjs` produit les vues de lecture depuis cette source. Il vérifie le format, les références et la synchronisation des sorties, pas la qualité dramatique ni les paradoxes de toutes les scènes.

# Mode d’emploi

<!-- BEGIN:CADRE-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"gestion","views":"","period":"","order":0,"refs":""} -->
<a id="cadre-001"></a>
## Périmètre de cette version

Cette version 1.1 remplace le document de travail 1.0. Elle reprend les précisions récentes de l’auteur sans transformer toutes les solutions de liaison en décisions définitives.

CONFIRME désigne une orientation explicitement fixée par l’auteur. PROPOSE désigne une solution de travail, qu’elle vienne de l’auteur ou de l’assistant. OUVERT désigne un arbitrage restant à faire. Le champ « origine » précise la provenance ; une proposition héritée de la v1.0 n’est pas automatiquement approuvée.

Orthe, Sélis, Séveran et Nacre restent les noms de travail utilisés pour la continuité du dossier. Les dates, les détails physiques de la machine et les institutions inventées ici sont révisables. Les règles temporelles sont des conventions de fiction, pas des affirmations scientifiques.

Le fichier STORY_SOURCE.md est le seul document narratif à modifier. Les vues du dossier lecture sont calculées depuis ses blocs. Le Word est un export daté de lecture, pas une deuxième source. Une décision importante peut demander de revoir plusieurs blocs liés ; la génération évite les recopies, mais ne corrige pas automatiquement la causalité.
<!-- END:CADRE-001 -->

# Fondations

<!-- BEGIN:NOMS-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":""} -->
<a id="noms-001"></a>
## Elio et Lyra : noms et rôles lisibles

Elio est le nom provisoire du personnage masculin ; Lyra, celui du personnage féminin. Les sigles H et C disparaissent de la nouvelle référence.

| Choix du joueur | Protagoniste, graine préservée et scientifique | Partenaire et personne envoyée par Orthe |
|---|---|---|
| Elio | Elio | Lyra |
| Lyra | Lyra | Elio |

Pour alléger la lecture, le présent dossier raconte la version où Elio est joué. Dans l’autre version, tous les rôles s’inversent : c’est Lyra qui sort de stase, invente la machine dans l’histoire-source et se fait sauver par Nacre ; c’est Elio qui vient d’Orthe et s’interpose au prologue. Il ne s’agit pas de deux intrigues différentes.

Les qualificatifs remplacent les indices opaques : « Elio de l’histoire-source », « Elio joué », « Lyra de l’histoire-source » et « Lyra du prologue ». « Elio futur » est un raccourci de point de vue : l’Elio joué n’est pas destiné à devenir cette autre continuation.
<!-- END:NOMS-001 -->

<!-- BEGIN:MONDE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":""} -->
<a id="monde-001"></a>
## Un seul univers, un véritable Monde des Origines

Orthe est le Monde des Origines, une planète réelle au sein du même univers que Sélis et les autres planètes. Ce n’est ni une simulation, ni un microcosme créé pour le protagoniste.

Le cosmos et les premières populations humaines proviennent de son histoire fondatrice. Des régions, pays, peuples humains et communautés de Porteurs y coexistent. L’origine cosmique précise des fondateurs reste une proposition à affiner, mais l’existence propre et l’ancienneté d’Orthe sont conservées.

Chaque région doit posséder des intérêts et des conflits qui existeraient sans Elio. Les habitants ne constituent pas une réserve de pouvoirs ou de souvenirs fabriquée pour sauver son couple.
<!-- END:MONDE-001 -->

<!-- BEGIN:MONDE-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"MONDE-001"} -->
<a id="monde-002"></a>
## Migration humaine et exceptions au départ des Porteurs

Les grandes migrations anciennes ont dispersé les humains ordinaires ; les Porteurs sont restés sur Orthe. Les capsules de sauvegarde et les missions de recherche sont des départs exceptionnels postérieurs, pas une diaspora ancienne de Porteurs.

Une population humaine importante est restée sur Orthe. Les autres planètes peuvent conserver des légendes et des vestiges de leur origine commune, sans abriter pour autant des lignées naturelles de Porteurs.

La phrase « tous les Porteurs sont restés » décrit la période des migrations fondatrices. Elle n’interdit donc pas à Lyra d’effectuer ultérieurement une mission interplanétaire, ni à Elio d’être envoyé en capsule. Le pouvoir d’Elio n’est pas expliqué par un héritage ayant sauté des générations sur Sélis.
<!-- END:MONDE-002 -->

# Histoire et factions

<!-- BEGIN:HIST-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":""} -->
<a id="hist-001"></a>
## La rupture ancienne et la perte générale des pouvoirs

Une guerre ancienne provoque la scission politique d’Orthe, la naissance du Concordat et la perte des pouvoirs actifs dans tous les camps. Séveran et ses anciens Porteurs ne bénéficient pas d’une exemption intacte.

Le conflit oppose notamment la défense d’une vie commune et de l’autonomie des peuples à la volonté de centraliser le contrôle. Les Porteurs du Concordat doivent eux aussi chercher à récupérer leurs capacités. Les armées restent majoritairement soutenues par des soldats, des installations et des moyens matériels ; quelques combattants réactivés constituent des forces exceptionnelles, pas une population entière de dieux disponibles.
<!-- END:HIST-001 -->

<!-- BEGIN:HIST-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-001"} -->
<a id="hist-002"></a>
## Les enjeux politiques de la guerre

La guerre oppose deux réponses à un problème réel : qui peut autoriser l’usage de pouvoirs capables de modifier les conditions de vie de populations entières ?

| Courant proposé | Ce qu’il défend | Sa contradiction interne |
|---|---|---|
| Pacte des Communes | Consentement local, partage des infrastructures, contrôle civil des pouvoirs dangereux et autonomie des régions. | Certains notables invoquent l’autonomie pour conserver leurs privilèges et refuser des comptes. |
| Ligue de la Tutelle, futur Concordat | Autorité centrale, prévention des catastrophes et interdiction de tout usage non autorisé des pouvoirs. | La protection devient surveillance permanente, sanctions collectives et monopole de la décision. |
| Populations humaines | Sécurité, accès à l’eau, aux routes et aux soins, représentation politique. | Elles ne forment pas un camp uniforme ; plusieurs ont de bonnes raisons de craindre leurs anciens protecteurs. |

Séveran est un régulateur d’Orthe, pas un Porteur revenu d’une colonie. Sa Ligue se constitue pendant la crise. Elle prend le nom de Concordat en prétendant rétablir une paix durable après la catastrophe. Les habitants opposés à l’empire ne doivent pas être tous innocents ou unanimement d’accord.
<!-- END:HIST-002 -->

<!-- BEGIN:HIST-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-001,GRAINE-001,NOYAU-001"} -->
<a id="hist-003"></a>
## Le Grand Bâillon : catastrophe puis exploitation politique

Le Grand Bâillon est une inhibition durable de la fonction active des noyaux. Séveran provoque son déclenchement général, y compris contre son propre camp, puis exploite le désarmement commun pour prendre le contrôle des moyens matériels.

Les signatures des Porteurs avaient été inscrites dans un réseau de sécurité commun. Pendant la guerre, un arrêt d’urgence destiné à limiter un désastre est détourné : Séveran force le système au-delà de son mode provisoire. La référence stable nécessaire aux pouvoirs actifs s’effondre et chaque noyau enregistré conserve un verrou résiduel.

Il accepte de perdre ses pouvoirs parce que sa faction a préparé des armées conventionnelles, des réserves et la prise des relais. Le bénéfice immédiat est politique et logistique. Le retour futur des pouvoirs est un objectif de recherche, pas une victoire déjà acquise.

Éteindre aujourd’hui la centrale impériale ne réparerait pas les lésions inscrites dans chaque noyau. En revanche, cela peut supprimer des contraintes supplémentaires imposées aux réveils forcés. La stabilité biologique passive reste distincte de la puissance active : les Porteurs ne recommencent pas automatiquement à vieillir.

Les capsules isolées avant l’enregistrement général échappent à cette opération. Il ne suffit donc pas d’être loin d’Orthe pour être intact : il faut n’avoir jamais été intégré au système frappé.
<!-- END:HIST-003 -->

# Origines du couple

<!-- BEGIN:GRAINE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-003"} -->
<a id="graine-001"></a>
## Une seule capsule survivante

Elio est l’unique survivant du programme de capsules. Son noyau est resté intact pendant une très longue stase sur Sélis. La cause technique précise de cette préservation reste proposée dans les blocs associés.

Les autres capsules ont échoué : leur disparition peut faire l’objet d’enquêtes et de mémoriaux, mais ne doit pas préparer en secret une réserve de nouveaux Porteurs intacts. Les habitants ne possèdent pas immédiatement toutes les preuves ; la vérité de référence de cette version reste qu’aucun autre bénéficiaire n’a survécu.

Lyra est envoyée rechercher les capsules sur différentes planètes. Elle retrouve Elio, le réveille, l’observe à distance puis doit retourner sur Orthe. Lors d’un voyage ultérieur, elle le retrouve dans la société de Sélis et prend une couverture professionnelle sur son lieu de travail.
<!-- END:GRAINE-001 -->

<!-- BEGIN:GRAINE-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"GRAINE-001"} -->
<a id="graine-002"></a>
## Le réveil adulte : solution proposée pour la nouvelle origine

Elio est déjà un jeune adulte lorsqu’il entre en stase puis lorsqu’il en sort. Cette proposition remplace l’enfance adoptive de la v1.0 et permet son intégration autonome sur Sélis.

Une stase excessivement longue et dégradée a endommagé sa mémoire autobiographique. Il conserve le langage, des connaissances et des compétences scientifiques de base, mais pas un récit exploitable de son origine. Il apprend normalement après son réveil : ses souvenirs récents ne disparaissent pas au gré des besoins du scénario.

Lyra assure les premiers secours pendant qu’il est encore inconscient, puis organise discrètement l’accès à une structure civile d’accueil, des documents et un hébergement. Elle n’invente ni une enfance ni une famille dans sa mémoire. Rappelée, elle le laisse à des personnes capables de l’aider ; elle ne l’abandonne pas affamé dans un monde inconnu.

Il se construit une place par ses études complémentaires, ses relations et son travail. Des amis, collègues ou mentors de Sélis remplacent le rôle de la famille adoptive de la v1.0. Ils doivent continuer d’exister dans l’épilogue. L’amnésie de stase reste un choix proposé, à valider séparément ; elle ne doit pas tout expliquer.
<!-- END:GRAINE-002 -->

<!-- BEGIN:COUPLE-001 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"GRAINE-001,GRAINE-002"} -->
<a id="couple-001"></a>
## Couverture professionnelle, rencontre et amour

Lors de son retour sur Sélis, Lyra se fait embaucher sous couverture dans l’environnement de travail d’Elio. Leur relation naît alors de contacts adultes, d’une amitié et de travaux communs ; au prologue, ils sont déjà en couple.

Lyra possède de vraies compétences utiles à son emploi. Sa mission consiste à vérifier la survie et la situation d’Elio, pas à le séduire. Le dossier conserve comme proposition qu’elle cesse de transmettre des informations personnelles et renonce à une mission intrusive avant de s’engager dans leur relation.

Son secret reste une faute relationnelle : l’amour n’était pas simulé, mais Elio n’avait pas toutes les informations. Les flashbacks peuvent montrer une première discussion, un désaccord professionnel, une entraide puis une scène intime ordinaire. Ils ne doivent pas réécrire rétrospectivement chaque geste tendre comme une opération réussie.

Après le sauvetage, ils discutent de cette dissimulation et décident librement de poursuivre leur relation. La reconnaissance d’avoir été sauvé n’impose ni pardon ni attachement.
<!-- END:COUPLE-001 -->

<!-- BEGIN:COUPLE-002 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"regle","views":"","period":"","order":0,"refs":"TEMPS-001,FIN-001"} -->
<a id="couple-002"></a>
## Les deux parcours du partenaire

Lyra de l’histoire-source et Lyra du prologue partagent le passé du couple jusqu’à A, puis vivent des événements différents. Le sauvetage final concerne la personne du prologue joué, pas sa version plus âgée.

La version de travail conserve la mort de Lyra de l’histoire-source pendant l’évacuation d’une cité, avant Z. Elle détruit son noyau pour empêcher une capture collective ; ce sacrifice est irréversible. Cette intrigue héritée de la v1.0 reste une proposition, pas une nouvelle décision imposée à l’auteur.

Lyra du prologue reçoit une blessure gravissime mais son noyau n’est pas détruit. La suspension préserve sa continuité. À la fin, l’équipe la récupère vivante et la soigne. Elle ne reçoit pas les souvenirs de sa version-source ; elle retrouve l’Elio avec qui elle était déjà en couple, transformé par son périple.
<!-- END:COUPLE-002 -->

# Pouvoirs et antagonisme

<!-- BEGIN:NOYAU-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-003,GRAINE-001"} -->
<a id="noyau-001"></a>
## Ce qu’est un noyau et ce qui a été perdu

Un noyau est un organe vivant primordial, pas une réserve abstraite de points de magie. Sa fonction vitale maintient la continuité biologique ; sa fonction active permet de produire des effets extraordinaires.

Le Bâillon endommage la coordination active sans abolir toute vie. Un Porteur déchu reste une personne durable, capable d’apprendre, de se battre avec des armes ou d’utiliser des outils. Il ne retrouve pas spontanément son ancien niveau par simple volonté.

Le noyau d’Elio conserve une référence active stable, mais cela ne signifie pas qu’il maîtrise tous les pouvoirs. Il perçoit plus facilement certaines structures ; sa science vient aussi de son expérience. Les autres Porteurs possèdent leurs propres spécialités, connaissances et capacités.

Un noyau réduit à des données ne conserve pas toutes les réponses d’un organe vivant. Une fois sa continuité biologique définitivement détruite, il ne se reconstruit pas à partir d’un portrait ou d’une archive de personnalité.
<!-- END:NOYAU-001 -->

<!-- BEGIN:NOYAU-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-001"} -->
<a id="noyau-002"></a>
## Le réaccord libre : pourquoi Elio peut aider

Le noyau intact d’Elio sert de référence vivante pour permettre à un autre noyau de retrouver sa propre stabilité. Il n’offre pas son pouvoir à quelqu’un et ne transforme pas l’autre en dépendant permanent.

| Étape | Ce qu’elle exige |
|---|---|
| Comprendre | Le bénéficiaire, un praticien et Nacre identifient la lésion et la signature personnelle. |
| Stabiliser | Le noyau d’Elio fournit temporairement un repère intact, avec des outils adaptés. |
| Réaccorder | Le bénéficiaire rétablit progressivement sa propre coordination, au lieu de recevoir une commande extérieure. |
| Consolider | Repos, soins, entraînement et essais rendent l’usage autonome. |

Chaque opération fatigue Elio, consomme des moyens et présente un risque en cas de précipitation. Les lésions graves peuvent laisser des séquelles ; un noyau détruit n’est pas sauvable. Les praticiens locaux sont indispensables, notamment pour des spécialités qu’Elio ne possède pas.

À terme, certains noyaux réparés et des équipements communs peuvent servir de relais de traitement, dans leurs limites. Cela ne crée pas de nouvelles graines préservées et ne rend pas Elio interchangeable immédiatement. Le travail collectif évite qu’Orthe dépende pour toujours d’une seule personne.
<!-- END:NOYAU-002 -->

<!-- BEGIN:NOYAU-003 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-001,NOYAU-001"} -->
<a id="noyau-003"></a>
## Les réveils forcés du Concordat

Le Concordat obtient de rares réactivations par des méthodes dangereuses : les pouvoirs peuvent presque retrouver leur ampleur, mais l’instabilité atteint le corps et peut altérer l’esprit du bénéficiaire.

La méthode proposée force le noyau à fonctionner sans réparer sa référence. Des implants et des charges extérieures maintiennent artificiellement la coordination. Le combattant subit des douleurs, des crises, des lésions ou des troubles de mémoire et d’impulsion ; tous ne présentent pas les mêmes symptômes.

Le mot « corruption » désigne ici une dégradation du fonctionnement, pas une équivalence entre maladie et malveillance. Certains sujets sont volontaires, d’autres sont contraints. Des personnes lucides soutiennent le Concordat ; d’autres ont été rendues dangereuses sans avoir choisi ses idéaux.

Les rares réussites coûtent cher, exigent une surveillance et ne permettent pas d’armer toute la population. Des personnages d’Orthe peuvent être tentés par ces procédés ; leur refus collectif n’est donc ni automatique ni facile.
<!-- END:NOYAU-003 -->

<!-- BEGIN:SEVERAN-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-002,HIST-003,NOYAU-003"} -->
<a id="severan-001"></a>
## Le but politique : restaurer la puissance sous tutelle

Séveran veut une élite de Porteurs durablement réactivés et dépendants de son autorité, capable d’écraser les résistances et de contrôler les infrastructures d’Orthe.

Il se présente comme le seul garant d’une sécurité que les pouvoirs libres auraient détruite. Le paradoxe de sa politique est assumé : il interdit la puissance autonome tout en voulant l’accorder à ses propres serviteurs. Cette hypocrisie prolonge le choix du Grand Bâillon.

L’objectif immédiat n’est plus de figer littéralement tous les événements futurs de l’univers. « Contrôler l’avenir » exprime une doctrine politique : contrôler les forces capables de changer l’ordre établi. Les moyens concrets sont des combattants stables, des relais, des accès, des ressources et la menace de retrait de leur puissance.

Le Concordat reste une organisation avec ses officiers, ses administrateurs, ses chercheurs et ses soutiens civils. La défaite de Séveran ne résout pas instantanément tout cela.
<!-- END:SEVERAN-001 -->

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

<!-- BEGIN:SEVERAN-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"SEVERAN-002,TEMPS-002,IA-002"} -->
<a id="severan-003"></a>
## Pourquoi le noyau jeune plutôt que celui du scientifique

L’Elio de l’histoire-source a appris à protéger son noyau et détruit sa référence exploitable lors de l’assaut en Z. L’anneau de A offre alors à Séveran une cible intacte, moins entraînée et déjà localisée.

Pendant leur collaboration, Elio prêtait ses compétences sans céder son organe. Séveran avait intérêt à exploiter ses inventions. Lorsque le scientifique découvre la finalité militaire du programme et tente d’en neutraliser les accès, la coopération devient une menace.

Lors de l’assaut, Séveran le blesse mortellement pour interrompre cette neutralisation. Elio déclenche une sécurité irréversible sur sa fonction active : l’organe ne peut plus servir de référence impériale. Ses dernières capacités physiques lui laissent cependant le temps de transmettre une consigne à Nacre avant sa mort.

Séveran connaît déjà les essais et l’ancre de A, grâce au financement, aux rapports et à l’espionnage de ses équipes. Il utilise le prototype comme solution de capture de repli, pas comme un rendez-vous providentiel. L’Elio jeune ne possède ni cette sécurité, ni l’apprentissage reçu sur Orthe.

Ce sabotage est propre à cette mort. Ne pas en déduire que tout noyau s’autodétruit à la moindre blessure : cela rendrait impossible le sauvetage du partenaire.
<!-- END:SEVERAN-003 -->

<!-- BEGIN:REDEMPTION-001 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002,NOYAU-003,GACHA-001"} -->
<a id="redemption-001"></a>
## Soigner, réparer, choisir de changer

Certains adversaires réactivés peuvent être stabilisés par le protagoniste et choisir ensuite une rédemption, voire devenir jouables. Leur guérison ne les convertit pas automatiquement au « bon camp ».

Un parcours de référence comporte la neutralisation sans destruction du noyau lorsque cela reste possible, le soin, une période de récupération, la confrontation aux actes passés puis une coopération choisie. Les victimes gardent une voix ; soigner n’efface pas les responsabilités.

Saren peut être le premier cas développé : un commandant qui a accepté un réveil forcé pour protéger son unité, a commis des violences et découvre qu’on sacrifie ses soldats. Après sa stabilisation, il doit ouvrir une évacuation, témoigner contre le programme et accepter une procédure de justice avant un pacte de coopération.

Un autre officier peut être soigné et rester loyal au Concordat. Cette possibilité montre que ses opinions ne se résumaient pas à une lésion. Les personnages sans rémission possible ne doivent pas tous être présentés comme coupables de leur état.
<!-- END:REDEMPTION-001 -->

<!-- BEGIN:NOYAU-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"","period":"","order":0,"refs":"GRAINE-001,NOYAU-001,NOYAU-002"} -->
<a id="noyau-004"></a>
## Pourquoi une nouvelle graine n’est pas fabriquée à volonté

Un noyau primordial intact ne se transmet pas automatiquement par descendance et ne se recrée pas à partir d’un prélèvement. L’existence de populations humaines pendant des millénaires ne produit donc pas spontanément une relève de Porteurs indemnes.

Les fondateurs disposaient de moyens de formation des noyaux désormais perdus ou rendus inutilisables par la rupture. Les noyaux existants forment un héritage limité. Des enfants de Porteurs peuvent exister sans recevoir automatiquement cette architecture.

Réparer un noyau encore vivant est différent d’en créer un neuf. Les futurs relais de réaccord ne démentent pas l’unicité du survivant des capsules : ils réparent progressivement des victimes du Bâillon. Cette règle interdit une solution facile du type « prélever un peu d’Elio pour fabriquer mille références intactes ».

Ce verrou de cosmologie est proposé pour soutenir le caractère indispensable de la graine. Il faudra le préserver ou trouver une autre raison explicite si la reproduction des Porteurs est développée autrement.
<!-- END:NOYAU-004 -->

# Temps et machine

<!-- BEGIN:TEMPS-001 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"regle","views":"resume","period":"","order":0,"refs":""} -->
<a id="temps-001"></a>
## La fenêtre n’efface pas le passé réalisé

La technologie ouvre la continuation matérielle locale d’un instant conservé ; elle ne modifie pas l’histoire-source de l’univers. Les personnes de la fenêtre vivent réellement, mais les événements déjà réalisés ailleurs ne sont pas réécrits.

L’instant A-source est l’expérience originale, sans attaque. A-fenêtre est la continuation ouverte depuis Z, où a lieu le prologue joué. Le scientifique a vécu A-source, puis G et Z. L’Elio joué commence dans A-fenêtre avant d’être extrait vers le présent de Z.

Ce modèle assume deux continuations d’une vie, pas une seule personne condamnée à revivre tous les mêmes choix. Il n’exige pas un multivers de planètes parallèles. Orthe et Sélis sont des mondes physiques de l’histoire-source ; seule l’enceinte du laboratoire est localement dérivée.

Dans les dialogues ordinaires, « retourner dans le passé » peut être un raccourci de personnage. Dans les explications scientifiques, il faut préciser « accéder à l’ancien instant conservé ». Tuer Séveran après son raid n’efface donc pas l’aventure.
<!-- END:TEMPS-001 -->

<!-- BEGIN:TEMPS-002 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-001,SEVERAN-003"} -->
<a id="temps-002"></a>
## Une invention naissante, une ambition plus grande

Le scientifique voulait d’abord revenir réellement en arrière pour réparer ses compromissions. À Z, son prototype ne sait faire que des ouvertures locales ancrées ; le désir de réécrire le passé n’est pas une capacité acquise.

Les essais ont porté sur des volumes réduits, des objets, des instruments et le retour de sondes. Une intrusion puis une extraction humaine n’ont pas encore été validées en conditions sûres. Séveran accepte ce risque parce qu’il dispose d’un instrument de capture, d’une protection de retour et d’une cible précise.

Le dossier ne doit pas promettre qu’une vraie réécriture deviendra forcément possible avec davantage de recherche. Au moment de son dernier message, le scientifique peut admettre que sa première ambition était peut-être impossible ou moralement dangereuse. L’Elio joué termine l’histoire avec un sauvetage limité, pas avec un pouvoir de refaire toute réalité.

La prise du laboratoire est planifiée à partir des essais et des rapports. Séveran n’arrive pas par hasard le jour d’une invention miraculeuse.
<!-- END:TEMPS-002 -->

<!-- BEGIN:TEMPS-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-001,TEMPS-002"} -->
<a id="temps-003"></a>
## Ancre, machine et accès : trois choses distinctes

L’anneau témoin est l’ancre unique de l’événement A ; la machine est l’appareil qui ouvre cet événement ; Nacre transporte des commandes et des coordonnées. Reconstruire un appareil ne recrée pas l’ancre ni un nouveau partenaire.

| Élément | Ce qu’il peut faire | Ce qu’il ne peut pas faire |
|---|---|---|
| Anneau témoin | Conserver une continuité locale unique et le reliquat de son déroulement. | Être remplacé par une copie de données ordinaires ou recommencer les instants consommés. |
| Machine chronale | Fournir énergie, confinement, accès et extraction. | Choisir librement n’importe quelle date sans ancre. |
| Nacre | Exécuter le secours, authentifier l’accès, relever un diagnostic et piloter des relais autorisés. | Produire toute l’énergie nécessaire ou fabriquer une nouvelle ancre depuis un souvenir. |

A est le seul enregistrement complet utilisable par le prototype. Le laboratoire concerné ne contient que le couple, puis les visiteurs identifiés : aucune foule consciente n’est créée puis oubliée lorsque l’enceinte disparaît.

Le volume, le temps actif et les possibilités d’extraction sont limités. Une continuation dérivée ne peut pas servir de source à une cascade d’ancres du même événement. Le coût matériel et la non-duplicabilité interdisent une réserve illimitée de noyaux ou de personnages.
<!-- END:TEMPS-003 -->

<!-- BEGIN:TEMPS-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"IA-003"} -->
<a id="temps-004"></a>
## Le lieu de Z et les deux déplacements de Nacre

Z est une date, pas une planète. Pour conserver littéralement le trajet souhaité, cette version propose un laboratoire de Z sur Sélis, puis une téléportation spatiale vers un relais d’Orthe.

Le scientifique est revenu travailler dans un observatoire de Sélis, où se trouve l’anneau de son ancienne expérience. Le Concordat possède des installations et des moyens de passage vers ce site, sans nécessairement gouverner toute la planète.

Le trajet du secours est : A-fenêtre → laboratoire de Sélis au présent Z → relais clandestin du Havre des Traverses, sur Orthe. Séveran revient séparément au laboratoire. Le Méridien reste sa capitale sur Orthe et le lieu proposé de l’affrontement final.

Cette localisation remplace la v1.0, où la fenêtre était ouverte directement au Méridien : dire ensuite « téléporté sur Orthe » aurait alors été trompeur. Si l’auteur préfère garder le laboratoire sur Orthe, il faut parler de changement de région et non de planète.
<!-- END:TEMPS-004 -->

<!-- BEGIN:TEMPS-005 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"parametre","views":"","period":"","order":0,"refs":"IA-004"} -->
<a id="temps-005"></a>
## Minutage de travail du prologue

Les chiffres ci-dessous ne sont que des repères de mise en scène. La règle essentielle est l’ordre : interposition, extraction d’Elio, retour de Séveran, puis suspension.

| Temps actif dans la fenêtre | Événement proposé |
|---|---|
| 0 seconde | Ouverture et poursuite de la scène du couple ; intrusion de Séveran. |
| Environ 112 secondes | Lyra intercepte le dispositif et reçoit une blessure grave. |
| Environ 118 secondes | Nacre extrait Elio pendant la diversion ; le héros a vu Lyra tomber. |
| Environ 146 secondes | Séveran revient ; le mode de conservation suspend le reliquat après sa sortie. |
| 180 secondes au maximum | Budget initial d’activité de l’ancre ; il reste donc 34 secondes à reprendre. |

Les dernières secondes du prologue peuvent ne pas être montrées du point de vue d’Elio. Le final reprend au point de suspension, jamais avant le coup. Le jeu n’a pas à imposer un chronomètre de 34 secondes au joueur : il s’agit de temps narratif, avec des gestes préparés et une ellipse de gameplay.
<!-- END:TEMPS-005 -->

# Nacre et le secours

<!-- BEGIN:IA-001 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":""} -->
<a id="ia-001"></a>
## Nacre : assistant de terrain, pas oracle

Nacre est un assistant mobile créé par le scientifique de l’histoire-source avec des ingénieurs d’Orthe. Elle sert aux recherches, aux diagnostics, aux réaccords et à l’utilisation de relais spatiaux déjà construits.

Son corps peut rester une petite sphère à segments mobiles. Sa personnalité, son langage, ses repères élémentaires et sa mémoire nouvelle sont distincts des archives historiques qu’elle peut perdre. Elle n’est pas l’âme de Lyra.

Sa capacité de téléportation repose sur des installations de départ et d’arrivée, des autorisations et une réserve d’énergie. Elle ne peut pas envoyer une personne n’importe où depuis un cachot, ni transporter une armée sans moyens. Les passages spatiaux existaient avant le prototype temporel ; ils ne constituent pas une autre machine à remonter le temps.

Elle dit les faits qu’elle peut vérifier et distingue clairement certitude, mesure partielle et hypothèse. Les témoins d’Orthe peuvent compléter ou contredire ses archives.
<!-- END:IA-001 -->

<!-- BEGIN:IA-002 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"SEVERAN-003,TEMPS-003"} -->
<a id="ia-002"></a>
## La dernière consigne du scientifique

Mortellement blessé, le scientifique arme une routine de secours déjà prévue dans Nacre : suivre l’ouverture hostile, récupérer sa version jeune, la ramener en Z puis l’évacuer vers Orthe.

Il ne réécrit pas un programme entier en quelques secondes. Il active une procédure d’assistance et lui transmet la signature cible, une priorité, l’accès à l’anneau et la destination d’un relais sûr. Ces fonctions ont été développées pendant les essais de l’appareil.

Il anticipe que Séveran essaiera de récupérer son noyau jeune, mais ne connaît ni le geste exact de Lyra ni le déroulement complet de l’attaque. Nacre doit saisir une occasion. Sa réussite n’est pas un événement prédéterminé par une prophétie.
<!-- END:IA-002 -->

<!-- BEGIN:IA-003 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-004,IA-002,IA-004"} -->
<a id="ia-003"></a>
## L’extraction pendant l’interposition

Nacre franchit la faille après Séveran. Pendant que Lyra s’interpose et occupe son attention, elle arrache Elio au danger, le fait repasser physiquement par la faille puis active l’évacuation spatiale vers Orthe.

La scène doit disposer les personnages de façon lisible : l’instrument de Séveran vise Elio, Lyra se place entre eux, et le corps de l’assaillant ainsi que la perturbation lumineuse masquent le retour vers la faille. Nacre entre sous couverture instrumentale de maintenance, pas grâce à une invisibilité illimitée.

Séveran ne voit pas la manœuvre. Après l’avoir mortellement blessée en apparence, il cherche Elio, constate sa disparition et revient au présent avant la fermeture. Il ne reste pas ignorant de l’échec ; il ignore d’abord son mécanisme et la destination d’Elio.

Nacre ne peut emmener le couple : la seule enveloppe d’extraction d’urgence est calibrée pour Elio et son noyau sain. Lyra vient d’être gravement blessée ; la déplacer ainsi la tuerait sans stabilisation adaptée. Nacre n’a ni les équipements ni l’énergie d’un second secours. Le final apportera précisément ces moyens manquants.
<!-- END:IA-003 -->

<!-- BEGIN:IA-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-003,IA-003,FIN-001"} -->
<a id="ia-004"></a>
## La fermeture visible et la suspension réelle

La fenêtre est suspendue après le retour de Séveran, et non au moment où Elio la quitte. Le reliquat conserve Lyra sans lui faire vivre les mois de l’aventure.

Avant de partir, Nacre transmet à l’anneau une commande de conservation d’urgence différée : après la sortie des visiteurs encore liés à la fenêtre, l’accès se ferme mais le reliquat n’est pas détruit. L’anneau entre dans une conservation dormante. Cela ne gèle ni Sélis ni les personnes extérieures.

Pour Séveran, les commandes de reprise paraissent hors service après une surcharge. Il conserve l’anneau avec le matériel saisi, en vue d’en comprendre la panne et de récupérer ses propriétés. Il ne sait pas lire le mode de conservation sans Nacre et les recherches distribuées. Ce n’est pas une invisibilité parfaite : l’anneau est exposé à la saisie, au vol ou à la destruction.

La coalition le récupère lors de l’arc des Chantiers, avant de pouvoir reconstruire la machine. Les mois d’enquête servent à réparer l’accès et préparer le sauvetage, pas à recréer un autre anneau. La conservation dépend de l’objet physique ; sa destruction ferait perdre Lyra définitivement.
<!-- END:IA-004 -->

<!-- BEGIN:IA-005 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"IA-001,IA-003,IA-004"} -->
<a id="ia-005"></a>
## Ce qui est perdu dans la mémoire de Nacre

La double extraction d’urgence surcharge l’interface de Nacre et détruit des index et des circuits de lecture. Elle garde sa personnalité et ses souvenirs nouveaux, mais ne possède plus toutes les preuves concernant Z.

Les connaissances ne sont pas stockées dans un seul « souvenir du boss ». Certaines archives étaient déjà réparties dans les relais et les laboratoires où le scientifique avait travaillé. L’aventure restaure des instruments de lecture, des accès, des journaux et des témoignages complémentaires.

Au début, Nacre peut constater l’époque, son origine scientifique et l’exécution d’un secours. Elle ne possède pas le journal complet de la mort de son créateur. Le mode de conservation est repérable techniquement, mais la survie de Lyra demeure incertaine tant que l’anneau n’est pas récupéré et correctement sondé.

Elle a vu une blessure et a perdu la télémétrie ; elle ne doit donc jamais annoncer une mort médicalement confirmée puis révéler qu’elle connaissait la survie depuis le début. La peur d’Elio vient de ce qu’il a vécu, pas d’un mensonge commode du compagnon.
<!-- END:IA-005 -->

# Gacha et progression

<!-- BEGIN:GACHA-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":""} -->
<a id="gacha-001"></a>
## Rencontrer, libérer, puis stabiliser un Accord

Aucun personnage ne peut être tiré avant une véritable rencontre narrative. Les ennemis connus restent inéligibles tant qu’ils n’ont pas choisi une coopération crédible.

Le système des Accords reste proposé pour distinguer deux actes. Le récit soigne ou libère une personne lorsque l’histoire le permet ; le tirage stabilise sa coopération de combat avec notre équipe. La guérison, le consentement et le pardon ne sont pas des résultats aléatoires payants.

Pour un ancien ennemi corrompu, la séquence est donc : rencontre comme adversaire, affrontement, stabilisation possible, responsabilité et choix, pacte de coopération, puis accès au recrutement. Un personnage nécessaire à une mission est prêté ou fourni par l’histoire.

Les compagnons sont des personnes réelles. Les déplacements par relais et les temps de mission expliquent leur présence ; l’histoire ne doit pas les montrer simultanément dans deux lieux incompatibles.
<!-- END:GACHA-001 -->

<!-- BEGIN:GACHA-002 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"regle","views":"","period":"","order":0,"refs":"GACHA-001,REDEMPTION-001"} -->
<a id="gacha-002"></a>
## Raretés, doublons et limites de gameplay

La rareté exprime une complexité de stabilisation et un choix d’équilibrage, pas une noblesse morale. Un doublon approfondit un Accord ; il ne fabrique pas un second individu.

Les Porteurs de spécialités différentes et les alliés humains équipés restent jouables dans cette proposition. Les classifications anciennes de pouvoirs peuvent enrichir leur histoire, mais ne doivent pas fixer que toute personne cinq étoiles est supérieure à toute personne quatre étoiles.

Un pool sans cible éligible bloque le tirage avant toute dépense. Les bannières personnelles respectent la progression narrative. La garantie ne repart pas arbitrairement à zéro lors d’une rencontre. Les taux et les coûts relèvent d’un document de gameplay futur, pas de cette bible.

Lyra sauvée peut devenir un personnage cinq étoiles obtenu gratuitement après sa convalescence. Ni son sauvetage ni l’issue du couple ne dépendent d’un tirage. Ce mode d’obtention demeure une proposition de la v1.0.
<!-- END:GACHA-002 -->

# Fin et conséquences

<!-- BEGIN:FIN-001 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-003,IA-004,COUPLE-002"} -->
<a id="fin-001"></a>
## Sauver sans revenir avant la blessure

Le groupe reconstruit une machine compatible avec l’anneau original et reprend le même reliquat. Il est trop tard pour empêcher l’agression, mais pas nécessairement trop tard pour sauver Lyra.

Avant le final, des mesures partielles doivent établir qu’une conservation existe et qu’une survie reste possible, sans la garantir. À l’ouverture, Elio retrouve la scène après le départ de Séveran : il ne peut plus empêcher le coup. Un examen direct détecte cependant la continuité vitale.

Éloa, Nacre et l’équipe disposent alors de ce qui manquait au prologue : une stabilisation biologique, une enveloppe d’extraction médicale et un relais alimenté. Ils ramènent Lyra dans le présent et poursuivent les soins. Elle récupère progressivement ; elle ne combat pas immédiatement comme si aucune blessure n’avait eu lieu.

La fermeture consomme l’ancre restante. Le scientifique et Lyra de l’histoire-source restent morts. Le sauvetage de Lyra du prologue n’annule ni le départ d’Elio ni les morts de la guerre. Une nouvelle machine sans cet anneau ne peut pas recommencer la même scène.
<!-- END:FIN-001 -->

<!-- BEGIN:FIN-002 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"regle","views":"resume","period":"","order":0,"refs":"FIN-001,SEVERAN-002,GRAINE-001"} -->
<a id="fin-002"></a>
## Victoire et monde après l’histoire

L’affrontement final a lieu dans le présent d’Orthe, après le raid initial et le sauvetage. La victoire empêche la Matrice de tutelle et ouvre une restauration partagée des pouvoirs, sans effacer l’histoire-source.

Le héros refuse de devenir le propriétaire des Porteurs qu’il a aidés. Le rôle de gardien des passages sous mandat commun reste proposé. Les régions conservent des désaccords, des victimes, des institutions à transformer et des recherches inachevées.

Le couple choisit de poursuivre sa relation après des soins et de vraies conversations sur le secret de Lyra. Nacre garde sa personnalité. Les liens avec les proches de Sélis sont renoués, avec le poids des années écoulées.

Les arcs suivants peuvent explorer les routes planétaires, les conséquences du Concordat, d’autres formes d’instabilité des noyaux et l’histoire des fondateurs. Ils ne réintroduisent ni une autre graine intacte survivante, ni une ancre parfaite pour annuler chaque perte.
<!-- END:FIN-002 -->

# Chronologie

<!-- BEGIN:EVT-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"Temps primordial","order":1,"refs":"MONDE-001"} -->
<a id="evt-001"></a>
## Le berceau du cosmos

Le berceau des fondateurs devient Orthe. Ses peuples et son histoire matérielle précèdent la venue du protagoniste. La formulation cosmologique fine reste à développer.
<!-- END:EVT-001 -->

<!-- BEGIN:EVT-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"","period":"Ères de fondation","order":2,"refs":"MONDE-002"} -->
<a id="evt-002"></a>
## Les migrations humaines

Les humains ordinaires peuplent d’autres planètes tandis que les Porteurs demeurent sur Orthe. Des communautés humaines importantes restent également sur le monde fondateur.
<!-- END:EVT-002 -->

<!-- BEGIN:EVT-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"Environ A − 6 040 à A − 6 000 ans","order":3,"refs":"HIST-002"} -->
<a id="evt-003"></a>
## La guerre de la Tutelle

Des catastrophes liées aux pouvoirs et des conflits de représentation débouchent sur une guerre. La Ligue de Séveran prépare le contrôle central des infrastructures ; les oppositions locales restent diverses.
<!-- END:EVT-003 -->

<!-- BEGIN:EVT-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"Environ A − 6 002 ans","order":4,"refs":"GRAINE-001,GRAINE-002,HIST-003"} -->
<a id="evt-004"></a>
## L’envoi des capsules

Des noyaux encore non enregistrés sont isolés et dispersés avant la fermeture générale. Dans la solution proposée, Elio est un jeune adulte de 22 ans lorsqu’il entre en stase. Il n’a pas encore reçu l’apprentissage complet des Porteurs.
<!-- END:EVT-004 -->

<!-- BEGIN:EVT-005 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"Environ A − 6 000 ans","order":5,"refs":"HIST-001,HIST-003"} -->
<a id="evt-005"></a>
## Le Grand Bâillon

Séveran provoque l’inhibition générale, perd ses propres capacités actives et tire parti de ses préparatifs matériels. Sa faction consolide le Concordat au nom de la paix. La réparation des noyaux devient ensuite un enjeu central des deux camps.
<!-- END:EVT-005 -->

<!-- BEGIN:EVT-006 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"Du Bâillon au réveil sur Sélis","order":6,"refs":"MONDE-002,NOYAU-003,GRAINE-001"} -->
<a id="evt-006"></a>
## L’occupation et la recherche

Orthe connaît des phases de paix contrainte, de révolte et de recomposition ; ce n’est pas une guerre de front identique pendant six millénaires. Les missions de recherche poursuivent les capsules. Lyra utilise des moyens de voyage physiques ou des relais, pas des pouvoirs intacts. Le Concordat développe lentement ses réveils forcés.
<!-- END:EVT-006 -->

<!-- BEGIN:EVT-007 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"A − 7 ans","order":7,"refs":"GRAINE-001,GRAINE-002"} -->
<a id="evt-007"></a>
## Le réveil d’Elio

Lyra retrouve l’unique capsule survivante sur Sélis. Elio sort de stase, conserve un âge biologique de jeune adulte et doit se construire une vie. Après les premiers secours et une observation distante, Lyra est rappelée sur Orthe.
<!-- END:EVT-007 -->

<!-- BEGIN:EVT-008 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"A − 4 ans","order":8,"refs":"COUPLE-001"} -->
<a id="evt-008"></a>
## La rencontre professionnelle

De retour sur Sélis, Lyra retrouve Elio grâce à sa vie professionnelle et se fait embaucher sous couverture. Ils se rencontrent alors personnellement, travaillent ensemble et deviennent amis. Elio a vécu trois années hors stase depuis son réveil.
<!-- END:EVT-008 -->

<!-- BEGIN:EVT-009 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"A − 2 ans","order":9,"refs":"COUPLE-001"} -->
<a id="evt-009"></a>
## Le couple

La relation devient amoureuse. La proposition conserve une rupture de Lyra avec sa mission intrusive avant cet engagement, sans effacer le secret sur son origine. Ces moments peuvent nourrir les flashbacks.
<!-- END:EVT-009 -->

<!-- BEGIN:EVT-010 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"A-source","order":10,"refs":"TEMPS-001,TEMPS-003"} -->
<a id="evt-010"></a>
## L’expérience originale

Elio et Lyra testent l’anneau témoin dans le laboratoire de Sélis. Il n’y a pas d’attaque dans l’histoire-source. L’expérience conserve la seule ancre complète qui deviendra exploitable. Elio a alors 29 années vécues hors stase ; son corps ne vieillit plus normalement après sa maturité.
<!-- END:EVT-010 -->

<!-- BEGIN:EVT-011 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"G = A + 4 ans","order":11,"refs":"NOYAU-002,COUPLE-002"} -->
<a id="evt-011"></a>
## La découverte d’Orthe

Le scientifique de l’histoire-source découvre comment atteindre Orthe ; Lyra lui a révélé son origine avant leur arrivée. Les habitants reconnaissent son noyau intact et travaillent avec lui. Il n’arrive pas chez un peuple qui sait déjà tout résoudre sans lui, ni chez un peuple qui ne sait rien.
<!-- END:EVT-011 -->

<!-- BEGIN:EVT-012 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"De G à A + 8 ans","order":12,"refs":"IA-001,REG-001,REG-002"} -->
<a id="evt-012"></a>
## L’allié des régions

Le couple aide plusieurs communautés, apprend leurs méthodes et construit des relais. Le scientifique conçoit Nacre avec des ingénieurs locaux. Des personnages du futur groupe lui doivent une aide réelle, d’autres se méfient déjà des solutions trop centralisées.
<!-- END:EVT-012 -->

<!-- BEGIN:EVT-013 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"De A + 8 à A + 10 ans","order":13,"refs":"SEVERAN-001,SEVERAN-003"} -->
<a id="evt-013"></a>
## Les compromis

Séveran offre des ressources et obtient des infrastructures de plus en plus centralisées. Elio croit stabiliser des services civils, puis sous-estime leurs possibilités coercitives. Il ne remet pas volontairement son noyau à la Matrice. Lyra s’oppose à cette évolution.
<!-- END:EVT-013 -->

<!-- BEGIN:EVT-014 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"evenement","views":"","period":"A + 10 ans","order":14,"refs":"COUPLE-002"} -->
<a id="evt-014"></a>
## La perte de l’histoire-source

Lyra de l’histoire-source se sacrifie pendant l’évacuation d’une cité ; son noyau est détruit. Elio s’enfonce d’abord dans le besoin de tout prévenir et participe davantage à la centralisation. Les responsabilités de Séveran dans la crise apparaissent progressivement.
<!-- END:EVT-014 -->

<!-- BEGIN:EVT-015 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"De A + 12 ans à la veille de Z","order":15,"refs":"TEMPS-002,TEMPS-004,IA-002"} -->
<a id="evt-015"></a>
## Le projet de réparer ses fautes

Le scientifique prend la mesure du programme impérial. Il retourne travailler sur Sélis, distribue des recherches correctives et développe son prototype chronal. Son ambition initiale de refaire le passé dépasse largement les résultats disponibles. Nacre participe aux essais et possède une routine de secours.
<!-- END:EVT-015 -->

<!-- BEGIN:EVT-016 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Z = A + 14 ans, avant l’ouverture","order":16,"refs":"SEVERAN-003,IA-002,TEMPS-004"} -->
<a id="evt-016"></a>
## L’assaut contre le scientifique

Séveran prend l’observatoire de Sélis. Elio est mortellement blessé, rend son noyau inexploitable et arme Nacre avant de mourir. L’assaillant utilise la machine et l’ancre pour tenter la capture de son noyau jeune.
<!-- END:EVT-016 -->

<!-- BEGIN:EVT-017 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"En Z, à l’intérieur de A-fenêtre","order":17,"refs":"IA-003,IA-004,TEMPS-005"} -->
<a id="evt-017"></a>
## Le prologue joué

Séveran entre, Nacre le suit. Lyra s’interpose ; Nacre extrait Elio pendant la diversion. Séveran constate l’absence de sa cible et ressort. La fenêtre n’est suspendue qu’après son retour ; Lyra demeure à l’intérieur, gravement blessée mais pas définitivement morte.
<!-- END:EVT-017 -->

<!-- BEGIN:EVT-018 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Z, début du parcours joué","order":18,"refs":"TEMPS-004,IA-005"} -->
<a id="evt-018"></a>
## L’arrivée chez ceux qui le connaissent

Nacre et Elio repassent par le laboratoire au présent puis rejoignent le Havre d’Orthe par un relais spatial. Les habitants ont connu le scientifique de l’histoire-source. Elio n’a pas vécu ces années ; la mort du scientifique n’est pas encore publiquement établie.
<!-- END:EVT-018 -->

<!-- BEGIN:EVT-019 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"","period":"Pendant l’arc des Chantiers","order":19,"refs":"IA-004,REG-003,REG-004"} -->
<a id="evt-019"></a>
## La reprise de l’ancre

L’équipe récupère l’anneau original parmi les équipements impériaux saisis. Elle protège sa conservation dormante avant de savoir reconstruire tout l’appareil. Les archives et les soins acquis ensuite donnent un espoir conditionnel pour Lyra, pas une assurance de succès.
<!-- END:EVT-019 -->

<!-- BEGIN:EVT-020 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Vers Z + 9 mois, durée de travail","order":20,"refs":"FIN-001"} -->
<a id="evt-020"></a>
## La dernière ouverture

Avec l’ancre originale, un nouvel appareil compatible et une équipe médicale, Elio reprend le même reliquat. Il est trop tard pour éviter le coup ; une continuité viable permet l’extraction de Lyra. Les soins se poursuivent dans le présent.
<!-- END:EVT-020 -->

<!-- BEGIN:EVT-021 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Après le sauvetage, au présent","order":21,"refs":"FIN-002,SEVERAN-002"} -->
<a id="evt-021"></a>
## La chute de la tutelle

La coalition empêche le fonctionnement de la Matrice et affronte Séveran à Orthe. Sa défaite ne modifie aucun événement antérieur. La sécurité des civils et le démontage des dispositifs impériaux font partie de la victoire.
<!-- END:EVT-021 -->

<!-- BEGIN:EVT-022 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Après l’arc principal","order":22,"refs":"FIN-002"} -->
<a id="evt-022"></a>
## Les routes ouvertes

Le couple se retrouve sans effacer le secret ni les épreuves ; les survivants réorganisent leur monde. Les alliés restaurés gardent leur autonomie et les contacts avec les proches de Sélis sont renoués. Les expéditions futures restent dans un univers unique.
<!-- END:EVT-022 -->

# Régions et personnages

<!-- BEGIN:REG-001 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"region","views":"","period":"","order":0,"refs":"NOYAU-002,EVT-018"} -->
<a id="reg-001"></a>
## Havre des Traverses : accueil et confiance

Le Havre est un port de refuges et de routes suspendues. Les habitants doivent décider comment accueillir sans épuiser leurs ressources, tandis que le Concordat instrumentalise leurs peurs.

Yselle, responsable humaine des quais, organise la survie avant de croire au héros. Varek, ancien Porteur artisan, devient le premier partenaire d’un réaccord contrôlé. Le héros réussit en écoutant ses sensations, pas en traitant son noyau comme une pièce interchangeable.

Une évacuation et la protection d’un convoi fondent la coopération. Le Collecteur des Routes, automate impérial, menace les passages. Le quartier sauvé devient ensuite un soutien logistique réel.

Apport au fil rouge : premières explications sur l’époque, Nacre et la réputation de l’autre Elio. Apport aux pouvoirs : démonstration limitée du réaccord libre, sans armée restaurée en une journée.
<!-- END:REG-001 -->

<!-- BEGIN:REG-002 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"region","views":"","period":"","order":0,"refs":"HIST-002,IA-005,COUPLE-002"} -->
<a id="reg-002"></a>
## Palais de Sel : mémoire et responsabilité

Des archives minérales conservent les versions incompatibles d’une guerre. Des falsifications ont fait porter les responsabilités et les réparations aux mauvaises communautés.

Orsane, Porteuse archiviste, a parfois dissimulé la vérité pour éviter de nouveaux massacres. Elle découvre que ce silence permet à la violence de continuer. La solution nécessite des preuves, une protection des témoins et une divulgation responsable.

Le Scribe blanc, instrument de censure, reproduit des attaques enregistrées ; ses projections ne sont pas des personnes temporellement recréées. Les fonctions de lecture de Nacre sont réparées ici.

Un témoin reconnaît Lyra et raconte sa disparition dans l’histoire-source, à une date incompatible avec le prologue. Les documents montrent aussi la collaboration réelle du scientifique avec les institutions de Séveran.
<!-- END:REG-002 -->

<!-- BEGIN:REG-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"NOYAU-003,IA-004,EVT-019"} -->
<a id="reg-003"></a>
## Chantiers de Cendre : autonomie et premiers noyaux forcés

Des villes industrielles dépendent du Concordat pour l’eau, la chaleur et le travail. Détruire brutalement les installations libérerait les ouvriers en les privant de moyens de vivre.

Deme, ingénieure humaine, et Nohé, ancien régulateur Porteur, aident à créer des alimentations indépendantes. Les plans du scientifique expliquent autant les améliorations réelles que les dépendances actuelles.

Un premier combattant au réveil forcé montre le coût humain du programme impérial. L’objectif n’est pas toujours de le tuer ; sécuriser l’installation peut permettre une stabilisation partielle. Le Géant de suie, plateforme de guerre intégrée à une centrale, reste un affrontement majeur proposé.

L’équipe récupère l’anneau témoin dans un transfert de matériel saisi. Cette opération est préparée par des inventaires et des renseignements, pas par un objet trouvé par hasard dans le butin d’un boss. L’anneau est ensuite protégé dans une installation alliée.
<!-- END:REG-003 -->

<!-- BEGIN:REG-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"COUPLE-002,FIN-001,IA-005"} -->
<a id="reg-004"></a>
## Jardins du Seuil : soin, deuil et chance limitée

Les Jardins mêlent centres de soins et mémoriaux. Les ressources destinées aux anciens Porteurs entrent en concurrence avec les besoins des humains ordinaires.

Miren, soignant humain, conteste les priorités héritées. Éloa, Porteuse spécialiste de stabilisation biologique, distingue un noyau encore viable d’une personne définitivement perdue. Le Cerf de verre, gardien malade, peut faire l’objet d’une victoire par stabilisation plutôt que destruction.

La tombe et les témoins établissent la mort de Lyra de l’histoire-source. L’analyse de l’anneau retrouvé prouve la conservation d’un reliquat ; une survie reste envisageable, mais le diagnostic à distance ne permet pas de la garantir.

Elio refuse de priver les soins civils de leurs moyens pour accélérer sa tentative personnelle. Il choisit les autres avant d’avoir la certitude que cette décision lui rendra Lyra. L’équipe élabore une extraction médicalisée différente du secours de Nacre au prologue.
<!-- END:REG-004 -->

<!-- BEGIN:REG-005 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"GRAINE-002,COUPLE-001,REDEMPTION-001"} -->
<a id="reg-005"></a>
## Villes du Contrejour : identité et responsabilité

Une région de registres, de masques civils et de tribunaux protège des persécutés mais peut aussi dissimuler des auteurs de violences. Le Concordat utilise le visage d’Elio pour lui attribuer les actes de sa version-source.

Léandre, enquêteur humain, distingue filiation d’une histoire et culpabilité personnelle. L’enquête expose les capsules, le réveil adulte, les réseaux d’accueil et la couverture de Lyra. Des lettres et des témoins établissent une amitié réelle, sans excuser le secret.

Saren est confronté aux conséquences des réveils forcés. Une stabilisation possible ne suffit pas à faire de lui un allié : sa coopération dépend d’un choix et d’actes de réparation.

Le masque qui imite les habitudes du héros est un dispositif prédictif utilisant des données, pas un nouveau double temporel. L’arc doit éviter de répondre à toute question d’identité par une multiplication de versions.
<!-- END:REG-005 -->

<!-- BEGIN:REG-006 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"SEVERAN-002,TEMPS-004,FIN-002"} -->
<a id="reg-006"></a>
## Couronne des Marées et Méridien : avenir partagé

Les routes de l’archipel sont instables. Séveran promet une circulation parfaitement sûre à condition que personne ne puisse utiliser un passage sans son autorisation.

Thyr, navigateur Porteur, connaît les risques mais refuse de confondre sécurité et souveraineté absolue. Les équipes construisent un réseau où les décisions et les compétences peuvent se relayer.

Les derniers journaux établissent le décès du scientifique et son secours. Les plans impériaux révèlent la Matrice de tutelle et l’usage précis prévu pour le noyau intact. La coalition peut alors préparer à la fois le sauvetage et le démantèlement militaire.

Le Méridien reste la capitale technique de Séveran, sur Orthe. L’intrusion initiale dans A a désormais été ouverte depuis Sélis ; ne pas confondre les deux lieux. L’Aiguilleur contrôle des positions et des forces physiques, pas le temps extérieur à une fenêtre.
<!-- END:REG-006 -->

<!-- BEGIN:PERS-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"distribution","views":"","period":"","order":0,"refs":"NOMS-001,GACHA-001,GACHA-002,REDEMPTION-001"} -->
<a id="pers-001"></a>
## Distribution provisoire et accès au jeu

La distribution de la v1.0 reste une réserve de personnages à approfondir. Les rangs ci-dessous sont des propositions d’équilibrage, pas des catégories de dignité ni des décisions irréversibles.

| Personnage | Situation | Place proposée |
|---|---|---|
| Yselle | Humaine, responsable du Havre. | 4 étoiles ; recrutement scénaristique initial. |
| Varek | Porteur artisan déchu. | 4 étoiles ; premier réaccord libre. |
| Orsane | Porteuse archiviste. | 5 étoiles ; pacte après l’arc des archives. |
| Deme | Humaine, ingénieure des Chantiers. | 4 étoiles ; expertise matérielle essentielle. |
| Nohé | Porteur régulateur, ancien compromis avec le régime. | 5 étoiles ; réparation et responsabilité. |
| Miren | Humain, soignant. | 4 étoiles ; accès aux soins sans privilège d’origine. |
| Éloa | Porteuse, spécialiste de stabilisation. | 5 étoiles ; diagnostic et équipe de sauvetage. |
| Léandre | Humain, enquêteur. | 4 étoiles ; identité distincte de culpabilité. |
| Saren | Porteur, commandant du Concordat, réveil forcé. | 5 étoiles possible après soin, rupture et coopération. |
| Thyr | Porteur, navigateur. | 5 étoiles ; routes et choix collectifs. |
| Lyra, dans le point de vue Elio | Porteuse et scientifique, partenaire du prologue. | 5 étoiles gratuit par l’histoire, proposition conservée. |

Nacre demeure un compagnon autonome et un personnage central du récit. Sa présence ne dépend pas du gacha. Des ex-adversaires peuvent conserver des désaccords politiques une fois alliés : la rédemption n’oblige pas à avoir la même personnalité ou les mêmes opinions qu’Elio.
<!-- END:PERS-001 -->

# Campagne

<!-- BEGIN:CH-00 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 0","order":0,"refs":"IA-003,IA-004,TEMPS-005"} -->
<a id="ch-00"></a>
## Une place à côté de toi

Le couple travaille ensemble. L’intrusion interrompt une scène de complicité. Lyra s’interpose ; Elio la voit tomber. Nacre profite de la diversion pour le ramener par la faille. Le point de vue du héros ne montre pas encore le retour ultérieur de Séveran.

Mise en scène et garde-fous : Montrer l’anneau, une défense issue d’un équipement et la blessure sans certifier médicalement une mort. Préparer la géographie de la scène pour que le sauvetage ne dépende pas d’un adversaire aveugle.
<!-- END:CH-00 -->

<!-- BEGIN:CH-01 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 1","order":1,"refs":"EVT-018,REG-001,IA-005"} -->
<a id="ch-01"></a>
## Ceux qui prononcent ton nom

Elio arrive au Havre. Certains habitants reconnaissent son visage, d’autres doutent devant son manque d’expérience. Nacre établit le décalage d’époque et dit avoir été créée par le scientifique connu ici.

Mise en scène et garde-fous : Le mystère porte sur ce que cet autre Elio a fait, pas sur une date que tout le monde pourrait donner. Sa mort n’est pas encore prouvée aux habitants.
<!-- END:CH-01 -->

<!-- BEGIN:CH-02 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 2","order":2,"refs":"REG-001,NOYAU-002,GACHA-001"} -->
<a id="ch-02"></a>
## Le prix d’un refuge

Le héros protège une évacuation et réalise avec Varek un réaccord limité. Yselle accorde sa confiance à des actes concrets. Une première équipe se forme sans imposer de tirage aléatoire.

Mise en scène et garde-fous : Montrer le consentement et le rôle indispensable du bénéficiaire. La victoire permet de mieux vivre au Havre, pas seulement d’obtenir une clé de scénario.
<!-- END:CH-02 -->

<!-- BEGIN:CH-03 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 3","order":3,"refs":"REG-002,COUPLE-002"} -->
<a id="ch-03"></a>
## Les absents ont une voix

Aux Palais de Sel, les récits d’une guerre se contredisent. Un témoin reconnaît Lyra et rapporte un événement de sa vie postérieur au prologue. Les dates incompatibles troublent Elio.

Mise en scène et garde-fous : Ne pas faire taire un témoin qui connaît son origine. Les détails de la mission et les preuves de la mort-source restent réellement à trouver.
<!-- END:CH-03 -->

<!-- BEGIN:CH-04 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 4","order":4,"refs":"REG-002,IA-005,EVT-013"} -->
<a id="ch-04"></a>
## La dette des archives

Orsane et l’équipe protègent des témoins avant de dévoiler des falsifications. Nacre récupère des moyens de lecture. Les contrats établissent que le scientifique a aidé des installations impériales.

Mise en scène et garde-fous : Un rapport sur les équipements saisis prépare la piste de l’anneau. La bonne réputation du scientifique demeure vraie sur certains aspects.
<!-- END:CH-04 -->

<!-- BEGIN:CH-05 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 5","order":5,"refs":"REG-003,NOYAU-003"} -->
<a id="ch-05"></a>
## Les mains libres

Aux Chantiers, une opération de résistance menace l’alimentation des quartiers. Un combattant réactivé par le Concordat révèle une puissance impressionnante et un état instable.

Mise en scène et garde-fous : Le premier diagnostic sépare volonté, contrainte politique et dégradation du noyau. Couper l’empire sans préparer une solution tuerait des habitants.
<!-- END:CH-05 -->

<!-- BEGIN:CH-06 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 6","order":6,"refs":"REG-003,EVT-019,REDEMPTION-001"} -->
<a id="ch-06"></a>
## Ce qu’on ne rachète pas

Des alimentations indépendantes rendent possible une libération locale. Une opération documentée récupère l’anneau original. Une stabilisation d’urgence d’un adversaire démontre qu’une autre réponse est envisageable.

Mise en scène et garde-fous : Le héros protège l’objet sans savoir encore si Lyra survit. Il ne reçoit pas le pardon pour les travaux de l’autre Elio en échange de sa réparation.
<!-- END:CH-06 -->

<!-- BEGIN:CH-07 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 7","order":7,"refs":"REG-004,COUPLE-002,TEMPS-001"} -->
<a id="ch-07"></a>
## Un tombeau, deux histoires

Les Jardins établissent la mort de Lyra-source. Nacre et Éloa expliquent les deux continuations. L’anneau contient toujours un reliquat, mais cette conservation ne signifie pas automatiquement qu’une personne est sauvable.

Mise en scène et garde-fous : Le public doit comprendre le modèle avant le dernier acte. La Lyra du prologue n’est pas remplacée par celle de la tombe.
<!-- END:CH-07 -->

<!-- BEGIN:CH-08 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 8","order":8,"refs":"REG-004,FIN-001"} -->
<a id="ch-08"></a>
## Les vivants ne sont pas une réserve

La tentative médicale devient concevable, mais une accélération priverait les soins de moyens essentiels. Elio la refuse sans garantie d’une autre réussite. L’équipe construit un protocole soutenable.

Mise en scène et garde-fous : Ne pas certifier la survie de Lyra à distance. Donner un espoir mesurable, des limites et un enjeu moral réel.
<!-- END:CH-08 -->

<!-- BEGIN:CH-09 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 9","order":9,"refs":"REG-005,GRAINE-002,HIST-003"} -->
<a id="ch-09"></a>
## Le visage dans la vitre

Au Contrejour, la propagande lui attribue les actes de l’autre Elio. L’enquête retrouve les traces de la capsule, du réveil adulte et des humains qui l’ont aidé à s’intégrer.

Mise en scène et garde-fous : Les trous de mémoire de stase sont corroborés, pas comblés d’un seul coup par une révélation magique. L’exception de son noyau a une cause matérielle.
<!-- END:CH-09 -->

<!-- BEGIN:CH-10 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 10","order":10,"refs":"NOMS-001,COUPLE-001,REDEMPTION-001"} -->
<a id="ch-10"></a>
## L’envoyée qui a choisi

Le parcours de Lyra apparaît : découverte, rappel, retour, couverture professionnelle, amitié puis amour. Saren stabilisé doit choisir ce qu’il fait des informations sur le programme qui l’a abîmé.

Mise en scène et garde-fous : Les flashbacks montrent des moments adultes réels. Le titre devient « L’envoyé qui a choisi » dans le point de vue Lyra ; les rôles s’inversent partout.
<!-- END:CH-10 -->

<!-- BEGIN:CH-11 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 11","order":11,"refs":"REG-006,FIN-002"} -->
<a id="ch-11"></a>
## Un demain sans garanties

À la Couronne, les régions préparent une circulation partagée. Thyr et ses équipages défendent une sécurité qui ne dépend pas d’un maître unique.

Mise en scène et garde-fous : Les relais et les régulateurs construits permettent autant l’autonomie d’Orthe que le futur sauvetage. Pas d’arrêt du temps cosmique pour faciliter une scène.
<!-- END:CH-11 -->

<!-- BEGIN:CH-12 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 12","order":12,"refs":"SEVERAN-002,SEVERAN-003,IA-002,TEMPS-004"} -->
<a id="ch-12"></a>
## Celui qui a refusé trop tard

Les archives montrent la prise du laboratoire de Sélis, la destruction volontaire de la référence du scientifique et sa dernière consigne à Nacre. La Matrice de tutelle donne enfin un sens précis au raid de Séveran.

Mise en scène et garde-fous : Révéler l’usage du noyau, pas seulement annoncer qu’il est très puissant. La réparation tardive du scientifique n’efface pas les victimes de ses compromis.
<!-- END:CH-12 -->

<!-- BEGIN:CH-13 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 13","order":13,"refs":"FIN-002,REDEMPTION-001,GACHA-001"} -->
<a id="ch-13"></a>
## L’empire à hauteur d’homme

La coalition désorganise les forces et protège les populations. La machine reconstruite est alimentée avec des moyens partagés ; l’anneau déjà repris est amené sous protection. Saren peut agir pour réparer ses fautes.

Mise en scène et garde-fous : Distinguer prendre une infrastructure et obtenir l’obéissance d’une région. Tous les moyens indispensables sont accessibles par le récit.
<!-- END:CH-13 -->

<!-- BEGIN:CH-14 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 14","order":14,"refs":"FIN-001,TEMPS-003,IA-004"} -->
<a id="ch-14"></a>
## La dernière fenêtre

La même fenêtre reprend après le retour de Séveran. Elio voit qu’il ne peut plus empêcher l’agression, mais un examen direct révèle une continuité vitale. L’équipe stabilise Lyra, la ramène puis poursuit ses soins.

Mise en scène et garde-fous : Montrer la différence entre « trop tard pour éviter la blessure » et « trop tard pour sauver ». L’anneau est consommé ; personne ne revient au début de la scène.
<!-- END:CH-14 -->

<!-- BEGIN:CH-15 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 15","order":15,"refs":"SEVERAN-002,FIN-002"} -->
<a id="ch-15"></a>
## Le droit de ne pas recommencer

La coalition affronte Séveran au présent d’Orthe et empêche la Matrice de tutelle. L’Elio joué refuse la place de référence captive centrale, même présentée comme un moyen rapide de tout réparer.

Mise en scène et garde-fous : La victoire doit protéger les fonctions vitales et les victimes des réveils forcés. L’ennemi n’est pas vaincu dans un passé qui annulerait son propre raid.
<!-- END:CH-15 -->

<!-- BEGIN:CH-16 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 16","order":16,"refs":"GRAINE-002,COUPLE-001,FIN-001"} -->
<a id="ch-16"></a>
## Ceux qui restent

Les morts de la guerre et de l’histoire-source restent honorés. Lyra récupère ; le couple affronte les secrets et décide de la suite. Elio reprend contact avec les proches qui ont connu sa vie sur Sélis.

Mise en scène et garde-fous : Remplacer la famille adoptive de la v1.0 par les amis, mentors et collègues réellement définis dans cette version. Aucune guérison instantanée ne gomme les conséquences.
<!-- END:CH-16 -->

<!-- BEGIN:CH-17 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 17","order":17,"refs":"FIN-002,GRAINE-001"} -->
<a id="ch-17"></a>
## Les routes ouvertes

Les passages s’ouvrent, la recherche se partage et les régions continuent de vivre avec leurs désaccords. Le groupe peut voyager vers d’autres planètes du même univers.

Mise en scène et garde-fous : Le post-game n’introduit ni une réserve cachée de graines intactes survivantes, ni une ancre de remplacement permettant de refaire toute perte.
<!-- END:CH-17 -->

# Audits

<!-- BEGIN:AUDIT-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"audit","views":"","period":"","order":0,"refs":"TEMPS-001,TEMPS-003,IA-004,FIN-001"} -->
<a id="audit-001"></a>
## Audit de la causalité temporelle

La cohérence dépend du maintien simultané de l’histoire-source, de l’ancre unique et de la reprise sans retour au début. Les principaux tests ci-dessous doivent être refaits lors d’une modification de ces règles.

| Question test | Réponse de cette version |
|---|---|
| Qui invente la machine si le héros disparaît en A ? | Le scientifique a vécu A-source sans attaque. Le parcours joué commence dans sa continuation locale ouverte en Z. |
| Le scientifique doit-il mourir pour qu’un seul Elio existe ? | Non. Il est assassiné pour des raisons politiques ; aucune loi n’interdit deux continuations. |
| Le sauvetage de Lyra annule-t-il le départ du héros ? | Non. Il reprend après l’extraction d’Elio et le retour de Séveran. |
| Pourquoi Lyra ne meurt-elle pas pendant les mois du jeu ? | Le reliquat est suspendu ; elle n’y vit pas ces mois. |
| Reconstruire l’appareil suffit-il pour créer une autre Lyra ? | Non. La même ancre physique est nécessaire, sans remise à zéro. |
| Pourquoi ne pas sauver le scientifique ou Lyra-source ? | Aucun reliquat accessible ne conserve leur continuité viable ; un récit ou un souvenir ne remplace pas l’ancre. |
| Pourquoi ne pas tirer des personnages depuis le temps ? | Le gacha stabilise des coopérations présentes ; il n’utilise pas les fenêtres. |
| Pourquoi la défaite de Séveran ne supprime-t-elle pas l’aventure ? | Elle survient au présent après son raid, sans réécriture rétroactive. |
| Pourquoi ne pas suspendre un adversaire partout ailleurs ? | La suspension ne concerne que le reliquat de l’enceinte liée à l’ancre. |

Ces réponses sont des règles de fiction choisies, pas une démonstration scientifique. Elles règlent les contradictions recensées ici sans garantir que toute scène future sera automatiquement cohérente.
<!-- END:AUDIT-001 -->

<!-- BEGIN:AUDIT-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"audit","views":"","period":"","order":0,"refs":"SEVERAN-002,SEVERAN-003,IA-003,IA-004"} -->
<a id="audit-002"></a>
## Audit des motivations et des moyens

Le noyau doit avoir une utilité précise, chaque secours doit avoir des moyens concrets et aucun personnage ne doit oublier une solution évidente uniquement pour prolonger l’intrigue.

| Objection | Réponse ou point de vigilance |
|---|---|
| Pourquoi Séveran perd-il volontairement ses pouvoirs ? | Sa faction a préparé une supériorité matérielle et accepte le désarmement commun pour capturer les infrastructures. |
| Pourquoi tous ses officiers ne dominent-ils pas déjà Orthe ? | Les réveils forcés sont rares, instables, coûteux et exigeants en maintenance. |
| Pourquoi le noyau intact change-t-il la situation ? | Il peut stabiliser les réveils sélectionnés via la Matrice au lieu de forcer des noyaux sans référence saine. |
| Pourquoi ne pas utiliser une archive du noyau ? | Elle ne reproduit pas les réponses vivantes nécessaires aux corrections successives. |
| Pourquoi ne pas voler l’organe avant Z ? | La collaboration scientifique était utile ; le prélèvement contrôlé et la stabilisation impériale sont encore un programme en développement. La rupture déclenche la prise de force. |
| Pourquoi tuer le scientifique au lieu de le capturer ? | Il neutralise les accès et sa propre référence exploitable ; l’assaut interrompt son action mais détruit l’option du noyau adulte. |
| Pourquoi le retour temporel n’efface-t-il pas ses erreurs ? | Le prototype n’a jamais atteint l’ambition de réécriture de son créateur. |
| Pourquoi Nacre ne peut-elle pas sauver deux personnes ? | Secours calibré pour un noyau sain, énergie limitée et absence de stabilisation médicale du partenaire blessé. |
| Pourquoi Séveran ne voit-il pas l’extraction ? | La position des corps, la diversion et l’intrusion instrumentale de Nacre doivent être explicitement montrées. Il constate ensuite l’échec. |
| Pourquoi garde-t-il un anneau apparemment en panne ? | C’est un vestige de recherche irremplaçable. Son mode dormant n’est pas exploitable avec ses seules commandes. La coalition le récupère ensuite. |
| Pourquoi ne capture-t-il pas immédiatement Elio sur Orthe ? | Le relais de secours n’est pas connu de ses équipes. Il doit enquêter et employer ses forces ; les réseaux réparés organisent ensuite une protection réelle. |
| Pourquoi ne gagne-t-il pas aussitôt avec le noyau volé ? | La Matrice demande des installations, des sujets compatibles, du temps et des opérations successives. |

La perte du scientifique, le mode de conservation et le vol de l’anneau restent les trois scènes techniques à storyboarder en priorité. Elles ne doivent pas dépendre d’une incapacité arbitraire des antagonistes.
<!-- END:AUDIT-002 -->

<!-- BEGIN:AUDIT-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"audit","views":"","period":"","order":0,"refs":"NOMS-001,GRAINE-002,REDEMPTION-001,GACHA-001,FIN-001"} -->
<a id="audit-003"></a>
## Audit des personnages, de la rédemption et du gacha

Les règles de recrutement et les règles de soin ne doivent pas se contredire : une personne ne devient pas aimable parce qu’elle a été « réparée », et un tirage ne décide pas qui mérite de vivre.

| Risque | Garde-fou |
|---|---|
| Le héros possède les personnes qu’il réactive. | Le réaccord vise l’autonomie ; son bénéficiaire garde la possibilité de refuser une alliance. |
| La corruption rend les ennemis moralement mauvais. | Distinguer pathologie, contrainte, convictions et actes choisis. |
| Le soin absout un ancien bourreau. | Les victimes, la justice et les réparations restent nécessaires. |
| Un personnage rencontré comme ennemi entre immédiatement dans le gacha. | Il faut un pacte de coopération après son parcours, pas seulement l’avoir vu. |
| Le héros rétablit tous les pouvoirs sans aide. | Praticiens, diagnostic, infrastructures, fatigue et rééducation font partie du processus. |
| Lyra a façonné l’enfance de son futur partenaire. | Cette version propose un réveil adulte et une relation personnelle beaucoup plus tardive, sans éducation parentale. |
| La couverture rend tous les sentiments faux. | Montrer la mission, les mensonges et les choix réels sans imposer un pardon automatique. |
| Les noms ne s’inversent plus quand Lyra est jouée. | Appliquer la table des rôles à l’origine, la mission, les morts-source, l’IA et le sauvetage. |
| Le jeune héros a une famille adoptive malgré le changement d’origine. | Les proches de Sélis sont désormais ceux qu’il rencontre après son réveil adulte. |
| Le partenaire revient sans conséquences. | Prévoir des soins, une convalescence et des échanges sur les secrets. |

Un changement de statut dans ce dossier ne met à jour ni les sauvegardes du jeu ni les scripts de gacha. Cette livraison est exclusivement narrative et documentaire.
<!-- END:AUDIT-003 -->

# Arbitrages restants

<!-- BEGIN:Q-001 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"GRAINE-002,EVT-004,EVT-007"} -->
<a id="q-001"></a>
## Âge du réveil et mémoire de stase

Le réveil adulte et l’amnésie autobiographique partielle sont proposés pour rendre possible une vie autonome sur Sélis sans révéler immédiatement Orthe. Il reste à décider si Elio garde un souvenir fragmentaire concret de son monde, et lequel.
<!-- END:Q-001 -->

<!-- BEGIN:Q-002 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"COUPLE-002,EVT-014,CH-07"} -->
<a id="q-002"></a>
## Mort de Lyra dans l’histoire-source

La mort-source pendant une évacuation est conservée comme proposition de la v1.0. Il faudra décider si ce second drame enrichit l’histoire ou la surcharge ; la supprimer demanderait de définir où est cette autre Lyra en Z et pourquoi le héros ne la confond pas avec son partenaire du prologue.
<!-- END:Q-002 -->

<!-- BEGIN:Q-003 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"COUPLE-001,HIST-002,CH-10"} -->
<a id="q-003"></a>
## La rupture de Lyra avec sa mission

La couverture professionnelle vient de l’auteur ; la démission avant la relation amoureuse reste une solution proposée. Préciser ses supérieurs, la mission exacte et le prix de sa désobéissance permettra de rendre ce choix personnel plutôt que purement administratif.
<!-- END:Q-003 -->

<!-- BEGIN:Q-004 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"TEMPS-004,TEMPS-005,IA-003,IA-004,CH-14"} -->
<a id="q-004"></a>
## Minutage et géographie du secours

Le trajet, le mode de conservation et les positions des personnages doivent être vérifiés ensemble au storyboard. Les secondes proposées ne sont pas figées ; déplacer le retour de Séveran oblige à recalculer le reliquat et l’état de Lyra.
<!-- END:Q-004 -->

<!-- BEGIN:Q-005 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"HIST-002,HIST-003,NOYAU-004,GRAINE-001"} -->
<a id="q-005"></a>
## Histoire ancienne et échelle des pouvoirs

Les noms des coalitions, les dates millénaires, le détail du registre des noyaux et les conditions de formation de nouveaux noyaux restent des propositions. Une modification ne doit pas réintroduire par accident d’autres Porteurs intacts hors d’Orthe.
<!-- END:Q-005 -->

<!-- BEGIN:Q-006 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"TEMPS-001,TEMPS-002,AUDIT-001"} -->
<a id="q-006"></a>
## Étendue future de la recherche temporelle

La machine de cette version ne réécrit jamais le passé réalisé. Une éventuelle vraie réécriture dans un autre arc nécessiterait de reconstruire l’audit complet ; elle ne doit pas être annoncée comme une amélioration technique banale déjà garantie.
<!-- END:Q-006 -->

<!-- BEGIN:Q-007 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"PERS-001,REDEMPTION-001,GACHA-002"} -->
<a id="q-007"></a>
## Distribution, rares restaurations et bannières

Les personnages et rangs de la v1.0 sont maintenus comme maquette. Définir les étapes de Saren, les séquelles possibles, la présence des humains jouables et le mode de recrutement gratuit du partenaire avant de figer l’économie.
<!-- END:Q-007 -->

