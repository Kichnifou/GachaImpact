# Les Origines — Source narrative unique

Version : 1.3 de travail — 14 septembre 2026

Ce fichier remplace la bible narrative v1.0 comme source éditable. Divulgâchage intégral. Les décisions confirmées, les propositions et les questions sont distinguées au niveau de chaque bloc.

Pour une modification ciblée, chercher la balise `<!-- BEGIN:IDENTIFIANT -->` et remplacer le bloc jusqu’à `<!-- END:IDENTIFIANT -->` inclus. Ne pas changer les identifiants pour un simple renommage. Les relations entre blocs sont déclarées dans `refs`.

Le script `node tools/generer-story.mjs` produit les vues de lecture depuis cette source. Il vérifie le format, les références et la synchronisation des sorties, pas la qualité dramatique ni les paradoxes de toutes les scènes.

# Mode d’emploi

<!-- BEGIN:CADRE-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"gestion","views":"","period":"","order":0,"refs":""} -->
<a id="cadre-001"></a>
## Périmètre de cette version

Cette révision 1.3 de travail intègre les dernières décisions de l’auteur tout en conservant explicitement les mécanismes proposés et les arbitrages encore ouverts.

CONFIRME désigne une orientation explicitement fixée par l’auteur. PROPOSE désigne une solution de travail, qu’elle vienne de l’auteur ou de l’assistant. OUVERT désigne un arbitrage restant à faire. Le champ « origine » précise la provenance ; une proposition héritée de la v1.0 n’est pas automatiquement approuvée.

Orthe, Sélis, Séveran et Nacre restent les noms de travail utilisés pour la continuité du dossier. Les dates chiffrées, les âges, l’amnésie exacte, les détails physiques de la machine et les institutions inventées ici sont révisables. Les règles temporelles sont des conventions de fiction, pas des affirmations scientifiques.

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

Une population humaine importante est restée sur Orthe. Les autres planètes peuvent conserver des légendes et des vestiges de leur origine commune, sans abriter pour autant des lignées naturelles de Porteurs. Les capsules de sauvegarde peuvent cependant y avoir transporté exceptionnellement des Porteurs : leur sort ne doit pas être confondu avec une descendance naturelle.

La phrase « tous les Porteurs sont restés » décrit la période des migrations fondatrices. Elle n’interdit donc pas à Lyra d’effectuer ultérieurement une mission interplanétaire, ni à Elio d’être envoyé en capsule. Le pouvoir d’Elio n’est pas expliqué par un héritage ayant sauté des générations sur Sélis.
<!-- END:MONDE-002 -->

# Histoire et factions

<!-- BEGIN:HIST-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":""} -->
<a id="hist-001"></a>
## La rupture ancienne et la perte générale des pouvoirs

Séveran et le futur Concordat provoquent volontairement, pendant une guerre ancienne, la désactivation des noyaux de tous les camps afin de reprendre ensuite le contrôle de leur usage. Leurs propres Porteurs perdent également leurs capacités.

Séveran assume ce désarmement comme un moyen d’éviter une nouvelle guerre de Porteurs et entend refaire fonctionner les noyaux par ses propres procédés. Certains alliés craignent les séquelles et font défection ; d’autres acceptent le régime pour retrouver leur puissance. Les réveils forcés restent rares, incertains et altérants. L’appareil exact, les étapes historiques et ce que le public sait de cette préméditation demeurent à développer.

Le conflit oppose notamment la défense d’une vie commune et de l’autonomie des peuples à la volonté de centraliser le contrôle. Les armées restent majoritairement soutenues par des soldats, des installations et des moyens matériels ; quelques combattants réactivés constituent des forces exceptionnelles, pas une population entière de dieux disponibles.
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
## Le Grand Bâillon : mécanisme proposé d’un sabotage confirmé

Le Grand Bâillon est le nom proposé pour l’inhibition durable des noyaux volontairement provoquée par Séveran. Le sabotage et son objectif de contrôle sont confirmés ; le mécanisme de réseau décrit ici reste une solution de travail.

Les signatures des Porteurs avaient été inscrites dans un réseau de sécurité commun. Pendant la guerre, un arrêt d’urgence destiné à limiter un désastre est détourné : Séveran force le système au-delà de son mode provisoire. La référence stable nécessaire aux pouvoirs actifs s’effondre et chaque noyau enregistré conserve un verrou résiduel.

Il accepte de perdre ses pouvoirs parce que sa faction a préparé des armées conventionnelles, des réserves et la prise des relais. Le bénéfice immédiat est politique et logistique. Le retour futur des pouvoirs est un objectif de recherche, pas une victoire déjà acquise.

Éteindre aujourd’hui la centrale impériale ne réparerait pas les lésions inscrites dans chaque noyau. En revanche, cela peut supprimer des contraintes supplémentaires imposées aux réveils forcés. L’inhibition empêche l’usage normal des pouvoirs, mais le noyau n’est pas indispensable à la vie de son Porteur. Les conséquences exactes sur le vieillissement tant que le noyau demeure présent restent à préciser.

Les capsules isolées avant l’enregistrement général échappent à cette opération. Il ne suffit donc pas d’être loin d’Orthe pour être intact : il faut n’avoir jamais été intégré au système frappé.
<!-- END:HIST-003 -->

# Origines du couple

<!-- BEGIN:GRAINE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-003"} -->
<a id="graine-001"></a>
## Environ cent capsules, un seul survivant retrouvé

À l’époque du Grand Bâillon, environ cent Porteurs volontaires sont placés dans des capsules de stase et envoyés vers différentes planètes. Ce nombre est un ordre de grandeur de référence, pas un décompte définitif immuable. Elio est le seul survivant retrouvé et confirmé pendant l’arc principal ; son noyau est resté intact pendant une très longue stase sur Sélis.

Le peuple d’Orthe a progressivement supposé que les autres capsules avaient échoué faute d’avoir pu les retrouver, mais leur sort réel demeure inconnu. Certaines peuvent avoir été détruites, rester fermées, avoir été ouvertes depuis longtemps ou avoir réveillé leur occupant sur une autre planète. Le nombre de survivants effectifs n’est pas confirmé.

Lyra est envoyée rechercher les capsules sur différentes planètes. Elle retrouve Elio, le réveille, l’observe à distance puis doit retourner sur Orthe. Lors d’un voyage ultérieur, elle le retrouve dans la société de Sélis et prend une couverture professionnelle sur son lieu de travail.
<!-- END:GRAINE-001 -->

<!-- BEGIN:GRAINE-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"GRAINE-001"} -->
<a id="graine-002"></a>
## Le réveil adulte : solution proposée pour la nouvelle origine

Elio est déjà un jeune adulte lorsqu’il entre en stase puis lorsqu’il en sort. Cette proposition remplace l’enfance adoptive de la v1.0 et permet son intégration autonome sur Sélis.

Une stase excessivement longue et dégradée a effacé chez Elio le souvenir conscient de sa maîtrise Spatial et de son passé de Porteur. L’étendue exacte de son amnésie autobiographique reste proposée. Il conserve le langage, des connaissances et des compétences scientifiques de base, ainsi que des intuitions spatiales implicites sans savoir les identifier. Il apprend normalement après son réveil : ses souvenirs récents ne disparaissent pas au gré des besoins du scénario.

Lyra assure les premiers secours pendant qu’il est encore inconscient, puis organise discrètement l’accès à une structure civile d’accueil, des documents et un hébergement. Elle n’invente ni une enfance ni une famille dans sa mémoire. Rappelée, elle le laisse à des personnes capables de l’aider ; elle ne l’abandonne pas affamé dans un monde inconnu.

Il se construit une place par ses études complémentaires, ses relations et son travail. Des amis, collègues ou mentors de Sélis remplacent le rôle de la famille adoptive de la v1.0. Ils doivent continuer d’exister dans l’épilogue. L’amnésie de stase reste un choix proposé, à valider séparément ; elle ne doit pas tout expliquer.
<!-- END:GRAINE-002 -->

<!-- BEGIN:COUPLE-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"GRAINE-001,NOMS-001"} -->
<a id="couple-001"></a>
## Couverture professionnelle, rencontre et amour

Lors de son retour sur Sélis, Lyra se fait embaucher sous couverture dans l’environnement de travail d’Elio. Leur relation naît alors de contacts adultes, d’une amitié et de travaux communs ; au prologue, ils sont déjà en couple.

Lyra possède de vraies compétences utiles à son emploi. Sa mission consiste à vérifier la survie et la situation d’Elio, pas à le séduire. L’amour n’est pas simulé ; dans le scénario miroir, tous ces rôles s’inversent sans produire une intrigue différente.
<!-- END:COUPLE-001 -->

<!-- BEGIN:COUPLE-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"COUPLE-001,GRAINE-002"} -->
<a id="couple-003"></a>
## Rupture de mission et conséquences relationnelles proposées

Lyra cesserait de transmettre des informations personnelles et renoncerait à la part intrusive de sa mission avant de s’engager dans la relation. Son secret resterait une faute : Elio n’avait pas toutes les informations, même si les sentiments étaient réels.

Les flashbacks pourraient montrer une première discussion, un désaccord professionnel, une entraide puis une scène intime ordinaire. Après le sauvetage, le couple discuterait de la dissimulation et choisirait librement la suite ; la reconnaissance d’avoir été sauvé n’impose ni pardon ni attachement.
<!-- END:COUPLE-003 -->

<!-- BEGIN:COUPLE-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-001,COEUR-001"} -->
<a id="couple-002"></a>
## Les deux parcours du partenaire

Lyra de l’histoire-source et Lyra du prologue partagent le passé du couple jusqu’à A, puis vivent des événements différents. Lyra-source meurt en s’interposant lorsque Séveran attaque Elio pendant une tentative de restauration du Cœur ; le sauvetage final concerne la personne du prologue joué, pas sa version plus âgée.

Lyra-source meurt des blessures infligées pendant l’affrontement, et non parce que son noyau aurait été détruit ou retiré. Les détails physiques de la blessure et l’état exact de son noyau restent à développer. Elio veut d’abord tuer Séveran, mais n’en a pas la puissance ; leur coopération ultérieure naît du deuil et du marchandage proposé par l’antagoniste.

Lyra du prologue reçoit une blessure gravissime mais son noyau n’est pas détruit. La suspension préserve sa continuité. À la fin, l’équipe la récupère vivante et la soigne. Elle ne reçoit pas les souvenirs de sa version-source ; elle retrouve l’Elio avec qui elle était déjà en couple, transformé par son périple.
<!-- END:COUPLE-002 -->

# Pouvoirs et antagonisme

<!-- BEGIN:NOYAU-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":""} -->
<a id="noyau-001"></a>
## Fonction des noyaux et vie de leur porteur

Les noyaux ont été transmis aux Porteurs pour entretenir et réguler des fonctions du monde, non initialement pour gouverner les humains. Ils donnent accès aux pouvoirs, mais ne sont indispensables ni à la vie humaine ni à l’identité personnelle.

Un véritable noyau primordial comprend un centre, qui porte sa fonction fondamentale, et exactement sept pétales liés à sa capacité exploitable, ses réserves et ses niveaux d’éveil ou de maîtrise. Cette architecture ne signifie pas qu’un Porteur possède sept vies ni sept copies de lui-même.

