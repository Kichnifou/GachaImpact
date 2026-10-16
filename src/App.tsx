import AppBootstrap from './AppBootstrap'
import { AuthProvider } from './auth/AuthProvider'
import './App.css'
import './components/height-adaptive-screen.css'
import { useState } from 'react'
import { isRecoveryLocation } from './auth/password-security'
import PasswordRecoveryScreen from './components/PasswordRecoveryScreen'
import {AccountDeletionFlowProvider} from './screens/AccountDeletionFlow'

function App() {
  const [recovering] = useState(isRecoveryLocation)
  if (recovering) return <PasswordRecoveryScreen />
  return (
    <AuthProvider>
      <AccountDeletionFlowProvider><AppBootstrap /></AccountDeletionFlowProvider>
    </AuthProvider>
  )
}

export default App
