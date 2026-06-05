# Ajustes da Fase de Implementação — Check-in Igreja Ser Amor
**Data:** Jun/2026 | **Tipo:** Addendum / Changelog | **Escopo:** MVP (Fases 1–4)

> Este documento consolida **todas as decisões e mudanças** feitas durante a
> implementação do frontend (React) e a integração com o backend (Apps Script).
> Ele **prevalece** sobre os specs originais nos pontos abaixo; os specs
> (PRD v1.3, Especificação MVP, Contrato v1.2, Wireframes, Descritivo) seguem
> como referência histórica. Cada seção indica o que supera.

---

## 1. Stack e Arquitetura

> Supera: Descritivo §10 (produção em FlutterFlow); PRD §4 / Apêndice B (hosting);
> Especificação §3/§9/§16.5.

- **Frontend:** **React 18 + Vite + TypeScript + Tailwind**, instalável como **PWA**.
  O protótipo FlutterFlow passa a ser apenas **referência visual**.
- **Hospedagem:** **estática no root do domínio** (Cloudflare Pages / Netlify /
  Vercel). O **HTML Service do Apps Script foi descartado** — roda em iframe
  sandbox e **inviabiliza o PWA** (sem escopo de service worker, não instalável).
  → Resolve a pendência §16.5.
- **PWA:** `vite-plugin-pwa` (Workbox). Service worker `autoUpdate` que precacheia
  só o *app shell*; **a API (`script.google.com`) é `NetworkOnly`** — nunca
  cacheada (o estado é recalculado no servidor; sem rede, cai na tela de Offline).
  Ícones gerados da logo 512px (`scripts/generate-icons.mjs`). `base` = `/`.
- **Camada de API:** `src/api/client.ts` — `POST` com `Content-Type: text/plain`
  (evita preflight CORS), **timeout 12s**, retry automático 1×. Sem `VITE_API_URL`
  usa um **mock fiel ao contrato** (`src/api/mock.ts`).
- **CORS validado:** a chamada cross-origin (host estático → Apps Script `/exec`)
  **funciona sem proxy** com `text/plain` (resposta lida normalmente).

---

## 2. Backend (Apps Script)

> Supera: Especificação §8; Contrato §6; arquivo `Code.gs`.

- **`Code_otimizado.gs`** substitui o `Code.gs` original. Otimizações:
  - Abre a planilha **1× por execução** (memoização).
  - **Lê só a coluna `Telefone`** para filtrar e carrega a **linha inteira apenas
    das que casam** (antes lia ~3.300 linhas × 14 colunas por chamada).
  - Escrita sem reler cabeçalho; cabeçalhos lidos 1×.
  - `inferTurno` robusto ao fuso (hora de **São Paulo**, não a do projeto).
- **`SPREADSHEET_ID` via Script Properties** (em vez de cravado no código) — evita
  misturar homologação e produção. Fallback para `CONFIG.SPREADSHEET_ID`.
  - Homolog: `1nxhXn6_39j9xURqTr4smNr7H4XEv3BvSH1n8_55nNgc`
  - Produção: `10lmOfSE4O8CnJOmyZ96i0f2k26uDxrV5QCEP9DlurRA`
- **Tipo das células de carimbo:** `Checkin`/`Checkout` são **`Date`** (o backend
  grava `Date`). → Resolve a pendência §16.1.
- **Redeploy correto:** *Gerenciar implantações → editar a existente → Nova
  versão* (não "Nova implantação", que gera URL diferente).

### Latência medida (real)

> Supera: Especificação §9/§10 e PRD §6 (que estimavam ~1–2s).

| | Original | Otimizado |
|---|---|---|
| Média | ~6.9s | **~4.2s** |
| Pior caso | ~15s | ~5s |

O piso de ~4s é **`openById` + redirect 302 + overhead do Apps Script** (não mais
as leituras). Para buscar **<1s**: `CacheService` (índice telefone→linha) ou
migrar a rota para um **Cloudflare Worker** (mitigação já prevista no PRD).

---

## 3. Contrato de API — deltas

> Supera: Contrato §3 e §4 (payloads).

- **`NOT_FOUND` / `NOT_SCHEDULED` não enviam mais `message`.** A cópia de
  orientação é **renderizada pelo frontend** (`src/lib/copy.ts`). O backend manda
  só os dados (`nome`, `podeRegistrarForaDaEscala`, `areaSugerida`, `funcaoSugerida`).
- **`MULTIPLE.opcoes`:**
  - **Incluem `checkoutAt`** quando a opção está `DONE` (antes só `checkinAt`).
  - **Não incluem `telefone`** — o cliente usa o telefone do `resolve` para montar
    a chave `Telefone+Data+Área+Turno`.

  Exemplo atualizado:
  ```json
  { "ok": true, "state": "MULTIPLE",
    "data": { "nome": "Pablo Alcantara",
      "opcoes": [
        { "data":"04/06/2026", "area":"Clubinho", "turno":"Manhã", "funcao":"Contador", "estado":"CAN_CHECKIN" },
        { "data":"04/06/2026", "area":"Clubinho", "turno":"Noite", "funcao":"Contador", "estado":"DONE",
          "checkinAt":"04/06/2026 17:19", "checkoutAt":"04/06/2026 19:57" }
      ] },
    "error": null }
  ```

---

## 4. Desambiguação de escala múltipla (US-07) — regra refinada

> Supera: Contrato §1 (janelas de turno) e Especificação/Wireframes US-07.

Quando há **2+ escalas hoje**, o `resolve` decide assim:

