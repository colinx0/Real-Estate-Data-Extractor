import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import faviconUrl from './assets/favicon.ico?url'

// Inject favicon so it loads reliably (avoids path/cache issues)
const link = document.querySelector("link[rel*='icon']") || document.createElement('link')
link.rel = 'icon'
link.type = 'image/x-icon'
link.href = faviconUrl
if (!document.querySelector("link[rel*='icon']")) document.head.appendChild(link)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

