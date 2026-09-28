# Destravar checkout e imagens — Plano de implementação

> **Status em 2026-09-28:** implementado na parte de código; a Task 2 não foi verificada. A Task 1 entrou no merge `293d409` (traz o PR #29) e `branch.is_default` não existe mais em `packages/db/src/schema/inventory.ts`. O `DELETE FROM tool_image` não deixa rastro no repositório (não verificado). `apps/web/src/lib/default-branch.ts`, citado nos passos, foi removido em `a096c28` pelo plano `2026-05-20-estoque-multi-filial.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Destravar o checkout (sincronizando com `main` que tem o hotfix PR #29) e zerar `tool_image` (URLs apontam para arquivos inexistentes no bucket).

**Architecture:** Duas tarefas independentes e sequenciais. A primeira é um `git merge` puro (sem código novo). A segunda é um único `DELETE` SQL via MCP Supabase. Ambas são reversíveis (merge → `git reset`; delete → re-seed). Nenhum código de aplicação é escrito.

**Tech Stack:** Git, Drizzle, Postgres (Supabase via MCP), Next.js 16, Bun, Turborepo.

**Spec:** `docs/superpowers/specs/2026-05-20-destravar-checkout-e-imagens-design.md`

---

## Pré-flight

Antes da Task 1, confirmar estado limpo:

- [ ] **Pré-flight 1: Confirmar branch e working tree limpo**

```bash
git status
git branch --show-current
```

Esperado:
- branch atual: `feat/melhorias-pages-2`
- `working tree clean — nothing to commit`

Se houver alterações não commitadas, parar e perguntar ao user.

- [ ] **Pré-flight 2: Garantir que `origin/main` está atualizado**

```bash
git fetch origin main
git log --oneline origin/main -3
```

Esperado: o topo de `origin/main` deve ser `7cede03 fix: hotfix remove branch.is_default e ajusta resolver`. Se não, parar e investigar.

- [ ] **Pré-flight 3: Confirmar que a branch atual ainda referencia `branch.isDefault`**

```bash
grep -n "isDefault\|is_default" packages/db/src/schema/inventory.ts
grep -n "isDefault" apps/web/src/lib/default-branch.ts
```

Esperado:
- `packages/db/src/schema/inventory.ts` contém `isDefault: boolean(...)` e `uniqueIndex("branch_is_default_unique")`
- `apps/web/src/lib/default-branch.ts` contém `where(eq(branch.isDefault, true))`

Se nenhum dos dois bater, o merge já aconteceu — pular Task 1 e ir direto para Task 2.

---

## Task 1: Sincronizar branch com `main` (traz PR #29)

**Files:**
- Modify (via merge, não via Edit): `packages/db/src/schema/inventory.ts`
- Modify (via merge): `apps/web/src/lib/default-branch.ts`
- Vários outros arquivos chegando de `main` (commits entre o merge-base `2e3d5e2` e `origin/main` — ver `git log --oneline 2e3d5e2..origin/main`).

- [ ] **Step 1.1: Executar o merge**

```bash
git merge origin/main
```

Esperado: merge completa sem conflito. Mensagem `Merge made by the 'ort' strategy.` ou similar, com lista de arquivos alterados.

Se aparecer conflito (improvável — `inventory.ts` e `default-branch.ts` não foram tocados pelos 2 commits locais), resolver preservando o conteúdo vindo de `main` para esses dois arquivos:

```bash
# Em caso de conflito:
git checkout --theirs packages/db/src/schema/inventory.ts
git checkout --theirs apps/web/src/lib/default-branch.ts
# Inspecionar outros conflitos com:
git status
# Depois:
git add <arquivos resolvidos>
git commit
```

- [ ] **Step 1.2: Verificar que o hotfix está presente**

_Nota 2026-09-28: o segundo `grep` não funciona mais, porque `default-branch.ts` foi removido (`a096c28`)._

```bash
grep -n "isDefault\|is_default" packages/db/src/schema/inventory.ts
grep -n "ECOMMERCE_DEFAULT_BRANCH_ID\|asc(branch.createdAt)" apps/web/src/lib/default-branch.ts
```

Esperado:
- `inventory.ts` **NÃO contém** mais `isDefault` nem `branch_is_default_unique`.
- `default-branch.ts` contém `process.env.ECOMMERCE_DEFAULT_BRANCH_ID` e `orderBy(asc(branch.createdAt))`.

- [ ] **Step 1.3: Reinstalar dependências (caso `bun.lock` tenha vindo de `main`)**

```bash
bun install
```

Esperado: completa sem erro.

- [ ] **Step 1.4: Verificar tipos no monorepo inteiro**

```bash
bun run check-types
```

Esperado: `Tasks: N successful, N total` (todos os workspaces passam, sem erro TypeScript).

Se falhar, ler a mensagem e corrigir. Não silenciar com `as any` ou `@ts-ignore`.

- [ ] **Step 1.5: Confirmar que schema Drizzle bate com o DB real**

```bash
bun --cwd packages/db db:check-drift
```

Esperado: comando termina sem reportar drift (ou seja, schema Drizzle == DB).

Se reportar drift residual, parar e investigar — não seguir para Task 2.

- [ ] **Step 1.6: Smoke da app web em dev**

```bash
bun run dev:web
```

Em outro terminal/aba do browser, visitar:
- `http://localhost:3001/` — home renderiza sem erro
- `http://localhost:3001/catalog` — PLP carrega
- `http://localhost:3001/product/furadeira-de-impacto-650w` — PDP carrega (imagem ainda quebrada nesta etapa — esperado)

Esperado: nenhuma das páginas joga 500. Imagens podem estar quebradas (`<img>` com src 404) — esse é o problema da Task 2.

Parar `bun run dev:web` (Ctrl+C) antes de seguir.

- [ ] **Step 1.7: O merge já gerou um commit (merge commit). Conferir.**

```bash
git log --oneline -5
```

Esperado: o topo é um merge commit (`Merge branch 'main' into feat/melhorias-pages-2` ou similar). Não fazer commit adicional — o merge cobre.

Se por algum motivo o merge foi fast-forward (não deveria, dado que a branch tem commits exclusivos), também está OK.

---

## Task 2: Limpar `tool_image`

**Files:** nenhum (operação direta no DB via MCP Supabase).

**Pré-condição:** Task 1 completa.

- [ ] **Step 2.1: Inspecionar estado atual (registro de evidência)**

Via MCP Supabase:

```sql
SELECT COUNT(*) AS total, MIN(created_at) AS oldest, MAX(created_at) AS newest
FROM tool_image;
```

Esperado: `total = 17`, `oldest = newest = 2026-05-20 20:34:49.201823+00` (todos do mesmo seed quebrado).

Se o `total` for diferente de 17, ou os timestamps incluírem registros mais recentes (alguém pode ter subido imagens via dashboard nesse meio tempo), **parar e perguntar ao user** antes de deletar — pode haver dados legítimos.

- [ ] **Step 2.2: Executar o DELETE**

Via MCP Supabase:

```sql
DELETE FROM tool_image;
```

Esperado: linha de retorno indicando 17 (ou o número confirmado em 2.1) linhas afetadas.

- [ ] **Step 2.3: Confirmar tabela vazia**

Via MCP Supabase:

```sql
SELECT COUNT(*) AS total FROM tool_image;
```

Esperado: `total = 0`.

- [ ] **Step 2.4: Smoke da app web — confirmar que nada quebra sem imagens**

```bash
bun run dev:web
```

Visitar no browser:
- `http://localhost:3001/` — home renderiza, cards de categoria/produto aparecem (sem imagem ou com placeholder; sem 500).
- `http://localhost:3001/catalog` — PLP carrega, ProductCard renderiza sem imagem.
- `http://localhost:3001/product/furadeira-de-impacto-650w` (ou qualquer slug existente) — PDP carrega; galeria pode aparecer vazia.

Esperado: nenhuma 500. Componentes lidam graciosamente com `primary_image_url = null` / `images = []`.

Se algum componente quebra (ex.: `Cannot read properties of undefined (reading 'url')`), **registrar como follow-up** (issue separado) — não bloquear este plano. Componentes de UI sem fallback são problema pré-existente que ficou exposto pelo DELETE.

Parar `bun run dev:web` (Ctrl+C).

- [ ] **Step 2.5: Smoke do checkout (verifica conjuntamente Task 1 e Task 2)**

Com `bun run dev:web` rodando:

1. Adicionar 1 item ao carrinho (via PDP).
2. Ir para `/cart` → `/checkout`.
3. Preencher dados mínimos e submeter.

Esperado: pedido criado sem erro de coluna `is_default does not exist`. A action `createOrderAction` completa e retorna sucesso (ou erro de validação de form esperado, não erro de SQL).

Verificar via MCP Supabase que o pedido foi gravado:

```sql
SELECT id, number, status, branch_id, total_amount, created_at
FROM "order"
ORDER BY created_at DESC
LIMIT 1;
```

Esperado: pedido recente com `branch_id` preenchido (filial mais antiga, conforme fallback do hotfix).

- [ ] **Step 2.6: Não há commit nesta task**

A Task 2 não altera arquivos versionados. O efeito é só no banco. Não há `git commit`.

---

## Pós-conclusão

- [ ] **Pós 1: Atualizar tasks no TaskList**

Marcar Tasks #2 e #3 (Etapa 1 e Etapa 2 do escopo original) como `completed`.

- [ ] **Pós 2: Comunicar ao user**

Reportar:
- Branch `feat/melhorias-pages-2` agora contém o hotfix PR #29 (mergeado de `main`).
- `tool_image` zerada — produtos aparecem sem imagem até o re-upload manual via dashboard.
- Checkout funcional (smoke validado).
- Etapa 3 (#28 multi-filial) continua pendente — spec dedicado futuro.

- [ ] **Pós 3: Decisão de PR (opcional, fica com o user)**

Não há push automático. User decide se quer:
- Push da branch (`git push`)
- Abrir PR
- Ou continuar trabalhando na branch antes de abrir PR.

---

## Non-goals (não fazer neste plano)

- **NÃO** re-popular `tool_image` via script ou seed. User vai re-subir manualmente via dashboard.
- **NÃO** deletar os 61 arquivos órfãos do bucket `tool-images`.
- **NÃO** implementar regra multi-filial (#28). Spec separado.
- **NÃO** mexer em `lib/default-branch.ts` além do que vier do merge.
- **NÃO** abrir PR, fazer push, ou commit fora do merge commit da Task 1.
