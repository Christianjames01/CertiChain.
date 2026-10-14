import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initTheme } from './lib/theme'
import 'bootstrap/dist/css/bootstrap.min.css'

initTheme()

window.addEventListener('vite:preloadError', () => {
  const key = 'chunk-reload-attempted'
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1')
    window.location.reload()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

sessionStorage.removeItem('chunk-reload-attempted')
