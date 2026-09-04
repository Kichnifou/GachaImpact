import AppBootstrap from './AppBootstrap'
import { AuthProvider } from './auth/AuthProvider'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <AppBootstrap />
    </AuthProvider>
  )
}

export default App
