export default function CatalogRefresh({loading,onClick}:{loading:boolean;onClick:()=>void}) {
  return <span className="catalog-refresh-wrap"><button type="button" className="catalog-refresh" aria-label="Actualiser" aria-busy={loading} disabled={loading} onClick={onClick}><span aria-hidden="true">↻</span></button><span role="tooltip">Actualiser</span></span>
}