Retirer complètement un noyau ne tue pas par définition son porteur : il devient un humain ordinaire, perd ses pouvoirs et peut désormais vieillir. Détruire ou désactiver le noyau n’est pas davantage une cause automatique de mort. Une extraction ou une attaque violente peut tuer par les blessures qu’elle inflige ; cette causalité doit toujours être distinguée de la perte du noyau elle-même.
<!-- END:NOYAU-001 -->

<!-- BEGIN:NOYAU-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-001"} -->
<a id="noyau-002"></a>
## Réactivation temporaire et recharge

Elio peut réactiver sainement le noyau d’un autre Porteur et lui fournir une première impulsion qui n’est pas une charge permanente. La compatibilité ainsi établie reste acquise, mais les pétales du bénéficiaire se déchargent avant la restauration du Cœur. Ils doivent ensuite être rechargés auprès d’Elio, d’un pétale régional ou d’un relais adapté.

Un noyau réactivé ne devient pas un nouveau centre pur : il ne peut ni éveiller d’autres Porteurs, ni reproduire le pouvoir particulier d’Elio. La compétence ancienne et la charge disponible restent deux choses différentes ; les Porteurs expérimentés peuvent savoir quoi faire sans disposer de l’énergie nécessaire.

La simple proximité ne déclenche jamais la première réactivation. Elio et le Porteur doivent accomplir consciemment le rituel défini dans `NOYAU-005`. Elio demeure indispensable à cette première activation saine ; un bénéficiaire réactivé ne peut pas la transmettre à d’autres.
<!-- END:NOYAU-002 -->

<!-- BEGIN:NOYAU-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-001,NOYAU-001"} -->
<a id="noyau-003"></a>
## Les réveils forcés du Concordat

Le Concordat obtient de rares réactivations par des méthodes dangereuses, incertaines et altérantes. Les pouvoirs peuvent presque retrouver leur ampleur, mais l’instabilité atteint le corps et peut affecter l’esprit du bénéficiaire.

La dégradation physique ou mentale ne définit pas le mal. Certains sujets sont volontaires, d’autres contraints ; des personnes lucides soutiennent le Concordat, tandis que d’autres peuvent changer de camp ou être devenues dangereuses sans avoir choisi son idéologie.
<!-- END:NOYAU-003 -->

<!-- BEGIN:NOYAU-007 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-003"} -->
<a id="noyau-007"></a>
## Procédé proposé des réveils forcés

La méthode impériale forcerait le noyau à fonctionner sans réparer sa référence. Des implants et charges extérieures maintiendraient artificiellement la coordination, au prix de douleurs, crises, lésions ou troubles variables de mémoire et d’impulsion.

Les rares réussites coûteraient cher, exigeraient une surveillance et ne permettraient pas d’armer toute la population. Des personnages d’Orthe pourraient être tentés par ces procédés ; leur refus collectif ne serait ni automatique ni facile.
<!-- END:NOYAU-007 -->

<!-- BEGIN:SEVERAN-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"HIST-001,HIST-002,HIST-003,NOYAU-003"} -->
<a id="severan-001"></a>
## Une sécurité imposée au nom du bien commun

Séveran pense agir pour le bien : il veut prévenir une nouvelle guerre de Porteurs, distribuer capacités et ressources et garantir les services essentiels, mais seulement sous une tutelle centrale qu’il contrôle.

Certaines réalisations du Concordat ont réellement aidé des populations. La critique porte sur la contrainte, le monopole et le refus d’un contrôle partagé, non sur une méchanceté sans motif. Séveran assume cependant d’avoir provoqué le Bâillon comme un désarmement qu’il juge nécessaire ; sa nuance ne blanchit pas cette responsabilité.

Le Concordat reste une organisation avec officiers, administrateurs, chercheurs et soutiens civils. Certains Porteurs refusent son pari ou font défection ; d’autres le rejoignent pour retrouver leur puissance. La défaite de Séveran ne résout pas instantanément cet ensemble politique.
<!-- END:SEVERAN-001 -->

<!-- BEGIN:SEVERAN-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002,NOYAU-003,SEVERAN-001"} -->
<a id="severan-002"></a>
## À quoi servirait exactement le noyau volé

La Matrice de tutelle est une solution proposée pour expliquer comment Séveran exploiterait le centre pur : une infrastructure capable de stabiliser les réveils de ses alliés tout en conservant sur eux un contrôle matériel.

| Besoin | Utilisation proposée du noyau |
|---|---|
| Éviter les réveils destructeurs | L’organe vivant fournit une référence active stable que les méthodes actuelles ne savent pas fabriquer. |
| Restaurer les troupes d’élite | La Matrice calibre successivement des noyaux sélectionnés ; elle ne crée ni personnes ni spécialités nouvelles. |
| Garder le commandement | Les réactivations passent par des régulateurs impériaux, au lieu de rendre à chacun une autonomie complète. |
| Consolider l’empire | Les unités ainsi stabilisées reprennent les villes, sécurisent les relais et rendent les révoltes beaucoup plus difficiles. |

Séveran ne veut ni manger le noyau, ni obtenir tous les pouvoirs en l’avalant. Une extraction forcée pourrait tuer Elio par sa violence, mais la perte du noyau n’est pas automatiquement mortelle. Même en cas de réussite, la restauration d’une armée demanderait des moyens, du temps et l’adaptation de chaque bénéficiaire.

Une simple mesure ancienne du noyau ne suffit pas : le processus nécessite sa réponse vivante aux instabilités. La distinction avec le réaccord libre est donc à la fois technique et politique : une référence capturée pour administrer les autres, contre une aide temporaire destinée à leur autonomie.
<!-- END:SEVERAN-002 -->

<!-- BEGIN:SEVERAN-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"SEVERAN-001,COUPLE-002"} -->
<a id="severan-003"></a>
## Découverte tardive, marchandage et raid vers A

Elio-source agit d’abord clandestinement : des communautés le connaissent et l’apprécient sans que les dirigeants du Concordat aient identifié la source pure. Lors d’une tentative de restauration du Cœur, Séveran détecte son noyau, intervient et tue Lyra lorsqu’elle s’interpose.

Elio veut d’abord tuer Séveran, sans en avoir la puissance, et empêche la confiscation de son noyau en menaçant d’en désactiver définitivement le centre grâce à une sécurité qu’il a inventée. Séveran lui propose alors de combiner leurs technologies pour lui permettre de revoir Lyra. Elio endeuillé collabore avec lui, détaché émotionnellement, puis le quitte et retourne secrètement sur Sélis poursuivre ses recherches.

La clandestinité initiale n’est pas une invisibilité magique : les communautés qui connaissent Elio ne publient pas toutes son identité au régime, et leurs moyens de discrétion restent à développer. Les services sincères rendus par Elio et les souvenirs reconnaissants n’effacent ni les victimes possibles de ses travaux ultérieurs ni sa responsabilité à examiner.

Elio prépare à l’avance un essai vers A, moment de leur vie commune qu’il souhaite revoir, sans savoir que Séveran arrivera. En Z, Séveran le retrouve ; Elio désactive volontairement son centre, puis Séveran le tue. L’antagoniste détourne alors la destination déjà programmée afin d’atteindre le noyau jeune, pur et non protégé. La fragmentation seule ne rendait pas le centre adulte sans valeur.

Après l’intrusion au point A, Séveran constate seulement la disparition de l’Elio joué. Il ne voit pas l’extraction de Nacre et ne possède aucune preuve de mort ni de survie. Sans localisation, piste certaine ou confirmation que sa cible a survécu, il ne lance pas immédiatement de chasse personnelle sur Orthe. Les forces impériales y poursuivent néanmoins leurs opérations ordinaires ; des indices ultérieurs peuvent révéler la survie d’Elio.
<!-- END:SEVERAN-003 -->

<!-- BEGIN:SEVERAN-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"SEVERAN-003,SEVERAN-002,IA-003"} -->
<a id="severan-004"></a>
## Mécanismes proposés de la coopération et de la sécurité

Séveran disposerait d’installations, d’archives et d’un savoir dont Elio endeuillé a besoin. La promesse de revoir Lyra porterait sur une recherche plausible, non sur une résurrection déjà maîtrisée. Elio accepterait certains travaux utiles au Concordat tout en refusant la confiscation de son noyau ; il partirait lorsque le régime franchit ses limites et détourne les résultats vers les captures ou réveils forcés.

La sécurité serait volontaire, protégée contre une extraction forcée et insensible aux blessures ordinaires. Elle rendrait le centre inexploitable sans désactiver simultanément la machine, Nacre et les fragments séparés. Ses conditions exactes et la façon d’empêcher une récupération après l’assassinat restent proposées.

Après A-fenêtre, Séveran reste incertain : la disparition de la signature ne prouve ni mort ni survie et ne révèle aucune destination. Les moyens précis par lesquels ses services découvrent plus tard les activités de l’Elio joué restent à développer sans lui attribuer rétrospectivement une preuve impossible.
<!-- END:SEVERAN-004 -->

<!-- BEGIN:REDEMPTION-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002,NOYAU-003,GACHA-001"} -->
<a id="redemption-001"></a>
## Soigner, réparer, choisir de changer

Un ancien ennemi peut être soigné, choisir de changer de camp puis devenir jouable ; un ancien allié peut aussi prendre le chemin inverse. La guérison ne convertit personne automatiquement et la dégradation n’est pas une définition du mal.

Les victimes gardent une voix : le soin n’efface ni les actes passés, ni la justice, ni les réparations. Un personnage peut être stabilisé et rester loyal au Concordat, ce qui distingue son opinion de sa lésion.
<!-- END:REDEMPTION-001 -->

<!-- BEGIN:REDEMPTION-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"REDEMPTION-001,NOYAU-003,GACHA-001"} -->
<a id="redemption-002"></a>
## Parcours proposé de Saren

Saren pourrait être le premier ancien ennemi développé : commandant ayant accepté un réveil forcé pour protéger son unité, commis des violences puis découvert que le régime sacrifie ses soldats.

Après sa stabilisation, il devrait ouvrir une évacuation, témoigner contre le programme et accepter une procédure de justice avant un pacte de coopération. Ce parcours reste une proposition de casting et ne transforme pas le soin en absolution automatique.
<!-- END:REDEMPTION-002 -->

<!-- BEGIN:NOYAU-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"","period":"","order":0,"refs":"GRAINE-001,NOYAU-001,NOYAU-002"} -->
<a id="noyau-004"></a>
## Pourquoi une nouvelle graine n’est pas fabriquée à volonté

Un noyau primordial intact ne se transmet pas automatiquement par descendance et ne se recrée pas à partir d’un prélèvement. L’existence de populations humaines pendant des millénaires ne produit donc pas spontanément une relève de Porteurs indemnes.

Les fondateurs disposaient de moyens de formation des noyaux désormais perdus ou rendus inutilisables par la rupture. Les noyaux existants forment un héritage limité. Des enfants de Porteurs peuvent exister sans recevoir automatiquement cette architecture.

