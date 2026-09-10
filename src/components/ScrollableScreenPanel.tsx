import type { ReactNode } from 'react'

function ScrollableScreenPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel scrollable-screen-panel${className ? ` ${className}` : ''}`}>
    <div className="scrollable-screen-panel-content">{children}</div>
  </section>
}

export default ScrollableScreenPanel
