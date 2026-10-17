# Boutique post-V1 : Stella Fortuna — R1105

Décision économique explicite du mandat17/10/2026, lotE. Qualification et livraison réelles au Master.

## Contrat

Une Masterless Stella Fortuna existante coûte exactement50000000Moras, achat unitaire répétable sans quota quotidien inventé. Le catalogue fait autorité ; serveur refuse quantité≠1 et solde insuffisant. L’ancien article primogem-bundle reste lié à tous ses achats et snapshots, masqué/désactivé par migration086 ; nouvelle définition stable79000000-0000-4000-8000-000000000004. Aucun historique converti, aucun nouveau ResourceKey.

PrismaShopStore réutilise son verrouPlayer et sa transaction SERIALIZABLE : BusinessOperation, débitMoras moteuréconomique, creditMasterlessStellaFortuna (PlayerItem/ItemAcquisition), ShopPurchase et clôtureCOMPLETED atomiques. Même clé+source+demande relit le reçu avant visibilité/disponibilité de l’article ; autre demande mêmeclé refuse. Le replay retourne le prix/reçu et wallet historique, plus les projections courantes dont stellaQuantity pour éviter un ancien stock. Une panne après crédit mais avant commit annule tout.

!shop stella appelle PurchaseShopItem partagé UI/Chat/Twitch. !shop/help/catalogue décrivent Stella, nouveaux !shop primos refusés même face à un catalogue obsolète. Un intent ancien déjà confirmé conserve targetId/quantité et reçu exact ; les preuves existantes ne sont pas supprimées. Ticket/Défi restent inchangés. Les refresh Chat incluent Box/Sac ; la réponse UI met à jour les caches avec le stock serveur sans requête secondaire pouvant transformer un succès en échec.

## UI et qualification

Carte unitaire Renforcement, prix du catalogue, bouton existant, historique et confirmation d’objet dédiés ; aucun modal Ticket pour Stella. Le conteneur de scroll demeure shop-scroll-body ; le résultat Stella peut revenir à la ligne pour être entièrement lisible. Rendu GameShell/CSSproduction aux1920×1080,1366×768,390×844,390×600, avant/après achat synthétique local ; aucun joueur réel muté. Captures locales ignorées local-data/shop-feedback-qa/stella-*.png.

PostgreSQL privé : migration intégrale086, sixscénarios achat/retry/concurrence/idempotence/stock/ancienreçu. SuitehistoriqueBoutique11scénarios dans un catalogue privé antérieur explicitement reconstruit, Ticket inchangé. UI45 et backendciblé313PASS. Premier testUI a omis le reçu dans recentPurchases de sa réponse simulée : fixture corrigée, pas de contournement métier. Voir [preuve](evidence/post-v1-shop-stella.json). Migration publique et review/déploiement ne sont pas déduits de ces tests.
