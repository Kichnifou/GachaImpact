# Les Origines — Source narrative unique

Version : 1.6 de travail — 16 septembre 2026

Ce fichier remplace la bible narrative v1.0 comme source éditable. Divulgâchage intégral. Les décisions confirmées, les propositions et les questions sont distinguées au niveau de chaque bloc.

Pour une modification ciblée, chercher la balise `<!-- BEGIN:IDENTIFIANT -->` et remplacer le bloc jusqu’à `<!-- END:IDENTIFIANT -->` inclus. Ne pas changer les identifiants pour un simple renommage. Les relations entre blocs sont déclarées dans `refs`.

Le script `node tools/generer-story.mjs` produit les vues de lecture depuis cette source. Il vérifie le format, les références et la synchronisation des sorties, pas la qualité dramatique ni les paradoxes de toutes les scènes.

# Mode d’emploi

<!-- BEGIN:CADRE-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"gestion","views":"","period":"","order":0,"refs":""} -->
<a id="cadre-001"></a>
## Périmètre de cette version

Cette révision 1.6 de travail consolide la crise ancienne, la fuite des capsules, la progression Gravité/Spatial, l’extraction du centre, le lien des pétales, la collaboration, l’ouverture de Z, les archives de Nacre, les empreintes sensorielles et la différence entre les essais du Cœur. Les scènes précises et les arbitrages non décidés restent proposés ou ouverts.

CONFIRME désigne une orientation explicitement fixée par l’auteur. PROPOSE désigne une solution de travail, qu’elle vienne de l’auteur ou de l’assistant. OUVERT désigne un arbitrage restant à faire. Le champ « origine » précise la provenance ; une proposition héritée de la v1.0 n’est pas automatiquement approuvée.

Orthe, Sélis, Séveran et Nacre restent les noms de travail utilisés pour la continuité du dossier. Les dates chiffrées, les âges, les dimensions, les détails physiques des technologies et les noms d’institutions non confirmés restent révisables. La structure de la mémoire, l’hérédité des noyaux et les grands jalons du final sont désormais confirmés. Les règles temporelles et cosmologiques de travail sont des conventions de fiction, pas des affirmations scientifiques.

Le fichier STORY_SOURCE.md est le seul document narratif à modifier. Les vues du dossier lecture sont calculées depuis ses blocs. Le Word est un export daté de lecture, pas une deuxième source. Une décision importante peut demander de revoir plusieurs blocs liés ; la génération évite les recopies, mais ne corrige pas automatiquement la causalité.

Les remplacements v1.6 sont centralisés dans `INHIBITEUR-001`, `AMPLIFICATEUR-001`, `CENTRE-EXTRAIT-001`, `LIEN-PETALES-001`, `LIEN-TEMPS-001`, `CORPS-001`, `ESSAIS-COEUR-001` et `FRAGMENT-003`. La phase suivante suit `PRODUCTION-001` ; cette consolidation n’autorise ni scène détaillée, ni gameplay fixé, ni nouvelle image.
<!-- END:CADRE-001 -->

# Fondations

<!-- BEGIN:NOMS-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"POLITIQUE-001"} -->
<a id="noms-001"></a>
## Elio et Lyra : noms et rôles lisibles

Elio est le nom provisoire du personnage masculin ; Lyra, celui du personnage féminin. Les sigles H et C disparaissent de la nouvelle référence.

| Choix du joueur | Protagoniste, graine préservée et scientifique | Partenaire et personne envoyée par Orthe |
|---|---|---|
| Elio | Elio | Lyra |
| Lyra | Lyra | Elio |

Pour alléger la lecture, le présent dossier raconte la version où Elio est joué. Dans le miroir, Lyra est la Porteuse préservée en capsule : elle maîtrise Gravité avant la stase, apprend Spatial après G, laisse six pétales régionaux, collabore avec Séveran, prépare les deux balises, amorce le prototype par son septième pétale et ouvre A avant l’attaque. Séveran aperçoit la Lyra jeune en A, frappe mortellement la Lyra-source puis extrait son centre ; encore brièvement vivante, elle donne son dernier ordre à Nacre, qui échoue à la sauver avant d’adapter sa routine à la Lyra jeune. Elio partenaire Biotique trouve la capsule, soigne Lyra sous masque, garde le secret et s’interpose lors du deuxième essai puis du prologue. Nacre sauve la Lyra jouée, dont le centre réactive les pétales-source ; seule cette Lyra éprouve leurs empreintes. Le corps-source conservé est celui de Lyra, et le partenaire Elio est sauvé à la fin. Séveran demeure Porteur Énergie. Il s’agit des mêmes rôles et règles, non de deux intrigues indépendantes.

Les qualificatifs remplacent les indices opaques : « Elio de l’histoire-source », « Elio joué », « Lyra de l’histoire-source » et « Lyra du prologue ». « Elio futur » est un raccourci de point de vue : l’Elio joué n’est pas destiné à devenir cette autre continuation.
<!-- END:NOMS-001 -->

<!-- BEGIN:MONDE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"COSMO-001,COSMO-002,GEOGRAPHIE-001,COEUR-003"} -->
<a id="monde-001"></a>
## Orthe, monde réel et origine de ses peuples

Orthe est le Monde des Origines, une planète réelle, ancienne et autonome au sein du même univers que Sélis et les autres planètes. Ce n’est ni une simulation, ni un microcosme créé pour le protagoniste. Le titre désigne l’origine de ses peuples et de leur héritage ; il ne signifie plus que les divinités locales ont certainement créé tout le cosmos.

Les divinités locales ont façonné Orthe et ses premiers peuples humains, dont les Porteurs : ceux-ci sont des humains dotés d’un noyau divin, pas une autre humanité. Elles ont modelé des paysages existants et transmis les noyaux pour entretenir et réguler le monde, pas seulement pour combattre. À l’époque divine, cette organisation est globalement acceptée sans supprimer les personnalités ni le libre arbitre ; questions, jalousies et divergences politiques se développent ensuite, sans devenir ici une intrigue centrale nouvelle.

Chaque région doit posséder des intérêts et des conflits qui existeraient sans Elio. Les habitants ne constituent pas une réserve de pouvoirs ou de souvenirs fabriquée pour sauver son couple.
<!-- END:MONDE-001 -->

<!-- BEGIN:MONDE-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"MONDE-001"} -->
<a id="monde-002"></a>
## Migration humaine et exceptions au départ des Porteurs

Une partie des humains sans noyau migre anciennement par vaisseaux ; la majorité demeure alors sur Orthe, et les Porteurs y restent concentrés. « Des milliers » est une échelle possible de migrants, non un décompte confirmé. Les capsules de fuite et les missions de recherche sont des départs exceptionnels bien plus tardifs, pas une diaspora fondatrice de Porteurs.

Les migrations fondatrices n’ont pas dispersé de Porteurs, mais les capsules ultérieures peuvent avoir transporté des Porteurs sains ailleurs. Si plusieurs survivants y ont fondé une société, leur hérédité naturelle peut avoir produit des descendants Porteurs hors d’Orthe ; cette possibilité d’endgame n’affirme encore aucun monde, nombre ou destin précis.

La phrase « tous les Porteurs sont restés » décrit la période des migrations fondatrices. Elle n’interdit donc pas à Lyra d’effectuer ultérieurement une mission interplanétaire, ni à Elio d’être envoyé en capsule. Le pouvoir d’Elio n’est pas expliqué par un héritage ayant sauté des générations sur Sélis.
<!-- END:MONDE-002 -->

<!-- BEGIN:COSMO-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"MONDE-001,NOYAU-001,GEOGRAPHIE-001"} -->
<a id="cosmo-001"></a>
## Huit divinités locales et la signature du noyau

L’organisation divine locale d’Orthe comprend huit divinités : un premier dieu à l’origine des sept autres, puis parmi ces sept un dieu associé à la capitale et six associés aux six autres grands ensembles régionaux. Cette architecture symbolique d’un centre et de sept éléments se retrouve dans les noyaux, formés d’un centre et exactement sept pétales.

Le premier dieu local n’est pas pour autant confirmé comme créateur du cosmos. Les divinités pouvaient agir sur plusieurs domaines parmi Gravité, Énergie, Biotique et Spatial ; il n’existe ni correspondance obligatoire entre région et catégorie, ni huit pétales, ni huit catégories. Cette analogie ne fait d’Elio ni une réincarnation, ni l’objet d’une prophétie, ni un protagoniste prédestiné.

Les noms, personnalités, portraits, récits individuels et causes détaillées de disparition des huit dieux restent à élaborer.
<!-- END:COSMO-001 -->

<!-- BEGIN:COSMO-002 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"MONDE-001,COSMO-001,COSMO-003"} -->
<a id="cosmo-002"></a>
## Une hiérarchie cosmique au-dessus des dieux locaux

La cosmologie de travail propose que des dieux originels d’un ordre supérieur aient créé le cosmos et missionné des divinités locales pour façonner différentes planètes. Les dieux d’Orthe auraient ensuite été rappelés par ces puissances originelles. Cette piste ouvre d’autres mondes fondés autrement ; elle n’est pas encore une révélation détenue par les personnages.

Même si ce système est un jour décrit comme une expérience cosmique, les personnes, leurs souffrances et leurs choix restent réels. Aucun dieu n’a préprogrammé l’aventure d’Elio, et cette hypothèse n’excuse aucun acte de Séveran.
<!-- END:COSMO-002 -->

<!-- BEGIN:COSMO-003 -->
<!-- META:{"status":"OUVERT","origin":"utilisateur","kind":"question","views":"","period":"","order":0,"refs":"COSMO-001,COSMO-002"} -->
<a id="cosmo-003"></a>
## Motif du rappel des divinités locales

Le motif exact du rappel reste ouvert : conflit ou besoin extérieur, nouvelle mission, ou décision de laisser les civilisations évoluer sans intervention afin de les observer. Aucune de ces possibilités n’est choisie silencieusement dans cette version.
<!-- END:COSMO-003 -->

<!-- BEGIN:GEOGRAPHIE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"MONDE-001,COSMO-001,REG-001,REG-002,REG-003,REG-004,REG-005,REG-006,REG-007"} -->
<a id="geographie-001"></a>
## Six régions de collecte et une région-capitale

Orthe comprend six grands ensembles régionaux parcourus pour les pétales, plus une région-capitale : sept ensembles géographiques et narratifs, mais seulement six régions de collecte. Le septième pétale se trouve dans Nacre, jamais dans une septième région à vider.

À l’origine, humains et Porteurs se concentrent autour de la capitale et du Cœur, puis peuplent le reste d’Orthe avec les divinités régionales. Les dieux façonnent des parties des paysages existants à leur image ; architectures, mythes, contes et traces leur survivent. Après leur départ, les peuples continuent de transformer villes, frontières, régimes et cultures. Les identités régionales précèdent le Bâillon sans être restées figées depuis.
<!-- END:GEOGRAPHIE-001 -->

<!-- BEGIN:POLITIQUE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"GEOGRAPHIE-001,HIST-001,HIST-002"} -->
<a id="politique-001"></a>
## Fédération régionale avant la tutelle

Après le départ des dieux, des institutions régionales se développent puis s’articulent en une fédération de régions autonomes dotée de représentants et d’une assemblée centrale. Celle-ci traite du Cœur, des grandes infrastructures, des relations régionales et de règles communes, ce qui permet le vote sur le contrôle des noyaux. « Assemblée d’Orthe » reste un nom de travail, pas une constitution définitive.

Après le coup d’État, beaucoup d’institutions subsistent sous tutelle, pression, corruption ou transformations imposées. Les régions ne sont ni administrées uniformément, ni toutes entièrement libres ou occupées. La capitale demeure un enjeu central pour Séveran ; son aspiration à présider l’assemblée reste une piste proposée sans carrière électorale inventée.
<!-- END:POLITIQUE-001 -->

# Histoire et factions

<!-- BEGIN:HIST-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"SEVERAN-001"} -->
<a id="hist-001"></a>
## La crise politique de l’héritage

Avant le Grand Bâillon, de véritables abus de pouvoirs ont provoqué catastrophes, destructions, intimidation et impunité. Orthe se divise alors entre deux grandes visions. La première considère le Cœur comme un héritage commun des dieux, les noyaux comme appartenant à leurs Porteurs et leur alimentation libre comme un droit qu’aucune institution ne peut réserver aux personnes qu’elle juge méritantes. La seconde veut réguler leur accès à l’apport distribué par le Cœur, limiter les personnes jugées dangereuses et favoriser celles qui servent la société. Cette régulation envisagée ne peut pas vider instantanément un noyau sain de sa réserve propre.

Séveran commence comme un réformateur respecté qui demande responsabilité, lois, limites et sanctions. Sa logique se radicalise progressivement : sanctionner les abus devient contrôler les noyaux, puis confier à une autorité le pouvoir de décider qui mérite ses capacités, jusqu’à considérer que la population doit être protégée malgré elle. Son mouvement répond donc à un problème réel sans que son autoritarisme ultérieur soit excusé.

Le conflit n’oppose pas un camp unanimement innocent à une idéologie manifestement absurde. Les populations humaines et les Porteurs ne forment pas des ensembles uniformes. Séveran est lui-même un ancien Porteur Énergie ; les exemples précis d’abus, les institutions de l’époque, son parcours avant la radicalisation et le moment où il accepte ses premiers implants restent à développer.
<!-- END:HIST-001 -->

<!-- BEGIN:HIST-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-001,POLITIQUE-001"} -->
<a id="hist-002"></a>
## Le vote refusé et le coup d’État

Une décision politique majeure soumet à la population d’Orthe la direction à donner au Cœur et au contrôle des noyaux. Le détail constitutionnel reste à définir. Malgré la propagande, les pressions, les manipulations et les tentatives de corruption venant notamment de la faction de Séveran, la tendance finale paraît favorable au maintien d’un Cœur libre et de l’héritage existant.

Comprenant qu’il risque de perdre politiquement, le camp radical de Séveran refuse la limite du vote et tente de prendre le contrôle du Cœur afin d’imposer son programme de régulation. L’opération provoque une réaction des opposants et des affrontements. Les amplificateurs personnels déjà implantés avant le vote donnent un avantage tactique à sa faction ; les départs en capsules s’accélèrent alors sous la poursuite. Dans cette escalade, Séveran met en service prématurément son inhibiteur, et la résistance frappe le dispositif. Le Grand Bâillon atteint les deux camps, puis l’avantage résiduel des amplificateurs aide le coup d’État à s’imposer.

Ce coup d’État constitue le franchissement moral majeur de Séveran. Son objectif initial est de contrôler le système, pas de désactiver tous les noyaux de la planète.
<!-- END:HIST-002 -->

<!-- BEGIN:HIST-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-001,HIST-002,HIST-004,GRAINE-001,NOYAU-001,INHIBITEUR-001"} -->
<a id="hist-003"></a>
## Le Grand Bâillon : catastrophe d’une prise de contrôle

Pendant la bataille, l’inhibiteur expérimental est déjà installé sur le Cœur et activé trop tôt. La résistance frappe le dispositif au cours des combats ; le contrôle échappe à ses concepteurs. Une résonance catastrophique rend les noyaux naturels présents dans la zone d’influence d’Orthe inactifs ou désaccordés : c’est le Grand Bâillon. Le coup précis et son auteur ne sont pas fixés.

Le mécanisme scientifique exact de cette résonance reste ouvert. La causalité politique ne l’est pas : le camp de Séveran a refusé le vote, déclenché la prise du Cœur et employé une technologie dangereuse avant qu’elle soit maîtrisée. Séveran reste lourdement responsable sans avoir planifié une extinction générale.

La portée du Bâillon est liée à Orthe et à son système d’influence immédiat ; elle ne désactive pas automatiquement les noyaux situés sur des planètes lointaines. Les capsules avaient déjà quitté cette zone. Leur préservation ne dépend donc ni d’une exemption de registre ni d’un isolement technique particulier.

Éteindre aujourd’hui une installation du Concordat ne réparerait pas instantanément le désaccord des noyaux. L’inhibition empêche leur usage normal, mais le centre conserve sa fonction biologique basale : le Porteur mûrit puis ne vieillit plus normalement tant que ce centre demeure présent et vivant.
<!-- END:HIST-003 -->

<!-- BEGIN:HIST-004 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-001,HIST-002,HIST-003,NOYAU-003,SEVERAN-001"} -->
<a id="hist-004"></a>
## Deux technologies clandestines et l’avantage après le Bâillon

Pendant le débat politique, Séveran et une équipe de scientifiques Porteurs et humains sans noyau développent deux projets distincts : l’inhibiteur du Cœur décrit dans `INHIBITEUR-001` et les amplificateurs personnels décrits dans `AMPLIFICATEUR-001`. Son poste élevé dans la capitale permet l’étude discrète du Cœur ; le titre précis demeure ouvert. Les premiers amplificateurs fournissent de l’énergie à un Porteur volontairement déchargé, sans anticiper le Bâillon. Leur risque d’altération progressive est caché à une partie des soutiens. Séveran utilise lui-même cette technologie pour soutenir son noyau Énergie après la catastrophe ; date de sa première implantation et séquelles exactes restent ouvertes.

Après le Grand Bâillon, tous les camps présents sont touchés. Les utilisateurs déjà implantés récupèrent cependant une capacité partielle et coûteuse malgré le désaccord de leur centre ; cet avantage militaire permet à Séveran d’imposer progressivement le Concordat, sans transformer ses amplificateurs en guérison naturelle ni faire du désastre son objectif initial.

Le récit officiel du Concordat peut prétendre que l’effondrement prouve la nécessité de sa tutelle et que ses technologies ont seules maintenu l’ordre. Cette propagande contient une part de vérité pratique, mais cache le coup d’État, la contribution du dispositif à la catastrophe, la corruption des réveils forcés et la probable défaite électorale du mouvement. Ses formulations précises restent proposées.

<!-- END:HIST-004 -->

<!-- BEGIN:INHIBITEUR-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-002,HIST-003,COEUR-002,AMPLIFICATEUR-001"} -->
<a id="inhibiteur-001"></a>
## Inhibiteur du Cœur : contrôle ciblé de l’approvisionnement

Séveran veut installer sur le Cœur planétaire un dispositif de contrôle de sa distribution. Il entend intercepter les flux, identifier des Porteurs ciblés par renseignements et décisions humaines, limiter leur approvisionnement et rendre leur maîtrise plus facile. Un noyau sain garde sa réserve et sa recharge propre : couper le réseau ne supprime pas instantanément tout pouvoir. L’inhibiteur n’arrache aucun organe et ne juge pas magiquement qui serait criminel.

Après le vote défavorable attendu et pendant l’escalade post-coup, la faction déploie prématurément ce prototype pour contenir opposants et départs. Des résistants interviennent ; un coup porté au dispositif au cours de l’affrontement le met hors contrôle et provoque le Grand Bâillon. L’identité de l’auteur du coup et le détail physique de la résonance restent ouverts. Séveran demeure responsable d’avoir imposé un prototype dangereux sur une œuvre divine qu’il ne savait pas recréer. Une interface distante montrant flux et signatures est seulement une présentation proposée.
<!-- END:INHIBITEUR-001 -->

<!-- BEGIN:AMPLIFICATEUR-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-004,INHIBITEUR-001,NOYAU-003,MECHA-001"} -->
<a id="amplificateur-001"></a>
## Amplificateurs personnels : apport limité et corruption

Étudiés à partir des flux du Cœur, les amplificateurs sont implantés près du noyau naturel d’un Porteur pour simuler une partie de l’apport énergétique du réseau. Avant le Bâillon, les volontaires abaissent leur charge et vérifient que l’implant compense ce manque ; les résultats initiaux convainquent. Cette décharge expérimentale n’est pas un Bâillon, et les appareils ne sont pas conçus en prévision d’une catastrophe que Séveran ne connaît pas.

Ils soutiennent une capacité sans créer de noyau, de catégorie nouvelle ni de puissance infinie. Leur usage prolongé ou forcé altère progressivement noyau, corps ou esprit ; le risque n’est pas honnêtement annoncé à toute la base. Après le Bâillon, ils ne font fonctionner que partiellement des pétales malgré le centre désaccordé, sans le restaurer. Un amplificateur biologique, un équipement Mecha d’humain sans noyau et un pétale-relais sain d’Elio sont trois systèmes différents.
<!-- END:AMPLIFICATEUR-001 -->

# Origines du couple

<!-- BEGIN:GRAINE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-003"} -->
<a id="graine-001"></a>
## Autant de capsules que possible, un seul survivant retrouvé

Après le vote et le début du coup d’État, avant le Grand Bâillon, les organisateurs tentent d’envoyer autant de capsules et de volontaires que possible sous la poursuite des forces de Séveran. Les volontaires ont déjà vécu comme Porteurs et utilisé leurs capacités ; Elio maîtrise Gravité avant sa stase. Le nombre tenté, le nombre ayant quitté la zone, le nombre arrivé et le nombre de survivants sont distincts et non fixés.

Leurs motivations sont multiples : préserver l’héritage et des savoirs, fuir l’autoritarisme ou une catastrophe pressentie, protéger des proches, chercher des réponses, une aide ou des civilisations capables de soutenir un retour futur. Aucun héroïsme uniforme n’est imposé ; certains habitants restés sur Orthe peuvent juger ces départs lâches sans que ce jugement devienne la vérité morale du récit.

Certaines capsules sont interceptées, détruites, endommagées, dérivent ou ne donnent plus de nouvelles. La panique et la perte de suivi nourrissent la croyance qu’aucun départ n’a abouti. Celles qui préservent un noyau sain, dont celle d’Elio, sont déjà hors de la portée planétaire du Bâillon lors de la catastrophe ; cela n’implique pas que toutes ont réussi à sortir. Elio reste le seul survivant retrouvé et confirmé pour les habitants de l’arc principal, pas le seul survivant réel du cosmos.

Les autorités organisatrices, les destinations, les réveils manqués et les nombres restent à développer. Lyra se porte ultérieurement volontaire pour une mission exceptionnelle de recherche par vaisseau, sans calendrier de retour ni liste exhaustive confirmés.
<!-- END:GRAINE-001 -->

<!-- BEGIN:CAPSULE-SELIS-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"GRAINE-001,GRAINE-002,LYRA-001,EVT-007"} -->
<a id="capsule-selis-001"></a>
## Une ville autour de la capsule

La capsule d’Elio s’écrase sur une zone de Sélis alors inhabitée ou très peu peuplée. Une ville croît ensuite autour de ce site au fil de sa stase. Bien plus tard, Lyra retrouve la capsule à l’aide d’un appareil sensible à la signature matérielle particulière des capsules ; la proximité d’une ville ne suffit ni à la découverte ni à expliquer l’amnésie. La scène médicale et le réveil adulte restent distincts de cette enquête technique.
<!-- END:CAPSULE-SELIS-001 -->

<!-- BEGIN:GRAINE-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"GRAINE-001,CAPSULE-SELIS-001,MEMOIRE-001"} -->
<a id="graine-002"></a>
## Le réveil adulte : âge encore proposé

Elio est déjà un jeune adulte lorsqu’il entre en stase puis lorsqu’il en sort. Cette proposition remplace l’enfance adoptive de la v1.0 et permet son intégration autonome sur Sélis. La trajectoire confirmée de sa capsule et la croissance de la ville sont fixées séparément dans `CAPSULE-SELIS-001`.

La stase excessivement longue produit le modèle de mémoire confirmé dans `MEMOIRE-001`. Elio apprend normalement après son réveil : ses souvenirs récents ne disparaissent pas au gré des besoins du scénario. Son âge biologique ou chiffré précis reste ouvert.

Lyra assure les premiers secours sous la couverture médicale décrite dans `LYRA-001`, puis confie Elio au service médical local. Une fois stabilisé, il accède à une structure civile d’accueil, des documents et un hébergement. Elle n’invente ni une enfance ni une famille dans sa mémoire. Rappelée, elle le laisse à des personnes capables de l’aider ; elle ne l’abandonne pas dans un monde inconnu.