Réparer un noyau encore vivant est différent d’en créer un neuf. Les futurs relais réparent progressivement des victimes du Bâillon ; ils ne transforment ni un humain ordinaire ni un pétale détaché en nouveau Porteur primordial. D’autres occupants de capsules pourraient toutefois avoir conservé leur noyau existant. Cette règle interdit une solution facile du type « prélever un peu d’Elio pour fabriquer mille références intactes ».

Ce verrou de cosmologie est proposé pour soutenir le caractère indispensable de la graine. Il faudra le préserver ou trouver une autre raison explicite si la reproduction des Porteurs est développée autrement.
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
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"","period":"","order":0,"refs":"NOYAU-001"} -->
<a id="noyau-006"></a>
## Vieillissement et continuité après la perte d’un noyau

Un Porteur privé de son noyau reprendrait son vieillissement depuis son âge biologique présent, sans rattrapage instantané des millénaires. Cette modalité reste proposée ; seules la perte des pouvoirs, la mortalité ordinaire et la possibilité de vieillir sont confirmées.

Une archive ou des données ne suffiraient pas à recréer la continuité d’une conscience définitivement morte. Ce garde-fou préserve les pertes physiques sans confondre mémoire et personne vivante.
<!-- END:NOYAU-006 -->

<!-- BEGIN:POUVOIR-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-001"} -->
<a id="pouvoir-001"></a>
## Quatre catégories de pouvoirs

En règle générale, un Porteur construit sa maîtrise autour d’une catégorie de pouvoir — Gravité, Énergie, Biotique ou Spatial — dont l’expression est modelée par la personne. Une fonction de combat n’est pas une catégorie cosmologique, et aucun Porteur n’accède automatiquement à toutes les expressions de sa famille.

**Gravité :** manipulation du poids, de l’attraction et de la répulsion. Les expressions possibles comprennent attraction d’ennemis, objets ou projectiles ; répulsion et ondes de choc ; augmentation du poids ; légèreté, bonds et déplacements aériens ; points gravitationnels ciblés ; orbites ; changement de direction de la chute vers un mur ou le ciel. Elle peut servir la protection, le contrôle, l’attaque aérienne ou à distance.

**Énergie :** manipulation, production, absorption et transfert d’énergie, avec des formes différentes selon les Porteurs. Les expressions possibles comprennent décharges électriques ; accumulation puis explosion ; absorption d’attaques énergétiques ; récupération et restitution d’impacts, chutes ou mouvements ; chaleur ; lumière et illusions optiques ; renforcement corporel ; transfert entre cibles. Certains produisent ou convertissent leur énergie, d’autres doivent en absorber.

**Biotique :** manipulation du vivant et de ses fonctions, sans se limiter au soin. Les expressions possibles comprennent régénération ; stimulation des muscles, réflexes ou sens ; adaptation de son corps ; afflictions causant faiblesse, ralentissement ou perte de précision ; manipulation de son sang ou du sang déjà versé ; croissance végétale ; mutations temporaires ; croissances parasitaires affaiblissantes.

**Spatial :** manipulation des distances, positions et structures spatiales. Les expressions possibles comprennent téléportation courte ; portails ; échange de positions ; compression ou extension des distances ; distorsion détournant des attaques ; découpe spatiale ; domaines modifiant localement une zone ; ancrage empêchant déplacement ou téléportation.

La liste décrit des spécialisations possibles, pas trente-deux personnages obligatoires. Elio constitue l’exception d’apprentissage définie dans `ELIO-POUVOIRS-001` : il reconstruit plusieurs disciplines successives, sans posséder un noyau naturellement polyharmonique et sans pouvoir les activer toutes ensemble. Dans la lecture où Elio est protagoniste, Lyra maîtrise Biotique ; dans le scénario miroir, cette maîtrise initiale appartient au partenaire Elio. Aucune catégorie n’est attribuée ici à Séveran ni au reste du casting.
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

Avant sa stase, Elio maîtrise consciemment Spatial. La très longue stase efface ce savoir conscient, sans supprimer les mémoires implicites inscrites dans son noyau, ses réflexes et sa perception. Sur Sélis, ses intuitions des distances, des structures et de l’espace nourrissent ses recherches sans lui donner magiquement des connaissances scientifiques complètes.

Après G, l’Elio de l’histoire-source apprend consciemment Gravité auprès des habitants d’Orthe, tandis que Spatial reste enfoui. Sa maîtrise de Gravité, ses intuitions spatiales anciennes, ses compétences scientifiques réelles et les technologies auxquelles il accède contribuent ensemble à l’invention temporelle. Spatial ne produit pas directement le voyage dans le temps.

L’Elio joué arrive d’une continuation antérieure à G et ne possède pas l’apprentissage Gravité dont les habitants se souviennent. Au début de l’aventure, il apprend Énergie. La résonance avec les pétales d’Elio-source lui rend ensuite progressivement Gravité. Plus tard, un très ancien habitant d’Orthe ayant connu Elio avant sa stase lui révèle sa première discipline ; une nouvelle résonance réveille Spatial. Il apprend également Mecha au contact de la culture technologique qui l’a développé, dont la région d’origine reste ouverte.

Après le sauvetage de Lyra, celle-ci lui transmet son savoir Biotique. Elio a appris à reconstruire plusieurs disciplines, mais les détails de ce dernier apprentissage restent à développer. Il n’active normalement qu’un style à la fois : Énergie, Gravité, Spatial, Mecha ou Biotique.

Dans le scénario miroir, cette progression appartient à la protagoniste Lyra et Elio devient le partenaire Biotique qui lui transmet son savoir après son sauvetage. La trame et les limites ne changent pas.
<!-- END:ELIO-POUVOIRS-001 -->

<!-- BEGIN:MECHA-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"POUVOIR-001"} -->
<a id="mecha-001"></a>
## Mecha : discipline humaine artificielle

Mecha est une discipline technologique développée par les humains d’Orthe, et non une cinquième catégorie divine ni un noyau créé par les dieux. Sa région d’origine exacte n’est pas encore confirmée ; ses techniques se sont répandues grâce aux voyages, aux migrations, au travail et aux conflits.

Ses utilisateurs peuvent employer implants, prothèses, exosquelettes, systèmes bioniques, armes synchronisées, drones et renforcements artificiels. Des humains ordinaires deviennent ainsi jouables et pullables sans recevoir de noyau divin. Le protagoniste — Elio dans la lecture de référence, Lyra dans le scénario miroir — peut apprendre Mecha pendant son périple, tout en respectant la règle d’un seul style actif à la fois.

Pour préserver une interface commune, le noyau artificiel Mecha imite un centre entouré de sept modules ou pétales faits de métal, circuits et composants. Un utilisateur Mecha synchronise progressivement ces sept modules de N1 à N7 ; cette représentation ne le transforme pas en Porteur primordial.
<!-- END:MECHA-001 -->

<!-- BEGIN:COEUR-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002"} -->
<a id="coeur-001"></a>
## Le Cœur d’Orthe et la restauration

Le Cœur central permet une vie normale ainsi que la stabilisation et la recharge du réseau. Sa restauration rend aux véritables noyaux des Porteurs leur fonctionnement complet, soit l’équivalent narratif de leurs sept pétales actifs. Ils retrouvent leur potentiel et peuvent s’entraîner sans dépendre des recharges temporaires de l’arc principal.

Ce rétablissement ne donne pas instantanément la maîtrise d’une discipline et ne modifie jamais automatiquement la collection du joueur. Un personnage N2 dans la box reste mécaniquement N2 après la fin ; la progression N1 à N7 est une abstraction de gameplay distincte de l’état du monde raconté.
<!-- END:COEUR-001 -->

<!-- BEGIN:COEUR-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"COEUR-001,ELIO-POUVOIRS-001"} -->
<a id="coeur-002"></a>
## Énergie renouvelable, débit et effort collectif

Le centre pur d’Elio peut produire ou renouveler de l’énergie indéfiniment dans la durée. Il ne donne ni puissance instantanée infinie, ni endurance infinie, ni déversement continu sans conséquence. Elio possède un débit maximal, une quantité limitée qu’il peut manipuler simultanément et une capacité physique limitée à supporter le transfert.

Produire, transférer ou utiliser trop d’énergie le fatigue. Un dépassement important peut provoquer des lésions, atteindre ses fonctions vitales et le tuer. Le stockage externe est également limité en capacité, stabilité et restitution : remplir un réservoir pendant plusieurs années ne permet pas de contourner le besoin d’une impulsion stable, simultanée et distribuée.

Le redémarrage du Cœur exige donc plusieurs Porteurs actifs, des réserves, des relais, des voies de distribution, des compétences et une synchronisation collective. Les sept pétales détachés et le centre d’Elio participent à cette convergence sans devenir chacun une source pure. Une fois réparé, le Cœur entretient son fonctionnement sans maintenir Nacre éternellement connectée.
<!-- END:COEUR-002 -->

<!-- BEGIN:FRAGMENT-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"NOYAU-002,COEUR-001"} -->
<a id="fragment-001"></a>
## Centre pur et exactement sept pétales

Chaque véritable noyau primordial possède un centre et exactement sept pétales. Le centre porte la fonction fondamentale du noyau ; les pétales portent notamment sa capacité exploitable, ses réserves et ses niveaux d’éveil ou de maîtrise. Le noyau d’Elio est particulier parce que son centre n’a jamais été corrompu par le Grand Bâillon et conserve sa capacité génératrice.

Elio-source détache exactement ses sept pétales : six sont laissés dans les six grandes régions d’Orthe et le septième est intégré à Nacre. Il conserve son centre pur. Détacher ses pétales ne l’empêche pas de poursuivre les premières réactivations tant que ce centre reste utilisable ; aucun pétale ni bénéficiaire rechargé ne devient un nouveau centre pur.

Les gardiens des fragments ont des responsabilités locales et une puissance renforcée sans être nécessairement chefs d’État. Chaque pétale porte les traces définies dans `FRAGMENT-003`, susceptibles d’exercer une influence subtile sans possession, effacement du libre arbitre ni émotion unique imposée à toute une région.

Le joueur rassemble les six pétales régionaux, Nacre qui transporte le septième, les Porteurs alliés et son propre noyau au centre pur pour retenter la restauration du Cœur. Retirer un pétale peut priver une région de recharge et l’exposer à une attaque ; les habitants peuvent refuser. Il faut aider, discuter et préparer la transition sans faire disparaître ce risque par un remplacement parfait et gratuit.

Elio-source échoue une première fois avant de répartir ses pétales et de multiplier les réactivations. Après la tournée, un deuxième essai plus important attire l’attention de Séveran. Cette structure à deux essais est confirmée.
<!-- END:FRAGMENT-001 -->

<!-- BEGIN:FRAGMENT-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"FRAGMENT-001"} -->
<a id="fragment-002"></a>
## Micro-noyaux entretenus et limités

Les pétales séparés deviennent des sortes de micro-noyaux. Leur réserve énergétique est très inférieure à celle d’un noyau complet ; ils peuvent se stabiliser et recharger les pétales de Porteurs déjà réactivés. Sans centre pur, ils ne peuvent ni créer un nouveau noyau, ni réactiver seuls un Porteur jamais réveillé, ni redémarrer seuls le Cœur d’Orthe.

