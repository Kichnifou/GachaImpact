type ScreenHeaderProps = {
  eyebrow: string
  title: string
  description: string
  meta?: string
}

function ScreenHeader({ eyebrow, title, description, meta }: ScreenHeaderProps) {
  return (
    <header className="screen-header panel">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {meta && <span className="screen-meta">{meta}</span>}
    </header>
  )
}

export default ScreenHeader