Il se construit une place par ses études complémentaires, ses relations et son travail. Des amis, collègues ou mentors de Sélis remplacent le rôle de la famille adoptive de la v1.0. Ils doivent continuer d’exister dans l’épilogue. Le détail de cette intégration reste proposé ; l’amnésie ne doit pas tout expliquer.
<!-- END:GRAINE-002 -->

<!-- BEGIN:MEMOIRE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"GRAINE-001,GRAINE-002,ELIO-POUVOIRS-001"} -->
<a id="memoire-001"></a>
## Une mémoire autobiographique perdue, des savoirs et réflexes préservés

La très longue stase efface presque entièrement la mémoire autobiographique d’Elio : il ne se souvient clairement ni d’Orthe, ni de la crise et de la guerre, ni de ses anciens proches, ni de son histoire personnelle, ni de son statut de Porteur, ni de sa maîtrise consciente de Gravité.

Ses connaissances générales sont conservées. Il garde le langage, la logique, les mathématiques et les connaissances d’un adulte instruit, ses compétences intellectuelles de base, les gestes ordinaires et sa capacité normale à apprendre. Il ne repart pas comme un enfant et ne reçoit pas automatiquement un savoir scientifique complet.

Une mémoire implicite subsiste : intuition des forces, poids, trajectoires et équilibres, certains réflexes et facilités de raisonnement scientifique. Elle contribue à son talent de chercheur sur Sélis sans constituer une maîtrise consciente ni une explication de toute son invention. Des impressions de déjà-vu, de courts flashs, des architectures familières, des gestes instinctifs ou des sensations prises pour des rêves peuvent révéler progressivement son passé sans le résoudre d’un coup. Une vision de pétale, une mémoire implicite et un pouvoir réappris restent trois phénomènes distincts.

Le prénom figure dans les données d’identité de la capsule. Lyra le lit et le transmet à Elio lors de la première rencontre médicale ; Nacre n’existe pas encore. Au début de l’aventure jouable, Nacre peut ensuite l’identifier clairement sous ce nom sans être la personne qui l’a nommé sur Sélis. Dans le scénario miroir, les mêmes règles s’appliquent à Lyra protagoniste et le partenaire Elio lui transmet son prénom.
<!-- END:MEMOIRE-001 -->

<!-- BEGIN:LYRA-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"GRAINE-001,GRAINE-002,MEMOIRE-001,COUPLE-001,POUVOIR-001,VOYAGE-001"} -->
<a id="lyra-001"></a>
## Le partenaire Biotique et la mission des capsules

Dans la version de référence, Lyra appartient à un collectif encore sans nom définitif de Biotiques d’Orthe, historiquement formés à la maîtrise du vivant, à la médecine et au soin des blessés et des populations. Même lorsque leurs noyaux sont affaiblis ou inactifs, leur formation médicale et scientifique demeure utile. Lyra maîtrise elle-même Biotique.

Sans fonction fixe importante au moment où la recherche des capsules est organisée, elle se porte volontaire. Elle voyage entre plusieurs planètes en vaisseau et utilise un dispositif détectant la signature matérielle particulière des capsules pour retrouver, sous ou près de la ville de Sélis, celle dont les données lui donnent le prénom d’Elio. Elle le réveille et le stabilise avec sa formation, du matériel et un poste de soins. Ses pouvoirs Biotiques ne sont pas rétablis.

Elio est encore confus, les yeux fermés ou à peine ouverts. Masquée et coiffée comme une soignante locale, Lyra lui dit son prénom et qu’il se trouve sur Sélis, puis contacte le service médical local. Elle présente l’accident et l’amnésie sévère comme cause de couverture, jamais comme vérité d’auteur sur la stase. Elle assure la prise en charge par les secours, se retire et l’observe à distance. « Tu es sur Sélis. Tu t’appelles Elio. Tu n’es plus seul. » reste un exemple de mise en scène proposé, pas un dialogue définitif.

Après sa découverte, des affrontements contemporains avec des partisans du Concordat font de nombreux blessés. Son collectif manque de personnel et la rappelle sur Orthe pour participer aux soins : ce rappel n’est ni une punition ni un moyen de l’éloigner d’Elio. Les détails précis de ces affrontements restent proposés.

Lorsqu’elle retourne plus tard sur Sélis, Elio ne reconnaît pas clairement la soignante masquée ; une voix, un geste ou une phrase peuvent produire un souvenir partiel, jamais une récupération miraculeuse. Son collectif veut comprendre la personne devenue Elio, Porteur au noyau intact susceptible de bouleverser Orthe. Sa mission consiste à se rapprocher de lui, à le connaître réellement et à anticiper sa réaction à la vérité, non à le séduire ni à l’espionner pour le Concordat. Elle prend une couverture professionnelle crédible sur son lieu de travail. Dans le scénario miroir, Elio partenaire appartient au collectif Biotique, effectue la mission, soigne Lyra masqué et tient exactement cette fonction.
<!-- END:LYRA-001 -->

<!-- BEGIN:COUPLE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"GRAINE-001,LYRA-001,NOMS-001"} -->
<a id="couple-001"></a>
## Couverture professionnelle, rencontre et amour

Lors de son retour sur Sélis, Lyra se fait embaucher sous couverture dans l’environnement de travail d’Elio. Leur relation naît alors de contacts adultes, d’une amitié et de travaux communs ; au prologue, ils sont déjà en couple.

Lyra possède de vraies compétences utiles à son emploi. Sa mission consiste à apprendre réellement à connaître Elio et à comprendre comment il pourrait réagir à la vérité sur Orthe, pas à le séduire ni à espionner pour le Concordat. L’amour n’est pas simulé. Au point A-source, ils travaillent ensemble et sont déjà amoureux, mais Elio ignore encore qu’elle vient d’Orthe, qu’elle est une Porteuse Biotique, qu’elle a retrouvé sa capsule et que sa présence avait initialement aussi une mission. Dans le scénario miroir, tous ces rôles s’inversent sans produire une intrigue différente.
<!-- END:COUPLE-001 -->

<!-- BEGIN:COUPLE-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"COUPLE-001,LYRA-001,EVT-011"} -->
<a id="couple-003"></a>
## Révélation, crise temporaire et réconciliation

Après A-source, Lyra révèle à Elio son origine d’Orthe, sa nature de Porteuse Biotique, sa participation à la recherche des capsules, le fait qu’elle l’a retrouvé et réveillé, et la mission initiale attachée à sa couverture professionnelle. Elle ne doit pas être décrite comme ayant nécessairement trahi son collectif ou désobéi avant de tomber amoureuse.

Elio est profondément choqué : il peut croire leur rencontre fabriquée, se sentir étudié et douter de la sincérité des sentiments. Ils cessent de se parler pendant une durée encore à écrire. Lyra maintient que son amour est réel et ils finissent par se réconcilier. C’est seulement après cette réconciliation qu’ils partent ensemble vers Orthe au point G.

A-fenêtre diverge avant cette révélation future. L’Elio joué est donc extrait sans avoir jamais appris la vérité de la bouche de Lyra. Après le sauvetage final, la reconnaissance n’impose ni pardon ni attachement : le couple doit encore parler de la dissimulation et choisir librement la suite. Dans le scénario miroir, Elio partenaire porte le secret et le révèle plus tard à Lyra-source.
<!-- END:COUPLE-003 -->

<!-- BEGIN:COUPLE-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-001,COEUR-001,COUPLE-003"} -->
<a id="couple-002"></a>
## Les deux parcours du partenaire

Lyra de l’histoire-source et Lyra du prologue partagent le passé du couple jusqu’à A, alors qu’Elio ignore encore son origine et sa mission, puis vivent des événements différents. Lyra-source révèle ensuite la vérité, traverse la crise et la réconciliation du couple, part sur Orthe et meurt en s’interposant lorsque Séveran attaque Elio pendant une tentative de restauration du Cœur. Le sauvetage final concerne la personne du prologue joué, pas sa version plus âgée.

Lyra-source meurt des blessures infligées pendant l’affrontement, et non parce que son noyau aurait été détruit ou retiré. Les détails physiques de la blessure et l’état exact de son noyau restent à développer. Elio veut d’abord tuer Séveran, mais n’en a pas la puissance ; leur coopération ultérieure naît du deuil et du marchandage proposé par l’antagoniste.

Lyra du prologue reçoit une blessure gravissime mais son noyau n’est pas détruit. La suspension préserve sa continuité. À la fin, l’équipe la récupère vivante et la soigne. Elle ne reçoit pas les souvenirs de sa version-source ; elle retrouve l’Elio avec qui elle était déjà en couple, transformé par son périple et qui vient d’apprendre sur Orthe la vérité qu’elle n’avait pas encore pu lui révéler.
<!-- END:COUPLE-002 -->

# Pouvoirs et antagonisme

<!-- BEGIN:VOYAGE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"MONDE-002,GRAINE-001,LYRA-001,TEMPS-003,TEMPS-004,IA-001"} -->
<a id="voyage-001"></a>
## Vaisseaux, relais énergétiques, téléportation et temps

Quatre systèmes restent distincts. Les vaisseaux et capsules assurent les migrations, la recherche de Lyra et les premiers voyages du couple entre planètes ; leurs vitesses et durées ne sont pas fixées. Les relais énergétiques régionaux distribuent l’apport du Cœur et ne téléportent personne. Les pouvoirs Spatial agissent localement et ne permettent ni traversée libre du cosmos ni voyage temporel inné. La machine temporelle dépend séparément de l’ancre de A.

Les portails ou installations de téléportation interplanétaire sont une invention tardive d’Elio-source, développée vers la fin de sa vie avec Nacre. Ils exigent des balises préparées aux deux extrémités, de l’énergie, des coordonnées et des autorisations. Un premier voyage préparatoire par transport ordinaire permet l’installation de la balise sur Sélis, puis Elio revient par ce même moyen ; sa désertion définitive d’Orthe vers Sélis constitue le premier véritable test de téléportation. Les détails d’autorisation restent ouverts. Les deux extrémités existent ainsi avant Z pour le secours Z → Orthe. Lyra ne les utilise pas pour rechercher les capsules, et le couple rejoint d’abord Orthe en G par vaisseau. Nacre commande les installations ; elle ne crée pas seule une capacité de téléportation.
<!-- END:VOYAGE-001 -->

<!-- BEGIN:NOYAU-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"COSMO-001,ETATS-NOYAU-001,HEREDITE-001"} -->
<a id="noyau-001"></a>
## Fonction, architecture et continuité des noyaux

Les noyaux ont été transmis aux Porteurs pour entretenir et réguler des fonctions du monde, non initialement pour gouverner les humains. Ils donnent accès aux pouvoirs, mais ne sont indispensables ni à la vie humaine ni à l’identité personnelle.

Un véritable noyau primordial comprend un centre, qui porte sa fonction fondamentale, et exactement sept pétales liés à sa capacité exploitable, ses réserves et ses niveaux d’éveil ou de maîtrise. Cette architecture ne signifie pas qu’un Porteur possède sept vies ni sept copies de lui-même.

Tant que son centre conserve sa fonction biologique basale, un Porteur mûrit puis ne vieillit plus normalement, même si ses pouvoirs actifs sont Bâillonnés. Il n’est pas invulnérable : blessures, maladies selon leurs règles, implants et surcharges peuvent le tuer. Retirer ou détruire complètement un noyau ne tue pas par définition son porteur, mais lui retire pouvoirs et longévité extraordinaire. Une extraction violente peut tuer par ses blessures ; la mort de Lyra-source et celle d’Elio-source viennent des agressions de Séveran, jamais de la seule perte ou neutralisation d’un noyau.
<!-- END:NOYAU-001 -->

<!-- BEGIN:ETATS-NOYAU-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-001,NOYAU-002,NOYAU-003,NOYAU-006"} -->
<a id="etats-noyau-001"></a>
## États distincts d’un noyau

| État | Conséquence |
|---|---|
| Naturellement fonctionnel | Noyau sain capable de renouveler sa charge et de préserver sa fonction biologique basale. |
| Déchargé | Réserve active épuisée après usage ; repos et recharge naturelle restent possibles, sans altération héréditaire automatique. |
| Bâillonné | Désaccord durable du centre ; repos ou voyage ne suffisent pas à le guérir, mais sa fonction biologique basale et la longévité peuvent subsister. |
| Pétales temporairement réactivés | Capacités et réserve partiellement accessibles sans guérison complète du centre. |
| Artificiellement réanimé | Fonctionnement forcé par implant ou régulateur, avec corruption et risques distincts d’une restauration naturelle. |
| Totalement retiré ou détruit | Plus de pouvoirs ni de longévité extraordinaire ; la perte n’est pas une mort automatique. |
| Centre extrait | L’organe perd aussitôt et irréversiblement sa fonction active ; l’extraction seule ne tue pas automatiquement la personne. Les sept pétales d’Elio-source deviennent dormants, non détruits. |

Dans les règles d’hérédité, « éteint » signifie Bâillonné, jamais simplement déchargé.
<!-- END:ETATS-NOYAU-001 -->

<!-- BEGIN:CENTRE-EXTRAIT-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"ETATS-NOYAU-001,SEVERAN-002,LIEN-PETALES-001,IA-002,CORPS-001"} -->
<a id="centre-extrait-001"></a>
## Extraction du centre : perte immédiate et irréversible

Le centre pur d’Elio est un organe actif uniquement tant qu’il reste dans son corps vivant. Dès son extraction, il devient définitivement inerte : ni conservation, ni expérience, ni greffe ultérieure ne rendent sa fonction à ce même centre. Cette extraction n’est pas une commande de sabotage ou une sécurité personnelle inventée par Elio ; elle n’entraîne pas à elle seule sa mort. Le danger mortel du raid Z vient des coups de Séveran. Un centre post-mortem conservé reste un vestige et une preuve, jamais une référence vivante exploitable. Séveran a donc besoin d’un Elio vivant avec son centre encore en place.
<!-- END:CENTRE-EXTRAIT-001 -->

<!-- BEGIN:LIEN-PETALES-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"CENTRE-EXTRAIT-001,LIEN-TEMPS-001,FRAGMENT-001,FRAGMENT-002,IA-006"} -->
<a id="lien-petales-001"></a>
## Sept pétales et centre vivant de même signature

Un pétale séparé reste un relais de capacité limitée seulement s’il est raccordé à un centre vivant, compatible et de la même signature fondamentale. L’extraction du centre d’Elio-source rend aussitôt dormants ses six pétales d’Orthe et celui de Nacre, sans les détruire. La proximité temporelle et matérielle de l’Elio jeune peut rétablir leur lien ; elle ne transfère ni la mémoire autobiographique du scientifique ni une maîtrise instantanée. Un pétale dormant n’efface pas la réserve ou la longévité personnelle des Porteurs déjà réactivés : c’est le relais et son entretien régional qui cessent de fonctionner normalement.
<!-- END:LIEN-PETALES-001 -->

<!-- BEGIN:LIEN-TEMPS-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-001,LIEN-PETALES-001,IA-002,IA-003"} -->
<a id="lien-temps-001"></a>
## Le raccord ne franchit pas la fenêtre A–Z

La même signature ne suffit pas si le centre et le pétale sont de part et d’autre d’une fenêtre temporelle ouverte. Avant l’extraction à Z, les six pétales sur Orthe et celui de Nacre y fonctionnent par le centre d’Elio-source. Après l’extraction, les sept dorment. Lorsque Nacre passe en A, son pétale peut se raccorder au jeune Elio présent en A ; les six restés sur Orthe demeurent dormants. Quand Nacre ramène le jeune Elio en Z, les six d’Orthe se raccordent avant même la téléportation vers Orthe et y restent actifs. Le franchissement ne transporte ni souvenirs ni maîtrise du scientifique.

| Situation | Six pétales d’Orthe | Pétale de Nacre |
|---|---|---|
| Elio-source vivant à Z, centre en place | Actifs via Elio-source | Actif via Elio-source |
| Centre source extrait à Z | Dormants | Dormant |
| Nacre passe en A, jeune Elio vivant en A | Dormants, car de l’autre côté | Actif via le jeune Elio |
| Nacre et jeune Elio reviennent en Z | Actifs via le jeune Elio, avant la téléportation | Actif via le jeune Elio |
| Jeune Elio arrive sur Orthe | Actifs via le jeune Elio | Actif via le jeune Elio |
<!-- END:LIEN-TEMPS-001 -->

<!-- BEGIN:NOYAU-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-001,ETATS-NOYAU-001,COEUR-002"} -->
<a id="noyau-002"></a>
## Réactivation temporaire et recharge

Un noyau naturellement sain renouvelle sa charge de lui-même, même loin d’Orthe ; la consommation peut toutefois dépasser cette recharge naturelle. Un noyau Bâillonné ne guérit ni par repos ni par voyage. Elio peut temporairement réactiver sainement les pétales d’un autre Porteur et lui fournir une première impulsion qui n’est pas une restauration permanente de son centre. La compatibilité ainsi établie reste acquise, mais la réserve du bénéficiaire peut se décharger avant la restauration du Cœur. Elle doit ensuite être alimentée par Elio, un pétale régional ou un relais énergétique adapté.

Un noyau temporairement réactivé ne devient pas un nouveau centre pur : il ne peut ni éveiller d’autres Porteurs, ni reproduire le pouvoir particulier d’Elio. La compétence ancienne et la charge disponible restent deux choses différentes ; les Porteurs expérimentés peuvent savoir quoi faire sans disposer de l’énergie nécessaire, tandis que les générations nées Bâillonnées doivent apprendre des capacités qu’elles n’ont jamais utilisées.

La simple proximité ne déclenche jamais la première réactivation. Elio et le Porteur doivent accomplir consciemment le rituel défini dans `NOYAU-005`. Elio demeure indispensable à cette première activation saine ; un bénéficiaire réactivé ne peut pas la transmettre à d’autres.

La dormance des relais d’Elio-source entraîne des coupures locales, de la maintenance et des redémarrages manuels, pas un second Bâillon global des Porteurs déjà aidés : leurs propres réserves, leur compatibilité et leur longévité basale subsistent.
<!-- END:NOYAU-002 -->

<!-- BEGIN:NOYAU-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-003,HIST-004,NOYAU-001"} -->
<a id="noyau-003"></a>
## Les réveils forcés du Concordat

Avant le Grand Bâillon, le mouvement de Séveran expérimente clandestinement des amplificateurs personnels sur des volontaires dont la charge a été abaissée. Après la catastrophe, le Concordat exploite ces prototypes pour obtenir des réactivations partielles dangereuses et altérantes, sans guérir le centre désaccordé. Leurs générations ultérieures s’améliorent sans atteindre la pureté d’un noyau sain ; l’instabilité peut atteindre noyau, corps et esprit.

La dégradation physique ou mentale ne définit pas le mal. Certains sujets sont volontaires, d’autres contraints ; des personnes lucides soutiennent le Concordat, tandis que d’autres peuvent changer de camp ou être devenues dangereuses sans avoir choisi son idéologie.

Lorsque le Cœur retrouve son fonctionnement, les noyaux biologiques ainsi forcés reviennent à un état naturel comme ceux des alliés. Cette restauration ne guérit pas automatiquement toutes les lésions corporelles ou mentales laissées par les implants et ne change aucune conviction.
<!-- END:NOYAU-003 -->

<!-- BEGIN:NOYAU-007 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-003,HIST-004"} -->
<a id="noyau-007"></a>
## Procédé proposé des réveils forcés

Le procédé confirmé apporte au noyau une énergie extérieure près de son centre sans réparer son accord naturel avec le Cœur. Ses mécanismes exacts restent proposés : implants, régulateurs et charges extérieures maintiendraient artificiellement la coordination, au prix d’une corruption progressive, de douleurs, crises, lésions ou troubles variables de mémoire et d’impulsion.

Les rares réussites coûteraient cher, exigeraient une surveillance et ne permettraient pas d’armer toute la population. Des personnages d’Orthe pourraient être tentés par ces procédés ; leur refus collectif ne serait ni automatique ni facile.
<!-- END:NOYAU-007 -->

<!-- BEGIN:SEVERAN-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-001,HIST-002,HIST-003,HIST-004,NOYAU-003,NOYAU-006,POUVOIR-001,CONCORDAT-PETALES-001"} -->
<a id="severan-001"></a>
## Du réformateur respecté au monopole autoritaire

Séveran est un ancien Porteur Énergie, ce qui explique sa longévité malgré le Bâillon. Sa spécialisation de travail est la captation, la régulation et la redistribution des flux : ses anciens usages peuvent protéger des installations et alimenter des services, avant que les mêmes aptitudes ne servent sa tutelle. Il ne maîtrise pas toute forme d’énergie sans limite, n’absorbe pas toute attaque et ne cumule pas les quatre catégories. Ses implants soutiennent son fonctionnement avant la restauration, avec les risques établis ; la date de sa première implantation et ses séquelles précises restent ouvertes.

Il a réellement constaté des abus, des impunités, des catastrophes liées aux pouvoirs et l’incapacité d’institutions à contrôler certains Porteurs très puissants. Il commence comme un réformateur qui réclame responsabilité, lois, limites et sanctions. Son besoin de régulation devient progressivement besoin de contrôle, puis monopole et conviction que son mouvement sait mieux que la population ce qui doit la protéger.

Le vote qu’il risque de perdre est le moment où il refuse les limites politiques de son propre projet. Il déclenche la prise du Cœur afin d’imposer sa régulation ; le Grand Bâillon n’est pas le résultat exact qu’il souhaitait, mais découle directement de ce coup d’État et de l’emploi d’une technologie dangereuse. Sa trajectoire reste moralement compréhensible sans l’absoudre.

Certaines réalisations du Concordat aident réellement des populations et ses implants rendent effectivement des capacités à quelques Porteurs. La critique porte sur la contrainte, la corruption cachée, le monopole et la réécriture du coup d’État. Le Concordat reste une organisation avec officiers, administrateurs, chercheurs et soutiens civils ; la défaite de Séveran ne résout pas instantanément cet ensemble politique.
<!-- END:SEVERAN-001 -->

<!-- BEGIN:SEVERAN-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002,NOYAU-003,SEVERAN-001,FRAGMENT-001,CONCORDAT-PETALES-001"} -->
<a id="severan-002"></a>
## Pourquoi Séveran a besoin d’Elio vivant

La Matrice de tutelle est une solution proposée pour expliquer comment Séveran exploiterait la référence fournie par Elio vivant, avec son centre pur toujours dans son corps : une infrastructure capable de stabiliser les réveils de ses alliés tout en conservant sur eux un contrôle matériel. Un centre extrait est immédiatement inerte et ne peut fournir cette référence.

| Besoin | Utilisation proposée du noyau |
|---|---|
| Éviter les réveils destructeurs | Le centre en place dans le corps vivant d’Elio fournit une référence active stable que les méthodes actuelles ne savent pas fabriquer. |
| Restaurer les troupes d’élite | La Matrice calibre successivement des noyaux sélectionnés ; elle ne crée ni personnes ni spécialités nouvelles. |
| Garder le commandement | Les réactivations passent par des régulateurs impériaux, au lieu de rendre à chacun une autonomie complète. |
| Consolider l’empire | Les unités ainsi stabilisées reprennent les villes, sécurisent les relais et rendent les révoltes beaucoup plus difficiles. |

Les pétales régionaux intéressent aussi Séveran pour couper les recharges des communautés, imposer leur dépendance, alimenter certaines réactivations forcées et étudier les travaux d’Elio. Ils restent toutefois inférieurs au centre pur : ils ne créent aucun nouveau centre, ne réactivent pas seuls un nouveau Porteur et ne rendent pas la capture d’Elio inutile. La Matrice ne fonctionne donc pas déjà parfaitement grâce à six fragments impériaux.

Séveran ne veut ni manger ni extraire le centre : il le perdrait ainsi. Il veut tenir Elio vivant et actif pour exploiter sa réponse aux instabilités. Même en cas de capture, la restauration d’une armée demanderait des moyens, du temps et l’adaptation de chaque bénéficiaire.

