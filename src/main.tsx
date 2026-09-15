import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Side effect: registers every content module before the app renders.
import '@/content'
import { bootStore } from '@/store'
import App from './App'

// Compaction (events older than 60 days fold into weekly counters) + hydration flag.
bootStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
