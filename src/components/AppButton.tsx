import { forwardRef, type ButtonHTMLAttributes } from 'react'

export type AppButtonVariant = 'secondary' | 'primary' | 'danger' | 'icon'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & Readonly<{ variant?: AppButtonVariant }>

const AppButton = forwardRef<HTMLButtonElement, Props>(function AppButton({ variant = 'secondary', type = 'button', className, ...props }, ref) {
  return <button ref={ref} type={type} className={`app-button app-button-${variant}${className ? ` ${className}` : ''}`} {...props} />
})

export default AppButton
