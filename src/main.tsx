import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminApp from './admin/AdminApp'
import './index.css'

// Roteamento mínimo por path (sem dependência de router): /admin → painel da
// Fase 6 (protegido por Cloudflare Zero Trust); qualquer outro → check-in.
// O host estático precisa servir index.html em /admin (ver public/_redirects).
const isAdmin = window.location.pathname.replace(/\/+$/, '').endsWith('/admin')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isAdmin ? <AdminApp /> : <App />}</StrictMode>,
)
