import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

registerSW({ immediate: true })
// Pede ao navegador pra não apagar os dados guardados no aparelho quando faltar espaço.
navigator.storage?.persist?.().catch(() => {})
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
