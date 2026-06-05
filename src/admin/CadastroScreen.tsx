// F6-C · Atualização de cadastro/telefone — US-A3'.
// Não é aba fixa: abre a partir de uma pessoa em Serviço (target com nome) ou,
// no fallback, busca na base e seleciona alguém. Grava origem + compilada.
import { useState } from 'react'
import { adminSearch, adminUpdatePhone } from '@/api/adminClient'
import {
  buildVoluntarioId,
  type AdminUpdatePhoneResult,
  type CadastroTarget,
} from '@/types/admin'
import type { Area } from '@/types/api'
import { Button } from '@/components/Button'
import { CheckCircle } from '@/components/icons'
import { isValidPhone, maskPhone, normalizePhone } from '@/lib/phone'
import { AdminShell } from './AdminShell'

interface Person {
  nome: string
  area: Area
  telefone?: string
}

interface CadastroScreenProps {
  identity: string
  operador: string
  target: CadastroTarget
  onClose: () => void
  onLogout: () => void
}

const ERROS: Record<string, string> = {
  DUPLICATE_PHONE: 'Este telefone já está em uso por outro voluntário.',
  VOLUNTEER_NOT_FOUND: 'Voluntário não encontrado na base.',
  ORIGIN_NOT_FOUND: 'Não foi possível atualizar na planilha da área.',
}

export function CadastroScreen({
  identity,
  operador,
  target,
  onClose,
  onLogout,
}: CadastroScreenProps) {
  const initialPerson: Person | null = target.nome && target.area
    ? { nome: target.nome, area: target.area, telefone: target.telefone }
    : null

  const [person, setPerson] = useState<Person | null>(initialPerson)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [novo, setNovo] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<AdminUpdatePhoneResult | null>(null)

  async function buscar() {
    if (query.trim().length < 2) return
    const env = await adminSearch(operador, query.trim())
    if (env.ok && env.data) {
      // Fallback usa a busca de hoje (Serviço); base-wide é discovery (doc §7).
      const seen = new Set<string>()
      const people: Person[] = []
      for (const it of env.data.itens) {
        const key = `${it.escala.area}::${it.nome}`
        if (seen.has(key)) continue
        seen.add(key)
        people.push({ nome: it.nome, area: it.escala.area, telefone: it.telefone })
      }
      setResults(people)
    }
  }

  async function salvar() {
    if (!person || !isValidPhone(novo)) return
    setSaving(true)
    setErro(null)
    try {
      const env = await adminUpdatePhone(
        operador,
        buildVoluntarioId(person.area, person.nome),
        normalizePhone(novo),
      )
      if (env.ok && env.data) {
        setSucesso(env.data)
      } else {
        setErro(ERROS[env.error?.code ?? ''] ?? 'Não foi possível salvar. Tente de novo.')
      }
    } catch {
      setErro('Falha de conexão. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  // ── Sucesso ──────────────────────────────────────────────────────
  if (sucesso) {
    return (
      <AdminShell identity={identity} onBack={onClose} onLogout={onLogout}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <CheckCircle size={72} className="text-success" />
          <h2 className="text-h2 text-ink">Telefone atualizado!</h2>
          <p className="text-label text-ink">{sucesso.nome}</p>
          <p className="text-title font-bold text-primary">{maskPhone(sucesso.telefoneNovo)}</p>
          <p className="text-helper text-muted">gravado na {sucesso.gravado.join(' + ')}</p>
          <div className="mt-4 w-full">
            <Button onClick={onClose}>Concluir</Button>
          </div>
        </div>
      </AdminShell>
    )
  }

  // ── Busca (fallback, sem pessoa definida) ────────────────────────
  if (!person) {
    return (
      <AdminShell identity={identity} onBack={onClose} onLogout={onLogout}>
        <label className="text-label font-semibold text-ink" htmlFor="busca-base">
          Buscar voluntário
        </label>
        <div className="flex gap-2">
          <input
            id="busca-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void buscar()}
            placeholder="🔍 Nome"
            className="flex-1 rounded-input border border-black/10 px-3 py-2.5 text-label"
          />
          <Button fullWidth={false} onClick={() => void buscar()}>
            Buscar
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {results.map((p) => (
            <button
              key={`${p.area}::${p.nome}`}
              type="button"
              onClick={() => {
                setPerson(p)
                setResults([])
              }}
              className="rounded-card bg-white p-3 text-left shadow-card"
            >
              <span className="text-label font-bold text-ink">{p.nome}</span>
              <p className="text-helper text-muted">{p.area}</p>
            </button>
          ))}
        </div>
      </AdminShell>
    )
  }

  // ── Edição ───────────────────────────────────────────────────────
  return (
    <AdminShell identity={identity} onBack={onClose} onLogout={onLogout}>
      <div>
        <h2 className="text-h2 text-ink">{person.nome}</h2>
        <p className="text-label text-muted">{person.area}</p>
      </div>

      <div>
        <p className="text-helper text-muted">Telefone atual</p>
        <p className="text-label text-ink">{person.telefone ? maskPhone(person.telefone) : '—'}</p>
      </div>

      <div>
        <label className="text-label font-semibold text-ink" htmlFor="novo-tel">
          Novo telefone
        </label>
        <input
          id="novo-tel"
          inputMode="numeric"
          value={maskPhone(novo)}
          onChange={(e) => {
            setErro(null)
            setNovo(e.target.value)
          }}
          placeholder="(11) 99999-8888"
          className="mt-1 w-full rounded-input border border-black/10 px-3 py-2.5 text-label"
        />
        <p className="mt-1 text-helper text-muted">
          ⓘ Grava na planilha da área e na base · efeito imediato.
        </p>
        {erro && <p className="mt-1 text-helper text-error">⚠ {erro}</p>}
      </div>

      <div className="mt-auto pb-safe pt-3">
        <Button onClick={() => void salvar()} loading={saving} disabled={!isValidPhone(novo)}>
          Salvar telefone
        </Button>
      </div>
    </AdminShell>
  )
}