Une simple mesure ancienne du noyau ne suffit pas : le processus nécessite sa réponse vivante aux instabilités. La distinction avec le réaccord libre est donc à la fois technique et politique : une référence capturée pour administrer les autres, contre une aide temporaire destinée à leur autonomie.
<!-- END:SEVERAN-002 -->

<!-- BEGIN:SEVERAN-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"SEVERAN-001,COUPLE-002,CONCORDAT-PETALES-001"} -->
<a id="severan-003"></a>
## Découverte tardive, marchandage et raid vers A

Elio-source agit d’abord clandestinement : des communautés le connaissent et l’apprécient sans que les dirigeants du Concordat aient identifié la source pure ou le dispositif complet des six pétales. Lors de la deuxième tentative de restauration du Cœur, Séveran détecte son noyau, comprend le rôle des fragments, intervient et tue Lyra lorsqu’elle s’interpose. La campagne impériale de saisie des pétales commence alors ; elle n’explique pas rétroactivement l’occupation plus ancienne.

Elio veut d’abord tuer Séveran, sans en avoir la puissance. Séveran a besoin de lui vivant avec son centre en place : l’extraire le rendrait inerte et tuer Elio priverait le régime de sa référence. Séveran lui propose alors de combiner leurs technologies pour lui permettre de revoir Lyra. Elio accepte un marché de collaboration avec une mobilité relative, des séances de travail et l’interdiction de confisquer ou détruire les pétales régionaux ; ce n’est ni un emprisonnement continu ni une garantie magique contre la sédation. Les années de collaboration améliorent partiellement la pureté des amplificateurs sans restaurer les centres. Elio mène secrètement des recherches temporelles, sur Nacre et sur la téléportation ; il part quand il comprend que le marché sert désormais Séveran plus que sa recherche et retourne sur Sélis. Après cette rupture, les opérations impériales de saisie s’intensifient sans qu’aucune confiscation réussie soit imposée comme fait.

La clandestinité initiale n’est pas une invisibilité magique : les communautés qui connaissent Elio ne publient pas toutes son identité au régime, et leurs moyens de discrétion restent à développer. Les services sincères rendus par Elio et les souvenirs reconnaissants n’effacent ni les victimes possibles de ses travaux ultérieurs ni sa responsabilité à examiner.

Elio prépare à l’avance un essai vers A, moment de leur vie commune qu’il souhaite revoir, sans savoir que Séveran arrivera. Il connaît le risque qu’une rupture de son centre coupe ses pétales, mais choisit l’essai dans son désespoir, sans plan prophétique de récupération. En Z, il intègre son dernier pétale à Nacre, amorce le prototype et ouvre lui-même A. Il observe d’abord A depuis Z ; les habitants de A ne voient pas Z. Séveran arrive pendant cette observation et voit le jeune Elio vivant à travers la fenêtre. Il porte alors un coup mortel à Elio-source, puis seulement arrache son centre. Encore brièvement vivant après cette extraction, Elio-source donne à Nacre son dernier ordre d’évacuation vers Orthe ; Nacre ne parvient pas à l’emporter avant sa mort. Séveran constate l’inertie irréversible du centre extrait et traverse la fenêtre pour capturer l’Elio jeune, vivant et intact. La fragmentation des pétales n’avait pas rendu le centre adulte sans valeur.

Après l’intrusion au point A, Séveran constate seulement la disparition de l’Elio joué. Il ne voit pas l’extraction de Nacre et ne possède aucune preuve de mort ni de survie. Sans localisation, piste certaine ou confirmation que sa cible a survécu, il ne lance pas immédiatement de chasse personnelle sur Orthe. Les forces impériales y poursuivent néanmoins leurs opérations ordinaires ; des indices ultérieurs peuvent révéler la survie d’Elio.
<!-- END:SEVERAN-003 -->

<!-- BEGIN:SEVERAN-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"SEVERAN-003,SEVERAN-002,IA-003,CONCORDAT-PETALES-001"} -->
<a id="severan-004"></a>
## Mécanismes proposés de la coopération et de la rupture

Séveran disposerait d’installations, d’archives et d’un savoir dont Elio endeuillé a besoin. La promesse de revoir Lyra porterait sur une recherche plausible, non sur une résurrection déjà maîtrisée. Elio accepterait certaines séances et certains travaux utiles au Concordat, tout en conservant une mobilité relative et en refusant la confiscation des pétales ; le régime pourrait placer des relais sous surveillance ou « protection » sans les posséder matériellement. Il partirait lorsque l’accord ne soutient plus sa recherche et que le régime détourne les résultats vers les captures ou réveils forcés.

Il n’existe ni bouton de sabotage, ni sécurité passive empêchant une capture, ni organe exploitable après extraction. Le marchandage dépend du besoin pratique de Séveran de garder Elio vivant et coopératif, des conditions négociées et des rapports de force. Les pétales séparés deviennent dormants lorsque son centre est extrait ; leur réactivation par le jeune Elio suit `LIEN-TEMPS-001`.

Après A-fenêtre, Séveran reste incertain : la disparition de la signature ne prouve ni mort ni survie et ne révèle aucune destination. Les moyens précis par lesquels ses services découvrent plus tard les activités de l’Elio joué restent à développer sans lui attribuer rétrospectivement une preuve impossible.
<!-- END:SEVERAN-004 -->

<!-- BEGIN:CONCORDAT-PETALES-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"SEVERAN-001,SEVERAN-002,SEVERAN-003,SEVERAN-004,FRAGMENT-001,REG-001,REG-002,REG-003,REG-004,REG-005,REG-006"} -->
<a id="concordat-petales-001"></a>
## Chasse aux pétales, accord et résistances régionales

Séveran découvre le principe des six pétales lors du deuxième essai d’Elio-source, sans obtenir magiquement leurs positions, passages et défenses. Il les convoite pour réduire l’autonomie des populations, imposer leur dépendance, soutenir certaines réactivations forcées et étudier les travaux d’Elio. L’oppression du Concordat précède cette chasse de longue date.

Pendant leur collaboration, l’accord prévoit que les pétales ne soient ni confisqués ni détruits. Le Concordat peut surveiller, inspecter, occuper ou prétendre protéger des territoires et relais ; occupation et pression ne valent jamais possession matérielle. Après la rupture, il intensifie ses tentatives de saisie, sans qu’aucune réussite soit confirmée. Les communautés, gardiens, Porteurs réactivés et soutiens Mecha continuent de défendre ou dissimuler les fragments.

Les six régions présentent des menaces variées : rébellion, autonomie négociée, occupation sans accès au fragment, soins sous pression, dissimulation ou relais défendu. Les gardiens ne sont pas nécessairement souverains et le retrait négocié d’un pétale conserve un coût réel. Les premières forces affrontées par le héros peuvent poursuivre des opérations déjà engagées ; après plusieurs actions visibles, des rapports fiables peuvent révéler sa survie à Séveran et déclencher une traque ciblée. Le moment exact reste proposé.

L’anneau temporel est distinct des pétales : sa saisie à Z puis sa récupération préparée aux Chantiers restent possibles.
<!-- END:CONCORDAT-PETALES-001 -->

<!-- BEGIN:REDEMPTION-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002,NOYAU-003,GACHA-001"} -->
<a id="redemption-001"></a>
## Soigner, réparer, choisir de changer

Un ancien ennemi peut être soigné, choisir de changer de camp puis devenir jouable ; un ancien allié peut aussi prendre le chemin inverse. La guérison ne convertit personne automatiquement et la dégradation n’est pas une définition du mal.

Les victimes gardent une voix : le soin n’efface ni les actes passés, ni la justice, ni les réparations. Un personnage peut être stabilisé et rester loyal au Concordat, ce qui distingue son opinion de sa lésion.
<!-- END:REDEMPTION-001 -->

<!-- BEGIN:SEVERAN-005 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"SEVERAN-001,REDEMPTION-001,GACHA-001,FIN-SEQUENCE-001"} -->
<a id="severan-005"></a>
## Une survie et une rédemption possibles, jamais acquises

Après sa défaite et sa neutralisation, Séveran peut survivre, échanger avec Elio, reconnaître certains faits, changer partiellement et entreprendre un chemin de rédemption. Il pourrait devenir jouable dans un arc ultérieur. Cette possibilité n’est ni une absolution, ni un pardon général, ni un recrutement automatique après le boss.

La restauration de son noyau n’efface aucun acte, crime ou besoin de justice. Une coopération exigerait des décisions, des réparations et des actes crédibles ; Lyra n’a aucune obligation d’amitié envers l’homme qui l’a agressée et a tué sa continuation-source. Un éventuel recrutement respecte les règles de rencontre et de coopération, sans être requis par la campagne principale.
<!-- END:SEVERAN-005 -->

<!-- BEGIN:REDEMPTION-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"REDEMPTION-001,NOYAU-003,GACHA-001"} -->
<a id="redemption-002"></a>
## Parcours proposé de Saren

Saren pourrait être le premier ancien ennemi développé : commandant ayant accepté un réveil forcé pour protéger son unité, commis des violences puis découvert que le régime sacrifie ses soldats.

Après sa stabilisation, il devrait ouvrir une évacuation, témoigner contre le programme et accepter une procédure de justice avant un pacte de coopération. Ce parcours reste une proposition de casting et ne transforme pas le soin en absolution automatique.
<!-- END:REDEMPTION-002 -->

<!-- BEGIN:NOYAU-004 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"GRAINE-001,NOYAU-001,NOYAU-002,COEUR-001,COEUR-003,HEREDITE-001,HEREDITE-002"} -->
<a id="noyau-004"></a>
## Hérédité naturelle, fabrication artificielle interdite

Le don divin peut se transmettre naturellement selon les règles de `HEREDITE-001`. Cette transmission biologique ne permet pas de fabriquer artificiellement un noyau primordial à partir d’un prélèvement, d’une archive ou d’un pétale. Réparer un noyau vivant reste différent d’en créer un neuf.

Le Cœur restauré réaccorde progressivement les noyaux victimes du Bâillon. Avant ce rétablissement, les relais énergétiques alimentés peuvent entretenir des réactivations temporaires sans guérir seuls un centre Bâillonné. Ni les relais ni le Cœur ne transforment un humain ordinaire ou un pétale détaché en nouveau Porteur primordial. Deux survivants sains de capsules peuvent en revanche transmettre naturellement des noyaux fonctionnels à leur descendance et fonder une lignée hors d’Orthe.

Cette règle interdit toujours la solution facile consistant à prélever un peu d’Elio pour fabriquer des milliers de références intactes. L’hérédité dépend de l’état des centres parentaux, pas de la réserve instantanée de leurs pétales.
<!-- END:NOYAU-004 -->

<!-- BEGIN:NOYAU-005 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002"} -->
<a id="noyau-005"></a>
## Rituel conscient de première réactivation

La première réactivation saine exige la volonté explicite du Porteur, la présence d’Elio, une confiance ou un confort mutuel suffisant, un rapprochement réel et un rituel conscient de synchronisation. Le lien peut relever de l’amitié, du respect ou d’une forte coopération ; il n’a pas à être romantique.

Le rituel peut rester visuellement simple : les deux personnes se tiennent les mains, ferment les yeux, se concentrent ensemble et maintiennent leur synchronisation pendant plusieurs minutes. Le Porteur accepte de s’ouvrir à Elio et participe activement ; Elio fournit la première impulsion grâce à son centre pur.

Avant G, Elio ne connaît pas cette pratique et Lyra ne peut pas la déclencher seule. Après le rituel, la compatibilité demeure lorsque la réserve se vide : les recharges suivantes alimentent principalement les pétales et ne demandent pas de recommencer toute la synchronisation. Pour une personne déjà éveillée par Elio-source, le premier pull auprès du protagoniste joué établit le nouveau raccord sans effacer la maîtrise acquise. Dans le scénario miroir, Lyra tient la place d’Elio dans ce rituel.
<!-- END:NOYAU-005 -->

<!-- BEGIN:NOYAU-006 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-001,ETATS-NOYAU-001"} -->
<a id="noyau-006"></a>
## Longévité basale et perte complète du noyau

Un Porteur dont le centre conserve sa fonction biologique basale mûrit puis cesse de vieillir normalement, même lorsque sa fonction active est Bâillonnée. Les âges exacts restent ouverts. Après retrait ou destruction complète du noyau, il reprend son vieillissement depuis son âge biologique présent, sans rattrapage instantané des millénaires, et devient mortel comme un humain.

Une archive ou des données ne suffiraient pas à recréer la continuité d’une conscience définitivement morte. Ce garde-fou préserve les pertes physiques sans confondre mémoire et personne vivante.
<!-- END:NOYAU-006 -->

<!-- BEGIN:HEREDITE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-001,NOYAU-002,NOYAU-004,ETATS-NOYAU-001"} -->
<a id="heredite-001"></a>
## Transmission naturelle des noyaux

| Parents | Enfant |
|---|---|
| Deux Porteurs aux centres naturellement sains | Porteur au noyau naturellement fonctionnel, qui doit grandir et apprendre. |
| Deux Porteurs aux centres Bâillonnés | Porteur au noyau Bâillonné. |
| Un Porteur sain et un Porteur Bâillonné | Porteur au noyau Bâillonné. |
| Deux Porteurs dont seuls les pétales sont temporairement rechargés | Porteur au noyau Bâillonné si les centres parentaux le restent. |
| Un Porteur et un humain sans noyau | Enfant sans noyau divin, avec les sensibilités définies dans `HEREDITE-002`. |
| Deux humains sans noyau | Enfant sans noyau divin. |

Avant le Bâillon, les lignées de Porteurs transmettent des noyaux fonctionnels. La catastrophe altère les personnes touchées, puis cet état se transmet aux générations suivantes sans nouvelle onde à chaque naissance. La réserve instantanée des parents ne décide jamais l’état de l’enfant. Après restauration réelle des centres, la règle des centres sains s’applique de nouveau.

La génétique microscopique, les cas d’extraction avant conception, la conception pendant un traitement et les proportions démographiques restent à développer.
<!-- END:HEREDITE-001 -->

<!-- BEGIN:HEREDITE-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HEREDITE-001,MECHA-001,POUVOIR-001"} -->
<a id="heredite-002"></a>
## Enfants de Porteur et d’humain : sensibilités sans noyau

L’enfant d’un Porteur et d’un humain naît sans noyau divin, mais peut présenter des sens et sensibilités accrus liés à la catégorie ou aux catégories effectivement maîtrisées par son parent Porteur. Il ne reçoit ni pouvoirs actifs automatiques, ni catégorie secrète, ni longévité infinie, ni supériorité intellectuelle ou morale générale.

Les manifestations concrètes, leur amplitude et leur éventuelle transmission sur plusieurs générations restent à développer. Comme d’autres humains, ces enfants peuvent employer Mecha ; le rituel d’Elio ne fabrique pas le noyau biologique absent.
<!-- END:HEREDITE-002 -->

<!-- BEGIN:DEMOGRAPHIE-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"MONDE-002,GRAINE-001,ETATS-NOYAU-001,HEREDITE-001,HEREDITE-002,MECHA-001,FIN-002"} -->
<a id="demographie-001"></a>
## Populations anciennes, générations bâillonnées et lignées lointaines

Orthe réunit des humains sans noyau, dont des utilisateurs de Mecha, des Porteurs ayant connu leurs pouvoirs avant le Grand Bâillon, des générations nées avec un noyau déjà Bâillonné et des descendants mixtes sans noyau. Ces groupes ne forment ni castes homogènes ni camps politiques automatiques. Après la restauration, les anciens Porteurs peuvent retrouver des pratiques apprises, tandis que les générations nées Bâillonnées récupèrent un potentiel qu’elles doivent encore découvrir et maîtriser.

Le nombre total de Porteurs, leur proportion par région et le nombre de générations écoulées restent ouverts ; une estimation de quelques dizaines de milliers avant le Bâillon demeure seulement une échelle de travail à confirmer. Hors d’Orthe, certaines capsules ont pu fonder des lignées ou des sociétés où les noyaux sains se transmettent naturellement. Ces groupes éventuels peuvent avoir protégé leur prospérité, craint un retour, ignoré leur origine ou développé des usages très différents ; tyrans comme protecteurs restent possibles. Leur existence concrète, leur taille, leurs cultures, l’état de leurs noyaux et leurs relations futures avec Orthe ne sont pas confirmés.
<!-- END:DEMOGRAPHIE-001 -->

<!-- BEGIN:POUVOIR-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-001"} -->
<a id="pouvoir-001"></a>
## Quatre catégories de pouvoirs

En règle générale, un Porteur construit sa maîtrise autour d’une catégorie de pouvoir — Gravité, Énergie, Biotique ou Spatial — dont l’expression est modelée par la personne. Une fonction de combat n’est pas une catégorie cosmologique, et aucun Porteur n’accède automatiquement à toutes les expressions de sa famille.

**Gravité :** manipulation du poids, de l’attraction et de la répulsion. Les expressions possibles comprennent attraction d’ennemis, objets ou projectiles ; répulsion et ondes de choc ; augmentation du poids ; légèreté, bonds et déplacements aériens ; points gravitationnels ciblés ; orbites ; changement de direction de la chute vers un mur ou le ciel. Elle peut servir la protection, le contrôle, l’attaque aérienne ou à distance.

**Énergie :** manipulation, production, absorption et transfert d’énergie, avec des formes différentes selon les Porteurs. Les expressions possibles comprennent décharges électriques ; accumulation puis explosion ; absorption d’attaques énergétiques ; récupération et restitution d’impacts, chutes ou mouvements ; chaleur ; lumière et illusions optiques ; renforcement corporel ; transfert entre cibles. Certains produisent ou convertissent leur énergie, d’autres doivent en absorber.

**Biotique :** manipulation du vivant et de ses fonctions, sans se limiter au soin. Les expressions possibles comprennent régénération ; stimulation des muscles, réflexes ou sens ; adaptation de son corps ; afflictions causant faiblesse, ralentissement ou perte de précision ; manipulation de son sang ou du sang déjà versé ; croissance végétale ; mutations temporaires ; croissances parasitaires affaiblissantes.

**Spatial :** manipulation des distances, positions et structures spatiales. Les expressions possibles comprennent téléportation courte ; portails ; échange de positions ; compression ou extension des distances ; distorsion détournant des attaques ; découpe spatiale ; domaines modifiant localement une zone ; ancrage empêchant déplacement ou téléportation.

La liste décrit des spécialisations possibles, pas trente-deux personnages obligatoires. Elio constitue l’exception d’apprentissage définie dans `ELIO-POUVOIRS-001` : il reconstruit plusieurs disciplines successives, sans posséder un noyau naturellement polyharmonique et sans pouvoir les activer toutes ensemble. Dans la lecture où Elio est protagoniste, Lyra maîtrise Biotique ; dans le scénario miroir, cette maîtrise initiale appartient au partenaire Elio. Séveran est confirmé Porteur Énergie, spécialisé dans la captation, la régulation et la redistribution des flux. Les autres attributions restent à développer.
<!-- END:POUVOIR-001 -->

<!-- BEGIN:POUVOIR-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"POUVOIR-001,ELIO-POUVOIRS-001,TEMPS-002"} -->
<a id="pouvoir-002"></a>
## Limites communes et disciplines distinctes

La réactivation propre au centre pur d’Elio ne constitue pas une catégorie donnant tous les pouvoirs. Elio apprend plusieurs disciplines parce que sa stase lui a permis de repartir de nouveaux apprentissages conscients ; il ne possède pas un noyau polyharmonique naturellement conçu pour les cumuler.

Les pouvoirs spatiaux ordinaires ne voyagent pas dans le temps : cette technologie exige une machine, une ancre, des composants, des recherches et des collaborations. L’Énergie ne neutralise pas toute capacité au seul motif qu’elle emploie de l’énergie. Le Biotique ne recrée pas une conscience définitivement morte. Les effets extrêmes gardent des limites de portée, de préparation et de résistance.

Elio ne peut normalement activer qu’une discipline divine ou Mecha à la fois. Une éventuelle combinaison simultanée très tardive demeure une possibilité d’endgame non confirmée.
<!-- END:POUVOIR-002 -->

<!-- BEGIN:ELIO-POUVOIRS-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"POUVOIR-001,GRAINE-002,FRAGMENT-003,MECHA-001"} -->
<a id="elio-pouvoirs-001"></a>
## Désapprendre pour réapprendre : progression d’Elio

Avant sa stase, Elio maîtrise consciemment Gravité. La très longue stase efface ce savoir conscient, sans supprimer certaines mémoires implicites de forces, trajectoires et équilibre. Sur Sélis, elles nourrissent ses recherches sans lui donner magiquement des connaissances scientifiques complètes ni une maîtrise active.

Après G, l’Elio de l’histoire-source apprend consciemment Spatial auprès des habitants d’Orthe. Sa maîtrise ancienne de Gravité reste enfouie ; son apprentissage spatial, ses compétences scientifiques et les technologies collectives contribuent ensemble à l’invention temporelle. Spatial ne produit pas directement le voyage dans le temps.

L’Elio joué arrive d’une continuation antérieure à G et ne possède pas l’apprentissage Spatial dont les habitants se souviennent. Au début de l’aventure, il apprend Énergie, suffisante pour les premières réactivations. Par indices locaux des pétales et pratique, il reconstruit ensuite Spatial : les visions ne livrent aucune maîtrise instantanée. Plus tard, un très ancien habitant d’Orthe ayant connu Elio avant sa stase révèle que sa première discipline était Gravité ; l’Elio joué la réapprend graduellement. Il apprend séparément Mecha aux Chantiers de Cendre, puis Biotique après le sauvetage auprès de Lyra. Ces étapes sont espacées et chacune demande des essais et un enseignement.

Après le sauvetage de Lyra, celle-ci lui transmet son savoir Biotique. Elio a appris à reconstruire plusieurs disciplines, mais les détails de ce dernier apprentissage restent à développer. Il n’active normalement qu’un style à la fois : Énergie, Gravité, Spatial, Mecha ou Biotique.

Dans le scénario miroir, cette progression appartient à la protagoniste Lyra et Elio devient le partenaire Biotique qui lui transmet son savoir après son sauvetage. La trame et les limites ne changent pas.
<!-- END:ELIO-POUVOIRS-001 -->

<!-- BEGIN:MECHA-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"POUVOIR-001"} -->
<a id="mecha-001"></a>
## Mecha : discipline humaine artificielle

Mecha est une discipline technologique développée par les humains d’Orthe, et non une cinquième catégorie divine ni un noyau créé par les dieux. Son berceau historique est confirmé : après le Grand Bâillon, aux Chantiers de Cendre, des ingénieurs, ouvriers, médecins et scientifiques cherchent clandestinement une manière de résister sans dépendre du monopole des réactivations du Concordat.

Leur principe symbolique est : « Puisque les Porteurs ont perdu leurs miracles, les humains construiront les leurs. » Outils industriels, prothèses, exosquelettes et technologies médicales bioniques conduisent progressivement aux armures, armes synchronisées et noyaux artificiels Mecha. Une résistance asymétrique se constitue autour de ces techniques, qui se diffusent ensuite grâce aux déplacements, au commerce, à la copie, au vol et aux changements de camp. Les humains du Concordat peuvent donc aussi employer Mecha. Les institutions fondatrices, le design final et les étapes historiques détaillées restent à développer.

Ses utilisateurs peuvent employer prothèses, exosquelettes, systèmes bioniques, armes synchronisées, drones et renforcements artificiels. Des humains ordinaires deviennent ainsi jouables et pullables sans recevoir de noyau divin. Un humain Mecha reste distinct d’un Porteur dont un implant force le noyau biologique et d’un Porteur sain temporairement rechargé par Elio. La technologie n’est pas intrinsèquement corrompue et ne décide pas de la moralité. Le protagoniste — Elio dans la lecture de référence, Lyra dans le scénario miroir — peut apprendre Mecha pendant son périple, tout en respectant la règle d’un seul style actif à la fois.

