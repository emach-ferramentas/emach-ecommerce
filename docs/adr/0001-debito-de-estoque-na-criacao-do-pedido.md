# Débito de estoque na criação do pedido

> **Superseded by [ADR-0003](./0003-estoque-multi-filial.md) em 2026-05-20.**

## Decisão original (histórico)

Debitava-se o estoque de forma síncrona na criação do pedido
(`order.status = pending_payment`), na mesma transação que inseria `order` e
`order_item`, com guarda `quantity >= qty` no UPDATE condicional como anti-oversell.

## Por que foi revogada

ADR-0003 (estoque multi-filial): a venda pode sair de qualquer filial, então
debitar na criação (filial única) bagunça o `stock_movement` e viola o contrato
compartilhado com o dashboard. O débito passou a ser responsabilidade da
transição para `paid`, junto da integração de pagamento.