Ils reçoivent de l’énergie extérieure naturelle ou artificielle, l’utilisent pour maintenir leur stabilité et redistribuent une énergie compatible. Des Porteurs réactivés et des relais régionaux participent à cet entretien. Ils peuvent durer des années, des décennies ou davantage, sans que leur pérennité absolument infinie soit garantie.

L’inertage ultérieur du centre d’Elio-source ne les détruit pas automatiquement. Leur micro-mécanique scientifique exacte reste à développer sans autoriser la duplication spontanée de centres purs.
<!-- END:FRAGMENT-002 -->

<!-- BEGIN:FRAGMENT-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"FRAGMENT-001"} -->
<a id="fragment-003"></a>
## Mémoires et émotions arrêtées au détachement

Chaque pétale détaché contient une empreinte émotionnelle, une trace de la personnalité d’Elio-source à cette période et ses souvenirs jusqu’au moment précis de sa séparation. Il ne connaît aucun événement vécu ensuite.

Les six pétales régionaux reconstituent progressivement et chronologiquement le parcours d’Elio-source : ses pensées, ses relations, ses erreurs, ses espoirs et l’évolution de sa vision du monde. Les informations postérieures à chaque détachement doivent provenir d’un pétale séparé plus tard, d’archives ou de témoins réels.

L’influence sur un gardien peut amplifier certains états ou résonances, mais ne constitue ni une possession, ni un effacement du libre arbitre, ni une émotion unique imposée à une région entière.
<!-- END:FRAGMENT-003 -->

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
<!-- META:{"status":"PROPOSE","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-001,SEVERAN-003,ELIO-POUVOIRS-001"} -->
<a id="temps-002"></a>
## Une invention naissante, une ambition plus grande

Le scientifique veut revoir Lyra et réparer ses erreurs. À Z, il a préparé personnellement une ouverture vers A, moment de leur vie commune ; son prototype ne sait toutefois produire que des ouvertures locales ancrées, pas réécrire l’histoire-source.

Sa capacité exceptionnelle à concevoir cette technologie associe sa maîtrise consciente de Gravité, ses intuitions Spatial anciennes et inconscientes, ses compétences scientifiques réelles et les recherches collectives auxquelles il accède. Spatial l’aide à imaginer certaines structures, mais ne lui confère aucun voyage temporel inné.

Les essais ont porté sur des volumes réduits, des objets, des instruments et le retour de sondes. Une intrusion puis une extraction humaine n’ont pas encore été validées en conditions sûres. Séveran accepte ce risque parce qu’il dispose d’un instrument de capture, d’une protection de retour et d’une cible précise.

Le dossier ne doit pas promettre qu’une vraie réécriture deviendra forcément possible avec davantage de recherche. Au moment de son dernier message, le scientifique peut admettre que sa première ambition était peut-être impossible ou moralement dangereuse. L’Elio joué termine l’histoire avec un sauvetage limité, pas avec un pouvoir de refaire toute réalité.

Elio ignore que Séveran va arriver. La prise du laboratoire peut être préparée à partir de traces, d’espionnage ou de travaux antérieurs, mais l’antagoniste ne choisit pas providentiellement A après coup : il détourne la destination déjà programmée.
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
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"IA-001,IA-003,IA-004,FRAGMENT-003,IA-006"} -->
<a id="ia-005"></a>
## Mémoire endommagée et septième pétale inaccessible

L’utilisation de la technologie de localité temporelle pendant le secours surcharge Nacre et endommage ses index et circuits de lecture. Elle garde sa personnalité et ses souvenirs nouveaux, mais perd l’accès à une partie de ses archives historiques et au pétale intégré dans son propre corps.

Au début, Nacre ne se souvient pas qu’elle possède ce septième pétale, ne peut pas accéder à ses souvenirs et ne peut pas lire directement son empreinte. L’Elio joué ignore lui aussi que le dernier fragment est à ses côtés. Les connaissances restantes ne sont pas stockées dans un seul « souvenir du boss » : l’aventure restaure des instruments, des journaux, des relais et des témoignages complémentaires.

Nacre peut constater l’époque, son origine scientifique et l’exécution d’un secours, mais ne possède pas le journal complet de la mort de son créateur. Elle a vu la blessure de Lyra et perdu la télémétrie ; elle ne doit jamais annoncer une mort médicalement confirmée puis révéler qu’elle connaissait la survie depuis le début.

À mesure que les six pétales régionaux résonnent avec l’Elio joué, Nacre reconstruit certains accès mémoriels. Cette restauration progressive clarifie l’histoire d’Elio-source sans transformer Nacre en copie consciente complète de lui.
<!-- END:IA-005 -->

<!-- BEGIN:IA-006 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"FRAGMENT-001,TEMPS-001"} -->
<a id="ia-006"></a>
## Le fragment de Nacre et son transfert final

Nacre possède réellement le septième et dernier pétale détaché du noyau d’Elio-source. Elle voyage avec cette trace sans en avoir conscience au début et sans devenir une copie du scientifique, une connaissance totale de sa vie ou un oracle capable de résoudre l’aventure.

Au dénouement, son corps ou composant temporel dangereux est détruit irréversiblement. Une tentative préparée et consentie préserve son identité et ses souvenirs personnels, puis Nacre revient sous la forme d’un assistant dépourvu de pouvoir temporel. Ce retour ne doit pas être raconté comme la résurrection gratuite d’une IA dont la disparition absolue aurait auparavant été certifiée.

Ses lacunes historiques proviennent des dommages du secours temporel, pas de la collecte d’énergie destinée au Cœur. Le transfert final préserve autant que possible sa personnalité et ses souvenirs personnels ; sa réalisation technique détaillée reste à développer.
<!-- END:IA-006 -->

<!-- BEGIN:IA-007 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"IA-005,IA-006,COEUR-002,FRAGMENT-003"} -->
<a id="ia-007"></a>
## Résonance, dernière mémoire et autonomie du Cœur

Le pétale de Nacre participe avec les six autres au redémarrage distribué du Cœur. La méthode exacte de connexion reste à développer, mais elle ne requiert pas la mort de Nacre avant la dernière fenêtre. Le Cœur réparé devient ensuite autonome, ce qui permet le transfert final et la destruction du composant temporel dangereux sans replonger Orthe dans la panne.

Les pétales ne possèdent que des souvenirs antérieurs ou contemporains à leur séparation. Les informations sur Z viennent de journaux de l’IA, d’essais, de témoins ou d’archives réellement créées à cette date. La surcharge du secours a endommagé les accès de Nacre sans effacer les souvenirs personnels formés pendant l’aventure.

Très tard dans l’histoire, la résonance des six pétales révèle que le dernier fragment manquant se trouve dans Nacre. Sa lecture fournit la dernière pièce du parcours d’Elio-source. Le moment précis et l’interface matérielle de cette révélation peuvent être mis en scène sans changer cette règle.
<!-- END:IA-007 -->

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

<!-- BEGIN:FIN-001 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"TEMPS-001,COUPLE-002"} -->
<a id="fin-001"></a>
## Sauver sans revenir avant la blessure

Après la résolution collective au présent, le groupe reprend la même scène conservée après la blessure et l’extraction initiale. Il est trop tard pour empêcher l’agression, mais Lyra du prologue peut encore être extraite vivante et soignée.

La fermeture consomme l’ancre restante. Le scientifique et Lyra de l’histoire-source restent morts. Le sauvetage de Lyra du prologue n’annule ni le départ d’Elio ni les morts de la guerre. Une nouvelle machine sans cet anneau ne peut pas recommencer la même scène.
<!-- END:FIN-001 -->

<!-- BEGIN:FIN-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"regle","views":"resume","period":"","order":0,"refs":"FIN-001"} -->
<a id="fin-004"></a>
## Moyens proposés de la dernière extraction

Un appareil compatible, un examen direct, une stabilisation biologique et une enveloppe d’extraction médicalisée apporteraient au final ce qui manquait au secours initial de Nacre. Des mesures partielles établiraient auparavant la conservation et une chance de survie sans la garantir.

Lyra récupérerait progressivement après son arrivée dans le présent et ne combattrait pas immédiatement comme si aucune blessure n’avait eu lieu. Les détails médicaux, le lieu de l’anneau et la durée du reliquat restent révisables.
<!-- END:FIN-004 -->

<!-- BEGIN:FIN-002 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"regle","views":"resume","period":"","order":0,"refs":"FIN-001,FIN-003,SEVERAN-002,GRAINE-001,GACHA-003"} -->
<a id="fin-002"></a>
## Victoire et monde après l’histoire

Après le redémarrage du Cœur, les noyaux véritables retrouvent leur fonctionnement narratif complet sans remplacer la tutelle de Séveran par celle d’Elio. Le niveau N1 à N7 de la collection reste séparé de cette restauration mondiale.

Le héros refuse de devenir le propriétaire des Porteurs qu’il a aidés. Le rôle de gardien des passages sous mandat commun reste proposé. Les régions conservent des désaccords, des victimes, des institutions à transformer et des recherches inachevées.

Le couple choisit de poursuivre sa relation après des soins et de vraies conversations sur le secret de Lyra. Nacre garde sa personnalité. Les liens avec les proches de Sélis sont renoués, avec le poids des années écoulées.

Les arcs suivants peuvent explorer les routes planétaires, les conséquences du Concordat, d’autres formes d’instabilité des noyaux, l’histoire des fondateurs et la recherche des capsules perdues. Leurs occupants éventuels peuvent être devenus héros, protecteurs, tyrans, criminels, figures mythologiques ou personnes ordinaires ; aucun nombre de survivants ni destin particulier n’est confirmé. Ces arcs ne réintroduisent pas une ancre parfaite capable d’annuler chaque perte.
<!-- END:FIN-002 -->

<!-- BEGIN:FIN-003 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"resume","period":"","order":0,"refs":"COEUR-001,SEVERAN-001,FIN-001,IA-006"} -->
<a id="fin-003"></a>
## Conclusion collective avant le sauvetage intime

La fin suit cet ordre : conflit autour du redémarrage du Cœur, défaite du projet de tutelle de Séveran, stabilisation d’Orthe, dernière ouverture pour sauver Lyra, début de l’apprentissage Biotique, révélation et lecture du septième pétale de Nacre selon la mise en scène finale, destruction de l’accès temporel avec transfert risqué de Nacre, puis épilogue et retour préparé de Nacre sans pouvoir temporel.

La microchronologie du combat et du redémarrage reste adaptable. En revanche, la victoire collective précède le sauvetage intime, et le combat mené dans le présent n’efface aucun événement de l’histoire-source.
<!-- END:FIN-003 -->

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
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Environ A − 6 040 à A − 6 000 ans","order":3,"refs":"HIST-002"} -->
<a id="evt-003"></a>
## La guerre de la Tutelle

Des catastrophes liées aux pouvoirs et des conflits de représentation débouchent sur une guerre. La Ligue de Séveran prépare le contrôle central des infrastructures ; les oppositions locales restent diverses.
<!-- END:EVT-003 -->

<!-- BEGIN:EVT-004 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Autour du Grand Bâillon, dispersion après le sabotage","order":5,"refs":"GRAINE-001,HIST-003,ELIO-POUVOIRS-001"} -->
<a id="evt-004"></a>
## L’envoi des capsules