Pour préserver une interface commune, le noyau artificiel Mecha imite un centre entouré de sept modules ou pétales faits de métal, circuits et composants. Un utilisateur Mecha synchronise progressivement ces sept modules de N1 à N7 ; cette représentation ne le transforme pas en Porteur primordial.
<!-- END:MECHA-001 -->

<!-- BEGIN:COEUR-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002,NOYAU-003,COEUR-003,GACHA-003"} -->
<a id="coeur-001"></a>
## Le Cœur d’Orthe et la restauration

Le Cœur central harmonise et alimente le réseau énergétique d’Orthe. Sa restauration rend aux véritables noyaux présents dans sa zone d’influence leur fonctionnement naturel complet, qu’ils appartiennent aux alliés, aux forces de Séveran ou à aucun camp. Les générations nées Bâillonnées retrouvent un potentiel, pas une expérience jamais acquise. Les implants peuvent laisser des séquelles et aucune conviction ou responsabilité morale n’est effacée.

Le Cœur ne transforme ni humain ni dispositif Mecha en noyau biologique et ne restaure pas rétroactivement une personne morte ou située hors de sa portée. Ce rétablissement ne donne pas instantanément la maîtrise d’une discipline et ne modifie jamais automatiquement la collection du joueur. Un personnage N2 dans la box reste mécaniquement N2 après la fin ; la progression N1 à N7 est une abstraction de gameplay distincte de l’état du monde raconté.
<!-- END:COEUR-001 -->

<!-- BEGIN:COEUR-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"COEUR-001,ELIO-POUVOIRS-001"} -->
<a id="coeur-002"></a>
## Énergie renouvelable, débit et effort collectif

Un noyau naturellement fonctionnel renouvelle sa charge dans la durée, même loin du Cœur. Près du monument ou d’un relais énergétique alimenté, l’accès devient cependant beaucoup plus aisé, abondant et stable ; loin du réseau, la consommation peut largement dépasser la recharge naturelle. Le centre pur d’Elio conserve une capacité renouvelable exceptionnelle, mais ne donne ni puissance instantanée infinie, ni endurance infinie, ni déversement continu sans conséquence. Elio possède un débit maximal, une réserve et un stockage limités, ainsi qu’une capacité physique limitée à supporter le transfert.

Produire, transférer ou utiliser trop d’énergie le fatigue. Un dépassement important peut provoquer des lésions, atteindre ses fonctions vitales et le tuer. Le stockage externe est également limité en capacité, stabilité et restitution : remplir un réservoir pendant plusieurs années ne permet pas de contourner le besoin d’une impulsion stable, simultanée et distribuée.

Le redémarrage du Cœur exige donc plusieurs Porteurs actifs, des réserves, des relais énergétiques, des voies de distribution, des compétences et une synchronisation collective. Les six pétales régionaux sont physiquement rassemblés au Cœur ; le jeune Elio apporte son centre vivant et ses sept pétales propres, et Nacre son raccord compatible encore inexpliqué. Aucun de ces éléments n’est une source originelle illimitée. Une fois réparé, le Cœur entretient son fonctionnement sans maintenir Nacre ou Elio éternellement connectés, y compris pendant le secours en A. Son énergie harmonise les noyaux sans sélectionner les bénéficiaires selon leur mérite.
<!-- END:COEUR-002 -->

<!-- BEGIN:COEUR-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"COSMO-001,GEOGRAPHIE-001,COEUR-001,COEUR-002,FRAGMENT-001,FRAGMENT-002"} -->
<a id="coeur-003"></a>
## Monument divin et relais énergétiques des peuples

Le Cœur est une œuvre divine immense, visible et imposante, autour de laquelle la capitale a été construite. Il n’est ni un petit objet, ni un dispositif entièrement enfoui, ni le centre géologique de la planète. Des ramifications, racines et installations de manipulation existent sous la surface. Il n’a pas de plans industriels copiables et ne peut matériellement pas être emporté dans une capsule ; les peuples savent entretenir ou comprendre certaines fonctions sans pouvoir en fabriquer librement un second.

Pendant la présence divine, les dieux régionaux assurent une diffusion ample de son énergie. Après leur disparition, les peuples construisent des relais énergétiques pour mieux distribuer et stabiliser cet apport. Ces relais précèdent le Grand Bâillon, ne sont pas des sources originelles autonomes et ne téléportent pas. Bien plus tard, Elio-source y installe ses six pétales régionaux pour soutenir les recharges temporaires.

La disparition divine et le Bâillon sont deux crises distinctes. Le Cœur ne se répare pas spontanément : absence des dieux, dégradation, puissance et synchronisation insuffisantes ainsi que l’obstruction du Concordat empêchent son retour. Il ne s’agit pas d’un simple réservoir vide qui se remplirait tout seul.
<!-- END:COEUR-003 -->

<!-- BEGIN:FRAGMENT-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002,COEUR-001,COEUR-003,CONCORDAT-PETALES-001"} -->
<a id="fragment-001"></a>
## Centre pur et exactement sept pétales

Chaque véritable noyau primordial possède un centre et exactement sept pétales. Le centre porte la fonction fondamentale du noyau ; les pétales portent notamment sa capacité exploitable, ses réserves et ses niveaux d’éveil ou de maîtrise. Le noyau d’Elio est particulier parce que son centre n’a jamais été corrompu par le Grand Bâillon et conserve sa capacité génératrice.

Elio-source découvre comment séparer les pétales de son propre noyau, puis en détache six seulement pendant sa tournée, un dans chacune des six grandes régions d’Orthe, et les installe dans les relais énergétiques construits autrefois par les peuples. Il conserve alors son centre pur et son septième pétale. Nacre existe déjà mais ne porte pas encore ce dernier fragment. Ce n’est qu’à Z, avant l’arrivée de Séveran, qu’Elio détache le septième pétale et l’intègre à Nacre pour amorcer le prototype. Détacher ses pétales ne l’empêche pas de poursuivre les premières réactivations tant que son centre reste utilisable ; aucun pétale ni bénéficiaire rechargé ne devient un nouveau centre pur.

Les gardiens des fragments ont des responsabilités locales et une puissance renforcée sans être nécessairement chefs d’État. Chaque pétale porte l’empreinte locale définie dans `FRAGMENT-003`, perceptible en privé par le jeune Elio. Les effets éventuels sur un gardien relèvent d’une influence distincte, sans possession ni effacement du libre arbitre.

Le joueur rassemble les six pétales régionaux connus, Nacre, les Porteurs alliés et son propre noyau au centre pur pour retenter la restauration du Cœur. Il ne greffe pas les six pétales à son propre noyau : il les rapporte physiquement au monument pour une convergence distribuée. Le groupe et le joueur ne savent pas encore que Nacre transporte depuis Z le septième fragment. Retirer un pétale peut priver une région de recharge et l’exposer à une attaque ; les habitants peuvent refuser. Il faut aider, discuter et préparer la transition sans faire disparaître ce risque par un remplacement parfait et gratuit. Aucun pétale régional n’est confirmé comme déjà confisqué par le Concordat.

Elio-source échoue une première fois avant la tournée : son centre seul ne peut fournir au Cœur une puissance assez distribuée. Après la tournée, le deuxième essai utilise les six pétales encore installés dans leurs relais régionaux, des Porteurs actifs et des soutiens, mais le flux demeure insuffisant ou instable avant l’attaque de Séveran, qui interrompt l’opération et tue Lyra-source. Cette structure à deux essais est confirmée ; la tentative jouée, distincte, réunit physiquement les six pétales au Cœur, le centre entier et les sept pétales du jeune Elio, les alliés et Nacre.
<!-- END:FRAGMENT-001 -->

<!-- BEGIN:FRAGMENT-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"FRAGMENT-001,COEUR-003"} -->
<a id="fragment-002"></a>
## Micro-noyaux entretenus et limités

Les pétales séparés deviennent des sortes de micro-noyaux. Leur réserve énergétique est très inférieure à celle d’un noyau complet ; installés dans les relais régionaux, ils peuvent se stabiliser et recharger les pétales de Porteurs déjà réactivés. Ils ne sont ni des sources originelles autonomes, ni des dispositifs de téléportation. Sans centre pur, ils ne peuvent ni créer un nouveau noyau, ni réactiver seuls un Porteur jamais réveillé, ni redémarrer seuls le Cœur d’Orthe.

Ils reçoivent de l’énergie extérieure naturelle ou artificielle, l’utilisent pour maintenir leur stabilité et redistribuent une énergie compatible. Des Porteurs réactivés et des relais régionaux participent à cet entretien. Ils peuvent durer des années, des décennies ou davantage, sans que leur pérennité absolument infinie soit garantie.

L’extraction ultérieure du centre d’Elio-source les rend dormants, sans les détruire ; leur reprise grâce au centre vivant du jeune Elio exige de l’énergie et de l’entretien locaux. L’arrêt peut laisser des infrastructures en panne qu’il faut réparer et redémarrer manuellement. Les Porteurs déjà réactivés conservent leurs propres réserves, leur compatibilité et leur longévité basale : la panne des relais n’est pas un second Bâillon global. Leur micro-mécanique scientifique exacte reste à développer sans autoriser la duplication spontanée de centres purs.
<!-- END:FRAGMENT-002 -->

<!-- BEGIN:FRAGMENT-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"FRAGMENT-001"} -->
<a id="fragment-003"></a>
## Empreintes locales, privées et interprétables

Chaque pétale détaché contient une empreinte sensorielle et émotionnelle locale du moment entourant sa séparation et son don, pas une archive autobiographique cumulative. Il ne connaît aucun événement vécu ensuite ni tout le passé antérieur. Seul le jeune Elio de même signature peut éprouver cette vision privée ; Nacre, ses instruments et les gardiens ne la lisent pas. Son contenu doit être interprété et corroboré : il ne fournit ni coordonnées techniques, ni savoir-faire, ni maîtrise instantanée.

Les six scènes locales jalonnent la tournée sans reconstituer une biographie exhaustive. Le septième pétale donne seulement la scène locale de l’amorçage du prototype à Z, au moment où il est confié à Nacre ; il ne raconte ni toute la collaboration, ni l’attaque, ni la mort. Les journaux partiels de Nacre, des témoins, le corps retrouvé et des mesures réelles fournissent les autres preuves et les paramètres du secours.

Une influence sur un gardien peut amplifier certains états ou résonances, mais reste distincte de la vision privée d’Elio et ne constitue ni une possession, ni une émotion unique imposée à une région entière.
<!-- END:FRAGMENT-003 -->

<!-- BEGIN:ESSAIS-COEUR-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"FRAGMENT-001,COEUR-002,EVT-012,EVT-013,FIN-SEQUENCE-001"} -->
<a id="essais-coeur-001"></a>
## Trois tentatives distinctes au Cœur

Premier essai historique : avant la tournée, Elio-source et son centre pur manquent de puissance distribuée, même avec des aides initiales ; il décide de chercher des relais et des alliés. Deuxième essai historique : ses six pétales sont encore dans leurs relais régionaux, et des Porteurs qu’il a réactivés participent ; le flux demeure instable et insuffisant avant que Séveran n’attaque. L’attaque interrompt l’essai et tue Lyra-source, mais elle n’en est pas l’unique cause technique d’échec. Tentative jouée : le groupe retire et apporte physiquement les six pétales au Cœur après consentement et préparation des régions, avec le noyau complet du jeune Elio, ses propres sept pétales, les alliés, les réserves et Nacre. Celle-ci complète la compatibilité collective sans être une source d’énergie illimitée.
<!-- END:ESSAIS-COEUR-001 -->

<!-- BEGIN:CORPS-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"CENTRE-EXTRAIT-001,SEVERAN-003,REVELATIONS-001,FIN-SEQUENCE-001"} -->
<a id="corps-001"></a>
## Le corps d’Elio-source conservé comme preuve

Après le raid Z, Séveran récupère le corps d’Elio-source et son centre extrait devenu inerte. Ses chercheurs essaient en vain d’en tirer une référence active ; ils conservent ensuite les restes post-mortem et les travaux saisis, sans stase d’un sujet vivant ni résurrection possible. Le groupe ne découvre physiquement le corps et le centre qu’après les deux affrontements du final et la révélation de Z par Nacre ; une indication de Séveran peut contribuer à les retrouver, sans être la seule piste. Une sépulture après le secours de Lyra est proposée, pas obligatoire à ce stade.
<!-- END:CORPS-001 -->

<!-- BEGIN:TOURNEE-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"piste","views":"resume","period":"","order":0,"refs":"FRAGMENT-001,FRAGMENT-003,ESSAIS-COEUR-001"} -->
<a id="tournee-001"></a>
## Pistes brèves pour la tournée d’Elio-source

Chaque don régional peut associer un besoin concret, un accord local et un coût ultérieur de dépendance au relais : défense d’un refuge, soins, atelier, passage, réparation ou communauté isolée. Les six scènes précises, leur ordre, les gardiens, les dialogues et les durées ne sont pas confirmés ; ils seront écrits période par période lors du scénario détaillé. Les empreintes locales ne doivent pas révéler tout ce qu’Elio-source vivra après chaque don.
<!-- END:TOURNEE-001 -->

# Temps et machine

<!-- BEGIN:TEMPS-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":""} -->
<a id="temps-001"></a>
## La fenêtre n’efface pas le passé réalisé

La technologie ouvre une continuation matérielle réelle et locale à partir d’un instant A conservé ; elle ne modifie pas l’histoire-source de l’univers. Le sauvetage reprend la même scène après la blessure et l’extraction initiale, sans retour illimité au début ni duplication libre.

L’instant A-source est l’expérience originale, sans attaque. A-fenêtre est la continuation ouverte depuis Z, où a lieu le prologue joué. Le scientifique a vécu A-source, puis G et Z. L’Elio joué commence dans A-fenêtre avant d’être extrait vers le présent de Z.

Elio joué croit Lyra morte avant son extraction et le joueur partage son point de vue. Nacre ne certifie pas une mort irréversible qu’elle saurait fausse. Lyra-source demeure morte tandis que la continuité de Lyra du prologue reste conservée.

Dans les dialogues ordinaires, « retourner dans le passé » peut être un raccourci de personnage. Dans les explications scientifiques, il faut préciser « accéder à l’ancien instant conservé ». Tuer Séveran après son raid n’efface donc pas l’aventure.
<!-- END:TEMPS-001 -->

<!-- BEGIN:TEMPS-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-001,SEVERAN-003,ELIO-POUVOIRS-001,COUPLE-001"} -->
<a id="temps-002"></a>
## De la localisation précise à l’ancre temporelle

À A-source, Elio est fasciné par le voyage, la localisation, les référentiels, les phénomènes temporels et les relations entre position, état et instant. Avec Lyra, il travaille sur une technologie encore primitive de localisation spatio-temporelle extrêmement précise ou sur un dispositif apparenté. Elle peut viser l’amélioration de relais, l’enregistrement exact de l’état d’un lieu, la synchronisation de déplacements ou la comparaison de référentiels ; ces applications scientifiques exactes restent proposées.

L’expérience de A produit une empreinte extraordinairement précise du laboratoire et de son état. Ce n’est pas encore une machine fonctionnelle de voyage temporel. Bien plus tard, Elio-source découvre que l’empreinte n’a pas seulement conservé où cet état se trouvait, mais assez d’informations pour retrouver quand il existait. Elle devient l’ancre de ses recherches temporelles.

Après la mort de Lyra-source, le scientifique veut la revoir et réparer ses erreurs. À Z, il a préparé personnellement une ouverture vers A, moment de leur vie commune ; il amorce le prototype avec le septième pétale confié à Nacre puis ouvre lui-même la fenêtre avant l’arrivée de Séveran. Son prototype ne sait produire que des ouvertures locales ancrées, pas réécrire l’histoire-source. Sa capacité à le concevoir associe sa maîtrise consciente de Spatial acquise après G, ses intuitions de Gravité anciennes, ses compétences scientifiques réelles et les recherches collectives auxquelles il accède. Spatial ne lui confère aucun voyage temporel inné.

Les essais temporels ultérieurs portent sur des volumes réduits, des objets, des instruments et le retour de sondes. Une intrusion puis une extraction humaine n’ont pas encore été validées en conditions sûres. Le dossier ne doit pas promettre qu’une vraie réécriture deviendra forcément possible avec davantage de recherche. L’Elio joué termine l’histoire avec un sauvetage limité, pas avec un pouvoir de refaire toute réalité.

Elio ignore que Séveran va arriver. La prise du laboratoire peut être préparée à partir de traces, d’espionnage ou de travaux antérieurs, mais l’antagoniste ne choisit pas providentiellement A après coup : il traverse la destination déjà ouverte. Le temps limité de la fenêtre commence dès l’ouverture, y compris l’observation de A depuis Z et l’affrontement dans le laboratoire de Z. La fenêtre amorcée reste brièvement ouverte indépendamment de la dormance puis du nouveau raccord du pétale de Nacre.
<!-- END:TEMPS-002 -->

<!-- BEGIN:TEMPS-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-001,TEMPS-002"} -->
<a id="temps-003"></a>
## Ancre, machine et accès : trois choses distinctes

L’« anneau témoin » reste un nom de travail pour le dispositif primitif qui enregistre à A une empreinte exceptionnellement précise du laboratoire. Il n’est pas présenté à cette date comme une technologie temporelle maîtrisée. Plus tard, cette empreinte devient l’ancre unique de l’événement A ; la machine développée après G est l’appareil qui ouvre cet événement ; Nacre transporte des commandes et des coordonnées. Reconstruire un appareil ne recrée pas l’ancre ni un nouveau partenaire.

| Élément | Ce qu’il peut faire | Ce qu’il ne peut pas faire |
|---|---|---|
| Empreinte de l’anneau témoin | Devenir, après les recherches ultérieures, l’ancre d’une continuité locale unique et de son reliquat. | Constituer dès A une machine temporelle maîtrisée, être remplacée par une copie ordinaire ou recommencer les instants consommés. |
| Machine chronale | Fournir énergie, confinement, accès et extraction. | Choisir librement n’importe quelle date sans ancre. |
| Nacre | Exécuter le secours, authentifier l’accès, relever un diagnostic et piloter des relais autorisés. | Produire toute l’énergie nécessaire ou fabriquer une nouvelle ancre depuis un souvenir. |

A est le seul enregistrement complet utilisable par le prototype. Le laboratoire concerné ne contient que le couple, puis les visiteurs identifiés : aucune foule consciente n’est créée puis oubliée lorsque l’enceinte disparaît.

Le volume, le temps actif et les possibilités d’extraction sont limités. Une continuation dérivée ne peut pas servir de source à une cascade d’ancres du même événement. Le coût matériel et la non-duplicabilité interdisent une réserve illimitée de noyaux ou de personnages.
<!-- END:TEMPS-003 -->

<!-- BEGIN:TEMPS-004 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"IA-003,VOYAGE-001,CAPSULE-SELIS-001"} -->
<a id="temps-004"></a>
## Sélis, site original de A et les deux déplacements de Nacre

Z est une date, pas une planète. Le laboratoire de Z se trouve sur Sélis, au site de l’expérience originale de A ; après l’extraction A → Z, Nacre emploie les balises préparées pour téléporter le jeune Elio vers Orthe. La dernière intervention médicale doit revenir à ce site original, avec son ancre physique : la restauration du Cœur fournit l’énergie, pas une nouvelle adresse temporelle.

Le scientifique est revenu travailler au site de Sélis où se trouve l’anneau de son ancienne expérience ; la forme précise du laboratoire ou observatoire reste proposée. Vers la fin de sa vie, il développe avec Nacre des installations de téléportation interplanétaire et prépare les deux extrémités nécessaires. Le Concordat possède des moyens d’accès à ce site, sans nécessairement gouverner toute la planète.

Le trajet du secours est : A-fenêtre → laboratoire de Sélis au présent Z → installation clandestine de téléportation au Havre des Traverses, sur Orthe. Séveran revient séparément au laboratoire. Le Méridien et sa région-capitale restent distincts de la Couronne des Marées et constituent le lieu proposé des affrontements finaux.

Cette localisation remplace la v1.0, où la fenêtre était ouverte directement au Méridien : le trajet vers Orthe est ici une véritable téléportation interplanétaire, et le secours final exige de revenir au laboratoire original de Sélis.
<!-- END:TEMPS-004 -->

<!-- BEGIN:TEMPS-005 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"parametre","views":"","period":"","order":0,"refs":"IA-004,TEMPS-002"} -->
<a id="temps-005"></a>
## Durée limitée sans chronomètre canonique

La durée de la fenêtre est courte et limitée, mais aucun nombre de secondes n’est canonique. Le compte commence quand Elio-source ouvre A à Z : observation depuis Z, arrivée de Séveran, vision du jeune Elio, coup mortel, extraction du centre, dernier ordre à Nacre, mort de la source, traversée vers A, interposition de Lyra, extraction du jeune Elio, retour de Séveran et suspension consomment tous cette durée. La mise en scène devra vérifier un budget crédible sans réutiliser les anciens repères de 112, 118, 146, 180 ou 34 secondes. Le final reprend au point de suspension, jamais avant le coup ; il ne promet aucun chronomètre de gameplay ni essais infinis.
<!-- END:TEMPS-005 -->

# Nacre et le secours

<!-- BEGIN:IA-001 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":""} -->
<a id="ia-001"></a>
## Nacre : assistant de terrain, pas oracle

Nacre est un assistant mobile créé par le scientifique de l’histoire-source avec des ingénieurs d’Orthe. Elle sert aux recherches, aux diagnostics, aux réaccords et, tard dans la vie d’Elio-source, à commander les installations de téléportation interplanétaire qu’ils ont construites. Elle ne transforme jamais un relais énergétique régional en portail.

Son corps peut rester une petite sphère à segments mobiles. Sa personnalité, son langage, ses repères élémentaires et sa mémoire nouvelle sont distincts des archives historiques qu’elle peut perdre. Elle n’est pas l’âme de Lyra.

Sa capacité de téléportation repose sur des installations tardives de départ et d’arrivée, des coordonnées, des autorisations et une réserve d’énergie. Elle ne peut pas envoyer une personne n’importe où depuis un cachot, ni transporter une armée sans moyens. Ces passages sont construits avant Z mais après les voyages en vaisseau de Lyra et du couple ; ils ne constituent pas une autre machine à remonter le temps.

Elle dit les faits qu’elle peut vérifier et distingue clairement certitude, mesure partielle et hypothèse. Les témoins d’Orthe peuvent compléter ou contredire ses archives.
<!-- END:IA-001 -->

<!-- BEGIN:IA-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"SEVERAN-003,TEMPS-003,IA-003"} -->
<a id="ia-002"></a>
## Une évacuation générale qui change de cible

À Z, Elio-source connaît le risque d’une interruption et prépare Nacre à une évacuation possible, mais ne prévoit ni l’attaque exacte ni le secours du jeune Elio. Après le coup mortel et l’extraction de son centre, encore brièvement conscient, il donne son dernier ordre à Nacre : le protéger, l’évacuer du laboratoire, utiliser l’installation de téléportation sûre et l’emmener sur Orthe. La routine vise Elio-source lui-même ; elle n’est pas conçue pour récupérer sa version du point A.

Séveran arrive pendant la fenêtre déjà ouverte et voit le jeune Elio depuis Z. Il porte un coup mortel à Elio-source, puis extrait son centre ; celui-ci devient inerte aussitôt et les sept pétales se taisent. Elio donne alors l’ordre ci-dessus ; il est encore brièvement vivant, mais Nacre ne parvient pas à l’évacuer avant sa mort. Elle reste avec une cible principale morte, une routine active et l’ordre inachevé de conduire Elio vers Orthe. L’extraction n’est pas la cause automatique de sa mort.

Lorsque Séveran traverse la faille déjà ouverte sur A, Nacre détecte de l’autre côté une signature fondamentale compatible avec Elio — même centre pur et même identité biologique ou signature de noyau — mais vivante. Le détail informatique reste proposé. Le protocole adapte alors sa cible de secours et suit la faille. En A, son pétale peut se raccorder au jeune Elio, tandis que les six pétales d’Orthe restent dormants. Elio-source n’avait prévu ni cette continuation exacte, ni l’interposition de Lyra, ni toute l’aventure future ; Nacre prend une décision opérationnelle à partir d’une routine générale, pas d’une prophétie.
<!-- END:IA-002 -->

