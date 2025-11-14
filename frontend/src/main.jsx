import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker } from './utils/serviceWorkerManager.js'

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  registerServiceWorker();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
