// Configuração de ambiente do painel /admin (Fase 6).
// Enquanto o backend Apps Script não implementa os action's de admin
// (adminDashboard/adminSearch/adminCheckin/adminCheckout/adminUpdatePhone),
// o flag VITE_ADMIN_MOCK deixa o /admin rodar contra o mock mesmo com
// VITE_API_URL apontando para o backend do MVP (homolog/produção).
// Desligue (0 ou remova a var) quando o backend admin existir.

const API_URL = import.meta.env.VITE_API_URL as string | undefined

/** true → o /admin usa o mock (sem backend admin) em vez da rede. */
export const ADMIN_MOCK = !API_URL || import.meta.env.VITE_ADMIN_MOCK === '1'

/** Operador usado quando não há Zero Trust na frente (mock/dev). */
export const DEV_OPERADOR = 'admin@seramor.com.br'