<!-- BEGIN:IA-003 -->
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-004,IA-002,IA-004"} -->
<a id="ia-003"></a>
## L’extraction pendant l’interposition

Nacre franchit la faille après Séveran. Pendant que Lyra, sans pouvoirs Biotiques restaurés, blesse Séveran avec ses moyens ordinaires ou son équipement puis reçoit une blessure gravissime, Nacre arrache l’Elio joué au danger et le fait repasser physiquement par la faille vers Z. Les six pétales d’Orthe se raccordent alors au centre jeune avant le passage interplanétaire. Elio entrevoit un corps indistinct dans le laboratoire, sans le reconnaître et sans nouvelle amnésie. Nacre achève l’ordre initial en activant l’installation tardive de téléportation vers Orthe. Le trajet A-fenêtre → Z → Orthe forme une seule logique de secours.

La scène doit disposer les personnages de façon lisible : l’instrument de Séveran vise Elio, Lyra se place entre eux, et le corps de l’assaillant ainsi que la perturbation lumineuse masquent le retour vers la faille. Nacre entre sous couverture instrumentale de maintenance, pas grâce à une invisibilité illimitée.

Séveran, blessé et désorienté par Lyra, ses implants et le franchissement, ne voit pas la manœuvre. Il cherche Elio, constate sa disparition puis revient séparément au présent Z. Il ne reste pas ignorant de l’échec ; il ignore d’abord son mécanisme et la destination d’Elio. Ses forces organisées continuent néanmoins d’agir sur Orthe. La suspension du reliquat de A n’intervient qu’après ce retour.

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
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"IA-001,IA-003,IA-004,FRAGMENT-003,IA-006"} -->
<a id="ia-005"></a>
## Mémoire endommagée et septième pétale inaccessible

L’extraction du centre d’Elio-source éteint le raccord du pétale de Nacre et endommage surtout ses index historiques et ses accès à certaines archives ; les commutations lors du passage A puis du retour Z aggravent ce désordre. Le seul passage temporel ou une dépense d’énergie ordinaire ne sont pas l’explication suffisante. Elle garde sa personnalité, ses fonctions d’accompagnement et ses souvenirs nouveaux ; aucune archive complète et lisible de Z n’est secrètement disponible au début.

Au début, Nacre ne se souvient pas qu’elle possède ce septième pétale et ne peut pas lire son empreinte — de toute façon, seul le jeune Elio peut éprouver cette vision locale. L’Elio joué ignore lui aussi que le dernier fragment est à ses côtés. Les connaissances restantes ne sont pas stockées dans un seul « souvenir du boss » : l’aventure restaure des instruments, des journaux partiels, des relais et des témoignages complémentaires.

Nacre peut constater l’époque, son origine scientifique et l’exécution d’un secours. Ses propres journaux et capteurs sont la source possible des événements postérieurs au détachement du septième pétale, notamment l’assassinat, mais leurs index sont endommagés et ne lui donnent pas au début un récit complet immédiatement lisible. Elle a vu la blessure de Lyra et perdu la télémétrie ; elle ne doit jamais annoncer une mort médicalement confirmée puis révéler qu’elle connaissait la survie depuis le début.

À mesure que les six pétales régionaux résonnent avec l’Elio joué, Nacre peut reconstruire certains index et manifester des réactions inhabituelles, sans que le groupe ou le joueur puisse encore identifier un septième fragment. Cette restauration progressive ne donne pas à Nacre les visions privées d’Elio et ne la transforme pas en copie consciente du scientifique.
<!-- END:IA-005 -->

<!-- BEGIN:IA-006 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"FRAGMENT-001,TEMPS-001"} -->
<a id="ia-006"></a>
## Le fragment de Nacre et son transfert final

Nacre existe pendant la tournée régionale sans porter le dernier fragment. Ce n’est qu’à Z, avant l’arrivée de Séveran et pour amorcer le prototype, qu’Elio-source détache son septième pétale et le lui intègre. Le pétale devient dormant lorsque le centre source est extrait, se raccorde au jeune Elio de son côté de A, puis demeure raccordé après son retour en Z. Nacre voyage avec cette trace sans en avoir conscience et sans devenir une copie du scientifique, une connaissance totale de sa vie ou un oracle. Le groupe ne l’identifie qu’après sa contribution au redémarrage et la sécurisation de la situation.

Après la découverte du pétale, le jeune Elio en éprouve l’empreinte locale d’amorçage ; les données partielles de Nacre, des mesures de l’ancre et d’autres preuves établissent les paramètres opératoires du secours de Lyra. Une fois ce secours accompli, le composant temporel dangereux est détruit irréversiblement. Une tentative préparée et consentie préserve l’identité et les souvenirs personnels de Nacre dans un assistant dépourvu de pouvoir temporel. Ce retour ne doit pas être raconté comme la résurrection gratuite d’une IA dont la disparition absolue aurait auparavant été certifiée. Le sort matériel exact du pétale pendant ce transfert reste ouvert.

Ses lacunes historiques proviennent principalement de la rupture puis des changements de raccord du pétale, pas de la collecte d’énergie destinée au Cœur. Le transfert final préserve autant que possible sa personnalité et ses souvenirs personnels ; sa réalisation technique détaillée reste à développer.
<!-- END:IA-006 -->

<!-- BEGIN:IA-007 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"IA-005,IA-006,COEUR-001,COEUR-002,FRAGMENT-003,FIN-SEQUENCE-001,REVELATIONS-001"} -->
<a id="ia-007"></a>
## Résonance, empreinte locale et autonomie du Cœur

Le groupe prépare le redémarrage avec les six fragments physiquement rapportés au Cœur, le centre vivant et les sept pétales propres du jeune Elio, les réserves, les relais réparés et les compétences des Porteurs réunis. Le flux collectif approche de la réussite sans se stabiliser. Nacre apporte alors ses fonctions connues de raccordement, sans savoir qu’elle contient un pétale déjà relié au jeune Elio. Son apport n’est pas supérieur à celui de tous les alliés : cette compatibilité complète l’effort collectif.

Les pétales ne portent que l’empreinte locale de leur séparation. Le septième fournit au seul jeune Elio un fragment sensoriel et émotionnel de l’amorçage à Z, jamais l’assassinat ni l’histoire complète de la collaboration. L’attaque, l’extraction, la mort et l’adaptation du secours doivent être établies par les données partielles propres à Nacre, des témoins, le corps et le centre retrouvés ou d’autres archives réellement créées à cette date. Les changements de raccord ont endommagé les index historiques sans effacer les souvenirs personnels formés pendant l’aventure.

Le Cœur restauré agit ensuite sur les noyaux des alliés comme des adversaires et devient autonome, y compris lorsque le jeune Elio se rend ensuite en A. Après la sécurisation obtenue lors du second affrontement, l’équipe analyse la contribution de Nacre : la résonance et ses index partiellement réparés révèlent alors, et seulement alors, le septième fragment. La vision privée d’Elio, les mesures et les données corroborées donnent des paramètres utilisables pour le sauvetage, pas des coordonnées tombées toutes faites d’une mémoire. Cette séquence n’exige pas la mort de Nacre avant la dernière fenêtre.
<!-- END:IA-007 -->

<!-- BEGIN:REVELATIONS-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"MEMOIRE-001,FRAGMENT-003,IA-005,IA-006,IA-007,CH-12,CH-15"} -->
<a id="revelations-001"></a>
## Vérité d’auteur, connaissance du groupe et révélation au joueur

| Étape jouée | Informations accessibles | Informations encore non certaines |
|---|---|---|
| Prologue A | Couple, recherche primitive, intrusion, blessure de Lyra et secours vu par Elio ; bref corps indistinct à Z sans reconnaissance. | Origine de Lyra, identité du corps, septième pétale, déroulement de Z. |
| Première région | Panne locale du relais puis remise en service ; les habitants expliquent l’insuffisance du premier essai historique. Elio propose de rassembler les pétales au Cœur comme hypothèse, non certitude prophétique. | Mort d’Elio-source, détail de Z et identité du septième pétale. |
| Régions suivantes | Scènes locales privées éprouvées par Elio autour de chaque don, récits de témoins, Spatial réappris, puis passé Gravité révélé et réappris ; preuves datées de la mort de Lyra-source et de la collaboration. | Archives exhaustives ou vision de la mort par un pétale. |
| Préparation du Cœur | Usage voulu par Séveran d’un Elio vivant, limites des essais historiques, choix et coût du retrait des pétales régionaux. | Révélation complète de Z, coordonnées de secours ou septième identifié. |
| Redémarrage et second combat | Contribution surprenante de Nacre et restauration non sélective, puis neutralisation de Séveran. | Corps et centre physiquement découverts, paramètres définitifs du secours. |
| Après sécurisation | Septième identifié ; vision locale d’amorçage vécue par Elio ; données partielles et preuves corroborées établissent Z ; corps et centre inerte retrouvés ; mesures de l’ancre donnent les paramètres opératoires. | Aucun souvenir postérieur au détachement attribué au pétale. |
| Dernière fenêtre | Retour au site original de Sélis avec ancre physique, puissance autonome du Cœur et soins pour extraire Lyra. | Retour avant la blessure, ancre neuve ou résurrection de Lyra-source. |

La bible expose toute la vérité d’auteur, mais un fait écrit ici n’est pas automatiquement dicible par Nacre au chapitre 1. Les révélations tardives reposent sur des preuves réellement absentes, verrouillées ou endommagées ; les témoins peuvent dire plus tôt les faits qu’ils connaissent légitimement.
<!-- END:REVELATIONS-001 -->

# Gacha et progression

<!-- BEGIN:GACHA-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-005,MECHA-001"} -->
<a id="gacha-001"></a>
## Rencontrer puis atteindre N1 par le premier pull

Aucun personnage ne peut être tiré avant une véritable rencontre narrative et une coopération crédible. Pour un Porteur, le premier pull accomplit ou matérialise sa première réactivation consciente avec le protagoniste au centre pur et éveille le premier niveau de son noyau : N1. Pour un humain Mecha, il établit la première synchronisation complète de son noyau artificiel : N1. Il ne crée jamais une copie de la personne.

Les compagnons Porteurs disposent ensuite d’énergie parce qu’ils voyagent auprès d’Elio ou accèdent aux pétales et relais. Le temps partagé et la compatibilité préparent le rituel sans suffire seuls à le déclencher. Un bénéficiaire ne peut pas réactiver à son tour d’autres noyaux. Les utilisateurs Mecha tirent leur capacité de leur technologie, pas d’un noyau divin implicite.

Pour un ancien ennemi, la séquence comprend affrontement, soin possible, responsabilité et choix réel avant l’éligibilité. La guérison ne convertit personne automatiquement. À l’inverse, un ancien allié peut aussi changer de camp ; la dégradation physique ou mentale ne définit pas le mal.

Ni le sauvetage de Lyra ni la vraie fin ne dépendent d’un tirage rare. Les personnages et moyens indispensables sont prêtés ou fournis par la campagne.
<!-- END:GACHA-001 -->

<!-- BEGIN:GACHA-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"GACHA-001,REDEMPTION-001,MECHA-001"} -->
<a id="gacha-002"></a>
## N1 à N7 : éveil des pétales ou modules

La première obtention d’un personnage est N1. Chaque obtention suivante augmente son niveau d’un cran jusqu’à N7 : deuxième obtention N2, troisième N3, quatrième N4, cinquième N5, sixième N6 et septième N7. Il n’existe pas de N0 dans cette progression.

Pour un Porteur, N1 à N7 représente l’éveil progressif des sept pétales de son véritable noyau. Pour un utilisateur Mecha, la même interface représente la synchronisation progressive des sept modules ou pétales de son noyau artificiel. Le centre et les pétales Mecha doivent visuellement évoquer métal, circuits et technologie, sans devenir une cinquième catégorie divine.

Le joueur possède toujours le même personnage : N7 ne signifie ni sept copies narratives, ni sept âmes. Pour une personne déjà éveillée par Elio-source, N1 établit son Accord de collection avec l’Elio joué sans annuler sa puissance narrative antérieure. La rareté et les paramètres économiques restent des choix de gameplay, pas une hiérarchie morale.
<!-- END:GACHA-002 -->

<!-- BEGIN:GACHA-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"COEUR-001,GACHA-002"} -->
<a id="gacha-003"></a>
## Plein noyau narratif et collection séparée

Après la restauration du Cœur, les véritables noyaux retrouvent narrativement l’équivalent de leur plein fonctionnement et de leurs sept pétales. Cet état du monde ne modifie pas la box : un personnage N1 ou N2 y conserve son niveau mécanique, les obtentions futures restent utiles et l’économie gacha n’est pas supprimée.

Cette différence est une abstraction assumée entre récit et collection. Elle ne doit pas être cachée par une fausse équivalence ni utilisée pour rendre la victoire dépendante d’un personnage rare.
<!-- END:GACHA-003 -->

# Fin et conséquences

<!-- BEGIN:FIN-SEQUENCE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"COEUR-001,COEUR-002,IA-006,IA-007,FIN-001,FIN-003,SEVERAN-005,REVELATIONS-001"} -->
<a id="fin-sequence-001"></a>
## Deux affrontements, une révélation et le secours

Le final joué suit ces jalons sans les confondre avec les deux essais historiques d’Elio-source :

1. la coalition rassemble physiquement les six fragments connus au Cœur après accord et transition dans les régions, avec le centre et les sept pétales du jeune Elio, Nacre, les réserves et les compétences alliées ;
2. un premier grand affrontement contre Séveran et son dispositif ouvre et protège l’accès au Cœur sans résoudre définitivement toute l’opposition ni imposer sa mort ;
3. l’effort collectif approche de la réussite, puis la contribution compatible mais encore inexpliquée de Nacre complète la stabilisation ;
4. le Cœur redémarre et restaure naturellement les noyaux concernés des alliés comme des adversaires ;
5. un second grand affrontement tient compte de cette puissance retrouvée et aboutit à la neutralisation politique et militaire de Séveran et des forces fidèles, sans mort obligatoire ;
6. après sécurisation, l’analyse révèle le septième pétale dans Nacre ; Elio seul en éprouve la scène locale d’amorçage, tandis que journaux partiels et autres preuves établissent Z ; le groupe retrouve ensuite physiquement le corps d’Elio-source et son centre inerte ; des mesures vérifiées donnent les paramètres du secours ;
7. le groupe revient au site original de Sélis avec l’ancre physique, cette connaissance, la puissance stable et autonome du Cœur et une équipe de soins/extraction pour sauver Lyra du prologue ;
8. l’accès temporel est définitivement fermé, les composants dangereux sont détruits, Nacre traverse un transfert risqué, puis viennent convalescence et épilogue.

Les phases de combat, la contention de Séveran entre les deux affrontements et les modalités précises de sa survie restent à concevoir après le cadrage du jeu. La victoire vient des alliances, compétences, préparatifs et moyens de neutralisation, pas d’une énergie qui choisirait le camp moralement bon.
<!-- END:FIN-SEQUENCE-001 -->

<!-- BEGIN:FIN-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-001,COUPLE-002,FIN-SEQUENCE-001,REVELATIONS-001"} -->
<a id="fin-001"></a>
## Sauver sans revenir avant la blessure

Après le redémarrage, le second affrontement, la révélation de Z et la découverte du corps, le groupe réunit trois conditions au site original de Sélis : la même ancre physique et un appareil compatible ; des paramètres opérationnels vérifiés par vision locale d’Elio, données partielles de Nacre, mesures et corroborations ; la puissance stable du Cœur restauré avec les moyens médicaux d’extraction. Le Cœur reste autonome pendant le voyage du jeune Elio en A. Le groupe reprend la même scène conservée après la blessure, l’extraction initiale d’Elio et la sortie de Séveran. Il est trop tard pour empêcher l’agression, mais Lyra du prologue peut encore être stabilisée, extraite vivante et soignée.

L’énergie du Cœur ne crée aucune ancre, ne recharge aucun instant consommé et n’autorise pas d’essais infinis. La fermeture consomme l’accès restant. Elio-source et Lyra-source restent morts. Le sauvetage de Lyra du prologue n’annule ni le départ d’Elio ni les morts de la guerre. Une nouvelle machine sans cet anneau ne peut pas recommencer la même scène.
<!-- END:FIN-001 -->

<!-- BEGIN:FIN-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"FIN-001,FIN-SEQUENCE-001,IA-006"} -->
<a id="fin-004"></a>
## Moyens proposés de la dernière extraction

Un appareil compatible, les paramètres établis par recoupement des preuves de Z et des mesures de l’ancre, un examen direct, une stabilisation biologique et une enveloppe d’extraction médicalisée apporteraient au final ce qui manquait au secours initial de Nacre. Des mesures partielles établiraient auparavant la conservation et une chance de survie sans la garantir. Le prototype original de Z pouvait fonctionner sans Cœur restauré parce qu’il utilisait une installation complète, une ancre encore non consommée et une opération risquée ; le secours final travaille sur un reliquat partiellement consommé avec une blessée à transférer.

Lyra récupérerait progressivement après son arrivée dans le présent et ne combattrait pas immédiatement comme si aucune blessure n’avait eu lieu. Les détails médicaux et la durée du reliquat restent révisables ; le site du secours demeure le laboratoire original de Sélis, sans nouvelle ancre.
<!-- END:FIN-004 -->

<!-- BEGIN:FIN-002 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"regle","views":"resume","period":"","order":0,"refs":"FIN-001,FIN-003,SEVERAN-002,SEVERAN-005,GRAINE-001,GACHA-003,MONDE-002,COSMO-002"} -->
<a id="fin-002"></a>
## Victoire et monde après l’histoire

Après le redémarrage du Cœur, les noyaux véritables retrouvent leur fonctionnement narratif complet sans remplacer la tutelle de Séveran par celle d’Elio. Le niveau N1 à N7 de la collection reste séparé de cette restauration mondiale.

Le héros refuse de devenir le propriétaire des Porteurs qu’il a aidés. Le rôle de gardien des passages sous mandat commun reste proposé. Les régions conservent des désaccords, des victimes, des institutions à transformer et des recherches inachevées.

Le couple choisit de poursuivre sa relation après des soins et de vraies conversations sur le secret de Lyra. Nacre garde sa personnalité après un transfert risqué. Les liens avec les proches de Sélis sont renoués, avec le poids des années écoulées. Si Séveran survit maîtrisé, de futurs échanges ou un chemin de rédemption restent seulement possibles, sans pardon ni recrutement garantis.

Les arcs suivants peuvent explorer les routes planétaires, les conséquences du Concordat, l’histoire des divinités, les capsules perdues, leurs survivants et d’éventuelles sociétés descendantes de Porteurs. Leurs occupants peuvent être devenus héros, protecteurs, tyrans, criminels, figures mythologiques ou personnes ordinaires ; aucun nombre, monde ni destin particulier n’est confirmé. Ces arcs ne réintroduisent pas une ancre parfaite capable d’annuler chaque perte.
<!-- END:FIN-002 -->

<!-- BEGIN:FIN-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"COEUR-001,SEVERAN-001,SEVERAN-005,FIN-001,IA-006,IA-007,FIN-SEQUENCE-001"} -->
<a id="fin-003"></a>
## Conclusion collective avant le sauvetage intime

La fin suit impérativement l’ordre de `FIN-SEQUENCE-001` : premier affrontement avant le redémarrage ; contribution inexpliquée de Nacre ; restauration des noyaux alliés et ennemis ; second affrontement et neutralisation de Séveran ; découverte du septième pétale, vision locale privée d’Elio et preuves de Z ; découverte physique du corps et du centre inerte ; mesures et dernière ouverture au site de Sélis pour sauver Lyra ; destruction de l’accès temporel avec transfert risqué de Nacre ; convalescence, puis épilogue. L’apprentissage Biotique ne commence que plus tard auprès de Lyra rétablie.

La microchronologie des combats et la contention de Séveran entre les deux affrontements restent adaptables. En revanche, la restauration n’est pas une sélection morale, la révélation de Z précède le secours qui en dépend, la victoire collective précède le sauvetage intime et aucun combat du présent n’efface l’histoire-source. Séveran doit être maîtrisé et mis hors d’état de nuire, pas nécessairement tué.
<!-- END:FIN-003 -->

# Chronologie

<!-- BEGIN:EVT-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Fondation d’Orthe","order":1,"refs":"MONDE-001,COSMO-001,GEOGRAPHIE-001,COEUR-003"} -->
<a id="evt-001"></a>
## Orthe façonnée par ses divinités locales

Les huit divinités locales façonnent Orthe, ses premiers peuples, les noyaux et le Cœur monumental. La capitale se forme autour du monument ; les peuples gagnent ensuite six grands ensembles régionaux accompagnés par les dieux associés. Cela n’établit pas que ces dieux ont créé le cosmos entier.
<!-- END:EVT-001 -->

<!-- BEGIN:EVT-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Ères suivant la fondation","order":2,"refs":"MONDE-002,COSMO-002,COSMO-003,COEUR-003,POLITIQUE-001"} -->
<a id="evt-002"></a>
## Les migrations humaines

Une partie des humains ordinaires gagne d’autres planètes par vaisseau, tandis que leur majorité reste sur Orthe et que les Porteurs s’y concentrent alors. Les divinités locales disparaissent ou sont rappelées pour un motif non fixé ; la distribution énergétique devient plus difficile. Les peuples construisent des relais énergétiques non téléportants, développent leurs institutions régionales puis une fédération avec assemblée centrale.
<!-- END:EVT-002 -->

<!-- BEGIN:EVT-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Avant le Grand Bâillon","order":3,"refs":"HIST-001,HIST-004,POLITIQUE-001,SEVERAN-001"} -->
<a id="evt-003"></a>
## La crise de l’héritage

Des abus réels de pouvoirs nourrissent les mouvements de régulation. Séveran, Porteur Énergie et haut responsable de la capitale, commence comme réformateur, puis son projet se radicalise tandis que son équipe scientifique développe séparément l’inhibiteur du Cœur et des amplificateurs personnels testés sur des Porteurs volontairement déchargés. Les tensions politiques croissent ; le titre précis et les dates restent à définir.
<!-- END:EVT-003 -->

<!-- BEGIN:EVT-004 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Après le vote, avant le Grand Bâillon","order":4,"refs":"GRAINE-001,HIST-002,ELIO-POUVOIRS-001"} -->
<a id="evt-004"></a>
## Vote, coup d’État et envoi des capsules

La tendance du vote favorise un Cœur libre. Séveran refuse cette issue, lance le coup d’État et tire avantage des amplificateurs déjà implantés. Les organisateurs tentent alors d’envoyer autant de capsules et de volontaires Porteurs que possible sous la poursuite. Motivations, interceptions, destructions, dérives et pertes de suivi varient. Les capsules préservées ont déjà quitté la zone d’influence lorsque survient le Bâillon ; leur nombre demeure inconnu. Elio maîtrise déjà Gravité lorsqu’il entre en stase ; il cherche des solutions ailleurs.
<!-- END:EVT-004 -->

<!-- BEGIN:EVT-005 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Après le départ des capsules","order":5,"refs":"HIST-002,HIST-003,HIST-004,INHIBITEUR-001,AMPLIFICATEUR-001"} -->
<a id="evt-005"></a>
## L’inhibiteur frappé et le Grand Bâillon

Dans l’escalade post-coup, Séveran déploie prématurément son inhibiteur sur le Cœur. La résistance frappe le dispositif pendant l’affrontement et provoque accidentellement le Grand Bâillon dans la zone d’influence d’Orthe. Les deux camps perdent leurs pouvoirs naturels ; les amplificateurs clandestins donnent ensuite à la faction de Séveran un avantage partiel malgré leurs effets corrupteurs. Elle consolide le Concordat au nom de l’ordre.
<!-- END:EVT-005 -->

