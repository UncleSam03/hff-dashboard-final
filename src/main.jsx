import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from "@/auth/AuthContext.jsx"
import { startAutoSync } from './lib/syncManager'
import { initSupabaseSync } from './lib/supabaseSync'
import { registerSW } from 'virtual:pwa-register'

// Register Service Worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready for offline use');
  },
})

// Start the background sync engines
startAutoSync();


createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
)

