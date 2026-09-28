# Plan 008: Corrigir o corpo do ADR-0001 (contradiz o ADR-0003 atual)

> **Status em 2026-09-28:** implementado. `docs/adr/0001-debito-de-estoque-na-criacao-do-pedido.md` tem o aviso de revogação antes do histórico, com as seções "Decisão original (histórico)" e "Por que foi revogada". O ADR-0003 segue correto: `checkAggregateStock` só valida em `apps/web/src/app/checkout/_lib/place-order.ts:477`.

> **Executor instructions**: Siga passo a passo. STOP = pare e reporte. Ao
> terminar, atualize `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat feafcfa..HEAD -- docs/adr/0001-debito-de-estoque-na-criacao-do-pedido.md docs/adr/0003-estoque-multi-filial.md`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `feafcfa`, 2026-06-17

## Why this matters

O ADR-0001 tem o banner `> Superseded by ADR-0003`, mas o **corpo** ainda
descreve em detalhe a decisão revogada ("o storefront debita o estoque de forma
síncrona no momento em que o pedido é criado"). O comportamento real hoje
(`checkAggregateStock` sem débito — só validação agregada, débito adiado para a
transição `pending_payment → paid`) é o do ADR-0003. Quem lê o ADR-0001 sem
reparar no banner acredita que há débito na criação — fonte de bug em código que
assuma estoque já debitado.

## Current state

- `docs/adr/0001-debito-de-estoque-na-criacao-do-pedido.md` (atual, completo):

_Nota 2026-09-28: o trecho abaixo é o ADR-0001 antes do fix. O arquivo hoje já segue a estrutura sugerida no Step 1._
  ```md
  # Débito de estoque na criação do pedido

  > **Superseded by [ADR-0003](./0003-estoque-multi-filial.md) em 2026-05-20.**

  O storefront debita o estoque de forma síncrona no momento em que o pedido é
  criado (`order.status = pending_payment`), dentro da mesma transação que insere
  o `order` e os `order_item` — não há reserva, e o débito não espera a
  confirmação do pagamento. [...continua descrevendo a decisão revogada...]

  ## Considered Options
  [...]
  ## Consequences
  [...]
  ```
- A verdade atual está em `docs/adr/0003-estoque-multi-filial.md` (storefront só
  VALIDA agregado, NÃO debita na criação; `order.branch_id` NULL; débito adiado).
- Convenção: ADRs são markdown curto em `docs/adr/NNNN-*.md`.

## Commands you will need

| Purpose   | Command                              | Expected |
|-----------|--------------------------------------|----------|
| Render    | (visual) abrir o arquivo            | banner + resumo histórico claros |

## Scope

**In scope**:
- `docs/adr/0001-debito-de-estoque-na-criacao-do-pedido.md`

**Out of scope**:
- `docs/adr/0003-*.md` — está correto; não tocar.
- Qualquer código — este é um plano só de documentação.

## Git workflow

- Branch: `advisor/008-adr-0001`
- Commit `docs:` PT, ≤50 chars.

## Steps

### Step 1: Reescrever o corpo como resumo histórico

Substitua o corpo do ADR-0001 (mantendo o título e o banner) por um aviso
explícito de que o comportamento descrito **não é mais o implementado**, seguido
de um resumo histórico comprimido. Estrutura sugerida:

```md
# Débito de estoque na criação do pedido

> **Superseded by [ADR-0003](./0003-estoque-multi-filial.md) em 2026-05-20.**

> ⚠️ **Esta decisão foi revogada. O comportamento descrito abaixo NÃO é o
> implementado hoje.** O storefront atual apenas **valida** disponibilidade
> agregada (`SUM(stock_level.quantity)` em todas as filiais) na criação do
> pedido e **não** grava `stock_movement` nem debita estoque — o débito é
> adiado para a transição `pending_payment → paid`. Ver **ADR-0003** para a
> arquitetura vigente.

## Decisão original (histórico)

Debitava-se o estoque de forma síncrona na criação do pedido
(`order.status = pending_payment`), na mesma transação que inseria `order` e
`order_item`, com guarda `quantity >= qty` no UPDATE condicional como anti-oversell.

## Por que foi revogada

ADR-0003 (estoque multi-filial): a venda pode sair de qualquer filial, então
debitar na criação (filial única) bagunça o `stock_movement` e viola o contrato
compartilhado com o dashboard. O débito passou a ser responsabilidade da
transição para `paid`, junto da integração de pagamento.
```

**Verify**: abrir o arquivo e confirmar que (a) o aviso de revogação vem antes de
qualquer descrição do comportamento antigo, e (b) nenhuma frase no tempo presente
afirma que "o storefront debita na criação".

## Test plan

- Sem código. Verificação: leitura do arquivo renderizado; o leitor entende em 2
  segundos que a decisão é histórica.

## Done criteria

- [ ] ADR-0001 começa com banner + aviso de revogação destacado
- [ ] O comportamento antigo está sob um cabeçalho "histórico", não no presente
- [ ] Nenhuma afirmação presente contradiz o ADR-0003
- [ ] Nenhum arquivo fora do escopo modificado (`git status`)
- [ ] Linha de status atualizada em `plans/README.md`

## STOP conditions

Pare e reporte se:
- O ADR-0003 também parecer desatualizado em relação ao código
  (`place-order.ts` → `checkAggregateStock`) — então a verdade mudou de novo e
  este plano precisa ser revisto antes de citar o 0003 como fonte.

## Maintenance notes

- Quando a integração de pagamento entrar e o débito em `paid` for implementado,
  revisar AMBOS os ADRs para refletir o ledger real.