<!-- BEGIN:EVT-006 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Du Bâillon au réveil sur Sélis","order":6,"refs":"MONDE-002,NOYAU-003,GRAINE-001"} -->
<a id="evt-006"></a>
## L’occupation et la recherche

Orthe connaît des phases de paix contrainte, de révolte et de recomposition ; ce n’est pas une guerre de front identique pendant des millénaires. Des lignées Porteuses transmettent des noyaux Bâillonnés. Le Concordat perfectionne les réveils forcés issus des prototypes antérieurs, tandis que Mecha se diffuse depuis les Chantiers. Un collectif Biotique participe aux soins même sans pouvoirs actifs. Lyra se porte volontaire pour rechercher les capsules par vaisseau, sans parvenir à établir le sort de la plupart d’entre elles.
<!-- END:EVT-006 -->

<!-- BEGIN:EVT-007 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"A − 7 ans","order":7,"refs":"GRAINE-001,GRAINE-002"} -->
<a id="evt-007"></a>
## Le réveil d’Elio

La capsule d’Elio s’est écrasée dans une zone inhabitée ou peu peuplée de Sélis ; une ville a grandi autour. Un détecteur de signature matérielle conduit Lyra à cette capsule, seule à livrer un survivant confirmé pour l’arc principal. Elle lit son prénom dans les données, le stabilise avec connaissances et matériel sous une couverture médicale masquée, lui transmet son nom et le lieu, puis invoque un accident et une amnésie comme couverture auprès des secours locaux. Elio conserve ses savoirs généraux et des intuitions gravitationnelles implicites. Lyra se retire, l’observe, puis est rappelée sur Orthe pour soigner les blessés d’affrontements contemporains. Nacre n’existe pas encore.
<!-- END:EVT-007 -->

<!-- BEGIN:EVT-008 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"A − 4 ans","order":8,"refs":"COUPLE-001"} -->
<a id="evt-008"></a>
## La rencontre professionnelle

De retour sur Sélis, Lyra se fait embaucher sous couverture dans l’environnement de travail d’Elio avec une mission d’approche et de compréhension. Elle possède les compétences nécessaires. Ils se rencontrent alors personnellement comme adultes, travaillent ensemble et deviennent amis. Les repères chiffrés exacts restent proposés.
<!-- END:EVT-008 -->

<!-- BEGIN:EVT-009 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"A − 2 ans","order":9,"refs":"COUPLE-001"} -->
<a id="evt-009"></a>
## Le couple

La relation devient réellement amoureuse sans que Lyra ait nécessairement désobéi à sa mission. Elle n’a toujours révélé ni son origine d’Orthe, ni sa nature Biotique, ni la découverte de la capsule, ni le but initial de sa présence. Ces moments peuvent nourrir les flashbacks.
<!-- END:EVT-009 -->

<!-- BEGIN:EVT-010 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"A-source","order":10,"refs":"TEMPS-001,TEMPS-002,TEMPS-003,COUPLE-001"} -->
<a id="evt-010"></a>
## L’expérience originale

Elio et Lyra testent dans le laboratoire de Sélis une technologie primitive de localisation spatio-temporelle extrêmement précise. Il n’y a pas d’attaque dans l’histoire-source. L’expérience enregistre une empreinte du lieu et de son état qui ne deviendra une ancre temporelle exploitable que bien plus tard. À cet instant, Elio aime Lyra mais ignore encore entièrement son origine d’Orthe, sa nature Biotique, la capsule et sa mission.
<!-- END:EVT-010 -->

<!-- BEGIN:EVT-011 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Après A-source, puis G","order":11,"refs":"NOYAU-002,COUPLE-002,COUPLE-003,VOYAGE-001"} -->
<a id="evt-011"></a>
## La révélation, la réconciliation et Orthe

Après A-source, Lyra révèle son origine, sa nature, la recherche de la capsule et sa mission. Elio se sent trompé et le couple cesse temporairement de se parler, puis se réconcilie. La durée et les scènes exactes restent à écrire. Après cette réconciliation, ils gagnent Orthe en vaisseau au point G ; Elio reste sain car le Bâillon n’est pas un champ permanent, tandis que quitter Orthe ne guérit pas Lyra. Les habitants reconnaissent son noyau intact et travaillent avec lui. Ses premiers travaux restent clandestins : des communautés l’apprécient sans que le Concordat ait encore identifié personnellement la source pure.

Sur Orthe après G, Elio-source apprend progressivement Spatial, discipline distincte de la Gravité qu’il maîtrisait avant la stase mais dont il a perdu la maîtrise consciente.
<!-- END:EVT-011 -->

<!-- BEGIN:EVT-023 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Après l’arrivée sur Orthe, avant la tournée","order":12,"refs":"COEUR-002"} -->
<a id="evt-023"></a>
## Le premier essai insuffisant

Elio-source tente une première restauration du Cœur après son arrivée sur Orthe. Il échoue parce qu’il ne peut pas fournir et distribuer assez de puissance simultanément. Il comprend qu’il faut davantage de Porteurs actifs, de relais, de capacités distribuées et de synchronisation ; cet échec provoque la tournée des six régions.
<!-- END:EVT-023 -->

<!-- BEGIN:EVT-012 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Après le premier essai","order":13,"refs":"IA-001,FRAGMENT-001,FRAGMENT-003,REG-001,REG-002"} -->
<a id="evt-012"></a>
## La tournée des six régions

Le couple aide les six régions, Elio réactive des Porteurs et détache progressivement un pétale dans chacune d’elles, soit six pétales seulement, installés dans les relais énergétiques. Chaque séparation laisse une empreinte locale privée, non un journal cumulatif. Il développe Nacre avec des ingénieurs d’Orthe, mais ne lui intègre encore aucun fragment. Les pétales, relais et alliés préparent une deuxième tentative ; l’ordre interne des régions et les moyens de discrétion restent à développer.
<!-- END:EVT-012 -->

<!-- BEGIN:EVT-013 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Après la mort de Lyra-source","order":15,"refs":"SEVERAN-001,SEVERAN-003,SEVERAN-004"} -->
<a id="evt-013"></a>
## Le marchandage et la collaboration

Après la mort de Lyra, Elio veut tuer Séveran mais n’en a pas la puissance. Séveran a besoin de le garder vivant avec son centre dans le corps, car l’extraction rendrait ce centre inerte. Il lui propose de combiner leurs technologies pour lui permettre de revoir Lyra ; Elio endeuillé accepte une coopération avec mobilité relative et séances de travail, qui interdit la confiscation ou la destruction des six pétales. Au fil des années, la pureté des amplificateurs progresse partiellement sans restaurer les centres ; Elio poursuit en secret Nacre, le temps et la téléportation. Le Concordat peut surveiller ou occuper les territoires des fragments sans les posséder.
<!-- END:EVT-013 -->

<!-- BEGIN:EVT-014 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Deuxième essai, avant la collaboration","order":14,"refs":"COUPLE-002,SEVERAN-003,COEUR-001"} -->
<a id="evt-014"></a>
## La perte de l’histoire-source

Après la tournée, Elio et ses alliés tentent une restauration plus importante du Cœur alors que les six pétales restent dans les relais régionaux. Malgré les Porteurs réactivés, le flux est instable et insuffisant avant l’attaque. Séveran détecte Elio, son centre pur et le rôle des pétales ; sa chasse commence. Il attaque et interrompt l’essai ; Lyra-source s’interpose et meurt des blessures de l’affrontement, non de la destruction de son noyau.
<!-- END:EVT-014 -->

<!-- BEGIN:EVT-015 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Après la collaboration, jusqu’à Z","order":16,"refs":"TEMPS-002,TEMPS-004,IA-002,SEVERAN-004"} -->
<a id="evt-015"></a>
## La rupture et l’essai préparé vers A

Elio quitte Séveran ; les tentatives de saisie des pétales s’intensifient sans confiscation confirmée. Vers la fin de sa vie, il développe avec Nacre des installations de téléportation à deux balises. Un voyage préparatoire ordinaire dépose celle de Sélis, puis Elio revient sur Orthe. Sa désertion définitive Orthe → Sélis constitue le premier vrai test. Il poursuit ses recherches pour revoir Lyra, comprend que l’empreinte primitive de A permet d’en retrouver l’instant et prépare une ouverture vers cette période. Nacre ne porte pas encore le septième pétale. Les autorisations et détails des derniers travaux restent ouverts.
<!-- END:EVT-015 -->

<!-- BEGIN:EVT-016 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Z = A + 14 ans, repère de travail","order":17,"refs":"SEVERAN-003,SEVERAN-004,IA-002,TEMPS-004"} -->
<a id="evt-016"></a>
## L’assaut contre le scientifique

À Z, Elio détache son septième pétale, l’intègre à Nacre pour amorcer le prototype et ouvre lui-même A. Il observe A sans y être visible. Séveran arrive pendant la fenêtre, aperçoit le jeune Elio vivant, frappe l’Elio-source mortellement, puis extrait son centre : celui-ci devient aussitôt inerte, les sept pétales dorment. Elio survit brièvement à l’extraction et donne alors son dernier ordre « évacue-moi vers Orthe » ; Nacre échoue à l’emporter avant sa mort. Séveran constate l’inertie et traverse A pour tenter de capturer le noyau jeune encore en place. Le budget temporel court depuis l’ouverture initiale.
<!-- END:EVT-016 -->

<!-- BEGIN:EVT-017 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"En Z, à l’intérieur de A-fenêtre","order":18,"refs":"IA-003,IA-004,TEMPS-005,SEVERAN-003"} -->
<a id="evt-017"></a>
## Le prologue joué

Séveran entre dans A-fenêtre. La routine active de Nacre détecte de l’autre côté une version vivante compatible d’Elio et adapte sa cible ; elle suit la faille, et son pétale se raccorde au jeune Elio du même côté. Lyra, privée de pouvoirs restaurés, blesse Séveran avec ses moyens ordinaires et reçoit une blessure gravissime. Elio la croit morte ; Nacre l’extrait pendant la diversion. Séveran, blessé et désorienté, constate la disparition de sa cible puis revient séparément en Z. La fenêtre n’est suspendue qu’après son retour ; Lyra demeure à l’intérieur, vivante mais en péril.
<!-- END:EVT-017 -->

<!-- BEGIN:EVT-018 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Z, début du parcours joué","order":19,"refs":"TEMPS-004,IA-005,SEVERAN-003"} -->
<a id="evt-018"></a>
## L’arrivée chez ceux qui le connaissent

Nacre et Elio repassent par le laboratoire au présent Z ; Elio entrevoit un corps indistinct sans le reconnaître et ne subit aucune nouvelle amnésie. Les six pétales d’Orthe se raccordent alors à son centre, avant que la routine ne termine son ordre par téléportation vers le Havre d’Orthe. Les habitants ont connu le scientifique et Lyra-source. Elio n’a pas vécu ces années et ignorait Orthe ainsi que la véritable identité de Lyra ; leur familiarité le trouble. La mort du scientifique n’est pas encore publiquement établie. Séveran ignore où sa cible a disparu, mais ses forces poursuivent leurs opérations.
<!-- END:EVT-018 -->

<!-- BEGIN:EVT-019 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Pendant les six arcs régionaux","order":20,"refs":"IA-004,FRAGMENT-001,FRAGMENT-003,ELIO-POUVOIRS-001,MECHA-001,REG-003,REG-004"} -->
<a id="evt-019"></a>
## La reprise de l’ancre

L’équipe traite les conflits propres aux six régions, remet en marche les relais tombés en panne, affronte des menaces impériales différenciées, négocie le retrait risqué de chaque pétale et prépare une transition sans supprimer tout coût. Aucun fragment n’est déjà possédé par le Concordat. Le héros apprend d’abord Énergie, reconstruit ensuite Spatial par indices et pratique, puis réapprend son ancienne Gravité après un témoignage antérieur à la stase. Il apprend séparément Mecha dans son berceau historique, les Chantiers de Cendre. Après plusieurs actions visibles, des rapports peuvent confirmer sa survie à Séveran et déclencher une traque ciblée ; le moment exact reste proposé.

Les six empreintes privées d’Elio montrent chacune un moment local de don, sans dérouler toute la biographie. L’équipe récupère aussi l’anneau original parmi les équipements impériaux saisis. Les archives datées et les soins acquis donnent un espoir conditionnel pour Lyra, pas une assurance de succès.
<!-- END:EVT-019 -->

<!-- BEGIN:EVT-020 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Après la sécurisation d’Orthe","order":22,"refs":"FIN-001,FIN-003,FIN-SEQUENCE-001,REVELATIONS-001"} -->
<a id="evt-020"></a>
## La dernière ouverture

Après la découverte du septième pétale, la vision privée d’Elio, les données partielles de Z, la découverte du corps et des mesures corroborées, le groupe dispose de paramètres vérifiés. Il retourne au laboratoire original de Sélis avec l’ancre physique, un appareil compatible, la puissance stable et autonome du Cœur et une équipe médicale. Elio reprend le même reliquat après la victoire collective. Il est trop tard pour éviter le coup ; une continuité viable permet l’extraction de Lyra. Les soins se poursuivent dans le présent, puis Lyra commence bien plus tard à transmettre Biotique au protagoniste.
<!-- END:EVT-020 -->

<!-- BEGIN:EVT-021 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Convergence au présent d’Orthe","order":21,"refs":"FIN-003,FIN-SEQUENCE-001,COEUR-001,COEUR-002,SEVERAN-002,IA-007"} -->
<a id="evt-021"></a>
## Les deux affrontements et le Cœur

La coalition affronte d’abord Séveran pour ouvrir et protéger l’accès au Cœur. Avec les six pétales physiquement rassemblés, le noyau entier d’Elio, les réserves et les Porteurs, elle approche du redémarrage ; l’apport compatible inexpliqué de Nacre complète la stabilisation. Le Cœur restaure alors les noyaux des alliés comme des ennemis. Un second grand affrontement aboutit à la neutralisation de Séveran sans imposer sa mort. Après sécurisation, l’analyse révèle le septième pétale ; Elio vit sa scène locale, les autres preuves établissent Z, puis le corps et le centre inerte sont retrouvés. Les mesures permettent le secours. La microchronologie des combats reste ouverte.
<!-- END:EVT-021 -->

<!-- BEGIN:EVT-022 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Après la dernière ouverture","order":23,"refs":"FIN-002,FIN-003,IA-006"} -->
<a id="evt-022"></a>
## Les routes ouvertes

Après le sauvetage, l’accès temporel dangereux et le corps ou composant qui le porte sont détruits. Après un transfert préparé et risqué, Nacre revient comme assistant sans pouvoir temporel. Le couple se retrouve sans effacer les épreuves ; les survivants réorganisent Orthe et renouent les routes vers les autres planètes, notamment pour rechercher des capsules et d’éventuelles sociétés descendantes dont aucun nombre ni destin n’est confirmé. Si Séveran survit maîtrisé, des échanges ou un chemin de rédemption restent possibles sans devenir acquis.
<!-- END:EVT-022 -->

# Régions et personnages

<!-- BEGIN:REG-001 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"region","views":"","period":"","order":0,"refs":"NOYAU-002,FRAGMENT-001,FRAGMENT-003,EVT-018"} -->
<a id="reg-001"></a>
## Havre des Traverses : accueil et confiance

Le Havre est un port de refuges et de routes suspendues. Les habitants doivent décider comment accueillir sans épuiser leurs ressources, tandis que le Concordat instrumentalise leurs peurs.

Yselle, responsable humaine des quais, organise la survie avant de croire au héros. Varek, ancien Porteur artisan, devient le premier partenaire d’un réaccord contrôlé. Le héros réussit en écoutant ses sensations, pas en traitant son noyau comme une pièce interchangeable.

Une évacuation et la protection d’un convoi fondent la coopération. Le Collecteur des Routes, automate impérial, menace les passages. Le quartier sauvé devient ensuite un soutien logistique réel.

Apport au fil rouge : le relais dormant laisse une panne locale que les habitants doivent diagnostiquer et redémarrer avec Elio, Nacre, énergie et maintenance. Ils expliquent pourquoi le premier essai d’Elio-source, avant la tournée, manquait de puissance distribuée, sans connaître le raid Z. Elio propose alors de rassembler un jour les pétales au Cœur ; il y croit sans pouvoir garantir le succès. Apport aux pouvoirs : démonstration limitée d’une activation saine grâce à Énergie, sans armée restaurée en une journée.

Le Havre entretient le premier des six pétales régionaux, sous une responsabilité locale dont le titulaire reste à fixer. Seul Elio peut ressentir son empreinte sensorielle locale autour du don ; elle ne révèle pas la suite. Le retirer menace les recharges et les routes protégées : l’équipe doit préparer une transition avec les habitants et obtenir leur accord, pas emporter une clé sans coût.
<!-- END:REG-001 -->

<!-- BEGIN:REG-002 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"region","views":"","period":"","order":0,"refs":"HIST-002,IA-005,IA-007,COUPLE-002,FRAGMENT-001,FRAGMENT-003"} -->
<a id="reg-002"></a>
## Palais de Sel : mémoire et responsabilité

Des archives minérales conservent les versions incompatibles d’une guerre. Des falsifications ont fait porter les responsabilités et les réparations aux mauvaises communautés.

Orsane, Porteuse archiviste, a parfois dissimulé la vérité pour éviter de nouveaux massacres. Elle découvre que ce silence permet à la violence de continuer. La solution nécessite des preuves, une protection des témoins et une divulgation responsable.

Le Scribe blanc, instrument de censure, reproduit des attaques enregistrées ; ses projections ne sont pas des personnes temporellement recréées. Certains index historiques de Nacre peuvent être réparés ici, sans rendre disponible un récit complet de Z ni lui permettre de lire les visions privées des pétales.

Un témoin reconnaît Lyra et raconte sa disparition dans l’histoire-source, à une date incompatible avec le prologue. Les documents montrent aussi la collaboration réelle du scientifique avec les institutions de Séveran. Les informations postérieures à la séparation des fragments proviennent d’archives datées et de témoins, jamais de souvenirs futurs apparus dans un pétale ancien.

Le fragment régional soutient la conservation et la lecture de certaines archives. Son retrait peut faire perdre des protections et des accès ; la garde locale doit participer au choix et à la continuité du service.
<!-- END:REG-002 -->

<!-- BEGIN:REG-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"NOYAU-003,IA-004,EVT-019,FRAGMENT-001,FRAGMENT-003"} -->
<a id="reg-003"></a>
## Chantiers de Cendre : berceau rebelle de Mecha

Après le Grand Bâillon, des ingénieurs, ouvriers, médecins et scientifiques des villes industrielles développent clandestinement une alternative au monopole des réactivations de Séveran. Les outils, prothèses et exosquelettes deviennent progressivement la discipline Mecha et soutiennent une résistance locale. Au présent, ces villes dépendent encore du Concordat pour l’eau, la chaleur et le travail ; détruire brutalement les installations libérerait les ouvriers en les privant de moyens de vivre.

Deme, ingénieure humaine, et Nohé, ancien régulateur Porteur, aident à créer des alimentations indépendantes. Les plans du scientifique expliquent autant les améliorations réelles que les dépendances actuelles.

Un premier combattant au réveil forcé montre le coût humain du programme impérial. L’objectif n’est pas toujours de le tuer ; sécuriser l’installation peut permettre une stabilisation partielle. Le protagoniste découvre et commence à apprendre Mecha auprès de cette culture. Le Géant de suie, plateforme de guerre intégrée à une centrale, reste un affrontement majeur proposé.

L’équipe récupère l’anneau témoin dans un transfert de matériel saisi. Cette opération est préparée par des inventaires et des renseignements, pas par un objet trouvé par hasard dans le butin d’un boss. L’anneau est ensuite protégé dans une installation alliée.

Le fragment régional participe aux alimentations que les ouvriers ne peuvent perdre du jour au lendemain. Le rassembler pour le Cœur exige des réserves, des relais et un accord local ; aucune solution parfaite n’efface le risque d’une contre-attaque ou d’une pénurie.
<!-- END:REG-003 -->

<!-- BEGIN:REG-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"COUPLE-002,FIN-001,FIN-004,IA-005,FRAGMENT-001,FRAGMENT-003"} -->
<a id="reg-004"></a>
## Jardins du Seuil : soin, deuil et chance limitée

Les Jardins mêlent centres de soins et mémoriaux. Les ressources destinées aux anciens Porteurs entrent en concurrence avec les besoins des humains ordinaires.

Miren, soignant humain, conteste les priorités héritées. Éloa, Porteuse spécialiste de stabilisation biologique, distingue un noyau encore viable d’une personne définitivement perdue. Le Cerf de verre, gardien malade, peut faire l’objet d’une victoire par stabilisation plutôt que destruction.

La tombe et les témoins établissent la mort de Lyra de l’histoire-source. Ce n’est pas la tombe d’Elio-source, dont le corps demeure encore caché. L’analyse de l’anneau retrouvé prouve la conservation d’un reliquat ; une survie reste envisageable, mais le diagnostic à distance ne permet pas de la garantir.

Elio refuse de priver les soins civils de leurs moyens pour accélérer sa tentative personnelle. Il choisit les autres avant d’avoir la certitude que cette décision lui rendra Lyra. L’équipe élabore une extraction médicalisée différente du secours de Nacre au prologue.

Le fragment régional alimente une partie des stabilisations biologiques. Son retrait compromettrait des patients et ne devient acceptable qu’avec une capacité de transition limitée, coûteuse et collectivement décidée.
<!-- END:REG-004 -->

<!-- BEGIN:REG-005 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"GRAINE-002,COUPLE-001,COUPLE-003,REDEMPTION-001,REDEMPTION-002,FRAGMENT-001,FRAGMENT-003"} -->
<a id="reg-005"></a>
## Villes du Contrejour : identité et responsabilité

Une région de registres, de masques civils et de tribunaux protège des persécutés mais peut aussi dissimuler des auteurs de violences. Le Concordat utilise le visage d’Elio pour lui attribuer les actes de sa version-source.

Léandre, enquêteur humain, distingue filiation d’une histoire et culpabilité personnelle. L’enquête expose les capsules, le réveil adulte, les réseaux d’accueil et la couverture de Lyra. Un témoin très ancien ayant connu Elio avant sa stase révèle sa maîtrise première de Gravité, distincte du Spatial appris après G ; Elio doit encore la réapprendre. Des lettres et des témoins établissent une amitié réelle, sans excuser le secret.

Saren est confronté aux conséquences des réveils forcés. Une stabilisation possible ne suffit pas à faire de lui un allié : sa coopération dépend d’un choix et d’actes de réparation.

Le masque qui imite les habitudes du héros est un dispositif prédictif utilisant des données, pas un nouveau double temporel. L’arc doit éviter de répondre à toute question d’identité par une multiplication de versions.

Le fragment régional est placé sous une responsabilité contestée entre protection des personnes et contrôle des registres. Sa réunion au Cœur exige une décision publique et des garanties contre les représailles du Concordat.
<!-- END:REG-005 -->

<!-- BEGIN:REG-006 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"SEVERAN-002,FIN-002,FRAGMENT-001,FRAGMENT-003,CONCORDAT-PETALES-001,REG-007"} -->
<a id="reg-006"></a>
## Couronne des Marées : avenir partagé

Les routes de l’archipel sont instables. Séveran promet une circulation parfaitement sûre à condition que personne ne puisse utiliser un passage sans son autorisation.

Thyr, navigateur Porteur, connaît les risques mais refuse de confondre sécurité et souveraineté absolue. Les équipes construisent un réseau où les décisions et les compétences peuvent se relayer.

Des plans impériaux révèlent la Matrice de tutelle proposée et le besoin d’Elio vivant, avec son centre encore en place ; l’organe extrait serait inerte. Des preuves partielles éclairent les recherches d’Elio-source sans dévoiler l’assassinat de Z, la présence du septième pétale ni la routine complète de secours. La coalition prépare le démantèlement militaire et formule encore des hypothèses sur l’ancre.

