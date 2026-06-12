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

/**
 * Resultado da verificação de identidade — três casos distintos:
 *  - `authed`  : sessão válida (200 + email).
 *  - `denied`  : o edge respondeu negando (401/redirect p/ login / sem email)
 *                → deslogado/expirado. Sinal DEFINITIVO de "sem acesso".
 *  - `offline` : o fetch não alcançou o edge (sem rede) → estado DESCONHECIDO,
 *                não deve derrubar quem já estava autenticado.
 */
export type IdentityResult =
  | { status: 'authed'; identity: AdminIdentity }
  | { status: 'denied' }
  | { status: 'offline' }

/**
 * Remove o service worker e os caches do PWA, para a navegação SEGUINTE atingir
 * a rede/edge em vez de ser servida pelo app shell em cache (navigateFallback).
 * Sem isto, o logout/relogin do PWA instalado seria interceptado pelo SW.
 */
async function clearAppCaches(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
    const keys = (await caches?.keys()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    // sem SW/caches acessíveis — segue assim mesmo
  }
}

/** Encerra a sessão. Em produção, dispara o logout do Cloudflare Access. */
export async function logout(): Promise<void> {
  if (ADMIN_MOCK) {
    // Dev/mock: sem Zero Trust — volta para o app do voluntário.
    window.location.href = '/'
    return
  }
  await clearAppCaches()
  // Navegação de topo para o endpoint de logout do Access: limpa o cookie
  // CF_Authorization no edge e encerra a sessão.
  window.location.href = '/cdn-cgi/access/logout'
}

/**
 * Força nova autenticação: limpa o PWA e recarrega /admin. Com o cookie já
 * encerrado, o Zero Trust reexige login; se ainda houver sessão, volta ao painel.
 */
export async function relogin(): Promise<void> {
  if (ADMIN_MOCK) {
    window.location.reload()
    return
  }
  await clearAppCaches()
  window.location.replace('/admin')
}

/**
 * Lê a identidade do operador autenticado pelo Zero Trust. Distingue sessão
 * inválida (`denied`, definitivo) de falha de rede (`offline`, desconhecido) —
 * ver {@link IdentityResult}. `redirect: 'manual'` é o que permite a distinção:
 * deslogado, o Access responde 401/redirect e o fetch RESOLVE (→ denied); só
 * queda de rede real LANÇA (→ offline).
 */
export async function getIdentity(): Promise<IdentityResult> {
  // Dev / mock (sem Zero Trust na frente) → operador fixo.
  if (ADMIN_MOCK) return { status: 'authed', identity: { email: DEV_OPERADOR, name: 'Admin (dev)' } }

  let res: Response
  try {
    res = await fetch('/cdn-cgi/access/get-identity', {
      credentials: 'include',
      cache: 'no-store',
      redirect: 'manual',
    })
  } catch {
    // o fetch lançou → não alcançou o edge: estado desconhecido, não derruba.
    return { status: 'offline' }
  }

  // A resposta chegou do edge: 200 + email = autenticado; qualquer outra coisa
  // (401, opaqueredirect p/ login, corpo sem email) = sessão inválida.
  try {
    if (res.ok) {
      const j = (await res.json()) as AccessIdentity
      if (j.email) return { status: 'authed', identity: { email: j.email, name: j.name ?? j.email } }
    }
  } catch {
    // 200 com corpo não-JSON (raro) → trata como sem sessão
  }
  return { status: 'denied' }
}
