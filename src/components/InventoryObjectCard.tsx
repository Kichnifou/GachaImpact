import type { InventoryItemDto } from '../api/types'
import { formatResourceAmount } from '../utils/formatters'

export default function InventoryObjectCard({ item, onSelect }: { item: InventoryItemDto; onSelect?: () => void }) {
  const owned = BigInt(item.quantity) > 0n
  const content = <><span className="item-icon violet" aria-hidden="true"><span className="item-icon-glyph">{owned ? '✦' : '?'}</span></span><div><strong>{item.displayName}</strong><p>{item.description ?? 'Aucune description disponible.'}</p></div><span className="item-amount">× {formatResourceAmount(item.quantity)}</span></>
  return <article className={`inventory-item inventory-object-card${owned ? '' : ' unowned'}`} title={item.acquisitionHint ?? undefined}>
    {onSelect ? <button type="button" className="inventory-item-main" onClick={onSelect}>{content}</button> : <div className="inventory-item-main">{content}</div>}
  </article>
}