Le sixième fragment régional soutient les passages de l’archipel. Le retirer expose les routes à une attaque au moment même où la coalition doit converger ; les équipages et sa garde locale organisent donc le risque au lieu de le nier.
<!-- END:REG-006 -->

<!-- BEGIN:REG-007 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"GEOGRAPHIE-001,COEUR-003,POLITIQUE-001,TEMPS-004,FIN-SEQUENCE-001"} -->
<a id="reg-007"></a>
## Méridien et région-capitale : le Cœur monumental

La région-capitale constitue le septième ensemble géographique d’Orthe, distinct des six régions de collecte et de la Couronne des Marées. Le nom Méridien reste proposé. La ville s’est développée autour du Cœur monumental visible ; ses ramifications et installations souterraines en font un enjeu politique et technique central pour Séveran.

Des institutions anciennes y subsistent sous tutelle et la population ne forme pas un bloc uniforme. La coalition doit y empêcher la captation du Cœur, protéger son redémarrage puis affronter une seconde fois les forces dont les noyaux naturels viennent aussi d’être restaurés. Aucun pétale régional supplémentaire n’y est collecté : le septième reste caché dans Nacre jusqu’après la sécurisation.

L’intrusion dans A est ouverte depuis le laboratoire de Sélis, pas depuis la capitale. L’Aiguilleur proposé peut contrôler positions et forces physiques sans agir sur le temps extérieur à une fenêtre.
<!-- END:REG-007 -->

<!-- BEGIN:PERS-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"distribution","views":"","period":"","order":0,"refs":"NOMS-001,GACHA-001,GACHA-002,MECHA-001,REDEMPTION-001,REDEMPTION-002,POUVOIR-001"} -->
<a id="pers-001"></a>
## Distribution provisoire et accès au jeu

La distribution de la v1.0 reste une réserve de personnages à approfondir. Les rangs et rôles de combat ci-dessous ne fixent ni la dignité ni la catégorie cosmologique d’un Porteur. Les humains ordinaires, y compris des descendants mixtes sans noyau, peuvent devenir jouables grâce à Mecha sans recevoir de noyau divin ; cette technologie est née aux Chantiers de Cendre et peut être utilisée dans plusieurs camps, mais l’équipement précis de chaque personnage n’est pas décidé ici.

| Personnage | Situation | Place proposée |
|---|---|---|
| Yselle | Humaine, responsable du Havre. | 4 étoiles ; recrutement scénaristique initial. |
| Varek | Porteur artisan déchu. | 4 étoiles ; première activation saine. |
| Orsane | Porteuse archiviste. | 5 étoiles ; pacte après l’arc des archives. |
| Deme | Humaine, ingénieure des Chantiers. | 4 étoiles ; expertise matérielle essentielle. |
| Nohé | Porteur régulateur, ancien compromis avec le régime. | 5 étoiles ; réparation et responsabilité. |
| Miren | Humain, soignant. | 4 étoiles ; accès aux soins sans privilège d’origine. |
| Éloa | Porteuse, spécialiste de stabilisation. | 5 étoiles ; diagnostic et équipe de sauvetage. |
| Léandre | Humain, enquêteur. | 4 étoiles ; identité distincte de culpabilité. |
| Saren | Porteur, commandant du Concordat, réveil forcé. | 5 étoiles possible après soin, rupture et coopération. |
| Thyr | Porteur, navigateur. | 5 étoiles ; routes et choix collectifs. |
| Lyra, dans le point de vue Elio | Porteuse et scientifique, partenaire du prologue. | 5 étoiles gratuit par l’histoire, proposition conservée. |

Nacre demeure un compagnon autonome et un personnage central du récit. Sa présence ne dépend pas du gacha. Un humain rendu disponible dans la collection suit le parcours de rencontre, coopération puis synchronisation Mecha N1 ; tous les humains du récit ne deviennent pas automatiquement combattants. Des ex-adversaires peuvent conserver des désaccords politiques une fois alliés, et des alliés peuvent changer de camp : la rédemption ou la rupture dépendent de choix, pas d’un niveau de charge.

Séveran n’est pas recruté automatiquement après le final. Une survie, des échanges, un parcours de réparation puis une éventuelle jouabilité restent une possibilité d’arc ultérieur soumise aux mêmes exigences de rencontre et de coopération crédible.
<!-- END:PERS-001 -->

# Campagne

<!-- BEGIN:CH-00 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 0","order":0,"refs":"IA-003,IA-004,TEMPS-002,TEMPS-005,COUPLE-001"} -->
<a id="ch-00"></a>
## Une place à côté de toi

Le couple travaille sur une expérience de localisation extrêmement précise encore présentée comme non temporelle. Ils sont amoureux et complices. Elio ignore l’existence d’Orthe, l’origine Biotique de Lyra, la capsule et sa mission. Depuis Z, Elio-source a déjà ouvert A et observe sans être visible. Séveran traverse ensuite et interrompt la scène ; Lyra le blesse sans pouvoirs restaurés, s’interpose, reçoit une blessure gravissime et Elio la voit tomber. Nacre profite de la diversion pour le ramener par la faille. Le point de vue du héros ne montre pas encore le retour ultérieur de Séveran.

Mise en scène et garde-fous : Montrer l’anneau, une défense issue d’un équipement et la blessure sans certifier médicalement une mort. Préparer la géographie de la scène pour que le sauvetage ne dépende pas d’un adversaire aveugle.
<!-- END:CH-00 -->

<!-- BEGIN:CH-01 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 1","order":1,"refs":"EVT-018,REG-001,IA-005"} -->
<a id="ch-01"></a>
## Ceux qui prononcent ton nom

Elio arrive au Havre sur une planète dont il ignorait l’existence. Certains habitants reconnaissent son visage, celui de Lyra et leur histoire ; d’autres doutent devant son manque d’expérience. Cette familiarité avec le passé réel de sa partenaire le perturbe profondément. Nacre établit le décalage d’époque et dit avoir été créée par le scientifique connu ici. Séveran n’engage pas encore de traque personnelle : il ignore si Elio a survécu, où il a disparu et par quel moyen.

Mise en scène et garde-fous : Le mystère porte sur ce que cet autre Elio a fait, pas sur une date que tout le monde pourrait donner. Sa mort n’est pas encore prouvée aux habitants.
<!-- END:CH-01 -->

<!-- BEGIN:CH-02 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 2","order":2,"refs":"REG-001,NOYAU-002,NOYAU-005,GACHA-001,ELIO-POUVOIRS-001"} -->
<a id="ch-02"></a>
## Le prix d’un refuge

Le héros et les habitants constatent une panne du relais lié à la dormance passée du pétale ; ils le réparent et le redémarrent avant d’en tirer une recharge stable. Le héros protège une évacuation et réalise avec Varek le premier rituel de réactivation consciente. Il apprend parallèlement à maîtriser Énergie, premier pouvoir actif de sa continuité jouée et suffisant pour ce réaccord. Les habitants expliquent l’insuffisance distribuée du premier essai historique sans connaître Z ; Elio avance l’hypothèse de réunir les pétales au Cœur, sans certitude. Yselle accorde sa confiance à des actes concrets ; une première équipe se forme sans imposer de tirage rare.

Mise en scène et garde-fous : Montrer le consentement et le rôle indispensable du bénéficiaire. La victoire permet de mieux vivre au Havre, pas seulement d’obtenir une clé de scénario.
<!-- END:CH-02 -->

<!-- BEGIN:CH-03 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 3","order":3,"refs":"REG-002,COUPLE-002,FRAGMENT-003"} -->
<a id="ch-03"></a>
## Les absents ont une voix

Aux Palais de Sel, les récits d’une guerre se contredisent. Le deuxième pétale fait vivre au seul Elio une scène sensorielle locale autour de son don, sans livrer une mémoire cumulative ou postérieure. Un témoin reconnaît Lyra et rapporte sa mort lors de l’attaque de Séveran contre le deuxième essai du Cœur, après A-source. Les dates incompatibles troublent Elio.

Mise en scène et garde-fous : Ne pas faire taire un témoin qui connaît son origine. Les détails de la mission et les preuves de la mort-source restent réellement à trouver.
<!-- END:CH-03 -->

<!-- BEGIN:CH-04 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 4","order":4,"refs":"REG-002,IA-005,EVT-013"} -->
<a id="ch-04"></a>
## La dette des archives

Orsane et l’équipe protègent des témoins avant de dévoiler des falsifications. Nacre récupère des moyens de lecture et l’équipe négocie le deuxième fragment. Les contrats établissent que le scientifique a collaboré avec Séveran après la mort de Lyra, dans l’espoir de la revoir.

Mise en scène et garde-fous : Un rapport sur les équipements saisis prépare la piste de l’anneau. La bonne réputation du scientifique demeure vraie sur certains aspects.
<!-- END:CH-04 -->

<!-- BEGIN:CH-05 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 5","order":5,"refs":"REG-003,NOYAU-003"} -->
<a id="ch-05"></a>
## Les mains libres

Aux Chantiers, une opération de résistance héritière des premiers développements Mecha menace l’alimentation des quartiers. Un combattant réactivé par le Concordat révèle une puissance impressionnante et un état instable.

Mise en scène et garde-fous : Le premier diagnostic sépare volonté, contrainte politique et dégradation du noyau. Couper l’empire sans préparer une solution tuerait des habitants.
<!-- END:CH-05 -->

<!-- BEGIN:CH-06 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 6","order":6,"refs":"REG-003,EVT-019,REDEMPTION-001,ELIO-POUVOIRS-001"} -->
<a id="ch-06"></a>
## Ce qu’on ne rachète pas

Des alimentations indépendantes rendent possible une libération locale et le retrait risqué du troisième pétale. Des indices privés et la pratique aident Elio à reconstruire Spatial, discipline apprise par sa version-source après G ; la culture rebelle des Chantiers lui ouvre séparément Mecha. Une opération documentée récupère l’anneau original. Une stabilisation d’urgence d’un adversaire démontre qu’une autre réponse est envisageable.

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

La tentative médicale devient concevable, mais une accélération ou le retrait immédiat du quatrième fragment priverait les soins de moyens essentiels. Elio la refuse sans garantie d’une autre réussite. L’équipe construit un protocole de transition soutenable.

Mise en scène et garde-fous : Ne pas certifier la survie de Lyra à distance. Donner un espoir mesurable, des limites et un enjeu moral réel.
<!-- END:CH-08 -->

<!-- BEGIN:CH-09 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 9","order":9,"refs":"REG-005,GRAINE-002,HIST-003,ELIO-POUVOIRS-001"} -->
<a id="ch-09"></a>
## Le visage dans la vitre

Au Contrejour, la propagande lui attribue les actes de l’autre Elio. L’enquête retrouve les traces des capsules, du réveil et des humains qui l’ont aidé à s’intégrer. Elle confirme la perte de sa mémoire autobiographique, la conservation de ses savoirs généraux et ses intuitions gravitationnelles implicites. Un très ancien habitant ayant connu Elio avant sa stase révèle sa maîtrise originelle de Gravité ; il doit la réapprendre consciemment par pratique, et non par vision instantanée.

Mise en scène et garde-fous : Les trous de mémoire de stase sont corroborés, pas comblés d’un seul coup par une révélation magique. L’exception de son noyau a une cause matérielle.
<!-- END:CH-09 -->

<!-- BEGIN:CH-10 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 10","order":10,"refs":"NOMS-001,COUPLE-001,COUPLE-003,REDEMPTION-001,REDEMPTION-002"} -->
<a id="ch-10"></a>
## La vérité qui n’a pas eu lieu

Le parcours de Lyra apparaît progressivement : volontariat, découverte et réveil d’Elio, rappel sur Orthe pour soigner les blessés, retour sous couverture, amitié puis amour réel. Des archives de l’histoire-source montrent ensuite la révélation postérieure à A, la crise du couple et sa réconciliation avant G — une conversation que l’Elio joué n’a jamais vécue. Saren stabilisé doit choisir ce qu’il fait des informations sur le programme qui l’a abîmé ; la décision locale autour du cinquième fragment accompagne ce choix.

Mise en scène et garde-fous : Les flashbacks montrent des moments adultes réels et ne livrent pas toute la mission d’un seul coup. Dans le point de vue Lyra, Elio partenaire porte le secret et tous les rôles s’inversent.
<!-- END:CH-10 -->

<!-- BEGIN:CH-11 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 11","order":11,"refs":"REG-006,FIN-002"} -->
<a id="ch-11"></a>
## Un demain sans garanties

À la Couronne, les régions préparent une circulation partagée et le retrait défendu du sixième fragment. Thyr et ses équipages protègent les routes pendant que les six apports convergent sans dépendre d’un maître unique.

Mise en scène et garde-fous : Les relais énergétiques construits soutiennent l’autonomie d’Orthe mais ne téléportent personne. Les installations interplanétaires tardives et l’appareil temporel sont des systèmes séparés utiles au futur sauvetage. Pas d’arrêt du temps cosmique pour faciliter une scène.
<!-- END:CH-11 -->

<!-- BEGIN:CH-12 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 12","order":12,"refs":"SEVERAN-002,SEVERAN-003,SEVERAN-004,CONCORDAT-PETALES-001,REVELATIONS-001"} -->
<a id="ch-12"></a>
## Le projet derrière la tutelle

Les archives et installations dévoilent le projet de Séveran : l’usage prévu d’Elio vivant avec son centre pur en place, la Matrice de tutelle proposée, la chasse aux pétales après le deuxième essai et les recherches conduites avec Elio-source. Elles établissent l’accord de non-confiscation pendant la collaboration, les pressions exercées sur les relais puis les tentatives de saisie après la rupture. Des preuves partielles indiquent qu’Elio préparait un accès vers A et qu’un drame s’est produit à Z, sans encore montrer son dernier pétale, son assassinat ni le changement de cible de Nacre.

Mise en scène et garde-fous : Révéler l’usage du noyau, les responsabilités et les objectifs, pas le mécanisme complet du secours. La réparation tardive du scientifique n’efface pas les victimes de ses compromis. Les soupçons sur Z restent des soupçons jusqu’après le redémarrage.
<!-- END:CH-12 -->

<!-- BEGIN:CH-13 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 13","order":13,"refs":"FIN-002,FIN-SEQUENCE-001,REDEMPTION-001,GACHA-001,ELIO-POUVOIRS-001,MECHA-001,REG-007"} -->
<a id="ch-13"></a>
## L’empire à hauteur d’homme

Après consentement et transitions imparfaites dans chaque région, la coalition rapporte physiquement les six pétales connus au Cœur. Elle réunit aussi le centre vivant et les sept pétales du jeune Elio, Nacre, les réserves et les alliés sans exiger la possession gacha de tous les gardiens. Elle protège les populations, prépare le redémarrage du Cœur monumental et garde l’anneau sous protection pour l’étape suivante. Le plan prévoit un premier affrontement pour empêcher la captation du Cœur et maintenir l’accès pendant l’opération. Saren peut agir pour réparer ses fautes.

Mise en scène et garde-fous : Distinguer prendre une infrastructure et obtenir l’obéissance d’une région. Le groupe raisonne avec six fragments connus et ne connaît pas encore celui de Nacre. Tous les moyens indispensables sont accessibles par le récit.
<!-- END:CH-13 -->

<!-- BEGIN:CH-14 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 14","order":14,"refs":"SEVERAN-002,SEVERAN-005,FIN-003,FIN-SEQUENCE-001,COEUR-001,IA-007,REG-007"} -->
<a id="ch-14"></a>
## Le droit de ne pas recommencer

Dans une sous-structure encore adaptable, la coalition affronte d’abord Séveran et son dispositif afin de protéger l’accès au Cœur. L’effort des six fragments connus, d’Elio et des alliés approche de la réussite ; la contribution volontaire mais inexpliquée de Nacre complète la stabilisation. Le Cœur restaure sans préférence les noyaux alliés et ennemis. Un second grand affrontement oppose alors la coalition à Séveran et aux forces restées fidèles, puis les maîtrise et neutralise leur projet de tutelle sans imposer la mort de Séveran.

Mise en scène et garde-fous : La victoire doit protéger les fonctions vitales et les victimes des réveils forcés. Les ennemis bénéficient réellement de la restauration ; la coalition gagne grâce à ses alliances, compétences et préparatifs. La contention entre les affrontements reste à concevoir. L’ennemi n’est pas vaincu dans un passé qui annulerait son propre raid.
<!-- END:CH-14 -->

<!-- BEGIN:CH-15 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 15","order":15,"refs":"FIN-001,FIN-004,TEMPS-003,IA-004,IA-005,IA-006,IA-007,FIN-003,REVELATIONS-001"} -->
<a id="ch-15"></a>
## La dernière fenêtre

Après la sécurisation, l’équipe analyse la contribution de Nacre. La résonance révèle son septième pétale ; seul Elio éprouve la scène locale de son don et de l’amorçage à Z. Les journaux partiels, témoins et autres preuves établissent l’attaque, l’extraction, la mort et le changement de cible. Le groupe découvre physiquement, après ces révélations, le corps d’Elio-source et son centre inerte conservés post-mortem. Des mesures de l’ancre et des données corroborées donnent les paramètres manquants. L’équipe revient au laboratoire original de Sélis avec l’ancre physique, un appareil compatible, la puissance autonome du Cœur et une équipe médicale. La même fenêtre reprend après le retour de Séveran : Elio ne peut plus empêcher l’agression, mais un examen direct révèle une continuité vitale ; l’équipe stabilise Lyra, l’extrait et poursuit ses soins.

Mise en scène et garde-fous : La révélation doit précéder le secours qui dépend de ses informations. Montrer la différence entre « trop tard pour éviter la blessure » et « trop tard pour sauver ». L’anneau est consommé ; personne ne revient au début de la scène.
<!-- END:CH-15 -->

<!-- BEGIN:CH-16 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 16","order":16,"refs":"GRAINE-002,COUPLE-001,FIN-001,IA-005,IA-006,IA-007,ELIO-POUVOIRS-001"} -->
<a id="ch-16"></a>
## Ceux qui restent

Après le sauvetage, Lyra commence une convalescence réelle. Nacre consent au renoncement temporel : son composant dangereux est détruit et un transfert préparé tente de préserver son identité et ses souvenirs dans un assistant sans pouvoir temporel. Le sort matériel du pétale pendant ce transfert reste à préciser. Le couple affronte les secrets et décide de la suite. L’apprentissage Biotique ne commence que plus tard, après des soins et du temps de récupération ; il n’est pas un prérequis de la destruction de l’accès.

Mise en scène et garde-fous : Ne pas annoncer une mort absolument définitive de Nacre avant son transfert. Remplacer la famille adoptive de la v1.0 par les amis, mentors et collègues réellement définis dans cette version. Aucune guérison instantanée ne gomme les conséquences.
<!-- END:CH-16 -->

<!-- BEGIN:CH-17 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 17","order":17,"refs":"FIN-002,GRAINE-001,ELIO-POUVOIRS-001"} -->
<a id="ch-17"></a>
## Les routes ouvertes

Nacre revient comme assistant ordinaire, sans technologie temporelle. Les passages s’ouvrent, la recherche se partage et les régions continuent de vivre avec leurs désaccords. Le groupe peut voyager vers d’autres planètes du même univers, rechercher des capsules et rencontrer d’éventuelles sociétés descendantes dont aucun destin collectif n’a été confirmé. Les questions sur les divinités et les autres mondes restent ouvertes. Si Séveran survit maîtrisé, de futurs échanges ou un chemin de rédemption restent une possibilité, jamais un pardon ou un recrutement garantis.

Mise en scène et garde-fous : Les occupants éventuels ne forment pas une réserve uniforme d’alliés ; ils peuvent avoir connu des destins très différents. Le post-game n’introduit pas d’ancre de remplacement permettant de refaire toute perte.
<!-- END:CH-17 -->

<!-- BEGIN:PRODUCTION-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"gestion","views":"","period":"","order":0,"refs":"CADRE-001,REVELATIONS-001"} -->
<a id="production-001"></a>
## Ordre de travail après la consolidation

La phase suivante respecte cet ordre : consolider la présente bible et en vérifier la cohérence ; ne construire une chronologie visuelle complète que lorsque l’auteur aura précisé son format ; discuter ensuite la forme visuelle et jouable du futur jeu, ses modes d’exploration, de combat et son rythme ; développer alors le scénario période par période, notamment la première tournée d’Elio-source ; enfin seulement écrire chapitres, scènes, dialogues et besoins en assets. Les chapitres présents sont un squelette provisoire de cohérence, pas un scénario détaillé validé.

Cette version ne choisit ni caméra, ni moteur, ni monde ouvert, ni temps réel, ni tour par tour. Le laboratoire GachaImpact ne fixe pas automatiquement le format du futur jeu original.
<!-- END:PRODUCTION-001 -->

# Audits

<!-- BEGIN:AUDIT-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"audit","views":"","period":"","order":0,"refs":"TEMPS-001,TEMPS-003,IA-004,IA-007,FIN-001,FIN-003,FIN-SEQUENCE-001,REVELATIONS-001,ELIO-POUVOIRS-001"} -->
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
| Pourquoi ne pas tirer des personnages depuis le temps ? | Le premier pull réactive un noyau présent après rencontre et coopération ; il n’utilise pas les fenêtres. |
| Spatial permet-il à Elio de voyager naturellement dans le temps ? | Non. Sa maîtrise Spatial acquise après G aide sa recherche, mais la fenêtre exige une invention collective, une machine et une ancre. |
| L’expérience de A est-elle déjà une machine temporelle ? | Non. Elle produit une empreinte de localisation extrêmement précise dont la dimension temporelle ne sera comprise et exploitée que bien plus tard. |
| Pourquoi l’Elio joué ignore-t-il Orthe et la mission de Lyra ? | A-source précède sa révélation. A-fenêtre diverge avant cette conversation future, puis Nacre extrait le protagoniste. |
| Pourquoi le groupe ne sauve-t-il pas Lyra dès la récupération de l’anneau ? | L’ancre seule ne suffit pas : les paramètres de Z et du secours sont encore verrouillés, la puissance stable et les moyens médicaux complets ne sont pas réunis. |
| Le Cœur recrée-t-il ou recharge-t-il l’ancre ? | Non. Il alimente l’opération finale, mais l’ancre physique unique reste partiellement consommée et ne récupère aucun instant. |
| Où se déroule le sauvetage final ? | Au laboratoire original de Sélis, avec la même ancre physique ; le Cœur restauré fournit une énergie stable à distance et reste autonome lorsque le jeune Elio passe en A. |
| Le corps aperçu à Z révèle-t-il déjà la mort du scientifique ? | Non. L’Elio joué l’aperçoit indistinctement, sans le reconnaître ni souffrir d’une nouvelle amnésie ; l’identification physique arrive après les deux affrontements et la révélation de Z. |
| Pourquoi ne pas relancer la fenêtre avant l’attaque ? | L’accès reprend le reliquat suspendu après la sortie de Séveran, non l’instant A-source ni le début de A-fenêtre ; aucun nouveau chronomètre ou nouvelle ancre n’est créé. |
| Pourquoi la défaite de Séveran ne supprime-t-elle pas l’aventure ? | Elle survient au présent après son raid, sans réécriture rétroactive. |
| Pourquoi ne pas suspendre un adversaire partout ailleurs ? | La suspension ne concerne que le reliquat de l’enceinte liée à l’ancre. |

Ces réponses sont des règles de fiction choisies, pas une démonstration scientifique. Elles règlent les contradictions recensées ici sans garantir que toute scène future sera automatiquement cohérente.
<!-- END:AUDIT-001 -->

<!-- BEGIN:AUDIT-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"audit","views":"","period":"","order":0,"refs":"HIST-003,HIST-004,SEVERAN-002,SEVERAN-003,SEVERAN-004,CONCORDAT-PETALES-001,IA-002,IA-003,IA-004,IA-006,IA-007,FRAGMENT-001,FRAGMENT-002,COEUR-001,COEUR-002,FIN-SEQUENCE-001"} -->
<a id="audit-002"></a>
## Audit des motivations et des moyens