1. **Áreas distintas** → sempre `MULTIPLE` (escolha explícita).
2. **Mesma área** (turnos diferentes):
   - Existe escala **em aberto** (`In=TRUE, Out=FALSE`) de **outro turno**
     (ex.: esqueceu de fechar a Manhã) → `MULTIPLE` (mostra ambas p/ concluir).
   - Senão, se a hora atual cai na janela de **exatamente um turno** → resolve
     **direto** o estado daquele turno (Manhã 06–13 / Noite 15–22, em SP).
   - Senão (gap 13–15h ou fora de horário) → `MULTIPLE` (degradação segura).

Objetivo: evitar a tela de seleção quando dá para estimar o turno, mas **não
esconder** um turno aberto que precisa de check-out.

---

## 5. US-10 (presença fora da escala) — ajustes

> Supera: Wireframes T7/T8; Descritivo §4 (T7); Especificação §16.6.

- **Área:** seletor com o enum oficial, **pré-sugerida** pela Base de Voluntários.
- **Função:** **campo de texto livre**, e **inicia vazio** neste cenário.
  → Resolve a pendência §16.6 (Função = texto livre).
- **Texto descritivo** inclui o **nome**: *"[Nome], você não está na escala de
  hoje. Informe os dados:"*
- **Toggle one-tap** ("Salvar meus dados neste aparelho") incluído **após o Motivo**
  (idêntico ao da T3); salva o telefone no sucesso.
- **Sucesso reaproveita a tela de check-in confirmado** — a variação **"Presença
  registrada!" foi removida** (era uma 3ª variação do T8 nos Wireframes).
- Pré-condição mantida: só para telefone **cadastrado** (`NOT_SCHEDULED`).

---

## 6. Microcopy (fonte da verdade: telas do front + `src/lib/copy.ts`)

> Supera: Especificação §6; PRD §5 (US-03); Wireframes; Descritivo §7.

| Tela / contexto | Antes | Agora |
|---|---|---|
| T1 subtítulo | "Confirme sua presença como voluntário" | "…como voluntário **na Igreja Ser Amor**" |
| T2b `NOT_SCHEDULED` | "…escalado… procure **o líder do ministério**" | "…escala**da(o)**… procure **a Base de Voluntários**" |
| T2a `NOT_FOUND` | (texto do backend) | mesmo texto, **renderizado pelo front** |
| T4 check-out | "Confirmar saída **do Ministério** [Área]?" | "…saída **da área** [Área]?" |
| T4 card | "**Ministério** [Área]" | "**Área** [Área]" |
| T6 MULTIPLE | "Você está **escalado em mais de uma área** hoje" | "Você está **em mais de uma escala** hoje" |
| T5 / T8 ação terminal | "Sair / Usar outro número" · "Finalizar" | **"Fechar"** (fecha a aba; fallback `ClosedScreen`) |
| Header (link) | "Usar outro número" | **"Trocar número"** |

---

## 7. Telas — deltas visuais/comportamentais

> Supera: Wireframes; Descritivo §4.

- **T1:** **header removido** (sem a marca no topo); **logo (PNG)** acima da data;
  conteúdo centralizado verticalmente.
- **T3:** **logo** acima da saudação; sem identity card (já constava no Descritivo).
- **T5 (DONE):** ação **"Fechar"**; exibe **Entrada e Saída** (corrigido bug em que
  a Saída não aparecia quando o DONE vinha pela tela de seleção/MULTIPLE).
- **T6:** itens com selo de status ("Em serviço"/"Concluído"); seleção monta a
  chave com o telefone do `resolve`.
- **T8 / DONE:** link **"Trocar número"** incluído no header das telas de
  **check-out** e **serviço completo** (não no check-in confirmado).
- **Estados transversais:** L (loading), E (erro — nunca expõe códigos), O (offline)
  e **ClosedScreen** (encerramento via "Fechar", com fallback se o navegador
  bloquear `window.close()`).

---

## 8. Privacidade / Segurança

> Supera: Especificação §10/§16.4.

- **Telefone no `localStorage`** (one-tap): guardado com **ofuscação leve
  (XOR + base64)** — **não é criptografia forte**, apenas evita texto puro.
  Isolado em `src/lib/storage.ts` para troca futura por uma cifra real.
  → Resolve a pendência §16.4 **com ressalva** (esquema definitivo pode evoluir).

---

## 9. Status das pendências (Especificação §16)

| # | Pendência | Status |
|---|-----------|--------|
| 1 | Tipo das células `Checkin`/`Checkout` | ✅ **`Date`** |
| 2 | App Script compilar `Base Voluntarios` | ✅ populada (validado em homolog) |
| 3 | Consolidação não rodar no culto / não apagar US-10 | ⏳ operacional (a confirmar no piloto) |
| 4 | Cifragem do telefone no `localStorage` | ✅ ofuscação leve (com ressalva) |
| 5 | Hospedagem (HTML Service vs estática) | ✅ **estática** |
| 6 | Origem da lista de Função na US-10 | ✅ **texto livre** |

---

## 10. Em aberto / próximos passos

- **Latência <1s:** avaliar `CacheService` ou migração da rota para Worker.
- **Produção:** subir o `Code_otimizado.gs` (com `SPREADSHEET_ID` de prod via
  Script Properties) e fazer o **deploy estático** do frontend (HTTPS no root).
- **Limpeza:** remover linhas de teste criadas em homologação/produção durante a
  integração.
- **Fases 5–6:** painéis `/lider` e `/admin` (fora do MVP).

---

*Addendum da fase de implementação — Jun/2026. Acompanha e atualiza: PRD v1.3,
Especificação MVP, Contrato de API v1.2, Wireframes v1.0, Descritivo v1.1.*
