import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from "./auth/AuthContext.jsx"
import { startAutoSync } from './lib/syncManager'
import { registerSW } from 'virtual:pwa-register'
import { supabase, isConfigured } from './lib/supabase'

// Removed agent log

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

// Defer auto-sync until an authenticated session is available.
// This prevents sync errors from firing before the user is logged in.
let syncStarted = false;
if (isConfigured) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session && !syncStarted) {
      syncStarted = true;
      console.log('[main] Auth session ready — starting auto-sync');
      startAutoSync();
    }
  });
} else {
  // No Supabase configured — start sync immediately (dev/offline mode)
  startAutoSync();
}


createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
)

