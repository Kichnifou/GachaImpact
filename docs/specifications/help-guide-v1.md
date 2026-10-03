# Aide / Guide standalone — R1026

Source canonique de la fenêtre Aide, distincte du [Tutoriel](tutorial-v1.md) et du [Help textuel R728–R731](../legacy/23-help-command-coherence-audit.md). État courant au [Master](../master/PROJECT_MASTER_PLAN.md).

Livraison : Aide et Help R1026 promus techniquement sur main après review indépendante favorable sur adb1f510, avec le Menu à 23 IDs. Les validations publiques Menu/Aide reçues sont conservées dans leur périmètre au Master, sans les étendre à tout le Help. L'état courant de l'étape 28 et la prochaine action appartiennent au Master.

Menu > Aide ouvre un portal sur document.body avec le pattern floating-panel et useModalDialog. Fermeture ×/Escape, focus borné et retour au bouton Menu. L’action help n’est pas un ScreenId/hash et ne crée pas de chapitre Tutoriel. navigation_menu_v1 reste version 1, avec 23 IDs et neuf destinations/page ; Configuration conserve masquage et réordonnancement.

Header, recherche, navigation et footer sont fixes. .help-guide-body possède le seul overflow-y:auto ; desktop au plus 1080×800, borné au viewport, navigation horizontale compacte sur mobile. AppButton et ModalCloseButton communs conservent leurs états focus/disabled et leur apparence sombre.

Démarrage présente élément, Accueil, Quotidiennes, Invocation, Box/Équipe, Sac/Banque/Boutique, Social, Événements et Tutoriel. Systèmes contient huit cartes fonctionnelles avec leurs points d’entrée réels. Commandes reprend seulement les 32 racines PLAYER/READY du Chat interne dans chat-command-metadata.ts ; Twitch sépare !wish et !giveaway stats, Faveur/subscriptions et Gift Suprême/récompense de chaîne. Aucun Admin, !xp, !gift, !subscription ou !mp joueur inventé.

La recherche locale normalise casse et accents et parcourt titres, descriptions, accès, catégories, racines et syntaxes ; elle couvre toutes les rubriques, avec un état vide honnête. Aucune API Help, copie de logique métier, prix/taux/formule ou donnée secrète. Le registre de présentation pur est compilé côté serveur et Vite ; le dispatcher et le Help texte consomment la même autorité de canaux/syntaxes/résumés.

Le bouton Lancer le Tutoriel reste un lancement manuel et utilise le même launchTutorial de GameShell que Menu > Tutoriel. La garde d’action/présentation en cours précède toute lecture/écriture Tutoriel ; le refus reste visible dans l’Aide. Une réussite ferme l’Aide puis lance le contrôleur existant. R1033 gère séparément l'unique autostart rétroactif par Player ; consulter l'Aide ne le déclenche pas elle-même. Aucun appel de mutation de gameplay.

Les contrôles du candidat adb1f510, conservés sans relance dans la promotion, sont consignés au Master : navigateur réel/CSS production aux quatre formats, recherche/rubriques/scroll/focus, sauvegarde Menu, lancement normal/refus pending, et tests de non-régression. Ils ne constituent pas une validation publique.