Environ cent Porteurs volontaires sont isolés du réseau avant le sabotage, puis leurs capsules sont envoyées et dispersées après le Grand Bâillon. Le nombre exact et les destinations restent à préciser. Elio maîtrise déjà Spatial lorsqu’il entre en stase, même si celle-ci lui fera oublier consciemment cet apprentissage.
<!-- END:EVT-004 -->

<!-- BEGIN:EVT-005 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Environ A − 6 000 ans","order":4,"refs":"HIST-001,HIST-003"} -->
<a id="evt-005"></a>
## Le Grand Bâillon

Séveran provoque l’inhibition générale, perd ses propres capacités actives et tire parti de ses préparatifs matériels. Sa faction consolide le Concordat au nom de la paix. La réparation des noyaux devient ensuite un enjeu central des deux camps.
<!-- END:EVT-005 -->

<!-- BEGIN:EVT-006 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Du Bâillon au réveil sur Sélis","order":6,"refs":"MONDE-002,NOYAU-003,GRAINE-001"} -->
<a id="evt-006"></a>
## L’occupation et la recherche

Orthe connaît des phases de paix contrainte, de révolte et de recomposition ; ce n’est pas une guerre de front identique pendant six millénaires. Les missions de recherche poursuivent les capsules sans parvenir à établir le sort de la plupart d’entre elles. Lyra utilise des moyens de voyage physiques ou des relais, pas des pouvoirs intacts. Le Concordat développe lentement ses réveils forcés.
<!-- END:EVT-006 -->

<!-- BEGIN:EVT-007 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"A − 7 ans","order":7,"refs":"GRAINE-001,GRAINE-002"} -->
<a id="evt-007"></a>
## Le réveil d’Elio

Lyra retrouve sur Sélis la seule capsule dont un survivant sera confirmé pendant l’arc principal. Elio sort de stase, conserve un âge biologique de jeune adulte, a oublié sa maîtrise consciente de Spatial et doit se construire une vie. Après les premiers secours et une observation distante, Lyra est rappelée sur Orthe.
<!-- END:EVT-007 -->

<!-- BEGIN:EVT-008 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"A − 4 ans","order":8,"refs":"COUPLE-001"} -->
<a id="evt-008"></a>
## La rencontre professionnelle

De retour sur Sélis, Lyra retrouve Elio grâce à sa vie professionnelle et se fait embaucher sous couverture. Ils se rencontrent alors personnellement, travaillent ensemble et deviennent amis. Elio a vécu trois années hors stase depuis son réveil.
<!-- END:EVT-008 -->

<!-- BEGIN:EVT-009 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"A − 2 ans","order":9,"refs":"COUPLE-001"} -->
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

Le scientifique de l’histoire-source découvre comment atteindre Orthe ; Lyra lui a révélé son origine avant leur arrivée. Les habitants reconnaissent son noyau intact et travaillent avec lui. Ses premiers travaux restent clandestins : des communautés l’apprécient sans que le Concordat ait encore identifié personnellement la source pure.
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

Le couple aide les six régions, Elio réactive des Porteurs et détache progressivement un pétale dans chacune d’elles. Il développe Nacre avec des ingénieurs d’Orthe et lui intègre le septième pétale. Les fragments, les relais et les alliés préparent une deuxième tentative ; l’ordre interne des régions et les moyens de discrétion restent à développer.
<!-- END:EVT-012 -->

<!-- BEGIN:EVT-013 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Après la mort de Lyra-source","order":15,"refs":"SEVERAN-001,SEVERAN-003,SEVERAN-004"} -->
<a id="evt-013"></a>
## Le marchandage et la collaboration

Après la mort de Lyra, Elio veut tuer Séveran mais n’en a pas la puissance. Sa sécurité anti-confiscation empêche une prise immédiate du noyau. Séveran lui propose de combiner leurs technologies pour lui permettre de revoir Lyra ; Elio endeuillé accepte cette coopération. Ses modalités, sa durée et le travail précis accompli restent proposés.
<!-- END:EVT-013 -->

<!-- BEGIN:EVT-014 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"evenement","views":"timeline","period":"Deuxième essai, avant la collaboration","order":14,"refs":"COUPLE-002,SEVERAN-003,COEUR-001"} -->
<a id="evt-014"></a>
## La perte de l’histoire-source

Après la tournée, Elio et ses alliés tentent une restauration plus importante du Cœur. L’opération attire l’attention de Séveran, qui découvre l’existence d’Elio, son centre pur et son potentiel pour la tutelle. Il attaque ; Lyra-source s’interpose et meurt des blessures de l’affrontement, non de la destruction de son noyau.
<!-- END:EVT-014 -->

<!-- BEGIN:EVT-015 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Après la collaboration, jusqu’à Z","order":16,"refs":"TEMPS-002,TEMPS-004,IA-002,SEVERAN-004"} -->
<a id="evt-015"></a>
## La rupture et l’essai préparé vers A

Elio quitte Séveran et retourne secrètement sur Sélis. Il poursuit ses recherches pour revoir Lyra, corrige certaines erreurs et prépare une ouverture vers A, moment de leur vie commune choisi à l’avance. Nacre participe aux essais et possède une routine de secours. Le motif précis de la rupture reste une liaison proposée.
<!-- END:EVT-015 -->

<!-- BEGIN:EVT-016 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Z = A + 14 ans, repère de travail","order":17,"refs":"SEVERAN-003,SEVERAN-004,IA-002,TEMPS-004"} -->
<a id="evt-016"></a>
## L’assaut contre le scientifique

Séveran retrouve Elio au laboratoire de Z. Elio désactive volontairement son centre, puis Séveran le tue par violence physique. Nacre reçoit la dernière consigne ; l’assaillant utilise ensuite le prototype déjà réglé sur A pour tenter de capturer le noyau jeune.
<!-- END:EVT-016 -->

<!-- BEGIN:EVT-017 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"En Z, à l’intérieur de A-fenêtre","order":18,"refs":"IA-003,IA-004,TEMPS-005,SEVERAN-003"} -->
<a id="evt-017"></a>
## Le prologue joué

Séveran entre, Nacre le suit. Lyra s’interpose ; Elio la croit morte et Nacre l’extrait pendant la diversion. Séveran constate la disparition de sa cible et ressort. Il ne voit pas l’extraction et ne possède ensuite aucune preuve de mort, de survie ou de destination. La fenêtre n’est suspendue qu’après son retour ; Lyra demeure à l’intérieur, gravement blessée mais pas définitivement morte.
<!-- END:EVT-017 -->

<!-- BEGIN:EVT-018 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Z, début du parcours joué","order":19,"refs":"TEMPS-004,IA-005,SEVERAN-003"} -->
<a id="evt-018"></a>
## L’arrivée chez ceux qui le connaissent

Nacre et Elio repassent par le laboratoire au présent puis rejoignent le Havre d’Orthe par un relais spatial. Les habitants ont connu le scientifique de l’histoire-source. Elio n’a pas vécu ces années ; la mort du scientifique n’est pas encore publiquement établie. Séveran ignore où sa cible a disparu et ses forces ne disposent d’abord d’aucune piste personnelle certaine.
<!-- END:EVT-018 -->

<!-- BEGIN:EVT-019 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Pendant les six arcs régionaux","order":20,"refs":"IA-004,FRAGMENT-001,FRAGMENT-003,ELIO-POUVOIRS-001,MECHA-001,REG-003,REG-004"} -->
<a id="evt-019"></a>
## La reprise de l’ancre

L’équipe traite les conflits propres aux six régions, négocie le retrait risqué de chaque pétale et prépare des relais de transition sans supprimer tout coût. Le héros apprend d’abord Énergie, retrouve progressivement Gravité grâce aux fragments, puis Spatial après la révélation de son passé ancien. Il apprend aussi Mecha auprès de la culture technologique concernée ; la région et les chapitres exacts de ces étapes restent à placer.

Les six empreintes racontent chronologiquement le parcours d’Elio-source sans connaître les événements postérieurs à leur séparation. L’équipe récupère aussi l’anneau original parmi les équipements impériaux saisis. Les archives datées et les soins acquis donnent un espoir conditionnel pour Lyra, pas une assurance de succès.
<!-- END:EVT-019 -->

<!-- BEGIN:EVT-020 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Après la stabilisation d’Orthe","order":22,"refs":"FIN-001,FIN-003"} -->
<a id="evt-020"></a>
## La dernière ouverture

Avec l’ancre originale, un appareil compatible et une équipe médicale, Elio reprend le même reliquat après la victoire collective. Il est trop tard pour éviter le coup ; une continuité viable permet l’extraction de Lyra. Les soins se poursuivent dans le présent, puis Lyra commence ultérieurement à transmettre Biotique au protagoniste.
<!-- END:EVT-020 -->

<!-- BEGIN:EVT-021 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Convergence au présent d’Orthe","order":21,"refs":"FIN-003,COEUR-001,COEUR-002,SEVERAN-002"} -->
<a id="evt-021"></a>
## Le Cœur et la chute de la tutelle

Les six pétales régionaux, Nacre avec le septième, Elio et les alliés convergent pour redémarrer et stabiliser le Cœur. La coalition affronte le projet de tutelle de Séveran au présent d’Orthe et le défait sans modifier aucun événement antérieur. La microchronologie et la connexion scientifique exacte des pétales restent en partie ouvertes.
<!-- END:EVT-021 -->

<!-- BEGIN:EVT-022 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"evenement","views":"timeline","period":"Après la dernière ouverture","order":23,"refs":"FIN-002,FIN-003,IA-006"} -->
<a id="evt-022"></a>
## Les routes ouvertes

Très tard, la lecture du pétale de Nacre complète la mémoire d’Elio-source sans faire d’elle sa copie. L’accès temporel dangereux et le corps ou composant qui le porte sont ensuite détruits. Après un transfert préparé et risqué, Nacre revient comme assistant sans pouvoir temporel. Le couple se retrouve sans effacer les épreuves ; les survivants réorganisent Orthe et renouent les routes vers les autres planètes, notamment pour rechercher les capsules dont le sort reste inconnu.
<!-- END:EVT-022 -->

# Régions et personnages

<!-- BEGIN:REG-001 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"region","views":"","period":"","order":0,"refs":"NOYAU-002,FRAGMENT-001,FRAGMENT-003,EVT-018"} -->
<a id="reg-001"></a>
## Havre des Traverses : accueil et confiance

Le Havre est un port de refuges et de routes suspendues. Les habitants doivent décider comment accueillir sans épuiser leurs ressources, tandis que le Concordat instrumentalise leurs peurs.

Yselle, responsable humaine des quais, organise la survie avant de croire au héros. Varek, ancien Porteur artisan, devient le premier partenaire d’un réaccord contrôlé. Le héros réussit en écoutant ses sensations, pas en traitant son noyau comme une pièce interchangeable.

Une évacuation et la protection d’un convoi fondent la coopération. Le Collecteur des Routes, automate impérial, menace les passages. Le quartier sauvé devient ensuite un soutien logistique réel.

