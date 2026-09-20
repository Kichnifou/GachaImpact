import type { ReactNode } from 'react'

function ScrollableScreenPanel({ fixed, footer, children, className = '', bodyClassName = '' }: { fixed?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return <section className={`panel scrollable-screen-panel${className ? ` ${className}` : ''}`}>
    <div className={`scrollable-screen-panel-content${footer ? ' has-footer' : ''}`}>
      {fixed && <div className="scrollable-screen-panel-controls">{fixed}</div>}
      <div className={`scrollable-screen-panel-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
      {footer && <div className="scrollable-screen-panel-footer">{footer}</div>}
    </div>
  </section>
}

export default ScrollableScreenPanel
