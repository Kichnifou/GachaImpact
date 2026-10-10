import { useContext, useState } from 'react'
import { AuthContext } from '../auth/auth-context'
import { getSupabaseClient } from '../infrastructure/supabase/client'
import AppButton from '../components/AppButton'
import PasswordForm from '../components/PasswordForm'

export default function AccountSecurityPanel() {
  const auth = useContext(AuthContext), [open, setOpen] = useState(false)
  if (auth?.status !== 'signedIn') return null
  return <section className="account-section"><h3>Sécurité du compte</h3>
    <AppButton onClick={() => setOpen(value => !value)} aria-expanded={open}>{open ? 'Fermer' : 'Modifier mon mot de passe'}</AppButton>
    {open && <PasswordForm client={getSupabaseClient()} />}
  </section>
}