Apport au fil rouge : premières explications sur l’époque, Nacre et la réputation de l’autre Elio. Apport aux pouvoirs : démonstration limitée d’une activation saine, sans armée restaurée en une journée.

Le Havre entretient le premier des six pétales régionaux, sous une responsabilité locale dont le titulaire et l’influence émotionnelle restent à fixer. Sa mémoire s’arrête au moment de son détachement. Le retirer menace les recharges et les routes protégées : l’équipe doit préparer une transition avec les habitants, pas emporter une clé sans leur accord.
<!-- END:REG-001 -->

<!-- BEGIN:REG-002 -->
<!-- META:{"status":"PROPOSE","origin":"v1","kind":"region","views":"","period":"","order":0,"refs":"HIST-002,IA-005,IA-007,COUPLE-002,FRAGMENT-001,FRAGMENT-003"} -->
<a id="reg-002"></a>
## Palais de Sel : mémoire et responsabilité

Des archives minérales conservent les versions incompatibles d’une guerre. Des falsifications ont fait porter les responsabilités et les réparations aux mauvaises communautés.

Orsane, Porteuse archiviste, a parfois dissimulé la vérité pour éviter de nouveaux massacres. Elle découvre que ce silence permet à la violence de continuer. La solution nécessite des preuves, une protection des témoins et une divulgation responsable.

Le Scribe blanc, instrument de censure, reproduit des attaques enregistrées ; ses projections ne sont pas des personnes temporellement recréées. Les fonctions de lecture de Nacre sont réparées ici.

Un témoin reconnaît Lyra et raconte sa disparition dans l’histoire-source, à une date incompatible avec le prologue. Les documents montrent aussi la collaboration réelle du scientifique avec les institutions de Séveran. Les informations postérieures à la séparation des fragments proviennent d’archives datées et de témoins, jamais de souvenirs futurs apparus dans un pétale ancien.

Le fragment régional soutient la conservation et la lecture de certaines archives. Son retrait peut faire perdre des protections et des accès ; la garde locale doit participer au choix et à la continuité du service.
<!-- END:REG-002 -->

<!-- BEGIN:REG-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"NOYAU-003,IA-004,EVT-019,FRAGMENT-001,FRAGMENT-003"} -->
<a id="reg-003"></a>
## Chantiers de Cendre : autonomie et premiers noyaux forcés

Des villes industrielles dépendent du Concordat pour l’eau, la chaleur et le travail. Détruire brutalement les installations libérerait les ouvriers en les privant de moyens de vivre.

Deme, ingénieure humaine, et Nohé, ancien régulateur Porteur, aident à créer des alimentations indépendantes. Les plans du scientifique expliquent autant les améliorations réelles que les dépendances actuelles.

Un premier combattant au réveil forcé montre le coût humain du programme impérial. L’objectif n’est pas toujours de le tuer ; sécuriser l’installation peut permettre une stabilisation partielle. Le Géant de suie, plateforme de guerre intégrée à une centrale, reste un affrontement majeur proposé.

L’équipe récupère l’anneau témoin dans un transfert de matériel saisi. Cette opération est préparée par des inventaires et des renseignements, pas par un objet trouvé par hasard dans le butin d’un boss. L’anneau est ensuite protégé dans une installation alliée.

Le fragment régional participe aux alimentations que les ouvriers ne peuvent perdre du jour au lendemain. Le rassembler pour le Cœur exige des réserves, des relais et un accord local ; aucune solution parfaite n’efface le risque d’une contre-attaque ou d’une pénurie.
<!-- END:REG-003 -->

<!-- BEGIN:REG-004 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"COUPLE-002,FIN-001,FIN-004,IA-005,FRAGMENT-001,FRAGMENT-003"} -->
<a id="reg-004"></a>
## Jardins du Seuil : soin, deuil et chance limitée

Les Jardins mêlent centres de soins et mémoriaux. Les ressources destinées aux anciens Porteurs entrent en concurrence avec les besoins des humains ordinaires.

Miren, soignant humain, conteste les priorités héritées. Éloa, Porteuse spécialiste de stabilisation biologique, distingue un noyau encore viable d’une personne définitivement perdue. Le Cerf de verre, gardien malade, peut faire l’objet d’une victoire par stabilisation plutôt que destruction.

La tombe et les témoins établissent la mort de Lyra de l’histoire-source. L’analyse de l’anneau retrouvé prouve la conservation d’un reliquat ; une survie reste envisageable, mais le diagnostic à distance ne permet pas de la garantir.

Elio refuse de priver les soins civils de leurs moyens pour accélérer sa tentative personnelle. Il choisit les autres avant d’avoir la certitude que cette décision lui rendra Lyra. L’équipe élabore une extraction médicalisée différente du secours de Nacre au prologue.

Le fragment régional alimente une partie des stabilisations biologiques. Son retrait compromettrait des patients et ne devient acceptable qu’avec une capacité de transition limitée, coûteuse et collectivement décidée.
<!-- END:REG-004 -->

<!-- BEGIN:REG-005 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"GRAINE-002,COUPLE-001,COUPLE-003,REDEMPTION-001,REDEMPTION-002,FRAGMENT-001,FRAGMENT-003"} -->
<a id="reg-005"></a>
## Villes du Contrejour : identité et responsabilité

Une région de registres, de masques civils et de tribunaux protège des persécutés mais peut aussi dissimuler des auteurs de violences. Le Concordat utilise le visage d’Elio pour lui attribuer les actes de sa version-source.

Léandre, enquêteur humain, distingue filiation d’une histoire et culpabilité personnelle. L’enquête expose les capsules, le réveil adulte, les réseaux d’accueil et la couverture de Lyra. Des lettres et des témoins établissent une amitié réelle, sans excuser le secret.

Saren est confronté aux conséquences des réveils forcés. Une stabilisation possible ne suffit pas à faire de lui un allié : sa coopération dépend d’un choix et d’actes de réparation.

Le masque qui imite les habitudes du héros est un dispositif prédictif utilisant des données, pas un nouveau double temporel. L’arc doit éviter de répondre à toute question d’identité par une multiplication de versions.

Le fragment régional est placé sous une responsabilité contestée entre protection des personnes et contrôle des registres. Sa réunion au Cœur exige une décision publique et des garanties contre les représailles du Concordat.
<!-- END:REG-005 -->

<!-- BEGIN:REG-006 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"region","views":"","period":"","order":0,"refs":"SEVERAN-002,TEMPS-004,FIN-002,FRAGMENT-001,FRAGMENT-003"} -->
<a id="reg-006"></a>
## Couronne des Marées et Méridien : avenir partagé

Les routes de l’archipel sont instables. Séveran promet une circulation parfaitement sûre à condition que personne ne puisse utiliser un passage sans son autorisation.

Thyr, navigateur Porteur, connaît les risques mais refuse de confondre sécurité et souveraineté absolue. Les équipes construisent un réseau où les décisions et les compétences peuvent se relayer.

Les derniers journaux établissent le décès du scientifique et son secours. Les plans impériaux révèlent la Matrice de tutelle et l’usage précis prévu pour le noyau intact. La coalition peut alors préparer à la fois le sauvetage et le démantèlement militaire.

Le Méridien reste la capitale technique de Séveran, sur Orthe. L’intrusion initiale dans A a désormais été ouverte depuis Sélis ; ne pas confondre les deux lieux. L’Aiguilleur contrôle des positions et des forces physiques, pas le temps extérieur à une fenêtre.

Le sixième fragment régional soutient les passages de l’archipel. Le retirer expose les routes à une attaque au moment même où la coalition doit converger ; les équipages et sa garde locale organisent donc le risque au lieu de le nier.
<!-- END:REG-006 -->

<!-- BEGIN:PERS-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"distribution","views":"","period":"","order":0,"refs":"NOMS-001,GACHA-001,GACHA-002,MECHA-001,REDEMPTION-001,REDEMPTION-002,POUVOIR-001"} -->
<a id="pers-001"></a>
## Distribution provisoire et accès au jeu

La distribution de la v1.0 reste une réserve de personnages à approfondir. Les rangs et rôles de combat ci-dessous ne fixent ni la dignité ni la catégorie cosmologique d’un Porteur. Les humains ordinaires peuvent devenir jouables grâce à Mecha sans recevoir de noyau divin ; l’équipement précis de chacun et la région d’origine de cette technologie ne sont pas décidés ici.

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

Elio arrive au Havre. Certains habitants reconnaissent son visage, d’autres doutent devant son manque d’expérience. Nacre établit le décalage d’époque et dit avoir été créée par le scientifique connu ici. Séveran n’engage pas encore de traque personnelle : il ignore si Elio a survécu, où il a disparu et par quel moyen.

Mise en scène et garde-fous : Le mystère porte sur ce que cet autre Elio a fait, pas sur une date que tout le monde pourrait donner. Sa mort n’est pas encore prouvée aux habitants.
<!-- END:CH-01 -->

<!-- BEGIN:CH-02 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 2","order":2,"refs":"REG-001,NOYAU-002,NOYAU-005,GACHA-001,ELIO-POUVOIRS-001"} -->
<a id="ch-02"></a>
## Le prix d’un refuge

Le héros protège une évacuation et réalise avec Varek le premier rituel de réactivation consciente. Il apprend parallèlement à maîtriser Énergie, premier pouvoir actif de sa continuité jouée. Yselle accorde sa confiance à des actes concrets. Le pétale du Havre recharge ensuite le bénéficiaire ; une première équipe se forme sans imposer de tirage rare pour avancer.

Mise en scène et garde-fous : Montrer le consentement et le rôle indispensable du bénéficiaire. La victoire permet de mieux vivre au Havre, pas seulement d’obtenir une clé de scénario.
<!-- END:CH-02 -->

<!-- BEGIN:CH-03 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 3","order":3,"refs":"REG-002,COUPLE-002,FRAGMENT-003"} -->
<a id="ch-03"></a>
## Les absents ont une voix

Aux Palais de Sel, les récits d’une guerre se contredisent. Le deuxième pétale livre une tranche de mémoire postérieure à la première sans connaître la suite. Un témoin reconnaît Lyra et rapporte sa mort lors de l’attaque de Séveran contre le deuxième essai du Cœur, après A-source. Les dates incompatibles troublent Elio.

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

Aux Chantiers, une opération de résistance menace l’alimentation des quartiers. Un combattant réactivé par le Concordat révèle une puissance impressionnante et un état instable.

Mise en scène et garde-fous : Le premier diagnostic sépare volonté, contrainte politique et dégradation du noyau. Couper l’empire sans préparer une solution tuerait des habitants.
<!-- END:CH-05 -->

<!-- BEGIN:CH-06 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 6","order":6,"refs":"REG-003,EVT-019,REDEMPTION-001,ELIO-POUVOIRS-001"} -->
<a id="ch-06"></a>
## Ce qu’on ne rachète pas

Des alimentations indépendantes rendent possible une libération locale et le retrait risqué du troisième pétale. Ses traces rapprochent Elio de la maîtrise Gravité de son autre parcours. Une opération documentée récupère l’anneau original. Une stabilisation d’urgence d’un adversaire démontre qu’une autre réponse est envisageable.

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

