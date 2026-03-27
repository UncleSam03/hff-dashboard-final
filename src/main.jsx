import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from "./auth/AuthContext.jsx"
import { startAutoSync } from './lib/syncManager'
import { registerSW } from 'virtual:pwa-register'
import { supabase, isConfigured } from './lib/supabase'

// #region agent log
try {
  fetch('http://127.0.0.1:7491/ingest/d310bdd2-b950-4c68-be76-23013d6da606', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4b0c4c' },
    body: JSON.stringify({
      sessionId: '4b0c4c',
      runId: 'baseline',
      hypothesisId: 'E',
      location: 'src/main.jsx:boot',
      message: 'App entrypoint executed',
      data: { isConfigured: !!isConfigured },
      timestamp: Date.now()
    })
  }).catch(() => { })
} catch { }
// #endregion agent log

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

