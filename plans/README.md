# Implementation Plans

Gerado pelo skill `improve` em 2026-06-17, contra o commit `feafcfa` (branch
`loja-improve`). Cada executor: leia o plano inteiro antes de começar, honre as
STOP conditions e atualize sua linha ao terminar.

> **Status em 2026-09-28:** os 11 planos estão implementados no código da `main` (integrados pelo #148, `0a15063`). Três deles divergem do texto original: o 003 trocou as variáveis `SUPERFRETE_*` por `FRENET_*` (#178), o 006 mudou o retorno de `searchToolsAction` para `ActionResultWith` (#226) e o 001 ganhou outra lista de testes de integração. A coluna Status abaixo mostra DONE (2026-06-17); as notas em cada plano dizem o que mudou depois.

**Status (2026-06-17):** todos os 11 planos foram executados via 4 executores em
worktrees isolados e integrados na `loja-improve` (na época sem commit; entraram na `main` pelo #148).
Verificação integrada: `check-types` ✅, validador 23 testes ✅, suite unit 84
testes ✅, lint dos arquivos tocados ✅. Um bug de re-export (`export type {} from`
não vincula localmente) foi pego na verificação central e corrigido; o Plano 010
foi atualizado para não repeti-lo.

**Contexto do estágio (do operador):** pré-lançamento, **dados do banco são mock**
(não tratar como reais), e o **pagamento real (Asaas) está fora desta sessão** —
intencionalmente. A seleção abaixo é "fundação + higiene + segurança": prepara o
terreno antes de dados/pagamento reais entrarem, com custo baixo e risco baixo.

## Ordem de execução & status

| Plano | Título | Prioridade | Esforço | Depende de | Status |
|-------|--------|-----------|---------|------------|--------|
| 001 | Rodar testes unit no CI | P1 | S | — | DONE |
| 002 | Normalizar CPF/CNPJ no checkout + testar validador | P1 | S | 001 (ideal) | DONE |
| 003 | Completar `.env.example` | P1 | S | — | DONE |
| 004 | Validar `NEXT_PUBLIC_SITE_URL` via env | P2 | S | 003 (ideal) | DONE |
| 005 | Checar posse do endereço em `resolveDestinationCep` | P2 | S | — | DONE |
| 006 | Rate limit em `searchToolsAction` | P2 | S | — | DONE |
| 007 | Não vazar internals em erro/log | P2 | S | — | DONE |
| 008 | Corrigir corpo do ADR-0001 | P3 | S | — | DONE |
| 009 | Neutralizar scripts legacy `db:generate`/`db:migrate` | P3 | S | — | DONE |
| 010 | Consolidar tipo `ActionResult` | P3 | S | — | DONE |
| 011 | Remover `useCallback` manual do `cart-context` | P3 | S | — | DONE |

Status: TODO | IN PROGRESS | DONE | BLOCKED (motivo em 1 linha) | REJECTED (motivo).

## Notas de dependência

- **002 idealmente após 001**: assim o CI já recolhe os novos testes do validador.
  Não é bloqueio rígido — 002 roda isolado.
- **004 idealmente após 003**: 004 torna `NEXT_PUBLIC_SITE_URL` obrigatória; ter a
  linha no `.env.example` (003) evita quebrar onboarding. 004 já adiciona a linha
  mínima se 003 não rodou.
- Os demais são independentes e podem rodar em qualquer ordem / em paralelo (cada
  um toca arquivos distintos — sem conflito de merge).

## Trabalho cross-repo (dashboard-owned — NÃO planejado aqui)

`packages/db/src/queries/catalog.ts` é sincronizado do repo `emach-dashboard` via
CI PR (ADR-0009). Estes achados de perf de query são reais mas **devem ser
corrigidos no dashboard**, não aqui (edição local seria sobrescrita):

_Nota 2026-09-28: `catalog.ts` foi dividido no #157, e as referências de linha abaixo apontam para o arquivo antigo. Na cópia atual de `packages/db/src/queries` os três achados já estão resolvidos: `getReviewStats` roda dentro do `Promise.all` de `getToolBySlug` (`tools.ts:308-431`); `getActivePromotions` e `getFeaturedPromotion` batcheiam a busca de ferramentas e o comentário em `promotions.ts:137` fala em custo `1 + 1 + N`; a lateral de promoção só entra no count com `onlyPromo === true` (`tools.ts:220-222`). Não verificado: o estado das issues no dashboard._

- **getToolBySlug — 7ª query serial**: `catalog.ts:591` faz `getReviewStats`
  sequencialmente após um `Promise.all` de 6 queries; cabe no mesmo `Promise.all`.
  → [emach-dashboard#213](https://github.com/othavioquiliao/emach-dashboard/issues/213)
- **N+1 em getActivePromotions / getFeaturedPromotion**: 2 queries por promoção
  num loop serial (`catalog.ts:820-869` e `884-971`); batchear via `inArray`.
  → [emach-dashboard#214](https://github.com/othavioquiliao/emach-dashboard/issues/214)
- **Lateral de promoção no count**: o `LEFT JOIN LATERAL active_promo` roda no
  count query (`catalog.ts:384-408`) mesmo quando `onlyPromo=false`.
  → [emach-dashboard#215](https://github.com/othavioquiliao/emach-dashboard/issues/215)

## Findings considerados e rejeitados (para não re-auditar)

- **Lock de cupom "fora da janela"** (`place-order.ts:430`): o re-check após o
  `FOR UPDATE` já é load-bearing e corrige a corrida — não é bug.
- **Guard do dashboard via Suspense** (`layout.tsx`): correto e travado por
  `layout.guard.test.ts`. Informacional.
- **`drizzle-orm` duplicado** em `apps/web` + `packages/db`: by-design (o app usa
  helpers `eq`/`inArray` diretamente). Baixo valor.
- **`form: any` (TanStack) / `select()` sem projeção no checkout / pre-commit hook
  / inserts sequenciais de `orderItem` / `listClientOrders` over-fetch**: válidos
  mas baixo leverage; deixados de fora desta seleção. Reabrir se virarem dor.
- **vitest `^2.1.8`** (advisory GHSA-5xrq-8626-4rwp): exige `@vitest/ui` (ausente)
  → não explorável hoje. Bump v2→v3 é dívida de manutenção, não urgência; adiado.

## Adiado por decisão do operador (não rejeitado)

- **Pagamento real Asaas** (keystone, roadmap #4): fora desta sessão. Desbloqueia
  débito de estoque (ADR-0003), ciclo pós-pago, reembolso real e reviews.
- **Hardening de exposição de dados com dados reais**: quando o pagamento entrar,
  revisitar #3/#6/#7 sob tráfego real + considerar persistir `shippingUnverified`.