Au Contrejour, la propagande lui attribue les actes de l’autre Elio. L’enquête retrouve les traces des capsules, du réveil adulte et des humains qui l’ont aidé à s’intégrer. Un très ancien habitant ayant connu Elio avant sa stase révèle sa maîtrise originelle de Spatial ; la résonance des pétales lui permet de commencer à la retrouver consciemment.

Mise en scène et garde-fous : Les trous de mémoire de stase sont corroborés, pas comblés d’un seul coup par une révélation magique. L’exception de son noyau a une cause matérielle.
<!-- END:CH-09 -->

<!-- BEGIN:CH-10 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 10","order":10,"refs":"NOMS-001,COUPLE-001,COUPLE-003,REDEMPTION-001,REDEMPTION-002"} -->
<a id="ch-10"></a>
## L’envoyée qui a choisi

Le parcours de Lyra apparaît : découverte, rappel, retour, couverture professionnelle, amitié puis amour. Elio n’a pas réactivé son noyau par simple proximité avant A. Saren stabilisé doit choisir ce qu’il fait des informations sur le programme qui l’a abîmé ; la décision locale autour du cinquième fragment accompagne ce choix.

Mise en scène et garde-fous : Les flashbacks montrent des moments adultes réels. Le titre devient « L’envoyé qui a choisi » dans le point de vue Lyra ; les rôles s’inversent partout.
<!-- END:CH-10 -->

<!-- BEGIN:CH-11 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 11","order":11,"refs":"REG-006,FIN-002"} -->
<a id="ch-11"></a>
## Un demain sans garanties

À la Couronne, les régions préparent une circulation partagée et le retrait défendu du sixième fragment. Thyr et ses équipages protègent les routes pendant que les six apports convergent sans dépendre d’un maître unique.

Mise en scène et garde-fous : Les relais et les régulateurs construits permettent autant l’autonomie d’Orthe que le futur sauvetage. Pas d’arrêt du temps cosmique pour faciliter une scène.
<!-- END:CH-11 -->

<!-- BEGIN:CH-12 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 12","order":12,"refs":"SEVERAN-002,SEVERAN-003,IA-002,TEMPS-004"} -->
<a id="ch-12"></a>
## Celui qui a refusé trop tard

Les archives montrent la prise du laboratoire de Z, la désactivation volontaire du centre d’Elio-source, son assassinat physique et sa dernière consigne à Nacre. Elles établissent que l’essai vers A avait été préparé par Elio avant que Séveran détourne sa destination. La Matrice de tutelle proposée donne un sens précis au raid.

Mise en scène et garde-fous : Révéler l’usage du noyau, pas seulement annoncer qu’il est très puissant. La réparation tardive du scientifique n’efface pas les victimes de ses compromis.
<!-- END:CH-12 -->

<!-- BEGIN:CH-13 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 13","order":13,"refs":"FIN-002,REDEMPTION-001,GACHA-001,ELIO-POUVOIRS-001,MECHA-001"} -->
<a id="ch-13"></a>
## L’empire à hauteur d’homme

La coalition rassemble les six pétales régionaux, Nacre, Elio et les alliés sans exiger la possession gacha de tous les gardiens. Avant cette convergence, Elio a aussi appris Mecha auprès de la culture technologique concernée ; sa région et son chapitre d’introduction restent à placer. L’équipe protège les populations, prépare le redémarrage du Cœur et garde l’anneau sous protection pour l’étape suivante. Saren peut agir pour réparer ses fautes.

Mise en scène et garde-fous : Distinguer prendre une infrastructure et obtenir l’obéissance d’une région. Tous les moyens indispensables sont accessibles par le récit.
<!-- END:CH-13 -->

<!-- BEGIN:CH-14 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 14","order":14,"refs":"SEVERAN-002,FIN-003,COEUR-001"} -->
<a id="ch-14"></a>
## Le droit de ne pas recommencer

La coalition redémarre et stabilise le Cœur, puis affronte Séveran au présent d’Orthe et défait son projet de tutelle. L’Elio joué refuse la place de référence captive centrale, même présentée comme un moyen rapide de tout réparer.

Mise en scène et garde-fous : La victoire doit protéger les fonctions vitales et les victimes des réveils forcés. L’ennemi n’est pas vaincu dans un passé qui annulerait son propre raid.
<!-- END:CH-14 -->

<!-- BEGIN:CH-15 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 15","order":15,"refs":"FIN-001,FIN-004,TEMPS-003,IA-004,FIN-003"} -->
<a id="ch-15"></a>
## La dernière fenêtre

Après la victoire collective, la même fenêtre reprend après le retour de Séveran. Elio voit qu’il ne peut plus empêcher l’agression, mais un examen direct révèle une continuité vitale. L’équipe stabilise Lyra, la ramène puis poursuit ses soins.

Mise en scène et garde-fous : Montrer la différence entre « trop tard pour éviter la blessure » et « trop tard pour sauver ». L’anneau est consommé ; personne ne revient au début de la scène.
<!-- END:CH-15 -->

<!-- BEGIN:CH-16 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 16","order":16,"refs":"GRAINE-002,COUPLE-001,FIN-001,IA-005,IA-006,IA-007,ELIO-POUVOIRS-001"} -->
<a id="ch-16"></a>
## Ceux qui restent

Après le sauvetage, Lyra récupère et commence ultérieurement à transmettre Biotique au protagoniste. La résonance finale révèle puis permet de lire le septième pétale intégré à Nacre, dernière pièce de la mémoire d’Elio-source. Nacre consent ensuite au renoncement temporel : son composant dangereux est détruit et un transfert préparé tente de préserver son identité et ses souvenirs dans un assistant sans pouvoir temporel. Le couple affronte les secrets et décide de la suite.

Mise en scène et garde-fous : Ne pas annoncer une mort absolument définitive de Nacre avant son transfert. Remplacer la famille adoptive de la v1.0 par les amis, mentors et collègues réellement définis dans cette version. Aucune guérison instantanée ne gomme les conséquences.
<!-- END:CH-16 -->

<!-- BEGIN:CH-17 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"chapitre","views":"","period":"Chapitre 17","order":17,"refs":"FIN-002,GRAINE-001,ELIO-POUVOIRS-001"} -->
<a id="ch-17"></a>
## Les routes ouvertes

Nacre revient comme assistant ordinaire, sans technologie temporelle. Les passages s’ouvrent, la recherche se partage et les régions continuent de vivre avec leurs désaccords. Le groupe peut voyager vers d’autres planètes du même univers et rechercher les capsules dont aucun destin collectif n’a été confirmé.

Mise en scène et garde-fous : Les occupants éventuels ne forment pas une réserve uniforme d’alliés ; ils peuvent avoir connu des destins très différents. Le post-game n’introduit pas d’ancre de remplacement permettant de refaire toute perte.
<!-- END:CH-17 -->

# Audits

<!-- BEGIN:AUDIT-001 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"audit","views":"","period":"","order":0,"refs":"TEMPS-001,TEMPS-003,IA-004,FIN-001,FIN-003,ELIO-POUVOIRS-001"} -->
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
| Spatial permet-il à Elio de voyager naturellement dans le temps ? | Non. Ses intuitions spatiales aident sa recherche, mais la fenêtre exige une invention collective, une machine et une ancre. |
| Pourquoi la défaite de Séveran ne supprime-t-elle pas l’aventure ? | Elle survient au présent après son raid, sans réécriture rétroactive. |
| Pourquoi ne pas suspendre un adversaire partout ailleurs ? | La suspension ne concerne que le reliquat de l’enceinte liée à l’ancre. |

Ces réponses sont des règles de fiction choisies, pas une démonstration scientifique. Elles règlent les contradictions recensées ici sans garantir que toute scène future sera automatiquement cohérente.
<!-- END:AUDIT-001 -->

<!-- BEGIN:AUDIT-002 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"audit","views":"","period":"","order":0,"refs":"SEVERAN-002,SEVERAN-003,SEVERAN-004,IA-003,IA-004,IA-006,FRAGMENT-001,FRAGMENT-002,COEUR-002"} -->
<a id="audit-002"></a>
## Audit des motivations et des moyens

Le noyau doit avoir une utilité précise, chaque secours doit avoir des moyens concrets et aucun personnage ne doit oublier une solution évidente uniquement pour prolonger l’intrigue.

| Objection | Réponse ou point de vigilance |
|---|---|
| Pourquoi Séveran perd-il volontairement ses pouvoirs ? | Sa faction a préparé une supériorité matérielle et accepte le désarmement commun pour capturer les infrastructures. |
| Pourquoi tous ses officiers ne dominent-ils pas déjà Orthe ? | Les réveils forcés sont rares, instables, coûteux et exigeants en maintenance. |
| Pourquoi le noyau intact change-t-il la situation ? | Il peut stabiliser les réveils sélectionnés via la Matrice au lieu de forcer des noyaux sans référence saine. |
| Pourquoi ne pas utiliser une archive du noyau ? | Elle ne reproduit pas les réponses vivantes nécessaires aux corrections successives. |
| Pourquoi ne pas voler l’organe avant Z ? | Elio menace de désactiver son centre et sa collaboration est utile ; Séveran lui promet une voie pour revoir Lyra. Les détails de cette sécurité restent proposés. |
| Pourquoi tuer le scientifique au lieu de le capturer ? | Elio désactive volontairement son centre ; Séveran le tue ensuite par violence. La perte du noyau n’est pas elle-même mortelle. |
| Pourquoi le retour temporel n’efface-t-il pas ses erreurs ? | Le prototype n’a jamais atteint l’ambition de réécriture de son créateur. |
| Pourquoi Nacre ne peut-elle pas sauver deux personnes ? | Secours calibré pour un noyau sain, énergie limitée et absence de stabilisation médicale du partenaire blessé. |
| Séveran sait-il si le jeune Elio est mort ? | Non. Il ne voit pas l’extraction et reste sans preuve de mort, de survie ou de destination. |
| Pourquoi garde-t-il un anneau apparemment en panne ? | C’est un vestige de recherche irremplaçable. Son mode dormant n’est pas exploitable avec ses seules commandes. La coalition le récupère ensuite. |
| Pourquoi ne capture-t-il pas immédiatement Elio sur Orthe ? | Il ignore sa destination et ne possède aucune piste personnelle certaine ; ses forces poursuivent néanmoins leurs opérations et peuvent ensuite découvrir des indices. |
| Pourquoi ne gagne-t-il pas aussitôt avec le noyau volé ? | La Matrice demande des installations, des sujets compatibles, du temps et des opérations successives. |
| Pourquoi Elio inépuisable ne redémarre-t-il pas seul le Cœur ? | Sa production durable ne supprime ni débit maximal, ni fatigue et lésions, ni limites du stockage, ni synchronisation distribuée. |
| Pourquoi retirer les fragments est-il un choix ? | Chaque région perd temporairement une recharge ou une fonction et s’expose à une attaque ; les transitions réduisent le risque sans l’annuler. |
| L’inertage d’Elio détruit-il Nacre et les relais ? | Non. Les pétales séparés sont des micro-noyaux entretenus qui survivent indépendamment du centre, sans devenir des sources pures. |

