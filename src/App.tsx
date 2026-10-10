import AppBootstrap from './AppBootstrap'
import { AuthProvider } from './auth/AuthProvider'
import './App.css'
import { useState } from 'react'
import { isRecoveryLocation } from './auth/password-security'
import PasswordRecoveryScreen from './components/PasswordRecoveryScreen'

function App() {
  const [recovering] = useState(isRecoveryLocation)
  if (recovering) return <PasswordRecoveryScreen />
  return (
    <AuthProvider>
      <AppBootstrap />
    </AuthProvider>
  )
}

export default App
