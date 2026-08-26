import { useState } from 'react'
import { inventoryCategories } from '../data/mockData'

function InventoryScreen() {
  const [activeCategory, setActiveCategory] = useState(inventoryCategories[0].id)
  const category = inventoryCategories.find((item) => item.id === activeCategory) ?? inventoryCategories[0]

  return (
    <div className="screen-content inventory-screen">
      <div className="inventory-layout">
        <nav className="inventory-categories panel" aria-label="Catégories du sac">
          {inventoryCategories.map((item) => (
            <button
              type="button"
              className={activeCategory === item.id ? 'active' : ''}
              onClick={() => setActiveCategory(item.id)}
              key={item.id}
            >
              <span aria-hidden="true">{item.icon}</span>
              <strong>{item.label}</strong>
              <small>{item.items.length}</small>
            </button>
          ))}
        </nav>

        <section className="inventory-content panel">
          <div className="inventory-heading">
            <div><span className="eyebrow">Catégorie</span><h2>{category.label}</h2></div>
            <label className="search-field compact-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Rechercher…" /></label>
          </div>
          <div className="inventory-grid">
            {category.items.map((item) => (
              <article className="inventory-item" key={item.name}>
                <span className={`item-icon ${item.tone}`} aria-hidden="true">{item.icon}</span>
                <div><strong>{item.name}</strong><p>{item.description}</p></div>
                <span className="item-amount">× {item.amount}</span>
              </article>
            ))}
            <article className="inventory-item empty-slot">
              <span aria-hidden="true">＋</span><div><strong>Emplacement disponible</strong><p>De futurs objets pourront apparaître ici.</p></div>
            </article>
          </div>
        </section>
      </div>
    </div>
  )
}

export default InventoryScreen
