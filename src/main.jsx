import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// App aberto o dia todo no celular: procura versão nova ao voltar pra ele e de tempos em tempos
// (a nova assume sozinha e a tela recarrega).
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const procurar = () => reg.update().catch(() => {})
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') procurar() })
    setInterval(procurar, 15 * 60 * 1000)
  },
})
// Pede ao navegador pra não apagar os dados guardados no aparelho quando faltar espaço.
navigator.storage?.persist?.().catch(() => {})
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