Le noyau doit avoir une utilité précise, chaque secours doit avoir des moyens concrets et aucun personnage ne doit oublier une solution évidente uniquement pour prolonger l’intrigue.

| Objection | Réponse ou point de vigilance |
|---|---|
| Séveran voulait-il désactiver tous les noyaux ? | Non. L’inhibiteur visait la distribution ciblée ; son activation prématurée et le coup porté au dispositif par la résistance provoquent le Bâillon hors du plan exact. |
| Pourquoi sa faction domine-t-elle après une catastrophe qui la touche aussi ? | Elle possède déjà des amplificateurs personnels testés avant la catastrophe. Partiels et corrupteurs, ils lui donnent néanmoins un avantage militaire immédiat. |
| Pourquoi tous ses officiers ne dominent-ils pas déjà Orthe ? | Les réveils forcés restent rares, instables, coûteux et exigeants en maintenance. |
| Pourquoi le noyau intact change-t-il la situation ? | Il peut stabiliser les réveils sélectionnés via la Matrice au lieu de forcer des noyaux sans référence saine. |
| Pourquoi ne pas utiliser une archive du noyau ? | Elle ne reproduit pas les réponses vivantes nécessaires aux corrections successives. |
| Pourquoi ne pas extraire l’organe avant Z ? | L’extraction le rend immédiatement et irréversiblement inerte. Séveran a besoin d’Elio vivant avec centre en place et profite de sa collaboration. |
| Le Concordat possède-t-il déjà les six pétales pendant la collaboration ? | Non. L’accord en interdit confiscation et destruction. Surveillance ou occupation ne valent pas possession ; après la rupture, seules des tentatives renforcées sont confirmées. |
| Pourquoi tuer le scientifique au lieu de le capturer ? | Le raid dégénère : Séveran porte un coup mortel avant d’extraire le centre, puis constate son inertie. Il vise alors l’Elio jeune vivant ; l’extraction seule n’a pas tué l’adulte. |
| Pourquoi le retour temporel n’efface-t-il pas ses erreurs ? | Le prototype n’a jamais atteint l’ambition de réécriture de son créateur. |
| Pourquoi Nacre ne peut-elle pas sauver deux personnes ? | Secours calibré pour un noyau sain, énergie limitée et absence de stabilisation médicale du partenaire blessé. |
| Pourquoi Nacre suit-elle Séveran dans A ? | Sa cible initiale vient de mourir, sa routine d’évacuation reste active et la faille révèle soudain une version vivante compatible d’Elio. Elle adapte sa cible sans avoir prévu cette continuation. |
| Comment la fenêtre reste-t-elle ouverte malgré la dormance des pétales ? | Elio-source l’a amorcée avec Nacre et ouverte avant l’attaque ; le reliquat limité tient temporairement sans raccord continu. Son budget commence dès cette ouverture. |
| Pourquoi les six relais reprennent-ils alors que le jeune Elio est encore sur Sélis ? | À son retour en Z, ils sont du même côté temporel et de même signature ; leur lien se rétablit avant la téléportation vers Orthe. La remise en marche des infrastructures reste locale et manuelle. |
| Pourquoi Nacre ne révèle-t-elle pas tout Z au réveil ? | Les changements de raccord du pétale ont surtout abîmé ses index historiques ; sa personnalité et sa mémoire nouvelle subsistent, mais aucun journal complet lisible n’est caché. |
| Le septième pétale peut-il raconter l’assassinat ? | Non. Elio seul éprouve une scène locale d’amorçage antérieure au raid ; capteurs, témoins, corps et mesures doivent établir le reste. |
| Pourquoi Nacre permet-elle le redémarrage sans être une batterie infinie ? | Tous les alliés approchent de la réussite ; son raccordement complète de façon exceptionnellement compatible la résonance des six fragments. |
| Pourquoi faut-il encore combattre après le redémarrage ? | Le Cœur restaure aussi les noyaux ennemis. La coalition doit neutraliser Séveran et ses forces lors d’un second affrontement. |
| Séveran sait-il si le jeune Elio est mort ? | Non. Il ne voit pas l’extraction et reste sans preuve de mort, de survie ou de destination. |
| Pourquoi garde-t-il un anneau apparemment en panne ? | C’est un vestige de recherche irremplaçable. Son mode dormant n’est pas exploitable avec ses seules commandes. La coalition le récupère ensuite. |
| Pourquoi ne capture-t-il pas immédiatement Elio sur Orthe ? | Il ignore sa destination et ne possède aucune piste personnelle certaine ; ses forces poursuivent néanmoins leurs opérations et peuvent ensuite découvrir des indices. |
| Pourquoi ne gagne-t-il pas aussitôt avec le noyau extrait ? | Ce centre est inerte et inutilisable, malgré les essais post-mortem. La Matrice aurait exigé un Elio vivant, des installations, du temps et des sujets compatibles. |
| Pourquoi Elio inépuisable ne redémarre-t-il pas seul le Cœur ? | Sa production durable ne supprime ni débit maximal, ni fatigue et lésions, ni limites du stockage, ni synchronisation distribuée. |
| Pourquoi retirer les fragments est-il un choix ? | Chaque région perd temporairement une recharge ou une fonction et s’expose à une attaque ; les transitions réduisent le risque sans l’annuler. |
| L’extraction détruit-elle Nacre et les relais ? | Non, mais les sept pétales deviennent dormants sans centre vivant de même signature et du même côté temporel. Ils se raccordent au jeune Elio selon son déplacement ; les relais locaux exigent ensuite énergie et redémarrage manuel. |

La perte du scientifique, le mode de conservation et le vol de l’anneau restent les trois scènes techniques à storyboarder en priorité. Elles ne doivent pas dépendre d’une incapacité arbitraire des antagonistes.
<!-- END:AUDIT-002 -->

<!-- BEGIN:AUDIT-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"audit","views":"","period":"","order":0,"refs":"NOMS-001,GRAINE-002,REDEMPTION-001,SEVERAN-005,GACHA-001,GACHA-002,GACHA-003,POUVOIR-001,ELIO-POUVOIRS-001,MECHA-001,HEREDITE-001,HEREDITE-002,ETATS-NOYAU-001,FIN-001"} -->
<a id="audit-003"></a>
## Audit des personnages, de la rédemption et du gacha

Les règles de recrutement et les règles de soin ne doivent pas se contredire : une personne ne devient pas aimable parce qu’elle a été « réparée », et un tirage ne décide pas qui mérite de vivre.

| Risque | Garde-fou |
|---|---|
| Le héros possède les personnes qu’il réactive. | La réactivation ne remplace ni consentement ni choix politique ; son bénéficiaire peut refuser une alliance. |
| La corruption rend les ennemis moralement mauvais. | Distinguer pathologie, contrainte, convictions et actes choisis. |
| Le soin absout un ancien bourreau. | Les victimes, la justice et les réparations restent nécessaires. |
| Un personnage rencontré comme ennemi entre immédiatement dans le gacha. | Il faut un pacte de coopération après son parcours, pas seulement l’avoir vu. |
| Le héros rétablit tous les pouvoirs sans aide. | Praticiens, diagnostic, infrastructures, fatigue et rééducation font partie du processus. |
| Une personne rechargée réveille tous ses voisins. | Seul le centre pur d’Elio permet une première activation saine ; ni la proximité ni un bénéficiaire ne le reproduisent. |
| Un Porteur utilise les quatre familles ou voyage naturellement dans le temps. | En général chacun se spécialise ; l’exception d’Elio vient d’apprentissages reconstruits et reste limitée à une discipline active. Le voyage temporel exige toujours une machine et une ancre. |
| Séveran conserve une catégorie indéterminée. | Non. Il est Porteur Énergie, spécialisé dans la captation, la régulation et la redistribution des flux. |
| Les humains jouables reçoivent implicitement un noyau divin. | Ils utilisent Mecha et un noyau artificiel à sept modules, jamais une cinquième catégorie divine. |
| Mecha appartient exclusivement à la résistance. | Non. La technologie peut être copiée, volée ou adoptée par des humains de plusieurs camps sans devenir un implant corruptif de Porteur. |
| Un doublon fabrique une nouvelle personne. | N1 à N7 éveille les sept pétales ou modules du même personnage ; il n’existe ni N0 ni sept copies narratives. |
| Le Cœur restauré transforme automatiquement la box en N7. | Le plein fonctionnement narratif des noyaux et le niveau de collection sont deux états explicitement séparés. |
| Le Cœur ne restaure que les alliés. | Il ne trie pas moralement : les noyaux naturels ennemis concernés sont également restaurés, sans effacer séquelles, convictions ni crimes. |
| La coalition exige tous les personnages rares. | Les alliés et moyens indispensables sont fournis par la campagne ; le gacha ne verrouille ni la victoire ni le sauvetage. |
| Lyra a façonné l’enfance de son futur partenaire. | Cette version propose un réveil adulte et une relation personnelle beaucoup plus tardive, sans éducation parentale. |
| La couverture rend tous les sentiments faux. | Montrer la mission, les mensonges et les choix réels sans imposer un pardon automatique. |
| Lyra a forcément trahi son groupe avant d’aimer Elio. | Non. Sa mission consiste à le connaître réellement ; l’amour peut naître sans désobéissance. Le conflit vient de la vérité révélée seulement après A. |
| Les nouvelles règles rendent la version Elio obligatoire. | Non. Dans le miroir, Lyra est la capsule préservée et la scientifique qui place son pétale dans Nacre à Z ; Elio appartient au collectif Biotique, mène la recherche, cache son origine et s’interpose ; Nacre sauve Lyra. La structure émotionnelle reste identique. |
| Le jeune héros a une famille adoptive malgré le changement d’origine. | Les proches de Sélis sont désormais ceux qu’il rencontre après son réveil adulte. |
| L’hérédité naturelle fabrique des noyaux à volonté. | Elle suit l’état des centres parentaux ; aucun prélèvement, pétale ou rituel ne crée artificiellement un noyau primordial. |
| Un enfant de Porteur et d’humain possède automatiquement les pouvoirs. | Il naît sans noyau, avec seulement des sensibilités accrues à préciser et sans longévité infinie. |
| Le partenaire revient sans conséquences. | Prévoir des soins, une convalescence et des échanges sur les secrets. |

Un changement de statut dans ce dossier ne met à jour ni les sauvegardes du jeu ni les scripts de gacha. Cette livraison est exclusivement narrative et documentaire.
<!-- END:AUDIT-003 -->

# Arbitrages et décisions clôturées

<!-- BEGIN:Q-001 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"GRAINE-002,MEMOIRE-001,EVT-004,EVT-007"} -->
<a id="q-001"></a>
## Âge biologique ou chiffré du réveil

La structure de la mémoire après la stase est confirmée dans `MEMOIRE-001`. Seuls l’âge biologique ou chiffré précis du protagoniste, ainsi que les exemples concrets de flashs à mettre en scène, restent à fixer. Ne pas inventer une valeur pour fermer artificiellement ce point.
<!-- END:Q-001 -->

<!-- BEGIN:Q-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"COUPLE-002,EVT-014,CH-07"} -->
<a id="q-002"></a>
## Question historique clôturée : mort de Lyra-source

Lyra-source meurt désormais pendant l’attaque de Séveran contre la tentative de restauration du Cœur, en s’interposant pour Elio. Elle succombe aux blessures physiques de l’affrontement et non à la disparition de son noyau. Les détails de la blessure restent à développer, mais l’ancienne variante de l’évacuation et de l’autodestruction du noyau est écartée.
<!-- END:Q-002 -->

<!-- BEGIN:Q-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"COUPLE-001,COUPLE-003,LYRA-001,CH-10"} -->
<a id="q-003"></a>
## Question clôturée : mission, amour et révélation de Lyra

Lyra peut accomplir sa mission d’approche sans trahir son collectif : elle apprend réellement à connaître Elio et ses sentiments ne sont pas simulés. Après A-source, elle lui révèle son origine, la capsule et la mission ; le choc provoque une séparation temporaire, puis une réconciliation avant leur départ vers Orthe. La durée précise de la crise et le nom ou l’organisation détaillée du collectif restent à écrire sans rouvrir cette causalité.
<!-- END:Q-003 -->

<!-- BEGIN:Q-004 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"TEMPS-004,TEMPS-005,IA-003,IA-004,CH-15"} -->
<a id="q-004"></a>
## Minutage et géographie du secours

Le trajet, le mode de conservation, les positions et les prérequis du secours doivent être vérifiés ensemble au storyboard. Aucun ancien nombre de secondes n’est canonique ; la durée commence dès l’ouverture par Elio-source à Z et inclut observation et combat. La suspension suit le retour séparé de Séveran. Le laboratoire original de A/Z et le sauvetage final sont sur Sélis ; les balises tardives de téléportation restent distinctes des relais énergétiques.
<!-- END:Q-004 -->

<!-- BEGIN:Q-005 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"COSMO-002,COSMO-003,GEOGRAPHIE-001,COEUR-003,POLITIQUE-001,HIST-002,HIST-003,NOYAU-004,HEREDITE-001,DEMOGRAPHIE-001,GRAINE-001"} -->
<a id="q-005"></a>
## Détails encore ouverts de l’histoire ancienne

Restent à définir : motif du rappel divin, identité des dieux cosmiques, noms et récits des huit dieux locaux, institutions et dates anciennes, dimensions et racines précises du Cœur, fonctionnement fin des relais et de l’inhibiteur après le coup reçu, démographie ainsi qu’autorités, nombres, destinations et destins des capsules. Leur départ après le vote et le coup d’État mais avant le Bâillon, ainsi que la portée locale à Orthe, sont confirmés. Des survivants peuvent transmettre naturellement des noyaux selon `HEREDITE-001`, sans permettre leur fabrication artificielle.
<!-- END:Q-005 -->

<!-- BEGIN:Q-006 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"TEMPS-001,TEMPS-002,AUDIT-001"} -->
<a id="q-006"></a>
## Étendue future de la recherche temporelle

La machine de cette version ne réécrit jamais le passé réalisé. Une éventuelle vraie réécriture dans un autre arc nécessiterait de reconstruire l’audit complet ; elle ne doit pas être annoncée comme une amélioration technique banale déjà garantie.
<!-- END:Q-006 -->

<!-- BEGIN:Q-007 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"PERS-001,REDEMPTION-001,GACHA-001,GACHA-002"} -->
<a id="q-007"></a>
## Distribution, rares restaurations et bannières

Les personnages et rangs de la v1.0 sont maintenus comme maquette. Les étapes de Saren, une éventuelle rédemption ou jouabilité ultérieure de Séveran, les séquelles d’implants, le mode de recrutement gratuit du partenaire, les taux, coûts, garanties et bannières restent à préciser. Les règles générales concernant humains Mecha des différents camps, N1 à N7 et personnages déjà réactivés sont confirmées.
<!-- END:Q-007 -->

<!-- BEGIN:Q-008 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"MECHA-001,REG-003,PERS-001,ELIO-POUVOIRS-001"} -->
<a id="q-008"></a>
## Question clôturée : berceau de Mecha

Les Chantiers de Cendre sont le berceau historique de Mecha. Cette alternative technologique naît clandestinement après le Grand Bâillon afin de résister sans dépendre des réactivations du Concordat, puis se diffuse par les déplacements des personnes. Les institutions fondatrices, le design final et la distribution complète de ses utilisateurs restent à développer sans rouvrir la région d’origine.
<!-- END:Q-008 -->

<!-- BEGIN:Q-009 -->
<!-- META:{"status":"OUVERT","origin":"utilisateur","kind":"question","views":"","period":"","order":0,"refs":"ELIO-POUVOIRS-001,POUVOIR-002"} -->
<a id="q-009"></a>
## Apprentissage Biotique et combinaisons d’endgame

Lyra transmet Biotique au protagoniste après son sauvetage, mais les étapes techniques et dramatiques de cet apprentissage restent à développer. Une utilisation simultanée de plusieurs disciplines par Elio demeure une possibilité d’endgame très tardive, non une capacité confirmée.
<!-- END:Q-009 -->

<!-- BEGIN:Q-010 -->
<!-- META:{"status":"OUVERT","origin":"utilisateur","kind":"question","views":"","period":"","order":0,"refs":"GACHA-002,MECHA-001"} -->
<a id="q-010"></a>
## Représentation visuelle définitive de N1 à N7

L’ergonomie commune du centre et des sept pétales ou modules est confirmée. Les formes, animations, couleurs, matériaux et écrans définitifs restent à concevoir ; la version Mecha doit évoquer clairement une construction artificielle.
<!-- END:Q-010 -->

<!-- BEGIN:Q-011 -->
<!-- META:{"status":"OUVERT","origin":"utilisateur","kind":"question","views":"","period":"","order":0,"refs":"FRAGMENT-002,COEUR-002"} -->
<a id="q-011"></a>
## Micro-mécanique scientifique des pétales

Les fonctions, limites et besoins d’entretien des pétales sont confirmés. Leur support matériel exact, les échanges énergétiques fins, leur vieillissement, la méthode de connexion au Cœur et le sort du pétale de Nacre pendant son transfert restent à développer sans créer de centre pur ni permettre une première réactivation autonome.
<!-- END:Q-011 -->

<!-- BEGIN:AUDIT-Q24 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"FRAGMENT-001,FRAGMENT-002,COEUR-002"} -->
<a id="audit-q24"></a>
## Q24 — Décision clôturée : énergie renouvelable mais débit limité

Un noyau naturellement sain renouvelle sa charge même loin d’Orthe ; près du Cœur ou d’un relais énergétique alimenté, l’accès est plus abondant et stable. Le centre pur d’Elio conserve une capacité renouvelable exceptionnelle, mais débit, réserve, stockage, manipulation et endurance restent limités. L’excès peut le blesser ou le tuer. Le stockage externe ne contourne pas la synchronisation collective et les pétales ne prolifèrent pas en nouveaux centres purs.
<!-- END:AUDIT-Q24 -->

<!-- BEGIN:AUDIT-Q25 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"FRAGMENT-001,FRAGMENT-002,IA-006"} -->
<a id="audit-q25"></a>
## Q25 — Décision clôturée : entretien des pétales séparés

Les pétales séparés deviennent des micro-noyaux dotés d’une faible réserve, installés dans des relais énergétiques non téléportants et capables de stabiliser ou recharger des Porteurs déjà réactivés. Ils vivent d’apports naturels ou artificiels et de l’entretien des relais et Porteurs. Ils peuvent durer très longtemps sans garantie d’éternité, ne réactivent aucun nouveau Porteur et ne redémarrent pas seuls le Cœur.
<!-- END:AUDIT-Q25 -->

<!-- BEGIN:AUDIT-Q26 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"NOYAU-002,NOYAU-005,GACHA-001"} -->
<a id="audit-q26"></a>
## Q26 — Décision clôturée : rituel conscient de synchronisation

La première réactivation saine exige la volonté du Porteur, le protagoniste au centre pur, une confiance suffisante, un rapprochement réel et plusieurs minutes de synchronisation consciente, par exemple mains jointes, yeux fermés et concentration commune. Aucun lien romantique n’est requis. Elio dans la lecture de référence, ou Lyra dans le scénario miroir, fournit l’impulsion initiale ; la compatibilité reste ensuite acquise pour les recharges.
<!-- END:AUDIT-Q26 -->

<!-- BEGIN:AUDIT-Q27 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"POUVOIR-001,POUVOIR-002,ELIO-POUVOIRS-001,MECHA-001"} -->
<a id="audit-q27"></a>
## Q27 — Décision clôturée : disciplines successives d’Elio

Elio maîtrisait Gravité avant sa stase, l’a oubliée, puis l’Elio-source a appris Spatial après G. L’Elio joué apprend Énergie, reconstruit Spatial par indices et pratique, retrouve puis réapprend plus tard Gravité après le témoignage d’un ancien, apprend séparément Mecha et reçoit enfin l’enseignement Biotique de Lyra. Les visions privées ne donnent jamais une maîtrise instantanée. Cette exception ne lui permet normalement d’activer qu’une discipline à la fois et s’inverse avec les rôles dans le scénario miroir.
<!-- END:AUDIT-Q27 -->

<!-- BEGIN:AUDIT-Q28 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"EVT-011,EVT-023,EVT-012,EVT-014,EVT-013"} -->
<a id="audit-q28"></a>
## Q28 — Décision clôturée : deux essais du Cœur

L’histoire-source comprend deux essais : premier échec faute de puissance distribuée, tournée des six régions, réactivations, détachement de six pétales seulement et création de Nacre encore sans fragment, puis deuxième essai coordonné alors que les six pétales demeurent dans leurs relais. Ce deuxième flux reste insuffisant avant que Séveran ne l’interrompe et tue physiquement Lyra-source. Suivent le marchandage et la coopération avec accord de non-confiscation. Le septième pétale n’est placé dans Nacre qu’à Z. La tentative jouée rassemble physiquement les six avec le noyau complet jeune et Nacre ; elle est distincte des deux affrontements du final.
<!-- END:AUDIT-Q28 -->

<!-- BEGIN:AUDIT-Q29 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"SEVERAN-003,SEVERAN-004,IA-003"} -->
<a id="audit-q29"></a>
## Q29 — Décision clôturée : incertitude de Séveran

Séveran ne croit pas l’Elio joué mort avec certitude. Il voit sa cible disparaître, ne voit pas Nacre l’extraire et ne possède aucune preuve de mort, de survie ou de destination. Faute de piste personnelle certaine, il ne lance pas immédiatement une chasse ciblée, tandis que le Concordat poursuit ses opérations déjà engagées contre les régions. Après plusieurs actions visibles, des rapports fiables peuvent confirmer la survie d’Elio et déclencher une traque personnelle ; son moment exact reste proposé.
<!-- END:AUDIT-Q29 -->

<!-- BEGIN:AUDIT-Q30 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"IA-005,IA-006,IA-007,COEUR-002,FRAGMENT-003"} -->
<a id="audit-q30"></a>
## Q30 — Décision clôturée : septième pétale et mémoire de Nacre

Nacre ne reçoit le septième pétale qu’à Z pour amorcer la fenêtre avant l’attaque. L’extraction du centre source et les changements de raccord endommagent surtout ses index historiques ; sa personnalité et ses souvenirs nouveaux subsistent. Elle contribue au redémarrage par un raccordement dont elle connaît les fonctions ordinaires ; la réussite précède l’explication. Après le second affrontement, la résonance révèle le pétale : seul le jeune Elio vit son empreinte locale d’amorçage, tandis que données partielles, mesures, témoins et corps retrouvé corroborent les événements postérieurs et les paramètres du secours. Le Cœur devient autonome avant la destruction temporelle.
<!-- END:AUDIT-Q30 -->

<!-- BEGIN:AUDIT-Q31 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"COEUR-001,COEUR-002,GACHA-002,GACHA-003,FIN-002"} -->
<a id="audit-q31"></a>
## Q31 — Décision clôturée : plein fonctionnement narratif

Le Cœur restauré rend aux véritables noyaux concernés leur fonctionnement naturel complet, alliés et ennemis compris, sans effacer séquelles, convictions ni crimes. Les générations inexpérimentées retrouvent un potentiel, pas une maîtrise instantanée. Cette restauration du monde ne change pas la box : un personnage N2 reste mécaniquement N2 et la progression de collection N1 à N7 continue selon les règles du jeu.
<!-- END:AUDIT-Q31 -->

<!-- BEGIN:AUDIT-Q32 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"GACHA-001,GACHA-002,MECHA-001,PERS-001"} -->
<a id="audit-q32"></a>
## Q32 — Décision clôturée : Porteurs et humains Mecha jouables

Les Porteurs et les humains équipés de Mecha, quel que soit leur ancien camp, deviennent jouables après une vraie rencontre et une coopération crédible. Leur premier pull donne N1, puis les obtentions éveillent les sept pétales divins ou modules artificiels jusqu’à N7 sans créer de copies narratives. Aucun noyau divin n’est inventé pour les humains ou les descendants mixtes sans noyau, et la coalition finale reste accessible sans tous les personnages rares.
<!-- END:AUDIT-Q32 -->
