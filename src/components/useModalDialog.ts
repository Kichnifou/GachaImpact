import { useEffect, useRef } from 'react'
import { useTutorialPresentation } from '../tutorial/tutorial-presentation'

const FOCUSABLE = 'button:not(:disabled), summary, [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export function useModalDialog<T extends HTMLElement>(onClose: () => void) {
  const { active: tutorialActive } = useTutorialPresentation()
  const dialogRef = useRef<T>(null)
  const closeRef = useRef(onClose)

  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dialog || tutorialActive) return
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => {
      if (element.tabIndex < 0) return false
      for (let node: HTMLElement | null = element; node && node !== dialog; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (node.hidden || node.hasAttribute('inert') || style.display === 'none' || ['hidden','collapse'].includes(style.visibility)) return false
        if (node.tagName === 'DETAILS' && !node.hasAttribute('open')) {
          const summary = Array.from(node.children).find(child => child.tagName === 'SUMMARY')
          if (!summary?.contains(element)) return false
        }
      }
      return true
    })
    ;(focusable()[0] ?? dialog).focus()

    const onKeyDown = (event: KeyboardEvent) => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'))
      const activeDialog = document.activeElement instanceof HTMLElement
        ? document.activeElement.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]')
        : null
      if ((activeDialog ?? dialogs.at(-1)) !== dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const candidates = focusable()
      if (candidates.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = candidates[0]!
      const last = candidates[candidates.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [tutorialActive])

  return dialogRef
}
