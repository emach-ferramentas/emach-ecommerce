# Estoque multi-filial: storefront valida agregado, débito adiado para integração de pagamento

Storefront valida disponibilidade agregada (`SUM(stock_level.quantity)` por variante em todas as filiais) no checkout, mas não muta `stock_level` nem grava `stock_movement`. `order.branch_id` é NULL na criação. Débito de estoque acontecerá quando a integração de pagamento for implementada, na transição `pending_payment → paid`, conforme o contrato canônico (`emach-dashboard/docs/integration/admin-ecommerce.md` e ADR-0007 do dashboard).

## Considered Options

- **Manter ADR-0001 (débito em pending_payment, filial única):** rejeitado — viola contrato compartilhado e bagunça `stock_movement` quando a venda real veio de outra filial.
- **Implementar `confirmPayment()` agora sem integração de pagamento:** rejeitado — função sem caller é código morto até a integração real chegar. YAGNI.
- **Mover responsabilidade para o dashboard (escrever em `preparing`):** rejeitado — contradiz o ADR-0007 do dashboard, que coloca a responsabilidade no storefront.

## Consequences

- Vendas em produção não geram `stock_movement` até integração de pagamento ser implementada. Admin precisa manualmente debitar/ajustar estoque até lá. Aceitável: site está em fase pré-pagamento.
- Janela de oversell entre pedidos concorrentes: aceita. Sem lock pessimista. Volume não justifica.
- `order.branch_id` fica NULL em pedidos novos. Pedidos antigos com valor preenchido mantêm — sem migration retroativa.
- Quando integração de pagamento for adicionada (issue separado), criar `confirmPayment(orderId)` em `apps/web/src/lib/payment/` (ou similar) que: resolve filial, UPDATE stock_level com guarda, INSERT stock_movement (actor `system`, reason `saida_venda`), UPDATE order SET status='paid', paidAt=now().
