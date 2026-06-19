# Deploy via repo espelhado (org) e gates de CI: drift-check de env + test:ci unit-only

O código é trabalhado no repo **canônico** `othavi0/emach-ecommerce` (onde o GitHub Actions roda). A Vercel está conectada a `emach-ferramentas/emach-ecommerce` (repo da org, com **Actions desabilitado** — só deploya). Um workflow de mirror (`.github/workflows/mirror.yml`) no canônico espelha a `main` pro repo da org a cada push, e é esse push que dispara o deploy. O CI tem dois gates próprios além de `check-types`: **`check-env`** (drift de env vars vs Vercel) e **`test:ci`** (unit-only).

## Considered Options

- **Apontar a Vercel direto pro repo pessoal:** rejeitado — elimina os 2 repos, mas desconecta o código do repo da org (`emach-ferramentas`), que é a referência oficial da empresa. Mantido o mirror para preservar ambos.
- **Mirror manual (push cross-account a cada deploy):** rejeitado — atrito a cada deploy; fácil esquecer e o deploy ficar num commit velho (foi exatamente como o build quebrou com `NEXT_PUBLIC_SITE_URL` faltando).
- **Validar env só no build da Vercel (status quo do t3-env):** rejeitado — `@emach/env` valida tarde (no `next build`), então env obrigatória faltando só estoura no deploy. O `check-env` move o gate pra antes, no CI.
- **Rodar testes de integração no CI:** rejeitado — batem no Supabase compartilhado e são flaky sob concorrência (ver ADR e CLAUDE.md). Ficam fora via `VITEST_UNIT_ONLY=1`.

## Consequences

- **Deploy = `git push origin main`.** O mirror propaga pro `emach-ferramentas` e a Vercel deploya. Sem push manual.
- **Mirror (`mirror.yml`) exige `MIRROR_TOKEN`** = PAT fine-grained da conta `emach-ferramentas` (escopo: `Contents` R/W + `Workflows` R/W, só nesse repo). Cadastrado como secret no canônico. Dois gotchas que custaram tempo:
  - **`actions/checkout` precisa de `persist-credentials: false`** — senão grava um `http.extraheader` com o `GITHUB_TOKEN` do repo, que tem precedência sobre o `MIRROR_TOKEN` da URL e dá `permission denied` no destino (sintoma confuso: o PAT funciona local mas falha no CI).
  - **Cadastrar o secret com `gh secret set --body "$VALUE"`, nunca via pipe** (`printf | gh secret set` corrompeu o valor → `HTTP 401`).
- **Drift-check (`bun check:env`, `scripts/check-vercel-env.ts`)** deriva as env vars obrigatórias do próprio Zod (`packages/env/src/schemas.ts`, via `safeParse(undefined)`) e cruza com a API da Vercel — à prova de futuro (env obrigatória nova é coberta sem editar o script). Secrets `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` vivem no **canônico** (onde o CI roda); guard pula com warning se ausentes. **Env var obrigatória nova precisa ser cadastrada na Vercel** (`vercel env add`) — senão o `check-env` falha no CI e o build falharia no deploy.
- **`test:ci` é unit-only.** Arquivo de teste que usa `withRollback`/`db.transaction`/importa dados do DB é **integração** e deve entrar na lista `INTEGRATION` do `apps/web/vitest.config.ts` (senão quebra no CI sem `.env`/DB). `apps/web/vitest.setup.ts` injeta env dummy nas obrigatórias ausentes pra a validação do `@emach/env` não abortar a suíte no CI.
- **PAT tem validade/escopo** — quando rotacionar, atualizar o secret `MIRROR_TOKEN` (`gh secret set ... --body`).