La perte du scientifique, le mode de conservation et le vol de l’anneau restent les trois scènes techniques à storyboarder en priorité. Elles ne doivent pas dépendre d’une incapacité arbitraire des antagonistes.
<!-- END:AUDIT-002 -->

<!-- BEGIN:AUDIT-003 -->
<!-- META:{"status":"PROPOSE","origin":"assistant","kind":"audit","views":"","period":"","order":0,"refs":"NOMS-001,GRAINE-002,REDEMPTION-001,GACHA-001,GACHA-002,GACHA-003,POUVOIR-001,ELIO-POUVOIRS-001,MECHA-001,FIN-001"} -->
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
| Les humains jouables reçoivent implicitement un noyau divin. | Ils utilisent Mecha et un noyau artificiel à sept modules, jamais une cinquième catégorie divine. |
| Un doublon fabrique une nouvelle personne. | N1 à N7 éveille les sept pétales ou modules du même personnage ; il n’existe ni N0 ni sept copies narratives. |
| Le Cœur restauré transforme automatiquement la box en N7. | Le plein fonctionnement narratif des noyaux et le niveau de collection sont deux états explicitement séparés. |
| La coalition exige tous les personnages rares. | Les alliés et moyens indispensables sont fournis par la campagne ; le gacha ne verrouille ni la victoire ni le sauvetage. |
| Lyra a façonné l’enfance de son futur partenaire. | Cette version propose un réveil adulte et une relation personnelle beaucoup plus tardive, sans éducation parentale. |
| La couverture rend tous les sentiments faux. | Montrer la mission, les mensonges et les choix réels sans imposer un pardon automatique. |
| Les noms ne s’inversent plus quand Lyra est jouée. | Appliquer la table des rôles à l’origine, la mission, les morts-source, l’IA et le sauvetage. |
| Le jeune héros a une famille adoptive malgré le changement d’origine. | Les proches de Sélis sont désormais ceux qu’il rencontre après son réveil adulte. |
| Le partenaire revient sans conséquences. | Prévoir des soins, une convalescence et des échanges sur les secrets. |

Un changement de statut dans ce dossier ne met à jour ni les sauvegardes du jeu ni les scripts de gacha. Cette livraison est exclusivement narrative et documentaire.
<!-- END:AUDIT-003 -->

# Arbitrages et décisions clôturées

<!-- BEGIN:Q-001 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"GRAINE-002,EVT-004,EVT-007"} -->
<a id="q-001"></a>
## Âge du réveil et mémoire de stase

Le réveil adulte et l’étendue de l’amnésie autobiographique restent proposés pour rendre possible une vie autonome sur Sélis sans révéler immédiatement Orthe. L’oubli conscient de Spatial est confirmé ; il reste à décider quels autres souvenirs fragmentaires concrets Elio conserve de son monde.
<!-- END:Q-001 -->

<!-- BEGIN:Q-002 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"COUPLE-002,EVT-014,CH-07"} -->
<a id="q-002"></a>
## Question historique clôturée : mort de Lyra-source

Lyra-source meurt désormais pendant l’attaque de Séveran contre la tentative de restauration du Cœur, en s’interposant pour Elio. Elle succombe aux blessures physiques de l’affrontement et non à la disparition de son noyau. Les détails de la blessure restent à développer, mais l’ancienne variante de l’évacuation et de l’autodestruction du noyau est écartée.
<!-- END:Q-002 -->

<!-- BEGIN:Q-003 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"COUPLE-001,COUPLE-003,HIST-002,CH-10"} -->
<a id="q-003"></a>
## La rupture de Lyra avec sa mission

La couverture professionnelle vient de l’auteur ; la démission avant la relation amoureuse reste une solution proposée. Préciser ses supérieurs, la mission exacte et le prix de sa désobéissance permettra de rendre ce choix personnel plutôt que purement administratif.
<!-- END:Q-003 -->

<!-- BEGIN:Q-004 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"TEMPS-004,TEMPS-005,IA-003,IA-004,CH-15"} -->
<a id="q-004"></a>
## Minutage et géographie du secours

Le trajet, le mode de conservation et les positions des personnages doivent être vérifiés ensemble au storyboard. Les secondes proposées ne sont pas figées ; déplacer le retour de Séveran oblige à recalculer le reliquat et l’état de Lyra.
<!-- END:Q-004 -->

<!-- BEGIN:Q-005 -->
<!-- META:{"status":"OUVERT","origin":"assistant","kind":"question","views":"","period":"","order":0,"refs":"HIST-002,HIST-003,NOYAU-004,GRAINE-001"} -->
<a id="q-005"></a>
## Histoire ancienne et échelle des pouvoirs

Les noms des coalitions, les dates millénaires, le détail du registre des noyaux et les conditions de formation de nouveaux noyaux restent des propositions. Le nombre de capsules effectivement survivantes demeure inconnu. D’éventuels occupants retrouvés peuvent posséder leur noyau primordial intact ; cela ne permet toujours pas d’en fabriquer de nouveaux ni d’en transmettre un automatiquement par descendance.
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

Les personnages et rangs de la v1.0 sont maintenus comme maquette. Les étapes de Saren, les séquelles possibles, le mode de recrutement gratuit du partenaire, les taux, coûts, garanties et bannières restent à préciser. Les règles générales concernant humains Mecha, N1 à N7 et personnages déjà réactivés sont désormais confirmées.
<!-- END:Q-007 -->

<!-- BEGIN:Q-008 -->
<!-- META:{"status":"OUVERT","origin":"utilisateur","kind":"question","views":"","period":"","order":0,"refs":"MECHA-001,PERS-001,ELIO-POUVOIRS-001"} -->
<a id="q-008"></a>
## Région d’origine et diffusion de Mecha

La discipline Mecha est confirmée et répandue dans Orthe, mais sa région d’origine, ses institutions fondatrices et le chapitre exact où le protagoniste l’apprend restent à choisir. Les personnages humains qui l’emploient précisément ne sont pas tous attribués.
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

Les fonctions, limites et besoins d’entretien des pétales sont confirmés. Leur support matériel exact, les échanges énergétiques fins, leur vieillissement et la méthode de connexion au Cœur restent à développer sans créer de centre pur ni permettre une première réactivation autonome.
<!-- END:Q-011 -->

<!-- BEGIN:AUDIT-Q24 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"FRAGMENT-001,FRAGMENT-002,COEUR-002"} -->
<a id="audit-q24"></a>
## Q24 — Décision clôturée : énergie renouvelable mais débit limité

Le centre pur produit ou renouvelle indéfiniment son énergie dans la durée, mais Elio conserve un débit, une manipulation simultanée et une endurance limités. L’excès le fatigue, peut le blesser ou le tuer. Le stockage externe ne contourne ni ses propres limites ni le besoin d’une restitution simultanée et synchronisée. Les pétales ne prolifèrent pas en nouveaux centres purs.
<!-- END:AUDIT-Q24 -->

<!-- BEGIN:AUDIT-Q25 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"FRAGMENT-001,FRAGMENT-002,IA-006"} -->
<a id="audit-q25"></a>
## Q25 — Décision clôturée : entretien des pétales séparés

Les pétales séparés deviennent des micro-noyaux dotés d’une faible réserve, capables de stabiliser et recharger des Porteurs déjà réactivés. Ils vivent d’apports naturels ou artificiels et de l’entretien des relais et Porteurs. Ils peuvent durer très longtemps sans garantie d’éternité, ne réactivent aucun nouveau Porteur et ne redémarrent pas seuls le Cœur.
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

Elio maîtrisait Spatial avant sa stase, l’a oublié, puis l’Elio-source a appris Gravité. L’Elio joué apprend Énergie, retrouve Gravité puis Spatial grâce aux pétales, apprend Mecha et reçoit plus tard l’enseignement Biotique de Lyra. Cette exception vient de sa capacité à reconstruire ses apprentissages ; elle ne lui permet normalement d’activer qu’une discipline à la fois et s’inverse avec les rôles dans le scénario miroir.
<!-- END:AUDIT-Q27 -->

<!-- BEGIN:AUDIT-Q28 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"EVT-011,EVT-023,EVT-012,EVT-014,EVT-013"} -->
<a id="audit-q28"></a>
## Q28 — Décision clôturée : deux essais du Cœur

La trame comprend deux essais : premier échec faute de puissance distribuée, tournée des six régions, réactivations, détachement des sept pétales et création de Nacre, puis deuxième essai coordonné. Ce dernier révèle Elio à Séveran, provoque l’attaque et la mort physique de Lyra-source, puis le marchandage et la coopération. Les dates absolues et l’ordre interne des régions restent à préciser.
<!-- END:AUDIT-Q28 -->

<!-- BEGIN:AUDIT-Q29 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"SEVERAN-003,SEVERAN-004,IA-003"} -->
<a id="audit-q29"></a>
## Q29 — Décision clôturée : incertitude de Séveran

Séveran ne croit pas l’Elio joué mort avec certitude. Il voit sa cible disparaître, ne voit pas Nacre l’extraire et ne possède aucune preuve de mort, de survie ou de destination. Faute de piste personnelle certaine, il ne lance pas immédiatement une chasse ciblée, tandis que le Concordat poursuit ses opérations ordinaires sur Orthe.
<!-- END:AUDIT-Q29 -->

<!-- BEGIN:AUDIT-Q30 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"IA-005,IA-006,IA-007,COEUR-002,FRAGMENT-003"} -->
<a id="audit-q30"></a>
## Q30 — Décision clôturée : septième pétale et mémoire de Nacre

Nacre contient le septième pétale sans s’en souvenir ni pouvoir initialement le lire, à cause des dommages du secours temporel. La résonance des six pétales régionaux restaure progressivement ses accès ; la lecture tardive du dernier pétale complète le parcours d’Elio-source. Il participe au redémarrage distribué du Cœur sans exiger la mort de Nacre, et le Cœur devient ensuite autonome.
<!-- END:AUDIT-Q30 -->

<!-- BEGIN:AUDIT-Q31 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"COEUR-001,COEUR-002,GACHA-002,GACHA-003,FIN-002"} -->
<a id="audit-q31"></a>
## Q31 — Décision clôturée : plein fonctionnement narratif

Le Cœur restauré rend aux véritables noyaux leur fonctionnement complet, équivalent narratif à sept pétales actifs. Cette restauration du monde ne change pas la box : un personnage N2 reste mécaniquement N2 et la progression de collection N1 à N7 continue selon les règles du jeu.
<!-- END:AUDIT-Q31 -->

<!-- BEGIN:AUDIT-Q32 -->
<!-- META:{"status":"CONFIRME","origin":"utilisateur","kind":"regle","views":"","period":"","order":0,"refs":"GACHA-001,GACHA-002,MECHA-001,PERS-001"} -->
<a id="audit-q32"></a>
## Q32 — Décision clôturée : Porteurs et humains Mecha jouables

Les Porteurs et les humains équipés de Mecha deviennent jouables après une vraie rencontre et une coopération crédible. Leur premier pull donne N1, puis les obtentions éveillent les sept pétales divins ou modules artificiels jusqu’à N7 sans créer de copies narratives. Aucun noyau divin n’est inventé pour les humains et la coalition finale reste accessible sans tous les personnages rares.
<!-- END:AUDIT-Q32 -->
