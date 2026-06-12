// Identidade do operador para o painel /admin (doc Fase 6 §2).
// O acesso é protegido por Cloudflare Zero Trust; o app só LÊ a identidade
// autenticada via /cdn-cgi/access/get-identity e a usa na auditoria (operador).
// Não há login no app. Sem backend (dev/mock) cai num operador fixo.

import { ADMIN_MOCK, DEV_OPERADOR } from '@/lib/adminEnv'

export interface AdminIdentity {
  email: string
  name: string
}

interface AccessIdentity {
  email?: string
  name?: string
}

/** Encerra a sessão. Em produção, dispara o logout do Cloudflare Access. */
export async function logout(): Promise<void> {
  if (ADMIN_MOCK) {
    // Dev/mock: sem Zero Trust — volta para o app do voluntário.
    window.location.href = '/'
    return
  }
  // O SW do PWA tem navigateFallback: sem cuidado, ele serviria a navegação
  // para /cdn-cgi/access/logout a partir do cache (index.html) e o logout nunca
  // chegaria ao Cloudflare. Removemos SW + caches antes de navegar para garantir
  // que a saída atinja o edge e encerre a sessão — funciona mesmo para quem
  // ainda tem o SW antigo (sem o denylist do vite.config) instalado.
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
    const keys = (await caches?.keys()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    // sem SW/caches acessíveis — segue para o logout do Access mesmo assim
  }
  window.location.href = '/cdn-cgi/access/logout'
}

export async function getIdentity(): Promise<AdminIdentity> {
  // Dev / mock (sem Zero Trust na frente) → operador fixo.
  if (ADMIN_MOCK) return { email: DEV_OPERADOR, name: 'Admin (dev)' }

  try {
    const res = await fetch('/cdn-cgi/access/get-identity', { credentials: 'include' })
    if (res.ok) {
      const j = (await res.json()) as AccessIdentity
      if (j.email) return { email: j.email, name: j.name ?? j.email }
    }
  } catch {
    // sem identidade acessível — segue com fallback
  }
  return { email: 'desconhecido', name: 'Operador' }
}
