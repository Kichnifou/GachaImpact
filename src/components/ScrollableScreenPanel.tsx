import type { ReactNode } from 'react'

function ScrollableScreenPanel({ fixed, children, className = '', bodyClassName = '' }: { fixed?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return <section className={`panel scrollable-screen-panel${className ? ` ${className}` : ''}`}>
    <div className="scrollable-screen-panel-content">
      {fixed && <div className="scrollable-screen-panel-controls">{fixed}</div>}
      <div className={`scrollable-screen-panel-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
    </div>
  </section>
}

export default ScrollableScreenPanel
