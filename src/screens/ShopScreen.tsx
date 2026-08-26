import { useState } from 'react'
import { shopCategories, shopItems } from '../data/mockData'

function ShopScreen() {
  const [activeCategory, setActiveCategory] = useState(shopCategories[0].id)

  return (
    <div className="screen-content shop-screen">
      <nav className="shop-tabs panel" aria-label="Catégories de la boutique">
        {shopCategories.map((category) => (
          <button
            type="button"
            className={activeCategory === category.id ? 'active' : ''}
            onClick={() => setActiveCategory(category.id)}
            key={category.id}
          >
            <span aria-hidden="true">{category.icon}</span>{category.label}
          </button>
        ))}
      </nav>

      <section className="shop-featured panel">
        <div>
          <span className="eyebrow">Sélection du jour</span>
          <h2>Ressources du voyageur</h2>
          <p>Des échanges fictifs pensés pour présenter la future organisation de la boutique.</p>
        </div>
        <span className="shop-featured-symbol" aria-hidden="true">✦</span>
      </section>

      <section className="shop-grid">
        {shopItems.map((item) => (
          <article className={`shop-item panel ${item.tone}`} key={item.name}>
            <div className="shop-item-art" aria-hidden="true"><span>{item.icon}</span></div>
            <div className="shop-item-copy">
              <span className="shop-tag">Échange fictif</span>
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
            </div>
            <div className="shop-item-footer">
              <strong><span>{item.currency}</span> {item.cost}</strong>
              <button type="button">Aperçu</button>
            </div>
          </article>
        ))}
      </section>

      <section className="shop-disclaimer panel">
        <span aria-hidden="true">ⓘ</span>
        <p>Prototype visuel uniquement : aucune transaction, monnaie réelle ou logique d’économie n’est active.</p>
      </section>
    </div>
  )
}

export default ShopScreen
